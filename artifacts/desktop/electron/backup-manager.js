"use strict";

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const zlib = require("zlib");
const { app } = require("electron");

const MAGIC = Buffer.from("BC01");
const MAX_BACKUPS = 7;
const CONFIG_SECRET = "BizCorBackup2025!SecretKey#Safe";

// ─── Paths ────────────────────────────────────────────────────────────────────

function getUserData() { return app.getPath("userData"); }
function getConfigFile() { return path.join(getUserData(), "backup-config.dat"); }
function getSqliteDbPath() { return path.join(getUserData(), "bizcor-db", "bizcor.db"); }

function getBackupDir() {
  const cfg = loadConfig();
  return cfg.customBackupDir || path.join(getUserData(), "bizcor-backups");
}

function setCustomBackupDir(dirPath) {
  const cfg = loadConfig();
  cfg.customBackupDir = dirPath;
  saveConfig(cfg);
}

function ensureBackupDir() {
  const dir = getBackupDir();
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

// ─── Config Encryption ───────────────────────────────────────────────────────

function encryptConfig(obj) {
  const text = JSON.stringify(obj);
  const iv = crypto.randomBytes(16);
  const key = crypto.scryptSync(CONFIG_SECRET, "backup-cfg-salt", 32);
  const cipher = crypto.createCipheriv("aes-256-cbc", key, iv);
  let enc = cipher.update(text, "utf8", "hex");
  enc += cipher.final("hex");
  return iv.toString("hex") + ":" + enc;
}

function decryptConfig(raw) {
  try {
    const [ivHex, enc] = raw.split(":");
    const iv = Buffer.from(ivHex, "hex");
    const key = crypto.scryptSync(CONFIG_SECRET, "backup-cfg-salt", 32);
    const decipher = crypto.createDecipheriv("aes-256-cbc", key, iv);
    let dec = decipher.update(enc, "hex", "utf8");
    dec += decipher.final("utf8");
    return JSON.parse(dec);
  } catch { return {}; }
}

function loadConfig() {
  try {
    const raw = fs.readFileSync(getConfigFile(), "utf8");
    return decryptConfig(raw);
  } catch { return {}; }
}

function saveConfig(cfg) {
  fs.writeFileSync(getConfigFile(), encryptConfig(cfg), "utf8");
}

// ─── PIN ─────────────────────────────────────────────────────────────────────

function hashPin(pin) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(pin, salt, 32).toString("hex");
  return `${salt}:${hash}`;
}

function verifyPinHash(pin, stored) {
  try {
    const [salt, hash] = stored.split(":");
    const derived = crypto.scryptSync(pin, salt, 32).toString("hex");
    return crypto.timingSafeEqual(Buffer.from(derived, "hex"), Buffer.from(hash, "hex"));
  } catch { return false; }
}

function isPinSet() {
  const cfg = loadConfig();
  return !!cfg.pinHash;
}

function setPin(pin) {
  const cfg = loadConfig();
  cfg.pinHash = hashPin(String(pin));
  saveConfig(cfg);
}

function verifyPin(pin) {
  const cfg = loadConfig();
  if (!cfg.pinHash) return false;
  return verifyPinHash(String(pin), cfg.pinHash);
}

// ─── Enable / Disable ─────────────────────────────────────────────────────────

function isEnabled() {
  const cfg = loadConfig();
  return !!cfg.enabled;
}

function setEnabled(val) {
  const cfg = loadConfig();
  cfg.enabled = !!val;
  saveConfig(cfg);
}

// ─── Backup Creation ─────────────────────────────────────────────────────────

// File format: [MAGIC(4)] [salt(16)] [iv(12)] [authTag(16)] [encryptedGzipData]
function encryptData(data, pin) {
  const salt = crypto.randomBytes(16);
  const iv = crypto.randomBytes(12);
  const key = crypto.scryptSync(String(pin), salt, 32);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(data), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([MAGIC, salt, iv, authTag, encrypted]);
}

function decryptData(buf, pin) {
  if (!buf.slice(0, 4).equals(MAGIC)) throw new Error("Invalid backup file (wrong format).");
  const salt = buf.slice(4, 20);
  const iv = buf.slice(20, 32);
  const authTag = buf.slice(32, 48);
  const encrypted = buf.slice(48);
  const key = crypto.scryptSync(String(pin), salt, 32);
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(authTag);
  try {
    return Buffer.concat([decipher.update(encrypted), decipher.final()]);
  } catch {
    throw new Error("Galat PIN hai ya backup file corrupt hai.");
  }
}

function createBackup() {
  const cfg = loadConfig();
  if (!cfg.pinHash) throw new Error("PIN set nahi hai. Pehle PIN set karein.");

  const dbPath = getSqliteDbPath();
  if (!fs.existsSync(dbPath)) throw new Error("Database file nahi mili: " + dbPath);

  const rawDb = fs.readFileSync(dbPath);
  const compressed = zlib.gzipSync(rawDb);

  // Use stored PIN hash to derive encryption PIN — we store a deterministic key
  // Actually: we need the actual PIN for encryption. So for auto backup we store
  // an encrypted copy of the PIN itself (encrypted with CONFIG_SECRET).
  const encPin = cfg.encryptedPin;
  if (!encPin) throw new Error("Backup PIN stored nahi hai. Dobara PIN set karein.");

  const pin = decryptStoredPin(encPin);
  const encrypted = encryptData(compressed, pin);

  const dir = ensureBackupDir();
  const now = new Date();
  const stamp = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-${String(now.getDate()).padStart(2,"0")}_${String(now.getHours()).padStart(2,"0")}-${String(now.getMinutes()).padStart(2,"0")}`;
  const fileName = `bizcor-db-${stamp}.bizcor`;
  const filePath = path.join(dir, fileName);

  fs.writeFileSync(filePath, encrypted);

  // Update last backup date
  cfg.lastBackupDate = now.toISOString().split("T")[0];
  saveConfig(cfg);

  // Cleanup old backups (keep MAX_BACKUPS)
  cleanupOldBackups();

  return { fileName, filePath, size: encrypted.length };
}

function decryptStoredPin(encPin) {
  try {
    const [ivHex, enc] = encPin.split(":");
    const iv = Buffer.from(ivHex, "hex");
    const key = crypto.scryptSync(CONFIG_SECRET, "pin-store-salt", 32);
    const decipher = crypto.createDecipheriv("aes-256-cbc", key, iv);
    let dec = decipher.update(enc, "hex", "utf8");
    dec += decipher.final("utf8");
    return dec;
  } catch { throw new Error("PIN decrypt nahi hua."); }
}

function encryptStoredPin(pin) {
  const iv = crypto.randomBytes(16);
  const key = crypto.scryptSync(CONFIG_SECRET, "pin-store-salt", 32);
  const cipher = crypto.createCipheriv("aes-256-cbc", key, iv);
  let enc = cipher.update(String(pin), "utf8", "hex");
  enc += cipher.final("hex");
  return iv.toString("hex") + ":" + enc;
}

// Override setPin to also store encrypted PIN for auto-backup
function setPinFull(pin) {
  const cfg = loadConfig();
  cfg.pinHash = hashPin(String(pin));
  cfg.encryptedPin = encryptStoredPin(String(pin));
  saveConfig(cfg);
}

// ─── Cleanup ─────────────────────────────────────────────────────────────────

function cleanupOldBackups() {
  const dir = getBackupDir();
  if (!fs.existsSync(dir)) return;
  const files = fs.readdirSync(dir)
    .filter(f => f.endsWith(".bizcor"))
    .map(f => ({ name: f, mtime: fs.statSync(path.join(dir, f)).mtime.getTime() }))
    .sort((a, b) => b.mtime - a.mtime);

  files.slice(MAX_BACKUPS).forEach(f => {
    try { fs.unlinkSync(path.join(dir, f.name)); } catch (_) {}
  });
}

// ─── Auto Backup ─────────────────────────────────────────────────────────────

function autoBackupIfNeeded() {
  if (!isEnabled()) return null;
  const cfg = loadConfig();
  if (!cfg.pinHash || !cfg.encryptedPin) return null;

  const today = new Date().toISOString().split("T")[0];
  if (cfg.lastBackupDate === today) return null; // Already done today

  try {
    return createBackup();
  } catch (err) {
    console.error("[backup] Auto backup failed:", err.message);
    return null;
  }
}

// ─── List Backups ────────────────────────────────────────────────────────────

function listBackups() {
  const dir = getBackupDir();
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter(f => f.endsWith(".bizcor"))
    .map(f => {
      const stat = fs.statSync(path.join(dir, f));
      return {
        name: f,
        path: path.join(dir, f),
        size: stat.size,
        createdAt: stat.mtime.toISOString(),
        sizeKb: Math.round(stat.size / 1024),
      };
    })
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

// ─── Restore ─────────────────────────────────────────────────────────────────

function restoreFromFile(filePath, pin) {
  if (!fs.existsSync(filePath)) throw new Error("Backup file nahi mili.");

  const buf = fs.readFileSync(filePath);
  const compressed = decryptData(buf, pin); // throws if wrong PIN
  const rawDb = zlib.gunzipSync(compressed);

  const dbPath = getSqliteDbPath();
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });

  // Take a safety copy before restore
  if (fs.existsSync(dbPath)) {
    fs.copyFileSync(dbPath, dbPath + ".pre-restore");
  }

  fs.writeFileSync(dbPath, rawDb);
  return { success: true, size: rawDb.length };
}

// ─── Public API ───────────────────────────────────────────────────────────────

module.exports = {
  isPinSet,
  setPin: setPinFull,
  verifyPin,
  isEnabled,
  setEnabled,
  createBackup,
  autoBackupIfNeeded,
  listBackups,
  restoreFromFile,
  getBackupDir,
  setCustomBackupDir,
  getSqliteDbPath,
};
