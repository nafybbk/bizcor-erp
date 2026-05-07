import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { api, fmt } from "@/lib/api";
import { Loader2 } from "lucide-react";

interface Props {
  editId?: number;
  initialData?: any;
}

export default function ExpenseCreate({ editId, initialData }: Props) {
  const [, navigate] = useLocation();
  const [accounts, setAccounts] = useState<any[]>([]);
  const [heads, setHeads] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    date: initialData?.date || fmt.today(),
    expenseHeadId: initialData?.expenseHeadId ? String(initialData.expenseHeadId) : "",
    accountId: initialData?.accountId ? String(initialData.accountId) : "",
    amount: initialData?.amount ? String(initialData.amount) : "",
    paymentMode: initialData?.paymentMode || "cash",
    referenceNumber: initialData?.referenceNumber || "",
    notes: initialData?.notes || "",
  });

  useEffect(() => {
    api.get<any[]>("/cash-bank/accounts").then(setAccounts).catch(console.error);
    api.get<any[]>("/cash-bank/expense-heads").then(setHeads).catch(console.error);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(""); setLoading(true);
    try {
      const payload = {
        ...form,
        expenseHeadId: form.expenseHeadId ? Number(form.expenseHeadId) : null,
        accountId: form.accountId ? Number(form.accountId) : null,
        amount: Number(form.amount),
      };
      if (editId) await api.patch(`/cash-bank/expenses/${editId}`, payload);
      else await api.post("/cash-bank/expenses", payload);
      navigate("/cash-bank/expenses");
    } catch (err: any) { setError(err.message); }
    finally { setLoading(false); }
  };

  const inp = "border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-full";

  return (
    <form onSubmit={handleSubmit} className="max-w-xl space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">{editId ? "Edit" : "New"} Expense</h1>
        <div className="flex gap-3">
          <button type="button" onClick={() => navigate("/cash-bank/expenses")} className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50">Cancel</button>
          <button type="submit" disabled={loading} className="flex items-center gap-2 px-5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium disabled:opacity-60">
            {loading && <Loader2 className="w-4 h-4 animate-spin" />} {editId ? "Update" : "Save"} Expense
          </button>
        </div>
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">{error}</div>}

      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Date *</label>
            <input type="date" className={inp} value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Amount (₹) *</label>
            <input type="number" min="0" step="0.01" className={inp} value={form.amount}
              onFocus={e => e.target.select()}
              onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} required />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Expense Head</label>
          <select className={inp} value={form.expenseHeadId} onChange={e => setForm(f => ({ ...f, expenseHeadId: e.target.value }))}>
            <option value="">-- Select Expense Head --</option>
            {heads.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
          </select>
          {heads.length === 0 && <div className="text-xs text-amber-600 mt-1">Pehle Expense Heads mein heads banao</div>}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Pay From Account</label>
          <select className={inp} value={form.accountId} onChange={e => setForm(f => ({ ...f, accountId: e.target.value }))}>
            <option value="">-- Select Account --</option>
            {accounts.map(a => <option key={a.id} value={a.id}>{a.name} ({a.type})</option>)}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Payment Mode</label>
            <select className={inp} value={form.paymentMode} onChange={e => setForm(f => ({ ...f, paymentMode: e.target.value }))}>
              <option value="cash">Cash</option>
              <option value="bank">Bank Transfer</option>
              <option value="cheque">Cheque</option>
              <option value="upi">UPI</option>
              <option value="other">Other</option>
            </select>
          </div>
          {form.paymentMode !== "cash" && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Reference #</label>
              <input className={inp} value={form.referenceNumber} onChange={e => setForm(f => ({ ...f, referenceNumber: e.target.value }))} placeholder="Cheque / UTR no." />
            </div>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
          <textarea className={inp} rows={2} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Optional narration..." />
        </div>
      </div>
    </form>
  );
}
