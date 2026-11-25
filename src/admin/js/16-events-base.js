// ---------------- events ----------------
document.addEventListener('click', function (e) {
  var b = e.target.closest('[data-act]'), a0 = b ? b.dataset.act : '';
  if (UI.acct && a0 !== 'acct' && a0 !== 'switch' && a0 !== 'resetAsk') { UI.acct = false; renderChrome(); }
  var closeP = UI.pmenu && a0 !== 'pjDel' && a0 !== 'pmenu';
  if (closeP) { UI.pmenu = false; S.pDelProj = null; if (!b) render(); }
  if (!b) return;
  var a = b.dataset.act;
  if (a === 'close' && b.classList.contains('ov') && e.target !== b) return;
  if (['perm', 'post', 'showEnded'].indexOf(a) >= 0) return;
  if (b.tagName === 'A') e.preventDefault();
  switch (a) {
    case 'acct': UI.acct = !UI.acct; renderChrome(); break;
    case 'switch': S.me = b.dataset.id; S.fold = {}; UI.acct = false; M = null; save(); render(); toast(me().name + 'に切り替えました'); break;
    case 'go': S.view = b.dataset.view; M = null; save(); render(); break;
    case 'utab': S[b.dataset.k] = b.dataset.v; save(); render(); break;
    case 'close': M = null; renderModal(); break;
    case 'modal': M = { m: b.dataset.m, id: b.dataset.id }; if (closeP) render(); else renderModal(); break;
    case 'open': S.view = 'projects'; if (S.wtab === 'stats') S.wtab = 'list'; expandTo(b.dataset.id); S.justDone = null; M = null; save(); render(); break;
    case 'pstats': S.view = 'projects'; S.wtab = 'stats'; save(); render(); break;
    case 'fold': reindex(); var fx = IX[b.dataset.id]; if (!S.fold) S.fold = {}; S.fold[b.dataset.id] = isOpen(fx.n, fx.d); save(); render(); break;
    case 'depth': S.depth = +b.dataset.v; S.fold = {}; save(); render(); break;
    case 'zoom': var gz = document.querySelector('.gg'); zoomTo((gz ? +gz.dataset.px : 12) * (b.dataset.v === '1' ? 1.5 : 1 / 1.5)); break;
    case 'edit': M = { m: 'edit', id: b.dataset.id }; renderModal(); break;
    case 'addc': M = { m: 'add', pid: b.dataset.id }; renderModal(); var f1 = document.getElementById('wT'); if (f1) f1.focus(); break;
    case 'wAdd':
      var wt = val('wT'), ws = val('wS'), we = val('wE');
      if (!wt || !ws || !we) { toast('名前と期間は必須です'); return; }
      if (we < ws) { toast('期限が開始日より前です'); return; }
      if (M.pid) {
        var par = task(M.pid);
        if (!par.tasks) { if (!par.kids) par.kids = []; delete par.done; }
        kids(par).push({ id: uid('k'), title: wt, who: '', start: ws, end: we, done: false });
        expandTo(par.id);
        var out = ws < par.start || we > par.end;
        if (b.dataset.more) { save(); render(); M = { m: 'add', pid: par.id }; renderModal(); var f2 = document.getElementById('wT'); if (f2) f2.focus(); toast(out ? '「' + ttl(par) + '」の期間をはみ出しています' : '追加しました'); break; }
        M = null; save(); render(); toast(out ? '「' + ttl(par) + '」の期間をはみ出しています' : '追加しました'); break;
      }
      var an = val('wA');
      S.projects.push({ id: uid('pj'), name: wt, kind: an ? 'event' : 'work', announce: an || 'before', reg: 0, unit: val('wU'), who: '', start: ws, end: we, tasks: [] });
      M = null; save(); render(); toast('追加しました'); break;
    case 'wSave':
      var n0 = task(M.id), nt = val('wT'), nsd = val('wS'), ned = val('wE'), nw = document.getElementById('wW') ? document.getElementById('wW').value : n0.who;
      if (!nt || !nsd || !ned) { toast('名前と期間は必須です'); return; }
      if (ned < nsd) { toast('期限が開始日より前です'); return; }
      if (n0.tasks) n0.name = nt; else n0.title = nt;
      n0.start = nsd; n0.end = ned;
      if (n0.tasks) { n0.unit = val('wU'); var aa = val('wA'); n0.kind = aa ? 'event' : 'work'; if (aa) n0.announce = aa; }
      var dc = document.getElementById('wD'); if (dc && !!n0.done !== dc.checked) { n0.done = dc.checked; doneChanged(n0); }
      var assigned = canAssign(n0) && nw !== n0.who; if (canAssign(n0)) n0.who = nw;
      if (assigned && nw) notifyAssign(n0, nw);
      var pp = parentOf(n0), over = pp && (nsd < pp.start || ned > pp.end);
      M = null; save(); render(); toast(over ? '「' + ttl(pp) + '」の期間をはみ出しています' : assigned && nw ? member(nw).name + 'に知らせます' : '保存しました'); break;
    case 'wDel':
      if (!M.del) { M.del = true; renderModal(); return; }
      var dn = task(M.id), dp = parentOf(dn);
      if (dp) { var arr = kids(dp).filter(function (x) { return x !== dn; }); if (dp.tasks) dp.tasks = arr; else dp.kids = arr; }
      else S.projects = S.projects.filter(function (x) { return x !== dn; });
      M = null; save(); render(); toast('削除しました'); break;
    case 'aSave':
      var changed = 0, people = {};
      Array.prototype.forEach.call(document.querySelectorAll('[data-assign]'), function (el) {
        var k = task(el.dataset.assign); if (!k || k.who === el.value) return;
        k.who = el.value; changed++;
        if (el.value) { notifyAssign(k, el.value); people[el.value] = 1; }
      });
      M = null; save(); render(); toast(changed ? changed + '件を割り当てました' + (Object.keys(people).length ? '（' + Object.keys(people).length + '人に通知）' : '') : '変更はありません'); break;
    case 'done': var kd = task(b.dataset.id); kd.done = true; S.justDone = kd.id; doneChanged(kd); save(); render(); toast('完了にしました'); break;
    case 'undo': var ku = task(b.dataset.id); ku.done = false; doneChanged(ku); S.justDone = null; save(); render(); break;
    case 'resetAsk': UI.acct = false; renderChrome(); askConfirm({ title: 'サンプルデータに戻す', body: '編集した内容はすべて消えます。', ok: '戻す', run: function () { var kp = S.me, vw = S.view; S = migrateFolders(sample()); S.me = member(kp) ? kp : 'm1'; S.view = vw; M = null; save(); render(); toast('サンプルに戻しました'); } }); break;
  }
});
document.addEventListener('keydown', function (e) {
  if (e.key === 'Escape') { if (M) { M = null; renderModal(); } if (UI.acct) { UI.acct = false; render(); } return; }
  var n = e.target.closest && e.target.closest('.node, .gl[role=button]');
  if (n && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); n.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true })); }
  if (e.key === 'Enter' && M && e.target.tagName === 'INPUT') { var pb = document.querySelector('.dlg .btn.primary'); if (pb) pb.click(); }
});
document.addEventListener('change', function (e) {
  var el = e.target, a = el.dataset.act;
  if (a === 'perm') {
    var m = member(el.dataset.m), pp = el.dataset.p;
    if (pp === 'all') m.perms = el.checked ? ['all'] : [];
    else if (el.checked) { if (m.perms.indexOf(pp) < 0) m.perms.push(pp); }
    else m.perms = m.perms.filter(function (x) { return x !== pp; });
    save(); render(); return;
  }
  if (a === 'showEnded') { S.showEnded = el.checked; save(); render(); return; }
});
window.addEventListener('resize', function () { if (S.view === 'projects' && S.wtab === 'gantt' && !drag) { clearTimeout(window.__rz); window.__rz = setTimeout(render, 150); } });


