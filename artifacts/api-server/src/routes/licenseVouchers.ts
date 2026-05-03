import { Router } from "express";
import { db, licenseVouchersTable, plansTable, businessesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireBusiness } from "../middlewares/auth";

const router = Router();
router.use(requireBusiness);

// Redeem a license voucher — any authenticated business user (admin role only)
router.post("/redeem-voucher", async (req, res) => {
  try {
    const { code } = req.body;
    if (!code) { res.status(400).json({ error: "Voucher code required" }); return; }
    if (!req.user?.businessId) { res.status(403).json({ error: "Business context required" }); return; }
    if (req.user.role !== "business_admin") { res.status(403).json({ error: "Only business admin can redeem vouchers" }); return; }

    const voucher = await db.query.licenseVouchersTable.findFirst({
      where: eq(licenseVouchersTable.code, code.trim().toUpperCase()),
    });

    if (!voucher) { res.status(404).json({ error: "Voucher code galat hai ya exist nahi karta" }); return; }
    if (voucher.status === "used") { res.status(400).json({ error: "Yeh voucher pehle hi use ho chuka hai" }); return; }
    if (voucher.status === "cancelled") { res.status(400).json({ error: "Yeh voucher cancel ho chuka hai" }); return; }

    const plan = await db.query.plansTable.findFirst({ where: eq(plansTable.id, voucher.planId) });
    if (!plan) { res.status(400).json({ error: "Is voucher ka plan nahi mila" }); return; }

    const now = new Date();
    const expiresAt = new Date(now.getTime() + voucher.validityDays * 24 * 60 * 60 * 1000);

    await db.update(licenseVouchersTable).set({
      status: "used",
      redeemedByBusinessId: req.user.businessId,
      redeemedAt: now,
    }).where(eq(licenseVouchersTable.id, voucher.id));

    const [updated] = await db.update(businessesTable).set({
      planId: plan.id,
      planStartDate: now,
      planExpiresAt: expiresAt,
      isTrial: false,
      status: "active",
    }).where(eq(businessesTable.id, req.user.businessId)).returning();

    res.json({
      success: true,
      message: `${plan.name} plan activate ho gaya! ${voucher.validityDays} din ke liye valid hai.`,
      plan: { id: plan.id, name: plan.name, validityDays: voucher.validityDays },
      expiresAt: expiresAt.toISOString(),
      business: updated,
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

export default router;
