// ---------- お知らせ：部員ホームの一番上に出す（同時に1件。期限が来たら元の「NEXT」に戻る） ----------
function annsInit() { if (!S.anns) S.anns = []; return S.anns; }
function annLive(a) { return a && a.until >= isoOf(TODAY); }
function annActive() { return annsInit().filter(annLive).sort(function (a, b) { return a.at < b.at ? 1 : -1; })[0] || null; }
function annIn(days) { return isoOf(TODAY + (days || 7) * DAY); }
// 中止のときの文面（編集できる）
function annCancelText(c) {
  return { title: '「' + (c.title || 'イベント') + '」は中止になりました', body: (c.date ? pmd(c.date) + (c.to ? ' – ' + pmd(c.to) : '') + 'に予定していた' : '予定していた') + '「' + (c.title || 'イベント') + '」は中止になりました。', until: annIn(7) };
}
// 入力欄（中止の確認・お知らせの編集で共通）
function annFields(a, sw) {
  return '<div class="annf">' + (sw ? '<label class="opt annsw"><span class="ot">ホームにお知らせを出す</span><input type="checkbox" class="tsw" id="annOn" checked></label>' : '') +
    '<div class="annb"><div class="fld"><label for="anT">見出し</label><input id="anT" class="input" value="' + esc(a.title || '') + '" autocomplete="off"></div>' +
    '<div class="fld"><label for="anB">本文</label><textarea id="anB" class="input" rows="3">' + esc(a.body || '') + '</textarea></div>' +
    '<div class="fld anu"><label for="anU">掲載期限</label><input id="anU" class="input" type="date" value="' + esc(a.until || annIn(7)) + '"></div></div></div>';
}
function annRead() { var t = document.getElementById('anT'); if (!t) return null; var on = document.getElementById('annOn'); if (on && !on.checked) return null; return { title: t.value.trim(), body: document.getElementById('anB').value.trim(), until: document.getElementById('anU').value || annIn(7) }; }
function annPost(v, cid) { if (!v || !v.title) return false; annsInit().push({ id: uid('an'), title: v.title, body: v.body, until: v.until, at: new Date().toISOString(), cid: cid || '' }); return true; }
document.addEventListener('change', function (e) { if (e.target.id === 'annOn') { var b = document.querySelector('.annb'); if (b) b.classList.toggle('off', !e.target.checked); } });

// 告知タブ「お知らせ」
function viewAnns() {
  var L = annsInit().slice().sort(function (a, b) { return a.at < b.at ? 1 : -1; }), act = annActive();
  if (!L.length) return '<div class="empty big">お知らせはまだありません</div>';
  return '<div class="evl anl"><div class="evr evh"><span>お知らせ</span><span>出した日</span><span>掲載期限</span><span class="tdc">状態</span><span></span></div>' + L.map(function (a) {
    var st = a === act ? '<span class="pubc on nsw">掲載中</span>' : annLive(a) ? '<span class="pubc nsw" title="新しいお知らせが出ているため表示されていません">待機</span>' : '<span class="pubc end nsw">終了</span>';
    return '<div class="evr' + (annLive(a) ? '' : ' past') + '" data-anid="' + a.id + '"><span class="evn"><b>' + esc(a.title) + '</b>' + (a.body ? '<span>' + esc(a.body) + '</span>' : '') + '</span>' +
      '<span class="evq num">' + pmd(a.at.slice(0, 10)) + '</span><span class="evq num">' + pmd(a.until) + '</span>' + st +
      '<span class="evact"><button class="ib" data-act="annEdit" data-id="' + a.id + '" aria-label="編集" title="編集">' + PEN + '</button><button class="rmore" type="button" tabindex="-1" aria-label="その他" title="その他">' + ic('more') + '</button></span></div>';
  }).join('') + '</div>';
}
function annDlg() {
  var a = M.id ? annsInit().filter(function (x) { return x.id === M.id; })[0] : null;
  return dlg(a ? 'お知らせを編集' : 'お知らせを出す', annFields(a || { until: annIn(7) }, false) + '<p class="dlgp sm">部員のホームの一番上に、掲載期限まで出ます。</p>',
    (a ? '<button class="btn ghost mdanger" data-act="annDel" data-id="' + a.id + '">削除</button><span class="sp"></span>' : '') + '<button class="btn" data-act="close">やめる</button><button class="btn primary" data-act="annSave">' + (a ? '保存' : '出す') + '</button>');
}
document.addEventListener('click', function (e) {
  var b = e.target.closest && e.target.closest('[data-act="annNew"],[data-act="annEdit"],[data-act="annSave"],[data-act="annDel"]'); if (!b) return;
  e.preventDefault(); e.stopImmediatePropagation(); var a = b.dataset.act;
  if (!can('notices')) { toast('告知の権限が必要です'); return; }
  if (a === 'annNew') { M = { m: 'ann' }; renderModal(); return; }
  if (a === 'annEdit') { M = { m: 'ann', id: b.dataset.id }; renderModal(); return; }
  if (a === 'annDel') { snap(); S.anns = annsInit().filter(function (x) { return x.id !== b.dataset.id; }); M = null; renderModal(); save(); render(); toastUndo('お知らせを削除しました'); return; }
  var v = annRead(); if (!v || !v.title) { toast('見出しを入れてください'); return; }
  snap();
  if (M.id) { var x = annsInit().filter(function (y) { return y.id === M.id; })[0]; if (x) { x.title = v.title; x.body = v.body; x.until = v.until; } }
  else annPost(v);
  var was = M.id; M = null; renderModal(); save(); render(); toast(was ? '保存しました' : 'お知らせを出しました');
}, true);
window.addEventListener('contextmenu', function (e) {
  if (S.view !== 'notices' || !e.target.closest) return; var r = e.target.closest('.evr[data-anid]'); if (!r) return;
  e.preventDefault(); e.stopImmediatePropagation(); var id = r.dataset.anid, ok = can('notices');
  openMenu('お知らせ', [['編集', function () { M = { m: 'ann', id: id }; renderModal(); }, false, ok ? '' : '告知の権限が必要'],
    ['今すぐ下げる', function () { var x = annsInit().filter(function (y) { return y.id === id; })[0]; if (!x) return; snap(); x.until = isoOf(TODAY - DAY); save(); render(); toast('ホームから下げました'); }, false, ok ? '' : '告知の権限が必要'],
    'sep', ['削除', function () { snap(); S.anns = annsInit().filter(function (x) { return x.id !== id; }); save(); render(); toastUndo('お知らせを削除しました'); }, true, ok ? '' : '告知の権限が必要']], e.clientX, e.clientY);
}, true);

// 公開中のイベントを業務・教材で消したとき：中止するか聞く（お知らせの文面を入れて）
function evAskAfterDel(cids) {
  var t = isoOf(TODAY), c = cids.map(evCal).filter(function (x) { return x && x.state === 'pub' && (x.to || x.date || t) >= t; })[0];
  if (!c || !can('notices')) return;
  setTimeout(function () { M = { m: 'pub', id: c.id, del: 1 }; renderModal(); }, 0);
}
function evCidsIn(n) { return nodesOf(n).filter(function (x) { return isEvent(x) && x.ev; }).map(function (x) { return x.ev; }); }
