import { Router } from "express";
import bcrypt from "bcryptjs";
import { db } from "@workspace/db";
import { superAdminsTable, businessesTable, usersTable } from "@workspace/db";
import { eq, and, inArray } from "drizzle-orm";
import { signToken, requireAuth } from "../middlewares/auth";

const router = Router();

// Lookup which businesses are associated with an email (for "forgot business code" flow)
router.get("/lookup-business", async (req, res) => {
  try {
    const { email } = req.query;
    if (!email || typeof email !== "string") {
      res.status(400).json({ error: "email required" }); return;
    }
    const users = await db.select({ businessId: usersTable.businessId })
      .from(usersTable).where(eq(usersTable.email, email.toLowerCase()));
    if (users.length === 0) { res.json({ businesses: [] }); return; }
    const ids = [...new Set(users.map(u => u.businessId).filter(Boolean))] as number[];
    if (ids.length === 0) { res.json({ businesses: [] }); return; }
    const businesses = await db.select({ id: businessesTable.id, name: businessesTable.name, businessCode: businessesTable.businessCode, city: businessesTable.city, state: businessesTable.state })
      .from(businessesTable).where(inArray(businessesTable.id, ids));
    res.json({ businesses });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// ── Tech Login (phone + password) ──────────────────────────────────────────
router.post("/tech-login", async (req, res) => {
  try {
    const { phone, password } = req.body;
    if (!phone || !password) {
      res.status(400).json({ error: "Bad Request", message: "Phone and password required" });
      return;
    }
    const admin = await db.query.superAdminsTable.findFirst({
      where: eq(superAdminsTable.phone, phone.trim()),
    });
    if (!admin || !admin.isActive) {
      res.status(401).json({ error: "Unauthorized", message: "Phone number registered nahi hai ya account inactive hai" });
      return;
    }
    if (!await bcrypt.compare(password, admin.passwordHash)) {
      res.status(401).json({ error: "Unauthorized", message: "Password galat hai" });
      return;
    }
    const token = signToken({ id: admin.id, email: admin.email, name: admin.name, role: "super_admin" });
    res.json({ token, user: { id: admin.id, email: admin.email, name: admin.name, role: "super_admin" } });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.post("/login", async (req, res) => {
  try {
    const { email, password, businessCode } = req.body;
    if (!email || !password) {
      res.status(400).json({ error: "Bad Request", message: "Email and password required" });
      return;
    }

    if (!businessCode) {
      // Try to auto-find business by email
      const users = await db.select({ businessId: usersTable.businessId, passwordHash: usersTable.passwordHash })
        .from(usersTable).where(eq(usersTable.email, email.toLowerCase()));
      if (users.length === 1) {
        const u = users[0];
        if (u.passwordHash && await bcrypt.compare(password, u.passwordHash)) {
          // Auto-login: single business match
          const business = await db.query.businessesTable.findFirst({ where: eq(businessesTable.id, u.businessId!) });
          if (business) {
            const fullUser = await db.query.usersTable.findFirst({ where: and(eq(usersTable.businessId, u.businessId!), eq(usersTable.email, email.toLowerCase())) });
            if (fullUser && fullUser.isActive) {
              const token = signToken({ id: fullUser.id, email: fullUser.email, name: fullUser.name, role: fullUser.role, businessId: fullUser.businessId });
              res.json({ token, user: { id: fullUser.id, email: fullUser.email, name: fullUser.name, role: fullUser.role, businessId: fullUser.businessId, permissions: fullUser.permissions || [] }, business: { id: business.id, name: business.name, businessCode: business.businessCode } });
              return;
            }
          }
        }
      } else if (users.length > 1) {
        // Multiple businesses — ask user to provide business code
        res.status(400).json({ error: "multiple_businesses", message: "Your email is linked to multiple businesses. Please enter your Business Code to continue." });
        return;
      }
      res.status(401).json({ error: "Unauthorized", message: "Invalid credentials" });
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
      id: user.id, email: user.email, name: user.name, role: user.role, businessId: user.businessId,
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
    if (!dbUser) { res.status(404).json({ error: "Not Found" }); return; }
    const business = await db.query.businessesTable.findFirst({ where: eq(businessesTable.id, dbUser.businessId) });
    res.json({
      id: dbUser.id, email: dbUser.email, name: dbUser.name, role: dbUser.role,
      businessId: dbUser.businessId, businessName: business?.name, permissions: dbUser.permissions || [],
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

export default router;
