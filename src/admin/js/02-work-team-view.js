// ---------------- 複数人の担当（リーダー＋メンバー） ----------------
function whoOpts(n) { // 担当の選択肢：選べる人が決まっていればその人だけ、なければ上の段のメンバーを先に
  var pk = pickable(n); if (pk) return '<option value="">未定</option>' + S.members.filter(function (m) { return pk.indexOf(m.id) >= 0 || n.who === m.id; }).map(function (m) { return '<option value="' + m.id + '"' + (n.who === m.id ? ' selected' : '') + '>' + esc(m.name) + '</option>'; }).join('');
  var p = parentOf(n), pt = p ? teamOf(p) : [], o = function (m) { return '<option value="' + m.id + '"' + (n.who === m.id ? ' selected' : '') + '>' + esc(m.name) + '</option>'; };
  var inT = S.members.filter(function (m) { return pt.indexOf(m.id) >= 0; }), out = S.members.filter(function (m) { return pt.indexOf(m.id) < 0; });
  return '<option value="">未定</option>' + (inT.length ? '<optgroup label="' + esc(ttl(p)) + 'のメンバー">' + inT.map(o).join('') + '</optgroup><optgroup label="その他">' + out.map(o).join('') + '</optgroup>' : out.map(o).join(''));
}
function openTeam(id, keep) {
  var n = task(id), btn = document.querySelector('.tbtn[data-id="' + id + '"]'), tp = document.getElementById('tp');
  if (!n || !btn) { if (tp) tp.remove(); UI.tp = null; return; }
  if (!tp) { tp = document.createElement('div'); tp.id = 'tp'; tp.className = 'tp'; document.body.appendChild(tp); }
  UI.tp = id; var q = keep ? (UI.tpq || '') : ''; if (!keep) UI.tpq = '';
  var p = parentOf(n), pt = p ? teamOf(p) : [], tm = teamOf(n);
  var f = function (m) { return !q || (m.name + (m.unit || '') + (m.roles || []).join('')).indexOf(q) >= 0; };
  var row = function (m) {
    var on = tm.indexOf(m.id) >= 0, lead = isLead(n, m.id);
    return '<div class="tpi"><label><input type="checkbox" class="check" data-tm="' + m.id + '" data-id="' + id + '"' + (on ? ' checked' : '') + '>' + av(m.id) + '<span>' + esc(m.name) + '</span><small>' + esc(isOps(m) ? m.unit : (m.roles || []).join('・')) + '</small></label>' +
      '<button class="lead" data-act="teamLead" data-id="' + id + '" data-m="' + m.id + '" aria-pressed="' + lead + '"' + (on ? '' : ' hidden') + ' title="' + (lead ? 'リーダーを外す' : 'リーダーにする') + '" aria-label="リーダー">' + CROWN + '</button></div>';
  };
  var a = S.members.filter(function (m) { return pt.indexOf(m.id) >= 0 && f(m); }), b = S.members.filter(function (m) { return pt.indexOf(m.id) < 0 && f(m); });
  tp.innerHTML = '<input class="input tpq" type="search" placeholder="名前・役職で絞り込み" value="' + esc(q) + '" aria-label="メンバーを検索">' +
    '<div class="tpl">' + (a.length ? '<div class="tph"><span>' + esc(ttl(p)) + 'のメンバー</span></div>' + a.map(row).join('') : '') +
      (b.length ? (a.length ? '<div class="tph"><span>その他</span></div>' : '') + b.map(row).join('') : '') + '</div>';
  var r = btn.getBoundingClientRect(), left = Math.min(window.innerWidth - 328, Math.max(8, r.left));
  tp.style.left = left + 'px'; var below = window.innerHeight - r.bottom > 360;
  tp.style.top = below ? (r.bottom + 4) + 'px' : ''; tp.style.bottom = below ? '' : (window.innerHeight - r.top + 4) + 'px';
  if (!keep) { var qi = tp.querySelector('.tpq'); if (window.innerWidth > 760) qi.focus(); }
  var pk = pickable(n), pf = pickFrom(n);
  if (pk) { // フォルダのメンバー以外は出さない（今いる人は外すだけできる）
    var has = isFolder(n) ? teamOf(n) : fileWho(n); Array.prototype.forEach.call(tp.querySelectorAll('.tpi'), function (r) { var c = r.querySelector('[data-tm]'); if (c && pk.indexOf(c.dataset.tm) < 0 && has.indexOf(c.dataset.tm) < 0) r.remove(); });
    Array.prototype.forEach.call(tp.querySelectorAll('.tph'), function (h) { if (/その他/.test(h.textContent)) { var nx = h.nextElementSibling; if (!nx || !nx.classList.contains('tpi')) h.remove(); else h.innerHTML = '<span>フォルダのメンバー外（外すだけできます）</span>'; } });
    tp.querySelector('.tpl').insertAdjacentHTML('beforeend', '<div class="tpnote">' + (pf ? '「' + esc(ttl(pf)) + '」のメンバーから選べます' : 'いちばん上の業務のメンバーは、代表が決めます') + '</div>');
  }
  if (!isFolder(n)) { // ファイル：リーダーはなし。今の担当にチェック
    var cur = fileWho(n);
    Array.prototype.forEach.call(tp.querySelectorAll('.lead'), function (b) { b.remove(); });
    Array.prototype.forEach.call(tp.querySelectorAll('[data-tm]'), function (c) { c.checked = cur.indexOf(c.dataset.tm) >= 0; c.dataset.fileWho = '1'; });
  }
}
function closeTeam() { var tp = document.getElementById('tp'); if (tp) tp.remove(); UI.tp = null; UI.tpq = ''; }
function teamChanged(n, added) {
  if (UI.gedit) UI.gfocus = false; // ガントの行内編集中は名前欄にフォーカスを戻さない
  save(); var id = n.id;
  added.forEach(function (m) { window.notify(m, '「' + ttl(n) + '」のメンバーになりました', ttl(rootOf(n))); });
  var fq = document.activeElement && document.activeElement.classList.contains('tpq');
  if (M) { var ob = document.querySelector('.dlg .tbtn[data-id="' + id + '"]'); if (ob) ob.outerHTML = teamBtn(n, ''); } else render();
  openTeam(id, true); if (fq) { var qi = document.querySelector('#tp .tpq'); if (qi) { qi.focus(); qi.setSelectionRange(qi.value.length, qi.value.length); } }
  UI.gfocus = true;
}
document.addEventListener('change', function (e) {
  var el = e.target; if (!el.dataset || !el.dataset.tm) return; e.stopImmediatePropagation();
  var n = task(el.dataset.id), m = el.dataset.tm; if (!n) return;
  var t = teamOf(n);
  if (el.checked) { if (t.indexOf(m) < 0) t.push(m); n.team = t; if (!leadsOf(n).length) setLeads(n, [m]); teamChanged(n, [m]); toast(member(m).name + 'に通知しました'); }
  else { n.team = t.filter(function (x) { return x !== m; }); if (isLead(n, m)) setLeads(n, leadsOf(n).filter(function (x) { return x !== m; })); teamChanged(n, []); }
}, true);
document.addEventListener('click', function (e) {
  var tp = document.getElementById('tp');
  if (tp && !tp.contains(e.target) && !(e.target.closest && e.target.closest('.tbtn'))) closeTeam();
  var b = e.target.closest && e.target.closest('[data-act="teamPick"],[data-act="teamLead"]'); if (!b) return;
  e.stopImmediatePropagation(); e.preventDefault();
  if (b.dataset.act === 'teamPick') { if (UI.tp === b.dataset.id) closeTeam(); else openTeam(b.dataset.id); return; }
  var n = task(b.dataset.id); if (!n) return; var t = teamOf(n);
  if (t.indexOf(b.dataset.m) < 0) t.push(b.dataset.m); n.team = t;
  var lm = b.dataset.m, ls = leadsOf(n);
  if (ls.indexOf(lm) < 0) { setLeads(n, ls.concat([lm])); window.notify(lm, '「' + ttl(n) + '」のリーダーになりました', ttl(rootOf(n))); }
  else setLeads(n, ls.filter(function (x) { return x !== lm; }));
  teamChanged(n, []);
}, true);
document.addEventListener('input', function (e) { if (e.target.classList && e.target.classList.contains('tpq')) { UI.tpq = e.target.value; openTeam(UI.tp, true); var qi = document.querySelector('#tp .tpq'); if (qi) { qi.focus(); qi.setSelectionRange(qi.value.length, qi.value.length); } } });
document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && UI.tp) { var id = UI.tp; closeTeam(); var b = document.querySelector('.tbtn[data-id="' + id + '"]'); if (b) b.focus(); } });
window.addEventListener('resize', function () { if (UI.tp) closeTeam(); });
document.addEventListener('scroll', function (e) { if (UI.tp && !(e.target.closest && e.target.closest('#tp'))) { var b = document.querySelector('.tbtn[data-id="' + UI.tp + '"]'); if (!b) closeTeam(); else openTeam(UI.tp, true); } }, true);

// ---------------- 業務：表示設定（展開 × 強調） ----------------
var HLS = [
  ['late', '期限切れ', '#DC2626'],
  ['soon', '期限が近い', '#D97706'],
  ['nobody', '担当未定', '#6B7280'],
  ['active', '進行中', '#2563EB'],
  ['mine', '自分の担当', '#111827']
];
function isActiveN(n) { return !isDone(n) && dayOf(n.start) <= TODAY && TODAY <= dayOf(n.end); }
function hasBelow(n, pred) { return kids(n).some(function (k) { return pred(k) || hasBelow(k, pred); }); }
function isOpen(n, d) {
  if (S.fold && S.fold[n.id] != null) return !S.fold[n.id];
  var m = vs().exp;
  if (m === 'active') return isActiveN(n);
  if (m === 'mine') return hasBelow(n, function (k) { return inTeam(k, S.me); });
  if (m === 'flag') return hasBelow(n, function (k) { return hlFlags(k).length > 0; });
  return d + 1 < (S.depth || 2);
}
var EXPS = [['depth', '段ごと'], ['active', '進行中のみ', '今日が期間内の業務だけ開く'], ['mine', '自分の担当まで', '自分が入っている業務まで開く'], ['flag', '強調した業務まで', '強調に当てはまる業務まで開く']];
function openVPanel() {
  var b = document.querySelector('.vbtn'), p = document.getElementById('vp');
  if (!b) { if (p) p.remove(); UI.vp = false; return; }
  if (!p) { p = document.createElement('div'); p.id = 'vp'; p.className = 'vp'; p.setAttribute('role', 'dialog'); p.setAttribute('aria-label', '表示設定'); document.body.appendChild(p); }
  UI.vp = true; p.innerHTML = vPanelHTML();
  if (window.innerWidth < 760) { p.classList.add('sheet'); p.style.left = p.style.top = ''; }
  else { p.classList.remove('sheet'); var r = b.getBoundingClientRect(); p.style.left = Math.max(8, Math.min(window.innerWidth - 348, r.left)) + 'px'; p.style.top = (r.bottom + 6) + 'px'; }
  b.setAttribute('aria-expanded', 'true');
  if (!p.classList.contains('sheet')) p.style.maxHeight = Math.max(240, window.innerHeight - p.getBoundingClientRect().top - 16) + 'px';
}
function closeVPanel() { var p = document.getElementById('vp'); if (p) p.remove(); UI.vp = false; var b = document.querySelector('.vbtn'); if (b) b.setAttribute('aria-expanded', 'false'); }

// ツールバーを「表示」ボタンにまとめ、行に強調をつける（描画のあとで整える）
function decorateWork() {
  if (S.view !== 'projects' || S.wtab === 'stats') return;
  var tb = document.querySelector('.tbar'); if (tb && !tb.querySelector('.vbtn')) {
    Array.prototype.slice.call(tb.children).forEach(function (c) { if (c.classList.contains('seg') || c.classList.contains('chk') || (c.classList.contains('muted') && c.textContent === '表示')) c.remove(); });
    var on = HLS.filter(function (h) { return vs().hl[h[0]]; });
    tb.insertAdjacentHTML('afterbegin', '<button class="btn sm vbtn" data-act="vpanel" aria-haspopup="dialog" aria-expanded="' + !!UI.vp + '"><svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="17" r="2"/></svg>表示<span class="vsum">' + esc(vSummary()) + '</span>' +
      (on.length ? '<span class="vdots">' + on.map(function (h) { return '<i style="background:' + h[2] + '"></i>'; }).join('') + '</span>' : '') + '</button>');
  }
  var v = vs();
  document.querySelectorAll('.wcards .wr[data-row], .gg .gr[data-row]').forEach(function (row) {
    var n = task(row.dataset.row); if (!n) return;
    var f = hlFlags(n), gantt = row.classList.contains('gr');
    if (v.focus && !f.length) row.classList.add('hldim');
    if (v.dimDone && isDone(n)) row.classList.add('dndim');
    if (!f.length) return;
    var col = HLS.filter(function (h) { return h[0] === f[0]; })[0][2];
    row.classList.add('hl', 'hl-' + f[0]); row.style.setProperty('--hc', col);
    var chips = f.map(function (k) {
      var h = HLS.filter(function (x) { return x[0] === k; })[0], t = h[1];
      if (k === 'soon') { var dd = Math.round((dayOf(n.end) - TODAY) / DAY); t = dd === 0 ? '今日まで' : 'あと' + dd + '日'; }
      if (k === 'late') t = Math.round((TODAY - dayOf(n.end)) / DAY) + '日超過';
      if (k === 'mine') t = '自分';
      return '<span class="hlc" style="--c:' + h[2] + '">' + t + '</span>';
    }).join('');
    if (gantt) {
      var bar = row.querySelector('.bar'); if (bar) { bar.classList.add('hlb', 'hlb-' + f[0]); bar.style.setProperty('--hc', col); }
      var ct = row.querySelector('.gl .ct'); if (ct) ct.insertAdjacentHTML('afterend', '<span class="hlcs">' + chips + '</span>');
    } else {
      var wtx = row.querySelector('.wtx'); if (wtx) wtx.insertAdjacentHTML('afterend', '<span class="hlcs">' + chips + '</span>');
    }
  });
}
document.addEventListener('click', function (e) {
  var p = document.getElementById('vp');
  var b = e.target.closest && e.target.closest('[data-act]');
  if (p && !p.contains(e.target) && !(b && b.dataset.act === 'vpanel')) { closeVPanel(); }
  if (!b) return; var a = b.dataset.act, v = vs(), hit = true;
  switch (a) {
    case 'vpanel': if (UI.vp) closeVPanel(); else openVPanel(); break;
    case 'vclose': closeVPanel(); var vb = document.querySelector('.vbtn'); if (vb) vb.focus(); break;
    case 'vdepth': v.exp = 'depth'; S.depth = +b.dataset.v; vApply(); break;
    case 'vdays': v.days = +b.dataset.v; v.hl.soon = true; vApply(); break;
    case 'vreset': S.view2 = null; S.depth = 2; S.showEnded = false; vApply(); break;
    default: hit = false;
  }
  if (hit) { e.stopImmediatePropagation(); e.preventDefault(); }
}, true);
document.addEventListener('change', function (e) {
  var el = e.target, d = el.dataset; if (!d) return; var v = vs();
  if (d.vexp) { v.exp = d.vexp; }
  else if (d.vhl) { v.hl[d.vhl] = el.checked; }
  else if (d.vopt) { v[d.vopt] = el.checked; }
  else if (d.vend) { S.showEnded = el.checked; }
  else return;
  e.stopImmediatePropagation(); vApply();
}, true);
document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && UI.vp) { closeVPanel(); var vb = document.querySelector('.vbtn'); if (vb) vb.focus(); } });
window.addEventListener('resize', function () { if (UI.vp) openVPanel(); });

