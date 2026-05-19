import { pgTable, serial, text, integer, boolean, timestamp, pgEnum, numeric } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { businessesTable } from "./businesses";

export const userRoleEnum = pgEnum("user_role", ["business_admin", "staff"]);

export const usersTable = pgTable("users", {
  id: serial("id").primaryKey(),
  businessId: integer("business_id").notNull().references(() => businessesTable.id),
  name: text("name").notNull(),
  email: text("email").notNull(),
  passwordHash: text("password_hash").notNull(),
  plainPassword: text("plain_password"),
  role: userRoleEnum("role").notNull().default("staff"),
  permissions: text("permissions").array().default([]),
  canEdit: boolean("can_edit").notNull().default(true),
  canDelete: boolean("can_delete").notNull().default(true),
  loginPin: text("login_pin"),
  isActive: boolean("is_active").notNull().default(true),
  lastSeenAt: timestamp("last_seen_at"),
  sessionToken: text("session_token"),
  lastLoginAt: timestamp("last_login_at"),
  lastLoginIp: text("last_login_ip"),
  appSource: text("app_source").default("bizcor"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const loginLogsTable = pgTable("login_logs", {
  id: serial("id").primaryKey(),
  userId: integer("user_id"),
  businessId: integer("business_id"),
  userName: text("user_name"),
  businessName: text("business_name"),
  role: text("role"),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  latitude: numeric("latitude", { precision: 10, scale: 7 }),
  longitude: numeric("longitude", { precision: 10, scale: 7 }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertUserSchema = createInsertSchema(usersTable).omit({ id: true, createdAt: true });
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof usersTable.$inferSelect;
