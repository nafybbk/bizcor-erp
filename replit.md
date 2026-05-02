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
- Super Admin login: email + password only (no business code)
- Auth stored in localStorage: `erp_token`, `erp_user`, `erp_business`

### Vouchers
- **Sales Invoices** (`SI-XXXX`)
- **Credit Notes** (`CN-XXXX`)
- **Purchase Bills** (`PB-XXXX`)
- **Debit Notes** (`DN-XXXX`)
- GST calculation: discount before GST, intra-state = CGST+SGST, inter-state = IGST
- Transport charges added after tax
- Optional shipping address
- Tick-select items (checkbox to include/exclude from invoice)

### Payments
- **Receipts** (`REC-XXXX`) — from customers
- **Payments** (`PAY-XXXX`) — to suppliers
- Bill-wise allocation OR on-account
- Automatic voucher status update (partial/paid)

### Masters
- Parties (customers/suppliers/both) with GSTIN, state code, opening balance
- Items (goods/service, HSN, tax rate, sale/purchase price, stock)
- Units of measurement
- HSN codes
- GST tax rates

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

### Settings
- Business profile (GSTIN, PAN, address, financial year start)
- Users with role-based access (business_admin, staff)
- Permission system for staff (modules they can access)

### Super Admin
- View all businesses with status
- Activate/deactivate businesses
- Business stats dashboard

## API Route Structure

```
POST /api/auth/login
POST /api/auth/logout
GET  /api/businesses/current
PATCH /api/businesses/current
POST /api/businesses/register

GET  /api/parties         (search, type filter, pagination)
POST /api/parties
PATCH /api/parties/:id
DELETE /api/parties/:id

GET  /api/items
POST /api/items
PATCH /api/items/:id
DELETE /api/items/:id

GET  /api/masters/units
GET  /api/masters/tax-rates
GET  /api/masters/hsn

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

GET  /api/super-admin/businesses
PATCH /api/super-admin/businesses/:id
GET  /api/super-admin/stats

GET  /api/users
POST /api/users
PATCH /api/users/:id
DELETE /api/users/:id
```

## DB Schema Tables

- `businesses` — multi-tenant root entity
- `users` — business users + super admins
- `parties` — customers/suppliers
- `items` — products/services
- `units` — units of measurement
- `hsn_codes` — HSN code master
- `tax_rates` — GST rate definitions
- `vouchers` — all transaction vouchers (sales_invoice, credit_note, purchase_bill, debit_note)
- `voucher_items` — line items for each voucher
- `payments` — receipts and payments
- `payment_allocations` — bill-wise payment linking
- `custom_fields` — configurable custom fields per entity

## Demo Credentials

After registration a business code is generated (shown in top bar).
Test business: code `7MJ18V`, email `raj@demo.com`, password `demo1234`
