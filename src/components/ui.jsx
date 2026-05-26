import { useEffect, useState } from "react";
import { fmtNum } from "../utils";
import { appLog } from "../services/logger";

// ─── DONUT CHART ──────────────────────────────────────────────────────────────
export function DonutChart({ data, size = 180 }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  if (total === 0) return null;
  let angle = -90;
  const cx = size / 2, cy = size / 2;
  const r  = size * 0.36, ri = size * 0.22;

  const segments = data.map(d => {
    const sweep = (d.value / total) * 360;
    const start = angle; angle += sweep;
    const toRad = a => (a * Math.PI) / 180;
    const x1  = cx + r  * Math.cos(toRad(start));
    const y1  = cy + r  * Math.sin(toRad(start));
    const x2  = cx + r  * Math.cos(toRad(start + sweep));
    const y2  = cy + r  * Math.sin(toRad(start + sweep));
    const xi1 = cx + ri * Math.cos(toRad(start + sweep));
    const yi1 = cy + ri * Math.sin(toRad(start + sweep));
    const xi2 = cx + ri * Math.cos(toRad(start));
    const yi2 = cy + ri * Math.sin(toRad(start));
    const large = sweep > 180 ? 1 : 0;
    return {
      ...d,
      path: `M${x1},${y1} A${r},${r},0,${large},1,${x2},${y2} L${xi1},${yi1} A${ri},${ri},0,${large},0,${xi2},${yi2} Z`,
    };
  });

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {segments.map((s, i) => (
        <path key={i} d={s.path} fill={s.color} opacity="0.9">
          <title>{s.label}: {fmtNum(s.pct, 1)}%</title>
        </path>
      ))}
    </svg>
  );
}

// ─── SPARKLINE ────────────────────────────────────────────────────────────────
export function Sparkline({ pct }) {
  const up     = pct >= 0;
  const points = Array.from({ length: 12 }, (_, i) => {
    const noise = (Math.sin(i * 2.1 + pct) + Math.cos(i * 1.3)) * 6;
    return { x: i * 10, y: 30 - (i / 11) * pct * 0.4 + noise };
  });
  return (
    <svg width="110" height="36" viewBox="0 0 110 36">
      <polyline
        points={points.map(p => `${p.x},${p.y}`).join(" ")}
        fill="none"
        stroke={up ? "#6EE7B7" : "#FCA5A5"}
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

// ─── MODAL ────────────────────────────────────────────────────────────────────
export function Modal({ title, onClose, children }) {
  useEffect(() => {
    const h = e => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.7)", backdropFilter: "blur(4px)", zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", padding: "16px" }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{ background: "#161B22", border: "1px solid #30363D", borderRadius: 16, width: "100%", maxWidth: 560, maxHeight: "90vh", overflow: "auto", boxShadow: "0 24px 64px rgba(0,0,0,.6)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "20px 24px 0", marginBottom: 20 }}>
          <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 18, fontWeight: 700, color: "#E6EDF3" }}>{title}</span>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#8B949E", cursor: "pointer", fontSize: 22, lineHeight: 1, padding: "0 4px" }}>×</button>
        </div>
        <div style={{ padding: "0 24px 24px" }}>{children}</div>
      </div>
    </div>
  );
}

// ─── TOAST ────────────────────────────────────────────────────────────────────
export function Toast({ toast }) {
  if (!toast) return null;
  const colors = {
    error: { bg: "#3D0A0A", border: "#FCA5A5" },
    info:  { bg: "#1C2A3D", border: "#93C5FD" },
    success: { bg: "#0D2818", border: "#6EE7B7" },
  };
  const { bg, border } = colors[toast.type] || colors.success;
  return (
    <div style={{
      position: "fixed", bottom: 24, right: 24,
      background: bg, border: `1px solid ${border}`,
      borderRadius: 10, padding: "12px 18px", fontSize: 13, color: "#E6EDF3",
      boxShadow: "0 8px 32px rgba(0,0,0,.5)", zIndex: 100, maxWidth: 300,
      animation: "slideIn .2s ease",
    }}>
      {toast.msg}
    </div>
  );
}

// ─── LOG MODAL ────────────────────────────────────────────────────────────────
export function LogModal({ onClose }) {
  const [entries, setEntries] = useState([...appLog._entries]);
  useEffect(() => appLog.subscribe(setEntries), []);

  const COLORS = { info: "#93C5FD", warn: "#FDE68A", error: "#FCA5A5" };
  const ICONS  = { info: "ℹ️",      warn: "⚠️",      error: "❌" };

  const copyAll = () => {
    const text = entries
      .map(e => `[${e.time}] [${e.level.toUpperCase()}] ${e.msg}${e.detail ? " | " + String(e.detail) : ""}`)
      .join("\n");
    navigator.clipboard?.writeText(text)
      .then(() => alert("Log vágólapra másolva!"))
      .catch(() => alert(text));
  };

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.8)", backdropFilter: "blur(4px)", zIndex: 60, display: "flex", alignItems: "flex-end" }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{ background: "#0D1117", border: "1px solid #30363D", borderRadius: "16px 16px 0 0", width: "100%", maxHeight: "80vh", display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 20px", borderBottom: "1px solid #21262D", flexShrink: 0 }}>
          <span style={{ fontWeight: 700, color: "#E6EDF3", fontSize: 16 }}>🪲 Debug Log</span>
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={copyAll} style={{ background: "#21262D", border: "none", borderRadius: 6, padding: "6px 12px", color: "#C9D1D9", cursor: "pointer", fontSize: 12, fontFamily: "inherit" }}>📋 Másolás</button>
            <button onClick={() => appLog.clear()} style={{ background: "#21262D", border: "none", borderRadius: 6, padding: "6px 12px", color: "#C9D1D9", cursor: "pointer", fontSize: 12, fontFamily: "inherit" }}>🗑️ Törlés</button>
            <button onClick={onClose} style={{ background: "none", border: "none", color: "#8B949E", cursor: "pointer", fontSize: 22, lineHeight: 1 }}>×</button>
          </div>
        </div>
        <div style={{ overflowY: "auto", flex: 1, padding: "12px 16px" }}>
          {entries.length === 0 ? (
            <div style={{ textAlign: "center", color: "#8B949E", padding: "40px 0", fontSize: 13 }}>
              Még nincs log bejegyzés.<br />Nyomj a 🔄 Árfolyam gombra!
            </div>
          ) : entries.map((e, i) => (
            <div key={i} style={{ borderBottom: "1px solid #21262D", padding: "8px 0", fontSize: 12, fontFamily: "'DM Mono', monospace" }}>
              <div style={{ display: "flex", gap: 8, alignItems: "baseline" }}>
                <span style={{ color: "#8B949E", flexShrink: 0 }}>{e.time}</span>
                <span style={{ color: COLORS[e.level], flexShrink: 0 }}>{ICONS[e.level]} {e.level.toUpperCase()}</span>
                <span style={{ color: "#E6EDF3", wordBreak: "break-all" }}>{e.msg}</span>
              </div>
              {e.detail && (
                <div style={{ color: "#8B949E", marginTop: 3, paddingLeft: 16, wordBreak: "break-all", whiteSpace: "pre-wrap" }}>
                  {typeof e.detail === "object" ? JSON.stringify(e.detail, null, 2) : String(e.detail)}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
