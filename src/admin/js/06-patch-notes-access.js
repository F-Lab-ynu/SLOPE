// ---------- ux27 ダッシュボード：今後の更新とパッチノート ----------
var PATCH_SEED = [
  ['2026-11-16', '運営画面を公開', 'Googleログイン・承認制・リアルタイム同期'],
  ['2026-11-16', 'プライバシーポリシーを追加', ''],
  ['2026-11-16', '部員アプリを公開', '運営画面の教材・外部告知・掲示板もデータベースに接続'],
  ['2026-11-17', '業務をフォルダー/ファイル型に刷新', 'リーダー複数・メモ・カード/ガントチャート切替・右クリック・教材の新レイアウト・ダッシュボード3区分'],
  ['2026-11-17', '承認制を一旦停止', '新しく入った人は最初から使える'],
  ['2026-11-17', '告知を＋ボタンとポップアップで作成', '対象ロール・詳細も入力可。各行に編集ボタン'],
  ['2026-11-17', 'スマホ表示の修正', '＋ボタンとタブバーの重なり、画面全体がスクロールする不具合、ログインを2回押す必要がある不具合'],
  ['2026-11-17', 'ダッシュボードに更新履歴を追加', '今後の更新とパッチノートを記録できる（編集は代表のみ）']
];
function patchesInit() { if (!S.patches) S.patches = PATCH_SEED.map(function (x, i) { return { id: 'pt' + i, date: x[0], title: x[1], note: x[2], state: 'done' }; }); return S.patches; }
function pRow(x) {
  var ed = isAdmin(), d = x.date ? fmtDate(x.date) : '';
  return '<div class="pnr' + (ed ? ' ed' : '') + '"' + (ed ? ' data-act="ptEdit" data-id="' + x.id + '"' : '') + '><span class="pd num">' + (x.state === 'plan' && !d ? '未定' : d) + '</span><span class="pt"><b>' + esc(x.title) + '</b>' + (x.note ? '<span>' + esc(x.note) + '</span>' : '') + '</span>' +
    (ed && x.state === 'plan' ? '<button class="ib" data-act="ptDone" data-id="' + x.id + '" title="実施済みにする" aria-label="実施済みにする"><svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12l5 5L20 7"/></svg></button>' : '<span></span>') + '</div>';
}
function patchCards() {
  var ps = patchesInit(), by = function (a, b) { return (b.date || '9999').localeCompare(a.date || '9999'); };
  var plan = ps.filter(function (x) { return x.state === 'plan'; }).sort(function (a, b) { return (a.date || '9999').localeCompare(b.date || '9999'); });
  var done = ps.filter(function (x) { return x.state !== 'plan'; }).sort(function (a, b) { return by(a, b) || ps.indexOf(b) - ps.indexOf(a); });
  var add = function (st) { return isAdmin() ? '<button data-act="ptNew" data-s="' + st + '" title="追加" aria-label="追加">' + ic('plus') + '</button>' : ''; };
  var none = '<div class="empty sm">なし</div>', lim = UI.pAll ? done.length : 6;
  var c1 = '<div class="card"><div class="ch"><span class="cht">今後の更新<span class="num" style="margin-left:6px;color:var(--muted);font-weight:400">' + plan.length + '</span></span>' + add('plan') + '</div><div class="pnl">' + (plan.length ? plan.map(pRow).join('') : none) + '</div></div>';
  var c2 = '<div class="card"><div class="ch"><span class="cht">パッチノート<span class="num" style="margin-left:6px;color:var(--muted);font-weight:400">' + done.length + '</span></span>' + add('done') + '</div><div class="pnl">' + (done.length ? done.slice(0, lim).map(pRow).join('') : none) + '</div>' +
    (done.length > 6 ? '<button class="pmore" data-act="ptAll">' + (UI.pAll ? '閉じる' : 'すべて表示（' + done.length + '）') + '</button>' : '') + '</div>';
  return (isAdmin() ? accessCard() : '') + '<div class="dg2 pgrid" style="margin-top:12px">' + c1 + c2 + '</div>';
}
function patchDlg() {
  var x = M.id ? patchesInit().filter(function (y) { return y.id === M.id; })[0] : null, d = x || { date: M.s === 'plan' ? '' : isoOf(TODAY), title: '', note: '', state: M.s || 'done' };
  var body = '<div class="fld"><label for="pT">内容</label><input id="pT" class="input" value="' + esc(d.title) + '" autocomplete="off"></div>' +
    '<div class="two"><div class="fld"><label for="pS">状態</label><select id="pS" class="input"><option value="plan"' + (d.state === 'plan' ? ' selected' : '') + '>今後の更新</option><option value="done"' + (d.state !== 'plan' ? ' selected' : '') + '>実施済み</option></select></div>' +
    '<div class="fld"><label for="pD">日付</label><input id="pD" type="date" class="input" value="' + esc(d.date || '') + '"></div></div>' +
    '<div class="fld"><label for="pN">詳細</label><textarea id="pN" class="input" rows="4">' + esc(d.note || '') + '</textarea></div>';
  var foot = (x ? '<button class="btn ghost" data-act="ptDel" data-id="' + x.id + '" style="margin-right:auto;color:var(--red,#DC2626)">削除</button>' : '') + '<button class="btn" data-act="close">キャンセル</button><button class="btn primary" data-act="ptSave">保存</button>';
  return dlg(x ? '更新を編集' : (d.state === 'plan' ? '今後の更新を追加' : 'パッチを記録'), body, foot, true);
}
document.addEventListener('click', function (e) {
  var b = e.target.closest && e.target.closest('[data-act="ptNew"],[data-act="ptEdit"],[data-act="ptSave"],[data-act="ptDel"],[data-act="ptDone"],[data-act="ptAll"]'); if (!b) return;
  e.stopImmediatePropagation(); e.preventDefault();
  var a = b.dataset.act, ps = patchesInit(), get = function (id) { return ps.filter(function (y) { return y.id === id; })[0]; };
  if (a === 'ptAll') { UI.pAll = !UI.pAll; render(); return; }
  if (!isAdmin()) return;
  if (a === 'ptNew') { M = { m: 'patch', s: b.dataset.s }; renderModal(); return; }
  if (a === 'ptEdit') { M = { m: 'patch', id: b.dataset.id }; renderModal(); return; }
  if (a === 'ptDone') { var x0 = get(b.dataset.id); if (x0) { snap(); x0.state = 'done'; x0.date = isoOf(TODAY); save(); render(); toast('パッチノートに移しました'); } return; }
  if (a === 'ptDel') { var x1 = get(b.dataset.id); if (!x1) return; snap(); S.patches = ps.filter(function (y) { return y !== x1; }); M = null; save(); render(); toastUndo('「' + x1.title + '」を削除しました'); return; }
  var t = document.getElementById('pT').value.trim(); if (!t) { toast('内容を入れてください'); return; }
  var data = { title: t, state: document.getElementById('pS').value, date: document.getElementById('pD').value, note: document.getElementById('pN').value.trim() };
  if (data.state === 'done' && !data.date) data.date = isoOf(TODAY);
  snap();
  if (M.id) Object.assign(get(M.id), data); else ps.push(Object.assign({ id: uid('pt') }, data));
  M = null; save(); render(); toast('保存しました');
}, true);
document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && M && M.m === 'patch') { M = null; renderModal(); } });


// ---------- ux28 スマホ：ピンチやダブルタップで画面全体が拡大・縮小しないようにする（ガントチャートのピンチは残す） ----------
(function () {
  var inG = function (t) { return typeof inGantt === 'function' && inGantt(t); };
  document.addEventListener('touchmove', function (e) { if (e.touches.length > 1 && !inG(e.target)) e.preventDefault(); }, { passive: false });
  document.addEventListener('gesturestart', function (e) { if (!inG(e.target)) e.preventDefault(); }, { passive: false });
  document.addEventListener('gesturechange', function (e) { if (!inG(e.target)) e.preventDefault(); }, { passive: false });
})();

// ---------- ux30 アクセス統計（代表だけ） ----------
var TABN = { member: { home: 'ホーム', learn: '学ぶ', news: 'ニュース', board: '掲示板', cal: '予定', me: 'マイページ', open: '起動' }, admin: { dash: 'ダッシュボード', projects: '業務', tracks: '教材', notices: '外部告知', board: 'サポート', perms: 'メンバー', open: '起動' } };
function sampleAccess() {
  var days = [], seed = 7;
  for (var i = 13; i >= 0; i--) { seed = (seed * 37 + 11) % 97; var u = 18 + seed % 40 + (i < 3 ? 15 : 0); days.push({ day: isoOf(TODAY - i * DAY), users: u, views: u * 4 + seed % 20 }); }
  return { days: days, dau: days[13].users, wau: 96, mau: 131, total: 150,
    tabs: [{ app: 'member', tab: 'home', views: 820, users: 128 }, { app: 'member', tab: 'learn', views: 410, users: 88 }, { app: 'member', tab: 'board', views: 260, users: 61 }, { app: 'member', tab: 'news', views: 190, users: 54 }, { app: 'member', tab: 'cal', views: 140, users: 47 }, { app: 'admin', tab: 'projects', views: 95, users: 9 }, { app: 'admin', tab: 'dash', views: 70, users: 10 }] };
}
function accessCard() {
  var a = S.access || (typeof sb === 'undefined' ? (S.access = sampleAccess()) : null);
  if (!a) return '<div class="acc"><div class="card"><div class="ch"><span class="cht">アクセス</span></div><div class="empty sm">読み込み中…</div></div></div>';
  var days = a.days || [], mx = Math.max.apply(null, days.map(function (d) { return d.users; }).concat([1]));
  var total = a.total || S.members.length || 1;
  var bars = days.map(function (d, i) {
    var dt = new Date(d.day + 'T00:00:00Z'), md = (dt.getUTCMonth() + 1) + '/' + dt.getUTCDate(), wd = dt.getUTCDay();
    var lab = i === 0 || dt.getUTCDate() === 1 ? md : String(dt.getUTCDate()); // 日付は毎日。月は最初と月替わりだけ
    return '<div class="abar' + (i === days.length - 1 ? ' today' : '') + (wd === 0 || wd === 6 ? ' we' : '') + '" title="' + md + '：' + d.users + '人・' + d.views + '回"><u>' + d.users + '</u><i style="height:' + Math.round(d.users / mx * 100) + '%"></i><em>' + lab + '</em></div>';
  }).join('');
  var c1 = '<div class="card"><div class="ch"><span class="cht">アクセス</span></div><div class="akp">' +
    '<div><b class="num">' + a.dau + '</b><span>今日</span></div><div><b class="num">' + a.wau + '</b><span>7日間</span></div><div><b class="num">' + a.mau + '</b><span>30日間</span></div>' +
    '<div><b class="num">' + Math.round(a.wau / total * 100) + '%</b><span>週に1回以上（全' + total + '人中）</span></div></div>' +
    '<div class="abars">' + bars + '</div><div class="anote">棒は1日に開いた人数（14日間）</div></div>';
  var tb = (a.tabs || []).slice().sort(function (x, y) { return y.views - x.views; }).slice(0, 8), tmx = Math.max.apply(null, tb.map(function (t) { return t.views; }).concat([1]));
  var c2 = '<div class="card atab"><div class="ch"><span class="cht">よく見られている画面<span style="margin-left:6px;color:var(--muted);font-weight:400;font-size:11px">30日間</span></span></div><div class="cb"><div class="hbs">' +
    (tb.length ? tb.map(function (t) { var n = (TABN[t.app] || {})[t.tab] || t.tab; return '<div class="hb"><span class="l">' + esc(n) + (t.app === 'admin' ? '<span style="color:var(--muted);font-size:11px">（運営）</span>' : '') + '</span><span class="b"><i style="width:' + Math.round(t.views / tmx * 100) + '%"></i></span><span class="v">' + t.views + '</span></div>'; }).join('') : '<div class="empty sm">まだデータがありません</div>') + '</div></div></div>';
  return '<div class="acc">' + c1 + c2 + '</div>';
}


