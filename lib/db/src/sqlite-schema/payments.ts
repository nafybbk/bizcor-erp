import { sqliteTable, integer, text } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

const NOW = sql`(datetime('now'))`;

export const paymentsTable = sqliteTable("payments", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  businessId: integer("business_id").notNull(),
  paymentNumber: text("payment_number").notNull(),
  type: text("type").notNull(),
  date: text("date").notNull(),
  partyId: integer("party_id").notNull(),
  amount: text("amount").notNull(),
  paymentMode: text("payment_mode").notNull().default("cash"),
  referenceNumber: text("reference_number"),
  notes: text("notes"),
  isOnAccount: integer("is_on_account", { mode: "boolean" }).notNull().default(false),
  accountId: integer("account_id"),
  createdAt: text("created_at").notNull().default(NOW),
  deletedAt: text("deleted_at"),
});

export const paymentAllocationsTable = sqliteTable("payment_allocations", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  paymentId: integer("payment_id").notNull(),
  voucherId: integer("voucher_id").notNull(),
  allocatedAmount: text("allocated_amount").notNull(),
  createdAt: text("created_at").notNull().default(NOW),
});
