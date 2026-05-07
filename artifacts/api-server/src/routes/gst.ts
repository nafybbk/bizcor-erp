import { Router } from "express";
import { db } from "@workspace/db";
import { vouchersTable, voucherItemsTable, partiesTable, businessesTable } from "@workspace/db";
import { eq, and, sql, gte, lte, isNull } from "drizzle-orm";
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
    const b2b = invoices.filter(i => i.partyGstin).map(i => ({
      gstin: i.partyGstin!, partyName: i.partyName || "", invoiceNumber: formatPrintNumber(i.voucherNumber, biz), invoiceDate: i.date,
      invoiceValue: Number(i.grandTotal), placeOfSupply: i.placeOfSupply || "", reverseCharge: "N",
      taxableValue: Number(i.taxableAmount), cgst: Number(i.totalCgst), sgst: Number(i.totalSgst), igst: Number(i.totalIgst),
    }));
    const b2c = invoices.filter(i => !i.partyGstin).map(i => ({
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
      taxableAmount: sql<number>`coalesce(sum(${vouchersTable.taxableAmount}::numeric), 0)`,
      cgst: sql<number>`coalesce(sum(${vouchersTable.totalCgst}::numeric), 0)`,
      sgst: sql<number>`coalesce(sum(${vouchersTable.totalSgst}::numeric), 0)`,
      igst: sql<number>`coalesce(sum(${vouchersTable.totalIgst}::numeric), 0)`,
    }).from(vouchersTable).where(and(eq(vouchersTable.businessId, businessId), eq(vouchersTable.voucherType, "sales_invoice"), gte(vouchersTable.date, from), lte(vouchersTable.date, to), isNull(vouchersTable.deletedAt)));
    const [purchases] = await db.select({
      taxableAmount: sql<number>`coalesce(sum(${vouchersTable.taxableAmount}::numeric), 0)`,
      cgst: sql<number>`coalesce(sum(${vouchersTable.totalCgst}::numeric), 0)`,
      sgst: sql<number>`coalesce(sum(${vouchersTable.totalSgst}::numeric), 0)`,
      igst: sql<number>`coalesce(sum(${vouchersTable.totalIgst}::numeric), 0)`,
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
        id: vouchersTable.id, voucherNumber: vouchersTable.voucherNumber, date: vouchersTable.date,
        grandTotal: vouchersTable.grandTotal, taxableAmount: vouchersTable.taxableAmount,
        totalCgst: vouchersTable.totalCgst, totalSgst: vouchersTable.totalSgst, totalIgst: vouchersTable.totalIgst,
        isInterState: vouchersTable.isInterState, placeOfSupply: vouchersTable.placeOfSupply,
        partyName: partiesTable.name, partyGstin: partiesTable.gstin,
      }).from(vouchersTable).leftJoin(partiesTable, eq(vouchersTable.partyId, partiesTable.id))
        .where(and(eq(vouchersTable.businessId, businessId), eq(vouchersTable.voucherType, "sales_invoice"), gte(vouchersTable.date, from), lte(vouchersTable.date, to))),
    ]);
    const gstrJson = {
      gstin: "", fp: `${String(month).padStart(2, "0")}${year}`,
      b2b: invoices.filter(i => i.partyGstin).map(i => ({
        ctin: i.partyGstin, inv: [{
          inum: formatPrintNumber(i.voucherNumber, biz), idt: i.date, val: Number(i.grandTotal),
          pos: i.placeOfSupply || "00", rchrg: "N", itms: [{
            num: 1, itm_det: { taxval: Number(i.taxableAmount), rt: 18, camt: Number(i.totalCgst), samt: Number(i.totalSgst), iamt: Number(i.totalIgst) }
          }]
        }]
      })),
    };
    const filename = `GSTR1_${String(month).padStart(2, "0")}_${year}.json`;
    res.json({ data: gstrJson, filename });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

export default router;
