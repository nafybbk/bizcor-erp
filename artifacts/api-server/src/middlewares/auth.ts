import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.SESSION_SECRET || "erp-secret-key";

export interface AuthUser {
  id: number;
  email: string;
  name: string;
  role: "super_admin" | "business_admin" | "staff";
  businessId?: number;
  planExpiresAt?: string;
  isTrial?: boolean;
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

  // Default: 7 days in seconds
  let expiresInSeconds = 7 * 24 * 60 * 60;

  if (planExpiresAt && !isTrial) {
    enriched.planExpiresAt = planExpiresAt.toISOString();
    const secondsLeft = Math.floor((planExpiresAt.getTime() - Date.now()) / 1000);
    if (secondsLeft > 0) {
      expiresInSeconds = Math.min(secondsLeft, 7 * 24 * 60 * 60);
    } else {
      expiresInSeconds = 3600; // 1 hour (shouldn't happen — login blocks expired plans)
    }
  }

  if (isTrial) enriched.isTrial = true;

  return jwt.sign(enriched, JWT_SECRET, { expiresIn: expiresInSeconds });
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Unauthorized", message: "Missing or invalid token" });
    return;
  }
  const token = authHeader.slice(7);
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as AuthUser;
    req.user = decoded;
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

export function requireActivePlan(req: Request, res: Response, next: NextFunction): void {
  const user = req.user;
  if (!user || user.role === "super_admin" || user.isTrial) { next(); return; }
  if (user.planExpiresAt) {
    const expiry = new Date(user.planExpiresAt);
    if (expiry < new Date()) {
      res.status(402).json({
        error: "PLAN_EXPIRED",
        message: "Aapka plan expire ho gaya hai. Nayi license lijiye ya admin se contact karein.",
      });
      return;
    }
  }
  next();
}
