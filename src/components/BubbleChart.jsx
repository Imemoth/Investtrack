// components/BubbleChart.jsx
// Animált lebegő buborék chart – pozíciók súlya Canvas-on
import { useEffect, useRef, useState, useCallback } from "react";
import { fmtNum } from "../utils";

const PI2 = Math.PI * 2;

function hexToRgb(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return { r, g, b };
}

export function BubbleChart({ data, onSelect }) {
  const canvasRef   = useRef(null);
  const stateRef    = useRef({ bubbles: [], hovered: null, animId: null });
  const [tooltip,   setTooltip]   = useState(null);
  const [selected,  setSelected]  = useState(null);

  // Fizika inicializálása
  const initBubbles = useCallback((w, h, items) => {
    const total  = items.reduce((s, d) => s + d.value, 0);
    const maxR   = Math.min(w, h) * 0.22;
    const minR   = Math.min(w, h) * 0.045;

    return items.map((d, i) => {
      const r     = minR + (d.value / total) * (maxR - minR) * items.length * 0.6;
      const angle = (i / items.length) * PI2;
      const dist  = Math.min(w, h) * 0.28;
      const rgb   = hexToRgb(d.color);
      // Lissajous-szerű kezdőpozíció a középpont körül
      return {
        ...d,
        r,
        x: w / 2 + Math.cos(angle) * dist * (0.4 + Math.random() * 0.6),
        y: h / 2 + Math.sin(angle) * dist * (0.4 + Math.random() * 0.6),
        vx: (Math.random() - 0.5) * 0.4,
        vy: (Math.random() - 0.5) * 0.4,
        // 3D pulse fázis – minden buborék kicsit más ütemben pulzál
        phase: Math.random() * PI2,
        phaseSpeed: 0.012 + Math.random() * 0.008,
        rgb,
        // Parallax offset a "mélység" érzetéhez
        depth: 0.6 + Math.random() * 0.4,
        floatOffset: Math.random() * PI2,
      };
    });
  }, []);

  // Canvas draw loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !data.length) return;
    const ctx    = canvas.getContext("2d");
    const dpr    = window.devicePixelRatio || 1;
    const W      = canvas.offsetWidth;
    const H      = canvas.offsetHeight;
    canvas.width  = W * dpr;
    canvas.height = H * dpr;
    ctx.scale(dpr, dpr);

    const S = stateRef.current;
    S.bubbles = initBubbles(W, H, data);

    let t = 0;
    const draw = () => {
      t += 0.016;
      ctx.clearRect(0, 0, W, H);

      // Enyhe háttér glow
      const bgGrad = ctx.createRadialGradient(W/2, H/2, 0, W/2, H/2, Math.max(W,H)*0.6);
      bgGrad.addColorStop(0, "rgba(110,231,183,0.03)");
      bgGrad.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, W, H);

      // Fizika update
      S.bubbles.forEach(b => {
        // Lassú lebegés
        b.x += b.vx + Math.sin(t * 0.4 + b.floatOffset) * 0.15 * b.depth;
        b.y += b.vy + Math.cos(t * 0.3 + b.floatOffset * 1.3) * 0.12 * b.depth;

        // Fal visszapattanás (padding = r + 8)
        const pad = b.r + 8;
        if (b.x < pad)     { b.x = pad;     b.vx =  Math.abs(b.vx) * 0.6; }
        if (b.x > W - pad) { b.x = W - pad; b.vx = -Math.abs(b.vx) * 0.6; }
        if (b.y < pad)     { b.y = pad;     b.vy =  Math.abs(b.vy) * 0.6; }
        if (b.y > H - pad) { b.y = H - pad; b.vy = -Math.abs(b.vy) * 0.6; }

        // Enyhe közepes vonzás hogy ne menjenek szét
        b.vx += (W / 2 - b.x) * 0.00015;
        b.vy += (H / 2 - b.y) * 0.00015;

        // Sebesség csillapítás
        b.vx *= 0.995;
        b.vy *= 0.995;

        b.phase += b.phaseSpeed;
      });

      // Buborékok közötti ütközés
      for (let i = 0; i < S.bubbles.length; i++) {
        for (let j = i + 1; j < S.bubbles.length; j++) {
          const a = S.bubbles[i], bb = S.bubbles[j];
          const dx  = bb.x - a.x, dy = bb.y - a.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const minD = a.r + bb.r + 4;
          if (dist < minD && dist > 0) {
            const overlap = (minD - dist) / 2;
            const nx = dx / dist, ny = dy / dist;
            a.x -= nx * overlap; a.y -= ny * overlap;
            bb.x += nx * overlap; bb.y += ny * overlap;
            const relVx = bb.vx - a.vx, relVy = bb.vy - a.vy;
            const dot = relVx * nx + relVy * ny;
            if (dot < 0) {
              a.vx += dot * nx * 0.3; a.vy += dot * ny * 0.3;
              bb.vx -= dot * nx * 0.3; bb.vy -= dot * ny * 0.3;
            }
          }
        }
      }

      // Render – depth sort (hátsók előbb)
      const sorted = [...S.bubbles].sort((a, b) => a.depth - b.depth);
      sorted.forEach(b => {
        const isHov  = S.hovered === b.label;
        const isSel  = selected === b.label;
        const pulse  = Math.sin(b.phase) * 0.06 + 1;  // 0.94–1.06 méret pulzálás
        const r      = b.r * pulse * (isHov || isSel ? 1.12 : 1);
        const { rgb } = b;
        const alpha  = 0.55 + b.depth * 0.2 + (isHov || isSel ? 0.2 : 0);

        // 3D hatás: radiális gradient felső fénnyel
        const lightX = b.x - r * 0.3;
        const lightY = b.y - r * 0.35;
        const grad   = ctx.createRadialGradient(lightX, lightY, r * 0.05, b.x, b.y, r);
        grad.addColorStop(0,   `rgba(${rgb.r},${rgb.g},${rgb.b},${alpha + 0.25})`);
        grad.addColorStop(0.4, `rgba(${rgb.r},${rgb.g},${rgb.b},${alpha})`);
        grad.addColorStop(1,   `rgba(${Math.max(0,rgb.r-40)},${Math.max(0,rgb.g-40)},${Math.max(0,rgb.b-40)},${alpha * 0.7})`);

        // Shadow / glow
        ctx.shadowColor  = `rgba(${rgb.r},${rgb.g},${rgb.b},0.4)`;
        ctx.shadowBlur   = isHov || isSel ? 22 : 10;

        ctx.beginPath();
        ctx.arc(b.x, b.y, r, 0, PI2);
        ctx.fillStyle = grad;
        ctx.fill();

        // Szegély
        ctx.strokeStyle = `rgba(${rgb.r},${rgb.g},${rgb.b},${isHov || isSel ? 0.9 : 0.4})`;
        ctx.lineWidth   = isHov || isSel ? 2 : 1;
        ctx.stroke();

        // Highlight glint (kis fehér ív fent-bal)
        ctx.shadowBlur = 0;
        ctx.beginPath();
        ctx.arc(lightX, lightY, r * 0.28, 0, PI2);
        ctx.fillStyle = `rgba(255,255,255,${0.08 + (isHov ? 0.06 : 0)})`;
        ctx.fill();

        // Szöveg – csak ha elég nagy
        if (r > 18) {
          ctx.shadowBlur = 0;
          ctx.textAlign  = "center";
          ctx.textBaseline = "middle";
          const label = b.label.slice(0, r > 28 ? 5 : 4);
          ctx.font = `700 ${Math.max(9, Math.min(13, r * 0.38))}px 'DM Mono', monospace`;
          ctx.fillStyle = `rgba(255,255,255,0.92)`;
          ctx.fillText(label, b.x, b.y - (r > 28 ? 7 : 0));
          if (r > 28) {
            ctx.font = `600 ${Math.max(8, Math.min(11, r * 0.28))}px 'DM Sans', sans-serif`;
            ctx.fillStyle = `rgba(255,255,255,0.7)`;
            ctx.fillText(`${fmtNum(b.pct, 1)}%`, b.x, b.y + 8);
          }
        }
      });

      S.animId = requestAnimationFrame(draw);
    };

    S.animId = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(S.animId);
  }, [data, selected, initBubbles]);

  // Mouse / touch interakció
  const getHit = useCallback((cx, cy) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const mx   = cx - rect.left;
    const my   = cy - rect.top;
    const S    = stateRef.current;
    // Fordított sorrendben (felső buborék elsőbbsége)
    for (let i = S.bubbles.length - 1; i >= 0; i--) {
      const b  = S.bubbles[i];
      const dx = mx - b.x, dy = my - b.y;
      if (Math.sqrt(dx*dx + dy*dy) < b.r * 1.1) return b;
    }
    return null;
  }, []);

  const onMouseMove = e => {
    const hit = getHit(e.clientX, e.clientY);
    stateRef.current.hovered = hit?.label ?? null;
    setTooltip(hit ? { label: hit.label, fullName: hit.fullName, pct: hit.pct, value: hit.value, color: hit.color } : null);
  };

  const onMouseLeave = () => {
    stateRef.current.hovered = null;
    setTooltip(null);
  };

  const onTap = e => {
    e.preventDefault();
    const touch = e.changedTouches?.[0] || e;
    const hit   = getHit(touch.clientX, touch.clientY);
    if (hit) {
      setSelected(s => s === hit.label ? null : hit.label);
      onSelect?.(hit);
    }
  };

  return (
    <div style={{ position: "relative", width: "100%", height: 280, borderRadius: 12, overflow: "hidden", background: "#0D1117" }}>
      <canvas
        ref={canvasRef}
        style={{ width: "100%", height: "100%", display: "block", cursor: tooltip ? "pointer" : "default" }}
        onMouseMove={onMouseMove}
        onMouseLeave={onMouseLeave}
        onClick={onTap}
        onTouchEnd={onTap}
      />

      {/* Tooltip */}
      {tooltip && (
        <div style={{
          position: "absolute", bottom: 12, left: "50%", transform: "translateX(-50%)",
          background: "rgba(22,27,34,0.95)", border: `1px solid ${tooltip.color}`,
          borderRadius: 10, padding: "8px 14px", pointerEvents: "none",
          textAlign: "center", backdropFilter: "blur(8px)",
          boxShadow: `0 4px 20px ${tooltip.color}40`,
        }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#E6EDF3", marginBottom: 2 }}>{tooltip.fullName || tooltip.label}</div>
          <div style={{ fontSize: 12, fontFamily: "'DM Mono',monospace", color: tooltip.color, fontWeight: 700 }}>
            {fmtNum(tooltip.pct, 2)}% · {fmtNum(tooltip.value, 0)}
          </div>
        </div>
      )}

      {/* Tap hint mobilon */}
      <div style={{ position: "absolute", top: 8, right: 10, fontSize: 10, color: "#8B949E", pointerEvents: "none" }}>
        tap to select
      </div>
    </div>
  );
}
