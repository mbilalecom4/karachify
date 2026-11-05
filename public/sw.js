/*
 * Karachify's offline layer.
 *
 * This file is served from the root of the published site (`/karachify/sw.js`),
 * because a service worker's scope is the directory it is served from and no
 * wider — registered any deeper it would only cover the pages beneath it.
 *
 * What it stores, and what it refuses to:
 *
 *   pages        network first. The copy kept is the one served at that exact
 *                address, so an offline reload shows the same document with the
 *                same title and description a crawler was given. If nothing is
 *                stored for that address, the request is allowed to fail:
 *                replying with the homepage's HTML would paint the right app
 *                under a head that describes a different page.
 *   bundle       cache first. Vite names every file by its contents, so a URL
 *                that has been seen once cannot change underneath it.
 *   data         network first. The record files and the OpenStreetMap tier are
 *                the site's substance; a saved copy is worth having offline and
 *                worth labelling as saved.
 *   photographs  cache first, capped. A card image is a rendition of a file
 *                that does not change, and the cache is trimmed so a long
 *                browsing session cannot quietly eat the device's storage.
 *   live reads   never cached. Weather, prayer times and "open now" are
 *                answers about this minute; a number from this morning would be
 *                presented as if it were current, which is the one thing this
 *                site promises not to do. Those panels show their own
 *                unavailable state instead.
 *
 * Every cached answer also tells the page it was cached, and when the copy was
 * taken, so the notice in the header can say so out loud.
 */

const BUILD = 'karachify-v1';
const CACHES = {
  page: `${BUILD}-pages`,
  bundle: `${BUILD}-bundle`,
  data: `${BUILD}-data`,
  media: `${BUILD}-media`,
};
const LIMITS = { page: 60, bundle: 240, data: 80, media: 160 };

/** `/karachify/` — the directory this worker was served from, which is its scope. */
const SCOPE = self.location.pathname.replace(/[^/]*$/, '');

/** The two live reads stay off the cache entirely — see the note at the top. */
const LIVE_APIS = ['api.open-meteo.com', 'api.aladhan.com'];
/** Hosts whose files are worth keeping: the photographs and the map tiles. */
const CACHED_HOSTS = ['upload.wikimedia.org', 'thumb.wikimedia.org', 'tile.openstreetmap.org'];

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      // A deploy changes the build id, so every cache from an older one is
      // dropped rather than left to age behind a page that no longer exists.
      const keep = Object.values(CACHES);
      for (const key of await caches.keys()) if (!keep.includes(key)) await caches.delete(key);
      await self.clients.claim();
    })(),
  );
});

function tell(message) {
  self.clients.matchAll().then((list) => list.forEach((client) => client.postMessage(message)));
}

/*
 * The last few navigations this worker answered, and from where.
 *
 * A message posted while a document is still being replaced never reaches it,
 * so the page cannot be told it is looking at a saved copy — it has to ask.
 * This list is in memory only: it dies with the worker, and a page that gets no
 * answer says it is offline without claiming a time it does not have.
 */
const served = [];

function record(url, kind, from, at) {
  served.unshift({ url, kind, from, at });
  if (served.length > 24) served.length = 24;
}

self.addEventListener('message', (event) => {
  if (!event.data || event.data.type !== 'karachify:why') return;
  const url = event.source && 'url' in event.source ? event.source.url : null;
  const hit = url ? served.find((s) => s.url === url) : undefined;
  if (event.source) event.source.postMessage({ type: 'karachify:answer', url, from: hit ? hit.from : null, at: hit ? hit.at : null });
});

/**
 * Store a response, then trim the oldest entries past the limit.
 *
 * A photograph arrives as an opaque response — cross-origin, no readable
 * headers — and the Cache API accepts it as it is. Anything this site serves
 * itself is stamped with the moment it was filed, because the page has to be
 * able to say how old the copy it is showing really is.
 */
async function save(cacheName, request, response, limit) {
  if (!response || response.type === 'error') return;
  if (response.type !== 'opaque' && response.status !== 200) return;
  const cache = await caches.open(cacheName);
  await cache.put(request, response.type === 'opaque' ? response : await stamp(response));
  // A redirected navigation is filed under both addresses it is true at, so an
  // offline reload finds it whichever one the browser asks for.
  if (response.redirected && response.url && response.type === 'default') {
    await cache.put(new Request(response.url), await stamp(response));
  }
  const keys = await cache.keys();
  for (let i = 0; i < keys.length - limit; i += 1) await cache.delete(keys[i]);
}

/**
 * A copy of a same-origin response carrying the time it was cached. The body is
 * read from a clone, so the response on its way to the page is still intact.
 */
async function stamp(response) {
  const copy = response.clone();
  const headers = new Headers(response.headers);
  headers.set('x-karachify-saved-at', String(Date.now()));
  return new Response(await copy.arrayBuffer(), { status: response.status, statusText: response.statusText, headers });
}

async function networkFirst(request, cacheName, limit, kind) {
  const cached = await caches.match(request);
  try {
    const fresh = await fetch(request);
    await save(cacheName, request, fresh, limit);
    if (kind === 'page') record(request.url, kind, 'network', Date.now());
    return fresh;
  } catch (offline) {
    if (cached) {
      const at = Number(cached.headers.get('x-karachify-saved-at'));
      const savedAt = Number.isFinite(at) && at > 0 ? at : null;
      record(request.url, kind, 'cache', savedAt);
      tell({ type: 'karachify:saved-copy', kind, at: savedAt ?? undefined });
      return cached;
    }
    throw offline;
  }
}

async function cacheFirst(request, cacheName, limit) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const fresh = await fetch(request);
  await save(cacheName, request, fresh, limit);
  return fresh;
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  const sameOrigin = url.origin === self.location.origin;

  if (LIVE_APIS.includes(url.hostname)) return;

  if (request.mode === 'navigate') {
    // Only pages inside this scope are the app's business; anything else is a
    // link leaving the site.
    if (!sameOrigin || !url.pathname.startsWith(SCOPE)) return;
    event.respondWith(networkFirst(request, CACHES.page, LIMITS.page, 'page'));
    return;
  }

  if (sameOrigin) {
    if (url.pathname.startsWith(`${SCOPE}assets/`)) {
      event.respondWith(cacheFirst(request, CACHES.bundle, LIMITS.bundle));
      return;
    }
    if (url.pathname.startsWith(`${SCOPE}data/`) || url.pathname.endsWith('.json')) {
      event.respondWith(networkFirst(request, CACHES.data, LIMITS.data, 'data'));
      return;
    }
    return;
  }

  if (CACHED_HOSTS.includes(url.hostname)) {
    event.respondWith(cacheFirst(request, CACHES.media, LIMITS.media));
  }
});
