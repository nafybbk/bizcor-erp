import { Router, Request, Response, NextFunction } from "express";
import { db } from "@workspace/db";
import { activityLogsTable, businessesTable } from "@workspace/db";
import { eq, and, gte, lte, desc, sql, inArray, or } from "drizzle-orm";
import { requireBusiness } from "../middlewares/auth";
import { ilike } from "../lib/search";

// Activity trail — the malik's own record of who did what in his shop.
// View AND clear are business_admin only: staff must never see it (half the
// value is the owner supervising staff edits) and must never clear their own
// tracks. Clearing is final — no shadow copies, per product philosophy.
const router = Router();
router.use(requireBusiness);

function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  if (req.user?.role !== "business_admin" && req.user?.role !== "super_admin") {
    res.status(403).json({ error: "Forbidden", message: "Sirf Admin activity dekh sakta hai" });
    return;
  }
  next();
}
router.use(requireAdmin);

// Auto-cleanup per the business's retention setting (NULL = keep forever).
// Ran lazily when the admin opens the page — cheap and good enough.
async function applyRetention(businessId: number): Promise<void> {
  try {
    const biz = await db.query.businessesTable.findFirst({ where: eq(businessesTable.id, businessId) });
    const days = (biz as any)?.activityRetentionDays;
    if (!days || days < 1) return;
    await db.delete(activityLogsTable).where(and(
      eq(activityLogsTable.businessId, businessId),
      sql`${activityLogsTable.createdAt} < now() - make_interval(days => ${Number(days)})`,
    ));
  } catch { /* non-fatal */ }
}

// GET /activity — filtered list
router.get("/", async (req, res) => {
  try {
    const businessId = req.user!.businessId!;
    await applyRetention(businessId);

    const { from, to, userId, entityType, action, search, page = "1", limit = "50" } = req.query;
    const conditions: any[] = [eq(activityLogsTable.businessId, businessId)];
    if (from) conditions.push(gte(activityLogsTable.createdAt, new Date(`${from}T00:00:00`)));
    if (to) conditions.push(lte(activityLogsTable.createdAt, new Date(`${to}T23:59:59`)));
    if (userId) conditions.push(eq(activityLogsTable.userId, Number(userId)));
    if (entityType) conditions.push(eq(activityLogsTable.entityType, String(entityType)));
    if (action) conditions.push(eq(activityLogsTable.action, String(action)));
    if (search) conditions.push(or(
      ilike(activityLogsTable.summary, String(search)),
      ilike(activityLogsTable.entityLabel, String(search)),
    )!);

    const lim = Math.min(Number(limit) || 50, 200);
    const offset = (Math.max(Number(page) || 1, 1) - 1) * lim;

    const [rows, [{ total }]] = await Promise.all([
      db.select({
        id: activityLogsTable.id,
        userId: activityLogsTable.userId,
        userName: activityLogsTable.userName,
        action: activityLogsTable.action,
        entityType: activityLogsTable.entityType,
        entityId: activityLogsTable.entityId,
        entityLabel: activityLogsTable.entityLabel,
        summary: activityLogsTable.summary,
        hasSnapshot: sql<boolean>`(${activityLogsTable.details} -> 'before') IS NOT NULL`,
        createdAt: activityLogsTable.createdAt,
      }).from(activityLogsTable)
        .where(and(...conditions))
        .orderBy(desc(activityLogsTable.createdAt))
        .limit(lim).offset(offset),
      db.select({ total: sql<number>`count(*)` }).from(activityLogsTable).where(and(...conditions)),
    ]);

    res.json({ data: rows, total: Number(total), page: Number(page), limit: lim });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// GET /activity/:id/snapshot — full before-snapshot for one entry
router.get("/:id/snapshot", async (req, res) => {
  try {
    const businessId = req.user!.businessId!;
    const [row] = await db.select().from(activityLogsTable)
      .where(and(eq(activityLogsTable.id, Number(req.params.id)), eq(activityLogsTable.businessId, businessId)));
    if (!row) { res.status(404).json({ error: "Not Found" }); return; }
    res.json({ id: row.id, summary: row.summary, createdAt: row.createdAt, userName: row.userName, details: row.details });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// GET /activity/entity/voucher/:id — history entries for one voucher (History tab)
router.get("/entity/:type/:id", async (req, res) => {
  try {
    const businessId = req.user!.businessId!;
    const rows = await db.select({
      id: activityLogsTable.id,
      userName: activityLogsTable.userName,
      action: activityLogsTable.action,
      summary: activityLogsTable.summary,
      hasSnapshot: sql<boolean>`(${activityLogsTable.details} -> 'before') IS NOT NULL`,
      createdAt: activityLogsTable.createdAt,
    }).from(activityLogsTable)
      .where(and(
        eq(activityLogsTable.businessId, businessId),
        eq(activityLogsTable.entityType, String(req.params.type)),
        eq(activityLogsTable.entityId, Number(req.params.id)),
      ))
      .orderBy(desc(activityLogsTable.createdAt));
    res.json(rows);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// POST /activity/clear — admin clear: selected ids, everything before a date, or all
router.post("/clear", async (req, res) => {
  try {
    const businessId = req.user!.businessId!;
    const { ids, before, all } = req.body || {};
    const conditions: any[] = [eq(activityLogsTable.businessId, businessId)];

    if (Array.isArray(ids) && ids.length > 0) {
      conditions.push(inArray(activityLogsTable.id, ids.map(Number)));
    } else if (before) {
      conditions.push(lte(activityLogsTable.createdAt, new Date(`${before}T23:59:59`)));
    } else if (all !== true) {
      res.status(400).json({ error: "Bad Request", message: "ids, before date, ya all=true bhejo" });
      return;
    }

    const deleted = await db.delete(activityLogsTable).where(and(...conditions)).returning({ id: activityLogsTable.id });
    res.json({ success: true, cleared: deleted.length });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// GET/PATCH /activity/retention — optional auto-cleanup setting
router.get("/settings/retention", async (req, res) => {
  try {
    const biz = await db.query.businessesTable.findFirst({ where: eq(businessesTable.id, req.user!.businessId!) });
    res.json({ retentionDays: (biz as any)?.activityRetentionDays ?? null });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.patch("/settings/retention", async (req, res) => {
  try {
    const days = req.body?.retentionDays;
    const value = days === null || days === "" || days === undefined ? null : Math.max(1, Number(days) || 0) || null;
    await db.update(businessesTable)
      .set({ activityRetentionDays: value } as any)
      .where(eq(businessesTable.id, req.user!.businessId!));
    res.json({ success: true, retentionDays: value });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

export default router;
