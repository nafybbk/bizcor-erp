import { useEffect, useRef, useState } from "react";
import { api, fmt } from "@/lib/api";
import { getVisibleCols, saveVisibleCols } from "@/lib/uiPrefs";
import ColumnCustomizer, { type ColDef } from "@/components/ColumnCustomizer";
import { Loader2, Printer, X } from "lucide-react";
import PartySelect from "@/components/PartySelect";
import VoucherQuickViewModal from "@/components/VoucherQuickViewModal";

const ALL_COLS: ColDef[] = [
  { key: "date", label: "Date", required: true },
  { key: "type", label: "Type" },
  { key: "doc", label: "Doc No." },
  { key: "ref", label: "Ref. No." },
  { key: "debit", label: "Debit (Dr)" },
  { key: "credit", label: "Credit (Cr)" },
  { key: "balance", label: "Balance", required: true },
];
const REPORT_KEY = "party_ledger";

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  paid:      { label: "Paid",     cls: "bg-green-100 text-green-700" },
  partial:   { label: "Partial",  cls: "bg-yellow-100 text-yellow-700" },
  posted:    { label: "Due",      cls: "bg-blue-100 text-blue-700" },
  draft:     { label: "Draft",    cls: "bg-gray-100 text-gray-500" },
  cancelled: { label: "Cancelled",cls: "bg-red-100 text-red-500" },
};

function fmtCur(n: number) { return "₹" + Math.abs(n).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function fmtDt(d: string) { if (!d) return ""; const dt = new Date(d); return dt.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }); }

// Doc No. is always this row's OWN native voucher/payment number — the
// identity of this record, same for every type, never mixed with anyone
// else's number.
function docNumber(e: any): string {
  return e.voucherNumber || "";
}

// Vouchers open their REAL document page (print + PDF export included) in an
// embedded overlay right on top of this screen — closing it lands back on the
// exact same statement, nothing re-searched, and no second ERP shell visible
// (the embedded page renders chrome-less via ?embed=1).
const VOUCHER_EMBED_PATH: Record<string, string> = {
  sales_invoice: "/sales/invoices",
  credit_note: "/sales/credit-notes",
  purchase_bill: "/purchases/bills",
  debit_note: "/purchases/debit-notes",
};

// Receipts/payments have no printable document page — those get a light
// same-page summary card instead.
const QUICK_VIEW_TYPES = new Set(["receipt", "payment"]);

// Ref. No. is always some OTHER document's number, brought in for
// cross-reference — never this row's own Doc No. Purchase Bill/Sales
// Invoice/Credit Note: whatever external ref was typed in (supplier bill no.
// / customer PO no.). Debit Note linked to a Purchase Bill: that bill's own
// Doc No. + its own Ref. No., since neither belongs natively to this Debit
// Note. Unlinked Debit Note: its own typed-in Reference field.
function referenceLabel(e: any): string {
  if (e.voucherType === "debit_note" && e.linkedVoucherNumber) {
    return e.linkedReferenceNumber ? `${e.linkedVoucherNumber} / ${e.linkedReferenceNumber}` : e.linkedVoucherNumber;
  }
  return e.referenceNumber || "";
}

type PartyTypeFilter = "all" | "customer" | "supplier";

export default function PartyLedger() {
  const [parties, setParties] = useState<any[]>([]);
  const [selectedParty, setSelectedParty] = useState<any>(null);
  const [ledger, setLedger] = useState<any>(null);
  const [partySearch, setPartySearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [billWise, setBillWise] = useState(false);
  const [partyTypeFilter, setPartyTypeFilter] = useState<PartyTypeFilter>("all");
  const [visibleCols, setVisibleCols] = useState<string[]>(() =>
    getVisibleCols(REPORT_KEY, ALL_COLS.map(c => c.key))
  );
  const [printHtml, setPrintHtml] = useState<string | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [quickView, setQuickView] = useState<{ voucherType: string; id: number } | null>(null);
  const [docView, setDocView] = useState<{ url: string; title: string } | null>(null);

  // The embedded voucher page's print-preview close button posts this message
  // instead of revealing the raw page inside the iframe.
  useEffect(() => {
    const onMsg = (ev: MessageEvent) => {
      if (ev.origin === window.location.origin && ev.data?.type === "bizcor-embed-close") setDocView(null);
    };
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, []);

  const bills: any[] = ledger?.bills || [];
  const totalBillAmount = bills.reduce((s: number, b: any) => s + b.billAmount, 0);
  const totalPaid = bills.reduce((s: number, b: any) => s + b.paidAmount, 0);
  const totalBalance = bills.reduce((s: number, b: any) => s + b.balance, 0);
  const isPurchaseSide = bills.some((b: any) => b.voucherType === "purchase_bill" || b.voucherType === "debit_note");
  const billsDrCr = isPurchaseSide ? "Cr" : "Dr";

  const entries: any[] = ledger?.entries || [];
  const ob = ledger?.openingBalance ?? 0;
  const totalDebit  = entries.reduce((s: number, e: any) => s + (e.debit  || 0), 0) + (ob > 0 ? ob : 0);
  const totalCredit = entries.reduce((s: number, e: any) => s + (e.credit || 0), 0) + (ob < 0 ? -ob : 0);

  const filteredParties = partyTypeFilter === "all"
    ? parties
    : parties.filter(p => p.type === partyTypeFilter || p.type === "both");

  const printStatement = () => {
    if (!ledger) return;
    const bizName = localStorage.getItem("erp_business") ? JSON.parse(localStorage.getItem("erp_business")!).name : "";
    const party = ledger.party;
    const entries: any[] = ledger.entries || [];
    const period = fromDate || toDate ? `${fromDate ? fmtDt(fromDate) : "Beginning"} to ${toDate ? fmtDt(toDate) : "Today"}` : "All Dates";

    const tableRows = billWise
      ? bills.map(b => `
          <tr>
            <td>${fmtDt(b.date)}</td>
            <td>${b.voucherNumber}</td>
            <td>${b.voucherType.replace(/_/g, " ")}</td>
            <td class="num">${fmtCur(b.billAmount)}</td>
            <td class="num">${b.paidAmount > 0 ? fmtCur(b.paidAmount) : "—"}</td>
            <td class="num ${b.balance > 0 ? "red" : "green"}">${b.balance > 0 ? fmtCur(b.balance) : "Cleared"}</td>
            <td class="center">${b.status}</td>
          </tr>`).join("")
      : entries.map(e => `
          <tr>
            <td>${fmtDt(e.date)}</td>
            <td>${e.voucherType?.replace(/_/g, " ") || ""}</td>
            <td>${docNumber(e)}</td>
            <td>${referenceLabel(e)}</td>
            <td class="num blue">${e.debit > 0 ? fmtCur(e.debit) : ""}</td>
            <td class="num green">${e.credit > 0 ? fmtCur(e.credit) : ""}</td>
            <td class="num"><b>${fmtCur(Math.abs(e.balance))} ${e.balance >= 0 ? "Dr" : "Cr"}</b></td>
          </tr>`).join("");

    const billWiseFoot = billWise ? `
      <tfoot>
        <tr class="total-row">
          <td colspan="3"><b>Total Outstanding</b></td>
          <td class="num"><b>${fmtCur(totalBillAmount)}</b></td>
          <td class="num green"><b>${fmtCur(totalPaid)}</b></td>
          <td class="num red"><b>${fmtCur(totalBalance)} ${billsDrCr}</b></td>
          <td></td>
        </tr>
      </tfoot>` : "";

    const openingRow = !billWise ? `
      <tr class="opening-row">
        <td colspan="4"><b>Opening Balance</b></td>
        <td class="num">${ledger.openingBalance >= 0 ? fmtCur(ledger.openingBalance) : ""}</td>
        <td class="num">${ledger.openingBalance < 0 ? fmtCur(-ledger.openingBalance) : ""}</td>
        <td class="num"><b>${fmtCur(Math.abs(ledger.openingBalance))} ${ledger.openingBalance >= 0 ? "Dr" : "Cr"}</b></td>
      </tr>` : "";

    const closingRow = !billWise ? `
      <tr class="total-row">
        <td colspan="4"><b>Closing Balance</b></td>
        <td class="num"><b>${ledger.closingBalance >= 0 ? fmtCur(ledger.closingBalance) : ""}</b></td>
        <td class="num"><b>${ledger.closingBalance < 0 ? fmtCur(-ledger.closingBalance) : ""}</b></td>
        <td class="num"><b>${fmtCur(Math.abs(ledger.closingBalance))} ${ledger.closingBalance >= 0 ? "Dr" : "Cr"}</b></td>
      </tr>` : "";

    const headers = billWise
      ? `<th>Date</th><th>Bill No.</th><th>Type</th><th class="num">Bill Amt</th><th class="num">Paid</th><th class="num">Balance</th><th class="center">Status</th>`
      : `<th>Date</th><th>Type</th><th>Doc No.</th><th>Ref. No.</th><th class="num">Debit (Dr)</th><th class="num">Credit (Cr)</th><th class="num">Balance</th>`;

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Party Statement - ${party?.name}</title>
    <style>
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body { font-family: Arial, sans-serif; font-size: 12px; color: #111; padding: 20px; }
      .header { border-bottom: 2px solid #111; padding-bottom: 10px; margin-bottom: 14px; }
      .header h1 { font-size: 18px; font-weight: bold; }
      .header .sub { font-size: 11px; color: #555; margin-top: 2px; }
      .party-info { display: flex; justify-content: space-between; margin-bottom: 14px; padding: 10px; background: #f5f5f5; border-radius: 4px; }
      .party-info .name { font-size: 14px; font-weight: bold; }
      .party-info .gstin { font-size: 10px; color: #777; font-family: monospace; }
      .party-info .balance { text-align: right; }
      .party-info .balance .label { font-size: 10px; color: #777; }
      .party-info .balance .amount { font-size: 15px; font-weight: bold; color: #1a56db; }
      table { width: 100%; border-collapse: collapse; }
      th { background: #f0f0f0; padding: 7px 8px; text-align: left; font-size: 11px; border: 1px solid #ddd; }
      td { padding: 6px 8px; border: 1px solid #eee; font-size: 11px; }
      tr:nth-child(even) td { background: #fafafa; }
      .num { text-align: right; }
      .center { text-align: center; }
      .blue { color: #1a56db; }
      .green { color: #057a55; }
      .red { color: #c81e1e; }
      .opening-row td { background: #eff6ff; font-weight: 500; }
      .total-row td { background: #f3f4f6; border-top: 2px solid #ccc; }
      .footer { margin-top: 14px; font-size: 10px; color: #999; text-align: right; }
      @media print { body { padding: 10px; } }
    </style></head><body>
    <div class="header">
      <h1>${bizName}</h1>
      <div class="sub">Party Statement &mdash; ${period}</div>
    </div>
    <div class="party-info">
      <div>
        <div class="name">${party?.name || ""}</div>
        ${party?.gstin ? `<div class="gstin">GSTIN: ${party.gstin}</div>` : ""}
        ${party?.phone ? `<div class="gstin">Ph: ${party.phone}</div>` : ""}
      </div>
      <div class="balance">
        <div class="label">${billWise ? "Total Outstanding" : "Closing Balance"}</div>
        <div class="amount">${billWise
          ? `${fmtCur(totalBalance)} ${billsDrCr}`
          : `${fmtCur(Math.abs(ledger.closingBalance))} ${ledger.closingBalance >= 0 ? "Dr" : "Cr"}`
        }</div>
      </div>
    </div>
    <table>
      <thead><tr>${headers}</tr></thead>
      <tbody>${openingRow}${tableRows}</tbody>
      ${billWiseFoot || (closingRow ? `<tfoot>${closingRow}</tfoot>` : "")}
    </table>
    <div class="footer">Printed on ${new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}</div>
    </body></html>`;

    const htmlWithBtn = html.replace(
      "</style>",
      `  .print-bar { position: fixed; top: 0; left: 0; right: 0; background: #1e293b; padding: 8px 16px; display: flex; align-items: center; justify-between; gap: 12px; z-index: 999; box-shadow: 0 2px 8px rgba(0,0,0,0.3); }
  .print-bar span { color: #94a3b8; font-size: 12px; flex: 1; }
  .print-bar button { padding: 6px 20px; border-radius: 6px; border: none; cursor: pointer; font-size: 13px; font-weight: 600; }
  .btn-print { background: #2563eb; color: white; }
  .btn-print:hover { background: #1d4ed8; }
  .btn-close { background: #475569; color: white; }
  .btn-close:hover { background: #334155; }
  body { padding-top: 48px; }
  @media print { .print-bar { display: none !important; } body { padding-top: 0; } }
</style>`
    ).replace(
      "<body>",
      `<body><div class="print-bar"><span>Party Statement — Preview</span><button class="btn-print" onclick="window.print()">🖨 Print</button></div>`
    );

    setPrintHtml(htmlWithBtn);
  };

  const handleColChange = (cols: string[]) => { setVisibleCols(cols); saveVisibleCols(REPORT_KEY, cols); };
  const show = (key: string) => visibleCols.includes(key);

  useEffect(() => {
    api.get<any>("/parties?limit=500").then(r => setParties(r.data || [])).catch(console.error);
  }, []);

  const loadLedger = (partyId: number) => {
    setLoading(true);
    setLoadError(null);
    const params = new URLSearchParams();
    if (fromDate) params.set("fromDate", fromDate);
    if (toDate) params.set("toDate", toDate);
    api.get<any>(`/accounting/ledger/${partyId}?${params}`)
      .then(data => { setLedger(data); setLoadError(null); })
      .catch((err: any) => { setLoadError(err?.message || "Ledger load nahi ho saka"); setLedger(null); })
      .finally(() => setLoading(false));
  };

  const selectParty = (p: any) => {
    setSelectedParty(p);
    setPartySearch(p.name);
    loadLedger(p.id);
  };

  useEffect(() => {
    if (selectedParty) loadLedger(selectedParty.id);
  }, [fromDate, toDate]);

  const TYPE_TABS: { key: PartyTypeFilter; label: string; color: string }[] = [
    { key: "all",      label: "All",      color: "gray" },
    { key: "customer", label: "Customer", color: "blue" },
    { key: "supplier", label: "Supplier", color: "orange" },
  ];

  return (
    <>
    <div className="max-w-5xl space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-gray-900">Party Statement</h1>
        <div className="flex items-center gap-2 print:hidden">
          {ledger && !billWise && (
            <ColumnCustomizer cols={ALL_COLS} visible={visibleCols} onChange={handleColChange} />
          )}
          {ledger && (
            <button onClick={printStatement}
              className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 bg-white hover:bg-gray-50 text-sm font-medium rounded-lg transition-colors">
              <Printer className="w-4 h-4" /> Print
            </button>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
        {/* Customer / Supplier filter tabs */}
        <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1 w-fit">
          {TYPE_TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => {
                setPartyTypeFilter(tab.key);
                setSelectedParty(null);
                setPartySearch("");
                setLedger(null);
              }}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
                partyTypeFilter === tab.key
                  ? tab.key === "customer"
                    ? "bg-blue-600 text-white shadow-sm"
                    : tab.key === "supplier"
                    ? "bg-orange-500 text-white shadow-sm"
                    : "bg-white text-gray-800 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {tab.label}
              {tab.key !== "all" && (
                <span className={`ml-1.5 text-xs px-1.5 py-0.5 rounded-full ${
                  partyTypeFilter === tab.key ? "bg-white/20 text-white" : "bg-gray-200 text-gray-500"
                }`}>
                  {parties.filter(p => p.type === tab.key || p.type === "both").length}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Filters row */}
        <div className="flex flex-wrap gap-4 items-end">
          <div className="flex-1 min-w-48">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Select {partyTypeFilter === "all" ? "Party" : partyTypeFilter === "customer" ? "Customer" : "Supplier"}
            </label>
            <PartySelect
              parties={filteredParties}
              value={partySearch}
              onSelect={selectParty}
              placeholder={`Search ${partyTypeFilter === "all" ? "party" : partyTypeFilter}...`}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">From Date</label>
            <input type="date" className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={fromDate} onChange={e => setFromDate(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">To Date</label>
            <input type="date" className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={toDate} onChange={e => setToDate(e.target.value)} />
          </div>
          {ledger && (
            <div className="flex items-center gap-2 pb-0.5">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <div
                  onClick={() => setBillWise(v => !v)}
                  className={`relative w-10 h-5 rounded-full transition-colors ${billWise ? "bg-blue-600" : "bg-gray-300"}`}
                >
                  <div className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${billWise ? "translate-x-5" : "translate-x-0"}`} />
                </div>
                <span className="text-sm font-medium text-gray-700">Bill-wise</span>
              </label>
            </div>
          )}
        </div>
      </div>

      {loading && <div className="flex items-center justify-center h-48"><Loader2 className="w-5 h-5 animate-spin text-blue-500" /></div>}

      {loadError && !loading && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-5 py-4 text-red-700 text-sm flex items-start gap-2">
          <span className="text-lg">⚠️</span>
          <div>
            <div className="font-medium">Party ledger load nahi ho saka</div>
            <div className="text-xs text-red-500 mt-0.5 font-mono">{loadError}</div>
            <button onClick={() => selectedParty && loadLedger(selectedParty.id)}
              className="mt-2 text-xs text-red-700 underline hover:no-underline">Dobara try karein</button>
          </div>
        </div>
      )}

      {ledger && !loading && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {/* Header */}
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between flex-wrap gap-3">
            <div>
              <h2 className="font-semibold text-gray-900">{ledger.party?.name}</h2>
              {ledger.party?.gstin && <div className="text-xs text-gray-400 font-mono">GSTIN: {ledger.party.gstin}</div>}
            </div>
            <div className="text-right">
              <div className="text-sm text-gray-500">{billWise ? "Net Outstanding" : "Closing Balance"}</div>
              <div className={`text-lg font-bold ${ledger.closingBalance >= 0 ? "text-blue-700" : "text-green-700"}`}>
                {`${fmt.currency(Math.abs(ledger.closingBalance))} ${ledger.closingBalance >= 0 ? "Dr" : "Cr"}`}
              </div>
            </div>
          </div>

          {/* Bill-wise View */}
          {billWise ? (
            <div className="overflow-x-auto">
              {bills.length === 0 ? (
                <div className="text-center py-12 text-gray-400">No invoices/bills found for this party</div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-gray-600">
                    <tr>
                      <th className="text-left px-4 py-3 font-medium">Date</th>
                      <th className="text-left px-4 py-3 font-medium">Bill No.</th>
                      <th className="text-left px-4 py-3 font-medium">Type</th>
                      <th className="text-right px-4 py-3 font-medium">Bill Amount</th>
                      <th className="text-right px-4 py-3 font-medium">Paid</th>
                      <th className="text-right px-4 py-3 font-medium">Balance</th>
                      <th className="text-center px-4 py-3 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bills.map((b: any, i: number) => {
                      const badge = STATUS_BADGE[b.status] || STATUS_BADGE["posted"];
                      return (
                        <tr key={i} className="border-t border-gray-50 hover:bg-gray-50">
                          <td className="px-4 py-3 text-gray-600">{fmt.date(b.date)}</td>
                          <td className="px-4 py-3 font-mono text-xs text-blue-600">{b.voucherNumber}</td>
                          <td className="px-4 py-3 text-xs text-gray-500 capitalize">{b.voucherType.replace(/_/g, " ")}</td>
                          <td className="px-4 py-3 text-right font-medium text-gray-900">{fmt.currency(b.billAmount)}</td>
                          <td className="px-4 py-3 text-right text-green-700">{b.paidAmount > 0 ? fmt.currency(b.paidAmount) : <span className="text-gray-300">—</span>}</td>
                          <td className={`px-4 py-3 text-right font-semibold ${b.balance > 0 ? "text-red-600" : "text-green-600"}`}>
                            {b.balance > 0 ? fmt.currency(b.balance) : <span className="text-green-600">✓ Cleared</span>}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${badge.cls}`}>{badge.label}</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot className="bg-gray-50 border-t-2 border-gray-200 font-semibold">
                    <tr>
                      <td colSpan={3} className="px-4 py-3 text-gray-700">Total Outstanding</td>
                      <td className="px-4 py-3 text-right text-gray-900">{fmt.currency(totalBillAmount)}</td>
                      <td className="px-4 py-3 text-right text-green-700">{fmt.currency(totalPaid)}</td>
                      <td className={`px-4 py-3 text-right text-lg font-bold ${isPurchaseSide ? "text-green-700" : "text-blue-700"}`}>
                        {fmt.currency(totalBalance)} <span className="text-sm">{billsDrCr}</span>
                      </td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
              )}
            </div>
          ) : (
            /* Running Balance View */
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-600">
                  <tr>
                    {show("date") && <th className="text-left px-4 py-3 font-medium">Date</th>}
                    {show("type") && <th className="text-left px-4 py-3 font-medium">Type</th>}
                    {show("doc") && <th className="text-left px-4 py-3 font-medium">Doc No.</th>}
                    {show("ref") && <th className="text-left px-4 py-3 font-medium">Ref. No.</th>}
                    {show("debit") && <th className="text-right px-4 py-3 font-medium">Debit (Dr)</th>}
                    {show("credit") && <th className="text-right px-4 py-3 font-medium">Credit (Cr)</th>}
                    {show("balance") && <th className="text-right px-4 py-3 font-medium">Balance</th>}
                  </tr>
                </thead>
                <tbody>
                  <tr className="bg-blue-50">
                    <td className="px-4 py-2.5 text-gray-600" colSpan={Math.max(1, visibleCols.filter(c => ["date","type","doc","ref"].includes(c)).length)}>Opening Balance</td>
                    {show("debit") && <td className="px-4 py-2.5 text-right font-medium">{ledger.openingBalance >= 0 ? fmt.currency(ledger.openingBalance) : ""}</td>}
                    {show("credit") && <td className="px-4 py-2.5 text-right font-medium">{ledger.openingBalance < 0 ? fmt.currency(-ledger.openingBalance) : ""}</td>}
                    {show("balance") && (
                      <td className="px-4 py-2.5 text-right font-semibold">
                        {fmt.currency(Math.abs(ledger.openingBalance))} {ledger.openingBalance >= 0 ? "Dr" : "Cr"}
                      </td>
                    )}
                  </tr>
                  {(ledger.entries || []).map((e: any, i: number) => (
                    <tr key={i} className="border-t border-gray-50 hover:bg-gray-50">
                      {show("date") && <td className="px-4 py-2.5 text-gray-600">{fmt.date(e.date)}</td>}
                      {show("type") && <td className="px-4 py-2.5 capitalize text-xs text-gray-500">{e.voucherType?.replace(/_/g, " ")}</td>}
                      {show("doc") && (
                        <td className="px-4 py-2.5 font-mono text-xs text-blue-600">
                          {e.id && VOUCHER_EMBED_PATH[e.voucherType] ? (
                            <button
                              onClick={() => setDocView({ url: `${VOUCHER_EMBED_PATH[e.voucherType]}/${e.id}?embed=1`, title: `${e.voucherType.replace(/_/g, " ")} — ${docNumber(e)}` })}
                              className="hover:underline hover:text-blue-800">
                              {docNumber(e)}
                            </button>
                          ) : e.id && QUICK_VIEW_TYPES.has(e.voucherType) ? (
                            <button onClick={() => setQuickView({ voucherType: e.voucherType, id: e.id })}
                              className="hover:underline hover:text-blue-800">
                              {docNumber(e)}
                            </button>
                          ) : docNumber(e)}
                          {e.billRefs && e.billRefs.length > 0 && (
                            <div className="mt-0.5 flex flex-wrap gap-1">
                              {e.billRefs.map((br: any, bi: number) => (
                                <span key={bi} className={`font-sans px-1.5 py-0.5 rounded-full text-[10px] font-medium ${br.fullySettled ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}>
                                  Against {br.voucherNumber} ({fmt.currency(br.amount)}{br.fullySettled ? " — full" : ` — partial, ${fmt.currency(br.remainingOnBill)} due`})
                                </span>
                              ))}
                              {e.onAccountAmount > 0 && (
                                <span className="font-sans px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-gray-100 text-gray-600">
                                  On-account {fmt.currency(e.onAccountAmount)}
                                </span>
                              )}
                            </div>
                          )}
                        </td>
                      )}
                      {show("ref") && <td className="px-4 py-2.5 font-mono text-xs text-gray-500">{referenceLabel(e)}</td>}
                      {show("debit") && <td className="px-4 py-2.5 text-right text-blue-700">{e.debit > 0 ? fmt.currency(e.debit) : ""}</td>}
                      {show("credit") && <td className="px-4 py-2.5 text-right text-green-700">{e.credit > 0 ? fmt.currency(e.credit) : ""}</td>}
                      {show("balance") && (
                        <td className="px-4 py-2.5 text-right font-semibold text-gray-900">
                          {fmt.currency(Math.abs(e.balance))} {e.balance >= 0 ? "Dr" : "Cr"}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-gray-50 border-t-2 border-gray-300 font-semibold">
                  <tr>
                    <td colSpan={Math.max(1, visibleCols.filter(c => ["date","type","ref"].includes(c)).length)} className="px-4 py-3 text-gray-700">Total</td>
                    {show("debit") && <td className="px-4 py-3 text-right text-blue-800">{fmt.currency(totalDebit)}</td>}
                    {show("credit") && <td className="px-4 py-3 text-right text-green-800">{fmt.currency(totalCredit)}</td>}
                    {show("balance") && (
                      <td className={`px-4 py-3 text-right text-base font-bold ${ledger.closingBalance >= 0 ? "text-blue-700" : "text-green-700"}`}>
                        {fmt.currency(Math.abs(ledger.closingBalance))} {ledger.closingBalance >= 0 ? "Dr" : "Cr"}
                      </td>
                    )}
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      )}

      {!selectedParty && !loading && (
        <div className="text-center py-16 text-gray-400 bg-white rounded-xl border border-gray-200">
          <div className="text-4xl mb-3">📒</div>
          <div className="font-medium">
            {partyTypeFilter === "customer"
              ? "Select a customer to view their statement"
              : partyTypeFilter === "supplier"
              ? "Select a supplier to view their statement"
              : "Select a party to view their statement"}
          </div>
        </div>
      )}
    </div>

    {/* ── In-page print preview modal (replaces window.open) ───────────── */}
    {printHtml && (
      <div className="fixed inset-0 z-[9999] flex flex-col bg-gray-700">
        <div className="flex items-center justify-between px-4 h-11 bg-gray-900 text-white flex-shrink-0">
          <span className="text-sm font-semibold">Party Statement — Preview</span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => iframeRef.current?.contentWindow?.print()}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg"
            >
              <Printer className="w-4 h-4" /> Print / PDF
            </button>
            <button
              onClick={() => setPrintHtml(null)}
              className="p-1.5 hover:bg-gray-700 rounded text-gray-400 hover:text-white"
              title="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-auto">
          <iframe
            ref={iframeRef}
            srcDoc={printHtml}
            title="Party Statement"
            className="w-full h-full border-none"
            sandbox="allow-same-origin allow-scripts allow-modals"
          />
        </div>
      </div>
    )}

    {quickView && (
      <VoucherQuickViewModal
        voucherType={quickView.voucherType}
        id={quickView.id}
        onClose={() => setQuickView(null)}
      />
    )}

    {/* ── Embedded original-document overlay (print + PDF inside) ─────── */}
    {docView && (
      <div className="fixed inset-0 z-[9999] flex flex-col bg-gray-700">
        <div className="flex items-center justify-between px-4 h-11 bg-gray-900 text-white flex-shrink-0">
          <span className="text-sm font-semibold capitalize">{docView.title}</span>
          <button
            onClick={() => setDocView(null)}
            className="flex items-center gap-1.5 px-3 py-1.5 hover:bg-gray-700 rounded-lg text-gray-300 hover:text-white text-sm"
            title="Band karke statement par wapas"
          >
            <X className="w-4 h-4" /> Close
          </button>
        </div>
        <iframe src={docView.url} title="Document" className="flex-1 w-full border-none bg-white" />
      </div>
    )}
    </>
  );
}
