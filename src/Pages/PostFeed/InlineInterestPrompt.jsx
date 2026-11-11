import React, { useState } from "react";

// Facebook-style inline "Are you interested in this post?" card.
// Renders INSIDE the post card (under the media, above the reaction
// summary) instead of as a floating popup.
//
// Props:
//   onInterested()      — called when "Interested" is tapped
//   onNotInterested()   — called when "Not interested" is tapped
//   onUndo(answer)      — called when the user taps Undo ("interested" | "not_interested")
//   onDismiss()         — optional: called after the thank-you message is
//                         closed, so the parent can stop rendering the card
//
// After an answer, the question is replaced by a short thank-you line with
// an Undo button, like Facebook does.
const InlineInterestPrompt = ({ onInterested, onNotInterested, onUndo, onDismiss }) => {
  const [answer, setAnswer] = useState(null); // null | "interested" | "not_interested"

  const choose = (value) => {
    setAnswer(value);
    if (value === "interested") onInterested?.();
    else onNotInterested?.();
  };

  const undo = () => {
    const previous = answer;
    setAnswer(null);
    onUndo?.(previous);
  };

  if (answer) {
    return (
      <div className="pf-interest pf-interest--done" role="status">
        <div className="pf-interest-done-text">
          <b>
            {answer === "interested"
              ? "धन्यवाद! · Thanks, we'll show more like this"
              : "धन्यवाद! · Thanks, we'll show less like this"}
          </b>
        </div>
        <div className="pf-interest-done-actions">
          <button type="button" className="pf-interest-undo" onClick={undo}>
            पूर्ववत करा · Undo
          </button>
          {onDismiss && (
            <button
              type="button"
              className="pf-interest-close"
              onClick={onDismiss}
              aria-label="Close"
            >
              ✕
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="pf-interest" role="group" aria-label="Post feedback">
      <p className="pf-interest-question">
        तुम्हाला या पोस्टमध्ये रुची आहे का? · Are you interested in this post?
      </p>
      <button
        type="button"
        className="pf-interest-btn"
        onClick={() => choose("interested")}
      >
        रुची आहे · Interested
      </button>
      <button
        type="button"
        className="pf-interest-btn"
        onClick={() => choose("not_interested")}
      >
        रुची नाही · Not interested
      </button>
    </div>
  );
};

export default InlineInterestPrompt;