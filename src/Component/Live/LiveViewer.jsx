import React, { useEffect, useRef, useState } from "react";
import { supabase } from "../../config/supabase";
import { Room, RoomEvent } from "livekit-client";

// Shows a list of currently-live streams; click one to watch.
const LiveBrowser = ({ currentUser }) => {
  const [streams, setStreams] = useState([]);
  const [activeRoom, setActiveRoom] = useState(null);

  useEffect(() => {
    const fetchLive = async () => {
      const { data } = await supabase
        .from("live_streams")
        .select("*")
        .eq("is_live", true)
        .order("started_at", { ascending: false });
      setStreams(data || []);
    };
    fetchLive();
    const interval = setInterval(fetchLive, 8000);
    return () => clearInterval(interval);
  }, []);

  if (activeRoom) {
    return (
      <LiveWatch
        roomName={activeRoom}
        currentUser={currentUser}
        onLeave={() => setActiveRoom(null)}
      />
    );
  }

  return (
    <div style={{ padding: "0" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "10px",
          marginBottom: "14px",
        }}
      >
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: "24px",
            height: "24px",
            background: "linear-gradient(135deg,#e53935,#f97316)",
            color: "white",
            fontWeight: "900",
            fontSize: "15px",
            fontFamily: "Arial Black, sans-serif",
            borderRadius: "6px",
            flexShrink: 0,
          }}
        >
          Z
        </span>
        <span
          style={{
            fontSize: "15px",
            fontWeight: "900",
            fontFamily: "Nunito, sans-serif",
            letterSpacing: "0.5px",
            color: "#1e1b4b",
          }}
        >
          Live Now
        </span>
      </div>

      {streams.length === 0 && (
        <p style={{ color: "#8b84c4", fontSize: "13px" }}>
          No one is live right now.
        </p>
      )}

      <div style={{ display: "flex", flexWrap: "wrap", gap: "16px" }}>
        {streams.map((s) => (
          <div
            key={s.id}
            onClick={() => setActiveRoom(s.room_name)}
            style={{
              background: "#1a1a1a",
              border: "1px solid #333",
              borderRadius: "10px",
              padding: "16px",
              width: "220px",
              cursor: "pointer",
            }}
          >
            <span
              style={{
                background: "#ff0000",
                color: "white",
                fontSize: "10px",
                fontWeight: 700,
                padding: "2px 6px",
                borderRadius: "4px",
              }}
            >
              ● LIVE
            </span>
            <p style={{ color: "white", fontWeight: 600, marginTop: "8px" }}>
              {s.title}
            </p>
            <p style={{ color: "#aaa", fontSize: "12px" }}>
              {s.broadcaster_name}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
};

// Connects as a subscribe-only participant and renders the broadcaster's video
const LiveWatch = ({ roomName, currentUser, onLeave }) => {
  const videoRef = useRef(null);
  const roomRef = useRef(null);
  const [status, setStatus] = useState("connecting");

  useEffect(() => {
    let cancelled = false;

    const connect = async () => {
      try {
        const identity = currentUser || `viewer_${Date.now()}`;
        const res = await fetch(
          `/api/livekit-token?room=${encodeURIComponent(
            roomName,
          )}&identity=${encodeURIComponent(identity)}&canPublish=false`,
        );
        const { token, url } = await res.json();

        const room = new Room();

        room.on(RoomEvent.TrackSubscribed, (track) => {
          if (track.kind === "video" && videoRef.current) {
            track.attach(videoRef.current);
          } else if (track.kind === "audio") {
            track.attach();
          }
        });

        room.on(RoomEvent.Disconnected, () => {
          if (!cancelled) setStatus("ended");
        });

        await room.connect(url, token);
        roomRef.current = room;
        if (!cancelled) setStatus("connected");
      } catch (err) {
        if (!cancelled) setStatus("error");
      }
    };

    connect();

    return () => {
      cancelled = true;
      if (roomRef.current) {
        roomRef.current.disconnect();
      }
    };
  }, [roomName, currentUser]);

  return (
    <div style={{ padding: "20px", maxWidth: "720px", margin: "0 auto" }}>
      <button
        onClick={onLeave}
        style={{
          background: "#272727",
          color: "white",
          border: "none",
          borderRadius: "8px",
          padding: "8px 14px",
          cursor: "pointer",
          marginBottom: "12px",
        }}
      >
        ← Back to live list
      </button>

      {status === "connecting" && (
        <p style={{ color: "#aaa" }}>Connecting to stream...</p>
      )}
      {status === "ended" && (
        <p style={{ color: "#aaa" }}>This stream has ended.</p>
      )}
      {status === "error" && (
        <p style={{ color: "#ff6666" }}>
          Couldn't connect to this stream. It may have ended.
        </p>
      )}

      <video
        ref={videoRef}
        autoPlay
        playsInline
        style={{
          width: "100%",
          aspectRatio: "16 / 9",
          background: "#000",
          borderRadius: "10px",
          objectFit: "cover",
          display: "block",
        }}
      />
    </div>
  );
};

export default LiveBrowser;