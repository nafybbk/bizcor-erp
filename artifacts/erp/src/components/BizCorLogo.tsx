import { useEffect, useRef } from "react";

/* ── CSS animations ─────────────────────────────────────────────── */
const CSS = `
@keyframes bc-bounce {
  0%,100% { transform: translateY(0) scale(1); }
  40%      { transform: translateY(-16px) scale(1.04); }
  70%      { transform: translateY(-5px) scale(0.98); }
}
@keyframes bc-shadow {
  0%,100% { transform: scaleX(1); opacity: 0.28; }
  50%      { transform: scaleX(0.48); opacity: 0.1; }
}
@keyframes bc-shimmer {
  0%   { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
`;

/* ── Colors: tight concentric rings ────────────────────────────── */
const RING_COLORS = [
  "#6366f1", // indigo
  "#8b5cf6", // violet
  "#3b82f6", // blue
  "#06b6d4", // cyan
  "#10b981", // emerald
];

/* ring directions alternated so each ring spins different way */
const RING_DIRS   = [1, -1, 1, -1, 1];
const RING_SPEEDS = [0.28, 0.18, 0.22, 0.14, 0.32];
/* full 360° rings — completely filled, no gap */
const ARC_SPAN = Math.PI * 2;

/* segment breakdown inside each ring — makes it look multi-colored per ring */
const SEG_COLORS = [
  ["rgba(99,102,241,1)","rgba(139,92,246,0.85)","rgba(79,70,229,0.9)"],
  ["rgba(139,92,246,1)","rgba(168,85,247,0.85)","rgba(99,102,241,0.9)"],
  ["rgba(59,130,246,1)","rgba(6,182,212,0.85)",  "rgba(99,102,241,0.9)"],
  ["rgba(6,182,212,1)", "rgba(16,185,129,0.85)", "rgba(59,130,246,0.9)"],
  ["rgba(16,185,129,1)","rgba(6,182,212,0.85)",  "rgba(52,211,153,0.9)"],
];

export function BizCorCanvasLogo({
  size = 220,
  bounce = true,
}: {
  size?: number;
  bounce?: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    const W = size;
    const R = W / 2;

    /* ring geometry: 5 tight concentric rings — half thickness */
    const ringW = Math.round(W * 0.025);        // ring thickness (halved)
    const gap   = Math.round(W * 0.008);        // tiny gap between rings
    const rings  = RING_COLORS.map((color, i) => ({
      r: R - ringW * 0.5 - i * (ringW + gap),   // center radius
      w: ringW,
      color,
      dir: RING_DIRS[i],
      speed: RING_SPEEDS[i],
      segs: SEG_COLORS[i],
    }));

    let animId: number;
    const t0 = performance.now();

    function draw(ts: number) {
      const t = (ts - t0) / 1000;
      ctx.clearRect(0, 0, W, W);

      /* --- clip to circle --- */
      ctx.save();
      ctx.beginPath(); ctx.arc(R, R, R - 1, 0, Math.PI * 2); ctx.clip();

      /* --- background: deep navy gradient --- */
      const bg = ctx.createRadialGradient(R * 0.65, R * 0.55, 0, R, R, R);
      bg.addColorStop(0,   "#1e1b4b");
      bg.addColorStop(0.5, "#0f0a2e");
      bg.addColorStop(1,   "#050210");
      ctx.fillStyle = bg; ctx.fillRect(0, 0, W, W);

      /* extra glow blob */
      const g2 = ctx.createRadialGradient(R * 0.4, R * 0.4, 0, R * 0.4, R * 0.4, R * 0.6);
      g2.addColorStop(0, "rgba(99,102,241,0.18)");
      g2.addColorStop(1, "rgba(99,102,241,0)");
      ctx.fillStyle = g2; ctx.fillRect(0, 0, W, W);

      /* --- concentric rotating rings --- */
      rings.forEach((ring, ri) => {
        const angle = t * ring.speed * ring.dir * Math.PI * 2;
        /* each ring split into 3 colored segments, touching, full fill */
        const segsN = ring.segs.length;
        const sliceAngle = ARC_SPAN / segsN;
        ring.segs.forEach((segColor, si) => {
          const startA = angle + si * sliceAngle - Math.PI / 2;
          const endA   = startA + sliceAngle;
          ctx.beginPath();
          ctx.arc(R, R, ring.r, startA, endA);
          ctx.strokeStyle = segColor;
          ctx.lineWidth   = ring.w;
          ctx.lineCap     = "butt";
          ctx.stroke();
        });

        /* thin highlight edge on each ring */
        ctx.beginPath();
        ctx.arc(R, R, ring.r - ring.w * 0.42, angle - Math.PI / 2,
                      angle + ARC_SPAN - Math.PI / 2);
        ctx.strokeStyle = "rgba(255,255,255,0.08)";
        ctx.lineWidth   = 1;
        ctx.stroke();
      });

      /* --- center radial glow --- */
      const innerR = rings[rings.length - 1].r - ringW * 0.55;
      const cg = ctx.createRadialGradient(R, R, 0, R, R, innerR);
      cg.addColorStop(0,   "rgba(139,92,246,0.45)");
      cg.addColorStop(0.55,"rgba(79,70,229,0.2)");
      cg.addColorStop(1,   "rgba(79,70,229,0)");
      ctx.fillStyle = cg; ctx.fillRect(0, 0, W, W);

      /* --- BC text in center --- */
      const fontSize = Math.round(innerR * 1.05);
      ctx.textAlign    = "center";
      ctx.textBaseline = "middle";
      ctx.font         = `900 ${fontSize}px 'Inter','Segoe UI',system-ui,sans-serif`;

      /* text glow */
      ctx.shadowColor  = "rgba(139,92,246,0.9)";
      ctx.shadowBlur   = Math.round(W * 0.08);
      const tg = ctx.createLinearGradient(R - innerR, R - innerR, R + innerR, R + innerR);
      tg.addColorStop(0,   "#e0e7ff");
      tg.addColorStop(0.45,"#a5b4fc");
      tg.addColorStop(1,   "#c4b5fd");
      ctx.fillStyle = tg;
      ctx.fillText("BC", R, R + fontSize * 0.04);
      ctx.shadowBlur = 0;

      ctx.restore();
      animId = requestAnimationFrame(draw);
    }

    animId = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animId);
  }, [size]);

  return (
    <>
      <style>{CSS}</style>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 0 }}>
        <div style={{
          animation: bounce ? "bc-bounce 1.7s cubic-bezier(.36,.07,.19,.97) infinite" : "none",
          display: "inline-block",
        }}>
          <div style={{ position: "relative" }}>
            <canvas
              ref={canvasRef}
              width={size}
              height={size}
              style={{
                borderRadius: "50%",
                display: "block",
                boxShadow: [
                  "0 0 0 2px rgba(99,102,241,0.55)",
                  "0 0 0 4.5px rgba(139,92,246,0.2)",
                  "0 12px 48px rgba(79,70,229,0.5)",
                  "0 4px 16px rgba(0,0,0,0.5)",
                ].join(","),
              }}
            />
            {/* shimmer sweep */}
            <div style={{
              position: "absolute", inset: 0, borderRadius: "50%",
              background: "linear-gradient(105deg,transparent 38%,rgba(220,220,255,0.06) 50%,transparent 62%)",
              backgroundSize: "200% 100%",
              animation: "bc-shimmer 3.8s ease-in-out infinite",
              pointerEvents: "none",
            }} />
          </div>
        </div>

        {/* ground shadow */}
        {bounce && (
          <div style={{
            width: size * 0.58, height: 7, borderRadius: "50%",
            background: "rgba(79,70,229,0.2)",
            marginTop: 2,
            animation: "bc-shadow 1.7s cubic-bezier(.36,.07,.19,.97) infinite",
          }} />
        )}
      </div>
    </>
  );
}

/* ── Static icon (used in sidebar / nav) ───────────────────────── */
export function BizCorIcon({ size = 40, className = "" }: { size?: number; className?: string }) {
  const pad = size * 0.1;
  return (
    <div
      className={className}
      style={{
        width: size, height: size,
        borderRadius: Math.round(size * 0.28),
        background: "linear-gradient(145deg,#1d4ed8 0%,#4f46e5 60%,#7c3aed 100%)",
        boxShadow: `0 0 ${Math.round(size * 0.4)}px rgba(79,70,229,0.5),inset 0 1px 0 rgba(255,255,255,0.18)`,
        display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
      }}
    >
      <svg width={size - pad * 2} height={size - pad * 2} viewBox="0 0 40 40" fill="none">
        <path d="M10 8h12c3.3 0 6 2.7 6 6s-2.7 6-6 6H10V8z" fill="white"/>
        <path d="M10 20h13c3.9 0 7 3.1 7 7s-3.1 7-7 7H10V20z" fill="white"/>
      </svg>
    </div>
  );
}

/* ── Logo wrapper (login page + elsewhere) ─────────────────────── */
export function BizCorLogo({
  size = "md",
  animated = false,
}: {
  size?: "sm" | "md" | "lg";
  animated?: boolean;
}) {
  const cfg = {
    sm: { iconSize: 28, canvasSize: 100, titleClass: "text-sm font-bold",  subClass: "text-xs" },
    md: { iconSize: 48, canvasSize: 150, titleClass: "text-2xl font-bold", subClass: "text-sm" },
    lg: { iconSize: 64, canvasSize: 180, titleClass: "text-3xl font-bold", subClass: "text-base" },
  }[size];

  if (animated) {
    return (
      <div className="flex flex-col items-center gap-3">
        <BizCorCanvasLogo size={cfg.canvasSize} bounce />
        <div className="text-center mt-1">
          <div className={cfg.titleClass + " text-gray-900"}>
            <span>Biz</span><span className="text-indigo-600">Cor</span>
          </div>
          <div className={cfg.subClass + " text-gray-500"}>Indian Business ERP</div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <BizCorIcon size={cfg.iconSize} />
      <div className="text-center">
        <div className={cfg.titleClass + " text-gray-900"}>
          <span>Biz</span><span className="text-indigo-600">Cor</span>
        </div>
        <div className={cfg.subClass + " text-gray-500"}>Indian Business ERP</div>
      </div>
    </div>
  );
}
