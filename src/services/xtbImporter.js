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

// Detect currency from XTB ticker suffix
function getCurrencyFromTicker(ticker = "") {
  if (ticker.endsWith(".UK"))  return "GBP";
  if (ticker.endsWith(".FR") || ticker.endsWith(".DE") || ticker.endsWith(".NL") ||
      ticker.endsWith(".IT") || ticker.endsWith(".ES") || ticker.endsWith(".BE") ||
      ticker.endsWith(".AT") || ticker.endsWith(".FI") || ticker.endsWith(".PT")) return "EUR";
  return "USD";
}

function parseNum(val) {
  return parseFloat(String(val || "").replace(",", ".")) || 0;
}

function fmtDT(val) {
  if (!val) return "";
  if (typeof val === "string") return val.slice(0, 16);
  if (val instanceof Date)     return val.toISOString().slice(0, 16).replace("T", " ");
  return String(val).slice(0, 16);
}
function fmtD(val) { return fmtDT(val).slice(0, 10); }

// ─── OLD FORMAT helpers (Cash Operations-based open positions) ────────────────
function parseComment(comment = "") {
  try {
    const parts = String(comment).trim().split(/\s+/);
    const qty   = parseFloat(parts[2]);
    const price = parseFloat(parts[4]);
    if (!isNaN(qty) && !isNaN(price)) return { qty, price };
  } catch {}
  return null;
}

export function parseXTBFile(arrayBuffer) {
  const wb = XLSX.read(arrayBuffer, { type: "array", cellDates: true });
  appLog.info(`XTB import: ${wb.SheetNames.join(", ")}`);

  const hasOpenSheet = wb.SheetNames.includes("Open Positions");

  // ── A. Cash Operations → HUF amounts indexed by Position ID + dividends ──
  const cashByPositionId   = new Map(); // positionId → { amount, ticker }
  const dividendsByTicker  = new Map(); // ticker → HUF sum
  // For old-format fallback: open positions built from Cash Operations
  const openFromCash       = new Map(); // ticker → position obj

  if (wb.SheetNames.includes("Cash Operations")) {
    const ws   = wb.Sheets["Cash Operations"];
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: "" });

    // Detect format: new header has "Instrument" at [1], old has "Ticker" at [1]
    let hi = rows.findIndex(r => r[0] === "Type" && (r[1] === "Instrument" || r[1] === "Ticker"));
    if (hi < 0) hi = 4;
    const isNew = rows[hi]?.[1] === "Instrument";
    appLog.info(`Cash Operations format: ${isNew ? "új (2024+)" : "régi"}`);

    for (let i = hi + 1; i < rows.length; i++) {
      let type, instrument, ticker, time, amount, id, comment, positionId;
      if (isNew) {
        // New: Type | Instrument | Ticker | Category | Time | Amount | ID | Comment | Product | Position ID
        [type, instrument, ticker, , time, amount, id, comment, , positionId] = rows[i];
      } else {
        // Old: Type | Ticker | Instrument | Time | Amount | ID | Comment
        [type, ticker, instrument, time, amount, id, comment] = rows[i];
        positionId = id; // old format: use row ID for matching
      }
      if (!type) continue;

      const amt = parseNum(amount);

      // Index Stock purchase by Position ID (new format) for lot cost lookup
      if (positionId && type === "Stock purchase") {
        cashByPositionId.set(String(positionId), { amount: amt, ticker, time });
      }

      // Dividends (+ Withholding tax is already deducted in practice, include gross)
      if (type === "Dividend" && ticker) {
        dividendsByTicker.set(ticker, (dividendsByTicker.get(ticker) || 0) + amt);
      }

      // Old-format fallback: build open positions from Cash Operations
      if (!hasOpenSheet) {
        if (!ticker && !type) continue;
        if (!openFromCash.has(ticker)) {
          openFromCash.set(ticker, {
            id: uid(), name: instrument || ticker,
            ticker: resolveYahooTicker(ticker), xtbTicker: ticker,
            category: getCategory(ticker, instrument),
            currency: "HUF", currentPrice: 0,
            realizedPnL: 0, dividends: 0, sales: [], lots: [],
            notes: `XTB · ${ticker}`,
          });
        }
        const pos = openFromCash.get(ticker);
        if (type === "Stock purchase" && String(comment).includes("OPEN BUY")) {
          const p = parseComment(comment);
          if (p?.qty > 0) {
            const hufTotal    = Math.abs(amt);
            const hufPerShare = Math.round((hufTotal / p.qty) * 100) / 100;
            pos.lots.push({
              id: String(id) || uid(),
              price: hufPerShare, quantity: p.qty,
              date: fmtD(time), datetime: fmtDT(time),
              hufTotal, impliedFxRate: Math.round((hufPerShare / p.price) * 100) / 100,
            });
          }
        } else if (type === "Stock sell" && String(comment).includes("CLOSE")) {
          const p = parseComment(comment);
          if (p) {
            pos.sales.push({
              date: fmtD(time), datetime: fmtDT(time),
              qty: p.qty, proceeds: Math.abs(amt),
            });
          }
        } else if (type === "Dividend") {
          pos.dividends += amt;
        }
      }
    }
  }

  const closedPositions = [];
  const openResult      = [];

  // ── B. Open Positions sheet (new format: 2024+) ───────────────────────────
  // Header (row 10): Product | Instrument/Position | Ticker | Category | Type |
  //                  Volume  | Value  | Current price | Open price | Open time |
  //                  Stop Loss | Take Profit | Net Profit % | Net Profit | Gross Profit | Margin
  if (hasOpenSheet) {
    const ws   = wb.Sheets["Open Positions"];
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: "" });
    let hi = rows.findIndex(r => r[1] === "Instrument/Position" && r[2] === "Ticker");
    if (hi < 0) hi = 10;

    const nameByTicker    = new Map();
    const lotsByTicker    = new Map();
    const currentByTicker = new Map();

    for (let i = hi + 1; i < rows.length; i++) {
      const r = rows[i];
      const [, nameOrId, ticker, category, type, volume, value, currentPrice, openPrice, openTime] = r;
      if (!ticker) continue;

      const vol = parseNum(volume);
      if (!vol) continue;

      if (!type) {
        // Summary row → instrument name for this ticker
        nameByTicker.set(ticker, { name: nameOrId, category });
        currentByTicker.set(ticker, parseNum(currentPrice) || parseNum(openPrice));
      } else if (type === "BUY") {
        if (!lotsByTicker.has(ticker)) lotsByTicker.set(ticker, []);
        const posId      = String(nameOrId);
        const cashEntry  = cashByPositionId.get(posId);
        // HUF cost: from Cash Operations if available, else current value (approximate)
        const hufTotal   = cashEntry ? Math.abs(cashEntry.amount) : parseNum(value);
        const openPr     = parseNum(openPrice);
        const hufPerShare = vol > 0 ? Math.round((hufTotal / vol) * 100) / 100 : 0;

        lotsByTicker.get(ticker).push({
          id: posId || uid(),
          price: openPr, quantity: vol,
          date: fmtD(openTime), datetime: fmtDT(openTime),
          hufTotal, hufPerShare,
          impliedFxRate: openPr > 0 ? Math.round(hufPerShare / openPr * 100) / 100 : 0,
          notes: "",
        });
        appLog.info(`OPEN: ${ticker} ${vol}db @${openPr} = ${hufTotal.toFixed(0)} HUF`);
      }
    }

    for (const [ticker, lots] of lotsByTicker) {
      if (!lots.length) continue;
      const info      = nameByTicker.get(ticker) || { name: ticker, category: "" };
      const currency  = getCurrencyFromTicker(ticker);
      const divs      = dividendsByTicker.get(ticker) || 0;
      const curPrice  = currentByTicker.get(ticker) || 0;

      openResult.push({
        id: uid(),
        name: info.name || ticker,
        ticker: resolveYahooTicker(ticker), xtbTicker: ticker,
        category: getCategory(ticker, info.name, info.category),
        currency,
        currentPrice: curPrice,
        realizedPnL: 0, sales: [], lots,
        notes: `XTB · ${ticker}${divs > 0 ? ` · Osztalék: ${divs.toFixed(0)} HUF` : ""}`,
      });
    }

  } else {
    // Old format fallback: filter open positions from Cash Operations
    for (const pos of openFromCash.values()) {
      const bought    = pos.lots.reduce((s, l) => s + l.quantity, 0);
      const sold      = pos.sales.reduce((s, s2) => s + s2.qty, 0);
      const remaining = Math.round((bought - sold) * 1e8) / 1e8;
      if (!pos.lots.length || remaining <= 0.000001) {
        appLog.info(`KIHAGYVA: ${pos.xtbTicker}`); continue;
      }
      const { xtbTicker, dividends, ...clean } = pos;
      if (dividends > 0) clean.notes += ` · Osztalék: ${dividends.toFixed(0)} HUF`;
      openResult.push(clean);
    }
  }

  // ── C. Closed Positions ───────────────────────────────────────────────────
  // Old col order: Instrument | Category | Ticker | Type | Volume | ...
  // New col order: Instrument | Ticker   | Category | Type | Volume | ...
  if (wb.SheetNames.includes("Closed Positions")) {
    const ws   = wb.Sheets["Closed Positions"];
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: "" });
    let hi = rows.findIndex(r => r[0] === "Instrument" && (r[1] === "Ticker" || r[2] === "Ticker"));
    if (hi < 0) hi = 4;
    const isNew = rows[hi]?.[1] === "Ticker"; // new: Ticker at [1], old: Category at [1]

    for (let i = hi + 1; i < rows.length; i++) {
      const r = rows[i];
      let instrument, cat, ticker, type, volume, openPrice, openTime,
          closePrice, closeTime, product, pnl, purchaseValue, saleValue;

      if (isNew) {
        [instrument, ticker, cat, type, volume, openPrice, openTime,
         closePrice, closeTime, product, pnl, , purchaseValue, saleValue] = r;
      } else {
        [instrument, cat, ticker, type, volume, openPrice, openTime,
         closePrice, closeTime, product, pnl, , purchaseValue, saleValue] = r;
      }

      if (!ticker || !instrument) continue;
      const vol         = parseNum(volume);
      const pnlVal      = parseNum(pnl);
      const purchaseHuf = parseNum(purchaseValue);
      const saleHuf     = parseNum(saleValue);
      if (!vol) continue;

      closedPositions.push({
        id: uid(),
        name: instrument,
        ticker: resolveYahooTicker(ticker), xtbTicker: ticker,
        category:      getCategory(ticker, instrument, cat),
        currency:      getCurrencyFromTicker(ticker),
        closed:        true,
        volume:        vol,
        openUsdPrice:  parseNum(openPrice),
        closeUsdPrice: parseNum(closePrice),
        openTime:      fmtDT(openTime),
        closeTime:     fmtDT(closeTime),
        openDate:      fmtD(openTime),
        closeDate:     fmtD(closeTime),
        purchaseHuf,
        saleHuf,
        hufOpenPx:     vol > 0 ? Math.round((purchaseHuf / vol) * 100) / 100 : 0,
        hufClosePx:    vol > 0 ? Math.round((saleHuf / vol) * 100) / 100 : 0,
        pnl:           pnlVal,
        pnlPct:        purchaseHuf > 0 ? (pnlVal / purchaseHuf) * 100 : 0,
        product:       product || "",
      });
      appLog.info(`CLOSED: ${ticker} ${vol}db | $${parseNum(openPrice)} → $${parseNum(closePrice)} | P&L ${pnlVal.toFixed(0)} HUF`);
    }
  }

  appLog.info(`✓ Import: ${openResult.length} nyitott, ${closedPositions.length} lezárt`);
  return { open: openResult, closed: closedPositions };
}
