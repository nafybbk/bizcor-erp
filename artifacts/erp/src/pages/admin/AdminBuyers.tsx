import { useEffect, useState } from "react";
import { api, fmt } from "@/lib/api";
import { Users, Search, Loader2, ShoppingBag, TrendingUp, AlertCircle, CheckCircle2, Clock } from "lucide-react";

const STATUS_OPTIONS = [
  { value: "", label: "All Buyers" },
  { value: "active", label: "Active" },
  { value: "expired", label: "Expired" },
  { value: "trial", label: "Trial" },
];

export default function AdminBuyers() {
  const [buyers, setBuyers] = useState<any[]>([]);
  const [plans, setPlans] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [planFilter, setPlanFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);
  const limit = 25;

  const load = () => {
    setLoading(true);
    const p = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (search) p.set("search", search);
    if (planFilter) p.set("planId", planFilter);
    if (statusFilter) p.set("status", statusFilter);
    Promise.all([
      api.get<any>(`/super-admin/buyers?${p}`),
      api.get<any>("/super-admin/plans"),
    ]).then(([b, pl]) => {
      setBuyers(b.data);
      setTotal(b.total);
      setTotalRevenue(b.totalRevenue || 0);
      setPlans(pl.data || []);
    }).catch(console.error).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [page, search, planFilter, statusFilter]);

  const statusBadge = (buyer: any) => {
    if (buyer.isTrial) return <span className="text-xs px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 font-medium">Trial</span>;
    if (buyer.isExpired) return <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-600 font-medium">Expired</span>;
    return <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-medium">Active</span>;
  };

  const daysLeft = (expiresAt: string | null) => {
    if (!expiresAt) return null;
    const diff = Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 86400000);
    return diff;
  };

  return (
    <div className="max-w-7xl space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <ShoppingBag className="w-6 h-6 text-green-600" /> Buyers List
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">Jin businesses ne plan liya hai</p>
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
            <Users className="w-5 h-5 text-green-600" />
          </div>
          <div>
            <div className="text-2xl font-bold text-gray-900">{total}</div>
            <div className="text-xs text-gray-500">Total Buyers</div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
            <TrendingUp className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <div className="text-2xl font-bold text-gray-900">₹{Number(totalRevenue).toLocaleString("en-IN")}</div>
            <div className="text-xs text-gray-500">Estimated Revenue</div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
            <Clock className="w-5 h-5 text-amber-600" />
          </div>
          <div>
            <div className="text-2xl font-bold text-gray-900">
              {buyers.filter(b => {
                const d = daysLeft(b.planExpiresAt);
                return d !== null && d >= 0 && d <= 30 && !b.isTrial;
              }).length}
            </div>
            <div className="text-xs text-gray-500">Renewing in 30 days</div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-48">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
              placeholder="Naam, email, code, voucher search..."
              className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
          </div>
          <select value={planFilter} onChange={e => { setPlanFilter(e.target.value); setPage(1); }}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500">
            <option value="">All Plans</option>
            {plans.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500">
            {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-48">
            <Loader2 className="w-5 h-5 animate-spin text-green-500" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-600">
                <tr>
                  <th className="text-left px-4 py-3 font-medium">#</th>
                  <th className="text-left px-4 py-3 font-medium">Business</th>
                  <th className="text-left px-4 py-3 font-medium">Plan</th>
                  <th className="text-center px-4 py-3 font-medium">Users</th>
                  <th className="text-left px-4 py-3 font-medium">Voucher Used</th>
                  <th className="text-left px-4 py-3 font-medium">Active From</th>
                  <th className="text-left px-4 py-3 font-medium">Expires</th>
                  <th className="text-center px-4 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {buyers.length === 0 && (
                  <tr>
                    <td colSpan={8} className="text-center py-16 text-gray-400">
                      <ShoppingBag className="w-10 h-10 mx-auto mb-2 opacity-20" />
                      No buyers found
                    </td>
                  </tr>
                )}
                {buyers.map((b, idx) => {
                  const dl = daysLeft(b.planExpiresAt);
                  const isExpiringSoon = dl !== null && dl >= 0 && dl <= 15 && !b.isTrial;
                  return (
                    <tr key={b.id} className={`hover:bg-gray-50 ${isExpiringSoon ? "bg-amber-50/40" : ""}`}>
                      <td className="px-4 py-3 text-gray-400 text-xs">{(page - 1) * limit + idx + 1}</td>
                      <td className="px-4 py-3">
                        <div className="font-semibold text-gray-900">{b.name}</div>
                        <div className="text-xs text-gray-500 mt-0.5 space-x-2">
                          <span className="font-mono">{b.businessCode}</span>
                          {b.email && <span>· {b.email}</span>}
                          {b.phone && <span>· {b.phone}</span>}
                        </div>
                        {(b.city || b.state) && (
                          <div className="text-xs text-gray-400">{[b.city, b.state].filter(Boolean).join(", ")}</div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className="bg-blue-100 text-blue-700 text-xs px-2 py-0.5 rounded-full font-medium">{b.planName}</span>
                        {b.planPrice && (
                          <div className="text-xs text-gray-400 mt-0.5">₹{Number(b.planPrice).toLocaleString("en-IN")}/mo</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="inline-flex items-center gap-1 text-xs text-gray-600">
                          <Users className="w-3.5 h-3.5 text-gray-400" />
                          <span className="font-medium">{b.userCount}</span>
                          <span className="text-gray-400">/ {b.maxUsers}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {b.voucherCode
                          ? <span className="font-mono text-xs text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded">{b.voucherCode}</span>
                          : <span className="text-gray-300 text-xs">—</span>}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-600">
                        {b.planStartDate ? fmt.date(b.planStartDate) : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        {b.planExpiresAt ? (
                          <div>
                            <div className="text-xs text-gray-700">{fmt.date(b.planExpiresAt)}</div>
                            {dl !== null && (
                              <div className={`text-xs mt-0.5 flex items-center gap-1 ${dl < 0 ? "text-red-500" : dl <= 15 ? "text-amber-600" : "text-gray-400"}`}>
                                {dl < 0 ? <AlertCircle className="w-3 h-3" /> : dl <= 15 ? <Clock className="w-3 h-3" /> : <CheckCircle2 className="w-3 h-3" />}
                                {dl < 0 ? `Expired ${Math.abs(dl)} days ago` : dl === 0 ? "Expires today" : `${dl} days left`}
                              </div>
                            )}
                          </div>
                        ) : <span className="text-gray-300 text-xs">—</span>}
                      </td>
                      <td className="px-4 py-3 text-center">{statusBadge(b)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {total > limit && (
          <div className="p-4 border-t border-gray-100 flex items-center justify-between text-sm text-gray-600">
            <span>{(page - 1) * limit + 1}–{Math.min(page * limit, total)} of {total}</span>
            <div className="flex gap-2">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                className="px-3 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40">Prev</button>
              <button onClick={() => setPage(p => p + 1)} disabled={page * limit >= total}
                className="px-3 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40">Next</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
