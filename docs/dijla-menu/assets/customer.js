/* صفحة الزبون: المنيو، والسلة، وإرسال الطلب، ومتابعته، ونداء النادل. */
(function () {
  var M = window.DIJLA_MENU, D = window.Dijla;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var esc = function (s) { return String(s).replace(/[&<>"']/g, function (c) { return '&#' + c.charCodeAt(0) + ';'; }); };
  var store = {
    get: function (k, d) { try { var v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (e) { return d; } },
    set: function (k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  };

  var avail = {};           // id → متوفر؟
  var cart = store.get('dijla-cart', []);
  var place = readPlace();  // {kind:'table', table:5} أو {kind:'takeaway'} أو null
  var mine = store.get('dijla-mine', []).filter(function (m) { return Date.now() - m.at < 864e5; });
  var last = {};            // آخر حالة معروفة لكل طلب، لتنبيه الزبون حين تتغير

  /* ===== مكان الزبون (الطاولة) ===== */
  function readPlace() {
    var t = parseInt(new URLSearchParams(location.search).get('t'), 10);
    if (t >= 1 && t <= M.tables) {
      var p = { kind: 'table', table: t, at: Date.now() };
      store.set('dijla-place', p);
      return p;
    }
    var saved = store.get('dijla-place', null);
    return saved && Date.now() - saved.at < 4 * 36e5 ? saved : null;
  }
  function setPlace(p) {
    place = p ? { kind: p.kind, table: p.table || null, at: Date.now() } : null;
    store.set('dijla-place', place);
    renderPlace();
  }
  function placeText(p) {
    if (!p) return 'اختر طاولتك';
    return p.kind === 'table' ? 'طاولة ' + D.fmt(p.table) : 'طلب سفري';
  }
  function renderPlace() {
    $('#table-btn').innerHTML = esc(placeText(place)) + ' <span>' + (place ? 'تغيير' : '') + '</span>';
    $('#table-btn').setAttribute('aria-label', place ? placeText(place) + '، تغيير المكان' : 'اختر رقم طاولتك');
    $('#service').hidden = !(place && place.kind === 'table');
    var sel = $('#place');
    var opts = '<option value="">اختر…</option>';
    for (var i = 1; i <= M.tables; i++) opts += '<option value="t' + i + '">طاولة ' + D.fmt(i) + '</option>';
    opts += '<option value="takeaway">سفري</option>';
    sel.innerHTML = opts;
    sel.value = place ? (place.kind === 'table' ? 't' + place.table : 'takeaway') : '';
  }
  function openTables() {
    var box = $('#tables'), html = '';
    for (var i = 1; i <= M.tables; i++) {
      var on = place && place.kind === 'table' && place.table === i;
      html += '<button type="button" data-t="' + i + '" aria-pressed="' + on + '">' + D.fmt(i) + '</button>';
    }
    box.innerHTML = html;
    $('#pick-takeaway').setAttribute('aria-pressed', String(!!(place && place.kind === 'takeaway')));
    $('#table-dlg').showModal();
  }
  $('#table-btn').onclick = openTables;
  $('#tables').onclick = function (e) {
    var b = e.target.closest('button[data-t]'); if (!b) return;
    setPlace({ kind: 'table', table: +b.dataset.t });
    $('#table-dlg').close();
    toast('اخترت ' + placeText(place) + '.');
  };
  $('#pick-takeaway').onclick = function () {
    setPlace({ kind: 'takeaway' });
    $('#table-dlg').close();
    toast('طلبك سفري: تستلمه من الكاشير.');
  };
  $('#place').onchange = function () {
    var v = this.value;
    if (!v) return setPlace(null);
    setPlace(v === 'takeaway' ? { kind: 'takeaway' } : { kind: 'table', table: +v.slice(1) });
  };

  /* ===== المنيو ===== */
  function renderMenu() {
    var html = '';
    M.categories.forEach(function (c) {
      var items = M.items.filter(function (it) { return it.cat === c.id; });
      html += '<section class="cat" id="c-' + c.id + '" aria-labelledby="h-' + c.id + '">' +
        '<div class="cat-head"><h2 id="h-' + c.id + '">' + esc(c.name) + '</h2></div>' +
        (c.note ? '<p class="cat-note">' + esc(c.note) + '</p>' : '') +
        '<div class="items">' + items.map(itemHtml).join('') + '</div></section>';
    });
    html += '<p class="empty" id="no-results" hidden>لا يوجد صنف بهذا الاسم.</p>';
    $('#menu').innerHTML = html;
    $('#cat-list').innerHTML = M.categories.map(function (c) {
      return '<a href="#c-' + c.id + '">' + esc(c.name) + '</a>';
    }).join('');
    renderCartMarks();
  }
  function itemHtml(it) {
    return '<article class="item" data-id="' + it.id + '" aria-labelledby="n-' + it.id + '">' +
      '<div><h3 id="n-' + it.id + '">' + esc(it.name) + (it.tag ? ' <span class="chip">' + esc(it.tag) + '</span>' : '') + '<span class="chip chip-bad sold-chip" hidden>نفد اليوم</span></h3>' +
      (it.desc ? '<p class="desc">' + esc(it.desc) + '</p>' : '') +
      '<p class="price">' + D.money(it.price) + (it.unit ? ' <small>/ ' + esc(it.unit) + '</small>' : '') + '</p></div>' +
      '<div class="act"></div></article>';
  }
  function qtyOf(id) { var l = cart.filter(function (x) { return x.id === id; })[0]; return l ? l.qty : 0; }
  function renderCartMarks() {
    document.querySelectorAll('.item').forEach(function (el) {
      var id = el.dataset.id, it = D.item(id), q = qtyOf(id), sold = avail[id] === false;
      el.classList.toggle('in-cart', q > 0);
      el.classList.toggle('soldout', sold);
      el.querySelector('.sold-chip').hidden = !sold;
      var act = el.querySelector('.act'), want = sold ? 'sold' : q ? 'q' + q : 'add';
      if (act.dataset.state === want) return;
      var hadFocus = act.contains(document.activeElement), focusSel = hadFocus && document.activeElement.dataset.do;
      act.dataset.state = want;
      if (sold) act.innerHTML = '';
      else if (!q) act.innerHTML = '<button class="btn btn-primary btn-sm add" type="button" data-do="add">أضف<span class="sr"> ' + esc(it.name) + '</span></button>';
      else act.innerHTML = '<div class="stepper" role="group" aria-label="كمية ' + esc(it.name) + '">' +
        '<button type="button" data-do="dec" aria-label="أنقص واحداً">−</button><output aria-live="polite">' + D.fmt(q) + '</output>' +
        '<button type="button" data-do="inc" aria-label="أضف واحداً">+</button></div>';
      if (hadFocus) {
        var f = act.querySelector('[data-do="' + focusSel + '"]') || act.querySelector('[data-do="inc"]') || act.querySelector('[data-do]');
        if (f) f.focus(); else $('#h-' + it.cat).parentNode.parentNode.focus();
      }
    });
  }
  $('#menu').onclick = function (e) {
    var b = e.target.closest('button[data-do]'); if (!b) return;
    var id = b.closest('.item').dataset.id;
    changeQty(id, b.dataset.do === 'dec' ? -1 : 1);
  };
  function changeQty(id, d) {
    var l = cart.filter(function (x) { return x.id === id; })[0];
    if (!l) { if (d < 0) return; l = { id: id, qty: 0, note: '' }; cart.push(l); }
    l.qty = Math.min(20, l.qty + d);
    if (l.qty <= 0) cart = cart.filter(function (x) { return x !== l; });
    saveCart();
  }
  function saveCart() {
    store.set('dijla-cart', cart);
    renderCartMarks();
    renderCartBar();
    if ($('#cart').open) renderCartLines();
  }
  function cartTotal() { return cart.reduce(function (s, l) { var it = D.item(l.id); return s + (it ? it.price * l.qty : 0); }, 0); }
  function cartCount() { return cart.reduce(function (s, l) { return s + l.qty; }, 0); }
  function renderCartBar() {
    cart = cart.filter(function (l) { return D.item(l.id); });
    $('#cartbar').hidden = !cart.length;
    $('#cart-count').textContent = D.fmt(cartCount());
    $('#cart-total').textContent = D.money(cartTotal());
    $('#open-cart').setAttribute('aria-label', 'عرض الطلب: ' + D.fmt(cartCount()) + ' صنف، المجموع ' + D.money(cartTotal()));
  }

  /* ===== البحث وأقسام المنيو ===== */
  $('#search-btn').onclick = function () {
    var box = $('#search'), open = box.hidden;
    box.hidden = !open;
    this.setAttribute('aria-expanded', String(open));
    if (open) $('#q').focus(); else { $('#q').value = ''; filter(''); }
  };
  var norm = function (s) { return s.replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي').replace(/گ/g, 'ك').toLowerCase(); };
  function filter(q) {
    q = norm(q.trim());
    var any = false;
    document.querySelectorAll('.cat').forEach(function (sec) {
      var shown = 0;
      sec.querySelectorAll('.item').forEach(function (el) {
        var it = D.item(el.dataset.id);
        var ok = !q || norm(it.name + ' ' + (it.desc || '')).indexOf(q) >= 0;
        el.hidden = !ok; if (ok) shown++;
      });
      sec.hidden = !shown; if (shown) any = true;
    });
    $('#no-results').hidden = any;
  }
  $('#q').oninput = function () { filter(this.value); };

  function spy() {
    if (!('IntersectionObserver' in window)) return;
    var links = {};
    document.querySelectorAll('#cat-list a').forEach(function (a) { links[a.getAttribute('href').slice(1)] = a; });
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        Object.keys(links).forEach(function (k) { links[k].removeAttribute('aria-current'); });
        var a = links[en.target.id]; if (!a) return;
        a.setAttribute('aria-current', 'true');
        var list = $('#cat-list');
        list.scrollTo({ left: a.offsetLeft - list.clientWidth / 2 + a.clientWidth / 2, behavior: 'smooth' });
      });
    }, { rootMargin: '-35% 0px -60% 0px' });
    document.querySelectorAll('.cat').forEach(function (s) { io.observe(s); });
  }

  /* ===== السلة ===== */
  $('#open-cart').onclick = function () { renderCartLines(); renderPlace(); $('#cart').showModal(); };
  function renderCartLines() {
    if (!cart.length) { $('#cart').close(); return; }
    $('#cart-lines').innerHTML = cart.map(function (l, i) {
      var it = D.item(l.id), sold = avail[l.id] === false;
      return '<div class="line' + (sold ? ' bad' : '') + '" data-i="' + i + '">' +
        '<div><div class="line-name">' + esc(it.name) + '</div><div class="line-sub">' + D.money(it.price) + ' × ' + D.fmt(l.qty) + ' = ' + D.money(it.price * l.qty) +
        (sold ? ' · <b>نفد الآن</b>' : '') + '</div></div>' +
        '<div class="stepper" role="group" aria-label="كمية ' + esc(it.name) + '"><button type="button" data-do="dec" aria-label="أنقص واحداً">−</button><output>' + D.fmt(l.qty) + '</output><button type="button" data-do="inc" aria-label="أضف واحداً">+</button></div>' +
        '<div class="line-note">' + (l.note || l.noteOpen
          ? '<label class="sr" for="ln' + i + '">ملاحظة على ' + esc(it.name) + '</label><input id="ln' + i + '" maxlength="120" value="' + esc(l.note) + '" placeholder="مثلاً: بلا بصل">'
          : '<button type="button" class="link-btn" data-do="note">أضف ملاحظة</button>') + '</div></div>';
    }).join('');
    $('#sheet-total').textContent = D.money(cartTotal());
  }
  $('#cart-lines').onclick = function (e) {
    var b = e.target.closest('button[data-do]'); if (!b) return;
    var i = +b.closest('.line').dataset.i, l = cart[i];
    if (b.dataset.do === 'note') { l.noteOpen = true; renderCartLines(); $('#ln' + i).focus(); return; }
    var focusDo = b.dataset.do;
    changeQty(l.id, focusDo === 'dec' ? -1 : 1);
    var row = $('#cart-lines .line[data-i="' + i + '"]');
    var again = row && row.querySelector('[data-do="' + focusDo + '"]');
    if (again) again.focus(); else if ($('#cart').open) $('#send').focus();
  };
  $('#cart-lines').oninput = function (e) {
    if (e.target.tagName !== 'INPUT') return;
    var l = cart[+e.target.closest('.line').dataset.i]; l.note = e.target.value; store.set('dijla-cart', cart);
  };

  $('#send').onclick = function () {
    var btn = this;
    if (!place) { $('#place').focus(); toast('اختر مكان الطلب أولاً: رقم الطاولة أو سفري.', true); return; }
    var sold = cart.filter(function (l) { return avail[l.id] === false; });
    if (sold.length) { toast(D.errorText({ code: 'unavailable:' + sold[0].id }), true); return; }
    btn.disabled = true; btn.textContent = 'جارٍ الإرسال…';
    D.placeOrder({
      kind: place.kind, table: place.table,
      lines: cart.map(function (l) { return { id: l.id, qty: l.qty, note: (l.note || '').trim() }; }),
      note: $('#order-note').value.trim()
    }).then(function (o) {
      mine.push({ token: o.token, at: Date.now() });
      mine = mine.slice(-10);
      store.set('dijla-mine', mine);
      last[o.token] = o.status;
      cart = []; saveCart(); $('#order-note').value = '';
      $('#cart').close();
      renderMine([o]);
      toast('وصل طلبك إلى الكاشير. رقمه ' + D.fmt(o.no) + '.');
      $('#mine').scrollIntoView({ behavior: 'smooth', block: 'start' });
      poll();
    }, function (e) {
      toast(D.errorText(e), true);
      if (e.code && e.code.indexOf('unavailable:') === 0) { avail[e.code.slice(12)] = false; renderCartMarks(); renderCartLines(); }
      refreshMenu();
    }).then(function () { btn.disabled = false; btn.textContent = 'أرسل الطلب إلى الكاشير'; });
  };

  /* ===== طلباتي ===== */
  var STEPS = ['new', 'preparing', 'ready', 'served'];
  var STEP_TXT = ['استُلم', 'قيد التحضير', 'جاهز', 'قُدِّم'];
  var MSG = {
    new: 'وصل طلبك، وسيبدأ تحضيره بعد قليل.',
    preparing: 'المطبخ يحضّر طلبك الآن.',
    ready: 'طلبك جاهز.',
    served: 'بالعافية! حين تنتهي اطلب الحساب أو ادفع عند الكاشير.',
    paid: 'تم الدفع. شكراً لزيارتك!',
    cancelled: 'أُلغي هذا الطلب. راجع الكاشير إن كان عندك سؤال.'
  };
  var cache = {};
  function renderMine(fresh) {
    (fresh || []).forEach(function (o) { cache[o.token] = o; });
    var list = mine.map(function (m) { return cache[m.token]; }).filter(Boolean).reverse();
    $('#mine').hidden = !list.length;
    $('#mine-list').innerHTML = list.map(function (o) {
      var idx = STEPS.indexOf(o.status), done = o.status === 'paid';
      var steps = o.status === 'cancelled' ? '' : '<ol class="steps">' + STEPS.map(function (s, i) {
        var on = done || i <= idx;
        return '<li class="' + (on ? 'on' : '') + (i === idx && !done ? ' now' : '') + '"' + (i === idx ? ' aria-current="step"' : '') + '>' + STEP_TXT[i] + '</li>';
      }).join('') + '</ol>';
      var chip = o.status === 'paid' ? 'chip-ok' : o.status === 'cancelled' ? 'chip-bad' : o.status === 'ready' ? 'chip-warn' : 'chip-river';
      return '<article class="track"><div class="track-top"><b>طلب رقم ' + D.fmt(o.no) + '</b>' +
        '<span class="chip ' + chip + '">' + D.STATUS[o.status] + '</span></div>' + steps +
        '<p class="track-msg">' + MSG[o.status] + '</p>' +
        '<p class="track-lines">' + (o.kind === 'table' ? 'طاولة ' + D.fmt(o.table) : 'سفري') + ' · ' +
        o.lines.map(function (l) { return esc(l.name) + ' × ' + D.fmt(l.qty); }).join('، ') + ' · ' + D.money(o.total) + '</p></article>';
    }).join('');
  }
  function poll() {
    var tokens = mine.map(function (m) { return m.token; });
    if (!tokens.length) return;
    D.orderStatus(tokens).then(function (orders) {
      orders.forEach(function (o) {
        if (last[o.token] && last[o.token] !== o.status && (o.status === 'preparing' || o.status === 'ready')) {
          toast('طلب رقم ' + D.fmt(o.no) + ': ' + D.STATUS[o.status] + '.');
          var ua = navigator.userActivation;
          if (navigator.vibrate && (!ua || ua.hasBeenActive)) try { navigator.vibrate(120); } catch (e) {}
        }
        last[o.token] = o.status;
      });
      var known = orders.map(function (o) { return o.token; });
      mine = mine.filter(function (m) { return known.indexOf(m.token) >= 0; });
      store.set('dijla-mine', mine);
      renderMine(orders);
    }, function () {});
  }
  function active() {
    return mine.some(function (m) { var o = cache[m.token]; return !o || ['paid', 'cancelled'].indexOf(o.status) < 0; });
  }

  /* ===== نداء النادل وطلب الحساب ===== */
  $('#service').onclick = function (e) {
    var b = e.target.closest('button[data-req]'); if (!b || b.disabled) return;
    if (!place || place.kind !== 'table') { openTables(); return; }
    var kind = b.dataset.req, label = b.textContent;
    b.disabled = true;
    D.request(place.table, kind).then(function () {
      b.classList.add('done'); b.textContent = kind === 'bill' ? 'طلبت الحساب ✓' : 'وصل النداء ✓';
      toast(kind === 'bill' ? 'وصل طلب الحساب إلى الكاشير.' : 'وصل نداؤك. سيأتيك النادل بعد قليل.');
      setTimeout(function () { b.classList.remove('done'); b.textContent = label; b.disabled = false; }, 60000);
    }, function (err) { b.disabled = false; toast(D.errorText(err), true); });
  };

  /* ===== التوفر ===== */
  function refreshMenu() {
    return D.menu().then(function (list) {
      list.forEach(function (x) { avail[x.id] = x.available; });
      renderCartMarks();
      if ($('#cart').open) renderCartLines();
    }, function () {});
  }

  var tTimer;
  function toast(msg, bad) {
    var t = $('#toast');
    t.textContent = msg; t.classList.toggle('bad', !!bad); t.classList.add('show');
    clearTimeout(tTimer); tTimer = setTimeout(function () { t.classList.remove('show'); }, 3800);
  }

  renderMenu(); renderPlace(); renderCartBar(); spy();
  refreshMenu(); poll();
  setInterval(function () { if (!document.hidden && active()) poll(); }, 4000);
  setInterval(function () { if (!document.hidden) refreshMenu(); }, 30000);
  document.addEventListener('visibilitychange', function () { if (!document.hidden) { poll(); refreshMenu(); } });
  D.onLocalChange(function () { poll(); refreshMenu(); });
})();
