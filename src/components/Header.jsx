import { useState, useEffect, useRef } from "react";
import { THEME as T, LIGHT_THEME, haptic } from "../design-system";
import { fmtNum } from "../utils";

export function Header({
  activeTab, setActiveTab,
  displayCurrency, setDisplayCurrency,
  refreshing, refreshProgress,
  onRefresh, onResetPrices,
  onImport, onExport,
  onNewInvestment,
  onTxLog, onAI, onLog,
  onPnL, onDCA, onTax, onMulti, onPush,
  onClearPortfolio,
  onSignOut, userEmail,
  isDark, onToggleTheme,
  fxRates,
}) {
  const theme = isDark ? T : LIGHT_THEME;
  const headerBg  = isDark ? "rgba(7,11,20,0.85)"  : "rgba(240,244,248,0.93)";
  const drawerBg  = isDark ? "rgba(7,11,20,0.97)"  : "rgba(240,244,248,0.99)";
  const backdropBg = isDark ? "rgba(0,0,0,0.6)"    : "rgba(0,0,0,0.35)";

  const [drawerOpen, setDrawerOpen] = useState(false);
  const drawerRef = useRef(null);

  useEffect(() => {
    if (!drawerOpen) return;
    const h = e => { if (drawerRef.current && !drawerRef.current.contains(e.target)) setDrawerOpen(false); };
    document.addEventListener("mousedown", h);
    document.addEventListener("touchstart", h);
    return () => { document.removeEventListener("mousedown", h); document.removeEventListener("touchstart", h); };
  }, [drawerOpen]);

  const close = fn => () => { fn(); setDrawerOpen(false); haptic("light"); };

  const MenuItem = ({ icon, label, onClick, color, badge }) => (
    <button onClick={close(onClick)} style={{
      background: "none", border: `1px solid ${theme.border.subtle}`, borderRadius: theme.radius.md,
      padding: "10px 14px", cursor: "pointer", color: color || theme.text.primary,
      fontFamily: "inherit", display: "flex", alignItems: "center", gap: 10,
      transition: theme.transition.fast, width: "100%", textAlign: "left",
    }}
      onMouseEnter={e => e.currentTarget.style.background = theme.bg.surface}
      onMouseLeave={e => e.currentTarget.style.background = "none"}
    >
      <span style={{ fontSize: 16, width: 22, textAlign: "center" }}>{icon}</span>
      <span style={{ fontSize: 13, fontWeight: 600, flex: 1 }}>{label}</span>
      {badge && <span style={{ fontSize: 10, background: "rgba(110,231,183,0.2)", color: theme.accent.green, borderRadius: 99, padding: "2px 7px", fontWeight: 700 }}>{badge}</span>}
    </button>
  );

  const Divider = ({ label }) => (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 0" }}>
      <div style={{ flex: 1, height: 1, background: theme.border.subtle }} />
      <span style={{ fontSize: 10, color: theme.text.tertiary, textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 700 }}>{label}</span>
      <div style={{ flex: 1, height: 1, background: theme.border.subtle }} />
    </div>
  );

  const hasFx = fxRates && (fxRates.USD > 1 || fxRates.EUR > 1);

  return (
    <>
      {/* ── Header bar ── */}
      <header style={{
        background: headerBg, borderBottom: `1px solid ${theme.border.subtle}`,
        backdropFilter: theme.blur.md, WebkitBackdropFilter: theme.blur.md,
        padding: "0 14px", position: "sticky", top: 0, zIndex: 40,
        display: "flex", alignItems: "center", gap: 10, height: 54,
      }}>
        {/* Hamburger */}
        <button onClick={() => { setDrawerOpen(v => !v); haptic("light"); }} style={{
          background: drawerOpen ? theme.bg.surface : "none",
          border: `1px solid ${drawerOpen ? theme.border.default : theme.border.subtle}`,
          borderRadius: theme.radius.md, padding: "8px 9px", cursor: "pointer",
          display: "flex", flexDirection: "column", gap: 4, flexShrink: 0,
          transition: theme.transition.fast,
        }}>
          {[0,1,2].map(i => (
            <span key={i} style={{
              display: "block", width: 16, height: 1.5, background: theme.text.secondary, borderRadius: 1,
              transition: "all 0.22s cubic-bezier(0.4,0,0.2,1)",
              transform: drawerOpen ? (i===0?"rotate(45deg) translate(4px,4px)":i===2?"rotate(-45deg) translate(4px,-4px)":"scaleX(0)") : "none",
              opacity: drawerOpen && i===1 ? 0 : 1,
            }} />
          ))}
        </button>

        {/* Logo */}
        <span style={{ fontWeight: 800, fontSize: 16, letterSpacing: "-0.03em", color: theme.text.primary, flexShrink: 0 }}>
          Invest<span style={{ color: theme.accent.green }}>Track</span>
        </span>

        {/* FX rates ticker – kattintásra frissít */}
        {hasFx && (
          <button onClick={() => { onRefreshFx?.(); haptic("light"); }} title="Devizaárfolyam frissítése" style={{
            display: "flex", gap: 8, flexShrink: 0, fontSize: 10, fontFamily: "'DM Mono',monospace",
            background: "none", border: "none", cursor: "pointer", padding: "4px 6px",
            borderRadius: theme.radius.sm, transition: theme.transition.fast,
          }}
            onMouseEnter={e => e.currentTarget.style.background = theme.bg.surface}
            onMouseLeave={e => e.currentTarget.style.background = "none"}
          >
            {fxRates.USD > 1 && (
              <span style={{ color: theme.text.tertiary }}>
                USD/<span style={{ color: theme.text.secondary, fontWeight: 700 }}>{Math.round(fxRates.USD)}</span>
              </span>
            )}
            {fxRates.EUR > 1 && (
              <span style={{ color: theme.text.tertiary }}>
                EUR/<span style={{ color: theme.text.secondary, fontWeight: 700 }}>{Math.round(fxRates.EUR)}</span>
              </span>
            )}
            {fxRates.EUR > 1 && fxRates.USD > 1 && (
              <span style={{ color: theme.text.tertiary }}>
                EUR/USD <span style={{ color: theme.text.secondary, fontWeight: 700 }}>{fmtNum(fxRates.EUR / fxRates.USD, 3)}</span>
              </span>
            )}
          </button>
        )}

        {/* Tab switcher */}
        <div style={{ flex: 1, display: "flex", justifyContent: "center" }}>
          <div style={{ display: "flex", background: isDark ? "rgba(0,0,0,0.3)" : "rgba(0,0,0,0.06)", borderRadius: theme.radius.md, padding: 3, gap: 2, border: `1px solid ${theme.border.subtle}` }}>
            {[["portfolio","📋 Portfólió"],["dashboard","📊 Dashboard"]].map(([tab, label]) => (
              <button key={tab} onClick={() => { setActiveTab(tab); haptic("light"); }} style={{
                background: activeTab === tab ? theme.bg.overlay : "none", border: "none",
                borderRadius: theme.radius.sm, padding: "5px 10px", cursor: "pointer", fontSize: 12,
                color: activeTab === tab ? theme.text.primary : theme.text.secondary,
                fontFamily: "inherit", fontWeight: 600, transition: theme.transition.fast,
                boxShadow: activeTab === tab ? `0 1px 0 ${theme.border.default} inset` : "none",
              }}>{label}</button>
            ))}
          </div>
        </div>

        {/* + Új */}
        <button onClick={() => { onNewInvestment(); haptic("medium"); }} style={{
          background: theme.gradient.primary, border: "none", borderRadius: theme.radius.md,
          padding: "7px 13px", cursor: "pointer", color: "#fff",
          fontSize: 13, fontWeight: 700, fontFamily: "inherit",
          display: "flex", alignItems: "center", gap: 5, flexShrink: 0,
          boxShadow: "0 2px 12px rgba(46,160,67,0.4)", transition: theme.transition.fast,
        }}>
          <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
            <path d="M6 1v10M1 6h10" stroke="#fff" strokeWidth="2.2" strokeLinecap="round"/>
          </svg>
          Új
        </button>
      </header>

      {/* ── Backdrop ── */}
      {drawerOpen && (
        <div style={{ position: "fixed", inset: 0, background: backdropBg, zIndex: 44, backdropFilter: "blur(4px)", animation: "fadeIn 0.2s ease" }}
          onClick={() => setDrawerOpen(false)} />
      )}

      {/* ── Slide-in drawer ── */}
      <div ref={drawerRef} style={{
        position: "fixed", top: 0, left: 0, bottom: 0, width: 280,
        background: drawerBg,
        borderRight: `1px solid ${theme.border.default}`,
        backdropFilter: theme.blur.lg, WebkitBackdropFilter: theme.blur.lg,
        zIndex: 45, transform: drawerOpen ? "translateX(0)" : "translateX(-100%)",
        transition: "transform 0.28s cubic-bezier(0.4,0,0.2,1)",
        display: "flex", flexDirection: "column",
        boxShadow: drawerOpen ? "12px 0 48px rgba(0,0,0,0.4)" : "none",
      }}>
        {/* Drawer header */}
        <div style={{ padding: "18px 18px 14px", borderBottom: `1px solid ${theme.border.subtle}` }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <span style={{ fontWeight: 800, fontSize: 17, color: theme.text.primary }}>
              Invest<span style={{ color: theme.accent.green }}>Track</span>
            </span>
            <div style={{ display: "flex", gap: 8 }}>
              {/* Dark/Light toggle */}
              <button onClick={() => { onToggleTheme(); haptic("light"); }} title="Téma váltás" style={{
                background: theme.bg.surface, border: `1px solid ${theme.border.subtle}`,
                borderRadius: theme.radius.full, width: 30, height: 30,
                display: "flex", alignItems: "center", justifyContent: "center",
                cursor: "pointer", fontSize: 14,
              }}>{isDark ? "☀️" : "🌙"}</button>
              <button onClick={() => setDrawerOpen(false)} style={{ background: "none", border: "none", color: theme.text.secondary, cursor: "pointer", fontSize: 20 }}>×</button>
            </div>
          </div>
          {/* Currency switcher */}
          <div style={{ display: "flex", background: isDark ? "rgba(0,0,0,0.3)" : "rgba(0,0,0,0.06)", borderRadius: theme.radius.md, padding: 3, gap: 2 }}>
            {["HUF","USD","EUR"].map(cur => (
              <button key={cur} onClick={() => { setDisplayCurrency(cur); haptic("light"); }} style={{
                flex: 1, background: displayCurrency === cur ? theme.bg.overlay : "none",
                border: "none", borderRadius: theme.radius.sm, padding: "5px 0",
                cursor: "pointer", fontSize: 12, fontWeight: 700,
                color: displayCurrency === cur ? theme.text.primary : theme.text.secondary,
                fontFamily: "'DM Mono',monospace", transition: theme.transition.fast,
              }}>{cur}</button>
            ))}
          </div>

          {/* FX rates in drawer */}
          {hasFx && (
            <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
              {[
                fxRates.USD > 1 && { label: "USD/HUF", val: Math.round(fxRates.USD) },
                fxRates.EUR > 1 && { label: "EUR/HUF", val: Math.round(fxRates.EUR) },
                fxRates.EUR > 1 && fxRates.USD > 1 && { label: "EUR/USD", val: fmtNum(fxRates.EUR / fxRates.USD, 3) },
              ].filter(Boolean).map(({ label, val }) => (
                <div key={label} style={{ background: theme.bg.inset, border: `1px solid ${theme.border.subtle}`, borderRadius: theme.radius.sm, padding: "4px 8px" }}>
                  <span style={{ fontSize: 9, color: theme.text.tertiary, fontFamily: "'DM Mono',monospace" }}>{label} </span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: theme.text.secondary, fontFamily: "'DM Mono',monospace" }}>{val}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Menu items */}
        <div style={{ flex: 1, overflowY: "auto", padding: "12px 12px", display: "flex", flexDirection: "column", gap: 5 }}>
          <Divider label="Adatok" />
          <MenuItem icon="📥" label="Import CSV"         onClick={onImport} />
          <MenuItem icon="📤" label="Export CSV"         onClick={onExport} />
          <MenuItem icon="📝" label="Tranzakció napló"   onClick={onTxLog} />
          <MenuItem icon="🌐" label="Multi-portfólió"    onClick={onMulti} badge="Új" />

          <Divider label="Elemzés" />
          <MenuItem icon="📅" label="P&L Összesítő"      onClick={onPnL} />
          <MenuItem icon="📆" label="DCA Kalkulátor"     onClick={onDCA} />
          <MenuItem icon="🧾" label="Adó Kalkulátor"     onClick={onTax} badge="HU" />
          <MenuItem icon="🤖" label="AI Elemzés"         onClick={onAI} />

          <Divider label="Árfolyam" />
          <button onClick={close(onRefresh)} disabled={refreshing} style={{
            background: "none", border: `1px solid ${theme.border.subtle}`, borderRadius: theme.radius.md,
            padding: "10px 14px", cursor: refreshing ? "not-allowed" : "pointer",
            opacity: refreshing ? 0.5 : 1, color: theme.text.primary, fontFamily: "inherit",
            display: "flex", alignItems: "center", gap: 10, transition: theme.transition.fast,
          }}>
            <svg width="14" height="14" fill="none" viewBox="0 0 16 16" style={{ animation: refreshing ? "spin 1s linear infinite" : "none", flexShrink: 0 }}>
              <path d="M13.5 8A5.5 5.5 0 1 1 8 2.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/>
              <path d="M8 1v3.5L10.5 2 8 1z" fill="currentColor"/>
            </svg>
            <span style={{ fontSize: 13, fontWeight: 600 }}>{refreshing ? (refreshProgress || "Frissítés...") : "Árfolyam frissítése"}</span>
          </button>
          <MenuItem icon="💱" label="Deviza frissítése"    onClick={onRefreshFx} />
          <MenuItem icon="🔔" label="Push értesítések"   onClick={onPush} />
          <MenuItem icon="🔁" label="Árak nullázása"     onClick={onResetPrices} />

          <Divider label="Veszélyzóna" />
          <MenuItem icon="🗑️" label="Portfólió törlése"  onClick={onClearPortfolio} color={theme.accent.red} />
          {onSignOut && (
            <>
              <Divider label="Fiók" />
              {userEmail && <div style={{ fontSize:11, color:theme.text.tertiary, padding:"4px 2px" }}>👤 {userEmail}</div>}
              <MenuItem icon="🚪" label="Kijelentkezés" onClick={close(onSignOut)} color={theme.text.tertiary} />
            </>
          )}

          <Divider label="Fejlesztő" />
          <MenuItem icon="🪲" label="Debug log"          onClick={onLog} />
        </div>

        {/* Footer */}
        <div style={{ padding: "12px 18px", borderTop: `1px solid ${theme.border.subtle}`, fontSize: 11, color: theme.text.tertiary }}>
          InvestTrack · v2.0 · project-26h5o.vercel.app
        </div>
      </div>
    </>
  );
}
