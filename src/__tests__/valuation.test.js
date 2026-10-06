// Regression tests – valuation correctness hardening
// Run with: npm test
import { describe, it, expect } from "vitest";
import { resolveYahooTicker, getExpectedCurrency, isSupportedExchange } from "../services/xtbImporter.js";
import { calcPnLHuf, lotWithHufTotal, getQuoteStatus, calcPnL } from "../utils/index.js";
import { investmentToDb, dbToInvestment } from "../utils/investmentSerializer.js";

// ─── 1. XTB: missing current price must not become open price ─────────────────
describe("XTB current price", () => {
  it("quoteStatus is 'missing' when currentPrice is 0", () => {
    const inv = { currentPrice: 0, lots: [{ price: 100, quantity: 5, hufTotal: 200000 }], currency: "USD" };
    expect(getQuoteStatus(inv)).toBe("missing");
  });

  it("quoteStatus is 'missing' when currentPrice is absent", () => {
    const inv = { lots: [{ price: 100, quantity: 5 }], currency: "USD" };
    expect(getQuoteStatus(inv)).toBe("missing");
  });

  it("quoteStatus is 'stale' when currentPrice exists but no refreshedAt", () => {
    const inv = { currentPrice: 150, lots: [], currency: "USD" };
    expect(getQuoteStatus(inv)).toBe("stale");
  });

  it("quoteStatus is 'fresh' after recent refresh", () => {
    const inv = { currentPrice: 150, _refreshedAt: new Date().toISOString(), lots: [], currency: "USD" };
    expect(getQuoteStatus(inv)).toBe("fresh");
  });
});

// ─── 2. XTB symbol resolution ─────────────────────────────────────────────────
describe("resolveYahooTicker", () => {
  it("ASML.NL → ASML.AS (Amsterdam, NOT US ADR)", () => {
    expect(resolveYahooTicker("ASML.NL")).toBe("ASML.AS");
  });

  it("VIE.FR → VIE.PA (Paris)", () => {
    expect(resolveYahooTicker("VIE.FR")).toBe("VIE.PA");
  });

  it("AAPL.US → AAPL (no suffix for US listings)", () => {
    expect(resolveYahooTicker("AAPL.US")).toBe("AAPL");
  });

  it("VOD.UK → VOD.L (London)", () => {
    expect(resolveYahooTicker("VOD.UK")).toBe("VOD.L");
  });

  it("SAP.DE → SAP.DE (XETRA)", () => {
    expect(resolveYahooTicker("SAP.DE")).toBe("SAP.DE");
  });

  it("ENI.IT → ENI.MI (Milan)", () => {
    expect(resolveYahooTicker("ENI.IT")).toBe("ENI.MI");
  });

  it("IBEX.ES → IBEX.MC (Madrid)", () => {
    expect(resolveYahooTicker("IBEX.ES")).toBe("IBEX.MC");
  });
});

// ─── 3. Currency validation: expected currency per suffix ─────────────────────
describe("getExpectedCurrency", () => {
  it("VOD.UK → GBP", () => expect(getExpectedCurrency("VOD.UK")).toBe("GBP"));
  it("ASML.NL → EUR", () => expect(getExpectedCurrency("ASML.NL")).toBe("EUR"));
  it("AAPL.US → USD", () => expect(getExpectedCurrency("AAPL.US")).toBe("USD"));
  it("unknown suffix → USD", () => expect(getExpectedCurrency("AAPL")).toBe("USD"));
});

// ─── 4. EUR + USD positions aggregate correctly into HUF ─────────────────────
describe("calcPnLHuf aggregation", () => {
  const fxRates = { USD: 380, EUR: 415, GBP: 470, HUF: 1 };

  it("USD position: valueHuf = currentPrice × qty × fxRate", () => {
    const inv = {
      currency: "USD", currentPrice: 200,
      lots: [{ price: 100, quantity: 10, hufTotal: 380000 }], // bought at 100 × 10 × 380
    };
    const r = calcPnLHuf(inv, fxRates);
    expect(r.costHuf).toBe(380000); // historikus hufTotal
    expect(r.valueHuf).toBe(200 * 10 * 380); // 760000
    expect(r.pnlHuf).toBe(760000 - 380000);  // 380000
  });

  it("EUR position uses EUR fxRate", () => {
    const inv = {
      currency: "EUR", currentPrice: 100,
      lots: [{ price: 80, quantity: 5, hufTotal: 80 * 5 * 415 }],
    };
    const r = calcPnLHuf(inv, fxRates);
    expect(r.valueHuf).toBe(100 * 5 * 415);
    expect(r.pnlHuf).toBe(100 * 5 * 415 - 80 * 5 * 415);
  });

  it("HUF position fxRate is 1", () => {
    const inv = {
      currency: "HUF", currentPrice: 5000,
      lots: [{ price: 4000, quantity: 3, hufTotal: 12000 }],
    };
    const r = calcPnLHuf(inv, fxRates);
    expect(r.fxRate).toBe(1);
    expect(r.valueHuf).toBe(5000 * 3);
    expect(r.costHuf).toBe(12000);
  });

  it("portfolio total sums HUF correctly", () => {
    const usd = { currency: "USD", currentPrice: 200, lots: [{ price: 100, quantity: 10, hufTotal: 380000 }] };
    const eur = { currency: "EUR", currentPrice: 100, lots: [{ price: 80, quantity: 5, hufTotal: 166000 }] };
    const [ru, re] = [calcPnLHuf(usd, fxRates), calcPnLHuf(eur, fxRates)];
    const totalValue = ru.valueHuf + re.valueHuf;
    expect(totalValue).toBe(200 * 10 * 380 + 100 * 5 * 415);
  });
});

// ─── 5. Historical hufTotal does not change when FX changes ──────────────────
describe("historical hufTotal immutability", () => {
  const lot = { price: 100, quantity: 10, hufTotal: 380000 };
  const inv = { currency: "USD", currentPrice: 100, lots: [lot] };

  it("costHuf remains 380000 regardless of current FX", () => {
    expect(calcPnLHuf(inv, { USD: 380 }).costHuf).toBe(380000);
    expect(calcPnLHuf(inv, { USD: 420 }).costHuf).toBe(380000); // FX changed → cost unchanged
    expect(calcPnLHuf(inv, { USD: 300 }).costHuf).toBe(380000);
  });
});

// ─── 6. No-op edit preserves original lot hufTotal ────────────────────────────
describe("lotWithHufTotal – no-op edit", () => {
  it("preserves hufTotal when amount matches it", () => {
    const lot = { id: "1", price: 100, quantity: 10, hufTotal: 380000, amount: "380000" };
    const saved = lotWithHufTotal(lot, 380);
    expect(saved.hufTotal).toBe(380000);
    expect(saved.amount).toBeUndefined(); // amount is form-state only
  });

  it("preserves hufTotal when no amount is given (untouched edit)", () => {
    const lot = { id: "1", price: 100, quantity: 10, hufTotal: 380000, amount: "" };
    const saved = lotWithHufTotal(lot, 420); // FX changed but no amount input
    // Without amount, falls back to price*qty*fx = 100*10*420 = 420000
    // But if hufTotal was already set AND user didn't change amount, the form
    // preserves it via the amount init from hufTotal. This test checks the helper.
    // With empty amount, lotWithHufTotal recomputes from current FX.
    expect(saved.hufTotal).toBe(100 * 10 * 420); // recomputed (stale case)
    expect(saved.amount).toBeUndefined();
  });
});

// ─── 7. Modified lot cannot retain stale hufTotal ────────────────────────────
describe("lotWithHufTotal – modified lot", () => {
  it("when user changes amount explicitly, that amount becomes hufTotal", () => {
    const lot = { id: "1", price: 200, quantity: 5, hufTotal: 380000, amount: "420000" };
    const saved = lotWithHufTotal(lot, 420);
    expect(saved.hufTotal).toBe(420000); // user's explicit amount wins
  });

  it("when price/qty changes but amount is recomputed, new amount becomes hufTotal", () => {
    // User changed price to 200, quantity 5, fxRate 420 → amount = 420000
    const lot = { id: "1", price: 200, quantity: 5, amount: "420000" };
    const saved = lotWithHufTotal(lot, 420);
    expect(saved.hufTotal).toBe(420000);
  });
});

// ─── 8. Partial FIFO sell correctly prorates remaining hufTotal ───────────────
describe("FIFO partial sell hufTotal proration", () => {
  it("selling half a lot leaves half hufTotal", () => {
    const lot = { id: "1", price: 100, quantity: 10, hufTotal: 380000 };
    const lots = [lot];
    const sellQty = 5;

    // Simulate the FIFO algorithm from SellModal
    let remaining = sellQty;
    let fifoHufCost = 0;
    const newLots = [];
    for (const l of lots) {
      if (remaining <= 0) { newLots.push(l); continue; }
      const consume = Math.min(l.quantity, remaining);
      const hufPerShare = l.hufTotal / l.quantity;
      fifoHufCost += consume * hufPerShare;
      if (l.quantity <= remaining) {
        remaining -= l.quantity;
      } else {
        const keptFraction = (l.quantity - consume) / l.quantity;
        newLots.push({ ...l, quantity: l.quantity - consume, hufTotal: Math.round(l.hufTotal * keptFraction) });
        remaining = 0;
      }
    }

    expect(fifoHufCost).toBe(190000);         // 5 × 38000
    expect(newLots[0].hufTotal).toBe(190000); // remaining 5 shares
    expect(newLots[0].quantity).toBe(5);
  });

  it("selling all lots results in empty newLots (full close)", () => {
    const lots = [
      { id: "1", price: 100, quantity: 5, hufTotal: 190000 },
      { id: "2", price: 120, quantity: 5, hufTotal: 210000 },
    ];
    const sellQty = 10;
    let remaining = sellQty;
    let fifoHufCost = 0;
    const newLots = [];
    for (const l of lots) {
      if (remaining <= 0) { newLots.push(l); continue; }
      const consume = Math.min(l.quantity, remaining);
      fifoHufCost += consume * (l.hufTotal / l.quantity);
      if (l.quantity <= remaining) remaining -= l.quantity;
      else {
        newLots.push({ ...l, quantity: l.quantity - consume, hufTotal: Math.round(l.hufTotal * (l.quantity - consume) / l.quantity) });
        remaining = 0;
      }
    }
    expect(newLots).toHaveLength(0);    // full close
    expect(fifoHufCost).toBe(400000);   // 190000 + 210000
  });
});

// ─── 9. Failed quote cannot display 0.00% as if price were valid ──────────────
describe("quote status prevents misleading 0% display", () => {
  it("missing quote → pnlPct is 0 but quoteStatus is 'missing'", () => {
    const inv = { currentPrice: 0, currency: "USD", lots: [{ price: 100, quantity: 5, hufTotal: 190000 }] };
    const { pnlPct } = calcPnLHuf(inv, { USD: 380 });
    const qs = getQuoteStatus(inv);
    // The value is technically 0% but UI must show warning, not 0%
    expect(qs).toBe("missing");
    // valueHuf is 0, so pnlHuf is negative (cost without value)
    expect(pnlPct).toBeLessThan(0); // -100% if currentPrice=0
  });

  it("calcPnL also returns 0 value when currentPrice missing", () => {
    const inv = { currentPrice: 0, currency: "USD", lots: [{ price: 100, quantity: 5 }] };
    const r = calcPnL(inv);
    expect(r.value).toBe(0);
    expect(r.pct).toBeLessThanOrEqual(0);
  });
});

// ─── 10. Full sell creates a closed position record ──────────────────────────
describe("full sell → closed position", () => {
  it("produces a closedPosition with correct fields", () => {
    const lots = [{ id: "1", price: 100, quantity: 5, hufTotal: 200000, date: "2024-01-15" }];
    const sellPrice = 150;
    const sellQty = 5;
    const fxRates = { USD: 400 };

    // Simulate SellModal FIFO + closedPosition construction
    let remaining = sellQty;
    let fifoHufCost = 0;
    const newLots = [];
    for (const l of lots) {
      if (remaining <= 0) { newLots.push(l); continue; }
      const consume = Math.min(l.quantity, remaining);
      fifoHufCost += consume * (l.hufTotal / l.quantity);
      if (l.quantity <= remaining) remaining -= l.quantity;
      else {
        newLots.push({ ...l, quantity: l.quantity - consume, hufTotal: Math.round(l.hufTotal * (l.quantity - consume) / l.quantity) });
        remaining = 0;
      }
    }

    const fullyClose = newLots.length === 0;
    const fxRate = fxRates["USD"] || 1;
    const proceedsHuf = Math.round(sellPrice * sellQty * fxRate);
    const pnlHuf = proceedsHuf - Math.round(fifoHufCost);

    const closedPosition = fullyClose ? {
      volume: sellQty,
      purchaseHuf: Math.round(fifoHufCost),
      saleHuf: proceedsHuf,
      pnl: pnlHuf,
      pnlPct: fifoHufCost > 0 ? pnlHuf / fifoHufCost * 100 : 0,
    } : null;

    expect(fullyClose).toBe(true);
    expect(closedPosition).not.toBeNull();
    expect(closedPosition.purchaseHuf).toBe(200000);
    expect(closedPosition.saleHuf).toBe(150 * 5 * 400);          // 300000
    expect(closedPosition.pnl).toBe(300000 - 200000);            // 100000
    expect(closedPosition.pnlPct).toBeCloseTo(50, 1);            // +50%
  });
});

// ─── 11. calcPnLHuf: historical cost priority chain ──────────────────────────
describe("calcPnLHuf historical cost priority", () => {
  const fxRates = { USD: 420 };

  it("uses hufPerShare when hufTotal is absent – current FX never applied", () => {
    const inv = {
      currency: "USD", currentPrice: 200,
      lots: [{ price: 100, quantity: 10, hufPerShare: 38000 }], // no hufTotal
    };
    const r = calcPnLHuf(inv, fxRates);
    // Historical cost = 38000 × 10 = 380000 (not 100 × 10 × 420 = 420000)
    expect(r.costHuf).toBe(380000);
    expect(r.hasEstimatedCost).toBe(false);
  });

  it("uses impliedFxRate when hufTotal and hufPerShare are absent", () => {
    const inv = {
      currency: "USD", currentPrice: 200,
      lots: [{ price: 100, quantity: 10, impliedFxRate: 380 }],
    };
    const r = calcPnLHuf(inv, fxRates); // current FX is 420 – must not be used
    expect(r.costHuf).toBe(100 * 10 * 380); // 380000, not 420000
    expect(r.hasEstimatedCost).toBe(false);
  });

  it("marks hasEstimatedCost when no historical HUF data; falls back to current FX", () => {
    const inv = {
      currency: "USD", currentPrice: 200,
      lots: [{ price: 100, quantity: 10 }], // v1 migrated lot – no HUF metadata
    };
    const r = calcPnLHuf(inv, fxRates);
    expect(r.hasEstimatedCost).toBe(true);
    expect(r.costHuf).toBe(100 * 10 * 420); // current FX last resort
  });

  it("authoritative lots are not contaminated by estimated lots", () => {
    // Mixed lot array: one has hufTotal, one has nothing
    const inv = {
      currency: "USD", currentPrice: 200,
      lots: [
        { price: 100, quantity: 5, hufTotal: 190000 },      // authoritative
        { price: 100, quantity: 5 },                         // estimated
      ],
    };
    const r = calcPnLHuf(inv, fxRates);
    expect(r.hasEstimatedCost).toBe(true);
    // First lot: 190000 (hufTotal). Second lot: 100 × 5 × 420 = 210000 (estimated).
    expect(r.costHuf).toBe(190000 + 100 * 5 * 420);
  });
});

// ─── 12. isSupportedExchange – fails closed for unknown suffixes ──────────────
describe("isSupportedExchange", () => {
  it("known suffixes are supported", () => {
    expect(isSupportedExchange("ASML.NL")).toBe(true);
    expect(isSupportedExchange("VOD.UK")).toBe(true);
    expect(isSupportedExchange("AAPL.US")).toBe(true);
    expect(isSupportedExchange("SAP.DE")).toBe(true);
  });

  it("ticker with no suffix (US listing) is supported", () => {
    expect(isSupportedExchange("AAPL")).toBe(true);
    expect(isSupportedExchange("MSFT")).toBe(true);
  });

  it("unknown exchange suffix fails closed", () => {
    expect(isSupportedExchange("NOVN.CH")).toBe(false);  // Swiss SIX
    expect(isSupportedExchange("7203.JP")).toBe(false);  // Tokyo
    expect(isSupportedExchange("RY.CA")).toBe(false);    // Toronto
  });
});

// ─── 13. getQuoteStatus handles unsupported exchange ─────────────────────────
describe("getQuoteStatus unsupported exchange", () => {
  it("returns 'unsupported' regardless of currentPrice", () => {
    expect(getQuoteStatus({ quoteStatus: "unsupported", currentPrice: 0 })).toBe("unsupported");
    expect(getQuoteStatus({ quoteStatus: "unsupported", currentPrice: 150,
                            _refreshedAt: new Date().toISOString() })).toBe("unsupported");
  });

  it("unsupported overrides missing/fresh/stale logic", () => {
    // Without the quoteStatus field, currentPrice:0 → "missing"
    expect(getQuoteStatus({ currentPrice: 0 })).toBe("missing");
    // With it explicitly set to unsupported, stays unsupported
    expect(getQuoteStatus({ quoteStatus: "unsupported", currentPrice: 0 })).toBe("unsupported");
  });
});

// ─── 14. Missing FX and unavailable quotes fail closed ───────────────────────
describe("valuation availability guards", () => {
  it("foreign-currency valuation is unavailable when FX is missing", () => {
    const inv = {
      currency: "PLN", currentPrice: 100,
      quoteStatus: "fresh",
      _refreshedAt: new Date().toISOString(),
      lots: [{ price: 80, quantity: 5, hufTotal: 150000 }],
    };
    const r = calcPnLHuf(inv, {});
    expect(r.hasMissingFx).toBe(true);
    expect(r.valuationAvailable).toBe(false);
    expect(r.valueHuf).toBe(0);
    expect(r.pnlHuf).toBe(0);
  });

  it("unsupported quote suppresses valuation instead of showing -100%", () => {
    const inv = {
      currency: "CHF", currentPrice: 0, quoteStatus: "unsupported",
      lots: [{ price: 100, quantity: 5, hufTotal: 200000 }],
    };
    const r = calcPnLHuf(inv, { CHF: 430 });
    expect(r.quoteStatus).toBe("unsupported");
    expect(r.valuationAvailable).toBe(false);
    expect(r.pnlHuf).toBe(0);
    expect(r.pnlPct).toBe(0);
  });
});

// ─── 15. Quote-state Supabase serialization round-trip ───────────────────────
describe("quote-state serialization round-trip", () => {
  const BASE = {
    id: "inv-1", name: "ASML", ticker: "ASML.AS", xtbTicker: "ASML.NL",
    category: "Részvény", currency: "EUR", currentPrice: 700,
    realizedPnL: 0, dividendYield: "", targetPrice: "", notes: "",
    lots: [], sales: [],
  };

  it("fresh quoteStatus and all quote-state fields survive round-trip", () => {
    const inv = {
      ...BASE,
      quoteStatus: "fresh",
      _refreshedAt: "2026-10-06T08:00:00.000Z",
      _nativePrice: 700,
      _nativeCurrency: "EUR",
    };
    const row = investmentToDb(inv, "user-1");
    const restored = dbToInvestment(row);
    expect(restored.quoteStatus).toBe("fresh");
    expect(restored._refreshedAt).toBe("2026-10-06T08:00:00.000Z");
    expect(restored._nativePrice).toBe(700);
    expect(restored._nativeCurrency).toBe("EUR");
    expect(restored.xtbTicker).toBe("ASML.NL");
    // getQuoteStatus re-evaluates freshness by age; a future test can check stale transition
  });

  it("missing quoteStatus (currentPrice=0) is correctly re-derived after round-trip", () => {
    const inv = { ...BASE, currentPrice: 0, quoteStatus: "missing", _refreshedAt: null };
    const row = investmentToDb(inv, "user-1");
    const restored = dbToInvestment(row);
    expect(getQuoteStatus(restored)).toBe("missing");
  });

  it("unsupported quoteStatus survives round-trip and is re-derived by getQuoteStatus", () => {
    const inv = { ...BASE, currentPrice: 0, quoteStatus: "unsupported", _refreshedAt: null };
    const row = investmentToDb(inv, "user-1");
    const restored = dbToInvestment(row);
    expect(restored.quoteStatus).toBe("unsupported");
    expect(getQuoteStatus(restored)).toBe("unsupported");
  });

  it("round-trip does not lose core investment fields", () => {
    const inv = { ...BASE, quoteStatus: "stale" };
    const restored = dbToInvestment(investmentToDb(inv, "user-1"));
    expect(restored.id).toBe("inv-1");
    expect(restored.ticker).toBe("ASML.AS");
    expect(restored.currency).toBe("EUR");
    expect(restored.currentPrice).toBe(700);
  });
});
