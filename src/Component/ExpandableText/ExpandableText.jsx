import React, { useState, useEffect } from "react";
import { linkifyText, closeDanglingBold } from "../../utils/linkify";

/**
 * Reusable "Show more / Show less" text truncator.
 * Used in PostCard (post text), Video (description), Reels (description).
 *
 * The displayed text is run through linkifyText() so any **bold** span
 * renders bold, any #hashtag links to /tag/:tag, and any @mention links
 * to /user/:username — everywhere this component is already used gets
 * this for free with no call-site changes required.
 *
 * closeDanglingBold() runs on the truncated string BEFORE linkifying —
 * slicing raw text at maxChars can land in the middle of a **bold**
 * span, leaving one unmatched "**" that would otherwise render as two
 * literal asterisks instead of finishing the bold run cleanly.
 *
 * NEW props (both optional, default to the old behaviour):
 *  - collapseSignal: when this flips to true the text collapses again
 *    (Reels passes !isActive so a reel is collapsed when it scrolls away).
 *  - scrollWhenExpanded: when true, the expanded text is put in a
 *    height-limited, scrollable block with "Show less" below it, so a
 *    long caption can't overflow the reel. Off by default so PostCard
 *    and Video are unaffected.
 */
const ExpandableText = ({
  text,
  maxChars = 180,
  className = "",
  toggleClassName = "",
  hashtagClassName = "expandable-text-hashtag",
  mentionClassName = "expandable-text-mention",
  boldClassName = "",
  collapseSignal = false,
  scrollWhenExpanded = false,
}) => {
  const [expanded, setExpanded] = useState(false);

  // Hooks must run before the early return below.
  useEffect(() => {
    if (collapseSignal) setExpanded(false);
  }, [collapseSignal]);

  if (!text) return null;

  const isLong = text.length > maxChars;
  const rawDisplayText = expanded || !isLong ? text : text.slice(0, maxChars).trimEnd() + "…";
  const displayText = isLong && !expanded ? closeDanglingBold(rawDisplayText) : rawDisplayText;

  const linked = linkifyText(displayText, { hashtagClassName, mentionClassName, boldClassName });

  const toggle = (e) => {
    e.stopPropagation();
    setExpanded((v) => !v);
  };

  const useScrollBlock = scrollWhenExpanded && expanded;

  return (
    <span className={className} data-expanded={expanded ? "true" : "false"}>
      {useScrollBlock ? (
        <span className="expandable-text-body">{linked}</span>
      ) : (
        linked
      )}
      {isLong && (
        <span
          className={`expandable-text-toggle${useScrollBlock ? " expandable-text-toggle--block" : ""} ${toggleClassName}`}
          onClick={toggle}
        >
          {expanded ? (useScrollBlock ? "Show less" : " Show less") : " Show more"}
        </span>
      )}
    </span>
  );
};

export default ExpandableText;