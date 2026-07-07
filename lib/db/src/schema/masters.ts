import { pgTable, serial, text, integer, boolean, timestamp, numeric, pgEnum, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { businessesTable } from "./businesses";

export const partyTypeEnum = pgEnum("party_type", ["customer", "supplier", "both"]);
export const balanceTypeEnum = pgEnum("balance_type", ["debit", "credit"]);
export const itemTypeEnum = pgEnum("item_type", ["goods", "service"]);
export const customFieldEntityEnum = pgEnum("custom_field_entity", ["item", "party", "voucher", "voucher_item"]);
export const customFieldTypeEnum = pgEnum("custom_field_type", ["text", "number", "date", "boolean", "select"]);

export const unitsTable = pgTable("units", {
  id: serial("id").primaryKey(),
  businessId: integer("business_id").notNull().references(() => businessesTable.id),
  name: text("name").notNull(),
  symbol: text("symbol").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const hsnCodesTable = pgTable("hsn_codes", {
  id: serial("id").primaryKey(),
  businessId: integer("business_id").notNull().references(() => businessesTable.id),
  code: text("code").notNull(),
  description: text("description"),
  taxRate: numeric("tax_rate", { precision: 5, scale: 2 }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const taxRatesTable = pgTable("tax_rates", {
  id: serial("id").primaryKey(),
  businessId: integer("business_id").notNull().references(() => businessesTable.id),
  name: text("name").notNull(),
  rate: numeric("rate", { precision: 5, scale: 2 }).notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const statesTable = pgTable("states", {
  id: serial("id").primaryKey(),
  businessId: integer("business_id").notNull().references(() => businessesTable.id),
  stateName: text("state_name").notNull(),
  stateCode: text("state_code").notNull(),
  stateAbbr: text("state_abbr"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type State = typeof statesTable.$inferSelect;

export const customFieldsTable = pgTable("custom_fields", {
  id: serial("id").primaryKey(),
  businessId: integer("business_id").notNull().references(() => businessesTable.id),
  entity: customFieldEntityEnum("entity").notNull(),
  fieldName: text("field_name").notNull(),
  fieldLabel: text("field_label").notNull(),
  fieldType: customFieldTypeEnum("field_type").notNull().default("text"),
  options: text("options").array(),
  isRequired: boolean("is_required").notNull().default(false),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const partiesTable = pgTable("parties", {
  id: serial("id").primaryKey(),
  businessId: integer("business_id").notNull().references(() => businessesTable.id),
  name: text("name").notNull(),
  type: partyTypeEnum("type").notNull(),
  gstin: text("gstin"),
  pan: text("pan"),
  phone: text("phone"),
  email: text("email"),
  address: text("address"),
  city: text("city"),
  state: text("state"),
  stateCode: text("state_code"),
  pincode: text("pincode"),
  openingBalance: numeric("opening_balance", { precision: 15, scale: 2 }).default("0"),
  openingBalanceType: balanceTypeEnum("opening_balance_type").default("debit"),
  creditLimit: numeric("credit_limit", { precision: 15, scale: 2 }).default("0"),
  creditDays: integer("credit_days").default(0),
  isActive: boolean("is_active").notNull().default(true),
  customFields: jsonb("custom_fields"),
  customerCode: text("customer_code"),
  supplierCode: text("supplier_code"),
  pin: text("pin"),
  miniAppEnabled: boolean("mini_app_enabled").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const itemsTable = pgTable("items", {
  id: serial("id").primaryKey(),
  businessId: integer("business_id").notNull().references(() => businessesTable.id),
  name: text("name").notNull(),
  description: text("description"),
  type: itemTypeEnum("type").notNull().default("goods"),
  hsnCode: text("hsn_code"),
  unitId: integer("unit_id").references(() => unitsTable.id),
  taxRateId: integer("tax_rate_id").references(() => taxRatesTable.id),
  salePrice: numeric("sale_price", { precision: 15, scale: 2 }).default("0"),
  purchasePrice: numeric("purchase_price", { precision: 15, scale: 2 }).default("0"),
  openingStock: numeric("opening_stock", { precision: 15, scale: 3 }).default("0"),
  lowStockAlert: numeric("low_stock_alert", { precision: 15, scale: 3 }).default("0"),
  isActive: boolean("is_active").notNull().default(true),
  customFields: jsonb("custom_fields"),
  shippingAddresses: jsonb("shipping_addresses"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type Unit = typeof unitsTable.$inferSelect;
export type HsnCode = typeof hsnCodesTable.$inferSelect;
export type TaxRate = typeof taxRatesTable.$inferSelect;
export type CustomField = typeof customFieldsTable.$inferSelect;
export type Party = typeof partiesTable.$inferSelect;
export type Item = typeof itemsTable.$inferSelect;

export const insertPartySchema = createInsertSchema(partiesTable).omit({ id: true, createdAt: true });
export type InsertParty = z.infer<typeof insertPartySchema>;

export const insertItemSchema = createInsertSchema(itemsTable).omit({ id: true, createdAt: true });
export type InsertItem = z.infer<typeof insertItemSchema>;
