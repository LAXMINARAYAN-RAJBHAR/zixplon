// "Laxminarayan Rajbhar" -> "LR", "laxminarayan.rajbhar" -> "LR",
// single word "Desi" -> "DE"
export const getInitials = (name) => {
  const words = String(name || "").trim().split(/[\s.\-]+/).filter(Boolean);
  if (words.length === 0) return "?";
  const first = (w) => Array.from(w)[0];
  if (words.length === 1) return Array.from(words[0]).slice(0, 2).join("").toUpperCase();
  return (first(words[0]) + first(words[1])).toUpperCase();
};