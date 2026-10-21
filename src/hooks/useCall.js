// src/hooks/useCall.js
// npm i livekit-client
// Voice AND video calls. A call is "video" when its room_name starts with
// "vcall_" (no database change needed). A voice call can be upgraded to
// video at any time with toggleCamera().
import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../config/supabase";
import { useRingtone } from "./useRingtone"; // loud looping ringtone for the receiver
import {
  Room,
  RoomEvent,
  Track,
  VideoPresets,
  LocalAudioTrack,
  LocalVideoTrack,
} from "livekit-client";

// Fallback only. The server URL normally comes back from /api/call-token.
const LIVEKIT_URL = process.env.REACT_APP_LIVEKIT_URL;
const RING_TIMEOUT_MS = 40000; // caller gives up after this
const STALE_RING_MS = 45000; // callee ignores rings older than this
const FINAL = ["declined", "missed", "ended", "busy", "cancelled"];
const VIDEO_ROOM_PREFIX = "vcall_";

// Rejects after `ms` so a stuck step shows an error instead of "Connecting..." forever.
const timeoutAfter = (ms, label) =>
  new Promise((_, reject) =>
    setTimeout(() => reject(new Error(`${label} timed out`)), ms),
  );

// Constraints for the permission check that happens on the tap. For a VIDEO
// call this stream is KEPT and handed to the call (see preStreamRef), so the
// camera is opened only once.
const callMediaConstraints = (video) => ({
  audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
  video: video ? { facingMode: "user", width: { ideal: 960 }, height: { ideal: 540 } } : false,
});

// Turns a camera failure into a message that says what to do about it.
const describeCameraError = (e) => {
  const msg = String((e && e.message) || "");
  if (e && (e.name === "NotAllowedError" || e.name === "SecurityError")) {
    return "Camera access is blocked. Allow the camera for this site in your browser settings, then turn it on again.";
  }
  if (e && e.name === "NotReadableError") {
    return "Your camera is being used by another app. Close it, then turn the camera on again.";
  }
  if (e && (e.name === "NotFoundError" || e.name === "OverconstrainedError")) {
    return "No camera was found on this device.";
  }
  if (/starting camera and microphone/i.test(msg)) {
    return "Video couldn't be started (timed out). Either the camera didn't respond or its video couldn't reach the call server. Check your network, close other apps using the camera, and try again.";
  }
  if (/opening the camera/i.test(msg)) {
    return "Your camera didn't respond (timed out while opening it). Close other apps or tabs that use the camera, then turn it on again.";
  }
  if (/sending the camera/i.test(msg)) {
    return "Your camera works, but its video couldn't be sent to the call server (timed out). This looks like a network or call-server problem, not a permission one.";
  }
  if (/timed out/i.test(msg)) {
    return "The camera timed out. Please try again.";
  }
  return `Couldn't start your camera${msg ? `: ${msg}` : "."}`;
};

// A call is only allowed between two people who have an accepted chat and
// haven't blocked each other (same rules as sending a message).
const canCall = async (me, other) => {
  const [user_a, user_b] = [me, other].sort();
  const [blocksRes, convoRes] = await Promise.all([
    supabase
      .from("user_blocks")
      .select("blocker")
      .or(
        `and(blocker.eq.${me},blocked.eq.${other}),and(blocker.eq.${other},blocked.eq.${me})`,
      )
      .limit(1),
    supabase
      .from("conversations")
      .select("id,status")
      .eq("user_a", user_a)
      .eq("user_b", user_b)
      .maybeSingle(),
  ]);
  if (blocksRes.data && blocksRes.data.length) return { ok: false, reason: "blocked" };
  const convo = convoRes.data;
  if (!convo || (convo.status || "accepted") !== "accepted") {
    return { ok: false, reason: "not-accepted" };
  }
  return { ok: true };
};

export default function useCall(currentUser, { onCallEnded } = {}) {
  // call: { id, role: 'caller'|'callee', peer (username), status, roomName, connectedAt, video }
  // status: incoming | ringing | connecting | connected
  const [call, setCall] = useState(null);
  const [muted, setMuted] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState(null);
  const [audioBlocked, setAudioBlocked] = useState(false);
  // Which connection step is running ("Joining the call server…" etc.) —
  // shown under "Connecting…" so a stuck call shows WHERE it is stuck.
  const [connectStage, setConnectStage] = useState("");

  // ---- video state ----
  const [cameraOn, setCameraOn] = useState(false); // my camera is publishing
  const [facing, setFacing] = useState("user"); // "user" (front) | "environment" (back)
  const [localVideo, setLocalVideo] = useState(null); // my LocalVideoTrack
  const [remoteVideo, setRemoteVideo] = useState(null); // their RemoteVideoTrack
  const [remoteCamOff, setRemoteCamOff] = useState(false); // they paused their camera

  // Ring loudly (and vibrate) on the RECEIVER's device while an incoming call
  // is waiting to be answered. Stops automatically when call.status changes.
  useRingtone(!!call && call.role === "callee" && call.status === "incoming");

  const callRef = useRef(null);
  // Camera+mic stream opened on the Call/Accept tap (video calls only). It is
  // handed to the call so the camera is not opened a second time.
  const preStreamRef = useRef(null);
  const roomRef = useRef(null);
  const audioEls = useRef([]);
  const ringTimer = useRef(null);
  const onEndedRef = useRef(onCallEnded);
  onEndedRef.current = onCallEnded;

  const setBoth = useCallback((next) => {
    callRef.current = next;
    setCall(next);
  }, []);

  const teardown = useCallback(() => {
    clearTimeout(ringTimer.current);
    if (preStreamRef.current) {
      preStreamRef.current.getTracks().forEach((t) => t.stop());
      preStreamRef.current = null;
    }
    audioEls.current.forEach((el) => el.remove());
    audioEls.current = [];
    const room = roomRef.current;
    roomRef.current = null;
    if (room) room.disconnect(); // also stops my camera + mic tracks
    setMuted(false);
    setSeconds(0);
    setAudioBlocked(false);
    setConnectStage("");
    setCameraOn(false);
    setFacing("user");
    setLocalVideo(null);
    setRemoteVideo(null);
    setRemoteCamOff(false);
  }, []);

  // Single exit point. outcome: declined | missed | ended | busy | cancelled
  const finish = useCallback(
    async (outcome, opts = {}) => {
      const c = callRef.current;
      if (!c) return;
      const duration = c.connectedAt
        ? Math.round((Date.now() - c.connectedAt) / 1000)
        : 0;
      // The other person's device gave up while we were still connecting.
      if (opts.fromRemote && outcome === "ended" && c.status === "connecting") {
        setError("The other person's call couldn't connect. Please try again.");
      } else if (opts.fromRemote && outcome === "ended" && c.video && duration < 20) {
        setError(
          "The other person's device ended the video call after a few seconds. If it ended unexpectedly, check that device for an error message (camera or connection problem).",
        );
      }
      setBoth(null);
      teardown();
      if (!opts.fromRemote) {
        await supabase
          .from("calls")
          .update({ status: outcome, ended_at: new Date().toISOString() })
          .eq("id", c.id)
          // A "missed" timer may only close a call that is still ringing; it
          // must never overwrite one that has already been answered.
          .in("status", outcome === "missed" ? ["ringing"] : ["ringing", "accepted"]);
      }
      // Only the caller writes the chat history entry, so it isn't duplicated.
      if (c.role === "caller" && onEndedRef.current) {
        onEndedRef.current({ call: c, outcome, duration });
      }
    },
    [setBoth, teardown],
  );

  const connect = useCallback(
    async (c) => {
      setConnectStage("Securing the call…");
      const requestToken = (accessToken) =>
        fetch("/api/call-token", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
          },
          body: JSON.stringify({ callId: c.id }),
        });

      // Use a fresh login token: refresh it first if it's missing or about to expire.
      const { data: sessionData } = await supabase.auth.getSession();
      let session = sessionData && sessionData.session;
      if (!session || (session.expires_at && session.expires_at * 1000 < Date.now() + 60000)) {
        const { data: refreshed } = await supabase.auth.refreshSession();
        if (refreshed && refreshed.session) session = refreshed.session;
      }
      let res = await requestToken(session && session.access_token);

      // Still rejected as signed out: force one refresh and retry once.
      if (res.status === 401) {
        const { data: refreshed } = await supabase.auth.refreshSession();
        if (refreshed && refreshed.session) {
          res = await requestToken(refreshed.session.access_token);
        }
      }

      if (!res.ok) {
        let detail = "";
        try {
          detail = (await res.json()).error || "";
        } catch (_) {}
        if (res.status === 401) {
          throw new Error("Your login has expired. Please log out and log back in.");
        }
        throw new Error(
          `Could not join the call (${res.status}${detail ? ": " + detail : ""})`,
        );
      }
      const { token, url } = await res.json();
      // .trim() removes any stray space/newline pasted into the env var.
      const serverUrl = (url || LIVEKIT_URL || "").trim();
      if (!serverUrl) throw new Error("Call server URL is not configured.");

      // For the error message only: which server we tried, and how far we got.
      let host = "bad-url";
      try {
        host = new URL(serverUrl.replace(/^ws/, "http")).host;
      } catch (_) {}
      let stage = "no signal";

      const room = new Room({
        // Send only the video quality the receiver can use; saves mobile data.
        adaptiveStream: true,
        dynacast: true,
        audioCaptureDefaults: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        videoCaptureDefaults: {
          facingMode: "user",
          resolution: VideoPresets.h540.resolution,
        },
      });
      roomRef.current = room;
      room
        .on(RoomEvent.SignalConnected, () => {
          stage = "signal ok";
        })
        .on(RoomEvent.TrackSubscribed, (track, publication) => {
          if (track.kind === Track.Kind.Video) {
            setRemoteVideo(track);
            setRemoteCamOff(!!(publication && publication.isMuted));
            return;
          }
          if (track.kind !== Track.Kind.Audio) return;
          const el = track.attach();
          el.style.display = "none";
          // Never paused by usePauseMediaWhileOpen, so you can still hear the
          // other person while the chat panel is open.
          el.dataset.keepPlaying = "1";
          document.body.appendChild(el);
          audioEls.current.push(el);
        })
        .on(RoomEvent.TrackUnsubscribed, (track) => {
          if (track.kind === Track.Kind.Video) {
            setRemoteVideo(null);
            setRemoteCamOff(false);
          }
        })
        // The other person paused / resumed their camera.
        .on(RoomEvent.TrackMuted, (publication, participant) => {
          if (publication.kind === Track.Kind.Video && participant !== room.localParticipant) {
            setRemoteCamOff(true);
          }
        })
        .on(RoomEvent.TrackUnmuted, (publication, participant) => {
          if (publication.kind === Track.Kind.Video && participant !== room.localParticipant) {
            setRemoteCamOff(false);
          }
        })
        // My own camera started publishing (also covers upgrading a voice call).
        .on(RoomEvent.LocalTrackPublished, (publication) => {
          if (publication.kind === Track.Kind.Video && publication.track) {
            setLocalVideo(publication.track);
            setCameraOn(true);
          }
        })
        .on(RoomEvent.LocalTrackUnpublished, (publication) => {
          if (publication.kind === Track.Kind.Video) {
            setLocalVideo(null);
            setCameraOn(false);
          }
        })
        .on(RoomEvent.MediaDevicesError, (e) =>
          console.error("Media devices error:", e),
        )
        .on(RoomEvent.ParticipantDisconnected, () => finish("ended"))
        .on(RoomEvent.Disconnected, (reason) => {
          // Only when the call was still active: i.e. NOT caused by us hanging up.
          const stillActive = callRef.current && callRef.current.id === c.id;
          if (stillActive && reason !== 1) {
            const why = {
              2: "this account joined the call from another tab or device",
              3: "the call server restarted",
              4: "you were removed from the call",
              5: "the call room was closed",
              6: "the connection got out of sync",
              7: "joining the call failed",
              9: "the network connection was lost",
              10: "the call room was closed",
            }[reason];
            console.warn("LiveKit disconnected, reason code:", reason);
            setError(`The call was disconnected${why ? `: ${why}` : "."}`);
          }
          finish("ended");
        })
        .on(RoomEvent.AudioPlaybackStatusChanged, () =>
          setAudioBlocked(!room.canPlaybackAudio),
        )
        .on(RoomEvent.ConnectionStateChanged, (s) =>
          console.log("LiveKit state:", s),
        );

      // peerConnectionTimeout (30s) is the library's own limit; the outer
      // timeout (35s) is slightly longer so the library's error wins.
      setConnectStage("Joining the call server…");
      await Promise.race([
        room.connect(serverUrl, token, { peerConnectionTimeout: 30000 }),
        new Promise((_, reject) =>
          setTimeout(
            () => reject(new Error(`Call server timed out [${host}] [${stage}]`)),
            35000,
          ),
        ),
      ]);
      console.log("LiveKit permissions for this call:", room.localParticipant.permissions);

      // Voice call: just the microphone. Video call: camera + microphone are
      // started TOGETHER (one negotiation with the call server) and both must
      // work, so a video call never quietly turns into a voice call.
      if (!c.video) {
        setConnectStage("Starting microphone…");
        await Promise.race([
          room.localParticipant.setMicrophoneEnabled(true),
          timeoutAfter(10000, "Microphone"),
        ]);
      } else {
        setConnectStage("Starting camera and microphone…");
        const lp = room.localParticipant;
        const startMedia = async () => {
          // Preferred: publish the camera + mic that are ALREADY open.
          const pre = preStreamRef.current;
          const live =
            pre && pre.getTracks().length > 0 && pre.getTracks().every((t) => t.readyState === "live");
          if (live) {
            preStreamRef.current = null; // the call owns these tracks now
            const at = pre.getAudioTracks()[0];
            const vt = pre.getVideoTracks()[0];
            if (at) {
              await lp.publishTrack(new LocalAudioTrack(at), { source: Track.Source.Microphone });
            }
            if (vt) {
              await lp.publishTrack(new LocalVideoTrack(vt), { source: Track.Source.Camera });
            }
            return;
          }
          // Fallback: open them now.
          if (typeof lp.enableCameraAndMicrophone === "function") {
            await lp.enableCameraAndMicrophone();
          } else {
            await lp.setMicrophoneEnabled(true);
            await lp.setCameraEnabled(true);
          }
        };
        let mediaErr = null;
        for (let attempt = 1; attempt <= 2; attempt += 1) {
          try {
            await Promise.race([
              startMedia(),
              timeoutAfter(25000, "Starting camera and microphone"),
            ]);
            mediaErr = null;
            break;
          } catch (e) {
            mediaErr = e;
            console.error(`Video start failed (attempt ${attempt}):`, e);
            // Retrying can't fix a blocked permission, and a second attempt
            // while the first is still hanging could double-publish.
            if (
              e &&
              (e.name === "NotAllowedError" ||
                e.name === "SecurityError" ||
                /timed out/i.test(String(e.message || "")))
            ) {
              break;
            }
            await new Promise((r) => setTimeout(r, 700));
          }
        }
        if (mediaErr) {
          throw new Error(`${describeCameraError(mediaErr)} The video call was ended.`);
        }
      }

      if (!callRef.current || callRef.current.id !== c.id) {
        room.disconnect();
        return;
      }
      setConnectStage("");
      setBoth({ ...callRef.current, status: "connected", connectedAt: Date.now() });
    },
    [finish, setBoth],
  );

  const showIncoming = useCallback(
    async (row) => {
      const age = Date.now() - new Date(row.created_at).getTime();
      if (age > STALE_RING_MS) return;

      if (callRef.current) {
        // Already on a call: tell the new caller we're busy.
        if (callRef.current.id !== row.id) {
          await supabase
            .from("calls")
            .update({ status: "busy", ended_at: new Date().toISOString() })
            .eq("id", row.id)
            .eq("status", "ringing");
        }
        return;
      }

      // Blocked, or no accepted chat: decline silently, never ring.
      const check = await canCall(currentUser, row.caller_username);
      if (!check.ok) {
        await supabase
          .from("calls")
          .update({ status: "declined", ended_at: new Date().toISOString() })
          .eq("id", row.id)
          .eq("status", "ringing");
        return;
      }
      if (callRef.current) return; // something else started while we were checking

      setBoth({
        id: row.id,
        role: "callee",
        peer: row.caller_username,
        status: "incoming",
        roomName: row.room_name,
        video: String(row.room_name || "").startsWith(VIDEO_ROOM_PREFIX),
      });
      // Fallback if the caller vanished without marking the call missed.
      ringTimer.current = setTimeout(
        () => finish("missed"),
        Math.max(STALE_RING_MS - age, 0),
      );
    },
    [currentUser, finish, setBoth],
  );

  // ---- Public actions ----

  // startCall(peer)                  -> voice call
  // startCall(peer, { video: true }) -> video call
  const startCall = useCallback(
    async (peer, opts = {}) => {
      if (!currentUser || !peer || callRef.current || peer === currentUser) return;
      const wantVideo = !!(opts && opts.video === true);
      setError(null);

      const check = await canCall(currentUser, peer);
      if (!check.ok) {
        setError(
          check.reason === "blocked"
            ? "You can't call this user."
            : "Calls open up once your message request is accepted.",
        );
        return;
      }

      // Ask for the mic (and camera) on the tap, so the permission prompt appears right away.
      try {
        const s = await navigator.mediaDevices.getUserMedia(callMediaConstraints(wantVideo));
        if (wantVideo) {
          if (preStreamRef.current) preStreamRef.current.getTracks().forEach((t) => t.stop());
          preStreamRef.current = s; // kept: handed to the call, not opened twice
        } else {
          s.getTracks().forEach((t) => t.stop());
        }
      } catch (e) {
        setError(
          wantVideo
            ? "Camera or microphone access is blocked. Allow both in your browser settings to make video calls."
            : "Microphone access is blocked. Allow it in your browser settings to make calls.",
        );
        return;
      }

      const { data, error: err } = await supabase
        .from("calls")
        .insert({
          caller_username: currentUser,
          callee_username: peer,
          room_name: `${wantVideo ? VIDEO_ROOM_PREFIX : "call_"}${crypto.randomUUID()}`,
        })
        .select()
        .single();
      if (err || !data) {
        if (preStreamRef.current) {
          preStreamRef.current.getTracks().forEach((t) => t.stop());
          preStreamRef.current = null;
        }
        setError("Could not start the call. Try again.");
        return;
      }

      setBoth({
        id: data.id,
        role: "caller",
        peer,
        status: "ringing",
        roomName: data.room_name,
        video: wantVideo,
      });
      ringTimer.current = setTimeout(() => finish("missed"), RING_TIMEOUT_MS);
    },
    [currentUser, finish, setBoth],
  );

  // accept()                -> answer the call as it was placed
  // accept({ video:false }) -> answer a video call with voice only
  const accept = useCallback(
    async (opts) => {
      const c0 = callRef.current;
      if (!c0 || c0.role !== "callee" || c0.status !== "incoming") return;
      clearTimeout(ringTimer.current);

      const wantVideo = !!c0.video && !(opts && opts.video === false);
      const c = { ...c0, video: wantVideo };

      // Ask for the mic (and camera) on the Accept tap, so the permission prompt appears
      // right away instead of stalling the connection later.
      try {
        const s = await navigator.mediaDevices.getUserMedia(callMediaConstraints(wantVideo));
        if (wantVideo) {
          if (preStreamRef.current) preStreamRef.current.getTracks().forEach((t) => t.stop());
          preStreamRef.current = s; // kept: handed to the call, not opened twice
        } else {
          s.getTracks().forEach((t) => t.stop());
        }
      } catch (e) {
        setError(
          wantVideo
            ? "Camera or microphone access is blocked. Allow both in your browser settings to answer video calls."
            : "Microphone access is blocked. Allow it in your browser settings to answer calls.",
        );
        finish("declined");
        return;
      }

      setBoth({ ...c, status: "connecting" });

      const { data, error: err } = await supabase
        .from("calls")
        .update({ status: "accepted", started_at: new Date().toISOString() })
        .eq("id", c.id)
        .eq("status", "ringing")
        .select();
      if (err || !data || !data.length) {
        setError("This call has already ended.");
        finish("ended", { fromRemote: true });
        return;
      }
      try {
        await connect(c);
      } catch (e) {
        // The call was already ended (e.g. the other side hung up first):
        // the "disconnect" error is just fallout, so don't show it.
        if (!callRef.current || callRef.current.id !== c.id) return;
        console.error("Call connect failed:", e);
        setError(e.message);
        finish("ended");
      }
    },
    [connect, finish, setBoth],
  );

  const hangUp = useCallback(() => {
    const c = callRef.current;
    if (!c) return;
    if (c.status === "incoming") return finish("declined");
    if (c.status === "ringing") return finish("cancelled");
    return finish("ended");
  }, [finish]);

  const toggleMute = useCallback(async () => {
    const room = roomRef.current;
    if (!room) return;
    const next = !muted;
    await room.localParticipant.setMicrophoneEnabled(!next);
    setMuted(next);
  }, [muted]);

  // Camera on/off. Turning it on during a voice call upgrades it to video.
  const toggleCamera = useCallback(async () => {
    const room = roomRef.current;
    if (!room) return;
    const next = !cameraOn;
    try {
      await room.localParticipant.setCameraEnabled(next);
      setCameraOn(next);
    } catch (e) {
      console.error("Camera toggle failed:", e);
      setError(next ? describeCameraError(e) : "Couldn't turn off your camera.");
    }
  }, [cameraOn]);

  // Front <-> back camera.
  const switchCamera = useCallback(async () => {
    if (!localVideo) return;
    const next = facing === "user" ? "environment" : "user";
    try {
      await localVideo.restartTrack({ facingMode: next });
      setFacing(next);
    } catch (e) {
      setError("Couldn't switch cameras on this device.");
    }
  }, [localVideo, facing]);

  const enableAudio = useCallback(async () => {
    if (roomRef.current) {
      await roomRef.current.startAudio();
      setAudioBlocked(false);
    }
  }, []);

  // ---- Keep the screen awake while a call is being set up / in progress ----
  // Uses the Screen Wake Lock API (modern Chrome, Edge, Safari 16.4+).
  // The browser drops the lock whenever the tab is hidden, so it is
  // re-acquired when the tab becomes visible again.
  const callLive = !!call && (call.status === "connecting" || call.status === "connected");
  useEffect(() => {
    if (!callLive || !("wakeLock" in navigator)) return undefined;
    let lock = null;
    let cancelled = false;

    const acquire = async () => {
      try {
        const next = await navigator.wakeLock.request("screen");
        if (cancelled) {
          next.release().catch(() => {});
          return;
        }
        lock = next;
      } catch (_) {
        /* not allowed (battery saver, background tab) - calls still work */
      }
    };

    const onVisible = () => {
      if (document.visibilityState === "visible" && (!lock || lock.released)) acquire();
    };

    acquire();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisible);
      if (lock) lock.release().catch(() => {});
      lock = null;
    };
  }, [callLive]);

  // ---- Call controls on the lock screen / notification shade ----
  // Uses the Media Session API. Supported actions differ per browser, so
  // every call is wrapped in try/catch and simply skipped if unsupported.
  const callConnected = !!call && call.status === "connected";
  const peerName = call ? call.peer : "";
  const callIsVideo = !!call && (!!call.video || cameraOn || !!remoteVideo);
  useEffect(() => {
    if (!callConnected || !("mediaSession" in navigator)) return undefined;
    const ms = navigator.mediaSession;

    try {
      if (typeof window.MediaMetadata !== "undefined") {
        ms.metadata = new window.MediaMetadata({
          title: callIsVideo ? "Video call" : "Voice call",
          artist: peerName,
          album: "Zixplon",
          artwork: [
            { src: "/logo192.png", sizes: "192x192", type: "image/png" },
            { src: "/logo512.png", sizes: "512x512", type: "image/png" },
          ],
        });
      }
      ms.playbackState = "playing";
    } catch (_) {}

    const setHandler = (action, fn) => {
      try {
        ms.setActionHandler(action, fn);
      } catch (_) {
        /* this browser doesn't support that action */
      }
    };
    setHandler("hangup", () => hangUp());
    setHandler("togglemicrophone", () => toggleMute());
    setHandler("togglecamera", () => toggleCamera());

    return () => {
      setHandler("hangup", null);
      setHandler("togglemicrophone", null);
      setHandler("togglecamera", null);
      try {
        ms.metadata = null;
        ms.playbackState = "none";
      } catch (_) {}
    };
  }, [callConnected, callIsVideo, peerName, hangUp, toggleMute, toggleCamera]);

  // Keep the lock-screen microphone indicator in sync with mute (Chrome 93+).
  useEffect(() => {
    if (!callConnected || !("mediaSession" in navigator)) return;
    try {
      if (typeof navigator.mediaSession.setMicrophoneActive === "function") {
        navigator.mediaSession.setMicrophoneActive(!muted);
      }
      if (typeof navigator.mediaSession.setCameraActive === "function") {
        navigator.mediaSession.setCameraActive(cameraOn);
      }
    } catch (_) {}
  }, [callConnected, muted, cameraOn]);

  // ---- Realtime signaling ----
  useEffect(() => {
    if (!currentUser) return undefined;

    const onUpdate = (payload) => {
      const row = payload.new;
      const c = callRef.current;
      if (!c || row.id !== c.id) return;
      if (row.status === "accepted" && c.role === "caller" && c.status === "ringing") {
        clearTimeout(ringTimer.current);
        setBoth({ ...c, status: "connecting" });
        connect(c).catch((e) => {
          if (!callRef.current || callRef.current.id !== c.id) return;
          console.error("Call connect failed:", e);
          setError(e.message);
          finish("ended");
        });
      } else if (
        row.status === "accepted" &&
        c.role === "callee" &&
        c.status === "incoming"
      ) {
        // Answered on another tab/device of mine: just stop ringing here.
        clearTimeout(ringTimer.current);
        setBoth(null);
        teardown();
      } else if (FINAL.includes(row.status)) {
        finish(row.status, { fromRemote: true });
      }
    };

    const channel = supabase
      .channel(`calls:${currentUser}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "calls", filter: `callee_username=eq.${currentUser}` },
        (p) => {
          if (p.new.status === "ringing") showIncoming(p.new);
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "calls", filter: `callee_username=eq.${currentUser}` },
        onUpdate,
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "calls", filter: `caller_username=eq.${currentUser}` },
        onUpdate,
      )
      .subscribe();

    // Opened the app from a notification: pick up a call that is still ringing.
    (async () => {
      const since = new Date(Date.now() - STALE_RING_MS).toISOString();
      const { data } = await supabase
        .from("calls")
        .select("*")
        .eq("callee_username", currentUser)
        .eq("status", "ringing")
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(1);
      if (data && data[0] && !callRef.current) showIncoming(data[0]);
    })();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUser, connect, finish, showIncoming, setBoth]);

  // Call timer
  useEffect(() => {
    if (!call || call.status !== "connected") return undefined;
    const t = setInterval(
      () => setSeconds(Math.floor((Date.now() - call.connectedAt) / 1000)),
      1000,
    );
    return () => clearInterval(t);
  }, [call]);

  // Leave the room if the app unmounts mid-call.
  useEffect(() => () => teardown(), [teardown]);

  return {
    call,
    muted,
    seconds,
    error,
    audioBlocked,
    connectStage,
    // video
    cameraOn,
    facing,
    localVideo,
    remoteVideo,
    remoteCamOff,
    startCall,
    accept,
    hangUp,
    toggleMute,
    toggleCamera,
    switchCamera,
    enableAudio,
    dismissError: () => setError(null),
  };
}