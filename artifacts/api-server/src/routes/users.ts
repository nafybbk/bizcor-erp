import { Router } from "express";
import bcrypt from "bcryptjs";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireBusiness } from "../middlewares/auth";

const router = Router();
router.use(requireBusiness);

router.get("/", async (req, res) => {
  try {
    const users = await db.select({
      id: usersTable.id, name: usersTable.name, email: usersTable.email,
      role: usersTable.role, permissions: usersTable.permissions, isActive: usersTable.isActive, createdAt: usersTable.createdAt,
    }).from(usersTable).where(eq(usersTable.businessId, req.user!.businessId!));
    res.json({ data: users });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.post("/", async (req, res) => {
  try {
    const { name, email, password, role, permissions } = req.body;
    if (!name || !email || !password) {
      res.status(400).json({ error: "Bad Request", message: "Name, email and password required" });
      return;
    }
    const passwordHash = await bcrypt.hash(password, 10);
    const [user] = await db.insert(usersTable).values({
      businessId: req.user!.businessId!, name, email, passwordHash,
      role: role || "staff", permissions: permissions || [],
    }).returning();
    const { passwordHash: _, ...safeUser } = user;
    res.status(201).json(safeUser);
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
    const { name, role, permissions, isActive, password } = req.body;
    const updateData: Record<string, unknown> = {};
    if (name) updateData.name = name;
    if (role) updateData.role = role;
    if (permissions) updateData.permissions = permissions;
    if (isActive !== undefined) updateData.isActive = isActive;
    if (password) updateData.passwordHash = await bcrypt.hash(password, 10);
    const [updated] = await db.update(usersTable).set(updateData)
      .where(and(eq(usersTable.id, Number(req.params.id)), eq(usersTable.businessId, req.user!.businessId!))).returning();
    const { passwordHash, ...safeUser } = updated;
    res.json(safeUser);
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
