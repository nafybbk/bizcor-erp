import { useState } from "react";
import {
  Type, Tag, Calculator, Image, Minus, Square,
  Table, Grid2X2, ChevronDown, ChevronRight, MousePointer,
} from "lucide-react";
import { FIELD_REGISTRY } from "@/lib/reportEngine/fieldRegistry";
import type { TemplateElement } from "@/lib/reportEngine/types";

interface Props {
  mode: 'select' | 'add';
  addingType: TemplateElement['type'] | null;
  addingFieldKey: string | null;
  onSelectMode: () => void;
  onAddMode: (type: TemplateElement['type']) => void;
  onAddFieldMode: (fieldKey: string) => void;
}

const ELEMENT_TYPES: { type: TemplateElement['type']; label: string; icon: React.ReactNode; desc: string }[] = [
  { type: 'text',    label: 'Text',    icon: <Type className="w-4 h-4" />,       desc: 'Static text / label' },
  { type: 'field',   label: 'Field',   icon: <Tag className="w-4 h-4" />,        desc: 'Dynamic data field' },
  { type: 'formula', label: 'Formula', icon: <Calculator className="w-4 h-4" />, desc: 'Calculated value' },
  { type: 'image',   label: 'Image',   icon: <Image className="w-4 h-4" />,      desc: 'Logo or static image' },
  { type: 'line',    label: 'Line',    icon: <Minus className="w-4 h-4" />,      desc: 'Horizontal / vertical rule' },
  { type: 'box',     label: 'Box',     icon: <Square className="w-4 h-4" />,     desc: 'Rectangle / border box' },
  { type: 'table',   label: 'Table',   icon: <Table className="w-4 h-4" />,      desc: 'Repeating data table' },
  { type: 'qrcode',  label: 'QR Code', icon: <Grid2X2 className="w-4 h-4" />,   desc: 'QR code element' },
];

export default function DesignerPalette({ mode, addingType, addingFieldKey, onSelectMode, onAddMode, onAddFieldMode }: Props) {
  const [tab, setTab] = useState<'elements' | 'fields'>('elements');
  const [openCats, setOpenCats] = useState<Set<string>>(new Set(['company', 'invoice']));

  function toggleCat(key: string) {
    setOpenCats(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  return (
    <div className="w-[200px] shrink-0 bg-gray-800 border-r border-gray-700 flex flex-col overflow-hidden">
      {/* Tab bar */}
      <div className="flex border-b border-gray-700">
        <button
          onClick={() => setTab('elements')}
          className={`flex-1 py-2 text-xs font-medium transition-colors ${tab === 'elements' ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-white'}`}
        >
          Elements
        </button>
        <button
          onClick={() => setTab('fields')}
          className={`flex-1 py-2 text-xs font-medium transition-colors ${tab === 'fields' ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-white'}`}
        >
          Fields
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {tab === 'elements' && (
          <div className="p-2 space-y-1">
            {/* Select tool */}
            <button
              onClick={onSelectMode}
              className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs text-left transition-colors ${
                mode === 'select' ? 'bg-blue-600 text-white' : 'text-gray-300 hover:bg-gray-700'
              }`}
            >
              <MousePointer className="w-4 h-4 shrink-0" />
              <div>
                <div className="font-medium">Select</div>
              </div>
            </button>

            <div className="border-t border-gray-700 my-1" />
            <p className="text-[10px] text-gray-500 px-2 mb-1 uppercase tracking-wide">Add Element</p>

            {ELEMENT_TYPES.map(et => (
              <button
                key={et.type}
                onClick={() => onAddMode(et.type)}
                title={et.desc}
                className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs text-left transition-colors ${
                  mode === 'add' && addingType === et.type
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-300 hover:bg-gray-700'
                }`}
              >
                <span className="shrink-0">{et.icon}</span>
                <div>
                  <div className="font-medium">{et.label}</div>
                  <div className={`text-[10px] ${mode === 'add' && addingType === et.type ? 'text-blue-200' : 'text-gray-500'}`}>
                    {et.desc}
                  </div>
                </div>
              </button>
            ))}

            {mode === 'add' && (
              <div className="mt-2 px-2 py-2 bg-blue-900/50 border border-blue-700 rounded-lg text-[10px] text-blue-300 text-center">
                Click on any band to place element
              </div>
            )}
          </div>
        )}

        {tab === 'fields' && (
          <div className="p-2 space-y-1">
            <p className="text-[10px] text-gray-500 px-2 mb-1 uppercase tracking-wide">Select → click on band to place</p>

            {/* Active field hint */}
            {addingFieldKey && mode === 'add' && (
              <div className="mx-1 mb-1 px-2 py-1.5 bg-blue-700 border border-blue-500 rounded-lg text-[10px] text-blue-100 text-center">
                ✛ Click on any band to place
              </div>
            )}

            {FIELD_REGISTRY.map(cat => (
              <div key={cat.key}>
                <button
                  onClick={() => toggleCat(cat.key)}
                  className="w-full flex items-center gap-2 px-2 py-1.5 text-xs font-medium text-gray-300 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
                >
                  <span>{cat.icon}</span>
                  <span className="flex-1 text-left">{cat.label}</span>
                  {openCats.has(cat.key)
                    ? <ChevronDown className="w-3 h-3 text-gray-500" />
                    : <ChevronRight className="w-3 h-3 text-gray-500" />
                  }
                </button>
                {openCats.has(cat.key) && (
                  <div className="ml-2 mt-0.5 space-y-0.5">
                    {cat.fields.map(field => {
                      const isActive = addingFieldKey === field.key && mode === 'add';
                      return (
                        <button
                          key={field.key}
                          onClick={() => onAddFieldMode(field.key)}
                          className={`w-full flex items-center gap-2 px-2 py-1 rounded text-[11px] transition-colors text-left ${
                            isActive
                              ? 'bg-blue-600 text-white'
                              : 'text-gray-400 hover:text-white hover:bg-gray-700'
                          }`}
                          title={field.description}
                        >
                          <span className={`w-2 h-2 rounded-full shrink-0 ${isActive ? 'bg-white' : 'bg-gray-600'}`} />
                          <span className="truncate">{field.label}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
