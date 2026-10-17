/* شاشة الكاشير: الدخول برمز، لوحة الطلبات، طلب جديد من الكاشير، توفر الأصناف، ملخص اليوم، والإيصال. */
(function () {
  var M = window.DIJLA_MENU, D = window.Dijla;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var esc = function (s) { return String(s).replace(/[&<>"']/g, function (c) { return '&#' + c.charCodeAt(0) + ';'; }); };
  var ls = {
    get: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set: function (k, v) { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) {} }
  };
  var SKEY = 'dijla-cashier-session';
  var session = ls.get(SKEY);
  var data = { orders: [], requests: [], items: [] };
  var seenOrders = null, seenReqs = null; // لمعرفة الجديد وإطلاق التنبيه
  var lastOk = 0, timer = null, busy = false;
  var soundOn = ls.get('dijla-sound') !== 'off';

  var tf = new Intl.DateTimeFormat('ar-IQ', { hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Baghdad' });
  var df = new Intl.DateTimeFormat('ar-IQ', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Baghdad' });
  function ago(iso) {
    var m = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 6e4));
    return m < 1 ? 'الآن' : m < 60 ? 'منذ ' + D.fmt(m) + ' د' : tf.format(new Date(iso));
  }
  function where(o) { return o.kind === 'table' ? 'طاولة ' + D.fmt(o.table) : 'سفري'; }

  /* ===== الدخول ===== */
  $('#login-hint').textContent = D.mode === 'local'
    ? 'وضع التجربة على هذا الجهاز: افتح المنيو في نافذة أخرى من المتصفح نفسه، واطلب، وسيظهر الطلب هنا.'
    : 'الرمز عند صاحب المطعم.';
  $('#login-form').onsubmit = function (e) {
    e.preventDefault();
    var pin = $('#pin').value.trim(), btn = this.querySelector('button');
    if (!pin) return;
    btn.disabled = true; $('#login-err').textContent = '';
    unlockAudio();
    D.login(pin).then(function (r) {
      if (r && r.session) { session = r.session; ls.set(SKEY, session); $('#pin').value = ''; start(); }
      else $('#login-err').textContent = r && r.error === 'locked'
        ? 'محاولات خاطئة كثيرة. انتظر عشر دقائق ثم حاول.'
        : 'الرمز غير صحيح.';
    }, function (err) { $('#login-err').textContent = D.errorText(err); })
      .then(function () { btn.disabled = false; });
  };
  function showLogin() {
    clearInterval(timer); session = null; ls.set(SKEY, null);
    $('#app').hidden = true; $('#login').hidden = false; $('#pin').focus();
    document.title = 'دجلة · الكاشير (نموذج عرض)';
  }
  $('#logout').onclick = function () { var s = session; showLogin(); if (s) D.logout(s).catch(function () {}); };

  function start() {
    $('#login').hidden = true; $('#app').hidden = false;
    $('#mode-note').textContent = D.mode === 'local'
      ? 'وضع التجربة على هذا الجهاز: الطلبات تُحفظ في هذا المتصفح فقط وتصل من نوافذه الأخرى.'
      : 'متصل بقاعدة البيانات: الطلبات تصل من هواتف الزبائن مباشرة.';
    $('#mode-note').hidden = D.mode !== 'local';
    seenOrders = seenReqs = null;
    renderPos(); refresh();
    clearInterval(timer);
    timer = setInterval(function () { refresh(); }, 2500);
  }

  /* ===== التحديث الدوري ===== */
  function refresh() {
    if (busy || !session) return;
    busy = true;
    return D.board(session).then(function (b) {
      lastOk = Date.now();
      var fresh = notifyNew(b);
      data = b;
      renderAll(fresh);
    }, function (e) {
      if (e.code === 'session') { showLogin(); $('#login-err').textContent = 'انتهت الجلسة. ادخل من جديد.'; }
    }).then(function () { busy = false; renderConn(); });
  }
  function renderConn() {
    var off = Date.now() - lastOk > 9000, c = $('#conn');
    c.classList.toggle('off', off);
    c.textContent = off ? 'انقطع الاتصال، نحاول من جديد…' : (D.mode === 'local' ? 'تجربة محلية' : 'متصل');
  }
  function notifyNew(b) {
    var fresh = {};
    var ids = b.orders.map(function (o) { return o.id; }), rids = b.requests.map(function (r) { return r.id; });
    if (seenOrders) {
      var newOrders = b.orders.filter(function (o) { return seenOrders.indexOf(o.id) < 0 && o.source === 'customer'; });
      var newReqs = b.requests.filter(function (r) { return seenReqs.indexOf(r.id) < 0; });
      newOrders.forEach(function (o) { fresh[o.id] = true; });
      if (newOrders.length || newReqs.length) {
        chime();
        var msg = newOrders.length ? 'طلب جديد: ' + where(newOrders[0]) : (newReqs[0].kind === 'bill' ? 'طاولة ' + D.fmt(newReqs[0].table) + ' تطلب الحساب' : 'طاولة ' + D.fmt(newReqs[0].table) + ' تنادي النادل');
        toast(msg);
      }
    }
    seenOrders = ids; seenReqs = rids;
    return fresh;
  }

  function renderAll(fresh) {
    renderAlerts(); renderBoard(fresh); renderAvail(); renderSummary(); renderPosAvail();
    var nNew = data.orders.filter(function (o) { return o.status === 'new'; }).length;
    var nActive = data.orders.filter(function (o) { return ['new', 'preparing', 'ready', 'served'].indexOf(o.status) >= 0; }).length;
    $('#active-count').textContent = D.fmt(nActive);
    document.title = (nNew || data.requests.length ? '(' + D.fmt(nNew + data.requests.length) + ') ' : '') + 'دجلة · الكاشير';
  }

  /* ===== النداءات ===== */
  function renderAlerts() {
    $('#alerts').innerHTML = data.requests.map(function (r) {
      return '<div class="alert"><span>طاولة ' + D.fmt(r.table) + ' ' + (r.kind === 'bill' ? 'تطلب الحساب' : 'تنادي النادل') +
        ' <time>' + ago(r.created_at) + '</time></span><button class="btn btn-ok btn-sm" data-req="' + r.id + '" type="button">تم</button></div>';
    }).join('');
  }
  $('#alerts').onclick = function (e) {
    var b = e.target.closest('[data-req]'); if (!b) return;
    b.disabled = true;
    D.requestDone(session, +b.dataset.req).then(refresh, fail);
  };

  /* ===== لوحة الطلبات ===== */
  var COLS = [
    { s: 'new', t: 'جديدة' }, { s: 'preparing', t: 'قيد التحضير' }, { s: 'ready', t: 'جاهزة' }, { s: 'served', t: 'قُدِّمت، بانتظار الدفع' }
  ];
  var PRINT_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9V3h12v6M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><path d="M6 14h12v7H6z"/></svg>';
  function renderBoard(fresh) {
    var focusKey = document.activeElement && document.activeElement.dataset && document.activeElement.dataset.key;
    $('#board').innerHTML = COLS.map(function (c) {
      var list = data.orders.filter(function (o) { return o.status === c.s; });
      return '<section class="col col-' + c.s + '" aria-label="' + c.t + '"><h2>' + c.t + ' <span class="badge">' + D.fmt(list.length) + '</span></h2>' +
        '<div class="tickets">' + (list.length ? list.map(function (o) { return ticket(o, fresh && fresh[o.id]); }).join('') : '<p class="col-empty">لا شيء هنا</p>') + '</div></section>';
    }).join('');
    if (focusKey) { var f = $('[data-key="' + focusKey + '"]'); if (f) f.focus(); }
  }
  function ticket(o, isFresh) {
    var acts = '';
    var b = function (st, txt, cls, pay) {
      return '<button type="button" class="btn btn-sm ' + cls + '" data-o="' + o.id + '" data-st="' + st + '"' + (pay ? ' data-pay="' + pay + '"' : '') +
        ' data-key="' + o.id + st + (pay || '') + '">' + txt + '<span class="sr"> للطلب ' + D.fmt(o.no) + '</span></button>';
    };
    if (o.status === 'new') acts = b('preparing', 'ابدأ التحضير', 'btn-primary') + b('cancelled', 'إلغاء', 'btn-bad');
    else if (o.status === 'preparing') acts = b('ready', 'جاهز', 'btn-ok');
    else if (o.status === 'ready') acts = b('served', o.kind === 'table' ? 'قُدِّم' : 'سُلِّم', 'btn-primary');
    else if (o.status === 'served') acts = b('paid', 'دفع نقدي', 'btn-ok', 'cash') + b('paid', 'دفع بطاقة', 'btn-ghost', 'card');
    return '<article class="ticket' + (isFresh ? ' fresh' : '') + '" style="--c:var(--' + ({ new: 'brass', preparing: 'warn', ready: 'ok', served: 'river-3' })[o.status] + ')">' +
      '<div class="t-head"><b>#' + D.fmt(o.no) + '</b><span class="where">' + where(o) + '</span>' +
      (o.source === 'cashier' ? '<span class="chip chip-river">من الكاشير</span>' : '') +
      '<time datetime="' + o.created_at + '">' + ago(o.created_at) + '</time></div>' +
      '<ul class="t-lines">' + o.lines.map(function (l) {
        return '<li><b>' + D.fmt(l.qty) + '×</b>' + esc(l.name) + (l.note ? '<em>' + esc(l.note) + '</em>' : '') + '</li>';
      }).join('') + '</ul>' +
      (o.note ? '<p class="t-note">' + esc(o.note) + '</p>' : '') +
      '<div class="t-foot"><span class="price">' + D.money(o.total) + '</span>' + acts +
      '<button type="button" class="icon-btn" data-print="' + o.id + '" data-key="p' + o.id + '" aria-label="اطبع إيصال الطلب ' + D.fmt(o.no) + '">' + PRINT_ICON + '</button></div></article>';
  }
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-st]');
    if (b) {
      var st = b.dataset.st;
      var o = data.orders.filter(function (x) { return x.id === +b.dataset.o; })[0];
      if (st === 'cancelled' && !confirm('إلغاء الطلب ' + (o ? D.fmt(o.no) : '') + '؟')) return;
      b.disabled = true;
      D.setStatus(session, +b.dataset.o, st, b.dataset.pay).then(function (r) {
        if (st === 'paid') toast('دُفع الطلب ' + D.fmt(r.no) + ' (' + (r.pay === 'card' ? 'بطاقة' : 'نقداً') + ').');
        return refresh();
      }, fail);
      return;
    }
    var p = e.target.closest('[data-print]');
    if (p) printReceipt(+p.dataset.print);
  });

  /* ===== الإيصال ===== */
  function printReceipt(id) {
    var o = data.orders.filter(function (x) { return x.id === id; })[0]; if (!o) return;
    $('#receipt').innerHTML = '<h1>دجلة</h1><p class="c">مطعم مأكولات عراقية</p><p class="c">نموذج عرض: ليس فاتورة حقيقية</p><hr>' +
      '<p>طلب رقم <b>' + D.fmt(o.no) + '</b> · ' + where(o) + '</p><p>' + df.format(new Date(o.created_at)) + '</p>' +
      '<table><thead><tr><th>الصنف</th><th>الكمية</th><th>المبلغ</th></tr></thead><tbody>' +
      o.lines.map(function (l) { return '<tr><td>' + esc(l.name) + (l.note ? '<br><small>' + esc(l.note) + '</small>' : '') + '</td><td>' + D.fmt(l.qty) + '</td><td>' + D.fmt(l.price * l.qty) + '</td></tr>'; }).join('') +
      '</tbody></table><p class="tot">المجموع: ' + D.money(o.total) + '</p>' +
      (o.status === 'paid' ? '<p>مدفوع ' + (o.pay === 'card' ? 'بالبطاقة' : 'نقداً') + '</p>' : '<p>غير مدفوع بعد</p>') +
      '<hr><p class="c">شكراً لزيارتكم</p>';
    window.print();
  }

  /* ===== طلب جديد من الكاشير ===== */
  var pos = { lines: [], cat: 'all' };
  function renderPos() {
    $('#pos-cats').innerHTML = [{ id: 'all', name: 'الكل' }].concat(M.categories).map(function (c) {
      return '<button type="button" data-cat="' + c.id + '" aria-pressed="' + (pos.cat === c.id) + '">' + esc(c.name) + '</button>';
    }).join('');
    var q = $('#pos-q').value.trim();
    $('#pos-grid').innerHTML = M.items.filter(function (it) {
      return (pos.cat === 'all' || it.cat === pos.cat) && (!q || it.name.indexOf(q) >= 0);
    }).map(function (it) {
      return '<button type="button" data-add="' + it.id + '"><span class="n">' + esc(it.name) + '</span><span class="p">' + D.money(it.price) + '</span></button>';
    }).join('') || '<p class="col-empty">لا يوجد صنف بهذا الاسم.</p>';
    var opts = '<option value="takeaway">سفري</option>';
    for (var i = 1; i <= M.tables; i++) opts += '<option value="t' + i + '">طاولة ' + D.fmt(i) + '</option>';
    var sel = $('#pos-place'), v = sel.value; sel.innerHTML = opts; if (v) sel.value = v;
    renderPosAvail(); renderPosTicket();
  }
  function isAvail(id) { var x = (data.items || []).filter(function (i) { return i.id === id; })[0]; return !x || x.available; }
  function renderPosAvail() {
    document.querySelectorAll('#pos-grid [data-add]').forEach(function (b) {
      var ok = isAvail(b.dataset.add);
      b.disabled = !ok;
      b.setAttribute('aria-label', D.item(b.dataset.add).name + (ok ? '' : '، نفد'));
    });
  }
  function renderPosTicket() {
    var total = 0;
    $('#pos-lines').innerHTML = pos.lines.length ? pos.lines.map(function (l, i) {
      var it = D.item(l.id); total += it.price * l.qty;
      return '<div class="pos-line"><div>' + esc(it.name) + '<br><small>' + D.money(it.price * l.qty) + '</small></div>' +
        '<div class="stepper" role="group" aria-label="كمية ' + esc(it.name) + '"><button type="button" data-pi="' + i + '" data-d="-1" aria-label="أنقص واحداً">−</button><output>' + D.fmt(l.qty) + '</output><button type="button" data-pi="' + i + '" data-d="1" aria-label="أضف واحداً">+</button></div></div>';
    }).join('') : '<p class="col-empty">اضغط على الأصناف لإضافتها.</p>';
    $('#pos-total').textContent = D.money(total);
    $('#pos-send').disabled = $('#pos-clear').disabled = !pos.lines.length;
  }
  $('#pos-cats').onclick = function (e) { var b = e.target.closest('[data-cat]'); if (!b) return; pos.cat = b.dataset.cat; renderPos(); };
  $('#pos-q').oninput = renderPos;
  $('#pos-grid').onclick = function (e) {
    var b = e.target.closest('[data-add]'); if (!b || b.disabled) return;
    var l = pos.lines.filter(function (x) { return x.id === b.dataset.add; })[0];
    if (l) l.qty = Math.min(20, l.qty + 1); else pos.lines.push({ id: b.dataset.add, qty: 1 });
    renderPosTicket();
  };
  $('#pos-lines').onclick = function (e) {
    var b = e.target.closest('[data-pi]'); if (!b) return;
    var i = +b.dataset.pi, l = pos.lines[i], d = +b.dataset.d;
    l.qty = Math.min(20, l.qty + d);
    if (l.qty <= 0) pos.lines.splice(i, 1);
    renderPosTicket();
    var again = $('#pos-lines [data-pi="' + i + '"][data-d="' + d + '"]');
    (again || $('#pos-q')).focus();
  };
  $('#pos-clear').onclick = function () { pos.lines = []; $('#pos-note').value = ''; renderPosTicket(); };
  $('#pos-send').onclick = function () {
    var v = $('#pos-place').value, btn = this;
    btn.disabled = true;
    D.cashierOrder(session, {
      kind: v === 'takeaway' ? 'takeaway' : 'table', table: v === 'takeaway' ? null : +v.slice(1),
      lines: pos.lines.map(function (l) { return { id: l.id, qty: l.qty, note: '' }; }), note: $('#pos-note').value.trim()
    }).then(function (o) {
      pos.lines = []; $('#pos-note').value = ''; renderPosTicket();
      toast('أُرسل الطلب ' + D.fmt(o.no) + ' إلى المطبخ.');
      return refresh();
    }, function (e) { btn.disabled = false; fail(e); });
  };

  /* ===== توفر الأصناف ===== */
  function renderAvail() {
    var box = $('#avail');
    var focusId = document.activeElement && box.contains(document.activeElement) && document.activeElement.dataset.item;
    box.innerHTML = M.categories.map(function (c) {
      return '<div class="panel-card"><h2>' + esc(c.name) + '</h2>' + M.items.filter(function (it) { return it.cat === c.id; }).map(function (it) {
        var on = isAvail(it.id);
        return '<div class="av-row"><span id="av-' + it.id + '">' + esc(it.name) + '</span><span class="av-state">' + (on ? 'متوفر' : 'نفد') + '</span>' +
          '<button type="button" class="switch" role="switch" aria-checked="' + on + '" aria-labelledby="av-' + it.id + '" data-item="' + it.id + '"></button></div>';
      }).join('') + '</div>';
    }).join('');
    if (focusId) { var f = box.querySelector('[data-item="' + focusId + '"]'); if (f) f.focus(); }
  }
  $('#avail').onclick = function (e) {
    var b = e.target.closest('[data-item]'); if (!b) return;
    var on = b.getAttribute('aria-checked') !== 'true';
    b.setAttribute('aria-checked', String(on));
    D.setAvailable(session, b.dataset.item, on).then(function (items) {
      data.items = items; renderAvail(); renderPosAvail();
      toast('«' + D.item(b.dataset.item).name + '» ' + (on ? 'متوفر الآن.' : 'صار «نفد» عند الزبائن.'));
    }, fail);
  };

  /* ===== ملخص اليوم ===== */
  function todayStart() {
    var n = new Date(Date.now() + 3 * 36e5);
    return Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate()) - 3 * 36e5;
  }
  function renderSummary() {
    var t0 = todayStart();
    var today = data.orders.filter(function (o) { return Date.parse(o.created_at) >= t0; });
    var paid = today.filter(function (o) { return o.status === 'paid'; });
    var sum = function (arr) { return arr.reduce(function (s, o) { return s + o.total; }, 0); };
    var cash = sum(paid.filter(function (o) { return o.pay === 'cash'; })), card = sum(paid.filter(function (o) { return o.pay === 'card'; }));
    var open = data.orders.filter(function (o) { return ['new', 'preparing', 'ready', 'served'].indexOf(o.status) >= 0; });
    var stats = [
      ['إيراد اليوم', D.money(sum(paid))],
      ['طلبات مدفوعة', D.fmt(paid.length)],
      ['نقداً', D.money(cash)],
      ['بطاقة', D.money(card)],
      ['متوسط الطلب', paid.length ? D.money(Math.round(sum(paid) / paid.length)) : '—'],
      ['طلبات مفتوحة الآن', D.fmt(open.length)],
      ['قيمة المفتوحة', D.money(sum(open))],
      ['ملغاة', D.fmt(today.filter(function (o) { return o.status === 'cancelled'; }).length)]
    ];
    $('#stats').innerHTML = stats.map(function (s) { return '<div class="stat"><span>' + s[0] + '</span><b>' + s[1] + '</b></div>'; }).join('');
    var count = {};
    today.filter(function (o) { return o.status !== 'cancelled'; }).forEach(function (o) {
      o.lines.forEach(function (l) { count[l.name] = (count[l.name] || 0) + l.qty; });
    });
    var top = Object.keys(count).sort(function (a, b) { return count[b] - count[a]; }).slice(0, 6);
    $('#top-items').innerHTML = top.length ? '<table><thead><tr><th>الصنف</th><th>الكمية</th></tr></thead><tbody>' +
      top.map(function (n) { return '<tr><td>' + esc(n) + '</td><td>' + D.fmt(count[n]) + '</td></tr>'; }).join('') + '</tbody></table>'
      : '<p class="col-empty">لا طلبات اليوم بعد.</p>';
    $('#paid-list').innerHTML = paid.length ? '<table><thead><tr><th>رقم</th><th>المكان</th><th>الوقت</th><th>المبلغ</th><th>الدفع</th><th><span class="sr">إيصال</span></th></tr></thead><tbody>' +
      paid.slice().reverse().map(function (o) {
        return '<tr><td>' + D.fmt(o.no) + '</td><td>' + where(o) + '</td><td>' + tf.format(new Date(o.paid_at || o.updated_at)) + '</td><td class="price">' + D.money(o.total) + '</td><td>' + (o.pay === 'card' ? 'بطاقة' : 'نقداً') + '</td>' +
          '<td><button type="button" class="icon-btn" data-print="' + o.id + '" aria-label="اطبع إيصال الطلب ' + D.fmt(o.no) + '">' + PRINT_ICON + '</button></td></tr>';
      }).join('') + '</tbody></table>' : '<p class="col-empty">لا طلبات مدفوعة اليوم بعد.</p>';
  }

  /* ===== التبويبات ===== */
  var tabs = Array.prototype.slice.call(document.querySelectorAll('[role="tab"]'));
  function selectTab(t, focus) {
    tabs.forEach(function (x) {
      var on = x === t;
      x.setAttribute('aria-selected', String(on)); x.tabIndex = on ? 0 : -1;
      $('#' + x.getAttribute('aria-controls')).hidden = !on;
    });
    if (focus) t.focus();
  }
  tabs.forEach(function (t, i) {
    t.onclick = function () { selectTab(t); };
    t.onkeydown = function (e) {
      var d = e.key === 'ArrowLeft' ? 1 : e.key === 'ArrowRight' ? -1 : 0; // الاتجاه من اليمين لليسار
      if (e.key === 'Home') selectTab(tabs[0], true);
      else if (e.key === 'End') selectTab(tabs[tabs.length - 1], true);
      else if (d) selectTab(tabs[(i + d + tabs.length) % tabs.length], true);
      else return;
      e.preventDefault();
    };
  });

  /* ===== الصوت ===== */
  var ac = null;
  function unlockAudio() {
    try { if (!ac) ac = new (window.AudioContext || window.webkitAudioContext)(); if (ac.state === 'suspended') ac.resume(); } catch (e) { ac = null; }
  }
  function chime() {
    if (!soundOn || !ac) return;
    try {
      var t = ac.currentTime;
      [880, 1318.5].forEach(function (f, i) {
        var o = ac.createOscillator(), g = ac.createGain();
        o.type = 'sine'; o.frequency.value = f;
        g.gain.setValueAtTime(0.0001, t + i * 0.18);
        g.gain.exponentialRampToValueAtTime(0.25, t + i * 0.18 + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.18 + 0.5);
        o.connect(g); g.connect(ac.destination); o.start(t + i * 0.18); o.stop(t + i * 0.18 + 0.55);
      });
    } catch (e) {}
  }
  function renderSound() { $('#sound').setAttribute('aria-pressed', String(soundOn)); $('#sound').textContent = soundOn ? 'التنبيه الصوتي: يعمل' : 'التنبيه الصوتي: متوقف'; }
  $('#sound').onclick = function () { soundOn = !soundOn; ls.set('dijla-sound', soundOn ? 'on' : 'off'); unlockAudio(); renderSound(); if (soundOn) chime(); };
  document.addEventListener('pointerdown', unlockAudio, { once: true });
  document.addEventListener('keydown', unlockAudio, { once: true });

  var tTimer;
  function toast(msg, bad) {
    var t = $('#toast');
    t.textContent = msg; t.classList.toggle('bad', !!bad); t.classList.add('show');
    clearTimeout(tTimer); tTimer = setTimeout(function () { t.classList.remove('show'); }, 3800);
  }
  function fail(e) {
    if (e && e.code === 'session') { showLogin(); return; }
    toast(D.errorText(e), true); refresh();
  }

  renderSound();
  D.onLocalChange(function () { refresh(); });
  setInterval(renderConn, 3000);
  if (session) start(); else showLogin();
})();
