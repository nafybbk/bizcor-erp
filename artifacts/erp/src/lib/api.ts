const BASE = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL.replace(/\/$/, "")}/api`
  : `${import.meta.env.BASE_URL}api`.replace(/\/+/g, "/").replace(/\/$/, "");

// Tech admin token is stored in sessionStorage (tab-isolated) so it does not
// overwrite the business user token stored in localStorage when both panels
// are open in different tabs of the same browser.
function getToken(): string | null {
  return sessionStorage.getItem("erp_token") || localStorage.getItem("erp_token");
}

export function setToken(token: string) {
  localStorage.setItem("erp_token", token);
}

export function setAdminToken(token: string) {
  sessionStorage.setItem("erp_token", token);
}

export function clearToken() {
  sessionStorage.removeItem("erp_token");
  sessionStorage.removeItem("erp_user");
  localStorage.removeItem("erp_token");
  localStorage.removeItem("erp_user");
  localStorage.removeItem("erp_business");
}

// Prevent background-query SESSION_INVALIDATED redirects while a new login is in progress.
// e.g. forceLogin: stale old token fires background calls → SESSION_INVALIDATED fires
// before new token is stored → user gets kicked back to login immediately after logging in.
let _loginInProgress = false;
export function setLoginInProgress(v: boolean) { _loginInProgress = v; }

export class ApiError extends Error {
  status: number;
  code: string;
  data: any;
  constructor(message: string, status: number, data: any) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = data?.error || "";
    this.data = data;
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
  const res = await fetch(`${BASE}${path}`, { ...options, headers });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({ message: "Request failed" }));
    // Global SESSION_INVALIDATED handler — clear session and reload to login page.
    // Skip if a login is currently in progress (avoids race-condition redirect).
    if (res.status === 401 && errData?.error === "SESSION_INVALIDATED" && !_loginInProgress) {
      clearToken();
      localStorage.removeItem("erp_user");
      localStorage.removeItem("erp_business");
      const { getLang, t } = await import("./lang");
      const lang = getLang();
      localStorage.setItem("erp_session_invalidated_msg", errData.message || t("sessionInvalidated", lang));
      window.location.href = "/";
      throw new ApiError(errData.message, res.status, errData);
    }
    const base = errData.message || errData.error || "Request failed";
    const detail = errData.detail ? ` — ${errData.detail}` : "";
    throw new ApiError(base + detail, res.status, errData);
  }
  return res.json();
}

// Central helper — works for "Failed to fetch", service-worker 503, and browser offline
export function isOfflineError(err: any): boolean {
  if (!navigator.onLine) return true;
  const msg: string = err?.message || "";
  return (
    msg.includes("Failed to fetch") ||
    msg.includes("NetworkError") ||
    msg.includes("network") ||
    msg.toLowerCase().includes("offline") ||
    msg.includes("503")
  );
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body: unknown) => request<T>(path, { method: "POST", body: JSON.stringify(body) }),
  patch: <T>(path: string, body: unknown) => request<T>(path, { method: "PATCH", body: JSON.stringify(body) }),
  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
};

export const fmt = {
  currency: (n: number | string | undefined | null) => {
    const num = Number(n || 0);
    return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 2 }).format(num);
  },
  number: (n: number | string | undefined | null, decimals = 2) => {
    const num = Number(n || 0);
    return new Intl.NumberFormat("en-IN", { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(num);
  },
  date: (d: string | undefined | null) => {
    if (!d) return "";
    return new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  },
  today: () => new Date().toISOString().split("T")[0],
};
