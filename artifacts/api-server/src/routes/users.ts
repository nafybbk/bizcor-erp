import { Router } from "express";
import bcrypt from "bcryptjs";
import { db, sqlite } from "@workspace/db";
import { usersTable, plansTable, businessesTable } from "@workspace/db";
import { eq, and, sql, count } from "drizzle-orm";
import { requireBusiness } from "../middlewares/auth";
import { logActivity } from "../lib/activityLog";

// Helper: get plan-based user limit for a business
async function getPlanLimit(businessId: number): Promise<{ maxUsers: number; label: string }> {
  const [biz] = await db.select({
    id: businessesTable.id,
    planId: businessesTable.planId,
    isTrial: businessesTable.isTrial,
  }).from(businessesTable).where(eq(businessesTable.id, businessId));
  if (!biz) return { maxUsers: 2, label: "Free" };
  if (biz.planId) {
    const [plan] = await db.select({ maxUsers: plansTable.maxUsers, name: plansTable.name })
      .from(plansTable).where(eq(plansTable.id, biz.planId));
    return { maxUsers: plan?.maxUsers ?? 2, label: plan?.name ?? "Paid" };
  }
  if (biz.isTrial) return { maxUsers: 3, label: "Trial" };
  return { maxUsers: 2, label: "Free" };
}

const router = Router();
router.use(requireBusiness);

// Lazy migration: ensure extra columns exist — run once per server start
let _rightColsDone = false;
let _rightColsPromise: Promise<void> | null = null;

async function ensureRightsCols(): Promise<void> {
  if (_rightColsDone) return;
  if (_rightColsPromise) return _rightColsPromise;

  const isSQLite = !!process.env.SQLITE_PATH;

  if (isSQLite && sqlite) {
    // users table columns
    const userCols = [
      "can_edit INTEGER NOT NULL DEFAULT 1",
      "can_delete INTEGER NOT NULL DEFAULT 1",
      "login_pin TEXT",
      "plain_password TEXT",
    ];
    for (const col of userCols) {
      try { sqlite.exec(`ALTER TABLE users ADD COLUMN ${col}`); } catch { /* already exists */ }
    }
    // businesses table columns (added in later versions)
    const bizCols = [
      "package_config TEXT",
      "logo TEXT",
    ];
    for (const col of bizCols) {
      try { sqlite.exec(`ALTER TABLE businesses ADD COLUMN ${col}`); } catch { /* already exists */ }
    }
    _rightColsDone = true;
  } else {
    // PostgreSQL — await so columns exist before SELECT
    const cols = [
      "can_edit BOOLEAN NOT NULL DEFAULT TRUE",
      "can_delete BOOLEAN NOT NULL DEFAULT TRUE",
      "login_pin TEXT",
      "plain_password TEXT",
    ];
    _rightColsPromise = Promise.all(cols.map(col =>
      db.execute(sql.raw(`ALTER TABLE users ADD COLUMN IF NOT EXISTS ${col}`)).catch(() => {})
    )).then(() => { _rightColsDone = true; _rightColsPromise = null; }).catch(() => {});
    return _rightColsPromise;
  }
}

router.get("/", async (req, res) => {
  try {
    const biz = req.user!.businessId!;
    await ensureRightsCols();

    // Get plan limit
    const planLimit = await getPlanLimit(biz);

    // Use Drizzle db.select() — works for both SQLite and PostgreSQL
    const rows = await db.select({
      id: usersTable.id,
      name: usersTable.name,
      email: usersTable.email,
      role: usersTable.role,
      permissions: usersTable.permissions,
      isActive: usersTable.isActive,
      canEdit: usersTable.canEdit,
      canDelete: usersTable.canDelete,
      loginPin: usersTable.loginPin,
      createdAt: usersTable.createdAt,
    }).from(usersTable).where(eq(usersTable.businessId, biz));

    const users = rows.map((u: any) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      isActive: u.isActive === 1 || u.isActive === true,
      canEdit: u.canEdit !== 0 && u.canEdit !== false && u.canEdit !== "0",
      canDelete: u.canDelete !== 0 && u.canDelete !== false && u.canDelete !== "0",
      hasPin: !!(u.loginPin && u.loginPin !== ""),
      createdAt: u.createdAt,
      permissions: Array.isArray(u.permissions)
        ? u.permissions
        : (u.permissions ? (() => { try { return JSON.parse(u.permissions); } catch { return []; } })() : []),
    }));

    // Mark users beyond plan limit as overLimit
    // Admin always gets slot 1; remaining slots go to staff sorted by createdAt
    const admins = users.filter(u => u.role === "business_admin");
    const staff = users.filter(u => u.role !== "business_admin")
      .sort((a, b) => new Date(a.createdAt ?? 0).getTime() - new Date(b.createdAt ?? 0).getTime());

    const allSorted = [...admins, ...staff];
    const usersWithLimit = allSorted.map((u, idx) => ({
      ...u,
      overLimit: idx >= planLimit.maxUsers,
    }));

    res.json({
      data: usersWithLimit,
      planInfo: {
        maxUsers: planLimit.maxUsers,
        label: planLimit.label,
        currentCount: users.length,
        canAddMore: users.length < planLimit.maxUsers,
      },
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.post("/", async (req, res) => {
  try {
    ensureRightsCols();
    const { name, email, password, role, permissions, loginPin, canEdit, canDelete } = req.body;
    if (!name) {
      res.status(400).json({ error: "Bad Request", message: "Name required" });
      return;
    }
    const biz = req.user!.businessId!;

    // ── PLAN LIMIT CHECK ─────────────────────────────────────────────────────
    const planLimit = await getPlanLimit(biz);
    const [{ total: currentCount }] = await db.select({ total: count() })
      .from(usersTable).where(eq(usersTable.businessId, biz));
    if (Number(currentCount) >= planLimit.maxUsers) {
      res.status(403).json({
        error: "Plan Limit Reached",
        message: `Plan limit puri ho gayi. ${planLimit.label} plan mein max ${planLimit.maxUsers} users allowed hain. Plan upgrade karein.`,
      });
      return;
    }

    // If email/password not provided, copy from the current logged-in admin user
    let finalEmail = email?.trim().toLowerCase();
    let passwordHash: string;

    if (!finalEmail || !password) {
      // Fetch admin user of this business
      const [adminUser] = await db.select().from(usersTable)
        .where(and(eq(usersTable.businessId, biz), eq(usersTable.role, "business_admin")));
      if (!finalEmail) finalEmail = adminUser?.email || req.user!.email!;
      if (!password) {
        passwordHash = adminUser?.passwordHash || await bcrypt.hash("changeme", 10);
      } else {
        passwordHash = await bcrypt.hash(password, 10);
      }
    } else {
      passwordHash = await bcrypt.hash(password, 10);
    }

    await db.insert(usersTable).values({
      businessId: biz,
      name,
      email: finalEmail,
      passwordHash,
      role: role || "staff",
      permissions: permissions || [],
      loginPin: loginPin || null,
      canEdit: canEdit !== false,
      canDelete: canDelete !== false,
    });

    // Store plain password (non-fatal — column ensured above)
    try {
      if (password && sqlite) {
        sqlite.prepare("UPDATE users SET plain_password = ? WHERE email = ? AND business_id = ?")
          .run(password, finalEmail, biz);
      } else if (password) {
        await db.execute(sql`UPDATE users SET plain_password = ${password} WHERE email = ${finalEmail} AND business_id = ${biz}`);
      }
    } catch { /* non-fatal */ }

    logActivity(req, {
      action: "created", entityType: "user", entityLabel: name,
      summary: `User "${name}" (${role || "staff"}) add kiya`,
    });
    res.status(201).json({ success: true });
  } catch (err: any) {
    req.log.error(err);
    // Friendly duplicate email error
    if (err?.message?.includes("UNIQUE") || err?.code === "23505") {
      res.status(409).json({ error: "Conflict", message: "Is email se pehle se user hai" });
      return;
    }
    res.status(500).json({ error: "Internal Server Error", message: err?.message });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const [user] = await db.select().from(usersTable)
      .where(and(eq(usersTable.id, Number(req.params.id)), eq(usersTable.businessId, req.user!.businessId!)));
    if (!user) { res.status(404).json({ error: "Not Found" }); return; }
    const { passwordHash, ...safeUser } = user;
    res.json(safeUser);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.patch("/:id", async (req, res) => {
  try {
    ensureRightsCols();
    const { name, email, role, permissions, isActive, password, loginPin, canEdit, canDelete } = req.body;
    const id = Number(req.params.id);
    const biz = req.user!.businessId!;

    const updateData: Record<string, unknown> = {};
    if (name !== undefined)        updateData.name = name;
    if (email !== undefined && email.trim()) updateData.email = email.trim().toLowerCase();
    if (role !== undefined)        updateData.role = role;
    if (permissions !== undefined) updateData.permissions = permissions;
    if (isActive !== undefined)    updateData.isActive = isActive;
    if (canEdit !== undefined)     updateData.canEdit = canEdit !== false;
    if (canDelete !== undefined)   updateData.canDelete = canDelete !== false;

    if (password) {
      updateData.passwordHash = await bcrypt.hash(password, 10);
      try {
        if (sqlite) {
          sqlite.prepare("UPDATE users SET plain_password = ? WHERE id = ? AND business_id = ?").run(password, id, biz);
        } else {
          await db.execute(sql`UPDATE users SET plain_password = ${password} WHERE id = ${id} AND business_id = ${biz}`);
        }
      } catch { /* non-fatal */ }
    }

    if (Object.keys(updateData).length > 0) {
      await db.update(usersTable).set(updateData)
        .where(and(eq(usersTable.id, id), eq(usersTable.businessId, biz)));
    }

    if (loginPin !== undefined) {
      try {
        if (sqlite) {
          sqlite.prepare("UPDATE users SET login_pin = ? WHERE id = ? AND business_id = ?").run(loginPin || null, id, biz);
        } else {
          await db.execute(sql`UPDATE users SET login_pin = ${loginPin || null} WHERE id = ${id} AND business_id = ${biz}`);
        }
      } catch { /* non-fatal */ }
    }

    logActivity(req, {
      action: "edited", entityType: "user", entityId: id, entityLabel: name || String(id),
      summary: `User "${name || id}" ki settings badli — ${[...Object.keys(updateData), ...(password ? ["password"] : []), ...(loginPin !== undefined ? ["loginPin"] : [])].join(", ")}`,
    });
    res.json({ success: true });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const [deleted] = await db.delete(usersTable).where(and(eq(usersTable.id, Number(req.params.id)), eq(usersTable.businessId, req.user!.businessId!))).returning();
    if (deleted) {
      logActivity(req, {
        action: "deleted", entityType: "user", entityId: deleted.id, entityLabel: deleted.name,
        summary: `User "${deleted.name}" delete kiya`,
      });
    }
    res.json({ success: true });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

export default router;
