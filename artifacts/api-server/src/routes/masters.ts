import { Router } from "express";
import { db } from "@workspace/db";
import { unitsTable, hsnCodesTable, taxRatesTable, customFieldsTable } from "@workspace/db";
import { eq, and, ilike } from "drizzle-orm";
import { requireBusiness } from "../middlewares/auth";

const router = Router();
router.use(requireBusiness);

// UNITS
router.get("/units", async (req, res) => {
  try {
    const units = await db.select().from(unitsTable).where(eq(unitsTable.businessId, req.user!.businessId!)).orderBy(unitsTable.name);
    res.json({ data: units });
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal Server Error" }); }
});

router.post("/units", async (req, res) => {
  try {
    const { name, symbol } = req.body;
    const [unit] = await db.insert(unitsTable).values({ businessId: req.user!.businessId!, name, symbol }).returning();
    res.status(201).json(unit);
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal Server Error" }); }
});

router.delete("/units/:id", async (req, res) => {
  try {
    await db.delete(unitsTable).where(and(eq(unitsTable.id, Number(req.params.id)), eq(unitsTable.businessId, req.user!.businessId!)));
    res.json({ success: true });
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal Server Error" }); }
});

// HSN CODES
router.get("/hsn", async (req, res) => {
  try {
    const { search } = req.query;
    let query = db.select().from(hsnCodesTable).where(eq(hsnCodesTable.businessId, req.user!.businessId!));
    const codes = await db.select().from(hsnCodesTable).where(and(
      eq(hsnCodesTable.businessId, req.user!.businessId!),
      search ? ilike(hsnCodesTable.code, `%${search}%`) : undefined,
    )).orderBy(hsnCodesTable.code);
    res.json({ data: codes });
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal Server Error" }); }
});

router.post("/hsn", async (req, res) => {
  try {
    const { code, description, taxRate } = req.body;
    const [hsn] = await db.insert(hsnCodesTable).values({ businessId: req.user!.businessId!, code, description, taxRate: taxRate ? String(taxRate) : null }).returning();
    res.status(201).json(hsn);
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal Server Error" }); }
});

// TAX RATES
router.get("/tax-rates", async (req, res) => {
  try {
    const rates = await db.select().from(taxRatesTable).where(eq(taxRatesTable.businessId, req.user!.businessId!)).orderBy(taxRatesTable.rate);
    const data = rates.map(r => ({
      ...r, rate: Number(r.rate),
      cgst: Number(r.rate) / 2, sgst: Number(r.rate) / 2, igst: Number(r.rate),
    }));
    res.json({ data });
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal Server Error" }); }
});

router.post("/tax-rates", async (req, res) => {
  try {
    const { name, rate } = req.body;
    const [taxRate] = await db.insert(taxRatesTable).values({ businessId: req.user!.businessId!, name, rate: String(rate) }).returning();
    res.status(201).json({ ...taxRate, rate: Number(taxRate.rate), cgst: Number(taxRate.rate)/2, sgst: Number(taxRate.rate)/2, igst: Number(taxRate.rate) });
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal Server Error" }); }
});

// CUSTOM FIELDS
router.get("/custom-fields", async (req, res) => {
  try {
    const { entity } = req.query;
    const conditions = [eq(customFieldsTable.businessId, req.user!.businessId!)];
    if (entity) conditions.push(eq(customFieldsTable.entity, entity as "item" | "party" | "voucher" | "voucher_item"));
    const fields = await db.select().from(customFieldsTable).where(and(...conditions)).orderBy(customFieldsTable.sortOrder);
    res.json({ data: fields });
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal Server Error" }); }
});

router.post("/custom-fields", async (req, res) => {
  try {
    const { entity, fieldName, fieldLabel, fieldType, options, isRequired, sortOrder } = req.body;
    const [field] = await db.insert(customFieldsTable).values({
      businessId: req.user!.businessId!, entity, fieldName, fieldLabel,
      fieldType: fieldType || "text", options, isRequired: isRequired || false, sortOrder: sortOrder || 0,
    }).returning();
    res.status(201).json(field);
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal Server Error" }); }
});

router.delete("/custom-fields/:id", async (req, res) => {
  try {
    await db.delete(customFieldsTable).where(and(eq(customFieldsTable.id, Number(req.params.id)), eq(customFieldsTable.businessId, req.user!.businessId!)));
    res.json({ success: true });
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal Server Error" }); }
});

export default router;
