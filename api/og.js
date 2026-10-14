export const config = { runtime: "edge" };

function escapeHtml(str = "") {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Kept as a documented no-op for R2 URLs (R2 has no "grab a frame" transform).
// Only matches legacy Cloudinary video URLs. Real thumbnails must be stored
// at upload time (thumbnail_url / thumbnail columns).
function getVideoThumbnailFromCloudinaryUrl(videoUrl) {
  if (!videoUrl) return null;
  if (videoUrl.includes("/upload/")) {
    return videoUrl
      .replace("/upload/", "/upload/so_0/")
      .replace(/\.\w+(\?.*)?$/, ".jpg");
  }
  return null;
}

const FETCH_TIMEOUT_MS = 4000;

async function fetchWithTimeout(url, options, timeoutMs = FETCH_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

const SITE = "https://zixplon.in";
const ALLOWED_TYPES = ["post", "reel", "video", "profile"];

// The path of your React profile route, WITHOUT the username.
const PROFILE_PATH = "/profile";

// Ideally replace with a real 1200x630 branded image: put it in /public
// and change this to `${SITE}/og-fallback.jpg`.
const FALLBACK_OG_IMAGE = `${SITE}/logo192.png`;

// CHANGED: returns a clean absolute https URL, or null when the value can't be
// used by a crawler (empty, data:/blob: URLs, or not a valid URL at all).
// Crawlers (WhatsApp, Facebook, X...) cannot use data: URIs as og:image.
function cleanImage(url) {
  if (!url || typeof url !== "string") return null;
  let u = url.trim();
  if (!u || u.startsWith("data:") || u.startsWith("blob:")) return null;
  if (u.startsWith("//")) u = `https:${u}`;
  else if (u.startsWith("/")) u = `${SITE}${u}`;
  else if (u.startsWith("http://")) u = u.replace("http://", "https://");
  try {
    return new URL(u).href; // also percent-encodes spaces etc.
  } catch {
    return null;
  }
}

// First usable image from a list of candidates, or null.
function firstImage(candidates) {
  for (const c of candidates) {
    const img = cleanImage(c);
    if (img) return img;
  }
  return null;
}

// image_urls may be a real array, a JSON string, or empty.
function parseList(v) {
  if (Array.isArray(v)) return v;
  if (typeof v === "string") {
    try {
      const p = JSON.parse(v);
      return Array.isArray(p) ? p : [];
    } catch {
      return [];
    }
  }
  return [];
}

// Escape LIKE wildcards so a username is matched literally by ilike
// (mirrors escapeLike() in Profile.jsx). "*" is PostgREST's own wildcard.
function ilikeValue(str = "") {
  return encodeURIComponent(String(str).replace(/\*/g, "").replace(/[\\%_]/g, "\\$&"));
}

function ogTypeFor(type) {
  if (type === "post") return "article";
  if (type === "profile") return "profile";
  return "video.other";
}

function renderHtml({ type, title, description, image, url, shareUrl, card = "summary_large_image" }) {
  const safeTitle = escapeHtml(title);
  const safeDescription = escapeHtml(description);
  const safeImage = escapeHtml(image);
  const safeUrl = escapeHtml(url);
  const safeShareUrl = escapeHtml(shareUrl || url);

  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8" />
    <title>${safeTitle} — ZIXPLON</title>
    <meta name="description" content="${safeDescription}" />
    <meta property="og:type" content="${ogTypeFor(type)}" />
    <meta property="og:title" content="${safeTitle}" />
    <meta property="og:description" content="${safeDescription}" />
    <meta property="og:image" content="${safeImage}" />
    <meta property="og:image:secure_url" content="${safeImage}" />
    <meta property="og:image:alt" content="${safeTitle}" />
    <meta property="og:url" content="${safeShareUrl}" />
    <meta property="og:site_name" content="ZIXPLON" />
    <meta name="twitter:card" content="${card}" />
    <meta name="twitter:title" content="${safeTitle}" />
    <meta name="twitter:description" content="${safeDescription}" />
    <meta name="twitter:image" content="${safeImage}" />
    <meta http-equiv="refresh" content="0;url=${safeUrl}" />
    <script>window.location.replace(${JSON.stringify(url).replace(/</g, "\\u003c")});</script>
  </head>
  <body>
    <p>Redirecting... <a href="${safeUrl}">Click here if not redirected</a></p>
  </body>
</html>`;
}

function fallbackHtml(type, url, shareUrl) {
  return renderHtml({
    type,
    title: "ZIXPLON",
    description: "Watch videos, reels, and posts on ZIXPLON",
    image: FALLBACK_OG_IMAGE,
    url,
    shareUrl,
  });
}

// NEW: used by ?debug=1 — fetches the chosen image the way a crawler would and
// reports status / content-type / size, so you can see WHY a thumbnail fails.
async function probeImage(imageUrl) {
  try {
    const res = await fetchWithTimeout(imageUrl, {
      method: "GET",
      headers: { "User-Agent": "facebookexternalhit/1.1", Accept: "image/*" },
    });
    const info = {
      status: res.status,
      contentType: res.headers.get("content-type"),
      contentLength: res.headers.get("content-length"),
    };
    try { await res.body?.cancel(); } catch (_) {}
    return info;
  } catch (e) {
    return { error: String(e?.message || e) };
  }
}

const short = (v) => (typeof v === "string" ? (v.length > 220 ? v.slice(0, 220) + "…(" + v.length + " chars)" : v) : v ?? null);

export default async function handler(req) {
  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type");
  const id = searchParams.get("id");
  const debug = searchParams.get("debug") === "1";

  const SUPABASE_URL = process.env.SUPABASE_URL || process.env.REACT_APP_SUPABASE_URL;
  const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.REACT_APP_SUPABASE_ANON_KEY;

  const headers = {
    "content-type": "text/html; charset=utf-8",
    "cache-control": "public, max-age=3600, s-maxage=3600",
  };
  const notFoundHeaders = {
    "content-type": "text/html; charset=utf-8",
    "cache-control": "public, max-age=60, s-maxage=60",
  };

  const genericFallbackUrl = SITE;

  if (!id || !type) {
    return new Response(fallbackHtml(type || "post", genericFallbackUrl), {
      headers: notFoundHeaders,
    });
  }

  if (!ALLOWED_TYPES.includes(type)) {
    console.warn(`og handler: unknown type "${type}" for id "${id}"`);
    return new Response(fallbackHtml("post", genericFallbackUrl), {
      headers: notFoundHeaders,
    });
  }

  // The pretty URL people actually share (rewritten to this function).
  const shareUrl = `${SITE}/s/${type}/${encodeURIComponent(id)}`;

  const sbHeaders = {
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    "Content-Type": "application/json",
  };

  try {
    let title, description, url;
    let candidates = [];           // raw image candidates, in priority order
    let card = "summary_large_image";

    if (type === "post") {
      const res = await fetchWithTimeout(
        `${SUPABASE_URL}/rest/v1/posts?id=eq.${encodeURIComponent(id)}&select=*`,
        { headers: sbHeaders }
      );

      if (!res.ok) throw new Error(`Supabase responded ${res.status}`);
      const data = await res.json();
      const item = data?.[0];

      // Never leak "friends" / "only_me" posts into a public preview.
      if (!item || (item.privacy && item.privacy !== "public")) {
        return new Response(fallbackHtml(type, `${SITE}/feed`, shareUrl), {
          headers: notFoundHeaders,
        });
      }

      title = item?.username ? `${item.username} on ZIXPLON` : "Post on ZIXPLON";
      description = item?.text?.slice(0, 200) || "Check out this post on ZIXPLON";
      // CHANGED: also reads image_urls when it is a JSON string, and `thumbnail`.
      candidates = [
        item?.image_url,
        parseList(item?.image_urls)[0],
        item?.thumbnail_url,
        item?.thumbnail,
        getVideoThumbnailFromCloudinaryUrl(item?.video_url),
      ];
      url = `${SITE}/feed?post=${id}`;
    } else if (type === "profile") {
      const res = await fetchWithTimeout(
        `${SUPABASE_URL}/rest/v1/profiles?username=ilike.${ilikeValue(id)}&select=username,channel_name,about,profile_pic,banner_pic&limit=1`,
        { headers: sbHeaders }
      );

      if (!res.ok) throw new Error(`Supabase responded ${res.status}`);
      const data = await res.json();
      const item = data?.[0];

      if (!item) {
        return new Response(fallbackHtml(type, genericFallbackUrl, shareUrl), {
          headers: notFoundHeaders,
        });
      }

      const name = item.channel_name || item.username;
      title = `${name} (@${item.username})`;
      description = item.about?.slice(0, 200) || `Watch ${name}'s videos, reels and posts on ZIXPLON`;
      candidates = [
        item.profile_pic,
        item.banner_pic,
        `https://ui-avatars.com/api/?name=${encodeURIComponent(item.username)}&background=7c3aed&color=fff&size=600`,
      ];
      url = `${SITE}${PROFILE_PATH}/${encodeURIComponent(item.username)}`;
      card = "summary"; // square avatar
    } else {
      const table = type === "reel" ? "reels" : "videos";
      const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      const isUuid = UUID_RE.test(id);
      // `id` may be a uuid OR a numeric id depending on the table; only use
      // id.eq when it can't cause a type-cast error, and fall back to short_id.
      const isNumeric = /^\d+$/.test(id);
      const filter = isUuid || isNumeric
        ? `or=(id.eq.${encodeURIComponent(id)},short_id.eq.${encodeURIComponent(id)})`
        : `short_id=eq.${encodeURIComponent(id)}`;

      const res = await fetchWithTimeout(
        `${SUPABASE_URL}/rest/v1/${table}?${filter}&select=*&limit=1`,
        { headers: sbHeaders }
      );

      if (!res.ok) throw new Error(`Supabase responded ${res.status}`);
      const data = await res.json();
      const item = data?.[0];

      if (!item) {
        return new Response(fallbackHtml(type, genericFallbackUrl, shareUrl), {
          headers: notFoundHeaders,
        });
      }

      title = item?.title || "Watch on ZIXPLON";
      description = item?.description || item?.channel || "Watch videos and reels on ZIXPLON";
      // CHANGED: tries both column names for both tables (videos use
      // thumbnail_url, reels use thumbnail) and skips unusable values.
      candidates = [
        item?.thumbnail_url,
        item?.thumbnail,
        getVideoThumbnailFromCloudinaryUrl(item?.video_url),
      ];

      url =
        type === "reel"
          ? `${SITE}/reels/db_${item.id}`
          : `${SITE}/video/${item.id}`;
    }

    const picked = firstImage(candidates);
    const image = picked || FALLBACK_OG_IMAGE;

    // NEW: ?debug=1 → JSON report instead of HTML.
    if (debug) {
      return new Response(
        JSON.stringify(
          {
            type,
            id,
            usedFallback: !picked,
            chosenImage: image,
            imageCheck: await probeImage(image),
            candidates: candidates.map(short),
            note: "WhatsApp usually skips images over ~300 KB. data: URLs are never usable.",
          },
          null,
          2
        ),
        { headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } }
      );
    }

    const commentId = searchParams.get("comment");
    if (commentId && url && type !== "profile") {
      url += (url.includes("?") ? "&" : "?") + `comment=${encodeURIComponent(commentId)}`;
    }

    // CHANGED: when we had to use the fallback logo, cache for only 60s so a
    // thumbnail added/fixed later isn't hidden behind an hour-long cache.
    return new Response(
      renderHtml({ type, title, description, image, url, shareUrl, card }),
      { headers: picked ? headers : notFoundHeaders }
    );
  } catch (err) {
    console.error("og handler error:", err);
    return new Response(fallbackHtml(type, genericFallbackUrl, shareUrl), {
      headers: notFoundHeaders,
    });
  }
}