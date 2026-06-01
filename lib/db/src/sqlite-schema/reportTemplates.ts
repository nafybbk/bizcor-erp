import { sqliteTable, integer, text } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

const NOW = sql`(datetime('now'))`;

export const reportTemplatesTable = sqliteTable("report_templates", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  businessId: integer("business_id").notNull(),
  name: text("name").notNull(),
  reportType: text("report_type").notNull(),
  paperSize: text("paper_size").notNull().default("A4"),
  orientation: text("orientation").notNull().default("portrait"),
  version: integer("version").notNull().default(1),
  isDefault: integer("is_default", { mode: "boolean" }).notNull().default(false),
  layoutJson: text("layout_json", { mode: "json" }),
  createdByUserId: integer("created_by_user_id"),
  createdAt: text("created_at").notNull().default(NOW),
  updatedAt: text("updated_at").notNull().default(NOW),
});

export type ReportTemplate = typeof reportTemplatesTable.$inferSelect;
export type NewReportTemplate = typeof reportTemplatesTable.$inferInsert;
