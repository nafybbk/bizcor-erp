import { useEffect, useState } from "react";
import { useRoute, useLocation } from "wouter";
import { api, fmt } from "@/lib/api";
import { ArrowLeft, Download } from "lucide-react";
import { downloadCSV } from "@/lib/export";

const VOUCHER_LABEL: Record<string, string> = {
  sales_invoice: "Sales Invoice",
  credit_note: "Credit Note",
  purchase_bill: "Purchase Bill",
  debit_note: "Debit Note",
};

interface Entry {
  date: string;
  voucherType: string;
  voucherNumber: string;
  partyName: string | null;
  inQuantity: number;
  outQuantity: number;
  balance: number;
  rate: number;
}

interface ItemStock {
  item: { name: string; hsnCode: string | null; unit?: string };
  openingStock: number;
  closingStock: number;
  entries: Entry[];
}

export default function ItemLedger() {
  const [, params] = useRoute("/inventory/:id");
  const [, navigate] = useLocation();
  const itemId = params?.id;

  const [data, setData] = useState<ItemStock | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const load = () => {
    if (!itemId) return;
    setLoading(true);
    const q = new URLSearchParams();
    if (fromDate) q.set("fromDate", fromDate);
    if (toDate) q.set("toDate", toDate);
    api.get<ItemStock>(`/inventory/stock/${itemId}?${q}`)
      .then(setData)
      .catch(e => setError(e.message || "Failed to load"))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [itemId]);

  const exportCSV = () => {
    if (!data) return;
    const rows = data.entries.map(e => ({
      Date: e.date,
      Voucher: e.voucherNumber,
      Type: VOUCHER_LABEL[e.voucherType] || e.voucherType,
      Party: e.partyName || "-",
      "In Qty": e.inQuantity || "",
      "Out Qty": e.outQuantity || "",
      Balance: e.balance,
      Rate: e.rate,
    }));
    downloadCSV(rows, `ItemLedger_${data.item.name}_${new Date().toISOString().slice(0, 10)}.csv`);
  };

  return (
    <div className="max-w-5xl space-y-4">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate("/inventory")} className="p-1.5 rounded-lg hover:bg-gray-100">
          <ArrowLeft className="w-5 h-5 text-gray-500" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {data ? data.item.name : "Item Ledger"}
          </h1>
          {data && (
            <p className="text-sm text-gray-500 mt-0.5">
              HSN: {data.item.hsnCode || "—"} · Opening: {fmt.number(data.openingStock, 3)} · Closing: {fmt.number(data.closingStock, 3)}
            </p>
          )}
        </div>
        <div className="ml-auto flex items-center gap-2">
          <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)}
            className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          <span className="text-gray-400 text-sm">to</span>
          <input type="date" value={toDate} onChange={e => setToDate(e.target.value)}
            className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          <button onClick={load} className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700">Filter</button>
          <button onClick={exportCSV} className="flex items-center gap-1.5 px-3 py-1.5 border border-green-300 text-green-700 bg-green-50 hover:bg-green-100 text-sm rounded-lg">
            <Download className="w-4 h-4" /> Excel
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-gray-400 text-sm">Loading...</div>
        ) : error ? (
          <div className="p-12 text-center text-red-500 text-sm">{error}</div>
        ) : !data || data.entries.length === 0 ? (
          <div className="p-12 text-center text-gray-400 text-sm">Koi movement nahi mili</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Date</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Voucher</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Type</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Party</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-green-600 uppercase">In</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-red-600 uppercase">Out</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Balance</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Rate</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              <tr className="bg-blue-50">
                <td className="px-4 py-2.5 text-gray-500 text-xs">—</td>
                <td className="px-4 py-2.5 font-medium text-gray-700" colSpan={3}>Opening Stock</td>
                <td className="px-4 py-2.5 text-right text-green-600 font-semibold">{fmt.number(data.openingStock, 3)}</td>
                <td className="px-4 py-2.5"></td>
                <td className="px-4 py-2.5 text-right font-semibold text-gray-900">{fmt.number(data.openingStock, 3)}</td>
                <td className="px-4 py-2.5"></td>
              </tr>
              {data.entries.map((e, i) => (
                <tr key={i} className="hover:bg-gray-50">
                  <td className="px-4 py-2.5 text-gray-600">{fmt.date(e.date)}</td>
                  <td className="px-4 py-2.5 font-medium text-blue-600">{e.voucherNumber}</td>
                  <td className="px-4 py-2.5">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                      e.voucherType === "sales_invoice" ? "bg-blue-100 text-blue-700" :
                      e.voucherType === "purchase_bill" ? "bg-orange-100 text-orange-700" :
                      e.voucherType === "credit_note" ? "bg-purple-100 text-purple-700" :
                      "bg-red-100 text-red-700"
                    }`}>
                      {VOUCHER_LABEL[e.voucherType] || e.voucherType}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-gray-700">{e.partyName || "—"}</td>
                  <td className="px-4 py-2.5 text-right text-green-600 font-medium">
                    {e.inQuantity > 0 ? fmt.number(e.inQuantity, 3) : ""}
                  </td>
                  <td className="px-4 py-2.5 text-right text-red-600 font-medium">
                    {e.outQuantity > 0 ? fmt.number(e.outQuantity, 3) : ""}
                  </td>
                  <td className={`px-4 py-2.5 text-right font-semibold ${e.balance < 0 ? "text-red-600" : "text-gray-900"}`}>
                    {fmt.number(e.balance, 3)}
                  </td>
                  <td className="px-4 py-2.5 text-right text-gray-600">{fmt.currency(e.rate)}</td>
                </tr>
              ))}
              <tr className="bg-gray-50 border-t-2 border-gray-200">
                <td className="px-4 py-2.5" colSpan={4}></td>
                <td className="px-4 py-2.5 text-right text-green-600 font-bold text-xs uppercase">Closing</td>
                <td className="px-4 py-2.5"></td>
                <td className={`px-4 py-2.5 text-right font-bold ${data.closingStock < 0 ? "text-red-600" : "text-gray-900"}`}>
                  {fmt.number(data.closingStock, 3)}
                </td>
                <td className="px-4 py-2.5"></td>
              </tr>
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
