const CSS = `
@keyframes bc-bounce {
  0%,100% { transform: translateY(0px) scale(1); }
  30%      { transform: translateY(-18px) scale(1.07); }
  50%      { transform: translateY(-22px) scale(1.04); }
  70%      { transform: translateY(-6px) scale(0.97); }
  85%      { transform: translateY(-12px) scale(1.02); }
}
@keyframes bc-shadow {
  0%,100% { transform: scaleX(1); opacity: 0.35; }
  50%      { transform: scaleX(0.55); opacity: 0.15; }
}
@keyframes bc-spin1 {
  from { transform: rotate(0deg); }
  to   { transform: rotate(360deg); }
}
@keyframes bc-spin2 {
  from { transform: rotate(0deg); }
  to   { transform: rotate(-360deg); }
}
@keyframes bc-spin3 {
  from { transform: rotate(45deg); }
  to   { transform: rotate(405deg); }
}
@keyframes bc-leaf {
  0%,100% { transform: scale(1) rotate(0deg); opacity: 0.9; }
  50%      { transform: scale(1.35) rotate(180deg); opacity: 0.6; }
}
@keyframes bc-glow {
  0%,100% { box-shadow: 0 0 24px 6px rgba(99,102,241,0.55), 0 0 8px 2px rgba(168,85,247,0.4), inset 0 1px 0 rgba(255,255,255,0.2); }
  50%      { box-shadow: 0 0 40px 12px rgba(79,70,229,0.75), 0 0 18px 6px rgba(139,92,246,0.6), inset 0 1px 0 rgba(255,255,255,0.2); }
}
@keyframes bc-pulse {
  0%,100% { opacity: 0.7; transform: scale(1); }
  50%      { opacity: 1; transform: scale(1.12); }
}
`;

const RINGS = [
  { size: 110, color: "#6366f1", dash: "22 10", dur: 2.8,  rev: false, width: 4 },
  { size: 140, color: "#a855f7", dash: "16 14", dur: 3.6,  rev: true,  width: 3.5 },
  { size: 168, color: "#3b82f6", dash: "28 8",  dur: 4.5,  rev: false, width: 3 },
  { size: 194, color: "#ec4899", dash: "12 18", dur: 5.2,  rev: true,  width: 2.5 },
];

const LEAVES = [
  { ring: 0, angle: 0,   color: "#818cf8", size: 9 },
  { ring: 0, angle: 180, color: "#c4b5fd", size: 7 },
  { ring: 1, angle: 60,  color: "#d946ef", size: 8 },
  { ring: 1, angle: 240, color: "#f0abfc", size: 6 },
  { ring: 2, angle: 30,  color: "#60a5fa", size: 9 },
  { ring: 2, angle: 200, color: "#93c5fd", size: 7 },
  { ring: 3, angle: 90,  color: "#f472b6", size: 8 },
  { ring: 3, angle: 270, color: "#fb7185", size: 6 },
];

export function BizCorIcon({ size = 40, className = "" }: { size?: number; className?: string }) {
  const pad = size * 0.1;
  const r = Math.round(size * 0.22);
  return (
    <div
      className={className}
      style={{
        width: size, height: size,
        borderRadius: Math.round(size * 0.28),
        background: "linear-gradient(145deg,#1d4ed8 0%,#4f46e5 60%,#7c3aed 100%)",
        boxShadow: `0 0 ${Math.round(size*0.4)}px rgba(79,70,229,0.5),inset 0 1px 0 rgba(255,255,255,0.18)`,
        display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
      }}
    >
      <svg width={size-pad*2} height={size-pad*2} viewBox="0 0 40 40" fill="none">
        <path d="M10 8h12c3.3 0 6 2.7 6 6s-2.7 6-6 6H10V8z" fill="white"/>
        <path d="M10 20h13c3.9 0 7 3.1 7 7s-3.1 7-7 7H10V20z" fill="white"/>
      </svg>
    </div>
  );
}

export function BizCorAnimatedIcon({ size = 72 }: { size?: number }) {
  const canvasSize = 220;
  const center = canvasSize / 2;

  return (
    <>
      <style>{CSS}</style>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 0 }}>
        <div style={{ position: "relative", width: canvasSize, height: canvasSize, display: "flex", alignItems: "center", justifyContent: "center" }}>

          {/* Rotating SVG rings with dashes + orbiting leaves */}
          {RINGS.map((ring, ri) => {
            const r = ring.size / 2;
            const leaves = LEAVES.filter(l => l.ring === ri);
            const spinAnim = ri % 2 === 0 ? "bc-spin1" : "bc-spin2";
            return (
              <div key={ri} style={{
                position: "absolute",
                width: ring.size, height: ring.size,
                top: center - r, left: center - r,
                animation: `${spinAnim} ${ring.dur}s linear infinite`,
              }}>
                <svg width={ring.size} height={ring.size} viewBox={`0 0 ${ring.size} ${ring.size}`}>
                  <circle
                    cx={r} cy={r} r={r - ring.width}
                    fill="none"
                    stroke={ring.color}
                    strokeWidth={ring.width}
                    strokeDasharray={ring.dash}
                    strokeLinecap="round"
                    opacity={0.7}
                  />
                  {leaves.map((leaf, li) => {
                    const rad = (leaf.angle * Math.PI) / 180;
                    const lx = r + (r - ring.width) * Math.cos(rad);
                    const ly = r + (r - ring.width) * Math.sin(rad);
                    return (
                      <ellipse
                        key={li}
                        cx={lx} cy={ly}
                        rx={leaf.size / 2} ry={leaf.size * 0.9}
                        fill={leaf.color}
                        transform={`rotate(${leaf.angle + 90},${lx},${ly})`}
                        style={{ animation: `bc-leaf ${1.6 + li * 0.4}s ease-in-out infinite` }}
                        opacity={0.85}
                      />
                    );
                  })}
                </svg>
              </div>
            );
          })}

          {/* Center bouncing logo ball */}
          <div style={{
            position: "absolute",
            top: center - size / 2,
            left: center - size / 2,
            width: size, height: size,
            animation: "bc-bounce 1.4s cubic-bezier(.36,.07,.19,.97) infinite, bc-glow 1.4s ease-in-out infinite",
            borderRadius: Math.round(size * 0.28),
            background: "linear-gradient(145deg,#1d4ed8 0%,#4f46e5 60%,#7c3aed 100%)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <svg width={size * 0.72} height={size * 0.72} viewBox="0 0 40 40" fill="none">
              <path d="M10 8h12c3.3 0 6 2.7 6 6s-2.7 6-6 6H10V8z" fill="white"/>
              <path d="M10 20h13c3.9 0 7 3.1 7 7s-3.1 7-7 7H10V20z" fill="white"/>
            </svg>
          </div>
        </div>

        {/* Shadow below bouncing ball */}
        <div style={{
          width: size * 0.7, height: 8, borderRadius: "50%",
          background: "rgba(79,70,229,0.28)",
          marginTop: -16,
          animation: "bc-shadow 1.4s cubic-bezier(.36,.07,.19,.97) infinite",
        }} />
      </div>
    </>
  );
}

export function BizCorLogo({ size = "md", animated = false }: { size?: "sm" | "md" | "lg"; animated?: boolean }) {
  const cfg = {
    sm: { iconSize: 28, titleClass: "text-sm font-bold",  subClass: "text-xs" },
    md: { iconSize: 48, titleClass: "text-2xl font-bold", subClass: "text-sm" },
    lg: { iconSize: 64, titleClass: "text-3xl font-bold", subClass: "text-base" },
  }[size];

  if (animated) {
    return (
      <div className="flex flex-col items-center gap-2">
        <BizCorAnimatedIcon size={cfg.iconSize} />
        <div className="text-center">
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
