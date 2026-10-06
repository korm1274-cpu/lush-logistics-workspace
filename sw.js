const VERSION = 'lush-logistics-pwa-test-v5';

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
