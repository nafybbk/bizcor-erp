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
import activityLogRouter from "./activityLog";
import connectAdminRouter from "./connectAdmin";
import dashboardRouter from "./dashboard";
import licenseVouchersRouter from "./licenseVouchers";
import webauthnRouter from "./webauthn";
import cashBankRouter from "./cashBank";
import importDataRouter from "./importData";
import supportChatRouter from "./supportChat";
import chatRouter from "./chat";
import reportTemplatesRouter from "./reportTemplates";
import templateFilesRouter from "./templateFiles";
import printServerRouter from "./print-server";
import activationRequestsRouter from "./activationRequests";
import miniAppRouter from "./miniApp";
import galleryRouter from "./gallery";

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
      supportEmail: settings.supportEmail || "",
      supportPhone: settings.supportPhone || "",
    });
  } catch {
    res.json({ softwareName: "BizERP", logoUrl: "", primaryColor: "#2563eb", footerText: "Powered by BizERP", printFooterText: "", printFooterLogo: "", supportEmail: "", supportPhone: "" });
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

    const { hardwareFingerprint, ip, businessName, businessEmail, exeVersion } = req.body;

    const [voucher] = await db.select().from(licenseVouchersTable)
      .where(eq(licenseVouchersTable.code, voucherCode.trim().toUpperCase())).limit(1);
    if (!voucher) { res.status(404).json({ error: "Voucher code galat hai ya exist nahi karta" }); return; }
    if (voucher.status === "cancelled") { res.status(400).json({ error: "Yeh voucher cancel ho chuka hai" }); return; }

    const [plan] = await db.select().from(plansTable).where(eq(plansTable.id, voucher.planId)).limit(1);
    if (!plan) { res.status(400).json({ error: "Is voucher ka plan nahi mila" }); return; }

    const [biz] = await db.select().from(businessesTable)
      .where(eq(businessesTable.businessCode, businessCode.trim().toUpperCase())).limit(1);

    // If voucher already used — check if same business + hardware
    if (voucher.status === "used") {
      let isSameBusiness = !!(biz && voucher.redeemedByBusinessId === biz.id);
      // Fallback: redeemedByBusinessId may be null — check businessCode stored in notes
      if (!isSameBusiness && biz) {
        try {
          const notes = JSON.parse(voucher.notes || "{}");
          if (notes.businessCode && notes.businessCode === businessCode.trim().toUpperCase()) {
            isSameBusiness = true;
          }
        } catch { /* ignore */ }
      }
      if (!isSameBusiness) {
        res.status(400).json({ error: "Yeh voucher kisi aur business ke liye use ho chuka hai" });
        return;
      }
      // Same business — check hardware fingerprint
      let prevHardware: string | null = null;
      try {
        const prev = JSON.parse(voucher.notes || "{}");
        prevHardware = prev.hardware || null;
      } catch { /* ignore */ }

      const newHardware = hardwareFingerprint || null;
      const sameHardware = !prevHardware || !newHardware || prevHardware === newHardware;

      if (!sameHardware) {
        // Different PC — create pending approval request
        const { pool, sqlite } = await import("@workspace/db");
        const insertData = {
          code: voucherCode.trim().toUpperCase(),
          businessCode: businessCode.trim().toUpperCase(),
          businessName: businessName || null,
          businessEmail: businessEmail || null,
          hardwareFingerprint: newHardware,
          ip: ip || null,
          exeVersion: exeVersion || null,
        };

        if (sqlite) {
          try {
            sqlite.prepare(`
              INSERT INTO activation_requests (code, business_code, business_name, business_email, hardware_fingerprint, ip, exe_version, status)
              VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')
            `).run(insertData.code, insertData.businessCode, insertData.businessName, insertData.businessEmail, insertData.hardwareFingerprint, insertData.ip, insertData.exeVersion);
          } catch { /* ignore duplicate */ }
        } else if (pool) {
          try {
            await pool.query(
              `INSERT INTO activation_requests (code, business_code, business_name, business_email, hardware_fingerprint, ip, exe_version, status) VALUES ($1,$2,$3,$4,$5,$6,$7,'pending')`,
              [insertData.code, insertData.businessCode, insertData.businessName, insertData.businessEmail, insertData.hardwareFingerprint, insertData.ip, insertData.exeVersion]
            );
          } catch { /* ignore duplicate */ }
        }

        res.status(202).json({
          status: "PENDING_APPROVAL",
          message: "Naya device detect hua hai. Tech Support approval ke baad activate hoga. Thodi der mein dobara try karein.",
        });
        return;
      }
      // Same hardware — allow re-activation (fall through)
    }

    const now = new Date();
    const nowStr = now.toISOString();

    // Reuse/reactivation must NOT reset the validity timer — preserve the
    // remaining period from the voucher's original (first) activation date.
    // Fresh full validityDays is only granted the very first time a voucher
    // is activated.
    let firstActivatedAt: string | null = null;
    if (voucher.status === "used") {
      try {
        const prevNotes = JSON.parse(voucher.notes || "{}");
        firstActivatedAt = prevNotes.firstActivatedAt || prevNotes.activatedAt || null;
      } catch { /* ignore */ }
      if (!firstActivatedAt && voucher.redeemedAt) {
        firstActivatedAt = new Date(voucher.redeemedAt).toISOString();
      }
    }
    const isReactivation = !!firstActivatedAt;
    if (!firstActivatedAt) firstActivatedAt = nowStr;

    const baseDate = isReactivation ? new Date(firstActivatedAt) : now;
    const expiresAt = new Date(baseDate.getTime() + voucher.validityDays * 24 * 60 * 60 * 1000);

    // Save activation log in notes field
    const activationLog = JSON.stringify({
      activatedAt: nowStr,
      firstActivatedAt,
      businessCode: businessCode.trim().toUpperCase(),
      businessName: businessName || null,
      businessEmail: businessEmail || null,
      ip: ip || null,
      hardware: hardwareFingerprint || null,
      exeVersion: exeVersion || null,
    });

    // If business not in cloud DB — create it (LAN-registered business activating for first time)
    let bizId = biz?.id || null;
    if (!biz && businessName) {
      try {
        const [created] = await db.insert(businessesTable).values({
          name: businessName,
          businessCode: businessCode.trim().toUpperCase(),
          email: businessEmail || null,
          planId: plan.id,
          planStartDate: now,
          planExpiresAt: expiresAt,
          isTrial: false,
          status: "active",
        }).returning({ id: businessesTable.id });
        bizId = created?.id || null;
      } catch { /* businessCode may already exist with different case — ignore */ }
    } else if (biz) {
      await db.update(businessesTable).set({
        planId: plan.id,
        planStartDate: now,
        planExpiresAt: expiresAt,
        isTrial: false,
        status: "active",
      }).where(eq(businessesTable.id, biz.id));
    }

    await db.update(licenseVouchersTable).set({
      status: "used",
      redeemedByBusinessId: bizId,
      redeemedAt: now,
      notes: activationLog,
    }).where(eq(licenseVouchersTable.id, voucher.id));

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
import { trackIP, getActiveClients } from "../lib/lan-tracker";
export { trackIP };

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
  const clients = getActiveClients();
  res.json({ count: clients.length, clients });
});

// Desktop-only — WAL checkpoint before backup (flushes WAL into main DB file)
router.get("/desktop/checkpoint", async (_req, res) => {
  try {
    const sqlitePath = process.env.SQLITE_PATH;
    if (!sqlitePath) { res.status(400).json({ error: "Only in desktop mode." }); return; }
    const { sqlite } = await import("@workspace/db");
    if (!sqlite) { res.status(400).json({ error: "SQLite not initialized." }); return; }
    const result = sqlite.pragma("wal_checkpoint(TRUNCATE)");
    res.json({ success: true, checkpoint: result });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || "Checkpoint failed." });
  }
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
router.use(supportChatRouter);
router.use(activationRequestsRouter);
router.use(miniAppRouter);
router.use(galleryRouter);
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
router.use("/activity", activityLogRouter);
router.use("/connect", connectAdminRouter);
router.use("/dashboard", dashboardRouter);
router.use("/cash-bank", cashBankRouter);
router.use(chatRouter);
router.use(reportTemplatesRouter);
router.use(templateFilesRouter);
router.use(printServerRouter);

export default router;
