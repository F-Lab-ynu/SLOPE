// ---------- ux60 ガントの「表示」＝絞り込み。説明は出さず、押すだけ ----------
//  絞り込み（どれかに当てはまる業務と、その上のフォルダーだけ）／開く深さ／完了したもの／フォルダーだけ
var VF = [['mine', '自分の担当'], ['nobody', '担当未定'], ['late', '期限切れ'], ['soon', '期限が近い'], ['active', '進行中']];
function vs() {
  if (!S.view2) S.view2 = {};
  var v = S.view2; if (!v.f) v.f = {}; if (!v.done) v.done = v.dimDone ? 'dim' : 'show';
  v.exp = 'depth'; v.focus = false; v.days = 7; v.hl = { late: true, soon: true, over: true }; // 期限の点はいつも出す
  return v;
}
function vfOn() { var f = vs().f; return VF.filter(function (x) { return f[x[0]]; }).map(function (x) { return x[0]; }); }
function vfMatch(n) {
  var on = vfOn(); if (!on.length) return true;
  var dn = isDone(n) || (n.nodate && !isFolder(n)), who = isFolder(n) ? teamOf(n) : fileWho(n);
  return on.some(function (k) {
    if (k === 'mine') return who.indexOf(S.me) >= 0;
    if (k === 'nobody') return !dn && !who.length;
    if (k === 'late') return !dn && dayOf(n.end) < TODAY && (!isFolder(n) || kids(n).some(function (c) { return !isDone(c); }));
    if (k === 'soon') return !dn && dayOf(n.end) >= TODAY && dayOf(n.end) <= TODAY + 7 * DAY;
    if (k === 'active') return !dn && isActiveN(n);
    return false;
  });
}
function vBase(n) { var v = vs(); if (v.done === 'hide' && isDone(n) && (!isFolder(n) || progress(n).n)) return false; if (v.foldersOnly && !isFolder(n)) return false; return true; }
function vShow(n) { if (!vBase(n)) return false; if (!vfOn().length) return true; return vfMatch(n) || hasBelow(n, function (k) { return vBase(k) && vfMatch(k); }); }
function isOpen(n, d) {
  if (S.fold && S.fold[n.id] != null) return !S.fold[n.id];
  if (vfOn().length) return hasBelow(n, function (k) { return vBase(k) && vfMatch(k); }); // 絞り込み中は当てはまる所まで開く
  return d + 1 < (S.depth || 2);
}
function vSummary() { return ''; }
function vPanelHTML() {
  var v = vs(), dsel = String(S.depth || 2), on = vfOn();
  var seg = function (act, list, cur, label) { return '<span class="seg" role="group" aria-label="' + label + '">' + list.map(function (x) { return '<button data-act="' + act + '" data-v="' + x[0] + '" aria-pressed="' + (cur === x[0]) + '">' + x[1] + '</button>'; }).join('') + '</span>'; };
  return '<div class="vph"><b>表示</b>' + (on.length || v.done !== 'show' || v.foldersOnly || dsel !== '2' ? '<button class="vrst" data-act="vreset">リセット</button>' : '') + '<button class="ib vclose" data-act="vclose" aria-label="閉じる">' + ic('x') + '</button></div>' +
    '<div class="vsec"><div class="vt">絞り込み</div><div class="vchips">' + VF.map(function (x) { var p = !!v.f[x[0]]; return '<button class="vchip" data-act="vf" data-v="' + x[0] + '" aria-pressed="' + p + '">' + (p ? '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12l5 5 9-10"/></svg>' : '') + x[1] + '</button>'; }).join('') + '</div></div>' +
    '<div class="vsec' + (on.length ? ' voff' : '') + '"' + (on.length ? ' title="絞り込み中は、当てはまる所まで自動で開きます"' : '') + '><div class="vt">開く深さ</div>' + seg('vdepth', LEVELS, dsel, '開く深さ') + '</div>' +
    '<div class="vsec"><div class="vt">完了したもの</div>' + seg('vdone', [['show', '表示'], ['dim', '薄く'], ['hide', '隠す']], v.done, '完了したもの') + '</div>' +
    '<div class="vsec"><label class="vopt"><input type="checkbox" data-vopt="foldersOnly"' + (v.foldersOnly ? ' checked' : '') + '><span><b>フォルダーだけ</b></span></label></div>';
}
document.addEventListener('click', function (e) {
  var b = e.target.closest && e.target.closest('[data-act="vf"]'); if (!b) return;
  e.stopImmediatePropagation(); e.preventDefault();
  var f = vs().f; f[b.dataset.v] = !f[b.dataset.v]; vApply();
}, true);
