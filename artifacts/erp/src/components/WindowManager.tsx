import { createContext, useContext, useState, useCallback, useRef, useEffect } from "react";
import { X, Minus, Maximize2 } from "lucide-react";

interface WinDef {
  id: string;
  title: string;
  content: React.ReactNode;
  x: number;
  y: number;
  width: number;
  height: number;
  minimized: boolean;
  z: number;
}

interface WMCtx {
  openWindow: (id: string, title: string, content: React.ReactNode, opts?: { width?: number; height?: number }) => void;
  closeWindow: (id: string) => void;
  minimizeWindow: (id: string) => void;
}

const Ctx = createContext<WMCtx | null>(null);
let zTop = 200;

export function useWindowManager() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useWindowManager must be inside WindowManagerProvider");
  return ctx;
}

export function WindowManagerProvider({ children }: { children: React.ReactNode }) {
  const [wins, setWins] = useState<WinDef[]>([]);

  const openWindow = useCallback((id: string, title: string, content: React.ReactNode, opts?: { width?: number; height?: number }) => {
    setWins(prev => {
      const exists = prev.find(w => w.id === id);
      if (exists) {
        return prev.map(w => w.id === id ? { ...w, minimized: false, z: ++zTop } : w);
      }
      const offset = prev.length * 28;
      return [...prev, {
        id, title, content,
        x: Math.min(60 + offset, window.innerWidth - (opts?.width ?? 640) - 20),
        y: Math.min(60 + offset, window.innerHeight - (opts?.height ?? 480) - 60),
        width: opts?.width ?? 640,
        height: opts?.height ?? 480,
        minimized: false,
        z: ++zTop,
      }];
    });
  }, []);

  const closeWindow = useCallback((id: string) => setWins(p => p.filter(w => w.id !== id)), []);
  const minimizeWindow = useCallback((id: string) => setWins(p => p.map(w => w.id === id ? { ...w, minimized: true } : w)), []);
  const restoreWindow = useCallback((id: string) => setWins(p => p.map(w => w.id === id ? { ...w, minimized: false, z: ++zTop } : w)), []);
  const bringToFront = useCallback((id: string) => setWins(p => p.map(w => w.id === id ? { ...w, z: ++zTop } : w)), []);
  const moveWindow = useCallback((id: string, x: number, y: number) => setWins(p => p.map(w => w.id === id ? { ...w, x, y } : w)), []);

  const minimized = wins.filter(w => w.minimized);
  const visible = wins.filter(w => !w.minimized);

  return (
    <Ctx.Provider value={{ openWindow, closeWindow, minimizeWindow }}>
      {children}

      {visible.map(win => (
        <FloatWin
          key={win.id}
          win={win}
          onClose={() => closeWindow(win.id)}
          onMinimize={() => minimizeWindow(win.id)}
          onFocus={() => bringToFront(win.id)}
          onMove={(x, y) => moveWindow(win.id, x, y)}
        />
      ))}

      {minimized.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 h-10 bg-slate-900 border-t border-slate-700 flex items-center gap-1.5 px-3 z-[9999] print:hidden">
          <span className="text-slate-400 text-xs mr-1">Windows:</span>
          {minimized.map(w => (
            <button
              key={w.id}
              onClick={() => restoreWindow(w.id)}
              className="flex items-center gap-1.5 px-3 py-1 bg-slate-700 hover:bg-slate-600 text-white text-xs rounded border border-slate-500 transition-colors max-w-[180px]"
            >
              <Maximize2 className="w-3 h-3 shrink-0" />
              <span className="truncate">{w.title}</span>
            </button>
          ))}
        </div>
      )}
    </Ctx.Provider>
  );
}

function FloatWin({ win, onClose, onMinimize, onFocus, onMove }: {
  win: WinDef;
  onClose: () => void;
  onMinimize: () => void;
  onFocus: () => void;
  onMove: (x: number, y: number) => void;
}) {
  const onMoveRef = useRef(onMove);
  useEffect(() => { onMoveRef.current = onMove; });

  const startDrag = (e: React.MouseEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest("button")) return;
    e.preventDefault();
    onFocus();
    const sx = e.clientX, sy = e.clientY, wx = win.x, wy = win.y;

    const move = (ev: MouseEvent) => {
      const nx = Math.max(0, Math.min(wx + ev.clientX - sx, window.innerWidth - win.width));
      const ny = Math.max(0, Math.min(wy + ev.clientY - sy, window.innerHeight - win.height - 40));
      onMoveRef.current(nx, ny);
    };
    const up = () => { window.removeEventListener("mousemove", move); window.removeEventListener("mouseup", up); };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
  };

  return (
    <div
      style={{ position: "fixed", left: win.x, top: win.y, width: win.width, zIndex: win.z }}
      className="flex flex-col bg-white rounded-xl border border-gray-200 shadow-2xl overflow-hidden print:hidden"
      onMouseDown={onFocus}
    >
      <div
        onMouseDown={startDrag}
        className="flex items-center justify-between px-3 py-2 bg-slate-800 cursor-move select-none shrink-0"
      >
        <span className="text-white text-sm font-medium truncate">{win.title}</span>
        <div className="flex items-center gap-1.5 ml-2 shrink-0">
          <button
            onClick={onMinimize}
            className="w-4 h-4 rounded-full bg-yellow-400 hover:bg-yellow-300 flex items-center justify-center transition-colors"
            title="Minimize"
          >
            <Minus className="w-2.5 h-2.5 text-yellow-900" />
          </button>
          <button
            onClick={onClose}
            className="w-4 h-4 rounded-full bg-red-500 hover:bg-red-400 flex items-center justify-center transition-colors"
            title="Close"
          >
            <X className="w-2.5 h-2.5 text-white" />
          </button>
        </div>
      </div>
      <div style={{ height: win.height, overflowY: "auto" }} className="p-4">
        {win.content}
      </div>
    </div>
  );
}
