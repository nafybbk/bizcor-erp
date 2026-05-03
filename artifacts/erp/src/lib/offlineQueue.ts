export interface OfflineDraft {
  id: string;
  label: string;
  endpoint: string;
  method: "POST" | "PATCH";
  payload: any;
  savedAt: string;
  voucherType?: string;
  locationName?: string;
  locationLat?: number;
  locationLng?: number;
  tempId?: number; // temp ID assigned offline (e.g. for parties), used for ID mapping during sync
}

const KEY = "erp_offline_queue";

export function getDrafts(): OfflineDraft[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) || "[]");
  } catch { return []; }
}

export function saveDraft(draft: Omit<OfflineDraft, "id" | "savedAt">): OfflineDraft {
  try {
    const loc = JSON.parse(localStorage.getItem("erp_device_location") || "null");
    if (loc?.name && !draft.locationName) {
      draft = { ...draft, locationName: loc.name, locationLat: loc.latitude, locationLng: loc.longitude };
    }
  } catch { }
  const full: OfflineDraft = {
    ...draft,
    id: `draft_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    savedAt: new Date().toISOString(),
  };
  const existing = getDrafts();
  localStorage.setItem(KEY, JSON.stringify([...existing, full]));
  window.dispatchEvent(new CustomEvent("offline-queue-change"));
  import("@/lib/localDataFolder").then(m => m.saveOfflineDraftToFolder(full)).catch(() => {});
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

// Resolve temp IDs in a payload using the idMap built during sync
export function resolvePayload(payload: any, idMap: Record<number, number>): any {
  if (!payload) return payload;
  const resolved = { ...payload };
  if (resolved.partyId && typeof resolved.partyId === "number" && resolved.partyId < 0) {
    const realId = idMap[resolved.partyId];
    if (realId) resolved.partyId = realId;
  }
  return resolved;
}

export async function syncAllDrafts(): Promise<{ synced: number; failed: number }> {
  const { api } = await import("@/lib/api");
  const drafts = getDrafts();
  let synced = 0, failed = 0;
  // Map of temp (negative) IDs → real server IDs, built as each party draft succeeds
  const idMap: Record<number, number> = {};

  for (const draft of drafts) {
    try {
      const payload = resolvePayload(draft.payload, idMap);
      let result: any;
      if (draft.method === "POST") result = await api.post(draft.endpoint, payload);
      else result = await api.patch(draft.endpoint, payload);

      // If this was a party draft with a tempId, record the mapping
      if (draft.endpoint === "/parties" && draft.tempId && result?.id) {
        idMap[draft.tempId] = result.id;
      }

      removeDraft(draft.id);
      synced++;
    } catch {
      failed++;
    }
  }
  return { synced, failed };
}
