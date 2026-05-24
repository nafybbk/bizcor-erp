import { useEffect, useRef, useState } from "react";
import { api, fmt } from "@/lib/api";
import {
  TrendingUp, ShoppingCart, CreditCard, FileBarChart2,
  AlertTriangle, Clock, XCircle, FilePlus, Receipt,
  Users, Package, ChevronRight, RefreshCw, Palette, X, RotateCcw,
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from "recharts";

// ─── Background Customizer ────────────────────────────────────────────────────

type BgMode = "color" | "image";
interface BgConfig { color: string; pattern: string; patternOpacity: number; mode: BgMode; image?: string; imageOpacity: number; }
const BG_KEY = "bizcor_dash_bg";
const DEFAULT_BG: BgConfig = { color: "#f8fafc", pattern: "none", patternOpacity: 0.4, mode: "color", imageOpacity: 0.15 };

const PRESET_COLORS = [
  { label: "Default", value: "#f8fafc" },
  { label: "White",   value: "#ffffff" },
  { label: "Blue",    value: "#eff6ff" },
  { label: "Green",   value: "#f0fdf4" },
  { label: "Purple",  value: "#faf5ff" },
  { label: "Amber",   value: "#fffbeb" },
  { label: "Pink",    value: "#fdf2f8" },
  { label: "Teal",    value: "#f0fdfa" },
  { label: "Slate",   value: "#f1f5f9" },
  { label: "Dark",    value: "#1e293b" },
  { label: "Navy",    value: "#0f172a" },
  { label: "Forest",  value: "#052e16" },
];

const PATTERNS: { label: string; value: string; preview: (c: string, o: number) => string }[] = [
  { label: "None",      value: "none",      preview: () => "none" },
  { label: "Dots",      value: "dots",      preview: (c, o) => `radial-gradient(circle, ${hexAlpha(c, o)} 1.5px, transparent 1.5px)` },
  { label: "Grid",      value: "grid",      preview: (c, o) => `linear-gradient(${hexAlpha(c, o)} 1px, transparent 1px), linear-gradient(90deg, ${hexAlpha(c, o)} 1px, transparent 1px)` },
  { label: "Diagonal",  value: "diagonal",  preview: (c, o) => `repeating-linear-gradient(45deg, ${hexAlpha(c, o)}, ${hexAlpha(c, o)} 1px, transparent 1px, transparent 10px)` },
  { label: "Cross",     value: "cross",     preview: (c, o) => `repeating-linear-gradient(0deg, ${hexAlpha(c, o)}, ${hexAlpha(c, o)} 1px, transparent 1px, transparent 14px), repeating-linear-gradient(90deg, ${hexAlpha(c, o)}, ${hexAlpha(c, o)} 1px, transparent 1px, transparent 14px)` },
  { label: "Waves",     value: "waves",     preview: (c, o) => `repeating-linear-gradient(-45deg, transparent, transparent 5px, ${hexAlpha(c, o)} 5px, ${hexAlpha(c, o)} 6px)` },
  { label: "Zigzag",    value: "zigzag",    preview: (c, o) => `linear-gradient(135deg, ${hexAlpha(c, o)} 25%, transparent 25%), linear-gradient(225deg, ${hexAlpha(c, o)} 25%, transparent 25%), linear-gradient(315deg, ${hexAlpha(c, o)} 25%, transparent 25%), linear-gradient(45deg, ${hexAlpha(c, o)} 25%, transparent 25%)` },
];

function hexAlpha(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function patternColor(base: string): string {
  // Contrast color for pattern lines
  const r = parseInt(base.slice(1, 3), 16);
  const g = parseInt(base.slice(3, 5), 16);
  const b = parseInt(base.slice(5, 7), 16);
  const lum = (r * 299 + g * 587 + b * 114) / 1000;
  return lum > 128 ? "#000000" : "#ffffff";
}

function getBgStyle(cfg: BgConfig): React.CSSProperties {
  if (cfg.mode === "image" && cfg.image) {
    return { backgroundColor: cfg.color };
  }
  const pc = patternColor(cfg.color);
  const pat = PATTERNS.find(p => p.value === cfg.pattern) || PATTERNS[0];
  const bgImage = cfg.pattern === "none" ? "none" : pat.preview(pc, cfg.patternOpacity);
  const bgSize = cfg.pattern === "dots" ? "20px 20px"
    : cfg.pattern === "grid" ? "20px 20px"
    : cfg.pattern === "zigzag" ? "16px 16px"
    : "";
  return {
    backgroundColor: cfg.color,
    backgroundImage: bgImage,
    backgroundSize: bgSize || undefined,
  };
}

function readBgConfig(): BgConfig {
  try { const r = localStorage.getItem(BG_KEY); return r ? { ...DEFAULT_BG, ...JSON.parse(r) } : DEFAULT_BG; } catch { return DEFAULT_BG; }
}
function saveBgConfig(cfg: BgConfig) {
  try { localStorage.setItem(BG_KEY, JSON.stringify(cfg)); } catch { /* ignore */ }
}

function BgPicker({ cfg, onChange, onClose }: { cfg: BgConfig; onChange: (c: BgConfig) => void; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [imgErr, setImgErr] = useState("");
  const activeMode = cfg.mode ?? "color";

  useEffect(() => {
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) onClose(); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const set = (patch: Partial<BgConfig>) => { const next = { ...cfg, ...patch }; onChange(next); saveBgConfig(next); };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { setImgErr("Image 2MB se chhota hona chahiye"); return; }
    setImgErr("");
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      try {
        set({ image: dataUrl, mode: "image" });
      } catch {
        setImgErr("Image save nahi ho saka (storage full)");
      }
    };
    reader.readAsDataURL(file);
  };

  return (
    <div ref={ref} className="absolute top-full right-0 mt-2 z-50 bg-white rounded-2xl shadow-2xl border border-gray-200 w-80 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <span className="text-sm font-semibold text-gray-800">Dashboard Background</span>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
      </div>

      {/* Mode tabs */}
      <div className="flex border-b border-gray-100">
        <button onClick={() => set({ mode: "color" })}
          className={`flex-1 text-xs py-2 font-medium transition-colors ${activeMode === "color" ? "text-blue-600 border-b-2 border-blue-600 bg-blue-50/50" : "text-gray-500 hover:text-gray-700"}`}>
          Color & Pattern
        </button>
        <button onClick={() => set({ mode: "image" })}
          className={`flex-1 text-xs py-2 font-medium transition-colors ${activeMode === "image" ? "text-blue-600 border-b-2 border-blue-600 bg-blue-50/50" : "text-gray-500 hover:text-gray-700"}`}>
          Image
        </button>
      </div>

      <div className="p-4 space-y-3">

        {activeMode === "color" && (<>
          {/* Color Swatches */}
          <div>
            <div className="text-xs font-medium text-gray-500 mb-2">Background Color</div>
            <div className="flex flex-wrap gap-2">
              {PRESET_COLORS.map(c => (
                <button key={c.value} title={c.label} onClick={() => set({ color: c.value })}
                  className={`w-7 h-7 rounded-lg border-2 transition-transform hover:scale-110 ${cfg.color === c.value ? "border-blue-500 scale-110 shadow-md" : "border-gray-200"}`}
                  style={{ backgroundColor: c.value }} />
              ))}
              <label className="w-7 h-7 rounded-lg border-2 border-dashed border-gray-300 flex items-center justify-center cursor-pointer hover:border-blue-400" title="Custom color">
                <span className="text-gray-400 text-xs font-bold">+</span>
                <input type="color" value={cfg.color} onChange={e => set({ color: e.target.value })} className="sr-only" />
              </label>
            </div>
          </div>

          {/* Patterns */}
          <div>
            <div className="text-xs font-medium text-gray-500 mb-2">Pattern</div>
            <div className="grid grid-cols-4 gap-1.5">
              {PATTERNS.map(p => {
                const pc = patternColor(cfg.color);
                const previewStyle: React.CSSProperties = {
                  backgroundColor: cfg.color,
                  backgroundImage: p.value === "none" ? "none" : p.preview(pc, 0.35),
                  backgroundSize: p.value === "dots" || p.value === "grid" ? "10px 10px" : p.value === "zigzag" ? "8px 8px" : "",
                };
                return (
                  <button key={p.value} onClick={() => set({ pattern: p.value })}
                    className={`h-10 rounded-lg border-2 transition-all ${cfg.pattern === p.value ? "border-blue-500 shadow-sm" : "border-gray-200 hover:border-gray-300"}`}
                    style={previewStyle} title={p.label}>
                    <span className="sr-only">{p.label}</span>
                  </button>
                );
              })}
            </div>
            <div className="grid grid-cols-4 gap-1.5 mt-1">
              {PATTERNS.map(p => (
                <span key={p.value} className={`text-[9px] text-center ${cfg.pattern === p.value ? "text-blue-600 font-semibold" : "text-gray-400"}`}>{p.label}</span>
              ))}
            </div>
          </div>

          {/* Pattern intensity */}
          {cfg.pattern !== "none" && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-gray-500">Pattern Intensity</span>
                <span className="text-xs text-gray-400">{Math.round(cfg.patternOpacity * 100)}%</span>
              </div>
              <input type="range" min={5} max={80} value={Math.round(cfg.patternOpacity * 100)}
                onChange={e => set({ patternOpacity: Number(e.target.value) / 100 })}
                className="w-full accent-blue-500" />
            </div>
          )}
        </>)}

        {activeMode === "image" && (<>
          {/* Image upload */}
          {cfg.image ? (
            <div className="space-y-3">
              {/* Preview */}
              <div className="relative rounded-xl overflow-hidden border border-gray-200 h-32">
                <img src={cfg.image} alt="Background" className="w-full h-full object-cover" />
                <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                  <span className="text-white text-xs font-medium bg-black/40 px-2 py-1 rounded-lg">Preview</span>
                </div>
                <button onClick={() => set({ image: undefined, mode: "color" })}
                  className="absolute top-2 right-2 w-6 h-6 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center transition-colors">
                  <X className="w-3 h-3" />
                </button>
              </div>

              {/* Change image */}
              <label className="flex items-center justify-center gap-2 w-full text-xs text-blue-600 border border-blue-200 bg-blue-50 hover:bg-blue-100 rounded-lg py-2 cursor-pointer transition-colors">
                <Palette className="w-3.5 h-3.5" />
                Change Image
                <input type="file" accept="image/*" onChange={handleImageUpload} className="sr-only" />
              </label>

              {/* Opacity / dim overlay */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium text-gray-500">Image Dimness (overlay)</span>
                  <span className="text-xs text-gray-400">{Math.round(cfg.imageOpacity * 100)}%</span>
                </div>
                <input type="range" min={0} max={85} value={Math.round(cfg.imageOpacity * 100)}
                  onChange={e => set({ imageOpacity: Number(e.target.value) / 100 })}
                  className="w-full accent-blue-500" />
                <div className="flex justify-between text-[9px] text-gray-400 mt-0.5">
                  <span>Full image</span><span>More dim</span>
                </div>
              </div>
            </div>
          ) : (
            <label className="flex flex-col items-center justify-center gap-2 w-full border-2 border-dashed border-gray-300 hover:border-blue-400 rounded-xl py-8 cursor-pointer transition-colors group">
              <div className="w-10 h-10 rounded-full bg-gray-100 group-hover:bg-blue-50 flex items-center justify-center transition-colors">
                <Palette className="w-5 h-5 text-gray-400 group-hover:text-blue-500" />
              </div>
              <div className="text-center">
                <div className="text-sm font-medium text-gray-600 group-hover:text-blue-600">Image select karo</div>
                <div className="text-xs text-gray-400 mt-0.5">JPG, PNG, WebP · max 2MB</div>
              </div>
              <input type="file" accept="image/*" onChange={handleImageUpload} className="sr-only" />
            </label>
          )}

          {imgErr && <div className="text-xs text-red-500 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{imgErr}</div>}
        </>)}

        {/* Reset */}
        <button onClick={() => { onChange(DEFAULT_BG); saveBgConfig(DEFAULT_BG); }}
          className="w-full flex items-center justify-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
          <RotateCcw className="w-3 h-3" /> Reset to Default
        </button>
      </div>
    </div>
  );
}

interface Summary {
  totalSales: number; totalPurchases: number; totalReceivables: number; totalPayables: number;
  salesCount: number; purchaseCount: number; gstPayable: number; lowStockItems: number;
}
interface BusinessInfo {
  isTrial: boolean; planExpiresAt: string | null; planStartDate: string | null;
  status: string; planId: number | null;
}
interface RecentItem { label: string; href: string; time: number; }

// ─── Helpers ────────────────────────────────────────────────────────────────

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good Morning";
  if (h < 17) return "Good Afternoon";
  return "Good Evening";
}

function todayLabel() {
  return new Date().toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
}

export function trackRecentPage(label: string, href: string) {
  try {
    const raw = localStorage.getItem("bizcor_recent");
    let list: RecentItem[] = raw ? JSON.parse(raw) : [];
    list = list.filter(r => r.href !== href);
    list.unshift({ label, href, time: Date.now() });
    localStorage.setItem("bizcor_recent", JSON.stringify(list.slice(0, 6)));
  } catch { /* ignore */ }
}

function getRecentPages(): RecentItem[] {
  try {
    const raw = localStorage.getItem("bizcor_recent");
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function StatCard({ label, value, sub, icon, color }: { label: string; value: string; sub?: string; icon: React.ReactNode; color: string }) {
  return (
    <div className="bg-white/90 backdrop-blur-sm rounded-xl border border-gray-200 p-3 flex items-start gap-2.5 overflow-hidden">
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${color}`}>{icon}</div>
      <div className="min-w-0 flex-1 overflow-hidden">
        <div className="text-xs text-gray-500 truncate">{label}</div>
        <div className="text-base font-bold text-gray-900 mt-0.5 truncate leading-tight">{value}</div>
        {sub && <div className="text-xs text-gray-400 mt-0.5 truncate">{sub}</div>}
      </div>
    </div>
  );
}

function StatSkeleton() {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-start gap-3 animate-pulse">
      <div className="w-9 h-9 rounded-lg bg-gray-100 flex-shrink-0" />
      <div className="flex-1 space-y-2 pt-1">
        <div className="h-2.5 bg-gray-100 rounded w-20" />
        <div className="h-5 bg-gray-100 rounded w-28" />
      </div>
    </div>
  );
}

function TrialBanner({ biz }: { biz: BusinessInfo }) {
  if (!biz.planExpiresAt) return null;
  const expiresAt = new Date(biz.planExpiresAt);
  const now = new Date();
  const daysLeft = Math.ceil((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  const isExpired = daysLeft <= 0;
  const isExpiringSoon = daysLeft <= 5 && !isExpired;

  if (biz.planId && !biz.isTrial) {
    if (daysLeft > 30) return null;
    if (isExpired) return (
      <div className="flex items-center gap-3 px-4 py-3 bg-red-50 border border-red-200 rounded-xl">
        <XCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
        <div className="flex-1"><span className="text-sm font-semibold text-red-700">Plan Expired — </span><span className="text-sm text-red-600">Renew your plan to keep all features active.</span></div>
        <a href="/settings/subscription" className="text-xs bg-red-600 text-white px-3 py-1.5 rounded-lg hover:bg-red-700 whitespace-nowrap">Renew Now</a>
      </div>
    );
    return (
      <div className="flex items-center gap-3 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl">
        <Clock className="w-5 h-5 text-amber-500 flex-shrink-0" />
        <div className="flex-1"><span className="text-sm font-semibold text-amber-700">Plan expires in {daysLeft} days — </span><span className="text-sm text-amber-600">Renew now for uninterrupted access.</span></div>
        <a href="/settings/subscription" className="text-xs bg-amber-600 text-white px-3 py-1.5 rounded-lg hover:bg-amber-700 whitespace-nowrap">Renew</a>
      </div>
    );
  }

  if (isExpired) return (
    <div className="flex items-center gap-3 px-4 py-3 bg-red-50 border border-red-200 rounded-xl">
      <XCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
      <div className="flex-1"><span className="text-sm font-semibold text-red-700">Free Trial Ended — </span><span className="text-sm text-red-600">Activate a plan or redeem a License Voucher.</span></div>
      <a href="/settings/subscription" className="text-xs bg-red-600 text-white px-3 py-1.5 rounded-lg hover:bg-red-700 whitespace-nowrap">Get Plan</a>
    </div>
  );

  const barPct = Math.max(0, Math.min(100, ((30 - daysLeft) / 30) * 100));
  const barColor = isExpiringSoon ? "bg-red-500" : daysLeft <= 15 ? "bg-amber-500" : "bg-blue-500";
  const borderColor = isExpiringSoon ? "border-red-200" : daysLeft <= 15 ? "border-amber-200" : "border-blue-200";
  const bgColor = isExpiringSoon ? "bg-red-50" : daysLeft <= 15 ? "bg-amber-50" : "bg-blue-50";
  const textColor = isExpiringSoon ? "text-red-700" : daysLeft <= 15 ? "text-amber-700" : "text-blue-700";
  const subColor = isExpiringSoon ? "text-red-600" : daysLeft <= 15 ? "text-amber-600" : "text-blue-600";

  return (
    <div className={`px-4 py-3 ${bgColor} border ${borderColor} rounded-xl`}>
      <div className="flex items-center gap-3 mb-2">
        <Clock className={`w-5 h-5 ${textColor} flex-shrink-0`} />
        <div className="flex-1">
          <span className={`text-sm font-semibold ${textColor}`}>Free Trial: {daysLeft} {daysLeft === 1 ? "day" : "days"} left{isExpiringSoon ? " ⚡" : ""}</span>
          <span className={`text-sm ${subColor} ml-1`}>— {isExpiringSoon ? "Renew soon!" : "Activate a plan for unlimited access."}</span>
        </div>
        <a href="/settings/subscription" className={`text-xs px-3 py-1.5 rounded-lg whitespace-nowrap text-white ${isExpiringSoon ? "bg-red-600 hover:bg-red-700" : "bg-blue-600 hover:bg-blue-700"}`}>View Plans</a>
      </div>
      <div className="w-full h-1.5 bg-white/60 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${barPct}%` }} />
      </div>
      <div className={`text-xs ${subColor} mt-1`}>Trial {expiresAt.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })} tak</div>
    </div>
  );
}

// ─── Main ────────────────────────────────────────────────────────────────────

const isDesktopApp = () => !!(window as any).bizcorDesktop;

function readCache(period: string) {
  try {
    const raw = localStorage.getItem(`bizcor_dash_${period}`);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}
function writeCache(period: string, summary: Summary, trend: any[], latestDocs: any[], topCustomers: any[]) {
  try { localStorage.setItem(`bizcor_dash_${period}`, JSON.stringify({ summary, trend, latestDocs, topCustomers, at: Date.now() })); } catch { /* ignore */ }
}

const VOUCHER_TYPE_LABEL: Record<string, string> = {
  sales_invoice: "SI", credit_note: "CN", purchase_bill: "PB", debit_note: "DN",
};
const VOUCHER_TYPE_COLOR: Record<string, string> = {
  sales_invoice: "text-blue-700 bg-blue-50", credit_note: "text-orange-700 bg-orange-50",
  purchase_bill: "text-purple-700 bg-purple-50", debit_note: "text-red-700 bg-red-50",
};
const VOUCHER_TYPE_HREF: Record<string, string> = {
  sales_invoice: "/sales/invoices", credit_note: "/sales/credit-notes",
  purchase_bill: "/purchases/bills", debit_note: "/purchases/debit-notes",
};

export default function Dashboard() {
  const [period, setPeriod] = useState("this_month");
  const [bgCfg, setBgCfg] = useState<BgConfig>(readBgConfig);
  const [showBgPicker, setShowBgPicker] = useState(false);

  // Load cache instantly — no API wait
  const cached = readCache(period);
  const [summary, setSummary]         = useState<Summary | null>(cached?.summary ?? null);
  const [trend, setTrend]             = useState<any[]>(cached?.trend ?? []);
  const [latestDocs, setLatestDocs]   = useState<any[]>(cached?.latestDocs ?? []);
  const [topCustomers, setTopCustomers] = useState<any[]>(cached?.topCustomers ?? []);
  const [bizInfo, setBizInfo]         = useState<BusinessInfo | null>(null);
  const [statsLoading, setStatsLoading] = useState(!cached);
  const [refreshing, setRefreshing]     = useState(false);
  const [loadError, setLoadError]       = useState<string | null>(null);

  // Instant data — no API needed
  const user = (() => { try { return JSON.parse(localStorage.getItem("erp_user") || "{}"); } catch { return {}; } })();
  const biz  = (() => { try { return JSON.parse(localStorage.getItem("erp_business") || "{}"); } catch { return {}; } })();
  const recentPages = getRecentPages();

  const loadData = (showSkeleton = false) => {
    if (showSkeleton) setStatsLoading(true); else setRefreshing(true);
    setLoadError(null);
    Promise.all([
      api.get<Summary>(`/dashboard/summary?period=${period}`).catch((e) => { setLoadError(e?.message || "Server error"); return null; }),
      api.get<{ data: any[] }>("/dashboard/sales-trend").catch(() => ({ data: [] })),
      api.get<any>("/businesses/current").catch(() => null),
      api.get<any>("/sales/invoices?limit=5").catch(() => ({ data: [] })),
      api.get<{ data: any[] }>("/dashboard/top-parties?type=customer&limit=5").catch(() => ({ data: [] })),
    ]).then(([s, t, b, docs, tops]) => {
      const docsArr  = docs?.data  ?? [];
      const topsArr  = tops?.data  ?? [];
      if (s) { setSummary(s); writeCache(period, s, t?.data ?? [], docsArr, topsArr); }
      setTrend(t?.data ?? []);
      setLatestDocs(docsArr);
      setTopCustomers(topsArr);
      if (b) setBizInfo({ isTrial: b.isTrial, planExpiresAt: b.planExpiresAt, planStartDate: b.planStartDate, status: b.status, planId: b.planId });
    }).catch(console.error).finally(() => { setStatsLoading(false); setRefreshing(false); });
  };

  useEffect(() => {
    const c = readCache(period);
    setSummary(c?.summary ?? null);
    setTrend(c?.trend ?? []);
    setLatestDocs(c?.latestDocs ?? []);
    setTopCustomers(c?.topCustomers ?? []);
    loadData(!c);
  }, [period]);

  const quickActions = [
    { label: "New Invoice", icon: <FilePlus className="w-5 h-5" />, href: "/sales/invoices", color: "bg-blue-600 hover:bg-blue-700" },
    { label: "New Receipt", icon: <Receipt className="w-5 h-5" />, href: "/payments", color: "bg-emerald-600 hover:bg-emerald-700" },
    { label: "New Party",   icon: <Users className="w-5 h-5" />,   href: "/parties",  color: "bg-purple-600 hover:bg-purple-700" },
    { label: "New Item",    icon: <Package className="w-5 h-5" />,  href: "/items",    color: "bg-amber-600 hover:bg-amber-700" },
  ];

  return (
    <div className="-m-4 md:-m-6 min-h-full relative overflow-hidden" style={getBgStyle(bgCfg)}>
      {/* Image background layer with dimness overlay */}
      {bgCfg.mode === "image" && bgCfg.image && (<>
        <div className="absolute inset-0 z-0" style={{ backgroundImage: `url(${bgCfg.image})`, backgroundSize: "cover", backgroundPosition: "center", backgroundRepeat: "no-repeat" }} />
        <div className="absolute inset-0 z-0" style={{ backgroundColor: `rgba(0,0,0,${bgCfg.imageOpacity ?? 0.15})` }} />
      </>)}
    <div className="relative z-10 p-4 md:p-6 space-y-5 max-w-6xl">

      {/* ── INSTANT: Greeting + Business Info ── */}
      <div className="bg-white/90 backdrop-blur-sm rounded-xl border border-gray-200 px-5 py-4 flex items-center justify-between gap-4">
        <div>
          <div className="text-lg font-bold text-gray-900">
            {greeting()}{user.name ? `, ${user.name}` : ""}
          </div>
          <div className="text-xs text-gray-400 mt-0.5">{todayLabel()}</div>
          {biz.name && (
            <div className="text-xs text-gray-500 mt-1">
              <span className="font-medium text-gray-700">{biz.name}</span>
              {biz.gstin && <span className="ml-2 text-gray-400">· {biz.gstin}</span>}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {refreshing && <RefreshCw className="w-3.5 h-3.5 text-gray-400 animate-spin" />}
          <select
            value={period}
            onChange={e => setPeriod(e.target.value)}
            className="text-xs border border-gray-300 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="today">Today</option>
            <option value="this_month">This Month</option>
            <option value="last_month">Last Month</option>
            <option value="this_year">This Year</option>
          </select>
          {/* Background Customizer trigger */}
          <div className="relative">
            <button onClick={() => setShowBgPicker(o => !o)}
              title="Customize background"
              className={`p-1.5 rounded-lg border transition-colors ${showBgPicker ? "bg-blue-50 border-blue-300 text-blue-600" : "border-gray-200 text-gray-400 hover:text-gray-600 hover:bg-gray-50"}`}>
              <Palette className="w-4 h-4" />
            </button>
            {showBgPicker && (
              <BgPicker cfg={bgCfg} onChange={setBgCfg} onClose={() => setShowBgPicker(false)} />
            )}
          </div>
        </div>
      </div>

      {/* ── INSTANT: Quick Actions ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {quickActions.map(a => (
          <a key={a.href} href={a.href}
            className={`${a.color} text-white rounded-xl px-4 py-3 flex items-center gap-2.5 transition-colors`}>
            {a.icon}
            <span className="text-sm font-medium">{a.label}</span>
          </a>
        ))}
      </div>

      {/* ── INSTANT: Recently Opened ── */}
      {recentPages.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 px-4 py-3">
          <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2.5">Recently Opened</div>
          <div className="flex flex-wrap gap-2">
            {recentPages.map((r, i) => (
              <a key={i} href={r.href}
                className="flex items-center gap-1.5 text-xs bg-gray-50 hover:bg-gray-100 border border-gray-200 text-gray-700 px-3 py-1.5 rounded-lg transition-colors">
                <ChevronRight className="w-3 h-3 text-gray-400" />
                {r.label}
              </a>
            ))}
          </div>
        </div>
      )}

      {/* ── Trial / Plan Banner (API) ── */}
      {bizInfo && <TrialBanner biz={bizInfo} />}

      {/* ── Stats Cards — skeleton while loading ── */}
      {statsLoading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <StatSkeleton key={i} />)}
        </div>
      ) : !summary ? (
        <div className="flex flex-col items-center justify-center h-40 gap-3 text-center bg-white rounded-xl border border-gray-200">
          <AlertTriangle className="w-7 h-7 text-amber-500" />
          <p className="text-sm text-gray-600">Stats load nahi ho sake</p>
          {isDesktopApp() && loadError && <p className="text-xs text-red-500 font-mono bg-red-50 px-2 py-1 rounded">{loadError}</p>}
          <button onClick={() => loadData(true)} className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
            <RefreshCw className="w-3 h-3" /> Dobara Try Karo
          </button>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label="Total Sales"     value={fmt.currency(summary.totalSales)}     sub={`${summary.salesCount} invoices`}   icon={<TrendingUp  className="w-4 h-4 text-blue-600" />}    color="bg-blue-50" />
            <StatCard label="Total Purchases" value={fmt.currency(summary.totalPurchases)} sub={`${summary.purchaseCount} bills`}   icon={<ShoppingCart className="w-4 h-4 text-purple-600" />} color="bg-purple-50" />
            <StatCard label="Receivables"     value={fmt.currency(summary.totalReceivables)} sub="Outstanding"                      icon={<CreditCard   className="w-4 h-4 text-emerald-600" />} color="bg-emerald-50" />
            <StatCard label="Payables"        value={fmt.currency(summary.totalPayables)}  sub="Outstanding"                       icon={<CreditCard   className="w-4 h-4 text-red-600" />}     color="bg-red-50" />
          </div>

          <div className={`grid gap-4 ${summary.lowStockItems > 0 ? "grid-cols-2" : "grid-cols-1 max-w-xs"}`}>
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex items-center gap-2 mb-1">
                <FileBarChart2 className="w-4 h-4 text-orange-500" />
                <span className="text-xs font-medium text-gray-600">GST Payable (This Month)</span>
              </div>
              <div className="text-xl font-bold text-gray-900">{fmt.currency(summary.gstPayable)}</div>
            </div>
            {summary.lowStockItems > 0 && (
              <div className="bg-amber-50 rounded-xl border border-amber-200 p-4">
                <div className="flex items-center gap-2 mb-1">
                  <AlertTriangle className="w-4 h-4 text-amber-500" />
                  <span className="text-xs font-medium text-amber-700">Low Stock Alert</span>
                </div>
                <div className="text-xl font-bold text-amber-900">{summary.lowStockItems} items</div>
              </div>
            )}
          </div>

          {/* ── Latest Docs + Top Customers ── */}
          {(latestDocs.length > 0 || topCustomers.length > 0) && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

              {/* Latest Invoices */}
              {latestDocs.length > 0 && (
                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                  <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                    <span className="text-sm font-semibold text-gray-700">Latest Invoices</span>
                    <a href="/sales/invoices" className="text-xs text-blue-600 hover:underline">View all</a>
                  </div>
                  <div className="divide-y divide-gray-50">
                    {latestDocs.map((d: any, i: number) => (
                      <a key={i} href={`${VOUCHER_TYPE_HREF[d.voucherType] || "/sales/invoices"}/${d.id}`}
                        className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 transition-colors">
                        <span className={`text-xs font-bold px-1.5 py-0.5 rounded flex-shrink-0 ${VOUCHER_TYPE_COLOR[d.voucherType] || "bg-gray-100 text-gray-600"}`}>
                          {VOUCHER_TYPE_LABEL[d.voucherType] || "DOC"}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-gray-800 truncate">{d.voucherNumber}</div>
                          <div className="text-xs text-gray-400 truncate">{d.partyName || "—"}</div>
                        </div>
                        <div className="text-sm font-semibold text-gray-900 flex-shrink-0">{fmt.currency(d.grandTotal)}</div>
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* Top Customers */}
              {topCustomers.length > 0 && (
                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                  <div className="px-4 py-3 border-b border-gray-100">
                    <span className="text-sm font-semibold text-gray-700">Top Customers</span>
                  </div>
                  <div className="divide-y divide-gray-50">
                    {topCustomers.map((p: any, i: number) => (
                      <div key={i} className="flex items-center gap-3 px-4 py-2.5">
                        <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 text-xs flex items-center justify-center font-bold flex-shrink-0">{i + 1}</div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-gray-800 truncate">{p.partyName || "Unknown"}</div>
                          <div className="text-xs text-gray-400">{p.invoiceCount} invoices</div>
                        </div>
                        <div className="text-sm font-semibold text-gray-900 flex-shrink-0">{fmt.currency(p.totalAmount)}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {trend.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h3 className="text-sm font-semibold text-gray-700 mb-4">Sales & Purchases (Last 12 Months)</h3>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={trend} barSize={8}>
                  <XAxis dataKey="month" tick={{ fontSize: 10 }} tickFormatter={v => v.slice(5)} />
                  <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `₹${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(val: number) => fmt.currency(val)} />
                  <Legend />
                  <Bar dataKey="sales"     name="Sales"     fill="#3b82f6" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="purchases" name="Purchases" fill="#8b5cf6" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </>
      )}
    </div>
    </div>
  );
}
