import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import Hls from "hls.js";
import { supabase } from "../../config/supabase";
import { getInitials } from "../../utils/initials";
import { claimSound, releaseSound } from "../../utils/soundArbiter";
import { notifyUser } from "../../utils/notifications";
// NEW: re-checks the story's link before it becomes clickable
import { normalizeLinkUrl, linkDisplayHost } from "../../utils/safeUrl";
import ReportModal from "../../Component/Moderation/ReportModal";

// ─────────────────────────────────────────────────────────────────────────
// StoryViewer — full-screen, Instagram/Facebook-style story player.
//
//   Header      avatar, name + verified badge, time, ⋯ menu, ✕ close
//               (plus 🔊 for videos / stories with music)
//   Chips       "AI-generated" label and a 🎵 music tag (title truncated)
//   Playback    progress segments across the top; photos last 5s, videos
//               play to the end; tap left/right, hold to pause; ← → Esc;
//               ‹ › buttons on desktop; continues into the next person
//   Music       a story's song plays under photo stories (videos keep
//               their own sound; the tag still shows)
//   Link        NEW: a tappable "🔗 label" button when the story has a link
//   Connect     a "Connect with …" sticker on other people's stories
//   Bottom bar  (other people's stories) share, "Send message…" reply,
//               and quick reactions ❤️ 👍 😂
//   Own story   👁 count + "Seen by" sheet (views, reactions, replies)
//   ⋯ menu      own: Delete / Copy link · others: Report / Copy link
//
// `groups` is a snapshot taken when the viewer opened:
//   [{ username, stories: [{ id, username, media_url, media_type, caption,
//                            created_at, song, ai_generated,
//                            link_url, link_label }] }]
// `verified` is an optional Set of usernames that get the badge.
// ─────────────────────────────────────────────────────────────────────────

const IMAGE_DURATION_MS = 5000;
const HOLD_MS = 200;
const TOAST_MS = 2200;

const REACTIONS = [
  { type: "love", emoji: "❤️", label: "Love" },
  { type: "like", emoji: "👍", label: "Like" },
  { type: "haha", emoji: "😂", label: "Haha" },
];
const EMOJI_BY_TYPE = Object.fromEntries(REACTIONS.map((r) => [r.type, r.emoji]));

const isHlsSource = (src) => !!src && /\.m3u8(\?.*)?$/i.test(src);

const timeAgo = (dateStr) => {
  if (!dateStr) return "";
  const diff = (Date.now() - new Date(dateStr)) / 1000;
  if (diff < 60) return "Just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}d`;
};

const VerifiedBadge = () => (
  <span className="pf-verified" title="Verified" aria-label="Verified">
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </svg>
  </span>
);

const StoryViewer = ({
  groups,
  startGroup = 0,
  startStory = 0,
  currentUser,
  verified,
  onViewed, // (story) => void
  onDelete, // async (story) => boolean
  onClose,
}) => {
  const isLoggedIn = !!currentUser && currentUser !== "anonymous";

  const [data, setData] = useState(groups);
  const [gIdx, setGIdx] = useState(startGroup);
  const [sIdx, setSIdx] = useState(startStory);
  const [progress, setProgress] = useState(0);
  const [paused, setPaused] = useState(false);
  const [muted, setMuted] = useState(false);

  const [menuOpen, setMenuOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [toast, setToast] = useState("");

  // Own story: who saw / reacted / replied
  const [viewers, setViewers] = useState([]);
  const [showViewers, setShowViewers] = useState(false);

  // Other people's stories: my reaction, reply draft, connect state
  const [reaction, setReaction] = useState(null);
  const [burst, setBurst] = useState(null); // { emoji, key }
  const [replyText, setReplyText] = useState("");
  const [connStatus, setConnStatus] = useState(undefined); // undefined = loading
  const [connLoading, setConnLoading] = useState(false);

  const videoRef = useRef(null);
  const audioRef = useRef(null);
  const inputRef = useRef(null);
  const elapsedRef = useRef(0);
  const holdTimerRef = useRef(null);
  const heldRef = useRef(false);
  const toastTimerRef = useRef(null);
  // Guards against a reply being sent twice by a double tap / double event.
  const sendingRef = useRef(false);
  const [songSoundId] = useState(() => Symbol("story-song"));

  const group = data[gIdx];
  const story = group?.stories[sIdx];
  const isVideo = story?.media_type === "video";
  const isOwn = !!story && story.username === currentUser;
  const song = story?.song && story.song.url ? story.song : null;
  // Music plays under photos only; videos keep their own sound.
  const canPlayMusic = !!song && !isVideo;
  const hasSound = isVideo || canPlayMusic;
  // NEW: only ever a clean http(s) address, or null.
  const storyLink = story ? normalizeLinkUrl(story.link_url) : null;

  const showToast = (msg) => {
    setToast(msg);
    clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToast(""), TOAST_MS);
  };

  // ── Navigation ──
  const goNext = () => {
    if (sIdx < group.stories.length - 1) {
      setSIdx(sIdx + 1);
    } else if (gIdx < data.length - 1) {
      setGIdx(gIdx + 1);
      setSIdx(0);
    } else {
      onClose();
    }
  };

  const goPrev = () => {
    if (sIdx > 0) {
      setSIdx(sIdx - 1);
    } else if (gIdx > 0) {
      setGIdx(gIdx - 1);
      setSIdx(0);
    } else {
      // Already at the very first story — just restart it.
      elapsedRef.current = 0;
      setProgress(0);
      if (videoRef.current) videoRef.current.currentTime = 0;
    }
  };

  // ── Reset per-story state whenever the story changes ──
  useEffect(() => {
    elapsedRef.current = 0;
    setProgress(0);
    setPaused(false);
    setMenuOpen(false);
    setReplyText("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [story?.id]);

  // ── Mark as viewed (also saves the view for the owner's "Seen by") ──
  useEffect(() => {
    if (story) onViewed?.(story);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [story?.id]);

  // ── Photo timer (pausable) ──
  useEffect(() => {
    if (!story || story.media_type !== "image" || paused) return;
    let raf;
    let last = performance.now();
    const tick = (now) => {
      elapsedRef.current += now - last;
      last = now;
      const p = Math.min(1, elapsedRef.current / IMAGE_DURATION_MS);
      setProgress(p);
      if (p >= 1) {
        goNext();
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [story?.id, paused]);

  // ── Video: HLS source (plain mp4 uses the src attribute directly) ──
  useEffect(() => {
    const vid = videoRef.current;
    if (!vid || !isVideo || !isHlsSource(story.media_url)) return;
    let hls;
    if (Hls.isSupported()) {
      hls = new Hls();
      hls.loadSource(story.media_url);
      hls.attachMedia(vid);
    } else if (vid.canPlayType("application/vnd.apple.mpegurl")) {
      vid.src = story.media_url;
    }
    return () => hls?.destroy();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [story?.id]);

  // ── Video: progress + auto-advance ──
  useEffect(() => {
    const vid = videoRef.current;
    if (!vid || !isVideo) return;
    const onTime = () => {
      if (vid.duration) setProgress(vid.currentTime / vid.duration);
    };
    const onEnd = () => goNext();
    vid.addEventListener("timeupdate", onTime);
    vid.addEventListener("ended", onEnd);
    return () => {
      vid.removeEventListener("timeupdate", onTime);
      vid.removeEventListener("ended", onEnd);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [story?.id]);

  // ── Video: play / pause (sound on by default — opening a story is a
  // user gesture; if the browser still refuses, fall back to muted) ──
  useEffect(() => {
    const vid = videoRef.current;
    if (!vid || !isVideo) return;
    if (paused) {
      vid.pause();
      return;
    }
    vid.muted = muted;
    const attempt = vid.play();
    if (attempt && typeof attempt.catch === "function") {
      attempt.catch(() => {
        vid.muted = true;
        setMuted(true);
        vid.play().catch(() => { });
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paused, story?.id]);

  // ── Music: plays under photo stories while not paused. Claims the
  // shared sound arbiter so a post's song in the feed goes quiet. ──
  useEffect(() => {
    const el = audioRef.current;
    if (!el || !canPlayMusic) return;
    if (paused) {
      el.pause();
      return;
    }
    el.muted = muted;
    const attempt = el.play();
    if (attempt && typeof attempt.then === "function") {
      attempt
        .then(() => claimSound(songSoundId, () => el.pause()))
        .catch(() => { });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paused, story?.id]);

  useEffect(() => () => releaseSound(songSoundId), [songSoundId]);

  // ── Mute applies to both the video and the music ──
  useEffect(() => {
    if (videoRef.current) videoRef.current.muted = muted;
    if (audioRef.current) audioRef.current.muted = muted;
  }, [muted]);

  // ── Own story: load who saw it, reacted, and replied ──
  useEffect(() => {
    setShowViewers(false);
    setViewers([]);
    if (!isOwn || !story) return;

    let cancelled = false;
    (async () => {
      const [views, reacts, replies] = await Promise.all([
        supabase
          .from("story_views")
          .select("viewer_username, viewed_at")
          .eq("story_id", story.id),
        supabase
          .from("story_reactions")
          .select("username, type, created_at")
          .eq("story_id", story.id),
        supabase
          .from("story_replies")
          .select("from_username, text, created_at")
          .eq("story_id", story.id)
          .order("created_at", { ascending: true }),
      ]);
      if (cancelled) return;

      const byUser = new Map();
      const entry = (name) => {
        if (!byUser.has(name)) {
          byUser.set(name, { username: name, at: null, reaction: null, replies: [] });
        }
        return byUser.get(name);
      };
      (views.data || []).forEach((v) => {
        const e = entry(v.viewer_username);
        e.at = v.viewed_at;
      });
      (reacts.data || []).forEach((r) => {
        const e = entry(r.username);
        e.reaction = r.type;
        e.at = e.at || r.created_at;
      });
      (replies.data || []).forEach((r) => {
        const e = entry(r.from_username);
        e.replies.push(r.text);
        e.at = e.at || r.created_at;
      });

      setViewers(
        [...byUser.values()].sort((a, b) => new Date(b.at || 0) - new Date(a.at || 0))
      );
    })();

    return () => {
      cancelled = true;
    };
  }, [story?.id, isOwn]);

  // ── Other people's stories: my current reaction ──
  useEffect(() => {
    setReaction(null);
    if (!story || isOwn || !isLoggedIn) return;
    let cancelled = false;
    supabase
      .from("story_reactions")
      .select("type")
      .match({ story_id: story.id, username: currentUser })
      .maybeSingle()
      .then(({ data: row }) => {
        if (!cancelled) setReaction(row?.type || null);
      });
    return () => {
      cancelled = true;
    };
  }, [story?.id, isOwn, isLoggedIn, currentUser]);

  // ── Other people's stories: connection status for the sticker ──
  useEffect(() => {
    setConnStatus(undefined);
    if (!group || isOwn) return;
    if (!isLoggedIn) {
      setConnStatus(null);
      return;
    }
    const userId = localStorage.getItem("userId");
    if (!userId) {
      setConnStatus(null);
      return;
    }
    let cancelled = false;
    supabase
      .from("connections")
      .select("status")
      .match({ connector_id: userId, connected_to: group.username })
      .maybeSingle()
      .then(({ data: row }) => {
        if (!cancelled) setConnStatus(row?.status || null);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [group?.username, isOwn, isLoggedIn]);

  // ── Floating reaction emoji clears itself ──
  useEffect(() => {
    if (!burst) return;
    const t = setTimeout(() => setBurst(null), 950);
    return () => clearTimeout(t);
  }, [burst]);

  useEffect(() => () => clearTimeout(toastTimerRef.current), []);

  // ── Keyboard + scroll lock ──
  useEffect(() => {
    const onKey = (e) => {
      const tag = e.target?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") {
        if (e.key === "Escape") e.target.blur();
        return; // typing a reply — don't navigate
      }
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight") goNext();
      else if (e.key === "ArrowLeft") goPrev();
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      clearTimeout(holdTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gIdx, sIdx, data]);

  // ── Tap / hold on the media area ──
  const handlePointerDown = () => {
    heldRef.current = false;
    clearTimeout(holdTimerRef.current);
    holdTimerRef.current = setTimeout(() => {
      heldRef.current = true;
      setPaused(true);
    }, HOLD_MS);
  };

  const handlePointerUp = (e) => {
    clearTimeout(holdTimerRef.current);
    if (heldRef.current) {
      heldRef.current = false;
      setPaused(false);
      return;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    if (x < rect.width * 0.3) goPrev();
    else goNext();
  };

  const handlePointerCancel = () => {
    clearTimeout(holdTimerRef.current);
    if (heldRef.current) {
      heldRef.current = false;
      setPaused(false);
    }
  };

  // ── ⋯ menu ──
  const openMenu = () => {
    setPaused(true);
    setMenuOpen(true);
  };
  const closeMenu = () => {
    setMenuOpen(false);
    setPaused(false);
  };

  // ── Share / copy link ──
  const handleShare = async () => {
    const url = `${window.location.origin}/?tab=posts&story=${story.id}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: `${group.username}'s story`, url });
        return;
      }
    } catch (err) {
      if (err?.name === "AbortError") return; // person closed the share sheet
    }
    try {
      await navigator.clipboard.writeText(url);
      showToast("Link copied");
    } catch {
      showToast("Couldn't copy the link");
    }
  };

  const handleCopyLink = async () => {
    const url = `${window.location.origin}/?tab=posts&story=${story.id}`;
    setMenuOpen(false);
    try {
      await navigator.clipboard.writeText(url);
      showToast("Link copied");
    } catch {
      showToast("Couldn't copy the link");
    }
    setPaused(false);
  };

  // ── Report (other people's stories) ──
  const handleReportClick = () => {
    if (!isLoggedIn) {
      window.dispatchEvent(new CustomEvent("openLogin"));
      return;
    }
    setMenuOpen(false);
    setReportOpen(true); // stays paused until the modal closes
  };

  // ── Delete (own stories only) ──
  const handleDelete = async () => {
    if (!isOwn || !onDelete) return;
    setMenuOpen(false);
    setPaused(true);
    if (!window.confirm("Delete this story?")) {
      setPaused(false);
      return;
    }
    const ok = await onDelete(story);
    if (!ok) {
      setPaused(false);
      return;
    }

    const nextData = data
      .map((g, i) =>
        i === gIdx
          ? { ...g, stories: g.stories.filter((s) => s.id !== story.id) }
          : g
      )
      .filter((g) => g.stories.length > 0);

    if (nextData.length === 0) {
      onClose();
      return;
    }

    const groupStillHasStories = group.stories.length > 1;
    if (groupStillHasStories) {
      setData(nextData);
      setSIdx(Math.min(sIdx, group.stories.length - 2));
    } else if (gIdx >= nextData.length) {
      onClose();
    } else {
      setData(nextData);
      setSIdx(0);
    }
    setPaused(false);
  };

  // ── Seen by sheet ──
  const openViewers = () => {
    setPaused(true);
    setShowViewers(true);
  };
  const closeViewers = () => {
    setShowViewers(false);
    setPaused(false);
  };

  // ── Reactions ──
  const handleReact = async (type) => {
    if (!isLoggedIn) {
      window.dispatchEvent(new CustomEvent("openLogin"));
      return;
    }
    const prev = reaction;
    const next = prev === type ? null : type;
    setReaction(next);
    if (next) setBurst({ emoji: EMOJI_BY_TYPE[next], key: Date.now() });

    const { error } = next
      ? await supabase
        .from("story_reactions")
        .upsert(
          { story_id: story.id, username: currentUser, type: next },
          { onConflict: "story_id,username" }
        )
      : await supabase
        .from("story_reactions")
        .delete()
        .match({ story_id: story.id, username: currentUser });

    if (error) {
      console.error("Story reaction failed:", error);
      setReaction(prev);
      showToast(error.message || "Couldn't save your reaction");
      return;
    }

    if (!next) {
      showToast("Reaction removed");
      return;
    }

    // Visible confirmation for the person reacting.
    showToast(`${EMOJI_BY_TYPE[next]} Reaction sent`);

    // Tell the story's owner (first reaction only, so switching between
    // ❤️ / 👍 / 😂 doesn't spam them).
    if (!prev && story.username && story.username !== currentUser) {
      notifyUser({
        recipientUsername: story.username,
        senderUsername: currentUser,
        type: "like",
        message: `${currentUser} reacted ${EMOJI_BY_TYPE[next]} to your story`,
        contentId: story.id,
        contentType: "story",
      });
    }
  };

  // ── Reply ("Send message…") ──
  // Cleared immediately and guarded by sendingRef, so a double tap can't
  // insert the same reply twice; on failure the text is put back.
  const handleSendReply = async () => {
    const text = replyText.trim();
    if (!text || sendingRef.current) return;
    if (!isLoggedIn) {
      window.dispatchEvent(new CustomEvent("openLogin"));
      return;
    }

    sendingRef.current = true;
    setReplyText("");

    const { error } = await supabase.from("story_replies").insert({
      story_id: story.id,
      from_username: currentUser,
      text,
    });
    sendingRef.current = false;

    if (error) {
      console.error("Story reply failed:", error);
      setReplyText(text);
      showToast(error.message || "Couldn't send your reply");
      return;
    }
    showToast("Reply sent");
    inputRef.current?.blur();

    if (story.username && story.username !== currentUser) {
      notifyUser({
        recipientUsername: story.username,
        senderUsername: currentUser,
        type: "comment",
        message: `${currentUser} replied to your story: "${text.slice(0, 60)}"`,
        contentId: story.id,
        contentType: "story",
      });
    }
  };

  // ── Connect sticker (same flow as the Connect button on post cards) ──
  const handleConnect = async () => {
    if (!isLoggedIn) {
      window.dispatchEvent(new CustomEvent("openLogin"));
      return;
    }
    const userId = localStorage.getItem("userId");
    if (!userId || connLoading) return;

    const was = connStatus; // null | "pending" | "accepted"
    setConnLoading(true);
    try {
      if (was) {
        setConnStatus(null);
        const { error } = await supabase
          .from("connections")
          .delete()
          .match({ connector_id: userId, connected_to: group.username });
        if (error) {
          console.error("Story connect delete error:", error);
          setConnStatus(was);
        }
      } else {
        setConnStatus("pending");
        const { error } = await supabase.from("connections").insert({
          connector_id: userId,
          connector_username: currentUser,
          connected_to: group.username,
          status: "pending",
        });
        if (error) {
          console.error("Story connect insert error:", error);
          setConnStatus(null);
        }
      }
    } finally {
      setConnLoading(false);
    }
  };

  if (!group || !story) return null;

  const showConnectSticker =
    !isOwn && connStatus !== undefined && connStatus !== "accepted";

  return createPortal(
    <div className="pf-story-viewer" role="dialog" aria-modal="true" aria-label="Story viewer">
      <button
        type="button"
        className="pf-story-nav pf-story-nav-prev"
        onClick={goPrev}
        aria-label="Previous story"
      >
        ‹
      </button>

      <div className="pf-story-stage">
        {/* Progress segments */}
        <div className="pf-story-bars">
          {group.stories.map((s, i) => (
            <div className="pf-story-bar" key={s.id}>
              <div
                className="pf-story-bar-fill"
                style={{
                  width:
                    i < sIdx ? "100%" : i === sIdx ? `${progress * 100}%` : "0%",
                }}
              />
            </div>
          ))}
        </div>

        {/* Header */}
        <div className="pf-story-head">
          <span className="pf-avatar pf-avatar-sm pf-avatar-green">
            {getInitials(group.username)}
          </span>
          <div className="pf-story-meta">
            <div className="pf-story-nameline">
              <span className="pf-story-user">{group.username}</span>
              {verified?.has(group.username) && <VerifiedBadge />}
            </div>
            <span className="pf-story-time">{timeAgo(story.created_at)}</span>
          </div>
          <span className="pf-story-spacer" />
          {hasSound && (
            <button
              type="button"
              className="pf-story-head-btn"
              onClick={() => setMuted((m) => !m)}
              aria-label={muted ? "Unmute" : "Mute"}
            >
              {muted ? "🔇" : "🔊"}
            </button>
          )}
          <button
            type="button"
            className="pf-story-head-btn"
            onClick={menuOpen ? closeMenu : openMenu}
            aria-label="More options"
            aria-haspopup="true"
            aria-expanded={menuOpen}
          >
            ⋯
          </button>
          <button
            type="button"
            className="pf-story-head-btn"
            onClick={onClose}
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* AI label + music tag */}
        {(story.ai_generated || song) && (
          <div className="pf-story-chips">
            {story.ai_generated && (
              <span className="pf-story-chip pf-story-chip--ai" title="This story may contain AI-generated content">
                ✦ AI-generated
              </span>
            )}
            {song && (
              <span
                className="pf-story-chip"
                title={`${song.title}${song.artist ? " · " + song.artist : ""}`}
              >
                🎵 <span className="pf-story-chip-text">{song.title}</span>
              </span>
            )}
          </div>
        )}

        {/* Media — keyed by story id so each story mounts a fresh element */}
        <div className="pf-story-media">
          {isVideo ? (
            <video
              key={story.id}
              ref={videoRef}
              src={isHlsSource(story.media_url) ? undefined : story.media_url}
              playsInline
              preload="auto"
              onContextMenu={(e) => e.preventDefault()}
            />
          ) : (
            <img key={story.id} src={story.media_url} alt="" draggable={false} />
          )}
        </div>

        {canPlayMusic && (
          <audio key={`a-${story.id}`} ref={audioRef} src={song.url} loop preload="auto" />
        )}

        {story.caption && (
          <div className={`pf-story-caption${!isOwn ? " pf-story-caption--lifted" : ""}`}>
            {story.caption}
          </div>
        )}

        {/* Invisible tap / hold layer */}
        <div
          className="pf-story-tap"
          onPointerDown={handlePointerDown}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerCancel}
          onPointerCancel={handlePointerCancel}
          onContextMenu={(e) => e.preventDefault()}
        />

        {/* NEW: link button — sits above the tap layer so it is clickable.
            Opens in a new tab; rel keeps the opened page from controlling
            this one. */}
        {storyLink && (
          <a
            className={`pf-story-link${isOwn ? " pf-story-link--own" : ""}`}
            href={storyLink}
            target="_blank"
            rel="noopener noreferrer nofollow"
            onClick={(e) => e.stopPropagation()}
            title={storyLink}
          >
            <span aria-hidden="true">🔗</span>
            <span className="pf-story-link-text">
              {story.link_label || linkDisplayHost(storyLink)}
            </span>
          </a>
        )}

        {/* Connect sticker (other people's stories) */}
        {showConnectSticker && (
          <div className="pf-story-connect">
            <span className="pf-avatar pf-avatar-sm pf-avatar-green">
              {getInitials(group.username)}
            </span>
            <div className="pf-story-connect-text">
              <small>CONNECT WITH</small>
              <b>{group.username}</b>
            </div>
            <button
              type="button"
              className={`pf-story-connect-btn${connStatus === "pending" ? " pending" : ""}`}
              onClick={handleConnect}
              disabled={connLoading}
            >
              {connStatus === "pending" ? "Requested" : "Connect"}
            </button>
          </div>
        )}

        {/* Bottom bar: share, reply, reactions (other people's stories) */}
        {!isOwn && (
          <div className="pf-story-reply-bar">
            <button
              type="button"
              className="pf-story-share-icon"
              onClick={handleShare}
              aria-label="Share story"
              title="Share"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
              </svg>
            </button>

            {/* A <form> so the phone keyboard's Send/Enter key and the Send
                button share one reliable submit path. */}
            <form
              className="pf-story-reply-form"
              onSubmit={(e) => {
                e.preventDefault();
                handleSendReply();
              }}
            >
              <input
                ref={inputRef}
                className="pf-story-reply-input"
                type="text"
                enterKeyHint="send"
                placeholder="Send message…"
                maxLength={500}
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                onFocus={() => setPaused(true)}
                onBlur={() => setPaused(false)}
              />

              {replyText.trim() ? (
                <button
                  type="submit"
                  className="pf-story-send-btn"
                  // keeps the input focused so the tap isn't swallowed by a blur
                  onMouseDown={(e) => e.preventDefault()}
                >
                  Send
                </button>
              ) : (
                REACTIONS.map((r) => (
                  <button
                    key={r.type}
                    type="button"
                    className={`pf-story-react-btn${reaction === r.type ? " active" : ""}`}
                    onClick={() => handleReact(r.type)}
                    aria-label={r.label}
                    aria-pressed={reaction === r.type}
                  >
                    {r.emoji}
                  </button>
                ))
              )}
            </form>
          </div>
        )}

        {burst && (
          <span className="pf-story-burst" key={burst.key} aria-hidden="true">
            {burst.emoji}
          </span>
        )}

        {toast && <div className="pf-story-toast">{toast}</div>}

        {/* ⋯ menu */}
        {menuOpen && (
          <>
            <div className="pf-story-menu-backdrop" onClick={closeMenu} />
            <div className="pf-story-menu" role="menu">
              {isOwn ? (
                <button type="button" role="menuitem" onClick={handleDelete}>
                  🗑 Delete story
                </button>
              ) : (
                <button type="button" role="menuitem" onClick={handleReportClick}>
                  🚩 Report story
                </button>
              )}
              <button type="button" role="menuitem" onClick={handleCopyLink}>
                🔗 Copy link
              </button>
            </div>
          </>
        )}

        {/* Own story: 👁 count + Seen-by sheet */}
        {isOwn && (
          <button type="button" className="pf-story-seen-btn" onClick={openViewers}>
            👁 {viewers.length}
          </button>
        )}

        {showViewers && (
          <div className="pf-story-seen-sheet">
            <div className="pf-story-seen-head">
              <b>Seen by {viewers.length}</b>
              <button type="button" onClick={closeViewers} aria-label="Close">
                ✕
              </button>
            </div>
            {viewers.length === 0 ? (
              <p className="pf-story-seen-empty">No views yet.</p>
            ) : (
              <ul className="pf-story-seen-list">
                {viewers.map((v) => (
                  <li key={v.username}>
                    <span className="pf-avatar pf-avatar-sm">
                      {getInitials(v.username)}
                    </span>
                    <div className="pf-story-seen-main">
                      <span className="pf-story-seen-name">{v.username}</span>
                      {v.replies.map((text, i) => (
                        <p className="pf-story-seen-reply" key={i}>
                          “{text}”
                        </p>
                      ))}
                    </div>
                    {v.reaction && (
                      <span className="pf-story-seen-react">{EMOJI_BY_TYPE[v.reaction]}</span>
                    )}
                    <small>{timeAgo(v.at)}</small>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      <button
        type="button"
        className="pf-story-nav pf-story-nav-next"
        onClick={goNext}
        aria-label="Next story"
      >
        ›
      </button>

      {/* Report modal — rendered inside the viewer so it stacks above it */}
      {reportOpen && (
        <ReportModal
          contentType="story"
          contentId={story.id}
          contentTitle={story.caption?.slice(0, 80) || "Story"}
          contentOwner={story.username}
          onClose={() => {
            setReportOpen(false);
            setPaused(false);
          }}
        />
      )}
    </div>,
    document.body
  );
};

export default StoryViewer;