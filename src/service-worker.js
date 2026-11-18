/* eslint-disable no-restricted-globals */
// Put this file at src/service-worker.js (CRA picks it up automatically and
// injects the precache list at build time). It only runs in a PRODUCTION build.

import { clientsClaim } from "workbox-core";
import { precacheAndRoute, createHandlerBoundToURL } from "workbox-precaching";
import { registerRoute, NavigationRoute } from "workbox-routing";
import { StaleWhileRevalidate, CacheFirst, NetworkFirst } from "workbox-strategies";
import { ExpirationPlugin } from "workbox-expiration";
import { CacheableResponsePlugin } from "workbox-cacheable-response";

clientsClaim();

// 1) App shell: every file from the build (JS, CSS, index.html, logo...)
precacheAndRoute(self.__WB_MANIFEST);

// 2) React Router pages (/feed, /reels/..., /user/...) all open index.html,
//    so the site loads offline on any route.
registerRoute(
  new NavigationRoute(createHandlerBoundToURL(process.env.PUBLIC_URL + "/index.html"), {
    denylist: [/^\/_/, /\/[^/?]+\.[^/]+$/, /^\/api\//],
  })
);

// 3) Supabase data (GET only): try the network, fall back to the last
//    saved response when offline. Auth and realtime are never cached.
registerRoute(
  ({ url, request }) =>
    request.method === "GET" &&
    url.hostname.endsWith(".supabase.co") &&
    url.pathname.startsWith("/rest/v1/"),
  new NetworkFirst({
    cacheName: "api-cache",
    networkTimeoutSeconds: 4,
    plugins: [
      new CacheableResponsePlugin({ statuses: [200] }),
      new ExpirationPlugin({ maxEntries: 60, maxAgeSeconds: 24 * 60 * 60 }),
    ],
  })
);

// 4) Images / thumbnails: show instantly from cache once seen.
registerRoute(
  ({ request }) => request.destination === "image",
  new CacheFirst({
    cacheName: "image-cache",
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({ maxEntries: 150, maxAgeSeconds: 30 * 24 * 60 * 60 }),
    ],
  })
);

// 5) Google Fonts
registerRoute(
  ({ url }) => url.origin === "https://fonts.googleapis.com",
  new StaleWhileRevalidate({ cacheName: "google-fonts-css" })
);
registerRoute(
  ({ url }) => url.origin === "https://fonts.gstatic.com",
  new CacheFirst({
    cacheName: "google-fonts-files",
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({ maxEntries: 30, maxAgeSeconds: 365 * 24 * 60 * 60 }),
    ],
  })
);

// Videos are NOT cached on purpose (large, and they use range requests).

// Lets the "Update available" button activate a waiting service worker.
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") self.skipWaiting();
});