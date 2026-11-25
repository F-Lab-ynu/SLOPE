// ---------- イベント：本体は1つ（予定）。学ぶの項目と業務のフォルダーは、それを指すだけ ----------
// 告知の「イベント」一覧には、どこで作ったものも全部並ぶ。部員に見えるかは「公開」だけで決まる
function pmd(x) { return x ? x.slice(5).replace('-', '.') : ''; }
function evCal(id) { return (S.cals || []).filter(function (x) { return x.id === id; })[0] || null; }
function evInProg(cid) { return !!(S.program && S.program.v2 && p2Find(function (n) { return n.k === 'e' && n.ref === cid; })); }
function evOutProg(cid) { var f; while ((f = p2Find(function (n) { return n.k === 'e' && n.ref === cid; }))) f.arr.splice(f.i, 1); }
function evFolder(cid) { return allNodes().filter(function (n) { return isFolder(n) && isEvent(n) && n.ev === cid; })[0] || null; }
function evJoins(c) { return (S.joins || {})[c.id] || 0; }
function evNew(title, date) { var c = { id: uid('c'), title: title || '新しいイベント', date: date || isoOf(TODAY), to: '', time: '', place: '', memo: '', link: '', state: 'draft' }; calsInit().push(c); return c; }
function evSync() { // プログラムの中のイベントに、本体（予定）の中身を写す（部員側の控え）
  if (!S.program || !S.program.v2) return; calsInit();
  p2Walk(S.program.v2, function (n) {
    if (n.k !== 'e') return;
    if (!n.ref) { UI._evNew = 1; var id = 'pe:' + n.id; if (!evCal(id)) S.cals.push({ id: id, title: n.name || 'イベント', date: n.from || '', to: n.to && n.to !== n.from ? n.to : '', time: '', place: '', memo: n.todo || '', link: n.link || '', state: n.pub ? 'pub' : 'draft' }); n.ref = id; ['name', 'from', 'to', 'todo', 'link', 'pub'].forEach(function (k) { delete n[k]; }); }
    var c = evCal(n.ref); if (!c) { n._dead = 1; return; }
    n.name = c.title; n.from = c.date; n.to = c.to || ''; n.todo = c.memo || ''; n.link = c.link || ''; n.pub = c.state === 'pub';
  });
  (function rm(a) { for (var i = a.length - 1; i >= 0; i--) { if (a[i]._dead) a.splice(i, 1); else if (a[i].items) rm(a[i].items); } })(S.program.v2);
}
// 前の形から：業務の「イベント」フォルダーには予定を作って結びつける。告知に出す／出さないの区別はなくす
function evMigrate() {
  if (UI._evmig || (typeof SYNC !== 'undefined' && !SYNC.ready)) return; UI._evmig = 1; calsInit(); var ch = false;
  S.cals.forEach(function (c) { if ('inNotice' in c) { delete c.inNotice; ch = true; } });
  allNodes().forEach(function (n) {
    if (!isFolder(n) || !isEvent(n) || (n.ev && evCal(n.ev))) return;
    var c = evNew(ttl(n), n.start); if (n.end && n.end !== n.start) c.to = n.end; c.place = n.place || ''; c.state = n.announce === 'done' ? 'pub' : 'draft';
    n.ev = c.id; ch = true;
  });
  if (ch) setTimeout(save, 0);
}

// 学ぶの編集欄：同じ項目をそのまま編集
document.addEventListener('input', function (e) {
  var el = e.target; if (!el.dataset || !el.dataset.ce || S.view !== 'tracks') return; var f = p2Get(UI.psel); if (!f || f.n.k !== 'e') return; var c = evCal(f.n.ref); if (!c) return;
  var k = el.dataset.ce; c[k] = el.value; evSync(); save();
  if (k === 'title') { var r = document.querySelector('.p2r[data-p2="' + f.n.id + '"] .p2n'); if (r) r.textContent = el.value; }
}, true);
document.addEventListener('change', function (e) {
  var el = e.target; if (!el.dataset || !el.dataset.ce || S.view !== 'tracks') return; var f = p2Get(UI.psel); if (!f) return; var c = evCal(f.n.ref); if (!c) return;
  if (el.dataset.ce === 'date' || el.dataset.ce === 'to') { if (c.to && c.to <= c.date) c.to = ''; evSync(); save(); render(); }
  if (['date', 'to', 'time', 'place'].indexOf(el.dataset.ce) >= 0) evChanged(c);
}, true);

// ---------- 公開・非公開・中止（確認してから。参加登録した人がいれば知らせる） ----------
function evWhen(c) { return (c.date ? pmd(c.date) + (c.to ? ' – ' + pmd(c.to) : '') + (c.time ? ' ' + c.time : '') : '日程未定') + (c.place ? '・' + c.place : ''); }
function evTell(c, text, sub) { ((S.joinIds || {})[c.id] || []).forEach(function (uid) { if (window.notify) window.notify(uid, text, sub || ''); }); }
function evPubAsk(cid) { if (!can('notices')) { toast('告知の権限が必要です'); return; } M = { m: 'pub', id: cid }; renderModal(); }
function evPubDlg() {
  var c = evCal(M.id); if (!c) return ''; var n = evJoins(c), on = c.state === 'pub', t = esc(c.title);
  if (!on) return dlg('部員に公開', '<p class="dlgp">「' + t + '」が予定タブとカレンダーに出て、参加登録が始まります。</p>', '<button class="btn" data-act="close">やめる</button><button class="btn primary" data-act="evPubDo">公開する</button>');
  if (!n) return dlg('非公開にする', '<p class="dlgp">「' + t + '」を部員から見えなくします。</p>', '<button class="btn" data-act="close">やめる</button><button class="btn primary" data-act="evPubDo">非公開にする</button>');
  return dlg('中止する', '<p class="dlgp">参加登録した ' + n + '人に、「' + t + '」の中止を知らせます。</p>', '<button class="btn" data-act="close">やめる</button><button class="btn danger" data-act="evPubDo">中止を知らせる</button>');
}
function evPubDo() {
  var c = evCal(M.id); M = null; if (!c) { renderModal(); return; }
  snap(); var was = c.state === 'pub', n = evJoins(c);
  c.state = was ? 'draft' : 'pub'; if (!was) evSnap(c);
  if (was && n) evTell(c, '「' + c.title + '」は中止になりました', 'カレンダーに追加していた場合は消してください');
  evSync(); save(); render(); toast(was ? (n ? '中止を知らせました' : '非公開にしました') : '公開しました');
}
// 公開中に日時・場所が変わったら、参加登録した人に知らせる（続けて直したときは最後にまとめて1回）
function evSnap(c) { UI.evSnap = UI.evSnap || {}; UI.evSnap[c.id] = evWhen(c); }
function evChanged(c) {
  UI.evT = UI.evT || {}; clearTimeout(UI.evT[c.id]);
  UI.evT[c.id] = setTimeout(function () {
    UI.evSnap = UI.evSnap || {}; var now = evWhen(c), was = UI.evSnap[c.id];
    if (c.state === 'pub' && was && was !== now && evJoins(c)) { evTell(c, '「' + c.title + '」の日時・場所が変わりました', now); toast('参加登録した人に知らせました'); }
    UI.evSnap[c.id] = now;
  }, 1500);
}
document.addEventListener('click', function (e) {
  var b = e.target.closest && e.target.closest('[data-act="evPub"],[data-act="evPubDo"],[data-act="evToProg"],[data-act="evOutProg"],[data-evpick]'); if (!b) return;
  e.preventDefault(); e.stopImmediatePropagation(); var a = b.dataset.act;
  if (a === 'evPub') return evPubAsk(b.dataset.id);
  if (a === 'evPubDo') return evPubDo();
  if (a === 'evToProg') { M = null; renderModal(); return evToProg(b.dataset.id); }
  if (a === 'evOutProg') { snap(); evOutProg(b.dataset.id); M = null; save(); render(); toast('学ぶから外しました'); return; }
  if (b.dataset.evpick) return evPicked(b.dataset.evpick);
}, true);

// ---------- 学ぶ・業務にイベントを置く：今あるイベントから選ぶか、新しく作る（名前では結びつけない） ----------
function evToProg(cid) {
  var c = evCal(cid); if (!c) return; if (evInProg(cid)) return;
  snap(); var T = p2(); T.splice(T.length - 1, 0, { id: GID(), k: 'e', ref: cid }); evSync(); save(); render(); toast('「' + c.title + '」を学ぶに出しました');
}
function evPickAsk(mode, where) { M = { m: 'evpick', mode: mode, where: where }; renderModal(); }
function evPickDlg() {
  var used = function (c) { return M.mode === 'merge' ? c.id === M.where : M.mode === 'prog' ? evInProg(c.id) : !!evFolder(c.id); };
  var dist = function (c) { return c.date ? Math.abs(dayOf(c.date) - TODAY) : 9e15; };
  var list = calsInit().filter(function (c) { return !used(c); }).sort(function (a, b) { return dist(a) - dist(b); });
  var rows = (M.mode === 'merge' ? '' : '<button class="evpk new" data-evpick="new"><b>＋ 新しく作る</b></button>') + list.map(function (c) { return '<button class="evpk" data-evpick="' + c.id + '"><b>' + esc(c.title) + '</b><span class="num">' + esc(c.date ? pmd(c.date) + (c.to ? ' – ' + pmd(c.to) : '') : '日程未定') + '</span></button>'; }).join('');
  return dlg(M.mode === 'merge' ? 'まとめる先' : 'イベント', '<div class="evpkl">' + rows + '</div>', '<button class="btn" data-act="close">やめる</button>');
}
function evPicked(cid) {
  var m = M; M = null; renderModal(); if (!m) return;
  if (m.mode === 'merge') return evMerge(m.where, cid);
  snap();
  if (m.mode === 'prog') {
    var c = cid === 'new' ? evNew() : evCal(cid); if (!c) return; var w = m.where || p2Target(), n = { id: GID(), k: 'e', ref: c.id };
    w.arr.splice(w.at, 0, n); evSync(); UI.psel = n.id; UI.pren = cid === 'new' ? n.id : null; p2Save(); if (cid === 'new') p2Focus(n.id);
    return;
  }
  var f = task(m.where); if (!f) return;
  var c2 = cid === 'new' ? evNew(ttl(f), f.start) : evCal(cid); if (!c2) return;
  if (cid === 'new' && f.end && f.end !== f.start) c2.to = f.end;
  f.kind = 'event'; f.ev = c2.id; save(); render(); toast('「' + ttl(f) + '」をイベントにしました');
}
// 同じイベントが2つあったとき：まとめる先に、学ぶ・業務のつながりと出席を移して、元を消す
function evMerge(fromId, toId) {
  var a = evCal(fromId), b = evCal(toId); if (!a || !b) return;
  if (evJoins(a)) { toast('参加登録がある「' + a.title + '」の方を、まとめる先にしてください'); return; }
  snap();
  var inB = evInProg(b.id); p2Walk(p2(), function (n) { if (n.k === 'e' && n.ref === a.id) { if (inB) n._dead = 1; else { n.ref = b.id; inB = true; } } });
  var fa = evFolder(a.id), fb = evFolder(b.id); if (fa) { if (fb) { fa.kind = 'folder'; delete fa.ev; } else fa.ev = b.id; }
  b.att = (b.att || []).concat((a.att || []).filter(function (x) { return (b.att || []).indexOf(x) < 0; }));
  ['to', 'time', 'place', 'memo', 'link'].forEach(function (k) { if (!b[k] && a[k]) b[k] = a[k]; });
  S.cals = S.cals.filter(function (x) { return x !== a; }); evSync(); save(); render(); toastUndo('「' + a.title + '」を「' + b.title + '」にまとめました');
}
function evUnlink(n) { snap(); n.kind = 'folder'; delete n.ev; save(); render(); toast('イベントを外しました（イベント自体は告知に残っています）'); }

// ---------- 告知のイベント一覧：全部。学ぶ・業務とつながっているものには印 ----------
function viewEvents () {
  calsInit(); p2();
  var cs = S.cals.slice().sort(function (a, b) { return (a.date || '') < (b.date || '') ? -1 : 1; });
  if (!cs.length) return '<div class="empty big">イベントはまだありません</div>';
  var today = isoOf(TODAY);
  return '<div class="evl"><div class="evr evh"><span>イベント</span><span>期間</span><span>場所</span><span>参加登録</span><span style="text-align:center">公開</span><span></span></div>' + cs.map(function (c) {
    var end = c.to || c.date, past = !!end && end < today, pub = c.state === 'pub', pg = evInProg(c.id), fo = evFolder(c.id);
    return '<div class="evr" data-calid="' + c.id + '"><span class="evn"><b>' + esc(c.title || 'イベント') + (pg ? '<i class="evtag">学ぶ</i>' : '') + (fo ? '<i class="evtag wkt">業務</i>' : '') + '</b>' + (c.memo ? '<span>' + esc(memoText(c.memo).slice(0, 60)) + '</span>' : '') + '</span>' +
      '<span class="evq num">' + (c.date ? pmd(c.date) + (c.to ? ' – ' + pmd(c.to) : '') + (c.time ? ' ' + esc(c.time) : '') : '<span class="dim">未定</span>') + '</span>' + (c.place ? '<span class="evp">' + esc(c.place) + '</span>' : '<span class="evp dim">—</span>') +
      '<span class="evg num">' + (pub ? evJoins(c) + ' 人' : '<span class="dim">—</span>') + '</span>' +
      (past ? '<span class="pubc end nsw">終了</span>' : '<button class="pubc nsw' + (pub ? ' on' : '') + '" data-act="evPub" data-id="' + c.id + '" title="' + (pub ? '非公開にする' : '部員に公開する') + '">' + (pub ? '公開中' : '非公開') + '</button>') +
      '<span class="evact"><button class="ib" data-act="calItem" data-k="cal" data-id="' + c.id + '" aria-label="編集" title="編集">' + PEN + '</button>' + '<button class="rmore" type="button" tabindex="-1" aria-label="その他" title="その他">' + ic('more') + '</button>' + '</span></div>';
  }).join('') + '</div>';
}
// 告知の行の右クリック
window.addEventListener('contextmenu', function (e) {
  if (S.view !== 'notices' || !e.target.closest) return; var r = e.target.closest('.evr[data-calid]'); if (!r) return;
  e.preventDefault(); e.stopImmediatePropagation(); var c = evCal(r.dataset.calid); if (!c) return; var pg = evInProg(c.id), ok = can('notices');
  openMenu(c.title, [['編集', function () { M = { m: 'cal', id: c.id }; renderModal(); }],
    [c.state === 'pub' ? (evJoins(c) ? '中止する' : '非公開にする') : '部員に公開する', function () { evPubAsk(c.id); }, false, ok ? '' : '告知の権限が必要'],
    'sep', [pg ? '学ぶから外す' : '学ぶに出す', function () { if (pg) { snap(); evOutProg(c.id); evSync(); save(); render(); toast('学ぶから外しました'); } else evToProg(c.id); }, false, can('tracks') ? '' : '教材の権限が必要'],
    ['ほかのイベントとまとめる', function () { evPickAsk('merge', c.id); }, false, ok ? '' : '告知の権限が必要'],
    'sep', ['削除', function () { snap(); evOutProg(c.id); var fo = evFolder(c.id); if (fo) { fo.kind = 'folder'; delete fo.ev; } S.cals = S.cals.filter(function (x) { return x !== c; }); save(); render(); toastUndo('「' + c.title + '」を削除しました'); }, true, ok ? '' : '告知の権限が必要']], e.clientX, e.clientY);
}, true);
