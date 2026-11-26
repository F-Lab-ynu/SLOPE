// ---------- ux38 ファイルのメモを、枠なしの簡単なドキュメントに ----------
var DOC_TAGS = { P: 1, DIV: 1, BR: 1, H2: 1, H3: 1, B: 1, STRONG: 1, I: 1, EM: 1, U: 1, S: 1, STRIKE: 1, UL: 1, OL: 1, LI: 1, A: 1, HR: 1, BLOCKQUOTE: 1 };
function isDocHtml(m) { return /<\/?(p|div|h2|h3|ul|ol|li|b|strong|i|em|u|s|a|br|hr|blockquote)\b/i.test(m || ''); }
function docSanitize(html) {
  var t = document.createElement('template'); t.innerHTML = html || '';
  (function walk(node) {
    Array.prototype.slice.call(node.childNodes).forEach(function (c) {
      if (c.nodeType === 3) return;
      if (c.nodeType !== 1) { c.remove(); return; }
      var tag = c.tagName;
      if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'IFRAME' || tag === 'OBJECT') { c.remove(); return; }
      if (tag === 'H1') { var h = document.createElement('h2'); while (c.firstChild) h.appendChild(c.firstChild); c.replaceWith(h); c = h; tag = 'H2'; }
      if (/^H[4-6]$/.test(tag)) { var h3 = document.createElement('h3'); while (c.firstChild) h3.appendChild(c.firstChild); c.replaceWith(h3); c = h3; tag = 'H3'; }
      walk(c);
      if (!DOC_TAGS[tag]) { var frag = document.createDocumentFragment(); while (c.firstChild) frag.appendChild(c.firstChild); c.replaceWith(frag); return; }
      var keep = {};
      if (tag === 'A') { var href = c.getAttribute('href') || ''; if (/^(https?:|mailto:)/i.test(href)) keep.href = href; }
      if (tag === 'UL' && c.classList.contains('todo')) keep['class'] = 'todo';
      if (tag === 'LI' && c.hasAttribute('data-done')) keep['data-done'] = '';
      Array.prototype.slice.call(c.attributes).forEach(function (a) { c.removeAttribute(a.name); });
      Object.keys(keep).forEach(function (k) { c.setAttribute(k, keep[k]); });
      if (tag === 'A') { c.setAttribute('target', '_blank'); c.setAttribute('rel', 'noopener'); }
    });
  })(t.content);
  // 文中のURLはリンクに
  var tw = document.createTreeWalker(t.content, NodeFilter.SHOW_TEXT), ts = [], x;
  while ((x = tw.nextNode())) if (/https?:\/\//.test(x.textContent) && !(x.parentNode.closest && x.parentNode.closest('a'))) ts.push(x);
  ts.forEach(function (tn) {
    var frag = document.createDocumentFragment(), parts = tn.textContent.split(/(https?:\/\/[^\s<>"]+)/);
    parts.forEach(function (pt, i) { if (i % 2) { var a = document.createElement('a'); a.href = pt; a.textContent = pt; a.target = '_blank'; a.rel = 'noopener'; frag.appendChild(a); } else if (pt) frag.appendChild(document.createTextNode(pt)); });
    tn.replaceWith(frag);
  });
  return t.innerHTML;
}
function docHTML(m) { if (!m) return ''; return isDocHtml(m) ? docSanitize(m) : linkify(m).replace(/\n/g, '<br>'); }
function memoText(m) {
  if (!m || !isDocHtml(m)) return m || '';
  var d = document.createElement('div'); d.innerHTML = docSanitize(m.replace(/<br\s*\/?>/gi, '\n').replace(/<\/(p|div|h2|h3|li|blockquote)>/gi, '$&\n'));
  return d.textContent.replace(/\n{3,}/g, '\n\n').trim();
}
var DOCI = {
  h2: '<span class="dtt" style="font-weight:700">見出し</span>', h3: '<span class="dtt" style="font-weight:600">小見出し</span>', p: '<span class="dtt">本文</span>',
  b: '<svg viewBox="0 0 24 24"><path d="M7 5h6a3.5 3.5 0 0 1 0 7H7zM7 12h7a3.5 3.5 0 0 1 0 7H7z"/></svg>', i: '<svg viewBox="0 0 24 24"><path d="M10 5h8M6 19h8M14.5 5l-5 14"/></svg>', s: '<svg viewBox="0 0 24 24"><path d="M4 12h16M16 7.5A4 4 0 0 0 12 5c-2.4 0-4 1.3-4 3 0 1.3.8 2.2 2.4 2.8M8 16.5A4 4 0 0 0 12 19c2.4 0 4-1.3 4-3"/></svg>',
  ul: '<svg viewBox="0 0 24 24"><path d="M9 6h11M9 12h11M9 18h11"/><circle cx="4.5" cy="6" r="1"/><circle cx="4.5" cy="12" r="1"/><circle cx="4.5" cy="18" r="1"/></svg>',
  ol: '<svg viewBox="0 0 24 24"><path d="M10 6h10M10 12h10M10 18h10"/><path d="M4 5l1.5-1V9M3.5 15.5c0-1 2.5-1.2 2.5 0 0 .9-2.5 1.6-2.5 3h2.6"/></svg>',
  chk: '<svg viewBox="0 0 24 24"><rect x="3" y="4" width="7" height="7" rx="1.5"/><path d="M4.5 7.5l1.5 1.5 2.5-3M14 7.5h7M3 15h7v6H3zM14 18h7"/></svg>',
  q: '<svg viewBox="0 0 24 24"><path d="M4 6v12M9 8h11M9 12h11M9 16h7"/></svg>',
  hr: '<svg viewBox="0 0 24 24"><path d="M3 12h18"/></svg>',
  a: '<svg viewBox="0 0 24 24"><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/></svg>'
};
function docBar() {
  var b = function (k, t, key) { return '<button type="button" data-doc="' + k + '" title="' + t + (key ? '（' + key + '）' : '') + '" aria-label="' + t + '">' + DOCI[k] + '</button>'; };
  return '<div class="dtb" role="toolbar" aria-label="書式">' + b('h2', '見出し', '# + スペース') + b('h3', '小見出し', '## + スペース') + b('p', '本文') + '<i></i>' +
    b('b', '太字', 'Ctrl+B') + b('i', '斜体', 'Ctrl+I') + b('s', '取り消し線') + '<i></i>' +
    b('ul', '箇条書き', '- + スペース') + b('ol', '番号付き', '1. + スペース') + b('chk', 'チェックリスト', '[] + スペース') + b('q', '引用', '> + スペース') + b('hr', '区切り線', '---') + b('a', 'リンク', 'Ctrl+K') +
    '<span class="dts" id="dts"></span></div>';
}
var _docT = null;
function docEl() { return document.getElementById('fdoc'); }
// 同時に書いても消し合わないように：開いたとき（最後にそろえたとき）の中身を覚えておき、手元で書き換えたかどうかを持つ
var DOCB = { id: null, base: '', dirty: false };
function docInit() { var d = docEl(); if (!d) return null; if (!d._b || DOCB.id !== d.dataset.id) { d._b = 1; var n = task(d.dataset.id); DOCB = { id: d.dataset.id, base: (n && n.memo) || '', dirty: false }; } return d; }
function docNow(d) { return d.textContent.trim() || d.querySelector('hr, li') ? docSanitize(d.innerHTML) : ''; }
function docSave(now) {
  clearTimeout(_docT); if (docInit() && !now) DOCB.dirty = true;
  var go = function () {
    var d = docInit(); if (!d || d.getAttribute('contenteditable') !== 'true' || !DOCB.dirty) return;
    var n = task(d.dataset.id); if (!n) return;
    var html = docNow(d); DOCB.dirty = false;
    if (html === (n.memo || '')) { DOCB.base = html; return; }
    n.memo = html; DOCB.base = html; save();
    var st = document.getElementById('dts'); if (st) { var t = new Date(); st.textContent = '保存しました ' + t.getHours() + ':' + String(t.getMinutes()).padStart(2, '0'); }
  };
  if (now) go(); else { var st = document.getElementById('dts'); if (st) st.textContent = '編集中…'; _docT = setTimeout(go, 400); }
}
// 空のときやブロックの外に文字があるときは、段落（div）に入れてから書く
function docFix() {
  var d = docEl(); if (!d) return;
  try { document.execCommand('defaultParagraphSeparator', false, 'div'); } catch (er) {}
  var sel = getSelection(), caretNode = sel.rangeCount ? sel.anchorNode : null, caretOff = sel.rangeCount ? sel.anchorOffset : 0, changed = false;
  Array.prototype.slice.call(d.childNodes).forEach(function (c) {
    if (c.parentNode !== d) return;
    if (c.nodeType === 3 && c.textContent.length || (c.nodeType === 1 && /^(B|STRONG|I|EM|U|S|A|SPAN|BR)$/.test(c.tagName))) {
      changed = true; var w = document.createElement('div'); d.insertBefore(w, c); w.appendChild(c);
      while (w.nextSibling && (w.nextSibling.nodeType === 3 || /^(B|STRONG|I|EM|U|S|A|SPAN)$/.test(w.nextSibling.tagName || ''))) w.appendChild(w.nextSibling);
    }
  });
  if (!d.firstChild) { d.innerHTML = '<div><br></div>'; var r = document.createRange(); r.setStart(d.firstChild, 0); r.collapse(true); sel.removeAllRanges(); sel.addRange(r); return; }
  if (changed && caretNode && d.contains(caretNode)) { try { var r2 = document.createRange(); r2.setStart(caretNode, Math.min(caretOff, caretNode.nodeType === 3 ? caretNode.length : caretNode.childNodes.length)); r2.collapse(true); sel.removeAllRanges(); sel.addRange(r2); } catch (er) {} }
}
document.addEventListener('focusin', function (e) { if (e.target.id === 'fdoc' && e.target.getAttribute('contenteditable') === 'true') setTimeout(docFix, 0); });
document.addEventListener('input', function (e) { if (e.target.id === 'fdoc') docFix(); }, true);
function docLine(node) { // カーソルがある「行」の文字（リストなど別のブロックや改行は含めない）
  var BLK = /^(UL|OL|DIV|P|H2|H3|BLOCKQUOTE|HR|BR|LI)$/;
  if (node.nodeType === 1) return /^(LI|H2|H3|BLOCKQUOTE)$/.test(node.tagName) || !node.querySelector('ul,ol,div,h2,h3,blockquote,hr') ? node.textContent : '';
  var t = node.textContent, x = node.previousSibling;
  while (x && !(x.nodeType === 1 && BLK.test(x.tagName))) { t = x.textContent + t; x = x.previousSibling; }
  x = node.nextSibling; while (x && !(x.nodeType === 1 && BLK.test(x.tagName))) { t += x.textContent; x = x.nextSibling; }
  return t;
}
function docBlock() {
  var sel = getSelection(); if (!sel.rangeCount) return null; var d = docEl(); var n = sel.anchorNode;
  while (n && n !== d && !(n.nodeType === 1 && /^(P|DIV|H2|H3|LI|BLOCKQUOTE)$/.test(n.tagName))) n = n.parentNode;
  return n === d ? null : n;
}
function docCmd(k) {
  var d = docEl(); if (!d) return; if (document.activeElement !== d) d.focus();
  var ex = function (c, v) { document.execCommand(c, false, v || null); };
  if (k === 'h2' || k === 'h3' || k === 'p') ex('formatBlock', k === 'p' ? 'div' : k);
  else if (k === 'b') ex('bold'); else if (k === 'i') ex('italic'); else if (k === 's') ex('strikeThrough');
  else if (k === 'ul' || k === 'chk') {
    var b0 = docBlock(), inChk = b0 && b0.closest && b0.closest('ul.todo');
    if (k === 'chk' && inChk) { inChk.classList.remove('todo'); }
    else {
      var inUl = b0 && b0.closest && b0.closest('ul');
      if (inUl) { inUl.classList.toggle('todo', k === 'chk'); }
      else {
        ex('insertUnorderedList');
        var li = docBlock(); li = li && li.closest ? li.closest('li') : null; var ul = li && li.parentNode;
        if (ul && ul.tagName === 'UL') {
          if (ul.children.length > 1 && ul.classList.contains('todo') !== (k === 'chk')) { // 隣のリストとくっついたら分ける
            var nu = document.createElement('ul'), x = li; ul.parentNode.insertBefore(nu, ul.nextSibling);
            while (x) { var nx = x.nextSibling; nu.appendChild(x); x = nx; }
            var r = document.createRange(); r.selectNodeContents(li); r.collapse(false); var sl = getSelection(); sl.removeAllRanges(); sl.addRange(r); ul = nu;
          }
          ul.classList.toggle('todo', k === 'chk');
        }
      }
    }
  }
  else if (k === 'ol') ex('insertOrderedList');
  else if (k === 'q') ex('formatBlock', 'blockquote');
  else if (k === 'hr') ex('insertHorizontalRule');
  else if (k === 'a') {
    var sel = getSelection(), txt = String(sel), url = window.prompt('リンク先のURL', /^https?:\/\//.test(txt) ? txt : 'https://');
    if (url && /^(https?:|mailto:)/i.test(url)) { if (txt) ex('createLink', url); else ex('insertHTML', '<a href="' + esc(url) + '">' + esc(url) + '</a>&nbsp;'); }
  }
  docSave();
}
document.addEventListener('mousedown', function (e) { var b = e.target.closest && e.target.closest('[data-doc]'); if (b) e.preventDefault(); }, true);
document.addEventListener('click', function (e) {
  var b = e.target.closest && e.target.closest('[data-doc]'); if (b) { e.preventDefault(); docCmd(b.dataset.doc); return; }
  var d = docEl(); if (!d || !d.contains(e.target)) return;
  var li = e.target.closest('ul.todo > li');
  if (li && e.clientX - li.getBoundingClientRect().left < 24 && d.getAttribute('contenteditable') === 'true') { e.preventDefault(); li.toggleAttribute('data-done'); docSave(); return; }
  var a = e.target.closest('a[href]');
  if (a && d.getAttribute('contenteditable') === 'true') { e.preventDefault(); if (e.ctrlKey || e.metaKey) window.open(a.href, '_blank', 'noopener'); }
}, true);
document.addEventListener('input', function (e) { if (e.target.id === 'fdoc') docSave(); });
document.addEventListener('focusout', function (e) { if (e.target.id === 'fdoc') docSave(true); });
document.addEventListener('paste', function (e) {
  if (e.target.closest && e.target.closest('#fdoc')) { e.preventDefault(); var t = (e.clipboardData || window.clipboardData).getData('text/plain'); document.execCommand('insertText', false, t); }
});
document.addEventListener('keydown', function (e) {
  var d = docEl(); if (!d || e.target !== d) return;
  var mod = e.ctrlKey || e.metaKey;
  if (mod && e.key.toLowerCase() === 'k') { e.preventDefault(); docCmd('a'); return; }
  if (mod && e.key.toLowerCase() === 's') { e.preventDefault(); docSave(true); return; }
  if (e.key === 'Escape') { d.blur(); return; }
  if (e.key === 'Tab') { // リストの中は字下げ、それ以外は次へ
    var bl = docBlock(); if (bl && bl.tagName === 'LI') { e.preventDefault(); document.execCommand(e.shiftKey ? 'outdent' : 'indent'); docSave(); }
    return;
  }
  if (e.key === 'Enter' && !e.shiftKey && !e.isComposing && e.keyCode !== 229) { // 空の項目で Enter → リストを抜ける
    var lb = docBlock();
    if (lb && lb.tagName === 'LI' && !lb.textContent.trim()) { e.preventDefault(); var lst = lb.parentNode; if (lst.parentNode && lst.parentNode.tagName === 'LI') document.execCommand('outdent'); else document.execCommand(lst.tagName === 'OL' ? 'insertOrderedList' : 'insertUnorderedList'); docFix(); docSave(); return; }
  }
  if ((e.key === ' ' || e.key === 'Enter') && !e.isComposing && e.keyCode !== 229) {
    var sel = getSelection(); if (!sel.rangeCount || !sel.isCollapsed) return;
    var b = docBlock(), node = sel.anchorNode, off = sel.anchorOffset;
    var before = (node.nodeType === 3 ? node.textContent.slice(0, off) : '').replace(/ /g, ' ');
    var whole = docLine(node).replace(/\u00a0/g, ' ');
    if (whole.trim() !== before.trim()) return; // 行頭の記号だけのとき
    var mk = before.trim(), cmd = null;
    if (e.key === ' ') cmd = { '#': 'h2', '##': 'h3', '-': 'ul', '*': 'ul', '1.': 'ol', '[]': 'chk', '[ ]': 'chk', '>': 'q' }[mk];
    else if (mk === '---') cmd = 'hr';
    if (!cmd) return;
    e.preventDefault();
    if (node.nodeType === 3 && off > 0) { var r = document.createRange(); r.setStart(node, 0); r.setEnd(node, off); sel.removeAllRanges(); sel.addRange(r); document.execCommand('delete'); }
    docCmd(cmd);
  }
});
// ほかの画面でメモを出すときは、書式を外した文字にする


// ---------- ux39 期間未定のファイル・バーを1クリックで選んで編集 ----------
 // 新しいファイルは、期間を決めるまでは作った日だけ
(function () { var t = isoOf(TODAY), ch = false; allNodes().forEach(function (n) { if (n.nodate) { n.start = n.end = t; delete n.nodate; ch = true; } }); if (ch) save(); })(); // 期間未定だったものは今日だけに
// カード：期間未定の表示、メモは書式を外した文字で（編集はファイルを開いて）
// 編集ダイアログで日付を触ったら期間未定を外す
document.addEventListener('click', function (e) {
  var b = e.target.closest && e.target.closest('[data-act="wSave"]'); if (!b || !M || M.m !== 'edit') return;
  var n = task(M.id); if (!n || !n.nodate) return;
  var s0 = n.start, e0 = n.end, sI = document.getElementById('wS'), eI = document.getElementById('wE');
  var touched = (sI && sI.dataset.touched) || (eI && eI.dataset.touched);
  setTimeout(function () { if (touched || n.start !== s0 || n.end !== e0) { delete n.nodate; save(); render(); } }, 0);
}, true);
document.addEventListener('input', function (e) { if (e.target && (e.target.id === 'wS' || e.target.id === 'wE')) e.target.dataset.touched = '1'; }, true);

// ガント：期間未定の行は点線のバー（クリック＝その日から1週間、ドラッグ＝その範囲）
function ganttGeom() { var gg = document.querySelector('.gg'); return gg ? { px: +gg.dataset.px, lo: +gg.dataset.lo } : null; }
function decorateBars39() {
  var g = ganttGeom(); if (!g) return;
  document.querySelectorAll('.gg .bar[data-bar]').forEach(function (b) {
    var n = task(b.dataset.bar); if (!n) return;
    if (n.nodate && !isFolder(n)) {
      b.classList.add('nod'); var lb = b.querySelector('.lb'); if (lb) lb.textContent = b.classList.contains('lock') ? '期間未定' : 'クリックで期間を設定';
      var x = Math.round((TODAY - g.lo) / DAY * g.px); b.style.left = Math.max(0, x) + 'px'; b.style.width = Math.max(g.px * 7, 140) + 'px';
    }
    if (UI.gsel === n.id && !b.classList.contains('lock')) { b.classList.add('bsel'); if (!b.querySelector('.hdl')) b.insertAdjacentHTML('afterbegin', '<span class="hdl" data-hdl="1"></span>'); }
  });
  if (UI.gsel) bpopShow(); else bpopHide();
}
function bpopHide() { var p = document.getElementById('bpop'); if (p) p.remove(); }
function bpopShow() {
  var n = task(UI.gsel), b = n && document.querySelector('.gg .bar[data-bar="' + n.id + '"]');
  if (!n || !b || S.view !== 'projects' || S.fmode !== 'gantt') { bpopHide(); return; }
  var p = document.getElementById('bpop'); if (!p) { p = document.createElement('div'); p.id = 'bpop'; document.body.appendChild(p); }
  p.innerHTML = '<input type="date" id="bpS" value="' + (n.nodate ? '' : esc(n.start)) + '" aria-label="開始"><span class="sep">–</span><input type="date" id="bpE" value="' + (n.nodate ? '' : esc(n.end)) + '" aria-label="期限">' +
'<button class="bpx" data-bp="x" aria-label="閉じる" title="閉じる（Esc）">✕</button>';
  var r = b.getBoundingClientRect(), w = p.offsetWidth, gs = document.getElementById('gs'), gl = document.querySelector('.gg .ghead .gl');
  // 見えている時間軸の範囲に合わせて置く（バーが左右にはみ出していても、見えている部分の下に出す）
  var vl = (gl ? gl.getBoundingClientRect().right : 0) + 8, vr = gs ? gs.getBoundingClientRect().right - 8 : innerWidth - 8, vt = gs ? gs.getBoundingClientRect().top : 0, vb = gs ? gs.getBoundingClientRect().bottom : innerHeight;
  if (r.right < vl || r.left > vr || r.bottom < vt || r.top > vb) { p.style.display = 'none'; return; } p.style.display = '';
  var x0 = Math.max(r.left, vl);
  p.style.left = Math.max(vl, Math.min(x0, vr - w)) + 'px'; p.style.top = (r.bottom + 8 + p.offsetHeight > innerHeight ? r.top - p.offsetHeight - 8 : r.bottom + 8) + 'px';
}
function setPeriod(n, s, e) { if (!n) return; if (dayOf(e) < dayOf(s)) { var t = s; s = e; e = t; } snap(); n.start = s; n.end = e; delete n.nodate; save(); render(); }
document.addEventListener('change', function (e) {
  if (!e.target.closest || !e.target.closest('#bpop')) return;
  var n = task(UI.gsel); if (!n) return;
  var sv = document.getElementById('bpS').value, ev = document.getElementById('bpE').value;
  if (!sv && !ev) return; if (!sv) sv = ev; if (!ev) ev = sv;
  setPeriod(n, sv, ev);
});
document.addEventListener('click', function (e) {
  var b = e.target.closest && e.target.closest('[data-bp]'); if (!b) return;
  e.preventDefault(); e.stopImmediatePropagation();
  var n = task(UI.gsel);
  if (b.dataset.bp === 'x') { UI.gsel = null; render(); return; }

}, true);
// クリック＝選ぶ（動かさずに離したとき）／期間未定のバーはクリック・ドラッグで期間を作る
var bdn = null;
document.addEventListener('pointerdown', function (e) {
  if (e.button !== 0 || !e.target.closest) return;
  var bar = e.target.closest('.gg [data-bar]');
  if (!bar) { if (UI.gsel && !e.target.closest('#bpop')) { UI.gsel = null; bpopHide(); document.querySelectorAll('.bar.bsel').forEach(function (x) { x.classList.remove('bsel'); }); } return; }
  var n = task(bar.dataset.bar); if (!n) return;
  if (bar.classList.contains('lock')) { UI.gsel = null; bpopHide(); return; }
  if (n.nodate && !isFolder(n)) { // 自分で処理（既存のドラッグは使わない）
    e.preventDefault(); e.stopImmediatePropagation();
    var g = ganttGeom(), gt = bar.parentElement.getBoundingClientRect();
    var day = function (cx) { return g.lo + Math.floor((cx - gt.left) / g.px) * DAY; };
    bdn = { n: n, d0: day(e.clientX), x0: e.clientX, day: day, el: bar, g: g, nod: true };
    return;
  }
  if (e.target.dataset.hdl) { // 左端：開始日を変える
    e.preventDefault(); e.stopImmediatePropagation();
    bdn = { n: n, x0: e.clientX, el: bar, left: parseFloat(bar.style.left), width: parseFloat(bar.style.width), px: ganttGeom().px, start: true, dd: 0 };
    bar.setPointerCapture(e.pointerId); return;
  }
  bdn = { n: n, x0: e.clientX, y0: e.clientY, sel: true };
}, true);
document.addEventListener('pointermove', function (e) {
  if (!bdn) return;
  if (bdn.nod) {
    var a = bdn.d0, b = bdn.day(e.clientX), s0 = Math.min(a, b), e0 = Math.max(a, b);
    if (Math.abs(e.clientX - bdn.x0) > 4) { bdn.moved = true; bdn.el.classList.remove('nod'); bdn.el.style.left = Math.round((s0 - bdn.g.lo) / DAY * bdn.g.px) + 'px'; bdn.el.style.width = Math.round((e0 - s0) / DAY * bdn.g.px + bdn.g.px) + 'px'; var lb = bdn.el.querySelector('.lb'); if (lb) lb.textContent = shortDate(isoOf(s0)) + ' – ' + shortDate(isoOf(e0)); }
  } else if (bdn.start) {
    var dd = Math.round((e.clientX - bdn.x0) / bdn.px); dd = Math.min(dd, Math.round(bdn.width / bdn.px) - 1); bdn.dd = dd;
    bdn.el.style.left = (bdn.left + dd * bdn.px) + 'px'; bdn.el.style.width = (bdn.width - dd * bdn.px) + 'px';
  }
});
document.addEventListener('pointerup', function (e) {
  if (!bdn) return; var d = bdn; bdn = null;
  if (d.nod) {
    var a = d.d0, b = d.moved ? d.day(e.clientX) : d.d0 + 6 * DAY;
    UI.gsel = d.n.id; setPeriod(d.n, isoOf(Math.min(a, b)), isoOf(Math.max(a, b))); toast('期間を設定しました'); return;
  }
  if (d.start) { if (d.dd) { snap(); d.n.start = isoOf(dayOf(d.n.start) + d.dd * DAY); save(); } render(); return; }
  if (d.sel && Math.abs(e.clientX - d.x0) < 4 && Math.abs(e.clientY - d.y0) < 4) { setTimeout(function () { UI.gsel = d.n.id; render(); }, 0); }
  else if (d.sel) setTimeout(function () { if (UI.gsel === d.n.id) { decorateBars39(); } }, 0);
}, true);
// 選んだバーはキーで動かせる：←→ 1日ずらす、Shift+←→ 期限、Alt+←→ 開始、Delete 期間未定、Esc 解除
document.addEventListener('keydown', function (e) {
  if (!UI.gsel || S.view !== 'projects' || S.fmode !== 'gantt') return;
  if (e.target.closest && e.target.closest('input, textarea, select, [contenteditable="true"]')) { if (e.key === 'Escape' && e.target.closest('#bpop')) { UI.gsel = null; render(); } return; }
  var n = task(UI.gsel); if (!n || n.nodate) { if (e.key === 'Escape') { UI.gsel = null; render(); } return; }
  var k = e.key, step = k === 'ArrowRight' ? 1 : k === 'ArrowLeft' ? -1 : 0;
  if (k === 'Escape') { e.preventDefault(); UI.gsel = null; render(); return; }
  if (k === 'Delete' || k === 'Backspace') { e.preventDefault(); return; } // 期間未定はなくした（未設定はその日だけ）
  if (!step) return; e.preventDefault(); snap();
  var s0 = dayOf(n.start), e0 = dayOf(n.end);
  if (e.shiftKey) e0 = Math.max(s0, e0 + step * DAY); else if (e.altKey) s0 = Math.min(e0, s0 + step * DAY); else { s0 += step * DAY; e0 += step * DAY; }
  n.start = isoOf(s0); n.end = isoOf(e0); save(); render();
});
// 右クリック：期間未定に戻す
document.addEventListener('click', function (e) {
  var c = e.target.closest && e.target.closest('[data-cm4]'); if (!c) return;
  e.preventDefault(); e.stopImmediatePropagation(); var n = task(UI.cm); closeCM(); if (!n) return;
  snap(); n.nodate = true; save(); render(); toast('期間未定にしました');
}, true);
// 書いている最中のメモは、ほかの人の更新で画面を作り直さない（書き終わったら反映）
document.addEventListener('focusout', function (e) { if (e.target.id === 'fdoc' && UI.pendRender) { UI.pendRender = false; setTimeout(render, 0); } });


// ガントをスクロール・拡大縮小したら、選んだバーの日付入力欄もついていく
document.addEventListener('scroll', function (e) { if (UI.gsel && e.target && e.target.id === 'gs') bpopShow(); }, true);
window.addEventListener('resize', function () { if (UI.gsel) bpopShow(); });



// ---------- メモの共有：ほかの人の変更をその場で取り込む（段落ごとに合わせる） ----------
function docBlocks(html) { var t = document.createElement('div'); t.innerHTML = html || ''; var out = []; [].forEach.call(t.childNodes, function (c) { var h = c.nodeType === 1 ? c.outerHTML : c.nodeType === 3 ? esc(c.textContent) : ''; if (h) out.push(h); }); return out; }
function docMatch(a, b) { // 共通部分（LCS）：a[i] と b[j] の組
  var n = a.length, m = b.length, L = []; for (var i = 0; i <= n; i++) { L.push(new Array(m + 1).fill(0)); }
  for (i = n - 1; i >= 0; i--) for (var j = m - 1; j >= 0; j--) L[i][j] = a[i] === b[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
  var r = {}; i = 0; j = 0; while (i < n && j < m) { if (a[i] === b[j]) { r[i] = j; i++; j++; } else if (L[i + 1][j] >= L[i][j + 1]) i++; else j++; } return r;
}
function docMerge(base, mine, theirs) { // 3者マージ：片方だけが変えた段落はその変更を、両方が変えた段落は両方残す
  var B = docBlocks(base), A = docBlocks(mine), C = docBlocks(theirs), ma = docMatch(B, A), mc = docMatch(B, C), out = [], ia = 0, ic2 = 0, last = -1;
  var flush = function (bEnd, aEnd, cEnd) {
    var b = B.slice(last + 1, bEnd), a = A.slice(ia, aEnd), c = C.slice(ic2, cEnd), J = function (x) { return x.join(''); };
    if (J(a) === J(b)) out = out.concat(c); else if (J(c) === J(b) || J(a) === J(c)) out = out.concat(a);
    else if (a.length === b.length && c.length === b.length) b.forEach(function (x, i) { out = out.concat(a[i] === x ? [c[i]] : c[i] === x || c[i] === a[i] ? [a[i]] : [a[i], c[i]]); }); // 同じ段落数なら段落ごとに
    else out = out.concat(a, c);
  };
  for (var k = 0; k < B.length; k++) { if (ma[k] == null || mc[k] == null) continue; flush(k, ma[k], mc[k]); out.push(B[k]); last = k; ia = ma[k] + 1; ic2 = mc[k] + 1; }
  flush(B.length, A.length, C.length);
  return out.join('');
}
function docSet(d, html) { // 書いている場所（段落と文字の位置）を保ったまま入れ替える
  var sel = getSelection(), keep = null;
  if (document.activeElement === d && sel.rangeCount && d.contains(sel.anchorNode)) {
    var blk = sel.anchorNode; while (blk && blk.parentNode !== d) blk = blk.parentNode;
    if (blk) { var r = document.createRange(); r.setStart(blk, 0); r.setEnd(sel.anchorNode, sel.anchorOffset); keep = { h: blk.nodeType === 1 ? blk.outerHTML : blk.textContent, i: [].indexOf.call(d.childNodes, blk), off: r.toString().length }; }
  }
  d.innerHTML = html; if (!keep) return;
  var kids = [].slice.call(d.childNodes), best = null, bd = 1e9;
  kids.forEach(function (c, i) { var h = c.nodeType === 1 ? c.outerHTML : c.textContent; if (h === keep.h && Math.abs(i - keep.i) < bd) { best = c; bd = Math.abs(i - keep.i); } });
  if (!best) best = kids[Math.min(keep.i, kids.length - 1)]; if (!best) return;
  var w = document.createTreeWalker(best, NodeFilter.SHOW_TEXT), left = keep.off, tn, rr = document.createRange(), done = false;
  while ((tn = w.nextNode())) { if (left <= tn.length) { rr.setStart(tn, left); done = true; break; } left -= tn.length; }
  if (!done) { rr.selectNodeContents(best); rr.collapse(false); } else rr.collapse(true);
  sel.removeAllRanges(); sel.addRange(rr);
}
window.__docRemote = function () {
  var d = docInit(); if (!d) return; var n = task(d.dataset.id); if (!n) return;
  var R = n.memo || ''; if (R === DOCB.base) return;
  if (!DOCB.dirty) { docSet(d, docHTML(R)); DOCB.base = R; return; }
  var L = docNow(d), mg = docMerge(DOCB.base, L, R); DOCB.base = R; docSet(d, docHTML(mg)); docSave();
};
window.__docMerge = docMerge;
