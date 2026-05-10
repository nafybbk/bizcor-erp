import { Router } from "express";
import { db } from "@workspace/db";
import { vouchersTable, voucherItemsTable, partiesTable, businessesTable } from "@workspace/db";
import { eq, and, sql, gte, lte, isNull, inArray } from "drizzle-orm";
import { requireBusiness } from "../middlewares/auth";

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
    const [biz, invoices] = await Promise.all([
      db.query.businessesTable.findFirst({ where: eq(businessesTable.id, businessId) }),
      db.select({
        id: vouchersTable.id, voucherNumber: vouchersTable.voucherNumber, date: vouchersTable.date,
        grandTotal: vouchersTable.grandTotal, taxableAmount: vouchersTable.taxableAmount,
        totalCgst: vouchersTable.totalCgst, totalSgst: vouchersTable.totalSgst, totalIgst: vouchersTable.totalIgst,
        isInterState: vouchersTable.isInterState, placeOfSupply: vouchersTable.placeOfSupply,
        partyName: partiesTable.name, partyGstin: partiesTable.gstin,
      }).from(vouchersTable).leftJoin(partiesTable, eq(vouchersTable.partyId, partiesTable.id))
        .where(and(eq(vouchersTable.businessId, businessId), eq(vouchersTable.voucherType, "sales_invoice"), gte(vouchersTable.date, from), lte(vouchersTable.date, to), isNull(vouchersTable.deletedAt))),
    ]);
    const b2b = invoices.filter(i => isValidGSTIN(i.partyGstin)).map(i => ({
      gstin: i.partyGstin!.replace(/\s/g, "").toUpperCase(), partyName: i.partyName || "", invoiceNumber: formatPrintNumber(i.voucherNumber, biz), invoiceDate: i.date,
      invoiceValue: Number(i.grandTotal), placeOfSupply: i.placeOfSupply || "", reverseCharge: "N",
      taxableValue: Number(i.taxableAmount), cgst: Number(i.totalCgst), sgst: Number(i.totalSgst), igst: Number(i.totalIgst),
    }));
    const b2c = invoices.filter(i => !isValidGSTIN(i.partyGstin)).map(i => ({
      invoiceNumber: formatPrintNumber(i.voucherNumber, biz), invoiceDate: i.date, invoiceValue: Number(i.grandTotal),
      taxableValue: Number(i.taxableAmount), cgst: Number(i.totalCgst), sgst: Number(i.totalSgst), igst: Number(i.totalIgst),
    }));
    const summary = {
      totalInvoices: invoices.length,
      totalTaxableValue: invoices.reduce((s, i) => s + Number(i.taxableAmount), 0),
      totalCgst: invoices.reduce((s, i) => s + Number(i.totalCgst), 0),
      totalSgst: invoices.reduce((s, i) => s + Number(i.totalSgst), 0),
      totalIgst: invoices.reduce((s, i) => s + Number(i.totalIgst), 0),
      totalTax: invoices.reduce((s, i) => s + Number(i.totalCgst) + Number(i.totalSgst) + Number(i.totalIgst), 0),
    };
    res.json({ month, year, b2b, b2c, summary });
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

    const [biz, invoices] = await Promise.all([
      db.query.businessesTable.findFirst({ where: eq(businessesTable.id, businessId) }),
      db.select({
        id: vouchersTable.id,
        voucherNumber: vouchersTable.voucherNumber,
        date: vouchersTable.date,
        grandTotal: vouchersTable.grandTotal,
        taxableAmount: vouchersTable.taxableAmount,
        totalCgst: vouchersTable.totalCgst,
        totalSgst: vouchersTable.totalSgst,
        totalIgst: vouchersTable.totalIgst,
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

    // Fetch voucher items grouped by (voucherId, taxRate) for accurate rate-wise breakdown
    const invoiceIds = invoices.map(i => i.id);
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

    // Map: voucherId → [{taxRate, taxableAmount, cgst, sgst, igst}]
    const itemsByVoucher = new Map<number, typeof allItems>();
    for (const item of allItems) {
      if (!itemsByVoucher.has(item.voucherId)) itemsByVoucher.set(item.voucherId, []);
      itemsByVoucher.get(item.voucherId)!.push(item);
    }

    // DD-MM-YYYY format required by GSTN
    const toGSTDate = (d: string) => {
      const parts = d.split("-");
      if (parts.length === 3) return `${parts[2]}-${parts[1]}-${parts[0]}`;
      return d;
    };

    const round2 = (n: number) => Math.round(n * 100) / 100;

    const buildItms = (inv: (typeof invoices)[0]) => {
      const items = itemsByVoucher.get(inv.id);
      if (items && items.length > 0) {
        return items.map((item, idx) => ({
          num: idx + 1,
          itm_det: {
            rt: Number(item.taxRate ?? 0),
            txval: round2(Number(item.taxableAmount)),
            camt: round2(Number(item.cgst)),
            samt: round2(Number(item.sgst)),
            iamt: round2(Number(item.igst)),
            csamt: 0,
          },
        }));
      }
      // Fallback to voucher-level totals if items not found
      return [{
        num: 1,
        itm_det: {
          rt: 0,
          txval: round2(Number(inv.taxableAmount)),
          camt: round2(Number(inv.totalCgst)),
          samt: round2(Number(inv.totalSgst)),
          iamt: round2(Number(inv.totalIgst)),
          csamt: 0,
        },
      }];
    };

    const b2bInvoices = invoices.filter(i => isValidGSTIN(i.partyGstin));

    // Group by counterparty GSTIN (one ctin block per party, all their invoices inside)
    const b2bMap = new Map<string, typeof b2bInvoices>();
    for (const inv of b2bInvoices) {
      const ctin = inv.partyGstin!;
      if (!b2bMap.has(ctin)) b2bMap.set(ctin, []);
      b2bMap.get(ctin)!.push(inv);
    }

    const gstrJson = {
      gstin: biz?.gstin || "",
      fp: `${String(month).padStart(2, "0")}${year}`,
      b2b: Array.from(b2bMap.entries()).map(([ctin, invs]) => ({
        ctin,
        inv: invs.map(i => ({
          inum: formatPrintNumber(i.voucherNumber, biz),
          idt: toGSTDate(i.date),
          val: round2(Number(i.grandTotal)),
          pos: i.placeOfSupply || "00",
          rchrg: "N",
          inv_typ: "R",
          itms: buildItms(i),
        })),
      })),
    };

    const filename = `GSTR1_${String(month).padStart(2, "0")}_${year}.json`;
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
    res.send(csv);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal Server Error" });
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
