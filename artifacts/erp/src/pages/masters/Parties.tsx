import { useEffect, useState } from "react";
import { api, fmt } from "@/lib/api";
import { downloadCSV } from "@/lib/export";
import { Plus, Search, Loader2, Trash2, Edit2, X, Download } from "lucide-react";

const INDIAN_STATES = [
  { name: "Andhra Pradesh", code: "37" }, { name: "Bihar", code: "10" }, { name: "Delhi", code: "07" },
  { name: "Goa", code: "30" }, { name: "Gujarat", code: "24" }, { name: "Haryana", code: "06" },
  { name: "Karnataka", code: "29" }, { name: "Kerala", code: "32" }, { name: "Madhya Pradesh", code: "23" },
  { name: "Maharashtra", code: "27" }, { name: "Punjab", code: "03" }, { name: "Rajasthan", code: "08" },
  { name: "Tamil Nadu", code: "33" }, { name: "Telangana", code: "36" }, { name: "Uttar Pradesh", code: "09" },
  { name: "West Bengal", code: "19" }, { name: "Chhattisgarh", code: "22" }, { name: "Uttarakhand", code: "05" },
];

const emptyForm = { name: "", type: "customer" as "customer"|"supplier"|"both", gstin: "", pan: "", phone: "", email: "", address: "", city: "", state: "", stateCode: "", pincode: "", openingBalance: "", openingBalanceType: "debit" as "debit"|"credit", creditLimit: "", creditDays: "" };

export default function Parties() {
  const [parties, setParties] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [type, setType] = useState("");
  const [page, setPage] = useState(1);
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const limit = 50;

  const load = () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (search) params.set("search", search);
    if (type) params.set("type", type);
    api.get<any>(`/parties?${params}`)
      .then(r => { setParties(r.data); setTotal(r.total); })
      .catch(console.error).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [page, search, type]);

  const openCreate = () => { setEditId(null); setForm({ ...emptyForm }); setError(""); setShowModal(true); };
  const openEdit = (p: any) => {
    setEditId(p.id);
    setForm({ name: p.name, type: p.type, gstin: p.gstin||"", pan: p.pan||"", phone: p.phone||"", email: p.email||"", address: p.address||"", city: p.city||"", state: p.state||"", stateCode: p.stateCode||"", pincode: p.pincode||"", openingBalance: String(p.openingBalance||""), openingBalanceType: p.openingBalanceType||"debit", creditLimit: String(p.creditLimit||""), creditDays: String(p.creditDays||"") });
    setError(""); setShowModal(true);
  };

  const save = async () => {
    setSaving(true); setError("");
    try {
      if (editId) await api.patch(`/parties/${editId}`, form);
      else await api.post("/parties", form);
      setShowModal(false); load();
    } catch (err: any) { setError(err.message); }
    finally { setSaving(false); }
  };

  const del = async (id: number) => {
    if (!confirm("Delete party?")) return;
    await api.delete(`/parties/${id}`);
    load();
  };

  const exportCSV = () => {
    const rows = parties.map(p => ({
      "Name": p.name,
      "Type": p.type,
      "GSTIN": p.gstin || "",
      "PAN": p.pan || "",
      "Phone": p.phone || "",
      "Email": p.email || "",
      "City": p.city || "",
      "State": p.state || "",
      "Pincode": p.pincode || "",
      "Opening Balance": p.openingBalance || 0,
      "Balance Type": p.openingBalanceType || "",
      "Credit Limit": p.creditLimit || 0,
      "Credit Days": p.creditDays || 0,
    }));
    downloadCSV(rows, `Parties_${new Date().toISOString().slice(0, 10)}.csv`);
  };

  const inputCls = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";

  return (
    <div className="max-w-5xl space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Parties</h1>
        <div className="flex gap-2">
          <button onClick={exportCSV} className="flex items-center gap-2 px-4 py-2 border border-green-300 text-green-700 bg-green-50 hover:bg-green-100 text-sm font-medium rounded-lg transition-colors">
            <Download className="w-4 h-4" /> Excel
          </button>
          <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg">
            <Plus className="w-4 h-4" /> Add Party
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} placeholder="Search by name or GSTIN..."
              className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <select value={type} onChange={e => setType(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">All Types</option>
            <option value="customer">Customers</option>
            <option value="supplier">Suppliers</option>
            <option value="both">Both</option>
          </select>
        </div>
        {loading ? (
          <div className="flex items-center justify-center h-48"><Loader2 className="w-5 h-5 animate-spin text-blue-500" /></div>
        ) : parties.length === 0 ? (
          <div className="text-center py-16 text-gray-400">No parties found. <button onClick={openCreate} className="text-blue-600">Add one →</button></div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="text-left px-4 py-3 font-medium">Name</th>
                <th className="text-left px-4 py-3 font-medium">GSTIN</th>
                <th className="text-left px-4 py-3 font-medium">Type</th>
                <th className="text-left px-4 py-3 font-medium">Phone</th>
                <th className="text-left px-4 py-3 font-medium">City</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {parties.map(p => (
                <tr key={p.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{p.name}</td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-500">{p.gstin || "-"}</td>
                  <td className="px-4 py-3"><span className={`text-xs px-2 py-0.5 rounded-full capitalize ${p.type === "customer" ? "bg-blue-100 text-blue-700" : p.type === "supplier" ? "bg-purple-100 text-purple-700" : "bg-gray-100 text-gray-700"}`}>{p.type}</span></td>
                  <td className="px-4 py-3 text-gray-600">{p.phone || "-"}</td>
                  <td className="px-4 py-3 text-gray-600">{p.city || "-"}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <button onClick={() => openEdit(p)} className="p-1.5 text-blue-500 hover:bg-blue-50 rounded-lg"><Edit2 className="w-4 h-4" /></button>
                      <button onClick={() => del(p.id)} className="p-1.5 text-red-400 hover:bg-red-50 rounded-lg"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="text-lg font-semibold">{editId ? "Edit Party" : "Add Party"}</h2>
              <button onClick={() => setShowModal(false)}><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <div className="p-6 grid grid-cols-2 gap-4">
              <div className="col-span-2"><label className="block text-sm font-medium text-gray-700 mb-1">Name *</label><input className={inputCls} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                <select className={inputCls} value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value as any }))}>
                  <option value="customer">Customer</option><option value="supplier">Supplier</option><option value="both">Both</option>
                </select>
              </div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">GSTIN</label><input className={inputCls} value={form.gstin} onChange={e => setForm(f => ({ ...f, gstin: e.target.value.toUpperCase() }))} maxLength={15} /></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">PAN</label><input className={inputCls} value={form.pan} onChange={e => setForm(f => ({ ...f, pan: e.target.value.toUpperCase() }))} maxLength={10} /></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Phone</label><input className={inputCls} value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} /></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Email</label><input type="email" className={inputCls} value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} /></div>
              <div className="col-span-2"><label className="block text-sm font-medium text-gray-700 mb-1">Address</label><input className={inputCls} value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} /></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">City</label><input className={inputCls} value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))} /></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">State</label>
                <select className={inputCls} value={form.state} onChange={e => {
                  const st = INDIAN_STATES.find(s => s.name === e.target.value);
                  setForm(f => ({ ...f, state: e.target.value, stateCode: st?.code || "" }));
                }}>
                  <option value="">Select State</option>
                  {INDIAN_STATES.map(s => <option key={s.code} value={s.name}>{s.name}</option>)}
                </select>
              </div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Pincode</label><input className={inputCls} value={form.pincode} onChange={e => setForm(f => ({ ...f, pincode: e.target.value }))} maxLength={6} /></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Opening Balance (₹)</label>
                <div className="flex gap-2">
                  <input type="number" className={inputCls} value={form.openingBalance} onChange={e => setForm(f => ({ ...f, openingBalance: e.target.value }))} />
                  <select className="border border-gray-300 rounded-lg px-2 py-2 text-sm focus:outline-none" value={form.openingBalanceType} onChange={e => setForm(f => ({ ...f, openingBalanceType: e.target.value as any }))}>
                    <option value="debit">Dr</option><option value="credit">Cr</option>
                  </select>
                </div>
              </div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Credit Limit (₹)</label><input type="number" className={inputCls} value={form.creditLimit} onChange={e => setForm(f => ({ ...f, creditLimit: e.target.value }))} /></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Credit Days</label><input type="number" className={inputCls} value={form.creditDays} onChange={e => setForm(f => ({ ...f, creditDays: e.target.value }))} /></div>
              {error && <div className="col-span-2 bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2 rounded-lg">{error}</div>}
            </div>
            <div className="px-6 py-4 border-t flex justify-end gap-3">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50">Cancel</button>
              <button onClick={save} disabled={saving} className="flex items-center gap-2 px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium disabled:opacity-60">
                {saving && <Loader2 className="w-4 h-4 animate-spin" />} Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
