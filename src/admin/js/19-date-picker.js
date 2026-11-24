// 日付の入力：ブラウザ標準のカレンダーの代わりに、画面になじむ小さなカレンダーを出す
(function () {
  var pop = null, cur = null, view = null, focusDay = null;
  var WD = ['日', '月', '火', '水', '木', '金', '土'];
  var pad = function (n) { return (n < 10 ? '0' : '') + n; };
  var iso = function (d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); };
  var parse = function (v) { var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v || ''); return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null; };
  var isDate = function (el) { return el && el.tagName === 'INPUT' && el.type === 'date' && !el.disabled && !el.readOnly; };

  function close(back) {
    if (!pop) return; pop.remove(); pop = null;
    if (back && cur && document.contains(cur)) cur.focus();
    cur = null;
  }
  function pick(d) {
    var el = cur; if (!el) return;
    el.value = d ? iso(d) : '';
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    close(true);
  }
  function draw() {
    var y = view.getFullYear(), m = view.getMonth(), first = new Date(y, m, 1), start = new Date(y, m, 1 - first.getDay());
    var sel = parse(cur.value), today = new Date(); today.setHours(0, 0, 0, 0);
    var min = parse(cur.min), max = parse(cur.max), h = '';
    for (var i = 0; i < 42; i++) {
      var d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i), t = iso(d);
      var off = (min && d < min) || (max && d > max);
      h += '<button type="button" class="dpkd' + (d.getMonth() !== m ? ' out' : '') + (sel && t === iso(sel) ? ' on' : '') + (t === iso(today) ? ' now' : '') + (d.getDay() === 0 ? ' sun' : d.getDay() === 6 ? ' sat' : '') + '" data-dpd="' + t + '"' + (off ? ' disabled' : '') + ' tabindex="' + (focusDay && t === iso(focusDay) ? '0' : '-1') + '">' + d.getDate() + '</button>';
    }
    pop.innerHTML = '<div class="dpkh"><button type="button" class="dpkn" data-dpm="-1" aria-label="前の月"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 6l-6 6 6 6"/></svg></button><b>' + y + '年' + (m + 1) + '月</b><button type="button" class="dpkn" data-dpm="1" aria-label="次の月"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg></button></div>' +
      '<div class="dpkw">' + WD.map(function (w, k) { return '<span' + (k === 0 ? ' class="sun"' : k === 6 ? ' class="sat"' : '') + '>' + w + '</span>'; }).join('') + '</div>' +
      '<div class="dpkg">' + h + '</div>' +
      '<div class="dpkf"><button type="button" data-dpt="today">今日</button>' + (cur.required ? '' : '<button type="button" data-dpt="clear">消す</button>') + '</div>';
  }
  function place() {
    var r = cur.getBoundingClientRect(), w = pop.offsetWidth, h = pop.offsetHeight;
    var left = Math.max(8, Math.min(window.innerWidth - w - 8, r.left));
    var top = window.innerHeight - r.bottom - 8 >= h ? r.bottom + 6 : Math.max(8, r.top - h - 6);
    pop.style.left = left + 'px'; pop.style.top = top + 'px';
  }
  function open(el) {
    if (pop && cur === el) return;
    close(); cur = el; var v = parse(el.value) || new Date(); focusDay = parse(el.value);
    view = new Date(v.getFullYear(), v.getMonth(), 1);
    pop = document.createElement('div'); pop.className = 'dpk'; pop.setAttribute('role', 'dialog'); pop.setAttribute('aria-label', '日付を選ぶ');
    document.body.appendChild(pop); draw(); place();
  }
  function moveFocus(days) {
    var base = focusDay || parse(cur.value) || new Date(view.getFullYear(), view.getMonth(), 1);
    focusDay = new Date(base.getFullYear(), base.getMonth(), base.getDate() + days);
    if (focusDay.getMonth() !== view.getMonth() || focusDay.getFullYear() !== view.getFullYear()) view = new Date(focusDay.getFullYear(), focusDay.getMonth(), 1);
    draw(); var b = pop.querySelector('[data-dpd="' + iso(focusDay) + '"]'); if (b) b.focus();
  }

  // スマホでは標準のカレンダー（下から出る回転式）を出さない
  document.addEventListener('pointerdown', function (e) {
    var el = e.target; if (pop && !pop.contains(el) && el !== cur) close();
    if (isDate(el) && e.pointerType !== 'mouse') e.preventDefault();
  }, true);
  document.addEventListener('click', function (e) {
    if (pop && pop.contains(e.target)) {
      var b = e.target.closest('button'); if (!b) return; e.preventDefault(); e.stopPropagation();
      if (b.dataset.dpm) { view = new Date(view.getFullYear(), view.getMonth() + +b.dataset.dpm, 1); draw(); }
      else if (b.dataset.dpd) pick(parse(b.dataset.dpd));
      else if (b.dataset.dpt === 'today') pick(new Date());
      else if (b.dataset.dpt === 'clear') pick(null);
      return;
    }
    if (isDate(e.target)) open(e.target);
  }, true);
  document.addEventListener('keydown', function (e) {
    if (pop && pop.contains(e.target)) {
      var k = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[e.key];
      if (k) { e.preventDefault(); moveFocus(k); return; }
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(true); return; }
      if (e.key === 'Tab') { close(true); return; }
      return;
    }
    if (isDate(e.target) && ((e.key === 'ArrowDown' && e.altKey) || e.key === 'F4' || e.key === ' ')) {
      e.preventDefault(); open(e.target); moveFocus(0);
      return;
    }
    if (pop && e.key === 'Escape') { e.stopPropagation(); close(true); }
  }, true);
  window.addEventListener('resize', function () { close(); });
  document.addEventListener('scroll', function (e) { if (pop && !pop.contains(e.target)) close(); }, true);
})();
