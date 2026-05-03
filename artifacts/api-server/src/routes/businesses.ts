import { Router } from "express";
import bcrypt from "bcryptjs";
import { db } from "@workspace/db";
import { businessesTable, usersTable, unitsTable, taxRatesTable, partiesTable, itemsTable, vouchersTable, paymentsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth, requireBusiness, signToken } from "../middlewares/auth";
const router = Router();

function generateBusinessCode(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

router.post("/register", async (req, res) => {
  try {
    const { businessName, gstin, pan, address, city, state, stateCode, pincode, phone, businessType, adminName, adminEmail, adminPassword, planId } = req.body;
    if (!businessName || !adminName || !adminEmail || !adminPassword) {
      res.status(400).json({ error: "Bad Request", message: "Required fields missing" });
      return;
    }
    let businessCode = generateBusinessCode();
    const existing = await db.query.businessesTable.findFirst({ where: eq(businessesTable.businessCode, businessCode) });
    if (existing) businessCode = generateBusinessCode();

    const now = new Date();
    const trialExpiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const [business] = await db.insert(businessesTable).values({
      name: businessName, businessCode, gstin, pan, address, city, state, stateCode, pincode, phone, businessType,
      planId: planId || null, status: "trial",
      isTrial: true, planStartDate: now, planExpiresAt: trialExpiresAt,
    }).returning();

    const passwordHash = await bcrypt.hash(adminPassword, 10);
    const [user] = await db.insert(usersTable).values({
      businessId: business.id, name: adminName, email: adminEmail, passwordHash, role: "business_admin", permissions: [],
    }).returning();

    await db.insert(unitsTable).values([
      { businessId: business.id, name: "Piece", symbol: "PCS" },
      { businessId: business.id, name: "Kilogram", symbol: "KG" },
      { businessId: business.id, name: "Litre", symbol: "LTR" },
      { businessId: business.id, name: "Box", symbol: "BOX" },
      { businessId: business.id, name: "Meter", symbol: "MTR" },
      { businessId: business.id, name: "Number", symbol: "NOS" },
    ]);

    await db.insert(taxRatesTable).values([
      { businessId: business.id, name: "GST 0%", rate: "0" },
      { businessId: business.id, name: "GST 5%", rate: "5" },
      { businessId: business.id, name: "GST 12%", rate: "12" },
      { businessId: business.id, name: "GST 18%", rate: "18" },
      { businessId: business.id, name: "GST 28%", rate: "28" },
    ]);

    const token = signToken({ id: user.id, email: user.email, name: user.name, role: "business_admin", businessId: business.id });
    res.status(201).json({
      token,
      user: { id: user.id, email: user.email, name: user.name, role: "business_admin", businessId: business.id },
      business: { id: business.id, name: business.name, businessCode: business.businessCode },
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.get("/current", requireBusiness, async (req, res) => {
  try {
    const business = await db.query.businessesTable.findFirst({ where: eq(businessesTable.id, req.user!.businessId!) });
    if (!business) { res.status(404).json({ error: "Not Found" }); return; }
    res.json(business);
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal Server Error" }); }
});

router.patch("/current", requireBusiness, async (req, res) => {
  try {
    const allowed = ["name", "gstin", "pan", "address", "city", "state", "stateCode", "pincode", "phone", "email", "logo", "financialYearStart", "invoicePrefix", "creditNotePrefix", "billPrefix", "debitNotePrefix", "serialNumberMode", "numberSeries", "numberDigits", "numberSeparator", "businessType", "bankName", "bankAccount", "bankIfsc", "bankBranch", "signatoryName", "invoiceFooter"];
    const updateData: Record<string, unknown> = {};
    for (const key of allowed) if (req.body[key] !== undefined) updateData[key] = req.body[key];
    const [updated] = await db.update(businessesTable).set(updateData).where(eq(businessesTable.id, req.user!.businessId!)).returning();
    res.json(updated);
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal Server Error" }); }
});

router.get("/backup", requireBusiness, async (req, res) => {
  try {
    const businessId = req.user!.businessId!;
    const business = await db.query.businessesTable.findFirst({ where: eq(businessesTable.id, businessId) });
    const users = await db.select().from(usersTable).where(eq(usersTable.businessId, businessId));
    const parties = await db.select().from(partiesTable).where(eq(partiesTable.businessId, businessId));
    const items = await db.select().from(itemsTable).where(eq(itemsTable.businessId, businessId));
    const vouchers = await db.select().from(vouchersTable).where(eq(vouchersTable.businessId, businessId));
    const payments = await db.select().from(paymentsTable).where(eq(paymentsTable.businessId, businessId));

    const filename = `backup-${business?.businessCode || businessId}-${Date.now()}.json`;
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.json({
      exportedAt: new Date().toISOString(),
      version: "1.0",
      business,
      users: users.map(u => ({ ...u, passwordHash: undefined })),
      parties, items, vouchers, payments,
    });
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal Server Error" }); }
});

export default router;
