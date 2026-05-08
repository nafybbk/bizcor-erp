import { Router } from "express";
import bcrypt from "bcryptjs";
import { db, sqlite } from "@workspace/db";
import { usersTable } from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";
import { requireBusiness } from "../middlewares/auth";

const router = Router();
router.use(requireBusiness);

// Lazy migration: ensure extra columns exist — run once per server start
let _rightColsDone = false;
function ensureRightsCols() {
  if (_rightColsDone) return;
  const isSQLite = !!process.env.SQLITE_PATH;

  if (isSQLite && sqlite) {
    // Use raw better-sqlite3 connection for DDL — synchronous, always reliable
    const cols = [
      "can_edit INTEGER NOT NULL DEFAULT 1",
      "can_delete INTEGER NOT NULL DEFAULT 1",
      "login_pin TEXT",
      "plain_password TEXT",
    ];
    for (const col of cols) {
      try { sqlite.exec(`ALTER TABLE users ADD COLUMN ${col}`); } catch { /* already exists */ }
    }
    _rightColsDone = true;
  } else {
    // PostgreSQL — run async but don't await (fire-and-forget on first call)
    const cols = [
      "can_edit BOOLEAN NOT NULL DEFAULT TRUE",
      "can_delete BOOLEAN NOT NULL DEFAULT TRUE",
      "login_pin TEXT",
      "plain_password TEXT",
    ];
    Promise.all(cols.map(col =>
      db.execute(sql.raw(`ALTER TABLE users ADD COLUMN IF NOT EXISTS ${col}`)).catch(() => {})
    )).then(() => { _rightColsDone = true; }).catch(() => {});
  }
}

router.get("/", async (req, res) => {
  try {
    const biz = req.user!.businessId!;
    ensureRightsCols();

    const isSQLite = !!process.env.SQLITE_PATH;

    // db.execute() doesn't exist in SQLite (BetterSQLite3Database) — use raw sqlite for SQLite, db.execute for PG
    let rows: any[];
    if (isSQLite && sqlite) {
      rows = sqlite.prepare(`
        SELECT id, name, email, role, permissions,
               is_active AS isActive,
               created_at AS createdAt,
               COALESCE(can_edit, 1) AS canEdit,
               COALESCE(can_delete, 1) AS canDelete,
               CASE WHEN login_pin IS NOT NULL AND login_pin != '' THEN 1 ELSE 0 END AS hasPin
        FROM users WHERE business_id = ?
        ORDER BY created_at ASC
      `).all(biz) as any[];
    } else {
      rows = await (db as any).execute(sql`
        SELECT id, name, email, role, permissions,
               is_active AS isActive,
               created_at AS createdAt,
               COALESCE(can_edit, 1) AS canEdit,
               COALESCE(can_delete, 1) AS canDelete,
               CASE WHEN login_pin IS NOT NULL AND login_pin != '' THEN 1 ELSE 0 END AS hasPin
        FROM users WHERE business_id = ${biz}
        ORDER BY created_at ASC
      `).then((r: any) => {
        if (Array.isArray(r)) return r;
        if (Array.isArray(r?.rows)) return r.rows;
        return [];
      });
    }

    const users = rows.map((u: any) => ({
      ...u,
      isActive: u.isActive === 1 || u.isActive === true || u["isActive"] === 1,
      permissions: Array.isArray(u.permissions)
        ? u.permissions
        : (u.permissions ? (() => { try { return JSON.parse(u.permissions); } catch { return []; } })() : []),
      canEdit: u.canEdit !== 0 && u.canEdit !== false && u.canEdit !== "0",
      canDelete: u.canDelete !== 0 && u.canDelete !== false && u.canDelete !== "0",
      hasPin: u.hasPin === 1 || u.hasPin === true || u.hasPin === "1",
    }));

    res.json({ data: users });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.post("/", async (req, res) => {
  try {
    ensureRightsCols();
    const { name, email, password, role, permissions, loginPin, canEdit, canDelete } = req.body;
    if (!name || !email || !password) {
      res.status(400).json({ error: "Bad Request", message: "Name, email and password required" });
      return;
    }
    const biz = req.user!.businessId!;
    const passwordHash = await bcrypt.hash(password, 10);

    await db.insert(usersTable).values({
      businessId: biz,
      name,
      email: email.toLowerCase().trim(),
      passwordHash,
      role: role || "staff",
      permissions: permissions || [],
      loginPin: loginPin || null,
      canEdit: canEdit !== false,
      canDelete: canDelete !== false,
    });

    // Store plain password (non-fatal — column ensured above)
    try {
      const emailClean = email.toLowerCase().trim();
      if (sqlite) {
        sqlite.prepare("UPDATE users SET plain_password = ? WHERE email = ? AND business_id = ?")
          .run(password, emailClean, biz);
      } else {
        await db.execute(sql`UPDATE users SET plain_password = ${password} WHERE email = ${emailClean} AND business_id = ${biz}`);
      }
    } catch { /* non-fatal */ }

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
    const user = await db.query.usersTable.findFirst({
      where: and(eq(usersTable.id, Number(req.params.id)), eq(usersTable.businessId, req.user!.businessId!)),
    });
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
    const { name, role, permissions, isActive, password, loginPin, canEdit, canDelete } = req.body;
    const id = Number(req.params.id);
    const biz = req.user!.businessId!;

    const updateData: Record<string, unknown> = {};
    if (name !== undefined)        updateData.name = name;
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

    res.json({ success: true });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    await db.delete(usersTable).where(and(eq(usersTable.id, Number(req.params.id)), eq(usersTable.businessId, req.user!.businessId!)));
    res.json({ success: true });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

export default router;
