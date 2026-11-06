import React, { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { useLocation, Link } from "react-router-dom";
import { supabase } from "../../config/supabase";
import "./PostFeed.css";
import PostComposer from "./PostComposer";
import PostCard from "./PostCard";
import ReelsStrip from "./ReelsStrip";
import VideoFeedCard from "./VideoFeedCard";
// NEW: Stories strip (Create story + people's stories) shown above the
// composer trigger at the top of the Posts feed.
import StoriesStrip from "./StoriesStrip";
// NEW: same live-streams browser the Home page shows (🔴 Live section).
// ⚠ Adjust this path to wherever LiveViewer lives in your project —
// HomePage imports it as "../Live/LiveViewer", so from the PostFeed
// folder it is probably this:
import LiveBrowser from "../../Component/Live/LiveViewer";
import SideNavbar from "../../Component/SideNavbar/sideNavbar";
// NEW: shared preloading, buffer-hiding video — used for search-result
// reels that have no thumbnail, so they only load once near the screen.
import AutoPlayVideo from "../../Component/Shared/AutoPlayVideo";
import { notifyConnections, notifyUser } from "../../utils/notifications";
import { extractMentions } from "../../utils/linkify";
import SuggestedConnections from "../../Component/Messages/SuggestedConnections";
// NEW (feedback): Interested / Not interested for posts, videos and reels.
import useContentFeedback, { FeedbackToast } from "../../hooks/useContentFeedback";
// NEW: profile-level "Interested / Not interested" popup (replaces the
// per-post items that used to live in each post's ⋯ menu).
import useProfileFeedback from "../../hooks/useProfileFeedback";
import ProfilePrompt, { ProfileFeedbackToast } from "./ProfilePrompt";
// NEW: server-ranked feed (see feed_ranking.sql). The database returns the
// next ids: brand-new unseen on top, other unseen next, already-seen last.
import {
  markSeen,
  flushSeen,
  startFeedSession,
  fetchRankedIds,
} from "../../utils/seenContent";

// NEW (duplicate fix): append `next` to `prev`, skipping any post whose id
// is already in `prev`. Used everywhere posts are added to the list.
const mergeUnique = (prev, next) => {
  const seen = new Set(prev.map((p) => p.id));
  return [...prev, ...next.filter((p) => !seen.has(p.id))];
};

// NEW (duplicate fix): put `post` at the top unless it's already in the list
// (e.g. the realtime INSERT event and handleNewPost both add your own post).
const prependUnique = (prev, post) =>
  prev.some((p) => p.id === post.id) ? prev : [post, ...prev];

// NEW: how many videos are fetched (then ordered) per refill of the
// video pool.
const VIDEO_POOL_SIZE = 30;

// NEW: HomeHub's Upload -> Post item opens the composer popup. When the
// Posts tab is already showing it fires OPEN_COMPOSER_EVENT; when it has
// to switch tabs first it leaves a timestamp in sessionStorage under
// OPEN_COMPOSER_FLAG (this component isn't mounted yet to hear an event),
// which is picked up on mount. The timestamp keeps a stale flag from
// popping the composer open much later.
const OPEN_COMPOSER_EVENT = "zx:open-composer";
const OPEN_COMPOSER_FLAG = "zx:open-composer";
const OPEN_COMPOSER_FLAG_MAX_AGE_MS = 5000;

// NEW: minimum time between two "Interested in <profile>?" popups, so
// scrolling through many new profiles doesn't nag.
const PROFILE_PROMPT_GAP_MS = 25000;

const PostFeed = ({ sideNavbar, currentUser: currentUserProp }) => {
  const location = useLocation();

  // NEW: the search term from the URL (?q=...). When present, the feed
  // switches from the shuffled "latest posts" mode to a filtered search.
  const searchQuery =
    new URLSearchParams(location.search).get("q")?.trim() || "";

  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState("");
  const [highlightedPostId, setHighlightedPostId] = useState(null);
  const [postNotFound, setPostNotFound] = useState(false);
  const [viewCounts, setViewCounts] = useState({});
  const PAGE_SIZE = 10;
  const offsetRef = useRef(0);
  const shuffledPoolRef = useRef([]);
  const [videos, setVideos] = useState([]);
  // NEW: keyset cursors ({ score, id }) for the server-ranked lists.
  const postCursorRef = useRef(null);
  const videoCursorRef = useRef(null);
  // NEW: new posts / videos that arrive live from other people are held
  // here and shown behind a "↑ N new" pill, so the page never jumps
  // while you're reading. Your own posts still go straight to the top.
  const pendingPostsRef = useRef([]);
  const pendingVideosRef = useRef([]);
  const [pendingCount, setPendingCount] = useState(0);

  // NEW: video pool + helpers.
  //  - videoPoolRef: videos fetched and ordered, waiting to be shown.
  //  - videoFetchChainRef: serialises fetchMoreVideos calls so loadMore
  //    and realtime inserts can't fill the pool twice at the same time.
  //  - videoEpochRef: bumped whenever the feed resets or a search
  //    starts, so an in-flight video fetch from the old feed is dropped.
  //  - shownVideoIdsRef: every video already handed to the feed this
  //    session, so the same video is never shown twice.
  //  - videosExhaustedRef: the whole catalogue has been walked once —
  //    stop fetching instead of wrapping around and repeating videos.
  const videoPoolRef = useRef([]);
  const videoFetchChainRef = useRef(Promise.resolve());
  const videoEpochRef = useRef(0);
  const shownVideoIdsRef = useRef(new Set());
  const videosExhaustedRef = useRef(false);

  // NEW: request counter — lets fetchPosts ignore a slow, outdated
  // response (e.g. results for "hulk" arriving after a newer search for
  // "thor") instead of letting it overwrite the newer results.
  const fetchSeqRef = useRef(0);

  // Search-mode extras: reels + uploaded videos matching the query.
  const [searchReels, setSearchReels] = useState([]);
  const [searchVideos, setSearchVideos] = useState([]);
  const [searchExtrasLoading, setSearchExtrasLoading] = useState(false);

  const currentUser = currentUserProp || "anonymous";
  const isLoggedIn = !!currentUser && currentUser !== "anonymous";

  // NEW (feedback): one instance serves posts, videos and reels. It's
  // passed down to PostCard, VideoFeedCard and ReelsStrip.
  const fb = useContentFeedback();

  // ────────────── NEW: PROFILE "INTERESTED?" POPUP ──────────────
  // The first time a post from a profile you haven't connected with (and
  // haven't answered for) is on screen, a small popup asks ONCE about that
  // PROFILE. "Not interested" hides that profile's posts and videos from
  // the feed (with Undo), "Interested" is remembered, ✕ snoozes it for 7
  // days. Own posts, connected people, and search results never prompt.
  const pfb = useProfileFeedback(currentUser);
  const [connectedUsers, setConnectedUsers] = useState(() => new Set());
  const [connectionsLoaded, setConnectionsLoaded] = useState(false);
  const [promptUser, setPromptUser] = useState(null);
  const [profileToast, setProfileToast] = useState(null);
  const postsRef = useRef([]);
  const liveRef = useRef({});
  const promptOpenRef = useRef(false);
  const lastPromptAtRef = useRef(0);

  useEffect(() => { postsRef.current = posts; }, [posts]);
  // Latest values for handlePostView, which must keep a stable identity
  // (PostCard re-arms its view tracking whenever onView changes).
  liveRef.current = {
    isLoggedIn,
    currentUser,
    searchQuery,
    connectedUsers,
    connectionsLoaded,
    pfb,
  };

  // Everyone you already have a connection (pending or accepted) with, in
  // either direction — they're not "new" profiles.
  useEffect(() => {
    setConnectionsLoaded(false);
    if (!isLoggedIn) {
      setConnectedUsers(new Set());
      return;
    }
    let cancelled = false;
    (async () => {
      const known = new Set();
      const userId = localStorage.getItem("userId");
      if (userId) {
        const { data } = await supabase
          .from("connections")
          .select("connected_to")
          .eq("connector_id", userId);
        (data || []).forEach((r) => r.connected_to && known.add(r.connected_to));
      }
      const { data: incoming } = await supabase
        .from("connections")
        .select("connector_username")
        .eq("connected_to", currentUser);
      (incoming || []).forEach(
        (r) => r.connector_username && known.add(r.connector_username)
      );
      if (!cancelled) {
        setConnectedUsers(known);
        setConnectionsLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isLoggedIn, currentUser]);

  const [sentinelNode, setSentinelNode] = useState(null);
  const loadingMoreRef = useRef(false);
  const hasMoreRef = useRef(true);
  const channelInstanceIdRef = useRef(Math.random().toString(36).slice(2));

  useEffect(() => { loadingMoreRef.current = loadingMore; }, [loadingMore]);
  useEffect(() => { hasMoreRef.current = hasMore; }, [hasMore]);

  // ────────────── NEW: POST COMPOSER POPUP ──────────────
  //  - composerMounted: becomes true the first time the popup opens and
  //    stays true, so PostComposer is never unmounted by closing. Closing
  //    only hides it (CSS), which keeps a half-written draft and any
  //    in-flight upload alive.
  //  - composerOpen: drives the pop-in / pop-out animation.
  const [composerMounted, setComposerMounted] = useState(false);
  const [composerOpen, setComposerOpen] = useState(false);

  const openComposer = useCallback(() => {
    setComposerMounted(true);
    setComposerOpen(true);
  }, []);

  const closeComposer = useCallback(() => setComposerOpen(false), []);

  // Open on HomeHub's "Upload -> Post" (event, or flag if we just mounted).
  useEffect(() => {
    const handleOpen = () => {
      if (!isLoggedIn) {
        window.dispatchEvent(new CustomEvent("openLogin"));
        return;
      }
      openComposer();
    };

    window.addEventListener(OPEN_COMPOSER_EVENT, handleOpen);

    try {
      const stamp = parseInt(sessionStorage.getItem(OPEN_COMPOSER_FLAG) || "0", 10);
      sessionStorage.removeItem(OPEN_COMPOSER_FLAG);
      if (stamp && Date.now() - stamp < OPEN_COMPOSER_FLAG_MAX_AGE_MS) {
        handleOpen();
      }
    } catch (_) { }

    return () => window.removeEventListener(OPEN_COMPOSER_EVENT, handleOpen);
  }, [isLoggedIn, openComposer]);

  // While open: lock page scroll, close on Esc, and focus the text box.
  useEffect(() => {
    if (!composerOpen) return;

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKey = (e) => {
      if (e.key === "Escape") setComposerOpen(false);
    };
    document.addEventListener("keydown", onKey);

    const focusTimer = setTimeout(
      () => window.dispatchEvent(new CustomEvent("zx:focus-composer")),
      90
    );

    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener("keydown", onKey);
      clearTimeout(focusTimer);
    };
  }, [composerOpen]);

  const POST_COMMENTS_SELECT =
    "id, text, username, created_at, liked_by, disliked_by, saved_by, parent_comment_id, attachment_url, attachment_type";

  const enrichPost = useCallback(
    (p) => ({
      ...p,
      myReaction:
        p.post_reactions?.find((r) => r.username === currentUser)?.type ||
        null,
      reactionCounts: p.post_reactions?.reduce((acc, r) => {
        acc[r.type] = (acc[r.type] || 0) + 1;
        return acc;
      }, {}),
      comments: (p.post_comments || []).sort(
        (a, b) => new Date(a.created_at) - new Date(b.created_at)
      ),
      showComments: false,
    }),
    [currentUser]
  );

  const fetchViewCounts = async (ids) => {
    if (!ids || !ids.length) return;
    try {
      const { data, error: err } = await supabase
        .from("views")
        .select("content_id")
        .eq("content_type", "post")
        .in("content_id", ids.map(String));
      const map = {};
      ids.forEach((id) => {
        map[String(id)] = 0;
      });
      if (!err && data) {
        data.forEach((r) => {
          map[r.content_id] = (map[r.content_id] || 0) + 1;
        });
      }
      setViewCounts((prev) => ({ ...prev, ...map }));
    } catch (_) { }
  };

  const incrementView = useCallback(async (postId) => {
    const storageKey = `lastViewed_post_${postId}`;
    const lastViewed = localStorage.getItem(storageKey);
    const now = Date.now();
    const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;
    if (lastViewed && now - parseInt(lastViewed, 10) < TWENTY_FOUR_HOURS)
      return;
    localStorage.setItem(storageKey, String(now));

    const key = String(postId);
    setViewCounts((prev) => ({ ...prev, [key]: (prev[key] ?? 0) + 1 }));

    try {
      const userId = localStorage.getItem("userId");
      if (!userId) return;
      await supabase.from("views").upsert(
        {
          user_id: userId,
          content_id: key,
          content_type: "post",
          viewed_at: new Date().toISOString(),
        },
        { onConflict: "user_id,content_id,content_type" },
      );
    } catch (_) { }
  }, []);

  // NEW: PostCard calls this once per card when it is ~60% on screen. It
  // still counts the view, and additionally decides whether to ask
  // "Interested in <profile>?" for that post's author.
  const handlePostView = useCallback(
    (postId) => {
      incrementView(postId);
      // NEW: remember it, so this post is never shown again after a refresh.
      // (Posts opened from a search result don't count as "seen" in the feed.)
      if (!liveRef.current.searchQuery) markSeen("post", postId);

      const live = liveRef.current;
      if (!live.isLoggedIn || live.searchQuery || !live.connectionsLoaded) return;

      const post = postsRef.current.find((p) => p.id === postId);
      const author = post?.username;
      if (!author || author === live.currentUser) return;
      if (live.connectedUsers.has(author)) return;
      if (!live.pfb.shouldAsk(author)) return;
      if (promptOpenRef.current) return;
      if (Date.now() - lastPromptAtRef.current < PROFILE_PROMPT_GAP_MS) return;

      lastPromptAtRef.current = Date.now();
      promptOpenRef.current = true;
      setPromptUser(author);
    },
    [incrementView]
  );

  const closePrompt = () => {
    promptOpenRef.current = false;
    setPromptUser(null);
  };

  const answerPrompt = (value) => {
    const username = promptUser;
    if (!username) return;
    pfb.set(username, value);
    closePrompt();
    setProfileToast({ username, value, key: Date.now() });
  };

  const dismissPrompt = () => {
    if (promptUser) pfb.snooze(promptUser);
    closePrompt();
  };

  const undoProfileFeedback = () => {
    if (profileToast) pfb.clear(profileToast.username);
    setProfileToast(null);
  };

  // CHANGED: videos now come from the server ranking (get_feed_ids):
  // brand-new unseen videos first, then other unseen, then seen — a
  // different shuffle every session. Pages are fetched with a keyset
  // cursor, so there is no offset drift. A video already handed to the
  // feed is never handed out again, and when the database has no more the
  // fetching simply stops (no wrap-around, no repeats).
  const fetchMoreVideos = useCallback((count) => {
    if (!count) return Promise.resolve();
    const epoch = videoEpochRef.current;

    const fillPool = async () => {
      let attempts = 0;
      while (
        videoPoolRef.current.length < count &&
        !videosExhaustedRef.current &&
        attempts++ < 2
      ) {
        let ranked;
        try {
          ranked = await fetchRankedIds("video", {
            limit: VIDEO_POOL_SIZE,
            cursor: videoCursorRef.current,
            seedOffset: 1000,
          });
        } catch (_) {
          break; // try again on the next call
        }
        if (epoch !== videoEpochRef.current) return;

        if (ranked.ids.length === 0) {
          videosExhaustedRef.current = true;
          break;
        }

        const { data, error: fetchErr } = await supabase
          .from("videos")
          .select("id, short_id, video_url, thumbnail_url, title, channel, username, duration, created_at")
          .in("id", ranked.ids);
        if (epoch !== videoEpochRef.current) return;
        if (fetchErr) break;

        const byId = new Map((data || []).map((v) => [String(v.id), v]));
        const mapped = ranked.ids
          .map((id) => byId.get(id))
          .filter(Boolean)
          .map((v) => ({
            id: v.id,
            short_id: v.short_id,
            src: v.video_url,
            thumbnail: v.thumbnail_url || null,
            title: v.title,
            duration: v.duration || "00:00",
            channel: v.channel,
            username: v.username || v.channel?.toLowerCase() || "unknown",
            created_at: v.created_at || null,
            likes: 0,
          }));

        const { data: likesData } = await supabase
          .from("likes")
          .select("content_id")
          .eq("content_type", "video")
          .in("content_id", mapped.map((v) => String(v.id)));
        if (epoch !== videoEpochRef.current) return;

        const likesMap = {};
        (likesData || []).forEach((row) => {
          likesMap[row.content_id] = (likesMap[row.content_id] || 0) + 1;
        });

        // Skip videos already shown this session or already queued.
        const known = new Set([
          ...shownVideoIdsRef.current,
          ...videoPoolRef.current.map((v) => String(v.id)),
        ]);
        const fresh = mapped
          .filter((v) => !known.has(String(v.id)))
          .map((v) => ({ ...v, likes: likesMap[String(v.id)] ?? 0 }));

        // Already in ranked order — just queue them.
        videoPoolRef.current = videoPoolRef.current.concat(fresh);

        videoCursorRef.current = ranked.next;
        if (ranked.done) videosExhaustedRef.current = true;
      }
    };

    // One fetch at a time, so loadMore + realtime inserts can't both
    // fill the pool simultaneously.
    videoFetchChainRef.current = videoFetchChainRef.current
      .then(async () => {
        if (epoch !== videoEpochRef.current) return;
        await fillPool();
        if (epoch !== videoEpochRef.current) return;
        const batch = videoPoolRef.current.splice(0, count);
        if (batch.length) {
          batch.forEach((v) => shownVideoIdsRef.current.add(String(v.id)));
          setVideos((prev) => [...prev, ...batch]);
        }
      })
      .catch(() => { });

    return videoFetchChainRef.current;
  }, []);

  // NEW: reset all video bookkeeping (feed reset or a search starting).
  const resetVideoState = useCallback(() => {
    videoEpochRef.current += 1;
    videoPoolRef.current = [];
    videoCursorRef.current = null;
    videosExhaustedRef.current = false;
    shownVideoIdsRef.current = new Set();
    pendingPostsRef.current = [];
    pendingVideosRef.current = [];
    setPendingCount(0);
    setVideos([]);
  }, []);

  const fetchPosts = useCallback(async (reset = false) => {
    // NEW: each call gets a ticket; only the newest ticket may update state.
    const seq = ++fetchSeqRef.current;
    // NEW (duplicate fix): true once a newer fetch has started. Checked after
    // EVERY await, BEFORE touching offsetRef / shuffledPoolRef, so an
    // outdated call can no longer pollute the shared pool.
    const stale = () => seq !== fetchSeqRef.current;

    try {
      // ────────────── NEW: SEARCH MODE ──────────────
      // When a search query is present, skip the shuffled pool entirely
      // and fetch matching posts straight from the DB, newest first,
      // paginated by PAGE_SIZE.
      if (searchQuery) {
        if (reset) {
          offsetRef.current = 0;
          shuffledPoolRef.current = [];
          setHasMore(true);
        }

        // Strip characters that would break PostgREST's .or() syntax.
        const safe = searchQuery.replace(/[%,()*]/g, " ").trim();
        const offset = offsetRef.current;

        const { data, error: fetchErr } = await supabase
          .from("posts")
          .select(`
            *,
            post_reactions ( type, username ),
            post_comments ( ${POST_COMMENTS_SELECT} )
          `)
          .or(`text.ilike.%${safe}%,username.ilike.%${safe}%`)
          .order("created_at", { ascending: false })
          .range(offset, offset + PAGE_SIZE - 1);

        // NEW: a newer search/fetch started while this one was in flight.
        if (stale()) return;
        if (fetchErr) throw fetchErr;

        const page = (data || []).map(enrichPost);
        offsetRef.current += page.length;
        setHasMore(page.length === PAGE_SIZE);
        // CHANGED: dedupe when appending.
        setPosts((prev) => (reset ? page : mergeUnique(prev, page)));

        // CHANGED: also invalidate any in-flight / queued feed videos.
        resetVideoState();

        fetchViewCounts(page.map((p) => p.id));
        return; // `finally` below still clears loading flags
      }

      // ────────────── NORMAL FEED (server-ranked) ──────────────
      // The database decides the order (see feed_ranking.sql): brand-new
      // unseen posts pinned on top, then other unseen, then already-seen,
      // with a fresh shuffle every session. We get ids + a keyset cursor,
      // then load the full rows (reactions, comments) for just those ids.
      if (reset) {
        offsetRef.current = 0;
        shuffledPoolRef.current = [];
        // Make sure everything seen so far is saved, then start a new
        // session (new seed + new "seen before" cut-off).
        await flushSeen();
        if (stale()) return;
        startFeedSession();
        postCursorRef.current = null;
        setHasMore(true);
      }

      const ranked = await fetchRankedIds("post", {
        limit: PAGE_SIZE,
        cursor: postCursorRef.current,
      });
      if (stale()) return;

      let rows = [];
      if (ranked.ids.length > 0) {
        const { data, error: fetchErr } = await supabase
          .from("posts")
          .select(`
            *,
            post_reactions ( type, username ),
            post_comments ( ${POST_COMMENTS_SELECT} )
          `)
          .in("id", ranked.ids);
        if (stale()) return;
        if (fetchErr) throw fetchErr;
        rows = data || [];
      }

      // Keep the server's order, and drop anything already on screen.
      const byId = new Map(rows.map((p) => [String(p.id), p]));
      const onScreen = new Set(
        (reset ? [] : postsRef.current).map((p) => String(p.id)),
      );
      const page = ranked.ids
        .map((id) => byId.get(id))
        .filter((p) => p && !onScreen.has(String(p.id)))
        .map(enrichPost);

      postCursorRef.current = ranked.next;
      setHasMore(!ranked.done);

      if (reset) {
        setPosts(page);
        // CHANGED: cancel any in-flight video fetch from the previous
        // feed and clear the video pool / shown list.
        resetVideoState();
        fetchMoreVideos(page.length);
      } else {
        // CHANGED: dedupe when appending. Only ask for as many videos as
        // posts that were actually added, so the two lists stay in step.
        const before = postsRef.current;
        const merged = mergeUnique(before, page);
        setPosts((prev) => mergeUnique(prev, page));
        fetchMoreVideos(Math.max(merged.length - before.length, 0) || page.length);
      }

      fetchViewCounts(page.map((p) => p.id));
    } catch (err) {
      setError(err.message || "Failed to load posts.");
    } finally {
      // CHANGED: only the newest request clears the loading flags, so an
      // outdated response can't hide the skeleton of a newer one.
      if (seq === fetchSeqRef.current) {
        setLoading(false);
        setLoadingMore(false);
      }
    }
  }, [enrichPost, fetchMoreVideos, resetVideoState, searchQuery]);

  // Search mode: also look up reels and uploaded videos (YouTube is
  // intentionally NOT searched here). Posts are handled by fetchPosts.
  useEffect(() => {
    if (!searchQuery) {
      setSearchReels([]);
      setSearchVideos([]);
      setSearchExtrasLoading(false);
      return;
    }

    let cancelled = false;
    const safe = searchQuery.replace(/[%,()*]/g, " ").trim();
    const lowerQ = searchQuery.toLowerCase();

    const run = async () => {
      setSearchExtrasLoading(true);
      try {
        const [reelsRes, videosRes] = await Promise.all([
          supabase
            .from("reels")
            .select("*")
            .or(
              `title.ilike.%${safe}%,description.ilike.%${safe}%,username.ilike.%${safe}%,song.ilike.%${safe}%`
            )
            .order("created_at", { ascending: false })
            .limit(40),
          supabase
            .from("videos")
            .select(
              "id, short_id, video_url, thumbnail_url, title, channel, username, duration, created_at"
            )
            .or(
              `title.ilike.%${safe}%,channel.ilike.%${safe}%,username.ilike.%${safe}%`
            )
            .order("created_at", { ascending: false })
            .limit(30),
        ]);

        if (cancelled) return;

        // Reels: DB rows matched on text columns; also catch tag matches
        // (tags is an array, so it's filtered client-side from recent reels).
        let reels = reelsRes.data || [];
        if (!reelsRes.error) {
          const { data: recent } = await supabase
            .from("reels")
            .select("*")
            .order("created_at", { ascending: false })
            .limit(300);
          const tagMatches = (recent || []).filter((r) =>
            (r.tags || []).some((t) => String(t).toLowerCase().includes(lowerQ))
          );
          const seen = new Set(reels.map((r) => r.id));
          tagMatches.forEach((r) => {
            if (!seen.has(r.id)) reels.push(r);
          });
        }

        setSearchReels(
          reels.map((r) => ({
            id: r.id,
            video: r.video_url,
            thumbnail: r.thumbnail || null,
            caption: r.title || r.description || "Untitled",
            username: r.username || "unknown",
          }))
        );

        const vids = (videosRes.data || []).map((v) => ({
          id: v.id,
          short_id: v.short_id,
          src: v.video_url,
          thumbnail: v.thumbnail_url || null,
          title: v.title,
          duration: v.duration || "00:00",
          channel: v.channel,
          username: v.username || v.channel?.toLowerCase() || "unknown",
          created_at: v.created_at || null,
          likes: 0,
        }));

        if (vids.length > 0) {
          const { data: likesData } = await supabase
            .from("likes")
            .select("content_id")
            .eq("content_type", "video")
            .in("content_id", vids.map((v) => String(v.id)));
          if (likesData) {
            const likesMap = {};
            likesData.forEach((row) => {
              likesMap[row.content_id] = (likesMap[row.content_id] || 0) + 1;
            });
            vids.forEach((v) => {
              v.likes = likesMap[String(v.id)] ?? 0;
            });
          }
        }

        if (!cancelled) setSearchVideos(vids);
      } catch (err) {
        console.error("Search extras error:", err.message || err);
        if (!cancelled) {
          setSearchReels([]);
          setSearchVideos([]);
        }
      } finally {
        if (!cancelled) setSearchExtrasLoading(false);
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [searchQuery]);

  const loadMore = useCallback(() => {
    if (loadingMoreRef.current || !hasMoreRef.current) return;
    // CHANGED (duplicate fix): lock IMMEDIATELY. The ref used to be updated
    // only by an effect after the next render, so the IntersectionObserver
    // could fire twice before the lock took effect.
    loadingMoreRef.current = true;
    setLoadingMore(true);
    fetchPosts(false);
  }, [fetchPosts]);

  const handleRealtimeInsert = useCallback(
    async (payload) => {
      // NEW: while searching, don't inject unrelated new posts into
      // the filtered results.
      if (searchQuery) return;

      const newId = payload.new?.id;
      if (!newId) return;

      // NEW (duplicate fix): if handleNewPost already added this post
      // (your own upload), don't fetch + add it again.
      if (postsRef.current.some((p) => p.id === newId)) return;

      const { data, error: fetchErr } = await supabase
        .from("posts")
        .select(`
          *,
          post_reactions ( type, username ),
          post_comments ( ${POST_COMMENTS_SELECT} )
        `)
        .eq("id", newId)
        .maybeSingle();

      if (fetchErr || !data) return;

      const enrichedPost = enrichPost(data);

      // Already in the list? (the post may have been added while the
      // fetch above was in flight.)
      if (postsRef.current.some((p) => p.id === newId)) return;

      if (data.username === currentUser) {
        // Your own post: straight to the top, as before.
        setPosts((prev) => prependUnique(prev, enrichedPost));
        fetchMoreVideos(1);
        fetchViewCounts([newId]);
        return;
      }

      // Someone else's post: hold it behind the "↑ N new" pill.
      if (pendingPostsRef.current.some((p) => p.id === newId)) return;
      pendingPostsRef.current = [...pendingPostsRef.current, enrichedPost];
      setPendingCount(
        pendingPostsRef.current.length + pendingVideosRef.current.length
      );
    },
    [enrichPost, fetchMoreVideos, searchQuery, currentUser]
  );

  // NEW: a video uploaded while the feed is open goes straight to the top
  // of the video list (it pairs with the first post). Needs Realtime to be
  // enabled for the `videos` table in Supabase.
  const handleVideoInsert = useCallback(
    (payload) => {
      if (searchQuery) return;
      const row = payload.new;
      if (!row?.id) return;
      const key = String(row.id);
      if (shownVideoIdsRef.current.has(key)) return;

      const v = {
        id: row.id,
        short_id: row.short_id,
        src: row.video_url,
        thumbnail: row.thumbnail_url || null,
        title: row.title,
        duration: row.duration || "00:00",
        channel: row.channel,
        username: row.username || row.channel?.toLowerCase() || "unknown",
        created_at: row.created_at || null,
        likes: 0,
      };

      // Hold it behind the "↑ N new" pill (applied by applyPending).
      if (pendingVideosRef.current.some((x) => String(x.id) === key)) return;
      pendingVideosRef.current = [...pendingVideosRef.current, v];
      setPendingCount(
        pendingPostsRef.current.length + pendingVideosRef.current.length
      );
    },
    [searchQuery]
  );

  // NEW: the "↑ N new" pill — put everything that arrived on top, newest
  // first, and scroll to the top.
  const applyPending = useCallback(() => {
    const newPosts = pendingPostsRef.current;
    const newVideos = pendingVideosRef.current;
    pendingPostsRef.current = [];
    pendingVideosRef.current = [];
    setPendingCount(0);

    if (newPosts.length > 0) {
      setPosts((prev) => {
        let out = prev;
        newPosts.forEach((p) => {
          out = prependUnique(out, p);
        });
        return out;
      });
      fetchViewCounts(newPosts.map((p) => p.id));
      // keep posts and videos paired one-to-one
      fetchMoreVideos(newPosts.length);
    }

    if (newVideos.length > 0) {
      const keys = new Set(newVideos.map((v) => String(v.id)));
      keys.forEach((k) => shownVideoIdsRef.current.add(k));
      // If any of them was already queued in the pool, drop that copy.
      videoPoolRef.current = videoPoolRef.current.filter(
        (x) => !keys.has(String(x.id))
      );
      setVideos((prev) => {
        const have = new Set(prev.map((x) => String(x.id)));
        const add = newVideos.filter((v) => !have.has(String(v.id)));
        // newest first
        return [...add.reverse(), ...prev];
      });
    }

    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [fetchMoreVideos]);

  useEffect(() => {
    // NEW: show the skeleton again whenever the query changes
    // (fetchPosts changes identity when searchQuery changes).
    setLoading(true);
    setError("");
    fetchPosts(true);

    const channel = supabase
      .channel(`posts-realtime-${channelInstanceIdRef.current}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "posts" },
        handleRealtimeInsert
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "posts" },
        (payload) => {
          const deletedId = payload.old?.id;
          if (deletedId) {
            setPosts((prev) => prev.filter((p) => p.id !== deletedId));
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "videos" },
        handleVideoInsert
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [fetchPosts, handleRealtimeInsert, handleVideoInsert]);

  useEffect(() => {
    if (!sentinelNode) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          loadMore();
        }
      },
      { rootMargin: "600px" }
    );

    observer.observe(sentinelNode);
    return () => observer.disconnect();
  }, [sentinelNode, loadMore]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const sharedPostId = params.get("post");
    if (!sharedPostId) {
      setPostNotFound(false);
      return;
    }

    setHighlightedPostId(sharedPostId);

    // NEW: while searching, don't add the shared post into the filtered
    // results (it may not match the query).
    if (searchQuery) return;

    const ensurePostLoaded = async () => {
      const { data, error: fetchErr } = await supabase
        .from("posts")
        .select(`
          *,
          post_reactions ( type, username ),
          post_comments ( ${POST_COMMENTS_SELECT} )
        `)
        .eq("id", sharedPostId)
        .maybeSingle();

      if (fetchErr || !data) {
        setPostNotFound(true);
        return;
      }
      setPostNotFound(false);

      const enrichedPost = enrichPost(data);

      setPosts((current) => {
        if (current.some((p) => String(p.id) === String(sharedPostId)))
          return current;
        return [enrichedPost, ...current];
      });

      fetchViewCounts([sharedPostId]);
    };

    ensurePostLoaded();
  }, [location.search, currentUser, enrichPost, searchQuery]);

  const scrolledForIdRef = useRef(null);
  useEffect(() => {
    if (!highlightedPostId) {
      scrolledForIdRef.current = null;
      return;
    }
    if (scrolledForIdRef.current === highlightedPostId) return;

    const el = document.getElementById(`post-${highlightedPostId}`);
    if (el) {
      scrolledForIdRef.current = highlightedPostId;
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      el.classList.add("pf-highlighted");
      const timer = setTimeout(() => el.classList.remove("pf-highlighted"), 3000);
      return () => clearTimeout(timer);
    }
  }, [posts, highlightedPostId]);

  const handleNewPost = async (post) => {
    // CHANGED: dedupe — the realtime INSERT listener may add it too.
    setPosts((prev) => prependUnique(prev, post));
    fetchViewCounts([post.id]);

    const uploaderUsername = currentUser;
    await notifyConnections(uploaderUsername, {
      type: "upload",
      message: `${uploaderUsername} made a new post: "${post.text?.slice(0, 60) || "Check it out"}"`,
      contentId: post.id,
      contentType: "post",
    });

    extractMentions(post.text).forEach((mentioned) => {
      if (mentioned === uploaderUsername) return;
      notifyUser({
        recipientUsername: mentioned,
        senderUsername: uploaderUsername,
        type: "mention",
        message: `${uploaderUsername} mentioned you in a post`,
        contentId: post.id,
        contentType: "post",
      });
    });
  };

  // NEW: the popup's onPost — pop the composer out first, then run the
  // normal new-post handling (feed insert + notifications).
  const handlePostFromComposer = async (post) => {
    closeComposer();
    await handleNewPost(post);
  };

  const handleReaction = async (postId, reactionType) => {
    if (!currentUser || currentUser === "anonymous") {
      window.dispatchEvent(new CustomEvent("openLogin"));
      return;
    }
    const post = posts.find((p) => p.id === postId);
    if (!post) return;

    const prev = post.myReaction;

    setPosts((all) =>
      all.map((p) => {
        if (p.id !== postId) return p;
        const counts = { ...p.reactionCounts };
        if (prev) counts[prev] = Math.max(0, (counts[prev] || 1) - 1);
        const next = prev === reactionType ? null : reactionType;
        if (next) counts[next] = (counts[next] || 0) + 1;
        return { ...p, myReaction: next, reactionCounts: counts };
      })
    );

    try {
      if (prev) {
        await supabase
          .from("post_reactions")
          .delete()
          .eq("post_id", postId)
          .eq("username", currentUser);
      }
      if (prev !== reactionType) {
        await supabase
          .from("post_reactions")
          .insert({ post_id: postId, username: currentUser, type: reactionType });

        if (post.username && post.username !== currentUser) {
          notifyUser({
            recipientUsername: post.username,
            senderUsername: currentUser,
            type: "like",
            message: `${currentUser} reacted to your post`,
            contentId: postId,
            contentType: "post",
          });
        }
      }
    } catch {
      fetchPosts(true);
    }
  };

  const handleComment = async (postId, text, parentId = null, attachment = null) => {
    if (!currentUser || currentUser === "anonymous") {
      window.dispatchEvent(new CustomEvent("openLogin"));
      return;
    }
    if (!text.trim() && !attachment) return;

    const post = posts.find((p) => p.id === postId);
    const parentComment = parentId
      ? post?.comments.find((c) => c.id === parentId)
      : null;

    const { data, error: err } = await supabase
      .from("post_comments")
      .insert({
        post_id: postId,
        username: currentUser,
        text: text.trim() || null,
        parent_comment_id: parentId,
        attachment_url: attachment?.url || null,
        attachment_type: attachment?.type || null,
      })
      .select()
      .single();
    if (err) return;
    setPosts((all) =>
      all.map((p) =>
        p.id === postId
          ? { ...p, comments: [...p.comments, data], showComments: true }
          : p
      )
    );

    if (
      parentComment?.username &&
      parentComment.username !== currentUser
    ) {
      notifyUser({
        recipientUsername: parentComment.username,
        senderUsername: currentUser,
        type: "comment",
        message: `${currentUser} replied to your comment: "${text.trim().slice(0, 60) || (attachment ? (attachment.type === "sticker" ? "🏷️ Sticker" : "🎬 GIF") : "")}"`,
        contentId: postId,
        contentType: "post",
      });
    }

    if (
      post?.username &&
      post.username !== currentUser &&
      post.username !== parentComment?.username
    ) {
      notifyUser({
        recipientUsername: post.username,
        senderUsername: currentUser,
        type: "comment",
        message: `${currentUser} commented on your post: "${text.trim().slice(0, 60) || (attachment ? (attachment.type === "sticker" ? "🏷️ Sticker" : "🎬 GIF") : "")}"`,
        contentId: postId,
        contentType: "post",
      });
    }

    if (text.trim()) {
      extractMentions(text).forEach((mentioned) => {
        if (
          mentioned === currentUser ||
          mentioned === post?.username ||
          mentioned === parentComment?.username
        )
          return;
        notifyUser({
          recipientUsername: mentioned,
          senderUsername: currentUser,
          type: "mention",
          message: `${currentUser} mentioned you in a comment: "${text.trim().slice(0, 60)}"`,
          contentId: postId,
          contentType: "post",
        });
      });
    }
  };

  const handleCommentReaction = async (postId, commentId, type) => {
    if (!currentUser || currentUser === "anonymous") {
      window.dispatchEvent(new CustomEvent("openLogin"));
      return;
    }

    const post = posts.find((p) => p.id === postId);
    const comment = post?.comments.find((c) => c.id === commentId);
    if (!comment) return;

    const likedBy = comment.liked_by || [];
    const dislikedBy = comment.disliked_by || [];

    const isLike = type === "like";
    const sameList = isLike ? likedBy : dislikedBy;
    const otherList = isLike ? dislikedBy : likedBy;
    const alreadyActive = sameList.includes(currentUser);

    const nextSameList = alreadyActive
      ? sameList.filter((u) => u !== currentUser)
      : [...sameList, currentUser];
    const nextOtherList = otherList.filter((u) => u !== currentUser);

    const nextLikedBy = isLike ? nextSameList : nextOtherList;
    const nextDislikedBy = isLike ? nextOtherList : nextSameList;

    setPosts((all) =>
      all.map((p) =>
        p.id !== postId
          ? p
          : {
            ...p,
            comments: p.comments.map((c) =>
              c.id === commentId
                ? { ...c, liked_by: nextLikedBy, disliked_by: nextDislikedBy }
                : c
            ),
          }
      )
    );

    const { error: err } = await supabase
      .from("post_comments")
      .update({ liked_by: nextLikedBy, disliked_by: nextDislikedBy })
      .eq("id", commentId);

    if (err) {
      fetchPosts(true);
      return;
    }

    if (
      isLike &&
      !alreadyActive &&
      comment.username &&
      comment.username !== currentUser
    ) {
      notifyUser({
        recipientUsername: comment.username,
        senderUsername: currentUser,
        type: "like",
        message: `${currentUser} liked your comment`,
        contentId: postId,
        contentType: "post",
      });
    }
  };

  const handleSaveComment = async (postId, commentId) => {
    if (!currentUser || currentUser === "anonymous") {
      window.dispatchEvent(new CustomEvent("openLogin"));
      return;
    }
    const post = posts.find((p) => p.id === postId);
    const comment = post?.comments.find((c) => c.id === commentId);
    if (!comment) return;

    const savedBy = comment.saved_by || [];
    const isSaved = savedBy.includes(currentUser);
    const nextSavedBy = isSaved
      ? savedBy.filter((u) => u !== currentUser)
      : [...savedBy, currentUser];

    setPosts((all) =>
      all.map((p) =>
        p.id !== postId
          ? p
          : {
            ...p,
            comments: p.comments.map((c) =>
              c.id === commentId ? { ...c, saved_by: nextSavedBy } : c,
            ),
          },
      ),
    );

    const { error: err } = await supabase
      .from("post_comments")
      .update({ saved_by: nextSavedBy })
      .eq("id", commentId);

    if (err) fetchPosts(true);
  };

  const handleToggleComments = (postId) => {
    setPosts((all) =>
      all.map((p) =>
        p.id === postId ? { ...p, showComments: !p.showComments } : p
      )
    );
  };

  const handleShare = async (postId) => {
    if (!currentUser || currentUser === "anonymous") {
      window.dispatchEvent(new CustomEvent("openLogin"));
      return;
    }
    const post = posts.find((p) => p.id === postId);
    if (!post) return;

    setError("");
    try {
      const { data, error: err } = await supabase
        .from("posts")
        .insert({
          username: currentUser,
          text: `Shared: "${post.text?.slice(0, 120) || ""}"`,
          image_url: post.image_url || null,
          image_urls: post.image_urls && post.image_urls.length > 0 ? post.image_urls : null,
          video_url: post.video_url || null,
          feeling: post.feeling || null,
          link: post.link || null,
          privacy: "public",
          shared_from: postId,
        })
        .select()
        .single();

      if (err) throw err;

      // CHANGED: dedupe — the realtime INSERT listener may add it too.
      setPosts((prev) =>
        prependUnique(prev, {
          ...data,
          myReaction: null,
          reactionCounts: {},
          comments: [],
          showComments: false,
        })
      );

      fetchViewCounts([data.id]);
    } catch (err) {
      console.error("Share to feed failed:", err);
      setError(
        err.message ||
        "Couldn't share this post. Please try again."
      );
    }
  };

  const handleReportPost = async (postId, reason, details) => {
    const post = posts.find((p) => p.id === postId);

    const { error: err } = await supabase.from("reports").insert({
      content_type: "post",
      content_id: postId,
      content_title: post?.text?.slice(0, 80) || "Post",
      content_owner: post?.username || "unknown",
      reporter_username: currentUser,
      reason,
      details: details || null,
      status: "pending",
    });

    if (err) throw err;
  };

  const handleDeletePost = async (postId) => {
    setPosts((all) => all.filter((p) => p.id !== postId));

    const { error: delErr } = await supabase
      .from("posts")
      .delete()
      .eq("id", postId)
      .eq("username", currentUser);

    if (delErr) {
      fetchPosts(true);
    }
  };

  const handleEditPost = async (postId, updates) => {
    const { data, error: editErr } = await supabase
      .from("posts")
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq("id", postId)
      .eq("username", currentUser)
      .select()
      .single();

    if (editErr) {
      setError(editErr.message || "Failed to update post.");
      return;
    }

    setPosts((all) =>
      all.map((p) => (p.id === postId ? { ...p, ...data } : p))
    );
  };

  // Profiles = distinct usernames matching the query across posts, reels
  // and videos (only computed in search mode).
  const searchProfiles = searchQuery
    ? [
      ...new Set(
        [
          ...posts.map((p) => p.username),
          ...searchReels.map((r) => r.username),
          ...searchVideos.map((v) => v.username),
        ].filter(
          (u) =>
            u &&
            u !== "unknown" &&
            u.toLowerCase().includes(searchQuery.toLowerCase())
        )
      ),
    ]
    : [];

  const noSearchResults =
    searchQuery &&
    !searchExtrasLoading &&
    posts.length === 0 &&
    searchReels.length === 0 &&
    searchVideos.length === 0;

  // NEW (feedback): hide anything marked "Not interested". Not applied in
  // search mode, so people can still find what they search for. Videos are
  // paired with posts by index, so the video list is filtered separately.
  // NEW: profiles answered "Not interested" are hidden too (posts + videos).
  const visiblePosts = searchQuery
    ? posts
    : posts.filter(
      (p) => !fb.isHidden("post", p.id) && !pfb.isHidden(p.username)
    );
  const visibleVideos = videos.filter(
    (v) => !fb.isHidden("video", v.id) && !pfb.isHidden(v.username)
  );

  // NEW: the Post Composer popup. Rendered through a portal into <body>
  // so it sits above the navbar/sidebar and escapes the feed's overflow
  // and the `.pf-feed > *` / `.pf-feed .pf-composer` layout rules. It is
  // included in both the loading and the loaded return below, so opening
  // it from Home (which mounts this feed fresh) pops in immediately
  // instead of waiting for the skeleton to finish.
  const composerModal =
    composerMounted && isLoggedIn
      ? createPortal(
        <div
          className={`pf-modal-overlay${composerOpen ? " open" : ""}`}
          aria-hidden={!composerOpen}
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) closeComposer();
          }}
        >
          <div
            className="pf-modal-panel"
            role="dialog"
            aria-modal="true"
            aria-label="Create post"
          >
            <div className="pf-modal-header">
              <span className="pf-modal-title">Create post</span>
              <button
                type="button"
                className="pf-modal-close"
                onClick={closeComposer}
                aria-label="Close"
              >
                ✕
              </button>
            </div>
            <PostComposer
              currentUser={currentUser}
              onPost={handlePostFromComposer}
            />
          </div>
        </div>,
        document.body
      )
      : null;

  if (loading) {
    return (
      <>
        <div className={`pf-feed${!sideNavbar ? " sidebar-closed" : ""}`}>
          {[1, 2, 3].map((i) => (
            <div className="pf-skeleton" key={i}>
              <div className="pf-skeleton-avatar" />
              <div className="pf-skeleton-lines">
                <div className="pf-skeleton-line" style={{ width: "40%" }} />
                <div className="pf-skeleton-line" style={{ width: "70%" }} />
                <div className="pf-skeleton-line" style={{ width: "55%" }} />
              </div>
            </div>
          ))}
        </div>
        {composerModal}
      </>
    );
  }

  return (
    <>
      <div className={`pf-feed${!sideNavbar ? " sidebar-closed" : ""}`}>
        {/* Search banner shown only while a query is active */}
        {searchQuery && (
          <div
            className="pf-search-banner"
            style={{
              padding: "10px 4px 14px",
              fontSize: "15px",
              fontWeight: 600,
            }}
          >
            🔍 Results for "{searchQuery}"
            <span style={{ marginLeft: 8, fontSize: 13, opacity: 0.6 }}>
              {searchProfiles.length} profiles · {searchReels.length} reels ·{" "}
              {searchVideos.length} videos · {posts.length}
              {hasMore ? "+" : ""} posts
            </span>
          </div>
        )}

        {/* CHANGED: the inline composer is replaced by a compact trigger
            that opens the composer popup (same popup as Home Hub's
            Upload -> Post). Hidden while searching. */}
        {!searchQuery &&
          (isLoggedIn ? (
            <button
              type="button"
              className="pf-compose-trigger"
              onClick={openComposer}
            >
              <span className="pf-avatar">
                {currentUser.slice(0, 2).toUpperCase()}
              </span>
              <span className="pf-compose-trigger-text">
                What's on your mind, {currentUser}?
              </span>
              <span className="pf-compose-trigger-icons" aria-hidden="true">
                📷 🎥
              </span>
            </button>
          ) : (
            <div
              style={{
                background: "#1a1a1a",
                border: "1px solid #333",
                borderRadius: "12px",
                padding: "20px",
                textAlign: "center",
                marginBottom: "16px",
              }}
            >
              <p style={{ color: "#aaa", fontSize: "14px", margin: "0 0 12px" }}>
                🔒 Please log in to post
              </p>
              <button
                onClick={() =>
                  window.dispatchEvent(new CustomEvent("openLogin"))
                }
                style={{
                  background: "#ff0000",
                  color: "white",
                  border: "none",
                  borderRadius: "8px",
                  padding: "8px 24px",
                  fontSize: "14px",
                  fontWeight: "600",
                  cursor: "pointer",
                }}
              >
                Login
              </button>
            </div>
          ))}

        {/* NEW: Stories strip — sits directly below the composer trigger.
            "Create story" card + one card per person with a live (<24h)
            story. Hidden while searching. Logged-out visitors can still
            watch stories; "Create story" prompts login. */}
        {!searchQuery && <StoriesStrip currentUser={currentUser} />}

        {/* NEW: Live streams — the same 🔴 Live section the Home page
            shows (LiveBrowser). Sits between Stories and the suggested
            connections, and is hidden while searching, like Stories. */}
        {!searchQuery && (
          <div style={{ marginBottom: "28px" }}>
            <LiveBrowser currentUser={isLoggedIn ? currentUser : ""} />
          </div>
        )}

        {!searchQuery && <SuggestedConnections variant="feed" />}

        {error && <p className="pf-error">{error}</p>}
        {postNotFound && (
          <p className="pf-error">
            That post isn't available anymore — it may have been deleted, or the link is incorrect.
          </p>
        )}

        {/* ── SEARCH: PROFILES ── */}
        {searchQuery && searchProfiles.length > 0 && (
          <div style={{ marginBottom: 24 }}>
            <h3 style={{ fontSize: 15, margin: "0 0 10px", opacity: 0.7 }}>
              👤 Profiles
            </h3>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              {searchProfiles.map((u) => (
                <Link
                  key={u}
                  to={`/user/${u}`}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "8px 14px",
                    borderRadius: 20,
                    background: "#fff",
                    border: "1px solid #f3c6c6",
                    textDecoration: "none",
                    color: "inherit",
                    fontSize: 13,
                    fontWeight: 600,
                  }}
                >
                  <img
                    src={`https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(u)}`}
                    alt={u}
                    style={{ width: 28, height: 28, borderRadius: "50%" }}
                  />
                  @{u}
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* ── SEARCH: REELS ── */}
        {searchQuery && searchReels.length > 0 && (
          <div style={{ marginBottom: 24 }}>
            <h3 style={{ fontSize: 15, margin: "0 0 10px", opacity: 0.7 }}>
              🎞️ Reels
            </h3>
            <div style={{ display: "flex", gap: 12, overflowX: "auto", paddingBottom: 8 }}>
              {searchReels.map((reel) => (
                <Link
                  key={reel.id}
                  to={`/reels/db_${reel.id}`}
                  style={{ textDecoration: "none", color: "inherit", flexShrink: 0 }}
                >
                  <div
                    style={{
                      width: 150,
                      borderRadius: 12,
                      overflow: "hidden",
                      background: "#fff",
                      border: "1px solid #f3c6c6",
                    }}
                  >
                    {/* CHANGED: was a <video preload="metadata"> per result
                        (up to 40 at once). Now a plain thumbnail when there
                        is one, otherwise AutoPlayVideo, which only loads
                        once the card is near the screen and only fetches
                        metadata. */}
                    <div
                      style={{
                        position: "relative",
                        width: "100%",
                        height: 260,
                        background: "#222",
                      }}
                    >
                      {reel.thumbnail ? (
                        <img
                          src={reel.thumbnail}
                          alt=""
                          loading="lazy"
                          style={{
                            width: "100%",
                            height: "100%",
                            objectFit: "cover",
                            display: "block",
                          }}
                        />
                      ) : (
                        <AutoPlayVideo
                          src={reel.video}
                          active={false}
                          preloadMode="metadata"
                        />
                      )}
                    </div>
                    <div style={{ padding: 8 }}>
                      <div
                        style={{
                          fontSize: 12,
                          fontWeight: 600,
                          display: "-webkit-box",
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: "vertical",
                          overflow: "hidden",
                        }}
                      >
                        {reel.caption}
                      </div>
                      <div style={{ fontSize: 11, opacity: 0.6, marginTop: 4 }}>
                        @{reel.username}
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* ── SEARCH: VIDEOS ── */}
        {searchQuery && searchVideos.length > 0 && (
          <div style={{ marginBottom: 24 }}>
            <h3 style={{ fontSize: 15, margin: "0 0 10px", opacity: 0.7 }}>
              🎬 Videos
            </h3>
            {searchVideos.map((v) => (
              <VideoFeedCard key={v.id} video={v} fb={fb} />
            ))}
          </div>
        )}

        {searchQuery && searchExtrasLoading && (
          <p style={{ fontSize: 13, opacity: 0.6 }}>Searching reels and videos…</p>
        )}

        {searchQuery && posts.length > 0 && (
          <h3 style={{ fontSize: 15, margin: "0 0 10px", opacity: 0.7 }}>
            📱 Posts
          </h3>
        )}

        {/* ── EMPTY STATES ── */}
        {noSearchResults && (
          <div className="pf-empty">
            <span className="pf-empty-icon">🔍</span>
            <p>No results found for "{searchQuery}"</p>
          </div>
        )}

        {!searchQuery && posts.length === 0 && !loading && (
          <div className="pf-empty">
            <span className="pf-empty-icon">📭</span>
            <p>You're all caught up. New posts will show up here — or be the first to share something!</p>
          </div>
        )}

        {visiblePosts.map((post, index) => (
          <React.Fragment key={post.id}>
            <div id={`post-${post.id}`}>
              <PostCard
                post={post}
                currentUser={currentUser}
                onReaction={handleReaction}
                onComment={handleComment}
                onToggleComments={handleToggleComments}
                onShare={handleShare}
                onDelete={handleDeletePost}
                onEdit={handleEditPost}
                onReport={handleReportPost}
                onLikeComment={(postId, commentId) =>
                  handleCommentReaction(postId, commentId, "like")
                }
                onDislikeComment={(postId, commentId) =>
                  handleCommentReaction(postId, commentId, "dislike")
                }
                onSaveComment={handleSaveComment}
                viewCount={viewCounts[String(post.id)] ?? 0}
                onView={handlePostView}
                fb={fb}
              />
            </div>

            {/* CHANGED: no interleaved videos/reels while searching */}
            {!searchQuery && visibleVideos[index] && (
              <VideoFeedCard video={visibleVideos[index]} fb={fb} />
            )}

            {!searchQuery && (
              <ReelsStrip key={`reels-${index}`} startOffset={index * 10} fb={fb} />
            )}

            {!searchQuery && index >= 3 && (index - 3) % 6 === 0 && (
              <SuggestedConnections variant="feed" slot={1 + (index - 3) / 6} />
            )}
          </React.Fragment>
        ))}

        {hasMore && (
          <div ref={setSentinelNode} className="pf-scroll-sentinel">
            {loadingMore && <span className="pf-scroll-loading">Loading more posts…</span>}
          </div>
        )}

        {!hasMore && posts.length > 0 && (
          <p className="pf-scroll-end">
            {searchQuery ? "End of results 🎉" : "You're all caught up 🎉"}
          </p>
        )}
      </div>

      {/* NEW (feedback): one toast for the whole feed, so the message and
          Undo survive the hidden card unmounting. */}
      {/* NEW: "↑ N new" pill for live posts / videos from other people. */}
      {!searchQuery && pendingCount > 0 && (
        <button
          type="button"
          onClick={applyPending}
          style={{
            position: "fixed",
            top: 76,
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 9000,
            padding: "9px 18px",
            border: "none",
            borderRadius: 999,
            background: "var(--zx-primary, #dc2626)",
            color: "#fff",
            fontFamily: "'Nunito', sans-serif",
            fontSize: 13,
            fontWeight: 800,
            cursor: "pointer",
            boxShadow: "0 6px 20px rgba(220, 38, 38, 0.4)",
          }}
        >
          ↑ {pendingCount} new
        </button>
      )}

      <FeedbackToast fb={fb} />

      {/* NEW: "Interested in <profile>?" popup + its confirmation / Undo. */}
      {promptUser && (
        <ProfilePrompt
          username={promptUser}
          onInterested={() => answerPrompt("interested")}
          onNotInterested={() => answerPrompt("not_interested")}
          onDismiss={dismissPrompt}
        />
      )}
      <ProfileFeedbackToast
        toast={profileToast}
        onUndo={undoProfileFeedback}
        onClose={() => setProfileToast(null)}
      />

      {/* NEW: Post Composer popup (portal into <body>). */}
      {composerModal}
    </>
  );
};

export default PostFeed;