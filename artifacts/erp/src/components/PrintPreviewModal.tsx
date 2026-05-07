import { useEffect, useRef, useState, useCallback } from "react";
import { X, Printer, ZoomIn, ZoomOut, MessageCircle } from "lucide-react";

interface Props {
  printableId?: string;
  onClose: () => void;
  title?: string;
  initialZoom?: number;
  shareText?: string;
}

// A4 width in pixels at 96dpi ≈ 794px
const A4_PX = 794;

function calcDefaultZoom(): number {
  const w = typeof window !== "undefined" ? window.innerWidth : 1280;
  if (w < 480) return Math.max(0.28, parseFloat(((w - 24) / A4_PX).toFixed(2)));
  if (w < 768) return 0.62;
  if (w < 1100) return 0.82;
  return 0.9;
}

function buildSrcdoc(printableId: string, zoom: number): string {
  const el = document.getElementById(printableId);
  if (!el) return "<body><p style='color:#999;padding:2rem'>Preview unavailable</p></body>";
  const html = el.outerHTML.replace(/\bid="printable"\b/, 'id="preview-root"');
  let css = "";
  try {
    for (const sheet of Array.from(document.styleSheets)) {
      try {
        for (const rule of Array.from(sheet.cssRules || [])) {
          css += rule.cssText + "\n";
        }
      } catch { /* cross-origin */ }
    }
  } catch {}
  const scaledWidthMm = Math.round(210 * zoom);
  return `<!DOCTYPE html><html><head>
<meta charset="utf-8"/>
<style>
*{box-sizing:border-box;}
html{margin:0;padding:0;background:#6b7280;}
body{
  margin:0;
  background:#6b7280;
  padding:20px 12px 40px;
  min-width:calc(${scaledWidthMm}mm + 24px);
}
#preview-root{
  background:white;
  width:210mm;
  margin:0 auto;
  box-shadow:0 4px 32px rgba(0,0,0,.35);
  border-radius:4px;
  overflow:hidden;
  transform:scale(${zoom});
  transform-origin:top center;
  margin-bottom:calc(-210mm * ${1 - zoom});
}
.no-print{display:none!important;}
.print-only{display:block!important;}
.screen-only{display:none!important;}
@media print{
  html,body{background:white!important;padding:0!important;margin:0!important;}
  #preview-root{
    transform:none!important;
    width:100%!important;
    box-shadow:none!important;
    border-radius:0!important;
    margin:0!important;
  }
}
${css}
</style>
</head><body>${html}</body></html>`;
}

export default function PrintPreviewModal({ printableId = "printable", onClose, title = "Print Preview", initialZoom, shareText }: Props) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [zoom, setZoom] = useState(() => initialZoom ?? calcDefaultZoom());
  const [srcdoc, setSrcdoc] = useState("");

  useEffect(() => {
    setSrcdoc(buildSrcdoc(printableId, zoom));
  }, [printableId, zoom]);

  const iframeWidth = `max(100%, calc(${Math.round(210 * zoom)}mm + 24px))`;

  // Ctrl+Scroll to zoom
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

  // Print directly from the iframe (modal stays open, no new tab)
  const handlePrint = useCallback(() => {
    const iframe = iframeRef.current;
    if (iframe?.contentWindow) {
      iframe.contentWindow.print();
    }
  }, []);

  // WhatsApp share (text summary of invoice)
  const handleWhatsApp = useCallback(() => {
    if (!shareText) return;
    window.open(`https://wa.me/?text=${encodeURIComponent(shareText)}`, "_blank");
  }, [shareText]);

  const zoomIn  = () => setZoom(z => parseFloat(Math.min(3, z + 0.1).toFixed(1)));
  const zoomOut = () => setZoom(z => parseFloat(Math.max(0.2, z - 0.1).toFixed(1)));

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col no-print bg-gray-600" style={{ fontFamily: "'Segoe UI', Arial, sans-serif" }}>

      {/* ── Top bar ── */}
      <div className="flex items-center justify-between px-3 sm:px-5 h-12 bg-gray-950 text-white flex-shrink-0 gap-2">
        {/* Left: title */}
        <div className="flex items-center gap-2 min-w-0">
          <Printer className="w-4 h-4 text-blue-400 flex-shrink-0" />
          <span className="text-sm font-semibold truncate hidden sm:block">{title}</span>
        </div>

        {/* Center: zoom */}
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

        {/* Right: whatsapp + save pdf + print + close */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {shareText && (
            <button
              onClick={handleWhatsApp}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 hover:bg-green-500 active:bg-green-700 text-white rounded-lg text-sm font-semibold transition-colors"
              title="Share on WhatsApp"
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

      {/* ── Full-screen iframe with horizontal scroll support ── */}
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
