const CACHE = "guitar-tuner-v47";
const FILES = [
  "./accordatore.html",
  "./manifest.json",
  "./js/app.js",
  "./js/shared.js",
  "./js/tuner.js",
  "./js/looper.js",
  "./js/metronome.js",
  "./js/chord.js",
  "./js/pipe.js",
  "./js/wakelock.js",
  "./js/scale.js",
];

self.addEventListener("install", e => {
  e.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(FILES))
  );
  self.skipWaiting();
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", e => {
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request))
  );
});
