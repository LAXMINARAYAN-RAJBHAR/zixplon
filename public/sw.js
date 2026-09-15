/* eslint-disable no-restricted-globals */

// ── Zixplon service worker ──
// Merged from the original sw.js (cache lifecycle + fetch passthrough)
// and sw-push.js (push notifications). Two separate service worker
// scripts were both registering at the same root scope ("/") — only
// one script can actually control a given scope at a time, so the
// second register() call was silently replacing the first as the
// active worker. Keeping everything in one file avoids that collision
// entirely. Delete sw-push.js once this is deployed, and update
// usePushNotifications.js to register this file instead (see the note
// at the bottom of this file).

const CACHE_NAME = "zixplon-v4";
const APP_SHELL = ["/", "/index.html"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME)
            .map((key) => caches.delete(key))
        )
      )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  if (event.request.url.includes("supabase")) return;

  event.respondWith(
    fetch(event.request).catch(() => {
      // Network fetch failed — try cache, then fall back to the app
      // shell for navigations so the user doesn't get a hard network
      // error instead of the page.
      return caches.match(event.request).then((cached) => {
        if (cached) return cached;
        if (event.request.mode === "navigate") {
          return caches.match("/index.html");
        }
        return Response.error();
      });
    })
  );
});

// ── Push notifications ──
// Handles two events:
//   1. 'push'            → server sent a notification, show it
//   2. 'notificationclick' → user tapped it, focus/open the right page

self.addEventListener("push", (event) => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch (e) {
    payload = { title: "ZIXPLON", body: event.data.text() };
  }

  const {
    title = "ZIXPLON",
    body = "",
    icon = "/logo192.png",
    badge = "/logo192.png",
    url = "/",
    tag,
  } = payload;

  const options = {
    body,
    icon,
    badge,
    // 'tag' groups notifications — e.g. multiple messages from the same
    // person collapse into one instead of stacking up
    tag: tag || "zixplon-notification",
    renotify: true,
    vibrate: [100, 50, 100],
    data: { url },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || "/";

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        // If a Zixplon tab is already open, focus it and navigate there
        for (const client of clientList) {
          if ("focus" in client) {
            client.postMessage({ type: "PUSH_NAVIGATE", url: targetUrl });
            return client.focus();
          }
        }
        // Otherwise open a new tab
        if (self.clients.openWindow) {
          return self.clients.openWindow(targetUrl);
        }
      }),
  );
});