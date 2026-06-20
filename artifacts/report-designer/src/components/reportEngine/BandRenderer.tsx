import type { Band, ReportContext } from '@/lib/reportEngine/types';
import { mmToPx } from '@/lib/reportEngine/paperSizes';
import { evaluateCondition } from '@/lib/reportEngine/formulaEngine';
import ElementRenderer from './ElementRenderer';

interface BandRendererProps {
  band: Band;
  context: ReportContext;
  label?: string;          // for designer mode only
  designMode?: boolean;
  scale?: number;
  width: number;           // paper width in mm
}

export default function BandRenderer({ band, context, label, designMode, scale = 1, width }: BandRendererProps) {
  // Check band visibility
  if (band.visible === false) return null;
  if (band.visibleIf && !evaluateCondition(band.visibleIf, context)) return null;

  const heightPx = mmToPx(band.height) * scale;
  const widthPx = mmToPx(width) * scale;

  return (
    <div
      style={{
        position: 'relative',
        width: `${widthPx}px`,
        height: `${heightPx}px`,
        backgroundColor: band.backgroundColor || 'transparent',
        overflow: 'hidden',
        flexShrink: 0,
      }}
    >
      {/* Designer label */}
      {designMode && label && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            backgroundColor: 'rgba(59,130,246,0.1)',
            borderBottom: '1px dashed #3b82f6',
            borderRight: '1px dashed #3b82f6',
            fontSize: '9px',
            color: '#3b82f6',
            padding: '1px 4px',
            zIndex: 999,
            pointerEvents: 'none',
          }}
        >
          {label}
        </div>
      )}

      {/* Elements */}
      {band.elements.map(el => (
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
