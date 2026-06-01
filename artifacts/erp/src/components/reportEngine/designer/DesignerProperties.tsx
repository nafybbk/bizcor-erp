import { Trash2, Eye, EyeOff, ChevronDown, ChevronUp, Plus, X } from "lucide-react";
import type { TemplateElement, TextElement, FieldElement, FormulaElement, ImageElement, LineElement, BoxElement, TableElement, QrCodeElement, ElementStyle, TableColumn } from "@/lib/reportEngine/types";
import { FIELD_REGISTRY } from "@/lib/reportEngine/fieldRegistry";
import { useState } from "react";

// Flat list of all fields for dropdown
const ALL_FIELDS = FIELD_REGISTRY.flatMap(c => c.fields);

interface Props {
  element: TemplateElement | null;
  onUpdate: (updated: TemplateElement) => void;
  onDelete: () => void;
}

export default function DesignerProperties({ element, onUpdate, onDelete }: Props) {
  if (!element) {
    return (
      <div className="w-[240px] shrink-0 bg-gray-800 border-l border-gray-700 flex items-center justify-center">
        <div className="text-center text-gray-500 text-xs px-4">
          <div className="text-2xl mb-2">↖</div>
          <p>Click an element to edit its properties</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-[240px] shrink-0 bg-gray-800 border-l border-gray-700 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-700 bg-gray-900">
        <span className="text-xs font-semibold text-gray-300 uppercase tracking-wide">
          {element.type.toUpperCase()}
        </span>
        <button
          onClick={onDelete}
          className="p-1 text-red-400 hover:text-red-300 hover:bg-red-900/30 rounded transition-colors"
          title="Delete element"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Position & Size */}
        <Section title="Position & Size">
          <div className="grid grid-cols-2 gap-2">
            <NumField label="X (mm)" value={element.x} onChange={v => onUpdate({ ...element, x: v })} />
            <NumField label="Y (mm)" value={element.y} onChange={v => onUpdate({ ...element, y: v })} />
            <NumField label="W (mm)" value={element.width} onChange={v => onUpdate({ ...element, width: Math.max(1, v) })} />
            <NumField label="H (mm)" value={element.height} onChange={v => onUpdate({ ...element, height: Math.max(1, v) })} />
          </div>
          <TextInputField
            label="Visible If"
            value={element.visibleIf || ''}
            placeholder="e.g. total_cgst > 0"
            onChange={v => onUpdate({ ...element, visibleIf: v || undefined })}
          />
        </Section>

        {/* Type-specific props */}
        {element.type === 'text' && <TextProps el={element as TextElement} onUpdate={onUpdate} />}
        {element.type === 'field' && <FieldProps el={element as FieldElement} onUpdate={onUpdate} />}
        {element.type === 'formula' && <FormulaProps el={element as FormulaElement} onUpdate={onUpdate} />}
        {element.type === 'image' && <ImageProps el={element as ImageElement} onUpdate={onUpdate} />}
        {element.type === 'line' && <LineProps el={element as LineElement} onUpdate={onUpdate} />}
        {element.type === 'box' && <BoxProps el={element as BoxElement} onUpdate={onUpdate} />}
        {element.type === 'table' && <TableProps el={element as TableElement} onUpdate={onUpdate} />}
        {element.type === 'qrcode' && <QrProps el={element as QrCodeElement} onUpdate={onUpdate} />}

        {/* Common style */}
        {!['line', 'image', 'qrcode', 'table'].includes(element.type) && (
          <StyleProps style={element.style} onChange={s => onUpdate({ ...element, style: s })} />
        )}
      </div>
    </div>
  );
}

// ─── Section wrapper ─────────────────────────────────────────────────────────
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="border-b border-gray-700">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-3 py-2 text-[10px] font-semibold text-gray-400 uppercase tracking-wide hover:text-gray-300 transition-colors"
      >
        {title}
        {open ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
      </button>
      {open && <div className="px-3 pb-3 space-y-2">{children}</div>}
    </div>
  );
}

// ─── Reusable form fields ─────────────────────────────────────────────────────
function NumField({ label, value, onChange, step = 0.5 }: { label: string; value: number; onChange: (v: number) => void; step?: number }) {
  return (
    <div>
      <label className="block text-[10px] text-gray-500 mb-0.5">{label}</label>
      <input
        type="number"
        step={step}
        value={value}
        onChange={e => onChange(parseFloat(e.target.value) || 0)}
        className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1 text-xs text-white focus:border-blue-500 focus:outline-none"
      />
    </div>
  );
}

function TextInputField({ label, value, onChange, placeholder, multiline }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; multiline?: boolean }) {
  return (
    <div>
      <label className="block text-[10px] text-gray-500 mb-0.5">{label}</label>
      {multiline ? (
        <textarea
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          rows={3}
          className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1 text-xs text-white focus:border-blue-500 focus:outline-none resize-none"
        />
      ) : (
        <input
          type="text"
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1 text-xs text-white focus:border-blue-500 focus:outline-none"
        />
      )}
    </div>
  );
}

function SelectField({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
  return (
    <div>
      <label className="block text-[10px] text-gray-500 mb-0.5">{label}</label>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1 text-xs text-white focus:border-blue-500 focus:outline-none"
      >
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="block text-[10px] text-gray-500 mb-0.5">{label}</label>
      <div className="flex gap-1.5 items-center">
        <input
          type="color"
          value={value || '#000000'}
          onChange={e => onChange(e.target.value)}
          className="w-7 h-7 rounded cursor-pointer border border-gray-600 bg-gray-700"
        />
        <input
          type="text"
          value={value || ''}
          onChange={e => onChange(e.target.value)}
          placeholder="#000000"
          className="flex-1 bg-gray-700 border border-gray-600 rounded px-2 py-1 text-xs text-white focus:border-blue-500 focus:outline-none"
        />
      </div>
    </div>
  );
}

// ─── Type-specific sections ───────────────────────────────────────────────────

function TextProps({ el, onUpdate }: { el: TextElement; onUpdate: (e: TemplateElement) => void }) {
  return (
    <Section title="Content">
      <TextInputField
        label="Text Content"
        value={el.content}
        onChange={v => onUpdate({ ...el, content: v })}
        multiline
      />
    </Section>
  );
}

function FieldProps({ el, onUpdate }: { el: FieldElement; onUpdate: (e: TemplateElement) => void }) {
  return (
    <Section title="Field">
      <SelectField
        label="Data Field"
        value={el.field}
        onChange={v => onUpdate({ ...el, field: v })}
        options={ALL_FIELDS.map(f => ({ value: f.key, label: f.label }))}
      />
      <TextInputField label="Format" value={el.format || ''} onChange={v => onUpdate({ ...el, format: v || undefined })} placeholder="e.g. DD-MM-YYYY / 0.00" />
      <TextInputField label="If Empty Show" value={el.nullText || ''} onChange={v => onUpdate({ ...el, nullText: v || undefined })} placeholder="— or N/A" />
    </Section>
  );
}

function FormulaProps({ el, onUpdate }: { el: FormulaElement; onUpdate: (e: TemplateElement) => void }) {
  return (
    <Section title="Formula">
      <TextInputField
        label="Formula"
        value={el.formula}
        onChange={v => onUpdate({ ...el, formula: v })}
        placeholder="{sub_total} + {total_tax}"
        multiline
      />
      <TextInputField label="Format" value={el.format || ''} onChange={v => onUpdate({ ...el, format: v || undefined })} placeholder="0.00" />
    </Section>
  );
}

function ImageProps({ el, onUpdate }: { el: ImageElement; onUpdate: (e: TemplateElement) => void }) {
  return (
    <Section title="Image">
      <SelectField
        label="Source Field"
        value={el.source}
        onChange={v => onUpdate({ ...el, source: v })}
        options={[
          { value: 'company_logo', label: 'Company Logo' },
          { value: 'qr_code', label: 'QR Code' },
          ...ALL_FIELDS.filter(f => f.type === 'image').map(f => ({ value: f.key, label: f.label })),
        ]}
      />
      <SelectField
        label="Object Fit"
        value={el.objectFit || 'contain'}
        onChange={v => onUpdate({ ...el, objectFit: v as ImageElement['objectFit'] })}
        options={[
          { value: 'contain', label: 'Contain' },
          { value: 'cover', label: 'Cover' },
          { value: 'fill', label: 'Fill' },
        ]}
      />
    </Section>
  );
}

function LineProps({ el, onUpdate }: { el: LineElement; onUpdate: (e: TemplateElement) => void }) {
  return (
    <Section title="Line">
      <SelectField
        label="Direction"
        value={el.direction}
        onChange={v => onUpdate({ ...el, direction: v as LineElement['direction'] })}
        options={[
          { value: 'horizontal', label: 'Horizontal' },
          { value: 'vertical', label: 'Vertical' },
        ]}
      />
      <ColorField label="Color" value={el.color || '#000000'} onChange={v => onUpdate({ ...el, color: v })} />
      <NumField label="Thickness (mm)" value={el.thickness || 0.3} onChange={v => onUpdate({ ...el, thickness: v })} step={0.1} />
    </Section>
  );
}

function BoxProps({ el, onUpdate }: { el: BoxElement; onUpdate: (e: TemplateElement) => void }) {
  const style = el.style || {};
  return (
    <Section title="Box Style">
      <ColorField
        label="Background"
        value={style.backgroundColor || ''}
        onChange={v => onUpdate({ ...el, style: { ...style, backgroundColor: v || undefined } })}
      />
      <TextInputField
        label="Border"
        value={style.border || ''}
        onChange={v => onUpdate({ ...el, style: { ...style, border: v || undefined } })}
        placeholder="1px solid #000"
      />
    </Section>
  );
}

function StyleProps({ style, onChange }: { style?: ElementStyle; onChange: (s: ElementStyle) => void }) {
  const s = style || {};
  return (
    <Section title="Text Style">
      <div className="grid grid-cols-2 gap-2">
        <NumField label="Font Size (pt)" value={s.fontSize || 10} onChange={v => onChange({ ...s, fontSize: v })} step={0.5} />
        <NumField label="Line Height" value={s.lineHeight || 1.4} onChange={v => onChange({ ...s, lineHeight: v })} step={0.1} />
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        <button
          onClick={() => onChange({ ...s, fontWeight: s.fontWeight === 'bold' ? 'normal' : 'bold' })}
          className={`py-1.5 text-xs rounded border transition-colors ${s.fontWeight === 'bold' ? 'bg-blue-600 border-blue-500 text-white font-bold' : 'border-gray-600 text-gray-300 hover:bg-gray-700'}`}
        >
          Bold
        </button>
        <button
          onClick={() => onChange({ ...s, fontStyle: s.fontStyle === 'italic' ? 'normal' : 'italic' })}
          className={`py-1.5 text-xs rounded border transition-colors ${s.fontStyle === 'italic' ? 'bg-blue-600 border-blue-500 text-white italic' : 'border-gray-600 text-gray-300 hover:bg-gray-700'}`}
        >
          Italic
        </button>
      </div>
      <div>
        <label className="block text-[10px] text-gray-500 mb-0.5">Align</label>
        <div className="flex rounded overflow-hidden border border-gray-600">
          {(['left', 'center', 'right'] as const).map(a => (
            <button
              key={a}
              onClick={() => onChange({ ...s, textAlign: a })}
              className={`flex-1 py-1.5 text-xs transition-colors capitalize ${s.textAlign === a ? 'bg-blue-600 text-white' : 'text-gray-400 hover:bg-gray-700'}`}
            >
              {a[0].toUpperCase()}
            </button>
          ))}
        </div>
      </div>
      <ColorField label="Text Color" value={s.color || '#000000'} onChange={v => onChange({ ...s, color: v })} />
      <ColorField
        label="Background"
        value={s.backgroundColor || ''}
        onChange={v => onChange({ ...s, backgroundColor: v || undefined })}
      />
    </Section>
  );
}

function QrProps({ el, onUpdate }: { el: QrCodeElement; onUpdate: (e: TemplateElement) => void }) {
  return (
    <Section title="QR Code">
      <TextInputField
        label="Content / URL"
        value={el.content}
        onChange={v => onUpdate({ ...el, content: v })}
        placeholder="{invoice_number} or static URL"
        multiline
      />
    </Section>
  );
}

function TableProps({ el, onUpdate }: { el: TableElement; onUpdate: (e: TemplateElement) => void }) {
  const [expandedCol, setExpandedCol] = useState<string | null>(null);

  function addColumn() {
    const newCol: TableColumn = {
      id: `col_${Date.now()}`,
      field: 'item_name',
      label: 'Column',
      width: 30,
      align: 'left',
    };
    onUpdate({ ...el, columns: [...el.columns, newCol] });
  }

  function removeColumn(id: string) {
    onUpdate({ ...el, columns: el.columns.filter(c => c.id !== id) });
  }

  function updateColumn(id: string, patch: Partial<TableColumn>) {
    onUpdate({ ...el, columns: el.columns.map(c => c.id === id ? { ...c, ...patch } : c) });
  }

  return (
    <>
      <Section title="Table Settings">
        <SelectField
          label="Data Source"
          value={el.dataSource}
          onChange={v => onUpdate({ ...el, dataSource: v })}
          options={[{ value: 'items', label: 'Invoice Items' }]}
        />
        <div className="grid grid-cols-2 gap-2">
          <NumField label="Row Height (mm)" value={el.rowHeight || 8} onChange={v => onUpdate({ ...el, rowHeight: v })} step={0.5} />
          <NumField label="Header H (mm)" value={el.headerHeight || 8} onChange={v => onUpdate({ ...el, headerHeight: v })} step={0.5} />
        </div>
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="showHeader"
            checked={el.showHeader ?? true}
            onChange={e => onUpdate({ ...el, showHeader: e.target.checked })}
            className="rounded border-gray-600"
          />
          <label htmlFor="showHeader" className="text-xs text-gray-300">Show Header Row</label>
        </div>
        <NumField label="Empty Rows" value={el.emptyRows || 0} onChange={v => onUpdate({ ...el, emptyRows: v })} step={1} />
      </Section>

      <Section title="Columns">
        <div className="space-y-1">
          {el.columns.map((col, idx) => (
            <div key={col.id} className="bg-gray-700/50 rounded border border-gray-600">
              <div className="flex items-center gap-2 px-2 py-1.5">
                <button
                  onClick={() => setExpandedCol(expandedCol === col.id ? null : col.id)}
                  className="flex-1 text-left text-xs text-gray-300 font-medium truncate"
                >
                  {idx + 1}. {col.label || col.field}
                </button>
                <button
                  onClick={() => removeColumn(col.id)}
                  className="p-0.5 text-red-400 hover:text-red-300"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
              {expandedCol === col.id && (
                <div className="px-2 pb-2 space-y-1.5 border-t border-gray-600">
                  <SelectField
                    label="Field"
                    value={col.field}
                    onChange={v => updateColumn(col.id, { field: v })}
                    options={ALL_FIELDS.filter(f => f.key.includes('_') || true).map(f => ({ value: f.key, label: f.label }))}
                  />
                  <TextInputField label="Header Label" value={col.label} onChange={v => updateColumn(col.id, { label: v })} />
                  <div className="grid grid-cols-2 gap-2">
                    <NumField label="Width (mm)" value={col.width} onChange={v => updateColumn(col.id, { width: v })} step={1} />
                  </div>
                  <SelectField
                    label="Align"
                    value={col.align || 'left'}
                    onChange={v => updateColumn(col.id, { align: v as TableColumn['align'] })}
                    options={[
                      { value: 'left', label: 'Left' },
                      { value: 'center', label: 'Center' },
                      { value: 'right', label: 'Right' },
                    ]}
                  />
                </div>
              )}
            </div>
          ))}
          <button
            onClick={addColumn}
            className="w-full flex items-center justify-center gap-1.5 py-1.5 text-xs text-blue-400 hover:text-blue-300 border border-dashed border-blue-700 rounded hover:bg-blue-900/20 transition-colors"
          >
            <Plus className="w-3 h-3" />
            Add Column
          </button>
        </div>
      </Section>
    </>
  );
}
