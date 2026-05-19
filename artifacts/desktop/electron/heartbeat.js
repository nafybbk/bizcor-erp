"use strict";

/**
 * Heartbeat module — weekly cloud license check
 *
 * Phases:
 *   ok       — last successful check < 30 days ago
 *   warning  — 30–60 days since last successful check (show warning)
 *   critical — 60+ days since last successful check (show strong warning)
 *
 * Cloud response statuses:
 *   active   — license valid
 *   warning  — license expiring soon (≤30 days left)
 *   expired  — license expired
 *   trial    — trial active
 *   error    — server error
 */

const fs = require("fs");
const path = require("path");
const https = require("https");
const http = require("http");
const os = require("os");
const { app } = require("electron");

const CLOUD_URL = "https://bizcor.vercel.app/api/heartbeat";
const CHECK_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const WARNING_THRESHOLD_DAYS = 30;   // show warning after 30 days no cloud contact
const CRITICAL_THRESHOLD_DAYS = 60;  // show critical after 60 days no cloud contact

let _stateFile = null;
let _checkTimer = null;
let _onWarning = null; // callback(phase, message)

function stateFilePath() {
  if (!_stateFile) {
    _stateFile = path.join(app.getPath("userData"), "heartbeat.json");
  }
  return _stateFile;
}

function loadState() {
  try {
    if (fs.existsSync(stateFilePath())) {
      return JSON.parse(fs.readFileSync(stateFilePath(), "utf8"));
    }
  } catch (_) {}
  return { lastSuccessAt: null, lastCloudStatus: null, lastCloudMessage: null, businessCode: null };
}

function saveState(state) {
  try {
    fs.writeFileSync(stateFilePath(), JSON.stringify(state, null, 2), "utf8");
  } catch (_) {}
}

function getMachineId() {
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const iface of nets[name] || []) {
      if (!iface.internal && iface.mac && iface.mac !== "00:00:00:00:00:00") {
        return iface.mac.replace(/:/g, "").toUpperCase();
      }
    }
  }
  return os.hostname().slice(0, 12).toUpperCase();
}

/** Ping cloud, returns { ok, status, message, daysLeft } */
function pingCloud(businessCode) {
  return new Promise((resolve) => {
    const body = JSON.stringify({
      businessCode,
      machineId: getMachineId(),
      appVersion: app.getVersion ? app.getVersion() : "1.0.0",
    });

    const isHttps = CLOUD_URL.startsWith("https");
    const urlObj = new URL(CLOUD_URL);
    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port || (isHttps ? 443 : 80),
      path: urlObj.pathname,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(body),
      },
      timeout: 15000,
    };

    const req = (isHttps ? https : http).request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => { data += chunk; });
      res.on("end", () => {
        try {
          const json = JSON.parse(data);
          resolve({ ok: true, ...json });
        } catch {
          resolve({ ok: false, status: "error", message: "Parse error" });
        }
      });
    });

    req.on("timeout", () => { req.destroy(); resolve({ ok: false, status: "error", message: "Timeout" }); });
    req.on("error", (e) => resolve({ ok: false, status: "error", message: e.message }));

    req.write(body);
    req.end();
  });
}

/** Compute local phase based on days since last successful heartbeat */
function computeLocalPhase(state) {
  if (!state.lastSuccessAt) {
    return { phase: "unknown", daysSince: null };
  }
  const daysSince = Math.floor((Date.now() - new Date(state.lastSuccessAt).getTime()) / 86400000);
  let phase = "ok";
  if (daysSince >= CRITICAL_THRESHOLD_DAYS) phase = "critical";
  else if (daysSince >= WARNING_THRESHOLD_DAYS) phase = "warning";
  return { phase, daysSince };
}

/**
 * Run a single heartbeat check.
 * businessCode: pass from local SQLite (fetched via IPC or passed from activation).
 */
async function runCheck(businessCode) {
  if (!businessCode) return;

  const state = loadState();
  state.businessCode = businessCode;

  const result = await pingCloud(businessCode);

  if (result.ok && result.status !== "error") {
    // Successful cloud contact
    state.lastSuccessAt = new Date().toISOString();
    state.lastCloudStatus = result.status;
    state.lastCloudMessage = result.message;
    saveState(state);

    // Cloud says expired → notify immediately
    if (result.status === "expired" && _onWarning) {
      _onWarning("expired", result.message || "License expired. Please renew.");
    } else if (result.status === "warning" && _onWarning) {
      _onWarning("cloud-warning", result.message || "License expiring soon.");
    }
  } else {
    // Cloud unreachable — use local phase
    saveState(state);
    const { phase, daysSince } = computeLocalPhase(state);
    if ((phase === "warning" || phase === "critical") && _onWarning) {
      const msg = phase === "critical"
        ? `BizCor ${daysSince} din se cloud se connect nahi hua. License verify karo.`
        : `BizCor ${daysSince} din se cloud se connect nahi hua. Internet check karo.`;
      _onWarning(phase, msg);
    }
  }
}

/** Call from main.js to get current heartbeat status for display */
function getStatus() {
  const state = loadState();
  const { phase, daysSince } = computeLocalPhase(state);
  return {
    lastSuccessAt: state.lastSuccessAt,
    lastCloudStatus: state.lastCloudStatus,
    lastCloudMessage: state.lastCloudMessage,
    localPhase: phase,
    daysSinceSuccess: daysSince,
    businessCode: state.businessCode,
  };
}

/**
 * Start weekly heartbeat scheduler.
 * businessCode: the activated business code stored locally.
 * onWarning: callback(phase, message) called when warning/critical.
 */
function start(businessCode, onWarning) {
  if (_checkTimer) clearInterval(_checkTimer);
  _onWarning = onWarning || null;

  // Run immediately on startup
  runCheck(businessCode).catch(() => {});

  // Then every 7 days
  _checkTimer = setInterval(() => {
    runCheck(businessCode).catch(() => {});
  }, CHECK_INTERVAL_MS);

  // Unref so it doesn't keep Node alive
  if (_checkTimer.unref) _checkTimer.unref();
}

function stop() {
  if (_checkTimer) { clearInterval(_checkTimer); _checkTimer = null; }
}

/** Update business code (e.g., after new activation) */
function updateBusinessCode(businessCode) {
  const state = loadState();
  state.businessCode = businessCode;
  saveState(state);
  runCheck(businessCode).catch(() => {});
}

module.exports = { start, stop, runCheck, getStatus, updateBusinessCode, getMachineId };
