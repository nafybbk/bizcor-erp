import { useEffect, useState } from "react";
import { api, fmt } from "@/lib/api";
import { Search, Loader2, Edit2, Download, X, CreditCard } from "lucide-react";

export default function AdminBusinesses() {
  const [businesses, setBusinesses] = useState<any[]>([]);
  const [plans, setPlans] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);
  const [editBiz, setEditBiz] = useState<any>(null);
  const [editForm, setEditForm] = useState({ status: "", planId: "", isTrial: false, planExpiresAt: "" });
  const [saving, setSaving] = useState(false);
  const limit = 20;

  const load = () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (search) params.set("search", search);
    if (statusFilter) params.set("status", statusFilter);
    Promise.all([
      api.get<any>(`/super-admin/businesses?${params}`),
      api.get<any>("/super-admin/plans"),
    ]).then(([r, p]) => {
      setBusinesses(r.data); setTotal(r.total);
      setPlans(p.data || []);
    }).catch(console.error).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [page, search, statusFilter]);

  const openEdit = (b: any) => {
    setEditBiz(b);
    setEditForm({
      status: b.status,
      planId: b.planId ? String(b.planId) : "",
      isTrial: b.isTrial || false,
      planExpiresAt: b.planExpiresAt ? new Date(b.planExpiresAt).toISOString().split("T")[0] : "",
    });
  };

  const saveEdit = async () => {
    setSaving(true);
    try {
      await api.patch(`/super-admin/businesses/${editBiz.id}`, {
        status: editForm.status,
        planId: editForm.planId ? Number(editForm.planId) : null,
        isTrial: editForm.isTrial,
        planExpiresAt: editForm.planExpiresAt || null,
      });
      setEditBiz(null); load();
    } finally { setSaving(false); }
  };

  const downloadBackup = async (id: number, code: string) => {
    const token = localStorage.getItem("erp_token");
    const res = await fetch(`${import.meta.env.BASE_URL}api/super-admin/backup?businessId=${id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `backup-${code}-${Date.now()}.json`;
    a.click(); URL.revokeObjectURL(url);
  };

  const downloadAllBackup = async () => {
    const token = localStorage.getItem("erp_token");
    const res = await fetch(`${import.meta.env.BASE_URL}api/super-admin/backup`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `backup-all-${Date.now()}.json`;
    a.click(); URL.revokeObjectURL(url);
  };

  const inputCls = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";

  return (
    <div className="max-w-6xl space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">All Businesses <span className="text-gray-400 text-base font-normal">({total})</span></h1>
        <button onClick={downloadAllBackup} className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg">
          <Download className="w-4 h-4" /> Backup All
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} placeholder="Search by name..."
              className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">All Status</option>
            <option value="active">Active</option>
            <option value="trial">Trial</option>
            <option value="inactive">Inactive</option>
            <option value="suspended">Suspended</option>
          </select>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-48"><Loader2 className="w-5 h-5 animate-spin text-blue-500" /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-600">
                <tr>
                  <th className="text-left px-4 py-3 font-medium">#</th>
                  <th className="text-left px-4 py-3 font-medium">Business</th>
                  <th className="text-left px-4 py-3 font-medium">Code</th>
                  <th className="text-left px-4 py-3 font-medium">Plan</th>
                  <th className="text-left px-4 py-3 font-medium">Expires</th>
                  <th className="text-center px-4 py-3 font-medium">Status</th>
                  <th className="text-center px-4 py-3 font-medium">Users</th>
                  <th className="text-left px-4 py-3 font-medium">Registered</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {businesses.map((b, idx) => (
                  <tr key={b.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-400 text-xs">{(page - 1) * limit + idx + 1}</td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{b.name}</div>
                      {b.gstin && <div className="text-xs text-gray-400 font-mono">{b.gstin}</div>}
                    </td>
                    <td className="px-4 py-3 font-mono text-blue-600 font-bold">{b.businessCode}</td>
                    <td className="px-4 py-3">
                      <div className="text-xs">
                        {b.planName ? <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">{b.planName}</span> : <span className="text-gray-400">No plan</span>}
                        {b.isTrial && <span className="ml-1 bg-orange-100 text-orange-600 px-1.5 py-0.5 rounded-full text-xs">Trial</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">
                      {b.planExpiresAt ? fmt.date(b.planExpiresAt) : "-"}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${b.status === "active" ? "bg-green-100 text-green-700" : b.status === "trial" ? "bg-orange-100 text-orange-600" : b.status === "suspended" ? "bg-red-100 text-red-600" : "bg-gray-100 text-gray-600"}`}>
                        {b.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center text-gray-600">{b.userCount}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{fmt.date(b.createdAt)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => openEdit(b)} className="p-1.5 text-blue-500 hover:bg-blue-50 rounded-lg" title="Edit"><Edit2 className="w-3.5 h-3.5" /></button>
                        <button onClick={() => downloadBackup(b.id, b.businessCode)} className="p-1.5 text-green-500 hover:bg-green-50 rounded-lg" title="Download backup"><Download className="w-3.5 h-3.5" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {total > limit && (
          <div className="p-4 border-t border-gray-100 flex items-center justify-between text-sm text-gray-600">
            <span>Showing {(page - 1) * limit + 1}–{Math.min(page * limit, total)} of {total}</span>
            <div className="flex gap-2">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="px-3 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40">Prev</button>
              <button onClick={() => setPage(p => p + 1)} disabled={page * limit >= total} className="px-3 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40">Next</button>
            </div>
          </div>
        )}
      </div>

      {/* Edit Modal */}
      {editBiz && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={e => e.target === e.currentTarget && setEditBiz(null)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="text-lg font-semibold">Edit Business — {editBiz.name}</h2>
              <button onClick={() => setEditBiz(null)}><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                <select className={inputCls} value={editForm.status} onChange={e => setEditForm(f => ({ ...f, status: e.target.value }))}>
                  <option value="active">Active</option>
                  <option value="trial">Trial</option>
                  <option value="inactive">Inactive</option>
                  <option value="suspended">Suspended</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Assign Plan</label>
                <select className={inputCls} value={editForm.planId} onChange={e => setEditForm(f => ({ ...f, planId: e.target.value }))}>
                  <option value="">No Plan</option>
                  {plans.filter(p => p.isActive).map(p => (
                    <option key={p.id} value={p.id}>{p.name} — ₹{p.price}/{p.billingCycle === "monthly" ? "mo" : "yr"}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Plan Expiry Date</label>
                <input type="date" className={inputCls} value={editForm.planExpiresAt} onChange={e => setEditForm(f => ({ ...f, planExpiresAt: e.target.value }))} />
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={editForm.isTrial} onChange={e => setEditForm(f => ({ ...f, isTrial: e.target.checked }))} className="rounded" />
                <span className="text-sm text-gray-700">On Free Trial</span>
              </label>
            </div>
            <div className="px-6 py-4 border-t flex justify-end gap-3">
              <button onClick={() => setEditBiz(null)} className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50">Cancel</button>
              <button onClick={saveEdit} disabled={saving} className="flex items-center gap-2 px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium disabled:opacity-60">
                {saving && <Loader2 className="w-4 h-4 animate-spin" />} Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
