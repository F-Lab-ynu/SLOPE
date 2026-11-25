// ---------------- 業務リスト: spreadsheet-style editing ----------------
var FOCUS = null; // { id, c, parent, caret }
function toastUndo(msg) {
  var t = document.getElementById('toast');
  t.innerHTML = esc(msg) + ' <button data-act="undoAll" style="margin-left:10px;border:0;background:transparent;color:#93C5FD;font-weight:600;cursor:pointer">元に戻す</button>';
  t.hidden = false; clearTimeout(toast._t); toast._t = setTimeout(function () { t.hidden = true; }, 5000);
}
function refocus() {
  if (!FOCUS) return;
  var sel = FOCUS.c === 'new' ? '.cell[data-c="new"][data-parent="' + FOCUS.parent + '"]' : '.cell[data-id="' + FOCUS.id + '"][data-c="' + FOCUS.c + '"]';
  var el = document.querySelector(sel); FOCUS = null;
  if (el) { el.focus(); if (el.setSelectionRange && (el.type === 'text' || el.type === 'textarea')) { var L = el.value.length; el.setSelectionRange(L, L); } }
}
function rerender(f) { FOCUS = f || null; save(); render(); refocus(); }
function sibs(n) { var p = parentOf(n); return p ? kids(p) : S.projects; }
function setTitle(n, v) { if (n.tasks) n.name = v; else n.title = v; }
function newNode(par, title) { return { id: uid('k'), title: title, who: '', start: isoOf(TODAY), end: isoOf(TODAY), done: false }; } // 期間は作った日。あとで伸ばす

function addUnder(par, title, after) {
  if (!par) { var ev = { id: uid('pj'), name: title, kind: 'event', announce: 'before', reg: 0, unit: '教育部', who: '', start: isoOf(TODAY), end: isoOf(TODAY + 30 * DAY), tasks: [] }; S.projects.push(ev); return ev; }
  if (!par.tasks) { if (!par.kids) par.kids = []; delete par.done; }
  var n = newNode(par, title), arr = kids(par), i = after ? arr.indexOf(after) : -1;
  if (i >= 0) arr.splice(i + 1, 0, n); else arr.push(n);
  expandTo(par.id); return n;
}
function removeNode(n) { var p = parentOf(n); if (p) { var a = kids(p), i = a.indexOf(n); if (i >= 0) a.splice(i, 1); } else S.projects = S.projects.filter(function (x) { return x !== n; }); }
function indent(n) {
  var p = parentOf(n); if (!p) return false;
  var a = kids(p), i = a.indexOf(n); if (i <= 0) return false;
  var prev = a[i - 1]; if (!canEdit(prev)) return false;
  a.splice(i, 1);
  if (!prev.tasks) { if (!prev.kids) prev.kids = []; delete prev.done; }
  kids(prev).push(n); expandTo(prev.id); return true;
}
function outdent(n) {
  var p = parentOf(n); if (!p) return false; var gp = parentOf(p); if (!gp) return false;
  if (!manages(gp)) return false;
  var a = kids(p); a.splice(a.indexOf(n), 1);
  var b = kids(gp); b.splice(b.indexOf(p) + 1, 0, n); return true;
}
function moveFocus(el, dir) {
  var c = el.dataset.c === 'new' ? 't' : el.dataset.c;
  var all = Array.prototype.slice.call(document.querySelectorAll('.cell[data-c="' + c + '"]:not([disabled]), .cell[data-c="new"]'));
  if (c !== 't') all = Array.prototype.slice.call(document.querySelectorAll('.cell[data-c="' + c + '"]:not([disabled])'));
  var i = all.indexOf(el); var t = all[i + dir]; if (t) { t.focus(); if (t.select && (t.type === 'text' || t.type === 'textarea')) t.select(); }
}
document.addEventListener('keydown', function (e) {
  var el = e.target; if (!el.classList || !el.classList.contains('cell') || !el.closest('.wcards, .gg')) return;
  var c = el.dataset.c;
  if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && e.altKey && el.dataset.id) {
    e.preventDefault(); var mn = task(el.dataset.id); if (!mn || !canMove(mn)) return;
    if (!parentOf(mn)) manualRoots();
    var ar = sibs(mn), mi = ar.indexOf(mn), mj = mi + (e.key === 'ArrowDown' ? 1 : -1);
    if (mj < 0 || mj >= ar.length) return;
    snap(); ar.splice(mi, 1); ar.splice(mj, 0, mn); rerender({ id: mn.id, c: el.dataset.c }); return;
  }
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { if (el.tagName === 'SELECT') return; e.preventDefault(); moveFocus(el, e.key === 'ArrowDown' ? 1 : -1); return; }
  if (e.isComposing || e.keyCode === 229) return; // IME変換中のEnterは無視
  if (c === 'new' && e.key === 'Enter') {
    e.preventDefault(); var v = el.value.trim(); if (!v) return;
    var pid = el.dataset.parent; var par = pid ? task(pid) : null; snap();
    var nn = addUnder(par, v);
    rerender(pid ? { c: 'new', parent: pid } : { id: nn.id, c: 't' });
    if (!pid) toast('イベントを追加しました');
    return;
  }
  if (c !== 't') return;
  var n = task(el.dataset.id); if (!n) return;
  if (e.key === 'Enter') {
    e.preventDefault(); var v2 = el.value.trim(); if (v2) setTitle(n, v2);
    var p = parentOf(n);
    if (!p) { if (!canEdit(n)) return; var k0 = addUnder(n, ''); rerender({ id: k0.id, c: 't' }); return; }
    if (!manages(p)) { rerender(); return; }
    var nk = addUnder(p, '', n); nk.fresh = true; rerender({ id: nk.id, c: 't' }); return;
  }
  if (e.key === 'Tab') {
    e.preventDefault(); var v3 = el.value.trim(); if (v3) setTitle(n, v3);
    var ok = e.shiftKey ? outdent(n) : indent(n);
    if (ok) rerender({ id: n.id, c: 't' }); else toast(e.shiftKey ? 'これ以上上の段にはできません' : '上に同じ段の業務がないため、下げられません');
    return;
  }
  if (e.key === 'Backspace' && el.value === '' && parentOf(n) && !kids(n).length) {
    e.preventDefault(); var all = Array.prototype.slice.call(document.querySelectorAll('.cell[data-c="t"]')); var prev = all[all.indexOf(el) - 1];
    snap(); removeNode(n); rerender(prev ? { id: prev.dataset.id, c: 't' } : null); return;
  }
  if (e.key === 'Escape') { el.value = ttl(n); el.blur(); }
});
document.addEventListener('focusout', function (e) {
  var el = e.target; if (!el.classList || !el.classList.contains('cell') || el.dataset.c !== 't') return;
  var n = task(el.dataset.id); if (!n) return;
  var v = el.value.trim();
  if (!v) { if (n.fresh) { removeNode(n); save(); setTimeout(function () { if (!document.querySelector('.cell:focus')) render(); }, 0); } else el.value = ttl(n); return; }
  if (v !== ttl(n)) { setTitle(n, v); delete n.fresh; save(); } else delete n.fresh;
}, true);
document.addEventListener('change', function (e) {
  var el = e.target; if (!el.classList || !el.closest || !el.closest('.wcards, .gg')) return;
  var c = el.dataset.c; if (!c || c === 't' || c === 'new') return;
  var n = task(el.dataset.id); if (!n) return;
  if (c === 'w') { var prev = n.who; n.who = el.value; if (el.value && el.value !== prev) { window.notify(el.value, '「' + ttl(n) + '」の担当になりました', ttl(rootOf(n))); toast(member(el.value).name + 'に通知しました'); } rerender({ id: n.id, c: 'w' }); return; }
  if (c === 's' || c === 'e') {
    if (!el.value) { rerender(); return; }
    if (c === 's') { n.start = el.value; if (n.end < n.start) n.end = n.start; } else { n.end = el.value; if (n.end < n.start) n.start = n.end; }
    var p = parentOf(n); if (p && (n.start < p.start || n.end > p.end)) toast('「' + ttl(p) + '」の期間をはみ出しています');
    rerender({ id: n.id, c: c }); return;
  }
  if (c === 'done') { n.done = el.checked; if (n.done) { S.justDone = n.id; reportUp(n); } rerender(); return; }
});
document.addEventListener('click', function (e) {
  var b = e.target.closest && e.target.closest('[data-act="rowDel"],[data-act="undoAll"]'); if (!b) return;
  e.stopPropagation();
  if (b.dataset.act === 'undoAll') { undoNow(); return; }
  var n = task(b.dataset.id); if (!n) return;
  snap(); var cnt = nodesOf(n).length - 1; removeNode(n); rerender();
  toastUndo('「' + ttl(n) + '」' + (cnt ? 'と下の ' + cnt + ' 件' : '') + 'を削除しました');
}, true);


// ---------------- gantt zoom: pinch (touch / trackpad / Safari gesture) and ctrl+wheel ----------------
function zoomTo(px, cx) {
  var gs = document.getElementById('gs'), gg = document.querySelector('.gg'); if (!gs || !gg) return;
  px = Math.max(2, Math.min(48, px)); var old = +gg.dataset.px, LW = +gg.dataset.lw, lo = +gg.dataset.lo;
  if (Math.abs(px - old) < 0.05) return;
  var r = gs.getBoundingClientRect(), xr = cx == null ? (r.width + LW) / 2 : Math.max(LW, cx - r.left);
  var at = lo + ((gs.scrollLeft + xr - LW) / old) * DAY;
  S.zoom = px; save(); render();
  gs = document.getElementById('gs'); gg = document.querySelector('.gg'); if (!gs || !gg) return;
  gs.scrollLeft = LW + ((at - +gg.dataset.lo) / DAY) * px - xr; UI.sl = gs.scrollLeft;
}
var ZQ = null;
function zoomSoon(px, cx) { var first = !ZQ; ZQ = { px: px, cx: cx }; if (first) requestAnimationFrame(function () { var q = ZQ; ZQ = null; zoomTo(q.px, q.cx); }); }
function inGantt(t) { return t && t.closest && t.closest('#gs'); }
document.addEventListener('wheel', function (e) {
  if (!e.ctrlKey || !inGantt(e.target)) return;
  e.preventDefault(); var gg = document.querySelector('.gg'); if (!gg) return;
  zoomSoon((ZQ ? ZQ.px : +gg.dataset.px) * Math.exp(-e.deltaY * 0.004), e.clientX);
}, { passive: false });
var PINCH = null;
document.addEventListener('touchstart', function (e) {
  if (e.touches.length !== 2 || !inGantt(e.target)) return;
  var a = e.touches[0], b = e.touches[1], gg = document.querySelector('.gg');
  PINCH = { d: Math.abs(a.clientX - b.clientX) || 1, px: +gg.dataset.px, cx: (a.clientX + b.clientX) / 2 };
}, { passive: true });
document.addEventListener('touchmove', function (e) {
  if (!PINCH || e.touches.length !== 2) return;
  e.preventDefault(); var a = e.touches[0], b = e.touches[1];
  var d = Math.abs(a.clientX - b.clientX) || 1; zoomSoon(PINCH.px * d / PINCH.d, PINCH.cx);
}, { passive: false });
document.addEventListener('touchend', function (e) { if (e.touches.length < 2) PINCH = null; });
var GST = null; // Safari (iOS / macOS) gesture events
document.addEventListener('gesturestart', function (e) { if (!inGantt(e.target)) return; e.preventDefault(); var gg = document.querySelector('.gg'); GST = { px: +gg.dataset.px, cx: e.clientX }; });
document.addEventListener('gesturechange', function (e) { if (!GST) return; e.preventDefault(); if (!PINCH) zoomSoon(GST.px * e.scale, GST.cx); });
document.addEventListener('gestureend', function () { GST = null; });

render();
})();
