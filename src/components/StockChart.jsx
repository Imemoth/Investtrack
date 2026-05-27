import { useState, useEffect, useRef } from "react";

const CHART_PROXIES = [
  url => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
  url => `https://corsproxy.io/?url=${encodeURIComponent(url)}`,
  url => `https://thingproxy.freeboard.io/fetch/${url}`,
];

export async function fetchOHLCV(ticker, range) {
  const interval = range === "1mo" || range === "3mo" ? "1d" : "1wk";
  let lastError;
  for (const host of ["query1", "query2"]) {
    const yahooUrl = `https://${host}.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?range=${range}&interval=${interval}`;
    for (const proxyFn of CHART_PROXIES) {
      try {
        const res  = await fetch(proxyFn(yahooUrl), { signal: AbortSignal.timeout(10000) });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const text = await res.text();
        if (text.trim().startsWith("<")) throw new Error("HTML proxy hiba");
        const json   = JSON.parse(text);
        const result = json?.chart?.result?.[0];
        if (!result) throw new Error("Üres result");
        const q      = result.indicators?.quote?.[0] || {};
        const times  = result.timestamp || [];
        const points = times.map((t, i) => ({
          t:      new Date(t * 1000),
          open:   q.open?.[i],
          high:   q.high?.[i],
          low:    q.low?.[i],
          close:  q.close?.[i],
          volume: q.volume?.[i],
        })).filter(p => p.close != null);
        if (!points.length) throw new Error("Nincs adatpont");
        return points;
      } catch (e) { lastError = e; }
    }
  }
  throw lastError;
}

// ─── TOOLTIP ──────────────────────────────────────────────────────────────────
function Tooltip({ x, y, data, W, color }) {
  if (!data) return null;
  const flip  = x > W * 0.65;
  const tx    = flip ? x - 138 : x + 12;
  return (
    <g>
      <line x1={x} y1={0} x2={x} y2="80%" stroke="#30363D" strokeWidth="1" strokeDasharray="3,3" />
      <foreignObject x={tx} y={Math.max(4, y - 50)} width="130" height="110">
        <div style={{ background: "#1C2128", border: "1px solid #30363D", borderRadius: 8, padding: "8px 10px", fontSize: 11, fontFamily: "'DM Mono', monospace", color: "#E6EDF3" }}>
          <div style={{ color: "#8B949E", marginBottom: 4 }}>{data.t.toLocaleDateString("hu-HU")}</div>
          {data.open  != null && <div>O: <span style={{ color }}>{data.open.toFixed(2)}</span></div>}
          {data.high  != null && <div>H: <span style={{ color: "#6EE7B7" }}>{data.high.toFixed(2)}</span></div>}
          {data.low   != null && <div>L: <span style={{ color: "#FCA5A5" }}>{data.low.toFixed(2)}</span></div>}
          <div>C: <span style={{ color, fontWeight: 700 }}>{data.close.toFixed(2)}</span></div>
        </div>
      </foreignObject>
    </g>
  );
}

// ─── STOCK CHART ──────────────────────────────────────────────────────────────
export function StockChart({ ticker, currency }) {
  const [data,     setData]     = useState(null);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState(null);
  const [range,    setRange]    = useState("3mo");
  const [mode,     setMode]     = useState("area");   // "area" | "candle"
  const [hover,    setHover]    = useState(null);
  const svgRef = useRef(null);

  useEffect(() => {
    if (!ticker) return;
    setLoading(true); setError(null); setData(null); setHover(null);
    fetchOHLCV(ticker, range)
      .then(setData)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [ticker, range]);

  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 220, color: "#8B949E", fontSize: 13 }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 24, marginBottom: 8 }}>⏳</div>
        Grafikon betöltése...
      </div>
    </div>
  );
  if (error || !data?.length) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 220, color: "#FCA5A5", fontSize: 13 }}>
      Grafikon nem elérhető
    </div>
  );

  const W = 360, H = 160, VH = 36, PAD = { t: 8, r: 8, b: 4, l: 44 };
  const cw  = Math.max(2, (W - PAD.l - PAD.r) / data.length - 1);
  const closes  = data.map(p => p.close);
  const highs   = data.map(p => p.high  ?? p.close);
  const lows    = data.map(p => p.low   ?? p.close);
  const volumes = data.map(p => p.volume ?? 0);
  const minP = Math.min(...lows)   * 0.998;
  const maxP = Math.max(...highs)  * 1.002;
  const maxV = Math.max(...volumes) || 1;
  const first = closes[0], last = closes[closes.length - 1];
  const up    = last >= first;
  const color = up ? "#6EE7B7" : "#FCA5A5";

  const px = i => PAD.l + (i + 0.5) * ((W - PAD.l - PAD.r) / data.length);
  const py = v => PAD.t + (1 - (v - minP) / (maxP - minP)) * (H - PAD.t - PAD.b);
  const pv = v => VH - (v / maxV) * VH * 0.9;

  const areaPath = data.map((p, i) => `${i === 0 ? "M" : "L"}${px(i).toFixed(1)},${py(p.close).toFixed(1)}`).join(" ");
  const areaFill = `${areaPath} L${px(data.length - 1)},${H - PAD.b} L${px(0)},${H - PAD.b} Z`;

  // Y-axis labels
  const yTicks = 4;
  const yLabels = Array.from({ length: yTicks + 1 }, (_, i) => {
    const v = minP + (i / yTicks) * (maxP - minP);
    return { v, y: py(v) };
  });

  const handleMouseMove = e => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;
    const mx    = (e.clientX - rect.left) * (W / rect.width);
    const idx   = Math.round((mx - PAD.l) / ((W - PAD.l - PAD.r) / data.length) - 0.5);
    const clamped = Math.max(0, Math.min(data.length - 1, idx));
    setHover({ idx: clamped, x: px(clamped), y: py(data[clamped].close), data: data[clamped] });
  };

  const pct   = ((last - first) / first * 100).toFixed(2);
  const shown = hover ? hover.data : data[data.length - 1];
  const shownPct = hover
    ? ((shown.close - first) / first * 100).toFixed(2)
    : pct;

  return (
    <div>
      {/* Header row */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
        <div>
          <span style={{ fontSize: 24, fontWeight: 800, color: "#E6EDF3", fontFamily: "'DM Mono', monospace" }}>
            {shown.close.toFixed(2)}
          </span>
          <span style={{ fontSize: 12, color: "#8B949E", marginLeft: 6 }}>{currency}</span>
          <span style={{ marginLeft: 10, fontSize: 13, color: +shownPct >= 0 ? "#6EE7B7" : "#FCA5A5", fontWeight: 700 }}>
            {+shownPct >= 0 ? "+" : ""}{shownPct}%
          </span>
        </div>
        <div style={{ display: "flex", gap: 4 }}>
          {/* Mode toggle */}
          <div style={{ display: "flex", background: "#0D1117", borderRadius: 6, padding: 2, gap: 2, marginRight: 4 }}>
            {[["area", "📈"], ["candle", "🕯"]].map(([m, icon]) => (
              <button key={m} onClick={() => setMode(m)} style={{
                background: mode === m ? "#21262D" : "none", border: "none", borderRadius: 5,
                padding: "3px 8px", cursor: "pointer", fontSize: 13, lineHeight: 1,
              }}>{icon}</button>
            ))}
          </div>
          {/* Range */}
          {["1mo", "3mo", "1y", "5y"].map(r => (
            <button key={r} onClick={() => setRange(r)} style={{
              background: range === r ? "#21262D" : "none",
              border: `1px solid ${range === r ? "#30363D" : "transparent"}`,
              borderRadius: 6, padding: "3px 8px", color: range === r ? "#E6EDF3" : "#8B949E",
              cursor: "pointer", fontSize: 11, fontFamily: "inherit",
            }}>{r}</button>
          ))}
        </div>
      </div>

      {/* Main SVG */}
      <svg
        ref={svgRef}
        width="100%" viewBox={`0 0 ${W} ${H + VH + 8}`}
        style={{ display: "block", cursor: "crosshair" }}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setHover(null)}
        onTouchMove={e => { e.preventDefault(); handleMouseMove(e.touches[0]); }}
      >
        <defs>
          <linearGradient id={`ag_${ticker}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor={color} stopOpacity="0.25" />
            <stop offset="100%" stopColor={color} stopOpacity="0"    />
          </linearGradient>
        </defs>

        {/* Y-axis grid + labels */}
        {yLabels.map(({ v, y }, i) => (
          <g key={i}>
            <line x1={PAD.l} y1={y} x2={W - PAD.r} y2={y} stroke="#21262D" strokeWidth="1" />
            <text x={PAD.l - 4} y={y + 3.5} fill="#8B949E" fontSize="8" textAnchor="end" fontFamily="monospace">
              {v >= 1000 ? (v / 1000).toFixed(1) + "k" : v.toFixed(v < 10 ? 2 : 0)}
            </text>
          </g>
        ))}

        {mode === "area" ? (
          <>
            <path d={areaFill} fill={`url(#ag_${ticker})`} />
            <path d={areaPath} fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
          </>
        ) : (
          // Candlesticks
          data.map((p, i) => {
            const x   = px(i);
            const o   = py(p.open  ?? p.close);
            const c   = py(p.close);
            const h   = py(p.high  ?? p.close);
            const l   = py(p.low   ?? p.close);
            const bull = p.close >= (p.open ?? p.close);
            const cc  = bull ? "#6EE7B7" : "#FCA5A5";
            const hw  = Math.max(1, cw * 0.7);
            return (
              <g key={i}>
                <line x1={x} y1={h} x2={x} y2={l} stroke={cc} strokeWidth="1" />
                <rect
                  x={x - hw / 2} y={Math.min(o, c)}
                  width={hw} height={Math.max(1, Math.abs(o - c))}
                  fill={bull ? cc : cc} fillOpacity={bull ? 0.8 : 1}
                  stroke={cc} strokeWidth="0.5"
                />
              </g>
            );
          })
        )}

        {/* Hover line */}
        {hover && <Tooltip x={hover.x} y={hover.y} data={hover.data} W={W} color={color} />}

        {/* Volume bars */}
        <g transform={`translate(0, ${H + 4})`}>
          {data.map((p, i) => {
            const bull = p.close >= (p.open ?? p.close);
            return (
              <rect key={i}
                x={px(i) - cw / 2} y={pv(p.volume ?? 0)}
                width={Math.max(1, cw)} height={VH - pv(p.volume ?? 0)}
                fill={bull ? "#6EE7B7" : "#FCA5A5"} fillOpacity="0.35"
              />
            );
          })}
          <text x={PAD.l - 4} y={4} fill="#8B949E" fontSize="7" textAnchor="end" fontFamily="monospace">VOL</text>
        </g>
      </svg>
    </div>
  );
}
