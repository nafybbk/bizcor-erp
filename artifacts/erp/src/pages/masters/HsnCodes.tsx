import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Plus, Loader2 } from "lucide-react";

export default function HsnCodes() {
  const [codes, setCodes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ code: "", description: "", taxRate: "" });
  const [saving, setSaving] = useState(false);

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

  return (
    <div className="max-w-2xl space-y-4">
      <h1 className="text-2xl font-bold text-gray-900">HSN Codes</h1>
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <form onSubmit={save} className="grid grid-cols-3 gap-3">
          <input value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value }))} placeholder="HSN Code"
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" required />
          <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Description"
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          <div className="flex gap-2">
            <input type="number" value={form.taxRate} onChange={e => setForm(f => ({ ...f, taxRate: e.target.value }))} placeholder="Tax %"
              className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            <button type="submit" disabled={saving} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg disabled:opacity-60">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            </button>
          </div>
        </form>
      </div>
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? <div className="flex items-center justify-center h-32"><Loader2 className="w-5 h-5 animate-spin text-blue-500" /></div> : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600"><tr><th className="text-left px-4 py-3 font-medium">HSN Code</th><th className="text-left px-4 py-3 font-medium">Description</th><th className="text-right px-4 py-3 font-medium">Tax Rate</th></tr></thead>
            <tbody className="divide-y divide-gray-50">
              {codes.map(c => (
                <tr key={c.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono font-bold text-blue-700">{c.code}</td>
                  <td className="px-4 py-3 text-gray-700">{c.description || "-"}</td>
                  <td className="px-4 py-3 text-right text-gray-500">{c.taxRate ? `${c.taxRate}%` : "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
