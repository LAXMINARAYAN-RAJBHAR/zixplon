// src/Pages/Share/ShareRedirect.jsx
// Handles shared links like  https://zixplon.in/s/reel/9WzyGHr1vC
// (the link that /api/og sends people to). It looks the item up by its
// short code and sends the visitor to the real page. Before this existed
// the router had no "/s/..." route, so the page area rendered blank.
import React, { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { supabase } from "../../config/supabase";

// type in the link  ->  table to look the short code up in.
// CHANGE these if your table names differ.
const TYPE_TABLE = {
  video: "videos",
  reel: "reels",
  short: "reels",
  post: "posts",
};

// type + id  ->  the app route that shows it.
const routeFor = (type, id) => {
  const enc = encodeURIComponent(id);
  if (type === "video") return `/video/${enc}`;
  if (type === "reel" || type === "short") return `/reels/${enc}`;
  if (type === "post") return `/?tab=posts&post=${enc}`;
  return null;
};

// Looks for the code in `short_id` first, then in `id`. Errors (missing
// column, id type mismatch, …) are treated as "not found in that column".
async function findId(table, code) {
  const tryCol = async (col) => {
    try {
      const { data, error } = await supabase
        .from(table)
        .select("id")
        .eq(col, code)
        .limit(1)
        .maybeSingle();
      return error ? null : data;
    } catch {
      return null;
    }
  };
  const row = (await tryCol("short_id")) || (await tryCol("id"));
  return row?.id ?? null;
}

export const NotFoundPage = ({ message }) => (
  <div style={{ paddingTop: 90, textAlign: "center", fontFamily: "'Outfit', sans-serif" }}>
    <div style={{ fontSize: 44 }}>🔗</div>
    <h2 style={{ margin: "10px 0 6px" }}>{message || "Page not found"}</h2>
    <p style={{ color: "#7a3a3a", margin: "0 0 18px" }}>
      This link may be broken or the content may have been removed.
    </p>
    <Link
      to="/"
      style={{
        background: "#dc2626",
        color: "#fff",
        padding: "10px 22px",
        borderRadius: 999,
        textDecoration: "none",
        fontWeight: 700,
      }}
    >
      Go to Home
    </Link>
  </div>
);

const ShareRedirect = () => {
  const { type = "", code = "" } = useParams();
  const navigate = useNavigate();
  const [unknown, setUnknown] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const t = type.toLowerCase();
    const table = TYPE_TABLE[t];
    if (!table || !code) {
      setUnknown(true);
      return undefined;
    }
    (async () => {
      const realId = await findId(table, code);
      if (cancelled) return;
      // If the lookup finds nothing (or the table/column names differ),
      // still pass the code through so the destination page can decide —
      // never leave the visitor on a blank screen.
      navigate(routeFor(t, realId ?? code), { replace: true });
    })();
    return () => {
      cancelled = true;
    };
  }, [type, code, navigate]);

  if (unknown) return <NotFoundPage message="Link not recognised" />;
  return (
    <div style={{ paddingTop: 110, textAlign: "center", color: "#7a3a3a", fontWeight: 700 }}>
      Opening link…
    </div>
  );
};

export default ShareRedirect;