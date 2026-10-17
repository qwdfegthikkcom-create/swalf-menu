/* الاتصال بين صفحة الزبون والكاشير.
   وضعان، يحددهما DIJLA_CONFIG.mode:
   - 'cloud': قاعدة بيانات Supabase، فالطلب من أي هاتف يصل إلى الكاشير على أي جهاز.
   - 'local': تجربة على جهاز واحد (المتصفح نفسه): الطلبات تُحفظ في المتصفح وتتزامن بين نوافذه.
   الواجهتان لا تعرفان أي وضع يعمل: كلاهما يستدعي الدوال نفسها هنا. */
window.DIJLA_CONFIG = window.DIJLA_CONFIG || {
  mode: 'local',
  url: 'https://vheyvovzqvlqhmkmpylz.supabase.co',
  key: 'sb_publishable_-wIbxz0XApxFvcbcuESJmw_vcf5QLnQ'
};

(function () {
  var CFG = window.DIJLA_CONFIG;
  var MENU = window.DIJLA_MENU;

  function fail(code) { var e = new Error(code); e.code = code; return e; }

  /* ===== السحابة (Supabase) ===== */
  function rpc(fn, args) {
    return fetch(CFG.url + '/rest/v1/rpc/' + fn, {
      method: 'POST',
      headers: { 'apikey': CFG.key, 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify(args || {}),
      cache: 'no-store'
    }).then(function (res) {
      return res.text().then(function (txt) {
        var data = txt ? JSON.parse(txt) : null;
        if (res.ok) return data;
        var msg = (data && data.message) || '';
        if (data && data.code === '28000') throw fail('session');
        if (/^unavailable:/.test(msg)) throw fail(msg);
        if (msg === 'busy') throw fail('busy');
        throw fail('server');
      });
    }, function () { throw fail('network'); });
  }
  var cloud = {
    mode: 'cloud',
    menu: function () { return rpc('dijla_menu'); },
    placeOrder: function (o) { return rpc('dijla_place_order', { p_kind: o.kind, p_table: o.table || null, p_lines: o.lines, p_note: o.note || '' }); },
    orderStatus: function (tokens) { return tokens.length ? rpc('dijla_order_status', { p_tokens: tokens }) : Promise.resolve([]); },
    request: function (table, kind) { return rpc('dijla_request', { p_table: table, p_kind: kind }); },
    login: function (pin) { return rpc('dijla_login', { p_pin: pin }); },
    logout: function (s) { return rpc('dijla_logout', { p_session: s }); },
    board: function (s) { return rpc('dijla_board', { p_session: s }); },
    setStatus: function (s, id, status, pay) { return rpc('dijla_set_status', { p_session: s, p_order: id, p_status: status, p_pay: pay || null }); },
    cashierOrder: function (s, o) { return rpc('dijla_cashier_order', { p_session: s, p_kind: o.kind, p_table: o.table || null, p_lines: o.lines, p_note: o.note || '' }); },
    setAvailable: function (s, id, on) { return rpc('dijla_set_available', { p_session: s, p_item: id, p_available: on }); },
    requestDone: function (s, id) { return rpc('dijla_request_done', { p_session: s, p_id: id }); }
  };

  /* ===== التجربة المحلية (المتصفح نفسه) ===== */
  var KEY = 'dijla-demo-db-v1';
  var LOCAL_PIN = '2468'; // للتجربة المحلية فقط؛ رمز السحابة مخزّن مشفّراً في القاعدة.
  function load() {
    var db;
    try { db = JSON.parse(localStorage.getItem(KEY)); } catch (e) { db = null; }
    if (!db || !db.items) db = { seq: 0, rseq: 0, items: {}, orders: [], requests: [], sessions: [] };
    MENU.items.forEach(function (it) { if (!(it.id in db.items)) db.items[it.id] = true; });
    var cutoff = Date.now() - 3 * 864e5;
    db.orders = db.orders.filter(function (o) { return Date.parse(o.created_at) > cutoff; });
    db.requests = db.requests.filter(function (r) { return Date.parse(r.created_at) > cutoff; });
    return db;
  }
  function save(db) {
    try { localStorage.setItem(KEY, JSON.stringify(db)); } catch (e) { throw fail('storage'); }
  }
  function todayStart() {
    // بداية اليوم بتوقيت بغداد (UTC+3 طوال السنة).
    var n = new Date(Date.now() + 3 * 36e5);
    return Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate()) - 3 * 36e5;
  }
  function uid() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return 'x' + Math.random().toString(36).slice(2) + Date.now().toString(36);
  }
  function menuState(db) {
    return MENU.items.map(function (it) { return { id: it.id, price: it.price, available: db.items[it.id] !== false }; });
  }
  function findItem(id) { for (var i = 0; i < MENU.items.length; i++) if (MENU.items[i].id === id) return MENU.items[i]; return null; }
  function createOrder(db, o, source) {
    if (o.kind !== 'table' && o.kind !== 'takeaway') throw fail('server');
    if (o.kind === 'table' && !(o.table >= 1 && o.table <= 99)) throw fail('server');
    if (!o.lines || !o.lines.length || o.lines.length > 40) throw fail('server');
    var start = todayStart(), no = 0, total = 0;
    db.orders.forEach(function (x) { if (Date.parse(x.created_at) >= start && x.no > no) no = x.no; });
    var lines = o.lines.map(function (l) {
      var it = findItem(l.id);
      if (!it) throw fail('server');
      if (db.items[it.id] === false) throw fail('unavailable:' + it.id);
      if (!(l.qty >= 1 && l.qty <= 20)) throw fail('server');
      total += it.price * l.qty;
      return { id: it.id, name: it.name, price: it.price, qty: l.qty, note: (l.note || '').slice(0, 120) };
    });
    var now = new Date().toISOString();
    var order = {
      id: ++db.seq, no: no + 1, token: uid(), kind: o.kind, table: o.kind === 'table' ? o.table : null,
      source: source, status: 'new', note: (o.note || '').slice(0, 200), total: total, pay: null,
      created_at: now, updated_at: now, paid_at: null, lines: lines
    };
    db.orders.push(order);
    return order;
  }
  function needSession(db, s) {
    if (!s || db.sessions.indexOf(s) < 0) throw fail('session');
  }
  function strip(o) { var c = JSON.parse(JSON.stringify(o)); delete c.token; return c; }
  function op(fn) {
    return function () {
      var args = arguments;
      return new Promise(function (ok) { ok(fn.apply(null, args)); });
    };
  }
  var local = {
    mode: 'local',
    menu: op(function () { return menuState(load()); }),
    placeOrder: op(function (o) { var db = load(); var r = createOrder(db, o, 'customer'); save(db); return r; }),
    orderStatus: op(function (tokens) {
      return load().orders.filter(function (o) { return tokens.indexOf(o.token) >= 0; });
    }),
    request: op(function (table, kind) {
      var db = load(), recent = Date.now() - 15 * 6e4;
      var r = db.requests.filter(function (x) { return x.table === table && x.kind === kind && x.status === 'open' && Date.parse(x.created_at) > recent; })[0];
      if (!r) { r = { id: ++db.rseq, table: table, kind: kind, status: 'open', created_at: new Date().toISOString() }; db.requests.push(r); save(db); }
      return r;
    }),
    login: op(function (pin) {
      if (pin !== LOCAL_PIN) return { error: 'pin' };
      var db = load(), s = uid(); db.sessions = db.sessions.slice(-9).concat(s); save(db);
      return { session: s };
    }),
    logout: op(function (s) { var db = load(); db.sessions = db.sessions.filter(function (x) { return x !== s; }); save(db); }),
    board: op(function (s) {
      var db = load(); needSession(db, s);
      var start = todayStart();
      return {
        now: new Date().toISOString(),
        orders: db.orders.filter(function (o) { return Date.parse(o.created_at) >= start || ['new', 'preparing', 'ready', 'served'].indexOf(o.status) >= 0; }).map(strip),
        requests: db.requests.filter(function (r) { return r.status === 'open'; }),
        items: menuState(db)
      };
    }),
    setStatus: op(function (s, id, status, pay) {
      var db = load(); needSession(db, s);
      var o = db.orders.filter(function (x) { return x.id === id; })[0];
      if (!o) throw fail('server');
      o.status = status; o.updated_at = new Date().toISOString();
      if (status === 'paid') { o.pay = pay; o.paid_at = o.updated_at; }
      save(db); return strip(o);
    }),
    cashierOrder: op(function (s, o) { var db = load(); needSession(db, s); var r = createOrder(db, o, 'cashier'); save(db); return strip(r); }),
    setAvailable: op(function (s, id, on) { var db = load(); needSession(db, s); db.items[id] = !!on; save(db); return menuState(db); }),
    requestDone: op(function (s, id) {
      var db = load(); needSession(db, s);
      db.requests.forEach(function (r) { if (r.id === id) r.status = 'done'; }); save(db);
    })
  };

  window.Dijla = CFG.mode === 'cloud' ? cloud : local;

  /* ===== أدوات مشتركة ===== */
  var nf = new Intl.NumberFormat('ar-IQ');
  window.Dijla.fmt = function (n) { return nf.format(n); };
  window.Dijla.money = function (n) { return nf.format(n) + ' ' + MENU.currency; };
  window.Dijla.item = findItem;
  window.Dijla.STATUS = {
    new: 'جديد', preparing: 'قيد التحضير', ready: 'جاهز', served: 'قُدِّم', paid: 'مدفوع', cancelled: 'ملغى'
  };
  window.Dijla.errorText = function (e) {
    var c = (e && e.code) || '';
    if (c.indexOf('unavailable:') === 0) {
      var it = findItem(c.slice(12));
      return (it ? '«' + it.name + '»' : 'أحد الأصناف') + ' نفد الآن. احذفه من السلة وأعد الإرسال.';
    }
    if (c === 'network') return 'لا يوجد اتصال بالإنترنت. تأكد من الاتصال وحاول مرة أخرى.';
    if (c === 'busy') return 'الطلبات كثيرة الآن. انتظر دقيقة وحاول مرة أخرى.';
    if (c === 'storage') return 'المتصفح لا يسمح بحفظ الطلب (وضع التصفح الخاص؟).';
    return 'حدث خطأ غير متوقع. حاول مرة أخرى.';
  };
  // تنبيه للنوافذ الأخرى في التجربة المحلية، حتى يتحدث الكاشير فوراً.
  window.Dijla.onLocalChange = function (cb) {
    if (window.Dijla.mode !== 'local') return;
    window.addEventListener('storage', function (e) { if (e.key === KEY) cb(); });
  };
})();
