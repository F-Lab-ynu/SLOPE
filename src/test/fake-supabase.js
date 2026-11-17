// テスト用：supabase-js の最小限の偽物（メモリ上のテーブル）
(function () {
  var DB = window.__DB = JSON.parse(localStorage.getItem('__fakedb') || 'null') || { profiles: [], nodes: [], notifications: [] }; ['items', 'reactions', 'reports'].forEach(function (k) { if (!DB[k]) DB[k] = []; });
  var ME = localStorage.getItem('__fakeme');
  window.__LOG = [];
  function persist() { localStorage.setItem('__fakedb', JSON.stringify(DB)); }
  function Q(table) { this.t = table; this.f = []; this.op = 'select'; this.payload = null; this.ret = false; this.one = false; this.ord = null; this.lim = null; }
  Q.prototype.select = function () { if (this.op === 'select') this.op = 'select'; else this.ret = true; return this; };
  Q.prototype.order = function (k, o) { this.ord = [k, !o || o.ascending !== false]; return this; };
  Q.prototype.limit = function (n) { this.lim = n; return this; };
  Q.prototype.eq = function (k, v) { this.f.push(function (r) { return r[k] === v; }); return this; };
  Q.prototype.in = function (k, vs) { this.f.push(function (r) { return vs.indexOf(r[k]) >= 0; }); return this; };
  Q.prototype.single = function () { this.one = true; return this; };
  Q.prototype.insert = function (p) { this.op = 'insert'; this.payload = Array.isArray(p) ? p : [p]; return this; };
  Q.prototype.update = function (p) { this.op = 'update'; this.payload = p; return this; };
  Q.prototype.delete = function () { this.op = 'delete'; return this; };
  Q.prototype.then = function (res, rej) {
    var self = this, rows = DB[this.t] || (DB[this.t] = []), m = function (r) { return self.f.every(function (fn) { return fn(r); }); }, out;
    window.__LOG.push([this.op, this.t, JSON.stringify(this.payload)]);
    if (window.__FAIL && window.__FAIL(this)) { out = { data: null, error: { message: 'new row violates row-level security policy' } }; }
    else if (this.op === 'select') { var d = rows.filter(m); if (this.ord) { var k = this.ord[0], a = this.ord[1]; d.sort(function (x, y) { return (x[k] > y[k] ? 1 : -1) * (a ? 1 : -1); }); } if (this.lim) d = d.slice(0, this.lim); out = { data: this.one ? d[0] : JSON.parse(JSON.stringify(d)), error: null }; }
    else if (this.op === 'insert') { var made = []; this.payload.forEach(function (p) { var r = JSON.parse(JSON.stringify(p)); if (!r.id && self.t !== 'reactions') r.id = 'x' + Date.now().toString(36) + Math.floor(Math.random() * 1e6).toString(36); if (!r.created_at) r.created_at = new Date().toISOString(); if (self.t === 'items') { r.state = r.state || 'ok'; r.pos = r.pos || 0; if (!r.author) r.author = ME; } if (self.t === 'reactions' && !r.user_id) r.user_id = ME; rows.push(r); made.push(r); }); out = { data: this.ret ? (this.one ? made[0] : made) : null, error: null }; }
    else if (this.op === 'update') { var hit = rows.filter(m); hit.forEach(function (r) { Object.assign(r, JSON.parse(JSON.stringify(self.payload))); }); out = { data: hit.map(function (r) { return { id: r.id }; }), error: null }; }
    else if (this.op === 'delete') { var hit2 = rows.filter(m); DB[this.t] = rows.filter(function (r) { return !m(r); }); if (this.t === 'nodes') { var gone = hit2.map(function (r) { return r.id; }), ch = true; while (ch) { ch = false; DB.nodes = DB.nodes.filter(function (r) { if (r.parent_id && gone.indexOf(r.parent_id) >= 0) { gone.push(r.id); ch = true; return false; } return true; }); } } out = { data: hit2.map(function (r) { return { id: r.id }; }), error: null }; }
    persist();
    return Promise.resolve(out).then(res, rej);
  };
  window.supabase = { createClient: function () {
    return {
      auth: {
        getSession: function () { return Promise.resolve({ data: { session: ME ? { user: { id: ME } } : null } }); },
        onAuthStateChange: function () {}, signOut: function () { localStorage.removeItem('__fakeme'); return Promise.resolve({}); },
        signInWithOAuth: function () { window.__oauth = true; return Promise.resolve({}); }
      },
      from: function (t) { return new Q(t); },
      rpc: function (fn) { var db = JSON.parse(localStorage.getItem('__fakedb') || '{}'), v = db.visits || []; return Promise.resolve({ data: { days: [{ day: '2026-11-17', users: v.length ? 1 : 0, views: v.length }], dau: v.length ? 1 : 0, wau: 1, mau: 1, total: 3, tabs: v.map(function (x) { return { app: x.app, tab: x.tab, views: 1, users: 1 }; }) }, error: null }); },
      channel: function () { var c = { on: function (a, b, fn) { (window.__RT = window.__RT || []).push(fn); return c; }, subscribe: function () { return c; } }; return c; }
    };
  } };
})();
