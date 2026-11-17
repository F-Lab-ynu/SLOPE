    // ===== 本番データ（window.DB から組み立てる） =====
    const D = window.DB;
    const sep = (i, n) => (i < n - 1 ? '1px solid #252524' : '0');
    const pick = (on) => ({ bg: on ? '#F3F1EC' : 'transparent', fg: on ? INK : '#D2CFC8', bd: on ? '#F3F1EC' : '#383836' });

    // ---- 掲示板：募集・意見 ----
    const cmCount = (id) => D.items('comment').filter((c) => c.parent_id === id).length;
    const ROLES = ['Strategist', 'Negotiator', 'Advertiser', 'Engineer', 'Innovator'];
    const recruits = D.items('recruit').map((x) => {
      const d = x.data || {};
      const slots = (d.roles || []).map((role) => {
        const who = D.reactors(x.id, 'slot:' + role), mine = who.indexOf(D.me) >= 0, open = who.length === 0;
        return { role: role, open: open, notOpen: !open, label: open ? '募集中' : (mine ? '参加中（あなた）' : '参加済み · ' + D.name(who[0])), bd: open ? '#5F5E5A' : '#2C2C2A', fg: open ? '#F3F1EC' : M, bg: open ? 'transparent' : '#171716',
          apply: () => { if (x.author === D.me) { D.flash('自分の募集には応募できません'); return; } D.toggle(x.id, 'slot:' + role, true); } };
      });
      const openSlots = slots.filter((z) => z.open);
      return { id: x.id, author: x.author, frame: d.frame || '実プロジェクト枠', title: d.title || '', owner: D.who(x.author), initial: D.ini(x.author), time: D.ago(x.created_at), purpose: d.purpose || '', end: d.end || '', endShort: (d.end || '').replace(/した時点で解散|に解散/, '').slice(0, 14), fb: cmCount(x.id), pain: d.pain || '',
        isRecruit: true, isIdea: false, typeLabel: 'メンバー募集 · ' + (d.frame || ''), typeBg: RT, typeBd: RT, typeFg: INK, purposeLabel: '目的', fbTitle: 'フィードバック', hasPain: !!d.pain, asks: [], slots: slots,
        openCount: openSlots.length, openList: openSlots.map((z) => ({ role: z.role })), openRoles: openSlots.map((z) => z.role).join(' / ') || '満員', open: () => this.setState({ sub: 'post', post: x.id }), t: x.created_at };
    });
    const ideas = D.items('idea').map((x) => {
      const d = x.data || {};
      return { id: x.id, author: x.author, title: d.title || '', owner: D.who(x.author), initial: D.ini(x.author), time: D.ago(x.created_at), summary: d.summary || '', asks: (d.asks || []).filter(Boolean).map((t) => ({ text: t })), fb: cmCount(x.id), votes: D.count(x.id, 'vote'), pain: d.pain || '',
        isIdea: true, isRecruit: false, typeLabel: '意見募集', typeBg: 'transparent', typeBd: '#F3F1EC', typeFg: '#F3F1EC', purposeLabel: '概要', purpose: d.summary || '', fbTitle: '寄せられた意見', hasPain: !!d.pain, slots: [],
        open: () => this.setState({ sub: 'post', post: x.id }), t: x.created_at };
    });
    const allPosts = recruits.concat(ideas).sort((a, b) => (a.t < b.t ? 1 : -1));
    const feed = allPosts.filter((p) => s.bfilter === 'all' || (s.bfilter === 'recruit' ? p.isRecruit : p.isIdea));
    const bFilters = [{ k: 'all', n: 'すべて' }, { k: 'recruit', n: 'メンバー募集' }, { k: 'idea', n: '意見募集' }].map((f) => Object.assign({ name: f.n, pick: () => this.setState({ bfilter: f.k }) }, pick(s.bfilter === f.k)));
    const curBase = allPosts.find((r) => r.id === s.post) || allPosts[0] || { id: '', title: '', slots: [], asks: [], isRecruit: false, isIdea: false, hasPain: false };

    // ---- ペイン ----
    const painPosts = (txt) => allPosts.filter((p) => p.pain && p.pain === txt).length;
    const painsAll = D.items('pain').map((x) => {
      const d = x.data || {}, on = D.mine(x.id, 'emp'), sev = d.sev || 2;
      return { id: x.id, t: x.created_at, text: d.text || '', who: d.who || '—', src: d.src || '自分', ideas: painPosts(d.text), tags: (d.tags || []).map((t) => ({ name: t })),
        count: D.count(x.id, 'emp'), d1: sev >= 1 ? RT : '#383836', d2: sev >= 2 ? RT : '#383836', d3: sev >= 3 ? RT : '#383836',
        empBg: on ? RT : 'transparent', empFg: on ? INK : '#E9E6DF', empBd: on ? RT : '#383836', ideaColor: painPosts(d.text) > 0 ? '#E9E6DF' : M,
        toggle: () => D.toggle(x.id, 'emp') };
    });
    const pains = s.ps === '新着' ? painsAll : painsAll.slice().sort((a, b) => b.count - a.count);
    const painTop = painsAll.slice().sort((a, b) => b.count - a.count).slice(0, 3).map((p, i, arr) => ({ rank: i + 1, text: p.text, count: p.count, sep: sep(i, arr.length) }));

    // ---- 教材（運営画面のトラックから） ----
    const T = D.tracks();
    const done = (t, code) => D.mine(t.id + ':' + code, 'done');
    const isBase = (t) => /基礎/.test(t.name), isPrac = (t) => /^実務/.test(t.name);
    const baseT = T.find(isBase), roleTs = T.filter((t) => !isBase(t) && !isPrac(t)), pracTs = T.filter(isPrac);
    const unitsOf = (t) => D.units(t);
    const stOf = (t, u) => (done(t, u.code) ? 'done' : (u.deps.filter((d) => unitsOf(t).some((v) => v.code === d)).every((d) => done(t, d)) ? 'open' : 'locked'));
    const openUnitBy = (t, code) => () => this.setState({ sub: 'unit', unitT: t.id, unitC: code });
    const units = baseT ? unitsOf(baseT).map((u) => ({ no: u.code, title: u.title, meta: (D.unitData(baseT, u.code).milestone || u.tags.join(' · ')), st: stOf(baseT, u), open: openUnitBy(baseT, u.code) })) : [];
    const statusLabel = { done: '修了', open: '受講可', locked: '未解放' };
    const baseUnits = units.map((u, i) => ({
      no: u.no, title: u.title, meta: u.meta, status: statusLabel[u.st], open: u.open,
      done: u.st === 'done', doing: u.st === 'open', locked: u.st === 'locked',
      nodeBg: u.st === 'done' ? A : 'transparent', nodeBd: u.st === 'locked' ? '#383836' : (u.st === 'open' ? RT : A), nodeFg: u.st === 'done' ? INK : M,
      titleColor: u.st === 'locked' ? '#BDBAB3' : '#F3F1EC', lineColor: i === units.length - 1 ? 'transparent' : (u.st === 'done' ? A : '#383836')
    }));
    const uSel = (() => { const t = T.find((x) => x.id === s.unitT); if (!t) return null; const u = unitsOf(t).find((v) => v.code === s.unitC); return u ? { t: t, u: u, d: D.unitData(t, u.code) } : null; })();
    const materials = uSel ? (uSel.d.materials || []).map((m) => ({ title: m.memo || m.url, kind: m.type || '記事', min: D.host(m.url), src: '外部', color: '#D2CFC8', url: m.url, go: () => window.open(m.url, '_blank', 'noopener') })) : [];

    // ---- 募集の詳細：観点別フィードバック ----
    const lensNames = ['すべて'].concat(ROLES);
    const lenses = lensNames.map((n) => Object.assign({ name: n, pick: () => this.setState({ lens: n }) }, pick(s.lens === n)));
    const postComments = D.items('comment').filter((c) => c.parent_id === curBase.id).slice().reverse().map((c) => ({ lens: (c.data || {}).lens || '一般', op: D.who(c.author) + ' · ' + D.ago(c.created_at), text: (c.data || {}).text || '' }));
    const comments = s.lens === 'すべて' ? postComments : postComments.filter((c) => c.lens === s.lens);
    const survey = [];
    const cur = Object.assign({}, curBase, { hasSurvey: false, surveyQ: '', surveyN: 0, mine: curBase.author === D.me, notMine: !!curBase.author && curBase.author !== D.me });

    // ---- 投稿フォーム ----
    const npOn = (on) => ({ bg: on ? '#F3F1EC' : '#131313', fg: on ? INK : '#D2CFC8', bd: on ? '#F3F1EC' : '#383836' });
    const npTypes = [
      { k: 'idea', name: '意見募集', desc: 'アイデアだけ出して、まずは意見を聞く', bs: 'dashed' },
      { k: 'recruit', name: 'メンバー募集', desc: '職能の枠と解散条件を決めてチームを組む', bs: 'solid' }
    ].map((t) => { const on = s.np === t.k; return { name: t.name, desc: t.desc, bs: t.bs, bd: on ? A : '#383836', bg: on ? 'rgba(255,255,255,0.07)' : '#0C0C0C', titleColor: on ? A : '#F3F1EC', pick: () => this.setState({ np: t.k }) }; });
    const npFrames = ['実プロジェクト枠', '外部ビジコン枠'].map((n) => Object.assign({ name: n, pick: () => this.setState({ npFrame: n }) }, npOn(s.npFrame === n)));
    const npRoles = ROLES.map((n) => Object.assign({ name: n, pick: () => { const r = Object.assign({}, this.state.npRoles); r[n] = !r[n]; this.setState({ npRoles: r }); } }, pick(!!s.npRoles[n])));
    const npEnds = ['ビジコン終了後に解散', 'ビジコン入賞時は継続', '事業の存続が不可能と判断した時点で解散'].map((n, i) => Object.assign({ name: n, pick: () => this.setState({ npEnd: i }) }, npOn(s.npEnd === i)));
    const opt = (on) => ({ bg: on ? '#F3F1EC' : '#131313', fg: on ? INK : '#D2CFC8', bd: on ? '#F3F1EC' : '#383836' });
    const srcOpts = ['自分', '聞き取り', '観察'].map((n) => Object.assign({ name: n, pick: () => this.setState({ src: n }) }, opt(s.src === n)));
    const sevOpts = [{ v: 1, n: '低' }, { v: 2, n: '中' }, { v: 3, n: '高' }].map((o) => Object.assign({ name: o.n, pick: () => this.setState({ sev: o.v }) }, opt(s.sev === o.v)));
    const anon = { track: s.anon ? A : '#383836', knob: s.anon ? INK : '#BDBAB3', x: s.anon ? '23px' : '3px' };

    // ---- 予定（業務の告知済みイベント＋予定に追加した外部イベント） ----
    const now = new Date(), cy = s.calY || now.getFullYear(), cm = s.calM || (now.getMonth() + 1);
    const ymd = (iso) => { const p = String(iso || '').split('-'); return p.length === 3 ? { y: +p[0], m: +p[1], d: +p[2] } : null; };
    const calEvents = D.calendar().map((e) => Object.assign({}, e, { ymd: ymd(e.date) })).filter((e) => e.ymd);
    const evIn = (y, m, d) => calEvents.filter((e) => e.ymd.y === y && e.ymd.m === m && e.ymd.d === d);
    const first = new Date(cy, cm - 1, 1).getDay(), dim = new Date(cy, cm, 0).getDate(), cells = Math.ceil((first + dim) / 7) * 7;
    const selDay = s.calSel && s.calSel.y === cy && s.calSel.m === cm ? s.calSel.d : (now.getFullYear() === cy && now.getMonth() + 1 === cm ? now.getDate() : 1);
    const days = [];
    for (let i = 0; i < cells; i++) {
      const d = i - first + 1, inMonth = d >= 1 && d <= dim, evs = inMonth ? evIn(cy, cm, d) : [];
      const sel = inMonth && d === selDay, today = inMonth && cy === now.getFullYear() && cm === now.getMonth() + 1 && d === now.getDate();
      const dot = (e) => (e ? (sel ? INK : typeColor[e.type]) : 'transparent');
      days.push({ label: inMonth ? d : '', disabled: !inMonth, bg: sel ? A : 'transparent', fg: sel ? INK : (inMonth ? '#E9E6DF' : '#5F5E5A'), bd: today && !sel ? RT : 'transparent', c1: dot(evs[0]), c2: dot(evs[1]),
        pick: () => { if (inMonth) this.setState({ calSel: { y: cy, m: cm, d: d } }); } });
    }
    const WD = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
    const clubEvents = []; // 本番では member.js が上書き
    const dayEvents = evIn(cy, cm, selDay).map((e) => {
      const on = e.joinId ? D.mine(e.joinId, e.joinKind) : false;
      return Object.assign({}, e, { color: typeColor[e.type], joinLabel: e.joinId ? (on ? (e.joinKind === 'join' ? '登録済み' : '予定に追加済み') : (e.joinKind === 'join' ? '参加登録' : '予定に追加')) : '—',
        joinBg: on ? 'transparent' : A, joinFg: on ? A : INK, joinBd: A, toggle: () => { if (e.joinId) D.toggle(e.joinId, e.joinKind); } });
    });

    // ---- 運営ダッシュボード（部員アプリ内） ----
    const approved = D.profiles().length;
    const kpis = [
      { label: '登録者', val: String(approved), note: '人' },
      { label: '投稿', val: String(allPosts.length), note: '件' },
      { label: '募集中', val: String(recruits.filter((r) => r.openCount > 0).length), note: '件' },
      { label: 'ペイン', val: String(painsAll.length), note: '件 · 共感 ' + painsAll.reduce((a, p) => a + p.count, 0) }
    ];
    const levels = [];
    const tagN = {}; painsAll.forEach((p) => p.tags.forEach((t) => { tagN[t.name] = (tagN[t.name] || 0) + p.count; }));
    const tagMax = Math.max(1, ...Object.values(tagN));
    const painTags = Object.keys(tagN).sort((a, b) => tagN[b] - tagN[a]).slice(0, 5).map((k) => ({ name: k, n: tagN[k], w: Math.round(tagN[k] / tagMax * 100) + '%' }));
    const rates = D.events().slice(0, 3).map((e, i, arr) => ({ name: e.title, v: approved ? Math.round(D.count(e.id, 'join') / approved * 100) + '%' : '—', sep: sep(i, arr.length) }));

    // ---- ロールトラックの路線図 ----
    const myRoles = D.myRoles();
    const courseOf = (t) => {
      const us = unitsOf(t), by = {}; us.forEach((u) => { by[u.code] = u; });
      const L = {}; const lv = (c, seen) => { if (L[c] != null) return L[c]; if (seen[c]) return 1; seen[c] = 1; const ds = by[c].deps.filter((d) => by[d]); L[c] = ds.length ? 1 + Math.max(...ds.map((d) => lv(d, seen))) : 1; return L[c]; };
      us.forEach((u) => lv(u.code, {}));
      const perL = {}, lane = {};
      us.forEach((u) => { const l = L[u.code]; lane[u.code] = perL[l] || 0; perL[l] = (perL[l] || 0) + 1; });
      const maxL = us.length ? Math.max(...us.map((u) => L[u.code])) : 0;
      const lanes = Math.max(1, ...[1].concat(Object.values(perL)));
      const kids = {}; us.forEach((u) => u.deps.forEach((d) => { if (by[d]) kids[d] = 1; }));
      const nodes = [{ id: 'in', label: t.start || 'START', sub: 'START', L: 0, lane: 0, k: 'gate', st: 'done', deps: [] }]
        .concat(us.map((u) => ({ id: u.code, label: u.title, sub: u.code + (u.tags.length ? ' · ' + u.tags.join(' · ') : ''), L: L[u.code], lane: lane[u.code], st: stOf(t, u), deps: u.deps.filter((d) => by[d]).length ? u.deps.filter((d) => by[d]) : ['in'], ext: u.deps.filter((d) => !by[d]) })))
        .concat([{ id: 'out', label: t.goal || 'GOAL', sub: 'GOAL', L: maxL + 1, lane: 0, k: 'gate', st: us.length && us.every((u) => done(t, u.code)) ? 'done' : 'locked', deps: us.filter((u) => !kids[u.code]).map((u) => u.code).concat(us.length ? [] : ['in']) }]);
      return { t: t, name: t.name, short: t.goal ? '→ ' + t.goal : '', jp: us.map((u) => u.title).slice(0, 6).join('・'), lanes: lanes, nodes: nodes, opt: /任意/.test(t.name) };
    };
    const COURSES = {}; roleTs.forEach((t) => { COURSES[t.id] = courseOf(t); });
    const isUnit = (n) => !n.k;
    const unitCount = (c) => c.nodes.filter(isUnit).length;
    const doneCount = (c) => c.nodes.filter((n) => isUnit(n) && n.st === 'done').length;
    const courses = roleTs.map((t) => {
      const c = COURSES[t.id], active = myRoles.indexOf(t.name) >= 0;
      return { name: c.name, jp: c.short, tag: active ? '受講中' : (c.opt ? '任意' : 'ROLE'), tagColor: active ? RT : M, bd: active ? A : '#252524',
        count: doneCount(c) + ' / ' + unitCount(c) + ' 修了', open: () => this.setState({ sub: 'course', course: t.id, cnode: null }) };
    });
    const ck = COURSES[s.course] ? s.course : (roleTs[0] && roleTs[0].id);
    const cc = ck ? COURSES[ck] : { name: '', jp: '', lanes: 1, nodes: [{ id: 'in', label: '', sub: '', L: 0, lane: 0, k: 'gate', st: 'done', deps: [] }] };
    const TOP = 24, RY = 92, BH = 56;
    // 並列が4本以上のときは横に広げて、横スクロールで見る
    const laneX = cc.lanes === 1 ? [28] : (cc.lanes === 2 ? [28, 190] : (cc.lanes === 3 ? [28, 136, 244] : Array.from({ length: cc.lanes }, (_, i) => 28 + i * 150)));
    const laneW = cc.lanes === 2 ? 158 : (cc.lanes === 3 ? 106 : 136);
    const mapW = Math.max(350, laneX[laneX.length - 1] + laneW + 8);
    const perL2 = {}; cc.nodes.forEach((n) => { perL2[n.L] = (perL2[n.L] || 0) + 1; });
    const cById = {}; let maxL2 = 0;
    cc.nodes.forEach((n) => { maxL2 = Math.max(maxL2, n.L); cById[n.id] = { n: n, solo: perL2[n.L] === 1, dx: laneX[Math.min(n.lane || 0, laneX.length - 1)], cy: TOP + n.L * RY + BH / 2, top: TOP + n.L * RY }; });
    const segP = (x1, y1, x2, y2) => { if (x1 === x2) return 'M' + x1 + ' ' + y1 + ' V' + y2 + ' '; const ym = y2 - RY / 2, r = 14, dir = x2 > x1 ? 1 : -1; return 'M' + x1 + ' ' + y1 + ' V' + (ym - r) + ' Q' + x1 + ' ' + ym + ' ' + (x1 + dir * r) + ' ' + ym + ' H' + (x2 - dir * r) + ' Q' + x2 + ' ' + ym + ' ' + x2 + ' ' + (ym + r) + ' V' + y2 + ' '; };
    let cEdges = '', cEdgesExt = '', cEdgesGoal = '', cEdgesDone = '';
    cc.nodes.forEach((n) => n.deps.forEach((d) => { const p = cById[d], q = cById[n.id]; if (!p || !q) return; const path = segP(p.dx, p.cy, q.dx, q.cy);
      if (p.n.st === 'done' && n.st === 'done') cEdgesDone += path; else if (n.id === 'out') cEdgesGoal += path; else cEdges += path; }));
    const firstPick = cc.nodes.find((n) => isUnit(n) && n.st === 'open') || cc.nodes.find(isUnit) || cc.nodes[0];
    const cSelId = s.cnode && cById[s.cnode] ? s.cnode : firstPick.id;
    const crsNodes = cc.nodes.map((n) => {
      const pos = cById[n.id], start = n.id === 'in', goal = n.id === 'out', sel = n.id === cSelId, size = start || goal ? 22 : 14, narrow = !pos.solo && cc.lanes >= 3, st = n.st;
      return { label: n.label, sub: n.sub, x: (pos.dx - 8 - size / 2) + 'px', y: pos.top + 'px', w: pos.solo ? '310px' : laneW + 'px', fs: pos.solo ? '16px' : (narrow ? '12px' : '14px'), ws: narrow ? 'normal' : 'nowrap', size: size + 'px',
        dotBg: (goal && st === 'done') || (!goal && st === 'done') ? A : (st === 'open' ? 'rgba(242,169,59,0.25)' : INK),
        dotBd: start ? '#F3F1EC' : (st === 'open' ? RT : (st === 'done' ? A : '#474744')), dotBs: 'solid',
        glow: sel ? '0 0 0 6px rgba(244,244,245,0.16)' : 'none', btnBg: sel ? 'rgba(255,255,255,0.05)' : 'transparent',
        labelColor: sel ? '#FFFFFF' : (st === 'locked' ? '#A3A19B' : '#E9E6DF'), fg: '#E9E6DF', subColor: st === 'open' ? RT : (st === 'done' ? '#D0D0D0' : M), pick: () => this.setState({ cnode: n.id }) };
    });
    const hn = TOP * 2 + maxL2 * RY + BH;
    const crs = { name: cc.name, jp: cc.jp, kind: cc.opt ? '任意トラック' : 'ロールトラック', count: doneCount(cc) + ' / ' + unitCount(cc) + ' 修了', lock: myRoles.indexOf(cc.name) >= 0 ? '受講中' : '受講可', lockColor: myRoles.indexOf(cc.name) >= 0 ? RT : '#BDBAB3',
      nodes: crsNodes, edges: cEdges, edgesExt: cEdgesExt, edgesGoal: cEdgesGoal, edgesDone: cEdgesDone, h: hn + 'px', hn: hn, w: mapW + 'px', wn: mapW, key: ck + ':' + cSelId };
    const csn = (cById[cSelId] || { n: cc.nodes[0] }).n;
    const cKids = cc.nodes.filter((n) => n.deps.indexOf(cSelId) >= 0).map((n) => n.label);
    const SL = { done: '修了', open: '受講可', locked: '未解放' };
    const cSel = { label: csn.label, sub: csn.sub, status: csn.id === 'in' ? 'START' : (csn.id === 'out' ? 'GOAL' : SL[csn.st]),
      deps: (csn.deps || []).filter((d) => d !== 'in').length || (csn.ext || []).length ? (csn.deps || []).filter((d) => d !== 'in').map((d) => (cById[d] ? cById[d].n.label : d)).concat(csn.ext || []).join(' ＋ ') : 'なし（トラックの起点）',
      next: cKids.length ? cKids.join(' / ') : 'なし（トラックの終点）', isUnit: isUnit(csn), open: ck && isUnit(csn) ? openUnitBy(cc.t, csn.id) : () => {} };

    // ---- プログラム（入れ子＋左のバー）に渡すデータ。種類は運営画面で選ぶ（名前では決めない） ----
    const kindOf = (t) => t.kind || (isBase(t) ? 'all' : (isPrac(t) ? 'opt' : 'choose'));
    const PT = T.map((t) => { const us = unitsOf(t), U = {};
      us.forEach((u) => { const st = stOf(t, u); U[u.code] = { title: u.title, meta: (D.unitData(t, u.code).milestone || u.tags.join(' · ')), st: st }; });
      return { id: t.id, name: t.name.replace(/^実務[：:・ ]*/, ''), jp: t.goal ? '到達：' + t.goal : '', kind: kindOf(t), mine: kindOf(t) === 'all' || myRoles.indexOf(t.name) >= 0, tree: t.tree || null, list: us, units: U }; });
    const curT = PT.find((t) => t.id === s.course) || PT.find((t) => t.mine && t.kind === 'choose') || PT[0];
    const progRow = D.items('program')[0], progTree = progRow && progRow.data && progRow.data.tree ? progRow.data.tree : null;
    window.__PROG = { joined: (id) => D.mine(id, 'join'), join: (id) => D.toggle(id, 'join'), jkey: JSON.stringify(D.progEvents().map((e) => D.mine(e.id, 'join'))), tracks: PT, program: progTree, roles: myRoles, v2: progRow && progRow.data && progRow.data.v2 ? progRow.data.v2 : null, today: new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10), cur: curT ? curT.id : null, key: JSON.stringify([progRow && progRow.data, PT.map((t) => [t.id, t.tree, Object.keys(t.units).map((c) => t.units[c].st)])]),
      openTrack: (id) => this.setState({ sub: 'course', course: id, cnode: null }), openUnit: (tid, code) => this.setState({ sub: 'unit', unitT: tid, unitC: code }) };
    const KN = { all: '全員', choose: '選択', opt: '任意' };
    const crsKind = curT ? KN[curT.kind] : '', crsName = curT ? curT.name : '', crsJp = curT ? curT.jp : '', crsTot = curT ? Object.keys(curT.units).length : 0,
      crsDone = curT ? Object.keys(curT.units).filter((c) => curT.units[c].st === 'done').length : 0, crsMine = curT ? curT.mine : false;

    // ---- 実務教育・すべての単元 ----
    const pracGroups = pracTs.map((t) => { const us = unitsOf(t); return { name: t.name.replace(/^実務[：:・ ]*/, '') + ' · ' + us.length + ' 単元', items: us.map((u, i) => ({ code: u.code, title: u.title, sep: sep(i, us.length), open: openUnitBy(t, u.code) })) }; });
    const pracNote = pracTs.length ? pracTs.map((t) => t.name.replace(/^実務[：:・ ]*/, '') + ' ' + unitsOf(t).length).join(' · ') : 'まだありません';
    const STL = { done: '修了', open: '受講可', locked: '未解放' };
    const q = (s.uq || '').trim();
    const rawGroups = T.map((t) => ({ name: t.name, items: unitsOf(t).map((u) => ({ code: u.code, title: u.title, st: stOf(t, u), practice: u.tags.indexOf('実習') >= 0, shared: false, open: openUnitBy(t, u.code) })) }));
    const allCount = rawGroups.reduce((a, g) => a + g.items.length, 0);
    const uf = s.uf || 'all';
    const unitGroups = rawGroups.map((g) => {
      const items = g.items.filter((u) => (uf === 'all' || (uf === 'practice' ? u.practice : u.st === uf)) && (!q || (u.code + u.title).indexOf(q) >= 0));
      return { name: g.name, n: items.length, items: items.map((u, i) => Object.assign({}, u, { status: STL[u.st], stColor: u.st === 'open' ? RT : (u.st === 'done' ? '#D0D0D0' : M), dotBg: u.st === 'done' ? A : 'transparent',
        dotBd: u.st === 'locked' ? '#5F5E5A' : (u.st === 'open' ? RT : A), fg: u.st === 'locked' ? '#D2CFC8' : '#F3F1EC', sep: sep(i, items.length) })) };
    }).filter((g) => g.items.length > 0);
    const uFilters = [{ k: 'all', n: 'すべて' }, { k: 'open', n: '受講可' }, { k: 'locked', n: '未解放' }, { k: 'done', n: '修了' }, { k: 'practice', n: '実習のみ' }].map((f) => Object.assign({ name: f.n, pick: () => this.setState({ uf: f.k }) }, pick(uf === f.k)));

    // ---- 外部イベント（公式＝告知、部員投稿＝部員からの情報） ----
    const exTypeColor = { 'ビジコン': '#F3F1EC', 'インターン': '#A6A6A6', '説明会': '#BDBDBD', '支援制度': '#D2CFC8', 'その他': '#8C8C8C' };
    const dueLabel = (iso) => { const p = ymd(iso); return p ? p.m + '.' + p.d + ' 締切' : (iso || ''); };
    const exRaw = D.items('notice').map((x) => { const d = x.data || {}; return { id: x.id, type: d.type || 'その他', title: d.title || '', host: d.host || '', detail: d.memo || '', when: dueLabel(d.due), tags: d.roles && d.roles.length ? d.roles : ['全職能'], team: d.type === 'ビジコン', url: d.url, due: d.due }; })
      .concat(D.items('offer').filter((x) => (x.data || {}).state === 'wait').map((x) => { const d = x.data || {}; return { id: x.id, type: d.type || 'その他', title: d.title || '', host: d.host || '', detail: d.url ? D.host(d.url) : '', when: d.due || '', tags: d.roles && d.roles.length ? d.roles : ['全職能'], team: d.type === 'ビジコン', by: D.who(x.author), initial: D.ini(x.author), note: d.note || '', url: d.url }; }));
    const exSel = exRaw.filter((x) => s.exf === 'all' || x.type === s.exf);
    const exItems = exSel.map((x) => {
      const on = D.mine(x.id, 'plan');
      return Object.assign({}, x, { typeColor: exTypeColor[x.type] || '#8C8C8C', noTeam: !x.team, member: !!x.by, official: !x.by,
        fit: x.tags.indexOf('全職能') >= 0 || x.tags.some((t) => myRoles.indexOf(t) >= 0), tags: x.tags.map((t) => ({ name: t })),
        addLabel: on ? '予定に追加済み' : '予定に追加', addBg: on ? 'transparent' : A, addFg: on ? A : INK, addBd: A, toggle: () => D.toggle(x.id, 'plan'),
        detailGo: () => { if (x.url) window.open(x.url, '_blank', 'noopener'); } });
    });
    const exFilters = [{ k: 'all', n: 'すべて' }, { k: 'ビジコン', n: 'ビジコン' }, { k: 'インターン', n: 'インターン' }, { k: '説明会', n: '説明会' }].map((f) => Object.assign({ name: f.n, pick: () => this.setState({ exf: f.k }) }, pick(s.exf === f.k)));

    // ---- 掲示板：その他 ----
    const otf = s.otf || 'すべて';
    const otRaw = D.items('other').map((x) => { const d = x.data || {}; return { id: x.id, tag: d.tag || '雑談', who: D.who(x.author), ini: D.ini(x.author), time: D.ago(x.created_at), book: d.book || '', author: d.bookAuthor || '', text: d.text || '', like: D.count(x.id, 'like'), rep: cmCount(x.id) }; });
    const otSel = otRaw.filter((p) => otf === 'すべて' || p.tag === otf);
    const otPosts = otSel.map((p, i) => { const on = D.mine(p.id, 'like'); return Object.assign({}, p, { hasBook: !!p.book, likeN: p.like, likeFg: on ? RT : '#A3A19B', likeFill: on ? RT : 'none', sep: sep(i, otSel.length), toggle: () => D.toggle(p.id, 'like') }); });
    const otFilters = ['すべて', '本', '雑談'].map((n) => Object.assign({ name: n, pick: () => this.setState({ otf: n }) }, pick(otf === n)));

    // ---- 教材ライブラリ（全トラックの教材リンク） ----
    const srcColor = { '部内': A, 'FCE': '#A6A6A6', '外部': '#D2CFC8' };
    const libRaw = [];
    T.forEach((t) => unitsOf(t).forEach((u) => (D.unitData(t, u.code).materials || []).forEach((m) => libRaw.push({ title: m.memo || m.url, kind: m.type || '記事', min: D.host(m.url), src: '外部', unit: u.code, g: isBase(t) ? 'base' : 'role', open: openUnitBy(t, u.code) }))));
    const lq = (s.lq || '').trim();
    const libSel = libRaw.filter((m) => (s.libf === 'all' || m.g === s.libf) && (!lq || (m.title + m.unit).indexOf(lq) >= 0));
    const libItems = libSel.map((m, i) => Object.assign({}, m, { color: srcColor[m.src], sep: sep(i, libSel.length) }));
    const libFilters = [{ k: 'all', n: 'すべて' }, { k: 'base', n: '基礎教育' }, { k: 'role', n: 'ロールトラック' }].map((f) => Object.assign({ name: f.n, pick: () => this.setState({ libf: f.k }) }, pick(s.libf === f.k)));

    // ---- 演習（実習の提出・レビューは今後。今は実習の単元を並べる） ----
    const pracUnits = [];
    T.forEach((t) => unitsOf(t).forEach((u) => { if (u.tags.indexOf('実習') >= 0) pracUnits.push({ t: t, u: u }); }));
    const pReviews = [];
    const pStats = [
      { n: pracUnits.filter((x) => stOf(x.t, x.u) === 'open').length, label: '取り組める実習', color: RT },
      { n: 0, label: 'レビュー待ち', color: '#F3F1EC' },
      { n: pracUnits.filter((x) => stOf(x.t, x.u) === 'done').length, label: '修了した実習', color: '#BDBAB3' }
    ];
    const pDue = pracUnits.filter((x) => stOf(x.t, x.u) === 'open').slice(0, 4).map((x) => ({ kind: '実習', kindColor: '#BDBDBD', due: x.u.code, dueColor: RT, title: x.u.title, link: x.t.name, cta: '開く', go: openUnitBy(x.t, x.u.code) }));
    const pDone = pracUnits.filter((x) => stOf(x.t, x.u) === 'done').map((x) => ({ title: x.u.title, meta: x.t.name + ' · ' + x.u.code, fb: 0 }));

    // ---- ニュース（API連携までは空） ----
    const newsAll = [];
    const nf = s.nf || 'すべて';
    const newsItems = newsAll;
    const newsFilters = ['すべて'].map((n) => Object.assign({ name: n, pick: () => this.setState({ nf: n }) }, pick(nf === n)));
    const newsHome = undefined;
    const curNews = { id: '', tag: '', time: '', title: '', sum: '', src: '' };
    const newsCm = [];
    const meAv = main && s.tab === 'me' ? { bg: '#F3F1EC', fg: INK, bd: '#F3F1EC' } : { bg: '#2C2C2A', fg: '#F3F1EC', bd: '#474744' };

