// services/xtbImporter.js
// XTB xStation5 XLSX export → InvestTrack v2 formátum
// Szükséges: npm install xlsx (SheetJS) – már telepítve van a React appban

import * as XLSX from "xlsx";
import { uid } from "../utils";

function cleanTicker(xtbTicker) {
  if (!xtbTicker) return "";
  if (xtbTicker.endsWith(".US")) return xtbTicker.replace(".US", "");
  // EU tickerek maradnak: ASML.NL, HAG.DE, DAXEX.DE stb.
  return xtbTicker;
}

function getCategory(ticker = "") {
  if (ticker.endsWith(".DE") || ticker.includes("ETF")) return "ETF";
  return "Részvény";
}

function parseComment(comment = "") {
  // "OPEN BUY 0.1351 @ 65.50" vagy "CLOSE BUY 0.33 @ 117.21"
  try {
    const parts = String(comment).trim().split(/\s+/);
    const qty   = parseFloat(parts[2]);
    const price = parseFloat(parts[4]);
    if (!isNaN(qty) && !isNaN(price)) return { qty, price };
  } catch {}
  return null;
}

function excelDateToStr(val) {
  if (!val) return "";
  if (val instanceof Date) return val.toISOString().slice(0, 10);
  if (typeof val === "string") return val.slice(0, 10);
  // Excel serial number → Date
  try {
    const d = XLSX.SSF.parse_date_code(val);
    return `${d.y}-${String(d.m).padStart(2,"0")}-${String(d.d).padStart(2,"0")}`;
  } catch { return ""; }
}

export function parseXTBFile(arrayBuffer) {
  const wb = XLSX.read(arrayBuffer, { type: "array", cellDates: true });

  const positions = new Map();

  const getPos = (ticker, name) => {
    if (!positions.has(ticker)) {
      positions.set(ticker, {
        id:           uid(),
        name:         name || ticker,
        ticker:       cleanTicker(ticker),
        xtbTicker:    ticker,
        category:     getCategory(ticker),
        currency:     "HUF",
        currentPrice: 0,
        realizedPnL:  0,
        dividends:    0,
        sales:        [],
        lots:         [],
        notes:        `XTB import · ${ticker}`,
      });
    }
    return positions.get(ticker);
  };

  // ── 1. Cash Operations sheet ──────────────────────────────────────────────
  if (wb.SheetNames.includes("Cash Operations")) {
    const ws   = wb.Sheets["Cash Operations"];
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: "" });

    // Header sor megkeresése (Type, Ticker, Instrument, Time, Amount, ...)
    let headerIdx = rows.findIndex(r => r[0] === "Type" && r[1] === "Ticker");
    if (headerIdx < 0) headerIdx = 4;

    for (let i = headerIdx + 1; i < rows.length; i++) {
      const [type, ticker, instrument, time, amount, id, comment] = rows[i];
      if (!ticker || !type) continue;

      const pos = getPos(ticker, instrument);
      const dateStr = typeof time === "string" ? time.slice(0, 10) : excelDateToStr(time);
      const amt = parseFloat(String(amount).replace(",", ".")) || 0;

      if (type === "Stock purchase" && String(comment).includes("OPEN BUY")) {
        const parsed = parseComment(comment);
        if (parsed) {
          pos.lots.push({
            id:       String(id) || uid(),
            price:    parsed.price,
            quantity: parsed.qty,
            date:     dateStr,
            notes:    "",
          });
          if (pos.name === ticker) pos.name = instrument || ticker;
        }
      } else if (type === "Stock sell" && String(comment).includes("CLOSE")) {
        const parsed = parseComment(comment);
        if (parsed) {
          pos.sales.push({
            date:     dateStr,
            qty:      parsed.qty,
            price:    parsed.price,
            proceeds: Math.abs(amt),
          });
        }
      } else if (type === "Dividend") {
        pos.dividends += amt;
      }
    }
  }

  // ── 2. Closed Positions sheet – realizált P&L ─────────────────────────────
  if (wb.SheetNames.includes("Closed Positions")) {
    const ws   = wb.Sheets["Closed Positions"];
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: "" });

    let headerIdx = rows.findIndex(r => r[0] === "Instrument" && r[2] === "Ticker");
    if (headerIdx < 0) headerIdx = 4;

    for (let i = headerIdx + 1; i < rows.length; i++) {
      const row = rows[i];
      const ticker = row[2];
      const pnl    = parseFloat(String(row[10]).replace(",", ".")) || 0;
      if (!ticker || isNaN(pnl)) continue;
      if (positions.has(ticker)) {
        positions.get(ticker).realizedPnL += pnl;
      }
    }
  }

  // ── 3. Szűrés: csak nyitott pozíciók (van lot) ───────────────────────────
  const result = [];
  for (const pos of positions.values()) {
    if (pos.lots.length === 0) continue; // lezárt pozíció, kihagyjuk

    // Cleanup: felesleges mezők törlése az export előtt
    const { xtbTicker, dividends, ...clean } = pos;
    if (dividends > 0) clean.notes += ` · Osztalék: ${dividends.toFixed(2)} HUF`;

    result.push(clean);
  }

  return result;
}
