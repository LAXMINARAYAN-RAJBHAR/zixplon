import { useEffect, useRef } from "react";
import { supabase } from "../../config/supabase";

// ─────────────────────────────────────────────────────────────
// useViewTracker
// Tracks a view after 10 seconds of play, once per user
// per content per 15 days.
// Usage:
//   useViewTracker({ contentId: "db_16", contentType: "reel", isPlaying });
//   useViewTracker({ contentId: "15",    contentType: "video", isPlaying });
// ─────────────────────────────────────────────────────────────
const useViewTracker = ({ contentId, contentType, isPlaying }) => {
  const timerRef     = useRef(null);
  const viewedRef    = useRef(false); // prevent double-recording in same session

  useEffect(() => {
    viewedRef.current = false; // reset when content changes
  }, [contentId]);

  useEffect(() => {
    if (!isPlaying || viewedRef.current) return;

    // Start 10-second timer when playing
    timerRef.current = setTimeout(async () => {
      if (viewedRef.current) return;

      const userId = localStorage.getItem("userId");
      if (!userId) return; // not logged in — skip

      const FIFTEEN_DAYS_MS = 15 * 24 * 60 * 60 * 1000;
      const now = Date.now();

      // Check if this user already viewed this content recently
      const { data: existing } = await supabase
        .from("views")
        .select("viewed_at")
        .match({ user_id: userId, content_id: String(contentId), content_type: contentType })
        .maybeSingle();

      if (existing) {
        const lastViewed = new Date(existing.viewed_at).getTime();
        if (now - lastViewed < FIFTEEN_DAYS_MS) {
          // Viewed within last 15 days — don't count again
          viewedRef.current = true;
          return;
        }
        // More than 15 days ago — update the timestamp
        await supabase
          .from("views")
          .update({ viewed_at: new Date().toISOString() })
          .match({ user_id: userId, content_id: String(contentId), content_type: contentType });
      } else {
        // First time viewing — insert
        await supabase.from("views").insert({
          user_id:      userId,
          content_id:   String(contentId),
          content_type: contentType,
          viewed_at:    new Date().toISOString(),
        });
      }

      viewedRef.current = true;
    }, 10000); // 10 seconds

    return () => clearTimeout(timerRef.current);
  }, [isPlaying, contentId, contentType]);
};

export default useViewTracker;