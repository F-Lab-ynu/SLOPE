// ---------- ux24 告知：右下の＋とポップアップで作る・編集する ----------
var NROLES = ['Innovator', 'Strategist', 'Negotiator', 'Advertiser', 'Engineer'];
var PEN = '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M14 6l4 4"/></svg>';
function noticeDlg() {
  var n = M.id ? notice(M.id) : null, d = n || { type: 'その他', title: '', host: '', due: isoOf(TODAY + 14 * DAY), url: '', memo: '', roles: [] };
  var rs = d.roles || [], host = d.host === '—' ? '' : (d.host || ''), url = d.url === 'https://example.com' ? '' : (d.url || '');
  var body =
    '<div class="fld"><label for="nT">タイトル</label><input id="nT" class="input" value="' + esc(d.title) + '" autocomplete="off"></div>' +
    '<div class="two"><div class="fld"><label for="nY">種類</label><select id="nY" class="input">' + NTYPES.map(function (t) { return '<option' + (t === d.type ? ' selected' : '') + '>' + t + '</option>'; }).join('') + '</select></div>' +
    '<div class="fld"><label for="nD">締切</label><input id="nD" type="date" class="input" value="' + esc(d.due) + '"></div></div>' +
    '<div class="two"><div class="fld"><label for="nH">主催</label><input id="nH" class="input" value="' + esc(host) + '" autocomplete="off"></div>' +
    '<div class="fld"><label for="nU">URL</label><input id="nU" type="url" class="input" placeholder="https://" value="' + esc(url) + '" autocomplete="off"></div></div>' +
    '<div class="fld"><label>対象</label><div class="rchips">' + NROLES.map(function (r) { return '<label class="rchip"><input type="checkbox" class="nR" value="' + r + '"' + (rs.indexOf(r) >= 0 ? ' checked' : '') + '>' + r + '</label>'; }).join('') + '</div><span class="hint">選ばなければ全員向け</span></div>' +
    '<div class="fld"><label for="nM">詳細</label><textarea id="nM" class="input">' + esc(d.memo || '') + '</textarea></div>';
  var foot = n
    ? '<button class="btn ghost" data-act="nDel24" data-id="' + n.id + '" style="margin-right:auto;color:var(--red,#DC2626)">削除</button><button class="btn" data-act="close">キャンセル</button><button class="btn primary" data-act="nSave24">保存</button>'
    : '<button class="btn" data-act="close">キャンセル</button><button class="btn" data-act="nSave24" data-s="draft">下書き保存</button><button class="btn primary" data-act="nSave24" data-s="pub">公開</button>';
  return '<div class="ndlg">' + dlg(n ? '告知を編集' : '新しい告知', body, foot, true) + '</div>';
}
function fabHTML() { // 右下の＋（告知のイベント・カレンダー・外部）
  if (S.view !== 'notices' || !can('notices')) return '';
  var plus = '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>';
  if (S.ntab === 'cal' || S.ntab === 'ev') return '<div class="efabw"><button class="efab" data-act="calNew" title="予定を追加" aria-label="予定を追加">' + plus + '</button></div>';
  if (S.ntab === 'list') return '<div class="efabw"><button class="efab" data-act="nNew" title="告知を追加" aria-label="告知を追加">' + plus + '</button></div>';
  return '';
}
document.addEventListener('click', function (e) {
  var b = e.target.closest && e.target.closest('[data-act="nNew"],[data-act="nEdit"],[data-act="nSave24"],[data-act="nDel24"]'); if (!b) return;
  e.stopImmediatePropagation(); e.preventDefault();
  var a = b.dataset.act, v = function (id) { var x = document.getElementById(id); return x ? x.value.trim() : ''; };
  if (a === 'nNew') { M = { m: 'notice' }; renderModal(); return; }
  if (a === 'nEdit') { M = { m: 'notice', id: b.dataset.id }; renderModal(); return; }
  if (a === 'nDel24') { var n0 = notice(b.dataset.id); if (!n0) return; snap(); S.notices = S.notices.filter(function (x) { return x !== n0; }); M = null; save(); render(); toastUndo('「' + n0.title + '」を削除しました'); return; }
  if (!v('nT')) { toast('タイトルを入れてください'); document.getElementById('nT').focus(); return; }
  if (!v('nD')) { toast('締切を入れてください'); return; }
  var u = v('nU'); if (u && !/^https?:\/\//i.test(u)) u = 'https://' + u;
  var data = { type: v('nY'), title: v('nT'), host: v('nH'), due: v('nD'), url: u, memo: document.getElementById('nM').value.trim(),
    roles: Array.prototype.slice.call(document.querySelectorAll('#modal .nR:checked')).map(function (x) { return x.value; }) };
  snap();
  if (M.id) { var n = notice(M.id); if (n) Object.assign(n, data); M = null; save(); render(); toast('保存しました'); }
  else { S.notices.push(Object.assign({ id: uid('n'), state: b.dataset.s }, data)); M = null; S.ntab = 'list'; save(); render(); toast(b.dataset.s === 'pub' ? '公開しました' : '下書きで保存しました'); }
}, true);
document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && M && M.m === 'notice') { M = null; renderModal(); } });


// ux25 スマホ：＋ボタンを下のタブバーの上に置く
addEventListener('resize', function () { placeFab(); });

