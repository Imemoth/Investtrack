import { useState, useCallback, useMemo, useEffect } from "react";

import { STORAGE_KEY, CATEGORIES, CATEGORY_COLORS, POSITION_PALETTE } from "./constants";
import { fmtNum, fmtCurrency, calcPnL, calcAvgBuyPrice, calcTotalQty, exportCSV, parseCSV, migrateAll } from "./utils";
import { refreshAllPrices } from "./services/priceService";
import { THEME as T, LIGHT_THEME, glassCard, haptic, KEYFRAMES } from "./design-system";

import { DonutChart, Sparkline, Modal, Toast, LogModal } from "./components/ui";
import { Header } from "./components/Header";
import { InvestmentForm } from "./components/InvestmentForm";
import { DetailModal } from "./components/DetailModal";
import { BubbleChart } from "./components/BubbleChart";
import { TopMovers, CurrencyExposure, BenchmarkChart, RiskReturn } from "./components/DashboardWidgets";
import { TransactionLog, addTransaction } from "./components/TransactionLog";
import { AIAnalysis } from "./components/AIAnalysis";
import { FeatureModal } from "./components/FeatureModals";
import { SellModal } from "./components/SellModal";

// ─── APP ──────────────────────────────────────────────────────────────────────
export default function App() {
  // ── State ──
  const [investments,     setInvestments]     = useState(() => {
    try {
      // v1 → v2 migráció betöltéskor
      const raw = JSON.parse(localStorage.getItem("investtrack_v2") || localStorage.getItem("investtrack_v1") || "[]");
      return migrateAll(raw);
    } catch { return []; }
  });
  const [sellInv,         setSellInv]         = useState(null);
  const [modal,           setModal]           = useState(null);
  const [editing,         setEditing]         = useState(null);
  const [search,          setSearch]          = useState("");
  const [filterCat,       setFilterCat]       = useState("Összes");
  const [sortBy,          setSortBy]          = useState("name");
  const [sortDir,         setSortDir]         = useState("asc");
  const [toast,           setToast]           = useState(null);
  const [importText,      setImportText]      = useState("");
  const [confirmDelete,   setConfirmDelete]   = useState(null);
  const [refreshing,      setRefreshing]      = useState(false);
  const [refreshProgress, setRefreshProgress] = useState(null);
  const [showLog,         setShowLog]         = useState(false);
  const [chartMode,       setChartMode]       = useState("category");
  const [detailInv,       setDetailInv]       = useState(null);
  const [activeTab,       setActiveTab]       = useState("portfolio");
  const [displayCurrency, setDisplayCurrency] = useState("HUF");
  const [showTxLog,       setShowTxLog]       = useState(false);
  const [showAI,          setShowAI]          = useState(false);
  const [featureModal,    setFeatureModal]    = useState(null);
  const [isDark,          setIsDark]          = useState(() => localStorage.getItem("investtrack_theme") !== "light");
  const [lastRefreshed,   setLastRefreshed]   = useState(() => {
    const saved = localStorage.getItem("investtrack_last_refresh");
    return saved ? new Date(saved) : null;
  });

  const theme = isDark ? T : LIGHT_THEME;
  const toggleTheme = () => {
    setIsDark(v => { localStorage.setItem("investtrack_theme", v ? "light" : "dark"); return !v; });
  };

  // ── Dynamic styles based on theme ──
  const S = {
    app:      { minHeight: "100vh", background: isDark ? "#070B14" : "#F0F4F8", color: theme.text.primary, fontFamily: "'DM Sans', 'Segoe UI', sans-serif" },
    main:     { maxWidth: 1280, margin: "0 auto", padding: "16px 12px 80px" },
    card:     glassCard(theme, { padding: 16 }),
    statCard: glassCard(theme, { padding: 16 }),
    btn: (v) => ({
      background: v === "primary" ? theme.gradient.primary : v === "ghost" ? "none" : theme.bg.surface,
      border: v === "ghost" ? `1px solid ${theme.border.default}` : "none",
      borderRadius: theme.radius.md, padding: "9px 14px",
      color: v === "primary" ? "#fff" : theme.text.secondary,
      cursor: "pointer", fontSize: 13, fontWeight: 600,
      fontFamily: "inherit", display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap",
      transition: theme.transition.fast,
    }),
    th: { padding: "10px 12px", textAlign: "left", fontSize: 11, color: theme.text.secondary, textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700, cursor: "pointer", userSelect: "none", whiteSpace: "nowrap" },
    td: { padding: "12px", fontSize: 13, borderBottom: `1px solid ${theme.border.subtle}` },
  };

  const isMobile = window.innerWidth < 700;

  // ── Persistence ──
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(investments));
  }, [investments]);

  // ── Toast ──
  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  // ── Price refresh ──
  const handleRefresh = async () => {
    if (refreshing) return;
    const withTicker = investments.filter(i => i.ticker?.trim());
    if (!withTicker.length) { showToast("Nincs ticker!", "error"); return; }
    setRefreshing(true);
    setRefreshProgress("Csatlakozás...");
    try {
      const { results, errors } = await refreshAllPrices(investments, setRefreshProgress);
      if (!results.size) { showToast("❌ Minden lekérés sikertelen!", "error"); return; }
      setInvestments(prev => {
        const updated = prev.map(inv => {
          const hit = results.get(inv.ticker?.toUpperCase());
          if (!hit) return inv;
          const newPrice = inv.currency === "HUF" ? hit.hufPrice : hit.nativePrice;
          return { ...inv, currentPrice: newPrice, _nativePrice: hit.nativePrice, _nativeCurrency: hit.nativeCurrency };
        });
        // Célár riasztás
        updated.forEach(inv => {
          if (!inv.targetPrice || !inv.currentPrice) return;
          const target   = +inv.targetPrice;
          const prevInv  = prev.find(p => p.id === inv.id);
          const wasBelow = (prevInv?.currentPrice ?? 0) < target;
          const nowAbove = inv.currentPrice >= target;
          if (wasBelow && nowAbove) showToast(`🎯 ${inv.name} elérte a célárat!`, "success");
        });
        return updated;
      });
      const ok = results.size, fail = errors.length;
      const now = new Date();
      setLastRefreshed(now);
      localStorage.setItem("investtrack_last_refresh", now.toISOString());
      showToast(fail > 0 ? `⚠️ ${ok} frissítve, ${fail} sikertelen: ${errors.join(", ")}` : `✓ ${ok} árfolyam frissítve!`, fail > 0 ? "info" : "success");
    } catch (e) {
      showToast(`❌ ${e.message}`, "error");
    } finally {
      setRefreshing(false);
      setRefreshProgress(null);
    }
  };

  const handleResetPrices = () => {
    setInvestments(prev => prev.map(inv => ({ ...inv, currentPrice: 0 })));
    showToast("Árak nullázva – nyomj Árfolyam frissítésre!", "info");
  };

  const handleSell = ({ updatedInv, sale, fullyClose }) => {
    setInvestments(prev => {
      if (fullyClose) return prev.filter(i => i.id !== updatedInv.id);
      return prev.map(i => i.id === updatedInv.id ? updatedInv : i);
    });
    setSellInv(null);
    addTransaction({ ...updatedInv, ...sale }, "sell");
    const pnlStr = (sale.realizedPnL >= 0 ? "+" : "") + fmtNum(sale.realizedPnL, 0) + " " + sale.currency;
    showToast(`Eladás rögzítve! Realizált P&L: ${pnlStr}`, sale.realizedPnL >= 0 ? "success" : "info");
  };

  // ── CRUD ──
  const saveInvestment = useCallback(inv => {
    setInvestments(prev => {
      const idx = prev.findIndex(i => i.id === inv.id);
      if (idx >= 0) {
        addTransaction(inv, "edit");
        const next = [...prev]; next[idx] = inv; return next;
      }
      addTransaction(inv, "buy");
      return [...prev, inv];
    });
    setModal(null); setEditing(null);
    showToast(editing ? "Befektetés frissítve!" : "Befektetés hozzáadva!");
  }, [editing]);

  const doDelete = id => {
    const inv = investments.find(i => i.id === id);
    if (inv) addTransaction(inv, "sell");
    setInvestments(prev => prev.filter(i => i.id !== id));
    setConfirmDelete(null);
    showToast("Befektetés törölve.", "info");
  };

  // ── Import ──
  const handleImport = () => {
    try {
      const parsed = parseCSV(importText);
      if (!parsed.length) throw new Error("Nem találtam adatsort");
      setInvestments(prev => [...prev, ...parsed]);
      setModal(null); setImportText("");
      showToast(`${parsed.length} befektetés importálva!`);
    } catch (e) { showToast("Import hiba: " + e.message, "error"); }
  };

  const handleFileImport = e => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => setImportText(ev.target.result);
    reader.readAsText(file, "UTF-8");
    e.target.value = "";
  };

  // ── Stats ──
  const stats = useMemo(() => {
    const totalCost  = investments.reduce((s, i) => s + i.buyPrice * i.quantity, 0);
    const totalValue = investments.reduce((s, i) => s + i.currentPrice * i.quantity, 0);
    const totalPnL   = totalValue - totalCost;
    const totalPct   = totalCost > 0 ? (totalPnL / totalCost) * 100 : 0;

    const catBreakdown = CATEGORIES
      .map(c => {
        const v = investments.filter(i => i.category === c).reduce((s, i) => s + i.currentPrice * i.quantity, 0);
        return { label: c, value: v, pct: totalValue > 0 ? (v / totalValue) * 100 : 0, color: CATEGORY_COLORS[c] };
      })
      .filter(d => d.value > 0);

    const posBreakdown = [...investments]
      .map((inv, idx) => {
        const v = inv.currentPrice * inv.quantity;
        return { label: inv.ticker || inv.name, fullName: inv.name, value: v, pct: totalValue > 0 ? (v / totalValue) * 100 : 0, color: POSITION_PALETTE[idx % POSITION_PALETTE.length] };
      })
      .filter(d => d.value > 0)
      .sort((a, b) => b.value - a.value);

    const totalRealizedPnL = investments.reduce((s, i) => s + (i.realizedPnL || 0), 0);
    const totalDividend = investments.reduce((s, i) => {
      if (!i.dividendYield || !i.currentPrice) return s;
      return s + (parseFloat(i.dividendYield) / 100) * i.currentPrice * i.quantity;
    }, 0);

    return { totalCost, totalValue, totalPnL, totalPct, catBreakdown, posBreakdown, totalDividend, totalRealizedPnL };
  }, [investments]);

  // ── Filtered & sorted list ──
  const displayed = useMemo(() => {
    const q    = search.toLowerCase();
    let list   = investments.filter(i =>
      (!q || i.name.toLowerCase().includes(q) || i.ticker.toLowerCase().includes(q)) &&
      (filterCat === "Összes" || i.category === filterCat)
    );
    return [...list].sort((a, b) => {
      let va, vb;
      if      (sortBy === "name")  { va = a.name;                      vb = b.name; }
      else if (sortBy === "value") { va = a.currentPrice * a.quantity;  vb = b.currentPrice * b.quantity; }
      else if (sortBy === "pnl")   { va = calcPnL(a).pct;              vb = calcPnL(b).pct; }
      else if (sortBy === "date")  { va = a.buyDate;                    vb = b.buyDate; }
      else                         { va = a[sortBy];                    vb = b[sortBy]; }
      return (va < vb ? -1 : va > vb ? 1 : 0) * (sortDir === "asc" ? 1 : -1);
    });
  }, [investments, search, filterCat, sortBy, sortDir]);

  const toggleSort = col => {
    if (sortBy === col) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortBy(col); setSortDir("asc"); }
  };
  const SortArrow = ({ col }) => sortBy === col ? (sortDir === "asc" ? " ↑" : " ↓") : " ↕";

  // Utolsó frissítés formázása – újraszámol percenként
  const [, forceUpdate] = useState(0);
  useEffect(() => {
    const id = setInterval(() => forceUpdate(v => v + 1), 60000);
    return () => clearInterval(id);
  }, []);
  const refreshLabel = useMemo(() => {
    if (!lastRefreshed) return null;
    const diff = Math.floor((Date.now() - lastRefreshed) / 1000);
    if (diff < 60)    return "most frissült";
    if (diff < 3600)  return `${Math.floor(diff / 60)} perce`;
    if (diff < 86400) return lastRefreshed.toLocaleTimeString("hu-HU", { hour: "2-digit", minute: "2-digit" }) + "-kor";
    return lastRefreshed.toLocaleDateString("hu-HU", { month: "short", day: "numeric" }) + " " +
           lastRefreshed.toLocaleTimeString("hu-HU", { hour: "2-digit", minute: "2-digit" });
  }, [lastRefreshed, forceUpdate]);

  // ── Render ──
  return (
    <div style={S.app}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet" />

      <Header
        activeTab={activeTab}           setActiveTab={setActiveTab}
        displayCurrency={displayCurrency} setDisplayCurrency={setDisplayCurrency}
        refreshing={refreshing}         refreshProgress={refreshProgress}
        onRefresh={handleRefresh}       onResetPrices={handleResetPrices}
        onImport={() => setModal("import")} onExport={() => exportCSV(investments)}
        onNewInvestment={() => { setEditing(null); setModal("add"); haptic("medium"); }}
        onTxLog={() => setShowTxLog(true)}
        onAI={() => setShowAI(true)}
        onLog={() => setShowLog(true)}
        onPnL={() => setFeatureModal("pnl")}
        onDCA={() => setFeatureModal("dca")}
        onTax={() => setFeatureModal("tax")}
        onMulti={() => setFeatureModal("multi")}
        onPush={() => setFeatureModal("push")}
        isDark={isDark}
        onToggleTheme={toggleTheme}
      />

      <main style={S.main}>

        {/* ── DASHBOARD TAB ── */}
        {activeTab === "dashboard" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {/* Stat cards – 2x2 */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              {[
                { label: "Portfólió értéke",    val: fmtCurrency(stats.totalValue, "HUF"), sub: `${investments.length} pozíció`, color: theme.text.primary },
                { label: "Befektetett tőke",    val: fmtCurrency(stats.totalCost,  "HUF"), sub: "Összes vételár",                color: theme.text.secondary },
                { label: "Nyereség / Veszteség",val: (stats.totalPnL >= 0 ? "+" : "") + fmtCurrency(stats.totalPnL, "HUF"),
                                                 sub: `${stats.totalPnL >= 0 ? "+" : ""}${fmtNum(stats.totalPct, 2)}%`,
                                                 color: stats.totalPnL >= 0 ? theme.accent.green : theme.accent.red },
                { label: "💰 Éves osztalék",    val: stats.totalDividend > 0 ? fmtCurrency(stats.totalDividend, "HUF") : "—",
                                                 sub: "becsült bruttó",  color: theme.accent.yellow },
              ].map((s, i) => (
                <div key={i} style={S.statCard}>
                  <div style={{ fontSize: 10, color: theme.text.tertiary, textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 700, marginBottom: 6 }}>{s.label}</div>
                  <div style={{ fontSize: 17, fontWeight: 800, color: s.color, letterSpacing: "-0.02em", lineHeight: 1.2, wordBreak: "break-all" }}>{s.val}</div>
                  <div style={{ fontSize: 11, color: theme.text.tertiary, marginTop: 4 }}>{s.sub}</div>
                </div>
              ))}
            </div>
            <TopMovers investments={investments} />
            <CurrencyExposure investments={investments} />
            <BenchmarkChart investments={investments} />
            <RiskReturn investments={investments} />
          </div>
        )}

        {/* ── PORTFOLIO TAB ── */}
        {activeTab === "portfolio" && (<>
        {/* ── Stat cards ── */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
          {[
            { label: "Portfólió értéke",    val: fmtCurrency(stats.totalValue, "HUF"),  sub: `${investments.length} pozíció`,   color: theme.text.primary,  glow: null },
            { label: "Befektetett tőke",    val: fmtCurrency(stats.totalCost,  "HUF"),  sub: "Összes vételár",                   color: theme.text.secondary,glow: null },
            { label: "Papír nyereség",    val: (stats.totalPnL >= 0 ? "+" : "") + fmtCurrency(stats.totalPnL, "HUF"),
                                             sub: `${stats.totalPnL >= 0 ? "+" : ""}${fmtNum(stats.totalPct, 2)}%`,
                                             color: stats.totalPnL >= 0 ? theme.accent.green : theme.accent.red,
                                             glow: stats.totalPnL >= 0 ? "rgba(110,231,183,0.12)" : "rgba(252,165,165,0.12)" },
            { label: "💰 Realizált P&L",  val: stats.totalRealizedPnL !== 0 ? (stats.totalRealizedPnL >= 0 ? "+" : "") + fmtCurrency(stats.totalRealizedPnL, "HUF") : "—",
                                             sub: "lezárt pozíciókból", color: stats.totalRealizedPnL >= 0 ? theme.accent.green : theme.accent.red, glow: null },
          ].map((s, i) => (
            <div key={i} style={{ ...S.statCard, background: s.glow || theme.bg.surface, animation: `slideUp 0.3s ease ${i * 0.05}s both` }}>
              <div style={{ fontSize: 10, color: theme.text.tertiary, textTransform: "uppercase", letterSpacing: "0.07em", fontWeight: 700, marginBottom: 6 }}>{s.label}</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: s.color, letterSpacing: "-0.02em", lineHeight: 1.2, wordBreak: "break-all" }}>{s.val}</div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 4 }}>
                <span style={{ fontSize: 11, color: theme.text.tertiary }}>{s.sub}</span>
                {i === 0 && refreshLabel && (
                  <span style={{ fontSize: 10, color: theme.text.tertiary, display: "flex", alignItems: "center", gap: 3 }}>
                    🕐 {refreshLabel}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* ── Chart ── */}
        {(stats.catBreakdown.length > 0 || stats.posBreakdown.length > 0) && (() => {
          const activeData = chartMode === "category" ? stats.catBreakdown : stats.posBreakdown;
          return (
            <div style={{ ...S.card, marginBottom: 16, padding: chartMode === "position" ? "14px 14px 0" : 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                <span style={{ fontSize: 11, color: "#8B949E", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700 }}>
                  {chartMode === "category" ? "Eszközosztályok" : "Pozíciók súlya"}
                </span>
                <div style={{ display: "flex", background: "#0D1117", borderRadius: 8, padding: 3, gap: 2 }}>
                  {[["category", "🗂 Kategória"], ["position", "🫧 Pozíció"]].map(([mode, label]) => (
                    <button key={mode} onClick={() => setChartMode(mode)} style={{
                      background: chartMode === mode ? "#21262D" : "none", border: "none", borderRadius: 6,
                      padding: "5px 10px", color: chartMode === mode ? "#E6EDF3" : "#8B949E",
                      cursor: "pointer", fontSize: 11, fontWeight: 600, fontFamily: "inherit",
                    }}>{label}</button>
                  ))}
                </div>
              </div>

              {chartMode === "category" ? (
                <div style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
                  <div style={{ flexShrink: 0, cursor: "pointer", position: "relative" }}
                    onClick={() => setChartMode("position")}>
                    <DonutChart data={activeData} size={130} />
                    <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", fontSize: 18, pointerEvents: "none" }}>🗂</div>
                  </div>
                  <div style={{ flex: 1, minWidth: 150, maxHeight: 200, overflowY: "auto" }}>
                    {activeData.map(d => (
                      <div key={d.label} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                        <div style={{ width: 8, height: 8, borderRadius: "50%", background: d.color, flexShrink: 0 }} />
                        <div style={{ flex: 1, fontSize: 12, color: "#C9D1D9", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={d.fullName || d.label}>{d.label}</div>
                        <div style={{ fontSize: 12, color: "#8B949E", flexShrink: 0, fontFamily: "'DM Mono', monospace" }}>{fmtNum(d.pct, 1)}%</div>
                        <div style={{ width: 48, background: "#21262D", borderRadius: 4, height: 3, flexShrink: 0 }}>
                          <div style={{ width: `${Math.min(d.pct, 100)}%`, background: d.color, borderRadius: 4, height: 3 }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <BubbleChart
                  data={stats.posBreakdown}
                  onSelect={item => setDetailInv(investments.find(i => (i.ticker || i.name) === item.label))}
                />
              )}
            </div>
          );
        })()}

        {/* ── Search + filters ── */}
        <div style={{ marginBottom: 12 }}>
          <input
            style={{ background: "#161B22", border: "1px solid #30363D", borderRadius: 8, padding: "9px 14px", color: "#E6EDF3", fontSize: 14, fontFamily: "inherit", outline: "none", width: "100%", boxSizing: "border-box", marginBottom: 10 }}
            placeholder="🔍  Keresés..." value={search} onChange={e => setSearch(e.target.value)}
          />
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {["Összes", ...CATEGORIES].map(c => (
              <button key={c} style={{ ...S.btn(filterCat === c ? "primary" : "ghost"), padding: "5px 10px", fontSize: 11 }} onClick={() => setFilterCat(c)}>{c}</button>
            ))}
          </div>
        </div>

        {/* ── List ── */}
        {investments.length === 0 ? (
          <div style={{ ...S.card, textAlign: "center", padding: "40px 20px" }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#E6EDF3", marginBottom: 8 }}>Még nincs befektetés</div>
            <div style={{ fontSize: 13, color: "#8B949E", marginBottom: 20 }}>Add hozzá az első pozíciódat, vagy importálj CSV fájlt.</div>
            <button style={{ ...S.btn("primary"), margin: "0 auto" }} onClick={() => setModal("add")}>+ Hozzáadás</button>
          </div>
        ) : isMobile ? (
          // ── Mobile cards ──
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {/* Utolsó frissítés banner */}
            {refreshLabel && (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "6px 12px", background: theme.bg.surface, border: `1px solid ${theme.border.subtle}`, borderRadius: theme.radius.md, fontSize: 11, color: theme.text.tertiary }}>
                🕐 Árfolyamok: <span style={{ color: theme.text.secondary, fontWeight: 600 }}>{refreshLabel}</span>
                <span style={{ color: theme.text.tertiary }}>· ~15 perces késleltetés</span>
              </div>
            )}
            {displayed.map(inv => {
              const { value, abs, pct } = calcPnL(inv);
              const up = abs >= 0;
              return (
                <div key={inv.id} style={{ ...glassCard(theme, { padding: "14px 16px" }), cursor: "pointer", transition: theme.transition.fast }}
                  onClick={() => setDetailInv(inv)}
                  onMouseEnter={e => e.currentTarget.style.background = theme.bg.raised}
                  onMouseLeave={e => e.currentTarget.style.background = theme.bg.surface}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{ width: 38, height: 38, borderRadius: 10, background: CATEGORY_COLORS[inv.category] + "20", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, border: `1px solid ${CATEGORY_COLORS[inv.category]}30` }}>
                        <span style={{ fontSize: 11, fontWeight: 800, color: CATEGORY_COLORS[inv.category], fontFamily: "'DM Mono', monospace" }}>{(inv.ticker || inv.name).slice(0, 4).toUpperCase()}</span>
                      </div>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 14, color: theme.text.primary }}>{inv.name}</div>
                        <div style={{ fontSize: 11, color: theme.text.tertiary, fontFamily: "'DM Mono', monospace" }}>{inv.ticker} · {inv.currency}</div>
                      </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontWeight: 700, fontSize: 15, color: theme.text.primary, fontFamily: "'DM Mono', monospace" }}>{fmtNum(value, 0)}</div>
                      <div style={{ fontSize: 12, color: up ? theme.accent.green : theme.accent.red, fontFamily: "'DM Mono', monospace", fontWeight: 700 }}>{up ? "+" : ""}{fmtNum(pct, 2)}%</div>
                    </div>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, borderTop: `1px solid ${theme.border.subtle}`, paddingTop: 10 }}>
                    {[["Vételár", fmtNum(inv.buyPrice, 0)], ["Mennyiség", fmtNum(inv.quantity, inv.quantity % 1 === 0 ? 0 : 4)], ["P&L", (up ? "+" : "") + fmtNum(abs, 0)]].map(([l, v], i) => (
                      <div key={i}>
                        <div style={{ fontSize: 10, color: "#8B949E", textTransform: "uppercase", marginBottom: 2 }}>{l}</div>
                        <div style={{ fontSize: 12, fontFamily: "'DM Mono', monospace", color: i === 2 ? (up ? "#6EE7B7" : "#FCA5A5") : "#C9D1D9" }}>{v}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 10 }} onClick={e => e.stopPropagation()}>
                    <button onClick={() => setSellInv(inv)}
                      style={{ background: "rgba(252,165,165,0.1)", border: `1px solid rgba(252,165,165,0.3)`, borderRadius: theme.radius.md, padding: "6px 12px", color: theme.accent.red, cursor: "pointer", fontSize: 12, fontFamily: "inherit", fontWeight: 600 }}>📤 Eladás</button>
                    <button onClick={() => { setEditing(inv); setModal("edit"); }}
                      style={{ background: theme.bg.surface, border: `1px solid ${theme.border.default}`, borderRadius: theme.radius.md, padding: "6px 12px", color: theme.text.secondary, cursor: "pointer", fontSize: 12, fontFamily: "inherit" }}>✏️</button>
                    <button onClick={() => setConfirmDelete(inv)}
                      style={{ background: "none", border: `1px solid rgba(252,165,165,0.2)`, borderRadius: theme.radius.md, padding: "6px 10px", color: theme.accent.red, cursor: "pointer", fontSize: 12, fontFamily: "inherit" }}>🗑️</button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          // ── Desktop table ──
          <div style={{ ...S.card, padding: 0, overflow: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
              <thead>
                <tr style={{ borderBottom: "1px solid #21262D" }}>
                  {[["name","Megnevezés"],["category","Kategória"]].map(([col, label]) => (
                    <th key={col} style={S.th} onClick={() => toggleSort(col)}>{label}<SortArrow col={col} /></th>
                  ))}
                  {[["value","Piaci érték"],["buyPrice","Átlagár"],["quantity","Db"],["pnl","P&L"],["date","Vétel"]].map(([col, label]) => (
                    <th key={col} style={{ ...S.th, textAlign: "right" }} onClick={() => toggleSort(col)}>{label}<SortArrow col={col} /></th>
                  ))}
                  <th style={S.th} />
                </tr>
              </thead>
              <tbody>
                {displayed.map(inv => {
                  const { value, abs, pct } = calcPnL(inv);
                  const up = abs >= 0;
                  return (
                    <tr key={inv.id} style={{ cursor: "pointer", transition: "background .1s" }}
                      onClick={() => setDetailInv(inv)}
                      onMouseEnter={e => e.currentTarget.style.background = "#1C2128"}
                      onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                      <td style={S.td}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <div style={{ width: 34, height: 34, borderRadius: 8, background: CATEGORY_COLORS[inv.category] + "20", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                            <span style={{ fontSize: 11, fontWeight: 800, color: CATEGORY_COLORS[inv.category], fontFamily: "'DM Mono', monospace" }}>{(inv.ticker || inv.name).slice(0, 3).toUpperCase()}</span>
                          </div>
                          <div>
                            <div style={{ fontWeight: 600, color: "#E6EDF3" }}>{inv.name}</div>
                            {inv.ticker && <div style={{ fontSize: 11, color: "#8B949E", fontFamily: "'DM Mono', monospace" }}>{inv.ticker} · {inv.currency}</div>}
                          </div>
                        </div>
                      </td>
                      <td style={S.td}>
                        <span style={{ background: CATEGORY_COLORS[inv.category] + "20", color: CATEGORY_COLORS[inv.category], borderRadius: 6, padding: "3px 8px", fontSize: 11, fontWeight: 700 }}>{inv.category}</span>
                      </td>
                      <td style={{ ...S.td, textAlign: "right", fontFamily: "'DM Mono', monospace", fontWeight: 600 }}>{fmtNum(value)}</td>
                      <td style={{ ...S.td, textAlign: "right", fontFamily: "'DM Mono', monospace", color: "#8B949E" }}>{fmtNum(inv.buyPrice)}</td>
                      <td style={{ ...S.td, textAlign: "right", fontFamily: "'DM Mono', monospace", color: "#8B949E" }}>{fmtNum(inv.quantity, inv.quantity % 1 === 0 ? 0 : 4)}</td>
                      <td style={{ ...S.td, textAlign: "right" }}>
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 2 }}>
                          <Sparkline pct={pct} />
                          <span style={{ color: up ? "#6EE7B7" : "#FCA5A5", fontFamily: "'DM Mono', monospace", fontSize: 13, fontWeight: 600 }}>{up ? "+" : ""}{fmtNum(pct, 2)}%</span>
                          <span style={{ color: "#8B949E", fontFamily: "'DM Mono', monospace", fontSize: 11 }}>{up ? "+" : ""}{fmtNum(abs, 0)} {inv.currency}</span>
                        </div>
                      </td>
                      <td style={{ ...S.td, textAlign: "right", color: "#8B949E", fontSize: 12 }}>{inv.buyDate || "—"}</td>
                      <td style={S.td} onClick={e => e.stopPropagation()}>
                        <div style={{ display: "flex", gap: 6 }}>
                          <button title="Szerkesztés" style={{ background: "none", border: "none", color: "#8B949E", cursor: "pointer", padding: "4px 6px", borderRadius: 6, fontSize: 14 }}
                            onClick={() => { setEditing(inv); setModal("edit"); }}>✏️</button>
                          <button title="Törlés" style={{ background: "none", border: "none", color: "#8B949E", cursor: "pointer", padding: "4px 6px", borderRadius: 6, fontSize: 14 }}
                            onClick={() => setConfirmDelete(inv)}>🗑️</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr style={{ borderTop: "2px solid #21262D", background: "#1C2128" }}>
                  <td style={{ ...S.td, fontWeight: 700, color: "#E6EDF3" }}>Összesen ({displayed.length})</td>
                  <td style={S.td} /><td style={S.td} /><td style={S.td} /><td style={S.td} />
                  <td style={{ ...S.td, textAlign: "right" }}>
                    <span style={{ color: stats.totalPnL >= 0 ? "#6EE7B7" : "#FCA5A5", fontFamily: "'DM Mono', monospace", fontWeight: 700 }}>
                      {stats.totalPnL >= 0 ? "+" : ""}{fmtNum(stats.totalPct, 2)}%
                    </span>
                  </td>
                  <td style={S.td} /><td style={S.td} />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
        </>)}
      </main>

      {/* ── Modals ── */}
      {(modal === "add" || modal === "edit") && (
        <Modal title={modal === "add" ? "Új befektetés" : "Befektetés szerkesztése"} onClose={() => { setModal(null); setEditing(null); }}>
          <InvestmentForm initial={editing} onSave={saveInvestment} onCancel={() => { setModal(null); setEditing(null); }} />
        </Modal>
      )}

      {modal === "import" && (
        <Modal title="CSV Import" onClose={() => { setModal(null); setImportText(""); }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ background: "#0D1117", border: "1px dashed #30363D", borderRadius: 8, padding: "24px", textAlign: "center" }}>
              <div style={{ fontSize: 13, color: "#8B949E", marginBottom: 12 }}>Húzd ide a CSV fájlt, vagy</div>
              <label style={{ ...S.btn("ghost"), display: "inline-flex", cursor: "pointer" }}>
                📁 Fájl kiválasztása
                <input type="file" accept=".csv,.txt" style={{ display: "none" }} onChange={handleFileImport} />
              </label>
            </div>
            <textarea
              style={{ width: "100%", background: "#0D1117", border: "1px solid #30363D", borderRadius: 8, padding: "10px 12px", color: "#E6EDF3", fontSize: 12, fontFamily: "'DM Mono', monospace", minHeight: 100, resize: "vertical", boxSizing: "border-box", outline: "none" }}
              placeholder={"Név,Ticker,Kategória,Vétel ár,Darab,Jelenlegi ár,Deviza,Vétel dátum,Megjegyzés"}
              value={importText} onChange={e => setImportText(e.target.value)}
            />
            <div style={{ background: theme.bg.inset, border: `1px solid ${theme.border.subtle}`, borderRadius: theme.radius.md, padding: "12px 14px", fontSize: 12, color: theme.text.secondary, lineHeight: 1.7 }}>
              <div style={{ fontWeight: 700, color: theme.text.primary, marginBottom: 4 }}>📋 Oszlopsorrend:</div>
              <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, color: theme.accent.green, marginBottom: 10 }}>
                Név · Ticker · Kategória · Vétel ár · Darab · Jelenlegi ár · Deviza · Vétel dátum · Megjegyzés
              </div>
              <div style={{ padding: "8px 10px", background: "rgba(110,231,183,0.05)", border: `1px solid rgba(110,231,183,0.18)`, borderRadius: theme.radius.sm }}>
                <div style={{ fontWeight: 700, color: theme.accent.green, marginBottom: 4 }}>💡 Több vásárlás = ismételt sor ugyanazzal a Tickerrel:</div>
                <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, color: theme.text.tertiary, whiteSpace: "pre", lineHeight: 1.8 }}>{
`AMD,AMD,Részvény,180,0.05,0,HUF,2024-01-10,1. vétel
AMD,AMD,Részvény,210,0.03,0,HUF,2024-06-15,2. vétel`}</div>
                <div style={{ fontSize: 11, color: theme.text.tertiary, marginTop: 6 }}>→ 1 pozíció, 2 lot, automatikus átlagár</div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
              <button style={S.btn("ghost")} onClick={() => { setModal(null); setImportText(""); }}>Mégsem</button>
              <button style={{ ...S.btn("primary"), opacity: importText.trim() ? 1 : 0.5 }} onClick={handleImport} disabled={!importText.trim()}>Importálás</button>
            </div>
          </div>
        </Modal>
      )}

      {confirmDelete && (
        <Modal title="Törlés megerősítése" onClose={() => setConfirmDelete(null)}>
          <div style={{ fontSize: 14, color: "#8B949E", marginBottom: 20 }}>
            Biztosan törlöd a <strong style={{ color: "#E6EDF3" }}>{confirmDelete.name}</strong> pozíciót?
          </div>
          <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
            <button style={S.btn("ghost")} onClick={() => setConfirmDelete(null)}>Mégsem</button>
            <button style={{ ...S.btn("ghost"), color: "#FCA5A5", borderColor: "#FCA5A5" }} onClick={() => doDelete(confirmDelete.id)}>Törlés</button>
          </div>
        </Modal>
      )}

      {detailInv && (
        <DetailModal inv={detailInv} onClose={() => setDetailInv(null)}
          onEdit={() => { setEditing(detailInv); setDetailInv(null); setModal("edit"); }} />
      )}

      {sellInv && <SellModal inv={sellInv} onSell={handleSell} onClose={() => setSellInv(null)} />}

      {showTxLog && <TransactionLog onClose={() => setShowTxLog(false)} />}
      {showAI    && <AIAnalysis investments={investments} onClose={() => setShowAI(false)} />}
      {showLog   && <LogModal onClose={() => setShowLog(false)} />}
      {featureModal && (
        <FeatureModal
          feature={featureModal}
          investments={investments}
          onClose={() => setFeatureModal(null)}
          onSwitchPortfolio={(invs) => { setInvestments(invs); showToast("Portfólió betöltve!"); }}
        />
      )}

      <Toast toast={toast} />

      <style>{`
        ${KEYFRAMES}
        *, *::before, *::after { box-sizing:border-box; margin:0; padding:0; }
        html, body, #root { background:${isDark ? "#070B14" : "#F0F4F8"}; min-height:100vh; }
        ::-webkit-scrollbar { width:5px; height:5px; }
        ::-webkit-scrollbar-track { background:transparent; }
        ::-webkit-scrollbar-thumb { background:${theme.border.default}; border-radius:3px; }
        input[type=number]::-webkit-inner-spin-button { opacity:.3; }
        select option { background:${isDark ? "#0D1117" : "#fff"}; color:${theme.text.primary}; }
        ::-webkit-scrollbar-button { display:none; }
        * { -webkit-tap-highlight-color: transparent; }
      `}</style>
    </div>
  );
}
