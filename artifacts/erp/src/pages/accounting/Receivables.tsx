import { useEffect, useState } from "react";
import { api, fmt } from "@/lib/api";
import { downloadCSV } from "@/lib/export";
import { Loader2, Download } from "lucide-react";

export default function Receivables() {
  const [data, setData] = useState<any[]>([]);
  const [totalOutstanding, setTotalOutstanding] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<any>("/accounting/outstanding-receivables")
      .then(r => { setData(r.data); setTotalOutstanding(r.totalOutstanding); })
      .catch(console.error).finally(() => setLoading(false));
  }, []);

  const exportCSV = () => {
    const rows = [
      ...data.map(r => ({
        "Party": r.partyName,
        "Total Invoiced": r.totalAmount,
        "Received": r.paidAmount,
        "Balance Due": r.balanceDue,
      })),
      { "Party": "TOTAL", "Total Invoiced": "", "Received": "", "Balance Due": totalOutstanding },
    ];
    downloadCSV(rows, `Outstanding_Receivables_${new Date().toISOString().slice(0, 10)}.csv`);
  };

  return (
    <div className="max-w-4xl space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Outstanding Receivables</h1>
        <div className="flex items-center gap-3">
          <button onClick={exportCSV} disabled={loading || data.length === 0}
            className="flex items-center gap-2 px-4 py-2 border border-green-300 text-green-700 bg-green-50 hover:bg-green-100 text-sm font-medium rounded-lg transition-colors disabled:opacity-40">
            <Download className="w-4 h-4" /> Excel
          </button>
          <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-2 text-center">
            <div className="text-xs text-blue-600">Total Outstanding</div>
            <div className="text-lg font-bold text-blue-700">{fmt.currency(totalOutstanding)}</div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-48"><Loader2 className="w-5 h-5 animate-spin text-blue-500" /></div>
        ) : data.length === 0 ? (
          <div className="text-center py-16 text-gray-400">No outstanding receivables</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="text-left px-4 py-3 font-medium">Party</th>
                <th className="text-right px-4 py-3 font-medium">Total Invoiced</th>
                <th className="text-right px-4 py-3 font-medium">Received</th>
                <th className="text-right px-4 py-3 font-medium">Balance Due</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {data.map((r, i) => (
                <tr key={i} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{r.partyName}</td>
                  <td className="px-4 py-3 text-right">{fmt.currency(r.totalAmount)}</td>
                  <td className="px-4 py-3 text-right text-green-600">{fmt.currency(r.paidAmount)}</td>
                  <td className="px-4 py-3 text-right font-bold text-red-600">{fmt.currency(r.balanceDue)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-gray-50 border-t-2 border-gray-200">
              <tr>
                <td colSpan={3} className="px-4 py-3 font-bold text-gray-700 text-right">Total Outstanding</td>
                <td className="px-4 py-3 font-bold text-red-700 text-right">{fmt.currency(totalOutstanding)}</td>
              </tr>
            </tfoot>
          </table>
        )}
      </div>
    </div>
  );
}
