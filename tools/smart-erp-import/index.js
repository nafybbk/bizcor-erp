// ─────────────────────────────────────────────────────────────────────────────
//  SMART ERP → BizCor Import Tool  |  File-Based (JSON Upload)
//  Chalane ka tarika:  node index.js
//  Phir browser mein: http://localhost:9191
// ─────────────────────────────────────────────────────────────────────────────

const express = require("express");
const https   = require("https");
const http    = require("http");
const fs      = require("fs");
const path    = require("path");

const config = JSON.parse(fs.readFileSync(path.join(__dirname, "config.json"), "utf8"));
const GST_CODES = new Set(
  (config.import?.gstItemCodes || ["cgst","sgst","igst","carriage","freight"])
    .map(s => s.toLowerCase())
);

const app = express();
app.use(express.json({ limit: "50mb" }));

// ── State ─────────────────────────────────────────────────────────────────────
let authenticated = false;
let bizToken      = null;
let bizParties    = {};   // name.lower → { id, type }
let bizItems      = {};   // name.lower → id
let bizVouchers   = {};   // voucherNumber → id
let bizPayments   = {};   // paymentNumber → true
let importedData  = null; // parsed JSON from uploaded file

// ── HTTP helper ───────────────────────────────────────────────────────────────
function apiCall(method, urlStr, body, token) {
  return new Promise((resolve, reject) => {
    const u    = new URL(urlStr);
    const mod  = u.protocol === "https:" ? https : http;
    const data = body ? JSON.stringify(body) : null;
    const hdrs = { "Content-Type": "application/json" };
    if (token) hdrs["Authorization"] = `Bearer ${token}`;
    if (data)  hdrs["Content-Length"] = Buffer.byteLength(data);

    const req = mod.request({
      hostname: u.hostname,
      port: u.port || (u.protocol === "https:" ? 443 : 80),
      path: u.pathname + u.search,
      method, headers: hdrs,
    }, (res) => {
      let raw = "";
      res.on("data", d => raw += d);
      res.on("end", () => {
        try {
          const j = JSON.parse(raw);
          if (res.statusCode >= 400) reject({ status: res.statusCode, ...j });
          else resolve(j);
        } catch { reject({ status: res.statusCode, raw }); }
      });
    });
    req.on("error", reject);
    if (data) req.write(data);
    req.end();
  });
}

const BASE = () => (config.bizCor.url || "").replace(/\/$/, "");

// ── BizCor login ──────────────────────────────────────────────────────────────
async function bizLogin() {
  const res = await apiCall("POST", `${BASE()}/api/auth/login`, {
    businessCode: config.bizCor.businessCode,
    email:        config.bizCor.email,
    password:     config.bizCor.password,
  });
  bizToken = res.token;
}

// ── Load all BizCor masters ───────────────────────────────────────────────────
async function loadBizMasters() {
  bizParties  = {};
  bizItems    = {};
  bizVouchers = {};
  bizPayments = {};

  // Parties
  let pg = 1;
  while (true) {
    const r = await apiCall("GET", `${BASE()}/api/parties?limit=500&page=${pg}`, null, bizToken);
    if (!r.data?.length) break;
    r.data.forEach(p => { bizParties[p.name.toLowerCase().trim()] = { id: p.id, type: p.type }; });
    if (r.data.length < 500) break;
    pg++;
  }

  // Items
  pg = 1;
  while (true) {
    const r = await apiCall("GET", `${BASE()}/api/items?limit=500&page=${pg}`, null, bizToken);
    if (!r.data?.length) break;
    r.data.forEach(i => { bizItems[i.name.toLowerCase().trim()] = i.id; });
    if (r.data.length < 500) break;
    pg++;
  }

  // Existing vouchers (to skip duplicates)
  for (const [ep] of [
    ["sales/invoices"], ["purchases/bills"],
    ["sales/credit-notes"], ["purchases/debit-notes"],
  ]) {
    pg = 1;
    while (true) {
      const r = await apiCall("GET", `${BASE()}/api/${ep}?limit=500&page=${pg}`, null, bizToken);
      if (!r.data?.length) break;
      r.data.forEach(v => { bizVouchers[v.voucherNumber] = v.id; });
      if (r.data.length < 500) break;
      pg++;
    }
  }

  // Existing payments
  pg = 1;
  while (true) {
    const r = await apiCall("GET", `${BASE()}/api/payments?limit=500&page=${pg}`, null, bizToken);
    if (!r.data?.length) break;
    r.data.forEach(p => { bizPayments[p.paymentNumber] = true; });
    if (r.data.length < 500) break;
    pg++;
  }
}

// ── Date format helper ────────────────────────────────────────────────────────
function fmtDate(d) {
  if (!d) return new Date().toISOString().slice(0, 10);
  if (d instanceof Date) return d.toISOString().slice(0, 10);
  const s = String(d);
  const m = s.match(/^(\d{2})[\/\-](\d{2})[\/\-](\d{4})$/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  // Handle SQL Server datetime strings like "2024-03-15T00:00:00"
  if (s.length >= 10) return s.slice(0, 10);
  return s;
}

// ── Guess GST rate from amounts ───────────────────────────────────────────────
function guessTaxRate(taxable, cgst, sgst) {
  if (!taxable || taxable <= 0) return 0;
  const total = (cgst || 0) + (sgst || 0);
  if (total <= 0) return 0;
  const raw = Math.round((total / taxable) * 100);
  return [0, 3, 5, 12, 18, 28].reduce((p, c) => Math.abs(c - raw) < Math.abs(p - raw) ? c : p);
}

// ── Auth middleware ────────────────────────────────────────────────────────────
function auth(req, res, next) {
  if (!authenticated) { res.status(401).json({ error: "PIN required" }); return; }
  next();
}

// ─────────────────────────────────────────────────────────────────────────────
//  ROUTES
// ─────────────────────────────────────────────────────────────────────────────

// PIN verify
app.post("/api/verify-pin", (req, res) => {
  if (String(req.body.pin) === String(config.pin)) {
    authenticated = true;
    res.json({ ok: true });
  } else {
    res.status(401).json({ ok: false, message: "Galat PIN hai" });
  }
});

// Upload + parse JSON file
app.post("/api/upload", auth, (req, res) => {
  try {
    const { jsonText } = req.body;
    if (!jsonText) { res.status(400).json({ error: "File content missing" }); return; }
    const parsed = JSON.parse(jsonText);
    importedData = parsed;

    const meta     = parsed.meta     || {};
    const sales    = Array.isArray(parsed.salesInvoices)    ? parsed.salesInvoices    : [];
    const purchases= Array.isArray(parsed.purchaseBills)    ? parsed.purchaseBills    : [];
    const receipts = Array.isArray(parsed.receipts)         ? parsed.receipts         : [];
    const payments = Array.isArray(parsed.supplierPayments) ? parsed.supplierPayments : [];

    res.json({
      ok: true,
      company:   meta.company   || "Unknown",
      branch:    meta.branch    || "",
      branchCode:meta.branchCode|| "",
      counts: {
        sales:     sales.length,
        purchases: purchases.length,
        receipts:  receipts.length,
        payments:  payments.length,
      },
    });
  } catch (e) {
    res.status(400).json({ error: "JSON file parse nahi hua: " + e.message });
  }
});

// Test BizCor connection
app.post("/api/connect-biz", auth, async (req, res) => {
  // Allow overriding url/credentials from UI
  if (req.body.url)          config.bizCor.url          = req.body.url;
  if (req.body.businessCode) config.bizCor.businessCode = req.body.businessCode;
  if (req.body.email)        config.bizCor.email        = req.body.email;
  if (req.body.password)     config.bizCor.password     = req.body.password;

  try {
    await bizLogin();
    await loadBizMasters();
    res.json({
      ok: true,
      parties: Object.keys(bizParties).length,
      items:   Object.keys(bizItems).length,
      existingVouchers: Object.keys(bizVouchers).length,
    });
  } catch (e) {
    res.status(400).json({ ok: false, error: e.message || JSON.stringify(e).slice(0, 200) });
  }
});

// ── IMPORT ────────────────────────────────────────────────────────────────────
app.post("/api/import", auth, async (req, res) => {
  if (!importedData) { res.status(400).json({ error: "Pehle file upload karein" }); return; }
  if (!bizToken)     { res.status(400).json({ error: "Pehle BizCor connect karein" }); return; }

  const { importSales, importPurchases, importReceipts, importPayments, fromDate, toDate } = req.body;
  const from = fromDate || "2000-01-01";
  const to   = toDate   || "2099-12-31";

  const log    = [];
  const counts = { sales: 0, purchases: 0, receipts: 0, payments: 0, skipped: 0, errors: 0 };

  function inRange(d) {
    const s = fmtDate(d);
    return s >= from && s <= to;
  }

  try {
    // ── 1. SALES INVOICES ───────────────────────────────────────────────────
    if (importSales && importedData.salesInvoices) {
      for (const h of importedData.salesInvoices) {
        if (!inRange(h.date)) continue;
        const docNo = String(h.docNo || "").trim();
        if (!docNo) continue;
        if (bizVouchers[docNo]) { counts.skipped++; continue; }

        const partyName = String(h.partyName || "").trim();
        const partyInfo = bizParties[partyName.toLowerCase()];
        if (!partyInfo) {
          counts.errors++;
          log.push(`SI ${docNo}: Party nahi mili — "${partyName}"`);
          continue;
        }

        const allRows   = Array.isArray(h.items) ? h.items : [];
        let cgst = 0, sgst = 0, transport = 0;
        const actualItems = [];

        for (const d of allRows) {
          const code = String(d.itemCode || "").toLowerCase().trim();
          if (code === "cgst")                            { cgst      += Number(d.rate || 0); continue; }
          if (code === "sgst")                            { sgst      += Number(d.rate || 0); continue; }
          if (code === "carriage" || code === "freight")  { transport += Number(d.rate || 0); continue; }
          if (GST_CODES.has(code))                        { continue; }
          actualItems.push(d);
        }

        if (!actualItems.length) { counts.skipped++; continue; }

        const grandTotal = Number(h.grandTotal || 0);
        const taxable    = grandTotal - cgst - sgst - transport;
        const taxRate    = guessTaxRate(taxable, cgst, sgst);

        const items = actualItems.map(d => ({
          itemName:    String(d.itemName || d.itemCode || "Item").trim(),
          itemId:      bizItems[String(d.itemName || "").toLowerCase().trim()] || null,
          quantity:    Number(d.qty)     || 1,
          rate:        Number(d.rate)    || 0,
          discount:    Number(d.discPer) || 0,
          discountType:"percent",
          taxRate,
          taxRateId:   null,
        }));

        try {
          await apiCall("POST", `${BASE()}/api/sales/invoices`, {
            voucherNumber: docNo,
            date:          fmtDate(h.date),
            partyId:       partyInfo.id,
            items,
            transportCharges: transport,
            status: "posted",
            notes:  "Imported from SMART ERP",
          }, bizToken);
          bizVouchers[docNo] = true;
          counts.sales++;
        } catch (e) {
          counts.errors++;
          log.push(`SI ${docNo}: ${e.message || JSON.stringify(e).slice(0, 100)}`);
        }
      }
    }

    // ── 2. PURCHASE BILLS ───────────────────────────────────────────────────
    if (importPurchases && importedData.purchaseBills) {
      for (const h of importedData.purchaseBills) {
        if (!inRange(h.date)) continue;
        const docNo = String(h.docNo || "").trim();
        if (!docNo) continue;
        if (bizVouchers[docNo]) { counts.skipped++; continue; }

        const partyName = String(h.partyName || "").trim();
        const partyInfo = bizParties[partyName.toLowerCase()];
        if (!partyInfo) {
          counts.errors++;
          log.push(`PB ${docNo}: Supplier nahi mila — "${partyName}"`);
          continue;
        }

        const allRows   = Array.isArray(h.items) ? h.items : [];
        let cgst = 0, sgst = 0, transport = 0;
        const actualItems = [];

        for (const d of allRows) {
          const code = String(d.itemCode || "").toLowerCase().trim();
          if (code === "cgst")                           { cgst      += Number(d.rate || 0); continue; }
          if (code === "sgst")                           { sgst      += Number(d.rate || 0); continue; }
          if (code === "carriage" || code === "freight") { transport += Number(d.rate || 0); continue; }
          if (GST_CODES.has(code))                       { continue; }
          actualItems.push(d);
        }

        if (!actualItems.length) { counts.skipped++; continue; }

        const grandTotal = Number(h.grandTotal || 0);
        const taxable    = grandTotal - cgst - sgst - transport;
        const taxRate    = guessTaxRate(taxable, cgst, sgst);

        const items = actualItems.map(d => ({
          itemName:     String(d.itemName || d.itemCode || "Item").trim(),
          itemId:       bizItems[String(d.itemName || "").toLowerCase().trim()] || null,
          quantity:     Number(d.qty)     || 1,
          rate:         Number(d.rate)    || 0,
          discount:     Number(d.discPer) || 0,
          discountType: "percent",
          taxRate,
          taxRateId:    null,
        }));

        try {
          await apiCall("POST", `${BASE()}/api/purchases/bills`, {
            voucherNumber: docNo,
            date:          fmtDate(h.date),
            partyId:       partyInfo.id,
            items,
            transportCharges: transport,
            notes: h.supplierBillNo ? `Supplier Bill: ${h.supplierBillNo}` : "Imported from SMART ERP",
            status: "posted",
          }, bizToken);
          bizVouchers[docNo] = true;
          counts.purchases++;
        } catch (e) {
          counts.errors++;
          log.push(`PB ${docNo}: ${e.message || JSON.stringify(e).slice(0, 100)}`);
        }
      }
    }

    // ── 3. RECEIPTS ─────────────────────────────────────────────────────────
    if (importReceipts && importedData.receipts) {
      for (const r of importedData.receipts) {
        if (!inRange(r.date)) continue;
        const vouNo  = String(r.vouNo || "").trim();
        const recNum = `REC-${vouNo}`;
        if (!vouNo) continue;
        if (bizPayments[recNum]) { counts.skipped++; continue; }

        const partyName = String(r.partyName || "").trim();
        const partyInfo = bizParties[partyName.toLowerCase()];
        if (!partyInfo) {
          counts.errors++;
          log.push(`REC ${vouNo}: Customer nahi mila — "${partyName}"`);
          continue;
        }

        const allocs = (r.allocations || [])
          .filter(a => a.invNo && Number(a.amount) > 0)
          .map(a => ({ voucherId: bizVouchers[String(a.invNo).trim()], allocatedAmount: Number(a.amount) }))
          .filter(a => a.voucherId);

        try {
          await apiCall("POST", `${BASE()}/api/payments`, {
            type:        "receipt",
            date:        fmtDate(r.date),
            partyId:     partyInfo.id,
            amount:      Number(r.amount || 0),
            paymentMode: config.import?.defaultPaymentMode || "cash",
            isOnAccount: allocs.length === 0,
            allocations: allocs,
            notes:       `Imported from SMART ERP | VouNo: ${vouNo}`,
          }, bizToken);
          bizPayments[recNum] = true;
          counts.receipts++;
        } catch (e) {
          counts.errors++;
          log.push(`REC ${vouNo}: ${e.message || JSON.stringify(e).slice(0, 100)}`);
        }
      }
    }

    // ── 4. SUPPLIER PAYMENTS ─────────────────────────────────────────────────
    if (importPayments && importedData.supplierPayments) {
      for (const p of importedData.supplierPayments) {
        if (!inRange(p.date)) continue;
        const vouNo  = String(p.vouNo || "").trim();
        const payNum = `PAY-${vouNo}`;
        if (!vouNo) continue;
        if (bizPayments[payNum]) { counts.skipped++; continue; }

        const partyName = String(p.partyName || "").trim();
        const partyInfo = bizParties[partyName.toLowerCase()];
        if (!partyInfo) {
          counts.errors++;
          log.push(`PAY ${vouNo}: Supplier nahi mila — "${partyName}"`);
          continue;
        }

        const allocs = (p.allocations || [])
          .filter(a => a.invNo && Number(a.amount) > 0)
          .map(a => ({ voucherId: bizVouchers[String(a.invNo).trim()], allocatedAmount: Number(a.amount) }))
          .filter(a => a.voucherId);

        try {
          await apiCall("POST", `${BASE()}/api/payments`, {
            type:        "payment",
            date:        fmtDate(p.date),
            partyId:     partyInfo.id,
            amount:      Number(p.amount || 0),
            paymentMode: config.import?.defaultPaymentMode || "cash",
            isOnAccount: allocs.length === 0,
            allocations: allocs,
            notes:       `Imported from SMART ERP | VouNo: ${vouNo}`,
          }, bizToken);
          bizPayments[payNum] = true;
          counts.payments++;
        } catch (e) {
          counts.errors++;
          log.push(`PAY ${vouNo}: ${e.message || JSON.stringify(e).slice(0, 100)}`);
        }
      }
    }

    res.json({ ok: true, counts, log });
  } catch (e) {
    res.status(500).json({ error: e.message, log });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
//  HTML UI
// ─────────────────────────────────────────────────────────────────────────────
app.get("/", (req, res) => {
  res.setHeader("Content-Type", "text/html");
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>SMART ERP → BizCor</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:system-ui,sans-serif;background:#0f172a;color:#e2e8f0;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:20px}
.card{background:#1e293b;border:1px solid #334155;border-radius:16px;padding:28px;width:540px;max-width:100%;box-shadow:0 25px 50px rgba(0,0,0,.5)}
h1{font-size:1.1rem;font-weight:700;color:#38bdf8}
.sub{font-size:.78rem;color:#64748b;margin-bottom:22px;margin-top:2px}
label{font-size:.75rem;color:#94a3b8;display:block;margin-bottom:3px;margin-top:10px}
input[type=password],input[type=text],input[type=date],input[type=url]{width:100%;background:#0f172a;border:1px solid #334155;border-radius:8px;padding:9px 12px;color:#e2e8f0;font-size:.875rem;outline:none}
input:focus{border-color:#38bdf8}
.btn{display:block;width:100%;background:#0ea5e9;color:#fff;border:none;border-radius:8px;padding:11px;font-size:.9rem;font-weight:600;cursor:pointer;margin-top:14px;transition:.15s}
.btn:hover{background:#0284c7}
.btn:disabled{background:#334155;color:#64748b;cursor:not-allowed}
.btn-ghost{background:#1e3a5f;color:#93c5fd}.btn-ghost:hover{background:#1e40af}
.step{display:none}.step.active{display:block}
.badge{padding:10px 14px;border-radius:8px;font-size:.82rem;margin-top:10px;display:flex;align-items:center;gap:8px}
.badge.ok{background:#042f2e;border:1px solid #065f46;color:#6ee7b7}
.badge.fail{background:#2d1215;border:1px solid #7f1d1d;color:#fca5a5}
.badge.info{background:#1e3a5f;border:1px solid #1e40af;color:#93c5fd}
.dot{width:7px;height:7px;border-radius:50%;background:currentColor;flex-shrink:0}
.grid2{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:12px 0}
.box{background:#0f172a;border:1px solid #334155;border-radius:8px;padding:12px;text-align:center}
.box .n{font-size:1.5rem;font-weight:700;color:#38bdf8}
.box .l{font-size:.7rem;color:#64748b;margin-top:2px}
.box.red .n{color:#f87171}
.box.grn .n{color:#34d399}
.chk{display:flex;align-items:center;gap:8px;font-size:.83rem;color:#cbd5e1;margin:6px 0}
.chk input{width:auto;accent-color:#38bdf8}
.log{background:#0f172a;border:1px solid #334155;border-radius:8px;padding:10px;font-size:.72rem;color:#94a3b8;max-height:160px;overflow-y:auto;margin-top:10px;font-family:monospace}
.log .e{color:#fca5a5}
.drop{border:2px dashed #334155;border-radius:10px;padding:28px;text-align:center;cursor:pointer;transition:.2s;margin-top:10px}
.drop:hover,.drop.over{border-color:#38bdf8;background:#0f172a}
.drop .icon{font-size:2rem;margin-bottom:6px}
.drop .hint{font-size:.78rem;color:#64748b}
.spin{display:inline-block;width:12px;height:12px;border:2px solid #334155;border-top-color:#38bdf8;border-radius:50%;animation:sp .6s linear infinite;vertical-align:middle;margin-right:5px}
@keyframes sp{to{transform:rotate(360deg)}}
.date-row{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.sep{border:none;border-top:1px solid #334155;margin:16px 0}
</style>
</head>
<body>
<div class="card">
  <h1>SMART ERP &#8594; BizCor</h1>
  <p class="sub">Data Import Tool &nbsp;|&nbsp; HMR Systems</p>

  <!-- ── Step 1: PIN ── -->
  <div class="step active" id="s1">
    <label>Security PIN</label>
    <input type="password" id="pin" placeholder="PIN dalo" onkeydown="if(event.key==='Enter')doPin()" autofocus>
    <button class="btn" onclick="doPin()">Aage Barhein &rarr;</button>
    <div id="pinErr" style="color:#fca5a5;font-size:.78rem;margin-top:8px;text-align:center"></div>
  </div>

  <!-- ── Step 2: Upload JSON file ── -->
  <div class="step" id="s2">
    <div class="badge info"><span class="dot"></span>SSMS mein <b>export.sql</b> chalao &rarr; result JSON file mein save karo &rarr; neeche upload karo</div>
    <div class="drop" id="dropZone" onclick="document.getElementById('fileInput').click()"
         ondragover="event.preventDefault();this.classList.add('over')"
         ondragleave="this.classList.remove('over')"
         ondrop="onDrop(event)">
      <div class="icon">&#128196;</div>
      <div style="font-size:.88rem;font-weight:600;color:#cbd5e1">ahk_export.json yahan drop karo</div>
      <div class="hint">ya click karke select karo</div>
    </div>
    <input type="file" id="fileInput" accept=".json" style="display:none" onchange="onFileSelect(event)">
    <div id="uploadStatus"></div>
  </div>

  <!-- ── Step 3: BizCor connect ── -->
  <div class="step" id="s3">
    <div id="companyInfo" class="badge ok" style="display:none"></div>
    <hr class="sep">
    <div style="font-size:.8rem;font-weight:600;color:#94a3b8;margin-bottom:4px">BizCor Connection</div>
    <label>BizCor URL</label>
    <input type="url" id="bizUrl" placeholder="https://erp.naewtgroup.com" value="${config.bizCor.url || ''}">
    <label>Business Code</label>
    <input type="text" id="bizCode" placeholder="G2SPNB" value="${config.bizCor.businessCode || ''}">
    <label>Email</label>
    <input type="text" id="bizEmail" placeholder="admin@business.com" value="${config.bizCor.email || ''}">
    <label>Password</label>
    <input type="password" id="bizPass" placeholder="••••••••" value="${config.bizCor.password || ''}">
    <button class="btn" onclick="doConnect()" id="connectBtn">BizCor Se Connect Karein</button>
    <div id="connectStatus"></div>
  </div>

  <!-- ── Step 4: Preview + confirm ── -->
  <div class="step" id="s4">
    <div id="previewInfo"></div>
    <hr class="sep">
    <div class="date-row">
      <div><label>From Date</label><input type="date" id="fromDate" value="${new Date(new Date().getFullYear(), 3, 1).toISOString().slice(0,10)}"></div>
      <div><label>To Date</label><input type="date" id="toDate" value="${new Date().toISOString().slice(0,10)}"></div>
    </div>
    <hr class="sep">
    <div style="font-size:.78rem;color:#94a3b8;font-weight:600;margin-bottom:4px">Kya import karna hai:</div>
    <div class="chk"><input type="checkbox" id="chkSI" checked> Sales Invoices</div>
    <div class="chk"><input type="checkbox" id="chkPB" checked> Purchase Bills</div>
    <div class="chk"><input type="checkbox" id="chkREC" checked> Customer Receipts (paisa aaya)</div>
    <div class="chk"><input type="checkbox" id="chkPAY" checked> Supplier Payments (paisa gaya)</div>
    <button class="btn" onclick="doImport()" id="importBtn">&#10003; Confirm — Import Karein</button>
    <button class="btn btn-ghost" onclick="go(3)" style="margin-top:6px">&#8592; Wapas</button>
  </div>

  <!-- ── Step 5: Results ── -->
  <div class="step" id="s5">
    <div id="resultArea"></div>
    <button class="btn btn-ghost" onclick="go(4)" style="margin-top:10px">&#8592; Dobara Import (alag date)</button>
  </div>
</div>

<script>
function go(n){document.querySelectorAll('.step').forEach((s,i)=>s.classList.toggle('active',i===n-1));}

async function post(url,body){
  const r=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  const j=await r.json();
  if(!r.ok) throw j;
  return j;
}

// Step 1 — PIN
async function doPin(){
  const pin=document.getElementById('pin').value;
  try{await post('/api/verify-pin',{pin});go(2);}
  catch(e){document.getElementById('pinErr').textContent=e.message||'Galat PIN';}
}

// Step 2 — File upload
function onDrop(e){
  e.preventDefault();
  document.getElementById('dropZone').classList.remove('over');
  const f=e.dataTransfer.files[0];
  if(f) readFile(f);
}
function onFileSelect(e){const f=e.target.files[0];if(f)readFile(f);}
function readFile(f){
  const el=document.getElementById('uploadStatus');
  el.innerHTML='<div class="badge info"><span class="spin"></span>File padh raha hai…</div>';
  const reader=new FileReader();
  reader.onload=async(ev)=>{
    try{
      const r=await post('/api/upload',{jsonText:ev.target.result});
      const ci=document.getElementById('companyInfo');
      ci.innerHTML='<span class="dot"></span>&#127970; '+r.company+(r.branch?' &mdash; '+r.branch:'')+(r.branchCode?' | '+r.branchCode:'');
      ci.style.display='flex';
      document.getElementById('previewInfo').innerHTML=
        '<div class="grid2">'+
        box(r.counts.sales,'Sales Invoices')+box(r.counts.purchases,'Purchase Bills')+
        box(r.counts.receipts,'Receipts')+box(r.counts.payments,'Payments')+
        '</div>';
      el.innerHTML='<div class="badge ok"><span class="dot"></span>'+f.name+' — '+
        (r.counts.sales+r.counts.purchases+r.counts.receipts+r.counts.payments)+' records mila</div>';
      setTimeout(()=>go(3),700);
    }catch(e){el.innerHTML='<div class="badge fail"><span class="dot"></span>'+(e.error||JSON.stringify(e))+'</div>';}
  };
  reader.readAsText(f);
}

// Step 3 — BizCor connect
async function doConnect(){
  const btn=document.getElementById('connectBtn');
  btn.disabled=true;btn.innerHTML='<span class="spin"></span>Connect ho raha hai…';
  const el=document.getElementById('connectStatus');
  try{
    const r=await post('/api/connect-biz',{
      url:document.getElementById('bizUrl').value,
      businessCode:document.getElementById('bizCode').value,
      email:document.getElementById('bizEmail').value,
      password:document.getElementById('bizPass').value,
    });
    el.innerHTML='<div class="badge ok"><span class="dot"></span>Connected! Parties: '+r.parties+' | Items: '+r.items+' | Existing vouchers: '+r.existingVouchers+'</div>';
    setTimeout(()=>go(4),700);
  }catch(e){el.innerHTML='<div class="badge fail"><span class="dot"></span>'+(e.error||JSON.stringify(e).slice(0,150))+'</div>';}
  btn.disabled=false;btn.textContent='Dobara Try Karein';
}

// Step 4 — Import
async function doImport(){
  const btn=document.getElementById('importBtn');
  btn.disabled=true;btn.innerHTML='<span class="spin"></span>Import chal raha hai… band mat karo';
  go(5);
  document.getElementById('resultArea').innerHTML='<div class="badge info"><span class="spin"></span>Kaam chal raha hai… thoda intezaar karein</div>';
  try{
    const r=await post('/api/import',{
      fromDate:document.getElementById('fromDate').value,
      toDate:document.getElementById('toDate').value,
      importSales:document.getElementById('chkSI').checked,
      importPurchases:document.getElementById('chkPB').checked,
      importReceipts:document.getElementById('chkREC').checked,
      importPayments:document.getElementById('chkPAY').checked,
    });
    const c=r.counts;
    document.getElementById('resultArea').innerHTML=
      '<div class="badge ok"><span class="dot"></span>Import mukammal hua!</div>'+
      '<div class="grid2">'+
        boxg(c.sales,'Sales Invoices')+boxg(c.purchases,'Purchase Bills')+
        boxg(c.receipts,'Receipts')+boxg(c.payments,'Payments')+
        boxr(c.skipped,'Skipped')+boxr(c.errors,'Errors')+
      '</div>'+
      (r.log?.length?'<div class="log">'+r.log.map(l=>'<div class="e">&#9888; '+l+'</div>').join('')+'</div>':'');
  }catch(e){
    document.getElementById('resultArea').innerHTML=
      '<div class="badge fail"><span class="dot"></span>'+(e.error||JSON.stringify(e))+'</div>'+
      (e.log?.length?'<div class="log">'+e.log.map(l=>'<div class="e">'+l+'</div>').join('')+'</div>':'');
  }
  btn.disabled=false;btn.textContent='&#10003; Confirm — Import Karein';
}

function box(n,l){return '<div class="box"><div class="n">'+n+'</div><div class="l">'+l+'</div></div>';}
function boxg(n,l){return '<div class="box grn"><div class="n">'+n+'</div><div class="l">'+l+'</div></div>';}
function boxr(n,l){return '<div class="box red"><div class="n">'+n+'</div><div class="l">'+l+'</div></div>';}
</script>
</body>
</html>`);
});

// ── Start ──────────────────────────────────────────────────────────────────────
const PORT = config.port || 9191;
app.listen(PORT, "127.0.0.1", () => {
  console.log("");
  console.log("╔══════════════════════════════════════════════════╗");
  console.log("║     SMART ERP → BizCor  |  Import Tool          ║");
  console.log("╠══════════════════════════════════════════════════╣");
  console.log(`║  Browser mein kholo:  http://localhost:${PORT}       ║`);
  console.log("║  Band karne ke liye:  Ctrl+C                     ║");
  console.log("╚══════════════════════════════════════════════════╝");
  console.log("");
  const exec = require("child_process").exec;
  const url  = `http://localhost:${PORT}`;
  if      (process.platform === "win32")  exec(`start "" "${url}"`);
  else if (process.platform === "darwin") exec(`open "${url}"`);
  else                                    exec(`xdg-open "${url}"`);
});
