// Service worker: makes the game installable and playable offline.
// The build (see vite.config.ts) stamps a build id and the list of built files below,
// so each deployment installs a fresh cache and drops the previous one.
const BUILD_ID = "__BUILD_ID__";
const BUILT_FILES = JSON.parse('__BUILT_FILES__');
const CACHE = `forno-lento-${BUILD_ID}`;
const FONT_CACHE = "forno-lento-fonts";
const PRECACHE = ["./", "manifest.webmanifest", "icon.svg", "icon-192.png", "apple-touch-icon.png", ...BUILT_FILES];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE && key !== FONT_CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

const isFont = (url) => url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com";

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

  // Fonts never change: the cache first.
  if (isFont(url)) {
    event.respondWith(
      caches.open(FONT_CACHE).then((cache) =>
        cache.match(request).then(
          (cached) =>
            cached ||
            fetch(request).then((response) => {
              void cache.put(request, response.clone());
              return response;
            }),
        ),
      ),
    );
    return;
  }

  // Built files have a hash in their name: the cache first, the network as a fallback.
  if (url.origin === self.location.origin) {
    event.respondWith(caches.match(request).then((cached) => cached || fetch(request)));
  }
});
