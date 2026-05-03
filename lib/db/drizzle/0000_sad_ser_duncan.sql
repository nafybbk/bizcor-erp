CREATE TYPE "public"."billing_cycle" AS ENUM('monthly', 'yearly');--> statement-breakpoint
CREATE TYPE "public"."business_status" AS ENUM('active', 'inactive', 'suspended', 'trial');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('business_admin', 'staff');--> statement-breakpoint
CREATE TYPE "public"."balance_type" AS ENUM('debit', 'credit');--> statement-breakpoint
CREATE TYPE "public"."custom_field_entity" AS ENUM('item', 'party', 'voucher', 'voucher_item');--> statement-breakpoint
CREATE TYPE "public"."custom_field_type" AS ENUM('text', 'number', 'date', 'boolean', 'select');--> statement-breakpoint
CREATE TYPE "public"."item_type" AS ENUM('goods', 'service');--> statement-breakpoint
CREATE TYPE "public"."party_type" AS ENUM('customer', 'supplier', 'both');--> statement-breakpoint
CREATE TYPE "public"."discount_type" AS ENUM('percent', 'amount');--> statement-breakpoint
CREATE TYPE "public"."voucher_status" AS ENUM('draft', 'posted', 'paid', 'partial', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."voucher_type" AS ENUM('sales_invoice', 'credit_note', 'purchase_bill', 'debit_note');--> statement-breakpoint
CREATE TYPE "public"."payment_mode" AS ENUM('cash', 'bank', 'cheque', 'upi', 'other');--> statement-breakpoint
CREATE TYPE "public"."payment_type" AS ENUM('receipt', 'payment');--> statement-breakpoint
CREATE TABLE "app_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"value" text,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "app_settings_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "businesses" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"business_code" text NOT NULL,
	"gstin" text,
	"pan" text,
	"address" text,
	"city" text,
	"state" text,
	"state_code" text,
	"pincode" text,
	"phone" text,
	"email" text,
	"business_type" text,
	"logo" text,
	"plan_id" integer,
	"plan_start_date" timestamp,
	"plan_expires_at" timestamp,
	"is_trial" boolean DEFAULT false NOT NULL,
	"status" "business_status" DEFAULT 'active' NOT NULL,
	"financial_year_start" text DEFAULT '04-01',
	"currency" text DEFAULT 'INR',
	"invoice_prefix" text DEFAULT 'SI',
	"credit_note_prefix" text DEFAULT 'CN',
	"bill_prefix" text DEFAULT 'PB',
	"debit_note_prefix" text DEFAULT 'DN',
	"serial_number_mode" text DEFAULT 'auto',
	"number_series" integer DEFAULT 1,
	"number_digits" integer DEFAULT 4,
	"number_separator" text DEFAULT '-',
	"bank_name" text,
	"bank_account" text,
	"bank_ifsc" text,
	"bank_branch" text,
	"signatory_name" text,
	"invoice_footer" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "businesses_business_code_unique" UNIQUE("business_code")
);
--> statement-breakpoint
CREATE TABLE "license_vouchers" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"plan_id" integer NOT NULL,
	"validity_days" integer DEFAULT 30 NOT NULL,
	"selling_price" numeric(10, 2),
	"status" text DEFAULT 'active' NOT NULL,
	"notes" text,
	"generated_by" integer,
	"redeemed_by_business_id" integer,
	"redeemed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "license_vouchers_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "plans" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"price" numeric(10, 2) NOT NULL,
	"billing_cycle" "billing_cycle" DEFAULT 'monthly' NOT NULL,
	"max_users" integer DEFAULT 5 NOT NULL,
	"trial_days" integer DEFAULT 0 NOT NULL,
	"validity_days" integer DEFAULT 30 NOT NULL,
	"features" text[],
	"max_vouchers_per_month" integer,
	"max_items" integer,
	"max_parties" integer,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "super_admins" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"phone" text,
	"password_hash" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "super_admins_email_unique" UNIQUE("email"),
	CONSTRAINT "super_admins_phone_unique" UNIQUE("phone")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"business_id" integer NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"role" "user_role" DEFAULT 'staff' NOT NULL,
	"permissions" text[] DEFAULT '{}',
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "custom_fields" (
	"id" serial PRIMARY KEY NOT NULL,
	"business_id" integer NOT NULL,
	"entity" "custom_field_entity" NOT NULL,
	"field_name" text NOT NULL,
	"field_label" text NOT NULL,
	"field_type" "custom_field_type" DEFAULT 'text' NOT NULL,
	"options" text[],
	"is_required" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hsn_codes" (
	"id" serial PRIMARY KEY NOT NULL,
	"business_id" integer NOT NULL,
	"code" text NOT NULL,
	"description" text,
	"tax_rate" numeric(5, 2),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "items" (
	"id" serial PRIMARY KEY NOT NULL,
	"business_id" integer NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"type" "item_type" DEFAULT 'goods' NOT NULL,
	"hsn_code" text,
	"unit_id" integer,
	"tax_rate_id" integer,
	"sale_price" numeric(15, 2) DEFAULT '0',
	"purchase_price" numeric(15, 2) DEFAULT '0',
	"opening_stock" numeric(15, 3) DEFAULT '0',
	"low_stock_alert" numeric(15, 3) DEFAULT '0',
	"is_active" boolean DEFAULT true NOT NULL,
	"custom_fields" jsonb,
	"shipping_addresses" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "parties" (
	"id" serial PRIMARY KEY NOT NULL,
	"business_id" integer NOT NULL,
	"name" text NOT NULL,
	"type" "party_type" NOT NULL,
	"gstin" text,
	"pan" text,
	"phone" text,
	"email" text,
	"address" text,
	"city" text,
	"state" text,
	"state_code" text,
	"pincode" text,
	"opening_balance" numeric(15, 2) DEFAULT '0',
	"opening_balance_type" "balance_type" DEFAULT 'debit',
	"credit_limit" numeric(15, 2) DEFAULT '0',
	"credit_days" integer DEFAULT 0,
	"is_active" boolean DEFAULT true NOT NULL,
	"custom_fields" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tax_rates" (
	"id" serial PRIMARY KEY NOT NULL,
	"business_id" integer NOT NULL,
	"name" text NOT NULL,
	"rate" numeric(5, 2) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "units" (
	"id" serial PRIMARY KEY NOT NULL,
	"business_id" integer NOT NULL,
	"name" text NOT NULL,
	"symbol" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "voucher_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"voucher_id" integer NOT NULL,
	"item_id" integer,
	"item_name" text NOT NULL,
	"description" text,
	"hsn_code" text,
	"quantity" numeric(15, 3) NOT NULL,
	"unit" text,
	"rate" numeric(15, 2) NOT NULL,
	"discount" numeric(15, 2) DEFAULT '0',
	"discount_type" "discount_type" DEFAULT 'percent',
	"taxable_amount" numeric(15, 2) NOT NULL,
	"tax_rate_id" integer,
	"tax_rate" numeric(5, 2) DEFAULT '0',
	"cgst" numeric(15, 2) DEFAULT '0',
	"sgst" numeric(15, 2) DEFAULT '0',
	"igst" numeric(15, 2) DEFAULT '0',
	"tax_amount" numeric(15, 2) DEFAULT '0',
	"total" numeric(15, 2) NOT NULL,
	"custom_fields" jsonb
);
--> statement-breakpoint
CREATE TABLE "vouchers" (
	"id" serial PRIMARY KEY NOT NULL,
	"business_id" integer NOT NULL,
	"voucher_type" "voucher_type" NOT NULL,
	"voucher_number" text NOT NULL,
	"date" text NOT NULL,
	"party_id" integer NOT NULL,
	"billing_address" text,
	"use_shipping_address" boolean DEFAULT false,
	"shipping_address" text,
	"sub_total" numeric(15, 2) DEFAULT '0',
	"total_discount" numeric(15, 2) DEFAULT '0',
	"taxable_amount" numeric(15, 2) DEFAULT '0',
	"total_cgst" numeric(15, 2) DEFAULT '0',
	"total_sgst" numeric(15, 2) DEFAULT '0',
	"total_igst" numeric(15, 2) DEFAULT '0',
	"total_tax" numeric(15, 2) DEFAULT '0',
	"transport_charges" numeric(15, 2) DEFAULT '0',
	"round_off" numeric(15, 2) DEFAULT '0',
	"grand_total" numeric(15, 2) DEFAULT '0' NOT NULL,
	"paid_amount" numeric(15, 2) DEFAULT '0',
	"status" "voucher_status" DEFAULT 'posted' NOT NULL,
	"notes" text,
	"terms_and_conditions" text,
	"linked_voucher_id" integer,
	"is_inter_state" boolean DEFAULT false,
	"place_of_supply" text,
	"custom_fields" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payment_allocations" (
	"id" serial PRIMARY KEY NOT NULL,
	"payment_id" integer NOT NULL,
	"voucher_id" integer NOT NULL,
	"allocated_amount" numeric(15, 2) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" serial PRIMARY KEY NOT NULL,
	"business_id" integer NOT NULL,
	"payment_number" text NOT NULL,
	"type" "payment_type" NOT NULL,
	"date" text NOT NULL,
	"party_id" integer NOT NULL,
	"amount" numeric(15, 2) NOT NULL,
	"payment_mode" "payment_mode" DEFAULT 'cash' NOT NULL,
	"reference_number" text,
	"notes" text,
	"is_on_account" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "businesses" ADD CONSTRAINT "businesses_plan_id_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."plans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "license_vouchers" ADD CONSTRAINT "license_vouchers_plan_id_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."plans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "license_vouchers" ADD CONSTRAINT "license_vouchers_generated_by_super_admins_id_fk" FOREIGN KEY ("generated_by") REFERENCES "public"."super_admins"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "license_vouchers" ADD CONSTRAINT "license_vouchers_redeemed_by_business_id_businesses_id_fk" FOREIGN KEY ("redeemed_by_business_id") REFERENCES "public"."businesses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "custom_fields" ADD CONSTRAINT "custom_fields_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hsn_codes" ADD CONSTRAINT "hsn_codes_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "items" ADD CONSTRAINT "items_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "items" ADD CONSTRAINT "items_unit_id_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "items" ADD CONSTRAINT "items_tax_rate_id_tax_rates_id_fk" FOREIGN KEY ("tax_rate_id") REFERENCES "public"."tax_rates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "parties" ADD CONSTRAINT "parties_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tax_rates" ADD CONSTRAINT "tax_rates_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "units" ADD CONSTRAINT "units_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "voucher_items" ADD CONSTRAINT "voucher_items_voucher_id_vouchers_id_fk" FOREIGN KEY ("voucher_id") REFERENCES "public"."vouchers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vouchers" ADD CONSTRAINT "vouchers_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vouchers" ADD CONSTRAINT "vouchers_party_id_parties_id_fk" FOREIGN KEY ("party_id") REFERENCES "public"."parties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_voucher_id_vouchers_id_fk" FOREIGN KEY ("voucher_id") REFERENCES "public"."vouchers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_party_id_parties_id_fk" FOREIGN KEY ("party_id") REFERENCES "public"."parties"("id") ON DELETE no action ON UPDATE no action;