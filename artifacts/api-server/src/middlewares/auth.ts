import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.SESSION_SECRET || "erp-secret-key";

export interface AuthUser {
  id: number;
  email: string;
  name: string;
  role: "super_admin" | "business_admin" | "staff";
  businessId?: number;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export function signToken(payload: AuthUser): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "7d" });
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
