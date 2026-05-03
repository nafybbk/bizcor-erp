import { useEffect, useState } from "react";
import { api, fmt } from "@/lib/api";
import { Loader2 } from "lucide-react";
import BusinessHeader from "@/components/BusinessHeader";

export default function GSTR3B() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const load = () => {
    setLoading(true);
    api.get<any>(`/gst/gstr3b?month=${month}&year=${year}`)
      .then(setData).catch(console.error).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [month, year]);

  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

  const Section = ({ title, sub, data: d }: { title: string; sub?: string; data: any }) => (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <h3 className="font-semibold text-gray-800 mb-1">{title}</h3>
      {sub && <p className="text-xs text-gray-400 mb-4">{sub}</p>}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
        {[
          { label: "Taxable Value", value: d?.taxableValue || d?.total || 0 },
          { label: "CGST", value: d?.cgst || 0 },
          { label: "SGST/UTGST", value: d?.sgst || 0 },
          { label: "IGST", value: d?.igst || 0 },
        ].map((f, i) => (
          <div key={i}>
            <div className="text-xs text-gray-500 mb-1">{f.label}</div>
            <div className="font-semibold text-gray-900">{fmt.currency(f.value)}</div>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="max-w-4xl space-y-5">
      <div className="print:block hidden">
        <BusinessHeader title="GSTR-3B Return" period={`${months[month - 1]} ${year}`} />
      </div>
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-gray-900">GSTR-3B</h1>
        <div className="flex items-center gap-3">
          <select className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={month} onChange={e => setMonth(Number(e.target.value))}>
            {months.map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
          </select>
          <select className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={year} onChange={e => setYear(Number(e.target.value))}>
            {[2023, 2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48"><Loader2 className="w-5 h-5 animate-spin text-blue-500" /></div>
      ) : data && (
        <div className="space-y-4">
          <Section title="3.1 — Outward Supplies (Sales)" sub="Total taxable outward supplies" data={data.outwardSupplies} />
          <Section title="4 — Eligible Input Tax Credit (ITC)" sub="ITC on inward supplies (purchases)" data={data.inputTaxCredit} />

          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="font-semibold text-gray-800 mb-4">5 — Tax Payable (Net GST)</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              {[
                { label: "CGST Payable", value: data.taxPayable?.cgst || 0, color: "text-blue-700" },
                { label: "SGST Payable", value: data.taxPayable?.sgst || 0, color: "text-blue-700" },
                { label: "IGST Payable", value: data.taxPayable?.igst || 0, color: "text-orange-700" },
                { label: "Total Net Payable", value: data.taxPayable?.total || 0, color: "text-red-700" },
              ].map((f, i) => (
                <div key={i} className={i === 3 ? "bg-red-50 rounded-lg p-3 border border-red-200" : ""}>
                  <div className="text-xs text-gray-500 mb-1">{f.label}</div>
                  <div className={`font-bold text-lg ${f.color}`}>{fmt.currency(f.value)}</div>
                </div>
              ))}
            </div>
            <p className="text-xs text-gray-400 mt-4">* Net payable = Output GST − Input Tax Credit. Negative means excess ITC (refundable/carry-forward).</p>
          </div>
        </div>
      )}
    </div>
  );
}
