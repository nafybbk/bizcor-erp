import { Router } from "express";
import { db } from "@workspace/db";
import { itemsTable, voucherItemsTable, vouchersTable, partiesTable, unitsTable } from "@workspace/db";
import { eq, and, sql, ilike, gte, lte, isNull } from "drizzle-orm";
import { requireBusiness } from "../middlewares/auth";

const router = Router();
router.use(requireBusiness);

router.get("/stock", async (req, res) => {
  try {
    const { search, page = "1", limit = "50" } = req.query;
    const businessId = req.user!.businessId!;
    const conditions: any[] = [eq(itemsTable.businessId, businessId), eq(itemsTable.type, "goods")];
    if (search) conditions.push(ilike(itemsTable.name, `%${search}%`));
    const items = await db.select({
      itemId: itemsTable.id, itemName: itemsTable.name, hsnCode: itemsTable.hsnCode,
      openingStock: itemsTable.openingStock, purchasePrice: itemsTable.purchasePrice,
      unitSymbol: unitsTable.symbol,
    }).from(itemsTable).leftJoin(unitsTable, eq(itemsTable.unitId, unitsTable.id)).where(and(...conditions)).limit(Number(limit)).offset((Number(page) - 1) * Number(limit)).orderBy(itemsTable.name);
    const [{ total }] = await db.select({ total: sql<number>`count(*)` }).from(itemsTable).where(and(...conditions));
    const stockMovements = await db.select({
      itemId: voucherItemsTable.itemId,
      voucherType: vouchersTable.voucherType,
      qty: sql<number>`sum(${voucherItemsTable.quantity})`,
      avgRate: sql<number>`avg(${voucherItemsTable.rate})`,
    }).from(voucherItemsTable).innerJoin(vouchersTable, eq(voucherItemsTable.voucherId, vouchersTable.id))
      .where(and(eq(vouchersTable.businessId, businessId), isNull(vouchersTable.deletedAt))).groupBy(voucherItemsTable.itemId, vouchersTable.voucherType);
    const stockMap = new Map<number, { in: number; out: number; avgRate: number }>();
    for (const s of stockMovements) {
      if (!s.itemId) continue;
      const curr = stockMap.get(s.itemId) || { in: 0, out: 0, avgRate: 0 };
      if (s.voucherType === "purchase_bill") { curr.in += Number(s.qty); curr.avgRate = Number(s.avgRate); }
      else if (s.voucherType === "sales_invoice") curr.out += Number(s.qty);
      else if (s.voucherType === "debit_note") curr.out += Number(s.qty);
      else if (s.voucherType === "credit_note") curr.in += Number(s.qty);
      stockMap.set(s.itemId, curr);
    }
    const data = items.map(i => {
      const mov = stockMap.get(i.itemId) || { in: 0, out: 0, avgRate: 0 };
      const opening = Number(i.openingStock || 0);
      const currentStock = opening + mov.in - mov.out;
      const avgRate = mov.avgRate || Number(i.purchasePrice || 0);
      return { itemId: i.itemId, itemName: i.itemName, hsnCode: i.hsnCode, unit: i.unitSymbol, openingStock: opening, inQuantity: mov.in, outQuantity: mov.out, currentStock, avgRate, stockValue: currentStock * avgRate };
    });
    const totalValue = data.reduce((s, i) => s + i.stockValue, 0);
    res.json({ data, total: Number(total), totalValue });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.get("/stock/:itemId", async (req, res) => {
  try {
    const businessId = req.user!.businessId!;
    const itemId = Number(req.params.itemId);
    const { fromDate, toDate } = req.query;
    const item = await db.query.itemsTable.findFirst({ where: and(eq(itemsTable.id, itemId), eq(itemsTable.businessId, businessId)) });
    if (!item) { res.status(404).json({ error: "Not Found" }); return; }
    const conditions: any[] = [eq(voucherItemsTable.itemId, itemId), eq(vouchersTable.businessId, businessId), isNull(vouchersTable.deletedAt)];
    if (fromDate) conditions.push(gte(vouchersTable.date, String(fromDate)));
    if (toDate) conditions.push(lte(vouchersTable.date, String(toDate)));
    const movements = await db.select({
      date: vouchersTable.date, voucherType: vouchersTable.voucherType, voucherNumber: vouchersTable.voucherNumber,
      partyName: partiesTable.name, quantity: voucherItemsTable.quantity, rate: voucherItemsTable.rate,
    }).from(voucherItemsTable).innerJoin(vouchersTable, eq(voucherItemsTable.voucherId, vouchersTable.id))
      .leftJoin(partiesTable, eq(vouchersTable.partyId, partiesTable.id)).where(and(...conditions)).orderBy(vouchersTable.date);
    const openingStock = Number(item.openingStock || 0);
    let balance = openingStock;
    const entries = movements.map(m => {
      const qty = Number(m.quantity);
      let inQty = 0, outQty = 0;
      if (m.voucherType === "purchase_bill" || m.voucherType === "credit_note") { inQty = qty; balance += qty; }
      else { outQty = qty; balance -= qty; }
      return { date: m.date, voucherType: m.voucherType, voucherNumber: m.voucherNumber, partyName: m.partyName, inQuantity: inQty, outQuantity: outQty, balance, rate: Number(m.rate) };
    });
    res.json({ item, openingStock, closingStock: balance, entries });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

export default router;
