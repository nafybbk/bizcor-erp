#!/usr/bin/env node
/**
 * BizCor Connect — APK Build Script
 * Run from the artifacts/customer-network folder:
 *   node scripts/build-apk.js
 *   or: npm run build:apk / pnpm run build:apk
 *
 * What it does:
 *   1. Reads version from app.json
 *   2. Bumps versionCode (Android needs this incremented on every new build)
 *   3. Runs expo prebuild if the android/ folder doesn't exist yet
 *   4. Builds a release APK with Gradle
 *   5. Copies output to releases/bizcor-connect-X.X.X.apk
 */

const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const os = require("os");

const ROOT = path.resolve(__dirname, "..");
const APP_JSON = path.join(ROOT, "app.json");
const ANDROID_DIR = path.join(ROOT, "android");
const APK_OUTPUT = path.join(
  ANDROID_DIR,
  "app",
  "build",
  "outputs",
  "apk",
  "release",
  "app-release.apk"
);
const RELEASES_DIR = path.join(ROOT, "releases");

// ── helpers ─────────────────────────────────────────────────────────────────

function log(msg) {
  console.log(`\n▶  ${msg}`);
}

function run(cmd, cwd = ROOT) {
  console.log(`   $ ${cmd}`);
  execSync(cmd, { cwd, stdio: "inherit" });
}

// ── 1. Read + bump app.json ──────────────────────────────────────────────────

log("Reading app.json …");
const appJson = JSON.parse(fs.readFileSync(APP_JSON, "utf8"));
const version = appJson.expo.version;

if (!version) {
  console.error("❌  No version field found in app.json expo.version");
  process.exit(1);
}

// Bump versionCode (required by Android for every new install/update)
const oldCode = appJson.expo.android.versionCode ?? 1;
const newCode = oldCode + 1;
appJson.expo.android.versionCode = newCode;
fs.writeFileSync(APP_JSON, JSON.stringify(appJson, null, 2) + "\n");

console.log(`   Version     : ${version}`);
console.log(`   versionCode : ${oldCode} → ${newCode}`);

// ── 2. expo prebuild (only if android/ folder is missing) ───────────────────

if (!fs.existsSync(ANDROID_DIR)) {
  log("android/ folder not found — running expo prebuild …");
  run("npx expo prebuild --platform android --no-install");
} else {
  log("android/ folder found — skipping prebuild.");
}

// ── 3. Gradle release build ──────────────────────────────────────────────────

log("Building release APK with Gradle …");
const isWindows = os.platform() === "win32";
const gradlew = isWindows ? "gradlew.bat" : "./gradlew";

run(`${gradlew} assembleRelease`, ANDROID_DIR);

// ── 4. Copy to releases/ with versioned name ─────────────────────────────────

if (!fs.existsSync(APK_OUTPUT)) {
  console.error(`\n❌  APK not found at expected path:\n   ${APK_OUTPUT}`);
  console.error("    Check the Gradle output above for errors.");
  process.exit(1);
}

if (!fs.existsSync(RELEASES_DIR)) {
  fs.mkdirSync(RELEASES_DIR, { recursive: true });
}

const outName = `bizcor-connect-${version}.apk`;
const outPath = path.join(RELEASES_DIR, outName);
fs.copyFileSync(APK_OUTPUT, outPath);

// ── 5. Done ──────────────────────────────────────────────────────────────────

console.log("\n✅  Build complete!");
console.log(`   File : ${outPath}`);
console.log(`   Size : ${(fs.statSync(outPath).size / 1024 / 1024).toFixed(1)} MB`);
console.log("");
console.log("📦  Upload to GitHub release:");
console.log(`   1. Go to github.com/nafybbk/bizcor-releases/releases`);
console.log(`   2. Create or edit a release`);
console.log(`   3. Attach:  releases/${outName}`);
console.log("   4. Publish — users get the update popup automatically ✓");
console.log("");
