// ---------- ux58 ガントの描き直し：開いたフォルダーの期間を画面いっぱいに俯瞰。
//   フォルダー＝進み具合つきの細いバー、ファイル＝担当の色のバー、バーの右に名前（イベントは告知と参加登録）。拡大したら週・日の目盛り ----------
function ganttRange(rows) {
  var lo = Infinity, hi = -Infinity, cf = S.view === 'projects' && typeof curFolder === 'function' ? curFolder() : null;
  if (cf && cf.start && cf.end) { lo = dayOf(cf.start); hi = dayOf(cf.end); }
  rows.forEach(function (r) { if (r.ghost || r.n.nodate) return; lo = Math.min(lo, dayOf(r.n.start)); hi = Math.max(hi, dayOf(r.n.end)); });
  if (!isFinite(lo)) { lo = TODAY; hi = TODAY + 60 * DAY; }
  var a = new Date(lo), b = new Date(hi);
  lo = Date.UTC(a.getUTCFullYear(), a.getUTCMonth(), 1);
  hi = Date.UTC(b.getUTCFullYear(), b.getUTCMonth() + 1, 1) - DAY; // 月の頭から月末まで
  if (hi - lo < 40 * DAY) hi = lo + 40 * DAY;
  return { lo: lo, hi: hi };
}
function gBarInfo(n) {
  if (isFolder(n)) {
    var g = progress(n), t = g.n ? g.d + '/' + g.n : '';
    if (isEvent(n)) t = [n.announce === 'done' ? '告知済み' : '告知前', n.announce === 'done' ? evCount(n) + '/' + (S.club || 150) + '名' : '', t ? '業務 ' + t : ''].filter(Boolean).join(' · ');
    return t;
  }
  return n.done ? '完了' : '';
}
// バーの右に名前を置く。右端からはみ出すときはバーの左に置く
function txtW(s, px) { var w = 0; String(s || '').split('').forEach(function (c) { w += /[ -~]/.test(c) ? px * 0.6 : px; }); return w; }
function blPos(n, info, bl, bw, TW) {
  var w = txtW(ttl(n), 12.5) + (info ? 8 + txtW(info, 11) : 0) + 4;
  if (bl + bw + 8 + w <= TW || bl - 8 - w < 0) return 'left:' + Math.round(bl + bw + 8) + 'px';
  return 'right:' + Math.round(TW - bl + 8) + 'px';
}
function ganttOf(rows) {
  var narrow = window.innerWidth < 760, LW = Math.max(150, Math.min(window.innerWidth - 120, (narrow ? S.lwN : S.lw) || (narrow ? 200 : 400)));
  var rg = ganttRange(rows), lo = rg.lo, hi = rg.hi;
  var avail = Math.max(320, (UI.gw ? UI.gw - LW : window.innerWidth - (narrow ? 0 : 220) - LW - 4) - 2);
  var fitPX = Math.max(1.2, Math.min(48, avail / (Math.round((hi - lo) / DAY) + 1)));
  var PX = S.gz ? Math.max(1.2, Math.min(48, S.gz)) : fitPX;
  hi = Math.max(hi, lo + (Math.ceil(avail / PX) - 1) * DAY); // 縮めても右端まで日付のマスで埋める
  var days = Math.round((hi - lo) / DAY) + 1;
  var TW = Math.max(Math.round(days * PX), Math.round(avail)), DAYS = PX >= 26, WEEKS = !DAYS && PX >= 3.2, WK = ['日', '月', '火', '水', '木', '金', '土'];
  var X = function (t) { return Math.round(Math.round((t - lo) / DAY) * PX); }, x = function (iso) { return X(dayOf(iso)); };
  var hd = '', ln = '', GML = [];
  for (var i = 0; i < days; i++) {
    var t = lo + i * DAY, d = new Date(t), wd = d.getUTCDay(), first = d.getUTCDate() === 1, gx = X(t);
    if (first || i === 0) GML.push({ x: gx, y: d.getUTCFullYear(), m: d.getUTCMonth() + 1 });
    if (first && i) ln += '<div class="gmo" style="left:' + gx + 'px"></div>';
    if (DAYS) {
      hd += '<div class="gd day' + (wd === 0 ? ' sun' : wd === 6 ? ' sat' : '') + (t === TODAY ? ' now' : '') + '" style="left:' + gx + 'px;width:' + Math.round(PX) + 'px">' + d.getUTCDate() + '<small>' + WK[wd] + '</small></div>';
      if (wd === 0 || wd === 6) ln += '<div class="gwe" style="left:' + gx + 'px;width:' + (X(t + DAY) - gx) + 'px"></div>';
    } else if (WEEKS && wd === 1) {
      hd += '<div class="gwk" style="left:' + gx + 'px">' + d.getUTCDate() + '</div>';
      ln += '<div class="gwl" style="left:' + gx + 'px"></div>';
    }
  }
  (function () { var end = -1e9, py = null, wOf = function (s) { return 8 + s.replace(/[0-9]/g, '').length * 12 + s.replace(/[^0-9]/g, '').length * 7.5 + 6; };
    var mw = 30 * PX; // 月の幅が狭いときは「年」を最初だけ
    GML.forEach(function (g) { var s = (py !== g.y ? (mw < 44 && py !== null ? "'" + String(g.y).slice(2) + ' ' : g.y + '年') : '') + g.m + (mw < 30 ? '' : '月'), w = wOf(s); if (g.x < end) return; hd += '<div class="gm" style="left:' + g.x + 'px">' + s + '</div>'; end = g.x + w; py = g.y; }); })();
  var cf = S.view === 'projects' && typeof curFolder === 'function' ? curFolder() : null;
  if (cf && cf.start) { var bx = x(cf.start), bw = x(cf.end) + PX - bx; ln += '<div class="gband" style="left:' + bx + 'px;width:' + Math.round(bw) + 'px"></div>'; }
  var tx = X(TODAY) + Math.round(PX / 2);
  if (TODAY >= lo && TODAY <= hi) { ln += '<div class="gnow" style="left:' + tx + 'px"></div>'; hd += '<div class="gnowl" style="left:' + tx + 'px">今日</div>'; }
  var cols = 'grid-template-columns:' + LW + 'px ' + TW + 'px';
  var gghost = function (pid, dd, ph, L) { return '<div data-d="' + (L || 0) + '" class="gr gghost" style="' + cols + ';--lc:' + LVC[lv(L || 0)] + '"><div class="gl" style="padding-left:' + (narrow ? 2 + dd * 8 : 8 + dd * 16) + 'px"><span class="dh ph"></span><span class="cx"></span><span class="wck ckph"></span><i class="lvb ghost"></i><span class="gico"></span><input class="cell ct" data-c="new" data-parent="' + pid + '" placeholder="' + ph + '" aria-label="' + ph + '" autocomplete="off"></div><div class="gt"></div></div>'; };
  var body = '', GZ = 0;
  rows.forEach(function (r) {
    if (!r.ghost && r.d === 0) GZ++;
    if (r.ghost) return;
    var n = r.n, parent = isFolder(n), w = member(n.who), dn = isDone(n);
    var cls = parent ? ' sum' + (r.d === 0 ? ' root' : '') + (dn ? ' done' : '') : (n.done ? ' done' : (!fileWho(n).length ? ' none' : ''));
    var bl = x(n.start), bw = Math.max(Math.max(PX, 4), x(n.end) - x(n.start) + PX), g = parent ? progress(n) : null;
    var info = gBarInfo(n), tip = ttl(n) + '  ' + fmtDate(n.start) + '–' + fmtDate(n.end) + (info ? '  ' + info : '') + (!parent && w ? '  ' + w.name : '');
    var bar = '<div class="bar' + cls + (late(n) ? ' late' : '') + (editSelf(n) ? '' : ' lock') + '" data-bar="' + n.id + '" style="left:' + bl + 'px;width:' + Math.round(bw) + 'px" title="' + esc(tip) + '">' +
      (parent && g.n ? '<i class="bp" style="width:' + Math.round(g.d / g.n * 100) + '%"></i>' : '') + '<span class="lb"></span>' + (editSelf(n) ? '<span class="hd" data-hd="1"></span>' : '') + '</div>' +
      '<span class="bl' + (parent ? ' f' : '') + '" style="' + blPos(n, info, bl, bw, TW) + '"><b>' + esc(ttl(n)) + '</b>' + (info ? '<small>' + esc(info) + '</small>' : '') + '</span>';
    var ed = editSelf(n) ? '' : ' disabled';
    body += '<div data-d="' + r.d + '" class="gr lv' + lv(r.d) + (r.d === 0 && isFolder(n) ? ' g0' : '') + (r.d === 0 && GZ > 1 ? ' gtop' : '') + (r.ctx ? ' gctx' : '') + (dn && !parent ? ' gdone' : '') + '" data-row="' + n.id + '" style="' + cols + ';--lc:' + LVC[lv(r.d)] + '"><div class="gl" style="padding-left:' + (narrow ? 2 + r.d * 8 : 8 + r.d * 16) + 'px">' + (canMove(n) ? '<span class="dh" data-drag="' + n.id + '" title="ドラッグで移動（Alt+↑↓でも可）" aria-label="移動"><svg viewBox="0 0 10 16" aria-hidden="true"><circle cx="3" cy="3" r="1.3"/><circle cx="7" cy="3" r="1.3"/><circle cx="3" cy="8" r="1.3"/><circle cx="7" cy="8" r="1.3"/><circle cx="3" cy="13" r="1.3"/><circle cx="7" cy="13" r="1.3"/></svg></span>' : '<span class="dh ph"></span>') + caret(r) +
        (r.d === 0 && isFolder(n) ? '<span class="wck ckph"></span>' : !parent ? '<input type="checkbox" class="check wck" data-c="done" data-id="' + n.id + '"' + (n.done ? ' checked' : '') + (editSelf(n) || fileWho(n).indexOf(S.me) >= 0 ? '' : ' disabled') + ' aria-label="完了">' : '<span class="wck ckph"></span>') +
        '<i class="lvb"></i><input class="cell ct" data-c="t" data-id="' + n.id + '" value="' + esc(ttl(n)) + '" title="' + esc(ttl(n)) + '"' + ed + ' aria-label="業務名" autocomplete="off">' +
        (isFolder(n) ? teamBtn(n, canAssign(n) ? '' : ' disabled', true) : '<select class="cell gsel" data-c="w" data-id="' + n.id + '"' + (canAssign(n) ? '' : ' disabled') + ' aria-label="担当">' + whoOpts(n) + '</select>') +
        '</div><div class="gt">' + bar + '</div></div>';
  });
  var addRow = cf && manages(cf) ? gghost(cf.id, 0, '＋ 追加', 0) : '';
  var nf = Math.max(3, Math.ceil((window.innerHeight - 52 - 41 - 49 - 56 - (rows.length + 1) * 36) / 36) + 1), fill = '';
  for (var j = 0; j < nf; j++) fill += '<div class="gr gfill" style="' + cols + '"><div class="gl"></div><div class="gt"></div></div>';
  var LWH = '<i class="lwh" title="ドラッグで幅を変更（ダブルクリックで元に戻す）"></i>';
  return ('<div class="gs gs2" id="gs"><div class="gg" data-px="' + PX + '" data-lo="' + lo + '" data-lw="' + LW + '" data-tw="' + TW + '" data-fit="' + (S.gz ? 0 : 1) + '" style="width:' + (LW + TW) + 'px">' +
    '<div class="glines" style="left:' + LW + 'px;width:' + TW + 'px">' + ln + '</div>' +
    '<div class="gr ghead" style="' + cols + '"><div class="gl">業務<span class="ghsub">' + (cf ? esc(shortDate(cf.start) + ' – ' + shortDate(cf.end)) : '') + '</span></div><div class="gt">' + hd + '</div></div>' + body + addRow + fill + '</div></div>').replace(/(<div class="gl"[^>]*>)/g, '$1' + LWH);
}
// 「全体」：開いているフォルダーの期間に合わせ直す
document.addEventListener('click', function (e) {
  var b = e.target.closest && e.target.closest('[data-act="gfit"]'); if (!b) return;
  e.stopImmediatePropagation(); e.preventDefault(); S.gz = null; UI.sl = 0; save(); render();
}, true);
