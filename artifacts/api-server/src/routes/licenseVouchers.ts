import { Router } from "express";
import { db, licenseVouchersTable, plansTable, businessesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireBusiness, signToken } from "../middlewares/auth";

const router = Router();
router.use(requireBusiness);

async function ensureLicenseVouchersTable() {
  const sqlite = (await import("@workspace/db")).sqlite;
  if (!sqlite) return;
  sqlite.prepare(`
    CREATE TABLE IF NOT EXISTS license_vouchers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL UNIQUE,
      plan_id INTEGER NOT NULL,
      validity_days INTEGER NOT NULL DEFAULT 30,
      selling_price TEXT,
      status TEXT NOT NULL DEFAULT 'active',
      notes TEXT,
      generated_by INTEGER,
      redeemed_by_business_id INTEGER,
      redeemed_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `).run();
}

// Redeem a license voucher — any authenticated business user (admin role only)
router.post("/redeem-voucher", async (req, res) => {
  try {
    await ensureLicenseVouchersTable();
    const { code } = req.body;
    if (!code) { res.status(400).json({ error: "Voucher code required" }); return; }
    if (!req.user?.businessId) { res.status(403).json({ error: "Business context required" }); return; }
    if (req.user.role !== "business_admin") { res.status(403).json({ error: "Only business admin can redeem vouchers" }); return; }

    const [voucher] = await db.select().from(licenseVouchersTable)
      .where(eq(licenseVouchersTable.code, code.trim().toUpperCase())).limit(1);

    if (!voucher) { res.status(404).json({ error: "Voucher code galat hai ya exist nahi karta" }); return; }
    if (voucher.status === "used") { res.status(400).json({ error: "Yeh voucher pehle hi use ho chuka hai" }); return; }
    if (voucher.status === "cancelled") { res.status(400).json({ error: "Yeh voucher cancel ho chuka hai" }); return; }

    const [plan] = await db.select().from(plansTable).where(eq(plansTable.id, voucher.planId)).limit(1);
    if (!plan) { res.status(400).json({ error: "Is voucher ka plan nahi mila" }); return; }

    const now = new Date();
    const expiresAt = new Date(now.getTime() + voucher.validityDays * 24 * 60 * 60 * 1000);
    const nowStr = now.toISOString();
    const expiresAtStr = expiresAt.toISOString();

    await db.update(licenseVouchersTable).set({
      status: "used",
      redeemedByBusinessId: req.user.businessId,
      redeemedAt: nowStr as unknown as Date,
    }).where(eq(licenseVouchersTable.id, voucher.id));

    const [updated] = await db.update(businessesTable).set({
      planId: plan.id,
      planStartDate: nowStr as unknown as Date,
      planExpiresAt: expiresAtStr as unknown as Date,
      isTrial: false,
      status: "active",
    }).where(eq(businessesTable.id, req.user.businessId)).returning();

    // Issue fresh JWT so frontend gets updated planExpiresAt immediately
    const newToken = signToken(
      { id: req.user.id, email: req.user.email, name: req.user.name, role: req.user.role, businessId: req.user.businessId, sessionToken: req.user.sessionToken },
      expiresAt,
      false
    );

    res.json({
      success: true,
      message: `${plan.name} plan activate ho gaya! ${voucher.validityDays} din ke liye valid hai.`,
      plan: { id: plan.id, name: plan.name, validityDays: voucher.validityDays },
      expiresAt: expiresAt.toISOString(),
      business: updated,
      token: newToken,
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Offline EXE only — validate voucher via cloud, update local SQLite, return fresh token
router.post("/redeem-voucher-offline", async (req, res) => {
  try {
    await ensureLicenseVouchersTable();
    const { code } = req.body;
    if (!code) { res.status(400).json({ error: "Voucher code required" }); return; }
    if (req.user?.role !== "business_admin") { res.status(403).json({ error: "Only business admin can activate plan" }); return; }

    const [biz] = await db.select().from(businessesTable).where(eq(businessesTable.id, req.user.businessId!)).limit(1);
    if (!biz) { res.status(404).json({ error: "Business not found" }); return; }

    const cloudUrl = process.env.CLOUD_API_URL || "https://erp.naewtgroup.com";

    // Call cloud public endpoint to validate + consume voucher
    let cloudData: any;
    try {
      const cloudRes = await fetch(`${cloudUrl}/api/activate-offline`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ voucherCode: code.trim().toUpperCase(), businessCode: biz.businessCode }),
      });
      cloudData = await cloudRes.json();
      if (!cloudRes.ok) { res.status(cloudRes.status).json(cloudData); return; }
    } catch {
      res.status(503).json({ error: "Cloud se connect nahi ho saka. Internet check karo aur dobara try karo." });
      return;
    }

    const expiresAt = new Date(cloudData.expiresAt);

    // Upsert plan in local plans table so auth middleware can read maxUsers etc.
    const sqlite = (await import("@workspace/db")).sqlite;
    if (sqlite) {
      sqlite.prepare(`
        INSERT OR REPLACE INTO plans (id, name, price, billing_cycle, max_users, validity_days, trial_days, features, is_active, sort_order, created_at)
        VALUES (?, ?, '0', 'yearly', ?, ?, 0, '[]', 1, 0, datetime('now'))
      `).run(cloudData.planId, cloudData.planName, cloudData.maxUsers, cloudData.validityDays);
    }

    // Update local business record
    await db.update(businessesTable).set({
      planId: cloudData.planId,
      planExpiresAt: expiresAt as unknown as Date,
      isTrial: false,
      status: "active",
    }).where(eq(businessesTable.id, req.user.businessId!));

    // Issue fresh JWT so frontend gets updated planExpiresAt immediately
    const newToken = signToken(
      { id: req.user.id, email: req.user.email, name: req.user.name, role: req.user.role, businessId: req.user.businessId, sessionToken: req.user.sessionToken },
      expiresAt,
      false
    );

    res.json({
      success: true,
      message: `${cloudData.planName} plan activate ho gaya! ${cloudData.validityDays} din ke liye valid hai.`,
      expiresAt: cloudData.expiresAt,
      planName: cloudData.planName,
      maxUsers: cloudData.maxUsers,
      token: newToken,
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

export default router;
