// Offline support. Network first (so a new version shows up right away), cached copy when offline.
// Bump CACHE when you want old caches thrown away.
const CACHE = 'platoon-v11';
const CORE = [
  './', 'index.html', 'app.js', 'manifest.webmanifest', 'styles/app.css', 'icons/icon.svg',
  'lib/fatal.js', 'lib/config.js', 'lib/drive.js', 'lib/sync.js', 'lib/syncui.js', 'lib/util.js', 'lib/store.js', 'lib/auth.js', 'lib/ui.js', 'lib/icons.js', 'lib/scheduler.js', 'lib/status.js', 'lib/demo.js', 'lib/hebdate.js', 'lib/checks.js', 'lib/whatsapp.js', 'lib/presence.js', 'lib/gearicons.js', 'views/presenceplan.js',
  'views/board.js', 'views/roster.js', 'views/calendar.js', 'views/soldiers.js', 'views/equipment.js', 'views/requests.js', 'views/settings.js', 'views/checks.js', 'views/daysheet.js', 'views/transfers.js',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;   // Google APIs etc. go straight to the network
  e.respondWith(
    fetch(req).then((res) => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
      return res;
    }).catch(() => caches.match(req).then((hit) => hit || caches.match('index.html')))
  );
});
