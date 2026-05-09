import { useState, useRef, useEffect } from "react";
import { SlidersHorizontal } from "lucide-react";
import { useLang, t } from "@/lib/lang";

export interface ColDef {
  key: string;
  label: string;
  required?: boolean;
}

interface Props {
  cols: ColDef[];
  visible: string[];
  onChange: (visible: string[]) => void;
}

export default function ColumnCustomizer({ cols, visible, onChange }: Props) {
  const lang = useLang();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const toggle = (key: string) => {
    const col = cols.find(c => c.key === key);
    if (col?.required) return;
    if (visible.includes(key)) {
      onChange(visible.filter(k => k !== key));
    } else {
      const allKeys = cols.map(c => c.key);
      onChange(allKeys.filter(k => k === key || visible.includes(k)));
    }
  };

  const showAll = () => onChange(cols.map(c => c.key));

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        title={t("adjustColumns", lang)}
        className={`flex items-center gap-1.5 px-3 py-2 border text-sm rounded-lg transition-colors ${open ? "border-blue-400 text-blue-600 bg-blue-50" : "border-gray-200 text-gray-600 hover:bg-gray-50"}`}
      >
        <SlidersHorizontal className="w-4 h-4" />
        <span className="hidden sm:inline">Columns</span>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1.5 bg-white border border-gray-200 rounded-xl shadow-xl z-40 w-56 py-2">
          <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider px-3 py-1.5">
            {t("showHideColumns", lang)}
          </div>
          {cols.map(col => (
            <label
              key={col.key}
              className={`flex items-center gap-2.5 px-3 py-2 hover:bg-gray-50 select-none ${col.required ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
            >
              <input
                type="checkbox"
                checked={visible.includes(col.key)}
                disabled={col.required}
                onChange={() => toggle(col.key)}
                className="w-4 h-4 rounded text-blue-600 accent-blue-600"
              />
              <span className="text-sm text-gray-700">{col.label}</span>
            </label>
          ))}
          <div className="border-t border-gray-100 mt-1 pt-1 px-3">
            <button
              type="button"
              onClick={showAll}
              className="text-xs text-blue-600 hover:text-blue-700 py-1 font-medium"
            >
              {t("showAllColumns", lang)}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
