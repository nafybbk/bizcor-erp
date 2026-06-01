import { useRef, useCallback, useEffect } from "react";
import {
  Type, Tag, Calculator, Image, Minus, Square, Table, Grid2X2,
  GripVertical,
} from "lucide-react";
import { MM_TO_PX, getPaperDimensions } from "@/lib/reportEngine/paperSizes";
import type { TemplateElement, PaperSize, Orientation } from "@/lib/reportEngine/types";
import type { DesignerBandsState, BandKey } from "@/pages/report-templates/ReportDesigner";

// ─── Types ────────────────────────────────────────────────────────────────────
type DragState =
  | {
      type: 'move';
      bandKey: BandKey;
      elementId: string;
      startPageX: number;
      startPageY: number;
      startElemX: number;
      startElemY: number;
    }
  | {
      type: 'resize-band';
      bandKey: BandKey;
      startPageY: number;
      startHeight: number;
    }
  | {
      type: 'resize-el';
      bandKey: BandKey;
      elementId: string;
      startPageX: number;
      startPageY: number;
      startW: number;
      startH: number;
    };

interface Props {
  bands: DesignerBandsState;
  paperSize: PaperSize;
  orientation: Orientation;
  margin: { top: number; right: number; bottom: number; left: number };
  zoom: number;
  selectedBandKey: BandKey | null;
  selectedElementId: string | null;
  mode: 'select' | 'add';
  addingType: TemplateElement['type'] | null;
  onSelectElement: (bandKey: BandKey, elementId: string) => void;
  onSelectBand: (bandKey: BandKey) => void;
  onMoveElement: (bandKey: BandKey, elementId: string, x: number, y: number) => void;
  onResizeElement: (bandKey: BandKey, elementId: string, w: number, h: number) => void;
  onResizeBand: (bandKey: BandKey, height: number) => void;
  onPlaceElement: (bandKey: BandKey, x: number, y: number) => void;
  onDeselectAll: () => void;
}

const BAND_ORDER: BandKey[] = ['pageHeader', 'documentHeader', 'detail', 'documentFooter', 'pageFooter'];
const BAND_LABELS: Record<BandKey, string> = {
  pageHeader: 'Page Header',
  documentHeader: 'Document Header',
  detail: 'Detail (Items)',
  documentFooter: 'Document Footer',
  pageFooter: 'Page Footer',
};
const BAND_COLORS: Record<BandKey, string> = {
  pageHeader: '#1e40af',
  documentHeader: '#065f46',
  detail: '#7c2d12',
  documentFooter: '#4c1d95',
  pageFooter: '#1e3a5f',
};

function elementIcon(type: TemplateElement['type']) {
  switch (type) {
    case 'text':    return <Type className="w-3 h-3" />;
    case 'field':   return <Tag className="w-3 h-3" />;
    case 'formula': return <Calculator className="w-3 h-3" />;
    case 'image':   return <Image className="w-3 h-3" />;
    case 'line':    return <Minus className="w-3 h-3" />;
    case 'box':     return <Square className="w-3 h-3" />;
    case 'table':   return <Table className="w-3 h-3" />;
    case 'qrcode':  return <Grid2X2 className="w-3 h-3" />;
    default:        return null;
  }
}

function elementLabel(el: TemplateElement): string {
  switch (el.type) {
    case 'text':    return el.content.slice(0, 20) || 'Text';
    case 'field':   return el.field;
    case 'formula': return el.formula.slice(0, 20) || 'Formula';
    case 'image':   return el.source;
    case 'line':    return el.direction === 'horizontal' ? '— Line' : '| Line';
    case 'box':     return 'Box';
    case 'table':   return `Table (${el.columns.length} cols)`;
    case 'qrcode':  return 'QR Code';
    default:        return (el as TemplateElement).type;
  }
}

export default function DesignerCanvas({
  bands, paperSize, orientation, margin, zoom,
  selectedBandKey, selectedElementId, mode, addingType,
  onSelectElement, onSelectBand, onMoveElement, onResizeElement,
  onResizeBand, onPlaceElement, onDeselectAll,
}: Props) {
  const dragState = useRef<DragState | null>(null);
  const paper = getPaperDimensions(paperSize, orientation);
  const paperW = paper.width * MM_TO_PX * zoom;
  const contentW = (paper.width - margin.left - margin.right) * MM_TO_PX * zoom;

  // ─── Global drag handlers ─────────────────────────────────────────────────
  const onMouseMove = useCallback((e: MouseEvent) => {
    const d = dragState.current;
    if (!d) return;
    const dxPx = e.pageX - (d as any).startPageX;
    const dyPx = e.pageY - (d as any).startPageY;
    const dxMm = dxPx / (MM_TO_PX * zoom);
    const dyMm = dyPx / (MM_TO_PX * zoom);

    if (d.type === 'move') {
      onMoveElement(d.bandKey, d.elementId,
        Math.max(0, +(d.startElemX + dxMm).toFixed(1)),
        Math.max(0, +(d.startElemY + dyMm).toFixed(1)),
      );
    } else if (d.type === 'resize-band') {
      onResizeBand(d.bandKey, Math.max(8, +(d.startHeight + dyMm).toFixed(1)));
    } else if (d.type === 'resize-el') {
      onResizeElement(d.bandKey, d.elementId,
        Math.max(5, +(d.startW + dxMm).toFixed(1)),
        Math.max(3, +(d.startH + dyMm).toFixed(1)),
      );
    }
  }, [zoom, onMoveElement, onResizeBand, onResizeElement]);

  const onMouseUp = useCallback(() => { dragState.current = null; }, []);

  useEffect(() => {
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [onMouseMove, onMouseUp]);

  // ─── Band click for placement ─────────────────────────────────────────────
  function handleBandClick(e: React.MouseEvent, bandKey: BandKey, bandEl: HTMLDivElement) {
    if (mode !== 'add' || !addingType) return;
    const rect = bandEl.getBoundingClientRect();
    const xMm = Math.max(0, (e.clientX - rect.left) / (MM_TO_PX * zoom));
    const yMm = Math.max(0, (e.clientY - rect.top) / (MM_TO_PX * zoom));
    onPlaceElement(bandKey, +xMm.toFixed(1), +yMm.toFixed(1));
  }

  return (
    <div
      className="flex-1 overflow-auto bg-gray-200"
      style={{ cursor: mode === 'add' ? 'crosshair' : 'default' }}
      onClick={e => { if (e.target === e.currentTarget) onDeselectAll(); }}
    >
      <div className="flex flex-col items-center py-8 gap-0">
        {/* Paper */}
        <div
          className="shadow-2xl bg-white relative"
          style={{ width: paperW, minHeight: 100 }}
          onClick={e => { if (e.target === e.currentTarget) onDeselectAll(); }}
        >
          {/* Margin guides */}
          <div
            className="absolute border border-dashed border-blue-200 pointer-events-none"
            style={{
              top: margin.top * MM_TO_PX * zoom,
              left: margin.left * MM_TO_PX * zoom,
              right: margin.right * MM_TO_PX * zoom,
              bottom: margin.bottom * MM_TO_PX * zoom,
            }}
          />

          {BAND_ORDER.map(bandKey => {
            const band = bands[bandKey];
            const height = bandKey === 'detail'
              ? bands.detail.designerHeight
              : (band as any).height;
            const heightPx = height * MM_TO_PX * zoom;
            const isSelected = selectedBandKey === bandKey && !selectedElementId;
            const color = BAND_COLORS[bandKey];

            return (
              <BandContainer
                key={bandKey}
                bandKey={bandKey}
                label={BAND_LABELS[bandKey]}
                color={color}
                heightPx={heightPx}
                contentWidthPx={contentW}
                marginLeftPx={margin.left * MM_TO_PX * zoom}
                elements={band.elements}
                zoom={zoom}
                selectedElementId={selectedElementId}
                isBandSelected={isSelected}
                mode={mode}
                isDetail={bandKey === 'detail'}
                onBandHeaderClick={() => onSelectBand(bandKey)}
                onBandContentClick={handleBandClick}
                onElementMouseDown={(el, e) => {
                  e.stopPropagation();
                  onSelectElement(bandKey, el.id);
                  dragState.current = {
                    type: 'move',
                    bandKey,
                    elementId: el.id,
                    startPageX: e.pageX,
                    startPageY: e.pageY,
                    startElemX: el.x,
                    startElemY: el.y,
                  };
                }}
                onResizeHandleMouseDown={(el, e) => {
                  e.stopPropagation();
                  onSelectElement(bandKey, el.id);
                  dragState.current = {
                    type: 'resize-el',
                    bandKey,
                    elementId: el.id,
                    startPageX: e.pageX,
                    startPageY: e.pageY,
                    startW: el.width,
                    startH: el.height,
                  };
                }}
                onResizeBandMouseDown={(e) => {
                  e.stopPropagation();
                  dragState.current = {
                    type: 'resize-band',
                    bandKey,
                    startPageY: e.pageY,
                    startHeight: height,
                  };
                }}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Band Container ───────────────────────────────────────────────────────────
interface BandContainerProps {
  bandKey: BandKey;
  label: string;
  color: string;
  heightPx: number;
  contentWidthPx: number;
  marginLeftPx: number;
  elements: TemplateElement[];
  zoom: number;
  selectedElementId: string | null;
  isBandSelected: boolean;
  mode: 'select' | 'add';
  isDetail: boolean;
  onBandHeaderClick: () => void;
  onBandContentClick: (e: React.MouseEvent, bandKey: BandKey, el: HTMLDivElement) => void;
  onElementMouseDown: (el: TemplateElement, e: React.MouseEvent) => void;
  onResizeHandleMouseDown: (el: TemplateElement, e: React.MouseEvent) => void;
  onResizeBandMouseDown: (e: React.MouseEvent) => void;
}

function BandContainer({
  bandKey, label, color, heightPx, contentWidthPx, marginLeftPx,
  elements, zoom, selectedElementId, isBandSelected, mode, isDetail,
  onBandHeaderClick, onBandContentClick, onElementMouseDown,
  onResizeHandleMouseDown, onResizeBandMouseDown,
}: BandContainerProps) {
  const contentRef = useRef<HTMLDivElement>(null);

  return (
    <div className="relative">
      {/* Band header bar */}
      <div
        onClick={onBandHeaderClick}
        className="flex items-center gap-2 px-3 py-0.5 text-white text-[10px] font-medium select-none cursor-pointer"
        style={{ backgroundColor: color, opacity: isBandSelected ? 1 : 0.85 }}
      >
        <GripVertical className="w-3 h-3 opacity-60" />
        {label}
        {isDetail && (
          <span className="ml-1 text-[9px] opacity-70">(height in designer only)</span>
        )}
      </div>

      {/* Band content area */}
      <div
        ref={contentRef}
        className="relative border-b border-gray-200"
        style={{
          height: heightPx,
          cursor: mode === 'add' ? 'crosshair' : 'default',
          outline: isBandSelected ? `2px solid ${color}` : 'none',
        }}
        onClick={e => {
          if (contentRef.current) onBandContentClick(e, bandKey, contentRef.current);
        }}
      >
        {/* Grid dots */}
        <div
          className="absolute inset-0 opacity-30 pointer-events-none"
          style={{
            backgroundImage: `radial-gradient(circle, #aaa 1px, transparent 1px)`,
            backgroundSize: `${5 * MM_TO_PX * zoom}px ${5 * MM_TO_PX * zoom}px`,
            backgroundPosition: `${marginLeftPx}px 0`,
          }}
        />

        {/* Elements */}
        {elements.map(el => (
          <ElementChip
            key={el.id}
            el={el}
            zoom={zoom}
            marginLeftPx={marginLeftPx}
            isSelected={selectedElementId === el.id}
            onMouseDown={e => onElementMouseDown(el, e)}
            onResizeMouseDown={e => onResizeHandleMouseDown(el, e)}
          />
        ))}
      </div>

      {/* Band resize handle */}
      {!isDetail && (
        <div
          onMouseDown={onResizeBandMouseDown}
          className="absolute bottom-0 left-0 right-0 h-2 flex items-center justify-center cursor-ns-resize group"
        >
          <div className="w-16 h-0.5 bg-gray-300 group-hover:bg-blue-400 transition-colors rounded-full" />
        </div>
      )}
    </div>
  );
}

// ─── Element Chip ─────────────────────────────────────────────────────────────
interface ElementChipProps {
  el: TemplateElement;
  zoom: number;
  marginLeftPx: number;
  isSelected: boolean;
  onMouseDown: (e: React.MouseEvent) => void;
  onResizeMouseDown: (e: React.MouseEvent) => void;
}

function ElementChip({ el, zoom, marginLeftPx, isSelected, onMouseDown, onResizeMouseDown }: ElementChipProps) {
  const px = {
    left: marginLeftPx + el.x * MM_TO_PX * zoom,
    top: el.y * MM_TO_PX * zoom,
    width: el.width * MM_TO_PX * zoom,
    height: el.height * MM_TO_PX * zoom,
  };

  const isLine = el.type === 'line';

  return (
    <div
      onMouseDown={onMouseDown}
      className={`absolute select-none overflow-hidden ${isSelected ? 'z-20' : 'z-10'}`}
      style={{
        left: px.left,
        top: px.top,
        width: Math.max(px.width, 10),
        height: Math.max(px.height, 6),
        cursor: 'move',
        outline: isSelected ? '2px solid #3b82f6' : '1px dashed #94a3b8',
        backgroundColor: isSelected ? 'rgba(59,130,246,0.06)' : 'rgba(248,250,252,0.5)',
      }}
    >
      {/* Content preview */}
      {isLine ? (
        <div
          className="absolute"
          style={{
            backgroundColor: (el as any).color || '#000',
            left: 0, right: 0,
            top: '50%',
            height: Math.max(1, ((el as any).thickness || 0.3) * MM_TO_PX * zoom),
            transform: 'translateY(-50%)',
          }}
        />
      ) : (
        <div className="flex items-center gap-0.5 px-1 py-0.5 pointer-events-none h-full overflow-hidden">
          <span className="text-blue-500 opacity-80 shrink-0">{elementIcon(el.type)}</span>
          <span className="text-[9px] text-gray-600 truncate leading-tight">{elementLabel(el)}</span>
        </div>
      )}

      {/* Selection handles */}
      {isSelected && (
        <>
          {/* Resize handle — bottom-right */}
          <div
            onMouseDown={onResizeMouseDown}
            className="absolute right-0 bottom-0 w-3 h-3 bg-blue-500 cursor-se-resize"
            style={{ zIndex: 30 }}
          />
          {/* Corner dots */}
          {[
            { style: { left: -3, top: -3 } },
            { style: { right: -3, top: -3 } },
            { style: { left: -3, bottom: -3 } },
          ].map((h, i) => (
            <div
              key={i}
              className="absolute w-2.5 h-2.5 bg-white border-2 border-blue-500 rounded-full pointer-events-none"
              style={h.style}
            />
          ))}
        </>
      )}
    </div>
  );
}
