# BizCor Report Designer — Desktop EXE

Standalone Electron app. Koi internet nahi chahiye, koi Replit nahi chahiye.

## Requirements (sirf build ke liye)

- **Node.js 18+** — https://nodejs.org
- **pnpm** — `npm install -g pnpm`

## Build karo (Windows)

```
build.bat
```

Ya manually:

```bat
:: Step 1 — Frontend build (Electron mode)
cd ..\report-designer
pnpm install
pnpm run build:electron

:: Step 2 — Electron packaging
cd ..\report-designer-desktop
npm install
npm run build:win
```

EXE yahan milegi:
```
release\
  BizCor Report Designer Setup 1.0.0.exe   ← Installer
  BizCor-Report-Designer-Portable.exe       ← Portable (koi install nahi)
```

## Portable EXE

`BizCor-Report-Designer-Portable.exe` → sirf copy karo aur double-click karo.
Koi installation nahi, koi admin rights nahi (agar perMachine: false ho).

## Source code structure

```
report-designer/          ← React + Vite frontend (source)
  src/
    pages/Designer.tsx    ← Main designer page
    pages/Home.tsx        ← Home screen
    lib/fileSystem.ts     ← File operations (Electron + Browser)
    components/
      reportEngine/       ← Canvas, palette, properties, elements
  vite.electron.config.ts ← Electron-specific Vite build config

report-designer-desktop/  ← Electron wrapper
  electron/
    main.js               ← Main process (window + IPC handlers)
    preload.js            ← Context bridge (renderer se file access)
  package.json            ← electron-builder config
  build.bat               ← One-click build script
```

## Kaise kaam karta hai

1. App kholo → Sales Invoice / Purchase Bill etc. choose karo
2. **Open File** → PC ke kisi bhi folder se `.json` template load karo
3. Design editor mein edit karo
4. **Save As…** → Windows save dialog se koi bhi folder/naam mein save karo
5. Saved file ko BizCor ke `templates/<businessId>/` folder mein copy karo
6. BizCor automatically wahi template use karega printing ke liye

## Default folder (quick save)

"Folder" button se ek folder set karo → phir **Quick Save** button se
ek click mein same folder mein `sales_invoice.json` save hoti rehti hai.
