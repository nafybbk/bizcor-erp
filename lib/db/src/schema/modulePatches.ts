import { pgTable, serial, text, integer, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { businessesTable, superAdminsTable } from "./businesses";

// Tech Panel "Module Patch" — a paid add-on that grants an existing business a
// module not included in their plan (e.g. Chat, Gallery, Customer Network),
// scoped to the whole business (all its PCs/logins), with a device limit +
// validity period. Created "pending" by a super admin; it "activates" the
// next time the business's app talks to the server (login/sync) — that's
// when the validity countdown actually starts, since a LAN business may sit
// offline for a while before first connecting after the patch was granted.

export const patchModuleEnum = pgEnum("patch_module", ["chat", "gallery", "customer_network"]);
export const patchStatusEnum = pgEnum("patch_status", ["pending", "active", "expired", "revoked"]);

export const modulePatchesTable = pgTable("module_patches", {
  id: serial("id").primaryKey(),
  businessId: integer("business_id").notNull().references(() => businessesTable.id),
  module: patchModuleEnum("module").notNull(),
  deviceLimit: integer("device_limit").notNull().default(1),
  validityDays: integer("validity_days").notNull().default(30),
  status: patchStatusEnum("status").notNull().default("pending"),
  activatedAt: timestamp("activated_at"),
  expiresAt: timestamp("expires_at"),
  notes: text("notes"),
  createdBy: integer("created_by").references(() => superAdminsTable.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type ModulePatch = typeof modulePatchesTable.$inferSelect;

export const insertModulePatchSchema = createInsertSchema(modulePatchesTable).omit({ id: true, createdAt: true });
export type InsertModulePatch = z.infer<typeof insertModulePatchSchema>;
