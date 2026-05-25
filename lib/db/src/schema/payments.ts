import { pgTable, serial, text, integer, boolean, timestamp, numeric, pgEnum } from "drizzle-orm/pg-core";
import { businessesTable } from "./businesses";
import { partiesTable } from "./masters";
import { vouchersTable } from "./vouchers";
import { cashBankAccountsTable } from "./cashBank";

export const paymentTypeEnum = pgEnum("payment_type", ["receipt", "payment"]);
export const paymentModeEnum = pgEnum("payment_mode", ["cash", "bank", "cheque", "upi", "other"]);

export const paymentsTable = pgTable("payments", {
  id: serial("id").primaryKey(),
  businessId: integer("business_id").notNull().references(() => businessesTable.id),
  paymentNumber: text("payment_number").notNull(),
  type: paymentTypeEnum("type").notNull(),
  date: text("date").notNull(),
  partyId: integer("party_id").notNull().references(() => partiesTable.id),
  amount: numeric("amount", { precision: 15, scale: 2 }).notNull(),
  paymentMode: paymentModeEnum("payment_mode").notNull().default("cash"),
  referenceNumber: text("reference_number"),
  notes: text("notes"),
  isOnAccount: boolean("is_on_account").notNull().default(false),
  accountId: integer("account_id").references(() => cashBankAccountsTable.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  deletedAt: timestamp("deleted_at"),
});

export const paymentAllocationsTable = pgTable("payment_allocations", {
  id: serial("id").primaryKey(),
  paymentId: integer("payment_id").notNull().references(() => paymentsTable.id),
  voucherId: integer("voucher_id").notNull().references(() => vouchersTable.id),
  allocatedAmount: numeric("allocated_amount", { precision: 15, scale: 2 }).notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type Payment = typeof paymentsTable.$inferSelect;
export type PaymentAllocation = typeof paymentAllocationsTable.$inferSelect;
