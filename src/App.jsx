import { useState, useEffect, useCallback, useMemo } from "react";

// ─── CONSTANTS ────────────────────────────────────────────────────────────────
const STORAGE_KEY = "investtrack_v1";
const CATEGORIES = ["Részvény", "ETF", "Kötvény", "Kriptó", "Árupiaci", "Ingatlan", "Egyéb"];
const CURRENCIES = ["HUF", "EUR", "USD", "GBP"];

const CATEGORY_COLORS = {
  "Részvény": "#6EE7B7",
  "ETF": "#93C5FD",
  "Kötvény": "#FDE68A",
  "Kriptó": "#F9A8D4",
  "Árupiaci": "#FCA5A5",
  "Ingatlan": "#C4B5FD",
  "Egyéb": "#94A3B8",
};

const EMPTY_FORM = {
  name: "", ticker: "", category: "Részvény",
  buyPrice: "", quantity: "", currentPrice: "",
  currency: "HUF", buyDate: "", notes: "",
};

// ─── IN-APP LOGGER ────────────────────────────────────────────────────────────
// Telefonon nincs DevTools, ezért az appban tároljuk a logokat
const appLog = {
  _entries: [],
  _listeners: [],
  subscribe(fn) { this._listeners.push(fn); return () => { this._listeners = this._listeners.filter(l => l !== fn); }; },
  _emit() { this._listeners.forEach(fn => fn([...this._entries])); },
  push(level, msg, detail = "") {
    const entry = { time: new Date().toLocaleTimeString("hu-HU"), level, msg, detail };
    this._entries.unshift(entry); // legújabb felül
    if (this._entries.length > 100) this._entries.pop();
    this._emit();
    // Eredeti console is
    if (level === "error") console.error(msg, detail);
    else if (level === "warn") console.warn(msg, detail);
    else console.log(msg, detail);
  },
  info:  function(msg, detail) { this.push("info", msg, detail); },
  warn:  function(msg, detail) { this.push("warn", msg, detail); },
  error: function(msg, detail) { this.push("error", msg, detail); },
  clear() { this._entries = []; this._emit(); },
};

// ─── LOG MODAL ────────────────────────────────────────────────────────────────
function LogModal({ onClose }) {
  const [entries, setEntries] = useState([...appLog._entries]);
  useEffect(() => appLog.subscribe(setEntries), []);

  const colors = { info: "#93C5FD", warn: "#FDE68A", error: "#FCA5A5" };
  const icons  = { info: "ℹ️", warn: "⚠️", error: "❌" };

  const copyAll = () => {
    const text = entries.map(e => `[${e.time}] [${e.level.toUpperCase()}] ${e.msg}${e.detail ? " | " + String(e.detail) : ""}`).join("\n");
    navigator.clipboard?.writeText(text).then(() => alert("Log vágólapra másolva!")).catch(() => alert(text));
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.8)", backdropFilter: "blur(4px)", zIndex: 60, display: "flex", alignItems: "flex-end" }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ background: "#0D1117", border: "1px solid #30363D", borderRadius: "16px 16px 0 0", width: "100%", maxHeight: "80vh", display: "flex", flexDirection: "column" }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 20px", borderBottom: "1px solid #21262D", flexShrink: 0 }}>
          <span style={{ fontWeight: 700, color: "#E6EDF3", fontSize: 16 }}>🪲 Debug Log</span>
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={copyAll}
              style={{ background: "#21262D", border: "none", borderRadius: 6, padding: "6px 12px", color: "#C9D1D9", cursor: "pointer", fontSize: 12, fontFamily: "inherit" }}>
              📋 Másolás
            </button>
            <button onClick={() => { appLog.clear(); }}
              style={{ background: "#21262D", border: "none", borderRadius: 6, padding: "6px 12px", color: "#C9D1D9", cursor: "pointer", fontSize: 12, fontFamily: "inherit" }}>
              🗑️ Törlés
            </button>
            <button onClick={onClose}
              style={{ background: "none", border: "none", color: "#8B949E", cursor: "pointer", fontSize: 22, lineHeight: 1 }}>×</button>
          </div>
        </div>
        {/* Log entries */}
        <div style={{ overflowY: "auto", flex: 1, padding: "12px 16px" }}>
          {entries.length === 0 ? (
            <div style={{ textAlign: "center", color: "#8B949E", padding: "40px 0", fontSize: 13 }}>
              Még nincs log bejegyzés.<br />Nyomj a 🔄 Árfolyam gombra!
            </div>
          ) : entries.map((e, i) => (
            <div key={i} style={{ borderBottom: "1px solid #21262D", padding: "8px 0", fontSize: 12, fontFamily: "'DM Mono', monospace" }}>
              <div style={{ display: "flex", gap: 8, alignItems: "baseline" }}>
                <span style={{ color: "#8B949E", flexShrink: 0 }}>{e.time}</span>
                <span style={{ color: colors[e.level], flexShrink: 0 }}>{icons[e.level]} {e.level.toUpperCase()}</span>
                <span style={{ color: "#E6EDF3", wordBreak: "break-all" }}>{e.msg}</span>
              </div>
              {e.detail && (
                <div style={{ color: "#8B949E", marginTop: 3, paddingLeft: 16, wordBreak: "break-all", whiteSpace: "pre-wrap" }}>
                  {typeof e.detail === "object" ? JSON.stringify(e.detail, null, 2) : String(e.detail)}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}


// Több CORS proxy fallback – ha az egyik nem válaszol, a következőt próbálja
const CORS_PROXIES = [
  (url) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
  (url) => `https://corsproxy.io/?url=${encodeURIComponent(url)}`,
  (url) => `https://thingproxy.freeboard.io/fetch/${url}`,
];

async function fetchWithProxyFallback(yahooUrl) {
  let lastError;
  for (const proxyFn of CORS_PROXIES) {
    const proxyUrl = proxyFn(yahooUrl);
    appLog.info(`Proxy próba: ${proxyUrl.slice(0, 60)}...`);
    try {
      const res = await fetch(proxyUrl, {
        signal: AbortSignal.timeout(9000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
      if (text.trim().startsWith("<")) throw new Error("HTML válasz – proxy hiba");
      appLog.info(`✓ Siker: ${proxyUrl.slice(0, 40)}...`);
      return JSON.parse(text);
    } catch (e) {
      appLog.warn(`✗ Proxy hiba`, `${proxyUrl.slice(0, 50)} → ${e.message}`);
      lastError = e;
      await new Promise(r => setTimeout(r, 200));
    }
  }
  throw lastError;
}

async function fetchYahooPrice(ticker) {
  const hosts = ["query1", "query2"];
  let lastError;
  for (const host of hosts) {
    try {
      const yahooUrl = `https://${host}.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?range=1d&interval=1d&includePrePost=false`;
      appLog.info(`Yahoo lekérés: ${ticker} (${host})`);
      const data = await fetchWithProxyFallback(yahooUrl);
      const meta = data?.chart?.result?.[0]?.meta;
      if (!meta) throw new Error("Üres chart result");
      const price = meta.regularMarketPrice ?? meta.chartPreviousClose;
      if (!price) throw new Error(`Nincs ár a válaszban (meta: ${JSON.stringify(meta).slice(0,100)})`);
      appLog.info(`✓ ${ticker} = ${price} ${meta.currency}`);
      return { price, currency: meta.currency, exchange: meta.exchangeName };
    } catch (e) {
      appLog.error(`✗ ${ticker} (${host}) sikertelen`, e.message);
      lastError = e;
    }
  }
  throw lastError;
}

// Devizaárfolyamok lekérése Yahoo-tól (USD→HUF, EUR→HUF)
async function fetchFxRates() {
  const pairs = ["USDHUF=X", "EURHUF=X", "GBPHUF=X"];
  const rates = { USD: 1, EUR: 1, GBP: 1, HUF: 1 };
  for (const pair of pairs) {
    try {
      const data = await fetchYahooPrice(pair);
      const currency = pair.replace("HUF=X", "");
      rates[currency] = data.price;
      appLog.info(`✓ ${currency}/HUF = ${data.price}`);
    } catch (e) {
      appLog.warn(`✗ FX lekérés sikertelen: ${pair}`, e.message);
    }
    await new Promise(r => setTimeout(r, 300));
  }
  return rates;
}

async function refreshAllPrices(investments, onProgress) {
  const withTicker = investments.filter(i => i.ticker?.trim());
  const results = new Map(); // ticker → { priceInOrigCurrency, priceInInvCurrency }
  const errors = [];

  // 1. Devizaárfolyamok lekérése először
  onProgress?.("Devizaárfolyamok...");
  const fxRates = await fetchFxRates();
  appLog.info(`FX rates: USD=${fxRates.USD}, EUR=${fxRates.EUR}`);

  // 2. Részvényárak lekérése
  for (let i = 0; i < withTicker.length; i++) {
    const inv = withTicker[i];
    onProgress?.(`${inv.ticker} (${i + 1}/${withTicker.length})`);
    try {
      const data = await fetchYahooPrice(inv.ticker);
      // Az ár Yahoo devizájában jön (USD, EUR, stb.)
      // Ha a befektetés HUF-ban van nyilvántartva, váltjuk át
      let finalPrice = data.price;
      if (inv.currency === "HUF" && data.currency && data.currency !== "HUF") {
        const rate = fxRates[data.currency] || 1;
        finalPrice = data.price * rate;
        appLog.info(`✓ ${inv.ticker}: ${data.price} ${data.currency} × ${rate} = ${finalPrice.toFixed(0)} HUF`);
      }
      results.set(inv.ticker.toUpperCase(), finalPrice);
    } catch (e) {
      appLog.warn(`[PriceRefresh] ${inv.ticker} hiba:`, e.message);
      errors.push(inv.ticker);
    }
    if (i < withTicker.length - 1) await new Promise(r => setTimeout(r, 400));
  }
  return { results, errors };
}

// ─── UTILS ────────────────────────────────────────────────────────────────────
function fmtNum(n, dec = 2) {
  if (n === null || n === undefined || isNaN(n)) return "—";
  return new Intl.NumberFormat("hu-HU", { minimumFractionDigits: dec, maximumFractionDigits: dec }).format(n);
}
function fmtCurrency(n, currency = "HUF") {
  if (n === null || isNaN(n)) return "—";
  return new Intl.NumberFormat("hu-HU", { style: "currency", currency, maximumFractionDigits: 0 }).format(n);
}
function calcPnL(inv) {
  const cost = inv.buyPrice * inv.quantity;
  const value = inv.currentPrice * inv.quantity;
  const abs = value - cost;
  const pct = cost > 0 ? (abs / cost) * 100 : 0;
  return { cost, value, abs, pct };
}
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2); }

// ─── CSV HELPERS ──────────────────────────────────────────────────────────────
function exportCSV(investments) {
  const header = ["Név","Ticker","Kategória","Vétel ár","Darab","Jelenlegi ár","Deviza","Vétel dátum","Megjegyzés"];
  const rows = investments.map(inv => [
    inv.name, inv.ticker, inv.category,
    inv.buyPrice, inv.quantity, inv.currentPrice,
    inv.currency, inv.buyDate, inv.notes
  ]);
  const csv = [header, ...rows].map(r => r.map(c => `"${String(c ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = `befektetes_${new Date().toISOString().slice(0,10)}.csv`; a.click();
  URL.revokeObjectURL(url);
}

function parseCSV(text) {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) throw new Error("Üres CSV fájl");
  const rows = lines.slice(1).map(line => {
    const cols = [];
    let cur = "", inQ = false;
    for (let i = 0; i < line.length; i++) {
      if (line[i] === '"') { inQ = !inQ; continue; }
      if (line[i] === "," && !inQ) { cols.push(cur); cur = ""; continue; }
      cur += line[i];
    }
    cols.push(cur);
    return cols;
  });
  return rows.map(r => ({
    id: uid(), name: r[0] || "", ticker: r[1] || "",
    category: CATEGORIES.includes(r[2]) ? r[2] : "Egyéb",
    buyPrice: parseFloat(r[3]) || 0, quantity: parseFloat(r[4]) || 0,
    currentPrice: parseFloat(r[5]) || 0,
    currency: CURRENCIES.includes(r[6]) ? r[6] : "HUF",
    buyDate: r[7] || "", notes: r[8] || "",
  })).filter(r => r.name);
}

// ─── DONUT CHART ──────────────────────────────────────────────────────────────
function DonutChart({ data, size = 180 }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  if (total === 0) return null;
  let angle = -90;
  const cx = size / 2, cy = size / 2, r = size * 0.36, ri = size * 0.22;
  const segments = data.map(d => {
    const sweep = (d.value / total) * 360;
    const start = angle; angle += sweep;
    const toRad = a => (a * Math.PI) / 180;
    const x1 = cx + r * Math.cos(toRad(start)), y1 = cy + r * Math.sin(toRad(start));
    const x2 = cx + r * Math.cos(toRad(start + sweep)), y2 = cy + r * Math.sin(toRad(start + sweep));
    const xi1 = cx + ri * Math.cos(toRad(start + sweep)), yi1 = cy + ri * Math.sin(toRad(start + sweep));
    const xi2 = cx + ri * Math.cos(toRad(start)), yi2 = cy + ri * Math.sin(toRad(start));
    const large = sweep > 180 ? 1 : 0;
    return { ...d, path: `M${x1},${y1} A${r},${r},0,${large},1,${x2},${y2} L${xi1},${yi1} A${ri},${ri},0,${large},0,${xi2},${yi2} Z` };
  });
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {segments.map((s, i) => (
        <path key={i} d={s.path} fill={s.color} opacity="0.9">
          <title>{s.label}: {fmtNum(s.pct, 1)}%</title>
        </path>
      ))}
    </svg>
  );
}

// ─── SPARKLINE ────────────────────────────────────────────────────────────────
function Sparkline({ pct }) {
  const up = pct >= 0;
  const points = Array.from({ length: 12 }, (_, i) => {
    const noise = (Math.sin(i * 2.1 + pct) + Math.cos(i * 1.3)) * 6;
    return { x: i * 10, y: 30 - (i / 11) * pct * 0.4 + noise };
  });
  const d = points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ");
  return (
    <svg width="110" height="36" viewBox="0 0 110 36">
      <polyline points={points.map(p => `${p.x},${p.y}`).join(" ")}
        fill="none" stroke={up ? "#6EE7B7" : "#FCA5A5"} strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

// ─── MODAL ────────────────────────────────────────────────────────────────────
function Modal({ title, onClose, children }) {
  useEffect(() => {
    const h = e => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.7)", backdropFilter: "blur(4px)", zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", padding: "16px" }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ background: "#161B22", border: "1px solid #30363D", borderRadius: 16, width: "100%", maxWidth: 560, maxHeight: "90vh", overflow: "auto", boxShadow: "0 24px 64px rgba(0,0,0,.6)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "20px 24px 0", marginBottom: 20 }}>
          <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 18, fontWeight: 700, color: "#E6EDF3" }}>{title}</span>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#8B949E", cursor: "pointer", fontSize: 22, lineHeight: 1, padding: "0 4px" }}>×</button>
        </div>
        <div style={{ padding: "0 24px 24px" }}>{children}</div>
      </div>
    </div>
  );
}

// ─── INVESTMENT FORM ──────────────────────────────────────────────────────────
function InvestmentForm({ initial, onSave, onCancel }) {
  const [form, setForm] = useState(initial || EMPTY_FORM);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const inputStyle = { width: "100%", background: "#0D1117", border: "1px solid #30363D", borderRadius: 8, padding: "10px 12px", color: "#E6EDF3", fontSize: 14, fontFamily: "inherit", outline: "none", boxSizing: "border-box" };
  const labelStyle = { display: "block", fontSize: 12, color: "#8B949E", marginBottom: 6, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" };
  const grid2 = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={grid2}>
        <div><label style={labelStyle}>Megnevezés *</label><input style={inputStyle} value={form.name} onChange={e => set("name", e.target.value)} placeholder="pl. Apple Inc." /></div>
        <div><label style={labelStyle}>Ticker</label><input style={inputStyle} value={form.ticker} onChange={e => set("ticker", e.target.value.toUpperCase())} placeholder="pl. AAPL" /></div>
      </div>
      <div style={grid2}>
        <div><label style={labelStyle}>Kategória</label>
          <select style={inputStyle} value={form.category} onChange={e => set("category", e.target.value)}>
            {CATEGORIES.map(c => <option key={c}>{c}</option>)}
          </select>
        </div>
        <div><label style={labelStyle}>Deviza</label>
          <select style={inputStyle} value={form.currency} onChange={e => set("currency", e.target.value)}>
            {CURRENCIES.map(c => <option key={c}>{c}</option>)}
          </select>
        </div>
      </div>
      <div style={grid2}>
        <div><label style={labelStyle}>Vételi ár</label><input style={inputStyle} type="number" value={form.buyPrice} onChange={e => set("buyPrice", e.target.value)} placeholder="0" /></div>
        <div><label style={labelStyle}>Darabszám</label><input style={inputStyle} type="number" value={form.quantity} onChange={e => set("quantity", e.target.value)} placeholder="0" /></div>
      </div>
      <div style={grid2}>
        <div><label style={labelStyle}>Jelenlegi ár</label><input style={inputStyle} type="number" value={form.currentPrice} onChange={e => set("currentPrice", e.target.value)} placeholder="0" /></div>
        <div><label style={labelStyle}>Vétel dátuma</label><input style={{ ...inputStyle, colorScheme: "dark" }} type="date" value={form.buyDate} onChange={e => set("buyDate", e.target.value)} /></div>
      </div>
      <div><label style={labelStyle}>Megjegyzés</label><textarea style={{ ...inputStyle, resize: "vertical", minHeight: 60 }} value={form.notes} onChange={e => set("notes", e.target.value)} placeholder="Opcionális..." /></div>
      <div style={{ display: "flex", gap: 12, justifyContent: "flex-end", marginTop: 4 }}>
        <button onClick={onCancel} style={{ background: "none", border: "1px solid #30363D", borderRadius: 8, padding: "10px 20px", color: "#8B949E", cursor: "pointer", fontSize: 14, fontFamily: "inherit" }}>Mégsem</button>
        <button onClick={() => { if (!form.name.trim()) return alert("Adj meg megnevezést!"); onSave({ ...form, id: form.id || uid(), buyPrice: +form.buyPrice, quantity: +form.quantity, currentPrice: +form.currentPrice }); }}
          style={{ background: "linear-gradient(135deg, #238636, #2EA043)", border: "none", borderRadius: 8, padding: "10px 24px", color: "#fff", cursor: "pointer", fontSize: 14, fontWeight: 700, fontFamily: "inherit" }}>
          {initial ? "Mentés" : "+ Hozzáadás"}
        </button>
      </div>
    </div>
  );
}

// ─── MAIN APP ─────────────────────────────────────────────────────────────────
export default function App() {
  const [investments, setInvestments] = useState(() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"); } catch { return []; }
  });
  const [modal, setModal] = useState(null); // null | "add" | "edit" | "import"
  const [editing, setEditing] = useState(null);
  const [search, setSearch] = useState("");
  const [filterCat, setFilterCat] = useState("Összes");
  const [sortBy, setSortBy] = useState("name");
  const [sortDir, setSortDir] = useState("asc");
  const [toast, setToast] = useState(null);
  const [importText, setImportText] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshProgress, setRefreshProgress] = useState(null);
  const [showLog, setShowLog] = useState(false);
  const [chartMode, setChartMode] = useState("category"); // "category" | "position"

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(investments));
  }, [investments]);

  const showToast = (msg, type = "success") => {
    setToast({ msg, type }); setTimeout(() => setToast(null), 4000);
  };

  const handleRefresh = async () => {
    if (refreshing) return;
    const withTicker = investments.filter(i => i.ticker?.trim());
    if (withTicker.length === 0) { showToast("Nincs ticker – add meg a részvény szimbólumokat!", "error"); return; }
    setRefreshing(true);
    setRefreshProgress(`Csatlakozás...`);
    try {
      const { results, errors } = await refreshAllPrices(investments, setRefreshProgress);
      if (results.size === 0) {
        showToast("❌ Minden lekérés sikertelen – CORS proxy nem elérhető. Próbáld később!", "error");
        return;
      }
      setInvestments(prev => prev.map(inv => {
        const newPrice = results.get(inv.ticker?.toUpperCase());
        return newPrice !== undefined ? { ...inv, currentPrice: newPrice } : inv;
      }));
      const ok = results.size, fail = errors.length;
      showToast(fail > 0
        ? `⚠️ ${ok} frissítve, ${fail} sikertelen: ${errors.join(", ")}`
        : `✓ ${ok} árfolyam frissítve!`, fail > 0 ? "info" : "success");
    } catch (e) {
      showToast(`❌ Frissítés sikertelen: ${e.message}`, "error");
    } finally {
      setRefreshing(false);
      setRefreshProgress(null);
    }
  };

  const saveInvestment = useCallback(inv => {
    setInvestments(prev => {
      const idx = prev.findIndex(i => i.id === inv.id);
      if (idx >= 0) { const next = [...prev]; next[idx] = inv; return next; }
      return [...prev, inv];
    });
    setModal(null); setEditing(null);
    showToast(editing ? "Befektetés frissítve!" : "Befektetés hozzáadva!");
  }, [editing]);

  // ── Stats ────
  const stats = useMemo(() => {
    const totalCost = investments.reduce((s, i) => s + i.buyPrice * i.quantity, 0);
    const totalValue = investments.reduce((s, i) => s + i.currentPrice * i.quantity, 0);
    const totalPnL = totalValue - totalCost;
    const totalPct = totalCost > 0 ? (totalPnL / totalCost) * 100 : 0;
    const catBreakdown = CATEGORIES.map(c => {
      const v = investments.filter(i => i.category === c).reduce((s, i) => s + i.currentPrice * i.quantity, 0);
      return { label: c, value: v, pct: totalValue > 0 ? (v / totalValue) * 100 : 0, color: CATEGORY_COLORS[c] };
    }).filter(d => d.value > 0);

    // Pozíció szerinti breakdown – minden részvény egyedi szín
    const POSITION_PALETTE = [
      "#6EE7B7","#93C5FD","#FDE68A","#F9A8D4","#FCA5A5","#C4B5FD","#6EE7F7",
      "#86EFAC","#FCD34D","#FDA4AF","#A5B4FC","#67E8F9","#BEF264","#FDBA74",
    ];
    const posBreakdown = [...investments]
      .map((inv, idx) => {
        const v = inv.currentPrice * inv.quantity;
        return {
          label: inv.ticker || inv.name,
          fullName: inv.name,
          value: v,
          pct: totalValue > 0 ? (v / totalValue) * 100 : 0,
          color: POSITION_PALETTE[idx % POSITION_PALETTE.length],
        };
      })
      .filter(d => d.value > 0)
      .sort((a, b) => b.value - a.value);

    return { totalCost, totalValue, totalPnL, totalPct, catBreakdown, posBreakdown };
  }, [investments]);

  // ── Filtered & sorted ────
  const displayed = useMemo(() => {
    let list = investments.filter(i => {
      const q = search.toLowerCase();
      return (!q || i.name.toLowerCase().includes(q) || i.ticker.toLowerCase().includes(q)) &&
        (filterCat === "Összes" || i.category === filterCat);
    });
    list = [...list].sort((a, b) => {
      let va, vb;
      if (sortBy === "name") { va = a.name; vb = b.name; }
      else if (sortBy === "value") { va = a.currentPrice * a.quantity; vb = b.currentPrice * b.quantity; }
      else if (sortBy === "pnl") { va = calcPnL(a).pct; vb = calcPnL(b).pct; }
      else if (sortBy === "date") { va = a.buyDate; vb = b.buyDate; }
      else { va = a[sortBy]; vb = b[sortBy]; }
      if (va < vb) return sortDir === "asc" ? -1 : 1;
      if (va > vb) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
    return list;
  }, [investments, search, filterCat, sortBy, sortDir]);

  const toggleSort = col => {
    if (sortBy === col) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortBy(col); setSortDir("asc"); }
  };

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

  const doDelete = id => {
    setInvestments(prev => prev.filter(i => i.id !== id));
    setConfirmDelete(null); showToast("Befektetés törölve.", "info");
  };

  // ── Styles ────
  const S = {
    app: { minHeight: "100vh", background: "#0D1117", color: "#E6EDF3", fontFamily: "'DM Sans', 'Segoe UI', sans-serif" },
    header: { background: "#161B22", borderBottom: "1px solid #21262D", padding: "0 16px", display: "flex", alignItems: "center", gap: 12, height: 56, position: "sticky", top: 0, zIndex: 40 },
    logo: { fontWeight: 800, fontSize: 17, letterSpacing: "-0.03em", color: "#E6EDF3" },
    logoAccent: { color: "#6EE7B7" },
    main: { maxWidth: 1280, margin: "0 auto", padding: "16px 12px 80px" },
    card: { background: "#161B22", border: "1px solid #21262D", borderRadius: 12, padding: 16 },
    statCard: { background: "#161B22", border: "1px solid #21262D", borderRadius: 12, padding: "16px" },
    btn: (variant) => ({
      background: variant === "primary" ? "linear-gradient(135deg, #238636, #2EA043)" : variant === "ghost" ? "none" : "#21262D",
      border: variant === "ghost" ? "1px solid #30363D" : "none",
      borderRadius: 8, padding: "9px 14px", color: variant === "primary" ? "#fff" : "#C9D1D9",
      cursor: "pointer", fontSize: 13, fontWeight: 600, fontFamily: "inherit", display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap"
    }),
    th: { padding: "10px 12px", textAlign: "left", fontSize: 11, color: "#8B949E", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700, cursor: "pointer", userSelect: "none", whiteSpace: "nowrap" },
    td: { padding: "12px", fontSize: 13, borderBottom: "1px solid #21262D" },
  };

  const SortArrow = ({ col }) => sortBy === col ? (sortDir === "asc" ? " ↑" : " ↓") : " ↕";

  // Mobilon kártyás lista, desktopon tábla
  const isMobile = window.innerWidth < 700;

  return (
    <div style={S.app}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet" />

      {/* Header – sticky, kompakt */}
      <header style={S.header}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, minWidth: 0 }}>
          <svg width="26" height="26" viewBox="0 0 28 28" fill="none" style={{ flexShrink: 0 }}>
            <rect width="28" height="28" rx="8" fill="#6EE7B7" fillOpacity=".15"/>
            <polyline points="5,20 10,13 16,16 23,7" stroke="#6EE7B7" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
            <circle cx="23" cy="7" r="2.5" fill="#6EE7B7"/>
          </svg>
          <span style={S.logo}>Invest<span style={S.logoAccent}>Track</span></span>
        </div>
        {/* Akció gombok – mobilon csak ikonok */}
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <button title="Import" style={{ ...S.btn("ghost"), padding: "8px 10px" }} onClick={() => setModal("import")}>
            <svg width="15" height="15" fill="none" viewBox="0 0 16 16"><path d="M8 2v9m-4-4 4 4 4-4M2 14h12" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/></svg>
            {!isMobile && "Import"}
          </button>
          <button title="Export" style={{ ...S.btn("ghost"), padding: "8px 10px" }} onClick={() => exportCSV(investments)}>
            <svg width="15" height="15" fill="none" viewBox="0 0 16 16"><path d="M8 11V2m-4 5 4-4 4 4M2 14h12" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/></svg>
            {!isMobile && "Export"}
          </button>
          <button title="Árfolyam frissítése"
            style={{ ...S.btn("ghost"), padding: "8px 10px", opacity: refreshing ? 0.6 : 1 }}
            onClick={handleRefresh} disabled={refreshing}>
            <svg width="15" height="15" fill="none" viewBox="0 0 16 16"
              style={{ animation: refreshing ? "spin 1s linear infinite" : "none", flexShrink: 0 }}>
              <path d="M13.5 8A5.5 5.5 0 1 1 8 2.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/>
              <path d="M8 1v3.5L10.5 2 8 1z" fill="currentColor"/>
            </svg>
            {!isMobile && (refreshing ? (refreshProgress || "...") : "Árfolyam")}
          </button>
          <button title="Debug log" style={{ ...S.btn("ghost"), padding: "8px 10px" }} onClick={() => setShowLog(true)}>🪲</button>
          <button style={{ ...S.btn("primary"), padding: "8px 12px" }} onClick={() => { setEditing(null); setModal("add"); }}>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M6 1v10M1 6h10" stroke="#fff" strokeWidth="2" strokeLinecap="round"/></svg>
            {!isMobile && "Befektetés"}
          </button>
        </div>
      </header>

      <main style={S.main}>
        {/* Summary cards – 2×2 mobilon */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
          {[
            { label: "Portfólió értéke", val: fmtCurrency(stats.totalValue, "HUF"), sub: `${investments.length} pozíció`, color: "#E6EDF3" },
            { label: "Befektetett tőke", val: fmtCurrency(stats.totalCost, "HUF"), sub: "Összes vételár", color: "#8B949E" },
            { label: "Nyereség / Veszteség", val: (stats.totalPnL >= 0 ? "+" : "") + fmtCurrency(stats.totalPnL, "HUF"), sub: `${stats.totalPnL >= 0 ? "+" : ""}${fmtNum(stats.totalPct, 2)}%`, color: stats.totalPnL >= 0 ? "#6EE7B7" : "#FCA5A5" },
            { label: "Kategóriák", val: stats.catBreakdown.length, sub: "eszközosztály", color: "#93C5FD" },
          ].map((s, i) => (
            <div key={i} style={S.statCard}>
              <div style={{ fontSize: 10, color: "#8B949E", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 700, marginBottom: 6 }}>{s.label}</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: s.color, letterSpacing: "-0.02em", lineHeight: 1.2, wordBreak: "break-all" }}>{s.val}</div>
              <div style={{ fontSize: 11, color: "#8B949E", marginTop: 4 }}>{s.sub}</div>
            </div>
          ))}
        </div>

        {/* Chart + breakdown – kattintható váltóval */}
        {(stats.catBreakdown.length > 0 || stats.posBreakdown.length > 0) && (() => {
          const activeData = chartMode === "category" ? stats.catBreakdown : stats.posBreakdown;
          return (
            <div style={{ ...S.card, marginBottom: 16 }}>
              {/* Váltó fejléc */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                <span style={{ fontSize: 11, color: "#8B949E", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700 }}>
                  {chartMode === "category" ? "Eszközosztályok" : "Pozíciók súlya"}
                </span>
                <div style={{ display: "flex", background: "#0D1117", borderRadius: 8, padding: 3, gap: 2 }}>
                  {[["category", "🗂 Kategória"], ["position", "📊 Pozíció"]].map(([mode, label]) => (
                    <button key={mode} onClick={() => setChartMode(mode)}
                      style={{ background: chartMode === mode ? "#21262D" : "none", border: "none", borderRadius: 6, padding: "5px 10px", color: chartMode === mode ? "#E6EDF3" : "#8B949E", cursor: "pointer", fontSize: 11, fontWeight: 600, fontFamily: "inherit", transition: "all .15s" }}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
                {/* Kattintható donut */}
                <div style={{ flexShrink: 0, cursor: "pointer", position: "relative" }}
                  onClick={() => setChartMode(m => m === "category" ? "position" : "category")}
                  title="Kattints a váltáshoz">
                  <DonutChart data={activeData} size={130} />
                  {/* Középső ikon */}
                  <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", fontSize: 18, pointerEvents: "none" }}>
                    {chartMode === "category" ? "🗂" : "📊"}
                  </div>
                </div>

                {/* Jelmagyarázat – scrollozható ha sok pozíció */}
                <div style={{ flex: 1, minWidth: 150, maxHeight: 200, overflowY: "auto" }}>
                  {activeData.map(d => (
                    <div key={d.label} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                      <div style={{ width: 8, height: 8, borderRadius: "50%", background: d.color, flexShrink: 0 }} />
                      <div style={{ flex: 1, fontSize: 12, color: "#C9D1D9", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                        title={d.fullName || d.label}>
                        {d.label}
                      </div>
                      <div style={{ fontSize: 12, color: "#8B949E", flexShrink: 0, fontFamily: "'DM Mono', monospace" }}>
                        {fmtNum(d.pct, 1)}%
                      </div>
                      <div style={{ width: 48, background: "#21262D", borderRadius: 4, height: 3, flexShrink: 0 }}>
                        <div style={{ width: `${Math.min(d.pct, 100)}%`, background: d.color, borderRadius: 4, height: 3 }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          );
        })()}

        {/* Keresés + szűrők */}
        <div style={{ marginBottom: 12 }}>
          <input
            style={{ background: "#161B22", border: "1px solid #30363D", borderRadius: 8, padding: "9px 14px", color: "#E6EDF3", fontSize: 14, fontFamily: "inherit", outline: "none", width: "100%", boxSizing: "border-box", marginBottom: 10 }}
            placeholder="🔍  Keresés..."
            value={search} onChange={e => setSearch(e.target.value)}
          />
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {["Összes", ...CATEGORIES].map(c => (
              <button key={c} style={{ ...S.btn(filterCat === c ? "primary" : "ghost"), padding: "5px 10px", fontSize: 11 }}
                onClick={() => setFilterCat(c)}>{c}</button>
            ))}
          </div>
        </div>

        {/* Lista */}
        {investments.length === 0 ? (
          <div style={{ ...S.card, textAlign: "center", padding: "40px 20px" }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#E6EDF3", marginBottom: 8 }}>Még nincs befektetés</div>
            <div style={{ fontSize: 13, color: "#8B949E", marginBottom: 20 }}>Add hozzá az első pozíciódat, vagy importálj CSV fájlt.</div>
            <button style={{ ...S.btn("primary"), margin: "0 auto" }} onClick={() => setModal("add")}>+ Hozzáadás</button>
          </div>
        ) : isMobile ? (
          // ── Mobil kártyás nézet ──
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {displayed.map(inv => {
              const { value, abs, pct } = calcPnL(inv);
              const up = abs >= 0;
              return (
                <div key={inv.id} style={{ background: "#161B22", border: "1px solid #21262D", borderRadius: 12, padding: "14px 16px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{ width: 38, height: 38, borderRadius: 10, background: CATEGORY_COLORS[inv.category] + "20", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        <span style={{ fontSize: 11, fontWeight: 800, color: CATEGORY_COLORS[inv.category], fontFamily: "'DM Mono', monospace" }}>{(inv.ticker || inv.name).slice(0, 4).toUpperCase()}</span>
                      </div>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 14, color: "#E6EDF3" }}>{inv.name}</div>
                        <div style={{ fontSize: 11, color: "#8B949E", fontFamily: "'DM Mono', monospace" }}>{inv.ticker} · {inv.currency}</div>
                      </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontWeight: 700, fontSize: 15, color: "#E6EDF3", fontFamily: "'DM Mono', monospace" }}>{fmtNum(value, 0)}</div>
                      <div style={{ fontSize: 12, color: up ? "#6EE7B7" : "#FCA5A5", fontFamily: "'DM Mono', monospace" }}>{up ? "+" : ""}{fmtNum(pct, 2)}%</div>
                    </div>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, borderTop: "1px solid #21262D", paddingTop: 10 }}>
                    <div>
                      <div style={{ fontSize: 10, color: "#8B949E", textTransform: "uppercase", marginBottom: 2 }}>Vételár</div>
                      <div style={{ fontSize: 12, fontFamily: "'DM Mono', monospace", color: "#C9D1D9" }}>{fmtNum(inv.buyPrice, 0)}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 10, color: "#8B949E", textTransform: "uppercase", marginBottom: 2 }}>Mennyiség</div>
                      <div style={{ fontSize: 12, fontFamily: "'DM Mono', monospace", color: "#C9D1D9" }}>{fmtNum(inv.quantity, inv.quantity % 1 === 0 ? 0 : 4)}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 10, color: "#8B949E", textTransform: "uppercase", marginBottom: 2 }}>P&L</div>
                      <div style={{ fontSize: 12, fontFamily: "'DM Mono', monospace", color: up ? "#6EE7B7" : "#FCA5A5" }}>{up ? "+" : ""}{fmtNum(abs, 0)}</div>
                    </div>
                  </div>
                  <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 10 }}>
                    <button onClick={() => { setEditing(inv); setModal("edit"); }}
                      style={{ background: "#21262D", border: "none", borderRadius: 6, padding: "6px 12px", color: "#C9D1D9", cursor: "pointer", fontSize: 12, fontFamily: "inherit" }}>✏️ Szerkesztés</button>
                    <button onClick={() => setConfirmDelete(inv)}
                      style={{ background: "none", border: "1px solid #3D1A1A", borderRadius: 6, padding: "6px 12px", color: "#FCA5A5", cursor: "pointer", fontSize: 12, fontFamily: "inherit" }}>🗑️</button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          // ── Desktop táblás nézet ──
          <div style={{ ...S.card, padding: 0, overflow: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
              <thead>
                <tr style={{ borderBottom: "1px solid #21262D" }}>
                  <th style={S.th} onClick={() => toggleSort("name")}>Megnevezés<SortArrow col="name" /></th>
                  <th style={S.th}>Kategória</th>
                  <th style={{ ...S.th, textAlign: "right" }} onClick={() => toggleSort("value")}>Piaci érték<SortArrow col="value" /></th>
                  <th style={{ ...S.th, textAlign: "right" }}>Átlagár</th>
                  <th style={{ ...S.th, textAlign: "right" }}>Db</th>
                  <th style={{ ...S.th, textAlign: "right" }} onClick={() => toggleSort("pnl")}>P&L<SortArrow col="pnl" /></th>
                  <th style={{ ...S.th, textAlign: "right" }} onClick={() => toggleSort("date")}>Vétel<SortArrow col="date" /></th>
                  <th style={S.th}></th>
                </tr>
              </thead>
              <tbody>
                {displayed.map(inv => {
                  const { value, abs, pct } = calcPnL(inv);
                  const up = abs >= 0;
                  return (
                    <tr key={inv.id} style={{ transition: "background .1s" }}
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
                        <span style={{ background: CATEGORY_COLORS[inv.category] + "20", color: CATEGORY_COLORS[inv.category], borderRadius: 6, padding: "3px 8px", fontSize: 11, fontWeight: 700 }}>
                          {inv.category}
                        </span>
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
                      <td style={S.td}>
                        <div style={{ display: "flex", gap: 6 }}>
                          <button title="Szerkesztés"
                            style={{ background: "none", border: "none", color: "#8B949E", cursor: "pointer", padding: "4px 6px", borderRadius: 6, fontSize: 14, lineHeight: 1 }}
                            onClick={() => { setEditing(inv); setModal("edit"); }}>✏️</button>
                          <button title="Törlés"
                            style={{ background: "none", border: "none", color: "#8B949E", cursor: "pointer", padding: "4px 6px", borderRadius: 6, fontSize: 14, lineHeight: 1 }}
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
      </main>

      {/* Add/Edit modal */}
      {(modal === "add" || modal === "edit") && (
        <Modal title={modal === "add" ? "Új befektetés" : "Befektetés szerkesztése"}
          onClose={() => { setModal(null); setEditing(null); }}>
          <InvestmentForm
            initial={editing}
            onSave={saveInvestment}
            onCancel={() => { setModal(null); setEditing(null); }}
          />
        </Modal>
      )}

      {/* Import modal */}
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
            <div>
              <div style={{ fontSize: 12, color: "#8B949E", marginBottom: 6, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                Vagy illeszd be a CSV tartalmat
              </div>
              <textarea
                style={{ width: "100%", background: "#0D1117", border: "1px solid #30363D", borderRadius: 8, padding: "10px 12px", color: "#E6EDF3", fontSize: 12, fontFamily: "'DM Mono', monospace", minHeight: 120, resize: "vertical", boxSizing: "border-box", outline: "none" }}
                placeholder={"Név,Ticker,Kategória,Vétel ár,Darab,Jelenlegi ár,Deviza,Vétel dátum,Megjegyzés\nApple Inc.,AAPL,Részvény,150,10,185,USD,2024-01-15,"}
                value={importText} onChange={e => setImportText(e.target.value)}
              />
            </div>
            <div style={{ background: "#161B22", border: "1px solid #21262D", borderRadius: 8, padding: "12px 14px", fontSize: 12, color: "#8B949E" }}>
              <strong style={{ color: "#C9D1D9" }}>Elvárt oszlopsorrend:</strong><br />
              Név · Ticker · Kategória · Vétel ár · Darab · Jelenlegi ár · Deviza · Vétel dátum · Megjegyzés
            </div>
            <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
              <button style={S.btn("ghost")} onClick={() => { setModal(null); setImportText(""); }}>Mégsem</button>
              <button style={{ ...S.btn("primary"), opacity: importText.trim() ? 1 : 0.5 }}
                onClick={handleImport} disabled={!importText.trim()}>
                Importálás
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Delete confirm */}
      {confirmDelete && (
        <Modal title="Törlés megerősítése" onClose={() => setConfirmDelete(null)}>
          <div style={{ fontSize: 14, color: "#8B949E", marginBottom: 20 }}>
            Biztosan törlöd a <strong style={{ color: "#E6EDF3" }}>{confirmDelete.name}</strong> pozíciót? Ez a művelet nem visszavonható.
          </div>
          <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
            <button style={S.btn("ghost")} onClick={() => setConfirmDelete(null)}>Mégsem</button>
            <button style={{ ...S.btn("ghost"), color: "#FCA5A5", borderColor: "#FCA5A5" }}
              onClick={() => doDelete(confirmDelete.id)}>Törlés</button>
          </div>
        </Modal>
      )}

      {/* Log modal */}
      {showLog && <LogModal onClose={() => setShowLog(false)} />}

      {/* Toast */}
      {toast && (
        <div style={{
          position: "fixed", bottom: 24, right: 24, background: toast.type === "error" ? "#3D0A0A" : toast.type === "info" ? "#1C2A3D" : "#0D2818",
          border: `1px solid ${toast.type === "error" ? "#FCA5A5" : toast.type === "info" ? "#93C5FD" : "#6EE7B7"}`,
          borderRadius: 10, padding: "12px 18px", fontSize: 13, color: "#E6EDF3",
          boxShadow: "0 8px 32px rgba(0,0,0,.5)", zIndex: 100, maxWidth: 300,
          animation: "slideIn .2s ease"
        }}>
          {toast.msg}
        </div>
      )}

      <style>{`
        @keyframes slideIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 6px; height: 6px; }
        ::-webkit-scrollbar-track { background: #161B22; }
        ::-webkit-scrollbar-thumb { background: #30363D; border-radius: 3px; }
        input[type=number]::-webkit-inner-spin-button { opacity: .3; }
        select option { background: #1C2128; color: #E6EDF3; }
      `}</style>
    </div>
  );
}
