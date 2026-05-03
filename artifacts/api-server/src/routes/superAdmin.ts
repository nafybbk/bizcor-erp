import { Router } from "express";
import bcrypt from "bcryptjs";
import { db } from "@workspace/db";
import { superAdminsTable, businessesTable, plansTable, usersTable, appSettingsTable, vouchersTable, partiesTable, itemsTable, paymentsTable } from "@workspace/db";
import { eq, count, sql, ilike, and } from "drizzle-orm";
import { requireSuperAdmin } from "../middlewares/auth";

const router = Router();
router.use(requireSuperAdmin);

// ─── App Settings ────────────────────────────────────────────────────────────

router.get("/settings", async (req, res) => {
  try {
    const rows = await db.select().from(appSettingsTable);
    const settings: Record<string, string> = {};
    for (const row of rows) settings[row.key] = row.value || "";
    const defaults = { softwareName: "BizERP", supportEmail: "", supportPhone: "", logoUrl: "", primaryColor: "#2563eb", footerText: "Powered by BizERP" };
    res.json({ ...defaults, ...settings });
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal Server Error" }); }
});

router.post("/settings", async (req, res) => {
  try {
    const allowed = ["softwareName", "supportEmail", "supportPhone", "logoUrl", "primaryColor", "footerText"];
    for (const key of allowed) {
      if (req.body[key] !== undefined) {
        await db.insert(appSettingsTable).values({ key, value: String(req.body[key]) })
          .onConflictDoUpdate({ target: appSettingsTable.key, set: { value: String(req.body[key]), updatedAt: new Date() } });
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
    const [newThisMonth] = await db.select({ count: count() }).from(businessesTable).where(sql`${businessesTable.createdAt} >= ${thisMonth}`);
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
    const conditions = [];
    if (search) conditions.push(ilike(businessesTable.name, `%${search}%`));
    if (status) conditions.push(eq(businessesTable.status, status as any));
    const [{ total }] = await db.select({ total: count() }).from(businessesTable).where(conditions.length ? and(...conditions) : undefined);
    const businesses = await db.select().from(businessesTable).where(conditions.length ? and(...conditions) : undefined)
      .limit(limit).offset((page - 1) * limit).orderBy(sql`${businessesTable.createdAt} desc`);
    const userCounts = await db.select({ businessId: usersTable.businessId, cnt: count() }).from(usersTable).groupBy(usersTable.businessId);
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

router.patch("/businesses/:id", async (req, res) => {
  try {
    const { status, planId, isTrial, planExpiresAt, planStartDate } = req.body;
    const updateData: Record<string, unknown> = {};
    if (status) updateData.status = status;
    if (planId !== undefined) updateData.planId = planId ? Number(planId) : null;
    if (isTrial !== undefined) updateData.isTrial = isTrial;
    if (planExpiresAt !== undefined) updateData.planExpiresAt = planExpiresAt ? new Date(planExpiresAt) : null;
    if (planStartDate !== undefined) updateData.planStartDate = planStartDate ? new Date(planStartDate) : null;
    const [updated] = await db.update(businessesTable).set(updateData).where(eq(businessesTable.id, Number(req.params.id))).returning();
    res.json(updated);
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
    const { name, description, price, billingCycle, maxUsers, trialDays, validityDays, features, sortOrder } = req.body;
    const [plan] = await db.insert(plansTable).values({
      name, description, price: String(price || 0),
      billingCycle: billingCycle || "monthly",
      maxUsers: maxUsers || 5,
      trialDays: trialDays || 0,
      validityDays: validityDays || 30,
      features: features || [],
      sortOrder: sortOrder || 0,
    }).returning();
    res.status(201).json({ ...plan, price: Number(plan.price) });
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal Server Error" }); }
});

router.patch("/plans/:id", async (req, res) => {
  try {
    const { name, description, price, billingCycle, maxUsers, trialDays, validityDays, features, isActive, sortOrder } = req.body;
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

// ─── Super Admin Create ───────────────────────────────────────────────────────

router.post("/create-super-admin", async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) { res.status(400).json({ error: "Name, email, password required" }); return; }
    const passwordHash = await bcrypt.hash(password, 10);
    const [admin] = await db.insert(superAdminsTable).values({ name, email, passwordHash }).returning();
    res.status(201).json({ id: admin.id, name: admin.name, email: admin.email });
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal Server Error" }); }
});

export default router;
