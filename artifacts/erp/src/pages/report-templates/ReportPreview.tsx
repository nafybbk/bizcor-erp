import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { ArrowLeft, ZoomIn, ZoomOut, Printer, Edit2, Loader2 } from "lucide-react";
import ReportRenderer from "@/components/reportEngine/ReportRenderer";
import { buildVoucherContext } from "@/lib/reportEngine/contextBuilder";
import type { SavedTemplate, ReportContext } from "@/lib/reportEngine/types";

// ─── Sample demo context ─────────────────────────────────────────────────────
function buildDemoContext(): ReportContext {
  return buildVoucherContext(
    {
      name: 'Adeena Handloom',
      address: 'Shop No. 5, Textile Market, Ring Road, Surat - 395002',
      gstin: '24AAFFA1234A1Z5',
      phone: '+91 99999 11111',
      email: 'info@adeenahandloom.com',
      state: 'Gujarat',
      pincode: '395002',
      signatoryName: 'Mohd. Adeena',
      bankName: 'State Bank of India',
      bankAccount: '123456789012',
      bankIfsc: 'SBIN0001234',
      bankBranch: 'Surat Main',
      invoiceFooter: 'Thank you for your business! All disputes subject to Surat jurisdiction.',
    },
    {
      name: 'ABC Fabrics Pvt. Ltd.',
      address: '201-A, Bhuleshwar, Mumbai - 400002',
      gstin: '27AABCA1234B1Z6',
      phone: '+91 88888 22222',
      email: 'purchase@abcfabrics.com',
      state: 'Maharashtra',
      city: 'Mumbai',
      pan: 'AABCA1234B',
    },
    {
      voucherNumber: 'SI-2425-0042',
      date: '2026-06-01',
      voucherType: 'sales_invoice',
      referenceNumber: 'PO-2026-108',
      placeOfSupply: 'Maharashtra (27)',
      isInterState: true,
      termsAndConditions: 'Payment due within 30 days. Goods once sold will not be taken back.',
      notes: 'Delivery via DTDC Courier',
      subTotal: '45000.00',
      totalDiscount: '2250.00',
      taxableAmount: '42750.00',
      totalCgst: '0.00',
      totalSgst: '0.00',
      totalIgst: '2137.50',
      totalTax: '2137.50',
      transportCharges: '350.00',
      roundOff: '-0.50',
      grandTotal: '45237.00',
      paidAmount: '0.00',
      items: [
        { itemName: 'Cotton Saree - Red', hsnCode: '5208', quantity: '50', unit: 'PCS', rate: '450.00', discount: '5', discountType: 'percent', taxableAmount: '21375.00', taxRate: '5', cgst: '0', sgst: '0', igst: '1068.75', taxAmount: '1068.75', total: '22443.75' },
        { itemName: 'Silk Dupatta - Blue', hsnCode: '5007', quantity: '30', unit: 'PCS', rate: '350.00', discount: '0', discountType: 'percent', taxableAmount: '10500.00', taxRate: '5', cgst: '0', sgst: '0', igst: '525.00', taxAmount: '525.00', total: '11025.00' },
        { itemName: 'Handloom Bedsheet - King', hsnCode: '6302', quantity: '20', unit: 'PCS', rate: '540.00', discount: '5', discountType: 'percent', taxableAmount: '10260.00', taxRate: '5', cgst: '0', sgst: '0', igst: '513.00', taxAmount: '513.00', total: '10773.00' },
        { itemName: 'Kurta Fabric - Mixed', hsnCode: '5208', quantity: '25', unit: 'MTR', rate: '185.00', discount: '0', discountType: 'percent', taxableAmount: '4625.00', taxRate: '0', cgst: '0', sgst: '0', igst: '0', taxAmount: '0', total: '4625.00' },
      ],
    }
  );
}

export default function ReportPreview() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const isAdmin = user?.role !== 'staff';
  const [scale, setScale] = useState(0.85);

  const { data: template, isLoading, error } = useQuery<SavedTemplate>({
    queryKey: ['report-template', id],
    queryFn: () => api.get<SavedTemplate>(`/report-templates/${id}`),
    enabled: !!id,
  });

  const context = buildDemoContext();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
      </div>
    );
  }

  if (error || !template) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <p className="text-red-500">Template load nahi hua</p>
        <Link href="/report-templates">
          <a className="text-blue-600 text-sm underline">Templates par wapas jao</a>
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Toolbar */}
      <div className="print:hidden sticky top-0 z-50 bg-white border-b border-gray-200 px-4 py-2 flex items-center gap-3">
        <Link href="/report-templates">
          <a className="p-1.5 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors">
            <ArrowLeft className="w-4 h-4" />
          </a>
        </Link>

        <div className="flex-1 min-w-0">
          <span className="font-medium text-gray-900 text-sm">{template.name}</span>
          <span className="text-gray-400 text-xs ml-2">v{template.version} · {template.paperSize} · {template.orientation}</span>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => setScale(s => Math.max(0.4, +(s - 0.1).toFixed(1)))}
            className="p-1.5 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <span className="text-xs text-gray-500 w-12 text-center">{Math.round(scale * 100)}%</span>
          <button
            onClick={() => setScale(s => Math.min(1.5, +(s + 0.1).toFixed(1)))}
            className="p-1.5 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
        </div>

        {isAdmin && (
          <Link href={`/report-templates/${id}/edit`}>
            <a className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
              <Edit2 className="w-3.5 h-3.5" />
              Edit
            </a>
          </Link>
        )}

        <button
          onClick={() => window.print()}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Printer className="w-3.5 h-3.5" />
          Print / PDF
        </button>
      </div>

      {/* Preview (screen only — zoomable) */}
      <div className="p-6 flex justify-center print:p-0">
        <ReportRenderer
          template={template}
          context={context}
          scale={scale}
        />
      </div>

      {/* Print-only copy at 100% scale — the screen preview is zoom-scaled
          and buried inside the app shell's overflow-hidden containers, which
          prints as a blank page; this copy uses the same visibility trick the
          voucher print already relies on. */}
      <div id="report-print-area">
        <ReportRenderer template={template} context={context} scale={1} />
      </div>

      <style>{`
        #report-print-area { display: none; }
        @media print {
          body * { visibility: hidden !important; }
          #report-print-area, #report-print-area * { visibility: visible !important; }
          #report-print-area { display: block !important; position: absolute; top: 0; left: 0; right: 0; background: white; }
          body { background: white; }
        }
      `}</style>
    </div>
  );
}
