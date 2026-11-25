// ---------- ux43 トラックを入れ子（グループ＋単元）で作る。前提は並び方から自動 ----------
var GID = function () { return 'g' + Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36); };
function treeMigrate(t) { // 前提（deps）から段に分けて、同じ段が複数なら「順不同」グループに
  var L = tl(t), by = {}, lv = {}; L.forEach(function (u) { by[u.code] = u; });
  var f = function (c, seen) { if (lv[c] != null) return lv[c]; if (seen[c]) return 0; seen[c] = 1; var ds = (by[c].deps || []).filter(function (d) { return by[d]; }); return lv[c] = ds.length ? 1 + Math.max.apply(null, ds.map(function (d) { return f(d, seen); })) : 0; };
  L.forEach(function (u) { f(u.code, {}); });
  var mx = L.length ? Math.max.apply(null, L.map(function (u) { return lv[u.code]; })) : -1, tree = [], step = 0;
  for (var l = 0; l <= mx; l++) { var us = L.filter(function (u) { return lv[u.code] === l; });
    if (us.length === 1) tree.push({ u: us[0].code });
    else if (us.length > 1) { step++; tree.push({ g: GID(), name: '', order: 'any', items: us.map(function (u) { return { u: u.code }; }) }); } }
  return tree;
}
function treeOf(t) {
  if (!t.tree) t.tree = treeMigrate(t);
  var have = {}, codes = tl(t).map(function (u) { return u.code; });
  (function clean(items) { for (var i = items.length - 1; i >= 0; i--) { var n = items[i];
    if (n.u) { if (codes.indexOf(n.u) < 0 || have[n.u]) items.splice(i, 1); else have[n.u] = 1; }
    else { n.items = n.items || []; clean(n.items); } } })(t.tree);
  codes.forEach(function (c) { if (!have[c]) t.tree.push({ u: c }); });
  return t.tree;
}
// グループの中に追加したときは、そのグループの最後に入れる
// Tab：ひとつ上の単元と同じグループへ（なければ2つをまとめて新しいグループに）／ Shift+Tab：グループから出す ／ Alt+↑↓：入れ替え
// 単元の右クリックに「グループにまとめる／グループから出す」を足す
// 上へ／下へ（右クリック）も入れ子の中で動かす
// トラックの種類（名前で決めず、選ぶ）


// ---------- ux45 プログラム：トラック・イベント・グループの入れ子（部員の「プログラム」タブの並び） ----------
function progOf() {
  if (!S.program || !S.program.tree) {
    var kd = function (t) { return t.kind || (/基礎/.test(t.name) ? 'all' : (/^実務/.test(t.name) || /Innovator/.test(t.name) ? 'opt' : 'choose')); };
    var tr = [], roles = [];
    S.tracks.forEach(function (t) { var k = kd(t); if (k === 'all') tr.push({ k: 't', id: t.id }); else if (k === 'choose') roles.push({ k: 't', id: t.id }); });
    tr.push({ k: 'e', id: GID(), name: 'LUNA', from: '', to: '', todo: '', link: '' });
    if (roles.length) tr.push({ k: 'g', id: GID(), name: 'ロールトラック', order: 'one', items: roles });
    tr.push({ k: 'e', id: GID(), name: 'MIRA', from: '', to: '', todo: '', link: '' }, { k: 'e', id: GID(), name: 'NOVA', from: '', to: '', todo: '', link: '' });
    S.program = { tree: tr };
  }
  var ids = {}; S.tracks.forEach(function (t) { ids[t.id] = 1; }); var seen = {};
  (function clean(a) { for (var i = a.length - 1; i >= 0; i--) { var n = a[i]; if (n.k === 't' && (!ids[n.id] || seen[n.id])) a.splice(i, 1); else if (n.k === 't') seen[n.id] = 1; else if (n.k === 'g') clean(n.items = n.items || []); } })(S.program.tree);
  return S.program.tree;
}
// イベントを選んでいるときは、中央にイベントの編集
// 新しいトラックはプログラムの最後に入れる
// 並べ替え・まとめる・出す（右クリック／Alt+↑↓／Tab・Shift+Tab）
// トラックの種類の選択はやめる（プログラムでの位置で決まる）

// ---------- ux46 教材＝業務と同じツリー。並びがそのまま部員のプログラム。鍵＝上が済むまで開かない ----------
 // 単元の前提はもう使わない（鍵で決める）
var PI2 = {
  f: '<svg class="fi" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6.5A1.5 1.5 0 0 1 4.5 5H9l2 2h8.5A1.5 1.5 0 0 1 21 8.5v9a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 17.5z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/></svg>',
  u: '<svg class="fi" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3h8l4 4v14H6z M14 3v4h4" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/></svg>',
  e: '<svg class="fi" viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="5" width="16" height="15" rx="2" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M4 10h16M9 3v4M15 3v4" fill="none" stroke="currentColor" stroke-width="1.7"/></svg>',
  lock: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>',
  chev: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>'
};
function p2() {
  if (!S.program) S.program = {};
  if (!S.program.v2) { var mv = p2Migrate(); S.program.v2 = mv; setTimeout(save, 0); }
  var T = S.program.v2, out = T.filter(function (n) { return n.out; })[0];
  if (!out) { out = { id: 'out', k: 'f', name: 'プログラム外', out: true, items: [] }; T.push(out); }
  if (T[T.length - 1] !== out) { T.splice(T.indexOf(out), 1); T.push(out); }
  // ツリーにない単元・トラックは「プログラム外」へ／なくなった単元は消す
  var have = {}; p2Walk(T, function (n) { if (n.k === 'u') have[n.t + ':' + n.c] = 1; if (n.k === 'f' && n.t) have['T:' + n.t] = 1; });
  var tids = {}; S.tracks.forEach(function (t) { tids[t.id] = t; });
  p2Walk(T, function (n, arr) { if (n.k === 'u' && n.t && !(tids[n.t] && unitIdx(tids[n.t], n.c) >= 0)) n._dead = 1; });
  (function rm(a) { for (var i = a.length - 1; i >= 0; i--) { if (a[i]._dead) a.splice(i, 1); else if (a[i].items) rm(a[i].items); } })(T);
  S.tracks.forEach(function (t) {
    var miss = tl(t).filter(function (u) { return u.title && !have[t.id + ':' + u.code]; });
    if (!miss.length) return;
    var f = have['T:' + t.id] ? p2Find(function (n) { return n.k === 'f' && n.t === t.id; }).n : null;
    if (!f) { f = { id: GID(), k: 'f', name: t.name, t: t.id, items: [] }; out.items.push(f); have['T:' + t.id] = 1; }
    miss.forEach(function (u) { f.items.push({ id: GID(), k: 'u', t: t.id, c: u.code }); });
  });
  if (!UI._evs) { UI._evs = 1; evSync(); UI._evs = 0; if (UI._evNew) { UI._evNew = 0; setTimeout(save, 0); } }
  return T;
}
function p2Walk(a, fn, par) { a.forEach(function (n) { fn(n, a, par); if (n.items) p2Walk(n.items, fn, n); }); }
function p2Find(pred, a, par) { a = a || (S.program && S.program.v2) || p2(); for (var i = 0; i < a.length; i++) { if (pred(a[i])) return { arr: a, i: i, n: a[i], parent: par || null }; if (a[i].items) { var r = p2Find(pred, a[i].items, a[i]); if (r) return r; } } return null; }
function p2Get(id) { return id ? p2Find(function (n) { return n.id === id; }) : null; }
function p2Migrate() { // 前の形（プログラム＋トラックの入れ子）から作る
  var T = [], used = {}, old = (S.program && S.program.tree) || (typeof progOf === 'function' ? progOf() : []);
  var trk = function (id) { return S.tracks.filter(function (x) { return x.id === id; })[0]; };
  var fromTrackTree = function (t, items, seq) { var out = []; items.forEach(function (n, i) { var lock = seq && i > 0;
    if (n.u) { out.push({ id: GID(), k: 'u', t: t.id, c: n.u, lock: lock }); return; }
    var kids = fromTrackTree(t, n.items || [], n.order !== 'any');
    if (n.name) { out.push({ id: GID(), k: 'f', name: n.name, lock: lock, items: kids }); return; }
    if (kids[0]) kids[0].lock = lock; out.push.apply(out, kids); }); return out; };
  var conv = function (n) {
    if (n.k === 't') { var t = trk(n.id); if (!t) return null; used[t.id] = 1; return { id: GID(), k: 'f', name: t.name, t: t.id, items: fromTrackTree(t, treeOf(t), true) }; }
    if (n.k === 'e') return { id: n.id || GID(), k: 'e', name: n.name || 'イベント', from: n.from || '', to: n.to || '', todo: n.todo || '', link: n.link || '' };
    return { id: n.id || GID(), k: 'f', name: n.name || 'フォルダ', items: (n.items || []).map(conv).filter(Boolean) };
  };
  old.forEach(function (n) { var c = conv(n); if (c) T.push(c); });
  var out = { id: 'out', k: 'f', name: 'プログラム外', out: true, items: [] };
  S.tracks.forEach(function (t) { if (!used[t.id]) out.items.push({ id: GID(), k: 'f', name: t.name, t: t.id, items: fromTrackTree(t, treeOf(t), false) }); });
  T.push(out); return T;
}
function p2TrackOf(id) { // 置き場所のいちばん近いトラック付きフォルダ。なければ作る
  var f = p2Get(id); if (!f) return null;
  var chain = [], cur = f; while (cur) { chain.push(cur.n); cur = cur.parent ? p2Get(cur.parent.id) : null; }
  for (var i = 0; i < chain.length; i++) if (chain[i].k === 'f' && chain[i].t && S.tracks.some(function (x) { return x.id === chain[i].t; })) return chain[i].t;
  var host = chain.filter(function (n) { return n.k === 'f' && !n.out; })[0] || null;
  var t = { id: 'T' + Date.now().toString(36) + Math.floor(Math.random() * 100), name: host ? host.name : 'プログラム', owner: me().name, status: 'pub', start: '', goal: '', updated: nowLabel() + '　' + me().name, text: '', units: {}, list: [] };
  S.tracks.push(t); if (host) host.t = t.id; return t.id;
}
function p2Track(id) { return S.tracks.filter(function (x) { return x.id === id; })[0]; }
function p2Unit(n) { var t = p2Track(n.t); return t ? tl(t)[unitIdx(t, n.c)] : null; }
function p2Name(n) { if (n.k === 'u') { var u = p2Unit(n); return u ? u.title : ''; } return n.name || ''; }
function p2Leaves(n) { var c = 0; if (n.k !== 'f') return 1; (n.items || []).forEach(function (x) { c += p2Leaves(x); }); return c; }
function p2Save() { S.tracks.forEach(function (t) { t.status = 'pub'; }); S.program.updated = Date.now(); save(); render(); }
function p2Sync(n) { // 単元を別のトラックのフォルダへ動かしたら、単元のデータも移す
  if (n.k === 'u') { var to = p2TrackOf(n.id); if (to && to !== n.t) { var a = p2Track(n.t), b = p2Track(to), i = a ? unitIdx(a, n.c) : -1; if (a && b && i >= 0) {
    var u = tl(a).splice(i, 1)[0], code = unitIdx(b, u.code) >= 0 ? nextCode(b) : u.code; if (a.units[u.code]) { b.units[code] = a.units[u.code]; delete a.units[u.code]; }
    u.code = code; u.deps = []; tl(b).push(u); serialize(a); serialize(b); n.t = to; n.c = code; } } }
  if (n.items) n.items.forEach(p2Sync);
}
// ---- 行 ----
function p2Rows(a, d) {
  return a.map(function (n) {
    var on = UI.psel === n.id, open = n.k === 'f' && n.open !== false, nm = p2Name(n);
    var name = UI.pren === n.id ? '<input class="p2ren" data-p2ren="' + n.id + '" value="' + esc(nm) + '" aria-label="名前" autocomplete="off">' : '<span class="p2n">' + (esc(nm) || '<i class="dim">名前なし</i>') + '</span>';
    var meta = n.k === 'u' ? '<span class="p2m num">' + esc(n.c) + '</span>' : (n.k === 'e' ? '<span class="p2m num">' + (n.from ? esc(n.from.slice(5).replace('-', '.')) : '') + ((S.joins || {})['pe:' + n.id] ? ' · ' + S.joins['pe:' + n.id] + '人' : '') + '</span>' : (n.k === 'f' ? '<span class="p2m num">' + p2Leaves(n) + '</span>' : ''));
    return '<div class="p2r' + (on ? ' on' : '') + (n.out ? ' out' : '') + '" data-p2="' + n.id + '" style="--d:' + d + '" draggable="' + (!n.out) + '" tabindex="' + (on || (!UI.psel && d === 0 && a.indexOf(n) === 0) ? 0 : -1) + '" role="treeitem" aria-selected="' + on + '"' + (n.k === 'f' ? ' aria-expanded="' + open + '"' : '') + '>' +
      (n.k === 'f' ? '<button class="p2c" data-p2a="tog" tabindex="-1" aria-label="' + (open ? '畳む' : '開く') + '" style="transform:rotate(' + (open ? 90 : 0) + 'deg)">' + PI2.chev + '</button>' : '<span class="p2c"></span>') +
      PI2[n.k] + name + meta +
      (n.out ? '' : '<button class="p2l' + (n.lock ? ' on' : '') + '" data-p2a="lock" tabindex="-1" aria-label="' + (n.lock ? '鍵を外す' : '鍵をかける') + '" title="' + (n.lock ? '順番に進める（クリックで外す）' : '順番に進める') + '">' + PI2.lock + '</button>') + '<button class="rmore" type="button" tabindex="-1" aria-label="その他" title="その他">' + ic('more') + '</button>' + '</div>' +
      (open ? p2Rows(n.items || [], d + 1) : '');
  }).join('');
}
// ---- 中央 ----
// その場で保存する欄：書き終えたら（変更が確定したら）そっと「保存しました」
function savedNote() { setTimeout(function () { var t = document.getElementById('toast'); if (t && t.hidden) toast('保存しました'); }, 0); }
document.addEventListener('change', function (e) {
  var el = e.target; if (!el.closest || el.type === 'checkbox' || el.type === 'radio') return;
  if (el.closest('.p2ed') || el.closest('.fdoc') || el.matches('.cell[data-c], .gin')) savedNote();
});
document.addEventListener('focusout', function (e) {
  var el = e.target; if (el.classList && (el.classList.contains('ied') || el.id === 'fdoc') && el.isContentEditable) savedNote();
});
// 設定の行：名前と短い説明、右にスイッチ
function optRow(attr, on, title, sub, dis) { return '<label class="opt"><span class="ot"><b>' + title + '</b>' + (sub ? '<small>' + sub + '</small>' : '') + '</span><input type="checkbox" class="tsw" ' + attr + (on ? ' checked' : '') + (dis ? ' disabled' : '') + '></label>'; }
var LOCK_T = '順番に進める', LOCK_SUB = '前が終わると開く';
function p2Crumb(id) { var out = [], f = p2Get(id); while (f && f.parent) { out.unshift(f.parent); f = p2Get(f.parent.id); } return out; }
function p2Editor() {
  var f = p2Get(UI.psel); if (!f) return '<div class="p2empty">左のツリーから選ぶか、右クリックで作成</div>';
  var n = f.n; if (n.k === 'e') return p2EventEditor(n);
  var crumb = p2Crumb(n.id).map(function (x) { return '<button data-p2go="' + x.id + '">' + esc(x.name) + '</button>'; }).join('<span>/</span>');
  var lock = n.out ? '' : '<div class="opts">' + optRow('data-p2f="lock"', n.lock, LOCK_T, LOCK_SUB) + '</div>';
  var head = '<div class="p2crumb">' + (crumb || '<span>プログラム</span>') + '</div>';
  if (n.k === 'f') {
    var kids = (n.items || []).map(function (x) { return '<button class="p2kid" data-p2go="' + x.id + '">' + PI2[x.k] + '<span class="p2n">' + (esc(p2Name(x)) || '<i class="dim">名前なし</i>') + '</span>' + (x.lock ? '<span class="p2lk">' + PI2.lock + '</span>' : '') + '</button>'; }).join('');
    return head + '<input class="p2title" data-p2f="name" value="' + esc(n.name) + '" placeholder="フォルダ名" aria-label="フォルダ名" autocomplete="off"' + (n.out ? ' readonly' : '') + '>' + lock +
      '<div class="p2sec"><div class="p2kids">' + (kids || '<div class="p2empty sm">空のフォルダ</div>') + '</div><div class="p2add"><button data-p2a="nf">' + PI2.f + 'フォルダ</button><button data-p2a="nu">' + PI2.u + '単元</button><button data-p2a="ne">' + PI2.e + 'イベント</button></div></div>';
  }
  // 単元
function matThumb(m) {
  var yt = (String(m.url || '').match(/(?:youtube\.com\/watch\?(?:.*&)?v=|youtu\.be\/|youtube\.com\/shorts\/)([\w-]{6,})/) || [])[1];
  var img = m.img || (yt ? 'https://i.ytimg.com/vi/' + yt + '/mqdefault.jpg' : ''), ph = '<span class="p2th">' + esc(m.type || '記事') + '</span>';
  return img ? '<img class="p2th" src="' + esc(img) + '" alt="" referrerpolicy="no-referrer" loading="lazy" onerror="this.outerHTML=' + esc(JSON.stringify(ph)).replace(/"/g, '&quot;') + '">' : ph;
}
  var t = p2Track(n.t), u = p2Unit(n); if (!t || !u) return '';
  var d = unitData(t, u.code);
  setTimeout(function () { (unitData(t, u.code).materials || []).forEach(function (m) { autoTitle(t, m); }); }, 0); // 題名・サムネイルを取りにいく
  var mats = (d.materials || []).map(function (m, i) { return '<div class="p2mat">' + matThumb(m) + '<input class="cell" data-p2m="' + i + '" value="' + esc(m.memo || '') + '" placeholder="' + esc(m.url) + '" aria-label="タイトル" autocomplete="off"><a href="' + esc(m.url) + '" target="_blank" rel="noopener">' + esc(host(m.url)) + '</a><button class="ib" data-p2a="mdel" data-i="' + i + '" aria-label="削除">' + ic('x') + '</button></div>'; }).join('');
  var qh = (d.quiz || []).map(function (q, qi) {
    return '<div class="qz"><div class="qzh"><span class="num">Q' + (qi + 1) + '</span><button class="ib qzx" data-qzdel="' + qi + '" aria-label="問題を削除" title="削除">' + ic('x') + '</button></div>' +
      '<textarea class="input" rows="2" data-qz="' + qi + '" data-qk="q" placeholder="問題" aria-label="問題">' + esc(q.q || '') + '</textarea>' +
      q.c.map(function (o, j) { return '<label class="qzo"><input type="radio" name="qa' + qi + '" data-qz="' + qi + '" data-qk="a" value="' + j + '"' + (q.a === j ? ' checked' : '') + ' aria-label="正解"><input class="input" data-qz="' + qi + '" data-qk="c" data-qj="' + j + '" value="' + esc(o) + '" placeholder="選択肢" aria-label="選択肢 ' + (j + 1) + '" autocomplete="off">' + (q.c.length > 2 ? '<button class="ib qzx" data-qzcdel="' + qi + ':' + j + '" aria-label="選択肢を削除">' + ic('x') + '</button>' : '<span class="qzsp"></span>') + '</label>'; }).join('') +
      (q.c.length < 4 ? '<button class="qzadd sm" data-qzc="' + qi + '">＋ 選択肢</button>' : '') + '</div>';
  }).join('');
  return head + '<div class="p2tr"><input class="p2code num" data-p2f="code" value="' + esc(u.code) + '" aria-label="コード" autocomplete="off"><input class="p2title" data-p2f="title" value="' + esc(u.title) + '" placeholder="単元名" aria-label="単元名" autocomplete="off"></div>' +
    lock + '<div class="p2fld"><span>形式</span><span class="p2tags">' + TAGS.map(function (g) { return '<button class="tgl" data-p2a="tag" data-tag="' + g + '" aria-pressed="' + (u.tags.indexOf(g) >= 0) + '">' + g + '</button>'; }).join('') + '</span></div>' +
    '<label class="p2fld">目標<textarea class="input" data-p2u="goal" rows="2">' + esc(d.goal || '') + '</textarea></label>' +
    '<div class="p2fld"><span>教材</span><div class="p2mats">' + mats + '<input class="input" id="p2url" placeholder="URLを貼り付けて Enter" aria-label="教材のURL" autocomplete="off"></div></div>' +
    '<div class="p2fld"><span>確認問題</span><div class="qzl">' + qh + '<button class="qzadd" data-qzadd="1">＋ 問題</button></div></div>';
}
// 学ぶのイベント＝告知のイベント（予定）そのものを編集する
function p2EventEditor(n) {
  var c = evCal(n.ref); if (!c) return '';
  var crumb = p2Crumb(n.id).map(function (x) { return '<button data-p2go="' + x.id + '">' + esc(x.name) + '</button>'; }).join('<span>/</span>'), ro = !can('notices');
  var inp = function (k, lab, type, ph) { return '<label>' + lab + '<input class="input" ' + (type ? 'type="' + type + '" ' : '') + 'data-ce="' + k + '" value="' + esc(c[k] || '') + '"' + (ph ? ' placeholder="' + ph + '"' : '') + (ro ? ' disabled' : '') + ' autocomplete="off"></label>'; };
  var i = lvNodes().indexOf(n), att = (c.att || []).filter(function (id) { return member(id); }), pubOn = c.state === 'pub';
  var joins = evJoins(c);
  var toggles = '<div class="opts">' +
    optRow('data-p2f="lock"', n.lock, LOCK_T, LOCK_SUB) +
    optRow('data-p2lv="1"', n.lv, 'Level-up event', n.lv ? '出席で Lv' + (i + 1) : '出席でレベルが上がる') + '</div>';
  var stat = '<div class="p2st"><span class="p2pub' + (pubOn ? ' on' : '') + '">' + (pubOn ? '公開中' : '非公開') + '</span>' + (pubOn ? '<span class="p2stn">参加登録 <b class="num">' + joins + '</b> 人</span>' : '') + (ro ? '' : '<button class="btn sm" data-act="evPub" data-id="' + c.id + '">' + (pubOn ? (joins ? '中止する' : '非公開にする') : '部員に公開') + '</button>') + '</div>';
  var chips = att.map(function (id) { return '<span class="attc">' + av(id) + esc(member(id).name) + '</span>'; }).join('');
  var attend = '<div class="p2box">' + stat + '<div class="p2st"><span class="p2stn">出席 <b class="num">' + att.length + '</b> 人</span>' + (ro ? '' : '<button class="btn sm" data-attopen="' + c.id + '">' + (att.length ? '出席を変更' : '出席を付ける') + '</button>') + '</div>' + (chips ? '<div class="attl">' + chips + '</div>' : '') + '</div>';
  return '<div class="p2crumb">' + (crumb || '<span>プログラム</span>') + '</div>' +
    '<input class="p2title" data-ce="title" value="' + esc(c.title) + '" placeholder="イベント名" aria-label="イベント名" autocomplete="off"' + (ro ? ' disabled' : '') + '>' +
    '<div class="p2grid3">' + inp('date', '開始日', 'date') + inp('to', '終了日', 'date') + inp('time', '時間', 'time') + '</div>' +
    '<div class="p2grid">' + inp('place', '場所') + inp('link', 'リンク', '', 'https://') + '</div>' +
    '<label class="p2fld">部員がやること・説明<textarea class="input" data-ce="memo" rows="3"' + (ro ? ' disabled' : '') + '>' + esc(c.memo || '') + '</textarea></label>' +
    toggles + attend;
}
function viewTracks () {
  p2(); if (UI.psel && !p2Get(UI.psel)) UI.psel = null;
  var slot = P2UI.noPv ? '<button class="p2pvopen" data-p2ui="pv" title="部員の画面を開く">' + CLL + '<span>部員の画面</span></button>' : '<aside class="p2pv slot" id="p2pvslot" aria-label="部員の画面"></aside>'; // iframe は描画のたびに作り直さず、上に重ねる
  return top('教材') + '<div class="wk p2wk' + (P2UI.noTree ? ' notree' : '') + (UI.psel ? ' has' : '') + '"><aside class="p2tree" role="tree" aria-label="プログラム"><div class="p2bar"><span>プログラム</span><span class="p2tb"><button class="ib p2fold" data-p2ui="tree" title="ツリーを畳む" aria-label="ツリーを畳む">' + CLL + '</button><button class="ib" data-p2a="nf" title="フォルダを追加" aria-label="フォルダを追加">' + PI2.f + '</button><button class="ib" data-p2a="nu" title="単元を追加" aria-label="単元を追加">' + PI2.u + '</button><button class="ib" data-p2a="ne" title="イベントを追加" aria-label="イベントを追加">' + PI2.e + '</button></span></div>' +
    '<div class="p2list">' + p2Rows(p2(), 0) + '</div></aside><main class="p2main">' + (P2UI.noTree ? '<button class="p2treeopen" data-p2ui="tree">' + CLR + 'プログラム</button>' : '') + '<button class="p2back" data-p2go="">' + ic('back') + 'ツリー</button><div class="p2cols' + (P2UI.noPv ? ' nopv' : '') + '"><div class="p2ed">' + p2Editor() + '</div>' + slot + '</div></main></div>';
}
// ---- 作る・消す・動かす ----
function p2Target() { // 新しく作る場所：選んでいるのがフォルダならその中、ファイルならその後ろ
  var f = p2Get(UI.psel); if (!f) { var T = p2(); return { arr: T, at: T.length - 1, par: null }; }
  if (f.n.k === 'f' && (f.n.open !== false || f.n.out)) { f.n.open = true; return { arr: f.n.items, at: f.n.items.length, par: f.n }; }
  return { arr: f.arr, at: f.i + 1, par: f.parent };
}
function p2New(k, where) {
  snap(); var w = where || p2Target(), n;
  if (k === 'e') return evPickAsk('prog', where || p2Target());
  if (k === 'f') n = { id: GID(), k: 'f', name: '新しいフォルダ', items: [] };
  if (k === 'u') n = { id: GID(), k: 'u', t: '', c: '' };
  w.arr.splice(w.at, 0, n);
  if (k === 'u') { var tid = p2TrackOf(n.id), t = p2Track(tid), u = { code: nextCode(t), title: '新しい単元', tags: [], deps: [] }; tl(t).push(u); serialize(t); n.t = tid; n.c = u.code; }
  UI.psel = n.id; UI.pren = n.id; p2Save();
}
function p2Del(id) {
  var f = p2Get(id); if (!f || f.n.out) return; snap();
  if (f.n.k === 'e') { f.arr.splice(f.i, 1); if (UI.psel === id) UI.psel = null; p2Save(); toastUndo('「' + (f.n.name || 'イベント') + '」をプログラムから外しました（告知のイベントには残っています）'); return; }
  p2Walk([f.n], function (x) { if (x.k === 'u') { var t = p2Track(x.t), i = t ? unitIdx(t, x.c) : -1; if (i >= 0) { tl(t).splice(i, 1); delete t.units[x.c]; serialize(t); } } if (x.k === 'f' && x.t) { var stillUsed = false; S.tracks = S.tracks.filter(function (t) { return t.id !== x.t || tl(t).length; }); } });
  f.arr.splice(f.i, 1); if (UI.psel === id) UI.psel = (f.arr[f.i] || f.arr[f.i - 1] || f.parent || {}).id || null;
  p2Save(); toastUndo('「' + (p2Name(f.n) || '項目') + '」を削除しました');
}
function p2Inside(a, b) { var r = false; p2Walk([a], function (x) { if (x === b) r = true; }); return r; }
function p2Move(id, toArr, at) { var f = p2Get(id); if (!f || f.n.out) return false; var T = p2(); if (toArr === T && at > T.length - 1) at = T.length - 1;
  if (f.arr === toArr && at > f.i) at--; f.arr.splice(f.i, 1); toArr.splice(at, 0, f.n); p2Sync(f.n); return true; }
function p2Indent(id, out) { var f = p2Get(id); if (!f || f.n.out) return false;
  if (!out) { var prev = f.arr[f.i - 1]; if (!prev || prev.k !== 'f') return false; prev.open = true; return p2Move(id, prev.items, prev.items.length); }
  if (!f.parent) return false; var pf = p2Get(f.parent.id); return p2Move(id, pf.arr, pf.i + 1); }
function p2Step(id, dir) { var f = p2Get(id); if (!f) return false; var j = f.i + dir; if (j < 0 || j >= f.arr.length || f.arr[j].out) return false; var x = f.arr[j]; f.arr[j] = f.n; f.arr[f.i] = x; return true; }
function p2Lock(id) { var f = p2Get(id); if (!f || f.n.out) return; snap(); f.n.lock = !f.n.lock; p2Save(); toast(f.n.lock ? '鍵をかけました：上の項目が済むまで開きません' : '鍵を外しました'); }
function p2Focus(id) { setTimeout(function () { var r = document.querySelector('.p2r[data-p2="' + id + '"]'); if (r) { r.focus(); r.scrollIntoView({ block: 'nearest' }); } var i = document.querySelector('.p2ren'); if (i) { i.focus(); i.select(); } }, 0); }
// ---- メニュー ----
function p2Menu(id, x, y) {
  var f = p2Get(id), n = f && f.n, it = [];
  if (!n) { it = [['新しいフォルダ', function () { UI.psel = null; p2New('f'); p2Focus(UI.psel); }], ['新しい単元', function () { UI.psel = null; p2New('u'); p2Focus(UI.psel); }], ['新しいイベント', function () { UI.psel = null; p2New('e'); p2Focus(UI.psel); }], 'sep',
    ['すべて開く', function () { p2Walk(p2(), function (z) { if (z.k === 'f') z.open = true; }); save(); render(); }], ['すべて畳む', function () { p2Walk(p2(), function (z) { if (z.k === 'f') z.open = false; }); save(); render(); }]]; openMenu('プログラム', it, x, y); return; }
  UI.psel = id;
  if (n.k === 'f') it.push(['中に新しいフォルダ', function () { n.open = true; p2New('f', { arr: n.items, at: n.items.length }); p2Focus(UI.psel); }], ['中に新しい単元', function () { n.open = true; p2New('u', { arr: n.items, at: n.items.length }); p2Focus(UI.psel); }], ['中に新しいイベント', function () { n.open = true; p2New('e', { arr: n.items, at: n.items.length }); p2Focus(UI.psel); }], 'sep');
  if (!n.out) {
    it.push(['名前を変更（F2）', function () { UI.pren = id; render(); p2Focus(id); }], [(n.lock ? '順番に進めるをやめる' : '順番に進める'), function () { p2Lock(id); }], 'sep');
    it.push(['上へ（Alt+↑）', function () { snap(); if (p2Step(id, -1)) p2Save(); }, false, f.i === 0 ? '先頭' : ''], ['下へ（Alt+↓）', function () { snap(); if (p2Step(id, 1)) p2Save(); }, false, f.i >= f.arr.length - 1 || f.arr[f.i + 1].out ? '末尾' : '']);
    it.push(['上のフォルダに入れる（Tab）', function () { snap(); if (p2Indent(id)) p2Save(); }, false, f.arr[f.i - 1] && f.arr[f.i - 1].k === 'f' ? '' : '上がフォルダでない']);
    if (f.parent) it.push(['フォルダから出す（Shift+Tab）', function () { snap(); if (p2Indent(id, true)) p2Save(); }]);
    var outF = p2().filter(function (z) { return z.out; })[0];
    if (f.parent !== outF) it.push(['プログラム外へ', function () { snap(); p2Move(id, outF.items, outF.items.length); p2Save(); }]);
    else it.push(['プログラムに戻す', function () { snap(); p2Move(id, p2(), p2().length - 1); p2Save(); }]);
    it.push('sep', ['削除（Delete）', function () { p2Del(id); }, true]);
  } else it.push(['中をすべて開く', function () { n.open = true; p2Walk(n.items, function (z) { if (z.k === 'f') z.open = true; }); save(); render(); }]);
  render(); openMenu(p2Name(n) || '項目', it, x, y);
}
document.addEventListener('contextmenu', function (e) {
  if (S.view !== 'tracks' || !e.target.closest) return;
  var r = e.target.closest('.p2r'), inTree = e.target.closest('.p2tree'), inMain = e.target.closest('.p2main');
  if (!r && !inTree && !inMain) return;
  if (e.target.closest('input, textarea, select, a[href]') && !e.target.closest('.p2r')) return;
  e.preventDefault(); e.stopImmediatePropagation();
  if (r) return p2Menu(r.dataset.p2, e.clientX, e.clientY);
  var k = e.target.closest('.p2kid'); if (k) return p2Menu(k.dataset.p2go, e.clientX, e.clientY);
  if (inMain && UI.psel) return p2Menu(UI.psel, e.clientX, e.clientY);
  p2Menu(null, e.clientX, e.clientY);
}, true);
// ---- クリック ----
document.addEventListener('click', function (e) {
  if (S.view !== 'tracks' || !e.target.closest) return;
  var a = e.target.closest('[data-p2a]'), go = e.target.closest('[data-p2go]'), r = e.target.closest('.p2r');
  if (!a && !go && !r) return;
  if (UI.p2drag) { UI.p2drag = null; return; }
  e.preventDefault(); e.stopImmediatePropagation();
  if (go) { UI.psel = go.dataset.p2go || null; UI.pren = null; var g = p2Get(UI.psel); if (g) { var p = g.parent; while (p) { p.open = true; var pp = p2Get(p.id); p = pp && pp.parent; } } p2Reveal(UI.psel); render(); if (UI.psel) p2Focus(UI.psel); return; }
  if (a) { var act = a.dataset.p2a, id = r ? r.dataset.p2 : UI.psel;
    if (act === 'tog') { var f = p2Get(id); f.n.open = f.n.open === false; save(); render(); p2Focus(id); return; }
    if (act === 'lock') return p2Lock(id);
    if (act === 'nf' || act === 'nu' || act === 'ne') { p2New(act[1]); p2Focus(UI.psel); return; }
    var n = (p2Get(UI.psel) || {}).n; if (!n) return; var t = p2Track(n.t), u = p2Unit(n);
    if (act === 'tag' && u) { snap(); var g2 = a.dataset.tag, k = u.tags.indexOf(g2); if (k >= 0) u.tags.splice(k, 1); else u.tags.push(g2); serialize(t); touch(t); p2Save(); return; }
    if (act === 'mdel' && u) { snap(); unitData(t, u.code).materials.splice(+a.dataset.i, 1); touch(t); p2Save(); toastUndo('教材を削除しました'); }
    return;
  }
  if (r) { var id2 = r.dataset.p2; if (UI.psel === id2 && !e.detail) return; UI.psel = id2; if (UI.pren !== id2) UI.pren = null; p2Reveal(id2); render(); p2Focus(id2); }
}, true);
document.addEventListener('dblclick', function (e) { var r = e.target.closest && e.target.closest('.p2r'); if (!r || r.classList.contains('out') || e.target.closest('[data-p2a]')) return; UI.pren = r.dataset.p2; render(); p2Focus(r.dataset.p2); });
// フォルダを選んだら、そのフォルダの1つ下の段までだけ開く（ほかの枝は畳む）。見た目だけなので保存しない
function p2Reveal(id) {
  var f = p2Get(id); if (!f || f.n.k !== 'f') return;
  var keep = {}; keep[f.n.id] = 1; for (var p = f.parent; p; ) { keep[p.id] = 1; var pp = p2Get(p.id); p = pp && pp.parent; }
  p2Walk(p2(), function (z) { if (z.k === 'f') z.open = !!keep[z.id]; });
}
// ---- 入力 ----
function p2Commit(el) { var f = p2Get(el.dataset.p2ren); UI.pren = null; if (!f) return render(); var v = el.value.trim(); if (v) { snap(); p2SetName(f.n, v); } p2Save(); p2Focus(f.n.id); }
function p2SetName(n, v) { if (n.k === 'e') { var c = evCal(n.ref); if (c) c.title = v; n.name = v; return; } if (n.k === 'u') { var t = p2Track(n.t), u = p2Unit(n); if (u) { u.title = v; serialize(t); touch(t); } } else { n.name = v; if (n.k === 'f' && n.t) { var t2 = p2Track(n.t); if (t2) t2.name = v; } } }
document.addEventListener('input', function (e) {
  var el = e.target; if (!el.dataset || S.view !== 'tracks') return; var f = p2Get(UI.psel); if (!f) return; var n = f.n;
  if (el.dataset.p2f) { var k = el.dataset.p2f;
    if (k === 'lock') return;
    if (k === 'name' || k === 'title') { p2SetName(n, el.value); var row = document.querySelector('.p2r[data-p2="' + n.id + '"] .p2n'); if (row) row.textContent = el.value; S.program.updated = Date.now(); save(); return; }
    if (k === 'code') return;
    n[k] = el.value; S.program.updated = Date.now(); save(); return; }
  if (el.dataset.p2u) { var t = p2Track(n.t), u = p2Unit(n); if (u) { unitData(t, u.code)[el.dataset.p2u] = el.value; touch(t); save(); } return; }
  if (el.dataset.p2m) { var t3 = p2Track(n.t), u3 = p2Unit(n); if (u3) { unitData(t3, u3.code).materials[+el.dataset.p2m].memo = el.value; touch(t3); save(); } }
}, true);
document.addEventListener('change', function (e) {
  var el = e.target; if (!el.dataset || S.view !== 'tracks') return; var f = p2Get(UI.psel); if (!f) return;
  if (el.dataset.p2f === 'lock') { snap(); f.n.lock = el.checked; p2Save(); return; }
  if (el.dataset.p2f === 'code') { var t = p2Track(f.n.t), v = el.value.trim(); if (!v || v === f.n.c) return; if (unitIdx(t, v) >= 0) { toast('そのコードはもう使われています'); el.value = f.n.c; return; } snap(); var old = f.n.c; renameUnit(t, old, v); f.n.c = v; p2Save(); }
  if (el.dataset.p2f === 'from' || el.dataset.p2f === 'to') render();
}, true);
document.addEventListener('focusout', function (e) { var el = e.target; if (el.dataset && el.dataset.p2ren && UI.pren === el.dataset.p2ren) setTimeout(function () { if (UI.pren === el.dataset.p2ren) p2Commit(el); }, 0); }, true);
// ---- キーボード ----
document.addEventListener('keydown', function (e) {
  if (S.view !== 'tracks' || !e.target.closest) return;
  var el = e.target;
  if (el.dataset && el.dataset.p2ren) { if (e.key === 'Enter' && !e.isComposing) { e.preventDefault(); p2Commit(el); } else if (e.key === 'Escape') { e.preventDefault(); var id0 = UI.pren; UI.pren = null; render(); p2Focus(id0); } e.stopImmediatePropagation(); return; }
  if (el.id === 'p2url' && e.key === 'Enter' && !e.isComposing) { e.preventDefault(); var url = el.value.trim(); if (!/^https?:\/\//.test(url)) { toast('http から始まるURLを貼り付けてください'); return; } var n = p2Get(UI.psel).n, t = p2Track(n.t); snap(); unitData(t, n.c).materials.push({ url: url, memo: '', type: detectType(url) }); touch(t); p2Save(); setTimeout(function () { var i = document.getElementById('p2url'); if (i) i.focus(); }, 0); return; }
  var r = el.closest('.p2r'); if (!r || el !== r) return; var id = r.dataset.p2, f = p2Get(id), ok = null;
  var rows = Array.prototype.slice.call(document.querySelectorAll('.p2r')), k = rows.indexOf(r);
  var sel = function (x) { if (!x) return; UI.psel = x.dataset.p2; render(); p2Focus(UI.psel); };
  if (e.key === 'ArrowDown' && !e.altKey) { e.preventDefault(); sel(rows[k + 1]); }
  else if (e.key === 'ArrowUp' && !e.altKey) { e.preventDefault(); sel(rows[k - 1]); }
  else if (e.key === 'ArrowRight') { e.preventDefault(); if (f.n.k === 'f' && f.n.open === false) { f.n.open = true; save(); render(); p2Focus(id); } else sel(rows[k + 1]); }
  else if (e.key === 'ArrowLeft') { e.preventDefault(); if (f.n.k === 'f' && f.n.open !== false && f.n.items.length) { f.n.open = false; save(); render(); p2Focus(id); } else if (f.parent) { UI.psel = f.parent.id; render(); p2Focus(UI.psel); } }
  else if ((e.key === 'F2' || e.key === 'Enter') && !f.n.out) { e.preventDefault(); UI.pren = id; render(); p2Focus(id); }
  else if ((e.key === 'Delete' || e.key === 'Backspace') && !f.n.out) { e.preventDefault(); p2Del(id); p2Focus(UI.psel); }
  else if (e.key === 'Tab') { var can = e.shiftKey ? !!f.parent && !f.n.out : (f.arr[f.i - 1] && f.arr[f.i - 1].k === 'f' && !f.n.out); if (!can) return; e.preventDefault(); snap(); ok = p2Indent(id, e.shiftKey); }
  else if (e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) { e.preventDefault(); snap(); ok = p2Step(id, e.key === 'ArrowUp' ? -1 : 1); }
  else if (e.key === 'l' || e.key === 'L') { if (!e.metaKey && !e.ctrlKey) { e.preventDefault(); p2Lock(id); p2Focus(id); } }
  else if ((e.key === 'ContextMenu') || (e.shiftKey && e.key === 'F10')) { e.preventDefault(); var b = r.getBoundingClientRect(); p2Menu(id, b.left + 40, b.bottom); }
  else return;
  e.stopImmediatePropagation(); if (ok) { p2Save(); p2Focus(id); }
}, true);
// ---- ドラッグ：行の上1/4＝前、下1/4＝後ろ、フォルダの真ん中＝中へ ----
function p2Zone(r, ev) { var b = r.getBoundingClientRect(), y = (ev.clientY - b.top) / b.height, n = p2Get(r.dataset.p2).n;
  if (n.out) return y < .35 ? 'before' : 'into';
  if (n.k === 'f') return y < .28 ? 'before' : (y > .72 && (n.open === false || !n.items.length) ? 'after' : 'into');
  return y < .5 ? 'before' : 'after'; }
function p2Clear() { Array.prototype.forEach.call(document.querySelectorAll('.p2r.dz-before,.p2r.dz-after,.p2r.dz-into,.p2r.dz-no'), function (x) { x.classList.remove('dz-before', 'dz-after', 'dz-into', 'dz-no'); }); }
document.addEventListener('dragstart', function (e) { var r = e.target.closest && e.target.closest('.p2r'); if (!r) return; UI.p2drag = r.dataset.p2; e.dataTransfer.effectAllowed = 'move'; try { e.dataTransfer.setData('text/plain', r.dataset.p2); } catch (x) {} setTimeout(function () { r.classList.add('dragging'); }, 0); });
document.addEventListener('dragover', function (e) {
  if (!UI.p2drag) return; var r = e.target.closest && e.target.closest('.p2r'), list = e.target.closest && e.target.closest('.p2list'); if (!r && !list) return;
  e.preventDefault(); p2Clear(); if (!r) return;
  var src = p2Get(UI.p2drag), dst = p2Get(r.dataset.p2), z = p2Zone(r, e);
  var bad = !src || src.n === dst.n || p2Inside(src.n, dst.n) || (dst.n.out && z === 'before' && false);
  r.classList.add(bad ? 'dz-no' : 'dz-' + z); e.dataTransfer.dropEffect = bad ? 'none' : 'move';
});
document.addEventListener('drop', function (e) {
  if (!UI.p2drag) return; var r = e.target.closest && e.target.closest('.p2r'), list = e.target.closest && e.target.closest('.p2list'); if (!r && !list) return;
  e.preventDefault(); var id = UI.p2drag; p2Clear(); var src = p2Get(id); if (!src) return; snap();
  if (!r) { p2Move(id, p2(), p2().length - 1); p2Save(); p2Focus(id); return; }
  var dst = p2Get(r.dataset.p2), z = p2Zone(r, e); if (src.n === dst.n || p2Inside(src.n, dst.n)) return;
  if (z === 'into') { dst.n.open = true; p2Move(id, dst.n.items, dst.n.out ? dst.n.items.length : 0); }
  else { var d2 = p2Get(dst.n.id); p2Move(id, d2.arr, z === 'before' ? d2.i : d2.i + 1); }
  UI.psel = id; p2Save(); p2Focus(id);
});
document.addEventListener('dragend', function () { p2Clear(); var d = document.querySelector('.p2r.dragging'); if (d) d.classList.remove('dragging'); setTimeout(function () { UI.p2drag = null; }, 0); });

