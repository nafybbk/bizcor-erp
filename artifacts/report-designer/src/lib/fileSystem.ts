// File System helpers — supports both:
//   Browser: File System Access API (Chrome/Edge)
//   Electron: Native dialog + fs via IPC (electronAPI)

// ─── Electron detection ───────────────────────────────────────────────────────
export function isElectron(): boolean {
  return typeof window !== "undefined" && !!window.electronAPI;
}

// ─── Types ────────────────────────────────────────────────────────────────────
// In Electron: handle = string (directory path)
// In browser:  handle = FileSystemDirectoryHandle
export type FolderHandle = FileSystemDirectoryHandle | string;

export interface FolderState {
  handle: FolderHandle | null;
  name: string | null;
}

// ─── Electron folder stored in localStorage ───────────────────────────────────
const ELECTRON_FOLDER_KEY = "bizcor-rd-electron-folder";

function getElectronBasename(fullPath: string): string {
  return window.electronAPI?.basename(fullPath) ?? fullPath.split(/[\\/]/).pop() ?? fullPath;
}

// ─── Browser: IndexedDB handle persistence ────────────────────────────────────
const DB_NAME = "bizcor-rd";
const STORE = "handles";
const KEY = "outputFolder";

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function getBrowserStoredHandle(): Promise<FileSystemDirectoryHandle | null> {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE, "readonly");
      const req = tx.objectStore(STORE).get(KEY);
      req.onsuccess = () => resolve(req.result ?? null);
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

async function storeBrowserHandle(handle: FileSystemDirectoryHandle): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put(handle, KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch { /* silent */ }
}

// ─── loadStoredFolder ─────────────────────────────────────────────────────────
export async function loadStoredFolder(): Promise<FolderState> {
  if (isElectron()) {
    const savedPath = localStorage.getItem(ELECTRON_FOLDER_KEY);
    if (!savedPath) return { handle: null, name: null };
    return { handle: savedPath, name: getElectronBasename(savedPath) };
  }

  // Browser FSA
  const handle = await getBrowserStoredHandle();
  if (!handle) return { handle: null, name: null };
  try {
    const perm = await (handle as any).queryPermission({ mode: "readwrite" });
    if (perm === "granted") return { handle, name: handle.name };
  } catch { /* ignore */ }
  return { handle: null, name: null };
}

// ─── pickFolder ───────────────────────────────────────────────────────────────
export async function pickFolder(): Promise<FolderState> {
  if (isElectron()) {
    const folderPath = await window.electronAPI!.pickFolder();
    if (!folderPath) return { handle: null, name: null };
    localStorage.setItem(ELECTRON_FOLDER_KEY, folderPath);
    return { handle: folderPath, name: getElectronBasename(folderPath) };
  }

  // Browser FSA
  try {
    const handle = await (window as any).showDirectoryPicker({ mode: "readwrite" });
    await storeBrowserHandle(handle);
    return { handle, name: handle.name };
  } catch {
    return { handle: null, name: null };
  }
}

// ─── requestPermission ────────────────────────────────────────────────────────
export async function requestPermission(handle: FolderHandle): Promise<boolean> {
  if (isElectron()) return true; // Electron always has access
  try {
    const perm = await (handle as FileSystemDirectoryHandle as any).requestPermission({ mode: "readwrite" });
    return perm === "granted";
  } catch {
    return false;
  }
}

// ─── saveJsonToFolder ─────────────────────────────────────────────────────────
export async function saveJsonToFolder(
  folder: FolderHandle,
  filename: string,
  data: object
): Promise<void> {
  const content = JSON.stringify(data, null, 2);

  if (isElectron()) {
    await window.electronAPI!.writeFile(folder as string, filename, content);
    return;
  }

  // Browser FSA
  const dirHandle = folder as FileSystemDirectoryHandle;
  const fileHandle = await dirHandle.getFileHandle(filename, { create: true });
  const writable = await (fileHandle as any).createWritable();
  await writable.write(content);
  await writable.close();
}

// ─── loadJsonFromFolder ───────────────────────────────────────────────────────
export async function loadJsonFromFolder(
  folder: FolderHandle,
  filename: string
): Promise<object | null> {
  try {
    if (isElectron()) {
      const content = await window.electronAPI!.readFile(folder as string, filename);
      if (!content) return null;
      return JSON.parse(content);
    }

    // Browser FSA
    const dirHandle = folder as FileSystemDirectoryHandle;
    const fileHandle = await dirHandle.getFileHandle(filename);
    const file = await fileHandle.getFile();
    const text = await file.text();
    return JSON.parse(text);
  } catch {
    return null;
  }
}

// ─── listJsonFiles ────────────────────────────────────────────────────────────
export async function listJsonFiles(folder: FolderHandle): Promise<string[]> {
  try {
    if (isElectron()) {
      return await window.electronAPI!.listJsonFiles(folder as string);
    }

    // Browser FSA
    const files: string[] = [];
    const dirHandle = folder as FileSystemDirectoryHandle;
    for await (const [name] of (dirHandle as any).entries()) {
      if (name.endsWith(".json")) files.push(name);
    }
    return files.sort();
  } catch {
    return [];
  }
}

// ─── openJsonFile ─────────────────────────────────────────────────────────────
export async function openJsonFile(): Promise<{ data: object; filename: string } | null> {
  if (isElectron()) {
    const result = await window.electronAPI!.openFile();
    if (!result) return null;
    try {
      return { data: JSON.parse(result.content), filename: result.filename };
    } catch {
      return null;
    }
  }

  // Browser FSA
  try {
    const [fileHandle] = await (window as any).showOpenFilePicker({
      types: [{ description: "JSON Template", accept: { "application/json": [".json"] } }],
      multiple: false,
    });
    const file = await fileHandle.getFile();
    const text = await file.text();
    return { data: JSON.parse(text), filename: file.name };
  } catch {
    return null;
  }
}

// ─── saveAsJsonFile ───────────────────────────────────────────────────────────
export async function saveAsJsonFile(
  data: object,
  suggestedName: string
): Promise<boolean> {
  const content = JSON.stringify(data, null, 2);

  if (isElectron()) {
    return await window.electronAPI!.saveFileAs(suggestedName, content);
  }

  // Browser FSA
  try {
    const fileHandle = await (window as any).showSaveFilePicker({
      suggestedName,
      types: [{ description: "JSON Template", accept: { "application/json": [".json"] } }],
    });
    const writable = await fileHandle.createWritable();
    await writable.write(content);
    await writable.close();
    return true;
  } catch {
    return false;
  }
}

export function isFSASupported(): boolean {
  return isElectron() || "showDirectoryPicker" in window;
}
