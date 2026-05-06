import { useEffect, useState } from "react";
import { api, fmt } from "@/lib/api";
import { downloadCSV } from "@/lib/export";
import { getVisibleCols, saveVisibleCols } from "@/lib/uiPrefs";
import ColumnCustomizer, { type ColDef } from "@/components/ColumnCustomizer";
import { Loader2, Download, Printer } from "lucide-react";

const ALL_COLS: ColDef[] = [
  { key: "account", label: "Account", required: true },
  { key: "type", label: "Type" },
  { key: "debit", label: "Debit (Dr)" },
  { key: "credit", label: "Credit (Cr)" },
];
const REPORT_KEY = "trial_balance";

export default function TrialBalance() {
  const [data, setData] = useState<any[]>([]);
  const [totals, setTotals] = useState({ totalDebit: 0, totalCredit: 0 });
  const [loading, setLoading] = useState(true);
  const [visibleCols, setVisibleCols] = useState<string[]>(() =>
    getVisibleCols(REPORT_KEY, ALL_COLS.map(c => c.key))
  );

  const handleColChange = (cols: string[]) => { setVisibleCols(cols); saveVisibleCols(REPORT_KEY, cols); };
  const show = (key: string) => visibleCols.includes(key);

  useEffect(() => {
    api.get<any>("/accounting/trial-balance")
      .then(r => { setData(r.entries); setTotals({ totalDebit: r.totalDebit, totalCredit: r.totalCredit }); })
      .catch(console.error).finally(() => setLoading(false));
  }, []);

  const exportCSV = () => {
    const rows = [
      ...data.map(e => ({
        "Account": e.accountName,
        "Type": e.accountType,
        "Debit (Dr)": e.debit > 0 ? e.debit : "",
        "Credit (Cr)": e.credit > 0 ? e.credit : "",
      })),
      { "Account": "TOTAL", "Type": "", "Debit (Dr)": totals.totalDebit, "Credit (Cr)": totals.totalCredit },
    ];
    downloadCSV(rows, `Trial_Balance_${new Date().toISOString().slice(0, 10)}.csv`);
  };

  return (
    <div className="max-w-3xl space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Trial Balance</h1>
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
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-48"><Loader2 className="w-5 h-5 animate-spin text-blue-500" /></div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                {show("account") && <th className="text-left px-4 py-3 font-medium">Account</th>}
                {show("type") && <th className="text-left px-4 py-3 font-medium">Type</th>}
                {show("debit") && <th className="text-right px-4 py-3 font-medium">Debit (Dr)</th>}
                {show("credit") && <th className="text-right px-4 py-3 font-medium">Credit (Cr)</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {data.map((e, i) => (
                <tr key={i} className="hover:bg-gray-50">
                  {show("account") && <td className="px-4 py-3 font-medium text-gray-900">{e.accountName}</td>}
                  {show("type") && <td className="px-4 py-3 text-gray-500 capitalize">{e.accountType}</td>}
                  {show("debit") && <td className="px-4 py-3 text-right text-blue-700">{e.debit > 0 ? fmt.currency(e.debit) : ""}</td>}
                  {show("credit") && <td className="px-4 py-3 text-right text-green-700">{e.credit > 0 ? fmt.currency(e.credit) : ""}</td>}
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-gray-50 border-t-2 border-gray-200">
              <tr>
                {show("account") && <td className="px-4 py-3 font-bold text-gray-700">Total</td>}
                {show("type") && <td className="px-4 py-3"></td>}
                {show("debit") && <td className="px-4 py-3 font-bold text-blue-700 text-right">{fmt.currency(totals.totalDebit)}</td>}
                {show("credit") && <td className="px-4 py-3 font-bold text-green-700 text-right">{fmt.currency(totals.totalCredit)}</td>}
              </tr>
            </tfoot>
          </table>
        )}
      </div>
    </div>
  );
}
