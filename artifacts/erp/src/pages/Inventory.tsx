import { useEffect, useState } from "react";
import { Link } from "wouter";
import { api, fmt } from "@/lib/api";
import { Search, Loader2, TrendingDown, AlertTriangle } from "lucide-react";

export default function Inventory() {
  const [items, setItems] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [totalValue, setTotalValue] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const limit = 50;

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (search) params.set("search", search);
    api.get<any>(`/inventory/stock?${params}`)
      .then(r => { setItems(r.data); setTotal(r.total); setTotalValue(r.totalValue || 0); })
      .catch(console.error).finally(() => setLoading(false));
  }, [page, search]);

  return (
    <div className="max-w-6xl space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Inventory</h1>
          <p className="text-sm text-gray-500 mt-0.5">{total} items · Total Value: {fmt.currency(totalValue)}</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="p-4 border-b border-gray-100">
          <div className="relative max-w-sm">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search items..."
              className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-48"><Loader2 className="w-5 h-5 animate-spin text-blue-500" /></div>
        ) : items.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <div className="text-4xl mb-3">📦</div>
            <div className="font-medium">No inventory data</div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-600">
                <tr>
                  <th className="text-left px-4 py-3 font-medium">Item</th>
                  <th className="text-left px-4 py-3 font-medium">HSN</th>
                  <th className="text-left px-4 py-3 font-medium">Unit</th>
                  <th className="text-right px-4 py-3 font-medium">Opening</th>
                  <th className="text-right px-4 py-3 font-medium">Purchased</th>
                  <th className="text-right px-4 py-3 font-medium">Sold</th>
                  <th className="text-right px-4 py-3 font-medium">Current Stock</th>
                  <th className="text-right px-4 py-3 font-medium">Avg Rate</th>
                  <th className="text-right px-4 py-3 font-medium">Stock Value</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {items.map(item => (
                  <tr key={item.itemId} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">{item.itemName}</td>
                    <td className="px-4 py-3 text-gray-500 font-mono text-xs">{item.hsnCode || "-"}</td>
                    <td className="px-4 py-3 text-gray-500">{item.unit || "-"}</td>
                    <td className="px-4 py-3 text-right">{fmt.number(item.openingStock, 3)}</td>
                    <td className="px-4 py-3 text-right text-green-600">{fmt.number(item.inQuantity, 3)}</td>
                    <td className="px-4 py-3 text-right text-red-600">{fmt.number(item.outQuantity, 3)}</td>
                    <td className="px-4 py-3 text-right">
                      <span className={`font-bold ${item.currentStock <= 0 ? "text-red-600" : item.currentStock < 10 ? "text-amber-600" : "text-gray-900"}`}>
                        {fmt.number(item.currentStock, 3)}
                      </span>
                      {item.currentStock <= 0 && <AlertTriangle className="w-3 h-3 text-red-500 inline ml-1" />}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-600">{fmt.currency(item.avgRate)}</td>
                    <td className="px-4 py-3 text-right font-semibold text-gray-900">{fmt.currency(item.stockValue)}</td>
                    <td className="px-4 py-3">
                      <Link href={`/inventory/${item.itemId}`}>
                        <button className="text-xs text-blue-600 hover:underline">View Ledger</button>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {total > limit && (
          <div className="p-4 border-t border-gray-100 flex items-center justify-between text-sm text-gray-600">
            <span>Showing {(page - 1) * limit + 1}–{Math.min(page * limit, total)} of {total}</span>
            <div className="flex gap-2">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="px-3 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40">Prev</button>
              <button onClick={() => setPage(p => p + 1)} disabled={page * limit >= total} className="px-3 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40">Next</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
