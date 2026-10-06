/* eslint-disable no-restricted-globals */

// ── Zixplon service worker (cache lifecycle + push notifications) ──

const CACHE_NAME = "zixplon-v5"; // bumped so the activate step clears v4
const APP_SHELL = ["/", "/index.html"];

// Vibration pattern used for an incoming call (long buzzes, like a ring).
const CALL_VIBRATE = [800, 400, 800, 400, 800, 400, 800];

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
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  if (event.request.url.includes("supabase")) return;

  event.respondWith(
    fetch(event.request).catch(() =>
      caches.match(event.request).then((cached) => {
        if (cached) return cached;
        if (event.request.mode === "navigate") {
          return caches.match("/index.html");
        }
        return Response.error();
      })
    )
  );
});

// ── Push notifications ──

// Removes the notification(s) with this tag. Browsers require every push to
// show *something*, so we first replace the ringing notification with a
// silent one and then close it - which makes it disappear from the tray.
async function clearNotificationByTag(tag, icon, badge) {
  await self.registration.showNotification("Call ended", {
    tag,
    icon,
    badge,
    silent: true,
    renotify: false,
  });
  const open = await self.registration.getNotifications({ tag });
  open.forEach((n) => n.close());
}

self.addEventListener("push", (event) => {
  let payload = {};

  if (event.data) {
    try {
      payload = event.data.json();
    } catch (e) {
      payload = { body: event.data.text() };
    }
  }

  // With userVisibleOnly: true, every push MUST show a notification.
  // Returning early on empty data makes the browser display its own
  // generic "This site has been updated in the background" message.
  const {
    title = "ZIXPLON",
    body = "",
    icon = "/logo192.png",
    badge = "/logo192.png",
    url = "/",
    tag,
    requireInteraction = false,
    isCall = false, // this push is about a voice call
    close = false, // ...and the call is over (answered/declined): remove the ring
  } = payload;

  event.waitUntil(
    (async () => {
      // The call finished or was answered elsewhere: take the ring away.
      if (isCall && close) {
        await clearNotificationByTag(tag || "zixplon-call", icon, badge);
        return;
      }

      // The app is open and visible: it already rings in-app, so don't also
      // show a notification on top of it. (Browsers allow skipping the
      // notification when a page of this site is visible.)
      if (isCall) {
        const wins = await self.clients.matchAll({
          type: "window",
          includeUncontrolled: true,
        });
        if (wins.some((w) => w.visibilityState === "visible")) return;
      }

      await self.registration.showNotification(title, {
        body,
        icon,
        badge,
        tag: tag || "zixplon-notification", // renotify requires a tag
        renotify: true,
        // Calls stay on screen (desktop browsers) and buzz like a ring.
        requireInteraction: !!requireInteraction,
        vibrate: isCall ? CALL_VIBRATE : [100, 50, 100],
        data: { url },
      });
    })()
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = new URL(
    event.notification.data?.url || "/",
    self.location.origin
  ).href;

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then(async (clientList) => {
        for (const client of clientList) {
          if (!("focus" in client)) continue;
          await client.focus();
          // Let the app route in-place (SPA), and fall back to a hard
          // navigation if nothing in the page handles the message.
          client.postMessage({ type: "PUSH_NAVIGATE", url: targetUrl });
          return;
        }
        if (self.clients.openWindow) {
          return self.clients.openWindow(targetUrl);
        }
      })
  );
});