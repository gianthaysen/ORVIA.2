const C = 'orvia-v8-154';
try { console.log('[ORVIA SW]', C); } catch (e) {}
const ASSETS = ['./','./index.html','./styles.css','./manifest.webmanifest',
  './assets/icons/icon-192.png','./assets/icons/icon-512.png','./assets/icons/apple-touch-icon.png',
  './assets/icons/maskable-icon-512.png','./assets/brand/orvia-symbol-only.svg','./assets/brand/orvia-favicon.svg',
  './assets/og/orvia-og-image.png',
  './js/config.js','./js/supplements.js','./js/calc.js','./js/data.js','./js/profile.js','./js/issues.js','./js/intelligence.js','./js/orvia-pro.js','./js/charts.js','./js/ui.js','./js/activity.js','./js/nutrition.js','./js/insights.js','./js/race.js','./js/story.js','./js/extras.js',
  './js/repos/repoBase.js','./js/repos/profileRepository.js','./js/repos/checkinRepository.js','./js/repos/trainingLoadRepository.js','./js/repos/readinessRepository.js','./js/repos/goalRepository.js','./js/repos/availabilityRepository.js','./js/repos/activityRepository.js','./js/training-domain.js','./js/activity-normalize.js','./js/activity-store.js','./js/activity-config.js','./js/activity-sync.js','./js/gym-volume.js','./js/repos/exerciseRepository.js','./js/repos/sportRepository.js','./js/repos/trainingPlanRepository.js','./js/repos/workoutRepository.js','./js/offline-queue.js','./js/profile-store.js','./js/checkin-store.js','./js/migrate-blob.js','./js/readiness-source.js','./js/readiness-store.js','./js/training-migration.js','./js/workout-store.js',
  './js/sync.js','./js/profile-model.js','./js/onboarding/onboarding-profile-logic.js','./js/onboarding/onboarding-sports-logic.js','./js/onboarding/onboarding-logic.js','./js/onboarding/onboarding-steps.js','./js/onboarding/onboarding-store.js','./js/onboarding/onboarding-ui.js','./js/auth-logic.js','./js/auth.js','./js/checkin-extra.js','./js/workout-ui.js'];

// Ausfalltolerantes Pre-Caching: EINE fehlende/umbenannte Datei darf NICHT das gesamte
// SW-Update blockieren (sonst bleibt der alte Worker aktiv und liefert die alte App aus).
// Nicht vorab gecachte Assets werden beim ersten Zugriff per fetch nachgeladen (cache-first unten).
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(C).then(c => Promise.all(ASSETS.map(a => c.add(a).catch(() => null)))).then(() => self.skipWaiting())
  );
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== C).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const req = e.request;
  const isNav = req.mode === 'navigate';
  const isEnv = req.url.indexOf('env.js') >= 0;

  // Navigation (index.html) + env.js: NETWORK-FIRST, damit der Auth-Guard und die
  // Konfiguration nach jedem Deploy sofort aktuell sind (nie eine alte Version ohne Guard).
  if (isNav || isEnv) {
    e.respondWith(
      fetch(req).then(res => {
        if (res && (res.ok || res.type === 'opaque')) {
          const cp = res.clone();
          caches.open(C).then(c => c.put(isNav ? './index.html' : req, cp));
        }
        return res;
      }).catch(() => caches.match(isNav ? './index.html' : req))
    );
    return;
  }

  // Übrige Assets (versioniert über C): cache-first.
  e.respondWith(
    caches.match(req, { ignoreSearch: true }).then(r =>
      r || fetch(req).then(res => {
        if (res.ok || res.type === 'opaque') { const cp = res.clone(); caches.open(C).then(c => c.put(req, cp)); }
        return res;
      }).catch(() => Response.error())
    )
  );
});
