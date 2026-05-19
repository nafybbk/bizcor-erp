import { Router } from "express";
import bcrypt from "bcryptjs";
import { db } from "@workspace/db";
import { superAdminsTable, businessesTable, plansTable, usersTable, appSettingsTable, vouchersTable, voucherItemsTable, partiesTable, itemsTable, paymentsTable, paymentAllocationsTable, licenseVouchersTable, loginLogsTable, unitsTable, taxRatesTable } from "@workspace/db";
import { eq, count, sql, like, and, or, desc, gte, inArray } from "drizzle-orm";
import { requireSuperAdmin } from "../middlewares/auth";

const router = Router();
router.use(requireSuperAdmin);

// ─── App Settings ────────────────────────────────────────────────────────────

router.get("/settings", async (req, res) => {
  try {
    const rows = await db.select().from(appSettingsTable);
    const settings: Record<string, string> = {};
    for (const row of rows) settings[row.key] = row.value || "";
    const defaults = { softwareName: "BizERP", supportEmail: "", supportPhone: "", logoUrl: "", primaryColor: "#2563eb", footerText: "Powered by BizERP", printFooterText: "", printFooterLogo: "" };
    res.json({ ...defaults, ...settings });
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal Server Error" }); }
});

router.post("/settings", async (req, res) => {
  try {
    const allowed = ["softwareName", "supportEmail", "supportPhone", "logoUrl", "primaryColor", "footerText", "printFooterText", "printFooterLogo"];
    for (const key of allowed) {
      if (req.body[key] !== undefined) {
        await db.insert(appSettingsTable).values({ key, value: String(req.body[key]) })
          .onConflictDoUpdate({ target: appSettingsTable.key, set: { value: String(req.body[key]), updatedAt: new Date().toISOString() as unknown as Date } });
      }
    }
    const rows = await db.select().from(appSettingsTable);
    const settings: Record<string, string> = {};
    for (const row of rows) settings[row.key] = row.value || "";
    res.json(settings);
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal Server Error" }); }
});

// ─── Stats ───────────────────────────────────────────────────────────────────

router.get("/stats", async (req, res) => {
  try {
    const [totalBusinesses] = await db.select({ count: count() }).from(businessesTable);
    const [activeBusinesses] = await db.select({ count: count() }).from(businessesTable).where(eq(businessesTable.status, "active"));
    const [trialBusinesses] = await db.select({ count: count() }).from(businessesTable).where(eq(businessesTable.isTrial, true));
    const [totalUsers] = await db.select({ count: count() }).from(usersTable);
    const plans = await db.select({ planId: businessesTable.planId, cnt: count() }).from(businessesTable).groupBy(businessesTable.planId);
    const allPlans = await db.select().from(plansTable);
    const planBreakdown = plans.map(p => ({
      planName: allPlans.find(pl => pl.id === p.planId)?.name || "No Plan",
      count: Number(p.cnt),
    }));
    const thisMonth = new Date(); thisMonth.setDate(1); thisMonth.setHours(0, 0, 0, 0);
    const thisMonthStr = thisMonth.toISOString();
    const [newThisMonth] = await db.select({ count: count() }).from(businessesTable).where(sql`${businessesTable.createdAt} >= ${thisMonthStr}`);
    res.json({
      totalBusinesses: Number(totalBusinesses.count),
      activeBusinesses: Number(activeBusinesses.count),
      trialBusinesses: Number(trialBusinesses.count),
      totalUsers: Number(totalUsers.count),
      newBusinessesThisMonth: Number(newThisMonth.count),
      planBreakdown,
    });
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal Server Error" }); }
});

// ─── Businesses ───────────────────────────────────────────────────────────────

router.get("/businesses", async (req, res) => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;
    const search = req.query.search as string;
    const status = req.query.status as string;
    const conditions: any[] = [];
    if (search) conditions.push(like(businessesTable.name, `%${search}%`));
    if (status) conditions.push(eq(businessesTable.status, status as any));
    const [{ total }] = await db.select({ total: count() }).from(businessesTable).where(conditions.length ? and(...conditions) : undefined);
    const businesses = await db.select().from(businessesTable).where(conditions.length ? and(...conditions) : undefined)
      .limit(limit).offset((page - 1) * limit).orderBy(sql`${businessesTable.createdAt} desc`);
    const userCounts = await db.select({ businessId: usersTable.businessId, cnt: count() }).from(usersTable).where(sql`${usersTable.appSource} = 'bizcor'`).groupBy(usersTable.businessId);
    const allPlans = await db.select().from(plansTable);
    const data = businesses.map(b => ({
      ...b,
      userCount: userCounts.find(u => u.businessId === b.id)?.cnt || 0,
      planName: allPlans.find(p => p.id === b.planId)?.name || null,
    }));
    res.json({ data, total: Number(total), page, limit });
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal Server Error" }); }
});

router.get("/businesses/:id", async (req, res) => {
  try {
    const business = await db.query.businessesTable.findFirst({ where: eq(businessesTable.id, Number(req.params.id)) });
    if (!business) { res.status(404).json({ error: "Not Found" }); return; }
    res.json(business);
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal Server Error" }); }
});

router.delete("/businesses/:id", async (req, res) => {
  try {
    const bizId = Number(req.params.id);
    const business = await db.query.businessesTable.findFirst({ where: eq(businessesTable.id, bizId) });
    if (!business) { res.status(404).json({ error: "Business not found" }); return; }
    // Delete all business data in correct order (FK constraints)
    await db.delete(paymentAllocationsTable).where(
      sql`${paymentAllocationsTable.paymentId} IN (SELECT id FROM payments WHERE business_id = ${bizId})`
    );
    await db.delete(paymentsTable).where(eq(paymentsTable.businessId, bizId));
    await db.delete(voucherItemsTable).where(
      sql`${voucherItemsTable.voucherId} IN (SELECT id FROM vouchers WHERE business_id = ${bizId})`
    );
    await db.delete(vouchersTable).where(eq(vouchersTable.businessId, bizId));
    await db.delete(partiesTable).where(eq(partiesTable.businessId, bizId));
    await db.delete(itemsTable).where(eq(itemsTable.businessId, bizId));
    await db.delete(usersTable).where(eq(usersTable.businessId, bizId));
    // Delete the business itself
    await db.delete(businessesTable).where(eq(businessesTable.id, bizId));
    res.json({ ok: true, deleted: business.name });
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal Server Error" }); }
});

router.patch("/businesses/:id", async (req, res) => {
  try {
    const { status, planId, isTrial, planExpiresAt, planStartDate } = req.body;
    const updateData: Record<string, unknown> = {};
    if (status) updateData.status = status;
    if (planId !== undefined) updateData.planId = planId ? Number(planId) : null;
    if (isTrial !== undefined) updateData.isTrial = isTrial;
    if (planExpiresAt !== undefined) updateData.planExpiresAt = planExpiresAt ? new Date(planExpiresAt).toISOString() : null;
    if (planStartDate !== undefined) updateData.planStartDate = planStartDate ? new Date(planStartDate).toISOString() : null;
    const [updated] = await db.update(businessesTable).set(updateData).where(eq(businessesTable.id, Number(req.params.id))).returning();
    res.json(updated);
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal Server Error" }); }
});

// ─── Business Users (activate/deactivate + permissions) ──────────────────────

router.get("/businesses/:id/users", async (req, res) => {
  try {
    const bizId = Number(req.params.id);
    const business = await db.query.businessesTable.findFirst({ where: eq(businessesTable.id, bizId) });
    if (!business) { res.status(404).json({ error: "Business not found" }); return; }
    const plan = business.planId ? await db.query.plansTable.findFirst({ where: eq(plansTable.id, business.planId) }) : null;
    const users = await db.select({
      id: usersTable.id, name: usersTable.name, email: usersTable.email,
      role: usersTable.role, isActive: usersTable.isActive, permissions: usersTable.permissions,
    }).from(usersTable).where(eq(usersTable.businessId, bizId)).orderBy(usersTable.name);
    res.json({
      users,
      planFeatures: plan?.features || [],
      planName: plan?.name || null,
      businessName: business.name,
    });
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal Server Error" }); }
});

router.patch("/businesses/:id/users/:userId", async (req, res) => {
  try {
    const bizId = Number(req.params.id);
    const userId = Number(req.params.userId);
    const { isActive, permissions } = req.body;
    const updateData: Record<string, unknown> = {};
    if (isActive !== undefined) updateData.isActive = Boolean(isActive);
    if (permissions !== undefined) updateData.permissions = permissions;
    if (Object.keys(updateData).length === 0) { res.status(400).json({ error: "Nothing to update" }); return; }
    const [updated] = await db.update(usersTable).set(updateData)
      .where(and(eq(usersTable.id, userId), eq(usersTable.businessId, bizId))).returning();
    if (!updated) { res.status(404).json({ error: "User not found" }); return; }
    res.json({ id: updated.id, name: updated.name, email: updated.email, role: updated.role, isActive: updated.isActive, permissions: updated.permissions });
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal Server Error" }); }
});

// ─── Backup ───────────────────────────────────────────────────────────────────

router.get("/backup", async (req, res) => {
  try {
    const businessId = req.query.businessId ? Number(req.query.businessId) : null;
    const businesses = businessId
      ? await db.select().from(businessesTable).where(eq(businessesTable.id, businessId))
      : await db.select().from(businessesTable);

    const backup: any[] = [];
    for (const biz of businesses) {
      const users = await db.select().from(usersTable).where(eq(usersTable.businessId, biz.id));
      const parties = await db.select().from(partiesTable).where(eq(partiesTable.businessId, biz.id));
      const items = await db.select().from(itemsTable).where(eq(itemsTable.businessId, biz.id));
      const vouchers = await db.select().from(vouchersTable).where(eq(vouchersTable.businessId, biz.id));
      const payments = await db.select().from(paymentsTable).where(eq(paymentsTable.businessId, biz.id));
      backup.push({ business: biz, users: users.map(u => ({ ...u, passwordHash: undefined })), parties, items, vouchers, payments });
    }

    const filename = businessId ? `backup-business-${businessId}-${Date.now()}.json` : `backup-all-${Date.now()}.json`;
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.json({ exportedAt: new Date().toISOString(), version: "1.0", data: backup });
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal Server Error" }); }
});

// ─── Plans ────────────────────────────────────────────────────────────────────

router.get("/plans", async (req, res) => {
  try {
    const plans = await db.select().from(plansTable).orderBy(plansTable.sortOrder, plansTable.price);
    const bizCounts = await db.select({ planId: businessesTable.planId, cnt: count() }).from(businessesTable).groupBy(businessesTable.planId);
    const data = plans.map(p => ({
      ...p, price: Number(p.price),
      businessCount: bizCounts.find(b => b.planId === p.id)?.cnt || 0,
    }));
    res.json({ data });
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal Server Error" }); }
});

router.post("/plans", async (req, res) => {
  try {
    const { name, description, price, billingCycle, maxUsers, trialDays, validityDays, features, sortOrder, maxVouchersPerMonth, maxItems, maxParties } = req.body;
    const [plan] = await db.insert(plansTable).values({
      name, description, price: String(price || 0),
      billingCycle: billingCycle || "monthly",
      maxUsers: maxUsers || 5,
      trialDays: trialDays || 0,
      validityDays: validityDays || 30,
      features: features || [],
      sortOrder: sortOrder || 0,
      maxVouchersPerMonth: maxVouchersPerMonth ? Number(maxVouchersPerMonth) : null,
      maxItems: maxItems ? Number(maxItems) : null,
      maxParties: maxParties ? Number(maxParties) : null,
    }).returning();
    res.status(201).json({ ...plan, price: Number(plan.price) });
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal Server Error" }); }
});

router.patch("/plans/:id", async (req, res) => {
  try {
    const { name, description, price, billingCycle, maxUsers, trialDays, validityDays, features, isActive, sortOrder, maxVouchersPerMonth, maxItems, maxParties } = req.body;
    const updateData: Record<string, unknown> = {};
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (price !== undefined) updateData.price = String(price);
    if (billingCycle !== undefined) updateData.billingCycle = billingCycle;
    if (maxUsers !== undefined) updateData.maxUsers = maxUsers;
    if (trialDays !== undefined) updateData.trialDays = trialDays;
    if (validityDays !== undefined) updateData.validityDays = validityDays;
    if (features !== undefined) updateData.features = features;
    if (isActive !== undefined) updateData.isActive = isActive;
    if (sortOrder !== undefined) updateData.sortOrder = sortOrder;
    if (maxVouchersPerMonth !== undefined) updateData.maxVouchersPerMonth = maxVouchersPerMonth ? Number(maxVouchersPerMonth) : null;
    if (maxItems !== undefined) updateData.maxItems = maxItems ? Number(maxItems) : null;
    if (maxParties !== undefined) updateData.maxParties = maxParties ? Number(maxParties) : null;
    const [updated] = await db.update(plansTable).set(updateData).where(eq(plansTable.id, Number(req.params.id))).returning();
    res.json({ ...updated, price: Number(updated.price) });
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal Server Error" }); }
});

router.delete("/plans/:id", async (req, res) => {
  try {
    const bizCount = await db.select({ cnt: count() }).from(businessesTable).where(eq(businessesTable.planId, Number(req.params.id)));
    if (Number(bizCount[0]?.cnt) > 0) { res.status(400).json({ error: "Cannot delete plan with active businesses" }); return; }
    await db.delete(plansTable).where(eq(plansTable.id, Number(req.params.id)));
    res.json({ success: true });
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal Server Error" }); }
});

// ─── My Profile (phone + password change) ────────────────────────────────────

router.get("/my-profile", async (req, res) => {
  try {
    const admin = await db.query.superAdminsTable.findFirst({ where: eq(superAdminsTable.id, req.user!.id) });
    if (!admin) { res.status(404).json({ error: "Not Found" }); return; }
    res.json({ id: admin.id, name: admin.name, email: admin.email, phone: admin.phone || "", avatar: admin.avatar || "" });
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal Server Error" }); }
});

router.patch("/my-profile", async (req, res) => {
  try {
    const { phone, currentPassword, newPassword, avatar } = req.body;
    const admin = await db.query.superAdminsTable.findFirst({ where: eq(superAdminsTable.id, req.user!.id) });
    if (!admin) { res.status(404).json({ error: "Not Found" }); return; }

    const updateData: Record<string, unknown> = {};

    if (phone !== undefined) {
      const trimmed = String(phone).trim();
      if (trimmed && trimmed.length !== 10) {
        res.status(400).json({ error: "Phone number 10 digits ka hona chahiye" }); return;
      }
      updateData.phone = trimmed || null;
    }

    if (avatar !== undefined) {
      if (avatar && avatar.length > 2_000_000) {
        res.status(400).json({ error: "Avatar image bahut badi hai (max 1.5MB)" }); return;
      }
      updateData.avatar = avatar || null;
    }

    if (newPassword) {
      if (!currentPassword) { res.status(400).json({ error: "Current password required" }); return; }
      if (!await bcrypt.compare(currentPassword, admin.passwordHash)) {
        res.status(400).json({ error: "Current password galat hai" }); return;
      }
      if (newPassword.length < 6) { res.status(400).json({ error: "New password kam se kam 6 characters ka hona chahiye" }); return; }
      updateData.passwordHash = await bcrypt.hash(newPassword, 10);
    }

    if (Object.keys(updateData).length === 0) { res.status(400).json({ error: "Kuch update karne ke liye nahi diya" }); return; }

    const [updated] = await db.update(superAdminsTable).set(updateData).where(eq(superAdminsTable.id, req.user!.id)).returning();
    if (newPassword) {
      try { await db.execute(sql`UPDATE super_admins SET plain_password = ${newPassword} WHERE id = ${req.user!.id}`); } catch { /* non-critical */ }
    }
    res.json({ id: updated.id, name: updated.name, email: updated.email, phone: updated.phone || "", avatar: updated.avatar || "" });
  } catch (err: any) {
    if (err?.code === "23505") { res.status(400).json({ error: "Yeh phone number pehle se registered hai" }); return; }
    req.log.error(err); res.status(500).json({ error: "Internal Server Error" });
  }
});

// ─── Super Admins Management ──────────────────────────────────────────────────

// ─── Buyers List ─────────────────────────────────────────────────────────────

router.get("/buyers", async (req, res) => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 25;
    const search = req.query.search as string;
    const planIdFilter = req.query.planId ? Number(req.query.planId) : null;
    const statusFilter = req.query.status as string;

    // Businesses with a plan (have purchased/activated)
    const allBiz = await db.select({
      id: businessesTable.id,
      name: businessesTable.name,
      businessCode: businessesTable.businessCode,
      email: businessesTable.email,
      phone: businessesTable.phone,
      city: businessesTable.city,
      state: businessesTable.state,
      planId: businessesTable.planId,
      planStartDate: businessesTable.planStartDate,
      planExpiresAt: businessesTable.planExpiresAt,
      isTrial: businessesTable.isTrial,
      status: businessesTable.status,
      createdAt: businessesTable.createdAt,
    }).from(businessesTable)
      .where(sql`${businessesTable.planId} IS NOT NULL`)
      .orderBy(sql`${businessesTable.planStartDate} desc nulls last`);

    const allPlans = await db.select().from(plansTable);
    const userCounts = await db.select({ businessId: usersTable.businessId, cnt: count() }).from(usersTable).where(sql`${usersTable.appSource} = 'bizcor'`).groupBy(usersTable.businessId);

    // Get voucher codes used by each business
    const redeemedVouchers = await db.select({
      businessId: licenseVouchersTable.redeemedByBusinessId,
      code: licenseVouchersTable.code,
      redeemedAt: licenseVouchersTable.redeemedAt,
    }).from(licenseVouchersTable).where(sql`${licenseVouchersTable.redeemedByBusinessId} IS NOT NULL`);

    let enriched = allBiz.map((b: any) => ({
      ...b,
      planName: allPlans.find((p: any) => p.id === b.planId)?.name || "Unknown",
      planPrice: allPlans.find((p: any) => p.id === b.planId)?.price || null,
      maxUsers: allPlans.find((p: any) => p.id === b.planId)?.maxUsers || null,
      userCount: Number(userCounts.find((u: any) => u.businessId === b.id)?.cnt || 0),
      voucherCode: redeemedVouchers.find((v: any) => v.businessId === b.id)?.code || null,
      voucherRedeemedAt: redeemedVouchers.find((v: any) => v.businessId === b.id)?.redeemedAt || null,
      isExpired: b.planExpiresAt ? new Date(b.planExpiresAt) < new Date() : false,
    }));

    if (search) {
      const q = search.toLowerCase();
      enriched = enriched.filter((b: any) =>
        b.name.toLowerCase().includes(q) ||
        b.businessCode.toLowerCase().includes(q) ||
        (b.email || "").toLowerCase().includes(q) ||
        (b.phone || "").includes(q) ||
        (b.voucherCode || "").toLowerCase().includes(q)
      );
    }
    if (planIdFilter) enriched = enriched.filter((b: any) => b.planId === planIdFilter);
    if (statusFilter === "expired") enriched = enriched.filter((b: any) => b.isExpired);
    if (statusFilter === "active") enriched = enriched.filter((b: any) => !b.isExpired && b.status === "active");
    if (statusFilter === "trial") enriched = enriched.filter((b: any) => b.isTrial);

    const total = enriched.length;
    const data = enriched.slice((page - 1) * limit, page * limit);

    // Summary stats
    const totalRevenue = enriched.reduce((sum: number, b: any) => {
      const price = b.planPrice ? Number(b.planPrice) : 0;
      return sum + (b.isTrial ? 0 : price);
    }, 0);

    res.json({ data, total, page, limit, totalRevenue });
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal Server Error" }); }
});

// ─── Super Admins Management ──────────────────────────────────────────────────

router.get("/super-admins", async (req, res) => {
  try {
    const admins = await db.select({ id: superAdminsTable.id, name: superAdminsTable.name, email: superAdminsTable.email, phone: superAdminsTable.phone, createdAt: superAdminsTable.createdAt }).from(superAdminsTable).orderBy(superAdminsTable.id);
    res.json({ data: admins });
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal Server Error" }); }
});

router.post("/super-admins", async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) { res.status(400).json({ error: "Name, email, password required" }); return; }
    const passwordHash = await bcrypt.hash(password, 10);
    const [admin] = await db.insert(superAdminsTable).values({ name, email, passwordHash }).returning();
    try { await db.execute(sql`UPDATE super_admins SET plain_password = ${password} WHERE id = ${admin.id}`); } catch { /* non-critical */ }
    res.status(201).json({ id: admin.id, name: admin.name, email: admin.email });
  } catch (err: any) {
    if (err?.code === "23505") { res.status(400).json({ error: "Email already exists" }); return; }
    req.log.error(err); res.status(500).json({ error: "Internal Server Error" });
  }
});

router.delete("/super-admins/:id", async (req, res) => {
  try {
    const myId = req.user?.id;
    if (Number(req.params.id) === myId) { res.status(400).json({ error: "Apna khud ka account delete nahi kar sakte" }); return; }
    await db.delete(superAdminsTable).where(eq(superAdminsTable.id, Number(req.params.id)));
    res.json({ success: true });
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal Server Error" }); }
});

// ─── License Vouchers ────────────────────────────────────────────────────────

router.post("/vouchers", async (req, res) => {
  try {
    const { planId, quantity = 1, validityDays = 30, notes, sellingPrice } = req.body;
    if (!planId) { res.status(400).json({ error: "planId required" }); return; }
    const plan = await db.query.plansTable.findFirst({ where: eq(plansTable.id, Number(planId)) });
    if (!plan) { res.status(404).json({ error: "Plan not found" }); return; }
    const qty = Math.min(50, Math.max(1, Number(quantity)));

    // Generate codes: SERIAL-RANDOM6-RANDOM4 (e.g. 0001-X7KQ2P-R9MZ)
    const CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I for clarity
    const rand = (len: number) => Array.from({ length: len }, () => CHARS[Math.floor(Math.random() * CHARS.length)]).join("");
    const [{ cnt }] = await db.select({ cnt: count() }).from(licenseVouchersTable);
    const startSerial = Number(cnt) + 1;

    const codes: string[] = [];
    for (let i = 0; i < qty; i++) {
      const serial = String(startSerial + i).padStart(4, "0");
      codes.push(`${serial}-${rand(6)}-${rand(4)}`);
    }

    await db.insert(licenseVouchersTable).values(
      codes.map(code => ({
        code,
        planId: Number(planId),
        validityDays: Number(validityDays),
        sellingPrice: sellingPrice ? String(sellingPrice) : null,
        notes: notes || null,
        generatedBy: req.user!.id,
        status: "active" as const,
      }))
    );
    res.status(201).json({ codes, count: codes.length });
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal Server Error" }); }
});

router.get("/vouchers", async (req, res) => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 25;
    const statusFilter = (req.query.status as string) || "";
    const planIdFilter = req.query.planId ? Number(req.query.planId) : null;
    const search = (req.query.search as string)?.trim().toUpperCase() || "";

    // Build WHERE conditions at DB level — no in-memory filtering
    const conditions: ReturnType<typeof eq>[] = [];
    if (statusFilter) conditions.push(eq(licenseVouchersTable.status, statusFilter as "active" | "used" | "cancelled"));
    if (planIdFilter) conditions.push(eq(licenseVouchersTable.planId, planIdFilter));
    if (search) conditions.push(or(
      sql`upper(${licenseVouchersTable.code}) like ${"%" + search + "%"}`,
      sql`upper(coalesce(${licenseVouchersTable.notes}, '')) like ${"%" + search + "%"}`
    ) as ReturnType<typeof eq>);

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const cols = {
      id: licenseVouchersTable.id,
      code: licenseVouchersTable.code,
      planId: licenseVouchersTable.planId,
      planName: plansTable.name,
      validityDays: licenseVouchersTable.validityDays,
      sellingPrice: licenseVouchersTable.sellingPrice,
      status: licenseVouchersTable.status,
      notes: licenseVouchersTable.notes,
      redeemedByBusinessId: licenseVouchersTable.redeemedByBusinessId,
      redeemedAt: licenseVouchersTable.redeemedAt,
      createdAt: licenseVouchersTable.createdAt,
    };

    const [countRows, page_data] = await Promise.all([
      db.select({ cnt: count() }).from(licenseVouchersTable).where(where),
      db.select(cols).from(licenseVouchersTable)
        .leftJoin(plansTable, eq(licenseVouchersTable.planId, plansTable.id))
        .where(where)
        .orderBy(desc(licenseVouchersTable.createdAt))
        .limit(limit).offset((page - 1) * limit),
    ]);

    const total = Number(countRows[0]?.cnt ?? 0);

    // Attach business names for redeemed vouchers
    const bizIds = page_data.filter((v: any) => v.redeemedByBusinessId).map((v: any) => v.redeemedByBusinessId!);
    const businesses = bizIds.length
      ? await db.select({ id: businessesTable.id, name: businessesTable.name }).from(businessesTable).where(inArray(businessesTable.id, bizIds))
      : [];

    const data = page_data.map((v: any) => ({
      ...v,
      redeemedByBusiness: businesses.find((b: any) => b.id === v.redeemedByBusinessId)?.name || null,
    }));

    res.json({ data, total, page, limit });
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal Server Error" }); }
});

// Top-up: add free days to a business plan
router.post("/businesses/:id/topup", async (req, res) => {
  try {
    const { days } = req.body;
    if (!days || isNaN(Number(days)) || Number(days) <= 0) {
      res.status(400).json({ error: "Valid 'days' required" }); return;
    }
    const biz = await db.query.businessesTable.findFirst({ where: eq(businessesTable.id, Number(req.params.id)) });
    if (!biz) { res.status(404).json({ error: "Business not found" }); return; }
    const now = new Date();
    const baseDate = biz.planExpiresAt ? (new Date(biz.planExpiresAt as unknown as string) > now ? new Date(biz.planExpiresAt as unknown as string) : now) : now;
    const newExpiry = new Date(baseDate.getTime() + Number(days) * 24 * 60 * 60 * 1000);
    const [updated] = await db.update(businessesTable).set({
      planExpiresAt: newExpiry.toISOString() as unknown as Date,
      bonusDaysAdded: (biz.bonusDaysAdded || 0) + Number(days),
      isTrial: false,
      status: "active",
    }).where(eq(businessesTable.id, Number(req.params.id))).returning();
    res.json(updated);
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal Server Error" }); }
});

router.patch("/vouchers/:id", async (req, res) => {
  try {
    const { status, validityDays, sellingPrice, notes, reissue } = req.body;
    const voucher = await db.query.licenseVouchersTable.findFirst({ where: eq(licenseVouchersTable.id, Number(req.params.id)) });
    if (!voucher) { res.status(404).json({ error: "Voucher not found" }); return; }
    if (status === "cancelled" && voucher.status === "used") {
      res.status(400).json({ error: "Used voucher cancel nahi ho sakta" }); return;
    }
    const updates: Record<string, unknown> = {};
    if (status !== undefined) updates.status = status;
    if (validityDays !== undefined) updates.validityDays = Number(validityDays);
    if (sellingPrice !== undefined) updates.sellingPrice = sellingPrice ? String(sellingPrice) : null;
    if (notes !== undefined) updates.notes = notes || null;
    if (reissue) {
      const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
      let newCode = "";
      for (let i = 0; i < 8; i++) newCode += chars[Math.floor(Math.random() * chars.length)];
      updates.code = newCode;
      updates.status = "active";
      updates.redeemedByBusinessId = null;
      updates.redeemedAt = null;
    }
    const [updated] = await db.update(licenseVouchersTable).set(updates).where(eq(licenseVouchersTable.id, Number(req.params.id))).returning();
    res.json(updated);
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal Server Error" }); }
});

// Permanently delete a cancelled voucher
router.delete("/vouchers/:id", async (req, res) => {
  try {
    const voucher = await db.query.licenseVouchersTable.findFirst({ where: eq(licenseVouchersTable.id, Number(req.params.id)) });
    if (!voucher) { res.status(404).json({ error: "Voucher not found" }); return; }
    if (voucher.status !== "cancelled") { res.status(400).json({ error: "Sirf cancelled vouchers delete ho sakte hain" }); return; }
    await db.delete(licenseVouchersTable).where(eq(licenseVouchersTable.id, Number(req.params.id)));
    res.json({ success: true });
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal Server Error" }); }
});

// Counts per plan+status for folder view
router.get("/vouchers/counts", async (req, res) => {
  try {
    const rows = await db.select({
      planId: licenseVouchersTable.planId,
      planName: plansTable.name,
      status: licenseVouchersTable.status,
      cnt: count(),
    }).from(licenseVouchersTable)
      .leftJoin(plansTable, eq(licenseVouchersTable.planId, plansTable.id))
      .groupBy(licenseVouchersTable.planId, plansTable.name, licenseVouchersTable.status);
    res.json(rows);
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal Server Error" }); }
});

// ─── Super Admin Create (legacy) ─────────────────────────────────────────────

router.post("/create-super-admin", async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) { res.status(400).json({ error: "Name, email, password required" }); return; }
    const passwordHash = await bcrypt.hash(password, 10);
    const [admin] = await db.insert(superAdminsTable).values({ name, email, passwordHash }).returning();
    try { await db.execute(sql`UPDATE super_admins SET plain_password = ${password} WHERE id = ${admin.id}`); } catch { /* non-critical */ }
    res.status(201).json({ id: admin.id, name: admin.name, email: admin.email });
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal Server Error" }); }
});

// ─── All Users Management ─────────────────────────────────────────────────────

router.get("/users", async (req, res) => {
  try {
    const search = (req.query.search as string || "").toLowerCase();
    const statusFilter = req.query.status as string; // "active" | "blocked" | ""
    const bizId = req.query.businessId ? Number(req.query.businessId) : null;
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 50;

    const allUsers = await db.execute(sql`
      SELECT u.id, u.name, u.email, u.role, u.is_active AS "isActive",
             u.last_seen_at AS "lastSeenAt", u.created_at AS "createdAt",
             u.business_id AS "businessId", u.plain_password AS "plainPassword",
             b.name AS "bizName", b.business_code AS "bizCode",
             b.gstin, b.pan, b.phone AS "bizPhone", b.email AS "bizEmail",
             b.status AS "bizStatus", b.plan_id AS "planId",
             b.plan_expires_at AS "planExpiresAt", b.is_trial AS "isTrial"
      FROM users u
      LEFT JOIN businesses b ON b.id = u.business_id
      WHERE u.app_source = 'bizcor'
      ORDER BY u.created_at DESC
    `);
    const allUsersRows = allUsers.rows as any[];

    const allPlans = await db.select().from(plansTable);
    const userCounts = await db.select({ businessId: usersTable.businessId, cnt: count() }).from(usersTable).groupBy(usersTable.businessId);
    const redeemedVouchers = await db.select({ businessId: licenseVouchersTable.redeemedByBusinessId, code: licenseVouchersTable.code })
      .from(licenseVouchersTable).where(sql`${licenseVouchersTable.redeemedByBusinessId} IS NOT NULL`);
    const lastLogins = await db.select({ userId: loginLogsTable.userId, loggedAt: sql<Date>`MAX(${loginLogsTable.createdAt})` })
      .from(loginLogsTable).where(sql`${loginLogsTable.userId} IS NOT NULL`).groupBy(loginLogsTable.userId);

    let enriched = allUsersRows.map((u: any) => {
      const plan = allPlans.find((p: any) => p.id === u.planId) || null;
      return {
        ...u,
        planName: plan?.name || null,
        maxUsers: plan?.maxUsers || null,
        userCount: Number(userCounts.find((c: any) => c.businessId === u.businessId)?.cnt || 0),
        voucherCode: redeemedVouchers.find((v: any) => v.businessId === u.businessId)?.code || null,
        lastLogin: lastLogins.find((l: any) => l.userId === u.id)?.loggedAt || null,
        isExpired: u.planExpiresAt ? new Date(u.planExpiresAt) < new Date() : false,
      };
    });

    if (search) enriched = enriched.filter((u: any) =>
      u.name?.toLowerCase().includes(search) ||
      u.email?.toLowerCase().includes(search) ||
      u.bizName?.toLowerCase().includes(search) ||
      u.bizCode?.toLowerCase().includes(search) ||
      u.gstin?.toLowerCase().includes(search) ||
      u.bizPhone?.includes(search)
    );
    if (statusFilter === "active") enriched = enriched.filter(u => u.isActive);
    if (statusFilter === "blocked") enriched = enriched.filter(u => !u.isActive);
    if (bizId) enriched = enriched.filter(u => u.businessId === bizId);

    const total = enriched.length;
    const data = enriched.slice((page - 1) * limit, page * limit);
    res.json({ data, total, page, limit });
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal Server Error" }); }
});

router.patch("/users/:id/password", async (req, res) => {
  try {
    const { password } = req.body;
    if (!password || password.length < 4) {
      res.status(400).json({ error: "Password kam se kam 4 characters ka hona chahiye" }); return;
    }
    const user = await db.query.usersTable.findFirst({ where: eq(usersTable.id, Number(req.params.id)) });
    if (!user) { res.status(404).json({ error: "User not found" }); return; }
    const passwordHash = await bcrypt.hash(password, 10);
    await db.update(usersTable).set({ passwordHash }).where(eq(usersTable.id, Number(req.params.id)));
    try { await db.execute(sql`UPDATE users SET plain_password = ${password} WHERE id = ${Number(req.params.id)}`); } catch { /* non-critical */ }
    res.json({ success: true, message: `${user.name} ka password reset ho gaya` });
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal Server Error" }); }
});

router.patch("/users/:id/block", async (req, res) => {
  try {
    const user = await db.query.usersTable.findFirst({ where: eq(usersTable.id, Number(req.params.id)) });
    if (!user) { res.status(404).json({ error: "User not found" }); return; }
    const [updated] = await db.update(usersTable).set({ isActive: !user.isActive })
      .where(eq(usersTable.id, Number(req.params.id))).returning();
    res.json({ id: updated.id, isActive: updated.isActive, message: updated.isActive ? `${user.name} ko unblock kar diya` : `${user.name} ko block kar diya` });
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal Server Error" }); }
});

// ─── Data Cleanup ─────────────────────────────────────────────────────────────

router.get("/businesses/:id/parties", async (req, res) => {
  try {
    const bizId = Number(req.params.id);
    const parties = await db
      .select({ id: partiesTable.id, name: partiesTable.name, type: partiesTable.type, phone: partiesTable.phone })
      .from(partiesTable)
      .where(eq(partiesTable.businessId, bizId))
      .orderBy(partiesTable.name);
    res.json(parties);
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal Server Error" }); }
});

// Clear ALL transactions for a business (keeps parties, items, units, tax rates, users)
router.post("/businesses/:id/clear-transactions", async (req, res) => {
  try {
    const bizId = Number(req.params.id);
    const business = await db.query.businessesTable.findFirst({ where: eq(businessesTable.id, bizId) });
    if (!business) { res.status(404).json({ error: "Business not found" }); return; }

    const voucherRows = await db.select({ id: vouchersTable.id }).from(vouchersTable).where(eq(vouchersTable.businessId, bizId));
    const paymentRows = await db.select({ id: paymentsTable.id }).from(paymentsTable).where(eq(paymentsTable.businessId, bizId));
    const vIds = voucherRows.map((v: { id: number }) => v.id);
    const pIds = paymentRows.map((p: { id: number }) => p.id);

    let delVoucherItems = 0, delAllocations = 0, delPayments = 0, delVouchers = 0;

    if (pIds.length > 0) {
      const r = await db.delete(paymentAllocationsTable).where(inArray(paymentAllocationsTable.paymentId, pIds)).returning();
      delAllocations += r.length;
    }
    if (vIds.length > 0) {
      const r1 = await db.delete(paymentAllocationsTable).where(inArray(paymentAllocationsTable.voucherId, vIds)).returning();
      delAllocations += r1.length;
      const r2 = await db.delete(voucherItemsTable).where(inArray(voucherItemsTable.voucherId, vIds)).returning();
      delVoucherItems = r2.length;
    }
    const r3 = await db.delete(paymentsTable).where(eq(paymentsTable.businessId, bizId)).returning();
    delPayments = r3.length;
    const r4 = await db.delete(vouchersTable).where(eq(vouchersTable.businessId, bizId)).returning();
    delVouchers = r4.length;

    req.log.info({ bizId, delVouchers, delVoucherItems, delPayments, delAllocations }, "clear-transactions");
    res.json({ success: true, businessName: business.name, deleted: { vouchers: delVouchers, voucherItems: delVoucherItems, payments: delPayments, paymentAllocations: delAllocations } });
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal Server Error", detail: (err as any).message }); }
});

// Clear transactions for a SPECIFIC party in a business (keeps the party record itself)
router.post("/businesses/:id/clear-party-transactions", async (req, res) => {
  try {
    const bizId = Number(req.params.id);
    const partyId = Number(req.body.partyId);
    if (!partyId) { res.status(400).json({ error: "partyId required" }); return; }

    const business = await db.query.businessesTable.findFirst({ where: eq(businessesTable.id, bizId) });
    if (!business) { res.status(404).json({ error: "Business not found" }); return; }
    const party = await db.query.partiesTable.findFirst({ where: and(eq(partiesTable.id, partyId), eq(partiesTable.businessId, bizId)) });
    if (!party) { res.status(404).json({ error: "Party not found in this business" }); return; }

    const voucherRows = await db.select({ id: vouchersTable.id }).from(vouchersTable)
      .where(and(eq(vouchersTable.businessId, bizId), eq(vouchersTable.partyId, partyId)));
    const paymentRows = await db.select({ id: paymentsTable.id }).from(paymentsTable)
      .where(and(eq(paymentsTable.businessId, bizId), eq(paymentsTable.partyId, partyId)));
    const vIds = voucherRows.map((v: { id: number }) => v.id);
    const pIds = paymentRows.map((p: { id: number }) => p.id);

    let delVoucherItems = 0, delAllocations = 0, delPayments = 0, delVouchers = 0;

    if (pIds.length > 0) {
      const r = await db.delete(paymentAllocationsTable).where(inArray(paymentAllocationsTable.paymentId, pIds)).returning();
      delAllocations += r.length;
    }
    if (vIds.length > 0) {
      const r1 = await db.delete(paymentAllocationsTable).where(inArray(paymentAllocationsTable.voucherId, vIds)).returning();
      delAllocations += r1.length;
      const r2 = await db.delete(voucherItemsTable).where(inArray(voucherItemsTable.voucherId, vIds)).returning();
      delVoucherItems = r2.length;
    }
    const r3 = await db.delete(paymentsTable).where(and(eq(paymentsTable.businessId, bizId), eq(paymentsTable.partyId, partyId))).returning();
    delPayments = r3.length;
    const r4 = await db.delete(vouchersTable).where(and(eq(vouchersTable.businessId, bizId), eq(vouchersTable.partyId, partyId))).returning();
    delVouchers = r4.length;

    req.log.info({ bizId, partyId, delVouchers, delVoucherItems, delPayments, delAllocations }, "clear-party-transactions");
    res.json({ success: true, businessName: business.name, partyName: party.name, deleted: { vouchers: delVouchers, voucherItems: delVoucherItems, payments: delPayments, paymentAllocations: delAllocations } });
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal Server Error", detail: (err as any).message }); }
});

// ─── Login Activity & Active Users ────────────────────────────────────────────

router.get("/login-logs", async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string || "200"), 500);
    const logs = await db.select().from(loginLogsTable)
      .orderBy(desc(loginLogsTable.createdAt))
      .limit(limit);
    res.json(logs);
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal Server Error" }); }
});

router.get("/active-users", async (req, res) => {
  try {
    const cutoff = new Date(Date.now() - 15 * 60 * 1000);
    const users = await db
      .select({
        id: usersTable.id,
        name: usersTable.name,
        email: usersTable.email,
        role: usersTable.role,
        lastSeenAt: usersTable.lastSeenAt,
        businessName: businessesTable.name,
        businessCode: businessesTable.businessCode,
      })
      .from(usersTable)
      .leftJoin(businessesTable, eq(usersTable.businessId, businessesTable.id))
      .where(gte(usersTable.lastSeenAt, cutoff));
    res.json(users);
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal Server Error" }); }
});

// ─── SMART ERP → BizCor Import ───────────────────────────────────────────────

router.post("/import-data", async (req, res) => {
  try {
    const { businessId, customers = [], suppliers = [], items = [] } = req.body as {
      businessId: number;
      customers: Array<{ name: string; phone?: string; address?: string; email?: string; opening_balance?: number }>;
      suppliers: Array<{ name: string; phone?: string; opening_balance?: number }>;
      items: Array<{ name: string; sale_price?: number; purchase_price?: number; opening_stock?: number }>;
    };

    if (!businessId) { res.status(400).json({ error: "businessId required" }); return; }

    // Get default unit and tax rate for this business
    const unitRows = await db.select().from(unitsTable).where(eq(unitsTable.businessId, businessId)).limit(1);
    const taxRows = await db.select().from(taxRatesTable).where(eq(taxRatesTable.businessId, businessId)).limit(1);
    const unitId = unitRows[0]?.id ?? null;
    const taxRateId = taxRows[0]?.id ?? null;

    // Load existing party names (case-insensitive dedupe)
    const existingParties = await db.select({ name: partiesTable.name }).from(partiesTable).where(eq(partiesTable.businessId, businessId));
    const existingPartyNames = new Set(existingParties.map(p => p.name.toLowerCase()));

    // Load existing item names
    const existingItems = await db.select({ name: itemsTable.name }).from(itemsTable).where(eq(itemsTable.businessId, businessId));
    const existingItemNames = new Set(existingItems.map(i => i.name.toLowerCase()));

    const custResult = { imported: 0, skipped: 0, errors: 0, errorDetails: [] as string[] };
    const supResult  = { imported: 0, skipped: 0, errors: 0, errorDetails: [] as string[] };
    const itemResult = { imported: 0, skipped: 0, errors: 0, errorDetails: [] as string[] };

    // Import customers
    for (const c of customers) {
      const name = String(c.name || "").trim();
      if (!name) { custResult.skipped++; continue; }
      if (existingPartyNames.has(name.toLowerCase())) { custResult.skipped++; continue; }
      try {
        await db.insert(partiesTable).values({
          businessId,
          name,
          type: "customer",
          phone: String(c.phone || "").trim(),
          address: String(c.address || "").trim(),
          email: String(c.email || "").trim(),
          openingBalance: String(c.opening_balance ?? 0),
          gstin: "",
          stateCode: "",
        });
        existingPartyNames.add(name.toLowerCase());
        custResult.imported++;
      } catch (e: any) {
        custResult.errors++;
        custResult.errorDetails.push(`${name}: ${String(e.message).slice(0, 60)}`);
      }
    }

    // Import suppliers
    for (const s of suppliers) {
      const name = String(s.name || "").trim();
      if (!name) { supResult.skipped++; continue; }
      if (existingPartyNames.has(name.toLowerCase())) { supResult.skipped++; continue; }
      try {
        await db.insert(partiesTable).values({
          businessId,
          name,
          type: "supplier",
          phone: String(s.phone || "").trim(),
          address: "",
          email: "",
          openingBalance: String(s.opening_balance ?? 0),
          gstin: "",
          stateCode: "",
        });
        existingPartyNames.add(name.toLowerCase());
        supResult.imported++;
      } catch (e: any) {
        supResult.errors++;
        supResult.errorDetails.push(`${name}: ${String(e.message).slice(0, 60)}`);
      }
    }

    // Import items
    for (const it of items) {
      const name = String(it.name || "").trim();
      if (!name) { itemResult.skipped++; continue; }
      if (existingItemNames.has(name.toLowerCase())) { itemResult.skipped++; continue; }
      try {
        await db.insert(itemsTable).values({
          businessId,
          name,
          type: "goods",
          unitId,
          taxRateId,
          salePrice: String(it.sale_price ?? 0),
          purchasePrice: String(it.purchase_price ?? 0),
          openingStock: String(it.opening_stock ?? 0),
          hsnCode: "",
          description: "",
        });
        existingItemNames.add(name.toLowerCase());
        itemResult.imported++;
      } catch (e: any) {
        itemResult.errors++;
        itemResult.errorDetails.push(`${name}: ${String(e.message).slice(0, 60)}`);
      }
    }

    res.json({ customers: custResult, suppliers: supResult, items: itemResult });
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal Server Error" }); }
});

export default router;
