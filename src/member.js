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
    CAL: 'https://addvjcwwlklwmkwhhsjv.supabase.co/functions/v1/cal', calTok: null,
    VAPID: 'BNYuEXq2mMrHbNn06huazGpyd0PqDbp-CVXr2TJ7Ev-8Oy2OCjJzbW-DVeopb2BcvZHMoS5g98I5VUw4i8jXlgU', pushOn: null,
    pushState: function () { // on / off / denied / ios（ホーム画面に追加が要る）/ no
      var ios = /iP(hone|ad|od)/.test(navigator.userAgent), app = window.matchMedia && matchMedia('(display-mode: standalone)').matches || navigator.standalone;
      if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return ios && !app ? 'ios' : 'no';
      if (Notification.permission === 'denied') return 'denied';
      if (DB.pushOn === null) { DB.pushOn = false; navigator.serviceWorker.ready.then(function (r) { return r.pushManager.getSubscription(); }).then(function (x) { if (x) { DB.pushOn = true; bump(); } }).catch(function () {}); }
      return DB.pushOn ? 'on' : 'off';
    },
    pushToggle: function () {
      var st = DB.pushState(); if (st !== 'on' && st !== 'off') return;
      if (st === 'on') { navigator.serviceWorker.ready.then(function (r) { return r.pushManager.getSubscription(); }).then(function (x) { if (!x) return; sb.from('push_subs').delete().eq('endpoint', x.endpoint).then(function () {}); return x.unsubscribe(); }).then(function () { DB.pushOn = false; bump(); }); return; }
      var key = (function (b) { b = b.replace(/-/g, '+').replace(/_/g, '/'); b += '===='.slice(b.length % 4 || 4); var r = atob(b), a = new Uint8Array(r.length); for (var i = 0; i < r.length; i++) a[i] = r.charCodeAt(i); return a; })(DB.VAPID);
      Notification.requestPermission().then(function (p) {
        if (p !== 'granted') { bump(); return; }
        return navigator.serviceWorker.ready.then(function (r) { return r.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key }); }).then(function (x) {
          var j = x.toJSON(); return sb.from('push_subs').upsert({ user_id: DB.me, endpoint: j.endpoint, p256dh: j.keys.p256dh, auth: j.keys.auth }, { onConflict: 'endpoint' });
        }).then(function (r) { if (r && r.error) { DB.flash('うまく登録できませんでした'); return; } DB.pushOn = true; bump(); });
      }).catch(function () { DB.flash('うまく登録できませんでした'); });
    },
    ensureCal: function () { // カレンダー購読用の合い言葉（なければ作る）
      if (DB._ctAsk || !DB.me) return; DB._ctAsk = true;
      sb.from('cal_tokens').select('token').eq('user_id', DB.me).then(function (r) {
        var row = r.data && r.data[0]; if (row) { DB.calTok = row.token; bump(); return; }
        var tk = (window.crypto && crypto.randomUUID ? crypto.randomUUID() : String(Math.random()).slice(2) + Date.now()).replace(/-/g, '');
        sb.from('cal_tokens').insert({ user_id: DB.me, token: tk }).then(function (r2) { if (!r2.error) { DB.calTok = tk; bump(); } else DB._ctAsk = false; });
      });
    },
    prog: function () { var pg = ITEMS.filter(function (x) { return x.kind === 'program' && x.state === 'ok'; })[0]; return (pg && pg.data && pg.data.v2) || []; },
    level: function (uid) { // 印（レベル）を付けたイベントの並び順で、出席したいちばん後ろのもの
      var L = 0, i = 0, cal = {}; ITEMS.forEach(function (x) { if (x.kind === 'cal') cal[x.id] = x.data || {}; });
      (function w(a) { a.forEach(function (n) { if (n.out) return; if (n.k === 'e' && n.lv) { i++; if (((cal[n.ref] || {}).att || []).indexOf(uid) >= 0) L = i; } if (n.items) w(n.items); }); })(DB.prog());
      return L;
    },
    quizOf: function (t, code) { return ((DB.unitData(t, code).quiz) || []).filter(function (q) { return q && q.q && (q.c || []).filter(Boolean).length >= 2; }); },
    milestones: function () { // 確認問題のある単元＝マイルストーン。いちばん上のフォルダごとに数える（自分のロール以外のロールは数えない）
      var T = DB.tracks(), by = {}, roles = DB.myRoles(), R5 = ['Strategist', 'Negotiator', 'Advertiser', 'Engineer', 'Innovator'], out = [];
      T.forEach(function (t) { by[t.id] = t; });
      DB.prog().forEach(function (f) { if (f.out || f.k !== 'f') return; if (R5.indexOf(f.name) >= 0 && roles.length && roles.indexOf(f.name) < 0) return;
        var n = 0, d = 0;
        (function w(a, nm) { a.forEach(function (x) { if (x.k === 'f' && R5.indexOf(x.name) >= 0 && roles.length && roles.indexOf(x.name) < 0) return; if (x.k === 'u' && by[x.t] && DB.quizOf(by[x.t], x.c).length) { n++; if (DB.mine(x.t + ':' + x.c, 'done')) d++; } if (x.items) w(x.items); }); })(f.items || []);
        if (n) out.push({ label: f.name + ' ' + d + '/' + n }); });
      return out;
    },
    isOps: function () { return !!(DB.self && POSTS[DB.self.post]); },
    tracks: function () {
      return ITEMS.filter(function (x) { return x.kind === 'track' && x.state === 'ok' && (x.data || {}).status === 'pub'; }).sort(function (a, b) { return a.pos - b.pos; })
        .map(function (x) { return Object.assign({ name: '', start: '', goal: '', list: [], units: {} }, x.data, { id: x.id }); });
    },
    units: function (t) { return (t.list || []).filter(function (u) { return u && u.title; }).map(function (u) { return { code: u.code, title: u.title, tags: u.tags || [], deps: u.deps || [] }; }); },
    unitData: function (t, code) { return (t.units || {})[code] || {}; },
    events: function () {
      return []; // 業務のイベントは部員に公開しない（部員に出すイベントは学ぶのプログラムのものだけ）
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
    clubEvents: function () { // 部内イベント：告知で公開したイベント（日程未定のものは最後に）
      var out = [];
      ITEMS.filter(function (x) { return x.kind === 'cal' && x.state === 'ok' && (x.data || {}).state === 'pub'; }).forEach(function (x) { var d = x.data || {}; var ok = /^\d{4}-\d{2}-\d{2}$/.test(d.date || ''); if (!d.title) return; out.push({ id: x.id, title: d.title, start: ok ? d.date : '', end: ok ? (d.to || d.date) : '', tbd: !ok, sub: [d.time, d.place, d.memo].filter(Boolean).join(' · '), pub: d.state === 'pub' }); });
      return out.sort(function (a, b) { return a.tbd !== b.tbd ? (a.tbd ? 1 : -1) : (a.start < b.start ? -1 : 1); }); // 日程が決まっていないものは最後に
    },
    calendar: function () {
      var out = DB.events().map(function (e) { return { date: e.end, type: '部内', title: e.title, time: e.start === e.end ? '' : '期間 ' + e.start.slice(5).replace('-', '.') + '〜', place: e.unit, joinId: e.id, joinKind: 'join' }; });
      ITEMS.filter(function (x) { return (x.kind === 'notice' || x.kind === 'offer') && DB.mine(x.id, 'plan'); }).forEach(function (x) {
        var d = x.data || {}; if (/^\d{4}-\d{2}-\d{2}$/.test(d.due || '')) out.push({ date: d.due, type: '外部', title: d.title, time: '締切', place: d.host || '', joinId: x.id, joinKind: 'plan' });
      });
      var club = {}; DB.clubEvents().forEach(function (e) { club[e.id] = e; }); // 告知で公開したもの＋教材に入っているもの
      ITEMS.filter(function (x) { return x.kind === 'cal' && x.state === 'ok' && club[x.id]; }).forEach(function (x) {
        var d = x.data || {}; if (/^\d{4}-\d{2}-\d{2}$/.test(d.date || '')) out.push({ date: d.date, type: '部内', title: d.title, time: (d.to ? '〜' + d.to.slice(5).replace('-', '.') + ' ' : '') + (d.time || ''), place: d.place || '', joinId: club[x.id].pub ? x.id : null, joinKind: 'join' });
      });
      [].forEach(function (e) { out.push({ date: e.end, type: '部内', title: e.title, time: e.start === e.end ? '' : '期間 ' + e.start.slice(5).replace('-', '.') + '〜', place: e.todo, joinId: e.pub ? e.id : null, joinKind: 'join' }); });
      DB.myTasks().filter(function (t) { return !t.nodate; }).forEach(function (t) { out.push({ date: t.end, type: '教育', title: t.title + '（期限）', time: '', place: t.event, joinId: null }); });
      return out;
    },
    myTasks: function () {
      var by = {}; NODES.forEach(function (n) { by[n.id] = n; });
      var hasKids = {}; NODES.forEach(function (n) { if (n.parent_id) hasKids[n.parent_id] = 1; });
      var root = function (n) { var x = n && by[n.parent_id]; while (x) { if (x.kind === 'event') return x; x = by[x.parent_id]; } return by[n.parent_id] || n; };
      return NODES.filter(function (n) { return (n.who === DB.me || (n.team || []).indexOf(DB.me) >= 0) && !n.done && !hasKids[n.id] && n.parent_id && !(n.data && n.data.folder); })
        .sort(function (a, b) { var na = !!(a.data && a.data.nodate), nb = !!(b.data && b.data.nodate); if (na !== nb) return na ? 1 : -1; return a.end_date < b.end_date ? -1 : 1; })
        .map(function (n) { return { id: n.id, title: n.title, end: n.end_date, nodate: !!(n.data && n.data.nodate), event: (root(n) || {}).title || '', parent: by[n.parent_id] }; });
    },
    notifs: function () { return NOTIFS; },
    delNotif: function (id) { NOTIFS = NOTIFS.filter(function (n) { return id !== 'all' && n.id !== id; }); bump(); var q = sb.from('notifications').delete(); (id === 'all' ? q.eq('to_id', DB.me) : q.eq('id', id)).then(function (r) { if (r.error) DB.flash('削除できませんでした'); }); },
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
    readAll: function () { if (!NOTIFS.some(function (n) { return !n.read; })) return; NOTIFS.forEach(function (n) { n.read = true; }); bump(); sb.from('notifications').update({ read: true }).eq('to_id', DB.me).eq('read', false).then(function () {}); },
    readNotif: function (id) { NOTIFS.forEach(function (n) { if (n.id === id) n.read = true; }); bump(); sb.from('notifications').update({ read: true }).eq('id', id).then(function () {}); },
    // 通知の設定（受け取る種類・止めているイベント／フォルダー）。止めた通知はデータベースで作られなくなる
    nPrefs: function () { var p = DB.self || {}; return { off: (p.notif_off || []).slice(), app: (p.notif_app || ['done']).slice(), mute: (p.notif_mute || []).slice(), due: (p.notif_due || [3, 0]).slice() }; },
    nSet: function (q) {
      if (!DB.self) return; DB.self.notif_off = q.off; DB.self.notif_app = q.app; DB.self.notif_mute = q.mute; DB.self.notif_due = q.due; bump();
      return sb.from('profiles').update({ notif_off: q.off, notif_app: q.app, notif_mute: q.mute, notif_due: q.due }).eq('id', DB.me).then(function (r) { if (r.error) DB.flash('通知の設定を保存できませんでした'); });
    },
    saveProfile: function (patch) { Object.assign(DB.self, patch); bump(); return sb.from('profiles').update(patch).eq('id', DB.me).then(function (r) { if (r.error) DB.flash('保存できませんでした'); else DB.flash('保存しました'); reload(); }); },
    inqs: null,
    loadInq: function () { sb.from('inquiries').select('*').eq('user_id', DB.me).order('created_at', { ascending: false }).then(function (r) { DB.inqs = r.data || []; bump(); }); },
    sendInq: function (kind, body) { return sb.from('inquiries').insert({ user_id: DB.me, kind: kind, body: body }).then(function (r) { if (r.error) { DB.flash('送れませんでした'); return false; } DB.flash('送りました'); DB.loadInq(); return true; }); },
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
    if (kind === 'loading' && document.getElementById('boot')) return;
    if (kind !== 'loading' && window.__bootDone) window.__bootDone();
    if (!kind) { if (g) g.remove(); return; }
    if (!g) { g = document.createElement('div'); g.id = 'mgate'; document.body.appendChild(g); }
    var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
    var body = '';
    if (kind === 'loading') { g.innerHTML = '<div id="boot" role="status" aria-label="読み込み中" style="--bootbg:#070707;--bootfg:#F3F1EC"><svg class="bootlogo" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 4.5c5-1.4 13-1.4 18 0-.6 1.3-1.5 2.2-2.6 2.6-4.3-.7-8.5-.7-12.8 0C4.5 6.7 3.6 5.8 3 4.5z" fill="currentColor"/><path d="M7.3 9.2l7.2-.3-.6 1.9 3.6-.1-2.4 3.4-3.3.1L9.3 21z" fill="currentColor"/></svg></div>'; return; }
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
  if (v && v.show) v.show.fab = false; // 掲示板の＋は掲示板の中に
  var D = window.DB, s = this.state, self = this, A = '#F3F1EC', RT = '#F2A93B', INK = '#070707';
  var val = function (id) { var e = document.getElementById(id); return e ? e.value.trim() : ''; };
  var WDJ = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'], now = new Date();
  var md = function (iso) { var p = String(iso || '').split('-'); return p.length === 3 ? (+p[1]) + '.' + (+p[2]) : ''; };
  var wd = function (iso) { var p = String(iso || '').split('-'); return p.length === 3 ? WDJ[new Date(+p[0], +p[1] - 1, +p[2]).getDay()] : ''; };
  var daysTo = function (iso) { var p = String(iso || '').split('-'); if (p.length !== 3) return 0; var t = new Date(+p[0], +p[1] - 1, +p[2]), n = new Date(now.getFullYear(), now.getMonth(), now.getDate()); return Math.round((t - n) / 86400000); };
  var today = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');
  var self0 = D.self || { name: '', grade: '', roles: [] };

  // ホーム
  // 運営からのお知らせ（掲載期限まで）があれば、ホームの一番上をそれに
  var goCalTop = function () { if (window.__track) window.__track('cal'); self.setState({ tab: 'cal', sub: null }); };
  var anns = D.items('ann').map(function (x) { return Object.assign({ at: x.created_at || '' }, x.data || {}, { id: x.id }); }).filter(function (a) { return a.title && (a.until || '') >= today; }).sort(function (a, b) { return a.at < b.at ? 1 : -1; }).slice(0, 5);
  var nextEv = D.clubEvents().filter(function (e) { return e.end >= today; }).sort(function (a, b) { return a.end < b.end ? -1 : 1; })[0];
  var tasks = D.myTasks().map(function (t, i, arr) { var dl = t.nodate ? 999 : daysTo(t.end); return { title: t.title, event: t.event, due: t.nodate ? '期間未定' : md(t.end) + ' ' + wd(t.end), dueColor: dl < 0 ? '#FF5C66' : (dl <= 3 ? RT : '#BDBAB3'), late: dl < 0, sep: i < arr.length - 1 ? '1px solid #252524' : '0', done: function () { D.complete(t); } }; });
  var weekEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + (6 - now.getDay()));
  var we = weekEnd.getFullYear() + '-' + String(weekEnd.getMonth() + 1).padStart(2, '0') + '-' + String(weekEnd.getDate()).padStart(2, '0');
  var weekEv = D.calendar().filter(function (e) { return e.date >= today && e.date <= we; });
  var recent = D.items('recruit').concat(D.items('idea'), D.items('pain')).filter(function (x) { return Date.now() - new Date(x.created_at) < 7 * 86400000; });
  var nr = recent.filter(function (x) { return x.kind !== 'pain'; }).length, np = recent.length - nr;
  var inis = []; recent.forEach(function (x) { var i = D.ini(x.author); if (inis.indexOf(i) < 0 && inis.length < 3) inis.push(i); });
  var nmap = function (n, i, arr) { return { nid: String(n.id), text: n.text, sub: n.sub, at: D.ago(n.created_at), unread: !n.read, dot: n.read ? 'transparent' : RT, sep: i < arr.length - 1 ? '1px solid #252524' : '0', read: function () { D.readNotif(n.id); }, del: function () { D.delNotif(n.id); } }; };
  var notifsAll = D.notifs().map(nmap);
  var notifs = D.notifs().slice(0, 6).map(function (n, i, arr) { return { text: n.text, sub: n.sub, at: D.ago(n.created_at), unread: !n.read, dot: n.read ? 'transparent' : RT, sep: i < arr.length - 1 ? '1px solid #252524' : '0', read: function () { D.readNotif(n.id); }, del: function () { D.delNotif(n.id); } }; });

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
  var uqz = ut && uu ? D.quizOf(ut, uu.code) : [];
  window.__UQ = uqz.length ? { key: ut.id + ':' + uu.code, qs: uqz, done: udone, pass: function () { if (!D.mine(ut.id + ':' + uu.code, 'done')) D.toggle(ut.id + ':' + uu.code, 'done'); } } : null;
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
  var roleChips = ROLES.map(function (r) { var on = (self0.roles || []).indexOf(r) >= 0; return { name: r, on: String(on), op: on ? 1 : 0, bg: on ? A : 'transparent', fg: on ? INK : '#D2CFC8', bd: on ? A : '#383836',
    pick: function () { var rs = (self0.roles || []).slice(), i = rs.indexOf(r); if (i >= 0) rs.splice(i, 1); else rs.push(r); D.saveProfile({ roles: rs }); } }; });
  var myProjects = D.items('recruit').filter(function (x) { return x.author === D.me || ((x.data || {}).roles || []).some(function (r) { return D.mine(x.id, 'slot:' + r); }); })
    .map(function (x) { var d = x.data || {}; var mine = ((d.roles || []).filter(function (r) { return D.mine(x.id, 'slot:' + r); })[0]) || (x.author === D.me ? '発起人' : ''); return { label: (d.frame || '') + ' · ' + mine, title: d.title, open: function () { self.setState({ sub: 'post', post: x.id }); } }; });

  // 投稿・コメント
  var cur = v.cur || {};
  var reasons = ['攻撃的な表現', '勧誘・宣伝', '関係のない投稿', 'その他'];
  return {
    meIni: D.ini(D.me), isOps: D.isOps(), logout: D.logout,
    todayLabel: WDJ[now.getDay()] + ' · ' + (now.getMonth() + 1) + '.' + now.getDate(), hello: 'こんにちは、' + (self0.name || '') + 'さん',
    anns: anns.map(function (a) { return { title: a.title, body: a.body || '', tfs: a.title.length > 22 ? '18px' : '21px', go: function () { annPop(a); } }; }), hasAnn: anns.length > 0,
    dots: anns.concat([0]).map(function () { return {}; }),
    next: nextEv ? { has: true, lc: '#F2A93B', rd: 'flex', wc: 'en', tfs: '21px', go: goCalTop, aid: '', label: 'NEXT · 部内イベント', title: nextEv.title, when: md(nextEv.end) + ' ' + wd(nextEv.end), left: String(Math.max(0, daysTo(nextEv.end))) } : { has: false, lc: '#F2A93B', rd: 'flex', wc: 'en', tfs: '21px', go: goCalTop, aid: '', label: 'NEXT', title: '予定されているイベントはありません', when: '', left: '—' },
    learnCard: (function () { // 運営のプログラムどおり（変えるとすぐ反映）
      var used = (window.__progSummary ? 'y' : 'n') + (window.__PROG ? window.__PROG.key + '|' + window.__PROG.jkey : '');
      setTimeout(function () { var now = (window.__progSummary ? 'y' : 'n') + (window.__PROG ? window.__PROG.key + '|' + window.__PROG.jkey : ''); if (now !== used && window.__comp) window.__comp.forceUpdate(); }, 0); // 学ぶのデータが新しくなったら描き直す
      var P = window.__progSummary && window.__PROG ? window.__progSummary(window.__PROG) : null;
      if (!P) return { lk: 'none', nfs: '13px', op: '1', code: nextU ? nextU.code : '', title: nextU ? nextU.title : (roleT ? '全単元修了' : 'マイページでロールを選ぶ'), n: rN ? rD + '/' + rN : '—', dash: (ring * pct).toFixed(1) + ' ' + ring.toFixed(1), track: myRole || 'ロール未設定', next: nextU ? nextU.code + '\n' + nextU.title : (roleT ? '全単元修了' : 'マイページでロールを選ぶ') };
      var p = P.n ? P.d / P.n : 0;
      return { n: P.n ? P.d + '/' + P.n : '—', dash: (ring * p).toFixed(1) + ' ' + ring.toFixed(1), track: myRole || 'プログラム', code: P.next ? P.next.code : '', title: P.next ? P.next.title : (P.n ? 'すべて修了' : 'まだありません'), lk: P.next && P.next.locked ? 'block' : 'none', nfs: P.next && P.next.locked ? '11px' : '13px', op: P.next && P.next.locked ? '0.55' : '1' };
    })(),
    clubEvents: D.clubEvents().filter(function (e) { return e.tbd || e.end >= today; }).map(function (e) { var on = D.mine(e.id, 'join'), p = e.start.split('-');
      return { id: e.id, mon: e.tbd ? '日程' : ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'][+p[1] - 1], d: e.tbd ? '未定' : String(+p[2]), dfs: e.tbd ? '15px' : '22px', title: e.title, sub: [e.end !== e.start ? '〜' + md(e.end) : '', e.sub].filter(Boolean).join(' · '),
        jd: e.pub && !e.tbd ? 'inline-flex' : 'none', /* 日程未定は参加登録できない */ joinLabel: on ? '✓ 登録済み' : '参加登録', joinBd: on ? 'transparent' : '#474744', joinFg: on ? '#7D7B76' : '#D2CFC8', toggle: function () { D.toggle(e.id, 'join'); } }; }),
    noClubEvents: !D.clubEvents().some(function (e) { return e.tbd || e.end >= today; }),
    tasks: tasks, hasTasks: tasks.length > 0,
    // ホームの右上のカード：業務を担当している人は「自分の業務」、それ以外は「参加予定」（参加登録したこれからのイベント）
    card2: (function () {
      if (tasks.length) return { label: '自分の業務', n: String(tasks.length), note: '次の期限 ' + tasks[0].due, go: function () { var el = document.querySelector('#stage .h2'); if (el) el.scrollIntoView({ behavior: 'smooth' }); } };
      var js = D.clubEvents().filter(function (e) { return (e.tbd || e.end >= today) && D.mine(e.id, 'join'); });
      return { label: '参加予定', n: String(js.length), note: js.length ? '次 ' + (js[0].tbd ? '' : md(js[0].start || js[0].end) + ' ') + js[0].title : '予定タブから参加登録', go: function () { self.setState({ tab: 'cal', sub: null }); } };
    })(),
    weekCount: String(weekEv.length),
    week: (function () { // 今週の予定：いちばん近いものの名前（なければ —）と、日〜土のどの日に予定があるか
      var L = weekEv.slice().sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : 0; }), e0 = L[0];
      var iso = function (d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
      var all = D.calendar(), days = ['日', '月', '火', '水', '木', '金', '土'].map(function (l, k) {
        var dd = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay() + k), dt = iso(dd), has = all.some(function (e) { return e.date === dt; }), isT = dt === today, past = dt < today;
        return { l: String(dd.getDate()), fw: isT ? '700' : '500', lc: isT ? 'var(--fg)' : 'var(--n37)', bg: has ? (past ? 'var(--n37)' : 'var(--ac)') : 'var(--n16)' };
      });
      return { has: !!e0, none: !e0, title: e0 ? e0.title : '', days: days };
    })(), boardNew: { n: String(recent.length), inis: inis.map(function (i) { return { i: i }; }), note: '募集・意見 ' + nr + ' · ペイン ' + np },
    hasNews: false, notifs: notifs, hasNotifs: notifs.length > 0, notifsAll: notifsAll, noNotifs: !notifsAll.length, bellDot: D.notifs().some(function (n) { return !n.read; }) ? 'block' : 'none',
    nPop: !!s.nPop, closeNotifs: function () { self.setState({ nPop: false }); },
    goNotifs: function () { var o = !s.nPop; self.setState({ nPop: o }); if (o) setTimeout(function () { D.readAll(); }, 1500); }, delAllNotifs: function () { D.delNotif('all'); },
    level: { lv: String(Math.floor(allD / 4) + 1).padStart(2, '0'), track: myRole ? myRole + ' 受講中' : 'ロールを選んでください', ms: '修了 ' + allD + ' / ' + allN + ' 単元', w: (allN ? Math.round(allD / allN * 100) : 0) + '%' },
    baseNote: bN ? bD + ' / ' + bN + ' 修了' : 'まだ単元がありません', basePct: (bN ? Math.round(bD / bN * 100) : 0) + '%',
    roleNote: myRole ? '受講中：' + myRole : 'ロール未設定', rolePct: (rN ? Math.round(rD / rN * 100) : 0) + '%', pracBadge: String(v.pStats ? v.pStats[0].n : 0), hasPracBadge: !!(v.pStats && v.pStats[0].n),
    unit: unit, uNoQuiz: !uqz.length, openUnit: function () {},
    iq: (function () {
      var K = ['要望', '不具合', '質問', 'その他'], cur = s.iqKind || '要望';
      if (s.iqPop && D.inqs === null) { D.inqs = []; D.loadInq(); }
      var mine = (D.inqs || []).map(function (q) { var d = new Date(q.created_at); return { kind: q.kind, body: q.body, at: (d.getMonth() + 1) + '.' + d.getDate(), status: q.status === 'done' ? '対応済み' : '受付中', reply: q.reply || '', hasReply: !!q.reply }; });
      return { pop: !!s.iqPop, open: function () { self.setState({ iqPop: true }); }, close: function () { self.setState({ iqPop: false }); },
        kinds: K.map(function (k) { return { name: k, on: String(k === cur), bg: k === cur ? '#F3F1EC' : 'transparent', fg: k === cur ? '#070707' : '#D2CFC8', pick: function () { self.setState({ iqKind: k }); } }; }),
        send: function () { var el = document.getElementById('iqText'), v = el ? el.value.trim() : ''; if (!v) { if (el) el.focus(); return; } D.sendInq(cur, v).then(function (ok) { if (ok && el) el.value = ''; }); },
        mine: mine, hasMine: mine.length > 0 };
    })(),
    push: (function () {
      var st = D.pushState(), on = st === 'on';
      var note = { on: '', off: '', denied: 'ブラウザの設定で通知が止められています', ios: 'ホーム画面に追加すると受け取れます', no: 'この端末では受け取れません' }[st];
      return { on: String(on), note: note, bg: on ? '#F3F1EC' : '#383836', x: on ? '21px' : '3px', knob: on ? '#070707' : (st === 'off' ? '#D2CFC8' : '#7D7B76'), toggle: function () { D.pushToggle(); } };
    })(),
    calSub: (function () {
      if (s.tab === 'me') D.ensureCal();
      var https = D.calTok ? D.CAL + '?t=' + D.calTok : '', web = https.replace(/^https:/, 'webcal:');
      return { ios: web || '#', google: web ? 'https://calendar.google.com/calendar/r?cid=' + encodeURIComponent(web) : '#', note: s.calCopied ? 'コピーしました' : '',
        copy: function () { if (!https) return; (navigator.clipboard ? navigator.clipboard.writeText(https) : Promise.reject()).then(function () { self.setState({ calCopied: true }); setTimeout(function () { self.setState({ calCopied: false }); }, 1800); }, function () { prompt('URL', https); }); } };
    })(),
    calTitle: cy + '.' + String(cm).padStart(2, '0'), calPrev: mv(-1), calNext: mv(1), dayTitle: cm + '.' + sel + ' ' + WDJ[new Date(cy, cm - 1, sel).getDay()],
    me: { name: self0.name, grade: self0.grade || '学部・学年未設定', lv: 'Lv' + D.level(D.me), ms: D.milestones(), msTotal: (function () { var d = 0, n = 0; D.milestones().forEach(function (x) { var p = x.label.split(' ').pop().split('/'); d += +p[0]; n += +p[1]; }); return n ? d + '/' + n : '—'; })(), track: myRole ? myRole + ' 受講中' : 'ロール未設定', post: self0.post && self0.post !== '—' ? self0.post : 'プレイヤー', roles: roleChips,
      editName: function () { var n = prompt('名前', self0.name || ''); if (n == null) return; var g = prompt('学部・学年（例：経営 1年）', self0.grade || ''); if (g == null) return; D.saveProfile({ name: n.trim() || self0.name, grade: g.trim() }); } },
    myProjects: myProjects, noProjects: myProjects.length === 0, hasProjects: myProjects.length > 0,
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
      var e0 = document.getElementById('otText'), t = e0 ? e0.value.trim() : ''; if (!t) return;
      if (s.otf && t.indexOf(s.otf) < 0) t += ' ' + s.otf; // タグで絞り込んでいるときは、そのタグを付けて投稿
      D.add('other', { text: t }).then(function (r) { if (r) self.setState({ sub: null, tab: 'board', seg: 'other' }); });
    },
    painOpts: D.items('pain').map(function (x) { return { text: (x.data || {}).text || '' }; }),
    setLq: function (e) { self.setState({ lq: e.target.value }); }, setUq: function (e) { self.setState({ uq: e.target.value }); }
  };
}

// スマホ：ピンチで画面全体が拡大・縮小しないようにする
// スマホ：画面の左右端から始まるスワイプで iOS の「戻る／進む」が動いて画面が横にずれるのを止める
// （touchstart を止めるとタップも消えるので、動かさずに離したときはその場所をタップしたことにする）
(function () {
  var E = 18, st = null;
  document.addEventListener('touchstart', function (ev) {
    st = null; if (ev.touches.length !== 1) return; var t = ev.touches[0];
    if (t.clientX > E && t.clientX < window.innerWidth - E) return;
    ev.preventDefault(); st = { x: t.clientX, y: t.clientY, el: ev.target, t: Date.now() };
  }, { passive: false, capture: true });
  document.addEventListener('touchend', function (ev) {
    if (!st) return; var g = st, c = ev.changedTouches[0]; st = null;
    if (Math.abs(c.clientX - g.x) > 10 || Math.abs(c.clientY - g.y) > 10 || Date.now() - g.t > 500) return;
    var el = document.elementFromPoint(c.clientX, c.clientY) || g.el;
    if (/^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)) el.focus();
    el.click ? el.click() : el.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: c.clientX, clientY: c.clientY }));
  }, { capture: true });
})();
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

// 通知の種類（運営画面・データベースと同じ決め方）
window.__NKG = [
  ['member', '部員向け', [['remind', '参加するイベントの前日'], ['evchange', 'イベントの中止・変更'], ['evnew', '新しいイベント'], ['comment', '自分の投稿へのコメント'], ['offer_ok', '共有した外部告知が公式になった'], ['reply', 'お問い合わせへの返信']]],
  ['ops', '運営向け', [['assign', '担当・メンバーになった'], ['done', '業務の完了'], ['due', '期限が近い'], ['late', '期限切れ'], ['inquiry', '新しいお問い合わせ'], ['report', '投稿の通報'], ['offer_wait', '外部告知の確認待ち']]]
];
window.__nLabel = function (k) { var r = ''; window.__NKG.forEach(function (g) { g[2].forEach(function (x) { if (x[0] === k) r = x[1]; }); }); return r; };
window.__nKind = function (t) { t = String(t || ''); if (/」の(担当|メンバー|リーダー)になりました$/.test(t)) return 'assign'; if (/(を完了しました|がすべて完了しました)$/.test(t)) return 'done'; if (/^お問い合わせに返信/.test(t)) return 'reply'; if (/^「.*」(は中止になりました|の日時・場所が変わりました)$/.test(t)) return 'evchange'; if (/^明日：/.test(t)) return 'remind'; return 'system'; };
window.__nSrc = function (t, s, k) { if (k === 'remind' || k === 'evchange' || k === 'evnew') { var m = /「(.*)」/.exec(t) || /^明日：(.*)$/.exec(t); return m ? m[1] : ''; } return ['assign', 'done', 'due', 'late'].indexOf(k) >= 0 ? (s || '') : ''; };
window.__np = {
  get: function () { return window.DB ? window.DB.nPrefs() : { off: [], app: ['done'], mute: [], due: [3, 0] }; },
  set: function (q) { if (window.DB) window.DB.nSet(q); },
  mode: function (q, k) { return q.off.indexOf(k) >= 0 ? 'off' : q.app.indexOf(k) >= 0 ? 'app' : 'push'; },
  setMode: function (q, k, m) { q.off = q.off.filter(function (x) { return x !== k; }); q.app = q.app.filter(function (x) { return x !== k; }); if (m === 'off') q.off.push(k); if (m === 'app') q.app.push(k); },
  isOps: function () { return !!(window.DB && (window.DB.isOps() || window.DB.myTasks().length)); }, // 業務を担当している部員にも運営向けを出す
  push: function () { return window.DB ? window.DB.pushState() : 'no'; },
  pushToggle: function () { if (window.DB) window.DB.pushToggle(); },
  find: function (id) { var D = window.DB; return D ? D.notifs().filter(function (n) { return String(n.id) === String(id); })[0] : null; },
  kindOf: function (n) { return (n && n.kind) || window.__nKind(n && n.text); },
  del: function (id) { if (window.DB) window.DB.delNotif(id); },
  flash: function (m) { if (window.DB) window.DB.flash(m); }
};

// お知らせの全文（背景をぼかしたポップアップ）
function annPop(a) {
  var e = function (t) { return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var old = document.getElementById('annpop'); if (old) old.remove();
  var w = document.createElement('div'); w.id = 'annpop';
  w.innerHTML = '<div class="anbg" data-anx></div><div class="ancard" role="dialog" aria-modal="true" aria-labelledby="anh"><span class="anl">お知らせ</span><h2 id="anh">' + e(a.title) + '</h2>' + (a.body ? '<p>' + e(a.body).replace(/\n/g, '<br>') + '</p>' : '') + '<button class="anok" data-anx>閉じる</button></div>';
  document.body.appendChild(w); var ok = w.querySelector('.anok'); ok.focus();
  var close = function () { w.remove(); document.removeEventListener('keydown', key); };
  var key = function (ev) { if (ev.key === 'Escape') close(); };
  w.addEventListener('click', function (ev) { if (ev.target.closest('[data-anx]')) close(); });
  document.addEventListener('keydown', key);
}


// ホームの一番上：お知らせと「NEXT」を左右に切り替える（スワイプ・時間で自動）
(function () {
  var IV = 6000, EASE = 'transform .55s cubic-bezier(.22,.8,.2,1)', drag = null, eat = false, last = Date.now();
  var cars = function () { return [].slice.call(document.querySelectorAll('.tcar')); };
  var n = function (c) { return c.querySelectorAll('.tslide').length; };
  function show(c, i, anim) {
    var t = c.querySelector('.tcart'); if (!t) return; var N = n(c); i = N > 1 ? ((i % N) + N) % N : 0; c._i = i;
    t.style.transition = anim === false ? 'none' : EASE; t.style.transform = 'translateX(calc(' + (-i * 100) + '% - ' + (i * 12) + 'px))';
    [].forEach.call(c.querySelectorAll('.tslide'), function (s, k) { s.classList.toggle('on', k === i); s.setAttribute('aria-hidden', String(k !== i)); s.tabIndex = k === i ? 0 : -1; });
    [].forEach.call(c.querySelectorAll('.tdots i'), function (d, k) { d.classList.toggle('on', k === i); });
  }
  // 描き直しで位置が戻らないように
  setInterval(function () { cars().forEach(function (c) { var N = n(c); if (c._n !== N) { c._n = N; show(c, 0, false); } else if (c._i == null) show(c, 0, false); }); }, 300);
  setInterval(function () {
    if (document.hidden || drag || Date.now() - last < IV) return;
    cars().forEach(function (c) { if (n(c) > 1 && !c.matches(':hover')) { show(c, (c._i || 0) + 1); last = Date.now(); } });
  }, 500);
  document.addEventListener('pointerdown', function (e) {
    var c = e.target.closest && e.target.closest('.tcar'); if (!c || n(c) < 2) return;
    drag = { c: c, x: e.clientX, y: e.clientY, dx: 0, on: false, t: Date.now(), w: c.offsetWidth };
  }, true);
  document.addEventListener('pointermove', function (e) {
    if (!drag) return; var dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    if (!drag.on) { if (Math.abs(dy) > 10 && Math.abs(dy) > Math.abs(dx)) { drag = null; return; } if (Math.abs(dx) < 6) return; drag.on = true; }
    var i = drag.c._i || 0, N = n(drag.c); if ((i === 0 && dx > 0) || (i === N - 1 && dx < 0)) dx = dx / 3; // 端は重く
    drag.dx = dx; var t = drag.c.querySelector('.tcart'); t.style.transition = 'none';
    t.style.transform = 'translateX(calc(' + (-i * 100) + '% - ' + (i * 12) + 'px + ' + dx + 'px))';
  }, true);
  var end = function () {
    if (!drag) return; var d = drag; drag = null; last = Date.now(); if (!d.on) return;
    eat = true; setTimeout(function () { eat = false; }, 60);
    var v = Math.abs(d.dx) / Math.max(1, Date.now() - d.t), i = d.c._i || 0;
    if (Math.abs(d.dx) > d.w * 0.25 || v > 0.5) i += d.dx < 0 ? 1 : -1;
    show(d.c, Math.max(0, Math.min(n(d.c) - 1, i)));
  };
  document.addEventListener('pointerup', end, true); document.addEventListener('pointercancel', end, true);
  document.addEventListener('click', function (e) { if (eat && e.target.closest && e.target.closest('.tcar')) { e.preventDefault(); e.stopPropagation(); } }, true);
  document.addEventListener('click', function (e) { var d = e.target.closest && e.target.closest('.tdots i'); if (!d) return; var c = d.closest('.tcar'); show(c, [].indexOf.call(d.parentNode.children, d)); last = Date.now(); }, true);
})();

// 部内イベントの詳細（告知で入れた説明の全文・リンク・参加登録）
(function () {
  var e = function (t) { return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var link = function (t) { return e(t).replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener">$1</a>').replace(/\n/g, '<br>'); };
  var WD = ['日', '月', '火', '水', '木', '金', '土'];
  var day = function (iso) { var p = iso.split('-'), d = new Date(+p[0], +p[1] - 1, +p[2]); return (+p[1]) + '月' + (+p[2]) + '日（' + WD[d.getDay()] + '）'; };
  var BACK = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 6l-6 6 6 6"/></svg>';
  function page(id) {
    var D = window.DB; if (!D) return; var x = D.items('cal').filter(function (y) { return y.id === id; })[0]; if (!x) return;
    var d = x.data || {}, ok = /^\d{4}-\d{2}-\d{2}$/.test(d.date || ''), on = D.mine(id, 'join'), old = document.getElementById('evpage');
    var when = ok ? day(d.date) + (d.to && d.to !== d.date ? ' – ' + day(d.to) : '') : '日程未定';
    var h = '<div class="nsph"><button data-evp-back aria-label="戻る">' + BACK + '</button><b>部内イベント</b></div><div class="nspb evpb">' +
      '<h1>' + e(d.title) + '</h1>' +
      '<dl class="evpm"><dt>日にち</dt><dd>' + e(when) + '</dd>' + (d.time ? '<dt>時間</dt><dd>' + e(d.time) + '</dd>' : '') + (d.place ? '<dt>場所</dt><dd>' + e(d.place) + '</dd>' : '') + '</dl>' +
      (d.memo ? '<div class="evpd">' + link(d.memo) + '</div>' : '') +
      (/^https?:\/\//.test(d.link || '') ? '<a class="evpl" href="' + e(d.link) + '" target="_blank" rel="noopener">リンクを開く ↗</a>' : '') + '</div>' +
      (ok ? '<div class="evpf"><button class="evpj' + (on ? ' on' : '') + '" data-evp-join="' + e(id) + '">' + (on ? '✓ 参加登録済み' : '参加登録する') + '</button></div>' : '');
    var w = old || document.createElement('div'); w.id = 'evpage'; w.innerHTML = h;
    if (!old) { document.body.appendChild(w); document.documentElement.classList.add('invon'); try { history.pushState({ evp: 1 }, ''); } catch (er) {} }
  }
  function close(fromPop) { var w = document.getElementById('evpage'); if (!w) return; w.remove(); document.documentElement.classList.remove('invon'); if (!fromPop) try { if (history.state && history.state.evp) history.back(); } catch (er) {} }
  window.addEventListener('popstate', function () { close(true); });
  document.addEventListener('click', function (ev) {
    var t = ev.target; if (!t.closest) return; var b;
    if (t.closest('[data-evp-back]')) { close(); return; }
    if ((b = t.closest('[data-evp-join]'))) { var id = b.dataset.evpJoin; Promise.resolve(window.DB.toggle(id, 'join')).then(function () { setTimeout(function () { page(id); }, 50); }); return; }
    var c = t.closest('[data-evid]'); if (!c || t.closest('button, a')) return;
    page(c.dataset.evid);
  });
})();

// ---------- 掲示板（X のような一覧。タブで種類を分け、左右スワイプでも切り替え。写真つきで気軽に投稿） ----------
(function () {
  var TABS = [['idea', 'アイデア'], ['pain', 'ペイン'], ['event', 'イベント'], ['other', 'フリー']]; // アイデア＝意見募集とメンバー募集（募集は役割がついたアイデア）
  var ROLES = ['Strategist', 'Negotiator', 'Advertiser', 'Engineer', 'Innovator'];
  var e = function (t) { return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var link = function (t) { return e(t).replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener">$1</a>').replace(/\n/g, '<br>'); };
  var IC = {
    rep: '<svg viewBox="0 0 24 24"><path d="M20.5 11.6a8.4 8.4 0 0 1-12.3 7.4L3.5 20.3l1.3-4.4a8.4 8.4 0 1 1 15.7-4.3z"/></svg>',
    heart: '<svg viewBox="0 0 24 24"><path d="M12 20.3l-1.2-1.1C6.3 15.2 3.4 12.6 3.4 9.3A4.6 4.6 0 0 1 8 4.7c1.6 0 3.1.7 4 1.9a5 5 0 0 1 4-1.9 4.6 4.6 0 0 1 4.6 4.6c0 3.3-2.9 5.9-7.4 9.9z"/></svg>',
    me2: '<svg viewBox="0 0 24 24"><path d="M12 19V5M6 11l6-6 6 6"/></svg>',
    more: '<svg viewBox="0 0 24 24"><circle cx="5" cy="12" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="19" cy="12" r="1.4"/></svg>',
    plus: '<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>',
    photo: '<svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="10" r="1.6"/><path d="M21 16l-5-5-9 8"/></svg>',
    back: '<svg viewBox="0 0 24 24"><path d="M15 6l-6 6 6 6"/></svg>',
    x: '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>',
    cal: '<svg viewBox="0 0 24 24"><rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M9 3v4M15 3v4"/></svg>',
    out: '<svg viewBox="0 0 24 24"><path d="M14 4h6v6M20 4l-9 9M18 14v5H5V6h5"/></svg>',
    tag: '<svg viewBox="0 0 24 24"><path d="M4 5h7l9 9-6 6-9-9z"/><circle cx="8.5" cy="9.5" r="1.3"/></svg>',
    chev: '<svg viewBox="0 0 24 24"><path d="M7 10l5 5 5-5"/></svg>',
    check: '<svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
    ppl: '<svg viewBox="0 0 24 24"><circle cx="9" cy="8" r="3.2"/><path d="M3 19c.6-3.2 3-5 6-5s5.4 1.8 6 5"/><path d="M16 5.2a3 3 0 0 1 0 5.6M18 14.2c1.6.7 2.6 2.4 3 4.8"/></svg>'
  };
  var cur = function () { var c = window.__comp; var s = c ? c.state.seg : 'idea'; return TABS.some(function (t) { return t[0] === s; }) ? s : 'idea'; };
  // 写真：非公開の置き場から、見るための一時URLをまとめて取る
  var URLS = {}, asked = {};
  function want(paths) {
    var need = paths.filter(function (p) { return !URLS[p] && !asked[p]; }); if (!need.length || !window.sb || !window.sb.storage) return;
    need.forEach(function (p) { asked[p] = 1; });
    window.sb.storage.from('board').createSignedUrls(need, 86400).then(function (r) { (r.data || []).forEach(function (x) { if (x.signedUrl) URLS[x.path] = x.signedUrl; }); paint(true); }).catch(function () {});
  }
  function pics(d) {
    var ps = (d.imgs || []).slice(0, 4); if (!ps.length) return ''; want(ps);
    return '<div class="bxp n' + ps.length + '">' + ps.map(function (p) { return URLS[p] ? '<img src="' + e(URLS[p]) + '" alt="" loading="lazy" data-bxi="' + e(p) + '">' : '<span class="bxph"></span>'; }).join('') + '</div>';
  }
  function cm(id) { return window.DB.items('comment').filter(function (c) { return c.parent_id === id; }).length; }
  function act(kind, id, n, on, label) { return '<button class="bxa' + (on ? ' on' : '') + '" data-bxr="' + kind + '" data-id="' + e(id) + '" aria-pressed="' + !!on + '">' + (label === 'me2' ? IC.me2 : kind === 'rep' ? IC.rep : IC.heart) + (n ? '<span>' + n + '</span>' : '') + (label === 'me2' ? '<span class="bxl">自分も</span>' : '') + '</button>'; }
  function row(x, tab) {
    var D = window.DB, d = x.data || {}, mine = x.author === D.me, title = '', body = '', foot = '', acts = '';
    if (tab === 'recruit') {
      title = d.title || ''; body = d.purpose || '';
      var open = (d.roles || []).filter(function (r) { return !D.reactors(x.id, 'slot:' + r).length; });
      foot = (d.roles || []).length ? '<div class="bxcs">' + IC.ppl + '<span>' + (open.length ? '募集中 ' + open.map(e).join('・') : '満員') + '</span>' + (open.length && x.author !== D.me ? '<button class="bxgo" data-bxo="' + e(x.id) + '">応募する</button>' : '') + '</div>' : '';
      acts = act('rep', x.id, cm(x.id)) + act('vote', x.id, D.count(x.id, 'vote'), D.mine(x.id, 'vote'));
    } else if (tab === 'idea') { title = d.title || ''; body = d.summary || ''; acts = act('rep', x.id, cm(x.id)) + act('vote', x.id, D.count(x.id, 'vote'), D.mine(x.id, 'vote')); }
    else if (tab === 'pain') { body = d.text || ''; acts = act('rep', x.id, cm(x.id)) + act('emp', x.id, D.count(x.id, 'emp'), D.mine(x.id, 'emp'), 'me2'); }
    else { body = d.text || ''; if (d.book) foot = '<div class="bxbk">📖 ' + e(d.book) + (d.bookAuthor ? ' · ' + e(d.bookAuthor) : '') + '</div>'; acts = act('rep', x.id, cm(x.id)) + act('like', x.id, D.count(x.id, 'like'), D.mine(x.id, 'like')); }
    return '<article class="bx" data-bxid="' + e(x.id) + '" data-k="' + tab + '"><span class="bxav">' + e(D.ini(x.author)) + '</span><div class="bxm">' +
      '<div class="bxh"><b>' + e(D.name(x.author)) + '</b><span>' + e(((D.who(x.author) || '').split(' · ')[1] || '')) + (D.who(x.author).indexOf(' · ') > 0 ? ' · ' : '') + e(D.ago(x.created_at)) + '</span><button class="bxmore" data-bxm="' + e(x.id) + '" data-mine="' + mine + '" aria-label="その他">' + IC.more + '</button></div>' +
      (title ? '<div class="bxt">' + e(title) + '</div>' : '') + (body ? '<div class="bxb">' + link(body) + '</div>' : '') + pics(d) + foot +
      '<div class="bxas">' + acts + '</div></div></article>';
  }
  function evRow(x) {
    var D = window.DB, d = x.data || {}, on = D.mine(x.id, 'plan'), off = x.kind === 'notice';
    var p = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d.due || ''), due = p ? (+p[2]) + '.' + (+p[3]) + ' 締切' : '';
    return '<article class="bx" data-bxev="' + e(x.id) + '"><span class="bxav' + (off ? ' off' : '') + '">' + (off ? 'F' : e(D.ini(x.author))) + '</span><div class="bxm">' +
      '<div class="bxh"><b>' + (off ? '起業部 公式' : e(D.name(x.author))) + '</b><span>' + e(d.type || '') + (due ? ' · ' + e(due) : '') + '</span></div>' +
      '<div class="bxt">' + e(d.title || '') + '</div>' + (d.host && d.host !== '—' ? '<div class="bxs">' + e(d.host) + '</div>' : '') + (d.memo ? '<div class="bxb">' + link(d.memo) + '</div>' : '') +
      '<div class="bxas"><button class="bxa' + (on ? ' on' : '') + '" data-bxr="plan" data-id="' + e(x.id) + '" aria-pressed="' + on + '">' + IC.cal + '<span class="bxl">' + (on ? '予定に追加済み' : '予定に追加') + '</span></button>' +
      (/^https?:\/\//.test(d.url || '') ? '<a class="bxa" href="' + e(d.url) + '" target="_blank" rel="noopener">' + IC.out + '<span class="bxl">詳細</span></a>' : '') + '</div></div></article>';
  }
  function list(tab) {
    var D = window.DB; if (!D) return [];
    if (tab === 'event') return D.items('notice').concat(D.items('offer').filter(function (x) { return (x.data || {}).state === 'wait'; }));
    return (tab === 'idea' ? D.items('idea').concat(D.items('recruit')) : D.items(tab)).slice().sort(function (a, b) { return a.created_at < b.created_at ? 1 : -1; });
  }
  var lastKey = '';
  function paint(force) { // 変わった投稿だけ描き直す（連打しても画面がちらつかない）
    var root = document.getElementById('bdx'); if (!root || !window.DB) return;
    var tab = cur(), L = list(tab);
    if (!root.querySelector('.bxtabs') || root.dataset.tab !== tab) {
      root.dataset.tab = tab;
      root.innerHTML = '<div class="bxtabs" role="tablist">' + TABS.map(function (t) { return '<button role="tab" aria-selected="' + (t[0] === tab) + '" data-bxt="' + t[0] + '">' + t[1] + '</button>'; }).join('') + '</div><div class="bxlist"></div><button class="bxfab" data-bxnew="1" aria-label="投稿する">' + IC.plus + '</button>';
    }
    var box = root.querySelector('.bxlist'), want = L.map(function (x) { return { id: x.id, h: tab === 'event' ? evRow(x) : row(x, x.kind) }; });
    if (!want.length) { if (!box.querySelector('.bxempty')) box.innerHTML = '<div class="bxempty">まだ投稿はありません</div>'; return; }
    var em = box.querySelector('.bxempty'); if (em) em.remove();
    var have = {}; [].forEach.call(box.children, function (el) { have[el.dataset.pid] = el; });
    var prev = null;
    want.forEach(function (w) {
      var el = have[w.id]; delete have[w.id];
      if (!el || el._h !== w.h) { var t = document.createElement('div'); t.innerHTML = w.h; var n = t.firstChild; n.dataset.pid = w.id; n._h = w.h; if (el) el.replaceWith(n); el = n; }
      var at = prev ? prev.nextSibling : box.firstChild; if (at !== el) box.insertBefore(el, at); prev = el;
    });
    Object.keys(have).forEach(function (k) { have[k].remove(); });
  }
  window.__bxPaint = paint;
  setInterval(function () { if (document.getElementById('bdx')) paint(); }, 400);

  function setTab(t, dir) { var c = window.__comp; if (!c || t === cur()) return; c.setState({ seg: t }); setTimeout(function () { paint(true); var l = document.querySelector('.bxlist'); if (l && dir) { l.classList.add(dir < 0 ? 'inl' : 'inr'); } window.scrollTo(0, 0); }, 0); }

  // ---- スレッド（投稿＋返信） ----
  function thread(id) {
    var D = window.DB, x = D.items('recruit').concat(D.items('idea'), D.items('pain'), D.items('other')).filter(function (y) { return y.id === id; })[0]; if (!x) return;
    var reps = D.items('comment').filter(function (c) { return c.parent_id === id; }).slice().sort(function (a, b) { return a.created_at < b.created_at ? -1 : 1; });
    var old = document.getElementById('bxth'), w = old || document.createElement('div'); w.id = 'bxth'; w.dataset.id = id;
    var dt = new Date(x.created_at), pad = function (n) { return (n < 10 ? '0' : '') + n; }, stamp = pad(dt.getHours()) + ':' + pad(dt.getMinutes()) + ' · ' + dt.getFullYear() + '年' + (dt.getMonth() + 1) + '月' + dt.getDate() + '日';
    var slots = x.kind === 'recruit' ? '<div class="bxsl">' + ((x.data || {}).roles || []).map(function (r) { var w = D.reactors(x.id, 'slot:' + r), me = w.indexOf(D.me) >= 0, full = w.length && !me;
      return '<div class="bxsr"><span><b>' + e(r) + '</b><small>' + (me ? '参加中（あなた）' : full ? '参加済み · ' + e(D.name(w[0])) : '募集中') + '</small></span>' + (full || x.author === D.me ? '' : '<button class="bxgo' + (me ? ' on' : '') + '" data-bxslot="' + e(r) + '" data-id="' + e(x.id) + '">' + (me ? '取り消す' : '応募する') + '</button>') + '</div>'; }).join('') + '</div>' : '';
    var focus = row(x, x.kind).replace('class="bx"', 'class="bx fx"').replace(/<div class="bxcs">[\s\S]*?<\/div>/, slots).replace('<div class="bxas">', '<div class="bxst"><span>' + e(stamp) + '</span><div class="bxas">').replace(/<\/div><\/div><\/article>$/, '</div></div></div></article>');
    var sc0 = old && old.querySelector('.bxths') ? old.querySelector('.bxths').scrollTop : 0;
    w.innerHTML = '<div class="bxths"><div class="nsph"><button data-bxth-x aria-label="戻る">' + IC.back + '</button><b>投稿</b></div><div class="nspb bxthb">' + focus +
      (reps.length ? reps.map(function (c) { return '<div class="bx rep"><span class="bxav">' + e(D.ini(c.author)) + '</span><div class="bxm"><div class="bxh"><b>' + e(D.name(c.author)) + '</b><span>' + e(D.ago(c.created_at)) + '</span></div><div class="bxb">' + link((c.data || {}).text || '') + '</div>' + pics(c.data || {}) + '</div></div>'; }).join('') : '') +
      '</div></div><div class="bxrp"><span class="bxav sm">' + e(D.ini(D.me)) + '</span><textarea id="bxrep" rows="1" placeholder="返信する"></textarea><button data-bxsend="' + e(id) + '" disabled>返信</button></div>';
    if (!old) { document.body.appendChild(w); document.documentElement.classList.add('invon'); try { history.pushState({ bxth: 1 }, ''); } catch (er) {} }
    var scr = w.querySelector('.bxths'); scr.scrollTop = sc0; var lastY = sc0;
    scr.addEventListener('scroll', function () { var h = w.querySelector('.nsph'); if (h) h.classList.toggle('hide', scr.scrollTop > 40); }, { passive: true }); // 下へ読むと見出しが隠れ、いちばん上に戻ったときだけ出る
    fit();
  }
  function closeTh(pop) { var w = document.getElementById('bxth'); if (!w) return; w.remove(); document.documentElement.classList.remove('invon'); if (!pop) try { if (history.state && history.state.bxth) history.back(); } catch (er) {} }
  window.addEventListener('popstate', function () { if (document.getElementById('bxiv')) { ivClose(true); return; } closeTh(true); closeNew(true); });

  // ---- 投稿・返信（本文と写真。下の帯：写真・種類・メンバー募集。キーボードの上に出る） ----
  var NEW = null, KIND = [['idea', 'アイデア'], ['pain', 'ペイン'], ['other', 'フリー']];
  var PH = { idea: 'アイデアを書く（1行目がタイトル）', pain: '困っていること', other: 'いまどうしてる？', reply: '返信を書く' };
  function openNew(parent) {
    var tab = cur(); if (!parent && tab === 'event') { window.__comp.setState({ sub: 'eventNew' }); return; }
    NEW = { tab: parent ? 'reply' : tab, parent: parent || null, files: [], roles: [], rec: false }; drawNew(); try { history.pushState({ bxnew: 1 }, ''); } catch (er) {}
    setTimeout(function () { var t = document.getElementById('bxtx'); if (t) t.focus(); }, 60);
  }
  function original(id) {
    var D = window.DB, x = D.items('recruit').concat(D.items('idea'), D.items('pain'), D.items('other')).filter(function (y) { return y.id === id; })[0]; if (!x) return '';
    var d = x.data || {}, txt = [d.title, d.purpose || d.summary || d.text].filter(Boolean).join('\n');
    return '<div class="bxog"><span class="bxav">' + e(D.ini(x.author)) + '</span><div class="bxm"><div class="bxh"><b>' + e(D.name(x.author)) + '</b><span>' + e(D.ago(x.created_at)) + '</span></div><div class="bxb">' + link(txt) + '</div><div class="bxto">返信先：' + e(D.name(x.author)) + 'さん</div></div></div>';
  }
  function drawNew() {
    var D = window.DB, w = document.getElementById('bxnew'), first = !w; if (first) { w = document.createElement('div'); w.id = 'bxnew'; document.body.appendChild(w); document.documentElement.classList.add('invon'); }
    var t = document.getElementById('bxtx'), val = t ? t.value : '', reply = NEW.tab === 'reply', kn = (KIND.filter(function (z) { return z[0] === NEW.tab; })[0] || [])[1];
    w.innerHTML = '<div class="bxnh"><button class="bxcan" data-bxnew-x>キャンセル</button><button class="bxpost" data-bxpost="1">' + (reply ? '返信する' : '投稿する') + '</button></div>' +
      '<div class="bxnb">' + (reply ? original(NEW.parent) : '') + '<div class="bxnr"><span class="bxav">' + e(D.ini(D.me)) + '</span><div class="bxnc"><textarea id="bxtx" placeholder="' + PH[NEW.tab] + '">' + e(val) + '</textarea>' +
      (NEW.files.length ? '<div class="bxp n' + NEW.files.length + ' edit">' + NEW.files.map(function (f, i) { return '<span class="bxpe"><img src="' + f.url + '" alt=""><button data-bxrm="' + i + '" aria-label="写真を外す">' + IC.x + '</button></span>'; }).join('') + '</div>' : '') +
      '</div></div></div>' +
      '<div class="bxnt"><label class="bxpk ico' + (NEW.files.length >= 4 ? ' off' : '') + '" title="写真（4枚まで）" aria-label="写真を追加">' + IC.photo + (NEW.files.length ? '<span>' + NEW.files.length + '/4</span>' : '') + '<input type="file" accept="image/*" multiple id="bxfile"' + (NEW.files.length >= 4 ? ' disabled' : '') + '></label>' +
      (reply ? '' : '<button class="bxpk" data-bxkind="1">' + IC.tag + '<span>' + e(kn) + '</span>' + IC.chev + '</button>') +
      (NEW.tab === 'idea' ? '<button class="bxpk' + (NEW.roles.length ? ' on' : '') + '" data-bxrec="1">' + IC.ppl + '<span>' + (NEW.roles.length ? '募集 ' + NEW.roles.length : 'メンバー募集') + '</span></button>' : '') + '</div>';
    fit(); var tx = document.getElementById('bxtx'); if (tx && !first) { tx.focus(); tx.setSelectionRange(tx.value.length, tx.value.length); }
  }
  function closeNew(pop) { var w = document.getElementById('bxnew'); if (!w) return; w.remove(); NEW = null; document.documentElement.classList.remove('invon'); if (!pop) try { if (history.state && history.state.bxnew) history.back(); } catch (er) {} }
  // 下からのメニュー（種類・募集するロール）
  function sheet(title, items, multi, done) {
    var old = document.getElementById('bxsh'); if (old) old.remove();
    var w = document.createElement('div'); w.id = 'bxsh'; var sel = items.filter(function (x) { return x.on; }).map(function (x) { return x.k; });
    var drawn = false, draw = function () { w.innerHTML = '<div class="anbg" data-bxsh-x></div><div class="bxshc' + (drawn ? '' : ' in') + '"><div class="bxshh"><b>' + e(title) + '</b>' + (multi ? '<button data-bxsh-ok>決定</button>' : '') + '</div>' + items.map(function (x) { var on = sel.indexOf(x.k) >= 0; return '<button class="bxshi' + (on ? ' on' : '') + '" data-bxsh-k="' + e(x.k) + '"><span>' + e(x.n) + (x.s ? '<small>' + e(x.s) + '</small>' : '') + '</span><i>' + (on ? IC.check : '') + '</i></button>'; }).join('') + '</div>'; drawn = true; };
    draw(); document.body.appendChild(w);
    w.addEventListener('click', function (ev) {
      var b = ev.target.closest('[data-bxsh-k],[data-bxsh-ok],[data-bxsh-x]'); if (!b) return;
      if (b.dataset.bxshK) { var k = b.dataset.bxshK; if (!multi) { w.remove(); done([k]); return; } var i = sel.indexOf(k); if (i >= 0) sel.splice(i, 1); else sel.push(k); draw(); return; }
      if (b.hasAttribute('data-bxsh-ok')) done(sel.slice());
      w.remove();
    });
  }
  // キーボードが出ても、下の帯と返信欄はその上に
  var IOS26_GAP = 0; // iOS 26 のキーボードは「∧ ∨ ✓」の上にも暗い下地を持つため、そこへは入り込めない（見えている範囲の下端に合わせる）
  var FULLH = window.visualViewport ? window.visualViewport.height : window.innerHeight;
  function fit() { // 見えている範囲（キーボードの上まで）にぴったり合わせる
    var vv = window.visualViewport; if (vv && !/^(TEXTAREA|INPUT)$/.test((document.activeElement || {}).tagName || '')) FULLH = Math.max(FULLH, vv.height);
    var kb = !!vv && (Math.max(FULLH, window.innerHeight) - vv.height > 120); // 画面の高さが変わる場合もあるので、キーボードを出す前の高さと比べる
    ['bxnew', 'bxth'].forEach(function (id) {
      var w = document.getElementById(id); if (!w) return; w.classList.toggle('kb', kb);
      if (!vv) return; w.style.top = vv.offsetTop + 'px'; w.style.height = vv.height + 'px'; w.style.bottom = 'auto'; w.style.paddingBottom = '';
      var bar = w.querySelector('.bxnt, .bxrp'); if (bar) bar.style.transform = kb && IOS26_GAP ? 'translateY(' + IOS26_GAP + 'px)' : '';
    });
  }
  // 開いている間は後ろの画面を固定（スクロールできないように）
  var LOCK = null;
  function lock(on) {
    var b = document.body;
    if (on && !LOCK) { LOCK = { y: window.scrollY }; b.style.position = 'fixed'; b.style.top = -LOCK.y + 'px'; b.style.left = '0'; b.style.right = '0'; }
    if (!on && LOCK && !document.getElementById('bxnew') && !document.getElementById('bxth') && !document.getElementById('bxiv')) { b.style.position = ''; b.style.top = ''; b.style.left = ''; b.style.right = ''; window.scrollTo(0, LOCK.y); LOCK = null; }
  }
  new MutationObserver(function () { lock(!!(document.getElementById('bxnew') || document.getElementById('bxth') || document.getElementById('bxiv'))); }).observe(document.body, { childList: true });
  document.addEventListener('touchmove', function (ev) { // 中身のスクロールだけ許す
    var w = ev.target.closest && ev.target.closest('#bxnew, #bxth'); if (!w) return;
    var sc = ev.target.closest('.bxths, .bxnb, textarea'); if (sc && sc.scrollHeight > sc.clientHeight + 1) return;
    ev.preventDefault();
  }, { passive: false });
  if (window.visualViewport) { window.visualViewport.addEventListener('resize', fit); window.visualViewport.addEventListener('scroll', fit); }
  function shrink(file) { // 端末で縮めてから送る（長い辺 1600px・JPEG）
    return new Promise(function (ok, ng) {
      var img = new Image(), u = URL.createObjectURL(file);
      img.onload = function () { var k = Math.min(1, 1600 / Math.max(img.width, img.height)), c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k); c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(u); c.toBlob(function (b) { b ? ok(b) : ng(); }, 'image/jpeg', 0.82); };
      img.onerror = function () { URL.revokeObjectURL(u); ng(); }; img.src = u;
    });
  }
  async function post() {
    var D = window.DB, tx = (document.getElementById('bxtx') || {}).value || '', v = tx.trim(); if (!v && !NEW.files.length) { D.flash(NEW.tab === 'reply' ? '返信を書いてください' : '本文を書いてください'); return; }
    var btn = document.querySelector('[data-bxpost]'), label = btn ? btn.textContent : ''; if (btn) { btn.disabled = true; btn.textContent = '送信中…'; }
    var undo = function () { if (btn) { btn.disabled = false; btn.textContent = label; } }, imgs = [];
    try {
      for (var i = 0; i < NEW.files.length; i++) {
        var b = await shrink(NEW.files[i].file), path = D.me + '/' + Date.now() + '_' + i + '.jpg';
        var r = await window.sb.storage.from('board').upload(path, b, { contentType: 'image/jpeg' }); if (r.error) throw r.error; imgs.push(path); URLS[path] = NEW.files[i].url;
      }
    } catch (er) { D.flash('写真を送れませんでした'); undo(); return; }
    var lines = v.split('\n'), head = lines[0].slice(0, 80), rest = lines.slice(1).join('\n').trim(), data, kind = NEW.tab;
    if (kind === 'reply') { kind = 'comment'; data = { text: v }; }
    else if (kind === 'idea' && NEW.roles.length) { kind = 'recruit'; data = { title: head, purpose: rest, roles: NEW.roles.slice(), frame: '実プロジェクト枠' }; } // 役割を選んだらメンバー募集
    else if (kind === 'idea') data = { title: head, summary: rest };
    else data = { text: v };
    if (imgs.length) data.imgs = imgs;
    var parent = NEW.parent, res = await D.add(kind, data, parent || undefined); if (!res) { undo(); return; }
    closeNew(); paint(); if (parent && document.getElementById('bxth')) thread(parent);
  }

  // ---- 写真ビューア（X と同じ：黒い全画面・左右で送る・下へ払って閉じる・ピンチ／ダブルタップで拡大）----
  var IV = null;
  function ivOpen(paths, i) {
    ivClose(true); var w = document.createElement('div'); w.id = 'bxiv';
    w.innerHTML = '<div class="bxivbg"></div><div class="bxivt">' + paths.map(function (p) { return '<div class="bxivs"><img src="' + e(URLS[p] || '') + '" alt="" draggable="false"></div>'; }).join('') + '</div>' +
      '<button class="bxivx" data-bxiv-x aria-label="閉じる">' + IC.x + '</button>' +
      (paths.length > 1 ? '<span class="bxivc"></span><button class="bxivp" data-bxiv-go="-1" aria-label="前の写真">' + IC.back + '</button><button class="bxivn" data-bxiv-go="1" aria-label="次の写真">' + IC.back + '</button>' : '');
    document.body.appendChild(w); IV = { w: w, n: paths.length, i: i, s: 1, tx: 0, ty: 0 };
    try { history.pushState({ bxiv: 1 }, ''); } catch (er) {}
    ivGo(i, false); requestAnimationFrame(function () { w.classList.add('in'); });
  }
  function ivClose(pop) {
    var w = document.getElementById('bxiv'); if (!w) return; IV = null; w.classList.remove('in'); w.classList.add('out'); setTimeout(function () { w.remove(); }, 180);
    if (!pop) try { if (history.state && history.state.bxiv) history.back(); } catch (er) {}
  }
  function ivImg() { return IV && IV.w.querySelectorAll('.bxivs img')[IV.i]; }
  function ivZoom(s, tx, ty, anim) {
    var im = ivImg(); if (!im) return; IV.s = s; IV.tx = tx; IV.ty = ty;
    im.style.transition = anim ? 'transform .22s ease' : 'none'; im.style.transform = s === 1 && !tx && !ty ? '' : 'translate(' + tx + 'px,' + ty + 'px) scale(' + s + ')';
    IV.w.classList.toggle('zoom', s > 1);
  }
  function ivClamp(anim) { // 拡大中は写真の端が画面の内側に入らないように戻す
    var im = ivImg(); if (!im) return; var s = Math.min(4, Math.max(1, IV.s)); if (s < 1.05) return ivZoom(1, 0, 0, anim);
    var W = im.clientWidth * s, H = im.clientHeight * s, mx = Math.max(0, (W - window.innerWidth) / 2), my = Math.max(0, (H - window.innerHeight) / 2);
    ivZoom(s, Math.max(-mx, Math.min(mx, IV.tx)), Math.max(-my, Math.min(my, IV.ty)), anim);
  }
  function ivGo(i, anim) {
    if (!IV) return; i = Math.max(0, Math.min(IV.n - 1, i)); if (i !== IV.i) ivZoom(1, 0, 0, false); IV.i = i;
    var t = IV.w.querySelector('.bxivt'); t.style.transition = anim === false ? 'none' : 'transform .26s cubic-bezier(.2,.8,.2,1)'; t.style.transform = 'translateX(' + (-i * 100) + '%)';
    var c = IV.w.querySelector('.bxivc'); if (c) c.textContent = (i + 1) + ' / ' + IV.n;
    IV.w.classList.toggle('first', i === 0); IV.w.classList.toggle('last', i === IV.n - 1);
  }
  var G = null, lastTap = 0, tapT = null;
  function dist(t) { return Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY); }
  function mid(t) { return { x: (t[0].clientX + t[1].clientX) / 2 - window.innerWidth / 2, y: (t[0].clientY + t[1].clientY) / 2 - window.innerHeight / 2 }; }
  document.addEventListener('touchstart', function (ev) {
    if (!IV || !ev.target.closest('#bxiv') || ev.target.closest('button')) return; var T = ev.touches;
    if (T.length === 2) { G = { pinch: true, d0: dist(T), m0: mid(T), s0: IV.s, tx0: IV.tx, ty0: IV.ty }; return; }
    if (T.length === 1) G = { x: T[0].clientX, y: T[0].clientY, t: Date.now(), ax: '', tx0: IV.tx, ty0: IV.ty };
  }, { passive: true });
  document.addEventListener('touchmove', function (ev) {
    if (!IV || !G || !ev.target.closest('#bxiv')) return; ev.preventDefault(); var T = ev.touches;
    if (G.pinch) { if (T.length < 2) return; var k = dist(T) / G.d0, s = Math.max(.8, Math.min(5, G.s0 * k)), m = mid(T), r = s / G.s0; ivZoom(s, m.x - (G.m0.x - G.tx0) * r, m.y - (G.m0.y - G.ty0) * r, false); return; }
    var dx = T[0].clientX - G.x, dy = T[0].clientY - G.y;
    if (!G.ax) { if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return; G.ax = IV.s > 1 ? 'pan' : Math.abs(dx) > Math.abs(dy) ? 'x' : 'y'; }
    if (G.ax === 'pan') { ivZoom(IV.s, G.tx0 + dx, G.ty0 + dy, false); return; }
    if (G.ax === 'x') { var edge = (IV.i === 0 && dx > 0) || (IV.i === IV.n - 1 && dx < 0), t = IV.w.querySelector('.bxivt'); t.style.transition = 'none'; t.style.transform = 'translateX(calc(' + (-IV.i * 100) + '% + ' + (edge ? dx / 3 : dx) + 'px))'; return; }
    var im = ivImg(); im.style.transition = 'none'; im.style.transform = 'translate(' + dx * .4 + 'px,' + dy + 'px) scale(' + (1 - Math.min(.15, Math.abs(dy) / 2000)) + ')';
    IV.w.style.setProperty('--ivo', String(Math.max(0, 1 - Math.abs(dy) / 360)));
  }, { passive: false });
  document.addEventListener('touchend', function (ev) {
    if (!IV || !G) return; var g = G; if (ev.touches.length) { if (g.pinch && ev.touches.length === 1) G = { x: ev.touches[0].clientX, y: ev.touches[0].clientY, t: Date.now(), ax: IV.s > 1 ? 'pan' : 'none', tx0: IV.tx, ty0: IV.ty }; return; } G = null;
    if (g.pinch) { ivClamp(true); return; }
    var c = ev.changedTouches[0], dx = c.clientX - g.x, dy = c.clientY - g.y, dt = Date.now() - g.t;
    if (g.ax === 'pan') { ivClamp(true); return; }
    if (g.ax === 'x') { var v = Math.abs(dx) / dt; ivGo(IV.i + ((Math.abs(dx) > window.innerWidth * .2 || v > .5) ? (dx < 0 ? 1 : -1) : 0)); return; }
    if (g.ax === 'y') { if (Math.abs(dy) > 110 || Math.abs(dy) / dt > .6) { var im = ivImg(); im.style.transition = 'transform .2s ease'; im.style.transform = 'translateY(' + (dy > 0 ? 1 : -1) * window.innerHeight + 'px)'; ivClose(); } else { IV.w.style.removeProperty('--ivo'); ivZoom(1, 0, 0, true); } return; }
    if (g.ax || dt > 300) return;
    // タップ：2回目なら拡大／元に戻す、1回だけなら上の✕と枚数を出し入れ
    ev.preventDefault();
    if (Date.now() - lastTap < 280) { clearTimeout(tapT); lastTap = 0; if (IV.s > 1) ivZoom(1, 0, 0, true); else { var px = c.clientX - window.innerWidth / 2, py = c.clientY - window.innerHeight / 2; IV.s = 2.5; IV.tx = -px * 1.5; IV.ty = -py * 1.5; ivClamp(true); } return; }
    lastTap = Date.now(); tapT = setTimeout(function () { if (IV) IV.w.classList.toggle('bare'); }, 280);
  }, { passive: false });
  document.addEventListener('keydown', function (ev) { if (!IV) return; if (ev.key === 'Escape') ivClose(); else if (ev.key === 'ArrowLeft') ivGo(IV.i - 1); else if (ev.key === 'ArrowRight') ivGo(IV.i + 1); });
  document.addEventListener('dblclick', function (ev) { if (!IV || !ev.target.closest('#bxiv img') || 'ontouchstart' in window) return; if (IV.s > 1) ivZoom(1, 0, 0, true); else { IV.s = 2.5; IV.tx = -(ev.clientX - window.innerWidth / 2) * 1.5; IV.ty = -(ev.clientY - window.innerHeight / 2) * 1.5; ivClamp(true); } });

  // ---- 操作 ----
  document.addEventListener('click', function (ev) {
    var t = ev.target; if (!t.closest) return; var b, D = window.DB;
    if ((b = t.closest('[data-bxt]'))) { var i0 = TABS.map(function (z) { return z[0]; }), a0 = i0.indexOf(cur()), a1 = i0.indexOf(b.dataset.bxt); setTab(b.dataset.bxt, a1 - a0); return; }
    if ((b = t.closest('[data-bxnew]'))) { openNew(); return; }
    if (t.closest('[data-bxnew-x]')) { closeNew(); return; }
    if ((b = t.closest('[data-bxi]'))) { var ims = [].slice.call(b.parentNode.querySelectorAll('[data-bxi]')).map(function (z) { return z.dataset.bxi; }); ivOpen(ims, ims.indexOf(b.dataset.bxi)); return; }
    if (t.closest('[data-bxiv-x]')) { ivClose(); return; }
    if ((b = t.closest('[data-bxiv-go]'))) { ivGo(IV.i + +b.dataset.bxivGo); return; }
    if (IV && !('ontouchstart' in window) && t.closest('#bxiv') && !t.closest('img')) { ivClose(); return; }
    if (t.closest('[data-bxpost]')) { post(); return; }
    if (t.closest('[data-bxrec]')) { sheet('募集するロール', ROLES.map(function (r) { return { k: r, n: r, on: NEW.roles.indexOf(r) >= 0 }; }), true, function (sel) { NEW.roles = ROLES.filter(function (r) { return sel.indexOf(r) >= 0; }); drawNew(); }); return; }
    if (t.closest('[data-bxkind]')) { sheet('投稿する場所', KIND.map(function (z) { return { k: z[0], n: z[1], on: z[0] === NEW.tab }; }), false, function (sel) { NEW.tab = sel[0]; if (NEW.tab !== 'idea') NEW.roles = []; drawNew(); }); return; }
    if ((b = t.closest('[data-bxrm]'))) { NEW.files.splice(+b.dataset.bxrm, 1); drawNew(); return; }
    if (t.closest('[data-bxth-x]')) { closeTh(); return; }
    if ((b = t.closest('[data-bxsend]'))) { var ta = document.getElementById('bxrep'), v = ta ? ta.value.trim() : '', id = b.dataset.bxsend; if (!v) return; b.disabled = true; D.add('comment', { text: v }, id).then(function () { thread(id); }); return; }
    if ((b = t.closest('[data-bxr]'))) { var kd = b.dataset.bxr, iid = b.dataset.id; if (kd === 'rep') { openNew(iid); return; } var on = b.getAttribute('aria-pressed') !== 'true', sp = b.querySelector('span:not(.bxl)'), n0 = sp ? +sp.textContent : 0; b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on)); Promise.resolve(D.toggle(iid, kd)).then(function () { paint(); if (document.getElementById('bxth')) thread(document.getElementById('bxth').dataset.id); }); return; }
    if ((b = t.closest('[data-bxo]'))) { thread(b.dataset.bxo); return; }
    if ((b = t.closest('[data-bxslot]'))) { var xid = b.dataset.id, role = b.dataset.bxslot, X0 = D.items('recruit').filter(function (y) { return y.id === xid; })[0]; if (X0 && X0.author === D.me) { D.flash('自分の募集には応募できません'); return; } Promise.resolve(D.toggle(xid, 'slot:' + role, true)).then(function () { setTimeout(function () { thread(xid); paint(true); }, 40); }); return; }
    if ((b = t.closest('[data-bxm]'))) { menu(b.dataset.bxm, b.dataset.mine === 'true'); return; }
    if (t.closest('a, button, textarea, input, label')) return;
    var art = t.closest('#bdx [data-bxid]'); if (art) thread(art.dataset.bxid);
  });
  document.addEventListener('change', function (ev) {
    if (ev.target.id !== 'bxfile' || !NEW) return; var fs = [].slice.call(ev.target.files || []).slice(0, 4 - NEW.files.length);
    fs.forEach(function (f) { if (/^image\//.test(f.type)) NEW.files.push({ file: f, url: URL.createObjectURL(f) }); }); drawNew();
  });
  document.addEventListener('input', function (ev) { if (ev.target.id === 'bxrep') { var sb0 = document.querySelector('[data-bxsend]'); if (sb0) sb0.disabled = !ev.target.value.trim(); } if (ev.target.id === 'bxrep' || ev.target.id === 'bxtx') { ev.target.style.height = 'auto'; ev.target.style.height = Math.min(ev.target.scrollHeight, 320) + 'px'; } });
  function menu(id, mine) {
    var D = window.DB, w = document.createElement('div'); w.id = 'bxmn';
    w.innerHTML = '<div class="anbg" data-bxmn-x></div><div class="bxmnc">' + (mine ? '<button data-bxdel="' + e(id) + '" class="bad">削除する</button>' : '<button data-bxrep2="' + e(id) + '">通報する</button>') + '<button data-bxmn-x>やめる</button></div>';
    document.body.appendChild(w);
    w.addEventListener('click', function (ev) {
      var b = ev.target.closest('button, .anbg'); if (!b) return;
      if (b.dataset.bxdel) { if (b.dataset.sure) { D.remove(b.dataset.bxdel); w.remove(); closeTh(); return; } b.dataset.sure = '1'; b.textContent = 'もう一度押すと削除'; return; }
      if (b.dataset.bxrep2) D.report(b.dataset.bxrep2, 'その他');
      w.remove();
    });
  }
  // 投稿の画面：左端から右へスワイプで戻る（指についてくる）
  var eg = null;
  document.addEventListener('touchstart', function (ev) { var w = document.getElementById('bxth'); if (!w || ev.touches.length !== 1 || ev.touches[0].clientX > 28 || document.getElementById('bxnew') || document.getElementById('bxiv')) return; eg = { x: ev.touches[0].clientX, y: ev.touches[0].clientY, on: false, w: w }; }, { passive: true });
  document.addEventListener('touchmove', function (ev) {
    if (!eg) return; var dx = ev.touches[0].clientX - eg.x, dy = ev.touches[0].clientY - eg.y;
    if (!eg.on) { if (Math.abs(dy) > Math.abs(dx)) { eg = null; return; } if (dx < 8) return; eg.on = true; eg.w.classList.add('drag'); }
    ev.preventDefault(); eg.w.style.transform = 'translateX(' + Math.max(0, dx) + 'px)';
  }, { passive: false });
  document.addEventListener('touchend', function (ev) {
    if (!eg) return; var g = eg; eg = null; if (!g.on) return; var dx = ev.changedTouches[0].clientX - g.x;
    g.w.classList.remove('drag'); g.w.classList.add('back');
    if (dx > window.innerWidth * 0.3) { g.w.style.transform = 'translateX(100%)'; setTimeout(closeTh, 200); }
    else { g.w.style.transform = ''; setTimeout(function () { g.w.classList.remove('back'); }, 230); }
  }, { passive: true });
  // 左右スワイプでタブを切り替え
  var sw = null;
  document.addEventListener('touchstart', function (ev) { if (!ev.target.closest || !ev.target.closest('#bdx .bxlist') || ev.touches.length !== 1) return; sw = { x: ev.touches[0].clientX, y: ev.touches[0].clientY, t: Date.now() }; }, { passive: true });
  document.addEventListener('touchend', function (ev) {
    if (!sw) return; var c = ev.changedTouches[0], dx = c.clientX - sw.x, dy = c.clientY - sw.y, s0 = sw; sw = null;
    if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 1.5 || Date.now() - s0.t > 600) return;
    var ids = TABS.map(function (z) { return z[0]; }), i = ids.indexOf(cur()) + (dx < 0 ? 1 : -1); if (i < 0 || i >= ids.length) return; setTab(ids[i], dx < 0 ? 1 : -1);
  }, { passive: true });
})();
