"use strict";

const { app, BrowserWindow, Tray, Menu, shell, ipcMain, nativeImage, dialog } = require("electron");
const path = require("path");
const os = require("os");
const { autoUpdater } = require("electron-updater");

const trial = require("./trial");
const server = require("./server-manager");

let tray = null;
let mainWindow = null;
let setupWindow = null;
let splashWindow = null;
let isQuitting = false;

const resourcesPath = process.resourcesPath || path.join(__dirname, "..");

// ─── Helpers ────────────────────────────────────────────────────────────────

function getLocalIP() {
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === "IPv4" && !net.internal) return net.address;
    }
  }
  return "localhost";
}

function getServerURL() {
  return `http://${getLocalIP()}:${server.getServerPort()}`;
}

// ─── Splash ──────────────────────────────────────────────────────────────────

function showSplash(message = "BizCor ERP shuru ho raha hai...") {
  if (splashWindow) return;
  splashWindow = new BrowserWindow({
    width: 420, height: 260, frame: false, transparent: false,
    alwaysOnTop: true, center: true, resizable: false,
    webPreferences: { nodeIntegration: false },
    backgroundColor: "#1e40af",
  });
  splashWindow.loadURL(`data:text/html,<!DOCTYPE html><html><head><style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{background:#1e40af;color:#fff;font-family:'Segoe UI',Arial,sans-serif;
      display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh}
    h1{font-size:30px;font-weight:800;letter-spacing:-1px}
    p{font-size:12px;opacity:.65;margin-top:6px}
    .msg{margin-top:28px;font-size:13px;opacity:.85}
    .spin{width:22px;height:22px;border:3px solid rgba(255,255,255,.3);border-top-color:#fff;
      border-radius:50%;animation:s .8s linear infinite;margin-top:14px}
    @keyframes s{to{transform:rotate(360deg)}}
  </style></head><body>
    <h1>BizCor ERP</h1><p>LAN Server — Indian Businesses</p>
    <div class="msg">${message}</div><div class="spin"></div>
  </body></html>`);
}

function closeSplash() {
  if (splashWindow) { splashWindow.close(); splashWindow = null; }
}

// ─── Setup Window ────────────────────────────────────────────────────────────

function showSetupWindow() {
  if (setupWindow) { setupWindow.focus(); return; }

  setupWindow = new BrowserWindow({
    width: 560, height: 480, title: "BizCor ERP — Setup",
    resizable: false, center: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, "preload.js"),
    },
  });

  setupWindow.loadURL(`data:text/html,<!DOCTYPE html><html><head>
  <meta charset="utf-8">
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:'Segoe UI',Arial,sans-serif;background:#f8fafc;padding:32px;color:#1e293b}
    .logo{font-size:22px;font-weight:800;color:#1e40af;margin-bottom:4px}
    .sub{font-size:12px;color:#64748b;margin-bottom:24px}
    label{display:block;font-size:13px;font-weight:600;color:#374151;margin-bottom:6px}
    input,textarea{width:100%;border:1.5px solid #d1d5db;border-radius:8px;padding:10px 12px;
      font-size:13px;outline:none;font-family:monospace;transition:border .2s}
    input:focus,textarea:focus{border-color:#3b82f6}
    textarea{height:90px;resize:vertical;font-size:12px}
    .hint{font-size:11px;color:#94a3b8;margin-top:5px}
    .btn{display:block;width:100%;background:#1e40af;color:#fff;border:none;border-radius:8px;
      padding:12px;font-size:14px;font-weight:600;cursor:pointer;margin-top:20px;transition:background .2s}
    .btn:hover{background:#1d4ed8}
    .btn:disabled{background:#94a3b8;cursor:not-allowed}
    .err{color:#dc2626;font-size:12px;margin-top:8px;display:none}
    .section{background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:20px;margin-bottom:16px}
    h3{font-size:14px;font-weight:700;margin-bottom:12px;color:#1e293b}
    .or{text-align:center;color:#94a3b8;font-size:12px;margin:8px 0;position:relative}
    .or::before,.or::after{content:'';position:absolute;top:50%;width:45%;height:1px;background:#e2e8f0}
    .or::before{left:0} .or::after{right:0}
  </style>
  </head><body>
  <div class="logo">BizCor ERP</div>
  <div class="sub">Pehli baar setup — database configure karein</div>

  <div class="section">
    <h3>PostgreSQL Database URL</h3>
    <label>Connection String</label>
    <textarea id="dbUrl" placeholder="postgresql://username:password@hostname:5432/database_name"></textarea>
    <div class="hint">Cloud ya local PostgreSQL URL yahan paste karein. Ye encrypted save hogi.</div>
    <div class="err" id="err">URL sahi nahi hai — postgresql:// se shuru hona chahiye</div>
  </div>

  <button class="btn" id="saveBtn" onclick="save()">Shuru Karo</button>

  <script>
    function save() {
      const url = document.getElementById('dbUrl').value.trim();
      const err = document.getElementById('err');
      const btn = document.getElementById('saveBtn');
      if (!url.startsWith('postgresql://') && !url.startsWith('postgres://')) {
        err.style.display = 'block'; return;
      }
      err.style.display = 'none';
      btn.disabled = true; btn.textContent = 'Shuru ho raha hai...';
      window.bizcorDesktop.saveDbUrl(url);
    }
    document.getElementById('dbUrl').addEventListener('keydown', e => {
      if (e.key === 'Enter' && e.ctrlKey) save();
    });
  </script>
  </body></html>`);

  setupWindow.on("closed", () => { setupWindow = null; });
}

// ─── Main Window ─────────────────────────────────────────────────────────────

function openMainWindow() {
  const trialStatus = trial.getTrialStatus();

  if (mainWindow) { mainWindow.show(); mainWindow.focus(); return; }

  mainWindow = new BrowserWindow({
    width: 1280, height: 800, minWidth: 900, minHeight: 600,
    title: "BizCor ERP",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      nodeIntegration: false, contextIsolation: true,
    },
  });

  if (trialStatus.locked) {
    mainWindow.loadURL(`data:text/html,<!DOCTYPE html><html><head><style>
      body{font-family:'Segoe UI',Arial,sans-serif;background:#fef2f2;display:flex;
        align-items:center;justify-content:center;height:100vh;margin:0}
      .box{background:#fff;border-radius:12px;padding:40px;max-width:480px;text-align:center;box-shadow:0 4px 24px rgba(0,0,0,.1)}
      h1{color:#dc2626;font-size:22px} p{color:#374151;line-height:1.6;margin-top:10px}
      .badge{background:#fef2f2;color:#dc2626;border:1px solid #fecaca;padding:5px 14px;
        border-radius:999px;font-size:12px;font-weight:600;display:inline-block;margin-bottom:14px}
    </style></head><body><div class="box">
      <div class="badge">Trial Expired — 90 din poore</div>
      <h1>BizCor ERP Lock Ho Gaya</h1>
      <p>Aapka 90-din ka trial period khatam ho gaya hai.</p>
      <p style="margin-top:10px">License activate karne ke liye Tech Support se contact karein.</p>
    </div></body></html>`);
  } else {
    mainWindow.loadURL(`http://localhost:${server.getServerPort()}`);
  }

  mainWindow.on("close", e => {
    if (!isQuitting) { e.preventDefault(); mainWindow.hide(); }
  });
  mainWindow.on("closed", () => { mainWindow = null; });
}

// ─── QR Window ───────────────────────────────────────────────────────────────

let qrWindow = null;
async function showQRWindow() {
  if (qrWindow) { qrWindow.focus(); return; }
  const serverURL = getServerURL();
  let qrDataURL = "";
  try {
    const QRCode = require("qrcode");
    qrDataURL = await QRCode.toDataURL(serverURL, { width: 200, margin: 2 });
  } catch (_) {}

  qrWindow = new BrowserWindow({
    width: 320, height: 380, title: "LAN Connect", resizable: false, alwaysOnTop: true,
    webPreferences: { nodeIntegration: false },
  });
  qrWindow.loadURL(`data:text/html,<!DOCTYPE html><html><head><style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:'Segoe UI',Arial,sans-serif;background:#f8fafc;padding:24px;text-align:center}
    h2{font-size:15px;color:#1e40af;margin-bottom:4px}
    p{font-size:11px;color:#64748b;margin-bottom:14px}
    img{width:200px;height:200px;border:1px solid #e2e8f0;border-radius:8px}
    .url{margin-top:14px;background:#f1f5f9;border-radius:8px;padding:10px;
      font-size:12px;font-weight:600;color:#1e40af;word-break:break-all}
    .hint{margin-top:10px;font-size:10px;color:#94a3b8}
  </style></head><body>
    <h2>BizCor ERP — LAN Connect</h2>
    <p>Same WiFi/LAN pe scan karein</p>
    ${qrDataURL ? `<img src="${qrDataURL}" />` : `<div style="height:200px;display:flex;align-items:center;justify-content:center;color:#94a3b8">QR not available</div>`}
    <div class="url">${serverURL}</div>
    <div class="hint">Browser mein ye URL kholen</div>
  </body></html>`);
  qrWindow.on("closed", () => { qrWindow = null; });
}

// ─── Tray ─────────────────────────────────────────────────────────────────────

function buildTray() {
  const iconPath = path.join(__dirname, "../assets/tray.png");
  let icon = nativeImage.createFromPath(iconPath);
  if (icon.isEmpty()) icon = nativeImage.createEmpty();
  else icon = icon.resize({ width: 16, height: 16 });

  tray = new Tray(icon);
  tray.setToolTip("BizCor ERP");
  refreshTray();
  tray.on("double-click", () => openMainWindow());
}

function refreshTray() {
  if (!tray) return;
  const st = server.getStatus();
  const url = getServerURL();
  const trialStatus = trial.getTrialStatus();
  const trialLabel = trialStatus.phase === 1 ? `Trial: ${trialStatus.daysLeft} din bache`
    : trialStatus.phase === 2 ? `⚠ Alert: ${trialStatus.daysLeft} din bache`
    : trialStatus.phase === 3 ? `🔴 Grace: ${trialStatus.daysLeft} din bache`
    : "🔒 Trial Khatam";

  tray.setContextMenu(Menu.buildFromTemplate([
    { label: "BizCor ERP", enabled: false },
    { label: trialLabel, enabled: false },
    { type: "separator" },
    { label: st === "running" ? `● Running — ${url}` : `○ ${st}`, enabled: false },
    { label: "Open Dashboard", click: () => openMainWindow() },
    { label: "Open in Browser", enabled: st === "running", click: () => shell.openExternal(url) },
    { label: "Show QR Code", enabled: st === "running", click: () => showQRWindow() },
    { label: "Database Setup", click: () => showSetupWindow() },
    { type: "separator" },
    { label: "Quit", click: () => { isQuitting = true; app.quit(); } },
  ]));
}

// ─── IPC ─────────────────────────────────────────────────────────────────────

ipcMain.handle("get-trial-status", () => trial.getTrialStatus());
ipcMain.handle("get-server-info", () => ({
  url: getServerURL(), status: server.getStatus(),
  ip: getLocalIP(), port: server.getServerPort(),
}));
ipcMain.handle("open-in-browser", (_, url) => shell.openExternal(url));
ipcMain.handle("save-db-url", async (_, dbUrl) => {
  if (setupWindow) { setupWindow.close(); setupWindow = null; }
  showSplash("Database se connect ho raha hai...");
  try {
    await server.startWithUrl(dbUrl, resourcesPath);
    closeSplash();
    openMainWindow();
    refreshTray();
  } catch (err) {
    closeSplash();
    dialog.showErrorBox("Error", "Database se connect nahi ho saka:\n" + err.message);
    showSetupWindow();
  }
});

// ─── App Lifecycle ───────────────────────────────────────────────────────────

app.whenReady().then(async () => {
  buildTray();

  server.onStatusChange(status => {
    refreshTray();
    if (status === "running") {
      closeSplash();
      openMainWindow();
      setTimeout(() => autoUpdater.checkForUpdatesAndNotify().catch(() => {}), 5000);
    } else if (status === "needs-setup") {
      closeSplash();
      showSetupWindow();
    } else if (status === "error") {
      closeSplash();
      dialog.showErrorBox("Server Error", "Server shuru nahi ho saka. Database setup check karein.");
      showSetupWindow();
    }
  });

  showSplash("Server shuru ho raha hai...");
  await server.start(resourcesPath);
});

app.on("window-all-closed", () => {});
app.on("before-quit", async () => { isQuitting = true; await server.stop(); });

// ─── Auto Updater ─────────────────────────────────────────────────────────────

autoUpdater.on("update-downloaded", () => {
  dialog.showMessageBox({
    type: "info", title: "Update Ready",
    message: "Naya version tayyar hai. App restart karo update lagane ke liye.",
    buttons: ["Abhi Restart", "Baad Mein"],
  }).then(r => { if (r.response === 0) autoUpdater.quitAndInstall(); });
});
