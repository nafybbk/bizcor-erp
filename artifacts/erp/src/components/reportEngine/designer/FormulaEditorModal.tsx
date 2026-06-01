import { useState, useRef, useEffect } from "react";
import { X, ChevronDown, ChevronRight, Zap, Eye } from "lucide-react";
import { FIELD_REGISTRY } from "@/lib/reportEngine/fieldRegistry";

// ─── Sample data for live preview ─────────────────────────────────────────────
const SAMPLE: Record<string, string> = {
  company_name: 'Adeena Handloom',
  company_address: 'Shop 5, Textile Market, Surat - 395002',
  company_gstin: '24AAFFA1234A1Z5',
  company_phone: '+91 99999 11111',
  company_email: 'info@adeena.com',
  company_state: 'Gujarat',
  company_pan: 'AAFFA1234A',
  signatory_name: 'Mohd. Adeena',
  bank_name: 'SBI',
  bank_account: '123456789012',
  bank_ifsc: 'SBIN0001234',
  bank_branch: 'Surat Main',
  invoice_footer: 'Thank you for your business!',
  party_name: 'ABC Fabrics Pvt. Ltd.',
  party_address: '201-A, Bhuleshwar, Mumbai - 400002',
  party_gstin: '27AABCA1234B1Z6',
  party_phone: '+91 88888 22222',
  party_email: 'purchase@abcfabrics.com',
  party_state: 'Maharashtra',
  party_city: 'Mumbai',
  party_pan: 'AABCA1234B',
  invoice_number: 'SI-2425-0042',
  invoice_date: '01-06-2026',
  invoice_type: 'Tax Invoice',
  due_date: '30-06-2026',
  reference_number: 'PO-2026-108',
  place_of_supply: 'Maharashtra (27)',
  notes: 'Delivery via DTDC',
  terms_and_conditions: 'Payment due within 30 days.',
  dispatch_mode: 'Road',
  transport_name: 'DTDC Courier',
  transport_charges: '350.00',
  is_inter_state: 'true',
  sub_total: '45000.00',
  total_discount: '2250.00',
  taxable_amount: '42750.00',
  total_cgst: '0.00',
  total_sgst: '0.00',
  total_igst: '2137.50',
  total_tax: '2137.50',
  round_off: '-0.50',
  grand_total: '45237.00',
  paid_amount: '0.00',
  amount_in_words: 'Forty Five Thousand Two Hundred Thirty Seven Rupees Only',
  page_number: '1',
  total_pages: '1',
  print_date: '01-06-2026',
};

// ─── Formula evaluator ────────────────────────────────────────────────────────
function evalFormula(formula: string): string {
  try {
    // 1. Replace {field} tokens with sample values
    let result = formula.replace(/\{(\w+)\}/g, (_, key) => SAMPLE[key] ?? `{${key}}`);

    // 2. Handle & string concatenation
    if (result.includes(' & ')) {
      const parts = result.split(' & ').map(p => p.trim().replace(/^["']|["']$/g, ''));
      return parts.join('');
    }

    // 3. Handle if/then/else
    const ifMatch = result.match(/^if\s+(.+?)\s+then\s+(.+?)(?:\s+else\s+(.+))?$/i);
    if (ifMatch) {
      const [, cond, thenVal, elseVal] = ifMatch;
      const condResult = evalCondition(cond.trim());
      const val = condResult
        ? thenVal.trim().replace(/^["']|["']$/g, '')
        : (elseVal || '').trim().replace(/^["']|["']$/g, '');
      return val;
    }

    return result;
  } catch {
    return formula;
  }
}

function evalCondition(cond: string): boolean {
  const eqMatch = cond.match(/^(.+?)\s*(==|=|!=|>|<|>=|<=)\s*(.+)$/);
  if (!eqMatch) return false;
  const [, left, op, right] = eqMatch;
  const l = left.trim().replace(/^["']|["']$/g, '');
  const r = right.trim().replace(/^["']|["']$/g, '');
  switch (op) {
    case '=': case '==': return l === r;
    case '!=': return l !== r;
    case '>': return parseFloat(l) > parseFloat(r);
    case '<': return parseFloat(l) < parseFloat(r);
    case '>=': return parseFloat(l) >= parseFloat(r);
    case '<=': return parseFloat(l) <= parseFloat(r);
    default: return false;
  }
}

// ─── Syntax examples ──────────────────────────────────────────────────────────
const EXAMPLES = [
  { label: 'Field value', formula: '{company_name}' },
  { label: 'String concat', formula: '{company_name} & " | GSTIN: " & {company_gstin}' },
  { label: 'Invoice header', formula: '{invoice_type} - {invoice_number}' },
  { label: 'Party + state', formula: '{party_name} & ", " & {party_city}' },
  { label: 'Conditional (IGST/CGST)', formula: 'if {is_inter_state} = "true" then "IGST Applicable" else "CGST + SGST Applicable"' },
  { label: 'Amount label', formula: '"Total Amount: ₹" & {grand_total}' },
  { label: 'Page info', formula: '"Page " & {page_number} & " of " & {total_pages}' },
  { label: 'PO reference', formula: '"Ref: " & {reference_number}' },
];

// ─── Component ────────────────────────────────────────────────────────────────
interface Props {
  initialValue: string;
  title?: string;
  onApply: (value: string) => void;
  onClose: () => void;
}

export default function FormulaEditorModal({ initialValue, title = 'Formula Editor', onApply, onClose }: Props) {
  const [formula, setFormula] = useState(initialValue);
  const [preview, setPreview] = useState('');
  const [openCats, setOpenCats] = useState<Set<string>>(new Set(['company', 'invoice']));
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setPreview(evalFormula(formula));
  }, [formula]);

  function insertField(key: string) {
    const token = `{${key}}`;
    const ta = textareaRef.current;
    if (!ta) {
      setFormula(f => f + token);
      return;
    }
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const next = formula.slice(0, start) + token + formula.slice(end);
    setFormula(next);
    setTimeout(() => {
      ta.focus();
      ta.setSelectionRange(start + token.length, start + token.length);
    }, 0);
  }

  function insertExample(ex: string) {
    setFormula(ex);
    textareaRef.current?.focus();
  }

  function toggleCat(key: string) {
    setOpenCats(prev => {
      const n = new Set(prev);
      n.has(key) ? n.delete(key) : n.add(key);
      return n;
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl w-[900px] max-w-[95vw] max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-700 bg-gray-800">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-yellow-400" />
            <span className="text-white font-semibold text-sm">{title}</span>
            <span className="text-[10px] text-gray-400 bg-gray-700 px-2 py-0.5 rounded-full">Crystal Reports Style</span>
          </div>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex flex-1 overflow-hidden">
          {/* Left: Field browser */}
          <div className="w-[200px] shrink-0 bg-gray-800 border-r border-gray-700 overflow-y-auto">
            <div className="p-3 border-b border-gray-700">
              <p className="text-[10px] text-gray-400 uppercase tracking-wide font-medium">Fields</p>
              <p className="text-[10px] text-gray-500 mt-0.5">Click to insert at cursor</p>
            </div>
            {FIELD_REGISTRY.map(cat => (
              <div key={cat.key}>
                <button
                  onClick={() => toggleCat(cat.key)}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs text-gray-300 hover:bg-gray-700 transition-colors"
                >
                  <span>{cat.icon}</span>
                  <span className="flex-1 text-left font-medium">{cat.label}</span>
                  {openCats.has(cat.key) ? <ChevronDown className="w-3 h-3 text-gray-500" /> : <ChevronRight className="w-3 h-3 text-gray-500" />}
                </button>
                {openCats.has(cat.key) && (
                  <div className="ml-2">
                    {cat.fields.map(f => (
                      <button
                        key={f.key}
                        onClick={() => insertField(f.key)}
                        className="w-full text-left px-3 py-1.5 text-[11px] text-gray-400 hover:text-yellow-300 hover:bg-gray-700 transition-colors truncate"
                        title={f.description}
                      >
                        <span className="text-yellow-600 mr-1">{'{}'}</span>
                        {f.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Center: Editor + Preview */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Formula input */}
            <div className="p-4 flex-1 flex flex-col gap-3">
              <div>
                <label className="text-[10px] text-gray-400 uppercase tracking-wide font-medium block mb-1.5">
                  Formula Expression
                </label>
                <textarea
                  ref={textareaRef}
                  value={formula}
                  onChange={e => setFormula(e.target.value)}
                  placeholder={`Type formula...\nExamples:\n  {company_name}\n  {company_name} & " - GSTIN: " & {company_gstin}\n  if {is_inter_state} = "true" then "IGST" else "CGST/SGST"`}
                  rows={6}
                  className="w-full bg-gray-800 border border-gray-600 rounded-xl px-4 py-3 text-sm text-white font-mono focus:border-yellow-500 focus:outline-none resize-none placeholder-gray-600"
                  style={{ fontFamily: 'JetBrains Mono, Consolas, monospace' }}
                  spellCheck={false}
                />
              </div>

              {/* Live preview */}
              <div className="bg-gray-800 border border-gray-700 rounded-xl p-3">
                <div className="flex items-center gap-2 mb-2">
                  <Eye className="w-3.5 h-3.5 text-green-400" />
                  <span className="text-[10px] text-gray-400 uppercase tracking-wide font-medium">Live Preview (sample data)</span>
                </div>
                <div className="text-sm text-white bg-white/5 rounded-lg px-3 py-2 min-h-[32px] break-words">
                  {preview || <span className="text-gray-500 italic">Preview will appear here...</span>}
                </div>
              </div>

              {/* Syntax guide */}
              <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-3">
                <p className="text-[10px] text-gray-500 uppercase tracking-wide font-medium mb-2">Syntax Guide</p>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px]">
                  <div><code className="text-yellow-400">{'{field_name}'}</code> <span className="text-gray-500">→ field value</span></div>
                  <div><code className="text-yellow-400">{'A & " text " & B'}</code> <span className="text-gray-500">→ concat</span></div>
                  <div><code className="text-yellow-400">{'if {x} = "val" then "A" else "B"'}</code> <span className="text-gray-500">→ conditional</span></div>
                  <div><code className="text-yellow-400">{'if {amount} > 0 then "Paid"'}</code> <span className="text-gray-500">→ number compare</span></div>
                </div>
              </div>
            </div>

            {/* Examples */}
            <div className="border-t border-gray-700 p-3">
              <p className="text-[10px] text-gray-500 uppercase tracking-wide font-medium mb-2">Quick Examples</p>
              <div className="flex flex-wrap gap-1.5">
                {EXAMPLES.map(ex => (
                  <button
                    key={ex.label}
                    onClick={() => insertExample(ex.formula)}
                    className="px-2.5 py-1 text-[10px] bg-gray-700 text-gray-300 rounded-lg hover:bg-yellow-900/40 hover:text-yellow-300 hover:border-yellow-700 border border-gray-600 transition-colors"
                  >
                    {ex.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-gray-700 bg-gray-800">
          <span className="text-[11px] text-gray-500">
            {formula.length > 0 ? `${formula.length} characters` : 'Empty formula'}
          </span>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-1.5 text-sm text-gray-400 hover:text-white border border-gray-600 rounded-lg hover:bg-gray-700 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => { onApply(formula); onClose(); }}
              className="px-4 py-1.5 text-sm font-medium bg-yellow-600 text-white rounded-lg hover:bg-yellow-500 transition-colors"
            >
              Apply Formula
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
