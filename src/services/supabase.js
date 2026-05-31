// src/services/supabase.js
// Supabase kliens + összes adat művelet

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL  = "https://mvuavscjumcsxwntfegi.supabase.co";
const SUPABASE_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im12dWF2c2NqdW1jc3h3bnRmZWdpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAxNjgyMDEsImV4cCI6MjA5NTc0NDIwMX0.ks1sShaisxeO_cUz7aubBdwFHkAHF5UOoqnUnA1t7hk";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON);

// ─── AUTH ─────────────────────────────────────────────────────────────────────
export async function signInWithGoogle() {
  return supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: window.location.origin },
  });
}

export async function signOut() {
  return supabase.auth.signOut();
}

export function onAuthStateChange(cb) {
  return supabase.auth.onAuthStateChange((event, session) => {
    cb(session?.user ?? null);
  });
}

export async function getUser() {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

// ─── INVESTMENTS ──────────────────────────────────────────────────────────────

// Összes befektetés lekérése
export async function fetchInvestments() {
  const userId = await getUserId();
  const { data, error } = await supabase
    .from("investments")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data.map(dbToInvestment);
}

// Egy befektetés upsert (insert vagy update)
export async function upsertInvestment(inv) {
  const userId = await getUserId();
  const { error } = await supabase
    .from("investments")
    .upsert(investmentToDb(inv, userId), { onConflict: "id" });
  if (error) throw error;
}

export async function upsertInvestments(invs) {
  if (!invs.length) return;
  const userId = await getUserId();
  const { error } = await supabase
    .from("investments")
    .upsert(invs.map(i => investmentToDb(i, userId)), { onConflict: "id" });
  if (error) throw error;
}

// Befektetés törlése
export async function deleteInvestment(id) {
  const { error } = await supabase
    .from("investments")
    .delete()
    .eq("id", id);
  if (error) throw error;
}

// Az összes befektetés törlése (portfólió nullázás)
export async function deleteAllInvestments() {
  const user = await getUser();
  if (!user) return;
  const { error } = await supabase
    .from("investments")
    .delete()
    .eq("user_id", user.id);
  if (error) throw error;
}

// DB ↔ App konverzió
async function getUserId() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Nincs bejelentkezett felhasználó");
  return user.id;
}

function investmentToDb(inv, userId) {
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
  };
}

function dbToInvestment(row) {
  return {
    id:            row.id,
    name:          row.name,
    ticker:        row.ticker || "",
    category:      row.category || "Részvény",
    currency:      row.currency || "HUF",
    currentPrice:  row.current_price  || 0,
    realizedPnL:   row.realized_pnl   || 0,
    dividendYield: row.dividend_yield || "",
    targetPrice:   row.target_price   || "",
    notes:         row.notes || "",
    lots:          row.lots  || [],
    sales:         row.sales || [],
    createdAt:     row.created_at,
  };
}

// ─── CLOSED POSITIONS ─────────────────────────────────────────────────────────

export async function fetchClosedPositions() {
  const userId = await getUserId();
  const { data, error } = await supabase
    .from("closed_positions")
    .select("*")
    .eq("user_id", userId)
    .order("close_date", { ascending: false });
  if (error) throw error;
  return data.map(dbToClosed);
}

export async function upsertClosedPositions(positions) {
  if (!positions.length) return;
  const userId = await getUserId();
  const { error } = await supabase
    .from("closed_positions")
    .upsert(positions.map(cp => closedToDb(cp, userId)), { onConflict: "id" });
  if (error) throw error;
}

export async function deleteAllClosedPositions() {
  const user = await getUser();
  if (!user) return;
  const { error } = await supabase
    .from("closed_positions")
    .delete()
    .eq("user_id", user.id);
  if (error) throw error;
}

function closedToDb(cp, userId) {
  return {
    id:               cp.id,
    user_id:          userId,
    name:             cp.name,
    ticker:           cp.ticker || null,
    xtb_ticker:       cp.xtbTicker || null,
    category:         cp.category || "Részvény",
    currency:         cp.currency || "HUF",
    volume:           cp.volume || 0,
    open_usd_price:   cp.openUsdPrice || 0,
    close_usd_price:  cp.closeUsdPrice || 0,
    open_time:        cp.openTime || null,
    close_time:       cp.closeTime || null,
    open_date:        cp.openDate || null,
    close_date:       cp.closeDate || null,
    purchase_huf:     cp.purchaseHuf || 0,
    sale_huf:         cp.saleHuf || 0,
    pnl:              cp.pnl || 0,
    pnl_pct:          cp.pnlPct || 0,
    product:          cp.product || null,
  };
}

function dbToClosed(row) {
  return {
    id:             row.id,
    name:           row.name,
    ticker:         row.ticker || "",
    xtbTicker:      row.xtb_ticker || "",
    category:       row.category || "Részvény",
    currency:       row.currency || "HUF",
    volume:         row.volume || 0,
    openUsdPrice:   row.open_usd_price || 0,
    closeUsdPrice:  row.close_usd_price || 0,
    openTime:       row.open_time || "",
    closeTime:      row.close_time || "",
    openDate:       row.open_date || "",
    closeDate:      row.close_date || "",
    purchaseHuf:    row.purchase_huf || 0,
    saleHuf:        row.sale_huf || 0,
    pnl:            row.pnl || 0,
    pnlPct:         row.pnl_pct || 0,
    product:        row.product || "",
  };
}

// ─── PENDING ORDERS ───────────────────────────────────────────────────────────

export async function fetchPendingOrders() {
  const userId = await getUserId();
  const { data, error } = await supabase
    .from("pending_orders")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data.map(dbToPending);
}

export async function upsertPendingOrder(order) {
  const userId = await getUserId();
  const { error } = await supabase
    .from("pending_orders")
    .upsert(pendingToDb(order, userId), { onConflict: "id" });
  if (error) throw error;
}

export async function deletePendingOrder(id) {
  const { error } = await supabase
    .from("pending_orders")
    .delete()
    .eq("id", id);
  if (error) throw error;
}

function pendingToDb(o, userId) {
  return {
    id:            o.id,
    user_id:       userId,
    name:          o.name,
    ticker:        o.ticker || null,
    type:          o.type || "Buy Limit",
    limit_price:   o.limitPrice || null,
    currency:      o.currency || "USD",
    quantity:      o.quantity || null,
    total_native:  o.totalNative || null,
    huf_total:     o.hufTotal || null,
    saved_fx_rate: o.savedFxRate || null,
    expiry:        o.expiry || null,
    notes:         o.notes || null,
  };
}

function dbToPending(row) {
  return {
    id:           row.id,
    name:         row.name,
    ticker:       row.ticker || "",
    type:         row.type || "Buy Limit",
    limitPrice:   row.limit_price || 0,
    currency:     row.currency || "USD",
    quantity:     row.quantity || 0,
    totalNative:  row.total_native || 0,
    hufTotal:     row.huf_total || 0,
    savedFxRate:  row.saved_fx_rate || 0,
    expiry:       row.expiry || "",
    notes:        row.notes || "",
    createdAt:    row.created_at,
  };
}

// ─── PORTFOLIO SNAPSHOT ───────────────────────────────────────────────────────

export async function savePortfolioSnapshot(totalValue, totalCost, totalPnl) {
  const userId = await getUserId();
  const today = new Date().toISOString().slice(0, 10);
  const { error } = await supabase
    .from("portfolio_snapshots")
    .upsert({ user_id: userId, date: today, total_value: totalValue, total_cost: totalCost, total_pnl: totalPnl },
             { onConflict: "user_id,date" });
  if (error) console.warn("Snapshot hiba:", error.message);
}

export async function fetchPortfolioHistory(days = 90) {
  const from = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from("portfolio_snapshots")
    .select("date, total_value, total_cost, total_pnl")
    .gte("date", from)
    .order("date", { ascending: true });
  if (error) throw error;
  return data;
}

// ─── MIGRÁLÁS: localStorage → Supabase ───────────────────────────────────────
export async function migrateFromLocalStorage() {
  try {
    const rawInv = JSON.parse(localStorage.getItem("investtrack_v2") || localStorage.getItem("investtrack_v1") || "[]");
    const rawClosed  = JSON.parse(localStorage.getItem("investtrack_closed") || "[]");
    const rawPending = JSON.parse(localStorage.getItem("investtrack_pending_v1") || "[]");

    if (rawInv.length)     await upsertInvestments(rawInv);
    if (rawClosed.length)  await upsertClosedPositions(rawClosed);
    for (const o of rawPending) await upsertPendingOrder(o);

    console.log(`✓ Migráció kész: ${rawInv.length} pozíció, ${rawClosed.length} lezárt, ${rawPending.length} pending`);
    return { investments: rawInv.length, closed: rawClosed.length, pending: rawPending.length };
  } catch (err) {
    console.error("Migráció hiba:", err);
    throw err;
  }
}
