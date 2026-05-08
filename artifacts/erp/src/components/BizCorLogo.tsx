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

/* ── Ring geometry constants ────────────────────────────────────── */
const RING_COLORS = [
  "#6366f1",
  "#8b5cf6",
  "#3b82f6",
  "#06b6d4",
  "#10b981",
];
const RING_DIRS   = [1, -1, 1, -1, 1];
const RING_SPEEDS = [0.28, 0.18, 0.22, 0.14, 0.32];
const ARC_SPAN    = Math.PI * 2;
const SEG_COLORS  = [
  ["rgba(99,102,241,1)","rgba(139,92,246,0.85)","rgba(79,70,229,0.9)"],
  ["rgba(139,92,246,1)","rgba(168,85,247,0.85)","rgba(99,102,241,0.9)"],
  ["rgba(59,130,246,1)","rgba(6,182,212,0.85)",  "rgba(99,102,241,0.9)"],
  ["rgba(6,182,212,1)", "rgba(16,185,129,0.85)", "rgba(59,130,246,0.9)"],
  ["rgba(16,185,129,1)","rgba(6,182,212,0.85)",  "rgba(52,211,153,0.9)"],
];

/* ── Shared canvas drawing helper ───────────────────────────────── */
function buildRings(W: number) {
  const R      = W / 2;
  const ringW  = Math.round(W * 0.025);
  const gap    = Math.round(W * 0.008);
  return {
    R,
    ringW,
    innerR: R - RING_COLORS.length * (ringW + gap) - ringW * 0.5,
    rings: RING_COLORS.map((color, i) => ({
      r: R - ringW * 0.5 - i * (ringW + gap),
      w: ringW,
      color,
      dir: RING_DIRS[i],
      speed: RING_SPEEDS[i],
      segs: SEG_COLORS[i],
    })),
  };
}

function drawRings(
  ctx: CanvasRenderingContext2D,
  W: number,
  t: number,
  rings: ReturnType<typeof buildRings>["rings"],
  ringW: number,
) {
  const R = W / 2;
  ctx.clearRect(0, 0, W, W);
  ctx.save();
  ctx.beginPath(); ctx.arc(R, R, R - 1, 0, Math.PI * 2); ctx.clip();

  const bg = ctx.createRadialGradient(R * 0.65, R * 0.55, 0, R, R, R);
  bg.addColorStop(0,   "#1e1b4b");
  bg.addColorStop(0.5, "#0f0a2e");
  bg.addColorStop(1,   "#050210");
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, W);

  const g2 = ctx.createRadialGradient(R * 0.4, R * 0.4, 0, R * 0.4, R * 0.4, R * 0.6);
  g2.addColorStop(0, "rgba(99,102,241,0.18)");
  g2.addColorStop(1, "rgba(99,102,241,0)");
  ctx.fillStyle = g2; ctx.fillRect(0, 0, W, W);

  rings.forEach(ring => {
    const angle    = t * ring.speed * ring.dir * Math.PI * 2;
    const segsN    = ring.segs.length;
    const sliceAngle = ARC_SPAN / segsN;
    ring.segs.forEach((segColor, si) => {
      const startA = angle + si * sliceAngle - Math.PI / 2;
      ctx.beginPath();
      ctx.arc(R, R, ring.r, startA, startA + sliceAngle);
      ctx.strokeStyle = segColor;
      ctx.lineWidth   = ring.w;
      ctx.lineCap     = "butt";
      ctx.stroke();
    });
    ctx.beginPath();
    ctx.arc(R, R, ring.r - ring.w * 0.42, angle - Math.PI / 2, angle + ARC_SPAN - Math.PI / 2);
    ctx.strokeStyle = "rgba(255,255,255,0.08)";
    ctx.lineWidth   = 1;
    ctx.stroke();
  });
}

function drawCenterGlow(
  ctx: CanvasRenderingContext2D,
  W: number,
  innerR: number,
) {
  const R = W / 2;
  const cg = ctx.createRadialGradient(R, R, 0, R, R, innerR);
  cg.addColorStop(0,    "rgba(139,92,246,0.45)");
  cg.addColorStop(0.55, "rgba(79,70,229,0.2)");
  cg.addColorStop(1,    "rgba(79,70,229,0)");
  ctx.fillStyle = cg; ctx.fillRect(0, 0, W, W);
}

function canvasBoxShadow(size: number) {
  return [
    "0 0 0 2px rgba(99,102,241,0.55)",
    "0 0 0 4.5px rgba(139,92,246,0.2)",
    `0 12px ${Math.round(size * 0.22)}px rgba(79,70,229,0.5)`,
    "0 4px 16px rgba(0,0,0,0.5)",
  ].join(",");
}

/* ────────────────────────────────────────────────────────────────
   BizCorCanvasLogo  — app logo (shows "BC")
   ──────────────────────────────────────────────────────────────── */
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
    const { R, ringW, innerR, rings } = buildRings(W);

    let animId: number;
    const t0 = performance.now();
    function draw(ts: number) {
      const t = (ts - t0) / 1000;
      drawRings(ctx, W, t, rings, ringW);
      drawCenterGlow(ctx, W, innerR);

      const fontSize = Math.round(innerR * 1.05);
      ctx.textAlign    = "center";
      ctx.textBaseline = "middle";
      ctx.font         = `900 ${fontSize}px 'Inter','Segoe UI',system-ui,sans-serif`;
      ctx.shadowColor  = "rgba(139,92,246,0.9)";
      ctx.shadowBlur   = Math.round(W * 0.08);
      const tg = ctx.createLinearGradient(R - innerR, R - innerR, R + innerR, R + innerR);
      tg.addColorStop(0,    "#e0e7ff");
      tg.addColorStop(0.45, "#a5b4fc");
      tg.addColorStop(1,    "#c4b5fd");
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
        <div style={{ animation: bounce ? "bc-bounce 1.7s cubic-bezier(.36,.07,.19,.97) infinite" : "none", display: "inline-block" }}>
          <div style={{ position: "relative" }}>
            <canvas ref={canvasRef} width={size} height={size}
              style={{ borderRadius: "50%", display: "block", boxShadow: canvasBoxShadow(size) }} />
            <div style={{
              position: "absolute", inset: 0, borderRadius: "50%",
              background: "linear-gradient(105deg,transparent 38%,rgba(220,220,255,0.06) 50%,transparent 62%)",
              backgroundSize: "200% 100%", animation: "bc-shimmer 3.8s ease-in-out infinite", pointerEvents: "none",
            }} />
          </div>
        </div>
        {bounce && (
          <div style={{
            width: size * 0.58, height: 7, borderRadius: "50%",
            background: "rgba(79,70,229,0.2)", marginTop: 2,
            animation: "bc-shadow 1.7s cubic-bezier(.36,.07,.19,.97) infinite",
          }} />
        )}
      </div>
    </>
  );
}

/* ────────────────────────────────────────────────────────────────
   BusinessAnimatedLogo  — per-business default logo
   Shows firm name inside the rings. Accepts name + subtitle.
   If user uploads custom image it won't be used (parent decides).
   ──────────────────────────────────────────────────────────────── */
export function BusinessAnimatedLogo({
  name = "Business",
  subtitle = "",
  size = 220,
  bounce = true,
}: {
  name?: string;
  subtitle?: string;
  size?: number;
  bounce?: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    const W = size;
    const { R, ringW, innerR, rings } = buildRings(W);

    /* ── Split firm name into 1-2 lines that fit inside innerR ── */
    const words = name.trim().toUpperCase().replace(/[^A-Z0-9& ]/g, "").split(/\s+/).filter(Boolean);
    let lines: string[];
    if (words.length === 0) {
      lines = ["BIZ"];
    } else if (words.length === 1) {
      const w = words[0];
      if (w.length <= 7) {
        lines = [w];
      } else {
        // Split long word in half
        const mid = Math.ceil(w.length / 2);
        lines = [w.slice(0, mid), w.slice(mid)];
      }
    } else if (words.length === 2) {
      lines = words;
    } else {
      // 3+ words → first two lines each = grouped words
      const mid = Math.ceil(words.length / 2);
      lines = [words.slice(0, mid).join(" "), words.slice(mid).join(" ")];
    }

    /* ── Compute max font size that fits ── */
    const maxW  = innerR * 1.85;
    const lh    = lines.length;
    let fontSize = Math.max(8, Math.floor(innerR * (lh === 1 ? 0.88 : lh === 2 ? 0.52 : 0.40)));

    // Shrink until all lines fit
    const testFont = (fs: number) => {
      ctx.font = `900 ${fs}px 'Inter','Segoe UI',system-ui,sans-serif`;
      return Math.max(...lines.map(l => ctx.measureText(l).width));
    };
    while (fontSize > 7 && testFont(fontSize) > maxW) fontSize -= 1;

    const lineHeight = fontSize * 1.15;
    const totalH     = lines.length * lineHeight;

    let animId: number;
    const t0 = performance.now();
    function draw(ts: number) {
      const t = (ts - t0) / 1000;
      drawRings(ctx, W, t, rings, ringW);
      drawCenterGlow(ctx, W, innerR);

      ctx.textAlign    = "center";
      ctx.textBaseline = "middle";
      ctx.font         = `900 ${fontSize}px 'Inter','Segoe UI',system-ui,sans-serif`;
      ctx.shadowColor  = "rgba(139,92,246,0.9)";
      ctx.shadowBlur   = Math.round(W * 0.07);

      const tg = ctx.createLinearGradient(R - innerR, R - innerR, R + innerR, R + innerR);
      tg.addColorStop(0,    "#e0e7ff");
      tg.addColorStop(0.45, "#a5b4fc");
      tg.addColorStop(1,    "#c4b5fd");
      ctx.fillStyle = tg;

      const startY = R - totalH / 2 + lineHeight / 2;
      lines.forEach((line, i) => {
        ctx.fillText(line, R, startY + i * lineHeight);
      });
      ctx.shadowBlur = 0;
      ctx.restore();
      animId = requestAnimationFrame(draw);
    }
    animId = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animId);
  }, [size, name]);

  return (
    <>
      <style>{CSS}</style>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 0 }}>
        <div style={{ animation: bounce ? "bc-bounce 1.7s cubic-bezier(.36,.07,.19,.97) infinite" : "none", display: "inline-block" }}>
          <div style={{ position: "relative" }}>
            <canvas ref={canvasRef} width={size} height={size}
              style={{ borderRadius: "50%", display: "block", boxShadow: canvasBoxShadow(size) }} />
            <div style={{
              position: "absolute", inset: 0, borderRadius: "50%",
              background: "linear-gradient(105deg,transparent 38%,rgba(220,220,255,0.06) 50%,transparent 62%)",
              backgroundSize: "200% 100%", animation: "bc-shimmer 3.8s ease-in-out infinite", pointerEvents: "none",
            }} />
          </div>
        </div>
        {bounce && (
          <div style={{
            width: size * 0.58, height: 7, borderRadius: "50%",
            background: "rgba(79,70,229,0.2)", marginTop: 2,
            animation: "bc-shadow 1.7s cubic-bezier(.36,.07,.19,.97) infinite",
          }} />
        )}
        {subtitle && (
          <div style={{
            marginTop: 10,
            background: "rgba(15,10,46,0.9)",
            border: "1px solid rgba(99,102,241,0.4)",
            borderRadius: 6,
            padding: "4px 14px",
            color: "#a5b4fc",
            fontSize: Math.max(10, Math.round(size * 0.055)),
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            fontWeight: 600,
          }}>
            {subtitle}
          </div>
        )}
      </div>
    </>
  );
}

/* ── Static icon (used in sidebar / nav) ───────────────────────── */
export function BizCorIcon({ size = 40, className = "" }: { size?: number; className?: string }) {
  const pad = size * 0.1;
  return (
    <div className={className} style={{
      width: size, height: size,
      borderRadius: Math.round(size * 0.28),
      background: "linear-gradient(145deg,#1d4ed8 0%,#4f46e5 60%,#7c3aed 100%)",
      boxShadow: `0 0 ${Math.round(size * 0.4)}px rgba(79,70,229,0.5),inset 0 1px 0 rgba(255,255,255,0.18)`,
      display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
    }}>
      <svg width={size - pad * 2} height={size - pad * 2} viewBox="0 0 40 40" fill="none">
        <path d="M10 8h12c3.3 0 6 2.7 6 6s-2.7 6-6 6H10V8z" fill="white"/>
        <path d="M10 20h13c3.9 0 7 3.1 7 7s-3.1 7-7 7H10V20z" fill="white"/>
      </svg>
    </div>
  );
}

/* ── Business initials icon — sidebar mini (no animation) ───────── */
export function BusinessInitialsIcon({
  name = "B",
  size = 32,
}: {
  name?: string;
  size?: number;
}) {
  const words = name.trim().split(/\s+/);
  const initials = words.length >= 2
    ? (words[0][0] + words[1][0]).toUpperCase()
    : name.slice(0, 2).toUpperCase();

  const fontSize = Math.max(8, Math.round(size * 0.38));
  return (
    <div style={{
      width: size, height: size,
      borderRadius: "50%",
      background: "linear-gradient(135deg,#4f46e5 0%,#7c3aed 100%)",
      boxShadow: `0 0 0 1.5px rgba(99,102,241,0.5), 0 2px 8px rgba(79,70,229,0.4)`,
      display: "flex", alignItems: "center", justifyContent: "center",
      flexShrink: 0, color: "#e0e7ff",
      fontWeight: 900, fontSize,
      fontFamily: "'Inter','Segoe UI',system-ui,sans-serif",
      letterSpacing: "-0.02em",
    }}>
      {initials}
    </div>
  );
}

/* ── Logo wrapper (login page + elsewhere) ─────────────────────── */
export function BizCorLogo({
  size = "md",
  animated = false,
  hideSubtitle = false,
}: {
  size?: "sm" | "md" | "lg";
  animated?: boolean;
  hideSubtitle?: boolean;
}) {
  const cfg = {
    sm: { iconSize: 28, canvasSize: 80,  titleClass: "text-sm font-bold",  subClass: "text-xs" },
    md: { iconSize: 48, canvasSize: 150, titleClass: "text-2xl font-bold", subClass: "text-sm" },
    lg: { iconSize: 64, canvasSize: 180, titleClass: "text-3xl font-bold", subClass: "text-base" },
  }[size];

  if (animated) {
    return (
      <div className="flex flex-col items-center gap-1">
        <BizCorCanvasLogo size={cfg.canvasSize} bounce />
        <div className="text-center mt-1">
          <div className={cfg.titleClass + " text-gray-900"}>
            <span>Biz</span><span className="text-indigo-600">Cor</span>
          </div>
          {!hideSubtitle && <div className={cfg.subClass + " text-gray-500"}>Indian Business ERP</div>}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <BizCorIcon size={cfg.iconSize} />
      <div className="text-center">
        <div className={cfg.titleClass + " text-gray-900"}>
          <span>Biz</span><span className="text-indigo-600">Cor</span>
        </div>
        {!hideSubtitle && <div className={cfg.subClass + " text-gray-500"}>Indian Business ERP</div>}
      </div>
    </div>
  );
}
