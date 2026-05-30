import * as XLSX from "xlsx";
import { uid } from "../utils";
import { appLog } from "./logger";

function resolveYahooTicker(xtbTicker = "") {
  if (xtbTicker.endsWith(".US"))  return xtbTicker.replace(".US", "");
  if (xtbTicker.endsWith(".NL"))  return xtbTicker.replace(".NL", "");
  if (xtbTicker.endsWith(".UK"))  return xtbTicker.replace(".UK", ".L");
  return xtbTicker;
}

function getCategory(xtbTicker = "", instrumentName = "", cat = "") {
  if (cat === "ETF") return "ETF";
  const name = (instrumentName || "").toUpperCase();
  if (name.includes("ETF") || name.includes("UCITS") || name.includes("DAX") || name.includes("NASDAQ 100")) return "ETF";
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

function fmtDT(val) {
  if (!val) return "";
  if (typeof val === "string") return val.slice(0, 16);
  if (val instanceof Date)     return val.toISOString().slice(0, 16).replace("T", " ");
  return String(val).slice(0, 16);
}
function fmtD(val) { return fmtDT(val).slice(0, 10); }

export function parseXTBFile(arrayBuffer) {
  const wb = XLSX.read(arrayBuffer, { type: "array", cellDates: true });
  appLog.info(`XTB import: ${wb.SheetNames.join(", ")}`);

  const openPositions   = new Map(); // nyitott pozíciók (Cash Operations alapján)
  const closedPositions = [];        // lezárt pozíciók (Closed Positions alapján)

  // ── 1. Cash Operations → nyitott pozíciók ────────────────────────────────
  if (wb.SheetNames.includes("Cash Operations")) {
    const ws   = wb.Sheets["Cash Operations"];
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: "" });
    let hi = rows.findIndex(r => r[0] === "Type" && r[1] === "Ticker");
    if (hi < 0) hi = 4;

    for (let i = hi + 1; i < rows.length; i++) {
      const [type, ticker, instrument, time, amount, id, comment] = rows[i];
      if (!ticker || !type) continue;

      if (!openPositions.has(ticker)) {
        openPositions.set(ticker, {
          id: uid(), name: instrument || ticker,
          ticker: resolveYahooTicker(ticker), xtbTicker: ticker,
          category: getCategory(ticker, instrument),
          currency: "HUF", currentPrice: 0,
          realizedPnL: 0, dividends: 0, sales: [], lots: [],
          notes: `XTB · ${ticker}`,
        });
      }
      const pos = openPositions.get(ticker);
      const amt = parseFloat(String(amount).replace(",", ".")) || 0;

      if (type === "Stock purchase" && String(comment).includes("OPEN BUY")) {
        const p = parseComment(comment);
        if (p?.qty > 0) {
          const hufTotal    = Math.abs(amt);
          const hufPerShare = Math.round((hufTotal / p.qty) * 100) / 100;
          pos.lots.push({
            id: String(id) || uid(),
            price: hufPerShare, quantity: p.qty,
            date: fmtD(time), datetime: fmtDT(time),
            usdPrice: p.price, hufTotal,
            impliedFxRate: Math.round((hufPerShare / p.price) * 100) / 100,
            notes: "",
          });
          appLog.info(`OPEN: ${ticker} ${p.qty}db @$${p.price} = ${hufTotal.toFixed(0)} HUF`);
        }
      } else if (type === "Stock sell" && String(comment).includes("CLOSE")) {
        const p = parseComment(comment);
        if (p) {
          const hufProceeds = Math.abs(amt);
          pos.sales.push({
            date: fmtD(time), datetime: fmtDT(time),
            qty: p.qty, usdPrice: p.price,
            proceeds: hufProceeds,
            hufPerShare: Math.round((hufProceeds / p.qty) * 100) / 100,
          });
          appLog.info(`CLOSE: ${ticker} ${p.qty}db @$${p.price} = ${hufProceeds.toFixed(0)} HUF`);
        }
      } else if (type === "Dividend") {
        pos.dividends += amt;
      }
    }
  }

  // ── 2. Closed Positions → lezárt pozíciók ────────────────────────────────
  // Header: Instrument, Category, Ticker, Type, Volume, Open Price, Open Time,
  //         Close Price, Close Time, Product, Profit/Loss, Gross Profit,
  //         Purchase Value, Sale Value, ...
  if (wb.SheetNames.includes("Closed Positions")) {
    const ws   = wb.Sheets["Closed Positions"];
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: "" });
    let hi = rows.findIndex(r => r[0] === "Instrument" && r[2] === "Ticker");
    if (hi < 0) hi = 4;

    for (let i = hi + 1; i < rows.length; i++) {
      const r = rows[i];
      const [instrument, cat, ticker, type, volume, openPrice, openTime,
             closePrice, closeTime, product, pnl, , purchaseValue, saleValue] = r;

      if (!ticker || !instrument) continue;
      const pnlVal  = parseFloat(String(pnl).replace(",", ".")) || 0;
      if (isNaN(pnlVal) && !ticker) continue;

      // Realizált P&L hozzáadása a nyitott pozícióhoz ha van
      if (openPositions.has(ticker)) {
        openPositions.get(ticker).realizedPnL += pnlVal;
      }

      // Lezárt pozíció rekord
      if (instrument && ticker && parseFloat(String(volume).replace(",", "."))) {
        const vol         = parseFloat(String(volume).replace(",", ".")) || 0;
        const openPr      = parseFloat(String(openPrice).replace(",", ".")) || 0;
        const closePr     = parseFloat(String(closePrice).replace(",", ".")) || 0;
        const purchaseHuf = parseFloat(String(purchaseValue).replace(",", ".")) || 0;
        const saleHuf     = parseFloat(String(saleValue).replace(",", ".")) || 0;
        const hufOpenPx   = vol > 0 ? Math.round((purchaseHuf / vol) * 100) / 100 : 0;
        const hufClosePx  = vol > 0 ? Math.round((saleHuf / vol) * 100) / 100 : 0;

        closedPositions.push({
          id:           uid(),
          name:         instrument,
          ticker:       resolveYahooTicker(ticker),
          xtbTicker:    ticker,
          category:     getCategory(ticker, instrument, cat),
          currency:     "HUF",
          closed:       true,                    // lezárt jelző
          volume:       vol,
          openUsdPrice: openPr,
          closeUsdPrice:closePr,
          openTime:     fmtDT(openTime),
          closeTime:    fmtDT(closeTime),
          openDate:     fmtD(openTime),
          closeDate:    fmtD(closeTime),
          purchaseHuf,
          saleHuf,
          hufOpenPx,
          hufClosePx,
          pnl:          pnlVal,
          pnlPct:       purchaseHuf > 0 ? ((pnlVal / purchaseHuf) * 100) : 0,
          product:      product || "",
        });
        appLog.info(`CLOSED: ${ticker} ${vol}db | nyitás $${openPr} → zárás $${closePr} | P&L ${pnlVal.toFixed(0)} HUF`);
      }
    }
  }

  // ── 3. Nyitott pozíciók szűrése ───────────────────────────────────────────
  const openResult = [];
  for (const pos of openPositions.values()) {
    const bought    = pos.lots.reduce((s, l) => s + l.quantity, 0);
    const sold      = pos.sales.reduce((s, s2) => s + s2.qty, 0);
    const remaining = Math.round((bought - sold) * 1e8) / 1e8;
    if (pos.lots.length === 0 || remaining <= 0.000001) {
      appLog.info(`KIHAGYVA (lezárt/nincs lot): ${pos.xtbTicker}`);
      continue;
    }
    const { xtbTicker, dividends, ...clean } = pos;
    if (dividends > 0) clean.notes += ` · Osztalék: ${dividends.toFixed(0)} HUF`;
    openResult.push(clean);
  }

  appLog.info(`✓ Import: ${openResult.length} nyitott, ${closedPositions.length} lezárt pozíció`);
  return { open: openResult, closed: closedPositions };
}
