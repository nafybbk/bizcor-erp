import React, { createContext, useContext, useState, useEffect } from "react";
import { api, setToken, clearToken, setLoginInProgress } from "./api";

export interface AuthUser {
  id: number;
  email: string;
  name: string;
  role: "super_admin" | "business_admin" | "staff";
  businessId?: number;
  permissions?: string[];
  canEdit?: boolean;
  canDelete?: boolean;
}

export interface AuthBusiness {
  id: number;
  name: string;
  businessCode: string;
  planExpiresAt?: string | null;
  isTrial?: boolean;
  status?: string;
}

interface AuthCtx {
  user: AuthUser | null;
  business: AuthBusiness | null;
  loading: boolean;
  login: (email: string, password: string, businessCode?: string, coords?: { latitude: number; longitude: number }, loginName?: string, pin?: string, forceLogin?: boolean) => Promise<void>;
  logout: () => void;
  isSuperAdmin: () => boolean;
  isBusinessAdmin: () => boolean;
  isPlanExpired: () => boolean;
}

export type GraceStatus = "active" | "grace_trial" | "grace_admin" | "grace_readonly" | "expired";

export function getGraceStatus(): GraceStatus {
  try {
    const u = JSON.parse(localStorage.getItem("erp_user") || "null");
    if (u?.role === "super_admin") return "active";
  } catch { /**/ }
  const isTrial = localStorage.getItem("erp_plan_is_trial") === "true";
  if (isTrial) return "active";
  const expiry = localStorage.getItem("erp_plan_expires_at");
  if (!expiry) return "active";
  const exp = new Date(expiry);
  const now = new Date();
  if (exp > now) return "active";
  const daysPast = Math.floor((now.getTime() - exp.getTime()) / (24 * 60 * 60 * 1000));
  if (daysPast <= 30) return "grace_trial";
  if (daysPast <= 50) return "grace_admin";
  if (daysPast <= 60) return "grace_readonly";
  return "expired";
}

const PLAN_EXPIRY_KEY = "erp_plan_expires_at";
const PLAN_TRIAL_KEY  = "erp_plan_is_trial";

export function getCachedPlanExpiry(): string | null {
  return localStorage.getItem(PLAN_EXPIRY_KEY);
}

function checkPlanExpired(): boolean {
  const role = (() => {
    try {
      const u = JSON.parse(localStorage.getItem("erp_user") || "null");
      return u?.role as string | undefined;
    } catch { return undefined; }
  })();
  if (role === "super_admin") return false;

  const isTrial = localStorage.getItem(PLAN_TRIAL_KEY) === "true";
  if (isTrial) return false;

  const expiry = localStorage.getItem(PLAN_EXPIRY_KEY);
  if (!expiry) return false;
  return new Date(expiry) < new Date();
}

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() => {
    const stored = sessionStorage.getItem("erp_user") || localStorage.getItem("erp_user");
    if (!stored || stored === "undefined" || stored === "null") return null;
    try { return JSON.parse(stored); } catch { return null; }
  });
  const [business, setBusiness] = useState<AuthBusiness | null>(() => {
    const stored = localStorage.getItem("erp_business");
    if (!stored || stored === "undefined" || stored === "null") return null;
    try { return JSON.parse(stored); } catch { return null; }
  });
  const [loading, setLoading] = useState(false);

  const login = async (email: string, password: string, businessCode?: string, coords?: { latitude: number; longitude: number }, loginName?: string, pin?: string, forceLogin?: boolean) => {
    setLoading(true);
    // Block global SESSION_INVALIDATED redirect while login is in progress.
    // Without this, stale background requests (old token) can fire SESSION_INVALIDATED
    // and kick the user back to login BEFORE the new token is stored.
    setLoginInProgress(true);
    try {
      const res: any = await api.post("/auth/login", { email, password, businessCode: businessCode || undefined, loginName: loginName || undefined, pin: pin || undefined, forceLogin: forceLogin || undefined, ...coords });
      setToken(res.token);
      setUser(res.user);
      const biz = res.business || null;
      setBusiness(biz);
      localStorage.setItem("erp_user", JSON.stringify(res.user));
      localStorage.setItem("erp_business", JSON.stringify(biz));

      if (biz?.planExpiresAt) {
        localStorage.setItem(PLAN_EXPIRY_KEY, biz.planExpiresAt);
      } else {
        localStorage.removeItem(PLAN_EXPIRY_KEY);
      }
      localStorage.setItem(PLAN_TRIAL_KEY, biz?.isTrial ? "true" : "false");
    } finally {
      setLoginInProgress(false);
      setLoading(false);
    }
  };

  const logout = () => {
    // Tell server to clear sessionToken (so this device is fully logged out)
    api.post("/auth/logout", {}).catch(() => {});
    clearToken();
    setUser(null);
    setBusiness(null);
    localStorage.removeItem(PLAN_EXPIRY_KEY);
    localStorage.removeItem(PLAN_TRIAL_KEY);
  };

  return (
    <Ctx.Provider value={{
      user, business, loading, login, logout,
      isSuperAdmin: () => user?.role === "super_admin",
      isBusinessAdmin: () => user?.role === "business_admin",
      isPlanExpired: () => checkPlanExpired(),
    }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
