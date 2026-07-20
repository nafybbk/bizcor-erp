import { useState, useRef, useEffect, useCallback } from "react";
import { Search, Plus, Loader2 } from "lucide-react";

interface Party {
  id: number;
  name: string;
  gstin?: string;
  stateCode?: string;
  creditLimit?: number;
  [key: string]: any;
}

interface PartySelectProps {
  parties: Party[];
  value: string;
  onSelect: (party: Party) => void;
  placeholder?: string;
  className?: string;
  showDetails?: boolean;
  // Shows a color-coded "Connect: ON/OFF" badge per row using p.miniAppEnabled
  // — lets a user see upfront why sharing to a party might not reach them
  // (Connect app access off), without hiding that party from the list.
  showConnectStatus?: boolean;
  onAddNew?: (name: string) => void;
  addNewLabel?: string;
  required?: boolean;
  onSearch?: (q: string) => void;
}

export default function PartySelect({
  parties,
  value,
  onSelect,
  placeholder = "Search party...",
  className,
  showDetails = false,
  showConnectStatus = false,
  onAddNew,
  addNewLabel = "Add new",
  required,
  onSearch,
}: PartySelectProps) {
  const [search, setSearch] = useState(value);
  const [open, setOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setSearch(value);
  }, [value]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setHighlightedIndex(-1);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Scroll highlighted item into view
  useEffect(() => {
    if (highlightedIndex >= 0 && listRef.current) {
      const items = listRef.current.querySelectorAll("[data-party-item]");
      const el = items[highlightedIndex] as HTMLElement;
      if (el) el.scrollIntoView({ block: "nearest" });
    }
  }, [highlightedIndex]);

  const triggerSearch = useCallback((q: string) => {
    if (!onSearch) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => onSearch(q), 300);
  }, [onSearch]);

  const [showAll, setShowAll] = useState(false);

  const filtered = parties
    .filter(p => showAll || !search.trim() || p.name?.toLowerCase().includes(search.toLowerCase()));

  const isNew =
    !!onAddNew &&
    search.trim().length >= 2 &&
    !parties.some(p => p.name?.toLowerCase() === search.trim().toLowerCase());

  const handleSelect = (p: Party) => {
    onSelect(p);
    setSearch(p.name);
    setOpen(false);
    setHighlightedIndex(-1);
  };

  const inputClass =
    className ||
    "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent";

  const totalItems = filtered.length + (isNew ? 1 : 0);

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
        <input
          ref={inputRef}
          type="text"
          autoComplete="off"
          required={required}
          className={`pl-8 ${inputClass}`}
          value={search}
          placeholder={placeholder}
          onChange={e => {
            const val = e.target.value;
            setSearch(val);
            setShowAll(false);
            setOpen(true);
            setHighlightedIndex(-1);
          }}
          onKeyDown={e => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              if (!open) { setOpen(true); setHighlightedIndex(0); return; }
              setHighlightedIndex(i => Math.min(i + 1, totalItems - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setHighlightedIndex(i => Math.max(i - 1, 0));
            } else if (e.key === "Enter") {
              if (open && totalItems > 0) {
                e.preventDefault();
                const idx = highlightedIndex >= 0 ? highlightedIndex : 0;
                if (idx < filtered.length) handleSelect(filtered[idx]);
                else if (isNew && onAddNew) { onAddNew(search.trim()); setOpen(false); setHighlightedIndex(-1); }
              }
            } else if (e.key === "Tab") {
              // Tab commits the highlighted (or single-match) party, then moves on
              if (open) {
                const idx = highlightedIndex >= 0 ? highlightedIndex : (filtered.length === 1 ? 0 : -1);
                if (idx >= 0 && idx < filtered.length) handleSelect(filtered[idx]);
                else { setOpen(false); setHighlightedIndex(-1); }
              }
            } else if (e.key === "Escape") {
              setOpen(false);
              setHighlightedIndex(-1);
            }
          }}
        />
      </div>

      {open && (filtered.length > 0 || isNew || parties.length === 0) && (
        <div ref={listRef} className="absolute z-30 top-full mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-xl max-h-60 overflow-y-auto">
          {parties.length === 0 ? (
            <div className="px-3 py-4 text-sm text-gray-400 text-center flex items-center justify-center gap-2">
              <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading parties...
            </div>
          ) : (
            <div className="px-3 py-1 text-[10px] text-gray-400 bg-gray-50 border-b border-gray-100 sticky top-0">
              {search.trim()
                ? `${filtered.length} of ${parties.length} match`
                : `${parties.length} ${parties.length === 1 ? "party" : "parties"}`}
            </div>
          )}

          {filtered.map((p, idx) => (
            <div
              key={p.id}
              data-party-item
              onMouseDown={e => e.preventDefault()}
              onMouseEnter={() => setHighlightedIndex(idx)}
              onClick={() => handleSelect(p)}
              className={`px-3 py-2.5 cursor-pointer text-sm border-b border-gray-50 last:border-0 ${
                showConnectStatus && p.miniAppEnabled === false ? "bg-gray-50" : ""
              } ${highlightedIndex === idx ? "bg-blue-50" : "hover:bg-blue-50"}`}
            >
              <div className="flex items-center gap-2">
                <span className="font-medium text-gray-800">{p.name}</span>
                {showConnectStatus && (
                  <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                    p.miniAppEnabled === false ? "bg-gray-200 text-gray-500" : "bg-emerald-100 text-emerald-700"
                  }`}>
                    Connect: {p.miniAppEnabled === false ? "OFF" : "ON"}
                  </span>
                )}
              </div>
              {showConnectStatus && p.miniAppEnabled === false && (
                <div className="text-[10px] text-gray-400 mt-0.5">Isko Connect app se dekhne ke liye pehle party form mein toggle ON karein</div>
              )}
              {showDetails && (
                <div className="flex flex-wrap gap-3 mt-0.5">
                  {p.gstin && (
                    <span className="text-[11px] text-gray-400 font-mono">{p.gstin}</span>
                  )}
                  {p.stateCode && (
                    <span className="text-[11px] text-gray-400">State: {p.stateCode}</span>
                  )}
                  {Number(p.creditLimit) > 0 && (
                    <span className="text-[11px] text-amber-600 font-medium">
                      Limit: ₹{Number(p.creditLimit).toLocaleString("en-IN")}
                    </span>
                  )}
                </div>
              )}
            </div>
          ))}

          {isNew && onAddNew && (
            <div
              data-party-item
              onMouseDown={e => e.preventDefault()}
              onMouseEnter={() => setHighlightedIndex(filtered.length)}
              onClick={() => {
                onAddNew(search.trim());
                setOpen(false);
                setHighlightedIndex(-1);
              }}
              className={`px-3 py-2.5 border-t border-dashed border-green-300 bg-green-50 cursor-pointer text-sm flex items-center gap-2 text-green-700 font-medium ${highlightedIndex === filtered.length ? "bg-green-100" : "hover:bg-green-100"}`}
            >
              <Plus className="w-3.5 h-3.5 flex-shrink-0" />
              <span>"{search.trim()}" — {addNewLabel}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
