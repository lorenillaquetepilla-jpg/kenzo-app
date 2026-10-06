// Network first, falling back to the cached copy so the app opens without signal.
const CACHE = "kenzo-v9";
const SHELL = ["./", "index.html", "styles.css", "app.js", "backend-firebase.js", "backend-demo.js", "firebase-config.js",
  "manifest.webmanifest", "icons/mark.png", "icons/word.png", "icons/icon-192.png"];
self.addEventListener("install", e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener("activate", e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener("fetch", e => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET") return;
  // The Firebase library lives on gstatic under a versioned URL: keep a copy so the app also starts offline.
  if (url.hostname === "www.gstatic.com" && url.pathname.startsWith("/firebasejs/")) {
    e.respondWith(caches.match(e.request).then(hit => hit || fetch(e.request).then(r => { const copy = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); return r; })));
    return;
  }
  if (url.origin !== location.origin) return;
  e.respondWith(fetch(e.request).then(r => { const copy = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); return r; })
    .catch(() => caches.match(e.request).then(r => r || caches.match("index.html"))));
});
