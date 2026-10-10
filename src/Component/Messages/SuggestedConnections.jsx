import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../config/supabase";
import "./SuggestedConnections.css";

// "People you may know" strip with a Connect button on every card.
//
//  • Messages inbox (variant="inbox", default): pass `exclude`, `onlineUsers`
//    and `onConnect` from MessagesPanel, exactly as before.
//  • Home / Posts tabs (variant="feed"): <SuggestedConnections variant="feed" />
//    Connect opens that person's profile unless you pass `onConnect`.
//
// NEW — several strips per page: every strip takes a `slot` number
// (0 = first strip, 1 = second, ...). Slot N shows the Nth group of
// `count` people, so strips never repeat the same profiles. A strip
// renders nothing once there is nobody left for its slot.
//
// Props (all optional)
//   variant     — "inbox" | "feed"
//   slot        — which group of people this strip shows (default 0)
//   count       — people per strip (default 12)
//   currentUser — defaults to localStorage "username"
//   exclude     — usernames to hide; if omitted the component works it out
//   onlineUsers — Set of online usernames (listed first)
//   onConnect   — (username) => void; defaults to opening their profile
//   title       — heading text

const DISMISS_KEY = "zx_dismissed_suggestions_v1";
const FETCH_LIMIT = 80; // candidates pulled from `profiles` (enough for ~6 strips)
const CACHE_MS = 60 * 1000;
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

// All strips on a page share ONE fetch (cached for a minute) instead of
// each strip querying Supabase on its own.
let cache = { user: null, at: 0, promise: null };

const loadSuggestionData = (currentUser) => {
  const fresh =
    cache.user === currentUser && cache.promise && Date.now() - cache.at < CACHE_MS;
  if (fresh) return cache.promise;

  const promise = (async () => {
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

    const hide = [];
    (convRes.data || []).forEach((c) =>
      hide.push(c.user_a === currentUser ? c.user_b : c.user_a),
    );
    (blockRes.data || []).forEach((b) =>
      hide.push(b.blocker === currentUser ? b.blocked : b.blocker),
    );

    return { candidates: res.error ? [] : res.data || [], hide };
  })();

  cache = { user: currentUser, at: Date.now(), promise };
  return promise;
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
  slot = 0,
  count = 12,
  currentUser: currentUserProp,
  exclude,
  onlineUsers,
  onConnect,
  title,
}) => {
  const navigate = useNavigate();
  const currentUser = currentUserProp || localStorage.getItem("username") || "";

  const [data, setData] = useState(null);
  const [dismissed, setDismissed] = useState(() => readDismissed(currentUser));

  useEffect(() => {
    if (!currentUser) return;
    let active = true;
    loadSuggestionData(currentUser)
      .then((d) => {
        if (active) setData(d);
      })
      .catch(() => {
        if (active) setData({ candidates: [], hide: [] });
      });
    return () => {
      active = false;
    };
  }, [currentUser]);

  // Logged-out visitors never see suggestions.
  if (!currentUser || !data) return null;

  const excludeSet = new Set(exclude || data.hide);
  const dismissedSet = new Set(dismissed);

  const pool = data.candidates
    .filter((p) => p.username && !excludeSet.has(p.username) && !dismissedSet.has(p.username))
    // online people first; otherwise keep newest-first order from the query
    .sort((a, b) => Number(onlineUsers?.has(b.username)) - Number(onlineUsers?.has(a.username)));

  // Each slot gets its own group of people, so strips never repeat profiles.
  const visible = pool.slice(slot * count, slot * count + count);
  if (visible.length === 0) return null;

  const dismiss = (username) => {
    const next = [...dismissed, username];
    setDismissed(next);
    writeDismissed(currentUser, next);
  };

  const connect = (username) => {
    if (onConnect) onConnect(username);
    else navigate(PROFILE_PATH(username));
  };

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