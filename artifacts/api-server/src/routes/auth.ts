import { Router } from "express";
import bcrypt from "bcryptjs";
import { db } from "@workspace/db";
import { superAdminsTable, businessesTable, usersTable, loginLogsTable, plansTable } from "@workspace/db";
import { eq, and, inArray, count, sql } from "drizzle-orm";
import { signToken, requireAuth } from "../middlewares/auth";

const router = Router();

function getIp(req: any): string {
  return (req.headers["x-forwarded-for"] as string || "").split(",")[0].trim() || req.ip || "";
}

async function logLogin(data: {
  userId?: number; businessId?: number; userName?: string; businessName?: string;
  role?: string; ipAddress?: string; userAgent?: string; latitude?: string; longitude?: string;
}) {
  try {
    await db.insert(loginLogsTable).values({
      userId: data.userId, businessId: data.businessId,
      userName: data.userName, businessName: data.businessName,
      role: data.role,
      ipAddress: data.ipAddress,
      userAgent: data.userAgent,
      latitude: data.latitude || null,
      longitude: data.longitude || null,
    });
  } catch { /* non-critical */ }
}

router.get("/lookup-business", async (req, res) => {
  try {
    const { email } = req.query;
    if (!email || typeof email !== "string") { res.status(400).json({ error: "email required" }); return; }
    const users = await db.select({ businessId: usersTable.businessId })
      .from(usersTable).where(eq(usersTable.email, email.toLowerCase()));
    if (users.length === 0) { res.json({ businesses: [] }); return; }
    const ids = [...new Set(users.map(u => u.businessId).filter(Boolean))] as number[];
    if (ids.length === 0) { res.json({ businesses: [] }); return; }
    const businesses = await db.select({ id: businessesTable.id, name: businessesTable.name, businessCode: businessesTable.businessCode, city: businessesTable.city, state: businessesTable.state })
      .from(businessesTable).where(inArray(businessesTable.id, ids));
    res.json({ businesses });
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal Server Error" }); }
});

router.post("/tech-login", async (req, res) => {
  try {
    const { phone, password } = req.body;
    if (!phone || !password) { res.status(400).json({ error: "Bad Request", message: "Phone/Email aur password required" }); return; }
    const input = phone.trim();
    const isEmail = input.includes("@");
    let admin = isEmail ? null : await db.query.superAdminsTable.findFirst({ where: eq(superAdminsTable.phone, input) });
    if (!admin) admin = await db.query.superAdminsTable.findFirst({ where: eq(superAdminsTable.email, input.toLowerCase()) });
    if (!admin || !admin.isActive) { res.status(401).json({ error: "Unauthorized", message: "Credentials galat hain ya account inactive hai" }); return; }
    if (!await bcrypt.compare(password, admin.passwordHash)) { res.status(401).json({ error: "Unauthorized", message: "Password galat hai" }); return; }
    const token = signToken({ id: admin.id, email: admin.email, name: admin.name, role: "super_admin" });
    logLogin({ userId: admin.id, userName: admin.name, role: "super_admin", ipAddress: getIp(req), userAgent: req.headers["user-agent"] });
    res.json({ token, user: { id: admin.id, email: admin.email, name: admin.name, role: "super_admin" } });
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal Server Error" }); }
});

router.post("/login", async (req, res) => {
  try {
    const { email, password, businessCode, latitude, longitude, loginName, forceLogin } = req.body;
    if (!email || !password) { res.status(400).json({ error: "Bad Request", message: "Email and password required" }); return; }

    const doLogin = async (fullUser: any, business: any) => {
      if (!fullUser || !fullUser.isActive) return null;

      // Single-session enforcement: if user already has an active session, block unless forceLogin
      if (fullUser.sessionToken && !forceLogin) {
        const lastAt = fullUser.lastLoginAt ? new Date(fullUser.lastLoginAt).toLocaleString("en-IN") : null;
        throw {
          code: "ALREADY_LOGGED_IN",
          message: "Aap pehle se login hain",
          lastLoginAt: lastAt,
          lastLoginIp: fullUser.lastLoginIp || null,
          userName: fullUser.name,
        };
      }

      // License enforcement: plan/trial expiry
      if (business.planExpiresAt && new Date(business.planExpiresAt) < new Date()) {
        const msg = business.isTrial
          ? "Aapka 30-din ka trial khatam ho gaya hai. Plan lijiye ya admin se contact karein."
          : "Aapka plan expire ho gaya hai. Nayi license lijiye ya admin se contact karein.";
        throw { code: "PLAN_EXPIRED", message: msg };
      }

      // License enforcement: max users (skip for business_admin)
      // For trial businesses (no planId), allow max 3 users
      if (fullUser.role !== "business_admin") {
        let maxAllowed: number | null = null;
        if (business.planId) {
          const plan = await db.query.plansTable.findFirst({ where: eq(plansTable.id, business.planId) });
          if (plan && plan.maxUsers) maxAllowed = plan.maxUsers;
        } else if (business.isTrial) {
          maxAllowed = 3; // trial mein max 3 users
        }
        if (maxAllowed !== null) {
          const [{ total }] = await db.select({ total: count() }).from(usersTable)
            .where(and(eq(usersTable.businessId, business.id), eq(usersTable.isActive, true)));
          if (Number(total) > maxAllowed) {
            throw { code: "USER_LIMIT_EXCEEDED", message: `Is business mein sirf ${maxAllowed} users allowed hain. Plan upgrade karein ya admin se contact karein.` };
          }
        }
      }

      // Generate new sessionToken and save to DB
      const newSessionToken = crypto.randomUUID();
      const ipAddr = getIp(req);
      await db.update(usersTable).set({
        sessionToken: newSessionToken,
        lastLoginAt: new Date(),
        lastLoginIp: ipAddr,
        lastSeenAt: new Date(),
      }).where(eq(usersTable.id, fullUser.id));

      const token = signToken(
        { id: fullUser.id, email: fullUser.email, name: fullUser.name, role: fullUser.role, businessId: fullUser.businessId, sessionToken: newSessionToken },
        business.planExpiresAt,
        business.isTrial,
      );
      logLogin({
        userId: fullUser.id, businessId: business.id,
        userName: fullUser.name, businessName: business.name,
        role: fullUser.role, ipAddress: ipAddr,
        userAgent: req.headers["user-agent"],
        latitude: latitude ? String(latitude) : undefined,
        longitude: longitude ? String(longitude) : undefined,
      });
      return {
        token,
        user: { id: fullUser.id, email: fullUser.email, name: fullUser.name, role: fullUser.role, businessId: fullUser.businessId, permissions: fullUser.permissions || [] },
        business: {
          id: business.id, name: business.name, businessCode: business.businessCode,
          planExpiresAt: business.planExpiresAt?.toISOString() || null,
          isTrial: business.isTrial,
          status: business.status,
        },
      };
    };

    if (!businessCode) {
      const users = await db.select({ businessId: usersTable.businessId, passwordHash: usersTable.passwordHash })
        .from(usersTable).where(eq(usersTable.email, email.toLowerCase()));
      if (users.length === 1) {
        const u = users[0];
        if (u.passwordHash && await bcrypt.compare(password, u.passwordHash)) {
          const business = await db.query.businessesTable.findFirst({ where: eq(businessesTable.id, u.businessId!) });
          if (business) {
            const fullUser = await db.query.usersTable.findFirst({ where: and(eq(usersTable.businessId, u.businessId!), eq(usersTable.email, email.toLowerCase())) });
            const result = await doLogin(fullUser, business);
            if (result) { res.json(result); return; }
          }
        }
      } else if (users.length > 1) {
        res.status(400).json({ error: "multiple_businesses", message: "Your email is linked to multiple businesses. Please enter your Business Code to continue." });
        return;
      }
      res.status(401).json({ error: "Unauthorized", message: "Invalid credentials" });
      return;
    }

    const business = await db.query.businessesTable.findFirst({ where: eq(businessesTable.businessCode, businessCode.toUpperCase()) });
    if (!business || (business.status !== "active" && business.status !== "trial")) {
      res.status(401).json({ error: "Unauthorized", message: "Business not found or inactive" }); return;
    }
    // Case-insensitive email match — get ALL users in this business with matching email
    const allCandidates = await db.execute(sql`
      SELECT * FROM users WHERE business_id = ${business.id} AND LOWER(email) = LOWER(${email})
    `);
    const candidates: any[] = (allCandidates as any).rows ?? allCandidates;

    // Check password for all candidates
    const passwordMatches: any[] = [];
    for (const u of candidates) {
      if (u.password_hash && await bcrypt.compare(password, u.password_hash)) {
        passwordMatches.push(u);
      }
    }

    if (passwordMatches.length === 0) {
      res.status(401).json({ error: "Unauthorized", message: "Invalid credentials" }); return;
    }

    // Multiple users match same email+password — ask which one (with PIN info)
    if (passwordMatches.length > 1 && !loginName) {
      res.status(300).json({
        error: "multiple_users",
        message: "Aapka account select karo",
        users: passwordMatches.map(u => ({
          id: u.id,
          name: u.name,
          hasPin: !!(u.login_pin && u.login_pin.trim() !== ""),
        })),
      });
      return;
    }

    // Pick user: if loginName given, match by name (case-insensitive)
    const { pin } = req.body;
    let matched = passwordMatches[0];
    if (loginName && passwordMatches.length > 1) {
      const byName = passwordMatches.find(u => u.name?.toLowerCase() === loginName.toLowerCase());
      if (!byName) {
        res.status(401).json({ error: "Unauthorized", message: "User nahi mila" }); return;
      }
      matched = byName;
    }

    // PIN check: if this user has a PIN set, verify it
    if (matched.login_pin && matched.login_pin.trim() !== "") {
      if (!pin || pin.trim() !== matched.login_pin.trim()) {
        res.status(401).json({ error: "wrong_pin", message: "PIN galat hai" }); return;
      }
    }

    // Re-fetch via Drizzle to get full typed object
    const matchedUser = await db.query.usersTable.findFirst({ where: eq(usersTable.id, matched.id) });
    if (!matchedUser) { res.status(401).json({ error: "Unauthorized", message: "User not found" }); return; }

    const result = await doLogin(matchedUser, business);
    if (!result) { res.status(401).json({ error: "Unauthorized", message: "User account is inactive" }); return; }
    res.json(result);
  } catch (err: any) {
    if (err?.code === "PLAN_EXPIRED" || err?.code === "USER_LIMIT_EXCEEDED") {
      res.status(403).json({ error: err.code, message: err.message }); return;
    }
    if (err?.code === "ALREADY_LOGGED_IN") {
      res.status(409).json({ error: "ALREADY_LOGGED_IN", message: err.message, lastLoginAt: err.lastLoginAt, lastLoginIp: err.lastLoginIp, userName: err.userName }); return;
    }
    req.log.error(err); res.status(500).json({ error: "Internal Server Error" });
  }
});

router.post("/forgot-password/tech", async (req, res) => {
  try {
    const { phone, newPassword } = req.body;
    if (!phone || !newPassword) { res.status(400).json({ error: "Phone aur naya password required hai" }); return; }
    if (newPassword.length < 4) { res.status(400).json({ error: "Password kam se kam 4 characters ka hona chahiye" }); return; }
    const input = phone.trim();
    let admin = await db.query.superAdminsTable.findFirst({ where: eq(superAdminsTable.phone, input) });
    if (!admin) admin = await db.query.superAdminsTable.findFirst({ where: eq(superAdminsTable.email, input.toLowerCase()) });
    if (!admin) { res.status(404).json({ error: "Is phone/email se koi account nahi mila" }); return; }
    const passwordHash = await bcrypt.hash(newPassword, 10);
    await db.update(superAdminsTable).set({ passwordHash }).where(eq(superAdminsTable.id, admin.id));
    try { await db.execute(sql`UPDATE super_admins SET plain_password = ${newPassword} WHERE id = ${admin!.id}`); } catch { }
    res.json({ success: true, message: "Password reset ho gaya — ab naye password se login karo" });
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal Server Error" }); }
});

router.post("/forgot-password/user", async (req, res) => {
  try {
    const { email, businessCode, newPassword } = req.body;
    if (!email || !newPassword) { res.status(400).json({ error: "Email aur naya password required hai" }); return; }
    if (newPassword.length < 4) { res.status(400).json({ error: "Password kam se kam 4 characters ka hona chahiye" }); return; }
    let user: any = null;
    let business: any = null;
    if (businessCode) {
      business = await db.query.businessesTable.findFirst({ where: eq(businessesTable.businessCode, businessCode.toUpperCase()) });
      if (!business) { res.status(404).json({ error: "Business Code galat hai" }); return; }
      user = await db.query.usersTable.findFirst({ where: and(eq(usersTable.businessId, business.id), eq(usersTable.email, email.toLowerCase())) });
    } else {
      const users = await db.select().from(usersTable).where(eq(usersTable.email, email.toLowerCase()));
      if (users.length === 1) user = users[0];
      else if (users.length > 1) { res.status(400).json({ error: "Kai businesses se linked email hai — Business Code bhi daalo" }); return; }
    }
    if (!user) { res.status(404).json({ error: "Is email se koi account nahi mila" }); return; }
    const passwordHash = await bcrypt.hash(newPassword, 10);
    await db.update(usersTable).set({ passwordHash }).where(eq(usersTable.id, user.id));
    try { await db.execute(sql`UPDATE users SET plain_password = ${newPassword} WHERE id = ${user.id}`); } catch { }
    res.json({ success: true, message: "Password reset ho gaya — ab naye password se login karo" });
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal Server Error" }); }
});

router.post("/logout", (_req, res) => { res.json({ success: true, message: "Logged out" }); });

router.get("/me", requireAuth, async (req, res) => {
  try {
    const user = req.user!;
    if (user.role === "super_admin") { res.json({ id: user.id, email: user.email, name: user.name, role: user.role }); return; }
    const dbUser = await db.query.usersTable.findFirst({ where: eq(usersTable.id, user.id) });
    if (!dbUser) { res.status(404).json({ error: "Not Found" }); return; }
    const business = await db.query.businessesTable.findFirst({ where: eq(businessesTable.id, dbUser.businessId) });
    // Update lastSeenAt
    db.update(usersTable).set({ lastSeenAt: new Date() }).where(eq(usersTable.id, user.id)).catch(() => {});
    res.json({ id: dbUser.id, email: dbUser.email, name: dbUser.name, role: dbUser.role, businessId: dbUser.businessId, businessName: business?.name, permissions: dbUser.permissions || [] });
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal Server Error" }); }
});

export default router;
