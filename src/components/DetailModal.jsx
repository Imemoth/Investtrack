import { useState, useEffect } from "react";
import { CATEGORY_COLORS } from "../constants";
import { calcPnL, fmtNum } from "../utils";
import { StockChart } from "./StockChart";

const NEWS_PROXIES = [
  url => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
  url => `https://corsproxy.io/?url=${encodeURIComponent(url)}`,
];

// ─── NEWS FEED ────────────────────────────────────────────────────────────────
function NewsFeed({ ticker }) {
  const [news, setNews]    = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!ticker) return;
    setLoading(true);
    const newsUrl = `https://query2.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(ticker)}&quotesCount=0&newsCount=6&enableFuzzyQuery=false`;
    (async () => {
      for (const proxyFn of NEWS_PROXIES) {
        try {
          const res  = await fetch(proxyFn(newsUrl), { signal: AbortSignal.timeout(8000) });
          if (!res.ok) throw new Error();
          const text = await res.text();
          if (text.trim().startsWith("<")) throw new Error();
          setNews(JSON.parse(text)?.news || []);
          return;
        } catch {}
      }
      setNews([]);
    })().finally(() => setLoading(false));
  }, [ticker]);

  if (loading) return <div style={{ color: "#8B949E", fontSize: 12, padding: "20px 0", textAlign: "center" }}>Hírek betöltése...</div>;
  if (!news?.length) return <div style={{ color: "#8B949E", fontSize: 12, padding: "20px 0", textAlign: "center" }}>Nem találtam híreket.</div>;

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
    ? (parseFloat(inv.dividendYield) / 100) * inv.currentPrice * inv.quantity : 0;

  const TABS = [
    { id: "chart", label: "📈 Grafikon" },
    { id: "news",  label: "📰 Hírek" },
    { id: "info",  label: "💰 Részletek" },
  ];

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.8)", backdropFilter: "blur(4px)", zIndex: 50, display: "flex", alignItems: "flex-end" }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ background: "#161B22", border: "1px solid #30363D", borderRadius: "16px 16px 0 0", width: "100%", maxHeight: "92vh", overflow: "auto", boxShadow: "0 -8px 40px rgba(0,0,0,.6)" }}>

        {/* Header */}
        <div style={{ padding: "20px 20px 0", borderBottom: "1px solid #21262D", position: "sticky", top: 0, background: "#161B22", zIndex: 1 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: CATEGORY_COLORS[inv.category] + "20", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <span style={{ fontSize: 13, fontWeight: 800, color: CATEGORY_COLORS[inv.category], fontFamily: "'DM Mono',monospace" }}>
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
              { l: "Piaci érték", v: fmtNum(value, 0),                       c: "#E6EDF3" },
              { l: "P&L",         v: (up?"+":"") + fmtNum(pct,2) + "%",      c: up ? "#6EE7B7" : "#FCA5A5" },
              { l: "P&L összeg",  v: (up?"+":"") + fmtNum(abs,0),            c: up ? "#6EE7B7" : "#FCA5A5" },
            ].map((s, i) => (
              <div key={i} style={{ background: "#0D1117", borderRadius: 8, padding: "8px 10px" }}>
                <div style={{ fontSize: 9, color: "#8B949E", textTransform: "uppercase", marginBottom: 3 }}>{s.l}</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: s.c, fontFamily: "'DM Mono',monospace" }}>{s.v}</div>
              </div>
            ))}
          </div>

          {/* Tabs */}
          <div style={{ display: "flex", borderBottom: "1px solid #21262D", marginBottom: -1 }}>
            {TABS.map(t => (
              <button key={t.id} onClick={() => setTab(t.id)} style={{
                background: "none", border: "none",
                borderBottom: tab === t.id ? "2px solid #6EE7B7" : "2px solid transparent",
                padding: "8px 14px", color: tab === t.id ? "#6EE7B7" : "#8B949E",
                cursor: "pointer", fontSize: 12, fontWeight: 600, fontFamily: "inherit",
              }}>{t.label}</button>
            ))}
          </div>
        </div>

        {/* Tab content */}
        <div style={{ padding: "16px 20px 32px" }}>
          {tab === "chart" && <StockChart ticker={inv.ticker} currency={inv.currency} />}
          {tab === "news"  && <NewsFeed ticker={inv.ticker} />}
          {tab === "info"  && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {[
                ["Vételár",        fmtNum(inv.buyPrice, 0) + " " + inv.currency],
                ["Jelenlegi ár",   fmtNum(inv.currentPrice, 0) + " " + inv.currency],
                ["Mennyiség",      fmtNum(inv.quantity, inv.quantity % 1 === 0 ? 0 : 4)],
                ["Befektetett",    fmtNum(inv.buyPrice * inv.quantity, 0) + " " + inv.currency],
                ["Vétel dátuma",   inv.buyDate || "—"],
                ["Célár",          inv.targetPrice ? fmtNum(+inv.targetPrice, 0) + " " + inv.currency : "Nincs beállítva"],
                ["Célár távolság", inv.targetPrice && inv.currentPrice > 0
                  ? ((+inv.targetPrice - inv.currentPrice) / inv.currentPrice * 100).toFixed(2) + "%" : "—"],
                ["Osztalékhozam",  inv.dividendYield ? inv.dividendYield + "%" : "—"],
                ["Éves osztalék",  annualDividend > 0 ? fmtNum(annualDividend, 0) + " " + inv.currency : "—"],
              ].map(([label, val]) => (
                <div key={label} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid #21262D" }}>
                  <span style={{ fontSize: 13, color: "#8B949E" }}>{label}</span>
                  <span style={{ fontSize: 13, color: "#E6EDF3", fontFamily: "'DM Mono',monospace", fontWeight: 600 }}>{val}</span>
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
