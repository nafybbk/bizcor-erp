import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { buildVoucherContext } from "@/lib/reportEngine/contextBuilder";
import ReportRenderer from "@/components/reportEngine/ReportRenderer";
import type { SavedTemplate } from "@/lib/reportEngine/types";
import { Loader2, Printer, FileDown, Star, Check, ChevronDown, X, LayoutTemplate, Wand2 } from "lucide-react";

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

const REPORT_TYPE_LABELS: Record<string, string> = {
  sales_invoice: "Sales Invoice",
  credit_note: "Credit Note",
  purchase_bill: "Purchase Bill",
  debit_note: "Debit Note",
};

function makeDefaultLayout() {
  return {
    bands: {
      pageHeader:     { height: 0,  elements: [] },
      documentHeader: { height: 80, elements: [] },
      detail:         { height: 8,  columns: [], elements: [] },
      documentFooter: { height: 60, elements: [] },
      pageFooter:     { height: 10, elements: [] },
    },
  };
}

export default function TemplatePrintModal({ voucherType, voucher, business, onClose, onFallback }: Props) {
  const reportType = VOUCHER_TO_REPORT[voucherType] || "sales_invoice";
  const lsKey = LS_KEY(voucherType);
  const qc = useQueryClient();

  const [selectedId, setSelectedId] = useState<number | null>(() => {
    const saved = localStorage.getItem(lsKey);
    return saved ? Number(saved) : null;
  });
  const [printing, setPrinting] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  // ── File-based template check (priority over DB) ───────────────────────────
  const { data: fileTemplate } = useQuery<SavedTemplate | null>({
    queryKey: ["template-file", reportType],
    queryFn: async () => {
      try { return await api.get<SavedTemplate>(`/template-files/${reportType}`); }
      catch { return null; }
    },
    retry: false,
    staleTime: 30_000,
  });

  const { data: templates = [], isLoading } = useQuery<SavedTemplate[]>({
    queryKey: ["report-templates", reportType],
    queryFn: () => api.get<SavedTemplate[]>(`/report-templates?report_type=${reportType}`),
    enabled: !fileTemplate, // Skip DB query if file template exists
  });

  const createDefault = useMutation({
    mutationFn: () =>
      api.post<SavedTemplate>("/report-templates", {
        name: `Basic ${REPORT_TYPE_LABELS[reportType] ?? "Invoice"}`,
        reportType,
        paperSize: "A4",
        orientation: "portrait",
        isDefault: true,
        layoutJson: makeDefaultLayout(),
      }),
    onSuccess: (created) => {
      qc.invalidateQueries({ queryKey: ["report-templates", reportType] });
      setSelectedId(created.id);
      localStorage.setItem(lsKey, String(created.id));
    },
  });

  // Auto-select: saved > default > first
  useEffect(() => {
    if (templates.length === 0) return;
    if (selectedId && templates.find(t => t.id === selectedId)) return;
    const def = templates.find(t => t.isDefault);
    setSelectedId(def ? def.id : templates[0].id);
  }, [templates]);

  // File template takes priority; falls back to DB selected
  const selected: SavedTemplate | null = fileTemplate || templates.find(t => t.id === selectedId) || null;

  function handleSelect(t: SavedTemplate) {
    setSelectedId(t.id);
    localStorage.setItem(lsKey, String(t.id));
  }

  function handlePrint() {
    if (!selected) return;
    if (!fileTemplate && selected.id) localStorage.setItem(lsKey, String(selected.id));
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
  if (showPreview && selected && context) {
    return (
      <>
        <style>{`
          @media screen {
            body > *:not(#template-print-overlay) { display: none !important; }
            #template-print-overlay { position: fixed; inset: 0; z-index: 9999; background: white; overflow: auto; display: flex; flex-direction: column; align-items: center; padding: 16px; }
            #template-print-overlay .print-toolbar { display: flex; gap: 8px; margin-bottom: 16px; }
          }
          @media print {
            body > *:not(#template-print-overlay) { display: none !important; }
            #template-print-overlay { position: fixed; inset: 0; }
            #template-print-overlay .print-toolbar { display: none !important; }
            #template-print-overlay .report-scale-wrap { transform: none !important; width: 100% !important; }
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
      </>
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

        {/* File template active banner */}
        {fileTemplate && (
          <div className="mx-4 mt-3 flex items-center gap-2 px-3 py-2 bg-green-50 border border-green-200 rounded-lg text-xs text-green-700 font-medium">
            <span>📁</span>
            <span>File Template Active — <code className="font-mono">{reportType}.json</code> use ho rahi hai</span>
          </div>
        )}

        {/* Template list — only shown when no file template */}
        <div className="px-4 py-3 max-h-72 overflow-y-auto space-y-1.5">
          {fileTemplate ? (
            <div className="text-center py-4 text-sm text-gray-500">
              File template se print hoga. DB templates override nahi kar sakte jab tak file nahi hatao.
            </div>
          ) : isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
            </div>
          ) : templates.length === 0 ? (
            <div className="text-center py-6">
              <LayoutTemplate className="w-8 h-8 text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-500 font-medium">Koi template nahi mili</p>
              <p className="text-xs text-gray-400 mt-1 mb-4">Ek basic template auto-banao ya Report Designer se design karo</p>
              <button
                onClick={() => createDefault.mutate()}
                disabled={createDefault.isPending}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-60"
              >
                {createDefault.isPending
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Bana raha hai…</>
                  : <><Wand2 className="w-4 h-4" /> Basic Template Auto-Banao</>}
              </button>
              {createDefault.isError && (
                <p className="text-xs text-red-500 mt-2">Error — dobara try karo</p>
              )}
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
                    <span className="text-sm font-medium text-gray-900 truncate">{t.name}</span>
                    {t.isDefault && (
                      <span className="flex items-center gap-0.5 text-xs text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-full border border-amber-200">
                        <Star className="w-2.5 h-2.5 fill-current" /> Default
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
        <div className="px-4 py-3 border-t border-gray-100 flex items-center gap-2">
          {(fileTemplate || templates.length > 0) ? (
            <>
              {!fileTemplate && (
                <button
                  onClick={onFallback}
                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  <FileDown className="w-4 h-4" /> Purana Style
                </button>
              )}
              <button
                onClick={handlePrint}
                disabled={!selected || printing}
                className="flex-2 flex items-center justify-center gap-1.5 px-5 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {printing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Printer className="w-4 h-4" />}
                Print Karo
              </button>
            </>
          ) : (
            <button
              onClick={onFallback}
              className="w-full flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <FileDown className="w-4 h-4" /> Default Print Karo
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
