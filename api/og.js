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
const ALLOWED_TYPES = ["post", "reel", "video"];

// Ideally replace with a real 1200x630 branded image: put it in /public
// and change this to `${SITE}/og-fallback.jpg`.
const FALLBACK_OG_IMAGE = `${SITE}/logo192.png`;

// NEW: crawlers require an absolute https image URL.
function absImage(url) {
  if (!url || typeof url !== "string") return FALLBACK_OG_IMAGE;
  if (url.startsWith("//")) return `https:${url}`;
  if (url.startsWith("/")) return `${SITE}${url}`;
  if (url.startsWith("http://")) return url.replace("http://", "https://");
  return url;
}

function renderHtml({ type, title, description, image, url, shareUrl }) {
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
    <meta property="og:type" content="${type === "post" ? "article" : "video.other"}" />
    <meta property="og:title" content="${safeTitle}" />
    <meta property="og:description" content="${safeDescription}" />
    <meta property="og:image" content="${safeImage}" />
    <meta property="og:image:alt" content="${safeTitle}" />
    <meta property="og:url" content="${safeShareUrl}" />
    <meta property="og:site_name" content="ZIXPLON" />
    <meta name="twitter:card" content="summary_large_image" />
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

export default async function handler(req) {
  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type");
  const id = searchParams.get("id");

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
    let title, description, image, url;

    if (type === "post") {
      const res = await fetchWithTimeout(
        `${SUPABASE_URL}/rest/v1/posts?id=eq.${encodeURIComponent(id)}&select=*`,
        { headers: sbHeaders }
      );

      if (!res.ok) throw new Error(`Supabase responded ${res.status}`);
      const data = await res.json();
      const item = data?.[0];

      // NEW: never leak "friends" / "only_me" posts into a public preview.
      if (!item || (item.privacy && item.privacy !== "public")) {
        return new Response(fallbackHtml(type, `${SITE}/feed`, shareUrl), {
          headers: notFoundHeaders,
        });
      }

      title = item?.username ? `${item.username} on ZIXPLON` : "Post on ZIXPLON";
      description = item?.text?.slice(0, 200) || "Check out this post on ZIXPLON";
      image = absImage(
        item?.image_url ||
          item?.image_urls?.[0] ||
          item?.thumbnail_url ||
          getVideoThumbnailFromCloudinaryUrl(item?.video_url) ||
          FALLBACK_OG_IMAGE
      );
      url = `${SITE}/feed?post=${id}`;
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
      image = absImage(
        item?.thumbnail_url ||
          item?.thumbnail ||
          getVideoThumbnailFromCloudinaryUrl(item?.video_url) ||
          FALLBACK_OG_IMAGE
      );

      url =
        type === "reel"
          ? `${SITE}/reels/db_${item.id}`
          : `${SITE}/video/${item.id}`;
    }

    return new Response(renderHtml({ type, title, description, image, url, shareUrl }), { headers });
  } catch (err) {
    console.error("og handler error:", err);
    return new Response(fallbackHtml(type, genericFallbackUrl, shareUrl), {
      headers: notFoundHeaders,
    });
  }
}