import { useEffect, useState } from "react";
import { Link } from "wouter";
import { api, fmt } from "@/lib/api";
import { Loader2, Banknote, Building2, Receipt, RefreshCw, ArrowRight, TrendingDown } from "lucide-react";

export default function CashBankDashboard() {
  const [balances, setBalances] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<any[]>("/cash-bank/balances").then(setBalances).catch(console.error).finally(() => setLoading(false));
  }, []);

  const cashAccounts = balances.filter(a => a.type === "cash");
  const bankAccounts = balances.filter(a => a.type === "bank");
  const totalCash = cashAccounts.reduce((s, a) => s + a.balance, 0);
  const totalBank = bankAccounts.reduce((s, a) => s + a.balance, 0);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Cash & Bank</h1>

      {loading ? (
        <div className="flex items-center justify-center h-32"><Loader2 className="w-6 h-6 animate-spin text-blue-500" /></div>
      ) : balances.length === 0 ? (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 text-center">
          <Banknote className="w-10 h-10 mx-auto mb-3 text-amber-500 opacity-60" />
          <div className="font-semibold text-amber-800">Pehle Cash/Bank accounts banao</div>
          <Link href="/cash-bank/accounts">
            <a className="mt-3 inline-flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-medium hover:bg-amber-700">
              Accounts Setup Karo <ArrowRight className="w-4 h-4" />
            </a>
          </Link>
        </div>
      ) : (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-2xl p-5 text-white">
              <div className="flex items-center gap-3 mb-3">
                <Banknote className="w-6 h-6 opacity-80" />
                <span className="font-medium opacity-90">Total Cash</span>
              </div>
              <div className="text-3xl font-bold">{fmt.currency(totalCash)}</div>
              <div className="text-xs opacity-70 mt-1">{cashAccounts.length} account{cashAccounts.length !== 1 ? "s" : ""}</div>
            </div>
            <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl p-5 text-white">
              <div className="flex items-center gap-3 mb-3">
                <Building2 className="w-6 h-6 opacity-80" />
                <span className="font-medium opacity-90">Total Bank</span>
              </div>
              <div className="text-3xl font-bold">{fmt.currency(totalBank)}</div>
              <div className="text-xs opacity-70 mt-1">{bankAccounts.length} account{bankAccounts.length !== 1 ? "s" : ""}</div>
            </div>
            <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-2xl p-5 text-white">
              <div className="flex items-center gap-3 mb-3">
                <Receipt className="w-6 h-6 opacity-80" />
                <span className="font-medium opacity-90">Total Balance</span>
              </div>
              <div className="text-3xl font-bold">{fmt.currency(totalCash + totalBank)}</div>
              <div className="text-xs opacity-70 mt-1">Cash + Bank combined</div>
            </div>
          </div>

          {/* Account list */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {cashAccounts.length > 0 && (
              <div className="bg-white rounded-xl border border-gray-200 p-4">
                <h3 className="font-semibold text-gray-700 mb-3 text-sm uppercase tracking-wide flex items-center gap-2"><Banknote className="w-4 h-4 text-green-500" /> Cash Accounts</h3>
                <div className="space-y-2">
                  {cashAccounts.map(a => (
                    <div key={a.id} className="flex items-center justify-between">
                      <span className="text-sm text-gray-700">{a.name}</span>
                      <span className={`text-sm font-semibold ${a.balance >= 0 ? "text-green-700" : "text-red-600"}`}>{fmt.currency(a.balance)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {bankAccounts.length > 0 && (
              <div className="bg-white rounded-xl border border-gray-200 p-4">
                <h3 className="font-semibold text-gray-700 mb-3 text-sm uppercase tracking-wide flex items-center gap-2"><Building2 className="w-4 h-4 text-blue-500" /> Bank Accounts</h3>
                <div className="space-y-2">
                  {bankAccounts.map(a => (
                    <div key={a.id} className="flex items-center justify-between">
                      <div>
                        <div className="text-sm text-gray-700">{a.name}</div>
                        {a.bankName && <div className="text-xs text-gray-400">{a.bankName} {a.accountNumber ? `• ${a.accountNumber}` : ""}</div>}
                      </div>
                      <span className={`text-sm font-semibold ${a.balance >= 0 ? "text-blue-700" : "text-red-600"}`}>{fmt.currency(a.balance)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Quick actions */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Link href="/cash-bank/expenses/new">
              <a className="flex flex-col items-center gap-2 p-4 bg-red-50 border border-red-100 rounded-xl hover:bg-red-100 transition-colors text-center">
                <TrendingDown className="w-6 h-6 text-red-500" />
                <span className="text-sm font-medium text-red-700">New Expense</span>
              </a>
            </Link>
            <Link href="/cash-bank/contra">
              <a className="flex flex-col items-center gap-2 p-4 bg-purple-50 border border-purple-100 rounded-xl hover:bg-purple-100 transition-colors text-center">
                <RefreshCw className="w-6 h-6 text-purple-500" />
                <span className="text-sm font-medium text-purple-700">Contra Entry</span>
              </a>
            </Link>
            <Link href="/cash-bank/statement">
              <a className="flex flex-col items-center gap-2 p-4 bg-blue-50 border border-blue-100 rounded-xl hover:bg-blue-100 transition-colors text-center">
                <Receipt className="w-6 h-6 text-blue-500" />
                <span className="text-sm font-medium text-blue-700">Statement</span>
              </a>
            </Link>
            <Link href="/cash-bank/accounts">
              <a className="flex flex-col items-center gap-2 p-4 bg-gray-50 border border-gray-100 rounded-xl hover:bg-gray-100 transition-colors text-center">
                <Building2 className="w-6 h-6 text-gray-500" />
                <span className="text-sm font-medium text-gray-700">Accounts</span>
              </a>
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
