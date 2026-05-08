import { Router } from "express";
import { db } from "@workspace/db";
import { paymentsTable, paymentAllocationsTable, vouchersTable, partiesTable } from "@workspace/db";
import { eq, and, sql, desc, gte, lte, isNull, asc } from "drizzle-orm";
import { requireBusiness } from "../middlewares/auth";

const router = Router();
router.use(requireBusiness);

router.get("/", async (req, res) => {
  try {
    const { type, partyId, fromDate, toDate, page = "1", limit = "20" } = req.query;
    const businessId = req.user!.businessId!;
    const conditions: any[] = [eq(paymentsTable.businessId, businessId)];
    if (type) conditions.push(eq(paymentsTable.type, type as "receipt" | "payment"));
    if (partyId) conditions.push(eq(paymentsTable.partyId, Number(partyId)));
    if (fromDate) conditions.push(gte(paymentsTable.date, String(fromDate)));
    if (toDate) conditions.push(lte(paymentsTable.date, String(toDate)));
    const payments = await db.select({
      id: paymentsTable.id, paymentNumber: paymentsTable.paymentNumber, type: paymentsTable.type,
      date: paymentsTable.date, partyId: paymentsTable.partyId, partyName: partiesTable.name,
      amount: paymentsTable.amount, paymentMode: paymentsTable.paymentMode,
      isOnAccount: paymentsTable.isOnAccount, notes: paymentsTable.notes, createdAt: paymentsTable.createdAt,
    }).from(paymentsTable).leftJoin(partiesTable, eq(paymentsTable.partyId, partiesTable.id))
      .where(and(...conditions)).orderBy(desc(paymentsTable.date)).limit(Number(limit)).offset((Number(page) - 1) * Number(limit));
    const [{ total }] = await db.select({ total: sql<number>`count(*)` }).from(paymentsTable).where(and(...conditions));
    const [{ totalAmount }] = await db.select({ totalAmount: sql<number>`coalesce(sum(${paymentsTable.amount}), 0)` }).from(paymentsTable).where(and(...conditions));
    const data = payments.map(p => ({ ...p, amount: Number(p.amount) }));
    res.json({ data, total: Number(total), page: Number(page), limit: Number(limit), totalAmount: Number(totalAmount) });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.post("/", async (req, res) => {
  try {
    const businessId = req.user!.businessId!;
    const { type, date, partyId, amount, paymentMode, referenceNumber, notes, isOnAccount, allocations } = req.body;
    const [{ cnt }] = await db.select({ cnt: sql<number>`count(*)` }).from(paymentsTable).where(eq(paymentsTable.businessId, businessId));
    const paymentNumber = `${type === "receipt" ? "REC" : "PAY"}-${String(Number(cnt) + 1).padStart(4, "0")}`;
    const [payment] = await db.insert(paymentsTable).values({
      businessId, paymentNumber, type, date, partyId: Number(partyId),
      amount: String(amount), paymentMode, referenceNumber, notes,
      isOnAccount: isOnAccount || false,
    }).returning();
    if (!isOnAccount && allocations && allocations.length > 0) {
      const paymentAmt = Number(amount);
      let remainingPayment = paymentAmt;
      for (const alloc of allocations) {
        if (remainingPayment <= 0.001) break;
        const voucher = await db.query.vouchersTable.findFirst({ where: eq(vouchersTable.id, alloc.voucherId) });
        if (!voucher) continue;
        const grandTotal = Number(voucher.grandTotal);
        const alreadyPaid = Number(voucher.paidAmount || 0);
        const billBalance = Math.max(0, grandTotal - alreadyPaid);
        const safeAlloc = Math.min(Number(alloc.allocatedAmount), billBalance, remainingPayment);
        if (safeAlloc <= 0.001) continue;
        remainingPayment -= safeAlloc;
        await db.insert(paymentAllocationsTable).values({ paymentId: payment.id, voucherId: alloc.voucherId, allocatedAmount: String(safeAlloc) });
        const currentPaid = await db.select({ paid: sql<number>`coalesce(sum(${paymentAllocationsTable.allocatedAmount}), 0)` }).from(paymentAllocationsTable).where(eq(paymentAllocationsTable.voucherId, alloc.voucherId));
        const totalPaid = Number(currentPaid[0]?.paid || 0);
        const newStatus = totalPaid >= grandTotal - 0.001 ? "paid" : totalPaid > 0 ? "partial" : "posted";
        await db.update(vouchersTable).set({ paidAmount: String(totalPaid), status: newStatus }).where(eq(vouchersTable.id, alloc.voucherId));
      }
    }
    res.status(201).json({ ...payment, amount: Number(payment.amount) });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.get("/outstanding", async (req, res) => {
  try {
    const businessId = req.user!.businessId!;
    const { partyId, type } = req.query;
    if (!partyId) { res.status(400).json({ error: "partyId required" }); return; }
    const voucherTypes = type === "receivable" ? ["sales_invoice"] : type === "payable" ? ["purchase_bill"] : ["sales_invoice", "purchase_bill"];
    const party = await db.query.partiesTable.findFirst({ where: eq(partiesTable.id, Number(partyId)) });
    const vouchers = await db.select().from(vouchersTable).where(and(
      eq(vouchersTable.businessId, businessId), eq(vouchersTable.partyId, Number(partyId)),
      sql`${vouchersTable.voucherType} = ANY(${sql.raw(`ARRAY['${voucherTypes.join("','")}']::voucher_type[]`)})`
    ));
    // Use FIFO to correctly compute per-bill balance (independent of payment_allocations)
    const allPayments = await db.select().from(paymentsTable).where(
      and(eq(paymentsTable.businessId, businessId), eq(paymentsTable.partyId, Number(partyId)))
    ).orderBy(asc(paymentsTable.date));
    const totalReceived = allPayments.reduce((s, p) => s + Number(p.amount), 0);
    const sortedVouchers = [...vouchers].sort((a, b) => a.date.localeCompare(b.date) || a.id - b.id);
    let pool = totalReceived;
    const outstanding = sortedVouchers.map(v => {
      const billAmount = Number(v.grandTotal);
      const paidNow = Math.min(pool, billAmount);
      pool = Math.max(0, pool - paidNow);
      const balanceDue = billAmount - paidNow;
      return { voucherId: v.id, voucherNumber: v.voucherNumber, date: v.date, originalAmount: billAmount, paidAmount: paidNow, balanceDue, daysOverdue: 0 };
    }).filter(b => b.balanceDue > 0.001);
    const totalOutstanding = outstanding.reduce((s, b) => s + b.balanceDue, 0);
    res.json({ party, totalOutstanding, bills: outstanding });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const businessId = req.user!.businessId!;
    const payment = await db.query.paymentsTable.findFirst({ where: and(eq(paymentsTable.id, Number(req.params.id)), eq(paymentsTable.businessId, businessId)) });
    if (!payment) { res.status(404).json({ error: "Not Found" }); return; }
    const allocations = await db.select().from(paymentAllocationsTable).where(eq(paymentAllocationsTable.paymentId, payment.id));
    const allocWithVouchers = await Promise.all(allocations.map(async a => {
      const v = await db.query.vouchersTable.findFirst({ where: eq(vouchersTable.id, a.voucherId) });
      return { voucherId: a.voucherId, voucherNumber: v?.voucherNumber, voucherDate: v?.date, voucherAmount: Number(v?.grandTotal), allocatedAmount: Number(a.allocatedAmount) };
    }));
    const party = await db.query.partiesTable.findFirst({ where: eq(partiesTable.id, payment.partyId) });
    res.json({ ...payment, amount: Number(payment.amount), partyName: party?.name, allocations: allocWithVouchers });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.patch("/:id", async (req, res) => {
  try {
    const businessId = req.user!.businessId!;
    const paymentId = Number(req.params.id);
    const { date, amount, paymentMode, referenceNumber, notes, isOnAccount, allocations } = req.body;

    const existing = await db.query.paymentsTable.findFirst({
      where: and(eq(paymentsTable.id, paymentId), eq(paymentsTable.businessId, businessId)),
    });
    if (!existing) { res.status(404).json({ error: "Not Found" }); return; }

    // Reverse old allocations — recalc each affected voucher
    const oldAllocs = await db.select().from(paymentAllocationsTable).where(eq(paymentAllocationsTable.paymentId, paymentId));
    for (const alloc of oldAllocs) {
      const remaining = await db.select({ paid: sql<number>`coalesce(sum(${paymentAllocationsTable.allocatedAmount}), 0)` })
        .from(paymentAllocationsTable)
        .where(and(eq(paymentAllocationsTable.voucherId, alloc.voucherId), sql`${paymentAllocationsTable.paymentId} != ${paymentId}`));
      const totalPaid = Number(remaining[0]?.paid || 0);
      const voucher = await db.query.vouchersTable.findFirst({ where: eq(vouchersTable.id, alloc.voucherId) });
      if (voucher) {
        const grandTotal = Number(voucher.grandTotal);
        const newStatus = totalPaid >= grandTotal ? "paid" : totalPaid > 0 ? "partial" : "posted";
        await db.update(vouchersTable).set({ paidAmount: String(totalPaid), status: newStatus }).where(eq(vouchersTable.id, alloc.voucherId));
      }
    }

    await db.delete(paymentAllocationsTable).where(eq(paymentAllocationsTable.paymentId, paymentId));
    await db.update(paymentsTable).set({ date, amount: String(amount), paymentMode, referenceNumber, notes, isOnAccount: isOnAccount || false })
      .where(eq(paymentsTable.id, paymentId));

    if (!isOnAccount && allocations && allocations.length > 0) {
      const paymentAmt = Number(amount);
      let remainingPayment = paymentAmt;
      for (const alloc of allocations) {
        if (remainingPayment <= 0.001) break;
        const voucher = await db.query.vouchersTable.findFirst({ where: eq(vouchersTable.id, alloc.voucherId) });
        if (!voucher) continue;
        const grandTotal = Number(voucher.grandTotal);
        const alreadyPaid = Number(voucher.paidAmount || 0);
        const billBalance = Math.max(0, grandTotal - alreadyPaid);
        const safeAlloc = Math.min(Number(alloc.allocatedAmount), billBalance, remainingPayment);
        if (safeAlloc <= 0.001) continue;
        remainingPayment -= safeAlloc;
        await db.insert(paymentAllocationsTable).values({ paymentId, voucherId: alloc.voucherId, allocatedAmount: String(safeAlloc) });
        const currentPaid = await db.select({ paid: sql<number>`coalesce(sum(${paymentAllocationsTable.allocatedAmount}), 0)` })
          .from(paymentAllocationsTable).where(eq(paymentAllocationsTable.voucherId, alloc.voucherId));
        const totalPaid = Number(currentPaid[0]?.paid || 0);
        const newStatus = totalPaid >= grandTotal - 0.001 ? "paid" : totalPaid > 0 ? "partial" : "posted";
        await db.update(vouchersTable).set({ paidAmount: String(totalPaid), status: newStatus }).where(eq(vouchersTable.id, alloc.voucherId));
      }
    }

    const updated = await db.query.paymentsTable.findFirst({ where: eq(paymentsTable.id, paymentId) });
    res.json({ ...updated, amount: Number(updated!.amount) });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const businessId = req.user!.businessId!;
    const paymentId = Number(req.params.id);

    // Reverse allocations: recalculate paid amount on each affected voucher
    const oldAllocs = await db.select().from(paymentAllocationsTable).where(eq(paymentAllocationsTable.paymentId, paymentId));
    for (const alloc of oldAllocs) {
      const remaining = await db.select({ paid: sql<number>`coalesce(sum(${paymentAllocationsTable.allocatedAmount}), 0)` })
        .from(paymentAllocationsTable)
        .where(and(eq(paymentAllocationsTable.voucherId, alloc.voucherId), sql`${paymentAllocationsTable.paymentId} != ${paymentId}`));
      const totalPaid = Number(remaining[0]?.paid || 0);
      const voucher = await db.query.vouchersTable.findFirst({ where: eq(vouchersTable.id, alloc.voucherId) });
      if (voucher) {
        const grandTotal = Number(voucher.grandTotal);
        const newStatus = totalPaid >= grandTotal ? "paid" : totalPaid > 0 ? "partial" : "posted";
        await db.update(vouchersTable).set({ paidAmount: String(totalPaid), status: newStatus }).where(eq(vouchersTable.id, alloc.voucherId));
      }
    }

    await db.delete(paymentAllocationsTable).where(eq(paymentAllocationsTable.paymentId, paymentId));
    await db.delete(paymentsTable).where(and(eq(paymentsTable.id, paymentId), eq(paymentsTable.businessId, businessId)));
    res.json({ success: true });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

export default router;
