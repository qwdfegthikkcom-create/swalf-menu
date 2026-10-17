// يولّد seed.sql من منيو دجلة (docs/dijla-menu/assets/menu.js).
// يحدّث الاسم والقسم والسعر والترتيب، ولا يلمس «متوفر/نفد» الذي يضبطه الكاشير.
// الاستعمال: node dijla-backend/seed.cjs > dijla-backend/seed.sql
const fs = require('fs');
const path = require('path');
const src = fs.readFileSync(path.join(__dirname, '../docs/dijla-menu/assets/menu.js'), 'utf8');
const window = {};
new Function('window', src)(window);
const menu = window.DIJLA_MENU;
const q = s => "'" + String(s).replace(/'/g, "''") + "'";
const ids = new Set();
const rows = menu.items.map((it, i) => {
  if (ids.has(it.id)) throw new Error('duplicate id ' + it.id);
  ids.add(it.id);
  if (!menu.categories.some(c => c.id === it.cat)) throw new Error('bad cat ' + it.cat);
  if (!Number.isInteger(it.price) || it.price <= 0) throw new Error('bad price ' + it.id);
  return `  (${q(it.id)}, ${q(it.cat)}, ${q(it.name)}, ${it.price}, ${i + 1})`;
});
process.stdout.write(`-- مولَّد من docs/dijla-menu/assets/menu.js بـ seed.cjs، لا تعدّله باليد.
insert into dijla.items (id, cat, name, price, sort) values
${rows.join(',\n')}
on conflict (id) do update set cat = excluded.cat, name = excluded.name, price = excluded.price, sort = excluded.sort;
delete from dijla.items where id not in (${[...ids].map(q).join(', ')});
`);
