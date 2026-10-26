"""Build royal-palace/qr/index.html (QR cards for the menu + 24 tables).
Needs: pip install segno pillow   (add --png to also write high-res PNGs to qr/png/)
Run:  python3 royal-palace/src/qr.py [--png]
"""
import segno, json, base64, io, os, sys
HERE=os.path.dirname(os.path.abspath(__file__)); ROOT=os.path.dirname(HERE)
BASE='https://qwdfegthikkcom-create.github.io/swalf-menu/royal-palace/'   # change if the menu moves
d=json.load(open(os.path.join(HERE,'images.json'),encoding='utf-8'))
items=[('menu',BASE)]+[('table-%02d'%n,BASE+'?table=%d'%n) for n in range(1,25)]
q={}
for name,url in items:
    m=[[bool(c) for c in row] for row in segno.make(url,error='h',micro=False).matrix]; N=len(m); quiet=4; S=N+quiet*2
    q[name]={'url':url,'n':S,'logo':0.21*N/S,'path':''.join('M%d %dh1v1h-1z'%(x+quiet,y+quiet) for y,row in enumerate(m) for x,v in enumerate(row) if v)}
    if '--png' in sys.argv:
        from PIL import Image, ImageDraw
        px=1200//S; W=px*S; im=Image.new('RGB',(W,W),(250,245,233)); dr=ImageDraw.Draw(im)
        for y,row in enumerate(m):
            for x,v in enumerate(row):
                if v: dr.rectangle(((x+quiet)*px,(y+quiet)*px,(x+quiet+1)*px-1,(y+quiet+1)*px-1),fill=(17,14,9))
        L=int(N*px*0.21); c=W//2; dr.ellipse((c-L//2-px,c-L//2-px,c+L//2+px,c+L//2+px),fill=(250,245,233))
        lg=Image.open(io.BytesIO(base64.b64decode(d['logo'].split(',')[1]))).convert('RGBA').resize((L,L))
        im.paste(lg,(c-L//2,c-L//2),lg); os.makedirs(os.path.join(ROOT,'qr','png'),exist_ok=True); im.save(os.path.join(ROOT,'qr','png',name+'.png'))
def svg(k,cls=''):
    s=q[k]; n=s['n']; L=s['logo']*n
    return ('<div class="qr %s"><svg viewBox="0 0 %d %d" role="img" aria-label="رمز QR" shape-rendering="crispEdges">'
            '<rect width="%d" height="%d" fill="#FAF5E9"/><path fill="#110E09" d="%s"/>'
            '<circle cx="%g" cy="%g" r="%g" fill="#FAF5E9"/></svg><span class="qlogo" style="--s:%.2f%%"></span></div>')%(cls,n,n,n,n,s['path'],n/2,n/2,L/2+1,L/n*100)
cards=''.join('''<article class="card" id="t%d">
  <header class="ch"><span class="cl"></span><div><b>القصر الملكي</b><small>امسح الرمز واطلب من طاولتك</small></div></header>
  %s
  <div class="tn"><small>طاولة</small><b>%d</b></div>
  <ul class="feat"><li>المنيو</li><li>الطلب</li><li>نداء النادل</li><li>الفاتورة</li></ul>
</article>'''%(n,svg('table-%02d'%n),n) for n in range(1,25))
html='''<title>رموز طاولات القصر الملكي</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Reem+Kufi:wght@500;600;700&family=Tajawal:wght@400;500;700;800&display=swap" rel="stylesheet">
<style>
/* Layout: one hero card for the general menu code, then a print grid of 24 table tents (2x3 per A4 page). Deliberately dark-only to match the brand. */
:root{
  color-scheme:dark;
  --bg:#0b0a08;--card:#14110c;--card2:#1c1810;--line:rgba(201,162,75,.22);--line2:rgba(201,162,75,.45);
  --gold:#c9a24b;--gold2:#ecd394;--gold3:#8a6a2a;--txt:#f4ede1;--mut:#a59c8a;--paper:#FAF5E9;
  --f-display:"Reem Kufi","Tajawal",system-ui,sans-serif;--f-body:"Tajawal",system-ui,sans-serif;
}
html,body{background:var(--bg);color:var(--txt)}
body{font-family:var(--f-body);line-height:1.55;-webkit-font-smoothing:antialiased;padding-left:max(16px,env(safe-area-inset-left,0px));padding-right:max(16px,env(safe-area-inset-right,0px));padding-block:20px 40px}
*{box-sizing:border-box}
.wrap{max-width:1080px;margin:0 auto;display:flex;flex-direction:column;gap:28px}
button{font:inherit;color:inherit;border:0;background:none;cursor:pointer}
button:focus-visible,a:focus-visible{outline:2px solid var(--gold2);outline-offset:3px;border-radius:8px}
.qlogo{background:url(%LOGO%) center/cover;}
/* hero */
.hero{display:grid;grid-template-columns:minmax(0,1fr);gap:22px;align-items:center;background:radial-gradient(120%% 90%% at 100%% 0%%,#2a2213 0%%,var(--card) 55%%);border:1px solid var(--line);border-radius:26px;padding:22px}
.hero h1{margin:0;font-family:var(--f-display);font-weight:600;font-size:clamp(26px,5vw,38px);line-height:1.2;text-wrap:balance;background:linear-gradient(180deg,#fff3cf,var(--gold));-webkit-background-clip:text;background-clip:text;color:transparent}
.hero p{margin:8px 0 0;color:var(--mut);max-width:52ch}
.brand{display:flex;align-items:center;gap:12px;margin-bottom:14px}
.brand .cl{width:52px;height:52px}
.brand b{font-family:var(--f-display);color:var(--gold2);font-size:18px;font-weight:600}
.brand small{display:block;color:var(--mut);font-size:12px;letter-spacing:.3px}
.link{display:flex;align-items:center;gap:8px;margin-top:16px;background:var(--bg);border:1px solid var(--line);border-radius:14px;padding:6px 6px 6px 12px;min-width:0}
.link code{flex:1;min-width:0;direction:ltr;text-align:left;font-size:13.5px;color:var(--gold2);overflow-wrap:anywhere;font-family:ui-monospace,Menlo,monospace}
.btn{flex:none;padding:9px 14px;border-radius:11px;font-weight:800;font-size:13.5px;background:linear-gradient(135deg,var(--gold2),var(--gold));color:#1a1408}
.btn.ghost{background:var(--card2);color:var(--txt);border:1px solid var(--line)}
.actions{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px}
.actions a{text-decoration:none}
.hero-qr{justify-self:center;width:min(100%%,300px);background:var(--paper);border-radius:22px;padding:14px;box-shadow:0 0 0 1px var(--line2),0 20px 50px rgba(0,0,0,.5)}
.hero-qr .qr{border-radius:10px}
.hero-qr .cap{text-align:center;color:#3b3020;font-weight:800;font-size:14px;margin-top:6px}
/* section heading */
.sec{display:flex;align-items:baseline;justify-content:space-between;gap:12px;flex-wrap:wrap}
.sec h2{margin:0;font-family:var(--f-display);font-weight:600;color:var(--gold2);font-size:22px}
.sec p{margin:0;color:var(--mut);font-size:13.5px}
.jump{display:flex;flex-wrap:wrap;gap:6px}
.jump a{min-width:38px;text-align:center;padding:6px 8px;border-radius:10px;border:1px solid var(--line);color:var(--txt);text-decoration:none;font-weight:700;font-size:13px;font-variant-numeric:tabular-nums}
.jump a:hover{border-color:var(--gold);color:var(--gold2)}
/* qr */
.qr{position:relative;aspect-ratio:1;max-width:100%%;width:100%%}
.qr svg{display:block;width:100%%;height:100%%}
.qr .qlogo{position:absolute;left:50%%;top:50%%;width:var(--s);height:var(--s);transform:translate(-50%%,-50%%);border-radius:50%%}
/* table cards */
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:16px}
.card{background:linear-gradient(180deg,var(--card2),var(--card));border:1px solid var(--line2);border-radius:22px;padding:16px 16px 14px;display:flex;flex-direction:column;align-items:center;gap:12px;position:relative;break-inside:avoid;scroll-margin-top:16px}
.card:before{content:"";position:absolute;inset:6px;border:1px solid var(--line);border-radius:17px;pointer-events:none}
.ch{display:flex;align-items:center;gap:10px;align-self:stretch}
.cl{flex:none;width:40px;height:40px;border-radius:50%%;background:url(%LOGO%) center/cover;box-shadow:0 0 0 1.5px var(--gold3)}
.ch b{display:block;font-family:var(--f-display);color:var(--gold2);font-size:16px;font-weight:600;line-height:1.2}
.ch small{display:block;color:var(--mut);font-size:11.5px}
.card .qr{background:var(--paper);border-radius:14px;padding:4px;width:100%%}
.tn{display:flex;align-items:baseline;gap:8px;line-height:1}
.tn small{font-size:15px;color:var(--mut);font-weight:700}
.tn b{font-family:var(--f-display);font-size:44px;color:var(--gold2);font-variant-numeric:tabular-nums;font-weight:700}
.feat{list-style:none;margin:0;padding:0;display:flex;flex-wrap:wrap;justify-content:center;gap:4px 10px;font-size:11.5px;color:var(--mut)}
.feat li+li:before{content:"·";margin-inline-end:10px;color:var(--gold3)}
.note{color:var(--mut);font-size:13px;text-align:center}
.embedded .print-only{display:none!important}
@media (min-width:760px){.hero{grid-template-columns:minmax(0,1fr) 300px;padding:30px}}
@media print{
  @page{size:A4;margin:10mm}
  :root{color-scheme:light}
  html,body{background:#fff!important}
  body{padding:0}
  .hero,.sec,.note,.jump{display:none!important}
  .grid{grid-template-columns:repeat(2,1fr);gap:6mm 8mm}
  .card{height:84mm;padding:4mm 5mm;gap:2.5mm;justify-content:center;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  .card .qr{width:48mm}
  .wrap{gap:0}
  .card:nth-child(6n){break-after:page}
  .tn b{font-size:30px}
}
@media (prefers-reduced-motion:no-preference){.card{transition:transform .25s,border-color .25s}.card:hover{transform:translateY(-2px);border-color:var(--gold)}}
</style>
<script>document.documentElement.lang="ar";document.documentElement.dir="rtl";try{if(window.self!==window.top)document.documentElement.classList.add('embedded');}catch(e){document.documentElement.classList.add('embedded');}</script>
<main class="wrap">
  <section class="hero">
    <div>
      <div class="brand"><span class="cl"></span><div><b>مجمع القصر الملكي</b><small>المنيو الرقمي · الموصل</small></div></div>
      <h1>رموز QR للمنيو والطاولات</h1>
      <p>الرمز العام يفتح المنيو ويطلب من الزبون يختار طاولته. رموز الطاولات تحت تفتح المنيو على رقم الطاولة مباشرة، فيوصل الطلب ونداء النادل وطلب الفاتورة للطاولة الصحيحة.</p>
      <div class="link"><code id="mainUrl">https://qwdfegthikkcom-create.github.io/swalf-menu/royal-palace/</code><button class="btn" id="copy" type="button">نسخ الرابط</button></div>
      <div class="actions">
        <a class="btn ghost" href="https://qwdfegthikkcom-create.github.io/swalf-menu/royal-palace/" target="_blank" rel="noopener">فتح المنيو</a>
        <button class="btn ghost print-only" type="button" onclick="window.print()">طباعة بطاقات الطاولات</button>
      </div>
    </div>
    <div class="hero-qr">%MAIN%<div class="cap">امسح لفتح المنيو</div></div>
  </section>
  <div class="sec">
    <div><h2>بطاقات الطاولات</h2><p>24 بطاقة · الصالة الرئيسية 1–15 · التراس 16–24</p></div>
    <nav class="jump" aria-label="انتقال لطاولة">%JUMP%</nav>
  </div>
  <section class="grid">%CARDS%</section>
  <p class="note">كل الرموز مجرّبة وتنقرأ بالكاميرا. للطباعة: 6 بطاقات بكل ورقة A4.</p>
</main>
<script>
document.getElementById('copy').addEventListener('click',function(){
  var b=this,t=document.getElementById('mainUrl').textContent;
  var done=function(){b.textContent='تم النسخ ✓';setTimeout(function(){b.textContent='نسخ الرابط';},1800);};
  try{navigator.clipboard.writeText(t).then(done,function(){sel();});}catch(e){sel();}
  function sel(){var r=document.createRange();r.selectNodeContents(document.getElementById('mainUrl'));var s=getSelection();s.removeAllRanges();s.addRange(r);b.textContent='انسخ النص المحدد';}
});
</script>
'''
html=html.replace('%%','%').replace('%LOGO%',d['logo']).replace('%MAIN%',svg('menu')).replace('%CARDS%',cards)
html=html.replace('%JUMP%',''.join('<a href="#t%d">%d</a>'%(n,n) for n in range(1,25)))
assert html.count(d['logo'])==2
full='<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><style>body{margin:0}img{max-width:100%}</style></head><body>'+html+'</body></html>'
os.makedirs(os.path.join(ROOT,'qr'),exist_ok=True)
open(os.path.join(ROOT,'qr','index.html'),'w',encoding='utf-8').write(full)
print('built qr/index.html',len(full)//1024,'KB')
