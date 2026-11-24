// ---------- ux36 どこで何をしても想定どおり：キーボード・右クリックの総点検 ----------
// 共通の右クリックメニュー（業務以外の画面用）。items: [[label, fn, danger?] | 'sep']
function openMenu(title, items, x, y) {
  closeCM();
  var m = document.createElement('div'); m.id = 'cm'; m.className = 'cm'; m.setAttribute('role', 'menu'); document.body.appendChild(m);
  UI.cmFns = [];
  m.innerHTML = (title ? '<div class="cmh"><span>' + esc(title) + '</span></div>' : '') + items.map(function (it) {
    if (it === 'sep') return '<i class="cmsep"></i>';
    if (it[3]) return '<button role="menuitem" disabled aria-disabled="true" class="cmoff" title="' + esc(it[3]) + '">' + esc(it[0]) + '<span class="cmk">' + esc(it[3]) + '</span></button>';
    UI.cmFns.push(it[1]); return '<button role="menuitem" data-gcm="' + (UI.cmFns.length - 1) + '"' + (it[2] ? ' class="cmdel"' : '') + '>' + esc(it[0]) + '</button>';
  }).join('');
  var w = m.offsetWidth, h = m.offsetHeight;
  m.style.left = Math.max(8, Math.min(x, innerWidth - w - 8)) + 'px'; m.style.top = Math.max(8, Math.min(y, innerHeight - h - 8)) + 'px';
}
document.addEventListener('click', function (e) {
  var c = e.target.closest && e.target.closest('[data-gcm]'); if (!c) return;
  e.stopImmediatePropagation(); e.preventDefault();
  var fn = (UI.cmFns || [])[+c.dataset.gcm]; closeCM(); if (fn) fn();
}, true);
function clickAct(sel) { var b = document.querySelector(sel); if (b) b.click(); }
// 右クリック：告知・掲示板・メンバー・教材の余白
document.addEventListener('contextmenu', function (e) {
  if (!e.target.closest || e.defaultPrevented) return;
  if (e.target.closest('input, textarea, select, [contenteditable="true"], a[href], .cm, #modal, .dlg')) return;
  if (window.getSelection && String(window.getSelection())) return; // 文字を選んでいるときは標準のメニュー（コピー用）
  var x = e.clientX, y = e.clientY, it = null, title = '';
  if (S.view === 'notices' && (S.ntab || 'list') === 'list') {
    var r = e.target.closest('.nr[data-nid]');
    if (r) { var n = notice(r.dataset.nid); if (!n) return; title = n.title;
      it = [['編集', function () { M = { m: 'notice', id: n.id }; renderModal(); }],
            [n.state === 'pub' ? '非公開にする' : '公開する', function () { n.state = n.state === 'pub' ? 'draft' : 'pub'; save(); render(); }],
            ['複製', function () { snap(); var c = JSON.parse(JSON.stringify(n)); c.id = uid('n'); c.title = n.title + '（コピー）'; c.state = 'draft'; S.notices.splice(S.notices.indexOf(n) + 1, 0, c); save(); render(); toast('下書きで複製しました'); }],
            'sep', ['削除', function () { snap(); S.notices = S.notices.filter(function (z) { return z !== n; }); save(); render(); toastUndo('「' + n.title + '」を削除しました'); }, true]];
    } else if (e.target.closest('#view .body') && can('notices')) it = [['新しい告知', function () { M = { m: 'notice' }; renderModal(); }]];
  } else if (S.view === 'board') {
    var tr = e.target.closest('#view tbody tr'), bt = tr && tr.querySelector('[data-id]');
    if (bt) { var pid = bt.dataset.id, post = S.posts.filter(function (z) { return z.id === pid; })[0]; if (!post) return; title = post.text;
      it = [];
      if (post.state === 'ok') { if (post.reports > 0) it.push(['問題なし（通報を消す）', function () { clickAct('[data-act="pOk"][data-id="' + pid + '"]'); }]); it.push(['非表示にする', function () { clickAct('[data-act="pHide"][data-id="' + pid + '"]'); }]); it.push('sep'); it.push(['削除', function () { clickAct('[data-act="pDelNow"][data-id="' + pid + '"]'); }, true]); }
      else it.push(['表示に戻す', function () { clickAct('[data-act="pShow"][data-id="' + pid + '"]'); }]);
    }
  } else if (S.view === 'perms') {
    var mr = e.target.closest('#view tbody tr'), mb = mr && mr.querySelector('.mname[data-id]');
    if (mb) { var mm = member(mb.dataset.id); title = mm ? mm.name : '';
      it = [['詳細を開く', function () { mb.click(); }], ['役職を変える', function () { var sel = mr.querySelector('select.mpost'); if (sel && !sel.disabled) { sel.focus(); if (sel.showPicker) try { sel.showPicker(); } catch (er) {} } else toast('自分の役職は変更できません'); }]];
    }
  } else if (S.view === 'tracks' && can('tracks')) {
    if (!e.target.closest('.tki[data-id], #units .ur[data-code], #map [data-code]') && e.target.closest('#view')) {
      var t = typeof track === 'function' ? track() : null;
      it = [['新しいトラック', function () { clickAct('[data-act="newTrack"]'); }]];
      if (t) { it.push(['単元を追加', function () { var g = document.querySelector('#units .cell[data-u="newcode"], #units .cell[data-u="new"]'); if (!g) { UI.tv = 'table'; render(); g = document.querySelector('#units .cell[data-u="newcode"], #units .cell[data-u="new"]'); } if (g) g.focus(); }]);
        it.push('sep'); it.push(['このトラックを削除', function () { delTrack(t.id); }, true]); }
      title = t ? t.name : '教材';
    }
  }
  if (!it || !it.length) return;
  e.preventDefault(); if (typeof closePop === 'function') closePop(); openMenu(title, it, x, y);
});
function confirmOnce(k) { var now = Date.now(); if (UI.cfm && UI.cfm.k === k && now - UI.cfm.t < 4000) { UI.cfm = null; return true; } UI.cfm = { k: k, t: now }; return false; }

// 右クリックメニューのキーボード操作：開いたら先頭にフォーカス、↑↓で移動、Esc で閉じて元へ戻る
var _cmFocusBack = null;
new MutationObserver(function () {
  var m = document.getElementById('cm');
  if (m && !m.dataset.kb) { m.dataset.kb = '1'; if (!_cmFocusBack) _cmFocusBack = document.activeElement; var f = m.querySelector('button'); if (f && UI.kbMenu) f.focus(); UI.kbMenu = false; }
  if (!m && _cmFocusBack) { var b = _cmFocusBack; _cmFocusBack = null; if (b && document.contains(b) && UI.kbBack) b.focus(); UI.kbBack = false; }
}).observe(document.body, { childList: true });
document.addEventListener('keydown', function (e) {
  var m = document.getElementById('cm'); if (!m) return;
  var bs = Array.prototype.slice.call(m.querySelectorAll('button:not([disabled])')), i = bs.indexOf(document.activeElement); if (!bs.length) return;
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); e.stopImmediatePropagation(); var j = i < 0 ? (e.key === 'ArrowDown' ? 0 : bs.length - 1) : (i + (e.key === 'ArrowDown' ? 1 : -1) + bs.length) % bs.length; bs[j].focus(); }
  else if (e.key === 'Home' || e.key === 'End') { e.preventDefault(); bs[e.key === 'Home' ? 0 : bs.length - 1].focus(); }
  else if (e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); UI.kbBack = true; closeCM(); }
  else if (e.key === 'Tab') { e.preventDefault(); UI.kbBack = true; closeCM(); }
}, true);
// Shift+F10 / メニューキー：フォーカス中のものに右クリックメニューを出す
document.addEventListener('keydown', function (e) {
  if (!((e.shiftKey && e.key === 'F10') || e.key === 'ContextMenu')) return;
  var el = document.activeElement; if (!el || el === document.body || el.closest('input, textarea, select')) return;
  var r = el.getBoundingClientRect(); e.preventDefault(); UI.kbMenu = true;
  el.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: r.left + Math.min(24, r.width / 2), clientY: r.bottom - 4, button: 2 }));
});
// メニュー・ポップアップは、スクロール・画面サイズ変更・別ウィンドウへ移ったら閉じる
['resize', 'blur'].forEach(function (ev) { window.addEventListener(ev, function () { closeCM(); }); });
document.addEventListener('wheel', function (e) { if (!(e.target.closest && e.target.closest('.cm'))) closeCM(); }, { passive: true });
// Esc で開いているものを全部閉じる（期間ポップアップなど）
document.addEventListener('keydown', function (e) {
  if (e.key !== 'Escape') return;
  var pp = document.getElementById('perpop'); if (pp) { pp.remove(); e.preventDefault(); }
});

// ダイアログ：開いたら最初の入力欄へ、Tab はダイアログの中だけで回る、閉じたら開く前の場所へ戻る
var _dlgBack = null;
function dlgRoot() { var d = document.querySelector('#modal .dlg, #cpov .dlg, .ov .dlg'); return d && d.getClientRects().length ? d : null; }
new MutationObserver(function () {
  var d = dlgRoot();
  if (d && !d.dataset.kb) {
    d.dataset.kb = '1'; if (!_dlgBack) _dlgBack = document.activeElement;
    if (!d.contains(document.activeElement)) { var f = d.querySelector('.c input:not([type=hidden]):not([disabled]), .c textarea, .c select, .c button, .f .btn.primary'); if (f) f.focus(); }
  }
  if (!d && _dlgBack) { var b = _dlgBack, key = _dlgKey; _dlgBack = null; _dlgKey = null;
    if (!(b && document.contains(b)) && key) b = document.querySelector(key);
    if (b && document.contains(b) && b !== document.body) try { b.focus({ preventScroll: true }); } catch (er) {} }
}).observe(document.body, { childList: true, subtree: true });
var _dlgKey = null;
document.addEventListener('focusin', function (e) { var t = e.target; if (dlgRoot() || !t.dataset) return; _dlgKey = t.dataset.act ? '[data-act="' + t.dataset.act + '"]' + (t.dataset.id ? '[data-id="' + t.dataset.id + '"]' : '') : (t.id ? '#' + t.id : null); });
document.addEventListener('keydown', function (e) {
  if (e.key !== 'Tab') return; var d = dlgRoot(); if (!d) return;
  var fs = Array.prototype.slice.call(d.querySelectorAll('button, input, select, textarea, a[href], [tabindex]:not([tabindex="-1"])')).filter(function (x) { return !x.disabled && x.getClientRects().length && getComputedStyle(x).visibility !== 'hidden'; });
  if (!fs.length) return;
  var i = fs.indexOf(document.activeElement);
  if (i < 0) { e.preventDefault(); fs[0].focus(); return; }
  if (!e.shiftKey && i === fs.length - 1) { e.preventDefault(); fs[0].focus(); }
  else if (e.shiftKey && i === 0) { e.preventDefault(); fs[fs.length - 1].focus(); }
}, true);

// クリックできるのにキーボードで届かないもの（パッチノートの行・その場で編集する文字）を Tab で選べるように
function kbDecorate() {
  document.querySelectorAll('.pnr[data-act], .ied, [data-act]:not(button):not(a):not(input):not(select):not(textarea):not([tabindex])').forEach(function (el) {
    if (el.closest('.cm') || el.tagName === 'OPTION' || el.tagName === 'SVG' || el.tagName === 'svg') return;
    if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '0');
    if (!el.hasAttribute('role') && !el.classList.contains('ied')) el.setAttribute('role', 'button');
  });
}
document.addEventListener('keydown', function (e) {
  if (e.key !== 'Enter' && e.key !== ' ') return;
  var el = e.target; if (!el || !el.matches || el.isContentEditable) return;
  if (el.matches('[data-act][tabindex]:not(button):not(a):not(input):not(select):not(textarea), .ied[tabindex]')) { e.preventDefault(); el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true })); }
});


// ---------- ux37 フォルダーツリーの余白で右クリック：フォルダー追加など（ツリー専用のメニュー） ----------
document.addEventListener('contextmenu', function (e) {
  if (S.view !== 'projects' || !e.target.closest) return;
  var tr = e.target.closest('.ftree'); if (!tr || e.target.closest('.ftn[data-id], input, textarea, .cm')) return;
  e.preventDefault(); e.stopImmediatePropagation();
  var f = curFolder(), it = [];
  var mk = function (par) { snap(); var k = addFolder(par, '新しいフォルダー'); save(); render(); editNew(k); };
  it.push(['新しいフォルダー（一番上）', function () { mk(null); }, false, isAdmin() ? '' : '代表のみ']);
  if (f) it.push(['「' + ttl(f).slice(0, 12) + '」に新しいフォルダー', function () { mk(f); }, false, manages(f) ? '' : 'リーダーのみ']);
  if (f && canPasteInto(f)) it.push(['「' + ttl(clipNode()).slice(0, 12) + '」を貼り付け', function () { pasteInto(f); }]);
  it.push('sep');
  it.push(['開いている場所以外を閉じる', function () { UI.fopen = {}; render(); }]);
  it.push(['ツリーを隠す', function () { S.ftreeC = true; save(); render(); }]);
  if (typeof closePop === 'function') closePop();
  openMenu('フォルダー', it, e.clientX, e.clientY);
}, true);


