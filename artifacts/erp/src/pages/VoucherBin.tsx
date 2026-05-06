import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Link } from "wouter";
import { Trash2, RotateCcw, AlertTriangle, Loader2, ArrowLeft, X } from "lucide-react";

const TYPE_LABEL: Record<string, string> = {
  sales_invoice: "Sales Invoice",
  credit_note: "Credit Note",
  purchase_bill: "Purchase Bill",
  debit_note: "Debit Note",
};

const TYPE_COLOR: Record<string, string> = {
  sales_invoice: "bg-blue-100 text-blue-700",
  credit_note: "bg-purple-100 text-purple-700",
  purchase_bill: "bg-orange-100 text-orange-700",
  debit_note: "bg-red-100 text-red-700",
};

function fmt(n: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(n);
}

export default function VoucherBin() {
  const [vouchers, setVouchers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [restoring, setRestoring] = useState<number | null>(null);
  const [deleting, setDeleting] = useState<number | null>(null);
  const [confirmDel, setConfirmDel] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const load = () => {
    setLoading(true);
    api.get<any[]>("/bin")
      .then(setVouchers)
      .catch(e => setError(e.message || "Load failed"))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const restore = async (id: number) => {
    setRestoring(id);
    setError(""); setSuccess("");
    try {
      await api.patch(`/bin/restore/${id}`, {});
      setSuccess("Voucher restore ho gaya!");
      setVouchers(v => v.filter(x => x.id !== id));
    } catch (e: any) {
      setError(e.message || "Restore failed");
    } finally { setRestoring(null); }
  };

  const permanentDelete = async (id: number) => {
    setDeleting(id);
    setConfirmDel(null);
    setError(""); setSuccess("");
    try {
      await api.delete(`/bin/delete/${id}`);
      setSuccess("Voucher permanently delete ho gaya.");
      setVouchers(v => v.filter(x => x.id !== id));
    } catch (e: any) {
      setError(e.message || "Delete failed");
    } finally { setDeleting(null); }
  };

  return (
    <div className="max-w-4xl space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/sales/invoices">
            <a className="p-2 rounded-lg hover:bg-gray-100 text-gray-500">
              <ArrowLeft className="w-5 h-5" />
            </a>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Trash2 className="w-6 h-6 text-red-500" />
              Deleted Documents (Bin)
            </h1>
            <p className="text-sm text-gray-500 mt-0.5">Delete kiye hue vouchers — restore ya permanently delete karo</p>
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
      ) : vouchers.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <Trash2 className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">Bin khali hai</p>
          <p className="text-sm text-gray-400 mt-1">Koi deleted document nahi hai</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 bg-red-50 border-b border-red-100 flex items-center gap-2 text-sm text-red-700">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            Bin mein {vouchers.length} document{vouchers.length !== 1 ? "s" : ""} hai. Restore karo wapas lane ke liye, ya permanently delete karo (undo nahi hoga).
          </div>
          <div className="divide-y divide-gray-100">
            {vouchers.map(v => (
              <div key={v.id} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${TYPE_COLOR[v.voucherType] || "bg-gray-100 text-gray-700"}`}>
                      {TYPE_LABEL[v.voucherType] || v.voucherType}
                    </span>
                    <span className="font-mono font-semibold text-gray-800">{v.voucherNumber}</span>
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                    <span>{v.partyName || "—"}</span>
                    <span>·</span>
                    <span>{v.date}</span>
                    <span>·</span>
                    <span className="font-medium text-gray-700">{fmt(v.grandTotal)}</span>
                  </div>
                  <div className="text-xs text-red-400 mt-0.5">
                    Deleted: {v.deletedAt ? new Date(v.deletedAt).toLocaleString("en-IN") : "—"}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {confirmDel === v.id ? (
                    <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                      <span className="text-xs text-red-700 font-medium">Permanently delete karo?</span>
                      <button
                        onClick={() => permanentDelete(v.id)}
                        disabled={deleting === v.id}
                        className="text-xs bg-red-600 text-white px-2 py-1 rounded hover:bg-red-700 disabled:opacity-50 flex items-center gap-1">
                        {deleting === v.id ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
                        Haan, Delete
                      </button>
                      <button onClick={() => setConfirmDel(null)} className="text-xs text-gray-500 hover:text-gray-700">
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <>
                      <button
                        onClick={() => restore(v.id)}
                        disabled={restoring === v.id}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-green-50 border border-green-200 text-green-700 text-sm rounded-lg hover:bg-green-100 disabled:opacity-50 transition-colors">
                        {restoring === v.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
                        Restore
                      </button>
                      <button
                        onClick={() => setConfirmDel(v.id)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg hover:bg-red-100 transition-colors">
                        <Trash2 className="w-3.5 h-3.5" />
                        Delete
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
