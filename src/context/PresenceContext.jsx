import React, { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "../config/supabase";

const PresenceContext = createContext({ onlineUsers: new Set() });

export const usePresence = () => useContext(PresenceContext);

// Accepts currentUser as a prop instead of reading localStorage directly,
// so it stays in sync with login/logout instead of only reading once on mount.
export const PresenceProvider = ({ currentUser, children }) => {
  const [onlineUsers, setOnlineUsers] = useState(new Set());

  // ── Presence: tracks this user as "online" for as long as the site
  //    tab is open, regardless of whether the Messages panel is open ──
  useEffect(() => {
    if (!currentUser) {
      setOnlineUsers(new Set());
      return;
    }

    const channel = supabase.channel("online-users", {
      config: { presence: { key: currentUser } },
    });

    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState();
        setOnlineUsers(new Set(Object.keys(state)));
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({ online_at: new Date().toISOString() });
        }
      });

    return () => supabase.removeChannel(channel);
  }, [currentUser]);

  // ── Global delivery marking: fires the instant this client receives
  //    ANY message, whether or not the Messages panel is open ──
  useEffect(() => {
    if (!currentUser) return;

    const channel = supabase
      .channel(`dm-global-delivery-${currentUser}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "direct_messages" },
        async (payload) => {
          const msg = payload.new;
          if (msg.sender_username !== currentUser && !msg.delivered_at) {
            await supabase
              .from("direct_messages")
              .update({ delivered_at: new Date().toISOString() })
              .eq("id", msg.id)
              .is("delivered_at", null);
          }
        },
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [currentUser]);

  return (
    <PresenceContext.Provider value={{ onlineUsers }}>
      {children}
    </PresenceContext.Provider>
  );
};