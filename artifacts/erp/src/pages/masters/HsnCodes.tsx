import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Plus, Loader2, Edit2, Trash2, X, Check } from "lucide-react";
import { useAuth } from "@/lib/auth";

export default function HsnCodes() {
  const { user } = useAuth();
  const canEdit = user?.canEdit !== false;
  const canDelete = user?.canDelete !== false;
  const [codes, setCodes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ code: "", description: "", taxRate: "" });
  const [saving, setSaving] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState({ code: "", description: "", taxRate: "" });

  const load = () => {
    setLoading(true);
    api.get<any>("/masters/hsn").then(r => setCodes(r.data)).catch(console.error).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    await api.post("/masters/hsn", { ...form, taxRate: form.taxRate ? Number(form.taxRate) : null });
    setForm({ code: "", description: "", taxRate: "" }); setSaving(false); load();
  };

  const startEdit = (c: any) => { setEditId(c.id); setEditForm({ code: c.code, description: c.description || "", taxRate: c.taxRate ? String(c.taxRate) : "" }); };
  const cancelEdit = () => setEditId(null);
  const saveEdit = async (id: number) => {
    await api.patch(`/masters/hsn/${id}`, { ...editForm, taxRate: editForm.taxRate ? Number(editForm.taxRate) : null });
    setEditId(null); load();
  };

  const del = async (id: number) => {
    if (!confirm("Delete HSN code?")) return;
    await api.delete(`/masters/hsn/${id}`);
    load();
  };

  const inputCls = "border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";

  return (
    <div className="max-w-3xl space-y-4">
      <h1 className="text-2xl font-bold text-gray-900">HSN / SAC Codes</h1>
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="font-semibold text-gray-800 mb-3 text-sm">Add New Code</h3>
        <form onSubmit={save} className="grid grid-cols-4 gap-3">
          <input value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value }))} placeholder="HSN/SAC Code"
            className={inputCls} required />
          <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Description"
            className={inputCls + " col-span-2"} />
          <div className="flex gap-2">
            <input type="number" value={form.taxRate} onChange={e => setForm(f => ({ ...f, taxRate: e.target.value }))} placeholder="Tax %"
              className={inputCls + " flex-1"} />
            <button type="submit" disabled={saving} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg disabled:opacity-60">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            </button>
          </div>
        </form>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? <div className="flex items-center justify-center h-32"><Loader2 className="w-5 h-5 animate-spin text-blue-500" /></div> : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="text-left px-4 py-3 font-medium">#</th>
                <th className="text-left px-4 py-3 font-medium">Code</th>
                <th className="text-left px-4 py-3 font-medium">Description</th>
                <th className="text-right px-4 py-3 font-medium">Tax Rate</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {codes.map((c, idx) => (
                <tr key={c.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-400 text-xs">{idx + 1}</td>
                  {editId === c.id ? (
                    <>
                      <td className="px-2 py-2"><input value={editForm.code} onChange={e => setEditForm(f => ({ ...f, code: e.target.value }))} className={inputCls + " w-32"} /></td>
                      <td className="px-2 py-2"><input value={editForm.description} onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))} className={inputCls + " w-full"} /></td>
                      <td className="px-2 py-2"><input type="number" value={editForm.taxRate} onChange={e => setEditForm(f => ({ ...f, taxRate: e.target.value }))} className={inputCls + " w-20 text-right"} /></td>
                      <td className="px-2 py-2">
                        <div className="flex items-center gap-1">
                          <button onClick={() => saveEdit(c.id)} className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg"><Check className="w-4 h-4" /></button>
                          <button onClick={cancelEdit} className="p-1.5 text-gray-400 hover:bg-gray-100 rounded-lg"><X className="w-4 h-4" /></button>
                        </div>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="px-4 py-3 font-mono font-bold text-blue-700">{c.code}</td>
                      <td className="px-4 py-3 text-gray-700">{c.description || "-"}</td>
                      <td className="px-4 py-3 text-right text-gray-500">{c.taxRate ? `${c.taxRate}%` : "-"}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          {canEdit && <button onClick={() => startEdit(c)} className="p-1.5 text-blue-500 hover:bg-blue-50 rounded-lg"><Edit2 className="w-4 h-4" /></button>}
                          {canDelete && <button onClick={() => del(c.id)} className="p-1.5 text-red-400 hover:bg-red-50 rounded-lg"><Trash2 className="w-4 h-4" /></button>}
                        </div>
                      </td>
                    </>
                  )}
                </tr>
              ))}
              {codes.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">No HSN codes added yet</td></tr>}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
