import { useEffect, useState, useCallback } from "react";
import { api, fmt } from "@/lib/api";
import {
  Plus, Loader2, X, Copy, Check, Ticket, Search, Ban, Trash2,
  FolderOpen, CheckCircle2, Clock, XCircle, Edit2, RefreshCw,
} from "lucide-react";
import { useLang } from "@/lib/langHook";
import { t } from "@/lib/lang";

const STATUS_META: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  active: {
    label: "Active",
    color: "bg-green-100 text-green-700 border-green-200",
    icon: <CheckCircle2 className="w-3.5 h-3.5" />,
  },
  used: {
    label: "Used",
    color: "bg-blue-100 text-blue-700 border-blue-200",
    icon: <Clock className="w-3.5 h-3.5" />,
  },
  cancelled: {
    label: "Cancelled",
    color: "bg-red-100 text-red-600 border-red-200",
    icon: <XCircle className="w-3.5 h-3.5" />,
  },
};

interface CountRow { planId: number; planName: string; status: string; cnt: number }
interface Voucher {
  id: number; code: string; planId: number; planName: string;
  validityDays: number; sellingPrice: string | null; status: string;
  notes: string | null; redeemedByBusiness: string | null;
  redeemedAt: string | null; createdAt: string;
}

export default function AdminVouchers() {
  const lang = useLang();
  const [counts, setCounts] = useState<CountRow[]>([]);
  const [plans, setPlans] = useState<any[]>([]);
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [countsLoading, setCountsLoading] = useState(true);

  // Folder state: selectedPlanId = null means no folder selected
  const [selectedPlanId, setSelectedPlanId] = useState<number | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<string>("active");

  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const LIMIT = 25;

  // Generate modal
  const [showGenerate, setShowGenerate] = useState(false);
  const [genForm, setGenForm] = useState({ planId: "", quantity: 1, validityDays: 30, sellingPrice: "", notes: "" });
  const [generating, setGenerating] = useState(false);
  const [newCodes, setNewCodes] = useState<string[]>([]);
  const [copied, setCopied] = useState<string | null>(null);

  // Edit voucher modal
  const [editVoucher, setEditVoucher] = useState<Voucher | null>(null);
  const [editForm, setEditForm] = useState({ validityDays: 30, sellingPrice: "", notes: "" });
  const [editSaving, setEditSaving] = useState(false);
  const [reissueSaving, setReissueSaving] = useState<number | null>(null);

  const inputCls = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500";

  const loadCounts = useCallback(() => {
    setCountsLoading(true);
    Promise.all([
      api.get<CountRow[]>("/super-admin/vouchers/counts"),
      api.get<any>("/super-admin/plans"),
    ]).then(([c, pl]) => {
      setCounts(Array.isArray(c) ? c : []);
      const allPlans = pl.data || [];
      setPlans(allPlans);
      // Auto-select first plan if none selected
      if (selectedPlanId === null && allPlans.length > 0) {
        const firstPlanId = allPlans[0].id;
        setSelectedPlanId(firstPlanId);
      }
    }).catch(console.error).finally(() => setCountsLoading(false));
  }, []);

  const fetchVouchers = (planId: number, status: string, pg: number, q: string) => {
    setLoading(true);
    const p = new URLSearchParams({
      page: String(pg), limit: String(LIMIT),
      planId: String(planId),
      status,
    });
    if (q) p.set("search", q);
    api.get<any>(`/super-admin/vouchers?${p}`)
      .then(v => { setVouchers(v.data || []); setTotal(v.total || 0); })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  // Keep loadVouchers for manual refresh calls (e.g. after generate)
  const loadVouchers = () => {
    if (selectedPlanId === null) return;
    fetchVouchers(selectedPlanId, selectedStatus, page, search);
  };

  useEffect(() => { loadCounts(); }, []);

  // This effect directly uses current values — zero stale closure risk
  useEffect(() => {
    if (selectedPlanId !== null) fetchVouchers(selectedPlanId, selectedStatus, page, search);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPlanId, selectedStatus, page, search]);

  // When plan or status changes, reset page
  const selectPlan = (planId: number) => {
    setSelectedPlanId(planId);
    setPage(1);
    setSearch("");
  };
  const selectStatus = (status: string) => {
    setSelectedStatus(status);
    setPage(1);
    setSearch("");
  };

  const openEditVoucher = (v: Voucher) => {
    setEditVoucher(v);
    setEditForm({ validityDays: v.validityDays, sellingPrice: v.sellingPrice || "", notes: v.notes || "" });
  };

  const saveEditVoucher = async () => {
    if (!editVoucher) return;
    setEditSaving(true);
    try {
      await api.patch(`/super-admin/vouchers/${editVoucher.id}`, {
        validityDays: Number(editForm.validityDays),
        sellingPrice: editForm.sellingPrice || null,
        notes: editForm.notes || null,
      });
      setEditVoucher(null);
      loadVouchers();
    } finally { setEditSaving(false); }
  };

  const reissueVoucher = async (v: Voucher) => {
    if (!confirm(`Reissue "${v.code}"? A new code will be generated and status will be set to Active.`)) return;
    setReissueSaving(v.id);
    try {
      await api.patch(`/super-admin/vouchers/${v.id}`, { reissue: true });
      loadCounts();
      loadVouchers();
    } finally { setReissueSaving(null); }
  };

  const cancelVoucher = async (id: number) => {
    if (!confirm("Cancel this voucher?")) return;
    await api.patch(`/super-admin/vouchers/${id}`, { status: "cancelled" });
    loadCounts();
    loadVouchers();
  };

  const deleteVoucher = async (id: number, code: string) => {
    if (!confirm(`Permanently delete "${code}"? This cannot be undone!`)) return;
    await api.delete(`/super-admin/vouchers/${id}`);
    loadCounts();
    loadVouchers();
  };

  const generate = async () => {
    if (!genForm.planId) return;
    setGenerating(true);
    try {
      const res = await api.post<any>("/super-admin/vouchers", {
        planId: Number(genForm.planId),
        quantity: Number(genForm.quantity),
        validityDays: Number(genForm.validityDays),
        sellingPrice: genForm.sellingPrice ? Number(genForm.sellingPrice) : null,
        notes: genForm.notes || null,
      });
      setNewCodes(res.codes || []);
      loadCounts();
      if (selectedPlanId === Number(genForm.planId) && selectedStatus === "active") loadVouchers();
    } finally { setGenerating(false); }
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopied(code);
    setTimeout(() => setCopied(null), 2000);
  };
  const copyAll = () => {
    navigator.clipboard.writeText(newCodes.join("\n"));
    setCopied("all");
    setTimeout(() => setCopied(null), 2000);
  };

  // Build folder structure from counts
  const planFolders = plans.map(pl => {
    const planCounts = counts.filter(c => c.planId === pl.id);
    const total = planCounts.reduce((s, c) => s + Number(c.cnt), 0);
    const byStatus: Record<string, number> = {};
    for (const c of planCounts) byStatus[c.status] = Number(c.cnt);
    return { id: pl.id, name: pl.name, total, byStatus };
  }).filter(f => f.total > 0 || plans.length <= 3);

  // If no plan selected yet but plans loaded, select first with data
  const currentFolder = planFolders.find(f => f.id === selectedPlanId);

  return (
    <div className="max-w-7xl space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Ticket className="w-6 h-6 text-indigo-500" /> License Vouchers
        </h1>
        <button
          onClick={() => { setShowGenerate(true); setNewCodes([]); setGenForm({ planId: selectedPlanId ? String(selectedPlanId) : "", quantity: 1, validityDays: 30, sellingPrice: "", notes: "" }); }}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg">
          <Plus className="w-4 h-4" /> Generate Vouchers
        </button>
      </div>

      {/* Mobile: horizontal scrollable plan pills */}
      <div className="flex gap-2 overflow-x-auto pb-1 md:hidden">
        {countsLoading ? (
          <div className="flex items-center gap-2 text-gray-400 text-sm py-2"><Loader2 className="w-4 h-4 animate-spin" />Loading...</div>
        ) : planFolders.map(folder => {
          const isSelected = selectedPlanId === folder.id;
          return (
            <button key={folder.id} onClick={() => selectPlan(folder.id)}
              className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl border text-sm font-medium transition-all ${
                isSelected ? "bg-indigo-600 text-white border-indigo-600" : "bg-white border-gray-200 text-gray-700 hover:border-indigo-300"
              }`}>
              <FolderOpen className={`w-3.5 h-3.5 ${isSelected ? "text-indigo-200" : "text-indigo-400"}`} />
              {folder.name}
              <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${isSelected ? "bg-white/20 text-white" : "bg-indigo-100 text-indigo-700"}`}>{folder.total}</span>
            </button>
          );
        })}
      </div>

      <div className="flex gap-4">
        {/* Left: Plan Folders — desktop only */}
        <div className="hidden md:block w-52 shrink-0 space-y-1.5">
          {countsLoading ? (
            <div className="flex items-center justify-center h-24"><Loader2 className="w-4 h-4 animate-spin text-indigo-400" /></div>
          ) : planFolders.length === 0 ? (
            <div className="text-center py-8 text-gray-400 text-sm">{t("noVouchersInFolder", lang)}</div>
          ) : (
            planFolders.map(folder => {
              const isSelected = selectedPlanId === folder.id;
              return (
                <button
                  key={folder.id}
                  onClick={() => selectPlan(folder.id)}
                  className={`w-full text-left rounded-xl p-3 transition-all border ${
                    isSelected
                      ? "bg-indigo-600 text-white border-indigo-600 shadow-md"
                      : "bg-white border-gray-200 hover:border-indigo-300 hover:bg-indigo-50 text-gray-700"
                  }`}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2 font-semibold text-sm">
                      <FolderOpen className={`w-4 h-4 ${isSelected ? "text-indigo-200" : "text-indigo-400"}`} />
                      <span className="truncate">{folder.name}</span>
                    </div>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full shrink-0 ${
                      isSelected ? "bg-white/20 text-white" : "bg-indigo-100 text-indigo-700"
                    }`}>{folder.total}</span>
                  </div>
                  <div className="space-y-1">
                    {(["active", "used", "cancelled"] as const).map(s => {
                      const cnt = folder.byStatus[s] || 0;
                      if (cnt === 0) return null;
                      return (
                        <div key={s} className={`flex items-center justify-between text-xs ${isSelected ? "text-indigo-200" : "text-gray-500"}`}>
                          <span className="capitalize">{STATUS_META[s].label}</span>
                          <span className={`font-medium ${isSelected ? "text-white" : s === "active" ? "text-green-600" : s === "used" ? "text-blue-600" : "text-red-500"}`}>{cnt}</span>
                        </div>
                      );
                    })}
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* Right: Voucher Table */}
        <div className="flex-1 min-w-0 bg-white rounded-xl border border-gray-200 overflow-hidden">
          {/* Status Sub-tabs */}
          {currentFolder && (
            <div className="flex overflow-x-auto border-b border-gray-100 bg-gray-50/50">
              {(["active", "used", "cancelled"] as const).map(s => {
                const cnt = currentFolder.byStatus[s] || 0;
                const meta = STATUS_META[s];
                const isActive = selectedStatus === s;
                return (
                  <button
                    key={s}
                    onClick={() => selectStatus(s)}
                    className={`flex-shrink-0 flex items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                      isActive
                        ? "border-indigo-500 text-indigo-700 bg-white"
                        : "border-transparent text-gray-500 hover:text-gray-700 hover:bg-white/60"
                    }`}>
                    {meta.icon}
                    {meta.label}
                    <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold border ${
                      isActive ? meta.color : "bg-gray-100 text-gray-500 border-gray-200"
                    }`}>{cnt}</span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Search */}
          <div className="p-3 border-b border-gray-100 flex gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                value={search}
                onChange={e => { setSearch(e.target.value); setPage(1); }}
                placeholder="Voucher code ya notes search..."
                className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
            </div>
            {selectedStatus === "cancelled" && vouchers.length > 0 && (
              <button
                onClick={async () => {
                  if (!confirm(`${currentFolder?.name}: ${t("deleteAll", lang)} ${currentFolder?.byStatus.cancelled || 0} cancelled vouchers?`)) return;
                  for (const v of vouchers) {
                    await api.delete(`/super-admin/vouchers/${v.id}`).catch(() => {});
                  }
                  loadCounts(); loadVouchers();
                }}
                className="flex items-center gap-2 px-3 py-2 bg-red-50 hover:bg-red-100 border border-red-200 text-red-600 text-sm rounded-lg font-medium">
                <Trash2 className="w-4 h-4" /> {t("deleteAll", lang)}
              </button>
            )}
          </div>

          {/* Table */}
          {loading ? (
            <div className="flex items-center justify-center h-48"><Loader2 className="w-5 h-5 animate-spin text-indigo-500" /></div>
          ) : !selectedPlanId ? (
            <div className="flex flex-col items-center justify-center h-48 text-gray-400 gap-2">
              <FolderOpen className="w-10 h-10 opacity-30" />
              <p className="text-sm">{t("selectPlanFolder", lang)}</p>
            </div>
          ) : vouchers.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-gray-400 gap-2">
              <Ticket className="w-10 h-10 opacity-30" />
              <p className="text-sm">{t("noVouchersInFolder", lang)}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-600">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium w-8">#</th>
                    <th className="text-left px-4 py-3 font-medium">Code</th>
                    <th className="text-right px-4 py-3 font-medium">Price</th>
                    <th className="text-center px-4 py-3 font-medium">Validity</th>
                    {selectedStatus === "used" && <th className="text-left px-4 py-3 font-medium">Redeemed By</th>}
                    <th className="text-left px-4 py-3 font-medium">Date</th>
                    <th className="px-4 py-3 w-12"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {vouchers.map((v, idx) => (
                    <tr key={v.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-gray-400 text-xs">{(page - 1) * LIMIT + idx + 1}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-indigo-700 tracking-wider">{v.code}</span>
                          <button onClick={() => copyCode(v.code)} className="text-gray-400 hover:text-indigo-500">
                            {copied === v.code ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                        {v.notes && (() => {
                          try {
                            const log = JSON.parse(v.notes);
                            if (log.hardware || log.ip) {
                              return (
                                <div className="text-xs text-gray-400 mt-1 space-y-0.5">
                                  {log.ip && <div>🌐 IP: <span className="text-gray-600">{log.ip}</span></div>}
                                  {log.hardware?.mac && <div>🖥️ MAC: <span className="font-mono text-gray-600">{log.hardware.mac}</span></div>}
                                  {log.hardware?.cpu && <div>⚙️ CPU: <span className="text-gray-600">{log.hardware.cpu}</span></div>}
                                  {log.hardware?.osVersion && <div>💻 OS: <span className="text-gray-600">{log.hardware.osVersion}</span></div>}
                                  {log.hardware?.hostname && <div>🏠 Host: <span className="text-gray-600">{log.hardware.hostname}</span></div>}
                                  {log.businessEmail && <div>✉️ <span className="text-gray-600">{log.businessEmail}</span></div>}
                                </div>
                              );
                            }
                          } catch { /* notes is plain text, not JSON */ }
                          return <div className="text-xs text-gray-400 mt-0.5">{v.notes}</div>;
                        })()}
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-gray-700">
                        {v.sellingPrice ? `₹${Number(v.sellingPrice).toLocaleString("en-IN")}` : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-4 py-3 text-center text-xs text-gray-600">{v.validityDays} {t("days", lang)}</td>
                      {selectedStatus === "used" && (
                        <td className="px-4 py-3 text-xs text-gray-600">
                          {(() => {
                            // Parse activation log from notes if no direct business link
                            let notesBiz: { name?: string; code?: string; email?: string } | null = null;
                            if (!v.redeemedByBusiness && v.notes) {
                              try {
                                const log = JSON.parse(v.notes);
                                if (log.businessName || log.businessCode || log.businessEmail) {
                                  notesBiz = { name: log.businessName, code: log.businessCode, email: log.businessEmail };
                                }
                              } catch { /* plain text notes */ }
                            }
                            const bizName = v.redeemedByBusiness || notesBiz?.name;
                            const bizCode = notesBiz?.code;
                            const bizEmail = notesBiz?.email;
                            if (bizName || bizCode || bizEmail) {
                              return (
                                <div>
                                  {bizName && <div className="font-medium text-gray-800">{bizName}</div>}
                                  {bizCode && <div className="text-gray-400">Code: {bizCode}</div>}
                                  {bizEmail && <div className="text-gray-400">{bizEmail}</div>}
                                  {v.redeemedAt && <div className="text-gray-400 mt-0.5">{fmt.date(v.redeemedAt)}</div>}
                                </div>
                              );
                            }
                            return <span className="text-gray-400">—</span>;
                          })()}
                        </td>
                      )}
                      <td className="px-4 py-3 text-xs text-gray-400">{fmt.date(v.createdAt)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          {(v.status === "active" || v.status === "cancelled") && (
                            <button onClick={() => openEditVoucher(v)} className="p-1.5 text-blue-400 hover:bg-blue-50 rounded-lg" title="Edit voucher">
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {v.status === "cancelled" && (
                            <button onClick={() => reissueVoucher(v)} disabled={reissueSaving === v.id} className="p-1.5 text-green-500 hover:bg-green-50 rounded-lg disabled:opacity-50" title="Reissue (new code)">
                              {reissueSaving === v.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                            </button>
                          )}
                          {v.status === "active" && (
                            <button onClick={() => cancelVoucher(v.id)} className="p-1.5 text-red-400 hover:bg-red-50 rounded-lg" title="Cancel voucher">
                              <Ban className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {v.status === "cancelled" && (
                            <button onClick={() => deleteVoucher(v.id, v.code)} className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg" title="Permanently delete">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {total > LIMIT && (
            <div className="p-4 border-t border-gray-100 flex items-center justify-between text-sm text-gray-600">
              <span>Showing {(page - 1) * LIMIT + 1}–{Math.min(page * LIMIT, total)} of {total}</span>
              <div className="flex gap-2">
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                  className="px-3 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40">Prev</button>
                <button onClick={() => setPage(p => p + 1)} disabled={page * LIMIT >= total}
                  className="px-3 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40">Next</button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Edit Voucher Modal */}
      {editVoucher && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={e => e.target === e.currentTarget && setEditVoucher(null)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="text-lg font-semibold flex items-center gap-2"><Edit2 className="w-5 h-5 text-blue-500" /> {t("voucherEditTitle", lang)}</h2>
              <button onClick={() => setEditVoucher(null)}><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="bg-gray-50 rounded-lg p-3">
                <div className="font-mono font-bold text-indigo-700 tracking-wider">{editVoucher.code}</div>
                <div className="text-xs text-gray-500 mt-0.5">{editVoucher.planName} · Current status: <span className="capitalize font-medium">{editVoucher.status}</span></div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Validity (Days)</label>
                <input type="number" min={1} className={inputCls} value={editForm.validityDays}
                  onChange={e => setEditForm(f => ({ ...f, validityDays: Number(e.target.value) }))} />
                <p className="text-xs text-gray-400 mt-1">{t("validityDaysNote", lang)}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Selling Price (₹)</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-medium text-sm">₹</span>
                  <input type="number" min={0} className={inputCls + " pl-7"} placeholder="e.g. 999"
                    value={editForm.sellingPrice} onChange={e => setEditForm(f => ({ ...f, sellingPrice: e.target.value }))} />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <input type="text" className={inputCls} placeholder="e.g. Promo batch, Sharma Ji..."
                  value={editForm.notes} onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))} />
              </div>
              <div className="flex gap-3 pt-1">
                <button onClick={() => setEditVoucher(null)} className="flex-1 py-2.5 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50">Cancel</button>
                <button onClick={saveEditVoucher} disabled={editSaving}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium disabled:opacity-60">
                  {editSaving && <Loader2 className="w-4 h-4 animate-spin" />} Save Changes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Generate Modal */}
      {showGenerate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={e => e.target === e.currentTarget && !newCodes.length && setShowGenerate(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Ticket className="w-5 h-5 text-indigo-500" /> Generate License Vouchers
              </h2>
              <button onClick={() => setShowGenerate(false)}><X className="w-5 h-5 text-gray-400" /></button>
            </div>

            {newCodes.length > 0 ? (
              <div className="p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-green-700">{newCodes.length} {t("vouchersGenerated", lang)}</p>
                  <button onClick={copyAll} className="flex items-center gap-1.5 text-xs text-indigo-600 hover:text-indigo-700 font-medium">
                    {copied === "all" ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                    Copy All
                  </button>
                </div>
                <div className="bg-gray-50 rounded-xl p-4 space-y-2 max-h-60 overflow-y-auto">
                  {newCodes.map(code => (
                    <div key={code} className="flex items-center justify-between bg-white border border-gray-200 rounded-lg px-3 py-2">
                      <span className="font-mono font-bold text-indigo-700 tracking-wider text-sm">{code}</span>
                      <button onClick={() => copyCode(code)} className="text-gray-400 hover:text-indigo-500 ml-2">
                        {copied === code ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                      </button>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-gray-500">{t("buyerCodeInstructions", lang)}</p>
                <button onClick={() => { setShowGenerate(false); setNewCodes([]); }}
                  className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-medium">Done</button>
              </div>
            ) : (
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Plan <span className="text-red-500">*</span></label>
                  <select className={inputCls} value={genForm.planId} onChange={e => setGenForm(f => ({ ...f, planId: e.target.value }))}>
                    <option value="">Plan chunein...</option>
                    {plans.filter(p => p.isActive).map(p => (
                      <option key={p.id} value={p.id}>{p.name} — ₹{Number(p.price).toLocaleString()}/{p.billingCycle === "monthly" ? "month" : "year"}</option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Quantity</label>
                    <input type="number" min={1} max={50} className={inputCls} value={genForm.quantity}
                      onChange={e => setGenForm(f => ({ ...f, quantity: Math.min(50, Math.max(1, Number(e.target.value))) }))} />
                    <p className="text-xs text-gray-400 mt-1">{t("max50AtOnce", lang)}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Validity (Days)</label>
                    <input type="number" min={1} className={inputCls} value={genForm.validityDays}
                      onChange={e => setGenForm(f => ({ ...f, validityDays: Number(e.target.value) }))} />
                    <p className="text-xs text-gray-400 mt-1">{t("afterPlanActivation", lang)}</p>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Selling Price (₹) <span className="text-gray-400 font-normal">(optional)</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-medium text-sm">₹</span>
                    <input type="number" min={0} step={1} className={inputCls + " pl-7"} placeholder="e.g. 999"
                      value={genForm.sellingPrice} onChange={e => setGenForm(f => ({ ...f, sellingPrice: e.target.value }))} />
                  </div>
                  <p className="text-xs text-gray-400 mt-1">{t("sellingPriceNote", lang)}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Notes (optional)</label>
                  <input type="text" className={inputCls} placeholder="e.g. Delhi batch, special offer..."
                    value={genForm.notes} onChange={e => setGenForm(f => ({ ...f, notes: e.target.value }))} />
                </div>
                <div className="flex justify-end gap-3 pt-2">
                  <button onClick={() => setShowGenerate(false)} className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50">Cancel</button>
                  <button onClick={generate} disabled={generating || !genForm.planId}
                    className="flex items-center gap-2 px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium disabled:opacity-60">
                    {generating && <Loader2 className="w-4 h-4 animate-spin" />}
                    Generate {genForm.quantity > 1 ? `${genForm.quantity} Vouchers` : "Voucher"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
