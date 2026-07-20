import { useEffect, useRef, useState, type ReactNode } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";

// Row-virtualized photo grid: column count auto-fits the container width
// against a target card size (Explorer-style density), and only the rows
// actually on screen (+ overscan) get mounted — keeps scrolling smooth even
// with thousands of thumbnails, instead of mounting every image at once.
//
// Optional `selectable` mode adds desktop-style rubber-band selection: click
// a thumbnail to toggle just that one, or click-drag (starting anywhere,
// including on a thumbnail) to draw a rectangle — every item whose cell
// intersects it becomes the new selection, recomputed live while dragging,
// with auto-scroll near the top/bottom edge so it keeps working past
// whatever's currently rendered (the point of it at 1000s-of-images scale).
export default function VirtualPhotoGrid<T, K extends number | string = number>({
  items,
  getKey,
  renderCard,
  cardPx,
  gap = 12,
  height,
  selectable = false,
  selected,
  onSelectionChange,
  forceColumns,
  extraRowHeight = 0,
}: {
  items: T[];
  getKey: (item: T) => K;
  renderCard: (item: T, isSelected: boolean) => ReactNode;
  cardPx: number;
  gap?: number;
  height: number | string;
  selectable?: boolean;
  selected?: Set<K>;
  onSelectionChange?: (next: Set<K>) => void;
  // Skip the auto-fit-to-width column math and use exactly this many columns
  // instead — List/Details views want a single full-width column (a row per
  // item) but still get the same virtualization + rubber-band select for free.
  forceColumns?: number;
  // Extra vertical space per row beyond cardPx — e.g. a name label rendered
  // below a square thumbnail. Doesn't affect column width, only row height
  // (and therefore the rubber-band row math, which reads it live too).
  extraRowHeight?: number;
}) {
  const parentRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const el = parentRef.current;
    if (!el) return;
    const ro = new ResizeObserver(entries => setWidth(entries[0].contentRect.width));
    ro.observe(el);
    setWidth(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  const columns = forceColumns ?? Math.max(1, Math.floor((width + gap) / (cardPx + gap)));
  const rowCount = Math.ceil(items.length / columns);
  const rowHeight = cardPx + gap + extraRowHeight;
  const colWidth = columns > 0 ? (width - (columns - 1) * gap) / columns : cardPx;

  const rowVirtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => parentRef.current,
    estimateSize: () => rowHeight,
    overscan: 4,
  });

  // ─── Rubber-band drag select ────────────────────────────────────────────
  const [dragRect, setDragRect] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const dragState = useRef<{
    startClientX: number;
    startClientY: number;
    startContentX: number;
    startContentY: number;
    dragged: boolean;
    downIndex: number | null;
  } | null>(null);

  // A drag spans many renders (each selection change re-renders the parent
  // and this component), but the window-level mousemove/mouseup listeners
  // must survive all of that without being torn down mid-drag — so instead
  // of closing over props/derived values directly (which would force the
  // setup effect to re-run on every selection change), stash the latest
  // values in a ref and set the listeners up exactly once.
  const latest = useRef({ columns, colWidth, rowHeight, rowCount, items, getKey, selected, onSelectionChange, gap });
  latest.current = { columns, colWidth, rowHeight, rowCount, items, getKey, selected, onSelectionChange, gap };

  useEffect(() => {
    if (!selectable) return;
    const el = parentRef.current;
    if (!el) return;

    const contentPoint = (clientX: number, clientY: number) => {
      const rect = el.getBoundingClientRect();
      return {
        x: Math.min(Math.max(clientX - rect.left, 0), rect.width),
        y: clientY - rect.top + el.scrollTop,
      };
    };

    const indexAt = (x: number, y: number): number | null => {
      const { columns: cols, colWidth: cw, rowHeight: rh, gap: g, items: its } = latest.current;
      if (cols <= 0 || cw <= 0) return null;
      const col = Math.floor(x / (cw + g));
      const row = Math.floor(y / rh);
      if (col < 0 || col >= cols || row < 0) return null;
      const idx = row * cols + col;
      return idx >= 0 && idx < its.length ? idx : null;
    };

    const selectInRect = (x1: number, y1: number, x2: number, y2: number) => {
      const { columns: cols, colWidth: cw, rowHeight: rh, rowCount: rc, gap: g, items: its, getKey: gk } = latest.current;
      const left = Math.min(x1, x2), right = Math.max(x1, x2);
      const top = Math.min(y1, y2), bottom = Math.max(y1, y2);
      const colStart = Math.max(0, Math.floor(left / (cw + g)));
      const colEnd = Math.min(cols - 1, Math.floor(right / (cw + g)));
      const rowStart = Math.max(0, Math.floor(top / rh));
      const rowEnd = Math.min(rc - 1, Math.floor(bottom / rh));
      const next = new Set<K>();
      for (let r = rowStart; r <= rowEnd; r++) {
        for (let c = colStart; c <= colEnd; c++) {
          const idx = r * cols + c;
          if (idx >= 0 && idx < its.length) next.add(gk(its[idx]));
        }
      }
      return next;
    };

    const handleMove = (e: MouseEvent) => {
      const ds = dragState.current;
      if (!ds) return;
      if (!ds.dragged && Math.hypot(e.clientX - ds.startClientX, e.clientY - ds.startClientY) > 4) {
        ds.dragged = true;
      }
      if (!ds.dragged) return;

      const pt = contentPoint(e.clientX, e.clientY);
      setDragRect({
        x: Math.min(ds.startContentX, pt.x),
        y: Math.min(ds.startContentY, pt.y),
        w: Math.abs(pt.x - ds.startContentX),
        h: Math.abs(pt.y - ds.startContentY),
      });
      latest.current.onSelectionChange?.(selectInRect(ds.startContentX, ds.startContentY, pt.x, pt.y));

      // Auto-scroll once the pointer nears the top/bottom edge of the
      // visible viewport — otherwise you could only ever rubber-band
      // select whatever happened to already be on screen.
      const rect = el.getBoundingClientRect();
      const edge = 40;
      if (e.clientY < rect.top + edge) {
        el.scrollTop -= Math.min(20, (rect.top + edge - e.clientY) / 2);
      } else if (e.clientY > rect.bottom - edge) {
        el.scrollTop += Math.min(20, (e.clientY - (rect.bottom - edge)) / 2);
      }
    };

    const handleUp = () => {
      const ds = dragState.current;
      const { downIndex } = ds || {};
      if (ds && !ds.dragged && downIndex != null) {
        const { items: its, getKey: gk, selected: sel, onSelectionChange: onChange } = latest.current;
        if (onChange) {
          const key = gk(its[downIndex]);
          const next = new Set(sel);
          if (next.has(key)) next.delete(key); else next.add(key);
          onChange(next);
        }
      }
      dragState.current = null;
      setDragRect(null);
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
    };

    const handleDown = (e: MouseEvent) => {
      if (e.button !== 0) return;
      const pt = contentPoint(e.clientX, e.clientY);
      dragState.current = {
        startClientX: e.clientX,
        startClientY: e.clientY,
        startContentX: pt.x,
        startContentY: pt.y,
        dragged: false,
        downIndex: indexAt(pt.x, pt.y),
      };
      window.addEventListener("mousemove", handleMove);
      window.addEventListener("mouseup", handleUp);
    };

    el.addEventListener("mousedown", handleDown);
    return () => {
      el.removeEventListener("mousedown", handleDown);
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
    };
    // Deliberately only [selectable] — everything else is read live via
    // `latest.current` so a mid-drag selection change never tears down the
    // window-level listeners the drag depends on.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectable]);

  return (
    <div ref={parentRef} style={{ height, overflow: "auto", position: "relative" }}>
      <div style={{ height: rowVirtualizer.getTotalSize(), position: "relative", width: "100%", userSelect: dragState.current ? "none" : undefined }}>
        {width > 0 && rowVirtualizer.getVirtualItems().map(virtualRow => {
          const startIdx = virtualRow.index * columns;
          const rowItems = items.slice(startIdx, startIdx + columns);
          return (
            <div
              key={virtualRow.key}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                height: virtualRow.size,
                transform: `translateY(${virtualRow.start}px)`,
                display: "grid",
                gridTemplateColumns: `repeat(${columns}, 1fr)`,
                gap,
              }}
            >
              {rowItems.map(item => {
                const key = getKey(item);
                return <div key={key}>{renderCard(item, !!selected?.has(key))}</div>;
              })}
            </div>
          );
        })}
        {dragRect && (
          <div
            style={{
              position: "absolute",
              left: dragRect.x,
              top: dragRect.y,
              width: dragRect.w,
              height: dragRect.h,
              backgroundColor: "rgba(124,58,237,0.15)",
              border: "1px solid rgba(124,58,237,0.6)",
              pointerEvents: "none",
            }}
          />
        )}
      </div>
    </div>
  );
}
