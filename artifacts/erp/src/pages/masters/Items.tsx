import { useEffect, useState } from "react";
import { api, fmt } from "@/lib/api";
import { downloadCSV } from "@/lib/export";
import { Plus, Search, Loader2, Trash2, Edit2, X, Download } from "lucide-react";

const emptyForm = { name: "", description: "", type: "goods" as "goods"|"service", hsnCode: "", unitId: "", taxRateId: "", salePrice: "", purchasePrice: "", openingStock: "", lowStockAlert: "" };

export default function Items() {
  const [items, setItems] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [units, setUnits] = useState<any[]>([]);
  const [taxRates, setTaxRates] = useState<any[]>([]);
  const limit = 50;

  useEffect(() => {
    Promise.all([api.get<any>("/masters/units"), api.get<any>("/masters/tax-rates")])
      .then(([u, t]) => { setUnits(u.data); setTaxRates(t.data); }).catch(console.error);
  }, []);

  const load = () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (search) params.set("search", search);
    api.get<any>(`/items?${params}`)
      .then(r => { setItems(r.data); setTotal(r.total); })
      .catch(console.error).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [page, search]);

  const openCreate = () => { setEditId(null); setForm({ ...emptyForm }); setError(""); setShowModal(true); };
  const openEdit = (it: any) => {
    setEditId(it.id);
    setForm({ name: it.name, description: it.description||"", type: it.type, hsnCode: it.hsnCode||"", unitId: String(it.unitId||""), taxRateId: String(it.taxRateId||""), salePrice: String(it.salePrice||""), purchasePrice: String(it.purchasePrice||""), openingStock: String(it.openingStock||""), lowStockAlert: String(it.lowStockAlert||"") });
    setError(""); setShowModal(true);
  };

  const save = async () => {
    setSaving(true); setError("");
    try {
      const payload = { ...form, unitId: form.unitId ? Number(form.unitId) : undefined, taxRateId: form.taxRateId ? Number(form.taxRateId) : undefined };
      if (editId) await api.patch(`/items/${editId}`, payload);
      else await api.post("/items", payload);
      setShowModal(false); load();
    } catch (err: any) { setError(err.message); }
    finally { setSaving(false); }
  };

  const del = async (id: number) => {
    if (!confirm("Delete item?")) return;
    await api.delete(`/items/${id}`);
    load();
  };

  const exportCSV = () => {
    const rows = items.map(it => ({
      "Name": it.name,
      "Type": it.type,
      "HSN Code": it.hsnCode || "",
      "Unit": it.unitName || "",
      "Tax Rate %": it.taxRate || 0,
      "Sale Price": it.salePrice || 0,
      "Purchase Price": it.purchasePrice || 0,
      "Opening Stock": it.openingStock || 0,
      "Current Stock": it.currentStock || 0,
      "Low Stock Alert": it.lowStockAlert || 0,
      "Description": it.description || "",
    }));
    downloadCSV(rows, `Items_${new Date().toISOString().slice(0, 10)}.csv`);
  };

  const inputCls = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";

  return (
    <div className="max-w-5xl space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Items</h1>
        <div className="flex gap-2">
          <button onClick={exportCSV} className="flex items-center gap-2 px-4 py-2 border border-green-300 text-green-700 bg-green-50 hover:bg-green-100 text-sm font-medium rounded-lg transition-colors">
            <Download className="w-4 h-4" /> Excel
          </button>
          <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg">
            <Plus className="w-4 h-4" /> Add Item
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="p-4 border-b border-gray-100">
          <div className="relative max-w-sm">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} placeholder="Search items..."
              className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
        </div>
        {loading ? (
          <div className="flex items-center justify-center h-48"><Loader2 className="w-5 h-5 animate-spin text-blue-500" /></div>
        ) : items.length === 0 ? (
          <div className="text-center py-16 text-gray-400">No items found. <button onClick={openCreate} className="text-blue-600">Add one →</button></div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="text-left px-4 py-3 font-medium">Item</th>
                <th className="text-left px-4 py-3 font-medium">Type</th>
                <th className="text-left px-4 py-3 font-medium">HSN</th>
                <th className="text-right px-4 py-3 font-medium">Sale Price</th>
                <th className="text-right px-4 py-3 font-medium">Purchase Price</th>
                <th className="text-right px-4 py-3 font-medium">Stock</th>
                <th className="text-right px-4 py-3 font-medium">Tax Rate</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {items.map(it => (
                <tr key={it.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900">{it.name}</div>
                    {it.description && <div className="text-xs text-gray-400">{it.description}</div>}
                  </td>
                  <td className="px-4 py-3"><span className={`text-xs px-2 py-0.5 rounded-full capitalize ${it.type === "goods" ? "bg-blue-100 text-blue-700" : "bg-purple-100 text-purple-700"}`}>{it.type}</span></td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-500">{it.hsnCode || "-"}</td>
                  <td className="px-4 py-3 text-right">{fmt.currency(it.salePrice)}</td>
                  <td className="px-4 py-3 text-right">{fmt.currency(it.purchasePrice)}</td>
                  <td className="px-4 py-3 text-right">
                    <span className={`font-medium ${it.currentStock <= 0 ? "text-red-600" : "text-gray-900"}`}>{fmt.number(it.currentStock, 0)} {it.unitName}</span>
                  </td>
                  <td className="px-4 py-3 text-right text-gray-500">{it.taxRate ? `${it.taxRate}%` : "-"}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <button onClick={() => openEdit(it)} className="p-1.5 text-blue-500 hover:bg-blue-50 rounded-lg"><Edit2 className="w-4 h-4" /></button>
                      <button onClick={() => del(it.id)} className="p-1.5 text-red-400 hover:bg-red-50 rounded-lg"><Trash2 className="w-4 h-4" /></button>
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
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="text-lg font-semibold">{editId ? "Edit Item" : "Add Item"}</h2>
              <button onClick={() => setShowModal(false)}><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <div className="p-6 grid grid-cols-2 gap-4">
              <div className="col-span-2"><label className="block text-sm font-medium text-gray-700 mb-1">Name *</label><input className={inputCls} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                <select className={inputCls} value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value as any }))}>
                  <option value="goods">Goods</option><option value="service">Service</option>
                </select>
              </div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">HSN Code</label><input className={inputCls} value={form.hsnCode} onChange={e => setForm(f => ({ ...f, hsnCode: e.target.value }))} /></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Unit</label>
                <select className={inputCls} value={form.unitId} onChange={e => setForm(f => ({ ...f, unitId: e.target.value }))}>
                  <option value="">None</option>{units.map(u => <option key={u.id} value={u.id}>{u.name} ({u.symbol})</option>)}
                </select>
              </div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Tax Rate</label>
                <select className={inputCls} value={form.taxRateId} onChange={e => setForm(f => ({ ...f, taxRateId: e.target.value }))}>
                  <option value="">None</option>{taxRates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Sale Price (₹)</label><input type="number" className={inputCls} value={form.salePrice} onChange={e => setForm(f => ({ ...f, salePrice: e.target.value }))} /></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Purchase Price (₹)</label><input type="number" className={inputCls} value={form.purchasePrice} onChange={e => setForm(f => ({ ...f, purchasePrice: e.target.value }))} /></div>
              {form.type === "goods" && (
                <>
                  <div><label className="block text-sm font-medium text-gray-700 mb-1">Opening Stock</label><input type="number" className={inputCls} value={form.openingStock} onChange={e => setForm(f => ({ ...f, openingStock: e.target.value }))} /></div>
                  <div><label className="block text-sm font-medium text-gray-700 mb-1">Low Stock Alert</label><input type="number" className={inputCls} value={form.lowStockAlert} onChange={e => setForm(f => ({ ...f, lowStockAlert: e.target.value }))} /></div>
                </>
              )}
              <div className="col-span-2"><label className="block text-sm font-medium text-gray-700 mb-1">Description</label><textarea className={inputCls} rows={2} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} /></div>
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
