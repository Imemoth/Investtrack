// Pure investment ↔ DB row conversion (no Supabase client dependency — importable in tests)
//
// DB columns added by migration:
//   supabase/migrations/20261006_add_quote_state_to_investments.sql
//   quote_status TEXT, refreshed_at TIMESTAMPTZ, native_price NUMERIC,
//   native_currency TEXT, xtb_ticker TEXT

export function investmentToDb(inv, userId) {
  return {
    id:             inv.id,
    user_id:        userId,
    name:           inv.name,
    ticker:         inv.ticker || null,
    category:       inv.category || "Részvény",
    currency:       inv.currency || "HUF",
    current_price:  inv.currentPrice || 0,
    realized_pnl:   inv.realizedPnL || 0,
    dividend_yield: inv.dividendYield ? parseFloat(inv.dividendYield) : null,
    target_price:   inv.targetPrice  ? parseFloat(inv.targetPrice)   : null,
    notes:          inv.notes || null,
    lots:           inv.lots  || [],
    sales:          inv.sales || [],
    // Quote-state fields (require migration before they persist)
    quote_status:     inv.quoteStatus    ?? null,
    refreshed_at:     inv._refreshedAt   ?? null,
    native_price:     inv._nativePrice   ?? null,
    native_currency:  inv._nativeCurrency ?? null,
    xtb_ticker:       inv.xtbTicker      ?? null,
  };
}

export function dbToInvestment(row) {
  return {
    id:             row.id,
    name:           row.name,
    ticker:         row.ticker || "",
    category:       row.category || "Részvény",
    currency:       row.currency || "HUF",
    currentPrice:   row.current_price  || 0,
    realizedPnL:    row.realized_pnl   || 0,
    dividendYield:  row.dividend_yield || "",
    targetPrice:    row.target_price   || "",
    notes:          row.notes || "",
    lots:           row.lots  || [],
    sales:          row.sales || [],
    createdAt:      row.created_at,
    // Quote-state: restored from DB; getQuoteStatus() may override fresh→stale by age
    quoteStatus:    row.quote_status    || null,
    _refreshedAt:   row.refreshed_at    || null,
    _nativePrice:   row.native_price    || null,
    _nativeCurrency:row.native_currency || null,
    xtbTicker:      row.xtb_ticker      || null,
  };
}
