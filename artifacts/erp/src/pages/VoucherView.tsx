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
      api.get<any>("/businesses/current").catch(() => null),
      api.get<any>("/public-settings").catch(() => ({})),
    ]).then(([v, b, s]) => {
      setVoucher(v);
      setBusiness(b);
      setPrintFooter({ text: s?.printFooterText || "", logo: s?.printFooterLogo || "" });
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

  const invoiceTemplate = biz.invoiceTemplate || "classic";

  // ── TALLY TEMPLATE ──────────────────────────────────────────────────────
  if (invoiceTemplate === "tally") {
    const totalQty = (voucher.items || []).reduce((s: number, i: any) => s + Number(i.quantity || 0), 0);
    const totalItems = (voucher.items || []).length;
    const hsnMap: Record<string, { taxableValue: number; igst: number; cgst: number; sgst: number; rate: number }> = {};
    (voucher.items || []).forEach((item: any) => {
      const hsn = item.hsnCode || "—";
      if (!hsnMap[hsn]) hsnMap[hsn] = { taxableValue: 0, igst: 0, cgst: 0, sgst: 0, rate: item.taxRate || 0 };
      hsnMap[hsn].taxableValue += Number(item.taxableAmount || 0);
      hsnMap[hsn].igst += Number(item.igst || 0);
      hsnMap[hsn].cgst += Number(item.cgst || 0);
      hsnMap[hsn].sgst += Number(item.sgst || 0);
    });
    const hsnRows = Object.entries(hsnMap);
    const hsnTotals = hsnRows.reduce((acc, [, v]) => ({
      taxableValue: acc.taxableValue + v.taxableValue,
      igst: acc.igst + v.igst, cgst: acc.cgst + v.cgst, sgst: acc.sgst + v.sgst,
    }), { taxableValue: 0, igst: 0, cgst: 0, sgst: 0 });
    const invoiceValue = Number(voucher.taxableAmount) + Number(voucher.totalCgst || 0) + Number(voucher.totalSgst || 0) + Number(voucher.totalIgst || 0);

    const tdCls = "border border-black px-1.5 py-0.5 text-xs";
    const thCls = "border border-black px-1.5 py-0.5 text-xs font-bold bg-gray-100";

    return (
      <>
        {showPrintPreview && (
          <PrintPreviewModal
            printableId="printable"
            title={`${DOC_TITLES[voucherType] || "Invoice"} — ${voucher?.voucherNumber || ""}`}
            onClose={() => setShowPrintPreview(false)}
            initialZoom={autoPrint ? 0.6 : undefined}
            shareText={voucher ? [
              `*${voucher.voucherNumber}*`, `Party: ${voucher.partyName}`,
              `Date: ${fmt.date(voucher.date)}`, `Amount: ${fmt.currency(voucher.grandTotal)}`,
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
            #printable table tr { page-break-inside: avoid; }
          }
          .print-only { display: none; }
        `}</style>

        <div className="max-w-4xl space-y-4">
          {/* Toolbar */}
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

          {/* ===== TALLY STYLE PRINTABLE ===== */}
          <div id="printable" className="bg-white border-2 border-black text-gray-900" style={{ fontFamily: "Arial, sans-serif", fontSize: "12px" }}>

            {/* HEADER: Logo+Firm LEFT | TAX INVOICE RIGHT — S.R.TEX style */}
            <div className="border-b-2 border-black px-3 py-2 flex items-start justify-between gap-2">
              <div className="flex items-start gap-2 flex-1 min-w-0">
                {biz.logo && <img src={biz.logo} alt="Logo" style={{ width: "50px", height: "50px", objectFit: "contain", flexShrink: 0 }} />}
                <div>
                  <div style={{ fontSize: "18px", fontWeight: "bold", textTransform: "uppercase", lineHeight: 1.2 }}>{biz.name || "Your Business Name"}</div>
                  {bizAddress && <div style={{ fontSize: "10px" }}>{bizAddress}</div>}
                  <div style={{ fontSize: "10px" }}>
                    {biz.phone && <span>Mobile: {biz.phone}</span>}
                    {biz.phone && biz.email && <span>  </span>}
                    {biz.email && <span>Email: {biz.email}</span>}
                  </div>
                  {biz.gstin && <div style={{ fontSize: "10px" }}>GSTIN: <strong>{biz.gstin}</strong></div>}
                  {biz.pan && <div style={{ fontSize: "10px" }}>PAN: {biz.pan}</div>}
                </div>
              </div>
              <div style={{ textAlign: "right", flexShrink: 0 }}>
                <div style={{ fontWeight: "bold", fontSize: "14px", letterSpacing: "1px" }}>{docTitle}</div>
                <div style={{ fontSize: "9px" }}>ORIGINAL FOR RECIPIENT</div>
              </div>
            </div>

            {/* PARTY + DOC INFO */}
            <div className="border-b border-black grid grid-cols-2">
              <div className="border-r border-black px-2 py-1.5">
                <div style={{ fontSize: "10px", fontWeight: "bold", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "2px" }}>Customer Details:</div>
                <div style={{ fontSize: "13px", fontWeight: "bold" }}>{voucher.partyName}</div>
                {voucher.partyGstin && <div style={{ fontSize: "10px" }}>GSTIN: {voucher.partyGstin}</div>}
                {voucher.billingAddress && (
                  <div style={{ marginTop: "2px" }}>
                    <div style={{ fontSize: "9px", fontWeight: "bold" }}>Billing Address:</div>
                    <div style={{ fontSize: "10px", whiteSpace: "pre-line" }}>{voucher.billingAddress}</div>
                  </div>
                )}
                {voucher.shippingAddress && (
                  <div style={{ marginTop: "2px" }}>
                    <div style={{ fontSize: "9px", fontWeight: "bold" }}>Shipping Address:</div>
                    <div style={{ fontSize: "10px", whiteSpace: "pre-line" }}>{voucher.shippingAddress}</div>
                  </div>
                )}
              </div>
              {/* RIGHT: S.R.TEX style 6-box grid */}
              <div style={{ padding: "0" }}>
                <table style={{ width: "100%", fontSize: "11px", borderCollapse: "collapse" }}>
                  <tbody>
                    {/* Row 1: Invoice No | Date */}
                    <tr>
                      <td style={{ border: "1px solid #000", padding: "3px 6px", width: "50%", verticalAlign: "top" }}>
                        <div style={{ fontWeight: "bold", fontSize: "10px" }}>Invoice #:</div>
                        <div style={{ fontWeight: "bold" }}>
                          <span className="screen-only">{voucher.voucherNumber}</span>
                          <span className="print-only">{formatPrintNumber(voucher.voucherNumber, biz)}</span>
                        </div>
                      </td>
                      <td style={{ border: "1px solid #000", padding: "3px 6px", width: "50%", verticalAlign: "top" }}>
                        <div style={{ fontWeight: "bold", fontSize: "10px" }}>Date:</div>
                        <div style={{ fontWeight: "bold" }}>{fmt.date(voucher.date)}</div>
                      </td>
                    </tr>
                    {/* Row 2: Place of Supply | Due Date */}
                    <tr>
                      <td style={{ border: "1px solid #000", padding: "3px 6px", verticalAlign: "top" }}>
                        <div style={{ fontWeight: "bold", fontSize: "10px" }}>Place of Supply:</div>
                        <div style={{ fontWeight: "bold" }}>{voucher.placeOfSupply || "—"}</div>
                      </td>
                      <td style={{ border: "1px solid #000", padding: "3px 6px", verticalAlign: "top" }}>
                        <div style={{ fontWeight: "bold", fontSize: "10px" }}>Due Date:</div>
                        <div style={{ fontWeight: "bold" }}>{voucher.dueDate ? fmt.date(voucher.dueDate) : "—"}</div>
                      </td>
                    </tr>
                    {/* Row 3: Status | Linked Voucher */}
                    <tr>
                      <td style={{ border: "1px solid #000", padding: "3px 6px", verticalAlign: "top" }}>
                        <div style={{ fontWeight: "bold", fontSize: "10px" }}>Status:</div>
                        <div style={{ fontWeight: "bold" }}>{STATUS_LABELS[voucher.status] || voucher.status?.toUpperCase()}</div>
                      </td>
                      <td style={{ border: "1px solid #000", padding: "3px 6px", verticalAlign: "top" }}>
                        {voucher.linkedVoucherNumber
                          ? <><div style={{ fontWeight: "bold", fontSize: "10px" }}>{voucherType === "sales/credit-notes" ? "Against Invoice:" : "Against Bill:"}</div><div style={{ fontWeight: "bold" }}>{voucher.linkedVoucherNumber}</div></>
                          : <><div style={{ fontWeight: "bold", fontSize: "10px" }}>&nbsp;</div><div>&nbsp;</div></>
                        }
                      </td>
                    </tr>
                    {/* Reference — full width, only if set */}
                    {voucher.referenceNumber && (
                      <tr>
                        <td colSpan={2} style={{ border: "1px solid #000", padding: "3px 6px", verticalAlign: "top" }}>
                          <div style={{ fontWeight: "bold", fontSize: "10px" }}>Reference:</div>
                          <div style={{ whiteSpace: "pre-line" }}>{voucher.referenceNumber}</div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* ITEMS TABLE */}
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th className={thCls} style={{ width: "24px" }}>S.No</th>
                  <th className={thCls} style={{ textAlign: "left" }}>Particulars</th>
                  <th className={thCls}>HSN</th>
                  <th className={thCls}>Unit</th>
                  <th className={thCls} style={{ textAlign: "right" }}>Qty</th>
                  <th className={thCls} style={{ textAlign: "right" }}>Rate</th>
                  {hasDiscount && <th className={thCls} style={{ textAlign: "right" }}>Disc</th>}
                  {isInterState
                    ? <th className={thCls} style={{ textAlign: "right" }}>IGST</th>
                    : <><th className={thCls} style={{ textAlign: "right" }}>CGST</th><th className={thCls} style={{ textAlign: "right" }}>SGST</th></>
                  }
                  <th className={thCls} style={{ textAlign: "right" }}>Amount</th>
                </tr>
              </thead>
              <tbody>
                {(voucher.items || []).map((item: any, idx: number) => (
                  <tr key={idx}>
                    <td className={tdCls} style={{ textAlign: "center" }}>{idx + 1}</td>
                    <td className={tdCls}>
                      <div style={{ fontWeight: "bold" }}>{item.itemName}</div>
                      {item.description && <div style={{ fontSize: "10px" }}>{item.description}</div>}
                      {item.customFields && Object.keys(item.customFields).length > 0 && (
                        <div style={{ fontSize: "10px" }}>
                          {Object.entries(item.customFields).filter(([, v]) => v).map(([k, v]) => (
                            <span key={k} style={{ marginRight: "8px" }}>
                              {k.replace(/([A-Z])/g, ' $1').trim()}: {String(v)}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className={tdCls} style={{ textAlign: "center" }}>{item.hsnCode || "-"}</td>
                    <td className={tdCls} style={{ textAlign: "center" }}>{item.unit}</td>
                    <td className={tdCls} style={{ textAlign: "right" }}>{fmtQty(item.quantity)}</td>
                    <td className={tdCls} style={{ textAlign: "right" }}>{fmt.number(item.rate)}</td>
                    {hasDiscount && (
                      <td className={tdCls} style={{ textAlign: "right" }}>
                        {item.discount > 0 ? `${fmtQty(item.discount)}${item.discountType === "percent" ? "%" : ""}` : "-"}
                      </td>
                    )}
                    {isInterState
                      ? <td className={tdCls} style={{ textAlign: "right" }}>{fmt.number(item.igst)}</td>
                      : <><td className={tdCls} style={{ textAlign: "right" }}>{fmt.number(item.cgst)}</td><td className={tdCls} style={{ textAlign: "right" }}>{fmt.number(item.sgst)}</td></>
                    }
                    <td className={tdCls} style={{ textAlign: "right", fontWeight: "bold" }}>{fmt.number(item.total)}</td>
                  </tr>
                ))}
                {Array.from({ length: 8 }).map((_, i) => (
                  <tr key={`empty-${i}`}>
                    <td style={{ height: "20px" }} />
                    <td /><td /><td /><td /><td />
                    {hasDiscount && <td />}
                    {isInterState ? <td /> : <><td /><td /></>}
                    <td />
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td className={tdCls} colSpan={2} style={{ fontWeight: "bold" }}>
                    Total Items: {totalItems} | Total Qty: {fmtQty(totalQty)}
                  </td>
                  <td className={tdCls} colSpan={3} />
                  {hasDiscount && <td className={tdCls} />}
                  {isInterState
                    ? <td className={tdCls} style={{ textAlign: "right", fontWeight: "bold" }}>{fmt.number(voucher.totalIgst)}</td>
                    : <><td className={tdCls} style={{ textAlign: "right", fontWeight: "bold" }}>{fmt.number(voucher.totalCgst)}</td><td className={tdCls} style={{ textAlign: "right", fontWeight: "bold" }}>{fmt.number(voucher.totalSgst)}</td></>
                  }
                  <td className={tdCls} style={{ textAlign: "right", fontWeight: "bold" }}>{fmt.number(voucher.grandTotal)}</td>
                </tr>
              </tfoot>
            </table>

            {/* HSN SUMMARY */}
            {hsnRows.length > 0 && (
              <div className="border-t border-black">
                <div style={{ fontWeight: "bold", fontSize: "11px", padding: "2px 6px", background: "#f3f4f6" }}>HSN/SAC Summary</div>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr>
                      <th className={thCls} style={{ textAlign: "left" }}>HSN/SAC</th>
                      <th className={thCls} style={{ textAlign: "right" }}>Taxable Value</th>
                      <th className={thCls} style={{ textAlign: "center" }}>Rate</th>
                      {isInterState
                        ? <th className={thCls} style={{ textAlign: "right" }}>IGST</th>
                        : <><th className={thCls} style={{ textAlign: "right" }}>CGST</th><th className={thCls} style={{ textAlign: "right" }}>SGST</th></>
                      }
                      <th className={thCls} style={{ textAlign: "right" }}>Total Tax</th>
                    </tr>
                  </thead>
                  <tbody>
                    {hsnRows.map(([hsn, v]) => (
                      <tr key={hsn}>
                        <td className={tdCls}>{hsn}</td>
                        <td className={tdCls} style={{ textAlign: "right" }}>{fmt.number(v.taxableValue)}</td>
                        <td className={tdCls} style={{ textAlign: "center" }}>{v.rate}%</td>
                        {isInterState
                          ? <td className={tdCls} style={{ textAlign: "right" }}>{fmt.number(v.igst)}</td>
                          : <><td className={tdCls} style={{ textAlign: "right" }}>{fmt.number(v.cgst)}</td><td className={tdCls} style={{ textAlign: "right" }}>{fmt.number(v.sgst)}</td></>
                        }
                        <td className={tdCls} style={{ textAlign: "right", fontWeight: "bold" }}>{fmt.number(isInterState ? v.igst : v.cgst + v.sgst)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td className={tdCls} style={{ fontWeight: "bold" }}>TOTAL</td>
                      <td className={tdCls} style={{ textAlign: "right", fontWeight: "bold" }}>{fmt.number(hsnTotals.taxableValue)}</td>
                      <td className={tdCls} />
                      {isInterState
                        ? <td className={tdCls} style={{ textAlign: "right", fontWeight: "bold" }}>{fmt.number(hsnTotals.igst)}</td>
                        : <><td className={tdCls} style={{ textAlign: "right", fontWeight: "bold" }}>{fmt.number(hsnTotals.cgst)}</td><td className={tdCls} style={{ textAlign: "right", fontWeight: "bold" }}>{fmt.number(hsnTotals.sgst)}</td></>
                      }
                      <td className={tdCls} style={{ textAlign: "right", fontWeight: "bold" }}>{fmt.number(isInterState ? hsnTotals.igst : hsnTotals.cgst + hsnTotals.sgst)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}

            {/* TOTALS + BANK + WORDS */}
            <div className="border-t-2 border-black grid grid-cols-2">
              {/* Left: Words + Bank + Notes */}
              <div className="border-r border-black px-2 py-1.5" style={{ fontSize: "11px" }}>
                <div style={{ fontWeight: "bold", marginBottom: "2px" }}>Amount in Words:</div>
                <div style={{ fontStyle: "italic" }}>{toWords(Number(voucher.grandTotal) || 0)}</div>

                {(biz.bankName || biz.bankAccount) && (
                  <div style={{ marginTop: "6px" }}>
                    <div style={{ fontWeight: "bold", marginBottom: "2px" }}>Bank Details:</div>
                    {biz.bankName && <div>Bank: {biz.bankName}</div>}
                    {biz.bankAccount && <div>A/C No: {biz.bankAccount}</div>}
                    {biz.bankIfsc && <div>IFSC: {biz.bankIfsc}</div>}
                    {biz.bankBranch && <div>Branch: {biz.bankBranch}</div>}
                  </div>
                )}

                {voucher.notes && (
                  <div style={{ marginTop: "6px" }}>
                    <div style={{ fontWeight: "bold" }}>Notes:</div>
                    <div style={{ whiteSpace: "pre-line" }}>{voucher.notes}</div>
                  </div>
                )}
              </div>

              {/* Right: Tax breakdown */}
              <div className="px-2 py-1.5" style={{ fontSize: "11px" }}>
                <table style={{ width: "100%", marginLeft: "auto" }}>
                  <tbody>
                    {Number(voucher.totalDiscount) > 0 && (
                      <tr><td>Discount</td><td style={{ textAlign: "right" }}>-{fmt.currency(voucher.totalDiscount)}</td></tr>
                    )}
                    <tr><td>Taxable Amount</td><td style={{ textAlign: "right" }}>{fmt.currency(voucher.taxableAmount)}</td></tr>
                    {!isInterState ? (
                      <>
                        <tr><td>CGST</td><td style={{ textAlign: "right" }}>{fmt.currency(voucher.totalCgst)}</td></tr>
                        <tr><td>SGST</td><td style={{ textAlign: "right" }}>{fmt.currency(voucher.totalSgst)}</td></tr>
                      </>
                    ) : (
                      <tr><td>IGST</td><td style={{ textAlign: "right" }}>{fmt.currency(voucher.totalIgst)}</td></tr>
                    )}
                    <tr style={{ borderTop: "1px solid black" }}>
                      <td style={{ fontWeight: "bold" }}>Invoice Value</td>
                      <td style={{ textAlign: "right", fontWeight: "bold" }}>{fmt.currency(invoiceValue)}</td>
                    </tr>
                    {Number(voucher.roundOff) !== 0 && (
                      <tr><td>Round Off</td><td style={{ textAlign: "right" }}>{Number(voucher.roundOff) > 0 ? "+" : ""}{fmt.currency(voucher.roundOff)}</td></tr>
                    )}
                    {Number(voucher.transportCharges) > 0 && (
                      <tr><td>Transport{voucher.transportName ? ` (${voucher.transportName})` : ""}</td><td style={{ textAlign: "right" }}>{fmt.currency(voucher.transportCharges)}</td></tr>
                    )}
                    <tr style={{ borderTop: "2px solid black" }}>
                      <td style={{ fontWeight: "bold", fontSize: "13px" }}>Net Total Payable</td>
                      <td style={{ textAlign: "right", fontWeight: "bold", fontSize: "13px" }}>{fmt.currency(voucher.grandTotal)}</td>
                    </tr>
                    {Number(voucher.paidAmount) > 0 && (
                      <tr><td>Paid</td><td style={{ textAlign: "right" }}>{fmt.currency(voucher.paidAmount)}</td></tr>
                    )}
                    {Number(voucher.balanceDue) > 0 && (
                      <tr style={{ borderTop: "1px solid black" }}>
                        <td style={{ fontWeight: "bold" }}>Balance Due</td>
                        <td style={{ textAlign: "right", fontWeight: "bold" }}>{fmt.currency(voucher.balanceDue)}</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* TERMS + SIGNATURE */}
            <div className="border-t border-black grid grid-cols-2 px-2 py-1.5" style={{ fontSize: "11px" }}>
              <div className="border-r border-black pr-2">
                {(voucher.termsAndConditions || biz.invoiceFooter) && (
                  <>
                    <div style={{ fontWeight: "bold", marginBottom: "2px" }}>Terms & Conditions:</div>
                    <div style={{ whiteSpace: "pre-line", lineHeight: "1.4" }}>{voucher.termsAndConditions || biz.invoiceFooter}</div>
                  </>
                )}
                <div style={{ marginTop: "4px", fontStyle: "italic", fontSize: "10px" }}>
                  We declare that this invoice shows the actual price of the goods described and that all particulars are true and correct.
                </div>
              </div>
              <div className="text-right pl-2" style={{ paddingTop: "8px" }}>
                <div style={{ marginTop: "40px", borderTop: "1px solid black", display: "inline-block", minWidth: "140px", textAlign: "center", paddingTop: "3px" }}>
                  <div style={{ fontWeight: "bold" }}>For {biz.name || ""}</div>
                  {biz.signatoryName && <div style={{ fontSize: "10px" }}>{biz.signatoryName}</div>}
                  <div style={{ fontSize: "10px" }}>Authorised Signatory</div>
                </div>
              </div>
            </div>

            {/* BIZCOR FOOTER */}
            <div className="border-t border-black text-center py-1" style={{ fontSize: "10px", color: "#6b7280" }}>
              BizCor ERP — info@naewtgroup.com
            </div>
          </div>
        </div>
      </>
    );
  }

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
          @page { margin: 8mm; size: A4; }

          /* ── COMPACT PRINT: aggressive padding reduction for 1-page fit ── */

          /* Horizontal padding — outer sections */
          #printable .px-7,
          #printable .sm\\:px-7 { padding-left: 12px !important; padding-right: 12px !important; }
          #printable .px-4 { padding-left: 8px !important; padding-right: 8px !important; }
          #printable .px-3 { padding-left: 6px !important; padding-right: 6px !important; }

          /* Vertical padding — all sections squeezed */
          #printable .py-5,
          #printable .sm\\:py-5 { padding-top: 5px !important; padding-bottom: 5px !important; }
          #printable .py-4,
          #printable .sm\\:py-4 { padding-top: 4px !important; padding-bottom: 4px !important; }
          #printable .py-3 { padding-top: 3px !important; padding-bottom: 3px !important; }
          #printable .py-2 { padding-top: 2px !important; padding-bottom: 2px !important; }
          #printable .py-1\\.5 { padding-top: 2px !important; padding-bottom: 2px !important; }

          /* Gap between stacked children */
          #printable .space-y-4 > * + * { margin-top: 5px !important; }
          #printable .space-y-3 > * + * { margin-top: 4px !important; }
          #printable .space-y-1\\.5 > * + * { margin-top: 2px !important; }
          #printable .space-y-0\\.5 > * + * { margin-top: 1px !important; }
          #printable .gap-3 { gap: 6px !important; }
          #printable .gap-6 { gap: 10px !important; }

          /* Margins */
          #printable .mt-12 { margin-top: 12px !important; }
          #printable .mt-3  { margin-top: 5px !important; }
          #printable .mt-2  { margin-top: 3px !important; }
          #printable .mt-1  { margin-top: 2px !important; }
          #printable .mb-1  { margin-bottom: 2px !important; }
          #printable .mb-1\\.5 { margin-bottom: 2px !important; }
          #printable .mb-2  { margin-bottom: 3px !important; }

          /* Amount-in-words box — reduce blue box padding */
          #printable .rounded-lg.border.px-4.py-3 { padding: 3px 6px !important; }

          /* Make text slightly smaller in print for more density */
          #printable { font-size: 11px !important; }
          #printable .text-sm { font-size: 11px !important; }
          #printable .text-xs { font-size: 10px !important; }
          #printable .text-base { font-size: 13px !important; }
          #printable .text-2xl { font-size: 18px !important; }
          #printable .text-xl { font-size: 15px !important; }
          #printable h1 { font-size: 18px !important; }
          #printable .text-lg { font-size: 13px !important; }

          /* Logo size reduce */
          #printable .sm\\:w-20 { width: 52px !important; }
          #printable .sm\\:h-20 { height: 52px !important; }

          /* Table rows — tighter */
          #printable table td,
          #printable table th { padding-top: 2px !important; padding-bottom: 2px !important; }

          /* Prevent mid-row page breaks */
          #printable tr { page-break-inside: avoid; page-break-after: auto; }
          #printable table { page-break-inside: auto; }
          #printable .border-t-2 { page-break-inside: avoid; }
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

              {/* Right: Document Title only (invoice details go in Tally boxes below) */}
              <div className="flex-shrink-0 text-right">
                <div className="inline-block bg-gray-900 text-white px-4 py-1.5 rounded text-xs sm:text-sm font-bold tracking-widest mb-1">
                  {docTitle}
                </div>
                <div className="text-xs text-gray-500">ORIGINAL FOR RECIPIENT</div>
              </div>

            </div>
          </div>

          {/* ---- BILLING INFO (Tally style) ---- */}
          <div className="grid grid-cols-2 border-b-2 border-gray-800">
            {/* Left: Customer / Buyer info */}
            <div className="px-4 py-3 border-r-2 border-gray-800 text-sm">
              <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Buyer (Bill To)</div>
              <div className="font-bold text-gray-900 text-base leading-tight">{voucher.partyName}</div>
              {voucher.partyGstin && (
                <div className="text-xs font-mono text-gray-600 mt-0.5">GSTIN: {voucher.partyGstin}</div>
              )}
              {voucher.billingAddress && (
                <div className="text-xs text-gray-600 mt-1 whitespace-pre-line leading-relaxed">{voucher.billingAddress}</div>
              )}
              {voucher.useShippingAddress && voucher.shippingAddress && (
                <div className="mt-2 pt-2 border-t border-gray-200">
                  <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-0.5">Dispatch To</div>
                  <div className="text-xs text-gray-600 whitespace-pre-line">{voucher.shippingAddress}</div>
                </div>
              )}
            </div>
            {/* Right: Tally-style info table */}
            <div>
              <table className="w-full text-xs" style={{ borderCollapse: "collapse" }}>
                <tbody>
                  <tr style={{ borderBottom: "1px solid #d1d5db" }}>
                    <td className="px-3 py-1.5 text-gray-600 font-semibold" style={{ borderRight: "1px solid #d1d5db", width: "45%" }}>Invoice No.</td>
                    <td className="px-3 py-1.5 font-bold text-gray-900 font-mono">
                      <span className="screen-only">{voucher.voucherNumber}</span>
                      <span className="print-only">{formatPrintNumber(voucher.voucherNumber, biz)}</span>
                    </td>
                  </tr>
                  <tr style={{ borderBottom: "1px solid #d1d5db" }}>
                    <td className="px-3 py-1.5 text-gray-600 font-semibold" style={{ borderRight: "1px solid #d1d5db" }}>Date</td>
                    <td className="px-3 py-1.5 text-gray-900">{fmt.date(voucher.date)}</td>
                  </tr>
                  {voucher.dueDate && (
                    <tr style={{ borderBottom: "1px solid #d1d5db" }}>
                      <td className="px-3 py-1.5 text-gray-600 font-semibold" style={{ borderRight: "1px solid #d1d5db" }}>Due Date</td>
                      <td className="px-3 py-1.5 text-gray-900 font-medium">{fmt.date(voucher.dueDate)}</td>
                    </tr>
                  )}
                  {voucher.referenceNumber && (
                    <tr style={{ borderBottom: "1px solid #d1d5db" }}>
                      <td className="px-3 py-1.5 text-gray-600 font-semibold" style={{ borderRight: "1px solid #d1d5db" }}>Ref. No.</td>
                      <td className="px-3 py-1.5 text-gray-900 font-mono">{voucher.referenceNumber}</td>
                    </tr>
                  )}
                  {voucher.placeOfSupply && (
                    <tr style={{ borderBottom: "1px solid #d1d5db" }}>
                      <td className="px-3 py-1.5 text-gray-600 font-semibold" style={{ borderRight: "1px solid #d1d5db" }}>Place of Supply</td>
                      <td className="px-3 py-1.5 text-gray-900">{voucher.placeOfSupply}</td>
                    </tr>
                  )}
                  <tr style={{ borderBottom: "1px solid #d1d5db" }}>
                    <td className="px-3 py-1.5 text-gray-600 font-semibold" style={{ borderRight: "1px solid #d1d5db" }}>GST Type</td>
                    <td className={`px-3 py-1.5 font-semibold text-xs ${isInterState ? "text-orange-700" : "text-blue-700"}`}>
                      {isInterState ? "IGST (Inter-State)" : "CGST+SGST (Intra-State)"}
                    </td>
                  </tr>
                  {voucher.linkedVoucherNumber && (
                    <tr style={{ borderBottom: "1px solid #d1d5db" }}>
                      <td className="px-3 py-1.5 text-gray-600 font-semibold" style={{ borderRight: "1px solid #d1d5db" }}>
                        {voucherType === "sales/credit-notes" ? "Against Invoice" : "Against Bill"}
                      </td>
                      <td className="px-3 py-1.5 text-amber-700 font-mono font-semibold">{voucher.linkedVoucherNumber}</td>
                    </tr>
                  )}
                  <tr>
                    <td className="px-3 py-1.5 text-gray-600 font-semibold" style={{ borderRight: "1px solid #d1d5db" }}>Status</td>
                    <td className="px-3 py-1.5">
                      <span className={`px-2 py-0.5 rounded text-xs font-semibold ${STATUS_COLORS[voucher.status]}`}>
                        {STATUS_LABELS[voucher.status] || voucher.status?.toUpperCase()}
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>
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
                {/* Empty rows to fill page (Tally style) */}
                {Array.from({ length: Math.max(0, 10 - (voucher.items || []).length) }).map((_, i) => (
                  <tr key={`empty-${i}`} style={{ borderBottom: "1px solid #f3f4f6" }}>
                    <td className="px-2 py-2 text-center text-xs text-gray-200">{(voucher.items || []).length + i + 1}</td>
                    <td className="px-2 py-2">&nbsp;</td>
                    <td className="px-2 py-2">&nbsp;</td>
                    <td className="px-2 py-2">&nbsp;</td>
                    <td className="px-2 py-2">&nbsp;</td>
                    <td className="px-2 py-2">&nbsp;</td>
                    {hasDiscount && <td className="px-2 py-2">&nbsp;</td>}
                    <td className="px-2 py-2">&nbsp;</td>
                    <td className="px-2 py-2">&nbsp;</td>
                    <td className="px-2 py-2">&nbsp;</td>
                    <td className="px-2 py-2">&nbsp;</td>
                  </tr>
                ))}
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
