import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Check, ChevronRight } from "lucide-react";

// A Windows-Explorer-style dark right-click menu: nested submenus flyout on
// hover, checkmarks show the active radio-style option (View mode, Sort by).
export interface MenuItem {
  key: string;
  label: string;
  checked?: boolean;
  disabled?: boolean;
  danger?: boolean;
  onClick?: () => void;
  submenu?: MenuEntry[];
}
export type MenuEntry = MenuItem | { key: string; separator: true };

function isSeparator(e: MenuEntry): e is { key: string; separator: true } {
  return (e as { separator?: true }).separator === true;
}

function MenuList({ entries, onRequestClose }: { entries: MenuEntry[]; onRequestClose: () => void }) {
  const [openSubmenu, setOpenSubmenu] = useState<string | null>(null);
  return (
    <div
      className="min-w-[210px] py-1.5 rounded-lg border border-white/10 bg-[#232323] shadow-2xl text-[13px] text-gray-200"
      onMouseLeave={() => setOpenSubmenu(null)}
    >
      {entries.map(entry => {
        if (isSeparator(entry)) {
          return <div key={entry.key} className="my-1.5 mx-2 border-t border-white/10" />;
        }
        const hasSubmenu = !!entry.submenu?.length;
        return (
          <div key={entry.key} className="relative" onMouseEnter={() => hasSubmenu && setOpenSubmenu(entry.key)}>
            <button
              type="button"
              disabled={entry.disabled}
              onClick={() => {
                if (hasSubmenu || entry.disabled) return;
                entry.onClick?.();
                onRequestClose();
              }}
              className={`w-full flex items-center gap-2.5 px-3 py-1.5 text-left transition-colors ${
                entry.disabled
                  ? "text-gray-600 cursor-not-allowed"
                  : entry.danger
                  ? "text-red-400 hover:bg-red-500/10"
                  : "hover:bg-white/10"
              }`}
            >
              <span className="w-3.5 flex-shrink-0">{entry.checked && <Check className="w-3.5 h-3.5 text-sky-400" />}</span>
              <span className="flex-1 truncate">{entry.label}</span>
              {hasSubmenu && <ChevronRight className="w-3.5 h-3.5 text-gray-500 flex-shrink-0" />}
            </button>
            {hasSubmenu && openSubmenu === entry.key && (
              <div className="absolute left-full top-[-6px] z-10">
                <MenuList entries={entry.submenu!} onRequestClose={onRequestClose} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function ExplorerContextMenu({
  x, y, entries, onClose,
}: { x: number; y: number; entries: MenuEntry[]; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ x, y });

  // Flip toward the viewport interior if the menu would otherwise render
  // partly off-screen (right-clicking near the right/bottom edge).
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setPos({
      x: x + rect.width > window.innerWidth ? Math.max(4, window.innerWidth - rect.width - 4) : x,
      y: y + rect.height > window.innerHeight ? Math.max(4, window.innerHeight - rect.height - 4) : y,
    });
  }, [x, y]);

  useEffect(() => {
    const handleDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const handleKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("mousedown", handleDown);
    window.addEventListener("keydown", handleKey);
    window.addEventListener("scroll", onClose, true);
    return () => {
      window.removeEventListener("mousedown", handleDown);
      window.removeEventListener("keydown", handleKey);
      window.removeEventListener("scroll", onClose, true);
    };
  }, [onClose]);

  return (
    <div ref={ref} style={{ position: "fixed", left: pos.x, top: pos.y, zIndex: 1000 }} onContextMenu={e => e.preventDefault()}>
      <MenuList entries={entries} onRequestClose={onClose} />
    </div>
  );
}
