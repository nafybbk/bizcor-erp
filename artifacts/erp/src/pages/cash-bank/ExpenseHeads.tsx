import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Plus, Edit2, Trash2, Loader2, X, Check } from "lucide-react";

interface ExpenseHead { id: number; name: string; }

export default function ExpenseHeads() {
  const [heads, setHeads] = useState<ExpenseHead[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState("");
  const [saving, setSaving] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");

  const load = () => {
    setLoading(true);
    api.get<ExpenseHead[]>("/cash-bank/expense-heads").then(setHeads).catch(console.error).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setSaving(true);
    await api.post("/cash-bank/expense-heads", { name: newName.trim() });
    setNewName(""); setSaving(false); load();
  };

  const startEdit = (h: ExpenseHead) => { setEditId(h.id); setEditName(h.name); };
  const cancelEdit = () => setEditId(null);
  const saveEdit = async (id: number) => {
    await api.patch(`/cash-bank/expense-heads/${id}`, { name: editName });
    setEditId(null); load();
  };
  const del = async (id: number, name: string) => {
    if (!confirm(`"${name}" hatayein?`)) return;
    await api.delete(`/cash-bank/expense-heads/${id}`);
    load();
  };

  const inp = "border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";

  return (
    <div className="max-w-xl space-y-5">
      <h1 className="text-2xl font-bold text-gray-900">Expense Heads</h1>

      <form onSubmit={save} className="flex gap-3">
        <input className={`${inp} flex-1`} placeholder="New expense head (e.g. Rent, Salary)" value={newName}
          onChange={e => setNewName(e.target.value)} />
        <button type="submit" disabled={saving || !newName.trim()} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-60">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Add
        </button>
      </form>

      {loading ? (
        <div className="flex items-center justify-center h-24"><Loader2 className="w-5 h-5 animate-spin text-blue-500" /></div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {heads.length === 0 ? (
            <div className="text-center py-12 text-gray-400 text-sm">Koi expense head nahi hai</div>
          ) : (
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase">#</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase">Name</th>
                  <th className="w-20" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {heads.map((h, i) => (
                  <tr key={h.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2.5 text-sm text-gray-400">{i + 1}</td>
                    <td className="px-4 py-2.5 text-sm">
                      {editId === h.id ? (
                        <div className="flex gap-2">
                          <input className={`${inp} flex-1`} value={editName} onChange={e => setEditName(e.target.value)}
                            onKeyDown={e => { if (e.key === "Enter") saveEdit(h.id); if (e.key === "Escape") cancelEdit(); }}
                            autoFocus />
                          <button onClick={() => saveEdit(h.id)} className="text-green-600 hover:text-green-700"><Check className="w-4 h-4" /></button>
                          <button onClick={cancelEdit} className="text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
                        </div>
                      ) : (
                        <span className="text-gray-800 font-medium">{h.name}</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      {editId !== h.id && (
                        <div className="flex gap-1 justify-end">
                          <button onClick={() => startEdit(h)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"><Edit2 className="w-3.5 h-3.5" /></button>
                          <button onClick={() => del(h.id, h.name)} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      <div className="bg-blue-50 rounded-xl p-4 text-sm text-blue-700">
        <div className="font-medium mb-1">Default expense heads:</div>
        <div className="text-blue-600 text-xs space-y-0.5">
          <div>Rent, Electricity, Salary, Office Supplies, Telephone, Internet, Petrol, Maintenance, Miscellaneous</div>
        </div>
      </div>
    </div>
  );
}
