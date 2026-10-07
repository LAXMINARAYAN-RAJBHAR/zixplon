import React, { useState, useRef, useEffect, useCallback } from "react";
import { useLocation, Link } from "react-router-dom";
import { supabase } from "../../config/supabase";
import "./PostFeed.css";
import PostComposer from "./PostComposer";
import PostCard from "./PostCard";
import ReelsStrip from "./ReelsStrip";
import VideoFeedCard from "./VideoFeedCard";
import SideNavbar from "../../Component/SideNavbar/sideNavbar";
import AdUnit from "../../Component/Ads/AdUnit";
// NEW: shared preloading, buffer-hiding video — used for search-result
// reels that have no thumbnail, so they only load once near the screen.
import AutoPlayVideo from "../../Component/Shared/AutoPlayVideo";
import { notifyConnections, notifyUser } from "../../utils/notifications";
import { extractMentions } from "../../utils/linkify";

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
  const POOL_SIZE = 50;
  const offsetRef = useRef(0);
  const shuffledPoolRef = useRef([]);
  const [videos, setVideos] = useState([]);
  const videosOffsetRef = useRef(0);

  // NEW: request counter — lets fetchPosts ignore a slow, outdated
  // response (e.g. results for "hulk" arriving after a newer search for
  // "thor") instead of letting it overwrite the newer results.
  const fetchSeqRef = useRef(0);

  // Search-mode extras: reels + uploaded videos matching the query.
  const [searchReels, setSearchReels] = useState([]);
  const [searchVideos, setSearchVideos] = useState([]);
  const [searchExtrasLoading, setSearchExtrasLoading] = useState(false);

  const currentUser = currentUserProp || "anonymous";

  const [sentinelNode, setSentinelNode] = useState(null);
  const loadingMoreRef = useRef(false);
  const hasMoreRef = useRef(true);
  const channelInstanceIdRef = useRef(Math.random().toString(36).slice(2));

  useEffect(() => { loadingMoreRef.current = loadingMore; }, [loadingMore]);
  useEffect(() => { hasMoreRef.current = hasMore; }, [hasMore]);

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

  const shuffleArray = (arr) => {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };

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
    } catch (_) {}
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
    } catch (_) {}
  }, []);

  const fetchMoreVideos = useCallback(async (count) => {
    if (!count) return;
    const { data, error: fetchErr } = await supabase
      .from("videos")
      .select("id, short_id, video_url, thumbnail_url, title, channel, username, duration, created_at")
      .order("created_at", { ascending: false })
      .range(videosOffsetRef.current, videosOffsetRef.current + count - 1);

    if (!fetchErr && data && data.length > 0) {
      const mapped = data.map((v) => ({
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

      const videoIds = mapped.map((v) => String(v.id));
      const { data: likesData } = await supabase
        .from("likes")
        .select("content_id")
        .eq("content_type", "video")
        .in("content_id", videoIds);

      let withLikes = mapped;
      if (likesData) {
        const likesMap = {};
        likesData.forEach((row) => {
          likesMap[row.content_id] = (likesMap[row.content_id] || 0) + 1;
        });
        withLikes = mapped.map((v) => ({
          ...v,
          likes: likesMap[String(v.id)] ?? 0,
        }));
      }

      setVideos((prev) => [...prev, ...withLikes]);
      videosOffsetRef.current += data.length;
      if (data.length < count) {
        videosOffsetRef.current = 0;
      }
    } else {
      videosOffsetRef.current = 0;
    }
  }, []);

  const fetchPosts = useCallback(async (reset = false) => {
    // NEW: each call gets a ticket; only the newest ticket may update state.
    const seq = ++fetchSeqRef.current;
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

        if (fetchErr) throw fetchErr;

        // NEW: a newer search/fetch started while this one was in flight.
        if (seq !== fetchSeqRef.current) return;

        const page = (data || []).map(enrichPost);
        offsetRef.current += page.length;
        setHasMore(page.length === PAGE_SIZE);
        setPosts((prev) => (reset ? page : [...prev, ...page]));
        setVideos([]);
        fetchViewCounts(page.map((p) => p.id));
        return; // `finally` below still clears loading flags
      }

      // ────────────── NORMAL (SHUFFLED) FEED ──────────────
      if (reset) {
        shuffledPoolRef.current = [];
        offsetRef.current = 0;
        setHasMore(true);
      }

      while (shuffledPoolRef.current.length < PAGE_SIZE) {
        const offset = offsetRef.current;
        const { data, error: fetchErr } = await supabase
          .from("posts")
          .select(`
            *,
            post_reactions ( type, username ),
            post_comments ( ${POST_COMMENTS_SELECT} )
          `)
          .order("created_at", { ascending: false })
          .range(offset, offset + POOL_SIZE - 1);

        if (fetchErr) throw fetchErr;

        offsetRef.current += (data || []).length;

        if (!data || data.length === 0) {
          setHasMore(false);
          break;
        }

        const enrichedBatch = data.map(enrichPost);
        shuffledPoolRef.current = shuffledPoolRef.current.concat(
          shuffleArray(enrichedBatch),
        );

        if (data.length < POOL_SIZE) {
          setHasMore(false);
          break;
        }
        setHasMore(true);
      }

      // NEW: a newer fetch started while we were loading the pool.
      if (seq !== fetchSeqRef.current) return;

      const page = shuffledPoolRef.current.splice(0, PAGE_SIZE);

      if (reset) {
        setPosts(page);
        setVideos([]);
        videosOffsetRef.current = 0;
        fetchMoreVideos(page.length);
      } else {
        setPosts((prev) => [...prev, ...page]);
        fetchMoreVideos(page.length);
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
  }, [enrichPost, fetchMoreVideos, searchQuery]);

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

      setPosts((prev) => {
        if (prev.some((p) => p.id === newId)) return prev;
        return [enrichedPost, ...prev];
      });
      fetchMoreVideos(1);

      fetchViewCounts([newId]);
    },
    [enrichPost, fetchMoreVideos, searchQuery]
  );

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
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [fetchPosts, handleRealtimeInsert]);

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
        if (current.some((p) => p.id === sharedPostId)) return current;
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
    setPosts((prev) => [post, ...prev]);
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

      setPosts((prev) => [
        {
          ...data,
          myReaction: null,
          reactionCounts: {},
          comments: [],
          showComments: false,
        },
        ...prev,
      ]);

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

  if (loading) {
    return (
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

        {/* Composer is hidden while searching */}
        {!searchQuery &&
          (currentUser && currentUser !== "anonymous" ? (
            <PostComposer currentUser={currentUser} onPost={handleNewPost} />
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
              <VideoFeedCard key={v.id} video={v} />
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
            <p>No posts yet. Be the first to share something!</p>
          </div>
        )}

        {posts.map((post, index) => (
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
                onView={incrementView}
              />
            </div>

            {/* CHANGED: no interleaved videos/reels while searching */}
            {!searchQuery && videos[index] && (
              <VideoFeedCard video={videos[index]} />
            )}

            {!searchQuery && (
              <ReelsStrip key={`reels-${index}`} startOffset={index * 10} />
            )}

            {(index + 1) % 5 === 0 && (
              <AdUnit slot="7412839650" format="fluid" layout="in-feed" />
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
    </>
  );
};

export default PostFeed;