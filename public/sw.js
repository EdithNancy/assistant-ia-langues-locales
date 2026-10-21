/*
 * Service worker IvoirAI : garde l'interface disponible sur réseau faible ou coupé.
 * - Fichiers du build (/assets/*, noms avec empreinte) : cache d'abord.
 * - Polices Google : cache d'abord (elles ne changent pas).
 * - Pages : réseau d'abord, puis la dernière version en cache hors connexion.
 * Les appels à l'API (autre domaine) ne sont jamais mis en cache.
 */
const CACHE = 'ivoirai-v1';
const FONT_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.add('/')));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

const cacheFirst = async (request) => {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok || response.type === 'opaque') {
    const cache = await caches.open(CACHE);
    cache.put(request, response.clone());
  }
  return response;
};

const networkFirstPage = async (request) => {
  try {
    const response = await fetch(request);
    const cache = await caches.open(CACHE);
    cache.put('/', response.clone());
    return response;
  } catch {
    return (await caches.match('/')) ?? Response.error();
  }
};

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  if (request.mode === 'navigate' && url.origin === self.location.origin) {
    event.respondWith(networkFirstPage(request));
  } else if (
    (url.origin === self.location.origin && url.pathname.startsWith('/assets/')) ||
    FONT_HOSTS.includes(url.hostname)
  ) {
    event.respondWith(cacheFirst(request));
  }
});
