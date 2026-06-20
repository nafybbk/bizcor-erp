// File System Access API helpers
// Stores folder handle in IndexedDB for persistence across sessions

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

async function getStoredHandle(): Promise<FileSystemDirectoryHandle | null> {
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

async function storeHandle(handle: FileSystemDirectoryHandle): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put(handle, KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // silent
  }
}

export interface FolderState {
  handle: FileSystemDirectoryHandle | null;
  name: string | null;
}

export async function loadStoredFolder(): Promise<FolderState> {
  const handle = await getStoredHandle();
  if (!handle) return { handle: null, name: null };

  // Verify permission still granted
  try {
    const perm = await (handle as any).queryPermission({ mode: "readwrite" });
    if (perm === "granted") return { handle, name: handle.name };
  } catch { /* ignore */ }

  return { handle: null, name: null };
}

export async function pickFolder(): Promise<FolderState> {
  try {
    const handle = await (window as any).showDirectoryPicker({ mode: "readwrite" });
    await storeHandle(handle);
    return { handle, name: handle.name };
  } catch {
    return { handle: null, name: null };
  }
}

export async function requestPermission(handle: FileSystemDirectoryHandle): Promise<boolean> {
  try {
    const perm = await (handle as any).requestPermission({ mode: "readwrite" });
    return perm === "granted";
  } catch {
    return false;
  }
}

export async function saveJsonToFolder(
  folder: FileSystemDirectoryHandle,
  filename: string,
  data: object
): Promise<void> {
  const fileHandle = await folder.getFileHandle(filename, { create: true });
  const writable = await (fileHandle as any).createWritable();
  await writable.write(JSON.stringify(data, null, 2));
  await writable.close();
}

export async function loadJsonFromFolder(
  folder: FileSystemDirectoryHandle,
  filename: string
): Promise<object | null> {
  try {
    const fileHandle = await folder.getFileHandle(filename);
    const file = await fileHandle.getFile();
    const text = await file.text();
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export async function listJsonFiles(folder: FileSystemDirectoryHandle): Promise<string[]> {
  const files: string[] = [];
  try {
    for await (const [name] of (folder as any).entries()) {
      if (name.endsWith(".json")) files.push(name);
    }
  } catch { /* ignore */ }
  return files.sort();
}

export async function openJsonFile(): Promise<{ data: object; filename: string } | null> {
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

export async function saveAsJsonFile(
  data: object,
  suggestedName: string
): Promise<boolean> {
  try {
    const fileHandle = await (window as any).showSaveFilePicker({
      suggestedName,
      types: [{ description: "JSON Template", accept: { "application/json": [".json"] } }],
    });
    const writable = await fileHandle.createWritable();
    await writable.write(JSON.stringify(data, null, 2));
    await writable.close();
    return true;
  } catch {
    return false;
  }
}

export function isFSASupported(): boolean {
  return "showDirectoryPicker" in window;
}
