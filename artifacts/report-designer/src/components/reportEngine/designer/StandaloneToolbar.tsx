import {
  ArrowLeft, Save, ZoomIn, ZoomOut, RotateCcw,
  FileBarChart2, Loader2, Grid3X3, Maximize2, FolderOpen, CheckCircle2,
  FolderInput, SaveAll,
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
  snapToGrid: boolean;
  gridSize: number;
  isSaving: boolean;
  isSavingAs: boolean;
  savedToFile: boolean;
  isDirty: boolean;
  folderName: string | null;
  onNameChange: (v: string) => void;
  onReportTypeChange: (v: string) => void;
  onPaperSizeChange: (v: PaperSize) => void;
  onOrientationChange: (v: Orientation) => void;
  onZoomChange: (v: number) => void;
  onSnapToggle: () => void;
  onGridSizeChange: (v: number) => void;
  onSave: () => void;
  onSaveAs: () => void;
  onOpenFile: () => void;
  onPickFolder: () => void;
  onUndo: () => void;
  canUndo: boolean;
  onBack: () => void;
}

const GRID_SIZES = [
  { value: 1,   label: '1 mm' },
  { value: 2.5, label: '2.5 mm' },
  { value: 5,   label: '5 mm' },
];

export default function StandaloneToolbar({
  name, reportType, paperSize, orientation, zoom,
  snapToGrid, gridSize,
  isSaving, isSavingAs, savedToFile, isDirty, folderName,
  onNameChange, onReportTypeChange, onPaperSizeChange,
  onOrientationChange, onZoomChange,
  onSnapToggle, onGridSizeChange,
  onSave, onSaveAs, onOpenFile, onPickFolder, onUndo, canUndo, onBack,
}: Props) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-gray-900 text-white border-b border-gray-700 min-h-[48px] flex-shrink-0 flex-wrap">
      {/* Back */}
      <button
        onClick={onBack}
        className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors shrink-0"
        title="Home pe jao"
      >
        <ArrowLeft className="w-4 h-4" />
      </button>

      <div className="w-px h-5 bg-gray-700 shrink-0" />
      <FileBarChart2 className="w-4 h-4 text-blue-400 shrink-0" />

      {/* Template name */}
      <input
        value={name}
        onChange={e => onNameChange(e.target.value)}
        placeholder="Template name..."
        className="bg-gray-800 text-white text-sm px-2 py-1 rounded-md border border-gray-700 focus:border-blue-500 focus:outline-none w-44"
      />

      {isDirty && <span className="text-[10px] text-amber-400 font-medium shrink-0">● Unsaved</span>}

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
          >Portrait</button>
          <button
            onClick={() => onOrientationChange('landscape')}
            className={`px-2 py-1 text-xs transition-colors ${orientation === 'landscape' ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}`}
          >Landscape</button>
        </div>
      )}

      <div className="flex-1" />

      {/* Snap to Grid */}
      <div className="flex items-center gap-1.5">
        <button
          onClick={onSnapToggle}
          title="Snap to Grid"
          className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-lg border transition-colors ${
            snapToGrid ? 'bg-purple-700 border-purple-600 text-white' : 'bg-gray-800 border-gray-700 text-gray-400 hover:text-white'
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
        ><ZoomOut className="w-3.5 h-3.5" /></button>
        <span className="text-xs text-gray-400 w-9 text-center">{Math.round(zoom * 100)}%</span>
        <button
          onClick={() => onZoomChange(Math.min(1.5, +(zoom + 0.1).toFixed(1)))}
          className="p-1 text-gray-400 hover:text-white hover:bg-gray-700 rounded transition-colors"
        ><ZoomIn className="w-3.5 h-3.5" /></button>
      </div>

      <div className="w-px h-5 bg-gray-700 shrink-0" />

      {/* Undo */}
      <button
        onClick={onUndo}
        disabled={!canUndo}
        title="Undo (Ctrl+Z)"
        className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
      ><RotateCcw className="w-4 h-4" /></button>

      {/* Pop-out */}
      <button
        onClick={() => window.open(window.location.href, '_blank', 'width=1600,height=960,menubar=no,toolbar=no')}
        title="Naye window mein kholo"
        className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors shrink-0"
      ><Maximize2 className="w-4 h-4" /></button>

      <div className="w-px h-5 bg-gray-700 shrink-0" />

      {/* Open File */}
      <button
        onClick={onOpenFile}
        title="PC se koi bhi JSON template file kholo"
        className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-lg border border-gray-600 text-gray-300 hover:bg-gray-700 transition-colors shrink-0"
      >
        <FolderInput className="w-3.5 h-3.5" />
        Open File
      </button>

      {/* Quick-save folder */}
      <button
        onClick={onPickFolder}
        title="Default folder — ek baar set karo (quick save ke liye)"
        className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-lg border border-gray-600 text-gray-300 hover:bg-gray-700 transition-colors shrink-0"
      >
        <FolderOpen className="w-3.5 h-3.5" />
        {folderName
          ? <span className="max-w-[80px] truncate text-green-400">{folderName}</span>
          : <span>Folder</span>
        }
      </button>

      {/* Save As — main action */}
      <button
        onClick={onSaveAs}
        disabled={isSavingAs}
        title="Koi bhi naam/location mein save karo"
        className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-60"
      >
        {isSavingAs ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <SaveAll className="w-3.5 h-3.5" />}
        Save As…
      </button>

      {/* Quick Save (to default folder) */}
      {folderName && (
        <button
          onClick={onSave}
          disabled={isSaving}
          title={`Default folder mein save karo: ${reportType}.json`}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors disabled:opacity-60 ${
            savedToFile && !isDirty
              ? 'bg-green-600 hover:bg-green-700 text-white'
              : 'bg-gray-700 hover:bg-gray-600 text-green-300 border border-green-700'
          }`}
        >
          {isSaving
            ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
            : savedToFile && !isDirty
            ? <CheckCircle2 className="w-3.5 h-3.5" />
            : <Save className="w-3.5 h-3.5" />
          }
          {savedToFile && !isDirty ? 'Saved ✓' : 'Quick Save'}
        </button>
      )}
    </div>
  );
}
