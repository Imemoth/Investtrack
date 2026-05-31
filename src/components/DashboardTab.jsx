// components/DashboardTab.jsx
import { fmtNum, fmtCurrency } from "../utils";
import { TopMovers, CurrencyExposure, BenchmarkChart, RiskReturn, PendingOrders } from "./DashboardWidgets";

export function DashboardTab({ theme, investments, stats, fxRates, displayCurrency, initialOrders, onSaveOrder, onDeleteOrder }) {
  const cards = [
    { label: "Portfólió értéke",
      val: fmtCurrency(stats.totalValue + stats.pendingTotal, "HUF"),
      sub: `${investments.length} pozíció · ${stats.pendingTotal > 0 ? `+${fmtNum(stats.pendingTotal,0)} Ft függőben` : "nincs függő"}`,
      color: theme.text.primary },
    { label: "Befektetett tőke",
      val: fmtCurrency(stats.totalCost, "HUF"),
      sub: "Összes vételár", color: theme.text.secondary },
    { label: "Nyereség / Veszteség",
      val: (stats.totalPnL >= 0 ? "+" : "") + fmtCurrency(stats.totalPnL, "HUF"),
      sub: `${stats.totalPnL >= 0 ? "+" : ""}${fmtNum(stats.totalPct, 2)}%`,
      color: stats.totalPnL >= 0 ? theme.accent.green : theme.accent.red },
    { label: "💰 Éves osztalék",
      val: stats.totalDividend > 0 ? fmtCurrency(stats.totalDividend, "HUF") : "—",
      sub: "becsült bruttó", color: theme.accent.yellow },
  ];

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
      {/* Stat kártyák */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
        {cards.map((s, i) => (
          <div key={i} style={{ background:theme.bg.surface, border:`1px solid ${theme.border.subtle}`, borderRadius:theme.radius.lg, padding:14 }}>
            <div style={{ fontSize:10, color:theme.text.tertiary, textTransform:"uppercase", letterSpacing:"0.06em", fontWeight:700, marginBottom:6 }}>{s.label}</div>
            <div style={{ fontSize:17, fontWeight:800, color:s.color, letterSpacing:"-0.02em", lineHeight:1.2, wordBreak:"break-all" }}>{s.val}</div>
            <div style={{ fontSize:11, color:theme.text.tertiary, marginTop:4 }}>{s.sub}</div>
          </div>
        ))}
      </div>

      <TopMovers investments={investments} />
      <PendingOrders
        fxRates={fxRates}
        displayCurrency={displayCurrency}
        initialOrders={initialOrders}
        onSaveOrder={onSaveOrder}
        onDeleteOrder={onDeleteOrder}
      />
      <CurrencyExposure investments={investments} />
      <BenchmarkChart investments={investments} />
      <RiskReturn investments={investments} />
    </div>
  );
}
