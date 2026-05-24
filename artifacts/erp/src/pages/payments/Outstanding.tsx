import { useEffect, useState } from "react";
import { api, fmt } from "@/lib/api";
import { Loader2, TrendingUp, TrendingDown } from "lucide-react";

export default function Outstanding() {
  const [receivables, setReceivables] = useState<any[]>([]);
  const [payables, setPayables] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get<any>("/accounting/outstanding-receivables"),
      api.get<any>("/accounting/outstanding-payables"),
    ]).then(([r, p]) => {
      setReceivables(r.data || []);
      setPayables(p.data || []);
    }).catch(console.error).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-6 h-6 animate-spin text-blue-500" /></div>;

  const totalReceivable = receivables.reduce((s, r) => s + r.balanceDue, 0);
  const totalPayable = payables.reduce((s, p) => s + p.balanceDue, 0);

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-bold text-gray-900">Outstanding Summary</h1>

      {/* Summary Totals */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
            <TrendingUp className="w-5 h-5 text-blue-600" />
          </div>
          <div className="min-w-0">
            <div className="text-xs text-blue-500 font-medium">Receivables</div>
            <div className="text-base font-bold text-blue-700 truncate">{fmt.currency(totalReceivable)}</div>
          </div>
        </div>
        <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-red-100 flex items-center justify-center flex-shrink-0">
            <TrendingDown className="w-5 h-5 text-red-600" />
          </div>
          <div className="min-w-0">
            <div className="text-xs text-red-500 font-medium">Payables</div>
            <div className="text-base font-bold text-red-700 truncate">{fmt.currency(totalPayable)}</div>
          </div>
        </div>
      </div>

      {/* Tables — stacked on mobile, side-by-side on lg+ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* Receivables */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <div className="w-2 h-2 rounded-full bg-blue-500"></div>
            <h2 className="text-sm font-semibold text-gray-700">Receivables
              <span className="ml-2 text-gray-400 font-normal">({receivables.length})</span>
            </h2>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            {receivables.length === 0 ? (
              <div className="text-center py-10 text-gray-400 text-sm">Koi outstanding receivable nahi</div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="text-left px-4 py-2.5 font-medium text-gray-500 text-xs uppercase tracking-wide">Party</th>
                    <th className="text-right px-4 py-2.5 font-medium text-gray-500 text-xs uppercase tracking-wide w-32">Balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {receivables.map((r, i) => (
                    <tr key={i} className="hover:bg-blue-50/40 transition-colors">
                      <td className="px-4 py-2.5 font-medium text-gray-900 truncate max-w-0" style={{ maxWidth: "1px", width: "100%" }}>
                        <span className="block truncate">{r.partyName}</span>
                      </td>
                      <td className="px-4 py-2.5 text-right font-bold text-blue-700 whitespace-nowrap w-32">{fmt.currency(r.balanceDue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Payables */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <div className="w-2 h-2 rounded-full bg-red-500"></div>
            <h2 className="text-sm font-semibold text-gray-700">Payables
              <span className="ml-2 text-gray-400 font-normal">({payables.length})</span>
            </h2>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            {payables.length === 0 ? (
              <div className="text-center py-10 text-gray-400 text-sm">Koi outstanding payable nahi</div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="text-left px-4 py-2.5 font-medium text-gray-500 text-xs uppercase tracking-wide">Party</th>
                    <th className="text-right px-4 py-2.5 font-medium text-gray-500 text-xs uppercase tracking-wide w-32">Balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {payables.map((p, i) => (
                    <tr key={i} className="hover:bg-red-50/40 transition-colors">
                      <td className="px-4 py-2.5 font-medium text-gray-900 truncate max-w-0" style={{ maxWidth: "1px", width: "100%" }}>
                        <span className="block truncate">{p.partyName}</span>
                      </td>
                      <td className="px-4 py-2.5 text-right font-bold text-red-700 whitespace-nowrap w-32">{fmt.currency(p.balanceDue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
