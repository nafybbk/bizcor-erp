import { pgTable, serial, text, integer, boolean, timestamp, numeric, pgEnum, jsonb } from "drizzle-orm/pg-core";
import { businessesTable } from "./businesses";
import { partiesTable } from "./masters";

export const voucherTypeEnum = pgEnum("voucher_type", ["sales_invoice", "credit_note", "purchase_bill", "debit_note"]);
export const voucherStatusEnum = pgEnum("voucher_status", ["draft", "posted", "paid", "partial", "cancelled"]);
export const discountTypeEnum = pgEnum("discount_type", ["percent", "amount"]);

export const vouchersTable = pgTable("vouchers", {
  id: serial("id").primaryKey(),
  businessId: integer("business_id").notNull().references(() => businessesTable.id),
  voucherType: voucherTypeEnum("voucher_type").notNull(),
  voucherNumber: text("voucher_number").notNull(),
  date: text("date").notNull(),
  partyId: integer("party_id").notNull().references(() => partiesTable.id),
  billingAddress: text("billing_address"),
  useShippingAddress: boolean("use_shipping_address").default(false),
  shippingAddress: text("shipping_address"),
  subTotal: numeric("sub_total", { precision: 15, scale: 2 }).default("0"),
  totalDiscount: numeric("total_discount", { precision: 15, scale: 2 }).default("0"),
  taxableAmount: numeric("taxable_amount", { precision: 15, scale: 2 }).default("0"),
  totalCgst: numeric("total_cgst", { precision: 15, scale: 2 }).default("0"),
  totalSgst: numeric("total_sgst", { precision: 15, scale: 2 }).default("0"),
  totalIgst: numeric("total_igst", { precision: 15, scale: 2 }).default("0"),
  totalTax: numeric("total_tax", { precision: 15, scale: 2 }).default("0"),
  transportCharges: numeric("transport_charges", { precision: 15, scale: 2 }).default("0"),
  roundOff: numeric("round_off", { precision: 15, scale: 2 }).default("0"),
  grandTotal: numeric("grand_total", { precision: 15, scale: 2 }).notNull().default("0"),
  paidAmount: numeric("paid_amount", { precision: 15, scale: 2 }).default("0"),
  status: voucherStatusEnum("status").notNull().default("posted"),
  notes: text("notes"),
  termsAndConditions: text("terms_and_conditions"),
  linkedVoucherId: integer("linked_voucher_id"),
  isInterState: boolean("is_inter_state").default(false),
  placeOfSupply: text("place_of_supply"),
  customFields: jsonb("custom_fields"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  deletedAt: timestamp("deleted_at"),
});

export const voucherItemsTable = pgTable("voucher_items", {
  id: serial("id").primaryKey(),
  voucherId: integer("voucher_id").notNull().references(() => vouchersTable.id),
  itemId: integer("item_id"),
  itemName: text("item_name").notNull(),
  description: text("description"),
  hsnCode: text("hsn_code"),
  quantity: numeric("quantity", { precision: 15, scale: 3 }).notNull(),
  unit: text("unit"),
  rate: numeric("rate", { precision: 15, scale: 2 }).notNull(),
  discount: numeric("discount", { precision: 15, scale: 2 }).default("0"),
  discountType: discountTypeEnum("discount_type").default("percent"),
  taxableAmount: numeric("taxable_amount", { precision: 15, scale: 2 }).notNull(),
  taxRateId: integer("tax_rate_id"),
  taxRate: numeric("tax_rate", { precision: 5, scale: 2 }).default("0"),
  cgst: numeric("cgst", { precision: 15, scale: 2 }).default("0"),
  sgst: numeric("sgst", { precision: 15, scale: 2 }).default("0"),
  igst: numeric("igst", { precision: 15, scale: 2 }).default("0"),
  taxAmount: numeric("tax_amount", { precision: 15, scale: 2 }).default("0"),
  total: numeric("total", { precision: 15, scale: 2 }).notNull(),
  customFields: jsonb("custom_fields"),
});

export type Voucher = typeof vouchersTable.$inferSelect;
export type VoucherItem = typeof voucherItemsTable.$inferSelect;
