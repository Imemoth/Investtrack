// src/components/AuthScreen.jsx
import { useState } from "react";
import { supabase, signInWithGoogle } from "../services/supabase";
import { THEME as T } from "../design-system";

export function AuthScreen() {
  const [email,   setEmail]   = useState("");
  const [pass,    setPass]    = useState("");
  const [mode,    setMode]    = useState("login"); // "login" | "register"
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState(null);
  const [sent,    setSent]    = useState(false);

  const inputStyle = {
    width: "100%", background: T.bg.inset, border: `1px solid ${T.border.default}`,
    borderRadius: T.radius.md, padding: "12px 14px", color: T.text.primary,
    fontSize: 15, fontFamily: "inherit", outline: "none", boxSizing: "border-box",
  };

  const handleEmailAuth = async () => {
    if (!email || !pass) return;
    setLoading(true); setError(null);
    try {
      if (mode === "register") {
        const { error } = await supabase.auth.signUp({
          email, password: pass,
          options: { emailRedirectTo: window.location.origin }
        });
        if (error) throw error;
        setSent(true);
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password: pass });
        if (error) throw error;
      }
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  };

  const handleGoogle = async () => {
    setLoading(true); setError(null);
    try {
      const { error } = await signInWithGoogle();
      if (error) throw error;
    } catch (e) {
      setError(e.message);
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: "100dvh", display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      background: T.bg.base, padding: 24,
    }}>
      {/* Logo */}
      <div style={{ marginBottom: 32, textAlign: "center" }}>
        <div style={{ fontSize: 36, marginBottom: 8 }}>📈</div>
        <div style={{ fontSize: 26, fontWeight: 800, color: T.text.primary, letterSpacing: "-0.03em" }}>
          Invest<span style={{ color: T.accent.green }}>Track</span>
        </div>
        <div style={{ fontSize: 13, color: T.text.tertiary, marginTop: 6 }}>
          Portfóliókezelő · Bejelentkezés
        </div>
      </div>

      <div style={{
        width: "100%", maxWidth: 380,
        background: T.bg.surface, border: `1px solid ${T.border.subtle}`,
        borderRadius: 16, padding: 24, display: "flex", flexDirection: "column", gap: 14,
      }}>
        {/* Google */}
        <button onClick={handleGoogle} disabled={loading} style={{
          width: "100%", background: "rgba(255,255,255,0.06)", border: `1px solid ${T.border.default}`,
          borderRadius: T.radius.md, padding: "12px", cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
          color: T.text.primary, fontSize: 14, fontWeight: 600, fontFamily: "inherit",
          opacity: loading ? 0.6 : 1,
        }}>
          <svg width="18" height="18" viewBox="0 0 48 48">
            <path fill="#4285F4" d="M24 9.5c3.5 0 6.6 1.2 9 3.2l6.7-6.7C35.5 2.3 30.1 0 24 0 14.7 0 6.7 5.4 2.7 13.3l7.8 6.1C12.4 13.3 17.7 9.5 24 9.5z"/>
            <path fill="#34A853" d="M46.1 24.5c0-1.6-.1-3.1-.4-4.5H24v8.5h12.4c-.5 2.8-2.1 5.2-4.5 6.8l7 5.4c4.1-3.8 6.2-9.4 6.2-16.2z"/>
            <path fill="#FBBC05" d="M10.5 28.6A14.5 14.5 0 0 1 9.5 24c0-1.6.3-3.2.8-4.6L2.5 13.3A23.9 23.9 0 0 0 0 24c0 3.8.9 7.4 2.5 10.6l8-6z"/>
            <path fill="#EA4335" d="M24 48c6.1 0 11.2-2 14.9-5.4l-7-5.4C30 38.8 27.2 39.5 24 39.5c-6.3 0-11.6-3.8-13.5-9.1l-7.8 6C6.7 42.6 14.7 48 24 48z"/>
          </svg>
          Bejelentkezés Google-lel
        </button>

        {/* Elválasztó */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ flex: 1, height: 1, background: T.border.subtle }} />
          <span style={{ fontSize: 11, color: T.text.tertiary }}>vagy email-lel</span>
          <div style={{ flex: 1, height: 1, background: T.border.subtle }} />
        </div>

        {sent ? (
          <div style={{ textAlign: "center", padding: "16px 0", color: T.accent.green, fontSize: 13, lineHeight: 1.6 }}>
            ✓ Visszaigazoló email elküldve!<br/>
            <span style={{ color: T.text.tertiary, fontSize: 12 }}>Ellenőrizd a postaládádat.</span>
          </div>
        ) : (
          <>
            <input style={inputStyle} type="email" placeholder="Email cím"
              value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" />
            <input style={inputStyle} type="password" placeholder="Jelszó"
              value={pass} onChange={e => setPass(e.target.value)} autoComplete={mode === "register" ? "new-password" : "current-password"}
              onKeyDown={e => e.key === "Enter" && handleEmailAuth()} />

            {error && (
              <div style={{ fontSize: 12, color: T.accent.red, padding: "6px 10px", background: "rgba(252,165,165,0.1)", borderRadius: T.radius.sm }}>
                {error}
              </div>
            )}

            <button onClick={handleEmailAuth} disabled={loading || !email || !pass} style={{
              background: T.gradient.primary, border: "none", borderRadius: T.radius.md,
              padding: "12px", color: "#fff", cursor: "pointer", fontSize: 14, fontWeight: 700,
              fontFamily: "inherit", opacity: loading || !email || !pass ? 0.6 : 1,
              boxShadow: "0 2px 12px rgba(46,160,67,0.35)",
            }}>
              {loading ? "⟳ Folyamatban..." : mode === "register" ? "Regisztráció" : "Bejelentkezés"}
            </button>

            <button onClick={() => { setMode(m => m === "login" ? "register" : "login"); setError(null); }}
              style={{ background: "none", border: "none", color: T.text.tertiary, cursor: "pointer", fontSize: 12, fontFamily: "inherit" }}>
              {mode === "login" ? "Még nincs fiókom → Regisztráció" : "Már van fiókom → Bejelentkezés"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
