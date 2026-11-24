// ---------------- 行の移動（ドラッグ / Alt+↑↓） ----------------
function canMove(n) { var p = parentOf(n); return p ? (isAdmin() || canEdit(p)) : isAdmin(); }
function heightOf(n) { var h = 0; kids(n).forEach(function (c) { h = Math.max(h, heightOf(c) + 1); }); return h; }
function within(a, b) { while (b) { if (b === a) return true; b = parentOf(b); } return false; } // b is a or under a
var mv = null;
function scroller(el) { while (el && el !== document.body) { var cs = getComputedStyle(el); if (/(auto|scroll)/.test(cs.overflowY) && el.scrollHeight > el.clientHeight) return el; el = el.parentElement; } return document.scrollingElement; }
document.addEventListener('pointerdown', function (e) {
  var h = e.target.closest('.dh[data-drag]'); if (!h || e.button > 0) return;
  var n = task(h.dataset.drag); if (!n || !canMove(n)) return;
  e.preventDefault(); h.setPointerCapture(e.pointerId);
  var row = h.closest('[data-row]');
  mv = { n: n, h: h, row: row, scope: h.closest('.wcards') ? '.wcards' : '.gg', sc: scroller(row), y0: e.clientY, on: false, plan: null };
});
document.addEventListener('pointermove', function (e) {
  if (!mv) return;
  if (!mv.on) { if (Math.abs(e.clientY - mv.y0) < 4) return; mv.on = true; document.body.classList.add('moving'); mv.row.classList.add('mvsrc');
    nodesOf(mv.n).forEach(function (k) { var x = document.querySelector(mv.scope + ' [data-row="' + k.id + '"]'); if (x) x.classList.add('mvsrc'); });
    mv.line = document.createElement('div'); mv.line.className = 'mvline'; document.body.appendChild(mv.line);
    mv.gh = document.createElement('div'); mv.gh.className = 'mvghost'; mv.gh.textContent = ttl(mv.n); document.body.appendChild(mv.gh); }
  mv.gh.style.left = (e.clientX + 12) + 'px'; mv.gh.style.top = (e.clientY - 14) + 'px';
  var pl = mvPlan(e); mv.plan = pl;
  if (pl) { mv.line.style.display = 'block'; mv.line.style.left = pl.x + 'px'; mv.line.style.top = (pl.y - 1) + 'px'; mv.line.style.width = Math.max(40, pl.r - pl.x) + 'px'; mv.line.classList.toggle('mvbad', !pl.ok); }
  else mv.line.style.display = 'none';
  // 端に近づいたら自動スクロール
  var sc = mv.sc, r = sc === document.scrollingElement ? { top: 0, bottom: innerHeight } : sc.getBoundingClientRect();
  clearInterval(mv.as); var dy = e.clientY < r.top + 60 ? -12 : e.clientY > r.bottom - 60 ? 12 : 0;
  if (dy) mv.as = setInterval(function () { sc.scrollTop += dy; }, 16);
});
// ドラッグを終える：フォルダーの中へ／行の間へ／置けない
function mvEnd(e, cancel) {
  var m = mv, pl = m && m.plan;
  if (m && m.on && !cancel && pl && !pl.into) {
    if (!pl.ok) { mvClear(); mvFinish(e, true); UI.mvJust = Date.now(); toast(pl.par ? '「' + ttl(pl.par) + '」のリーダーではないので置けません' : 'ここには置けません'); return; }
    if (pl.par && !parentOf(m.n)) toNested(m.n);
  }
  if (m && m.on) UI.mvJust = Date.now();
  mvClear();
  if (!m || cancel || !m.on || !pl || !pl.into) return mvFinish(e, cancel);
  mvFinish(e, true); // 見た目の後片付けだけ
  var n = m.n, t = pl.into;
  if (!pl.ok) { toast(within(n, t) ? '自分の中には移動できません' : '「' + ttl(t) + '」のリーダーではないので入れられません'); return; }
  snap();
  if (!parentOf(n)) { manualRoots(); S.projects.splice(S.projects.indexOf(n), 1); toNested(n); } else removeNode(n);
  if (!t.tasks && !t.kids) t.kids = [];
  kids(t).push(n); expandTo(t.id);
  rerender(); toastUndo('「' + ttl(n) + '」を「' + ttl(t) + '」の中に移動しました');
}
function mvFinish(e, cancel) {
  if (!mv) return; var m = mv; mv = null; clearInterval(m.as);
  document.body.classList.remove('moving'); document.querySelectorAll('.mvsrc').forEach(function (x) { x.classList.remove('mvsrc'); });
  if (m.line) m.line.remove(); if (m.gh) m.gh.remove();
  if (!m.on || cancel) return;
  var pl = m.plan; if (!pl) return;
  if (!pl.ok) { toast(depthOf(pl.par || m.n) + 1 + heightOf(m.n) > MAXD ? 'これ以上深い段には移動できません' : 'ここには移動できません'); return; }
  snap();
  var n = m.n, arr;
  if (!pl.par) { manualRoots(); S.projects.splice(S.projects.indexOf(n), 1); arr = S.projects; }
  else { removeNode(n); if (!pl.par.tasks) { if (!pl.par.kids) pl.par.kids = []; delete pl.par.done; } arr = kids(pl.par); }
  var i = pl.ref ? arr.indexOf(pl.ref) : -1;
  if (i < 0) arr.push(n); else arr.splice(pl.before ? i : i + 1, 0, n);
  if (pl.par) expandTo(pl.par.id);
  rerender(); toastUndo('「' + ttl(n) + '」を移動しました');
}
document.addEventListener('pointerup', function (e) { mvEnd(e); });
document.addEventListener('pointercancel', function (e) { mvEnd(e, true); });
document.addEventListener('keydown', function (e) { if (mv && e.key === 'Escape') mvEnd(e, true); });

// drag bars: body moves the task, right edge changes the deadline
var drag = null;
document.addEventListener('pointerdown', function (e) {
  var bar = e.target.closest('[data-bar]'); if (!bar || e.button !== 0 || bar.classList.contains('lock')) return;
  drag = { el: bar, k: task(bar.dataset.bar), x0: e.clientX, left: parseFloat(bar.style.left), width: parseFloat(bar.style.width), px: +document.querySelector('.gg').dataset.px, resize: !!e.target.dataset.hd, dd: 0 };
  bar.classList.add('drag'); bar.setPointerCapture(e.pointerId); e.preventDefault();
  drag.lo = +document.querySelector('.gg').dataset.lo; dateGuides(drag);
});
function dateGuides(d) {
  if (!d.gd) { d.gd = ['s', 'e'].map(function (k) { var l = document.createElement('div'); l.className = 'dguide'; l.innerHTML = '<span></span>'; document.body.appendChild(l); return l; }); }
  var s0 = dayOf(d.k.start) + (d.resize ? 0 : d.dd * DAY), e0 = Math.max(s0, dayOf(d.k.end) + d.dd * DAY);
  var br = d.el.getBoundingClientRect(), hr = document.querySelector('.ghead .gt').getBoundingClientRect();
  var WK = ['日', '月', '火', '水', '木', '金', '土'];
  [[s0, br.left], [e0, br.right]].forEach(function (v, i) {
    var g = d.gd[i], dt = new Date(v[0]);
    g.style.left = Math.round(v[1]) + 'px'; g.style.top = hr.top + 'px'; g.style.height = Math.max(0, br.top - hr.top) + 'px';
    g.className = 'dguide' + (i ? ' end' : '');
    g.firstChild.style.top = Math.max(2, hr.height - 24) + 'px';
    g.firstChild.textContent = (dt.getUTCMonth() + 1) + '/' + dt.getUTCDate() + '(' + WK[dt.getUTCDay()] + ')';
  });
}
document.addEventListener('pointermove', function (e) {
  if (!drag) return;
  var dd = Math.round((e.clientX - drag.x0) / drag.px); drag.dd = dd;
  if (drag.resize) drag.el.style.width = Math.max(drag.px, drag.width + dd * drag.px) + 'px';
  else drag.el.style.left = (drag.left + dd * drag.px) + 'px';
  dateGuides(drag);
});
document.addEventListener('pointerup', function () {
  if (!drag) return;
  var d = drag; drag = null; d.el.classList.remove('drag'); if (d.gd) d.gd.forEach(function (g) { g.remove(); });
  if (!d.dd) { var ce = document.querySelector('.cell[data-c="t"][data-id="' + d.k.id + '"]'); if (ce) { ce.focus(); ce.select(); } return; }
  if (d.resize) d.k.end = isoOf(Math.max(dayOf(d.k.start), dayOf(d.k.end) + d.dd * DAY));
  else nodesOf(d.k).forEach(function (x) { x.start = isoOf(dayOf(x.start) + d.dd * DAY); x.end = isoOf(dayOf(x.end) + d.dd * DAY); });
  save(); render();
  toast(fmtDate(d.k.start) + ' – ' + fmtDate(d.k.end));
});

// ドラッグ中にほかの画面（スクショなど）へ移ってボタンを離したことが届かなかったときは、ドラッグをやめて元に戻す
function dragAbort() {
  if (drag) { var d = drag; drag = null; d.el.classList.remove('drag'); if (d.gd) d.gd.forEach(function (g) { g.remove(); }); render(); }
  Array.prototype.forEach.call(document.querySelectorAll('.dguide'), function (g) { g.remove(); });
}
document.addEventListener('pointercancel', function () { if (drag) dragAbort(); });
document.addEventListener('lostpointercapture', function (e) { if (drag && e.target === drag.el) setTimeout(function () { if (drag) dragAbort(); }, 0); }, true);
window.addEventListener('blur', function () { if (drag) dragAbort(); });
document.addEventListener('visibilitychange', function () { if (document.hidden && drag) dragAbort(); });
document.addEventListener('pointermove', function (e) { if (drag && e.buttons === 0 && e.pointerType === 'mouse') dragAbort(); }, true);


