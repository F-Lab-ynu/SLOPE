// ---------- ux59 通知の設定（別の画面）：種類ごとに「プッシュ・アプリ内・オフ」、期限の日数、止めているイベント・フォルダー。
//   運営画面の通知には運営向けだけを出す。通知を長押し（右クリック）でその場で止める ----------
var NKG = [
  ['ops', '運営向け', [['assign', '担当・メンバーになった'], ['done', '業務の完了'], ['due', '期限が近い'], ['late', '期限切れ'], ['inquiry', '新しいお問い合わせ'], ['report', '投稿の通報'], ['offer_wait', '外部告知の確認待ち']]],
  ['member', '部員向け', [['remind', '参加するイベントの前日'], ['evchange', 'イベントの中止・変更'], ['evnew', '新しいイベント'], ['comment', '自分の投稿へのコメント'], ['offer_ok', '共有した外部告知が公式になった'], ['reply', 'お問い合わせへの返信']]]
];
var NK_OPS = NKG[0][2].map(function (x) { return x[0]; });
var NDUE = [[7, '7日前'], [3, '3日前'], [1, '前日'], [0, '当日']];
var NDUE_P = [[0, '当日'], [1, '前日から'], [3, '3日前から'], [7, '7日前から']];
function nDueSel(due) { var mx = Math.max.apply(null, due.length ? due : [1]), cur = NDUE_P.filter(function (o) { return o[0] === mx; })[0] || NDUE_P[1]; return '<button type="button" class="nsdsel" data-ns-dd="1" aria-haspopup="listbox" aria-label="知らせる日">' + cur[1] + '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg></button>'; }
function nDueOf(v) { return NDUE.map(function (d) { return d[0]; }).filter(function (d) { return d <= v; }); }
function nDueFit() { [].forEach.call(document.querySelectorAll('.nsdsel'), function (s) { var r = s.closest('.nsr'), g = r && r.previousElementSibling && r.previousElementSibling.querySelector('.nseg'); if (g && g.offsetWidth) s.style.width = g.offsetWidth + 'px'; }); }
function nLabel(k) { var r = ''; NKG.forEach(function (g) { g[2].forEach(function (x) { if (x[0] === k) r = x[1]; }); }); return r; }
function nKind(t) { t = String(t || ''); if (/」の(担当|メンバー|リーダー)になりました$/.test(t)) return 'assign'; if (/(を完了しました|がすべて完了しました)$/.test(t)) return 'done'; if (/^お問い合わせに返信/.test(t)) return 'reply'; if (/^「.*」(は中止になりました|の日時・場所が変わりました)$/.test(t)) return 'evchange'; if (/^明日：/.test(t)) return 'remind'; return 'system'; }
function nKindOf(n) { return n.kind || nKind(n.text); }
function nSrc(t, s, k) { if (k === 'remind' || k === 'evchange' || k === 'evnew') { var m = /「(.*)」/.exec(t) || /^明日：(.*)$/.exec(t); return m ? m[1] : ''; } return ['assign', 'done', 'due', 'late'].indexOf(k) >= 0 ? (s || '') : ''; }
function nOwner(id) { return id === S.me && S.self ? S.self : member(id); }
function nPrefs(id) { var p = nOwner(id || S.me) || {}; return { off: (p.notif_off || []).slice(), app: (p.notif_app || ['done']).slice(), mute: (p.notif_mute || []).slice(), due: (p.notif_due || [3, 0]).slice() }; }
function nMode(p, k) { return p.off.indexOf(k) >= 0 ? 'off' : p.app.indexOf(k) >= 0 ? 'app' : 'push'; }
function nSet(p) {
  var o = nOwner(S.me); if (!o) return;
  [o, S.self].forEach(function (x) { if (x) { x.notif_off = p.off; x.notif_app = p.app; x.notif_mute = p.mute; x.notif_due = p.due; } });
  if (window.__nSave) window.__nSave(p); else save();
}
function nSetMode(p, k, m) { p.off = p.off.filter(function (x) { return x !== k; }); p.app = p.app.filter(function (x) { return x !== k; }); if (m === 'off') p.off.push(k); if (m === 'app') p.app.push(k); }
function nBlocked(to, text, sub) { var k = nKind(text); if (k === 'system') return false; var p = nPrefs(to), s = nSrc(text, sub, k); return nMode(p, k) === 'off' || (!!s && p.mute.indexOf(s) >= 0); }
window.__nBlocked = nBlocked;
// サンプルデータの画面では、ここで止める（本番はデータベースが止める）
(function () { var f = window.notify; window.notify = function (to, text, sub) { if (to && nBlocked(to, text, sub)) return; return f.apply(this, arguments); }; })();
function opsNotifs() { return (S.notifs || []).filter(function (n) { var k = nKindOf(n); return k === 'system' || NK_OPS.indexOf(k) >= 0; }); }

// ---- 設定の画面 ----
function viewNset() {
  var p = nPrefs(), ps = window.__adminPush ? window.__adminPush.state() : 'mock';
  var pnote = { on: 'この端末に届きます', off: 'オンにするとこの端末に届きます', denied: 'ブラウザの設定で通知が止められています', ios: 'ホーム画面に追加すると受け取れます', no: 'この端末では受け取れません', mock: 'サンプルデータの画面では使えません' }[ps] || '';
  var seg = function (k) { var m = nMode(p, k); return '<span class="seg nseg" role="group" aria-label="' + esc(nLabel(k)) + '">' + [['push', 'プッシュ'], ['app', 'アプリ内'], ['off', 'オフ']].map(function (x) { return '<button data-ns-m="' + x[0] + '" data-ns-k="' + k + '" aria-pressed="' + (m === x[0]) + '">' + x[1] + '</button>'; }).join('') + '</span>'; };
  var row = function (x) {
    return '<div class="nsr"><span class="nsl">' + esc(x[1]) + '</span>' + seg(x[0]) + '</div>' +
      (x[0] === 'due' && nMode(p, 'due') !== 'off' ? '<div class="nsr nsub"><span class="nsl">知らせる日</span>' + nDueSel(p.due) + '</div>' : '');
  };
  var body = '<div class="body nset">' +
    '<section><h2>この端末</h2><div class="nsg"><div class="nsr"><span class="nsl">プッシュ通知を受け取る<small>' + pnote + '</small></span><button class="nssw" role="switch" aria-checked="' + (ps === 'on') + '" data-ns-push="1"' + (ps === 'on' || ps === 'off' ? '' : ' disabled') + '><i></i></button></div></div></section>' +
    NKG.map(function (g) { return '<section><h2>' + g[1] + '</h2><div class="nsg">' + g[2].map(row).join('') + '</div></section>'; }).join('') +
    '<section><h2>止めているイベント・フォルダー</h2>' + (p.mute.length ? '<div class="nsm">' + p.mute.map(function (m) { return '<button class="nsc" data-ns-un="' + esc(m) + '" title="通知を戻す" aria-label="「' + esc(m) + '」の通知を戻す">' + esc(m) + ic('x') + '</button>'; }).join('') + '</div>' : '<p class="nsn">ありません。通知を右クリック（長押し）すると止められます。</p>') + '</section>' +
    '<p class="nsn">運営からの大事な連絡はいつも届きます。設定は部員アプリと共通です。</p></div>';
  return top('通知の設定', '', '<button class="ib fhb" data-act="nsback" aria-label="戻る" title="戻る">' + ic('back') + '</button>') + body;
}
function nsGo() { if (S.view !== 'nset') UI.nsPrev = S.view; S.view = 'nset'; UI.acct = false; M = null; save(); render(); }
function nMenu(id, x, y) {
  var n = (S.notifs || []).filter(function (q) { return String(q.id) === String(id); })[0]; if (!n) return;
  var k = nKindOf(n), s = nSrc(n.text, n.sub, k), kn = nLabel(k), p = nPrefs(), m0 = nMode(p, k);
  var m = document.getElementById('cm'); if (!m) { m = document.createElement('div'); m.id = 'cm'; m.className = 'cm'; m.setAttribute('role', 'menu'); document.body.appendChild(m); }
  UI.cm = null;
  m.innerHTML = '<div class="cmh"><span>' + esc(n.text) + '</span></div>' +
    (kn && m0 === 'push' ? '<button role="menuitem" data-nm-k="' + k + '" data-nm-m="app">「' + kn + '」はアプリ内だけにする</button>' : '') +
    (kn ? '<button role="menuitem" data-nm-k="' + k + '" data-nm-m="off">「' + kn + '」をオフ</button>' : '') +
    (s ? '<button role="menuitem" data-nm-mute="' + esc(s) + '">「' + esc(s) + '」の通知をオフ</button>' : '') +
    (kn || s ? '<i class="cmsep"></i>' : '') +
    '<button role="menuitem" data-nm-del="' + esc(String(id)) + '">この通知を削除</button><button role="menuitem" data-nm-set="1">通知の設定</button>';
  m.style.left = '0px'; m.style.top = '0px'; var w = m.offsetWidth, hh = m.offsetHeight;
  m.style.left = Math.max(8, Math.min(x, window.innerWidth - w - 8)) + 'px'; m.style.top = Math.max(8, Math.min(y, window.innerHeight - hh - 8)) + 'px';
}
document.addEventListener('click', function (e) {
  var t = e.target; if (!t.closest) return; var b, p = nPrefs();
  if (t.closest('[data-act="nset"]') || t.closest('[data-nm-set]')) { e.stopImmediatePropagation(); e.preventDefault(); closeCM(); nsGo(); return; }
  if (t.closest('[data-act="nsback"]')) { e.stopImmediatePropagation(); S.view = UI.nsPrev || 'dash'; save(); render(); return; }
  if ((b = t.closest('.nset [data-ns-m]'))) { nSetMode(p, b.dataset.nsK, b.dataset.nsM); nSet(p); render(); return; }
  if ((b = t.closest('.nset [data-ns-un]'))) { p.mute = p.mute.filter(function (m) { return m !== b.dataset.nsUn; }); nSet(p); render(); return; }
  if ((b = t.closest('.nset [data-ns-push]'))) { if (window.__adminPush) window.__adminPush.toggle(render); return; }
  if ((b = t.closest('[data-nm-k],[data-nm-mute],[data-nm-del]'))) {
    e.stopImmediatePropagation(); e.preventDefault(); closeCM();
    if (b.dataset.nmK) { nSetMode(p, b.dataset.nmK, b.dataset.nmM); nSet(p); toast((b.dataset.nmM === 'off' ? 'オフ' : 'アプリ内だけ') + 'にしました。通知の設定から戻せます'); }
    else if (b.dataset.nmMute) { if (p.mute.indexOf(b.dataset.nmMute) < 0) p.mute.push(b.dataset.nmMute); nSet(p); toast('オフにしました。通知の設定から戻せます'); }
    else { if (window.__delNotif) window.__delNotif(b.dataset.nmDel); render(); }
  }
}, true);
window.__nsRender = function () { if (S.view === 'nset') render(); };
// 長押し（タッチ）・右クリック
var NLP = null, NLJ = 0;
document.addEventListener('pointerdown', function (e) {
  var r = e.target.closest && e.target.closest('.nr2[data-nid]'); if (!r || e.target.closest('button')) return;
  clearTimeout(NLP && NLP.t); NLP = { x: e.clientX, y: e.clientY, t: setTimeout(function () { NLP = null; NLJ = Date.now(); if (navigator.vibrate) try { navigator.vibrate(12); } catch (er) {} nMenu(r.dataset.nid, e.clientX, e.clientY); }, 480) };
});
document.addEventListener('pointermove', function (e) { if (NLP && (Math.abs(e.clientX - NLP.x) > 8 || Math.abs(e.clientY - NLP.y) > 8)) { clearTimeout(NLP.t); NLP = null; } });
['pointerup', 'pointercancel'].forEach(function (ev) { document.addEventListener(ev, function () { if (NLP) { clearTimeout(NLP.t); NLP = null; } }); });
window.addEventListener('contextmenu', function (e) { var r = e.target.closest && e.target.closest('.nr2[data-nid]'); if (!r) return; e.preventDefault(); e.stopImmediatePropagation(); if (Date.now() - NLJ > 600) nMenu(r.dataset.nid, e.clientX, e.clientY); }, true);
window.addEventListener('click', function (e) { if (Date.now() - NLJ < 600 && e.target.closest && e.target.closest('.nr2')) { e.stopImmediatePropagation(); e.preventDefault(); } }, true);
// 知らせる日：小さなメニューで選ぶ
function nDdClose() { var m = document.getElementById('nsddm'); if (m) m.remove(); }
document.addEventListener('click', function (e) {
  var t = e.target; if (!t.closest) return;
  var o = t.closest('#nsddm [data-ns-dv]');
  if (o) { e.stopImmediatePropagation(); var p = nPrefs(); p.due = nDueOf(+o.dataset.nsDv); nSet(p); nDdClose(); render(); if (e.detail === 0) { var b0 = document.querySelector('.nsdsel'); if (b0) b0.focus(); } return; }
  var b = t.closest('.nset [data-ns-dd]');
  if (!b) { if (!t.closest('#nsddm')) nDdClose(); return; }
  e.stopImmediatePropagation(); if (document.getElementById('nsddm')) { nDdClose(); return; }
  var p2 = nPrefs(), mx = Math.max.apply(null, p2.due.length ? p2.due : [1]), r = b.getBoundingClientRect(), m = document.createElement('div');
  m.id = 'nsddm'; m.setAttribute('role', 'listbox'); m.style.width = r.width + 'px';
  m.innerHTML = NDUE_P.map(function (x) { return '<button type="button" role="option" data-ns-dv="' + x[0] + '" aria-selected="' + (x[0] === mx) + '">' + x[1] + '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12l5 5 9-10"/></svg></button>'; }).join('');
  document.body.appendChild(m);
  var h = m.offsetHeight; m.style.left = r.left + 'px'; m.style.top = (window.innerHeight - r.bottom - 8 >= h ? r.bottom + 4 : r.top - h - 4) + 'px';
  var sel = m.querySelector('[aria-selected="true"]') || m.firstChild; sel.focus();
}, true);
document.addEventListener('keydown', function (e) {
  var m = document.getElementById('nsddm'); if (!m) return;
  if (e.key === 'Escape') { e.preventDefault(); nDdClose(); var b = document.querySelector('.nsdsel'); if (b) b.focus(); return; }
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); var L = [].slice.call(m.children), i = L.indexOf(document.activeElement); i = (i + (e.key === 'ArrowDown' ? 1 : -1) + L.length) % L.length; L[i].focus(); }
  if (e.key === 'Tab') nDdClose();
}, true);
document.addEventListener('scroll', function (e) { if (!(e.target.closest && e.target.closest('#nsddm'))) nDdClose(); }, true);
new MutationObserver(function () { if (document.querySelector('.nsdsel')) nDueFit(); }).observe(document.documentElement, { childList: true, subtree: true });
window.addEventListener('resize', nDueFit);
