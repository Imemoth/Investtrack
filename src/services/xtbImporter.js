// services/xtbImporter.js
// XTB xStation5 XLSX → InvestTrack v2
// FONTOS: minden ár és érték HUF-ban tárolódik
// A vételár = amount(HUF) / quantity, így az akkori árfolyam automatikusan benne van

import * as XLSX from "xlsx";
import { uid } from "../utils";
import { appLog } from "./logger";

// Yahoo ticker mapping – az árfrissítéshez kell
function resolveYahooTicker(xtbTicker = "") {
  if (xtbTicker.endsWith(".US"))  return xtbTicker.replace(".US", "");
  if (xtbTicker.endsWith(".NL"))  return xtbTicker.replace(".NL", "");
  if (xtbTicker.endsWith(".UK"))  return xtbTicker.replace(".UK", ".L");
  // .DE marad (pl. HAG.DE Yahoo-n is HAG.DE)
  return xtbTicker;
}

function getCategory(xtbTicker = "", instrumentName = "") {
  const name = instrumentName.toUpperCase();
  if (name.includes("ETF") || name.includes("UCITS")) return "ETF";
  return "Részvény";
}

function parseComment(comment = "") {
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
      positions.set(xtbTicker, {
        id:           uid(),
        name:         name || xtbTicker,
        ticker:       resolveYahooTicker(xtbTicker),
        xtbTicker,
        category:     getCategory(xtbTicker, name),
        currency:     "HUF",   // MINDEN HUF-ban tárolódik
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

  // ── Cash Operations ────────────────────────────────────────────────────────
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
      // amount: negatív = vétel (HUF ment ki), pozitív = eladás (HUF jött be)
      const amt     = parseFloat(String(amount).replace(",", ".")) || 0;

      if (type === "Stock purchase" && String(comment).includes("OPEN BUY")) {
        const parsed = parseComment(comment);
        if (parsed && parsed.qty > 0) {
          const hufTotal    = Math.abs(amt);                    // pl. 5445 HUF
          const hufPerShare = hufTotal / parsed.qty;            // HUF/db vételár

          pos.lots.push({
            id:       String(id) || uid(),
            price:    Math.round(hufPerShare * 100) / 100,      // HUF/db
            quantity: parsed.qty,
            date:     dateStr,
            notes:    `${parsed.qty}db @ $${parsed.price}`,     // eredetit megjegyezzük
          });
          if (pos.name === ticker) pos.name = instrument || ticker;
          appLog.info(`XTB lot: ${ticker} ${parsed.qty}db @ ${hufPerShare.toFixed(0)} HUF/db (${hufTotal.toFixed(0)} HUF)`);
        }
      } else if (type === "Stock sell" && String(comment).includes("CLOSE")) {
        const parsed = parseComment(comment);
        if (parsed) {
          pos.sales.push({
            date:     dateStr,
            qty:      parsed.qty,
            price:    parsed.price,
            proceeds: Math.abs(amt),  // HUF bevétel
          });
        }
      } else if (type === "Dividend") {
        pos.dividends += amt;
      }
    }
  }

  // ── Closed Positions: realizált P&L (HUF-ban van az XTB-ben) ──────────────
  if (wb.SheetNames.includes("Closed Positions")) {
    const ws   = wb.Sheets["Closed Positions"];
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: "" });

    let headerIdx = rows.findIndex(r => r[0] === "Instrument" && r[2] === "Ticker");
    if (headerIdx < 0) headerIdx = 4;

    for (let i = headerIdx + 1; i < rows.length; i++) {
      const row    = rows[i];
      const ticker = row[2];
      const pnl    = parseFloat(String(row[10]).replace(",", ".")) || 0;
      if (!ticker) continue;
      if (positions.has(ticker)) {
        positions.get(ticker).realizedPnL += pnl;
        appLog.info(`XTB realizált P&L: ${ticker} ${pnl.toFixed(0)} HUF`);
      }
    }
  }

  // ── Szűrés: csak nyitott pozíciók ─────────────────────────────────────────
  const result = [];
  for (const pos of positions.values()) {
    const totalBought = pos.lots.reduce((s, l) => s + l.quantity, 0);
    const totalSold   = pos.sales.reduce((s, s2) => s + s2.qty, 0);
    const remaining   = Math.round((totalBought - totalSold) * 1e8) / 1e8;

    appLog.info(`XTB: ${pos.xtbTicker} | lots=${pos.lots.length} remaining=${remaining.toFixed(4)}`);

    if (pos.lots.length === 0 || remaining <= 0.000001) {
      appLog.info(`→ KIHAGYVA (lezárt): ${pos.xtbTicker}`);
      continue;
    }

    const { xtbTicker, dividends, ...clean } = pos;
    if (dividends > 0) clean.notes += ` · Osztalék: ${dividends.toFixed(0)} HUF`;
    result.push(clean);
  }

  appLog.info(`✓ XTB import kész: ${result.length} nyitott pozíció (HUF alapú)`);
  return result;
}
