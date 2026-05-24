import { useEffect, useState } from "react";
import { api, fmt } from "@/lib/api";
import {
  TrendingUp, ShoppingCart, CreditCard, FileBarChart2,
  AlertTriangle, Clock, XCircle, FilePlus, Receipt,
  Users, Package, ChevronRight, RefreshCw,
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from "recharts";

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
    <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-start gap-3">
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${color}`}>{icon}</div>
      <div className="min-w-0">
        <div className="text-xs text-gray-500">{label}</div>
        <div className="text-lg font-bold text-gray-900 mt-0.5">{value}</div>
        {sub && <div className="text-xs text-gray-400 mt-0.5">{sub}</div>}
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
    <div className="space-y-5 max-w-6xl">

      {/* ── INSTANT: Greeting + Business Info ── */}
      <div className="bg-white rounded-xl border border-gray-200 px-5 py-4 flex items-center justify-between gap-4">
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
  );
}
