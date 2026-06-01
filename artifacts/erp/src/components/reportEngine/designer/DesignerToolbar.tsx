import { Link } from "wouter";
import {
  ArrowLeft, Save, Eye, ZoomIn, ZoomOut, RotateCcw,
  FileBarChart2, Loader2,
} from "lucide-react";
import type { PaperSize, Orientation } from "@/lib/reportEngine/types";
import { REPORT_TYPES } from "@/lib/reportEngine/types";
import { PAPER_SIZES } from "@/lib/reportEngine/paperSizes";

interface Props {
  name: string;
  reportType: string;
  paperSize: PaperSize;
  orientation: Orientation;
  zoom: number;
  isSaving: boolean;
  isDirty: boolean;
  templateId: number | null;
  onNameChange: (v: string) => void;
  onReportTypeChange: (v: string) => void;
  onPaperSizeChange: (v: PaperSize) => void;
  onOrientationChange: (v: Orientation) => void;
  onZoomChange: (v: number) => void;
  onSave: () => void;
  onUndo: () => void;
  canUndo: boolean;
}

export default function DesignerToolbar({
  name, reportType, paperSize, orientation, zoom,
  isSaving, isDirty, templateId,
  onNameChange, onReportTypeChange, onPaperSizeChange,
  onOrientationChange, onZoomChange, onSave, onUndo, canUndo,
}: Props) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-gray-900 text-white border-b border-gray-700 min-h-[48px] flex-shrink-0">
      {/* Back */}
      <Link href="/report-templates">
        <a className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors shrink-0">
          <ArrowLeft className="w-4 h-4" />
        </a>
      </Link>

      <div className="w-px h-5 bg-gray-700 shrink-0" />

      {/* Icon */}
      <FileBarChart2 className="w-4 h-4 text-blue-400 shrink-0" />

      {/* Template name */}
      <input
        value={name}
        onChange={e => onNameChange(e.target.value)}
        placeholder="Template name..."
        className="bg-gray-800 text-white text-sm px-2 py-1 rounded-md border border-gray-700 focus:border-blue-500 focus:outline-none w-44"
      />

      {isDirty && (
        <span className="text-[10px] text-amber-400 font-medium shrink-0">● Unsaved</span>
      )}

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

      {/* Orientation — only for non-thermal */}
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

      <div className="flex-1" />

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

      {/* Preview */}
      {templateId && (
        <Link href={`/report-templates/${templateId}/preview`}>
          <a
            target="_blank"
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-300 border border-gray-600 rounded-lg hover:bg-gray-700 transition-colors"
          >
            <Eye className="w-3.5 h-3.5" />
            Preview
          </a>
        </Link>
      )}

      {/* Save */}
      <button
        onClick={onSave}
        disabled={isSaving}
        className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-60"
      >
        {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
        Save
      </button>
    </div>
  );
}
