// ─────────────────────────────────────────────────────────────────────────────
//  SMART ERP → BizCor Import Tool  |  Standalone Node.js App
//  Run: node index.js
//  Then open: http://localhost:9191
// ─────────────────────────────────────────────────────────────────────────────

const express = require("express");
const mssql = require("mssql");
const https = require("https");
const http = require("http");
const fs = require("fs");
const path = require("path");

const config = JSON.parse(fs.readFileSync(path.join(__dirname, "config.json"), "utf8"));

const app = express();
app.use(express.json());

// ── State ────────────────────────────────────────────────────────────────────
let authenticated = false;
let bizToken = null;
let sqlPool = null;
let bizParties = {};   // name(lower) → { id, type }
let bizItems = {};     // name(lower) → id
let bizVouchers = {};  // voucherNumber → id (to avoid duplicates)
let bizPayments = {};  // paymentNumber → true

// ── HTTP helper (works for http and https) ───────────────────────────────────
function apiCall(method, urlStr, body, token) {
  return new Promise((resolve, reject) => {
    const u = new URL(urlStr);
    const isHttps = u.protocol === "https:";
    const mod = isHttps ? https : http;
    const data = body ? JSON.stringify(body) : null;
    const headers = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;
    if (data) headers["Content-Length"] = Buffer.byteLength(data);

    const req = mod.request({
      hostname: u.hostname,
      port: u.port || (isHttps ? 443 : 80),
      path: u.pathname + u.search,
      method,
      headers,
    }, (res) => {
      let raw = "";
      res.on("data", d => raw += d);
      res.on("end", () => {
        try {
          const json = JSON.parse(raw);
          if (res.statusCode >= 400) reject({ status: res.statusCode, ...json });
          else resolve(json);
        } catch { reject({ status: res.statusCode, raw }); }
      });
    });
    req.on("error", reject);
    if (data) req.write(data);
    req.end();
  });
}

const BASE = config.bizCor.url.replace(/\/$/, "");

// ── SQL Server connect ────────────────────────────────────────────────────────
async function connectSQL() {
  if (sqlPool) return sqlPool;
  sqlPool = await mssql.connect({
    server: config.sqlServer.host,
    database: config.sqlServer.database,
    user: config.sqlServer.user,
    password: config.sqlServer.password,
    port: config.sqlServer.port || 1433,
    options: config.sqlServer.options || { encrypt: false, trustServerCertificate: true },
  });
  return sqlPool;
}

// ── BizCor login ─────────────────────────────────────────────────────────────
async function bizLogin() {
  const res = await apiCall("POST", `${BASE}/api/auth/login`, {
    businessCode: config.bizCor.businessCode,
    email: config.bizCor.email,
    password: config.bizCor.password,
  });
  bizToken = res.token;
  return res;
}

// ── Load BizCor masters ───────────────────────────────────────────────────────
async function loadBizMasters() {
  // Load parties (all pages)
  let page = 1, total = Infinity;
  bizParties = {};
  while (Object.keys(bizParties).length < total) {
    const res = await apiCall("GET", `${BASE}/api/parties?limit=500&page=${page}`, null, bizToken);
    if (!res.data || res.data.length === 0) break;
    total = res.total || 0;
    res.data.forEach(p => { bizParties[p.name.toLowerCase().trim()] = { id: p.id, type: p.type }; });
    page++;
    if (res.data.length < 500) break;
  }

  // Load items (all pages)
  page = 1; total = Infinity;
  bizItems = {};
  while (Object.keys(bizItems).length < total) {
    const res = await apiCall("GET", `${BASE}/api/items?limit=500&page=${page}`, null, bizToken);
    if (!res.data || res.data.length === 0) break;
    total = res.total || 0;
    res.data.forEach(i => { bizItems[i.name.toLowerCase().trim()] = i.id; });
    page++;
    if (res.data.length < 500) break;
  }

  // Load existing vouchers (to skip duplicates)
  bizVouchers = {};
  for (const type of ["sales_invoice", "purchase_bill", "credit_note", "debit_note"]) {
    let pg = 1;
    while (true) {
      const ep = type === "sales_invoice" ? "sales/invoices" : type === "purchase_bill" ? "purchases/bills" : type === "credit_note" ? "sales/credit-notes" : "purchases/debit-notes";
      const res = await apiCall("GET", `${BASE}/api/${ep}?limit=500&page=${pg}`, null, bizToken);
      if (!res.data || res.data.length === 0) break;
      res.data.forEach(v => { bizVouchers[v.voucherNumber] = v.id; });
      pg++;
      if (res.data.length < 500) break;
    }
  }

  // Load existing payments
  bizPayments = {};
  let pg = 1;
  while (true) {
    const res = await apiCall("GET", `${BASE}/api/payments?limit=500&page=${pg}`, null, bizToken);
    if (!res.data || res.data.length === 0) break;
    res.data.forEach(p => { bizPayments[p.paymentNumber] = true; });
    pg++;
    if (res.data.length < 500) break;
  }
}

// ── Format date from SMART ERP ────────────────────────────────────────────────
function formatDate(d) {
  if (!d) return new Date().toISOString().slice(0, 10);
  if (d instanceof Date) return d.toISOString().slice(0, 10);
  const s = String(d);
  // DD/MM/YYYY or DD-MM-YYYY
  const m = s.match(/^(\d{2})[\/\-](\d{2})[\/\-](\d{4})$/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  // YYYY-MM-DD already
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  return s.slice(0, 10);
}

// ── Determine tax rate from CGST+SGST amounts vs taxable ─────────────────────
function guessTaxRate(taxableAmt, cgstAmt, sgstAmt) {
  if (!taxableAmt || taxableAmt <= 0) return 0;
  const totalGst = (cgstAmt || 0) + (sgstAmt || 0);
  if (totalGst <= 0) return 0;
  const rate = Math.round((totalGst / taxableAmt) * 100);
  // Round to nearest standard GST rate
  const std = [0, 3, 5, 12, 18, 28];
  return std.reduce((prev, cur) => Math.abs(cur - rate) < Math.abs(prev - rate) ? cur : prev);
}

const GST_CODES = new Set((config.import.gstItemCodes || ["cgst","sgst","CGST","SGST","igst","IGST","CARRIAGE","carriage"]).map(s => s.toLowerCase()));

// ── ROUTES ───────────────────────────────────────────────────────────────────

// PIN verify
app.post("/api/verify-pin", (req, res) => {
  if (req.body.pin === String(config.pin)) {
    authenticated = true;
    res.json({ ok: true });
  } else {
    res.status(401).json({ ok: false, message: "Galat PIN" });
  }
});

function checkAuth(req, res, next) {
  if (!authenticated) { res.status(401).json({ error: "PIN required" }); return; }
  next();
}

// Test connections
app.post("/api/connect", checkAuth, async (req, res) => {
  const result = { sql: false, biz: false, company: null, sqlError: null, bizError: null };
  try {
    const pool = await connectSQL();
    const r = await pool.request().query("SELECT TOP 1 CompanyNameE, CurBrCode, BranchName FROM dbo.PrgSetup");
    result.sql = true;
    result.company = r.recordset[0] || null;
  } catch (e) { result.sqlError = e.message; }

  try {
    await bizLogin();
    result.biz = true;
  } catch (e) { result.bizError = e.message || JSON.stringify(e); }

  res.json(result);
});

// Preview counts
app.get("/api/preview", checkAuth, async (req, res) => {
  try {
    const pool = await connectSQL();
    const fromDate = req.query.from || "2020-01-01";
    const toDate = req.query.to || new Date().toISOString().slice(0, 10);

    const [sales, purchases, receipts, payments, creditNotes] = await Promise.all([
      pool.request()
        .input("from", mssql.VarChar, fromDate)
        .input("to", mssql.VarChar, toDate)
        .query(`SELECT COUNT(DISTINCT DocNo) as cnt FROM dbo.TxHeaderP WHERE CONVERT(varchar,DateG,23) BETWEEN @from AND @to`),
      pool.request()
        .input("from", mssql.VarChar, fromDate)
        .input("to", mssql.VarChar, toDate)
        .query(`SELECT COUNT(DISTINCT DocNo) as cnt FROM dbo.pGRNHead WHERE CONVERT(varchar,DateG,23) BETWEEN @from AND @to`),
      pool.request()
        .input("from", mssql.VarChar, fromDate)
        .input("to", mssql.VarChar, toDate)
        .query(`SELECT COUNT(*) as cnt FROM dbo.ReceiptVoucher WHERE CONVERT(varchar,DateG,23) BETWEEN @from AND @to`),
      pool.request()
        .input("from", mssql.VarChar, fromDate)
        .input("to", mssql.VarChar, toDate)
        .query(`SELECT COUNT(*) as cnt FROM dbo.PaymentVoucher WHERE CONVERT(varchar,DateG,23) BETWEEN @from AND @to`),
      pool.request()
        .input("from", mssql.VarChar, fromDate)
        .input("to", mssql.VarChar, toDate)
        .query(`SELECT COUNT(DISTINCT DocNo) as cnt FROM dbo.CustDrCrNoteP WHERE CONVERT(varchar,DateG,23) BETWEEN @from AND @to`).catch(() => ({ recordset: [{ cnt: 0 }] })),
    ]);

    await loadBizMasters();

    res.json({
      sales: sales.recordset[0].cnt,
      purchases: purchases.recordset[0].cnt,
      receipts: receipts.recordset[0].cnt,
      payments: payments.recordset[0].cnt,
      creditNotes: creditNotes.recordset[0].cnt,
      bizcorParties: Object.keys(bizParties).length,
      bizcorItems: Object.keys(bizItems).length,
      bizcorExistingVouchers: Object.keys(bizVouchers).length,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── IMPORT ───────────────────────────────────────────────────────────────────
app.post("/api/import", checkAuth, async (req, res) => {
  const { from, to, importSales, importPurchases, importReceipts, importPayments } = req.body;
  const fromDate = from || "2020-01-01";
  const toDate = to || new Date().toISOString().slice(0, 10);

  const log = [];
  const counts = { sales: 0, purchases: 0, receipts: 0, payments: 0, skipped: 0, errors: 0 };

  try {
    const pool = await connectSQL();
    if (!bizToken) await bizLogin();
    await loadBizMasters();

    // ── 1. SALES INVOICES ─────────────────────────────────────────────────
    if (importSales) {
      const headers = await pool.request()
        .input("from", mssql.VarChar, fromDate)
        .input("to", mssql.VarChar, toDate)
        .query(`SELECT DocNo, DateG, CustCode, CustName, NetTotal FROM dbo.TxHeaderP WHERE CONVERT(varchar,DateG,23) BETWEEN @from AND @to ORDER BY DateG`);

      for (const h of headers.recordset) {
        const docNo = String(h.DocNo).trim();
        if (bizVouchers[docNo]) { counts.skipped++; continue; }

        const partyName = String(h.CustName || "").trim();
        const partyInfo = bizParties[partyName.toLowerCase()];
        if (!partyInfo) { counts.errors++; log.push(`SI ${docNo}: Party not found — ${partyName}`); continue; }

        // Get detail items (excluding GST rows)
        const details = await pool.request()
          .input("docno", mssql.VarChar, docNo)
          .query(`SELECT ItemCode, ItemNameE, Qty, SalesPrice, DiscPer FROM dbo.TxDetailp WHERE DocNo=@docno`);

        // Get GST amounts
        let cgstAmt = 0, sgstAmt = 0, transportAmt = 0;
        const actualItems = [];
        for (const d of details.recordset) {
          const code = String(d.ItemCode || "").toLowerCase().trim();
          if (code === "cgst") { cgstAmt += Number(d.SalesPrice || 0); continue; }
          if (code === "sgst") { sgstAmt += Number(d.SalesPrice || 0); continue; }
          if (code === "carriage" || code === "freight") { transportAmt += Number(d.SalesPrice || 0); continue; }
          if (GST_CODES.has(code)) continue;
          actualItems.push(d);
        }

        if (actualItems.length === 0) { counts.skipped++; continue; }

        const netTotal = Number(h.NetTotal || 0);
        const taxableAmt = netTotal - cgstAmt - sgstAmt - transportAmt;
        const taxRate = guessTaxRate(taxableAmt, cgstAmt, sgstAmt);

        const items = actualItems.map(d => ({
          itemName: String(d.ItemNameE || d.ItemCode || "Item").trim(),
          itemId: bizItems[String(d.ItemNameE || "").toLowerCase().trim()] || null,
          quantity: Number(d.Qty) || 1,
          rate: Number(d.SalesPrice) || 0,
          discount: Number(d.DiscPer) || 0,
          discountType: "percent",
          taxRate,
          taxRateId: null,
        }));

        try {
          await apiCall("POST", `${BASE}/api/sales/invoices`, {
            voucherNumber: docNo,
            date: formatDate(h.DateG),
            partyId: partyInfo.id,
            items,
            transportCharges: transportAmt,
            status: "posted",
            notes: `Imported from SMART ERP`,
          }, bizToken);
          bizVouchers[docNo] = true;
          counts.sales++;
        } catch (e) {
          counts.errors++;
          log.push(`SI ${docNo}: ${e.message || JSON.stringify(e).slice(0, 80)}`);
        }
      }
    }

    // ── 2. PURCHASE BILLS ─────────────────────────────────────────────────
    if (importPurchases) {
      const headers = await pool.request()
        .input("from", mssql.VarChar, fromDate)
        .input("to", mssql.VarChar, toDate)
        .query(`SELECT DocNo, DateG, SupCode, SupName, TotalVal, RDocNo, RdocDate FROM dbo.pGRNHead WHERE CONVERT(varchar,DateG,23) BETWEEN @from AND @to ORDER BY DateG`);

      for (const h of headers.recordset) {
        const docNo = String(h.DocNo).trim();
        if (bizVouchers[docNo]) { counts.skipped++; continue; }

        const partyName = String(h.SupName || "").trim();
        const partyInfo = bizParties[partyName.toLowerCase()];
        if (!partyInfo) { counts.errors++; log.push(`PB ${docNo}: Supplier not found — ${partyName}`); continue; }

        const details = await pool.request()
          .input("docno", mssql.VarChar, docNo)
          .query(`SELECT ItemCode, ItemNameE, Qty, PurPrice, DiscPer FROM dbo.pGRNTrx WHERE DocNo=@docno`);

        let cgstAmt = 0, sgstAmt = 0, transportAmt = 0;
        const actualItems = [];
        for (const d of details.recordset) {
          const code = String(d.ItemCode || "").toLowerCase().trim();
          if (code === "cgst") { cgstAmt += Number(d.PurPrice || 0); continue; }
          if (code === "sgst") { sgstAmt += Number(d.PurPrice || 0); continue; }
          if (code === "carriage" || code === "freight") { transportAmt += Number(d.PurPrice || 0); continue; }
          if (GST_CODES.has(code)) continue;
          actualItems.push(d);
        }

        if (actualItems.length === 0) { counts.skipped++; continue; }

        const totalVal = Number(h.TotalVal || 0);
        const taxableAmt = totalVal - cgstAmt - sgstAmt - transportAmt;
        const taxRate = guessTaxRate(taxableAmt, cgstAmt, sgstAmt);

        const items = actualItems.map(d => ({
          itemName: String(d.ItemNameE || d.ItemCode || "Item").trim(),
          itemId: bizItems[String(d.ItemNameE || "").toLowerCase().trim()] || null,
          quantity: Number(d.Qty) || 1,
          rate: Number(d.PurPrice) || 0,
          discount: Number(d.DiscPer) || 0,
          discountType: "percent",
          taxRate,
          taxRateId: null,
        }));

        try {
          await apiCall("POST", `${BASE}/api/purchases/bills`, {
            voucherNumber: docNo,
            date: formatDate(h.DateG),
            partyId: partyInfo.id,
            items,
            transportCharges: transportAmt,
            notes: h.RDocNo ? `Supplier Bill: ${h.RDocNo}` : `Imported from SMART ERP`,
            status: "posted",
          }, bizToken);
          bizVouchers[docNo] = true;
          counts.purchases++;
        } catch (e) {
          counts.errors++;
          log.push(`PB ${docNo}: ${e.message || JSON.stringify(e).slice(0, 80)}`);
        }
      }
    }

    // ── 3. RECEIPTS (Customer payments) ───────────────────────────────────
    if (importReceipts) {
      const receipts = await pool.request()
        .input("from", mssql.VarChar, fromDate)
        .input("to", mssql.VarChar, toDate)
        .query(`SELECT v.VouNo, v.DateG, v.CustCode, v.CustName, v.TotalAmt, d.InvNo, d.CurrentPayment FROM dbo.ReceiptVoucher v LEFT JOIN dbo.ReceiptVoucherDetP d ON d.VouNo=v.VouNo WHERE CONVERT(varchar,v.DateG,23) BETWEEN @from AND @to ORDER BY v.DateG`);

      const grouped = {};
      for (const r of receipts.recordset) {
        const k = String(r.VouNo).trim();
        if (!grouped[k]) grouped[k] = { ...r, allocs: [] };
        if (r.InvNo) grouped[k].allocs.push({ invNo: String(r.InvNo).trim(), amt: Number(r.CurrentPayment || 0) });
      }

      for (const [vouNo, rec] of Object.entries(grouped)) {
        const recNum = `REC-${vouNo}`;
        if (bizPayments[recNum]) { counts.skipped++; continue; }

        const partyName = String(rec.CustName || "").trim();
        const partyInfo = bizParties[partyName.toLowerCase()];
        if (!partyInfo) { counts.errors++; log.push(`REC ${vouNo}: Customer not found — ${partyName}`); continue; }

        const totalAmt = Number(rec.TotalAmt || 0);
        const allocations = [];
        for (const a of rec.allocs) {
          const vId = bizVouchers[a.invNo];
          if (vId && a.amt > 0) allocations.push({ voucherId: vId, allocatedAmount: a.amt });
        }

        try {
          await apiCall("POST", `${BASE}/api/payments`, {
            type: "receipt",
            date: formatDate(rec.DateG),
            partyId: partyInfo.id,
            amount: totalAmt,
            paymentMode: config.import.defaultPaymentMode || "cash",
            isOnAccount: allocations.length === 0,
            allocations,
            notes: `Imported from SMART ERP | VouNo: ${vouNo}`,
          }, bizToken);
          bizPayments[recNum] = true;
          counts.receipts++;
        } catch (e) {
          counts.errors++;
          log.push(`REC ${vouNo}: ${e.message || JSON.stringify(e).slice(0, 80)}`);
        }
      }
    }

    // ── 4. PAYMENTS (Supplier payments) ───────────────────────────────────
    if (importPayments) {
      const payments = await pool.request()
        .input("from", mssql.VarChar, fromDate)
        .input("to", mssql.VarChar, toDate)
        .query(`SELECT v.VouNo, v.DateG, v.SupCode, v.SupName, v.TotalAmt, d.InvNo, d.CurrentPayment FROM dbo.PaymentVoucher v LEFT JOIN dbo.PaymentVoucherDetP d ON d.VouNo=v.VouNo WHERE CONVERT(varchar,v.DateG,23) BETWEEN @from AND @to ORDER BY v.DateG`);

      const grouped = {};
      for (const r of payments.recordset) {
        const k = String(r.VouNo).trim();
        if (!grouped[k]) grouped[k] = { ...r, allocs: [] };
        if (r.InvNo) grouped[k].allocs.push({ invNo: String(r.InvNo).trim(), amt: Number(r.CurrentPayment || 0) });
      }

      for (const [vouNo, pay] of Object.entries(grouped)) {
        const payNum = `PAY-${vouNo}`;
        if (bizPayments[payNum]) { counts.skipped++; continue; }

        const partyName = String(pay.SupName || "").trim();
        const partyInfo = bizParties[partyName.toLowerCase()];
        if (!partyInfo) { counts.errors++; log.push(`PAY ${vouNo}: Supplier not found — ${partyName}`); continue; }

        const totalAmt = Number(pay.TotalAmt || 0);
        const allocations = [];
        for (const a of pay.allocs) {
          const vId = bizVouchers[a.invNo];
          if (vId && a.amt > 0) allocations.push({ voucherId: vId, allocatedAmount: a.amt });
        }

        try {
          await apiCall("POST", `${BASE}/api/payments`, {
            type: "payment",
            date: formatDate(pay.DateG),
            partyId: partyInfo.id,
            amount: totalAmt,
            paymentMode: config.import.defaultPaymentMode || "cash",
            isOnAccount: allocations.length === 0,
            allocations,
            notes: `Imported from SMART ERP | VouNo: ${vouNo}`,
          }, bizToken);
          bizPayments[payNum] = true;
          counts.payments++;
        } catch (e) {
          counts.errors++;
          log.push(`PAY ${vouNo}: ${e.message || JSON.stringify(e).slice(0, 80)}`);
        }
      }
    }

    res.json({ ok: true, counts, log });
  } catch (e) {
    res.status(500).json({ error: e.message, log });
  }
});

// ── HTML UI ───────────────────────────────────────────────────────────────────
app.get("/", (req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>SMART ERP → BizCor Import</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:system-ui,sans-serif;background:#0f172a;color:#e2e8f0;min-height:100vh;display:flex;align-items:center;justify-content:center}
  .card{background:#1e293b;border:1px solid #334155;border-radius:16px;padding:32px;width:520px;max-width:95vw;box-shadow:0 25px 50px rgba(0,0,0,.5)}
  h1{font-size:1.1rem;font-weight:700;color:#38bdf8;margin-bottom:4px}
  .sub{font-size:.8rem;color:#64748b;margin-bottom:24px}
  label{font-size:.78rem;color:#94a3b8;display:block;margin-bottom:4px}
  input[type=password],input[type=text],input[type=date]{width:100%;background:#0f172a;border:1px solid #334155;border-radius:8px;padding:10px 14px;color:#e2e8f0;font-size:.9rem;outline:none;margin-bottom:16px}
  input:focus{border-color:#38bdf8}
  button{width:100%;background:#0ea5e9;color:#fff;border:none;border-radius:8px;padding:12px;font-size:.95rem;font-weight:600;cursor:pointer;transition:.2s}
  button:hover{background:#0284c7}
  button:disabled{background:#334155;color:#64748b;cursor:not-allowed}
  .step{display:none}
  .step.active{display:block}
  .status{display:flex;align-items:center;gap:10px;padding:12px 16px;border-radius:8px;margin-bottom:12px;font-size:.85rem}
  .status.ok{background:#042f2e;border:1px solid #065f46;color:#6ee7b7}
  .status.fail{background:#2d1215;border:1px solid #7f1d1d;color:#fca5a5}
  .status.wait{background:#1e3a5f;border:1px solid #1e40af;color:#93c5fd}
  .dot{width:8px;height:8px;border-radius:50%;background:currentColor;flex-shrink:0}
  .preview-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:16px 0}
  .preview-box{background:#0f172a;border:1px solid #334155;border-radius:8px;padding:12px;text-align:center}
  .preview-box .num{font-size:1.6rem;font-weight:700;color:#38bdf8}
  .preview-box .lbl{font-size:.72rem;color:#64748b;margin-top:2px}
  .check-row{display:flex;align-items:center;gap:8px;margin-bottom:8px;font-size:.85rem;color:#cbd5e1}
  .check-row input{width:auto;margin:0}
  .log{background:#0f172a;border:1px solid #334155;border-radius:8px;padding:12px;font-size:.75rem;color:#94a3b8;max-height:180px;overflow-y:auto;margin-top:12px;font-family:monospace}
  .log .err{color:#fca5a5}
  .result-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:12px 0}
  .result-box{background:#0f172a;border:1px solid #334155;border-radius:8px;padding:10px;text-align:center}
  .result-box .num{font-size:1.3rem;font-weight:700;color:#34d399}
  .result-box .lbl{font-size:.7rem;color:#64748b}
  .err-box .num{color:#f87171}
  .date-row{display:grid;grid-template-columns:1fr 1fr;gap:10px}
  .back{background:#334155;margin-top:8px}
  .back:hover{background:#475569}
  .spinner{display:inline-block;width:14px;height:14px;border:2px solid #334155;border-top-color:#38bdf8;border-radius:50%;animation:spin .7s linear infinite;vertical-align:middle;margin-right:6px}
  @keyframes spin{to{transform:rotate(360deg)}}
  .company-badge{background:#042f2e;border:1px solid #065f46;border-radius:8px;padding:10px 14px;margin-bottom:16px;font-size:.85rem;color:#6ee7b7}
</style>
</head>
<body>
<div class="card">
  <h1>SMART ERP → BizCor</h1>
  <p class="sub">Data Import Tool &nbsp;|&nbsp; HMR Systems</p>

  <!-- Step 1: PIN -->
  <div class="step active" id="s1">
    <label>Security PIN</label>
    <input type="password" id="pin" placeholder="••••" onkeydown="if(event.key==='Enter')verifyPin()" autofocus>
    <button onclick="verifyPin()" id="pinBtn">Aage Barhein</button>
    <div id="pinErr" style="color:#fca5a5;font-size:.8rem;margin-top:8px;text-align:center"></div>
  </div>

  <!-- Step 2: Connect -->
  <div class="step" id="s2">
    <button onclick="testConnect()" id="connectBtn">SQL Server + BizCor Connect Karein</button>
    <div id="connectStatus" style="margin-top:16px"></div>
    <button class="back" onclick="goStep(1)">Wapas</button>
  </div>

  <!-- Step 3: Preview -->
  <div class="step" id="s3">
    <div id="companyBadge" class="company-badge" style="display:none"></div>
    <label>Date Range (SMART ERP se kitna data laana hai)</label>
    <div class="date-row">
      <div><label>From</label><input type="date" id="fromDate" value="${new Date(new Date().getFullYear(), 3, 1).toISOString().slice(0,10)}"></div>
      <div><label>To</label><input type="date" id="toDate" value="${new Date().toISOString().slice(0,10)}"></div>
    </div>
    <button onclick="loadPreview()" id="previewBtn">Preview Dekhein</button>
    <div id="previewArea" style="display:none">
      <div class="preview-grid" id="previewGrid"></div>
      <div style="margin:16px 0 8px;font-size:.8rem;color:#94a3b8;font-weight:600">Kya import karna hai:</div>
      <div class="check-row"><input type="checkbox" id="chkSales" checked><label>Sales Invoices</label></div>
      <div class="check-row"><input type="checkbox" id="chkPurchases" checked><label>Purchase Bills</label></div>
      <div class="check-row"><input type="checkbox" id="chkReceipts" checked><label>Customer Receipts (payments received)</label></div>
      <div class="check-row"><input type="checkbox" id="chkPayments" checked><label>Supplier Payments (payments made)</label></div>
      <button onclick="goStep(4)" style="margin-top:16px">Confirm aur Import Karein →</button>
    </div>
    <button class="back" onclick="goStep(2)" style="margin-top:8px">Wapas</button>
  </div>

  <!-- Step 4: Confirm + Import -->
  <div class="step" id="s4">
    <div class="status wait"><span class="dot"></span>Yeh action irreversible hai. BizCor mein data add ho jaayega.</div>
    <button onclick="startImport()" id="importBtn">✓ Confirm — Import Shuru Karein</button>
    <button class="back" onclick="goStep(3)">Wapas</button>
  </div>

  <!-- Step 5: Results -->
  <div class="step" id="s5">
    <div id="resultContent"></div>
    <button class="back" onclick="goStep(3)" style="margin-top:12px">Aur Import Karein (naya range)</button>
  </div>
</div>

<script>
let company = null;

function goStep(n) {
  document.querySelectorAll('.step').forEach((s,i) => s.classList.toggle('active', i===n-1));
}

async function post(url, body) {
  const r = await fetch(url, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body) });
  const j = await r.json();
  if (!r.ok) throw j;
  return j;
}

async function get(url) {
  const r = await fetch(url);
  const j = await r.json();
  if (!r.ok) throw j;
  return j;
}

async function verifyPin() {
  const pin = document.getElementById('pin').value;
  const btn = document.getElementById('pinBtn');
  btn.disabled = true; btn.innerHTML = '<span class="spinner"></span>Verify ho raha hai…';
  try {
    await post('/api/verify-pin', { pin });
    goStep(2);
  } catch(e) {
    document.getElementById('pinErr').textContent = e.message || 'Galat PIN';
  }
  btn.disabled = false; btn.textContent = 'Aage Barhein';
}

async function testConnect() {
  const btn = document.getElementById('connectBtn');
  btn.disabled = true; btn.innerHTML = '<span class="spinner"></span>Connect ho raha hai…';
  const el = document.getElementById('connectStatus');
  el.innerHTML = '';
  try {
    const r = await post('/api/connect', {});
    company = r.company;

    el.innerHTML = (r.sql
      ? '<div class="status ok"><span class="dot"></span>SQL Server connected — ' + (r.company?.CompanyNameE || 'DB') + ' | Branch: ' + (r.company?.BranchName || '') + '</div>'
      : '<div class="status fail"><span class="dot"></span>SQL Server Error: ' + (r.sqlError || 'Failed') + '</div>')
    + (r.biz
      ? '<div class="status ok"><span class="dot"></span>BizCor connected — ' + '${config.bizCor.url}' + '</div>'
      : '<div class="status fail"><span class="dot"></span>BizCor Error: ' + (r.bizError || 'Failed') + '</div>');

    if (r.sql && r.biz) {
      setTimeout(() => goStep(3), 900);
      if (company) {
        const badge = document.getElementById('companyBadge');
        badge.textContent = '🏢 ' + (company.CompanyNameE || '') + (company.BranchName ? ' — ' + company.BranchName : '') + (company.CurBrCode ? ' | Branch: ' + company.CurBrCode : '');
        badge.style.display = 'block';
      }
    }
  } catch(e) {
    el.innerHTML = '<div class="status fail"><span class="dot"></span>' + (e.error || JSON.stringify(e)) + '</div>';
  }
  btn.disabled = false; btn.textContent = 'Dobara Try Karein';
}

async function loadPreview() {
  const btn = document.getElementById('previewBtn');
  btn.disabled = true; btn.innerHTML = '<span class="spinner"></span>Preview load ho raha hai…';
  try {
    const from = document.getElementById('fromDate').value;
    const to = document.getElementById('toDate').value;
    const r = await get('/api/preview?from=' + from + '&to=' + to);
    document.getElementById('previewGrid').innerHTML =
      box(r.sales, 'Sales Invoices') + box(r.purchases, 'Purchase Bills') +
      box(r.receipts, 'Receipts') + box(r.payments, 'Payments') +
      box(r.creditNotes, 'Credit Notes') + box(r.bizcorExistingVouchers, 'Already in BizCor', '#f59e0b');
    document.getElementById('previewArea').style.display = 'block';
  } catch(e) {
    alert('Error: ' + (e.error || JSON.stringify(e)));
  }
  btn.disabled = false; btn.textContent = 'Refresh Preview';
}

function box(n, label, color) {
  return '<div class="preview-box"><div class="num" style="color:' + (color||'#38bdf8') + '">' + n + '</div><div class="lbl">' + label + '</div></div>';
}

async function startImport() {
  const btn = document.getElementById('importBtn');
  btn.disabled = true; btn.innerHTML = '<span class="spinner"></span>Import chal raha hai… thoda waqt lagega';
  const from = document.getElementById('fromDate').value;
  const to = document.getElementById('toDate').value;
  goStep(5);
  document.getElementById('resultContent').innerHTML = '<div class="status wait"><span class="spinner"></span>Import chal raha hai… please wait, page band mat karo</div>';
  try {
    const r = await post('/api/import', {
      from, to,
      importSales: document.getElementById('chkSales').checked,
      importPurchases: document.getElementById('chkPurchases').checked,
      importReceipts: document.getElementById('chkReceipts').checked,
      importPayments: document.getElementById('chkPayments').checked,
    });
    const c = r.counts;
    document.getElementById('resultContent').innerHTML =
      '<div class="status ok"><span class="dot"></span>Import Complete!</div>' +
      '<div class="result-grid">' +
        rbox(c.sales, 'Sales Invoices') + rbox(c.purchases, 'Purchase Bills') +
        rbox(c.receipts, 'Receipts') + rbox(c.payments, 'Payments') +
        rbox(c.skipped, 'Skipped', true) + rbox(c.errors, 'Errors', true) +
      '</div>' +
      (r.log && r.log.length ? '<div class="log">' + r.log.map(l => '<div class="err">⚠ ' + l + '</div>').join('') + '</div>' : '');
  } catch(e) {
    document.getElementById('resultContent').innerHTML =
      '<div class="status fail"><span class="dot"></span>Error: ' + (e.error || JSON.stringify(e)) + '</div>' +
      (e.log && e.log.length ? '<div class="log">' + e.log.map(l => '<div class="err">⚠ ' + l + '</div>').join('') + '</div>' : '');
  }
  btn.disabled = false;
}

function rbox(n, label, isErr) {
  return '<div class="result-box' + (isErr?' err-box':'') + '"><div class="num">' + n + '</div><div class="lbl">' + label + '</div></div>';
}
</script>
</body>
</html>`);
});

// ── Start ─────────────────────────────────────────────────────────────────────
const PORT = config.port || 9191;
app.listen(PORT, "127.0.0.1", () => {
  console.log("");
  console.log("╔══════════════════════════════════════════════════╗");
  console.log("║     SMART ERP → BizCor  |  Import Tool          ║");
  console.log("╠══════════════════════════════════════════════════╣");
  console.log("║  Browser mein kholo:  http://localhost:" + PORT + "       ║");
  console.log("║  Band karne ke liye:  Ctrl+C                     ║");
  console.log("╚══════════════════════════════════════════════════╝");
  console.log("");

  // Auto-open browser (Windows + Mac + Linux)
  const open = require("child_process").exec;
  const url = `http://localhost:${PORT}`;
  if (process.platform === "win32") open(`start "" "${url}"`);
  else if (process.platform === "darwin") open(`open "${url}"`);
  else open(`xdg-open "${url}"`);
});
