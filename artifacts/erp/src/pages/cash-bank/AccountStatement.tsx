import { useEffect, useState } from "react";
import { api, fmt } from "@/lib/api";
import { Loader2, Download, Banknote, Building2, CreditCard, Hash } from "lucide-react";

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
  const cashAccounts = accounts.filter(a => a.type === "cash");
  const bankAccounts = accounts.filter(a => a.type === "bank");

  const typeLabel = (type: string) => {
    const map: Record<string, string> = {
      receipt: "Receipt", payment: "Payment", expense: "Expense", contra: "Contra",
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

  const inp = "border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";

  const isBank = selectedAccount?.type === "bank";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Cash / Bank Statement</h1>
        {statement && (
          <button onClick={() => window.print()} className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50 print:hidden">
            <Download className="w-4 h-4" /> Print
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 print:hidden">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="md:col-span-2">
            <label className="block text-xs text-gray-500 mb-1 font-medium">Account Select Karein</label>
            {accountsLoading ? (
              <div className="flex items-center gap-2 h-10"><Loader2 className="w-4 h-4 animate-spin text-blue-500" /><span className="text-sm text-gray-400">Loading...</span></div>
            ) : accounts.length === 0 ? (
              <div className="text-sm text-amber-600 bg-amber-50 border border-amber-200 px-3 py-2 rounded-lg">Pehle Cash/Bank account add karein</div>
            ) : (
              <select
                className={`${inp} w-full`}
                value={selectedAccountId}
                onChange={e => setSelectedAccountId(e.target.value)}
              >
                {cashAccounts.length > 0 && (
                  <optgroup label="── Cash Accounts ──">
                    {cashAccounts.map(a => (
                      <option key={a.id} value={a.id}>
                        💵 {a.name}
                      </option>
                    ))}
                  </optgroup>
                )}
                {bankAccounts.length > 0 && (
                  <optgroup label="── Bank Accounts ──">
                    {bankAccounts.map(a => (
                      <option key={a.id} value={a.id}>
                        🏦 {a.name}{a.bankName ? ` — ${a.bankName}` : ""}{a.accountNumber ? ` (${a.accountNumber})` : ""}
                      </option>
                    ))}
                  </optgroup>
                )}
              </select>
            )}
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1 font-medium">From Date</label>
            <input type="date" className={`${inp} w-full`} value={fromDate} onChange={e => setFromDate(e.target.value)} />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1 font-medium">To Date</label>
            <input type="date" className={`${inp} w-full`} value={toDate} onChange={e => setToDate(e.target.value)} />
          </div>
        </div>
      </div>

      {/* Selected Account Info Card */}
      {selectedAccount && !accountsLoading && (
        <div className={`rounded-xl border p-4 flex items-center gap-4 ${isBank ? "bg-blue-50 border-blue-200" : "bg-green-50 border-green-200"}`}>
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${isBank ? "bg-blue-100" : "bg-green-100"}`}>
            {isBank ? <Building2 className="w-6 h-6 text-blue-600" /> : <Banknote className="w-6 h-6 text-green-600" />}
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-bold text-gray-800 text-base">{selectedAccount.name}</div>
            <div className="flex flex-wrap items-center gap-3 mt-1">
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${isBank ? "bg-blue-100 text-blue-700" : "bg-green-100 text-green-700"}`}>
                {isBank ? "Bank Account" : "Cash Account"}
              </span>
              {isBank && selectedAccount.bankName && (
                <span className="flex items-center gap-1 text-xs text-gray-600">
                  <Building2 className="w-3 h-3" /> {selectedAccount.bankName}
                </span>
              )}
              {isBank && selectedAccount.accountNumber && (
                <span className="flex items-center gap-1 text-xs text-gray-600">
                  <Hash className="w-3 h-3" /> A/c: {selectedAccount.accountNumber}
                </span>
              )}
              {isBank && selectedAccount.ifscCode && (
                <span className="flex items-center gap-1 text-xs text-gray-600">
                  <CreditCard className="w-3 h-3" /> IFSC: {selectedAccount.ifscCode}
                </span>
              )}
            </div>
          </div>
          {statement && (
            <div className="text-right flex-shrink-0">
              <div className="text-xs text-gray-500 mb-0.5">Current Balance</div>
              <div className={`text-xl font-bold ${statement.closingBalance >= 0 ? (isBank ? "text-blue-700" : "text-green-700") : "text-red-600"}`}>
                {fmt.currency(statement.closingBalance)}
              </div>
            </div>
          )}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-32"><Loader2 className="w-6 h-6 animate-spin text-blue-500" /></div>
      ) : statement ? (
        <div className="space-y-4">
          {/* Summary row */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
              <div className="text-xs text-gray-500 mb-1">Opening Balance</div>
              <div className="text-lg font-bold text-gray-700">{fmt.currency(statement.openingBalance)}</div>
            </div>
            <div className="bg-green-50 rounded-xl border border-green-100 p-4 text-center">
              <div className="text-xs text-gray-500 mb-1">Total In (Received)</div>
              <div className="text-lg font-bold text-green-700">{fmt.currency(statement.totalDebit)}</div>
            </div>
            <div className="bg-red-50 rounded-xl border border-red-100 p-4 text-center">
              <div className="text-xs text-gray-500 mb-1">Total Out (Paid)</div>
              <div className="text-lg font-bold text-red-700">{fmt.currency(statement.totalCredit)}</div>
            </div>
          </div>

          {/* Ledger table */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            {statement.entries.length === 0 ? (
              <div className="text-center py-12 text-gray-400 text-sm">Is period mein koi transaction nahi</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase">Date</th>
                      <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase">Type</th>
                      <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase">Voucher #</th>
                      <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase">Narration</th>
                      <th className="text-right px-4 py-2.5 text-xs font-semibold text-green-600 uppercase">In (Dr)</th>
                      <th className="text-right px-4 py-2.5 text-xs font-semibold text-red-500 uppercase">Out (Cr)</th>
                      <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase">Balance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    <tr className="bg-gray-50">
                      <td colSpan={6} className="px-4 py-2 text-sm text-gray-500 font-medium italic">Opening Balance</td>
                      <td className="px-4 py-2 text-sm text-right font-bold text-gray-700">{fmt.currency(statement.openingBalance)}</td>
                    </tr>
                    {statement.entries.map((entry: any, i: number) => (
                      <tr key={i} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-2.5 text-sm text-gray-600 whitespace-nowrap">{fmt.date(entry.date)}</td>
                        <td className="px-4 py-2.5"><span className={typeBadge(entry.type)}>{typeLabel(entry.type)}</span></td>
                        <td className="px-4 py-2.5 text-sm font-medium text-blue-600">{entry.number}</td>
                        <td className="px-4 py-2.5 text-sm text-gray-600">{entry.narration}</td>
                        <td className="px-4 py-2.5 text-sm text-right font-medium text-green-700">
                          {entry.debit > 0 ? fmt.currency(entry.debit) : <span className="text-gray-300">—</span>}
                        </td>
                        <td className="px-4 py-2.5 text-sm text-right font-medium text-red-600">
                          {entry.credit > 0 ? fmt.currency(entry.credit) : <span className="text-gray-300">—</span>}
                        </td>
                        <td className={`px-4 py-2.5 text-sm text-right font-semibold ${entry.balance >= 0 ? "text-gray-800" : "text-red-600"}`}>
                          {fmt.currency(Math.abs(entry.balance))}{entry.balance < 0 ? " Cr" : ""}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-gray-50 border-t-2 border-gray-200">
                    <tr className="font-bold">
                      <td colSpan={4} className="px-4 py-3 text-sm text-gray-700">Closing Balance</td>
                      <td className="px-4 py-3 text-sm text-right text-green-700">{fmt.currency(statement.totalDebit)}</td>
                      <td className="px-4 py-3 text-sm text-right text-red-600">{fmt.currency(statement.totalCredit)}</td>
                      <td className={`px-4 py-3 text-sm text-right font-bold ${statement.closingBalance >= 0 ? "text-blue-700" : "text-red-600"}`}>
                        {fmt.currency(Math.abs(statement.closingBalance))}{statement.closingBalance < 0 ? " Cr" : ""}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="text-center py-16 text-gray-400 text-sm">Account select karein statement dekhne ke liye</div>
      )}
    </div>
  );
}
