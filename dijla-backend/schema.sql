-- منيو مطعم دجلة (نموذج عرض): قاعدة البيانات في Supabase.
--
-- الجداول في مخطط dijla، وهو غير مكشوف للواجهة البرمجية، فلا يقرؤها أحد مباشرة.
-- كل شيء يمر عبر دوال public.dijla_* (security definer) تتحقق من المدخلات:
--   الزبون: dijla_menu، dijla_place_order، dijla_order_status، dijla_request
--   الكاشير: dijla_login ثم بقية الدوال بجلسة (session) تنتهي بعد 12 ساعة.
-- رمز الكاشير (PIN) لا يُكتب هنا: يُضبط مرة واحدة بـ
--   select dijla_set_pin('الرمز');   -- من لوحة SQL في Supabase فقط
-- الأصناف تأتي من seed.sql (يولّده seed.cjs من docs/dijla-menu/assets/menu.js).

create extension if not exists pgcrypto with schema extensions;
create schema if not exists dijla;
revoke all on schema dijla from public, anon, authenticated;

create table if not exists dijla.items (
  id text primary key,
  cat text not null,
  name text not null,
  price integer not null check (price > 0),
  available boolean not null default true,
  sort integer not null default 0
);

create table if not exists dijla.orders (
  id bigint generated always as identity primary key,
  no integer not null,
  token uuid not null default gen_random_uuid() unique,
  kind text not null check (kind in ('table', 'takeaway')),
  table_no integer check (table_no between 1 and 99),
  source text not null check (source in ('customer', 'cashier')),
  status text not null default 'new'
    check (status in ('new', 'preparing', 'ready', 'served', 'paid', 'cancelled')),
  note text not null default '' check (char_length(note) <= 200),
  total integer not null,
  pay_method text check (pay_method in ('cash', 'card')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  paid_at timestamptz,
  check ((kind = 'table') = (table_no is not null))
);
create index if not exists orders_created_idx on dijla.orders (created_at desc);

create table if not exists dijla.order_lines (
  id bigint generated always as identity primary key,
  order_id bigint not null references dijla.orders (id) on delete cascade,
  item_id text not null,
  name text not null,
  price integer not null,
  qty integer not null check (qty between 1 and 20),
  note text not null default '' check (char_length(note) <= 120)
);
create index if not exists order_lines_order_idx on dijla.order_lines (order_id);

create table if not exists dijla.requests (
  id bigint generated always as identity primary key,
  table_no integer not null check (table_no between 1 and 99),
  kind text not null check (kind in ('waiter', 'bill')),
  status text not null default 'open' check (status in ('open', 'done')),
  created_at timestamptz not null default now()
);
create index if not exists requests_created_idx on dijla.requests (created_at desc);

create table if not exists dijla.settings (k text primary key, v text not null);
create table if not exists dijla.sessions (
  token uuid primary key default gen_random_uuid(),
  expires_at timestamptz not null default now() + interval '12 hours'
);
create table if not exists dijla.login_fails (at timestamptz not null default now());

alter table dijla.items enable row level security;
alter table dijla.orders enable row level security;
alter table dijla.order_lines enable row level security;
alter table dijla.requests enable row level security;
alter table dijla.settings enable row level security;
alter table dijla.sessions enable row level security;
alter table dijla.login_fails enable row level security;

-- ===== أدوات داخلية =====

-- بداية «اليوم» بتوقيت بغداد.
create or replace function dijla.today_start() returns timestamptz
language sql stable set search_path = '' as $$
  select (date_trunc('day', now() at time zone 'Asia/Baghdad')) at time zone 'Asia/Baghdad';
$$;

-- يتأكد أن جلسة الكاشير صالحة، وإلا يرفض.
create or replace function dijla.require_session(p_session uuid) returns void
language plpgsql set search_path = '' as $$
begin
  if p_session is null or not exists (
    select 1 from dijla.sessions where token = p_session and expires_at > now()
  ) then
    raise exception 'session' using errcode = '28000';
  end if;
end $$;

-- ينشئ طلباً من قائمة أسطر [{id, qty, note}] ويحسب المجموع من أسعار القاعدة لا من المتصفح.
create or replace function dijla.create_order(
  p_kind text, p_table integer, p_lines jsonb, p_note text, p_source text
) returns dijla.orders
language plpgsql set search_path = '' as $$
declare
  v_order dijla.orders;
  v_line jsonb;
  v_item dijla.items;
  v_qty integer;
  v_total integer := 0;
  v_no integer;
begin
  if p_kind not in ('table', 'takeaway') then raise exception 'kind'; end if;
  if p_kind = 'table' and (p_table is null or p_table < 1 or p_table > 99) then raise exception 'table'; end if;
  if jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 or jsonb_array_length(p_lines) > 40 then
    raise exception 'lines';
  end if;
  if char_length(coalesce(p_note, '')) > 200 then raise exception 'note'; end if;

  -- حد بسيط ضد الإغراق: لا أكثر من 60 طلباً في 5 دقائق.
  if (select count(*) from dijla.orders where created_at > now() - interval '5 minutes') >= 60 then
    raise exception 'busy';
  end if;

  -- تنظيف: النموذج يحتفظ بالطلبات ثلاثة أيام فقط.
  delete from dijla.orders where created_at < now() - interval '3 days';
  delete from dijla.requests where created_at < now() - interval '3 days';

  -- رقم الطلب اليومي (يبدأ من 1 كل يوم).
  perform pg_advisory_xact_lock(hashtext('dijla.order_no'));
  select coalesce(max(no), 0) + 1 into v_no from dijla.orders where created_at >= dijla.today_start();

  insert into dijla.orders (no, kind, table_no, source, note, total)
  values (v_no, p_kind, case when p_kind = 'table' then p_table end, p_source, coalesce(p_note, ''), 0)
  returning * into v_order;

  for v_line in select * from jsonb_array_elements(p_lines) loop
    select * into v_item from dijla.items where id = v_line ->> 'id';
    if not found then raise exception 'item'; end if;
    if not v_item.available then raise exception 'unavailable:%', v_item.id; end if;
    v_qty := (v_line ->> 'qty')::integer;
    if v_qty is null or v_qty < 1 or v_qty > 20 then raise exception 'qty'; end if;
    if char_length(coalesce(v_line ->> 'note', '')) > 120 then raise exception 'note'; end if;
    insert into dijla.order_lines (order_id, item_id, name, price, qty, note)
    values (v_order.id, v_item.id, v_item.name, v_item.price, v_qty, coalesce(v_line ->> 'note', ''));
    v_total := v_total + v_item.price * v_qty;
  end loop;

  update dijla.orders set total = v_total where id = v_order.id returning * into v_order;
  return v_order;
end $$;

create or replace function dijla.order_json(o dijla.orders) returns jsonb
language sql stable set search_path = '' as $$
  select jsonb_build_object(
    'id', o.id, 'no', o.no, 'kind', o.kind, 'table', o.table_no, 'source', o.source,
    'status', o.status, 'note', o.note, 'total', o.total, 'pay', o.pay_method,
    'created_at', o.created_at, 'updated_at', o.updated_at, 'paid_at', o.paid_at,
    'lines', coalesce((
      select jsonb_agg(jsonb_build_object('id', l.item_id, 'name', l.name, 'price', l.price, 'qty', l.qty, 'note', l.note) order by l.id)
      from dijla.order_lines l where l.order_id = o.id
    ), '[]'::jsonb)
  );
$$;

-- ===== دوال الزبون =====

create or replace function public.dijla_menu() returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', id, 'price', price, 'available', available) order by sort), '[]'::jsonb)
  from dijla.items;
$$;

create or replace function public.dijla_place_order(p_kind text, p_table integer, p_lines jsonb, p_note text default '')
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v dijla.orders;
begin
  v := dijla.create_order(p_kind, p_table, p_lines, p_note, 'customer');
  return dijla.order_json(v) || jsonb_build_object('token', v.token);
end $$;

-- الزبون يتابع طلباته فقط، بالرمز السري الذي رجع له عند الطلب.
create or replace function public.dijla_order_status(p_tokens uuid[]) returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(dijla.order_json(o) || jsonb_build_object('token', o.token) order by o.id), '[]'::jsonb)
  from dijla.orders o
  where o.token = any (p_tokens[1:20]);
$$;

create or replace function public.dijla_request(p_table integer, p_kind text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v dijla.requests;
begin
  if p_kind not in ('waiter', 'bill') or p_table is null or p_table < 1 or p_table > 99 then
    raise exception 'request';
  end if;
  select * into v from dijla.requests
   where table_no = p_table and kind = p_kind and status = 'open'
     and created_at > now() - interval '15 minutes'
   order by id desc limit 1;
  if not found then
    if (select count(*) from dijla.requests where created_at > now() - interval '5 minutes') >= 60 then
      raise exception 'busy';
    end if;
    insert into dijla.requests (table_no, kind) values (p_table, p_kind) returning * into v;
  end if;
  return jsonb_build_object('id', v.id, 'table', v.table_no, 'kind', v.kind, 'created_at', v.created_at);
end $$;

-- ===== دوال الكاشير =====

create or replace function public.dijla_login(p_pin text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_hash text; v_token uuid;
begin
  -- الخطأ يرجع نتيجةً لا استثناءً، حتى تُحفظ المحاولة الفاشلة ويعمل القفل
  -- (10 محاولات خاطئة في 10 دقائق تقفل الدخول 10 دقائق).
  if (select count(*) from dijla.login_fails where at > now() - interval '10 minutes') >= 10 then
    return jsonb_build_object('error', 'locked');
  end if;
  select v into v_hash from dijla.settings where k = 'pin_hash';
  if v_hash is null or p_pin is null or extensions.crypt(p_pin, v_hash) <> v_hash then
    insert into dijla.login_fails default values;
    return jsonb_build_object('error', 'pin');
  end if;
  delete from dijla.sessions where expires_at < now();
  delete from dijla.login_fails where at < now() - interval '1 day';
  insert into dijla.sessions default values returning token into v_token;
  return jsonb_build_object('session', v_token);
end $$;

create or replace function public.dijla_logout(p_session uuid) returns void
language sql security definer set search_path = '' as $$
  delete from dijla.sessions where token = p_session;
$$;

-- كل ما تحتاجه شاشة الكاشير: طلبات اليوم، والنداءات المفتوحة، والأصناف.
create or replace function public.dijla_board(p_session uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  perform dijla.require_session(p_session);
  return jsonb_build_object(
    'now', now(),
    'orders', coalesce((
      select jsonb_agg(dijla.order_json(o) order by o.id)
      from dijla.orders o
      where o.created_at >= dijla.today_start()
         or o.status in ('new', 'preparing', 'ready', 'served')
    ), '[]'::jsonb),
    'requests', coalesce((
      select jsonb_agg(jsonb_build_object('id', r.id, 'table', r.table_no, 'kind', r.kind, 'created_at', r.created_at) order by r.id)
      from dijla.requests r where r.status = 'open'
    ), '[]'::jsonb),
    'items', public.dijla_menu()
  );
end $$;

create or replace function public.dijla_set_status(p_session uuid, p_order bigint, p_status text, p_pay text default null)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v dijla.orders;
begin
  perform dijla.require_session(p_session);
  if p_status not in ('new', 'preparing', 'ready', 'served', 'paid', 'cancelled') then raise exception 'status'; end if;
  if p_status = 'paid' and coalesce(p_pay, '') not in ('cash', 'card') then raise exception 'pay'; end if;
  update dijla.orders
     set status = p_status,
         pay_method = case when p_status = 'paid' then p_pay else pay_method end,
         paid_at = case when p_status = 'paid' then now() else paid_at end,
         updated_at = now()
   where id = p_order
  returning * into v;
  if not found then raise exception 'order'; end if;
  return dijla.order_json(v);
end $$;

create or replace function public.dijla_cashier_order(p_session uuid, p_kind text, p_table integer, p_lines jsonb, p_note text default '')
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v dijla.orders;
begin
  perform dijla.require_session(p_session);
  v := dijla.create_order(p_kind, p_table, p_lines, p_note, 'cashier');
  return dijla.order_json(v);
end $$;

create or replace function public.dijla_set_available(p_session uuid, p_item text, p_available boolean) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  perform dijla.require_session(p_session);
  update dijla.items set available = p_available where id = p_item;
  if not found then raise exception 'item'; end if;
  return public.dijla_menu();
end $$;

create or replace function public.dijla_request_done(p_session uuid, p_id bigint) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform dijla.require_session(p_session);
  update dijla.requests set status = 'done' where id = p_id;
end $$;

-- يُستدعى من لوحة SQL فقط (ليس للزوار).
create or replace function public.dijla_set_pin(p_pin text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if p_pin !~ '^[0-9]{4,8}$' then raise exception 'pin must be 4-8 digits'; end if;
  insert into dijla.settings (k, v) values ('pin_hash', extensions.crypt(p_pin, extensions.gen_salt('bf')))
  on conflict (k) do update set v = excluded.v;
  delete from dijla.sessions;
end $$;

-- الصلاحيات: الزوار ينفذون دوال الزبون والكاشير (المحمية بالجلسة) فقط.
revoke all on all functions in schema dijla from public, anon, authenticated;
revoke all on function
  public.dijla_menu(), public.dijla_place_order(text, integer, jsonb, text),
  public.dijla_order_status(uuid[]), public.dijla_request(integer, text),
  public.dijla_login(text), public.dijla_logout(uuid), public.dijla_board(uuid),
  public.dijla_set_status(uuid, bigint, text, text),
  public.dijla_cashier_order(uuid, text, integer, jsonb, text),
  public.dijla_set_available(uuid, text, boolean), public.dijla_request_done(uuid, bigint),
  public.dijla_set_pin(text)
from public, anon, authenticated;
grant execute on function
  public.dijla_menu(), public.dijla_place_order(text, integer, jsonb, text),
  public.dijla_order_status(uuid[]), public.dijla_request(integer, text),
  public.dijla_login(text), public.dijla_logout(uuid), public.dijla_board(uuid),
  public.dijla_set_status(uuid, bigint, text, text),
  public.dijla_cashier_order(uuid, text, integer, jsonb, text),
  public.dijla_set_available(uuid, text, boolean), public.dijla_request_done(uuid, bigint)
to anon, authenticated;
