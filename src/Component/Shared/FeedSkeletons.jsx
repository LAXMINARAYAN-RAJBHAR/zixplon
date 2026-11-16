import React from "react";
import "./FeedSkeletons.css";

// "Live Now" section: header + a row of live cards.
export const LiveSkeleton = () => (
  <div className="fs-live" aria-hidden="true">
    <div className="fs-live-head">
      <div className="fs-sk fs-live-badge" />
      <div className="fs-sk fs-line" style={{ width: 90 }} />
    </div>
    <div className="fs-live-row">
      {[1, 2, 3].map((n) => (
        <div className="fs-sk fs-live-card" key={n} />
      ))}
    </div>
  </div>
);

// "People you may know": bordered card with a row of profile tiles.
export const PeopleSkeleton = () => (
  <div className="fs-people" aria-hidden="true">
    <div className="fs-sk fs-line" style={{ width: 150, height: 11 }} />
    <div className="fs-people-row">
      {[1, 2, 3, 4, 5].map((n) => (
        <div className="fs-people-tile" key={n}>
          <div className="fs-sk fs-people-avatar" />
          <div className="fs-sk fs-line" style={{ width: "70%", height: 11 }} />
          <div className="fs-sk fs-line" style={{ width: "45%", height: 9 }} />
          <div className="fs-sk fs-people-btn" />
        </div>
      ))}
    </div>
  </div>
);