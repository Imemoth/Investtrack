import { useState, useEffect, useRef } from "react";
import { CATEGORIES, CURRENCIES, EMPTY_FORM } from "../constants";
import { uid, calcAvgBuyPrice, calcTotalQty, calcCostBasis, fmtNum } from "../utils";
import { THEME as T, glassCard, haptic } from "../design-system";
import { TickerSearch, fetchQuoteDetails, typeToCategory } from "./TickerSearch";

// ─── INVESTMENT FORM ──────────────────────────────────────────────────────────
export function InvestmentForm({ initial, onSave, onCancel }) {
  const initLots = initial?.lots?.length > 0
    ? initial.lots
    : initial?.buyPrice
      ? [{ id: uid(), price: String(initial.buyPrice), quantity: String(initial.quantity || ""), date: initial.buyDate || "", notes: "" }]
      : [{ id: uid(), price: "", quantity: "", date: "", notes: "" }];

  const [form, setForm] = useState({ ...EMPTY_FORM, ...initial });
  const [lots, setLots] = useState(initLots);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const updateLot = (id, key, val) => setLots(ls => ls.map(l => l.id === id ? { ...l, [key]: val } : l));
  const addLot    = () => { setLots(ls => [...ls, { id: uid(), price: "", quantity: "", date: new Date().toISOString().slice(0,10), notes: "" }]); haptic("light"); };
  const removeLot = id => setLots(ls => ls.length > 1 ? ls.filter(l => l.id !== id) : ls);

  const avgPrice  = calcAvgBuyPrice(lots);
  const totalQty  = calcTotalQty(lots);
  const totalCost = calcCostBasis(lots);

  const inputStyle = {
    width: "100%", background: T.bg.inset, border: `1px solid ${T.border.default}`,
    borderRadius: T.radius.md, padding: "9px 12px", color: T.text.primary,
    fontSize: 14, fontFamily: "inherit", outline: "none", boxSizing: "border-box",
  };
  const labelStyle = { display: "block", fontSize: 11, color: T.text.secondary, marginBottom: 5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" };
  const grid2 = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 };

  // Ticker kiválasztásakor automatikusan tölt
  const [priceLoading, setPriceLoading] = useState(false);
  const [formError, setFormError] = useState(null);

  const handleTickerSelect = (item) => {
    set("ticker",   item.symbol);
    set("name",     item.name);
    set("category", typeToCategory(item.type));
    // Ha van deviza a search találatból → beállítjuk, különben várunk a details-re
    if (item.currency && item.currency !== "USD" || item.type === "ETF") {
      set("currency", item.currency || "USD");
    }
    if (item.price) {
      set("currentPrice", String(item.price));
    }
    // Ha a details-szel jön frissítés
    if (!item.loading) {
      if (item.currency) set("currency", item.currency);
      if (item.price)    set("currentPrice", String(Math.round(item.price * 100) / 100));
      setPriceLoading(false);
    } else {
      setPriceLoading(true);
    }
  };

  const handleSave = () => {
    if (!form.name.trim()) { setFormError("Adj meg megnevezést!"); return; }
    const validLots = lots
      .filter(l => parseFloat(l.price) > 0 && parseFloat(l.quantity) > 0)
      .map(l => ({ ...l, price: parseFloat(l.price), quantity: parseFloat(l.quantity) }));
    if (!validLots.length) { setFormError("Legalább egy érvényes vételi tétel kell!"); return; }
    setFormError(null);
    onSave({
      ...form,
      id:           form.id || uid(),
      lots:         validLots,
      currentPrice: parseFloat(form.currentPrice) || 0,
      realizedPnL:  parseFloat(form.realizedPnL) || 0,
      sales:        form.sales || [],
      buyPrice:     calcAvgBuyPrice(validLots),
      quantity:     calcTotalQty(validLots),
    });
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

      {/* Ticker keresés — teljes szélesség, legelöl */}
      <TickerSearch
        value={form.ticker}
        onSelect={handleTickerSelect}
        inputStyle={inputStyle}
        labelStyle={labelStyle}
      />

      {/* Automatikusan töltött mezők — csak ha már van ticker */}
      <div style={grid2}>
        <div>
          <label style={labelStyle}>Megnevezés *</label>
          <input style={{ ...inputStyle, background: form.name ? "rgba(110,231,183,0.05)" : T.bg.inset }} value={form.name} onChange={e => set("name", e.target.value)} placeholder="pl. Apple Inc." />
        </div>
        <div>
          <label style={labelStyle}>Ticker</label>
          <input style={{ ...inputStyle, fontFamily:"'DM Mono',monospace", background: form.ticker ? "rgba(110,231,183,0.05)" : T.bg.inset }} value={form.ticker || ""} onChange={e => set("ticker", e.target.value.toUpperCase())} placeholder="pl. AAPL" />
        </div>
      </div>

      <div style={grid2}>
        <div>
          <label style={labelStyle}>Kategória</label>
          <select style={inputStyle} value={form.category} onChange={e => set("category", e.target.value)}>
            {CATEGORIES.map(c => <option key={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label style={labelStyle}>Deviza</label>
          <select style={inputStyle} value={form.currency} onChange={e => set("currency", e.target.value)}>
            {CURRENCIES.map(c => <option key={c}>{c}</option>)}
          </select>
        </div>
      </div>

      <div style={grid2}>
        <div>
          <label style={labelStyle}>Jelenlegi ár {priceLoading && <span style={{ color:T.accent.green, marginLeft:4, fontSize:10 }}>⟳ töltés...</span>}</label>
          <input style={inputStyle} type="number" value={form.currentPrice || ""} onChange={e => set("currentPrice", e.target.value)} placeholder="0" />
        </div>
        <div>
          <label style={labelStyle}>Célár</label>
          <input style={inputStyle} type="number" value={form.targetPrice || ""} onChange={e => set("targetPrice", e.target.value)} placeholder="Opcionális" />
        </div>
      </div>

      <div style={grid2}>
        <div>
          <label style={labelStyle}>Osztalék % / év</label>
          <input style={inputStyle} type="number" value={form.dividendYield || ""} onChange={e => set("dividendYield", e.target.value)} placeholder="pl. 2.5" />
        </div>
        <div>
          <label style={labelStyle}>Megjegyzés</label>
          <input style={inputStyle} value={form.notes || ""} onChange={e => set("notes", e.target.value)} placeholder="Opcionális" />
        </div>
      </div>

      {/* Lots szekció */}
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <label style={{ ...labelStyle, marginBottom: 0 }}>📦 Vételi tételek</label>
          <button onClick={addLot} style={{ background: "rgba(110,231,183,0.12)", border: `1px solid ${T.accent.green}40`, borderRadius: T.radius.md, padding: "5px 12px", cursor: "pointer", color: T.accent.green, fontSize: 12, fontWeight: 700, fontFamily: "inherit" }}>+ Tétel hozzáadása</button>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {lots.map((lot, i) => (
            <div key={lot.id} style={{ ...glassCard(T, { padding: 12 }), background: T.bg.inset }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <span style={{ fontSize: 11, color: T.text.tertiary, fontWeight: 700 }}>#{i + 1} tétel</span>
                {lots.length > 1 && (
                  <button onClick={() => removeLot(lot.id)} style={{ background: "none", border: "none", color: T.accent.red, cursor: "pointer", fontSize: 14 }}>✕</button>
                )}
              </div>
              <div style={grid2}>
                <div>
                  <label style={{ ...labelStyle, fontSize: 10 }}>Vételár ({form.currency})</label>
                  <input style={{ ...inputStyle, fontSize: 13 }} type="number" value={lot.price} onChange={e => updateLot(lot.id, "price", e.target.value)} placeholder="0" />
                </div>
                <div>
                  <label style={{ ...labelStyle, fontSize: 10 }}>Darab</label>
                  <input style={{ ...inputStyle, fontSize: 13 }} type="number" value={lot.quantity} onChange={e => updateLot(lot.id, "quantity", e.target.value)} placeholder="0" />
                </div>
              </div>
              <div style={{ marginTop: 8 }}>
                <label style={{ ...labelStyle, fontSize: 10 }}>Vétel dátuma</label>
                <input style={{ ...inputStyle, fontSize: 13, colorScheme: "dark" }} type="date" value={lot.date} onChange={e => updateLot(lot.id, "date", e.target.value)} />
              </div>
            </div>
          ))}
        </div>

        {/* Összesítő */}
        {lots.some(l => parseFloat(l.price) > 0 && parseFloat(l.quantity) > 0) && (
          <div style={{ ...glassCard(T, { padding: 12 }), marginTop: 10, background: "rgba(110,231,183,0.06)", border: `1px solid rgba(110,231,183,0.2)` }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, textAlign: "center" }}>
              {[["Átlag vételár", fmtNum(avgPrice, 2)], ["Összmennyiség", fmtNum(totalQty, 4)], ["Befektetett", fmtNum(totalCost, 0)]].map(([l, v]) => (
                <div key={l}>
                  <div style={{ fontSize: 9, color: T.text.tertiary, textTransform: "uppercase", marginBottom: 3 }}>{l}</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: T.accent.green, fontFamily: "'DM Mono',monospace" }}>{v}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Validációs hiba */}
      {formError && (
        <div style={{ color: T.accent.red, fontSize: 12, padding: "8px 12px", background: "rgba(252,165,165,0.08)", borderRadius: T.radius.md, border: "1px solid rgba(252,165,165,0.25)" }}>
          {formError}
        </div>
      )}

      {/* Akciók */}
      <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 4 }}>
        <button onClick={onCancel} style={{ background: "none", border: `1px solid ${T.border.default}`, borderRadius: T.radius.md, padding: "10px 20px", color: T.text.secondary, cursor: "pointer", fontSize: 14, fontFamily: "inherit" }}>Mégsem</button>
        <button onClick={handleSave} style={{ background: T.gradient.primary, border: "none", borderRadius: T.radius.md, padding: "10px 24px", color: "#fff", cursor: "pointer", fontSize: 14, fontWeight: 700, fontFamily: "inherit", boxShadow: "0 2px 12px rgba(46,160,67,0.35)" }}>
          {initial ? "Mentés" : "+ Hozzáadás"}
        </button>
      </div>
    </div>
  );
}
