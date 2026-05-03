export interface OfflineDraft {
  id: string;
  label: string;
  endpoint: string;
  method: "POST" | "PATCH";
  payload: any;
  savedAt: string;
  voucherType?: string;
}

const KEY = "erp_offline_queue";

export function getDrafts(): OfflineDraft[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) || "[]");
  } catch { return []; }
}

export function saveDraft(draft: Omit<OfflineDraft, "id" | "savedAt">): OfflineDraft {
  const full: OfflineDraft = {
    ...draft,
    id: `draft_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    savedAt: new Date().toISOString(),
  };
  const existing = getDrafts();
  localStorage.setItem(KEY, JSON.stringify([...existing, full]));
  window.dispatchEvent(new CustomEvent("offline-queue-change"));
  return full;
}

export function removeDraft(id: string) {
  const next = getDrafts().filter(d => d.id !== id);
  localStorage.setItem(KEY, JSON.stringify(next));
  window.dispatchEvent(new CustomEvent("offline-queue-change"));
}

export function clearDrafts() {
  localStorage.removeItem(KEY);
  window.dispatchEvent(new CustomEvent("offline-queue-change"));
}

export function getDraftCount(): number {
  return getDrafts().length;
}
