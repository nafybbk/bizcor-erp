import { pgTable, serial, text, integer, boolean, timestamp, numeric, pgEnum } from "drizzle-orm/pg-core";
import { businessesTable } from "./businesses";

export const accountTypeEnum = pgEnum("account_type", ["cash", "bank"]);

export const cashBankAccountsTable = pgTable("cash_bank_accounts", {
  id: serial("id").primaryKey(),
  businessId: integer("business_id").notNull().references(() => businessesTable.id),
  name: text("name").notNull(),
  type: accountTypeEnum("type").notNull().default("cash"),
  bankName: text("bank_name"),
  accountNumber: text("account_number"),
  ifscCode: text("ifsc_code"),
  openingBalance: numeric("opening_balance", { precision: 15, scale: 2 }).notNull().default("0"),
  isDefault: boolean("is_default").notNull().default(false),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const expenseHeadsTable = pgTable("expense_heads", {
  id: serial("id").primaryKey(),
  businessId: integer("business_id").notNull().references(() => businessesTable.id),
  name: text("name").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const expenseVouchersTable = pgTable("expense_vouchers", {
  id: serial("id").primaryKey(),
  businessId: integer("business_id").notNull().references(() => businessesTable.id),
  expenseNumber: text("expense_number").notNull(),
  date: text("date").notNull(),
  expenseHeadId: integer("expense_head_id").references(() => expenseHeadsTable.id),
  accountId: integer("account_id").references(() => cashBankAccountsTable.id),
  amount: numeric("amount", { precision: 15, scale: 2 }).notNull(),
  paymentMode: text("payment_mode").notNull().default("cash"),
  referenceNumber: text("reference_number"),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const contraEntriesTable = pgTable("contra_entries", {
  id: serial("id").primaryKey(),
  businessId: integer("business_id").notNull().references(() => businessesTable.id),
  contraNumber: text("contra_number").notNull(),
  date: text("date").notNull(),
  fromAccountId: integer("from_account_id").notNull().references(() => cashBankAccountsTable.id),
  toAccountId: integer("to_account_id").notNull().references(() => cashBankAccountsTable.id),
  amount: numeric("amount", { precision: 15, scale: 2 }).notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type CashBankAccount = typeof cashBankAccountsTable.$inferSelect;
export type ExpenseHead = typeof expenseHeadsTable.$inferSelect;
export type ExpenseVoucher = typeof expenseVouchersTable.$inferSelect;
export type ContraEntry = typeof contraEntriesTable.$inferSelect;
