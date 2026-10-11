import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../config/supabase";
import { notifyUser } from "../../utils/notifications";
import "./SuggestedConnections.css";

// "People you may know" strip. The button on every card is a TOGGLE that
// sends / cancels a connect request:
//
//     Connect  ──click──▶  Requested  ──click──▶  Connect   (cancels)
//     Accept   (they already sent YOU a request) ──click──▶  Message
//     Message  (you're connected) ──click──▶  opens chat / profile
//
// Requests live in a `connection_requests` table — see
// connection_requests.sql. The other person is sent a notification.
//
// Several strips per page: every strip takes a `slot` (0 = first strip,
// 1 = second, ...) and shows the Nth group of `count` people, so strips
// never repeat profiles. A strip renders nothing when its slot is empty.
//
// Props (all optional)
//   variant     — "inbox" | "feed"
//   slot        — which group of people this strip shows (default 0)
//   count       — people per strip (default 12)
//   currentUser — defaults to localStorage "username"
//   exclude     — usernames to hide; if omitted the component works it out
//   onlineUsers — Set of online usernames (listed first)
//   onConnect   — (username) => void, used by the "Message" button;
//                 defaults to opening their profile
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
// each strip querying Supabase on its own. `states` maps
// username -> "requested" | "incoming" | "connected" and is updated in
// place by the toggle, so every strip (and remount) sees the latest state.
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

    const [convRes, blockRes, reqRes] = await Promise.all([
      supabase
        .from("conversations")
        .select("user_a, user_b")
        .or(`user_a.eq.${currentUser},user_b.eq.${currentUser}`),
      supabase
        .from("user_blocks")
        .select("blocker, blocked")
        .or(`blocker.eq.${currentUser},blocked.eq.${currentUser}`),
      supabase
        .from("connection_requests")
        .select("requester, recipient, status")
        .or(`requester.eq.${currentUser},recipient.eq.${currentUser}`),
    ]);

    const hide = [];
    (convRes.data || []).forEach((c) =>
      hide.push(c.user_a === currentUser ? c.user_b : c.user_a),
    );
    (blockRes.data || []).forEach((b) =>
      hide.push(b.blocker === currentUser ? b.blocked : b.blocker),
    );

    const states = {};
    (reqRes.data || []).forEach((r) => {
      const other = r.requester === currentUser ? r.recipient : r.requester;
      if (r.status === "accepted") {
        states[other] = "connected";
        hide.push(other); // already connected → not a "suggestion" any more
      } else if (r.status === "pending") {
        states[other] = r.requester === currentUser ? "requested" : "incoming";
      }
    });

    return { candidates: res.error ? [] : res.data || [], hide, states };
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
  const [busyUser, setBusyUser] = useState(null);
  // Only used to re-render after the shared `states` object changes.
  const [, forceRender] = useState(0);

  useEffect(() => {
    if (!currentUser) return;
    let active = true;
    loadSuggestionData(currentUser)
      .then((d) => {
        if (active) setData(d);
      })
      .catch(() => {
        if (active) setData({ candidates: [], hide: [], states: {} });
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

  const setState = (username, state) => {
    if (state) data.states[username] = state;
    else delete data.states[username];
    forceRender((n) => n + 1);
  };

  const notify = (recipient, message) => {
    try {
      notifyUser({
        recipientUsername: recipient,
        senderUsername: currentUser,
        type: "connect",
        message,
        contentId: currentUser,
        contentType: "profile",
      });
    } catch {
      /* a notification failure must never undo the request itself */
    }
  };

  // The toggle itself.
  const handleToggle = async (username) => {
    if (busyUser) return;
    const state = data.states[username];

    // Connected → this button is "Message".
    if (state === "connected") {
      if (onConnect) onConnect(username);
      else navigate(PROFILE_PATH(username));
      return;
    }

    setBusyUser(username);
    try {
      if (!state) {
        // Connect → send request
        setState(username, "requested"); // optimistic
        const { error } = await supabase
          .from("connection_requests")
          .insert({ requester: currentUser, recipient: username, status: "pending" });
        // 23505 = request already exists → treat as success
        if (error && error.code !== "23505") throw error;
        if (!error) notify(username, `${currentUser} sent you a connect request`);
      } else if (state === "requested") {
        // Requested → cancel
        setState(username, null);
        const { error } = await supabase
          .from("connection_requests")
          .delete()
          .eq("requester", currentUser)
          .eq("recipient", username)
          .eq("status", "pending");
        if (error) throw error;
      } else if (state === "incoming") {
        // They already asked you → Accept
        setState(username, "connected");
        const { error } = await supabase
          .from("connection_requests")
          .update({ status: "accepted" })
          .eq("requester", username)
          .eq("recipient", currentUser);
        if (error) throw error;
        notify(username, `${currentUser} accepted your connect request`);
      }
    } catch (err) {
      // Roll back the optimistic change.
      setState(username, state || null);
      alert(`Couldn't update the request: ${err?.message || "please try again."}`);
    } finally {
      setBusyUser(null);
    }
  };

  const dismiss = (username) => {
    const next = [...dismissed, username];
    setDismissed(next);
    writeDismissed(currentUser, next);
  };

  const buttonFor = (username) => {
    const state = data.states[username];
    if (state === "requested") return { label: "Requested", cls: "requested" };
    if (state === "incoming") return { label: "Accept", cls: "accept" };
    if (state === "connected") return { label: "Message", cls: "message" };
    return { label: "Connect", cls: "" };
  };

  return (
    <div className={`sc-strip ${variant === "feed" ? "sc-strip-feed" : ""}`}>
      <div className="sc-strip-title">
        {title || (variant === "feed" ? "People you may know" : "Suggested for you")}
      </div>
      <div className="sc-strip-scroll">
        {visible.map((p) => {
          const btn = buttonFor(p.username);
          return (
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
              <button
                type="button"
                className={`sc-connect-btn ${btn.cls}`}
                onClick={() => handleToggle(p.username)}
                disabled={busyUser === p.username}
                title={btn.cls === "requested" ? "Click to cancel request" : undefined}
              >
                {btn.cls === "requested" ? "✓ " : ""}
                {btn.label}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default SuggestedConnections;