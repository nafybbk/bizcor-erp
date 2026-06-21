import { Router } from "express";
import { db, sqlite } from "@workspace/db";
import { itemsTable, unitsTable, taxRatesTable, voucherItemsTable, vouchersTable } from "@workspace/db";
import { eq, and, like, sql, desc } from "drizzle-orm";
import { requireBusiness } from "../middlewares/auth";

const router = Router();
router.use(requireBusiness);

router.get("/", async (req, res) => {
  try {
    const { search, page = "1", limit = "10000", type } = req.query;
    const businessId = req.user!.businessId!;
    const conditions: ReturnType<typeof eq>[] = [eq(itemsTable.businessId, businessId)];
    if (search) conditions.push(like(itemsTable.name, `%${search}%`));
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

    if (!name?.trim()) {
      res.status(400).json({ error: "Bad Request", message: "Item name required" });
      return;
    }

    const isSQLite = !!process.env.SQLITE_PATH;

    if (isSQLite && sqlite) {
      // SQLite: use better-sqlite3 directly — avoids .returning() RETURNING clause issues
      // (RETURNING requires SQLite 3.35+; bundled version may differ)
      const stmt = sqlite.prepare(`
        INSERT INTO items (business_id, name, description, type, hsn_code, unit_id, tax_rate_id,
          sale_price, purchase_price, opening_stock, low_stock_alert, custom_fields)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      const result = stmt.run(
        businessId,
        name.trim(),
        description || null,
        type || "goods",
        hsnCode || null,
        unitId || null,
        taxRateId || null,
        salePrice ? String(salePrice) : "0",
        purchasePrice ? String(purchasePrice) : "0",
        openingStock ? String(openingStock) : "0",
        lowStockAlert ? String(lowStockAlert) : "0",
        customFields ? JSON.stringify(customFields) : null,
      );
      const newId = result.lastInsertRowid;
      const item = sqlite.prepare("SELECT * FROM items WHERE id = ?").get(newId);
      res.status(201).json(item);
    } else {
      // PostgreSQL: use Drizzle with .returning()
      const [item] = await db.insert(itemsTable).values({
        businessId, name: name.trim(), description, type: type || "goods", hsnCode, unitId, taxRateId,
        salePrice: salePrice ? String(salePrice) : "0",
        purchasePrice: purchasePrice ? String(purchasePrice) : "0",
        openingStock: openingStock ? String(openingStock) : "0",
        lowStockAlert: lowStockAlert ? String(lowStockAlert) : "0",
        customFields,
      }).returning();
      res.status(201).json(item);
    }
  } catch (err: any) {
    req.log.error(err);
    if (err?.message?.includes("UNIQUE") || err?.code === "23505") {
      res.status(409).json({ error: "Conflict", message: "Is naam ka item pehle se hai" });
      return;
    }
    res.status(500).json({ error: "Internal Server Error", message: err?.message });
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
    const businessId = req.user!.businessId!;
    const id = Number(req.params.id);
    const allowed = ["name","description","type","hsnCode","unitId","taxRateId","salePrice","purchasePrice","openingStock","lowStockAlert","isActive","customFields"];
    const updateData: Record<string, unknown> = {};
    for (const key of allowed) if (req.body[key] !== undefined) updateData[key] = req.body[key];
    if (updateData.salePrice) updateData.salePrice = String(updateData.salePrice);
    if (updateData.purchasePrice) updateData.purchasePrice = String(updateData.purchasePrice);

    const isSQLite = !!process.env.SQLITE_PATH;

    if (isSQLite && sqlite) {
      // SQLite: build UPDATE manually
      const setClauses: string[] = [];
      const vals: any[] = [];
      const colMap: Record<string, string> = {
        name: "name", description: "description", type: "type", hsnCode: "hsn_code",
        unitId: "unit_id", taxRateId: "tax_rate_id", salePrice: "sale_price",
        purchasePrice: "purchase_price", openingStock: "opening_stock",
        lowStockAlert: "low_stock_alert", isActive: "is_active", customFields: "custom_fields",
      };
      for (const [key, val] of Object.entries(updateData)) {
        const col = colMap[key];
        if (!col) continue;
        setClauses.push(`${col} = ?`);
        vals.push(key === "customFields" && val && typeof val === "object" ? JSON.stringify(val) : val);
      }
      if (setClauses.length > 0) {
        vals.push(id, businessId);
        sqlite.prepare(`UPDATE items SET ${setClauses.join(", ")} WHERE id = ? AND business_id = ?`).run(...vals);
      }
      const item = sqlite.prepare("SELECT * FROM items WHERE id = ? AND business_id = ?").get(id, businessId);
      res.json(item);
    } else {
      const [updated] = await db.update(itemsTable).set(updateData)
        .where(and(eq(itemsTable.id, id), eq(itemsTable.businessId, businessId))).returning();
      res.json(updated);
    }
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
