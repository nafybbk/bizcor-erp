import { useState, useCallback, useEffect, useRef } from "react";
import { useParams, useLocation } from "wouter";
import { toast } from "@/hooks/use-toast";
import DesignerPalette from "@/components/reportEngine/designer/DesignerPalette";
import DesignerCanvas from "@/components/reportEngine/designer/DesignerCanvas";
import DesignerProperties from "@/components/reportEngine/designer/DesignerProperties";
import StandaloneToolbar from "@/components/reportEngine/designer/StandaloneToolbar";
import type {
  TemplateElement, PaperSize, Orientation, Band,
  TemplateLayout, SavedTemplate, TableColumn,
} from "@/lib/reportEngine/types";
import { REPORT_TYPES } from "@/lib/reportEngine/types";
import { getPaperDimensions } from "@/lib/reportEngine/paperSizes";
import { loadStoredFolder, requestPermission, saveJsonToFolder, loadJsonFromFolder, pickFolder, openJsonFile, saveAsJsonFile } from "@/lib/fileSystem";
import type { FolderState, FolderHandle } from "@/lib/fileSystem";
import { Loader2, FolderOpen } from "lucide-react";

// ─── Exported types (used by DesignerCanvas) ──────────────────────────────────
export type BandKey = 'pageHeader' | 'documentHeader' | 'detail' | 'documentFooter' | 'pageFooter';

export interface BandState {
  height: number;
  visible: boolean;
  backgroundColor?: string;
  elements: TemplateElement[];
}

export interface DesignerBandsState {
  pageHeader:      BandState;
  documentHeader:  BandState;
  detail:          { visible: boolean; elements: TemplateElement[]; designerHeight: number };
  documentFooter:  BandState;
  pageFooter:      BandState;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
let _uid = 2000;
function uid(): string { return `el_${++_uid}_${Date.now().toString(36)}`; }

const DEFAULT_MARGIN = { top: 10, right: 10, bottom: 10, left: 10 };

function defaultBands(contentW: number): DesignerBandsState {
  return {
    pageHeader: {
      height: 25, visible: true,
      elements: [
        { id: uid(), type: 'image',  x: 0,   y: 0,  width: 25, height: 20, source: 'company_logo', objectFit: 'contain' },
        { id: uid(), type: 'field',  x: 28,  y: 1,  width: contentW - 28, height: 10, field: 'company_name',
          style: { fontSize: 16, fontWeight: 'bold', color: '#1e3a5f' } },
        { id: uid(), type: 'field',  x: 28,  y: 13, width: contentW - 28, height: 6,  field: 'company_address',
          style: { fontSize: 8, color: '#555555' } },
        { id: uid(), type: 'field',  x: 28,  y: 20, width: contentW / 2,  height: 5,  field: 'company_gstin',
          style: { fontSize: 8, color: '#777' } },
        { id: uid(), type: 'text',   x: contentW - 40, y: 1, width: 40, height: 5, content: 'TAX INVOICE',
          style: { fontSize: 10, fontWeight: 'bold', textAlign: 'right', color: '#1e3a5f' } },
      ],
    },
    documentHeader: {
      height: 50, visible: true,
      elements: [
        { id: uid(), type: 'field', x: 0, y: 0, width: contentW / 2 - 2, height: 6,  field: 'party_name',
          style: { fontSize: 10, fontWeight: 'bold' } },
        { id: uid(), type: 'field', x: 0, y: 8, width: contentW / 2 - 2, height: 12, field: 'party_address',
          style: { fontSize: 8, color: '#555' } },
        { id: uid(), type: 'field', x: 0, y: 22, width: contentW / 2 - 2, height: 6, field: 'party_gstin',
          style: { fontSize: 8 }, nullText: '' },
        { id: uid(), type: 'text',  x: contentW / 2 + 2, y: 0,  width: 25, height: 5, content: 'Invoice #:',
          style: { fontSize: 8, fontWeight: 'bold', color: '#555' } },
        { id: uid(), type: 'field', x: contentW / 2 + 28, y: 0, width: contentW / 2 - 30, height: 5, field: 'invoice_number',
          style: { fontSize: 8 } },
        { id: uid(), type: 'text',  x: contentW / 2 + 2, y: 7, width: 25, height: 5, content: 'Date:',
          style: { fontSize: 8, fontWeight: 'bold', color: '#555' } },
        { id: uid(), type: 'field', x: contentW / 2 + 28, y: 7, width: contentW / 2 - 30, height: 5, field: 'invoice_date',
          format: 'DD-MM-YYYY', style: { fontSize: 8 } },
        { id: uid(), type: 'line',  x: 0, y: 33, width: contentW, height: 0.5, direction: 'horizontal', color: '#ccc', thickness: 0.3 },
      ],
    },
    detail: {
      visible: true, designerHeight: 80,
      elements: [{
        id: uid(), type: 'table', x: 0, y: 0, width: contentW, height: 80,
        dataSource: 'items', showHeader: true, headerHeight: 8, rowHeight: 8, emptyRows: 0,
        columns: [
          { id: uid(), field: 'sr_no',     label: '#',      width: 8,             align: 'center' },
          { id: uid(), field: 'item_name', label: 'Item',   width: contentW - 66, align: 'left'   },
          { id: uid(), field: 'quantity',  label: 'Qty',    width: 18,            align: 'center' },
          { id: uid(), field: 'rate',      label: 'Rate',   width: 20,            align: 'right'  },
          { id: uid(), field: 'total',     label: 'Amount', width: 20,            align: 'right'  },
        ],
      }],
    },
    documentFooter: {
      height: 65, visible: true,
      elements: [
        { id: uid(), type: 'line',  x: 0, y: 0,  width: contentW, height: 0.5, direction: 'horizontal', color: '#ccc', thickness: 0.3 },
        { id: uid(), type: 'text',  x: contentW - 50, y: 4,  width: 28, height: 5, content: 'Taxable:',
          style: { fontSize: 8, textAlign: 'right', color: '#555' } },
        { id: uid(), type: 'field', x: contentW - 22, y: 4,  width: 22, height: 5, field: 'taxable_amount',
          style: { fontSize: 8, textAlign: 'right' } },
        { id: uid(), type: 'text',  x: contentW - 50, y: 11, width: 28, height: 5, content: 'GST:',
          style: { fontSize: 8, textAlign: 'right', color: '#555' } },
        { id: uid(), type: 'field', x: contentW - 22, y: 11, width: 22, height: 5, field: 'total_tax',
          style: { fontSize: 8, textAlign: 'right' } },
        { id: uid(), type: 'text',  x: contentW - 50, y: 19, width: 28, height: 7, content: 'Grand Total:',
          style: { fontSize: 10, fontWeight: 'bold', textAlign: 'right' } },
        { id: uid(), type: 'field', x: contentW - 22, y: 19, width: 22, height: 7, field: 'grand_total',
          style: { fontSize: 10, fontWeight: 'bold', textAlign: 'right' } },
        { id: uid(), type: 'line',  x: 0, y: 29, width: contentW, height: 0.5, direction: 'horizontal', color: '#ccc', thickness: 0.3 },
        { id: uid(), type: 'text',  x: 0, y: 33, width: 20, height: 5, content: 'In Words:',
          style: { fontSize: 8, fontWeight: 'bold', color: '#555' } },
        { id: uid(), type: 'field', x: 22, y: 33, width: contentW - 22, height: 5, field: 'amount_in_words',
          style: { fontSize: 8, fontStyle: 'italic' } },
        { id: uid(), type: 'text',  x: contentW - 35, y: 50, width: 35, height: 10, content: 'Authorised Signatory',
          style: { fontSize: 8, textAlign: 'center', color: '#555' } },
      ],
    },
    pageFooter: {
      height: 8, visible: true,
      elements: [
        { id: uid(), type: 'line',    x: 0, y: 0, width: contentW, height: 0.5, direction: 'horizontal', color: '#ccc', thickness: 0.3 },
        { id: uid(), type: 'text',   x: 0, y: 2, width: contentW / 2, height: 5, content: 'BizCor ERP',
          style: { fontSize: 7, color: '#aaa' } },
        { id: uid(), type: 'formula', x: contentW - 30, y: 2, width: 30, height: 5, formula: '"Page " & {page_number} & " of " & {total_pages}',
          style: { fontSize: 7, color: '#aaa', textAlign: 'right' } },
      ],
    },
  };
}

function bandsToLayout(bands: DesignerBandsState, margin: typeof DEFAULT_MARGIN): TemplateLayout {
  return {
    margin,
    bands: {
      pageHeader:     { height: bands.pageHeader.height,     visible: bands.pageHeader.visible,     elements: bands.pageHeader.elements     },
      documentHeader: { height: bands.documentHeader.height, visible: bands.documentHeader.visible, elements: bands.documentHeader.elements },
      detail:         { visible: bands.detail.visible,                                               elements: bands.detail.elements         },
      documentFooter: { height: bands.documentFooter.height, visible: bands.documentFooter.visible, elements: bands.documentFooter.elements },
      pageFooter:     { height: bands.pageFooter.height,     visible: bands.pageFooter.visible,     elements: bands.pageFooter.elements     },
    },
  };
}

function layoutToBands(layout: TemplateLayout): DesignerBandsState {
  const b = layout.bands;
  return {
    pageHeader:     { height: (b.pageHeader as Band).height || 25,     visible: b.pageHeader.visible     ?? true, elements: b.pageHeader.elements     },
    documentHeader: { height: (b.documentHeader as Band).height || 50, visible: b.documentHeader.visible ?? true, elements: b.documentHeader.elements },
    detail:         { visible: b.detail.visible ?? true, elements: b.detail.elements, designerHeight: 80 },
    documentFooter: { height: (b.documentFooter as Band).height || 65, visible: b.documentFooter.visible ?? true, elements: b.documentFooter.elements },
    pageFooter:     { height: (b.pageFooter as Band).height || 8,      visible: b.pageFooter.visible     ?? true, elements: b.pageFooter.elements     },
  };
}

function defaultElementForType(type: TemplateElement['type'], x: number, y: number, contentW: number, fieldKey?: string): TemplateElement {
  const base = { id: uid(), x, y };
  switch (type) {
    case 'text':    return { ...base, type, content: 'Label', width: 40, height: 8, style: { fontSize: 10 } };
    case 'field':   return { ...base, type, field: fieldKey ?? 'company_name', width: 50, height: 8, style: { fontSize: 10 } };
    case 'formula': return { ...base, type, formula: '{grand_total}', width: 30, height: 8, style: { fontSize: 10 } };
    case 'image':   return { ...base, type, source: 'company_logo', width: 30, height: 20, objectFit: 'contain' as const };
    case 'line':    return { ...base, type, direction: 'horizontal' as const, width: contentW || 100, height: 1, color: '#000', thickness: 0.3 };
    case 'box':     return { ...base, type, width: 40, height: 20, style: { border: '1px solid #000' } };
    case 'table': {
      const cols: TableColumn[] = [
        { id: uid(), field: 'item_name', label: 'Item',   width: Math.max(30, contentW - 40) },
        { id: uid(), field: 'quantity',  label: 'Qty',    width: 20, align: 'center' },
        { id: uid(), field: 'total',     label: 'Amount', width: 20, align: 'right'  },
      ];
      return { ...base, type, dataSource: 'items', columns: cols, showHeader: true, headerHeight: 8, rowHeight: 8, width: contentW || 100, height: 80 };
    }
    case 'qrcode':  return { ...base, type, content: '{invoice_number}', width: 20, height: 20 };
    default:        return { ...base, type: 'text', content: 'Text', width: 40, height: 8 } as TemplateElement;
  }
}

const MAX_UNDO = 15;

export default function Designer() {
  const { reportType: paramType } = useParams<{ reportType?: string }>();
  const [, navigate] = useLocation();

  const initialReportType = paramType || REPORT_TYPES[0].key;

  // ── Folder state ──────────────────────────────────────────────────────────
  const [folder, setFolder] = useState<FolderState>({ handle: null, name: null });
  const [folderLoading, setFolderLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isSavingAs, setIsSavingAs] = useState(false);
  const [isLoadingFile, setIsLoadingFile] = useState(false);
  const [savedToFile, setSavedToFile] = useState(false);

  // ── Template meta ─────────────────────────────────────────────────────────
  const [name, setName]               = useState('New Template');
  const [reportType, setReportType]   = useState(initialReportType);
  const [paperSize, setPaperSize]     = useState<PaperSize>('A4');
  const [orientation, setOrientation] = useState<Orientation>('portrait');
  const margin = DEFAULT_MARGIN;

  // ── Bands ─────────────────────────────────────────────────────────────────
  const [bands, setBands] = useState<DesignerBandsState | null>(null);

  // ── UI ────────────────────────────────────────────────────────────────────
  const [zoom, setZoom]         = useState(0.75);
  const [isDirty, setIsDirty]   = useState(false);
  const [snapToGrid, setSnapToGrid] = useState(true);
  const [gridSize, setGridSize]     = useState(2.5);

  // ── Selection ─────────────────────────────────────────────────────────────
  const [selectedBandKey, setSelectedBandKey]     = useState<BandKey | null>(null);
  const [selectedElementIds, setSelectedElementIds] = useState<string[]>([]);
  const [mode, setMode]       = useState<'select' | 'add'>('select');
  const [addingType, setAddingType]       = useState<TemplateElement['type'] | null>(null);
  const [addingFieldKey, setAddingFieldKey] = useState<string | null>(null);

  // ── Undo ──────────────────────────────────────────────────────────────────
  const undoStack = useRef<DesignerBandsState[]>([]);
  function pushUndo(current: DesignerBandsState) {
    undoStack.current = [...undoStack.current.slice(-MAX_UNDO), current];
  }
  function undo() {
    if (undoStack.current.length === 0) return;
    const prev = undoStack.current[undoStack.current.length - 1];
    undoStack.current = undoStack.current.slice(0, -1);
    setBands(prev);
    setIsDirty(true);
  }

  // ── Init: load stored folder + initialize bands ────────────────────────────
  useEffect(() => {
    loadStoredFolder().then(f => {
      setFolder(f);
      setFolderLoading(false);
    });
  }, []);

  useEffect(() => {
    const dims = getPaperDimensions(paperSize, orientation);
    const contentW = dims.width - margin.left - margin.right;
    setBands(defaultBands(contentW));
    setIsDirty(false);
    setSavedToFile(false);
    setSelectedBandKey(null);
    setSelectedElementIds([]);
  }, [reportType, paperSize, orientation]);

  // ── Auto-load file when folder + reportType ready ─────────────────────────
  useEffect(() => {
    if (!folder.handle || !reportType || !bands) return;
    const filename = `${reportType}.json`;
    setIsLoadingFile(true);
    loadJsonFromFolder(folder.handle, filename).then(data => {
      if (data) {
        try {
          const tmpl = data as SavedTemplate;
          const layout = typeof tmpl.layoutJson === 'string'
            ? JSON.parse(tmpl.layoutJson) as TemplateLayout
            : tmpl.layoutJson as unknown as TemplateLayout;
          setBands(layoutToBands(layout));
          if (tmpl.name) setName(tmpl.name);
          if (tmpl.paperSize) setPaperSize(tmpl.paperSize as PaperSize);
          if (tmpl.orientation) setOrientation(tmpl.orientation as Orientation);
          setSavedToFile(true);
          setIsDirty(false);
          toast({ title: `📂 ${filename} loaded`, description: 'File se template load ho gaya' });
        } catch {
          // invalid JSON, use default
        }
      }
      setIsLoadingFile(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [folder.handle, reportType]);

  // ── Folder selection ───────────────────────────────────────────────────────
  async function handlePickFolder() {
    const f = await pickFolder();
    if (f.handle) {
      setFolder(f);
      toast({ title: '📁 Folder set!', description: f.name || '' });
    }
  }

  // ── Open File — PC se koi bhi JSON template kholo ─────────────────────────
  async function handleOpenFile() {
    const result = await openJsonFile();
    if (!result) return;
    try {
      const tmpl = result.data as SavedTemplate;
      const layout = typeof tmpl.layoutJson === 'string'
        ? JSON.parse(tmpl.layoutJson) as TemplateLayout
        : tmpl.layoutJson as unknown as TemplateLayout;
      setBands(layoutToBands(layout));
      if (tmpl.name) setName(tmpl.name);
      if (tmpl.reportType) setReportType(tmpl.reportType);
      if (tmpl.paperSize) setPaperSize(tmpl.paperSize as PaperSize);
      if (tmpl.orientation) setOrientation(tmpl.orientation as Orientation);
      undoStack.current = [];
      setIsDirty(false);
      setSavedToFile(false);
      toast({ title: `📂 ${result.filename} khula!`, description: 'File load ho gayi — ab edit karo' });
    } catch {
      toast({ title: 'Load failed', description: 'Invalid template file', variant: 'destructive' });
    }
  }

  // ── Save As — koi bhi naam/location mein save karo ────────────────────────
  async function handleSaveAs() {
    if (!bands) return;
    setIsSavingAs(true);
    try {
      const layoutJson = bandsToLayout(bands, margin);
      const payload = {
        name,
        reportType,
        paperSize,
        orientation,
        version: 1,
        isDefault: true,
        layoutJson,
        updatedAt: new Date().toISOString(),
        _bizcor_file_template: true,
      };
      const ok = await saveAsJsonFile(payload, `${reportType}.json`);
      if (ok) {
        setSavedToFile(true);
        setIsDirty(false);
        toast({ title: '✅ Saved!', description: 'File save ho gayi' });
      }
    } catch (err: any) {
      toast({ title: 'Save failed', description: err?.message || 'Unknown error', variant: 'destructive' });
    } finally {
      setIsSavingAs(false);
    }
  }

  async function ensurePermission(): Promise<FolderHandle | null> {
    if (!folder.handle) return null;
    const ok = await requestPermission(folder.handle);
    return ok ? folder.handle : null;
  }

  // ── Save to file ───────────────────────────────────────────────────────────
  async function handleSaveToFile() {
    if (!bands) return;
    let handle = folder.handle;
    if (!handle) {
      const f = await pickFolder();
      if (!f.handle) return;
      setFolder(f);
      handle = f.handle;
    } else {
      const h = await ensurePermission();
      if (!h) {
        toast({ title: 'Permission denied', description: 'Folder access nahi mila', variant: 'destructive' });
        return;
      }
      handle = h;
    }

    setIsSaving(true);
    try {
      const layoutJson = bandsToLayout(bands, margin);
      const payload: SavedTemplate = {
        id: 0,
        name,
        reportType,
        paperSize,
        orientation,
        version: 1,
        isDefault: true,
        layoutJson: layoutJson as any,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        _bizcor_file_template: true,
      } as any;
      const filename = `${reportType}.json`;
      await saveJsonToFolder(handle, filename, payload);
      setSavedToFile(true);
      setIsDirty(false);
      toast({ title: '✅ Saved!', description: `${folder.name || 'Folder'}/${filename}` });
    } catch (err: any) {
      toast({ title: 'Save failed', description: err?.message || 'Unknown error', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  }

  // ── Band / element update helpers (same pattern as ERP) ───────────────────
  function updateBands(updater: (prev: DesignerBandsState) => DesignerBandsState) {
    setBands(prev => {
      if (!prev) return prev;
      pushUndo(prev);
      const next = updater(prev);
      setIsDirty(true);
      return next;
    });
  }

  function handleBandResize(bandKey: BandKey, newHeight: number) {
    if (bandKey === 'detail') return;
    updateBands(prev => ({ ...prev, [bandKey]: { ...(prev[bandKey] as BandState), height: newHeight } }));
  }

  function handleBandResizeDetail(newHeight: number) {
    updateBands(prev => ({ ...prev, detail: { ...prev.detail, designerHeight: newHeight } }));
  }

  function handleAddElement(bandKey: BandKey, x: number, y: number) {
    if (!addingType) return;
    const dims = getPaperDimensions(paperSize, orientation);
    const contentW = dims.width - margin.left - margin.right;
    const el = defaultElementForType(addingType, x, y, contentW, addingFieldKey || undefined);
    updateBands(prev => ({
      ...prev,
      [bandKey]: { ...(prev[bandKey] as any), elements: [...(prev[bandKey] as any).elements, el] },
    }));
    setMode('select');
    setAddingType(null);
    setAddingFieldKey(null);
    setSelectedBandKey(bandKey);
    setSelectedElementIds([el.id]);
  }

  function handleSelectElement(bandKey: BandKey, ids: string[]) {
    setSelectedBandKey(bandKey);
    setSelectedElementIds(ids);
  }

  function handleMoveElements(bandKey: BandKey, moves: { id: string; x: number; y: number }[]) {
    updateBands(prev => {
      const band = prev[bandKey] as any;
      const elements = band.elements.map((el: TemplateElement) => {
        const m = moves.find(mv => mv.id === el.id);
        return m ? { ...el, x: m.x, y: m.y } : el;
      });
      return { ...prev, [bandKey]: { ...band, elements } };
    });
  }

  function handleResizeElement(bandKey: BandKey, id: string, w: number, h: number) {
    updateBands(prev => {
      const band = prev[bandKey] as any;
      const elements = band.elements.map((el: TemplateElement) =>
        el.id === id ? { ...el, width: w, height: h } : el
      );
      return { ...prev, [bandKey]: { ...band, elements } };
    });
  }

  function handleUpdateElement(updated: TemplateElement) {
    if (!selectedBandKey) return;
    updateBands(prev => {
      const band = prev[selectedBandKey] as any;
      const elements = band.elements.map((el: TemplateElement) => el.id === updated.id ? updated : el);
      return { ...prev, [selectedBandKey]: { ...band, elements } };
    });
  }

  function handleDeleteSelected() {
    if (!selectedBandKey || selectedElementIds.length === 0) return;
    updateBands(prev => {
      const band = prev[selectedBandKey] as any;
      const elements = band.elements.filter((el: TemplateElement) => !selectedElementIds.includes(el.id));
      return { ...prev, [selectedBandKey]: { ...band, elements } };
    });
    setSelectedElementIds([]);
  }

  const selectedElements = selectedBandKey && bands
    ? (bands[selectedBandKey] as any).elements.filter((el: TemplateElement) => selectedElementIds.includes(el.id))
    : [];

  // ── Loading state ──────────────────────────────────────────────────────────
  if (folderLoading || !bands) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-900">
        <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-gray-900 overflow-hidden">
      <StandaloneToolbar
        name={name}
        reportType={reportType}
        paperSize={paperSize}
        orientation={orientation}
        zoom={zoom}
        snapToGrid={snapToGrid}
        gridSize={gridSize}
        isSaving={isSaving}
        isSavingAs={isSavingAs}
        savedToFile={savedToFile}
        isDirty={isDirty}
        folderName={folder.name}
        onNameChange={setName}
        onReportTypeChange={v => { setReportType(v); navigate(`/designer/${v}`); }}
        onPaperSizeChange={p => { setPaperSize(p); setIsDirty(true); }}
        onOrientationChange={o => { setOrientation(o); setIsDirty(true); }}
        onZoomChange={setZoom}
        onSnapToggle={() => setSnapToGrid(s => !s)}
        onGridSizeChange={setGridSize}
        onSave={handleSaveToFile}
        onSaveAs={handleSaveAs}
        onOpenFile={handleOpenFile}
        onPickFolder={handlePickFolder}
        onUndo={undo}
        canUndo={undoStack.current.length > 0}
        onBack={() => navigate('/')}
      />

      {/* No-folder banner */}
      {!folder.handle && (
        <div className="flex items-center gap-3 px-4 py-2 bg-amber-900/50 border-b border-amber-700 text-amber-300 text-sm shrink-0">
          <FolderOpen className="w-4 h-4 shrink-0" />
          <span>Save folder select nahi kiya — "📁 Folder" button se select karo taaki templates automatically save ho sakein</span>
        </div>
      )}

      {isLoadingFile && (
        <div className="flex items-center gap-2 px-4 py-1.5 bg-blue-900/40 border-b border-blue-700 text-blue-300 text-xs shrink-0">
          <Loader2 className="w-3 h-3 animate-spin" /> Loading file from folder…
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        <DesignerPalette
          mode={mode}
          addingType={addingType}
          addingFieldKey={addingFieldKey}
          onSelectMode={() => { setMode('select'); setAddingType(null); setAddingFieldKey(null); }}
          onAddMode={t => { setMode('add'); setAddingType(t); setAddingFieldKey(null); }}
          onAddFieldMode={k => { setMode('add'); setAddingType('field'); setAddingFieldKey(k); }}
        />

        <DesignerCanvas
          bands={bands}
          paperSize={paperSize}
          orientation={orientation}
          margin={margin}
          zoom={zoom}
          mode={mode}
          selectedBandKey={selectedBandKey}
          selectedElementIds={selectedElementIds}
          snapToGrid={snapToGrid}
          gridSize={gridSize}
          addingType={addingType}
          onSelectElements={handleSelectElement}
          onSelectBand={setSelectedBandKey}
          onPlaceElement={handleAddElement}
          onMoveElements={handleMoveElements}
          onResizeElement={handleResizeElement}
          onResizeBand={handleBandResize}
          onDeselectAll={() => { setSelectedBandKey(null); setSelectedElementIds([]); }}
        />

        <DesignerProperties
          elements={selectedElements}
          onUpdate={handleUpdateElement}
          onDelete={handleDeleteSelected}
        />
      </div>
    </div>
  );
}
