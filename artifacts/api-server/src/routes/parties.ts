import { Router } from "express";
import { db } from "@workspace/db";
import { partiesTable, vouchersTable, paymentsTable, paymentAllocationsTable } from "@workspace/db";
import { eq, and, like, or, sql, desc, isNotNull } from "drizzle-orm";
import { requireBusiness } from "../middlewares/auth";

// Generate AC0001 / AS0001 style unique codes per business per first-letter group
async function generatePartyCodes(businessId: number, name: string, type: string) {
  const fl = (name.trim()[0] || "X").toUpperCase();
  let customerCode: string | undefined;
  let supplierCode: string | undefined;

  if (type === "customer" || type === "both") {
    const [{ cnt }] = await db.select({ cnt: sql<number>`count(*)` })
      .from(partiesTable)
      .where(and(
        eq(partiesTable.businessId, businessId),
        sql`UPPER(SUBSTR(TRIM(${partiesTable.name}), 1, 1)) = ${fl}`,
        or(eq(partiesTable.type, "customer" as any), eq(partiesTable.type, "both" as any))!,
        isNotNull(partiesTable.customerCode)
      ));
    customerCode = `${fl}C${String(Number(cnt) + 1).padStart(4, "0")}`;
  }

  if (type === "supplier" || type === "both") {
    const [{ cnt }] = await db.select({ cnt: sql<number>`count(*)` })
      .from(partiesTable)
      .where(and(
        eq(partiesTable.businessId, businessId),
        sql`UPPER(SUBSTR(TRIM(${partiesTable.name}), 1, 1)) = ${fl}`,
        or(eq(partiesTable.type, "supplier" as any), eq(partiesTable.type, "both" as any))!,
        isNotNull(partiesTable.supplierCode)
      ));
    supplierCode = `${fl}S${String(Number(cnt) + 1).padStart(4, "0")}`;
  }

  return { customerCode, supplierCode };
}

const router = Router();
router.use(requireBusiness);

router.get("/", async (req, res) => {
  try {
    const { type, search, page = "1", limit } = req.query;
    const businessId = req.user!.businessId!;
    const conditions: ReturnType<typeof eq>[] = [eq(partiesTable.businessId, businessId)];
    if (type && type !== "both") conditions.push(or(eq(partiesTable.type, type as "customer" | "supplier" | "both"), eq(partiesTable.type, "both"))!);
    if (search) conditions.push(or(like(partiesTable.name, `%${search}%`), like(partiesTable.gstin, `%${search}%`))!);
    let q = db.select().from(partiesTable).where(and(...conditions)).orderBy(partiesTable.name);
    const lim = limit ? Number(limit) : null;
    const pg = Number(page);
    const parties = lim ? await (q as any).limit(lim).offset((pg - 1) * lim) : await q;
    const [{ total }] = await db.select({ total: sql<number>`count(*)` }).from(partiesTable).where(and(...conditions));
    res.json({ data: parties, total: Number(total), page: pg, limit: lim ?? Number(total) });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.post("/", async (req, res) => {
  try {
    const businessId = req.user!.businessId!;
    const { name, type, gstin, pan, phone, email, address, city, state, stateCode, pincode, openingBalance, openingBalanceType, creditLimit, creditDays, customFields, pin } = req.body;
    const { customerCode, supplierCode } = await generatePartyCodes(businessId, name, type);
    const [party] = await db.insert(partiesTable).values({
      businessId, name, type, gstin, pan, phone, email, address, city, state, stateCode, pincode,
      openingBalance: openingBalance ? String(openingBalance) : "0",
      openingBalanceType: openingBalanceType || "debit",
      creditLimit: creditLimit ? String(creditLimit) : "0",
      creditDays: creditDays || 0, customFields,
      customerCode, supplierCode, pin: pin || null,
    }).returning();
    res.status(201).json(party);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const party = await db.query.partiesTable.findFirst({ where: and(eq(partiesTable.id, Number(req.params.id)), eq(partiesTable.businessId, req.user!.businessId!)) });
    if (!party) { res.status(404).json({ error: "Not Found" }); return; }
    res.json(party);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.patch("/:id", async (req, res) => {
  try {
    const allowed = ["name","type","gstin","pan","phone","email","address","city","state","stateCode","pincode","openingBalance","openingBalanceType","creditLimit","creditDays","isActive","customFields","shippingAddresses","pin","miniAppEnabled"];
    const updateData: Record<string, unknown> = {};
    for (const key of allowed) if (req.body[key] !== undefined) updateData[key] = req.body[key];
    // Safely coerce numeric fields — empty string from form would break integer/numeric DB columns
    if (updateData.openingBalance !== undefined) updateData.openingBalance = updateData.openingBalance === "" ? "0" : String(updateData.openingBalance);
    if (updateData.creditLimit !== undefined) updateData.creditLimit = updateData.creditLimit === "" ? "0" : String(updateData.creditLimit);
    if (updateData.creditDays !== undefined) updateData.creditDays = updateData.creditDays === "" ? 0 : (Number(updateData.creditDays) || 0);
    // shippingAddresses is not a DB column — remove it from updateData to avoid Drizzle errors
    delete updateData.shippingAddresses;
    const [updated] = await db.update(partiesTable).set(updateData).where(and(eq(partiesTable.id, Number(req.params.id)), eq(partiesTable.businessId, req.user!.businessId!))).returning();
    res.json(updated);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    await db.delete(partiesTable).where(and(eq(partiesTable.id, Number(req.params.id)), eq(partiesTable.businessId, req.user!.businessId!)));
    res.json({ success: true });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.get("/:id/balance", async (req, res) => {
  try {
    const partyId = Number(req.params.id);
    const businessId = req.user!.businessId!;
    const party = await db.query.partiesTable.findFirst({ where: and(eq(partiesTable.id, partyId), eq(partiesTable.businessId, businessId)) });
    if (!party) { res.status(404).json({ error: "Not Found" }); return; }
    const [sales] = await db.select({
      total: sql<string>`coalesce(sum(grand_total), 0)`,
      paid: sql<string>`coalesce(sum(paid_amount), 0)`,
    }).from(vouchersTable).where(and(eq(vouchersTable.businessId, businessId), eq(vouchersTable.partyId, partyId), eq(vouchersTable.voucherType, "sales_invoice")));
    const outstanding = Number(sales.total) - Number(sales.paid);
    res.json({
      outstanding,
      creditLimit: Number(party.creditLimit || 0),
      creditDays: Number(party.creditDays || 0),
      partyName: party.name,
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.get("/:id/ledger", async (req, res) => {
  try {
    const partyId = Number(req.params.id);
    const businessId = req.user!.businessId!;
    const { fromDate, toDate } = req.query;
    const party = await db.query.partiesTable.findFirst({ where: and(eq(partiesTable.id, partyId), eq(partiesTable.businessId, businessId)) });
    if (!party) { res.status(404).json({ error: "Not Found" }); return; }
    let voucherQuery = db.select().from(vouchersTable).where(and(eq(vouchersTable.businessId, businessId), eq(vouchersTable.partyId, partyId)));
    const vouchers = await db.select().from(vouchersTable).where(and(eq(vouchersTable.businessId, businessId), eq(vouchersTable.partyId, partyId))).orderBy(vouchersTable.date);
    const payments = await db.select().from(paymentsTable).where(and(eq(paymentsTable.businessId, businessId), eq(paymentsTable.partyId, partyId))).orderBy(paymentsTable.date);
    const entries: Array<{ date: string; voucherType: string; voucherNumber: string; description: string; debit: number; credit: number; balance: number }> = [];
    let balance = Number(party.openingBalance || 0);
    if (party.openingBalanceType === "credit") balance = -balance;
    const openingBalance = balance;
    for (const v of vouchers) {
      const amount = Number(v.grandTotal);
      let debit = 0, credit = 0;
      if (v.voucherType === "sales_invoice") { debit = amount; balance += amount; }
      else if (v.voucherType === "credit_note") { credit = amount; balance -= amount; }
      else if (v.voucherType === "purchase_bill") { credit = amount; balance -= amount; }
      else if (v.voucherType === "debit_note") { debit = amount; balance += amount; }
      entries.push({ date: v.date, voucherType: v.voucherType, voucherNumber: v.voucherNumber, description: v.voucherType.replace("_", " "), debit, credit, balance });
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

export default router;
