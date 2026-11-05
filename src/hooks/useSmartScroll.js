// src/hooks/useSmartScroll.js
//
// WhatsApp-style scrolling for the message list:
//   • first load of a chat  -> jump to the bottom instantly (no animation)
//   • new message, and you're already near the bottom -> smooth scroll
//   • you sent the message                              -> smooth scroll
//   • you're reading older messages and one arrives     -> DON'T move;
//     count it so the UI can show a "↓ N new messages" button
//   • reactions / ticks / edits (no new tail message)   -> never scroll
//
// Usage in MessagesPanel:
//   const { onScroll, showJump, unseenCount, scrollToBottom } = useSmartScroll({
//     bodyRef: chatBodyRef,
//     messages,
//     convoId: activeConvo?.id,
//     currentUser,
//     skipRef: skipAutoScrollRef,   // existing ref: set when prepending older history
//     extraTrigger: otherTyping,    // keeps the typing bubble in view
//   });
//   <div className="mp-chat-body" ref={chatBodyRef} onScroll={onScroll}> ... </div>

import { useCallback, useEffect, useRef, useState } from "react";

const NEAR_BOTTOM_PX = 120;

export function useSmartScroll({
  bodyRef,
  messages,
  convoId,
  currentUser,
  skipRef,
  extraTrigger,
}) {
  const nearBottomRef = useRef(true);
  const initialRef = useRef(true);
  const lastKeyRef = useRef(null);
  const [unseenCount, setUnseenCount] = useState(0);
  const [showJump, setShowJump] = useState(false);

  const scrollToBottom = useCallback(
    (smooth = true) => {
      const el = bodyRef.current;
      if (!el) return;
      el.scrollTo({ top: el.scrollHeight, behavior: smooth ? "smooth" : "auto" });
      setUnseenCount(0);
    },
    [bodyRef],
  );

  // New conversation -> start over.
  useEffect(() => {
    initialRef.current = true;
    lastKeyRef.current = null;
    nearBottomRef.current = true;
    setUnseenCount(0);
    setShowJump(false);
  }, [convoId]);

  const onScroll = useCallback(() => {
    const el = bodyRef.current;
    if (!el) return;
    const near = el.scrollHeight - el.scrollTop - el.clientHeight < NEAR_BOTTOM_PX;
    nearBottomRef.current = near;
    setShowJump(!near);
    if (near) setUnseenCount(0);
  }, [bodyRef]);

  useEffect(() => {
    const el = bodyRef.current;
    if (!el) return;

    // Older history was just prepended / a jump is in progress: the caller
    // restores the scroll position itself.
    if (skipRef?.current) {
      skipRef.current = false;
      return;
    }

    const last = messages[messages.length - 1];
    const lastKey = last ? last._key || last.id : null;

    // First paint of this chat: instant jump, no animation.
    if (initialRef.current) {
      if (!messages.length) return;
      el.scrollTop = el.scrollHeight;
      initialRef.current = false;
      lastKeyRef.current = lastKey;
      return;
    }

    const isNewTail = lastKey !== null && lastKey !== lastKeyRef.current;
    lastKeyRef.current = lastKey;
    const sentByMe = last?.sender_username === currentUser;

    if (nearBottomRef.current || (isNewTail && sentByMe)) {
      scrollToBottom(true);
    } else if (isNewTail) {
      setUnseenCount((c) => c + 1);
    }
  }, [messages, extraTrigger, bodyRef, skipRef, currentUser, scrollToBottom]);

  return { onScroll, showJump, unseenCount, scrollToBottom };
}