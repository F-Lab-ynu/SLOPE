// =====================================================================
// SLOPE 部員アプリ（本番）：Supabase からの読み込み・書き込み
// =====================================================================
(function () {
  var sb = window.supabase.createClient('https://addvjcwwlklwmkwhhsjv.supabase.co', 'sb_publishable_L8VP_h67F3FupHwqC_3pTw_YRbBVghw');
  window.sb = sb;
  var P = {}, ITEMS = [], REACT = [], NODES = [], NOTIFS = [];
  var POSTS = { '代表': 1, '教育部': 1, '外務部 渉外局': 1, '外務部 広報局': 1, '催事部': 1, '会計': 1 };
  var bump = function () { if (window.__comp) window.__comp.forceUpdate(); };
  var DB = window.DB = {
    me: null, self: null, ready: false,
    items: function (kind) { return ITEMS.filter(function (x) { return x.kind === kind && x.state === 'ok'; }); },
    count: function (id, kind) { return REACT.filter(function (r) { return r.item_id === id && r.kind === kind; }).length; },
    mine: function (id, kind) { return REACT.some(function (r) { return r.item_id === id && r.kind === kind && r.user_id === DB.me; }); },
    reactors: function (id, kind) { return REACT.filter(function (r) { return r.item_id === id && r.kind === kind; }).map(function (r) { return r.user_id; }); },
    toggle: function (id, kind, single) {
      var on = DB.mine(id, kind);
      if (!on && single && DB.reactors(id, kind).length) { DB.flash('すでに埋まっています'); return; }
      if (on) REACT = REACT.filter(function (r) { return !(r.item_id === id && r.kind === kind && r.user_id === DB.me); });
      else REACT.push({ item_id: id, kind: kind, user_id: DB.me });
      bump();
      var q = on ? sb.from('reactions').delete().eq('item_id', id).eq('kind', kind).eq('user_id', DB.me) : sb.from('reactions').insert({ item_id: id, kind: kind });
      q.then(function (r) { if (r.error) { DB.flash('保存できませんでした'); reload(); } });
    },
    profiles: function () { return Object.keys(P).map(function (k) { return P[k]; }).filter(function (p) { return p.approved; }); },
    name: function (uid) { var p = P[uid]; return p ? p.name : '（不明）'; },
    who: function (uid) { var p = P[uid]; return p ? p.name + (p.grade ? ' · ' + p.grade : '') : '（退部した部員）'; },
    ini: function (uid) { var p = P[uid]; return p ? String(p.name || '?').replace(/\s/g, '').slice(0, 1) : '?'; },
    ago: function (iso) {
      var t = (Date.now() - new Date(iso).getTime()) / 60000;
      if (t < 1) return 'たった今'; if (t < 60) return Math.floor(t) + '分前'; if (t < 1440) return Math.floor(t / 60) + '時間前';
      if (t < 2880) return '昨日'; if (t < 10080) return Math.floor(t / 1440) + '日前';
      var d = new Date(iso); return (d.getMonth() + 1) + '.' + d.getDate();
    },
    host: function (u) { try { return new URL(u).hostname.replace(/^www\./, ''); } catch (e) { return ''; } },
    myRoles: function () { return (DB.self && DB.self.roles) || []; },
    isOps: function () { return !!(DB.self && POSTS[DB.self.post]); },
    tracks: function () {
      return ITEMS.filter(function (x) { return x.kind === 'track' && x.state === 'ok' && (x.data || {}).status === 'pub'; }).sort(function (a, b) { return a.pos - b.pos; })
        .map(function (x) { return Object.assign({ name: '', start: '', goal: '', list: [], units: {} }, x.data, { id: x.id }); });
    },
    units: function (t) { return (t.list || []).filter(function (u) { return u && u.title; }).map(function (u) { return { code: u.code, title: u.title, tags: u.tags || [], deps: u.deps || [] }; }); },
    unitData: function (t, code) { return (t.units || {})[code] || {}; },
    events: function () {
      return NODES.filter(function (n) { return n.kind === 'event' && n.announce === 'done'; })
        .sort(function (a, b) { return a.end_date < b.end_date ? -1 : 1; })
        .map(function (n) { var d = n.data || {}; return { id: n.id, title: n.title, start: n.start_date, end: n.end_date, unit: d.place || n.unit || '', desc: d.purpose || '' }; });
    },
    progEvents: function () { // 学ぶ（プログラム）のイベント。日程があるものだけ
      var pg = ITEMS.filter(function (x) { return x.kind === 'program' && x.state === 'ok'; })[0], out = [];
      var tree = pg && pg.data && pg.data.v2; if (!tree) return out;
      (function w(a) { a.forEach(function (n) { if (n.out) return; if (n.k === 'e' && /^\d{4}-\d{2}-\d{2}$/.test(n.from || '')) out.push({ id: 'pe:' + n.id, title: n.name, start: n.from, end: n.to || n.from, todo: n.todo || '', link: n.link || '', pub: !!n.pub }); if (n.items) w(n.items); }); })(tree);
      return out.sort(function (a, b) { return a.start < b.start ? -1 : 1; });
    },
    calendar: function () {
      var out = DB.events().map(function (e) { return { date: e.end, type: '部内', title: e.title, time: e.start === e.end ? '' : '期間 ' + e.start.slice(5).replace('-', '.') + '〜', place: e.unit, joinId: e.id, joinKind: 'join' }; });
      ITEMS.filter(function (x) { return (x.kind === 'notice' || x.kind === 'offer') && DB.mine(x.id, 'plan'); }).forEach(function (x) {
        var d = x.data || {}; if (/^\d{4}-\d{2}-\d{2}$/.test(d.due || '')) out.push({ date: d.due, type: '外部', title: d.title, time: '締切', place: d.host || '', joinId: x.id, joinKind: 'plan' });
      });
      ITEMS.filter(function (x) { return x.kind === 'cal' && x.state === 'ok' && (x.data || {}).state === 'pub'; }).forEach(function (x) {
        var d = x.data || {}; if (/^\d{4}-\d{2}-\d{2}$/.test(d.date || '')) out.push({ date: d.date, type: '部内', title: d.title, time: d.time || '', place: d.place || '', joinId: null });
      });
      DB.progEvents().forEach(function (e) { out.push({ date: e.end, type: '教育', title: e.title, time: e.start === e.end ? '' : '期間 ' + e.start.slice(5).replace('-', '.') + '〜', place: e.todo, joinId: e.pub ? e.id : null, joinKind: 'join' }); });
      DB.myTasks().filter(function (t) { return !t.nodate; }).forEach(function (t) { out.push({ date: t.end, type: '教育', title: t.title + '（期限）', time: '', place: t.event, joinId: null }); });
      return out;
    },
    myTasks: function () {
      var by = {}; NODES.forEach(function (n) { by[n.id] = n; });
      var hasKids = {}; NODES.forEach(function (n) { if (n.parent_id) hasKids[n.parent_id] = 1; });
      var root = function (n) { var x = n && by[n.parent_id]; while (x) { if (x.kind === 'event') return x; x = by[x.parent_id]; } return by[n.parent_id] || n; };
      return NODES.filter(function (n) { return n.who === DB.me && !n.done && !hasKids[n.id] && n.parent_id && !(n.data && n.data.folder); })
        .sort(function (a, b) { var na = !!(a.data && a.data.nodate), nb = !!(b.data && b.data.nodate); if (na !== nb) return na ? 1 : -1; return a.end_date < b.end_date ? -1 : 1; })
        .map(function (n) { return { id: n.id, title: n.title, end: n.end_date, nodate: !!(n.data && n.data.nodate), event: (root(n) || {}).title || '', parent: by[n.parent_id] }; });
    },
    notifs: function () { return NOTIFS; },
    flash: function (msg) {
      var t = document.getElementById('mtoast'); if (!t) { t = document.createElement('div'); t.id = 'mtoast'; document.body.appendChild(t); }
      t.textContent = msg; t.className = 'on'; clearTimeout(DB._t); DB._t = setTimeout(function () { t.className = ''; }, 2200);
    },
    add: function (kind, data, parent) {
      var row = { kind: kind, data: data, parent_id: parent || null };
      return sb.from('items').insert(row).select('*').single().then(function (r) {
        if (r.error) { DB.flash('投稿できませんでした：' + r.error.message); return null; }
        ITEMS.unshift(r.data); bump(); return r.data;
      });
    },
    update: function (id, patch) { return sb.from('items').update(patch).eq('id', id).select('id').then(function (r) { if (r.error || !r.data.length) DB.flash('更新できませんでした'); reload(); }); },
    remove: function (id) { return sb.from('items').delete().eq('id', id).then(function (r) { if (r.error) DB.flash('削除できませんでした'); else DB.flash('削除しました'); reload(); }); },
    report: function (id, reason) { return sb.from('reports').insert({ item_id: id, reason: reason || '' }).then(function (r) { DB.flash(r.error ? (/duplicate/.test(r.error.message) ? 'すでに通報済みです' : '通報できませんでした') : '運営に通報しました'); }); },
    complete: function (task) {
      NODES.forEach(function (n) { if (n.id === task.id) n.done = true; }); bump();
      sb.from('nodes').update({ done: true }).eq('id', task.id).select('id').then(function (r) {
        if (r.error || !r.data.length) { DB.flash('完了にできませんでした'); reload(); return; }
        var to = task.parent && task.parent.who && task.parent.who !== DB.me ? [task.parent.who] : DB.profiles().filter(function (p) { return p.post === '代表' && p.id !== DB.me; }).map(function (p) { return p.id; });
        to.forEach(function (uid) { sb.from('notifications').insert({ to_id: uid, text: DB.name(DB.me) + 'さんが「' + task.title + '」を完了しました', sub: task.event }).then(function () {}); });
        DB.flash('完了を報告しました');
      });
    },
    readNotif: function (id) { NOTIFS.forEach(function (n) { if (n.id === id) n.read = true; }); bump(); sb.from('notifications').update({ read: true }).eq('id', id).then(function () {}); },
    saveProfile: function (patch) { Object.assign(DB.self, patch); bump(); return sb.from('profiles').update(patch).eq('id', DB.me).then(function (r) { if (r.error) DB.flash('保存できませんでした'); else DB.flash('保存しました'); reload(); }); },
    logout: function () { sb.auth.signOut().then(function () { location.replace(location.pathname); }); }
  };

  async function load() {
    var res = await Promise.all([
      sb.from('profiles').select('*'),
      sb.from('items').select('*').order('created_at', { ascending: false }),
      sb.from('reactions').select('item_id,kind,user_id'),
      sb.from('nodes').select('id,parent_id,title,kind,announce,unit,who,team,start_date,end_date,done,data'),
      sb.from('notifications').select('*').eq('to_id', DB.me).order('created_at', { ascending: false }).limit(30)
    ]);
    for (var i = 0; i < res.length; i++) if (res[i].error) throw res[i].error;
    P = {}; res[0].data.forEach(function (p) { P[p.id] = p; });
    DB.self = P[DB.me] || null;
    ITEMS = res[1].data; REACT = res[2].data; NODES = res[3].data; NOTIFS = res[4].data;
    DB.ready = true;
  }
  var rt = null, pend = false;
  function typing() { var a = document.activeElement; return a && /^(INPUT|TEXTAREA)$/.test(a.tagName) && a.value; }
  function reload() { clearTimeout(rt); rt = setTimeout(async function () { if (typing()) { pend = true; return; } try { await load(); bump(); } catch (e) { console.warn(e); } }, 250); }
  document.addEventListener('focusout', function () { if (pend) { pend = false; setTimeout(reload, 100); } });
  DB.reload = reload;

  // ---------- ログイン前・承認待ち ----------
  function gate(kind, extra) {
    var g = document.getElementById('mgate');
    if (!kind) { if (g) g.remove(); return; }
    if (!g) { g = document.createElement('div'); g.id = 'mgate'; document.body.appendChild(g); }
    var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
    var body = '';
    if (kind === 'loading') body = '<p class="gs">読み込み中…</p>';
    if (kind === 'login') body = '<h1>ようこそ</h1><p class="gs">横浜国立大学 起業部のアプリです。</p><button class="gb" id="gLogin"><svg viewBox="0 0 48 48" width="20" height="20" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>Googleでログイン</button>';
    if (kind === 'pending') body = '<h1>承認待ち</h1><p class="gs">運営が承認すると使えるようになります。名前と学部・学年を入れておいてください。</p>' +
      '<label class="gf">名前<input id="gName" value="' + esc(extra && extra.name) + '"></label><label class="gf">学部・学年<input id="gGrade" placeholder="例：経営 1年" value="' + esc(extra && extra.grade) + '"></label>' +
      '<button class="gp" id="gSave">保存</button><button class="gl" id="gOut">ログアウト</button>';
    if (kind === 'error') body = '<h1>読み込めませんでした</h1><p class="gs">' + esc(extra) + '</p><button class="gp" onclick="location.reload()">再読み込み</button><button class="gl" id="gOut">ログアウト</button>';
    g.innerHTML = '<div class="gc"><div class="glg"><span class="mark" role="img" aria-label="F-LAB" style="width:28px;height:28px"></span><b>SLOPE</b></div>' + body + '<p class="gm" id="gMsg"></p></div>';
    var on = function (id, fn) { var e = document.getElementById(id); if (e) e.onclick = fn; };
    on('gLogin', function () { this.disabled = true; sb.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: location.origin + location.pathname } }); });
    on('gOut', DB.logout);
    on('gSave', function () {
      var nm = document.getElementById('gName').value.trim(), gr = document.getElementById('gGrade').value.trim(), m = document.getElementById('gMsg');
      if (!nm) { m.textContent = '名前を入力してください'; return; }
      sb.from('profiles').update({ name: nm, grade: gr }).eq('id', DB.me).then(function (r) { m.textContent = r.error ? '保存できませんでした' : '保存しました。承認をお待ちください'; m.className = 'gm' + (r.error ? '' : ' ok'); });
    });
  }

  window.__memberBoot = async function () {
    gate('loading');
    var s = await sb.auth.getSession(), session = s.data && s.data.session;
    if (!session) {
      var h = new URLSearchParams(location.hash.slice(1));
      if (h.get('access_token') && h.get('refresh_token')) { var r = await sb.auth.setSession({ access_token: h.get('access_token'), refresh_token: h.get('refresh_token') }); session = r.data && r.data.session; }
      for (var i = 0; !session && i < 10 && h.get('access_token'); i++) { await new Promise(function (ok) { setTimeout(ok, 300); }); s = await sb.auth.getSession(); session = s.data && s.data.session; }
    }
    if (!session) { gate('login'); return; }
    if (DB.me) return; DB.me = session.user.id;
    if (location.hash) history.replaceState(null, '', location.pathname + location.search);
    try { await load(); } catch (e) { gate('error', e.message); return; }
    if (!DB.self) { gate('error', 'アカウント情報が見つかりません'); return; }
    if (!DB.self.approved) {
      gate('pending', DB.self);
      var t = setInterval(async function () { var r = await sb.from('profiles').select('approved').eq('id', DB.me).single(); if (r.data && r.data.approved) { clearInterval(t); location.reload(); } }, 10000);
      return;
    }
    gate(null); if ((/[?&]tab=learn/.test(location.search) || /^#learn/.test(location.hash)) && window.__comp) window.__comp.setState({ tab: 'learn', sub: null }); bump(); window.__track('open'); window.__track('home');
    document.addEventListener('visibilitychange', function () { if (!document.hidden) window.__track('open'); });
    sb.channel('slope-member')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'items' }, reload)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reactions' }, reload)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'nodes' }, reload)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, reload)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: 'to_id=eq.' + DB.me }, reload)
      .subscribe();
  };
  sb.auth.onAuthStateChange(function (ev) { if (ev === 'SIGNED_OUT') location.replace(location.pathname); if (ev === 'SIGNED_IN' && !DB.me && document.getElementById('gLogin')) setTimeout(window.__memberBoot, 0); });
})();

// ---------- 画面に追加で渡す値（ホーム・学習・予定・マイページ・投稿フォーム） ----------
function memberExtras(v) {
  var D = window.DB, s = this.state, self = this, A = '#F3F1EC', RT = '#F2A93B', INK = '#070707';
  var val = function (id) { var e = document.getElementById(id); return e ? e.value.trim() : ''; };
  var WDJ = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'], now = new Date();
  var md = function (iso) { var p = String(iso || '').split('-'); return p.length === 3 ? (+p[1]) + '.' + (+p[2]) : ''; };
  var wd = function (iso) { var p = String(iso || '').split('-'); return p.length === 3 ? WDJ[new Date(+p[0], +p[1] - 1, +p[2]).getDay()] : ''; };
  var daysTo = function (iso) { var p = String(iso || '').split('-'); if (p.length !== 3) return 0; var t = new Date(+p[0], +p[1] - 1, +p[2]), n = new Date(now.getFullYear(), now.getMonth(), now.getDate()); return Math.round((t - n) / 86400000); };
  var today = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');
  var self0 = D.self || { name: '', grade: '', roles: [] };

  // ホーム
  var nextEv = D.events().concat(D.progEvents()).filter(function (e) { return e.end >= today; }).sort(function (a, b) { return a.end < b.end ? -1 : 1; })[0];
  var tasks = D.myTasks().map(function (t, i, arr) { var dl = t.nodate ? 999 : daysTo(t.end); return { title: t.title, event: t.event, due: t.nodate ? '期間未定' : md(t.end) + ' ' + wd(t.end), dueColor: dl < 0 ? '#FF5C66' : (dl <= 3 ? RT : '#BDBAB3'), late: dl < 0, sep: i < arr.length - 1 ? '1px solid #252524' : '0', done: function () { D.complete(t); } }; });
  var weekEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + (6 - now.getDay()));
  var we = weekEnd.getFullYear() + '-' + String(weekEnd.getMonth() + 1).padStart(2, '0') + '-' + String(weekEnd.getDate()).padStart(2, '0');
  var weekEv = D.calendar().filter(function (e) { return e.date >= today && e.date <= we; });
  var recent = D.items('recruit').concat(D.items('idea'), D.items('pain')).filter(function (x) { return Date.now() - new Date(x.created_at) < 7 * 86400000; });
  var nr = recent.filter(function (x) { return x.kind !== 'pain'; }).length, np = recent.length - nr;
  var inis = []; recent.forEach(function (x) { var i = D.ini(x.author); if (inis.indexOf(i) < 0 && inis.length < 3) inis.push(i); });
  var notifs = D.notifs().slice(0, 6).map(function (n, i, arr) { return { text: n.text, sub: n.sub, at: D.ago(n.created_at), unread: !n.read, dot: n.read ? 'transparent' : RT, sep: i < arr.length - 1 ? '1px solid #252524' : '0', read: function () { D.readNotif(n.id); } }; });

  // 学習：自分のロールトラックの進み具合
  var T = D.tracks(), myRole = (self0.roles || [])[0] || '', roleT = T.filter(function (t) { return t.name === myRole; })[0];
  var doneIn = function (t) { return D.units(t).filter(function (u) { return D.mine(t.id + ':' + u.code, 'done'); }).length; };
  var baseT = T.filter(function (t) { return /基礎/.test(t.name); })[0];
  var rN = roleT ? D.units(roleT).length : 0, rD = roleT ? doneIn(roleT) : 0;
  var bN = baseT ? D.units(baseT).length : 0, bD = baseT ? doneIn(baseT) : 0;
  var allN = T.reduce(function (a, t) { return a + D.units(t).length; }, 0), allD = T.reduce(function (a, t) { return a + doneIn(t); }, 0);
  var nextU = roleT ? D.units(roleT).filter(function (u) { return !D.mine(roleT.id + ':' + u.code, 'done'); })[0] : null;
  var ring = 2 * Math.PI * 22, pct = rN ? rD / rN : 0;

  // 単元の詳細
  var ut = T.filter(function (t) { return t.id === s.unitT; })[0], uu = ut ? D.units(ut).filter(function (x) { return x.code === s.unitC; })[0] : null, ud = ut && uu ? D.unitData(ut, uu.code) : {};
  var udone = ut && uu ? D.mine(ut.id + ':' + uu.code, 'done') : false;
  var unit = {
    head: ut && uu ? ut.name + ' · ' + uu.code : '', title: uu ? uu.title : '',
    deps: uu && uu.deps.length ? '前提：' + uu.deps.join('、') : '前提なし', inperson: uu && uu.tags.indexOf('対面') >= 0, hasPractice: !!(ud.practice), practice: ud.practice || '',
    practiceTitle: uu && uu.tags.indexOf('実習') >= 0 ? '実習' : '演習', milestone: ud.milestone || 'まだ設定されていません', noMaterials: !(ud.materials || []).length,
    doneLabel: udone ? '修了済み（取り消す）' : '修了にする', doneBg: udone ? 'transparent' : A, doneFg: udone ? A : INK,
    toggle: function () { if (ut && uu) D.toggle(ut.id + ':' + uu.code, 'done'); }
  };

  // 予定
  var cy = s.calY || now.getFullYear(), cm = s.calM || (now.getMonth() + 1);
  var sel = s.calSel && s.calSel.y === cy && s.calSel.m === cm ? s.calSel.d : (now.getFullYear() === cy && now.getMonth() + 1 === cm ? now.getDate() : 1);
  var mv = function (d) { return function () { var m = cm + d, y = cy; if (m < 1) { m = 12; y--; } if (m > 12) { m = 1; y++; } self.setState({ calY: y, calM: m, calSel: null }); }; };

  // マイページ
  var ROLES = ['Strategist', 'Negotiator', 'Advertiser', 'Engineer', 'Innovator'];
  var roleChips = ROLES.map(function (r) { var on = (self0.roles || []).indexOf(r) >= 0; return { name: r, bg: on ? A : 'transparent', fg: on ? INK : '#D2CFC8', bd: on ? A : '#383836',
    pick: function () { var rs = (self0.roles || []).slice(), i = rs.indexOf(r); if (i >= 0) rs.splice(i, 1); else rs.push(r); D.saveProfile({ roles: rs }); } }; });
  var myProjects = D.items('recruit').filter(function (x) { return x.author === D.me || ((x.data || {}).roles || []).some(function (r) { return D.mine(x.id, 'slot:' + r); }); })
    .map(function (x) { var d = x.data || {}; var mine = ((d.roles || []).filter(function (r) { return D.mine(x.id, 'slot:' + r); })[0]) || (x.author === D.me ? '発起人' : ''); return { label: (d.frame || '') + ' · ' + mine, title: d.title, open: function () { self.setState({ sub: 'post', post: x.id }); } }; });

  // 投稿・コメント
  var cur = v.cur || {};
  var reasons = ['攻撃的な表現', '勧誘・宣伝', '関係のない投稿', 'その他'];
  return {
    meIni: D.ini(D.me), isOps: D.isOps(), logout: D.logout,
    todayLabel: WDJ[now.getDay()] + ' · ' + (now.getMonth() + 1) + '.' + now.getDate(), hello: 'こんにちは、' + (self0.name || '') + 'さん',
    next: nextEv ? { has: true, label: 'NEXT · 部内イベント', title: nextEv.title, when: md(nextEv.end) + ' ' + wd(nextEv.end), left: String(Math.max(0, daysTo(nextEv.end))) } : { has: false, label: 'NEXT', title: '予定されているイベントはありません', when: '', left: '—' },
    learnCard: { n: rN ? rD + '/' + rN : '—', dash: (ring * pct).toFixed(1) + ' ' + ring.toFixed(1), track: myRole || 'ロール未設定', next: nextU ? nextU.code + '\n' + nextU.title : (roleT ? '全単元修了' : 'マイページでロールを選ぶ') },
    tasks: tasks, hasTasks: tasks.length > 0,
    // ホームの右上のカード：業務を担当している人は「自分の業務」、それ以外は「参加予定」（参加登録したこれからのイベント）
    card2: (function () {
      if (tasks.length) return { label: '自分の業務', n: String(tasks.length), note: '次の期限 ' + tasks[0].due, go: function () { var el = document.querySelector('#stage .h2'); if (el) el.scrollIntoView({ behavior: 'smooth' }); } };
      var js = D.events().concat(D.progEvents()).filter(function (e) { return e.end >= today && D.mine(e.id, 'join'); }).sort(function (a, b) { return a.start < b.start ? -1 : 1; });
      return { label: '参加予定', n: String(js.length), note: js.length ? '次 ' + md(js[0].start || js[0].end) + ' ' + js[0].title : '予定タブから参加登録', go: function () { self.setState({ tab: 'cal', sub: null }); } };
    })(),
    weekCount: String(weekEv.length), boardNew: { n: String(recent.length), inis: inis.map(function (i) { return { i: i }; }), note: '募集・意見 ' + nr + ' · ペイン ' + np },
    hasNews: false, notifs: notifs, hasNotifs: notifs.length > 0,
    level: { lv: String(Math.floor(allD / 4) + 1).padStart(2, '0'), track: myRole ? myRole + ' 受講中' : 'ロールを選んでください', ms: '修了 ' + allD + ' / ' + allN + ' 単元', w: (allN ? Math.round(allD / allN * 100) : 0) + '%' },
    baseNote: bN ? bD + ' / ' + bN + ' 修了' : 'まだ単元がありません', basePct: (bN ? Math.round(bD / bN * 100) : 0) + '%',
    roleNote: myRole ? '受講中：' + myRole : 'ロール未設定', rolePct: (rN ? Math.round(rD / rN * 100) : 0) + '%', pracBadge: String(v.pStats ? v.pStats[0].n : 0), hasPracBadge: !!(v.pStats && v.pStats[0].n),
    unit: unit, openUnit: function () {},
    calTitle: cy + '.' + String(cm).padStart(2, '0'), calPrev: mv(-1), calNext: mv(1), dayTitle: cm + '.' + sel + ' ' + WDJ[new Date(cy, cm - 1, sel).getDay()],
    me: { name: self0.name, grade: self0.grade || '学部・学年未設定', lv: 'Lv.' + String(Math.floor(allD / 4) + 1).padStart(2, '0'), track: myRole ? myRole + ' 受講中' : 'ロール未設定', post: self0.post && self0.post !== '—' ? self0.post : 'プレイヤー', roles: roleChips,
      editName: function () { var n = prompt('名前', self0.name || ''); if (n == null) return; var g = prompt('学部・学年（例：経営 1年）', self0.grade || ''); if (g == null) return; D.saveProfile({ name: n.trim() || self0.name, grade: g.trim() }); } },
    myProjects: myProjects, noProjects: myProjects.length === 0,
    curMine: !!cur.mine, curOther: !!cur.notMine,
    curDelete: function () { if (confirm('この投稿を削除しますか？')) { D.remove(cur.id); self.setState({ sub: null }); } },
    curReport: function () { var r = prompt('通報の理由（番号）\n1 攻撃的な表現\n2 勧誘・宣伝\n3 関係のない投稿\n4 その他', '1'); if (r == null) return; D.report(cur.id, reasons[(+r || 4) - 1] || 'その他'); },
    curToRecruit: function () { if (!cur.mine) return; self.setState({ sub: 'postNew', np: 'recruit' }); setTimeout(function () { var t = document.getElementById('npTitle'), m = document.getElementById('npSummary'); if (t) t.value = cur.title; if (m) m.value = cur.purpose; }, 50); },
    sendComment: function () {
      var t = val('cmText'); if (!t) return; var lens = (self0.roles || [])[0] || '一般';
      D.add('comment', { text: t, lens: lens }, cur.id).then(function (r) { if (r) { var e = document.getElementById('cmText'); if (e) e.value = ''; } });
    },
    submitPain: function () {
      var t = val('painText'); if (!t) { D.flash('何に困っているかを書いてください'); return; }
      D.add('pain', { text: t, who: val('painWho'), src: s.src || '自分', sev: s.sev || 2, tags: val('painTags').split(/[\s,、#＃]+/).filter(Boolean).slice(0, 5), anon: !!s.anon })
        .then(function (r) { if (r) self.setState({ sub: null, tab: 'board', seg: 'pain', src: null, sev: null, anon: false }); });
    },
    submitPost: function () {
      var title = val('npTitle'), sum = val('npSummary'); if (!title) { D.flash('タイトルを入れてください'); return; }
      if (s.np === 'recruit') {
        var roles = Object.keys(s.npRoles || {}).filter(function (k) { return s.npRoles[k]; });
        if (!roles.length) { D.flash('必要な職能を1つ以上選んでください'); return; }
        if (s.npEnd == null) { D.flash('解散条件を選んでください'); return; }
        var ends = ['ビジコン終了後に解散', 'ビジコン入賞時は継続', '事業の存続が不可能と判断した時点で解散'];
        D.add('recruit', { title: title, purpose: sum, frame: s.npFrame || '実プロジェクト枠', roles: roles, end: ends[s.npEnd], pain: val('npPain') }).then(function (r) { if (r) self.setState({ sub: null, tab: 'board', seg: 'recruit', bfilter: 'all', npRoles: {}, npEnd: null }); });
      } else {
        D.add('idea', { title: title, summary: sum, asks: [val('npAsk1'), val('npAsk2')].filter(Boolean), pain: val('npPain') }).then(function (r) { if (r) self.setState({ sub: null, tab: 'board', seg: 'recruit', bfilter: 'all' }); });
      }
    },
    submitEvent: function () {
      var title = val('enTitle'); if (!title) { D.flash('タイトルを入れてください'); return; }
      var url = val('enUrl'); if (url && !/^https?:\/\//i.test(url)) url = 'https://' + url;
      D.add('offer', { type: s.enType || 'ビジコン', title: title, host: val('enHost'), due: val('enDue'), url: url, note: val('enNote'), roles: Object.keys(s.npRoles || {}).filter(function (k) { return s.npRoles[k]; }), state: 'wait' })
        .then(function (r) { if (r) { self.setState({ sub: null, tab: 'board', seg: 'event', npRoles: {} }); D.flash('共有しました。渉外局が確認すると公式になります'); } });
    },
    postOther: function () {
      var t = val('otText'); if (!t) return; var tag = (s.otf === '本' || s.otf === '雑談') ? s.otf : '雑談';
      D.add('other', { text: t, tag: tag }).then(function (r) { if (r) { var e = document.getElementById('otText'); if (e) e.value = ''; } });
    },
    painOpts: D.items('pain').map(function (x) { return { text: (x.data || {}).text || '' }; }),
    setLq: function (e) { self.setState({ lq: e.target.value }); }, setUq: function (e) { self.setState({ uq: e.target.value }); }
  };
}

// スマホ：ピンチで画面全体が拡大・縮小しないようにする
document.addEventListener('touchmove', function (e) { if (e.touches.length > 1) e.preventDefault(); }, { passive: false });
document.addEventListener('gesturestart', function (e) { e.preventDefault(); }, { passive: false });
document.addEventListener('gesturechange', function (e) { e.preventDefault(); }, { passive: false });

function __trackMk(sb, app) {
  return function (tab) {
    tab = tab || 'open';
    try { var k = 'slope-trk-' + app + '-' + tab, t = +sessionStorage.getItem(k) || 0; if (Date.now() - t < 10 * 60 * 1000) return; sessionStorage.setItem(k, String(Date.now())); } catch (e) {}
    try { sb.from('visits').insert({ app: app, tab: tab }).then(function () {}, function () {}); } catch (e) {}
  };
}
window.__track = function (tab) { if (/[?&]embed=1/.test(location.search)) return; (window.__trk = window.__trk || __trackMk(window.sb, 'member'))(tab); };
