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

  // Backup
  backup: {
    isPinSet: () => ipcRenderer.invoke("backup:is-pin-set"),
    setPin: (pin) => ipcRenderer.invoke("backup:set-pin", pin),
    verifyPin: (pin) => ipcRenderer.invoke("backup:verify-pin", pin),
    isEnabled: () => ipcRenderer.invoke("backup:is-enabled"),
    setEnabled: (val) => ipcRenderer.invoke("backup:set-enabled", val),
    list: () => ipcRenderer.invoke("backup:list"),
    create: () => ipcRenderer.invoke("backup:create"),
    openFolder: () => ipcRenderer.invoke("backup:open-folder"),
    chooseAndRestore: () => ipcRenderer.invoke("backup:choose-and-restore"),
    restore: (filePath, pin) => ipcRenderer.invoke("backup:restore", filePath, pin),
  },
});
