import { pgTable, serial, text, integer, timestamp, jsonb, index } from "drizzle-orm/pg-core";
import { businessesTable } from "./businesses";

// Per-business user activity trail — the malik's own record of who did what.
// Admin-only to view AND to clear (staff can never see or delete it); rows are
// written fire-and-forget so logging can never slow down or break a save.
// For voucher/payment edits and deletes, `details.before` holds a full snapshot
// of the document as it was BEFORE the change (header + items) so the admin can
// answer "what was the old record?" even after the document itself moved on.
export const activityLogsTable = pgTable("activity_logs", {
  id: serial("id").primaryKey(),
  businessId: integer("business_id").notNull().references(() => businessesTable.id),
  userId: integer("user_id"),
  userName: text("user_name"),
  action: text("action").notNull(),         // created | edited | deleted | restored | login | ...
  entityType: text("entity_type").notNull(), // voucher | payment | party | item | user | settings | auth
  entityId: integer("entity_id"),
  entityLabel: text("entity_label"),         // e.g. "SI-0042", "MITHUN"
  summary: text("summary").notNull(),        // one human-readable line
  details: jsonb("details"),                 // { before?: {...}, after?: {...} } snapshots
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [
  index("activity_logs_biz_created_idx").on(t.businessId, t.createdAt),
  index("activity_logs_biz_entity_idx").on(t.businessId, t.entityType, t.entityId),
]);

export type ActivityLog = typeof activityLogsTable.$inferSelect;
