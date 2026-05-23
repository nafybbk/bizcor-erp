import puppeteer from "puppeteer-core";
import { writeFileSync } from "fs";

const CHROMIUM = "/nix/store/5afrhwm7zqn1vb7p5z1mc2rkh2grsfgz-ungoogled-chromium-138.0.7204.100/bin/chromium";

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap');
  *{margin:0;padding:0;box-sizing:border-box;}
  body{font-family:'Inter',sans-serif;background:#fff;color:#1a1a2e;font-size:11px;line-height:1.6;}

  /* ── Cover Page ── */
  .cover{width:100%;height:100vh;background:linear-gradient(135deg,#0f0c29,#302b63,#24243e);display:flex;flex-direction:column;align-items:center;justify-content:center;page-break-after:always;position:relative;overflow:hidden;}
  .cover-bg-circle{position:absolute;border-radius:50%;opacity:.08;}
  .c1{width:600px;height:600px;background:#fff;top:-200px;right:-200px;}
  .c2{width:400px;height:400px;background:#6c63ff;bottom:-100px;left:-100px;}
  .cover-logo{width:90px;height:90px;background:linear-gradient(135deg,#6c63ff,#3ecf8e);border-radius:24px;display:flex;align-items:center;justify-content:center;font-size:42px;margin-bottom:28px;box-shadow:0 20px 60px rgba(108,99,255,.4);}
  .cover-title{font-size:52px;font-weight:900;color:#fff;letter-spacing:-1px;text-align:center;}
  .cover-sub{font-size:18px;color:rgba(255,255,255,.7);margin-top:10px;font-weight:300;letter-spacing:2px;text-transform:uppercase;}
  .cover-tag{margin-top:40px;display:flex;gap:12px;flex-wrap:wrap;justify-content:center;}
  .cover-tag span{background:rgba(255,255,255,.12);color:#fff;border:1px solid rgba(255,255,255,.2);border-radius:20px;padding:6px 18px;font-size:11px;font-weight:500;}
  .cover-footer{position:absolute;bottom:40px;color:rgba(255,255,255,.4);font-size:10px;letter-spacing:1px;}
  .cover-version{position:absolute;top:40px;right:40px;color:rgba(255,255,255,.4);font-size:10px;}

  /* ── Sections ── */
  .page{padding:40px 48px;page-break-after:always;}
  .page:last-child{page-break-after:avoid;}

  .section-header{display:flex;align-items:center;gap:14px;margin-bottom:28px;padding-bottom:14px;border-bottom:2px solid;}
  .section-icon{width:44px;height:44px;border-radius:14px;display:flex;align-items:center;justify-content:center;font-size:22px;flex-shrink:0;}
  .section-title{font-size:22px;font-weight:800;letter-spacing:-.3px;}
  .section-desc{font-size:10.5px;color:#666;margin-top:2px;font-weight:400;}

  /* ── Feature cards ── */
  .grid{display:grid;grid-template-columns:1fr 1fr;gap:14px;}
  .grid-3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;}
  .card{border-radius:14px;padding:16px;border:1px solid;}
  .card-title{font-size:11.5px;font-weight:700;margin-bottom:8px;display:flex;align-items:center;gap:7px;}
  .card-title .dot{width:8px;height:8px;border-radius:50%;flex-shrink:0;}
  .feature-list{list-style:none;}
  .feature-list li{font-size:10px;color:#444;padding:3px 0;display:flex;align-items:flex-start;gap:6px;line-height:1.5;}
  .feature-list li::before{content:'›';font-weight:700;flex-shrink:0;margin-top:1px;}
  .sub-list{list-style:none;margin-left:14px;margin-top:2px;}
  .sub-list li{font-size:9.5px;color:#666;padding:1.5px 0;display:flex;align-items:flex-start;gap:5px;}
  .sub-list li::before{content:'·';flex-shrink:0;}

  /* ── Colour palette ── */
  /* Blue */   .s-blue{border-color:#3b82f6;} .s-blue .section-header{border-color:#3b82f6;} .s-blue .section-icon{background:#eff6ff;} .s-blue .section-title{color:#1d4ed8;}
  .c-blue{background:#f0f7ff;border-color:#bfdbfe;} .c-blue .card-title{color:#1d4ed8;} .c-blue .dot{background:#3b82f6;} .c-blue li::before{color:#3b82f6;}
  /* Green */  .s-green{border-color:#10b981;} .s-green .section-header{border-color:#10b981;} .s-green .section-icon{background:#ecfdf5;} .s-green .section-title{color:#065f46;}
  .c-green{background:#f0fdf4;border-color:#bbf7d0;} .c-green .card-title{color:#065f46;} .c-green .dot{background:#10b981;} .c-green li::before{color:#10b981;}
  /* Purple */ .s-purple{border-color:#8b5cf6;} .s-purple .section-header{border-color:#8b5cf6;} .s-purple .section-icon{background:#f5f3ff;} .s-purple .section-title{color:#5b21b6;}
  .c-purple{background:#faf5ff;border-color:#ddd6fe;} .c-purple .card-title{color:#5b21b6;} .c-purple .dot{background:#8b5cf6;} .c-purple li::before{color:#8b5cf6;}
  /* Orange */ .s-orange{border-color:#f59e0b;} .s-orange .section-header{border-color:#f59e0b;} .s-orange .section-icon{background:#fffbeb;} .s-orange .section-title{color:#92400e;}
  .c-orange{background:#fffbeb;border-color:#fde68a;} .c-orange .card-title{color:#92400e;} .c-orange .dot{background:#f59e0b;} .c-orange li::before{color:#f59e0b;}
  /* Red */    .s-red{border-color:#ef4444;} .s-red .section-header{border-color:#ef4444;} .s-red .section-icon{background:#fef2f2;} .s-red .section-title{color:#991b1b;}
  .c-red{background:#fff5f5;border-color:#fecaca;} .c-red .card-title{color:#991b1b;} .c-red .dot{background:#ef4444;} .c-red li::before{color:#ef4444;}
  /* Teal */   .s-teal{border-color:#06b6d4;} .s-teal .section-header{border-color:#06b6d4;} .s-teal .section-icon{background:#ecfeff;} .s-teal .section-title{color:#0e7490;}
  .c-teal{background:#ecfeff;border-color:#a5f3fc;} .c-teal .card-title{color:#0e7490;} .c-teal .dot{background:#06b6d4;} .c-teal li::before{color:#06b6d4;}
  /* Pink */   .s-pink{border-color:#ec4899;} .s-pink .section-header{border-color:#ec4899;} .s-pink .section-icon{background:#fdf2f8;} .s-pink .section-title{color:#9d174d;}
  .c-pink{background:#fdf2f8;border-color:#fbcfe8;} .c-pink .card-title{color:#9d174d;} .c-pink .dot{background:#ec4899;} .c-pink li::before{color:#ec4899;}
  /* Indigo */ .s-indigo{border-color:#6366f1;} .s-indigo .section-header{border-color:#6366f1;} .s-indigo .section-icon{background:#eef2ff;} .s-indigo .section-title{color:#3730a3;}
  .c-indigo{background:#eef2ff;border-color:#c7d2fe;} .c-indigo .card-title{color:#3730a3;} .c-indigo .dot{background:#6366f1;} .c-indigo li::before{color:#6366f1;}

  /* ── Banner ── */
  .banner{border-radius:14px;padding:18px 22px;margin-bottom:20px;display:flex;align-items:center;gap:16px;}
  .banner-icon{font-size:28px;}
  .banner-title{font-size:13px;font-weight:700;}
  .banner-sub{font-size:10px;color:#555;margin-top:2px;}
  .b-blue{background:linear-gradient(135deg,#eff6ff,#dbeafe);border:1px solid #bfdbfe;}
  .b-green{background:linear-gradient(135deg,#f0fdf4,#dcfce7);border:1px solid #bbf7d0;}
  .b-purple{background:linear-gradient(135deg,#f5f3ff,#ede9fe);border:1px solid #ddd6fe;}

  /* ── Full-width card ── */
  .full-card{border-radius:14px;padding:16px 20px;border:1px solid;margin-bottom:12px;}
  .full-card .card-title{margin-bottom:6px;}
  .inline-list{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px;}
  .tag{border-radius:20px;padding:3px 12px;font-size:9.5px;font-weight:600;}

  /* ── Table ── */
  .feat-table{width:100%;border-collapse:collapse;margin-top:8px;}
  .feat-table th{background:#f8fafc;font-size:9.5px;font-weight:700;color:#64748b;padding:7px 10px;text-align:left;border-bottom:2px solid #e2e8f0;}
  .feat-table td{font-size:10px;padding:6px 10px;border-bottom:1px solid #f1f5f9;color:#374151;vertical-align:top;}
  .feat-table tr:hover td{background:#f8fafc;}

  /* ── Page num ── */
  .pg{position:fixed;bottom:20px;right:36px;font-size:9px;color:#cbd5e1;}
</style>
</head>
<body>

<!-- ═══════════════════════════════════════════════════════ COVER ══ -->
<div class="cover">
  <div class="cover-bg-circle c1"></div>
  <div class="cover-bg-circle c2"></div>
  <div class="cover-version">v2.3.21 · May 2026</div>
  <div class="cover-logo">🏢</div>
  <div class="cover-title">BizCor ERP</div>
  <div class="cover-sub">Indian Business ERP · Complete Feature Reference</div>
  <div class="cover-tag">
    <span>☁️ Cloud Version</span>
    <span>🖥️ Desktop LAN</span>
    <span>📱 Mobile Ready</span>
    <span>🇮🇳 GST Compliant</span>
    <span>🔐 Multi-Tenant</span>
    <span>📊 Real-time Reports</span>
  </div>
  <div class="cover-footer">Confidential · Internal Reference Document · BizCor ERP 2026</div>
</div>

<!-- ═══════════════════════════════════════════ PAGE 1 · AUTH & DASHBOARD ══ -->
<div class="page s-blue">
  <div class="section-header">
    <div class="section-icon">🔐</div>
    <div>
      <div class="section-title">Authentication & Login</div>
      <div class="section-desc">Multi-role secure login system with separate portals for businesses and tech support</div>
    </div>
  </div>
  <div class="grid">
    <div class="card c-blue">
      <div class="card-title"><span class="dot"></span>Business Login</div>
      <ul class="feature-list">
        <li>Business Code + Email + Password login</li>
        <li>Separate cloud URL: erp.naewtgroup.com</li>
        <li>JWT-based session (localStorage)</li>
        <li>Plan expiry checks on login</li>
        <li>Grace period banners (trial / admin / readonly)</li>
        <li>Login activity & GPS location tracking</li>
        <li>Auto-creates 6 default units on registration</li>
        <li>Auto-creates 5 GST rates on registration</li>
      </ul>
    </div>
    <div class="card c-blue">
      <div class="card-title"><span class="dot"></span>Tech Support Login</div>
      <ul class="feature-list">
        <li>Separate portal: erpa.naewtgroup.com</li>
        <li>Email + Password only (no business code)</li>
        <li>WebAuthn fingerprint quick login</li>
        <li>Admin profile image upload</li>
        <li>Plain password view in tech panel</li>
        <li>Multiple tech support accounts</li>
        <li>Full super-admin privileges</li>
      </ul>
    </div>
    <div class="card c-blue">
      <div class="card-title"><span class="dot"></span>Login Screen Support Chat</div>
      <ul class="feature-list">
        <li>Help/? button — visible BEFORE login</li>
        <li>Anonymous chat (no account needed)</li>
        <li>Name, Phone, Email fields (first time)</li>
        <li>Session ID in localStorage (conversation persists)</li>
        <li>File attachment — Cloudinary CDN storage</li>
        <li>Draggable + resizable chat widget</li>
        <li>Mouse & touch support (mobile friendly)</li>
        <li>Unread reply notification badge</li>
      </ul>
    </div>
    <div class="card c-blue">
      <div class="card-title"><span class="dot"></span>Registration</div>
      <ul class="feature-list">
        <li>Self-registration — new business onboarding</li>
        <li>Auto-generated unique Business Code</li>
        <li>Optional Referral Code field</li>
        <li>GSTIN, PAN, address at registration</li>
        <li>Financial year start configuration</li>
        <li>Instant access after registration</li>
      </ul>
    </div>
  </div>

  <div style="margin-top:20px;">
    <div class="section-header" style="margin-top:24px;">
      <div class="section-icon">📊</div>
      <div>
        <div class="section-title">Dashboard</div>
        <div class="section-desc">Real-time business overview at a glance</div>
      </div>
    </div>
    <div class="grid">
      <div class="card c-green">
        <div class="card-title"><span class="dot" style="background:#10b981"></span>Summary Cards</div>
        <ul class="feature-list">
          <li>Sales total — Today / This Month / Last Month / This Year</li>
          <li>Purchases total — same 4 periods</li>
          <li>Outstanding Receivables (total due from customers)</li>
          <li>Outstanding Payables (total due to suppliers)</li>
          <li>Net GST Payable (Output – ITC)</li>
        </ul>
      </div>
      <div class="card c-green">
        <div class="card-title"><span class="dot" style="background:#10b981"></span>Charts & Analytics</div>
        <ul class="feature-list">
          <li>12-month Sales & Purchases bar chart</li>
          <li>Top 5 Customers by Revenue</li>
          <li>Period selector (month/year filter)</li>
          <li>Real-time data — no manual refresh needed</li>
          <li>Responsive charts (mobile optimised)</li>
        </ul>
      </div>
    </div>
  </div>
</div>

<!-- ═══════════════════════════════════════════ PAGE 2 · SALES & PURCHASES ══ -->
<div class="page s-orange">
  <div class="section-header">
    <div class="section-icon">🧾</div>
    <div>
      <div class="section-title">Sales Module</div>
      <div class="section-desc">Full GST-compliant invoicing with auto calculations</div>
    </div>
  </div>
  <div class="grid">
    <div class="card c-orange">
      <div class="card-title"><span class="dot"></span>Sales Invoices (SI-XXXX)</div>
      <ul class="feature-list">
        <li>Auto serial numbering (SI-0001, SI-0002…)</li>
        <li>Manual serial number mode — enter freely</li>
        <li>Custom prefix per business (e.g. INV, BILL)</li>
        <li>Doc start number configurable</li>
        <li>Duplicate doc number warning + dropdown</li>
        <li>Tick-select items — checkbox to include/exclude</li>
        <li>Multiple items per invoice</li>
        <li>HSN/SAC code per item</li>
      </ul>
    </div>
    <div class="card c-orange">
      <div class="card-title"><span class="dot"></span>GST Calculations</div>
      <ul class="feature-list">
        <li>Discount applied BEFORE GST</li>
        <li>Intra-state: CGST + SGST split</li>
        <li>Inter-state: IGST applied</li>
        <li>GST-Inclusive Rate Toggle — "GST Inc." checkbox</li>
        <li>Auto back-calculate base rate from inclusive price</li>
        <li>Multiple tax rates per invoice (0%, 5%, 12%, 18%, 28%)</li>
        <li>Tax summary table at invoice bottom</li>
        <li>Full GST details — ready to fill & upload</li>
      </ul>
    </div>
    <div class="card c-orange">
      <div class="card-title"><span class="dot"></span>Invoice Options</div>
      <ul class="feature-list">
        <li>Transport charges after tax</li>
        <li>Optional shipping address</li>
        <li>Party GSTIN & state auto-fill</li>
        <li>Place of supply selection</li>
        <li>Notes / narration field</li>
        <li>Print-ready invoice layout</li>
        <li>PDF download of invoice</li>
        <li>Deleted docs Bin — restore or permanent delete</li>
      </ul>
    </div>
    <div class="card c-orange">
      <div class="card-title"><span class="dot"></span>Credit Notes (CN-XXXX)</div>
      <ul class="feature-list">
        <li>Link to original sales invoice</li>
        <li>Partial or full credit</li>
        <li>GST reversal auto-calculated</li>
        <li>Affects outstanding balance</li>
        <li>Appears in GSTR-1 returns</li>
      </ul>
    </div>
  </div>

  <div class="section-header" style="margin-top:24px;">
    <div class="section-icon">🛒</div>
    <div>
      <div class="section-title">Purchase Module</div>
      <div class="section-desc">Track all purchases and supplier bills with full GST ITC</div>
    </div>
  </div>
  <div class="grid">
    <div class="card c-purple">
      <div class="card-title"><span class="dot" style="background:#8b5cf6"></span>Purchase Bills (PB-XXXX)</div>
      <ul class="feature-list">
        <li>Supplier bill entry with GST breakup</li>
        <li>Input Tax Credit (ITC) auto-tracked</li>
        <li>HSN/SAC code per item</li>
        <li>Same GST-inclusive toggle as sales</li>
        <li>Bill status: Unpaid / Partial / Paid</li>
        <li>Custom prefix per business</li>
      </ul>
    </div>
    <div class="card c-purple">
      <div class="card-title"><span class="dot" style="background:#8b5cf6"></span>Debit Notes (DN-XXXX)</div>
      <ul class="feature-list">
        <li>Supplier return / purchase correction</li>
        <li>Link to original purchase bill</li>
        <li>GST reversal on ITC</li>
        <li>Affects supplier outstanding balance</li>
        <li>Appears in GSTR-3B as ITC reversal</li>
      </ul>
    </div>
  </div>
</div>

<!-- ════════════════════════════════════════════ PAGE 3 · PAYMENTS & MASTERS ══ -->
<div class="page s-green">
  <div class="section-header">
    <div class="section-icon">💳</div>
    <div>
      <div class="section-title">Payments Module</div>
      <div class="section-desc">Bill-wise receipt and payment tracking with auto voucher status updates</div>
    </div>
  </div>
  <div class="grid">
    <div class="card c-green">
      <div class="card-title"><span class="dot"></span>Receipts (REC-XXXX)</div>
      <ul class="feature-list">
        <li>Collect payment from customers</li>
        <li>Bill-wise allocation — link to specific invoices</li>
        <li>On-account payment (unallocated)</li>
        <li>Partial payment support</li>
        <li>Auto-updates invoice status (Partial / Paid)</li>
        <li>Multiple invoices in one receipt</li>
        <li>Cash / Bank / UPI mode</li>
        <li>Receipt number auto-generated</li>
      </ul>
    </div>
    <div class="card c-green">
      <div class="card-title"><span class="dot"></span>Payments (PAY-XXXX)</div>
      <ul class="feature-list">
        <li>Pay suppliers against purchase bills</li>
        <li>Bill-wise or on-account</li>
        <li>Partial payment tracking</li>
        <li>Auto-updates bill status (Partial / Paid)</li>
        <li>Payment number auto-generated</li>
        <li>Edit & delete support</li>
      </ul>
    </div>
    <div class="card c-green">
      <div class="card-title"><span class="dot"></span>Outstanding Management</div>
      <ul class="feature-list">
        <li>Outstanding Receivables — all unpaid customer invoices</li>
        <li>Outstanding Payables — all unpaid supplier bills</li>
        <li>Filter by party, date range</li>
        <li>Ageing analysis (overdue days)</li>
        <li>One-click receive/pay from outstanding list</li>
        <li>Bill-wise toggle in Party Statement</li>
      </ul>
    </div>
    <div class="card c-green">
      <div class="card-title"><span class="dot"></span>Cash & Bank Module</div>
      <ul class="feature-list">
        <li>Multiple accounts — Cash in Hand, Petty Cash, SBI, HDFC etc.</li>
        <li>Cash Book report — daily in/out with running balance</li>
        <li>Bank Statement — per account transactions</li>
        <li>Contra entry — cash ↔ bank transfer</li>
        <li>Expense vouchers — rent, electricity, salary</li>
        <li>Expense heads master (CRUD)</li>
        <li>Auto balance update on every transaction</li>
      </ul>
    </div>
  </div>

  <div class="section-header" style="margin-top:22px;">
    <div class="section-icon">🗂️</div>
    <div>
      <div class="section-title">Masters</div>
      <div class="section-desc">All master data with Edit + Delete on every record</div>
    </div>
  </div>
  <div class="grid-3">
    <div class="card c-teal">
      <div class="card-title"><span class="dot" style="background:#06b6d4"></span>Parties</div>
      <ul class="feature-list">
        <li>Customer / Supplier / Both type</li>
        <li>GSTIN validation</li>
        <li>State code auto-fill</li>
        <li>Opening balance (Dr/Cr)</li>
        <li>Search, filter, paginate</li>
        <li>Edit + Delete supported</li>
      </ul>
    </div>
    <div class="card c-teal">
      <div class="card-title"><span class="dot" style="background:#06b6d4"></span>Items</div>
      <ul class="feature-list">
        <li>Goods / Service type</li>
        <li>HSN/SAC code link</li>
        <li>Default tax rate</li>
        <li>Sale & purchase price</li>
        <li>Opening stock</li>
        <li>Item image upload (Supabase)</li>
        <li>Barcode auto-generate on save</li>
      </ul>
    </div>
    <div class="card c-teal">
      <div class="card-title"><span class="dot" style="background:#06b6d4"></span>Other Masters</div>
      <ul class="feature-list">
        <li>Units — inline row editing</li>
        <li>HSN/SAC codes — inline editing</li>
        <li>GST tax rates — inline editing</li>
        <li>6 default units auto-created</li>
        <li>5 default GST rates auto-created</li>
        <li>States list — all Indian states</li>
      </ul>
    </div>
  </div>
</div>

<!-- ══════════════════════════════════════ PAGE 4 · ACCOUNTING & GST & INV ══ -->
<div class="page s-purple">
  <div class="section-header">
    <div class="section-icon">📒</div>
    <div>
      <div class="section-title">Accounting & Reports</div>
      <div class="section-desc">Complete double-entry accounting with GST compliance reports</div>
    </div>
  </div>
  <div class="grid">
    <div class="card c-purple">
      <div class="card-title"><span class="dot"></span>Party Ledger</div>
      <ul class="feature-list">
        <li>All Dr/Cr entries per party</li>
        <li>Running balance column</li>
        <li>Date range filter</li>
        <li>Sales, purchase, receipts, payments — all in one</li>
        <li>Opening balance included</li>
        <li>Print / export ledger</li>
      </ul>
    </div>
    <div class="card c-purple">
      <div class="card-title"><span class="dot"></span>Trial Balance</div>
      <ul class="feature-list">
        <li>Standard format — all ledger heads</li>
        <li>Debtors / Creditors group</li>
        <li>Sales / Purchase accounts</li>
        <li>Bank / Cash balances</li>
        <li>GST liability / ITC accounts</li>
        <li>Debit = Credit auto-verified</li>
      </ul>
    </div>
    <div class="card c-purple">
      <div class="card-title"><span class="dot"></span>GSTR-1</div>
      <ul class="feature-list">
        <li>B2B invoices breakup (with GSTIN)</li>
        <li>B2C summary (without GSTIN)</li>
        <li>Month + Year filter</li>
        <li>JSON export — ready to upload on GST portal</li>
        <li>HSN-wise summary</li>
        <li>IGST / CGST / SGST split</li>
      </ul>
    </div>
    <div class="card c-purple">
      <div class="card-title"><span class="dot"></span>GSTR-3B</div>
      <ul class="feature-list">
        <li>Output GST (from sales)</li>
        <li>Input Tax Credit — ITC from purchases</li>
        <li>Net GST payable calculation</li>
        <li>Month + Year filter</li>
        <li>Ready-to-fill format</li>
        <li>Matches GSTR-1 output values</li>
      </ul>
    </div>
  </div>

  <div class="section-header" style="margin-top:22px;">
    <div class="section-icon">📦</div>
    <div>
      <div class="section-title">Inventory</div>
      <div class="section-desc">Real-time stock tracking with alerts</div>
    </div>
  </div>
  <div class="grid">
    <div class="card c-indigo">
      <div class="card-title"><span class="dot" style="background:#6366f1"></span>Stock Management</div>
      <ul class="feature-list">
        <li>Real-time stock levels (opening + purchased − sold)</li>
        <li>Average rate calculation</li>
        <li>Stock value (qty × avg rate)</li>
        <li>Low stock alerts (configurable threshold)</li>
        <li>Item-wise stock report</li>
        <li>Category-wise filtering</li>
      </ul>
    </div>
    <div class="card c-indigo">
      <div class="card-title"><span class="dot" style="background:#6366f1"></span>Barcode System</div>
      <ul class="feature-list">
        <li>Barcode auto-generated on item save</li>
        <li>Scanner support — scan to add item in invoice</li>
        <li>Single barcode label print</li>
        <li>Bulk barcode label print (quantity per item)</li>
        <li>Custom label designer — drag & drop</li>
        <li>Templates with logo + fields</li>
      </ul>
    </div>
  </div>
</div>

<!-- ═══════════════════════════════════════════ PAGE 5 · SETTINGS & TECH ══ -->
<div class="page s-teal">
  <div class="section-header">
    <div class="section-icon">⚙️</div>
    <div>
      <div class="section-title">Business Settings</div>
      <div class="section-desc">Full control over business profile, users, permissions and invoice configuration</div>
    </div>
  </div>
  <div class="grid">
    <div class="card c-teal">
      <div class="card-title"><span class="dot"></span>Business Profile</div>
      <ul class="feature-list">
        <li>Business name, GSTIN, PAN</li>
        <li>Full address with state</li>
        <li>Financial year start month</li>
        <li>Business logo upload</li>
        <li>Contact email & phone</li>
        <li>Industry type selection</li>
      </ul>
    </div>
    <div class="card c-teal">
      <div class="card-title"><span class="dot"></span>Invoice Configuration</div>
      <ul class="feature-list">
        <li>Custom prefix per voucher type (SI, CN, PB, DN)</li>
        <li>Serial number mode — Auto or Manual per business</li>
        <li>Doc start number (series begins from X)</li>
        <li>Print template customisation</li>
        <li>Footer text on invoices</li>
      </ul>
    </div>
    <div class="card c-teal">
      <div class="card-title"><span class="dot"></span>Users & Permissions</div>
      <ul class="feature-list">
        <li>Multiple users per business</li>
        <li>Roles: Business Admin / Staff</li>
        <li>Module-wise permission toggle per staff</li>
        <li>Staff can be restricted to specific modules only</li>
        <li>Password reset by admin</li>
        <li>Max users as per plan</li>
      </ul>
    </div>
    <div class="card c-teal">
      <div class="card-title"><span class="dot"></span>Data Backup & Restore</div>
      <ul class="feature-list">
        <li>Download JSON backup — all data in one file</li>
        <li>Includes: parties, items, vouchers, payments</li>
        <li>One-click download anytime</li>
        <li>Restore from backup — re-import data</li>
        <li>Cloud: Supabase PostgreSQL</li>
        <li>Desktop: SQLite auto-backup (last 7 copies)</li>
        <li>ZIP with PIN password — secure backup</li>
        <li>Restore before login on desktop version</li>
      </ul>
    </div>
  </div>

  <div class="section-header" style="margin-top:22px;">
    <div class="section-icon">🛡️</div>
    <div>
      <div class="section-title">Tech Support Panel (Super Admin)</div>
      <div class="section-desc">Full platform management — businesses, plans, users, branding and analytics</div>
    </div>
  </div>
  <div class="grid">
    <div class="card c-red">
      <div class="card-title"><span class="dot" style="background:#ef4444"></span>Dashboard</div>
      <ul class="feature-list">
        <li>Total businesses on platform</li>
        <li>Trial count vs paid count</li>
        <li>Total users across all businesses</li>
        <li>New businesses this month</li>
        <li>Plan-wise breakdown chart</li>
        <li>Login activity log with GPS</li>
      </ul>
    </div>
    <div class="card c-red">
      <div class="card-title"><span class="dot" style="background:#ef4444"></span>Business Management</div>
      <ul class="feature-list">
        <li>List all businesses — search, filter, paginate</li>
        <li>Assign subscription plan</li>
        <li>Set plan expiry date manually</li>
        <li>Mark as trial / active / blocked</li>
        <li>Per-business JSON backup download</li>
        <li>View all users of any business</li>
        <li>Activation codes tab per business</li>
        <li>Activation log tab — full history</li>
      </ul>
    </div>
    <div class="card c-red">
      <div class="card-title"><span class="dot" style="background:#ef4444"></span>Plans Management</div>
      <ul class="feature-list">
        <li>Full CRUD — Create / Edit / Delete plans</li>
        <li>Plan name, price, billing cycle</li>
        <li>Validity days, trial days</li>
        <li>Max users per plan</li>
        <li>Features list per plan</li>
        <li>Sort order & active toggle</li>
        <li>License voucher group (visible to buyer or not)</li>
      </ul>
    </div>
    <div class="card c-red">
      <div class="card-title"><span class="dot" style="background:#ef4444"></span>App Settings & Support</div>
      <ul class="feature-list">
        <li>Software name (white-label)</li>
        <li>Support email & phone</li>
        <li>Logo URL configuration</li>
        <li>Primary colour (branding)</li>
        <li>Footer text on all pages</li>
        <li>Support Messages inbox (chat with login-screen users)</li>
        <li>Reply to user chat — in-app messaging</li>
        <li>Backup All — download all businesses' data as single ZIP</li>
      </ul>
    </div>
  </div>
</div>

<!-- ═══════════════════════════════════════════ PAGE 6 · CLOUD & DESKTOP ══ -->
<div class="page s-indigo">
  <div class="section-header">
    <div class="section-icon">☁️</div>
    <div>
      <div class="section-title">Cloud Version</div>
      <div class="section-desc">Fully hosted SaaS — access from anywhere, any device</div>
    </div>
  </div>
  <div class="grid">
    <div class="card c-indigo">
      <div class="card-title"><span class="dot"></span>Deployment</div>
      <ul class="feature-list">
        <li>Frontend: Vercel (global CDN)</li>
        <li>Backend API: Express on Vercel serverless</li>
        <li>Database: Supabase PostgreSQL</li>
        <li>File storage: Cloudinary (25 GB free)</li>
        <li>FIFO auto-cleanup at 20 GB storage</li>
        <li>File max size: 10 MB per upload</li>
        <li>Always-on, zero maintenance for user</li>
      </ul>
    </div>
    <div class="card c-indigo">
      <div class="card-title"><span class="dot"></span>Multi-Tenant Architecture</div>
      <ul class="feature-list">
        <li>Each business fully isolated</li>
        <li>Shared database with row-level isolation</li>
        <li>Business code ensures data separation</li>
        <li>Scalable to thousands of businesses</li>
        <li>Zero cross-business data leak risk</li>
      </ul>
    </div>
    <div class="card c-indigo">
      <div class="card-title"><span class="dot"></span>Access & Security</div>
      <ul class="feature-list">
        <li>Login from any browser, any OS</li>
        <li>HTTPS enforced (Vercel TLS)</li>
        <li>JWT authentication — 7-day sessions</li>
        <li>CORS restricted to known domains</li>
        <li>Role-based API middleware</li>
        <li>Session invalidation on logout</li>
      </ul>
    </div>
    <div class="card c-indigo">
      <div class="card-title"><span class="dot"></span>DB Connection Modes</div>
      <ul class="feature-list">
        <li>Cloud mode: Supabase PostgreSQL</li>
        <li>DB mode indicator in Business Settings</li>
        <li>Cloud/local toggle in localStorage (dev)</li>
        <li>Automatic failover handling</li>
      </ul>
    </div>
  </div>

  <div class="section-header" style="margin-top:22px;">
    <div class="section-icon">🖥️</div>
    <div>
      <div class="section-title">Desktop LAN Version</div>
      <div class="section-desc">Offline-first Windows EXE — one PC as server, others connect via browser on LAN</div>
    </div>
  </div>
  <div class="grid">
    <div class="card c-pink">
      <div class="card-title"><span class="dot" style="background:#ec4899"></span>Installation</div>
      <ul class="feature-list">
        <li>Windows .EXE installer — single click</li>
        <li>Node.js + PostgreSQL bundled</li>
        <li>Auto GitHub Actions build on every version tag</li>
        <li>Published to GitHub Releases automatically</li>
        <li>Electron-based desktop app wrapper</li>
        <li>Version auto-bump on every release</li>
      </ul>
    </div>
    <div class="card c-pink">
      <div class="card-title"><span class="dot" style="background:#ec4899"></span>LAN Networking</div>
      <ul class="feature-list">
        <li>Server PC runs Node.js + local PostgreSQL</li>
        <li>Clients connect via browser — no install needed</li>
        <li>http://bizcor.local hostname — mDNS auto-resolve</li>
        <li>QR code — scan from phone to connect</li>
        <li>Windows Firewall auto-configured on install</li>
        <li>Same WiFi — all devices share live data</li>
      </ul>
    </div>
    <div class="card c-pink">
      <div class="card-title"><span class="dot" style="background:#ec4899"></span>Offline Database</div>
      <ul class="feature-list">
        <li>SQLite local database (no internet needed)</li>
        <li>SQLITE_PATH env var for desktop mode</li>
        <li>All data stays on-premises</li>
        <li>No cloud dependency for daily operations</li>
        <li>Internet only for activation & backup sync</li>
      </ul>
    </div>
    <div class="card c-pink">
      <div class="card-title"><span class="dot" style="background:#ec4899"></span>LAN Internal Chat</div>
      <ul class="feature-list">
        <li>Staff-to-staff messaging over LAN</li>
        <li>No internet required</li>
        <li>Text + file + image sharing</li>
        <li>WebSocket real-time (server PC hosts)</li>
        <li>Draggable chat window</li>
        <li>File download with thumbnail previews</li>
        <li>Admin clear-chat button</li>
        <li>Upload cancel (AbortController)</li>
      </ul>
    </div>
  </div>
</div>

<!-- ═══════════════════════════════════════════ PAGE 7 · LICENSING & REFERRAL ══ -->
<div class="page s-red">
  <div class="section-header">
    <div class="section-icon">🔑</div>
    <div>
      <div class="section-title">Licensing & Activation System</div>
      <div class="section-desc">Two-key offline licensing with zero piracy design</div>
    </div>
  </div>
  <div class="grid">
    <div class="card c-red">
      <div class="card-title"><span class="dot"></span>Two-Key System</div>
      <ul class="feature-list">
        <li>Installer Key — bundled in EXE TXT file</li>
        <li>Online validation on install (net required once)</li>
        <li>Binds: email, phone, MAC, CPU ID, Windows version, IP</li>
        <li>Plan Key — generated in Tech Panel for paid plans</li>
        <li>Activation via phone QR scan (PC needs no internet)</li>
        <li>Hardware-bound activation code via email</li>
      </ul>
    </div>
    <div class="card c-red">
      <div class="card-title"><span class="dot"></span>Anti-Piracy</div>
      <ul class="feature-list">
        <li>No install possible without internet (Installer Key)</li>
        <li>Plan Key: single-use + hardware-bound</li>
        <li>Free Key also requires online activation</li>
        <li>No heartbeat needed — net only at install + activate</li>
        <li>Voucher code reuse — old PC auto-blocked</li>
        <li>Reuse log visible in Tech Panel</li>
      </ul>
    </div>
    <div class="card c-red">
      <div class="card-title"><span class="dot"></span>Tech Panel Activation</div>
      <ul class="feature-list">
        <li>Activation Codes tab per business</li>
        <li>Activation Log tab — full history</li>
        <li>Date/time, email, phone, fingerprint, IP logged</li>
        <li>Manual block suspicious activations</li>
        <li>30-day trial timer</li>
        <li>Plan expiry management</li>
      </ul>
    </div>
    <div class="card c-red">
      <div class="card-title"><span class="dot"></span>Market Analytics</div>
      <ul class="feature-list">
        <li>Conversion rate (installs vs activations)</li>
        <li>Region-wise installation map</li>
        <li>Free vs Paid ratio</li>
        <li>Average install-to-purchase gap</li>
        <li>Gap analysis: 2d / 30d / 60d / 90d+</li>
      </ul>
    </div>
  </div>

  <div class="section-header" style="margin-top:22px;">
    <div class="section-icon">🎯</div>
    <div>
      <div class="section-title">Referral System</div>
      <div class="section-desc">Built-in referral tracking with auto-reward</div>
    </div>
  </div>
  <div class="grid">
    <div class="card c-orange">
      <div class="card-title"><span class="dot" style="background:#f59e0b"></span>Business Side</div>
      <ul class="feature-list">
        <li>Unique referral code per business (auto on registration)</li>
        <li>Optional referral code field at registration</li>
        <li>Progress bar — 0/5 referred count</li>
        <li>Reward status display</li>
        <li>Auto "Referral Plan" on 5 successful referrals</li>
      </ul>
    </div>
    <div class="card c-orange">
      <div class="card-title"><span class="dot" style="background:#f59e0b"></span>Tech Panel</div>
      <ul class="feature-list">
        <li>"Referrals" column in Businesses list</li>
        <li>"Referred by: Name/Code" per business</li>
        <li>Referral Analytics page — top referrers</li>
        <li>Monthly referral count charts</li>
        <li>Reward assignment tracking</li>
      </ul>
    </div>
  </div>
</div>

<!-- ═══════════════════════════════════════════ PAGE 8 · OFFLINE & FUTURE ══ -->
<div class="page s-green">
  <div class="section-header">
    <div class="section-icon">📡</div>
    <div>
      <div class="section-title">Offline-First & Sync Architecture</div>
      <div class="section-desc">IndexedDB-based offline mode with background sync — work without internet</div>
    </div>
  </div>
  <div class="grid">
    <div class="card c-green">
      <div class="card-title"><span class="dot"></span>Phase 1 — Local Storage</div>
      <ul class="feature-list">
        <li>IndexedDB setup — parties, items, vouchers locally stored</li>
        <li>Offline Drafts — create invoices without internet</li>
        <li>/offline-drafts page — view and manage pending drafts</li>
        <li>Sync pending / conflict status per record</li>
      </ul>
    </div>
    <div class="card c-green">
      <div class="card-title"><span class="dot"></span>Phase 2-3 — Sync</div>
      <ul class="feature-list">
        <li>Reads from local, writes to sync queue</li>
        <li>Background sync — auto push on internet restore</li>
        <li>Temporary UUID offline → real doc number from server</li>
        <li>Sync status indicator per record</li>
      </ul>
    </div>
    <div class="card c-green">
      <div class="card-title"><span class="dot"></span>Multi-Device Sync</div>
      <ul class="feature-list">
        <li>3 PCs on LAN — real-time WebSocket sync</li>
        <li>Conflict resolution UI (newer timestamp wins)</li>
        <li>Cloud version: Supabase Realtime</li>
        <li>LAN version: local WebSocket server</li>
      </ul>
    </div>
    <div class="card c-green">
      <div class="card-title"><span class="dot"></span>Desktop Backup & Restore</div>
      <ul class="feature-list">
        <li>Full SQLite DB ZIP backup — date-time stamped</li>
        <li>ZIP password = user PIN (no one else can open)</li>
        <li>Auto backup daily (silent, 7 copies retained)</li>
        <li>Manual backup — one click anytime</li>
        <li>Restore from login screen (before login)</li>
        <li>Restore on any PC — full data recovery</li>
      </ul>
    </div>
  </div>

  <!-- Summary table -->
  <div style="margin-top:24px;">
    <div class="section-header">
      <div class="section-icon">📋</div>
      <div>
        <div class="section-title">Feature Summary at a Glance</div>
        <div class="section-desc">Quick reference — module count and key numbers</div>
      </div>
    </div>
    <table class="feat-table">
      <thead>
        <tr><th>Module</th><th>Key Features</th><th>Count</th></tr>
      </thead>
      <tbody>
        <tr><td>🔐 Authentication</td><td>Business login, Tech login, Fingerprint, Support chat, Registration</td><td>5 flows</td></tr>
        <tr><td>📊 Dashboard</td><td>4-period summary, 12-month chart, Top customers, Outstanding</td><td>10+ widgets</td></tr>
        <tr><td>🧾 Sales</td><td>Invoices, Credit Notes, GST-inclusive toggle, Serial modes</td><td>2 voucher types</td></tr>
        <tr><td>🛒 Purchases</td><td>Bills, Debit Notes, ITC tracking</td><td>2 voucher types</td></tr>
        <tr><td>💳 Payments</td><td>Receipts, Payments, Bill-wise, Outstanding</td><td>2 voucher types</td></tr>
        <tr><td>🏦 Cash & Bank</td><td>Multiple accounts, Contra, Expenses, Cash book, Bank statement</td><td>6 sub-modules</td></tr>
        <tr><td>📒 Accounting</td><td>Party ledger, Trial balance, Receivables, Payables</td><td>4 reports</td></tr>
        <tr><td>🇮🇳 GST</td><td>GSTR-1 (B2B+B2C), GSTR-3B, JSON export, Ready to upload</td><td>2 returns</td></tr>
        <tr><td>📦 Inventory</td><td>Real-time stock, Avg rate, Low stock alert, Barcode</td><td>4 features</td></tr>
        <tr><td>🗂️ Masters</td><td>Parties, Items, Units, HSN, Tax rates</td><td>5 masters</td></tr>
        <tr><td>⚙️ Settings</td><td>Profile, Invoice config, Users, Permissions, Backup</td><td>5 sections</td></tr>
        <tr><td>🛡️ Tech Panel</td><td>Businesses, Plans, Users, App settings, Support chat, Backup</td><td>7 sections</td></tr>
        <tr><td>🖥️ Desktop LAN</td><td>EXE installer, LAN server, QR connect, Internal chat, Offline DB</td><td>5 features</td></tr>
        <tr><td>🔑 Licensing</td><td>Two-key system, Hardware bind, Anti-piracy, Analytics</td><td>4 components</td></tr>
        <tr><td>🎯 Referral</td><td>Unique codes, Auto-reward, Analytics, Tech panel tracking</td><td>4 features</td></tr>
      </tbody>
    </table>
  </div>
</div>

</body>
</html>`;

const browser = await puppeteer.launch({
  executablePath: CHROMIUM,
  args: ["--no-sandbox","--disable-setuid-sandbox","--disable-dev-shm-usage","--disable-gpu"],
});
const page = await browser.newPage();
await page.setContent(html, { waitUntil: "networkidle0" });
await page.emulateMediaType("screen");
const pdf = await page.pdf({
  format: "A4",
  printBackground: true,
  margin: { top: "0", right: "0", bottom: "0", left: "0" },
  displayHeaderFooter: false,
});
await browser.close();
writeFileSync("/home/runner/workspace/BizCor-ERP-Features.pdf", pdf);
console.log("✅ PDF generated!");
