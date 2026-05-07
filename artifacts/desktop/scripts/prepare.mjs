/**
 * Prepare script: builds the API server bundle + ERP frontend
 * and copies them into artifacts/desktop/ for electron-builder packaging.
 *
 * Run: node scripts/prepare.mjs
 * (from inside artifacts/desktop/)
 */

import { execSync } from "child_process";
import { cpSync, mkdirSync, rmSync, existsSync } from "fs";
import { resolve, join } from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const desktopDir = resolve(__dirname, "..");
const repoRoot = resolve(desktopDir, "../..");

function run(cmd, cwd = repoRoot) {
  console.log(`\n→ ${cmd}`);
  execSync(cmd, { stdio: "inherit", cwd });
}

function copyDir(src, dest) {
  if (existsSync(dest)) rmSync(dest, { recursive: true });
  mkdirSync(dest, { recursive: true });
  cpSync(src, dest, { recursive: true });
  console.log(`   Copied: ${src} → ${dest}`);
}

console.log("=== BizCor ERP — Desktop Build ===\n");

// 1. Build API server
console.log("1/3  Building API server...");
run("pnpm --filter @workspace/api-server run build");
const serverSrc = resolve(repoRoot, "artifacts/api-server/dist");
const serverDest = join(desktopDir, "server-bundle");
copyDir(serverSrc, serverDest);

// 2. Build ERP frontend with DESKTOP_MODE
console.log("2/3  Building ERP frontend...");
run("pnpm --filter @workspace/erp run build", repoRoot);
const frontendSrc = resolve(repoRoot, "artifacts/erp/dist");
const frontendDest = join(desktopDir, "frontend-dist");
copyDir(frontendSrc, frontendDest);

// 3. Install desktop dependencies
console.log("3/3  Installing desktop dependencies...");
run("npm install --production", desktopDir);

console.log("\n✅ Build complete. Run: npm run build:win");
