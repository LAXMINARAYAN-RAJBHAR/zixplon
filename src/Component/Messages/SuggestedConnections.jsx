import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../config/supabase";
import "./SuggestedConnections.css";

// "People you may know" strip with a Connect button on every card.
// Used in two places:
//
//  1) Messages inbox (variant="inbox", the default) — pass `exclude`,
//     `onlineUsers` and `onConnect` from MessagesPanel, exactly as before.
//
//  2) Home / Posts tabs (variant="feed") — just render
//        <SuggestedConnections variant="feed" />
//     It works out the logged-in user itself, fetches who to hide
//     (people you already chat with + blocked in either direction), and
//     Connect opens that person's profile (/user/<username>). Pass your
//     own `onConnect` if you'd rather open the chat from there.
//
// Props (all optional)
//   variant     — "inbox" | "feed"
//   currentUser — defaults to localStorage "username"
//   exclude     — array/Set of usernames to hide; if omitted the component
//                 fetches conversations + blocks itself
//   onlineUsers — Set of online usernames (listed first)
//   onConnect   — (username) => void; defaults to opening their profile
//   title       — heading text

const DISMISS_KEY = "zx_dismissed_suggestions_v1";
const FETCH_LIMIT = 40; // candidates pulled from `profiles`
const MAX_SHOWN = 12; // cards actually rendered
const PROFILE_PATH = (u) => `/user/${encodeURIComponent(u)}`;

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
      {online !== undefined && (
        <span className={`sc-status-dot ${online ? "online" : "offline"}`} />
      )}
    </div>
  );
};

const SuggestedConnections = ({
  variant = "inbox",
  currentUser: currentUserProp,
  exclude,
  onlineUsers,
  onConnect,
  title,
}) => {
  const navigate = useNavigate();
  const currentUser = currentUserProp || localStorage.getItem("username") || "";

  const [candidates, setCandidates] = useState([]);
  const [selfExclude, setSelfExclude] = useState([]);
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

      // When the parent doesn't pass `exclude` (Home / Posts tabs), work out
      // who to hide: existing chats + blocks in either direction.
      let hide = [];
      if (!exclude) {
        const [convRes, blockRes] = await Promise.all([
          supabase
            .from("conversations")
            .select("user_a, user_b")
            .or(`user_a.eq.${currentUser},user_b.eq.${currentUser}`),
          supabase
            .from("user_blocks")
            .select("blocker, blocked")
            .or(`blocker.eq.${currentUser},blocked.eq.${currentUser}`),
        ]);
        (convRes.data || []).forEach((c) =>
          hide.push(c.user_a === currentUser ? c.user_b : c.user_a),
        );
        (blockRes.data || []).forEach((b) =>
          hide.push(b.blocker === currentUser ? b.blocked : b.blocker),
        );
      }

      if (!active) return;
      if (!res.error) setCandidates(res.data || []);
      setSelfExclude(hide);
      setLoaded(true);
    };

    load();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser]);

  // Logged-out visitors never see suggestions.
  if (!currentUser) return null;

  const excludeSet = new Set(exclude || selfExclude);
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

  const connect = (username) => {
    if (onConnect) onConnect(username);
    else navigate(PROFILE_PATH(username));
  };

  if (!loaded || visible.length === 0) return null;

  return (
    <div className={`sc-strip ${variant === "feed" ? "sc-strip-feed" : ""}`}>
      <div className="sc-strip-title">
        {title || (variant === "feed" ? "People you may know" : "Suggested for you")}
      </div>
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
              online={onlineUsers ? onlineUsers.has(p.username) : undefined}
            />
            <div className="sc-name" title={p.username}>
              {p.username}
            </div>
            <button type="button" className="sc-connect-btn" onClick={() => connect(p.username)}>
              Connect
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default SuggestedConnections;