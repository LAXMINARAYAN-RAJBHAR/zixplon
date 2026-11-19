import React from "react";

// Vertical bar chart over a series of { label, value }. Pure SVG, no library.
export const BarChart = ({ data, color = "var(--zx-primary)", height = 140, emptyText = "No data yet" }) => {
  if (!data || data.length === 0) return <p className="admin_words_hint">{emptyText}</p>;
  const max = Math.max(1, ...data.map((d) => d.value));
  const W = Math.max(280, data.length * 18);
  const padTop = 14;
  const padBottom = 22;
  const innerH = height - padTop - padBottom;
  const bw = W / data.length;
  const every = Math.ceil(data.length / 8); // label every Nth bar

  return (
    <div className="admin_chart_scroll">
      <svg viewBox={`0 0 ${W} ${height}`} width="100%" style={{ minWidth: W, maxHeight: height + 10 }} role="img">
        {data.map((d, i) => {
          const h = (d.value / max) * innerH;
          return (
            <g key={`${d.label}-${i}`}>
              <title>{`${d.label}: ${d.value}`}</title>
              <rect
                x={i * bw + bw * 0.15}
                y={padTop + innerH - h}
                width={bw * 0.7}
                height={Math.max(h, d.value > 0 ? 1 : 0)}
                rx="3"
                fill={color}
              />
              {i % every === 0 && (
                <text x={i * bw + bw / 2} y={height - 6} fontSize="9" textAnchor="middle" fill="var(--zx-text3)">
                  {d.label}
                </text>
              )}
            </g>
          );
        })}
        <text x="0" y="10" fontSize="9" fill="var(--zx-text3)">{`max ${max}`}</text>
      </svg>
    </div>
  );
};

// Horizontal ranked bars: [{ label, value }]
export const RankList = ({ data, emptyText = "No data yet" }) => {
  if (!data || data.length === 0) return <p className="admin_words_hint">{emptyText}</p>;
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div>
      {data.map((d) => (
        <div key={d.label} className="admin_installs_bar_row">
          <span className="admin_installs_bar_label" style={{ width: 130, textTransform: "none" }} title={d.label}>
            {d.label.length > 18 ? d.label.slice(0, 17) + "…" : d.label}
          </span>
          <div className="admin_installs_bar_track">
            <div className="admin_installs_bar_fill" style={{ width: `${(d.value / max) * 100}%` }} />
          </div>
          <span className="admin_installs_bar_count">{d.value}</span>
        </div>
      ))}
    </div>
  );
};