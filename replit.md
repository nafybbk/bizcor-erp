# BizCor ERP — Indian Business ERP SaaS

## User Preferences

- **EXE Release Rule**: Har kaam ke baad jo EXE mein jaana chahiye — bina puche automatically `artifacts/desktop/package.json` version bump karo, GitHub push karo, aur naya `vX.X.X` tag create karo. Tag se GitHub Actions auto-trigger hota hai. Ye step kabhi skip nahi karna.
- **Git commit author email**: GitHub account (`nafybbk`) par verified email hai `taby.bbk@gmail.com`. Har git commit isi email se hona chahiye (`git config user.email taby.bbk@gmail.com`), warna Vercel deployment "commit email could not be matched to a GitHub account" error se block ho jata hai. Kabhi bhi `bizcor@naewtgroup.com` ya koi aur unverified email commit author ke roop mein use na karo.

## Overview

Full-featured multi-tenant ERP SaaS for Indian businesses. Built as a pnpm monorepo with Express backend and React+Vite frontend.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM (cloud) / SQLite (desktop EXE)
- **Build**: esbuild (backend), Vite 7 (frontend)
- **Auth**: JWT (SESSION_SECRET env var, falls back to "erp-secret-key")
- **Frontend**: React 19, TailwindCSS v4, Wouter (routing), TanStack Query, Recharts

## Artifacts

- `artifacts/api-server` — Express REST API on port 8080, proxied via `/api`
- `artifacts/erp` — React+Vite ERP frontend at `/`
- `artifacts/desktop` — Electron desktop EXE (version source of truth)
- `lib/db` — Drizzle ORM PostgreSQL client + schema
- `lib/db/src/sqlite-schema/` — SQLite schema (desktop mode)

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

## Important Dev Notes

- **SQLite mode**: Use `db.select()` NOT `db.query.*` (query relational not supported in SQLite build)
- **Version sync**: Keep `artifacts/desktop/package.json` AND `artifacts/erp/src/components/Layout.tsx` version in sync
- **Auth**: JWT has `planExpiresAt`, `isTrial`, `role` fields
- **Trial system**: isTrial=true → planExpiresAt = createdAt+30d, Grace = 30d (localhost+admin only), then lock
- **Cloud deploy**: Vercel (frontend) + Vercel/Railway (API). DB = Supabase (SUPABASE_DATABASE_URL)
- **Demo**: Business code `7MJ18V`, email `raj@demo.com`, password `demo1234`

## ERP Modules

Vouchers (SI/CN/PB/DN), Payments (REC/PAY), Masters (Parties/Items/Units/HSN/Tax), Accounting (Ledger/Trial Balance/Outstanding), GST Reports (GSTR-1/3B), Inventory, Dashboard, Business Settings, Tech Support Panel.

### Key Features
- GST-inclusive rate toggle, Serial number mode (auto/manual), Bill-wise payment allocation
- Multi-tenant with plan/trial/grace/lock system
- Super Admin ("Tech Support") panel — businesses, plans, settings, backup
- JSON backup (per-business + all), Login logs, Single-session enforcement
- Referral system (5 referrals = Referral Plan reward, max 2 rewards)
- Bin system for deleted vouchers (soft delete, restore, permanent delete)
- Item Ledger (`/inventory/:id`)
- WorkKar SSO integration (future — HMAC token, shared secret `WORKKAR_SSO_SECRET`)

## BIZCOR MASTER TASK LIST

### ✅ DONE
1. Business Login (erp.naewtgroup.com) aur Tech Login (erpa.naewtgroup.com) alag
2. Tech Login fingerprint (WebAuthn) — code bana
3. Admin profile image upload
4. Plain password storage — tech panel mein dikhta hai
5. Login logs
6. Service Worker fix — API calls intercept band
7. CORS fix — erpa.naewtgroup.com allow hua
8. Party Ledger running balance bug fix
9. Trial Balance standard format
10. Bill-wise toggle UI — Party Statement
11. Payments Bin (soft delete, restore, permanent delete)
12. Item Ledger page (`/inventory/:id`)
13. Trial/Grace/Lock system (v2.3.43) — 30d trial → 30d grace (localhost+admin) → lock
14. LAN Server Version — ✅ ho gaya
15. Local Chat / Internal Messaging — ✅ ho gaya
16. Bin Recall/Reuse system — ✅ ho gaya

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
13. **Referral count bug** — 2 PC pe install ke time referral code dala, lekin referring business ki progress bar old count dikha rahi hai (db.query.* SQLite issue suspected)

### 🟡 NAYE FEATURES — JALDI CHAHIYE
1. Doc start number setting — series shuru kahan se
2. Duplicate doc number — "Already exists" message + dropdown se choose
3. License → Plan visibility — voucher group tick ho tabhi buyer ko plans dikhein
4. Item image upload — Supabase cloud pe, compressed 100KB
5. Barcode generate — item save hote hi auto, scanner se invoice mein add
6. Barcode label print — single ya bulk (quantity per item)
7. Custom label designer — drag & drop, templates, logo, fields
8. DB Backup & Restore (confirm status) — ZIP+PIN, auto-daily, restore before login
9. Support Chat — Login page pe "Help/?" → chat window (phone, email, message) → Tech Panel mein visible

**License Voucher Reuse System:**
10. Voucher code reuse — same code new PC pe, purana auto-block
11. Per-business: "Activation Codes" tab + "Activation Log" tab in Tech Panel

### 🔵 MEDIUM TERM
1. Print template editor
2. Report Designer (Crystal Reports jaisa)
3. Print queue — LAN pe server printer
4. Cash & Bank module — accounts master, contra entry, expense vouchers, Cash Book, Bank Statement

### 🟣 BIG / FUTURE (Active)
1. **Licensing System** — 30d trial, online activation, hardware-bound, client limit, tech panel manage *(active)*
2. **Offline-First / Sync** — IndexedDB + Background Sync, 5 phases *(active)*
3. **Two-Key Licensing** — Installer Key + Plan Key, gap analysis (design ready, implement later)
4. **WorkKar SSO** — future mein, HMAC token, `WORKKAR_SSO_SECRET=bizcor_workkar_secret_2026`
5. **Referral System** — backend ready, bug fix needed (see bugs #13)

### 🗑️ DROPPED / NOT NEEDED
- Local DB as separate feature — LAN version ke andar hi cover ho jaata hai

## WorkKar SSO (Future Reference)
- Endpoint: `GET https://work.naewtgroup.com/sso?token=<HMAC_TOKEN>`
- Payload: `{ mobile, name, exp }` — exp = Date.now() + 5min
- Secret: `WORKKAR_SSO_SECRET=bizcor_workkar_secret_2026`
- Token: `base64url(payload).HMAC-SHA256(payload, secret)`
