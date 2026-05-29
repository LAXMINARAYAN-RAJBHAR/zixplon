export const config = { runtime: "edge" };

export default async function handler(req) {
  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type");
  const id = searchParams.get("id");

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

  try {
    const table = type === "reel" ? "reels" : "videos";

    // Cast id to integer explicitly
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

    const raw = await res.text(); // get raw response first
    const data = JSON.parse(raw);
    const item = data?.[0];

    return new Response(
      `<h1>DEBUG</h1>
       <p>Table: ${table}, ID: ${id}</p>
       <p>HTTP Status: ${res.status}</p>
       <p>Raw Response: <pre>${raw}</pre></p>
       <p>Title: ${item?.title || "not found"}</p>
       <p>Thumbnail URL: ${item?.thumbnail_url || "not found"}</p>`,
      { headers: { "content-type": "text/html" } }
    );
  } catch (err) {
    return new Response(
      `<h1>ERROR</h1><pre>${err.message}\n${err.stack}</pre>`,
      { headers: { "content-type": "text/html" } }
    );
  }
}