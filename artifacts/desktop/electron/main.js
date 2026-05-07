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
<p>Same WiFi pe kisi bhi device se kholen</p>
${qrDataURL ? `<img src="${qrDataURL}" />` : `<div style="height:200px;line-height:200px;color:#94a3b8">QR unavailable</div>`}
<div class="url">${serverURL}</div>
<div class="hint">Browser mein ye URL type karein</div>
</body></html>`;

  qrWindow.loadURL("data:text/html;charset=utf-8," + encodeURIComponent(html));
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
  const trialLabel =
    trialStatus.phase === 1 ? `Trial: ${trialStatus.daysLeft} din bache` :
    trialStatus.phase === 2 ? `Alert: ${trialStatus.daysLeft} din bache` :
    trialStatus.phase === 3 ? `Grace: ${trialStatus.daysLeft} din bache` :
    "Trial Khatam — Locked";

  tray.setContextMenu(Menu.buildFromTemplate([
    { label: "BizCor ERP", enabled: false },
    { label: trialLabel, enabled: false },
    { type: "separator" },
    { label: st === "running" ? `Running — ${url}` : `Server: ${st}`, enabled: false },
    { type: "separator" },
    { label: "Open Dashboard", click: () => openMainWindow() },
    { label: "Open in Browser", enabled: st === "running", click: () => shell.openExternal(url) },
    { label: "Show QR Code (LAN)", enabled: st === "running", click: () => showQRWindow() },
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
      "Cloud Connect Error",
      "Cloud database se connect nahi ho saka:\n\n" + err.message +
      "\n\nURL dobara check karein. App local mode mein chal raha hai."
    );
    // Restart in offline mode
    await server.start(resourcesPath);
    openMainWindow();
    refreshTray();
  }
});

ipcMain.handle("skip-cloud-setup", async () => {
  if (setupWindow) { setupWindow.close(); setupWindow = null; }
  openMainWindow();
});

// ─── Single Instance Lock ─────────────────────────────────────────────────────
// Ek se zyada instances nahi honge — duplicate click pe existing window focus hoga

const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  // Doosra instance already chal raha hai — user ko batao aur quit karo
  const { dialog } = require("electron");
  dialog.showErrorBox(
    "BizCor ERP — Already Running",
    "BizCor ERP pehle se chal raha hai.\n\n" +
    "Taskbar ke system tray (neeche daayein corner) mein BizCor icon dhundhen,\n" +
    "usse right-click karein aur 'Quit' chunein.\n\n" +
    "Phir dobara BizCor ERP kholein."
  );
  app.quit();
} else {
  app.on("second-instance", () => {
    // Koi doosra instance kholne ki koshish kare → existing window focus karo
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

    // Forward progress updates from server-manager to splash screen
    server.onProgress((pct, step, sub) => {
      updateSplashProgress(pct, step, sub);
    });

    server.onStatusChange(status => {
      refreshTray();
      if (status === "running") {
        closeSplash();
        openMainWindow();
        setTimeout(() => autoUpdater.checkForUpdatesAndNotify().catch(() => {}), 8000);
      } else if (status === "error") {
        // Close splash FIRST — then show error (splash was alwaysOnTop before, fixed now)
        closeSplash();
        dialog.showMessageBox({
          type: "error",
          title: "Server Error — BizCor ERP",
          message: "Server shuru nahi ho saka.",
          detail:
            "Possible reasons:\n" +
            "• Pehli baar mein database load hone mein time laga\n" +
            "• Antivirus ne block kiya ho sakta hai\n\n" +
            "Kya karein:\n" +
            "1. App dobara kholein (2nd try mein jaldi khulega)\n" +
            "2. Antivirus mein BizCor ERP ko allow karein\n" +
            "3. Agar phir bhi na khule — tray icon → Quit karein aur dobara kholein",
          buttons: ["Dobara Try Karein", "Band Karein"],
          defaultId: 0,
        }).then(result => {
          if (result.response === 0) {
            // Retry
            showSplash();
            server.start(resourcesPath);
          } else {
            isQuitting = true;
            app.quit();
          }
        });
      }
    });

    showSplash();
    await server.start(resourcesPath);
  });

  app.on("window-all-closed", () => {});
  app.on("before-quit", async () => { isQuitting = true; await server.stop(); });
}

// ─── Auto Updater ─────────────────────────────────────────────────────────────

autoUpdater.on("update-downloaded", () => {
  dialog.showMessageBox({
    type: "info",
    title: "Update Ready — BizCor ERP",
    message: "Naya version download ho gaya hai.",
    detail: "App restart karo to update lag jaayega.",
    buttons: ["Abhi Restart", "Baad Mein"],
  }).then(r => { if (r.response === 0) autoUpdater.quitAndInstall(); });
});
