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

## BIZCOR MASTER TASK LIST (Last updated: May 2026)

### ✅ KAAM HO CHUKA HAI
1. Business Login (erp.naewtgroup.com) aur Tech Login (erpa.naewtgroup.com) alag
2. Tech Login fingerprint (WebAuthn) — code bana, fix pending
3. Admin profile image upload
4. Plain password storage — tech panel mein dikhta hai
5. Login logs
6. Service Worker fix — API calls intercept band
7. CORS fix — erpa.naewtgroup.com allow hua
8. erpa domain Vercel + Hostinger DNS configured
9. Party Ledger running balance bug fix
10. Trial Balance standard format (Debtors/Creditors/Sales/Purchase/Bank/Cash)
11. Bill-wise toggle UI added to Party Statement

### 🔴 BUG FIXES — PRIORITY
1. Zero clear — input tap/click pe 0 hat jaaye
2. Enter = next line — Add Item pe nahi jaaye
3. Manual doc number — manual ON hone par bhi auto le raha hai
4. Tax field order — Rate se pehle aaye ya drag-reorder
5. Fingerprint register band ho gayi, login par error
6. Password List Drawer — kahin dikh nahi rahi
7. Admin profile pic save nahi ho rahi
8. Business logo ke andar "BizCor" likh jaata hai
9. Receipt/Payment edit form — galat amount dikhna (outstanding balance instead of voucher amount)
10. Bill-wise toggle — kisi bhi party ka invoice nahi dikha raha (blank)
11. Outstanding Receivables/Payables pages — blank aa rahi hain
12. Party Select dropdown — click pe immediately list khule (bina type kiye)

### 🟡 NAYE FEATURES — JALDI CHAHIYE
1. Doc start number setting — series shuru kahan se
2. Duplicate doc number — "Already exists" message + dropdown se choose
3. Deleted docs Bin — restore ya permanent delete
4. License → Plan visibility — voucher group tick ho tabhi buyer ko plans dikhein
5. Item image upload — Supabase cloud pe, compressed 100KB
6. Barcode generate — item save hote hi auto, scanner se invoice mein add
7. Barcode label print — single ya bulk (quantity per item)
8. Custom label designer — drag & drop, templates, logo, fields

### 🔵 MEDIUM TERM FEATURES
1. Print template editor — invoice/report layout customize
2. Report Designer — Crystal Reports jaisa, client ke liye custom reports
3. Internal chat — staff-to-staff message LAN pe
4. Print queue — kisi bhai client se server printer pe print
5. Offline item/party creation — LAN version ke saath

**Cash & Bank Module (May 2026 discuss hua):**
6. Cash & Bank accounts master — multiple accounts (Cash in Hand, Petty Cash, SBI, HDFC, etc.)
7. Receipts/Payments mein account link — har transaction se cash/bank balance auto update ho
8. Contra entry — cash to bank ya bank to cash transfer
9. Expense vouchers — rent, electricity, salary, office supplies (cash/bank se deduct)
10. Cash Book report — daily cash in/out with running balance
11. Bank Statement report — per bank account transactions
12. Expense heads master — CRUD (Rent, Electricity, Salary, Petty Expenses, etc.)

### 🟣 BIG / FUTURE FEATURES

**LAN SERVER VERSION (Aaj discuss hua — May 2026):**
Architecture: Ek PC = Server (Node.js + PostgreSQL local), baaki PCs = Clients (browser se connect)
1. Windows installer (.exe) — ek click install, Node + PostgreSQL sab bundle mein
2. http://bizcor.local hostname — IP yaad nahi rakhna, mDNS se resolve
3. QR code — scan karo, app khule (same WiFi zaroori)
4. Windows Firewall auto-configure — installer setup ke waqt
5. Cloud = Read only, invoices sirf local se banen
6. Backup schedule — auto raat ko, manual button se bhi
7. Restore — ek click se backup se wapas

**LOCAL DB (Aaj discuss hua):**
- Server PC pe PostgreSQL locally install hoga
- Clients sirf browser se connect karenge (koi install nahi)
- Offline: sirf server PC pe data, baaki clients internet chahte hain (LAN pe)
- Data kabhi cloud pe nahi jaata jab tak user manually backup share na kare

**LOCAL CHAT / INTERNAL MESSAGING (Aaj discuss hua):**
- LAN pe staff-to-staff chat — internet ki zaroorat nahi
- Text + file + image send karna
- WebSocket based (server PC host kare, clients connect karein)
- Cloud version mein bhi chahiye (Supabase Realtime use hoga)

**LICENSING SYSTEM:**
8. 30-day trial timer
9. Online activation — hardware bound
10. Client limit as per plan
11. Heartbeat — ghost server prevent
12. Format/PC change = online reactivation
13. Tech panel se sab manage
14. License → Plan visibility: Tech panel mein voucher group tick hone par hi buyer ko plans dikhein (aaj discuss hua)

**OFFLINE-FIRST / SYNC (Aaj discuss hua — strategy):**
Strategy: IndexedDB + Background Sync
- Phase 1: IndexedDB setup — parties, items, vouchers locally store hon
- Phase 2: Reads local se, writes local mein + sync queue
- Phase 3: Background sync — online hone par auto push to server
- Phase 4: Conflict resolution UI (newer timestamp jite, ya user se pucha jaaye)
- Phase 5: Multi-device sync (ek business, alag devices)

Details:
- Har record pe synced / pending / conflict status dikhega
- Doc numbers: offline mein temporary UUID, server pe real number milega
- 3 PC pe LAN sync — local network pe real-time WebSocket
- Single-device offline pehle (Phase 1-3), multi-device sync baad mein

---

## OFFLINE LAN VERSION — Licensing & Anti-Piracy Design (May 2026)

**Scope: Sirf offline LAN version ke liye. Online cloud ka koi masla nahi.**

### Two-Key System:

**Key 1 — Installer Key (EXE pack ke saath TXT mein):**
- Installer ke saath bundled hoti hai (TXT file)
- Install ke waqt online net ON hona zaroori hai
- Installer Key cloud pe validate hoti hai
- Install time pe email/password + puri hardware info (MAC, CPU ID, etc.) is key se bind ho jaati hai
- Koi aur kaam nahi — sirf install tracking

**Key 2 — Plan Subscription Key (Tech panel se manually dete hain):**
- Business jab plan khareedta hai, Tech panel se Plan Key generate karo
- Business apne BizCor mein Plan Key daalta hai (net ON)
- Activation pe: cloud retrieve karta hai woh Installer Key jo install pe bind thi
- Tech panel mein dono dates milti hain: Install Date + Plan Activation Date = Gap

### Gap Analysis (Tech Panel mein visible):
- 2 din gap → Genuine customer, turant kharida
- 30 din gap → Trial use kiya, normal
- 60 din gap → Late, note karo
- 90+ din gap → Policy decision (allow/partial lock/late fee)

### Free Version bhi same flow:
- Free Key online activate hogi
- No offline bypass possible

### Zero Piracy kyun:
- Koi bhi install bina net ke nahi ho sakta (Installer Key online validate)
- Plan Key single-use + hardware-bound
- Free Key bhi online validate
- Heartbeat ki zaroorat NAHI — net sirf do baar chahiye (install + plan activate)

### Bonus — Market Data:
- Conversion rate (install vs plan)
- Region-wise installations
- Free vs Paid ratio
- Average install-to-purchase gap

---

## REFERRAL SYSTEM — Design Discussion (May 2026)

**Current state:** Sirf UI hai (TYGZ9Y code display hota hai), koi backend tracking nahi.

**Kya banana hai:**

DB changes (businesses table):
- `referral_code TEXT` — har business ka unique code (auto on registration)
- `referred_by_code TEXT` — jis code se aaya (nullable, registration form mein optional field)

Backend:
- Registration pe: `referred_by_code` save karo, referring business ka count +1
- `GET /api/super-admin/referrals` — referral stats API
- Auto-reward: jab count 5 ho → auto "Referral Plan" assign

Tech Panel:
- Businesses list mein "Referrals" column (kitne refer kiye)
- Business detail mein "Referred by: [Name/Code]"
- Alag "Referral Analytics" page — top referrers, monthly count, reward status

Business Admin Panel:
- Registration form mein optional "Referral Code" field
- Progress bar (0/5), count, reward status (as shown in screenshot)

---

## OFFLINE LAN VERSION — QR Code Activation & Payment Flow (May 2026)

**Complete activation flow designed for offline BizCor desktop:**

### Buyer Side — Step by Step:
1. BizCor desktop app kholo → email + phone number daalo
2. App hardware fingerprint (MAC + CPU + Disk Serial) + email + phone encode karke **QR code generate** kare
3. Buyer apne **phone se QR scan kare** (phone pe internet hota hai, PC pe nahi)
4. Phone ka browser **BizCor activation website** khole
5. Website pe clearly likha ho: **"Your activation code will be sent to: [buyer@email.com]"** — taaki buyer confirm kar sake
6. Buyer **plan select kare** + **payment receipt ki clear photo upload** kare
7. Submit → "Verification pending, check your email" message aaye
8. Agar koi issue ho → **Tech support email clearly visible** ho (jo BizCor App Settings mein set hai)

### Tech Support Side (Tech Panel):
9. Naya activation request notification aaye
10. Receipt image + selected plan clearly dikhe
11. Tech payment verify kare → **"Approve & Activate"** button dabaaye
12. System auto **Activation Code generate** kare → buyer ke email pe jaaye (hardware-bound)

### Buyer Side — Final Step:
13. Email check kare → Activation Code mile
14. BizCor desktop mein Code daale → **Activated!** ✓

### Kyun Best Hai:
- PC pe internet zero — sirf phone ka mobile data
- Fully trackable — receipt + plan + hardware sab record mein
- Fraud zero — tech ne khud dekh ke approve kiya
- Activation Code hardware-bound — sirf usi PC pe chalega
- Buyer ko koi website account nahi banana — sirf email chahiye
- Support contact always visible — buyer kabhi stuck nahi

### Phase 2 (Baad Mein):
- Razorpay/UPI gateway integrate karo → payment auto-verify → tech approval bhi auto
- Fully self-service ho jaaye

---

## Demo Credentials

Test business: code `7MJ18V`, email `raj@demo.com`, password `demo1234`

## Portability / Migration

The codebase is fully portable. To migrate to Vercel + Supabase:
1. Set `DATABASE_URL` to Supabase PostgreSQL connection string
2. Set `SESSION_SECRET` to a random 32+ char string
3. Deploy `artifacts/api-server` as a Node.js server (or convert to serverless functions)
4. Deploy `artifacts/erp` as a static site to Vercel
5. Run `pnpm --filter @workspace/db run push` against the new DB URL
