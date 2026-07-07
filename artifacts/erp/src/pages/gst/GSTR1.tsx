import { useEffect, useState } from "react";
import * as XLSX from "xlsx";
import { api, fmt } from "@/lib/api";
import { Loader2, Download, FileJson, FileText, ChevronDown, ChevronRight, AlertTriangle } from "lucide-react";
import BusinessHeader from "@/components/BusinessHeader";

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function r2(n: number) { return Math.round(n * 100) / 100; }
function fmtN(n: number) { return n === 0 ? "—" : fmt.currency(n); }

function SectionBox({ title, badge, color, children, defaultOpen = true }: {
  title: string; badge?: string | number; color: string; children: React.ReactNode; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <button onClick={() => setOpen(o => !o)}
        className="w-full px-5 py-3 border-b border-gray-100 flex items-center justify-between hover:bg-gray-50 transition-colors">
        <div className="flex items-center gap-3">
          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${color}`}>{title}</span>
          {badge !== undefined && <span className="text-xs text-gray-400">{badge} records</span>}
        </div>
        {open ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
      </button>
      {open && children}
    </div>
  );
}

function EmptyRow({ msg }: { msg: string }) {
  return <div className="text-center py-6 text-gray-400 text-sm">{msg}</div>;
}

function TH({ children, right }: { children: React.ReactNode; right?: boolean }) {
  return <th className={`px-3 py-2 font-semibold text-xs text-gray-500 ${right ? "text-right" : "text-left"} whitespace-nowrap`}>{children}</th>;
}
function TD({ children, right, mono, orange, green, bold }: { children?: React.ReactNode; right?: boolean; mono?: boolean; orange?: boolean; green?: boolean; bold?: boolean }) {
  return <td className={`px-3 py-2 text-sm ${right ? "text-right" : ""} ${mono ? "font-mono text-xs" : ""} ${orange ? "text-orange-600" : ""} ${green ? "text-green-600" : ""} ${bold ? "font-semibold" : ""}`}>{children}</td>;
}

export default function GSTR1() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [activeHsnTab, setActiveHsnTab] = useState<"b2b"|"b2c">("b2b");

  const load = () => {
    setLoading(true);
    api.get<any>(`/gst/gstr1?month=${month}&year=${year}`)
      .then(setData).catch(console.error).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [month, year]);

  // ── Excel export (multi-sheet) ────────────────────────────────────────────
  const exportExcel = () => {
    if (!data) return;
    const wb = XLSX.utils.book_new();

    // Sheet 1: 4A B2B
    const b2bRows = (data.b2b || []).map((b: any, i: number) => ({
      "Sr": i + 1,
      "GSTIN": b.gstin,
      "Party Name": b.partyName,
      "Invoice No": b.invoiceNumber,
      "Invoice Date": b.invoiceDate,
      "Invoice Value": b.invoiceValue,
      "Place of Supply": b.placeOfSupply ? `${b.placeOfSupply}-${b.placeOfSupplyName}` : "",
      "Rev Charge": b.reverseCharge,
      "Taxable Value": b.taxableValue,
      "IGST": b.igst || 0,
      "CGST": b.cgst || 0,
      "SGST": b.sgst || 0,
    }));
    if (b2bRows.length) {
      const ws1 = XLSX.utils.json_to_sheet(b2bRows);
      XLSX.utils.book_append_sheet(wb, ws1, "4A B2B");
    }

    // Sheet 2: 7 B2C Others
    const b2cRows = (data.b2cOthers || []).map((b: any, i: number) => ({
      "Sr": i + 1,
      "State": `${b.stateCode}-${b.stateName}`,
      "Rate (%)": b.rate,
      "Taxable Value": b.taxableValue,
      "IGST": b.igst || 0,
      "CGST": b.cgst || 0,
      "SGST": b.sgst || 0,
    }));
    if (b2cRows.length) {
      const ws2 = XLSX.utils.json_to_sheet(b2cRows);
      XLSX.utils.book_append_sheet(wb, ws2, "7 B2C Others");
    }

    // Sheet 3: 9B CDNR
    const cdnrRows = (data.cdnr || []).map((n: any, i: number) => ({
      "Sr": i + 1,
      "GSTIN": n.gstin,
      "Party": n.partyName,
      "Note No": n.noteNumber,
      "Note Date": n.noteDate,
      "Type": n.noteTypeName,
      "Note Value": n.noteValue,
      "Taxable Value": n.taxableValue,
      "IGST": n.igst || 0,
      "CGST": n.cgst || 0,
      "SGST": n.sgst || 0,
    }));
    if (cdnrRows.length) {
      const ws3 = XLSX.utils.json_to_sheet(cdnrRows);
      XLSX.utils.book_append_sheet(wb, ws3, "9B CDNR");
    }

    // Sheet 4: 9B CDNUR
    const cdnurRows = (data.cdnur || []).map((n: any, i: number) => ({
      "Sr": i + 1,
      "Party": n.partyName,
      "Note No": n.noteNumber,
      "Note Date": n.noteDate,
      "Type": n.noteTypeName,
      "Note Value": n.noteValue,
      "Taxable Value": n.taxableValue,
      "IGST": n.igst || 0,
      "CGST": n.cgst || 0,
      "SGST": n.sgst || 0,
    }));
    if (cdnurRows.length) {
      const ws4 = XLSX.utils.json_to_sheet(cdnurRows);
      XLSX.utils.book_append_sheet(wb, ws4, "9B CDNUR");
    }

    // Sheet 5: 12 HSN B2B
    const hsnB2BRows = (data.hsnSummaryB2B || []).map((h: any, i: number) => ({
      "Sr": i + 1,
      "HSN/SAC": h.hsn,
      "Description": h.description,
      "UQC": h.uqc,
      "Total Qty": h.qty,
      "Rate (%)": h.rate,
      "Taxable Value": h.taxableValue,
      "IGST": h.igst || 0,
      "CGST": h.cgst || 0,
      "SGST": h.sgst || 0,
      "Cess": 0,
    }));
    if (hsnB2BRows.length) {
      const ws5 = XLSX.utils.json_to_sheet(hsnB2BRows);
      XLSX.utils.book_append_sheet(wb, ws5, "12 HSN B2B");
    }

    // Sheet 6: 12 HSN B2C
    const hsnB2CRows = (data.hsnSummaryB2C || []).map((h: any, i: number) => ({
      "Sr": i + 1,
      "HSN/SAC": h.hsn,
      "Description": h.description,
      "UQC": h.uqc,
      "Total Qty": h.qty,
      "Rate (%)": h.rate,
      "Taxable Value": h.taxableValue,
      "IGST": h.igst || 0,
      "CGST": h.cgst || 0,
      "SGST": h.sgst || 0,
      "Cess": 0,
    }));
    if (hsnB2CRows.length) {
      const ws6 = XLSX.utils.json_to_sheet(hsnB2CRows);
      XLSX.utils.book_append_sheet(wb, ws6, "12 HSN B2C");
    }

    // Sheet 7: 13 Documents Issued
    const docs = data.documentsIssued || {};
    const docTypes = [
      { label: "Sales Invoices", d: docs.invoices },
      { label: "Credit Notes", d: docs.creditNotes },
      { label: "Debit Notes", d: docs.debitNotes },
      { label: "Purchase Bills", d: docs.purchaseBills },
    ];
    const docRows = docTypes.filter(dt => dt.d).map(dt => ({
      "Document Type": dt.label,
      "From": dt.d.srFrom,
      "To": dt.d.srTo,
      "Total Issued": dt.d.totalIssued,
      "Cancelled": dt.d.cancelled,
      "Net Issued": dt.d.netIssued,
    }));
    if (docRows.length) {
      const ws7 = XLSX.utils.json_to_sheet(docRows);
      XLSX.utils.book_append_sheet(wb, ws7, "13 Documents");
    }

    if (wb.SheetNames.length === 0) {
      alert("Is mahine mein koi data nahi hai.");
      return;
    }

    XLSX.writeFile(wb, `GSTR1_${MONTHS[month - 1]}_${year}.xlsx`);
  };

  const exportJSON = async () => {
    const res = await api.get<any>(`/gst/gstr1/export?month=${month}&year=${year}`);
    const blob = new Blob([JSON.stringify(res.data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = res.filename; a.click();
    URL.revokeObjectURL(url);
  };

  const downloadCSV = async (section: "b2b" | "cdnr") => {
    const token = localStorage.getItem("erp_token") || "";
    const url = `/api/gst/gstr1/${section}-csv?month=${month}&year=${year}`;
    const resp = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (resp.status === 422) {
      const err = await resp.json().catch(() => ({}));
      alert(err.message || "Is mahine mein koi data nahi mila."); return;
    }
    if (!resp.ok) { alert("Export failed. Please try again."); return; }
    const blob = await resp.blob();
    const burl = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = burl;
    a.download = `GSTR1_${section.toUpperCase()}_${String(month).padStart(2,"0")}_${year}.csv`;
    a.click(); URL.revokeObjectURL(burl);
  };

  // HSN validation warnings
  const hsnWarnings: string[] = [];
  if (data) {
    const allHsn = [...(data.hsnSummaryB2B || []), ...(data.hsnSummaryB2C || [])];
    const missingHsn = allHsn.filter((h: any) => !h.hsn || h.hsn === "URP");
    if (missingHsn.length) hsnWarnings.push(`${missingHsn.length} HSN rows mein HSN code missing hai — item master update karo`);
    const missingUqc = allHsn.filter((h: any) => !h.uqc || h.uqc === "OTH");
    if (missingUqc.length) hsnWarnings.push(`${missingUqc.length} HSN rows mein UQC missing hai — item master mein unit set karo`);
  }

  return (
    <div className="max-w-6xl space-y-5">
      <div className="print:block hidden">
        <BusinessHeader title="GSTR-1 Return" period={`${MONTHS[month - 1]} ${year}`} />
      </div>

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">GSTR-1</h1>
          <p className="text-xs text-gray-400 mt-0.5">Outward Supplies Return — All Sections</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <select className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={month} onChange={e => setMonth(Number(e.target.value))}>
            {MONTHS.map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
          </select>
          <select className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={year} onChange={e => setYear(Number(e.target.value))}>
            {[2023, 2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <button onClick={exportExcel} disabled={!data}
            className="flex items-center gap-1.5 px-4 py-2 border border-green-400 text-green-700 bg-green-50 hover:bg-green-100 text-sm font-medium rounded-lg transition-colors disabled:opacity-40">
            <Download className="w-4 h-4" /> Excel (All Sections)
          </button>
          <button onClick={() => downloadCSV("b2b")} disabled={!data}
            className="flex items-center gap-1.5 px-3 py-2 border border-orange-300 text-orange-700 bg-orange-50 hover:bg-orange-100 text-xs font-medium rounded-lg transition-colors disabled:opacity-40">
            <FileText className="w-3.5 h-3.5" /> B2B CSV
          </button>
          <button onClick={() => downloadCSV("cdnr")} disabled={!data}
            className="flex items-center gap-1.5 px-3 py-2 border border-purple-300 text-purple-700 bg-purple-50 hover:bg-purple-100 text-xs font-medium rounded-lg transition-colors disabled:opacity-40">
            <FileText className="w-3.5 h-3.5" /> CDNR CSV
          </button>
          <button onClick={exportJSON} disabled={!data}
            className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-lg transition-colors disabled:opacity-40">
            <FileJson className="w-3.5 h-3.5" /> GST Portal JSON
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48"><Loader2 className="w-5 h-5 animate-spin text-blue-500" /></div>
      ) : data && (
        <div className="space-y-4">

          {/* Validation Warnings */}
          {hsnWarnings.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-5 py-3 space-y-1">
              {hsnWarnings.map((w, i) => (
                <div key={i} className="flex items-center gap-2 text-sm text-amber-800">
                  <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0" />
                  {w}
                </div>
              ))}
            </div>
          )}

          {/* Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: "Total Invoices", value: String(data.summary?.totalInvoices || 0), sub: `B2B: ${data.summary?.b2bCount || 0} | B2C: ${data.summary?.b2cCount || 0}`, color: "text-blue-700 bg-blue-50 border-blue-200" },
              { label: "Taxable Value", value: fmt.currency(data.summary?.totalTaxableValue), sub: "All invoices", color: "text-gray-700 bg-gray-50 border-gray-200" },
              { label: "IGST (Inter-state)", value: fmt.currency(data.summary?.totalIgst), sub: "Output tax", color: "text-orange-700 bg-orange-50 border-orange-200" },
              { label: "CGST + SGST", value: fmt.currency(r2((data.summary?.totalCgst || 0) + (data.summary?.totalSgst || 0))), sub: "Intra-state", color: "text-green-700 bg-green-50 border-green-200" },
            ].map((c, i) => (
              <div key={i} className={`rounded-xl border p-4 ${c.color}`}>
                <div className="text-xs font-medium mb-1 opacity-70">{c.label}</div>
                <div className="text-lg font-bold">{c.value}</div>
                <div className="text-xs opacity-60 mt-0.5">{c.sub}</div>
              </div>
            ))}
          </div>

          {/* Section 4A: B2B Invoices */}
          <SectionBox title="Section 4A — B2B Invoices" badge={data.b2b?.length} color="bg-blue-100 text-blue-800">
            {(data.b2b?.length || 0) === 0 ? <EmptyRow msg="Is mahine mein koi B2B invoice nahi (registered GSTIN party)" /> : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-100">
                    <tr>
                      <TH>GSTIN</TH><TH>Party Name</TH><TH>Invoice No</TH><TH>Date</TH>
                      <TH right>Invoice Value</TH><TH>POS</TH><TH right>Taxable Value</TH>
                      <TH right>IGST</TH><TH right>CGST</TH><TH right>SGST</TH>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {data.b2b.map((b: any, i: number) => (
                      <tr key={i} className="hover:bg-blue-50/30">
                        <TD mono>{b.gstin}</TD>
                        <TD><span className="font-medium text-gray-800">{b.partyName}</span></TD>
                        <TD mono>{b.invoiceNumber}</TD>
                        <TD><span className="text-gray-500">{fmt.date(b.invoiceDate)}</span></TD>
                        <TD right bold>{fmt.currency(b.invoiceValue)}</TD>
                        <TD><span className="text-xs text-gray-500">{b.placeOfSupply}{b.placeOfSupplyName ? `-${b.placeOfSupplyName}` : ""}</span></TD>
                        <TD right>{fmt.currency(b.taxableValue)}</TD>
                        <TD right orange>{b.igst > 0 ? fmt.currency(b.igst) : "—"}</TD>
                        <TD right green>{b.cgst > 0 ? fmt.currency(b.cgst) : "—"}</TD>
                        <TD right green>{b.sgst > 0 ? fmt.currency(b.sgst) : "—"}</TD>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-gray-50 border-t-2 border-gray-200">
                    <tr>
                      <TD mono></TD><TD></TD><TD mono></TD><TD></TD>
                      <TD right bold>{fmt.currency(data.b2b.reduce((s: number, b: any) => s + b.invoiceValue, 0))}</TD>
                      <TD></TD>
                      <TD right bold>{fmt.currency(data.b2b.reduce((s: number, b: any) => s + b.taxableValue, 0))}</TD>
                      <TD right bold>{fmt.currency(data.b2b.reduce((s: number, b: any) => s + b.igst, 0))}</TD>
                      <TD right bold>{fmt.currency(data.b2b.reduce((s: number, b: any) => s + b.cgst, 0))}</TD>
                      <TD right bold>{fmt.currency(data.b2b.reduce((s: number, b: any) => s + b.sgst, 0))}</TD>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </SectionBox>

          {/* Section 7: B2C Others */}
          <SectionBox title="Section 7 — B2C Others (State-wise)" badge={data.b2cOthers?.length} color="bg-purple-100 text-purple-800">
            {(data.b2cOthers?.length || 0) === 0 ? <EmptyRow msg="Is mahine mein koi B2C invoice nahi" /> : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-100">
                    <tr>
                      <TH>State (Place of Supply)</TH><TH right>Rate (%)</TH>
                      <TH right>Taxable Value</TH><TH right>IGST</TH><TH right>CGST</TH><TH right>SGST</TH>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {data.b2cOthers.map((b: any, i: number) => (
                      <tr key={i} className="hover:bg-purple-50/30">
                        <TD><span className="font-medium">{b.stateCode} — {b.stateName}</span></TD>
                        <TD right><span className="text-xs font-bold bg-gray-100 px-2 py-0.5 rounded">{b.rate}%</span></TD>
                        <TD right bold>{fmt.currency(b.taxableValue)}</TD>
                        <TD right orange>{fmtN(b.igst)}</TD>
                        <TD right green>{fmtN(b.cgst)}</TD>
                        <TD right green>{fmtN(b.sgst)}</TD>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-gray-50 border-t-2 border-gray-200">
                    <tr>
                      <TD></TD><TD right bold>TOTAL</TD>
                      <TD right bold>{fmt.currency(data.b2cOthers.reduce((s: number, b: any) => s + b.taxableValue, 0))}</TD>
                      <TD right bold>{fmt.currency(data.b2cOthers.reduce((s: number, b: any) => s + b.igst, 0))}</TD>
                      <TD right bold>{fmt.currency(data.b2cOthers.reduce((s: number, b: any) => s + b.cgst, 0))}</TD>
                      <TD right bold>{fmt.currency(data.b2cOthers.reduce((s: number, b: any) => s + b.sgst, 0))}</TD>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </SectionBox>

          {/* Section 9B: CDNR + CDNUR */}
          <SectionBox title="Section 9B — Credit / Debit Notes" badge={(data.cdnr?.length || 0) + (data.cdnur?.length || 0)} color="bg-red-100 text-red-800" defaultOpen={false}>
            {/* CDNR - Registered */}
            <div className="px-5 py-3 border-b border-gray-100">
              <span className="text-xs font-semibold text-gray-600">9B-CDNR — Registered Parties ({data.cdnr?.length || 0})</span>
            </div>
            {(data.cdnr?.length || 0) === 0 ? <EmptyRow msg="Koi CDNR nahi (registered party C/D notes)" /> : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-100">
                    <tr><TH>GSTIN</TH><TH>Party</TH><TH>Note No</TH><TH>Date</TH><TH>Type</TH><TH right>Note Value</TH><TH right>Taxable</TH><TH right>IGST</TH><TH right>CGST</TH><TH right>SGST</TH></tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {data.cdnr.map((n: any, i: number) => (
                      <tr key={i} className="hover:bg-red-50/20">
                        <TD mono>{n.gstin}</TD><TD>{n.partyName}</TD><TD mono>{n.noteNumber}</TD>
                        <TD><span className="text-gray-500">{fmt.date(n.noteDate)}</span></TD>
                        <TD><span className={`text-xs font-bold px-2 py-0.5 rounded-full ${n.noteType==="C"?"bg-red-100 text-red-700":"bg-blue-100 text-blue-700"}`}>{n.noteTypeName}</span></TD>
                        <TD right bold>{fmt.currency(n.noteValue)}</TD><TD right>{fmt.currency(n.taxableValue)}</TD>
                        <TD right orange>{fmtN(n.igst)}</TD><TD right green>{fmtN(n.cgst)}</TD><TD right green>{fmtN(n.sgst)}</TD>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {/* CDNUR - Unregistered */}
            <div className="px-5 py-3 border-t border-b border-gray-100">
              <span className="text-xs font-semibold text-gray-600">9B-CDNUR — Unregistered Parties ({data.cdnur?.length || 0})</span>
            </div>
            {(data.cdnur?.length || 0) === 0 ? <EmptyRow msg="Koi CDNUR nahi (unregistered party C/D notes)" /> : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-100">
                    <tr><TH>Party</TH><TH>Note No</TH><TH>Date</TH><TH>Type</TH><TH right>Note Value</TH><TH right>Taxable</TH><TH right>IGST</TH><TH right>CGST</TH><TH right>SGST</TH></tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {data.cdnur.map((n: any, i: number) => (
                      <tr key={i} className="hover:bg-red-50/20">
                        <TD>{n.partyName}</TD><TD mono>{n.noteNumber}</TD>
                        <TD><span className="text-gray-500">{fmt.date(n.noteDate)}</span></TD>
                        <TD><span className={`text-xs font-bold px-2 py-0.5 rounded-full ${n.noteType==="C"?"bg-red-100 text-red-700":"bg-blue-100 text-blue-700"}`}>{n.noteTypeName}</span></TD>
                        <TD right bold>{fmt.currency(n.noteValue)}</TD><TD right>{fmt.currency(n.taxableValue)}</TD>
                        <TD right orange>{fmtN(n.igst)}</TD><TD right green>{fmtN(n.cgst)}</TD><TD right green>{fmtN(n.sgst)}</TD>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </SectionBox>

          {/* Section 12: HSN Summary */}
          <SectionBox title="Section 12 — HSN-wise Summary" badge={(data.hsnSummaryB2B?.length || 0) + (data.hsnSummaryB2C?.length || 0)} color="bg-teal-100 text-teal-800">
            {/* Tabs */}
            <div className="flex border-b border-gray-100">
              {([["b2b","B2B (Registered)"], ["b2c","B2C (Unregistered)"]] as const).map(([tab, label]) => (
                <button key={tab} onClick={() => setActiveHsnTab(tab)}
                  className={`px-5 py-2.5 text-sm font-medium border-b-2 transition-colors ${activeHsnTab === tab ? "border-teal-500 text-teal-700" : "border-transparent text-gray-500 hover:text-gray-700"}`}>
                  {label} ({tab === "b2b" ? data.hsnSummaryB2B?.length || 0 : data.hsnSummaryB2C?.length || 0})
                </button>
              ))}
            </div>
            {(() => {
              const rows: any[] = activeHsnTab === "b2b" ? (data.hsnSummaryB2B || []) : (data.hsnSummaryB2C || []);
              if (rows.length === 0) return <EmptyRow msg={`Is mahine mein koi ${activeHsnTab.toUpperCase()} HSN data nahi`} />;

              // Group rows by HSN code
              const grouped: Map<string, any[]> = new Map();
              for (const r of rows) {
                const key = r.hsn;
                if (!grouped.has(key)) grouped.set(key, []);
                grouped.get(key)!.push(r);
              }

              let srNo = 0;
              const tableRows: React.ReactNode[] = [];

              for (const [hsn, hsnRows] of grouped) {
                const multiRate = hsnRows.length > 1;

                hsnRows.forEach((h: any, idx: number) => {
                  srNo++;
                  const isFirst = idx === 0;
                  tableRows.push(
                    <tr key={`${hsn}-${h.rate}`} className={`hover:bg-teal-50/30 ${isFirst && multiRate ? "border-t-2 border-teal-100" : ""}`}>
                      <TD><span className="text-gray-400 text-xs">{isFirst ? srNo : ""}</span></TD>
                      <TD>
                        {isFirst
                          ? <span className={`font-mono font-bold text-sm ${h.hsn === "URP" ? "text-red-500" : "text-teal-700"}`}>{h.hsn}</span>
                          : <span className="text-gray-300 text-xs pl-3">↳</span>
                        }
                      </TD>
                      <TD><span className="text-gray-600 text-xs">{isFirst ? h.description : ""}</span></TD>
                      <TD><span className={`text-xs font-semibold ${h.uqc === "OTH" ? "text-amber-600" : "text-gray-600"}`}>{h.uqc}</span></TD>
                      <TD right bold>{h.qty.toLocaleString("en-IN")}</TD>
                      <TD right>
                        <span className={`text-xs px-2 py-0.5 rounded font-bold ${h.rate === 0 ? "bg-gray-100 text-gray-500" : h.rate <= 5 ? "bg-green-100 text-green-700" : h.rate <= 12 ? "bg-blue-100 text-blue-700" : h.rate <= 18 ? "bg-orange-100 text-orange-700" : "bg-red-100 text-red-700"}`}>
                          {h.rate}%
                        </span>
                      </TD>
                      <TD right bold>{fmt.currency(h.taxableValue)}</TD>
                      <TD right orange>{fmtN(h.igst)}</TD>
                      <TD right green>{fmtN(h.cgst)}</TD>
                      <TD right green>{fmtN(h.sgst)}</TD>
                    </tr>
                  );
                });

                // HSN subtotal row — only when multiple rates exist
                if (multiRate) {
                  const sub = hsnRows.reduce((acc: any, h: any) => ({
                    qty: acc.qty + h.qty,
                    taxableValue: acc.taxableValue + h.taxableValue,
                    igst: acc.igst + h.igst,
                    cgst: acc.cgst + h.cgst,
                    sgst: acc.sgst + h.sgst,
                  }), { qty: 0, taxableValue: 0, igst: 0, cgst: 0, sgst: 0 });
                  tableRows.push(
                    <tr key={`${hsn}-subtotal`} className="bg-teal-50 border-t border-teal-200">
                      <TD></TD>
                      <TD><span className="text-xs font-bold text-teal-700">{hsn} Total</span></TD>
                      <TD></TD><TD></TD>
                      <TD right><span className="font-bold text-sm text-teal-800">{sub.qty.toLocaleString("en-IN")}</span></TD>
                      <TD right><span className="text-xs text-teal-600 font-semibold">{hsnRows.length} rates</span></TD>
                      <TD right><span className="font-bold text-teal-800">{fmt.currency(sub.taxableValue)}</span></TD>
                      <TD right><span className="font-bold text-orange-700">{fmtN(sub.igst)}</span></TD>
                      <TD right><span className="font-bold text-green-700">{fmtN(sub.cgst)}</span></TD>
                      <TD right><span className="font-bold text-green-700">{fmtN(sub.sgst)}</span></TD>
                    </tr>
                  );
                }
              }

              return (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b border-gray-100">
                      <tr>
                        <TH>Sr</TH><TH>HSN/SAC</TH><TH>Description</TH><TH>UQC</TH>
                        <TH right>Qty</TH><TH right>GST %</TH><TH right>Taxable Value</TH>
                        <TH right>IGST</TH><TH right>CGST</TH><TH right>SGST</TH>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {tableRows}
                    </tbody>
                    <tfoot className="bg-gray-50 border-t-2 border-gray-200">
                      <tr>
                        <TD></TD>
                        <TD><span className="text-xs font-bold text-gray-600">Grand Total</span></TD>
                        <TD></TD><TD></TD>
                        <TD right bold>{rows.reduce((s: number, h: any) => s + h.qty, 0).toLocaleString("en-IN")}</TD>
                        <TD right><span className="text-xs text-gray-500">{grouped.size} HSN</span></TD>
                        <TD right bold>{fmt.currency(rows.reduce((s: number, h: any) => s + h.taxableValue, 0))}</TD>
                        <TD right bold>{fmt.currency(rows.reduce((s: number, h: any) => s + h.igst, 0))}</TD>
                        <TD right bold>{fmt.currency(rows.reduce((s: number, h: any) => s + h.cgst, 0))}</TD>
                        <TD right bold>{fmt.currency(rows.reduce((s: number, h: any) => s + h.sgst, 0))}</TD>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              );
            })()}
          </SectionBox>

          {/* Section 13: Documents Issued */}
          <SectionBox title="Section 13 — Documents Issued" color="bg-gray-100 text-gray-700" defaultOpen={false}>
            {(() => {
              const docs = data.documentsIssued || {};
              const items = [
                { label: "Sales Invoices", d: docs.invoices, color: "blue" },
                { label: "Credit Notes", d: docs.creditNotes, color: "red" },
                { label: "Debit Notes", d: docs.debitNotes, color: "orange" },
                { label: "Purchase Bills", d: docs.purchaseBills, color: "purple" },
              ].filter(x => x.d);
              if (items.length === 0) return <EmptyRow msg="Is mahine mein koi documents nahi" />;
              return (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b border-gray-100">
                      <tr>
                        <TH>Document Type</TH><TH>From (Sr No)</TH><TH>To (Sr No)</TH>
                        <TH right>Total Issued</TH><TH right>Cancelled</TH><TH right>Net Issued</TH>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {items.flatMap((x, i) => {
                        const ranges: any[] = x.d.ranges?.length ? x.d.ranges : [{ srFrom: x.d.srFrom, srTo: x.d.srTo, totalIssued: x.d.totalIssued, cancelled: x.d.cancelled, netIssued: x.d.netIssued }];
                        return ranges.map((rng, ri) => (
                          <tr key={`${i}-${ri}`} className="hover:bg-gray-50">
                            {ri === 0
                              ? <td className="px-3 py-2 text-sm font-semibold text-gray-800" rowSpan={ranges.length}>{x.label}</td>
                              : null}
                            <TD mono>{rng.srFrom}</TD><TD mono>{rng.srTo}</TD>
                            <TD right bold>{rng.totalIssued}</TD>
                            <TD right><span className={rng.cancelled > 0 ? "text-red-600 font-semibold" : "text-gray-400"}>{rng.cancelled}</span></TD>
                            <TD right bold>{rng.netIssued}</TD>
                          </tr>
                        ));
                      })}
                    </tbody>
                  </table>
                </div>
              );
            })()}
          </SectionBox>

        </div>
      )}
    </div>
  );
}
