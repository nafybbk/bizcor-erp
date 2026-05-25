import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { api, fmt } from "@/lib/api";
import { Trash2, RotateCcw, ArrowLeft, Loader2, AlertTriangle, X } from "lucide-react";
import { useLang } from "@/lib/langHook";
import { t } from "@/lib/lang";

interface BinItem {
  id: number;
  docType: "voucher" | "payment";
  typeLabel: string;
  typeColor: string;
  docNumber: string;
  date: string;
  partyName: string | null;
  amount: number;
  deletedAt: string | null;
}

const VOUCHER_LABEL: Record<string, string> = {
  sales_invoice: "Sales Invoice",
  credit_note: "Credit Note",
  purchase_bill: "Purchase Bill",
  debit_note: "Debit Note",
};
const VOUCHER_COLOR: Record<string, string> = {
  sales_invoice: "bg-blue-100 text-blue-700",
  credit_note: "bg-purple-100 text-purple-700",
  purchase_bill: "bg-orange-100 text-orange-700",
  debit_note: "bg-red-100 text-red-700",
};

export default function VoucherBin() {
  const lang = useLang();
  const [, navigate] = useLocation();
  const [items, setItems] = useState<BinItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [restoring, setRestoring] = useState<string | null>(null);
  const [confirmDel, setConfirmDel] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const [vouchersRaw, paymentsRaw] = await Promise.all([
        api.get<any[]>("/bin").catch(() => []),
        api.get<any[]>("/payments/bin").catch(() => []),
      ]);

      const voucherItems: BinItem[] = (Array.isArray(vouchersRaw) ? vouchersRaw : []).map(v => ({
        id: v.id,
        docType: "voucher",
        typeLabel: VOUCHER_LABEL[v.voucherType] || v.voucherType,
        typeColor: VOUCHER_COLOR[v.voucherType] || "bg-gray-100 text-gray-700",
        docNumber: v.voucherNumber,
        date: v.date,
        partyName: v.partyName,
        amount: Number(v.grandTotal || 0),
        deletedAt: v.deletedAt,
      }));

      const paymentItems: BinItem[] = (Array.isArray(paymentsRaw) ? paymentsRaw : []).map(p => ({
        id: p.id,
        docType: "payment",
        typeLabel: p.type === "receipt" ? "Receipt" : "Payment",
        typeColor: p.type === "receipt" ? "bg-green-100 text-green-700" : "bg-teal-100 text-teal-700",
        docNumber: p.paymentNumber,
        date: p.date,
        partyName: p.partyName,
        amount: Number(p.amount || 0),
        deletedAt: p.deletedAt,
      }));

      const all = [...voucherItems, ...paymentItems].sort((a, b) => {
        if (!a.deletedAt) return 1;
        if (!b.deletedAt) return -1;
        return new Date(b.deletedAt).getTime() - new Date(a.deletedAt).getTime();
      });
      setItems(all);
    } catch (e: any) {
      setError(e.message || "Failed to load");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const key = (item: BinItem) => `${item.docType}-${item.id}`;

  const restore = async (item: BinItem) => {
    const k = key(item);
    setRestoring(k);
    setError("");
    try {
      if (item.docType === "voucher") {
        await api.post(`/bin/${item.id}/restore`, {});
      } else {
        await api.post(`/payments/bin/${item.id}/restore`, {});
      }
      setSuccess(item.docType === "payment"
        ? `${item.docNumber} restore ho gaya. Allocation dobara set karein.`
        : t("voucherRestored", lang));
      setItems(prev => prev.filter(v => key(v) !== k));
    } catch (e: any) {
      setError(e.message || "Failed");
    } finally {
      setRestoring(null);
    }
  };

  const permanentDelete = async (item: BinItem) => {
    const k = key(item);
    setDeleting(k);
    setError("");
    try {
      if (item.docType === "voucher") {
        await api.delete(`/bin/${item.id}`);
      } else {
        await api.delete(`/payments/bin/${item.id}`);
      }
      setSuccess(t("voucherPermanentlyDeleted", lang));
      setItems(prev => prev.filter(v => key(v) !== k));
      setConfirmDel(null);
    } catch (e: any) {
      setError(e.message || "Failed");
    } finally {
      setDeleting(null);
    }
  };

  return (
    <div className="max-w-4xl space-y-5">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate("/")} className="text-gray-400 hover:text-gray-600">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Trash2 className="w-6 h-6 text-red-500" />
              Deleted Documents (Bin)
            </h1>
            <p className="text-sm text-gray-500 mt-0.5">Restore karo ya permanently delete karo — Invoices, Bills, Receipts, Payments sab yahan</p>
          </div>
        </div>
        <button onClick={load} disabled={loading}
          className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
          Refresh
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          {error}
          <button onClick={() => setError("")} className="ml-auto"><X className="w-4 h-4" /></button>
        </div>
      )}
      {success && (
        <div className="bg-green-50 border border-green-200 text-green-700 text-sm px-4 py-3 rounded-lg flex items-center justify-between">
          {success}
          <button onClick={() => setSuccess("")}><X className="w-4 h-4" /></button>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
        </div>
      ) : items.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <Trash2 className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">Bin empty hai</p>
          <p className="text-sm text-gray-400 mt-1">Delete kiye gaye documents yahan aayenge</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 bg-red-50 border-b border-red-100 flex items-center gap-2 text-sm text-red-700">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            {items.length} deleted document{items.length > 1 ? "s" : ""} — Restore karo ya permanently delete karo
          </div>
          <div className="divide-y divide-gray-100">
            {items.map(item => {
              const k = key(item);
              return (
                <div key={k} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${item.typeColor}`}>
                        {item.typeLabel}
                      </span>
                      <span className="font-mono font-semibold text-gray-800">{item.docNumber}</span>
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                      <span>{item.partyName || "—"}</span>
                      <span>·</span>
                      <span>{fmt.date(item.date)}</span>
                      <span>·</span>
                      <span className="font-medium text-gray-700">{fmt.currency(item.amount)}</span>
                    </div>
                    <div className="text-xs text-red-400 mt-0.5">
                      Deleted: {item.deletedAt ? new Date(item.deletedAt).toLocaleString("en-IN") : "—"}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {confirmDel === k ? (
                      <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                        <span className="text-xs text-red-700 font-medium">Pakka delete?</span>
                        <button
                          onClick={() => permanentDelete(item)}
                          disabled={deleting === k}
                          className="text-xs bg-red-600 text-white px-2 py-1 rounded hover:bg-red-700 disabled:opacity-50 flex items-center gap-1">
                          {deleting === k ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
                          Haan
                        </button>
                        <button onClick={() => setConfirmDel(null)} className="text-xs text-gray-500 hover:text-gray-700">
                          Nahi
                        </button>
                      </div>
                    ) : (
                      <>
                        <button
                          onClick={() => restore(item)}
                          disabled={restoring === k}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-green-50 border border-green-200 text-green-700 text-sm rounded-lg hover:bg-green-100 disabled:opacity-50 transition-colors">
                          {restoring === k ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
                          Restore
                        </button>
                        <button
                          onClick={() => setConfirmDel(k)}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg hover:bg-red-100 transition-colors">
                          <Trash2 className="w-3.5 h-3.5" />
                          Delete
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
