export function BizCorIcon({ size = 40, className = "" }: { size?: number; className?: string }) {
  const pad = size * 0.1;
  const r = Math.round(size * 0.22);
  return (
    <div
      className={className}
      style={{
        width: size,
        height: size,
        borderRadius: Math.round(size * 0.28),
        background: "linear-gradient(145deg, #1d4ed8 0%, #4f46e5 60%, #7c3aed 100%)",
        boxShadow: `0 0 ${Math.round(size * 0.4)}px rgba(79,70,229,0.5), inset 0 1px 0 rgba(255,255,255,0.18)`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
      }}
    >
      <svg width={size - pad * 2} height={size - pad * 2} viewBox="0 0 40 40" fill="none">
        <path d="M10 8h12c3.3 0 6 2.7 6 6s-2.7 6-6 6H10V8z" fill="white" />
        <path d="M10 20h13c3.9 0 7 3.1 7 7s-3.1 7-7 7H10V20z" fill="white" />
      </svg>
    </div>
  );
}

export function BizCorLogo({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const cfg = {
    sm: { iconSize: 28, titleClass: "text-sm font-bold", subClass: "text-xs" },
    md: { iconSize: 48, titleClass: "text-2xl font-bold", subClass: "text-sm" },
    lg: { iconSize: 64, titleClass: "text-3xl font-bold", subClass: "text-base" },
  }[size];

  return (
    <div className="flex flex-col items-center gap-3">
      <BizCorIcon size={cfg.iconSize} />
      <div className="text-center">
        <div className={cfg.titleClass + " text-gray-900"}>
          <span>Biz</span>
          <span className="text-indigo-600">Cor</span>
        </div>
        <div className={cfg.subClass + " text-gray-500"}>Indian Business ERP</div>
      </div>
    </div>
  );
}
