// ---------- ux47 告知（イベント・カレンダー）でも右クリック ----------
document.addEventListener('contextmenu', function (e) {
  if (S.view !== 'notices' || !e.target.closest || e.defaultPrevented) return;
  if (e.target.closest('input, textarea, select, a[href], .cm, #modal, .dlg, .nav, .side')) return;
  var fire = function (el) { return function () { if (el) el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true })); }; };
  var it = [], title = '';
  var row = e.target.closest('.evr[data-evid]'), chip = e.target.closest('.cchip[data-act="calItem"]'), day = e.target.closest('.cd[data-act="calDay"]');
  if (row) { title = (row.querySelector('.evn b') || {}).textContent || 'イベント'; var ed = row.querySelector('[data-act="evEdit"]'), pb = row.querySelector('[data-act="evPub"]');
    if (ed) it.push([ed.title || '告知を編集', fire(ed)]);
    if (pb) it.push([pb.getAttribute('aria-checked') === 'true' ? '部員に非公開にする' : '部員に公開する', fire(pb), false, pb.disabled ? 'リーダーのみ' : '']); }
  else if (chip) { title = chip.textContent; it.push(['開く', fire(chip)]); if (day) it.push(['この日に予定を追加', fire(day)]); }
  else if (day) { title = day.getAttribute('aria-label') || ''; it.push(['この日に予定を追加', fire(day)], ['前の月', fire(document.querySelector('[data-act="calMv"][data-v="-1"]'))], ['次の月', fire(document.querySelector('[data-act="calMv"][data-v="1"]'))]); }
  if (!it.length) { var fab = document.querySelector('.efab'); if (fab) it.push([fab.getAttribute('aria-label') || '追加', fire(fab)]);
    Array.prototype.forEach.call(document.querySelectorAll('.utabs .utab'), function (b) { it.push([b.textContent.trim() + 'を表示', fire(b)]); }); title = '告知'; }
  if (!it.length) return; e.preventDefault(); e.stopImmediatePropagation(); openMenu(title, it, e.clientX, e.clientY);
}, true);

// ---------- ux48 どこで右クリックしても：押せるものの上なら「開く」、ほかは画面の移動 ----------
document.addEventListener('contextmenu', function (e) {
  if (e.defaultPrevented || !e.target.closest) return;
  if (e.target.closest('input, textarea, select, a[href], [contenteditable="true"], .cm, #modal, .dlg')) return;
  var c = e.target.closest('button:not([disabled]), [data-act], [role="button"], [role="switch"], .card[data-id]');
  var lab = function (el) { var t = (el.getAttribute('aria-label') || el.title || el.textContent || '').replace(/\s+/g, ' ').trim(); return t.length > 24 ? t.slice(0, 24) + '…' : t; };
  var it = [];
  if (c) it.push([c.getAttribute('role') === 'switch' ? '切り替える' : '開く', function () { c.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true })); }]);
  var go = Array.prototype.filter.call(document.querySelectorAll('.side .nav [data-act="go"], .nav [data-act="go"]'), function (b) { return b.getClientRects().length && b.dataset.view !== S.view; });
  if (go.length) { if (it.length) it.push('sep'); go.slice(0, 7).forEach(function (b) { it.push([lab(b) + 'へ', function () { b.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true })); }]); }); }
  if (!it.length) return;
  e.preventDefault(); openMenu(c ? lab(c) : '', it, e.clientX, e.clientY);
});

// ---------- ux49 教材の右：部員の「プログラム」での見え方（選んでいる項目を強調、クリックで選ぶ） ----------

// ---------- ux50 右の部員画面＝本物の部員アプリ（学ぶタブ）を読み込む。ツリーと部員画面は畳める ----------
var P2UI = (function () { try { return JSON.parse(localStorage.getItem('slope-p2ui') || '{}'); } catch (e) { return {}; } })();
function p2UiSave() { try { localStorage.setItem('slope-p2ui', JSON.stringify(P2UI)); } catch (e) {} }
var CLL = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 6l-6 6 6 6"/></svg>', CLR = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>';
document.addEventListener('click', function (e) {
  var b = e.target.closest && e.target.closest('[data-p2ui]'); if (!b) return; e.preventDefault(); e.stopImmediatePropagation();
  if (b.dataset.p2ui === 'tree') P2UI.noTree = !P2UI.noTree; else P2UI.noPv = !P2UI.noPv; p2UiSave(); render(); p2Frame();
}, true);
var P2F = null;
function p2Frame() {
  var slot = S.view === 'tracks' && document.getElementById('p2pvslot'), vis = slot && slot.getClientRects().length && slot.offsetWidth > 0;
  if (!P2F) {
    if (!vis) return;
    P2F = document.createElement('div'); P2F.id = 'p2pvf'; P2F.className = 'p2pv';
    P2F.innerHTML = '<div class="pvbar"><span>部員の画面<b>学ぶ</b></span><span class="pvbtns"><button data-p2pv="reload" title="読み込み直す" aria-label="読み込み直す"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 12a8 8 0 1 1-2.3-5.7M20 4v5h-5"/></svg></button><button data-p2ui="pv" title="畳む" aria-label="部員の画面を畳む">' + CLR + '</button></span></div><iframe title="部員の画面（学ぶ）" src="index.html?embed=1&tab=learn"></iframe>';
    document.body.appendChild(P2F);
  }
  if (!vis) { P2F.style.display = 'none'; return; }
  var r = slot.getBoundingClientRect(); P2F.style.display = ''; P2F.style.left = r.left + 'px'; P2F.style.top = r.top + 'px'; P2F.style.width = r.width + 'px'; P2F.style.height = r.height + 'px';
}
function p2FrameReload() { var f = P2F && P2F.querySelector('iframe'); if (f) { try { f.contentWindow.location.reload(); } catch (x) { f.src = f.src; } } }
window.addEventListener('resize', p2Frame);
document.addEventListener('scroll', function () { if (P2F && P2F.style.display !== 'none') p2Frame(); }, true);
document.addEventListener('click', function (e) { var b = e.target.closest && e.target.closest('[data-p2pv]'); if (!b) return; e.preventDefault(); p2FrameReload(); }, true);
// 教材を変えたら、少し待って部員の画面を読み込み直す（本番はデータベースへの保存を待つ）
var P2RT = null;

