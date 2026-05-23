import { useEffect, useRef, useState, useCallback } from "react";
import { X, Printer, ZoomIn, ZoomOut, MessageCircle, Settings, ChevronDown } from "lucide-react";

// ── Print settings (stored in localStorage) ──────────────────────────────────
interface PrintCfg {
  headerStyle: "dark" | "grey" | "light";
  fontSize: "small" | "medium" | "large";
}
const CFG_KEY = "bizcor_print_cfg";
const DEFAULT_CFG: PrintCfg = { headerStyle: "grey", fontSize: "medium" };

function loadCfg(): PrintCfg {
  try { return { ...DEFAULT_CFG, ...JSON.parse(localStorage.getItem(CFG_KEY) || "{}") }; }
  catch { return DEFAULT_CFG; }
}
function saveCfg(c: PrintCfg) {
  try { localStorage.setItem(CFG_KEY, JSON.stringify(c)); } catch {}
}

// ── Header colour map ─────────────────────────────────────────────────────────
const HEADER_BG: Record<PrintCfg["headerStyle"], string> = {
  dark:  "#111827",   // original black
  grey:  "#4b5563",   // medium grey  (still white text)
  light: "#d1d5db",   // light grey   (dark text)
};
const HEADER_TEXT: Record<PrintCfg["headerStyle"], string> = {
  dark:  "#ffffff",
  grey:  "#ffffff",
  light: "#111827",
};

// ── Font size map ─────────────────────────────────────────────────────────────
const FONT_SIZE: Record<PrintCfg["fontSize"], string> = {
  small:  "11.5px",
  medium: "13px",
  large:  "15px",
};

// ── A4 const ──────────────────────────────────────────────────────────────────
const A4_PX = 794;

function calcDefaultZoom(): number {
  const w = typeof window !== "undefined" ? window.innerWidth : 1280;
  if (w < 480) return Math.max(0.28, parseFloat(((w - 24) / A4_PX).toFixed(2)));
  if (w < 768) return 0.62;
  if (w < 1100) return 0.82;
  return 0.9;
}

// ── Collect all page CSS ──────────────────────────────────────────────────────
function collectCSS(): string {
  let css = "";
  try {
    for (const sheet of Array.from(document.styleSheets)) {
      try {
        for (const rule of Array.from(sheet.cssRules || [])) css += rule.cssText + "\n";
      } catch { /* cross-origin */ }
    }
  } catch {}
  return css;
}

// ── Build override CSS from settings ─────────────────────────────────────────
function buildOverrideCSS(cfg: PrintCfg): string {
  const fs   = FONT_SIZE[cfg.fontSize];
  const hBg  = HEADER_BG[cfg.headerStyle];
  const hTxt = HEADER_TEXT[cfg.headerStyle];

  // Target the three bg-gray-900 elements in VoucherView:
  //   1. Table header <tr>
  //   2. Document title badge ("TAX INVOICE")
  //   3. Bottom "THANK YOU" strip
  const hRule = `
    #preview-root .bg-gray-900 {
      background-color: ${hBg} !important;
      color: ${hTxt} !important;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    #preview-root .bg-gray-900 * { color: ${hTxt} !important; }
  `;

  const fsRule = `
    #preview-root,
    #preview-root table,
    #preview-root td,
    #preview-root th,
    #preview-root div,
    #preview-root span,
    #preview-root p { font-size: ${fs} !important; }
    /* keep very-small helper labels a little smaller */
    #preview-root .text-xs { font-size: calc(${fs} - 1.5px) !important; }
  `;

  const printRule = `
    @media print {
      #preview-root .bg-gray-900 {
        background-color: ${hBg} !important;
        color: ${hTxt} !important;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
      #preview-root .bg-gray-900 * { color: ${hTxt} !important; }
    }
  `;

  return `${hRule}\n${fsRule}\n${printRule}`;
}

// ── Build full iframe srcdoc ──────────────────────────────────────────────────
function buildSrcdoc(printableId: string, zoom: number, cfg: PrintCfg): string {
  const el = document.getElementById(printableId);
  if (!el) return "<body><p style='color:#999;padding:2rem'>Preview unavailable</p></body>";
  const html = el.outerHTML.replace(/\bid="printable"\b/, 'id="preview-root"');
  const css = collectCSS();
  const scaledWidthMm = Math.round(210 * zoom);
  return `<!DOCTYPE html><html><head>
<meta charset="utf-8"/>
<style>
*{box-sizing:border-box;}
html{margin:0;padding:0;background:#6b7280;}
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
  html,body{background:white!important;padding:0!important;margin:0!important;}
  #preview-root{
    transform:none!important;width:100%!important;
    box-shadow:none!important;border-radius:0!important;margin:0!important;
  }
}
/* Page stylesheets */
${css}
/* User print settings override (applied LAST — highest priority) */
${buildOverrideCSS(cfg)}
</style>
</head><body>${html}</body></html>`;
}

// ── Props ─────────────────────────────────────────────────────────────────────
interface Props {
  printableId?: string;
  onClose: () => void;
  title?: string;
  initialZoom?: number;
  shareText?: string;
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function PrintPreviewModal({
  printableId = "printable",
  onClose,
  title = "Print Preview",
  initialZoom,
  shareText,
}: Props) {
  const iframeRef    = useRef<HTMLIFrameElement>(null);
  const [zoom, setZoom] = useState(() => initialZoom ?? calcDefaultZoom());
  const [srcdoc, setSrcdoc] = useState("");
  const [cfg, setCfgState]  = useState<PrintCfg>(loadCfg);
  const [showSettings, setShowSettings] = useState(false);

  // helper: update one key
  const updateCfg = <K extends keyof PrintCfg>(key: K, val: PrintCfg[K]) => {
    const next = { ...cfg, [key]: val };
    setCfgState(next);
    saveCfg(next);
  };

  // rebuild iframe whenever zoom or cfg changes
  useEffect(() => {
    setSrcdoc(buildSrcdoc(printableId, zoom, cfg));
  }, [printableId, zoom, cfg]);

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
    iframeRef.current?.contentWindow?.print();
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

  // ── Header style button helper ─────────────────────────────────────────────
  const HeaderBtn = ({ value, label, preview }: { value: PrintCfg["headerStyle"]; label: string; preview: string }) => (
    <button
      onClick={() => updateCfg("headerStyle", value)}
      className={`flex flex-col items-center gap-1.5 px-3 py-2 rounded-lg border-2 text-xs font-medium transition-all ${
        cfg.headerStyle === value
          ? "border-blue-500 bg-blue-50 text-blue-700"
          : "border-gray-200 bg-white text-gray-600 hover:border-gray-300"
      }`}
    >
      <div
        className="w-16 h-5 rounded text-white flex items-center justify-center text-[9px] font-bold"
        style={{ background: HEADER_BG[value], color: HEADER_TEXT[value] }}
      >
        {preview}
      </div>
      {label}
    </button>
  );

  // ── Font size button helper ────────────────────────────────────────────────
  const FontBtn = ({ value, label, textSize }: { value: PrintCfg["fontSize"]; label: string; textSize: string }) => (
    <button
      onClick={() => updateCfg("fontSize", value)}
      className={`flex flex-col items-center gap-1 px-3 py-2 rounded-lg border-2 text-xs font-medium transition-all ${
        cfg.fontSize === value
          ? "border-blue-500 bg-blue-50 text-blue-700"
          : "border-gray-200 bg-white text-gray-600 hover:border-gray-300"
      }`}
    >
      <span style={{ fontSize: textSize, lineHeight: 1 }}>A</span>
      {label}
    </button>
  );

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col no-print bg-gray-600" style={{ fontFamily: "'Segoe UI', Arial, sans-serif" }}>

      {/* ── Top bar ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-3 sm:px-5 h-12 bg-gray-950 text-white flex-shrink-0 gap-2">

        {/* Left: title */}
        <div className="flex items-center gap-2 min-w-0">
          <Printer className="w-4 h-4 text-blue-400 flex-shrink-0" />
          <span className="text-sm font-semibold truncate hidden sm:block">{title}</span>
        </div>

        {/* Centre: zoom */}
        <div className="flex items-center gap-1 bg-gray-800 rounded-lg px-1 py-0.5 flex-shrink-0">
          <button onClick={zoomOut} className="p-1.5 hover:bg-gray-700 rounded text-gray-300 active:bg-gray-600" title="Zoom out (-)">
            <ZoomOut className="w-4 h-4" />
          </button>
          <button
            onClick={() => setZoom(calcDefaultZoom())}
            className="px-2 py-0.5 text-xs text-gray-200 hover:bg-gray-700 rounded font-mono min-w-[52px] text-center"
            title="Tap to reset zoom"
          >
            {Math.round(zoom * 100)}%
          </button>
          <button onClick={zoomIn} className="p-1.5 hover:bg-gray-700 rounded text-gray-300 active:bg-gray-600" title="Zoom in (+)">
            <ZoomIn className="w-4 h-4" />
          </button>
        </div>

        {/* Right: actions */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Settings toggle */}
          <button
            onClick={() => setShowSettings(s => !s)}
            className={`flex items-center gap-1 px-2 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              showSettings
                ? "bg-blue-600 text-white"
                : "bg-gray-700 hover:bg-gray-600 text-gray-200"
            }`}
            title="Print settings"
          >
            <Settings className="w-4 h-4" />
            <ChevronDown className={`w-3 h-3 transition-transform ${showSettings ? "rotate-180" : ""}`} />
          </button>

          {shareText && (
            <button
              onClick={handleWhatsApp}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 hover:bg-green-500 active:bg-green-700 text-white rounded-lg text-sm font-semibold transition-colors"
            >
              <MessageCircle className="w-4 h-4" />
              <span className="hidden sm:inline">WhatsApp</span>
            </button>
          )}
          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white rounded-lg text-sm font-semibold transition-colors"
          >
            <Printer className="w-4 h-4" />
            <span className="hidden sm:inline">Print</span>
          </button>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-700 rounded text-gray-400 hover:text-white" title="Close (Esc)">
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* ── Settings panel (slides in below toolbar) ─────────────────────── */}
      {showSettings && (
        <div className="bg-gray-900 border-b border-gray-700 px-5 py-3 flex-shrink-0">
          <div className="flex flex-wrap gap-6 items-start">

            {/* Header colour */}
            <div>
              <div className="text-xs text-gray-400 font-semibold uppercase tracking-wider mb-2">
                Header / Table Color
              </div>
              <div className="flex gap-2">
                <HeaderBtn value="dark"  label="Kala"      preview="INVOICE" />
                <HeaderBtn value="grey"  label="Grey"      preview="INVOICE" />
                <HeaderBtn value="light" label="Halka"     preview="INVOICE" />
              </div>
            </div>

            {/* Font size */}
            <div>
              <div className="text-xs text-gray-400 font-semibold uppercase tracking-wider mb-2">
                Font Size
              </div>
              <div className="flex gap-2">
                <FontBtn value="small"  label="Chhota"  textSize="11px" />
                <FontBtn value="medium" label="Medium"  textSize="14px" />
                <FontBtn value="large"  label="Bada"    textSize="17px" />
              </div>
            </div>

            <div className="text-xs text-gray-500 self-end pb-1">
              Settings automatically saved for all future prints.
            </div>
          </div>
        </div>
      )}

      {/* ── Preview iframe ───────────────────────────────────────────────── */}
      <div className="flex-1 overflow-auto bg-gray-600">
        {srcdoc ? (
          <iframe
            ref={iframeRef}
            srcDoc={srcdoc}
            title="Invoice Preview"
            style={{ width: iframeWidth, height: "100%", border: "none", minHeight: "100%", display: "block" }}
            sandbox="allow-same-origin allow-scripts allow-modals"
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
