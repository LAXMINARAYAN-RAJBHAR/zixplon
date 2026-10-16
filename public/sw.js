/* eslint-disable no-restricted-globals */

// ── Zixplon service worker (cache lifecycle + push notifications) ──

// Bump this whenever you change this file. Old caches are deleted on activate.
const CACHE_VERSION = "v6";
const PAGE_CACHE = `zixplon-pages-${CACHE_VERSION}`;
const ASSET_CACHE = `zixplon-assets-${CACHE_VERSION}`;
const APP_SHELL = ["/", "/index.html"];

// A page load that takes longer than this falls back to the cached copy,
// so a slow connection never leaves the user waiting on a blank screen.
const NAVIGATION_TIMEOUT_MS = 6000;

// Vibration pattern used for an incoming call (long buzzes, like a ring).
const CALL_VIBRATE = [800, 400, 800, 400, 800, 400, 800];

self.addEventListener("install", (event) => {
  // Pre-caching is only an offline fallback, so a failure here must never
  // stop the new worker from installing.
  event.waitUntil(
    caches
      .open(PAGE_CACHE)
      .then((cache) => cache.addAll(APP_SHELL))
      .catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  const keep = new Set([PAGE_CACHE, ASSET_CACHE]);
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((key) => !keep.has(key)).map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

// ── Fetch handling ──
//
// Why the page used to load WITHOUT its CSS:
//  • index.html was cached once at install and never refreshed. After a
//    deploy, a flaky network made the worker serve that OLD index.html,
//    which points at CSS/JS files that no longer exist.
//  • Nothing but the shell was ever cached, so when a CSS request timed out
//    on a slow connection it fell through to Response.error().
//
// Now:
//  • Page loads are network-first (with a timeout) and refresh the cached
//    index.html every time, so the offline copy is always the latest build.
//  • Hashed build files (/static/...) are cached once fetched, and only if the
//    response really is the right kind of file - a missing CSS file that the
//    host answers with index.html is never stored.
//  • Cross-origin requests (Supabase, fonts, R2, Giphy) and non-GET requests
//    are left completely alone.

// Is this response safe to cache for the kind of file that was requested?
function isCacheable(request, response) {
  if (!response || response.status !== 200 || !response.ok) return false;
  const type = (response.headers.get("content-type") || "").toLowerCase();
  const dest = request.destination;
  if (dest === "style") return type.includes("text/css");
  if (dest === "script") return type.includes("javascript");
  if (dest === "image") return type.startsWith("image/");
  return !type.includes("text/html");
}

async function handleNavigation(request) {
  const cache = await caches.open(PAGE_CACHE);
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), NAVIGATION_TIMEOUT_MS);
    const response = await fetch(request, { signal: controller.signal });
    clearTimeout(timer);
    // Keep the offline copy in step with the latest deploy.
    if (response && response.ok) cache.put("/index.html", response.clone());
    return response;
  } catch (_) {
    const cached =
      (await cache.match("/index.html")) || (await cache.match(request));
    return cached || Response.error();
  }
}

async function handleStaticAsset(request) {
  const cache = await caches.open(ASSET_CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (isCacheable(request, response)) cache.put(request, response.clone());
  return response;
}

async function handleOther(request) {
  const cache = await caches.open(ASSET_CACHE);
  try {
    const response = await fetch(request);
    if (isCacheable(request, response)) cache.put(request, response.clone());
    return response;
  } catch (err) {
    const cached = await cache.match(request);
    if (cached) return cached;
    return Response.error();
  }
}

self.addEventListener("fetch", (event) => {
  const request = event.request;

  if (request.method !== "GET") return;
  if (request.url.includes("supabase")) return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // fonts, R2, Giphy, ...
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/s/")) return; // OG / share endpoints
  if (request.headers.has("range")) return; // let the browser stream video/audio itself

  if (request.mode === "navigate") {
    event.respondWith(handleNavigation(request));
    return;
  }

  if (url.pathname.startsWith("/static/")) {
    event.respondWith(handleStaticAsset(request));
    return;
  }

  event.respondWith(handleOther(request));
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