import { useState, useEffect } from "react";
import { CATEGORY_COLORS } from "../constants";
import { calcPnL, fmtNum } from "../utils";
import { fetchYahooPrice } from "../services/priceService";

// ─── HISTORIC CHART ───────────────────────────────────────────────────────────
function HistoricChart({ ticker, currency }) {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);
  const [range,   setRange]   = useState("3mo");

  useEffect(() => {
    if (!ticker) return;
    setLoading(true); setError(null); setData(null);
    const interval  = range === "1mo" || range === "3mo" ? "1d" : "1wk";
    const yahooUrl  = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?range=${range}&interval=${interval}`;
    const proxyUrl  = `https://api.allorigins.win/raw?url=${encodeURIComponent(yahooUrl)}`;

    fetch(proxyUrl, { signal: AbortSignal.timeout(10000) })
      .then(r => r.text())
      .then(text => {
        const json   = JSON.parse(text);
        const result = json?.chart?.result?.[0];
        if (!result) throw new Error("Nincs adat");
        const times  = result.timestamp || [];
        const closes = result.indicators?.quote?.[0]?.close || [];
        setData(times.map((t, i) => ({ t: new Date(t * 1000), v: closes[i] })).filter(p => p.v != null));
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [ticker, range]);

  if (loading) return <div style={{ textAlign: "center", padding: 32, color: "#8B949E", fontSize: 13 }}>Grafikon betöltése...</div>;
  if (error || !data?.length) return <div style={{ textAlign: "center", padding: 32, color: "#FCA5A5", fontSize: 13 }}>Grafikon nem elérhető</div>;

  const vals = data.map(p => p.v);
  const minV = Math.min(...vals), maxV = Math.max(...vals);
  const W = 340, H = 120, pad = 8;
  const sx = i => pad + (i / (data.length - 1)) * (W - 2 * pad);
  const sy = v => H - pad - ((v - minV) / (maxV - minV || 1)) * (H - 2 * pad);
  const pathD = data.map((p, i) => `${i === 0 ? "M" : "L"}${sx(i).toFixed(1)},${sy(p.v).toFixed(1)}`).join(" ");
  const areaD = `${pathD} L${sx(data.length - 1)},${H} L${pad},${H} Z`;
  const first = vals[0], last = vals[vals.length - 1];
  const up    = last >= first;
  const color = up ? "#6EE7B7" : "#FCA5A5";
  const pct   = ((last - first) / first * 100).toFixed(2);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <div>
          <span style={{ fontSize: 22, fontWeight: 800, color: "#E6EDF3", fontFamily: "'DM Mono', monospace" }}>
            {last.toFixed(2)} <span style={{ fontSize: 13, color: "#8B949E" }}>{currency}</span>
          </span>
          <span style={{ marginLeft: 10, fontSize: 13, color, fontWeight: 700 }}>{up ? "+" : ""}{pct}%</span>
        </div>
        <div style={{ display: "flex", gap: 4 }}>
          {["1mo", "3mo", "1y", "5y"].map(r => (
            <button key={r} onClick={() => setRange(r)} style={{
              background: range === r ? "#21262D" : "none",
              border: `1px solid ${range === r ? "#30363D" : "transparent"}`,
              borderRadius: 6, padding: "3px 8px",
              color: range === r ? "#E6EDF3" : "#8B949E",
              cursor: "pointer", fontSize: 11, fontFamily: "inherit",
            }}>{r}</button>
          ))}
        </div>
      </div>
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ display: "block" }}>
        <defs>
          <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor={color} stopOpacity="0.3" />
            <stop offset="100%" stopColor={color} stopOpacity="0"   />
          </linearGradient>
        </defs>
        <path d={areaD} fill="url(#chartGrad)" />
        <path d={pathD} fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
        <text x={pad} y={sy(maxV) - 4}  fill="#8B949E" fontSize="9" fontFamily="monospace">{maxV.toFixed(0)}</text>
        <text x={pad} y={sy(minV) + 12} fill="#8B949E" fontSize="9" fontFamily="monospace">{minV.toFixed(0)}</text>
      </svg>
    </div>
  );
}

// ─── NEWS FEED ────────────────────────────────────────────────────────────────
function NewsFeed({ ticker }) {
  const [news,    setNews]    = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!ticker) return;
    setLoading(true);
    const newsUrl   = `https://query2.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(ticker)}&quotesCount=0&newsCount=6&enableFuzzyQuery=false`;
    const proxyUrl  = `https://api.allorigins.win/raw?url=${encodeURIComponent(newsUrl)}`;
    fetch(proxyUrl, { signal: AbortSignal.timeout(8000) })
      .then(r => r.text())
      .then(text => setNews(JSON.parse(text)?.news || []))
      .catch(() => setNews([]))
      .finally(() => setLoading(false));
  }, [ticker]);

  if (loading) return <div style={{ color: "#8B949E", fontSize: 12, padding: "12px 0" }}>Hírek betöltése...</div>;
  if (!news?.length) return <div style={{ color: "#8B949E", fontSize: 12, padding: "12px 0" }}>Nem találtam híreket.</div>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {news.slice(0, 5).map((n, i) => (
        <a key={i} href={n.link} target="_blank" rel="noopener noreferrer"
          style={{ display: "block", background: "#0D1117", border: "1px solid #21262D", borderRadius: 8, padding: "10px 12px", textDecoration: "none" }}>
          <div style={{ fontSize: 13, color: "#E6EDF3", fontWeight: 600, marginBottom: 4, lineHeight: 1.4 }}>{n.title}</div>
          <div style={{ fontSize: 11, color: "#8B949E" }}>
            {n.publisher} · {n.providerPublishTime ? new Date(n.providerPublishTime * 1000).toLocaleDateString("hu-HU") : ""}
          </div>
        </a>
      ))}
    </div>
  );
}

// ─── DETAIL MODAL ─────────────────────────────────────────────────────────────
export function DetailModal({ inv, onClose, onEdit }) {
  const [tab, setTab] = useState("chart");
  const { value, abs, pct } = calcPnL(inv);
  const up = abs >= 0;
  const annualDividend = inv.currentPrice > 0 && inv.dividendYield
    ? (parseFloat(inv.dividendYield) / 100) * inv.currentPrice * inv.quantity
    : 0;

  const TABS = [
    { id: "chart", label: "📈 Grafikon" },
    { id: "news",  label: "📰 Hírek"   },
    { id: "info",  label: "💰 Részletek" },
  ];

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.8)", backdropFilter: "blur(4px)", zIndex: 50, display: "flex", alignItems: "flex-end" }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{ background: "#161B22", border: "1px solid #30363D", borderRadius: "16px 16px 0 0", width: "100%", maxHeight: "90vh", overflow: "auto", boxShadow: "0 -8px 40px rgba(0,0,0,.6)" }}>
        {/* Header */}
        <div style={{ padding: "20px 20px 0", borderBottom: "1px solid #21262D" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: CATEGORY_COLORS[inv.category] + "20", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <span style={{ fontSize: 13, fontWeight: 800, color: CATEGORY_COLORS[inv.category], fontFamily: "'DM Mono', monospace" }}>
                  {(inv.ticker || inv.name).slice(0, 4).toUpperCase()}
                </span>
              </div>
              <div>
                <div style={{ fontWeight: 800, fontSize: 17, color: "#E6EDF3" }}>{inv.name}</div>
                <div style={{ fontSize: 12, color: "#8B949E" }}>{inv.ticker} · {inv.currency} · {inv.category}</div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={onEdit} style={{ background: "#21262D", border: "none", borderRadius: 8, padding: "7px 12px", color: "#C9D1D9", cursor: "pointer", fontSize: 12, fontFamily: "inherit" }}>✏️</button>
              <button onClick={onClose} style={{ background: "none", border: "none", color: "#8B949E", cursor: "pointer", fontSize: 22 }}>×</button>
            </div>
          </div>

          {/* Quick stats */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 14 }}>
            {[
              { l: "Piaci érték", v: fmtNum(value, 0),                         c: "#E6EDF3" },
              { l: "P&L",         v: (up ? "+" : "") + fmtNum(pct, 2) + "%",   c: up ? "#6EE7B7" : "#FCA5A5" },
              { l: "P&L összeg",  v: (up ? "+" : "") + fmtNum(abs, 0),         c: up ? "#6EE7B7" : "#FCA5A5" },
            ].map((s, i) => (
              <div key={i} style={{ background: "#0D1117", borderRadius: 8, padding: "8px 10px" }}>
                <div style={{ fontSize: 9, color: "#8B949E", textTransform: "uppercase", marginBottom: 3 }}>{s.l}</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: s.c, fontFamily: "'DM Mono', monospace" }}>{s.v}</div>
              </div>
            ))}
          </div>

          {/* Tabs */}
          <div style={{ display: "flex", borderBottom: "1px solid #21262D", marginBottom: -1 }}>
            {TABS.map(t => (
              <button key={t.id} onClick={() => setTab(t.id)} style={{
                background: "none", border: "none",
                borderBottom: tab === t.id ? "2px solid #6EE7B7" : "2px solid transparent",
                padding: "8px 14px",
                color: tab === t.id ? "#6EE7B7" : "#8B949E",
                cursor: "pointer", fontSize: 12, fontWeight: 600, fontFamily: "inherit",
              }}>{t.label}</button>
            ))}
          </div>
        </div>

        {/* Tab content */}
        <div style={{ padding: "16px 20px 32px" }}>
          {tab === "chart" && <HistoricChart ticker={inv.ticker} currency={inv.currency} />}
          {tab === "news"  && <NewsFeed ticker={inv.ticker} />}
          {tab === "info"  && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {[
                ["Vételár",         fmtNum(inv.buyPrice, 0) + " " + inv.currency],
                ["Jelenlegi ár",    fmtNum(inv.currentPrice, 0) + " " + inv.currency],
                ["Mennyiség",       fmtNum(inv.quantity, inv.quantity % 1 === 0 ? 0 : 4)],
                ["Befektetett",     fmtNum(inv.buyPrice * inv.quantity, 0) + " " + inv.currency],
                ["Vétel dátuma",    inv.buyDate || "—"],
                ["Célár",           inv.targetPrice ? fmtNum(+inv.targetPrice, 0) + " " + inv.currency : "Nincs beállítva"],
                ["Célár távolság",  inv.targetPrice && inv.currentPrice > 0
                  ? ((+inv.targetPrice - inv.currentPrice) / inv.currentPrice * 100).toFixed(2) + "%" : "—"],
                ["Osztalékhozam",   inv.dividendYield ? inv.dividendYield + "%" : "—"],
                ["Éves osztalék",   annualDividend > 0 ? fmtNum(annualDividend, 0) + " " + inv.currency : "—"],
              ].map(([label, val]) => (
                <div key={label} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid #21262D" }}>
                  <span style={{ fontSize: 13, color: "#8B949E" }}>{label}</span>
                  <span style={{ fontSize: 13, color: "#E6EDF3", fontFamily: "'DM Mono', monospace", fontWeight: 600 }}>{val}</span>
                </div>
              ))}
              {inv.notes && (
                <div style={{ background: "#0D1117", borderRadius: 8, padding: "10px 12px", fontSize: 12, color: "#8B949E", marginTop: 4 }}>
                  {inv.notes}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
