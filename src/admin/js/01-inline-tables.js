// ================= 教材・外部告知・掲示板・メンバー：その場で編集できる表 =================
function snap() { UI.undo = JSON.stringify({ projects: S.projects, tracks: S.tracks, notices: S.notices, posts: S.posts, members: S.members, offers: S.offers, patches: S.patches, cals: S.cals }); }
function undoNow() { if (!UI.undo) return; var u = JSON.parse(UI.undo); if (u && !Array.isArray(u)) Object.keys(u).forEach(function (k) { S[k] = u[k]; }); else S.projects = u; UI.undo = null; document.getElementById('toast').hidden = true; S.sel = S.sel; save(); render(); }
function focusSel(sel, select) { var el = sel && document.querySelector(sel); if (!el) return; el.focus(); if (el.setSelectionRange && (el.type === 'text' || el.type === 'url' || el.type === 'search')) { var L = el.value.length; if (select) el.select(); else el.setSelectionRange(L, L); } }

// ---------- 教材：単元を行で編集 ----------
function tl(t) { if (!t.list) t.list = parse(t.text).units.map(function (u) { return { code: u.code, title: u.title, tags: u.tags, deps: u.deps }; }); return t.list; }
function clean(s) { return String(s || '').replace(/[\[\]←]|<-/g, '').replace(/\s+/g, ' ').trim(); }
function serialize(t) { t.text = tl(t).map(function (u) { return u.title ? u.code + ' ' + u.title + u.tags.map(function (x) { return ' [' + x + ']'; }).join('') + (u.deps.length ? ' ← ' + u.deps.join(', ') : '') : ''; }).join('\n'); }
function nextCode(t) {
  var L = tl(t), pre = (L[0] && (L[0].code.match(/^[A-Za-z]+/) || [])[0]) || (t.name.replace(/[^A-Za-z]/g, '').slice(0, 2).toUpperCase() || 'U'), max = 0, used = allCodes();
  L.forEach(function (u) { var m = u.code.match(/^([A-Za-z]+)(\d+)$/); if (m && m[1] === pre) max = Math.max(max, +m[2]); });
  var c; do { c = pre + (++max); } while (used[c] || L.some(function (u) { return u.code === c; })); return c;
}
function unitIdx(t, code) { var L = tl(t); for (var i = 0; i < L.length; i++) if (L[i].code === code) return i; return -1; }
function changedTrack(t) { serialize(t); touch(t); save(); }
var TAGS = ['実習', '対面'];
function renameUnit(t, old, nu) {
  S.tracks.forEach(function (x) { tl(x).forEach(function (u) { u.deps = u.deps.map(function (d) { return d === old ? nu : d; }); }); serialize(x); });
  tl(t).forEach(function (u) { if (u.code === old) u.code = nu; });
  if (t.units[old]) { t.units[nu] = t.units[old]; delete t.units[old]; }
  if (S.sel === old) S.sel = nu; changedTrack(t);
}
// 前提の選択（その場で開く小さなリスト）

// ---------- 外部告知：表のまま編集 ----------
function viewNotices() {
  if (['ev', 'ann', 'cal', 'list', 'offer'].indexOf(S.ntab) < 0) S.ntab = 'ev';
  var tab = S.ntab;
  var wait = S.offers.filter(function (o) { return o.state === 'wait'; });
  var list = S.notices.slice().sort(function (a, b) { var pa = dayOf(a.due) < TODAY, pb = dayOf(b.due) < TODAY; return pa !== pb ? (pa ? 1 : -1) : dayOf(a.due) - dayOf(b.due); });
  var body;
  if (tab === 'ev') body = viewEvents();
  else if (tab === 'ann') body = viewAnns();
  else if (tab === 'cal') body = viewCal();
  else if (tab === 'list') {
    var host0 = function (u) { try { return new URL(u).hostname.replace(/^www\./, ''); } catch (e) { return ''; } };
    body = list.length ? '<div class="evl nvl"><div class="evr evh"><span>告知</span><span>締切</span><span>リンク</span><span class="tdc">種類</span><span>公開</span><span></span></div>' +
      list.map(function (n) {
        var past = dayOf(n.due) < TODAY, ok = /^https?:\/\//i.test(n.url || ''), hs = n.host && n.host !== '—' ? n.host : '';
        return '<div class="evr' + (past ? ' past' : '') + '" data-nid="' + n.id + '"><span class="evn"><b>' + esc(n.title) + '</b>' + (hs ? '<span>' + esc(hs) + '</span>' : '') + '</span>' +
          '<span class="evq num">' + (n.due ? pmd(n.due) + (n.due.slice(0, 4) !== isoOf(TODAY).slice(0, 4) ? ' <small>' + n.due.slice(0, 4) + '</small>' : '') : '<span class="dim">未定</span>') + '</span>' +
          (ok ? '<a class="evp evlink" href="' + esc(n.url) + '" target="_blank" rel="noopener">' + esc(host0(n.url)) + ' ↗</a>' : '<span class="evp dim">—</span>') +
          '<span class="evg"><span class="tag tagc">' + esc(n.type) + '</span></span>' +
          (past ? '<span class="muted nsw" style="font-size:12px">終了</span>' : '<button class="sw nsw" role="switch" data-act="nState" data-id="' + n.id + '" aria-checked="' + (n.state === 'pub') + '" aria-label="公開"><i></i></button>') +
          '<span class="evact"><button class="ib" data-act="nEdit" data-id="' + n.id + '" aria-label="編集" title="編集">' + PEN + '</button>' + '<button class="rmore" type="button" tabindex="-1" aria-label="その他" title="その他">' + ic('more') + '</button>' + '</span></div>';
      }).join('') + '</div>' : '<div class="empty big">告知はまだありません</div>';
  } else {
    body = '<div class="tw"><table><thead><tr><th>タイトル</th><th class="tdc">種類</th><th class="hide-sm">提供者</th><th>締切</th><th></th></tr></thead><tbody>' +
      (wait.length ? wait.map(function (o) {
        return '<tr><td><div class="cell2"><b style="font-weight:500">' + esc(o.title) + '</b><span class="s">' + esc(o.host) + '　' + esc(o.note) + '</span></div></td><td class="tdc"><span class="tag tagc">' + esc(o.type) + '</span></td><td class="muted hide-sm">' + esc(o.by) + '</td><td class="num" data-l="締切">' + fmtDate(o.due) + '</td>' +
          '<td class="a"><div class="acts"><button class="btn sm ghost" data-act="oNo" data-id="' + o.id + '">見送る</button><button class="btn sm primary" data-act="oYes" data-id="' + o.id + '">掲載</button></div></td></tr>';
      }).join('') : '<tr><td colspan="5" class="empty">新しい情報はありません</td></tr>') + '</tbody></table></div>';
  }
  var evn = (S.cals || []).filter(function (c) { return (c.to || c.date || '9') >= isoOf(TODAY); }).length;
  return top('告知') + utabs('ntab', [['ev', 'イベント', evn], ['ann', 'お知らせ', annLiveList().length || null], ['cal', 'カレンダー', null], ['list', '外部', S.notices.length], ['offer', '部員からの情報', wait.length]]) + '<div class="body">' + body + '</div>';
}

function notice(id) { return S.notices.filter(function (n) { return n.id === id; })[0]; }

// ---------- 掲示板：押し間違えても戻せる ----------
function viewBoard() {
  if (!S.boardTab || S.boardTab === 'all' && !S._bt60) { S.boardTab = 'inq'; S._bt60 = 1; }
  var reported = S.posts.filter(function (p) { return p.reports > 0 && p.state === 'ok'; });
  var head = top('サポート') + utabs('boardTab', [['inq', 'お問い合わせ', inqOpen()], ['rep', '通報', reported.length], ['all', '投稿', S.posts.length]]);
  if (S.boardTab === 'inq') return head + '<div class="body">' + inqList() + '</div>';
  var list = S.boardTab === 'rep' ? reported : S.posts;
  var rows = list.map(function (p) {
    var gone = p.state !== 'ok';
    var acts = gone
      ? '<span class="muted" style="font-size:12px">' + (p.state === 'hidden' ? '非表示中' : '削除済み') + '</span><button class="btn sm ghost" data-act="pShow" data-id="' + p.id + '">戻す</button>'
      : (p.reports > 0 ? '<button class="ib bok" data-act="pOk" data-id="' + p.id + '" title="問題なし" aria-label="問題なし"><svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12l5 5 9-10"/></svg></button>' : '') +
        '<button class="ib bhide" data-act="pHide" data-id="' + p.id + '" title="非表示にする" aria-label="非表示にする"><svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 3l18 18"/><path d="M10.6 6.1A9.8 9.8 0 0 1 12 6c5 0 9 6 9 6a17 17 0 0 1-3.1 3.6M6.6 6.6C4.4 8 3 12 3 12s4 6 9 6c1.4 0 2.7-.4 3.9-1"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/></svg></button>' +
        '<button class="ib udel" data-act="pDelNow" data-id="' + p.id + '" aria-label="削除"><svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 7h14M10 7V5h4v2M7 7l1 12h8l1-12"/></svg></button>';
    return '<tr' + (gone ? ' style="color:var(--dim)"' : '') + '><td style="max-width:520px"><div class="cell2"><span>' + esc(p.text) + '</span><span class="s">' + esc(p.who) + '・<span class="num">' + esc(p.time) + '</span>' + (p.on ? '・' + esc(p.on) + ' へのコメント' : '') + '</span></div></td>' +
      '<td class="tdc"><span class="tag tagc">' + esc(p.tab) + '</span></td>' +
      '<td class="rp">' + (p.reports > 0 && !gone ? '<span class="bad num">' + p.reports + '</span> <span class="muted">' + esc(p.reason) + '</span>' : '<span class="dim">—</span>') + '</td>' +
      '<td class="a"><div class="acts">' + acts + '</div></td></tr>';
  }).join('');
  return head +
    '<div class="body"><div class="tw"><table><thead><tr><th>内容</th><th class="tdc">場所</th><th>通報</th><th></th></tr></thead><tbody>' +
    (rows || '<tr><td colspan="4" class="empty">' + (S.boardTab === 'rep' ? '対応が必要な通報はありません' : '投稿はありません') + '</td></tr>') + '</tbody></table></div></div>';
}
// お問い合わせ・要望（本人と運営だけが見られる）。未対応が上
function inqList() {
  var list = (S.inqs || []).slice().sort(function (a, b) { return (a.status === 'done') - (b.status === 'done'); });
  var rows = list.map(function (q) {
    var m = member(q.user), done = q.status === 'done';
    return '<div class="iq' + (done ? ' done' : '') + '"><div class="iqm"><div class="iqh"><span class="tag">' + esc(q.kind) + '</span><span class="iqw">' + (m ? av(q.user) + esc(m.name) : '退部した部員') + '</span><span class="muted num">' + esc(q.at) + '</span><span class="sp"></span>' +
      '<button class="ib" data-iq="del" data-id="' + q.id + '" aria-label="削除" title="削除">' + ic('x') + '</button></div>' +
      '<div class="iqb">' + esc(q.body) + '</div></div><div class="iqs">' +
      (done ? '<div class="iqr">' + (q.reply ? '<span class="muted">返信</span><span class="iqrt">' + esc(q.reply) + '</span>' : '<span class="muted iqrt">返信なしで対応済み</span>') + '<button class="btn sm ghost" data-iq="reopen" data-id="' + q.id + '">未対応に戻す</button></div>'
        : '<div class="iqf"><textarea class="input" rows="2" data-iqr="' + q.id + '" aria-label="返信"></textarea><div class="iqa"><button class="btn sm" data-iq="done" data-id="' + q.id + '">返信せずに完了</button><button class="btn sm primary" data-iq="reply" data-id="' + q.id + '">返信して完了</button></div></div>') + '</div></div>';
  }).join('');
  return '<div class="iql">' + (rows || '<div class="empty">お問い合わせはまだありません</div>') + '</div>';
}

// ---------- メンバー：役職をその場で変える ----------
function viewPerms() {
  if (!S.mtab) S.mtab = 'all';
  var ops = S.members.filter(isOps), pl = S.members.filter(function (m) { return !isOps(m); });
  var list = S.mtab === 'ops' ? ops : S.mtab === 'pl' ? pl : S.members, q = (UI.mq || '').trim();
  if (q) list = list.filter(function (m) { return (m.name + ' ' + m.grade + ' ' + (m.unit || '') + ' ' + (m.roles || []).join(' ')).indexOf(q) >= 0; });
  var rows = list.map(function (m) {
    var js = joined(m.id), self = m.id === me().id;
    return '<tr><td><button class="mname" data-act="modal" data-m="member" data-id="' + m.id + '">' + av(m.id, 'lg') + '<span class="cell2"><span style="font-weight:500">' + esc(m.name) + '</span><span class="s">' + esc(m.grade) + '</span></span></button></td>' +
      '<td><select class="cell mpost" data-act="post" data-m="' + m.id + '"' + (self ? ' disabled title="自分の役職は変更できません"' : '') + ' aria-label="' + esc(m.name) + 'の役職">' +
        POSTS.map(function (x) { return '<option value="' + esc(x[0]) + '"' + (x[0] === m.unit ? ' selected' : '') + '>' + esc(postLabel(x[0])) + '</option>'; }).join('') + '</select>' +
        '<div class="s muted" style="font-size:11px">' + (isOps(m) ? permText(m.perms) : (m.roles || []).join('・') || '—') + '</div></td>' +
      '<td class="hide-sm">' + (js.length ? js.map(function (p) { return '<span class="tag" style="background:#fff;box-shadow:inset 0 0 0 1px var(--line)">' + esc(p.name) + '</span>'; }).join(' ') : '<span class="dim">—</span>') + '</td></tr>';
  }).join('');
  return top('メンバー') +
    utabs('mtab', [['all', 'すべて', S.members.length], ['ops', '運営', ops.length], ['pl', 'プレイヤー', pl.length]]) +
    '<div class="tbar"><input id="mq" class="input" type="search" placeholder="名前・学部・役職で検索" value="' + esc(UI.mq || '') + '" style="max-width:280px" aria-label="メンバーを検索"></div>' +
    '<div class="body"><div class="tw"><table><thead><tr><th>名前</th><th>役職・ロール</th><th class="hide-sm">参加中</th></tr></thead><tbody>' +
    (rows || '<tr><td colspan="3" class="empty">該当するメンバーはいません</td></tr>') + '</tbody></table></div></div>';
}

// ---------- 共通：ドラッグで並べ替え（単元・教材） ----------
var lmv = null;

// ---------- 入力・キー操作 ----------
document.addEventListener('input', function (e) {
  var el = e.target;
  if (el.id === 'mq') { UI.mq = el.value; var pos = el.selectionStart; render(); var m = document.getElementById('mq'); if (m) { m.focus(); m.setSelectionRange(pos, pos); } return; }
});
document.addEventListener('change', function (e) {
  var el = e.target; if (!el.dataset || el.dataset.act !== 'post') return;
  e.stopImmediatePropagation(); var pm = member(el.dataset.m); if (!pm) return;
  snap(); pm.unit = el.value; pm.perms = POSTS.filter(function (x) { return x[0] === el.value; })[0][1].slice(); save(); render();
  toastUndo(pm.name + 'を' + postLabel(el.value) + 'にしました（運営画面：' + permText(pm.perms) + '）');
}, true);
// クリック（既存の処理より先に受ける）
document.addEventListener('click', function (e) {
  var b = e.target.closest && e.target.closest('[data-act]'); if (!b) return;
  var a = b.dataset.act, hit = true;
  switch (a) {
    case 'undoAll': undoNow(); break;
    case 'nState':
      var n = notice(b.dataset.id); if (!n) break; n.state = n.state === 'pub' ? 'draft' : 'pub'; save(); b.setAttribute('aria-checked', n.state === 'pub'); renderChrome(); toast(n.state === 'pub' ? '「' + n.title + '」を公開しました' : '下書きに戻しました'); break;
    case 'nDel': var n2 = notice(b.dataset.id); snap(); S.notices = S.notices.filter(function (x) { return x !== n2; }); save(); render(); toastUndo('「' + n2.title + '」を削除しました'); break;
    case 'oYes': case 'oNo':
      snap(); S.offers.forEach(function (o) {
        if (o.id !== b.dataset.id) return; o.state = a === 'oYes' ? 'ok' : 'no';
        if (a === 'oYes') S.notices.push({ id: uid('n'), type: o.type, title: o.title, host: o.host, due: o.due, url: o.url, memo: o.note, state: 'pub' });
      }); save(); render(); toastUndo(a === 'oYes' ? '告知に掲載しました' : '見送りました'); break;
    case 'pOk': case 'pHide': case 'pShow': case 'pDelNow':
      var p = S.posts.filter(function (x) { return x.id === b.dataset.id; })[0]; if (!p) break; snap();
      if (a === 'pOk') { p.reports = 0; p.reason = ''; } else if (a === 'pHide') p.state = 'hidden'; else if (a === 'pShow') p.state = 'ok'; else p.state = 'deleted';
      save(); render(); toastUndo({ pOk: '問題なしにしました', pHide: '非表示にしました', pShow: '元に戻しました', pDelNow: '削除しました' }[a]); break;
    default: hit = false;
  }
  if (hit) { e.stopImmediatePropagation(); e.preventDefault(); }
}, true);


// ガントの業務名の列幅
var lwd = null;
document.addEventListener('pointerdown', function (e) {
  var h = e.target.closest && e.target.closest('.lwh'); if (!h) return;
  var gg = h.closest('.gg'); e.preventDefault(); h.setPointerCapture(e.pointerId); gg.classList.add('lwon'); document.body.classList.add('lwdrag');
  lwd = { h: h, gg: gg, x0: e.clientX, lw0: +gg.dataset.lw, tw: +gg.dataset.tw, lw: +gg.dataset.lw };
});
document.addEventListener('pointermove', function (e) {
  if (!lwd) return;
  var lw = Math.round(Math.max(150, Math.min(window.innerWidth - 120, lwd.lw0 + e.clientX - lwd.x0))); if (lw === lwd.lw) return; lwd.lw = lw;
  var g = lwd.gg; g.style.width = (lw + lwd.tw) + 'px'; g.dataset.lw = lw;
  g.querySelector('.glines').style.left = lw + 'px';
  g.querySelectorAll('.gr').forEach(function (r) { r.style.gridTemplateColumns = lw + 'px ' + lwd.tw + 'px'; });
});
document.addEventListener('pointerup', function () {
  if (!lwd) return; var d = lwd; lwd = null; d.gg.classList.remove('lwon'); document.body.classList.remove('lwdrag');
  if (window.innerWidth < 760) S.lwN = d.lw; else S.lw = d.lw; save();
});
document.addEventListener('dblclick', function (e) { if (e.target.closest && e.target.closest('.lwh')) { if (window.innerWidth < 760) delete S.lwN; else delete S.lw; save(); render(); } });


function autosize(el) { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px'; }
function autosizeAll() { document.querySelectorAll('textarea.cell.ct').forEach(autosize); }
document.addEventListener('input', function (e) { if (e.target.matches && e.target.matches('textarea.cell.ct')) { e.target.value = e.target.value.replace(/\n/g, ''); autosize(e.target); } });
window.addEventListener('resize', function () { autosizeAll(); clearTimeout(UI._gwt); UI._gwt = setTimeout(function () { var g = document.getElementById('gs'); if (g && Math.abs((UI.gw || 0) - g.clientWidth) > 2) render(); }, 150); });


