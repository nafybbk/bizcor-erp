import { useEffect, useRef, useState, useCallback } from "react";
import { X, Printer, ZoomIn, ZoomOut, MessageCircle, SlidersHorizontal } from "lucide-react";

// ── Settings ──────────────────────────────────────────────────────────────────
interface PrintCfg {
  fontSize: number;     // 10–20 (px)
  headerLevel: number;  // 0 (kala/dark) → 100 (halka/light)
  marginTop: number;    // mm
  marginRight: number;
  marginBottom: number;
  marginLeft: number;
}
const CFG_KEY = "bizcor_print_cfg2";
const DEFAULT_CFG: PrintCfg = { fontSize: 13, headerLevel: 40, marginTop: 10, marginRight: 10, marginBottom: 10, marginLeft: 10 };

function loadCfg(): PrintCfg {
  try { return { ...DEFAULT_CFG, ...JSON.parse(localStorage.getItem(CFG_KEY) || "{}") }; }
  catch { return DEFAULT_CFG; }
}
function saveCfg(c: PrintCfg) {
  try { localStorage.setItem(CFG_KEY, JSON.stringify(c)); } catch {}
}

// ── Colour helpers ────────────────────────────────────────────────────────────
function headerBg(level: number): string {
  const r = Math.round(17  + (level / 100) * 192);
  const g = Math.round(24  + (level / 100) * 189);
  const b = Math.round(39  + (level / 100) * 180);
  return `rgb(${r},${g},${b})`;
}
function headerText(level: number): string {
  return level >= 62 ? "#111827" : "#ffffff";
}

// ── A4 ────────────────────────────────────────────────────────────────────────
const A4_PX = 794;
function calcDefaultZoom(): number {
  const w = typeof window !== "undefined" ? window.innerWidth : 1280;
  if (w < 480) return Math.max(0.28, parseFloat(((w - 24) / A4_PX).toFixed(2)));
  if (w < 768) return 0.62;
  if (w < 1100) return 0.82;
  return 0.9;
}

// ── Build srcdoc using DOM cloning — 100% reliable ───────────────────────────
function buildSrcdoc(printableId: string, zoom: number, cfg: PrintCfg, pdfFileName?: string): string {
  const el = document.getElementById(printableId);
  if (!el) return "<body><p style='color:#999;padding:2rem'>Preview unavailable</p></body>";

  // Deep clone so we can mutate without affecting the page
  const clone = el.cloneNode(true) as HTMLElement;
  clone.id = "preview-root";

  // ── 1. Header background colour ONLY — no forced font/line changes ────────
  const bg  = headerBg(cfg.headerLevel);
  const txt = headerText(cfg.headerLevel);
  clone.querySelectorAll<HTMLElement>(".bg-gray-900").forEach(hdr => {
    // Use setProperty with "important" so it wins over any collected CSS
    hdr.style.setProperty("background-color", bg, "important");
    hdr.style.setProperty("color", txt, "important");
    hdr.style.setProperty("-webkit-print-color-adjust", "exact");
    hdr.style.setProperty("print-color-adjust", "exact");
    // Only direct text children — not coloured sub-elements
    hdr.querySelectorAll<HTMLElement>("th,td,span,div,p").forEach(child => {
      // Only override if child has no explicit non-white/black color class
      const cls = child.className || "";
      const hasColor = /text-(blue|red|green|orange|amber|indigo|purple|pink|yellow)/.test(cls);
      if (!hasColor) child.style.setProperty("color", txt, "important");
    });
  });

  // ── 2. Collect page CSS — skip @media print rules (they interfere) ────────
  let css = "";
  try {
    for (const sheet of Array.from(document.styleSheets)) {
      try {
        for (const rule of Array.from(sheet.cssRules || [])) {
          // Skip @media print — our srcdoc has its own print rules
          if (rule.type === CSSRule.MEDIA_RULE &&
              (rule as CSSMediaRule).conditionText?.includes("print")) continue;
          css += rule.cssText + "\n";
        }
      } catch { /* cross-origin */ }
    }
  } catch {}

  const scaledWidthMm = Math.round(210 * zoom);
  return `<!DOCTYPE html><html><head>
<meta charset="utf-8"/>
${pdfFileName ? `<title>${pdfFileName}</title>` : ""}
<style>
*{box-sizing:border-box;}
/* font-size on html so Tailwind rem classes (text-xs/sm/base…) scale correctly */
html{margin:0;padding:0;background:#6b7280;font-size:${cfg.fontSize}px;}
body{
  margin:0;background:#6b7280;
  padding:20px 12px 40px;
  min-width:calc(${scaledWidthMm}mm + 24px);
}
#preview-root{
  background:white;width:210mm;margin:0 auto;
  box-shadow:0 4px 32px rgba(0,0,0,.35);
  border-radius:4px;overflow:hidden;
  transform:scale(${zoom});transform-origin:top center;
  margin-bottom:calc(-210mm * ${1 - zoom});
}
.no-print{display:none!important;}
.print-only{display:block!important;}
.screen-only{display:none!important;}
@media print{
  html,body{background:white!important;padding:0!important;margin:0!important;font-size:${cfg.fontSize}px!important;}
  #preview-root{
    transform:none!important;width:100%!important;
    box-shadow:none!important;border-radius:0!important;margin:0!important;
  }
  @page{margin:${cfg.marginTop}mm ${cfg.marginRight}mm ${cfg.marginBottom}mm ${cfg.marginLeft}mm;}
}
${css}
</style>
</head><body>${clone.outerHTML}</body></html>`;
}

// ── Props ─────────────────────────────────────────────────────────────────────
interface Props {
  printableId?: string;
  onClose: () => void;
  title?: string;
  initialZoom?: number;
  shareText?: string;
  /** Suggested filename for the browser's "Save as PDF" dialog, e.g. "BizCor-AdeenaHandloom-SI-1285". */
  pdfFileName?: string;
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function PrintPreviewModal({
  printableId = "printable",
  onClose,
  title = "Print Preview",
  initialZoom,
  shareText,
  pdfFileName,
}: Props) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [zoom, setZoom]         = useState(() => initialZoom ?? calcDefaultZoom());
  const [srcdoc, setSrcdoc]     = useState("");
  const [cfg, setCfg]           = useState<PrintCfg>(loadCfg);
  const [showSettings, setShowSettings] = useState(false);

  // Rebuild iframe whenever zoom or cfg changes
  useEffect(() => {
    setSrcdoc(buildSrcdoc(printableId, zoom, cfg, pdfFileName));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [printableId, zoom, cfg.fontSize, cfg.headerLevel, pdfFileName]);

  const updateCfg = (patch: Partial<PrintCfg>) => {
    const next = { ...cfg, ...patch };
    setCfg(next);
    saveCfg(next);
  };

  const iframeWidth = `max(100%, calc(${Math.round(210 * zoom)}mm + 24px))`;

  // Ctrl+Scroll zoom
  useEffect(() => {
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey) return;
      e.preventDefault();
      setZoom(z => parseFloat(Math.min(3, Math.max(0.2, z - e.deltaY * 0.001)).toFixed(2)));
    };
    window.addEventListener("wheel", onWheel, { passive: false });
    return () => window.removeEventListener("wheel", onWheel);
  }, []);

  // Escape to close
  useEffect(() => {
    const fn = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, [onClose]);

  const handlePrint = useCallback(() => {
    const iwin = iframeRef.current?.contentWindow;
    if (iwin) {
      try {
        iwin.focus();
        iwin.print();
      } catch {
        // Fallback: some browsers block iframe.print() — use main window print
        window.print();
      }
    } else {
      window.print();
    }
  }, []);

  const handleWhatsApp = useCallback(() => {
    if (!shareText) return;
    const url = `https://wa.me/?text=${encodeURIComponent(shareText)}`;
    const desktop = (window as any).bizcorDesktop;
    if (desktop?.openInBrowser) desktop.openInBrowser(url);
    else window.open(url, "_blank");
  }, [shareText]);

  const zoomIn  = () => setZoom(z => parseFloat(Math.min(3, z + 0.1).toFixed(1)));
  const zoomOut = () => setZoom(z => parseFloat(Math.max(0.2, z - 0.1).toFixed(1)));

  // ── Preview of header colour for the slider thumb ─────────────────────────
  const previewBg = headerBg(cfg.headerLevel);

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col no-print" style={{ fontFamily: "'Segoe UI', Arial, sans-serif" }}>

      {/* ── Top bar ── */}
      <div className="flex items-center justify-between px-3 sm:px-5 h-12 bg-gray-950 text-white flex-shrink-0 gap-2">

        {/* Left: title */}
        <div className="flex items-center gap-2 min-w-0">
          <Printer className="w-4 h-4 text-blue-400 flex-shrink-0" />
          <span className="text-sm font-semibold truncate hidden sm:block">{title}</span>
        </div>

        {/* Centre: zoom */}
        <div className="flex items-center gap-1 bg-gray-800 rounded-lg px-1 py-0.5 flex-shrink-0">
          <button onClick={zoomOut} className="p-1.5 hover:bg-gray-700 rounded text-gray-300" title="Zoom out"><ZoomOut className="w-4 h-4" /></button>
          <button onClick={() => setZoom(calcDefaultZoom())} className="px-2 py-0.5 text-xs text-gray-200 hover:bg-gray-700 rounded font-mono min-w-[52px] text-center" title="Reset zoom">
            {Math.round(zoom * 100)}%
          </button>
          <button onClick={zoomIn} className="p-1.5 hover:bg-gray-700 rounded text-gray-300" title="Zoom in"><ZoomIn className="w-4 h-4" /></button>
        </div>

        {/* Right: actions */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={() => setShowSettings(s => !s)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-sm font-medium transition-colors ${showSettings ? "bg-blue-600 text-white" : "bg-gray-700 hover:bg-gray-600 text-gray-200"}`}
            title="Print settings"
          >
            <SlidersHorizontal className="w-4 h-4" />
            <span className="hidden sm:inline text-xs">Settings</span>
          </button>

          {shareText && (
            <button onClick={handleWhatsApp} className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 hover:bg-green-500 text-white rounded-lg text-sm font-semibold">
              <MessageCircle className="w-4 h-4" />
              <span className="hidden sm:inline">WhatsApp</span>
            </button>
          )}
          <button onClick={handlePrint} className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-semibold">
            <Printer className="w-4 h-4" />
            <span className="hidden sm:inline">Print</span>
          </button>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-700 rounded text-gray-400 hover:text-white" title="Close (Esc)">
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* ── Settings panel — sliders ── */}
      {showSettings && (
        <div className="bg-gray-900 border-b border-gray-700 px-5 py-4 flex-shrink-0">
          <div className="flex flex-wrap gap-8 items-center">

            {/* Font size slider */}
            <div className="flex items-center gap-3 min-w-[220px]">
              <span className="text-gray-400 text-xs font-semibold uppercase tracking-wider w-20 flex-shrink-0">Font Size</span>
              <span className="text-gray-500 text-xs">A</span>
              <input
                type="range" min={10} max={20} step={0.5}
                value={cfg.fontSize}
                onChange={e => updateCfg({ fontSize: Number(e.target.value) })}
                className="flex-1 accent-blue-500 cursor-pointer"
              />
              <span className="text-white text-sm font-bold">A</span>
              <span className="text-gray-300 text-xs font-mono w-8">{cfg.fontSize}px</span>
            </div>

            {/* Header colour slider */}
            <div className="flex items-center gap-3 min-w-[220px]">
              <span className="text-gray-400 text-xs font-semibold uppercase tracking-wider w-20 flex-shrink-0">Header</span>
              {/* dark swatch */}
              <div className="w-5 h-5 rounded flex-shrink-0" style={{ background: headerBg(0) }} title="Kala" />
              <input
                type="range" min={0} max={100} step={1}
                value={cfg.headerLevel}
                onChange={e => updateCfg({ headerLevel: Number(e.target.value) })}
                className="flex-1 cursor-pointer"
                style={{ accentColor: previewBg }}
              />
              {/* light swatch */}
              <div className="w-5 h-5 rounded border border-gray-600 flex-shrink-0" style={{ background: headerBg(100) }} title="Halka" />
              {/* live preview badge */}
              <div
                className="px-2 py-0.5 rounded text-xs font-bold flex-shrink-0 w-16 text-center"
                style={{ background: previewBg, color: headerText(cfg.headerLevel) }}
              >
                HEADER
              </div>
            </div>

          </div>

          {/* Margin editor — mini A4 visual + sliders */}
          <div className="mt-3 pt-3 border-t border-gray-700">
            <div className="text-gray-400 text-xs font-semibold uppercase tracking-wider mb-2">Print Margins (mm)</div>
            <div className="flex gap-6 items-start flex-wrap">

              {/* Mini A4 visual */}
              <div className="relative flex-shrink-0" style={{ width: 72, height: 96, background: "white", border: "1px solid #555", borderRadius: 2 }}>
                {/* Top line */}
                <div className="absolute left-0 right-0" style={{ top: `${(cfg.marginTop / 30) * 100}%`, borderTop: "1.5px dashed #3b82f6", pointerEvents: "none" }} />
                {/* Bottom line */}
                <div className="absolute left-0 right-0" style={{ bottom: `${(cfg.marginBottom / 30) * 100}%`, borderTop: "1.5px dashed #3b82f6", pointerEvents: "none" }} />
                {/* Left line */}
                <div className="absolute top-0 bottom-0" style={{ left: `${(cfg.marginLeft / 30) * 100}%`, borderLeft: "1.5px dashed #3b82f6", pointerEvents: "none" }} />
                {/* Right line */}
                <div className="absolute top-0 bottom-0" style={{ right: `${(cfg.marginRight / 30) * 100}%`, borderLeft: "1.5px dashed #3b82f6", pointerEvents: "none" }} />
                {/* Center dot */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div style={{ width: 20, height: 20, background: "#f3f4f6", borderRadius: 2, border: "1px solid #ddd" }} />
                </div>
              </div>

              {/* 4 sliders */}
              <div className="flex flex-col gap-2 flex-1 min-w-[200px]">
                {(["marginTop", "marginRight", "marginBottom", "marginLeft"] as const).map(key => {
                  const labels: Record<string, string> = { marginTop: "↑ Top", marginRight: "Right →", marginBottom: "↓ Bottom", marginLeft: "← Left" };
                  return (
                    <div key={key} className="flex items-center gap-2">
                      <span className="text-gray-400 text-xs w-16 flex-shrink-0">{labels[key]}</span>
                      <input
                        type="range" min={0} max={30} step={1}
                        value={cfg[key]}
                        onChange={e => updateCfg({ [key]: Number(e.target.value) })}
                        className="flex-1 accent-blue-500 cursor-pointer"
                      />
                      <span className="text-gray-300 text-xs font-mono w-8 text-right">{cfg[key]}mm</span>
                    </div>
                  );
                })}
              </div>

            </div>
          </div>

          <div className="text-gray-600 text-xs mt-2">Settings apne aap save hoti hain</div>
        </div>
      )}

      {/* ── Preview iframe ── */}
      <div className="flex-1 overflow-auto bg-gray-600">
        {srcdoc ? (
          <iframe
            ref={iframeRef}
            srcDoc={srcdoc}
            title="Invoice Preview"
            style={{ width: iframeWidth, height: "100%", border: "none", minHeight: "100%", display: "block" }}
            sandbox="allow-same-origin allow-scripts allow-modals allow-popups"
          />
        ) : (
          <div className="flex items-center justify-center h-full">
            <span className="text-gray-300 text-sm">Loading…</span>
          </div>
        )}
      </div>
    </div>
  );
}
