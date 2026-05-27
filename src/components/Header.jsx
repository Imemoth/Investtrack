import { useState, useEffect, useRef } from "react";

export function Header({
  activeTab, setActiveTab,
  displayCurrency, setDisplayCurrency,
  refreshing, refreshProgress,
  onRefresh, onResetPrices,
  onImport, onExport,
  onNewInvestment,
  onTxLog, onAI, onLog,
}) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const drawerRef = useRef(null);

  // Drawer bezárása külső kattintásra
  useEffect(() => {
    if (!drawerOpen) return;
    const handler = e => {
      if (drawerRef.current && !drawerRef.current.contains(e.target)) {
        setDrawerOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    document.addEventListener("touchstart", handler);
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("touchstart", handler);
    };
  }, [drawerOpen]);

  const iconBtn = (title, icon, onClick, active = false) => (
    <button key={title} title={title} onClick={() => { onClick(); setDrawerOpen(false); }} style={{
      background: active ? "#21262D" : "none",
      border: "1px solid #30363D", borderRadius: 8,
      padding: "8px 10px", cursor: "pointer", fontSize: 15,
      color: "#C9D1D9", fontFamily: "inherit", display: "flex",
      alignItems: "center", gap: 8,
    }}>
      <span>{icon}</span>
      <span style={{ fontSize: 13, fontWeight: 600, color: "#E6EDF3" }}>{title}</span>
    </button>
  );

  return (
    <>
      {/* ── Header bar ── */}
      <header style={{
        background: "#161B22", borderBottom: "1px solid #21262D",
        padding: "0 14px", position: "sticky", top: 0, zIndex: 40,
        display: "flex", alignItems: "center", gap: 10, height: 54,
      }}>
        {/* Hamburger */}
        <button onClick={() => setDrawerOpen(v => !v)} style={{
          background: drawerOpen ? "#21262D" : "none", border: "1px solid #30363D",
          borderRadius: 8, padding: "7px 9px", cursor: "pointer", color: "#C9D1D9",
          display: "flex", flexDirection: "column", gap: 4, flexShrink: 0,
        }}>
          {[0,1,2].map(i => (
            <span key={i} style={{
              display: "block", width: 16, height: 1.5, background: "#C9D1D9", borderRadius: 1,
              transition: "all .2s",
              transform: drawerOpen
                ? (i === 0 ? "rotate(45deg) translate(4px,4px)" : i === 2 ? "rotate(-45deg) translate(4px,-4px)" : "scaleX(0)")
                : "none",
            }} />
          ))}
        </button>

        {/* Logo */}
        <span style={{ fontWeight: 800, fontSize: 16, letterSpacing: "-0.03em", color: "#E6EDF3", flexShrink: 0 }}>
          Invest<span style={{ color: "#6EE7B7" }}>Track</span>
        </span>

        {/* Tab switcher – középre toljuk */}
        <div style={{ flex: 1, display: "flex", justifyContent: "center" }}>
          <div style={{ display: "flex", background: "#0D1117", borderRadius: 8, padding: 3, gap: 2 }}>
            {[["portfolio","📋 Portfólió"],["dashboard","📊 Dashboard"]].map(([tab, label]) => (
              <button key={tab} onClick={() => setActiveTab(tab)} style={{
                background: activeTab === tab ? "#21262D" : "none", border: "none", borderRadius: 6,
                padding: "5px 10px", cursor: "pointer", fontSize: 12,
                color: activeTab === tab ? "#E6EDF3" : "#8B949E",
                fontFamily: "inherit", fontWeight: 600,
              }}>{label}</button>
            ))}
          </div>
        </div>

        {/* Árfolyam frissítés – gyors elérés */}
        <button title="Árfolyam frissítése" onClick={onRefresh} disabled={refreshing} style={{
          background: "none", border: "1px solid #30363D", borderRadius: 8,
          padding: "7px 9px", cursor: refreshing ? "not-allowed" : "pointer",
          opacity: refreshing ? 0.6 : 1, color: "#C9D1D9", flexShrink: 0,
        }}>
          <svg width="14" height="14" fill="none" viewBox="0 0 16 16"
            style={{ animation: refreshing ? "spin 1s linear infinite" : "none", display: "block" }}>
            <path d="M13.5 8A5.5 5.5 0 1 1 8 2.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/>
            <path d="M8 1v3.5L10.5 2 8 1z" fill="currentColor"/>
          </svg>
        </button>

        {/* + Új befektetés */}
        <button onClick={onNewInvestment} style={{
          background: "linear-gradient(135deg,#238636,#2EA043)", border: "none",
          borderRadius: 8, padding: "7px 12px", cursor: "pointer",
          color: "#fff", fontSize: 13, fontWeight: 700, fontFamily: "inherit",
          display: "flex", alignItems: "center", gap: 5, flexShrink: 0,
        }}>
          <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
            <path d="M6 1v10M1 6h10" stroke="#fff" strokeWidth="2.2" strokeLinecap="round"/>
          </svg>
          Új
        </button>
      </header>

      {/* ── Backdrop ── */}
      {drawerOpen && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,.5)",
          zIndex: 44, backdropFilter: "blur(2px)",
        }} onClick={() => setDrawerOpen(false)} />
      )}

      {/* ── Slide-in drawer ── */}
      <div ref={drawerRef} style={{
        position: "fixed", top: 0, left: 0, bottom: 0, width: 270,
        background: "#161B22", borderRight: "1px solid #21262D",
        zIndex: 45, transform: drawerOpen ? "translateX(0)" : "translateX(-100%)",
        transition: "transform .25s cubic-bezier(.4,0,.2,1)",
        display: "flex", flexDirection: "column",
        boxShadow: drawerOpen ? "8px 0 32px rgba(0,0,0,.5)" : "none",
      }}>
        {/* Drawer header */}
        <div style={{ padding: "18px 20px 14px", borderBottom: "1px solid #21262D" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <span style={{ fontWeight: 800, fontSize: 17, letterSpacing: "-0.03em", color: "#E6EDF3" }}>
              Invest<span style={{ color: "#6EE7B7" }}>Track</span>
            </span>
            <button onClick={() => setDrawerOpen(false)} style={{ background: "none", border: "none", color: "#8B949E", cursor: "pointer", fontSize: 20 }}>×</button>
          </div>
          {/* Currency switcher */}
          <div style={{ display: "flex", background: "#0D1117", borderRadius: 8, padding: 3, gap: 2 }}>
            {["HUF","USD","EUR"].map(cur => (
              <button key={cur} onClick={() => setDisplayCurrency(cur)} style={{
                flex: 1, background: displayCurrency === cur ? "#21262D" : "none",
                border: "none", borderRadius: 6, padding: "5px 0",
                cursor: "pointer", fontSize: 12, fontWeight: 700,
                color: displayCurrency === cur ? "#E6EDF3" : "#8B949E",
                fontFamily: "'DM Mono',monospace",
              }}>{cur}</button>
            ))}
          </div>
        </div>

        {/* Menu items */}
        <div style={{ flex: 1, overflowY: "auto", padding: "12px 14px", display: "flex", flexDirection: "column", gap: 6 }}>

          <div style={{ fontSize: 10, color: "#8B949E", textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 700, padding: "4px 4px 8px" }}>
            Adatok
          </div>
          {iconBtn("Import CSV", "📥", onImport)}
          {iconBtn("Export CSV", "📤", onExport)}
          {iconBtn("Tranzakció napló", "📝", onTxLog)}

          <div style={{ height: 1, background: "#21262D", margin: "8px 0" }} />

          <div style={{ fontSize: 10, color: "#8B949E", textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 700, padding: "4px 4px 8px" }}>
            Árfolyam
          </div>
          <button onClick={() => { onRefresh(); setDrawerOpen(false); }} disabled={refreshing} style={{
            background: "none", border: "1px solid #30363D", borderRadius: 8,
            padding: "8px 10px", cursor: refreshing ? "not-allowed" : "pointer",
            opacity: refreshing ? 0.6 : 1, color: "#C9D1D9", fontFamily: "inherit",
            display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 600,
          }}>
            <svg width="14" height="14" fill="none" viewBox="0 0 16 16"
              style={{ animation: refreshing ? "spin 1s linear infinite" : "none", flexShrink: 0 }}>
              <path d="M13.5 8A5.5 5.5 0 1 1 8 2.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/>
              <path d="M8 1v3.5L10.5 2 8 1z" fill="currentColor"/>
            </svg>
            {refreshing ? (refreshProgress || "Frissítés...") : "Árfolyam frissítése"}
          </button>
          {iconBtn("Árak nullázása", "🔁", onResetPrices)}

          <div style={{ height: 1, background: "#21262D", margin: "8px 0" }} />

          <div style={{ fontSize: 10, color: "#8B949E", textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 700, padding: "4px 4px 8px" }}>
            Elemzés
          </div>
          {iconBtn("AI portfólió-elemzés", "🤖", onAI)}

          <div style={{ height: 1, background: "#21262D", margin: "8px 0" }} />

          <div style={{ fontSize: 10, color: "#8B949E", textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 700, padding: "4px 4px 8px" }}>
            Fejlesztő
          </div>
          {iconBtn("Debug log", "🪲", onLog)}
        </div>

        {/* Footer */}
        <div style={{ padding: "12px 20px", borderTop: "1px solid #21262D", fontSize: 11, color: "#8B949E" }}>
          InvestTrack · project-26h5o.vercel.app
        </div>
      </div>
    </>
  );
}
