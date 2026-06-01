// ─── Master Field Registry ────────────────────────────────────────────────────
// Central registry of all available fields.
// When a new module is added, add its fields here — designer picks them up automatically.

export type FieldType = 'text' | 'number' | 'date' | 'image' | 'boolean' | 'currency';

export interface FieldDef {
  key: string;
  label: string;
  description: string;
  type: FieldType;
  format?: string;   // default format hint
  example?: string;
}

export interface FieldCategory {
  key: string;
  label: string;
  icon: string;
  fields: FieldDef[];
}

export const FIELD_REGISTRY: FieldCategory[] = [
  {
    key: 'company',
    label: 'Company',
    icon: '🏢',
    fields: [
      { key: 'company_name', label: 'Company Name', description: 'Business name', type: 'text', example: 'Adeena Handloom' },
      { key: 'company_address', label: 'Address', description: 'Full business address', type: 'text', example: '123 Main St, Surat' },
      { key: 'company_gstin', label: 'GSTIN', description: 'GST registration number', type: 'text', example: '24ABCDE1234F1Z5' },
      { key: 'company_phone', label: 'Phone', description: 'Business phone number', type: 'text', example: '+91 99999 00000' },
      { key: 'company_email', label: 'Email', description: 'Business email address', type: 'text', example: 'info@business.com' },
      { key: 'company_logo', label: 'Company Logo', description: 'Business logo image', type: 'image' },
      { key: 'company_state', label: 'State', description: 'Business state', type: 'text', example: 'Gujarat' },
      { key: 'company_pincode', label: 'Pincode', description: 'Business pincode', type: 'text', example: '395001' },
      { key: 'company_pan', label: 'PAN', description: 'Business PAN number', type: 'text', example: 'ABCDE1234F' },
      { key: 'signatory_name', label: 'Signatory Name', description: 'Authorized signatory name', type: 'text', example: 'Owner Name' },
    ],
  },
  {
    key: 'bank',
    label: 'Bank Details',
    icon: '🏦',
    fields: [
      { key: 'bank_name', label: 'Bank Name', description: 'Bank name', type: 'text', example: 'SBI' },
      { key: 'bank_account', label: 'Account No.', description: 'Bank account number', type: 'text', example: '1234567890' },
      { key: 'bank_ifsc', label: 'IFSC Code', description: 'Bank IFSC code', type: 'text', example: 'SBIN0001234' },
      { key: 'bank_branch', label: 'Branch', description: 'Bank branch name', type: 'text', example: 'Surat Main' },
      { key: 'invoice_footer', label: 'Invoice Footer Note', description: 'Custom footer text', type: 'text' },
    ],
  },
  {
    key: 'customer',
    label: 'Customer / Party',
    icon: '👤',
    fields: [
      { key: 'party_name', label: 'Party Name', description: 'Customer or vendor name', type: 'text', example: 'ABC Traders' },
      { key: 'party_address', label: 'Address', description: 'Party full address', type: 'text', example: '456 Market Road, Mumbai' },
      { key: 'party_gstin', label: 'GSTIN', description: 'Party GST number', type: 'text', example: '27XYZAB5678G1Z3' },
      { key: 'party_phone', label: 'Phone', description: 'Party phone number', type: 'text', example: '+91 88888 11111' },
      { key: 'party_email', label: 'Email', description: 'Party email address', type: 'text', example: 'contact@abc.com' },
      { key: 'party_state', label: 'State', description: 'Party state', type: 'text', example: 'Maharashtra' },
      { key: 'party_pan', label: 'PAN', description: 'Party PAN number', type: 'text', example: 'XYZAB5678G' },
      { key: 'party_city', label: 'City', description: 'Party city', type: 'text', example: 'Mumbai' },
    ],
  },
  {
    key: 'invoice',
    label: 'Invoice / Voucher',
    icon: '📄',
    fields: [
      { key: 'invoice_number', label: 'Invoice Number', description: 'Voucher number', type: 'text', example: 'SI-2425-0001' },
      { key: 'invoice_date', label: 'Invoice Date', description: 'Voucher date', type: 'date', format: 'DD-MM-YYYY', example: '01-06-2026' },
      { key: 'invoice_type', label: 'Invoice Type', description: 'Type of voucher', type: 'text', example: 'Tax Invoice' },
      { key: 'due_date', label: 'Due Date', description: 'Payment due date', type: 'date', format: 'DD-MM-YYYY' },
      { key: 'reference_number', label: 'Reference No.', description: 'PO or reference number', type: 'text' },
      { key: 'place_of_supply', label: 'Place of Supply', description: 'State of supply', type: 'text', example: 'Maharashtra (27)' },
      { key: 'notes', label: 'Notes', description: 'Remarks / notes', type: 'text' },
      { key: 'terms_and_conditions', label: 'Terms & Conditions', description: 'T&C text', type: 'text' },
      { key: 'dispatch_mode', label: 'Dispatch Mode', description: 'Transport mode', type: 'text', example: 'Road' },
      { key: 'transport_name', label: 'Transport Name', description: 'Transporter name', type: 'text' },
      { key: 'transport_charges', label: 'Transport Charges', description: 'Freight/transport cost', type: 'currency', format: '0.00' },
    ],
  },
  {
    key: 'items',
    label: 'Item Fields',
    icon: '📦',
    fields: [
      { key: 'sr_no', label: 'Sr. No.', description: 'Serial number of item row', type: 'number', format: '0' },
      { key: 'item_name', label: 'Item Name', description: 'Product or service name', type: 'text' },
      { key: 'item_description', label: 'Description', description: 'Item description', type: 'text' },
      { key: 'hsn_code', label: 'HSN / SAC', description: 'HSN or SAC code', type: 'text' },
      { key: 'quantity', label: 'Quantity', description: 'Item quantity', type: 'number', format: '0.00' },
      { key: 'unit', label: 'Unit', description: 'Unit of measure', type: 'text', example: 'PCS' },
      { key: 'rate', label: 'Rate', description: 'Unit rate / price', type: 'currency', format: '0.00' },
      { key: 'discount', label: 'Discount', description: 'Discount amount or %', type: 'number', format: '0.00' },
      { key: 'taxable_amount', label: 'Taxable Amount', description: 'Taxable value per item', type: 'currency', format: '0.00' },
      { key: 'tax_rate', label: 'Tax Rate %', description: 'GST rate percentage', type: 'number', format: '0' },
      { key: 'cgst', label: 'CGST', description: 'CGST amount per item', type: 'currency', format: '0.00' },
      { key: 'sgst', label: 'SGST', description: 'SGST amount per item', type: 'currency', format: '0.00' },
      { key: 'igst', label: 'IGST', description: 'IGST amount per item', type: 'currency', format: '0.00' },
      { key: 'tax_amount', label: 'Tax Amount', description: 'Total tax per item', type: 'currency', format: '0.00' },
      { key: 'total', label: 'Total', description: 'Item total (after tax)', type: 'currency', format: '0.00' },
      { key: 'serial_numbers', label: 'Serial Numbers', description: 'Item serial numbers', type: 'text' },
    ],
  },
  {
    key: 'gst',
    label: 'GST & Totals',
    icon: '💰',
    fields: [
      { key: 'sub_total', label: 'Sub Total', description: 'Total before discount', type: 'currency', format: '0.00' },
      { key: 'total_discount', label: 'Total Discount', description: 'Total discount amount', type: 'currency', format: '0.00' },
      { key: 'taxable_amount', label: 'Taxable Amount', description: 'Total taxable value', type: 'currency', format: '0.00' },
      { key: 'total_cgst', label: 'Total CGST', description: 'Total CGST amount', type: 'currency', format: '0.00' },
      { key: 'total_sgst', label: 'Total SGST', description: 'Total SGST amount', type: 'currency', format: '0.00' },
      { key: 'total_igst', label: 'Total IGST', description: 'Total IGST amount', type: 'currency', format: '0.00' },
      { key: 'total_tax', label: 'Total Tax', description: 'Total tax amount', type: 'currency', format: '0.00' },
      { key: 'transport_charges', label: 'Transport Charges', description: 'Freight charges', type: 'currency', format: '0.00' },
      { key: 'round_off', label: 'Round Off', description: 'Rounding difference', type: 'currency', format: '0.00' },
      { key: 'grand_total', label: 'Grand Total', description: 'Final payable amount', type: 'currency', format: '0.00' },
      { key: 'paid_amount', label: 'Paid Amount', description: 'Amount already paid', type: 'currency', format: '0.00' },
      { key: 'amount_in_words', label: 'Amount in Words', description: 'Grand total in words (Hindi/English)', type: 'text' },
    ],
  },
  {
    key: 'system',
    label: 'System',
    icon: '⚙️',
    fields: [
      { key: 'page_number', label: 'Page Number', description: 'Current page number', type: 'number', format: '0' },
      { key: 'total_pages', label: 'Total Pages', description: 'Total pages in document', type: 'number', format: '0' },
      { key: 'print_date', label: 'Print Date', description: 'Date when printed / previewed', type: 'date', format: 'DD-MM-YYYY' },
      { key: 'company_logo', label: 'Company Logo', description: 'Business logo image', type: 'image' },
      { key: 'qr_code', label: 'QR Code', description: 'Auto-generated QR code for invoice', type: 'image' },
    ],
  },
];

// ─── Flat map for quick lookup ─────────────────────────────────────────────────
export const FIELD_MAP: Record<string, FieldDef> = {};
for (const category of FIELD_REGISTRY) {
  for (const field of category.fields) {
    FIELD_MAP[field.key] = field;
  }
}

export function getFieldDef(key: string): FieldDef | undefined {
  return FIELD_MAP[key];
}

export function getAllFields(): FieldDef[] {
  return FIELD_REGISTRY.flatMap(c => c.fields);
}
