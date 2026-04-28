// always fetch fresh, no caching
self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (e) => {
    // delete all old caches
    e.waitUntil(
        caches.keys().then(keys =>
            Promise.all(keys.map(key => caches.delete(key)))
        ).then(() => self.clients.claim())
    );
});

self.addEventListener("fetch", (e) => {
    // always go to network, never cache
    e.respondWith(fetch(e.request));
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
