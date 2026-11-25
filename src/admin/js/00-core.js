(function () {
'use strict';
var KEY = 'slope-admin-v10';
var initials = function (name) { return String(name || '').split(' ')[0].slice(0, 1); };
var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
var nowLabel = function () { var d = new Date(); return (d.getMonth() + 1) + '.' + d.getDate() + ' ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); };
var uid = function (p) { return p + Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36); };

var TABS = [
  { id: 'projects', name: '業務' },
  { id: 'tracks', name: '教材' },
  { id: 'notices', name: '告知' },
  { id: 'board', name: 'サポート' }
];

// ---------------- sample data (fictional) ----------------
function sample() {
  return {
    notifs: [
      { to: 'm1', text: '田中 美咲さんが「会場の予約」を完了しました', sub: 'MIRA 2026', at: '11.10 18:02' },
      { to: 'm1', text: '佐藤 花子さんが「テーマと審査基準の公開」を完了しました', sub: 'MIRA 2026', at: '10.31 21:40' },
      { to: 'm2', text: '「基礎教育の単元一覧を確定」の担当になりました', sub: '教育コンテンツ作成', at: '11.16 09:00' },
      { to: 'm2', text: '「部員の試し読みと修正」の担当になりました', sub: '教育コンテンツ作成', at: '11.16 09:00' },
      { to: 'm3', text: '「外部審査員を2名探す」の担当になりました', sub: 'MIRA 2026', at: '10.27 12:15' },
      { to: 'm4', text: '「エントリーの告知」の担当になりました', sub: 'MIRA 2026', at: '11.02 10:30' },
      { to: 'm5', text: '「本選」の担当になりました', sub: 'MIRA 2026', at: '11.02 10:31' }
    ],
    club: 150, wtab: 'list', depth: 2, fold: {},
    view: 'dash', me: 'm1', cur: 'S', sel: 'ST2', proj: null, boardTab: 'rep', preview: 'm2', pDel: null,
    members: [
      { id: 'm1', name: '山田 太郎', grade: '経営 2年', unit: '代表', perms: ['all'] },
      { id: 'm2', name: '佐藤 花子', grade: '経済 2年', unit: '教育部', perms: ['tracks', 'projects'] },
      { id: 'm3', name: '鈴木 一郎', grade: '経営 2年', unit: '外務部 渉外局', perms: ['notices', 'projects'] },
      { id: 'm4', name: '高橋 健', grade: '理工 2年', unit: '外務部 広報局', perms: ['notices', 'board', 'projects'] },
      { id: 'm5', name: '田中 美咲', grade: '教育 2年', unit: '催事部', perms: ['projects'] },
      { id: 'm6', name: '伊藤 翔', grade: '経済 1年', unit: '—', roles: ['Strategist'], perms: [] },
      { id: 'm7', name: '小林 優', grade: '経営 1年', unit: '—', roles: ['Innovator', 'Negotiator'], perms: [] },
      { id: 'm8', name: '渡辺 蓮', grade: '理工 1年', unit: '—', roles: ['Engineer'], perms: [] },
      { id: 'm9', name: '中村 葵', grade: '都市 1年', unit: '—', roles: ['Advertiser'], perms: [] }
    ],
    program: { tree: [{ k: 't', id: 'B' }, { k: 'e', id: 'luna', name: 'LUNA', from: '2026-10-24', to: '2026-10-24', todo: '', link: '' },
      { k: 'g', id: 'roles', name: 'ロールトラック', order: 'one', items: [{ k: 't', id: 'S' }, { k: 't', id: 'N' }, { k: 't', id: 'A' }, { k: 't', id: 'E' }] },
      { k: 'e', id: 'mira', name: 'MIRA', from: '2026-12-05', to: '2026-12-06', todo: '', link: '' }, { k: 'e', id: 'nova', name: 'NOVA', from: '2027-02-20', to: '', todo: '', link: '' }] },
    tracks: [
      { id: 'B', name: '基礎教育', owner: '佐藤 花子', status: 'pub', start: '入部', goal: 'LUNA（学内ビジコン）', updated: '11.12 18:20 · 佐藤 花子',
        text: 'B1 起業の地図\nB2 資金調達の基礎 ← B1\nB3 ロールと分業 ← B1\nB4 市場の分析 ← B1\nB5 ビジネスモデルの分析 [対面] ← B4\nS1 ビジネスマナー\nS2 Officeの実用 ← S1\nS3 企画書の書き方 [実習] ← B5, S2', units: {} },
      { id: 'S', name: 'Strategist', owner: '佐藤 花子', status: 'draft', start: '基礎教育 修了', goal: 'MIRA（学内ビジコン）', updated: '11.15 22:05 · 佐藤 花子',
        text: '# 1行に1単元。「コード 名前 [タグ] ← 前提」\nST1 社会情勢と業界\nST3 経理の基礎\nST2 戦略理論 ← ST1\nST4 資金と資産の管理 ← ST3\nST5 株式と資本政策 ← ST3\nST6 戦略立案 [実習] ← ST2, ST4, ST5\nST7 戦略監査 [実習] [対面] ← ST6, I2',
        units: {
          ST2: { practice: 'LUNAで扱った事業の競合を洗い出し、ポジショニングマップと競争優位の仮説を1枚にまとめる。', milestone: '競争優位の源泉を説明できる',
                 materials: [ { url: 'https://example.com/competitive-strategy', memo: '競争戦略の基本（サンプル）', type: '記事' },
                              { url: 'https://www.youtube.com/watch?v=sample', memo: 'ポジショニングの考え方（サンプル）', type: '動画' } ] }
        } },
      { id: 'N', name: 'Negotiator', owner: '佐藤 花子', status: 'draft', start: '基礎教育 修了', goal: 'MIRA（学内ビジコン）', updated: '11.14 12:40 · 佐藤 花子',
        text: 'N1 コミュニケーション理論\nN2 営業理論 ← N1\nN3 顧客ヒアリング ← N1\nN4 交渉 ← N2\nN5 営業演習 [実習] [対面] ← N3, N4', units: {} },
      { id: 'A', name: 'Advertiser', owner: '山田 太郎', status: 'draft', start: '基礎教育 修了', goal: 'MIRA（学内ビジコン）', updated: '—', text: '', units: {} },
      { id: 'E', name: 'Engineer', owner: '山田 太郎', status: 'draft', start: '基礎教育 修了', goal: 'MIRA（学内ビジコン）', updated: '11.10 09:15 · 山田 太郎',
        text: 'E1 lumosの講座 [外部]\nE2 MVPの範囲の切り方 ← E1', units: {} },
      { id: 'I', name: 'Innovator', owner: '山田 太郎', status: 'draft', start: '基礎教育 修了', goal: '掲示板へ投稿', updated: '11.13 20:02 · 山田 太郎',
        text: 'I1 メンタリティ講習\nI2 アイデア立案演習\nI3 相互評価 [対面] ← I2, ST7\nI4 自己選別 ← I1, I3', units: {} },
      { id: 'L', name: '実務：法務', owner: '佐藤 花子', status: 'draft', start: '必要になったら', goal: '修了', updated: '11.15 23:10 · 佐藤 花子',
        text: 'L1 会社設立と法人形態\nL2 契約の基本\nL3 知的財産\nL4 個人情報とプライバシーポリシー\nL5 創業者間契約と株式\nL6 販売と広告のルール', units: {} }
    ],
    notices: [
      { id: 'n1', type: 'ビジコン', title: '学生ビジネスプランコンテスト 2027', host: '[主催団体]', due: '2027-01-15', url: 'https://example.com/contest', memo: '書類審査あり。チームでも個人でも可。', state: 'pub' },
      { id: 'n2', type: 'インターン', title: 'スタートアップの事業開発インターン', host: '[企業名]', due: '2026-12-10', url: 'https://example.com/intern', memo: '週2日から。1年生も応募可。', state: 'pub' },
      { id: 'n3', type: '説明会', title: '創業支援制度の説明会', host: '[自治体名]', due: '2026-12-03', url: 'https://example.com/support', memo: '', state: 'draft' }
    ],
    offers: [
      { id: 'o1', type: '説明会', title: '学生起業家ミートアップ', host: '[団体名]', due: '2026-11-29', url: 'https://example.com/meetup', by: '経営 1年 · 小林 優', note: '去年参加した。起業経験者と直接話せる。', state: 'wait' },
      { id: 'o2', type: 'インターン', title: 'マーケティングインターン', host: '[企業名]', due: '2026-12-12', url: 'https://example.com/mkt', by: '理工 1年 · 渡辺 蓮', note: '先輩が参加してSNS運用を任されたらしい。', state: 'wait' }
    ],
    posts: [
      { id: 'p1', kind: 'コメント', tab: 'その他', on: '「起業の科学」読んだ人いる？', who: '経済 1年 · 伊藤 翔', time: '11.15 23:40', text: 'これ読むくらいなら自分でググった方が早い。時間の無駄。', reports: 2, reason: '攻撃的な表現', state: 'ok' },
      { id: 'p2', kind: '投稿', tab: '募集', on: '', who: '都市 1年 · 中村 葵', time: '11.15 20:12', text: '【至急】稼げる副業の仲間募集。初期費用3万円だけで月10万。DMください。', reports: 3, reason: '勧誘・宣伝', state: 'ok' },
      { id: 'p3', kind: '投稿', tab: 'ペイン', on: '', who: '経営 1年 · 小林 優', time: '11.14 18:03', text: '大学の空き教室を予約する手続きが紙で、毎回事務室まで行かないといけない。', reports: 0, reason: '', state: 'ok' },
      { id: 'p4', kind: '投稿', tab: 'その他', on: '', who: '理工 1年 · 渡辺 蓮', time: '11.14 12:30', text: '期末とMIRAの準備がかぶってて普通にしんどい。みんなどうしてる？', reports: 1, reason: '関係のない投稿', state: 'ok' },
      { id: 'p5', kind: '投稿', tab: '募集', on: '', who: '経済 2年 · 佐藤 花子', time: '11.13 09:20', text: '大学生向けの家計管理アプリ。エンジニア1名、Advertiser 1名を募集しています。', reports: 0, reason: '', state: 'ok' }
    ],
    projects: [
      { id: 'pj2', name: 'MIRA 2026', kind: 'event', announce: 'done', reg: 41, unit: '教育部', who: 'm2', start: '2026-10-20', end: '2026-11-28', tasks: [
        { id: 'g1', title: '審査の準備', who: 'm2', start: '2026-10-20', end: '2026-11-20', kids: [
          { id: 'k7', title: 'テーマと審査基準の公開', who: 'm2', start: '2026-10-20', end: '2026-10-31', done: true },
          { id: 'k8', title: '外部審査員を2名探す', who: 'm3', start: '2026-10-27', end: '2026-11-13', done: false },
          { id: 'k8b', title: '審査シートの作成', who: '', start: '2026-11-14', end: '2026-11-20', done: false } ] },
        { id: 'g2', title: '集客', who: 'm4', start: '2026-11-02', end: '2026-11-21', kids: [
          { id: 'k9', title: 'エントリーの告知', who: 'm4', start: '2026-11-02', end: '2026-11-21', done: false } ] },
        { id: 'g3', title: '当日運営', who: 'm5', start: '2026-11-02', end: '2026-11-28', kids: [
          { id: 'k10', title: '会場の予約', who: 'm5', start: '2026-11-02', end: '2026-11-10', done: true },
          { id: 'g3t', title: '進行チーム', who: 'm8', start: '2026-11-16', end: '2026-11-27', kids: [
            { id: 'k11', title: '当日の進行表', who: 'm8', start: '2026-11-16', end: '2026-11-26', done: false },
            { id: 'k11b', title: '司会の台本', who: 'm9', start: '2026-11-20', end: '2026-11-27', done: false } ] },
          { id: 'k12', title: '本選', who: 'm5', start: '2026-11-28', end: '2026-11-28', done: false } ] } ] },
      { id: 'pj1', name: '教育コンテンツ作成', kind: 'work', unit: '教育部', who: 'm2', start: '2026-11-16', end: '2027-03-31', tasks: [
        { id: 'g4', title: '基礎教育', who: 'm2', start: '2026-11-16', end: '2027-01-20', kids: [
          { id: 'k1', title: '単元一覧を確定', who: 'm2', start: '2026-11-16', end: '2026-11-30', done: false },
          { id: 'g4t', title: '既存教材の選定チーム', who: 'm6', start: '2026-12-01', end: '2027-01-20', kids: [
            { id: 'k2', title: '起業の地図・資金調達', who: 'm6', start: '2026-12-01', end: '2026-12-25', done: false },
            { id: 'k2b', title: 'ビジネスマナー・Office', who: 'm7', start: '2026-12-01', end: '2026-12-25', done: false },
            { id: 'k2c', title: '市場とビジネスモデルの分析', who: '', start: '2026-12-26', end: '2027-01-20', done: false } ] },
          { id: 'k3', title: '演習会の進め方を決める', who: 'm7', start: '2026-12-07', end: '2026-12-25', done: false } ] },
        { id: 'g5', title: 'Strategistトラック', who: '', start: '2027-01-10', end: '2027-03-10', done: false },
        { id: 'k6', title: '部員の試し読みと修正', who: 'm2', start: '2027-02-15', end: '2027-03-31', done: false } ] },
      { id: 'pj3', name: '新歓 2027', kind: 'event', announce: 'before', reg: 0, unit: '催事部', who: 'm5', start: '2027-02-15', end: '2027-04-30', tasks: [
        { id: 'g6', title: '広報', who: 'm4', start: '2027-02-15', end: '2027-04-10', kids: [
          { id: 'k13', title: 'ビラの作成', who: 'm4', start: '2027-02-15', end: '2027-03-10', done: false },
          { id: 'k13b', title: 'SNSでの告知', who: '', start: '2027-03-01', end: '2027-04-10', done: false } ] },
        { id: 'g7', title: '説明会', who: 'm5', start: '2027-03-01', end: '2027-04-17', kids: [
          { id: 'k14', title: '会場の予約', who: 'm5', start: '2027-03-01', end: '2027-03-15', done: false },
          { id: 'k15', title: '説明会の当日', who: 'm9', start: '2027-04-06', end: '2027-04-17', done: false } ] },
        { id: 'k16', title: 'チュートリアル', who: 'm5', start: '2027-04-28', end: '2027-04-28', done: false } ] },
      { id: 'pj8', name: 'LUNA 2027', kind: 'event', announce: 'before', reg: 0, unit: '教育部', who: '', start: '2027-05-10', end: '2027-06-26', tasks: [] },
      { id: 'pj9', name: '夏合宿 2027', kind: 'event', announce: 'before', reg: 0, unit: '催事部', who: '', start: '2027-07-01', end: '2027-09-04', tasks: [] },
      { id: 'pj4', name: '新歓 2026', kind: 'event', announce: 'done', reg: 132, unit: '催事部', who: 'm5', start: '2026-03-01', end: '2026-04-30',
        tasks: [ { id: 'k17', title: '説明会', who: 'm5', start: '2026-04-06', end: '2026-04-17', done: true }, { id: 'k18', title: 'チュートリアル', who: 'm5', start: '2026-04-28', end: '2026-04-28', done: true } ] },
      { id: 'pj5', name: 'LUNA 2026', kind: 'event', announce: 'done', reg: 104, unit: '教育部', who: 'm2', start: '2026-05-15', end: '2026-06-27',
        tasks: [ { id: 'k19', title: '課題の公開', who: 'm2', start: '2026-05-15', end: '2026-05-31', done: true }, { id: 'k20', title: '本選', who: 'm2', start: '2026-06-27', end: '2026-06-27', done: true } ] },
      { id: 'pj6', name: '夏合宿 2026', kind: 'event', announce: 'done', reg: 63, unit: '催事部', who: 'm5', start: '2026-07-01', end: '2026-09-04',
        tasks: [ { id: 'k21', title: '宿の予約', who: 'm5', start: '2026-07-01', end: '2026-07-20', done: true }, { id: 'k22', title: '合宿', who: 'm5', start: '2026-09-02', end: '2026-09-04', done: true } ] },
      { id: 'pj7', name: '学祭出展 2026', kind: 'event', announce: 'done', reg: 48, unit: '催事部', who: 'm5', start: '2026-09-20', end: '2026-11-03',
        tasks: [ { id: 'k23', title: '出展申請', who: 'm5', start: '2026-09-20', end: '2026-10-05', done: true }, { id: 'k24', title: '当日運営', who: 'm4', start: '2026-11-01', end: '2026-11-03', done: true } ] }
    ]
  };
}

var S;
try { S = JSON.parse(localStorage.getItem(KEY)); } catch (e) { S = null; }
if (!S || !S.projects) S = sample();
function save() {
  try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {}
  if (S.view === 'tracks' && P2F && P2F.style.display !== 'none') { clearTimeout(P2RT); P2RT = setTimeout(p2FrameReload, window.sb ? 2500 : 600); } // 右の部員画面を読み直す
}
function toast(msg) { var t = document.getElementById('toast'); t.textContent = msg; t.hidden = false; clearTimeout(toast._t); toast._t = setTimeout(function () { t.hidden = true; }, 2000); }
function member(id) { return S.members.filter(function (m) { return m.id === id; })[0]; }
function me() { return member(S.me) || S.members[0]; }
function hasPerm(m, tab) { return !!m && (m.perms.indexOf('all') >= 0 || m.perms.indexOf(tab) >= 0); }
function can(tab) { return hasPerm(me(), tab); }
function isAdmin() { return me().perms.indexOf('all') >= 0; }
function permLabel(m) { return m.perms.indexOf('all') >= 0 ? 'すべて' : m.perms.length ? m.perms.map(function (p) { return TABS.filter(function (t) { return t.id === p; })[0].name; }).join('・') : '権限なし'; }


function track() { return S.tracks.filter(function (t) { return t.id === S.cur; })[0] || S.tracks[0]; }
function unitData(t, code) { if (!t.units[code]) t.units[code] = { practice: '', milestone: '', materials: [] }; return t.units[code]; }

// ---------------- parsing ----------------
// Line: "CODE 名前 [タグ] [タグ] ← DEP, DEP"   ("<-" also accepted; "#" starts a comment)
function parse(text) {
  var units = [], errs = [], seen = {};
  String(text || '').split('\n').forEach(function (raw, i) {
    var line = raw.replace(/\s+$/, '');
    var t = line.trim();
    if (!t || t.charAt(0) === '#') return;
    var parts = t.split(/←|<-/);
    if (parts.length > 2) { errs.push({ line: i + 1, msg: '「←」は1行に1つだけ書けます' }); return; }
    var left = parts[0].trim(), right = (parts[1] || '').trim();
    var m = left.match(/^(\S+)\s+(.+)$/);
    if (!m) { errs.push({ line: i + 1, msg: '「コード 名前」の形で書いてください（例：ST1 社会情勢と業界）' }); return; }
    var code = m[1], tags = [];
    var title = m[2].replace(/\[([^\]]+)\]/g, function (_, x) { tags.push(x.trim()); return ''; }).trim();
    if (!title) { errs.push({ line: i + 1, msg: code + ' の名前がありません' }); return; }
    if (seen[code]) { errs.push({ line: i + 1, msg: 'コード ' + code + ' が' + seen[code] + '行目と重複しています' }); return; }
    seen[code] = i + 1;
    var deps = right ? right.split(/[,、，]/).map(function (s) { return s.trim(); }).filter(Boolean) : [];
    units.push({ code: code, title: title, tags: tags, deps: deps, line: i + 1 });
  });
  return { units: units, errs: errs };
}
function allCodes() {
  var map = {};
  S.tracks.forEach(function (t) { parse(t.text).units.forEach(function (u) { map[u.code] = { track: t.name, title: u.title }; }); });
  return map;
}

// 教材のURL：種類とサイト名
function detectType(url) {
  var u = String(url || '').toLowerCase();
  if (/youtube\.com|youtu\.be|vimeo\.com/.test(u)) return '動画';
  if (/docs\.google\.com\/presentation|canva\.com|speakerdeck\.com|slideshare/.test(u)) return 'スライド';
  if (/docs\.google\.com\/document|notion\.(so|site)/.test(u)) return '資料';
  if (/docs\.google\.com\/spreadsheets/.test(u)) return '表';
  if (/drive\.google\.com/.test(u)) return 'ファイル';
  if (/\.pdf(\?|#|$)/.test(u)) return 'PDF';
  return '記事';
}
function host(url) { try { return new URL(url).hostname.replace(/^www\./, ''); } catch (e) { return ''; } }


// ---------------- helpers ----------------
var DAY = 86400000;
function fmtDate(iso) { var p = String(iso || '').split('-'); return p.length === 3 ? (+p[1]) + '/' + (+p[2]) : iso; }
var TODAY = (function () { var d = new Date(); return Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()); })();
function dayOf(iso) { var p = String(iso).split('-'); return Date.UTC(+p[0], +p[1] - 1, +p[2]); }
function isoOf(t) { var d = new Date(t); return d.getUTCFullYear() + '-' + String(d.getUTCMonth() + 1).padStart(2, '0') + '-' + String(d.getUTCDate()).padStart(2, '0'); }
function late(k) { return !k.tasks && !(k.kids && k.kids.length) && !k.done && !k.nodate && dayOf(k.end) < TODAY; }
// ---------------- 業務ツリー ----------------
function kids(n) { return n.tasks || n.kids || []; }
function ttl(n) { return n.name || n.title; }
var IX = {};
function reindex() { IX = {}; S.projects.forEach(function (r) { (function walk(n, par, d) { IX[n.id] = { n: n, par: par, root: r, d: d }; kids(n).forEach(function (c) { walk(c, n, d + 1); }); })(r, null, 0); }); }
function task(id) { reindex(); return IX[id] ? IX[id].n : null; }
function rootOf(n) { reindex(); return IX[n.id] ? IX[n.id].root : n; }
function parentOf(n) { reindex(); return IX[n.id] ? IX[n.id].par : null; }
function depthOf(n) { reindex(); return IX[n.id] ? IX[n.id].d : 0; }
function nodesOf(n) { var r = [n]; kids(n).forEach(function (x) { r = r.concat(nodesOf(x)); }); return r; }
function isDone(n) { var c = kids(n); if (!c.length) return n.tasks ? false : !!n.done; return c.every(isDone); }
 // 個人以外は複数人
function chainTeam(n, id) { reindex(); var x = n; while (x) { if (inTeam(x, id)) return true; x = IX[x.id] && IX[x.id].par; } return false; }
function involved(r, id) { return nodesOf(r).some(function (x) { return inTeam(x, id); }); }
function proj() { return null; }
function progress(p) { var l = leavesOf(p); return { n: l.length, d: l.filter(function (k) { return k.done; }).length, late: l.filter(late).length }; }
function isEvent(p) { return p.kind === 'event'; }
function ended(p) { return dayOf(p.end) < TODAY; }
function evCount(p) { var c = p.ev && evCal(p.ev); return c ? ((c.att || []).length || (S.joins || {})[c.id] || 0) : (p.reg || 0); }
function pct(p) { return Math.round(evCount(p) / (S.club || 150) * 100); }
var LEVELS = [['1', 'イベント'], ['2', '部'], ['3', 'チーム'], ['9', '個人']];
function byStart(a, b) { return dayOf(a.start) - dayOf(b.start); }
function manualRoots() { if (!S.manualOrder) { S.projects.sort(byStart); S.manualOrder = true; } } // 一度でも並べ替えたら手動順
function visNode(n) { return isAdmin() || chainTeam(n, S.me) || nodesOf(n).some(function (x) { return inTeam(x, S.me); }); }
var MAXD = 3; // イベント(0) / 部(1) / チーム(2) / 個人(3)
var LVC = ['#111827', '#4B5563', '#9CA3AF', '#CBD5E1'];
function lv(d) { return Math.min(d, 3); }
function caret(r) {
  return r.has ? '<button class="cx" data-act="fold" data-id="' + r.n.id + '" aria-expanded="' + r.open + '" aria-label="' + (r.open ? '折りたたむ' : '展開する') + '"><svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="' + (r.open ? 'M7 10l5 5 5-5' : 'M10 7l5 5-5 5') + '"/></svg></button>' : '<span class="cx"></span>';
}
// 業務：ファイルを開いているときはそのページ、それ以外はフォルダー（カード／ガント）
function viewWork() {
  var n = S.fcur && S.fcur !== 'mine' ? task(S.fcur) : null; if (n && !isFolder(n)) { S.wtab = 'list'; return filePage(n); }
  curFolder();
  var body;
  if (S.fmode === 'gantt' && window.innerWidth < 760) {
    S.wtab = 'list';
    body = '<div class="body"><div class="gnote">' + GANTT + '<b>ガントチャートはPCで表示できます</b><span>スマホでは画面が狭いため表示できません。PCで開いてください。</span><button class="btn" data-act="fmode" data-v="card">カードで見る</button></div></div>';
  } else if (S.fmode === 'gantt') {
    S.wtab = 'gantt';
    body = workGantt();
  } else {
    S.wtab = 'list';
    var f = curFolder(), list = visibleRoots();
    var add = manages(f) && S.fcur !== 'mine' ? (UI.fadd ? '<div class="fcard fadd open"><button data-act="newF">' + FOLD + 'フォルダー</button>' + (f ? '<button data-act="newT">' + FILE + 'ファイル</button>' : '') + '</div>' : '<button class="fcard fadd" data-act="fadd" aria-label="追加"><svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg></button>') : '';
    body = '<div class="body"><div class="fgrid">' + list.map(fcard).join('') + add + '</div>' + (!list.length && !add ? '<div class="empty big">まだ何もありません</div>' : '') + '</div>';
  }
  return top('業務') + '<div class="wk"><aside class="ftree" aria-label="フォルダー">' + ftree() + '</aside><div class="wkm">' + fhead2() + body + '</div></div>';
}
function workGantt() {
  var tbar = '<div class="tbar"><span class="muted" style="font-size:12px">表示</span><span class="seg" role="group" aria-label="表示する細かさ">' + LEVELS.map(function (l) {
      return '<button data-act="depth" data-v="' + l[0] + '" aria-pressed="' + (String(S.depth || 2) === l[0] && !Object.keys(S.fold || {}).length) + '"><i class="lvd" style="background:' + LVC[LEVELS.indexOf(l)] + '"></i>' + l[1] + '</button>'; }).join('') + '</span>' + (S.wtab === 'gantt' ? '<span class="zoom"><button class="ib" data-act="zoom" data-v="-1" aria-label="縮小">−</button><button class="ib" data-act="zoom" data-v="1" aria-label="拡大">＋</button></span>' : '') +
    '<label class="chk"><input type="checkbox" class="check" data-act="showEnded"' + (S.showEnded ? ' checked' : '') + '>終了したイベント</label>' + (S.wtab === 'list' ? '<details class="keys hide-sm"><summary aria-label="キーボード操作">?</summary><div class="kpop"><b>キーボード操作</b><span><kbd>Enter</kbd> 下に追加</span><span><kbd>Tab</kbd> 一段下げる</span><span><kbd>Shift</kbd>+<kbd>Tab</kbd> 一段上げる</span><span><kbd>Alt</kbd>+<kbd>↑↓</kbd> 並べ替え</span></div></details>' : '') + '</div>';
  return tbar + '<div class="body flush">' + ganttOf(rowsOf(false, true)) + '</div>';
}

function ganttOf(rows) {
  var narrow = window.innerWidth < 760, LW = Math.max(150, Math.min(window.innerWidth - 120, (narrow ? S.lwN : S.lw) || (narrow ? 200 : 420)));
  var lo = Infinity, hi = -Infinity;
  rows.forEach(function (r) { if (r.ghost) return; lo = Math.min(lo, dayOf(r.n.start)); hi = Math.max(hi, dayOf(r.n.end)); });
  if (!rows.length) { lo = TODAY; hi = TODAY; }
  var d1 = new Date(Math.min(lo, TODAY)); lo = Date.UTC(d1.getUTCFullYear(), d1.getUTCMonth(), 1);
  hi = Math.max(hi + 14 * DAY, Date.UTC(d1.getUTCFullYear() + 1, d1.getUTCMonth(), 1) - DAY);
  var avail = Math.max(320, UI.gw ? UI.gw - LW : window.innerWidth - (narrow ? 0 : 220) - LW - 4); // UI.gw＝実際に見えている幅（描いたあとに測る）
  var PX = Math.max(2, Math.min(48, S.zoom || (narrow ? 8 : 12)));
  hi = Math.max(hi, lo + (Math.ceil(avail / PX) - 1) * DAY); // 縮めても右端まで日付のマスで埋める
  var days = Math.round((hi - lo) / DAY) + 1;
  var TW = Math.max(days * PX, avail), DAYS = PX >= 30, WK = ['日', '月', '火', '水', '木', '金', '土'];
  var x = function (iso) { return Math.round(Math.round((dayOf(iso) - lo) / DAY) * PX); };
  var hd = '', ln = '';
  // grid density follows the zoom: months only when far out, + weeks in the middle, + every day when close
  var GX = function (i) { return Math.round(i * PX); }, GML = [];
  for (var i = 0; i < days; i++) {
    var d = new Date(lo + i * DAY), wd = d.getUTCDay(), first = d.getUTCDate() === 1;
    if (first || i === 0) GML.push({ x: GX(i), y: d.getUTCFullYear(), m: d.getUTCMonth() + 1 }); // 月の見出しは後で重ならないように並べる
    if (first && i) ln += '<div class="gmo" style="left:' + GX(i) + 'px"></div>';
    if (DAYS) {
      hd += '<div class="gd day' + (wd === 0 ? ' sun' : wd === 6 ? ' sat' : '') + '" style="left:' + GX(i) + 'px;width:' + Math.round(PX) + 'px">' + d.getUTCDate() + '<small>' + WK[wd] + '</small></div>';
      if (wd === 0 || wd === 6) ln += '<div class="gwe" style="left:' + GX(i) + 'px;width:' + (GX(i + 1) - GX(i)) + 'px"></div>';
    }
  }
  // 月の見出し：前の見出しと重なるものは出さない。年が付くはずだった見出しを省いたら、次に出す見出しに年を付ける
  (function () { var end = -1e9, py = null, wOf = function (t) { return 6 + t.replace(/[0-9]/g, '').length * 12 + t.replace(/[^0-9]/g, '').length * 7.5 + 6; };
    GML.forEach(function (g) { var t = (py !== g.y ? g.y + '年' : '') + g.m + '月', w = wOf(t); if (g.x < end) return; hd += '<div class="gm" style="left:' + g.x + 'px">' + t + '</div>'; end = g.x + w; py = g.y; }); })();
  var cf = S.view === 'projects' && typeof curFolder === 'function' ? curFolder() : null;
  if (cf) { var bx = x(cf.start), bw = x(cf.end) + PX - bx; ln += '<div class="gband" style="left:' + bx + 'px;width:' + bw + 'px"></div>'; hd += '<div class="gbh" style="left:' + bx + 'px;width:' + bw + 'px" title="' + esc(ttl(cf)) + '：' + shortDate(cf.start) + ' – ' + shortDate(cf.end) + '"><span>' + shortDate(cf.start) + '</span><span>' + shortDate(cf.end) + '</span></div>'; }
  var tx = Math.round((TODAY - lo) / DAY * PX);
  if (tx >= 0 && tx <= TW) { ln += '<div class="gnow" style="left:' + tx + 'px"></div>'; hd += '<div class="gnowl" style="left:' + tx + 'px">今日</div>'; }
  var cols = 'grid-template-columns:' + LW + 'px ' + TW + 'px';
  var wopts = function (sel) { return '<option value="">未定</option>' + S.members.map(function (m) { return '<option value="' + m.id + '"' + (sel === m.id ? ' selected' : '') + '>' + esc(m.name) + '</option>'; }).join(''); };
  var gghost = function (pid, d, ph, L) { return '<div data-d="' + (L || 0) + '" class="gr gghost" style="' + cols + ';--lc:' + LVC[lv(L || 0)] + '"><div class="gl" style="padding-left:' + (narrow ? 2 + d * 8 : 8 + d * 14) + 'px"><span class="dh ph"></span><span class="cx"></span><span class="wck ckph"></span><i class="lvb ghost"></i><span class="gico"></span><input class="cell ct" data-c="new" data-parent="' + pid + '" placeholder="' + ph + '" aria-label="' + ph + '" autocomplete="off"></div><div class="gt"></div></div>'; };
  var body = '';
  var GZ = 0;
  rows.forEach(function (r, idx) {
    if (!r.ghost && r.d === 0) GZ++;
    if (r.ghost) return; // 追加の行はフォルダーごとには出さない（行にカーソルを合わせると＋、右クリックでも足せる）
    var n = r.n, parent = isFolder(n), w = member(n.who), dn = isDone(n);
    var cls = parent ? ' sum' + (r.d === 0 ? ' root' : '') + (dn ? ' done' : '') : (n.done ? ' done' : (!n.who ? ' none' : ''));
    var bar = '<div class="bar' + cls + (late(n) ? ' late' : '') + (editSelf(n) ? '' : ' lock') + '" data-bar="' + n.id + '" style="left:' + x(n.start) + 'px;width:' + Math.max(PX, x(n.end) - x(n.start) + PX) + 'px" title="' + esc(ttl(n) + '  ' + fmtDate(n.start) + '–' + fmtDate(n.end) + (w ? '  ' + w.name : '')) + '">' +
      (parent ? '' : '<span class="lb">' + esc(n.done ? '完了' : w ? w.name : '') + '</span>') + (editSelf(n) ? '<span class="hd" data-hd="1"></span>' : '') + '</div>';
    var ed = editSelf(n) ? '' : ' disabled';
    body += '<div data-d="' + r.d + '" class="gr lv' + lv(r.d) + (r.d === 0 && isFolder(n) ? ' g0' : '') + (r.d === 0 && GZ > 1 ? ' gtop' : '') + (GZ % 2 === 0 ? ' gz' : '') + (r.ctx ? ' gctx' : '') + (dn && !parent ? ' gdone' : '') + '" data-row="' + n.id + '" style="' + cols + ';--lc:' + LVC[lv(r.d)] + '"><div class="gl" style="padding-left:' + (narrow ? 2 + r.d * 8 : 8 + r.d * 14) + 'px">' + (canMove(n) ? '<span class="dh" data-drag="' + n.id + '" title="ドラッグで移動（Alt+↑↓でも可）" aria-label="移動"><svg viewBox="0 0 10 16" aria-hidden="true"><circle cx="3" cy="3" r="1.3"/><circle cx="7" cy="3" r="1.3"/><circle cx="3" cy="8" r="1.3"/><circle cx="7" cy="8" r="1.3"/><circle cx="3" cy="13" r="1.3"/><circle cx="7" cy="13" r="1.3"/></svg></span>' : '<span class="dh ph"></span>') + caret(r) +
        (r.d === 0 && isFolder(n) ? '<span class="wck ckph"></span>' : !parent ? '<input type="checkbox" class="check wck" data-c="done" data-id="' + n.id + '"' + (n.done ? ' checked' : '') + (editSelf(n) || n.who === S.me ? '' : ' disabled') + ' aria-label="完了">' : '<span class="wck ckph"></span>') +
        '<i class="lvb"></i><input class="cell ct" data-c="t" data-id="' + n.id + '" value="' + esc(ttl(n)) + '" title="' + esc(ttl(n)) + '"' + ed + ' aria-label="業務名" autocomplete="off">' + (late(n) ? '<span class="lt" title="期限切れ"></span>' : '') +
        (isFolder(n) ? teamBtn(n, canAssign(n) ? '' : ' disabled', true) : '<select class="cell gsel" data-c="w" data-id="' + n.id + '"' + (canAssign(n) ? '' : ' disabled') + ' aria-label="担当">' + whoOpts(n) + '</select>') +
        (isFolder(n) && manages(n) ? '<button class="ib ga gplus" data-act="gaddIn" data-id="' + n.id + '" title="中に追加" aria-label="中に追加"><svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg></button>' : '') +
        '<button class="ib ga" data-act="edit" data-id="' + n.id + '" aria-label="詳細">' + ic('more') + '</button></div>' +
      '<div class="gt">' + bar + '</div></div>';
  });
  var cf0 = S.view === 'projects' && typeof curFolder === 'function' ? curFolder() : null, addRow = cf0 && manages(cf0) ? gghost(cf0.id, 0, '＋ 追加', 0) : '';
  var _unused = false ? (rows.length ? '<div class="gr gsp" style="' + cols + '"><div class="gl"></div><div class="gt"></div></div>' : '') + gghost('', 0, '＋ イベントを追加', 0) : '';
  var n = Math.max(3, Math.ceil((window.innerHeight - 52 - 41 - 49 - 56 - (rows.length + 1) * 40) / 40) + 1), fill = '';
  for (var j = 0; j < n; j++) fill += '<div class="gr gfill" style="' + cols + '"><div class="gl"></div><div class="gt"></div></div>';
  var LWH = '<i class="lwh" title="ドラッグで幅を変更（ダブルクリックで元に戻す）"></i>';
  return ('<div class="gs" id="gs"><div class="gg" data-px="' + PX + '" data-lo="' + lo + '" data-lw="' + LW + '" data-tw="' + TW + '" style="width:' + (LW + TW) + 'px">' +
    '<div class="glines" style="left:' + LW + 'px;width:' + TW + 'px">' + ln + '</div>' +
    '<div class="gr ghead" style="' + cols + '"><div class="gl">業務</div><div class="gt">' + hd + '</div></div>' + body + addRow + fill + '</div></div>').replace(/(<div class="gl"[^>]*>)/g, '$1' + LWH);
}
function projStats() {
  var ev = allEvents(), fin = ev.filter(ended).sort(function (a, b) { return dayOf(a.end) - dayOf(b.end); });
  var open = ev.filter(function (p) { return !ended(p) && p.announce === 'done'; }), before = ev.filter(function (p) { return !ended(p) && p.announce !== 'done'; });
  var avg = fin.length ? Math.round(fin.reduce(function (n, p) { return n + pct(p); }, 0) / fin.length) : 0;
  var hi = fin.slice().sort(function (a, b) { return pct(b) - pct(a); })[0], lo = fin.slice().sort(function (a, b) { return pct(a) - pct(b); })[0];
  var kpi = function (l, v, sub) { return '<div class="kpi"><span>' + l + '</span><b>' + v + '</b><small>' + sub + '</small></div>'; };
  var rows = fin.concat(open).map(function (p) {
    var r = pct(p), live = !ended(p);
    return '<div class="hb" style="padding:10px 14px"><span class="l" style="width:120px;display:flex;flex-direction:column;line-height:1.35"><span style="font-weight:500;color:var(--text)">' + esc(p.name) + '</span><span class="muted num" style="font-size:11px">' + fmtDate(p.end) + (live ? '・受付中' : '') + '</span></span>' +
      '<span class="b" style="height:8px"><i style="width:' + r + '%;' + (live ? 'background:var(--accent)' : '') + '"></i></span>' +
      '<span class="num" style="width:96px;text-align:right;font-size:12px"><b style="font-weight:600">' + r + '%</b> <span class="muted">' + evCount(p) + '/' + S.club + '</span></span></div>';
  }).join('');
  return '<div class="kpis">' + kpi('平均参加率', avg + '%', '終了したイベント ' + fin.length + ' 件') + kpi('最も高い', hi ? pct(hi) + '%' : '—', hi ? esc(hi.name) : '') +
      kpi('最も低い', lo ? pct(lo) + '%' : '—', lo ? esc(lo.name) : '') + kpi('告知前', before.length, before.map(function (p) { return esc(p.name); }).join('・') || 'なし') + '</div>' +
    '<div class="card"><div class="ch">イベント別の参加率<span class="muted" style="font-weight:400;font-size:12px">部員 ' + S.club + ' 人中</span></div><div style="padding:4px 0">' + (rows || '<div class="empty">なし</div>') + '</div></div>';
}
function nodeModal(n) {
  var root = !parentOf(n), par = parentOf(n), leaf = !kids(n).length && !n.tasks;
  var memo = isFolder(n)
    ? '<div class="fld"><label for="wM">メモ</label><textarea id="wM" class="input" rows="4" ' + (editSelf(n) || n.who === S.me ? '' : ' disabled') + '>' + esc(n.memo || '') + '</textarea></div>'
    : '<div class="fld"><label>メモ</label><div class="muted" style="font-size:12px">ファイルを開くと書けます' + (n.memo ? '（' + esc(memoText(n.memo).slice(0, 40)) + '…）' : '') + '</div></div>'; // ファイルのメモはファイルのページで書く
  var body = (par ? '<div class="muted" style="font-size:12px">' + esc(ttl(rootOf(n))) + (par !== rootOf(n) ? ' ／ … ／ ' + esc(ttl(par)) : '') + '</div>' : '') +
    '<div class="fld"><label for="wT">名前</label><input id="wT" class="input" value="' + esc(ttl(n)) + '"' + (editSelf(n) ? '' : ' disabled') + '></div>' +
    (isFolder(n) ? '<div class="fld"><label>メンバー</label><div class="mfield">' + teamBtn(n, canAssign(n) ? '' : ' disabled') + '</div></div>' : '<div class="fld"><label for="wW">担当</label><select id="wW" class="input"' + (canAssign(n) ? '' : ' disabled') + '>' + whoOpts(n) + '</select></div>') +
    '<div class="two"><div class="fld"><label for="wS">開始</label><input id="wS" class="input num" type="date" value="' + n.start + '"' + (editSelf(n) ? '' : ' disabled') + '></div><div class="fld"><label for="wE">期限</label><input id="wE" class="input num" type="date" value="' + n.end + '"' + (editSelf(n) ? '' : ' disabled') + '></div></div>' +
    (editSelf(n) ? dslider(n, 'wS', 'wE') : '') +
    (root ? '<div class="two"><div class="fld"><label for="wU">担当部</label><select id="wU" class="input">' + ['教育部', '催事部', '外務部', '会計', '代表'].map(function (u) { return '<option' + (n.unit === u ? ' selected' : '') + '>' + u + '</option>'; }).join('') + '</select></div>' +
      '<div class="fld"><label for="wA">告知</label><select id="wA" class="input"><option value="">—（業務）</option><option value="before"' + (isEvent(n) && n.announce !== 'done' ? ' selected' : '') + '>告知前</option><option value="done"' + (isEvent(n) && n.announce === 'done' ? ' selected' : '') + '>告知済み</option></select></div></div>' : '') +
    memo +
    (leaf ? '<label style="display:flex;align-items:center;gap:8px"><input id="wD" type="checkbox" class="check"' + (n.done ? ' checked' : '') + '>完了</label>' : '<div class="muted" style="font-size:12px">下に ' + (nodesOf(n).length - 1) + ' 件の業務</div>');
  return dlg(root ? 'イベント' : isFolder(n) ? 'フォルダー' : 'ファイル', body,
    (manages(par) ? '<button class="btn ghost danger" data-act="wDel">' + (M.del ? '下の業務ごと削除' : '削除') + '</button>' : '') +
    (!isFolder(n) && (editSelf(n) || n.who === S.me) ? '<button class="btn ghost" data-act="toFolder" data-id="' + n.id + '">' + FOLD + 'フォルダーに変える</button>' : '') + '<span class="sp"></span>' +
    (canEdit(n) ? '<button class="btn" data-act="addc" data-id="' + n.id + '">' + ic('plus') + '下に追加</button>' : '') + (editSelf(n) || canAssign(n) || n.who === S.me ? '<button class="btn primary" data-act="wSave">保存</button>' : ''));
}
function addModal(par) {
  var s0 = par ? isoOf(Math.max(TODAY, dayOf(par.start))) : '', e0 = par ? par.end : '';
  if (par && s0 > e0) s0 = par.start;
  return dlg(par ? '<span style="display:flex;flex-direction:column;line-height:1.3">業務を追加<span class="muted" style="font-size:12px;font-weight:400">' + esc(ttl(par)) + ' の下</span></span>' : 'イベントを追加',
    '<div class="fld"><label for="wT">名前</label><input id="wT" class="input"></div>' +
    '<div class="two"><div class="fld"><label for="wS">開始</label><input id="wS" class="input num" type="date" value="' + s0 + '"></div><div class="fld"><label for="wE">期限</label><input id="wE" class="input num" type="date" value="' + e0 + '"></div></div>' +
    (par ? '' : '<div class="two"><div class="fld"><label for="wU">担当部</label><select id="wU" class="input">' + ['教育部', '催事部', '外務部', '会計', '代表'].map(function (u) { return '<option>' + u + '</option>'; }).join('') + '</select></div>' +
      '<div class="fld"><label for="wA">告知</label><select id="wA" class="input"><option value="before">告知前</option><option value="done">告知済み</option><option value="">—（業務）</option></select></div></div>'),
    '<button class="btn" data-act="close">閉じる</button>' + (par ? '<button class="btn" data-act="wAdd" data-more="1">続けて追加</button>' : '') + '<button class="btn primary" data-act="wAdd">追加</button>');
}
function assignModal() {
  var list = rowsOf(true).filter(function (r) { return !isDone(r.n) && canAssign(r.n); });
  var opt = function (sel) { return '<option value="">未定</option>' + S.members.map(function (m) { return '<option value="' + m.id + '"' + (sel === m.id ? ' selected' : '') + '>' + esc(m.name) + '</option>'; }).join(''); };
  return dlg('担当を割り当て', (list.length ? list.map(function (r) {
      return '<div class="mrow" style="padding-left:' + (r.d * 16) + 'px"><div class="nm"><span style="font-size:13px;color:var(--text);font-weight:' + (r.d === 0 ? 600 : 500) + '">' + esc(ttl(r.n)) + '</span><span class="num">' + fmtDate(r.n.start) + ' – ' + fmtDate(r.n.end) + '</span></div><select class="input" data-assign="' + r.n.id + '" style="width:140px;flex:none">' + opt(r.n.who) + '</select></div>';
    }).join('') : '<div class="empty">割り当てられる業務はありません</div>'),
    '<button class="btn" data-act="close">キャンセル</button><button class="btn primary" data-act="aSave">保存</button>', true);
}
function expandTo(id) { reindex(); if (!S.fold) S.fold = {}; var x = IX[id]; while (x) { S.fold[x.n.id] = false; x = x.par ? IX[x.par.id] : null; } }
function reportUp(k) {
  var par = parentOf(k), w = member(k.who), to = par && par.who && par.who !== k.who ? [par.who] : S.members.filter(function (x) { return x.perms.indexOf('all') >= 0 && x.id !== k.who; }).map(function (x) { return x.id; });
  to.forEach(function (id) { window.notify(id, (w ? w.name + 'さんが' : '') + '「' + ttl(k) + '」を完了しました', ttl(rootOf(k))); });
  if (par && par.who && isDone(par)) window.notify(par.who, '「' + ttl(par) + '」の下の業務がすべて完了しました', ttl(rootOf(par)));
}

function val(id) { var e = document.getElementById(id); return e ? e.value.trim() : ''; }
function av(id, cls) { var m = member(id); return '<span class="av' + (cls ? ' ' + cls : '') + '" title="' + esc(m ? m.name : '') + '">' + esc(m ? initials(m.name) : '?') + '</span>'; }
var ICON = {
  tracks: '<path d="M4 5.5A1.5 1.5 0 0 1 5.5 4H19v14H5.5A1.5 1.5 0 0 0 4 19.5z"/><path d="M4 19.5A1.5 1.5 0 0 0 5.5 21H19v-3"/>',
  notices: '<path d="M4 10v4h3l6 4V6L7 10z"/><path d="M17 9a4 4 0 0 1 0 6"/>',
  board: '<path d="M5 5h14v10H9l-4 4z"/>',
  projects: '<path d="M4 6h9M7 12h11M5 18h7"/>',
  dash: '<rect x="4" y="4" width="7" height="7" rx="1"/><rect x="13" y="4" width="7" height="4" rx="1"/><rect x="13" y="10" width="7" height="10" rx="1"/><rect x="4" y="13" width="7" height="7" rx="1"/>',
  perms: '<circle cx="9" cy="8" r="3"/><path d="M3 19c.8-3 3-4.5 6-4.5s5.2 1.5 6 4.5"/><path d="M16 5.5a3 3 0 0 1 0 5M18 14.5c1.5.6 2.5 2 3 4.5"/>',
  plus: '<path d="M12 5v14M5 12h14"/>', back: '<path d="M15 6l-6 6 6 6"/>', more: '<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>', users: '<circle cx="9" cy="8" r="3"/><path d="M3 19c.8-3 3-4.5 6-4.5s5.2 1.5 6 4.5"/><path d="M16 5.5a3 3 0 0 1 0 5M18 14.5c1.5.6 2.5 2 3 4.5"/>',
  chev: '<path d="M8 10l4 4 4-4"/>', bell: '<path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z"/><path d="M10 20.5a2 2 0 0 0 4 0"/>', ext: '<path d="M14 5h5v5M19 5l-8 8M17 14v5H5V7h5"/>'
};
function ic(n) { return '<svg class="i" viewBox="0 0 24 24" aria-hidden="true">' + ICON[n] + '</svg>'; }
function top(title, right, lead) { return '<div class="top">' + (lead || '') + '<h1>' + title + '</h1><span class="sp"></span>' + (right || '') + '</div>'; }
function utabs(key, list) { return '<div class="utabs">' + list.map(function (t) { return '<button data-act="utab" data-k="' + key + '" data-v="' + t[0] + '" aria-pressed="' + (S[key] === t[0]) + '">' + t[1] + (t[2] != null ? '<span class="n num">' + t[2] + '</span>' : '') + '</button>'; }).join('') + '</div>'; }

// ---------------- chrome ----------------
var UI = { acct: false, pmenu: false };
function counts() {
  return {
    notices: S.offers.filter(function (o) { return o.state === 'wait'; }).length,
    board: S.posts.filter(function (p) { return p.reports > 0 && p.state === 'ok'; }).length + (S.inqs || []).filter(function (q) { return q.status !== 'done'; }).length,
    projects: S.projects.reduce(function (n, p) { return n + leavesOf(p).filter(function (k) { return late(k) && (isAdmin() || chainHas(k, S.me)); }).length; }, 0),
    dash: myTasks(S.me).filter(function (o) { return !isDone(o.k); }).length
  };
}
function navItems() { var l = TABS.filter(function (t) { return can(t.id); }).slice(); if (l.length) l.unshift({ id: 'dash', name: 'ダッシュボード' }); if (isAdmin()) l.push({ id: 'perms', name: 'メンバー' }); return l; }
var BADGE = { dash: '自分の未完了の作業', notices: '部員からの情報（未確認）', board: '通報された投稿', projects: '期限切れの作業' };
function renderChrome() {
  var m = me(), c = counts();
  document.getElementById('nav').innerHTML = navItems().map(function (v) {
    var SH = { dash: 'ホーム', tracks: '教材', notices: '告知', board: 'サポート', projects: '業務', perms: 'メンバー' };
    return '<button data-act="go" data-view="' + v.id + '"' + (S.view === v.id ? ' aria-current="page"' : '') + '>' + ic(v.id) + '<span class="full">' + v.name + '</span><span class="short">' + (SH[v.id] || v.name) + '</span>' + (c[v.id] ? '<span class="n" title="' + (BADGE[v.id] || '') + ' ' + c[v.id] + '件">' + c[v.id] + '</span>' : '') + '</button>';
  }).join('');
  document.getElementById('acct').innerHTML = '<div class="mode"><span>運営</span><button class="msw on" data-to="./" role="switch" aria-checked="true" aria-label="部員画面に切り替える"><i></i></button></div>' + '<button data-act="acct" aria-haspopup="true" aria-expanded="' + UI.acct + '">' + av(m.id, 'lg') + '<span class="who"><b>' + esc(m.name) + '</b><span>' + esc(m.unit === '—' ? '部員' : m.unit) + '</span></span>' + ic('chev') + '</button>' +
    (UI.acct ? '<div class="menu" role="menu"><div class="msm">' + (isAdmin() ? '<button role="menuitem" data-act="go" data-view="perms">' + ic('perms') + '<span>メンバー</span></button>' : '') + '<button role="menuitem" data-act="nset">' + ic('bell') + '<span>通知の設定</span></button></div><div class="mh">アカウントを切り替え（モック）</div>' + S.members.map(function (x) {
      return '<button role="menuitem" data-act="switch" data-id="' + x.id + '">' + av(x.id) + '<span>' + esc(x.name) + '</span><span class="r">' + permLabel(x) + '</span></button>'; }).join('') + '<div class="msep"></div><button role="menuitem" class="mdanger" data-act="resetAsk"><span>サンプルデータに戻す…</span></button></div>' : '');
}

// ---------------- 教材 ----------------

// ---------------- 外部告知 ----------------
var NTYPES = ['インターン', '説明会', 'ビジコン', '支援制度', 'その他'];

// ---------------- 掲示板 ----------------

// ---------------- プロジェクト ----------------
window.notify = function (to, text, sub) { if (!S.notifs) S.notifs = []; S.notifs.unshift({ to: to, text: text, sub: sub, at: nowLabel() }); };

// ---------------- メンバーと権限 ----------------
function isOps(m) { return m.unit && m.unit !== '—'; }
function joined(id) { return S.projects.filter(function (p) { return involved(p, id) && !ended(p); }); }
function affil(m) { return isOps(m) ? '<span class="tag">' + esc(m.unit) + '</span>' : (m.roles || []).map(function (r) { return '<span class="tag">' + esc(r) + '</span>'; }).join(' ') || '<span class="dim">—</span>'; }
var POSTS = [
  ['代表', ['all']], ['教育部', ['tracks', 'projects']], ['外務部 渉外局', ['notices', 'projects']], ['外務部 広報局', ['notices', 'board', 'projects']],
  ['催事部', ['projects']], ['会計', ['projects']], ['—', []]
];
function postLabel(u) { return u === '—' ? 'プレイヤー' : u; }
function permText(perms) { return perms.indexOf('all') >= 0 ? 'すべて' : perms.length ? TABS.filter(function (t) { return perms.indexOf(t.id) >= 0; }).map(function (t) { return t.name; }).join('・') : 'なし'; }
function memberModal(m) {
  var js = joined(m.id), self = m.id === me().id;
  return dlg(av(m.id, 'lg') + '<span style="display:flex;flex-direction:column;line-height:1.3">' + esc(m.name) + '<span class="muted" style="font-size:12px;font-weight:400">' + esc(m.grade) + '</span></span>',
    '<div class="fld"><label for="mPost">役職</label><select id="mPost" class="input" data-act="post" data-m="' + m.id + '"' + (self ? ' disabled' : '') + '>' +
      POSTS.map(function (x) { return '<option value="' + esc(x[0]) + '"' + (x[0] === m.unit ? ' selected' : '') + '>' + esc(postLabel(x[0])) + '</option>'; }).join('') + '</select>' +
      '<span class="muted" style="font-size:12px">運営画面：' + permText(m.perms) + '</span></div>' +
    (isOps(m) ? '' : '<div class="fld"><label>ロール</label><div>' + affil(m) + '</div></div>') +
    '<div class="fld"><label>参加中</label><div>' + (js.length ? js.map(function (p) { return '<div class="mrow" style="padding:6px 0"><span class="nm">' + esc(p.name) + '</span><span class="muted num" style="font-size:12px">' + fmtDate(p.start) + ' – ' + fmtDate(p.end) + '</span></div>'; }).join('') : '<span class="dim">なし</span>') + '</div></div>');
}

// ---------------- modals ----------------
var M = null; // { m: 'task'|'add'|'members'|'proj'|'projEdit'|'notice', id, who }
function dlg(title, body, foot, wide) {
  return '<div class="ov" data-act="close"><div class="dlg" role="dialog" aria-modal="true" aria-label="' + esc(title) + '"' + (wide ? ' style="max-width:520px"' : '') + '>' +
    '<div class="h">' + title + '<span class="sp"></span><button class="ib" data-act="close" aria-label="閉じる">' + ic('x') + '</button></div>' +
    '<div class="c">' + body + '</div>' + (foot ? '<div class="f">' + foot + '</div>' : '') + '</div></div>';
}
function renderModal() {
  var el = document.getElementById('modal'), f;
  if (!M) { el.innerHTML = ''; return; }
  if (M.m === 'pub') { el.innerHTML = evPubDlg(); f = el.querySelector('.btn.primary, .btn.danger'); if (f) f.focus(); return; }
  if (M.m === 'evpick') { el.innerHTML = evPickDlg(); f = el.querySelector('.evpk'); if (f) f.focus(); return; }
  if (M.m === 'cal') { el.innerHTML = calDlg(); f = document.getElementById('cT'); if (f && !f.disabled && !M.id) f.focus(); return; }
  if (M.m === 'patch') { el.innerHTML = patchDlg(); f = document.getElementById('pT'); if (f && !M.id) f.focus(); return; }
  if (M.m === 'notice') { el.innerHTML = noticeDlg(); f = document.getElementById('nT'); if (f && !M.id) f.focus(); return; }
  var h = '';
  if (M.m === 'add') h = addModal(M.pid ? task(M.pid) : null);
  if (M.m === 'edit') h = nodeModal(task(M.id));
  if (M.m === 'assign') h = assignModal();
  if (M.m === 'member') h = memberModal(member(M.id));
  el.innerHTML = h;
  f = el.querySelector('.c input:not([type=checkbox]), .c select'); if (f && M.m === 'add') f.focus();
}

// ---------------- render ----------------
// 画面を描く。描く前の後片付け → 本体 → 描いたあとの飾りつけ（並び順に意味がある）
function render() {
  var d = docEl(); if (d && document.activeElement === d) { UI.pendRender = true; return; } // 書いている最中のメモは作り直さない
  closePop();
  if (S.view !== 'tracks' && S.view !== 'projects') document.body.classList.remove('recon');
  renderMain();
  autosizeAll();
  decorateWork(); if (UI.vp) { if (S.view === 'projects' && S.wtab !== 'stats') openVPanel(); else closeVPanel(); }
  placeFab();
  decorateWork2(); drawRec();
  if (S.view === 'projects' && !UI.rec) document.body.classList.remove('recon');
  decorateFolders();
  decorateDone();
  applyChrome12(); decorateGantt();
  if (UI.clip && UI.clip.mode === 'cut') { var el = document.querySelector('.fcard[data-id="' + UI.clip.id + '"], .gr[data-row="' + UI.clip.id + '"]'); if (el) el.classList.add('cut'); }
  kbDecorate();
  decorateBars39();
  p2Frame();
  fwSwap();
  var gs0 = document.getElementById('gs'); // ガントの幅が変わったら測り直して描き直す
  if (gs0 && gs0.clientWidth && Math.abs((UI.gw || 0) - gs0.clientWidth) > 2 && !render._gw) { UI.gw = gs0.clientWidth; render._gw = true; try { render(); } finally { render._gw = false; } }
  if (!drag) Array.prototype.forEach.call(document.querySelectorAll('.dguide'), function (g) { g.remove(); });
  if (S.view === 'perms' && lvNodes().length) Array.prototype.forEach.call(document.querySelectorAll('.mname[data-id] .cell2 > span:first-child'), function (sp) { var id = sp.closest('.mname').dataset.id; if (!sp.querySelector('.mlv')) sp.insertAdjacentHTML('beforeend', '<span class="mlv num">Lv' + lvOf(id) + '</span>'); });
}
function renderMain() {
  if (S.projects && S.projects.length) evMigrate();
  var items = navItems().map(function (t) { return t.id; });
  if (items.indexOf(S.view) < 0 && S.view !== 'nset') S.view = items[0] || 'none'; // 通知の設定はだれでも開ける
  renderChrome();
  var v = document.getElementById('view');
  if (S.view === 'none') { v.innerHTML = top('SLOPE') + '<div class="locked">このアカウントには運営画面の権限がありません</div>'; renderModal(); return; }
  v.innerHTML = ({ dash: viewDash, tracks: viewTracks, notices: viewNotices, board: viewBoard, projects: viewWork, perms: viewPerms, nset: viewNset }[S.view] || viewDash)();
  if (S.view === 'projects' && S.wtab === 'gantt') {
    var gs = document.getElementById('gs'), now = document.querySelector('.gnow');
    if (UI.sp === 'g') { gs.scrollLeft = UI.sl; gs.scrollTop = UI.st; }
    else { UI.sp = 'g'; UI.sl = now ? Math.max(0, parseFloat(now.style.left) - (window.innerWidth < 760 ? 60 : 240)) : 0; UI.st = 0; gs.scrollLeft = UI.sl; }
    gs.addEventListener('scroll', function () { UI.sl = gs.scrollLeft; UI.st = gs.scrollTop; });
  } else UI.sp = null;
  renderModal();
}
function touch(t) { t.updated = nowLabel() + '　' + me().name; }


