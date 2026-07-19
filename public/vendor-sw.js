/**
 * Service worker for the vendor control panel.
 *
 * Scoped to /vendor/ — registered with an explicit scope and served with a
 * Service-Worker-Allowed header, because the file sits at the root but must
 * only ever control vendor routes. The buyer site stays an ordinary website
 * with no worker, no install prompt and nothing cached.
 *
 * Two jobs: keep the shell usable on a bad connection, and receive pushes.
 */

const CACHE = "patch-vendor-v1";
const SHELL = ["/vendor/dashboard", "/icons/vendor-192.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

/**
 * Network-first for navigations. A vendor dashboard showing a stale lead list
 * is worse than a spinner — cache is the fallback for being offline, not the
 * default source.
 */
self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  if (!request.url.startsWith(self.location.origin)) return;
  if (!new URL(request.url).pathname.startsWith("/vendor/")) return;

  event.respondWith(
    fetch(request)
      .then((res) => {
        if (res.ok && request.mode === "navigate") {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(request, copy));
        }
        return res;
      })
      .catch(() => caches.match(request).then((hit) => hit || caches.match("/vendor/dashboard"))),
  );
});

self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { title: "Patch", body: event.data ? event.data.text() : "" };
  }

  event.waitUntil(
    self.registration.showNotification(payload.title || "New enquiry", {
      body: payload.body || "",
      icon: "/icons/vendor-192.png",
      badge: "/icons/vendor-192.png",
      tag: payload.tag || "patch-lead",
      // Leads are worth interrupting for; that is the whole point of the app.
      requireInteraction: false,
      data: { url: payload.url || "/vendor/dashboard" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = event.notification.data?.url || "/vendor/dashboard";

  // Focus an open dashboard rather than stacking new windows.
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if (client.url.includes("/vendor/") && "focus" in client) return client.focus();
      }
      return self.clients.openWindow(target);
    }),
  );
});
