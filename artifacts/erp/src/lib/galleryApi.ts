import { getToken } from "./api";

// Gallery is cloud-only (images must be reachable from a customer's phone
// from anywhere), so a desktop/LAN business's Gallery window talks to the
// cloud API directly over the internet instead of through its own local
// server — same reasoning and businessCode pattern as lanSync.ts. A
// pure-cloud business's own API server already IS the cloud, so it just
// uses the normal relative path.
const CLOUD_URL = "https://erp.naewtgroup.com/api";

function isDesktopMode(): boolean {
  return localStorage.getItem("erp_app_mode") === "desktop";
}

function myBusinessCode(): string | undefined {
  try {
    const biz = JSON.parse(localStorage.getItem("erp_business") || "{}");
    return biz?.businessCode || undefined;
  } catch { return undefined; }
}

function base(): string {
  if (isDesktopMode()) return CLOUD_URL;
  return `${import.meta.env.BASE_URL}api`.replace(/\/+/g, "/").replace(/\/$/, "");
}

export class GalleryApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "GalleryApiError";
    this.status = status;
  }
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const errData = await res.json().catch(() => ({ message: "Request failed" }));
    throw new GalleryApiError(errData.message || errData.error || "Request failed", res.status);
  }
  return res.json();
}

function withBusinessCode<T extends Record<string, unknown>>(body: T): T & { businessCode?: string } {
  const code = myBusinessCode();
  return code ? { ...body, businessCode: code } : body;
}

export const galleryApi = {
  get: async <T>(path: string): Promise<T> => {
    const token = getToken();
    const code = myBusinessCode();
    const qs = code ? `${path.includes("?") ? "&" : "?"}businessCode=${encodeURIComponent(code)}` : "";
    const res = await fetch(`${base()}${path}${qs}`, {
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    });
    return handleResponse<T>(res);
  },
  post: async <T>(path: string, body: Record<string, unknown>): Promise<T> => {
    const token = getToken();
    const res = await fetch(`${base()}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify(withBusinessCode(body)),
    });
    return handleResponse<T>(res);
  },
  patch: async <T>(path: string, body: Record<string, unknown>): Promise<T> => {
    const token = getToken();
    const res = await fetch(`${base()}${path}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify(withBusinessCode(body)),
    });
    return handleResponse<T>(res);
  },
  delete: async <T>(path: string): Promise<T> => {
    const token = getToken();
    const code = myBusinessCode();
    const qs = code ? `?businessCode=${encodeURIComponent(code)}` : "";
    const res = await fetch(`${base()}${path}${qs}`, {
      method: "DELETE",
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    });
    return handleResponse<T>(res);
  },
  // Multipart upload — image bytes + businessCode as form fields
  uploadImage: async <T>(blob: Blob, filename: string, originalSize?: number): Promise<T> => {
    const token = getToken();
    const form = new FormData();
    form.append("image", blob, filename);
    if (originalSize) form.append("originalSize", String(originalSize));
    const code = myBusinessCode();
    if (code) form.append("businessCode", code);
    const res = await fetch(`${base()}/gallery/upload`, {
      method: "POST",
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: form,
    });
    return handleResponse<T>(res);
  },
};
