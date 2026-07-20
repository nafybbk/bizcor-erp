import { useEffect, useState } from "react";
import { api, fmt } from "@/lib/api";
import { Loader2, X, ExternalLink } from "lucide-react";

const VOUCHER_FETCH_PATH: Record<string, string> = {
  sales_invoice: "/sales/invoices",
  credit_note: "/sales/credit-notes",
  purchase_bill: "/purchases/bills",
  debit_note: "/purchases/debit-notes",
};

const VOUCHER_FULL_PATH: Record<string, string> = {
  sales_invoice: "/sales/invoices",
  credit_note: "/sales/credit-notes",
  purchase_bill: "/purchases/bills",
  debit_note: "/purchases/debit-notes",
  receipt: "/payments/receipts",
  payment: "/payments/payments",
};

// Same-page popup for "what's actually on this document?" — no navigation, no
// new tab (which would reload the whole SPA shell), so closing it drops you
// right back into whatever ledger/list you were already looking at.
export default function VoucherQuickViewModal({
  voucherType, id, onClose,
}: { voucherType: string; id: number; onClose: () => void }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const isPayment = voucherType === "receipt" || voucherType === "payment";

  useEffect(() => {
    setLoading(true);
    setError("");
    const url = isPayment ? `/payments/${id}` : `${VOUCHER_FETCH_PATH[voucherType]}/${id}`;
    api.get<any>(url).then(setData).catch(() => setError("Document load nahi ho saka")).finally(() => setLoading(false));
  }, [voucherType, id]);

  const fullPath = VOUCHER_FULL_PATH[voucherType] ? `${VOUCHER_FULL_PATH[voucherType]}/${id}${isPayment ? "/edit" : ""}` : null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-3.5 border-b sticky top-0 bg-white rounded-t-2xl">
          <h2 className="text-base font-semibold text-gray-800 capitalize">{voucherType.replace(/_/g, " ")}</h2>
          <div className="flex items-center gap-1">
            {fullPath && (
              <a href={fullPath} target="_blank" rel="noopener noreferrer"
                title="Poora page naye tab mein kholein" className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg">
                <ExternalLink className="w-4 h-4" />
              </a>
            )}
            <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="p-5">
          {loading ? (
            <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-gray-400" /></div>
          ) : error ? (
            <div className="text-center py-10 text-sm text-red-500">{error}</div>
          ) : !data ? null : isPayment ? (
            <div className="space-y-3 text-sm">
              <Row label="No." value={data.paymentNumber} mono />
              <Row label="Date" value={fmt.date(data.date)} />
              <Row label="Party" value={data.partyName} />
              <Row label="Amount" value={fmt.currency(data.amount)} bold />
              <Row label="Mode" value={data.paymentMode} />
              {data.notes && <Row label="Notes" value={data.notes} />}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <Row label="No." value={data.voucherNumber} mono />
                <Row label="Date" value={fmt.date(data.date)} />
                <Row label="Party" value={data.partyName} />
                <Row label="Status" value={data.status} />
              </div>
              {Array.isArray(data.items) && data.items.length > 0 && (
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-50 text-gray-500">
                      <tr>
                        <th className="text-left px-2.5 py-1.5 font-medium">Item</th>
                        <th className="text-right px-2.5 py-1.5 font-medium">Qty</th>
                        <th className="text-right px-2.5 py-1.5 font-medium">Rate</th>
                        <th className="text-right px-2.5 py-1.5 font-medium">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.items.map((it: any, i: number) => (
                        <tr key={i} className="border-t border-gray-100">
                          <td className="px-2.5 py-1.5">{it.itemName}</td>
                          <td className="px-2.5 py-1.5 text-right">{fmt.number(it.quantity)}</td>
                          <td className="px-2.5 py-1.5 text-right">{fmt.number(it.rate)}</td>
                          <td className="px-2.5 py-1.5 text-right">{fmt.number(it.total)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <div className="space-y-1 text-sm ml-auto max-w-[220px]">
                <Row label="Taxable" value={fmt.currency(data.taxableAmount)} />
                <Row label="Tax" value={fmt.currency(data.totalTax)} />
                <Row label="Grand Total" value={fmt.currency(data.grandTotal)} bold />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, bold, mono }: { label: string; value: any; bold?: boolean; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-gray-400">{label}</span>
      <span className={`${bold ? "font-semibold text-gray-900" : "text-gray-700"} ${mono ? "font-mono" : ""}`}>{value ?? "—"}</span>
    </div>
  );
}
