const VERSION = 'lush-logistics-pwa-push-v8-current-icon';

self.addEventListener('install', event => {
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  event.respondWith(
    fetch(event.request).catch(() => new Response(
      '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>LUSH Logistics</title><body style="font-family:system-ui;padding:32px"><h2>LUSH Logistics</h2><p>네트워크 연결을 확인해주세요.</p></body>',
      {headers:{'Content-Type':'text/html; charset=utf-8'}}
    ))
  );
});

// 모바일 Push 알림: 서버(api/_lib/push.js)가 보낸 { title, body, url, tag } 를 잠금화면·알림센터에 표시
self.addEventListener('push', event => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch (e) { data = { body: event.data ? event.data.text() : '' }; }
  const title = data.title || 'LUSH Logistics';
  event.waitUntil(self.registration.showNotification(title, {
    body: data.body || '',
    icon: './app-icon-192.png?v=11',
    badge: './app-icon-192.png?v=11',
    tag: data.tag || undefined,
    data: { url: data.url || './' },
  }));
});

// 알림을 누르면 열려 있는 앱 화면으로, 없으면 새로 열기
self.addEventListener('notificationclick', event => {
  event.notification.close();
  const url = new URL((event.notification.data && event.notification.data.url) || './', self.registration.scope).href;
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
    for (const c of list) { if (c.url.startsWith(self.registration.scope) && 'focus' in c) return c.focus(); }
    return self.clients.openWindow ? self.clients.openWindow(url) : null;
  }));
});
