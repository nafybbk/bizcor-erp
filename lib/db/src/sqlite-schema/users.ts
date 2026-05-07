import { sqliteTable, integer, text } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

const NOW = sql`(datetime('now'))`;

export const usersTable = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  businessId: integer("business_id").notNull(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  passwordHash: text("password_hash").notNull(),
  plainPassword: text("plain_password"),
  role: text("role").notNull().default("staff"),
  permissions: text("permissions", { mode: "json" }).$type<string[]>().default([]),
  canEdit: integer("can_edit", { mode: "boolean" }).notNull().default(true),
  canDelete: integer("can_delete", { mode: "boolean" }).notNull().default(true),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  loginPin: text("login_pin"),
  sessionToken: text("session_token"),
  lastSeenAt: text("last_seen_at"),
  lastLoginAt: text("last_login_at"),
  lastLoginIp: text("last_login_ip"),
  createdAt: text("created_at").notNull().default(NOW),
});

export const loginLogsTable = sqliteTable("login_logs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id"),
  businessId: integer("business_id"),
  userName: text("user_name"),
  businessName: text("business_name"),
  role: text("role"),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  latitude: text("latitude"),
  longitude: text("longitude"),
  createdAt: text("created_at").notNull().default(NOW),
});
