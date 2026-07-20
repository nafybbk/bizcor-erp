import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { buildVoucherContext } from "@/lib/reportEngine/contextBuilder";
import ReportRenderer from "@/components/reportEngine/ReportRenderer";
import type { SavedTemplate } from "@/lib/reportEngine/types";
import { Loader2, Printer, Star, Check, X, LayoutTemplate } from "lucide-react";

// ─── voucherType → reportType mapping ────────────────────────────────────────
const VOUCHER_TO_REPORT: Record<string, string> = {
  "sales/invoices": "sales_invoice",
  "sales/credit-notes": "credit_note",
  "purchases/bills": "purchase_bill",
  "purchases/debit-notes": "debit_note",
};

const LS_KEY = (voucherType: string) => `erp_print_template_${voucherType.replace(/\//g, "_")}`;

interface Props {
  voucherType: string;
  voucher: any;
  business: any;
  onClose: () => void;
  onFallback: () => void; // called if user wants old-style print
}

export default function TemplatePrintModal({ voucherType, voucher, business, onClose, onFallback }: Props) {
  const reportType = VOUCHER_TO_REPORT[voucherType] || "sales_invoice";
  const lsKey = LS_KEY(voucherType);

  // "Default" is NOT a DB template: it's the app's original built-in invoice
  // (the exact layout every live install prints today), routed through the
  // classic print path — so it can never drift, never be edited, never be
  // deleted, and always matches the cloud/EXE release pixel-for-pixel.
  const ORIGINAL = "original";

  const [selectedId, setSelectedId] = useState<number | typeof ORIGINAL>(() => {
    const saved = localStorage.getItem(lsKey);
    if (!saved || saved === ORIGINAL) return ORIGINAL;
    const n = Number(saved);
    return Number.isFinite(n) && n > 0 ? n : ORIGINAL;
  });
  const [printing, setPrinting] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  // Custom DB templates (SI / SIT) — any legacy row literally named "Default"
  // is hidden, that slot belongs to the built-in original. Always fetched
  // fresh: templates get edited in the designer's popup window, whose
  // cache-invalidations never reach this window.
  const { data: allTemplates = [], isLoading } = useQuery<SavedTemplate[]>({
    queryKey: ["report-templates", reportType],
    queryFn: () => api.get<SavedTemplate[]>(`/report-templates?report_type=${reportType}`),
    staleTime: 0,
    refetchOnWindowFocus: "always",
  });
  const templates = allTemplates.filter(t => t.name !== "Default");

  // Saved selection points to a template that no longer exists → back to Default
  useEffect(() => {
    if (selectedId !== ORIGINAL && !isLoading && !templates.find(t => t.id === selectedId)) {
      setSelectedId(ORIGINAL);
    }
  }, [templates, isLoading, selectedId]);

  const selected: SavedTemplate | null = selectedId === ORIGINAL ? null : templates.find(t => t.id === selectedId) || null;

  function handleSelect(t: SavedTemplate) {
    setSelectedId(t.id);
    localStorage.setItem(lsKey, String(t.id));
  }

  function handlePrint() {
    localStorage.setItem(lsKey, String(selectedId));
    if (selectedId === ORIGINAL) {
      onFallback(); // classic built-in invoice — the original, untouched
      return;
    }
    if (!selected) return;
    setShowPreview(true);
    setPrinting(true);
    setTimeout(() => {
      window.print();
      setPrinting(false);
    }, 300);
  }

  // Build real context from voucher + business data
  const context = voucher && business ? buildVoucherContext(
    {
      name: business.name,
      address: [business.address, business.city, business.state, business.pincode].filter(Boolean).join(", "),
      gstin: business.gstin,
      phone: business.phone,
      email: business.email,
      logoUrl: business.logo || business.logoUrl,
      state: business.state,
      pincode: business.pincode,
      pan: business.pan,
      signatoryName: business.signatoryName,
      bankName: business.bankName,
      bankAccount: business.bankAccount,
      bankIfsc: business.bankIfsc,
      bankBranch: business.bankBranch,
      invoiceFooter: business.invoiceFooter,
    },
    {
      name: voucher.partyName,
      address: voucher.partyAddress,
      gstin: voucher.partyGstin,
      phone: voucher.partyPhone,
      email: voucher.partyEmail,
      state: voucher.partyState,
      city: voucher.partyCity,
      pan: voucher.partyPan,
    },
    {
      voucherNumber: voucher.voucherNumber,
      date: voucher.date,
      voucherType: reportType,
      dueDate: voucher.dueDate,
      referenceNumber: voucher.referenceNumber || voucher.poNumber,
      placeOfSupply: voucher.placeOfSupply,
      notes: voucher.notes,
      termsAndConditions: voucher.termsAndConditions,
      isInterState: voucher.isInterState,
      subTotal: voucher.subTotal,
      totalDiscount: voucher.totalDiscount,
      taxableAmount: voucher.taxableAmount,
      totalCgst: voucher.totalCgst,
      totalSgst: voucher.totalSgst,
      totalIgst: voucher.totalIgst,
      totalTax: voucher.totalTax,
      transportCharges: voucher.transportCharges,
      transportName: voucher.transportName,
      roundOff: voucher.roundOff,
      grandTotal: voucher.grandTotal,
      paidAmount: voucher.paidAmount,
      items: (voucher.items || []).map((item: any) => ({
        itemName: item.itemName || item.name,
        description: item.description,
        hsnCode: item.hsnCode,
        quantity: item.quantity,
        unit: item.unit,
        rate: item.rate,
        discount: item.discount,
        discountType: item.discountType,
        taxableAmount: item.taxableAmount,
        taxRate: item.taxRate,
        cgst: item.cgst,
        sgst: item.sgst,
        igst: item.igst,
        taxAmount: item.taxAmount,
        total: item.total,
        serialNumbers: item.serialNumbers,
      })),
    }
  ) : null;

  // ─── Print mode — full screen renderer ────────────────────────────────────
  // Portaled to <body>: the overlay CSS hides every OTHER direct child of
  // body (i.e. #root) during preview/print — rendered inside #root it would
  // hide itself too, printing a blank page.
  if (showPreview && selected && context) {
    return createPortal(
      <>
        <style>{`
          @media screen {
            body > *:not(#template-print-overlay) { display: none !important; }
            #template-print-overlay { position: fixed; inset: 0; z-index: 9999; background: white; overflow: auto; display: flex; flex-direction: column; align-items: center; padding: 16px; }
            #template-print-overlay .print-toolbar { display: flex; gap: 8px; margin-bottom: 16px; }
          }
          @media print {
            /* Same visibility+absolute pattern the classic voucher print uses —
               position:fixed prints as a blank page in Chromium (the document
               itself has zero height once everything else is display:none). */
            body * { visibility: hidden !important; }
            #template-print-overlay, #template-print-overlay * { visibility: visible !important; }
            #template-print-overlay { position: absolute !important; inset: auto !important; top: 0 !important; left: 0 !important; right: 0 !important; overflow: visible !important; padding: 0 !important; display: block !important; background: white !important; }
            #template-print-overlay .print-toolbar { display: none !important; }
            #template-print-overlay .report-scale-wrap { transform: none !important; }
          }
        `}</style>
        <div id="template-print-overlay">
          <div className="print-toolbar no-print">
            <button
              onClick={() => { setShowPreview(false); setPrinting(false); }}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              <X className="w-4 h-4" /> Wapas jao
            </button>
            <button
              onClick={() => window.print()}
              className="flex items-center gap-1.5 px-4 py-1.5 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <Printer className="w-4 h-4" /> Print / PDF
            </button>
          </div>
          <div className="report-scale-wrap" ref={printRef}>
            <ReportRenderer
              template={selected}
              context={context}
              scale={1}
            />
          </div>
        </div>
      </>,
      document.body
    );
  }

  // ─── Template selector modal ───────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <LayoutTemplate className="w-5 h-5 text-blue-600" />
            <div>
              <div className="font-semibold text-gray-900 text-sm">Print Template Chuniye</div>
              <div className="text-xs text-gray-400 mt-0.5">Ek baar select karo — next time automatically yaad rahega</div>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Template list — built-in Default first, then custom SI / SIT */}
        <div className="px-4 py-3 max-h-72 overflow-y-auto space-y-1.5">
          <button
            onClick={() => { setSelectedId(ORIGINAL); localStorage.setItem(lsKey, ORIGINAL); }}
            className={`w-full text-left flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-all ${
              selectedId === ORIGINAL
                ? "border-blue-500 bg-blue-50"
                : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
            }`}
          >
            <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
              selectedId === ORIGINAL ? "border-blue-500 bg-blue-500" : "border-gray-300"
            }`}>
              {selectedId === ORIGINAL && <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-medium text-gray-900">Default</span>
                <span className="flex items-center gap-0.5 text-xs text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-full border border-amber-200">
                  <Star className="w-2.5 h-2.5 fill-current" /> Original
                </span>
              </div>
              <div className="text-xs text-gray-400 mt-0.5">
                App ki asli built-in invoice — kabhi change nahi hoti
              </div>
            </div>
          </button>

          {isLoading ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
            </div>
          ) : templates.length === 0 ? (
            <div className="text-center py-3 text-xs text-gray-400">
              Koi custom template nahi — Report Designer se banao (SI01, SIT01...)
            </div>
          ) : (
            templates.map(t => (
              <button
                key={t.id}
                onClick={() => handleSelect(t)}
                className={`w-full text-left flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-all ${
                  selectedId === t.id
                    ? "border-blue-500 bg-blue-50"
                    : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                }`}
              >
                <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                  selectedId === t.id ? "border-blue-500 bg-blue-500" : "border-gray-300"
                }`}>
                  {selectedId === t.id && <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-medium text-gray-900 truncate font-mono">{t.name}</span>
                    {t.isDefault && (
                      <span className="flex items-center gap-0.5 text-xs text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-full border border-amber-200">
                        <Star className="w-2.5 h-2.5 fill-current" /> Active
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-gray-400 mt-0.5">
                    {t.paperSize} · {t.orientation} · v{t.version}
                  </div>
                </div>
              </button>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-gray-100">
          <button
            onClick={handlePrint}
            disabled={printing || (selectedId !== ORIGINAL && !selected)}
            className="w-full flex items-center justify-center gap-1.5 px-5 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {printing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Printer className="w-4 h-4" />}
            Print Karo
          </button>
        </div>
      </div>
    </div>
  );
}
