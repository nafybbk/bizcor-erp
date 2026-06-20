// ─── Formula Engine ────────────────────────────────────────────────────────────
// Evaluates formulas like: {sub_total} + {total_cgst} + {total_sgst}
// Also resolves field references like: {{invoice_number}}

import type { ReportContext } from './types';

// ─── Resolve a single field reference from context ────────────────────────────
export function resolveField(field: string, context: ReportContext, itemContext?: Record<string, unknown>): unknown {
  // Check item context first (for detail rows)
  if (itemContext && field in itemContext) return itemContext[field];
  // Fall back to main context
  if (field in context) return context[field];
  return null;
}

// ─── Format a number value ────────────────────────────────────────────────────
export function formatNumber(value: number | null | undefined, format?: string): string {
  if (value === null || value === undefined || isNaN(Number(value))) return '';
  const num = Number(value);
  if (!format) return num.toFixed(2);
  if (format === '0') return Math.round(num).toString();
  if (format === '0.0') return num.toFixed(1);
  if (format === '0.00') return num.toFixed(2);
  if (format === '0.000') return num.toFixed(3);
  if (format.startsWith('#,##')) return formatIndian(num, format.includes('.00') ? 2 : 0);
  return num.toFixed(2);
}

// ─── Indian number format: 1,23,456.78 ────────────────────────────────────────
export function formatIndian(num: number, decimals = 2): string {
  const fixed = num.toFixed(decimals);
  const [intPart, decPart] = fixed.split('.');
  const lastThree = intPart.slice(-3);
  const rest = intPart.slice(0, -3);
  const formatted = rest
    ? rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',') + ',' + lastThree
    : lastThree;
  return decPart !== undefined ? `${formatted}.${decPart}` : formatted;
}

// ─── Format a date string ─────────────────────────────────────────────────────
export function formatDate(value: string | null | undefined, format?: string): string {
  if (!value) return '';
  try {
    const d = new Date(value);
    if (isNaN(d.getTime())) return value;
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    const fmt = format || 'DD-MM-YYYY';
    return fmt
      .replace('DD', dd)
      .replace('MM', mm)
      .replace('YYYY', String(yyyy))
      .replace('YY', String(yyyy).slice(-2));
  } catch {
    return value;
  }
}

// ─── Evaluate a formula expression ────────────────────────────────────────────
// Supported: {field} references, +, -, *, /, round(), abs(), if()
export function evaluateFormula(
  formula: string,
  context: ReportContext,
  itemContext?: Record<string, unknown>
): number {
  try {
    // Replace {field} with numeric values from context
    const resolved = formula.replace(/\{([^}]+)\}/g, (_match, fieldKey: string) => {
      const val = resolveField(fieldKey.trim(), context, itemContext);
      const num = Number(val);
      return isNaN(num) ? '0' : String(num);
    });

    // Allowed characters only: numbers, operators, spaces, parens, commas, dots
    const safe = resolved.replace(/[^0-9+\-*/().,%\s]/g, '');

    // Evaluate safely
    const result = new Function(`"use strict"; return (${safe});`)();
    return typeof result === 'number' && !isNaN(result) ? result : 0;
  } catch {
    return 0;
  }
}

// ─── Evaluate a conditional expression ────────────────────────────────────────
// e.g. "gstin != null", "discount > 0", "is_inter_state == true"
export function evaluateCondition(
  condition: string,
  context: ReportContext,
  itemContext?: Record<string, unknown>
): boolean {
  if (!condition || condition.trim() === '') return true;
  try {
    // Replace field references with their values
    const resolved = condition.replace(/\b([a-z_][a-z0-9_]*)\b/g, (_match, fieldKey: string) => {
      const val = resolveField(fieldKey, context, itemContext);
      if (val === null || val === undefined) return 'null';
      if (typeof val === 'string') return JSON.stringify(val);
      if (typeof val === 'boolean') return String(val);
      return String(Number(val));
    });

    const result = new Function(`"use strict"; return !!(${resolved});`)();
    return Boolean(result);
  } catch {
    return true; // on error, show the element
  }
}

// ─── Render field value as string ─────────────────────────────────────────────
export function renderFieldValue(
  field: string,
  context: ReportContext,
  format?: string,
  nullText = '',
  itemContext?: Record<string, unknown>
): string {
  const val = resolveField(field, context, itemContext);
  if (val === null || val === undefined || val === '') return nullText;

  // Date fields
  if (field.endsWith('_date') || field === 'print_date') {
    return formatDate(String(val), format);
  }

  // Number/currency fields
  if (typeof val === 'number' || (typeof val === 'string' && !isNaN(Number(val)))) {
    const num = Number(val);
    if (!isNaN(num) && format) return formatNumber(num, format);
    if (!isNaN(num)) {
      // currency fields — default 2 decimals
      const currencyFields = ['rate','discount','taxable_amount','cgst','sgst','igst','tax_amount','total',
        'sub_total','total_discount','total_cgst','total_sgst','total_igst','total_tax',
        'transport_charges','round_off','grand_total','paid_amount'];
      if (currencyFields.includes(field)) return formatNumber(num, '0.00');
    }
    return String(val);
  }

  return String(val);
}

// ─── Amount in words (Hindi/English) ─────────────────────────────────────────
const ones = ['','One','Two','Three','Four','Five','Six','Seven','Eight','Nine',
  'Ten','Eleven','Twelve','Thirteen','Fourteen','Fifteen','Sixteen','Seventeen','Eighteen','Nineteen'];
const tens = ['','','Twenty','Thirty','Forty','Fifty','Sixty','Seventy','Eighty','Ninety'];

function numToWords(n: number): string {
  if (n === 0) return 'Zero';
  if (n < 0) return 'Minus ' + numToWords(-n);
  if (n < 20) return ones[n];
  if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? ' ' + ones[n % 10] : '');
  if (n < 1000) return ones[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' ' + numToWords(n % 100) : '');
  if (n < 100000) return numToWords(Math.floor(n / 1000)) + ' Thousand' + (n % 1000 ? ' ' + numToWords(n % 1000) : '');
  if (n < 10000000) return numToWords(Math.floor(n / 100000)) + ' Lakh' + (n % 100000 ? ' ' + numToWords(n % 100000) : '');
  return numToWords(Math.floor(n / 10000000)) + ' Crore' + (n % 10000000 ? ' ' + numToWords(n % 10000000) : '');
}

export function amountInWords(amount: number, currency = 'Rupees'): string {
  const rounded = Math.abs(Math.round(amount * 100));
  const rupees = Math.floor(rounded / 100);
  const paise = rounded % 100;
  let result = `${currency} ${numToWords(rupees)}`;
  if (paise > 0) result += ` and ${numToWords(paise)} Paise`;
  result += ' Only';
  return result;
}
