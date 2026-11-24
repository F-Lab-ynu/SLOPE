// ---------- ux42 告知タブ：部内イベントの告知・カレンダー（部内の予定）・外部告知 ----------
function calsInit() {
  if (!S.cals) {
    var d = function (n) { return isoOf(TODAY + n * DAY); };
    S.cals = typeof sb === 'undefined' ? [
      { id: 'c1', title: '定例会', date: d(2), time: '18:30', place: '経営学部 2-101', memo: '', state: 'pub' },
      { id: 'c2', title: '演習会：ピッチ練習', date: d(6), time: '17:00', place: 'オンライン', memo: '資料は前日までに共有', state: 'pub' },
      { id: 'c3', title: '定例会', date: d(9), time: '18:30', place: '経営学部 2-101', memo: '', state: 'draft' }
    ] : [];
  }
  return S.cals;
}
function evNodes() { return allNodes().filter(function (n) { return isFolder(n) && isEvent(n); }).sort(function (a, b) { return dayOf(a.start) - dayOf(b.start); }); }
function canEv(n) { return editSelf(n) || isLead(n, S.me); }
function calItems(y, m) {
  var out = {}, add = function (iso, o) { (out[iso] = out[iso] || []).push(o); };
  calsInit().filter(function (c) { return c.inNotice !== false; }).forEach(function (c) { add(c.date, { k: 'cal', id: c.id, t: (c.time ? c.time + ' ' : '') + c.title, draft: c.state !== 'pub' }); });
  evNodes().forEach(function (n) { add(n.end, { k: 'ev', id: n.id, t: ttl(n), draft: n.announce !== 'done' }); }); // 部員のカレンダーと同じく、当日（終了日）に出す
  S.notices.forEach(function (n) { if (n.state === 'pub' && /^\d{4}-\d{2}-\d{2}$/.test(n.due || '')) add(n.due, { k: 'ext', id: n.id, t: '締切 ' + n.title }); });
  return out;
}
function viewCal() {
  var base = new Date(TODAY), y = UI.calY != null ? UI.calY : base.getUTCFullYear(), m = UI.calM != null ? UI.calM : base.getUTCMonth();
  var first = Date.UTC(y, m, 1), start = first - new Date(first).getUTCDay() * DAY, items = calItems(), cells = '';
  for (var i = 0; i < 42; i++) {
    var t = start + i * DAY, d = new Date(t), iso = isoOf(t), its = items[iso] || [], wd = d.getUTCDay();
    if (i >= 35 && d.getUTCMonth() !== m) break;
    cells += '<div class="cd' + (d.getUTCMonth() !== m ? ' out' : '') + (t === TODAY ? ' today' : '') + (wd === 0 ? ' sun' : wd === 6 ? ' sat' : '') + '" data-act="calDay" data-d="' + iso + '" role="button" tabindex="0" aria-label="' + (d.getUTCMonth() + 1) + '月' + d.getUTCDate() + '日に予定を追加"><span class="dn num">' + d.getUTCDate() + '</span>' +
      its.slice(0, 3).map(function (o) { return '<button class="cchip ' + o.k + (o.draft ? ' draft' : '') + '" data-act="calItem" data-k="' + o.k + '" data-id="' + o.id + '" title="' + esc(o.t) + (o.draft ? '（非公開）' : '') + '">' + esc(o.t) + '</button>'; }).join('') +
      (its.length > 3 ? '<span class="cmore">ほか ' + (its.length - 3) + ' 件</span>' : '') + '</div>';
  }
  return '<div class="calh"><button class="ib" data-act="calMv" data-v="-1" aria-label="前の月">' + '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M15 6l-6 6 6 6"/></svg></button><b class="num">' + y + '年' + (m + 1) + '月</b><button class="ib" data-act="calMv" data-v="1" aria-label="次の月"><svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg></button><button class="btn sm" data-act="calMv" data-v="0">今日</button></div>' +
    '<div class="calg">' + ['日', '月', '火', '水', '木', '金', '土'].map(function (w) { return '<div class="cw">' + w + '</div>'; }).join('') + cells + '</div>' +
    '<div class="calleg"><span><i style="background:#EEF2FF"></i>部内の予定</span><span><i style="background:#FFF7ED"></i>イベント（業務）</span><span><i style="background:#F3F4F6"></i>外部の締切</span><span><i style="background:#fff;box-shadow:inset 0 0 0 1px var(--line2)"></i>枠だけ＝まだ部員に非公開</span></div>';
}
function calDlg() {
  var c = M.id ? calsInit().filter(function (x) { return x.id === M.id; })[0] : null, d = c || { title: '', date: M.d || isoOf(TODAY), to: '', time: '', place: '', memo: '', link: '', state: 'draft' }, inPg = !!(c && evInProg(c.id));
  var ro = !can('notices');
  var body = '<div class="fld"><label for="cT">イベント名</label><input id="cT" class="input" value="' + esc(d.title) + '" autocomplete="off"' + (ro ? ' disabled' : '') + '></div>' +
    '<div class="three"><div class="fld"><label for="cD">開始日</label><input id="cD" type="date" class="input" value="' + esc(d.date) + '"' + (ro ? ' disabled' : '') + '></div><div class="fld"><label for="cE">終了日</label><input id="cE" type="date" class="input" value="' + esc(d.to || '') + '"' + (ro ? ' disabled' : '') + '></div><div class="fld"><label for="cH">時間</label><input id="cH" type="time" class="input" value="' + esc(d.time || '') + '"' + (ro ? ' disabled' : '') + '></div></div>' +
    '<div class="fld"><label for="cP">場所</label><input id="cP" class="input" value="' + esc(d.place || '') + '" autocomplete="off"' + (ro ? ' disabled' : '') + '></div>' +
    '<div class="fld"><label for="cM">部員がやること・説明</label><textarea id="cM" class="input" rows="3"' + (ro ? ' disabled' : '') + '>' + esc(d.memo || '') + '</textarea></div>' +
    '<div class="fld"><label for="cL">リンク</label><input id="cL" class="input" value="' + esc(d.link || '') + '" placeholder="https://" autocomplete="off"' + (ro ? ' disabled' : '') + '></div>' +
    '<label style="display:flex;align-items:center;gap:8px"><input id="cS" type="checkbox" class="check"' + (d.state === 'pub' ? ' checked' : '') + (ro ? ' disabled' : '') + '>部員に公開する（予定タブの部内イベントに出て、参加登録できる）</label>' +
    (c && !ro && can('tracks') ? '<div style="margin-top:10px"><button class="btn sm" data-act="' + (inPg ? 'evOutProg' : 'evToProg') + '" data-id="' + c.id + '">' + (inPg ? '学ぶから外す' : '学ぶにも追加') + '</button></div>' : '');
  var foot = ro ? '<button class="btn" data-act="close">閉じる</button>' : (c ? '<button class="btn ghost" data-act="calDel" data-id="' + c.id + '" style="margin-right:auto;color:var(--red,#DC2626)">削除</button>' : '') + '<button class="btn" data-act="close">キャンセル</button><button class="btn primary" data-act="calSave">保存</button>';
  return dlg(c ? 'イベントを編集' : 'イベントを追加', body, foot, true);
}
function evDlg() {
  var n = task(M.id); if (!n) return '';
  var ok = canEv(n), dis = ok ? '' : ' disabled';
  var body = '<div class="muted" style="font-size:12px">' + esc(ancestors(n).map(ttl).join(' › ')) + '</div>' +
    '<div class="fld"><label>イベント</label><div style="font-weight:600;font-size:15px">' + esc(ttl(n)) + '</div></div>' +
    '<div class="two"><div class="fld"><label for="eS">開始</label><input id="eS" type="date" class="input" value="' + esc(n.start) + '"' + dis + '></div><div class="fld"><label for="eE">終了</label><input id="eE" type="date" class="input" value="' + esc(n.end) + '"' + dis + '></div></div>' +
    '<div class="fld"><label for="eP">場所</label><input id="eP" class="input" value="' + esc(n.place || '') + '" autocomplete="off"' + dis + '></div>' +
    '<div class="fld"><label for="eD">告知文</label><textarea id="eD" class="input" rows="5" placeholder="内容・対象・持ち物・申し込み方法など"' + dis + '>' + esc(memoText(n.purpose || '')) + '</textarea></div>' +
    '<label style="display:flex;align-items:center;gap:8px"><input id="eA" type="checkbox" class="check"' + (n.announce === 'done' ? ' checked' : '') + dis + '>部員に公開する（ホーム・カレンダーに出て、参加登録できる）</label>' +
    (ok ? '' : '<div class="muted" style="font-size:12px">編集できるのは、このイベントのリーダーか、ひとつ上のフォルダーのリーダーです</div>');
  var foot = ok ? '<button class="btn" data-act="close">キャンセル</button><button class="btn primary" data-act="evSave">保存</button>' : '<button class="btn" data-act="close">閉じる</button>';
  return dlg('イベントの告知', body, foot, true);
}
document.addEventListener('click', function (e) {
  var b = e.target.closest && e.target.closest('[data-act="evPub"],[data-act="evEdit"],[data-act="calMv"],[data-act="calNew"],[data-act="calDay"],[data-act="calItem"],[data-act="calSave"],[data-act="calDel"],[data-act="evSave"]'); if (!b) return;
  if (b.dataset.act === 'calDay' && e.target.closest('.cchip') && e.target.closest('.cchip') !== b) return;
  e.preventDefault(); e.stopImmediatePropagation();
  var a = b.dataset.act, v = function (id) { var x = document.getElementById(id); return x ? x.value.trim() : ''; };
  if (a === 'evPub') { var n = task(b.dataset.id); if (!n || !canEv(n)) return; snap(); n.announce = n.announce === 'done' ? 'before' : 'done'; save(); render(); toast(n.announce === 'done' ? '部員に公開しました' : '非公開にしました'); return; }
  if (a === 'evEdit') { M = { m: 'ev', id: b.dataset.id }; renderModal(); return; }
  if (a === 'calMv') { var dv = +b.dataset.v, base = new Date(TODAY); if (!dv) { UI.calY = null; UI.calM = null; } else { var y = UI.calY != null ? UI.calY : base.getUTCFullYear(), m = (UI.calM != null ? UI.calM : base.getUTCMonth()) + dv; UI.calY = y + Math.floor(m / 12); UI.calM = (m % 12 + 12) % 12; } render(); return; }
  if (a === 'calNew') { if (!can('notices')) return; M = { m: 'cal' }; renderModal(); return; }
  if (a === 'calDay') { if (!can('notices')) return; M = { m: 'cal', d: b.dataset.d }; renderModal(); return; }
  if (a === 'calItem') { var k = b.dataset.k; if (k === 'cal') M = { m: 'cal', id: b.dataset.id }; else if (k === 'ev') M = { m: 'ev', id: b.dataset.id }; else { S.ntab = 'list'; render(); return; } renderModal(); return; }
  if (a === 'calDel') { var c0 = calsInit().filter(function (x) { return x.id === b.dataset.id; })[0]; if (!c0) return; snap(); S.cals = S.cals.filter(function (x) { return x !== c0; }); M = null; save(); render(); toastUndo('「' + c0.title + '」を削除しました'); return; }
  if (a === 'calSave') {
    if (!v('cT')) { toast('イベント名を入れてください'); document.getElementById('cT').focus(); return; }
    if (!v('cD')) { toast('開始日を入れてください'); return; }
    var to = v('cE'); if (to && to < v('cD')) { toast('終了日が開始日より前です'); return; }
    var data = { title: v('cT'), date: v('cD'), to: to === v('cD') ? '' : to, time: v('cH'), place: v('cP'), memo: v('cM'), link: v('cL'), state: document.getElementById('cS').checked ? 'pub' : 'draft' };
    snap(); var cid = M.id; if (cid) Object.assign(calsInit().filter(function (x) { return x.id === cid; })[0], data); else { cid = uid('c'); calsInit().push(Object.assign({ id: cid }, data)); }
    var cc = evCal(cid); if (cc && cc.inNotice === false) cc.inNotice = true;
    evSync(); M = null; save(); render(); toast('保存しました'); return;
  }
  if (a === 'evSave') {
    var n2 = task(M.id); if (!n2 || !canEv(n2)) return;
    var s0 = v('eS'), e0 = v('eE'); if (s0 && e0 && dayOf(e0) < dayOf(s0)) { toast('終了が開始より前になっています'); return; }
    snap(); if (s0) n2.start = s0; if (e0) n2.end = e0; n2.place = v('eP'); n2.purpose = document.getElementById('eD').value.trim(); n2.announce = document.getElementById('eA').checked ? 'done' : 'before';
    M = null; save(); render(); toast('保存しました'); return;
  }
}, true);
document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && M && (M.m === 'cal' || M.m === 'ev')) { M = null; renderModal(); } });

