import { useState, useEffect, useMemo } from "react";
import { calcPnL, fmtNum, fmtCurrency } from "../utils";
import { CATEGORY_COLORS, POSITION_PALETTE } from "../constants";
import { fetchOHLCV } from "./StockChart";

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
  const losers  = sorted.slice(-3).reverse();

  const Row = ({ inv, rank, isWinner }) => (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: "1px solid #21262D" }}>
      <div style={{ width: 20, fontSize: 16, textAlign: "center" }}>
        {rank === 0 ? "🥇" : rank === 1 ? "🥈" : "🥉"}
      </div>
      <div style={{ width: 32, height: 32, borderRadius: 8, background: CATEGORY_COLORS[inv.category] + "20", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <span style={{ fontSize: 9, fontWeight: 800, color: CATEGORY_COLORS[inv.category], fontFamily: "'DM Mono',monospace" }}>
          {(inv.ticker || inv.name).slice(0, 4)}
        </span>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "#E6EDF3", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{inv.name}</div>
        <div style={{ fontSize: 11, color: "#8B949E", fontFamily: "'DM Mono',monospace" }}>{fmtNum(inv.value, 0)} {inv.currency}</div>
      </div>
      <div style={{ textAlign: "right" }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: isWinner ? "#6EE7B7" : "#FCA5A5", fontFamily: "'DM Mono',monospace" }}>
          {isWinner ? "+" : ""}{fmtNum(inv.pct, 2)}%
        </div>
        <div style={{ fontSize: 11, color: "#8B949E", fontFamily: "'DM Mono',monospace" }}>
          {isWinner ? "+" : ""}{fmtNum(inv.abs, 0)}
        </div>
      </div>
    </div>
  );

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
      <div style={{ background: "#161B22", border: "1px solid #21262D", borderRadius: 12, padding: 16 }}>
        <div style={{ fontSize: 11, color: "#6EE7B7", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700, marginBottom: 12 }}>🏆 Top nyertesek</div>
        {winners.map((inv, i) => <Row key={inv.id} inv={inv} rank={i} isWinner />)}
      </div>
      <div style={{ background: "#161B22", border: "1px solid #21262D", borderRadius: 12, padding: 16 }}>
        <div style={{ fontSize: 11, color: "#FCA5A5", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700, marginBottom: 12 }}>📉 Top vesztesek</div>
        {losers.map((inv, i) => <Row key={inv.id} inv={inv} rank={i} isWinner={false} />)}
      </div>
    </div>
  );
}

// ─── CURRENCY EXPOSURE ────────────────────────────────────────────────────────
export function CurrencyExposure({ investments }) {
  const data = useMemo(() => {
    const total = investments.reduce((s, i) => s + i.currentPrice * i.quantity, 0);
    const byCurrency = {};
    investments.forEach(inv => {
      const v = inv.currentPrice * inv.quantity;
      byCurrency[inv.currency] = (byCurrency[inv.currency] || 0) + v;
    });
    const CURR_COLORS = { HUF: "#6EE7B7", USD: "#93C5FD", EUR: "#FDE68A", GBP: "#C4B5FD" };
    return Object.entries(byCurrency)
      .map(([cur, val]) => ({ cur, val, pct: total > 0 ? (val / total) * 100 : 0, color: CURR_COLORS[cur] || "#94A3B8" }))
      .sort((a, b) => b.val - a.val);
  }, [investments]);

  if (!data.length) return null;

  return (
    <div style={{ background: "#161B22", border: "1px solid #21262D", borderRadius: 12, padding: 16 }}>
      <div style={{ fontSize: 11, color: "#8B949E", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700, marginBottom: 14 }}>
        🌍 Deviza-kitettség
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {data.map(({ cur, val, pct, color }) => (
          <div key={cur}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color }}>
                {cur === "HUF" ? "🇭🇺" : cur === "USD" ? "🇺🇸" : cur === "EUR" ? "🇪🇺" : "🇬🇧"} {cur}
              </span>
              <div style={{ textAlign: "right" }}>
                <span style={{ fontSize: 13, fontFamily: "'DM Mono',monospace", color: "#E6EDF3" }}>{fmtNum(pct, 1)}%</span>
                <span style={{ fontSize: 11, color: "#8B949E", marginLeft: 8, fontFamily: "'DM Mono',monospace" }}>{fmtNum(val, 0)}</span>
              </div>
            </div>
            <div style={{ height: 6, background: "#21262D", borderRadius: 3 }}>
              <div style={{ width: `${pct}%`, height: 6, background: color, borderRadius: 3, transition: "width .5s ease" }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── BENCHMARK COMPARISON ─────────────────────────────────────────────────────
export function BenchmarkChart({ investments }) {
  const [benchData, setBenchData] = useState(null);
  const [range,     setRange]     = useState("1y");
  const [loading,   setLoading]   = useState(true);

  useEffect(() => {
    setLoading(true);
    fetchOHLCV("^GSPC", range)
      .then(setBenchData)
      .catch(() => setBenchData([]))
      .finally(() => setLoading(false));
  }, [range]);

  const portfolioReturn = useMemo(() => {
    const total    = investments.reduce((s, i) => s + i.currentPrice * i.quantity, 0);
    const invested = investments.reduce((s, i) => s + i.buyPrice * i.quantity, 0);
    return invested > 0 ? ((total - invested) / invested) * 100 : 0;
  }, [investments]);

  const benchReturn = useMemo(() => {
    if (!benchData?.length) return null;
    const first = benchData[0].close, last = benchData[benchData.length - 1].close;
    return ((last - first) / first) * 100;
  }, [benchData]);

  const W = 340, H = 120, PAD = { t: 10, r: 8, b: 20, l: 36 };

  const renderLine = (points, color, normalizeFirst) => {
    if (!points?.length) return null;
    const pcts  = points.map(p => ((p.close - normalizeFirst) / normalizeFirst) * 100);
    const allPcts = pcts;
    const minY  = Math.min(...allPcts, -5);
    const maxY  = Math.max(...allPcts, 5);
    const px    = i => PAD.l + (i / (points.length - 1)) * (W - PAD.l - PAD.r);
    const py    = v => PAD.t + (1 - (v - minY) / (maxY - minY)) * (H - PAD.t - PAD.b);
    const d     = pcts.map((v, i) => `${i === 0 ? "M" : "L"}${px(i).toFixed(1)},${py(v).toFixed(1)}`).join(" ");
    return { d, px, py, minY, maxY };
  };

  const benchLine = benchData?.length ? renderLine(benchData, "#93C5FD", benchData[0].close) : null;

  return (
    <div style={{ background: "#161B22", border: "1px solid #21262D", borderRadius: 12, padding: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <div style={{ fontSize: 11, color: "#8B949E", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700 }}>
          💹 Benchmark vs S&P 500
        </div>
        <div style={{ display: "flex", gap: 4 }}>
          {["3mo", "1y", "5y"].map(r => (
            <button key={r} onClick={() => setRange(r)} style={{
              background: range === r ? "#21262D" : "none",
              border: `1px solid ${range === r ? "#30363D" : "transparent"}`,
              borderRadius: 6, padding: "3px 8px", color: range === r ? "#E6EDF3" : "#8B949E",
              cursor: "pointer", fontSize: 11, fontFamily: "inherit",
            }}>{r}</button>
          ))}
        </div>
      </div>

      {/* Return comparison */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
        {[
          { label: "Portfóliód", val: portfolioReturn, color: portfolioReturn >= 0 ? "#6EE7B7" : "#FCA5A5" },
          { label: "S&P 500", val: benchReturn, color: benchReturn != null ? (benchReturn >= 0 ? "#93C5FD" : "#FCA5A5") : "#8B949E" },
        ].map(({ label, val, color }) => (
          <div key={label} style={{ background: "#0D1117", borderRadius: 8, padding: "10px 12px", textAlign: "center" }}>
            <div style={{ fontSize: 10, color: "#8B949E", textTransform: "uppercase", marginBottom: 6 }}>{label}</div>
            <div style={{ fontSize: 20, fontWeight: 800, color, fontFamily: "'DM Mono',monospace" }}>
              {val != null ? `${val >= 0 ? "+" : ""}${fmtNum(val, 2)}%` : "—"}
            </div>
          </div>
        ))}
      </div>

      {/* Chart */}
      {loading ? (
        <div style={{ height: 80, display: "flex", alignItems: "center", justifyContent: "center", color: "#8B949E", fontSize: 12 }}>Töltés...</div>
      ) : benchLine && (
        <>
          <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ display: "block" }}>
            {/* Zero line */}
            {(() => {
              const { minY, maxY } = benchLine;
              const zeroY = PAD.t + (1 - (0 - minY) / (maxY - minY)) * (H - PAD.t - PAD.b);
              return <line x1={PAD.l} y1={zeroY} x2={W - PAD.r} y2={zeroY} stroke="#30363D" strokeWidth="1" strokeDasharray="4,4" />;
            })()}
            {/* S&P 500 line */}
            <path d={benchLine.d} fill="none" stroke="#93C5FD" strokeWidth="1.5" strokeLinecap="round" opacity="0.8" />
            {/* Portfolio "bar" at end */}
            {(() => {
              const { minY, maxY } = benchLine;
              const py = v => PAD.t + (1 - (v - minY) / (maxY - minY)) * (H - PAD.t - PAD.b);
              const zeroY = py(0);
              const portY = py(portfolioReturn);
              const clr   = portfolioReturn >= 0 ? "#6EE7B7" : "#FCA5A5";
              return (
                <g>
                  <line x1={W - PAD.r - 2} y1={zeroY} x2={W - PAD.r - 2} y2={portY} stroke={clr} strokeWidth="3" strokeLinecap="round" />
                  <circle cx={W - PAD.r - 2} cy={portY} r="4" fill={clr} />
                </g>
              );
            })()}
          </svg>
          <div style={{ display: "flex", gap: 16, marginTop: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "#8B949E" }}>
              <div style={{ width: 16, height: 2, background: "#93C5FD", borderRadius: 2 }} /> S&P 500 ({range})
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "#8B949E" }}>
              <div style={{ width: 10, height: 10, borderRadius: "50%", background: portfolioReturn >= 0 ? "#6EE7B7" : "#FCA5A5" }} /> Portfóliód
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ─── VOLATILITY / RISK-RETURN ─────────────────────────────────────────────────
export function RiskReturn({ investments }) {
  const data = useMemo(() => {
    return investments
      .filter(i => i.currentPrice > 0 && i.buyPrice > 0)
      .map(i => {
        const { pct, value } = calcPnL(i);
        // Volatilitás proxy: ha nincs historikus adat, |pct| / time közelítés
        const days = i.buyDate
          ? Math.max(1, (Date.now() - new Date(i.buyDate)) / 86400000)
          : 365;
        const annualizedVol = Math.abs(pct) / Math.sqrt(days / 365) / 10;
        return { ...i, returnPct: pct, risk: Math.min(annualizedVol, 100), value };
      });
  }, [investments]);

  if (data.length < 2) return null;

  const maxRisk  = Math.max(...data.map(d => d.risk), 10);
  const minRet   = Math.min(...data.map(d => d.returnPct), -10);
  const maxRet   = Math.max(...data.map(d => d.returnPct), 10);
  const W = 320, H = 180, PAD = 36;
  const maxVal = Math.max(...data.map(d => d.value));

  const px = r => PAD + (r / maxRisk) * (W - 2 * PAD);
  const py = r => PAD + (1 - (r - minRet) / (maxRet - minRet)) * (H - 2 * PAD);

  return (
    <div style={{ background: "#161B22", border: "1px solid #21262D", borderRadius: 12, padding: 16 }}>
      <div style={{ fontSize: 11, color: "#8B949E", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700, marginBottom: 4 }}>
        ⚖️ Kockázat–Hozam
      </div>
      <div style={{ fontSize: 11, color: "#8B949E", marginBottom: 12 }}>
        Buborék mérete = pozíció értéke · Y tengely = hozam · X tengely = becsült kockázat
      </div>
      <svg width="100%" viewBox={`0 0 ${W} ${H}`}>
        {/* Grid */}
        <line x1={PAD} y1={py(0)} x2={W - PAD} y2={py(0)} stroke="#30363D" strokeWidth="1" strokeDasharray="4,4" />
        <line x1={px(0)} y1={PAD} x2={px(0)} y2={H - PAD} stroke="#30363D" strokeWidth="1" strokeDasharray="4,4" />
        {/* Axis labels */}
        <text x={W / 2} y={H - 4}  fill="#8B949E" fontSize="8" textAnchor="middle">Kockázat →</text>
        <text x={8}    y={H / 2}   fill="#8B949E" fontSize="8" textAnchor="middle" transform={`rotate(-90,8,${H/2})`}>Hozam</text>
        {/* Bubbles */}
        {data.map((d, i) => {
          const r   = 4 + (d.value / maxVal) * 16;
          const clr = POSITION_PALETTE[i % POSITION_PALETTE.length];
          const ret = d.returnPct >= 0 ? "#6EE7B7" : "#FCA5A5";
          return (
            <g key={d.id}>
              <circle cx={px(d.risk)} cy={py(d.returnPct)} r={r} fill={clr} fillOpacity="0.35" stroke={clr} strokeWidth="1.5">
                <title>{d.name}: {fmtNum(d.returnPct, 2)}% hozam, {fmtNum(d.risk, 1)} kockázat</title>
              </circle>
              <text x={px(d.risk)} y={py(d.returnPct) + 3.5} fill="#E6EDF3" fontSize="7" textAnchor="middle" fontFamily="'DM Mono',monospace">
                {(d.ticker || d.name).slice(0, 5)}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
