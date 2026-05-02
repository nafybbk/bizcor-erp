import { useEffect, useState } from "react";
import { api, fmt } from "@/lib/api";
import { Loader2 } from "lucide-react";

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
    <div className="max-w-5xl space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Outstanding Summary</h1>
      <div className="grid grid-cols-2 gap-6">
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-gray-800">Receivables</h2>
            <span className="bg-blue-100 text-blue-700 text-sm font-bold px-3 py-1 rounded-full">{fmt.currency(totalReceivable)}</span>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            {receivables.length === 0 ? (
              <div className="text-center py-8 text-gray-400 text-sm">No outstanding receivables</div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-600"><tr><th className="text-left px-4 py-2.5 font-medium">Party</th><th className="text-right px-4 py-2.5 font-medium">Balance</th></tr></thead>
                <tbody className="divide-y divide-gray-50">
                  {receivables.map((r, i) => (
                    <tr key={i} className="hover:bg-gray-50">
                      <td className="px-4 py-2.5 font-medium text-gray-900">{r.partyName}</td>
                      <td className="px-4 py-2.5 text-right font-bold text-blue-700">{fmt.currency(r.balanceDue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-gray-800">Payables</h2>
            <span className="bg-red-100 text-red-700 text-sm font-bold px-3 py-1 rounded-full">{fmt.currency(totalPayable)}</span>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            {payables.length === 0 ? (
              <div className="text-center py-8 text-gray-400 text-sm">No outstanding payables</div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-600"><tr><th className="text-left px-4 py-2.5 font-medium">Party</th><th className="text-right px-4 py-2.5 font-medium">Balance</th></tr></thead>
                <tbody className="divide-y divide-gray-50">
                  {payables.map((p, i) => (
                    <tr key={i} className="hover:bg-gray-50">
                      <td className="px-4 py-2.5 font-medium text-gray-900">{p.partyName}</td>
                      <td className="px-4 py-2.5 text-right font-bold text-red-700">{fmt.currency(p.balanceDue)}</td>
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
