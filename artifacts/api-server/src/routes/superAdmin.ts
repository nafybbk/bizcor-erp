import { Router } from "express";
import bcrypt from "bcryptjs";
import { db } from "@workspace/db";
import { superAdminsTable, businessesTable, plansTable, usersTable } from "@workspace/db";
import { eq, count, sql, ilike, and } from "drizzle-orm";
import { requireSuperAdmin } from "../middlewares/auth";

const router = Router();
router.use(requireSuperAdmin);

router.get("/stats", async (req, res) => {
  try {
    const [totalBusinesses] = await db.select({ count: count() }).from(businessesTable);
    const [activeBusinesses] = await db.select({ count: count() }).from(businessesTable).where(eq(businessesTable.status, "active"));
    const [totalUsers] = await db.select({ count: count() }).from(usersTable);
    const plans = await db.select({
      planId: businessesTable.planId,
      cnt: count(),
    }).from(businessesTable).groupBy(businessesTable.planId);
    const allPlans = await db.select().from(plansTable);
    const planBreakdown = plans.map(p => ({
      planName: allPlans.find(pl => pl.id === p.planId)?.name || "No Plan",
      count: Number(p.cnt),
    }));
    res.json({
      totalBusinesses: Number(totalBusinesses.count),
      activeBusinesses: Number(activeBusinesses.count),
      totalUsers: Number(totalUsers.count),
      newBusinessesThisMonth: 0,
      totalSalesThisMonth: 0,
      planBreakdown,
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.get("/businesses", async (req, res) => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;
    const search = req.query.search as string;
    const status = req.query.status as string;
    let query = db.select().from(businessesTable);
    const conditions = [];
    if (search) conditions.push(ilike(businessesTable.name, `%${search}%`));
    if (status) conditions.push(eq(businessesTable.status, status as "active" | "inactive" | "suspended"));
    const [{ total }] = await db.select({ total: count() }).from(businessesTable)
      .where(conditions.length ? and(...conditions) : undefined);
    const businesses = await db.select().from(businessesTable)
      .where(conditions.length ? and(...conditions) : undefined)
      .limit(limit).offset((page - 1) * limit)
      .orderBy(sql`${businessesTable.createdAt} desc`);
    const userCounts = await db.select({ businessId: usersTable.businessId, cnt: count() })
      .from(usersTable).groupBy(usersTable.businessId);
    const data = businesses.map(b => ({
      ...b, price: undefined,
      userCount: userCounts.find(u => u.businessId === b.id)?.cnt || 0,
    }));
    res.json({ data, total: Number(total), page, limit });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.get("/businesses/:id", async (req, res) => {
  try {
    const business = await db.query.businessesTable.findFirst({ where: eq(businessesTable.id, Number(req.params.id)) });
    if (!business) { res.status(404).json({ error: "Not Found" }); return; }
    res.json(business);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.patch("/businesses/:id", async (req, res) => {
  try {
    const { status, planId } = req.body;
    const updateData: Record<string, unknown> = {};
    if (status) updateData.status = status;
    if (planId) updateData.planId = planId;
    const [updated] = await db.update(businessesTable).set(updateData).where(eq(businessesTable.id, Number(req.params.id))).returning();
    res.json(updated);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.get("/plans", async (req, res) => {
  try {
    const plans = await db.select().from(plansTable).orderBy(plansTable.price);
    res.json({ data: plans });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.post("/plans", async (req, res) => {
  try {
    const { name, description, price, billingCycle, maxUsers, features } = req.body;
    const [plan] = await db.insert(plansTable).values({ name, description, price: String(price), billingCycle: billingCycle || "monthly", maxUsers: maxUsers || 5, features }).returning();
    res.status(201).json(plan);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

export default router;
