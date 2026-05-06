import { useEffect, useState } from "react";
import { api, fmt } from "@/lib/api";
import { downloadCSV } from "@/lib/export";
import { getVisibleCols, saveVisibleCols } from "@/lib/uiPrefs";
import ColumnCustomizer, { type ColDef } from "@/components/ColumnCustomizer";
import { Loader2, Download, Printer } from "lucide-react";

const ALL_COLS: ColDef[] = [
  { key: "party", label: "Party", required: true },
  { key: "total", label: "Total Invoiced" },
  { key: "received", label: "Received" },
  { key: "balance", label: "Balance Due", required: true },
];
const REPORT_KEY = "receivables";

export default function Receivables() {
  const [data, setData] = useState<any[]>([]);
  const [totalOutstanding, setTotalOutstanding] = useState(0);
  const [loading, setLoading] = useState(true);
  const [visibleCols, setVisibleCols] = useState<string[]>(() =>
    getVisibleCols(REPORT_KEY, ALL_COLS.map(c => c.key))
  );

  const handleColChange = (cols: string[]) => { setVisibleCols(cols); saveVisibleCols(REPORT_KEY, cols); };
  const show = (key: string) => visibleCols.includes(key);

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
        <div className="flex items-center gap-3 print:hidden">
          <ColumnCustomizer cols={ALL_COLS} visible={visibleCols} onChange={handleColChange} />
          <button onClick={exportCSV} disabled={loading || data.length === 0}
            className="flex items-center gap-2 px-4 py-2 border border-green-300 text-green-700 bg-green-50 hover:bg-green-100 text-sm font-medium rounded-lg transition-colors disabled:opacity-40">
            <Download className="w-4 h-4" /> Excel
          </button>
          <button onClick={() => window.print()} disabled={loading || data.length === 0}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 bg-white hover:bg-gray-50 text-sm font-medium rounded-lg transition-colors disabled:opacity-40">
            <Printer className="w-4 h-4" /> Print
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
                {show("party") && <th className="text-left px-4 py-3 font-medium">Party</th>}
                {show("total") && <th className="text-right px-4 py-3 font-medium">Total Invoiced</th>}
                {show("received") && <th className="text-right px-4 py-3 font-medium">Received</th>}
                {show("balance") && <th className="text-right px-4 py-3 font-medium">Balance Due</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {data.map((r, i) => (
                <tr key={i} className="hover:bg-gray-50">
                  {show("party") && <td className="px-4 py-3 font-medium text-gray-900">{r.partyName}</td>}
                  {show("total") && <td className="px-4 py-3 text-right">{fmt.currency(r.totalAmount)}</td>}
                  {show("received") && <td className="px-4 py-3 text-right text-green-600">{fmt.currency(r.paidAmount)}</td>}
                  {show("balance") && <td className="px-4 py-3 text-right font-bold text-red-600">{fmt.currency(r.balanceDue)}</td>}
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-gray-50 border-t-2 border-gray-200">
              <tr>
                <td colSpan={visibleCols.length - 1} className="px-4 py-3 font-bold text-gray-700 text-right">Total Outstanding</td>
                {show("balance") && <td className="px-4 py-3 font-bold text-red-700 text-right">{fmt.currency(totalOutstanding)}</td>}
              </tr>
            </tfoot>
          </table>
        )}
      </div>
    </div>
  );
}
