export const config = { runtime: "edge" };

export default async function handler(req) {
  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type");
  const id = searchParams.get("id");

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

  // Debug: check if env vars are loaded
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return new Response(
      `<h1>ENV VARS MISSING</h1>
       <p>SUPABASE_URL: ${SUPABASE_URL ? "✅ loaded" : "❌ missing"}</p>
       <p>SUPABASE_ANON_KEY: ${SUPABASE_ANON_KEY ? "✅ loaded" : "❌ missing"}</p>`,
      { headers: { "content-type": "text/html" } }
    );
  }

  // Debug: try fetching from Supabase
  try {
    const table = type === "reel" ? "reels" : "videos";
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/${table}?id=eq.${id}&select=title,thumbnail_url,thumbnail`,
      {
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        },
      }
    );
    const data = await res.json();
    const item = data?.[0];

    return new Response(
      `<h1>✅ SUCCESS</h1>
       <p>Type: ${type}, ID: ${id}</p>
       <p>Title: ${item?.title || "not found"}</p>
       <p>Thumbnail: ${item?.thumbnail_url || item?.thumbnail || "not found"}</p>
       <img src="${item?.thumbnail_url || item?.thumbnail || ""}" style="max-width:300px" />`,
      { headers: { "content-type": "text/html" } }
    );
  } catch (err) {
    return new Response(
      `<h1>❌ FETCH ERROR</h1><pre>${err.message}</pre>`,
      { headers: { "content-type": "text/html" } }
    );
  }
}