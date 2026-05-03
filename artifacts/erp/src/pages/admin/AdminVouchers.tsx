import { useEffect, useState } from "react";
import { api, fmt } from "@/lib/api";
import { Plus, Loader2, X, Copy, Check, Ticket, Search, Ban } from "lucide-react";

const STATUS_COLORS: Record<string, string> = {
  active: "bg-green-100 text-green-700",
  used: "bg-blue-100 text-blue-700",
  cancelled: "bg-red-100 text-red-600",
};

export default function AdminVouchers() {
  const [vouchers, setVouchers] = useState<any[]>([]);
  const [plans, setPlans] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [planFilter, setPlanFilter] = useState("");
  const [page, setPage] = useState(1);
  const [showGenerate, setShowGenerate] = useState(false);
  const [genForm, setGenForm] = useState({ planId: "", quantity: 1, validityDays: 30, sellingPrice: "", notes: "" });
  const [generating, setGenerating] = useState(false);
  const [newCodes, setNewCodes] = useState<string[]>([]);
  const [copied, setCopied] = useState<string | null>(null);
  const limit = 25;

  const load = () => {
    setLoading(true);
    const p = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (search) p.set("search", search);
    if (statusFilter) p.set("status", statusFilter);
    if (planFilter) p.set("planId", planFilter);
    Promise.all([
      api.get<any>(`/super-admin/vouchers?${p}`),
      api.get<any>("/super-admin/plans"),
    ]).then(([v, pl]) => {
      setVouchers(v.data); setTotal(v.total);
      setPlans(pl.data || []);
    }).catch(console.error).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [page, search, statusFilter, planFilter]);

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
      load();
    } finally { setGenerating(false); }
  };

  const cancelVoucher = async (id: number) => {
    if (!confirm("Is voucher ko cancel karna chahte hain?")) return;
    await api.patch(`/super-admin/vouchers/${id}`, { status: "cancelled" });
    load();
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

  const inputCls = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";

  return (
    <div className="max-w-6xl space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Ticket className="w-6 h-6 text-indigo-500" /> License Vouchers
          <span className="text-gray-400 text-base font-normal">({total})</span>
        </h1>
        <button onClick={() => { setShowGenerate(true); setNewCodes([]); }}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg">
          <Plus className="w-4 h-4" /> Generate Vouchers
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-40">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} placeholder="Voucher code search..."
              className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
          <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
            <option value="">All Status</option>
            <option value="active">Active</option>
            <option value="used">Used</option>
            <option value="cancelled">Cancelled</option>
          </select>
          <select value={planFilter} onChange={e => { setPlanFilter(e.target.value); setPage(1); }}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
            <option value="">All Plans</option>
            {plans.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-48"><Loader2 className="w-5 h-5 animate-spin text-indigo-500" /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-600">
                <tr>
                  <th className="text-left px-4 py-3 font-medium">#</th>
                  <th className="text-left px-4 py-3 font-medium">Code</th>
                  <th className="text-left px-4 py-3 font-medium">Plan</th>
                  <th className="text-right px-4 py-3 font-medium">Price</th>
                  <th className="text-center px-4 py-3 font-medium">Validity</th>
                  <th className="text-center px-4 py-3 font-medium">Status</th>
                  <th className="text-left px-4 py-3 font-medium">Redeemed By</th>
                  <th className="text-left px-4 py-3 font-medium">Generated</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {vouchers.length === 0 && (
                  <tr><td colSpan={9} className="text-center py-12 text-gray-400">Koi voucher nahi mila</td></tr>
                )}
                {vouchers.map((v, idx) => (
                  <tr key={v.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-400 text-xs">{(page - 1) * limit + idx + 1}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-indigo-700 tracking-wider">{v.code}</span>
                        <button onClick={() => copyCode(v.code)} className="text-gray-400 hover:text-indigo-500">
                          {copied === v.code ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                      {v.notes && <div className="text-xs text-gray-400 mt-0.5">{v.notes}</div>}
                    </td>
                    <td className="px-4 py-3">
                      <span className="bg-blue-100 text-blue-700 text-xs px-2 py-0.5 rounded-full">{v.planName}</span>
                    </td>
                    <td className="px-4 py-3 text-right text-sm font-medium text-gray-700">
                      {v.sellingPrice ? `₹${Number(v.sellingPrice).toLocaleString("en-IN")}` : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-4 py-3 text-center text-xs text-gray-600">{v.validityDays} days</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`text-xs px-2 py-0.5 rounded-full capitalize ${STATUS_COLORS[v.status] || "bg-gray-100 text-gray-600"}`}>
                        {v.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-600">
                      {v.redeemedByBusiness ? (
                        <div>
                          <div className="font-medium">{v.redeemedByBusiness}</div>
                          <div className="text-gray-400">{v.redeemedAt ? fmt.date(v.redeemedAt) : ""}</div>
                        </div>
                      ) : <span className="text-gray-400">—</span>}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-400">{fmt.date(v.createdAt)}</td>
                    <td className="px-4 py-3">
                      {v.status === "active" && (
                        <button onClick={() => cancelVoucher(v.id)} className="p-1.5 text-red-400 hover:bg-red-50 rounded-lg" title="Cancel voucher">
                          <Ban className="w-3.5 h-3.5" />
                        </button>
                      )}
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

      {/* Generate Modal */}
      {showGenerate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={e => e.target === e.currentTarget && !newCodes.length && setShowGenerate(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="text-lg font-semibold flex items-center gap-2"><Ticket className="w-5 h-5 text-indigo-500" /> Generate License Vouchers</h2>
              <button onClick={() => setShowGenerate(false)}><X className="w-5 h-5 text-gray-400" /></button>
            </div>

            {newCodes.length > 0 ? (
              <div className="p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-green-700">{newCodes.length} voucher(s) generate ho gaye!</p>
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
                <p className="text-xs text-gray-500">Yeh codes buyer ko de do. Buyer apne software mein jaake "Activate License" mein code daalega.</p>
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
                    <p className="text-xs text-gray-400 mt-1">Max 50 ek baar mein</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Validity (Days)</label>
                    <input type="number" min={1} className={inputCls} value={genForm.validityDays}
                      onChange={e => setGenForm(f => ({ ...f, validityDays: Number(e.target.value) }))} />
                    <p className="text-xs text-gray-400 mt-1">Plan activate hone ke baad</p>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Selling Price (₹) <span className="text-gray-400 font-normal">(optional)</span></label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-medium text-sm">₹</span>
                    <input type="number" min={0} step={1} className={inputCls + " pl-7"} placeholder="e.g. 999"
                      value={genForm.sellingPrice} onChange={e => setGenForm(f => ({ ...f, sellingPrice: e.target.value }))} />
                  </div>
                  <p className="text-xs text-gray-400 mt-1">Buyer se kitna liya — record ke liye</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Notes (optional)</label>
                  <input type="text" className={inputCls} placeholder="e.g. Sharma Ji ke liye, Delhi batch..."
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
