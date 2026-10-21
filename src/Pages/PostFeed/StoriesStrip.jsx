import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { supabase } from "../../config/supabase";
import { getInitials } from "../../utils/initials";
import StoryCreator from "./StoryCreator";
import StoryViewer from "./StoryViewer";

// ─────────────────────────────────────────────────────────────────────────
// StoriesStrip — the horizontal "Create story" + stories row in the Posts
// feed.
//
//   • First card: "Create story" (opens StoryCreator).
//   • Then one card per person with a live (< 24h) story: your own first,
//     then people with stories you haven't seen, then the rest. Cards with
//     unseen stories get a coloured ring.
//   • Tapping a card opens StoryViewer at that person's first unseen story.
//   • "Seen" (the ring colour) is remembered per browser (localStorage).
//     Separately, each view by a logged-in person is saved to the
//     `story_views` table so the owner can see who viewed their story.
//
// Data comes from the `stories` table (see stories_migration.sql) and is
// kept fresh through a realtime subscription.
// ─────────────────────────────────────────────────────────────────────────

const VIEWED_KEY = "zx_viewed_stories";
const OPEN_CREATOR_EVENT = "zx:open-story-creator";

const readViewed = () => {
  try {
    return new Set(JSON.parse(localStorage.getItem(VIEWED_KEY) || "[]"));
  } catch {
    return new Set();
  }
};

const writeViewed = (set) => {
  try {
    // Stories expire after 24h, so only the most recent ids ever matter.
    localStorage.setItem(VIEWED_KEY, JSON.stringify([...set].slice(-500)));
  } catch (_) { }
};

const isHlsSource = (src) => !!src && /\.m3u8(\?.*)?$/i.test(src);

/* One person's card in the strip. */
const StoryTile = ({ group, isOwn, onOpen }) => {
  const s = group.latest;
  const canPreviewVideo = s.media_type === "video" && !isHlsSource(s.media_url);

  return (
    <button
      type="button"
      className="pf-story-card"
      onClick={onOpen}
      aria-label={`${isOwn ? "Your story" : `${group.username}'s story`}`}
    >
      <div className="pf-story-card-media">
        {s.media_type === "image" ? (
          <img src={s.media_url} alt="" loading="lazy" draggable={false} />
        ) : canPreviewVideo ? (
          <video
            src={`${s.media_url}#t=0.1`}
            preload="metadata"
            muted
            playsInline
          />
        ) : (
          <div className="pf-story-card-placeholder">🎬</div>
        )}
      </div>

      <span className={`pf-story-ring${group.hasUnviewed ? " unviewed" : ""}`}>
        <span className="pf-story-ring-avatar">{getInitials(group.username)}</span>
      </span>

      <span className="pf-story-card-name">
        {isOwn ? "Your story" : group.username}
      </span>
    </button>
  );
};

const StoriesStrip = ({ currentUser }) => {
  const isLoggedIn = !!currentUser && currentUser !== "anonymous";

  const [stories, setStories] = useState([]);
  const [viewed, setViewed] = useState(readViewed);
  const [now, setNow] = useState(() => Date.now());
  const [showCreator, setShowCreator] = useState(false);
  // { groups, groupIndex, storyIndex } — a snapshot, so realtime updates
  // or "seen" re-sorting can't shuffle people around mid-view.
  const [viewer, setViewer] = useState(null);

  // Unique per mount — Supabase reuses a channel object when the same
  // name is requested twice (same issue handled in PostCard/PostFeed).
  const instanceIdRef = useRef(Math.random().toString(36).slice(2));

  const fetchStories = useCallback(async () => {
    const { data, error } = await supabase
      .from("stories")
      .select("id, username, media_url, media_type, caption, created_at, expires_at")
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: true })
      .limit(300);
    if (!error && data) setStories(data);
  }, []);

  useEffect(() => {
    fetchStories();

    const channel = supabase
      .channel(`stories-strip-${instanceIdRef.current}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "stories" },
        fetchStories
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [fetchStories]);

  // Drop stories from the strip the minute they expire, without a refetch.
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(t);
  }, []);

  const openCreator = useCallback(() => {
    if (!isLoggedIn) {
      window.dispatchEvent(new CustomEvent("openLogin"));
      return;
    }
    setShowCreator(true);
  }, [isLoggedIn]);

  // Lets other parts of the app (e.g. HomeHub's Upload menu) open the
  // creator with window.dispatchEvent(new CustomEvent("zx:open-story-creator")).
  useEffect(() => {
    window.addEventListener(OPEN_CREATOR_EVENT, openCreator);
    return () => window.removeEventListener(OPEN_CREATOR_EVENT, openCreator);
  }, [openCreator]);

  const groups = useMemo(() => {
    const live = stories.filter((s) => new Date(s.expires_at).getTime() > now);

    const byUser = new Map();
    live.forEach((s) => {
      if (!byUser.has(s.username)) byUser.set(s.username, []);
      byUser.get(s.username).push(s);
    });

    const list = [...byUser.entries()].map(([username, items]) => {
      const firstUnviewed = items.findIndex((s) => !viewed.has(s.id));
      return {
        username,
        stories: items, // oldest -> newest, played in that order
        latest: items[items.length - 1],
        hasUnviewed: firstUnviewed !== -1,
        startIndex: firstUnviewed === -1 ? 0 : firstUnviewed,
      };
    });

    list.sort((a, b) => {
      if (a.username === currentUser) return -1;
      if (b.username === currentUser) return 1;
      if (a.hasUnviewed !== b.hasUnviewed) return a.hasUnviewed ? -1 : 1;
      return new Date(b.latest.created_at) - new Date(a.latest.created_at);
    });

    return list;
  }, [stories, viewed, now, currentUser]);

  const openViewer = (groupIndex) => {
    setViewer({
      groups,
      groupIndex,
      storyIndex: groups[groupIndex].startIndex,
    });
  };

  // Called by StoryViewer with the whole story each time one is shown.
  //  1) remembers it locally (ring colour), and
  //  2) saves the view so the story's owner can see who watched it.
  const markViewed = useCallback(
    (story) => {
      setViewed((prev) => {
        if (prev.has(story.id)) return prev;
        const next = new Set(prev);
        next.add(story.id);
        writeViewed(next);
        return next;
      });

      if (isLoggedIn && story.username !== currentUser) {
        supabase
          .from("story_views")
          .upsert(
            { story_id: story.id, viewer_username: currentUser },
            { onConflict: "story_id,viewer_username", ignoreDuplicates: true }
          )
          .then(({ error }) => {
            if (error) console.error("Save story view failed:", error);
          });
      }
    },
    [isLoggedIn, currentUser]
  );

  const deleteStory = useCallback(
    async (story) => {
      const { error } = await supabase
        .from("stories")
        .delete()
        .eq("id", story.id)
        .eq("username", currentUser);
      if (error) {
        console.error("Delete story failed:", error);
        return false;
      }
      setStories((prev) => prev.filter((s) => s.id !== story.id));
      return true;
    },
    [currentUser]
  );

  const handleCreated = (story) => {
    if (story) {
      setStories((prev) =>
        prev.some((s) => s.id === story.id) ? prev : [...prev, story]
      );
    }
    fetchStories();
  };

  return (
    <>
      <div className="pf-stories">
        <div className="pf-stories-track">
          {/* Create story */}
          <button
            type="button"
            className="pf-story-card pf-story-card--create"
            onClick={openCreator}
            aria-label="Create story"
          >
            <div className="pf-story-create-top">
              <span className="pf-story-create-avatar">
                {isLoggedIn ? getInitials(currentUser) : "👤"}
              </span>
            </div>
            <div className="pf-story-create-bottom">
              <span className="pf-story-create-plus">+</span>
              <span className="pf-story-create-label">Create story</span>
            </div>
          </button>

          {groups.map((g, i) => (
            <StoryTile
              key={g.username}
              group={g}
              isOwn={g.username === currentUser}
              onOpen={() => openViewer(i)}
            />
          ))}
        </div>
      </div>

      {showCreator && (
        <StoryCreator
          currentUser={currentUser}
          onClose={() => setShowCreator(false)}
          onCreated={handleCreated}
        />
      )}

      {viewer && (
        <StoryViewer
          groups={viewer.groups}
          startGroup={viewer.groupIndex}
          startStory={viewer.storyIndex}
          currentUser={currentUser}
          onViewed={markViewed}
          onDelete={deleteStory}
          onClose={() => setViewer(null)}
        />
      )}
    </>
  );
};

export default StoriesStrip;