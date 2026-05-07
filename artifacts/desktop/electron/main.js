"use strict";

const { app, BrowserWindow, Tray, Menu, shell, ipcMain, nativeImage } = require("electron");
const path = require("path");
const os = require("os");
const http = require("http");
const { autoUpdater } = require("electron-updater");

const trial = require("./trial");
const serverManager = require("./server-manager");

let tray = null;
let mainWindow = null;
let splashWindow = null;
let isQuitting = false;

const dataDir = path.join(app.getPath("userData"), "pg-data");
const resourcesPath = process.resourcesPath || path.join(__dirname, "..");

function getLocalIP() {
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === "IPv4" && !net.internal) {
        return net.address;
      }
    }
  }
  return "localhost";
}

function getServerURL() {
  const ip = getLocalIP();
  const port = serverManager.getServerPort();
  return `http://${ip}:${port}`;
}

function createTrayIcon() {
  const icon = nativeImage.createFromPath(path.join(__dirname, "../assets/tray.png"));
  const resized = icon.isEmpty()
    ? nativeImage.createEmpty()
    : icon.resize({ width: 16, height: 16 });

  tray = new Tray(resized);
  tray.setToolTip("BizCor ERP Server");
  updateTrayMenu();

  tray.on("double-click", () => {
    openMainWindow();
  });
}

function updateTrayMenu() {
  const status = serverManager.getStatus();
  const serverURL = getServerURL();

  const menuTemplate = [
    {
      label: `BizCor ERP`,
      enabled: false,
    },
    { type: "separator" },
    {
      label: status === "running" ? `● Server: Running` : `○ Server: ${status}`,
      enabled: false,
    },
    {
      label: status === "running" ? `URL: ${serverURL}` : "Starting...",
      enabled: status === "running",
      click: () => shell.openExternal(serverURL),
    },
    { type: "separator" },
    {
      label: "Open Dashboard",
      click: () => openMainWindow(),
    },
    {
      label: "Open in Browser",
      enabled: status === "running",
      click: () => shell.openExternal(serverURL),
    },
    {
      label: "Show QR Code",
      enabled: status === "running",
      click: () => showQRWindow(),
    },
    { type: "separator" },
    {
      label: "Quit BizCor ERP",
      click: () => {
        isQuitting = true;
        app.quit();
      },
    },
  ];

  const menu = Menu.buildFromTemplate(menuTemplate);
  tray.setContextMenu(menu);
}

function createSplashWindow() {
  splashWindow = new BrowserWindow({
    width: 420,
    height: 300,
    frame: false,
    transparent: false,
    alwaysOnTop: true,
    center: true,
    resizable: false,
    webPreferences: { nodeIntegration: false },
    backgroundColor: "#1e40af",
  });

  splashWindow.loadURL(`data:text/html,
    <!DOCTYPE html>
    <html>
    <head>
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body {
        background: #1e40af;
        color: white;
        font-family: 'Segoe UI', Arial, sans-serif;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        height: 100vh;
        user-select: none;
      }
      h1 { font-size: 32px; font-weight: 800; letter-spacing: -1px; }
      p { font-size: 13px; opacity: 0.7; margin-top: 8px; }
      .status { margin-top: 30px; font-size: 14px; opacity: 0.85; }
      .spinner {
        width: 24px; height: 24px;
        border: 3px solid rgba(255,255,255,0.3);
        border-top-color: white;
        border-radius: 50%;
        animation: spin 0.8s linear infinite;
        margin-top: 16px;
      }
      @keyframes spin { to { transform: rotate(360deg); } }
    </style>
    </head>
    <body>
      <h1>BizCor ERP</h1>
      <p>LAN Server for Indian Businesses</p>
      <div class="status" id="status">Starting services...</div>
      <div class="spinner"></div>
    </body>
    </html>
  `);
}

function openMainWindow() {
  if (mainWindow) {
    mainWindow.show();
    mainWindow.focus();
    return;
  }

  const trialStatus = trial.getTrialStatus();
  const serverURL = getServerURL();

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    title: "BizCor ERP",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  if (trialStatus.locked) {
    mainWindow.loadURL(`data:text/html,
      <!DOCTYPE html>
      <html>
      <head>
      <style>
        body { font-family: 'Segoe UI', Arial, sans-serif; background: #fef2f2; display:flex; align-items:center; justify-content:center; height:100vh; margin:0; }
        .box { background: white; border-radius: 12px; padding: 40px; max-width: 480px; text-align:center; box-shadow: 0 4px 24px rgba(0,0,0,0.1); }
        h1 { color: #dc2626; font-size: 24px; }
        p { color: #374151; line-height: 1.6; }
        .badge { background:#fef2f2; color:#dc2626; border:1px solid #fecaca; padding: 6px 16px; border-radius: 999px; font-size:13px; font-weight:600; display:inline-block; margin-bottom:16px; }
      </style>
      </head>
      <body>
        <div class="box">
          <div class="badge">Trial Expired</div>
          <h1>BizCor ERP — Trial Khatam</h1>
          <p>Aapka 90-din ka trial period khatam ho gaya hai.</p>
          <p style="margin-top:12px;">License activate karne ke liye Tech Support se contact karein.</p>
        </div>
      </body>
      </html>
    `);
  } else {
    mainWindow.loadURL(serverURL);
  }

  mainWindow.on("close", (e) => {
    if (!isQuitting) {
      e.preventDefault();
      mainWindow.hide();
    }
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

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
    width: 320,
    height: 400,
    title: "Connect to BizCor ERP",
    resizable: false,
    alwaysOnTop: true,
    webPreferences: { nodeIntegration: false },
  });

  qrWindow.loadURL(`data:text/html,
    <!DOCTYPE html>
    <html>
    <head>
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body { font-family: 'Segoe UI', Arial, sans-serif; background: #f8fafc; padding: 24px; text-align: center; }
      h2 { font-size: 16px; color: #1e40af; margin-bottom: 4px; }
      p { font-size: 12px; color: #64748b; margin-bottom: 16px; }
      img { width: 200px; height: 200px; border: 1px solid #e2e8f0; border-radius: 8px; }
      .url { margin-top: 16px; background: #f1f5f9; border-radius: 8px; padding: 10px; font-size: 13px; font-weight: 600; color: #1e40af; word-break: break-all; }
      .hint { margin-top: 12px; font-size: 11px; color: #94a3b8; }
    </style>
    </head>
    <body>
      <h2>BizCor ERP — Connect</h2>
      <p>Same WiFi/LAN pe scan karein</p>
      ${qrDataURL ? `<img src="${qrDataURL}" alt="QR Code" />` : "<div style='height:200px;display:flex;align-items:center;justify-content:center;color:#94a3b8'>QR not available</div>"}
      <div class="url">${serverURL}</div>
      <div class="hint">Browser mein ye URL open karein</div>
    </body>
    </html>
  `);

  qrWindow.on("closed", () => { qrWindow = null; });
}

ipcMain.handle("get-trial-status", () => trial.getTrialStatus());
ipcMain.handle("get-server-info", () => ({
  url: getServerURL(),
  status: serverManager.getStatus(),
  ip: getLocalIP(),
  port: serverManager.getServerPort(),
}));
ipcMain.handle("open-in-browser", (_, url) => shell.openExternal(url));

app.whenReady().then(async () => {
  createSplashWindow();
  createTrayIcon();

  serverManager.onStatusChange((status) => {
    updateTrayMenu();
    if (mainWindow) {
      mainWindow.webContents.send("status-update", {
        status,
        trial: trial.getTrialStatus(),
        serverInfo: { url: getServerURL(), ip: getLocalIP(), port: serverManager.getServerPort() },
      });
    }

    if (status === "running" && splashWindow) {
      splashWindow.close();
      splashWindow = null;
      openMainWindow();

      setTimeout(() => {
        autoUpdater.checkForUpdatesAndNotify().catch(() => {});
      }, 5000);
    }
  });

  try {
    await serverManager.start(dataDir, resourcesPath);
  } catch (err) {
    console.error("Failed to start server:", err);
    if (splashWindow) { splashWindow.close(); splashWindow = null; }
  }
});

app.on("window-all-closed", () => {
});

app.on("before-quit", async () => {
  isQuitting = true;
  await serverManager.stop();
});

autoUpdater.on("update-available", () => {
  if (tray) tray.setToolTip("BizCor ERP — Update available!");
});

autoUpdater.on("update-downloaded", () => {
  const { dialog } = require("electron");
  dialog.showMessageBox({
    type: "info",
    title: "Update Ready",
    message: "Naya version download ho gaya. App restart karo update lagane ke liye.",
    buttons: ["Abhi Restart Karo", "Baad Mein"],
  }).then((result) => {
    if (result.response === 0) autoUpdater.quitAndInstall();
  });
});
