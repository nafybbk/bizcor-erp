import { Router } from "express";
import { db } from "@workspace/db";
import { partiesTable, vouchersTable, paymentsTable } from "@workspace/db";
import { eq, and, sql, gte, lte, desc } from "drizzle-orm";
import { requireBusiness } from "../middlewares/auth";

const router = Router();
router.use(requireBusiness);

router.get("/ledger/:partyId", async (req, res) => {
  try {
    const businessId = req.user!.businessId!;
    const partyId = Number(req.params.partyId);
    const { fromDate, toDate } = req.query;
    const party = await db.query.partiesTable.findFirst({ where: and(eq(partiesTable.id, partyId), eq(partiesTable.businessId, businessId)) });
    if (!party) { res.status(404).json({ error: "Not Found" }); return; }
    const vConditions: any[] = [eq(vouchersTable.businessId, businessId), eq(vouchersTable.partyId, partyId)];
    if (fromDate) vConditions.push(gte(vouchersTable.date, String(fromDate)));
    if (toDate) vConditions.push(lte(vouchersTable.date, String(toDate)));
    const vouchers = await db.select().from(vouchersTable).where(and(...vConditions)).orderBy(vouchersTable.date);
    const pConditions: any[] = [eq(paymentsTable.businessId, businessId), eq(paymentsTable.partyId, partyId)];
    if (fromDate) pConditions.push(gte(paymentsTable.date, String(fromDate)));
    if (toDate) pConditions.push(lte(paymentsTable.date, String(toDate)));
    const payments = await db.select().from(paymentsTable).where(and(...pConditions)).orderBy(paymentsTable.date);
    let balance = Number(party.openingBalance || 0);
    if (party.openingBalanceType === "credit") balance = -balance;
    const openingBalance = balance;
    const entries: any[] = [];
    for (const v of vouchers) {
      const amount = Number(v.grandTotal);
      let debit = 0, credit = 0;
      if (v.voucherType === "sales_invoice") { debit = amount; balance += amount; }
      else if (v.voucherType === "credit_note") { credit = amount; balance -= amount; }
      else if (v.voucherType === "purchase_bill") { credit = amount; balance -= amount; }
      else if (v.voucherType === "debit_note") { debit = amount; balance += amount; }
      entries.push({ date: v.date, voucherType: v.voucherType, voucherNumber: v.voucherNumber, description: v.voucherType.replace(/_/g, " "), debit, credit, balance });
    }
    for (const p of payments) {
      const amount = Number(p.amount);
      let debit = 0, credit = 0;
      if (p.type === "receipt") { credit = amount; balance -= amount; }
      else { debit = amount; balance += amount; }
      entries.push({ date: p.date, voucherType: p.type, voucherNumber: p.paymentNumber, description: `${p.type} - ${p.paymentMode}`, debit, credit, balance });
    }
    entries.sort((a, b) => a.date.localeCompare(b.date));
    res.json({ party, openingBalance, closingBalance: balance, entries });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.get("/trial-balance", async (req, res) => {
  try {
    const businessId = req.user!.businessId!;
    const parties = await db.select().from(partiesTable).where(eq(partiesTable.businessId, businessId));
    const entries = await Promise.all(parties.map(async party => {
      const [vResult] = await db.select({
        salesTotal: sql<number>`coalesce(sum(case when ${vouchersTable.voucherType} = 'sales_invoice' then ${vouchersTable.grandTotal}::numeric else 0 end), 0)`,
        creditTotal: sql<number>`coalesce(sum(case when ${vouchersTable.voucherType} = 'credit_note' then ${vouchersTable.grandTotal}::numeric else 0 end), 0)`,
        purchaseTotal: sql<number>`coalesce(sum(case when ${vouchersTable.voucherType} = 'purchase_bill' then ${vouchersTable.grandTotal}::numeric else 0 end), 0)`,
        debitTotal: sql<number>`coalesce(sum(case when ${vouchersTable.voucherType} = 'debit_note' then ${vouchersTable.grandTotal}::numeric else 0 end), 0)`,
      }).from(vouchersTable).where(and(eq(vouchersTable.businessId, businessId), eq(vouchersTable.partyId, party.id)));
      const [pResult] = await db.select({
        receiptTotal: sql<number>`coalesce(sum(case when ${paymentsTable.type} = 'receipt' then ${paymentsTable.amount}::numeric else 0 end), 0)`,
        paymentTotal: sql<number>`coalesce(sum(case when ${paymentsTable.type} = 'payment' then ${paymentsTable.amount}::numeric else 0 end), 0)`,
      }).from(paymentsTable).where(and(eq(paymentsTable.businessId, businessId), eq(paymentsTable.partyId, party.id)));
      const opening = Number(party.openingBalance || 0) * (party.openingBalanceType === "credit" ? -1 : 1);
      const net = opening + Number(vResult.salesTotal) - Number(vResult.creditTotal) - Number(vResult.purchaseTotal) + Number(vResult.debitTotal) - Number(pResult.receiptTotal) + Number(pResult.paymentTotal);
      return { accountName: party.name, accountType: party.type, debit: net > 0 ? net : 0, credit: net < 0 ? -net : 0 };
    }));
    const filtered = entries.filter(e => e.debit > 0 || e.credit > 0);
    const totalDebit = filtered.reduce((s, e) => s + e.debit, 0);
    const totalCredit = filtered.reduce((s, e) => s + e.credit, 0);
    res.json({ entries: filtered, totalDebit, totalCredit });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.get("/outstanding-receivables", async (req, res) => {
  try {
    const businessId = req.user!.businessId!;
    const parties = await db.select().from(partiesTable).where(and(eq(partiesTable.businessId, businessId)));
    const result = await Promise.all(parties.map(async party => {
      const [r] = await db.select({
        total: sql<number>`coalesce(sum(${vouchersTable.grandTotal}::numeric), 0)`,
        paid: sql<number>`coalesce(sum(${vouchersTable.paidAmount}::numeric), 0)`,
      }).from(vouchersTable).where(and(eq(vouchersTable.businessId, businessId), eq(vouchersTable.partyId, party.id), eq(vouchersTable.voucherType, "sales_invoice")));
      const balance = Number(r.total) - Number(r.paid);
      return { partyId: party.id, partyName: party.name, totalAmount: Number(r.total), paidAmount: Number(r.paid), balanceDue: balance, overdue: balance };
    }));
    const data = result.filter(r => r.balanceDue > 0);
    const totalOutstanding = data.reduce((s, r) => s + r.balanceDue, 0);
    res.json({ data, totalOutstanding, totalOverdue: totalOutstanding });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.get("/outstanding-payables", async (req, res) => {
  try {
    const businessId = req.user!.businessId!;
    const parties = await db.select().from(partiesTable).where(eq(partiesTable.businessId, businessId));
    const result = await Promise.all(parties.map(async party => {
      const [r] = await db.select({
        total: sql<number>`coalesce(sum(${vouchersTable.grandTotal}::numeric), 0)`,
        paid: sql<number>`coalesce(sum(${vouchersTable.paidAmount}::numeric), 0)`,
      }).from(vouchersTable).where(and(eq(vouchersTable.businessId, businessId), eq(vouchersTable.partyId, party.id), eq(vouchersTable.voucherType, "purchase_bill")));
      const balance = Number(r.total) - Number(r.paid);
      return { partyId: party.id, partyName: party.name, totalAmount: Number(r.total), paidAmount: Number(r.paid), balanceDue: balance, overdue: balance };
    }));
    const data = result.filter(r => r.balanceDue > 0);
    const totalOutstanding = data.reduce((s, r) => s + r.balanceDue, 0);
    res.json({ data, totalOutstanding, totalOverdue: totalOutstanding });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

export default router;
