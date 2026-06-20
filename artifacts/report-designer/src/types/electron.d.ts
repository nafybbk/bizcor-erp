// Type declarations for Electron IPC API exposed via preload.js
interface ElectronAPI {
  openFile: () => Promise<{ content: string; filename: string } | null>;
  saveFileAs: (suggestedName: string, content: string) => Promise<boolean>;
  pickFolder: () => Promise<string | null>;
  readFile: (folderPath: string, filename: string) => Promise<string | null>;
  writeFile: (folderPath: string, filename: string, content: string) => Promise<boolean>;
  listJsonFiles: (folderPath: string) => Promise<string[]>;
  basename: (fullPath: string) => string;
  platform: string;
}

interface Window {
  electronAPI?: ElectronAPI;
}
