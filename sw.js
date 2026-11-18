// SLOPE：アプリとしてインストールできるようにするための最小のサービスワーカー（中身はキャッシュせず、いつも最新を取りに行く）
self.addEventListener('install', function () { self.skipWaiting(); });
self.addEventListener('activate', function (e) { e.waitUntil(self.clients.claim()); });
self.addEventListener('fetch', function (e) { if (e.request.method !== 'GET' || new URL(e.request.url).origin !== self.location.origin) return; // ほかのサイト（Supabase など）はそのまま e.respondWith(fetch(e.request).catch(function () { return new Response('オフラインです', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } }); })); });
