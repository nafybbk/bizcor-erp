import { useEffect, useState } from "react";
import { api, fmt } from "@/lib/api";
import { Search, Loader2, Edit2, Download, X, CreditCard, Users, CheckCircle2, XCircle, Shield, Gift, Copy, Check, Trash2, AlertTriangle } from "lucide-react";
import { useLang, t } from "@/lib/lang";

const ALL_PERMS = [
  { key: "sales", label: "Sales" },
  { key: "purchases", label: "Purchases" },
  { key: "payments", label: "Payments" },
  { key: "inventory", label: "Inventory" },
  { key: "accounting", label: "Accounting" },
  { key: "gst", label: "GST" },
  { key: "masters", label: "Masters" },
  { key: "settings", label: "Settings" },
];

export default function AdminBusinesses() {
  const lang = useLang();
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

  // Top-up modal
  const [topupBiz, setTopupBiz] = useState<any>(null);
  const [topupDays, setTopupDays] = useState("30");
  const [topupSaving, setTopupSaving] = useState(false);
  const [topupDone, setTopupDone] = useState(false);

  // Users modal state
  const [usersBiz, setUsersBiz] = useState<any>(null);
  const [usersData, setUsersData] = useState<{ users: any[]; planFeatures: string[]; planName: string | null; businessName: string } | null>(null);
  const [usersLoading, setUsersLoading] = useState(false);
  const [editingUser, setEditingUser] = useState<any>(null);
  const [userSaving, setUserSaving] = useState<number | null>(null);

  // Copy referral code
  const [copiedRef, setCopiedRef] = useState<string | null>(null);

  // Permanent delete state
  const [deleteBiz, setDeleteBiz] = useState<any>(null);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  // Cleanup modal state
  const [cleanupBiz, setCleanupBiz] = useState<any>(null);
  const [cleanupTab, setCleanupTab] = useState<"all" | "party">("all");
  const [cleanupConfirmText, setCleanupConfirmText] = useState("");
  const [cleanupLoading, setCleanupLoading] = useState(false);
  const [cleanupResult, setCleanupResult] = useState<any>(null);
  const [cleanupError, setCleanupError] = useState("");
  const [partiesList, setPartiesList] = useState<any[]>([]);
  const [partiesLoading, setPartiesLoading] = useState(false);
  const [partySearch, setPartySearch] = useState("");
  const [selectedParty, setSelectedParty] = useState<any>(null);

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

  const openTopup = (b: any) => {
    setTopupBiz(b);
    setTopupDays("30");
    setTopupDone(false);
  };

  const doTopup = async () => {
    if (!topupBiz || !topupDays || Number(topupDays) <= 0) return;
    setTopupSaving(true);
    try {
      await api.post(`/super-admin/businesses/${topupBiz.id}/topup`, { days: Number(topupDays) });
      setTopupDone(true);
      load();
    } finally { setTopupSaving(false); }
  };

  const copyRef = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedRef(code);
    setTimeout(() => setCopiedRef(null), 2000);
  };

  const openCleanup = async (b: any) => {
    setCleanupBiz(b);
    setCleanupTab("all");
    setCleanupConfirmText("");
    setCleanupResult(null);
    setCleanupError("");
    setSelectedParty(null);
    setPartySearch("");
    setPartiesLoading(true);
    try {
      const data = await api.get<any[]>(`/super-admin/businesses/${b.id}/parties`);
      setPartiesList(Array.isArray(data) ? data : []);
    } catch { setPartiesList([]); }
    finally { setPartiesLoading(false); }
  };

  const doCleanupAll = async () => {
    if (!cleanupBiz || cleanupConfirmText !== "DELETE") return;
    setCleanupLoading(true);
    setCleanupError("");
    setCleanupResult(null);
    try {
      const result = await api.post<any>(`/super-admin/businesses/${cleanupBiz.id}/clear-transactions`, {});
      setCleanupResult(result);
    } catch (e: any) {
      setCleanupError(e?.message || "An error occurred");
    } finally { setCleanupLoading(false); }
  };

  const doCleanupParty = async () => {
    if (!cleanupBiz || !selectedParty) return;
    setCleanupLoading(true);
    setCleanupError("");
    setCleanupResult(null);
    try {
      const result = await api.post<any>(`/super-admin/businesses/${cleanupBiz.id}/clear-party-transactions`, { partyId: selectedParty.id });
      setCleanupResult(result);
    } catch (e: any) {
      setCleanupError(e?.message || "An error occurred");
    } finally { setCleanupLoading(false); }
  };

  const openUsers = async (b: any) => {
    setUsersBiz(b);
    setUsersLoading(true);
    setUsersData(null);
    setEditingUser(null);
    try {
      const data = await api.get<any>(`/super-admin/businesses/${b.id}/users`);
      setUsersData(data);
    } catch (e) { console.error(e); }
    finally { setUsersLoading(false); }
  };

  const toggleActive = async (user: any) => {
    setUserSaving(user.id);
    try {
      const updated = await api.patch<any>(`/super-admin/businesses/${usersBiz.id}/users/${user.id}`, { isActive: !user.isActive });
      setUsersData(d => d ? { ...d, users: d.users.map(u => u.id === user.id ? { ...u, ...updated } : u) } : d);
    } finally { setUserSaving(null); }
  };

  const openEditPerms = (user: any) => {
    setEditingUser({ ...user, editPerms: [...(user.permissions || [])] });
  };

  const togglePerm = (perm: string) => {
    setEditingUser((u: any) => ({
      ...u,
      editPerms: u.editPerms.includes(perm) ? u.editPerms.filter((p: string) => p !== perm) : [...u.editPerms, perm],
    }));
  };

  const savePerms = async () => {
    if (!editingUser) return;
    setUserSaving(editingUser.id);
    try {
      const updated = await api.patch<any>(`/super-admin/businesses/${usersBiz.id}/users/${editingUser.id}`, { permissions: editingUser.editPerms });
      setUsersData(d => d ? { ...d, users: d.users.map(u => u.id === editingUser.id ? { ...u, ...updated } : u) } : d);
      setEditingUser(null);
    } finally { setUserSaving(null); }
  };

  const openDelete = (b: any) => {
    setDeleteBiz(b);
    setDeleteConfirm("");
    setDeleteError("");
  };

  const doDelete = async () => {
    if (!deleteBiz || deleteConfirm !== deleteBiz.name) return;
    setDeleteLoading(true); setDeleteError("");
    try {
      await api.delete(`/super-admin/businesses/${deleteBiz.id}`);
      setDeleteBiz(null);
      load();
    } catch (e: any) {
      setDeleteError(e?.message || "Delete failed");
    } finally { setDeleteLoading(false); }
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

  const availablePerms = usersData?.planFeatures && usersData.planFeatures.length > 0
    ? ALL_PERMS.filter(p => usersData.planFeatures.includes(p.key))
    : ALL_PERMS;

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
                  <th className="text-center px-4 py-3 font-medium">Refs</th>
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
                      {b.referralCode && (
                        <div className="flex items-center gap-1 mt-0.5">
                          <span className="text-xs text-indigo-500 font-mono font-bold">{b.referralCode}</span>
                          <button onClick={() => copyRef(b.referralCode)} className="text-gray-300 hover:text-indigo-400">
                            {copiedRef === b.referralCode ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
                          </button>
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 font-mono text-blue-600 font-bold">{b.businessCode}</td>
                    <td className="px-4 py-3">
                      <div className="text-xs">
                        {b.planName ? <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">{b.planName}</span> : <span className="text-gray-400">No plan</span>}
                        {b.isTrial && <span className="ml-1 bg-orange-100 text-orange-600 px-1.5 py-0.5 rounded-full text-xs">Trial</span>}
                        {(b.bonusDaysAdded > 0) && <div className="text-xs text-green-600 mt-0.5">+{b.bonusDaysAdded} bonus days</div>}
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
                    <td className="px-4 py-3 text-center">
                      {b.referralCount > 0
                        ? <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">{b.referralCount}</span>
                        : <span className="text-gray-300 text-xs">—</span>}
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{fmt.date(b.createdAt)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => openUsers(b)} className="p-1.5 text-purple-500 hover:bg-purple-50 rounded-lg" title="Manage Users"><Users className="w-3.5 h-3.5" /></button>
                        <button onClick={() => openEdit(b)} className="p-1.5 text-blue-500 hover:bg-blue-50 rounded-lg" title="Edit Business"><Edit2 className="w-3.5 h-3.5" /></button>
                        <button onClick={() => openTopup(b)} className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg" title="Top-up Free Days"><Gift className="w-3.5 h-3.5" /></button>
                        <button onClick={() => openCleanup(b)} className="p-1.5 text-red-400 hover:bg-red-50 rounded-lg" title="Data Cleanup — Delete Vouchers/Payments"><Trash2 className="w-3.5 h-3.5" /></button>
                        <button onClick={() => downloadBackup(b.id, b.businessCode)} className="p-1.5 text-gray-400 hover:bg-gray-50 rounded-lg" title="Download backup"><Download className="w-3.5 h-3.5" /></button>
                        <button onClick={() => openDelete(b)} className="p-1.5 text-red-700 hover:bg-red-100 rounded-lg" title="Permanently delete business"><XCircle className="w-3.5 h-3.5" /></button>
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

      {/* Top-up Modal */}
      {topupBiz && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={e => e.target === e.currentTarget && setTopupBiz(null)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="text-lg font-semibold flex items-center gap-2"><Gift className="w-5 h-5 text-green-500" /> Free Days Top-up</h2>
              <button onClick={() => setTopupBiz(null)}><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            {topupDone ? (
              <div className="p-6 text-center space-y-3">
                <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-7 h-7 text-green-500" />
                </div>
                <p className="font-semibold text-gray-800">{topupDays} {t("daysAddedSuccess", lang)}</p>
                <p className="text-sm text-gray-500">{topupBiz.name} plan extended.</p>
                <button onClick={() => setTopupBiz(null)} className="w-full py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium text-sm">Done</button>
              </div>
            ) : (
              <div className="p-6 space-y-4">
                <div className="bg-gray-50 rounded-lg p-3 text-sm">
                  <div className="font-medium text-gray-800">{topupBiz.name}</div>
                  <div className="text-gray-500 text-xs mt-0.5">
                    Current expiry: {topupBiz.planExpiresAt ? fmt.date(topupBiz.planExpiresAt) : "Not set"} · Status: {topupBiz.status}
                  </div>
                  {topupBiz.bonusDaysAdded > 0 && (
                    <div className="text-green-600 text-xs mt-0.5">{t("bonusDaysAlready", lang)}: {topupBiz.bonusDaysAdded}</div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">{t("howManyDaysToAdd", lang)}</label>
                  <div className="grid grid-cols-4 gap-2 mb-2">
                    {[7, 15, 30, 90].map(d => (
                      <button key={d} onClick={() => setTopupDays(String(d))}
                        className={`py-2 rounded-lg text-sm font-medium border transition-colors ${topupDays === String(d) ? "bg-green-600 text-white border-green-600" : "border-gray-200 text-gray-600 hover:border-green-400"}`}>
                        {d} {t("days", lang)}
                      </button>
                    ))}
                  </div>
                  <input
                    type="number" min="1" max="365"
                    className={inputCls}
                    value={topupDays}
                    onChange={e => setTopupDays(e.target.value)}
                    placeholder="Custom days"
                  />
                </div>

                <div className="bg-green-50 rounded-lg p-3 text-xs text-green-700">
                  Plan {topupBiz.planExpiresAt && new Date(topupBiz.planExpiresAt) > new Date() ? "expiry" : "aaj se"} + {topupDays || 0} din = {topupDays && topupBiz.planExpiresAt && new Date(topupBiz.planExpiresAt) > new Date()
                    ? new Date(new Date(topupBiz.planExpiresAt).getTime() + Number(topupDays) * 86400000).toLocaleDateString("en-IN")
                    : topupDays ? new Date(Date.now() + Number(topupDays) * 86400000).toLocaleDateString("en-IN") : "—"}
                </div>

                <div className="flex gap-3">
                  <button onClick={() => setTopupBiz(null)} className="flex-1 py-2.5 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50">Cancel</button>
                  <button onClick={doTopup} disabled={topupSaving || !topupDays || Number(topupDays) <= 0}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium disabled:opacity-60">
                    {topupSaving && <Loader2 className="w-4 h-4 animate-spin" />}
                    Add {topupDays} {t("days", lang)} Free
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Edit Business Modal */}
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

      {/* Cleanup Modal */}
      {cleanupBiz && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={e => e.target === e.currentTarget && !cleanupLoading && setCleanupBiz(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b shrink-0">
              <h2 className="text-lg font-semibold flex items-center gap-2 text-red-600">
                <Trash2 className="w-5 h-5" /> Data Cleanup
              </h2>
              <button onClick={() => setCleanupBiz(null)} disabled={cleanupLoading}><X className="w-5 h-5 text-gray-400" /></button>
            </div>

            <div className="px-6 pt-4 shrink-0">
              <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex items-start gap-2 text-sm text-red-700">
                <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                <div>
                  <span className="font-semibold">{cleanupBiz.name}</span> — {t("cleanupOnlyVouchersPayments", lang)}
                </div>
              </div>
            </div>

            {/* Tabs */}
            <div className="px-6 pt-4 shrink-0">
              <div className="flex border border-gray-200 rounded-xl overflow-hidden text-sm font-medium">
                <button onClick={() => { setCleanupTab("all"); setCleanupResult(null); setCleanupError(""); setCleanupConfirmText(""); }}
                  className={`flex-1 py-2.5 transition-colors ${cleanupTab === "all" ? "bg-red-600 text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}>
                  {t("cleanupFullBusiness", lang)}
                </button>
                <button onClick={() => { setCleanupTab("party"); setCleanupResult(null); setCleanupError(""); setSelectedParty(null); setPartySearch(""); }}
                  className={`flex-1 py-2.5 transition-colors ${cleanupTab === "party" ? "bg-orange-500 text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}>
                  {t("cleanupOneParty", lang)}
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
              {cleanupResult ? (
                <div className="text-center space-y-3 py-4">
                  <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                    <CheckCircle2 className="w-7 h-7 text-green-500" />
                  </div>
                  <p className="font-semibold text-gray-800">{t("cleanupDone", lang)}</p>
                  <div className="bg-gray-50 rounded-xl p-4 text-sm text-left space-y-1.5 text-gray-700">
                    {cleanupResult.partyName && <div className="text-orange-600 font-medium mb-2">Party: {cleanupResult.partyName}</div>}
                    <div className="flex justify-between"><span>Vouchers deleted:</span><span className="font-mono font-bold text-red-600">{cleanupResult.deleted?.vouchers ?? 0}</span></div>
                    <div className="flex justify-between"><span>Voucher items deleted:</span><span className="font-mono font-bold text-red-600">{cleanupResult.deleted?.voucherItems ?? 0}</span></div>
                    <div className="flex justify-between"><span>Payments deleted:</span><span className="font-mono font-bold text-red-600">{cleanupResult.deleted?.payments ?? 0}</span></div>
                    <div className="flex justify-between"><span>Payment allocations deleted:</span><span className="font-mono font-bold text-red-600">{cleanupResult.deleted?.paymentAllocations ?? 0}</span></div>
                  </div>
                  <button onClick={() => setCleanupBiz(null)} className="w-full py-2.5 bg-gray-800 hover:bg-gray-900 text-white rounded-xl text-sm font-medium">Close</button>
                </div>
              ) : cleanupTab === "all" ? (
                <div className="space-y-4">
                  <div className="text-sm text-gray-600">
                    <p className="font-medium text-gray-800 mb-1">{t("cleanupWillDelete", lang)}</p>
                    <ul className="list-disc list-inside space-y-1 text-gray-500 text-xs ml-1">
                      <li>All Sales Invoices, Credit Notes, Purchase Bills, Debit Notes</li>
                      <li>All Payments &amp; Receipts</li>
                      <li>All Payment Allocations</li>
                    </ul>
                  </div>
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-700">
                    {t("typeDeleteToConfirm", lang)}
                  </div>
                  <input
                    type="text"
                    value={cleanupConfirmText}
                    onChange={e => setCleanupConfirmText(e.target.value)}
                    placeholder='Type "DELETE" to confirm'
                    className="w-full border-2 border-red-300 rounded-lg px-3 py-2.5 text-sm font-mono focus:outline-none focus:border-red-500"
                  />
                  {cleanupError && <p className="text-sm text-red-500">{cleanupError}</p>}
                  <div className="flex gap-3">
                    <button onClick={() => setCleanupBiz(null)} className="flex-1 py-2.5 border border-gray-300 text-gray-700 rounded-xl text-sm hover:bg-gray-50">Cancel</button>
                    <button
                      onClick={doCleanupAll}
                      disabled={cleanupLoading || cleanupConfirmText !== "DELETE"}
                      className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm font-medium disabled:opacity-50"
                    >
                      {cleanupLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                      {t("cleanAllData", lang)}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="text-sm text-gray-600">
                    {t("selectPartyToClean", lang)}
                  </div>
                  <div className="relative">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      value={partySearch}
                      onChange={e => { setPartySearch(e.target.value); setSelectedParty(null); }}
                      placeholder={t("searchPartyPlaceholder", lang)}
                      className="w-full pl-9 pr-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                    />
                  </div>
                  {partiesLoading ? (
                    <div className="flex items-center justify-center h-24"><Loader2 className="w-5 h-5 animate-spin text-orange-500" /></div>
                  ) : (
                    <div className="border border-gray-200 rounded-xl overflow-hidden max-h-48 overflow-y-auto">
                      {partiesList.filter(p => !partySearch || p.name.toLowerCase().includes(partySearch.toLowerCase())).length === 0 ? (
                        <div className="text-center text-gray-400 text-sm py-8">{t("noPartyFound", lang)}</div>
                      ) : partiesList.filter(p => !partySearch || p.name.toLowerCase().includes(partySearch.toLowerCase())).map(p => (
                        <button key={p.id} onClick={() => setSelectedParty(p)}
                          className={`w-full text-left px-4 py-2.5 text-sm border-b border-gray-100 last:border-0 flex items-center justify-between transition-colors ${selectedParty?.id === p.id ? "bg-orange-50 text-orange-700" : "hover:bg-gray-50 text-gray-700"}`}>
                          <span className="font-medium">{p.name}</span>
                          <span className={`text-xs px-2 py-0.5 rounded-full ${p.type === "customer" ? "bg-blue-100 text-blue-600" : "bg-purple-100 text-purple-600"}`}>{p.type}</span>
                        </button>
                      ))}
                    </div>
                  )}
                  {selectedParty && (
                    <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 text-sm text-orange-700 flex items-center justify-between">
                      <span>Selected: <span className="font-semibold">{selectedParty.name}</span></span>
                      <button onClick={() => setSelectedParty(null)}><X className="w-4 h-4" /></button>
                    </div>
                  )}
                  {cleanupError && <p className="text-sm text-red-500">{cleanupError}</p>}
                  <div className="flex gap-3">
                    <button onClick={() => setCleanupBiz(null)} className="flex-1 py-2.5 border border-gray-300 text-gray-700 rounded-xl text-sm hover:bg-gray-50">Cancel</button>
                    <button
                      onClick={doCleanupParty}
                      disabled={cleanupLoading || !selectedParty}
                      className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-sm font-medium disabled:opacity-50"
                    >
                      {cleanupLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                      {selectedParty ? `${t("deletePartyTransactions", lang)} ${selectedParty.name}` : t("selectPartyFirst", lang)}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Users Modal */}
      {usersBiz && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={e => e.target === e.currentTarget && !editingUser && setUsersBiz(null)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b shrink-0">
              <div>
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <Users className="w-5 h-5 text-purple-500" /> {usersBiz.name} — Users
                </h2>
                {usersData?.planName && (
                  <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1">
                    <CreditCard className="w-3 h-3" /> Plan: <span className="font-medium text-blue-600">{usersData.planName}</span>
                    {usersData.planFeatures.length > 0 && <span className="text-gray-400">· {usersData.planFeatures.length} modules</span>}
                  </p>
                )}
              </div>
              <button onClick={() => { setUsersBiz(null); setEditingUser(null); }}><X className="w-5 h-5 text-gray-400" /></button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {usersLoading ? (
                <div className="flex items-center justify-center h-40"><Loader2 className="w-6 h-6 animate-spin text-blue-500" /></div>
              ) : usersData?.users.length === 0 ? (
                <div className="flex items-center justify-center h-40 text-gray-400 text-sm">{t("noUsersInBusiness", lang)}</div>
              ) : usersData?.users.map(user => (
                <div key={user.id} className={`border rounded-xl p-4 transition-all ${editingUser?.id === user.id ? "border-purple-300 bg-purple-50" : "border-gray-200 bg-white"}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-gray-900">{user.name}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full capitalize ${user.role === "business_admin" ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-600"}`}>
                          {user.role?.replace("_", " ")}
                        </span>
                      </div>
                      <div className="text-xs text-gray-500 mt-0.5">{user.email}</div>
                      {user.role !== "business_admin" && user.permissions?.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {(user.permissions as string[]).map((p: string) => (
                            <span key={p} className="text-xs bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded capitalize">{p}</span>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => toggleActive(user)}
                        disabled={userSaving === user.id}
                        title={user.isActive ? "Deactivate user" : "Activate user"}
                        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-50 ${user.isActive ? "bg-green-50 text-green-700 hover:bg-red-50 hover:text-red-600 border border-green-200 hover:border-red-200" : "bg-red-50 text-red-600 hover:bg-green-50 hover:text-green-700 border border-red-200 hover:border-green-200"}`}
                      >
                        {userSaving === user.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : user.isActive ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                        {user.isActive ? "Active" : "Inactive"}
                      </button>
                      {user.role !== "business_admin" && (
                        <button
                          onClick={() => editingUser?.id === user.id ? setEditingUser(null) : openEditPerms(user)}
                          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border border-gray-200 bg-white hover:bg-purple-50 hover:text-purple-700 hover:border-purple-200 transition-colors"
                        >
                          <Shield className="w-3.5 h-3.5" /> Rights
                        </button>
                      )}
                    </div>
                  </div>

                  {editingUser?.id === user.id && (
                    <div className="mt-3 pt-3 border-t border-purple-200">
                      <p className="text-xs font-medium text-gray-700 mb-2">
                        {t("assignRights", lang)}
                        {usersData.planFeatures.length > 0
                          ? <span className="text-gray-400 font-normal"> {t("perPlanModules", lang)}</span>
                          : <span className="text-gray-400 font-normal"> {t("allModules", lang)}</span>
                        }
                      </p>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {availablePerms.map(p => (
                          <label key={p.key} className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer text-sm transition-colors ${editingUser.editPerms.includes(p.key) ? "bg-indigo-50 border-indigo-300 text-indigo-700" : "bg-white border-gray-200 text-gray-600 hover:border-gray-300"}`}>
                            <input type="checkbox" className="rounded accent-indigo-600" checked={editingUser.editPerms.includes(p.key)} onChange={() => togglePerm(p.key)} />
                            {p.label}
                          </label>
                        ))}
                      </div>
                      <div className="flex justify-end gap-2 mt-3">
                        <button onClick={() => setEditingUser(null)} className="px-3 py-1.5 text-sm border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50">Cancel</button>
                        <button onClick={savePerms} disabled={userSaving === editingUser.id} className="flex items-center gap-1.5 px-4 py-1.5 text-sm bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium disabled:opacity-60">
                          {userSaving === editingUser.id && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Save Rights
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
      {/* Permanent Delete Modal */}
      {deleteBiz && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={e => e.target === e.currentTarget && !deleteLoading && setDeleteBiz(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="text-lg font-semibold flex items-center gap-2 text-red-700">
                <XCircle className="w-5 h-5" /> Business Permanently Delete
              </h2>
              <button onClick={() => setDeleteBiz(null)} disabled={deleteLoading}><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700 space-y-1">
                <div className="font-bold text-red-800 flex items-center gap-1.5"><AlertTriangle className="w-4 h-4" /> Yeh permanent action hai!</div>
                <div><span className="font-semibold">{deleteBiz.name}</span> ka poora data delete ho jaayega:</div>
                <ul className="list-disc list-inside text-xs space-y-0.5 text-red-600 ml-1">
                  <li>Saari parties, items, vouchers</li>
                  <li>Saare payments aur receipts</li>
                  <li>Saare users</li>
                  <li>Business account khud</li>
                </ul>
                <div className="font-semibold text-red-800 pt-1">Yeh undo NAHI ho sakta.</div>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm text-gray-600">
                  Confirm karne ke liye business ka naam type karein: <span className="font-semibold text-gray-800">{deleteBiz.name}</span>
                </label>
                <input
                  autoFocus
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100"
                  placeholder={deleteBiz.name}
                  value={deleteConfirm}
                  onChange={e => setDeleteConfirm(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && deleteConfirm === deleteBiz.name && doDelete()}
                />
              </div>

              {deleteError && (
                <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" /> {deleteError}
                </div>
              )}

              <div className="flex gap-3 pt-1">
                <button onClick={() => setDeleteBiz(null)} disabled={deleteLoading} className="flex-1 py-2.5 border border-gray-300 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-50 disabled:opacity-50">
                  Cancel
                </button>
                <button
                  onClick={doDelete}
                  disabled={deleteLoading || deleteConfirm !== deleteBiz.name}
                  className="flex-1 py-2.5 bg-red-700 hover:bg-red-800 disabled:bg-gray-200 disabled:text-gray-400 text-white rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition"
                >
                  {deleteLoading ? <><Loader2 className="w-4 h-4 animate-spin" /> Deleting…</> : <><XCircle className="w-4 h-4" /> Permanently Delete</>}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
