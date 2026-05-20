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

    const { hardwareFingerprint, ip, businessName, businessEmail } = req.body;

    const [voucher] = await db.select().from(licenseVouchersTable)
      .where(eq(licenseVouchersTable.code, voucherCode.trim().toUpperCase())).limit(1);
    if (!voucher) { res.status(404).json({ error: "Voucher code galat hai ya exist nahi karta" }); return; }
    if (voucher.status === "cancelled") { res.status(400).json({ error: "Yeh voucher cancel ho chuka hai" }); return; }

    const [plan] = await db.select().from(plansTable).where(eq(plansTable.id, voucher.planId)).limit(1);
    if (!plan) { res.status(400).json({ error: "Is voucher ka plan nahi mila" }); return; }

    const [biz] = await db.select().from(businessesTable)
      .where(eq(businessesTable.businessCode, businessCode.trim().toUpperCase())).limit(1);

    // If voucher already used — allow ONLY if same business is re-activating (reinstall / refresh)
    if (voucher.status === "used") {
      const isSameBusiness = biz && voucher.redeemedByBusinessId === biz.id;
      if (!isSameBusiness) {
        res.status(400).json({ error: "Yeh voucher kisi aur business ke liye use ho chuka hai" });
        return;
      }
      // Same business — allow re-activation (fall through)
    }

    const now = new Date();
    const expiresAt = new Date(now.getTime() + voucher.validityDays * 24 * 60 * 60 * 1000);
    const nowStr = now.toISOString();

    // Save activation log in notes field
    const activationLog = JSON.stringify({
      activatedAt: nowStr,
      businessCode: businessCode.trim().toUpperCase(),
      businessName: businessName || null,
      businessEmail: businessEmail || null,
      ip: ip || null,
      hardware: hardwareFingerprint || null,
    });

    await db.update(licenseVouchersTable).set({
      status: "used",
      redeemedByBusinessId: biz?.id || null,
      redeemedAt: now,
      notes: activationLog,
    }).where(eq(licenseVouchersTable.id, voucher.id));

    if (biz) {
      await db.update(businessesTable).set({
        planId: plan.id,
        planStartDate: now,
        planExpiresAt: expiresAt,
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
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: err?.message || String(err) });
  }
});

// ─── LAN IP Tracker (in-memory, desktop only) ────────────────────────────────
const _recentIPs = new Map<string, number>(); // ip → last seen timestamp

export function trackIP(ip: string) {
  if (!ip || ip === "::1" || ip === "127.0.0.1") return; // skip localhost
  _recentIPs.set(ip, Date.now());
  // Clean up IPs not seen in last 10 min
  const cutoff = Date.now() - 10 * 60 * 1000;
  for (const [k, v] of _recentIPs) if (v < cutoff) _recentIPs.delete(k);
}

// Middleware to call from app.ts — attach to router
router.use((req, _res, next) => {
  const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim()
    || req.socket?.remoteAddress || "";
  trackIP(ip);
  next();
});

// Desktop-only — returns first registered business code (for heartbeat, no auth)
router.get("/desktop/business-code", async (_req, res) => {
  try {
    const { db, businessesTable } = await import("@workspace/db");
    const { asc } = await import("drizzle-orm");
    const [biz] = await db.select({ businessCode: businessesTable.businessCode })
      .from(businessesTable).orderBy(asc(businessesTable.id)).limit(1);
    res.json({ businessCode: biz?.businessCode || null });
  } catch { res.json({ businessCode: null }); }
});

// Desktop-only — recent LAN clients (last 5 min)
router.get("/desktop/connected-clients", (_req, res) => {
  const cutoff5min = Date.now() - 5 * 60 * 1000;
  const clients = Array.from(_recentIPs.entries())
    .filter(([, t]) => t >= cutoff5min)
    .sort((a, b) => b[1] - a[1])
    .map(([ip, lastSeen]) => ({
      ip,
      lastSeenMinutesAgo: Math.floor((Date.now() - lastSeen) / 60000),
    }));
  res.json({ count: clients.length, clients });
});

// Public — offline EXE weekly heartbeat (no business auth needed)
router.post("/heartbeat", async (req, res) => {
  try {
    const { businessCode, machineId, appVersion } = req.body || {};
    if (!businessCode) { res.status(400).json({ status: "error", message: "businessCode required" }); return; }

    const { db, businessesTable } = await import("@workspace/db");
    const { eq } = await import("drizzle-orm");

    const [biz] = await db.select().from(businessesTable)
      .where(eq(businessesTable.businessCode, businessCode.trim().toUpperCase())).limit(1);

    if (!biz) { res.status(404).json({ status: "error", message: "Business not found" }); return; }

    const now = new Date();
    const expiresAt = biz.planExpiresAt ? new Date(biz.planExpiresAt) : null;
    const daysLeft = expiresAt ? Math.ceil((expiresAt.getTime() - now.getTime()) / 86400000) : null;

    let status: "active" | "warning" | "expired" | "trial" = "active";
    let message = "License valid";

    if (biz.isTrial) {
      status = "trial";
      message = daysLeft !== null ? `Trial — ${daysLeft} din bacha` : "Trial active";
    } else if (!expiresAt || daysLeft === null) {
      status = "active";
      message = "License valid (no expiry)";
    } else if (daysLeft <= 0) {
      status = "expired";
      message = "License expired. Please renew.";
    } else if (daysLeft <= 30) {
      status = "warning";
      message = `License ${daysLeft} din mein expire hoga. Renew karo.`;
    } else {
      status = "active";
      message = `License valid — ${daysLeft} din bache hain`;
    }

    res.json({
      status,
      message,
      businessName: biz.businessName,
      planExpiresAt: expiresAt?.toISOString() || null,
      daysLeft,
      checkedAt: now.toISOString(),
      machineId: machineId || null,
      appVersion: appVersion || null,
    });
  } catch (err: any) {
    res.status(500).json({ status: "error", message: err?.message || "Server error" });
  }
});

router.use("/auth", authRouter);
router.use("/auth/webauthn", webauthnRouter);
router.use("/super-admin", superAdminRouter);
router.use("/super-admin", importDataRouter);

// Businesses router — BEFORE licenseVouchersRouter and requireActivePlan.
// POST /businesses/register is public (no auth). Other routes inside use per-route requireBusiness.
// Mounting here guarantees /register is NEVER blocked by any downstream auth middleware.
router.use("/businesses", businessesRouter);

// License vouchers — BEFORE requireActivePlan so businesses with no plan can activate
router.use(licenseVouchersRouter);

// All other routes — plan expiry enforced on every call
router.use(requireActivePlan);
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
router.use("/cash-bank", cashBankRouter);

export default router;
