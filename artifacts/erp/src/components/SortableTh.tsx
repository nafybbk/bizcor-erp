import { ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react";
import type { SortDir } from "@/lib/useSort";

interface SortableThProps {
  label: string;
  sortKey: string;
  currentKey: string | null;
  dir: SortDir;
  onSort: (key: string) => void;
  align?: "left" | "right" | "center";
  className?: string;
}

export default function SortableTh({ label, sortKey, currentKey, dir, onSort, align = "left", className = "" }: SortableThProps) {
  const active = currentKey === sortKey;
  const alignCls = align === "right" ? "text-right justify-end" : align === "center" ? "text-center justify-center" : "text-left justify-start";
  return (
    <th
      onClick={() => onSort(sortKey)}
      className={`px-4 py-3 font-medium cursor-pointer select-none group ${align === "right" ? "text-right" : align === "center" ? "text-center" : "text-left"} ${className}`}
      title="Click to sort"
    >
      <span className={`inline-flex items-center gap-1 ${alignCls}`}>
        {label}
        {active ? (
          dir === "asc" ? <ChevronUp className="w-3.5 h-3.5 text-blue-600" /> : <ChevronDown className="w-3.5 h-3.5 text-blue-600" />
        ) : (
          <ChevronsUpDown className="w-3.5 h-3.5 text-gray-300 group-hover:text-gray-400" />
        )}
      </span>
    </th>
  );
}
