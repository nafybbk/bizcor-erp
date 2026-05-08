const CSS = `
@keyframes bc-bounce {
  0%,100% { transform: translateY(0) scale(1); }
  40%      { transform: translateY(-14px) scale(1.04); }
  70%      { transform: translateY(-4px) scale(0.98); }
}
@keyframes bc-shadow {
  0%,100% { transform: scaleX(1); opacity: 0.28; }
  50%      { transform: scaleX(0.48); opacity: 0.1; }
}
@keyframes bc-glow {
  0%,100% { box-shadow: 0 0 18px 4px rgba(79,70,229,0.45), 0 4px 24px rgba(0,0,0,0.35); }
  50%      { box-shadow: 0 0 32px 8px rgba(99,102,241,0.65), 0 8px 32px rgba(0,0,0,0.45); }
}
`;

/* ── Static icon used in sidebar / nav ─────────────────────────── */
export function BizCorIcon({ size = 40, className = "" }: { size?: number; className?: string }) {
  return (
    <img
      src="/bizcor-logo.png"
      alt="BizCor"
      className={className}
      style={{
        width: size,
        height: size,
        borderRadius: Math.round(size * 0.22),
        objectFit: "cover",
        flexShrink: 0,
        boxShadow: `0 0 ${Math.round(size * 0.35)}px rgba(79,70,229,0.45), 0 2px 8px rgba(0,0,0,0.3)`,
      }}
    />
  );
}

/* ── Animated logo (login page, tech login) ─────────────────────── */
export function BizCorCanvasLogo({
  size = 220,
  bounce = true,
}: {
  size?: number;
  bounce?: boolean;
}) {
  return (
    <>
      <style>{CSS}</style>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 0 }}>
        <div style={{ animation: bounce ? "bc-bounce 1.8s cubic-bezier(.36,.07,.19,.97) infinite" : "none", display: "inline-block" }}>
          <img
            src="/bizcor-logo.png"
            alt="BizCor"
            width={size}
            height={size}
            style={{
              borderRadius: Math.round(size * 0.22),
              display: "block",
              objectFit: "cover",
              animation: "bc-glow 2.4s ease-in-out infinite",
            }}
          />
        </div>
        {bounce && (
          <div style={{
            width: size * 0.55,
            height: 7,
            borderRadius: "50%",
            background: "rgba(79,70,229,0.2)",
            marginTop: 2,
            animation: "bc-shadow 1.8s cubic-bezier(.36,.07,.19,.97) infinite",
          }} />
        )}
      </div>
    </>
  );
}

/* ── Business animated logo — shows firm name in rings, fallback ── */
export function BusinessAnimatedLogo({
  name = "Business",
  size = 220,
}: {
  name?: string;
  subtitle?: string;
  size?: number;
  bounce?: boolean;
}) {
  const words = name.trim().toUpperCase().replace(/[^A-Z0-9& ]/g, "").split(/\s+/).filter(Boolean);
  let initials = "";
  if (words.length === 0) initials = "BIZ";
  else if (words.length === 1) initials = words[0].slice(0, 3);
  else initials = words.map(w => w[0]).slice(0, 3).join("");

  const fontSize = Math.max(18, Math.round(size * 0.3));

  return (
    <>
      <style>{CSS}</style>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 0 }}>
        <div style={{ animation: "bc-bounce 1.8s cubic-bezier(.36,.07,.19,.97) infinite", display: "inline-block" }}>
          <div style={{
            width: size, height: size,
            borderRadius: Math.round(size * 0.22),
            background: "linear-gradient(145deg,#1d4ed8 0%,#4f46e5 60%,#7c3aed 100%)",
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "#e0e7ff", fontWeight: 900, fontSize,
            fontFamily: "'Inter','Segoe UI',system-ui,sans-serif",
            animation: "bc-glow 2.4s ease-in-out infinite",
          }}>
            {initials}
          </div>
        </div>
        <div style={{
          width: size * 0.55, height: 7, borderRadius: "50%",
          background: "rgba(79,70,229,0.2)", marginTop: 2,
          animation: "bc-shadow 1.8s cubic-bezier(.36,.07,.19,.97) infinite",
        }} />
      </div>
    </>
  );
}

/* ── Business initials icon — sidebar mini ──────────────────────── */
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

/* ── Logo wrapper (login page + elsewhere) ──────────────────────── */
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
    sm: { iconSize: 48,  canvasSize: 80,  titleClass: "text-sm font-bold",  subClass: "text-xs" },
    md: { iconSize: 72,  canvasSize: 150, titleClass: "text-2xl font-bold", subClass: "text-sm" },
    lg: { iconSize: 96,  canvasSize: 180, titleClass: "text-3xl font-bold", subClass: "text-base" },
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
