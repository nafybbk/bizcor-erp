import { useEffect, useState } from "react";
import { api, fmt } from "@/lib/api";
import { downloadCSV } from "@/lib/export";
import { Loader2, Download, Printer } from "lucide-react";

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
      ...data.map(r => ({ "Party": r.partyName, "Net Receivable": r.balanceDue })),
      { "Party": "TOTAL", "Net Receivable": totalOutstanding },
    ];
    downloadCSV(rows, `Outstanding_Receivables_${new Date().toISOString().slice(0, 10)}.csv`);
  };

  return (
    <div className="max-w-2xl space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-gray-900">Outstanding Receivables</h1>
        <div className="flex items-center gap-3 print:hidden">
          <button onClick={exportCSV} disabled={loading || data.length === 0}
            className="flex items-center gap-2 px-4 py-2 border border-green-300 text-green-700 bg-green-50 hover:bg-green-100 text-sm font-medium rounded-lg transition-colors disabled:opacity-40">
            <Download className="w-4 h-4" /> Excel
          </button>
          <button onClick={() => window.print()} disabled={loading || data.length === 0}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 bg-white hover:bg-gray-50 text-sm font-medium rounded-lg transition-colors disabled:opacity-40">
            <Printer className="w-4 h-4" /> Print
          </button>
          <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-2 text-center">
            <div className="text-xs text-green-600">Total Receivable</div>
            <div className="text-lg font-bold text-green-700">{fmt.currency(Math.abs(totalOutstanding))}</div>
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
            <thead className="bg-gray-50 text-gray-600 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium">Party</th>
                <th className="text-right px-4 py-3 font-medium">Net Receivable</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {data.map((r, i) => (
                <tr key={i} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{r.partyName}</td>
                  <td className="px-4 py-3 text-right font-bold">
                    {r.balanceDue < 0
                      ? <span className="text-red-600">{fmt.currency(Math.abs(r.balanceDue))} <span className="text-xs font-normal">(Advance Recd)</span></span>
                      : <span className="text-green-600">{fmt.currency(r.balanceDue)}</span>
                    }
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-gray-50 border-t-2 border-gray-300">
              <tr>
                <td className="px-4 py-3 font-bold text-gray-800">Net Total</td>
                <td className="px-4 py-3 font-bold text-right">
                  {totalOutstanding < 0
                    ? <span className="text-red-700">{fmt.currency(Math.abs(totalOutstanding))} <span className="text-xs font-normal">(Net Advance Recd)</span></span>
                    : <span className="text-green-700">{fmt.currency(totalOutstanding)}</span>
                  }
                </td>
              </tr>
            </tfoot>
          </table>
        )}
      </div>
    </div>
  );
}
