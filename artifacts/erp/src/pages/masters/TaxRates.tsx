import { useEffect, useState } from "react";
import { api, fmt } from "@/lib/api";
import { Plus, Loader2 } from "lucide-react";

export default function TaxRates() {
  const [rates, setRates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [rate, setRate] = useState("");
  const [saving, setSaving] = useState(false);

  const load = () => {
    setLoading(true);
    api.get<any>("/masters/tax-rates").then(r => setRates(r.data)).catch(console.error).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    await api.post("/masters/tax-rates", { name, rate: Number(rate) });
    setName(""); setRate(""); setSaving(false); load();
  };

  return (
    <div className="max-w-xl space-y-4">
      <h1 className="text-2xl font-bold text-gray-900">GST Tax Rates</h1>

      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="font-semibold text-gray-800 mb-4 text-sm">Add New Tax Rate</h3>
        <form onSubmit={save} className="flex gap-3">
          <input value={name} onChange={e => setName(e.target.value)} placeholder="Name (e.g. GST 18%)"
            className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" required />
          <input type="number" value={rate} onChange={e => setRate(e.target.value)} placeholder="Rate (%)" min="0" max="100"
            className="w-24 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" required />
          <button type="submit" disabled={saving} className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg disabled:opacity-60">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Add
          </button>
        </form>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-32"><Loader2 className="w-5 h-5 animate-spin text-blue-500" /></div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="text-left px-4 py-3 font-medium">Name</th>
                <th className="text-right px-4 py-3 font-medium">Rate</th>
                <th className="text-right px-4 py-3 font-medium">CGST</th>
                <th className="text-right px-4 py-3 font-medium">SGST</th>
                <th className="text-right px-4 py-3 font-medium">IGST</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {rates.map(r => (
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{r.name}</td>
                  <td className="px-4 py-3 text-right font-bold text-blue-700">{r.rate}%</td>
                  <td className="px-4 py-3 text-right text-gray-500">{fmt.number(r.cgst, 1)}%</td>
                  <td className="px-4 py-3 text-right text-gray-500">{fmt.number(r.sgst, 1)}%</td>
                  <td className="px-4 py-3 text-right text-gray-500">{fmt.number(r.igst, 1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
