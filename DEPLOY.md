# BizCor ERP — Vercel + Supabase Deployment Guide

## Overview
- **Database** → Supabase (PostgreSQL)
- **Backend API** → Vercel Project 1 (`artifacts/api-server`)
- **Frontend** → Vercel Project 2 (`artifacts/erp`)

---

## Step 1: Push Code to GitHub

Replit se GitHub pe push karo:
1. Replit mein left sidebar → **Git** icon
2. "Connect to GitHub" → new repo banao (e.g. `bizcor-erp`)
3. Commit + Push karo

---

## Step 2: Supabase Database Setup

### 2a. Supabase Project banao
1. https://supabase.com → New Project
2. Project name: `bizcor-erp`
3. Database password note karo (yeh baad mein chahiye)
4. Region: Asia (Mumbai preferred)

### 2b. Connection String lo
1. Supabase Dashboard → Settings → Database
2. "Connection string" section → **URI** tab
3. Copy karo — looks like:
   ```
   postgresql://postgres:[YOUR-PASSWORD]@db.xxxxxxxxxxxx.supabase.co:5432/postgres
   ```
   > ⚠️ `[YOUR-PASSWORD]` ki jagah apna actual password daalo

### 2c. Schema Migrate karo (Drizzle Push)
Replit terminal mein run karo:
```bash
DATABASE_URL="postgresql://postgres:[PASSWORD]@db.xxxx.supabase.co:5432/postgres" pnpm --filter @workspace/db run push
```
This creates all tables in Supabase automatically.

---

## Step 3: Backend Deploy on Vercel

### 3a. Vercel Project Create
1. https://vercel.com → Add New Project
2. Import karo — apna GitHub repo select karo
3. **Root Directory**: `artifacts/api-server` ← important!
4. Framework Preset: **Other**
5. Build Command: (vercel.json se auto-pick hoga)
6. Deploy karo

### 3b. Environment Variables set karo
Vercel Dashboard → Project Settings → Environment Variables:

| Variable | Value |
|----------|-------|
| `DATABASE_URL` | Supabase connection string (Step 2b) |
| `SESSION_SECRET` | Koi bhi random 32+ char string (e.g. `openssl rand -hex 32` se) |
| `NODE_ENV` | `production` |
| `CORS_ORIGIN` | Frontend URL (Step 4 ke baad fill karo, e.g. `https://bizcor.vercel.app`) |

### 3c. Redeploy karo
Environment variables set karne ke baad → Deployments → Redeploy

Note karo: Backend URL hoga kuch is tarah:
```
https://bizcor-api.vercel.app
```

---

## Step 4: Frontend Deploy on Vercel

### 4a. Second Vercel Project
1. Vercel → Add New Project → Same GitHub repo
2. **Root Directory**: `artifacts/erp` ← important!
3. Framework Preset: **Vite**
4. Output Directory: `dist/public`

### 4b. Environment Variables set karo

| Variable | Value |
|----------|-------|
| `VITE_API_URL` | Backend URL from Step 3c (e.g. `https://bizcor-api.vercel.app`) |

### 4c. Deploy karo

---

## Step 5: Final CORS Fix

Backend project mein `CORS_ORIGIN` update karo:
- Vercel → Backend Project → Settings → Environment Variables
- `CORS_ORIGIN` → frontend ka URL (e.g. `https://bizcor.vercel.app`)
- Redeploy backend

---

## Step 6: Custom Domain (Optional)

Dono projects mein:
- Vercel → Project → Settings → Domains
- Apna domain add karo (e.g. `app.bizcor.in` for frontend, `api.bizcor.in` for backend)

---

## Checklist

- [ ] Code GitHub pe push kiya
- [ ] Supabase project banaya
- [ ] Supabase mein DB schema push kiya
- [ ] Backend Vercel pe deploy kiya
- [ ] Backend ke env vars set kiye (DATABASE_URL, SESSION_SECRET, NODE_ENV)
- [ ] Frontend Vercel pe deploy kiya
- [ ] Frontend ka VITE_API_URL set kiya
- [ ] Backend ka CORS_ORIGIN update kiya
- [ ] Test kiya — login karo, data check karo

---

## Default Admin Login (Production)
- **Phone**: 9999999999
- **Password**: Tech@1234

(Super admin auto-seed hota hai first boot pe)

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| "CORS error" in browser | CORS_ORIGIN env var check karo — exact frontend URL hona chahiye |
| Database connection error | DATABASE_URL correct hai? Supabase SSL auto-detected hota hai |
| Build fails | Vercel logs dekho — `installCommand` se pnpm install ho raha hai? |
| "Cannot find module @workspace/db" | Root Directory sahi set hai? (`artifacts/api-server`) |
