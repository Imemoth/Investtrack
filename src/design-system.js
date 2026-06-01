// design-system.js — InvestTrack Design Tokens
// Glassmorphism dark theme

export const THEME = {
  // ── Háttér rétegek ──────────────────────────────────────────
  bg: {
    base:    "#070B14",          // legmélyebb háttér
    surface: "rgba(255,255,255,0.04)",  // glass kártya alap
    raised:  "rgba(255,255,255,0.07)",  // emelt kártya
    overlay: "rgba(255,255,255,0.10)",  // modal/drawer
    inset:   "rgba(0,0,0,0.25)",        // bemélyedő input
  },

  // ── Szegélyek ────────────────────────────────────────────────
  border: {
    subtle:  "rgba(255,255,255,0.07)",
    default: "rgba(255,255,255,0.12)",
    strong:  "rgba(255,255,255,0.20)",
    accent:  "rgba(110,231,183,0.35)",
  },

  // ── Blur értékek ─────────────────────────────────────────────
  blur: {
    sm: "blur(8px)",
    md: "blur(16px)",
    lg: "blur(24px)",
  },

  // ── Szöveg ───────────────────────────────────────────────────
  text: {
    primary:   "#F0F6FC",
    secondary: "#8B949E",
    tertiary:  "#484F58",
    accent:    "#6EE7B7",
    danger:    "#FCA5A5",
    warning:   "#FDE68A",
    info:      "#93C5FD",
  },

  // ── Accent színek ────────────────────────────────────────────
  accent: {
    green:  "#6EE7B7",
    red:    "#FCA5A5",
    blue:   "#93C5FD",
    yellow: "#FDE68A",
    purple: "#C4B5FD",
    pink:   "#F9A8D4",
  },

  // ── Gradiens paletta ─────────────────────────────────────────
  gradient: {
    primary:   "linear-gradient(135deg, #238636 0%, #2EA043 100%)",
    accent:    "linear-gradient(135deg, #6EE7B7 0%, #3B82F6 100%)",
    danger:    "linear-gradient(135deg, #EF4444 0%, #F97316 100%)",
    gold:      "linear-gradient(135deg, #F59E0B 0%, #FBBF24 100%)",
    surface:   "linear-gradient(135deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.03) 100%)",
    heroGreen: "linear-gradient(135deg, rgba(110,231,183,0.15) 0%, rgba(59,130,246,0.08) 100%)",
  },

  // ── Shadow ───────────────────────────────────────────────────
  shadow: {
    card:   "0 4px 24px rgba(0,0,0,0.4), 0 1px 0 rgba(255,255,255,0.06) inset",
    raised: "0 8px 40px rgba(0,0,0,0.5), 0 1px 0 rgba(255,255,255,0.08) inset",
    glow:   (color) => `0 0 24px ${color}40, 0 4px 16px rgba(0,0,0,0.4)`,
    modal:  "0 24px 80px rgba(0,0,0,0.7), 0 1px 0 rgba(255,255,255,0.08) inset",
  },

  // ── Radius ───────────────────────────────────────────────────
  radius: {
    sm:  6,
    md:  10,
    lg:  14,
    xl:  20,
    full: 9999,
  },

  // ── Animáció ─────────────────────────────────────────────────
  transition: {
    fast:   "all 0.15s cubic-bezier(0.4, 0, 0.2, 1)",
    normal: "all 0.25s cubic-bezier(0.4, 0, 0.2, 1)",
    slow:   "all 0.4s cubic-bezier(0.4, 0, 0.2, 1)",
    spring: "all 0.35s cubic-bezier(0.34, 1.56, 0.64, 1)",
  },
};

// Light theme override
export const LIGHT_THEME = {
  ...THEME,
  bg: {
    base:    "#F0F4F8",
    surface: "rgba(255,255,255,0.80)",
    raised:  "rgba(255,255,255,0.95)",
    overlay: "rgba(255,255,255,0.97)",
    inset:   "rgba(0,0,0,0.04)",
  },
  border: {
    subtle:  "rgba(0,0,0,0.06)",
    default: "rgba(0,0,0,0.10)",
    strong:  "rgba(0,0,0,0.18)",
    accent:  "rgba(34,139,86,0.35)",
  },
  text: {
    primary:   "#0D1117",
    secondary: "#57606A",
    tertiary:  "#8C959F",
    accent:    "#1A7F37",
    danger:    "#CF222E",
    warning:   "#9A6700",
    info:      "#0969DA",
  },
  accent: {
    ...THEME.accent,
    yellow: "#B45309",
  },
};

// ── Glassmorphism kártya helper ──────────────────────────────
export function glassCard(t, extra = {}) {
  return {
    background: t.bg.surface,
    border: `1px solid ${t.border.default}`,
    borderRadius: t.radius.lg,
    backdropFilter: t.blur.md,
    WebkitBackdropFilter: t.blur.md,
    boxShadow: t.shadow.card,
    ...extra,
  };
}

// ── Haptic feedback helper ────────────────────────────────────
export function haptic(type = "light") {
  if (!navigator.vibrate) return;
  const patterns = { light: 8, medium: 15, heavy: 25, success: [10, 50, 10], error: [20, 50, 20, 50, 20] };
  navigator.vibrate(patterns[type] || 8);
}

// ── CSS animáció keyframe stringek (style tagbe) ──────────────
export const KEYFRAMES = `
  @keyframes slideIn    { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
  @keyframes slideUp    { from { opacity:0; transform:translateY(20px); } to { opacity:1; transform:translateY(0); } }
  @keyframes fadeIn     { from { opacity:0; } to { opacity:1; } }
  @keyframes scaleIn    { from { opacity:0; transform:scale(0.95); } to { opacity:1; transform:scale(1); } }
  @keyframes spin       { from { transform:rotate(0deg); } to { transform:rotate(360deg); } }
  @keyframes pulse      { 0%,100% { opacity:1; } 50% { opacity:0.5; } }
  @keyframes shimmer    { 0% { background-position:-200% 0; } 100% { background-position:200% 0; } }
  @keyframes float      { 0%,100% { transform:translateY(0px); } 50% { transform:translateY(-4px); } }
  @keyframes glowPulse  { 0%,100% { box-shadow:0 0 12px rgba(110,231,183,0.3); } 50% { box-shadow:0 0 24px rgba(110,231,183,0.6); } }
  @keyframes numberTick { from { transform:translateY(-100%); opacity:0; } to { transform:translateY(0); opacity:1; } }
`;
