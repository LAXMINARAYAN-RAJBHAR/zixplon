// src/context/CallContext.jsx
// Mount <CallProvider> once, high in the tree (next to PresenceProvider), so
// incoming calls ring on any screen, even when the messages panel is closed.
import React, { createContext, useCallback, useContext, useEffect } from "react";
import useCall from "../hooks/useCall";
import CallOverlay from "../Component/Messages/CallOverlay";
import { supabase } from "../config/supabase";
import { showChatNotification } from "../utils/chatNotifications";

const CallContext = createContext({ startCall: () => {}, callActive: false });
export const useCallContext = () => useContext(CallContext);

// Simple two-tone ring, repeated while a call is incoming or ringing.
function useRingtone(active) {
  useEffect(() => {
    if (!active) return undefined;
    let ctx;
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) {
      return undefined;
    }
    const ring = () => {
      if (ctx.state === "suspended") ctx.resume().catch(() => {});
      [0, 0.45].forEach((offset, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.frequency.value = i === 0 ? 440 : 480;
        osc.connect(gain);
        gain.connect(ctx.destination);
        const t = ctx.currentTime + offset;
        gain.gain.setValueAtTime(0.0001, t);
        gain.gain.exponentialRampToValueAtTime(0.15, t + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
        osc.start(t);
        osc.stop(t + 0.4);
      });
    };
    ring();
    const timer = setInterval(ring, 2200);
    return () => {
      clearInterval(timer);
      ctx.close().catch(() => {});
    };
  }, [active]);
}

// currentUser is App.js's own auth state (the same username the rest of the app
// uses), so calls start/stop listening automatically on login and logout.
export function CallProvider({ children, currentUser: currentUserProp }) {
  const currentUser = currentUserProp || "";

  // Writes the call into the chat thread (caller side only; see useCall.finish).
  // Stored as a direct_messages row with attachment_type = "call":
  //   attachment_name = completed | missed | cancelled | declined | busy | ended
  //   attachment_size = call length in seconds (completed calls)
  const logCallToChat = useCallback(
    async ({ call, outcome, duration }) => {
      const me = currentUser;
      const other = call.peer;
      const [user_a, user_b] = [me, other].sort();
      const { data: convo } = await supabase
        .from("conversations")
        .select("id")
        .eq("user_a", user_a)
        .eq("user_b", user_b)
        .maybeSingle();
      if (!convo) return;

      const answered = outcome === "ended" && duration > 0;
      await supabase.from("direct_messages").insert({
        conversation_id: convo.id,
        sender_username: me,
        text: null,
        attachment_url: null,
        attachment_type: "call",
        attachment_name: answered ? "completed" : outcome,
        attachment_size: answered ? duration : null,
      });

      // Only unanswered calls touch the inbox row (so the callee sees "Missed voice
      // call" and gets the usual unread dot). Answered calls don't, so nobody gets
      // a notification chime right after hanging up.
      if (outcome === "missed" || outcome === "cancelled") {
        await supabase
          .from("conversations")
          .update({
            last_message: "📞 Missed voice call",
            last_message_at: new Date().toISOString(),
            last_message_sender: me,
          })
          .eq("id", convo.id);
      }
    },
    [currentUser],
  );

  const api = useCall(currentUser, { onCallEnded: logCallToChat });
  const { call } = api;

  useRingtone(!!call && (call.status === "incoming" || call.status === "ringing"));

  // Browser notification if the tab is in the background when a call comes in.
  const incomingId = call && call.status === "incoming" ? call.id : null;
  const incomingPeer = call && call.status === "incoming" ? call.peer : null;
  useEffect(() => {
    if (incomingId && document.hidden) {
      showChatNotification(incomingPeer, "Incoming voice call");
    }
  }, [incomingId, incomingPeer]);

  return (
    <CallContext.Provider value={{ startCall: api.startCall, callActive: !!call }}>
      {children}
      <CallOverlay
        call={api.call}
        muted={api.muted}
        seconds={api.seconds}
        error={api.error}
        audioBlocked={api.audioBlocked}
        onAccept={api.accept}
        onHangUp={api.hangUp}
        onToggleMute={api.toggleMute}
        onEnableAudio={api.enableAudio}
        onDismissError={api.dismissError}
      />
    </CallContext.Provider>
  );
}