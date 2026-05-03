# BizERP — Indian Business ERP SaaS

## Overview

Full-featured multi-tenant ERP SaaS for Indian businesses. Built as a pnpm monorepo with Express backend and React+Vite frontend.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Build**: esbuild (backend), Vite 7 (frontend)
- **Auth**: JWT (SESSION_SECRET env var, falls back to "erp-secret-key")
- **Frontend**: React 19, TailwindCSS v4, Wouter (routing), TanStack Query, Recharts

## Artifacts

- `artifacts/api-server` — Express REST API on port 8080, proxied via `/api`
- `artifacts/erp` — React+Vite ERP frontend at `/`
- `lib/db` — Drizzle ORM PostgreSQL client + schema

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

## ERP Modules & Features

### Business Registration
- Self-registration creates business with auto-generated business code
- Auto-creates 6 default units (PCS, KG, LTR, BOX, MTR, NOS)
- Auto-creates 5 GST tax rates (0%, 5%, 12%, 18%, 28%)

### Authentication
- Business login: requires Business Code + email + password
- Super Admin ("Tech Support") login: email + password only (no business code)
- Auth stored in localStorage: `erp_token`, `erp_user`, `erp_business`

### Vouchers
- **Sales Invoices** (`SI-XXXX`)
- **Credit Notes** (`CN-XXXX`)
- **Purchase Bills** (`PB-XXXX`)
- **Debit Notes** (`DN-XXXX`)
- GST calculation: discount before GST, intra-state = CGST+SGST, inter-state = IGST
- **GST-inclusive rate toggle** — check "GST Inc." to auto back-calculate base rate
- **Serial number mode** — Auto (system generates) OR Manual (user enters freely)
- Transport charges added after tax
- Optional shipping address
- Tick-select items (checkbox to include/exclude from invoice)

### Payments
- **Receipts** (`REC-XXXX`) — from customers
- **Payments** (`PAY-XXXX`) — to suppliers
- Bill-wise allocation OR on-account
- Automatic voucher status update (partial/paid)

### Masters (All with Edit + Delete)
- Parties (customers/suppliers/both) with GSTIN, state code, opening balance
- Items (goods/service, HSN, tax rate, sale/purchase price, stock)
- Units of measurement — inline row editing
- HSN/SAC codes — inline row editing
- GST tax rates — inline row editing

### Accounting
- Party ledger with Dr/Cr entries
- Trial balance
- Outstanding receivables
- Outstanding payables

### GST Reports
- GSTR-1 (B2B + B2C breakdown, JSON export)
- GSTR-3B (output tax vs ITC, net payable)

### Inventory
- Real-time stock levels (opening + purchased - sold)
- Average rate & stock value
- Low stock alerts

### Dashboard
- Sales/purchases summary (today/this month/last month/this year)
- Receivables & payables outstanding
- GST payable (net)
- Sales & purchases 12-month bar chart
- Top customers by revenue

### Business Settings
- Business profile (GSTIN, PAN, address, financial year start)
- Invoice prefix configuration (SI, CN, PB, DN per business)
- Serial number mode (auto/manual per business)
- **Download JSON backup** (all parties, items, vouchers, payments)
- DB connection mode indicator (cloud/local toggle in localStorage)
- Users with role-based access (business_admin, staff)
- Permission system for staff (modules they can access)

### Tech Support Panel (formerly Super Admin)
- **Dashboard** — total businesses, trial count, users, new this month, plan breakdown
- **Businesses** — search, filter, paginate; assign plan, set expiry date, mark trial; per-business JSON backup
- **Plans** — full CRUD (name, price, billing cycle, validity days, trial days, max users, features list, sort order, active toggle)
- **App Settings** — change software name, support email/phone, logo URL, primary color, footer text; deployment info
- **Backup All** — single click to download all businesses' data as JSON

## API Route Structure

```
POST /api/auth/login
POST /api/auth/super-admin-login
POST /api/auth/logout
GET  /api/businesses/current
PATCH /api/businesses/current
POST /api/businesses/register
GET  /api/businesses/backup            (business-level backup download)

GET  /api/parties         (search, type filter, pagination)
POST /api/parties
PATCH /api/parties/:id
DELETE /api/parties/:id

GET  /api/items
POST /api/items
PATCH /api/items/:id
DELETE /api/items/:id

GET  /api/masters/units
POST /api/masters/units
PATCH /api/masters/units/:id
DELETE /api/masters/units/:id
GET  /api/masters/tax-rates
POST /api/masters/tax-rates
PATCH /api/masters/tax-rates/:id
DELETE /api/masters/tax-rates/:id
GET  /api/masters/hsn
POST /api/masters/hsn
PATCH /api/masters/hsn/:id
DELETE /api/masters/hsn/:id

GET  /api/sales/invoices
POST /api/sales/invoices
GET  /api/sales/invoices/:id
DELETE /api/sales/invoices/:id
(same pattern for /sales/credit-notes, /purchases/bills, /purchases/debit-notes)

GET  /api/payments
POST /api/payments
GET  /api/payments/outstanding?partyId=&type=
DELETE /api/payments/:id

GET  /api/inventory/stock
GET  /api/accounting/ledger/:partyId
GET  /api/accounting/trial-balance
GET  /api/accounting/outstanding-receivables
GET  /api/accounting/outstanding-payables

GET  /api/gst/gstr1?month=&year=
GET  /api/gst/gstr1/export?month=&year=
GET  /api/gst/gstr3b?month=&year=

GET  /api/dashboard/summary?period=
GET  /api/dashboard/sales-trend
GET  /api/dashboard/top-parties?type=&limit=

GET  /api/super-admin/stats
GET  /api/super-admin/businesses
PATCH /api/super-admin/businesses/:id
GET  /api/super-admin/backup?businessId=   (all or single business)
GET  /api/super-admin/plans
POST /api/super-admin/plans
PATCH /api/super-admin/plans/:id
DELETE /api/super-admin/plans/:id
GET  /api/super-admin/settings
POST /api/super-admin/settings

GET  /api/users
POST /api/users
PATCH /api/users/:id
DELETE /api/users/:id
```

## DB Schema Tables

- `super_admins` — platform tech support logins
- `plans` — subscription plans (price, validity, trial, features)
- `businesses` — multi-tenant root (plan assigned, expiry, trial flag, invoice prefixes, serial mode)
- `app_settings` — key-value store for software name, branding, support contacts
- `users` — business users
- `parties` — customers/suppliers
- `items` — products/services
- `units` — units of measurement
- `hsn_codes` — HSN/SAC code master
- `tax_rates` — GST rate definitions
- `vouchers` — all transaction vouchers
- `voucher_items` — line items
- `payments` — receipts and payments
- `payment_allocations` — bill-wise payment linking
- `custom_fields` — configurable custom fields per entity

## Demo Credentials

Test business: code `7MJ18V`, email `raj@demo.com`, password `demo1234`

## Portability / Migration

The codebase is fully portable. To migrate to Vercel + Supabase:
1. Set `DATABASE_URL` to Supabase PostgreSQL connection string
2. Set `SESSION_SECRET` to a random 32+ char string
3. Deploy `artifacts/api-server` as a Node.js server (or convert to serverless functions)
4. Deploy `artifacts/erp` as a static site to Vercel
5. Run `pnpm --filter @workspace/db run push` against the new DB URL
