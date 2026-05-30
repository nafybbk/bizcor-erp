"use strict";

const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const { app } = require("electron");

const SERVER_PORT = process.env.BIZCOR_PORT || 3737;
const SECRET = "BizCorConfig2025!Key";
const CONFIG_FILE = () => path.join(app.getPath("userData"), "db-config.dat");

let serverProcess = null;
let _status = "stopped";
let _lastError = null;
let _onStatusChange = null;
let _onProgress = null;

function setStatus(s) {
  _status = s;
  if (_onStatusChange) _onStatusChange(s);
}

function setProgress(pct, step, sub) {
  if (_onProgress) _onProgress(pct, step, sub);
}

function onStatusChange(fn) { _onStatusChange = fn; }
function onProgress(fn) { _onProgress = fn; }
function getStatus() { return _status; }
function getLastError() { return _lastError; }
function getServerPort() { return SERVER_PORT; }

// ─── Log File ────────────────────────────────────────────────────────────────

function getLogPath() {
  return path.join(app.getPath("userData"), "bizcor-server.log");
}

let _logStream = null;

function openLog() {
  try {
    const logPath = getLogPath();
    fs.mkdirSync(path.dirname(logPath), { recursive: true });
    _logStream = fs.createWriteStream(logPath, { flags: "a" });
    _logStream.write(`\n\n========== BizCor ERP started at ${new Date().toISOString()} ==========\n`);
  } catch (_) {}
}

function writeLog(line) {
  if (_logStream) {
    try { _logStream.write(line + "\n"); } catch (_) {}
  }
  console.log(line);
}

function closeLog() {
  if (_logStream) {
    try { _logStream.end(); } catch (_) {}
    _logStream = null;
  }
}

// ─── Crypto ──────────────────────────────────────────────────────────────────

function encrypt(text) {
  const iv = crypto.randomBytes(16);
  const key = crypto.scryptSync(SECRET, "bizcor-salt", 32);
  const cipher = crypto.createCipheriv("aes-256-cbc", key, iv);
  let enc = cipher.update(text, "utf8", "hex");
  enc += cipher.final("hex");
  return iv.toString("hex") + ":" + enc;
}

function decrypt(text) {
  const [ivHex, enc] = text.split(":");
  const iv = Buffer.from(ivHex, "hex");
  const key = crypto.scryptSync(SECRET, "bizcor-salt", 32);
  const decipher = crypto.createDecipheriv("aes-256-cbc", key, iv);
  let dec = decipher.update(enc, "hex", "utf8");
  dec += decipher.final("utf8");
  return dec;
}

function saveCloudUrl(dbUrl) {
  const file = CONFIG_FILE();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, encrypt(JSON.stringify({ dbUrl })), "utf8");
}

function loadCloudUrl() {
  const file = CONFIG_FILE();
  try {
    if (!fs.existsSync(file)) return null;
    const raw = fs.readFileSync(file, "utf8");
    const data = JSON.parse(decrypt(raw));
    return data.dbUrl || null;
  } catch (_) { return null; }
}

function clearCloudUrl() {
  const file = CONFIG_FILE();
  try { if (fs.existsSync(file)) fs.unlinkSync(file); } catch (_) {}
}

function isCloudConfigured() { return !!loadCloudUrl(); }
const saveDbUrl = saveCloudUrl;
const loadDbUrl = loadCloudUrl;
const isConfigured = () => true;

// ─── Node Binary ─────────────────────────────────────────────────────────────

function getNodeBin(resourcesPath) {
  if (process.platform === "win32") {
    const bundled = path.join(resourcesPath, "server-bundle", "node.exe");
    if (fs.existsSync(bundled)) {
      writeLog("[node] Using bundled node.exe: " + bundled);
      return bundled;
    }
    writeLog("[node] WARNING: bundled node.exe not found at " + bundled);
  }
  writeLog("[node] Falling back to Electron runtime: " + process.execPath);
  return process.execPath;
}

// ─── Server Start ─────────────────────────────────────────────────────────────

async function startServer(options, resourcesPath) {
  const { cloudUrl, sqlitePath } = options;

  openLog();
  writeLog("[start] resourcesPath: " + resourcesPath);
  writeLog("[start] cloudUrl: " + (cloudUrl ? "set" : "none"));
  writeLog("[start] sqlitePath: " + (sqlitePath || "none"));

  let serverBundle = path.join(resourcesPath, "server-bundle", "index.mjs");
  if (!fs.existsSync(serverBundle)) {
    serverBundle = path.join(resourcesPath, "server-bundle", "index.js");
  }

  writeLog("[start] bundle: " + serverBundle + " exists=" + fs.existsSync(serverBundle));

  if (!fs.existsSync(serverBundle)) {
    throw new Error("Server bundle not found.\nLooked at: " + serverBundle);
  }

  setStatus("starting");
  setProgress(10, "Starting server...", "Loading application files");

  const nodeBin = getNodeBin(resourcesPath);
  const nodeModulesInBundle = path.join(resourcesPath, "server-bundle", "node_modules");

  writeLog("[start] node_modules exists: " + fs.existsSync(nodeModulesInBundle));

  // Check better-sqlite3 exists
  const sqliteNative = path.join(nodeModulesInBundle, "better-sqlite3");
  writeLog("[start] better-sqlite3 exists: " + fs.existsSync(sqliteNative));

  const env = {
    ...process.env,
    PORT: String(SERVER_PORT),
    NODE_ENV: "production",
    DESKTOP_MODE: "true",
    FRONTEND_PATH: path.join(resourcesPath, "frontend-dist"),
    SESSION_SECRET: "BizCorDesktop2025!SecretKey#LAN",
    CORS_ORIGIN: "",
    NODE_PATH: nodeModulesInBundle,
    EXE_VERSION: app.getVersion(),
  };

  if (cloudUrl) {
    env.DATABASE_URL = cloudUrl;
    delete env.SQLITE_PATH;
    delete env.PGLITE_PATH;
  } else {
    env.SQLITE_PATH = sqlitePath;
    delete env.DATABASE_URL;
    delete env.SUPABASE_DATABASE_URL;
    delete env.PGLITE_PATH;
  }

  writeLog("[start] Spawning: " + path.basename(nodeBin));
  writeLog("[start] SQLITE_PATH: " + (env.SQLITE_PATH || ""));

  const outputLines = [];
  const pushLine = (prefix, line) => {
    const entry = `[${prefix}] ${line}`;
    writeLog(entry);
    outputLines.push(entry);
    if (outputLines.length > 100) outputLines.shift();
  };

  serverProcess = spawn(nodeBin, [serverBundle], {
    env,
    stdio: ["ignore", "pipe", "pipe"],
  });

  writeLog("[start] PID: " + (serverProcess.pid || "failed"));

  serverProcess.stdout.on("data", d => {
    d.toString().split("\n").filter(Boolean).forEach(line => {
      pushLine("stdout", line);
      if (line.includes("sqlite") || line.includes("SQLite") || line.includes("database")) {
        setProgress(40, "Initializing local database...", line.substring(0, 80));
      } else if (line.includes("schema") || line.includes("table") || line.includes("migrat")) {
        setProgress(65, "Setting up tables...", line.substring(0, 80));
      } else if (line.includes("listen") || line.includes("port") || line.includes("ready") || line.includes("started")) {
        setProgress(85, "Almost ready...", "Server is binding to port");
      }
    });
  });

  serverProcess.stderr.on("data", d => {
    d.toString().split("\n").filter(Boolean).forEach(line => pushLine("stderr", line));
  });

  serverProcess.on("exit", (code, signal) => {
    pushLine("process", `exited — code=${code} signal=${signal}`);
    if (_status !== "stopped") setStatus("stopped");
  });

  serverProcess.on("error", err => {
    pushLine("process", "spawn error: " + err.message);
    setStatus("error");
  });

  setProgress(30, "Initializing database...", "Setting up local SQLite database");

  const TIMEOUT_MS = 60000;
  await new Promise((resolve, reject) => {
    const http = require("http");
    const start = Date.now();
    let attempt = 0;

    const check = () => {
      attempt++;
      const elapsed = Math.round((Date.now() - start) / 1000);

      if (attempt % 5 === 0) {
        setProgress(
          Math.min(30 + attempt * 2, 80),
          "Waiting for server...",
          `${elapsed}s elapsed`
        );
      }

      http.get(`http://localhost:${SERVER_PORT}/api/health`, res => {
        if (res.statusCode < 500) {
          writeLog("[health] OK at attempt " + attempt);
          setProgress(95, "Almost done...", "");
          resolve();
        } else {
          setTimeout(check, 1000);
        }
      }).on("error", () => {
        if (Date.now() - start > TIMEOUT_MS) {
          const lastOutput = outputLines.slice(-15).join("\n") || "(no output)";
          const logPath = getLogPath();
          reject(new Error(
            `Server did not respond after ${TIMEOUT_MS / 1000}s.\n\n` +
            `Runtime: ${path.basename(nodeBin)}\n` +
            `SQLite: ${fs.existsSync(sqliteNative) ? "found" : "MISSING"}\n\n` +
            `Last output:\n${lastOutput}\n\n` +
            `Full log: ${logPath}`
          ));
        } else {
          setTimeout(check, 1000);
        }
      });
    };
    check();
  });

  setProgress(100, "Ready!", "");
  setStatus("running");
  // Log stream stays open so runtime errors and request traces are captured
}

// ─── Public API ───────────────────────────────────────────────────────────────

async function start(resourcesPath) {
  const sqlitePath = path.join(app.getPath("userData"), "bizcor-db");
  fs.mkdirSync(sqlitePath, { recursive: true });

  try {
    await startServer({ sqlitePath }, resourcesPath);
  } catch (err) {
    _lastError = err.message;
    writeLog("[ERROR] " + err.message);
    setStatus("error");
  }
}

async function startWithCloudUrl(cloudUrl, resourcesPath) {
  saveCloudUrl(cloudUrl);
  await startServer({ cloudUrl }, resourcesPath);
}

async function startWithUrl(dbUrl, resourcesPath) {
  return startWithCloudUrl(dbUrl, resourcesPath);
}

async function stop() {
  if (serverProcess) {
    serverProcess.kill("SIGTERM");
    serverProcess = null;
  }
  closeLog();
  setStatus("stopped");
}

module.exports = {
  start, startWithUrl, startWithCloudUrl, stop,
  getStatus, getLastError, onStatusChange, onProgress, getServerPort,
  isConfigured, isCloudConfigured, getLogPath,
  loadDbUrl, loadCloudUrl, saveCloudUrl, clearCloudUrl,
};
