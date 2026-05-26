import { useState } from "react";
import { CATEGORIES, CURRENCIES, EMPTY_FORM } from "../constants";
import { uid } from "../utils";

export function InvestmentForm({ initial, onSave, onCancel }) {
  const [form, setForm] = useState(initial || EMPTY_FORM);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const inputStyle = {
    width: "100%", background: "#0D1117", border: "1px solid #30363D",
    borderRadius: 8, padding: "10px 12px", color: "#E6EDF3",
    fontSize: 14, fontFamily: "inherit", outline: "none", boxSizing: "border-box",
  };
  const labelStyle = {
    display: "block", fontSize: 12, color: "#8B949E", marginBottom: 6,
    fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em",
  };
  const grid2 = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 };

  const handleSave = () => {
    if (!form.name.trim()) return alert("Adj meg megnevezést!");
    onSave({
      ...form,
      id:           form.id || uid(),
      buyPrice:     +form.buyPrice,
      quantity:     +form.quantity,
      currentPrice: +form.currentPrice,
    });
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={grid2}>
        <div>
          <label style={labelStyle}>Megnevezés *</label>
          <input style={inputStyle} value={form.name} onChange={e => set("name", e.target.value)} placeholder="pl. Apple Inc." />
        </div>
        <div>
          <label style={labelStyle}>Ticker</label>
          <input style={inputStyle} value={form.ticker} onChange={e => set("ticker", e.target.value.toUpperCase())} placeholder="pl. AAPL" />
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
          <label style={labelStyle}>Vételi ár</label>
          <input style={inputStyle} type="number" value={form.buyPrice} onChange={e => set("buyPrice", e.target.value)} placeholder="0" />
        </div>
        <div>
          <label style={labelStyle}>Darabszám</label>
          <input style={inputStyle} type="number" value={form.quantity} onChange={e => set("quantity", e.target.value)} placeholder="0" />
        </div>
      </div>

      <div style={grid2}>
        <div>
          <label style={labelStyle}>Jelenlegi ár</label>
          <input style={inputStyle} type="number" value={form.currentPrice} onChange={e => set("currentPrice", e.target.value)} placeholder="0" />
        </div>
        <div>
          <label style={labelStyle}>Vétel dátuma</label>
          <input style={{ ...inputStyle, colorScheme: "dark" }} type="date" value={form.buyDate} onChange={e => set("buyDate", e.target.value)} />
        </div>
      </div>

      <div style={grid2}>
        <div>
          <label style={labelStyle}>🎯 Célár</label>
          <input style={inputStyle} type="number" value={form.targetPrice || ""} onChange={e => set("targetPrice", e.target.value)} placeholder="Opcionális" />
        </div>
        <div>
          <label style={labelStyle}>💰 Osztalék % / év</label>
          <input style={inputStyle} type="number" value={form.dividendYield || ""} onChange={e => set("dividendYield", e.target.value)} placeholder="pl. 2.5" />
        </div>
      </div>

      <div>
        <label style={labelStyle}>Megjegyzés</label>
        <textarea
          style={{ ...inputStyle, resize: "vertical", minHeight: 60 }}
          value={form.notes}
          onChange={e => set("notes", e.target.value)}
          placeholder="Opcionális..."
        />
      </div>

      <div style={{ display: "flex", gap: 12, justifyContent: "flex-end", marginTop: 4 }}>
        <button onClick={onCancel} style={{ background: "none", border: "1px solid #30363D", borderRadius: 8, padding: "10px 20px", color: "#8B949E", cursor: "pointer", fontSize: 14, fontFamily: "inherit" }}>
          Mégsem
        </button>
        <button onClick={handleSave} style={{ background: "linear-gradient(135deg, #238636, #2EA043)", border: "none", borderRadius: 8, padding: "10px 24px", color: "#fff", cursor: "pointer", fontSize: 14, fontWeight: 700, fontFamily: "inherit" }}>
          {initial ? "Mentés" : "+ Hozzáadás"}
        </button>
      </div>
    </div>
  );
}
