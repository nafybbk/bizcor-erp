"use strict";

const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("bizcorDesktop", {
  getTrialStatus: () => ipcRenderer.invoke("get-trial-status"),
  getServerInfo: () => ipcRenderer.invoke("get-server-info"),
  getHardwareInfo: () => ipcRenderer.invoke("get-hardware-info"),
  openInBrowser: (url) => ipcRenderer.invoke("open-in-browser", url),
  saveDbUrl: (url) => ipcRenderer.invoke("save-db-url", url),
  skipCloudSetup: () => ipcRenderer.invoke("skip-cloud-setup"),
  onStatusUpdate: (fn) => ipcRenderer.on("status-update", (_, data) => fn(data)),
});
