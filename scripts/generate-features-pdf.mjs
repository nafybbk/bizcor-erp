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

  /* ── Cover ── */
  .cover{width:100%;height:100vh;background:linear-gradient(135deg,#0f0c29,#302b63,#24243e);display:flex;flex-direction:column;align-items:center;justify-content:center;page-break-after:always;position:relative;overflow:hidden;}
  .c1{position:absolute;width:600px;height:600px;background:#fff;border-radius:50%;opacity:.06;top:-200px;right:-200px;}
  .c2{position:absolute;width:400px;height:400px;background:#6c63ff;border-radius:50%;opacity:.07;bottom:-100px;left:-100px;}
  .cover-logo{width:90px;height:90px;background:linear-gradient(135deg,#6c63ff,#3ecf8e);border-radius:24px;display:flex;align-items:center;justify-content:center;font-size:42px;margin-bottom:28px;box-shadow:0 20px 60px rgba(108,99,255,.4);}
  .cover-title{font-size:52px;font-weight:900;color:#fff;letter-spacing:-1px;text-align:center;}
  .cover-sub{font-size:17px;color:rgba(255,255,255,.65);margin-top:10px;font-weight:300;letter-spacing:2px;text-transform:uppercase;text-align:center;}
  .cover-desc{margin-top:20px;font-size:13px;color:rgba(255,255,255,.5);text-align:center;max-width:500px;line-height:1.7;}
  .cover-tag{margin-top:36px;display:flex;gap:12px;flex-wrap:wrap;justify-content:center;}
  .cover-tag span{background:rgba(255,255,255,.12);color:#fff;border:1px solid rgba(255,255,255,.2);border-radius:20px;padding:6px 18px;font-size:11px;font-weight:500;}
  .cover-footer{position:absolute;bottom:36px;color:rgba(255,255,255,.35);font-size:9.5px;letter-spacing:1px;text-align:center;}

  /* ── Pages ── */
  .page{padding:38px 46px;page-break-after:always;}
  .page:last-child{page-break-after:avoid;}

  .section-header{display:flex;align-items:center;gap:14px;margin-bottom:22px;padding-bottom:12px;border-bottom:2px solid;}
  .section-icon{width:42px;height:42px;border-radius:13px;display:flex;align-items:center;justify-content:center;font-size:20px;flex-shrink:0;}
  .section-title{font-size:20px;font-weight:800;letter-spacing:-.3px;}
  .section-desc{font-size:10px;color:#666;margin-top:2px;}

  .grid{display:grid;grid-template-columns:1fr 1fr;gap:13px;}
  .grid-3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:11px;}
  .card{border-radius:13px;padding:14px 16px;border:1px solid;}
  .card-title{font-size:11px;font-weight:700;margin-bottom:7px;display:flex;align-items:center;gap:7px;}
  .dot{width:8px;height:8px;border-radius:50%;flex-shrink:0;}
  .feature-list{list-style:none;}
  .feature-list li{font-size:10px;color:#444;padding:2.5px 0;display:flex;align-items:flex-start;gap:6px;line-height:1.5;}
  .feature-list li::before{content:'›';font-weight:700;flex-shrink:0;margin-top:0;}

  /* Colours */
  .s-blue .section-header{border-color:#3b82f6;} .s-blue .section-icon{background:#eff6ff;} .s-blue .section-title{color:#1d4ed8;}
  .c-blue{background:#f0f7ff;border-color:#bfdbfe;} .c-blue .card-title{color:#1d4ed8;} .c-blue .dot{background:#3b82f6;} .c-blue li::before{color:#3b82f6;}
  .s-green .section-header{border-color:#10b981;} .s-green .section-icon{background:#ecfdf5;} .s-green .section-title{color:#065f46;}
  .c-green{background:#f0fdf4;border-color:#bbf7d0;} .c-green .card-title{color:#065f46;} .c-green .dot{background:#10b981;} .c-green li::before{color:#10b981;}
  .s-purple .section-header{border-color:#8b5cf6;} .s-purple .section-icon{background:#f5f3ff;} .s-purple .section-title{color:#5b21b6;}
  .c-purple{background:#faf5ff;border-color:#ddd6fe;} .c-purple .card-title{color:#5b21b6;} .c-purple .dot{background:#8b5cf6;} .c-purple li::before{color:#8b5cf6;}
  .s-orange .section-header{border-color:#f59e0b;} .s-orange .section-icon{background:#fffbeb;} .s-orange .section-title{color:#92400e;}
  .c-orange{background:#fffbeb;border-color:#fde68a;} .c-orange .card-title{color:#92400e;} .c-orange .dot{background:#f59e0b;} .c-orange li::before{color:#f59e0b;}
  .s-teal .section-header{border-color:#06b6d4;} .s-teal .section-icon{background:#ecfeff;} .s-teal .section-title{color:#0e7490;}
  .c-teal{background:#ecfeff;border-color:#a5f3fc;} .c-teal .card-title{color:#0e7490;} .c-teal .dot{background:#06b6d4;} .c-teal li::before{color:#06b6d4;}
  .s-pink .section-header{border-color:#ec4899;} .s-pink .section-icon{background:#fdf2f8;} .s-pink .section-title{color:#9d174d;}
  .c-pink{background:#fdf2f8;border-color:#fbcfe8;} .c-pink .card-title{color:#9d174d;} .c-pink .dot{background:#ec4899;} .c-pink li::before{color:#ec4899;}
  .s-indigo .section-header{border-color:#6366f1;} .s-indigo .section-icon{background:#eef2ff;} .s-indigo .section-title{color:#3730a3;}
  .c-indigo{background:#eef2ff;border-color:#c7d2fe;} .c-indigo .card-title{color:#3730a3;} .c-indigo .dot{background:#6366f1;} .c-indigo li::before{color:#6366f1;}
  .s-red .section-header{border-color:#ef4444;} .s-red .section-icon{background:#fef2f2;} .s-red .section-title{color:#991b1b;}
  .c-red{background:#fff5f5;border-color:#fecaca;} .c-red .card-title{color:#991b1b;} .c-red .dot{background:#ef4444;} .c-red li::before{color:#ef4444;}

  /* Summary table */
  .feat-table{width:100%;border-collapse:collapse;margin-top:10px;}
  .feat-table th{background:#f8fafc;font-size:9.5px;font-weight:700;color:#64748b;padding:7px 10px;text-align:left;border-bottom:2px solid #e2e8f0;}
  .feat-table td{font-size:10px;padding:5.5px 10px;border-bottom:1px solid #f1f5f9;color:#374151;vertical-align:top;}
  .feat-table tr:last-child td{border-bottom:none;}

  /* Highlight strip */
  .strip{border-radius:12px;padding:14px 18px;margin-bottom:16px;border-left:4px solid;}
  .strip-blue{background:#eff6ff;border-color:#3b82f6;color:#1d4ed8;}
  .strip-green{background:#f0fdf4;border-color:#10b981;color:#065f46;}
  .strip-purple{background:#f5f3ff;border-color:#8b5cf6;color:#5b21b6;}
  .strip-title{font-size:11px;font-weight:700;margin-bottom:4px;}
  .strip-body{font-size:10px;color:#555;line-height:1.6;}
</style>
</head>
<body>

<!-- ══════════════════════════════════ COVER ══ -->
<div class="cover">
  <div class="c1"></div><div class="c2"></div>
  <div class="cover-logo">🏢</div>
  <div class="cover-title">BizCor ERP</div>
  <div class="cover-sub">Complete Features — Business Owner's Guide</div>
  <div class="cover-desc">
    Apka business manage karne ke liye sabse aasaan, powerful aur
    GST-ready Indian ERP. Sales, Purchases, Payments, GST Reports,
    Inventory aur bahut kuch — ek hi jagah.
  </div>
  <div class="cover-tag">
    <span>🧾 GST Compliant</span>
    <span>📱 Mobile Ready</span>
    <span>☁️ Cloud + Offline</span>
    <span>👥 Multi-User</span>
    <span>📊 Real-time Reports</span>
    <span>🔒 Secure & Private</span>
  </div>
  <div class="cover-footer">BizCor ERP · Indian Business Software · 2026</div>
</div>

<!-- ══════════════════════════ PAGE 1 · LOGIN & DASHBOARD ══ -->
<div class="page s-blue">
  <div class="section-header">
    <div class="section-icon">🔐</div>
    <div>
      <div class="section-title">Login & Account Setup</div>
      <div class="section-desc">Aasaan registration, secure login aur puri business setup ek baar mein</div>
    </div>
  </div>
  <div class="grid">
    <div class="card c-blue">
      <div class="card-title"><span class="dot"></span>Business Registration</div>
      <ul class="feature-list">
        <li>Sirf email aur password se naya account banayein</li>
        <li>Apna Business Code auto-generate hota hai</li>
        <li>GSTIN, PAN, address pehle se fill kar sakte hain</li>
        <li>Financial year start month set karein</li>
        <li>Register hote hi 6 default units auto-create</li>
        <li>5 GST rates (0%, 5%, 12%, 18%, 28%) auto-ready</li>
        <li>Kisi bhi browser se — koi installation nahi</li>
      </ul>
    </div>
    <div class="card c-blue">
      <div class="card-title"><span class="dot"></span>Secure Login</div>
      <ul class="feature-list">
        <li>Business Code + Email + Password se login</li>
        <li>Secure JWT session — 7 din tak logged in</li>
        <li>Multiple users ek hi business pe login kar sakte hain</li>
        <li>Plan expiry alert — band hone se pehle warning</li>
        <li>Apna plan aur subscription status dekh sakte hain</li>
        <li>Mobile browser pe bhi perfectly kaam karta hai</li>
      </ul>
    </div>
    <div class="card c-blue">
      <div class="card-title"><span class="dot"></span>Help & Support Chat</div>
      <ul class="feature-list">
        <li>Login page pe "?" Help button — hamesha visible</li>
        <li>Login se pehle bhi support se baat kar sakte hain</li>
        <li>Name, phone, email bhej ke message karo</li>
        <li>File ya screenshot attach kar sakte ho</li>
        <li>Purana conversation save rehta hai (session based)</li>
        <li>Support ki reply seedha chat mein aati hai</li>
        <li>Draggable window — jahan chahein rakhein</li>
      </ul>
    </div>
    <div class="card c-blue">
      <div class="card-title"><span class="dot"></span>Referral Program</div>
      <ul class="feature-list">
        <li>Har business ka unique referral code</li>
        <li>Apna code dosto ko dein — unhe BizCor use karwayein</li>
        <li>5 successful referrals pe free plan upgrade milta hai</li>
        <li>Progress bar — 0/5 count track karo</li>
        <li>Reward status — kitna baaki hai instantly dekho</li>
      </ul>
    </div>
  </div>

  <div class="section-header" style="margin-top:22px;">
    <div class="section-icon">📊</div>
    <div>
      <div class="section-title">Dashboard — Business Overview</div>
      <div class="section-desc">App kholo aur ek nazar mein poora business samjho</div>
    </div>
  </div>
  <div class="grid">
    <div class="card c-green">
      <div class="card-title"><span class="dot" style="background:#10b981"></span>Summary Cards</div>
      <ul class="feature-list">
        <li>Aaj ki Sales, Iss Mahine, Pichhle Mahine, Is Saal</li>
        <li>Aaj ki Purchases — same 4 time periods</li>
        <li>Total Receivables — customers se kitna lena hai</li>
        <li>Total Payables — suppliers ko kitna dena hai</li>
        <li>Net GST Payable — Output GST minus ITC</li>
      </ul>
    </div>
    <div class="card c-green">
      <div class="card-title"><span class="dot" style="background:#10b981"></span>Charts & Top Lists</div>
      <ul class="feature-list">
        <li>12 mahine ka Sales aur Purchases bar chart</li>
        <li>Top 5 customers — revenue ke hisaab se</li>
        <li>Period filter — mahina aur saal badlein</li>
        <li>Real-time data — manual refresh ki zaroorat nahi</li>
        <li>Mobile pe bhi clearly dikhai deta hai</li>
      </ul>
    </div>
  </div>
</div>

<!-- ══════════════════════════ PAGE 2 · SALES ══ -->
<div class="page s-orange">
  <div class="section-header">
    <div class="section-icon">🧾</div>
    <div>
      <div class="section-title">Sales Module — Bikri ka Hisaab</div>
      <div class="section-desc">GST-ready invoices banayein — seconds mein, bina galti ke</div>
    </div>
  </div>
  <div class="grid">
    <div class="card c-orange">
      <div class="card-title"><span class="dot"></span>Sales Invoice (SI-XXXX)</div>
      <ul class="feature-list">
        <li>Auto number — SI-0001, SI-0002 apne aap banta hai</li>
        <li>Manual mode — apna number khud likhein</li>
        <li>Custom prefix — INV, BILL, SALES — jo chahein</li>
        <li>Series shuru kahan se — doc start number set karein</li>
        <li>Duplicate number warning — galti se bachao</li>
        <li>Multiple items ek invoice mein</li>
        <li>Item checkbox — tick karo jo include karna hai</li>
        <li>HSN/SAC code har item ke saath</li>
      </ul>
    </div>
    <div class="card c-orange">
      <div class="card-title"><span class="dot"></span>GST Auto-Calculation</div>
      <ul class="feature-list">
        <li>Discount pehle lagta hai, phir GST — bilkul sahi formula</li>
        <li>Intra-state: CGST + SGST automatic split</li>
        <li>Inter-state: IGST automatic</li>
        <li>"GST Inc." toggle — inclusive rate daalo, base auto nikal jata hai</li>
        <li>Alag-alag tax rates ek invoice mein</li>
        <li>Tax summary table invoice pe clearly dikhai deti hai</li>
      </ul>
    </div>
    <div class="card c-orange">
      <div class="card-title"><span class="dot"></span>Invoice Options</div>
      <ul class="feature-list">
        <li>Transport charges — tax ke baad add karein</li>
        <li>Alag shipping address — agar delivery aur billing alag ho</li>
        <li>Party ka GSTIN aur state auto-fill</li>
        <li>Place of supply select karein</li>
        <li>Notes / narration field</li>
        <li>Print-ready invoice — seedha customer ko bhejein</li>
        <li>PDF download — WhatsApp pe share karein</li>
      </ul>
    </div>
    <div class="card c-orange">
      <div class="card-title"><span class="dot"></span>Credit Note (CN-XXXX)</div>
      <ul class="feature-list">
        <li>Goods return ya price correction ke liye</li>
        <li>Original invoice se link hota hai</li>
        <li>Partial ya poori credit — aap decide karein</li>
        <li>GST reversal automatic calculate hota hai</li>
        <li>Customer ka outstanding balance auto-update</li>
        <li>GSTR-1 mein automatically include</li>
      </ul>
    </div>
  </div>

  <div class="section-header" style="margin-top:22px;">
    <div class="section-icon">🛒</div>
    <div>
      <div class="section-title">Purchase Module — Kharidi ka Hisaab</div>
      <div class="section-desc">Supplier bills record karein aur GST Input Credit track karein</div>
    </div>
  </div>
  <div class="grid">
    <div class="card c-purple">
      <div class="card-title"><span class="dot" style="background:#8b5cf6"></span>Purchase Bill (PB-XXXX)</div>
      <ul class="feature-list">
        <li>Supplier ka bill enter karein GST breakup ke saath</li>
        <li>Input Tax Credit (ITC) automatic track hota hai</li>
        <li>HSN/SAC code har item pe</li>
        <li>GST-inclusive toggle yahan bhi kaam karta hai</li>
        <li>Bill status — Unpaid / Partial / Paid</li>
        <li>Custom prefix aur serial mode apni choice se</li>
      </ul>
    </div>
    <div class="card c-purple">
      <div class="card-title"><span class="dot" style="background:#8b5cf6"></span>Debit Note (DN-XXXX)</div>
      <ul class="feature-list">
        <li>Supplier ko maal wapas karna ho toh Debit Note</li>
        <li>Original purchase bill se link</li>
        <li>GST reversal — ITC automatically adjust</li>
        <li>Supplier ka outstanding balance update</li>
        <li>GSTR-3B mein reflect hota hai</li>
      </ul>
    </div>
  </div>
</div>

<!-- ══════════════════════════ PAGE 3 · PAYMENTS & CASH/BANK ══ -->
<div class="page s-green">
  <div class="section-header">
    <div class="section-icon">💳</div>
    <div>
      <div class="section-title">Payments — Lena aur Dena</div>
      <div class="section-desc">Bill-wise payment track karein — koi invoice bhuli nahi, koi payment miss nahi</div>
    </div>
  </div>
  <div class="grid">
    <div class="card c-green">
      <div class="card-title"><span class="dot"></span>Receipt — Customer se Lena (REC-XXXX)</div>
      <ul class="feature-list">
        <li>Customer se payment receive karein</li>
        <li>Bill-wise — kaun se invoice ke against aaya decide karein</li>
        <li>On-account bhi — baad mein adjust kar saktein hain</li>
        <li>Partial payment — thoda aaya, baaki baad mein</li>
        <li>Invoice status auto-update — Partial ya Paid</li>
        <li>Ek receipt mein multiple invoices settle karein</li>
        <li>Cash / Bank / UPI — mode note karein</li>
      </ul>
    </div>
    <div class="card c-green">
      <div class="card-title"><span class="dot"></span>Payment — Supplier ko Dena (PAY-XXXX)</div>
      <ul class="feature-list">
        <li>Supplier ko payment karein purchase bills ke against</li>
        <li>Bill-wise ya on-account</li>
        <li>Partial payment support</li>
        <li>Bill status auto-update</li>
        <li>Edit aur delete bhi supported</li>
      </ul>
    </div>
    <div class="card c-green">
      <div class="card-title"><span class="dot"></span>Outstanding — Baki ka Hisaab</div>
      <ul class="feature-list">
        <li>Outstanding Receivables — saare customers ka baaki</li>
        <li>Outstanding Payables — saare suppliers ka baaki</li>
        <li>Party aur date range filter</li>
        <li>Ageing — kitne din se pending hai</li>
        <li>Directly list se receive/pay kar sakte hain</li>
        <li>Party Statement — bill-wise toggle</li>
      </ul>
    </div>
    <div class="card c-green">
      <div class="card-title"><span class="dot"></span>Party Ledger</div>
      <ul class="feature-list">
        <li>Har party ka pura hisaab — Dr/Cr entries</li>
        <li>Running balance column — har transaction ke baad</li>
        <li>Date range se filter</li>
        <li>Sales, purchase, receipt, payment sab ek jagah</li>
        <li>Opening balance included</li>
        <li>Print ya export kar saktein hain</li>
      </ul>
    </div>
  </div>

  <div class="section-header" style="margin-top:22px;">
    <div class="section-icon">🏦</div>
    <div>
      <div class="section-title">Cash & Bank — Naqdani ka Hisaab</div>
      <div class="section-desc">Multiple accounts, expenses aur cash flow — sab ek jagah</div>
    </div>
  </div>
  <div class="grid">
    <div class="card c-teal">
      <div class="card-title"><span class="dot" style="background:#06b6d4"></span>Multiple Accounts</div>
      <ul class="feature-list">
        <li>Cash in Hand, Petty Cash, SBI, HDFC — jitne chahein</li>
        <li>Har account ka alag balance</li>
        <li>Receipt/Payment mein account link karein</li>
        <li>Balance automatically update hota hai</li>
        <li>Account-wise transaction history</li>
      </ul>
    </div>
    <div class="card c-teal">
      <div class="card-title"><span class="dot" style="background:#06b6d4"></span>Expenses & Contra</div>
      <ul class="feature-list">
        <li>Kiraya, bijli, salary, office ka kharcha — sab record karein</li>
        <li>Expense heads master — Rent, Electricity, Salary etc.</li>
        <li>Contra entry — cash se bank mein ya bank se cash</li>
        <li>Cash Book — roz ka naqdani ka hisaab</li>
        <li>Bank Statement — account-wise sab transactions</li>
      </ul>
    </div>
  </div>
</div>

<!-- ══════════════════════════ PAGE 4 · ACCOUNTING & GST ══ -->
<div class="page s-purple">
  <div class="section-header">
    <div class="section-icon">📒</div>
    <div>
      <div class="section-title">Accounting Reports</div>
      <div class="section-desc">CA ko chahiye sab kuch — Trial Balance se leke GST Returns tak</div>
    </div>
  </div>
  <div class="grid">
    <div class="card c-purple">
      <div class="card-title"><span class="dot"></span>Trial Balance</div>
      <ul class="feature-list">
        <li>Standard format — sabhi accounts ek jagah</li>
        <li>Debtors aur Creditors group</li>
        <li>Sales aur Purchase accounts</li>
        <li>Bank aur Cash balances</li>
        <li>GST liability aur ITC accounts</li>
        <li>Debit = Credit — auto verify hota hai</li>
        <li>CA ke liye ready format</li>
      </ul>
    </div>
    <div class="card c-purple">
      <div class="card-title"><span class="dot"></span>GSTR-1 Return</div>
      <ul class="feature-list">
        <li>B2B invoices — GSTIN wale customers ka breakup</li>
        <li>B2C summary — bina GSTIN wale ka</li>
        <li>Month aur Year filter</li>
        <li>JSON export — GST portal pe seedha upload</li>
        <li>HSN-wise summary</li>
        <li>IGST / CGST / SGST split automatically</li>
        <li>Zero manual kaam — data already fill hai</li>
      </ul>
    </div>
    <div class="card c-purple">
      <div class="card-title"><span class="dot"></span>GSTR-3B Return</div>
      <ul class="feature-list">
        <li>Output GST — aapki sales se</li>
        <li>Input Tax Credit (ITC) — purchases se</li>
        <li>Net GST payable auto-calculate</li>
        <li>Month aur Year filter</li>
        <li>Ready-to-fill format</li>
        <li>GSTR-1 se match karta hai</li>
      </ul>
    </div>
    <div class="card c-purple">
      <div class="card-title"><span class="dot"></span>Deleted Vouchers — Bin</div>
      <ul class="feature-list">
        <li>Delete kiya hua document seedha nahi jaata</li>
        <li>Bin mein save rehta hai</li>
        <li>Restore karein — wapas active ho jaayega</li>
        <li>Permanent delete — jab pakka sure ho</li>
        <li>Galti se delete ki chinta khatam</li>
      </ul>
    </div>
  </div>

  <div class="section-header" style="margin-top:22px;">
    <div class="section-icon">📦</div>
    <div>
      <div class="section-title">Inventory — Maal ka Hisaab</div>
      <div class="section-desc">Stock kabhi miss nahi hoga — real-time tracking with alerts</div>
    </div>
  </div>
  <div class="grid">
    <div class="card c-indigo">
      <div class="card-title"><span class="dot" style="background:#6366f1"></span>Real-time Stock</div>
      <ul class="feature-list">
        <li>Opening stock + kharida hua − becha hua = current stock</li>
        <li>Average rate automatic calculate</li>
        <li>Stock value — qty × average rate</li>
        <li>Low stock alert — threshold set karein</li>
        <li>Item-wise stock report</li>
        <li>Category filter se dhundho</li>
      </ul>
    </div>
    <div class="card c-indigo">
      <div class="card-title"><span class="dot" style="background:#6366f1"></span>Barcode System</div>
      <ul class="feature-list">
        <li>Item save karte hi barcode auto-generate</li>
        <li>Scanner se scan karo — invoice mein item auto-add</li>
        <li>Single ya bulk label print</li>
        <li>Custom label designer — drag & drop</li>
        <li>Logo, business name, price label banayein</li>
        <li>Multiple templates</li>
      </ul>
    </div>
  </div>
</div>

<!-- ══════════════════════════ PAGE 5 · MASTERS & SETTINGS ══ -->
<div class="page s-teal">
  <div class="section-header">
    <div class="section-icon">🗂️</div>
    <div>
      <div class="section-title">Masters — Sabhi Master Data</div>
      <div class="section-desc">Parties, items, units — ek baar daalein, baar baar kaam aayein</div>
    </div>
  </div>
  <div class="grid-3">
    <div class="card c-teal">
      <div class="card-title"><span class="dot"></span>Parties</div>
      <ul class="feature-list">
        <li>Customer / Supplier / Dono type</li>
        <li>GSTIN aur state code</li>
        <li>Opening balance (Dr/Cr)</li>
        <li>Search, filter, paginate</li>
        <li>Edit aur delete — bilkul aasaan</li>
        <li>GSTIN validation built-in</li>
      </ul>
    </div>
    <div class="card c-teal">
      <div class="card-title"><span class="dot"></span>Items</div>
      <ul class="feature-list">
        <li>Goods ya Service type</li>
        <li>HSN/SAC code link</li>
        <li>Default tax rate</li>
        <li>Sale aur purchase price</li>
        <li>Opening stock set karein</li>
        <li>Item image upload karein</li>
        <li>Barcode auto-generate on save</li>
      </ul>
    </div>
    <div class="card c-teal">
      <div class="card-title"><span class="dot"></span>Other Masters</div>
      <ul class="feature-list">
        <li>Units — PCS, KG, LTR, BOX, MTR, NOS aur aur</li>
        <li>Inline row editing — fast changes</li>
        <li>HSN/SAC codes — full list maintain karein</li>
        <li>GST Tax Rates — khud add karein</li>
        <li>States — poore India ki list built-in</li>
      </ul>
    </div>
  </div>

  <div class="section-header" style="margin-top:22px;">
    <div class="section-icon">⚙️</div>
    <div>
      <div class="section-title">Business Settings</div>
      <div class="section-desc">Apna business apne hisaab se customize karein</div>
    </div>
  </div>
  <div class="grid">
    <div class="card c-orange">
      <div class="card-title"><span class="dot" style="background:#f59e0b"></span>Business Profile</div>
      <ul class="feature-list">
        <li>Business name, GSTIN, PAN</li>
        <li>Poora address state ke saath</li>
        <li>Financial year start month</li>
        <li>Business logo upload</li>
        <li>Contact email aur phone</li>
        <li>Industry type selection</li>
      </ul>
    </div>
    <div class="card c-orange">
      <div class="card-title"><span class="dot" style="background:#f59e0b"></span>Invoice Configuration</div>
      <ul class="feature-list">
        <li>Custom prefix — SI, INV, BILL — jo aapka style ho</li>
        <li>Serial mode — Auto ya Manual apni choice</li>
        <li>Doc start number — series kahan se shuru ho</li>
        <li>Print template customize karein</li>
        <li>Footer text apna add karein invoices pe</li>
      </ul>
    </div>
    <div class="card c-orange">
      <div class="card-title"><span class="dot" style="background:#f59e0b"></span>Users & Staff Permissions</div>
      <ul class="feature-list">
        <li>Multiple staff accounts ek business mein</li>
        <li>Roles — Business Admin / Staff</li>
        <li>Module-wise permission — kaun kya dekhe</li>
        <li>Staff ko sirf unka module dikhega</li>
        <li>Password reset by admin</li>
        <li>Plan ke hisaab se max users</li>
      </ul>
    </div>
    <div class="card c-orange">
      <div class="card-title"><span class="dot" style="background:#f59e0b"></span>Data Backup & Restore</div>
      <ul class="feature-list">
        <li>Ek click — poora data JSON file mein download</li>
        <li>Parties, items, vouchers, payments — sab included</li>
        <li>Kabhi bhi download karein — koi limit nahi</li>
        <li>Restore — data wapas import karein</li>
        <li>Desktop version mein auto-daily backup</li>
      </ul>
    </div>
  </div>
</div>

<!-- ══════════════════════════ PAGE 6 · CLOUD & DESKTOP & OFFLINE ══ -->
<div class="page s-indigo">
  <div class="section-header">
    <div class="section-icon">☁️</div>
    <div>
      <div class="section-title">Cloud Version — Kahin bhi, Kabhi bhi</div>
      <div class="section-desc">Browser kholo aur kaam shuru — koi installation nahi, koi maintenance nahi</div>
    </div>
  </div>
  <div class="grid">
    <div class="card c-indigo">
      <div class="card-title"><span class="dot"></span>Kahi se Access</div>
      <ul class="feature-list">
        <li>Ghar, dukaan, mobile, laptop — koi bhi device</li>
        <li>Chrome, Firefox, Safari — koi bhi browser</li>
        <li>Internet ho bas — kaam shuru</li>
        <li>Data automatically cloud pe safe</li>
        <li>Power cut ya PC crash — data safe hai</li>
      </ul>
    </div>
    <div class="card c-indigo">
      <div class="card-title"><span class="dot"></span>Security</div>
      <ul class="feature-list">
        <li>HTTPS — data encrypted travel karta hai</li>
        <li>Aapka data sirf aapka — koi aur access nahi kar sakta</li>
        <li>Role-based access — staff sirf unka module dekhe</li>
        <li>Session expire on logout</li>
        <li>Multiple businesses — alag-alag data, zero mixing</li>
      </ul>
    </div>
  </div>

  <div class="section-header" style="margin-top:22px;">
    <div class="section-icon">🖥️</div>
    <div>
      <div class="section-title">Desktop LAN Version — Internet ki Zaroorat Nahi</div>
      <div class="section-desc">Ek PC server — baaki sab browser se connect — data kabhi cloud pe nahi jaata</div>
    </div>
  </div>
  <div class="grid">
    <div class="card c-pink">
      <div class="card-title"><span class="dot" style="background:#ec4899"></span>Kaise Kaam Karta Hai</div>
      <ul class="feature-list">
        <li>Ek PC pe BizCor Desktop install karein (Windows .EXE)</li>
        <li>Wo PC server ban jaata hai — internet ki zaroorat nahi</li>
        <li>Baaki PCs browser khol ke connect karein — koi install nahi</li>
        <li>QR code scan karein phone se — instantly connect</li>
        <li>http://bizcor.local — IP yaad rakhne ki zaroorat nahi</li>
        <li>Same WiFi pe sab PCs ka live data ek saath</li>
      </ul>
    </div>
    <div class="card c-pink">
      <div class="card-title"><span class="dot" style="background:#ec4899"></span>Data Privacy</div>
      <ul class="feature-list">
        <li>Poora data sirf aapke PC pe — cloud pe kuch nahi</li>
        <li>Internet cut ho jaaye — kaam chalte rehta hai</li>
        <li>Bijli aayi, system chalu — wapas kaam</li>
        <li>Data sirf aapke haath mein</li>
      </ul>
    </div>
    <div class="card c-pink">
      <div class="card-title"><span class="dot" style="background:#ec4899"></span>Auto Backup (Desktop)</div>
      <ul class="feature-list">
        <li>Roz raat ko silently backup hota hai — aap sote rahein</li>
        <li>Last 7 backup copies saved — purane automatically delete</li>
        <li>Manual backup — ek click se kabhi bhi</li>
        <li>Backup pe apna PIN lock — koi aur file nahi khol sakta</li>
        <li>Restore — login se PEHLE restore kar saktein hain</li>
        <li>Kisi bhi PC pe restore karo — same data wapas</li>
      </ul>
    </div>
    <div class="card c-pink">
      <div class="card-title"><span class="dot" style="background:#ec4899"></span>Internal Staff Chat (LAN)</div>
      <ul class="feature-list">
        <li>Staff-to-staff message — internet ki zaroorat nahi</li>
        <li>Text, file aur image bhejein</li>
        <li>Real-time — turant deliver</li>
        <li>Draggable chat window</li>
        <li>File thumbnail preview</li>
      </ul>
    </div>
  </div>

  <div class="section-header" style="margin-top:22px;">
    <div class="section-icon">📡</div>
    <div>
      <div class="section-title">Offline Mode — Internet Gaya, Kaam Nahi Gaya</div>
      <div class="section-desc">Invoice aur data entry offline bhi — internet aayega to auto-sync</div>
    </div>
  </div>
  <div class="grid">
    <div class="card c-green">
      <div class="card-title"><span class="dot" style="background:#10b981"></span>Offline Drafts</div>
      <ul class="feature-list">
        <li>Internet nahi hai — phir bhi invoice banayein</li>
        <li>Draft locally save hoti hai</li>
        <li>/offline-drafts — saari pending drafts dekho</li>
        <li>Internet aaya — auto sync in seconds</li>
        <li>Sync status — pending / synced clearly dikhai deta hai</li>
      </ul>
    </div>
    <div class="card c-green">
      <div class="card-title"><span class="dot" style="background:#10b981"></span>Multi-Device</div>
      <ul class="feature-list">
        <li>Multiple PCs — LAN pe real-time sync</li>
        <li>Ek ne invoice banaya — doosre ko turant dikha</li>
        <li>Conflict — newer data jeet ta hai</li>
        <li>Cloud version mein bhi multi-device support</li>
      </ul>
    </div>
  </div>
</div>

<!-- ══════════════════════════ PAGE 7 · SUMMARY TABLE ══ -->
<div class="page">
  <div class="section-header s-blue">
    <div class="section-icon" style="background:#eff6ff;font-size:20px;">📋</div>
    <div>
      <div class="section-title" style="color:#1d4ed8;">BizCor ERP — Quick Feature Summary</div>
      <div class="section-desc">Ek nazar mein poori capability</div>
    </div>
  </div>
  <table class="feat-table">
    <thead>
      <tr><th>Module</th><th>Kya karta hai</th><th>Key Features</th></tr>
    </thead>
    <tbody>
      <tr><td>🔐 Login & Setup</td><td>Secure multi-user access</td><td>Business Code login, staff accounts, role-based access, plan alerts</td></tr>
      <tr><td>💬 Support Chat</td><td>Help bina login ke</td><td>Login page pe chat, file attach, session save, reply in-chat</td></tr>
      <tr><td>📊 Dashboard</td><td>Business ka snapshot</td><td>4-period summary, 12-month chart, top customers, receivables/payables</td></tr>
      <tr><td>🧾 Sales Invoice</td><td>GST invoice banao</td><td>Auto/manual serial, custom prefix, GST-inclusive toggle, PDF download</td></tr>
      <tr><td>📋 Credit Note</td><td>Sales return ka hisaab</td><td>Invoice se link, partial/full credit, GSTR-1 mein auto-include</td></tr>
      <tr><td>🛒 Purchase Bill</td><td>Supplier bill record</td><td>ITC auto-track, bill status, GST breakup</td></tr>
      <tr><td>📋 Debit Note</td><td>Purchase return</td><td>Bill se link, ITC reversal, GSTR-3B mein reflect</td></tr>
      <tr><td>💳 Receipts</td><td>Customer se paisa lena</td><td>Bill-wise, on-account, partial, auto status update</td></tr>
      <tr><td>💸 Payments</td><td>Supplier ko paisa dena</td><td>Bill-wise, on-account, partial, edit/delete</td></tr>
      <tr><td>📊 Outstanding</td><td>Baaki ka hisaab</td><td>Receivables, payables, ageing, party statement</td></tr>
      <tr><td>🏦 Cash & Bank</td><td>Naqdani management</td><td>Multiple accounts, contra, expenses, cash book, bank statement</td></tr>
      <tr><td>📒 Party Ledger</td><td>Party ka poora hisaab</td><td>Running balance, date filter, print/export</td></tr>
      <tr><td>⚖️ Trial Balance</td><td>CA format report</td><td>All accounts, debit=credit verified, GST accounts included</td></tr>
      <tr><td>🇮🇳 GSTR-1</td><td>GST return ready</td><td>B2B+B2C, JSON export, portal pe seedha upload</td></tr>
      <tr><td>🇮🇳 GSTR-3B</td><td>Net GST payable</td><td>Output vs ITC, monthly</td></tr>
      <tr><td>📦 Inventory</td><td>Stock tracking</td><td>Real-time, avg rate, low stock alert</td></tr>
      <tr><td>🏷️ Barcode</td><td>Item barcode</td><td>Auto-generate, scanner support, bulk label print, label designer</td></tr>
      <tr><td>🗂️ Parties</td><td>Customers & suppliers</td><td>GSTIN, opening balance, search/filter</td></tr>
      <tr><td>🗂️ Items</td><td>Products & services</td><td>HSN, tax rate, price, image, barcode</td></tr>
      <tr><td>🗂️ Masters</td><td>Units, HSN, Tax rates</td><td>Inline editing, add/delete freely</td></tr>
      <tr><td>⚙️ Settings</td><td>Business customize</td><td>Profile, logo, invoice config, users, permissions</td></tr>
      <tr><td>🗑️ Bin</td><td>Delete se recovery</td><td>Restore ya permanent delete</td></tr>
      <tr><td>💾 Backup</td><td>Data suraksha</td><td>JSON download, restore, desktop auto-daily backup</td></tr>
      <tr><td>☁️ Cloud</td><td>Kahin se bhi kaam</td><td>Any browser, any device, data always safe</td></tr>
      <tr><td>🖥️ Desktop LAN</td><td>Bina internet ke</td><td>EXE install, LAN server, QR connect, offline data</td></tr>
      <tr><td>📡 Offline Mode</td><td>Internet gaya, kaam nahi</td><td>Offline drafts, auto-sync, multi-device</td></tr>
      <tr><td>🎯 Referral</td><td>Free upgrade earn karo</td><td>5 referrals = free plan, progress bar, unique code</td></tr>
    </tbody>
  </table>

  <div style="margin-top:28px;background:linear-gradient(135deg,#0f0c29,#302b63);border-radius:16px;padding:28px 32px;text-align:center;color:#fff;">
    <div style="font-size:22px;font-weight:800;letter-spacing:-.3px;">BizCor ERP</div>
    <div style="font-size:11px;color:rgba(255,255,255,.6);margin-top:6px;letter-spacing:1px;text-transform:uppercase;">Indian Business ERP · Cloud + Desktop · GST Ready</div>
    <div style="margin-top:14px;font-size:10px;color:rgba(255,255,255,.45);">Support ke liye Help button dabayein — Login page pe hamesha available</div>
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
});
await browser.close();
writeFileSync("/home/runner/workspace/BizCor-ERP-Features.pdf", pdf);
console.log("✅ PDF generated!");
