import { useState, useEffect } from "react";
import { CATEGORY_COLORS } from "../constants";
import { calcPnL, calcAvgBuyPrice, calcTotalQty, calcCostBasis, fmtNum } from "../utils";
import { StockChart } from "./StockChart";
import { THEME as T } from "../design-system";

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
export function DetailModal({ inv, closedPositions = [], onClose, onEdit }) {
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
                ["Átlag vételár",  fmtNum(calcAvgBuyPrice(inv.lots||[]), 0) + " " + inv.currency],
                ["Összmennyiség",  fmtNum(calcTotalQty(inv.lots||[]), 4) + " db"],
                ["Befektetett",    fmtNum(calcCostBasis(inv.lots||[]), 0) + " " + inv.currency],
                ["Jelenlegi ár",   fmtNum(inv.currentPrice, 0) + " " + inv.currency],
                ["Célár",          inv.targetPrice ? fmtNum(+inv.targetPrice, 0) + " " + inv.currency : "Nincs beállítva"],
                ["Célár távolság", inv.targetPrice && inv.currentPrice > 0
                  ? ((+inv.targetPrice - inv.currentPrice) / inv.currentPrice * 100).toFixed(2) + "%" : "—"],
                ["Osztalékhozam",  inv.dividendYield ? inv.dividendYield + "%" : "—"],
                ["Éves osztalék",  annualDividend > 0 ? fmtNum(annualDividend, 0) + " " + inv.currency : "—"],
              ].map(([label, val]) => (
                <div key={label} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: `1px solid ${T.border.subtle}` }}>
                  <span style={{ fontSize: 13, color: T.text.secondary }}>{label}</span>
                  <span style={{ fontSize: 13, color: T.text.primary, fontFamily: "'DM Mono',monospace", fontWeight: 600 }}>{val}</span>
                </div>
              ))}

              {/* Lot-onkénti részletek */}
              {inv.lots?.length > 0 && (
                <div style={{ marginTop: 6 }}>
                  <div style={{ fontSize: 11, color: T.text.secondary, textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700, marginBottom: 10 }}>
                    📦 Vételi tételek ({inv.lots.length})
                  </div>
                  {inv.lots.map((lot, i) => (
                    <div key={lot.id || i} style={{ background: T.bg.inset, borderRadius: T.radius.md, padding: "12px", marginBottom: 8, border: `1px solid ${T.border.subtle}` }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                        <span style={{ fontSize: 11, color: T.text.tertiary, fontWeight: 700 }}>#{i+1} tétel</span>
                        <span style={{ fontSize: 11, color: T.text.tertiary, fontFamily: "'DM Mono',monospace" }}>
                          {lot.datetime || lot.date || "—"}
                        </span>
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                        <div>
                          <div style={{ fontSize: 10, color: T.text.tertiary, marginBottom: 2 }}>Darabszám</div>
                          <div style={{ fontSize: 13, fontWeight: 700, color: T.text.primary, fontFamily: "'DM Mono',monospace" }}>{fmtNum(lot.quantity, 4)} db</div>
                        </div>
                        <div>
                          <div style={{ fontSize: 10, color: T.text.tertiary, marginBottom: 2 }}>Befizetve (HUF)</div>
                          <div style={{ fontSize: 13, fontWeight: 700, color: T.text.primary, fontFamily: "'DM Mono',monospace" }}>{fmtNum(lot.hufTotal || lot.price * lot.quantity, 0)} Ft</div>
                        </div>
                        <div>
                          <div style={{ fontSize: 10, color: T.text.tertiary, marginBottom: 2 }}>HUF/db vételár</div>
                          <div style={{ fontSize: 13, color: T.text.secondary, fontFamily: "'DM Mono',monospace" }}>{fmtNum(lot.price, 0)} Ft</div>
                        </div>
                        {lot.usdPrice && (
                          <div>
                            <div style={{ fontSize: 10, color: T.text.tertiary, marginBottom: 2 }}>USD ár</div>
                            <div style={{ fontSize: 13, color: T.text.secondary, fontFamily: "'DM Mono',monospace" }}>${fmtNum(lot.usdPrice, 2)}</div>
                          </div>
                        )}
                        {lot.impliedFxRate && (
                          <div style={{ gridColumn: "1 / -1" }}>
                            <div style={{ fontSize: 10, color: T.text.tertiary, marginBottom: 2 }}>USD/HUF árfolyam (vételkor)</div>
                            <div style={{ fontSize: 12, color: T.text.tertiary, fontFamily: "'DM Mono',monospace" }}>{fmtNum(lot.impliedFxRate, 2)}</div>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Lezárt ügyletek */}
              {closedPositions.length > 0 && (
                <div style={{ marginTop: 6 }}>
                  <div style={{ fontSize: 11, color: T.text.secondary, textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700, marginBottom: 10 }}>
                    📊 Lezárt ügyletek ({closedPositions.length})
                  </div>
                  {closedPositions.map((cp, i) => (
                    <div key={cp.id || i} style={{ background: T.bg.inset, borderRadius: T.radius.md, padding: "12px", marginBottom: 8, border: `1px solid ${T.border.subtle}` }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                        <span style={{ fontSize: 11, color: T.text.tertiary }}>Lezárva: {cp.closeDate || "—"}</span>
                        <span style={{ fontSize: 14, fontWeight: 700, fontFamily: "'DM Mono',monospace", color: cp.pnl >= 0 ? T.accent.green : T.accent.red }}>
                          {cp.pnl >= 0 ? "+" : ""}{fmtNum(cp.pnl, 0)} HUF
                        </span>
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                        {[
                          ["Nyitás", `${cp.openDate} · $${fmtNum(cp.openUsdPrice, 2)}`],
                          ["Zárás",  `${cp.closeDate} · $${fmtNum(cp.closeUsdPrice, 2)}`],
                          ["Mennyiség", fmtNum(cp.volume, 4) + " db"],
                          ["Hozam", (cp.pnlPct >= 0 ? "+" : "") + fmtNum(cp.pnlPct, 2) + "%"],
                          ["Befizetve", fmtNum(cp.purchaseHuf, 0) + " HUF"],
                          ["Bevétel",   fmtNum(cp.saleHuf, 0) + " HUF"],
                        ].map(([l, v]) => (
                          <div key={l}>
                            <div style={{ fontSize: 9, color: T.text.tertiary, marginBottom: 2 }}>{l}</div>
                            <div style={{ fontSize: 12, color: T.text.secondary, fontFamily: "'DM Mono',monospace" }}>{v}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {inv.notes && (
                <div style={{ background: T.bg.inset, borderRadius: T.radius.md, padding: "10px 12px", fontSize: 12, color: T.text.secondary }}>
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
