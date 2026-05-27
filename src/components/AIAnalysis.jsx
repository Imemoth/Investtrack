import { useState } from "react";
import { calcPnL, fmtNum } from "../utils";

export function AIAnalysis({ investments, onClose }) {
  const [analysis, setAnalysis] = useState(null);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState(null);

  const runAnalysis = async () => {
    setLoading(true); setError(null); setAnalysis(null);

    const portfolioSummary = investments.map(inv => {
      const { pct, value } = calcPnL(inv);
      return `- ${inv.name} (${inv.ticker}): ${fmtNum(value, 0)} ${inv.currency}, P&L: ${fmtNum(pct, 2)}%, kategória: ${inv.category}`;
    }).join("\n");

    const totalValue    = investments.reduce((s, i) => s + i.currentPrice * i.quantity, 0);
    const totalCost     = investments.reduce((s, i) => s + i.buyPrice * i.quantity, 0);
    const totalPnLPct   = totalCost > 0 ? ((totalValue - totalCost) / totalCost * 100) : 0;

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
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          messages: [{ role: "user", content: prompt }],
        }),
      });
      const data = await res.json();
      const text = data?.content?.find(b => b.type === "text")?.text;
      if (!text) throw new Error("Üres válasz");
      setAnalysis(text);
    } catch (e) {
      setError("AI elemzés sikertelen: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  // Markdown-szerű bold + newline renderelés
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

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.8)", backdropFilter: "blur(4px)", zIndex: 60, display: "flex", alignItems: "flex-end" }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ background: "#161B22", border: "1px solid #30363D", borderRadius: "16px 16px 0 0", width: "100%", maxHeight: "85vh", display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid #21262D", flexShrink: 0, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontWeight: 700, color: "#E6EDF3", fontSize: 16 }}>🤖 AI Portfólió-elemzés</div>
            <div style={{ fontSize: 11, color: "#8B949E", marginTop: 2 }}>Claude Sonnet elemzi a portfóliódat</div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#8B949E", cursor: "pointer", fontSize: 22 }}>×</button>
        </div>

        <div style={{ overflowY: "auto", flex: 1, padding: "20px" }}>
          {!analysis && !loading && !error && (
            <div style={{ textAlign: "center", padding: "30px 0" }}>
              <div style={{ fontSize: 40, marginBottom: 16 }}>🤖</div>
              <div style={{ color: "#8B949E", fontSize: 14, marginBottom: 8 }}>
                Elemzem a {investments.length} pozíciós portfóliódat:
              </div>
              <div style={{ color: "#8B949E", fontSize: 12, marginBottom: 24 }}>
                diverzifikáció, kockázatok, erősségek és javaslatok
              </div>
              <button onClick={runAnalysis} style={{
                background: "linear-gradient(135deg,#238636,#2EA043)", border: "none",
                borderRadius: 10, padding: "12px 28px", color: "#fff",
                cursor: "pointer", fontSize: 14, fontWeight: 700, fontFamily: "inherit",
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
            <div style={{ textAlign: "center", padding: "30px 0" }}>
              <div style={{ color: "#FCA5A5", fontSize: 13, marginBottom: 16 }}>{error}</div>
              <button onClick={runAnalysis} style={{ background: "#21262D", border: "none", borderRadius: 8, padding: "8px 16px", color: "#C9D1D9", cursor: "pointer", fontSize: 13, fontFamily: "inherit" }}>
                Újrapróbálás
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
