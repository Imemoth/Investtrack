import { useState } from "react";
import { fmtNum, uid } from "../utils";
import { CATEGORY_COLORS } from "../constants";

export const TX_STORAGE_KEY = "investtrack_transactions_v1";

export function loadTransactions() {
  try { return JSON.parse(localStorage.getItem(TX_STORAGE_KEY) || "[]"); }
  catch { return []; }
}
export function saveTransactions(txs) {
  localStorage.setItem(TX_STORAGE_KEY, JSON.stringify(txs));
}
export function addTransaction(inv, type) {
  const txs = loadTransactions();
  txs.unshift({
    id:       uid(),
    invId:    inv.id,
    name:     inv.name,
    ticker:   inv.ticker,
    category: inv.category,
    type,                        // "buy" | "sell" | "edit"
    price:    inv.currentPrice || inv.buyPrice,
    quantity: inv.quantity,
    currency: inv.currency,
    date:     new Date().toISOString(),
  });
  saveTransactions(txs.slice(0, 200));  // max 200 entry
}

// ─── TRANSACTION LOG MODAL ────────────────────────────────────────────────────
export function TransactionLog({ onClose }) {
  const [txs, setTxs]   = useState(loadTransactions);
  const [filter, setFilter] = useState("all");

  const filtered = filter === "all" ? txs : txs.filter(t => t.type === filter);

  const TYPE_STYLE = {
    buy:  { bg: "#0D2818", border: "#6EE7B7", color: "#6EE7B7", icon: "📈", label: "Vétel" },
    sell: { bg: "#3D0A0A", border: "#FCA5A5", color: "#FCA5A5", icon: "📉", label: "Eladás" },
    edit: { bg: "#1C2A3D", border: "#93C5FD", color: "#93C5FD", icon: "✏️", label: "Módosítás" },
  };

  const clearAll = () => {
    if (!confirm("Biztosan törlöd az összes tranzakciót?")) return;
    saveTransactions([]);
    setTxs([]);
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.8)", backdropFilter: "blur(4px)", zIndex: 60, display: "flex", alignItems: "flex-end" }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ background: "#161B22", border: "1px solid #30363D", borderRadius: "16px 16px 0 0", width: "100%", maxHeight: "85vh", display: "flex", flexDirection: "column" }}>
        {/* Header */}
        <div style={{ padding: "16px 20px", borderBottom: "1px solid #21262D", flexShrink: 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <span style={{ fontWeight: 700, color: "#E6EDF3", fontSize: 16 }}>📝 Tranzakció napló</span>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={clearAll} style={{ background: "none", border: "1px solid #3D1A1A", borderRadius: 6, padding: "5px 10px", color: "#FCA5A5", cursor: "pointer", fontSize: 11, fontFamily: "inherit" }}>Törlés</button>
              <button onClick={onClose} style={{ background: "none", border: "none", color: "#8B949E", cursor: "pointer", fontSize: 22 }}>×</button>
            </div>
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            {[["all","Mind"], ["buy","Vétel"], ["sell","Eladás"], ["edit","Módosítás"]].map(([v, l]) => (
              <button key={v} onClick={() => setFilter(v)} style={{
                background: filter === v ? "#21262D" : "none",
                border: `1px solid ${filter === v ? "#30363D" : "#21262D"}`,
                borderRadius: 6, padding: "4px 10px", color: filter === v ? "#E6EDF3" : "#8B949E",
                cursor: "pointer", fontSize: 11, fontFamily: "inherit",
              }}>{l}</button>
            ))}
          </div>
        </div>

        {/* List */}
        <div style={{ overflowY: "auto", flex: 1, padding: "8px 16px 24px" }}>
          {filtered.length === 0 ? (
            <div style={{ textAlign: "center", color: "#8B949E", padding: "40px 0", fontSize: 13 }}>
              Még nincs tranzakció rögzítve.
            </div>
          ) : filtered.map(tx => {
            const s = TYPE_STYLE[tx.type] || TYPE_STYLE.edit;
            const d = new Date(tx.date);
            return (
              <div key={tx.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderBottom: "1px solid #21262D" }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: s.bg, border: `1px solid ${s.border}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 14 }}>
                  {s.icon}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: "#E6EDF3" }}>{tx.name}</span>
                    <span style={{ fontSize: 12, fontFamily: "'DM Mono',monospace", color: s.color, fontWeight: 700 }}>
                      {s.label}
                    </span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginTop: 2 }}>
                    <span style={{ fontSize: 11, color: "#8B949E", fontFamily: "'DM Mono',monospace" }}>
                      {fmtNum(tx.quantity, 4)} db @ {fmtNum(tx.price, 0)} {tx.currency}
                    </span>
                    <span style={{ fontSize: 11, color: "#8B949E" }}>
                      {d.toLocaleDateString("hu-HU")} {d.toLocaleTimeString("hu-HU", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
