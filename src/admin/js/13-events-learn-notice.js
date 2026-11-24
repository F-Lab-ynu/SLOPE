// ---------- ux51 告知のイベント＝学ぶのイベント＋部内の予定。公開したものだけ部員に出て参加登録できる ----------
function pmd(x) { return x ? x.slice(5).replace('-', '.') : ''; }
document.addEventListener('click', function (e) {
  var b = e.target.closest && e.target.closest('[data-act="pevPub"],[data-act="pevEdit"],[data-act="calPub"]'); if (!b) return; e.preventDefault(); e.stopImmediatePropagation();
  if (b.dataset.act === 'calPub') { if (b.disabled) return; var c = (S.cals || []).filter(function (x) { return x.id === b.dataset.id; })[0]; if (!c) return; snap(); c.state = c.state === 'pub' ? 'draft' : 'pub'; evSync(); save(); render(); toast(c.state === 'pub' ? '「' + c.title + '」を公開しました' : '「' + c.title + '」を非公開にしました'); return; }
  var f = p2Get(b.dataset.id); if (!f) return;
  if (b.dataset.act === 'pevEdit') { S.view = 'tracks'; UI.psel = f.n.id; UI.pren = null; save(); render(); return; }
  if (b.disabled) return; snap(); f.n.pub = !f.n.pub; S.program.updated = Date.now(); save(); render(); toast(f.n.pub ? '「' + f.n.name + '」を公開しました' : '「' + f.n.name + '」を非公開にしました');
}, true);
document.addEventListener('click', function (e) { var b = e.target.closest && e.target.closest('[data-p2tonotice]'); if (!b) return; e.preventDefault(); e.stopImmediatePropagation(); S.view = 'notices'; S.ntab = 'ev'; save(); render(); }, true);

// ---------- ux52 イベントは1種類：告知のイベント（予定）が本体。学ぶ（プログラム）のイベントはそれを指すだけ ----------
function evCal(id) { return (S.cals || []).filter(function (x) { return x.id === id; })[0] || null; }
function evInProg(cid) { return !!(S.program && S.program.v2 && p2Find(function (n) { return n.k === 'e' && n.ref === cid; })); }
function evOutProg(cid) { var f; while ((f = p2Find(function (n) { return n.k === 'e' && n.ref === cid; }))) f.arr.splice(f.i, 1); }
function evSync() { // プログラムの中のイベントに、本体（予定）の中身を写す（部員側で本体が見られないときの控え）
  if (!S.program || !S.program.v2) return; calsInit();
  p2Walk(S.program.v2, function (n) {
    if (n.k !== 'e') return;
    if (!n.ref) { UI._evNew = 1; var id = 'pe:' + n.id; if (!evCal(id)) S.cals.push({ id: id, title: n.name || 'イベント', date: n.from || '', to: n.to && n.to !== n.from ? n.to : '', time: '', place: '', memo: n.todo || '', link: n.link || '', state: n.pub ? 'pub' : 'draft' }); n.ref = id; ['name', 'from', 'to', 'todo', 'link', 'pub'].forEach(function (k) { delete n[k]; }); }
    var c = evCal(n.ref); if (!c) { n._dead = 1; return; }
    n.name = c.title; n.from = c.date; n.to = c.to || ''; n.todo = c.memo || ''; n.link = c.link || ''; n.pub = c.state === 'pub';
  });
  (function rm(a) { for (var i = a.length - 1; i >= 0; i--) { if (a[i]._dead) a.splice(i, 1); else if (a[i].items) rm(a[i].items); } })(S.program.v2);
}
// 教材でイベントを作る＝予定（下書き）を作って、プログラムに置く
// 教材の中央：告知と同じ項目をそのまま編集
document.addEventListener('input', function (e) {
  var el = e.target; if (!el.dataset || !el.dataset.ce || S.view !== 'tracks') return; var f = p2Get(UI.psel); if (!f || f.n.k !== 'e') return; var c = evCal(f.n.ref); if (!c) return;
  var k = el.dataset.ce; if (k === 'state') return; c[k] = el.value; evSync(); save();
  if (k === 'title') { var r = document.querySelector('.p2r[data-p2="' + f.n.id + '"] .p2n'); if (r) r.textContent = el.value; }
}, true);
document.addEventListener('change', function (e) {
  var el = e.target; if (!el.dataset || !el.dataset.ce || S.view !== 'tracks') return; var f = p2Get(UI.psel); if (!f) return; var c = evCal(f.n.ref); if (!c) return;
  if (el.dataset.ce === 'state') { snap(); c.state = el.checked ? 'pub' : 'draft'; evSync(); save(); render(); toast(el.checked ? '公開しました' : '非公開にしました'); }
  else if (el.dataset.ce === 'date' || el.dataset.ce === 'to') { if (c.to && c.to <= c.date) c.to = ''; evSync(); save(); render(); }
}, true);
// 学ぶのツリーでイベントを消す＝プログラムから外すだけ（告知のイベントは残る）
// 告知のイベント一覧：予定がすべて。学ぶに入っているものには印
function viewEvents () {
  calsInit(); p2();
  var cs = S.cals.filter(evInNotice).sort(function (a, b) { return (a.date || '') < (b.date || '') ? -1 : 1; });
  if (!cs.length) return '<div class="empty big">イベントはまだありません。右下の＋で追加できます</div>';
  var okc = can('notices'), today = isoOf(TODAY);
  return '<div class="evl"><div class="evr evh"><span>イベント</span><span>期間</span><span>場所</span><span>参加登録</span><span>公開</span><span></span></div>' + cs.map(function (c) {
    var end = c.to || c.date, past = !!end && end < today, pub = c.state === 'pub', pg = evInProg(c.id);
    return '<div class="evr" data-calid="' + c.id + '"><span class="evn"><b>' + esc(c.title || 'イベント') + (pg ? '<i class="evtag">学ぶ</i>' : '') + '</b>' + (c.memo ? '<span>' + esc(memoText(c.memo).slice(0, 60)) + '</span>' : '') + '</span>' +
      '<span class="evq num">' + (c.date ? pmd(c.date) + (c.to ? ' – ' + pmd(c.to) : '') + (c.time ? ' ' + esc(c.time) : '') : '<span class="dim">未定</span>') + '</span>' + (c.place ? '<span class="evp">' + esc(c.place) + '</span>' : '<span class="evp dim">—</span>') +
      '<span class="evg num">' + (pub ? ((S.joins || {})[c.id] || 0) + ' 人' : '<span class="dim">—</span>') + '</span>' +
      (past ? '<span class="muted nsw" style="font-size:12px">終了</span>' : '<button class="sw nsw" role="switch" data-act="calPub" data-id="' + c.id + '" aria-checked="' + pub + '" aria-label="部員に公開"' + (okc ? '' : ' disabled') + '><i></i></button>') +
      '<button class="ib" data-act="calItem" data-k="cal" data-id="' + c.id + '" aria-label="編集" title="編集">' + PEN + '</button></div>';
  }).join('') + '</div>';
}

// ---------- ux53 学ぶと告知はそれぞれでイベントを作り、右クリック・詳細から「お互いに追加」。同じ名前があれば置き換えるか聞く ----------
function evInNotice(c) { return c && c.inNotice !== false; }
function evSameName(a, b) { return (a || '').replace(/\s+/g, '').toLowerCase() === (b || '').replace(/\s+/g, '').toLowerCase(); }
function evDupDlg(dir, cid, other) { M = { m: 'evdup', dir: dir, cid: cid, other: other }; renderModal(); }
function evToProg(cid, force) {
  var c = evCal(cid); if (!c) return; if (evInProg(cid)) { toast('もう学ぶに入っています'); return; }
  if (!force) { var d = p2Find(function (n) { return n.k === 'e' && n.ref !== cid && evSameName(n.name, c.title); }); if (d) return evDupDlg('prog', cid, d.n.id); }
  snap(); var T = p2(); T.splice(T.length - 1, 0, { id: GID(), k: 'e', ref: cid }); evSync(); save(); render(); toast('「' + c.title + '」を学ぶ（プログラムの最後）に追加しました');
}
function evToNotice(cid, force) {
  var c = evCal(cid); if (!c) return; if (evInNotice(c)) { toast('もう告知に入っています'); return; }
  if (!force) { var d = (S.cals || []).filter(function (x) { return x.id !== cid && evInNotice(x) && evSameName(x.title, c.title); })[0]; if (d) return evDupDlg('notice', cid, d.id); }
  snap(); c.inNotice = true; save(); render(); toast('「' + c.title + '」を告知に追加しました。告知で公開すると部員に出ます');
}
function evOutNotice(cid) { var c = evCal(cid); if (!c) return; snap(); c.inNotice = false; c.state = 'draft'; evSync(); save(); render(); toast('告知から外しました（学ぶには残っています）'); }
function evGc(cid) { var c = evCal(cid); if (c && !evInNotice(c) && !evInProg(cid)) S.cals = S.cals.filter(function (x) { return x !== c; }); }
document.addEventListener('click', function (e) {
  var b = e.target.closest && e.target.closest('[data-act="evdupRep"],[data-act="evdupBoth"],[data-act="evToProg"],[data-act="evOutProg"],[data-act="evToNotice"],[data-act="evOutNotice"]'); if (!b) return;
  e.preventDefault(); e.stopImmediatePropagation(); var a = b.dataset.act;
  if (a === 'evToProg') { M = null; renderModal(); return evToProg(b.dataset.id); }
  if (a === 'evOutProg') { snap(); evOutProg(b.dataset.id); M = null; evGc(b.dataset.id); save(); render(); toast('学ぶから外しました（告知には残っています）'); return; }
  if (a === 'evToNotice') return evToNotice(b.dataset.id);
  if (a === 'evOutNotice') return evOutNotice(b.dataset.id);
  var m = M; M = null; renderModal(); if (!m) return;
  if (a === 'evdupBoth') return m.dir === 'prog' ? evToProg(m.cid, true) : evToNotice(m.cid, true);
  snap();
  if (m.dir === 'prog') { var o = p2Get(m.other); if (o) { var old = o.n.ref; o.n.ref = m.cid; evGc(old); } }
  else { var c = evCal(m.cid), oc = evCal(m.other); if (c) c.inNotice = true; if (oc) { p2Walk(p2(), function (n) { if (n.k === 'e' && n.ref === oc.id) n.ref = m.cid; }); S.cals = S.cals.filter(function (x) { return x !== oc; }); } }
  evSync(); save(); render(); toast('置き換えました');
}, true);
// 学ぶで作るイベントは、まだ告知に入っていない
// 告知の一覧：告知に入っているものだけ
// 告知の行の右クリック
window.addEventListener('contextmenu', function (e) {
  if (S.view !== 'notices' || !e.target.closest) return; var r = e.target.closest('.evr[data-calid]'); if (!r) return;
  e.preventDefault(); e.stopImmediatePropagation(); var c = evCal(r.dataset.calid); if (!c) return; var pg = evInProg(c.id), ok = can('notices');
  openMenu(c.title, [['編集', function () { M = { m: 'cal', id: c.id }; renderModal(); }],
    [c.state === 'pub' ? '部員に非公開にする' : '部員に公開する', function () { snap(); c.state = c.state === 'pub' ? 'draft' : 'pub'; evSync(); save(); render(); }, false, ok ? '' : '告知の権限が必要'],
    'sep', [pg ? '学ぶから外す' : '学ぶにも追加', function () { if (pg) { snap(); evOutProg(c.id); evSync(); save(); render(); toast('学ぶから外しました'); } else evToProg(c.id); }, false, can('tracks') ? '' : '教材の権限が必要'],
    'sep', ['削除', function () { snap(); evOutProg(c.id); S.cals = S.cals.filter(function (x) { return x !== c; }); save(); render(); toastUndo('「' + c.title + '」を削除しました'); }, true, ok ? '' : '告知の権限が必要']], e.clientX, e.clientY);
}, true);
// 学ぶのツリーのイベントの右クリックに「告知に追加／外す」
// 教材のイベントの詳細：告知に入っていなければ公開はできず、「告知にも追加」を出す

