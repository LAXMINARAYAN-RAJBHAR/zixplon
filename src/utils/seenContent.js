// utils/seenContent.js
//
// Remembers which posts / videos / reels this browser has already shown
// (localStorage), and orders a batch of items so that:
//   1. brand-new, not-yet-seen items (default: last 24h) are PINNED on top,
//      newest first (capped by `pinMax`),
//   2. every other not-yet-seen item comes next, shuffled,
//   3. items already seen come last, shuffled.
//
// Ordering is only applied when a batch is LOADED — marking something as
// seen while you scroll never reorders what is already on screen.

const STORAGE_KEY = "zx:seen:v1";
const TYPES = ["post", "video", "reel"];
const MAX_PER_TYPE = 800; // oldest ids are forgotten beyond this
const DEFAULT_PIN_WINDOW_MS = 24 * 60 * 60 * 1000;

let cache = null; // { post: Set, video: Set, reel: Set } (insertion-ordered)
let saveTimer = null;

const load = () => {
  if (cache) return cache;
  cache = { post: new Set(), video: new Set(), reel: new Set() };
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    TYPES.forEach((t) => {
      (raw[t] || []).forEach((id) => cache[t].add(String(id)));
    });
  } catch (_) { }
  return cache;
};

const save = () => {
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
  if (!cache) return;
  try {
    const out = {};
    TYPES.forEach((t) => {
      out[t] = [...cache[t]].slice(-MAX_PER_TYPE);
    });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(out));
  } catch (_) { }
};

const scheduleSave = () => {
  if (saveTimer) return;
  saveTimer = setTimeout(save, 800);
};

// Write immediately when the page is refreshed / closed / hidden, so a
// refresh right after scrolling doesn't lose the last second of marks.
if (typeof window !== "undefined") {
  window.addEventListener("pagehide", save);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") save();
  });
}

export const markSeen = (type, id) => {
  if (id === null || id === undefined) return;
  const set = load()[type];
  if (!set) return;
  const key = String(id);
  if (set.has(key)) return;
  set.add(key);
  while (set.size > MAX_PER_TYPE) {
    set.delete(set.values().next().value);
  }
  scheduleSave();
};

export const isSeen = (type, id) => {
  if (id === null || id === undefined) return false;
  const set = load()[type];
  return !!set && set.has(String(id));
};

export const shuffle = (arr) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

// Order one batch for the feed (see the header comment).
//   items  – array of posts / videos / reels
//   type   – "post" | "video" | "reel"
//   opts   – getId, getTime, pinMax (0 = no pinning), pinWindowMs
export const orderForFeed = (items, type, opts = {}) => {
  const {
    getId = (x) => x.id,
    getTime = (x) => x.created_at,
    pinMax = 0,
    pinWindowMs = DEFAULT_PIN_WINDOW_MS,
  } = opts;

  const unseen = [];
  const seen = [];
  items.forEach((it) => (isSeen(type, getId(it)) ? seen : unseen).push(it));

  const now = Date.now();
  const timeOf = (it) => new Date(getTime(it)).getTime();

  const pinned = unseen
    .filter((it) => {
      const t = timeOf(it);
      return t && now - t < pinWindowMs;
    })
    .sort((a, b) => timeOf(b) - timeOf(a))
    .slice(0, pinMax);

  const pinnedIds = new Set(pinned.map((it) => String(getId(it))));
  const restUnseen = unseen.filter((it) => !pinnedIds.has(String(getId(it))));

  return [...pinned, ...shuffle(restUnseen), ...shuffle(seen)];
};