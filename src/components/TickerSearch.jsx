// components/TickerSearch.jsx — közös ticker kereső
import { useState, useEffect, useRef } from "react";
import { THEME as T, haptic } from "../design-system";

const PROXIES = [
  url => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
  url => `https://corsproxy.io/?url=${encodeURIComponent(url)}`,
];

async function searchTickers(query) {
  const url = `https://query2.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(query)}&quotesCount=8&newsCount=0&enableFuzzyQuery=true&enableNavLinks=false`;
  for (const proxy of PROXIES) {
    try {
      const res  = await fetch(proxy(url), { signal: AbortSignal.timeout(6000) });
      if (!res.ok) throw new Error();
      const text = await res.text();
      if (text.trim().startsWith("<")) throw new Error();
      const data = JSON.parse(text);
      return (data?.quotes || [])
        .filter(q => q.symbol && (q.shortname || q.longname))
        .slice(0, 6)
        .map(q => ({
          symbol:   q.symbol,
          name:     q.shortname || q.longname || q.symbol,
          exchange: q.exchange || q.fullExchangeName || "",
          type:     q.quoteType || "EQUITY",
          currency: q.currency || "USD",
          price:    q.regularMarketPrice || null,
        }));
    } catch {}
  }
  return [];
}

export async function fetchQuoteDetails(symbol) {
  const url = `https://query2.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=1d`;
  for (const proxy of PROXIES) {
    try {
      const res  = await fetch(proxy(url), { signal: AbortSignal.timeout(6000) });
      if (!res.ok) throw new Error();
      const text = await res.text();
      if (text.trim().startsWith("<")) throw new Error();
      const data = JSON.parse(text);
      const meta = data?.chart?.result?.[0]?.meta;
      if (!meta) throw new Error();
      return { price: meta.regularMarketPrice || meta.previousClose || null, currency: meta.currency || null };
    } catch {}
  }
  return { price: null, currency: null };
}

export function typeToCategory(type) {
  if (type === "ETF" || type === "MUTUALFUND") return "ETF";
  if (type === "CRYPTOCURRENCY") return "Kriptó";
  if (type === "FUTURE" || type === "COMMODITY") return "Árupiaci";
  return "Részvény";
}

const TYPE_COLORS = { ETF:"#93C5FD", EQUITY:"#6EE7B7", CRYPTOCURRENCY:"#F9A8D4", FUTURE:"#FDE68A" };

// fetchPrice: ha true, lekéri az aktuális árat is (InvestmentForm)
// fetchPrice: ha false, csak név/ticker/deviza (PendingOrders)
export function TickerSearch({ value, onSelect, inputStyle, labelStyle, fetchPrice = true }) {
  const [query,    setQuery]    = useState(value || "");
  const [results,  setResults]  = useState([]);
  const [loading,  setLoading]  = useState(false);
  const [fetching, setFetching] = useState(false);
  const [open,     setOpen]     = useState(false);
  const debounceRef = useRef(null);
  const wrapRef     = useRef(null);

  useEffect(() => {
    const h = e => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", h);
    document.addEventListener("touchstart", h);
    return () => { document.removeEventListener("mousedown", h); document.removeEventListener("touchstart", h); };
  }, []);

  const handleChange = (val) => {
    setQuery(val);
    clearTimeout(debounceRef.current);
    if (val.length < 1) { setResults([]); setOpen(false); return; }
    setLoading(true);
    debounceRef.current = setTimeout(async () => {
      const res = await searchTickers(val);
      setResults(res);
      setOpen(res.length > 0);
      setLoading(false);
    }, 350);
  };

  const handleSelect = async (item) => {
    setQuery(item.symbol);
    setOpen(false);
    haptic("light");

    if (!fetchPrice) {
      // Csak alap info — devizát pontosítjuk a chart API-ból
      onSelect({ ...item, loading: true });
      if (!item.currency) {
        setFetching(true);
        const details = await fetchQuoteDetails(item.symbol);
        setFetching(false);
        onSelect({ ...item, currency: details.currency || item.currency || "USD", loading: false });
      } else {
        onSelect({ ...item, loading: false });
      }
      return;
    }

    // fetchPrice = true: ár + deviza lekérés
    onSelect({ ...item, price: item.price || null, loading: true });
    if (!item.price || !item.currency) {
      setFetching(true);
      const details = await fetchQuoteDetails(item.symbol);
      setFetching(false);
      onSelect({ ...item, price: details.price || item.price, currency: details.currency || item.currency || "USD", loading: false });
    }
  };

  const isSpinning = loading || fetching;

  return (
    <div ref={wrapRef} style={{ position:"relative" }}>
      {labelStyle && <label style={labelStyle}>Ticker keresés</label>}
      <div style={{ position:"relative" }}>
        <input
          style={{ ...inputStyle, paddingRight: isSpinning ? 36 : 12,
            border: `1px solid ${open ? T.accent.green+"60" : T.border.default}` }}
          value={query}
          onChange={e => handleChange(e.target.value.toUpperCase())}
          onFocus={() => results.length > 0 && setOpen(true)}
          placeholder="Keresés: ticker vagy név..."
          autoComplete="off" autoCorrect="off" autoCapitalize="characters" spellCheck={false}
        />
        {isSpinning && (
          <div style={{ position:"absolute", right:10, top:"50%", transform:"translateY(-50%)", fontSize:12, animation:"spin 1s linear infinite", display:"inline-block" }}>⟳</div>
        )}
      </div>

      {open && results.length > 0 && (
        <div style={{
          position:"absolute", top:"calc(100% + 4px)", left:0, right:0, zIndex:200,
          background:"rgba(7,11,20,0.97)", border:`1px solid ${T.border.default}`,
          borderRadius:T.radius.md, boxShadow:T.shadow.raised, backdropFilter:"blur(16px)", overflow:"hidden",
        }}>
          {results.map((item, i) => (
            <button key={item.symbol} onClick={() => handleSelect(item)} style={{
              width:"100%", background:"none", border:"none",
              borderBottom: i < results.length-1 ? `1px solid ${T.border.subtle}` : "none",
              padding:"10px 14px", cursor:"pointer", textAlign:"left",
              display:"flex", alignItems:"center", gap:10, fontFamily:"inherit",
            }}
              onMouseEnter={e => e.currentTarget.style.background = T.bg.surface}
              onMouseLeave={e => e.currentTarget.style.background = "none"}
            >
              <div style={{ width:42, height:32, borderRadius:6, background:(TYPE_COLORS[item.type]||"#94A3B8")+"20", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                <span style={{ fontSize:9, fontWeight:800, color:TYPE_COLORS[item.type]||"#94A3B8", fontFamily:"'DM Mono',monospace" }}>{item.symbol.slice(0,5)}</span>
              </div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:13, fontWeight:600, color:T.text.primary, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{item.name}</div>
                <div style={{ fontSize:10, color:T.text.tertiary, fontFamily:"'DM Mono',monospace" }}>
                  {item.symbol} · {item.exchange}
                  {item.currency && item.currency !== "USD" && ` · ${item.currency}`}
                  {fetchPrice && item.price && <span style={{ color:T.accent.green, marginLeft:6 }}>{item.price.toFixed(2)}</span>}
                </div>
              </div>
              <span style={{ fontSize:9, fontWeight:700, color:TYPE_COLORS[item.type]||"#94A3B8", background:(TYPE_COLORS[item.type]||"#94A3B8")+"15", borderRadius:4, padding:"2px 6px", flexShrink:0 }}>
                {item.type}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
