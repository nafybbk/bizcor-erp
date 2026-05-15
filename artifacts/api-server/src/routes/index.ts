import { Router, type IRouter } from "express";
import { requireActivePlan } from "../middlewares/auth";
import healthRouter from "./health";
import authRouter from "./auth";
import superAdminRouter from "./superAdmin";
import businessesRouter from "./businesses";
import usersRouter from "./users";
import partiesRouter from "./parties";
import itemsRouter from "./items";
import mastersRouter from "./masters";
import vouchersRouter from "./vouchers";
import paymentsRouter from "./payments";
import inventoryRouter from "./inventory";
import accountingRouter from "./accounting";
import gstRouter from "./gst";
import dashboardRouter from "./dashboard";
import licenseVouchersRouter from "./licenseVouchers";
import webauthnRouter from "./webauthn";
import cashBankRouter from "./cashBank";
import importDataRouter from "./importData";

const router: IRouter = Router();

router.use(healthRouter);

// Public — available plans list (for subscription page)
router.get("/public-plans", async (_req, res) => {
  try {
    const { db, plansTable } = await import("@workspace/db");
    const { eq } = await import("drizzle-orm");
    const plans = await db.select().from(plansTable).where(eq(plansTable.isActive, true));
    res.json(plans.map(p => ({
      id: p.id, name: p.name, description: p.description,
      price: Number(p.price), billingCycle: p.billingCycle,
      maxUsers: p.maxUsers, validityDays: p.validityDays,
      features: p.features || [],
      maxVouchersPerMonth: p.maxVouchersPerMonth,
      maxItems: p.maxItems, maxParties: p.maxParties,
      sortOrder: p.sortOrder,
    })).sort((a, b) => a.sortOrder - b.sortOrder || a.price - b.price));
  } catch { res.json([]); }
});

// Public endpoint — no auth required (for login page branding)
router.get("/public-settings", async (_req, res) => {
  try {
    const { db, appSettingsTable } = await import("@workspace/db");
    const rows = await db.select().from(appSettingsTable);
    const settings: Record<string, string> = {};
    for (const row of rows) settings[row.key] = row.value || "";
    res.json({
      softwareName: settings.softwareName || "BizERP",
      logoUrl: settings.logoUrl || "",
      primaryColor: settings.primaryColor || "#2563eb",
      footerText: settings.footerText || "Powered by BizERP",
      printFooterText: settings.printFooterText || "",
      printFooterLogo: settings.printFooterLogo || "",
    });
  } catch {
    res.json({ softwareName: "BizERP", logoUrl: "", primaryColor: "#2563eb", footerText: "Powered by BizERP", printFooterText: "", printFooterLogo: "" });
  }
});

// Public — offline EXE voucher activation (no business auth needed)
router.post("/activate-offline", async (req, res) => {
  try {
    const { voucherCode, businessCode } = req.body;
    if (!voucherCode || !businessCode) {
      res.status(400).json({ error: "voucherCode aur businessCode dono required hain" });
      return;
    }
    const { db, licenseVouchersTable, plansTable, businessesTable } = await import("@workspace/db");
    const { eq } = await import("drizzle-orm");

    const [voucher] = await db.select().from(licenseVouchersTable)
      .where(eq(licenseVouchersTable.code, voucherCode.trim().toUpperCase())).limit(1);
    if (!voucher) { res.status(404).json({ error: "Voucher code galat hai ya exist nahi karta" }); return; }
    if (voucher.status === "used") { res.status(400).json({ error: "Yeh voucher pehle hi use ho chuka hai" }); return; }
    if (voucher.status === "cancelled") { res.status(400).json({ error: "Yeh voucher cancel ho chuka hai" }); return; }

    const [plan] = await db.select().from(plansTable).where(eq(plansTable.id, voucher.planId)).limit(1);
    if (!plan) { res.status(400).json({ error: "Is voucher ka plan nahi mila" }); return; }

    const [biz] = await db.select().from(businessesTable)
      .where(eq(businessesTable.businessCode, businessCode.trim().toUpperCase())).limit(1);

    const now = new Date();
    const expiresAt = new Date(now.getTime() + voucher.validityDays * 24 * 60 * 60 * 1000);
    const nowStr = now.toISOString();

    await db.update(licenseVouchersTable).set({
      status: "used",
      redeemedByBusinessId: biz?.id || null,
      redeemedAt: nowStr as unknown as Date,
    }).where(eq(licenseVouchersTable.id, voucher.id));

    if (biz) {
      await db.update(businessesTable).set({
        planId: plan.id,
        planStartDate: nowStr as unknown as Date,
        planExpiresAt: expiresAt as unknown as Date,
        isTrial: false,
        status: "active",
      }).where(eq(businessesTable.id, biz.id));
    }

    res.json({
      success: true,
      planId: plan.id,
      planName: plan.name,
      validityDays: voucher.validityDays,
      expiresAt: expiresAt.toISOString(),
      maxUsers: plan.maxUsers,
      features: plan.features || [],
      maxVouchersPerMonth: plan.maxVouchersPerMonth ?? null,
      maxItems: plan.maxItems ?? null,
      maxParties: plan.maxParties ?? null,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.use("/auth", authRouter);
router.use("/auth/webauthn", webauthnRouter);
router.use("/super-admin", superAdminRouter);
router.use("/super-admin", importDataRouter);

// All business routes — plan expiry enforced on every call
router.use(requireActivePlan);
router.use("/businesses", businessesRouter);
router.use("/users", usersRouter);
router.use("/parties", partiesRouter);
router.use("/items", itemsRouter);
router.use("/masters", mastersRouter);
router.use(vouchersRouter);
router.use("/payments", paymentsRouter);
router.use("/inventory", inventoryRouter);
router.use("/accounting", accountingRouter);
router.use("/gst", gstRouter);
router.use("/dashboard", dashboardRouter);
router.use(licenseVouchersRouter);
router.use("/cash-bank", cashBankRouter);

export default router;
