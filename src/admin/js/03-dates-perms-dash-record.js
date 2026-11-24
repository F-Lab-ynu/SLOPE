// ---------- ux3: 日付は短く表示し、押したらカレンダー ----------
function shortDate(iso) { var p = String(iso || '').split('-'); if (p.length !== 3) return ''; return (+p[0] !== new Date(TODAY).getUTCFullYear() ? p[0] + '/' : '') + (+p[1]) + '/' + (+p[2]); }
function dtxSet(inp) {
  var t = inp.nextElementSibling; if (!t || !t.classList.contains('dtx')) return;
  var v = inp.value ? shortDate(inp.value) : '未定';
  if (t.textContent !== v) t.textContent = v;
  var bad = inp.classList.contains('bad'), none = !inp.value;
  if (t.classList.contains('bad') !== bad) t.classList.toggle('bad', bad);
  if (t.classList.contains('none') !== none) t.classList.toggle('none', none);
}
function decorateDates() {
  document.querySelectorAll('input.cell[type=date]').forEach(function (inp) {
    if (!inp.parentNode.classList.contains('dfx')) {
      var w = document.createElement('span'); w.className = 'dfx'; inp.parentNode.insertBefore(w, inp); w.appendChild(inp);
      var t = document.createElement('span'); t.className = 'dtx'; t.setAttribute('aria-hidden', 'true'); w.appendChild(t);
    }
    dtxSet(inp);
  });
}
document.addEventListener('click', function (e) {
  var i = e.target.closest && e.target.closest('.dfx > input');
  if (i && !i.disabled && i.showPicker) { try { i.showPicker(); } catch (_) {} }
});
document.addEventListener('input', function (e) { if (e.target.matches && e.target.matches('.dfx > input')) dtxSet(e.target); }, true);
document.addEventListener('change', function (e) { if (e.target.matches && e.target.matches('.dfx > input')) dtxSet(e.target); }, true);
(function () {
  var q = false;
  new MutationObserver(function () { if (q) return; q = true; requestAnimationFrame(function () { q = false; decorateDates(); }); })
    .observe(document.documentElement, { childList: true, subtree: true });
})();

// ---------- ux4: 権限は「一段上のリーダー」だけ・リーダーは複数可 ----------
var CROWN = '<svg class="crown" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 8l4.5 4L12 5l4.5 7L21 8l-2 11H5z"/></svg>';
function leadsOf(n) { var l = (n && n.leads || []).filter(Boolean); if (!l.length && n && n.who) l = [n.who]; return l; }
function isLead(n, id) { return leadsOf(n).indexOf(id) >= 0; }
function setLeads(n, l) { n.leads = l.slice(); n.who = l[0] || ''; }
 // x の下を編集・割り振りできるか（x=null はイベントの段）
function inTeam(x, id) { return isLead(x, id) || (x.team || []).indexOf(id) >= 0; }
function teamOf(n) { var t = (n.team || []).slice(); leadsOf(n).slice().reverse().forEach(function (l) { if (t.indexOf(l) < 0) t.unshift(l); }); return t; }
function chainHas(n, id) { reindex(); var x = n; while (x) { if (isLead(x, id)) return true; x = IX[x.id] && IX[x.id].par; } return false; }
function teamBtn(n, dis, compact) {
  if (!isFolder(n)) return fileWhoBtn(n, dis, compact);
  var tm = teamOf(n), ls = leadsOf(n), rest = tm.filter(function (id) { return ls.indexOf(id) < 0; });
  var nm = function (id) { var m = member(id); return m ? m.name : ''; };
  var inner = !tm.length ? '<span class="none">未定</span>'
    : compact ? '<span class="avs">' + ls.concat(rest).slice(0, 3).map(function (id) { return '<span class="av' + (ls.indexOf(id) >= 0 ? ' lead' : '') + '">' + esc(initials(nm(id))) + '</span>'; }).join('') + '</span>' + (tm.length > 3 ? '<span class="more num">+' + (tm.length - 3) + '</span>' : '')
    : (ls.length ? CROWN + '<span class="ld"><b>' + esc(ls.map(nm).join('・')) + '</b></span>' : '<span class="ld none">' + CROWN + '?</span>') + (rest.length ? '<span class="more num">+' + rest.length + '</span>' : '');
  return '<button class="tbtn" data-act="teamPick" data-id="' + n.id + '"' + (dis || '') + ' aria-label="メンバー ' + tm.length + '名" title="' + esc(tm.map(function (id) { return nm(id) + (ls.indexOf(id) >= 0 ? '（リーダー）' : ''); }).join('\n')) + '">' + inner + '</button>';
}
// ファイルの担当（複数可・リーダーなし）
function fileWhoBtn(n, dis, compact) {
  var tm = fileWho(n), nm = function (id) { var m = member(id); return m ? m.name : ''; };
  var inner = !tm.length ? '<span class="none">担当を選ぶ</span>' : compact ? '<span class="avs">' + tm.slice(0, 3).map(function (id) { return '<span class="av">' + esc(initials(nm(id))) + '</span>'; }).join('') + '</span>' + (tm.length > 3 ? '<span class="more num">+' + (tm.length - 3) + '</span>' : '')
    : '<span class="avs">' + tm.slice(0, 2).map(function (id) { return av(id); }).join('') + '</span><span class="ld"><b>' + esc(tm.slice(0, 2).map(nm).join('・')) + '</b></span>' + (tm.length > 2 ? '<span class="more num">+' + (tm.length - 2) + '</span>' : '');
  return '<button class="tbtn fw" data-act="teamPick" data-id="' + n.id + '"' + (dis || '') + ' aria-label="担当 ' + tm.length + '名" title="' + esc(tm.map(nm).join('\n') || '担当なし') + '">' + inner + '</button>';
}

// ---------- ux4: ダッシュボード：自分 → 全体 ----------
var GO = '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M10 7l5 5-5 5"/></svg>';
function viewDash() {
  var m = me(), pl = S.members.filter(function (x) { return !isOps(x); });
  var live = allEvents().filter(function (p) { return dayOf(p.end) >= TODAY; });
  var all = []; S.projects.forEach(function (p) { leavesOf(p).forEach(function (k) { all.push({ k: k, p: evOf(k) }); }); });
  var rep = S.posts.filter(function (x) { return x.reports > 0 && x.state === 'ok'; }).length;
  var off = S.offers.filter(function (o) { return o.state === 'wait'; }).length;
  var kpi = function (label, v, go, bad, flag) { return '<' + (go ? 'button data-act="go" data-view="' + go + '"' : 'div') + ' class="kpi' + (go ? ' go' : '') + '"><span>' + label + '</span><b' + (bad ? ' class="bad"' : '') + '>' + v + (flag ? '<em class="kflag">' + flag + '</em>' : '') + '</b></' + (go ? 'button' : 'div') + '>'; };
  var cnt = function (n, bad) { return n ? '<span class="cc' + (bad ? ' bad' : '') + '">' + n + '</span>' : ''; };
  var card = function (title, inner, go, cls) { return '<div class="card' + (cls ? ' ' + cls : '') + '"><div class="ch"><span class="cht">' + title + '</span>' + (go ? '<button data-act="go" data-view="' + go + '" aria-label="' + title + 'を開く" title="開く">' + GO + '</button>' : '') + '</div><div class="cb">' + inner + '</div></div>'; };
  var none = '<div class="empty sm">なし</div>';


  // 動き（イベント・期限・対応）
  var ks = [], cards = [];
  var sec = function (title, k, c, cols) { return (k.length || c.length) ? '<section class="dsec"><h2>' + title + '</h2>' + (k.length ? '<div class="kpis k' + cols + '">' + k.join('') + '</div>' : '') + (c.length ? '<div class="dg' + cols + '">' + c.join('') + '</div>' : '') + '</section>' : ''; };
  if (can('projects')) {
    var scope = isAdmin() ? all : all.filter(function (o) { return chainHas(o.k, m.id); });
    var lateN = scope.filter(function (o) { return late(o.k); }).length;
    var lv = (isAdmin() ? live : live.filter(function (p) { return involved(p, m.id); }));
    ks.push(kpi('進行中のイベント', lv.length, 'projects', false, lateN ? '遅れ ' + lateN : ''));
    var soon = scope.filter(function (o) { return !o.k.done && !o.k.nodate && dayOf(o.k.end) <= TODAY + 14 * DAY; }).sort(function (a, b) { return dayOf(a.k.end) - dayOf(b.k.end); }).slice(0, 6);
    cards.push(card('期限が近いファイル', soon.length ? soon.map(function (o) {
      var du = dueLabel(o.k), who = fileWho(o.k);
      return '<button class="mr soon" data-act="open" data-id="' + o.k.id + '"><span class="mt">' + FILE + '<b>' + esc(ttl(o.k)) + '</b><span class="ms"><span class="dd ' + du.c + '">' + du.t + '</span><span class="dp">' + esc(ttl(parentOf(o.k) || o.p)) + '</span></span></span><span class="mwho">' + (who.length ? avStack(who) + '<span>' + esc(fwNames(o.k)) + '</span>' : '<span class="dim">担当未定</span>') + '</span><span class="mact">' + GO + '</span></button>';
    }).join('') : none, 'projects'));
    var ps = lv.slice().sort(function (a, b) { return dayOf(a.end) - dayOf(b.end); });
    cards.push(card('イベント', ps.length ? ps.map(function (p) {
      var g = progress(p);
      return '<button class="li" data-act="open" data-id="' + p.id + '"><span class="t"><b>' + esc(p.name) + '</b><span class="num">' + fmtDate(p.start) + ' – ' + fmtDate(p.end) + '</span></span><span class="prog"><span class="b"><i style="width:' + (g.n ? Math.round(g.d / g.n * 100) : 0) + '%"></i></span><span class="num muted" style="font-size:12px">' + g.d + '/' + g.n + '</span></span>' + (g.late ? '<span class="r cc bad">遅れ ' + g.late + '</span>' : '') + '</button>';
    }).join('') : none, 'projects'));
  }
  if (can('board') || can('notices') || can('tracks')) {
    var todo = [];
    if (can('board') && rep) todo.push(['board', '通報', rep]);
    if (can('notices') && off) todo.push(['notices', '情報提供', off]);
    if (can('notices')) { var dr = S.notices.filter(function (n) { return n.state === 'draft'; }).length; if (dr) todo.push(['notices', '下書きの告知', dr]); }
    if (can('tracks')) { var td = S.tracks.filter(function (t) { return t.status === 'draft'; }).length; if (td) todo.push(['tracks', '下書きのトラック', td]); }
    var tn = todo.reduce(function (a, x) { return a + x[2]; }, 0);
    ks.push(kpi('要対応', tn, todo.length ? todo[0][0] : null, tn > 0));
    if (!can('projects')) cards.push(card('要対応', todo.length ? todo.map(function (x) { return '<button class="li" data-act="go" data-view="' + x[0] + '"><span class="t"><b>' + x[1] + '</b></span><span class="r num">' + x[2] + '</span></button>'; }).join('') : none));
  }
  if (cards.length % 2) cards.push('<div class="card ghostc" aria-hidden="true"></div>');
  var flow = sec('進行中', ks, cards, 2);

  // 統計
  var sk = [], sc = [];
  if (can('projects')) {
    var fin = allEvents().filter(function (p) { return isEvent(p) && ended(p); }).sort(function (a, b) { return dayOf(b.end) - dayOf(a.end); });
    var avg = fin.length ? Math.round(fin.reduce(function (n, p) { return n + pct(p); }, 0) / fin.length) : 0;
    sk.push(kpi('平均参加率', avg + '%'));
    sc.push('<div class="card"><div class="ch"><span class="cht">参加率</span><button data-act="pstats" aria-label="参加率を開く" title="開く">' + GO + '</button></div><div class="cb"><div class="hbs">' +
      (fin.length ? fin.slice(0, 5).map(function (p) { return '<div class="hb"><span class="l">' + esc(p.name) + '</span><span class="b"><i style="width:' + pct(p) + '%"></i></span><span class="v">' + pct(p) + '%</span></div>'; }).join('') : none) + '</div></div></div>');
  }
  if (can('tracks')) {
    var U = 0, D = 0;
    var tr = S.tracks.map(function (t) {
      var us = parse(t.text).units, n = us.length, d = us.filter(function (u) { return t.units[u.code] && (t.units[u.code].materials || []).length; }).length; U += n; D += d;
      return '<div class="hb"><span class="l">' + esc(t.name) + '</span><span class="b"><i style="width:' + (n ? Math.round(d / n * 100) : 0) + '%"></i></span><span class="v">' + d + '/' + n + '</span></div>';
    }).join('');
    sk.push(kpi('教材の登録', (U ? Math.round(D / U * 100) : 0) + '%', 'tracks'));
    sc.push(card('教材の登録', '<div class="hbs">' + (tr || none) + '</div>', 'tracks'));
  }
  if (isAdmin()) {
    sk.push(kpi('メンバー', S.members.length, 'perms'));
    var roles = ['Innovator', 'Strategist', 'Negotiator', 'Advertiser', 'Engineer'], mx = 1;
    var rc = roles.map(function (r) { var c = pl.filter(function (x) { return (x.roles || []).indexOf(r) >= 0; }).length; mx = Math.max(mx, c); return c; });
    sc.push(card('ロール', '<div class="hbs">' + roles.map(function (r, i) { return '<div class="hb"><span class="l">' + r + '</span><span class="b"><i style="width:' + Math.round(rc[i] / mx * 100) + '%"></i></span><span class="v">' + rc[i] + '</span></div>'; }).join('') + '</div>', 'perms'));
  }
  var stats = '<section class="dsec"><h2>統計</h2>' + (sk.length ? '<div class="kpis k' + Math.max(1, sc.length) + '">' + sk.join('') + '</div>' : '') + (sc.length ? '<div class="dg' + Math.max(1, sc.length) + '">' + sc.join('') + '</div>' : '') + patchCards() + '</section>';
  // 自分／進行中／統計をタブで切り替える（見出しはタブが兼ねる）
  var secs = [['me', '自分', dashSelf()]]; if (flow) secs.push(['now', '進行中', flow]); secs.push(['stats', '統計', stats]);
  var sel = secs.filter(function (x) { return x[0] === S.dtab; })[0]; if (!sel) { S.dtab = 'me'; sel = secs[0]; }
  var d0 = new Date(TODAY);
  return top('ダッシュボード', '<span class="muted num" style="font-size:12px">' + (d0.getUTCMonth() + 1) + '/' + d0.getUTCDate() + '</span>') + utabs('dtab', secs.map(function (x) { return [x[0], x[1]]; })) + '<div class="body dash">' + sel[2].replace(/<h2>[\s\S]*?<\/h2>/, '') + '</div>';
}

// ---------- ux4: イベント追加は右下の＋ ----------
document.addEventListener('click', function (e) {
  var b = e.target.closest && e.target.closest('[data-act="addEvent"]'); if (!b) return;
  e.stopImmediatePropagation(); if (!isAdmin()) return;
  var ev = addUnder(null, '新しいイベント'); if (S.wtab !== 'list') S.wtab = 'list';
  rerender({ id: ev.id, c: 't' });
  var el = document.querySelector('.cell[data-id="' + ev.id + '"][data-c="t"]'); if (el) { el.select(); el.scrollIntoView({ block: 'center' }); }
}, true);

// ---------- ux5: 業務＝全体ガントで俯瞰、イベントの記録は右のパネル ----------
function seriesOf(p) { return String(p.name || '').replace(/\s*(19|20)\d{2}\s*/g, ' ').trim() || p.name; }
function fyOf(p) { var d = new Date(dayOf(p.start)); return d.getUTCMonth() < 3 ? d.getUTCFullYear() - 1 : d.getUTCFullYear(); }
function pf() { if (!S.pf) S.pf = { st: 'now', fy: '', ser: '' }; return S.pf; }
document.addEventListener('click', function (e) {
  var b = e.target.closest && e.target.closest('[data-pf]'); if (!b) return;
  e.stopImmediatePropagation(); pf()[b.dataset.pf] = b.dataset.v; save(); render();
}, true);
document.addEventListener('change', function (e) {
  var el = e.target; if (!el.dataset || !el.dataset.pfs) return;
  e.stopImmediatePropagation(); pf()[el.dataset.pfs] = el.value; save(); render();
}, true);


// ----- 右のパネル（イベントの記録・参加率）
function recOK(p) { return isAdmin() || isLead(p, S.me); }
function recHTML(p) {
  var ok = recOK(p), dis = ok ? '' : ' disabled', g = progress(p), lk = p.links || [], ev = isEvent(p), fo = curFolder();
  var f = function (label, inner) { return '<div class="rf"><label>' + label + '</label>' + inner + '</div>'; };
  return '<div class="rh"><div class="rt"><small>' + esc(seriesOf(p)) + '・' + fyOf(p) + '年度</small><b>' + esc('name' in p ? p.name : ttl(p)) + '</b></div><button class="ib" data-act="recClose" aria-label="閉じる">' + ic('x') + '</button></div>' +
    '<div class="rb">' +
    '<section><h3>概要</h3><label class="evt"><input type="checkbox" class="check" data-evt="1"' + (ev ? ' checked' : '') + (ok ? '' : ' disabled') + '>イベント（参加数を記録して統計に入れる）</label>' +
      f('目的', '<textarea class="input" rows="2" data-rf="purpose"' + dis + ' placeholder="何のためのイベントか">' + esc(p.purpose || '') + '</textarea>') +
      '<div class="two">' + f('日程', '<div class="rv num">' + shortDate(p.start) + ' – ' + shortDate(p.end) + '</div>') + f('場所', '<input class="input" data-rf="place"' + dis + ' value="' + esc(p.place || '') + '">') + '</div>' +
      (ev ? '<div class="two">' + f('担当部', '<select class="input" data-rf="unit"' + dis + '>' + ['教育部', '催事部', '外務部', '会計', '代表'].map(function (u) { return '<option' + (p.unit === u ? ' selected' : '') + '>' + u + '</option>'; }).join('') + '</select>') +
        f('告知', '<select class="input" data-rf="announce"' + dis + '><option value="before"' + (p.announce !== 'done' ? ' selected' : '') + '>告知前</option><option value="done"' + (p.announce === 'done' ? ' selected' : '') + '>告知済み</option></select>') + '</div>' : '') +
    '</section>' +
    '<section><h3>体制</h3>' + f('リーダー・メンバー', '<div class="mfield">' + teamBtn(p, editSelf(p) ? '' : ' disabled') + '</div>') +
      '<div class="rv muted">業務 ' + g.n + '件・完了 ' + g.d + (g.late ? '・<span class="bad">遅れ ' + g.late + '</span>' : '') + '</div></section>' +
    '<section><h3>結果</h3>' +
      (ev ? '<div class="two">' + f('参加数', '<input class="input num" type="number" min="0" data-rf="reg"' + dis + ' value="' + (p.reg || 0) + '">') + f('参加率', '<div class="rv num">' + pct(p) + '%<small class="muted">（部員 ' + (S.club || 150) + '）</small></div>') + '</div>' : '') +
      f('振り返り', '<textarea class="input" rows="4" data-rf="review"' + dis + ' placeholder="良かったこと・次回への改善">' + esc(p.review || '') + '</textarea>') +
      f('資料', '<div class="rl">' + lk.map(function (u, i) { return '<div class="rli"><a href="' + esc(u) + '" target="_blank" rel="noopener">' + esc(host(u) || u) + ' ↗</a>' + (ok ? '<button class="ib" data-act="recLinkDel" data-i="' + i + '" aria-label="削除">' + ic('x') + '</button>' : '') + '</div>'; }).join('') +
        (ok ? '<input class="input" data-rlink="1" placeholder="URL を貼って Enter" autocomplete="off">' : (lk.length ? '' : '<span class="dim">—</span>')) + '</div>') +
    '</section>' +
    '<div class="rfoot">' + (editSelf(p) ? '<button class="btn sm" data-act="edit" data-id="' + p.id + '">名前・期間を編集</button>' : '') + (fo && fo.id === p.id && manages(parentOf(p)) ? '<button class="btn sm" data-act="dupF">複製</button>' : '') + '</div></div>';
}
function statsHTML() { return '<div class="rh"><div class="rt"><b>イベント参加率</b></div><button class="ib" data-act="recClose" aria-label="閉じる">' + ic('x') + '</button></div><div class="rb">' + projStats() + '</div>'; }
function drawRec() {
  var d = document.getElementById('rec');
  var p = UI.rec && UI.rec !== 'stats' ? task(UI.rec) : null;
  if (!UI.rec || (UI.rec !== 'stats' && !p)) { if (d) d.remove(); if (!(S.view === 'tracks' && S.sel)) document.body.classList.remove('recon'); UI.rec = null; return; }
  if (!d) { d = document.createElement('aside'); d.id = 'rec'; d.className = 'rec'; d.setAttribute('aria-label', 'イベントの記録'); document.body.appendChild(d); }
  var a = document.activeElement, keep = a && d.contains(a) && a.dataset ? (a.dataset.rf || (a.dataset.rlink ? 'rlink' : '')) : '';
  d.innerHTML = UI.rec === 'stats' ? statsHTML() : recHTML(p);
  document.body.classList.add('recon');
  if (keep) { var el = d.querySelector(keep === 'rlink' ? '[data-rlink]' : '[data-rf="' + keep + '"]'); if (el) el.focus(); }
}
document.addEventListener('click', function (e) {
  var b = e.target.closest && e.target.closest('[data-act="rec"],[data-act="recClose"],[data-act="recLinkDel"],[data-act="pstats"]'); if (!b) return;
  e.stopImmediatePropagation(); e.preventDefault();
  var a = b.dataset.act;
  if (a === 'rec') UI.rec = UI.rec === b.dataset.id ? null : b.dataset.id;
  else if (a === 'pstats') UI.rec = 'stats';
  else if (a === 'recClose') UI.rec = null;
  else if (a === 'recLinkDel') { var p = task(UI.rec); if (p && p.links) { p.links.splice(+b.dataset.i, 1); save(); } }
  render();
}, true);
document.addEventListener('input', function (e) {
  var el = e.target; if (!el.dataset || !el.dataset.rf || el.tagName === 'SELECT') return;
  var p = task(UI.rec); if (!p || !recOK(p)) return;
  p[el.dataset.rf] = el.dataset.rf === 'reg' ? Math.max(0, +el.value || 0) : el.value; save();
  if (el.dataset.rf === 'reg') { var v = el.closest('.two').querySelectorAll('.rv')[0]; if (v) v.firstChild.textContent = pct(p) + '%'; }
}, true);
document.addEventListener('change', function (e) {
  var el = e.target; if (!el.dataset || !el.dataset.rf) return;
  var p = task(UI.rec); if (!p || !recOK(p)) return; e.stopImmediatePropagation();
  if (el.tagName === 'SELECT') { p[el.dataset.rf] = el.value; if (el.dataset.rf === 'announce') p.kind = 'event'; save(); render(); }
  else if (el.dataset.rf === 'reg') render();
}, true);
document.addEventListener('keydown', function (e) {
  var el = e.target;
  if (el.dataset && el.dataset.rlink && e.key === 'Enter') {
    e.preventDefault(); var v = el.value.trim(), p = task(UI.rec); if (!v || !p) return;
    if (!/^https?:\/\//i.test(v)) v = 'https://' + v;
    (p.links = p.links || []).push(v); save(); render(); return;
  }
  if (e.key === 'Escape' && UI.rec && !document.getElementById('tp')) { UI.rec = null; render(); }
});

// ----- ＋：新しいイベント／過去のイベントから作る
function nextName(n) { return /(19|20)\d{2}/.test(n) ? n.replace(/(19|20)\d{2}/, function (y) { return String(+y + 1); }) : n + '（コピー）'; }
function copyModal() {
  var src = S.projects.slice().sort(function (a, b) { return dayOf(b.start) - dayOf(a.start); });
  var pick = src.filter(function (p) { return nodesOf(p).length > 1; })[0] || src[0];
  return dlg('過去のイベントから作る',
    '<div class="fld"><label for="cpS">元にするイベント</label><select id="cpS" class="input">' + src.map(function (p) { return '<option value="' + p.id + '"' + (p === pick ? ' selected' : '') + '>' + esc(p.name) + '（' + shortDate(p.start) + '・業務 ' + (nodesOf(p).length - 1) + '件）</option>'; }).join('') + '</select></div>' +
    '<div class="two"><div class="fld"><label for="cpN">名前</label><input id="cpN" class="input" value="' + esc(pick ? nextName(pick.name) : '') + '"></div><div class="fld"><label for="cpD">開始日</label><input id="cpD" class="input num" type="date" value="' + (pick ? isoOf(dayOf(pick.start) + 364 * DAY) : isoOf(TODAY)) + '"></div></div>' +
    '<div class="muted" style="font-size:12px">業務の構成と期間の長さをコピーします。担当者・完了・結果はコピーしません。</div>',
    '<span class="sp"></span><button class="btn" data-act="close">やめる</button><button class="btn primary" data-act="cpGo">作成</button>');
}
document.addEventListener('change', function (e) {
  if (e.target.id !== 'cpS') return; var p = task(e.target.value); if (!p) return;
  document.getElementById('cpN').value = nextName(p.name); document.getElementById('cpD').value = isoOf(dayOf(p.start) + 364 * DAY);
}, true);
function placeFab() {
  var f = document.querySelector('.efabw'); if (f) f.remove(); var h = fabHTML(); if (h) document.body.insertAdjacentHTML('beforeend', h);
  f = document.querySelector('.efabw'); var nav = document.querySelector('.nav'); // スマホ：下のタブバーの上に置く
  if (!f || !nav || innerWidth > 760) return;
  var r = nav.getBoundingClientRect(); if (r.height) f.style.setProperty('bottom', (innerHeight - r.top + 16) + 'px', 'important');
}
document.addEventListener('click', function (e) {
  var b = e.target.closest && e.target.closest('[data-act="fabMenu"],[data-act="copyEvent"],[data-act="cpGo"]');
  if (!b) { if (UI.fm && !(e.target.closest && e.target.closest('.efabw'))) { UI.fm = false; placeFab(); } return; }
  e.stopImmediatePropagation(); e.preventDefault();
  var a = b.dataset.act;
  if (a === 'fabMenu') { UI.fm = !UI.fm; placeFab(); return; }
  if (a === 'copyEvent') { UI.fm = false; placeFab(); renderCopy(); return; }
  if (a === 'cpGo') {
    var src = task(val('cpS')), nm = val('cpN').trim(), d = val('cpD'); if (!src || !nm || !d) { toast('名前と開始日を入れてください'); return; }
    var delta = dayOf(d) - dayOf(src.start);
    var ev = { id: uid('pj'), name: nm, kind: src.kind || 'event', announce: 'before', reg: 0, unit: src.unit, who: '', start: d, end: isoOf(dayOf(src.end) + delta), tasks: cloneKids(src, delta), purpose: src.purpose || '', place: src.place || '' };
    S.projects.push(ev); closeCopy(); pf().st = 'all'; pf().fy = ''; pf().ser = ''; UI.rec = ev.id; save(); render(); toast('「' + nm + '」を作りました');
  }
}, true);
function renderCopy() { var o = document.getElementById('cpov'); if (!o) { o = document.createElement('div'); o.id = 'cpov'; document.body.appendChild(o); } o.innerHTML = copyModal(); var f = o.querySelector('#cpN'); if (f) f.focus(); }
function closeCopy() { var o = document.getElementById('cpov'); if (o) o.remove(); }
document.addEventListener('click', function (e) {
  var o = document.getElementById('cpov'); if (!o || !o.contains(e.target)) return;
  var b = e.target.closest('[data-act]'); if (!b) return;
  if (b.dataset.act === 'close') { e.stopImmediatePropagation(); if (!b.classList.contains('ov') || e.target === b) closeCopy(); }
}, true);

