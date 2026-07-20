// ─── Report Template JSON Types ───────────────────────────────────────────────
// Generic enterprise reporting engine — works for ANY report type

export type PaperSize = 'A4' | 'A5' | '80mm' | '58mm';
export type Orientation = 'portrait' | 'landscape';
export type TextAlign = 'left' | 'center' | 'right';
export type FontWeight = 'normal' | 'bold';
export type FontStyle = 'normal' | 'italic';
export type BorderStyle = 'none' | 'solid' | 'dashed' | 'dotted';

export interface ElementStyle {
  fontSize?: number;           // in pt
  fontWeight?: FontWeight;
  fontStyle?: FontStyle;
  textAlign?: TextAlign;
  color?: string;              // hex color
  backgroundColor?: string;
  borderTop?: string;
  borderRight?: string;
  borderBottom?: string;
  borderLeft?: string;
  border?: string;             // shorthand
  padding?: number;            // mm
  lineHeight?: number;
  wordBreak?: 'normal' | 'break-all' | 'break-word';
}

// ─── Base Element ──────────────────────────────────────────────────────────────
export interface BaseElement {
  id: string;
  type: string;
  x: number;       // mm from left of band
  y: number;       // mm from top of band
  width: number;   // mm
  height: number;  // mm
  visibleIf?: string;   // condition: e.g. "gstin != null", "discount > 0"
  style?: ElementStyle;
  zIndex?: number;
}

// ─── Text Element — static text ───────────────────────────────────────────────
export interface TextElement extends BaseElement {
  type: 'text';
  content: string;   // static string, may include \n
}

// ─── Field Element — dynamic data field ───────────────────────────────────────
export interface FieldElement extends BaseElement {
  type: 'field';
  field: string;          // from fieldRegistry: e.g. "company_name"
  format?: string;        // date format or number format: e.g. "DD-MM-YYYY", "0.00"
  nullText?: string;      // what to show when null/empty
}

// ─── Formula Element — computed value ─────────────────────────────────────────
export interface FormulaElement extends BaseElement {
  type: 'formula';
  formula: string;        // e.g. "{sub_total} + {total_cgst} + {total_sgst}"
  format?: string;        // number format
}

// ─── Image Element — static or dynamic image ──────────────────────────────────
export interface ImageElement extends BaseElement {
  type: 'image';
  source: string;         // field key (e.g. "company_logo") or static URL
  objectFit?: 'contain' | 'cover' | 'fill';
}

// ─── Line Element — horizontal or vertical rule ───────────────────────────────
export interface LineElement extends BaseElement {
  type: 'line';
  direction: 'horizontal' | 'vertical';
  color?: string;
  thickness?: number;     // mm
}

// ─── Box Element — rectangle / bordered box ───────────────────────────────────
export interface BoxElement extends BaseElement {
  type: 'box';
}

// ─── Table Column definition ───────────────────────────────────────────────────
export interface TableColumn {
  id: string;
  field: string;          // item field: e.g. "item_name", "quantity"
  label: string;          // column header text
  width: number;          // mm
  align?: TextAlign;
  headerAlign?: TextAlign;
  format?: string;
  visibleIf?: string;     // e.g. "discount > 0"
  style?: ElementStyle;
  headerStyle?: ElementStyle;
}

// ─── Table Element — repeating data table ─────────────────────────────────────
export interface TableElement extends BaseElement {
  type: 'table';
  dataSource: string;           // e.g. "items"
  columns: TableColumn[];
  rowHeight?: number;           // mm per row
  showHeader?: boolean;
  headerHeight?: number;        // mm
  headerStyle?: ElementStyle;
  rowStyle?: ElementStyle;
  alternateRowStyle?: ElementStyle;
  emptyRows?: number;           // blank rows to show when item count is less
}

// ─── QR Code Element ──────────────────────────────────────────────────────────
export interface QrCodeElement extends BaseElement {
  type: 'qrcode';
  content: string;        // formula/field: e.g. "{invoice_number}"
}

// ─── Union of all element types ───────────────────────────────────────────────
export type TemplateElement =
  | TextElement
  | FieldElement
  | FormulaElement
  | ImageElement
  | LineElement
  | BoxElement
  | TableElement
  | QrCodeElement;

// ─── Band — a horizontal section of the report ────────────────────────────────
export interface Band {
  height: number;              // mm — fixed height for this band
  visible?: boolean;           // default true
  visibleIf?: string;          // condition for entire band
  backgroundColor?: string;
  elements: TemplateElement[];
}

// ─── Detail Band — repeating section for data arrays ─────────────────────────
export interface DetailBand {
  visible?: boolean;
  elements: TemplateElement[];  // usually a TableElement
}

// ─── All 5 Bands ──────────────────────────────────────────────────────────────
export interface TemplateBands {
  pageHeader: Band;       // repeats on every page
  documentHeader: Band;   // first page only (firm info, party, dates)
  detail: DetailBand;     // repeating rows (items)
  documentFooter: Band;   // last page only (totals, GST, terms)
  pageFooter: Band;       // repeats on every page (page number, branding)
}

// ─── Complete Template Layout JSON ────────────────────────────────────────────
export interface TemplateLayout {
  bands: TemplateBands;
  margin?: {
    top: number;
    right: number;
    bottom: number;
    left: number;
  };
}

// ─── Saved Template (from DB) ─────────────────────────────────────────────────
export interface SavedTemplate {
  id: number;
  businessId: number;
  name: string;
  reportType: string;
  paperSize: PaperSize;
  orientation: Orientation;
  version: number;
  isDefault: boolean;
  // Frozen (name is SIT.. or "Default") — can't be overwritten, only forked
  // into a new editable SI.. via "Use as New".
  locked: boolean;
  layoutJson: TemplateLayout | null;
  createdByUserId: number | null;
  createdAt: string;
  updatedAt: string;
}

// ─── Data Context (what gets passed to renderer) ──────────────────────────────
export interface ReportContext {
  // Company / Business fields
  company_name?: string;
  company_address?: string;
  company_gstin?: string;
  company_phone?: string;
  company_email?: string;
  company_logo?: string;
  company_state?: string;
  company_pincode?: string;
  company_pan?: string;
  signatory_name?: string;
  bank_name?: string;
  bank_account?: string;
  bank_ifsc?: string;
  bank_branch?: string;
  invoice_footer?: string;

  // Party / Customer fields
  party_name?: string;
  party_address?: string;
  party_gstin?: string;
  party_phone?: string;
  party_email?: string;
  party_state?: string;
  party_pan?: string;
  party_city?: string;

  // Invoice / Voucher fields
  invoice_number?: string;
  invoice_date?: string;
  invoice_type?: string;
  due_date?: string;
  reference_number?: string;
  place_of_supply?: string;
  notes?: string;
  terms_and_conditions?: string;
  is_inter_state?: boolean;

  // Totals / GST
  sub_total?: number;
  total_discount?: number;
  taxable_amount?: number;
  total_cgst?: number;
  total_sgst?: number;
  total_igst?: number;
  total_tax?: number;
  transport_charges?: number;
  transport_name?: string;
  round_off?: number;
  grand_total?: number;
  paid_amount?: number;
  amount_in_words?: string;

  // Transport
  dispatch_mode?: string;
  destination?: string;
  lr_no?: string;

  // System
  page_number?: number;
  total_pages?: number;
  print_date?: string;
  qr_code?: string;

  // Items array (for repeating table)
  items?: ReportItem[];

  // Allow any additional fields (extensible)
  [key: string]: unknown;
}

export interface ReportItem {
  sr_no?: number;
  item_name?: string;
  item_description?: string;
  hsn_code?: string;
  quantity?: number;
  unit?: string;
  rate?: number;
  discount?: number;
  discount_type?: string;
  taxable_amount?: number;
  tax_rate?: number;
  cgst?: number;
  sgst?: number;
  igst?: number;
  tax_amount?: number;
  total?: number;
  serial_numbers?: string;
  [key: string]: unknown;
}

// ─── Report Type Registry ─────────────────────────────────────────────────────
export interface ReportTypeInfo {
  key: string;
  label: string;
  description: string;
  defaultDataSource?: string;
}

export const REPORT_TYPES: ReportTypeInfo[] = [
  { key: 'sales_invoice', label: 'Sales Invoice', description: 'GST Sales Invoice', defaultDataSource: 'voucher' },
  { key: 'purchase_bill', label: 'Purchase Bill', description: 'Purchase Invoice / Bill', defaultDataSource: 'voucher' },
  { key: 'credit_note', label: 'Credit Note', description: 'Sales Return / Credit Note', defaultDataSource: 'voucher' },
  { key: 'debit_note', label: 'Debit Note', description: 'Purchase Return / Debit Note', defaultDataSource: 'voucher' },
  { key: 'receipt', label: 'Receipt', description: 'Payment Receipt', defaultDataSource: 'payment' },
  { key: 'payment', label: 'Payment', description: 'Payment Voucher', defaultDataSource: 'payment' },
  { key: 'quotation', label: 'Quotation', description: 'Sales Quotation / Estimate', defaultDataSource: 'voucher' },
  { key: 'delivery_challan', label: 'Delivery Challan', description: 'Goods delivery challan', defaultDataSource: 'voucher' },
  { key: 'ledger', label: 'Ledger Report', description: 'Party ledger statement', defaultDataSource: 'ledger' },
  { key: 'stock_report', label: 'Stock Report', description: 'Inventory stock report', defaultDataSource: 'stock' },
  { key: 'transport_challan', label: 'Transport Challan', description: 'Transport/LR challan', defaultDataSource: 'voucher' },
  { key: 'production_report', label: 'Production Report', description: 'Production order report', defaultDataSource: 'production' },
];
