// components/InvRow.jsx
import { useState } from "react";
import { CATEGORY_COLORS } from "../constants";
import { fmtNum } from "../utils";

function fmtRelativeTime(isoStr) {
  const diff = (Date.now() - new Date(isoStr)) / 1000;
  if (diff < 60) return "most frissült";
  if (diff < 3600) return `${Math.floor(diff / 60)} perce`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} órája`;
  return new Date(isoStr).toLocaleDateString("hu-HU");
}

export function InvRow({ inv, value, abs, pct, avgBuyPrice, quantity, up, theme, onDetail, onSell, onEdit, onDelete, onRefresh, isRefreshing }) {
  const [open, setOpen] = useState(false);
  const color = up ? theme.accent.green : theme.accent.red;

  return (
    <div style={{ borderBottom:`1px solid ${theme.border.subtle}` }}>
      <div onClick={() => setOpen(v => !v)}
        style={{ display:"grid", gridTemplateColumns:"1fr auto auto auto", gap:8, padding:"10px 12px", cursor:"pointer", alignItems:"center" }}
        onMouseEnter={e => e.currentTarget.style.background = theme.bg.surface}
        onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
        <div style={{ display:"flex", alignItems:"center", gap:8, minWidth:0 }}>
          <div style={{ width:30, height:30, borderRadius:7, background:CATEGORY_COLORS[inv.category]+"20", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, border:`1px solid ${CATEGORY_COLORS[inv.category]}25` }}>
            <span style={{ fontSize:9, fontWeight:800, color:CATEGORY_COLORS[inv.category], fontFamily:"'DM Mono',monospace" }}>
              {(inv.ticker||inv.name).slice(0,4).toUpperCase()}
            </span>
          </div>
          <div style={{ minWidth:0 }}>
            <div style={{ fontSize:13, fontWeight:600, color:theme.text.primary, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{inv.name}</div>
            <div style={{ fontSize:10, color:theme.text.tertiary, fontFamily:"'DM Mono',monospace" }}>{inv.ticker}</div>
            {inv._refreshedAt && (
              <div style={{ fontSize:9, color:theme.text.tertiary, opacity:0.6 }}>{fmtRelativeTime(inv._refreshedAt)}</div>
            )}
          </div>
        </div>
        <div style={{ fontSize:13, fontWeight:700, color:theme.text.primary, fontFamily:"'DM Mono',monospace", textAlign:"right" }}>
          {fmtNum(value, 0)}
        </div>
        <div style={{ fontSize:13, fontWeight:700, color, fontFamily:"'DM Mono',monospace", textAlign:"right", minWidth:60 }}>
          {up?"+":""}{fmtNum(pct, 2)}%
        </div>
        <span style={{ color:theme.text.tertiary, fontSize:10 }}>{open?"▲":"▼"}</span>
      </div>

      {open && (
        <div style={{ padding:"0 12px 12px", background:theme.bg.inset }}>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:8, marginBottom:10 }}>
            {[
              ["Vételár",    fmtNum(avgBuyPrice, 2) + " " + inv.currency],
              ["Mennyiség",  fmtNum(quantity, quantity%1===0 ? 0 : 4) + " db"],
              ["P&L összeg", (up?"+":"")+fmtNum(abs,0)+" Ft"],
            ].map(([l,v]) => (
              <div key={l}>
                <div style={{ fontSize:9, color:theme.text.tertiary, textTransform:"uppercase", marginBottom:2 }}>{l}</div>
                <div style={{ fontSize:12, color:theme.text.secondary, fontFamily:"'DM Mono',monospace" }}>{v}</div>
              </div>
            ))}
          </div>
          <div style={{ display:"flex", gap:6 }} onClick={e => e.stopPropagation()}>
            <button onClick={onDetail} style={{ flex:1, background:theme.bg.surface, border:`1px solid ${theme.border.subtle}`, borderRadius:theme.radius.sm, padding:"6px 0", color:theme.text.secondary, cursor:"pointer", fontSize:11, fontFamily:"inherit" }}>📈 Grafikon</button>
            <button onClick={onSell}   style={{ flex:1, background:"rgba(252,165,165,0.08)", border:`1px solid rgba(252,165,165,0.2)`, borderRadius:theme.radius.sm, padding:"6px 0", color:theme.accent.red, cursor:"pointer", fontSize:11, fontFamily:"inherit", fontWeight:600 }}>📤 Eladás</button>
            <button onClick={onEdit}   style={{ background:theme.bg.surface, border:`1px solid ${theme.border.subtle}`, borderRadius:theme.radius.sm, padding:"6px 10px", color:theme.text.secondary, cursor:"pointer", fontSize:12, fontFamily:"inherit" }}>✏️</button>
            <button onClick={onDelete} style={{ background:"none", border:`1px solid rgba(252,165,165,0.15)`, borderRadius:theme.radius.sm, padding:"6px 10px", color:theme.accent.red, cursor:"pointer", fontSize:12, fontFamily:"inherit" }}>🗑️</button>
            {onRefresh && inv.ticker?.trim() && (
              <button onClick={onRefresh} disabled={isRefreshing}
                title="Árfolyam frissítése"
                style={{ background:"none", border:`1px solid ${theme.border.subtle}`, borderRadius:theme.radius.sm, padding:"6px 10px", color:theme.text.tertiary, cursor:isRefreshing?"not-allowed":"pointer", fontSize:12, fontFamily:"inherit", opacity:isRefreshing?0.5:1 }}>
                {isRefreshing ? "⏳" : "⟳"}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
