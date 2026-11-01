// The solitaire's service worker (scope: solitaire/ only): it plays offline and installs on a phone's home screen.
// The build (vite.solitaire.config.ts) stamps a build id and the list of built files below. It never touches the
// game's own caches.
const BUILD_ID = "__BUILD_ID__";
const BUILT_FILES = JSON.parse('__BUILT_FILES__');
const PREFIX = "forno-lento-solitaire-";
const CACHE = `${PREFIX}${BUILD_ID}`;
const PRECACHE = ["./", "manifest.webmanifest", ...BUILT_FILES];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key.startsWith(PREFIX) && key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // The page: the network first (a new version shows up as soon as it is online), the cache offline.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            void caches.open(CACHE).then((cache) => cache.put("./", copy));
          }
          return response;
        })
        .catch(() => caches.match("./")),
    );
    return;
  }

  // Built files have a hash in their name: the cache first.
  event.respondWith(caches.match(request).then((cached) => cached || fetch(request)));
});
