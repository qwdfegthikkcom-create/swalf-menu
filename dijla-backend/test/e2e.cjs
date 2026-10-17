const { chromium } = require(process.env.PLAYWRIGHT || 'playwright');
const BASE = 'http://localhost:8090/dijla-menu/';
const OUT = process.argv[2];
const MODE = process.argv[3] || 'cloud';
const cfg = MODE === 'cloud' ? `window.DIJLA_CONFIG={mode:'cloud',url:'http://localhost:8090',key:'test'}` : '';
let fails = 0;
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
(async () => {
  const b = await chromium.launch();
  const errs = [];
  const mk = async (vp) => {
    const ctx = await b.newContext({ viewport: vp, locale: 'ar-IQ' });
    if (cfg) await ctx.addInitScript(cfg);
    return ctx;
  };
  const phoneCtx = await mk({ width: 360, height: 740 });
  const cashCtx = MODE === 'cloud' ? await mk({ width: 1280, height: 800 }) : phoneCtx;
  const phone = await phoneCtx.newPage();
  const cash = await cashCtx.newPage();
  if (MODE !== 'cloud') await cash.setViewportSize({ width: 1280, height: 800 });
  for (const [n, p] of [['phone', phone], ['cash', cash]]) {
    p.on('pageerror', e => errs.push(n + ': ' + e.message));
    p.on('console', m => { if (m.type() === 'error') errs.push(n + ' console: ' + m.text()); });
  }
  await phone.goto(BASE + '?t=5');
  await phone.waitForTimeout(600);
  ok(await phone.locator('#table-btn').innerText().then(t => t.includes('طاولة ٥')), 'table from QR');
  const hs = await phone.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  ok(hs <= 0, 'phone no horizontal scroll (' + hs + ')');
  await phone.screenshot({ path: OUT + '/c-menu-' + MODE + '.png' });
  await phone.click('.item[data-id="masgouf"] [data-do="add"]');
  await phone.click('.item[data-id="masgouf"] [data-do="inc"]');
  await phone.click('.item[data-id="chai"] [data-do="add"]');
  ok(await phone.locator('#cart-total').innerText().then(t => t.includes('٥٠٬٥٠٠')), 'cart total 50,500');
  await phone.click('#open-cart');
  await phone.click('#cart-lines .line[data-i="1"] [data-do="note"]');
  await phone.fill('#ln1', 'بلا شكر');
  await phone.fill('#order-note', 'بسرعة رجاءً');
  await phone.screenshot({ path: OUT + '/c-cart-' + MODE + '.png' });
  await phone.click('#send');
  await phone.waitForSelector('#mine:not([hidden]) .track');
  const trackTxt = await phone.locator('.track').first().innerText();
  ok(trackTxt.includes('طلب رقم ١'), 'order tracking shown: ' + trackTxt.split('\n')[0]);
  ok(await phone.locator('#cartbar').isHidden(), 'cart cleared');

  // الكاشير (جهاز آخر في وضع السحابة)
  await cash.goto(BASE + 'cashier.html');
  await cash.fill('#pin', '1111'); await cash.click('#login-form button');
  await cash.waitForTimeout(400);
  ok((await cash.locator('#login-err').innerText()).includes('غير صحيح'), 'wrong pin rejected');
  await cash.fill('#pin', '2468'); await cash.click('#login-form button');
  await cash.waitForSelector('.col-new .ticket');
  const tk = await cash.locator('.col-new .ticket').first().innerText();
  ok(tk.includes('طاولة ٥') && tk.includes('بلا شكر') && tk.includes('بسرعة'), 'cashier sees order with notes');
  await cash.screenshot({ path: OUT + '/k-board-' + MODE + '.png' });
  await cash.click('.col-new [data-st="preparing"]');
  await phone.waitForFunction(() => document.querySelector('.track .chip').textContent.includes('قيد التحضير'), null, { timeout: 8000 }).then(() => ok(true, 'customer sees preparing'), () => ok(false, 'customer sees preparing'));

  // نداء الحساب
  await phone.click('[data-req="bill"]');
  await cash.waitForSelector('.alert', { timeout: 6000 }).then(() => ok(true, 'bill request reached cashier'), () => ok(false, 'bill request reached cashier'));
  await cash.click('.alert [data-req]');
  await cash.waitForFunction(() => !document.querySelector('.alert'), null, { timeout: 6000 }).then(() => ok(true, 'request done'), () => ok(false, 'request done'));

  // نفد صنف
  await cash.click('#tab-items');
  await cash.click('[data-item="kebab"]');
  await cash.waitForTimeout(300);
  ok(await cash.locator('[data-item="kebab"]').getAttribute('aria-checked') === 'false', 'kebab marked soldout');
  await phone.reload(); await phone.waitForTimeout(800);
  ok(await phone.locator('.item[data-id="kebab"]').getAttribute('class').then(c => c.includes('soldout')), 'customer sees kebab soldout');
  // سلة قديمة فيها صنف نفد
  await phone.evaluate(() => { localStorage.setItem('dijla-cart', JSON.stringify([{ id: 'kebab', qty: 1, note: '' }])); });
  await phone.reload(); await phone.waitForTimeout(800);
  await phone.click('#open-cart'); await phone.click('#send');
  await phone.waitForTimeout(400);
  ok((await phone.locator('#toast').innerText()).includes('نفد'), 'soldout item blocked: ' + await phone.locator('#toast').innerText());
  await phone.evaluate(() => localStorage.removeItem('dijla-cart')); await phone.reload();
  await cash.click('[data-item="kebab"]');

  // طلب من الكاشير
  await cash.click('#tab-pos');
  await cash.click('#pos-grid [data-add="kebab"]'); await cash.click('#pos-grid [data-add="kebab"]');
  await cash.selectOption('#pos-place', 'takeaway');
  await cash.screenshot({ path: OUT + '/k-pos-' + MODE + '.png' });
  await cash.click('#pos-send');
  await cash.click('#tab-orders');
  await cash.waitForTimeout(500);
  ok((await cash.locator('.col-new').innerText()).includes('سفري'), 'POS takeaway order on board');

  // تقدم ودفع
  await cash.click('.col-preparing [data-st="ready"]'); await cash.waitForTimeout(400);
  await cash.click('.col-ready [data-st="served"]'); await cash.waitForTimeout(400);
  await cash.click('.col-served [data-pay="cash"]'); await cash.waitForTimeout(500);
  await phone.waitForFunction(() => document.querySelector('.track .chip').textContent.includes('مدفوع'), null, { timeout: 8000 }).then(() => ok(true, 'customer sees paid'), () => ok(false, 'customer sees paid'));
  await cash.click('#tab-summary'); await cash.waitForTimeout(300);
  const st = await cash.locator('#stats').innerText();
  ok(st.includes('٥٠٬٥٠٠'), 'summary revenue 50,500');
  await cash.screenshot({ path: OUT + '/k-summary-' + MODE + '.png' });
  await phone.screenshot({ path: OUT + '/c-tracking-' + MODE + '.png', fullPage: false });
  const hs2 = await cash.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  ok(hs2 <= 0, 'cashier no horizontal scroll');
  await cash.setViewportSize({ width: 360, height: 740 }); await cash.click('#tab-orders'); await cash.waitForTimeout(300);
  const hs3 = await cash.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  ok(hs3 <= 0, 'cashier phone no horizontal scroll (' + hs3 + ')');
  await cash.screenshot({ path: OUT + '/k-phone-' + MODE + '.png' });
  ok(!errs.length, 'no JS errors ' + errs.join(' | '));
  await b.close();
  console.log(fails ? fails + ' FAILED' : 'ALL PASS');
  process.exit(fails ? 1 : 0);
})();
