import { sqliteTable, integer, text } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

const NOW = sql`(datetime('now'))`;

export const unitsTable = sqliteTable("units", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  businessId: integer("business_id").notNull(),
  name: text("name").notNull(),
  symbol: text("symbol").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: text("created_at").notNull().default(NOW),
});

export const hsnCodesTable = sqliteTable("hsn_codes", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  businessId: integer("business_id").notNull(),
  code: text("code").notNull(),
  description: text("description"),
  taxRate: text("tax_rate"),
  createdAt: text("created_at").notNull().default(NOW),
});

export const taxRatesTable = sqliteTable("tax_rates", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  businessId: integer("business_id").notNull(),
  name: text("name").notNull(),
  rate: text("rate").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: text("created_at").notNull().default(NOW),
});

export const customFieldsTable = sqliteTable("custom_fields", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  businessId: integer("business_id").notNull(),
  entity: text("entity").notNull(),
  fieldName: text("field_name").notNull(),
  fieldLabel: text("field_label").notNull(),
  fieldType: text("field_type").notNull().default("text"),
  options: text("options", { mode: "json" }).$type<string[]>(),
  isRequired: integer("is_required", { mode: "boolean" }).notNull().default(false),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: text("created_at").notNull().default(NOW),
});

export const partiesTable = sqliteTable("parties", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  businessId: integer("business_id").notNull(),
  name: text("name").notNull(),
  type: text("type").notNull(),
  gstin: text("gstin"),
  pan: text("pan"),
  phone: text("phone"),
  email: text("email"),
  address: text("address"),
  city: text("city"),
  state: text("state"),
  stateCode: text("state_code"),
  pincode: text("pincode"),
  openingBalance: text("opening_balance").default("0"),
  openingBalanceType: text("opening_balance_type").default("debit"),
  creditLimit: text("credit_limit").default("0"),
  creditDays: integer("credit_days").default(0),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  customFields: text("custom_fields", { mode: "json" }),
  createdAt: text("created_at").notNull().default(NOW),
});

export const itemsTable = sqliteTable("items", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  businessId: integer("business_id").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  type: text("type").notNull().default("goods"),
  hsnCode: text("hsn_code"),
  unitId: integer("unit_id"),
  taxRateId: integer("tax_rate_id"),
  salePrice: text("sale_price").default("0"),
  purchasePrice: text("purchase_price").default("0"),
  openingStock: text("opening_stock").default("0"),
  lowStockAlert: text("low_stock_alert").default("0"),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  customFields: text("custom_fields", { mode: "json" }),
  shippingAddresses: text("shipping_addresses", { mode: "json" }),
  createdAt: text("created_at").notNull().default(NOW),
});
