import React, { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { supabase } from "../../config/supabase";
import MusicPicker from "../../Component/Shared/MusicPicker";
import {
  uploadToR2,
  buildTransformUrl,
  uploadVideoToR2,
} from "../../utils/mediaUpload";
import { normalizeLinkUrl } from "../../utils/safeUrl";
import { loadRecents, saveRecent } from "../../utils/recentMedia";
import {
  TEXT_BACKGROUNDS,
  LAYOUTS,
  renderTextStory,
  renderMusicStory,
  renderLayoutStory,
  renderVoiceStory,
} from "../../utils/storyComposer";

// ─────────────────────────────────────────────────────────────────────────
// StoryCreator — "Add status" popup for sharing new stories.
//
//   Add status screen (shown while nothing is picked yet)
//     • ✕ close + "Add status" title
//     • Text / Music / Layout / Voice — each builds a story image
//     • "Recents" dropdown (Recents / Photos / Videos) over a gallery grid
//     • Camera tile (take a photo or record a video) + Gallery tile
//   Editor (once something is picked)
//     • Same multi-item editor as before: captions, music, link, AI label,
//       one "Share" button. Each item is its own row in `stories`.
//
// Text / Music / Layout / Voice statuses are rendered to an image with a
// canvas, so the existing viewer and `stories` table work unchanged.
// A Voice status also uploads its audio and stores it as the story's `song`
// ({ voice: true }) — see the StoryViewer patch.
// ─────────────────────────────────────────────────────────────────────────

const MAX_ITEMS = 10;
const MAX_VIDEO_SECONDS = 60;
const MAX_VOICE_SECONDS = 30;
const CAPTION_MAX = 200;
const TEXT_MAX = 250;
const LINK_LABEL_MAX = 30;
const CLOSE_ANIMATION_MS = 200;

const MODES = [
  { id: "text", icon: "✏️", label: "Text" },
  { id: "music", icon: "🎵", label: "Music" },
  { id: "layout", icon: "▦", label: "Layout" },
  { id: "voice", icon: "🎙️", label: "Voice" },
];

const VIEW_TITLES = {
  text: "Text status",
  music: "Music status",
  layout: "Layout",
  voice: "Voice status",
};

const FILTERS = [
  { id: "all", label: "Recents" },
  { id: "image", label: "Photos" },
  { id: "video", label: "Videos" },
];

// Reads a video's length without uploading it. Resolves null if the
// browser can't read the metadata (the upload is still allowed then).
const readVideoDuration = (file) =>
  new Promise((resolve) => {
    const v = document.createElement("video");
    const url = URL.createObjectURL(file);
    const done = (d) => {
      URL.revokeObjectURL(url);
      resolve(d);
    };
    v.preload = "metadata";
    v.onloadedmetadata = () => done(isFinite(v.duration) ? v.duration : null);
    v.onerror = () => done(null);
    v.src = url;
  });

const newId = () => `${Date.now()}-${Math.random().toString(36).slice(2)}`;

const formatDuration = (s) => {
  if (!s) return "";
  const total = Math.round(s);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
};

/* ───────────────────────── Text status ───────────────────────── */
const TextComposer = ({ onDone }) => {
  const [text, setText] = useState("");
  const [bg, setBg] = useState(0);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [from, to] = TEXT_BACKGROUNDS[bg];

  const next = async () => {
    if (!text.trim() || busy) return;
    setBusy(true);
    setErr("");
    try {
      const file = await renderTextStory(text.trim(), bg);
      onDone({ file, type: "image" });
    } catch (e) {
      setErr(e.message || "Couldn't create your status.");
      setBusy(false);
    }
  };

  return (
    <div className="zx-compose">
      <div
        className="zx-text-canvas"
        style={{ background: `linear-gradient(160deg, ${from}, ${to})` }}
      >
        <textarea
          autoFocus
          maxLength={TEXT_MAX}
          placeholder="Type a status"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
      </div>
      <div className="zx-swatches">
        {TEXT_BACKGROUNDS.map(([a, b], i) => (
          <button
            key={i}
            type="button"
            className={`zx-swatch${i === bg ? " active" : ""}`}
            style={{ background: `linear-gradient(135deg, ${a}, ${b})` }}
            onClick={() => setBg(i)}
            aria-label={`Background ${i + 1}`}
          />
        ))}
      </div>
      {err && <p className="pf-error">{err}</p>}
      <button
        type="button"
        className="pf-post-btn"
        onClick={next}
        disabled={!text.trim() || busy}
      >
        {busy ? "Creating…" : "Next"}
      </button>
    </div>
  );
};

/* ───────────────────────── Music status ───────────────────────── */
const MusicComposer = ({ onDone }) => {
  const [song, setSong] = useState(null);
  const [showPicker, setShowPicker] = useState(false);
  const [bg, setBg] = useState(1);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [from, to] = TEXT_BACKGROUNDS[bg];

  const next = async () => {
    if (!song || busy) return;
    setBusy(true);
    setErr("");
    try {
      const file = await renderMusicStory(song, bg);
      onDone({ file, type: "image", song });
    } catch (e) {
      setErr(e.message || "Couldn't create your status.");
      setBusy(false);
    }
  };

  return (
    <div className="zx-compose">
      <div
        className="zx-music-card"
        style={{ background: `linear-gradient(160deg, ${from}, ${to})` }}
      >
        <span className="zx-music-note">♪</span>
        <b>{song ? song.title : "Pick a song"}</b>
        {song?.artist && <small>{song.artist}</small>}
      </div>

      <div className="pf-story-addon-wrap">
        <button
          type="button"
          className="pf-story-addon-btn"
          onClick={() => setShowPicker((v) => !v)}
        >
          🎵 {song ? "Change song" : "Choose a song"}
        </button>
        {showPicker && (
          <MusicPicker
            anchor="left"
            position="bottom"
            onSelect={(s) => setSong(s)}
            onClose={() => setShowPicker(false)}
          />
        )}
      </div>

      <div className="zx-swatches">
        {TEXT_BACKGROUNDS.map(([a, b], i) => (
          <button
            key={i}
            type="button"
            className={`zx-swatch${i === bg ? " active" : ""}`}
            style={{ background: `linear-gradient(135deg, ${a}, ${b})` }}
            onClick={() => setBg(i)}
            aria-label={`Background ${i + 1}`}
          />
        ))}
      </div>
      {err && <p className="pf-error">{err}</p>}
      <button
        type="button"
        className="pf-post-btn"
        onClick={next}
        disabled={!song || busy}
      >
        {busy ? "Creating…" : "Next"}
      </button>
    </div>
  );
};

/* ───────────────────────── Layout status ───────────────────────── */
const LayoutComposer = ({ onDone }) => {
  const [layoutId, setLayoutId] = useState(LAYOUTS[0].id);
  const [picked, setPicked] = useState([]); // [{ file, url }]
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const pickedRef = useRef(picked);
  pickedRef.current = picked;
  const layout = LAYOUTS.find((l) => l.id === layoutId);

  useEffect(
    () => () => pickedRef.current.forEach((p) => URL.revokeObjectURL(p.url)),
    []
  );

  const chooseLayout = (id) => {
    const l = LAYOUTS.find((x) => x.id === id);
    setLayoutId(id);
    setPicked((prev) => {
      prev.slice(l.count).forEach((p) => URL.revokeObjectURL(p.url));
      return prev.slice(0, l.count);
    });
  };

  const onPick = (e) => {
    const files = Array.from(e.target.files || []).filter((f) =>
      f.type.startsWith("image/")
    );
    e.target.value = "";
    setPicked((prev) => {
      const add = files.map((file) => ({ file, url: URL.createObjectURL(file) }));
      const all = [...prev, ...add];
      all.slice(layout.count).forEach((p) => URL.revokeObjectURL(p.url));
      return all.slice(0, layout.count);
    });
  };

  const removeAt = (i) => {
    URL.revokeObjectURL(picked[i].url);
    setPicked((prev) => prev.filter((_, idx) => idx !== i));
  };

  const next = async () => {
    if (picked.length !== layout.count || busy) return;
    setBusy(true);
    setErr("");
    try {
      const file = await renderLayoutStory(
        picked.map((p) => p.file),
        layout
      );
      onDone({ file, type: "image" });
    } catch (e) {
      setErr(e.message || "Couldn't create your layout.");
      setBusy(false);
    }
  };

  return (
    <div className="zx-compose">
      <div className="zx-layout-options">
        {LAYOUTS.map((l) => (
          <button
            key={l.id}
            type="button"
            className={`zx-layout-opt${l.id === layoutId ? " active" : ""}`}
            onClick={() => chooseLayout(l.id)}
            aria-label={`${l.count} photos, layout ${l.id}`}
          >
            {l.cells.map(([x, y, w, h], i) => (
              <span
                key={i}
                style={{
                  left: `${x * 100}%`,
                  top: `${y * 100}%`,
                  width: `${w * 100}%`,
                  height: `${h * 100}%`,
                }}
              />
            ))}
          </button>
        ))}
      </div>

      <div className="zx-layout-preview">
        {layout.cells.map(([x, y, w, h], i) => (
          <div
            key={i}
            className="zx-layout-slot"
            style={{
              left: `${x * 100}%`,
              top: `${y * 100}%`,
              width: `${w * 100}%`,
              height: `${h * 100}%`,
            }}
          >
            {picked[i] ? (
              <button type="button" onClick={() => removeAt(i)} title="Tap to remove">
                <img src={picked[i].url} alt="" draggable={false} />
              </button>
            ) : (
              <span>{i + 1}</span>
            )}
          </div>
        ))}
      </div>

      {picked.length < layout.count && (
        <label className="pf-story-addon-btn zx-label-btn">
          🖼️ Add photos ({picked.length}/{layout.count})
          <input type="file" accept="image/*" multiple hidden onChange={onPick} />
        </label>
      )}
      {err && <p className="pf-error">{err}</p>}
      <button
        type="button"
        className="pf-post-btn"
        onClick={next}
        disabled={picked.length !== layout.count || busy}
      >
        {busy ? "Creating…" : "Next"}
      </button>
    </div>
  );
};

/* ───────────────────────── Voice status ───────────────────────── */
const VoiceComposer = ({ onDone }) => {
  const [phase, setPhase] = useState("idle"); // idle | recording | recorded
  const [secs, setSecs] = useState(0);
  const [audioUrl, setAudioUrl] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const recRef = useRef(null);
  const chunksRef = useRef([]);
  const streamRef = useRef(null);
  const timerRef = useRef(null);
  const blobRef = useRef(null);
  const secsRef = useRef(0);

  const stopTracks = () => streamRef.current?.getTracks().forEach((t) => t.stop());

  useEffect(
    () => () => {
      clearInterval(timerRef.current);
      if (recRef.current && recRef.current.state === "recording") {
        recRef.current.onstop = null;
        recRef.current.stop();
      }
      stopTracks();
    },
    []
  );

  useEffect(() => () => audioUrl && URL.revokeObjectURL(audioUrl), [audioUrl]);

  const stop = () => {
    clearInterval(timerRef.current);
    if (recRef.current && recRef.current.state === "recording") recRef.current.stop();
  };

  const start = async () => {
    setErr("");
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setErr("Voice recording isn't supported in this browser.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mime =
        ["audio/webm", "audio/mp4"].find((m) => MediaRecorder.isTypeSupported(m)) || "";
      const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      chunksRef.current = [];
      rec.ondataavailable = (e) => e.data.size && chunksRef.current.push(e.data);
      rec.onstop = () => {
        stopTracks();
        const type = rec.mimeType || mime || "audio/webm";
        const blob = new Blob(chunksRef.current, { type });
        blobRef.current = blob;
        setAudioUrl(URL.createObjectURL(blob));
        setPhase("recorded");
      };
      rec.start();
      recRef.current = rec;
      secsRef.current = 0;
      setSecs(0);
      setPhase("recording");
      timerRef.current = setInterval(() => {
        secsRef.current += 1;
        setSecs(secsRef.current);
        if (secsRef.current >= MAX_VOICE_SECONDS) stop();
      }, 1000);
    } catch {
      setErr("Couldn't use the microphone. Allow microphone access and try again.");
    }
  };

  const redo = () => {
    blobRef.current = null;
    setAudioUrl(null);
    setSecs(0);
    setPhase("idle");
  };

  const next = async () => {
    if (!blobRef.current || busy) return;
    setBusy(true);
    setErr("");
    try {
      const blob = blobRef.current;
      const ext = blob.type.includes("mp4") ? "m4a" : "webm";
      const voiceFile = new File([blob], `voice-${Date.now()}.${ext}`, { type: blob.type });
      const file = await renderVoiceStory(Math.max(1, secsRef.current));
      onDone({ file, type: "image", voiceFile });
    } catch (e) {
      setErr(e.message || "Couldn't create your voice status.");
      setBusy(false);
    }
  };

  return (
    <div className="zx-compose zx-voice">
      <div className="zx-voice-timer">
        {Math.floor(secs / 60)}:{String(secs % 60).padStart(2, "0")}
        <small> / 0:{MAX_VOICE_SECONDS}</small>
      </div>

      {phase !== "recorded" ? (
        <button
          type="button"
          className={`zx-record-btn${phase === "recording" ? " recording" : ""}`}
          onClick={phase === "recording" ? stop : start}
          aria-label={phase === "recording" ? "Stop recording" : "Start recording"}
        >
          {phase === "recording" ? "■" : "🎙️"}
        </button>
      ) : (
        <>
          <audio src={audioUrl} controls />
          <button type="button" className="pf-story-addon-btn" onClick={redo}>
            ↺ Record again
          </button>
        </>
      )}

      <small className="zx-hint">
        {phase === "idle" && "Tap the mic to record (up to 30 seconds)."}
        {phase === "recording" && "Recording… tap to stop."}
      </small>
      {err && <p className="pf-error">{err}</p>}
      <button
        type="button"
        className="pf-post-btn"
        onClick={next}
        disabled={phase !== "recorded" || busy}
      >
        {busy ? "Creating…" : "Next"}
      </button>
    </div>
  );
};

/* ───────────────────────── Main popup ───────────────────────── */
const StoryCreator = ({ currentUser, onClose, onCreated }) => {
  const [open, setOpen] = useState(false); // drives pop-in / pop-out
  const [view, setView] = useState("home"); // home | text | music | layout | voice
  // [{ id, file, preview, type, duration, caption, song?, voiceFile? }]
  const [items, setItems] = useState([]);
  const [sel, setSel] = useState(0);
  const [song, setSong] = useState(null); // applies to every item without its own
  const [aiGenerated, setAiGenerated] = useState(false);
  const [showMusicPicker, setShowMusicPicker] = useState(false);
  const [showLink, setShowLink] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [linkLabel, setLinkLabel] = useState("");
  const [posting, setPosting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [stage, setStage] = useState("");
  const [error, setError] = useState("");

  // Add status screen
  const [recents, setRecents] = useState([]); // [{ id, file, type, duration, url }]
  const [filter, setFilter] = useState("all");
  const [selected, setSelected] = useState(() => new Set());

  const closeTimerRef = useRef(null);
  const itemsRef = useRef(items);
  itemsRef.current = items;

  // Pop in on the frame after mount so the CSS transition actually runs.
  useEffect(() => {
    const raf = requestAnimationFrame(() => setOpen(true));
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(closeTimerRef.current);
    };
  }, []);

  // Free every preview object URL on unmount.
  useEffect(() => {
    return () => {
      itemsRef.current.forEach((it) => URL.revokeObjectURL(it.preview));
    };
  }, []);

  // Load the Recents grid (and free its object URLs on unmount).
  useEffect(() => {
    let dead = false;
    const urls = [];
    loadRecents().then((list) => {
      if (dead) return;
      setRecents(
        list.map((r) => {
          const url = URL.createObjectURL(r.file);
          urls.push(url);
          return { ...r, url };
        })
      );
    });
    return () => {
      dead = true;
      urls.forEach((u) => URL.revokeObjectURL(u));
    };
  }, []);

  const animateClose = () => {
    setOpen(false);
    clearTimeout(closeTimerRef.current);
    closeTimerRef.current = setTimeout(onClose, CLOSE_ANIMATION_MS);
  };

  // Closing mid-upload is blocked so a story can't be half-shared.
  const requestClose = () => {
    if (posting) return;
    animateClose();
  };

  // Scroll lock + Esc to close.
  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e) => {
      if (e.key === "Escape" && !posting) animateClose();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener("keydown", onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [posting]);

  // ── Adding files (camera, gallery, or "+ add more") ──
  const handleFileSelect = async (e) => {
    const files = Array.from(e.target.files || []);
    e.target.value = "";
    if (files.length === 0) return;
    setError("");

    const room = MAX_ITEMS - itemsRef.current.length;
    if (room <= 0) {
      setError(`You can add up to ${MAX_ITEMS} items to a story.`);
      return;
    }

    const problems = [];
    const picked = files.slice(0, room);
    if (files.length > room) {
      problems.push(
        `Only ${MAX_ITEMS} items fit in one story, so ${files.length - room} were skipped.`
      );
    }

    const accepted = [];
    for (const file of picked) {
      const isImage = file.type.startsWith("image/");
      const isVideo = file.type.startsWith("video/");
      if (!isImage && !isVideo) {
        problems.push(`"${file.name}" isn't a photo or video.`);
        continue;
      }

      let duration = null;
      if (isVideo) {
        duration = await readVideoDuration(file);
        if (duration && duration > MAX_VIDEO_SECONDS) {
          problems.push(
            `"${file.name}" is ${Math.round(duration)}s long (max ${MAX_VIDEO_SECONDS}s).`
          );
          continue;
        }
      }

      saveRecent(file, isImage ? "image" : "video", duration);
      accepted.push({
        id: newId(),
        file,
        preview: URL.createObjectURL(file),
        type: isImage ? "image" : "video",
        duration,
        caption: "",
      });
    }

    if (accepted.length > 0) {
      const firstNewIndex = itemsRef.current.length;
      setItems((prev) => [...prev, ...accepted]);
      setSel(firstNewIndex);
    }
    if (problems.length > 0) setError(problems.join(" "));
  };

  // Text / Music / Layout / Voice composers hand back a ready story image.
  const handleComposed = (partial) => {
    const firstNewIndex = itemsRef.current.length;
    setItems((prev) => [
      ...prev,
      {
        id: newId(),
        preview: URL.createObjectURL(partial.file),
        duration: null,
        caption: "",
        ...partial,
      },
    ]);
    setSel(firstNewIndex);
    setError("");
    setView("home");
  };

  // Recents grid: tap to select, "Next" moves the selection into the editor.
  const toggleSelected = (id) => {
    setError("");
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else if (next.size >= MAX_ITEMS) setError(`You can pick up to ${MAX_ITEMS}.`);
      else next.add(id);
      return next;
    });
  };

  const useSelected = () => {
    const chosen = recents.filter((r) => selected.has(r.id)).slice(0, MAX_ITEMS);
    if (chosen.length === 0) return;
    setItems((prev) => [
      ...prev,
      ...chosen.map((r) => ({
        id: newId(),
        file: r.file,
        preview: URL.createObjectURL(r.file),
        type: r.type,
        duration: r.duration || null,
        caption: "",
      })),
    ]);
    setSel(itemsRef.current.length);
    setSelected(new Set());
  };

  const removeItem = (idx) => {
    if (posting) return;
    const target = itemsRef.current[idx];
    if (target) URL.revokeObjectURL(target.preview);
    const nextLen = itemsRef.current.length - 1;
    setItems((prev) => prev.filter((_, i) => i !== idx));
    setSel((s) => {
      if (nextLen <= 0) return 0;
      if (idx < s) return s - 1;
      return Math.min(s, nextLen - 1);
    });
    setError("");
  };

  const setCaptionForSelected = (value) => {
    setItems((prev) =>
      prev.map((it, i) => (i === sel ? { ...it, caption: value } : it))
    );
  };

  const clearLink = () => {
    setLinkUrl("");
    setLinkLabel("");
    setShowLink(false);
  };

  const handleShare = async () => {
    if (items.length === 0 || posting) return;
    setError("");

    // Check the link BEFORE uploading, so a typo doesn't waste uploads.
    let cleanLink = null;
    if (linkUrl.trim()) {
      cleanLink = normalizeLinkUrl(linkUrl);
      if (!cleanLink) {
        setShowLink(true);
        setError(
          "That link doesn't look right. Use a web address like zixplon.in/page or https://example.com."
        );
        return;
      }
    }

    setPosting(true);
    setProgress(0);

    const queue = [...items]; // snapshot, in display order
    const total = queue.length;

    try {
      // 1) Upload everything first (sequentially, to keep progress simple).
      const uploaded = [];
      for (let i = 0; i < total; i++) {
        const it = queue[i];
        setStage(`Uploading ${i + 1} of ${total}…`);
        const onPct = (pct) =>
          setProgress(Math.round(((i + pct / 100) / total) * 100));

        let mediaUrl;
        if (it.type === "image") {
          const { url } = await uploadToR2(it.file, onPct);
          // Stories are shown full-screen, so a larger width than posts.
          mediaUrl = buildTransformUrl(url, { width: 1080, quality: 85 });
        } else {
          const { url } = await uploadVideoToR2(it.file, onPct);
          mediaUrl = url;
        }

        // A story's own song (Music status) wins over the shared one.
        let itemSong = it.song || song || null;
        if (it.voiceFile) {
          // Voice status: the clip is stored like a song, flagged voice: true.
          const { url: audioUrl } = await uploadToR2(it.voiceFile);
          itemSong = { title: "Voice message", artist: "", url: audioUrl, voice: true };
        }
        uploaded.push({ item: it, mediaUrl, itemSong });
      }

      // 2) Insert the rows ONE AT A TIME, in order, so created_at keeps the
      //    order shown (the viewer plays oldest -> newest).
      setStage("Sharing…");
      const created = [];
      try {
        for (const { item, mediaUrl, itemSong } of uploaded) {
          const { data, error: insertErr } = await supabase
            .from("stories")
            .insert({
              username: currentUser,
              media_url: mediaUrl,
              media_type: item.type,
              caption: item.caption.trim() || null,
              duration_seconds: item.duration,
              song: itemSong,
              ai_generated: aiGenerated,
              link_url: cleanLink,
              link_label: cleanLink ? linkLabel.trim() || null : null,
            })
            .select()
            .single();
          if (insertErr) throw insertErr;
          created.push({ row: data, itemId: item.id });
        }
      } catch (insertErr) {
        // Some may already be live — show them, and remove them from the
        // list so a retry doesn't post them twice.
        if (created.length > 0) {
          onCreated?.(created.map((c) => c.row));
          const postedIds = new Set(created.map((c) => c.itemId));
          setItems((prev) => prev.filter((it) => !postedIds.has(it.id)));
          setSel(0);
          throw new Error(
            `${created.length} of ${total} were shared, but the rest failed: ${
              insertErr.message || "please try again."
            }`
          );
        }
        throw insertErr;
      }

      onCreated?.(created.map((c) => c.row));
      animateClose();
    } catch (err) {
      setError(err.message || "Couldn't share your story. Please try again.");
    } finally {
      setPosting(false);
      setStage("");
    }
  };

  const current = items[sel];
  const atLimit = items.length >= MAX_ITEMS;
  const onAddScreen = view === "home" && items.length === 0;
  const inEditor = view === "home" && items.length > 0;
  const title = onAddScreen
    ? "Add status"
    : view === "home"
      ? "Create story"
      : VIEW_TITLES[view];

  const visibleRecents = recents.filter((r) => filter === "all" || r.type === filter);

  return createPortal(
    <div
      className={`pf-modal-overlay${open ? " open" : ""}`}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) requestClose();
      }}
    >
      <div
        className="pf-modal-panel"
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="pf-modal-header zx-add-header">
          <button
            type="button"
            className="pf-modal-close"
            onClick={view === "home" ? requestClose : () => setView("home")}
            aria-label={view === "home" ? "Close" : "Back"}
          >
            {view === "home" ? "✕" : "←"}
          </button>
          <span className="pf-modal-title">{title}</span>
        </div>

        <div className="pf-story-create-body">
          {/* ───── Add status screen ───── */}
          {onAddScreen && (
            <div className="zx-add-home">
              <div className="zx-add-modes">
                {MODES.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    className="zx-mode"
                    onClick={() => {
                      setError("");
                      setView(m.id);
                    }}
                  >
                    <span className="zx-mode-icon">{m.icon}</span>
                    <span>{m.label}</span>
                  </button>
                ))}
              </div>

              <div className="zx-add-filter">
                <select
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  aria-label="Filter gallery"
                >
                  {FILTERS.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="zx-add-grid">
                {/* Camera tile: take a photo or record a video */}
                <div className="zx-add-tile zx-cam">
                  <label className="zx-cam-half">
                    <span aria-hidden="true">📷</span>
                    Photo
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      hidden
                      onChange={handleFileSelect}
                    />
                  </label>
                  <label className="zx-cam-half">
                    <span aria-hidden="true">🎥</span>
                    Video
                    <input
                      type="file"
                      accept="video/*"
                      capture="environment"
                      hidden
                      onChange={handleFileSelect}
                    />
                  </label>
                </div>

                {/* Gallery tile: the browser's own file / photo picker */}
                <label className="zx-add-tile zx-gallery">
                  <span aria-hidden="true">🖼️</span>
                  Gallery
                  <input
                    type="file"
                    accept="image/*,video/*"
                    multiple
                    hidden
                    onChange={handleFileSelect}
                  />
                </label>

                {visibleRecents.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    className={`zx-add-tile zx-recent${selected.has(r.id) ? " picked" : ""}`}
                    onClick={() => toggleSelected(r.id)}
                    aria-pressed={selected.has(r.id)}
                    aria-label={`${r.type} ${r.file.name}`}
                  >
                    {r.type === "image" ? (
                      <img src={r.url} alt="" draggable={false} loading="lazy" />
                    ) : (
                      <>
                        <video src={`${r.url}#t=0.1`} preload="metadata" muted playsInline />
                        <span className="zx-recent-badge">🎥 {formatDuration(r.duration)}</span>
                      </>
                    )}
                    {selected.has(r.id) && <span className="zx-recent-check">✓</span>}
                  </button>
                ))}
              </div>

              {visibleRecents.length === 0 && (
                <small className="zx-hint">
                  Photos and videos you pick appear here for quick access next time.
                </small>
              )}

              {selected.size > 0 && (
                <div className="zx-add-bar">
                  <span>{selected.size} selected</span>
                  <button type="button" className="pf-post-btn" onClick={useSelected}>
                    Next
                  </button>
                </div>
              )}
            </div>
          )}

          {view === "text" && <TextComposer onDone={handleComposed} />}
          {view === "music" && <MusicComposer onDone={handleComposed} />}
          {view === "layout" && <LayoutComposer onDone={handleComposed} />}
          {view === "voice" && <VoiceComposer onDone={handleComposed} />}

          {/* ───── Editor (same as before) ───── */}
          {inEditor && (
            <>
              {/* Large preview of the selected item */}
              <div className="pf-story-preview">
                {current.type === "image" ? (
                  <img key={current.id} src={current.preview} alt="Story preview" />
                ) : (
                  <video
                    key={current.id}
                    src={current.preview}
                    controls
                    muted
                    loop
                    playsInline
                  />
                )}
                {items.length > 1 && (
                  <span className="pf-story-preview-count">
                    {sel + 1} / {items.length}
                  </span>
                )}
              </div>

              {/* Thumbnail strip: switch, remove, add more */}
              <div className="pf-story-thumbs">
                {items.map((it, i) => (
                  <div
                    key={it.id}
                    className={`pf-story-thumb${i === sel ? " active" : ""}`}
                  >
                    <button
                      type="button"
                      className="pf-story-thumb-main"
                      onClick={() => setSel(i)}
                      aria-label={`Show item ${i + 1}`}
                    >
                      {it.type === "image" ? (
                        <img src={it.preview} alt="" draggable={false} />
                      ) : (
                        <>
                          <video
                            src={`${it.preview}#t=0.1`}
                            preload="metadata"
                            muted
                            playsInline
                          />
                          <span className="pf-story-thumb-play">▶</span>
                        </>
                      )}
                    </button>
                    {!posting && (
                      <button
                        type="button"
                        className="pf-story-thumb-remove"
                        onClick={() => removeItem(i)}
                        aria-label={`Remove item ${i + 1}`}
                      >
                        ✕
                      </button>
                    )}
                  </div>
                ))}

                {!atLimit && !posting && (
                  <label className="pf-story-thumb pf-story-thumb--add" title="Add more">
                    <span>+</span>
                    <input
                      type="file"
                      accept="image/*,video/*"
                      multiple
                      hidden
                      onChange={handleFileSelect}
                    />
                  </label>
                )}
              </div>

              {/* Caption for the selected item */}
              <input
                type="text"
                className="pf-story-caption-input"
                placeholder={
                  items.length > 1
                    ? `Caption for item ${sel + 1} (optional)…`
                    : "Add a caption (optional)…"
                }
                maxLength={CAPTION_MAX}
                value={current.caption}
                onChange={(e) => setCaptionForSelected(e.target.value)}
                disabled={posting}
              />

              {/* Music + Link (apply to all items) */}
              <div className="pf-story-addons">
                <div className="pf-story-addon-wrap">
                  <button
                    type="button"
                    className="pf-story-addon-btn"
                    onClick={() => setShowMusicPicker((v) => !v)}
                    disabled={posting}
                  >
                    🎵 {song ? "Change music" : "Add music"}
                  </button>
                  {showMusicPicker && (
                    <MusicPicker
                      anchor="left"
                      position="bottom"
                      onSelect={(s) => setSong(s)}
                      onClose={() => setShowMusicPicker(false)}
                    />
                  )}
                </div>

                {song && (
                  <span className="pf-story-song-chip">
                    🎵 {song.title}
                    {song.artist ? ` · ${song.artist}` : ""}
                    <button
                      type="button"
                      onClick={() => setSong(null)}
                      aria-label="Remove music"
                      disabled={posting}
                    >
                      ✕
                    </button>
                  </span>
                )}

                <div className="pf-story-addon-wrap">
                  <button
                    type="button"
                    className="pf-story-addon-btn"
                    onClick={() => setShowLink((v) => !v)}
                    disabled={posting}
                  >
                    🔗 {linkUrl.trim() ? "Edit link" : "Add link"}
                  </button>
                </div>
              </div>

              {items.length > 1 && (song || linkUrl.trim() || aiGenerated) && (
                <small className="pf-story-apply-note">
                  Music, link and the AI label are added to all {items.length} items.
                </small>
              )}

              {showLink && (
                <>
                  <input
                    type="text"
                    inputMode="url"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    className="pf-story-caption-input"
                    placeholder="Paste a link (e.g. zixplon.in/page)…"
                    value={linkUrl}
                    onChange={(e) => {
                      setLinkUrl(e.target.value);
                      setError("");
                    }}
                    disabled={posting}
                  />
                  <input
                    type="text"
                    className="pf-story-caption-input"
                    placeholder="Button text (optional, e.g. Watch now)"
                    maxLength={LINK_LABEL_MAX}
                    value={linkLabel}
                    onChange={(e) => setLinkLabel(e.target.value)}
                    disabled={posting}
                  />
                  {(linkUrl || linkLabel) && (
                    <button
                      type="button"
                      className="pf-story-addon-btn"
                      onClick={clearLink}
                      disabled={posting}
                    >
                      ✕ Remove link
                    </button>
                  )}
                </>
              )}

              <label className="pf-story-ai-toggle">
                <input
                  type="checkbox"
                  checked={aiGenerated}
                  onChange={(e) => setAiGenerated(e.target.checked)}
                  disabled={posting}
                />
                <span>
                  <b>This contains AI-generated content</b>
                  <small>Viewers will see an "AI-generated" label on your story.</small>
                </span>
              </label>
            </>
          )}

          {posting && (
            <div className="pf-progress-wrap">
              <div className="pf-progress-bar-track">
                <div
                  className="pf-progress-bar"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <span className="pf-progress-label">{stage || `${progress}%`}</span>
            </div>
          )}

          {error && <p className="pf-error">{error}</p>}

          {inEditor && (
            <button
              type="button"
              className="pf-post-btn pf-story-share-btn"
              onClick={handleShare}
              disabled={posting}
            >
              {posting
                ? "Sharing…"
                : items.length > 1
                  ? `Share ${items.length} to story`
                  : "Share to story"}
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};

export default StoryCreator;