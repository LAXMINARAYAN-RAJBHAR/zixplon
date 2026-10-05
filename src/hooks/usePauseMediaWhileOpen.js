/* global WeakRef */
// src/hooks/usePauseMediaWhileOpen.js
//
// While `open` is true: pauses every playing <video>/<audio> (including audio
// created in code with `new Audio()`), and stops new ones from starting.
// When it turns false (or the component unmounts): resumes only what it paused.
//
// Anything marked data-keep-playing (or inside an element that is) is never touched.
import { useEffect } from "react";

const isExempt = (el) => !!(el.closest && el.closest("[data-keep-playing]"));

// WeakRef lets finished audio objects be garbage-collected. Very old browsers
// don't have it, so fall back to a plain reference there.
const makeRef = (el) =>
  typeof WeakRef !== "undefined" ? new WeakRef(el) : { deref: () => el };

const known = []; // refs to every media element that has called play()
const seen = new WeakSet();
const toResume = []; // refs to elements we paused or blocked
const queued = new WeakSet();
let blockers = 0; // number of open panels that want silence
let patched = false;

const remember = (el) => {
  if (!seen.has(el)) {
    seen.add(el);
    known.push(makeRef(el));
  }
};

const queueResume = (el) => {
  if (!queued.has(el)) {
    queued.add(el);
    toResume.push(makeRef(el));
  }
};

// Wrap play() once so we know about detached Audio objects and can block
// playback while a panel is open.
function patchPlay() {
  if (patched || typeof HTMLMediaElement === "undefined") return;
  patched = true;
  const originalPlay = HTMLMediaElement.prototype.play;
  HTMLMediaElement.prototype.play = function (...args) {
    remember(this);
    if (blockers > 0 && !isExempt(this)) {
      queueResume(this);
      return Promise.resolve();
    }
    return originalPlay.apply(this, args);
  };
}

function pauseAll() {
  const els = new Set(document.querySelectorAll("video, audio"));
  for (let i = known.length - 1; i >= 0; i--) {
    const el = known[i].deref();
    if (el) els.add(el);
    else known.splice(i, 1);
  }
  els.forEach((el) => {
    if (!el.paused && !el.ended && !isExempt(el)) {
      queueResume(el);
      el.pause();
    }
  });
}

function resumeAll() {
  const list = toResume.splice(0, toResume.length);
  list.forEach((ref) => {
    const el = ref.deref();
    if (!el) return;
    queued.delete(el);
    if (!el.ended) el.play().catch(() => {});
  });
}

export function usePauseMediaWhileOpen(open) {
  useEffect(() => {
    if (!open) return undefined;
    patchPlay();
    blockers += 1;
    pauseAll();

    // Catches elements that start playing by themselves (autoplay attribute).
    const onPlay = (e) => {
      const el = e.target;
      if (el instanceof HTMLMediaElement && !isExempt(el)) {
        queueResume(el);
        el.pause();
      }
    };
    document.addEventListener("play", onPlay, true);

    return () => {
      document.removeEventListener("play", onPlay, true);
      blockers = Math.max(0, blockers - 1);
      if (blockers === 0) resumeAll();
    };
  }, [open]);
}

export default usePauseMediaWhileOpen;