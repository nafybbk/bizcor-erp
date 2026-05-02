import { Router } from "express";
import bcrypt from "bcryptjs";
import { db } from "@workspace/db";
import { superAdminsTable, businessesTable, usersTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { signToken, requireAuth } from "../middlewares/auth";

const router = Router();

router.post("/login", async (req, res) => {
  try {
    const { email, password, businessCode } = req.body;
    if (!email || !password) {
      res.status(400).json({ error: "Bad Request", message: "Email and password required" });
      return;
    }

    if (!businessCode) {
      const admin = await db.query.superAdminsTable.findFirst({
        where: eq(superAdminsTable.email, email),
      });
      if (!admin || !await bcrypt.compare(password, admin.passwordHash)) {
        res.status(401).json({ error: "Unauthorized", message: "Invalid credentials" });
        return;
      }
      const token = signToken({ id: admin.id, email: admin.email, name: admin.name, role: "super_admin" });
      res.json({ token, user: { id: admin.id, email: admin.email, name: admin.name, role: "super_admin" } });
      return;
    }

    const business = await db.query.businessesTable.findFirst({
      where: eq(businessesTable.businessCode, businessCode.toUpperCase()),
    });
    if (!business || business.status !== "active") {
      res.status(401).json({ error: "Unauthorized", message: "Business not found or inactive" });
      return;
    }

    const user = await db.query.usersTable.findFirst({
      where: and(eq(usersTable.businessId, business.id), eq(usersTable.email, email)),
    });
    if (!user || !await bcrypt.compare(password, user.passwordHash)) {
      res.status(401).json({ error: "Unauthorized", message: "Invalid credentials" });
      return;
    }
    if (!user.isActive) {
      res.status(401).json({ error: "Unauthorized", message: "User account is inactive" });
      return;
    }

    const token = signToken({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      businessId: user.businessId,
    });
    res.json({
      token,
      user: { id: user.id, email: user.email, name: user.name, role: user.role, businessId: user.businessId, permissions: user.permissions || [] },
      business: { id: business.id, name: business.name, businessCode: business.businessCode },
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.post("/logout", (_req, res) => {
  res.json({ success: true, message: "Logged out" });
});

router.get("/me", requireAuth, async (req, res) => {
  try {
    const user = req.user!;
    if (user.role === "super_admin") {
      res.json({ id: user.id, email: user.email, name: user.name, role: user.role });
      return;
    }
    const dbUser = await db.query.usersTable.findFirst({ where: eq(usersTable.id, user.id) });
    if (!dbUser) {
      res.status(404).json({ error: "Not Found" });
      return;
    }
    const business = await db.query.businessesTable.findFirst({ where: eq(businessesTable.id, dbUser.businessId) });
    res.json({
      id: dbUser.id,
      email: dbUser.email,
      name: dbUser.name,
      role: dbUser.role,
      businessId: dbUser.businessId,
      businessName: business?.name,
      permissions: dbUser.permissions || [],
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

export default router;
