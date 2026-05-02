import { useEffect, useState } from "react";
import { api, fmt } from "@/lib/api";
import { TrendingUp, ShoppingCart, CreditCard, Package, FileBarChart2, Loader2, AlertTriangle } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from "recharts";

interface Summary {
  totalSales: number; totalPurchases: number; totalReceivables: number; totalPayables: number;
  salesCount: number; purchaseCount: number; gstPayable: number; lowStockItems: number;
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

export default function Dashboard() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [trend, setTrend] = useState<any[]>([]);
  const [topParties, setTopParties] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState("this_month");

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.get<Summary>(`/dashboard/summary?period=${period}`),
      api.get<{ data: any[] }>("/dashboard/sales-trend"),
      api.get<{ data: any[] }>("/dashboard/top-parties?type=customer&limit=5"),
    ]).then(([s, t, p]) => {
      setSummary(s);
      setTrend(t.data);
      setTopParties(p.data);
    }).catch(console.error).finally(() => setLoading(false));
  }, [period]);

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="w-6 h-6 animate-spin text-blue-500" /></div>;
  }

  const s = summary!;

  return (
    <div className="space-y-6 max-w-6xl">
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
