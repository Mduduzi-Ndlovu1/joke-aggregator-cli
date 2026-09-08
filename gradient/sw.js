// Gradient — service worker
// Rule (see SPEC.md "Constraints"): tiles and elevation cache permanently
// (terrain height doesn't change). Routing and geocoding responses must
// NEVER be cached — a cached route can hide a closed road.

// Bump this whenever app-shell files (index.html, this file) change, so
// clients running an old service worker pick up the new version instead of
// silently serving stale JS from cache-first.
const STATIC_CACHE = 'gradient-static-v12';
const TERRAIN_CACHE = 'gradient-terrain-v1';

const STATIC_ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
  'https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700&display=swap'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k !== STATIC_CACHE && k !== TERRAIN_CACHE)
          .map((k) => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

function isNeverCache(url) {
  // Routing and geocoding — always go to network, never served from cache.
  return (
    url.hostname.includes('nominatim.openstreetmap.org') ||
    url.hostname.includes('routing.openstreetmap.de') ||
    url.hostname.includes('router.project-osrm.org') ||
    url.hostname.includes('photon.komoot.io')
  );
}

function isTerrain(url) {
  // Map tiles and elevation — safe to cache forever.
  return (
    url.hostname.includes('tile.openstreetmap.org') ||
    url.hostname.includes('api.open-meteo.com')
  );
}

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  if (event.request.method !== 'GET') return;

  if (isNeverCache(url)) {
    event.respondWith(fetch(event.request));
    return;
  }

  if (isTerrain(url)) {
    event.respondWith(
      caches.open(TERRAIN_CACHE).then(async (cache) => {
        const cached = await cache.match(event.request);
        if (cached) return cached;
        const resp = await fetch(event.request);
        if (resp.ok) cache.put(event.request, resp.clone());
        return resp;
      })
    );
    return;
  }

  // App shell: network-first so edits during development (and future
  // deploys) show up immediately, falling back to cache only when offline.
  // (Cache-first here previously served a stale index.html after a code
  // change — the browser never re-fetched it while a service worker with
  // an unchanged cache name was still active.)
  event.respondWith(
    fetch(event.request)
      .then((resp) => {
        const copy = resp.clone();
        caches.open(STATIC_CACHE).then((cache) => cache.put(event.request, copy));
        return resp;
      })
      .catch(() => caches.match(event.request))
  );
});
