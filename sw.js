const VERSION = 'lush-logistics-pwa-test-v2';

const DESKTOP_SIDEBAR_PATCH = `
<script id="desktop-sidebar-refresh-fix">
(function () {
  function syncDesktopSidebarStyle() {
    var legacyTopnav = document.getElementById('v70-dark-topnav');
    if (!legacyTopnav) return;
    legacyTopnav.disabled = window.matchMedia('(min-width: 901px)').matches;
  }

  syncDesktopSidebarStyle();
  window.addEventListener('resize', syncDesktopSidebarStyle, { passive: true });
})();
<\/script>
`;

self.addEventListener('install', event => {
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(self.clients.claim());
});

async function fetchWithSidebarFix(request) {
  const response = await fetch(request);

  if (request.mode !== 'navigate') return response;

  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('text/html')) return response;

  let html = await response.text();

  if (!html.includes('desktop-sidebar-refresh-fix')) {
    html = html.replace('</body>', DESKTOP_SIDEBAR_PATCH + '\n</body>');
  }

  const headers = new Headers(response.headers);
  headers.delete('content-length');
  headers.set('cache-control', 'no-store');

  return new Response(html, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  event.respondWith(
    fetchWithSidebarFix(event.request).catch(() => new Response(
      '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>LUSH Logistics</title><body style="font-family:system-ui;padding:32px"><h2>LUSH Logistics</h2><p>네트워크 연결을 확인해주세요.</p></body>',
      {headers:{'Content-Type':'text/html; charset=utf-8'}}
    ))
  );
});
