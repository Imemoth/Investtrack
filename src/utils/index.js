import { CATEGORIES, CURRENCIES } from "../constants";

export function fmtNum(n, dec = 2) {
  if (n === null || n === undefined || isNaN(n)) return "—";
  return new Intl.NumberFormat("hu-HU", {
    minimumFractionDigits: dec,
    maximumFractionDigits: dec,
  }).format(n);
}

export function fmtCurrency(n, currency = "HUF") {
  if (n === null || isNaN(n)) return "—";
  return new Intl.NumberFormat("hu-HU", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(n);
}

export function calcPnL(inv) {
  const cost  = inv.buyPrice * inv.quantity;
  const value = inv.currentPrice * inv.quantity;
  const abs   = value - cost;
  const pct   = cost > 0 ? (abs / cost) * 100 : 0;
  return { cost, value, abs, pct };
}

export function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

// ─── CSV ──────────────────────────────────────────────────────────────────────
export function exportCSV(investments) {
  const header = ["Név","Ticker","Kategória","Vétel ár","Darab","Jelenlegi ár","Deviza","Vétel dátum","Megjegyzés"];
  const rows   = investments.map(inv => [
    inv.name, inv.ticker, inv.category,
    inv.buyPrice, inv.quantity, inv.currentPrice,
    inv.currency, inv.buyDate, inv.notes,
  ]);
  const csv = [header, ...rows]
    .map(r => r.map(c => `"${String(c ?? "").replace(/"/g, '""')}"`).join(","))
    .join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href = url;
  a.download = `befektetes_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function parseCSV(text) {
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
    id:           uid(),
    name:         r[0] || "",
    ticker:       r[1] || "",
    category:     CATEGORIES.includes(r[2]) ? r[2] : "Egyéb",
    buyPrice:     parseFloat(r[3]) || 0,
    quantity:     parseFloat(r[4]) || 0,
    currentPrice: 0,          // frissítés tölti fel helyesen
    currency:     CURRENCIES.includes(r[6]) ? r[6] : "HUF",
    buyDate:      r[7] || "",
    notes:        r[8] || "",
  })).filter(r => r.name);
}
