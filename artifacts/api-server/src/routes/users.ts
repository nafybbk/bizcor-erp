import { Router } from "express";
import bcrypt from "bcryptjs";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";
import { requireBusiness } from "../middlewares/auth";

const router = Router();
router.use(requireBusiness);

// Lazy migration: ensure can_edit, can_delete, login_pin columns exist
// SQLite does not support IF NOT EXISTS on ALTER TABLE — add each column separately and catch duplicate errors
async function ensureRightsCols() {
  const isSQLite = !!process.env.SQLITE_PATH;
  const colDefs = isSQLite
    ? ["can_edit INTEGER NOT NULL DEFAULT 1", "can_delete INTEGER NOT NULL DEFAULT 1", "login_pin TEXT"]
    : ["can_edit BOOLEAN NOT NULL DEFAULT TRUE", "can_delete BOOLEAN NOT NULL DEFAULT TRUE", "login_pin TEXT"];

  for (const col of colDefs) {
    try {
      if (isSQLite) {
        await db.execute(sql.raw(`ALTER TABLE users ADD COLUMN ${col}`));
      } else {
        await db.execute(sql.raw(`ALTER TABLE users ADD COLUMN IF NOT EXISTS ${col}`));
      }
    } catch { /* column already exists — OK */ }
  }
}

router.get("/", async (req, res) => {
  try {
    const biz = req.user!.businessId!;
    await ensureRightsCols();
    const rows: any[] = await db.execute(sql`
      SELECT id, name, email, role, permissions, is_active AS "isActive", created_at AS "createdAt",
             COALESCE(can_edit, TRUE) AS "canEdit",
             COALESCE(can_delete, TRUE) AS "canDelete",
             CASE WHEN login_pin IS NOT NULL AND login_pin != '' THEN TRUE ELSE FALSE END AS "hasPin"
      FROM users WHERE business_id = ${biz}
      ORDER BY created_at ASC
    `).then((r: any) => r.rows ?? r);

    const users = rows.map(u => ({
      ...u,
      permissions: Array.isArray(u.permissions) ? u.permissions : (u.permissions ? JSON.parse(u.permissions) : []),
      canEdit: u.canEdit !== false,
      canDelete: u.canDelete !== false,
    }));

    res.json({ data: users });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.post("/", async (req, res) => {
  try {
    await ensureRightsCols();
    const { name, email, password, role, permissions, loginPin, canEdit, canDelete } = req.body;
    if (!name || !email || !password) {
      res.status(400).json({ error: "Bad Request", message: "Name, email and password required" });
      return;
    }
    const passwordHash = await bcrypt.hash(password, 10);
    // Use Drizzle insert — handles boolean/JSON types correctly for both PG and SQLite
    await db.insert(usersTable).values({
      businessId: req.user!.businessId!,
      name,
      email: email.toLowerCase().trim(),
      passwordHash,
      role: role || "staff",
      permissions: permissions || [],
      loginPin: loginPin || null,
      canEdit: canEdit !== false,
      canDelete: canDelete !== false,
    });
    // Store plain password via raw SQL (column may not be in Drizzle schema)
    try {
      await db.execute(sql`UPDATE users SET plain_password = ${password} WHERE email = ${email.toLowerCase().trim()} AND business_id = ${req.user!.businessId!}`);
    } catch { /* non-fatal */ }
    res.status(201).json({ success: true });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal Server Error" });
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
    await ensureRightsCols();
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
      await db.execute(sql`UPDATE users SET plain_password = ${password} WHERE id = ${id} AND business_id = ${biz}`);
    }
    if (Object.keys(updateData).length > 0) {
      await db.update(usersTable).set(updateData)
        .where(and(eq(usersTable.id, id), eq(usersTable.businessId, biz)));
    }
    // Handle loginPin — ensureRightsCols() above already handles login_pin column creation
    if (loginPin !== undefined) {
      await db.execute(sql`UPDATE users SET login_pin = ${loginPin || null} WHERE id = ${id} AND business_id = ${biz}`);
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
