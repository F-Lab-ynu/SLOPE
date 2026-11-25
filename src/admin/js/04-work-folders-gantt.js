// ---------- ux7: 業務＝フォルダー（ファイルアプリ型） ----------
var FOLD = '<svg class="i fi" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>';
var ENTER = '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M10 7l5 5-5 5"/></svg>';
function isFolder(n) { return !!(n && (n.tasks || n.folder || kids(n).length)); }
function leavesOf(n) { var c = kids(n); if (!c.length) return isFolder(n) ? [] : [n]; var r = []; c.forEach(function (x) { r = r.concat(leavesOf(x)); }); return r; }
function allNodes() { var r = []; S.projects.forEach(function (p) { r = r.concat(nodesOf(p)); }); return r; }
function allEvents() { return allNodes().filter(isEvent); }
function evOf(k) { reindex(); var x = IX[k.id] && IX[k.id].par; while (x) { if (isEvent(x)) return x; x = IX[x.id] && IX[x.id].par; } return parentOf(k) || k; }
function myTasks(id) { var r = []; allNodes().forEach(function (k) { if (inTeam(k, id) && (!isDone(k) || k.id === S.justDone)) r.push({ k: k, p: evOf(k) }); }); return r.sort(function (a, b) { return dayOf(a.k.end) - dayOf(b.k.end); }); }
function migrateFolders(st) {
  if (!st || st.fv || !st.projects) return st;
  var by = {};
  st.projects.forEach(function (p) { var d = new Date(dayOf(p.start)), y = d.getUTCMonth() < 3 ? d.getUTCFullYear() - 1 : d.getUTCFullYear(); (by[y] = by[y] || []).push(p); });
  var adm = (st.members || []).filter(function (m) { return m.perms && m.perms.indexOf('all') >= 0; })[0];
  st.projects = Object.keys(by).sort().map(function (y) { return { id: 'fy' + y, name: y + '起業部', kind: 'folder', who: adm ? adm.id : '', leads: adm ? [adm.id] : [], start: y + '-04-01', end: (+y + 1) + '-03-31', tasks: by[y] }; });
  st.fv = 1; st.fcur = 'fy' + (function () { var d = new Date(TODAY); return d.getUTCMonth() < 3 ? d.getUTCFullYear() - 1 : d.getUTCFullYear(); })();
  st.manualOrder = true; return st;
}
if (S) { migrateFolders(S); }

function curFolder() { var f = S.fcur && S.fcur !== 'mine' ? task(S.fcur) : null; if (S.fcur && S.fcur !== 'mine' && !f) S.fcur = ''; return f; }
function ancestors(n) { reindex(); var a = [], x = IX[n.id] && IX[n.id].par; while (x) { a.unshift(x); x = IX[x.id] && IX[x.id].par; } return a; }
function visibleRoots() {
  if (S.fcur === 'mine') return allNodes().filter(function (n) { return inTeam(n, S.me) && !ancestors(n).some(function (a) { return inTeam(a, S.me); }); });
  var f = curFolder();
  return sortList(f, (f ? kids(f) : S.projects).filter(visNode));
}
function addFolder(par, name) {
  if (!par) { var y = new Date(TODAY).getUTCFullYear(); var r = { id: uid('pj'), name: name, kind: 'folder', who: '', leads: [], start: isoOf(TODAY), end: isoOf(TODAY + 90 * DAY), tasks: [] }; S.projects.push(r); return r; }
  var n = newNode(par, name); delete n.done; n.folder = true; n.kids = [];
  if (!par.tasks) { if (!par.kids) par.kids = []; delete par.done; }
  kids(par).push(n); expandTo(par.id); return n;
}
function ftree() {
  var cur = S.fcur || '', curN = curFolder(), anc = curN ? ancestors(curN).map(function (a) { return a.id; }).concat([curN.id]) : [], mine = {};
  if (cur === 'mine') { // 自分の担当：担当しているファイル・リーダーのフォルダーまでの道を開いて、印を付ける
    allNodes().forEach(function (n) {
      if (!(isFolder(n) ? isLead(n, S.me) : n.who === S.me && !n.done)) return;
      mine[n.id] = 1; ancestors(n).forEach(function (a) { if (anc.indexOf(a.id) < 0) anc.push(a.id); });
    });
  }
  UI.fopen = UI.fopen || {};
  var row = function (n, d) {
    if (!visNode(n)) return '';
    var ch = isFolder(n) ? kids(n).filter(visNode) : [];
    var open = UI.fopen[n.id] != null ? UI.fopen[n.id] : anc.indexOf(n.id) >= 0;
    return '<div class="ft' + (cur === n.id ? ' on' : '') + '" style="--d:' + d + '">' +
      (ch.length ? '<button class="ftc" data-act="ftog" data-id="' + n.id + '" aria-expanded="' + open + '" aria-label="開閉"><svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="' + (open ? 'M7 10l5 5 5-5' : 'M10 7l5 5-5 5') + '"/></svg></button>' : '<span class="ftc"></span>') +
      '<button class="ftn' + (mine[n.id] ? ' mine' : '') + '" data-act="fgo" data-id="' + n.id + '"' + (cur === n.id ? ' aria-current="true"' : '') + (mine[n.id] ? ' title="自分の担当"' : '') + '>' + (isFolder(n) ? FOLD : FILE) + '<span>' + esc(ttl(n)) + '</span>' + (isEvent(n) ? '<i class="evd" title="イベント"></i>' : '') + '</button>' + '<button class="rmore" type="button" tabindex="-1" aria-label="その他" title="その他">' + ic('more') + '</button>' + '</div>' +
      (open ? ch.map(function (c) { return row(c, d + 1); }).join('') : '');
  };
  return '<div class="ftbar"><span>フォルダー</span><button class="ib" data-act="ftreeTog" title="畳む" aria-label="フォルダー一覧を畳む"><svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M15 6l-6 6 6 6"/></svg></button></div>' +
    '<button class="ftop' + (cur === 'mine' ? ' on' : '') + '" data-act="fgo" data-id="mine">' + ic('users') + '<span>自分の担当</span></button>' +
    '<button class="ftop' + (!cur ? ' on' : '') + '" data-act="fgo" data-id="">' + FOLD + '<span>すべて</span></button>' +
    '<div class="ftl">' + S.projects.map(function (n) { return row(n, 0); }).join('') + '</div>';
}
function decorateFolders() {
  if (S.view !== 'projects') return;
  var gg = document.querySelector('.gg'), PX = gg ? +gg.dataset.px : 0, LO = gg ? +gg.dataset.lo : 0;
  var X = function (t) { return Math.round(Math.round((t - LO) / DAY) * PX); };
  document.querySelectorAll('.wcard .wr[data-row], .gg .gr[data-row]').forEach(function (row) {
    var n = task(row.dataset.row); if (!n || !isFolder(n) || row.querySelector('.fin')) return;
    row.classList.add('isf');
    var lvb = row.querySelector('.lvb'); if (lvb) lvb.insertAdjacentHTML('afterend', FOLD);
    var btn = '<button class="fin" data-act="fgo" data-id="' + n.id + '" title="このフォルダーを開く" aria-label="開く">' + ENTER + '</button>';
    var ct = row.querySelector('.gl .ct') || row.querySelector('.wtx'); if (ct) ct.insertAdjacentHTML('afterend', btn);
    if (gg && row.classList.contains('gr')) {
      var mx = nodesOf(n).slice(1).reduce(function (m, x) { return Math.max(m, dayOf(x.end)); }, 0);
      if (mx > dayOf(n.end)) { var gt = row.querySelector('.gt'); if (gt) gt.insertAdjacentHTML('beforeend', '<div class="ovr" title="期限超過" style="left:' + X(dayOf(n.end) + DAY) + 'px;width:' + Math.max(PX, X(mx) - X(dayOf(n.end))) + 'px"></div>'); }
    }
  });
}
function dupModal(f) {
  return dlg('フォルダーを複製',
    '<div class="two"><div class="fld"><label for="cpN">名前</label><input id="cpN" class="input" value="' + esc(nextName(ttl(f))) + '"></div><div class="fld"><label for="cpD">開始日</label><input id="cpD" class="input num" type="date" value="' + isoOf(dayOf(f.start) + 364 * DAY) + '"></div></div>' +
    '<div class="muted" style="font-size:12px">中のフォルダーと業務の構成・期間をコピーします。担当者・完了・結果はコピーしません。</div>',
    '<span class="sp"></span><button class="btn" data-act="close">やめる</button><button class="btn primary" data-act="dupGo">複製</button>');
}
document.addEventListener('click', function (e) {
  var b = e.target.closest && e.target.closest('[data-act="fgo"],[data-act="ftog"],[data-act="newF"],[data-act="newT"],[data-act="toFolder"],[data-act="dupF"],[data-act="dupGo"]'); if (!b) return;
  if (e.target.closest('[data-act]') !== b) return;
  e.stopImmediatePropagation(); e.preventDefault();
  var a = b.dataset.act, f = curFolder();
  if (a === 'fgo') { if (b.dataset.id !== (S.fcur || '')) { UI.fhist = UI.fhist || []; UI.fhist.push(S.fcur || ''); } UI.fopen = {}; S.fcur = b.dataset.id; foldBelow(S.fcur); UI.rec = null; UI.sp = null; save(); render(); return; }
  if (a === 'ftog') { UI.fopen = UI.fopen || {}; var o = document.querySelector('[data-act="ftog"][data-id="' + b.dataset.id + '"]'); UI.fopen[b.dataset.id] = !(o && o.getAttribute('aria-expanded') === 'true'); render(); return; }
  if (a === 'newF' || a === 'newT') {
    UI.fm = false; UI.fadd = false; if (!manages(f)) return;
    var n = a === 'newF' ? addFolder(f, '新しいフォルダー') : addUnder(f, '新しいファイル');
    save(); render(); editNew(n);
    return;
  }
  if (a === 'toFolder') { var t = task(b.dataset.id); if (!t) return; t.folder = true; t.kids = t.kids || []; delete t.done; if (t.who) setLeads(t, [t.who]); M = null; save(); render(); toast('フォルダーに変えました'); return; }
  if (a === 'dupF') { UI.dupId = null; if (!f) return; var ov = document.getElementById('cpov'); if (!ov) { ov = document.createElement('div'); ov.id = 'cpov'; document.body.appendChild(ov); } ov.innerHTML = dupModal(f); ov.querySelector('#cpN').focus(); return; }
  if (a === 'dupGo') {
    f = (UI.dupId && task(UI.dupId)) || f;
    var nm = val('cpN').trim(), d = val('cpD'); if (!f || !nm || !d) { toast('名前と開始日を入れてください'); return; }
    var delta = dayOf(d) - dayOf(f.start), par = parentOf(f);
    var c = { id: uid(par ? 'k' : 'pj'), who: '', leads: [], start: d, end: isoOf(dayOf(f.end) + delta), kind: f.kind || 'folder', purpose: f.purpose || '', place: f.place || '', unit: f.unit };
    if (isEvent(f)) { var ce = evNew(nm, d); if (c.end !== d) ce.to = c.end; c.ev = ce.id; }
    if (par) { c.title = nm; c.folder = true; c.kids = cloneKids(f, delta); kids(par).push(c); } else { c.name = nm; c.tasks = cloneKids(f, delta); S.projects.push(c); }
    cloneMark(c);
    closeCopy(); S.fcur = c.id; save(); render(); toast('「' + nm + '」を作りました'); return;
  }
}, true);
function cloneMark(c) { kids(c).forEach(function (k) { if (k.kids && k.kids.length) k.folder = true; cloneMark(k); }); }
function cloneKids(src, delta) {
  return kids(src).map(function (k) {
    var c = { id: uid('k'), title: ttl(k), who: '', start: isoOf(dayOf(k.start) + delta), end: isoOf(dayOf(k.end) + delta), done: false };
    if (isFolder(k)) { c.folder = true; c.kids = cloneKids(k, delta); delete c.done; if (isEvent(k)) { var ce = evNew(c.title, c.start); if (c.end !== c.start) ce.to = c.end; c.kind = 'event'; c.ev = ce.id; } }
    return c;
  });
}
// ---------- ux8: フォルダーはカード、ガントは切り替えて見る ----------
var GRID = '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/></svg>';
var GANTT = '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h8M7 12h10M10 18h10"/></svg>';
function avStack(ids, ls) {
  ls = ls || [];
  return '<span class="avs">' + ids.slice(0, 3).map(function (id) { var m = member(id); return '<span class="av' + (ls.indexOf(id) >= 0 ? ' lead' : '') + '" title="' + esc(m ? m.name : '') + '">' + esc(m ? initials(m.name) : '?') + '</span>'; }).join('') + (ids.length > 3 ? '<span class="more num">+' + (ids.length - 3) + '</span>' : '') + '</span>';
}
document.addEventListener('click', function (e) {
  var b = e.target.closest && e.target.closest('[data-act="fmode"],[data-act="fadd"],[data-act="tdone"]'); if (!b) { if (UI.fadd && !(e.target.closest && e.target.closest('.fadd'))) { UI.fadd = false; render(); } return; }
  e.stopImmediatePropagation(); e.preventDefault();
  var a = b.dataset.act;
  if (a === 'fmode') { S.fmode = b.dataset.v; UI.sp = null; save(); render(); }
  else if (a === 'fadd') { UI.fadd = true; render(); }
  else if (a === 'tdone') { var n = task(b.dataset.id); if (!n || !(editSelf(n) || n.who === S.me)) return; n.done = !n.done; if (n.done) reportUp && reportUp(n); save(); render(); }
}, true);
document.addEventListener('keydown', function (e) { var c = e.target.classList && e.target.classList.contains('fcard') && e.target; if (c && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); c.click(); } });

// ---------- ux9: カードをその場で編集・並べ替え・メモ ----------
var SORTS = [['manual', '手動'], ['due', '期限が近い順'], ['start', '開始が早い順'], ['name', '名前順'], ['open', '未完了を先に']];
var SORTI = '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4v16M4 17l3 3 3-3M17 20V4M14 7l3-3 3 3"/></svg>';
function sortOf(f) { return (UI.sorts || {})[f ? f.id : '_'] || 'manual'; }
function sortList(f, list) {
  var k = sortOf(f), a = list.slice();
  if (k === 'due') a.sort(function (x, y) { return dayOf(x.end) - dayOf(y.end); });
  else if (k === 'start') a.sort(function (x, y) { return dayOf(x.start) - dayOf(y.start); });
  else if (k === 'name') a.sort(function (x, y) { return ttl(x).localeCompare(ttl(y), 'ja'); });
  else if (k === 'open') a.sort(function (x, y) { return (isDone(x) ? 1 : 0) - (isDone(y) ? 1 : 0); });
  return a;
}
function fcard(n) {
  var ed = editSelf(n), nm = '<b class="fcn' + (ed ? ' ied' : '') + '"' + (ed ? ' data-act="ied" data-f="t" data-id="' + n.id + '" title="タップで名前を編集"' : '') + '>' + esc(ttl(n)) + '</b>';
  if (isFolder(n)) {
    var g = progress(n), mx = nodesOf(n).slice(1).reduce(function (m, x) { return Math.max(m, dayOf(x.end)); }, 0), over = mx > dayOf(n.end);
    var sub = kids(n).filter(visNode), nf = sub.filter(isFolder).length, nt = sub.length - nf;
    return '<div class="fcard isfc' + (isDone(n) && g.n ? ' dn' : '') + '" data-act="fgo" data-id="' + n.id + '" tabindex="0" role="button" aria-label="' + esc(ttl(n)) + 'を開く">' +
      '<div class="fct">' + FOLD + (isEvent(n) ? '<i class="evd" title="イベント"></i>' : '') + '<span class="sp"></span>' + (g.late || over ? '<span class="fwarn" title="' + (g.late ? '遅れ ' + g.late : '期限超過') + '">!</span>' : '') + '</div>' +
      nm +
      '<div class="fcm num">' + shortDate(n.start) + ' – ' + shortDate(n.end) + '</div>' +
      (n.memo ? '<div class="fmemo sm">' + esc(n.memo) + '</div>' : '') +
      '<div class="fcb"><span class="b"><i style="width:' + (g.n ? Math.round(g.d / g.n * 100) : 0) + '%"></i></span><span class="num">' + g.d + '/' + g.n + '</span></div>' +
      '<div class="fcf">' + teamBtn(n, canAssign(n) ? '' : ' disabled', true) + '<span class="fcc">' + (nf ? FOLD + nf : '') + (nt ? '<span class="tci"></span>' + nt : '') + '</span></div>' +
      '<button class="fcx rmore" type="button" aria-label="その他" title="その他">' + ic('more') + '</button>' +
    '</div>';
  }
  var can = ed || n.who === S.me, lt = late(n) && !n.done;
  return '<div class="fcard istc' + (n.done ? ' dn' : '') + (lt ? ' lt' : '') + '" data-act="fgo" data-id="' + n.id + '" tabindex="0" role="button" aria-label="' + esc(ttl(n)) + 'を開く">' +
    '<button class="fcx rmore" type="button" aria-label="その他" title="その他">' + ic('more') + '</button>' +
    '<div class="fct">' + FILE + '<button class="tck" data-act="tdone" data-id="' + n.id + '" aria-pressed="' + !!n.done + '"' + (can ? '' : ' disabled') + ' aria-label="完了"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 12l4 4 8-8"/></svg></button><span class="sp"></span><span class="fcm num' + (n.nodate ? ' nodt' : '') + (lt ? ' bad' : '') + '">' + (n.nodate ? '期間未定' : shortDate(n.end)) + '</span></div>' +
    nm +
    (n.memo ? '<div class="fmemo">' + esc(memoText(n.memo).slice(0, 160)) + '</div>' : '') +
    '<div class="fcf">' + (canAssign(n)
      ? '<span class="fwho">' + (n.who ? av(n.who) : '<span class="av nob"></span>') + '<span class="fwn' + (n.who ? '' : ' none') + '">' + (member(n.who) ? esc(member(n.who).name) : '担当を選ぶ') + '</span><svg class="i fwc" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 10l4 4 4-4"/></svg><select class="fsel" data-act="noop" data-fw="' + n.id + '" aria-label="担当">' + whoOpts(n) + '</select></span>'
      : (member(n.who) ? '<span class="fwho">' + av(n.who) + '<span class="fcw">' + esc(member(n.who).name) + '</span></span>' : '<span class="dim">担当未定</span>')) + '</div>' +
  '</div>';
}
function fhead2() {
  var f = curFolder(), mine = S.fcur === 'mine';
  var path = '<nav class="crumb" aria-label="場所"><button data-act="fgo" data-id="">すべて</button>' + (f ? ancestors(f).map(function (a) { return '<span class="cs">›</span><button data-act="fgo" data-id="' + a.id + '">' + esc(ttl(a)) + '</button>'; }).join('') : '') + '</nav>';
  var gantt = S.fmode === 'gantt', ed = f && editSelf(f);
  var over = f && nodesOf(f).slice(1).reduce(function (m, x) { return Math.max(m, dayOf(x.end)); }, 0) > dayOf(f.end);
  var title = mine ? '自分の担当' : f ? ttl(f) : 'すべて';
  var srt = sortOf(f), canSort = true;
  return '<div class="fh2">' + (f || mine ? path : '') +
    '<div class="fh2r">' + backBtn() + '<h2>' + (f ? FOLD : '') + '<span' + (ed ? ' class="ied" data-act="ied" data-f="t" data-id="' + f.id + '" title="タップで名前を編集"' : '') + '>' + esc(title) + '</span></h2>' +
      (f ? (editSelf(f) ? '<button class="fh2m fper num' + (over ? ' bad' : '') + '" data-act="fper" title="期間を変更">' + shortDate(f.start) + ' – ' + shortDate(f.end) + '</button>' : '<span class="fh2m num' + (over ? ' bad' : '') + '">' + shortDate(f.start) + ' – ' + shortDate(f.end) + '</span>') + teamBtn(f, canAssign(f) ? '' : ' disabled', true) : '') +
      '<span class="sp"></span>' +
      (!mine && !gantt ? '<span class="srtw"><button class="ib fhb' + (srt !== 'manual' ? ' on' : '') + '" data-act="srt" title="並べ替え：' + SORTS.filter(function (x) { return x[0] === srt; })[0][1] + '" aria-label="並べ替え" aria-expanded="' + !!UI.srt + '">' + SORTI + '</button>' +
        (UI.srt ? '<div class="srtm" role="menu">' + SORTS.map(function (x) { return '<button role="menuitemradio" data-act="srtv" data-v="' + x[0] + '" aria-checked="' + (srt === x[0]) + '"' + (canSort ? '' : ' disabled') + '>' + x[1] + '</button>'; }).join('') + '</div>' : '') + '</span>' : '') +
      '<span class="vsw" role="group" aria-label="表示"><button data-act="fmode" data-v="card" aria-pressed="' + !gantt + '" title="カード" aria-label="カード">' + GRID + '</button><button data-act="fmode" data-v="gantt" aria-pressed="' + gantt + '" title="ガント" aria-label="ガント">' + GANTT + '</button></span>' +
      (f && (editSelf(f) || manages(parentOf(f)) || isLead(f, S.me)) ? '<span class="srtw"><button class="ib fhb" data-act="fmenu" aria-label="その他" title="その他" aria-expanded="' + !!UI.fmn + '">' + ic('more') + '</button>' +
        (UI.fmn ? '<div class="srtm" role="menu">' + (editSelf(f) ? '<button role="menuitem" data-act="edit" data-id="' + f.id + '">名前・期間を編集</button>' : '') + (manages(parentOf(f)) ? '<button role="menuitem" data-act="dupF">複製</button>' : '') + (editSelf(f) || isLead(f, S.me) ? '<button role="menuitem" data-act="fEvt">' + (isEvent(f) ? 'イベントを外す' : 'イベントにする') + '</button>' : '') + '</div>' : '') + '</span>' : '') +
    '</div>' + (f && isEvent(f) ? fresHTML(f) : '') + fmemoHTML(f) + '</div>';
}
function fresHTML(f) {
  return '<div class="fres">参加 <b class="num">' + evCount(f) + '</b><span class="muted num"> / ' + (S.club || 150) + '人・' + pct(f) + '%</span></div>';
}
function linkify(t) { return esc(t).replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener">$1</a>'); }
function fmemoHTML(f) {
  if (!f) return '';
  var can = editSelf(f) || isLead(f, S.me), m = f.memo || '';
  if (!m && !can) return '';
  var long = m.split('\n').length > 3 || m.length > 160, open = UI.fmx === f.id;
  return '<div class="fhm' + (long && !open ? ' clamp' : '') + '"><div class="fhmt' + (can ? ' ied' : '') + (m ? '' : ' empty') + '"' + (can ? ' data-act="ied" data-f="memo" data-id="' + f.id + '"' : '') + ' data-ph="メモ">' + linkify(m) + '</div>' +
    (long ? '<button class="fhmx" data-act="fmx">' + (open ? '閉じる' : '…詳細を表示') + '</button>' : '') + '</div>';
}
document.addEventListener('click', function (e) {
  var m = e.target.closest && e.target.closest('[data-act="fmenu"],[data-act="fEvt"]');
  if (!m) { if (UI.fmn && !(e.target.closest && e.target.closest('.srtw'))) { UI.fmn = false; render(); } }
  else {
    e.stopImmediatePropagation(); e.preventDefault();
    if (m.dataset.act === 'fmenu') { UI.fmn = !UI.fmn; render(); return; }
    var f0 = curFolder(); UI.fmn = false; if (!f0) return;
    if (isEvent(f0)) evUnlink(f0); else evPickAsk('folder', f0.id);
    return;
  }
  var b = e.target.closest && e.target.closest('[data-act="fmNew"],[data-act="fmx"]'); if (!b) return;
  e.stopImmediatePropagation(); e.preventDefault();
  if (b.dataset.act === 'fmx') { var f = curFolder(); UI.fmx = UI.fmx === (f && f.id) ? null : f && f.id; render(); return; }
  UI.fmNew = true; render(); UI.fmNew = false;
  var t = document.querySelector('.fhmt[data-act="ied"]'); if (t) t.click();
}, true);
// 新しく作ったフォルダー・ファイルは、ポップアップを出さずにその場で名前を書き換えられる状態にする
function editNew(n) {
  if (!n) return;
  var q = '[data-act="ied"][data-f="t"][data-id="' + n.id + '"]', el = document.querySelector('.fcn' + q) || document.querySelector(q);
  if (el) { el.scrollIntoView({ block: 'nearest' }); el.click(); return; }
  if (document.querySelector('.gname[data-id="' + n.id + '"]') && typeof gStart === 'function') { gStart(n); var gi = document.activeElement; if (gi && gi.select) gi.select(); return; }
  var c = document.querySelector('.cell[data-c="t"][data-id="' + n.id + '"]');
  if (c) { c.scrollIntoView({ block: 'nearest' }); c.focus(); if (c.select) c.select(); return; }
  var p = parentOf(n); if (p && S.fcur !== p.id && !editNew._go) { UI.fhist = UI.fhist || []; UI.fhist.push(S.fcur || ''); S.fcur = p.id; UI.fopen = {}; save(); render(); editNew._go = true; try { return editNew(n); } finally { editNew._go = false; } }
  M = { m: 'edit', id: n.id }; renderModal(); var w = document.getElementById('wT'); if (w) { w.focus(); w.select(); }
}
window.addEventListener('click', function (e) {
  var b = e.target.closest && e.target.closest('[data-act="gaddIn"]'); if (!b) return;
  e.stopImmediatePropagation(); e.preventDefault();
  var f = task(b.dataset.id); if (!f || !manages(f)) return;
  snap(); var k = addUnder(f, '新しいファイル'); expandTo(k.id); save(); render(); editNew(k);
}, true);
// フォルダを選んだら、ガントもその1つ下の段まで（子のフォルダは畳んでおく）
function foldBelow(id) { if (!S.fold) S.fold = {}; var f = id && id !== 'mine' ? task(id) : null; (f ? kids(f) : S.projects).forEach(function (k) { if (isFolder(k)) S.fold[k.id] = true; }); }
function iedSave(el) {
  var n = task(el.dataset.id); if (!n) return;
  var v = el.innerText.replace(/ /g, ' ');
  if (el.dataset.f === 't') { v = v.replace(/\s+/g, ' ').trim(); if (v && v !== ttl(n)) setTitle(n, v); }
  else if (el.dataset.f === 'reg') { n.reg = Math.max(0, parseInt(v.replace(/[^0-9]/g, ''), 10) || 0); }
  else { v = v.replace(/\n{3,}/g, '\n\n').trim(); n.memo = v; }
  save(); render();
}
document.addEventListener('click', function (e) {
  var t = e.target.closest && e.target.closest('[data-act="ied"],[data-act="noop"],[data-act="srt"],[data-act="srtv"]');
  if (!t) { if (UI.srt && !(e.target.closest && e.target.closest('.srtw'))) { UI.srt = false; render(); } return; }
  e.stopImmediatePropagation();
  var a = t.dataset.act;
  if (a === 'noop') return;
  e.preventDefault();
  if (a === 'srt') { UI.srt = !UI.srt; render(); return; }
  if (a === 'srtv') { var f = curFolder(); UI.sorts = UI.sorts || {}; UI.sorts[f ? f.id : '_'] = t.dataset.v; UI.srt = false; render(); return; }
  if (t.isContentEditable) return;
  if (e.target.closest('a')) { window.open(e.target.closest('a').href, '_blank', 'noopener'); return; }
  t.setAttribute('contenteditable', 'plaintext-only'); if (!t.isContentEditable) t.setAttribute('contenteditable', 'true');
  t.classList.add('editing'); t.focus();
  var r = document.createRange(); r.selectNodeContents(t); if (t.dataset.f === 'memo') r.collapse(false); var sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(r);
}, true);
document.addEventListener('keydown', function (e) {
  var t = e.target; if (!t.dataset || t.dataset.act !== 'ied' || !t.isContentEditable) return;
  if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); render(); return; }
  if (e.key === 'Enter' && (t.dataset.f === 't' || e.metaKey || e.ctrlKey)) { e.preventDefault(); t.blur(); }
}, true);
document.addEventListener('focusout', function (e) { var t = e.target; if (t.dataset && t.dataset.act === 'ied' && t.isContentEditable) iedSave(t); }, true);
document.addEventListener('change', function (e) {
  var el = e.target; if (!el.dataset || !el.dataset.fw) return; e.stopImmediatePropagation();
  var n = task(el.dataset.fw); if (!n || !canAssign(n)) return; var prev = n.who; n.who = el.value;
  if (el.value && el.value !== prev) { window.notify(el.value, '「' + ttl(n) + '」の担当になりました', ttl(rootOf(n))); toast(member(el.value).name + 'に通知しました'); }
  save(); render();
}, true);
// 詳細画面にもメモ
document.addEventListener('click', function (e) {
  var b = e.target.closest && e.target.closest('[data-act="wSave"]'); if (!b || !M || M.m !== 'edit') return;
  var n = task(M.id), m = document.getElementById('wM'); if (n && m && !m.disabled) n.memo = m.value.trim();
}, true);

// ---------- ux11: 色を絞る・完了したフォルダーも線で消す ----------
function decorateWork2() { if (S.view === 'projects' && S.wtab === 'stats') S.wtab = 'list'; }
function decorateDone() {
  if (S.view !== 'projects' || S.fmode !== 'gantt') return;
  document.querySelectorAll('.gg .gr[data-row]').forEach(function (row) {
    var n = task(row.dataset.row); if (!n || !isFolder(n)) return;
    var g = progress(n); if (!(g.n && g.d === g.n)) return;
    row.classList.add('fdone');
    var ph = row.querySelector('.gl .ckph'); if (ph) ph.outerHTML = '<span class="wck fck" title="すべて完了"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 12l4 4 8-8"/></svg></span>';
  });
}
// ---------- ux12: 畳む・戻る・ガントは見るだけ＋編集ボタン・右クリック ----------
function backBtn() {
  var h = (UI.fhist || []).length;
  return (S.ftreeC ? '<button class="ib fhb" data-act="ftreeTog" title="フォルダー一覧を開く" aria-label="フォルダー一覧を開く"><svg class="i" viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16"/></svg></button>' : '') +
    (h ? '<button class="ib fhb fback" data-act="fback" title="戻る" aria-label="戻る">' + ic('back') + '</button>' : '');
}
function applyChrome12() {
  document.body.classList.toggle('sidec', !!S.sideC);
  document.body.classList.toggle('ftreec', !!S.ftreeC);
  var br = document.querySelector('.brand');
  if (br && !br.querySelector('.sideb')) br.insertAdjacentHTML('beforeend', '<button class="ib sideb" data-act="sideTog" aria-label="メニューを畳む・開く" title="メニューを畳む・開く"><svg class="i" viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16"/></svg></button>');
}
function popAt(el, html) {
  var p = document.getElementById('gpop'); if (!p) { p = document.createElement('div'); p.id = 'gpop'; p.className = 'gpop'; document.body.appendChild(p); }
  p.innerHTML = html; var r = el.getBoundingClientRect();
  p.style.left = Math.min(window.innerWidth - 300, Math.max(8, r.left)) + 'px';
  var below = window.innerHeight - r.bottom > 220; p.style.top = below ? (r.bottom + 6) + 'px' : ''; p.style.bottom = below ? '' : (window.innerHeight - r.top + 6) + 'px';
}
function closePop() { var p = document.getElementById('gpop'); if (p) p.remove(); }
function whoPop(n) {
  var tm = isFolder(n) ? teamOf(n) : fileWho(n), ls = isFolder(n) ? leadsOf(n) : [];
  return '<div class="gph">' + esc(ttl(n)) + '</div>' + (tm.length ? tm.map(function (id) { var m = member(id); return '<div class="gpi">' + av(id) + '<span>' + esc(m ? m.name : '') + '</span>' + (ls.indexOf(id) >= 0 ? CROWN : '') + '<small>' + esc(m ? (isOps(m) ? m.unit : (m.roles || []).join('・')) : '') + '</small></div>'; }).join('') : '<div class="gpi dim">担当未定</div>');
}
// ガントの行：名前・担当・編集ボタン・強調の点
function decorateGantt() {
  if (S.view === 'projects' && S.fmode === 'gantt') document.querySelectorAll('.gg .gr[data-row]').forEach(function (row) {
    var n = task(row.dataset.row); if (!n || row.dataset.g12) return; row.dataset.g12 = '1';
    var gl = row.querySelector('.gl'); if (!gl) return;
    var ct = gl.querySelector('input.ct[data-c="t"]');
    if (ct) ct.outerHTML = '<button class="gname" data-act="gname" data-id="' + n.id + '" title="' + esc(ttl(n)) + '">' + esc(ttl(n)) + '</button>';
    gl.querySelectorAll('.tbtn, select.gsel, .fin, .ga').forEach(function (x) { x.remove(); });
    var tm = isFolder(n) ? teamOf(n) : fileWho(n);
    var who = '<button class="gwho" data-act="gwho" data-id="' + n.id + '">' + (tm.length ? (isFolder(n) ? avStack(tm, leadsOf(n)) : (fileWho(n).length > 1 ? avStack(fileWho(n)) : av(n.who))) : '<span class="dim">未定</span>') + '</button>';
    var ed = (editSelf(n) || n.who === S.me) ? '<button class="gedit" data-act="edit" data-id="' + n.id + '" title="編集" aria-label="編集"><svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13 7l4 4"/></svg></button>' : '<span class="gedit ph"></span>';
    var lwh = gl.querySelector('.lwh');
    var pl = isFolder(n) && manages(n) ? '<button class="gedit gplus" data-act="gaddIn" data-id="' + n.id + '" title="中に追加" aria-label="中に追加"><svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg></button>' : '<span class="gedit ph"></span>';
    gl.insertAdjacentHTML('beforeend', ed + pl + who);
    if (lwh) gl.appendChild(lwh);
  });
  if (UI.gedit && S.fmode === 'gantt') { // 行内で編集中の行
    var row = document.querySelector('.gg .gr[data-row="' + UI.gedit + '"]'), n = task(UI.gedit);
    if (!row || !n) UI.gedit = null;
    else { geditRow(row, n); var inp = row.querySelector('.gin'); if (inp && UI.gfocus !== false) { inp.focus(); var L = inp.value.length; inp.setSelectionRange(L, L); } }
  }
  if (S.view !== 'projects' || S.fmode !== 'gantt') return;
  document.querySelectorAll('.gg .gr[data-row]').forEach(function (row) {
    var gl = row.querySelector('.gl'); if (!gl || gl.querySelector('.hldot')) return;
    var n = task(row.dataset.row); if (!n) return; var f = hlFlags(n); if (!f.length) return;
    var col = (HLS.filter(function (h) { return h[0] === f[0]; })[0] || [])[2];
    var w = gl.querySelector('.gwho, .gwho2, .gsel2');
    var dot = '<i class="hldot" style="background:' + col + '" title="' + f.map(function (k) { return HLN[k] || k; }).join('・') + '"></i>';
    if (w) w.insertAdjacentHTML('beforebegin', dot); else gl.insertAdjacentHTML('beforeend', dot);
  });
}
// 右クリック
function cmItems(n) {
  var f = isFolder(n), it = [], sep = function () { it.push('<i class="cmsep"></i>'); };
  var add = function (act, label, cls) { it.push('<button role="menuitem" data-cm="' + act + '"' + (cls ? ' class="' + cls + '"' : '') + '>' + label + '</button>'); };
  var add2 = function (attr, act, label, key) { it.push('<button role="menuitem" data-' + attr + '="' + act + '">' + label + (key ? '<span class="cmk">' + key + '</span>' : '') + '</button>'); };
  var p = parentOf(n), g = p && parentOf(p);
  add('open', '開く'); if (f) add('gantt', 'ガントで見る');
  if (editSelf(n) || (!f && n.who === S.me)) add('edit', '名前・担当・期間を編集');
  if (f && manages(n)) { sep(); add('newF', '新しいフォルダー'); add('newT', '新しいファイル'); }
  if (!f && (editSelf(n) || n.who === S.me)) { sep(); if (editSelf(n) && !n.nodate) add2('cm4', 'nodate', '期間を未定にする'); add('done', n.done ? '未完了に戻す' : '完了にする'); add('toF', 'フォルダーに変える'); }
  if (f && (editSelf(n) || isLead(n, S.me))) add('evt', isEvent(n) ? 'イベントを外す' : 'イベントにする');
  if (f && manages(p)) add('dup', '複製…');
  if (!f && canAssign(n) && n.who !== S.me) add2('cm2', 'me', '自分が担当する');
  if (f && !kids(n).length && p && editSelf(n)) add2('cm2', 'toFile', 'ファイルに変える');
  sep();
  if (g && editSelf(n) && manages(g)) add2('cm3', 'out', '「' + esc(ttl(g)).slice(0, 14) + '」へ出す');
  if (p && editSelf(n)) add2('cm2', 'cut', '切り取り', 'Ctrl+X');
  add2('cm2', 'copy', 'コピー', 'Ctrl+C');
  if (f && canPasteInto(n)) add2('cm2', 'paste', '「' + esc(ttl(clipNode())).slice(0, 14) + '」を貼り付け', 'Ctrl+V');
  if (editSelf(n)) { sep(); add('del', '削除', 'cmdel'); }
  return it.join('');
}
function openCM(n, x, y) {
  var m = document.getElementById('cm'); if (!m) { m = document.createElement('div'); m.id = 'cm'; m.className = 'cm'; m.setAttribute('role', 'menu'); document.body.appendChild(m); }
  UI.cm = n.id; m.innerHTML = '<div class="cmh">' + (isFolder(n) ? FOLD : '') + '<span>' + esc(ttl(n)) + '</span></div>' + cmItems(n);
  m.style.left = '0px'; m.style.top = '0px'; var w = m.offsetWidth, h = m.offsetHeight;
  m.style.left = Math.min(x, window.innerWidth - w - 8) + 'px'; m.style.top = Math.min(y, window.innerHeight - h - 8) + 'px';
}
function closeCM() { var m = document.getElementById('cm'); if (m) m.remove(); UI.cm = null; }
document.addEventListener('contextmenu', function (e) {
  var el = e.target.closest && e.target.closest('.ftn[data-id], .fcard[data-id], .gg .gr[data-row]'); if (!el) return;
  var id = el.dataset.id || el.dataset.row, n = id && task(id); if (!n) return;
  e.preventDefault(); closePop(); openCM(n, e.clientX, e.clientY);
});
function goFolder(id, mode) { if (id !== (S.fcur || '')) { UI.fhist = UI.fhist || []; UI.fhist.push(S.fcur || ''); } UI.fopen = {}; S.fcur = id; if (mode) S.fmode = mode; UI.sp = null; save(); render(); }
document.addEventListener('click', function (e) {
  var c = e.target.closest && e.target.closest('[data-cm]');
  if (c) {
    e.stopImmediatePropagation(); e.preventDefault();
    var n = task(UI.cm), a = c.dataset.cm; if (!n) { closeCM(); return; }
    if (a === 'del' && !c.classList.contains('sure')) { c.classList.add('sure'); c.textContent = 'もう一度押すと削除'; return; }
    closeCM();
    if (a === 'open') goFolder(n.id);
    else if (a === 'gantt') goFolder(n.id, 'gantt');
    else if (a === 'edit') { M = { m: 'edit', id: n.id }; renderModal(); }
    else if (a === 'newF' || a === 'newT') { var k = a === 'newF' ? addFolder(n, '新しいフォルダー') : addUnder(n, '新しいファイル'); save(); render(); editNew(k); }
    else if (a === 'done') { n.done = !n.done; if (n.done) reportUp(n); save(); render(); }
    else if (a === 'toF') { n.folder = true; n.kids = n.kids || []; delete n.done; if (n.who) setLeads(n, [n.who]); save(); render(); toast('フォルダーに変えました'); }
    else if (a === 'evt') { if (isEvent(n)) evUnlink(n); else evPickAsk('folder', n.id); }
    else if (a === 'dup') { UI.dupId = n.id; var ov = document.getElementById('cpov'); if (!ov) { ov = document.createElement('div'); ov.id = 'cpov'; document.body.appendChild(ov); } ov.innerHTML = dupModal(n); ov.querySelector('#cpN').focus(); }
    else if (a === 'del') {
      snap(); var par = parentOf(n), cur = curFolder(), gone = cur && (cur === n || ancestors(cur).indexOf(n) >= 0);
      removeNode(n); if (gone) S.fcur = par ? par.id : ''; save(); render(); toastUndo('「' + ttl(n) + '」を削除しました');
    }
    return;
  }
  if (document.getElementById('cm') && !(e.target.closest && e.target.closest('#cm'))) closeCM();
  var b = e.target.closest && e.target.closest('[data-act="sideTog"],[data-act="ftreeTog"],[data-act="fback"],[data-act="gname"],[data-act="gwho"]');
  if (!b) { if (document.getElementById('gpop') && !(e.target.closest && e.target.closest('#gpop'))) closePop(); return; }
  e.stopImmediatePropagation(); e.preventDefault();
  var a = b.dataset.act;
  if (a === 'sideTog') { S.sideC = !S.sideC; save(); render(); applyChrome12(); }
  else if (a === 'ftreeTog') { S.ftreeC = !S.ftreeC; save(); render(); }
  else if (a === 'fback') { var h = UI.fhist || []; if (!h.length) return; S.fcur = h.pop(); UI.fopen = {}; UI.sp = null; save(); render(); }
  else if (a === 'gname') { var n = task(b.dataset.id); if (!n) return; closePop(); goFolder(n.id); }
  else if (a === 'gwho') { var n2 = task(b.dataset.id); if (!n2) return; closePop(); if (canAssign(n2)) { if (UI.tp === n2.id) closeTeam(); else openTeam(n2.id); } else popAt(b, whoPop(n2)); }
}, true);
document.addEventListener('keydown', function (e) { if (e.key === 'Escape') { closeCM(); closePop(); } });
window.addEventListener('scroll', function () { closeCM(); closePop(); }, true);
// ---------- ux14: ガントの行内編集（✕／✓）・日付スライダー ----------
var CHK = '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12l5 5 9-10"/></svg>';
function geditRow(row, n) {
  var gl = row.querySelector('.gl'); if (!gl) return;
  var d = UI.gdraft;
  var nm = gl.querySelector('.gname'); if (nm) nm.outerHTML = '<input class="gin" data-gin="1" value="' + esc(d.name) + '" aria-label="名前" autocomplete="off">';
  // 担当は編集ボタンを押さなくても、行の担当ボタンからワンタッチで選べる
  var ed = gl.querySelector('.gedit'); if (ed) ed.outerHTML = '<span class="gok"><button class="gx" data-act="gcancel" title="キャンセル" aria-label="キャンセル">' + ic('x') + '</button><button class="gy" data-act="gsave" title="保存" aria-label="保存">' + CHK + '</button></span>';
  row.classList.add('gediting');
}
function gStart(n) { UI.gedit = n.id; UI.gfocus = true; UI.gdraft = { name: ttl(n), who: n.who || '', team: (n.team || []).slice(), leads: leadsOf(n).slice(), ow: n.who || '' }; render(); }
function gEnd(saveIt) {
  var n = task(UI.gedit), d = UI.gdraft; UI.gedit = null; if (!n || !d) { render(); return; }
  if (!isFolder(n)) d.who = n.who || ''; // ファイルの担当は選んだ時点で保存済み
  if (saveIt) {
    var v = (d.name || '').replace(/\s+/g, ' ').trim(); if (v && v !== ttl(n)) setTitle(n, v);
    if (!isFolder(n) && d.who !== (n.who || '') && canAssign(n)) { n.who = d.who; if (d.who) { window.notify(d.who, '「' + ttl(n) + '」の担当になりました', ttl(rootOf(n))); toast(member(d.who).name + 'に通知しました'); } }
  } // 担当は行の担当ボタンで直接変わるので、キャンセルしても戻さない
  closeTeam(); save(); render();
}
document.addEventListener('click', function (e) {
  var b = e.target.closest && e.target.closest('[data-act="gsave"],[data-act="gcancel"],.gedit[data-act="edit"]'); if (!b) return;
  if (b.classList.contains('gedit')) { if (!(S.view === 'projects' && S.fmode === 'gantt')) return; e.stopImmediatePropagation(); e.preventDefault(); var n = task(b.dataset.id); if (!n) return; if (UI.gedit) gEnd(true); gStart(n); return; }
  e.stopImmediatePropagation(); e.preventDefault(); gEnd(b.dataset.act === 'gsave');
}, true);
document.addEventListener('input', function (e) { if (e.target.dataset && e.target.dataset.gin && UI.gdraft) UI.gdraft.name = e.target.value; }, true);
document.addEventListener('change', function (e) { if (e.target.dataset && e.target.dataset.gsel && UI.gdraft) { e.stopImmediatePropagation(); UI.gdraft.who = e.target.value; } }, true);
document.addEventListener('keydown', function (e) {
  if (!UI.gedit) return;
  if (e.target.dataset && (e.target.dataset.gin || e.target.dataset.gsel)) {
    if (e.key === 'Enter') { e.preventDefault(); gEnd(true); } else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); gEnd(false); }
  }
}, true);
// チーム選択の再描画でも入力中の名前を保つ

// 日付スライダー
function dsRange(n) {
  var p = parentOf(n), lo = p ? dayOf(p.start) : dayOf(n.start) - 60 * DAY, hi = p ? dayOf(p.end) : dayOf(n.end) + 60 * DAY;
  lo = Math.min(lo, dayOf(n.start)); hi = Math.max(hi, dayOf(n.end));
  if (hi - lo < 14 * DAY) hi = lo + 14 * DAY;
  return { lo: lo, hi: hi };
}
function dslider(n, sid, eid) {
  var r = dsRange(n), max = Math.round((r.hi - r.lo) / DAY), a = Math.round((dayOf(n.start) - r.lo) / DAY), b = Math.round((dayOf(n.end) - r.lo) / DAY);
  return '<div class="dsl" data-lo="' + r.lo + '" data-s="' + sid + '" data-e="' + eid + '"><div class="dslt"><i class="dslf" style="left:' + (a / max * 100) + '%;right:' + (100 - b / max * 100) + '%"></i></div>' +
    '<input type="range" class="dsa" min="0" max="' + max + '" value="' + a + '" aria-label="開始"><input type="range" class="dsb" min="0" max="' + max + '" value="' + b + '" aria-label="期限">' +
    '<div class="dsll num"><span>' + shortDate(isoOf(r.lo)) + '</span><span>' + shortDate(isoOf(r.hi)) + '</span></div></div>';
}
function dsSync(w, from) {
  var A = w.querySelector('.dsa'), B = w.querySelector('.dsb'), lo = +w.dataset.lo, max = +A.max;
  if (+A.value > +B.value) { if (from === 'a') B.value = A.value; else A.value = B.value; }
  w.querySelector('.dslf').style.left = (A.value / max * 100) + '%'; w.querySelector('.dslf').style.right = (100 - B.value / max * 100) + '%';
  var s = document.getElementById(w.dataset.s), e = document.getElementById(w.dataset.e);
  if (s) { s.value = isoOf(lo + A.value * DAY); s.dispatchEvent(new Event('input', { bubbles: true })); }
  if (e) { e.value = isoOf(lo + B.value * DAY); e.dispatchEvent(new Event('input', { bubbles: true })); }
}
document.addEventListener('input', function (e) {
  var t = e.target; if (!t.classList) return;
  if (t.classList.contains('dsa') || t.classList.contains('dsb')) { dsSync(t.closest('.dsl'), t.classList.contains('dsa') ? 'a' : 'b'); return; }
  if (t.id === 'wS' || t.id === 'wE' || t.id === 'pS' || t.id === 'pE') {
    var w = document.querySelector('.dsl[data-s="' + (t.id[0] + 'S') + '"]'); if (!w || !t.value) return;
    var lo = +w.dataset.lo, k = Math.round((dayOf(t.value) - lo) / DAY), inp = w.querySelector(t.id[1] === 'S' ? '.dsa' : '.dsb');
    if (k >= 0 && k <= +inp.max && +inp.value !== k) { inp.value = k; var A = w.querySelector('.dsa'), B = w.querySelector('.dsb'), max = +A.max; w.querySelector('.dslf').style.left = (A.value / max * 100) + '%'; w.querySelector('.dslf').style.right = (100 - B.value / max * 100) + '%'; }
  }
}, true);
// 見出しの期間を押すとスライダー
document.addEventListener('click', function (e) {
  var b = e.target.closest && e.target.closest('[data-act="fper"],[data-act="perSave"]');
  if (!b) { var pp = document.getElementById('perpop'); if (pp && !pp.contains(e.target)) pp.remove(); return; }
  e.stopImmediatePropagation(); e.preventDefault();
  var f = curFolder(); if (!f) return;
  if (b.dataset.act === 'perSave') {
    var s = val('pS'), en = val('pE'); if (!s || !en || en < s) { toast('期間を確認してください'); return; }
    f.start = s; f.end = en; var pp2 = document.getElementById('perpop'); if (pp2) pp2.remove(); save(); render(); toast('期間を変更しました'); return;
  }
  var p = document.getElementById('perpop'); if (p) { p.remove(); return; }
  p = document.createElement('div'); p.id = 'perpop'; p.className = 'gpop perpop'; document.body.appendChild(p);
  p.innerHTML = '<div class="gph">期間</div><div class="two"><input id="pS" class="input num" type="date" value="' + f.start + '"><input id="pE" class="input num" type="date" value="' + f.end + '"></div>' + dslider(f, 'pS', 'pE') + '<div class="gpf"><button class="btn sm primary" data-act="perSave">保存</button></div>';
  var r = b.getBoundingClientRect(); p.style.left = Math.min(window.innerWidth - 340, r.left) + 'px'; p.style.top = (r.bottom + 6) + 'px';
}, true);

// ---------- ux15: 業務＝ファイル。開くとメモのページ ----------
var FILE = '<svg class="i fli" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3h7l5 5v13H7z"/><path d="M14 3v5h5"/></svg>';
function filePage(n) {
  var per = n.nodate ? '期間未定' : shortDate(n.start) + ' – ' + shortDate(n.end), canM = editSelf(n) || n.who === S.me, lt = late(n) && !n.done, w = member(n.who);
  var path = '<nav class="crumb" aria-label="場所"><button data-act="fgo" data-id="">すべて</button>' + ancestors(n).map(function (a) { return '<span class="cs">›</span><button data-act="fgo" data-id="' + a.id + '">' + esc(ttl(a)) + '</button>'; }).join('') + '</nav>';
  var who = canAssign(n) ? '<span class="fwho">' + (n.who ? av(n.who) : '<span class="av nob"></span>') + '<span class="fwn' + (n.who ? '' : ' none') + '">' + (member(n.who) ? esc(member(n.who).name) : '担当を選ぶ') + '</span><svg class="i fwc" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 10l4 4 4-4"/></svg><select class="fsel" data-act="noop" data-fw="' + n.id + '" aria-label="担当">' + whoOpts(n) + '</select></span>'
    : (w ? '<span class="fwho">' + av(n.who) + '<span class="fcw">' + esc(w.name) + '</span></span>' : '<span class="dim">担当未定</span>');
  var head = '<div class="fh2">' + path + '<div class="fh2r">' + backBtn() +
    '<button class="tck big" data-act="tdone" data-id="' + n.id + '" aria-pressed="' + !!n.done + '"' + (canM ? '' : ' disabled') + ' title="完了" aria-label="完了"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 12l4 4 8-8"/></svg></button>' +
    '<h2' + (n.done ? ' class="dn"' : '') + '>' + FILE + '<span' + (editSelf(n) ? ' class="ied" data-act="ied" data-f="t" data-id="' + n.id + '" title="タップで名前を編集"' : '') + '>' + esc(ttl(n)) + '</span></h2>' +
    (editSelf(n) ? '<button class="fh2m fper num' + (lt ? ' bad' : '') + '" data-act="fper" title="期間を変更">' + per + '</button>' : '<span class="fh2m num' + (lt ? ' bad' : '') + '">' + per + '</span>') +
    who + '<span class="sp"></span>' +
    (editSelf(n) || n.who === S.me ? '<span class="srtw"><button class="ib fhb" data-act="fmenu" aria-label="その他" title="その他" aria-expanded="' + !!UI.fmn + '">' + ic('more') + '</button>' +
      (UI.fmn ? '<div class="srtm" role="menu"><button role="menuitem" data-act="toFolder" data-id="' + n.id + '">フォルダーに変える</button>' + (editSelf(n) ? '<button role="menuitem" data-act="edit" data-id="' + n.id + '">名前・期間を編集</button>' : '') + '</div>' : '') + '</span>' : '') +
    '</div></div>';
  var memo = '<div class="body"><div class="fpage2">' + (canM ? docBar() : '') +
    '<div class="fdoc" id="fdoc" data-id="' + n.id + '"' + (canM ? ' contenteditable="true" spellcheck="false" role="textbox" aria-multiline="true" aria-label="メモ" data-ph="メモ"' : ' data-ph="メモはありません"') + '>' + docHTML(n.memo) + '</div></div></div>';
  return top('業務') + '<div class="wk"><aside class="ftree" aria-label="フォルダー">' + ftree() + '</aside><div class="wkm">' + head + memo + '</div></div>';
}
document.addEventListener('click', function (e) { var b = e.target.closest && e.target.closest('[data-act="toFolder"]'); if (b) UI.fmn = false; }, true);

// ---------- ux16: ツリーの展開はその場だけ・ダッシュボードから業務へ・教材は横並び ----------
document.addEventListener('click', function (e) {
  var g = e.target.closest && e.target.closest('[data-act="go"][data-view]');
  if (g && g.dataset.view !== 'projects') UI.fopen = {};
  var o = e.target.closest && e.target.closest('[data-act="open"][data-id]');
  if (o && S.view === 'dash') {
    e.stopImmediatePropagation(); e.preventDefault();
    var n = task(o.dataset.id); if (!n) return;
    UI.fopen = {}; UI.fhist = []; S.view = 'projects'; S.fcur = n.id; S.fmode = 'card'; UI.sp = null; save(); render();
  }
}, true);

// ---------- ux17: ガントの表示設定（フォルダー／ファイル版） ----------
LEVELS = [['1', '1段'], ['2', '2段'], ['3', '3段'], ['9', 'すべて']];
HLS = [
  ['late', '期限切れ', '#DC2626'],
  ['soon', '期限が近い', '#F59E0B'],
  ['over', '中身が期限を超えたフォルダー', '#DC2626'],
  ['nobody', '担当未定', '#D1D5DB'],
  ['active', '進行中', '#2563EB'],
  ['mine', '自分の担当', '#111827']
];
EXPS = [['depth', '深さで開く', '今いるフォルダーから何段下まで開くか'], ['active', '進行中の所だけ', '今日が期間内のフォルダーだけ開く'], ['mine', '自分の担当まで', '自分が関わるフォルダー・ファイルまで開く'], ['flag', '強調した所まで', '強調に当てはまるものまで開く']];
function vs() { if (!S.view2) S.view2 = { exp: 'depth', hl: { late: true, soon: true, over: true }, days: 7, done: 'show', dimDone: false, focus: false, foldersOnly: false }; if (!S.view2.done) S.view2.done = S.view2.dimDone ? 'dim' : 'show'; return S.view2; }
function overOf(n) { return isFolder(n) && nodesOf(n).slice(1).some(function (x) { return !x.nodate && dayOf(x.end) > dayOf(n.end); }); }
function hlFlags(n) {
  var v = vs(), f = [], dn = isDone(n) || (n.nodate && !isFolder(n)), leaf = !isFolder(n);
  if (v.hl.late && !dn && dayOf(n.end) < TODAY && (leaf || kids(n).some(function (k) { return !isDone(k); }))) f.push('late');
  else if (v.hl.soon && !dn && dayOf(n.end) >= TODAY && dayOf(n.end) <= TODAY + v.days * DAY) f.push('soon');
  if (v.hl.over && !dn && overOf(n)) f.push('over');
  if (v.hl.nobody && !dn && !teamOf(n).length) f.push('nobody');
  if (v.hl.active && isActiveN(n)) f.push('active');
  if (v.hl.mine && inTeam(n, S.me)) f.push('mine');
  return f;
}
function vShow(n) { var v = vs(); if (v.done === 'hide' && isDone(n) && (!isFolder(n) || progress(n).n)) return false; if (v.foldersOnly && !isFolder(n)) return false; return true; }
function rowsOf(all, ghosts) {
  var out = [], gantt = S.view === 'projects' && S.fmode === 'gantt';
  (function each(list, d) {
    list.forEach(function (n) {
      if (!visNode(n) || (gantt && !vShow(n))) return;
      var c = kids(n).filter(function (k) { return visNode(k) && (!gantt || vShow(k)); }), slot = ghosts && isFolder(n) && canEdit(n) && !(gantt && vs().foldersOnly);
      var open = all ? true : isOpen(n, d);
      out.push({ n: n, d: d, has: c.length > 0 || slot, open: open, ctx: !(canEdit(n) || editSelf(n) || inTeam(n, S.me)) });
      if (open) { each(c, d + 1); if (slot) out.push({ ghost: true, parent: n, d: d + 1 }); }
    });
  })(visibleRoots(), 0);
  return out;
}
function vSummary() {
  var v = vs(), e = v.exp === 'depth' ? (LEVELS.filter(function (l) { return +l[0] === (S.depth || 2); })[0] || LEVELS[1])[1] : EXPS.filter(function (x) { return x[0] === v.exp; })[0][1];
  return e;
}
function vPanelHTML() {
  var v = vs(), dsel = S.depth || 2;
  var exp = EXPS.map(function (x) {
    var on = v.exp === x[0];
    return '<label class="vopt"><input type="radio" name="vexp" data-vexp="' + x[0] + '"' + (on ? ' checked' : '') + '><span><b>' + x[1] + '</b><small>' + x[2] + '</small></span></label>' +
      (x[0] === 'depth' ? '<div class="vsub"><span class="seg" role="group" aria-label="開く深さ">' + LEVELS.map(function (l) { return '<button data-act="vdepth" data-v="' + l[0] + '" aria-pressed="' + (on && String(dsel) === l[0]) + '">' + l[1] + '</button>'; }).join('') + '</span></div>' : '');
  }).join('');
  var hl = HLS.map(function (h) {
    return '<label class="vopt"><input type="checkbox" data-vhl="' + h[0] + '"' + (v.hl[h[0]] ? ' checked' : '') + '><i class="vdot" style="background:' + h[2] + '"></i><span><b>' + h[1] + '</b></span>' +
      (h[0] === 'soon' ? '<span class="vdays">' + [3, 7, 14].map(function (d) { return '<button data-act="vdays" data-v="' + d + '" aria-pressed="' + (v.days === d) + '">' + d + '日</button>'; }).join('') + '</span>' : '') + '</label>';
  }).join('');
  var done = '<div class="vsub"><span class="seg" role="group" aria-label="完了したもの">' + [['show', 'そのまま'], ['dim', '薄く'], ['hide', '隠す']].map(function (x) { return '<button data-act="vdone" data-v="' + x[0] + '" aria-pressed="' + (v.done === x[0]) + '">' + x[1] + '</button>'; }).join('') + '</span></div>';
  return '<div class="vph"><b>ガントの表示</b><button class="btn sm ghost" data-act="vreset">初期設定に戻す</button><button class="ib vclose" data-act="vclose" aria-label="閉じる">' + ic('x') + '</button></div>' +
    '<div class="vsec"><div class="vt">開き方</div>' + exp + '</div>' +
    '<div class="vsec"><div class="vt">見せるもの</div>' +
      '<div class="vopt vrow"><span><b>完了したもの</b></span></div>' + done +
      '<label class="vopt"><input type="checkbox" data-vopt="foldersOnly"' + (v.foldersOnly ? ' checked' : '') + '><span><b>フォルダーだけ表示</b><small>ファイルを隠して全体の流れだけ見る</small></span></label></div>' +
    '<div class="vsec"><div class="vt">強調</div>' + hl +
      '<div class="vline"></div>' +
      '<label class="vopt"><input type="checkbox" data-vopt="focus"' + (v.focus ? ' checked' : '') + '><span><b>強調以外を薄く</b></span></label></div>';
}
document.addEventListener('click', function (e) {
  var b = e.target.closest && e.target.closest('[data-act="vdone"],[data-act="vreset"]'); if (!b) return;
  e.stopImmediatePropagation(); e.preventDefault();
  if (b.dataset.act === 'vreset') { S.view2 = null; S.depth = 2; vApply(); return; }
  var v = vs(); v.done = b.dataset.v; v.dimDone = v.done === 'dim'; vApply();
}, true);

function vApply() { S.fold = {}; UI.sp = null; save(); render(); if (UI.vp) openVPanel(); }
// ---------- ux18: 表示パネルの高さ・強調は点に統一・教材の削除/右クリック/START・GOALを表に/コードから追加 ----------
var HLN = { late: '期限切れ', soon: '期限が近い', over: '中身が期限超過', nobody: '担当未定', active: '進行中', mine: '自分の担当' };
// 教材：START / GOAL を表の中に、コードから追加
// 教材：トラックの削除・右クリック
function delTrack(id) {
  if (S.tracks.length <= 1) { toast('最後のトラックは削除できません'); return; }
  var t = S.tracks.filter(function (x) { return x.id === id; })[0]; if (!t) return;
  snap(); S.tracks = S.tracks.filter(function (x) { return x.id !== id; }); if (S.cur === id) { S.cur = S.tracks[0].id; S.sel = null; }
  save(); render(); toastUndo('トラック「' + t.name + '」を削除しました');
}

