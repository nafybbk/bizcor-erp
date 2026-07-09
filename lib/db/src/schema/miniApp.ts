import { pgTable, serial, text, integer, timestamp, jsonb, pgEnum, numeric, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { businessesTable } from "./businesses";
import { partiesTable } from "./masters";

// Customer Network App ("mini app") — cloud-only tables.
// A "customer" here is the mobile-app end user (identified by a
// system-generated customerId, NOT their mobile number — mobile number is
// just a login field). A "connection" links that customer to one supplier
// business + the Party record the supplier uses to represent them.

export const connectionStatusEnum = pgEnum("connection_status", ["active", "blocked"]);
export const chatSenderTypeEnum = pgEnum("chat_sender_type", ["customer", "business"]);

export const customersTable = pgTable("mini_app_customers", {
  id: serial("id").primaryKey(),
  customerId: text("customer_id").notNull().unique(),
  mobile: text("mobile").notNull().unique(),
  pin: text("pin").notNull().default("1234"),
  name: text("name"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const connectionsTable = pgTable("mini_app_connections", {
  id: serial("id").primaryKey(),
  customerId: integer("customer_id").notNull().references(() => customersTable.id),
  businessId: integer("business_id").notNull().references(() => businessesTable.id),
  partyId: integer("party_id").notNull().references(() => partiesTable.id),
  permissions: jsonb("permissions").notNull().default({ invoice: true, payment: true, statement: true, gallery: false }),
  status: connectionStatusEnum("status").notNull().default("active"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const customerChatMessagesTable = pgTable("mini_app_chat_messages", {
  id: serial("id").primaryKey(),
  connectionId: integer("connection_id").notNull().references(() => connectionsTable.id),
  senderType: chatSenderTypeEnum("sender_type").notNull(),
  senderName: text("sender_name"),
  message: text("message").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type Customer = typeof customersTable.$inferSelect;
export type Connection = typeof connectionsTable.$inferSelect;
export type CustomerChatMessage = typeof customerChatMessagesTable.$inferSelect;

export const insertCustomerSchema = createInsertSchema(customersTable).omit({ id: true, createdAt: true });
export type InsertCustomer = z.infer<typeof insertCustomerSchema>;

export const insertConnectionSchema = createInsertSchema(connectionsTable).omit({ id: true, createdAt: true });
export type InsertConnection = z.infer<typeof insertConnectionSchema>;

export const insertCustomerChatMessageSchema = createInsertSchema(customerChatMessagesTable).omit({ id: true, createdAt: true });
export type InsertCustomerChatMessage = z.infer<typeof insertCustomerChatMessageSchema>;

// LAN sync tables — LAN/desktop businesses push copies of their vouchers/payments here
// so the mini app can read them via the same cloud API.
export const lanSyncVouchersTable = pgTable("mini_app_lan_vouchers", {
  id: serial("id").primaryKey(),
  businessId: integer("business_id").notNull().references(() => businessesTable.id),
  partyId: integer("party_id").references(() => partiesTable.id),
  externalId: integer("external_id").notNull(),
  voucherType: text("voucher_type").notNull(),
  voucherNumber: text("voucher_number").notNull(),
  date: text("date").notNull(),
  partyName: text("party_name"),
  grandTotal: numeric("grand_total", { precision: 15, scale: 2 }).notNull().default("0"),
  status: text("status").default("posted"),
  notes: text("notes"),
  syncedAt: timestamp("synced_at").notNull().defaultNow(),
}, (t) => [
  // Upsert key — a re-pushed voucher replaces its previous copy instead of duplicating
  uniqueIndex("mini_app_lan_vouchers_biz_ext_type_idx").on(t.businessId, t.externalId, t.voucherType),
]);

export const lanSyncPaymentsTable = pgTable("mini_app_lan_payments", {
  id: serial("id").primaryKey(),
  businessId: integer("business_id").notNull().references(() => businessesTable.id),
  partyId: integer("party_id").references(() => partiesTable.id),
  externalId: integer("external_id").notNull(),
  paymentType: text("payment_type").notNull(),
  paymentNumber: text("payment_number").notNull(),
  date: text("date").notNull(),
  partyName: text("party_name"),
  amount: numeric("amount", { precision: 15, scale: 2 }).notNull().default("0"),
  paymentMode: text("payment_mode").default("cash"),
  status: text("status").default("posted"),
  notes: text("notes"),
  syncedAt: timestamp("synced_at").notNull().defaultNow(),
}, (t) => [
  uniqueIndex("mini_app_lan_payments_biz_ext_type_idx").on(t.businessId, t.externalId, t.paymentType),
]);

export type LanSyncVoucher = typeof lanSyncVouchersTable.$inferSelect;
export type LanSyncPayment = typeof lanSyncPaymentsTable.$inferSelect;
