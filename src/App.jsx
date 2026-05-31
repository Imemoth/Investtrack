import { useState, useCallback, useMemo, useEffect, useRef } from "react";

import { STORAGE_KEY, CATEGORIES, CATEGORY_COLORS, POSITION_PALETTE } from "./constants";
import { fmtNum, fmtCurrency, calcPnL, calcAvgBuyPrice, calcTotalQty, exportCSV, parseCSV, migrateAll } from "./utils";
import { refreshAllPrices } from "./services/priceService";
import { parseXTBFile } from "./services/xtbImporter";
import {
  supabase, onAuthStateChange, signOut,
  fetchInvestments, upsertInvestment, upsertInvestments, deleteInvestment, deleteAllInvestments,
  fetchClosedPositions, upsertClosedPositions, deleteAllClosedPositions,
  fetchPendingOrders, upsertPendingOrder, deletePendingOrder,
  savePortfolioSnapshot, migrateFromLocalStorage,
} from "./services/supabase";
import { AuthScreen } from "./components/AuthScreen";
import { THEME as T, LIGHT_THEME, glassCard, haptic, KEYFRAMES } from "./design-system";

import { DonutChart, Sparkline, Modal, Toast, LogModal, PortfolioSkeleton, DashboardSkeleton } from "./components/ui";
import { Header } from "./components/Header";
import { InvestmentForm } from "./components/InvestmentForm";
import { DetailModal } from "./components/DetailModal";
import { BubbleChart } from "./components/BubbleChart";
import { Treemap } from "./components/Treemap";
import { TopMovers, CurrencyExposure, BenchmarkChart, RiskReturn, PendingOrders, loadPending } from "./components/DashboardWidgets";
import { TransactionLog, addTransaction } from "./components/TransactionLog";
import { AIAnalysis } from "./components/AIAnalysis";
import { FeatureModal } from "./components/FeatureModals";
import { SellModal } from "./components/SellModal";
import { InvRow } from "./components/InvRow";
import { PortfolioTab } from "./components/PortfolioTab";

// ─── APP ──────────────────────────────────────────────────────────────────────
export default function App() {
  const [user,            setUser]            = useState(undefined); // undefined = loading
  const [dbReady,         setDbReady]         = useState(false);
  const syncRef = useRef(false); // megakadályozza a dupla szinkronizálást
  // ── State ──
  const [investments,     setInvestments]     = useState(() => {
    try {
      const raw = JSON.parse(localStorage.getItem("investtrack_v2") || localStorage.getItem("investtrack_v1") || "[]");
      return migrateAll(raw);
    } catch { return []; }
  });
  const [closedPositions, setClosedPositions] = useState(() => {
    try { return JSON.parse(localStorage.getItem("investtrack_closed") || "[]"); }
    catch { return []; }
  });
  const [showClosed,      setShowClosed]      = useState(false);
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
  const [fxRates,         setFxRates]         = useState(() => {
    try { return JSON.parse(localStorage.getItem("investtrack_fx") || "{}"); }
    catch { return {}; }
  });
  const [showTxLog,       setShowTxLog]       = useState(false);
  const [showAI,          setShowAI]          = useState(false);
  const [featureModal,    setFeatureModal]    = useState(null);
  const [confirmClear,    setConfirmClear]    = useState(false);
  const [isDark,          setIsDark]          = useState(() => localStorage.getItem("investtrack_theme") !== "light");
  const [lastRefreshed,   setLastRefreshed]   = useState(() => {
    const saved = localStorage.getItem("investtrack_last_refresh");
    return saved ? new Date(saved) : null;
  });
  const [isBooting,       setIsBooting]       = useState(true);

  // Rövid boot delay – fonts + layout betöltés
  useEffect(() => {
    const t = setTimeout(() => setIsBooting(false), 600);
    return () => clearTimeout(t);
  }, []);

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

  // ── Toast ──
  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  // ── Auth state ───────────────────────────────────────────────────────────
  useEffect(() => {
    const timeout = setTimeout(() => {
      setUser(prev => prev === undefined ? null : prev);
    }, 5000);

    // Email confirm / OAuth callback: hash-ből olvassuk a session-t
    const handleSession = async () => {
      try {
        // Ha van hash token (email confirm után) → exchangeCodeForSession
        const hash = window.location.hash;
        if (hash && hash.includes("access_token")) {
          const { data, error } = await supabase.auth.getSession();
          if (!error && data.session) {
            clearTimeout(timeout);
            setUser(data.session.user);
            window.history.replaceState(null, "", window.location.pathname);
            return;
          }
        }
        // Normál session ellenőrzés
        const { data: { session }, error } = await supabase.auth.getSession();
        clearTimeout(timeout);
        if (error) console.warn("Auth hiba:", error.message);
        setUser(session?.user ?? null);
      } catch (err) {
        clearTimeout(timeout);
        console.warn("Supabase nem elérhető:", err);
        setUser(null);
      }
    };

    handleSession();

    // onAuthStateChange: email confirm, login, logout eseményekre reagál
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log("Auth event:", event);
      clearTimeout(timeout);
      if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
        setUser(session?.user ?? null);
        window.history.replaceState(null, "", window.location.pathname);
      } else if (event === "SIGNED_OUT") {
        setUser(null);
      } else if (event === "USER_UPDATED") {
        setUser(session?.user ?? null);
      }
    });

    return () => { clearTimeout(timeout); subscription.unsubscribe(); };
  }, []);

  // ── Adatok betöltése bejelentkezés után ──────────────────────────────────
  useEffect(() => {
    if (!user || syncRef.current) return;
    syncRef.current = true;
    async function loadData() {
      try {
        setIsBooting(true);
        // LocalStorage migráció ha van régi adat
        const hasLocal = localStorage.getItem("investtrack_v2") || localStorage.getItem("investtrack_v1");
        if (hasLocal) {
          const parsed = JSON.parse(hasLocal || "[]");
          if (parsed.length > 0) {
            await migrateFromLocalStorage();
            localStorage.removeItem("investtrack_v2"); localStorage.removeItem("investtrack_v1");
            localStorage.removeItem("investtrack_closed"); localStorage.removeItem("investtrack_pending_v1");
          }
        }
        const [invs, closed] = await Promise.all([fetchInvestments(), fetchClosedPositions()]);
        setInvestments(migrateAll(invs));
        setClosedPositions(closed);
        setDbReady(true);
        setIsBooting(false);
      } catch (err) {
        showToast("Adatbetöltés hiba: " + err.message, "error");
        setIsBooting(false); setDbReady(true);
      }
    }
    loadData();
  }, [user]);

  // ── Persistence: localStorage backup ──────────────────────────────────────
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(investments));
  }, [investments]);

  useEffect(() => {
    localStorage.setItem("investtrack_closed", JSON.stringify(closedPositions));
  }, [closedPositions]);

  // ── Price refresh ──
  const handleRefresh = async () => {
    if (refreshing) return;
    const withTicker = investments.filter(i => i.ticker?.trim());
    if (!withTicker.length) { showToast("Nincs ticker!", "error"); return; }
    setRefreshing(true);
    setRefreshProgress("Csatlakozás...");
    try {
      const { results, errors, fxRates: newFxRates } = await refreshAllPrices(investments, setRefreshProgress);
      if (newFxRates && Object.keys(newFxRates).length > 0) {
        setFxRates(newFxRates);
        localStorage.setItem("investtrack_fx", JSON.stringify(newFxRates));
      }
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

  const handleClearPortfolio = async () => {
    setInvestments([]);
    setClosedPositions([]);
    localStorage.removeItem("investtrack_v2");
    localStorage.removeItem("investtrack_v1");
    localStorage.removeItem("investtrack_closed");
    localStorage.removeItem("investtrack_last_refresh");
    setLastRefreshed(null);
    setConfirmClear(false);
    haptic("heavy");
    if (user) {
      try {
        await Promise.all([deleteAllInvestments(), deleteAllClosedPositions()]);
      } catch(e) { console.warn("Törlés hiba:", e.message); }
    }
    showToast("Portfólió törölve!", "info");
  };

  const handleSell = async ({ updatedInv, sale, fullyClose }) => {
    setInvestments(prev => {
      if (fullyClose) return prev.filter(i => i.id !== updatedInv.id);
      return prev.map(i => i.id === updatedInv.id ? updatedInv : i);
    });
    setSellInv(null);
    addTransaction({ ...updatedInv, ...sale }, "sell");
    if (user) {
      try {
        if (fullyClose) await deleteInvestment(updatedInv.id);
        else            await upsertInvestment(updatedInv);
      } catch(e) { console.warn("Eladás sync hiba:", e.message); }
    }
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
      if (investments.length > 0) {
        const choice = window.confirm(
          `${parsed.length} pozíciót találtam.\n\n` +
          `OK = Csere (jelenlegi ${investments.length} pozíció törlődik)\n` +
          `Mégse = Hozzáadás a meglévőkhöz`
        );
        if (choice) {
          setInvestments(parsed);
          localStorage.removeItem("investtrack_last_refresh");
          setLastRefreshed(null);
        } else {
          setInvestments(prev => [...prev, ...parsed]);
        }
      } else {
        setInvestments(parsed);
      }
      setModal(null); setImportText("");
      showToast(`${parsed.length} befektetés importálva!`);
    } catch (e) { showToast("Import hiba: " + e.message, "error"); }
  };

  const handleFileImport = e => {
    const file = e.target.files?.[0];
    if (!file) return;

    // XTB XLSX felismerés
    if (file.name.endsWith(".xlsx") || file.name.endsWith(".xls")) {
      const reader = new FileReader();
      reader.onload = async ev => {
        try {
          const result = parseXTBFile(ev.target.result);
          const parsed = result.open;
          const closed = result.closed;
          if (!parsed.length && !closed.length) throw new Error("Nem találtam pozíciókat");
          if (investments.length > 0) {
            const choice = window.confirm(
              `${parsed.length} nyitott + ${closed.length} lezárt pozíció.\n\n` +
              `OK = Csere (jelenlegi adatok törlődnek)\n` +
              `Mégse = Hozzáadás`
            );
            if (choice) {
              setInvestments(parsed);
              setClosedPositions(closed);
              localStorage.removeItem("investtrack_last_refresh");
              setLastRefreshed(null);
              if (user) {
                await deleteAllInvestments();
                await deleteAllClosedPositions();
                await upsertInvestments(parsed);
                await upsertClosedPositions(closed);
              }
            } else {
              setInvestments(prev => [...prev, ...parsed]);
              setClosedPositions(prev => [...prev, ...closed]);
              if (user) {
                await upsertInvestments(parsed);
                await upsertClosedPositions(closed);
              }
            }
          } else {
            setInvestments(parsed);
            setClosedPositions(closed);
          }
          setModal(null);
          showToast(`✓ XTB: ${parsed.length} nyitott, ${closed.length} lezárt pozíció`);
        } catch (err) {
          showToast("XTB import hiba: " + err.message, "error");
        }
      };
      reader.readAsArrayBuffer(file);
    } else {
      // CSV
      const reader = new FileReader();
      reader.onload = ev => setImportText(ev.target.result);
      reader.readAsText(file, "UTF-8");
    }
    e.target.value = "";
  };

  // ── Stats ──
  const stats = useMemo(() => {
    const pnlData    = investments.map(i => calcPnL(i));
    const totalCost  = pnlData.reduce((s, p) => s + p.cost, 0);
    const totalValue = pnlData.reduce((s, p) => s + p.value, 0);
    const totalPnL   = totalValue - totalCost;
    const totalPct   = totalCost > 0 ? (totalPnL / totalCost) * 100 : 0;

    const catBreakdown = CATEGORIES
      .map(c => {
        const invs = investments.filter(i => i.category === c);
        // Ha nincs currentPrice, cost basis alapján mutatjuk
        const v = invs.reduce((s, i) => {
          const p = calcPnL(i);
          return s + (p.value > 0 ? p.value : p.cost);
        }, 0);
        return { label: c, value: v, pct: totalValue > 0 ? (v / totalValue) * 100 : 0, color: CATEGORY_COLORS[c] };
      })
      .filter(d => d.value > 0);

    const posBreakdown = [...investments]
      .map((inv, idx) => {
        const p = calcPnL(inv);
        const v = p.value > 0 ? p.value : p.cost;
        return { label: inv.ticker || inv.name, fullName: inv.name, value: v, pct: totalValue > 0 ? (v / totalValue) * 100 : 0, color: POSITION_PALETTE[idx % POSITION_PALETTE.length] };
      })
      .filter(d => d.value > 0)
      .sort((a, b) => b.value - a.value);

    const totalRealizedPnL = investments.reduce((s, i) => s + (i.realizedPnL || 0), 0)
      + closedPositions.reduce((s, c) => s + (c.pnl || 0), 0);
    const totalDividend    = investments.reduce((s, i) => {
      if (!i.dividendYield || !i.currentPrice) return s;
      return s + (parseFloat(i.dividendYield) / 100) * calcPnL(i).value;
    }, 0);

    const pendingTotal = loadPending().reduce((s, o) => s + (o.hufTotal || 0), 0);

    return { totalCost, totalValue, totalPnL, totalPct, catBreakdown, posBreakdown, totalDividend, totalRealizedPnL, pendingTotal };
  }, [investments, closedPositions]);

  // ── Filtered & sorted list ──
  const displayed = useMemo(() => {
    const q    = search.toLowerCase();
    let list   = investments.filter(i =>
      (!q || i.name.toLowerCase().includes(q) || i.ticker.toLowerCase().includes(q)) &&
      (filterCat === "Összes" || i.category === filterCat)
    );
    return [...list].sort((a, b) => {
      let va, vb;
      if      (sortBy === "name")  { va = a.name;             vb = b.name; }
      else if (sortBy === "value") { va = calcPnL(a).value;   vb = calcPnL(b).value; }
      else if (sortBy === "pnl")   { va = calcPnL(a).pct;     vb = calcPnL(b).pct; }
      else if (sortBy === "date")  { va = a.lots?.[0]?.date || a.buyDate || ""; vb = b.lots?.[0]?.date || b.buyDate || ""; }
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
  // ── Auth gate a fő renderben ─────────────────────────────────────────────
  if (user === undefined) {
    return (
      <div style={{ minHeight:"100dvh", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", background:"#070B14", gap:16 }}>
        <style>{`@keyframes _spin { to { transform: rotate(360deg); } }`}</style>
        <div style={{ fontSize:32, animation:"_spin 1s linear infinite", display:"inline-block", color:"#6EE7B7" }}>⟳</div>
        <div style={{ fontSize:13, color:"#4B5563" }}>Csatlakozás...</div>
      </div>
    );
  }
  if (user === null) {
    return <AuthScreen />;
  }

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
        onClearPortfolio={() => setConfirmClear(true)}
        onSignOut={signOut}
        userEmail={user?.email}
        isDark={isDark}
        onToggleTheme={toggleTheme}
      />

      <main style={S.main}>

        {/* ── SKELETON – betöltés közben ── */}
        {isBooting && (
          activeTab === "dashboard"
            ? <DashboardSkeleton />
            : <PortfolioSkeleton />
        )}

        {/* ── SKELETON – árfolyamfrissítés közben ── */}
        {!isBooting && refreshing && (
          <div style={{ position: "fixed", bottom: 80, left: "50%", transform: "translateX(-50%)", background: T.bg.overlay, border: `1px solid ${T.border.default}`, backdropFilter: "blur(16px)", borderRadius: 12, padding: "10px 18px", display: "flex", alignItems: "center", gap: 10, zIndex: 30, boxShadow: T.shadow.raised }}>
            <svg width="14" height="14" fill="none" viewBox="0 0 16 16" style={{ animation: "spin 1s linear infinite", flexShrink: 0 }}>
              <path d="M13.5 8A5.5 5.5 0 1 1 8 2.5" stroke={T.accent.green} strokeWidth="1.7" strokeLinecap="round"/>
              <path d="M8 1v3.5L10.5 2 8 1z" fill={T.accent.green}/>
            </svg>
            <span style={{ fontSize: 13, color: T.text.primary, fontWeight: 600 }}>{refreshProgress || "Frissítés..."}</span>
          </div>
        )}

        {!isBooting && <>

        {/* ── DASHBOARD TAB ── */}
        {activeTab === "dashboard" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {/* Stat cards – 2x2 */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              {[
                { label: "Portfólió értéke",
                  val: fmtCurrency(stats.totalValue + stats.pendingTotal, "HUF"),
                  sub: `${investments.length} pozíció · ${stats.pendingTotal > 0 ? `+${fmtNum(stats.pendingTotal,0)} Ft függőben` : "nincs függő"}`,
                  color: theme.text.primary },
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
            <PendingOrders
              fxRates={fxRates}
              displayCurrency={displayCurrency}
              onSaveOrder={order => user && upsertPendingOrder(order).catch(console.warn)}
              onDeleteOrder={id => user && deletePendingOrder(id).catch(console.warn)}
            />
            <CurrencyExposure investments={investments} />
            <BenchmarkChart investments={investments} />
            <RiskReturn investments={investments} />
          </div>
        )}

        {/* ── PORTFOLIO TAB ── */}
        {activeTab === "portfolio" && (
          <PortfolioTab
            theme={theme}
            investments={investments}
            closedPositions={closedPositions}
            stats={stats}
            refreshLabel={refreshLabel}
            search={search}           setSearch={setSearch}
            filterCat={filterCat}     setFilterCat={setFilterCat}
            sortBy={sortBy}           setSortBy={setSortBy}
            sortDir={sortDir}         setSortDir={setSortDir}
            displayed={displayed}
            showClosed={showClosed}   setShowClosed={setShowClosed}
            chartMode={chartMode}     setChartMode={setChartMode}
            onDetail={setDetailInv}
            onSell={setSellInv}
            onEdit={inv => { setEditing(inv); setModal("edit"); }}
            onDelete={setConfirmDelete}
          />
        )}
        </> /* isBooting */}
      </main>

      {/* ── Modals ── */}
      {(modal === "add" || modal === "edit") && (
        <Modal title={modal === "add" ? "Új befektetés" : "Befektetés szerkesztése"} onClose={() => { setModal(null); setEditing(null); }}>
          <InvestmentForm initial={editing} onSave={saveInvestment} onCancel={() => { setModal(null); setEditing(null); }} />
        </Modal>
      )}

      {modal === "import" && (
        <Modal title="Import" onClose={() => { setModal(null); setImportText(""); }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {/* XTB közvetlen import */}
            <div style={{ ...glassCard(theme, { padding: 16 }), background: "rgba(110,231,183,0.06)", border: `1px solid rgba(110,231,183,0.25)` }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: theme.accent.green, marginBottom: 6 }}>🏦 XTB közvetlen import (ajánlott)</div>
              <div style={{ fontSize: 12, color: theme.text.secondary, marginBottom: 10, lineHeight: 1.6 }}>
                Töltsd le az XTB XLSX exportot — automatikusan felismeri a pozíciókat, lotokat és realizált P&L-t.
              </div>
              <div style={{ fontSize: 11, color: theme.text.tertiary, marginBottom: 12, background: theme.bg.inset, borderRadius: theme.radius.sm, padding: "8px 10px", lineHeight: 1.7 }}>
                xStation5 → <strong style={{ color: theme.text.secondary }}>Account History</strong> → Export → <strong style={{ color: theme.text.secondary }}>Full Report</strong> → <strong style={{ color: theme.text.secondary }}>Excel</strong>
              </div>
              <label style={{ ...S.btn("primary"), display: "inline-flex", cursor: "pointer", justifyContent: "center" }}>
                📥 XTB XLSX feltöltése
                <input type="file" accept=".xlsx,.xls" style={{ display: "none" }} onChange={handleFileImport} />
              </label>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ flex: 1, height: 1, background: theme.border.subtle }} />
              <span style={{ fontSize: 11, color: theme.text.tertiary }}>vagy CSV manuálisan</span>
              <div style={{ flex: 1, height: 1, background: theme.border.subtle }} />
            </div>
            <label style={{ ...S.btn("ghost"), display: "inline-flex", cursor: "pointer", justifyContent: "center" }}>
              📁 CSV feltöltése
              <input type="file" accept=".csv,.txt" style={{ display: "none" }} onChange={handleFileImport} />
            </label>
            <textarea
              style={{ width: "100%", background: theme.bg.inset, border: `1px solid ${theme.border.default}`, borderRadius: theme.radius.md, padding: "10px 12px", color: theme.text.primary, fontSize: 12, fontFamily: "'DM Mono', monospace", minHeight: 80, resize: "vertical", boxSizing: "border-box", outline: "none" }}
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
        <DetailModal
          inv={detailInv}
          closedPositions={closedPositions.filter(c => c.xtbTicker === detailInv.xtbTicker || c.ticker === detailInv.ticker)}
          onClose={() => setDetailInv(null)}
          onEdit={() => { setEditing(detailInv); setDetailInv(null); setModal("edit"); }}
        />
      )}

      {confirmClear && (
        <Modal title="⚠️ Portfólió törlése" onClose={() => setConfirmClear(false)}>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ background: "rgba(252,165,165,0.08)", border: "1px solid rgba(252,165,165,0.25)", borderRadius: theme.radius.md, padding: 16, fontSize: 13, color: theme.text.secondary, lineHeight: 1.7 }}>
              <div style={{ fontWeight: 700, color: theme.accent.red, marginBottom: 8 }}>Ez a művelet nem visszavonható!</div>
              Törlöd az összes <strong style={{ color: theme.text.primary }}>{investments.length} pozíciót</strong> és az árfolyam historikát. Utána importálhatod az XTB XLSX exportot.
            </div>
            <div style={{ fontSize: 12, color: theme.text.tertiary }}>
              💡 Tipp: előbb exportáld a jelenlegi adatokat (CSV Export), hogy meglegyen biztonsági másolat.
            </div>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button style={S.btn("ghost")} onClick={() => setConfirmClear(false)}>Mégsem</button>
              <button onClick={handleClearPortfolio} style={{ background: "rgba(252,165,165,0.15)", border: "1px solid rgba(252,165,165,0.4)", borderRadius: theme.radius.md, padding: "10px 20px", color: theme.accent.red, cursor: "pointer", fontSize: 13, fontWeight: 700, fontFamily: "inherit" }}>
                🗑️ Portfólió törlése
              </button>
            </div>
          </div>
        </Modal>
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
