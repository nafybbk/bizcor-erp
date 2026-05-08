import { Router } from "express";
import { db } from "@workspace/db";
import { itemsTable, unitsTable, taxRatesTable, voucherItemsTable, vouchersTable } from "@workspace/db";
import { eq, and, ilike, sql, desc } from "drizzle-orm";
import { requireBusiness } from "../middlewares/auth";

const router = Router();
router.use(requireBusiness);

router.get("/", async (req, res) => {
  try {
    const { search, page = "1", limit = "50", type } = req.query;
    const businessId = req.user!.businessId!;
    const conditions: ReturnType<typeof eq>[] = [eq(itemsTable.businessId, businessId)];
    if (search) conditions.push(ilike(itemsTable.name, `%${search}%`));
    if (type) conditions.push(eq(itemsTable.type, type as "goods" | "service"));
    const items = await db.select({
      id: itemsTable.id, name: itemsTable.name, description: itemsTable.description,
      type: itemsTable.type, hsnCode: itemsTable.hsnCode, unitId: itemsTable.unitId,
      taxRateId: itemsTable.taxRateId, salePrice: itemsTable.salePrice, purchasePrice: itemsTable.purchasePrice,
      openingStock: itemsTable.openingStock, lowStockAlert: itemsTable.lowStockAlert,
      isActive: itemsTable.isActive, customFields: itemsTable.customFields, createdAt: itemsTable.createdAt,
      unitName: unitsTable.symbol, taxRate: taxRatesTable.rate,
    }).from(itemsTable)
      .leftJoin(unitsTable, eq(itemsTable.unitId, unitsTable.id))
      .leftJoin(taxRatesTable, eq(itemsTable.taxRateId, taxRatesTable.id))
      .where(and(...conditions)).limit(Number(limit)).offset((Number(page) - 1) * Number(limit)).orderBy(itemsTable.name);
    const [{ total }] = await db.select({ total: sql<number>`count(*)` }).from(itemsTable).where(and(...conditions));
    const stockData = await db.select({
      itemId: voucherItemsTable.itemId,
      voucherType: vouchersTable.voucherType,
      qty: sql<number>`sum(${voucherItemsTable.quantity})`,
    }).from(voucherItemsTable).innerJoin(vouchersTable, eq(voucherItemsTable.voucherId, vouchersTable.id))
      .where(eq(vouchersTable.businessId, businessId)).groupBy(voucherItemsTable.itemId, vouchersTable.voucherType);
    const stockMap = new Map<number, number>();
    for (const s of stockData) {
      const current = stockMap.get(s.itemId!) || 0;
      if (s.voucherType === "purchase_bill") stockMap.set(s.itemId!, current + Number(s.qty));
      else if (s.voucherType === "sales_invoice") stockMap.set(s.itemId!, current - Number(s.qty));
      else if (s.voucherType === "debit_note") stockMap.set(s.itemId!, current - Number(s.qty));
      else if (s.voucherType === "credit_note") stockMap.set(s.itemId!, current + Number(s.qty));
    }
    const data = items.map(i => ({
      ...i, currentStock: Number(i.openingStock || 0) + (stockMap.get(i.id) || 0),
      salePrice: Number(i.salePrice), purchasePrice: Number(i.purchasePrice),
      taxRate: Number(i.taxRate || 0),
    }));
    res.json({ data, total: Number(total), page: Number(page), limit: Number(limit) });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.post("/", async (req, res) => {
  try {
    const businessId = req.user!.businessId!;
    const { name, description, type, hsnCode, unitId, taxRateId, salePrice, purchasePrice, openingStock, lowStockAlert, customFields } = req.body;
    const [item] = await db.insert(itemsTable).values({
      businessId, name, description, type: type || "goods", hsnCode, unitId, taxRateId,
      salePrice: salePrice ? String(salePrice) : "0",
      purchasePrice: purchasePrice ? String(purchasePrice) : "0",
      openingStock: openingStock ? String(openingStock) : "0",
      lowStockAlert: lowStockAlert ? String(lowStockAlert) : "0",
      customFields,
    }).returning();
    res.status(201).json(item);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const item = await db.query.itemsTable.findFirst({ where: and(eq(itemsTable.id, Number(req.params.id)), eq(itemsTable.businessId, req.user!.businessId!)) });
    if (!item) { res.status(404).json({ error: "Not Found" }); return; }
    res.json(item);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.patch("/:id", async (req, res) => {
  try {
    const allowed = ["name","description","type","hsnCode","unitId","taxRateId","salePrice","purchasePrice","openingStock","lowStockAlert","isActive","customFields"];
    const updateData: Record<string, unknown> = {};
    for (const key of allowed) if (req.body[key] !== undefined) updateData[key] = req.body[key];
    if (updateData.salePrice) updateData.salePrice = String(updateData.salePrice);
    if (updateData.purchasePrice) updateData.purchasePrice = String(updateData.purchasePrice);
    const [updated] = await db.update(itemsTable).set(updateData).where(and(eq(itemsTable.id, Number(req.params.id)), eq(itemsTable.businessId, req.user!.businessId!))).returning();
    res.json(updated);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    await db.delete(itemsTable).where(and(eq(itemsTable.id, Number(req.params.id)), eq(itemsTable.businessId, req.user!.businessId!)));
    res.json({ success: true });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

export default router;
