// ---------- ux31 右クリック：何もない所で新規作成、切り取り・コピー・貼り付けなど ----------
function toNested(c) { if (c.tasks) { c.kids = c.tasks; delete c.tasks; c.title = c.name; delete c.name; c.folder = true; } return c; }
function deepCopy(n) {
  var c = toNested(JSON.parse(JSON.stringify(n)));
  (function re(x) { x.id = uid('k'); delete x.fresh; (x.kids || []).forEach(re); })(c);
  c.title = nextName(ttl(n)); return c;
}
function under(a, b) { return a === b || ancestors(a).indexOf(b) >= 0; } // a が b の中（または同じ）
function clipNode() { return UI.clip ? task(UI.clip.id) : null; }
function canPasteInto(f) {
  var c = clipNode(); if (!c || !f || !isFolder(f) || !manages(f)) return false;
  if (UI.clip.mode === 'cut') return parentOf(c) !== f && !under(f, c);
  return true;
}
function pasteInto(f) {
  var c = clipNode(); if (!canPasteInto(f)) return;
  snap();
  var n;
  if (UI.clip.mode === 'cut') { removeNode(c); n = c; UI.clip = null; }
  else n = deepCopy(c);
  if (!f.tasks && !f.kids) f.kids = [];
  kids(f).push(n); expandTo(f.id); save(); render(); toast('「' + ttl(n) + '」を「' + ttl(f) + '」に' + (n === c ? '移動しました' : '貼り付けました'));
}
function bgCM(x, y) {
  var f = curFolder(), it = [], add = function (act, label, key) { it.push('<button role="menuitem" data-bcm="' + act + '">' + label + (key ? '<span class="cmk">' + key + '</span>' : '') + '</button>'); };
  if (S.fcur === 'mine') return;
  if (manages(f)) { add('newF', '新しいフォルダー'); if (f) add('newT', '新しいファイル'); }
  if (f && canPasteInto(f)) add('paste', '「' + esc(ttl(clipNode())).slice(0, 14) + '」を貼り付け', 'Ctrl+V');
  if (it.length) it.push('<i class="cmsep"></i>');
  add('mode', S.fmode === 'gantt' ? 'カード表示にする' : 'ガントチャートで見る');
  if (S.fmode !== 'gantt') { var cur = sortOf(f); it.push('<div class="cml">並べ替え</div>'); SORTS.forEach(function (o) { it.push('<button role="menuitem" data-bcm="sort" data-v="' + o[0] + '"><span class="ck">' + (cur === o[0] ? '✓' : '') + '</span>' + o[1] + '</button>'); }); }
  if (f) { it.push('<i class="cmsep"></i>'); if (editSelf(f)) add('edit', 'このフォルダーを編集'); add('up', parentOf(f) ? '上のフォルダーへ' : 'すべてへ'); }
  var m = document.getElementById('cm'); if (!m) { m = document.createElement('div'); m.id = 'cm'; m.className = 'cm'; m.setAttribute('role', 'menu'); document.body.appendChild(m); }
  UI.cm = null; m.innerHTML = '<div class="cmh">' + FOLD + '<span>' + esc(f ? ttl(f) : 'すべて') + '</span></div>' + it.join('');
  m.style.left = '0px'; m.style.top = '0px'; var w = m.offsetWidth, h = m.offsetHeight;
  m.style.left = Math.min(x, window.innerWidth - w - 8) + 'px'; m.style.top = Math.min(y, window.innerHeight - h - 8) + 'px';
}
document.addEventListener('contextmenu', function (e) {
  if (S.view !== 'projects' || !e.target.closest) return;
  if (e.target.closest('.ftn[data-id], .fcard[data-id], .gg .gr[data-row], input, textarea, [contenteditable], a, .cm')) return;
  if (!e.target.closest('.wkm, .ftree')) return;
  e.preventDefault(); closePop && closePop(); bgCM(e.clientX, e.clientY);
});
document.addEventListener('click', function (e) {
  var c = e.target.closest && e.target.closest('[data-cm2],[data-bcm]'); if (!c) return;
  e.stopImmediatePropagation(); e.preventDefault();
  var a = c.dataset.cm2 || c.dataset.bcm, n = c.dataset.cm2 ? task(UI.cm) : null, f = curFolder();
  closeCM();
  if (c.dataset.cm2) {
    if (!n) return;
    if (a === 'me') { snap(); n.who = S.me; save(); render(); toast('担当になりました'); }
    else if (a === 'toFile') { snap(); delete n.folder; n.kids = undefined; delete n.kids; n.done = false; save(); render(); toast('ファイルに変えました'); }
    else if (a === 'cut') { UI.clip = { mode: 'cut', id: n.id }; render(); toast('切り取りました。貼り付け先のフォルダーで右クリック'); }
    else if (a === 'copy') { UI.clip = { mode: 'copy', id: n.id }; toast('コピーしました'); }
    else if (a === 'paste') pasteInto(n);
    return;
  }
  if (a === 'newF' || a === 'newT') { snap(); var k = a === 'newF' ? addFolder(f, '新しいフォルダー') : addUnder(f, '新しいファイル'); save(); render(); editNew(k); }
  else if (a === 'paste') pasteInto(f);
  else if (a === 'mode') { S.fmode = S.fmode === 'gantt' ? 'card' : 'gantt'; UI.sp = null; save(); render(); }
  else if (a === 'sort') { UI.sorts = UI.sorts || {}; UI.sorts[f ? f.id : '_'] = c.dataset.v; render(); }
  else if (a === 'edit' && f) { M = { m: 'edit', id: f.id }; renderModal(); }
  else if (a === 'up') goFolder(f && parentOf(f) ? parentOf(f).id : '');
}, true);
// キーボード：Ctrl/⌘ + X・C・V（選んでいるカード／行、貼り付けは今のフォルダー）
document.addEventListener('keydown', function (e) {
  if (S.view !== 'projects' || !(e.ctrlKey || e.metaKey) || e.altKey) return;
  var t = e.target; if (t.closest && t.closest('input, textarea, select, [contenteditable]')) return;
  var k = e.key.toLowerCase(); if (k !== 'x' && k !== 'c' && k !== 'v') return;
  if (k === 'v') { var f = curFolder(); if (f && canPasteInto(f)) { e.preventDefault(); pasteInto(f); } return; }
  var el = document.activeElement && document.activeElement.closest && document.activeElement.closest('.fcard[data-id], .gr[data-row]'); if (!el) return;
  var n = task(el.dataset.id || el.dataset.row); if (!n) return;
  if (k === 'x' && !(parentOf(n) && editSelf(n))) return;
  e.preventDefault(); UI.clip = { mode: k === 'x' ? 'cut' : 'copy', id: n.id }; if (k === 'x') render(); toast(k === 'x' ? '切り取りました' : 'コピーしました');
});


// ---------- ux32 ドラッグ：フォルダー行（またはツリーのフォルダー）の真ん中に重ねると、その中へ移動 ----------
function mvClear() { document.querySelectorAll('.mvinto').forEach(function (x) { x.classList.remove('mvinto', 'mvno'); }); document.body.classList.remove('mvin'); }


// ---------- ux33 ガントの行は左側のどこをつかんでも移動できる／外へ出す ----------
document.addEventListener('pointerdown', function (e) {
  if (e.button > 0 || mv || !e.target.closest) return;
  var gl = e.target.closest('.gg .gr[data-row] > .gl'); if (!gl) return;
  if (e.target.closest('input, select, textarea, .cx, .wck, .dh, .lwh, .gin, [data-act="gsave"], [data-act="gcancel"], [data-act="gedit"]')) return;
  var row = gl.parentElement; if (row.classList.contains('gediting')) return;
  var n = task(row.dataset.row); if (!n || !parentOf(n) || !editSelf(n)) return;
  mv = { n: n, h: gl, row: row, scope: '.gg', sc: scroller(row), y0: e.clientY, on: false, plan: null };
});
window.addEventListener('click', function (e) { if (UI.mvJust && Date.now() - UI.mvJust < 350) { UI.mvJust = 0; e.stopImmediatePropagation(); e.preventDefault(); } }, true);
// 右クリック：ひとつ上のフォルダーへ出す
document.addEventListener('click', function (e) {
  var c = e.target.closest && e.target.closest('[data-cm3]'); if (!c) return;
  e.stopImmediatePropagation(); e.preventDefault();
  var n = task(UI.cm); closeCM(); if (!n) return;
  var p = parentOf(n), g = p && parentOf(p); if (!g || !manages(g)) return;
  snap(); removeNode(n); var arr = kids(g), i = arr.indexOf(p); arr.splice(i + 1, 0, n); expandTo(g.id);
  save(); render(); toastUndo('「' + ttl(n) + '」を「' + ttl(g) + '」へ出しました');
}, true);


// ---------- ux34 ドラッグ：どの段の行の間にも置ける（線の位置＝入る段）。フォルダーの真ん中＝中へ ----------
function mvPlan (e) {
  mvClear();
  var src = mv.n, el = document.elementFromPoint(e.clientX, e.clientY); if (!el) return null;
  var T = el.closest('.ftn[data-id]') || el.closest('.crumb button[data-act="fgo"][data-id]:not([data-id=""])');
  var into = function (t, R) {
    var ok = !!t && isFolder(t) && manages(t) && !within(src, t);
    R.classList.add('mvinto'); if (!ok) R.classList.add('mvno'); document.body.classList.add('mvin');
    return { into: t, ok: ok, x: 0, y: 0, r: 0 };
  };
  if (T) { var tt = task(T.dataset.id); return tt && tt !== src ? into(tt, T) : null; }
  var R = el.closest(mv.scope + ' [data-d]'); if (!R || R.classList.contains('gfill')) return null;
  var rect = function (x) { return x.getBoundingClientRect(); }, rc = rect(R);
  var cxOf = function (x) { var c = x.querySelector('.lvb') || x.querySelector('.ct') || x.querySelector('.gname'); return c ? rect(c).left - 2 : rc.left + 8; };
  var rEnd = function (x) { var g = x.querySelector('.gl'); return (g ? rect(g).right : rect(x).right) - 12; };
  var plan = function (par, ref, before, y, x) {
    var ok = (par ? manages(par) : isAdmin() && !parentOf(src)) && !(par && within(src, par)) && ref !== src;
    return { par: par, ref: ref, before: before, ok: ok, x: x, y: y, r: rEnd(R) };
  };
  if (!R.dataset.row) { // 「＋ 追加」の行 → その並びの末尾
    var pi = R.querySelector('[data-parent]'), pp = pi && pi.dataset.parent ? task(pi.dataset.parent) : null; if (!pp) return null;
    return plan(pp, null, false, rc.top, cxOf(R));
  }
  var t = task(R.dataset.row); if (!t) return null;
  if (t === src || within(src, t)) return null;
  var f = isFolder(t), y = e.clientY, q = rc.height / 4;
  if (f && y > rc.top + q && y < rc.bottom - q) return into(t, R);
  var next = R.nextElementSibling, openKids = f && next && next.dataset && +next.dataset.d > +R.dataset.d;
  if (y < rc.top + rc.height / 2) return plan(parentOf(t), t, true, rc.top, cxOf(R));
  if (openKids) return plan(t, kids(t)[0] || null, true, rc.bottom, cxOf(R) + 18); // 開いているフォルダーの下端 → 中の先頭
  return plan(parentOf(t), t, false, rc.bottom, cxOf(R));
}


