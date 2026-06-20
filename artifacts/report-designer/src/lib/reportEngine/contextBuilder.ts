// ─── Context Builder ───────────────────────────────────────────────────────────
// Converts raw API data (voucher, party, business) into a flat ReportContext.
// This is the bridge between database data and the rendering engine.

import type { ReportContext, ReportItem } from './types';
import { amountInWords, formatDate } from './formulaEngine';

// ─── Business / Voucher data types from API ────────────────────────────────────
// (These mirror the shapes returned by the ERP API)
interface BusinessData {
  name?: string;
  address?: string;
  gstin?: string;
  phone?: string;
  email?: string;
  logoUrl?: string;
  state?: string;
  pincode?: string;
  pan?: string;
  signatoryName?: string;
  bankName?: string;
  bankAccount?: string;
  bankIfsc?: string;
  bankBranch?: string;
  invoiceFooter?: string;
}

interface PartyData {
  name?: string;
  address?: string;
  gstin?: string;
  phone?: string;
  email?: string;
  state?: string;
  pan?: string;
  city?: string;
}

interface VoucherData {
  voucherNumber?: string;
  date?: string;
  voucherType?: string;
  dueDate?: string;
  referenceNumber?: string;
  placeOfSupply?: string;
  notes?: string;
  termsAndConditions?: string;
  isInterState?: boolean;
  subTotal?: string | number;
  totalDiscount?: string | number;
  taxableAmount?: string | number;
  totalCgst?: string | number;
  totalSgst?: string | number;
  totalIgst?: string | number;
  totalTax?: string | number;
  transportCharges?: string | number;
  transportName?: string;
  roundOff?: string | number;
  grandTotal?: string | number;
  paidAmount?: string | number;
  items?: VoucherItemData[];
}

interface VoucherItemData {
  itemName?: string;
  description?: string;
  hsnCode?: string;
  quantity?: string | number;
  unit?: string;
  rate?: string | number;
  discount?: string | number;
  discountType?: string;
  taxableAmount?: string | number;
  taxRate?: string | number;
  cgst?: string | number;
  sgst?: string | number;
  igst?: string | number;
  taxAmount?: string | number;
  total?: string | number;
  serialNumbers?: string;
}

// ─── Voucher type → display label ─────────────────────────────────────────────
function voucherTypeLabel(type?: string): string {
  const map: Record<string, string> = {
    sales_invoice: 'Tax Invoice',
    purchase_bill: 'Purchase Bill',
    credit_note: 'Credit Note',
    debit_note: 'Debit Note',
  };
  return type ? (map[type] || type) : 'Invoice';
}

// ─── Build context from API data ───────────────────────────────────────────────
export function buildVoucherContext(
  business: BusinessData,
  party: PartyData,
  voucher: VoucherData
): ReportContext {
  const n = (v: string | number | undefined): number => Number(v) || 0;

  const grandTotal = n(voucher.grandTotal);
  const items: ReportItem[] = (voucher.items || []).map((item, idx) => ({
    sr_no: idx + 1,
    item_name: item.itemName || '',
    item_description: item.description || '',
    hsn_code: item.hsnCode || '',
    quantity: n(item.quantity),
    unit: item.unit || '',
    rate: n(item.rate),
    discount: n(item.discount),
    discount_type: item.discountType || 'percent',
    taxable_amount: n(item.taxableAmount),
    tax_rate: n(item.taxRate),
    cgst: n(item.cgst),
    sgst: n(item.sgst),
    igst: n(item.igst),
    tax_amount: n(item.taxAmount),
    total: n(item.total),
    serial_numbers: item.serialNumbers || '',
  }));

  const now = new Date();
  const printDate = formatDate(now.toISOString(), 'DD-MM-YYYY');

  return {
    // Company
    company_name: business.name || '',
    company_address: business.address || '',
    company_gstin: business.gstin || '',
    company_phone: business.phone || '',
    company_email: business.email || '',
    company_logo: business.logoUrl || '',
    company_state: business.state || '',
    company_pincode: business.pincode || '',
    company_pan: business.pan || '',
    signatory_name: business.signatoryName || '',
    bank_name: business.bankName || '',
    bank_account: business.bankAccount || '',
    bank_ifsc: business.bankIfsc || '',
    bank_branch: business.bankBranch || '',
    invoice_footer: business.invoiceFooter || '',

    // Party
    party_name: party.name || '',
    party_address: party.address || '',
    party_gstin: party.gstin || '',
    party_phone: party.phone || '',
    party_email: party.email || '',
    party_state: party.state || '',
    party_pan: party.pan || '',
    party_city: party.city || '',

    // Invoice
    invoice_number: voucher.voucherNumber || '',
    invoice_date: voucher.date || '',
    invoice_type: voucherTypeLabel(voucher.voucherType),
    due_date: voucher.dueDate || '',
    reference_number: voucher.referenceNumber || '',
    place_of_supply: voucher.placeOfSupply || '',
    notes: voucher.notes || '',
    terms_and_conditions: voucher.termsAndConditions || '',
    is_inter_state: !!voucher.isInterState,
    transport_name: voucher.transportName || '',
    dispatch_mode: '',

    // Totals
    sub_total: n(voucher.subTotal),
    total_discount: n(voucher.totalDiscount),
    taxable_amount: n(voucher.taxableAmount),
    total_cgst: n(voucher.totalCgst),
    total_sgst: n(voucher.totalSgst),
    total_igst: n(voucher.totalIgst),
    total_tax: n(voucher.totalTax),
    transport_charges: n(voucher.transportCharges),
    round_off: n(voucher.roundOff),
    grand_total: grandTotal,
    paid_amount: n(voucher.paidAmount),
    amount_in_words: amountInWords(grandTotal),

    // System
    page_number: 1,
    total_pages: 1,
    print_date: printDate,
    qr_code: '',

    // Items
    items,
  };
}
