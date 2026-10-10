import React, { useEffect, useState } from "react";
import { supabase } from "../../config/supabase";
import "./SuggestedConnections.css";

// Horizontal "People you may know" strip shown at the top of the Messages
// inbox. Each card has a Connect button that opens a chat with that person
// (a brand-new chat starts as a message request, same as searching for
// them and tapping "Start new chat").
//
// Props
//   currentUser — logged-in username
//   exclude     — array/Set of usernames to hide (people you already chat
//                 with, plus anyone blocked in either direction)
//   onlineUsers — Set of usernames currently online (they're listed first)
//   onConnect   — (username) => void
//
// The candidate list is fetched once; filtering happens on every render, so
// a card disappears the moment you connect with that person.

const DISMISS_KEY = "zx_dismissed_suggestions_v1";
const FETCH_LIMIT = 40; // candidates pulled from `profiles`
const MAX_SHOWN = 12; // cards actually rendered

const readDismissed = (user) => {
  try {
    const all = JSON.parse(localStorage.getItem(DISMISS_KEY) || "{}");
    return Array.isArray(all[user]) ? all[user] : [];
  } catch {
    return [];
  }
};

const writeDismissed = (user, list) => {
  try {
    const all = JSON.parse(localStorage.getItem(DISMISS_KEY) || "{}");
    all[user] = list;
    localStorage.setItem(DISMISS_KEY, JSON.stringify(all));
  } catch {
    /* storage blocked — dismissals just won't persist */
  }
};

const SuggestionAvatar = ({ username, picUrl, online }) => {
  const [broken, setBroken] = useState(false);
  return (
    <div className="sc-avatar">
      {picUrl && !broken ? (
        <img src={picUrl} alt="" onError={() => setBroken(true)} />
      ) : (
        username.slice(0, 2).toUpperCase()
      )}
      <span className={`sc-status-dot ${online ? "online" : "offline"}`} />
    </div>
  );
};

const SuggestedConnections = ({ currentUser, exclude, onlineUsers, onConnect }) => {
  const [candidates, setCandidates] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [dismissed, setDismissed] = useState(() => readDismissed(currentUser));

  useEffect(() => {
    if (!currentUser) return;
    let active = true;

    const load = async () => {
      let res = await supabase
        .from("profiles")
        .select("username, profile_pic")
        .neq("username", currentUser)
        .order("created_at", { ascending: false })
        .limit(FETCH_LIMIT);

      // If the profile_pic column isn't available, retry with just usernames.
      if (res.error) {
        res = await supabase
          .from("profiles")
          .select("username")
          .neq("username", currentUser)
          .limit(FETCH_LIMIT);
      }

      if (!active) return;
      if (!res.error) setCandidates(res.data || []);
      setLoaded(true);
    };

    load();
    return () => {
      active = false;
    };
  }, [currentUser]);

  const excludeSet = new Set(exclude || []);
  const dismissedSet = new Set(dismissed);

  const visible = candidates
    .filter((p) => p.username && !excludeSet.has(p.username) && !dismissedSet.has(p.username))
    // online people first; otherwise keep newest-first order from the query
    .sort((a, b) => Number(onlineUsers?.has(b.username)) - Number(onlineUsers?.has(a.username)))
    .slice(0, MAX_SHOWN);

  const dismiss = (username) => {
    const next = [...dismissed, username];
    setDismissed(next);
    writeDismissed(currentUser, next);
  };

  if (!loaded || visible.length === 0) return null;

  return (
    <div className="sc-strip">
      <div className="sc-strip-title">Suggested for you</div>
      <div className="sc-strip-scroll">
        {visible.map((p) => (
          <div key={p.username} className="sc-card">
            <button
              type="button"
              className="sc-dismiss"
              onClick={() => dismiss(p.username)}
              aria-label={`Hide suggestion ${p.username}`}
              title="Hide"
            >
              ✕
            </button>
            <SuggestionAvatar
              username={p.username}
              picUrl={p.profile_pic}
              online={onlineUsers?.has(p.username)}
            />
            <div className="sc-name" title={p.username}>
              {p.username}
            </div>
            <button type="button" className="sc-connect-btn" onClick={() => onConnect(p.username)}>
              Connect
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default SuggestedConnections;