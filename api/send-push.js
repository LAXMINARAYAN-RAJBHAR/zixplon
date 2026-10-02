// api/send-push.js
//
// Configured as the target of Supabase Database Webhooks:
//   1. INSERT on direct_messages
//   2. INSERT on notifications   (likes, comments, follows, etc.)
//   3. INSERT on calls           (NEW: incoming voice call)
//   4. UPDATE on calls           (NEW: replaces the "incoming call" notification
//                                 with "Missed voice call" if nobody answered)
//
// Supabase sends a payload shaped like:
//   { type: "INSERT" | "UPDATE", table: "calls", record: {...}, schema: "public" }
//
// Required Vercel env vars:
//   VAPID_PUBLIC_KEY
//   VAPID_PRIVATE_KEY
//   VAPID_SUBJECT              e.g. "mailto:you@zixplon.app"
//   SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY  (service role — bypasses RLS, server-only, NEVER exposed to client)

import webpush from "web-push";
import { createClient } from "@supabase/supabase-js";

webpush.setVapidDetails(
  process.env.VAPID_SUBJECT,
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY,
);

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

// Maps a notifications.content_type value to a route in your app.
// Adjust these paths if your routes differ.
function urlForContent(contentType, contentId) {
  switch (contentType) {
    case "reel":
      return `/reels/${contentId}`;
    case "video":
      return `/video/${contentId}`;
    case "post":
      return `/feed?post=${contentId}`;
    default:
      return "/notifications";
  }
}

// NEW: same rules the app enforces for calls — an accepted chat, and nobody
// has blocked the other. If this fails we send no push at all.
async function callAllowed(caller, callee) {
  const [user_a, user_b] = [caller, callee].sort();
  const [blocksRes, convoRes] = await Promise.all([
    supabaseAdmin
      .from("user_blocks")
      .select("blocker")
      .or(
        `and(blocker.eq.${caller},blocked.eq.${callee}),and(blocker.eq.${callee},blocked.eq.${caller})`,
      )
      .limit(1),
    supabaseAdmin
      .from("conversations")
      .select("status")
      .eq("user_a", user_a)
      .eq("user_b", user_b)
      .maybeSingle(),
  ]);
  if (blocksRes.data && blocksRes.data.length) return false;
  const convo = convoRes.data;
  return !!convo && (convo.status || "accepted") === "accepted";
}

// Builds the { title, body, url, tag } payload for each event type.
function buildNotificationPayload(table, record, eventType) {
  if (table === "direct_messages") {
    return {
      title: `New message from ${record.sender_username}`,
      body: record.text
        ? record.text.slice(0, 120)
        : record.attachment_type === "image"
          ? "📷 Sent a photo"
          : record.attachment_type === "video"
            ? "🎥 Sent a video"
            : "📎 Sent an attachment",
      url: `/?openMessages=${record.sender_username}`,
      tag: `dm-${record.conversation_id}`,
    };
  }

  if (table === "notifications") {
    return {
      title: "ZIXPLON",
      // Your notifications table already stores a ready-made message —
      // use it directly instead of reconstructing one.
      body: record.message || `${record.sender_username} sent you a notification`,
      url: urlForContent(record.content_type, record.content_id),
      tag: `notif-${record.type}-${record.sender_username}-${record.content_id || ""}`,
    };
  }

  // NEW: voice calls. Both notifications share the tag `call-<id>`, so the
  // "Missed voice call" one replaces the ringing one in the tray.
  if (table === "calls") {
    if (eventType === "INSERT") {
      return {
        title: "Incoming voice call",
        body: `${record.caller_username} is calling you`,
        url: "/", // the app picks up a call that is still ringing when it opens
        tag: `call-${record.id}`,
        requireInteraction: true,
        isCall: true,
      };
    }
    return {
      title: "Missed voice call",
      body: `From ${record.caller_username}`,
      url: `/?openMessages=${record.caller_username}`,
      tag: `call-${record.id}`,
    };
  }

  return null;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { table, record, type: eventType } = req.body;

    // NEW: the call-history rows the app writes into chat (attachment_type "call")
    // must not trigger a "New message / Sent an attachment" push.
    if (table === "direct_messages" && record.attachment_type === "call") {
      return res.status(200).json({ skipped: "call history row" });
    }

    let recipientUsername = null;

    if (table === "direct_messages") {
      // direct_messages has no recipient_username column — resolve it
      // via the conversations table (user_a / user_b).
      const { data: convo } = await supabaseAdmin
        .from("conversations")
        .select("user_a, user_b")
        .eq("id", record.conversation_id)
        .maybeSingle();

      if (convo) {
        recipientUsername =
          convo.user_a === record.sender_username ? convo.user_b : convo.user_a;
      }
    } else if (table === "notifications") {
      recipientUsername = record.recipient_username;
    } else if (table === "calls") {
      // NEW: ring on INSERT; on UPDATE only react to unanswered calls.
      const ringing = eventType === "INSERT" && record.status === "ringing";
      const unanswered =
        eventType === "UPDATE" &&
        (record.status === "missed" || record.status === "cancelled");
      if (!ringing && !unanswered) {
        return res.status(200).json({ skipped: "call event not pushed" });
      }
      if (!(await callAllowed(record.caller_username, record.callee_username))) {
        return res.status(200).json({ skipped: "call not allowed (blocked or not accepted)" });
      }
      recipientUsername = record.callee_username;
    }

    if (!recipientUsername) {
      return res.status(200).json({ skipped: "no recipient resolved" });
    }

    // Don't push a notification to yourself (e.g. liking your own post,
    // if that ever inserts a row)
    if (
      table === "notifications" &&
      recipientUsername === record.sender_username
    ) {
      return res.status(200).json({ skipped: "self-notification" });
    }

    const payload = buildNotificationPayload(table, record, eventType);
    if (!payload) {
      return res.status(200).json({ skipped: "unhandled table" });
    }

    const { data: subs, error } = await supabaseAdmin
      .from("push_subscriptions")
      .select("*")
      .eq("username", recipientUsername);

    if (error) throw error;
    if (!subs || subs.length === 0) {
      return res.status(200).json({ skipped: "no subscriptions for user" });
    }

    // NEW: a ringing call is worthless after ~30s, so let the push service drop it
    // instead of delivering it late, and mark it high priority so phones wake up.
    const sendOptions = payload.isCall ? { TTL: 30, urgency: "high" } : undefined;

    const results = await Promise.allSettled(
      subs.map((sub) =>
        webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          JSON.stringify({
            title: payload.title,
            body: payload.body,
            url: payload.url,
            tag: payload.tag,
            requireInteraction: !!payload.requireInteraction,
          }),
          sendOptions,
        ),
      ),
    );

    // Clean up subscriptions that are no longer valid (expired/revoked)
    const deadEndpoints = [];
    results.forEach((r, i) => {
      if (
        r.status === "rejected" &&
        (r.reason?.statusCode === 404 || r.reason?.statusCode === 410)
      ) {
        deadEndpoints.push(subs[i].endpoint);
      }
    });
    if (deadEndpoints.length > 0) {
      await supabaseAdmin
        .from("push_subscriptions")
        .delete()
        .in("endpoint", deadEndpoints);
    }

    return res.status(200).json({
      sent: results.filter((r) => r.status === "fulfilled").length,
      failed: results.filter((r) => r.status === "rejected").length,
    });
  } catch (err) {
    console.error("send-push error:", err);
    return res.status(500).json({ error: err.message });
  }
}