import { useEffect, useState } from "react";
import { Link } from "wouter";
import { api, fmt } from "@/lib/api";
import { downloadCSV } from "@/lib/export";
import { Plus, Search, Loader2, Trash2, Eye, Download, Pencil } from "lucide-react";
import { useAuth } from "@/lib/auth";
import SortableTh from "@/components/SortableTh";
import { useSort } from "@/lib/useSort";

interface Props { type: "receipt" | "payment" }

export default function PaymentsList({ type }: Props) {
  const { user } = useAuth();
  const canEdit = user?.canEdit !== false;
  const canDelete = user?.canDelete !== false;
  const [payments, setPayments] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [totalAmount, setTotalAmount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const limit = 20;

  const load = () => {
    setLoading(true);
    const params = new URLSearchParams({ type, page: String(page), limit: String(limit) });
    if (search) params.set("search", search);
    api.get<any>(`/payments?${params}`)
      .then(r => { setPayments(r.data); setTotal(r.total); setTotalAmount(r.totalAmount || 0); })
      .catch(console.error).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [page, type, search]);

  const del = async (id: number) => {
    if (!confirm("Delete payment?")) return;
    try {
      await api.delete(`/payments/${id}`);
      load();
    } catch (err: any) {
      alert(err?.message || "Delete nahi ho saka. Dobara try karein.");
    }
  };

  const { sorted, sortKey, sortDir, toggleSort } = useSort(payments);

  const exportCSV = () => {
    const rows = payments.map(p => ({
      "Payment No": p.paymentNumber,
      "Date": fmt.date(p.date),
      "Party": p.partyName,
      "Mode": p.paymentMode,
      "Amount": p.amount,
      "Type": p.isOnAccount ? "On Account" : "Bill-wise",
      "Reference": p.reference || "",
    }));
    downloadCSV(rows, `${type === "receipt" ? "Receipts" : "Payments"}_${new Date().toISOString().slice(0, 10)}.csv`);
  };

  const title = type === "receipt" ? "Receipts" : "Payments";

  return (
    <div className="max-w-5xl space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
          <p className="text-sm text-gray-500 mt-0.5">{total} records · Total: {fmt.currency(totalAmount)}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={exportCSV} className="flex items-center gap-2 px-4 py-2 border border-green-300 text-green-700 bg-green-50 hover:bg-green-100 text-sm font-medium rounded-lg transition-colors">
            <Download className="w-4 h-4" /> Excel
          </button>
          <Link href={`/payments/${type === "receipt" ? "receipts" : "payments"}/new`}>
            <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg">
              <Plus className="w-4 h-4" /> New {type === "receipt" ? "Receipt" : "Payment"}
            </button>
          </Link>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="p-4 border-b border-gray-100">
          <div className="relative max-w-sm">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} placeholder="Search..."
              className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-48"><Loader2 className="w-5 h-5 animate-spin text-blue-500" /></div>
        ) : payments.length === 0 ? (
          <div className="text-center py-16 text-gray-400">No {title.toLowerCase()} found</div>
        ) : (
          <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[600px]">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <SortableTh label="#" sortKey="paymentNumber" currentKey={sortKey} dir={sortDir} onSort={toggleSort} />
                <SortableTh label="Date" sortKey="date" currentKey={sortKey} dir={sortDir} onSort={toggleSort} />
                <SortableTh label="Party" sortKey="partyName" currentKey={sortKey} dir={sortDir} onSort={toggleSort} />
                <SortableTh label="Mode" sortKey="paymentMode" currentKey={sortKey} dir={sortDir} onSort={toggleSort} />
                <SortableTh label="Amount" sortKey="amount" currentKey={sortKey} dir={sortDir} onSort={toggleSort} align="right" />
                <SortableTh label="Type" sortKey="isOnAccount" currentKey={sortKey} dir={sortDir} onSort={toggleSort} />
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {sorted.map(p => (
                <tr key={p.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-blue-600 font-medium">{p.paymentNumber}</td>
                  <td className="px-4 py-3 text-gray-600">{fmt.date(p.date)}</td>
                  <td className="px-4 py-3 font-medium text-gray-900">{p.partyName}</td>
                  <td className="px-4 py-3 text-gray-500 capitalize">{p.paymentMode}</td>
                  <td className="px-4 py-3 text-right font-semibold text-gray-900">{fmt.currency(p.amount)}</td>
                  <td className="px-4 py-3">
                    {p.isOnAccount
                      ? <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">On Account</span>
                      : <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">Bill-wise</span>
                    }
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      {canEdit && (
                        <Link href={`/payments/${type === "receipt" ? "receipts" : "payments"}/${p.id}/edit`}>
                          <button title="Edit" className="p-1.5 text-orange-500 hover:bg-orange-50 rounded-lg"><Pencil className="w-4 h-4" /></button>
                        </Link>
                      )}
                      {canDelete && <button onClick={() => del(p.id)} title="Delete" className="p-1.5 text-red-400 hover:bg-red-50 rounded-lg"><Trash2 className="w-4 h-4" /></button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}

        {!loading && payments.length > 0 && (
          <div className="p-4 border-t border-gray-100 flex items-center justify-between text-sm text-gray-600">
            <span>{total} {total === 1 ? "record" : "records"}</span>
            {total > limit && (
              <div className="flex gap-2">
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="px-3 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40">Prev</button>
                <span className="px-2 py-1.5">Page {page} of {Math.ceil(total / limit)}</span>
                <button onClick={() => setPage(p => p + 1)} disabled={page * limit >= total} className="px-3 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40">Next</button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
