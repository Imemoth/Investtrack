// components/FeatureModals.jsx
// DCA kalkulátor, Adó kalkulátor, Multi-portfólió, P&L összesítő, Push értesítés
import { useState, useMemo } from "react";
import { glassCard, haptic, THEME as T } from "../design-system";
import { fmtNum, fmtCurrency, calcPnL } from "../utils";

// ─── P&L ÖSSZESÍTŐ ────────────────────────────────────────────────────────────
export function PnLSummary({ investments }) {
  const data = useMemo(() => {
    const now   = new Date();
    const week  = new Date(now - 7  * 86400000);
    const month = new Date(now - 30 * 86400000);

    // Szimulálunk historikus snapshot-ot a vételárak + dátumok alapján
    // (valódi historikus adat csak price history-val lenne pontos)
    const total = investments.reduce((s, i) => s + calcPnL(i).value, 0);
    const cost  = investments.reduce((s, i) => s + calcPnL(i).cost, 0);
    const pnl   = total - cost;
    const pct   = cost > 0 ? pnl / cost * 100 : 0;

    // Legjobb/legrosszabb nap pozíció alapján
    const sorted = [...investments]
      .filter(i => i.currentPrice > 0)
      .map(i => ({ ...i, ...calcPnL(i) }))
      .sort((a, b) => b.abs - a.abs);

    return { total, cost, pnl, pct, best: sorted[0], worst: sorted[sorted.length - 1] };
  }, [investments]);

  const up = data.pnl >= 0;

  const Row = ({ label, value, color = T.text.secondary }) => (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: `1px solid ${T.border.subtle}` }}>
      <span style={{ fontSize: 13, color: T.text.secondary }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 700, color, fontFamily: "'DM Mono',monospace" }}>{value}</span>
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Hero P&L kártya */}
      <div style={{ ...glassCard(T), background: up ? "rgba(110,231,183,0.08)" : "rgba(252,165,165,0.08)", border: `1px solid ${up ? "rgba(110,231,183,0.3)" : "rgba(252,165,165,0.3)"}`, padding: 20, textAlign: "center" }}>
        <div style={{ fontSize: 11, color: T.text.secondary, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8 }}>Összes P&L</div>
        <div style={{ fontSize: 36, fontWeight: 800, color: up ? T.accent.green : T.accent.red, fontFamily: "'DM Mono',monospace", letterSpacing: "-0.02em" }}>
          {up ? "+" : ""}{fmtNum(data.pct, 2)}%
        </div>
        <div style={{ fontSize: 16, color: T.text.secondary, marginTop: 4, fontFamily: "'DM Mono',monospace" }}>
          {up ? "+" : ""}{fmtNum(data.pnl, 0)} Ft
        </div>
      </div>

      {/* Statisztikák */}
      <div style={glassCard(T, { padding: "4px 16px" })}>
        <Row label="Portfólió értéke"   value={fmtNum(data.total, 0) + " Ft"} color={T.text.primary} />
        <Row label="Befektetett tőke"   value={fmtNum(data.cost, 0) + " Ft"} />
        <Row label="Legjobb pozíció"    value={data.best ? `${data.best.ticker||data.best.name}: +${fmtNum(data.best.pct,2)}%` : "—"} color={T.accent.green} />
        <Row label="Leggyengébb pozíció" value={data.worst ? `${data.worst.ticker||data.worst.name}: ${fmtNum(data.worst.pct,2)}%` : "—"} color={T.accent.red} />
        <Row label="Pozíciók száma"     value={`${investments.length} db`} color={T.text.primary} />
      </div>

      <div style={{ ...glassCard(T), padding: 14, fontSize: 12, color: T.text.secondary, lineHeight: 1.6 }}>
        💡 <strong style={{ color: T.text.primary }}>Megjegyzés:</strong> Heti/havi P&L pontosabb számításhoz árfolyam-historikus adatok szükségesek. Az árfolyam frissítés után az adatok naprakészek.
      </div>
    </div>
  );
}

// ─── DCA KALKULÁTOR ───────────────────────────────────────────────────────────
export function DCACalculator({ investments }) {
  const [amount,    setAmount]    = useState("10000");
  const [frequency, setFrequency] = useState("monthly");
  const [years,     setYears]     = useState("5");
  const [growth,    setGrowth]    = useState("10");

  const result = useMemo(() => {
    const a = parseFloat(amount) || 0;
    const y = parseFloat(years)  || 1;
    const r = parseFloat(growth) / 100;
    const periodsPerYear = frequency === "weekly" ? 52 : frequency === "monthly" ? 12 : 4;
    const n = y * periodsPerYear;
    const rPer = r / periodsPerYear;
    const fv = rPer > 0
      ? a * ((Math.pow(1 + rPer, n) - 1) / rPer)
      : a * n;
    const invested = a * n;
    return { fv, invested, gain: fv - invested, gainPct: invested > 0 ? (fv - invested) / invested * 100 : 0 };
  }, [amount, frequency, years, growth]);

  const inputStyle = {
    width: "100%", background: T.bg.inset, border: `1px solid ${T.border.default}`,
    borderRadius: T.radius.md, padding: "10px 12px", color: T.text.primary,
    fontSize: 14, fontFamily: "inherit", outline: "none", boxSizing: "border-box",
    transition: "border-color 0.2s",
  };
  const labelStyle = { fontSize: 11, color: T.text.secondary, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 6, display: "block" };

  const FREQS = [["weekly","Heti"],["monthly","Havi"],["quarterly","Negyedéves"]];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Eredmény hero */}
      <div style={{ ...glassCard(T), background: "rgba(110,231,183,0.06)", border: `1px solid rgba(110,231,183,0.25)`, padding: 20, textAlign: "center", animation: "scaleIn 0.3s ease" }}>
        <div style={{ fontSize: 11, color: T.text.secondary, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8 }}>Becsült végösszeg</div>
        <div style={{ fontSize: 34, fontWeight: 800, color: T.accent.green, fontFamily: "'DM Mono',monospace" }}>{fmtNum(result.fv, 0)} Ft</div>
        <div style={{ display: "flex", justifyContent: "center", gap: 20, marginTop: 10 }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 11, color: T.text.secondary }}>Befizetve</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: T.text.primary, fontFamily: "'DM Mono',monospace" }}>{fmtNum(result.invested, 0)} Ft</div>
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 11, color: T.text.secondary }}>Hozam</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: T.accent.green, fontFamily: "'DM Mono',monospace" }}>+{fmtNum(result.gain, 0)} Ft</div>
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 11, color: T.text.secondary }}>Hozam %</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: T.accent.green, fontFamily: "'DM Mono',monospace" }}>+{fmtNum(result.gainPct, 1)}%</div>
          </div>
        </div>
      </div>

      {/* Beviteli mezők */}
      <div style={glassCard(T, { padding: 16, display: "flex", flexDirection: "column", gap: 14 })}>
        <div>
          <label style={labelStyle}>Rendszeres befektetés összege</label>
          <input style={inputStyle} type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="10000" />
        </div>

        <div>
          <label style={labelStyle}>Gyakoriság</label>
          <div style={{ display: "flex", gap: 6 }}>
            {FREQS.map(([v, l]) => (
              <button key={v} onClick={() => { setFrequency(v); haptic("light"); }} style={{
                flex: 1, background: frequency === v ? "rgba(110,231,183,0.15)" : T.bg.inset,
                border: `1px solid ${frequency === v ? T.accent.green : T.border.default}`,
                borderRadius: T.radius.md, padding: "8px 0", cursor: "pointer",
                fontSize: 12, fontWeight: 600, color: frequency === v ? T.accent.green : T.text.secondary,
                fontFamily: "inherit", transition: T.transition.fast,
              }}>{l}</button>
            ))}
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div>
            <label style={labelStyle}>Időtáv (év)</label>
            <input style={inputStyle} type="number" value={years} onChange={e => setYears(e.target.value)} placeholder="5" min="1" max="40" />
          </div>
          <div>
            <label style={labelStyle}>Éves hozam (%)</label>
            <input style={inputStyle} type="number" value={growth} onChange={e => setGrowth(e.target.value)} placeholder="10" />
          </div>
        </div>
      </div>

      <div style={{ ...glassCard(T), padding: 12, fontSize: 11, color: T.text.secondary }}>
        💡 Az S&P500 historikus átlaga ~10%/év (nominál). A kalkulátor tájékoztató jellegű, nem pénzügyi tanács.
      </div>
    </div>
  );
}

// ─── ADÓ KALKULÁTOR ────────────────────────────────────────────────────────────
export function TaxCalculator({ investments }) {
  const [year, setYear] = useState(new Date().getFullYear().toString());

  const calc = useMemo(() => {
    const gains = investments
      .filter(i => i.currentPrice > 0 && i.buyPrice > 0)
      .map(i => {
        const { abs, value, cost } = calcPnL(i);
        return { ...i, gain: abs, value, cost };
      });

    const totalGain  = gains.filter(i => i.gain > 0).reduce((s, i) => s + i.gain, 0);
    const totalLoss  = gains.filter(i => i.gain < 0).reduce((s, i) => s + i.gain, 0);
    const netGain    = Math.max(0, totalGain + totalLoss);

    // 2024 HU: SZJA 15%, SZOCHO 13% (max évi 450.000 Ft SZOCHO)
    const szja       = netGain * 0.15;
    const szochoBase = Math.min(netGain, 450000 / 0.13); // SZOCHO maximum
    const szocho     = Math.min(netGain * 0.13, 450000);
    const total      = szja + szocho;

    return { gains, totalGain, totalLoss: Math.abs(totalLoss), netGain, szja, szocho, total };
  }, [investments]);

  const TaxRow = ({ label, value, sub, color = T.text.primary, big = false }) => (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: `1px solid ${T.border.subtle}` }}>
      <div>
        <div style={{ fontSize: big ? 14 : 13, color: T.text.secondary }}>{label}</div>
        {sub && <div style={{ fontSize: 11, color: T.text.tertiary, marginTop: 2 }}>{sub}</div>}
      </div>
      <div style={{ fontSize: big ? 16 : 13, fontWeight: big ? 800 : 700, color, fontFamily: "'DM Mono',monospace" }}>{value}</div>
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Figyelmeztetés */}
      <div style={{ ...glassCard(T), background: "rgba(253,214,138,0.08)", border: `1px solid rgba(253,214,138,0.25)`, padding: 14, fontSize: 12, color: T.text.warning, lineHeight: 1.6 }}>
        ⚠️ <strong>Tájékoztató jellegű becslés.</strong> A pontos adókötelezettség függ a tartási időtől, devizaárfolyamtól és egyéb tényezőktől. Kérj könyvelői tanácsot!
      </div>

      {/* Adóalap */}
      <div style={glassCard(T, { padding: "4px 16px" })}>
        <TaxRow label="Összes realizált nyereség" value={`+${fmtNum(calc.totalGain, 0)} Ft`} color={T.accent.green} />
        <TaxRow label="Összes realizált veszteség" value={`-${fmtNum(calc.totalLoss, 0)} Ft`} color={T.accent.red} />
        <TaxRow label="Nettó adóalap" value={`${fmtNum(calc.netGain, 0)} Ft`} color={T.text.primary} big />
      </div>

      {/* Adószámítás */}
      <div style={{ ...glassCard(T), background: "rgba(252,165,165,0.05)", border: `1px solid rgba(252,165,165,0.2)`, padding: "4px 16px" }}>
        <TaxRow label="SZJA (15%)" value={`${fmtNum(calc.szja, 0)} Ft`} color={T.accent.red} sub="Személyi jövedelemadó" />
        <TaxRow label="SZOCHO (13%)" value={`${fmtNum(calc.szocho, 0)} Ft`} color={T.accent.red} sub="Max 450 000 Ft/év" />
        <TaxRow label="Összesen fizetendő" value={`${fmtNum(calc.total, 0)} Ft`} color={T.accent.red} big />
      </div>

      {/* Pozíciónkénti bontás */}
      {calc.gains.length > 0 && (
        <div style={glassCard(T, { padding: 16 })}>
          <div style={{ fontSize: 11, color: T.text.secondary, textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700, marginBottom: 12 }}>Pozíciónkénti nyereség</div>
          {calc.gains.sort((a, b) => b.gain - a.gain).map(inv => (
            <div key={inv.id} style={{ display: "flex", justifyContent: "space-between", padding: "7px 0", borderBottom: `1px solid ${T.border.subtle}` }}>
              <span style={{ fontSize: 12, color: T.text.secondary }}>{inv.ticker || inv.name}</span>
              <span style={{ fontSize: 12, fontFamily: "'DM Mono',monospace", fontWeight: 700, color: inv.gain >= 0 ? T.accent.green : T.accent.red }}>
                {inv.gain >= 0 ? "+" : ""}{fmtNum(inv.gain, 0)} Ft
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── MULTI-PORTFÓLIÓ ──────────────────────────────────────────────────────────
const PORTFOLIO_KEY = "investtrack_portfolios_v1";

function loadPortfolios() {
  try { return JSON.parse(localStorage.getItem(PORTFOLIO_KEY) || "{}"); }
  catch { return {}; }
}
function savePortfolios(p) { localStorage.setItem(PORTFOLIO_KEY, JSON.stringify(p)); }

export function usePortfolios() {
  const [portfolios, setPortfolios] = useState(loadPortfolios);
  const save = (name, invs) => {
    setPortfolios(prev => { const next = { ...prev, [name]: invs }; savePortfolios(next); return next; });
  };
  const remove = (name) => {
    setPortfolios(prev => { const next = { ...prev }; delete next[name]; savePortfolios(next); return next; });
  };
  return { portfolios, save, remove };
}

export function MultiPortfolio({ currentInvestments, onSwitch, onClose }) {
  const { portfolios, save, remove } = usePortfolios();
  const [newName, setNewName] = useState("");
  const [confirm, setConfirm] = useState(null);

  const allPortfolios = {
    "XTB (aktív)": currentInvestments,
    ...portfolios,
  };

  const handleSaveCurrent = () => {
    if (!newName.trim()) return;
    save(newName.trim(), currentInvestments);
    setNewName("");
    haptic("success");
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ fontSize: 13, color: T.text.secondary, lineHeight: 1.6 }}>
        Különböző brókerszámláidat külön kezelheted. Mentsd el az aktuális portfóliót új névvel, majd töltsd be bármelyiket.
      </div>

      {/* Portfóliók listája */}
      {Object.entries(allPortfolios).map(([name, invs]) => {
        const total = invs.reduce((s, i) => s + calcPnL(i).value, 0);
        const cost  = invs.reduce((s, i) => s + calcPnL(i).cost, 0);
        const pnl   = cost > 0 ? ((total - cost) / cost * 100) : 0;
        const isActive = name === "XTB (aktív)";
        return (
          <div key={name} style={{ ...glassCard(T, { padding: 16 }), border: `1px solid ${isActive ? T.accent.green + "60" : T.border.default}` }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: T.text.primary }}>{name}</div>
                <div style={{ fontSize: 12, color: T.text.secondary, fontFamily: "'DM Mono',monospace", marginTop: 2 }}>
                  {invs.length} pozíció · {fmtNum(total, 0)} Ft · <span style={{ color: pnl >= 0 ? T.accent.green : T.accent.red }}>{pnl >= 0 ? "+" : ""}{fmtNum(pnl, 2)}%</span>
                </div>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                {!isActive && (
                  <>
                    <button onClick={() => { onSwitch(invs, name); onClose(); haptic("medium"); }} style={{ background: "rgba(110,231,183,0.15)", border: `1px solid ${T.accent.green}`, borderRadius: T.radius.md, padding: "6px 12px", color: T.accent.green, cursor: "pointer", fontSize: 12, fontFamily: "inherit", fontWeight: 600 }}>
                      Betöltés
                    </button>
                    <button onClick={() => setConfirm(name)} style={{ background: "rgba(252,165,165,0.1)", border: `1px solid rgba(252,165,165,0.3)`, borderRadius: T.radius.md, padding: "6px 10px", color: T.accent.red, cursor: "pointer", fontSize: 12 }}>
                      🗑️
                    </button>
                  </>
                )}
                {isActive && <span style={{ fontSize: 11, color: T.accent.green, fontWeight: 700 }}>● AKTÍV</span>}
              </div>
            </div>
          </div>
        );
      })}

      {/* Új portfólió mentése */}
      <div style={glassCard(T, { padding: 16 })}>
        <div style={{ fontSize: 11, color: T.text.secondary, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 10 }}>Aktuális mentése új névvel</div>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            style={{ flex: 1, background: T.bg.inset, border: `1px solid ${T.border.default}`, borderRadius: T.radius.md, padding: "9px 12px", color: T.text.primary, fontSize: 13, fontFamily: "inherit", outline: "none" }}
            placeholder="pl. Revolut, IB, TBSZ..."
            value={newName} onChange={e => setNewName(e.target.value)}
          />
          <button onClick={handleSaveCurrent} disabled={!newName.trim()} style={{ background: T.gradient.primary, border: "none", borderRadius: T.radius.md, padding: "9px 16px", color: "#fff", cursor: newName.trim() ? "pointer" : "not-allowed", fontSize: 13, fontWeight: 700, fontFamily: "inherit", opacity: newName.trim() ? 1 : 0.5 }}>
            Mentés
          </button>
        </div>
      </div>

      {/* Törlés confirm */}
      {confirm && (
        <div style={{ ...glassCard(T), background: "rgba(252,165,165,0.08)", border: `1px solid rgba(252,165,165,0.3)`, padding: 16 }}>
          <div style={{ fontSize: 13, color: T.text.primary, marginBottom: 12 }}>Törlöd a <strong>"{confirm}"</strong> portfóliót?</div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => setConfirm(null)} style={{ flex: 1, background: T.bg.inset, border: `1px solid ${T.border.default}`, borderRadius: T.radius.md, padding: "8px", color: T.text.secondary, cursor: "pointer", fontSize: 13, fontFamily: "inherit" }}>Mégsem</button>
            <button onClick={() => { remove(confirm); setConfirm(null); haptic("heavy"); }} style={{ flex: 1, background: "rgba(252,165,165,0.15)", border: `1px solid rgba(252,165,165,0.4)`, borderRadius: T.radius.md, padding: "8px", color: T.accent.red, cursor: "pointer", fontSize: 13, fontFamily: "inherit", fontWeight: 700 }}>Törlés</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── PUSH ÉRTESÍTÉS ───────────────────────────────────────────────────────────
export function PushNotificationSetup({ investments, onClose }) {
  const [permission, setPermission] = useState(Notification?.permission || "default");
  const [targets, setTargets] = useState(() => {
    try { return JSON.parse(localStorage.getItem("investtrack_targets") || "{}"); }
    catch { return {}; }
  });

  const requestPermission = async () => {
    const result = await Notification.requestPermission();
    setPermission(result);
    haptic(result === "granted" ? "success" : "error");
  };

  const saveTarget = (id, price) => {
    const next = { ...targets, [id]: price };
    setTargets(next);
    localStorage.setItem("investtrack_targets", JSON.stringify(next));
  };

  const testNotification = (inv) => {
    if (permission !== "granted") return;
    new Notification(`🎯 ${inv.name} elérte a célárat!`, {
      body: `${inv.ticker}: ${fmtNum(inv.currentPrice, 0)} ${inv.currency}`,
      icon: "/favicon.svg",
    });
    haptic("success");
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Permission status */}
      <div style={{ ...glassCard(T), background: permission === "granted" ? "rgba(110,231,183,0.08)" : "rgba(253,214,138,0.08)", border: `1px solid ${permission === "granted" ? "rgba(110,231,183,0.3)" : "rgba(253,214,138,0.3)"}`, padding: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: T.text.primary }}>
              {permission === "granted" ? "✅ Értesítések engedélyezve" : permission === "denied" ? "❌ Értesítések tiltva" : "🔔 Értesítések engedélyezése"}
            </div>
            <div style={{ fontSize: 12, color: T.text.secondary, marginTop: 4 }}>
              {permission === "granted" ? "Célár eléréskor értesítést kapsz" : permission === "denied" ? "Engedélyezd a böngésző beállításokban" : "Kattints az engedélyezéshez"}
            </div>
          </div>
          {permission === "default" && (
            <button onClick={requestPermission} style={{ background: T.gradient.primary, border: "none", borderRadius: T.radius.md, padding: "8px 16px", color: "#fff", cursor: "pointer", fontSize: 12, fontWeight: 700, fontFamily: "inherit" }}>
              Engedély
            </button>
          )}
        </div>
      </div>

      {/* Célár beállítások */}
      <div style={glassCard(T, { padding: 16 })}>
        <div style={{ fontSize: 11, color: T.text.secondary, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 12 }}>Célár értesítők</div>
        {investments.filter(i => i.ticker).map(inv => (
          <div key={inv.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: `1px solid ${T.border.subtle}` }}>
            <div style={{ width: 32, height: 32, borderRadius: T.radius.sm, background: "rgba(110,231,183,0.15)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <span style={{ fontSize: 9, fontWeight: 800, color: T.accent.green, fontFamily: "'DM Mono',monospace" }}>{inv.ticker.slice(0,4)}</span>
            </div>
            <div style={{ flex: 1, fontSize: 12, color: T.text.secondary }}>{inv.name}</div>
            <input
              type="number"
              placeholder={inv.targetPrice || "Célár..."}
              defaultValue={targets[inv.id] || inv.targetPrice || ""}
              onBlur={e => saveTarget(inv.id, e.target.value)}
              style={{ width: 80, background: T.bg.inset, border: `1px solid ${T.border.default}`, borderRadius: T.radius.sm, padding: "5px 8px", color: T.text.primary, fontSize: 12, fontFamily: "'DM Mono',monospace", outline: "none", textAlign: "right" }}
            />
            {permission === "granted" && (
              <button onClick={() => testNotification(inv)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 14, padding: "0 4px" }} title="Test értesítés">🔔</button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── UNIFIED FEATURE MODAL ────────────────────────────────────────────────────
export function FeatureModal({ feature, investments, onClose, onSwitchPortfolio }) {
  const titles = {
    pnl:   "📅 P&L Összesítő",
    dca:   "📆 DCA Kalkulátor",
    tax:   "🧾 Adó Kalkulátor",
    multi: "🌐 Multi-Portfólió",
    push:  "🔔 Push Értesítések",
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(12px)", zIndex: 60, display: "flex", alignItems: "flex-end" }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ background: "rgba(7,11,20,0.95)", border: `1px solid ${T.border.default}`, borderRadius: "20px 20px 0 0", width: "100%", maxHeight: "88vh", display: "flex", flexDirection: "column", boxShadow: T.shadow.modal, backdropFilter: T.blur.lg }}>
        <div style={{ padding: "16px 20px", borderBottom: `1px solid ${T.border.subtle}`, flexShrink: 0, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontWeight: 700, color: T.text.primary, fontSize: 16 }}>{titles[feature]}</div>
          <button onClick={onClose} style={{ background: T.bg.surface, border: `1px solid ${T.border.subtle}`, borderRadius: T.radius.full, width: 30, height: 30, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: T.text.secondary, fontSize: 16 }}>×</button>
        </div>
        <div style={{ overflowY: "auto", flex: 1, padding: "16px 16px 32px" }}>
          {feature === "pnl"   && <PnLSummary investments={investments} />}
          {feature === "dca"   && <DCACalculator investments={investments} />}
          {feature === "tax"   && <TaxCalculator investments={investments} />}
          {feature === "multi" && <MultiPortfolio currentInvestments={investments} onSwitch={onSwitchPortfolio} onClose={onClose} />}
          {feature === "push"  && <PushNotificationSetup investments={investments} onClose={onClose} />}
        </div>
      </div>
    </div>
  );
}
