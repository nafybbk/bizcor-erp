import { pgTable, serial, text, integer, boolean, timestamp, numeric, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const businessStatusEnum = pgEnum("business_status", ["active", "inactive", "suspended", "trial"]);
export const billingCycleEnum = pgEnum("billing_cycle", ["monthly", "yearly"]);

export const superAdminsTable = pgTable("super_admins", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const plansTable = pgTable("plans", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  price: numeric("price", { precision: 10, scale: 2 }).notNull(),
  billingCycle: billingCycleEnum("billing_cycle").notNull().default("monthly"),
  maxUsers: integer("max_users").notNull().default(5),
  trialDays: integer("trial_days").notNull().default(0),
  validityDays: integer("validity_days").notNull().default(30),
  features: text("features").array(),
  isActive: boolean("is_active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const businessesTable = pgTable("businesses", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  businessCode: text("business_code").notNull().unique(),
  gstin: text("gstin"),
  pan: text("pan"),
  address: text("address"),
  city: text("city"),
  state: text("state"),
  stateCode: text("state_code"),
  pincode: text("pincode"),
  phone: text("phone"),
  email: text("email"),
  businessType: text("business_type"),
  logo: text("logo"),
  planId: integer("plan_id").references(() => plansTable.id),
  planStartDate: timestamp("plan_start_date"),
  planExpiresAt: timestamp("plan_expires_at"),
  isTrial: boolean("is_trial").notNull().default(false),
  status: businessStatusEnum("status").notNull().default("active"),
  financialYearStart: text("financial_year_start").default("04-01"),
  currency: text("currency").default("INR"),
  invoicePrefix: text("invoice_prefix").default("SI"),
  creditNotePrefix: text("credit_note_prefix").default("CN"),
  billPrefix: text("bill_prefix").default("PB"),
  debitNotePrefix: text("debit_note_prefix").default("DN"),
  serialNumberMode: text("serial_number_mode").default("auto"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const appSettingsTable = pgTable("app_settings", {
  id: serial("id").primaryKey(),
  key: text("key").notNull().unique(),
  value: text("value"),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertPlanSchema = createInsertSchema(plansTable).omit({ id: true, createdAt: true });
export type InsertPlan = z.infer<typeof insertPlanSchema>;
export type Plan = typeof plansTable.$inferSelect;

export const insertBusinessSchema = createInsertSchema(businessesTable).omit({ id: true, createdAt: true });
export type InsertBusiness = z.infer<typeof insertBusinessSchema>;
export type Business = typeof businessesTable.$inferSelect;

export const insertSuperAdminSchema = createInsertSchema(superAdminsTable).omit({ id: true, createdAt: true });
export type InsertSuperAdmin = z.infer<typeof insertSuperAdminSchema>;
export type SuperAdmin = typeof superAdminsTable.$inferSelect;

export type AppSetting = typeof appSettingsTable.$inferSelect;
