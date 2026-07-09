import { Router } from "express";
import { db } from "@workspace/db";
import { vouchersTable, voucherItemsTable, partiesTable, itemsTable, taxRatesTable, businessesTable } from "@workspace/db";
import { eq, and, sql, desc, gte, lte, isNull, isNotNull, like, or } from "drizzle-orm";
import { requireBusiness } from "../middlewares/auth";
import { pushLanSyncVoucher } from "../lib/lanSync";

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
  try {
    const { page = "1", limit = "20", partyId, fromDate, toDate, status, search } = req.query;
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
    if (search) conditions.push(or(like(vouchersTable.voucherNumber, `%${search}%`), like(partiesTable.name, `%${search}%`))!);
    const vouchers = await db.select({
      id: vouchersTable.id, voucherType: vouchersTable.voucherType, voucherNumber: vouchersTable.voucherNumber,
      date: vouchersTable.date, partyId: vouchersTable.partyId, partyName: partiesTable.name,
      partyGstin: partiesTable.gstin, grandTotal: vouchersTable.grandTotal, paidAmount: vouchersTable.paidAmount,
      status: vouchersTable.status, createdAt: vouchersTable.createdAt,
      totalTax: vouchersTable.totalTax, taxableAmount: vouchersTable.taxableAmount,
    }).from(vouchersTable).leftJoin(partiesTable, eq(vouchersTable.partyId, partiesTable.id))
      .where(and(...conditions)).orderBy(desc(vouchersTable.date)).limit(Number(limit)).offset((Number(page) - 1) * Number(limit));
    const [{ total }] = await db.select({ total: sql<number>`count(*)` }).from(vouchersTable)
      .leftJoin(partiesTable, eq(vouchersTable.partyId, partiesTable.id)).where(and(...conditions));
    const [{ totalAmount }] = await db.select({ totalAmount: sql<number>`coalesce(sum(${vouchersTable.grandTotal}), 0)` }).from(vouchersTable)
      .leftJoin(partiesTable, eq(vouchersTable.partyId, partiesTable.id)).where(and(...conditions));
    const data = vouchers.map((v: any) => ({
      ...v, grandTotal: Number(v.grandTotal), paidAmount: Number(v.paidAmount || 0),
      balanceDue: Number(v.grandTotal) - Number(v.paidAmount || 0),
    }));
    res.json({ data, total: Number(total), page: Number(page), limit: Number(limit), totalAmount: Number(totalAmount) });
  } catch (err: any) {
    req.log?.error(err);
    res.status(500).json({ error: "Internal Server Error", message: err?.message });
  }
}

async function getVoucherById(req: any, res: any) {
  const businessId = req.user!.businessId!;
  const [voucher] = await db.select().from(vouchersTable)
    .where(and(eq(vouchersTable.id, Number(req.params.id)), eq(vouchersTable.businessId, businessId)))
    .limit(1);
  if (!voucher) { res.status(404).json({ error: "Not Found" }); return; }
  const [party] = await db.select().from(partiesTable).where(eq(partiesTable.id, voucher.partyId)).limit(1);
  const items = await db.select().from(voucherItemsTable).where(eq(voucherItemsTable.voucherId, voucher.id));

  let linkedVoucherNumber: string | null = null;
  if (voucher.linkedVoucherId) {
    const [linked] = await db.select().from(vouchersTable).where(eq(vouchersTable.id, voucher.linkedVoucherId)).limit(1);
    linkedVoucherNumber = linked?.voucherNumber ?? null;
  }

  res.json({
    ...voucher, partyName: party?.name, partyGstin: party?.gstin,
    linkedVoucherNumber,
    items: items.map((i: any) => ({ ...i, quantity: Number(i.quantity), rate: Number(i.rate), discount: Number(i.discount), taxableAmount: Number(i.taxableAmount), taxRate: Number(i.taxRate), cgst: Number(i.cgst), sgst: Number(i.sgst), igst: Number(i.igst), taxAmount: Number(i.taxAmount), total: Number(i.total) })),
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
  // Find highest existing serial to prevent reuse AND respect startNum setting
  const existing = await db
    .select({ num: vouchersTable.voucherNumber })
    .from(vouchersTable)
    .where(and(eq(vouchersTable.businessId, businessId), eq(vouchersTable.voucherType, voucherType)));
  let maxExisting = 0;
  for (const { num } of existing) {
    if (!num) continue;
    const m = num.match(/(\d+)$/);
    if (m) maxExisting = Math.max(maxExisting, parseInt(m[1], 10));
  }
  // serial = max(startNum, maxExisting+1) — startNum acts as a floor
  const serial = Math.max(startNum, maxExisting + 1);
  // Only include series in number if explicitly set to > 1 (default=1 means no series prefix)
  return series > 1
    ? `${prefix}${sep}${series}${sep}${String(serial).padStart(digits, "0")}`
    : `${prefix}${sep}${String(serial).padStart(digits, "0")}`;
}

async function getNextVoucherNumber(businessId: number, voucherType: VoucherType): Promise<string> {
  return generateVoucherNumber(businessId, voucherType);
}

async function createVoucher(req: any, res: any, voucherType: VoucherType) {
  const businessId = req.user!.businessId!;
  const { date, partyId, billingAddress, useShippingAddress, shippingAddress, items: rawItems, transportCharges, transportName, roundOff, notes, termsAndConditions, linkedVoucherId, placeOfSupply, customFields, status, voucherNumber: customNumber, referenceNumber, dueDate } = req.body;

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
    transportName: transportName || null,
    roundOff: String(round), grandTotal: String(grandTotal),
    status: status || "posted", notes: notes || null, termsAndConditions: termsAndConditions || null,
    linkedVoucherId: linkedVoucherId || null, isInterState,
    placeOfSupply: placeOfSupply || party?.stateCode || null,
    referenceNumber: referenceNumber || null,
    dueDate: dueDate || null,
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

  // LAN sync — fire-and-forget push to cloud when party has mini-app enabled
  pushLanSyncVoucher(req, {
    partyId: parsedPartyId, externalId: voucher.id, voucherType,
    voucherNumber: voucherNum, date: String(date),
    grandTotal: voucher.grandTotal || 0, status: status || "posted", notes,
  });

  res.status(201).json({ ...voucher, grandTotal: Number(voucher.grandTotal) });
}

async function updateVoucher(req: any, res: any) {
  const businessId = req.user!.businessId!;
  const id = Number(req.params.id);
  const { date, partyId, billingAddress, useShippingAddress, shippingAddress, items: rawItems, transportCharges, transportName, roundOff, notes, termsAndConditions, linkedVoucherId, placeOfSupply, customFields, status, referenceNumber, dueDate } = req.body;

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
  } catch { /* use frontend taxRate fallback */ }

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

  const updateData: Record<string, any> = {
    date, partyId: parsedPartyId,
    billingAddress: billingAddress || party?.address || null,
    useShippingAddress: useShippingAddress || false,
    shippingAddress: shippingAddress || null,
    subTotal: String(calc.subTotal), totalDiscount: String(calc.totalDiscount),
    taxableAmount: String(calc.taxableAmount), totalCgst: String(calc.totalCgst),
    totalSgst: String(calc.totalSgst), totalIgst: String(calc.totalIgst),
    totalTax: String(calc.totalTax), transportCharges: String(transport),
    transportName: transportName || null,
    roundOff: String(round), grandTotal: String(grandTotal),
    status: status || "posted", notes: notes || null,
    termsAndConditions: termsAndConditions || null,
    linkedVoucherId: linkedVoucherId || null, isInterState,
    placeOfSupply: placeOfSupply || party?.stateCode || null,
    referenceNumber: referenceNumber || null,
    dueDate: dueDate || null,
    deletedAt: null,
  };
  if (customFields && typeof customFields === "object" && Object.keys(customFields).length > 0) {
    updateData.customFields = customFields;
  }

  const [updated] = await db.update(vouchersTable).set(updateData)
    .where(and(eq(vouchersTable.id, id), eq(vouchersTable.businessId, businessId)))
    .returning();
  if (!updated) { res.status(404).json({ error: "Not Found" }); return; }

  // Replace all voucher items
  await db.delete(voucherItemsTable).where(eq(voucherItemsTable.voucherId, id));
  const voucherItemRows = rawItems.map((ri: any, idx: number) => {
    const pi = calc.processedItems[idx];
    const taxRateId = (ri.taxRateId && Number(ri.taxRateId) > 0) ? Number(ri.taxRateId) : null;
    const row: Record<string, any> = {
      voucherId: id, itemId: ri.itemId ? Number(ri.itemId) : null,
      itemName: ri.itemName || "Item",
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

  // LAN sync — re-push so the customer's copy reflects the edit
  pushLanSyncVoucher(req, {
    partyId: parsedPartyId, externalId: updated.id, voucherType: updated.voucherType,
    voucherNumber: updated.voucherNumber, date: String(updated.date),
    grandTotal: updated.grandTotal || 0, status: updated.status || "posted", notes,
  });

  res.json({ ...updated, grandTotal: Number(updated.grandTotal) });
}

async function deleteVoucher(req: any, res: any) {
  const businessId = req.user!.businessId!;
  const id = Number(req.params.id);
  // Use sql`` template — works for SQLite (text column) AND PostgreSQL (timestamp column)
  // Passing new Date() directly fails in SQLite because better-sqlite3 cannot bind Date objects
  const [deleted] = await db.update(vouchersTable)
    .set({ deletedAt: sql`${new Date().toISOString()}` as unknown as Date })
    .where(and(eq(vouchersTable.id, id), eq(vouchersTable.businessId, businessId)))
    .returning();

  // LAN sync — mark deleted so the customer's app stops showing it
  if (deleted) {
    pushLanSyncVoucher(req, {
      partyId: deleted.partyId, externalId: deleted.id, voucherType: deleted.voucherType,
      voucherNumber: deleted.voucherNumber, date: String(deleted.date),
      grandTotal: deleted.grandTotal || 0, status: "deleted", notes: deleted.notes,
    });
  }
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
    const typeParam = req.query.type as string | undefined;
    // Drizzle ORM — works on both SQLite + PostgreSQL
    const conditions: any[] = [
      eq(vouchersTable.businessId, businessId),
      isNotNull(vouchersTable.deletedAt),
    ];
    if (typeParam) conditions.push(eq(vouchersTable.voucherType, typeParam as any));

    const rows = await db.select({
      id: vouchersTable.id,
      voucherType: vouchersTable.voucherType,
      voucherNumber: vouchersTable.voucherNumber,
      date: vouchersTable.date,
      grandTotal: vouchersTable.grandTotal,
      status: vouchersTable.status,
      deletedAt: vouchersTable.deletedAt,
      partyName: partiesTable.name,
    }).from(vouchersTable)
      .leftJoin(partiesTable, eq(vouchersTable.partyId, partiesTable.id))
      .where(and(...conditions))
      .orderBy(desc(vouchersTable.deletedAt));

    res.json(rows.map((v: any) => ({ ...v, grandTotal: Number(v.grandTotal || 0) })));
  } catch (err: any) {
    req.log.error(err);
    res.status(500).json({ error: "Internal Server Error", detail: err?.message });
  }
});

router.post("/bin/:id/restore", async (req, res) => {
  try {
    const businessId = req.user!.businessId!;
    const id = Number(req.params.id);
    // Drizzle ORM update — works on both SQLite + PostgreSQL
    const [restored] = await db.update(vouchersTable)
      .set({ deletedAt: null })
      .where(and(eq(vouchersTable.id, id), eq(vouchersTable.businessId, businessId)))
      .returning();

    // LAN sync — restore the customer's copy (was marked deleted)
    if (restored) {
      pushLanSyncVoucher(req, {
        partyId: restored.partyId, externalId: restored.id, voucherType: restored.voucherType,
        voucherNumber: restored.voucherNumber, date: String(restored.date),
        grandTotal: restored.grandTotal || 0, status: restored.status || "posted", notes: restored.notes,
      });
    }
    res.json({ success: true, id });
  } catch (err: any) {
    req.log.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.delete("/bin/:id", async (req, res) => {
  try {
    const businessId = req.user!.businessId!;
    const id = Number(req.params.id);
    // Drizzle ORM delete — works on both SQLite + PostgreSQL
    await db.delete(voucherItemsTable).where(eq(voucherItemsTable.voucherId, id));
    await db.delete(vouchersTable).where(and(eq(vouchersTable.id, id), eq(vouchersTable.businessId, businessId)));
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
