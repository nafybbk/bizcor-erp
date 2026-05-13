import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Plus, Trash2, Loader2, Edit2, X, Check, Globe } from "lucide-react";

export default function States() {
  const [states, setStates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);
  const [stateName, setStateName] = useState("");
  const [stateCode, setStateCode] = useState("");
  const [stateAbbr, setStateAbbr] = useState("");
  const [saving, setSaving] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editCode, setEditCode] = useState("");
  const [editAbbr, setEditAbbr] = useState("");

  const load = () => {
    setLoading(true);
    api.get<any>("/masters/states").then(r => setStates(r.data)).catch(console.error).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    await api.post("/masters/states", { stateName, stateCode, stateAbbr });
    setStateName(""); setStateCode(""); setStateAbbr("");
    setSaving(false); load();
  };

  const startEdit = (s: any) => { setEditId(s.id); setEditName(s.stateName); setEditCode(s.stateCode); setEditAbbr(s.stateAbbr || ""); };
  const cancelEdit = () => setEditId(null);
  const saveEdit = async (id: number) => {
    await api.patch(`/masters/states/${id}`, { stateName: editName, stateCode: editCode, stateAbbr: editAbbr });
    setEditId(null); load();
  };

  const del = async (id: number) => {
    if (!confirm("Delete this state?")) return;
    await api.delete(`/masters/states/${id}`);
    load();
  };

  const seedIndianStates = async () => {
    if (!confirm("This will load all 37 standard Indian GST states. Continue?")) return;
    setSeeding(true);
    await api.post("/masters/states/seed-india");
    setSeeding(false); load();
  };

  const inputCls = "border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";

  return (
    <div className="max-w-2xl space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">States / Place of Supply</h1>
        <button
          onClick={seedIndianStates}
          disabled={seeding}
          className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg disabled:opacity-60"
        >
          {seeding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Globe className="w-4 h-4" />}
          Load Indian States
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="font-semibold text-gray-800 mb-4 text-sm">Add New State</h3>
        <form onSubmit={save} className="flex gap-2 flex-wrap">
          <input value={stateCode} onChange={e => setStateCode(e.target.value)} placeholder="Code (e.g. 27)"
            className={inputCls + " w-24"} required maxLength={5} />
          <input value={stateName} onChange={e => setStateName(e.target.value)} placeholder="State Name (e.g. Maharashtra)"
            className={inputCls + " flex-1 min-w-40"} required />
          <input value={stateAbbr} onChange={e => setStateAbbr(e.target.value)} placeholder="Abbr (e.g. MH)"
            className={inputCls + " w-24"} maxLength={4} />
          <button type="submit" disabled={saving} className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg disabled:opacity-60">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Add
          </button>
        </form>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-32"><Loader2 className="w-5 h-5 animate-spin text-blue-500" /></div>
        ) : states.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-gray-400 gap-2">
            <Globe className="w-8 h-8" />
            <p className="text-sm">No states added yet. Click "Load Indian States" to auto-fill all GST states.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="text-left px-4 py-3 font-medium w-10">#</th>
                <th className="text-left px-4 py-3 font-medium w-20">Code</th>
                <th className="text-left px-4 py-3 font-medium">State Name</th>
                <th className="text-left px-4 py-3 font-medium w-20">Abbr</th>
                <th className="px-4 py-3 w-24"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {states.map((s, idx) => (
                <tr key={s.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 text-gray-400 text-xs">{idx + 1}</td>
                  {editId === s.id ? (
                    <>
                      <td className="px-2 py-2"><input value={editCode} onChange={e => setEditCode(e.target.value)} className={inputCls + " w-20"} maxLength={5} /></td>
                      <td className="px-2 py-2"><input value={editName} onChange={e => setEditName(e.target.value)} className={inputCls + " w-full"} /></td>
                      <td className="px-2 py-2"><input value={editAbbr} onChange={e => setEditAbbr(e.target.value)} className={inputCls + " w-20"} maxLength={4} /></td>
                      <td className="px-2 py-2">
                        <div className="flex items-center gap-1">
                          <button onClick={() => saveEdit(s.id)} className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg"><Check className="w-4 h-4" /></button>
                          <button onClick={cancelEdit} className="p-1.5 text-gray-400 hover:bg-gray-100 rounded-lg"><X className="w-4 h-4" /></button>
                        </div>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="px-4 py-3 font-mono font-bold text-blue-600">{s.stateCode}</td>
                      <td className="px-4 py-3 text-gray-900">{s.stateName}</td>
                      <td className="px-4 py-3 text-gray-500 font-mono text-xs">{s.stateAbbr}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => startEdit(s)} className="p-1.5 text-blue-500 hover:bg-blue-50 rounded-lg"><Edit2 className="w-4 h-4" /></button>
                          <button onClick={() => del(s.id)} className="p-1.5 text-red-400 hover:bg-red-50 rounded-lg"><Trash2 className="w-4 h-4" /></button>
                        </div>
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
