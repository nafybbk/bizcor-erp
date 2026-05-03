import React, { createContext, useContext, useState, useEffect } from "react";
import { api, setToken, clearToken } from "./api";

export interface AuthUser {
  id: number;
  email: string;
  name: string;
  role: "super_admin" | "business_admin" | "staff";
  businessId?: number;
  permissions?: string[];
}

export interface AuthBusiness {
  id: number;
  name: string;
  businessCode: string;
}

interface AuthCtx {
  user: AuthUser | null;
  business: AuthBusiness | null;
  loading: boolean;
  login: (email: string, password: string, businessCode?: string, coords?: { latitude: number; longitude: number }) => Promise<void>;
  logout: () => void;
  isSuperAdmin: () => boolean;
  isBusinessAdmin: () => boolean;
}

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() => {
    const stored = sessionStorage.getItem("erp_user") || localStorage.getItem("erp_user");
    return stored ? JSON.parse(stored) : null;
  });
  const [business, setBusiness] = useState<AuthBusiness | null>(() => {
    const stored = localStorage.getItem("erp_business");
    return stored ? JSON.parse(stored) : null;
  });
  const [loading, setLoading] = useState(false);

  const login = async (email: string, password: string, businessCode?: string, coords?: { latitude: number; longitude: number }) => {
    setLoading(true);
    try {
      const res: any = await api.post("/auth/login", { email, password, businessCode: businessCode || undefined, ...coords });
      setToken(res.token);
      setUser(res.user);
      setBusiness(res.business || null);
      localStorage.setItem("erp_user", JSON.stringify(res.user));
      localStorage.setItem("erp_business", JSON.stringify(res.business || null));
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    clearToken();
    setUser(null);
    setBusiness(null);
  };

  return (
    <Ctx.Provider value={{
      user, business, loading, login, logout,
      isSuperAdmin: () => user?.role === "super_admin",
      isBusinessAdmin: () => user?.role === "business_admin",
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
