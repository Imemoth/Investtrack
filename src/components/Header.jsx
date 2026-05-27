// components/Header.jsx
// Önálló header komponens – App.jsx-ből kiemelve

const btn = (v) => ({
  background: v === "primary" ? "linear-gradient(135deg,#238636,#2EA043)" : v === "ghost" ? "none" : "#21262D",
  border: v === "ghost" ? "1px solid #30363D" : "none",
  borderRadius: 8, padding: "7px 10px",
  color: v === "primary" ? "#fff" : "#C9D1D9",
  cursor: "pointer", fontSize: 13, fontWeight: 600,
  fontFamily: "inherit", display: "flex", alignItems: "center",
  justifyContent: "center", gap: 5, whiteSpace: "nowrap", flexShrink: 0,
});

export function Header({
  activeTab, setActiveTab,
  displayCurrency, setDisplayCurrency,
  refreshing, refreshProgress,
  onRefresh, onResetPrices,
  onImport, onExport,
  onNewInvestment,
  onTxLog, onAI, onLog,
}) {
  return (
    <header style={{
      background: "#161B22", borderBottom: "1px solid #21262D",
      padding: "0 12px", position: "sticky", top: 0, zIndex: 40,
    }}>
      {/* ── Row 1: logo + tabs + add button ── */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, height: 50 }}>
        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: 7, flexShrink: 0 }}>
          <svg width="24" height="24" viewBox="0 0 28 28" fill="none">
            <rect width="28" height="28" rx="8" fill="#6EE7B7" fillOpacity=".15"/>
            <polyline points="5,20 10,13 16,16 23,7" stroke="#6EE7B7" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
            <circle cx="23" cy="7" r="2.5" fill="#6EE7B7"/>
          </svg>
          <span style={{ fontWeight: 800, fontSize: 16, letterSpacing: "-0.03em", color: "#E6EDF3" }}>
            Invest<span style={{ color: "#6EE7B7" }}>Track</span>
          </span>
        </div>

        {/* Tab switcher – középen */}
        <div style={{ flex: 1, display: "flex", justifyContent: "center" }}>
          <div style={{ display: "flex", background: "#0D1117", borderRadius: 8, padding: 3, gap: 2 }}>
            {[["portfolio", "📋 Portfólió"], ["dashboard", "📊 Dashboard"]].map(([tab, label]) => (
              <button key={tab} onClick={() => setActiveTab(tab)} style={{
                background: activeTab === tab ? "#21262D" : "none", border: "none", borderRadius: 6,
                padding: "5px 10px", cursor: "pointer", fontSize: 12,
                color: activeTab === tab ? "#E6EDF3" : "#8B949E",
                fontFamily: "inherit", fontWeight: 600,
              }}>{label}</button>
            ))}
          </div>
        </div>

        {/* Add button */}
        <button style={{ ...btn("primary"), padding: "7px 12px", fontSize: 13 }} onClick={onNewInvestment}>
          <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
            <path d="M6 1v10M1 6h10" stroke="#fff" strokeWidth="2" strokeLinecap="round"/>
          </svg>
          Új
        </button>
      </div>

      {/* ── Row 2: actions toolbar ── */}
      <div style={{
        display: "flex", alignItems: "center", gap: 5,
        height: 40, paddingBottom: 6, overflowX: "auto",
        scrollbarWidth: "none", msOverflowStyle: "none",
      }}>
        {/* Currency switcher */}
        <div style={{ display: "flex", background: "#0D1117", borderRadius: 7, padding: 2, gap: 1, flexShrink: 0 }}>
          {["HUF", "USD", "EUR"].map(cur => (
            <button key={cur} onClick={() => setDisplayCurrency(cur)} style={{
              background: displayCurrency === cur ? "#21262D" : "none", border: "none", borderRadius: 5,
              padding: "3px 7px", cursor: "pointer", fontSize: 10, fontWeight: 700,
              color: displayCurrency === cur ? "#E6EDF3" : "#8B949E", fontFamily: "'DM Mono',monospace",
            }}>{cur}</button>
          ))}
        </div>

        <div style={{ width: 1, height: 20, background: "#21262D", flexShrink: 0 }} />

        {/* Import */}
        <button title="Import CSV" style={{ ...btn("ghost"), padding: "6px 9px", fontSize: 12 }} onClick={onImport}>
          <svg width="13" height="13" fill="none" viewBox="0 0 16 16">
            <path d="M8 2v9m-4-4 4 4 4-4M2 14h12" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/>
          </svg>
          Import
        </button>

        {/* Export */}
        <button title="Export CSV" style={{ ...btn("ghost"), padding: "6px 9px", fontSize: 12 }} onClick={onExport}>
          <svg width="13" height="13" fill="none" viewBox="0 0 16 16">
            <path d="M8 11V2m-4 5 4-4 4 4M2 14h12" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/>
          </svg>
          Export
        </button>

        {/* Refresh */}
        <button title="Árfolyam frissítése" style={{ ...btn("ghost"), padding: "6px 9px", fontSize: 12, opacity: refreshing ? 0.6 : 1 }}
          onClick={onRefresh} disabled={refreshing}>
          <svg width="13" height="13" fill="none" viewBox="0 0 16 16"
            style={{ animation: refreshing ? "spin 1s linear infinite" : "none", flexShrink: 0 }}>
            <path d="M13.5 8A5.5 5.5 0 1 1 8 2.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/>
            <path d="M8 1v3.5L10.5 2 8 1z" fill="currentColor"/>
          </svg>
          {refreshing ? (refreshProgress || "...") : "Árfolyam"}
        </button>

        <div style={{ width: 1, height: 20, background: "#21262D", flexShrink: 0 }} />

        {/* Icon-only buttons */}
        {[
          { icon: "📝", title: "Tranzakció napló", fn: onTxLog },
          { icon: "🤖", title: "AI elemzés",       fn: onAI },
          { icon: "🔁", title: "Árak nullázása",   fn: onResetPrices },
          { icon: "🪲", title: "Debug log",        fn: onLog },
        ].map(({ icon, title, fn }) => (
          <button key={title} title={title} style={{ ...btn("ghost"), padding: "5px 8px", fontSize: 15 }} onClick={fn}>
            {icon}
          </button>
        ))}
      </div>
    </header>
  );
}
