import React, { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "../../config/supabase";
import "./PostFeed.css";
import PostComposer from "./PostComposer";
import PostCard from "./PostCard";
import SideNavbar from "../../Component/SideNavbar/sideNavbar";

const PostFeed = ({ sideNavbar }) => {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState("");
  const PAGE_SIZE = 10;
  const offsetRef = useRef(0);
  const currentUser = localStorage.getItem("username") || "anonymous";

  const fetchPosts = useCallback(async (reset = false) => {
    try {
      const offset = reset ? 0 : offsetRef.current;
      const { data, error: fetchErr } = await supabase
        .from("posts")
        .select(`
          *,
          post_reactions ( type, username ),
          post_comments (
            id, text, username, created_at
          )
        `)
        .order("created_at", { ascending: false })
        .range(offset, offset + PAGE_SIZE - 1);

      if (fetchErr) throw fetchErr;

      const enriched = (data || []).map((p) => ({
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
      }));

      if (reset) {
        setPosts(enriched);
        offsetRef.current = enriched.length;
      } else {
        setPosts((prev) => [...prev, ...enriched]);
        offsetRef.current += enriched.length;
      }

      setHasMore((data || []).length === PAGE_SIZE);
    } catch (err) {
      setError(err.message || "Failed to load posts.");
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [currentUser]);

  useEffect(() => {
    fetchPosts(true);

    // Realtime subscription for new posts
    const channel = supabase
      .channel("posts-realtime")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "posts" },
        () => fetchPosts(true)
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [fetchPosts]);

  const handleNewPost = async (post) => {
  setPosts((prev) => [post, ...prev]);

  // Notify subscribers about new post
  const uploaderUsername = localStorage.getItem("username");
  const { data: subUsers } = await supabase
    .from("subscriptions")
    .select("subscriber_username")
    .eq("subscribed_to", uploaderUsername);

  if (subUsers && subUsers.length > 0) {
    const notifications = subUsers
      .filter((s) => s.subscriber_username)
      .map((s) => ({
        recipient_username: s.subscriber_username,
        sender_username: uploaderUsername,
        type: "upload",
        message: `${uploaderUsername} made a new post: "${post.text?.slice(0, 60) || "Check it out"}"`,
        is_read: false,
      }));
    await supabase.from("notifications").insert(notifications);
  }
};

  const handleReaction = async (postId, reactionType) => {
    if (!currentUser || currentUser === "anonymous") {
    window.dispatchEvent(new CustomEvent("openLogin"));
    return;
  }
    const post = posts.find((p) => p.id === postId);
    if (!post) return;

    const prev = post.myReaction;

    // Optimistic update
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
      }
    } catch {
      // Rollback on failure
      fetchPosts(true);
    }
  };

  const handleComment = async (postId, text) => {
    if (!currentUser || currentUser === "anonymous") {
    window.dispatchEvent(new CustomEvent("openLogin"));
    return;
  }
    if (!text.trim()) return;
    const { data, error: err } = await supabase
      .from("post_comments")
      .insert({ post_id: postId, username: currentUser, text: text.trim() })
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
  };

  const handleToggleComments = (postId) => {
    setPosts((all) =>
      all.map((p) =>
        p.id === postId ? { ...p, showComments: !p.showComments } : p
      )
    );
  };

  const handleShare = async (postId) => {
    const post = posts.find((p) => p.id === postId);
    if (!post) return;
    const { data, error: err } = await supabase
      .from("posts")
      .insert({
        username: currentUser,
        text: `Shared: "${post.text?.slice(0, 120) || ""}"`,
        image_url: post.image_url,
        link: post.link,
        privacy: "public",
        shared_from: postId,
      })
      .select()
      .single();
    if (!err && data) {
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
    }
  };

  const handleDeletePost = async (postId) => {
    await supabase.from("posts").delete().eq("id", postId).eq("username", currentUser);
    setPosts((all) => all.filter((p) => p.id !== postId));
  };

  const loadMore = () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    fetchPosts(false);
  };

  if (loading) {
    return (
      <div className="pf-feed">
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
    <SideNavbar sideNavbar={sideNavbar} />
    <div className="pf-feed">
      {currentUser && currentUser !== "anonymous"
  ? <PostComposer currentUser={currentUser} onPost={handleNewPost} />
  : (
    <div style={{ background: "#1a1a1a", border: "1px solid #333", borderRadius: "12px", padding: "20px", textAlign: "center", marginBottom: "16px" }}>
      <p style={{ color: "#aaa", fontSize: "14px", margin: "0 0 12px" }}>
        🔒 Please log in to post
      </p>
      <button
        onClick={() => window.dispatchEvent(new CustomEvent("openLogin"))}
        style={{ background: "#ff0000", color: "white", border: "none", borderRadius: "8px", padding: "8px 24px", fontSize: "14px", fontWeight: "600", cursor: "pointer" }}
      >
        Login
      </button>
    </div>
  )
}

      {error && <p className="pf-error">{error}</p>}

      {posts.length === 0 && !loading && (
        <div className="pf-empty">
          <span className="pf-empty-icon">📭</span>
          <p>No posts yet. Be the first to share something!</p>
        </div>
      )}

      {posts.map((post) => (
        <PostCard
          key={post.id}
          post={post}
          currentUser={currentUser}
          onReaction={handleReaction}
          onComment={handleComment}
          onToggleComments={handleToggleComments}
          onShare={handleShare}
          onDelete={handleDeletePost}
        />
      ))}

      {hasMore && (
        <button className="pf-load-more" onClick={loadMore} disabled={loadingMore}>
          {loadingMore ? "Loading…" : "Load more posts"}
        </button>
      )}
    </div>
  </>
);
};

export default PostFeed;