import { Router } from "express";
import { db } from "@workspace/db";
import { partiesTable, vouchersTable, paymentsTable, paymentAllocationsTable } from "@workspace/db";
import { eq, and, sql, gte, lte, inArray, isNull } from "drizzle-orm";
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

    const vConditions: any[] = [eq(vouchersTable.businessId, businessId), eq(vouchersTable.partyId, partyId), isNull(vouchersTable.deletedAt)];
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

    // --- Bill-wise: FIFO distribution using ALL historical data (ignore date filter) ---
    // Fetch ALL bills + payments for this party (no date filter) for correct FIFO
    const allBillVouchers = await db.select().from(vouchersTable).where(
      and(eq(vouchersTable.businessId, businessId), eq(vouchersTable.partyId, partyId), isNull(vouchersTable.deletedAt),
        sql`${vouchersTable.voucherType} IN ('sales_invoice','purchase_bill')`
      )
    );
    const allPayments = await db.select().from(paymentsTable).where(
      and(eq(paymentsTable.businessId, businessId), eq(paymentsTable.partyId, partyId))
    );

    // Sort bills and payments by date ascending (FIFO)
    const sortedBills = [...allBillVouchers].sort((a, b) => a.date.localeCompare(b.date) || a.id - b.id);
    const sortedPayments = [...allPayments].sort((a, b) => a.date.localeCompare(b.date) || a.id - b.id);

    // Total cash received/paid
    // For customer: receipts reduce balance (credit). For supplier: payments reduce balance.
    const totalCashReceived = sortedPayments.reduce((s, p) => s + Number(p.amount), 0);

    // FIFO: distribute totalCashReceived across bills oldest first
    let poolRemaining = totalCashReceived;
    const billResults = sortedBills.map(v => {
      const billAmount = Number(v.grandTotal);
      const paidNow = Math.min(poolRemaining, billAmount);
      poolRemaining = Math.max(0, poolRemaining - paidNow);
      const balanceAmt = billAmount - paidNow;
      const status = paidNow >= billAmount - 0.001 ? "paid" : paidNow > 0 ? "partial" : "posted";
      return {
        voucherNumber: v.voucherNumber,
        voucherType: v.voucherType,
        date: v.date,
        billAmount,
        paidAmount: paidNow,
        balance: balanceAmt,
        status,
      };
    });

    // Only show bills in the date filter range for the bill-wise table
    const bills = billResults.filter(b => {
      if (fromDate && b.date < String(fromDate)) return false;
      if (toDate && b.date > String(toDate)) return false;
      return true;
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
      }).from(vouchersTable).where(and(eq(vouchersTable.businessId, businessId), eq(vouchersTable.partyId, party.id), isNull(vouchersTable.deletedAt)));

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
    }).from(vouchersTable).where(and(eq(vouchersTable.businessId, businessId), eq(vouchersTable.voucherType, "sales_invoice"), isNull(vouchersTable.deletedAt)));

    // Get Purchase total
    const [purchaseResult] = await db.select({
      total: sql<number>`coalesce(sum(${vouchersTable.grandTotal}::numeric), 0)`,
    }).from(vouchersTable).where(and(eq(vouchersTable.businessId, businessId), eq(vouchersTable.voucherType, "purchase_bill"), isNull(vouchersTable.deletedAt)));

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

// Helper: compute per-party outstanding using net formula (invoices - credit notes - receipts)
// This is always correct regardless of payment_allocations data quality
async function computeOutstanding(businessId: number, invoiceType: "sales_invoice" | "purchase_bill", paymentType: "receipt" | "payment", creditType: "credit_note" | "debit_note") {
  const allParties = await db.select().from(partiesTable).where(eq(partiesTable.businessId, businessId));

  const [invoiceRows] = await Promise.all([
    db.select({ partyId: vouchersTable.partyId, total: sql<number>`coalesce(sum(${vouchersTable.grandTotal}::numeric),0)` })
      .from(vouchersTable).where(and(eq(vouchersTable.businessId, businessId), eq(vouchersTable.voucherType, invoiceType), isNull(vouchersTable.deletedAt))).groupBy(vouchersTable.partyId),
  ]);
  const cnRows = await db.select({ partyId: vouchersTable.partyId, total: sql<number>`coalesce(sum(${vouchersTable.grandTotal}::numeric),0)` })
    .from(vouchersTable).where(and(eq(vouchersTable.businessId, businessId), eq(vouchersTable.voucherType, creditType), isNull(vouchersTable.deletedAt))).groupBy(vouchersTable.partyId);
  const payRows = await db.select({ partyId: paymentsTable.partyId, total: sql<number>`coalesce(sum(${paymentsTable.amount}::numeric),0)` })
    .from(paymentsTable).where(and(eq(paymentsTable.businessId, businessId), eq(paymentsTable.type, paymentType))).groupBy(paymentsTable.partyId);

  const invoiceMap = new Map(invoiceRows.map(r => [r.partyId, Number(r.total)]));
  const cnMap = new Map(cnRows.map(r => [r.partyId, Number(r.total)]));
  const payMap = new Map(payRows.map(r => [r.partyId, Number(r.total)]));
  const partyMap = new Map(allParties.map(p => [p.id, p]));

  const data: any[] = [];
  for (const [partyId, invoiceTotal] of invoiceMap) {
    const cn = cnMap.get(partyId) || 0;
    const received = payMap.get(partyId) || 0;
    const party = partyMap.get(partyId);
    const openingBal = Number(party?.openingBalance || 0);
    const openingType = party?.openingBalanceType || "debit";
    const opening = invoiceType === "sales_invoice"
      ? (openingType === "debit" ? openingBal : -openingBal)
      : (openingType === "credit" ? openingBal : -openingBal);
    const balanceDue = opening + invoiceTotal - cn - received;
    if (balanceDue > 0.001) {
      data.push({ partyId, partyName: party?.name || "Unknown", totalAmount: invoiceTotal, paidAmount: received, balanceDue, overdue: balanceDue });
    }
  }
  return data.sort((a, b) => b.balanceDue - a.balanceDue);
}

router.get("/outstanding-receivables", async (req, res) => {
  try {
    const businessId = req.user!.businessId!;
    const data = await computeOutstanding(businessId, "sales_invoice", "receipt", "credit_note");
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
    const data = await computeOutstanding(businessId, "purchase_bill", "payment", "debit_note");
    const totalOutstanding = data.reduce((s, r) => s + r.balanceDue, 0);
    res.json({ data, totalOutstanding, totalOverdue: totalOutstanding });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Data repair: recalculate paidAmount on all vouchers from actual payment amounts
router.post("/repair-voucher-balances", async (req, res) => {
  try {
    const businessId = req.user!.businessId!;
    // Get all payments for this business
    const payments = await db.select().from(paymentsTable).where(eq(paymentsTable.businessId, businessId));
    const allAllocs = await db.select().from(paymentAllocationsTable);
    const paymentMap = new Map(payments.map(p => [p.id, Number(p.amount)]));

    // Group allocs by voucher. For each payment, cap allocated at payment.amount proportionally
    const voucherPaid = new Map<number, number>();
    // Per payment: sum allocations, then distribute proportionally if over-allocated
    const allocsByPayment = new Map<number, typeof allAllocs>();
    for (const a of allAllocs) {
      const g = allocsByPayment.get(a.paymentId) || [];
      g.push(a);
      allocsByPayment.set(a.paymentId, g);
    }

    for (const [paymentId, allocs] of allocsByPayment) {
      const payAmt = paymentMap.get(paymentId) ?? 0;
      const totalAlloc = allocs.reduce((s, a) => s + Number(a.allocatedAmount), 0);
      for (const a of allocs) {
        const raw = Number(a.allocatedAmount);
        // Cap: if totalAlloc > payAmt, scale down proportionally
        const safe = totalAlloc > payAmt + 0.001 ? (raw / totalAlloc) * payAmt : raw;
        const prev = voucherPaid.get(a.voucherId) ?? 0;
        voucherPaid.set(a.voucherId, prev + safe);
        // Update alloc record with corrected amount
        await db.update(paymentAllocationsTable)
          .set({ allocatedAmount: String(safe.toFixed(2)) })
          .where(and(eq(paymentAllocationsTable.paymentId, paymentId), eq(paymentAllocationsTable.voucherId, a.voucherId)));
      }
    }

    // Update each voucher's paidAmount and status
    let fixed = 0;
    for (const [voucherId, paid] of voucherPaid) {
      const voucher = await db.query.vouchersTable.findFirst({ where: eq(vouchersTable.id, voucherId) });
      if (!voucher || voucher.businessId !== businessId) continue;
      const grandTotal = Number(voucher.grandTotal);
      const safePaid = Math.min(paid, grandTotal);
      const status = safePaid >= grandTotal - 0.001 ? "paid" : safePaid > 0 ? "partial" : "posted";
      await db.update(vouchersTable).set({ paidAmount: String(safePaid.toFixed(2)), status }).where(eq(vouchersTable.id, voucherId));
      fixed++;
    }
    res.json({ ok: true, vouchersFixed: fixed });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

export default router;
