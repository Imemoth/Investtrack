import { Component } from "react";

export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{
          minHeight: "100vh", display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center", gap: 16, padding: 24,
          background: "#070B14", color: "#F0F6FC", fontFamily: "'DM Sans', sans-serif",
        }}>
          <div style={{ fontSize: 40 }}>⚠️</div>
          <div style={{ fontSize: 18, fontWeight: 700 }}>Valami elromlott</div>
          <div style={{ fontSize: 13, color: "#8B949E", maxWidth: 340, textAlign: "center", lineHeight: 1.6 }}>
            {this.state.error?.message || "Ismeretlen hiba történt"}
          </div>
          <button
            onClick={() => window.location.reload()}
            style={{
              background: "linear-gradient(135deg,#238636,#2EA043)", border: "none",
              borderRadius: 10, padding: "10px 24px", color: "#fff",
              cursor: "pointer", fontSize: 14, fontWeight: 700, fontFamily: "inherit",
            }}
          >
            🔄 Oldal újratöltése
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
