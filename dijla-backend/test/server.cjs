// خادم اختبار: يقدّم ملفات docs/ ويحاكي /rest/v1/rpc/* من Supabase على Postgres محلي (بدور anon).
const http = require('http'), fs = require('fs'), path = require('path');
const { Pool } = require('pg');
const ROOT = process.argv[2], PORT = +process.argv[3] || 8090;
const pool = new Pool(); // يقرأ PGHOST وPGPORT وPGUSER من البيئة
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.webp': 'image/webp', '.png': 'image/png' };
http.createServer(async (req, res) => {
  const u = new URL(req.url, 'http://x');
  const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*' };
  if (req.method === 'OPTIONS') { res.writeHead(204, cors); return res.end(); }
  const m = u.pathname.match(/^\/rest\/v1\/rpc\/(dijla_\w+)$/);
  if (m) {
    let body = ''; for await (const c of req) body += c;
    const args = body ? JSON.parse(body) : {};
    const names = Object.keys(args);
    const sql = `select public.${m[1]}(${names.map((n, i) => `${n} => $${i + 1}`).join(', ')}) as r`;
    const vals = names.map(n => args[n] !== null && typeof args[n] === 'object' && !Array.isArray(args[n]) ? JSON.stringify(args[n]) : (Array.isArray(args[n]) && n !== 'p_tokens' ? JSON.stringify(args[n]) : args[n]));
    const client = await pool.connect();
    try {
      await client.query('begin'); await client.query('set local role anon');
      const r = await client.query(sql, vals);
      await client.query('commit');
      const v = r.rows[0].r;
      if (v === null || v === undefined || v === '') { res.writeHead(204, cors); return res.end(); }
      res.writeHead(200, { ...cors, 'Content-Type': 'application/json' }); res.end(JSON.stringify(v));
    } catch (e) {
      await client.query('rollback').catch(() => {});
      res.writeHead(e.code === '28000' ? 403 : 400, { ...cors, 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ code: e.code, message: e.message }));
    } finally { client.release(); }
    return;
  }
  let p = path.join(ROOT, decodeURIComponent(u.pathname));
  if (!p.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
  if (fs.existsSync(p) && fs.statSync(p).isDirectory()) p = path.join(p, 'index.html');
  if (!fs.existsSync(p)) { res.writeHead(404); return res.end('404'); }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(p)] || 'application/octet-stream' });
  fs.createReadStream(p).pipe(res);
}).listen(PORT, () => console.log('on', PORT));
