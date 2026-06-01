// components/AppModals.jsx
// Az összes modal dialógus egy helyen
import { Modal, Toast, LogModal } from "./ui";
import { InvestmentForm } from "./InvestmentForm";
import { DetailModal } from "./DetailModal";
import { SellModal } from "./SellModal";
import { TransactionLog } from "./TransactionLog";
import { AIAnalysis } from "./AIAnalysis";
import { FeatureModal } from "./FeatureModals";
import { glassCard } from "../design-system";

export function AppModals({
  theme, investments, closedPositions,
  // Modal state
  modal, setModal,
  editing, setEditing,
  detailInv, setDetailInv,
  confirmDelete, setConfirmDelete,
  confirmClear, setConfirmClear,
  importConfirm, setImportConfirm,
  handleImportReplace, handleImportMerge,
  sellInv, setSellInv,
  showTxLog, setShowTxLog,
  showAI, setShowAI,
  showLog, setShowLog,
  featureModal, setFeatureModal,
  toast,
  // Import state
  importText, setImportText,
  // Handlers
  saveInvestment,
  handleSell,
  handleImport,
  handleFileImport,
  handleClearPortfolio,
  doDelete,
  setInvestments,
  handleSwitchPortfolio,
  showToast,
  // Button styles
  btnPrimary, btnGhost,
}) {
  return (
    <>
      {/* Befektetés hozzáadás / szerkesztés */}
      {(modal === "add" || modal === "edit") && (
        <Modal title={modal === "add" ? "Új befektetés" : "Befektetés szerkesztése"}
          onClose={() => { setModal(null); setEditing(null); }}>
          <InvestmentForm initial={editing} onSave={saveInvestment}
            onCancel={() => { setModal(null); setEditing(null); }} />
        </Modal>
      )}

      {/* Import modal */}
      {modal === "import" && (
        <Modal title="Import" onClose={() => { setModal(null); setImportText(""); }}>
          <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
            {/* XTB import */}
            <div style={{ ...glassCard(theme, { padding:16 }), background:"rgba(110,231,183,0.06)", border:`1px solid rgba(110,231,183,0.25)` }}>
              <div style={{ fontSize:13, fontWeight:700, color:theme.accent.green, marginBottom:6 }}>🏦 XTB közvetlen import (ajánlott)</div>
              <div style={{ fontSize:12, color:theme.text.secondary, marginBottom:10, lineHeight:1.6 }}>
                Töltsd le az XTB XLSX exportot — automatikusan felismeri a pozíciókat, lotokat és realizált P&L-t.
              </div>
              <div style={{ fontSize:11, color:theme.text.tertiary, marginBottom:12, background:theme.bg.inset, borderRadius:theme.radius.sm, padding:"8px 10px", lineHeight:1.7 }}>
                xStation5 → <strong style={{ color:theme.text.secondary }}>Account History</strong> → Export → <strong style={{ color:theme.text.secondary }}>Full Report</strong> → <strong style={{ color:theme.text.secondary }}>Excel</strong>
              </div>
              <label style={{ ...btnPrimary, display:"inline-flex", cursor:"pointer", justifyContent:"center" }}>
                📥 XTB XLSX feltöltése
                <input type="file" accept=".xlsx,.xls" style={{ display:"none" }} onChange={handleFileImport} />
              </label>
            </div>
            <div style={{ display:"flex", alignItems:"center", gap:10 }}>
              <div style={{ flex:1, height:1, background:theme.border.subtle }} />
              <span style={{ fontSize:11, color:theme.text.tertiary }}>vagy CSV manuálisan</span>
              <div style={{ flex:1, height:1, background:theme.border.subtle }} />
            </div>
            <label style={{ ...btnGhost, display:"inline-flex", cursor:"pointer", justifyContent:"center" }}>
              📁 CSV feltöltése
              <input type="file" accept=".csv,.txt" style={{ display:"none" }} onChange={handleFileImport} />
            </label>
            <textarea
              style={{ width:"100%", background:theme.bg.inset, border:`1px solid ${theme.border.default}`, borderRadius:theme.radius.md, padding:"10px 12px", color:theme.text.primary, fontSize:12, fontFamily:"'DM Mono',monospace", minHeight:80, resize:"vertical", boxSizing:"border-box", outline:"none" }}
              placeholder="Név,Ticker,Kategória,Vétel ár,Darab,Jelenlegi ár,Deviza,Vétel dátum,Megjegyzés"
              value={importText} onChange={e => setImportText(e.target.value)}
            />
            <div style={{ background:theme.bg.inset, border:`1px solid ${theme.border.subtle}`, borderRadius:theme.radius.md, padding:"12px 14px", fontSize:12, color:theme.text.secondary, lineHeight:1.7 }}>
              <div style={{ fontWeight:700, color:theme.text.primary, marginBottom:4 }}>📋 Oszlopsorrend:</div>
              <div style={{ fontFamily:"'DM Mono',monospace", fontSize:11, color:theme.accent.green, marginBottom:8 }}>
                Név · Ticker · Kategória · Vétel ár · Darab · Jelenlegi ár · Deviza · Vétel dátum · Megjegyzés
              </div>
              <div style={{ padding:"6px 8px", background:"rgba(110,231,183,0.05)", border:`1px solid rgba(110,231,183,0.15)`, borderRadius:theme.radius.sm, fontSize:11, color:theme.text.tertiary }}>
                💡 Több vásárlás = ismételt sor ugyanazzal a Tickerrel → automatikus lot összevonás
              </div>
            </div>
            <div style={{ display:"flex", gap:12, justifyContent:"flex-end" }}>
              <button style={btnGhost} onClick={() => { setModal(null); setImportText(""); }}>Mégsem</button>
              <button style={{ ...btnPrimary, opacity:importText.trim()?1:0.5 }} onClick={handleImport} disabled={!importText.trim()}>Importálás</button>
            </div>
          </div>
        </Modal>
      )}

      {/* Törlés megerősítés */}
      {confirmDelete && (
        <Modal title="Törlés megerősítése" onClose={() => setConfirmDelete(null)}>
          <div style={{ fontSize:14, color:theme.text.secondary, marginBottom:20, lineHeight:1.6 }}>
            Biztosan törlöd a <strong style={{ color:theme.text.primary }}>{confirmDelete.name}</strong> pozíciót?
          </div>
          <div style={{ display:"flex", gap:12, justifyContent:"flex-end" }}>
            <button style={btnGhost} onClick={() => setConfirmDelete(null)}>Mégsem</button>
            <button style={{ ...btnGhost, color:theme.accent.red, borderColor:theme.accent.red }}
              onClick={() => doDelete(confirmDelete.id)}>Törlés</button>
          </div>
        </Modal>
      )}

      {/* Detail modal */}
      {detailInv && (
        <DetailModal
          inv={detailInv}
          closedPositions={closedPositions.filter(c => c.xtbTicker === detailInv.xtbTicker || c.ticker === detailInv.ticker)}
          onClose={() => setDetailInv(null)}
          onEdit={() => { setEditing(detailInv); setDetailInv(null); setModal("edit"); }}
        />
      )}

      {/* Import megerősítése (Csere vs Hozzáadás) */}
      {importConfirm && (
        <Modal title="Import megerősítése" onClose={() => setImportConfirm(null)}>
          <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
            <div style={{ fontSize:14, color:theme.text.secondary, lineHeight:1.6 }}>
              {importConfirm.msg}
            </div>
            <div style={{ display:"flex", gap:10, justifyContent:"flex-end" }}>
              <button style={{ background:"none", border:`1px solid ${theme.border.default}`, borderRadius:theme.radius.md, padding:"9px 14px", color:theme.text.secondary, cursor:"pointer", fontSize:13, fontWeight:600, fontFamily:"inherit" }}
                onClick={() => setImportConfirm(null)}>Mégsem</button>
              <button style={{ background:"none", border:`1px solid ${theme.border.default}`, borderRadius:theme.radius.md, padding:"9px 14px", color:theme.text.secondary, cursor:"pointer", fontSize:13, fontWeight:600, fontFamily:"inherit" }}
                onClick={handleImportMerge}>Hozzáadás</button>
              <button style={{ background:"rgba(252,165,165,0.15)", border:"1px solid rgba(252,165,165,0.4)", borderRadius:theme.radius.md, padding:"9px 14px", color:theme.accent.red, cursor:"pointer", fontSize:13, fontWeight:700, fontFamily:"inherit" }}
                onClick={handleImportReplace}>Csere (régi törlődik)</button>
            </div>
          </div>
        </Modal>
      )}

      {/* Portfólió törlése */}
      {confirmClear && (
        <Modal title="⚠️ Portfólió törlése" onClose={() => setConfirmClear(false)}>
          <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
            <div style={{ background:"rgba(252,165,165,0.08)", border:"1px solid rgba(252,165,165,0.25)", borderRadius:theme.radius.md, padding:16, fontSize:13, color:theme.text.secondary, lineHeight:1.7 }}>
              <div style={{ fontWeight:700, color:theme.accent.red, marginBottom:8 }}>Ez a művelet nem visszavonható!</div>
              Törlöd az összes <strong style={{ color:theme.text.primary }}>{investments.length} pozíciót</strong> és az árfolyam historikát.
            </div>
            <div style={{ fontSize:12, color:theme.text.tertiary }}>
              💡 Tipp: előbb exportáld az adatokat (CSV Export), hogy meglegyen biztonsági másolat.
            </div>
            <div style={{ display:"flex", gap:10, justifyContent:"flex-end" }}>
              <button style={btnGhost} onClick={() => setConfirmClear(false)}>Mégsem</button>
              <button onClick={handleClearPortfolio} style={{ background:"rgba(252,165,165,0.15)", border:"1px solid rgba(252,165,165,0.4)", borderRadius:theme.radius.md, padding:"10px 20px", color:theme.accent.red, cursor:"pointer", fontSize:13, fontWeight:700, fontFamily:"inherit" }}>
                🗑️ Portfólió törlése
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Eladás */}
      {sellInv && <SellModal inv={sellInv} onSell={handleSell} onClose={() => setSellInv(null)} />}

      {/* Egyéb */}
      {showTxLog   && <TransactionLog onClose={() => setShowTxLog(false)} />}
      {showAI      && <AIAnalysis investments={investments} onClose={() => setShowAI(false)} />}
      {showLog     && <LogModal onClose={() => setShowLog(false)} />}
      {featureModal && (
        <FeatureModal feature={featureModal} investments={investments}
          onClose={() => setFeatureModal(null)}
          onSwitchPortfolio={handleSwitchPortfolio} />
      )}

      <Toast toast={toast} />
    </>
  );
}
