// Per-business activity trail (see lib/db schema/activityLog.ts).
// logActivity is fire-and-forget: it must never slow down or break the
// operation being logged, so all errors are swallowed. On installs where the
// activity_logs table doesn't exist yet (older LAN EXEs), the insert simply
// fails silently and the ERP behaves exactly as before.
import { db } from "@workspace/db";
import { activityLogsTable } from "@workspace/db";

export interface ActivityEntry {
  action: "created" | "edited" | "deleted" | "restored" | "login" | "cleared" | string;
  entityType: "voucher" | "payment" | "party" | "item" | "user" | "settings" | "auth" | string;
  entityId?: number | null;
  entityLabel?: string | null;
  summary: string;
  details?: Record<string, unknown> | null;
}

export function logActivity(
  req: { user?: { id?: number; name?: string; businessId?: number } },
  entry: ActivityEntry,
): void {
  const businessId = req.user?.businessId;
  if (!businessId) return;
  try {
    void db.insert(activityLogsTable).values({
      businessId,
      userId: req.user?.id ?? null,
      userName: req.user?.name ?? null,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId ?? null,
      entityLabel: entry.entityLabel ?? null,
      summary: entry.summary,
      details: entry.details ?? null,
    }).catch(() => { /* fire-and-forget */ });
  } catch { /* table missing on old EXE builds — never break the main operation */ }
}
