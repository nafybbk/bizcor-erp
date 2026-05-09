import { useEffect, useState } from "react";
import { api, fmt } from "@/lib/api";
import { Loader2, Download, Banknote, Building2 } from "lucide-react";

export default function AccountStatement() {
  const [accounts, setAccounts] = useState<any[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState(fmt.today());
  const [statement, setStatement] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [accountsLoading, setAccountsLoading] = useState(true);

  useEffect(() => {
    setAccountsLoading(true);
    api.get<any[]>("/cash-bank/accounts").then(accs => {
      setAccounts(accs);
      if (accs.length > 0) setSelectedAccountId(String(accs[0].id));
    }).catch(console.error).finally(() => setAccountsLoading(false));
  }, []);

  const load = async () => {
    if (!selectedAccountId) return;
    setLoading(true);
    try {
      const q = new URLSearchParams({ accountId: selectedAccountId });
      if (fromDate) q.set("fromDate", fromDate);
      if (toDate) q.set("toDate", toDate);
      const data = await api.get<any>(`/cash-bank/statement?${q}`);
      setStatement(data);
    } catch (err: any) { console.error(err); }
    finally { setLoading(false); }
  };

  useEffect(() => { if (selectedAccountId) load(); }, [selectedAccountId, fromDate, toDate]);

  const selectedAccount = accounts.find(a => String(a.id) === selectedAccountId);

  const printStatement = () => window.print();

  const inp = "border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";

  const typeLabel = (type: string) => {
    const map: Record<string, string> = {
      receipt: "Receipt", payment: "Payment", expense: "Expense",
      contra: "Contra",
    };
    return map[type] || type;
  };

  const typeBadge = (type: string) => {
    const map: Record<string, string> = {
      receipt: "bg-green-100 text-green-700",
      payment: "bg-red-100 text-red-700",
      expense: "bg-orange-100 text-orange-700",
      contra: "bg-purple-100 text-purple-700",
    };
    return `text-xs px-2 py-0.5 rounded-full font-medium ${map[type] || "bg-gray-100 text-gray-600"}`;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Cash / Bank Statement</h1>
        {statement && (
          <button onClick={printStatement} className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50">
            <Download className="w-4 h-4" /> Print
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="md:col-span-2">
            <label className="block text-xs text-gray-500 mb-1">Account</label>
            {accountsLoading ? (
              <div className="flex items-center gap-2 h-10"><Loader2 className="w-4 h-4 animate-spin text-blue-500" /></div>
            ) : (
              <select className={`${inp} w-full`} value={selectedAccountId} onChange={e => setSelectedAccountId(e.target.value)}>
                {accounts.length === 0 ? <option value="">No accounts — please add one first</option> : accounts.map(a => (
                  <option key={a.id} value={a.id}>{a.name} ({a.type})</option>
                ))}
              </select>
            )}
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">From Date</label>
            <input type="date" className={`${inp} w-full`} value={fromDate} onChange={e => setFromDate(e.target.value)} />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">To Date</label>
            <input type="date" className={`${inp} w-full`} value={toDate} onChange={e => setToDate(e.target.value)} />
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-32"><Loader2 className="w-6 h-6 animate-spin text-blue-500" /></div>
      ) : statement ? (
        <div className="space-y-4">
          {/* Account summary */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center gap-3 mb-4">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${selectedAccount?.type === "bank" ? "bg-blue-100" : "bg-green-100"}`}>
                {selectedAccount?.type === "bank" ? <Building2 className="w-5 h-5 text-blue-600" /> : <Banknote className="w-5 h-5 text-green-600" />}
              </div>
              <div>
                <div className="font-bold text-gray-800 text-lg">{statement.account?.name}</div>
                <div className="text-sm text-gray-500 capitalize">{statement.account?.type} Account</div>
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-gray-50 rounded-lg p-3 text-center">
                <div className="text-xs text-gray-500 mb-1">Opening Balance</div>
                <div className="text-base font-bold text-gray-800">{fmt.currency(statement.openingBalance)}</div>
              </div>
              <div className="bg-green-50 rounded-lg p-3 text-center">
                <div className="text-xs text-gray-500 mb-1">Total In (Debit)</div>
                <div className="text-base font-bold text-green-700">{fmt.currency(statement.totalDebit)}</div>
              </div>
              <div className="bg-red-50 rounded-lg p-3 text-center">
                <div className="text-xs text-gray-500 mb-1">Total Out (Credit)</div>
                <div className="text-base font-bold text-red-700">{fmt.currency(statement.totalCredit)}</div>
              </div>
              <div className="bg-blue-50 rounded-lg p-3 text-center">
                <div className="text-xs text-gray-500 mb-1">Closing Balance</div>
                <div className={`text-base font-bold ${statement.closingBalance >= 0 ? "text-blue-700" : "text-red-700"}`}>{fmt.currency(statement.closingBalance)}</div>
              </div>
            </div>
          </div>

          {/* Ledger */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            {statement.entries.length === 0 ? (
              <div className="text-center py-12 text-gray-400 text-sm">No transactions in this period</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase">Date</th>
                      <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase">Type</th>
                      <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase">Voucher#</th>
                      <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase">Narration</th>
                      <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase">In (Dr)</th>
                      <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase">Out (Cr)</th>
                      <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase">Balance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    <tr className="bg-gray-50">
                      <td colSpan={6} className="px-4 py-2 text-sm text-gray-500 font-medium">Opening Balance</td>
                      <td className="px-4 py-2 text-sm text-right font-semibold text-gray-700">{fmt.currency(statement.openingBalance)}</td>
                    </tr>
                    {statement.entries.map((entry: any, i: number) => (
                      <tr key={i} className="hover:bg-gray-50">
                        <td className="px-4 py-2.5 text-sm text-gray-600 whitespace-nowrap">{fmt.date(entry.date)}</td>
                        <td className="px-4 py-2.5"><span className={typeBadge(entry.type)}>{typeLabel(entry.type)}</span></td>
                        <td className="px-4 py-2.5 text-sm font-medium text-gray-700">{entry.number}</td>
                        <td className="px-4 py-2.5 text-sm text-gray-600">{entry.narration}</td>
                        <td className="px-4 py-2.5 text-sm text-right text-green-700 font-medium">{entry.debit > 0 ? fmt.currency(entry.debit) : ""}</td>
                        <td className="px-4 py-2.5 text-sm text-right text-red-600 font-medium">{entry.credit > 0 ? fmt.currency(entry.credit) : ""}</td>
                        <td className={`px-4 py-2.5 text-sm text-right font-semibold ${entry.balance >= 0 ? "text-gray-800" : "text-red-600"}`}>{fmt.currency(entry.balance)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-gray-50 border-t border-gray-200">
                    <tr className="font-bold">
                      <td colSpan={4} className="px-4 py-2.5 text-sm text-gray-700">Closing Balance</td>
                      <td className="px-4 py-2.5 text-sm text-right text-green-700">{fmt.currency(statement.totalDebit)}</td>
                      <td className="px-4 py-2.5 text-sm text-right text-red-600">{fmt.currency(statement.totalCredit)}</td>
                      <td className={`px-4 py-2.5 text-sm text-right ${statement.closingBalance >= 0 ? "text-blue-700" : "text-red-600"}`}>{fmt.currency(statement.closingBalance)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="text-center py-16 text-gray-400 text-sm">Select an account to view the statement</div>
      )}
    </div>
  );
}
