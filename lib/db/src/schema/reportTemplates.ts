import { pgTable, serial, text, integer, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";
import { businessesTable } from "./businesses";

export const reportTemplatesTable = pgTable("report_templates", {
  id: serial("id").primaryKey(),
  businessId: integer("business_id").notNull().references(() => businessesTable.id),
  name: text("name").notNull(),
  reportType: text("report_type").notNull(),
  paperSize: text("paper_size").notNull().default("A4"),
  orientation: text("orientation").notNull().default("portrait"),
  version: integer("version").notNull().default(1),
  isDefault: boolean("is_default").notNull().default(false),
  layoutJson: jsonb("layout_json"),
  createdByUserId: integer("created_by_user_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type ReportTemplate = typeof reportTemplatesTable.$inferSelect;
export type NewReportTemplate = typeof reportTemplatesTable.$inferInsert;
