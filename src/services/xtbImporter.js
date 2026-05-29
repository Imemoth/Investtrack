// services/xtbImporter.js
// XTB xStation5 XLSX export → InvestTrack v2 formátum

import * as XLSX from "xlsx";
import { uid } from "../utils";
import { appLog } from "./logger";

// XTB ticker → Yahoo ticker + natív deviza
function resolveTickerInfo(xtbTicker = "") {
  if (xtbTicker.endsWith(".US")) {
    return { ticker: xtbTicker.replace(".US", ""), currency: "USD" };
  }
  if (xtbTicker.endsWith(".NL")) {
    // ASML.NL → Yahoo-n ASML (US listing USD-ben)
    return { ticker: xtbTicker.replace(".NL", ""), currency: "USD" };
  }
  if (xtbTicker.endsWith(".DE")) {
    // HAG.DE → Yahoo-n HAG.DE (EUR)
    return { ticker: xtbTicker, currency: "EUR" };
  }
  if (xtbTicker.endsWith(".UK") || xtbTicker.endsWith(".L")) {
    return { ticker: xtbTicker.replace(".UK", ".L"), currency: "GBP" };
  }
  // Ismeretlen → megtartjuk, USD feltételezés
  return { ticker: xtbTicker, currency: "USD" };
}

function getCategory(xtbTicker = "", instrumentName = "") {
  const name = instrumentName.toUpperCase();
  if (name.includes("ETF") || name.includes("UCITS")) return "ETF";
  if (xtbTicker.endsWith(".DE") && name.includes("ETF")) return "ETF";
  return "Részvény";
}

function parseComment(comment = "") {
  // "OPEN BUY 0.1351 @ 65.50" vagy "CLOSE SELL 0.09 @ 192.15"
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
  try {
    const d = XLSX.SSF.parse_date_code(val);
    return `${d.y}-${String(d.m).padStart(2,"0")}-${String(d.d).padStart(2,"0")}`;
  } catch { return ""; }
}

export function parseXTBFile(arrayBuffer) {
  const wb = XLSX.read(arrayBuffer, { type: "array", cellDates: true });
  appLog.info(`XTB import: sheet-ek: ${wb.SheetNames.join(", ")}`);

  const positions = new Map();

  const getPos = (xtbTicker, name) => {
    if (!positions.has(xtbTicker)) {
      const { ticker, currency } = resolveTickerInfo(xtbTicker);
      positions.set(xtbTicker, {
        id:           uid(),
        name:         name || ticker,
        ticker,
        xtbTicker,
        category:     getCategory(xtbTicker, name),
        currency,         // USD / EUR / GBP – natív deviza
        currentPrice: 0,
        realizedPnL:  0,
        dividends:    0,
        sales:        [],
        lots:         [],
        notes:        `XTB import · ${xtbTicker}`,
      });
    }
    return positions.get(xtbTicker);
  };

  // ── Cash Operations sheet ─────────────────────────────────────────────────
  if (wb.SheetNames.includes("Cash Operations")) {
    const ws   = wb.Sheets["Cash Operations"];
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: "" });

    let headerIdx = rows.findIndex(r => r[0] === "Type" && r[1] === "Ticker");
    if (headerIdx < 0) headerIdx = 4;

    for (let i = headerIdx + 1; i < rows.length; i++) {
      const [type, ticker, instrument, time, amount, id, comment] = rows[i];
      if (!ticker || !type) continue;

      const pos     = getPos(ticker, instrument);
      const dateStr = typeof time === "string" ? time.slice(0, 10) : excelDateToStr(time);
      const amt     = parseFloat(String(amount).replace(",", ".")) || 0;

      if (type === "Stock purchase" && String(comment).includes("OPEN BUY")) {
        const parsed = parseComment(comment);
        if (parsed) {
          pos.lots.push({
            id:       String(id) || uid(),
            price:    parsed.price,   // natív devizában (USD/EUR)
            quantity: parsed.qty,
            date:     dateStr,
            notes:    "",
          });
          if (pos.name === ticker) pos.name = instrument || ticker;
          appLog.info(`XTB lot: ${ticker} ${parsed.qty}db @ ${parsed.price} ${pos.currency}`);
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

  // ── Closed Positions sheet ────────────────────────────────────────────────
  if (wb.SheetNames.includes("Closed Positions")) {
    const ws   = wb.Sheets["Closed Positions"];
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: "" });

    let headerIdx = rows.findIndex(r => r[0] === "Instrument" && r[2] === "Ticker");
    if (headerIdx < 0) headerIdx = 4;

    for (let i = headerIdx + 1; i < rows.length; i++) {
      const row    = rows[i];
      const ticker = row[2];
      const pnl    = parseFloat(String(row[10]).replace(",", ".")) || 0;
      if (!ticker || isNaN(pnl)) continue;
      if (positions.has(ticker)) {
        positions.get(ticker).realizedPnL += pnl;
      }
    }
  }

  // ── Szűrés: csak nyitott pozíciók ────────────────────────────────────────
  const result = [];
  for (const pos of positions.values()) {
    const totalBought = pos.lots.reduce((s, l) => s + l.quantity, 0);
    const totalSold   = pos.sales.reduce((s, s2) => s + s2.qty, 0);
    const remaining   = Math.round((totalBought - totalSold) * 1e8) / 1e8;

    appLog.info(`XTB pozíció: ${pos.xtbTicker} | lots=${pos.lots.length} bought=${totalBought.toFixed(4)} sold=${totalSold.toFixed(4)} remaining=${remaining.toFixed(4)} deviza=${pos.currency}`);

    if (pos.lots.length === 0 || remaining <= 0.000001) {
      appLog.info(`→ KIHAGYVA (lezárt): ${pos.xtbTicker}`);
      continue;
    }

    const { xtbTicker, dividends, ...clean } = pos;
    if (dividends > 0) clean.notes += ` · Osztalék: ${dividends.toFixed(2)} HUF`;
    result.push(clean);
  }

  appLog.info(`✓ XTB import kész: ${result.length} nyitott pozíció`);
  return result;
}
