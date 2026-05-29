export const config = { runtime: "edge" };

const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.REACT_APP_SUPABASE_ANON_KEY;

export default async function handler(req) {
  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type"); // "video" or "reel"
  const id = searchParams.get("id");

  // If no id or not a crawler, serve normal index.html
  const ua = req.headers.get("user-agent") || "";
  const isCrawler = /whatsapp|telegram|twitterbot|facebookexternalhit|linkedinbot|slackbot|discordbot/i.test(ua);

  if (!id || !isCrawler) {
    // Not a crawler — serve the React app normally
    const indexRes = await fetch(new URL("/index.html", req.url));
    const html = await indexRes.text();
    return new Response(html, {
      headers: { "content-type": "text/html" },
    });
  }

  // Fetch video/reel data from Supabase
  const table = type === "reel" ? "reels" : "videos";
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/${table}?id=eq.${id}&select=title,thumbnail_url,thumbnail,description,channel,username`,
    {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
    }
  );

  const data = await res.json();
  const item = data?.[0];

  const title = item?.title || "Watch on ZIXPLON";
  const description = item?.description || item?.channel || "Watch videos and reels on ZIXPLON";
  // reels use "thumbnail", videos use "thumbnail_url"
  const image = item?.thumbnail_url || item?.thumbnail || "https://zixplon-tawny.vercel.app/logo192.png";
  const url = `https://zixplon-tawny.vercel.app/${type === "reel" ? "reels" : "video"}/${id}`;

  const html = `<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8" />
    <title>${title} — ZIXPLON</title>

    <!-- Open Graph (WhatsApp, Facebook, Telegram) -->
    <meta property="og:type" content="video.other" />
    <meta property="og:title" content="${title}" />
    <meta property="og:description" content="${description}" />
    <meta property="og:image" content="${image}" />
    <meta property="og:image:width" content="1280" />
    <meta property="og:image:height" content="720" />
    <meta property="og:url" content="${url}" />
    <meta property="og:site_name" content="ZIXPLON" />

    <!-- Twitter Card -->
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${title}" />
    <meta name="twitter:description" content="${description}" />
    <meta name="twitter:image" content="${image}" />

    <!-- Redirect real users to the React app -->
    <meta http-equiv="refresh" content="0;url=${url}" />
  </head>
  <body>
    <p>Redirecting to <a href="${url}">${title}</a>...</p>
  </body>
</html>`;

  return new Response(html, {
    headers: { "content-type": "text/html" },
  });
}