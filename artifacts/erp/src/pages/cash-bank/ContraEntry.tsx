import { useEffect, useState } from "react";
import { api, fmt } from "@/lib/api";
import { Plus, Trash2, Loader2, ArrowRight, RefreshCw } from "lucide-react";

export default function ContraEntry() {
  const [entries, setEntries] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [filters, setFilters] = useState({ fromDate: "", toDate: "" });

  const [form, setForm] = useState({
    date: fmt.today(),
    fromAccountId: "",
    toAccountId: "",
    amount: "",
    notes: "",
  });

  const load = () => {
    setLoading(true);
    const q = new URLSearchParams();
    if (filters.fromDate) q.set("fromDate", filters.fromDate);
    if (filters.toDate) q.set("toDate", filters.toDate);
    api.get<any>(`/cash-bank/contra?${q}`).then(r => setEntries(r.data || [])).catch(console.error).finally(() => setLoading(false));
  };

  useEffect(() => { api.get<any[]>("/cash-bank/accounts").then(setAccounts).catch(console.error); }, []);
  useEffect(() => { load(); }, [filters]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(""); setSaving(true);
    try {
      await api.post("/cash-bank/contra", {
        ...form,
        fromAccountId: Number(form.fromAccountId),
        toAccountId: Number(form.toAccountId),
        amount: Number(form.amount),
      });
      setShowForm(false); setForm({ date: fmt.today(), fromAccountId: "", toAccountId: "", amount: "", notes: "" }); load();
    } catch (err: any) { setError(err.message); }
    finally { setSaving(false); }
  };

  const del = async (id: number, num: string) => {
    if (!confirm(`${num} delete karein?`)) return;
    await api.delete(`/cash-bank/contra/${id}`);
    load();
  };

  const inp = "border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-full";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Contra Entry</h1>
        <button onClick={() => { setShowForm(!showForm); setError(""); }}
          className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700">
          <Plus className="w-4 h-4" /> New Contra Entry
        </button>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-sm text-blue-700">
        Contra entry = cash aur bank ke beech transfer (e.g. Cash → Bank deposit, Bank → Cash withdrawal)
      </div>

      {showForm && (
        <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
          <h2 className="font-semibold text-gray-800">New Transfer</h2>
          {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2 rounded-lg">{error}</div>}
          <form onSubmit={save} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date *</label>
                <input type="date" className={inp} value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Amount (₹) *</label>
                <input type="number" min="0.01" step="0.01" className={inp} value={form.amount}
                  onFocus={e => e.target.select()}
                  onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} required />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">From Account *</label>
                <select className={inp} value={form.fromAccountId} onChange={e => setForm(f => ({ ...f, fromAccountId: e.target.value }))} required>
                  <option value="">-- Select --</option>
                  {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </div>
              <div className="flex-shrink-0 mt-5">
                <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
                  <ArrowRight className="w-4 h-4 text-gray-600" />
                </div>
              </div>
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">To Account *</label>
                <select className={inp} value={form.toAccountId} onChange={e => setForm(f => ({ ...f, toAccountId: e.target.value }))} required>
                  <option value="">-- Select --</option>
                  {accounts.filter(a => String(a.id) !== form.fromAccountId).map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
              <input className={inp} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Optional narration..." />
            </div>
            <div className="flex gap-3 justify-end">
              <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50">Cancel</button>
              <button type="submit" disabled={saving} className="flex items-center gap-2 px-5 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 disabled:opacity-60">
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                <RefreshCw className="w-4 h-4" /> Save Transfer
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">From Date</label>
            <input type="date" className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-full"
              value={filters.fromDate} onChange={e => setFilters(f => ({ ...f, fromDate: e.target.value }))} />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">To Date</label>
            <input type="date" className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-full"
              value={filters.toDate} onChange={e => setFilters(f => ({ ...f, toDate: e.target.value }))} />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-32"><Loader2 className="w-6 h-6 animate-spin text-blue-500" /></div>
        ) : entries.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <RefreshCw className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <div className="font-medium">Koi contra entry nahi</div>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase">Voucher#</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase">Date</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase">From → To</th>
                <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase">Amount</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase">Notes</th>
                <th className="w-12" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {entries.map(e => (
                <tr key={e.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2.5 text-sm font-medium text-purple-700">{e.contra_number}</td>
                  <td className="px-4 py-2.5 text-sm text-gray-600">{fmt.date(e.date)}</td>
                  <td className="px-4 py-2.5 text-sm text-gray-800">
                    <span className="text-gray-700">{e.from_account_name}</span>
                    <ArrowRight className="w-3.5 h-3.5 inline mx-1.5 text-gray-400" />
                    <span className="text-gray-700">{e.to_account_name}</span>
                  </td>
                  <td className="px-4 py-2.5 text-sm text-right font-semibold text-purple-700">{fmt.currency(e.amount)}</td>
                  <td className="px-4 py-2.5 text-sm text-gray-400">{e.notes || "—"}</td>
                  <td className="px-4 py-2.5">
                    <button onClick={() => del(e.id, e.contra_number)} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
