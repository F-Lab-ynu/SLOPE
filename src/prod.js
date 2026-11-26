
// =====================================================================
// 本番：Supabase 接続（ログイン・承認・業務の同期・リアルタイム・通知）
// =====================================================================
var SB_URL = 'https://addvjcwwlklwmkwhhsjv.supabase.co';
var SB_KEY = 'sb_publishable_L8VP_h67F3FupHwqC_3pTw_YRbBVghw';
var sb = window.supabase.createClient(SB_URL, SB_KEY);
var PREF_KEYS = ['view', 'wtab', 'depth', 'fold', 'view2', 'zoom', 'lw', 'lwN', 'showEnded', 'mtab', 'fmode', 'fcur', 'sideC', 'ftreeC', 'tkC', 'cur'];
var SYNC = { nodes: {}, profiles: {}, busy: Promise.resolve(), ready: false, pendingRemote: false };
S.pending = [];

// 業務は全員、教材・外部告知・掲示板は役職の権限、メンバーは代表だけ
// 最初の画面は業務。下（アカウントの上）にメッセージと自分（通知・担当）
navItems = function () { var l = TABS.filter(function (t) { return can(t.id); }); if (isAdmin()) l.push({ id: 'perms', name: 'メンバー' }); l.push({ id: 'stats', name: '統計' }, { id: 'me', name: '自分', low: 1 }, { id: 'stk', name: '付箋', low: 1 }, { id: 'dm', name: 'メッセージ', low: 1 }); return l; };
can = function (t) { return t === 'projects' || hasPerm(me(), t); };
function postPerms(post) { var p = POSTS.filter(function (x) { return x[0] === post; })[0]; return p ? p[1].slice() : []; }

function savePrefs() { var p = {}; PREF_KEYS.forEach(function (k) { if (S[k] !== undefined) p[k] = S[k]; }); try { localStorage.setItem(KEY + '-prefs', JSON.stringify(p)); } catch (e) {} }
function save() { savePrefs(); SYNC.ver = (SYNC.ver || 0) + 1; if (SYNC.ready) queueSync(); }

// ---------- ツリー ⇄ 行 ----------
var DKEYS = ['leads', 'memo', 'folder', 'purpose', 'place', 'review', 'links', 'nodate', 'ev'];
function cleanData(d) { var o = {}; DKEYS.forEach(function (k) { var v = d && d[k]; if (v == null || v === '' || v === false || (Array.isArray(v) && !v.length)) return; o[k] = v; }); return o; }
function norm(r) {
  return { id: r.id, parent_id: r.parent_id || null, pos: +r.pos || 0, title: r.title || '', kind: r.kind || null, announce: r.announce || null,
    reg: r.reg == null ? null : +r.reg, unit: r.unit || null, who: r.who || null, team: (r.team || []).filter(Boolean),
    start_date: r.start_date, end_date: r.end_date, done: !!r.done, data: cleanData(r.data) };
}
function rowsFromTree() {
  var out = {};
  (function each(list, par, d) {
    list.forEach(function (n, i) {
      var t = (d === 0 ? n.name : n.title) || '';
      if (n.fresh && !t) return; // 入力途中の空行はまだ送らない
      var ev = n.kind === 'event', fo = isFolder(n);
      out[n.id] = norm({ id: n.id, parent_id: par, pos: i, title: t, who: n.who, team: n.team, start_date: n.start, end_date: n.end, done: !fo ? n.done : false,
        kind: ev ? 'event' : (fo ? 'folder' : null), announce: ev ? (n.announce || 'before') : null, reg: ev ? (n.reg || 0) : null, unit: ev ? (n.unit || '') : null,
        data: { leads: n.leads, memo: n.memo, folder: fo && d > 0, purpose: n.purpose, place: n.place, review: n.review, links: n.links, nodate: !fo && !!n.nodate, ev: ev ? n.ev : null } });
      each(kids(n), n.id, d + 1);
    });
  })(S.projects, null, 0);
  return out;
}
function buildTree(rows) {
  var ch = {}, roots = [];
  rows.forEach(function (r) { if (r.parent_id) (ch[r.parent_id] = ch[r.parent_id] || []).push(r); else roots.push(r); });
  var byPos = function (a, b) { return a.pos - b.pos; };
  function mk(r, d) {
    var ks = (ch[r.id] || []).sort(byPos), dt = r.data || {}, n;
    if (d === 0) n = { id: r.id, name: r.title, kind: r.kind || 'folder', who: r.who || '', team: r.team || [], start: r.start_date, end: r.end_date, tasks: ks.map(function (k) { return mk(k, 1); }) };
    else {
      n = { id: r.id, title: r.title, who: r.who || '', team: r.team || [], start: r.start_date, end: r.end_date, done: r.done };
      if (r.kind) n.kind = r.kind;
      if (ks.length || dt.folder) { n.kids = ks.map(function (k) { return mk(k, d + 1); }); n.folder = true; delete n.done; }
    }
    if (r.kind === 'event') { n.announce = r.announce || 'before'; n.reg = r.reg || 0; n.unit = r.unit || ''; }
    DKEYS.forEach(function (k) { if (k !== 'folder' && dt[k] != null) n[k] = Array.isArray(dt[k]) ? dt[k].slice() : dt[k]; });
    return n;
  }
  return roots.sort(byPos).map(function (r) { return mk(r, 0); });
}
function toMember(p) { return { id: p.id, name: p.name || p.email, email: p.email, grade: p.grade || '', unit: p.post || '—', perms: postPerms(p.post), roles: p.roles || [], approved: p.approved }; }
function profKey(m) { return JSON.stringify([m.name, m.grade, m.unit, m.roles || [], m.approved !== false]); }
function fmtAt(iso) { var d = new Date(iso); return (d.getMonth() + 1) + '.' + d.getDate() + ' ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); }

async function loadAll() {
  var res = await Promise.all([
    sb.from('profiles').select('*').order('created_at'),
    sb.from('nodes').select('*'),
    sb.from('notifications').select('*').eq('to_id', S.me).order('created_at', { ascending: false }).limit(50),
    sb.from('items').select('*').order('created_at', { ascending: false }),
    sb.from('reports').select('*'),
    sb.from('reactions').select('item_id,kind,user_id').eq('kind', 'join'),
    sb.from('inquiries').select('*').order('created_at', { ascending: false })
  ]);
  if (res[6] && res[6].error) res[6] = { data: [] }; // お問い合わせは見られない人もいる
  for (var i = 0; i < res.length; i++) if (res[i].error) throw res[i].error;
  if (loadAll.guard != null && loadAll.guard !== SYNC.ver) return false; // 読み込み中に手元で変わった → 捨てて手元を優先
  var ps = res[0].data || [];
  S.members = ps.filter(function (p) { return p.approved; }).map(toMember);
  S.pending = ps.filter(function (p) { return !p.approved; }).map(toMember);
  S.self = ps.filter(function (p) { return p.id === S.me; })[0] || null;
  SYNC.profiles = {}; S.members.forEach(function (m) { SYNC.profiles[m.id] = profKey(m); });
  S.projects = buildTree(res[1].data || []);
  var joins = {}, jids = {}; (res[5].data || []).forEach(function (r) { joins[r.item_id] = (joins[r.item_id] || 0) + 1; (jids[r.item_id] = jids[r.item_id] || []).push(r.user_id); });
  S.joinIds = jids;
  S.inqs = (res[6].data || []).map(function (q) { return { id: q.id, user: q.user_id, kind: q.kind, body: q.body, status: q.status, reply: q.reply, at: fmtAt(q.created_at) }; }); // 出席を付けるとき、参加登録した人を上に
  S.joins = joins; // 参加登録の数（業務のイベントは node の id、学ぶのイベントは 'pe:' + id）
  (function walk(a) { a.forEach(function (n) { if (n.kind === 'event') n.reg = joins[n.id] || 0; walk(n.tasks || []); }); })(S.projects);
  itemsIn(res[3].data || [], res[4].data || []);
  var base = rowsFromTree(); SYNC.nodes = {}; for (var k in base) SYNC.nodes[k] = JSON.stringify(base[k]);
  S.notifs = (res[2].data || []).map(function (x) { return { id: x.id, link: x.link || '', to: x.to_id, text: x.text, sub: x.sub, kind: x.kind || '', at: fmtAt(x.created_at) }; });
}

// ---------- 変更の送信（前回との差分だけ） ----------
function queueSync() { SYNC.busy = SYNC.busy.then(syncNow).catch(function (e) { console.error(e); toast('保存に失敗しました。通信状態を確認してください'); }); return SYNC.busy; }
function depthIn(rows, id) { var d = 0, r = rows[id]; while (r && r.parent_id) { d++; r = rows[r.parent_id]; } return d; }
async function syncNow() {
  if (!SYNC.ready) return;
  var cur = rowsFromTree(), ins = [], upd = [], del = [], errs = [];
  Object.keys(cur).forEach(function (id) { var s = JSON.stringify(cur[id]); if (!(id in SYNC.nodes)) ins.push(cur[id]); else if (SYNC.nodes[id] !== s) upd.push(cur[id]); });
  Object.keys(SYNC.nodes).forEach(function (id) { if (!(id in cur)) del.push(id); });
  var mUpd = S.members.filter(function (m) { return SYNC.profiles[m.id] && SYNC.profiles[m.id] !== profKey(m); });
  var it = itemChanges();
  if (!ins.length && !upd.length && !del.length && !mUpd.length && !it.length) return;
  // 先に基準を更新（送信中の再描画で二重送信しないように）
  Object.keys(cur).forEach(function (id) { SYNC.nodes[id] = JSON.stringify(cur[id]); });
  del.forEach(function (id) { delete SYNC.nodes[id]; });
  S.members.forEach(function (m) { if (SYNC.profiles[m.id]) SYNC.profiles[m.id] = profKey(m); });
  ins.sort(function (a, b) { return depthIn(cur, a.id) - depthIn(cur, b.id); });
  for (var i = 0; i < ins.length; i++) { var r = await sb.from('nodes').insert(ins[i]); if (r.error) errs.push(r.error); }
  for (var j = 0; j < upd.length; j++) { var u = upd[j], r2 = await sb.from('nodes').update(u).eq('id', u.id).select('id'); if (r2.error) errs.push(r2.error); else if (!r2.data.length) errs.push({ message: '権限がありません' }); }
  if (del.length) { var r3 = await sb.from('nodes').delete().in('id', del).select('id'); if (r3.error) errs.push(r3.error); }
  for (var w = 0; w < it.length; w++) { var e = await it[w](); if (e) errs.push(e); }
  for (var q = 0; q < mUpd.length; q++) { var m = mUpd[q], r4 = await sb.from('profiles').update({ name: m.name, grade: m.grade, post: m.unit, roles: m.roles || [] }).eq('id', m.id).select('id'); if (r4.error || !r4.data.length) errs.push(r4.error || { message: '権限がありません' }); }
  if (errs.length) {
    console.warn(errs);
    var msg = errs[0].message || ''; toast(/row-level|権限/.test(msg) ? 'この変更は権限がないため保存されませんでした' : '保存できなかった変更があります：' + msg);
    await loadAll(); render();
  }
}

// ---------- 通知 ----------
window.__inqUpdate = function (id, patch) { sb.from('inquiries').update(patch).eq('id', id).then(function (r) { if (r.error) toast('保存できませんでした'); }); };
window.__inqDelete = function (id) { sb.from('inquiries').delete().eq('id', id).then(function (r) { if (r.error) toast('削除できませんでした'); }); };
window.notify = function (to, text, sub) {
  if (!to) return;
  var mine = to === S.me && !(window.__nBlocked && window.__nBlocked(to, text, sub)) ? { id: 'tmp' + Date.now() + Math.random(), to: to, text: text, sub: sub, at: nowLabel() } : null;
  if (mine) S.notifs.unshift(mine);
  var q = sb.from('notifications').insert({ to_id: to, text: text, sub: sub || '' });
  (mine && q.select ? q.select('id').single() : q).then(function (r) { if (r.error) { console.warn(r.error); return; } if (!mine || !r.data) return; if (mine.gone) sb.from('notifications').delete().eq('id', r.data.id).then(function () {}); else mine.id = r.data.id; }); // 自分宛ては id をもらって、すぐ消せるように
};

// ---------- ほかの人の変更をその場で反映 ----------
var remoteT = null;
function isBusyEditing() {
  var a = document.activeElement;
  return !!((a && a.matches && (a.matches('input,textarea,select') || a.isContentEditable) && !a.closest('#gate')) || M || mv || drag || lmv || lwd || UI.tp || UI.pp);
}
function onRemote(p) {
  // 自分の書き込みの「こだま」は無視（連続で動かしたときに一つ前へ戻らないように）
  if (p && p.table === 'nodes' && p.new && p.new.updated_by === S.me) return;
  clearTimeout(remoteT); remoteT = setTimeout(applyRemote, 250);
}
async function applyRemote() {
  var v;
  do { v = SYNC.ver; await SYNC.busy; } while (v !== SYNC.ver); // 手元の変更を送り切ってから読む
  var inDoc = document.activeElement && document.activeElement.id === 'fdoc'; // メモを書いている最中も、ほかの人の変更は取り込む
  if (isBusyEditing() && !inDoc) { SYNC.pendingRemote = true; return; }
  SYNC.pendingRemote = false;
  var y = window.scrollY;
  loadAll.guard = v; var ok = await loadAll(); loadAll.guard = null;
  if (ok === false) { onRemote(); return; } // 手元が変わったので、送ってからもう一度
  if (window.__docRemote) window.__docRemote();
  render(); window.scrollTo(0, y);
}
document.addEventListener('focusout', function () { setTimeout(function () { if (SYNC.pendingRemote && !isBusyEditing()) applyRemote(); }, 80); });
document.addEventListener('pointerup', function () { setTimeout(function () { if (SYNC.pendingRemote && !isBusyEditing()) applyRemote(); }, 300); });
// 同じメモを開いている人を出す（Google ドキュメントの右上のアイコンのように）
var DOCP = { id: null, ch: null, others: [] };
function docPresence() {
  var d = document.getElementById('fdoc'), id = d ? d.dataset.id : null;
  if (id !== DOCP.id) {
    if (DOCP.ch) { try { sb.removeChannel(DOCP.ch); } catch (e) {} DOCP.ch = null; }
    DOCP.id = id; DOCP.others = [];
    if (id) try {
      var ch = sb.channel('doc-' + id, { config: { presence: { key: S.me } } });
      if (ch.track && ch.presenceState) {
        ch.on('presence', { event: 'sync' }, function () { var st = ch.presenceState(); DOCP.others = Object.keys(st).filter(function (k) { return k !== S.me && member(k); }); paintPres(); })
          .subscribe(function (s) { if (s === 'SUBSCRIBED') ch.track({ at: Date.now() }); });
        DOCP.ch = ch;
      }
    } catch (e) {}
  }
  paintPres();
}
function paintPres() {
  var host = document.querySelector('.fpage2'); if (!host) return; var el = host.querySelector('.dpres'), o = DOCP.others;
  var html = o.length ? o.slice(0, 4).map(function (k) { return av(k); }).join('') + '<span>' + esc(member(o[0]).name) + (o.length > 1 ? ' ほか' + (o.length - 1) + '人' : '') + 'も開いています</span>' : '';
  if (!el) { if (!html) return; el = document.createElement('div'); el.className = 'dpres'; host.insertBefore(el, host.firstChild); }
  if (el.innerHTML !== html) el.innerHTML = html; el.hidden = !html;
}
setInterval(docPresence, 1000);
function subscribe() {
  sb.channel('slope-live')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'nodes' }, onRemote)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, onRemote)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'items' }, onRemote)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'reports' }, onRemote)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'inquiries' }, onRemote)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'reactions' }, onRemote)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: 'to_id=eq.' + S.me }, onRemote)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'dms' }, function () { dmaRemote(); })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'dm_rooms' }, function () { dmaRemote(); })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'stickies' }, function () { stkRemote(); })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'sticky_msgs' }, function () { stkRemote(); })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'groups' }, function () { grpLoad().then(function () { if (S.view === 'perms') render(); }); })
    .subscribe();
}

// ---------- 画面：アカウント（ログアウト）・メンバー承認 ----------
function renderChrome() {
  var m = me(), c = counts();
  var navBtn = function (v) {
    var SH = { dash: 'ホーム', tracks: '教材', notices: '告知', board: 'サポート', projects: '業務', perms: 'メンバー', stats: '統計', me: '自分', stk: '付箋', dm: 'メッセージ' };
    return '<button data-act="go" data-view="' + v.id + '"' + (S.view === v.id ? ' aria-current="page"' : '') + '>' + ic(v.id) + '<span class="full">' + v.name + '</span><span class="short">' + (SH[v.id] || v.name) + '</span>' + (c[v.id] ? '<span class="n" title="' + ((typeof BADGE !== 'undefined' && BADGE[v.id]) || (v.id === 'perms' ? '承認待ち' : '')) + ' ' + c[v.id] + '件">' + c[v.id] + '</span>' : '') + '</button>';
  };
  var NV = navItems(); document.getElementById('nav').innerHTML = NV.filter(function (v) { return !v.low; }).map(navBtn).join('');
  var n2 = document.getElementById('nav2'); if (n2) n2.innerHTML = NV.filter(function (v) { return v.low; }).map(navBtn).join('');
  var hic = function (id, lab) { return '<button class="hic" data-hic="' + id + '"' + (S.view === id ? ' aria-pressed="true"' : '') + ' data-view="' + id + '" aria-label="' + lab + '">' + ic(id) + (c[id] ? '<span class="n">' + c[id] + '</span>' : '') + '</button>'; };
  document.getElementById('acct').innerHTML = hic('me', '自分') + hic('stk', '付箋') + hic('dm', 'メッセージ') + '<div class="mode"><span>運営</span><button class="msw on" data-to="./" role="switch" aria-checked="true" aria-label="部員画面に切り替える"><i></i></button></div>' + '<button data-act="acct" aria-haspopup="true" aria-expanded="' + UI.acct + '">' + av(m.id, 'lg') + '<span class="who"><b>' + esc(m.name) + '</b><span>' + esc(m.unit === '—' ? '部員' : m.unit) + '</span></span>' + ic('chev') + '</button>' +
    (UI.acct ? '<div class="menu" role="menu"><div class="msm">' + (isAdmin() ? '<button role="menuitem" data-act="go" data-view="perms">' + ic('perms') + '<span>メンバー</span></button>' : '') + '<button role="menuitem" data-act="go" data-view="stats">' + ic('stats') + '<span>統計</span></button>' + '<button role="menuitem" class="mtomem" onclick="location.replace(\'./\')">' + ic('back') + '<span>部員画面に切り替える</span></button>' + '<button role="menuitem" data-act="nset">' + ic('bell') + '<span>通知の設定</span></button></div><div class="mh">' + esc(m.email || '') + '</div><button role="menuitem" data-act="logout"><span>ログアウト</span></button></div>' : '');
}
function counts() {
  return {
    notices: can('notices') ? S.offers.filter(function (o) { return o.state === 'wait'; }).length : 0,
    board: can('board') ? S.posts.filter(function (p) { return p.reports > 0 && p.state === 'ok'; }).length : 0,
    projects: S.projects.reduce(function (n, p) { return n + leavesOf(p).filter(function (k) { return late(k) && (isAdmin() || chainHas(k, S.me)); }).length; }, 0),
    dash: myTasks(S.me).filter(function (o) { return !isDone(o.k); }).length,
    me: (typeof opsNotifs === 'function' ? opsNotifs() : S.notifs || []).filter(function (n) { return n.to === S.me; }).length,
    dm: typeof dmaUnread === 'function' ? dmaUnread() : 0,
    stk: typeof STK !== 'undefined' ? STK.list.filter(function (s) { return s.author !== S.me && (s.mentions || []).indexOf(S.me) >= 0 && stkLeft(s) > 0; }).length : 0,
    perms: isAdmin() ? S.pending.length : 0
  };
}
var _viewPerms0 = viewPerms;
viewPerms = function () {
  var html = _viewPerms0();
  if (!S.pending.length) return html;
  var block = '<div><div class="pendbox" style="margin-bottom:16px"><div class="ch">承認待ち <span class="num">' + S.pending.length + '</span></div>' +
    S.pending.map(function (p) {
      return '<div class="pendrow">' + av(p.id, 'lg') + '<div class="cell2" style="flex:1;min-width:0"><span style="font-weight:500">' + esc(p.name) + '</span><span class="s">' + esc([p.grade, p.email].filter(Boolean).join('・')) + '</span></div>' +
        '<button class="btn sm ghost" data-act="reject" data-id="' + p.id + '">却下</button><button class="btn sm primary" data-act="approve" data-id="' + p.id + '">承認</button></div>';
    }).join('') + '</div></div>';
  return html.replace('<div class="body"><div class="tw">', '<div class="body">' + block + '<div class="tw">');
};
// member() は承認待ちの人も引けるように
member = function (id) { return S.members.filter(function (m) { return m.id === id; })[0] || (S.pending || []).filter(function (m) { return m.id === id; })[0]; };

document.addEventListener('click', function (e) {
  var b = e.target.closest && e.target.closest('[data-act="logout"],[data-act="approve"],[data-act="reject"],[data-act="glogin"],[data-act="gprof"]'); if (!b) return;
  e.stopImmediatePropagation(); e.preventDefault();
  var a = b.dataset.act;
  if (a === 'logout') { sb.auth.signOut().then(function () { location.replace(location.pathname); }); return; }
  if (a === 'glogin') { b.disabled = true; sb.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: location.origin + location.pathname } }).then(function (r) { if (r.error) { b.disabled = false; gateMsg(r.error.message); } }); return; }
  if (a === 'gprof') {
    var nm = document.getElementById('gName').value.trim(), gr = document.getElementById('gGrade').value.trim();
    if (!nm) { gateMsg('名前を入力してください'); return; }
    sb.from('profiles').update({ name: nm, grade: gr }).eq('id', S.me).then(function (r) { gateMsg(r.error ? '保存できませんでした：' + r.error.message : '保存しました。承認されるまでお待ちください', !r.error); });
    return;
  }
  var id = b.dataset.id, p = member(id); if (!p) return;
  if (a === 'approve') {
    b.disabled = true;
    sb.from('profiles').update({ approved: true }).eq('id', id).select('id').then(async function (r) {
      if (r.error || !r.data.length) { toast('承認できませんでした'); b.disabled = false; return; }
      window.notify(id, 'SLOPE運営画面の利用が承認されました', '');
      await loadAll(); render(); toast(p.name + 'を承認しました');
    });
  }
  if (a === 'reject') {
    if (!confirmOnce(b, 'もう一度押すと却下')) return;
    sb.from('profiles').delete().eq('id', id).then(async function (r) { if (r.error) { toast('却下できませんでした'); return; } await loadAll(); render(); toast(p.name + 'を却下しました'); });
  }
}, true);
function confirmOnce(b, label) { if (b.dataset.armed) return true; b.dataset.armed = '1'; b.textContent = label; b.classList.add('danger'); setTimeout(function () { if (b.isConnected) { delete b.dataset.armed; b.textContent = '却下'; b.classList.remove('danger'); } }, 3000); return false; }

// ---------- ログイン前・承認待ちの画面 ----------
function gate(kind, extra) {
  var g = document.getElementById('gate');
  if (kind === 'loading' && document.getElementById('boot')) return; // 起動時のロゴのアニメーションをそのまま見せる
  if (kind !== 'loading' && window.__bootDone) window.__bootDone();
  if (!kind) { if (g) g.remove(); return; }
  if (!g) { g = document.createElement('div'); g.id = 'gate'; document.body.appendChild(g); }
  var logo = '<div class="glogo">' + ic('logo') + '<b>SLOPE</b><span>運営</span></div>';
  var body = '';
  if (kind === 'loading') { g.innerHTML = '<div id="boot" role="status" aria-label="読み込み中" style="--bootbg:#fff;--bootfg:#111827">' + (document.querySelector('.bootlogo') ? '' : '') + '<svg class="bootlogo" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 4.5c5-1.4 13-1.4 18 0-.6 1.3-1.5 2.2-2.6 2.6-4.3-.7-8.5-.7-12.8 0C4.5 6.7 3.6 5.8 3 4.5z" fill="currentColor"/><path d="M7.3 9.2l7.2-.3-.6 1.9 3.6-.1-2.4 3.4-3.3.1L9.3 21z" fill="currentColor"/></svg></div>'; return; }
  if (kind === 'login') body = '<h1>ログイン</h1><p class="gsub">横浜国立大学 起業部の運営画面です。</p><button class="gbtn" data-act="glogin"><svg viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>Googleでログイン</button>';
  if (kind === 'pending') body = '<h1>承認待ち</h1><p class="gsub">運営（代表）が承認すると使えるようになります。名前と学部・学年を入れておいてください。</p>' +
    '<label class="gf">名前<input id="gName" class="input" value="' + esc(extra && extra.name || '') + '"></label>' +
    '<label class="gf">学部・学年<input id="gGrade" class="input" value="' + esc(extra && extra.grade || '') + '"></label>' +
    '<button class="btn primary" data-act="gprof" style="width:100%;height:40px">保存</button><button class="btn ghost" data-act="logout" style="width:100%;margin-top:8px">ログアウト</button>';
  if (kind === 'error') body = '<h1>読み込めませんでした</h1><p class="gsub">' + esc(extra || '') + '</p><button class="btn" onclick="location.reload()">再読み込み</button> <button class="btn ghost" data-act="logout">ログアウト</button>';
  g.innerHTML = '<div class="gcard">' + logo + body + '<p class="gmsg" id="gmsg" role="status"></p></div>';
}
function gateMsg(t, ok) { var m = document.getElementById('gmsg'); if (m) { m.textContent = t; m.className = 'gmsg' + (ok ? ' ok' : ''); } }

// Googleから戻った直後にセッションの読み取りが遅れても、ログイン画面に戻さない
async function getSessionSure() {
  var s = await sb.auth.getSession(), session = s.data && s.data.session;
  if (session) return session;
  var h = new URLSearchParams(location.hash.slice(1)), q = new URLSearchParams(location.search);
  if (h.get('error_description') || q.get('error_description')) { gate('login'); gateMsg(h.get('error_description') || q.get('error_description')); return null; }
  if (h.get('access_token') && h.get('refresh_token')) {
    var r = await sb.auth.setSession({ access_token: h.get('access_token'), refresh_token: h.get('refresh_token') });
    if (r.data && r.data.session) return r.data.session;
  }
  if (q.get('code')) { var r2 = await sb.auth.exchangeCodeForSession(q.get('code')).catch(function () { return {}; }); if (r2.data && r2.data.session) return r2.data.session; }
  for (var i = 0; i < 10 && (h.get('access_token') || q.get('code')); i++) { await new Promise(function (ok) { setTimeout(ok, 300); }); s = await sb.auth.getSession(); if (s.data && s.data.session) return s.data.session; }
  return null;
}
async function boot() {
  try { var p = JSON.parse(localStorage.getItem(KEY + '-prefs')) || {}; Object.keys(p).forEach(function (k) { S[k] = p[k]; }); } catch (e) {}
  S.fcur = ''; S.fmode = 'card'; // 業務は開くたびに「すべて」のカードから
  S.manualOrder = true;
  gate('loading');
  var session = await getSessionSure();
  if (!session) { gate('login'); return; }
  if (S.me) return; S.me = session.user.id;
  if (location.hash || location.search) history.replaceState(null, '', location.pathname);
  try { await loadAll(); } catch (e) { gate('error', e.message); return; }
  if (!S.self) { gate('error', 'アカウント情報が見つかりません。管理者に連絡してください'); return; }
  if (!S.self.approved) {
    gate('pending', S.self);
    var t = setInterval(async function () { var r = await sb.from('profiles').select('approved').eq('id', S.me).single(); if (r.data && r.data.approved) { clearInterval(t); location.reload(); } }, 10000);
    return;
  }
  gate(null); SYNC.ready = true; trackVisit('open'); render(); subscribe(); dmaLoad().then(renderChrome); grpLoad(); stkLoad().then(stkPaint);
}
sb.auth.onAuthStateChange(function (ev) { if (ev === 'SIGNED_OUT') location.replace(location.pathname); if (ev === 'SIGNED_IN' && !S.me && document.querySelector('[data-act=glogin]')) setTimeout(boot, 0); });


// ---------- 教材・外部告知・掲示板（items 表） ----------
var BOARD_KINDS = ['recruit', 'idea', 'pain', 'other', 'comment'];
var KIND_LABEL = { recruit: '募集', idea: '意見', pain: 'ペイン', other: 'フリー', comment: 'コメント' };
function whoLabel(uid) { var m = member(uid); return m ? m.name + (m.grade ? ' · ' + m.grade : '') : '（退部した部員）'; }
function itemsIn(items, reports) {
  var byId = {}; items.forEach(function (x) { byId[x.id] = x; });
  var rep = {}; reports.forEach(function (r) { (rep[r.item_id] = rep[r.item_id] || []).push(r.reason); });
  S.tracks = items.filter(function (x) { return x.kind === 'track'; }).sort(function (a, b) { return a.pos - b.pos; })
    .map(function (x) { var t = Object.assign({ name: '', owner: '', status: 'draft', start: '基礎教育 修了', goal: '修了', updated: '', text: '', units: {} }, x.data, { id: x.id }); if (!t.units) t.units = {}; return t; });
  S.notices = items.filter(function (x) { return x.kind === 'notice'; }).map(function (x) { return Object.assign({ type: 'その他', title: '', host: '', due: isoOf(TODAY), url: '', memo: '', state: 'draft' }, x.data, { id: x.id }); });
  S.offers = items.filter(function (x) { return x.kind === 'offer'; }).map(function (x) { return Object.assign({ type: 'その他', title: '', host: '', due: '', url: '', note: '', state: 'wait' }, x.data, { id: x.id, by: whoLabel(x.author) }); });
  S.posts = items.filter(function (x) { return BOARD_KINDS.indexOf(x.kind) >= 0 && x.state !== 'deleted'; }).map(function (x) {
    var d = x.data || {}, rs = rep[x.id] || [], par = x.parent_id && byId[x.parent_id];
    var reason = rs.slice().sort(function (a, b) { return rs.filter(function (v) { return v === b; }).length - rs.filter(function (v) { return v === a; }).length; })[0] || '';
    return { id: x.id, kind: x.kind, text: d.title || d.text || '', who: whoLabel(x.author), time: fmtAt(x.created_at), on: par ? '「' + ((par.data || {}).title || (par.data || {}).text || '').slice(0, 20) + '」' : '', tab: x.kind === 'other' ? (d.tag || 'その他') : KIND_LABEL[x.kind], reports: rs.length, reason: reason, state: x.state };
  });
  // DM の通報（運営は DM を読めないので、通報した人が添えた直近のやり取りだけを見る）。できるのは「問題なし」だけ
  Object.keys(rep).filter(function (k) { return /^dm:/.test(k); }).forEach(function (k) {
    var rs = rep[k], first = reports.filter(function (r) { return r.item_id === k; })[0] || {};
    S.posts.push({ id: k, kind: 'dm', dm: true, text: rs[rs.length - 1], who: whoLabel(k.slice(3)), time: fmtAt(first.created_at), on: '', tab: 'DM', reports: rs.length, reason: '', state: 'ok' });
  });
  S.cals = items.filter(function (x) { return x.kind === 'cal' && x.state !== 'deleted'; }).map(function (x) { return Object.assign({ title: '', date: isoOf(TODAY), time: '', place: '', memo: '', state: 'pub' }, x.data, { id: x.id }); });
  S.anns = items.filter(function (x) { return x.kind === 'ann' && x.state !== 'deleted'; }).map(function (x) { return Object.assign({ title: '', body: '', until: '', at: x.created_at || '', cid: '' }, x.data, { id: x.id }); });
  var pg = items.filter(function (x) { return x.kind === 'program'; })[0]; S.program = pg ? pg.data : null;
  S.patches = items.filter(function (x) { return x.kind === 'patch' && x.state !== 'deleted'; }).sort(function (a, b) { return a.pos - b.pos; }).map(function (x) { return Object.assign({ date: '', title: '', note: '', state: 'done' }, x.data, { id: x.id }); });
  SYNC.items = {};
  S.patches.forEach(function (x, i) { SYNC.items[x.id] = JSON.stringify(trackData(x, i)); });
  S.cals.forEach(function (c) { SYNC.items[c.id] = JSON.stringify(noticeData(c)); });
  S.anns.forEach(function (a) { SYNC.items[a.id] = JSON.stringify(noticeData(a)); });
  S.tracks.forEach(function (t, i) { SYNC.items[t.id] = JSON.stringify(trackData(t, i)); });
  if (S.program) SYNC.items.program = JSON.stringify({ data: S.program });
  S.notices.forEach(function (n) { SYNC.items[n.id] = JSON.stringify(noticeData(n)); });
  S.offers.forEach(function (o) { SYNC.items[o.id] = o.state; });
  S.posts.forEach(function (p) { SYNC.items[p.id] = p.state + '|' + p.reports; });
}
function trackData(t, i) { var d = {}; Object.keys(t).forEach(function (k) { if (k !== 'id') d[k] = t[k]; }); return { data: d, pos: i }; }
function noticeData(n) { var d = {}; Object.keys(n).forEach(function (k) { if (k !== 'id') d[k] = n[k]; }); return { data: d }; }
function itemChanges() {
  var ops = [], seen = {};
  var put = function (kind, id, payload, ok) {
    seen[id] = 1; if (!ok) return; var s = JSON.stringify(payload);
    if (!(id in SYNC.items)) { SYNC.items[id] = s; ops.push(function () { return sb.from('items').insert(Object.assign({ id: id, kind: kind, author: S.me }, payload)).then(function (r) { return r.error; }); }); }
    else if (SYNC.items[id] !== s) { SYNC.items[id] = s; ops.push(function () { return sb.from('items').update(payload).eq('id', id).select('id').then(function (r) { return r.error || (!r.data.length ? { message: '権限がありません' } : null); }); }); }
  };
  S.tracks.forEach(function (t, i) { put('track', t.id, trackData(t, i), can('tracks')); });
  if (S.program) put('program', 'program', { data: S.program }, can('tracks'));
  S.notices.forEach(function (n) { put('notice', n.id, noticeData(n), can('notices')); });
  (S.patches || []).forEach(function (x, i) { put('patch', x.id, trackData(x, i), isAdmin()); });
  (S.cals || []).forEach(function (c) { put('cal', c.id, noticeData(c), can('notices')); });
  (S.anns || []).forEach(function (a) { put('ann', a.id, noticeData(a), can('notices')); });
  S.offers.forEach(function (o) {
    seen[o.id] = 1; if (SYNC.items[o.id] === o.state || !can('notices')) return; SYNC.items[o.id] = o.state;
    ops.push(function () { return sb.from('items').select('data').eq('id', o.id).single().then(function (r) { if (r.error) return r.error; return sb.from('items').update({ data: Object.assign({}, r.data.data, { state: o.state }) }).eq('id', o.id).then(function (u) { return u.error; }); }); });
  });
  S.posts.forEach(function (p) {
    seen[p.id] = 1; var key = p.state + '|' + p.reports; if (SYNC.items[p.id] === key || !can('board')) return;
    var old = (SYNC.items[p.id] || '').split('|'); SYNC.items[p.id] = key;
    if (p.dm) { if (+old[1] > 0 && p.reports === 0) ops.push(function () { return sb.from('reports').delete().eq('item_id', p.id).then(function (r) { return r.error; }); }); return; }
    if (old[0] !== p.state) ops.push(function () { return sb.from('items').update({ state: p.state }).eq('id', p.id).select('id').then(function (r) { return r.error || (!r.data.length ? { message: '権限がありません' } : null); }); });
    if (+old[1] > 0 && p.reports === 0) ops.push(function () { return sb.from('reports').delete().eq('item_id', p.id).then(function (r) { return r.error; }); });
  });
  Object.keys(SYNC.items).forEach(function (id) {
    if (seen[id]) return; delete SYNC.items[id];
    if (!can('tracks') && !can('notices') && !can('board')) return;
    ops.push(function () { return sb.from('items').delete().eq('id', id).select('id').then(function (r) { return r.error; }); });
  });
  return ops;
}
// ---------- アクセス記録と統計 ----------
function __trackMk(sb, app) {
  return function (tab) {
    tab = tab || 'open';
    try { var k = 'slope-trk-' + app + '-' + tab, t = +sessionStorage.getItem(k) || 0; if (Date.now() - t < 10 * 60 * 1000) return; sessionStorage.setItem(k, String(Date.now())); } catch (e) {}
    try { sb.from('visits').insert({ app: app, tab: tab }).then(function () {}, function () {}); } catch (e) {}
  };
}
var trackVisit = __trackMk(sb, 'admin'), _lastView = null, _accAt = 0;
var _renderAcc = render;
render = function () {
  _renderAcc.apply(this, arguments);
  if (!SYNC.ready) return;
  if (S.view !== _lastView) { _lastView = S.view; trackVisit(S.view); }
  if (S.view === 'dash' && isAdmin() && Date.now() - _accAt > 60000) {
    _accAt = Date.now();
    sb.rpc('visit_stats', { days: 14 }).then(function (r) { if (r.error || !r.data) return; S.access = r.data; if (S.view === 'dash') _renderAcc(); });
  }
};
document.addEventListener('visibilitychange', function () { if (!document.hidden && SYNC.ready) trackVisit('open'); });

// 通知の削除（自分あての通知だけ消せる）
window.__delNotif = function (id) { // id は数（画面からは文字で来る）。保存中（tmp）のものは、id が届いたら消す
  var me0 = S.me; (S.notifs || []).forEach(function (n) { if (id !== 'all' && String(n.id) === String(id)) n.gone = true; });
  S.notifs = (S.notifs || []).filter(function (n) { return id === 'all' ? n.to !== me0 : String(n.id) !== String(id); });
  if (/^tmp/.test(String(id))) return;
  var q = sb.from('notifications').delete(); (id === 'all' ? q.eq('to_id', me0) : q.eq('id', /^\d+$/.test(String(id)) ? +id : id)).then(function (r) { if (r.error) toast('削除できませんでした'); });
};

// ---------- 通知の設定（部員アプリと同じ profiles.notif_off / notif_mute）・この端末へのプッシュ ----------
window.__nSave = function (p) { sb.from('profiles').update({ notif_off: p.off, notif_app: p.app, notif_mute: p.mute, notif_due: p.due }).eq('id', S.me).then(function (r) { if (r.error) toast('通知の設定を保存できませんでした'); }); };
window.__adminPush = (function () {
  var VAPID = 'BNYuEXq2mMrHbNn06huazGpyd0PqDbp-CVXr2TJ7Ev-8Oy2OCjJzbW-DVeopb2BcvZHMoS5g98I5VUw4i8jXlgU', on = null;
  function state() {
    var ios = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1), app = (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone;
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return ios && !app ? 'ios' : 'no';
    if (Notification.permission === 'denied') return 'denied';
    if (on === null) { on = false; navigator.serviceWorker.ready.then(function (r) { return r.pushManager.getSubscription(); }).then(function (x) { if (x) { on = true; if (window.__nsRender) window.__nsRender(); } }).catch(function () {}); }
    return on ? 'on' : 'off';
  }
  function toggle(done) {
    var st = state(); if (st !== 'on' && st !== 'off') return;
    if (st === 'on') { navigator.serviceWorker.ready.then(function (r) { return r.pushManager.getSubscription(); }).then(function (x) { if (!x) return; sb.from('push_subs').delete().eq('endpoint', x.endpoint).then(function () {}); return x.unsubscribe(); }).then(function () { on = false; done && done(); }); return; }
    var key = (function (b) { b = b.replace(/-/g, '+').replace(/_/g, '/'); b += '===='.slice(b.length % 4 || 4); var r = atob(b), a = new Uint8Array(r.length); for (var i = 0; i < r.length; i++) a[i] = r.charCodeAt(i); return a; })(VAPID);
    Notification.requestPermission().then(function (p) {
      if (p !== 'granted') { done && done(); return; }
      return navigator.serviceWorker.ready.then(function (r) { return r.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key }); }).then(function (x) {
        var j = x.toJSON(); return sb.from('push_subs').upsert({ user_id: S.me, endpoint: j.endpoint, p256dh: j.keys.p256dh, auth: j.keys.auth }, { onConflict: 'endpoint' });
      }).then(function (r) { if (r && r.error) { toast('うまく登録できませんでした'); return; } on = true; toast('この端末で通知を受け取ります'); done && done(); });
    }).catch(function () { toast('うまく登録できませんでした'); });
  }
  return { state: state, toggle: toggle };
})();

// ---------- メッセージ（部員アプリと同じ DM。運営画面では左に一覧・右に会話）。1対1は相手の id、グループは 'r-<room>' ----------
var DMA_TOUCH = matchMedia('(hover: none)').matches || window.innerWidth <= 760; // スマホは Enter で改行、送信はボタン
var DMA = { list: [], blocks: [], rooms: [], reads: {}, sel: null, pick: false, psel: [], q: '', files: [], urls: {}, asked: {}, ready: false };
function dmaConv(a, b) { return a < b ? a + '_' + b : b + '_' + a; }
function dmaIsRoom(k) { return /^r-/.test(k || ''); }
function dmaRoom(k) { var id = String(k || '').replace(/^r-/, ''); return DMA.rooms.filter(function (r) { return r.id === id; })[0] || null; }
function dmaRoomName(r) { return r ? (r.name || r.members.filter(function (u) { return u !== S.me && member(u); }).map(function (u) { return member(u).name; }).join('・') || 'グループ') : ''; }
function dmaRoomUnread(k) { var at = DMA.reads[k] || ''; return DMA.list.filter(function (m) { return m.conv === k && m.from_id !== S.me && m.created_at > at; }).length; }
function dmaUnread() { return DMA.list.filter(function (m) { return !m.room && m.to_id === S.me && !m.read_at && DMA.blocks.indexOf(m.from_id) < 0; }).length + DMA.rooms.reduce(function (n, r) { return n + dmaRoomUnread('r-' + r.id); }, 0); }
async function dmaLoad() {
  try { var r = await Promise.all([sb.from('dms').select('*').order('created_at', { ascending: false }).limit(1000), sb.from('dm_blocks').select('blocked').eq('blocker', S.me), sb.from('dm_rooms').select('*'), sb.from('dm_reads').select('*').eq('user_id', S.me)]);
    if (!r[0].error) DMA.list = r[0].data || []; if (!r[1].error) DMA.blocks = (r[1].data || []).map(function (x) { return x.blocked; });
    if (!r[2].error) DMA.rooms = (r[2].data || []).filter(function (x) { return (x.members || []).indexOf(S.me) >= 0; }); if (!r[3].error) { DMA.reads = {}; (r[3].data || []).forEach(function (x) { DMA.reads[x.conv] = x.at; }); } DMA.ready = true; } catch (e) { console.warn(e); }
}
var dmaT = null;
function dmaRemote() { clearTimeout(dmaT); dmaT = setTimeout(async function () { await dmaLoad(); renderChrome(); if (S.view === 'dm') dmaPaint(); }, 150); }
function dmaPeople() { return S.members.filter(function (m) { return m.id !== S.me && m.approved !== false; }); }
function dmaThreads() {
  var by = {}; DMA.list.forEach(function (m) { if (m.room) return; var o = m.from_id === S.me ? m.to_id : m.from_id; if (!by[o] || by[o].created_at < m.created_at) by[o] = m; });
  var one = Object.keys(by).filter(member).map(function (o) { return { key: o, uid: o, last: by[o], t: by[o].created_at, unread: DMA.list.filter(function (m) { return m.from_id === o && m.to_id === S.me && !m.read_at; }).length }; });
  var rs = DMA.rooms.map(function (r) { var k = 'r-' + r.id, last = DMA.list.filter(function (m) { return m.conv === k; }).reduce(function (a, m) { return !a || a.created_at < m.created_at ? m : a; }, null); return { key: k, room: r, last: last, t: last ? last.created_at : r.created_at, unread: dmaRoomUnread(k) }; });
  return one.concat(rs).sort(function (a, b) { return a.t < b.t ? 1 : -1; });
}
function dmaWith(k) { var c = dmaIsRoom(k) ? k : dmaConv(S.me, k); return DMA.list.filter(function (m) { return m.conv === c; }).sort(function (a, b) { return a.created_at < b.created_at ? -1 : 1; }); }
function dmaTime(iso) { var d = new Date(iso), n = new Date(), p = function (x) { return (x < 10 ? '0' : '') + x; }; if (d.toDateString() === n.toDateString()) return p(d.getHours()) + ':' + p(d.getMinutes()); return (d.getMonth() + 1) + '/' + d.getDate(); }
function dmaWant(paths) {
  var need = paths.filter(function (p) { return !DMA.urls[p] && !DMA.asked[p]; }); if (!need.length) return; need.forEach(function (p) { DMA.asked[p] = 1; });
  sb.storage.from('dm').createSignedUrls(need, 86400).then(function (r) { (r.data || []).forEach(function (x) { if (x.signedUrl) DMA.urls[x.path] = x.signedUrl; }); if (S.view === 'dm') dmaPaint(); }).catch(function () {});
}
function dmaAvs(ids) { return '<span class="avs dmaavs">' + ids.slice(0, 2).map(function (u) { return av(u); }).join('') + '</span>'; }
function dmaListHTML() {
  if (DMA.pick) {
    var q = DMA.q || '', gq = /^[@＠]/.test(q) ? q.slice(1) : null, R1 = DMA.addTo && dmaRoom(DMA.addTo);
    if (gq != null) { var gs = (typeof grpAll === 'function' ? grpAll() : []).filter(function (g) { return g.name.indexOf(gq) >= 0; }); return gs.length ? gs.map(function (g) { var ms = g.members.filter(function (u) { return u !== S.me; }); return '<button class="dmar" data-dma-grp="' + esc(g.name) + '"' + (ms.length ? '' : ' disabled') + '>' + dmaAvs(ms) + '<span class="dmam"><b>' + esc(g.name) + '</b><small>' + ms.length + '人をまとめて選ぶ</small></span></button>'; }).join('') : '<div class="empty sm">該当するグループはありません</div>'; }
    var ps = dmaPeople().filter(function (m) { return !(R1 && R1.members.indexOf(m.id) >= 0) && (!q || (m.name + (m.grade || '')).indexOf(q) >= 0); });
    return ps.length ? ps.map(function (m) { var on = DMA.psel.indexOf(m.id) >= 0; return '<button class="dmar pk' + (on ? ' on' : '') + '" data-dma-psel="' + m.id + '">' + av(m.id) + '<span class="dmam"><b>' + esc(m.name) + '</b><small>' + esc(m.grade || '') + '</small></span><input type="checkbox" class="check" tabindex="-1"' + (on ? ' checked' : '') + '></button>'; }).join('') : '<div class="empty sm">見つかりません</div>';
  }
  var T = dmaThreads(); if (!T.length) return '<div class="empty sm">まだメッセージはありません</div>';
  return T.map(function (t) { var m = t.last, nm = t.room ? dmaRoomName(t.room) : member(t.uid).name, txt = m ? (m.from_id === S.me ? 'あなた：' : t.room ? (member(m.from_id) ? member(m.from_id).name : '') + '：' : '') + (m.body || '写真') : 'グループを作りました';
    return '<button class="dmar' + (t.unread ? ' new' : '') + (DMA.sel === t.key ? ' on' : '') + '" data-dma-to="' + t.key + '">' + (t.room ? dmaAvs(t.room.members.filter(function (u) { return u !== S.me; })) : av(t.uid)) + '<span class="dmam"><b>' + esc(nm) + '</b><small>' + esc(txt.replace(/\s+/g, ' ')) + '</small></span><span class="dmat num">' + dmaTime(t.t) + '</span>' + (t.unread ? '<i class="dmadot"></i>' : '') + '</button>'; }).join('');
}
function dmaMsgsHTML() {
  var k = DMA.sel, rm = dmaIsRoom(k), R0 = rm && dmaRoom(k);
  if (!k || (rm ? !R0 : !member(k))) return '<div class="dmaempty">' + ic('dm') + '<b>メッセージ</b><span>左から相手を選ぶか、「新しく送る」から始めます。部員アプリのメッセージと同じものです。複数人を選ぶとグループになります。</span></div>';
  var L = dmaWith(k), out = '', prev = null, lastMine = null; L.forEach(function (m) { if (m.from_id === S.me) lastMine = m; });
  L.forEach(function (m) {
    var gap = !prev || new Date(m.created_at) - new Date(prev.created_at) > 3600000;
    if (gap) { var d = new Date(m.created_at); out += '<div class="dmats num">' + (d.getMonth() + 1) + '月' + d.getDate() + '日 ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0') + '</div>'; }
    var mine = m.from_id === S.me, ps = (m.imgs || []).filter(Boolean), head = gap || !prev || prev.from_id !== m.from_id; if (ps.length) dmaWant(ps);
    out += '<div class="dmam2' + (mine ? ' me' : '') + '" data-dma-id="' + m.id + '">' + (rm && !mine && head ? '<span class="dmafrom">' + esc(member(m.from_id) ? member(m.from_id).name : '') + '</span>' : '') + (ps.length ? '<div class="dmaim">' + ps.map(function (p) { return DMA.urls[p] ? '<img src="' + esc(DMA.urls[p]) + '" alt="" data-dma-img="' + esc(DMA.urls[p]) + '">' : '<span class="ph"></span>'; }).join('') + '</div>' : '') + (m.body ? '<div class="dmab">' + linkify(m.body).replace(/\n/g, '<br>') + '</div>' : '') + '</div>';
    if (!rm && m === lastMine && m.read_at) out += '<div class="dmard">既読</div>';
    prev = m;
  });
  return out || '<div class="empty sm">まだやり取りはありません</div>';
}
function viewDm() {
  if (!DMA.ready) dmaLoad().then(function () { if (S.view === 'dm') render(); });
  var k = DMA.sel, rm = dmaIsRoom(k), R0 = rm && dmaRoom(k), ok = k && (rm ? R0 : member(k)), mm = ok && !rm && member(k), blk = ok && !rm && DMA.blocks.indexOf(k) >= 0;
  var left = '<aside class="dmal"><div class="dmah">' + (DMA.pick ? '<button class="ib" data-dma-back aria-label="戻る">' + ic('back') + '</button><input class="input" id="dmaq" placeholder="名前で探す（＠でグループ）" autocomplete="off" value="' + esc(DMA.q) + '">' : '<span class="muted" style="font-size:12px">相手</span><span class="sp"></span><button class="btn sm" data-dma-new>新しく送る</button>') + '</div>' +
    (DMA.pick && DMA.psel.length ? '<div class="dmachips">' + DMA.psel.map(function (u) { return '<button data-dma-psel="' + u + '">' + esc(member(u).name) + ' ×</button>'; }).join('') + '</div>' : '') +
    '<div class="dmalist" id="dmalist">' + dmaListHTML() + '</div>' +
    (DMA.pick && DMA.psel.length ? '<div class="dmapf">' + (DMA.psel.length > 1 && !DMA.addTo ? '<input class="input" id="dmarn" placeholder="グループの名前（なくてもよい）" maxlength="40" value="' + esc(DMA.rn || '') + '">' : '') + '<button class="btn primary" data-dma-go>' + (DMA.addTo ? DMA.psel.length + '人を追加' : DMA.psel.length > 1 ? (DMA.psel.length + 1) + '人のグループを作る' : 'チャット') + '</button></div>' : '') + '</aside>';
  var head = !ok ? '' : rm ? '<div class="dmach"><button class="ib dmaback" data-dma-close aria-label="一覧へ">' + ic('back') + '</button>' + dmaAvs(R0.members.filter(function (u) { return u !== S.me; })) + '<span class="dmam"><b>' + esc(dmaRoomName(R0)) + '</b><small>' + R0.members.length + '人のグループ</small></span><span class="sp"></span><button class="ib" data-dma-menu aria-label="その他">' + ic('more') + '</button></div>'
    : '<div class="dmach"><button class="ib dmaback" data-dma-close aria-label="一覧へ">' + ic('back') + '</button>' + av(k) + '<span class="dmam"><b>' + esc(mm.name) + '</b><small>' + esc(mm.grade || '') + '</small></span><span class="sp"></span><button class="ib" data-dma-menu aria-label="その他">' + ic('more') + '</button></div>';
  var right = '<section class="dmac">' + head + '<div class="dmamsgs" id="dmamsgs">' + dmaMsgsHTML() + '</div>' +
    (ok ? (blk ? '<div class="dmablk">ブロック中です<button class="btn sm" data-dma-unblock>解除する</button></div>' :
      (DMA.files.length ? '<div class="dmafs">' + DMA.files.map(function (f, i) { return '<span><img src="' + f.url + '" alt=""><button data-dma-rm="' + i + '" aria-label="写真を外す">' + ic('x') + '</button></span>'; }).join('') + '</div>' : '') +
      '<div class="dmacp"><label class="ib" aria-label="写真" title="写真"><input type="file" accept="image/*" multiple id="dmafile" hidden><svg class="i" viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="10" r="1.6"/><path d="M21 16l-5-5-9 8"/></svg></label><textarea id="dmatx" rows="1" placeholder="' + (DMA_TOUCH ? 'メッセージ' : 'メッセージ（Enter で送信・Shift+Enter で改行）') + '">' + esc(DMA.draft || '') + '</textarea><button class="btn primary sm" data-dma-send>送信</button></div>') : '') + '</section>';
  setTimeout(function () { var b = document.getElementById('dmamsgs'); if (b) b.scrollTop = b.scrollHeight; if (ok) dmaRead(k); }, 0);
  return top('メッセージ') + '<div class="dmaw' + (DMA.pick ? ' picking' : '') + '">' + left + right + '</div>';
}
function dmaPaint() { // 書いている途中の入力は保ったまま、一覧と会話だけ描き直す
  var l = document.getElementById('dmalist'), b = document.getElementById('dmamsgs'); if (!l || !b) { render(); return; }
  var atEnd = b.scrollHeight - b.scrollTop - b.clientHeight < 80; l.innerHTML = dmaListHTML(); b.innerHTML = dmaMsgsHTML(); if (atEnd) b.scrollTop = b.scrollHeight; if (DMA.sel) dmaRead(DMA.sel);
}
function dmaRead(k) {
  var now = new Date().toISOString();
  if (dmaIsRoom(k)) { if (!dmaRoomUnread(k) && DMA.reads[k]) return; DMA.reads[k] = now; renderChrome(); sb.from('dm_reads').upsert({ user_id: S.me, conv: k, at: now }, { onConflict: 'user_id,conv' }).then(function () {}); return; }
  var c = dmaConv(S.me, k), any = false;
  DMA.list.forEach(function (m) { if (m.conv === c && m.to_id === S.me && !m.read_at) { m.read_at = now; any = true; } });
  if (any) { renderChrome(); sb.from('dms').update({ read_at: now }).eq('conv', c).eq('to_id', S.me).is('read_at', null).then(function () {}); }
}
function dmaShrink(file) { return new Promise(function (ok, ng) { var img = new Image(), u = URL.createObjectURL(file); img.onload = function () { var k = Math.min(1, 1600 / Math.max(img.width, img.height)), c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k); c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(u); c.toBlob(function (b) { b ? ok(b) : ng(); }, 'image/jpeg', 0.82); }; img.onerror = function () { URL.revokeObjectURL(u); ng(); }; img.src = u; }); }
async function dmaSend() {
  var k = DMA.sel, rm = dmaIsRoom(k), ta = document.getElementById('dmatx'), v = ta ? ta.value.trim() : '', fs = DMA.files.slice(); if (!k || (!v && !fs.length)) return;
  if (ta) ta.value = ''; DMA.draft = ''; DMA.files = []; var imgs = [], conv = rm ? k : dmaConv(S.me, k);
  try { for (var i = 0; i < fs.length; i++) { var b = await dmaShrink(fs[i].file), path = conv + '/' + S.me + '/' + Date.now() + '_' + i + '.jpg', r = await sb.storage.from('dm').upload(path, b, { contentType: 'image/jpeg' }); if (r.error) throw r.error; imgs.push(path); DMA.urls[path] = fs[i].url; } }
  catch (er) { toast('写真を送れませんでした'); if (ta) ta.value = v; DMA.files = fs; render(); return; }
  var row = rm ? { conv: k, room: k.slice(2), from_id: S.me, to_id: null, body: v, imgs: imgs } : { conv: conv, from_id: S.me, to_id: k, body: v, imgs: imgs }, tmp = Object.assign({ id: 'tmp' + Date.now(), created_at: new Date().toISOString(), read_at: null }, row);
  DMA.list.push(tmp); if (fs.length) render(); else dmaPaint();
  var r2 = await sb.from('dms').insert(row).select().single(); DMA.list = DMA.list.filter(function (m) { return m !== tmp; });
  if (r2.error) toast(/row-level/.test(r2.error.message) && !rm ? '送れませんでした（ブロック中の相手には送れません）' : '送れませんでした'); else { if (!DMA.list.some(function (m) { return m.id === r2.data.id; })) DMA.list.push(r2.data); if (rm) { DMA.reads[k] = r2.data.created_at; } }
  dmaPaint(); var t2 = document.getElementById('dmatx'); if (t2) t2.focus();
}
document.addEventListener('click', function (e) {
  if (S.view !== 'dm' || !e.target.closest) return; var t = e.target, b;
  if ((b = t.closest('[data-dma-to]'))) { DMA.sel = b.dataset.dmaTo; DMA.pick = false; DMA.q = ''; DMA.files = []; render(); var x = document.getElementById('dmatx'); if (x) x.focus(); return; }
  if (t.closest('[data-dma-close]')) { DMA.sel = null; render(); return; }
  if (t.closest('[data-dma-new]')) { DMA.pick = true; DMA.psel = []; DMA.addTo = null; DMA.rn = ''; DMA.q = ''; render(); var q = document.getElementById('dmaq'); if (q) q.focus(); return; }
  if (t.closest('[data-dma-back]')) { DMA.pick = false; DMA.q = ''; DMA.psel = []; DMA.addTo = null; render(); return; }
  if ((b = t.closest('[data-dma-psel]'))) { e.preventDefault(); var u = b.dataset.dmaPsel, ix = DMA.psel.indexOf(u); if (ix >= 0) DMA.psel.splice(ix, 1); else DMA.psel.push(u); var rn = document.getElementById('dmarn'); if (rn) DMA.rn = rn.value; render(); var q2 = document.getElementById('dmaq'); if (q2) q2.focus(); return; }
  if ((b = t.closest('[data-dma-grp]'))) { var g = grpAll().filter(function (x) { return x.name === b.dataset.dmaGrp; })[0], R1 = DMA.addTo && dmaRoom(DMA.addTo); if (g) g.members.forEach(function (u) { if (u !== S.me && DMA.psel.indexOf(u) < 0 && !(R1 && R1.members.indexOf(u) >= 0)) DMA.psel.push(u); }); DMA.q = ''; render(); return; }
  if (t.closest('[data-dma-go]')) {
    var sel = DMA.psel.slice(), nm = ((document.getElementById('dmarn') || {}).value || '').trim();
    if (DMA.addTo) { var R2 = dmaRoom(DMA.addTo), k2 = DMA.addTo; DMA.pick = false; DMA.addTo = null; DMA.psel = []; if (R2) { R2.members = R2.members.concat(sel.filter(function (x) { return R2.members.indexOf(x) < 0; })); sb.from('dm_rooms').update({ members: R2.members }).eq('id', R2.id).then(function (r) { if (r.error) toast('追加できませんでした'); }); } DMA.sel = k2; render(); return; }
    DMA.pick = false; DMA.psel = []; DMA.q = ''; DMA.rn = '';
    if (sel.length === 1) { DMA.sel = sel[0]; render(); return; }
    sb.from('dm_rooms').insert({ name: nm, members: [S.me].concat(sel), created_by: S.me }).select().single().then(function (r) { if (r.error) { toast('グループを作れませんでした'); render(); return; } DMA.rooms.push(r.data); DMA.reads['r-' + r.data.id] = new Date().toISOString(); DMA.sel = 'r-' + r.data.id; render(); });
    return;
  }
  if (t.closest('[data-dma-send]')) { dmaSend(); return; }
  if ((b = t.closest('[data-dma-rm]'))) { DMA.files.splice(+b.dataset.dmaRm, 1); render(); return; }
  if (t.closest('[data-dma-unblock]')) { var u0 = DMA.sel; DMA.blocks = DMA.blocks.filter(function (x) { return x !== u0; }); sb.from('dm_blocks').delete().eq('blocker', S.me).eq('blocked', u0).then(function () { toast('ブロックを解除しました'); }); render(); return; }
  if ((b = t.closest('[data-dma-img]'))) { var ov = document.createElement('div'); ov.className = 'dmalb'; ov.innerHTML = '<img src="' + esc(b.dataset.dmaImg) + '" alt="">'; ov.onclick = function () { ov.remove(); }; document.body.appendChild(ov); return; }
  if ((b = t.closest('[data-dma-menu]'))) {
    var k = DMA.sel, r0 = b.getBoundingClientRect();
    if (dmaIsRoom(k)) { var R = dmaRoom(k); if (!R) return;
      openMenu(dmaRoomName(R), [['名前を変える', function () { var v = prompt('グループの名前', R.name || ''); if (v == null) return; R.name = v.trim().slice(0, 40); sb.from('dm_rooms').update({ name: R.name }).eq('id', R.id).then(function () {}); render(); }],
        ['メンバーを追加', function () { DMA.pick = true; DMA.addTo = k; DMA.psel = []; DMA.q = ''; render(); }],
        ['メンバー：' + R.members.map(function (u) { return member(u) ? member(u).name : ''; }).filter(Boolean).join('・'), function () {}, false, ' '],
        'sep', ['グループを抜ける', function () { askConfirm({ title: 'グループを抜ける', body: '「' + esc(dmaRoomName(R)) + '」のメッセージが見られなくなります。', ok: '抜ける', run: function () { var ms = R.members.filter(function (u) { return u !== S.me; }); DMA.rooms = DMA.rooms.filter(function (x) { return x !== R; }); DMA.sel = null; sb.from('dm_rooms').update({ members: ms }).eq('id', R.id).then(function () {}); render(); } }); }, true]], r0.left, r0.bottom + 4);
      return; }
    var on = DMA.blocks.indexOf(k) >= 0;
    openMenu(member(k).name, [['通報する', function () { var last = dmaWith(k).slice(-5).map(function (m) { return (m.from_id === S.me ? '自分' : member(m.from_id).name) + '：' + (m.body || '（写真）'); }).join(' / '); sb.from('reports').insert({ item_id: 'dm:' + k, user_id: S.me, reason: 'DM（' + member(k).name + '）その他 ｜ ' + last.slice(0, 400) }).then(function (x) { toast(x.error ? '通報できませんでした' : '通報しました'); }); }],
      [on ? 'ブロックを解除' : 'ブロックする', function () { if (on) { DMA.blocks = DMA.blocks.filter(function (x) { return x !== k; }); sb.from('dm_blocks').delete().eq('blocker', S.me).eq('blocked', k).then(function () {}); toast('ブロックを解除しました'); render(); } else askConfirm({ title: member(k).name + 'さんをブロック', body: 'お互いにメッセージを送れなくなります。', ok: 'ブロックする', run: function () { DMA.blocks.push(k); sb.from('dm_blocks').insert({ blocker: S.me, blocked: k }).then(function (x) { toast(x.error ? 'ブロックできませんでした' : 'ブロックしました'); }); render(); } }); }, true]], r0.left, r0.bottom + 4);
    return;
  }
}, true);
document.addEventListener('contextmenu', function (e) { // 自分のメッセージ：送信を取り消す
  var m = S.view === 'dm' && e.target.closest && e.target.closest('.dmam2.me[data-dma-id]'); if (!m || /^tmp/.test(m.dataset.dmaId)) return; e.preventDefault(); e.stopImmediatePropagation();
  openMenu('メッセージ', [['送信を取り消す', function () { var id = m.dataset.dmaId; DMA.list = DMA.list.filter(function (x) { return x.id !== id; }); dmaPaint(); sb.from('dms').delete().eq('id', id).then(function (r) { if (r.error) toast('取り消せませんでした'); }); }, true]], e.clientX, e.clientY);
}, true);
document.addEventListener('input', function (e) {
  if (e.target.id === 'dmaq') { DMA.q = e.target.value.trim(); var l = document.getElementById('dmalist'); if (l) l.innerHTML = dmaListHTML(); }
  if (e.target.id === 'dmatx') { DMA.draft = e.target.value; e.target.style.height = 'auto'; e.target.style.height = Math.min(e.target.scrollHeight, 160) + 'px'; }
  if (e.target.id === 'dmarn') DMA.rn = e.target.value;
});
document.addEventListener('keydown', function (e) { if (e.target.id === 'dmatx' && e.key === 'Enter' && !DMA_TOUCH && !e.shiftKey && !e.isComposing && e.keyCode !== 229) { e.preventDefault(); dmaSend(); } }, true);
document.addEventListener('change', function (e) { if (e.target.id !== 'dmafile') return; [].slice.call(e.target.files || []).slice(0, 4 - DMA.files.length).forEach(function (f) { if (/^image\//.test(f.type)) DMA.files.push({ file: f, url: URL.createObjectURL(f) }); }); render(); });

// ---------- グループ（@で呼べる人のまとまり）：役職ごとは自動、ほかはメンバーのタブで作る ----------
var GRP = [];
async function grpLoad() { try { var r = await sb.from('groups').select('*').order('created_at'); if (!r.error) GRP = r.data || []; } catch (e) {} }
function grpAll() { // [{ name, members, auto }]
  var out = [{ name: '運営全員', members: S.members.filter(isOps).map(function (m) { return m.id; }), auto: true }];
  POSTS.forEach(function (p) { if (p[0] === '—') return; var ms = S.members.filter(function (m) { return m.unit === p[0]; }).map(function (m) { return m.id; }); if (ms.length) out.push({ name: p[0], members: ms, auto: true }); });
  GRP.forEach(function (g) { out.push({ id: g.id, name: g.name, members: (g.members || []).filter(member), auto: false }); });
  return out;
}
var _viewPermsG = viewPerms;
viewPerms = function () {
  var html = _viewPermsG(), gs = grpAll();
  html = html.replace(/(<div class="utabs">[\s\S]*?)(<\/div>)/, '$1<button data-act="utab" data-k="mtab" data-v="grp" aria-pressed="' + (S.mtab === 'grp') + '">グループ<span class="n num">' + gs.length + '</span></button>$2');
  if (S.mtab !== 'grp') return html;
  var cards = gs.map(function (g) {
    return '<div class="grpc" data-grpcard="' + esc(g.name) + '"><div class="grph"><b>' + esc(g.name) + '</b>' + (g.auto ? '<span class="grpa">自動</span>' : '') + '<span class="sp"></span>' + (g.auto ? '' : '<button class="btn sm ghost" data-grp-edit="' + g.id + '">編集</button>') + '</div>' +
      '<div class="grpm">' + (g.members.length ? g.members.slice(0, 12).map(function (id) { return av(id); }).join('') + (g.members.length > 12 ? '<span class="muted">+' + (g.members.length - 12) + '</span>' : '') : '<span class="dim">まだいません</span>') + '</div>' +
      '<div class="grpn muted">' + g.members.map(function (id) { return esc(member(id).name); }).join('・') + '</div></div>';
  }).join('');
  var body = '<div class="body"><p class="muted" style="margin:0 0 12px;font-size:13px">付箋や業務の担当選びで「@」に続けてグループ名を入れると、そのグループの全員をまとめて呼べます・選べます。役職ごとのグループは自動で作られます。</p><div class="grpg">' + cards + '<button class="grpc grpadd" data-grp-new>＋ グループを作る</button></div></div>';
  return html.replace(/<div class="tbar">[\s\S]*$/, body);
};
window.__grpDlg = function () {
  var g = M.id ? GRP.filter(function (x) { return x.id === M.id; })[0] : null, sel = M.sel, q = M.q || '';
  var ms = S.members.filter(function (m) { return !q || (m.name + (m.grade || '') + (m.unit || '')).indexOf(q) >= 0; });
  return dlg(g ? 'グループを編集' : 'グループを作る',
    '<div class="fld"><label for="grpName">名前</label><input id="grpName" class="input" maxlength="40" value="' + esc(M.name != null ? M.name : (g ? g.name : '')) + '" autocomplete="off"></div>' +
    '<div class="fld"><label>メンバー<span class="muted">（' + sel.length + '人）</span></label><input id="grpQ" class="input" placeholder="名前で絞り込み（＠でグループ）" value="' + esc(q) + '" autocomplete="off"><div class="grpl">' +
    (/^[@＠]/.test(q) ? (function () { var gq = q.slice(1), gs = grpAll().filter(function (x) { return x.name.indexOf(gq) >= 0 && x.id !== M.id; }); return gs.length ? gs.map(function (x) { var nw = x.members.filter(function (u) { return sel.indexOf(u) < 0; }); return '<button class="tpg" data-grp-addg="' + esc(x.name) + '"' + (nw.length ? '' : ' disabled') + '><b>' + esc(x.name) + '</b><span class="avs">' + x.members.slice(0, 5).map(function (u) { return av(u); }).join('') + '</span><small>' + (nw.length ? nw.length + '人を追加' : '全員入っています') + '</small></button>'; }).join('') : '<div class="tpnote">該当するグループはありません</div>'; })() :
    ms.map(function (m) { return '<label class="tpi"><input type="checkbox" class="check" data-grp-m="' + m.id + '"' + (sel.indexOf(m.id) >= 0 ? ' checked' : '') + '>' + av(m.id) + '<span class="tpn">' + esc(m.name) + '</span><small class="muted">' + esc(postLabel(m.unit || '—')) + '</small></label>'; }).join('')) + '</div></div>',
    (g ? '<button class="btn ghost mdanger" data-grp-del>削除</button><span class="sp"></span>' : '') + '<button class="btn" data-act="close">やめる</button><button class="btn primary" data-grp-save>保存</button>', true);
};
document.addEventListener('click', function (e) {
  var t = e.target; if (!t.closest) return; var b;
  if (t.closest('[data-grp-new]')) { M = { m: 'grp', id: null, sel: [], name: null }; renderModal(); return; }
  if ((b = t.closest('[data-grp-edit]'))) { var g = GRP.filter(function (x) { return x.id === b.dataset.grpEdit; })[0]; if (!g) return; M = { m: 'grp', id: g.id, sel: (g.members || []).slice(), name: null }; renderModal(); return; }
  if (!M || M.m !== 'grp') return;
  if ((b = t.closest('[data-grp-addg]'))) { var g2 = grpAll().filter(function (x) { return x.name === b.dataset.grpAddg; })[0]; M.name = (document.getElementById('grpName') || {}).value; if (g2) g2.members.forEach(function (u) { if (M.sel.indexOf(u) < 0) M.sel.push(u); }); M.q = ''; renderModal(); return; }
  if ((b = t.closest('[data-grp-m]'))) { var id = b.dataset.grpM; M.name = (document.getElementById('grpName') || {}).value; setTimeout(function () { if (b.checked) { if (M.sel.indexOf(id) < 0) M.sel.push(id); } else M.sel = M.sel.filter(function (x) { return x !== id; }); var l = document.querySelector('.dlg .fld label span.muted'); if (l) l.textContent = '（' + M.sel.length + '人）'; }, 0); return; }
  if (t.closest('[data-grp-save]')) {
    var nm = (document.getElementById('grpName').value || '').trim().replace(/^[@＠]+/, ''); if (!nm) { toast('名前を入れてください'); return; }
    if (grpAll().some(function (x) { return x.name === nm && x.id !== M.id; })) { toast('同じ名前のグループがあります'); return; }
    var row = { name: nm, members: M.sel.slice() }, id0 = M.id; M = null; renderModal();
    (id0 ? sb.from('groups').update(row).eq('id', id0) : sb.from('groups').insert(row)).then(async function (r) { if (r.error) { toast('保存できませんでした'); return; } await grpLoad(); render(); toast('保存しました'); });
    return;
  }
  if (t.closest('[data-grp-del]')) { var id1 = M.id; M = null; renderModal(); sb.from('groups').delete().eq('id', id1).then(async function () { await grpLoad(); render(); toast('グループを削除しました'); }); return; }
}, true);
document.addEventListener('input', function (e) { if (e.target.id === 'grpQ' && M && M.m === 'grp') { M.q = e.target.value; M.name = (document.getElementById('grpName') || {}).value; renderModal(); var q = document.getElementById('grpQ'); if (q) { q.focus(); q.setSelectionRange(q.value.length, q.value.length); } } });

// ---------- 付箋：画面のどこにでも貼れる小さなメモ。@で人やグループを呼べる。最後の書き込みから3日で消える ----------
var STK = { list: [], msgs: [], open: null, ready: false };
var STK_DAYS = 3;
function stkNorm(s) { var now = new Date().toISOString(); s.mentions = s.mentions || []; s.body = s.body || ''; s.created_at = s.created_at || now; s.updated_at = s.updated_at || s.created_at; if (s.x == null) s.x = 0.5; if (s.y == null) s.y = 0.3; if (!s.author) s.author = S.me; return s; }
async function stkLoad() { try { var r = await Promise.all([sb.from('stickies').select('*'), sb.from('sticky_msgs').select('*').order('created_at')]); if (!r[0].error) STK.list = (r[0].data || []).map(stkNorm); if (!r[1].error) STK.msgs = r[1].data || []; STK.ready = true; } catch (e) {} }
var stkT = null; function stkRemote() { clearTimeout(stkT); stkT = setTimeout(async function () { await stkLoad(); stkPaint(); }, 200); }
function stkPlace() { return S.view + ':' + (S.view === 'projects' ? (S.fcur || '') : ''); }
function stkLabel() { var nm = { projects: '業務', tracks: '教材', notices: '告知', board: 'サポート', perms: 'メンバー', stats: '統計', me: '自分', dm: 'メッセージ' }[S.view] || ''; var n = S.view === 'projects' && S.fcur && S.fcur !== 'mine' ? task(S.fcur) : null; return n ? nm + ' › ' + ancestors(n).map(ttl).concat([ttl(n)]).join(' › ') : nm; }
function stkLeft(s) { return STK_DAYS - (Date.now() - new Date(s.updated_at).getTime()) / 86400000; }
function stkMentions(text) { // 本文から @名前・@グループ を拾う
  var ids = []; text = String(text).replace(/＠/g, '@'); grpAll().forEach(function (g) { if (text.indexOf('@' + g.name) >= 0) ids = ids.concat(g.members); });
  S.members.forEach(function (m) { if (text.indexOf('@' + m.name) >= 0 || text.indexOf('@' + m.name.replace(/\s+/g, '')) >= 0) ids.push(m.id); });
  return ids.filter(function (x, i) { return ids.indexOf(x) === i; });
}
function stkHL(text) { var h = esc(String(text).replace(/＠/g, '@')); var names = grpAll().map(function (g) { return g.name; }).concat(S.members.map(function (m) { return m.name; })).sort(function (a, b) { return b.length - a.length; }); names.forEach(function (n) { h = h.split('@' + esc(n)).join('<b class="stkat">@' + esc(n) + '</b>'); }); return linkify(h.replace(/&lt;b class=&quot;stkat&quot;&gt;/g, '')).replace(/\n/g, '<br>'); }
function stkLayer() { var l = document.getElementById('stkl'); if (!l) { l = document.createElement('div'); l.id = 'stkl'; document.body.appendChild(l); } var v = document.getElementById('view'); if (v) { var r = v.getBoundingClientRect(); l.style.left = (r.left + window.scrollX) + 'px'; l.style.top = (r.top + window.scrollY) + 'px'; l.style.width = r.width + 'px'; l.style.height = r.height + 'px'; } return l; }
// 開いている付箋：パソコンは何枚でも（最後に触ったものが一番上）、スマホは2枚まで（3枚目を開くと一番古いものがたたまれる）
STK.opens = [];
Object.defineProperty(STK, 'open', { configurable: true, get: function () { return STK.opens.length ? STK.opens[STK.opens.length - 1] : null; }, set: function (v) { if (!v) { STK.opens = []; return; } STK.opens = STK.opens.filter(function (x) { return x !== v; }).concat([v]); if (window.innerWidth <= 760) STK.opens = STK.opens.slice(-2); } });
function stkIsOpen(id) { return (window.innerWidth <= 760 ? STK.opens.slice(-2) : STK.opens).indexOf(id) >= 0; }
function stkFront(id) { if (STK.opens.indexOf(id) < 0) return; STK.opens = STK.opens.filter(function (x) { return x !== id; }).concat([id]); STK.opens.forEach(function (x, i) { var c = document.querySelector('#stkl .stk.card[data-stk="' + x + '"]'); if (c) c.style.zIndex = 2 + i; }); }
function stkPaint() {
  if (!SYNC.ready || SD) return; var l = stkLayer(), here = STK.list.filter(function (s) { return s.place === stkPlace() && stkLeft(s) > 0; });
  var keep = document.activeElement && document.activeElement.closest && document.activeElement.closest('#stkl, #stksh') ? { id: document.activeElement.id, v: document.activeElement.value, s: document.activeElement.selectionStart } : null;
  var PH = window.innerWidth <= 760, sheet = '';
  var one = function (s, asMini) {
    var W = l.clientWidth, H = l.clientHeight, open = !asMini && stkIsOpen(s.id), ms = STK.msgs.filter(function (m) { return m.sticky_id === s.id; }), left = stkLeft(s), mine = s.author === S.me;
    var x = Math.max(4, Math.min(W - (open ? 264 : 36), s.x * W)), y = Math.max(4, Math.min(H - (open ? 120 : 36), s.y * H));
    var cw = Math.max(200, Math.min(520, s.w || 260)), ch = s.h ? Math.max(120, Math.min(640, s.h)) : 0; if (open) { x = Math.max(4, Math.min(W - cw - 4, s.x * W)); }
    if (open && PH) { // スマホ：その場で開く。幅は画面に収める（大きさは自分で変えられる）
      cw = Math.min(cw, W - 16); x = Math.max(8, Math.min(W - cw - 8, s.x * W));
    }
    if (!open) return '<button class="stk mini c-' + (s.color || 'y') + (left < 1 ? ' old' : '') + '" data-stk="' + s.id + '" style="left:' + x + 'px;top:' + y + 'px" title="' + esc((s.body || '付箋').slice(0, 60)) + '">' + esc(initials(member(s.author) ? member(s.author).name : '?')) + (ms.length ? '<i>' + ms.length + '</i>' : '') + '</button>';
    var who = s.mentions.filter(member).map(function (id) { return member(id).name; });
    return '<div class="stk card c-' + (s.color || 'y') + (left < 1 ? ' old' : '') + '" data-stk="' + s.id + '" style="z-index:' + (2 + STK.opens.indexOf(s.id)) + ';left:' + x + 'px;top:' + y + 'px;width:' + cw + 'px' + (ch ? ';height:' + ch + 'px;max-height:none !important' : '') + '">' +
      '<div class="stkh" data-stk-drag="' + s.id + '">' + av(s.author) + '<span class="stkt">' + esc(member(s.author) ? member(s.author).name : '') + '<small>' + (left < 1 ? 'まもなく消えます' : 'あと' + Math.ceil(left) + '日') + (s.everyone ? ' · 運営全員' : '') + '</small></span><button class="ib" data-stk-menu="' + s.id + '" aria-label="その他">' + ic('more') + '</button><button class="ib" data-stk-min="' + s.id + '" aria-label="小さくする">' + ic('chev') + '</button></div>' +
      (mine && !ms.length ? '<textarea class="stkb" id="stkb-' + s.id + '" data-stk-body="' + s.id + '" placeholder="メモ（@名前・@グループで呼ぶ）" rows="2">' + esc(s.body) + '</textarea>' : '<div class="stkbt">' + (s.body ? stkHL(s.body) : '<span class="dim">（メモなし）</span>') + '</div>') +
      (ms.length ? '<div class="stkms">' + ms.map(function (m) { return '<div class="stkm"><b>' + esc(member(m.author) ? member(m.author).name : '') + '</b>' + stkHL(m.body) + '</div>'; }).join('') + '</div>' : '') +
      (mine && !ms.length ? '' : '<div class="stkr"><input id="stkr-' + s.id + '" data-stk-rep="' + s.id + '" placeholder="返信（Enter）" autocomplete="off"></div>') +
      (who.length ? '<div class="stkw">' + who.slice(0, 4).map(esc).join('・') + (who.length > 4 ? ' ほか' + (who.length - 4) + '人' : '') + '</div>' : '') + '<i class="stkrz" data-stk-rz="' + s.id + '" title="ドラッグで大きさを変える"></i></div>';
  };
  // スマホ：開いた付箋は下から出る入力の枠に（キーボードの上に付く）。画面の付箋は小さいまま
  l.innerHTML = here.map(function (s) { return one(s); }).join('') + '<div class="stkac" id="stkac" hidden></div>';
  if (keep && keep.id) { var el = document.getElementById(keep.id); if (el) { el.value = keep.v; el.focus(); try { el.setSelectionRange(keep.s, keep.s); } catch (er) {} } }
  var add = document.querySelector('#view .top .stkadd'); if (!add) { var tp = document.querySelector('#view .top'); if (tp) tp.insertAdjacentHTML('beforeend', '<button class="ib stkadd" data-stk-new title="付箋を貼る（画面を右クリックでも）" aria-label="付箋を貼る">' + STKI + '</button>'); }
}
var STKC = [['y', '黄色'], ['p', 'ピンク'], ['b', '青'], ['g', '緑'], ['v', '紫'], ['w', '白']];
function stkMenuItems(s) {
  var fn = S.view === 'projects' && S.fcur && task(S.fcur) && !isFolder(task(S.fcur)) ? task(S.fcur) : null, it = [];
  STKC.forEach(function (c) { it.push([((s.color || 'y') === c[0] ? '✓ ' : '　 ') + c[1], function () { s.color = c[0]; stkPaint(); sb.from('stickies').update({ color: c[0] }).eq('id', s.id).then(function () {}); }]); });
  it.push('sep', [s.everyone ? '呼んだ人だけに見せる' : '運営全員に見せる', function () { s.everyone = !s.everyone; sb.from('stickies').update({ everyone: s.everyone }).eq('id', s.id).then(function () {}); stkPaint(); }, false, s.author === S.me ? '' : '貼った人だけ']);
  if (s.w || s.h) it.push(['大きさを元に戻す', function () { s.w = null; s.h = null; stkPaint(); sb.from('stickies').update({ w: null, h: null }).eq('id', s.id).then(function () {}); }]);
  if (fn) it.push(['このファイルのメモに移す', function () { var ms = STK.msgs.filter(function (m) { return m.sticky_id === s.id; }); var html = '<blockquote>' + [s.body].concat(ms.map(function (m) { return (member(m.author) ? member(m.author).name : '') + '：' + m.body; })).filter(Boolean).map(esc).join('<br>') + '</blockquote>'; snap(); fn.memo = (fn.memo || '') + html; save(); STK.list = STK.list.filter(function (x) { return x !== s; }); STK.opens = STK.opens.filter(function (x) { return x !== s.id; }); sb.from('stickies').delete().eq('id', s.id).then(function () {}); render(); toast('メモに移しました'); }]);
  if (s.author !== S.me) it.push(['メッセージで続ける', function () { S.view = 'dm'; DMA.sel = s.author; DMA.pick = false; save(); render(); }]);
  it.push('sep', ['剥がす', function () { STK.list = STK.list.filter(function (x) { return x !== s; }); STK.opens = STK.opens.filter(function (x) { return x !== s.id; }); sb.from('stickies').delete().eq('id', s.id).then(function (r2) { if (r2.error) toast('剥がせませんでした'); }); stkPaint(); }, true, s.author === S.me || isAdmin() ? '' : '貼った人だけ']);
  return it;
}
// 付箋を右クリック：色・見せる人・大きさなど（ほかの右クリックより先に受ける）
window.addEventListener('contextmenu', function (e) { var el = e.target.closest && e.target.closest('#stkl .stk, #stksh .stk'); if (!el || e.target.closest('textarea, input')) return; e.preventDefault(); e.stopImmediatePropagation(); STKCX = null; var s = STK.list.filter(function (x) { return x.id === el.dataset.stk; })[0]; if (s) openMenu('付箋', stkMenuItems(s), e.clientX, e.clientY); }, true);
var STKI = '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 4h14v10l-6 6H5z"/><path d="M13 20v-6h6"/></svg>';
async function stkNew(x, y) {
  var r = await sb.from('stickies').insert({ place: stkPlace(), label: stkLabel(), x: x, y: y, body: '' }).select().single();
  if (r.error) { toast('付箋を貼れませんでした'); return; }
  STK.list.push(stkNorm(r.data)); STK.open = r.data.id; stkPaint(); var t = document.getElementById('stkb-' + r.data.id); if (t) t.focus();
}
function stkSaveBody(id, text) {
  var s = STK.list.filter(function (x) { return x.id === id; })[0]; if (!s || s.body === text) return;
  var mt = stkMentions(text), all = s.mentions.concat(mt).filter(function (x, i, a) { return a.indexOf(x) === i && x !== S.me; });
  s.body = text; s.mentions = all; s.updated_at = new Date().toISOString();
  sb.from('stickies').update({ body: text, mentions: all, updated_at: s.updated_at }).eq('id', id).then(function (r) { if (r.error) toast('付箋を保存できませんでした'); });
}
function stkClose(id) { // 閉じる（中身がなくても消さない。消すのは「剥がす」だけ）
  STK.opens = STK.opens.filter(function (x) { return x !== id; });
  stkPaint();
}
function stkGo(id) { // 通知から：その画面へ行って開く
  var s = STK.list.filter(function (x) { return x.id === id; })[0]; if (!s) { toast('この付箋はもうありません'); return; }
  var p = s.place.split(':'); S.view = p[0]; if (p[0] === 'projects') { S.fcur = p[1] || ''; S.fmode = S.fmode || 'card'; } STK.open = id; save(); render();
}
var _renderS = render; render = function () { _renderS.apply(this, arguments); stkPaint(); };
window.addEventListener('resize', function () { stkPaint(); });
document.addEventListener('click', function (e) {
  var t = e.target; if (!t.closest) return; var b;
  if ((b = t.closest('.nr2.lk[data-link]')) && !t.closest('button')) { var lk = b.dataset.link; if (/^sticky:/.test(lk)) { e.stopImmediatePropagation(); stkGo(lk.slice(7)); } return; }
  if (t.closest('[data-stk-new]')) { e.stopImmediatePropagation(); stkNew(0.62, 0.12 + Math.random() * 0.1); return; }
  if ((b = t.closest('.stk.mini'))) { if (b._moved) { b._moved = false; return; } STK.open = b.dataset.stk; stkPaint(); return; }
  if ((b = t.closest('[data-stk-min]'))) { var ta = document.getElementById('stkb-' + b.dataset.stkMin); if (ta) stkSaveBody(b.dataset.stkMin, ta.value); stkClose(b.dataset.stkMin); return; }
  if ((b = t.closest('[data-stk-ac]'))) { e.preventDefault(); stkAcPick(b.dataset.stkAc); return; }
  if ((b = t.closest('[data-stk-menu]'))) { var s = STK.list.filter(function (x) { return x.id === b.dataset.stkMenu; })[0]; if (!s) return; var r = b.getBoundingClientRect(); openMenu('付箋', stkMenuItems(s), r.left, r.bottom + 4); return; }
}, true);
// 画面の何もない所を右クリック → ここに付箋
document.addEventListener('contextmenu', function (e) {
  if (e.defaultPrevented || !SYNC.ready || !e.target.closest) return; var v = document.getElementById('view'); if (!v || !v.contains(e.target)) return;
  if (e.target.closest('input, textarea, select, [contenteditable="true"], a')) return;
  e.preventDefault(); openMenu('', [], e.clientX, e.clientY); // 中身は上の「ここに付箋を貼る」だけ
});
// ドラッグで動かす（小さい付箋・開いた付箋の上の帯）
var SD = null, SDF = 0;
// ドラッグは transform だけで動かす（再計算なし・毎フレーム1回）。指を捕まえて、後ろのスクロールと取り合わない
document.addEventListener('pointerdown', function (e) {
  if (e.button !== 0 || !e.target.closest || e.target.closest('#stksh')) return;
  var rz = e.target.closest('[data-stk-rz]');
  if (rz) { e.preventDefault(); var c = rz.closest('.stk'), r0 = c.getBoundingClientRect(); SD = { el: c, id: c.dataset.stk, rz: true, w0: r0.width, h0: r0.height, x0: e.clientX, y0: e.clientY, x: e.clientX, y: e.clientY, moved: false, pid: e.pointerId }; try { rz.setPointerCapture(e.pointerId); } catch (er) {} document.body.classList.add('stkdrag'); return; }
  var h = e.target.closest('.stk.mini') || (e.target.closest('[data-stk-drag]') && !e.target.closest('button') ? e.target.closest('.stk') : null); if (!h) return;
  e.preventDefault(); // 後ろの文字を選んでしまわないように
  SD = { el: h, id: h.dataset.stk, x0: e.clientX, y0: e.clientY, x: e.clientX, y: e.clientY, l0: parseFloat(h.style.left) || 0, t0: parseFloat(h.style.top) || 0, moved: false, pid: e.pointerId };
  try { (e.target.closest('[data-stk-drag]') || h).setPointerCapture(e.pointerId); } catch (er) {}
  document.body.classList.add('stkdrag');
}, true);
function sdFrame() {
  SDF = 0; var d = SD; if (!d) return;
  if (d.rz) { var lw = document.getElementById('stkl'), mw = lw ? lw.clientWidth - 16 : 520; d.el.style.width = Math.max(200, Math.min(520, mw, d.w0 + d.x - d.x0)) + 'px'; d.el.style.height = Math.max(120, Math.min(640, d.h0 + d.y - d.y0)) + 'px'; d.el.style.setProperty('max-height', 'none', 'important'); return; }
  d.el.style.transform = 'translate3d(' + (d.x - d.x0) + 'px,' + (d.y - d.y0) + 'px,0)';
}
document.addEventListener('pointermove', function (e) {
  if (!SD || e.pointerId !== SD.pid) return; SD.x = e.clientX; SD.y = e.clientY;
  if (!SD.moved) { if (Math.abs(SD.x - SD.x0) + Math.abs(SD.y - SD.y0) < 5) return; SD.moved = true; SD.el.classList.add('drag'); }
  e.preventDefault(); if (!SDF) SDF = requestAnimationFrame(sdFrame);
}, { passive: false, capture: true });
function sdEnd(e) {
  if (!SD || (e && e.pointerId !== SD.pid)) return; var d = SD; SD = null; if (SDF) { cancelAnimationFrame(SDF); SDF = 0; } document.body.classList.remove('stkdrag'); d.el.classList.remove('drag');
  if (!d.moved) return; d.el._moved = true;
  var l = document.getElementById('stkl'), s = STK.list.filter(function (x) { return x.id === d.id; })[0]; if (!s || !l) return;
  if (d.rz) { s.w = parseFloat(d.el.style.width); s.h = parseFloat(d.el.style.height); sb.from('stickies').update({ w: s.w, h: s.h }).eq('id', s.id).then(function () {}); return; }
  var nl = d.l0 + d.x - d.x0, nt = d.t0 + d.y - d.y0; d.el.style.transform = ''; d.el.style.left = nl + 'px'; d.el.style.top = nt + 'px';
  s.x = Math.max(0, Math.min(1, nl / l.clientWidth)); s.y = Math.max(0, Math.min(1, nt / l.clientHeight));
  sb.from('stickies').update({ x: s.x, y: s.y }).eq('id', s.id).then(function () {});
}
document.addEventListener('pointerup', sdEnd, true);
document.addEventListener('pointercancel', sdEnd, true);
// 本文・返信・@の候補
var STKAC = null;
function stkAcShow(el) {
  var v = el.value.slice(0, el.selectionStart), m = /[@＠]([^\s@＠]*)$/.exec(v), box = document.getElementById('stkac'); if (!box) return;
  if (!m) { box.hidden = true; STKAC = null; return; }
  var q = m[1], gs = grpAll().filter(function (g) { return g.name.indexOf(q) >= 0; }).map(function (g) { return { k: g.name, l: '@' + g.name, s: g.members.length + '人' }; });
  var ps = S.members.filter(function (x) { return x.id !== S.me && (x.name.indexOf(q) >= 0 || x.name.replace(/\s+/g, '').indexOf(q) >= 0); }).map(function (x) { return { k: x.name, l: x.name, s: postLabel(x.unit || '—') }; });
  var L = gs.concat(ps).slice(0, 8); if (!L.length) { box.hidden = true; STKAC = null; return; }
  STKAC = { el: el, start: el.selectionStart - m[0].length, end: el.selectionStart, i: 0, L: L };
  var r = el.getBoundingClientRect(), lr = box.parentNode.getBoundingClientRect();
  box.style.left = (r.left - lr.left) + 'px'; box.style.top = (r.bottom - lr.top + 4) + 'px'; box.hidden = false;
  box.innerHTML = L.map(function (x, i) { return '<button data-stk-ac="' + i + '"' + (i === 0 ? ' class="on"' : '') + '><b>' + esc(x.l) + '</b><small>' + esc(x.s) + '</small></button>'; }).join('');
  if (el.closest('#stksh')) box.style.top = Math.max(4, r.top - lr.top - box.offsetHeight - 4) + 'px'; // スマホの枠では入力欄の上に出す
}
function stkAcPick(i) { var a = STKAC; if (!a) return; var x = a.L[+i], v = a.el.value; a.el.value = v.slice(0, a.start) + '@' + x.k + ' ' + v.slice(a.end); var p = a.start + x.k.length + 2; a.el.focus(); a.el.setSelectionRange(p, p); document.getElementById('stkac').hidden = true; STKAC = null; }
document.addEventListener('input', function (e) { if (e.target.closest && e.target.closest('#stkl, #stksh') && /^(TEXTAREA|INPUT)$/.test(e.target.tagName)) stkAcShow(e.target); });
document.addEventListener('keydown', function (e) {
  var el = e.target; if (!el.closest || !el.closest('#stkl, #stksh')) return;
  if (STKAC && STKAC.el === el) {
    var box = document.getElementById('stkac'), bs = box.querySelectorAll('button');
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); STKAC.i = (STKAC.i + (e.key === 'ArrowDown' ? 1 : -1) + bs.length) % bs.length; [].forEach.call(bs, function (b, i) { b.classList.toggle('on', i === STKAC.i); }); return; }
    if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); e.stopImmediatePropagation(); stkAcPick(STKAC.i); return; }
    if (e.key === 'Escape') { box.hidden = true; STKAC = null; e.stopImmediatePropagation(); return; }
  }
  if (el.dataset.stkRep && e.key === 'Enter') {
    e.preventDefault(); var v = el.value.trim(), id = el.dataset.stkRep, s = STK.list.filter(function (x) { return x.id === id; })[0]; if (!v || !s) return; el.value = '';
    var mt = stkMentions(v).filter(function (x) { return s.mentions.indexOf(x) < 0 && x !== S.me; });
    sb.from('sticky_msgs').insert({ sticky_id: id, body: v }).select().single().then(function (r) { if (r.error) { toast('送れませんでした'); return; } STK.msgs.push(r.data); s.updated_at = new Date().toISOString(); stkPaint(); var i2 = document.getElementById('stkr-' + id); if (i2) i2.focus(); });
    if (mt.length) { s.mentions = s.mentions.concat(mt); sb.from('stickies').update({ mentions: s.mentions }).eq('id', id).then(function () {}); }
    return;
  }
  if (el.dataset.stkBody && e.key === 'Escape') { stkSaveBody(el.dataset.stkBody, el.value); stkClose(el.dataset.stkBody); }
}, true);
document.addEventListener('focusout', function (e) { var el = e.target; if (el.dataset && el.dataset.stkBody) stkSaveBody(el.dataset.stkBody, el.value); });
// ほかの右クリックメニューが出る場所でも、いちばん下に「ここに付箋を貼る」
var STKCX = null;
window.addEventListener('contextmenu', function (e) { var v = document.getElementById('view'); STKCX = v && e.target.closest && v.contains(e.target) && !e.target.closest('#stkl') ? { x: e.clientX, y: e.clientY, t: Date.now(), r: v.getBoundingClientRect() } : null; }, true);
new MutationObserver(function () {
  var m = document.getElementById('cm'), c = STKCX; if (!m || !c || Date.now() - c.t > 600 || m.querySelector('[data-stkhere]') || !SYNC.ready) return;
  STKCX = null; m.dataset.fx = (c.x - c.r.left) / c.r.width; m.dataset.fy = (c.y - c.r.top) / c.r.height;
  m.insertAdjacentHTML('beforeend', '<i class="cmsep"></i><button role="menuitem" data-stkhere>ここに付箋を貼る</button>');
  var r = m.getBoundingClientRect(); if (r.bottom > window.innerHeight - 8) m.style.top = Math.max(8, window.innerHeight - r.height - 8) + 'px';
}).observe(document.body, { childList: true, subtree: true });
document.addEventListener('click', function (e) { var b = e.target.closest && e.target.closest('[data-stkhere]'); if (!b) return; e.stopImmediatePropagation(); e.preventDefault(); var m = document.getElementById('cm'), fx = +m.dataset.fx, fy = +m.dataset.fy; closeCM(); stkNew(fx, fy); }, true);

// 通知（プッシュ）から：?go=sticky:<id> でその付箋へ
function goFrom(search) { var d = /[?&]go=dm:([\w-]+)/.exec(search || ''); if (d) { S.view = 'dm'; DMA.sel = d[1]; DMA.pick = false; save(); dmaLoad().then(render); return; } var m = /[?&]go=sticky:([\w-]+)/.exec(search || ''); if (!m) return; var id = m[1]; var t = function (n) { if (STK.ready) stkGo(id); else if (n < 40) setTimeout(function () { t(n + 1); }, 250); }; t(0); }
if (/[?&]go=/.test(location.search)) { var GO0 = location.search; history.replaceState(null, '', location.pathname); var gw = setInterval(function () { if (SYNC.ready) { clearInterval(gw); goFrom(GO0); } }, 200); }
if (navigator.serviceWorker) navigator.serviceWorker.addEventListener('message', function (e) { if (e.data && e.data.slopeGo) goFrom(e.data.slopeGo); });

// ---------- 付箋の管理：見られる付箋の一覧（飛ぶ・色・剥がす） ----------
function viewStk() {
  if (!STK.ready) stkLoad().then(function () { if (S.view === 'stk') render(); });
  var f = S.stkf || 'all', L = STK.list.filter(function (s) { return stkLeft(s) > 0 && (f === 'all' || (f === 'mine' ? s.author === S.me : s.author !== S.me)); }).sort(function (a, b) { return a.updated_at < b.updated_at ? 1 : -1; });
  var n = function (k) { return STK.list.filter(function (s) { return stkLeft(s) > 0 && (k === 'all' || (k === 'mine' ? s.author === S.me : s.author !== S.me)); }).length; };
  var rows = L.map(function (s) {
    var ms = STK.msgs.filter(function (m) { return m.sticky_id === s.id; }), left = stkLeft(s), who = (s.mentions || []).filter(member).map(function (id) { return member(id).name; });
    return '<div class="stkrow" data-stkrow="' + s.id + '"><i class="stkdot c-' + (s.color || 'y') + '"></i><button class="stkrm" data-stkgo="' + s.id + '"><b>' + (s.body ? esc(s.body.slice(0, 80)) : '<span class="dim">（メモなし）</span>') + '</b><small>' + esc(s.label || '') + ' · ' + esc(member(s.author) ? member(s.author).name : '') + (who.length ? ' → ' + esc(who.slice(0, 3).join('・')) + (who.length > 3 ? ' ほか' + (who.length - 3) + '人' : '') : '') + (ms.length ? ' · 返信 ' + ms.length : '') + '</small></button>' +
      '<span class="stkleft num' + (left < 1 ? ' bad' : '') + '">' + (left < 1 ? 'まもなく消えます' : 'あと' + Math.ceil(left) + '日') + '</span><button class="ib" data-stkrowm="' + s.id + '" aria-label="その他">' + ic('more') + '</button></div>';
  }).join('');
  return top('付箋') + utabs('stkf', [['all', 'すべて', n('all')], ['mine', '自分が貼った', n('mine')], ['to', '呼ばれた', n('to')]]) +
    '<div class="body"><div class="stklist">' + (rows || '<div class="empty big">付箋はありません。画面の何もない所を右クリック（スマホは右上のボタン）で貼れます</div>') + '</div></div>';
}
function stkRowMenu(s, x, y) { openMenu('付箋', [['その場所を開く', function () { stkGo(s.id); }]].concat(['sep'], stkMenuItems(s).map(function (it) { return it === 'sep' || typeof it[1] !== 'function' ? it : [it[0], function () { it[1](); if (S.view === 'stk') render(); }, it[2], it[3]]; })), x, y); }
document.addEventListener('click', function (e) {
  if (S.view !== 'stk' || !e.target.closest) return; var b;
  if ((b = e.target.closest('[data-stkgo]'))) { stkGo(b.dataset.stkgo); return; }
  if ((b = e.target.closest('[data-stkrowm]'))) { var s = STK.list.filter(function (x) { return x.id === b.dataset.stkrowm; })[0], r = b.getBoundingClientRect(); if (s) stkRowMenu(s, r.left, r.bottom + 4); return; }
}, true);
document.addEventListener('contextmenu', function (e) {
  if (S.view !== 'stk' || !e.target.closest) return; var row = e.target.closest('[data-stkrow]'); if (!row) return; e.preventDefault(); e.stopImmediatePropagation();
  STKCX = null; var s = STK.list.filter(function (x) { return x.id === row.dataset.stkrow; })[0]; if (s) stkRowMenu(s, e.clientX, e.clientY);
}, true);
// 付箋の入力欄を右クリック：編集のメニュー＋付箋のメニュー
window.addEventListener('contextmenu', function (e) {
  var el = e.target.closest && e.target.closest('#stkl textarea, #stkl input, #stksh textarea, #stksh input'); if (!el) return; e.preventDefault(); e.stopImmediatePropagation();
  STKCX = null; var s = STK.list.filter(function (x) { return x.id === (el.dataset.stkBody || el.dataset.stkRep); })[0], a = el.selectionStart, z = el.selectionEnd, sel = el.value.slice(a, z);
  var put = function (t) { el.focus(); el.setRangeText(t, el.selectionStart, el.selectionEnd, 'end'); el.dispatchEvent(new Event('input', { bubbles: true })); };
  var it = [['切り取り', function () { if (!sel) return; navigator.clipboard && navigator.clipboard.writeText(sel); el.focus(); el.setSelectionRange(a, z); put(''); }, false, sel ? '' : '選んでいません'],
    ['コピー', function () { if (sel && navigator.clipboard) navigator.clipboard.writeText(sel); }, false, sel ? '' : '選んでいません'],
    ['貼り付け', function () { if (!navigator.clipboard || !navigator.clipboard.readText) { toast('Ctrl+V で貼り付けてください'); return; } navigator.clipboard.readText().then(function (t) { el.focus(); el.setSelectionRange(a, z); put(t); }).catch(function () { toast('Ctrl+V で貼り付けてください'); }); }],
    ['すべて選ぶ', function () { el.focus(); el.select(); }],
    'sep', ['＠で人やグループを呼ぶ', function () { el.focus(); el.setSelectionRange(a, z); put((a > 0 && !/\s/.test(el.value[a - 1]) ? ' ' : '') + '@'); stkAcShow(el); }]];
  if (s) it = it.concat(['sep'], stkMenuItems(s));
  openMenu('付箋', it, e.clientX, e.clientY);
}, true);

// メンバーのグループを右クリック：このメンバーでメッセージ・編集・削除
document.addEventListener('contextmenu', function (e) {
  if (S.view !== 'perms' || !e.target.closest) return; var c = e.target.closest('[data-grpcard]'); if (!c) return; e.preventDefault(); e.stopImmediatePropagation();
  STKCX = null; var g = grpAll().filter(function (x) { return x.name === c.dataset.grpcard; })[0]; if (!g) return; var ms = g.members.filter(function (u) { return u !== S.me; });
  openMenu(g.name, [['このメンバーでメッセージ', function () { S.view = 'dm'; DMA.pick = true; DMA.addTo = null; DMA.q = ''; DMA.psel = ms.slice(); DMA.rn = g.name; save(); render(); }, false, ms.length ? '' : 'ほかにメンバーがいません'],
    'sep', ['編集', function () { M = { m: 'grp', id: g.id, sel: g.members.slice(), name: null }; renderModal(); }, false, g.auto ? '役職から自動で作られます' : ''],
    ['削除', function () { askConfirm({ title: '「' + esc(g.name) + '」を削除', body: 'グループだけを消します。メンバーはそのままです。', ok: '削除する', run: function () { sb.from('groups').delete().eq('id', g.id).then(async function () { await grpLoad(); render(); toast('グループを削除しました'); }); } }); }, true, g.auto ? '役職から自動で作られます' : '']], e.clientX, e.clientY);
}, true);


// スマホ：付箋の外を押したら入力だけ終える（付箋は開いたまま。たたむのはボタンだけ）
document.addEventListener('pointerdown', function (e) {
  if (window.innerWidth > 760 || !STK.open || !e.target.closest) return;
  if (e.target.closest('#stkl .stk.card, #cm, #stkac')) return;
  var ta = document.activeElement; if (!ta || !ta.dataset || !ta.dataset.stkBody) return;
  stkSaveBody(ta.dataset.stkBody, ta.value); ta.blur();
}, true);


// スマホの上のボタン（自分・付箋・メッセージ）はタブではなくボタン：押すと開き、もう一度押すと元の画面へ戻る
var HICB = null;
document.addEventListener('click', function (e) {
  var b = e.target.closest && e.target.closest('[data-hic]'); if (!b) return;
  e.preventDefault(); e.stopImmediatePropagation();
  var id = b.dataset.hic, H = ['me', 'stk', 'dm'];
  if (S.view === id) { S.view = (HICB && HICB !== id && navItems().some(function (t) { return t.id === HICB; })) ? HICB : (navItems()[0] || {}).id; HICB = null; }
  else { if (H.indexOf(S.view) < 0) HICB = S.view; S.view = id; }
  M = null; UI.acct = false; save(); render();
}, true);

// パソコン：触った付箋を一番上へ
document.addEventListener('pointerdown', function (e) { var c = e.target.closest && e.target.closest('#stkl .stk.card'); if (c) stkFront(c.dataset.stk); }, true);
