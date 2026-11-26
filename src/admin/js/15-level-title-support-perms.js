// ---------- ux58 レベル：印を付けたイベントの並び順。出席で決まる。単元の確認問題 ----------
function lvNodes() { var out = []; (function w(a) { (a || []).forEach(function (n) { if (n.out) return; if (n.k === 'e' && n.lv) out.push(n); if (n.items) w(n.items); }); })((S.program && S.program.v2) || []); return out; }
function lvOf(uid) { var L = 0; lvNodes().forEach(function (n, i) { var c = evCal(n.ref); if (c && (c.att || []).indexOf(uid) >= 0) L = i + 1; }); return L; }
// 確認問題の編集
function qzT() { var f = p2Get(UI.psel); if (!f || f.n.k !== 'u') return null; var t = p2Track(f.n.t), u = p2Unit(f.n); if (!t || !u) return null; var d = unitData(t, u.code); if (!d.quiz) d.quiz = []; return { t: t, d: d }; }
function qzRe(sel) { save(); render(); if (sel) { var el = document.querySelector(sel); if (el) el.focus(); } }
document.addEventListener('input', function (e) {
  var el = e.target; if (!el.dataset || el.dataset.qz == null || el.dataset.qk === 'a') return; var x = qzT(); if (!x) return; var q = x.d.quiz[+el.dataset.qz]; if (!q) return;
  if (el.dataset.qk === 'q') q.q = el.value; else q.c[+el.dataset.qj] = el.value; touch(x.t); save();
}, true);
document.addEventListener('change', function (e) {
  var el = e.target; if (!el.dataset || el.dataset.qk !== 'a') return; var x = qzT(); if (!x) return; var q = x.d.quiz[+el.dataset.qz]; if (!q) return; q.a = +el.value; touch(x.t); save();
}, true);
window.addEventListener('click', function (e) {
  var b = e.target.closest && e.target.closest('[data-qzadd],[data-qzdel],[data-qzc],[data-qzcdel],[data-attopen],[data-p2lv]'); if (!b) return;
  if (b.dataset.p2lv) { var f = p2Get(UI.psel); if (!f) return; setTimeout(function () { snap(); f.n.lv = b.querySelector('input') ? b.querySelector('input').checked : b.checked; p2Save(); }, 0); return; }
  if (b.dataset.attopen) { e.preventDefault(); e.stopImmediatePropagation(); attOpen(b.dataset.attopen, b); return; }
  e.preventDefault(); e.stopImmediatePropagation(); var x = qzT(); if (!x) return; snap();
  if (b.dataset.qzadd) { x.d.quiz.push({ q: '', c: ['', ''], a: 0 }); touch(x.t); qzRe('[data-qz="' + (x.d.quiz.length - 1) + '"][data-qk="q"]'); }
  else if (b.dataset.qzdel != null) { x.d.quiz.splice(+b.dataset.qzdel, 1); touch(x.t); qzRe(); }
  else if (b.dataset.qzc != null) { var q = x.d.quiz[+b.dataset.qzc]; q.c.push(''); touch(x.t); qzRe('[data-qz="' + b.dataset.qzc + '"][data-qj="' + (q.c.length - 1) + '"]'); }
  else { var p = b.dataset.qzcdel.split(':'), q2 = x.d.quiz[+p[0]], j = +p[1]; q2.c.splice(j, 1); if (q2.a === j) q2.a = 0; else if (q2.a > j) q2.a--; touch(x.t); qzRe(); }
}, true);
// 出欠を取る（専用の画面）：参加登録した人／全員を切り替え、行を押すと出席
function attOpen(cid) {
  var c = evCal(cid); if (!c) return; if (!c.att) c.att = [];
  var jn = (S.joinIds || {})[cid] || [];
  M = { m: 'att', id: cid, tab: jn.length ? 'reg' : 'all', q: '' }; renderModal();
}
function attDlg() {
  var c = evCal(M.id); if (!c) return '';
  var when = (c.date ? pmd(c.date) + (c.to ? ' – ' + pmd(c.to) : '') : '日時未定') + (c.time ? ' ' + esc(c.time) : '') + (c.place ? ' · ' + esc(c.place) : '');
  var body = '<div class="atth"><span class="muted">' + when + '</span><div class="attn"><span><b class="num" id="attN"></b>出席</span><span><b class="num" id="attR"></b>参加登録</span></div></div>' +
    '<div class="attbar"><span class="seg" role="group" aria-label="表示"><button data-attt="reg" aria-pressed="' + (M.tab === 'reg') + '">参加登録した人</button><button data-attt="all" aria-pressed="' + (M.tab === 'all') + '">全員</button></span>' +
    '<input class="input" id="attq2" placeholder="名前で絞り込み" autocomplete="off" value="' + esc(M.q) + '"></div><div class="attl" id="attl"></div>';
  return dlg('出欠 · ' + esc(c.title || 'イベント'), body, '<button class="btn" data-act="attAll">参加登録した人を全員出席にする</button><span class="sp"></span><button class="btn primary" data-act="close">閉じる</button>', true).replace('class="dlg"', 'class="dlg attd"');
}
function attDraw() {
  var c = M && M.m === 'att' && evCal(M.id), box = document.getElementById('attl'); if (!c || !box) return;
  var jn = (S.joinIds || {})[c.id] || [], q = M.q;
  var ms = S.members.filter(function (m) { return (M.tab === 'all' || jn.indexOf(m.id) >= 0) && (!q || (m.name + (m.grade || '')).indexOf(q) >= 0); })
    .sort(function (a, b) { return ((jn.indexOf(b.id) >= 0) - (jn.indexOf(a.id) >= 0)) || (a.name || '').localeCompare(b.name || '', 'ja'); });
  box.innerHTML = ms.length ? ms.map(function (m) { var on = c.att.indexOf(m.id) >= 0;
    return '<button class="attr' + (on ? ' on' : '') + '" data-attm2="' + m.id + '" aria-pressed="' + on + '">' + av(m.id) + '<span class="attnm"><b>' + esc(m.name) + '</b>' + (m.grade ? '<small>' + esc(m.grade) + '</small>' : '') + '</span>' +
      (M.tab === 'all' && jn.indexOf(m.id) >= 0 ? '<span class="atttag">登録</span>' : '') + '<span class="attck">' + (on ? '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 12l4 4 8-8"/></svg>出席' : '欠席') + '</span></button>'; }).join('')
    : '<div class="empty">' + (M.tab === 'reg' && !jn.length ? '参加登録した人はいません' : '見つかりません') + '</div>';
  var n = document.getElementById('attN'), r = document.getElementById('attR'); if (n) n.textContent = c.att.length; if (r) r.textContent = jn.length;
  var all = document.querySelector('[data-act="attAll"]'); if (all) { all.hidden = !jn.length; all.disabled = !jn.some(function (id) { return c.att.indexOf(id) < 0; }); }
}
new MutationObserver(function () { if (M && M.m === 'att' && document.getElementById('attl') && !document.getElementById('attl').childElementCount) attDraw(); }).observe(document.getElementById('modal') || document.body, { childList: true, subtree: true });
document.addEventListener('click', function (e) {
  if (!M || M.m !== 'att' || !e.target.closest) return; var c = evCal(M.id); if (!c) return;
  var b = e.target.closest('[data-attm2]');
  if (b) { e.preventDefault(); e.stopImmediatePropagation(); var id = b.dataset.attm2; snap(); if (c.att.indexOf(id) >= 0) c.att = c.att.filter(function (x) { return x !== id; }); else c.att.push(id); save(); attDraw(); render(); return; }
  var t = e.target.closest('[data-attt]');
  if (t) { e.preventDefault(); e.stopImmediatePropagation(); M.tab = t.dataset.attt; [].forEach.call(document.querySelectorAll('[data-attt]'), function (x) { x.setAttribute('aria-pressed', String(x === t)); }); attDraw(); return; }
  if (e.target.closest('[data-act="attAll"]')) { e.preventDefault(); e.stopImmediatePropagation(); var jn = (S.joinIds || {})[c.id] || []; snap(); jn.forEach(function (id) { if (c.att.indexOf(id) < 0) c.att.push(id); }); save(); attDraw(); render(); toast('参加登録した人を出席にしました'); return; }
}, true);
document.addEventListener('input', function (e) { if (e.target.id === 'attq2' && M && M.m === 'att') { M.q = e.target.value.trim(); attDraw(); } });
document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && M && M.m === 'att') { M = null; renderModal(); render(); } });
// メンバー一覧にレベル
// ---------- ux59 教材のURLから題名を自動で入れる（題名が空のときだけ） ----------
var TITLE_TRIED = {};
function autoTitle(t, m) {
  if (m && /^https?:\/\//.test(m.memo || '')) m.memo = ''; // URLが題名に入っていたら空とみなす
  if (!m || (m.memo && m.img != null) || TITLE_TRIED[m.url]) return; TITLE_TRIED[m.url] = 1; // 題名とサムネイル（どちらか足りなければ取りにいく）
  fetch('https://api.microlink.io/?url=' + encodeURIComponent(m.url)).then(function (r) { return r.json(); }).then(function (j) {
    var d = (j && j.data) || {}, ti = d.title, im = d.image && d.image.url, ch = false;
    if (m.img == null) { m.img = im && /^https:/.test(im) ? im : ''; ch = true; }
    if (ti && !m.memo) { m.memo = String(ti).replace(/\s+/g, ' ').trim().slice(0, 120); ch = true; }
    if (!ch) return; touch(t); save();
    var inp = document.activeElement, keep = inp && inp.id; render(); if (keep) { var el = document.getElementById(keep); if (el) el.focus(); }
  }).catch(function () {});
}
// ---------- ux60 サポート：お問い合わせ・要望（本人と運営だけが見られる）。返すと本人に通知 ----------
if (!S.inqs) S.inqs = [
  { id: 'q1', user: 'm6', kind: '要望', body: '教材の動画を倍速で見られるようにしてほしいです', status: 'open', reply: '', at: '11.23 21:14' },
  { id: 'q2', user: 'm7', kind: '不具合', body: 'カレンダーの予定が1日ずれて表示されます', status: 'done', reply: '直しました。ご連絡ありがとうございます', at: '11.20 10:02' }
];
function inqOpen() { return (S.inqs || []).filter(function (q) { return q.status !== 'done'; }).length || null; }
function inqSave(q, patch) { Object.assign(q, patch); if (window.__inqUpdate) window.__inqUpdate(q.id, patch); else save(); }
window.addEventListener('click', function (e) {
  var b = e.target.closest && e.target.closest('[data-iq]'); if (!b) return; e.preventDefault(); e.stopImmediatePropagation();
  var q = (S.inqs || []).filter(function (x) { return String(x.id) === b.dataset.id; })[0]; if (!q) return;
  var a = b.dataset.iq;
  if (a === 'del' && !b.dataset.sure) { askConfirm({ title: 'お問い合わせを削除', body: '', run: function () { b.dataset.sure = '1'; b.click(); } }); return; }
  if (a === 'del') { S.inqs = S.inqs.filter(function (x) { return x !== q; }); if (window.__inqDelete) window.__inqDelete(q.id); else save(); render(); return; }
  if (a === 'reopen') { inqSave(q, { status: 'open' }); render(); return; }
  var ta = document.querySelector('[data-iqr="' + q.id + '"]'), txt = ta ? ta.value.trim() : '';
  if (a === 'reply' && !txt) { if (ta) ta.focus(); toast('返信を書いてください'); return; }
  inqSave(q, { status: 'done', reply: a === 'reply' ? txt : '' });
  if (a === 'reply') { window.notify(q.user, 'お問い合わせに返信：' + txt.slice(0, 80), q.kind); toast('返信を送りました'); }
  render();
}, true);
// ---------- ux57 ダッシュボードはタブで切り替える（自分／進行中／統計） ----------
document.addEventListener('click', function (e) {
  var b = e.target.closest && e.target.closest('[data-act="ndel"],[data-act="fgo2"]'); if (!b) return; e.preventDefault(); e.stopImmediatePropagation();
  if (b.dataset.act === 'fgo2') { S.view = 'projects'; S.fcur = 'mine'; save(); render(); return; }
  var id = b.dataset.id;
  window.__delNotif(id); save(); render(); toast(id === 'all' ? '通知をすべて削除しました' : '通知を削除しました');
}, true);

// ---------- ux56 権限：自分がリーダーか担当になっているところと、その下は全部編集できる（引き継いだ権限は表示しない） ----------
function hasRight(x) { for (var a = x; a; a = parentOf(a)) { if (isLead(a, S.me) || a.who === S.me || (a.team || []).indexOf(S.me) >= 0) return true; } return false; }
function manages (x) { return isAdmin() || (x ? hasRight(x) : false); }
function editSelf (n) { return isAdmin() || hasRight(n); }
function canEdit (n) { return isAdmin() || hasRight(n); }
function canAssign (n) { return isAdmin() || hasRight(n); }
