import { useEffect, useState } from "react";
import { api, fmt } from "@/lib/api";
import { Plus, Edit2, Trash2, Loader2, X, Check, Banknote, Building2, Star } from "lucide-react";

interface Account {
  id: number;
  name: string;
  type: "cash" | "bank";
  bankName: string | null;
  accountNumber: string | null;
  ifscCode: string | null;
  openingBalance: number;
  isDefault: boolean;
}

const empty = (): Omit<Account, "id"> => ({
  name: "", type: "cash", bankName: "", accountNumber: "", ifscCode: "",
  openingBalance: 0, isDefault: false,
});

export default function CashBankAccounts() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState(empty());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = () => {
    setLoading(true);
    api.get<Account[]>("/cash-bank/accounts").then(setAccounts).catch(console.error).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const openNew = () => { setEditId(null); setForm(empty()); setError(""); setShowForm(true); };
  const openEdit = (a: Account) => { setEditId(a.id); setForm({ name: a.name, type: a.type, bankName: a.bankName || "", accountNumber: a.accountNumber || "", ifscCode: a.ifscCode || "", openingBalance: a.openingBalance, isDefault: a.isDefault }); setError(""); setShowForm(true); };
  const cancel = () => { setShowForm(false); setEditId(null); };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(""); setSaving(true);
    try {
      if (editId) await api.patch(`/cash-bank/accounts/${editId}`, form);
      else await api.post("/cash-bank/accounts", form);
      load(); cancel();
    } catch (err: any) { setError(err.message); }
    finally { setSaving(false); }
  };

  const del = async (id: number, name: string) => {
    if (!confirm(`"${name}" hatayein?`)) return;
    await api.delete(`/cash-bank/accounts/${id}`);
    load();
  };

  const inp = "border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-full";

  const cashAccounts = accounts.filter(a => a.type === "cash");
  const bankAccounts = accounts.filter(a => a.type === "bank");

  return (
    <div className="max-w-3xl space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Cash & Bank Accounts</h1>
        <button onClick={openNew} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
          <Plus className="w-4 h-4" /> Add Account
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
          <h2 className="font-semibold text-gray-800">{editId ? "Edit Account" : "New Account"}</h2>
          {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2 rounded-lg">{error}</div>}
          <form onSubmit={save} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Account Name *</label>
                <input className={inp} required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Cash in Hand, SBI Current" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Type *</label>
                <select className={inp} value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value as any }))}>
                  <option value="cash">Cash</option>
                  <option value="bank">Bank</option>
                </select>
              </div>
            </div>
            {form.type === "bank" && (
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Bank Name</label>
                  <input className={inp} value={form.bankName || ""} onChange={e => setForm(f => ({ ...f, bankName: e.target.value }))} placeholder="e.g. SBI" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Account Number</label>
                  <input className={inp} value={form.accountNumber || ""} onChange={e => setForm(f => ({ ...f, accountNumber: e.target.value }))} placeholder="XXXX XXXX XXXX" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">IFSC Code</label>
                  <input className={inp} value={form.ifscCode || ""} onChange={e => setForm(f => ({ ...f, ifscCode: e.target.value.toUpperCase() }))} placeholder="SBIN0001234" />
                </div>
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Opening Balance (₹)</label>
                <input type="number" step="0.01" className={inp} value={form.openingBalance} onFocus={e => e.target.select()} onChange={e => setForm(f => ({ ...f, openingBalance: Number(e.target.value) }))} />
              </div>
              <div className="flex items-end pb-2">
                <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                  <input type="checkbox" checked={form.isDefault} onChange={e => setForm(f => ({ ...f, isDefault: e.target.checked }))} className="rounded" />
                  Default account for receipts/payments
                </label>
              </div>
            </div>
            <div className="flex gap-3 justify-end">
              <button type="button" onClick={cancel} className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50 flex items-center gap-1"><X className="w-4 h-4" /> Cancel</button>
              <button type="submit" disabled={saving} className="px-5 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-60 flex items-center gap-2">
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                <Check className="w-4 h-4" /> {editId ? "Update" : "Save"}
              </button>
            </div>
          </form>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-32"><Loader2 className="w-6 h-6 animate-spin text-blue-500" /></div>
      ) : (
        <div className="space-y-4">
          {cashAccounts.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-2"><Banknote className="w-4 h-4" /> Cash Accounts</h3>
              <div className="space-y-2">
                {cashAccounts.map(a => (
                  <div key={a.id} className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center flex-shrink-0">
                      <Banknote className="w-5 h-5 text-green-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-gray-800">{a.name}</span>
                        {a.isDefault && <span className="flex items-center gap-1 text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full"><Star className="w-3 h-3" /> Default</span>}
                      </div>
                      <div className="text-sm text-gray-500">Opening: {fmt.currency(a.openingBalance)}</div>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => openEdit(a)} className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"><Edit2 className="w-4 h-4" /></button>
                      <button onClick={() => del(a.id, a.name)} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {bankAccounts.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-2"><Building2 className="w-4 h-4" /> Bank Accounts</h3>
              <div className="space-y-2">
                {bankAccounts.map(a => (
                  <div key={a.id} className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center flex-shrink-0">
                      <Building2 className="w-5 h-5 text-blue-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-gray-800">{a.name}</span>
                        {a.isDefault && <span className="flex items-center gap-1 text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full"><Star className="w-3 h-3" /> Default</span>}
                      </div>
                      <div className="text-sm text-gray-500 space-x-3">
                        {a.bankName && <span>{a.bankName}</span>}
                        {a.accountNumber && <span>A/c: {a.accountNumber}</span>}
                        {a.ifscCode && <span>IFSC: {a.ifscCode}</span>}
                        <span>Opening: {fmt.currency(a.openingBalance)}</span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => openEdit(a)} className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"><Edit2 className="w-4 h-4" /></button>
                      <button onClick={() => del(a.id, a.name)} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {accounts.length === 0 && (
            <div className="text-center py-16 text-gray-400">
              <Banknote className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <div className="font-medium">No accounts yet</div>
              <div className="text-sm mt-1">Click Add Account to get started</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
