import React, { useState, useRef, useEffect, useCallback } from "react";
import { useLocation } from "react-router-dom";
import { supabase } from "../../config/supabase";
import "./PostFeed.css";
import PostComposer from "./PostComposer";
import PostCard from "./PostCard";
import ReelsStrip from "./ReelsStrip";
import VideoFeedCard from "./VideoFeedCard";
import SideNavbar from "../../Component/SideNavbar/sideNavbar";
import AdUnit from "../../Component/Ads/AdUnit";
import { notifyConnections, notifyUser } from "../../utils/notifications";
import { extractMentions } from "../../utils/linkify";

const PostFeed = ({ sideNavbar, currentUser: currentUserProp }) => {
  const location = useLocation();
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
  const [videos, setVideos] = useState([]);
  const videosOffsetRef = useRef(0);

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

  // Fetches the next `count` videos into the pool, and, once the batch
  // is in, does one follow-up query against `likes` to seed each
  // video's real like count (mirrors homePage.js's fetchDbVideos exactly).
  // Also selects created_at, so VideoFeedCard's "posted X ago" label has
  // something to render.
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
        likes: 0, // filled in below once likesData resolves
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
        videosOffsetRef.current = 0; // hit the end — loop back next time
      }
    } else {
      videosOffsetRef.current = 0; // empty page — reset and try again next call
    }
  }, []);

  const fetchPosts = useCallback(async (reset = false) => {
    try {
      const offset = reset ? 0 : offsetRef.current;
      const { data, error: fetchErr } = await supabase
        .from("posts")
        .select(`
          *,
          post_reactions ( type, username ),
          post_comments ( ${POST_COMMENTS_SELECT} )
        `)
        .order("created_at", { ascending: false })
        .range(offset, offset + PAGE_SIZE - 1);

      if (fetchErr) throw fetchErr;

      const enriched = (data || []).map(enrichPost);

      if (reset) {
        setPosts(enriched);
        offsetRef.current = enriched.length;
        setVideos([]);
        videosOffsetRef.current = 0;
        fetchMoreVideos(enriched.length);
      } else {
        setPosts((prev) => [...prev, ...enriched]);
        offsetRef.current += enriched.length;
        fetchMoreVideos(enriched.length);
      }

      fetchViewCounts(enriched.map((p) => p.id));

      setHasMore((data || []).length === PAGE_SIZE);
    } catch (err) {
      setError(err.message || "Failed to load posts.");
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [enrichPost]);

  const loadMore = useCallback(() => {
    if (loadingMoreRef.current || !hasMoreRef.current) return;
    setLoadingMore(true);
    fetchPosts(false);
  }, [fetchPosts]);

  const handleRealtimeInsert = useCallback(
    async (payload) => {
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
    [enrichPost, fetchMoreVideos]
  );

  useEffect(() => {
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
            offsetRef.current = Math.max(0, offsetRef.current - 1);
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
  }, [location.search, currentUser, enrichPost]);

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
    offsetRef.current = Math.max(0, offsetRef.current - 1);

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
        {currentUser && currentUser !== "anonymous" ? (
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
              onClick={() => window.dispatchEvent(new CustomEvent("openLogin"))}
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
        )}

        {error && <p className="pf-error">{error}</p>}
        {postNotFound && (
          <p className="pf-error">
            That post isn't available anymore — it may have been deleted, or the link is incorrect.
          </p>
        )}

        {posts.length === 0 && !loading && (
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

            {videos[index] && <VideoFeedCard video={videos[index]} />}

            <ReelsStrip key={`reels-${index}`} startOffset={index * 10} />

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
          <p className="pf-scroll-end">You're all caught up 🎉</p>
        )}
      </div>
    </>
  );
};

export default PostFeed;