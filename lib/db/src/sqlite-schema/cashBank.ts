import { sqliteTable, integer, text } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

const NOW = sql`(datetime('now'))`;

export const cashBankAccountsTable = sqliteTable("cash_bank_accounts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  businessId: integer("business_id").notNull(),
  name: text("name").notNull(),
  type: text("type").notNull().default("cash"),
  bankName: text("bank_name"),
  accountNumber: text("account_number"),
  ifscCode: text("ifsc_code"),
  openingBalance: text("opening_balance").notNull().default("0"),
  isDefault: integer("is_default", { mode: "boolean" }).notNull().default(false),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  createdAt: text("created_at").notNull().default(NOW),
});

export const expenseHeadsTable = sqliteTable("expense_heads", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  businessId: integer("business_id").notNull(),
  name: text("name").notNull(),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  createdAt: text("created_at").notNull().default(NOW),
});

export const expenseVouchersTable = sqliteTable("expense_vouchers", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  businessId: integer("business_id").notNull(),
  expenseNumber: text("expense_number").notNull(),
  date: text("date").notNull(),
  expenseHeadId: integer("expense_head_id"),
  accountId: integer("account_id"),
  amount: text("amount").notNull(),
  paymentMode: text("payment_mode").notNull().default("cash"),
  referenceNumber: text("reference_number"),
  notes: text("notes"),
  createdAt: text("created_at").notNull().default(NOW),
});

export const contraEntriesTable = sqliteTable("contra_entries", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  businessId: integer("business_id").notNull(),
  contraNumber: text("contra_number").notNull(),
  date: text("date").notNull(),
  fromAccountId: integer("from_account_id").notNull(),
  toAccountId: integer("to_account_id").notNull(),
  amount: text("amount").notNull(),
  notes: text("notes"),
  createdAt: text("created_at").notNull().default(NOW),
});
