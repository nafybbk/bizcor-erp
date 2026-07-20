import type { SavedTemplate, TemplateLayout, TableElement, ReportContext } from '@/lib/reportEngine/types';
import { getPaperDimensions, mmToPx } from '@/lib/reportEngine/paperSizes';
import BandRenderer from './BandRenderer';
import ElementRenderer, { RenderTable } from './ElementRenderer';

interface ReportRendererProps {
  template: SavedTemplate;
  context: ReportContext;
  scale?: number;          // 1 = 100%, 0.7 = 70% etc.
  designMode?: boolean;    // show band labels
  className?: string;
}

// ─── Default empty layout ────────────────────────────────────────────────────
function defaultLayout(): TemplateLayout {
  return {
    bands: {
      pageHeader: { height: 0, visible: false, elements: [] },
      documentHeader: { height: 40, visible: true, elements: [] },
      detail: { visible: true, elements: [] },
      documentFooter: { height: 40, visible: true, elements: [] },
      pageFooter: { height: 10, visible: true, elements: [] },
    },
    margin: { top: 10, right: 10, bottom: 10, left: 10 },
  };
}

export default function ReportRenderer({ template, context, scale = 1, designMode = false, className = '' }: ReportRendererProps) {
  const layout = (template.layoutJson as TemplateLayout | null) || defaultLayout();
  const { bands, margin } = layout;
  const { width, height } = getPaperDimensions(template.paperSize, template.orientation);
  const isThermal = template.paperSize === '80mm' || template.paperSize === '58mm';

  const marginPx = {
    top: mmToPx((margin?.top || 10)) * scale,
    right: mmToPx((margin?.right || 10)) * scale,
    bottom: mmToPx((margin?.bottom || 10)) * scale,
    left: mmToPx((margin?.left || 10)) * scale,
  };

  const paperWidthPx = mmToPx(width) * scale;
  const paperHeightPx = height > 0 ? mmToPx(height) * scale : undefined;
  const contentWidth = width - (margin?.left || 10) - (margin?.right || 10);

  return (
    <div
      className={className}
      style={{
        width: `${paperWidthPx}px`,
        minHeight: paperHeightPx ? `${paperHeightPx}px` : undefined,
        backgroundColor: '#ffffff',
        boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
        position: 'relative',
        fontFamily: 'Arial, Helvetica, sans-serif',
        fontSize: `${9 * scale}pt`,
        color: '#000',
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Page wrapper with margins */}
      <div
        style={{
          paddingTop: `${marginPx.top}px`,
          paddingRight: `${marginPx.right}px`,
          paddingBottom: `${marginPx.bottom}px`,
          paddingLeft: `${marginPx.left}px`,
          display: 'flex',
          flexDirection: 'column',
          flex: 1,
        }}
      >
        {/* Page Header — shows on every page (via @media print) */}
        {bands.pageHeader && bands.pageHeader.visible !== false && bands.pageHeader.height > 0 && (
          <BandRenderer
            band={bands.pageHeader}
            context={context}
            label="Page Header"
            designMode={designMode}
            scale={scale}
            width={contentWidth}
          />
        )}

        {/* Document Header — firm info, party, dates */}
        {bands.documentHeader && bands.documentHeader.visible !== false && (
          <BandRenderer
            band={bands.documentHeader}
            context={context}
            label="Document Header"
            designMode={designMode}
            scale={scale}
            width={contentWidth}
          />
        )}

        {/* Detail Section — items table */}
        {bands.detail && bands.detail.visible !== false && (
          <DetailSection
            band={bands.detail}
            context={context}
            designMode={designMode}
            scale={scale}
            contentWidth={contentWidth}
          />
        )}

        {/* Document Footer — totals, GST, terms */}
        {bands.documentFooter && bands.documentFooter.visible !== false && (
          <BandRenderer
            band={bands.documentFooter}
            context={context}
            label="Document Footer"
            designMode={designMode}
            scale={scale}
            width={contentWidth}
          />
        )}

        {/* Page Footer — page number, branding */}
        {bands.pageFooter && bands.pageFooter.visible !== false && bands.pageFooter.height > 0 && (
          <div style={{ marginTop: 'auto' }}>
            <BandRenderer
              band={bands.pageFooter}
              context={context}
              label="Page Footer"
              designMode={designMode}
              scale={scale}
              width={contentWidth}
            />
          </div>
        )}
      </div>

      {/* Print CSS */}
      <style>{`
        @media print {
          @page { size: ${template.paperSize === '80mm' ? '80mm' : template.paperSize === '58mm' ? '58mm' : template.paperSize} ${isThermal ? '' : template.orientation}; margin: 0; }
        }
      `}</style>
    </div>
  );
}

// ─── Detail Section ────────────────────────────────────────────────────────────
// Renders the detail band elements (usually a TableElement)
interface DetailSectionProps {
  band: { visible?: boolean; elements: TemplateLayout['bands']['detail']['elements'] };
  context: ReportContext;
  designMode?: boolean;
  scale: number;
  contentWidth: number;
}

function DetailSection({ band, context, designMode, scale, contentWidth }: DetailSectionProps) {
  // Tables stretch to absorb every free millimetre between the header and
  // footer bands (page always fills right up to the print margins — leftover
  // space lives INSIDE the item area, like the classic hardcoded invoice);
  // any non-table detail elements keep their absolute designed positions.
  const tables = band.elements.filter(el => el.type === 'table');
  const others = band.elements.filter(el => el.type !== 'table');
  return (
    <div
      style={{
        position: 'relative',
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        width: `${mmToPx(contentWidth) * scale}px`,
      }}
    >
      {designMode && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            backgroundColor: 'rgba(16,185,129,0.08)',
            border: '1px dashed #10b981',
            width: '100%',
            height: '100%',
            pointerEvents: 'none',
            zIndex: 999,
          }}
        >
          <span style={{ fontSize: '9px', color: '#10b981', padding: '1px 4px' }}>Detail</span>
        </div>
      )}
      {tables.map(el => (
        <div
          key={el.id}
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            marginLeft: `${mmToPx(el.x) * scale}px`,
            width: `${mmToPx(el.width) * scale}px`,
            minHeight: `${mmToPx(el.height) * scale}px`,
          }}
        >
          <RenderTable el={el as TableElement} context={context} scale={scale} stretch />
        </div>
      ))}
      {others.map(el => (
        <ElementRenderer
          key={el.id}
          element={el}
          context={context}
          scale={scale}
        />
      ))}
    </div>
  );
}
