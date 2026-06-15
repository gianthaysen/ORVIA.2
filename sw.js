const C = 'orvia-v8-33';
const ASSETS = ['./','./index.html','./styles.css','./manifest.webmanifest',
  './assets/icons/icon-192.png','./assets/icons/icon-512.png','./assets/icons/apple-touch-icon.png',
  './assets/icons/maskable-icon-512.png','./assets/brand/orvia-symbol-only.svg','./assets/brand/orvia-favicon.svg',
  './assets/og/orvia-og-image.png',
  './js/config.js','./js/supplements.js','./js/calc.js','./js/data.js','./js/profile.js','./js/issues.js','./js/intelligence.js','./js/orvia-pro.js','./js/charts.js','./js/ui.js','./js/activity.js','./js/nutrition.js','./js/insights.js','./js/race.js','./js/strava-real-data.js','./js/story.js','./js/sync.js','./js/auth.js'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(C).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== C).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request, { ignoreSearch: true }).then(r =>
      r || fetch(e.request).then(res => {
        if (res.ok || res.type === 'opaque') { const cp = res.clone(); caches.open(C).then(c => c.put(e.request, cp)); }
        return res;
      }).catch(() => e.request.mode === 'navigate' ? caches.match('./index.html') : Response.error())
    )
  );
});
