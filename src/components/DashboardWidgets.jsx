import { useState, useEffect, useMemo } from "react";
import { calcPnL, fmtNum } from "../utils";
import { CATEGORY_COLORS, POSITION_PALETTE } from "../constants";
import { fetchOHLCV } from "./StockChart";
import { THEME as T, glassCard } from "../design-system";

// ─── TOP WINNERS / LOSERS ─────────────────────────────────────────────────────
export function TopMovers({ investments }) {
  const sorted = useMemo(() =>
    [...investments]
      .filter(i => i.currentPrice > 0)
      .map(i => ({ ...i, ...calcPnL(i) }))
      .sort((a, b) => b.pct - a.pct),
  [investments]);

  if (!sorted.length) return null;

  const winners = sorted.slice(0, 3);
  const losers  = [...sorted].reverse().slice(0, 3);

  const MEDALS = ["🥇","🥈","🥉"];

  const Row = ({ inv, rank, isWinner }) => (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 0", borderBottom: `1px solid ${T.border.subtle}` }}>
      <span style={{ fontSize: 15, width: 22, textAlign: "center", flexShrink: 0 }}>{MEDALS[rank]}</span>
      <div style={{ width: 34, height: 34, borderRadius: T.radius.md, background: CATEGORY_COLORS[inv.category] + "20", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <span style={{ fontSize: 9, fontWeight: 800, color: CATEGORY_COLORS[inv.category], fontFamily: "'DM Mono',monospace" }}>
          {(inv.ticker || inv.name).slice(0, 4)}
        </span>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: T.text.primary, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{inv.name}</div>
        <div style={{ fontSize: 11, color: T.text.secondary, fontFamily: "'DM Mono',monospace" }}>{fmtNum(inv.value, 0)} {inv.currency}</div>
      </div>
      <div style={{ textAlign: "right", flexShrink: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: isWinner ? T.accent.green : T.accent.red, fontFamily: "'DM Mono',monospace" }}>
          {isWinner ? "+" : ""}{fmtNum(inv.pct, 2)}%
        </div>
        <div style={{ fontSize: 11, color: T.text.tertiary, fontFamily: "'DM Mono',monospace" }}>
          {isWinner ? "+" : ""}{fmtNum(inv.abs, 0)}
        </div>
      </div>
    </div>
  );

  return (
    // Egymás ALÁ mobilon — nem grid 1fr 1fr
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={glassCard(T, { padding: 16 })}>
        <div style={{ fontSize: 11, color: T.accent.green, textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700, marginBottom: 10 }}>🏆 Top nyertesek</div>
        {winners.map((inv, i) => <Row key={inv.id} inv={inv} rank={i} isWinner />)}
      </div>
      <div style={glassCard(T, { padding: 16 })}>
        <div style={{ fontSize: 11, color: T.accent.red, textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700, marginBottom: 10 }}>📉 Top vesztesek</div>
        {losers.map((inv, i) => <Row key={inv.id} inv={inv} rank={i} isWinner={false} />)}
      </div>
    </div>
  );
}

// ─── CURRENCY EXPOSURE ────────────────────────────────────────────────────────
export function CurrencyExposure({ investments }) {
  const data = useMemo(() => {
    const byCurrency = {};
    investments.forEach(inv => {
      const { value, cost } = calcPnL(inv);
      const v = value > 0 ? value : cost; // cost basis ha nincs árfolyam
      if (v <= 0) return;
      byCurrency[inv.currency] = (byCurrency[inv.currency] || 0) + v;
    });
    const total = Object.values(byCurrency).reduce((s, v) => s + v, 0);
    const CURR_COLORS = { HUF: "#6EE7B7", USD: "#93C5FD", EUR: "#FDE68A", GBP: "#C4B5FD" };
    const FLAGS       = { HUF: "🇭🇺", USD: "🇺🇸", EUR: "🇪🇺", GBP: "🇬🇧" };
    return Object.entries(byCurrency)
      .map(([cur, val]) => ({ cur, val, pct: total > 0 ? (val / total) * 100 : 0, color: CURR_COLORS[cur] || T.text.secondary, flag: FLAGS[cur] || "🌐" }))
      .sort((a, b) => b.val - a.val);
  }, [investments]);

  if (!data.length) return null;

  return (
    <div style={glassCard(T, { padding: 16 })}>
      <div style={{ fontSize: 11, color: T.text.secondary, textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700, marginBottom: 14 }}>
        🌍 Deviza-kitettség
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {data.map(({ cur, val, pct, color, flag }) => (
          <div key={cur}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 5 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color, display: "flex", alignItems: "center", gap: 6 }}>
                {flag} {cur}
              </span>
              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <span style={{ fontSize: 13, fontFamily: "'DM Mono',monospace", color: T.text.primary, fontWeight: 700 }}>{fmtNum(pct, 1)}%</span>
                <span style={{ fontSize: 11, color: T.text.tertiary, fontFamily: "'DM Mono',monospace" }}>{fmtNum(val, 0)}</span>
              </div>
            </div>
            <div style={{ height: 6, background: T.bg.inset, borderRadius: T.radius.full }}>
              <div style={{ width: `${Math.min(pct, 100)}%`, height: 6, background: color, borderRadius: T.radius.full, transition: "width 0.8s cubic-bezier(0.4,0,0.2,1)", boxShadow: `0 0 8px ${color}60` }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── BENCHMARK ────────────────────────────────────────────────────────────────
export function BenchmarkChart({ investments }) {
  const [benchData, setBenchData] = useState(null);
  const [range,     setRange]     = useState("1y");
  const [loading,   setLoading]   = useState(true);

  useEffect(() => {
    setLoading(true);
    fetchOHLCV("^GSPC", range)
      .then(setBenchData).catch(() => setBenchData([]))
      .finally(() => setLoading(false));
  }, [range]);

  const portfolioReturn = useMemo(() => {
    const total    = investments.reduce((s, i) => s + calcPnL(i).value, 0);
    const invested = investments.reduce((s, i) => s + calcPnL(i).cost, 0);
    return invested > 0 ? ((total - invested) / invested) * 100 : 0;
  }, [investments]);

  const benchReturn = useMemo(() => {
    if (!benchData?.length) return null;
    return ((benchData[benchData.length - 1].close - benchData[0].close) / benchData[0].close) * 100;
  }, [benchData]);

  const W = 340, H = 110, PAD = { t: 10, r: 8, b: 16, l: 32 };

  return (
    <div style={glassCard(T, { padding: 16 })}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <div style={{ fontSize: 11, color: T.text.secondary, textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700 }}>
          💹 Benchmark vs S&P 500
        </div>
        <div style={{ display: "flex", gap: 4 }}>
          {["3mo","1y","5y"].map(r => (
            <button key={r} onClick={() => setRange(r)} style={{
              background: range === r ? T.bg.overlay : "none",
              border: `1px solid ${range === r ? T.border.default : "transparent"}`,
              borderRadius: T.radius.sm, padding: "3px 9px",
              color: range === r ? T.text.primary : T.text.secondary,
              cursor: "pointer", fontSize: 11, fontFamily: "inherit", fontWeight: 600,
            }}>{r}</button>
          ))}
        </div>
      </div>

      {/* Return cards — egymás MELLÉ de kicsik */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 14 }}>
        {[
          { label: "Portfóliód",  val: portfolioReturn,  color: portfolioReturn >= 0 ? T.accent.green : T.accent.red },
          { label: "S&P 500",     val: benchReturn,      color: benchReturn != null ? (benchReturn >= 0 ? T.accent.blue : T.accent.red) : T.text.secondary },
        ].map(({ label, val, color }) => (
          <div key={label} style={{ background: T.bg.inset, borderRadius: T.radius.md, padding: "10px 12px", textAlign: "center" }}>
            <div style={{ fontSize: 10, color: T.text.tertiary, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 5 }}>{label}</div>
            <div style={{ fontSize: 20, fontWeight: 800, color, fontFamily: "'DM Mono',monospace" }}>
              {val != null ? `${val >= 0 ? "+" : ""}${fmtNum(val, 2)}%` : "—"}
            </div>
          </div>
        ))}
      </div>

      {loading ? (
        <div style={{ height: 70, display: "flex", alignItems: "center", justifyContent: "center", color: T.text.tertiary, fontSize: 12 }}>
          Betöltés...
        </div>
      ) : benchData?.length > 1 && (() => {
        const closes = benchData.map(p => p.close);
        const minV   = Math.min(...closes) * 0.998;
        const maxV   = Math.max(...closes) * 1.002;
        const px     = i => PAD.l + (i / (benchData.length - 1)) * (W - PAD.l - PAD.r);
        const py     = v => PAD.t + (1 - (v - minV) / (maxV - minV)) * (H - PAD.t - PAD.b);
        const d      = benchData.map((p, i) => `${i === 0 ? "M" : "L"}${px(i).toFixed(1)},${py(p.close).toFixed(1)}`).join(" ");
        const color  = benchReturn >= 0 ? T.accent.blue : T.accent.red;
        // Portfólió pont
        const portY  = py(minV + (portfolioReturn / 100) * (maxV - minV));
        const portColor = portfolioReturn >= 0 ? T.accent.green : T.accent.red;

        return (
          <>
            <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ display: "block" }}>
              <defs>
                <linearGradient id="benchGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={color} stopOpacity="0.2"/>
                  <stop offset="100%" stopColor={color} stopOpacity="0"/>
                </linearGradient>
              </defs>
              {/* Zero baseline */}
              {(() => { const z = py(minV + (0 - minV)); return <line x1={PAD.l} y1={z} x2={W - PAD.r} y2={z} stroke={T.border.subtle} strokeWidth="1" strokeDasharray="4,3" />; })()}
              {/* Area fill */}
              <path d={`${d} L${px(benchData.length-1)},${H-PAD.b} L${px(0)},${H-PAD.b} Z`} fill="url(#benchGrad)" />
              {/* Line */}
              <path d={d} fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
              {/* Portfolio dot */}
              <circle cx={W - PAD.r - 3} cy={portY} r="5" fill={portColor} opacity="0.9" />
              <circle cx={W - PAD.r - 3} cy={portY} r="9" fill={portColor} opacity="0.15" />
            </svg>
            <div style={{ display: "flex", gap: 16, marginTop: 6 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 10, color: T.text.tertiary }}>
                <div style={{ width: 14, height: 2, background: color, borderRadius: 1 }} /> S&P 500
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 10, color: T.text.tertiary }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: portColor }} /> Portfóliód
              </div>
            </div>
          </>
        );
      })()}
    </div>
  );
}

// ─── RISK-RETURN ──────────────────────────────────────────────────────────────
export function RiskReturn({ investments }) {
  const data = useMemo(() =>
    investments.filter(i => i.currentPrice > 0 && i.buyPrice > 0).map((i, idx) => {
      const { pct, value } = calcPnL(i);
      const days = i.buyDate ? Math.max(1, (Date.now() - new Date(i.buyDate)) / 86400000) : 365;
      return { ...i, returnPct: pct, risk: Math.min(Math.abs(pct) / Math.sqrt(days / 365) / 10, 100), value, color: POSITION_PALETTE[idx % POSITION_PALETTE.length] };
    }),
  [investments]);

  if (data.length < 2) return null;

  const maxRisk = Math.max(...data.map(d => d.risk), 10);
  const minRet  = Math.min(...data.map(d => d.returnPct), -10);
  const maxRet  = Math.max(...data.map(d => d.returnPct), 10);
  const maxVal  = Math.max(...data.map(d => d.value));
  const W = 340, H = 200, PAD = 40;
  const px = r => PAD + (r / maxRisk) * (W - 2 * PAD);
  const py = r => PAD + (1 - (r - minRet) / (maxRet - minRet)) * (H - 2 * PAD);

  return (
    <div style={glassCard(T, { padding: 16 })}>
      <div style={{ fontSize: 11, color: T.text.secondary, textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700, marginBottom: 4 }}>
        ⚖️ Kockázat–Hozam
      </div>
      <div style={{ fontSize: 11, color: T.text.tertiary, marginBottom: 12 }}>
        Buborék = pozíció értéke · X = becsült kockázat · Y = hozam
      </div>
      <svg width="100%" viewBox={`0 0 ${W} ${H}`}>
        {/* Grid */}
        <line x1={PAD} y1={py(0)} x2={W-PAD} y2={py(0)} stroke={T.border.default} strokeWidth="1" strokeDasharray="4,3" />
        <line x1={PAD} y1={PAD}   x2={PAD}   y2={H-PAD} stroke={T.border.subtle} strokeWidth="1" />
        {/* Axis labels */}
        <text x={W/2} y={H-4}  fill={T.text.tertiary} fontSize="8" textAnchor="middle" fontFamily="'DM Sans',sans-serif">Kockázat →</text>
        <text x={12}  y={H/2}  fill={T.text.tertiary} fontSize="8" textAnchor="middle" transform={`rotate(-90,12,${H/2})`} fontFamily="'DM Sans',sans-serif">Hozam</text>
        {data.map((d, i) => {
          const r = 5 + (d.value / maxVal) * 18;
          return (
            <g key={d.id}>
              <circle cx={px(d.risk)} cy={py(d.returnPct)} r={r} fill={d.color} fillOpacity="0.3" stroke={d.color} strokeWidth="1.5">
                <title>{d.name}: {fmtNum(d.returnPct,2)}%</title>
              </circle>
              <text x={px(d.risk)} y={py(d.returnPct)+3.5} fill={T.text.primary} fontSize="7" textAnchor="middle" fontFamily="'DM Mono',monospace">
                {(d.ticker||d.name).slice(0,5)}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// ─── FÜGGŐBEN LÉVŐ MEGBÍZÁSOK ─────────────────────────────────────────────────
const PENDING_KEY = "investtrack_pending_v1";
export function loadPending()  { try { return JSON.parse(localStorage.getItem(PENDING_KEY) || "[]"); } catch { return []; } }
export function savePending(p) { localStorage.setItem(PENDING_KEY, JSON.stringify(p)); }

const EMPTY_ORDER = { name:"", ticker:"", type:"Buy Limit", limitPrice:"", currency:"USD", quantity:"", hufValue:"", expiry:"", notes:"" };
const TYPE_COLOR  = { "Buy Limit":"#6EE7B7", "Sell Limit":"#FCA5A5", "Buy Stop":"#93C5FD", "Sell Stop":"#FDE68A" };

export function PendingOrders({ fxRates = {}, displayCurrency = "HUF" }) {
  const [orders,  setOrders]  = useState(loadPending);
  const [showAdd, setShowAdd] = useState(false);
  const [form,    setForm]    = useState(EMPTY_ORDER);
  const f = (k, v) => setForm(p => ({...p, [k]: v}));

  const limitPrice  = parseFloat(form.limitPrice) || 0;
  const quantity    = parseFloat(form.quantity)   || 0;
  const hufTotal    = parseFloat(form.hufValue)   || 0;
  const totalNative = limitPrice * quantity;

  // Visszaszámított FX árfolyam: befektetett Ft / (limitár × db)
  const impliedFx = (hufTotal > 0 && totalNative > 0)
    ? Math.round(hufTotal / totalNative * 100) / 100
    : 0;

  const handleCurrencyChange = (cur) => {
    setForm(p => ({ ...p, currency: cur }));
  };


  // Konverzió HUF-ba: ha pl. USD → HUF, fxRates.USD = 360
  const toHuf = (amount, currency) => {
    if (currency === "HUF") return amount;
    const rate = fxRates[currency];
    return rate ? amount * rate : null; // null ha nincs rate
  };

  // Konverzió megjelenítési devizára
  const toDisplay = (hufAmount) => {
    if (!hufAmount) return null;
    if (displayCurrency === "HUF") return hufAmount;
    const rate = fxRates[displayCurrency];
    return rate ? hufAmount / rate : null;
  };

  const convertOrder = (o) => {
    const native = o.totalNative || 0;
    const huf    = toHuf(native, o.currency);
    const disp   = huf ? toDisplay(huf) : null;
    return { ...o, hufValue: huf, displayValue: disp };
  };

  // Összesített HUF érték
  const totalHuf = orders.reduce((s, o) => s + (o.hufTotal || 0), 0);

  const addOrder = () => {
    if (!form.name.trim() || !limitPrice) return;
    const order = {
      ...form,
      id: Date.now().toString(36), createdAt: new Date().toISOString(),
      limitPrice, quantity, totalNative,
      hufTotal:    hufTotal > 0 ? Math.round(hufTotal) : null,
      savedFxRate: impliedFx || null,
    };
    const next = [...orders, order];
    setOrders(next); savePending(next);
    setForm(EMPTY_ORDER); setShowAdd(false);
  };

  const removeOrder = id => {
    const next = orders.filter(o => o.id !== id);
    setOrders(next); savePending(next);
  };

  const inputS = {
    width:"100%", background: T.bg.inset, border:`1px solid ${T.border.default}`,
    borderRadius: T.radius.sm, padding:"8px 10px", color: T.text.primary,
    fontSize:13, fontFamily:"inherit", outline:"none", boxSizing:"border-box",
  };
  const L = ({ children }) => (
    <div style={{ fontSize:10, color:T.text.tertiary, textTransform:"uppercase", letterSpacing:"0.06em", fontWeight:700, marginBottom:4 }}>{children}</div>
  );

  const CURR_SYMBOL = { HUF: "Ft", USD: "$", EUR: "€", GBP: "£" };

  return (
    <div style={glassCard(T, { padding:16 })}>
      {/* Header */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom: totalHuf > 0 ? 8 : 14 }}>
        <div style={{ fontSize:11, color:T.text.secondary, textTransform:"uppercase", letterSpacing:"0.08em", fontWeight:700 }}>
          ⏳ Függőben lévő megbízások
          {orders.length > 0 && <span style={{ marginLeft:8, color:T.text.tertiary, fontWeight:400 }}>({orders.length})</span>}
        </div>
        <button onClick={() => setShowAdd(v => !v)} style={{
          background: showAdd ? T.bg.inset : "rgba(110,231,183,0.12)",
          border:`1px solid ${showAdd ? T.border.default : T.accent.green+"50"}`,
          borderRadius:T.radius.sm, padding:"5px 12px", cursor:"pointer",
          fontSize:11, fontWeight:700, color: showAdd ? T.text.secondary : T.accent.green, fontFamily:"inherit",
        }}>
          {showAdd ? "✕ Mégse" : "+ Hozzáadás"}
        </button>
      </div>

      {totalHuf > 0 && (
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14, padding:"8px 12px", background:"rgba(253,214,138,0.06)", border:`1px solid rgba(253,214,138,0.2)`, borderRadius:T.radius.sm }}>
          <span style={{ fontSize:12, color:T.text.secondary }}>Összesen befektetendő</span>
          <span style={{ fontSize:15, fontWeight:700, color:T.accent.yellow, fontFamily:"'DM Mono',monospace" }}>
            {fmtNum(totalHuf, 0)} Ft
          </span>
        </div>
      )}
      {showAdd && (
        <div style={{ background:T.bg.inset, border:`1px solid ${T.border.subtle}`, borderRadius:T.radius.md, padding:14, marginBottom:14, display:"flex", flexDirection:"column", gap:12 }}>

          {/* Sor 1: Megnevezés + Ticker */}
          <div style={{ display:"grid", gridTemplateColumns:"2fr 1fr", gap:10 }}>
            <div>
              <L>Megnevezés *</L>
              <input style={inputS} value={form.name} onChange={e=>f("name",e.target.value)} placeholder="pl. VanEck Defense ETF"/>
            </div>
            <div>
              <L>Ticker</L>
              <input style={inputS} value={form.ticker} onChange={e=>f("ticker",e.target.value.toUpperCase())} placeholder="DFNS.UK"/>
            </div>
          </div>

          {/* Sor 2: Típus */}
          <div>
            <L>Megbízás típusa</L>
            <div style={{ display:"flex", gap:6 }}>
              {["Buy Limit","Sell Limit","Buy Stop","Sell Stop"].map(t => (
                <button key={t} onClick={() => f("type",t)} style={{
                  flex:1, background: form.type===t ? (TYPE_COLOR[t]+"20") : T.bg.inset,
                  border:`1px solid ${form.type===t ? TYPE_COLOR[t] : T.border.subtle}`,
                  borderRadius:T.radius.sm, padding:"6px 4px", cursor:"pointer",
                  fontSize:10, fontWeight:700, color: form.type===t ? TYPE_COLOR[t] : T.text.tertiary,
                  fontFamily:"inherit",
                }}>{t}</button>
              ))}
            </div>
          </div>

          {/* Sor 3: Limit ár + Deviza */}
          <div style={{ display:"grid", gridTemplateColumns:"2fr 1fr", gap:10 }}>
            <div>
              <L>Limit ár *</L>
              <input style={inputS} type="number" value={form.limitPrice} onChange={e=>f("limitPrice",e.target.value)} placeholder="pl. 61.41"/>
            </div>
            <div>
              <L>Deviza</L>
              <select style={inputS} value={form.currency} onChange={e=>handleCurrencyChange(e.target.value)}>
                {["USD","EUR","HUF","GBP"].map(c=><option key={c}>{c}</option>)}
              </select>
            </div>
          </div>

          {/* Sor 4: Mennyiség */}
          <div>
            <L>Mennyiség (db)</L>
            <input style={inputS} type="number" value={form.quantity} onChange={e=>f("quantity",e.target.value)} placeholder="pl. 0.2852"/>
          </div>

          {/* Sor 5: Befektetett összeg HUF-ban */}
          <div>
            <L>Befektetett összeg (HUF) *</L>
            <input style={{
              ...inputS,
              background: hufTotal > 0 ? "rgba(110,231,183,0.06)" : T.bg.inset,
              border:`1px solid ${hufTotal > 0 ? T.accent.green+"50" : T.border.default}`,
            }}
              type="number" value={form.hufValue}
              onChange={e=>f("hufValue",e.target.value)}
              placeholder="pl. 5499"
            />
            {/* Visszaszámított FX árfolyam */}
            {impliedFx > 0 && (
              <div style={{ marginTop:6, padding:"6px 10px", background:"rgba(147,197,253,0.08)", border:`1px solid rgba(147,197,253,0.2)`, borderRadius:T.radius.sm, display:"flex", justifyContent:"space-between" }}>
                <span style={{ fontSize:11, color:T.text.tertiary }}>
                  Visszaszámított {form.currency}/HUF árfolyam:
                </span>
                <span style={{ fontSize:11, fontWeight:700, color:T.accent.blue, fontFamily:"'DM Mono',monospace" }}>
                  {fmtNum(impliedFx, 2)}
                </span>
              </div>
            )}
          </div>

          {/* Sor 5: Lejárat */}
          <div>
            <L>Lejárat (opcionális)</L>
            <input style={{...inputS, colorScheme:"dark"}} type="date" value={form.expiry} onChange={e=>f("expiry",e.target.value)}/>
          </div>

          <button onClick={addOrder} disabled={!form.name.trim() || !limitPrice} style={{
            background: form.name && limitPrice ? T.gradient.primary : T.bg.surface,
            border:"none", borderRadius:T.radius.md, padding:"10px",
            color: form.name && limitPrice ? "#fff" : T.text.tertiary,
            cursor: form.name && limitPrice ? "pointer" : "not-allowed",
            fontSize:13, fontWeight:700, fontFamily:"inherit",
            boxShadow: form.name && limitPrice ? "0 2px 12px rgba(46,160,67,0.35)" : "none",
          }}>
            Megbízás mentése
          </button>
        </div>
      )}

      {/* Lista */}
      {orders.length === 0 && !showAdd ? (
        <div style={{ textAlign:"center", color:T.text.tertiary, fontSize:12, padding:"16px 0", lineHeight:1.6 }}>
          Nincs függőben lévő megbízás.<br/>
          <span style={{ fontSize:11 }}>pl. DFNS.UK Buy Limit @ 61.41 USD</span>
        </div>
      ) : orders.map(o => {
        const huf = o.hufTotal || 0;
        const hasHuf = huf > 0;
        return (
          <div key={o.id} style={{ display:"flex", alignItems:"center", gap:10, padding:"10px 0", borderBottom:`1px solid ${T.border.subtle}` }}>
            <span style={{ fontSize:10, fontWeight:800, background:(TYPE_COLOR[o.type]||"#94A3B8")+"20", color:TYPE_COLOR[o.type]||"#94A3B8", borderRadius:4, padding:"2px 6px", flexShrink:0 }}>
              {o.type}
            </span>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontSize:13, fontWeight:600, color:T.text.primary, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                {o.name} {o.ticker && <span style={{ color:T.text.tertiary, fontSize:11 }}>· {o.ticker}</span>}
              </div>
              <div style={{ fontSize:11, color:T.text.tertiary, fontFamily:"'DM Mono',monospace", marginTop:2 }}>
                {fmtNum(o.limitPrice, 2)} {o.currency}
                {o.quantity > 0 && ` · ${fmtNum(o.quantity, 4)} db`}
                {o.savedFxRate > 0 && o.currency !== "HUF" && (
                  <span style={{ color:T.accent.blue, opacity:0.7 }}> · fx:{fmtNum(o.savedFxRate, 1)}</span>
                )}
                {o.expiry && ` · ${o.expiry}-ig`}
              </div>
            </div>
            {/* Érték: HUF elsődleges, natív másodlagos */}
            <div style={{ textAlign:"right", flexShrink:0 }}>
              {hasHuf ? (
                <>
                  <div style={{ fontSize:13, fontWeight:700, color:T.accent.yellow, fontFamily:"'DM Mono',monospace" }}>
                    {fmtNum(huf, 0)} Ft
                  </div>
                  {o.currency !== "HUF" && o.totalNative > 0 && (
                    <div style={{ fontSize:10, color:T.text.tertiary, fontFamily:"'DM Mono',monospace" }}>
                      {fmtNum(o.totalNative, 2)} {o.currency}
                    </div>
                  )}
                </>
              ) : o.totalNative > 0 ? (
                <div style={{ fontSize:13, fontWeight:700, color:T.text.primary, fontFamily:"'DM Mono',monospace" }}>
                  {fmtNum(o.totalNative, 2)} {o.currency}
                </div>
              ) : null}
            </div>
            <button onClick={() => removeOrder(o.id)} style={{ background:"none", border:"none", color:T.text.tertiary, cursor:"pointer", fontSize:16, padding:"0 4px", flexShrink:0 }}>✕</button>
          </div>
        );
      })}
    </div>
  );
}
