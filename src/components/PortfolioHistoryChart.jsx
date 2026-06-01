import { useState, useEffect } from "react";
import { fetchPortfolioHistory } from "../services/supabase";
import { fmtNum } from "../utils";
import { glassCard, THEME as T } from "../design-system";

const RANGES = [
  { label: "1M",  days: 30   },
  { label: "3M",  days: 90   },
  { label: "6M",  days: 180  },
  { label: "1É",  days: 365  },
  { label: "MAX", days: 1825 },
];

const W = 340, H = 110, PAD = { t: 10, r: 8, b: 22, l: 52 };

function fmt(v) {
  if (v >= 1_000_000) return fmtNum(v / 1_000_000, 1) + "M";
  return fmtNum(v / 1000, 0) + "k";
}

function monthLabel(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleDateString("hu-HU", { month: "short", year: "2-digit" });
}

export function PortfolioHistoryChart({ theme = T }) {
  const [rangeIdx, setRangeIdx] = useState(1);
  const [data,     setData]     = useState([]);
  const [loading,  setLoading]  = useState(true);

  useEffect(() => {
    setLoading(true);
    fetchPortfolioHistory(RANGES[rangeIdx].days)
      .then(rows => setData(rows || []))
      .catch(() => setData([]))
      .finally(() => setLoading(false));
  }, [rangeIdx]);

  const isEmpty = !loading && data.length < 2;
  const hasOneDay = !loading && data.length === 1;
  const lastPoint = data[data.length - 1];
  const isUp = lastPoint ? lastPoint.total_value >= (data[0]?.total_value ?? 0) : true;
  const lineColor = isUp ? "#6EE7B7" : "#FCA5A5";

  // SVG helpers
  const allValues = data.flatMap(d => [d.total_value, d.total_cost]).filter(Boolean);
  const minV = allValues.length ? Math.min(...allValues) * 0.995 : 0;
  const maxV = allValues.length ? Math.max(...allValues) * 1.005 : 1;

  const px = i => PAD.l + (i / Math.max(data.length - 1, 1)) * (W - PAD.l - PAD.r);
  const py = v => PAD.t + (1 - (v - minV) / (maxV - minV)) * (H - PAD.t - PAD.b);

  const valuePath = data.map((d, i) => `${i === 0 ? "M" : "L"}${px(i).toFixed(1)},${py(d.total_value).toFixed(1)}`).join(" ");
  const costPath  = data.map((d, i) => `${i === 0 ? "M" : "L"}${px(i).toFixed(1)},${py(d.total_cost ?? 0).toFixed(1)}`).join(" ");
  const areaPath  = valuePath + ` L${px(data.length - 1).toFixed(1)},${(H - PAD.b).toFixed(1)} L${PAD.l},${(H - PAD.b).toFixed(1)} Z`;

  // Y ticks
  const yTicks = [0, 1, 2, 3].map(i => minV + (maxV - minV) * (1 - i / 3));

  // X labels: first, middle, last
  const xLabels = data.length >= 2
    ? [0, Math.floor((data.length - 1) / 2), data.length - 1].map(i => ({ i, label: monthLabel(data[i].date) }))
    : [];

  return (
    <div style={glassCard(theme, { padding: 16 })}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <span style={{ fontSize: 11, color: theme.text.secondary, textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700 }}>
          📈 Portfólió történet
        </span>
        <div style={{ display: "flex", gap: 4 }}>
          {RANGES.map((r, i) => (
            <button key={r.label} onClick={() => setRangeIdx(i)} style={{
              background: rangeIdx === i ? "rgba(110,231,183,0.15)" : "none",
              border: `1px solid ${rangeIdx === i ? "#6EE7B7" : theme.border.subtle}`,
              borderRadius: 4, padding: "2px 7px",
              color: rangeIdx === i ? "#6EE7B7" : theme.text.tertiary,
              cursor: "pointer", fontSize: 10, fontWeight: 700, fontFamily: "inherit",
            }}>{r.label}</button>
          ))}
        </div>
      </div>

      {/* Chart */}
      {loading ? (
        <div style={{ height: H, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ width: 18, height: 18, border: `2px solid ${theme.border.default}`, borderTopColor: "#6EE7B7", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
        </div>
      ) : isEmpty ? (
        <div style={{ height: H, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 6 }}>
          <span style={{ fontSize: 22 }}>📊</span>
          <span style={{ fontSize: 12, color: theme.text.tertiary, textAlign: "center", lineHeight: 1.5 }}>
            {hasOneDay
              ? <>1 nap rögzítve ✓<br />Holnap megjelenik a görbe!</>
              : <>Még nincs adat.<br />Frissítsd az árfolyamokat a felvételhez!</>}
          </span>
        </div>
      ) : (
        <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ overflow: "visible" }}>
          <defs>
            <linearGradient id="phGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={lineColor} stopOpacity="0.22" />
              <stop offset="100%" stopColor={lineColor} stopOpacity="0.01" />
            </linearGradient>
          </defs>

          {/* Y gridlines + labels */}
          {yTicks.map((v, i) => {
            const y = py(v).toFixed(1);
            return (
              <g key={i}>
                <line x1={PAD.l} y1={y} x2={W - PAD.r} y2={y} stroke={theme.border.subtle} strokeWidth="0.5" strokeDasharray="3,3" />
                <text x={PAD.l - 4} y={+y + 3.5} textAnchor="end" fontSize="8" fill={theme.text.tertiary}>{fmt(v)}</text>
              </g>
            );
          })}

          {/* Area fill */}
          {valuePath && <path d={areaPath} fill="url(#phGrad)" />}

          {/* Cost line (invested capital) */}
          {costPath && data.some(d => d.total_cost) && (
            <path d={costPath} fill="none" stroke={theme.border.default} strokeWidth="1.2" strokeDasharray="4,3" />
          )}

          {/* Value line */}
          {valuePath && <path d={valuePath} fill="none" stroke={lineColor} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />}

          {/* Last point dot */}
          {lastPoint && (
            <circle cx={px(data.length - 1).toFixed(1)} cy={py(lastPoint.total_value).toFixed(1)} r="4" fill={lineColor} stroke={theme.bg.surface || "#0D1117"} strokeWidth="1.5" />
          )}

          {/* X labels */}
          {xLabels.map(({ i, label }) => (
            <text key={i} x={px(i).toFixed(1)} y={H - 2} textAnchor="middle" fontSize="8" fill={theme.text.tertiary}>{label}</text>
          ))}
        </svg>
      )}

      {/* Legend */}
      {!isEmpty && !loading && (
        <div style={{ display: "flex", gap: 14, marginTop: 8, justifyContent: "flex-end" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 10, color: theme.text.tertiary }}>
            <div style={{ width: 16, height: 2, background: lineColor, borderRadius: 2 }} /> Portfólió értéke
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 10, color: theme.text.tertiary }}>
            <div style={{ width: 16, height: 0, borderTop: `1.5px dashed ${theme.border.default}` }} /> Befektetett tőke
          </div>
        </div>
      )}
    </div>
  );
}
