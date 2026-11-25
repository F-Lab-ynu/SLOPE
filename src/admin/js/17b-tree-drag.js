// ---------- ux57 左のツリーでもドラッグで場所を移動（タッチは長押ししてから動かす。動かさずに離すとメニュー） ----------
function treePlan(e) {
  var src = mv.n, el = document.elementFromPoint(e.clientX, e.clientY); if (!el) return null;
  var cb = el.closest('.crumb button[data-act="fgo"][data-id]:not([data-id=""])');
  var R = el.closest('.ftl .ft'), btn = R ? R.querySelector('.ftn[data-id]') : cb;
  if (!btn) return null;
  var t = task(btn.dataset.id); if (!t || t === src || within(src, t)) return null;
  var into = function () {
    var ok = isFolder(t) && manages(t) && !within(src, t);
    btn.classList.add('mvinto'); if (!ok) btn.classList.add('mvno'); document.body.classList.add('mvin');
    return { into: t, ok: ok, x: 0, y: 0, r: 0 };
  };
  if (!R) return into(); // パンくず＝その中へ
  var rc = R.getBoundingClientRect(), y = e.clientY, q = rc.height / 4;
  if (isFolder(t) && y > rc.top + q && y < rc.bottom - q) return into();
  var before = y < rc.top + rc.height / 2, par = parentOf(t);
  var ok = (par ? manages(par) : isAdmin() && !parentOf(src)) && !(par && within(src, par));
  var br = btn.getBoundingClientRect();
  return { par: par, ref: t, before: before, ok: ok, x: br.left, y: before ? rc.top : rc.bottom, r: rc.right - 8 };
}
var TREE_LP = null;
function treeArm(n, b, e) { mv = { n: n, h: b, row: b, scope: '.ftl', sc: scroller(b), y0: e.clientY, on: false, plan: null, touch: e.pointerType === 'touch' }; }
document.addEventListener('pointerdown', function (e) {
  if (e.button > 0 || mv || !e.target.closest || S.view !== 'projects') return;
  var b = e.target.closest('.ftl .ftn[data-id]'); if (!b) return;
  var n = task(b.dataset.id); if (!n || !canMove(n)) return;
  if (e.pointerType !== 'touch') { treeArm(n, b, e); return; }
  clearTimeout(TREE_LP && TREE_LP.t);
  TREE_LP = { x: e.clientX, y: e.clientY, t: setTimeout(function () {
    TREE_LP = null; treeArm(n, b, e); mv.armed = true; mv.cx = e.clientX; mv.cy = e.clientY;
    b.classList.add('ftarm'); if (navigator.vibrate) try { navigator.vibrate(12); } catch (er) {}
  }, 380) };
});
document.addEventListener('pointermove', function (e) {
  if (TREE_LP && (Math.abs(e.clientX - TREE_LP.x) > 8 || Math.abs(e.clientY - TREE_LP.y) > 8)) { clearTimeout(TREE_LP.t); TREE_LP = null; }
}, true);
// 長押しで掴んだあとは、ツリーをスクロールさせずに動かす
document.addEventListener('touchmove', function (e) { if (mv && mv.armed) e.preventDefault(); }, { passive: false });
document.addEventListener('pointerup', function (e) {
  if (TREE_LP) { clearTimeout(TREE_LP.t); TREE_LP = null; }
  if (mv && mv.armed && !mv.on) { // 長押しして動かさなかった → いつものメニュー
    var n = mv.n, b = mv.h; b.classList.remove('ftarm'); mv = null; UI.mvJust = Date.now();
    closePop(); openCM(n, e.clientX, e.clientY);
  }
}, true);
document.addEventListener('pointercancel', function () { if (TREE_LP) { clearTimeout(TREE_LP.t); TREE_LP = null; } document.querySelectorAll('.ftarm').forEach(function (x) { x.classList.remove('ftarm'); }); }, true);
// タッチの長押しで出るブラウザのメニューは止める（自分で出す）
window.addEventListener('contextmenu', function (e) { if ((mv && mv.touch) || TREE_LP) { e.preventDefault(); e.stopImmediatePropagation(); } }, true);
