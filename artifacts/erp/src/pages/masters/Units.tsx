import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Plus, Trash2, Loader2 } from "lucide-react";

export default function Units() {
  const [units, setUnits] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [symbol, setSymbol] = useState("");
  const [saving, setSaving] = useState(false);

  const load = () => {
    setLoading(true);
    api.get<any>("/masters/units").then(r => setUnits(r.data)).catch(console.error).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    await api.post("/masters/units", { name, symbol });
    setName(""); setSymbol(""); setSaving(false); load();
  };

  const del = async (id: number) => {
    if (!confirm("Delete unit?")) return;
    await api.delete(`/masters/units/${id}`);
    load();
  };

  return (
    <div className="max-w-xl space-y-4">
      <h1 className="text-2xl font-bold text-gray-900">Units of Measurement</h1>

      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="font-semibold text-gray-800 mb-4 text-sm">Add New Unit</h3>
        <form onSubmit={save} className="flex gap-3">
          <input value={name} onChange={e => setName(e.target.value)} placeholder="Full Name (e.g. Kilogram)"
            className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" required />
          <input value={symbol} onChange={e => setSymbol(e.target.value)} placeholder="Symbol (e.g. KG)"
            className="w-28 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" required />
          <button type="submit" disabled={saving} className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg disabled:opacity-60">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Add
          </button>
        </form>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-32"><Loader2 className="w-5 h-5 animate-spin text-blue-500" /></div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600"><tr><th className="text-left px-4 py-3 font-medium">Name</th><th className="text-left px-4 py-3 font-medium">Symbol</th><th className="px-4 py-3"></th></tr></thead>
            <tbody className="divide-y divide-gray-50">
              {units.map(u => (
                <tr key={u.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-900">{u.name}</td>
                  <td className="px-4 py-3 font-mono font-bold text-blue-600">{u.symbol}</td>
                  <td className="px-4 py-3 text-right"><button onClick={() => del(u.id)} className="p-1.5 text-red-400 hover:bg-red-50 rounded-lg"><Trash2 className="w-4 h-4" /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
