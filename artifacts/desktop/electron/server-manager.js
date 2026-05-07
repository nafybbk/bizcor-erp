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
let _onStatusChange = null;

function setStatus(s) {
  _status = s;
  if (_onStatusChange) _onStatusChange(s);
}

function onStatusChange(fn) { _onStatusChange = fn; }
function getStatus() { return _status; }
function getServerPort() { return SERVER_PORT; }

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

function saveDbUrl(dbUrl) {
  const file = CONFIG_FILE();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, encrypt(JSON.stringify({ dbUrl })), "utf8");
}

function loadDbUrl() {
  const file = CONFIG_FILE();
  try {
    if (!fs.existsSync(file)) return null;
    const raw = fs.readFileSync(file, "utf8");
    const data = JSON.parse(decrypt(raw));
    return data.dbUrl || null;
  } catch (_) { return null; }
}

function isConfigured() {
  return !!loadDbUrl();
}

async function startServer(databaseUrl, resourcesPath) {
  // API server builds as index.mjs (ESM), fallback to index.js for older builds
  let serverBundle = path.join(resourcesPath, "server-bundle", "index.mjs");
  if (!fs.existsSync(serverBundle)) {
    serverBundle = path.join(resourcesPath, "server-bundle", "index.js");
  }

  if (!fs.existsSync(serverBundle)) {
    throw new Error("Server bundle not found at: " + serverBundle);
  }

  setStatus("starting");

  // Use node path from process (works in Electron's bundled Node)
  const nodeBin = process.execPath;

  serverProcess = spawn(nodeBin, [serverBundle], {
    env: {
      ...process.env,
      PORT: String(SERVER_PORT),
      DATABASE_URL: databaseUrl,
      NODE_ENV: "production",
      DESKTOP_MODE: "true",
      FRONTEND_PATH: path.join(resourcesPath, "frontend-dist"),
      SESSION_SECRET: "BizCorDesktop2025!SecretKey#LAN",
      CORS_ORIGIN: "",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  serverProcess.stdout.on("data", d => console.log("[server]", d.toString().trim()));
  serverProcess.stderr.on("data", d => console.error("[server-err]", d.toString().trim()));
  serverProcess.on("exit", code => {
    console.log("[server] exited with code", code);
    setStatus("stopped");
  });
  serverProcess.on("error", err => {
    console.error("[server] spawn error", err);
    setStatus("error");
  });

  // Wait up to 8 seconds for server to be ready
  await new Promise((resolve, reject) => {
    let ready = false;
    const http = require("http");
    const start = Date.now();
    const check = () => {
      http.get(`http://localhost:${SERVER_PORT}/api/health`, res => {
        if (res.statusCode < 500) { ready = true; resolve(); }
        else setTimeout(check, 800);
      }).on("error", () => {
        if (Date.now() - start > 12000) reject(new Error("Server timeout — 12s ke andar ready nahi hua"));
        else setTimeout(check, 800);
      });
    };
    check();
  });

  setStatus("running");
}

async function start(resourcesPath) {
  const dbUrl = loadDbUrl();
  if (!dbUrl) {
    setStatus("needs-setup");
    return;
  }
  try {
    await startServer(dbUrl, resourcesPath);
  } catch (err) {
    console.error("Server start failed:", err);
    setStatus("error");
  }
}

async function startWithUrl(dbUrl, resourcesPath) {
  saveDbUrl(dbUrl);
  await startServer(dbUrl, resourcesPath);
}

async function stop() {
  if (serverProcess) {
    serverProcess.kill("SIGTERM");
    serverProcess = null;
  }
  setStatus("stopped");
}

module.exports = { start, startWithUrl, stop, getStatus, onStatusChange, getServerPort, isConfigured, loadDbUrl };
