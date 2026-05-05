import { Router } from "express";
import { db } from "@workspace/db";
import { partiesTable, vouchersTable, paymentsTable } from "@workspace/db";
import { eq, and, sql, gte, lte, inArray } from "drizzle-orm";
import { requireBusiness } from "../middlewares/auth";

const router = Router();
router.use(requireBusiness);

router.get("/ledger/:partyId", async (req, res) => {
  try {
    const businessId = req.user!.businessId!;
    const partyId = Number(req.params.partyId);
    const { fromDate, toDate } = req.query;

    const party = await db.query.partiesTable.findFirst({
      where: and(eq(partiesTable.id, partyId), eq(partiesTable.businessId, businessId)),
    });
    if (!party) { res.status(404).json({ error: "Not Found" }); return; }

    const vConditions: any[] = [eq(vouchersTable.businessId, businessId), eq(vouchersTable.partyId, partyId)];
    if (fromDate) vConditions.push(gte(vouchersTable.date, String(fromDate)));
    if (toDate) vConditions.push(lte(vouchersTable.date, String(toDate)));
    const vouchers = await db.select().from(vouchersTable).where(and(...vConditions));

    const pConditions: any[] = [eq(paymentsTable.businessId, businessId), eq(paymentsTable.partyId, partyId)];
    if (fromDate) pConditions.push(gte(paymentsTable.date, String(fromDate)));
    if (toDate) pConditions.push(lte(paymentsTable.date, String(toDate)));
    const payments = await db.select().from(paymentsTable).where(and(...pConditions));

    // --- FIX: merge all entries first, sort by date, then calculate running balance ---
    const rawEntries: any[] = [];

    for (const v of vouchers) {
      const amount = Number(v.grandTotal);
      let debit = 0, credit = 0, delta = 0;
      if (v.voucherType === "sales_invoice") { debit = amount; delta = amount; }
      else if (v.voucherType === "credit_note") { credit = amount; delta = -amount; }
      else if (v.voucherType === "purchase_bill") { credit = amount; delta = -amount; }
      else if (v.voucherType === "debit_note") { debit = amount; delta = amount; }
      rawEntries.push({ date: v.date, voucherType: v.voucherType, voucherNumber: v.voucherNumber, debit, credit, delta });
    }

    for (const p of payments) {
      const amount = Number(p.amount);
      let debit = 0, credit = 0, delta = 0;
      if (p.type === "receipt") { credit = amount; delta = -amount; }
      else { debit = amount; delta = amount; }
      rawEntries.push({ date: p.date, voucherType: p.type, voucherNumber: p.paymentNumber, debit, credit, delta });
    }

    // Sort all entries by date ascending
    rawEntries.sort((a, b) => a.date.localeCompare(b.date));

    // Now calculate running balance in sorted order
    let balance = Number(party.openingBalance || 0);
    if (party.openingBalanceType === "credit") balance = -balance;
    const openingBalance = balance;

    const entries = rawEntries.map(e => {
      balance += e.delta;
      return { date: e.date, voucherType: e.voucherType, voucherNumber: e.voucherNumber, debit: e.debit, credit: e.credit, balance };
    });

    // --- Bill-wise data: invoice/bill level breakdown ---
    const billTypes = ["sales_invoice", "purchase_bill"];
    const bills = vouchers
      .filter(v => billTypes.includes(v.voucherType))
      .sort((a, b) => a.date.localeCompare(b.date))
      .map(v => {
        const billAmount = Number(v.grandTotal);
        const paidAmount = Number(v.paidAmount || 0);
        const balance = billAmount - paidAmount;
        return {
          voucherNumber: v.voucherNumber,
          voucherType: v.voucherType,
          date: v.date,
          billAmount,
          paidAmount,
          balance,
          status: v.status,
        };
      });

    res.json({ party, openingBalance, closingBalance: balance, entries, bills });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.get("/trial-balance", async (req, res) => {
  try {
    const businessId = req.user!.businessId!;

    // Get all parties
    const parties = await db.select().from(partiesTable).where(eq(partiesTable.businessId, businessId));

    // Calculate debtors and creditors totals
    let totalDebtors = 0;
    let totalCreditors = 0;

    for (const party of parties) {
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
      const net = opening
        + Number(vResult.salesTotal)
        - Number(vResult.creditTotal)
        - Number(vResult.purchaseTotal)
        + Number(vResult.debitTotal)
        - Number(pResult.receiptTotal)
        + Number(pResult.paymentTotal);

      if (net > 0) totalDebtors += net;       // Dr balance = debtor
      else if (net < 0) totalCreditors += -net; // Cr balance = creditor
    }

    // Get Sales total (sum of all sales invoice grandTotals)
    const [salesResult] = await db.select({
      total: sql<number>`coalesce(sum(${vouchersTable.grandTotal}::numeric), 0)`,
    }).from(vouchersTable).where(and(eq(vouchersTable.businessId, businessId), eq(vouchersTable.voucherType, "sales_invoice")));

    // Get Purchase total
    const [purchaseResult] = await db.select({
      total: sql<number>`coalesce(sum(${vouchersTable.grandTotal}::numeric), 0)`,
    }).from(vouchersTable).where(and(eq(vouchersTable.businessId, businessId), eq(vouchersTable.voucherType, "purchase_bill")));

    // Get Bank receipts (mode = bank/upi/cheque/neft/rtgs)
    const [bankResult] = await db.select({
      receipts: sql<number>`coalesce(sum(case when ${paymentsTable.type} = 'receipt' and lower(${paymentsTable.paymentMode}) in ('bank','upi','cheque','neft','rtgs','online') then ${paymentsTable.amount}::numeric else 0 end), 0)`,
      payments: sql<number>`coalesce(sum(case when ${paymentsTable.type} = 'payment' and lower(${paymentsTable.paymentMode}) in ('bank','upi','cheque','neft','rtgs','online') then ${paymentsTable.amount}::numeric else 0 end), 0)`,
    }).from(paymentsTable).where(eq(paymentsTable.businessId, businessId));

    // Get Cash receipts
    const [cashResult] = await db.select({
      receipts: sql<number>`coalesce(sum(case when ${paymentsTable.type} = 'receipt' and lower(${paymentsTable.paymentMode}) = 'cash' then ${paymentsTable.amount}::numeric else 0 end), 0)`,
      payments: sql<number>`coalesce(sum(case when ${paymentsTable.type} = 'payment' and lower(${paymentsTable.paymentMode}) = 'cash' then ${paymentsTable.amount}::numeric else 0 end), 0)`,
    }).from(paymentsTable).where(eq(paymentsTable.businessId, businessId));

    const salesNet = Number(salesResult.total);
    const purchaseNet = Number(purchaseResult.total);
    const bankNet = Number(bankResult.receipts) - Number(bankResult.payments);
    const cashNet = Number(cashResult.receipts) - Number(cashResult.payments);

    const entries = [
      { accountName: "Debtors (Receivables)", accountType: "debtor", debit: totalDebtors, credit: 0 },
      { accountName: "Creditors (Payables)", accountType: "creditor", debit: 0, credit: totalCreditors },
      { accountName: "Sales", accountType: "sales", debit: 0, credit: salesNet },
      { accountName: "Purchase", accountType: "purchase", debit: purchaseNet, credit: 0 },
      { accountName: "Bank", accountType: "bank", debit: bankNet >= 0 ? bankNet : 0, credit: bankNet < 0 ? -bankNet : 0 },
      { accountName: "Cash", accountType: "cash", debit: cashNet >= 0 ? cashNet : 0, credit: cashNet < 0 ? -cashNet : 0 },
    ];

    const totalDebit = entries.reduce((s, e) => s + e.debit, 0);
    const totalCredit = entries.reduce((s, e) => s + e.credit, 0);

    res.json({ entries, totalDebit, totalCredit });
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
  } catch err) {
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
