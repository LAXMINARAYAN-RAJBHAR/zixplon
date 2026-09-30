// utils/chatCache.js
//
// Device-side cache for the Messages panel, so a conversation opens
// instantly from what's already on the device and only the newest
// messages are fetched from Supabase in the background.
//
//  - IndexedDB for storage (async, far larger than localStorage's ~5 MB),
//    with an in-memory Map in front so repeat reads are instant.
//  - Every key includes the username, so two accounts on one browser
//    never see each other's data.
//  - Writes are debounced per key, so a burst of realtime messages
//    causes one disk write, not dozens.
//  - Falls back to memory-only if IndexedDB is unavailable (private
//    mode in some browsers). Nothing breaks, it just isn't persisted.
//
// Call clearChatCache() from your logout handler — the cache holds
// private conversations.

const DB_NAME = "zx_chat_cache";
const STORE = "kv";
const DB_VERSION = 1;

// How many messages to fetch per page, and how many to keep on device
// per conversation.
export const MESSAGE_PAGE_SIZE = 50;
const MAX_CACHED_MESSAGES = 200;
const WRITE_DELAY_MS = 400;

const memory = new Map();
const writeTimers = new Map();
let dbPromise = null;

const openDb = () => {
  if (typeof indexedDB === "undefined") return Promise.resolve(null);
  if (!dbPromise) {
    dbPromise = new Promise((resolve) => {
      try {
        const req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = () => req.result.createObjectStore(STORE);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => resolve(null);
        req.onblocked = () => resolve(null);
      } catch {
        resolve(null);
      }
    });
  }
  return dbPromise;
};

const idbGet = async (key) => {
  const db = await openDb();
  if (!db) return undefined;
  return new Promise((resolve) => {
    try {
      const req = db.transaction(STORE, "readonly").objectStore(STORE).get(key);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(undefined);
    } catch {
      resolve(undefined);
    }
  });
};

const idbSet = async (key, value) => {
  const db = await openDb();
  if (!db) return;
  try {
    db.transaction(STORE, "readwrite").objectStore(STORE).put(value, key);
  } catch {
    /* quota or transient error: cache is best-effort */
  }
};

const idbDelete = async (key) => {
  const db = await openDb();
  if (!db) return;
  try {
    db.transaction(STORE, "readwrite").objectStore(STORE).delete(key);
  } catch {
    /* no-op */
  }
};

const idbClear = async () => {
  const db = await openDb();
  if (!db) return;
  try {
    db.transaction(STORE, "readwrite").objectStore(STORE).clear();
  } catch {
    /* no-op */
  }
};

const read = async (key) => {
  if (memory.has(key)) return memory.get(key);
  const value = await idbGet(key);
  if (value !== undefined) memory.set(key, value);
  return value;
};

const write = (key, value) => {
  memory.set(key, value);
  clearTimeout(writeTimers.get(key));
  writeTimers.set(
    key,
    setTimeout(() => {
      writeTimers.delete(key);
      idbSet(key, value);
    }, WRITE_DELAY_MS),
  );
};

const remove = (key) => {
  memory.delete(key);
  clearTimeout(writeTimers.get(key));
  writeTimers.delete(key);
  idbDelete(key);
};

const convosKey = (user) => `convos:${user}`;
const msgsKey = (user, convId) => `msgs:${user}:${convId}`;

// ── Inbox (conversation list) ────────────────────────────────────────
export const getCachedConversations = async (user) =>
  (await read(convosKey(user))) || null;

export const setCachedConversations = (user, list) =>
  write(convosKey(user), list);

// Finds one conversation by its (sorted) user pair from the cached inbox.
export const getCachedConvo = async (user, userA, userB) => {
  const list = await getCachedConversations(user);
  return (
    list?.find((c) => c.user_a === userA && c.user_b === userB) || null
  );
};

// ── Messages ─────────────────────────────────────────────────────────
export const getCachedMessages = async (user, convId) =>
  (await read(msgsKey(user, convId))) || [];

export const setCachedMessages = (user, convId, messages) =>
  write(msgsKey(user, convId), messages.slice(-MAX_CACHED_MESSAGES));

// Drops a deleted/declined conversation from the cache entirely.
export const removeCachedConversation = async (user, convId) => {
  remove(msgsKey(user, convId));
  const list = await getCachedConversations(user);
  if (list) setCachedConversations(user, list.filter((c) => c.id !== convId));
};

// Wipes everything. Call this on logout.
export const clearChatCache = async () => {
  writeTimers.forEach((t) => clearTimeout(t));
  writeTimers.clear();
  memory.clear();
  await idbClear();
};

// ── Merge helper ─────────────────────────────────────────────────────
// Combines what we already have with a freshly fetched batch, by id
// (fresh copies win, so edits, deletes, reactions and seen-ticks update).
//
// If the fresh batch is a FULL page and it starts after the newest
// message we already have, there may be a gap of messages we never saw
// (e.g. 80 arrived while the app was closed). In that case the old
// cache is discarded and only the fresh page is used, so the thread is
// never shown with a hole in the middle. Older history then loads on
// demand via "Load earlier messages".
export const mergeMessages = (existing, fresh, pageSize = MESSAGE_PAGE_SIZE) => {
  if (!existing?.length) return fresh;
  if (!fresh?.length) return existing;

  const newestExisting = new Date(
    existing[existing.length - 1].created_at,
  ).getTime();
  const oldestFresh = new Date(fresh[0].created_at).getTime();
  const hasGap = fresh.length >= pageSize && oldestFresh > newestExisting;

  const byId = new Map((hasGap ? [] : existing).map((m) => [m.id, m]));
  fresh.forEach((m) => byId.set(m.id, m));

  return [...byId.values()].sort(
    (a, b) => new Date(a.created_at) - new Date(b.created_at),
  );
};