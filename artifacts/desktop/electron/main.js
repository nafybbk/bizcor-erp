"use strict";

const { app, BrowserWindow, Tray, Menu, shell, ipcMain, nativeImage, dialog, Notification } = require("electron");
const path = require("path");
const os = require("os");
const { autoUpdater } = require("electron-updater");

const trial = require("./trial");
const server = require("./server-manager");
const heartbeat = require("./heartbeat");
const mdns = require("./mdns");
const backup = require("./backup-manager");

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

function htmlFile(name) {
  return path.join(__dirname, name);
}

// ─── Splash ──────────────────────────────────────────────────────────────────

function showSplash() {
  if (splashWindow) return;
  splashWindow = new BrowserWindow({
    width: 420, height: 310, frame: false, transparent: false,
    alwaysOnTop: false, center: true, resizable: false,
    webPreferences: { nodeIntegration: false, contextIsolation: true },
    backgroundColor: "#1e40af",
  });
  splashWindow.loadFile(htmlFile("splash.html"));
}

function updateSplashProgress(pct, step, sub) {
  if (!splashWindow || splashWindow.isDestroyed()) return;
  const js = `setProgress(${pct}, ${JSON.stringify(step)}, ${JSON.stringify(sub)})`;
  splashWindow.webContents.executeJavaScript(js).catch(() => {});
}

function closeSplash() {
  if (splashWindow) { splashWindow.close(); splashWindow = null; }
}

// ─── Setup Window ────────────────────────────────────────────────────────────

function showSetupWindow() {
  if (setupWindow) { setupWindow.focus(); return; }

  setupWindow = new BrowserWindow({
    width: 520, height: 440, title: "BizCor ERP — Setup",
    resizable: false, center: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, "preload.js"),
    },
  });

  setupWindow.loadFile(htmlFile("setup.html"));
  setupWindow.setMenuBarVisibility(false);
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

  mainWindow.setMenuBarVisibility(false);

  if (trialStatus.locked) {
    mainWindow.loadFile(htmlFile("locked.html"));
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
    width: 320, height: 360, title: "LAN Connect", resizable: false, alwaysOnTop: true,
    webPreferences: { nodeIntegration: false, contextIsolation: true },
  });
  qrWindow.setMenuBarVisibility(false);

  const html = `<!DOCTYPE html><html><head>
<meta charset="utf-8">
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:'Segoe UI',Arial,sans-serif;background:#f8fafc;padding:24px;text-align:center}
  h2{font-size:15px;color:#1e40af;margin-bottom:4px}
  p{font-size:11px;color:#64748b;margin-bottom:14px}
  img{width:200px;height:200px;border:1px solid #e2e8f0;border-radius:8px}
  .url{margin-top:14px;background:#f1f5f9;border-radius:8px;padding:10px;
    font-size:13px;font-weight:600;color:#1e40af;word-break:break-all}
  .hint{margin-top:8px;font-size:11px;color:#94a3b8}
</style></head><body>
<h2>BizCor ERP — LAN</h2>
<p>Open on any device on the same WiFi</p>
${qrDataURL ? `<img src="${qrDataURL}" />` : `<div style="height:200px;line-height:200px;color:#94a3b8">QR unavailable</div>`}
<div class="url">${serverURL}</div>
<div class="hint">Type this URL in any browser on your network</div>
</body></html>`;

  qrWindow.loadURL("data:text/html;charset=utf-8," + encodeURIComponent(html));
  qrWindow.on("closed", () => { qrWindow = null; });
}

// ─── Error Dialog ─────────────────────────────────────────────────────────────

function showServerError() {
  const errDetail = server.getLastError() || "(no error details captured)";
  const logPath = server.getLogPath();

  dialog.showMessageBox({
    type: "error",
    title: "Server Error — BizCor ERP",
    message: "The server could not start.",
    detail:
      "Error details:\n" +
      "─────────────────────────────\n" +
      errDetail +
      "\n─────────────────────────────\n\n" +
      "Full log saved at:\n" + logPath + "\n\n" +
      "What to do:\n" +
      "1. Click 'Try Again' — may work on second attempt\n" +
      "2. Allow BizCor ERP in Windows Defender / Antivirus\n" +
      "3. Send the log file above to support",
    buttons: ["Try Again", "Open Log Folder", "Close"],
    defaultId: 0,
  }).then(result => {
    if (result.response === 0) {
      showSplash();
      server.start(resourcesPath);
    } else if (result.response === 1) {
      const { shell } = require("electron");
      shell.showItemInFolder(logPath);
    } else {
      isQuitting = true;
      app.quit();
    }
  });
}

// ─── Tray ─────────────────────────────────────────────────────────────────────

// Fallback 16x16 blue square PNG (embedded — always works even if tray.png missing)
const FALLBACK_TRAY_ICON = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAIAAACQkWg2AAAAH0lEQVR4nGP4TyJgIFODVPELgmhUw6gGYjQQD0jWAACD/yCfzn819gAAAABJRU5ErkJggg==";

function buildTray() {
  const iconPath = path.join(__dirname, "../assets/tray.png");
  let icon = nativeImage.createFromPath(iconPath);
  if (icon.isEmpty()) {
    icon = nativeImage.createFromDataURL(FALLBACK_TRAY_ICON);
  } else {
    icon = icon.resize({ width: 16, height: 16 });
  }

  tray = new Tray(icon);
  tray.setToolTip("BizCor ERP");
  refreshTray();
  tray.on("double-click", () => openMainWindow());
}

let _connectedCount = 0;

async function refreshConnectedCount() {
  if (server.getStatus() !== "running") return;
  try {
    const http = require("http");
    await new Promise((resolve) => {
      http.get(`http://localhost:${server.getServerPort()}/api/desktop/connected-clients`, (res) => {
        let data = "";
        res.on("data", c => { data += c; });
        res.on("end", () => {
          try { _connectedCount = JSON.parse(data).count || 0; } catch { _connectedCount = 0; }
          resolve(null);
        });
      }).on("error", () => resolve(null));
    });
  } catch { _connectedCount = 0; }
}

function refreshTray() {
  if (!tray) return;
  const st = server.getStatus();
  const url = getServerURL();
  const trialStatus = trial.getTrialStatus();
  const trialLabel =
    trialStatus.phase === 1 ? `Trial: ${trialStatus.daysLeft} days remaining` :
    trialStatus.phase === 2 ? `Trial: ${trialStatus.daysLeft} days left` :
    trialStatus.phase === 3 ? `Grace period: ${trialStatus.daysLeft} days left` :
    "Trial Expired — Locked";

  const clientsLabel = st === "running"
    ? `LAN Clients: ${_connectedCount} active (last 5 min)`
    : "LAN Clients: server stopped";

  tray.setContextMenu(Menu.buildFromTemplate([
    { label: "BizCor ERP", enabled: false },
    { label: trialLabel, enabled: false },
    { type: "separator" },
    { label: st === "running" ? `Running — ${url}` : `Server: ${st}`, enabled: false },
    { label: clientsLabel, enabled: false },
    { type: "separator" },
    { label: "Open Dashboard", click: () => openMainWindow() },
    { label: "Open in Browser", enabled: st === "running", click: () => shell.openExternal(url) },
    { label: "Show QR Code (LAN)", enabled: st === "running", click: () => showQRWindow() },
    { label: "Cloud Sync Setup", click: () => showSetupWindow() },
    { label: "Open Log File", click: () => shell.showItemInFolder(server.getLogPath()) },
    { type: "separator" },
    { label: "Quit", click: () => { isQuitting = true; app.quit(); } },
  ]));
}

// ─── Heartbeat ───────────────────────────────────────────────────────────────

/** Fetch business code from local server (first registered business) */
async function fetchLocalBusinessCode() {
  return new Promise((resolve) => {
    const http = require("http");
    http.get(`http://localhost:${server.getServerPort()}/api/desktop/business-code`, (res) => {
      let data = "";
      res.on("data", (chunk) => { data += chunk; });
      res.on("end", () => {
        try { resolve(JSON.parse(data).businessCode || null); }
        catch { resolve(null); }
      });
    }).on("error", () => resolve(null));
  });
}

function showHeartbeatWarning(phase, message) {
  if (!mainWindow) return;
  const isExpired = phase === "expired";
  const isCritical = phase === "critical";

  dialog.showMessageBox(mainWindow, {
    type: isExpired || isCritical ? "error" : "warning",
    title: isExpired ? "License Expired — BizCor ERP" : "License Warning — BizCor ERP",
    message: isExpired ? "License Expire Ho Gaya" : "License Warning",
    detail: message + (isExpired
      ? "\n\nNaya plan lene ke liye Tech Support se contact karo."
      : "\n\nYeh sirf ek reminder hai. App normally kaam karti rahegi."),
    buttons: ["OK"],
  }).catch(() => {});
}

// ─── LAN Server-side Print ────────────────────────────────────────────────────

function getPrintQueueFile() {
  return path.join(app.getPath("userData"), "bizcor-db", "print-queue.json");
}

function getPrintersFile() {
  return path.join(app.getPath("userData"), "bizcor-db", "printers.json");
}

// Write server PC's available printers to JSON so clients can read via API
async function refreshPrintersList() {
  let list = [];

  // Method 1: Electron getPrintersAsync via temp window
  let tempWin = null;
  try {
    tempWin = new BrowserWindow({
      show: false, width: 100, height: 100,
      webPreferences: { nodeIntegration: false, contextIsolation: true },
    });
    await tempWin.loadURL("about:blank");
    const printers = await tempWin.webContents.getPrintersAsync();
    list = printers.map(p => ({ name: p.name, isDefault: p.isDefault || false }));
    console.log(`[printers] getPrintersAsync: ${list.length} found`);
  } catch (e) {
    console.error("[printers] getPrintersAsync failed:", e && e.message);
  } finally {
    try { if (tempWin && !tempWin.isDestroyed()) tempWin.close(); } catch (_) {}
  }

  // Method 2: Windows wmic fallback (works even if Electron API fails)
  if (list.length === 0 && process.platform === "win32") {
    try {
      const { exec } = require("child_process");
      list = await new Promise((resolve) => {
        exec("wmic printer get Name,Default /format:csv", { timeout: 10000 }, (err, stdout) => {
          if (err) { resolve([]); return; }
          const rows = stdout.split(/\r?\n/).filter(l => l.trim() && !l.startsWith("Node") && !l.startsWith("node"));
          const printers = rows.map(line => {
            const parts = line.split(",");
            // CSV columns: Node, Default, Name
            const isDefault = (parts[1] || "").trim().toUpperCase() === "TRUE";
            const name = (parts[2] || "").trim();
            return { name, isDefault };
          }).filter(p => p.name && p.name.toLowerCase() !== "name");
          resolve(printers);
        });
      });
      console.log(`[printers] wmic fallback: ${list.length} found`, list.map(p => p.name));
    } catch (e) {
      console.error("[printers] wmic failed:", e && e.message);
    }
  }

  try {
    const pFile = getPrintersFile();
    const dir = path.dirname(pFile);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(pFile, JSON.stringify(list), "utf8");
    console.log(`[printers] Saved ${list.length} printer(s) to`, pFile);
  } catch (e) {
    console.error("[printers] write failed:", e && e.message);
  }
}

const TYPE_TO_ROUTE = {
  SI: "sales/invoices", CN: "sales/credit-notes",
  PB: "purchases/bills", DN: "purchases/debit-notes",
  REC: "payments/receipts", PAY: "payments/payments",
};

let _lastPrintJobId = null;
let _printBusy = false;

async function processPrintJob(job) {
  if (_printBusy) return;
  _printBusy = true;

  // Notification on server PC
  try {
    if (Notification.isSupported()) {
      new Notification({
        title: "🖨 Print Ho Raha Hai",
        body: `${job.voucherType} #${job.voucherId} → ${job.printerName || "Default Printer"}`,
        silent: false,
      }).show();
    }
  } catch (_) {}

  try {
    const serverPort = server.getServerPort();
    const route = TYPE_TO_ROUTE[job.voucherType] || "sales/invoices";
    const invoiceUrl = `http://localhost:${serverPort}/${route}/${job.voucherId}`;

    // /print-auth sets token in localStorage (same origin) then redirects to invoice
    const authUrl = `http://localhost:${serverPort}/print-auth?token=${encodeURIComponent(job.token)}&to=${encodeURIComponent(invoiceUrl)}`;

    const printWin = new BrowserWindow({
      show: false,
      width: 1200, height: 900,
      webPreferences: { nodeIntegration: false, contextIsolation: true },
    });

    let invoiceLoaded = false;

    printWin.webContents.on("did-finish-load", async () => {
      const currentUrl = printWin.webContents.getURL();
      // Skip /print-auth redirect page
      if (currentUrl.includes("/print-auth")) return;
      if (invoiceLoaded) return;
      invoiceLoaded = true;

      // Wait for React to fully render invoice
      await new Promise(r => setTimeout(r, 3000));

      // Print silently to the printer client selected
      printWin.webContents.print(
        { silent: true, printBackground: true, deviceName: job.printerName || "" },
        (success, failureReason) => {
          if (!success) {
            dialog.showMessageBox({
              type: "error", title: "Print Failed",
              message: `Print nahi ho saka: ${failureReason || "Unknown error"}`,
              buttons: ["Theek Hai"],
            });
          }
          printWin.close();
          try { fs.unlinkSync(getPrintQueueFile()); } catch (_) {}
          _printBusy = false;
        }
      );
    });

    printWin.on("closed", () => { _printBusy = false; });
    printWin.loadURL(authUrl);

  } catch (err) {
    console.error("[print] Error:", err.message);
    _printBusy = false;
  }
}

function startPrintPoller() {
  // Delay first printer refresh by 3s — Electron needs to be fully ready
  setTimeout(() => refreshPrintersList(), 3000);
  setInterval(() => { refreshPrintersList(); }, 60000);

  // Poll for incoming print jobs every 2s
  setInterval(() => {
    try {
      const qFile = getPrintQueueFile();
      if (!fs.existsSync(qFile)) return;
      const job = JSON.parse(fs.readFileSync(qFile, "utf8"));
      if (!job || job.id === _lastPrintJobId) return;
      _lastPrintJobId = job.id;
      processPrintJob(job).catch(() => { _printBusy = false; });
    } catch (_) {}
  }, 2000);
}

async function startHeartbeat() {
  try {
    const businessCode = await fetchLocalBusinessCode();
    if (!businessCode) return; // No business registered yet — skip
    heartbeat.start(businessCode, (phase, message) => {
      showHeartbeatWarning(phase, message);
    });
  } catch (_) {}
}

// ─── IPC ─────────────────────────────────────────────────────────────────────

ipcMain.handle("get-trial-status", () => trial.getTrialStatus());
ipcMain.handle("get-heartbeat-status", () => heartbeat.getStatus());
ipcMain.handle("get-server-info", () => ({
  url: getServerURL(), status: server.getStatus(),
  ip: getLocalIP(), port: server.getServerPort(),
}));
ipcMain.handle("get-hardware-info", () => {
  try {
    const interfaces = os.networkInterfaces();
    let mac = "";
    for (const name of Object.keys(interfaces)) {
      for (const iface of interfaces[name] || []) {
        if (!iface.internal && iface.mac && iface.mac !== "00:00:00:00:00:00") {
          mac = iface.mac; break;
        }
      }
      if (mac) break;
    }
    const cpus = os.cpus();
    return {
      mac,
      cpu: cpus[0]?.model || "Unknown CPU",
      osVersion: `${os.type()} ${os.release()}`,
      hostname: os.hostname(),
      totalRam: Math.round(os.totalmem() / 1024 / 1024 / 1024) + " GB",
    };
  } catch { return { mac: "", cpu: "", osVersion: "", hostname: "", totalRam: "" }; }
});
ipcMain.handle("open-in-browser", (_, url) => shell.openExternal(url));
ipcMain.handle("save-db-url", async (_, dbUrl) => {
  if (setupWindow) { setupWindow.close(); setupWindow = null; }
  showSplash();
  try {
    await server.stop();
    await server.startWithUrl(dbUrl, resourcesPath);
    closeSplash();
    openMainWindow();
    refreshTray();
  } catch (err) {
    closeSplash();
    dialog.showErrorBox(
      "Cloud Connection Failed — BizCor ERP",
      "Could not connect to the cloud database:\n\n" + err.message +
      "\n\nPlease check your connection URL. The app is running in offline mode."
    );
    await server.start(resourcesPath);
    openMainWindow();
    refreshTray();
  }
});

ipcMain.handle("skip-cloud-setup", async () => {
  if (setupWindow) { setupWindow.close(); setupWindow = null; }
  openMainWindow();
});

// ─── Backup IPC ───────────────────────────────────────────────────────────────

ipcMain.handle("backup:is-pin-set", () => backup.isPinSet());
ipcMain.handle("backup:set-pin", (_, pin) => { backup.setPin(pin); return true; });
ipcMain.handle("backup:verify-pin", (_, pin) => backup.verifyPin(pin));
ipcMain.handle("backup:is-enabled", () => backup.isEnabled());
ipcMain.handle("backup:set-enabled", (_, val) => { backup.setEnabled(val); return true; });
ipcMain.handle("backup:list", () => backup.listBackups());
ipcMain.handle("backup:open-folder", async () => {
  const dir = backup.getBackupDir();
  fs.mkdirSync(dir, { recursive: true });
  await shell.openPath(dir);
  return true;
});

ipcMain.handle("backup:choose-folder", async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    title: "Backup Location Chunein",
    defaultPath: backup.getBackupDir(),
    properties: ["openDirectory", "createDirectory"],
  });
  if (canceled || !filePaths[0]) return { canceled: true };
  backup.setCustomBackupDir(filePaths[0]);
  return { canceled: false, path: filePaths[0] };
});

ipcMain.handle("backup:get-folder", () => backup.getBackupDir());

ipcMain.handle("backup:create", async () => {
  try {
    const result = backup.createBackup();
    return { success: true, ...result };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle("backup:choose-and-restore", async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    title: "Backup File Chunein",
    defaultPath: backup.getBackupDir(),
    filters: [{ name: "BizCor Backup", extensions: ["bizcor"] }],
    properties: ["openFile"],
  });
  if (canceled || !filePaths[0]) return { canceled: true };
  return { canceled: false, filePath: filePaths[0] };
});

ipcMain.handle("backup:restore", async (_, filePath, pin) => {
  try {
    // Stop server, restore DB, restart server
    await server.stop();
    backup.restoreFromFile(filePath, pin);
    await server.start(resourcesPath);
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.reload();
    return { success: true };
  } catch (err) {
    // Try restarting server even if restore failed
    try { await server.start(resourcesPath); } catch (_) {}
    return { success: false, error: err.message };
  }
});

// ─── Single Instance Lock ─────────────────────────────────────────────────────

const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  dialog.showErrorBox(
    "BizCor ERP — Already Running",
    "BizCor ERP is already running.\n\n" +
    "Look for the BizCor icon in the system tray (bottom-right corner of the taskbar),\n" +
    "right-click it and select 'Quit'.\n\n" +
    "Then reopen BizCor ERP."
  );
  app.quit();
} else {
  app.on("second-instance", () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    } else if (splashWindow) {
      splashWindow.focus();
    }
  });

  // ─── App Lifecycle ─────────────────────────────────────────────────────────

  app.whenReady().then(async () => {
    buildTray();

    server.onProgress((pct, step, sub) => {
      updateSplashProgress(pct, step, sub);
    });

    server.onStatusChange(status => {
      refreshTray();
      if (status === "running") {
        closeSplash();
        openMainWindow();
        // Advertise bizcor.local on the LAN
        mdns.start(server.getServerPort());
        // Refresh connected clients count every 60 seconds
        setInterval(() => {
          refreshConnectedCount().then(() => refreshTray()).catch(() => {});
        }, 60000);
        // Start weekly heartbeat 10s after server is ready
        setTimeout(() => startHeartbeat().catch(() => {}), 10000);
        setTimeout(() => autoUpdater.checkForUpdatesAndNotify().catch(() => {}), 8000);
        // Auto backup: check every hour if today's backup is pending
        setTimeout(() => { try { backup.autoBackupIfNeeded(); } catch (_) {} }, 30000);
        setInterval(() => { try { backup.autoBackupIfNeeded(); } catch (_) {} }, 60 * 60 * 1000);
        // LAN client print jobs — poll every 2s
        startPrintPoller();
      } else if (status === "error") {
        closeSplash();
        showServerError();
      }
    });

    showSplash();
    await server.start(resourcesPath);
  });

  app.on("window-all-closed", () => {});
  app.on("before-quit", async () => { isQuitting = true; heartbeat.stop(); mdns.stop(); await server.stop(); });
}

// ─── Auto Updater ─────────────────────────────────────────────────────────────

autoUpdater.on("update-downloaded", () => {
  dialog.showMessageBox({
    type: "info",
    title: "Update Ready — BizCor ERP",
    message: "A new version has been downloaded.",
    detail: "Restart the app to apply the update.",
    buttons: ["Restart Now", "Later"],
  }).then(r => { if (r.response === 0) autoUpdater.quitAndInstall(); });
});
