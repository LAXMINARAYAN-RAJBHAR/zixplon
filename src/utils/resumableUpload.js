// src/utils/resumableUpload.js
//
// Resumable video upload to R2 (S3 multipart, 10 MiB parts).
//
// • Progress is saved in localStorage after every finished part, keyed by the
//   file's fingerprint (name + size + lastModified + type).
// • If the connection drops, the upload WAITS for the browser to come back
//   online and carries on automatically from the part that was in flight.
// • If it still fails (dead Wi-Fi, tab closed, page reloaded, app restarted),
//   the saved progress stays. When the user picks the SAME file again and
//   shares it, the upload continues from the parts R2 already has.
// • Resume granularity is one part (10 MiB): at most the part that was in
//   flight is re-sent.
//
// Usage:
//   const { url, key } = await uploadVideoResumable(file, {
//     onProgress: (pct) => ...,            // 0–100
//     onStatus:   (s)   => ...,            // "resuming" | "waiting" | "uploading"
//     signal,                              // optional AbortSignal
//   });

import { supabase } from "../config/supabase";

const API_URL = "/api/multipart-upload";
const PART_SIZE = 10 * 1024 * 1024; // R2 minimum is 5 MiB (except the last part)
const CONCURRENCY = 3;
const MAX_RETRIES = 8; // per request, while the browser believes it is online
const STATE_TTL_MS = 6 * 24 * 60 * 60 * 1000; // R2 aborts stale uploads after 7 days
const LS_PREFIX = "zx_mpu:";

// ── small helpers ────────────────────────────────────────────────────────────
const abortError = () => new DOMException("Upload cancelled", "AbortError");

const sleep = (ms, signal) =>
  new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(abortError());
    const t = setTimeout(resolve, ms);
    signal?.addEventListener(
      "abort",
      () => { clearTimeout(t); reject(abortError()); },
      { once: true }
    );
  });

const waitForOnline = (signal) =>
  new Promise((resolve, reject) => {
    if (navigator.onLine) return resolve();
    if (signal?.aborted) return reject(abortError());
    const onOnline = () => { cleanup(); resolve(); };
    const onAbort = () => { cleanup(); reject(abortError()); };
    const cleanup = () => {
      window.removeEventListener("online", onOnline);
      signal?.removeEventListener("abort", onAbort);
    };
    window.addEventListener("online", onOnline);
    signal?.addEventListener("abort", onAbort);
  });

const expectedSize = (total, partSize, n) =>
  Math.min(partSize, total - (n - 1) * partSize);

// ── saved progress ───────────────────────────────────────────────────────────
const fingerprint = (file) =>
  `${LS_PREFIX}${file.name}|${file.size}|${file.lastModified}|${file.type}`;

const loadState = (key) => {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const s = JSON.parse(raw);
    if (!s?.uploadId || !s?.key || Date.now() - (s.createdAt || 0) > STATE_TTL_MS) {
      localStorage.removeItem(key);
      return null;
    }
    return s;
  } catch (_) {
    return null;
  }
};

const saveState = (key, state) => {
  try { localStorage.setItem(key, JSON.stringify(state)); } catch (_) { }
};

const clearState = (key) => {
  try { localStorage.removeItem(key); } catch (_) { }
};

// Remove saved uploads that are too old to be resumed.
const purgeExpiredStates = () => {
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (k && k.startsWith(LS_PREFIX)) loadState(k); // loadState deletes expired ones
    }
  } catch (_) { }
};

// ── API call to our serverless function ──────────────────────────────────────
async function api(action, payload, signal) {
  const { data: { session } } = await supabase.auth.getSession();
  const res = await fetch(API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(session ? { Authorization: `Bearer ${session.access_token}` } : {}),
    },
    body: JSON.stringify({ action, ...payload }),
    signal,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(json.error || `Upload API error (${res.status})`);
    err.status = res.status;
    // 4xx (except timeout / rate-limit) will not fix themselves by retrying.
    err.fatal = res.status >= 400 && res.status < 500 && res.status !== 408 && res.status !== 429;
    throw err;
  }
  return json;
}

// ── PUT one part straight to R2 (XHR so we get upload progress) ──────────────
function putPart(url, blob, onProgress, signal) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.timeout = 5 * 60 * 1000;

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(e.loaded);
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        const etag = xhr.getResponseHeader("ETag");
        if (!etag) {
          const err = new Error(
            "R2 did not return an ETag. Add ETag to ExposeHeaders in the bucket's CORS settings."
          );
          err.fatal = true;
          return reject(err);
        }
        return resolve(etag);
      }
      const err = new Error(`Part upload failed (${xhr.status})`);
      if (xhr.status === 404) { err.code = "UPLOAD_EXPIRED"; err.fatal = true; }
      reject(err);
    };
    xhr.onerror = () => reject(new Error("Network error while uploading."));
    xhr.ontimeout = () => reject(new Error("Upload timed out."));

    if (signal) {
      if (signal.aborted) return reject(abortError());
      signal.addEventListener("abort", () => { xhr.abort(); reject(abortError()); }, { once: true });
    }
    xhr.send(blob);
  });
}

// ── retry wrapper: waits while offline, backs off while "online but failing" ─
async function withRetry(fn, { signal, onStatus }) {
  let attempt = 0;
  for (;;) {
    if (signal?.aborted) throw abortError();

    if (!navigator.onLine) {
      onStatus?.("waiting");
      await waitForOnline(signal);
      onStatus?.("uploading");
      attempt = 0;
    }

    try {
      return await fn();
    } catch (err) {
      if (err.name === "AbortError" || signal?.aborted) throw err;
      if (err.fatal) throw err;

      if (!navigator.onLine) continue; // went offline: loop back and wait (doesn't burn a retry)

      attempt += 1;
      if (attempt > MAX_RETRIES) throw err;
      await sleep(Math.min(1000 * 2 ** (attempt - 1), 15000), signal);
    }
  }
}

// ── one full pass of the upload (start fresh or resume) ──────────────────────
async function runUpload(file, { onProgress, onStatus, signal }) {
  const stateKey = fingerprint(file);
  const retryOpts = { signal, onStatus };
  let state = loadState(stateKey);
  let resumed = false;

  // 1) If we have saved progress, ask R2 which parts it really has.
  if (state) {
    const listed = await withRetry(
      () => api("list-parts", { key: state.key, uploadId: state.uploadId }, signal),
      retryOpts
    );

    if (listed.expired) {
      // The upload no longer exists. Maybe it actually finished (lost response)?
      const head = await withRetry(() => api("head", { key: state.key }, signal), retryOpts);
      if (head.exists && head.size === file.size) {
        clearState(stateKey);
        onProgress?.(100);
        return { url: head.url, key: state.key };
      }
      clearState(stateKey);
      state = null;
    } else {
      const confirmed = {};
      (listed.parts || []).forEach((p) => {
        if (p.Size === expectedSize(file.size, state.partSize, p.PartNumber)) {
          confirmed[p.PartNumber] = p.ETag;
        }
      });
      state.parts = confirmed;
      saveState(stateKey, state);
      resumed = Object.keys(confirmed).length > 0;
    }
  }

  // 2) No (valid) saved upload → start a new one.
  if (!state) {
    const created = await withRetry(
      () => api("create", { contentType: file.type || "video/mp4", fileName: file.name }, signal),
      retryOpts
    );
    state = {
      key: created.key,
      uploadId: created.uploadId,
      partSize: PART_SIZE,
      parts: {},
      createdAt: Date.now(),
    };
    saveState(stateKey, state);
  }

  // 3) Progress bookkeeping (resumed uploads start at the saved percentage).
  const totalParts = Math.max(1, Math.ceil(file.size / state.partSize));
  const total = Math.max(file.size, 1);
  const inflight = {};
  const doneBytes = () =>
    Object.keys(state.parts).reduce(
      (sum, n) => sum + expectedSize(file.size, state.partSize, Number(n)),
      0
    );
  const report = () => {
    const loaded = doneBytes() + Object.values(inflight).reduce((a, b) => a + b, 0);
    onProgress?.(Math.min(99, Math.floor((loaded / total) * 100)));
  };

  if (resumed) onStatus?.("resuming");
  report();

  // 4) Upload the missing parts, a few at a time.
  const pending = [];
  for (let n = 1; n <= totalParts; n++) if (!state.parts[n]) pending.push(n);

  let failed = null;
  const worker = async () => {
    while (!failed) {
      const n = pending.shift();
      if (n === undefined) return;

      const start = (n - 1) * state.partSize;
      const blob = file.slice(start, Math.min(file.size, start + state.partSize));

      try {
        const etag = await withRetry(async () => {
          inflight[n] = 0;
          report();
          // Sign inside the retry so an expired URL is replaced on the next attempt.
          const { url } = await api(
            "sign-part",
            { key: state.key, uploadId: state.uploadId, partNumber: n },
            signal
          );
          return putPart(url, blob, (loaded) => { inflight[n] = loaded; report(); }, signal);
        }, retryOpts);

        state.parts[n] = etag;
        delete inflight[n];
        saveState(stateKey, state); // progress is now safe on disk
        report();
      } catch (err) {
        failed = failed || err;
        delete inflight[n];
        return;
      }
    }
  };

  onStatus?.("uploading");
  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, pending.length) }, worker)
  );
  if (failed) throw failed;

  // 5) Stitch the parts together.
  const parts = Object.keys(state.parts)
    .map(Number)
    .sort((a, b) => a - b)
    .map((n) => ({ PartNumber: n, ETag: state.parts[n] }));

  const done = await withRetry(
    () => api("complete", { key: state.key, uploadId: state.uploadId, parts }, signal),
    retryOpts
  );

  clearState(stateKey);
  onProgress?.(100);
  return { url: done.url, key: state.key };
}

// ── public entry point ───────────────────────────────────────────────────────
export async function uploadVideoResumable(file, opts = {}) {
  purgeExpiredStates();
  try {
    try {
      return await runUpload(file, opts);
    } catch (err) {
      // Saved upload was aborted/expired on R2's side → forget it, start clean once.
      if (err.code === "UPLOAD_EXPIRED") {
        clearState(fingerprint(file));
        return await runUpload(file, opts);
      }
      throw err;
    }
  } catch (err) {
    if (err.name === "AbortError" || err.fatal) throw err;
    // Anything else = connection trouble. Progress is already saved.
    const wrapped = new Error(
      "Upload interrupted. Your progress is saved — check your connection and share again to resume."
    );
    wrapped.code = "UPLOAD_INTERRUPTED";
    wrapped.cause = err;
    throw wrapped;
  }
}