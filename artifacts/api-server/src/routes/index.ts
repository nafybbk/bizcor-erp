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

const router: IRouter = Router();

router.use(healthRouter);

// TEMP: one-time migration runner (remove after use)
router.get("/run-db-fix-20260506", async (_req, res) => {
  try {
    const { db } = await import("@workspace/db");
    const { sql } = await import("drizzle-orm");
    const fixes = [
      "ALTER TABLE users ADD COLUMN IF NOT EXISTS session_token TEXT",
      "ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP",
      "ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_ip TEXT",
      "ALTER TABLE users ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMP",
      "ALTER TABLE users ADD COLUMN IF NOT EXISTS login_pin TEXT",
    ];
    const results: string[] = [];
    for (const s of fixes) {
      try { await db.execute(sql.raw(s)); results.push("OK: " + s); }
      catch (e: any) { results.push("SKIP: " + e.message); }
    }
    const check = await db.execute(sql`SELECT column_name FROM information_schema.columns WHERE table_name='users' AND column_name IN ('session_token','last_login_at','last_login_ip','last_seen_at','login_pin') ORDER BY column_name`);
    const cols = ((check as any).rows ?? check).map((r: any) => r.column_name);
    res.json({ done: true, results, columnsInDb: cols });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

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
    });
  } catch {
    res.json({ softwareName: "BizERP", logoUrl: "", primaryColor: "#2563eb", footerText: "Powered by BizERP" });
  }
});

router.use("/auth", authRouter);
router.use("/auth/webauthn", webauthnRouter);
router.use("/super-admin", superAdminRouter);

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

export default router;
