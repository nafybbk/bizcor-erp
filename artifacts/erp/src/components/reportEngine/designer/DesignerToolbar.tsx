import { Link } from "wouter";
import {
  ArrowLeft, Save, Eye, ZoomIn, ZoomOut, RotateCcw,
  FileBarChart2, Loader2, Grid3X3, Maximize2, Lock, Copy, BookmarkPlus,
} from "lucide-react";
import type { PaperSize, Orientation } from "@/lib/reportEngine/types";
import { REPORT_TYPES } from "@/lib/reportEngine/types";
import { PAPER_SIZES } from "@/lib/reportEngine/paperSizes";

type Margin = { top: number; right: number; bottom: number; left: number };

interface Props {
  name: string;
  locked: boolean;
  reportType: string;
  paperSize: PaperSize;
  orientation: Orientation;
  margin: Margin;
  zoom: number;
  snapToGrid: boolean;
  gridSize: number;
  isSaving: boolean;
  isDirty: boolean;
  templateId: number | null;
  onReportTypeChange: (v: string) => void;
  onPaperSizeChange: (v: PaperSize) => void;
  onOrientationChange: (v: Orientation) => void;
  onMarginChange: (m: Margin) => void;
  onZoomChange: (v: number) => void;
  onSnapToggle: () => void;
  onGridSizeChange: (v: number) => void;
  onSave: () => void;
  onSaveAsTemplate: () => void;
  onUseAsNew: () => void;
  onUndo: () => void;
  canUndo: boolean;
}

const GRID_SIZES = [
  { value: 1,   label: '1 mm' },
  { value: 2.5, label: '2.5 mm' },
  { value: 5,   label: '5 mm' },
];

export default function DesignerToolbar({
  name, locked, reportType, paperSize, orientation, margin, zoom,
  snapToGrid, gridSize,
  isSaving, isDirty, templateId,
  onReportTypeChange, onPaperSizeChange,
  onOrientationChange, onMarginChange, onZoomChange,
  onSnapToggle, onGridSizeChange,
  onSave, onSaveAsTemplate, onUseAsNew, onUndo, canUndo,
}: Props) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-gray-900 text-white border-b border-gray-700 min-h-[48px] flex-shrink-0 flex-wrap">
      {/* Back */}
      <Link href="/report-templates">
        <a className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors shrink-0">
          <ArrowLeft className="w-4 h-4" />
        </a>
      </Link>

      <div className="w-px h-5 bg-gray-700 shrink-0" />
      <FileBarChart2 className="w-4 h-4 text-blue-400 shrink-0" />

      {/* Name — auto-assigned server-side (SI../SIT../Default), never editable */}
      <span className="flex items-center gap-1.5 bg-gray-800 text-white text-sm px-2.5 py-1 rounded-md border border-gray-700 font-mono">
        {name}
        {locked && <Lock className="w-3 h-3 text-amber-400" />}
      </span>

      {isDirty && !locked && <span className="text-[10px] text-amber-400 font-medium shrink-0">● Unsaved</span>}
      {locked && <span className="text-[10px] text-amber-400 font-medium shrink-0">Locked — edit karke Save As Template ya Use as New karo</span>}

      <div className="w-px h-5 bg-gray-700 shrink-0" />

      {/* Report type */}
      <select
        value={reportType}
        onChange={e => onReportTypeChange(e.target.value)}
        className="bg-gray-800 text-white text-xs px-2 py-1 rounded-md border border-gray-700 focus:border-blue-500 focus:outline-none max-w-[140px]"
      >
        {REPORT_TYPES.map(rt => (
          <option key={rt.key} value={rt.key}>{rt.label}</option>
        ))}
      </select>

      {/* Paper size */}
      <select
        value={paperSize}
        onChange={e => onPaperSizeChange(e.target.value as PaperSize)}
        className="bg-gray-800 text-white text-xs px-2 py-1 rounded-md border border-gray-700 focus:border-blue-500 focus:outline-none"
      >
        {Object.entries(PAPER_SIZES).map(([k, v]) => (
          <option key={k} value={k}>{v.label}</option>
        ))}
      </select>

      {/* Orientation */}
      {paperSize !== '80mm' && paperSize !== '58mm' && (
        <div className="flex rounded-md overflow-hidden border border-gray-700">
          <button
            onClick={() => onOrientationChange('portrait')}
            className={`px-2 py-1 text-xs transition-colors ${orientation === 'portrait' ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}`}
          >
            Portrait
          </button>
          <button
            onClick={() => onOrientationChange('landscape')}
            className={`px-2 py-1 text-xs transition-colors ${orientation === 'landscape' ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}`}
          >
            Landscape
          </button>
        </div>
      )}

      {/* Print margins (mm) — saved with the template; the printed page always
          fills exactly up to these, leftover space absorbed by the item area */}
      <div className="flex items-center gap-1" title="Print margins (mm) — Top / Right / Bottom / Left">
        <span className="text-[10px] uppercase tracking-wide text-gray-500">Margin</span>
        {(['top', 'right', 'bottom', 'left'] as const).map(side => (
          <div key={side} className="flex items-center">
            <span className="text-[9px] text-gray-500 uppercase pr-0.5">{side[0]}</span>
            <input
              type="number" min={0} max={40} step={1}
              value={margin[side]}
              title={`${side} margin (mm)`}
              onChange={e => onMarginChange({ ...margin, [side]: Math.min(40, Math.max(0, Number(e.target.value) || 0)) })}
              className="w-10 bg-gray-800 border border-gray-700 rounded px-1 py-0.5 text-xs text-gray-200 focus:border-blue-500 focus:outline-none"
            />
          </div>
        ))}
      </div>

      <div className="flex-1" />

      {/* Snap to Grid toggle */}
      <div className="flex items-center gap-1.5">
        <button
          onClick={onSnapToggle}
          title="Snap to Grid"
          className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-lg border transition-colors ${
            snapToGrid
              ? 'bg-purple-700 border-purple-600 text-white'
              : 'bg-gray-800 border-gray-700 text-gray-400 hover:text-white'
          }`}
        >
          <Grid3X3 className="w-3.5 h-3.5" />
          <span>Snap</span>
        </button>
        {snapToGrid && (
          <select
            value={gridSize}
            onChange={e => onGridSizeChange(parseFloat(e.target.value))}
            className="bg-gray-800 border border-gray-700 text-xs text-gray-300 rounded-md px-1.5 py-1 focus:outline-none focus:border-purple-500"
          >
            {GRID_SIZES.map(g => (
              <option key={g.value} value={g.value}>{g.label}</option>
            ))}
          </select>
        )}
      </div>

      <div className="w-px h-5 bg-gray-700 shrink-0" />

      {/* Zoom */}
      <div className="flex items-center gap-1">
        <button
          onClick={() => onZoomChange(Math.max(0.3, +(zoom - 0.1).toFixed(1)))}
          className="p-1 text-gray-400 hover:text-white hover:bg-gray-700 rounded transition-colors"
        >
          <ZoomOut className="w-3.5 h-3.5" />
        </button>
        <span className="text-xs text-gray-400 w-9 text-center">{Math.round(zoom * 100)}%</span>
        <button
          onClick={() => onZoomChange(Math.min(1.5, +(zoom + 0.1).toFixed(1)))}
          className="p-1 text-gray-400 hover:text-white hover:bg-gray-700 rounded transition-colors"
        >
          <ZoomIn className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="w-px h-5 bg-gray-700 shrink-0" />

      {/* Undo */}
      <button
        onClick={onUndo}
        disabled={!canUndo}
        title="Undo (Ctrl+Z)"
        className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
      >
        <RotateCcw className="w-4 h-4" />
      </button>

      {/* Pop Out */}
      <button
        onClick={() => window.open(window.location.href, '_blank', 'width=1600,height=960,menubar=no,toolbar=no,location=no,status=no,scrollbars=yes,resizable=yes')}
        title="Naye window mein kholo (full screen ke liye)"
        className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors shrink-0"
      >
        <Maximize2 className="w-4 h-4" />
      </button>

      {/* Preview */}
      {templateId && (
        <Link href={`/report-templates/${templateId}/preview`}>
          <a target="_blank" className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-300 border border-gray-600 rounded-lg hover:bg-gray-700 transition-colors">
            <Eye className="w-3.5 h-3.5" />
            Preview
          </a>
        </Link>
      )}

      {/* Use as New — only meaningful when viewing a locked (SIT../Default) row */}
      {locked && templateId && (
        <button
          onClick={onUseAsNew}
          disabled={isSaving}
          title="Iski content se ek naya editable SI.. bana lo"
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors disabled:opacity-60"
        >
          {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Copy className="w-3.5 h-3.5" />}
          Use as New
        </button>
      )}

      {/* Save As Template — freezes the live canvas as a new, immutable SIT.. */}
      <button
        onClick={onSaveAsTemplate}
        disabled={isSaving}
        title="Isko permanent, kabhi-na-badalne-wala template bana do (naya SIT.. banega)"
        className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-amber-600 hover:bg-amber-700 text-white rounded-lg transition-colors disabled:opacity-60"
      >
        {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <BookmarkPlus className="w-3.5 h-3.5" />}
        Save As Template
      </button>

      {/* Save to DB — only for unlocked working reports */}
      {!locked && (
        <button
          onClick={onSave}
          disabled={isSaving}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-60"
        >
          {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
          Save
        </button>
      )}
    </div>
  );
}
