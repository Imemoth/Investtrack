import { useState } from "react";
import { calcPnL, fmtNum } from "../utils";
import { appLog } from "../services/logger";

export function AIAnalysis({ investments, onClose }) {
  const [analysis, setAnalysis] = useState(null);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState(null);
  const [apiKey,   setApiKey]   = useState(() => localStorage.getItem("investtrack_apikey") || "");
  const [showKey,  setShowKey]  = useState(false);

  const saveKey = k => {
    setApiKey(k);
    if (k) localStorage.setItem("investtrack_apikey", k);
    else localStorage.removeItem("investtrack_apikey");
  };

  const runAnalysis = async () => {
    if (!apiKey.trim()) { setError("Add meg az Anthropic API kulcsot!"); return; }
    setLoading(true); setError(null); setAnalysis(null);

    const portfolioSummary = investments.map(inv => {
      const { pct, value } = calcPnL(inv);
      return `- ${inv.name} (${inv.ticker}): ${fmtNum(value, 0)} ${inv.currency}, P&L: ${fmtNum(pct, 2)}%, kategória: ${inv.category}`;
    }).join("\n");

    const totalValue  = investments.reduce((s, i) => s + i.currentPrice * i.quantity, 0);
    const totalCost   = investments.reduce((s, i) => s + i.buyPrice * i.quantity, 0);
    const totalPnLPct = totalCost > 0 ? ((totalValue - totalCost) / totalCost * 100) : 0;

    const prompt = `Te egy tapasztalt portfólió-elemző vagy. Elemezd az alábbi befektetési portfóliót magyarul, tömören és konkrétan.

PORTFÓLIÓ ÖSSZEFOGLALÁS:
- Összes érték: ${fmtNum(totalValue, 0)} HUF
- Összes P&L: ${fmtNum(totalPnLPct, 2)}%
- Pozíciók száma: ${investments.length}

POZÍCIÓK:
${portfolioSummary}

Adj visszajelzést PONTOSAN ebben a struktúrában (max 3-4 mondat kategóriánként):

**📊 Diverzifikáció**
[értékelés]

**⚠️ Kockázatok**
[konkrét kockázatok]

**✅ Erősségek**
[mi működik jól]

**💡 Javaslatok**
[konkrét, actionable javaslatok]

Legyél direkt, kerüld az általánosságokat. Hivatkozz konkrét tickerekre.`;

    try {
      appLog.info("AI elemzés indítása → /api/analyze");
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, apiKey: apiKey.trim() }),
      });

      appLog.info(`AI válasz státusz: ${res.status}`);

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({ error: "Ismeretlen hiba" }));
        appLog.error(`AI hiba ${res.status}`, errBody.error);
        throw new Error(errBody.error || `HTTP ${res.status}`);
      }

      const data = await res.json();
      appLog.info("AI válasz megérkezett", JSON.stringify(data?.usage));

      const text = data?.content?.find(b => b.type === "text")?.text;
      if (!text) {
        appLog.error("Üres AI válasz", JSON.stringify(data));
        throw new Error("Üres válasz – ellenőrizd a debug logot");
      }
      setAnalysis(text);
      appLog.info("✓ AI elemzés kész");
    } catch (e) {
      appLog.error("AI elemzés sikertelen", e.message);
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const renderText = text => text.split("\n").map((line, i) => {
    const parts = line.split(/\*\*(.*?)\*\*/g);
    return (
      <div key={i} style={{ marginBottom: line.trim() ? 4 : 8 }}>
        {parts.map((part, j) =>
          j % 2 === 1
            ? <strong key={j} style={{ color: "#E6EDF3" }}>{part}</strong>
            : <span key={j} style={{ color: "#C9D1D9" }}>{part}</span>
        )}
      </div>
    );
  });

  const inputStyle = {
    width: "100%", background: "#0D1117", border: "1px solid #30363D",
    borderRadius: 8, padding: "10px 12px", color: "#E6EDF3",
    fontSize: 13, fontFamily: "'DM Mono',monospace", outline: "none",
    boxSizing: "border-box",
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.8)", backdropFilter: "blur(4px)", zIndex: 60, display: "flex", alignItems: "flex-end" }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ background: "#161B22", border: "1px solid #30363D", borderRadius: "16px 16px 0 0", width: "100%", maxHeight: "85vh", display: "flex", flexDirection: "column" }}>

        {/* Header */}
        <div style={{ padding: "16px 20px", borderBottom: "1px solid #21262D", flexShrink: 0, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontWeight: 700, color: "#E6EDF3", fontSize: 16 }}>🤖 AI Portfólió-elemzés</div>
            <div style={{ fontSize: 11, color: "#8B949E", marginTop: 2 }}>Claude Sonnet elemzi a portfóliódat</div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#8B949E", cursor: "pointer", fontSize: 22 }}>×</button>
        </div>

        <div style={{ overflowY: "auto", flex: 1, padding: "16px 20px 32px" }}>

          {/* API key input – mindig látszik */}
          <div style={{ background: "#0D1117", border: "1px solid #21262D", borderRadius: 10, padding: 14, marginBottom: 16 }}>
            <div style={{ fontSize: 11, color: "#8B949E", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 700, marginBottom: 8 }}>
              🔑 Anthropic API kulcs
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                type={showKey ? "text" : "password"}
                style={{ ...inputStyle, flex: 1 }}
                value={apiKey}
                onChange={e => saveKey(e.target.value)}
                placeholder="sk-ant-..."
              />
              <button onClick={() => setShowKey(v => !v)}
                style={{ background: "#21262D", border: "none", borderRadius: 8, padding: "0 12px", color: "#8B949E", cursor: "pointer", fontSize: 13, fontFamily: "inherit", flexShrink: 0 }}>
                {showKey ? "🙈" : "👁"}
              </button>
            </div>
            <div style={{ fontSize: 11, color: "#8B949E", marginTop: 8, lineHeight: 1.5 }}>
              Kulcs a <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noopener noreferrer" style={{ color: "#6EE7B7" }}>console.anthropic.com</a> oldalon.
              Lokálisan tárolódik, soha nem kerül szerverre.
            </div>
          </div>

          {/* Result area */}
          {!analysis && !loading && !error && (
            <div style={{ textAlign: "center", padding: "20px 0" }}>
              <div style={{ fontSize: 36, marginBottom: 12 }}>🤖</div>
              <div style={{ color: "#8B949E", fontSize: 13, marginBottom: 20 }}>
                {investments.length} pozíció elemzése: diverzifikáció, kockázatok, javaslatok
              </div>
              <button onClick={runAnalysis} disabled={!apiKey.trim()} style={{
                background: apiKey.trim() ? "linear-gradient(135deg,#238636,#2EA043)" : "#21262D",
                border: "none", borderRadius: 10, padding: "12px 28px",
                color: apiKey.trim() ? "#fff" : "#8B949E",
                cursor: apiKey.trim() ? "pointer" : "not-allowed",
                fontSize: 14, fontWeight: 700, fontFamily: "inherit",
              }}>
                Elemzés indítása
              </button>
            </div>
          )}

          {loading && (
            <div style={{ textAlign: "center", padding: "40px 0" }}>
              <div style={{ fontSize: 32, marginBottom: 12, animation: "spin 2s linear infinite", display: "inline-block" }}>⚙️</div>
              <div style={{ color: "#8B949E", fontSize: 14 }}>Claude elemzi a portfóliódat...</div>
            </div>
          )}

          {error && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ background: "#3D0A0A", border: "1px solid #FCA5A5", borderRadius: 8, padding: "12px 14px", color: "#FCA5A5", fontSize: 13, marginBottom: 12 }}>
                ❌ {error}
              </div>
              <div style={{ fontSize: 12, color: "#8B949E", marginBottom: 12 }}>
                Részletes hibainfo a 🪲 debug logban.
              </div>
              <button onClick={runAnalysis} style={{ background: "#21262D", border: "none", borderRadius: 8, padding: "8px 16px", color: "#C9D1D9", cursor: "pointer", fontSize: 13, fontFamily: "inherit" }}>
                🔄 Újrapróbálás
              </button>
            </div>
          )}

          {analysis && (
            <>
              <div style={{ background: "#0D1117", borderRadius: 10, padding: 16, fontSize: 13, lineHeight: 1.7, marginBottom: 16 }}>
                {renderText(analysis)}
              </div>
              <button onClick={runAnalysis} style={{ background: "none", border: "1px solid #30363D", borderRadius: 8, padding: "8px 16px", color: "#8B949E", cursor: "pointer", fontSize: 12, fontFamily: "inherit", width: "100%" }}>
                🔄 Friss elemzés
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
