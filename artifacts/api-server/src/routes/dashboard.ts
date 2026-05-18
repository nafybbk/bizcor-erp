import { Router } from "express";
import { db } from "@workspace/db";
import { vouchersTable, paymentsTable, partiesTable, itemsTable } from "@workspace/db";
import { eq, and, sql, gte, lte, desc, isNull } from "drizzle-orm";
import { requireBusiness } from "../middlewares/auth";

const router = Router();
router.use(requireBusiness);

router.get("/summary", async (req, res) => {
  try {
    const businessId = req.user!.businessId!;
    const { period = "this_month" } = req.query;
    const now = new Date();
    let fromDate: string;
    let toDate = now.toISOString().split("T")[0];
    if (period === "today") fromDate = toDate;
    else if (period === "last_month") {
      const d = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      fromDate = d.toISOString().split("T")[0];
      toDate = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split("T")[0];
    } else if (period === "this_year") {
      fromDate = `${now.getFullYear()}-04-01`;
    } else {
      fromDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
    }
    const [sales] = await db.select({ total: sql<number>`coalesce(sum(${vouchersTable.grandTotal}), 0)`, cnt: sql<number>`count(*)` })
      .from(vouchersTable).where(and(eq(vouchersTable.businessId, businessId), eq(vouchersTable.voucherType, "sales_invoice"), gte(vouchersTable.date, fromDate), lte(vouchersTable.date, toDate), isNull(vouchersTable.deletedAt)));
    const [purchases] = await db.select({ total: sql<number>`coalesce(sum(${vouchersTable.grandTotal}), 0)`, cnt: sql<number>`count(*)` })
      .from(vouchersTable).where(and(eq(vouchersTable.businessId, businessId), eq(vouchersTable.voucherType, "purchase_bill"), gte(vouchersTable.date, fromDate), lte(vouchersTable.date, toDate), isNull(vouchersTable.deletedAt)));
    // Receivables = total invoiced - total credit notes - total receipts (net, always correct)
    const [totalInvoiced] = await db.select({ total: sql<number>`coalesce(sum(${vouchersTable.grandTotal}), 0)` })
      .from(vouchersTable).where(and(eq(vouchersTable.businessId, businessId), eq(vouchersTable.voucherType, "sales_invoice"), isNull(vouchersTable.deletedAt)));
    const [totalCreditNotes] = await db.select({ total: sql<number>`coalesce(sum(${vouchersTable.grandTotal}), 0)` })
      .from(vouchersTable).where(and(eq(vouchersTable.businessId, businessId), eq(vouchersTable.voucherType, "credit_note"), isNull(vouchersTable.deletedAt)));
    const [totalReceipts] = await db.select({ total: sql<number>`coalesce(sum(${paymentsTable.amount}), 0)` })
      .from(paymentsTable).where(and(eq(paymentsTable.businessId, businessId), eq(paymentsTable.type, "receipt")));
    const [totalPurchased] = await db.select({ total: sql<number>`coalesce(sum(${vouchersTable.grandTotal}), 0)` })
      .from(vouchersTable).where(and(eq(vouchersTable.businessId, businessId), eq(vouchersTable.voucherType, "purchase_bill"), isNull(vouchersTable.deletedAt)));
    const [totalDebitNotes] = await db.select({ total: sql<number>`coalesce(sum(${vouchersTable.grandTotal}), 0)` })
      .from(vouchersTable).where(and(eq(vouchersTable.businessId, businessId), eq(vouchersTable.voucherType, "debit_note"), isNull(vouchersTable.deletedAt)));
    const [totalPayments] = await db.select({ total: sql<number>`coalesce(sum(${paymentsTable.amount}), 0)` })
      .from(paymentsTable).where(and(eq(paymentsTable.businessId, businessId), eq(paymentsTable.type, "payment")));
    const receivables = { total: Math.max(0, Number(totalInvoiced.total) - Number(totalCreditNotes.total) - Number(totalReceipts.total)) };
    const payables = { total: Math.max(0, Number(totalPurchased.total) - Number(totalDebitNotes.total) - Number(totalPayments.total)) };
    const [gstOut] = await db.select({ total: sql<number>`coalesce(sum(${vouchersTable.totalTax}), 0)` })
      .from(vouchersTable).where(and(eq(vouchersTable.businessId, businessId), eq(vouchersTable.voucherType, "sales_invoice"), gte(vouchersTable.date, fromDate), isNull(vouchersTable.deletedAt)));
    const [gstIn] = await db.select({ total: sql<number>`coalesce(sum(${vouchersTable.totalTax}), 0)` })
      .from(vouchersTable).where(and(eq(vouchersTable.businessId, businessId), eq(vouchersTable.voucherType, "purchase_bill"), gte(vouchersTable.date, fromDate), isNull(vouchersTable.deletedAt)));
    const [lowStock] = await db.select({ cnt: sql<number>`count(*)` }).from(itemsTable).where(and(eq(itemsTable.businessId, businessId), sql`${itemsTable.openingStock} <= ${itemsTable.lowStockAlert}`));
    res.json({
      totalSales: Number(sales.total), totalPurchases: Number(purchases.total),
      totalReceivables: Number(receivables.total), totalPayables: Number(payables.total),
      salesCount: Number(sales.cnt), purchaseCount: Number(purchases.cnt),
      cashInHand: 0, netProfit: Number(sales.total) - Number(purchases.total),
      gstPayable: Math.max(0, Number(gstOut.total) - Number(gstIn.total)),
      lowStockItems: Number(lowStock.cnt),
    });
  } catch (err) {
    req.log.error(err);
    const isOffline = !!process.env.SQLITE_PATH;
    res.status(500).json({ error: isOffline ? (err as Error).message : "Internal Server Error" });
  }
});

router.get("/sales-trend", async (req, res) => {
  try {
    const businessId = req.user!.businessId!;
    const months = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const y = d.getFullYear();
      const m = d.getMonth() + 1;
      const from = `${y}-${String(m).padStart(2, "0")}-01`;
      const to = `${y}-${String(m).padStart(2, "0")}-${new Date(y, m, 0).getDate()}`;
      const [s] = await db.select({ total: sql<number>`coalesce(sum(${vouchersTable.grandTotal}), 0)` })
        .from(vouchersTable).where(and(eq(vouchersTable.businessId, businessId), eq(vouchersTable.voucherType, "sales_invoice"), gte(vouchersTable.date, from), lte(vouchersTable.date, to), isNull(vouchersTable.deletedAt)));
      const [p] = await db.select({ total: sql<number>`coalesce(sum(${vouchersTable.grandTotal}), 0)` })
        .from(vouchersTable).where(and(eq(vouchersTable.businessId, businessId), eq(vouchersTable.voucherType, "purchase_bill"), gte(vouchersTable.date, from), lte(vouchersTable.date, to), isNull(vouchersTable.deletedAt)));
      (months as any[]).push({ month: `${y}-${String(m).padStart(2, "0")}`, sales: Number(s.total), purchases: Number(p.total) });
    }
    res.json({ data: months });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.get("/top-parties", async (req, res) => {
  try {
    const businessId = req.user!.businessId!;
    const { type = "customer", limit = "5" } = req.query;
    const vType = type === "customer" ? "sales_invoice" : "purchase_bill";
    const results = await db.select({
      partyId: vouchersTable.partyId, partyName: partiesTable.name,
      totalAmount: sql<number>`coalesce(sum(${vouchersTable.grandTotal}), 0)`,
      invoiceCount: sql<number>`count(*)`,
    }).from(vouchersTable).leftJoin(partiesTable, eq(vouchersTable.partyId, partiesTable.id))
      .where(and(eq(vouchersTable.businessId, businessId), eq(vouchersTable.voucherType, vType as any), isNull(vouchersTable.deletedAt)))
      .groupBy(vouchersTable.partyId, partiesTable.name).orderBy(desc(sql`sum(${vouchersTable.grandTotal})`)).limit(Number(limit));
    res.json({ data: results.map(r => ({ ...r, totalAmount: Number(r.totalAmount), invoiceCount: Number(r.invoiceCount) })) });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.get("/gst-summary", async (req, res) => {
  try {
    const businessId = req.user!.businessId!;
    const now = new Date();
    const from = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
    const [sales] = await db.select({
      cgst: sql<number>`coalesce(sum(${vouchersTable.totalCgst}), 0)`,
      sgst: sql<number>`coalesce(sum(${vouchersTable.totalSgst}), 0)`,
      igst: sql<number>`coalesce(sum(${vouchersTable.totalIgst}), 0)`,
    }).from(vouchersTable).where(and(eq(vouchersTable.businessId, businessId), eq(vouchersTable.voucherType, "sales_invoice"), gte(vouchersTable.date, from)));
    const [purchases] = await db.select({
      cgst: sql<number>`coalesce(sum(${vouchersTable.totalCgst}), 0)`,
      sgst: sql<number>`coalesce(sum(${vouchersTable.totalSgst}), 0)`,
      igst: sql<number>`coalesce(sum(${vouchersTable.totalIgst}), 0)`,
    }).from(vouchersTable).where(and(eq(vouchersTable.businessId, businessId), eq(vouchersTable.voucherType, "purchase_bill"), gte(vouchersTable.date, from)));
    const outputTax = Number(sales.cgst) + Number(sales.sgst) + Number(sales.igst);
    const inputTax = Number(purchases.cgst) + Number(purchases.sgst) + Number(purchases.igst);
    res.json({
      month: from.substring(0, 7),
      outputTax, inputTax, netPayable: Math.max(0, outputTax - inputTax),
      cgst: Number(sales.cgst) - Number(purchases.cgst),
      sgst: Number(sales.sgst) - Number(purchases.sgst),
      igst: Number(sales.igst) - Number(purchases.igst),
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

export default router;
