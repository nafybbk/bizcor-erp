import type {
  TemplateElement, TextElement, FieldElement, FormulaElement,
  ImageElement, LineElement, BoxElement, TableElement, QrCodeElement,
  ReportContext,
} from '@/lib/reportEngine/types';
import {
  renderFieldValue, evaluateFormula, formatNumber, evaluateCondition,
} from '@/lib/reportEngine/formulaEngine';
import { mmToPx } from '@/lib/reportEngine/paperSizes';

interface ElementRendererProps {
  element: TemplateElement;
  context: ReportContext;
  itemContext?: Record<string, unknown>;
  scale?: number;
}

// ─── Convert ElementStyle to React CSS ────────────────────────────────────────
function toReactStyle(style: TemplateElement['style'], scale = 1): React.CSSProperties {
  if (!style) return {};
  return {
    fontSize: style.fontSize ? `${style.fontSize * scale}pt` : undefined,
    fontWeight: style.fontWeight,
    fontStyle: style.fontStyle,
    textAlign: style.textAlign,
    color: style.color,
    backgroundColor: style.backgroundColor,
    borderTop: style.borderTop || style.border,
    borderRight: style.borderRight || style.border,
    borderBottom: style.borderBottom || style.border,
    borderLeft: style.borderLeft || style.border,
    padding: style.padding ? `${mmToPx(style.padding) * scale}px` : undefined,
    lineHeight: style.lineHeight,
    wordBreak: style.wordBreak,
    boxSizing: 'border-box',
  };
}

// ─── Text Element ─────────────────────────────────────────────────────────────
function RenderText({ el, scale }: { el: TextElement; scale: number }) {
  return (
    <div
      style={{
        ...toReactStyle(el.style, scale),
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        whiteSpace: 'pre-wrap',
      }}
    >
      {el.content}
    </div>
  );
}

// ─── Field Element ────────────────────────────────────────────────────────────
function RenderField({ el, context, itemContext, scale }: { el: FieldElement; context: ReportContext; itemContext?: Record<string, unknown>; scale: number }) {
  const value = renderFieldValue(el.field, context, el.format, el.nullText || '', itemContext);
  return (
    <div
      style={{
        ...toReactStyle(el.style, scale),
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        whiteSpace: 'pre-wrap',
      }}
    >
      {value}
    </div>
  );
}

// ─── Formula Element ──────────────────────────────────────────────────────────
function RenderFormula({ el, context, itemContext, scale }: { el: FormulaElement; context: ReportContext; itemContext?: Record<string, unknown>; scale: number }) {
  const value = evaluateFormula(el.formula, context, itemContext);
  const formatted = formatNumber(value, el.format || '0.00');
  return (
    <div
      style={{
        ...toReactStyle(el.style, scale),
        width: '100%',
        height: '100%',
        overflow: 'hidden',
      }}
    >
      {formatted}
    </div>
  );
}

// ─── Image Element ────────────────────────────────────────────────────────────
function RenderImage({ el, context, itemContext }: { el: ImageElement; context: ReportContext; itemContext?: Record<string, unknown> }) {
  // source can be a field key or a static URL
  let src = el.source;
  if (!src.startsWith('http') && !src.startsWith('data:')) {
    const fieldVal = itemContext?.[src] ?? context[src];
    src = typeof fieldVal === 'string' ? fieldVal : '';
  }
  if (!src) return <div style={{ width: '100%', height: '100%', backgroundColor: '#f3f4f6', border: '1px dashed #d1d5db' }} />;
  return (
    <img
      src={src}
      alt=""
      style={{
        width: '100%',
        height: '100%',
        objectFit: el.objectFit || 'contain',
        display: 'block',
      }}
    />
  );
}

// ─── Line Element ─────────────────────────────────────────────────────────────
function RenderLine({ el, scale }: { el: LineElement; scale: number }) {
  const thickness = mmToPx(el.thickness || 0.3) * scale;
  const color = el.color || '#000000';
  if (el.direction === 'horizontal') {
    return (
      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center' }}>
        <div style={{ width: '100%', height: `${thickness}px`, backgroundColor: color }} />
      </div>
    );
  }
  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', justifyContent: 'center' }}>
      <div style={{ width: `${thickness}px`, height: '100%', backgroundColor: color }} />
    </div>
  );
}

// ─── Box Element ──────────────────────────────────────────────────────────────
function RenderBox({ el, scale }: { el: BoxElement; scale: number }) {
  return (
    <div
      style={{
        ...toReactStyle(el.style, scale),
        width: '100%',
        height: '100%',
        boxSizing: 'border-box',
      }}
    />
  );
}

// ─── Table Element ────────────────────────────────────────────────────────────
function RenderTable({ el, context, scale }: { el: TableElement; context: ReportContext; scale: number }) {
  const items = (context[el.dataSource] as Record<string, unknown>[] | undefined) || [];
  const rowHeight = mmToPx(el.rowHeight || 7) * scale;
  const headerHeight = mmToPx(el.headerHeight || 7) * scale;

  const visibleColumns = el.columns.filter(col => {
    if (!col.visibleIf) return true;
    return evaluateCondition(col.visibleIf, context);
  });

  const headerStyle: React.CSSProperties = {
    ...toReactStyle(el.headerStyle, scale),
    display: 'flex',
    height: `${headerHeight}px`,
    fontWeight: 'bold',
    backgroundColor: el.headerStyle?.backgroundColor || '#f8f9fa',
    borderBottom: el.headerStyle?.borderBottom || '1px solid #dee2e6',
    boxSizing: 'border-box',
  };

  const rowStyle: React.CSSProperties = {
    ...toReactStyle(el.rowStyle, scale),
    display: 'flex',
    height: `${rowHeight}px`,
    borderBottom: el.rowStyle?.borderBottom || '1px solid #e9ecef',
    boxSizing: 'border-box',
  };

  const altRowStyle: React.CSSProperties = el.alternateRowStyle
    ? { ...rowStyle, ...toReactStyle(el.alternateRowStyle, scale) }
    : rowStyle;

  const totalWidth = visibleColumns.reduce((sum, col) => sum + col.width, 0) || 100;

  return (
    <div style={{ width: '100%', overflow: 'hidden' }}>
      {/* Header */}
      {el.showHeader !== false && (
        <div style={headerStyle}>
          {visibleColumns.map(col => (
            <div
              key={col.id}
              style={{
                width: `${(col.width / totalWidth) * 100}%`,
                padding: `0 ${mmToPx(1) * scale}px`,
                textAlign: col.headerAlign || col.align || 'left',
                overflow: 'hidden',
                whiteSpace: 'nowrap',
                display: 'flex',
                alignItems: 'center',
                justifyContent: col.headerAlign === 'right' ? 'flex-end' : col.headerAlign === 'center' ? 'center' : 'flex-start',
                borderRight: '1px solid #dee2e6',
                ...toReactStyle(col.headerStyle, scale),
                fontSize: `${8 * scale}pt`,
              }}
            >
              {col.label}
            </div>
          ))}
        </div>
      )}

      {/* Data rows */}
      {items.map((item, idx) => (
        <div key={idx} style={idx % 2 === 1 ? altRowStyle : rowStyle}>
          {visibleColumns.map(col => {
            const value = renderFieldValue(col.field, context, col.format, '', item as Record<string, unknown>);
            return (
              <div
                key={col.id}
                style={{
                  width: `${(col.width / totalWidth) * 100}%`,
                  padding: `0 ${mmToPx(1) * scale}px`,
                  textAlign: col.align || 'left',
                  overflow: 'hidden',
                  whiteSpace: 'nowrap',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: col.align === 'right' ? 'flex-end' : col.align === 'center' ? 'center' : 'flex-start',
                  borderRight: '1px solid #e9ecef',
                  ...toReactStyle(col.style, scale),
                  fontSize: `${8 * scale}pt`,
                }}
              >
                {value}
              </div>
            );
          })}
        </div>
      ))}

      {/* Empty rows */}
      {el.emptyRows && items.length < el.emptyRows && Array.from({ length: el.emptyRows - items.length }).map((_, i) => (
        <div key={`empty-${i}`} style={rowStyle}>
          {visibleColumns.map(col => (
            <div key={col.id} style={{ width: `${(col.width / totalWidth) * 100}%`, borderRight: '1px solid #e9ecef' }} />
          ))}
        </div>
      ))}
    </div>
  );
}

// ─── QR Code Element ──────────────────────────────────────────────────────────
function RenderQrCode({ el, context }: { el: QrCodeElement; context: ReportContext }) {
  // Resolve content (may be a formula/field reference)
  const content = el.content.replace(/\{([^}]+)\}/g, (_m, k: string) => {
    const v = context[k.trim()];
    return v != null ? String(v) : '';
  });

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#f9fafb',
        border: '1px dashed #d1d5db',
        fontSize: '8px',
        color: '#6b7280',
      }}
    >
      QR: {content.slice(0, 20)}
    </div>
  );
}

// ─── Main Element Renderer ─────────────────────────────────────────────────────
export default function ElementRenderer({ element, context, itemContext, scale = 1 }: ElementRendererProps) {
  // Check conditional visibility
  if (element.visibleIf && !evaluateCondition(element.visibleIf, context, itemContext)) {
    return null;
  }

  const style: React.CSSProperties = {
    position: 'absolute',
    left: `${mmToPx(element.x) * scale}px`,
    top: `${mmToPx(element.y) * scale}px`,
    width: `${mmToPx(element.width) * scale}px`,
    height: `${mmToPx(element.height) * scale}px`,
    zIndex: element.zIndex || 1,
    overflow: 'hidden',
    boxSizing: 'border-box',
  };

  return (
    <div style={style}>
      {element.type === 'text' && <RenderText el={element as TextElement} scale={scale} />}
      {element.type === 'field' && <RenderField el={element as FieldElement} context={context} itemContext={itemContext} scale={scale} />}
      {element.type === 'formula' && <RenderFormula el={element as FormulaElement} context={context} itemContext={itemContext} scale={scale} />}
      {element.type === 'image' && <RenderImage el={element as ImageElement} context={context} itemContext={itemContext} />}
      {element.type === 'line' && <RenderLine el={element as LineElement} scale={scale} />}
      {element.type === 'box' && <RenderBox el={element as BoxElement} scale={scale} />}
      {element.type === 'table' && <RenderTable el={element as TableElement} context={context} scale={scale} />}
      {element.type === 'qrcode' && <RenderQrCode el={element as QrCodeElement} context={context} />}
    </div>
  );
}
