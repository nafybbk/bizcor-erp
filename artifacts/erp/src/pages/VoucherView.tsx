import { useEffect, useState } from "react";
import { useLocation, useParams } from "wouter";
import { api, fmt } from "@/lib/api";
import { Loader2, ArrowLeft, Printer } from "lucide-react";

interface Props {
  voucherType: "sales/invoices" | "sales/credit-notes" | "purchases/bills" | "purchases/debit-notes";
  listHref: string;
}

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-600", posted: "bg-blue-100 text-blue-700",
  partial: "bg-amber-100 text-amber-700", paid: "bg-green-100 text-green-700",
  cancelled: "bg-red-100 text-red-600",
};

export default function VoucherView({ voucherType, listHref }: Props) {
  const params = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const [voucher, setVoucher] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<any>(`/${voucherType}/${params.id}`)
      .then(setVoucher)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [params.id]);

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-6 h-6 animate-spin text-blue-500" /></div>;
  if (!voucher) return <div className="text-center py-16 text-gray-400">Voucher not found</div>;

  const isInterState = voucher.isInterState;

  return (
    <div className="max-w-4xl space-y-4">
      <div className="flex items-center justify-between">
        <button onClick={() => navigate(listHref)} className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        <div className="flex gap-3">
          <button onClick={() => window.print()} className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50">
            <Printer className="w-4 h-4" /> Print
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-8 print:p-4 print:shadow-none">
        {/* Header */}
        <div className="flex justify-between items-start mb-8">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">{voucher.voucherNumber}</h2>
            <div className="flex items-center gap-3 mt-2">
              <span className="text-sm text-gray-500">Date: {fmt.date(voucher.date)}</span>
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[voucher.status]}`}>{voucher.status}</span>
            </div>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold text-blue-700">{fmt.currency(voucher.grandTotal)}</div>
            {voucher.balanceDue > 0 && <div className="text-sm text-red-500 mt-1">Balance Due: {fmt.currency(voucher.balanceDue)}</div>}
            {voucher.paidAmount > 0 && <div className="text-sm text-green-500 mt-0.5">Paid: {fmt.currency(voucher.paidAmount)}</div>}
          </div>
        </div>

        {/* Party */}
        <div className="grid grid-cols-2 gap-6 mb-8">
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Bill To</div>
            <div className="font-semibold text-gray-900 text-lg">{voucher.partyName}</div>
            {voucher.partyGstin && <div className="text-sm text-gray-500 font-mono mt-1">GSTIN: {voucher.partyGstin}</div>}
            {voucher.billingAddress && <div className="text-sm text-gray-600 mt-2 whitespace-pre-line">{voucher.billingAddress}</div>}
          </div>
          {voucher.useShippingAddress && voucher.shippingAddress && (
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Ship To</div>
              <div className="text-sm text-gray-600 whitespace-pre-line">{voucher.shippingAddress}</div>
            </div>
          )}
        </div>

        {/* Items */}
        <div className="overflow-x-auto mb-6">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr className="text-gray-600 text-xs">
                <th className="text-left px-3 py-2.5">#</th>
                <th className="text-left px-3 py-2.5">Item</th>
                <th className="text-left px-3 py-2.5">HSN</th>
                <th className="text-right px-3 py-2.5">Qty</th>
                <th className="text-left px-3 py-2.5">Unit</th>
                <th className="text-right px-3 py-2.5">Rate</th>
                <th className="text-right px-3 py-2.5">Discount</th>
                <th className="text-right px-3 py-2.5">Taxable</th>
                {isInterState
                  ? <th className="text-right px-3 py-2.5">IGST</th>
                  : <>
                    <th className="text-right px-3 py-2.5">CGST</th>
                    <th className="text-right px-3 py-2.5">SGST</th>
                  </>
                }
                <th className="text-right px-3 py-2.5">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {(voucher.items || []).map((item: any, idx: number) => (
                <tr key={idx} className="hover:bg-gray-50">
                  <td className="px-3 py-2.5 text-gray-500">{idx + 1}</td>
                  <td className="px-3 py-2.5">
                    <div className="font-medium text-gray-900">{item.itemName}</div>
                    {item.description && <div className="text-xs text-gray-400">{item.description}</div>}
                  </td>
                  <td className="px-3 py-2.5 text-gray-500 font-mono text-xs">{item.hsnCode}</td>
                  <td className="px-3 py-2.5 text-right">{fmt.number(item.quantity, 3)}</td>
                  <td className="px-3 py-2.5 text-gray-500">{item.unit}</td>
                  <td className="px-3 py-2.5 text-right">{fmt.number(item.rate)}</td>
                  <td className="px-3 py-2.5 text-right text-red-500">{item.discount > 0 ? `${fmt.number(item.discount)} ${item.discountType === "percent" ? "%" : "₹"}` : "-"}</td>
                  <td className="px-3 py-2.5 text-right">{fmt.number(item.taxableAmount)}</td>
                  {isInterState
                    ? <td className="px-3 py-2.5 text-right text-orange-600">{fmt.number(item.igst)}</td>
                    : <>
                      <td className="px-3 py-2.5 text-right text-blue-600">{fmt.number(item.cgst)}</td>
                      <td className="px-3 py-2.5 text-right text-blue-600">{fmt.number(item.sgst)}</td>
                    </>
                  }
                  <td className="px-3 py-2.5 text-right font-semibold">{fmt.number(item.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Summary */}
        <div className="flex justify-end">
          <div className="w-64 space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-gray-600">Taxable Amount</span><span>{fmt.currency(voucher.taxableAmount)}</span></div>
            {!isInterState && Number(voucher.totalCgst) > 0 && (
              <>
                <div className="flex justify-between text-blue-600"><span>CGST</span><span>{fmt.currency(voucher.totalCgst)}</span></div>
                <div className="flex justify-between text-blue-600"><span>SGST</span><span>{fmt.currency(voucher.totalSgst)}</span></div>
              </>
            )}
            {isInterState && Number(voucher.totalIgst) > 0 && (
              <div className="flex justify-between text-orange-600"><span>IGST</span><span>{fmt.currency(voucher.totalIgst)}</span></div>
            )}
            {Number(voucher.transportCharges) > 0 && (
              <div className="flex justify-between"><span className="text-gray-600">Transport</span><span>{fmt.currency(voucher.transportCharges)}</span></div>
            )}
            {Number(voucher.roundOff) !== 0 && (
              <div className="flex justify-between"><span className="text-gray-600">Round Off</span><span>{fmt.currency(voucher.roundOff)}</span></div>
            )}
            <div className="flex justify-between font-bold text-base border-t pt-2">
              <span>Grand Total</span><span className="text-blue-700">{fmt.currency(voucher.grandTotal)}</span>
            </div>
          </div>
        </div>

        {voucher.notes && (
          <div className="mt-6 pt-6 border-t">
            <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Notes</div>
            <div className="text-sm text-gray-600 whitespace-pre-line">{voucher.notes}</div>
          </div>
        )}
        {voucher.termsAndConditions && (
          <div className="mt-4">
            <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Terms & Conditions</div>
            <div className="text-sm text-gray-600 whitespace-pre-line">{voucher.termsAndConditions}</div>
          </div>
        )}
      </div>
    </div>
  );
}
