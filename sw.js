// SLOPE のサービスワーカー：アプリとしてインストールできるようにする（中身はキャッシュせず、いつも最新を取りに行く）＋プッシュ通知
self.addEventListener('install', function () { self.skipWaiting(); });
self.addEventListener('activate', function (e) { e.waitUntil(self.clients.claim()); });
self.addEventListener('fetch', function (e) {
  // ほかのサイト（Supabase など）はそのまま通す
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== self.location.origin) return;
  e.respondWith(fetch(e.request).catch(function () { return new Response('オフラインです', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } }); }));
});
self.addEventListener('push', function (e) {
  var d = {}; try { d = e.data ? e.data.json() : {}; } catch (er) { d = { body: e.data ? e.data.text() : '' }; }
  e.waitUntil(self.registration.showNotification(d.title || 'SLOPE', { body: d.body || '', icon: 'icon-192.png', badge: 'icon-192.png', data: { url: d.url || './' } }));
});
self.addEventListener('notificationclick', function (e) {
  // 押したら、その通知の画面（付箋なら運営画面のその場所、DM ならその会話）を開く
  e.notification.close();
  var url = new URL((e.notification.data && e.notification.data.url) || './', self.registration.scope), href = url.href;
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (cs) {
    cs = cs.filter(function (c) { return c.url.indexOf(self.registration.scope) === 0; });
    var P = function (u) { return new URL(u).pathname.replace(/index\.html$/, ''); }, same = cs.filter(function (c) { return P(c.url) === P(href); })[0];
    if (same) { if (url.search) same.postMessage({ slopeGo: url.search }); return same.focus(); }
    if (cs[0] && 'navigate' in cs[0]) return cs[0].navigate(href).then(function (c) { return c && c.focus(); }).catch(function () { return self.clients.openWindow(href); });
    return self.clients.openWindow(href);
  }));
});
