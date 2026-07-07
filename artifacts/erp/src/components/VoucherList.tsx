import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { api, fmt } from "@/lib/api";
import { downloadCSV } from "@/lib/export";
import { getVisibleCols, saveVisibleCols } from "@/lib/uiPrefs";
import ColumnCustomizer, { type ColDef } from "@/components/ColumnCustomizer";
import SortableTh from "@/components/SortableTh";
import { useSort } from "@/lib/useSort";
import { Plus, Search, Eye, Trash2, Loader2, Download, Printer, Pencil } from "lucide-react";
import { useAuth } from "@/lib/auth";

interface VoucherListProps {
  voucherType: "sales/invoices" | "sales/credit-notes" | "purchases/bills" | "purchases/debit-notes";
  title: string;
  createHref: string;
  viewHref: (id: number) => string;
  isIncome?: boolean;
}

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-600",
  posted: "bg-blue-100 text-blue-700",
  partial: "bg-amber-100 text-amber-700",
  paid: "bg-green-100 text-green-700",
  cancelled: "bg-red-100 text-red-600",
};

const ALL_COLS: ColDef[] = [
  { key: "number", label: "Voucher #", required: true },
  { key: "date", label: "Date" },
  { key: "party", label: "Party" },
  { key: "amount", label: "Amount" },
  { key: "paid", label: "Paid" },
  { key: "balance", label: "Balance" },
  { key: "status", label: "Status" },
  { key: "actions", label: "Actions", required: true },
];

const REPORT_KEY = "voucher_list";

export default function VoucherList({ voucherType, title, createHref, viewHref, isIncome = true }: VoucherListProps) {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const canEdit = user?.canEdit !== false;
  const canDelete = user?.canDelete !== false;
  const [vouchers, setVouchers] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [totalAmount, setTotalAmount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [visibleCols, setVisibleCols] = useState<string[]>(() =>
    getVisibleCols(REPORT_KEY, ALL_COLS.map(c => c.key))
  );
  const [limit, setLimit] = useState(20);

  const changeLimit = (n: number) => { setLimit(n); setPage(1); };

  const handleColChange = (cols: string[]) => {
    setVisibleCols(cols);
    saveVisibleCols(REPORT_KEY, cols);
  };

  const show = (key: string) => visibleCols.includes(key);

  const load = () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (status) params.set("status", status);
    if (fromDate) params.set("fromDate", fromDate);
    if (toDate) params.set("toDate", toDate);
    if (search) params.set("search", search);
    api.get<any>(`/${voucherType}?${params}`).then(r => {
      setVouchers(r.data);
      setTotal(r.total);
      setTotalAmount(r.totalAmount || 0);
    }).catch(console.error).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [page, status, fromDate, toDate, search]);

  const del = async (id: number) => {
    if (!confirm("Delete this record?")) return;
    try {
      await api.delete(`/${voucherType}/${id}`);
      load();
    } catch (err: any) {
      alert(err?.message || "Delete failed. Please try again.");
    }
  };

  const exportCSV = () => {
    const rows = vouchers.map(v => ({
      "Voucher No": v.voucherNumber,
      "Date": fmt.date(v.date),
      "Party": v.partyName,
      "GSTIN": v.partyGstin || "",
      "Amount": v.grandTotal,
      "Paid": v.paidAmount,
      "Balance": v.balanceDue,
      "Status": v.status,
    }));
    downloadCSV(rows, `${title.replace(/\s+/g, "_")}_${new Date().toISOString().slice(0, 10)}.csv`);
  };

  const { sorted, sortKey, sortDir, toggleSort } = useSort(vouchers);

  const { sorted, sortKey, sortDir, toggleSort } = useSort(filtered);

  const { sorted, sortKey, sortDir, toggleSort } = useSort(filtered);

  return (
    <div className="space-y-4 max-w-6xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
          <p className="text-sm text-gray-500 mt-0.5">{total} records · Total: {fmt.currency(totalAmount)}</p>
        </div>
        <div className="flex gap-2">
          <ColumnCustomizer cols={ALL_COLS} visible={visibleCols} onChange={handleColChange} />
          <button onClick={exportCSV} className="flex items-center gap-2 px-4 py-2 border border-green-300 text-green-700 bg-green-50 hover:bg-green-100 text-sm font-medium rounded-lg transition-colors">
            <Download className="w-4 h-4" /> Excel
          </button>
          <Link href={createHref}>
            <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors">
              <Plus className="w-4 h-4" />
              New {title.replace(/s$/, "")}
            </button>
          </Link>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-48">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} placeholder="Search by number or party..."
              className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <select value={status} onChange={e => setStatus(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">All Status</option>
            <option value="draft">Draft</option>
            <option value="posted">Posted</option>
            <option value="partial">Partial</option>
            <option value="paid">Paid</option>
            <option value="cancelled">Cancelled</option>
          </select>
          <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          <input type="date" value={toDate} onChange={e => setToDate(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          <div className="flex items-center gap-1 border border-gray-200 rounded-lg overflow-hidden text-sm">
            <span className="px-2 text-gray-400 text-xs">Show</span>
            {([20, 50, 9999] as const).map(n => (
              <button key={n} onClick={() => changeLimit(n)}
                className={`px-2.5 py-2 transition-colors ${limit === n ? "bg-blue-600 text-white" : "text-gray-600 hover:bg-gray-50"}`}>
                {n === 9999 ? "All" : n}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-48"><Loader2 className="w-5 h-5 animate-spin text-blue-500" /></div>
        ) : vouchers.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <div className="text-4xl mb-3">📄</div>
            <div className="font-medium">No records found</div>
            <div className="text-sm mt-1">Create your first {title.toLowerCase().replace(/s$/, "")} to get started</div>
          </div>
        ) : (
          <div className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-320px)]">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-600">
                <tr>
                  {show("number") && <SortableTh label="#" sortKey="voucherNumber" currentKey={sortKey} dir={sortDir} onSort={toggleSort} />}
                  {show("date") && <SortableTh label="Date" sortKey="date" currentKey={sortKey} dir={sortDir} onSort={toggleSort} />}
                  {show("party") && <SortableTh label="Party" sortKey="partyName" currentKey={sortKey} dir={sortDir} onSort={toggleSort} />}
                  {show("amount") && <SortableTh label="Amount" sortKey="grandTotal" currentKey={sortKey} dir={sortDir} onSort={toggleSort} align="right" />}
                  {show("paid") && <SortableTh label="Paid" sortKey="paidAmount" currentKey={sortKey} dir={sortDir} onSort={toggleSort} align="right" />}
                  {show("balance") && <SortableTh label="Balance" sortKey="balanceDue" currentKey={sortKey} dir={sortDir} onSort={toggleSort} align="right" />}
                  {show("status") && <SortableTh label="Status" sortKey="status" currentKey={sortKey} dir={sortDir} onSort={toggleSort} align="center" />}
                  {show("actions") && <th className="px-4 py-3"></th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {sorted.map(v => (
                  <tr key={v.id} className="hover:bg-gray-50 transition-colors">
                    {show("number") && <td className="px-4 py-3 font-mono text-blue-600 font-medium">{v.voucherNumber}</td>}
                    {show("date") && <td className="px-4 py-3 text-gray-600">{fmt.date(v.date)}</td>}
                    {show("party") && (
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900">{v.partyName}</div>
                        {v.partyGstin && <div className="text-xs text-gray-400 font-mono">{v.partyGstin}</div>}
                      </td>
                    )}
                    {show("amount") && <td className="px-4 py-3 text-right font-semibold text-gray-900">{fmt.currency(v.grandTotal)}</td>}
                    {show("paid") && <td className="px-4 py-3 text-right text-green-700">{fmt.currency(v.paidAmount)}</td>}
                    {show("balance") && <td className="px-4 py-3 text-right text-red-600 font-medium">{fmt.currency(v.balanceDue)}</td>}
                    {show("status") && (
                      <td className="px-4 py-3 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[v.status] || STATUS_COLORS.draft}`}>
                          {v.status}
                        </span>
                      </td>
                    )}
                    {show("actions") && (
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <Link href={viewHref(v.id)}>
                            <button title="View" className="p-1.5 text-blue-500 hover:bg-blue-50 rounded-lg transition-colors"><Eye className="w-4 h-4" /></button>
                          </Link>
                          {canEdit && (
                            <Link href={`${viewHref(v.id)}/edit`}>
                              <button title="Edit" className="p-1.5 text-orange-500 hover:bg-orange-50 rounded-lg transition-colors"><Pencil className="w-4 h-4" /></button>
                            </Link>
                          )}
                          <button
                            title="Print"
                            onClick={() => navigate(`${viewHref(v.id)}?print=1`)}
                            className="p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-800 rounded-lg transition-colors"
                          >
                            <Printer className="w-4 h-4" />
                          </button>
                          {canDelete && <button onClick={() => del(v.id)} title="Delete" className="p-1.5 text-red-400 hover:bg-red-50 rounded-lg transition-colors"><Trash2 className="w-4 h-4" /></button>}
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!loading && vouchers.length > 0 && (
          <div className="p-4 border-t border-gray-100 flex items-center justify-between text-sm text-gray-600">
            <span>{limit >= 9999 ? `${total} records` : `Showing ${(page - 1) * limit + 1}–${Math.min(page * limit, total)} of ${total}`}</span>
            {limit < 9999 && total > limit && (
              <div className="flex gap-2">
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="px-3 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40">Prev</button>
                <button onClick={() => setPage(p => p + 1)} disabled={page * limit >= total} className="px-3 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40">Next</button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
