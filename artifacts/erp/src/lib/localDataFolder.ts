const DB_NAME = "bizcor_local";
const DB_VERSION = 1;
const STORE = "fileHandles";

function openIDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function idbGet<T>(db: IDBDatabase, key: string): Promise<T | undefined> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).get(key);
    req.onsuccess = () => resolve(req.result as T);
    req.onerror = () => reject(req.error);
  });
}

function idbPut(db: IDBDatabase, key: string, value: unknown): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    const req = tx.objectStore(STORE).put(value, key);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

function idbDelete(db: IDBDatabase, key: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    const req = tx.objectStore(STORE).delete(key);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export function isFileSystemSupported(): boolean {
  return "showDirectoryPicker" in window;
}

export function getDataFolderName(): string | null {
  return localStorage.getItem("erp_data_folder_name");
}

export async function pickDataFolder(): Promise<{ name: string } | null> {
  if (!isFileSystemSupported()) return null;
  try {
    const handle = await (window as any).showDirectoryPicker({ mode: "readwrite", id: "bizcor-data" });
    const db = await openIDB();
    await idbPut(db, "dataFolder", handle);
    localStorage.setItem("erp_data_folder_name", handle.name);
    window.dispatchEvent(new CustomEvent("data-folder-change"));
    return { name: handle.name as string };
  } catch (e: any) {
    if (e?.name !== "AbortError") console.error("pickDataFolder:", e);
    return null;
  }
}

export async function getDataFolder(): Promise<FileSystemDirectoryHandle | null> {
  try {
    const db = await openIDB();
    const handle = await idbGet<FileSystemDirectoryHandle>(db, "dataFolder");
    if (!handle) return null;
    const perm = await (handle as any).requestPermission({ mode: "readwrite" });
    return perm === "granted" ? handle : null;
  } catch { return null; }
}

export async function clearDataFolder(): Promise<void> {
  try {
    const db = await openIDB();
    await idbDelete(db, "dataFolder");
    localStorage.removeItem("erp_data_folder_name");
    window.dispatchEvent(new CustomEvent("data-folder-change"));
  } catch { /* silent */ }
}

export async function saveOfflineDraftToFolder(draft: unknown): Promise<boolean> {
  try {
    const handle = await getDataFolder();
    if (!handle) return false;
    const date = new Date().toISOString().slice(0, 10);
    const filename = `draft_${date}_${Date.now()}.json`;
    const fileHandle = await handle.getFileHandle(filename, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(JSON.stringify(draft, null, 2));
    await writable.close();
    return true;
  } catch { return false; }
}
