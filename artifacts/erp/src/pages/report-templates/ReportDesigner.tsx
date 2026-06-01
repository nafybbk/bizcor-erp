import { useState, useCallback, useEffect, useRef } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { toast } from "@/hooks/use-toast";
import DesignerToolbar from "@/components/reportEngine/designer/DesignerToolbar";
import DesignerPalette from "@/components/reportEngine/designer/DesignerPalette";
import DesignerCanvas from "@/components/reportEngine/designer/DesignerCanvas";
import DesignerProperties from "@/components/reportEngine/designer/DesignerProperties";
import type {
  TemplateElement, PaperSize, Orientation, Band, DetailBand,
  TemplateLayout, SavedTemplate, TableColumn,
} from "@/lib/reportEngine/types";
import { REPORT_TYPES } from "@/lib/reportEngine/types";
import { getPaperDimensions } from "@/lib/reportEngine/paperSizes";
import { Loader2 } from "lucide-react";

// ─── Exported types (imported by DesignerCanvas) ──────────────────────────────
export type BandKey = 'pageHeader' | 'documentHeader' | 'detail' | 'documentFooter' | 'pageFooter';

export interface BandState {
  height: number;
  visible: boolean;
  backgroundColor?: string;
  elements: TemplateElement[];
}

export interface DesignerBandsState {
  pageHeader: BandState;
  documentHeader: BandState;
  detail: { visible: boolean; elements: TemplateElement[]; designerHeight: number };
  documentFooter: BandState;
  pageFooter: BandState;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
let _uid = 1000;
function uid(): string {
  return `el_${++_uid}_${Date.now().toString(36)}`;
}

const DEFAULT_MARGIN = { top: 10, right: 10, bottom: 10, left: 10 };

function defaultBands(paperW: number, contentW: number): DesignerBandsState {
  const tableEl: TemplateElement = {
    id: uid(),
    type: 'table',
    x: 0,
    y: 0,
    width: contentW,
    height: 80,
    dataSource: 'items',
    showHeader: true,
    headerHeight: 8,
    rowHeight: 8,
    emptyRows: 0,
    columns: [
      { id: `col_${uid()}`, field: 'sr_no',        label: '#',       width: 8,  align: 'center' },
      { id: `col_${uid()}`, field: 'item_name',    label: 'Item',    width: contentW - 8 - 18 - 18 - 20, align: 'left' },
      { id: `col_${uid()}`, field: 'quantity',     label: 'Qty',     width: 18, align: 'center' },
      { id: `col_${uid()}`, field: 'rate',         label: 'Rate',    width: 18, align: 'right' },
      { id: `col_${uid()}`, field: 'total',        label: 'Amount',  width: 20, align: 'right' },
    ],
  };

  return {
    pageHeader: {
      height: 25,
      visible: true,
      elements: [
        {
          id: uid(), type: 'image', x: 0, y: 0, width: 25, height: 20,
          source: 'company_logo', objectFit: 'contain',
        },
        {
          id: uid(), type: 'field', x: 28, y: 1, width: contentW - 28, height: 10,
          field: 'company_name',
          style: { fontSize: 16, fontWeight: 'bold', textAlign: 'left', color: '#1e3a5f' },
        },
        {
          id: uid(), type: 'field', x: 28, y: 13, width: contentW - 28, height: 6,
          field: 'company_address',
          style: { fontSize: 8, textAlign: 'left', color: '#555555' },
        },
        {
          id: uid(), type: 'text', x: contentW - 40, y: 1, width: 40, height: 5,
          content: 'TAX INVOICE',
          style: { fontSize: 10, fontWeight: 'bold', textAlign: 'right', color: '#1e3a5f' },
        },
      ],
    },
    documentHeader: {
      height: 50,
      visible: true,
      elements: [
        {
          id: uid(), type: 'field', x: 0, y: 0, width: contentW / 2 - 2, height: 6,
          field: 'party_name',
          style: { fontSize: 10, fontWeight: 'bold', textAlign: 'left' },
        },
        {
          id: uid(), type: 'field', x: 0, y: 8, width: contentW / 2 - 2, height: 12,
          field: 'party_address',
          style: { fontSize: 8, textAlign: 'left', color: '#555555' },
        },
        {
          id: uid(), type: 'field', x: 0, y: 22, width: contentW / 2 - 2, height: 6,
          field: 'party_gstin',
          style: { fontSize: 8, textAlign: 'left' },
          nullText: '',
        },
        {
          id: uid(), type: 'text', x: contentW / 2 + 2, y: 0, width: 25, height: 5,
          content: 'Invoice #:',
          style: { fontSize: 8, fontWeight: 'bold', textAlign: 'left', color: '#555' },
        },
        {
          id: uid(), type: 'field', x: contentW / 2 + 28, y: 0, width: contentW / 2 - 30, height: 5,
          field: 'invoice_number',
          style: { fontSize: 8, textAlign: 'left' },
        },
        {
          id: uid(), type: 'text', x: contentW / 2 + 2, y: 7, width: 25, height: 5,
          content: 'Date:',
          style: { fontSize: 8, fontWeight: 'bold', textAlign: 'left', color: '#555' },
        },
        {
          id: uid(), type: 'field', x: contentW / 2 + 28, y: 7, width: contentW / 2 - 30, height: 5,
          field: 'invoice_date',
          format: 'DD-MM-YYYY',
          style: { fontSize: 8, textAlign: 'left' },
        },
        {
          id: uid(), type: 'text', x: contentW / 2 + 2, y: 14, width: 25, height: 5,
          content: 'Place of Supply:',
          style: { fontSize: 8, fontWeight: 'bold', textAlign: 'left', color: '#555' },
        },
        {
          id: uid(), type: 'field', x: contentW / 2 + 28, y: 14, width: contentW / 2 - 30, height: 5,
          field: 'place_of_supply',
          style: { fontSize: 8, textAlign: 'left' },
        },
        {
          id: uid(), type: 'line', x: 0, y: 32, width: contentW, height: 0.5,
          direction: 'horizontal', color: '#cccccc', thickness: 0.3,
        },
      ],
    },
    detail: {
      visible: true,
      designerHeight: 80,
      elements: [tableEl],
    },
    documentFooter: {
      height: 65,
      visible: true,
      elements: [
        {
          id: uid(), type: 'line', x: 0, y: 0, width: contentW, height: 0.5,
          direction: 'horizontal', color: '#cccccc', thickness: 0.3,
        },
        {
          id: uid(), type: 'text', x: contentW - 50, y: 4, width: 28, height: 5,
          content: 'Taxable Amount:',
          style: { fontSize: 8, textAlign: 'right', color: '#555' },
        },
        {
          id: uid(), type: 'field', x: contentW - 22, y: 4, width: 22, height: 5,
          field: 'taxable_amount',
          style: { fontSize: 8, textAlign: 'right' },
        },
        {
          id: uid(), type: 'text', x: contentW - 50, y: 11, width: 28, height: 5,
          content: 'GST:',
          style: { fontSize: 8, textAlign: 'right', color: '#555' },
        },
        {
          id: uid(), type: 'field', x: contentW - 22, y: 11, width: 22, height: 5,
          field: 'total_tax',
          style: { fontSize: 8, textAlign: 'right' },
        },
        {
          id: uid(), type: 'text', x: contentW - 50, y: 19, width: 28, height: 7,
          content: 'Grand Total:',
          style: { fontSize: 10, fontWeight: 'bold', textAlign: 'right' },
        },
        {
          id: uid(), type: 'field', x: contentW - 22, y: 19, width: 22, height: 7,
          field: 'grand_total',
          style: { fontSize: 10, fontWeight: 'bold', textAlign: 'right' },
        },
        {
          id: uid(), type: 'line', x: 0, y: 29, width: contentW, height: 0.5,
          direction: 'horizontal', color: '#cccccc', thickness: 0.3,
        },
        {
          id: uid(), type: 'text', x: 0, y: 33, width: 20, height: 5,
          content: 'In Words:',
          style: { fontSize: 8, fontWeight: 'bold', color: '#555' },
        },
        {
          id: uid(), type: 'field', x: 22, y: 33, width: contentW - 22, height: 5,
          field: 'amount_in_words',
          style: { fontSize: 8, fontStyle: 'italic' },
        },
        {
          id: uid(), type: 'text', x: contentW - 35, y: 50, width: 35, height: 10,
          content: 'Authorised Signatory',
          style: { fontSize: 8, textAlign: 'center', color: '#555' },
        },
        {
          id: uid(), type: 'field', x: 0, y: 53, width: contentW / 2, height: 5,
          field: 'invoice_footer',
          style: { fontSize: 7, color: '#999', textAlign: 'left' },
        },
      ],
    },
    pageFooter: {
      height: 8,
      visible: true,
      elements: [
        {
          id: uid(), type: 'line', x: 0, y: 0, width: contentW, height: 0.5,
          direction: 'horizontal', color: '#cccccc', thickness: 0.3,
        },
        {
          id: uid(), type: 'text', x: 0, y: 2, width: contentW / 2, height: 5,
          content: 'BizCor ERP',
          style: { fontSize: 7, color: '#aaa', textAlign: 'left' },
        },
        {
          id: uid(), type: 'formula', x: contentW - 25, y: 2, width: 25, height: 5,
          formula: 'Page {page_number} of {total_pages}',
          style: { fontSize: 7, color: '#aaa', textAlign: 'right' },
        },
      ],
    },
  };
}

function bandsToLayout(bands: DesignerBandsState, margin: typeof DEFAULT_MARGIN): TemplateLayout {
  return {
    margin,
    bands: {
      pageHeader: { height: bands.pageHeader.height, visible: bands.pageHeader.visible, elements: bands.pageHeader.elements },
      documentHeader: { height: bands.documentHeader.height, visible: bands.documentHeader.visible, elements: bands.documentHeader.elements },
      detail: { visible: bands.detail.visible, elements: bands.detail.elements },
      documentFooter: { height: bands.documentFooter.height, visible: bands.documentFooter.visible, elements: bands.documentFooter.elements },
      pageFooter: { height: bands.pageFooter.height, visible: bands.pageFooter.visible, elements: bands.pageFooter.elements },
    },
  };
}

function layoutToBands(layout: TemplateLayout): DesignerBandsState {
  const b = layout.bands;
  return {
    pageHeader: { height: (b.pageHeader as Band).height || 25, visible: b.pageHeader.visible ?? true, elements: b.pageHeader.elements },
    documentHeader: { height: (b.documentHeader as Band).height || 50, visible: b.documentHeader.visible ?? true, elements: b.documentHeader.elements },
    detail: { visible: b.detail.visible ?? true, elements: b.detail.elements, designerHeight: 80 },
    documentFooter: { height: (b.documentFooter as Band).height || 65, visible: b.documentFooter.visible ?? true, elements: b.documentFooter.elements },
    pageFooter: { height: (b.pageFooter as Band).height || 8, visible: b.pageFooter.visible ?? true, elements: b.pageFooter.elements },
  };
}

function defaultElementForType(type: TemplateElement['type'], x: number, y: number, contentW: number): TemplateElement {
  const base = { id: uid(), x, y };
  switch (type) {
    case 'text':    return { ...base, type: 'text',    content: 'Label', width: 40, height: 8, style: { fontSize: 10 } };
    case 'field':   return { ...base, type: 'field',   field: 'company_name', width: 50, height: 8, style: { fontSize: 10 } };
    case 'formula': return { ...base, type: 'formula', formula: '{grand_total}', width: 30, height: 8, style: { fontSize: 10 } };
    case 'image':   return { ...base, type: 'image',   source: 'company_logo', width: 30, height: 20, objectFit: 'contain' };
    case 'line':    return { ...base, type: 'line',    direction: 'horizontal', width: contentW || 100, height: 1, color: '#000000', thickness: 0.3 };
    case 'box':     return { ...base, type: 'box',     width: 40, height: 20, style: { border: '1px solid #000' } };
    case 'table': {
      const cols: TableColumn[] = [
        { id: uid(), field: 'item_name', label: 'Item',   width: Math.max(30, (contentW || 100) - 40) },
        { id: uid(), field: 'quantity',  label: 'Qty',    width: 20, align: 'center' },
        { id: uid(), field: 'total',     label: 'Amount', width: 20, align: 'right'  },
      ];
      return { ...base, type: 'table', dataSource: 'items', columns: cols, showHeader: true, headerHeight: 8, rowHeight: 8, width: contentW || 100, height: 80 };
    }
    case 'qrcode':  return { ...base, type: 'qrcode',  content: '{invoice_number}', width: 20, height: 20 };
    default:        return { ...base, type: 'text',    content: 'Text', width: 40, height: 8 } as TemplateElement;
  }
}

// ─── Main Component ───────────────────────────────────────────────────────────
const MAX_UNDO = 15;

export default function ReportDesigner() {
  const { id } = useParams<{ id?: string }>();
  const [, navigate] = useLocation();
  const qc = useQueryClient();
  const isNew = !id || id === 'new';

  // Meta
  const [name, setName] = useState('New Template');
  const [reportType, setReportType] = useState(REPORT_TYPES[0].key);
  const [paperSize, setPaperSize] = useState<PaperSize>('A4');
  const [orientation, setOrientation] = useState<Orientation>('portrait');
  const [margin, setMargin] = useState(DEFAULT_MARGIN);

  // Bands
  const [bands, setBands] = useState<DesignerBandsState | null>(null);

  // Selection & mode
  const [selectedBandKey, setSelectedBandKey] = useState<BandKey | null>(null);
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);
  const [mode, setMode] = useState<'select' | 'add'>('select');
  const [addingType, setAddingType] = useState<TemplateElement['type'] | null>(null);

  // Zoom
  const [zoom, setZoom] = useState(0.75);

  // Dirty / saving
  const [isSaving, setIsSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [savedId, setSavedId] = useState<number | null>(null);

  // Undo stack
  const undoStack = useRef<DesignerBandsState[]>([]);
  function pushUndo(current: DesignerBandsState) {
    undoStack.current = [current, ...undoStack.current].slice(0, MAX_UNDO);
  }

  // ─── Load existing template ────────────────────────────────────────────────
  const { data: template, isLoading } = useQuery<SavedTemplate>({
    queryKey: ['report-template', id],
    queryFn: () => api.get<SavedTemplate>(`/report-templates/${id}`),
    enabled: !isNew,
  });

  useEffect(() => {
    if (template) {
      setName(template.name);
      setReportType(template.reportType);
      setPaperSize(template.paperSize);
      setOrientation(template.orientation);
      setSavedId(template.id);
      if (template.layoutJson) {
        setBands(layoutToBands(template.layoutJson));
        if (template.layoutJson.margin) setMargin(template.layoutJson.margin);
      } else {
        const dims = getPaperDimensions(template.paperSize, template.orientation);
        const contentW = dims.width - DEFAULT_MARGIN.left - DEFAULT_MARGIN.right;
        setBands(defaultBands(dims.width, contentW));
      }
    }
  }, [template]);

  // Init default bands for new template
  useEffect(() => {
    if (isNew && !bands) {
      const dims = getPaperDimensions(paperSize, orientation);
      const contentW = dims.width - margin.left - margin.right;
      setBands(defaultBands(dims.width, contentW));
    }
  }, [isNew]);

  // ─── Paper dimensions ──────────────────────────────────────────────────────
  const paperDims = getPaperDimensions(paperSize, orientation);
  const contentW = paperDims.width - margin.left - margin.right;

  // ─── Undo ─────────────────────────────────────────────────────────────────
  function undo() {
    if (undoStack.current.length === 0) return;
    const [prev, ...rest] = undoStack.current;
    undoStack.current = rest;
    setBands(prev);
  }

  // Ctrl+Z
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        undo();
      }
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedElementId && selectedBandKey) {
        const target = e.target as HTMLElement;
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT') return;
        handleDeleteElement();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [selectedElementId, selectedBandKey, bands]);

  // ─── Band / element mutators ───────────────────────────────────────────────
  function updateBands(updater: (prev: DesignerBandsState) => DesignerBandsState) {
    setBands(prev => {
      if (!prev) return prev;
      pushUndo(prev);
      const next = updater(prev);
      setIsDirty(true);
      return next;
    });
  }

  function updateElementInBand(bandKey: BandKey, elementId: string, patch: Partial<TemplateElement>) {
    updateBands(prev => ({
      ...prev,
      [bandKey]: {
        ...prev[bandKey],
        elements: prev[bandKey].elements.map(el =>
          el.id === elementId ? { ...el, ...patch } as TemplateElement : el
        ),
      },
    }));
  }

  const handleMoveElement = useCallback((bandKey: BandKey, elementId: string, x: number, y: number) => {
    setBands(prev => {
      if (!prev) return prev;
      setIsDirty(true);
      return {
        ...prev,
        [bandKey]: {
          ...prev[bandKey],
          elements: prev[bandKey].elements.map(el =>
            el.id === elementId ? { ...el, x, y } as TemplateElement : el
          ),
        },
      };
    });
  }, []);

  const handleResizeElement = useCallback((bandKey: BandKey, elementId: string, w: number, h: number) => {
    setBands(prev => {
      if (!prev) return prev;
      setIsDirty(true);
      return {
        ...prev,
        [bandKey]: {
          ...prev[bandKey],
          elements: prev[bandKey].elements.map(el =>
            el.id === elementId ? { ...el, width: w, height: h } as TemplateElement : el
          ),
        },
      };
    });
  }, []);

  const handleResizeBand = useCallback((bandKey: BandKey, height: number) => {
    setBands(prev => {
      if (!prev) return prev;
      setIsDirty(true);
      if (bandKey === 'detail') {
        return { ...prev, detail: { ...prev.detail, designerHeight: height } };
      }
      return {
        ...prev,
        [bandKey]: { ...(prev[bandKey] as BandState), height },
      };
    });
  }, []);

  function handlePlaceElement(bandKey: BandKey, x: number, y: number) {
    if (!addingType) return;
    const newEl = defaultElementForType(addingType, x, y, contentW);
    updateBands(prev => ({
      ...prev,
      [bandKey]: {
        ...prev[bandKey],
        elements: [...prev[bandKey].elements, newEl],
      },
    }));
    setSelectedBandKey(bandKey);
    setSelectedElementId(newEl.id);
    setMode('select');
    setAddingType(null);
  }

  function handleDeleteElement() {
    if (!selectedBandKey || !selectedElementId) return;
    updateBands(prev => ({
      ...prev,
      [selectedBandKey]: {
        ...prev[selectedBandKey],
        elements: prev[selectedBandKey].elements.filter(el => el.id !== selectedElementId),
      },
    }));
    setSelectedElementId(null);
  }

  function handleUpdateElement(updated: TemplateElement) {
    if (!selectedBandKey) return;
    setBands(prev => {
      if (!prev) return prev;
      setIsDirty(true);
      return {
        ...prev,
        [selectedBandKey]: {
          ...prev[selectedBandKey],
          elements: prev[selectedBandKey].elements.map(el =>
            el.id === updated.id ? updated : el
          ),
        },
      };
    });
  }

  // ─── Get selected element ──────────────────────────────────────────────────
  const selectedElement = (selectedBandKey && selectedElementId && bands)
    ? bands[selectedBandKey].elements.find(el => el.id === selectedElementId) ?? null
    : null;

  // ─── Save ──────────────────────────────────────────────────────────────────
  async function handleSave() {
    if (!bands) return;
    setIsSaving(true);
    try {
      const layoutJson = bandsToLayout(bands, margin);
      const payload = {
        name,
        reportType,
        paperSize,
        orientation,
        layoutJson,
      };

      if (savedId) {
        await api.patch<SavedTemplate>(`/report-templates/${savedId}`, payload);
        toast({ title: 'Saved!', description: `"${name}" update ho gaya` });
      } else {
        const created = await api.post<SavedTemplate>('/report-templates', payload);
        setSavedId(created.id);
        navigate(`/report-templates/${created.id}/edit`);
        toast({ title: 'Saved!', description: `"${name}" create ho gaya` });
      }
      setIsDirty(false);
      qc.invalidateQueries({ queryKey: ['report-templates'] });
    } catch (err: any) {
      toast({ title: 'Save failed', description: err?.message || 'Unknown error', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  }

  // ─── Render ────────────────────────────────────────────────────────────────
  if (!isNew && isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-900">
        <Loader2 className="w-6 h-6 animate-spin text-blue-400" />
      </div>
    );
  }

  if (!bands) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-900">
        <Loader2 className="w-6 h-6 animate-spin text-blue-400" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-gray-900">
      {/* Top toolbar */}
      <DesignerToolbar
        name={name}
        reportType={reportType}
        paperSize={paperSize}
        orientation={orientation}
        zoom={zoom}
        isSaving={isSaving}
        isDirty={isDirty}
        templateId={savedId}
        onNameChange={setName}
        onReportTypeChange={setReportType}
        onPaperSizeChange={p => {
          setPaperSize(p);
          setIsDirty(true);
        }}
        onOrientationChange={o => {
          setOrientation(o);
          setIsDirty(true);
        }}
        onZoomChange={setZoom}
        onSave={handleSave}
        onUndo={undo}
        canUndo={undoStack.current.length > 0}
      />

      {/* 3-panel body */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: Palette */}
        <DesignerPalette
          mode={mode}
          addingType={addingType}
          onSelectMode={() => { setMode('select'); setAddingType(null); }}
          onAddMode={type => { setMode('add'); setAddingType(type); }}
        />

        {/* Center: Canvas */}
        <DesignerCanvas
          bands={bands}
          paperSize={paperSize}
          orientation={orientation}
          margin={margin}
          zoom={zoom}
          selectedBandKey={selectedBandKey}
          selectedElementId={selectedElementId}
          mode={mode}
          addingType={addingType}
          onSelectElement={(bandKey, elementId) => {
            setSelectedBandKey(bandKey);
            setSelectedElementId(elementId);
          }}
          onSelectBand={bandKey => {
            setSelectedBandKey(bandKey);
            setSelectedElementId(null);
          }}
          onMoveElement={handleMoveElement}
          onResizeElement={handleResizeElement}
          onResizeBand={handleResizeBand}
          onPlaceElement={handlePlaceElement}
          onDeselectAll={() => {
            setSelectedBandKey(null);
            setSelectedElementId(null);
          }}
        />

        {/* Right: Properties */}
        <DesignerProperties
          element={selectedElement}
          onUpdate={handleUpdateElement}
          onDelete={handleDeleteElement}
        />
      </div>
    </div>
  );
}
