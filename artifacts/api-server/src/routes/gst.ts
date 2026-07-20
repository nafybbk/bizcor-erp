import { Router } from "express";
import { db, sqlite } from "@workspace/db";
import { vouchersTable, voucherItemsTable, partiesTable, businessesTable, hsnCodesTable, hsnDirectoryTable } from "@workspace/db";
import { eq, and, sql, gte, lte, isNull, inArray } from "drizzle-orm";
import { requireBusiness } from "../middlewares/auth";

function extractNum(v: string): number {
  const m = v.match(/(\d+)$/);
  return m ? parseInt(m[1], 10) : NaN;
}

// Section 13 (Documents Issued) range-builder — shared by the preview and
// export routes so their numbers can never drift apart again.
//
// A voucher number sitting in the Bin (soft-deleted) is treated as never
// really issued — it breaks the series (new range starts after it) and is
// NOT counted as "cancelled". A voucher number with no DB record at all
// (fully gone, not even in the Bin) is treated as a formally cancelled GST
// document — it stays inside the current range and IS counted as
// "cancelled", so the series numbering itself doesn't break.
type DocRow = { voucherNumber: string; deletedAt: unknown };
interface DocRange { from: string; to: string; total: number; cancel: number }
function buildDocRanges(docs: DocRow[]): DocRange[] {
  if (!docs.length) return [];
  const numMap = new Map<number, DocRow>();
  const nonNumeric: DocRow[] = [];
  for (const d of docs) {
    const n = extractNum(d.voucherNumber);
    if (isNaN(n)) { nonNumeric.push(d); continue; }
    const existing = numMap.get(n);
    // If a number appears twice (shouldn't normally), prefer the active row.
    if (!existing || (existing.deletedAt !== null && d.deletedAt === null)) numMap.set(n, d);
  }
  const templateDoc = docs.find(d => !isNaN(extractNum(d.voucherNumber)));
  const numberFromTemplate = (n: number): string => {
    if (!templateDoc) return String(n);
    const m = templateDoc.voucherNumber.match(/^(.*?)(\d+)$/);
    if (!m) return String(n);
    return `${m[1]}${String(n).padStart(m[2].length, "0")}`;
  };

  const nums = [...numMap.keys()].sort((a, b) => a - b);
  type Acc = { fromNum: number; toNum: number; total: number; cancel: number };
  const acc: Acc[] = [];
  let cur: Acc | null = null;
  if (nums.length > 0) {
    const minNum = nums[0], maxNum = nums[nums.length - 1];
    for (let n = minNum; n <= maxNum; n++) {
      const entry = numMap.get(n);
      if (entry && entry.deletedAt !== null) {
        // In the Bin — breaks the series, doesn't count as cancelled.
        if (cur) { acc.push(cur); cur = null; }
        continue;
      }
      // Active record, or no record at all (= formally cancelled, stays in range).
      if (!cur) cur = { fromNum: n, toNum: n, total: 0, cancel: 0 };
      cur.toNum = n;
      cur.total++;
      if (!entry) cur.cancel++;
    }
    if (cur) acc.push(cur);
  }

  const ranges: DocRange[] = acc.map(r => ({
    from: numberFromTemplate(r.fromNum),
    to: numberFromTemplate(r.toNum),
    total: r.total,
    cancel: r.cancel,
  }));
  for (const d of nonNumeric) {
    if (d.deletedAt !== null) continue; // in the Bin — not part of the reportable series
    ranges.push({ from: d.voucherNumber, to: d.voucherNumber, total: 1, cancel: 0 });
  }
  return ranges;
}

function formatPrintNumber(voucherNumber: string, biz: any): string {
  const showPrefix = biz?.printShowPrefix !== false;
  const showSeries = biz?.printShowSeries !== false;
  const showZeros  = biz?.printShowZeros  !== false;
  if (showPrefix && showSeries && showZeros) return voucherNumber;
  const sep = biz?.numberSeparator || "-";
  const parts = voucherNumber.split(sep);
  let remaining = [...parts];
  if (!showPrefix && remaining.length > 0 && isNaN(Number(remaining[0]))) remaining = remaining.slice(1);
  if (!showSeries && remaining.length > 1 && /^\d$/.test(remaining[0])) remaining = remaining.slice(1);
  if (!showZeros && remaining.length > 0) remaining[remaining.length - 1] = String(parseInt(remaining[remaining.length - 1], 10) || 0);
  return remaining.join(sep);
}

const router = Router();
router.use(requireBusiness);

// GSTIN must be exactly 15 alphanumeric chars. Aadhaar (12 digits), PAN (10), etc. = unregistered = B2C.
function isValidGSTIN(g: string | null | undefined): boolean {
  if (!g) return false;
  const clean = g.replace(/\s/g, "").toUpperCase();
  return clean.length === 15 && /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(clean);
}

function getMonthRange(month: number, year: number) {
  const from = `${year}-${String(month).padStart(2, "0")}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const to = `${year}-${String(month).padStart(2, "0")}-${lastDay}`;
  return { from, to };
}

router.get("/gstr1", async (req, res) => {
  try {
    const businessId = req.user!.businessId!;
    const month = Number(req.query.month);
    const year = Number(req.query.year);
    const { from, to } = getMonthRange(month, year);

    const [biz, invoices, notesRaw, docsAll] = await Promise.all([
      db.query.businessesTable.findFirst({ where: eq(businessesTable.id, businessId) }),
      // All sales invoices for the period (not deleted)
      db.select({
        id: vouchersTable.id, voucherNumber: vouchersTable.voucherNumber, date: vouchersTable.date,
        grandTotal: vouchersTable.grandTotal, taxableAmount: vouchersTable.taxableAmount,
        totalCgst: vouchersTable.totalCgst, totalSgst: vouchersTable.totalSgst, totalIgst: vouchersTable.totalIgst,
        isInterState: vouchersTable.isInterState, placeOfSupply: vouchersTable.placeOfSupply,
        partyName: partiesTable.name, partyGstin: partiesTable.gstin,
      }).from(vouchersTable).leftJoin(partiesTable, eq(vouchersTable.partyId, partiesTable.id))
        .where(and(eq(vouchersTable.businessId, businessId), eq(vouchersTable.voucherType, "sales_invoice"), gte(vouchersTable.date, from), lte(vouchersTable.date, to), isNull(vouchersTable.deletedAt))),
      // Credit + Debit notes for CDNR/CDNUR
      db.select({
        id: vouchersTable.id, voucherNumber: vouchersTable.voucherNumber, date: vouchersTable.date,
        voucherType: vouchersTable.voucherType,
        grandTotal: vouchersTable.grandTotal, taxableAmount: vouchersTable.taxableAmount,
        totalCgst: vouchersTable.totalCgst, totalSgst: vouchersTable.totalSgst, totalIgst: vouchersTable.totalIgst,
        placeOfSupply: vouchersTable.placeOfSupply,
        partyName: partiesTable.name, partyGstin: partiesTable.gstin,
      }).from(vouchersTable).leftJoin(partiesTable, eq(vouchersTable.partyId, partiesTable.id))
        .where(and(
          eq(vouchersTable.businessId, businessId),
          sql`${vouchersTable.voucherType} IN ('credit_note','debit_note')`,
          gte(vouchersTable.date, from), lte(vouchersTable.date, to), isNull(vouchersTable.deletedAt)
        )),
      // All vouchers (including cancelled) for Documents Issued count
      db.select({
        voucherType: vouchersTable.voucherType,
        voucherNumber: vouchersTable.voucherNumber,
        deletedAt: vouchersTable.deletedAt,
      }).from(vouchersTable)
        .where(and(eq(vouchersTable.businessId, businessId), gte(vouchersTable.date, from), lte(vouchersTable.date, to))),
    ]);

    // Fetch voucher items for all invoices + notes (HSN/qty/unit breakdown)
    const allVoucherIds = [...invoices.map(i => i.id), ...notesRaw.map(n => n.id)];
    const allItems = allVoucherIds.length > 0
      ? await db.select({
          voucherId: voucherItemsTable.voucherId,
          hsnCode: voucherItemsTable.hsnCode,
          itemName: voucherItemsTable.itemName,
          unit: voucherItemsTable.unit,
          taxRate: voucherItemsTable.taxRate,
          quantity: sql<string>`sum(${voucherItemsTable.quantity})`,
          taxableAmount: sql<string>`sum(${voucherItemsTable.taxableAmount})`,
          cgst: sql<string>`sum(${voucherItemsTable.cgst})`,
          sgst: sql<string>`sum(${voucherItemsTable.sgst})`,
          igst: sql<string>`sum(${voucherItemsTable.igst})`,
        }).from(voucherItemsTable)
          .where(inArray(voucherItemsTable.voucherId, allVoucherIds))
          .groupBy(voucherItemsTable.voucherId, voucherItemsTable.hsnCode, voucherItemsTable.itemName, voucherItemsTable.unit, voucherItemsTable.taxRate)
      : [];

    // Group items by voucherId for quick lookup
    const itemsByVoucher = new Map<number, typeof allItems>();
    for (const item of allItems) {
      if (!itemsByVoucher.has(item.voucherId)) itemsByVoucher.set(item.voucherId, []);
      itemsByVoucher.get(item.voucherId)!.push(item);
    }

    const round2 = (n: number) => Math.round(n * 100) / 100;

    // ── Section 4A: B2B invoices ─────────────────────────────────────────────
    const b2bInvoices = invoices.filter(i => isValidGSTIN(i.partyGstin));
    const b2cInvoices = invoices.filter(i => !isValidGSTIN(i.partyGstin));

    const b2b = b2bInvoices.map(i => ({
      gstin: i.partyGstin!.replace(/\s/g, "").toUpperCase(),
      partyName: i.partyName || "",
      invoiceNumber: formatPrintNumber(i.voucherNumber, biz),
      invoiceDate: i.date,
      invoiceValue: round2(Number(i.grandTotal)),
      placeOfSupply: i.placeOfSupply || "",
      placeOfSupplyName: STATE_NAMES[String(i.placeOfSupply || "").padStart(2, "0")] || "",
      reverseCharge: "N",
      taxableValue: round2(Number(i.taxableAmount)),
      cgst: round2(Number(i.totalCgst)),
      sgst: round2(Number(i.totalSgst)),
      igst: round2(Number(i.totalIgst)),
      items: (itemsByVoucher.get(i.id) || []).map(it => ({
        hsn: it.hsnCode || "",
        itemName: it.itemName,
        unit: it.unit || "",
        qty: round2(Number(it.quantity)),
        rate: round2(Number(it.taxRate)),
        taxableAmount: round2(Number(it.taxableAmount)),
        cgst: round2(Number(it.cgst)),
        sgst: round2(Number(it.sgst)),
        igst: round2(Number(it.igst)),
      })),
    }));

    // ── Section 7: B2C Others (state + rate consolidated) ───────────────────
    // Group B2C invoice items by placeOfSupply + taxRate
    const b2cOthersMap = new Map<string, { stateCode: string; stateName: string; rate: number; taxableValue: number; igst: number; cgst: number; sgst: number }>();
    for (const inv of b2cInvoices) {
      const items = itemsByVoucher.get(inv.id) || [];
      if (items.length > 0) {
        for (const item of items) {
          const posCode = String(inv.placeOfSupply || "").padStart(2, "0");
          const rate = round2(Number(item.taxRate));
          const key = `${posCode}|${rate}`;
          const existing = b2cOthersMap.get(key);
          if (existing) {
            existing.taxableValue = round2(existing.taxableValue + Number(item.taxableAmount));
            existing.igst = round2(existing.igst + Number(item.igst));
            existing.cgst = round2(existing.cgst + Number(item.cgst));
            existing.sgst = round2(existing.sgst + Number(item.sgst));
          } else {
            b2cOthersMap.set(key, {
              stateCode: posCode,
              stateName: STATE_NAMES[posCode] || posCode,
              rate,
              taxableValue: round2(Number(item.taxableAmount)),
              igst: round2(Number(item.igst)),
              cgst: round2(Number(item.cgst)),
              sgst: round2(Number(item.sgst)),
            });
          }
        }
      } else {
        // Fallback: use voucher-level totals
        const posCode = String(inv.placeOfSupply || "").padStart(2, "0");
        const key = `${posCode}|0`;
        const existing = b2cOthersMap.get(key);
        if (existing) {
          existing.taxableValue = round2(existing.taxableValue + Number(inv.taxableAmount));
          existing.igst = round2(existing.igst + Number(inv.totalIgst));
          existing.cgst = round2(existing.cgst + Number(inv.totalCgst));
          existing.sgst = round2(existing.sgst + Number(inv.totalSgst));
        } else {
          b2cOthersMap.set(key, {
            stateCode: posCode, stateName: STATE_NAMES[posCode] || posCode, rate: 0,
            taxableValue: round2(Number(inv.taxableAmount)),
            igst: round2(Number(inv.totalIgst)), cgst: round2(Number(inv.totalCgst)), sgst: round2(Number(inv.totalSgst)),
          });
        }
      }
    }
    const b2cOthers = Array.from(b2cOthersMap.values()).sort((a, b) => a.stateCode.localeCompare(b.stateCode) || a.rate - b.rate);

    // ── Section 9B: CDNR (registered) + CDNUR (unregistered) ────────────────
    const cdnr = notesRaw.filter(n => isValidGSTIN(n.partyGstin)).map(n => ({
      gstin: n.partyGstin!.replace(/\s/g, "").toUpperCase(),
      partyName: n.partyName || "",
      noteNumber: formatPrintNumber(n.voucherNumber, biz),
      noteDate: n.date,
      noteType: n.voucherType === "credit_note" ? "C" : "D",
      noteTypeName: n.voucherType === "credit_note" ? "Credit Note" : "Debit Note",
      noteValue: round2(Number(n.grandTotal)),
      placeOfSupply: n.placeOfSupply || "",
      taxableValue: round2(Number(n.taxableAmount)),
      cgst: round2(Number(n.totalCgst)),
      sgst: round2(Number(n.totalSgst)),
      igst: round2(Number(n.totalIgst)),
    }));

    const cdnur = notesRaw.filter(n => !isValidGSTIN(n.partyGstin)).map(n => ({
      partyName: n.partyName || "",
      noteNumber: formatPrintNumber(n.voucherNumber, biz),
      noteDate: n.date,
      noteType: n.voucherType === "credit_note" ? "C" : "D",
      noteTypeName: n.voucherType === "credit_note" ? "Credit Note" : "Debit Note",
      noteValue: round2(Number(n.grandTotal)),
      placeOfSupply: n.placeOfSupply || "",
      taxableValue: round2(Number(n.taxableAmount)),
      cgst: round2(Number(n.totalCgst)),
      sgst: round2(Number(n.totalSgst)),
      igst: round2(Number(n.totalIgst)),
    }));

    // ── Section 12: HSN Summary ──────────────────────────────────────────────
    function buildHsnSummary(voucherList: typeof invoices) {
      const hsnMap = new Map<string, { hsn: string; description: string; uqc: string; qty: number; rate: number; taxableValue: number; igst: number; cgst: number; sgst: number }>();
      for (const inv of voucherList) {
        const items = itemsByVoucher.get(inv.id) || [];
        for (const item of items) {
          const hsn = item.hsnCode || "URP";
          const uqc = item.unit || "OTH";
          const rate = round2(Number(item.taxRate));
          const key = `${hsn}|${uqc}|${rate}`;
          const existing = hsnMap.get(key);
          if (existing) {
            existing.qty = round2(existing.qty + Number(item.quantity));
            existing.taxableValue = round2(existing.taxableValue + Number(item.taxableAmount));
            existing.igst = round2(existing.igst + Number(item.igst));
            existing.cgst = round2(existing.cgst + Number(item.cgst));
            existing.sgst = round2(existing.sgst + Number(item.sgst));
          } else {
            hsnMap.set(key, {
              hsn, description: item.itemName, uqc, rate,
              qty: round2(Number(item.quantity)),
              taxableValue: round2(Number(item.taxableAmount)),
              igst: round2(Number(item.igst)),
              cgst: round2(Number(item.cgst)),
              sgst: round2(Number(item.sgst)),
            });
          }
        }
      }
      return Array.from(hsnMap.values()).sort((a, b) => a.hsn.localeCompare(b.hsn) || a.rate - b.rate);
    }

    const hsnSummaryB2B = buildHsnSummary(b2bInvoices);
    const hsnSummaryB2C = buildHsnSummary(b2cInvoices);

    // ── Section 13: Documents Issued ─────────────────────────────────────────
    function docsSummary(type: string) {
      const docs = docsAll.filter(d => d.voucherType === type);
      if (docs.length === 0) return null;
      const ranges = buildDocRanges(docs);
      if (!ranges.length) return null;
      const totalIssued = ranges.reduce((s, r) => s + r.total, 0);
      const cancelled = ranges.reduce((s, r) => s + r.cancel, 0);
      return {
        ranges: ranges.map(r => ({ srFrom: r.from, srTo: r.to, totalIssued: r.total, cancelled: r.cancel, netIssued: r.total - r.cancel })),
        srFrom: ranges[0].from,
        srTo: ranges[ranges.length - 1].to,
        totalIssued,
        cancelled,
        netIssued: totalIssued - cancelled,
      };
    }

    const documentsIssued = {
      invoices: docsSummary("sales_invoice"),
      creditNotes: docsSummary("credit_note"),
      debitNotes: docsSummary("debit_note"),
      purchaseBills: docsSummary("purchase_bill"),
    };

    // ── Summary totals ────────────────────────────────────────────────────────
    const summary = {
      totalInvoices: invoices.length,
      b2bCount: b2bInvoices.length,
      b2cCount: b2cInvoices.length,
      totalTaxableValue: round2(invoices.reduce((s, i) => s + Number(i.taxableAmount), 0)),
      totalCgst: round2(invoices.reduce((s, i) => s + Number(i.totalCgst), 0)),
      totalSgst: round2(invoices.reduce((s, i) => s + Number(i.totalSgst), 0)),
      totalIgst: round2(invoices.reduce((s, i) => s + Number(i.totalIgst), 0)),
      totalTax: round2(invoices.reduce((s, i) => s + Number(i.totalCgst) + Number(i.totalSgst) + Number(i.totalIgst), 0)),
    };

    res.json({ month, year, summary, b2b, b2cOthers, cdnr, cdnur, hsnSummaryB2B, hsnSummaryB2C, documentsIssued });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.get("/gstr3b", async (req, res) => {
  try {
    const businessId = req.user!.businessId!;
    const month = Number(req.query.month);
    const year = Number(req.query.year);
    const { from, to } = getMonthRange(month, year);
    const [sales] = await db.select({
      taxableAmount: sql<number>`coalesce(sum(${vouchersTable.taxableAmount}), 0)`,
      cgst: sql<number>`coalesce(sum(${vouchersTable.totalCgst}), 0)`,
      sgst: sql<number>`coalesce(sum(${vouchersTable.totalSgst}), 0)`,
      igst: sql<number>`coalesce(sum(${vouchersTable.totalIgst}), 0)`,
    }).from(vouchersTable).where(and(eq(vouchersTable.businessId, businessId), eq(vouchersTable.voucherType, "sales_invoice"), gte(vouchersTable.date, from), lte(vouchersTable.date, to), isNull(vouchersTable.deletedAt)));
    const [purchases] = await db.select({
      taxableAmount: sql<number>`coalesce(sum(${vouchersTable.taxableAmount}), 0)`,
      cgst: sql<number>`coalesce(sum(${vouchersTable.totalCgst}), 0)`,
      sgst: sql<number>`coalesce(sum(${vouchersTable.totalSgst}), 0)`,
      igst: sql<number>`coalesce(sum(${vouchersTable.totalIgst}), 0)`,
    }).from(vouchersTable).where(and(eq(vouchersTable.businessId, businessId), eq(vouchersTable.voucherType, "purchase_bill"), gte(vouchersTable.date, from), lte(vouchersTable.date, to), isNull(vouchersTable.deletedAt)));
    const taxPayable = {
      cgst: Math.max(0, Number(sales.cgst) - Number(purchases.cgst)),
      sgst: Math.max(0, Number(sales.sgst) - Number(purchases.sgst)),
      igst: Math.max(0, Number(sales.igst) - Number(purchases.igst)),
      total: 0,
    };
    taxPayable.total = taxPayable.cgst + taxPayable.sgst + taxPayable.igst;
    res.json({
      month, year,
      outwardSupplies: { taxableValue: Number(sales.taxableAmount), cgst: Number(sales.cgst), sgst: Number(sales.sgst), igst: Number(sales.igst) },
      inwardSupplies: { taxableValue: Number(purchases.taxableAmount), cgst: Number(purchases.cgst), sgst: Number(purchases.sgst), igst: Number(purchases.igst) },
      taxPayable,
      inputTaxCredit: { cgst: Number(purchases.cgst), sgst: Number(purchases.sgst), igst: Number(purchases.igst), total: Number(purchases.cgst) + Number(purchases.sgst) + Number(purchases.igst) },
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.get("/gstr1/export", async (req, res) => {
  try {
    const businessId = req.user!.businessId!;
    const month = Number(req.query.month);
    const year = Number(req.query.year);
    const { from, to } = getMonthRange(month, year);

    const voucherFields = {
      id: vouchersTable.id,
      voucherNumber: vouchersTable.voucherNumber,
      date: vouchersTable.date,
      voucherType: vouchersTable.voucherType,
      grandTotal: vouchersTable.grandTotal,
      taxableAmount: vouchersTable.taxableAmount,
      totalCgst: vouchersTable.totalCgst,
      totalSgst: vouchersTable.totalSgst,
      totalIgst: vouchersTable.totalIgst,
      placeOfSupply: vouchersTable.placeOfSupply,
      partyName: partiesTable.name,
      partyGstin: partiesTable.gstin,
    };

    const [biz, invoices, notesRaw, docsAll] = await Promise.all([
      db.query.businessesTable.findFirst({ where: eq(businessesTable.id, businessId) }),
      // Sales invoices
      db.select(voucherFields).from(vouchersTable)
        .leftJoin(partiesTable, eq(vouchersTable.partyId, partiesTable.id))
        .where(and(eq(vouchersTable.businessId, businessId), eq(vouchersTable.voucherType, "sales_invoice"), gte(vouchersTable.date, from), lte(vouchersTable.date, to), isNull(vouchersTable.deletedAt))),
      // Credit + Debit notes
      db.select(voucherFields).from(vouchersTable)
        .leftJoin(partiesTable, eq(vouchersTable.partyId, partiesTable.id))
        .where(and(eq(vouchersTable.businessId, businessId), sql`${vouchersTable.voucherType} IN ('credit_note','debit_note')`, gte(vouchersTable.date, from), lte(vouchersTable.date, to), isNull(vouchersTable.deletedAt))),
      // All vouchers for doc_issue section
      db.select({ voucherType: vouchersTable.voucherType, voucherNumber: vouchersTable.voucherNumber, deletedAt: vouchersTable.deletedAt })
        .from(vouchersTable).where(and(eq(vouchersTable.businessId, businessId), gte(vouchersTable.date, from), lte(vouchersTable.date, to))),
    ]);

    // Fetch items for invoices + notes grouped by (voucherId, hsnCode, taxRate)
    const allVoucherIds = [...invoices.map(i => i.id), ...notesRaw.map(n => n.id)];
    const allItems = allVoucherIds.length > 0
      ? await db.select({
          voucherId: voucherItemsTable.voucherId,
          hsnCode: voucherItemsTable.hsnCode,
          itemName: voucherItemsTable.itemName,
          unit: voucherItemsTable.unit,
          taxRate: voucherItemsTable.taxRate,
          quantity: sql<string>`sum(${voucherItemsTable.quantity})`,
          taxableAmount: sql<string>`sum(${voucherItemsTable.taxableAmount})`,
          cgst: sql<string>`sum(${voucherItemsTable.cgst})`,
          sgst: sql<string>`sum(${voucherItemsTable.sgst})`,
          igst: sql<string>`sum(${voucherItemsTable.igst})`,
        }).from(voucherItemsTable)
          .where(inArray(voucherItemsTable.voucherId, allVoucherIds))
          .groupBy(voucherItemsTable.voucherId, voucherItemsTable.hsnCode, voucherItemsTable.itemName, voucherItemsTable.unit, voucherItemsTable.taxRate)
      : [];

    const itemsByVoucher = new Map<number, typeof allItems>();
    for (const item of allItems) {
      if (!itemsByVoucher.has(item.voucherId)) itemsByVoucher.set(item.voucherId, []);
      itemsByVoucher.get(item.voucherId)!.push(item);
    }

    const round2 = (n: number) => Math.round(n * 100) / 100;
    const toGSTDate = (d: string) => { const p = d.split("-"); return p.length === 3 ? `${p[2]}-${p[1]}-${p[0]}` : d; };

    // Build itms array for a voucher (rate-wise breakdown)
    const buildItms = (voucherId: number, fallback: { taxableAmount: unknown; totalCgst: unknown; totalSgst: unknown; totalIgst: unknown }) => {
      const items = itemsByVoucher.get(voucherId);
      if (items && items.length > 0) {
        // Consolidate by taxRate
        const rateMap = new Map<number, { txval: number; camt: number; samt: number; iamt: number }>();
        for (const it of items) {
          const rt = round2(Number(it.taxRate ?? 0));
          const existing = rateMap.get(rt);
          if (existing) {
            existing.txval = round2(existing.txval + Number(it.taxableAmount));
            existing.camt  = round2(existing.camt  + Number(it.cgst));
            existing.samt  = round2(existing.samt  + Number(it.sgst));
            existing.iamt  = round2(existing.iamt  + Number(it.igst));
          } else {
            rateMap.set(rt, { txval: round2(Number(it.taxableAmount)), camt: round2(Number(it.cgst)), samt: round2(Number(it.sgst)), iamt: round2(Number(it.igst)) });
          }
        }
        // num must be unique per rate line — 501, 502, … (duplicate 501s on
        // multi-rate invoices get rejected by the portal)
        return Array.from(rateMap.entries()).map(([rt, d], i) => {
          const det: Record<string, number> = { rt, txval: d.txval, csamt: 0 };
          if (d.iamt) det.iamt = d.iamt;
          if (d.camt) { det.camt = d.camt; det.samt = d.samt; }
          return { num: 501 + i, itm_det: det };
        });
      }
      const fb = { rt: 0, txval: round2(Number(fallback.taxableAmount)), csamt: 0 } as Record<string, number>;
      const fi = round2(Number(fallback.totalIgst)); const fc = round2(Number(fallback.totalCgst)); const fs = round2(Number(fallback.totalSgst));
      if (fi) fb.iamt = fi; if (fc) { fb.camt = fc; fb.samt = fs; }
      return [{ num: 501, itm_det: fb }];
    };

    // ── B2B ──────────────────────────────────────────────────────────────────
    const b2bInvoices = invoices.filter(i => isValidGSTIN(i.partyGstin));
    const b2bMap = new Map<string, typeof b2bInvoices>();
    for (const inv of b2bInvoices) {
      const ctin = inv.partyGstin!.replace(/\s/g, "").toUpperCase();
      if (!b2bMap.has(ctin)) b2bMap.set(ctin, []);
      b2bMap.get(ctin)!.push(inv);
    }
    const b2b = Array.from(b2bMap.entries()).map(([ctin, invs]) => ({
      ctin,
      inv: invs.map(i => ({
        inum: formatPrintNumber(i.voucherNumber, biz),
        idt: toGSTDate(i.date),
        val: round2(Number(i.grandTotal)),
        pos: String(i.placeOfSupply || "00").padStart(2, "0"),
        rchrg: "N",
        inv_typ: "R",
        itms: buildItms(i.id, i),
      })),
    }));

    // ── B2CL (Section 5 — B2C Large: inter-state unregistered > ₹2.5L) ────────
    const B2CL_THRESHOLD = 250000;
    const b2cInvoices = invoices.filter(i => !isValidGSTIN(i.partyGstin));
    const b2clInvoices = b2cInvoices.filter(i => Number(i.totalIgst) > 0 && Number(i.grandTotal) > B2CL_THRESHOLD);
    const b2clMap = new Map<string, typeof b2clInvoices>();
    for (const inv of b2clInvoices) {
      const pos = String(inv.placeOfSupply || "00").padStart(2, "0");
      if (!b2clMap.has(pos)) b2clMap.set(pos, []);
      b2clMap.get(pos)!.push(inv);
    }
    const b2cl = Array.from(b2clMap.entries()).map(([pos, invs]) => ({
      pos,
      inv: invs.map(i => ({
        inum: formatPrintNumber(i.voucherNumber, biz),
        idt:  toGSTDate(i.date),
        val:  round2(Number(i.grandTotal)),
        pos,
        rchrg: "N",
        itms:  buildItms(i.id, i),
      })),
    }));

    // ── B2CS (Section 7 — B2C small: intra OR inter-state ≤ ₹2.5L, state+rate wise)
    const b2csInvoices = b2cInvoices.filter(i => !(Number(i.totalIgst) > 0 && Number(i.grandTotal) > B2CL_THRESHOLD));
    const b2csMap = new Map<string, { sply_ty: string; pos: string; rt: number; txval: number; camt: number; samt: number; iamt: number; csamt: number }>();
    for (const inv of b2csInvoices) {
      const pos = String(inv.placeOfSupply || "00").padStart(2, "0");
      const isInter = Number(inv.totalIgst) > 0;
      const sply_ty = isInter ? "INTER" : "INTRA";
      const items = itemsByVoucher.get(inv.id);
      const rateEntries = items && items.length > 0
        ? (() => { const m = new Map<number, { txval: number; camt: number; samt: number; iamt: number }>(); for (const it of items) { const rt = round2(Number(it.taxRate ?? 0)); const e = m.get(rt); if (e) { e.txval = round2(e.txval + Number(it.taxableAmount)); e.camt = round2(e.camt + Number(it.cgst)); e.samt = round2(e.samt + Number(it.sgst)); e.iamt = round2(e.iamt + Number(it.igst)); } else { m.set(rt, { txval: round2(Number(it.taxableAmount)), camt: round2(Number(it.cgst)), samt: round2(Number(it.sgst)), iamt: round2(Number(it.igst)) }); } } return Array.from(m.entries()); })()
        : [[0, { txval: round2(Number(inv.taxableAmount)), camt: round2(Number(inv.totalCgst)), samt: round2(Number(inv.totalSgst)), iamt: round2(Number(inv.totalIgst)) }]] as [number, { txval: number; camt: number; samt: number; iamt: number }][];
      for (const [rt, vals] of rateEntries) {
        const key = `${sply_ty}|${pos}|${rt}`;
        const e = b2csMap.get(key);
        if (e) { e.txval = round2(e.txval + vals.txval); e.camt = round2(e.camt + vals.camt); e.samt = round2(e.samt + vals.samt); e.iamt = round2(e.iamt + vals.iamt); }
        else b2csMap.set(key, { sply_ty, pos, rt: round2(rt), txval: vals.txval, camt: vals.camt, samt: vals.samt, iamt: vals.iamt, csamt: 0 });
      }
    }
    // Portal b2cs: typ="OE", include all tax fields (portal expects camt/samt even if 0 for INTER)
    const b2cs = Array.from(b2csMap.values()).map(e => ({
      sply_ty: e.sply_ty, pos: e.pos, typ: "OE",
      txval: e.txval, rt: e.rt,
      iamt: e.sply_ty === "INTER" ? e.iamt : 0,
      camt: e.sply_ty === "INTRA" ? e.camt : 0,
      samt: e.sply_ty === "INTRA" ? e.samt : 0,
      csamt: e.csamt,
    }));

    // ── CDNR (Section 9B — registered) ───────────────────────────────────────
    const cdnrNotes = notesRaw.filter(n => isValidGSTIN(n.partyGstin));
    const cdnrMap = new Map<string, typeof cdnrNotes>();
    for (const n of cdnrNotes) {
      const ctin = n.partyGstin!.replace(/\s/g, "").toUpperCase();
      if (!cdnrMap.has(ctin)) cdnrMap.set(ctin, []);
      cdnrMap.get(ctin)!.push(n);
    }
    const cdnr = Array.from(cdnrMap.entries()).map(([ctin, notes]) => ({
      ctin,
      nt: notes.map(n => ({
        ntty: n.voucherType === "credit_note" ? "C" : "D",
        nt_num: formatPrintNumber(n.voucherNumber, biz),
        nt_dt: toGSTDate(n.date),
        val: round2(Number(n.grandTotal)),
        pos: String(n.placeOfSupply || "00").padStart(2, "0"),
        rchrg: "N",
        inv_typ: "R",
        itms: buildItms(n.id, n),
      })),
    }));

    // ── CDNUR (Section 9B — unregistered) ────────────────────────────────────
    const cdnur = notesRaw.filter(n => !isValidGSTIN(n.partyGstin)).map(n => ({
      ntty: n.voucherType === "credit_note" ? "C" : "D",
      nt_num: formatPrintNumber(n.voucherNumber, biz),
      nt_dt: toGSTDate(n.date),
      typ: (Number(n.totalIgst) > 0 && Number(n.grandTotal) > B2CL_THRESHOLD) ? "B2CL" : "B2CS",
      val: round2(Number(n.grandTotal)),
      pos: String(n.placeOfSupply || "00").padStart(2, "0"),
      itms: buildItms(n.id, n),
    }));

    // ── HSN Summary (Section 12) — May 2025+ rule: B2B and B2C separate ────────
    // Portal schema (verified against a portal-generated offline download):
    // no `val` field, and `desc` must be the official HSN-directory
    // description — the portal rejects files where desc doesn't match.
    // We take it from the business's HSN master; user_desc stays the item name.
    let hsnDescByCode = new Map<string, string>();
    try {
      const hsnMasterRows = await db.select({ code: hsnCodesTable.code, description: hsnCodesTable.description })
        .from(hsnCodesTable).where(eq(hsnCodesTable.businessId, businessId));
      hsnDescByCode = new Map(hsnMasterRows.filter(h => h.description).map(h => [h.code.trim(), String(h.description).toUpperCase()]));
    } catch { /* HSN master table missing (older EXE DB) — fall back to item names */ }
    // Global directory (government list) OVERRIDES the business master —
    // official descriptions must win so stale item-name descriptions saved
    // earlier don't leak into the portal file; the business master only
    // covers codes the directory doesn't have.
    try {
      // SQLite: 999-param limit, and raw prepare avoids dialect quirks
      const usedCodes = ([...new Set(allItems.map(i => (i.hsnCode || "").trim()).filter(Boolean))] as string[]).slice(0, 900);
      if (usedCodes.length > 0) {
        let dirRows: { code: string; description: string | null }[];
        if (sqlite) {
          dirRows = sqlite.prepare(
            `SELECT code, description FROM hsn_directory WHERE code IN (${usedCodes.map(() => "?").join(",")})`
          ).all(...usedCodes) as { code: string; description: string | null }[];
        } else {
          dirRows = await db.select({ code: hsnDirectoryTable.code, description: hsnDirectoryTable.description })
            .from(hsnDirectoryTable).where(inArray(hsnDirectoryTable.code, usedCodes));
        }
        for (const d of dirRows) {
          if (d.description) hsnDescByCode.set(d.code.trim(), String(d.description).toUpperCase());
        }
      }
    } catch { /* directory table missing (older EXE DB) — non-fatal */ }

    type HsnRow = { hsn_sc: string; desc: string; user_desc: string; uqc: string; rt: number; qty: number; txval: number; iamt: number; camt: number; samt: number; csamt: number };
    function addToHsnMap(map: Map<string, HsnRow>, v: { id: number; partyGstin?: string | null }, isB2b: boolean, sign: 1 | -1 = 1) {
      const items = itemsByVoucher.get(v.id) || [];
      for (const it of items) {
        const hsn_sc = it.hsnCode || "";
        const uqc = (it.unit || "OTH").toUpperCase().substring(0, 3);
        const rt = round2(Number(it.taxRate ?? 0));
        const key = `${hsn_sc}|${uqc}|${rt}`;
        const txval = sign * round2(Number(it.taxableAmount));
        const iamt = sign * round2(Number(it.igst));
        const camt = sign * round2(Number(it.cgst));
        const samt = sign * round2(Number(it.sgst));
        const qty = sign * round2(Number(it.quantity));
        const e = map.get(key);
        if (e) {
          e.qty = round2(e.qty + qty);
          e.txval = round2(e.txval + txval); e.iamt = round2(e.iamt + iamt);
          e.camt = round2(e.camt + camt); e.samt = round2(e.samt + samt);
        } else {
          map.set(key, {
            hsn_sc,
            desc: hsnDescByCode.get(hsn_sc.trim()) || it.itemName || "",
            user_desc: it.itemName || "",
            uqc, rt, qty, txval, iamt, camt, samt, csamt: 0,
          });
        }
      }
    }
    const hsnB2bMap = new Map<string, HsnRow>();
    const hsnB2cMap = new Map<string, HsnRow>();
    for (const v of invoices) {
      if (isValidGSTIN(v.partyGstin)) addToHsnMap(hsnB2bMap, v, true);
      else addToHsnMap(hsnB2cMap, v, false);
    }
    for (const v of notesRaw) {
      // Credit notes reduce previously reported outward supply value; debit notes increase it.
      const sign: 1 | -1 = v.voucherType === "credit_note" ? -1 : 1;
      if (isValidGSTIN(v.partyGstin)) addToHsnMap(hsnB2bMap, v, true, sign);
      else addToHsnMap(hsnB2cMap, v, false, sign);
    }
    const hsnB2bData = Array.from(hsnB2bMap.values()).map((h, idx) => ({ num: idx + 1, ...h }));
    const hsnB2cData = Array.from(hsnB2cMap.values()).map((h, idx) => ({ num: idx + 1, ...h }));

    // ── Doc Issue (Section 13) ────────────────────────────────────────────────
    function buildDocIssue(type: string, docNum: number) {
      const docs = docsAll.filter(d => d.voucherType === type);
      if (!docs.length) return null;
      const ranges = buildDocRanges(docs);
      if (!ranges.length) return null;

      // GSTN doc_num list: 1=Invoices for outward supply, 4=Debit Note, 5=Credit Note.
      // Purchase bills are NOT documents issued by this taxpayer — the portal's
      // own generated file lists only outward docs, so we no longer send them.
      const docTypMap: Record<string, string> = { sales_invoice: "Invoices for outward supply", debit_note: "Debit Note", credit_note: "Credit Note" };
      return {
        doc_num: docNum,
        doc_typ: docTypMap[type] || "Invoices for outward supply",
        docs: ranges.map((r, idx) => ({
          num: idx + 1,
          from: formatPrintNumber(r.from, biz),
          to: formatPrintNumber(r.to, biz),
          totnum: r.total,
          cancel: r.cancel,
          net_issue: r.total - r.cancel,
        })),
      };
    }
    const docDetItems = [
      buildDocIssue("sales_invoice", 1),
      buildDocIssue("debit_note", 4),
      buildDocIssue("credit_note", 5),
    ].filter(Boolean);

    // ── Assemble portal JSON ──────────────────────────────────────────────────
    const gstrJson: Record<string, unknown> = {
      gstin:   biz?.gstin || "",
      fp:      `${String(month).padStart(2, "0")}${year}`,
      version: "GST3.2.4",
      hash:    "hash",
    };
    if (b2b.length)      gstrJson.b2b      = b2b;
    if (b2cl.length)     gstrJson.b2cl     = b2cl;
    if (b2cs.length)     gstrJson.b2cs     = b2cs;
    if (cdnr.length)     gstrJson.cdnr     = cdnr;
    if (cdnur.length)    gstrJson.cdnur    = cdnur;
    if (hsnB2bData.length || hsnB2cData.length) {
      const hsnObj: Record<string, unknown> = {};
      if (hsnB2bData.length) hsnObj.hsn_b2b = hsnB2bData;
      if (hsnB2cData.length) hsnObj.hsn_b2c = hsnB2cData;
      gstrJson.hsn = hsnObj;
    }
    if (docDetItems.length) gstrJson.doc_issue = { doc_det: docDetItems };

    const mm = String(month).padStart(2, "0");
    const filename = `GSTR1_${mm}_${year}_${(biz?.gstin || "GSTIN").replace(/\s/g, "")}.json`;
    res.json({ data: gstrJson, filename });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// State code → state name mapping (GSTN standard)
const STATE_NAMES: Record<string, string> = {
  "01": "Jammu And Kashmir", "02": "Himachal Pradesh", "03": "Punjab",
  "04": "Chandigarh", "05": "Uttarakhand", "06": "Haryana", "07": "Delhi",
  "08": "Rajasthan", "09": "Uttar Pradesh", "10": "Bihar", "11": "Sikkim",
  "12": "Arunachal Pradesh", "13": "Nagaland", "14": "Manipur", "15": "Mizoram",
  "16": "Tripura", "17": "Meghalaya", "18": "Assam", "19": "West Bengal",
  "20": "Jharkhand", "21": "Odisha", "22": "Chhattisgarh", "23": "Madhya Pradesh",
  "24": "Gujarat", "25": "Daman & Diu", "26": "Dadra And Nagar Haveli",
  "27": "Maharashtra", "28": "Andhra Pradesh (Old)", "29": "Karnataka",
  "30": "Goa", "31": "Lakshadweep", "32": "Kerala", "33": "Tamil Nadu",
  "34": "Puducherry", "35": "Andaman And Nicobar Islands", "36": "Telangana",
  "37": "Andhra Pradesh", "38": "Dadra And Nagar Haveli And Daman And Diu",
  "97": "Other Territory", "99": "Centre Jurisdiction",
};

const MONTH_ABBR = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function toGSTNDate(d: string): string {
  // Input: YYYY-MM-DD → Output: D-Mon-YY (no leading zero on day, per GSTN template)
  const parts = d.split("-");
  if (parts.length !== 3) return d;
  const day = String(parseInt(parts[2], 10)); // strip leading zero: "05" → "5"
  const mon = MONTH_ABBR[parseInt(parts[1], 10) - 1] || parts[1];
  const yr = parts[0].slice(2);
  return `${day}-${mon}-${yr}`;
}

function toGSTNPos(code: string, fallbackStateCode?: string): string {
  // Input: "27" → Output: "27-Maharashtra"
  // Tries the given code, then fallback, never returns bare code without state name
  const tryCode = (c: string) => {
    const padded = c.padStart(2, "0");
    return STATE_NAMES[padded] ? `${padded}-${STATE_NAMES[padded]}` : null;
  };
  return tryCode(String(code)) || tryCode(fallbackStateCode || "") || String(code);
}

function bizStateCode(gstin: string | null | undefined): string {
  // Extract 2-digit state code from GSTIN (first 2 chars)
  if (gstin && gstin.length >= 2) return gstin.slice(0, 2);
  return "";
}

function buildCSV(headers: string[], rows: string[][]): string {
  const escape = (v: string) => {
    if (v.includes(",") || v.includes('"') || v.includes("\n")) return `"${v.replace(/"/g, '""')}"`;
    return v;
  };
  const lines = [headers.join(","), ...rows.map(r => r.map(escape).join(","))];
  return lines.join("\r\n");
}

// GET /gst/gstr1/b2b-csv — B2B section CSV for GSTN Offline Tool
router.get("/gstr1/b2b-csv", async (req, res) => {
  try {
    const businessId = req.user!.businessId!;
    const month = Number(req.query.month);
    const year = Number(req.query.year);
    const { from, to } = getMonthRange(month, year);

    const [biz, invoices] = await Promise.all([
      db.query.businessesTable.findFirst({ where: eq(businessesTable.id, businessId) }),
      db.select({
        id: vouchersTable.id,
        voucherNumber: vouchersTable.voucherNumber,
        date: vouchersTable.date,
        grandTotal: vouchersTable.grandTotal,
        isInterState: vouchersTable.isInterState,
        placeOfSupply: vouchersTable.placeOfSupply,
        partyName: partiesTable.name,
        partyGstin: partiesTable.gstin,
      }).from(vouchersTable)
        .leftJoin(partiesTable, eq(vouchersTable.partyId, partiesTable.id))
        .where(and(
          eq(vouchersTable.businessId, businessId),
          eq(vouchersTable.voucherType, "sales_invoice"),
          gte(vouchersTable.date, from),
          lte(vouchersTable.date, to),
          isNull(vouchersTable.deletedAt),
        )),
    ]);

    // Only B2B — valid 15-char GSTIN parties (Aadhaar/PAN/empty = B2C, skip here)
    const b2bInvoices = invoices.filter(i => isValidGSTIN(i.partyGstin));
    const invoiceIds = b2bInvoices.map(i => i.id);

    const allItems = invoiceIds.length > 0
      ? await db.select({
          voucherId: voucherItemsTable.voucherId,
          taxRate: voucherItemsTable.taxRate,
          taxableAmount: sql<string>`sum(${voucherItemsTable.taxableAmount})`,
          cgst: sql<string>`sum(${voucherItemsTable.cgst})`,
          sgst: sql<string>`sum(${voucherItemsTable.sgst})`,
          igst: sql<string>`sum(${voucherItemsTable.igst})`,
        }).from(voucherItemsTable)
          .where(inArray(voucherItemsTable.voucherId, invoiceIds))
          .groupBy(voucherItemsTable.voucherId, voucherItemsTable.taxRate)
      : [];

    const itemsByVoucher = new Map<number, typeof allItems>();
    for (const item of allItems) {
      if (!itemsByVoucher.has(item.voucherId)) itemsByVoucher.set(item.voucherId, []);
      itemsByVoucher.get(item.voucherId)!.push(item);
    }

    // Business state code extracted from its GSTIN (first 2 chars) — used as POS fallback
    const sellerStateCode = bizStateCode(biz?.gstin);

    // Format number: remove trailing decimal zeros (18.00 → 18, 5.5 → 5.5)
    const fmtNum = (n: number) => {
      const r = Math.round(n * 100) / 100;
      return r % 1 === 0 ? String(Math.round(r)) : String(r);
    };

    const headers = [
      "GSTIN/UIN of Recipient", "Receiver Name", "Invoice Number", "Invoice date",
      "Invoice Value", "Place Of Supply", "Reverse Charge", "Applicable % of Tax Rate",
      "Invoice Type", "E-Commerce GSTIN", "Rate", "Taxable Value", "Cess Amount",
    ];

    const rows: string[][] = [];
    for (const inv of b2bInvoices) {
      // Include all B2B invoices — tool validates GSTIN format row-by-row
      if (!inv.partyGstin || !inv.partyGstin.trim()) continue;

      const ctin = inv.partyGstin.trim().toUpperCase();
      const inum = formatPrintNumber(inv.voucherNumber, biz);
      const idt = toGSTNDate(inv.date);
      const val = fmtNum(Number(inv.grandTotal));
      // POS: use invoice's placeOfSupply, fall back to buyer's state (from their GSTIN), then seller's state
      const buyerState = ctin.slice(0, 2);
      const pos = toGSTNPos(inv.placeOfSupply || buyerState, sellerStateCode);
      const invType = "Regular B2B";
      const items = itemsByVoucher.get(inv.id) || [];

      if (items.length > 0) {
        for (const item of items) {
          const txval = Number(item.taxableAmount);
          if (txval <= 0) continue; // skip zero-value rows
          rows.push([
            ctin, inv.partyName || "", inum, idt,
            val, pos, "N", "", invType, "",
            fmtNum(Number(item.taxRate ?? 0)),
            fmtNum(txval),
            "0",
          ]);
        }
      } else {
        const txval = Number(inv.grandTotal);
        rows.push([
          ctin, inv.partyName || "", inum, idt,
          val, pos, "N", "", invType, "",
          "0", fmtNum(txval), "0",
        ]);
      }
    }

    if (rows.length === 0) {
      // Return JSON so frontend can show a useful message instead of silently downloading empty CSV
      return res.status(422).json({
        error: "NO_B2B_DATA",
        message: `${month}/${year} mein koi B2B invoice nahi mila (GSTIN wale parties). Party master mein GSTIN fill karo ya invoice date check karo.`,
        invoicesFound: invoices.length,
        b2bInvoicesFound: b2bInvoices.length,
      });
    }

    const csv = buildCSV(headers, rows);
    const filename = `GSTR1_B2B_${String(month).padStart(2, "0")}_${year}.csv`;
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    return res.send(csv);
  } catch (err) {
    req.log.error(err);
    return res.status(500).json({ error: "Internal Server Error" });
  }
});

// GET /gst/gstr1/cdnr-csv — Credit Notes (CDNR) section CSV for GSTN Offline Tool
router.get("/gstr1/cdnr-csv", async (req, res) => {
  try {
    const businessId = req.user!.businessId!;
    const month = Number(req.query.month);
    const year = Number(req.query.year);
    const { from, to } = getMonthRange(month, year);

    const [biz, notes] = await Promise.all([
      db.query.businessesTable.findFirst({ where: eq(businessesTable.id, businessId) }),
      db.select({
        id: vouchersTable.id,
        voucherNumber: vouchersTable.voucherNumber,
        date: vouchersTable.date,
        grandTotal: vouchersTable.grandTotal,
        isInterState: vouchersTable.isInterState,
        placeOfSupply: vouchersTable.placeOfSupply,
        partyName: partiesTable.name,
        partyGstin: partiesTable.gstin,
      }).from(vouchersTable)
        .leftJoin(partiesTable, eq(vouchersTable.partyId, partiesTable.id))
        .where(and(
          eq(vouchersTable.businessId, businessId),
          eq(vouchersTable.voucherType, "credit_note"),
          gte(vouchersTable.date, from),
          lte(vouchersTable.date, to),
          isNull(vouchersTable.deletedAt),
        )),
    ]);

    const b2bNotes = notes.filter(n => isValidGSTIN(n.partyGstin));
    const noteIds = b2bNotes.map(n => n.id);

    const allItems = noteIds.length > 0
      ? await db.select({
          voucherId: voucherItemsTable.voucherId,
          taxRate: voucherItemsTable.taxRate,
          taxableAmount: sql<string>`sum(${voucherItemsTable.taxableAmount})`,
        }).from(voucherItemsTable)
          .where(inArray(voucherItemsTable.voucherId, noteIds))
          .groupBy(voucherItemsTable.voucherId, voucherItemsTable.taxRate)
      : [];

    const itemsByVoucher = new Map<number, typeof allItems>();
    for (const item of allItems) {
      if (!itemsByVoucher.has(item.voucherId)) itemsByVoucher.set(item.voucherId, []);
      itemsByVoucher.get(item.voucherId)!.push(item);
    }

    const round2 = (n: number) => String(Math.round(n * 100) / 100);

    const headers = [
      "GSTIN/UIN of Recipient", "Receiver Name", "Note Number", "Note Date",
      "Note Type", "Place Of Supply", "Reverse Charge", "Note Supply Type",
      "Note Value", "Applicable % of Tax Rate", "Rate", "Taxable Value", "Cess Amount",
    ];

    const rows: string[][] = [];
    for (const note of b2bNotes) {
      const nnum = formatPrintNumber(note.voucherNumber, biz);
      const ndt = toGSTNDate(note.date);
      const val = round2(Number(note.grandTotal));
      const pos = toGSTNPos(note.placeOfSupply || "");
      const items = itemsByVoucher.get(note.id) || [];

      if (items.length > 0) {
        for (const item of items) {
          rows.push([
            note.partyGstin!, note.partyName || "", nnum, ndt,
            "C", pos, "N", "Regular B2B",
            val, "", String(Number(item.taxRate ?? 0)),
            round2(Number(item.taxableAmount)), "",
          ]);
        }
      } else {
        rows.push([
          note.partyGstin!, note.partyName || "", nnum, ndt,
          "C", pos, "N", "Regular B2B",
          val, "", "0", "0", "",
        ]);
      }
    }

    const csv = buildCSV(headers, rows);
    const filename = `GSTR1_CDNR_${String(month).padStart(2, "0")}_${year}.csv`;
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(csv);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

export default router;
