import { useEffect, useState } from "react";
import { api, fmt } from "@/lib/api";
import { downloadCSV } from "@/lib/export";
import { Loader2, Download, FileJson } from "lucide-react";
import BusinessHeader from "@/components/BusinessHeader";

export default function GSTR1() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const load = () => {
    setLoading(true);
    api.get<any>(`/gst/gstr1?month=${month}&year=${year}`)
      .then(setData).catch(console.error).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [month, year]);

  const exportJSON = async () => {
    const res = await api.get<any>(`/gst/gstr1/export?month=${month}&year=${year}`);
    const blob = new Blob([JSON.stringify(res.data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = res.filename; a.click();
    URL.revokeObjectURL(url);
  };

  const exportExcel = () => {
    if (!data) return;
    const b2bRows = (data.b2b || []).map((b: any) => ({
      "Section": "B2B",
      "GSTIN": b.gstin,
      "Party": b.partyName,
      "Invoice No": b.invoiceNumber,
      "Date": fmt.date(b.invoiceDate),
      "Invoice Value": b.invoiceValue,
      "Taxable Value": b.taxableValue,
      "CGST": b.cgst,
      "SGST": b.sgst,
      "IGST": b.igst,
    }));
    const b2cRows = (data.b2c || []).map((b: any) => ({
      "Section": "B2C",
      "GSTIN": "",
      "Party": "",
      "Invoice No": b.invoiceNumber,
      "Date": fmt.date(b.invoiceDate),
      "Invoice Value": b.invoiceValue,
      "Taxable Value": b.taxableValue,
      "CGST": b.cgst,
      "SGST": b.sgst,
      "IGST": "",
    }));
    downloadCSV([...b2bRows, ...b2cRows], `GSTR1_${MONTHS[month - 1]}_${year}.csv`);
  };

  const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

  return (
    <div className="max-w-5xl space-y-5">
      <div className="print:block hidden">
        <BusinessHeader title="GSTR-1 Return" period={`${MONTHS[month - 1]} ${year}`} />
      </div>
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-gray-900">GSTR-1</h1>
        <div className="flex items-center gap-3 flex-wrap">
          <select className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={month} onChange={e => setMonth(Number(e.target.value))}>
            {MONTHS.map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
          </select>
          <select className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={year} onChange={e => setYear(Number(e.target.value))}>
            {[2023, 2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <button onClick={exportExcel} disabled={!data}
            className="flex items-center gap-2 px-4 py-2 border border-green-300 text-green-700 bg-green-50 hover:bg-green-100 text-sm font-medium rounded-lg transition-colors disabled:opacity-40">
            <Download className="w-4 h-4" /> Excel
          </button>
          <button onClick={exportJSON} className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors">
            <FileJson className="w-4 h-4" /> Export JSON
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48"><Loader2 className="w-5 h-5 animate-spin text-blue-500" /></div>
      ) : data && (
        <div className="space-y-4">
          {/* Summary */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: "Total Invoices", value: String(data.summary?.totalInvoices || 0), color: "blue" },
              { label: "Taxable Value", value: fmt.currency(data.summary?.totalTaxableValue), color: "gray" },
              { label: "Total GST", value: fmt.currency(data.summary?.totalTax), color: "orange" },
              { label: "CGST + SGST", value: fmt.currency((data.summary?.totalCgst || 0) + (data.summary?.totalSgst || 0)), color: "green" },
            ].map((c, i) => (
              <div key={i} className="bg-white rounded-xl border border-gray-200 p-4">
                <div className="text-xs text-gray-500 mb-1">{c.label}</div>
                <div className="text-lg font-bold text-gray-900">{c.value}</div>
              </div>
            ))}
          </div>

          {/* B2B Invoices */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
              <h3 className="font-semibold text-gray-800 text-sm">B2B Invoices ({data.b2b?.length || 0})</h3>
              <span className="text-xs text-gray-400">Registered GSTIN parties</span>
            </div>
            {(data.b2b?.length || 0) === 0 ? (
              <div className="text-center py-8 text-gray-400 text-sm">No B2B invoices</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-gray-600 text-xs">
                    <tr>
                      <th className="text-left px-4 py-2.5 font-medium">GSTIN</th>
                      <th className="text-left px-4 py-2.5 font-medium">Party</th>
                      <th className="text-left px-4 py-2.5 font-medium">Invoice #</th>
                      <th className="text-left px-4 py-2.5 font-medium">Date</th>
                      <th className="text-right px-4 py-2.5 font-medium">Value</th>
                      <th className="text-right px-4 py-2.5 font-medium">Taxable</th>
                      <th className="text-right px-4 py-2.5 font-medium">CGST</th>
                      <th className="text-right px-4 py-2.5 font-medium">SGST</th>
                      <th className="text-right px-4 py-2.5 font-medium">IGST</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {data.b2b.map((b: any, i: number) => (
                      <tr key={i} className="hover:bg-gray-50">
                        <td className="px-4 py-2.5 font-mono text-xs text-blue-600">{b.gstin}</td>
                        <td className="px-4 py-2.5">{b.partyName}</td>
                        <td className="px-4 py-2.5 font-mono text-xs">{b.invoiceNumber}</td>
                        <td className="px-4 py-2.5 text-gray-500">{fmt.date(b.invoiceDate)}</td>
                        <td className="px-4 py-2.5 text-right">{fmt.currency(b.invoiceValue)}</td>
                        <td className="px-4 py-2.5 text-right">{fmt.currency(b.taxableValue)}</td>
                        <td className="px-4 py-2.5 text-right text-blue-600">{fmt.currency(b.cgst)}</td>
                        <td className="px-4 py-2.5 text-right text-blue-600">{fmt.currency(b.sgst)}</td>
                        <td className="px-4 py-2.5 text-right text-orange-600">{fmt.currency(b.igst)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* B2C Invoices */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100">
              <h3 className="font-semibold text-gray-800 text-sm">B2C Invoices ({data.b2c?.length || 0})</h3>
            </div>
            {(data.b2c?.length || 0) === 0 ? (
              <div className="text-center py-8 text-gray-400 text-sm">No B2C invoices</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-gray-600 text-xs">
                    <tr>
                      <th className="text-left px-4 py-2.5 font-medium">Invoice #</th>
                      <th className="text-left px-4 py-2.5 font-medium">Date</th>
                      <th className="text-right px-4 py-2.5 font-medium">Value</th>
                      <th className="text-right px-4 py-2.5 font-medium">Taxable</th>
                      <th className="text-right px-4 py-2.5 font-medium">CGST</th>
                      <th className="text-right px-4 py-2.5 font-medium">SGST</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {data.b2c.map((b: any, i: number) => (
                      <tr key={i} className="hover:bg-gray-50">
                        <td className="px-4 py-2.5 font-mono text-xs">{b.invoiceNumber}</td>
                        <td className="px-4 py-2.5 text-gray-500">{fmt.date(b.invoiceDate)}</td>
                        <td className="px-4 py-2.5 text-right">{fmt.currency(b.invoiceValue)}</td>
                        <td className="px-4 py-2.5 text-right">{fmt.currency(b.taxableValue)}</td>
                        <td className="px-4 py-2.5 text-right text-blue-600">{fmt.currency(b.cgst)}</td>
                        <td className="px-4 py-2.5 text-right text-blue-600">{fmt.currency(b.sgst)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
