import { CATEGORIES, CURRENCIES } from "../constants";

// ─── FORMÁZÁS ─────────────────────────────────────────────────────────────────
export function fmtNum(n, dec = 2) {
  if (n === null || n === undefined || isNaN(n)) return "—";
  return new Intl.NumberFormat("hu-HU", { minimumFractionDigits: dec, maximumFractionDigits: dec }).format(n);
}

export function fmtCurrency(n, currency = "HUF") {
  if (n === null || isNaN(n)) return "—";
  return new Intl.NumberFormat("hu-HU", { style: "currency", currency, maximumFractionDigits: 0 }).format(n);
}

export function uid() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

// ─── LOT-ALAPÚ SZÁMÍTÁSOK ─────────────────────────────────────────────────────

// Súlyozott átlag vételár a lots tömbből
export function calcAvgBuyPrice(lots = []) {
  const totalQty  = lots.reduce((s, l) => s + (parseFloat(l.quantity) || 0), 0);
  const totalCost = lots.reduce((s, l) => s + (parseFloat(l.price) || 0) * (parseFloat(l.quantity) || 0), 0);
  return totalQty > 0 ? totalCost / totalQty : 0;
}

// Összes mennyiség
export function calcTotalQty(lots = []) {
  return lots.reduce((s, l) => s + (parseFloat(l.quantity) || 0), 0);
}

// Befektetett tőke (cost basis)
export function calcCostBasis(lots = []) {
  return lots.reduce((s, l) => s + (parseFloat(l.price) || 0) * (parseFloat(l.quantity) || 0), 0);
}

// P&L számítás – lot-alapú, natív devizában
export function calcPnL(inv) {
  const lots       = inv.lots || [];
  const totalQty   = calcTotalQty(lots);
  const cost       = calcCostBasis(lots);
  const value      = (inv.currentPrice || 0) * totalQty;
  const unrealizedAbs = value - cost;
  const unrealizedPct = cost > 0 ? (unrealizedAbs / cost) * 100 : 0;
  const realizedAbs   = inv.realizedPnL || 0;
  const totalAbs      = unrealizedAbs + realizedAbs;

  // Visszafelé kompatibilitás (régi egylot modell)
  const avgBuyPrice = lots.length > 0 ? calcAvgBuyPrice(lots) : (inv.buyPrice || 0);
  const quantity    = lots.length > 0 ? totalQty : (inv.quantity || 0);
  const costBasis   = lots.length > 0 ? cost : (inv.buyPrice || 0) * (inv.quantity || 0);
  const mktValue    = (inv.currentPrice || 0) * quantity;

  return {
    cost:           costBasis,
    value:          mktValue,
    abs:            mktValue - costBasis,
    pct:            costBasis > 0 ? ((mktValue - costBasis) / costBasis) * 100 : 0,
    avgBuyPrice,
    quantity,
    unrealizedAbs,
    unrealizedPct,
    realizedAbs,
    totalAbs,
  };
}

// HUF-normált P&L számítás portfólió összesítőkhöz
// fxRates: { USD: 385, EUR: 420, GBP: 475, HUF: 1 }
//
// Bekerülési ár prioritásrend (sosem kever aktuális árfolyamot a historikus adatba):
//   1. lot.hufTotal  – XTB Cash Operations vagy manuál Ft bevitel (immutable)
//   2. lot.hufPerShare × qty – XTB-ből számított per-share historikus HUF
//   3. lot.impliedFxRate × price × qty – vételkori árfolyam × natív ár
//   4. price × qty × currentFxRate – becslés, jelölve hasEstimatedCost=true
//
// hasEstimatedCost: ha bármelyik lot-hoz nem volt historikus HUF adat
export function calcPnLHuf(inv, fxRates = {}) {
  const lots = inv.lots || [];
  const totalQty = calcTotalQty(lots);
  const rawFxRate = inv.currency === "HUF" ? 1 : parseFloat(fxRates[inv.currency]);
  const hasMissingFx = inv.currency !== "HUF" && (!Number.isFinite(rawFxRate) || rawFxRate <= 0);
  const fxRate = hasMissingFx ? null : rawFxRate;

  let costHuf = 0;
  let hasEstimatedCost = false;
  let hasUnvaluedEstimatedCost = false;

  for (const l of lots) {
    const qty = parseFloat(l.quantity) || 0;
    if (qty <= 0) continue;

    if (l.hufTotal != null && l.hufTotal > 0) {
      costHuf += l.hufTotal;
    } else if (l.hufPerShare != null && l.hufPerShare > 0) {
      costHuf += l.hufPerShare * qty;
    } else if (l.impliedFxRate != null && l.impliedFxRate > 0) {
      costHuf += (parseFloat(l.price) || 0) * qty * l.impliedFxRate;
    } else {
      // Nincs historikus HUF adat — csak akkor becsülhető, ha van érvényes aktuális FX.
      hasEstimatedCost = true;
      if (fxRate == null) {
        hasUnvaluedEstimatedCost = true;
      } else {
        costHuf += (parseFloat(l.price) || 0) * qty * fxRate;
      }
    }
  }

  // Aktuális piaci érték csak érvényes FX mellett számolható.
  const quoteStatus = getQuoteStatus(inv);
  const quoteAvailable = quoteStatus !== "missing" && quoteStatus !== "unsupported";
  const valuationAvailable = !hasMissingFx && !hasUnvaluedEstimatedCost && quoteAvailable;
  const valueHuf = valuationAvailable ? (inv.currentPrice || 0) * totalQty * fxRate : 0;
  const pnlHuf   = valuationAvailable ? valueHuf - costHuf : 0;
  const pnlPct   = valuationAvailable && costHuf > 0 ? (pnlHuf / costHuf) * 100 : 0;

  return {
    costHuf,
    valueHuf,
    pnlHuf,
    pnlPct,
    totalQty,
    fxRate,
    hasEstimatedCost,
    hasMissingFx,
    quoteStatus,
    valuationAvailable,
  };
}

// Árfolyam-frissítés állapota egy pozícióhoz
// "unsupported" – ismeretlen tőzsde-szuffix, XTB-ből jön, nincs Yahoo mapping
// "missing"     – nincs aktuális ár (currentPrice = 0/null)
// "stale"       – van ár de nem friss (> 8 óra)
// "fresh"       – frissen frissített (< 8 óra)
export function getQuoteStatus(inv) {
  if (inv.quoteStatus === "unsupported") return "unsupported";
  if (!inv.currentPrice || inv.currentPrice <= 0) return "missing";
  if (!inv._refreshedAt) return "stale";
  const ageMs = Date.now() - new Date(inv._refreshedAt).getTime();
  return ageMs < 8 * 3600 * 1000 ? "fresh" : "stale";
}

// Lot HUF bekerülési ár kiszámítása mentéskor
// Ha a felhasználó megadott Ft összeget (amount) → hufTotal = amount
// Ha nincs amount → becsülés aktuális fxRate-tel
export function lotWithHufTotal(lot, fxRate = 1) {
  const price = parseFloat(lot.price) || 0;
  const qty   = parseFloat(lot.quantity) || 0;
  const amt   = parseFloat(lot.amount);
  const hufTotal = (isFinite(amt) && amt > 0) ? amt : Math.round(price * qty * fxRate);
  const { amount: _ignored, ...rest } = lot; // amount csak form-state, nem persistálódik
  return { ...rest, price, quantity: qty, hufTotal: hufTotal || undefined };
}

// ─── MIGRÁCIÓ: v1 → v2 ────────────────────────────────────────────────────────
// Régi egylet modell → lots tömb
export function migrateInvestment(inv) {
  if (inv.lots && inv.lots.length > 0) return inv; // már v2
  return {
    ...inv,
    lots: [{
      id:       uid(),
      price:    inv.buyPrice || 0,
      quantity: inv.quantity || 0,
      date:     inv.buyDate  || "",
      notes:    "",
    }],
    realizedPnL: inv.realizedPnL || 0,
    sales:       inv.sales || [],
    // Régi mezők megtartása visszafelé kompatibilitáshoz
    buyPrice:  inv.buyPrice,
    quantity:  inv.quantity,
    buyDate:   inv.buyDate,
  };
}

export function migrateAll(investments) {
  return investments.map(migrateInvestment);
}

// ─── CSV ──────────────────────────────────────────────────────────────────────
export function exportCSV(investments) {
  const header = ["Név","Ticker","Kategória","Átlag vételár","Összmennyiség","Jelenlegi ár","Deviza","Első vétel","Realizált P&L","Megjegyzés"];
  const rows   = investments.map(inv => {
    const { avgBuyPrice, quantity } = calcPnL(inv);
    const firstDate = inv.lots?.length > 0
      ? inv.lots.map(l => l.date).filter(Boolean).sort()[0] || ""
      : (inv.buyDate || "");
    return [inv.name, inv.ticker, inv.category, avgBuyPrice, quantity, inv.currentPrice, inv.currency, firstDate, inv.realizedPnL || 0, inv.notes];
  });
  const csv = [header, ...rows].map(r => r.map(c => `"${String(c ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href = url; a.download = `befektetes_${new Date().toISOString().slice(0,10)}.csv`; a.click();
  URL.revokeObjectURL(url);
}

export function parseCSV(text) {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) throw new Error("Üres CSV fájl");
  const rows = lines.slice(1).map(line => {
    const cols = []; let cur = "", inQ = false;
    for (let i = 0; i < line.length; i++) {
      if (line[i] === '"') { inQ = !inQ; continue; }
      if (line[i] === "," && !inQ) { cols.push(cur); cur = ""; continue; }
      cur += line[i];
    }
    cols.push(cur); return cols;
  });

  // Sor → lot objektum
  const parsed = rows.map(r => ({
    name:     r[0] || "",
    ticker:   r[1] || "",
    category: CATEGORIES.includes(r[2]) ? r[2] : "Egyéb",
    currency: CURRENCIES.includes(r[6]) ? r[6] : "HUF",
    lot: {
      id:       uid(),
      price:    parseFloat(r[3]) || 0,
      quantity: parseFloat(r[4]) || 0,
      date:     r[7] || "",
      notes:    r[9] || "",
    },
    notes: r[9] || "",
  })).filter(r => r.name && r.lot.quantity > 0);

  // Ugyanaz a ticker → összevonás lots tömbbé
  const byTicker = new Map();
  for (const row of parsed) {
    const key = row.ticker || row.name;
    if (byTicker.has(key)) {
      byTicker.get(key).lots.push(row.lot);
    } else {
      byTicker.set(key, {
        id:           uid(),
        name:         row.name,
        ticker:       row.ticker,
        category:     row.category,
        currency:     row.currency,
        currentPrice: 0,
        realizedPnL:  0,
        sales:        [],
        notes:        row.notes,
        lots:         [row.lot],
      });
    }
  }

  return Array.from(byTicker.values());
}
