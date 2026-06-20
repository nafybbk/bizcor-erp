"use strict";

const { app, BrowserWindow, ipcMain, dialog } = require("electron");
const path = require("path");
const fs = require("fs").promises;

let mainWindow = null;

const resourcesPath = process.resourcesPath || path.join(__dirname, "..");
const frontendPath = path.join(resourcesPath, "frontend-dist");

// ─── Create main window ──────────────────────────────────────────────────────
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    title: "BizCor Report Designer",
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, "preload.js"),
    },
    backgroundColor: "#111827",
    show: false,
  });

  // Load built frontend
  const indexPath = path.join(frontendPath, "index.html");
  mainWindow.loadFile(indexPath).catch((err) => {
    dialog.showErrorBox(
      "Load Error",
      `Frontend load nahi hua:\n${indexPath}\n\nError: ${err.message}`
    );
  });

  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

// ─── App lifecycle ────────────────────────────────────────────────────────────
app.whenReady().then(() => {
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  app.quit();
});

// ─── IPC: Dialog — Open file ──────────────────────────────────────────────────
ipcMain.handle("dialog:openFile", async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: "Template file kholo",
    filters: [{ name: "JSON Template", extensions: ["json"] }],
    properties: ["openFile"],
  });
  if (result.canceled || result.filePaths.length === 0) return null;
  const filePath = result.filePaths[0];
  const content = await fs.readFile(filePath, "utf8");
  const filename = path.basename(filePath);
  return { content, filename };
});

// ─── IPC: Dialog — Save As ────────────────────────────────────────────────────
ipcMain.handle("dialog:saveFileAs", async (_event, suggestedName, content) => {
  const result = await dialog.showSaveDialog(mainWindow, {
    title: "Template save karo",
    defaultPath: suggestedName,
    filters: [{ name: "JSON Template", extensions: ["json"] }],
  });
  if (result.canceled || !result.filePath) return false;
  await fs.writeFile(result.filePath, content, "utf8");
  return true;
});

// ─── IPC: Dialog — Pick folder ────────────────────────────────────────────────
ipcMain.handle("dialog:pickFolder", async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: "Default save folder chuniye",
    properties: ["openDirectory", "createDirectory"],
  });
  if (result.canceled || result.filePaths.length === 0) return null;
  return result.filePaths[0];
});

// ─── IPC: fs — Read file from folder ─────────────────────────────────────────
ipcMain.handle("fs:readFile", async (_event, folderPath, filename) => {
  try {
    const filePath = path.join(folderPath, filename);
    const content = await fs.readFile(filePath, "utf8");
    return content;
  } catch {
    return null;
  }
});

// ─── IPC: fs — Write file to folder ──────────────────────────────────────────
ipcMain.handle("fs:writeFile", async (_event, folderPath, filename, content) => {
  try {
    await fs.mkdir(folderPath, { recursive: true });
    const filePath = path.join(folderPath, filename);
    await fs.writeFile(filePath, content, "utf8");
    return true;
  } catch (err) {
    console.error("writeFile error:", err);
    return false;
  }
});

// ─── IPC: fs — List JSON files in folder ─────────────────────────────────────
ipcMain.handle("fs:listJsonFiles", async (_event, folderPath) => {
  try {
    const entries = await fs.readdir(folderPath);
    return entries.filter((f) => f.endsWith(".json")).sort();
  } catch {
    return [];
  }
});
