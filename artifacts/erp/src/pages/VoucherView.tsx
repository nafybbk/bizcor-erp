import { useEffect, useState } from "react";
import { useLocation, useParams, useSearch } from "wouter";
import { api, fmt } from "@/lib/api";
import { shareWhatsApp } from "@/lib/export";
import { formatPrintNumber } from "@/lib/numberFormat";
import { Loader2, ArrowLeft, Share2, FileDown, Pencil, Trash2 } from "lucide-react";
import { useAuth } from "@/lib/auth";
import PrintPreviewModal from "@/components/PrintPreviewModal";

interface Props {
  voucherType: "sales/invoices" | "sales/credit-notes" | "purchases/bills" | "purchases/debit-notes";
  listHref: string;
}

const STATUS_LABELS: Record<string, string> = {
  draft: "DRAFT", posted: "POSTED", partial: "PARTIAL", paid: "PAID", cancelled: "CANCELLED",
};
const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-600", posted: "bg-blue-100 text-blue-700",
  partial: "bg-amber-100 text-amber-700", paid: "bg-green-100 text-green-700",
  cancelled: "bg-red-100 text-red-600",
};

const DOC_TITLES: Record<string, string> = {
  "sales/invoices": "TAX INVOICE",
  "sales/credit-notes": "CREDIT NOTE",
  "purchases/bills": "PURCHASE BILL",
  "purchases/debit-notes": "DEBIT NOTE",
};

// Convert number to words (Indian system)
function toWords(n: number): string {
  if (isNaN(n) || n < 0) return "";
  const ones = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
    "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
  const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
  const convert = (num: number): string => {
    if (num === 0) return "";
    if (num < 20) return ones[num] + " ";
    if (num < 100) return tens[Math.floor(num / 10)] + " " + ones[num % 10] + " ";
    if (num < 1000) return ones[Math.floor(num / 100)] + " Hundred " + convert(num % 100);
    if (num < 100000) return convert(Math.floor(num / 1000)) + "Thousand " + convert(num % 1000);
    if (num < 10000000) return convert(Math.floor(num / 100000)) + "Lakh " + convert(num % 100000);
    return convert(Math.floor(num / 10000000)) + "Crore " + convert(num % 10000000);
  };
  const rupees = Math.floor(n);
  const paise = Math.round((n - rupees) * 100);
  let result = convert(rupees).trim();
  if (paise > 0) result += ` and ${convert(paise).trim()} Paise`;
  return "Rupees " + result + " Only";
}

export default function VoucherView({ voucherType, listHref }: Props) {
  const { user } = useAuth();
  const canEdit = user?.canEdit !== false;
  const canDelete = user?.canDelete !== false;
  const params = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const search = useSearch();
  const autoPrint = new URLSearchParams(search).get("print") === "1";
  const [voucher, setVoucher] = useState<any>(null);
  const [business, setBusiness] = useState<any>(null);
  const [printFooter, setPrintFooter] = useState<{ text: string; logo: string }>({ text: "", logo: "" });
  const [loading, setLoading] = useState(true);
  const [showPrintPreview, setShowPrintPreview] = useState(false);

  useEffect(() => {
    Promise.all([
      api.get<any>(`/${voucherType}/${params.id}`),
      api.get<any>("/businesses/current"),
      api.get<any>("/public-settings"),
    ]).then(([v, b, s]) => {
      setVoucher(v);
      setBusiness(b);
      setPrintFooter({ text: s.printFooterText || "", logo: s.printFooterLogo || "" });
    }).catch(console.error).finally(() => setLoading(false));
  }, [params.id]);

  // Auto-print when opened with ?print=1 (from list print button)
  useEffect(() => {
    if (autoPrint && !loading && voucher) {
      const t = setTimeout(() => setShowPrintPreview(true), 400);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [autoPrint, loading, voucher]);

  const handlePrint = () => setShowPrintPreview(true);

  const handleEdit = () => navigate(`/${voucherType}/${params.id}/edit`);

  const handleDelete = async () => {
    if (!confirm("Delete this voucher? This action cannot be undone.")) return;
    try {
      await api.delete(`/${voucherType}/${params.id}`);
      navigate(listHref);
    } catch (err: any) {
      alert(err.message || "Delete failed, please try again.");
    }
  };

  const handleWhatsApp = () => {
    if (!voucher) return;
    const text = [
      `*${voucher.voucherNumber}*`,
      `Party: ${voucher.partyName}`,
      `Date: ${fmt.date(voucher.date)}`,
      `Amount: ${fmt.currency(voucher.grandTotal)}`,
      voucher.balanceDue > 0 ? `Balance Due: ${fmt.currency(voucher.balanceDue)}` : `Status: Paid`,
      ``, `_Sent via BizERP_`,
    ].join("\n");
    shareWhatsApp(text);
  };

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-6 h-6 animate-spin text-blue-500" /></div>;
  if (!voucher) return <div className="text-center py-16 text-gray-400">Voucher not found</div>;

  const isInterState = voucher.isInterState;
  const docTitle = DOC_TITLES[voucherType] || "INVOICE";
  const biz = business || {};

  // ── helpers ──────────────────────────────────────────────────────────────
  const hasDiscount = (voucher.items || []).some((i: any) => Number(i.discount) > 0);
  const fmtQty = (q: number) => {
    const n = Number(q || 0);
    if (Number.isInteger(n)) return n.toString();
    return parseFloat(n.toFixed(3)).toString();
  };

  // Build full address
  const bizAddress = [biz.address, biz.city, biz.state, biz.pincode].filter(Boolean).join(", ");

  return (
    <>
      {showPrintPreview && (
        <PrintPreviewModal
          printableId="printable"
          title={`${DOC_TITLES[voucherType] || "Invoice"} — ${voucher?.voucherNumber || ""}`}
          onClose={() => setShowPrintPreview(false)}
          initialZoom={autoPrint ? 0.6 : undefined}
          shareText={voucher ? [
            `*${voucher.voucherNumber}*`,
            `Party: ${voucher.partyName}`,
            `Date: ${fmt.date(voucher.date)}`,
            `Amount: ${fmt.currency(voucher.grandTotal)}`,
            voucher.balanceDue > 0 ? `Balance Due: ${fmt.currency(voucher.balanceDue)}` : `Status: Paid`,
            ``, `_Sent via BizCor ERP_`,
          ].join("\n") : undefined}
        />
      )}
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          #printable, #printable * { visibility: visible !important; }
          #printable { position: fixed; inset: 0; padding: 0; background: white; overflow: auto; }
          .no-print { display: none !important; }
          .print-only { display: block !important; }
          .screen-only { display: none !important; }
          @page { margin: 10mm; size: A4; }
        }
        .print-only { display: none; }

          /* ── LASER PRINTER: Force black & white ── */
          /* All colored text → black */
          #printable [class*="text-blue"],
          #printable [class*="text-red"],
          #printable [class*="text-green"],
          #printable [class*="text-orange"],
          #printable [class*="text-amber"],
          #printable [class*="text-indigo"],
          #printable [class*="text-purple"],
          #printable [class*="text-pink"] { color: #000 !important; }

          /* All colored/tinted backgrounds → white */
          #printable [class*="bg-blue"],
          #printable [class*="bg-orange"],
          #printable [class*="bg-amber"],
          #printable [class*="bg-red"],
          #printable [class*="bg-green"],
          #printable [class*="bg-indigo"],
          #printable [class*="bg-purple"],
          #printable [class*="bg-gray-50"],
          #printable [class*="bg-gray-100"] { background-color: #fff !important; border: none !important; }

          /* All colored borders → light gray */
          #printable [class*="border-blue"],
          #printable [class*="border-orange"],
          #printable [class*="border-red"],
          #printable [class*="border-green"],
          #printable [class*="border-amber"] { border-color: #bbb !important; }

          /* Keep dark header & footer strip solid black */
          #printable .bg-gray-900 { background-color: #1a1a1a !important; print-color-adjust: exact; -webkit-print-color-adjust: exact; }
          #printable .bg-gray-900 * { color: #fff !important; }

          /* Alternating row color → white in print */
          #printable .bg-gray-50 { background-color: #f8f8f8 !important; }

          /* Keep strong structural borders black */
          #printable .border-gray-800,
          #printable .border-t-2,
          #printable .border-b-2 { border-color: #000 !important; }
        }
      `}</style>

      {/* Toolbar */}
      <div className="max-w-4xl space-y-4">
        <div className="flex items-center justify-between gap-2 no-print">
          <button onClick={() => navigate(listHref)} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 flex-shrink-0">
            <ArrowLeft className="w-4 h-4" /> <span>Back</span>
          </button>
          <div className="flex gap-1.5 flex-wrap justify-end">
            {canDelete && (
              <button onClick={handleDelete}
                className="flex items-center gap-1.5 px-3 py-2 border border-red-200 text-red-600 bg-red-50 hover:bg-red-100 rounded-lg text-sm font-medium">
                <Trash2 className="w-4 h-4" /> <span className="hidden sm:inline">Delete</span>
              </button>
            )}
            {canEdit && (
              <button onClick={handleEdit}
                className="flex items-center gap-1.5 px-3 py-2 border border-orange-300 text-orange-700 bg-orange-50 hover:bg-orange-100 rounded-lg text-sm font-medium">
                <Pencil className="w-4 h-4" /> <span className="hidden sm:inline">Edit</span>
              </button>
            )}
            <button onClick={handleWhatsApp}
              className="flex items-center gap-1.5 px-3 py-2 border border-green-300 text-green-700 bg-green-50 hover:bg-green-100 rounded-lg text-sm font-medium">
              <Share2 className="w-4 h-4" /> <span className="hidden sm:inline">WhatsApp</span>
            </button>
            <button onClick={handlePrint}
              className="flex items-center gap-1.5 px-3 py-2 border border-blue-300 text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg text-sm font-medium">
              <FileDown className="w-4 h-4" /> <span className="hidden sm:inline">PDF / Print</span>
            </button>
          </div>
        </div>

        {/* ===== PRINTABLE INVOICE ===== */}
        <div id="printable" className="bg-white rounded-xl border border-gray-200 overflow-hidden text-gray-900" style={{ fontFamily: "'Segoe UI', Arial, sans-serif" }}>

          {/* ---- TOP HEADER: Logo + Firm Name + Address ---- */}
          <div className="border-b-2 border-gray-800 px-4 sm:px-7 py-4 sm:py-5">
            {/* Mobile: stacked; Desktop: side by side */}
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">

              {/* Left: Logo + Firm Info */}
              <div className="flex items-start gap-3 flex-1 min-w-0">
                {biz.logo && (
                  <img src={biz.logo} alt="Logo" className="w-14 h-14 sm:w-20 sm:h-20 object-contain flex-shrink-0" />
                )}
                <div className="min-w-0">
                  <h1 className="text-lg sm:text-2xl font-extrabold text-gray-900 leading-tight">{biz.name || "Your Business Name"}</h1>
                  {bizAddress && <div className="text-xs sm:text-sm text-gray-600 mt-1">{bizAddress}</div>}
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1 text-xs text-gray-500">
                    {biz.phone && <span>📞 {biz.phone}</span>}
                    {biz.email && <span>✉ {biz.email}</span>}
                  </div>
                  {biz.gstin && (
                    <div className="mt-1 text-xs font-semibold text-gray-700">
                      GSTIN: <span className="font-mono tracking-wider">{biz.gstin}</span>
                    </div>
                  )}
                  {biz.pan && <div className="text-xs text-gray-500">PAN: {biz.pan}</div>}
                </div>
              </div>

              {/* Right: Document Title + Number — right-aligned on all screens */}
              <div className="flex flex-row sm:flex-col items-start sm:items-end justify-between sm:justify-start gap-2 sm:gap-0 flex-shrink-0">
                <div>
                  <div className="inline-block bg-gray-900 text-white px-3 py-1 rounded text-xs sm:text-sm font-bold tracking-widest mb-1">
                    {docTitle}
                  </div>
                  <div className="text-xs text-gray-500 text-right mb-1">ORIGINAL FOR RECIPIENT</div>
                  {/* Screen: full number */}
                  <div className="screen-only text-base sm:text-xl font-bold text-gray-900 sm:text-right">{voucher.voucherNumber}</div>
                  {/* Print: formatted */}
                  <div className="print-only text-base sm:text-xl font-bold text-gray-900 sm:text-right">{formatPrintNumber(voucher.voucherNumber, biz)}</div>
                </div>
                <div className="text-right">
                  <div className="text-xs sm:text-sm text-gray-500">Date: <span className="font-medium text-gray-800">{fmt.date(voucher.date)}</span></div>
                  {voucher.placeOfSupply && (
                    <div className="text-xs text-gray-500 mt-0.5">Place: <span className="text-gray-700">{voucher.placeOfSupply}</span></div>
                  )}
                  {voucher.linkedVoucherNumber && (
                    <div className="mt-1.5 px-2 py-1 bg-amber-50 border border-amber-200 rounded text-xs text-left">
                      <span className="text-amber-600 font-semibold">
                        {voucherType === "sales/credit-notes" ? "Against Invoice:" : "Against Bill:"}
                      </span>
                      <span className="font-mono font-bold text-amber-900 ml-1">{voucher.linkedVoucherNumber}</span>
                    </div>
                  )}
                  <div className="mt-1.5">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_COLORS[voucher.status]}`}>
                      {STATUS_LABELS[voucher.status] || voucher.status?.toUpperCase()}
                    </span>
                  </div>
                </div>
              </div>

            </div>
          </div>

          {/* ---- BILLING INFO ---- */}
          <div className="grid grid-cols-2 border-b border-gray-200">
            <div className="px-7 py-4 border-r border-gray-200">
              <div className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Bill To</div>
              <div className="font-bold text-gray-900 text-base">{voucher.partyName}</div>
              {voucher.partyGstin && (
                <div className="text-xs font-mono text-gray-500 mt-1">GSTIN: {voucher.partyGstin}</div>
              )}
              {voucher.billingAddress && (
                <div className="text-sm text-gray-600 mt-1.5 whitespace-pre-line">{voucher.billingAddress}</div>
              )}
            </div>
            <div className="px-7 py-4">
              {voucher.useShippingAddress && voucher.shippingAddress ? (
                <>
                  <div className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Ship To</div>
                  <div className="text-sm text-gray-600 whitespace-pre-line">{voucher.shippingAddress}</div>
                </>
              ) : (
                <div className="h-full flex flex-col justify-center">
                  {/* GST type badge */}
                  <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-semibold self-start ${isInterState ? "bg-orange-50 text-orange-700 border border-orange-200" : "bg-blue-50 text-blue-700 border border-blue-200"}`}>
                    {isInterState ? "⚡ IGST (Inter-State)" : "✓ CGST + SGST (Intra-State)"}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ---- ITEMS TABLE ---- */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-900 text-white text-xs">
                  <th className="px-2 py-2 text-center w-7">#</th>
                  <th className="px-2 py-2 text-left">Item / Description</th>
                  <th className="px-2 py-2 text-center w-14">HSN</th>
                  <th className="px-2 py-2 text-center w-10">Unit</th>
                  <th className="px-2 py-2 text-right w-14">Qty</th>
                  <th className="px-2 py-2 text-right w-18">Rate</th>
                  {hasDiscount && <th className="px-2 py-2 text-right w-14">Disc</th>}
                  <th className="px-2 py-2 text-right w-18">Rate<br/><span className="font-normal opacity-75 text-gray-300">+GST</span></th>
                  <th className="px-2 py-2 text-right w-20">Taxable</th>
                  <th className="px-2 py-2 text-right w-20">GST</th>
                  <th className="px-2 py-2 text-right w-20">Total</th>
                </tr>
              </thead>
              <tbody>
                {(voucher.items || []).map((item: any, idx: number) => {
                  const taxablePerUnit = item.quantity > 0 ? item.taxableAmount / item.quantity : 0;
                  const rateAfterGst = taxablePerUnit * (1 + (item.taxRate || 0) / 100);
                  return (
                  <tr key={idx} className={idx % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                    <td className="px-2 py-2 text-center text-gray-500 text-xs">{idx + 1}</td>
                    <td className="px-2 py-2">
                      <div className="font-semibold text-gray-900 text-sm">{item.itemName}</div>
                      {item.description && <div className="text-xs text-gray-500 mt-0.5">{item.description}</div>}
                      {item.customFields && Object.keys(item.customFields).length > 0 && (
                        <div className="flex flex-wrap gap-x-3 gap-y-0 mt-1">
                          {Object.entries(item.customFields).filter(([, v]) => v).map(([k, v]) => (
                            <span key={k} className="text-xs text-gray-500">
                              <span className="font-medium capitalize">{k.replace(/([A-Z])/g, ' $1').trim()}:</span> {String(v)}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="px-2 py-2 text-center text-xs text-gray-500 font-mono">{item.hsnCode || "-"}</td>
                    <td className="px-2 py-2 text-center text-gray-500 text-xs">{item.unit}</td>
                    <td className="px-2 py-2 text-right">{fmtQty(item.quantity)}</td>
                    <td className="px-2 py-2 text-right">{fmt.number(item.rate)}</td>
                    {hasDiscount && (
                      <td className="px-2 py-2 text-right text-red-500 text-xs">
                        {item.discount > 0 ? `${fmtQty(item.discount)}${item.discountType === "percent" ? "%" : ""}` : "-"}
                      </td>
                    )}
                    <td className="px-2 py-2 text-right text-gray-700">{fmt.number(rateAfterGst)}</td>
                    <td className="px-2 py-2 text-right">{fmt.number(item.taxableAmount)}</td>
                    <td className="px-2 py-2 text-right text-blue-600">
                      <div className="text-xs text-gray-400">{item.taxRate}%</div>
                      {fmt.number(isInterState ? item.igst : (Number(item.sgst || 0) + Number(item.cgst || 0)))}
                    </td>
                    <td className="px-2 py-2 text-right font-bold">{fmt.number(item.total)}</td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* ---- TOTAL QTY ROW ---- */}
          {(() => {
            const totalQty = (voucher.items || []).reduce((s: number, i: any) => s + Number(i.quantity || 0), 0);
            const totalItems = (voucher.items || []).length;
            return (
              <div className="border-t border-gray-200 px-4 py-2 bg-gray-50 text-xs text-gray-600 flex gap-6">
                <span>Total Items: <strong>{totalItems}</strong></span>
                <span>Total Qty: <strong>{fmtQty(totalQty)}</strong></span>
              </div>
            );
          })()}

          {/* ---- HSN SUMMARY TABLE ---- */}
          {(() => {
            const hsnMap: Record<string, { taxableValue: number; igst: number; cgst: number; sgst: number; rate: number }> = {};
            (voucher.items || []).forEach((item: any) => {
              const hsn = item.hsnCode || "—";
              if (!hsnMap[hsn]) hsnMap[hsn] = { taxableValue: 0, igst: 0, cgst: 0, sgst: 0, rate: item.taxRate || 0 };
              hsnMap[hsn].taxableValue += Number(item.taxableAmount || 0);
              hsnMap[hsn].igst += Number(item.igst || 0);
              hsnMap[hsn].cgst += Number(item.cgst || 0);
              hsnMap[hsn].sgst += Number(item.sgst || 0);
            });
            const rows = Object.entries(hsnMap);
            if (rows.length === 0) return null;
            const totals = rows.reduce((acc, [, v]) => ({
              taxableValue: acc.taxableValue + v.taxableValue,
              igst: acc.igst + v.igst,
              cgst: acc.cgst + v.cgst,
              sgst: acc.sgst + v.sgst,
            }), { taxableValue: 0, igst: 0, cgst: 0, sgst: 0 });
            return (
              <div className="border-t border-gray-200">
                <div className="px-4 py-1.5 bg-gray-50 text-xs font-bold text-gray-500 uppercase tracking-widest">HSN / SAC Summary</div>
                <table className="w-full text-xs border-t border-gray-200">
                  <thead>
                    <tr className="bg-gray-100 text-gray-600">
                      <th className="px-3 py-1.5 text-left font-medium">HSN/SAC</th>
                      <th className="px-3 py-1.5 text-right font-medium">Taxable Value</th>
                      <th className="px-3 py-1.5 text-center font-medium">Rate</th>
                      {isInterState
                        ? <th className="px-3 py-1.5 text-right font-medium">IGST</th>
                        : <><th className="px-3 py-1.5 text-right font-medium">CGST</th><th className="px-3 py-1.5 text-right font-medium">SGST</th></>
                      }
                      <th className="px-3 py-1.5 text-right font-medium">Total Tax</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {rows.map(([hsn, v]) => (
                      <tr key={hsn}>
                        <td className="px-3 py-1.5 font-mono">{hsn}</td>
                        <td className="px-3 py-1.5 text-right">{fmt.number(v.taxableValue)}</td>
                        <td className="px-3 py-1.5 text-center">{v.rate}%</td>
                        {isInterState
                          ? <td className="px-3 py-1.5 text-right">{fmt.number(v.igst)}</td>
                          : <><td className="px-3 py-1.5 text-right">{fmt.number(v.cgst)}</td><td className="px-3 py-1.5 text-right">{fmt.number(v.sgst)}</td></>
                        }
                        <td className="px-3 py-1.5 text-right font-medium">{fmt.number(isInterState ? v.igst : v.cgst + v.sgst)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="border-t-2 border-gray-300 bg-gray-50 font-bold">
                    <tr>
                      <td className="px-3 py-1.5">TOTAL</td>
                      <td className="px-3 py-1.5 text-right">{fmt.number(totals.taxableValue)}</td>
                      <td />
                      {isInterState
                        ? <td className="px-3 py-1.5 text-right">{fmt.number(totals.igst)}</td>
                        : <><td className="px-3 py-1.5 text-right">{fmt.number(totals.cgst)}</td><td className="px-3 py-1.5 text-right">{fmt.number(totals.sgst)}</td></>
                      }
                      <td className="px-3 py-1.5 text-right">{fmt.number(isInterState ? totals.igst : totals.cgst + totals.sgst)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            );
          })()}

          {/* ---- TOTALS + BANK ---- */}
          <div className="border-t-2 border-gray-800 grid grid-cols-2">
            {/* Left: Bank + Amount in words */}
            <div className="px-7 py-5 border-r border-gray-200 space-y-4">
              {/* Amount in words */}
              <div className="bg-blue-50 border border-blue-100 rounded-lg px-4 py-3">
                <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Amount in Words</div>
                <div className="text-sm font-semibold text-blue-900">{toWords(Number(voucher.grandTotal) || 0)}</div>
              </div>

              {/* Bank Details */}
              {(biz.bankName || biz.bankAccount) && (
                <div>
                  <div className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1.5">Bank Details</div>
                  <div className="text-sm space-y-0.5">
                    {biz.bankName && <div><span className="text-gray-500">Bank:</span> <span className="font-medium">{biz.bankName}</span></div>}
                    {biz.bankAccount && <div><span className="text-gray-500">A/C No:</span> <span className="font-mono font-medium">{biz.bankAccount}</span></div>}
                    {biz.bankIfsc && <div><span className="text-gray-500">IFSC:</span> <span className="font-mono font-medium">{biz.bankIfsc}</span></div>}
                    {biz.bankBranch && <div><span className="text-gray-500">Branch:</span> <span className="font-medium">{biz.bankBranch}</span></div>}
                  </div>
                </div>
              )}

              {/* Notes */}
              {voucher.notes && (
                <div>
                  <div className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Notes</div>
                  <div className="text-sm text-gray-600 whitespace-pre-line">{voucher.notes}</div>
                </div>
              )}
            </div>

            {/* Right: Tax summary */}
            <div className="px-7 py-5">
              <div className="space-y-1.5 text-sm ml-auto max-w-xs">
                {/* Block 1 — tax breakdown */}
                {Number(voucher.totalDiscount) > 0 && (
                  <div className="flex justify-between text-red-500 text-xs">
                    <span>Discount</span><span>-{fmt.currency(voucher.totalDiscount)}</span>
                  </div>
                )}
                <div className="flex justify-between text-gray-600">
                  <span>Taxable Amount</span>
                  <span className="font-medium">{fmt.currency(voucher.taxableAmount)}</span>
                </div>
                {!isInterState ? (
                  <>
                    <div className="flex justify-between text-blue-600 text-xs">
                      <span>CGST</span><span>{fmt.currency(voucher.totalCgst)}</span>
                    </div>
                    <div className="flex justify-between text-blue-600 text-xs">
                      <span>SGST</span><span>{fmt.currency(voucher.totalSgst)}</span>
                    </div>
                  </>
                ) : (
                  <div className="flex justify-between text-orange-600 text-xs">
                    <span>IGST</span><span>{fmt.currency(voucher.totalIgst)}</span>
                  </div>
                )}
                {/* Invoice Value = taxable + tax */}
                {(() => {
                  const invoiceValue = Number(voucher.taxableAmount) + Number(voucher.totalCgst || 0) + Number(voucher.totalSgst || 0) + Number(voucher.totalIgst || 0);
                  const invoiceAmount = invoiceValue + Number(voucher.roundOff || 0);
                  return (
                    <>
                      <div className="flex justify-between font-semibold text-gray-900 border-t border-gray-300 pt-1.5 mt-0.5">
                        <span>Invoice Value</span>
                        <span>{fmt.currency(invoiceValue)}</span>
                      </div>

                      {/* Dashed divider */}
                      <div className="border-t-2 border-dashed border-gray-300 my-1" />

                      {/* Block 2 — payable breakdown */}
                      {Number(voucher.roundOff) !== 0 && (
                        <div className="flex justify-between text-gray-500 text-xs">
                          <span>Round Off</span>
                          <span>{Number(voucher.roundOff) > 0 ? "+" : ""}{fmt.currency(voucher.roundOff)}</span>
                        </div>
                      )}
                      {Number(voucher.roundOff) !== 0 && (
                        <div className="flex justify-between text-gray-700 text-xs">
                          <span>Invoice Amount</span>
                          <span className="font-medium">{fmt.currency(invoiceAmount)}</span>
                        </div>
                      )}
                      {Number(voucher.transportCharges) > 0 && (
                        <div className="flex justify-between text-gray-600 text-xs">
                          <span>Transport{voucher.transportName ? ` (${voucher.transportName})` : ""}</span>
                          <span>{fmt.currency(voucher.transportCharges)}</span>
                        </div>
                      )}
                      <div className="flex justify-between font-extrabold text-base border-t-2 border-gray-800 pt-2 mt-1">
                        <span>Net Total Payable</span>
                        <span className="text-blue-700">{fmt.currency(voucher.grandTotal)}</span>
                      </div>
                    </>
                  );
                })()}
                {Number(voucher.paidAmount) > 0 && (
                  <div className="flex justify-between text-green-600 text-sm border-t pt-1">
                    <span>Paid</span><span>{fmt.currency(voucher.paidAmount)}</span>
                  </div>
                )}
                {Number(voucher.balanceDue) > 0 && (
                  <div className="flex justify-between text-red-600 font-bold text-sm border-t pt-1">
                    <span>Balance Due</span><span>{fmt.currency(voucher.balanceDue)}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ---- FOOTER: Terms + Signature ---- */}
          <div className="border-t border-gray-200 grid grid-cols-2 px-7 py-5 gap-6">
            <div>
              {(voucher.termsAndConditions || biz.invoiceFooter) && (
                <>
                  <div className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1.5">Terms & Conditions</div>
                  <div className="text-xs text-gray-500 whitespace-pre-line leading-relaxed">
                    {voucher.termsAndConditions || biz.invoiceFooter}
                  </div>
                </>
              )}
              <div className="mt-3 text-xs text-gray-400">
                This is a computer generated document. No signature required unless specified.
              </div>
            </div>
            <div className="text-right flex flex-col justify-between">
              <div />
              <div>
                <div className="border-t-2 border-gray-800 pt-3 mt-12 inline-block min-w-40 text-center">
                  <div className="font-bold text-sm text-gray-800">
                    {biz.name || ""}
                  </div>
                  {biz.signatoryName && (
                    <div className="text-xs text-gray-500 mt-0.5">{biz.signatoryName}</div>
                  )}
                  <div className="text-xs text-gray-400 mt-0.5">Authorized Signatory</div>
                </div>
              </div>
            </div>
          </div>

          {/* ---- GLOBAL PRINT FOOTER (Tech Panel se set hota hai) ---- */}
          {(printFooter.text || printFooter.logo) && (
            <div className="border-t border-gray-100 px-7 py-2 flex items-center justify-center gap-3 print-only" style={{ display: "flex" }}>
              {printFooter.logo && <img src={printFooter.logo} alt="" className="h-6 object-contain" style={{ maxHeight: "24px" }} />}
              {printFooter.text && <span className="text-xs text-gray-500">{printFooter.text}</span>}
            </div>
          )}

          {/* ---- BOTTOM STRIP ---- */}
          <div className="bg-gray-900 text-white text-center py-2 text-xs tracking-widest font-medium">
            THANK YOU FOR YOUR BUSINESS
          </div>

          {/* ---- BIZCOR BRANDING ---- */}
          <div className="bg-gray-50 border-t border-gray-100 px-7 py-1.5 flex items-center justify-center gap-2">
            <span className="text-gray-400 text-xs font-semibold tracking-wide">BizCor ERP</span>
            <span className="text-gray-300 text-xs">–</span>
            <span className="text-gray-400 text-xs">info@naewtgroup.com</span>
          </div>
        </div>
      </div>
    </>
  );
}
