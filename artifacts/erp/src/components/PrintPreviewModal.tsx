import { useEffect, useRef, useState, useCallback } from "react";
import { X, Printer, ZoomIn, ZoomOut } from "lucide-react";

interface Props {
  printableId?: string;
  onClose: () => void;
  title?: string;
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
  return `<!DOCTYPE html><html><head>
<meta charset="utf-8"/>
<style>
*{box-sizing:border-box;}
html,body{margin:0;padding:0;background:#6b7280;}
body{padding:28px 20px 40px;}
#preview-root{
  background:white;
  width:210mm;
  margin:0 auto;
  box-shadow:0 4px 32px rgba(0,0,0,.35);
  border-radius:4px;
  overflow:hidden;
  transform:scale(${zoom});
  transform-origin:top center;
}
.no-print{display:none!important;}
.print-only{display:block!important;}
.screen-only{display:none!important;}
${css}
</style>
</head><body>${html}</body></html>`;
}

export default function PrintPreviewModal({ printableId = "printable", onClose, title = "Print Preview" }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const isDragging = useRef(false);

  const [leftPct, setLeftPct] = useState(() => {
    const saved = localStorage.getItem("print_divider_pct");
    return saved ? Number(saved) : 68;
  });
  const [zoom, setZoom] = useState(1);
  const [srcdoc, setSrcdoc] = useState("");

  // Build srcdoc with current zoom on zoom change
  useEffect(() => {
    setSrcdoc(buildSrcdoc(printableId, zoom));
  }, [printableId, zoom]);

  // Ctrl+Scroll to zoom (in the preview pane)
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey) return;
      e.preventDefault();
      setZoom(z => parseFloat(Math.min(2.5, Math.max(0.3, z - e.deltaY * 0.001)).toFixed(2)));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  // Escape key to close
  useEffect(() => {
    const fn = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, [onClose]);

  // Drag divider
  const onDividerMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isDragging.current = true;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    if (iframeRef.current) iframeRef.current.style.pointerEvents = "none";

    const onMove = (ev: MouseEvent) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const pct = Math.min(88, Math.max(25, ((ev.clientX - rect.left) / rect.width) * 100));
      setLeftPct(pct);
    };
    const onUp = () => {
      isDragging.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      if (iframeRef.current) iframeRef.current.style.pointerEvents = "";
      setLeftPct(prev => {
        localStorage.setItem("print_divider_pct", String(Math.round(prev)));
        return prev;
      });
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }, []);

  // Print: close modal first so @media print rules apply cleanly to the main page
  const handlePrint = useCallback(() => {
    onClose();
    requestAnimationFrame(() => {
      requestAnimationFrame(() => window.print());
    });
  }, [onClose]);

  const zoomIn = () => setZoom(z => parseFloat(Math.min(2.5, z + 0.1).toFixed(1)));
  const zoomOut = () => setZoom(z => parseFloat(Math.max(0.3, z - 0.1).toFixed(1)));

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col no-print" style={{ fontFamily: "'Segoe UI', Arial, sans-serif" }}>
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 h-11 bg-gray-950 text-white flex-shrink-0">
        <div className="flex items-center gap-3">
          <Printer className="w-4 h-4 text-blue-400" />
          <span className="font-semibold text-sm">{title}</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 bg-gray-800 rounded-lg px-1 py-0.5">
            <button onClick={zoomOut} className="p-1 hover:bg-gray-700 rounded text-gray-300" title="Zoom out">
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <button onClick={() => setZoom(1)} className="px-2 py-0.5 text-xs text-gray-200 hover:bg-gray-700 rounded font-mono min-w-[46px] text-center">
              {Math.round(zoom * 100)}%
            </button>
            <button onClick={zoomIn} className="p-1 hover:bg-gray-700 rounded text-gray-300" title="Zoom in">
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
          </div>
          <span className="text-xs text-gray-500 hidden lg:block">Ctrl+Scroll = Zoom · Esc = Close</span>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-700 rounded text-gray-400 hover:text-white" title="Close (Esc)">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Split pane */}
      <div ref={containerRef} className="flex flex-1 min-h-0 overflow-hidden">

        {/* LEFT: iframe preview */}
        <div className="overflow-auto flex-shrink-0 bg-gray-500" style={{ width: `${leftPct}%` }}>
          {srcdoc ? (
            <iframe
              ref={iframeRef}
              srcDoc={srcdoc}
              title="Invoice Preview"
              style={{ width: "100%", height: "100%", border: "none", minHeight: "100%" }}
              sandbox="allow-same-origin"
            />
          ) : (
            <div className="flex items-center justify-center h-full">
              <span className="text-gray-300 text-sm">Loading…</span>
            </div>
          )}
        </div>

        {/* DIVIDER — drag handle */}
        <div
          onMouseDown={onDividerMouseDown}
          className="w-2.5 flex-shrink-0 bg-gray-700 hover:bg-blue-500 cursor-col-resize transition-colors flex items-center justify-center relative group"
          title="Drag to resize"
        >
          <div className="absolute inset-y-0 -left-1.5 -right-1.5 cursor-col-resize" onMouseDown={onDividerMouseDown} />
          <div className="flex flex-col gap-1 pointer-events-none">
            <div className="w-0.5 h-5 bg-gray-500 group-hover:bg-blue-300 rounded-full transition-colors" />
            <div className="w-0.5 h-5 bg-gray-500 group-hover:bg-blue-300 rounded-full transition-colors" />
          </div>
        </div>

        {/* RIGHT: Settings */}
        <div className="flex-1 bg-white flex flex-col overflow-hidden min-w-0">
          <div className="flex-1 overflow-y-auto p-5 space-y-5">
            <h2 className="text-sm font-bold text-gray-800 border-b pb-3 flex items-center gap-2">
              <Printer className="w-4 h-4 text-gray-400" /> Print Settings
            </h2>

            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Paper Size</label>
              <select className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option>A4 (210 × 297 mm)</option>
                <option>A5 (148 × 210 mm)</option>
                <option>Letter (8.5 × 11 in)</option>
                <option>Legal (8.5 × 14 in)</option>
              </select>
              <p className="text-xs text-gray-400 mt-1">Confirm size in browser print dialog</p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Orientation</label>
              <div className="flex gap-2">
                <button className="flex-1 py-2 text-sm rounded-lg border-2 border-blue-500 bg-blue-50 text-blue-700 font-semibold">Portrait</button>
                <button className="flex-1 py-2 text-sm rounded-lg border border-gray-200 text-gray-500 hover:border-gray-400 transition-colors">Landscape</button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Preview Zoom</label>
              <div className="flex items-center gap-3">
                <input
                  type="range" min="30" max="150" step="5"
                  value={Math.round(zoom * 100)}
                  onChange={e => setZoom(Number(e.target.value) / 100)}
                  className="flex-1 accent-blue-600"
                />
                <span className="text-sm font-mono text-gray-700 w-12 text-right">{Math.round(zoom * 100)}%</span>
              </div>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3.5 text-xs text-amber-800 space-y-1.5">
              <div className="font-semibold text-amber-900">Printer Tips</div>
              <div>• Browser print dialog mein "Save as PDF" select karke PDF banao</div>
              <div>• "Margins" → "None" ya "Minimum" set karo clean print ke liye</div>
              <div>• "Headers and footers" band karo agar URL nahi chahiye</div>
            </div>

            <div className="text-xs text-gray-400 bg-gray-50 rounded-lg p-3">
              ← Beech ki bar ko drag karo preview area resize karne ke liye. Position save hoti hai.
            </div>
          </div>

          {/* Buttons */}
          <div className="p-4 border-t border-gray-100 space-y-2 flex-shrink-0">
            <button
              onClick={handlePrint}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-bold transition-colors"
            >
              <Printer className="w-4 h-4" />
              Print / Save as PDF
            </button>
            <button
              onClick={onClose}
              className="w-full px-4 py-2.5 border border-gray-200 text-gray-600 rounded-xl text-sm hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
