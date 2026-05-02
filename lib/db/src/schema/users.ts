import { pgTable, serial, text, integer, boolean, timestamp, pgEnum } from "drizzle-orm/pg-core";
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
  role: userRoleEnum("role").notNull().default("staff"),
  permissions: text("permissions").array().default([]),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertUserSchema = createInsertSchema(usersTable).omit({ id: true, createdAt: true });
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof usersTable.$inferSelect;
