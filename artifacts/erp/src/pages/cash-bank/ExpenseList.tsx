import { useEffect, useState } from "react";
import { Link } from "wouter";
import { api, fmt } from "@/lib/api";
import { Plus, Trash2, Loader2, Edit2, Receipt } from "lucide-react";

export default function ExpenseList() {
  const [data, setData] = useState<any[]>([]);
  const [totalAmount, setTotalAmount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [heads, setHeads] = useState<any[]>([]);
  const [filters, setFilters] = useState({ fromDate: "", toDate: "", accountId: "", expenseHeadId: "" });

  const load = () => {
    setLoading(true);
    const q = new URLSearchParams();
    if (filters.fromDate) q.set("fromDate", filters.fromDate);
    if (filters.toDate) q.set("toDate", filters.toDate);
    if (filters.accountId) q.set("accountId", filters.accountId);
    if (filters.expenseHeadId) q.set("expenseHeadId", filters.expenseHeadId);
    api.get<any>(`/cash-bank/expenses?${q}`).then(r => { setData(r.data || []); setTotalAmount(r.totalAmount || 0); }).catch(console.error).finally(() => setLoading(false));
  };

  useEffect(() => {
    api.get<any[]>("/cash-bank/accounts").then(setAccounts).catch(console.error);
    api.get<any[]>("/cash-bank/expense-heads").then(setHeads).catch(console.error);
  }, []);

  useEffect(() => { load(); }, [filters]);

  const del = async (id: number, num: string) => {
    if (!confirm(`Delete ${num}?`)) return;
    await api.delete(`/cash-bank/expenses/${id}`);
    load();
  };

  const inp = "border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Expenses</h1>
        <Link href="/cash-bank/expenses/new">
          <a className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700">
            <Plus className="w-4 h-4" /> New Expense
          </a>
        </Link>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">From Date</label>
            <input type="date" className={inp + " w-full"} value={filters.fromDate} onChange={e => setFilters(f => ({ ...f, fromDate: e.target.value }))} />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">To Date</label>
            <input type="date" className={inp + " w-full"} value={filters.toDate} onChange={e => setFilters(f => ({ ...f, toDate: e.target.value }))} />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Account</label>
            <select className={inp + " w-full"} value={filters.accountId} onChange={e => setFilters(f => ({ ...f, accountId: e.target.value }))}>
              <option value="">All Accounts</option>
              {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Expense Head</label>
            <select className={inp + " w-full"} value={filters.expenseHeadId} onChange={e => setFilters(f => ({ ...f, expenseHeadId: e.target.value }))}>
              <option value="">All Heads</option>
              {heads.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
            </select>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-32"><Loader2 className="w-6 h-6 animate-spin text-blue-500" /></div>
        ) : data.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <Receipt className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <div className="font-medium">No expenses yet</div>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase">Voucher#</th>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase">Date</th>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase">Expense Head</th>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase">Account</th>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase">Mode</th>
                    <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase">Amount</th>
                    <th className="w-20" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {data.map(e => (
                    <tr key={e.id} className="hover:bg-gray-50">
                      <td className="px-4 py-2.5 text-sm font-medium text-gray-800">{e.expenseNumber}</td>
                      <td className="px-4 py-2.5 text-sm text-gray-600">{fmt.date(e.date)}</td>
                      <td className="px-4 py-2.5 text-sm text-gray-800">{e.expenseHeadName || <span className="text-gray-400">—</span>}</td>
                      <td className="px-4 py-2.5 text-sm text-gray-600">{e.accountName || <span className="text-gray-400">—</span>}</td>
                      <td className="px-4 py-2.5 text-sm text-gray-600 capitalize">{e.paymentMode}</td>
                      <td className="px-4 py-2.5 text-sm text-right font-semibold text-red-600">{fmt.currency(e.amount)}</td>
                      <td className="px-4 py-2.5">
                        <div className="flex gap-1 justify-end">
                          <Link href={`/cash-bank/expenses/${e.id}/edit`}>
                            <a className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"><Edit2 className="w-3.5 h-3.5" /></a>
                          </Link>
                          <button onClick={() => del(e.id, e.expenseNumber)} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-gray-50 border-t border-gray-200">
                  <tr>
                    <td colSpan={5} className="px-4 py-2.5 text-sm font-semibold text-gray-700">Total</td>
                    <td className="px-4 py-2.5 text-sm text-right font-bold text-red-700">{fmt.currency(totalAmount)}</td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
