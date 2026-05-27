import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const JWT_SECRET = process.env.SESSION_SECRET || "erp-secret-key";

export const TRIAL_DAYS = 30;
export const GRACE_DAYS = 30;

export interface AuthUser {
  id: number;
  email: string;
  name: string;
  role: "super_admin" | "business_admin" | "staff";
  businessId?: number;
  planExpiresAt?: string;
  isTrial?: boolean;
  sessionToken?: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export function signToken(payload: AuthUser, planExpiresAt?: Date | null, isTrial?: boolean): string {
  const enriched: AuthUser = { ...payload };
  let expiresInSeconds = 7 * 24 * 60 * 60;

  if (planExpiresAt) {
    enriched.planExpiresAt = planExpiresAt.toISOString();
    const secondsLeft = Math.floor((planExpiresAt.getTime() - Date.now()) / 1000);
    if (secondsLeft > 0) {
      expiresInSeconds = Math.min(secondsLeft, 7 * 24 * 60 * 60);
    } else {
      expiresInSeconds = 7 * 24 * 60 * 60;
    }
  }

  if (isTrial) enriched.isTrial = true;

  return jwt.sign(enriched, JWT_SECRET, { expiresIn: expiresInSeconds });
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  console.log(`[AUTH] requireAuth called: ${req.method} ${req.originalUrl} hasToken=${!!req.headers.authorization}`);
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    console.log(`[AUTH] BLOCKED (no/bad token): ${req.method} ${req.originalUrl}`);
    res.status(401).json({ error: "Unauthorized", message: "Missing or invalid token" });
    return;
  }
  const token = authHeader.slice(7);
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as AuthUser;
    req.user = decoded;
    if (decoded.role !== "super_admin" && decoded.sessionToken) {
      db.select().from(usersTable).where(eq(usersTable.id, decoded.id))
        .then(rows => {
          const dbUser = rows[0];
          if (!dbUser) {
            res.status(401).json({ error: "SESSION_INVALIDATED", message: "Aapka session band ho gaya hai. Dobara login karein." });
            return;
          }
          if (dbUser.sessionToken !== decoded.sessionToken) {
            res.status(401).json({ error: "SESSION_INVALIDATED", message: "Aap kisi aur jagah se login ho gaye hain. Yeh session band ho gaya hai." });
            return;
          }
          next();
        })
        .catch(() => next());
      return;
    }
    next();
  } catch {
    res.status(401).json({ error: "Unauthorized", message: "Invalid or expired token" });
  }
}

export function requireSuperAdmin(req: Request, res: Response, next: NextFunction): void {
  requireAuth(req, res, () => {
    if (req.user?.role !== "super_admin") {
      res.status(403).json({ error: "Forbidden", message: "Super admin access required" });
      return;
    }
    next();
  });
}

export function requireBusiness(req: Request, res: Response, next: NextFunction): void {
  requireAuth(req, res, () => {
    if (!req.user?.businessId) {
      res.status(403).json({ error: "Forbidden", message: "Business access required" });
      return;
    }
    next();
  });
}

// ─── Grace System ─────────────────────────────────────────────────────────────
// Trial  : 30 days full access from registration (planExpiresAt = createdAt + 30d)
// Grace  : 30 days after plan/trial expires — ONLY server PC + ONLY admin
// Expired: after 30 grace days — full lock, nothing works
// ─────────────────────────────────────────────────────────────────────────────

export type GraceStatus = "active" | "grace" | "expired";

export function getGraceStatus(planExpiresAt: string | Date | null | undefined): GraceStatus {
  if (!planExpiresAt) return "active";
  const expiry = typeof planExpiresAt === "string" ? new Date(planExpiresAt) : planExpiresAt;
  const now = new Date();
  if (expiry > now) return "active";
  const daysPast = Math.floor((now.getTime() - expiry.getTime()) / (24 * 60 * 60 * 1000));
  if (daysPast <= GRACE_DAYS) return "grace";
  return "expired";
}

function isServerPc(req: Request): boolean {
  const ip = req.ip || req.socket?.remoteAddress || "";
  return ip === "127.0.0.1" || ip === "::1" || ip === "::ffff:127.0.0.1" || ip.endsWith(":127.0.0.1");
}

export function requireActivePlan(req: Request, res: Response, next: NextFunction): void {
  const user = req.user;
  if (!user || user.role === "super_admin") { next(); return; }

  const grace = getGraceStatus(user.planExpiresAt);

  if (grace === "expired") {
    res.status(402).json({
      error: "PLAN_EXPIRED",
      message: `Aapka plan expire ho gaya hai (${GRACE_DAYS}+ din). Nayi license lijiye.`,
    });
    return;
  }

  if (grace === "grace") {
    // Grace period — sirf server PC + sirf admin
    if (!isServerPc(req)) {
      res.status(402).json({
        error: "GRACE_SERVER_ONLY",
        message: "Grace period mein sirf server PC pe kaam kar sakte hain. Plan activate karo.",
      });
      return;
    }
    if (user.role !== "business_admin") {
      res.status(402).json({
        error: "GRACE_ADMIN_ONLY",
        message: "Grace period mein sirf Admin kaam kar sakta hai. Plan activate karo.",
      });
      return;
    }
  }

  next();
}
