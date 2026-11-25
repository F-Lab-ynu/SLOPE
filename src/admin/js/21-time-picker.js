// 時間の入力：ブラウザ標準の代わりに、日付と同じ見た目の小さな選択欄を出す（指で触ったときは端末の標準）
(function () {
  var pop = null, cur = null, touch = false;
  var pad = function (n) { return (n < 10 ? '0' : '') + n; };
  var isTime = function (el) { return el && el.tagName === 'INPUT' && el.type === 'time' && !el.disabled && !el.readOnly; };
  var parts = function (v) { var m = /^(\d{2}):(\d{2})/.exec(v || ''); return m ? [+m[1], +m[2]] : null; };

  function close(back) {
    if (!pop) return; pop.remove(); pop = null;
    if (back && cur && document.contains(cur)) cur.focus();
    cur = null;
  }
  function set(h, m, done) {
    var el = cur; if (!el) return;
    el.value = h == null ? '' : pad(h) + ':' + pad(m);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    if (done) close(true); else draw();
  }
  function draw() {
    var p = parts(cur.value), hs = '', ms = '';
    for (var h = 0; h < 24; h++) hs += '<button type="button" class="tpkc' + (p && p[0] === h ? ' on' : '') + '" data-tph="' + h + '">' + pad(h) + '</button>';
    for (var m = 0; m < 60; m += 5) ms += '<button type="button" class="tpkc' + (p && p[1] === m ? ' on' : '') + '" data-tpm="' + m + '">' + pad(m) + '</button>';
    var keep = pop.querySelector('.tpkl') ? [].map.call(pop.querySelectorAll('.tpkl'), function (l) { return l.scrollTop; }) : null;
    pop.innerHTML = '<div class="tpkb"><div class="tpkl">' + hs + '</div><div class="tpkl">' + ms + '</div></div>' +
      (cur.required ? '' : '<div class="dpkf"><span></span><button type="button" data-tpt="clear">消す</button></div>');
    var ls = pop.querySelectorAll('.tpkl');
    if (keep) { ls[0].scrollTop = keep[0]; ls[1].scrollTop = keep[1]; return; }
    var now = new Date(), hh = p ? p[0] : now.getHours(), mm = p ? p[1] : 0;
    ls[0].scrollTop = Math.max(0, hh * 32 - 64); ls[1].scrollTop = Math.max(0, Math.floor(mm / 5) * 32 - 64);
  }
  function place() {
    var r = cur.getBoundingClientRect(), w = pop.offsetWidth, h = pop.offsetHeight;
    pop.style.left = Math.max(8, Math.min(window.innerWidth - w - 8, r.left)) + 'px';
    pop.style.top = (window.innerHeight - r.bottom - 8 >= h ? r.bottom + 6 : Math.max(8, r.top - h - 6)) + 'px';
  }
  function open(el) {
    if (pop && cur === el) return;
    close(); cur = el;
    pop = document.createElement('div'); pop.className = 'dpk tpk'; pop.setAttribute('role', 'dialog'); pop.setAttribute('aria-label', '時間を選ぶ');
    document.body.appendChild(pop); draw(); place();
  }

  document.addEventListener('pointerdown', function (e) {
    touch = e.pointerType === 'touch' || e.pointerType === 'pen';
    if (pop && !pop.contains(e.target) && e.target !== cur) close();
  }, true);
  document.addEventListener('click', function (e) {
    if (pop && pop.contains(e.target)) {
      var b = e.target.closest('button'); if (!b) return; e.preventDefault(); e.stopPropagation();
      var p = parts(cur.value);
      if (b.dataset.tph) set(+b.dataset.tph, p ? p[1] : 0, false);
      else if (b.dataset.tpm) set(p ? p[0] : new Date().getHours(), +b.dataset.tpm, true);
      else if (b.dataset.tpt === 'clear') set(null, 0, true);
      return;
    }
    if (isTime(e.target) && !touch) open(e.target);
  }, true);
  document.addEventListener('keydown', function (e) {
    if (!pop) return;
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(true); return; }
    if (e.key === 'Tab' || (cur && e.target === cur)) close(); // 手で打つときは邪魔しない
  }, true);
  window.addEventListener('resize', function () { close(); });
  document.addEventListener('scroll', function (e) { if (pop && !pop.contains(e.target)) close(); }, true);
})();
