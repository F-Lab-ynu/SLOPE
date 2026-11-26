// ---------- ux54 ファイルも担当を複数に。下の段の担当は、上のフォルダのメンバーからだけ選べる ----------
function pickFrom(n) { return parentOf(n) || null; } // 担当の候補を決める、すぐ上のフォルダー
function pickable(n) { var a = pickFrom(n); if (a) return teamOf(a); return isAdmin() ? null : []; } // null＝制限なし（いちばん上の段を代表が決めるときだけ）。それ以外は代表も含め、すぐ上のフォルダーのメンバーからだけ選べる（未定なら誰も選べない）
function fwNames(n) { return fileWho(n).map(function (id) { var m = member(id); return m ? m.name : ''; }).join('・'); }
function fileWho(n) { var t = (n.team || []).slice(); if (n.who && t.indexOf(n.who) < 0) t.unshift(n.who); return t; }
function setFileWho(n, list) { n.team = list.slice(); n.who = list[0] || ''; delete n.leads; }
window.addEventListener('change', function (e) {
  var el = e.target; if (!el.dataset || !el.dataset.tm || !el.dataset.fileWho) return; e.stopImmediatePropagation();
  var n = task(el.dataset.id), m = el.dataset.tm; if (!n) return; if (!canAssign(n)) { el.checked = !el.checked; toast('担当を変えられるのは、このフォルダのリーダーです'); return; }
  snap(); var t = fileWho(n);
  var pk = pickable(n); if (el.checked && pk && pk.indexOf(m) < 0) { el.checked = false; toast('フォルダのメンバーから選んでください'); return; }
  if (el.checked) { if (t.indexOf(m) < 0) t.push(m); notifyAssign(n, m); toast(member(m).name + 'に知らせます'); }
  else t = t.filter(function (x) { return x !== m; });
  setFileWho(n, t); save(); render(); openTeam(n.id, true);
}, true);
// 一人しか選べない欄（担当のセレクト）は、複数選べるボタンに置きかえる
function fwSwap() {
  Array.prototype.forEach.call(document.querySelectorAll('select[data-c="w"][data-id], select.gsel2, .fwho'), function (el) {
    var id = el.dataset.id || (el.querySelector && el.querySelector('[data-fw]') ? el.querySelector('[data-fw]').dataset.fw : null) || UI.gedit, n = id && task(id); if (!n || isFolder(n)) return;
    var dis = (el.disabled || (el.tagName !== 'SELECT' && !canAssign(n))) ? ' disabled' : '';
    var w = document.createElement('span'); w.innerHTML = teamBtn(n, dis, el.classList.contains('gsel')); el.replaceWith(w.firstChild);
  });
}
// ガントの編集を確定しても、担当は上で直接変わっているので上書きしない
// ---------- ux55 ダッシュボード：自分の担当を見やすく、通知は消せる、数字は横一列 ----------
var _notify55 = window.notify;
window.notify = function (to, text, sub) { var r = _notify55.apply(this, arguments); if (S.notifs && S.notifs[0] && !S.notifs[0].id) S.notifs[0].id = uid('nt'); return r; };
window.__delNotif = window.__delNotif || function (id) { var me0 = S.me; S.notifs = (S.notifs || []).filter(function (n) { return id === 'all' ? n.to !== me0 : n.id !== id; }); };
function dueLabel(k) {
  if (k.nodate || !k.end) return { t: '期限未定', c: 'ddm' };
  var d = Math.round((dayOf(k.end) - TODAY) / DAY);
  if (!isFolder(k) && !k.done && d < 0) return { t: fmtDate(k.end) + '・' + (-d) + '日遅れ', c: 'ddb' };
  if (d === 0) return { t: '今日まで', c: 'ddw' };
  if (d > 0 && d <= 3) return { t: 'あと' + d + '日（' + fmtDate(k.end) + '）', c: 'ddw' };
  return { t: fmtDate(k.end) + 'まで', c: '' };
}
function dashSelf() {
  var m = me(), mine = myTasks(m.id), open = mine.filter(function (o) { return !isDone(o.k); }), lateN = open.filter(function (o) { return late(o.k); }).length;
  (S.notifs || []).forEach(function (n) { if (!n.id) n.id = uid('nt'); });
  var ns = opsNotifs().filter(function (n) { return n.to === m.id; }).slice(0, 20); // 運営画面には運営向けだけ
  var rows = mine.length ? mine.map(function (o) {
    var k = o.k, f = isFolder(k), du = dueLabel(k), par = parentOf(k);
    var sub = '<span class="dd ' + du.c + '">' + du.t + '</span>' + (par ? '<span class="dp">' + esc(ttl(par)) + '</span>' : (o.p && o.p !== k ? '<span class="dp">' + esc(ttl(o.p)) + '</span>' : ''));
    if (f) { var g = progress(k), pc = g.n ? Math.round(g.d / g.n * 100) : 0;
      return '<button class="mr" data-act="open" data-id="' + k.id + '"><span class="mt">' + FOLD + '<b>' + esc(ttl(k)) + '</b><span class="ms">' + sub + '</span></span><span class="mprog" title="完了 ' + g.d + ' / ' + g.n + '"><span class="b"><i style="width:' + pc + '%"></i></span><span class="num">' + g.d + '<small>/' + g.n + '</small></span></span><span class="mact">' + GO + '</span></button>'; }
    return '<div class="mr' + (k.done ? ' dn' : '') + '"><span class="mt lk" data-act="open" data-id="' + k.id + '">' + FILE + '<b>' + esc(ttl(k)) + '</b><span class="ms">' + sub + '</span></span><span class="mprog"></span><span class="mact">' +
      (k.done ? '<button class="ib" data-act="undo" data-id="' + k.id + '" title="完了を取り消す" aria-label="完了を取り消す"><svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 14l-4-4 4-4"/><path d="M5 10h9a5 5 0 0 1 0 10h-3"/></svg></button>' : '<button class="mdone" data-act="done" data-id="' + k.id + '" title="完了にする" aria-label="完了にする"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12l5 5 9-10"/></svg></button>') + '</span></div>';
  }).join('') : '<div class="empty sm">担当している業務はありません</div>';
  var alerts = open.filter(function (o) { return !late(o.k) && !o.k.nodate && !isFolder(o.k) && dayOf(o.k.end) - TODAY <= 3 * DAY; });
  var nrows = alerts.map(function (o) { var d = Math.round((dayOf(o.k.end) - TODAY) / DAY); return '<div class="nr2 al"><span class="ndot ndw"></span><span class="mt"><b>「' + esc(ttl(o.k)) + '」の期限が' + (d ? 'あと' + d + '日' : '今日') + 'です</b><span class="ms"><span class="dp">' + esc(ttl(o.p)) + '</span></span></span></div>'; }).join('') +
    ns.map(function (n) { return '<div class="nr2' + (n.link ? ' lk' : '') + '" data-nid="' + esc(String(n.id)) + '" data-link="' + esc(n.link || '') + '" title="長押し・右クリックでこの通知を止められます"><span class="ndot"></span><span class="mt"><b>' + esc(n.text) + '</b><span class="ms">' + (n.sub ? '<span class="dp">' + esc(n.sub) + '</span>' : '') + '<span class="dp num">' + esc(n.at || '') + '</span></span></span><button class="ib nx" data-act="ndel" data-id="' + n.id + '" title="削除" aria-label="この通知を削除">' + ic('x') + '</button></div>'; }).join('');
  var cnt = function (n, bad) { return n ? '<span class="cc' + (bad ? ' bad' : '') + '">' + n + '</span>' : ''; };
  return '<section class="dsec"><h2>' + av(m.id) + esc(m.name) + '</h2><div class="dg2 dself">' +
    '<div class="card"><div class="ch"><span class="cht">自分の担当' + cnt(open.length) + cnt(lateN && '遅れ ' + lateN, true) + '</span><button data-act="fgo2" aria-label="業務の自分の担当を開く" title="開く">' + GO + '</button></div><div class="cb mlist">' + rows + '</div></div>' +
    '<div class="card"><div class="ch"><span class="cht">通知' + cnt(alerts.length + ns.length) + '</span>' + (ns.length ? '<button class="nclr" data-act="ndel" data-id="all">すべて削除</button>' : '') + '</div><div class="cb mlist">' + (nrows || '<div class="empty sm">通知はありません</div>') + '</div></div>' +
    '</div></section>';
}
