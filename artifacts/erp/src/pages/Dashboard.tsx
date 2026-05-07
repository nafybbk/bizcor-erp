import { useEffect, useState } from "react";
import { api, fmt } from "@/lib/api";
import { TrendingUp, ShoppingCart, CreditCard, FileBarChart2, Loader2, AlertTriangle, Clock, XCircle, Archive } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from "recharts";

interface Summary {
  totalSales: number; totalPurchases: number; totalReceivables: number; totalPayables: number;
  salesCount: number; purchaseCount: number; gstPayable: number; lowStockItems: number;
}

interface BusinessInfo {
  isTrial: boolean;
  planExpiresAt: string | null;
  planStartDate: string | null;
  status: string;
  planId: number | null;
}

function StatCard({ label, value, sub, icon, color }: { label: string; value: string; sub?: string; icon: React.ReactNode; color: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 flex items-start gap-4">
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${color}`}>
        {icon}
      </div>
      <div className="min-w-0">
        <div className="text-sm text-gray-500">{label}</div>
        <div className="text-xl font-bold text-gray-900 mt-0.5">{value}</div>
        {sub && <div className="text-xs text-gray-400 mt-0.5">{sub}</div>}
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
    // Has a paid plan — show green if still valid
    if (daysLeft > 30) return null;
    if (isExpired) {
      return (
        <div className="flex items-center gap-3 px-4 py-3 bg-red-50 border border-red-200 rounded-xl">
          <XCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
          <div className="flex-1">
            <span className="text-sm font-semibold text-red-700">Plan Expired — </span>
            <span className="text-sm text-red-600">Apna plan renew karo, warna features band ho jayenge.</span>
          </div>
          <a href="/settings/subscription" className="text-xs bg-red-600 text-white px-3 py-1.5 rounded-lg hover:bg-red-700 whitespace-nowrap">Renew Now</a>
        </div>
      );
    }
    return (
      <div className="flex items-center gap-3 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl">
        <Clock className="w-5 h-5 text-amber-500 flex-shrink-0" />
        <div className="flex-1">
          <span className="text-sm font-semibold text-amber-700">Plan {daysLeft} din mein expire hoga — </span>
          <span className="text-sm text-amber-600">Abhi renew karo uninterrupted access ke liye.</span>
        </div>
        <a href="/settings/subscription" className="text-xs bg-amber-600 text-white px-3 py-1.5 rounded-lg hover:bg-amber-700 whitespace-nowrap">Renew</a>
      </div>
    );
  }

  // Trial logic
  if (isExpired) {
    return (
      <div className="flex items-center gap-3 px-4 py-3 bg-red-50 border border-red-200 rounded-xl">
        <XCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
        <div className="flex-1">
          <span className="text-sm font-semibold text-red-700">Free Trial Khatam! — </span>
          <span className="text-sm text-red-600">Plan activate karo ya License Voucher redeem karo.</span>
        </div>
        <a href="/settings/subscription" className="text-xs bg-red-600 text-white px-3 py-1.5 rounded-lg hover:bg-red-700 whitespace-nowrap">Plan Lelo</a>
      </div>
    );
  }

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
          <span className={`text-sm font-semibold ${textColor}`}>
            Free Trial: {daysLeft} din bacha hai{isExpiringSoon ? " ⚡" : ""}
          </span>
          <span className={`text-sm ${subColor} ml-1`}>
            — {isExpiringSoon ? "Jaldi plan lo!" : "Plan activate karo unlimited access ke liye."}
          </span>
        </div>
        <a href="/settings/subscription" className={`text-xs px-3 py-1.5 rounded-lg whitespace-nowrap text-white ${isExpiringSoon ? "bg-red-600 hover:bg-red-700" : "bg-blue-600 hover:bg-blue-700"}`}>
          Plan Dekhein
        </a>
      </div>
      <div className="w-full h-1.5 bg-white/60 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${barPct}%` }} />
      </div>
      <div className={`text-xs ${subColor} mt-1`}>
        Trial {expiresAt.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })} tak
      </div>
    </div>
  );
}

function BinMonthEndAlert({ binCount }: { binCount: number }) {
  const now = new Date();
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const daysLeft = lastDay - now.getDate();
  if (binCount === 0 || daysLeft > 5) return null;
  return (
    <div className="flex items-start gap-3 px-4 py-3 bg-orange-50 border border-orange-300 rounded-xl">
      <Archive className="w-5 h-5 text-orange-500 flex-shrink-0 mt-0.5" />
      <div className="flex-1">
        <span className="text-sm font-semibold text-orange-800">
          Month end mein {daysLeft} din bache hain —{" "}
        </span>
        <span className="text-sm text-orange-700">
          Bin mein <strong>{binCount}</strong> {binCount === 1 ? "doc hai" : "docs hain"}. Invoice banate waqt "Bin se lo" se use ya Bin mein permanently delete karo.
        </span>
      </div>
      <a href="/vouchers/bin" className="text-xs bg-orange-500 text-white px-3 py-1.5 rounded-lg hover:bg-orange-600 whitespace-nowrap">
        Bin Dekho
      </a>
    </div>
  );
}

export default function Dashboard() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [trend, setTrend] = useState<any[]>([]);
  const [topParties, setTopParties] = useState<any[]>([]);
  const [bizInfo, setBizInfo] = useState<BusinessInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState("this_month");
  const [binCount, setBinCount] = useState(0);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.get<Summary>(`/dashboard/summary?period=${period}`),
      api.get<{ data: any[] }>("/dashboard/sales-trend"),
      api.get<{ data: any[] }>("/dashboard/top-parties?type=customer&limit=5"),
      api.get<any>("/businesses/current").catch(() => null),
      api.get<any[]>("/bin").catch(() => []),
    ]).then(([s, t, p, b, bin]) => {
      setSummary(s);
      setTrend(t.data);
      setTopParties(p.data);
      if (b) setBizInfo({ isTrial: b.isTrial, planExpiresAt: b.planExpiresAt, planStartDate: b.planStartDate, status: b.status, planId: b.planId });
      setBinCount(Array.isArray(bin) ? bin.length : 0);
    }).catch(console.error).finally(() => setLoading(false));
  }, [period]);

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="w-6 h-6 animate-spin text-blue-500" /></div>;
  }

  const s = summary!;

  return (
    <div className="space-y-6 max-w-6xl">
      {bizInfo && <TrialBanner biz={bizInfo} />}
      <BinMonthEndAlert binCount={binCount} />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-sm text-gray-500 mt-0.5">Welcome back! Here's your business overview.</p>
        </div>
        <select value={period} onChange={e => setPeriod(e.target.value)} className="text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="today">Today</option>
          <option value="this_month">This Month</option>
          <option value="last_month">Last Month</option>
          <option value="this_year">This Year</option>
        </select>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Sales" value={fmt.currency(s.totalSales)} sub={`${s.salesCount} invoices`} icon={<TrendingUp className="w-5 h-5 text-blue-600" />} color="bg-blue-50" />
        <StatCard label="Total Purchases" value={fmt.currency(s.totalPurchases)} sub={`${s.purchaseCount} bills`} icon={<ShoppingCart className="w-5 h-5 text-purple-600" />} color="bg-purple-50" />
        <StatCard label="Receivables" value={fmt.currency(s.totalReceivables)} sub="Outstanding" icon={<CreditCard className="w-5 h-5 text-emerald-600" />} color="bg-emerald-50" />
        <StatCard label="Payables" value={fmt.currency(s.totalPayables)} sub="Outstanding" icon={<CreditCard className="w-5 h-5 text-red-600" />} color="bg-red-50" />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-2 mb-1">
            <FileBarChart2 className="w-4 h-4 text-orange-500" />
            <span className="text-sm font-medium text-gray-700">GST Payable (This Month)</span>
          </div>
          <div className="text-2xl font-bold text-gray-900">{fmt.currency(s.gstPayable)}</div>
        </div>
        {s.lowStockItems > 0 && (
          <div className="bg-amber-50 rounded-xl border border-amber-200 p-4">
            <div className="flex items-center gap-2 mb-1">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              <span className="text-sm font-medium text-amber-700">Low Stock Alert</span>
            </div>
            <div className="text-2xl font-bold text-amber-900">{s.lowStockItems} items</div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Sales & Purchases (Last 12 Months)</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={trend} barSize={8}>
              <XAxis dataKey="month" tick={{ fontSize: 10 }} tickFormatter={v => v.slice(5)} />
              <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `₹${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(val: number) => fmt.currency(val)} />
              <Legend />
              <Bar dataKey="sales" name="Sales" fill="#3b82f6" radius={[3, 3, 0, 0]} />
              <Bar dataKey="purchases" name="Purchases" fill="#8b5cf6" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Top Customers</h3>
          {topParties.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">No data yet</p>
          ) : (
            <div className="space-y-3">
              {topParties.map((p, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 text-xs flex items-center justify-center font-bold flex-shrink-0">{i + 1}</div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-800 truncate">{p.partyName || "Unknown"}</div>
                    <div className="text-xs text-gray-400">{p.invoiceCount} invoices</div>
                  </div>
                  <div className="text-sm font-semibold text-gray-900 flex-shrink-0">{fmt.currency(p.totalAmount)}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
