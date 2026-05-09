import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { api, fmt } from "@/lib/api";
import { Trash2, RotateCcw, ArrowLeft, Loader2, AlertTriangle, X } from "lucide-react";
import { useLang, t } from "@/lib/lang";

interface BinVoucher {
  id: number;
  voucherType: string;
  voucherNumber: string;
  date: string;
  partyName: string | null;
  grandTotal: number;
  deletedAt: string | null;
}

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

export default function VoucherBin() {
  const lang = useLang();
  const [, navigate] = useLocation();
  const [vouchers, setVouchers] = useState<BinVoucher[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [restoring, setRestoring] = useState<number | null>(null);
  const [confirmDel, setConfirmDel] = useState<number | null>(null);
  const [deleting, setDeleting] = useState<number | null>(null);

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await api.get<BinVoucher[]>("/vouchers/bin");
      setVouchers(Array.isArray(data) ? data : []);
    } catch (e: any) {
      setError(e.message || "Failed to load");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const restore = async (id: number) => {
    setRestoring(id); setError("");
    try {
      await api.post(`/vouchers/bin/${id}/restore`, {});
      setSuccess(t("voucherRestored", lang));
      setVouchers(prev => prev.filter(v => v.id !== id));
    } catch (e: any) { setError(e.message || "Failed"); }
    finally { setRestoring(null); }
  };

  const permanentDelete = async (id: number) => {
    setDeleting(id); setError("");
    try {
      await api.delete(`/vouchers/bin/${id}`);
      setSuccess(t("voucherPermanentlyDeleted", lang));
      setVouchers(prev => prev.filter(v => v.id !== id));
      setConfirmDel(null);
    } catch (e: any) { setError(e.message || "Failed"); }
    finally { setDeleting(null); }
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
            <p className="text-sm text-gray-500 mt-0.5">{t("binPageDesc", lang)}</p>
          </div>
        </div>
        <button onClick={load} disabled={loading}
          className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
          {t("refresh", lang)}
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
          <p className="text-gray-500 font-medium">{t("binEmpty", lang)}</p>
          <p className="text-sm text-gray-400 mt-1">{t("binEmptyDesc", lang)}</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 bg-red-50 border-b border-red-100 flex items-center gap-2 text-sm text-red-700">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            {vouchers.length} {t("binHasDocuments", lang)}
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
                    <span className="font-medium text-gray-700">{fmt.currency(v.grandTotal)}</span>
                  </div>
                  <div className="text-xs text-red-400 mt-0.5">
                    Deleted: {v.deletedAt ? new Date(v.deletedAt).toLocaleString("en-IN") : "—"}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {confirmDel === v.id ? (
                    <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                      <span className="text-xs text-red-700 font-medium">{t("permanentlyDeleteConfirm", lang)}</span>
                      <button
                        onClick={() => permanentDelete(v.id)}
                        disabled={deleting === v.id}
                        className="text-xs bg-red-600 text-white px-2 py-1 rounded hover:bg-red-700 disabled:opacity-50 flex items-center gap-1">
                        {deleting === v.id ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
                        {t("yesDelete", lang)}
                      </button>
                      <button onClick={() => setConfirmDel(null)} className="text-xs text-gray-500 hover:text-gray-700">
                        {t("cancel", lang)}
                      </button>
                    </div>
                  ) : (
                    <>
                      <button
                        onClick={() => restore(v.id)}
                        disabled={restoring === v.id}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-green-50 border border-green-200 text-green-700 text-sm rounded-lg hover:bg-green-100 disabled:opacity-50 transition-colors">
                        {restoring === v.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
                        {t("restore", lang)}
                      </button>
                      <button
                        onClick={() => setConfirmDel(v.id)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg hover:bg-red-100 transition-colors">
                        <Trash2 className="w-3.5 h-3.5" />
                        {t("delete", lang)}
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
