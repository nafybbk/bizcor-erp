import { Router } from "express";
import { db } from "@workspace/db";
import { vouchersTable, voucherItemsTable, partiesTable, itemsTable, taxRatesTable, businessesTable } from "@workspace/db";
import { eq, and, sql, desc, gte, lte, isNull, isNotNull } from "drizzle-orm";
import { requireBusiness } from "../middlewares/auth";

const router = Router();
router.use(requireBusiness);

type VoucherType = "sales_invoice" | "credit_note" | "purchase_bill" | "debit_note";

function calcVoucher(items: Array<{
  quantity: number; rate: number; discount: number; discountType: string;
  taxRate: number; isInterState: boolean;
}>) {
  let subTotal = 0, totalDiscount = 0, taxableAmount = 0;
  let totalCgst = 0, totalSgst = 0, totalIgst = 0;
  const processedItems = items.map(item => {
    const gross = item.quantity * item.rate;
    const discount = item.discountType === "percent"
      ? gross * (item.discount / 100)
      : item.discount;
    const taxable = gross - discount;
    const cgst = item.isInterState ? 0 : taxable * (item.taxRate / 2 / 100);
    const sgst = item.isInterState ? 0 : taxable * (item.taxRate / 2 / 100);
    const igst = item.isInterState ? taxable * (item.taxRate / 100) : 0;
    const tax = cgst + sgst + igst;
    subTotal += gross;
    totalDiscount += discount;
    taxableAmount += taxable;
    totalCgst += cgst;
    totalSgst += sgst;
    totalIgst += igst;
    return { ...item, gross, discount, taxable, cgst, sgst, igst, tax, total: taxable + tax };
  });
  return { processedItems, subTotal, totalDiscount, taxableAmount, totalCgst, totalSgst, totalIgst, totalTax: totalCgst + totalSgst + totalIgst };
}

async function getVoucherList(req: any, res: any, voucherType: VoucherType) {
  const { page = "1", limit = "20", partyId, fromDate, toDate, status } = req.query;
  const businessId = req.user!.businessId!;
  const conditions: any[] = [
    eq(vouchersTable.businessId, businessId),
    eq(vouchersTable.voucherType, voucherType),
    isNull(vouchersTable.deletedAt),
  ];
  if (partyId) conditions.push(eq(vouchersTable.partyId, Number(partyId)));
  if (fromDate) conditions.push(gte(vouchersTable.date, String(fromDate)));
  if (toDate) conditions.push(lte(vouchersTable.date, String(toDate)));
  if (status) conditions.push(eq(vouchersTable.status, status as any));
  const vouchers = await db.select({
    id: vouchersTable.id, voucherType: vouchersTable.voucherType, voucherNumber: vouchersTable.voucherNumber,
    date: vouchersTable.date, partyId: vouchersTable.partyId, partyName: partiesTable.name,
    partyGstin: partiesTable.gstin, grandTotal: vouchersTable.grandTotal, paidAmount: vouchersTable.paidAmount,
    status: vouchersTable.status, createdAt: vouchersTable.createdAt,
    totalTax: vouchersTable.totalTax, taxableAmount: vouchersTable.taxableAmount,
  }).from(vouchersTable).leftJoin(partiesTable, eq(vouchersTable.partyId, partiesTable.id))
    .where(and(...conditions)).orderBy(desc(vouchersTable.date)).limit(Number(limit)).offset((Number(page) - 1) * Number(limit));
  const [{ total }] = await db.select({ total: sql<number>`count(*)` }).from(vouchersTable).where(and(...conditions));
  const [{ totalAmount }] = await db.select({ totalAmount: sql<number>`coalesce(sum(${vouchersTable.grandTotal}::numeric), 0)` }).from(vouchersTable).where(and(...conditions));
  const data = vouchers.map(v => ({
    ...v, grandTotal: Number(v.grandTotal), paidAmount: Number(v.paidAmount || 0),
    balanceDue: Number(v.grandTotal) - Number(v.paidAmount || 0),
  }));
  res.json({ data, total: Number(total), page: Number(page), limit: Number(limit), totalAmount: Number(totalAmount) });
}

async function getVoucherById(req: any, res: any) {
  const businessId = req.user!.businessId!;
  const voucher = await db.query.vouchersTable.findFirst({
    where: and(eq(vouchersTable.id, Number(req.params.id)), eq(vouchersTable.businessId, businessId)),
  });
  if (!voucher) { res.status(404).json({ error: "Not Found" }); return; }
  const party = await db.query.partiesTable.findFirst({ where: eq(partiesTable.id, voucher.partyId) });
  const items = await db.select().from(voucherItemsTable).where(eq(voucherItemsTable.voucherId, voucher.id));

  let linkedVoucherNumber: string | null = null;
  if (voucher.linkedVoucherId) {
    const linked = await db.query.vouchersTable.findFirst({ where: eq(vouchersTable.id, voucher.linkedVoucherId) });
    linkedVoucherNumber = linked?.voucherNumber ?? null;
  }

  res.json({
    ...voucher, partyName: party?.name, partyGstin: party?.gstin,
    linkedVoucherNumber,
    items: items.map(i => ({ ...i, quantity: Number(i.quantity), rate: Number(i.rate), discount: Number(i.discount), taxableAmount: Number(i.taxableAmount), taxRate: Number(i.taxRate), cgst: Number(i.cgst), sgst: Number(i.sgst), igst: Number(i.igst), taxAmount: Number(i.taxAmount), total: Number(i.total) })),
    grandTotal: Number(voucher.grandTotal), paidAmount: Number(voucher.paidAmount || 0),
    balanceDue: Number(voucher.grandTotal) - Number(voucher.paidAmount || 0),
    subTotal: Number(voucher.subTotal), totalDiscount: Number(voucher.totalDiscount),
    taxableAmount: Number(voucher.taxableAmount), totalTax: Number(voucher.totalTax),
    transportCharges: Number(voucher.transportCharges || 0),
  });
}

const START_NUM_FIELD: Record<string, string> = {
  sales_invoice: "siStartNumber",
  credit_note: "cnStartNumber",
  purchase_bill: "pbStartNumber",
  debit_note: "dnStartNumber",
};

async function generateVoucherNumber(businessId: number, voucherType: VoucherType): Promise<string> {
  const business = await db.query.businessesTable.findFirst({ where: eq(businessesTable.id, businessId) });
  const prefixMap: Record<string, string> = {
    sales_invoice: business?.invoicePrefix || "SI",
    credit_note: business?.creditNotePrefix || "CN",
    purchase_bill: business?.billPrefix || "PB",
    debit_note: business?.debitNotePrefix || "DN",
  };
  const startNumField = START_NUM_FIELD[voucherType];
  const startNum = Number((business as any)?.[startNumField] ?? 1);
  const prefix = prefixMap[voucherType];
  const sep = business?.numberSeparator ?? "-";
  const digits = Number(business?.numberDigits ?? 4);
  const series = Number(business?.numberSeries ?? 1);
  // Count ALL vouchers (including soft-deleted) to prevent number reuse
  const [{ cnt }] = await db.select({ cnt: sql<number>`count(*)` }).from(vouchersTable)
    .where(and(eq(vouchersTable.businessId, businessId), eq(vouchersTable.voucherType, voucherType)));
  const serial = startNum + Number(cnt);
  return `${prefix}${sep}${series}${sep}${String(serial).padStart(digits, "0")}`;
}

async function getNextVoucherNumber(businessId: number, voucherType: VoucherType): Promise<string> {
  return generateVoucherNumber(businessId, voucherType);
}

async function createVoucher(req: any, res: any, voucherType: VoucherType) {
  const businessId = req.user!.businessId!;
  const { date, partyId, billingAddress, useShippingAddress, shippingAddress, items: rawItems, transportCharges, roundOff, notes, termsAndConditions, linkedVoucherId, placeOfSupply, customFields, status, voucherNumber: customNumber } = req.body;

  const parsedPartyId = parseInt(String(partyId), 10);
  if (!parsedPartyId || isNaN(parsedPartyId)) {
    res.status(400).json({ error: "Bad Request", message: "Please select a valid party" });
    return;
  }
  if (!rawItems || !Array.isArray(rawItems) || rawItems.length === 0) {
    res.status(400).json({ error: "Bad Request", message: "At least one item is required" });
    return;
  }

  const party = await db.query.partiesTable.findFirst({ where: eq(partiesTable.id, parsedPartyId) });
  const business = await db.query.businessesTable.findFirst({ where: eq(businessesTable.id, businessId) });
  const isInterState = !!(party?.stateCode && business?.stateCode && party.stateCode !== business.stateCode);

  let taxRates: any[] = [];
  try {
    taxRates = await db.select().from(taxRatesTable).where(eq(taxRatesTable.businessId, businessId));
  } catch {
    // tax_rates query failed — custom rates from frontend will be used
  }
  const itemDetails = rawItems.map((ri: any) => ({
    quantity: Number(ri.quantity), rate: Number(ri.rate),
    discount: Number(ri.discount || 0), discountType: ri.discountType || "percent",
    taxRate: Number(taxRates.find(t => t.id === ri.taxRateId)?.rate || ri.taxRate || 0),
    isInterState,
  }));
  const calc = calcVoucher(itemDetails);
  const transport = Number(transportCharges || 0);
  const round = Number(roundOff || 0);
  const grandTotal = calc.taxableAmount + calc.totalTax + transport + round;

  let voucherNum: string;
  if (customNumber) {
    // Check duplicate — only among non-deleted vouchers
    const existing = await db.query.vouchersTable.findFirst({
      where: and(
        eq(vouchersTable.businessId, businessId),
        eq(vouchersTable.voucherType, voucherType),
        eq(vouchersTable.voucherNumber, customNumber),
        isNull(vouchersTable.deletedAt),
      ),
    });
    if (existing) {
      const suggested = await generateVoucherNumber(businessId, voucherType);
      res.status(409).json({
        error: "duplicate_number",
        message: `Voucher number "${customNumber}" pehle se exist karta hai. Suggested: ${suggested}`,
        suggestedNumber: suggested,
      });
      return;
    }
    voucherNum = customNumber;
  } else {
    voucherNum = await generateVoucherNumber(businessId, voucherType);
  }

  const voucherInsert: Record<string, any> = {
    businessId, voucherType, voucherNumber: voucherNum, date, partyId: parsedPartyId,
    billingAddress: billingAddress || party?.address || null,
    useShippingAddress: useShippingAddress || false, shippingAddress: shippingAddress || null,
    subTotal: String(calc.subTotal), totalDiscount: String(calc.totalDiscount),
    taxableAmount: String(calc.taxableAmount), totalCgst: String(calc.totalCgst),
    totalSgst: String(calc.totalSgst), totalIgst: String(calc.totalIgst),
    totalTax: String(calc.totalTax), transportCharges: String(transport),
    roundOff: String(round), grandTotal: String(grandTotal),
    status: status || "posted", notes: notes || null, termsAndConditions: termsAndConditions || null,
    linkedVoucherId: linkedVoucherId || null, isInterState,
    placeOfSupply: placeOfSupply || party?.stateCode || null,
  };
  if (customFields && typeof customFields === "object" && Object.keys(customFields).length > 0) {
    voucherInsert.customFields = customFields;
  }
  const [voucher] = await db.insert(vouchersTable).values(voucherInsert).returning();

  const voucherItemRows = rawItems.map((ri: any, idx: number) => {
    const pi = calc.processedItems[idx];
    const itemName = ri.itemName || "Item";
    const taxRateId = (ri.taxRateId && Number(ri.taxRateId) > 0) ? Number(ri.taxRateId) : null;
    const row: Record<string, any> = {
      voucherId: voucher.id, itemId: ri.itemId ? Number(ri.itemId) : null, itemName,
      description: ri.description || null, hsnCode: ri.hsnCode || null,
      quantity: String(Number(ri.quantity) || 0),
      unit: ri.unit || null, rate: String(Number(ri.rate) || 0),
      discount: String(pi.discount), discountType: ri.discountType || "percent",
      taxableAmount: String(pi.taxable), taxRateId,
      taxRate: String(pi.taxRate), cgst: String(pi.cgst), sgst: String(pi.sgst),
      igst: String(pi.igst), taxAmount: String(pi.tax), total: String(pi.total),
    };
    if (ri.customFields && typeof ri.customFields === "object" && Object.keys(ri.customFields).length > 0) {
      row.customFields = ri.customFields;
    }
    return row;
  });
  await db.insert(voucherItemsTable).values(voucherItemRows);
  res.status(201).json({ ...voucher, grandTotal: Number(voucher.grandTotal) });
}

async function updateVoucher(req: any, res: any) {
  const businessId = req.user!.businessId!;
  const allowed = ["date","status","notes","termsAndConditions","useShippingAddress","shippingAddress","placeOfSupply","customFields"];
  const updateData: Record<string, unknown> = {};
  for (const key of allowed) if (req.body[key] !== undefined) updateData[key] = req.body[key];
  const [updated] = await db.update(vouchersTable).set(updateData).where(and(eq(vouchersTable.id, Number(req.params.id)), eq(vouchersTable.businessId, businessId))).returning();
  res.json(updated);
}

async function deleteVoucher(req: any, res: any) {
  const businessId = req.user!.businessId!;
  const id = Number(req.params.id);
  // Soft delete — move to Bin (raw SQL to avoid Drizzle column-mapping issues on Supabase)
  await db.execute(sql`
    UPDATE vouchers
    SET deleted_at = NOW()
    WHERE id = ${id} AND business_id = ${businessId}
  `);
  res.json({ success: true });
}

function errHandler(req: any, res: any) {
  return (err: any) => {
    req.log.error(err);
    res.status(500).json({ error: "Internal Server Error", detail: err?.message || String(err) });
  };
}

// ─── NEXT NUMBER PREVIEW ──────────────────────────────────────────────────────
const API_TYPE_MAP: Record<string, VoucherType> = {
  "sales/invoices": "sales_invoice",
  "credit-notes": "credit_note",
  "purchases/bills": "purchase_bill",
  "debit-notes": "debit_note",
  "sales_invoice": "sales_invoice",
  "credit_note": "credit_note",
  "purchase_bill": "purchase_bill",
  "debit_note": "debit_note",
};

router.get("/next-number", async (req, res) => {
  try {
    const businessId = req.user!.businessId!;
    const typeParam = String(req.query.type || "sales_invoice");
    const voucherType = API_TYPE_MAP[typeParam] || "sales_invoice";
    const nextNum = await getNextVoucherNumber(businessId, voucherType);
    res.json({ nextNumber: nextNum });
  } catch (err: any) {
    req.log.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// ─── BIN (Deleted Vouchers) ───────────────────────────────────────────────────
router.get("/bin", async (req, res) => {
  try {
    const businessId = req.user!.businessId!;
    const rows = await db.execute(sql`
      SELECT v.id, v.voucher_type AS "voucherType", v.voucher_number AS "voucherNumber",
             v.date, v.grand_total AS "grandTotal", v.status, v.deleted_at AS "deletedAt",
             p.name AS "partyName"
      FROM vouchers v
      LEFT JOIN parties p ON p.id = v.party_id
      WHERE v.business_id = ${businessId}
        AND v.deleted_at IS NOT NULL
      ORDER BY v.deleted_at DESC
    `);
    const vouchers = (rows as any[]).map((v: any) => ({
      ...v,
      grandTotal: Number(v.grandTotal || 0),
    }));
    res.json(vouchers);
  } catch (err: any) {
    req.log.error(err);
    res.status(500).json({ error: "Internal Server Error", detail: err?.message });
  }
});

router.patch("/bin/restore/:id", async (req, res) => {
  try {
    const businessId = req.user!.businessId!;
    const id = Number(req.params.id);
    const result = await db.execute(sql`
      UPDATE vouchers
      SET deleted_at = NULL
      WHERE id = ${id} AND business_id = ${businessId}
      RETURNING id
    `);
    const rows = result as any[];
    if (!rows.length) { res.status(404).json({ error: "Not Found" }); return; }
    res.json({ success: true, id: rows[0].id });
  } catch (err: any) {
    req.log.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.delete("/bin/delete/:id", async (req, res) => {
  try {
    const businessId = req.user!.businessId!;
    const id = Number(req.params.id);
    await db.execute(sql`DELETE FROM voucher_items WHERE voucher_id = ${id}`);
    await db.execute(sql`DELETE FROM vouchers WHERE id = ${id} AND business_id = ${businessId}`);
    res.json({ success: true });
  } catch (err: any) {
    req.log.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// SALES INVOICES
router.get("/sales/invoices", (req, res) => getVoucherList(req, res, "sales_invoice").catch(errHandler(req, res)));
router.post("/sales/invoices", (req, res) => createVoucher(req, res, "sales_invoice").catch(errHandler(req, res)));
router.get("/sales/invoices/:id", (req, res) => getVoucherById(req, res).catch(errHandler(req, res)));
router.patch("/sales/invoices/:id", (req, res) => updateVoucher(req, res).catch(errHandler(req, res)));
router.delete("/sales/invoices/:id", (req, res) => deleteVoucher(req, res).catch(errHandler(req, res)));

// CREDIT NOTES (Sales Returns)
router.get("/sales/credit-notes", (req, res) => getVoucherList(req, res, "credit_note").catch(errHandler(req, res)));
router.post("/sales/credit-notes", (req, res) => createVoucher(req, res, "credit_note").catch(errHandler(req, res)));
router.get("/sales/credit-notes/:id", (req, res) => getVoucherById(req, res).catch(errHandler(req, res)));
router.patch("/sales/credit-notes/:id", (req, res) => updateVoucher(req, res).catch(errHandler(req, res)));
router.delete("/sales/credit-notes/:id", (req, res) => deleteVoucher(req, res).catch(errHandler(req, res)));

// PURCHASE BILLS
router.get("/purchases/bills", (req, res) => getVoucherList(req, res, "purchase_bill").catch(errHandler(req, res)));
router.post("/purchases/bills", (req, res) => createVoucher(req, res, "purchase_bill").catch(errHandler(req, res)));
router.get("/purchases/bills/:id", (req, res) => getVoucherById(req, res).catch(errHandler(req, res)));
router.patch("/purchases/bills/:id", (req, res) => updateVoucher(req, res).catch(errHandler(req, res)));
router.delete("/purchases/bills/:id", (req, res) => deleteVoucher(req, res).catch(errHandler(req, res)));

// DEBIT NOTES (Purchase Returns)
router.get("/purchases/debit-notes", (req, res) => getVoucherList(req, res, "debit_note").catch(errHandler(req, res)));
router.post("/purchases/debit-notes", (req, res) => createVoucher(req, res, "debit_note").catch(errHandler(req, res)));
router.get("/purchases/debit-notes/:id", (req, res) => getVoucherById(req, res).catch(err => { req.log.error(err); res.status(500).json({ error: "Internal Server Error" }); }));
router.patch("/purchases/debit-notes/:id", (req, res) => updateVoucher(req, res).catch(err => { req.log.error(err); res.status(500).json({ error: "Internal Server Error" }); }));
router.delete("/purchases/debit-notes/:id", (req, res) => deleteVoucher(req, res).catch(err => { req.log.error(err); res.status(500).json({ error: "Internal Server Error" }); }));

export default router;
