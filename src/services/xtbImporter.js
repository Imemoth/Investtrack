// services/xtbImporter.js
// XTB xStation5 XLSX → InvestTrack v2
// Minden adat megőrizve: dátum, USD ár, HUF összeg, mennyiség

import * as XLSX from "xlsx";
import { uid } from "../utils";
import { appLog } from "./logger";

function resolveYahooTicker(xtbTicker = "") {
  if (xtbTicker.endsWith(".US"))  return xtbTicker.replace(".US", "");
  if (xtbTicker.endsWith(".NL"))  return xtbTicker.replace(".NL", "");
  if (xtbTicker.endsWith(".UK"))  return xtbTicker.replace(".UK", ".L");
  return xtbTicker;
}

function getCategory(xtbTicker = "", instrumentName = "") {
  const name = instrumentName.toUpperCase();
  if (name.includes("ETF") || name.includes("UCITS") ||
      name.includes("DAX") || name.includes("NASDAQ 100")) return "ETF";
  return "Részvény";
}

function parseComment(comment = "") {
  // "OPEN BUY 0.1351 @ 65.50"
  try {
    const parts = String(comment).trim().split(/\s+/);
    const qty   = parseFloat(parts[2]);
    const price = parseFloat(parts[4]);
    if (!isNaN(qty) && !isNaN(price)) return { qty, price };
  } catch {}
  return null;
}

function formatDateTime(val) {
  if (!val) return "";
  if (typeof val === "string") {
    // "2026-05-22 19:38:23.070000" → "2026-05-22 19:38"
    return val.slice(0, 16);
  }
  if (val instanceof Date) {
    return val.toISOString().slice(0, 16).replace("T", " ");
  }
  return String(val).slice(0, 16);
}

function formatDate(val) {
  return formatDateTime(val).slice(0, 10);
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
        currency:     "HUF",
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

      const pos = getPos(ticker, instrument);
      const amt = parseFloat(String(amount).replace(",", ".")) || 0;

      if (type === "Stock purchase" && String(comment).includes("OPEN BUY")) {
        const parsed = parseComment(comment);
        if (parsed && parsed.qty > 0) {
          const hufTotal    = Math.abs(amt);
          const hufPerShare = Math.round((hufTotal / parsed.qty) * 100) / 100;
          const impliedFx   = Math.round((hufPerShare / parsed.price) * 100) / 100;

          pos.lots.push({
            id:           String(id) || uid(),
            // HUF/db – ez megy a számításokba
            price:        hufPerShare,
            quantity:     parsed.qty,
            date:         formatDate(time),
            // Extra info a részletes nézethez
            usdPrice:     parsed.price,
            hufTotal:     hufTotal,
            impliedFxRate: impliedFx,
            datetime:     formatDateTime(time),
            notes:        "",
          });

          if (pos.name === ticker) pos.name = instrument || ticker;
          appLog.info(`XTB lot: ${ticker} | ${parsed.qty}db | @${parsed.price} USD | ${hufTotal.toFixed(0)} HUF | ${formatDate(time)} | fx~${impliedFx}`);
        }

      } else if (type === "Stock sell" && String(comment).includes("CLOSE")) {
        const parsed = parseComment(comment);
        if (parsed) {
          const hufProceeds = Math.abs(amt);
          pos.sales.push({
            date:         formatDate(time),
            datetime:     formatDateTime(time),
            qty:          parsed.qty,
            usdPrice:     parsed.price,
            proceeds:     hufProceeds,  // HUF bevétel
            hufPerShare:  Math.round((hufProceeds / parsed.qty) * 100) / 100,
          });
          appLog.info(`XTB eladás: ${ticker} | ${parsed.qty}db | @${parsed.price} USD | ${hufProceeds.toFixed(0)} HUF | ${formatDate(time)}`);
        }

      } else if (type === "Dividend") {
        pos.dividends += amt;
      }
    }
  }

  // ── Closed Positions: realizált P&L ───────────────────────────────────────
  if (wb.SheetNames.includes("Closed Positions")) {
    const ws   = wb.Sheets["Closed Positions"];
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: "" });

    let headerIdx = rows.findIndex(r => r[0] === "Instrument" && r[2] === "Ticker");
    if (headerIdx < 0) headerIdx = 4;

    for (let i = headerIdx + 1; i < rows.length; i++) {
      const row = rows[i];
      const ticker = row[2];
      const pnl    = parseFloat(String(row[10]).replace(",", ".")) || 0;
      if (!ticker) continue;
      if (positions.has(ticker)) {
        positions.get(ticker).realizedPnL += pnl;
        appLog.info(`XTB realizált P&L: ${ticker} = ${pnl.toFixed(0)} HUF`);
      }
    }
  }

  // ── Szűrés: nyitott pozíciók ──────────────────────────────────────────────
  const result = [];
  for (const pos of positions.values()) {
    const totalBought = pos.lots.reduce((s, l) => s + l.quantity, 0);
    const totalSold   = pos.sales.reduce((s, s2) => s + s2.qty, 0);
    const remaining   = Math.round((totalBought - totalSold) * 1e8) / 1e8;

    if (pos.lots.length === 0 || remaining <= 0.000001) {
      appLog.info(`→ KIHAGYVA (lezárt): ${pos.xtbTicker}`);
      continue;
    }

    const { xtbTicker, dividends, ...clean } = pos;
    if (dividends > 0) clean.notes += ` · Osztalék: ${dividends.toFixed(0)} HUF`;
    result.push(clean);
    appLog.info(`✓ Nyitott: ${pos.xtbTicker} | ${remaining.toFixed(4)}db | ${pos.lots.length} lot`);
  }

  appLog.info(`✓ XTB import kész: ${result.length} pozíció`);
  return result;
}
