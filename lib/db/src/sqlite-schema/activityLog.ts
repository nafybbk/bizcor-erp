import { sqliteTable, integer, text, index } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

const NOW = sql`(datetime('now'))`;

// SQLite twin of schema/activityLog.ts — the EXE keeps the activity trail
// fully local (never synced to cloud or customer app).
export const activityLogsTable = sqliteTable("activity_logs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  businessId: integer("business_id").notNull(),
  userId: integer("user_id"),
  userName: text("user_name"),
  action: text("action").notNull(),
  entityType: text("entity_type").notNull(),
  entityId: integer("entity_id"),
  entityLabel: text("entity_label"),
  summary: text("summary").notNull(),
  details: text("details", { mode: "json" }),
  createdAt: text("created_at").notNull().default(NOW),
}, (t) => [
  index("activity_logs_biz_created_idx").on(t.businessId, t.createdAt),
  index("activity_logs_biz_entity_idx").on(t.businessId, t.entityType, t.entityId),
]);
