const CSS = `
@keyframes bc-bounce {
  0%,100% { transform: translateY(0px) scale(1); }
  40%      { transform: translateY(-14px) scale(1.05); }
  60%      { transform: translateY(-16px) scale(1.03); }
  80%      { transform: translateY(-4px) scale(0.98); }
}
@keyframes bc-shadow {
  0%,100% { transform: scaleX(1); opacity: 0.3; }
  50%      { transform: scaleX(0.5); opacity: 0.1; }
}
@keyframes bc-r1 { from{transform:rotate(0deg)}   to{transform:rotate(360deg)} }
@keyframes bc-r2 { from{transform:rotate(0deg)}   to{transform:rotate(-360deg)} }
@keyframes bc-r3 { from{transform:rotate(120deg)} to{transform:rotate(480deg)} }
@keyframes bc-r4 { from{transform:rotate(240deg)} to{transform:rotate(-120deg)} }
@keyframes bc-r5 { from{transform:rotate(60deg)}  to{transform:rotate(420deg)} }
`;

/* Rings: innermost to outermost, solid, NO gap */
const RINGS = [
  { r: 38,  w: 7, color: "#6366f1", anim: "bc-r1", dur: 3.2  },
  { r: 47,  w: 7, color: "#8b5cf6", anim: "bc-r2", dur: 4.1  },
  { r: 56,  w: 7, color: "#3b82f6", anim: "bc-r3", dur: 5.0  },
  { r: 65,  w: 7, color: "#06b6d4", anim: "bc-r4", dur: 3.7  },
  { r: 74,  w: 7, color: "#ec4899", anim: "bc-r5", dur: 4.8  },
];

/* Each ring is a 270° arc — rotates to look dynamic */
function Arc({ r, w, color, anim, dur }: typeof RINGS[0]) {
  const size = (r + w) * 2 + 2;
  const c = size / 2;
  const circumference = 2 * Math.PI * r;
  /* 270° of the circle filled, 90° gap */
  const dash = (circumference * 0.82).toFixed(1);
  const gap  = (circumference * 0.18).toFixed(1);
  return (
    <div style={{
      position: "absolute",
      width: size, height: size,
      top: "50%", left: "50%",
      marginTop: -size / 2, marginLeft: -size / 2,
      animation: `${anim} ${dur}s linear infinite`,
    }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle
          cx={c} cy={c} r={r}
          fill="none"
          stroke={color}
          strokeWidth={w}
          strokeDasharray={`${dash} ${gap}`}
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
}

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

/* Animated icon used on login page */
export function BizCorAnimatedIcon({ size = 62 }: { size?: number }) {
  const outerR = RINGS[RINGS.length - 1];
  const canvasSize = (outerR.r + outerR.w) * 2 + 4;

  return (
    <>
      <style>{CSS}</style>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
        <div style={{
          position: "relative",
          width: canvasSize, height: canvasSize,
          animation: "bc-bounce 1.6s cubic-bezier(.36,.07,.19,.97) infinite",
        }}>
          {/* Rings */}
          {RINGS.map((ring, i) => <Arc key={i} {...ring} />)}

          {/* Center ball */}
          <div style={{
            position: "absolute",
            top: "50%", left: "50%",
            width: size, height: size,
            marginTop: -size / 2, marginLeft: -size / 2,
            borderRadius: Math.round(size * 0.26),
            background: "linear-gradient(145deg,#1e40af 0%,#4f46e5 55%,#7c3aed 100%)",
            boxShadow: "0 0 28px 8px rgba(99,102,241,0.6), inset 0 1px 0 rgba(255,255,255,0.22)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            {/* Redesigned B */}
            <svg width={size * 0.62} height={size * 0.62} viewBox="0 0 36 36" fill="none">
              {/* Bold geometric B */}
              <rect x="7" y="5" width="6" height="26" rx="2" fill="white"/>
              <path d="M13 5h8a7 7 0 0 1 0 14H13V5z" fill="white" fillOpacity="0.95"/>
              <path d="M13 19h9a7 7 0 0 1 0 12H13V19z" fill="white"/>
            </svg>
          </div>
        </div>

        {/* Ground shadow */}
        <div style={{
          width: size * 0.65, height: 7, borderRadius: "50%",
          background: "rgba(99,102,241,0.22)",
          marginTop: 2,
          animation: "bc-shadow 1.6s cubic-bezier(.36,.07,.19,.97) infinite",
        }} />
      </div>
    </>
  );
}

export function BizCorLogo({
  size = "md",
  animated = false,
}: {
  size?: "sm" | "md" | "lg";
  animated?: boolean;
}) {
  const cfg = {
    sm: { iconSize: 28, titleClass: "text-sm font-bold",  subClass: "text-xs",   animSize: 48 },
    md: { iconSize: 48, titleClass: "text-2xl font-bold", subClass: "text-sm",   animSize: 60 },
    lg: { iconSize: 64, titleClass: "text-3xl font-bold", subClass: "text-base", animSize: 72 },
  }[size];

  if (animated) {
    return (
      <div className="flex flex-col items-center gap-3">
        <BizCorAnimatedIcon size={cfg.animSize} />
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
