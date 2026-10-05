// src/hooks/useCall.js
// npm i livekit-client
import { useCallback, useEffect, useRef, useState } from "react";
import { Room, RoomEvent, Track } from "livekit-client";
import { supabase } from "../config/supabase";
import { useRingtone } from "./useRingtone"; // loud looping ringtone for the receiver

// Fallback only. The server URL normally comes back from /api/call-token.
const LIVEKIT_URL = process.env.REACT_APP_LIVEKIT_URL;
const RING_TIMEOUT_MS = 40000; // caller gives up after this
const STALE_RING_MS = 45000; // callee ignores rings older than this
const FINAL = ["declined", "missed", "ended", "busy", "cancelled"];

// Rejects after `ms` so a stuck step shows an error instead of "Connecting..." forever.
const timeoutAfter = (ms, label) =>
  new Promise((_, reject) =>
    setTimeout(() => reject(new Error(`${label} timed out`)), ms),
  );

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
  // call: { id, role: 'caller'|'callee', peer (username), status, roomName, connectedAt }
  // status: incoming | ringing | connecting | connected
  const [call, setCall] = useState(null);
  const [muted, setMuted] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState(null);
  const [audioBlocked, setAudioBlocked] = useState(false);

  // Ring loudly (and vibrate) on the RECEIVER's device while an incoming call
  // is waiting to be answered. Stops automatically when call.status changes.
  useRingtone(!!call && call.role === "callee" && call.status === "incoming");

  const callRef = useRef(null);
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
    audioEls.current.forEach((el) => el.remove());
    audioEls.current = [];
    const room = roomRef.current;
    roomRef.current = null;
    if (room) room.disconnect();
    setMuted(false);
    setSeconds(0);
    setAudioBlocked(false);
  }, []);

  // Single exit point. outcome: declined | missed | ended | busy | cancelled
  const finish = useCallback(
    async (outcome, opts = {}) => {
      const c = callRef.current;
      if (!c) return;
      const duration = c.connectedAt
        ? Math.round((Date.now() - c.connectedAt) / 1000)
        : 0;
      setBoth(null);
      teardown();
      if (!opts.fromRemote) {
        await supabase
          .from("calls")
          .update({ status: outcome, ended_at: new Date().toISOString() })
          .eq("id", c.id)
          .in("status", ["ringing", "accepted"]); // never overwrite a final state
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
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData && sessionData.session && sessionData.session.access_token;
      const res = await fetch("/api/call-token", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify({ callId: c.id }),
      });
      if (!res.ok) {
        let detail = "";
        try {
          detail = (await res.json()).error || "";
        } catch (_) {}
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
        audioCaptureDefaults: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      roomRef.current = room;
      room
        .on(RoomEvent.SignalConnected, () => {
          stage = "signal ok";
        })
        .on(RoomEvent.TrackSubscribed, (track) => {
          if (track.kind !== Track.Kind.Audio) return;
          const el = track.attach();
          el.style.display = "none";
          // Never paused by usePauseMediaWhileOpen, so you can still hear the
          // other person while the chat panel is open.
          el.dataset.keepPlaying = "1";
          document.body.appendChild(el);
          audioEls.current.push(el);
        })
        .on(RoomEvent.ParticipantDisconnected, () => finish("ended"))
        .on(RoomEvent.Disconnected, () => finish("ended"))
        .on(RoomEvent.AudioPlaybackStatusChanged, () =>
          setAudioBlocked(!room.canPlaybackAudio),
        )
        .on(RoomEvent.ConnectionStateChanged, (s) =>
          console.log("LiveKit state:", s),
        );

      await Promise.race([
        room.connect(serverUrl, token),
        new Promise((_, reject) =>
          setTimeout(
            () => reject(new Error(`Call server timed out [${host}] [${stage}]`)),
            15000,
          ),
        ),
      ]);
      await Promise.race([
        room.localParticipant.setMicrophoneEnabled(true),
        timeoutAfter(10000, "Microphone"),
      ]);

      if (!callRef.current || callRef.current.id !== c.id) {
        room.disconnect();
        return;
      }
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

  const startCall = useCallback(
    async (peer) => {
      if (!currentUser || !peer || callRef.current || peer === currentUser) return;
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

      // Ask for the mic on the tap, so the permission prompt appears right away.
      try {
        const s = await navigator.mediaDevices.getUserMedia({ audio: true });
        s.getTracks().forEach((t) => t.stop());
      } catch (e) {
        setError("Microphone access is blocked. Allow it in your browser settings to make calls.");
        return;
      }

      const { data, error: err } = await supabase
        .from("calls")
        .insert({
          caller_username: currentUser,
          callee_username: peer,
          room_name: `call_${crypto.randomUUID()}`,
        })
        .select()
        .single();
      if (err || !data) {
        setError("Could not start the call. Try again.");
        return;
      }

      setBoth({ id: data.id, role: "caller", peer, status: "ringing", roomName: data.room_name });
      ringTimer.current = setTimeout(() => finish("missed"), RING_TIMEOUT_MS);
    },
    [currentUser, finish, setBoth],
  );

  const accept = useCallback(async () => {
    const c = callRef.current;
    if (!c || c.role !== "callee" || c.status !== "incoming") return;
    clearTimeout(ringTimer.current);

    // Ask for the mic on the Accept tap, so the permission prompt appears
    // right away instead of stalling the connection later.
    try {
      const s = await navigator.mediaDevices.getUserMedia({ audio: true });
      s.getTracks().forEach((t) => t.stop());
    } catch (e) {
      setError("Microphone access is blocked. Allow it in your browser settings to answer calls.");
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
      setError(e.message);
      finish("ended");
    }
  }, [connect, finish, setBoth]);

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

  const enableAudio = useCallback(async () => {
    if (roomRef.current) {
      await roomRef.current.startAudio();
      setAudioBlocked(false);
    }
  }, []);

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
          setError(e.message);
          finish("ended");
        });
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
    startCall,
    accept,
    hangUp,
    toggleMute,
    enableAudio,
    dismissError: () => setError(null),
  };
}