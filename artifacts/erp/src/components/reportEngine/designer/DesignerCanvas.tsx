import { useRef, useCallback, useEffect, useState } from "react";
import {
  Type, Tag, Calculator, Image, Minus, Square, Table, Grid2X2,
  GripVertical,
} from "lucide-react";
import { MM_TO_PX, getPaperDimensions } from "@/lib/reportEngine/paperSizes";
import type { TemplateElement, PaperSize, Orientation } from "@/lib/reportEngine/types";
import type { DesignerBandsState, BandKey } from "@/pages/report-templates/ReportDesigner";

// ─── Snap helper ─────────────────────────────────────────────────────────────
function snapMm(mm: number, gridSize: number, enabled: boolean): number {
  if (!enabled) return +mm.toFixed(1);
  return +(Math.round(mm / gridSize) * gridSize).toFixed(2);
}

// ─── Drag state ───────────────────────────────────────────────────────────────
type DragState =
  | {
      type: 'move';
      bandKey: BandKey;
      elementIds: string[];
      startPageX: number;
      startPageY: number;
      startPositions: { id: string; x: number; y: number }[];
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
    }
  | {
      type: 'rubberband';
      bandKey: BandKey;
      bandOffsetTop: number;  // px offset of band content top from document top
      bandOffsetLeft: number; // px offset of band content left from document left
      startPageX: number;
      startPageY: number;
    };

interface RubberBandRect {
  bandKey: BandKey;
  left: number;
  top: number;
  width: number;
  height: number;
}

// ─── Props ────────────────────────────────────────────────────────────────────
interface Props {
  bands: DesignerBandsState;
  paperSize: PaperSize;
  orientation: Orientation;
  margin: { top: number; right: number; bottom: number; left: number };
  zoom: number;
  snapToGrid: boolean;
  gridSize: number;
  selectedBandKey: BandKey | null;
  selectedElementIds: string[];
  mode: 'select' | 'add';
  addingType: TemplateElement['type'] | null;
  onSelectElements: (bandKey: BandKey, ids: string[]) => void;
  onSelectBand: (bandKey: BandKey) => void;
  onMoveElements: (bandKey: BandKey, updates: { id: string; x: number; y: number }[]) => void;
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
    case 'text':    return el.content.slice(0, 24) || 'Text';
    case 'field':   return el.field;
    case 'formula': return el.formula.slice(0, 24) || 'Formula';
    case 'image':   return el.source;
    case 'line':    return el.direction === 'horizontal' ? '— Line' : '| Line';
    case 'box':     return 'Box';
    case 'table':   return `Table (${el.columns.length} cols)`;
    case 'qrcode':  return 'QR Code';
    default:        return (el as TemplateElement).type;
  }
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function DesignerCanvas({
  bands, paperSize, orientation, margin, zoom,
  snapToGrid, gridSize,
  selectedBandKey, selectedElementIds, mode, addingType,
  onSelectElements, onSelectBand, onMoveElements, onResizeElement,
  onResizeBand, onPlaceElement, onDeselectAll,
}: Props) {
  const dragState = useRef<DragState | null>(null);
  const [rubberBandRect, setRubberBandRect] = useState<RubberBandRect | null>(null);

  const paper = getPaperDimensions(paperSize, orientation);
  const paperW = paper.width * MM_TO_PX * zoom;
  const contentW = (paper.width - margin.left - margin.right) * MM_TO_PX * zoom;

  // ─── Global mouse move/up ─────────────────────────────────────────────────
  const onMouseMove = useCallback((e: MouseEvent) => {
    const d = dragState.current;
    if (!d) return;

    if (d.type === 'move') {
      const dxMm = (e.pageX - d.startPageX) / (MM_TO_PX * zoom);
      const dyMm = (e.pageY - d.startPageY) / (MM_TO_PX * zoom);
      const updates = d.startPositions.map(sp => ({
        id: sp.id,
        x: snapMm(Math.max(0, sp.x + dxMm), gridSize, snapToGrid),
        y: snapMm(Math.max(0, sp.y + dyMm), gridSize, snapToGrid),
      }));
      onMoveElements(d.bandKey, updates);

    } else if (d.type === 'resize-band') {
      const dyMm = (e.pageY - d.startPageY) / (MM_TO_PX * zoom);
      onResizeBand(d.bandKey, Math.max(8, snapMm(d.startHeight + dyMm, gridSize, snapToGrid)));

    } else if (d.type === 'resize-el') {
      const dxMm = (e.pageX - d.startPageX) / (MM_TO_PX * zoom);
      const dyMm = (e.pageY - d.startPageY) / (MM_TO_PX * zoom);
      onResizeElement(d.bandKey, d.elementId,
        Math.max(2, snapMm(d.startW + dxMm, gridSize, snapToGrid)),
        Math.max(2, snapMm(d.startH + dyMm, gridSize, snapToGrid)),
      );

    } else if (d.type === 'rubberband') {
      const left   = Math.min(e.pageX, d.startPageX) - d.bandOffsetLeft;
      const top    = Math.min(e.pageY, d.startPageY) - d.bandOffsetTop;
      const width  = Math.abs(e.pageX - d.startPageX);
      const height = Math.abs(e.pageY - d.startPageY);
      setRubberBandRect({ bandKey: d.bandKey, left, top, width, height });
    }
  }, [zoom, snapToGrid, gridSize, onMoveElements, onResizeBand, onResizeElement]);

  const onMouseUp = useCallback((e: MouseEvent) => {
    const d = dragState.current;
    if (d?.type === 'rubberband') {
      // Select elements within the rubber-band rect
      const rectLeftMm  = (Math.min(e.pageX, d.startPageX) - d.bandOffsetLeft) / (MM_TO_PX * zoom) - margin.left;
      const rectTopMm   = (Math.min(e.pageY, d.startPageY) - d.bandOffsetTop)  / (MM_TO_PX * zoom);
      const rectRightMm = rectLeftMm + Math.abs(e.pageX - d.startPageX) / (MM_TO_PX * zoom);
      const rectBotMm   = rectTopMm  + Math.abs(e.pageY - d.startPageY) / (MM_TO_PX * zoom);

      const bandElements = bands[d.bandKey].elements;
      const selectedIds = bandElements
        .filter(el =>
          el.x < rectRightMm &&
          el.x + el.width > rectLeftMm &&
          el.y < rectBotMm &&
          el.y + el.height > rectTopMm
        )
        .map(el => el.id);

      if (selectedIds.length > 0) {
        onSelectElements(d.bandKey, selectedIds);
      }
      setRubberBandRect(null);
    }
    dragState.current = null;
  }, [zoom, margin, bands, onSelectElements]);

  useEffect(() => {
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [onMouseMove, onMouseUp]);

  // ─── Keyboard arrow-key move ──────────────────────────────────────────────
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Skip when typing in any input / textarea / select / contenteditable
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' ||
        target.isContentEditable
      ) return;

      if (!selectedBandKey || selectedElementIds.length === 0) return;

      const isArrow = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key);
      if (!isArrow) return;

      e.preventDefault(); // stop page scroll

      // Shift = big step (5× grid or 10 mm), normal = 1 grid unit or 1 mm
      const step = e.shiftKey
        ? (snapToGrid ? gridSize * 5 : 10)
        : (snapToGrid ? gridSize : 1);

      const dx = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0;
      const dy = e.key === 'ArrowUp'   ? -step : e.key === 'ArrowDown'  ? step : 0;

      const bandElements = bands[selectedBandKey].elements;
      const updates = selectedElementIds.map(id => {
        const el = bandElements.find(el => el.id === id);
        return {
          id,
          x: snapMm(Math.max(0, (el?.x ?? 0) + dx), gridSize, snapToGrid),
          y: snapMm(Math.max(0, (el?.y ?? 0) + dy), gridSize, snapToGrid),
        };
      });
      onMoveElements(selectedBandKey, updates);
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedBandKey, selectedElementIds, bands, snapToGrid, gridSize, onMoveElements]);

  // ─── Element click (with shift for multi-select) ──────────────────────────
  function handleElementClick(e: React.MouseEvent, bandKey: BandKey, elementId: string) {
    e.stopPropagation();
    if (e.shiftKey && selectedBandKey === bandKey) {
      // Toggle in current selection (same band only)
      const next = selectedElementIds.includes(elementId)
        ? selectedElementIds.filter(id => id !== elementId)
        : [...selectedElementIds, elementId];
      onSelectElements(bandKey, next);
    } else {
      onSelectElements(bandKey, [elementId]);
    }
  }

  // ─── Band content click (placement or rubber-band start) ─────────────────
  function handleBandContentMouseDown(
    e: React.MouseEvent,
    bandKey: BandKey,
    bandContentEl: HTMLDivElement,
  ) {
    if (mode === 'add' && addingType) {
      // Place element
      const rect = bandContentEl.getBoundingClientRect();
      const xMm = snapMm(Math.max(0, (e.clientX - rect.left - margin.left * MM_TO_PX * zoom) / (MM_TO_PX * zoom)), gridSize, snapToGrid);
      const yMm = snapMm(Math.max(0, (e.clientY - rect.top) / (MM_TO_PX * zoom)), gridSize, snapToGrid);
      onPlaceElement(bandKey, xMm, yMm);
      return;
    }

    // Start rubber-band on empty content click
    const rect = bandContentEl.getBoundingClientRect();
    dragState.current = {
      type: 'rubberband',
      bandKey,
      bandOffsetLeft: rect.left + window.pageXOffset,
      bandOffsetTop:  rect.top  + window.pageYOffset,
      startPageX: e.pageX,
      startPageY: e.pageY,
    };
    onDeselectAll();
  }

  return (
    <div
      className="flex-1 overflow-auto bg-gray-200"
      style={{ cursor: mode === 'add' ? 'crosshair' : 'default' }}
      onClick={e => { if (e.target === e.currentTarget) onDeselectAll(); }}
    >
      <div className="flex flex-col items-center py-8" style={{ minWidth: paperW + 64 }}>
        {/* Paper */}
        <div
          className="shadow-2xl bg-white relative"
          style={{ width: paperW, minHeight: 100 }}
          onClick={e => { if (e.target === e.currentTarget) onDeselectAll(); }}
        >
          {/* Margin guide */}
          <div
            className="absolute border border-dashed border-blue-200 pointer-events-none"
            style={{
              top:    margin.top    * MM_TO_PX * zoom,
              left:   margin.left   * MM_TO_PX * zoom,
              right:  margin.right  * MM_TO_PX * zoom,
              bottom: margin.bottom * MM_TO_PX * zoom,
            }}
          />

          {BAND_ORDER.map(bandKey => {
            const band = bands[bandKey];
            const height = bandKey === 'detail'
              ? bands.detail.designerHeight
              : (band as any).height;
            const heightPx = height * MM_TO_PX * zoom;
            const isBandSelected = selectedBandKey === bandKey && selectedElementIds.length === 0;

            return (
              <BandContainer
                key={bandKey}
                bandKey={bandKey}
                label={BAND_LABELS[bandKey]}
                color={BAND_COLORS[bandKey]}
                heightPx={heightPx}
                marginLeftPx={margin.left * MM_TO_PX * zoom}
                elements={band.elements}
                zoom={zoom}
                selectedElementIds={selectedBandKey === bandKey ? selectedElementIds : []}
                isBandSelected={isBandSelected}
                mode={mode}
                isDetail={bandKey === 'detail'}
                rubberBandRect={rubberBandRect?.bandKey === bandKey ? rubberBandRect : null}
                onBandHeaderClick={() => onSelectBand(bandKey)}
                onBandContentMouseDown={(e, el) => handleBandContentMouseDown(e, bandKey, el)}
                onElementClick={(e, id) => handleElementClick(e, bandKey, id)}
                onElementDragStart={(e, el) => {
                  // Multi-select drag: if element not in selection, replace selection
                  let ids = selectedElementIds;
                  if (!ids.includes(el.id)) {
                    ids = [el.id];
                    onSelectElements(bandKey, ids);
                  }
                  const allBandEls = bands[bandKey].elements;
                  dragState.current = {
                    type: 'move',
                    bandKey,
                    elementIds: ids,
                    startPageX: e.pageX,
                    startPageY: e.pageY,
                    startPositions: ids.map(id => {
                      const found = allBandEls.find(el => el.id === id);
                      return { id, x: found?.x ?? 0, y: found?.y ?? 0 };
                    }),
                  };
                }}
                onResizeHandleMouseDown={(e, el) => {
                  e.stopPropagation();
                  onSelectElements(bandKey, [el.id]);
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
                onResizeBandMouseDown={e => {
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
  marginLeftPx: number;
  elements: TemplateElement[];
  zoom: number;
  selectedElementIds: string[];
  isBandSelected: boolean;
  mode: 'select' | 'add';
  isDetail: boolean;
  rubberBandRect: RubberBandRect | null;
  onBandHeaderClick: () => void;
  onBandContentMouseDown: (e: React.MouseEvent, el: HTMLDivElement) => void;
  onElementClick: (e: React.MouseEvent, id: string) => void;
  onElementDragStart: (e: React.MouseEvent, el: TemplateElement) => void;
  onResizeHandleMouseDown: (e: React.MouseEvent, el: TemplateElement) => void;
  onResizeBandMouseDown: (e: React.MouseEvent) => void;
}

function BandContainer({
  bandKey, label, color, heightPx, marginLeftPx,
  elements, zoom, selectedElementIds, isBandSelected, mode, isDetail,
  rubberBandRect,
  onBandHeaderClick, onBandContentMouseDown, onElementClick,
  onElementDragStart, onResizeHandleMouseDown, onResizeBandMouseDown,
}: BandContainerProps) {
  const contentRef = useRef<HTMLDivElement>(null);

  return (
    <div className="relative">
      {/* Band label */}
      <div
        onClick={onBandHeaderClick}
        className="flex items-center gap-2 px-3 py-0.5 text-white text-[10px] font-medium select-none cursor-pointer"
        style={{ backgroundColor: color, opacity: isBandSelected ? 1 : 0.82 }}
      >
        <GripVertical className="w-3 h-3 opacity-60" />
        {label}
        <span className="ml-auto opacity-50">{elements.length} el</span>
        {isDetail && <span className="text-[9px] opacity-60">(designer height)</span>}
      </div>

      {/* Band content */}
      <div
        ref={contentRef}
        className="relative border-b border-gray-200 select-none"
        style={{
          height: heightPx,
          cursor: mode === 'add' ? 'crosshair' : 'default',
          outline: isBandSelected ? `2px solid ${color}` : 'none',
        }}
        onMouseDown={e => {
          if ((e.target as HTMLElement) === contentRef.current) {
            if (contentRef.current) onBandContentMouseDown(e, contentRef.current);
          }
        }}
      >
        {/* Grid dots */}
        <div
          className="absolute inset-0 opacity-25 pointer-events-none"
          style={{
            backgroundImage: 'radial-gradient(circle, #999 1px, transparent 1px)',
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
            isSelected={selectedElementIds.includes(el.id)}
            isMultiSelected={selectedElementIds.length > 1 && selectedElementIds.includes(el.id)}
            onClick={e => onElementClick(e, el.id)}
            onDragStart={e => { e.stopPropagation(); onElementDragStart(e, el); }}
            onResizeMouseDown={e => onResizeHandleMouseDown(e, el)}
          />
        ))}

        {/* Rubber-band selection rect */}
        {rubberBandRect && (
          <div
            className="absolute border border-blue-400 bg-blue-400/10 pointer-events-none"
            style={{
              left:   rubberBandRect.left,
              top:    rubberBandRect.top,
              width:  rubberBandRect.width,
              height: rubberBandRect.height,
              zIndex: 100,
            }}
          />
        )}
      </div>

      {/* Band resize handle */}
      {!isDetail && (
        <div
          onMouseDown={onResizeBandMouseDown}
          className="absolute bottom-0 left-0 right-0 h-2 flex items-center justify-center cursor-ns-resize group z-10"
        >
          <div className="w-20 h-0.5 bg-gray-300 group-hover:bg-blue-400 transition-colors rounded-full" />
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
  isMultiSelected: boolean;
  onClick: (e: React.MouseEvent) => void;
  onDragStart: (e: React.MouseEvent) => void;
  onResizeMouseDown: (e: React.MouseEvent) => void;
}

function ElementChip({ el, zoom, marginLeftPx, isSelected, isMultiSelected, onClick, onDragStart, onResizeMouseDown }: ElementChipProps) {
  const px = {
    left:   marginLeftPx + el.x * MM_TO_PX * zoom,
    top:    el.y  * MM_TO_PX * zoom,
    width:  Math.max(el.width  * MM_TO_PX * zoom, 10),
    height: Math.max(el.height * MM_TO_PX * zoom, 6),
  };

  const isLine = el.type === 'line';

  let outlineColor = 'rgba(148,163,184,0.6)'; // unselected
  if (isMultiSelected) outlineColor = '#f59e0b'; // multi-select: amber
  else if (isSelected) outlineColor = '#3b82f6'; // single: blue

  return (
    <div
      onClick={onClick}
      onMouseDown={onDragStart}
      className="absolute select-none overflow-hidden"
      style={{
        left:    px.left,
        top:     px.top,
        width:   px.width,
        height:  px.height,
        cursor:  'move',
        zIndex:  isSelected ? 20 : 10,
        outline: `${isSelected || isMultiSelected ? 2 : 1}px ${isSelected || isMultiSelected ? 'solid' : 'dashed'} ${outlineColor}`,
        backgroundColor: isSelected
          ? 'rgba(59,130,246,0.07)'
          : isMultiSelected
            ? 'rgba(245,158,11,0.07)'
            : 'rgba(248,250,252,0.4)',
      }}
    >
      {isLine ? (
        (el as any).direction === 'vertical' ? (
          <div
            className="absolute"
            style={{
              backgroundColor: (el as any).color || '#000',
              top: 0, bottom: 0,
              left: '50%',
              width: Math.max(1, ((el as any).thickness || 0.3) * MM_TO_PX * zoom),
              transform: 'translateX(-50%)',
            }}
          />
        ) : (
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
        )
      ) : (
        <div
          className="flex items-center gap-0.5 px-1 py-0.5 pointer-events-none h-full overflow-hidden"
          style={{ justifyContent: (el as any).style?.textAlign === 'right' ? 'flex-end' : (el as any).style?.textAlign === 'center' ? 'center' : 'flex-start' }}
        >
          <span className="text-blue-400 opacity-70 shrink-0" style={{ fontSize: Math.max(8, 10 * zoom) }}>{elementIcon(el.type)}</span>
          {/* Live style preview — the chip label reflects the element's actual
              font size/weight/color so style edits are visible right on the
              canvas instead of only in the final Preview (1pt ≈ 1.333px). */}
          <span
            className="truncate leading-tight"
            style={{
              fontSize: Math.max(6, ((el as any).style?.fontSize || 10) * 1.333 * zoom),
              fontWeight: (el as any).style?.fontWeight,
              fontStyle: (el as any).style?.fontStyle,
              color: (el as any).style?.color || '#4b5563',
            }}
          >
            {elementLabel(el)}
          </span>
        </div>
      )}

      {/* Selection handles — only for single primary selection */}
      {isSelected && !isMultiSelected && (
        <>
          <div
            onMouseDown={onResizeMouseDown}
            className="absolute right-0 bottom-0 w-3 h-3 bg-blue-500 cursor-se-resize"
            style={{ zIndex: 30 }}
          />
          {[{ style: { left: -3, top: -3 } }, { style: { right: -3, top: -3 } }, { style: { left: -3, bottom: -3 } }].map((h, i) => (
            <div key={i} className="absolute w-2.5 h-2.5 bg-white border-2 border-blue-500 rounded-full pointer-events-none" style={h.style} />
          ))}
        </>
      )}

      {/* Multi-select indicator */}
      {isMultiSelected && (
        <div className="absolute right-0 bottom-0 w-3 h-3 bg-amber-500 pointer-events-none" />
      )}
    </div>
  );
}
