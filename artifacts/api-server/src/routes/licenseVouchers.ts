import { Router } from "express";
import { db, licenseVouchersTable, plansTable, businessesTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { requireBusiness, signToken } from "../middlewares/auth";

const router = Router();
router.use(requireBusiness);

// ─── Cloud: Redeem voucher directly against PostgreSQL ───────────────────────
router.post("/redeem-voucher", async (req, res) => {
  try {
    const { code } = req.body;
    if (!code) {
      res.status(400).json({ error: "Voucher code daalna zaroori hai" });
      return;
    }
    if (!req.user?.businessId) {
      res.status(403).json({ error: "Business login required" });
      return;
    }
    if (req.user.role !== "business_admin") {
      res.status(403).json({ error: "Sirf Business Admin voucher redeem kar sakta hai" });
      return;
    }

    const normalizedCode = code.trim().toUpperCase();

    const [voucher] = await db
      .select()
      .from(licenseVouchersTable)
      .where(eq(licenseVouchersTable.code, normalizedCode))
      .limit(1);

    if (!voucher) {
      res.status(404).json({ error: "Voucher code galat hai ya exist nahi karta" });
      return;
    }
    if (voucher.status === "used") {
      res.status(400).json({ error: "Yeh voucher pehle hi use ho chuka hai" });
      return;
    }
    if (voucher.status === "cancelled") {
      res.status(400).json({ error: "Yeh voucher cancel ho chuka hai" });
      return;
    }

    const [plan] = await db
      .select()
      .from(plansTable)
      .where(eq(plansTable.id, voucher.planId))
      .limit(1);

    if (!plan) {
      res.status(400).json({ error: "Is voucher ka plan nahi mila" });
      return;
    }

    const now = new Date();
    const expiresAt = new Date(now.getTime() + voucher.validityDays * 24 * 60 * 60 * 1000);

    await db
      .update(licenseVouchersTable)
      .set({ status: "used", redeemedByBusinessId: req.user.businessId, redeemedAt: now })
      .where(eq(licenseVouchersTable.id, voucher.id));

    const [updated] = await db
      .update(businessesTable)
      .set({ planId: plan.id, planStartDate: now, planExpiresAt: expiresAt, isTrial: false })
      .where(eq(businessesTable.id, req.user.businessId!))
      .returning();

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
  } catch (err: any) {
    req.log.error({ err }, "redeem-voucher error");
    res.status(500).json({ error: String(err?.message || err) });
  }
});

// ─── Offline EXE: validate voucher via cloud, update local SQLite ────────────
router.post("/redeem-voucher-offline", async (req, res) => {
  try {
    const { code, hardwareFingerprint } = req.body;
    if (!code) {
      res.status(400).json({ error: "Voucher code required" });
      return;
    }
    if (req.user?.role !== "business_admin") {
      res.status(403).json({ error: "Only business admin can activate plan" });
      return;
    }

    const [biz] = await db
      .select()
      .from(businessesTable)
      .where(eq(businessesTable.id, req.user.businessId!))
      .limit(1);

    if (!biz) {
      res.status(404).json({ error: "Business not found" });
      return;
    }

    const cloudUrl = process.env.CLOUD_API_URL || "https://erp.naewtgroup.com";
    const clientIp = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.socket.remoteAddress || "";

    let cloudData: any;
    try {
      const cloudRes = await fetch(`${cloudUrl}/api/activate-offline`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          voucherCode: code.trim().toUpperCase(),
          businessCode: biz.businessCode,
          hardwareFingerprint: hardwareFingerprint || null,
          ip: clientIp,
          businessName: biz.name,
          businessEmail: biz.email,
        }),
      });
      cloudData = await cloudRes.json();
      if (!cloudRes.ok) {
        res.status(cloudRes.status).json(cloudData);
        return;
      }
    } catch {
      res.status(503).json({ error: "Cloud se connect nahi ho saka. Internet check karo aur dobara try karo." });
      return;
    }

    // Validate and normalize expiresAt — always ensure a valid Date
    const rawExpiry = cloudData.expiresAt;
    const expiresAtDate = rawExpiry ? new Date(rawExpiry) : new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
    const expiresAtISO = (!expiresAtDate || isNaN(expiresAtDate.getTime()))
      ? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()
      : expiresAtDate.toISOString();

    // Upsert plan in local plans table (SQLite only)
    try {
      const { sqlite } = await import("@workspace/db");
      if (sqlite) {
        sqlite.prepare(`
          INSERT OR REPLACE INTO plans (id, name, price, billing_cycle, max_users, validity_days, trial_days, features, is_active, sort_order, created_at)
          VALUES (?, ?, '0', 'yearly', ?, ?, 0, '[]', 1, 0, datetime('now'))
        `).run(cloudData.planId, cloudData.planName, cloudData.maxUsers ?? 5, cloudData.validityDays ?? 365);
      }
    } catch { /* SQLite not available in cloud/PG mode */ }

    // Use sql`` template for planExpiresAt — works for both SQLite (text column) and PG (timestamp column)
    await db
      .update(businessesTable)
      .set({
        planId: cloudData.planId ? Number(cloudData.planId) : null,
        planExpiresAt: sql`${expiresAtISO}` as unknown as Date,
        isTrial: false,
      })
      .where(eq(businessesTable.id, req.user.businessId!));

    const newToken = signToken(
      { id: req.user.id, email: req.user.email, name: req.user.name, role: req.user.role, businessId: req.user.businessId, sessionToken: req.user.sessionToken },
      expiresAtDate,
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
  } catch (err: any) {
    req.log.error({ err }, "redeem-voucher-offline error");
    res.status(500).json({ error: String(err?.message || err) });
  }
});

export default router;
