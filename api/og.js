export const config = { runtime: "edge" };

export default async function handler(req) {
  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type");
  const id = searchParams.get("id");

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

  try {
    const table = type === "reel" ? "reels" : "videos";
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/${table}?id=eq.${id}&select=*`,
      {
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    const data = await res.json();
    const item = data?.[0];

    const title = item?.title || "Watch on ZIXPLON";
    const description = item?.description || item?.channel || "Watch videos and reels on ZIXPLON";
    const image = item?.thumbnail_url || item?.thumbnail || "https://zixplon-tawny.vercel.app/logo192.png";
    const url = `https://zixplon-tawny.vercel.app/${type === "reel" ? `reels/db_${id}` : `video/${id}`}`;

    const html = `<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8" />
    <title>${title} — ZIXPLON</title>
    <meta property="og:type" content="video.other" />
    <meta property="og:title" content="${title}" />
    <meta property="og:description" content="${description}" />
    <meta property="og:image" content="${image}" />
    <meta property="og:image:width" content="1280" />
    <meta property="og:image:height" content="720" />
    <meta property="og:url" content="${url}" />
    <meta property="og:site_name" content="ZIXPLON" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${title}" />
    <meta name="twitter:description" content="${description}" />
    <meta name="twitter:image" content="${image}" />
    <script>window.location.replace("${url}");</script>
  </head>
  <body>
    <p>Redirecting... <a href="${url}">Click here if not redirected</a></p>
  </body>
</html>`;

    return new Response(html, { headers: { "content-type": "text/html" } });

  } catch (err) {
    return new Response(`<p>Error: ${err.message}</p>`, {
      headers: { "content-type": "text/html" },
    });
  }
}