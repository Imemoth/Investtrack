// components/SellModal.jsx
// Eladás rögzítése – valódi FIFO cost basis, historikus HUF P&L számítás
import { useState, useMemo } from "react";
import { uid, calcAvgBuyPrice, calcTotalQty, fmtNum } from "../utils";
import { THEME as T, glassCard, haptic } from "../design-system";

export function SellModal({ inv, onSell, onClose, fxRates = {} }) {
  const lots   = inv.lots || [];
  const totalQ = calcTotalQty(lots);
  const getFxRate = () => inv.currency === "HUF" ? 1 : (parseFloat(fxRates[inv.currency]) || 0);
  const hasValidFx = inv.currency === "HUF" || getFxRate() > 0;

  const [sellPrice, setSellPrice] = useState(String(inv.currentPrice || ""));
  const [sellQty,   setSellQty]   = useState("");
  const [sellDate,  setSellDate]  = useState(new Date().toISOString().slice(0, 10));
  const [notes,     setNotes]     = useState("");

  const qty   = parseFloat(sellQty) || 0;
  const price = parseFloat(sellPrice) || 0;

  // ── Valódi FIFO kalkuláció ────────────────────────────────────────────────
  const fifo = useMemo(() => {
    if (qty <= 0 || qty > totalQ) return null;
    const fxRate = getFxRate();
    let remaining = qty;
    let fifoHufCost = 0;  // historikus HUF bekerülési ár az eladott lotokhoz
    let fifoCostNative = 0; // natív deviza cost basis
    const newLots = [];

    for (const lot of lots) {
      if (remaining <= 0) { newLots.push(lot); continue; }
      const lotQty = parseFloat(lot.quantity) || 0;
      const consume = Math.min(lotQty, remaining);

      // Historikus HUF cost: lot.hufTotal ha van (XTB-import), egyébként becslés aktuális FX-szel
      const lotHufPerShare = (lot.hufTotal != null && lot.hufTotal > 0 && lotQty > 0)
        ? lot.hufTotal / lotQty
        : (parseFloat(lot.price) || 0) * fxRate;
      fifoHufCost += consume * lotHufPerShare;
      fifoCostNative += consume * (parseFloat(lot.price) || 0);

      if (lotQty <= remaining) {
        remaining -= lotQty; // lot teljesen elfogy
      } else {
        // Részleges fogyasztás: arányosan csökkentjük hufTotal-t
        const keptFraction = (lotQty - consume) / lotQty;
        newLots.push({
          ...lot,
          quantity: lotQty - consume,
          hufTotal: lot.hufTotal != null
            ? Math.round(lot.hufTotal * keptFraction)
            : undefined,
          hufPerShare: lot.hufPerShare,
        });
        remaining = 0;
      }
    }

    const proceedsNative = price * qty;
    const fxRate2 = getFxRate();
    const proceedsHuf = Math.round(proceedsNative * fxRate2);
    const pnlNative = proceedsNative - fifoCostNative;
    const pnlHuf = proceedsHuf - Math.round(fifoHufCost);
    const pnlPct = fifoHufCost > 0 ? (pnlHuf / fifoHufCost) * 100 : 0;

    return { newLots, fifoHufCost: Math.round(fifoHufCost), fifoCostNative, proceedsNative, proceedsHuf, pnlNative, pnlHuf, pnlPct };
  }, [qty, price, lots, fxRates, inv.currency]); // eslint-disable-line react-hooks/exhaustive-deps

  const isValid = qty > 0 && qty <= totalQ && price > 0 && hasValidFx;

  const inputStyle = {
    width: "100%", background: T.bg.inset, border: `1px solid ${T.border.default}`,
    borderRadius: T.radius.md, padding: "10px 12px", color: T.text.primary,
    fontSize: 14, fontFamily: "inherit", outline: "none", boxSizing: "border-box",
  };
  const labelStyle = { display: "block", fontSize: 11, color: T.text.secondary, marginBottom: 5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" };

  const handleSell = () => {
    if (!isValid || !fifo) return;
    haptic("medium");

    const fullyClose = fifo.newLots.length === 0 || calcTotalQty(fifo.newLots) <= 0;
    const fxRate = getFxRate();

    const sale = {
      id:           uid(),
      invId:        inv.id,
      name:         inv.name,
      ticker:       inv.ticker,
      sellPrice:    price,
      quantity:     qty,
      fifoHufCost:  fifo.fifoHufCost,
      realizedPnL:  fifo.pnlNative,  // natív deviza (kompatibilitás)
      pnlHuf:       fifo.pnlHuf,     // historikus HUF P&L
      currency:     inv.currency,
      date:         sellDate,
      notes,
    };

    // Lezárt pozíció rekord (full close esetén)
    let closedPosition = null;
    if (fullyClose) {
      const oldestDate = lots.map(l => l.date).filter(Boolean).sort()[0] || "";
      closedPosition = {
        id:           uid(),
        name:         inv.name,
        ticker:       inv.ticker,
        xtbTicker:    inv.xtbTicker || null,
        category:     inv.category,
        currency:     inv.currency,
        closed:       true,
        volume:       qty,
        openPrice:    calcAvgBuyPrice(lots),
        closePrice:   price,
        openUsdPrice: calcAvgBuyPrice(lots), // backward compat field
        closeUsdPrice: price,
        openDate:     oldestDate,
        closeDate:    sellDate,
        purchaseHuf:  fifo.fifoHufCost,
        saleHuf:      fifo.proceedsHuf,
        hufOpenPx:    qty > 0 ? Math.round(fifo.fifoHufCost / qty) : 0,
        hufClosePx:   qty > 0 ? Math.round(fifo.proceedsHuf / qty) : 0,
        pnl:          fifo.pnlHuf,
        pnlPct:       fifo.pnlPct,
        product:      "",
      };
    }

    onSell({
      updatedInv: {
        ...inv,
        lots:         fifo.newLots,
        quantity:     calcTotalQty(fifo.newLots),
        buyPrice:     calcAvgBuyPrice(fifo.newLots),
        realizedPnL:  (inv.realizedPnL || 0) + fifo.pnlNative,
        sales:        [...(inv.sales || []), sale],
      },
      sale,
      fullyClose,
      closedPosition,
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

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={labelStyle}>Eladási ár ({inv.currency})</label>
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

          {!hasValidFx && (
            <div style={{ padding: "10px 12px", borderRadius: T.radius.md, background: "rgba(252,165,165,0.08)", border: "1px solid rgba(252,165,165,0.25)", color: T.accent.red, fontSize: 12 }}>
              ⚠️ Nincs érvényes {inv.currency}/HUF árfolyam. Frissítsd a devizaárfolyamokat az eladás rögzítése előtt.
            </div>
          )}

          {/* P&L előnézet */}
          {isValid && fifo && (
            <div style={{ ...glassCard(T, { padding: 14 }), background: fifo.pnlHuf >= 0 ? "rgba(110,231,183,0.08)" : "rgba(252,165,165,0.08)", border: `1px solid ${fifo.pnlHuf >= 0 ? "rgba(110,231,183,0.25)" : "rgba(252,165,165,0.25)"}` }}>
              <div style={{ fontSize: 11, color: T.text.tertiary, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 12, fontWeight: 700 }}>Realizált P&L előnézet (FIFO)</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                {[
                  ["Bevétel",         fmtNum(fifo.proceedsNative, 0) + " " + inv.currency],
                  ["FIFO cost basis", fmtNum(fifo.fifoHufCost, 0) + " HUF"],
                  ["P&L (HUF)",       (fifo.pnlHuf >= 0 ? "+" : "") + fmtNum(fifo.pnlHuf, 0) + " HUF"],
                  ["Hozam",           (fifo.pnlPct >= 0 ? "+" : "") + fmtNum(fifo.pnlPct, 2) + "%"],
                ].map(([l, v], i) => (
                  <div key={l}>
                    <div style={{ fontSize: 10, color: T.text.tertiary, marginBottom: 2 }}>{l}</div>
                    <div style={{ fontSize: 14, fontWeight: 700, fontFamily: "'DM Mono',monospace", color: i >= 2 ? (fifo.pnlHuf >= 0 ? T.accent.green : T.accent.red) : T.text.primary }}>{v}</div>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 10, fontSize: 11, color: T.text.tertiary }}>
                FIFO: historikus HUF bekerülési ár · {inv.currency !== "HUF" && `aktuális FX: ${Math.round(getFxRate())} HUF`}
              </div>
            </div>
          )}

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
