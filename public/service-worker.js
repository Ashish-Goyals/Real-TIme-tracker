const CACHE_NAME = "tracker-v1";
const ASSETS = ["/", "/js/script.js", "/css/style.css"];

self.addEventListener("install", (e) => {
    e.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS)));
    self.skipWaiting();
});

self.addEventListener("activate", (e) => {
    e.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (e) => {
    e.respondWith(fetch(e.request).catch(() => caches.match(e.request)));
});

async function syncLocation() {
    const clients = await self.clients.matchAll();
    clients.forEach(client => client.postMessage({ type: "request-location" }));
}

self.addEventListener("sync", (e) => {
    if (e.tag === "sync-location") e.waitUntil(syncLocation());
});

self.addEventListener("periodicsync", (e) => {
    if (e.tag === "location-sync") e.waitUntil(syncLocation());
});
