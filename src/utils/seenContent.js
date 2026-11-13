// utils/seenContent.js  (save as src/utils/seenContent.js)
//
// Client side of the server-ranked feed (see feed_ranking.sql).
//
//  • markSeen(type, id)      – remember that a post / video / reel was shown.
//                              Marks are queued, saved to the `feed_seen`
//                              table in small batches, and survive a refresh
//                              (queued in localStorage until they are sent).
//  • startFeedSession()      – begin a new feed "session" (a new random seed
//                              and a new "seen before" cut-off). PostFeed calls
//                              this every time the feed is (re)loaded.
//  • fetchRankedIds(type, …) – ask the database for the next page of ids for
//                              a feed, best first, unseen before seen, with
//                              brand-new unseen items pinned on top.
//
// CHANGED: marks are now written through the `mark_seen` database function
// (see mark_seen.sql) instead of upserting into `feed_seen` directly — the
// table's row-level security rejected the upsert form (ON CONFLICT).
//
// Logged-out visitors get a random device id, so they are tracked too.

import { supabase } from "../config/supabase";

const QUEUE_KEY = "zx:seenQueue:v2";
const DEVICE_KEY = "zx:deviceId";
const FLUSH_DELAY_MS = 3000;
const MAX_QUEUE = 500;

const lsGet = (k) => {
  try { return localStorage.getItem(k); } catch (_) { return null; }
};
const lsSet = (k, v) => {
  try { localStorage.setItem(k, v); } catch (_) { }
};

// ── Who is looking ──────────────────────────────────────────────────────
export const getFeedOwnerId = () => {
  const userId = lsGet("userId");
  if (userId) return String(userId);
  let id = lsGet(DEVICE_KEY);
  if (!id) {
    id = "dev_" + Math.random().toString(36).slice(2) + Date.now().toString(36);
    lsSet(DEVICE_KEY, id);
  }
  return id;
};

// ── Feed session ────────────────────────────────────────────────────────
// A session fixes (a) the cut-off for what counts as "seen before" and
// (b) the random seed. Both stay constant while you scroll, so ranking is
// stable within a session and different on the next refresh.
const newSession = () => ({
  start: new Date().toISOString(),
  seed: Math.floor(Math.random() * 1_000_000_000),
});

let session = newSession();
export const getFeedSession = () => session;
export const startFeedSession = () => {
  session = newSession();
  return session;
};

// ── Seen queue ──────────────────────────────────────────────────────────
let queue = null; // [{ t: type, i: id, u: ownerId }]
const queuedThisPage = new Set();
let flushTimer = null;
let flushing = null;

const loadQueue = () => {
  if (queue) return queue;
  try {
    const parsed = JSON.parse(lsGet(QUEUE_KEY) || "[]");
    queue = Array.isArray(parsed) ? parsed : [];
  } catch (_) {
    queue = [];
  }
  return queue;
};

const persistQueue = () => {
  lsSet(QUEUE_KEY, JSON.stringify(loadQueue().slice(-MAX_QUEUE)));
};

const toRows = (entries) => {
  const seen = new Set();
  const rows = [];
  entries.forEach((e) => {
    const key = `${e.u}|${e.t}|${e.i}`;
    if (seen.has(key)) return;
    seen.add(key);
    rows.push({ user_id: e.u, content_type: e.t, content_id: e.i });
  });
  return rows;
};

export const flushSeen = async () => {
  clearTimeout(flushTimer);
  flushTimer = null;
  if (flushing) await flushing;

  const q = loadQueue();
  if (q.length === 0) return;

  const batch = q.splice(0, q.length);
  persistQueue();

  flushing = (async () => {
    try {
      // CHANGED: through the mark_seen() database function.
      const { error } = await supabase.rpc("mark_seen", {
        p_rows: toRows(batch),
      });
      if (error) throw error;
    } catch (_) {
      // Put them back; the next flush (or the next page load) retries.
      loadQueue().unshift(...batch);
      persistQueue();
    }
  })();

  try {
    await flushing;
  } finally {
    flushing = null;
  }
};

const scheduleFlush = () => {
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    flushSeen();
  }, FLUSH_DELAY_MS);
};

export const markSeen = (type, id) => {
  if (id === null || id === undefined) return;
  const key = `${type}:${id}`;
  if (queuedThisPage.has(key)) return;
  queuedThisPage.add(key);
  loadQueue().push({ t: type, i: String(id), u: getFeedOwnerId() });
  // CHANGED: write the queue to localStorage right away, so marks survive
  // even if the tab is killed before the 3-second flush (common on mobile).
  persistQueue();
  scheduleFlush();
};

// On refresh / close / tab hidden: send what is left with a keepalive
// request (a normal request would be cancelled). The queue is also kept in
// localStorage, so anything that doesn't get through is retried on the next
// page load — duplicates are ignored by the database.
const flushOnExit = () => {
  const q = loadQueue();
  if (q.length === 0) return;
  persistQueue();
  try {
    const url = supabase.supabaseUrl;
    const key = supabase.supabaseKey;
    if (!url || !key) return;
    // CHANGED: calls the mark_seen() function instead of POSTing to the table.
    fetch(`${url}/rest/v1/rpc/mark_seen`, {
      method: "POST",
      keepalive: true,
      headers: {
        "Content-Type": "application/json",
        apikey: key,
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({ p_rows: toRows(q) }),
    }).catch(() => { });
  } catch (_) { }
};

if (typeof window !== "undefined") {
  window.addEventListener("pagehide", flushOnExit);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flushOnExit();
  });
  // Retry anything left over from a previous page load.
  setTimeout(() => flushSeen(), 1500);
}

// ── Ranked ids from the database ────────────────────────────────────────
//   type    "post" | "video" | "reel"
//   limit   page size
//   cursor  { score, id } returned by the previous call (null for page 1)
//   seedOffset  added to the session seed so that different consumers
//               (e.g. reel strips) get different shuffles
//   pin     pin the newest unseen (<24h) items on top
// Returns { ids, next, done } — `next` is the cursor for the next page and
// `done` is true when the database has no more.
export const fetchRankedIds = async (
  type,
  { limit = 10, cursor = null, seedOffset = 0, pin = true } = {},
) => {
  const { data, error } = await supabase.rpc("get_feed_ids", {
    p_type: type,
    p_user_id: getFeedOwnerId(),
    p_username: lsGet("username") || "",
    p_session_start: session.start,
    p_seed: (session.seed + seedOffset) % 2147483647,
    p_pin: pin,
    p_limit: limit,
    p_cursor_score: cursor ? cursor.score : null,
    p_cursor_id: cursor ? cursor.id : null,
  });
  if (error) throw error;

  const rows = data || [];
  const last = rows[rows.length - 1];
  return {
    ids: rows.map((r) => String(r.id)),
    next: last ? { score: last.score, id: String(last.id) } : cursor,
    done: rows.length < limit,
  };
};