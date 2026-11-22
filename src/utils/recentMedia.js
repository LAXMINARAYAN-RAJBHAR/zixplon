// Remembers the photos / videos a person recently picked for a story, so the
// "Add status" screen can show them as a Recents grid.
//
// Browsers can't read a phone's gallery directly, so "Recents" here means
// "recently picked inside Zixplon". Files live in IndexedDB on this device only.

const DB_NAME = "zx_story_recents";
const STORE = "media";
const MAX_RECENTS = 30;
const MAX_FILE_BYTES = 50 * 1024 * 1024; // skip very large videos

const openDb = () =>
  new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: "id" });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

const run = async (mode, fn) => {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const request = fn(t.objectStore(STORE));
    t.oncomplete = () => {
      db.close();
      resolve(request ? request.result : undefined);
    };
    t.onerror = () => {
      db.close();
      reject(t.error);
    };
  });
};

// Newest first.
export const loadRecents = async () => {
  try {
    const all = (await run("readonly", (s) => s.getAll())) || [];
    return all.sort((a, b) => b.at - a.at);
  } catch {
    return [];
  }
};

export const saveRecent = async (file, type, duration) => {
  if (!file || file.size > MAX_FILE_BYTES) return;
  try {
    // Same file picked again just moves to the top instead of duplicating.
    const id = `${file.name}-${file.size}-${file.lastModified}`;
    await run("readwrite", (s) =>
      s.put({ id, file, type, duration: duration || null, at: Date.now() })
    );
    const all = await loadRecents();
    const extra = all.slice(MAX_RECENTS);
    if (extra.length) {
      await run("readwrite", (s) => {
        extra.forEach((e) => s.delete(e.id));
      });
    }
  } catch {
    /* Recents are a convenience; never block posting. */
  }
};