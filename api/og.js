export const config = { runtime: "edge" };

function escapeHtml(str = "") {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// ---------------------------------------------------------------------------
// Share-preview text: **bold** / *italic* are converted to Unicode look-alike
// letters so they look formatted in plain-text link previews.
// ---------------------------------------------------------------------------
function mapChars(str, upper, lower, digit) {
  return Array.from(str)
    .map((ch) => {
      const c = ch.codePointAt(0);
      if (c >= 65 && c <= 90) return String.fromCodePoint(upper + (c - 65));
      if (c >= 97 && c <= 122) return String.fromCodePoint(lower + (c - 97));
      if (digit && c >= 48 && c <= 57) return String.fromCodePoint(digit + (c - 48));
      return ch;
    })
    .join("");
}
const toBold = (t) => mapChars(t, 0x1d5d4, 0x1d5ee, 0x1d7ec);
const toItalic = (t) => mapChars(t, 0x1d608, 0x1d622, 0);

function previewText(input = "", max = 200) {
  let s = String(input || "").replace(/\r\n?/g, "\n");
  s = s.replace(/```[\s\S]*?```/g, " ");
  s = s.replace(/`([^`\n]+)`/g, "$1");
  s = s.replace(/\*\*\s*([^\n]*?\S)\s*\*\*/g, (_, t) => toBold(t));
  s = s.replace(
    /(^|[\s(])__\s*([^\n]*?\S)\s*__(?=$|[\s).,!?:;])/g,
    (_, pre, t) => pre + toBold(t)
  );
  s = s.replace(/~~(?=\S)([\s\S]+?)(?<=\S)~~/g, "$1");
  s = s.replace(/(^|[\s(])\*(?=\S)([^*\n]+?)(?<=\S)\*(?=$|[\s).,!?:;])/g, (_, pre, t) => pre + toItalic(t));
  s = s.replace(/(^|[\s(])_(?=\S)([^_\n]+?)(?<=\S)_(?=$|[\s).,!?:;])/g, (_, pre, t) => pre + toItalic(t));
  s = s.replace(/^\s{0,3}#{1,6}\s+/gm, "");
  s = s.replace(/\*{2,}/g, "");
  s = s.replace(/(^|\s)\*+(?=\S)/g, "$1").replace(/(?<=\S)\*+(?=\s|$)/g, "");
  s = s.replace(/\s+/g, " ").trim();
  const chars = Array.from(s);
  if (chars.length > max) {
    s = chars.slice(0, max).join("").replace(/\s+\S*$/, "").trim() + "…";
  }
  return s;
}

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
const ALLOWED_TYPES = ["post", "reel", "video", "story", "profile"];

const PROFILE_PATH = "/user";
const POSTS_TAB_URL = `${SITE}/?tab=posts`;

// ---------------------------------------------------------------------------
// NEW: per-type look & feel of the preview. Edit these to restyle a type.
//   siteName   -> og:site_name (the small grey line above/below the title)
//   badge      -> emoji put in front of the title
//   ogType     -> og:type
// ---------------------------------------------------------------------------
const PREVIEW_META = {
  post:    { siteName: "ZIXPLON · Posts",   badge: "📝", ogType: "article" },
  video:   { siteName: "ZIXPLON · Videos",  badge: "▶️", ogType: "video.other" },
  reel:    { siteName: "ZIXPLON · Reels",   badge: "🎬", ogType: "video.other" },
  story:   { siteName: "ZIXPLON · Stories", badge: "📸", ogType: "article" },
  profile: { siteName: "ZIXPLON",           badge: "",   ogType: "profile" },
};

// NEW: stories disappear after this many hours (set to 0 to never expire).
const STORY_TTL_HOURS = 24;

// Where a shared story opens in the React app (StoryViewer is opened by
// /?tab=posts&story=<id>). Receives the story row, returns an absolute URL.
const storyUrlFor = (item, id) =>
  `${SITE}/?tab=posts&story=${encodeURIComponent(item.id ?? id)}`;

const FALLBACK_OG_IMAGE = `${SITE}/logo192.png`;

function cleanImage(url) {
  if (!url || typeof url !== "string") return null;
  let u = url.trim();
  if (!u || u.startsWith("data:") || u.startsWith("blob:")) return null;
  if (u.startsWith("//")) u = `https:${u}`;
  else if (u.startsWith("/")) u = `${SITE}${u}`;
  else if (u.startsWith("http://")) u = u.replace("http://", "https://");
  try {
    return new URL(u).href;
  } catch {
    return null;
  }
}

function firstImage(candidates) {
  for (const c of candidates) {
    const img = cleanImage(c);
    if (img) return img;
  }
  return null;
}

function ogImage(url, w = 1200, h = 630) {
  const fit = w === h ? "fit=cover&a=attention" : "fit=contain&cbg=111111";
  return `https://wsrv.nl/?url=${encodeURIComponent(url)}&w=${w}&h=${h}&${fit}&output=jpg&q=80`;
}

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

function ilikeValue(str = "") {
  return encodeURIComponent(String(str).replace(/\*/g, "").replace(/[\\%_]/g, "\\$&"));
}

// NEW: "badge + title" helper, skips the badge when there is none.
const withBadge = (type, text) => {
  const b = PREVIEW_META[type]?.badge;
  return b ? `${b} ${text}` : text;
};

// NEW: joins non-empty parts with " · " for compact descriptions.
const joinParts = (...parts) => parts.filter(Boolean).join(" · ");

function renderHtml({ type, title, description, image, url, shareUrl, card = "summary_large_image", imageSize = null }) {
  const safeTitle = escapeHtml(title);
  const safeDescription = escapeHtml(description);
  const safeImage = escapeHtml(image);
  const safeUrl = escapeHtml(url);
  const safeShareUrl = escapeHtml(shareUrl || url);
  const meta = PREVIEW_META[type] || PREVIEW_META.post;
  const safeSite = escapeHtml(meta.siteName);

  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8" />
    <title>${safeTitle} — ZIXPLON</title>
    <meta name="description" content="${safeDescription}" />
    <meta property="og:type" content="${meta.ogType}" />
    <meta property="og:title" content="${safeTitle}" />
    <meta property="og:description" content="${safeDescription}" />
    <meta property="og:image" content="${safeImage}" />
    <meta property="og:image:secure_url" content="${safeImage}" />
    ${imageSize ? `<meta property="og:image:width" content="${imageSize.w}" />
    <meta property="og:image:height" content="${imageSize.h}" />
    <meta property="og:image:type" content="image/jpeg" />` : ""}
    <meta property="og:image:alt" content="${safeTitle}" />
    <meta property="og:url" content="${safeShareUrl}" />
    <meta property="og:site_name" content="${safeSite}" />
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
    description: "Watch videos, reels, stories and posts on ZIXPLON",
    image: FALLBACK_OG_IMAGE,
    url,
    shareUrl,
  });
}

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

const debugJson = (obj) =>
  new Response(JSON.stringify(obj, null, 2), {
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });

// NEW: author's profile picture (best effort) — used when a post / story has
// no image of its own.
async function fetchProfilePic(SUPABASE_URL, sbHeaders, username) {
  if (!username) return null;
  try {
    const pr = await fetchWithTimeout(
      `${SUPABASE_URL}/rest/v1/profiles?username=eq.${encodeURIComponent(username)}&select=profile_pic&limit=1`,
      { headers: sbHeaders }
    );
    if (!pr.ok) return null;
    const rows = await pr.json();
    return rows?.[0]?.profile_pic || null;
  } catch (_) {
    return null;
  }
}

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
  // NEW: stories expire, so their previews are cached for a short time only.
  const storyHeaders = {
    "content-type": "text/html; charset=utf-8",
    "cache-control": "public, max-age=300, s-maxage=300",
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

  const shareUrl = `${SITE}/s/${type}/${encodeURIComponent(id)}`;

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.error("og handler: SUPABASE_URL / SUPABASE_ANON_KEY are not set for this deployment.");
    if (debug) {
      return debugJson({
        error: "Missing environment variables",
        hasSupabaseUrl: !!SUPABASE_URL,
        hasSupabaseAnonKey: !!SUPABASE_ANON_KEY,
        fix: "Add SUPABASE_URL and SUPABASE_ANON_KEY (no REACT_APP_ prefix) to your hosting environment variables, then redeploy.",
      });
    }
    return new Response(fallbackHtml(type, genericFallbackUrl, shareUrl), {
      headers: notFoundHeaders,
    });
  }

  const sbHeaders = {
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    "Content-Type": "application/json",
  };

  try {
    let title, description, url;
    let candidates = [];
    let card = "summary_large_image";

    if (type === "post") {
      const res = await fetchWithTimeout(
        `${SUPABASE_URL}/rest/v1/posts?id=eq.${encodeURIComponent(id)}&select=*`,
        { headers: sbHeaders }
      );

      if (!res.ok) throw new Error(`Supabase responded ${res.status}`);
      const data = await res.json();
      const item = data?.[0];

      if (!item || (item.privacy && item.privacy !== "public")) {
        return new Response(fallbackHtml(type, POSTS_TAB_URL, shareUrl), {
          headers: notFoundHeaders,
        });
      }

      // CUSTOM POST PREVIEW: "📝 username shared a post"
      title = withBadge(
        "post",
        item?.username ? `${item.username} shared a post` : "New post on ZIXPLON"
      );
      description =
        previewText(item?.text, 200) ||
        (item?.video_url ? "Watch this video post on ZIXPLON" : "Check out this post on ZIXPLON");

      candidates = [
        item?.image_url,
        parseList(item?.image_urls)[0],
        item?.thumbnail_url,
        item?.thumbnail,
        getVideoThumbnailFromCloudinaryUrl(item?.video_url),
      ];
      if (!firstImage(candidates)) {
        candidates.push(await fetchProfilePic(SUPABASE_URL, sbHeaders, item?.username));
      }
      url = `${SITE}/?tab=posts&post=${encodeURIComponent(item.id ?? id)}`;
    } else if (type === "story") {
      // STORY PREVIEW. Reads the `stories` table: id, username, caption,
      // media_url, media_type, song, created_at (+ optional thumbnail_url,
      // expires_at, privacy).
      const res = await fetchWithTimeout(
        `${SUPABASE_URL}/rest/v1/stories?id=eq.${encodeURIComponent(id)}&select=*&limit=1`,
        { headers: sbHeaders }
      );

      if (!res.ok) throw new Error(`Supabase responded ${res.status}`);
      const data = await res.json();
      const item = data?.[0];

      const expired = (() => {
        if (item?.expires_at) return new Date(item.expires_at).getTime() < Date.now();
        if (STORY_TTL_HOURS > 0 && item?.created_at) {
          return Date.now() - new Date(item.created_at).getTime() > STORY_TTL_HOURS * 3600 * 1000;
        }
        return false;
      })();

      // Missing, private, or expired stories never leak a preview.
      if (!item || (item.privacy && item.privacy !== "public") || expired) {
        if (debug) {
          return debugJson({
            type,
            id,
            reason: !item
              ? "No story row returned. Wrong id, story deleted, or Supabase RLS blocks anonymous (anon key) reads on `stories`."
              : expired
                ? "Story is older than STORY_TTL_HOURS / past expires_at."
                : `Story privacy is "${item.privacy}", not public.`,
            rowFound: !!item,
            privacy: item?.privacy ?? null,
            created_at: item?.created_at ?? null,
            expires_at: item?.expires_at ?? null,
          });
        }
        return new Response(fallbackHtml(type, genericFallbackUrl, shareUrl), {
          headers: notFoundHeaders,
        });
      }

      title = withBadge("story", `${item.username}'s story`);
      // 🎵 / 🎙️ note when the story has music or a voice status.
      const songNote = item.song?.title
        ? ` · ${item.song.voice ? "🎙️" : "🎵"} ${item.song.title}`
        : "";
      description =
        (previewText(item.caption, 160) ||
          `Watch ${item.username}'s story on ZIXPLON before it disappears`) + songNote;

      // Stories store their media in media_url (+ media_type image|video).
      // Video stories only get a real frame if a thumbnail_url was saved or
      // the file is a Cloudinary video; otherwise the author's profile
      // picture is used below.
      candidates = [
        item.thumbnail_url,
        item.media_type === "video" ? null : item.media_url,
        item.media_type === "video"
          ? getVideoThumbnailFromCloudinaryUrl(item.media_url)
          : null,
      ];
      if (!firstImage(candidates)) {
        candidates.push(await fetchProfilePic(SUPABASE_URL, sbHeaders, item.username));
      }
      url = storyUrlFor(item, id);
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
      description = previewText(item.about, 200) || `Watch ${name}'s videos, reels and posts on ZIXPLON`;
      candidates = [
        item.profile_pic,
        item.banner_pic,
        `https://ui-avatars.com/api/?name=${encodeURIComponent(item.username)}&background=7c3aed&color=fff&size=600`,
      ];
      url = `${SITE}${PROFILE_PATH}/${encodeURIComponent(item.username)}`;
      card = "summary";
    } else {
      // video or reel
      const table = type === "reel" ? "reels" : "videos";
      const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      const isUuid = UUID_RE.test(id);
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

      const rawTitle = previewText(item?.title, 100);
      const by = item?.channel || item?.username || "";

      if (type === "reel") {
        // CUSTOM REEL PREVIEW: "🎬 Title" or "🎬 Reel by channel"
        title = withBadge("reel", rawTitle || (by ? `Reel by ${by}` : "Watch this reel"));
        description =
          previewText(item?.description, 200) ||
          (by ? `Watch this reel by ${by} on ZIXPLON` : "Watch short reels on ZIXPLON");
      } else {
        // CUSTOM VIDEO PREVIEW: "▶️ Title" + "channel · description"
        title = withBadge("video", rawTitle || "Watch on ZIXPLON");
        description =
          joinParts(by, previewText(item?.description, 180)) ||
          "Watch videos on ZIXPLON";
      }

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
    const imageSize = card === "summary" ? { w: 600, h: 600 } : { w: 1200, h: 630 };
    const image = picked ? ogImage(picked, imageSize.w, imageSize.h) : FALLBACK_OG_IMAGE;

    if (debug) {
      return debugJson({
        type,
        id,
        redirectsTo: url,
        title,
        usedFallback: !picked,
        originalImage: picked,
        originalImageCheck: picked ? await probeImage(picked) : null,
        chosenImage: image,
        imageCheck: await probeImage(image),
        candidates: candidates.map(short),
        description,
        note: "WhatsApp usually skips images over ~300 KB. data: URLs are never usable.",
      });
    }

    const commentId = searchParams.get("comment");
    if (commentId && url && type !== "profile" && type !== "story") {
      url += (url.includes("?") ? "&" : "?") + `comment=${encodeURIComponent(commentId)}`;
    }

    return new Response(
      renderHtml({ type, title, description, image, url, shareUrl, card, imageSize: picked ? imageSize : null }),
      { headers: !picked ? notFoundHeaders : type === "story" ? storyHeaders : headers }
    );
  } catch (err) {
    console.error("og handler error:", err);
    if (debug) {
      return debugJson({
        error: String(err?.message || err),
        type,
        id,
        hint: "A 4xx/5xx from Supabase, a timeout, or a bad id. The visitor was being sent to the home page because of this.",
      });
    }
    return new Response(fallbackHtml(type, genericFallbackUrl, shareUrl), {
      headers: notFoundHeaders,
    });
  }
}