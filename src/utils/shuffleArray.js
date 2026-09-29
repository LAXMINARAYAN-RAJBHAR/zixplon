// utils/shuffleArray.js
//
// Plain Fisher-Yates shuffle — returns a NEW array in a fresh random
// order every call. Used to vary the order of the Reels feed and the
// Video page's next/prev/suggestions on every load, without touching
// the original (newest-first) array it was given.
export const shuffleArray = (arr) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};