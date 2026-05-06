import { Router } from "express";
import bcrypt from "bcryptjs";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";
import { requireBusiness } from "../middlewares/auth";

const router = Router();
router.use(requireBusiness);

router.get("/", async (req, res) => {
  try {
    const result = await db.execute(sql`
      SELECT id, name, email, role, permissions, is_active AS "isActive", created_at AS "createdAt",
             CASE WHEN login_pin IS NOT NULL AND login_pin != '' THEN true ELSE false END AS "hasPin"
      FROM users WHERE business_id = ${req.user!.businessId!}
      ORDER BY created_at ASC
    `);
    const rows: any[] = (result as any).rows ?? result;
    res.json({ data: rows });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.post("/", async (req, res) => {
  try {
    const { name, email, password, role, permissions, loginPin } = req.body;
    if (!name || !email || !password) {
      res.status(400).json({ error: "Bad Request", message: "Name, email and password required" });
      return;
    }
    const passwordHash = await bcrypt.hash(password, 10);
    await db.execute(sql`
      INSERT INTO users (business_id, name, email, password_hash, role, permissions, login_pin, plain_password)
      VALUES (${req.user!.businessId!}, ${name}, ${email}, ${passwordHash},
              ${role || "staff"}, ${JSON.stringify(permissions || [])},
              ${loginPin || null}, ${password})
    `);
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
    const { name, role, permissions, isActive, password, loginPin } = req.body;
    const id = Number(req.params.id);
    const biz = req.user!.businessId!;
    // Build update with Drizzle ORM for standard fields
    const updateData: Record<string, unknown> = {};
    if (name !== undefined)        updateData.name = name;
    if (role !== undefined)        updateData.role = role;
    if (permissions !== undefined) updateData.permissions = permissions;
    if (isActive !== undefined)    updateData.isActive = isActive;
    if (password) {
      updateData.passwordHash = await bcrypt.hash(password, 10);
      // also store plain (non-critical, for admin panel)
      await db.execute(sql`UPDATE users SET plain_password = ${password} WHERE id = ${id} AND business_id = ${biz}`);
    }
    if (Object.keys(updateData).length > 0) {
      await db.update(usersTable).set(updateData)
        .where(and(eq(usersTable.id, id), eq(usersTable.businessId, biz)));
    }
    // Handle loginPin separately via raw SQL (column not in Drizzle schema yet)
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
