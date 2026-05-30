// components/Treemap.jsx
import { useState, useMemo } from "react";
import { fmtNum } from "../utils";
import { THEME as T } from "../design-system";

function buildTreemap(items, W, H) {
  if (!items.length) return [];
  const total = items.reduce((s, i) => s + i.value, 0);
  if (total === 0) return [];

  // Squarified treemap algoritmus
  const sorted = [...items].sort((a, b) => b.value - a.value);
  const rects  = [];

  function squarify(items, x, y, w, h) {
    if (!items.length) return;
    if (items.length === 1) {
      rects.push({ ...items[0], x, y, w, h });
      return;
    }

    // Felvágjuk a területet arányosan
    const totalVal = items.reduce((s, i) => s + i.value, 0);
    const area     = w * h;

    // Hány elem kerüljön az első sorba?
    let bestRatio = Infinity;
    let splitIdx  = 1;

    for (let k = 1; k <= items.length; k++) {
      const rowVal = items.slice(0, k).reduce((s, i) => s + i.value, 0);
      const rowH   = w <= h ? (rowVal / totalVal) * h : h;
      const rowW   = w <= h ? w : (rowVal / totalVal) * w;
      const worstR = items.slice(0, k).reduce((worst, item) => {
        const cellArea = (item.value / totalVal) * area;
        const cellW    = w <= h ? rowW : cellArea / rowH;
        const cellH    = w <= h ? cellArea / rowW : rowH;
        const r        = Math.max(cellW / cellH, cellH / cellW);
        return Math.max(worst, r);
      }, 0);
      if (worstR <= bestRatio) { bestRatio = worstR; splitIdx = k; }
      else break;
    }

    const row     = items.slice(0, splitIdx);
    const rest    = items.slice(splitIdx);
    const rowVal  = row.reduce((s, i) => s + i.value, 0);

    if (w <= h) {
      const rowH2 = (rowVal / totalVal) * h;
      let cx      = x;
      row.forEach(item => {
        const cw = (item.value / rowVal) * w;
        rects.push({ ...item, x: cx, y, w: cw, h: rowH2 });
        cx += cw;
      });
      squarify(rest, x, y + rowH2, w, h - rowH2);
    } else {
      const rowW2 = (rowVal / totalVal) * w;
      let cy      = y;
      row.forEach(item => {
        const ch = (item.value / rowVal) * h;
        rects.push({ ...item, x, y: cy, w: rowW2, h: ch });
        cy += ch;
      });
      squarify(rest, x + rowW2, y, w - rowW2, h);
    }
  }

  squarify(sorted, 0, 0, W, H);
  return rects;
}

export function Treemap({ data, onSelect }) {
  const [hovered, setHovered] = useState(null);
  const W = 340, H = 220, PAD = 1.5;

  const rects = useMemo(() => buildTreemap(
    data.filter(d => d.value > 0),
    W, H
  ), [data]);

  if (!rects.length) return null;

  return (
    <div style={{ position: "relative", width: "100%", borderRadius: 10, overflow: "hidden", background: T.bg.inset }}>
      <svg
        width="100%" viewBox={`0 0 ${W} ${H}`}
        style={{ display: "block", cursor: "pointer" }}
        onMouseLeave={() => setHovered(null)}
      >
        {rects.map((r, i) => {
          const isHov  = hovered === r.label;
          const pad    = PAD;
          const rx     = r.x + pad, ry = r.y + pad;
          const rw     = Math.max(0, r.w - pad * 2);
          const rh     = Math.max(0, r.h - pad * 2);
          const showLabel = rw > 28 && rh > 18;
          const showPct   = rw > 36 && rh > 32;
          const fontSize  = Math.max(7, Math.min(13, Math.sqrt(rw * rh) / 6));

          return (
            <g key={r.label}
              onMouseEnter={() => setHovered(r.label)}
              onTouchStart={() => setHovered(r.label)}
              onClick={() => onSelect?.(r)}
            >
              {/* Háttér */}
              <rect
                x={rx} y={ry} width={rw} height={rh}
                rx={4}
                fill={r.color}
                fillOpacity={isHov ? 0.45 : 0.28}
                style={{ transition: "fill-opacity 0.15s" }}
              />
              {/* Szegély */}
              <rect
                x={rx} y={ry} width={rw} height={rh}
                rx={4} fill="none"
                stroke={r.color}
                strokeWidth={isHov ? 1.5 : 0.5}
                strokeOpacity={isHov ? 0.9 : 0.4}
              />
              {/* Szöveg */}
              {showLabel && (
                <>
                  <text
                    x={rx + rw / 2} y={ry + rh / 2 - (showPct ? 6 : 0)}
                    textAnchor="middle" dominantBaseline="middle"
                    fill="white" fontSize={fontSize}
                    fontWeight="700" fontFamily="'DM Mono', monospace"
                    style={{ pointerEvents: "none" }}
                  >
                    {r.label.slice(0, rw > 60 ? 6 : 4)}
                  </text>
                  {showPct && (
                    <text
                      x={rx + rw / 2} y={ry + rh / 2 + 9}
                      textAnchor="middle" dominantBaseline="middle"
                      fill="white" fillOpacity={0.7} fontSize={Math.max(7, fontSize - 2)}
                      fontFamily="'DM Sans', sans-serif"
                      style={{ pointerEvents: "none" }}
                    >
                      {fmtNum(r.pct, 1)}%
                    </text>
                  )}
                </>
              )}
            </g>
          );
        })}
      </svg>

      {/* Tooltip */}
      {hovered && (() => {
        const r = rects.find(r => r.label === hovered);
        if (!r) return null;
        return (
          <div style={{
            position: "absolute", bottom: 8, left: "50%", transform: "translateX(-50%)",
            background: "rgba(7,11,20,0.92)", border: `1px solid ${r.color}`,
            borderRadius: 8, padding: "6px 12px", pointerEvents: "none",
            textAlign: "center", backdropFilter: "blur(8px)",
            boxShadow: `0 4px 16px ${r.color}30`,
          }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#E6EDF3" }}>{r.fullName || r.label}</div>
            <div style={{ fontSize: 11, fontFamily: "'DM Mono',monospace", color: r.color, fontWeight: 700 }}>
              {fmtNum(r.pct, 2)}% · {fmtNum(r.value, 0)} Ft
            </div>
          </div>
        );
      })()}
    </div>
  );
}
