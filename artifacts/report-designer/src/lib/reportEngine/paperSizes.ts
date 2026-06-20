// ─── Paper Size Definitions ────────────────────────────────────────────────────
// All dimensions in mm.

import type { PaperSize, Orientation } from './types';

export interface PaperDimensions {
  width: number;   // mm
  height: number;  // mm (0 = auto/continuous)
  label: string;
  thermal: boolean;
}

export const PAPER_SIZES: Record<PaperSize, PaperDimensions> = {
  A4: { width: 210, height: 297, label: 'A4 (210 × 297 mm)', thermal: false },
  A5: { width: 148, height: 210, label: 'A5 (148 × 210 mm)', thermal: false },
  '80mm': { width: 80, height: 0, label: '80mm Thermal (continuous)', thermal: true },
  '58mm': { width: 58, height: 0, label: '58mm Thermal (continuous)', thermal: true },
};

export function getPaperDimensions(size: PaperSize, orientation: Orientation): { width: number; height: number } {
  const dims = PAPER_SIZES[size];
  if (dims.thermal) return { width: dims.width, height: dims.height };
  if (orientation === 'landscape') {
    return { width: dims.height, height: dims.width };
  }
  return { width: dims.width, height: dims.height };
}

// 1mm = 3.7795px at 96dpi
export const MM_TO_PX = 3.7795;

export function mmToPx(mm: number): number {
  return mm * MM_TO_PX;
}

export function pxToMm(px: number): number {
  return px / MM_TO_PX;
}
