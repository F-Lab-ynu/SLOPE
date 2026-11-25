// ---------- 人に知らせる操作は10秒待ってから送る（その間に戻せば送らない・連打しても1回） ----------
var NQ = {}, NQ_MS = 10000;
function nqFlush(k) { var q = NQ[k]; if (!q) return; delete NQ[k]; clearTimeout(q.t); try { q.run(q.init); } catch (e) {} }
function nqAll() { Object.keys(NQ).forEach(nqFlush); }
function notifySoon(key, run, init) { var q = NQ[key] || (NQ[key] = { init: init }); clearTimeout(q.t); q.run = run; q.t = setTimeout(function () { nqFlush(key); }, NQ_MS); }
function inPeople(n, to) { return n.who === to || (isFolder(n) ? teamOf(n) : fileWho(n)).indexOf(to) >= 0; }
// 担当・メンバー・リーダーになった：10秒後もそのままなら知らせる
function notifyAssign(n, to, what) {
  if (!to) return; var id = n.id;
  notifySoon('as:' + id + ':' + to + ':' + (what || ''), function () { var m = task(id); if (!m || !inPeople(m, to)) return; window.notify(to, '「' + ttl(m) + '」' + (what || 'の担当になりました'), ttl(rootOf(m))); });
}
// 完了・完了の取り消し：10秒後に、最初と違う状態なら知らせる
function doneChanged(n) {
  var id = n.id;
  notifySoon('dn:' + id, function (init) { var m = task(id); if (!m || !!m.done === init) return; if (m.done) reportUp(m); else reportUndo(m); }, !n.done);
}
document.addEventListener('visibilitychange', function () { if (document.hidden) nqAll(); });
window.addEventListener('pagehide', nqAll);

// ---------- 確認（削除・人に知らせる重い操作）：どれも同じ形 ----------
function askConfirm(o) { M = { m: 'cfm', o: o }; renderModal(); }
function cfmDlg() {
  var o = M.o; return dlg(o.title, (o.body ? '<p class="dlgp">' + o.body + '</p>' : ''), '<button class="btn" data-act="close">やめる</button><button class="btn ' + (o.danger === false ? 'primary' : 'danger') + '" data-act="cfmOk">' + esc(o.ok || '削除する') + '</button>');
}
document.addEventListener('click', function (e) {
  var b = e.target.closest && e.target.closest('[data-act="cfmOk"]'); if (!b || !M || M.m !== 'cfm') return;
  e.preventDefault(); e.stopImmediatePropagation(); var o = M.o; M = null; renderModal(); o.run();
}, true);
document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && M && M.m === 'cfm') { M = null; renderModal(); } });
// 中身があるフォルダーなど、戻しても困るものだけ確認する
function delWork(n, run) {
  var cnt = nodesOf(n).length - 1, ev = isEvent(n) && n.ev && evCal(n.ev), jn = ev ? evJoins(ev) : 0;
  if (!cnt && !jn) return run();
  askConfirm({ title: '「' + esc(ttl(n)) + '」を削除', body: (cnt ? '中の ' + cnt + ' 件もまとめて削除されます。' : '') + (jn ? '参加登録した ' + jn + '人がいます。' : ''), run: run });
}
