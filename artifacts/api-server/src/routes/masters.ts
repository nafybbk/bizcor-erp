import { Router } from "express";
import { db, pool, sqlite } from "@workspace/db";
import { unitsTable, hsnCodesTable, hsnDirectoryTable, taxRatesTable, customFieldsTable, statesTable } from "@workspace/db";
import { eq, and, inArray } from "drizzle-orm";
import { ilike } from "../lib/search";
import { requireBusiness } from "../middlewares/auth";

let statesMigrated = false;
async function ensureStatesTable() {
  if (statesMigrated) return;
  statesMigrated = true;
  try {
    if (pool) {
      await (pool as any).query(`
        CREATE TABLE IF NOT EXISTS states (
          id SERIAL PRIMARY KEY,
          business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
          state_name TEXT NOT NULL,
          state_code TEXT NOT NULL,
          state_abbr TEXT,
          sort_order INTEGER NOT NULL DEFAULT 0,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `);
    } else if (sqlite) {
      (sqlite as any).exec(`
        CREATE TABLE IF NOT EXISTS states (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          business_id INTEGER NOT NULL,
          state_name TEXT NOT NULL,
          state_code TEXT NOT NULL,
          state_abbr TEXT,
          sort_order INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL DEFAULT (datetime('now'))
        )
      `);
    }
  } catch { /* table already exists */ }
}

const INDIAN_STATES = [
  { stateCode: "01", stateName: "Jammu & Kashmir", stateAbbr: "JK" },
  { stateCode: "02", stateName: "Himachal Pradesh", stateAbbr: "HP" },
  { stateCode: "03", stateName: "Punjab", stateAbbr: "PB" },
  { stateCode: "04", stateName: "Chandigarh", stateAbbr: "CH" },
  { stateCode: "05", stateName: "Uttarakhand", stateAbbr: "UK" },
  { stateCode: "06", stateName: "Haryana", stateAbbr: "HR" },
  { stateCode: "07", stateName: "Delhi", stateAbbr: "DL" },
  { stateCode: "08", stateName: "Rajasthan", stateAbbr: "RJ" },
  { stateCode: "09", stateName: "Uttar Pradesh", stateAbbr: "UP" },
  { stateCode: "10", stateName: "Bihar", stateAbbr: "BR" },
  { stateCode: "11", stateName: "Sikkim", stateAbbr: "SK" },
  { stateCode: "12", stateName: "Arunachal Pradesh", stateAbbr: "AR" },
  { stateCode: "13", stateName: "Nagaland", stateAbbr: "NL" },
  { stateCode: "14", stateName: "Manipur", stateAbbr: "MN" },
  { stateCode: "15", stateName: "Mizoram", stateAbbr: "MZ" },
  { stateCode: "16", stateName: "Tripura", stateAbbr: "TR" },
  { stateCode: "17", stateName: "Meghalaya", stateAbbr: "ML" },
  { stateCode: "18", stateName: "Assam", stateAbbr: "AS" },
  { stateCode: "19", stateName: "West Bengal", stateAbbr: "WB" },
  { stateCode: "20", stateName: "Jharkhand", stateAbbr: "JH" },
  { stateCode: "21", stateName: "Odisha", stateAbbr: "OD" },
  { stateCode: "22", stateName: "Chhattisgarh", stateAbbr: "CG" },
  { stateCode: "23", stateName: "Madhya Pradesh", stateAbbr: "MP" },
  { stateCode: "24", stateName: "Gujarat", stateAbbr: "GJ" },
  { stateCode: "25", stateName: "Daman & Diu", stateAbbr: "DD" },
  { stateCode: "26", stateName: "Dadra & Nagar Haveli", stateAbbr: "DN" },
  { stateCode: "27", stateName: "Maharashtra", stateAbbr: "MH" },
  { stateCode: "29", stateName: "Karnataka", stateAbbr: "KA" },
  { stateCode: "30", stateName: "Goa", stateAbbr: "GA" },
  { stateCode: "31", stateName: "Lakshadweep", stateAbbr: "LD" },
  { stateCode: "32", stateName: "Kerala", stateAbbr: "KL" },
  { stateCode: "33", stateName: "Tamil Nadu", stateAbbr: "TN" },
  { stateCode: "34", stateName: "Puducherry", stateAbbr: "PY" },
  { stateCode: "35", stateName: "Andaman & Nicobar Islands", stateAbbr: "AN" },
  { stateCode: "36", stateName: "Telangana", stateAbbr: "TS" },
  { stateCode: "37", stateName: "Andhra Pradesh", stateAbbr: "AP" },
  { stateCode: "38", stateName: "Ladakh", stateAbbr: "LA" },
];

const router = Router();
router.use(requireBusiness);

// STATES
router.get("/states", async (req, res) => {
  try {
    await ensureStatesTable();
    const data = await db.select().from(statesTable).where(eq(statesTable.businessId, req.user!.businessId!)).orderBy(statesTable.sortOrder, statesTable.stateCode);
    res.json({ data });
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal Server Error" }); }
});

router.post("/states/seed-india", async (req, res) => {
  try {
    await ensureStatesTable();
    const businessId = req.user!.businessId!;
    const existing = await db.select({ id: statesTable.id }).from(statesTable).where(eq(statesTable.businessId, businessId));
    if (existing.length > 0) {
      await db.delete(statesTable).where(eq(statesTable.businessId, businessId));
    }
    await db.insert(statesTable).values(INDIAN_STATES.map((s, idx) => ({ ...s, businessId, sortOrder: idx })));
    res.json({ success: true, count: INDIAN_STATES.length });
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal Server Error" }); }
});

router.post("/states", async (req, res) => {
  try {
    await ensureStatesTable();
    const { stateName, stateCode, stateAbbr } = req.body;
    const existing = await db.select({ id: statesTable.id }).from(statesTable).where(eq(statesTable.businessId, req.user!.businessId!));
    const [state] = await db.insert(statesTable).values({ businessId: req.user!.businessId!, stateName, stateCode, stateAbbr: stateAbbr || null, sortOrder: existing.length }).returning();
    res.status(201).json(state);
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal Server Error" }); }
});

router.patch("/states/:id", async (req, res) => {
  try {
    const { stateName, stateCode, stateAbbr } = req.body;
    const updateData: Record<string, unknown> = {};
    if (stateName !== undefined) updateData.stateName = stateName;
    if (stateCode !== undefined) updateData.stateCode = stateCode;
    if (stateAbbr !== undefined) updateData.stateAbbr = stateAbbr;
    const [updated] = await db.update(statesTable).set(updateData).where(and(eq(statesTable.id, Number(req.params.id)), eq(statesTable.businessId, req.user!.businessId!))).returning();
    res.json(updated);
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal Server Error" }); }
});

router.delete("/states/:id", async (req, res) => {
  try {
    await db.delete(statesTable).where(and(eq(statesTable.id, Number(req.params.id)), eq(statesTable.businessId, req.user!.businessId!)));
    res.json({ success: true });
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal Server Error" }); }
});

// UNITS
router.get("/units", async (req, res) => {
  try {
    const units = await db.select().from(unitsTable).where(eq(unitsTable.businessId, req.user!.businessId!)).orderBy(unitsTable.sortOrder, unitsTable.id);
    res.json({ data: units });
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal Server Error" }); }
});

router.post("/units", async (req, res) => {
  try {
    const { name, symbol } = req.body;
    const existing = await db.select({ id: unitsTable.id }).from(unitsTable).where(eq(unitsTable.businessId, req.user!.businessId!));
    const sortOrder = existing.length;
    const [unit] = await db.insert(unitsTable).values({ businessId: req.user!.businessId!, name, symbol, sortOrder }).returning();
    res.status(201).json(unit);
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal Server Error" }); }
});

router.patch("/units/reorder", async (req, res) => {
  try {
    const { order } = req.body as { order: number[] };
    await Promise.all(order.map((id, idx) =>
      db.update(unitsTable).set({ sortOrder: idx }).where(and(eq(unitsTable.id, id), eq(unitsTable.businessId, req.user!.businessId!)))
    ));
    res.json({ success: true });
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal Server Error" }); }
});

router.patch("/units/:id", async (req, res) => {
  try {
    const { name, symbol } = req.body;
    const updateData: Record<string, unknown> = {};
    if (name !== undefined) updateData.name = name;
    if (symbol !== undefined) updateData.symbol = symbol;
    const [updated] = await db.update(unitsTable).set(updateData).where(and(eq(unitsTable.id, Number(req.params.id)), eq(unitsTable.businessId, req.user!.businessId!))).returning();
    res.json(updated);
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
    const codes = await db.select().from(hsnCodesTable).where(and(
      eq(hsnCodesTable.businessId, req.user!.businessId!),
      search ? ilike(hsnCodesTable.code, String(search)) : undefined,
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

router.patch("/hsn/:id", async (req, res) => {
  try {
    const { code, description, taxRate } = req.body;
    const updateData: Record<string, unknown> = {};
    if (code !== undefined) updateData.code = code;
    if (description !== undefined) updateData.description = description;
    if (taxRate !== undefined) updateData.taxRate = taxRate ? String(taxRate) : null;
    const [updated] = await db.update(hsnCodesTable).set(updateData).where(and(eq(hsnCodesTable.id, Number(req.params.id)), eq(hsnCodesTable.businessId, req.user!.businessId!))).returning();
    res.json(updated);
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal Server Error" }); }
});

router.delete("/hsn/:id", async (req, res) => {
  try {
    await db.delete(hsnCodesTable).where(and(eq(hsnCodesTable.id, Number(req.params.id)), eq(hsnCodesTable.businessId, req.user!.businessId!)));
    res.json({ success: true });
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal Server Error" }); }
});

// HSN BULK IMPORT
router.post("/hsn/import", async (req, res) => {
  try {
    const businessId = req.user!.businessId!;
    const { rows, mode = "skip" } = req.body as {
      rows: { code: string; description?: string; taxRate?: string | null }[];
      mode?: "skip" | "overwrite";
    };
    if (!Array.isArray(rows) || rows.length === 0) {
      res.status(400).json({ error: "Rows array required" }); return;
    }

    // Get existing codes for this business
    const existing = await db.select({ id: hsnCodesTable.id, code: hsnCodesTable.code })
      .from(hsnCodesTable).where(eq(hsnCodesTable.businessId, businessId));
    const existingMap = new Map(existing.map(e => [e.code.trim(), e.id]));

    // The GST portal's full HSN directory runs to thousands of rows — per-row
    // queries blew the 30s serverless limit, so everything is bulk now:
    // dedupe, one chunked delete for overwrites, chunked multi-row inserts.
    const incoming = new Map<string, { description: string | null; taxRate: string | null }>();
    for (const row of rows) {
      const code = String(row.code).trim();
      if (!code) continue;
      incoming.set(code, {
        description: row.description?.trim() || null,
        taxRate: row.taxRate != null && String(row.taxRate).trim() !== ""
          ? String(parseFloat(String(row.taxRate))) : null,
      });
    }

    let inserted = 0, updated = 0, skipped = 0;
    const toInsert: { businessId: number; code: string; description: string | null; taxRate: string | null }[] = [];
    const toOverwrite: string[] = [];

    for (const [code, data] of incoming) {
      if (existingMap.has(code)) {
        if (mode === "overwrite") {
          toOverwrite.push(code);
          toInsert.push({ businessId, code, ...data });
          updated++;
        } else {
          skipped++;
        }
      } else {
        toInsert.push({ businessId, code, ...data });
        inserted++;
      }
    }

    // SQLite (EXE) allows only 999 bound values per statement — keep row
    // chunks small enough that rows × columns stays under it
    const CHUNK = sqlite ? 150 : 500;
    for (let i = 0; i < toOverwrite.length; i += CHUNK) {
      await db.delete(hsnCodesTable).where(and(
        eq(hsnCodesTable.businessId, businessId),
        inArray(hsnCodesTable.code, toOverwrite.slice(i, i + CHUNK))
      ));
    }
    for (let i = 0; i < toInsert.length; i += CHUNK) {
      await db.insert(hsnCodesTable).values(toInsert.slice(i, i + CHUNK));
    }

    res.json({ success: true, inserted, updated, skipped, total: rows.length });
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal Server Error" }); }
});

// GET /masters/hsn/directory — the global (government) HSN list, read-only.
// Shown merged into the HSN master screen so users can SEE which official
// description their GSTR-1 will carry; a business's own hsn_codes row with
// the same code overrides it.
router.get("/hsn/directory", async (req, res) => {
  try {
    if (sqlite) {
      const rows = sqlite.prepare("SELECT code, description, tax_rate AS taxRate FROM hsn_directory").all();
      res.json({ data: rows });
      return;
    }
    const rows = await db.select({
      code: hsnDirectoryTable.code,
      description: hsnDirectoryTable.description,
      taxRate: hsnDirectoryTable.taxRate,
    }).from(hsnDirectoryTable);
    res.json({ data: rows });
  } catch {
    res.json({ data: [] }); // directory table missing (older EXE DB)
  }
});

// POST /masters/hsn/sync-directory — EXE-only: refresh the local copy of the
// global HSN directory from the cloud. One button press = whole government
// list, so a directory update on the cloud reaches every offline install.
router.post("/hsn/sync-directory", async (req, res) => {
  try {
    if (!process.env.SQLITE_PATH) {
      res.status(400).json({ error: "Cloud version directory ko seedha use karta hai — sync sirf desktop EXE ke liye hai" });
      return;
    }
    const cloudUrl = process.env.CLOUD_API_URL || "https://erp.naewtgroup.com";
    const resp = await fetch(`${cloudUrl}/api/hsn-directory`);
    if (!resp.ok) { res.status(502).json({ error: "Cloud se HSN directory nahi mili. Internet check karein." }); return; }
    const rows = await resp.json() as { code: string; description?: string | null; taxRate?: string | null }[];
    if (!Array.isArray(rows) || rows.length === 0) {
      res.status(502).json({ error: "Cloud par HSN directory abhi khali hai — pehle tech panel se import karein" });
      return;
    }

    // Raw better-sqlite3: one transaction, one row per statement — no
    // dialect quirks ("incomplete input") and 22k rows land in <1s
    if (!sqlite) { res.status(400).json({ error: "Desktop mode nahi hai" }); return; }
    sqlite.exec(`CREATE TABLE IF NOT EXISTS hsn_directory (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL UNIQUE,
      description TEXT,
      tax_rate TEXT,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`);
    const stmt = sqlite.prepare("INSERT OR REPLACE INTO hsn_directory (code, description, tax_rate) VALUES (?, ?, ?)");
    const importAll = sqlite.transaction((all: { code: string; description?: string | null; taxRate?: string | null }[]) => {
      sqlite!.exec("DELETE FROM hsn_directory");
      for (const r of all) {
        const code = String(r.code || "").trim();
        if (code) stmt.run(code, r.description || null, r.taxRate != null ? String(r.taxRate) : null);
      }
    });
    importAll(rows);
    res.json({ success: true, count: rows.length });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal Server Error", message: err instanceof Error ? err.message : "Sync fail hua" });
  }
});

// TAX RATES
router.patch("/tax-rates/reorder", async (req, res) => {
  try {
    const { order } = req.body as { order: number[] };
    await Promise.all(order.map((id, idx) =>
      db.update(taxRatesTable).set({ sortOrder: idx }).where(and(eq(taxRatesTable.id, id), eq(taxRatesTable.businessId, req.user!.businessId!)))
    ));
    res.json({ success: true });
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal Server Error" }); }
});

router.get("/tax-rates", async (req, res) => {
  try {
    const rates = await db.select().from(taxRatesTable).where(eq(taxRatesTable.businessId, req.user!.businessId!)).orderBy(taxRatesTable.sortOrder, taxRatesTable.id);
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

router.patch("/tax-rates/:id", async (req, res) => {
  try {
    const { name, rate } = req.body;
    const updateData: Record<string, unknown> = {};
    if (name !== undefined) updateData.name = name;
    if (rate !== undefined) updateData.rate = String(rate);
    const [updated] = await db.update(taxRatesTable).set(updateData).where(and(eq(taxRatesTable.id, Number(req.params.id)), eq(taxRatesTable.businessId, req.user!.businessId!))).returning();
    res.json({ ...updated, rate: Number(updated.rate), cgst: Number(updated.rate)/2, sgst: Number(updated.rate)/2, igst: Number(updated.rate) });
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal Server Error" }); }
});

router.delete("/tax-rates/:id", async (req, res) => {
  try {
    await db.delete(taxRatesTable).where(and(eq(taxRatesTable.id, Number(req.params.id)), eq(taxRatesTable.businessId, req.user!.businessId!)));
    res.json({ success: true });
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal Server Error" }); }
});

// CUSTOM FIELDS
router.get("/custom-fields", async (req, res) => {
  try {
    const { entity } = req.query;
    const conditions = [eq(customFieldsTable.businessId, req.user!.businessId!)];
    if (entity) conditions.push(eq(customFieldsTable.entity, entity as any));
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
