import { useEffect, useState } from "react";
import { appLog } from "../services/logger";
import { THEME as T, glassCard, haptic } from "../design-system";
import { fmtNum } from "../utils";

// ─── SKELETON ─────────────────────────────────────────────────────────────────
function Sk({ w = "100%", h = 16, r = 6, style = {} }) {
  return (
    <div style={{
      width: w, height: h, borderRadius: r,
      background: `linear-gradient(90deg, ${T.bg.surface} 25%, ${T.bg.raised} 50%, ${T.bg.surface} 75%)`,
      backgroundSize: "200% 100%",
      animation: "shimmer 1.6s infinite",
      flexShrink: 0,
      ...style,
    }} />
  );
}

// Stat kártya skeleton (2x2 grid)
export function StatCardsSkeleton() {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
      {[0,1,2,3].map(i => (
        <div key={i} style={{ ...glassCard(T, { padding: 16 }), display: "flex", flexDirection: "column", gap: 10 }}>
          <Sk w="60%" h={10} />
          <Sk w="80%" h={24} r={8} />
          <Sk w="40%" h={10} />
        </div>
      ))}
    </div>
  );
}

// Befektetés kártya skeleton (mobil lista)
export function InvestmentCardSkeleton() {
  return (
    <div style={{ ...glassCard(T, { padding: "14px 16px" }), display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Sk w={38} h={38} r={10} />
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <Sk w={100} h={13} />
            <Sk w={60} h={10} />
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
          <Sk w={70} h={14} />
          <Sk w={50} h={10} />
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, paddingTop: 10, borderTop: `1px solid ${T.border.subtle}` }}>
        {[0,1,2].map(i => (
          <div key={i} style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            <Sk w="50%" h={9} />
            <Sk w="80%" h={12} />
          </div>
        ))}
      </div>
    </div>
  );
}

// Teljes portfólió skeleton
export function PortfolioSkeleton() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <StatCardsSkeleton />
      {/* Chart skeleton */}
      <div style={{ ...glassCard(T, { padding: 16 }), marginBottom: 6 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 14 }}>
          <Sk w={120} h={11} />
          <div style={{ display: "flex", gap: 6 }}>
            <Sk w={80} h={28} r={8} />
            <Sk w={80} h={28} r={8} />
          </div>
        </div>
        <Sk w="100%" h={130} r={10} />
      </div>
      {/* Keresés skeleton */}
      <Sk w="100%" h={40} r={8} style={{ marginBottom: 6 }} />
      {/* Kártyák */}
      {[0,1,2,3].map(i => (
        <InvestmentCardSkeleton key={i} />
      ))}
    </div>
  );
}

// Dashboard skeleton
export function DashboardSkeleton() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        {[0,1,2,3].map(i => (
          <div key={i} style={{ ...glassCard(T, { padding: 16 }), display: "flex", flexDirection: "column", gap: 10 }}>
            <Sk w="55%" h={10} />
            <Sk w="75%" h={22} r={8} />
            <Sk w="40%" h={10} />
          </div>
        ))}
      </div>
      {/* Top movers */}
      <div style={glassCard(T, { padding: 16 })}>
        <Sk w={120} h={11} style={{ marginBottom: 14 }} />
        {[0,1,2].map(i => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 0", borderBottom: `1px solid ${T.border.subtle}` }}>
            <Sk w={22} h={22} r={11} />
            <Sk w={34} h={34} r={8} />
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 5 }}>
              <Sk w="60%" h={12} />
              <Sk w="40%" h={10} />
            </div>
            <Sk w={70} h={28} r={6} />
          </div>
        ))}
      </div>
      {/* Chart widget */}
      <div style={glassCard(T, { padding: 16 })}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 14 }}>
          <Sk w={150} h={11} />
          <div style={{ display: "flex", gap: 4 }}>
            {[0,1,2].map(i => <Sk key={i} w={40} h={26} r={6} />)}
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 }}>
          <Sk w="100%" h={60} r={10} />
          <Sk w="100%" h={60} r={10} />
        </div>
        <Sk w="100%" h={100} r={8} />
      </div>
    </div>
  );
}


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
    return { ...d, path: `M${x1},${y1} A${r},${r},0,${large},1,${x2},${y2} L${xi1},${yi1} A${ri},${ri},0,${large},0,${xi2},${yi2} Z` };
  });
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <filter id="glow"><feGaussianBlur stdDeviation="2" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
      {segments.map((s, i) => (
        <path key={i} d={s.path} fill={s.color} opacity="0.85" filter="url(#glow)">
          <title>{s.label}: {fmtNum(s.pct, 1)}%</title>
        </path>
      ))}
    </svg>
  );
}

// ─── SPARKLINE ────────────────────────────────────────────────────────────────
export function Sparkline({ pct }) {
  const up = pct >= 0;
  const points = Array.from({ length: 12 }, (_, i) => {
    const noise = (Math.sin(i * 2.1 + pct) + Math.cos(i * 1.3)) * 6;
    return { x: i * 10, y: 30 - (i / 11) * pct * 0.4 + noise };
  });
  return (
    <svg width="110" height="36" viewBox="0 0 110 36">
      <defs>
        <linearGradient id={`sg${pct > 0 ? 'u' : 'd'}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={up ? "#6EE7B7" : "#FCA5A5"} stopOpacity="0.3"/>
          <stop offset="100%" stopColor={up ? "#6EE7B7" : "#FCA5A5"} stopOpacity="0"/>
        </linearGradient>
      </defs>
      <polyline points={points.map(p => `${p.x},${p.y}`).join(" ")}
        fill="none" stroke={up ? "#6EE7B7" : "#FCA5A5"} strokeWidth="1.5" strokeLinecap="round" />
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
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)", backdropFilter: "blur(16px)", zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", padding: 16, animation: "fadeIn 0.2s ease" }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ ...glassCard(T, { padding: 0, maxWidth: 560, width: "100%", maxHeight: "90vh", overflow: "auto" }), background: "rgba(7,11,20,0.92)", animation: "scaleIn 0.25s cubic-bezier(0.34,1.56,0.64,1)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "20px 24px 0", marginBottom: 20 }}>
          <span style={{ fontSize: 18, fontWeight: 700, color: T.text.primary }}>{title}</span>
          <button onClick={() => { haptic("light"); onClose(); }} style={{ background: T.bg.surface, border: `1px solid ${T.border.subtle}`, borderRadius: T.radius.full, width: 30, height: 30, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: T.text.secondary, fontSize: 16 }}>×</button>
        </div>
        <div style={{ padding: "0 24px 24px" }}>{children}</div>
      </div>
    </div>
  );
}

// ─── TOAST ────────────────────────────────────────────────────────────────────
export function Toast({ toast }) {
  if (!toast) return null;
  const map = { error: ["rgba(239,68,68,0.15)", "#FCA5A5"], info: ["rgba(59,130,246,0.15)", "#93C5FD"], success: ["rgba(110,231,183,0.15)", "#6EE7B7"] };
  const [bg, border] = map[toast.type] || map.success;
  return (
    <div style={{ position: "fixed", bottom: 28, left: "50%", transform: "translateX(-50%)", background: bg, border: `1px solid ${border}`, backdropFilter: "blur(16px)", borderRadius: 12, padding: "12px 20px", fontSize: 13, color: T.text.primary, boxShadow: `0 8px 32px rgba(0,0,0,0.5), 0 0 0 1px ${border}20`, zIndex: 100, maxWidth: 340, textAlign: "center", animation: "slideIn 0.25s ease", whiteSpace: "nowrap" }}>
      {toast.msg}
    </div>
  );
}

// ─── LOG MODAL ────────────────────────────────────────────────────────────────
export function LogModal({ onClose }) {
  const [entries, setEntries] = useState([...appLog._entries]);
  useEffect(() => appLog.subscribe(setEntries), []);
  const COLORS = { info: T.accent.blue, warn: T.accent.yellow, error: T.accent.red };
  const ICONS  = { info: "ℹ️", warn: "⚠️", error: "❌" };
  const copyAll = () => {
    const text = entries.map(e => `[${e.time}] [${e.level.toUpperCase()}] ${e.msg}${e.detail ? " | " + e.detail : ""}`).join("\n");
    navigator.clipboard?.writeText(text).then(() => alert("Vágólapra másolva!")).catch(() => alert(text));
  };
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", backdropFilter: "blur(12px)", zIndex: 60, display: "flex", alignItems: "flex-end" }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ background: "rgba(7,11,20,0.96)", border: `1px solid ${T.border.default}`, borderRadius: "20px 20px 0 0", width: "100%", maxHeight: "80vh", display: "flex", flexDirection: "column", backdropFilter: T.blur.lg }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 20px", borderBottom: `1px solid ${T.border.subtle}`, flexShrink: 0 }}>
          <span style={{ fontWeight: 700, color: T.text.primary, fontSize: 16 }}>🪲 Debug Log</span>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={copyAll} style={{ ...glassCard(T, {}), border: `1px solid ${T.border.default}`, borderRadius: T.radius.md, padding: "5px 12px", color: T.text.secondary, cursor: "pointer", fontSize: 12, fontFamily: "inherit" }}>📋 Másolás</button>
            <button onClick={() => appLog.clear()} style={{ ...glassCard(T, {}), border: `1px solid ${T.border.default}`, borderRadius: T.radius.md, padding: "5px 12px", color: T.text.secondary, cursor: "pointer", fontSize: 12, fontFamily: "inherit" }}>🗑️</button>
            <button onClick={onClose} style={{ background: "none", border: "none", color: T.text.secondary, cursor: "pointer", fontSize: 22 }}>×</button>
          </div>
        </div>
        <div style={{ overflowY: "auto", flex: 1, padding: "10px 16px" }}>
          {entries.length === 0 ? (
            <div style={{ textAlign: "center", color: T.text.secondary, padding: "40px 0", fontSize: 13 }}>Még nincs log bejegyzés.</div>
          ) : entries.map((e, i) => (
            <div key={i} style={{ borderBottom: `1px solid ${T.border.subtle}`, padding: "7px 0", fontSize: 12, fontFamily: "'DM Mono',monospace" }}>
              <div style={{ display: "flex", gap: 8, alignItems: "baseline" }}>
                <span style={{ color: T.text.tertiary, flexShrink: 0 }}>{e.time}</span>
                <span style={{ color: COLORS[e.level], flexShrink: 0 }}>{ICONS[e.level]}</span>
                <span style={{ color: T.text.primary, wordBreak: "break-all" }}>{e.msg}</span>
              </div>
              {e.detail && <div style={{ color: T.text.secondary, marginTop: 2, paddingLeft: 16, wordBreak: "break-all", fontSize: 11 }}>{String(e.detail)}</div>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
