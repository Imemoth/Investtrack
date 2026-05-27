// components/SellModal.jsx
// Eladás rögzítése – FIFO cost basis, realizált P&L számítás
import { useState, useMemo } from "react";
import { uid, calcAvgBuyPrice, calcTotalQty, fmtNum, fmtCurrency } from "../utils";
import { THEME as T, glassCard, haptic } from "../design-system";

export function SellModal({ inv, onSell, onClose }) {
  const avgBuy  = calcAvgBuyPrice(inv.lots || []);
  const totalQ  = calcTotalQty(inv.lots || []);

  const [sellPrice, setSellPrice] = useState(String(inv.currentPrice || ""));
  const [sellQty,   setSellQty]   = useState("");
  const [sellDate,  setSellDate]  = useState(new Date().toISOString().slice(0, 10));
  const [notes,     setNotes]     = useState("");

  const qty       = parseFloat(sellQty) || 0;
  const price     = parseFloat(sellPrice) || 0;
  const proceeds  = price * qty;
  const costBasis = avgBuy * qty;       // FIFO átlag alapú cost basis
  const realPnL   = proceeds - costBasis;
  const pct       = costBasis > 0 ? (realPnL / costBasis) * 100 : 0;
  const isValid   = qty > 0 && qty <= totalQ && price > 0;

  const inputStyle = {
    width: "100%", background: T.bg.inset, border: `1px solid ${T.border.default}`,
    borderRadius: T.radius.md, padding: "10px 12px", color: T.text.primary,
    fontSize: 14, fontFamily: "inherit", outline: "none", boxSizing: "border-box",
  };
  const labelStyle = { display: "block", fontSize: 11, color: T.text.secondary, marginBottom: 5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" };

  const handleSell = () => {
    if (!isValid) return;
    haptic("medium");

    // Új lots: FIFO alapon csökkentjük a mennyiséget
    let remaining = qty;
    const newLots = [];
    for (const lot of (inv.lots || [])) {
      if (remaining <= 0) { newLots.push(lot); continue; }
      if (lot.quantity <= remaining) {
        remaining -= lot.quantity; // ez a lot teljesen elfogyott
      } else {
        newLots.push({ ...lot, quantity: lot.quantity - remaining });
        remaining = 0;
      }
    }

    // Eladás rekord
    const sale = {
      id:           uid(),
      invId:        inv.id,
      name:         inv.name,
      ticker:       inv.ticker,
      sellPrice:    price,
      quantity:     qty,
      avgCostBasis: avgBuy,
      realizedPnL:  realPnL,
      currency:     inv.currency,
      date:         sellDate,
      notes,
    };

    onSell({
      updatedInv: {
        ...inv,
        lots:         newLots,
        quantity:     calcTotalQty(newLots),
        buyPrice:     calcAvgBuyPrice(newLots),
        realizedPnL:  (inv.realizedPnL || 0) + realPnL,
        sales:        [...(inv.sales || []), sale],
      },
      sale,
      fullyClose: newLots.length === 0 || calcTotalQty(newLots) <= 0,
    });
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(16px)", zIndex: 60, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ ...glassCard(T, { padding: 0 }), background: "rgba(7,11,20,0.95)", width: "100%", maxWidth: 440, animation: "scaleIn 0.25s cubic-bezier(0.34,1.56,0.64,1)" }}>

        {/* Header */}
        <div style={{ padding: "18px 20px 0", borderBottom: `1px solid ${T.border.subtle}`, marginBottom: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: 16 }}>
            <div>
              <div style={{ fontSize: 17, fontWeight: 700, color: T.text.primary }}>📤 Eladás rögzítése</div>
              <div style={{ fontSize: 12, color: T.text.secondary, marginTop: 2 }}>{inv.name} · max {fmtNum(totalQ, 4)} db</div>
            </div>
            <button onClick={onClose} style={{ background: T.bg.surface, border: `1px solid ${T.border.subtle}`, borderRadius: T.radius.full, width: 30, height: 30, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: T.text.secondary, fontSize: 16 }}>×</button>
          </div>
        </div>

        <div style={{ padding: "0 20px 20px", display: "flex", flexDirection: "column", gap: 14 }}>

          {/* Beviteli mezők */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={labelStyle}>Eladási ár</label>
              <input style={inputStyle} type="number" value={sellPrice} onChange={e => setSellPrice(e.target.value)} placeholder="0" />
            </div>
            <div>
              <label style={labelStyle}>Eladott mennyiség</label>
              <input style={inputStyle} type="number" value={sellQty} onChange={e => setSellQty(e.target.value)} placeholder={`max ${fmtNum(totalQ, 4)}`} max={totalQ} />
            </div>
          </div>

          <div>
            <label style={labelStyle}>Eladás dátuma</label>
            <input style={{ ...inputStyle, colorScheme: "dark" }} type="date" value={sellDate} onChange={e => setSellDate(e.target.value)} />
          </div>

          <div>
            <label style={labelStyle}>Megjegyzés</label>
            <input style={inputStyle} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Opcionális" />
          </div>

          {/* P&L előnézet */}
          {isValid && (
            <div style={{ ...glassCard(T, { padding: 14 }), background: realPnL >= 0 ? "rgba(110,231,183,0.08)" : "rgba(252,165,165,0.08)", border: `1px solid ${realPnL >= 0 ? "rgba(110,231,183,0.25)" : "rgba(252,165,165,0.25)"}` }}>
              <div style={{ fontSize: 11, color: T.text.tertiary, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 12, fontWeight: 700 }}>Realizált P&L előnézet</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                {[
                  ["Bevétel",       fmtNum(proceeds, 0) + " " + inv.currency],
                  ["Cost basis",    fmtNum(costBasis, 0) + " " + inv.currency],
                  ["Realizált P&L", (realPnL >= 0 ? "+" : "") + fmtNum(realPnL, 0) + " " + inv.currency],
                  ["Hozam",         (pct >= 0 ? "+" : "") + fmtNum(pct, 2) + "%"],
                ].map(([l, v], i) => (
                  <div key={l}>
                    <div style={{ fontSize: 10, color: T.text.tertiary, marginBottom: 2 }}>{l}</div>
                    <div style={{ fontSize: 14, fontWeight: 700, fontFamily: "'DM Mono',monospace", color: i >= 2 ? (realPnL >= 0 ? T.accent.green : T.accent.red) : T.text.primary }}>{v}</div>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 10, fontSize: 11, color: T.text.tertiary }}>
                Cost basis: átlagolt vételár (FIFO) = {fmtNum(avgBuy, 2)} {inv.currency}
              </div>
            </div>
          )}

          {/* Akciók */}
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
            <button onClick={onClose} style={{ background: "none", border: `1px solid ${T.border.default}`, borderRadius: T.radius.md, padding: "10px 20px", color: T.text.secondary, cursor: "pointer", fontSize: 13, fontFamily: "inherit" }}>Mégsem</button>
            <button onClick={handleSell} disabled={!isValid} style={{ background: isValid ? T.gradient.danger : T.bg.surface, border: "none", borderRadius: T.radius.md, padding: "10px 22px", color: "#fff", cursor: isValid ? "pointer" : "not-allowed", fontSize: 13, fontWeight: 700, fontFamily: "inherit", opacity: isValid ? 1 : 0.5, boxShadow: isValid ? "0 2px 12px rgba(239,68,68,0.35)" : "none" }}>
              📤 Eladás rögzítése
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
