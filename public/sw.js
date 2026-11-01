// Clipmint's service worker has one job: receive files shared to the installed app from
// another app (Web Share Target, see app/manifest.ts). The browser POSTs them here; they're
// kept in this browser's Cache Storage just long enough for the page to open them, then the
// page deletes them. It caches nothing else and leaves every other request alone.
const SHARE_CACHE = "clipmint-share";

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "POST" || url.origin !== self.location.origin || url.pathname !== "/share-target") return;
  e.respondWith((async () => {
    try {
      const form = await e.request.formData();
      const files = form.getAll("media").filter((f) => typeof f === "object" && f.size > 0);
      await caches.delete(SHARE_CACHE);
      const cache = await caches.open(SHARE_CACHE);
      await Promise.all(files.map((f, i) => cache.put(`/shared/${i}`, new Response(f, {
        headers: { "content-type": f.type || "application/octet-stream", "x-name": encodeURIComponent(f.name || `shared-${i}`) },
      }))));
    } catch { /* nothing usable was shared: the desk opens empty */ }
    return Response.redirect("/?shared=1", 303);
  })());
});
