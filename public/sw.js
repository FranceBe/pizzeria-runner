// Service worker: makes the game installable and playable offline.
// The build (see vite.config.ts) stamps a build id and the list of built files below,
// so each deployment installs a fresh cache and drops the previous one (and the Google Fonts cache of older versions:
// the fonts now ship with the game, cached with its other files).
const BUILD_ID = "__BUILD_ID__";
const BUILT_FILES = JSON.parse('__BUILT_FILES__');
const CACHE = `forno-lento-${BUILD_ID}`;
const PRECACHE = ["./", "manifest.webmanifest", "icon.svg", "icon-192.png", "apple-touch-icon.png", ...BUILT_FILES];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);

  // The page itself: the network first, so a new version shows up as soon as it is online.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          void caches.open(CACHE).then((cache) => cache.put("./", copy));
          return response;
        })
        .catch(() => caches.match("./")),
    );
    return;
  }

  // Built files have a hash in their name: the cache first, the network as a fallback. Files loaded on demand
  // (the sounds, the fonts) are kept as they come, so they work offline too without weighing on the first visit.
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((response) => {
            if (response.ok && url.pathname.includes("/assets/")) {
              const copy = response.clone();
              void caches.open(CACHE).then((cache) => cache.put(request, copy));
            }
            return response;
          }),
      ),
    );
  }
});
