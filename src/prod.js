
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
navItems = function () { var l = [{ id: 'dash', name: 'ダッシュボード' }].concat(TABS.filter(function (t) { return can(t.id); })); if (isAdmin()) l.push({ id: 'perms', name: 'メンバー' }); return l; };
can = function (t) { return t === 'projects' || hasPerm(me(), t); };
function postPerms(post) { var p = POSTS.filter(function (x) { return x[0] === post; })[0]; return p ? p[1].slice() : []; }

function savePrefs() { var p = {}; PREF_KEYS.forEach(function (k) { if (S[k] !== undefined) p[k] = S[k]; }); try { localStorage.setItem(KEY + '-prefs', JSON.stringify(p)); } catch (e) {} }
function save() { savePrefs(); SYNC.ver = (SYNC.ver || 0) + 1; if (SYNC.ready) queueSync(); }

// ---------- ツリー ⇄ 行 ----------
var DKEYS = ['leads', 'memo', 'folder', 'purpose', 'place', 'review', 'links', 'nodate'];
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
        data: { leads: n.leads, memo: n.memo, folder: fo && d > 0, purpose: n.purpose, place: n.place, review: n.review, links: n.links, nodate: !fo && !!n.nodate } });
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
    sb.from('reactions').select('item_id,kind').eq('kind', 'join')
  ]);
  for (var i = 0; i < res.length; i++) if (res[i].error) throw res[i].error;
  if (loadAll.guard != null && loadAll.guard !== SYNC.ver) return false; // 読み込み中に手元で変わった → 捨てて手元を優先
  var ps = res[0].data || [];
  S.members = ps.filter(function (p) { return p.approved; }).map(toMember);
  S.pending = ps.filter(function (p) { return !p.approved; }).map(toMember);
  S.self = ps.filter(function (p) { return p.id === S.me; })[0] || null;
  SYNC.profiles = {}; S.members.forEach(function (m) { SYNC.profiles[m.id] = profKey(m); });
  S.projects = buildTree(res[1].data || []);
  var joins = {}; (res[5].data || []).forEach(function (r) { joins[r.item_id] = (joins[r.item_id] || 0) + 1; });
  S.joins = joins; // 参加登録の数（業務のイベントは node の id、学ぶのイベントは 'pe:' + id）
  (function walk(a) { a.forEach(function (n) { if (n.kind === 'event') n.reg = joins[n.id] || 0; walk(n.tasks || []); }); })(S.projects);
  itemsIn(res[3].data || [], res[4].data || []);
  var base = rowsFromTree(); SYNC.nodes = {}; for (var k in base) SYNC.nodes[k] = JSON.stringify(base[k]);
  S.notifs = (res[2].data || []).map(function (x) { return { to: x.to_id, text: x.text, sub: x.sub, at: fmtAt(x.created_at) }; });
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
window.notify = function (to, text, sub) {
  if (!to) return;
  if (to === S.me) S.notifs.unshift({ to: to, text: text, sub: sub, at: nowLabel() });
  sb.from('notifications').insert({ to_id: to, text: text, sub: sub || '' }).then(function (r) { if (r.error) console.warn(r.error); });
};

// ---------- ほかの人の変更をその場で反映 ----------
var remoteT = null;
function isBusyEditing() {
  var a = document.activeElement;
  return !!((a && a.matches && a.matches('input,textarea,select') && !a.closest('#gate')) || M || mv || drag || lmv || lwd || UI.tp || UI.pp);
}
function onRemote(p) {
  // 自分の書き込みの「こだま」は無視（連続で動かしたときに一つ前へ戻らないように）
  if (p && p.table === 'nodes' && p.new && p.new.updated_by === S.me) return;
  clearTimeout(remoteT); remoteT = setTimeout(applyRemote, 250);
}
async function applyRemote() {
  var v;
  do { v = SYNC.ver; await SYNC.busy; } while (v !== SYNC.ver); // 手元の変更を送り切ってから読む
  if (isBusyEditing()) { SYNC.pendingRemote = true; return; }
  SYNC.pendingRemote = false;
  var y = window.scrollY;
  loadAll.guard = v; var ok = await loadAll(); loadAll.guard = null;
  if (ok === false) { onRemote(); return; } // 手元が変わったので、送ってからもう一度
  render(); window.scrollTo(0, y);
}
document.addEventListener('focusout', function () { setTimeout(function () { if (SYNC.pendingRemote && !isBusyEditing()) applyRemote(); }, 80); });
document.addEventListener('pointerup', function () { setTimeout(function () { if (SYNC.pendingRemote && !isBusyEditing()) applyRemote(); }, 300); });
function subscribe() {
  sb.channel('slope-live')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'nodes' }, onRemote)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, onRemote)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'items' }, onRemote)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'reports' }, onRemote)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'reactions' }, onRemote)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: 'to_id=eq.' + S.me }, onRemote)
    .subscribe();
}

// ---------- 画面：アカウント（ログアウト）・メンバー承認 ----------
function renderChrome() {
  var m = me(), c = counts();
  document.getElementById('nav').innerHTML = navItems().map(function (v) {
    var SH = { dash: 'ホーム', tracks: '教材', notices: '告知', board: '掲示板', projects: '業務', perms: 'メンバー' };
    return '<button data-act="go" data-view="' + v.id + '"' + (S.view === v.id ? ' aria-current="page"' : '') + '>' + ic(v.id) + '<span class="full">' + v.name + '</span><span class="short">' + (SH[v.id] || v.name) + '</span>' + (c[v.id] ? '<span class="n" title="' + ((typeof BADGE !== 'undefined' && BADGE[v.id]) || (v.id === 'perms' ? '承認待ち' : '')) + ' ' + c[v.id] + '件">' + c[v.id] + '</span>' : '') + '</button>';
  }).join('');
  document.getElementById('acct').innerHTML = '<div class="mode"><span>運営</span><button class="msw on" data-to="./" role="switch" aria-checked="true" aria-label="部員画面に切り替える"><i></i></button></div>' + '<button data-act="acct" aria-haspopup="true" aria-expanded="' + UI.acct + '">' + av(m.id, 'lg') + '<span class="who"><b>' + esc(m.name) + '</b><span>' + esc(m.unit === '—' ? '部員' : m.unit) + '</span></span>' + ic('chev') + '</button>' +
    (UI.acct ? '<div class="menu" role="menu"><div class="msm">' + (isAdmin() ? '<button role="menuitem" data-act="go" data-view="perms">' + ic('perms') + '<span>メンバー</span></button>' : '') + '</div><div class="mh">' + esc(m.email || '') + '</div><button role="menuitem" data-act="logout"><span>ログアウト</span></button></div>' : '');
}
function counts() {
  return {
    notices: can('notices') ? S.offers.filter(function (o) { return o.state === 'wait'; }).length : 0,
    board: can('board') ? S.posts.filter(function (p) { return p.reports > 0 && p.state === 'ok'; }).length : 0,
    projects: S.projects.reduce(function (n, p) { return n + leavesOf(p).filter(function (k) { return late(k) && (isAdmin() || chainHas(k, S.me)); }).length; }, 0),
    dash: myTasks(S.me).filter(function (o) { return !isDone(o.k); }).length,
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
    '<label class="gf">学部・学年<input id="gGrade" class="input" placeholder="例：経営 1年" value="' + esc(extra && extra.grade || '') + '"></label>' +
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
  gate(null); SYNC.ready = true; trackVisit('open'); render(); subscribe();
}
sb.auth.onAuthStateChange(function (ev) { if (ev === 'SIGNED_OUT') location.replace(location.pathname); if (ev === 'SIGNED_IN' && !S.me && document.querySelector('[data-act=glogin]')) setTimeout(boot, 0); });


// ---------- 教材・外部告知・掲示板（items 表） ----------
var BOARD_KINDS = ['recruit', 'idea', 'pain', 'other', 'comment'];
var KIND_LABEL = { recruit: '募集', idea: '意見', pain: 'ペイン', other: 'その他', comment: 'コメント' };
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
  S.cals = items.filter(function (x) { return x.kind === 'cal' && x.state !== 'deleted'; }).map(function (x) { return Object.assign({ title: '', date: isoOf(TODAY), time: '', place: '', memo: '', state: 'pub' }, x.data, { id: x.id }); });
  var pg = items.filter(function (x) { return x.kind === 'program'; })[0]; S.program = pg ? pg.data : null;
  S.patches = items.filter(function (x) { return x.kind === 'patch' && x.state !== 'deleted'; }).sort(function (a, b) { return a.pos - b.pos; }).map(function (x) { return Object.assign({ date: '', title: '', note: '', state: 'done' }, x.data, { id: x.id }); });
  SYNC.items = {};
  S.patches.forEach(function (x, i) { SYNC.items[x.id] = JSON.stringify(trackData(x, i)); });
  S.cals.forEach(function (c) { SYNC.items[c.id] = JSON.stringify(noticeData(c)); });
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
  S.offers.forEach(function (o) {
    seen[o.id] = 1; if (SYNC.items[o.id] === o.state || !can('notices')) return; SYNC.items[o.id] = o.state;
    ops.push(function () { return sb.from('items').select('data').eq('id', o.id).single().then(function (r) { if (r.error) return r.error; return sb.from('items').update({ data: Object.assign({}, r.data.data, { state: o.state }) }).eq('id', o.id).then(function (u) { return u.error; }); }); });
  });
  S.posts.forEach(function (p) {
    seen[p.id] = 1; var key = p.state + '|' + p.reports; if (SYNC.items[p.id] === key || !can('board')) return;
    var old = (SYNC.items[p.id] || '').split('|'); SYNC.items[p.id] = key;
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
// トラックがまだ無いときの教材画面
var _viewTracks0 = viewTracks;
viewTracks = function () {
  if (!S.tracks.length) return top('教材', '<button class="btn sm primary" data-act="newTrack">' + ic('plus') + 'トラックを作る</button>') + '<div class="body"><div class="empty">トラックはまだありません。「トラックを作る」から始めてください（基礎教育・各ロールトラック・実務教育など）。</div></div>';
  return _viewTracks0();
};
var _renderMap0 = renderMap; renderMap = function () { if (!S.tracks.length) return { units: [], errs: [], by: {} }; return _renderMap0.apply(this, arguments); };
var _renderDetail0 = renderDetail; renderDetail = function () { if (!S.tracks.length) return; return _renderDetail0.apply(this, arguments); };

// 本番ではトラックが0本でも表示できるので、最後の1本も削除できる
delTrack = function (id) {
  var t = S.tracks.filter(function (x) { return x.id === id; })[0]; if (!t) return;
  snap(); S.tracks = S.tracks.filter(function (x) { return x.id !== id; }); if (S.cur === id) { S.cur = S.tracks[0] ? S.tracks[0].id : null; S.sel = null; }
  save(); render(); toastUndo('トラック「' + t.name + '」を削除しました');
};

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
