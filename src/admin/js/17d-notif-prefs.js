// ---------- ux59 通知の設定：受け取る種類を選ぶ・長押し（右クリック）でその通知を止める ----------
var NK = [['assign', '担当・メンバーになったとき', '業務の担当やフォルダーのメンバーに入ったとき'], ['done', '業務が完了したとき', '自分がまとめている業務を誰かが完了したとき'], ['event', '参加するイベントのお知らせ', '前日のお知らせ・日時の変更・中止'], ['reply', 'お問い合わせへの返信', '運営からの返信']];
function nKind(t) { t = String(t || ''); if (/」の(担当|メンバー|リーダー)になりました$/.test(t)) return 'assign'; if (/(を完了しました|がすべて完了しました)$/.test(t)) return 'done'; if (/^お問い合わせに返信/.test(t)) return 'reply'; if (/^「.*」(は中止になりました|の日時・場所が変わりました)$/.test(t) || /^明日：/.test(t)) return 'event'; return 'system'; }
function nSrc(t, s, k) { if (k === 'event') { var m = /^「(.*)」/.exec(t) || /^明日：(.*)$/.exec(t); return m ? m[1] : ''; } return s || ''; }
function nOwner(id) { return id === S.me && S.self ? S.self : member(id); }
function nPrefs(id) { var p = nOwner(id || S.me) || {}; return { off: (p.notif_off || []).slice(), mute: (p.notif_mute || []).slice() }; }
function nSet(off, mute) {
  var p = nOwner(S.me); if (!p) return; p.notif_off = off; p.notif_mute = mute;
  if (S.self && S.self !== p) { S.self.notif_off = off; S.self.notif_mute = mute; }
  if (window.__nSave) window.__nSave(off, mute); else save();
}
function nBlocked(to, text, sub) { var k = nKind(text); if (k === 'system') return false; var p = nPrefs(to), s = nSrc(text, sub, k); return p.off.indexOf(k) >= 0 || (!!s && p.mute.indexOf(s) >= 0); }
window.__nBlocked = nBlocked;
// サンプルデータの画面では、ここで止める（本番はデータベースが止める）
(function () { var f = window.notify; window.notify = function (to, text, sub) { if (to && nBlocked(to, text, sub)) return; return f.apply(this, arguments); }; })();

var NX = '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';
function nsClose() { var d = document.getElementById('nsdlg'); if (d) d.remove(); }
window.__nsOpen = function () { nsOpen(); };
function nsOpen() {
  var p = nPrefs(), d = document.getElementById('nsdlg'), y = d ? d.querySelector('.nsb').scrollTop : 0; nsClose();
  var ps = window.__adminPush ? window.__adminPush.state() : 'mock', pon = ps === 'on';
  var pnote = { on: 'この端末に届きます', off: 'オンにするとこの端末に届きます', denied: 'ブラウザの設定で通知が止められています', ios: 'ホーム画面に追加すると受け取れます', no: 'この端末では受け取れません', mock: 'サンプルデータの画面では使えません' }[ps] || '';
  var sw = function (on, attr, dis) { return '<button class="nssw" role="switch" aria-checked="' + on + '" ' + attr + (dis ? ' disabled' : '') + '><i></i></button>'; };
  var h = '<div class="nsbg" data-ns-x></div><div class="nsd" role="dialog" aria-label="通知の設定"><div class="nsh"><b>通知の設定</b><button class="ib" data-ns-x aria-label="閉じる">' + NX + '</button></div><div class="nsb">' +
    '<div class="nsg"><div class="nsr"><span><b>この端末へのプッシュ通知</b><small>' + pnote + '</small></span>' + sw(pon, 'data-ns-push="1"', ps !== 'on' && ps !== 'off') + '</div></div>' +
    '<div class="nst">受け取る通知</div><div class="nsg">' + NK.map(function (k) { var on = p.off.indexOf(k[0]) < 0; return '<div class="nsr"><span><b>' + k[1] + '</b><small>' + k[2] + '</small></span>' + sw(on, 'data-ns-k="' + k[0] + '"') + '</div>'; }).join('') + '</div>' +
    '<p class="nsn">運営からの大事な連絡は止められません。部員アプリと運営画面で同じ設定です。</p>' +
    '<div class="nst">止めているイベント・フォルダー</div>' + (p.mute.length ? '<div class="nsm">' + p.mute.map(function (m) { return '<button class="nsc" data-ns-un="' + esc(m) + '" title="通知を戻す" aria-label="「' + esc(m) + '」の通知を戻す">' + esc(m) + NX + '</button>'; }).join('') + '</div>' : '<p class="nsn">ありません。通知を長押し（右クリック）すると、そのイベント・フォルダーの通知を止められます。</p>') +
    '</div></div>';
  d = document.createElement('div'); d.id = 'nsdlg'; d.innerHTML = h; document.body.appendChild(d); d.querySelector('.nsb').scrollTop = y;
  if (!y) { var f = d.querySelector('.nsd [data-ns-x]'); if (f) f.focus(); }
}
function nMenu(id, x, y) {
  var n = (S.notifs || []).filter(function (q) { return String(q.id) === String(id); })[0]; if (!n) return;
  var k = nKind(n.text), s = nSrc(n.text, n.sub, k), kn = (NK.filter(function (q) { return q[0] === k; })[0] || [])[1];
  var m = document.getElementById('cm'); if (!m) { m = document.createElement('div'); m.id = 'cm'; m.className = 'cm'; m.setAttribute('role', 'menu'); document.body.appendChild(m); }
  UI.cm = null;
  m.innerHTML = '<div class="cmh"><span>' + esc(n.text) + '</span></div>' +
    (kn ? '<button role="menuitem" data-nm-off="' + k + '">「' + kn + '」の通知をオフ</button>' : '') +
    (s && k !== 'system' ? '<button role="menuitem" data-nm-mute="' + esc(s) + '">「' + esc(s) + '」の通知をオフ</button>' : '') +
    (kn || (s && k !== 'system') ? '<i class="cmsep"></i>' : '') +
    '<button role="menuitem" data-nm-del="' + esc(String(id)) + '">この通知を削除</button><button role="menuitem" data-nm-set="1">通知の設定…</button>';
  m.style.left = '0px'; m.style.top = '0px'; var w = m.offsetWidth, hh = m.offsetHeight;
  m.style.left = Math.max(8, Math.min(x, window.innerWidth - w - 8)) + 'px'; m.style.top = Math.max(8, Math.min(y, window.innerHeight - hh - 8)) + 'px';
}
document.addEventListener('click', function (e) {
  var t = e.target; if (!t.closest) return; var b;
  if (t.closest('[data-act="nset"]')) { e.stopImmediatePropagation(); e.preventDefault(); UI.acct = false; renderChrome(); nsOpen(); return; }
  if (t.closest('#nsdlg [data-ns-x]')) { nsClose(); return; }
  var p = nPrefs();
  if ((b = t.closest('#nsdlg [data-ns-k]'))) { var k = b.dataset.nsK, i = p.off.indexOf(k); if (i >= 0) p.off.splice(i, 1); else p.off.push(k); nSet(p.off, p.mute); nsOpen(); return; }
  if ((b = t.closest('#nsdlg [data-ns-un]'))) { nSet(p.off, p.mute.filter(function (m) { return m !== b.dataset.nsUn; })); nsOpen(); return; }
  if ((b = t.closest('#nsdlg [data-ns-push]'))) { if (window.__adminPush) window.__adminPush.toggle(nsOpen); return; }
  if ((b = t.closest('[data-nm-off],[data-nm-mute],[data-nm-del],[data-nm-set]'))) {
    e.stopImmediatePropagation(); e.preventDefault(); closeCM();
    if (b.dataset.nmOff) { if (p.off.indexOf(b.dataset.nmOff) < 0) p.off.push(b.dataset.nmOff); nSet(p.off, p.mute); toast('オフにしました。通知の設定から戻せます'); }
    else if (b.dataset.nmMute) { if (p.mute.indexOf(b.dataset.nmMute) < 0) p.mute.push(b.dataset.nmMute); nSet(p.off, p.mute); toast('オフにしました。通知の設定から戻せます'); }
    else if (b.dataset.nmDel) { var id = b.dataset.nmDel; if (window.__delNotif) window.__delNotif(id); render(); }
    else nsOpen();
  }
}, true);
document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && document.getElementById('nsdlg')) { e.stopImmediatePropagation(); nsClose(); } }, true);
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
