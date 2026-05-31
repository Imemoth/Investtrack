// components/PortfolioTab.jsx
import { useState } from "react";
import { CATEGORIES, CATEGORY_COLORS } from "../constants";
import { fmtNum, fmtCurrency, calcPnL } from "../utils";
import { glassCard } from "../design-system";
import { DonutChart } from "./ui";
import { Treemap } from "./Treemap";
import { InvRow } from "./InvRow";

export function PortfolioTab({
  theme, investments, closedPositions,
  stats, refreshLabel,
  search, setSearch, filterCat, setFilterCat,
  sortBy, setSortBy, sortDir, setSortDir,
  displayed, showClosed, setShowClosed,
  chartMode, setChartMode,
  onDetail, onSell, onEdit, onDelete,
}) {
  const S = makeStyles(theme);

  return (
    <>
      {/* ── Stat kártyák ── */}
      <StatCards theme={theme} stats={stats} investments={investments}
        closedPositions={closedPositions} refreshLabel={refreshLabel} />

      {/* ── Eszközosztályok chart ── */}
      <ChartSection theme={theme} stats={stats} chartMode={chartMode}
        setChartMode={setChartMode} investments={investments} onDetail={onDetail} />

      {/* ── Kereső + szűrők ── */}
      <Filters theme={theme} search={search} setSearch={setSearch}
        filterCat={filterCat} setFilterCat={setFilterCat}
        sortBy={sortBy} setSortBy={setSortBy} sortDir={sortDir} setSortDir={setSortDir}
        refreshLabel={refreshLabel} />

      {/* ── Kompakt lista ── */}
      <div style={{ display:"flex", flexDirection:"column", gap:0 }}>
        <div style={{ display:"grid", gridTemplateColumns:"1fr auto auto auto", gap:8, padding:"6px 12px", borderBottom:`1px solid ${theme.border.subtle}` }}>
          {["Részvény","Érték","P&L %",""].map((h,i) => (
            <div key={i} style={{ fontSize:9, color:theme.text.tertiary, textTransform:"uppercase", letterSpacing:"0.07em", fontWeight:700, textAlign:i>=1?"right":"left" }}>{h}</div>
          ))}
        </div>
        {displayed.map(inv => {
          const { value, abs, pct, avgBuyPrice, quantity } = calcPnL(inv);
          return (
            <InvRow key={inv.id} inv={inv} value={value} abs={abs} pct={pct}
              avgBuyPrice={avgBuyPrice} quantity={quantity} up={pct>=0} theme={theme}
              onDetail={() => onDetail(inv)} onSell={() => onSell(inv)}
              onEdit={() => onEdit(inv)} onDelete={() => onDelete(inv)}
            />
          );
        })}
      </div>

      {/* ── Lezárt pozíciók ── */}
      {closedPositions.length > 0 && (
        <ClosedSection theme={theme} closedPositions={closedPositions}
          showClosed={showClosed} setShowClosed={setShowClosed} />
      )}
    </>
  );
}

// ─── STAT KÁRTYÁK ─────────────────────────────────────────────────────────────
function StatCards({ theme, stats, investments, closedPositions, refreshLabel }) {
  const cards = [
    { label: "Portfólió értéke",
      val: fmtCurrency(stats.totalValue + stats.pendingTotal, "HUF"),
      sub: `${investments.length} pozíció${stats.pendingTotal > 0 ? ` · +${fmtNum(stats.pendingTotal,0)} Ft függőben` : ""}`,
      color: theme.text.primary, glow: null },
    { label: "Befektetett tőke",
      val: fmtCurrency(stats.totalCost, "HUF"),
      sub: "Összes vételár", color: theme.text.secondary, glow: null },
    { label: "Papír nyereség",
      val: (stats.totalPnL >= 0 ? "+" : "") + fmtCurrency(stats.totalPnL, "HUF"),
      sub: `${stats.totalPnL >= 0 ? "+" : ""}${fmtNum(stats.totalPct, 2)}%`,
      color: stats.totalPnL >= 0 ? theme.accent.green : theme.accent.red,
      glow: stats.totalPnL >= 0 ? "rgba(110,231,183,0.12)" : "rgba(252,165,165,0.12)" },
    { label: "💰 Realizált P&L",
      val: closedPositions.length > 0 ? (stats.totalRealizedPnL >= 0 ? "+" : "") + fmtCurrency(stats.totalRealizedPnL, "HUF") : "—",
      sub: closedPositions.length > 0 ? `${closedPositions.length} lezárt` : "XTB import kell",
      color: stats.totalRealizedPnL >= 0 ? theme.accent.green : theme.accent.red, glow: null },
    { label: "⏳ Függőben",
      val: stats.pendingTotal > 0 ? fmtCurrency(stats.pendingTotal, "HUF") : "—",
      sub: stats.pendingTotal > 0 && stats.totalValue > 0
        ? `portfólió ${fmtNum(stats.pendingTotal/(stats.totalValue+stats.pendingTotal)*100,1)}%-a`
        : "nincs megbízás",
      color: theme.accent.yellow, glow: null },
  ];

  return (
    <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:16 }}>
      {cards.map((s, i) => (
        <div key={i} style={{ background: s.glow || theme.bg.surface, border:`1px solid ${theme.border.subtle}`, borderRadius:theme.radius.lg, padding:14, animation:`slideUp 0.3s ease ${i*0.05}s both` }}>
          <div style={{ fontSize:10, color:theme.text.tertiary, textTransform:"uppercase", letterSpacing:"0.07em", fontWeight:700, marginBottom:6 }}>{s.label}</div>
          <div style={{ fontSize:17, fontWeight:800, color:s.color, letterSpacing:"-0.02em", lineHeight:1.2, wordBreak:"break-all" }}>{s.val}</div>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginTop:4 }}>
            <span style={{ fontSize:11, color:theme.text.tertiary }}>{s.sub}</span>
            {i === 0 && refreshLabel && <span style={{ fontSize:10, color:theme.text.tertiary }}>🕐 {refreshLabel}</span>}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── CHART SZEKCIÓ ────────────────────────────────────────────────────────────
function ChartSection({ theme, stats, chartMode, setChartMode, investments, onDetail }) {
  return (
    <div style={{ ...glassCard(theme, { padding:16 }), marginBottom:16 }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
        <div style={{ fontSize:11, color:theme.text.secondary, textTransform:"uppercase", letterSpacing:"0.08em", fontWeight:700 }}>Pozíciók súlya</div>
        <div style={{ display:"flex", gap:6 }}>
          {["category","position"].map(m => (
            <button key={m} onClick={() => setChartMode(m)} style={{
              background: chartMode===m ? theme.bg.overlay : "none",
              border:`1px solid ${chartMode===m ? theme.border.default : "transparent"}`,
              borderRadius:theme.radius.sm, padding:"4px 10px", cursor:"pointer",
              fontSize:11, fontWeight:700, color:chartMode===m ? theme.text.primary : theme.text.tertiary,
              fontFamily:"inherit",
            }}>
              {m === "category" ? "🗂 Kategória" : "🔗 Pozíció"}
            </button>
          ))}
        </div>
      </div>
      {chartMode === "category" ? (
        <DonutChart data={stats.catBreakdown} />
      ) : (
        <Treemap data={stats.posBreakdown} onSelect={item => onDetail(investments.find(i => (i.ticker||i.name) === item.label))} />
      )}
    </div>
  );
}

// ─── KERESŐ + SZŰRŐK ─────────────────────────────────────────────────────────
function Filters({ theme, search, setSearch, filterCat, setFilterCat, sortBy, setSortBy, sortDir, setSortDir, refreshLabel }) {
  return (
    <>
      <div style={{ position:"relative", marginBottom:10 }}>
        <span style={{ position:"absolute", left:12, top:"50%", transform:"translateY(-50%)", color:theme.text.tertiary, pointerEvents:"none" }}>🔍</span>
        <input style={{ width:"100%", background:theme.bg.surface, border:`1px solid ${theme.border.subtle}`, borderRadius:theme.radius.md, padding:"10px 12px 10px 34px", color:theme.text.primary, fontSize:14, fontFamily:"inherit", outline:"none", boxSizing:"border-box" }}
          placeholder="Keresés..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>
      <div style={{ display:"flex", gap:6, overflowX:"auto", paddingBottom:4, marginBottom:10 }}>
        {["Összes", ...CATEGORIES].map(cat => (
          <button key={cat} onClick={() => setFilterCat(cat)} style={{
            flexShrink:0, background:filterCat===cat ? (CATEGORY_COLORS[cat]+"25"||theme.bg.overlay) : "none",
            border:`1px solid ${filterCat===cat ? (CATEGORY_COLORS[cat]||theme.accent.green) : theme.border.subtle}`,
            borderRadius:theme.radius.full, padding:"5px 12px", cursor:"pointer",
            fontSize:12, fontWeight:filterCat===cat?700:400,
            color:filterCat===cat ? (CATEGORY_COLORS[cat]||theme.accent.green) : theme.text.secondary,
            fontFamily:"inherit",
          }}>{cat}</button>
        ))}
      </div>
    </>
  );
}

// ─── LEZÁRT POZÍCIÓK ─────────────────────────────────────────────────────────
function ClosedSection({ theme, closedPositions, showClosed, setShowClosed }) {
  const totalPnl = closedPositions.reduce((s,c) => s+c.pnl, 0);
  return (
    <div style={{ marginTop:16 }}>
      <button onClick={() => setShowClosed(v => !v)} style={{ width:"100%", ...glassCard(theme, { padding:"12px 16px" }), cursor:"pointer", display:"flex", justifyContent:"space-between", alignItems:"center", fontFamily:"inherit" }}>
        <span style={{ fontSize:13, fontWeight:700, color:theme.text.primary }}>📊 Lezárt pozíciók ({closedPositions.length})</span>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <span style={{ fontSize:12, fontFamily:"'DM Mono',monospace", fontWeight:700, color:totalPnl>=0?theme.accent.green:theme.accent.red }}>
            {totalPnl>=0?"+":""}{fmtNum(totalPnl,0)} Ft
          </span>
          <span style={{ color:theme.text.tertiary }}>{showClosed?"▲":"▼"}</span>
        </div>
      </button>
      {showClosed && (
        <div style={{ display:"flex", flexDirection:"column", gap:8, marginTop:8 }}>
          {closedPositions.filter(cp => cp.volume > 0).map((cp, i) => (
            <div key={cp.id||i} style={{ ...glassCard(theme, { padding:"12px 16px" }), opacity:0.85 }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:8 }}>
                <div>
                  <div style={{ fontWeight:700, fontSize:13, color:theme.text.primary }}>{cp.name}</div>
                  <div style={{ fontSize:10, color:theme.text.tertiary, fontFamily:"'DM Mono',monospace" }}>{cp.openDate} → {cp.closeDate}</div>
                </div>
                <div style={{ textAlign:"right" }}>
                  <div style={{ fontSize:14, fontWeight:700, fontFamily:"'DM Mono',monospace", color:cp.pnl>=0?theme.accent.green:theme.accent.red }}>
                    {cp.pnl>=0?"+":""}{fmtNum(cp.pnl,0)} Ft
                  </div>
                  <div style={{ fontSize:11, fontFamily:"'DM Mono',monospace", color:cp.pnlPct>=0?theme.accent.green:theme.accent.red }}>
                    {cp.pnlPct>=0?"+":""}{fmtNum(cp.pnlPct,2)}%
                  </div>
                </div>
              </div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:6, borderTop:`1px solid ${theme.border.subtle}`, paddingTop:8 }}>
                {[["Db",fmtNum(cp.volume,4)],["Vétel",`$${fmtNum(cp.openUsdPrice,2)}`],["Zárás",`$${fmtNum(cp.closeUsdPrice,2)}`],
                  ["Befizetve",fmtNum(cp.purchaseHuf,0)+" Ft"],["Bevétel",fmtNum(cp.saleHuf,0)+" Ft"],["Dátum",cp.closeDate]].map(([l,v]) => (
                  <div key={l}>
                    <div style={{ fontSize:9, color:theme.text.tertiary, textTransform:"uppercase", marginBottom:2 }}>{l}</div>
                    <div style={{ fontSize:11, color:theme.text.secondary, fontFamily:"'DM Mono',monospace" }}>{v}</div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function makeStyles(theme) { return {}; }
