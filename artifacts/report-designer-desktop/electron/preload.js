"use strict";

const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  // ── File operations ──────────────────────────────────────────────────────
  openFile: () => ipcRenderer.invoke("dialog:openFile"),
  saveFileAs: (suggestedName, content) =>
    ipcRenderer.invoke("dialog:saveFileAs", suggestedName, content),
  pickFolder: () => ipcRenderer.invoke("dialog:pickFolder"),
  readFile: (folderPath, filename) =>
    ipcRenderer.invoke("fs:readFile", folderPath, filename),
  writeFile: (folderPath, filename, content) =>
    ipcRenderer.invoke("fs:writeFile", folderPath, filename, content),
  listJsonFiles: (folderPath) =>
    ipcRenderer.invoke("fs:listJsonFiles", folderPath),
  basename: (fullPath) => {
    // Simple basename — no path module needed in renderer
    return fullPath.replace(/\\/g, "/").split("/").pop() || fullPath;
  },
  platform: process.platform,
});
