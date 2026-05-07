"use strict";

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { app } = require("electron");

const SECRET = "BizCor2025SecretKey!@#";
const PHASE_SILENT = 1;   // 0-30 days
const PHASE_ALERT  = 2;   // 31-60 days
const PHASE_GRACE  = 3;   // 61-90 days
const PHASE_LOCKED = 4;   // 91+ days

const SILENT_DAYS = 30;
const ALERT_DAYS  = 30;
const GRACE_DAYS  = 30;

function getLicenseFile() {
  return path.join(app.getPath("userData"), "license.dat");
}

function encrypt(text) {
  const iv = crypto.randomBytes(16);
  const key = crypto.scryptSync(SECRET, "salt", 32);
  const cipher = crypto.createCipheriv("aes-256-cbc", key, iv);
  let enc = cipher.update(text, "utf8", "hex");
  enc += cipher.final("hex");
  return iv.toString("hex") + ":" + enc;
}

function decrypt(text) {
  const [ivHex, enc] = text.split(":");
  const iv = Buffer.from(ivHex, "hex");
  const key = crypto.scryptSync(SECRET, "salt", 32);
  const decipher = crypto.createDecipheriv("aes-256-cbc", key, iv);
  let dec = decipher.update(enc, "hex", "utf8");
  dec += decipher.final("utf8");
  return dec;
}

function getOrCreateFirstRun() {
  const file = getLicenseFile();
  try {
    if (fs.existsSync(file)) {
      const raw = fs.readFileSync(file, "utf8");
      const data = JSON.parse(decrypt(raw));
      if (data.firstRun) return new Date(data.firstRun);
    }
  } catch (_) {}

  const now = new Date();
  const data = { firstRun: now.toISOString() };
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, encrypt(JSON.stringify(data)), "utf8");
  return now;
}

function getTrialStatus() {
  const firstRun = getOrCreateFirstRun();
  const now = new Date();
  const daysSinceInstall = Math.floor((now - firstRun) / (1000 * 60 * 60 * 24));

  if (daysSinceInstall < SILENT_DAYS) {
    return {
      phase: PHASE_SILENT,
      daysElapsed: daysSinceInstall,
      daysLeft: SILENT_DAYS - daysSinceInstall,
      trialDaysLeft: SILENT_DAYS + ALERT_DAYS - daysSinceInstall,
      locked: false,
      showAlert: false,
      showBanner: false,
      showTawk: false,
      firstRun: firstRun.toISOString(),
    };
  } else if (daysSinceInstall < SILENT_DAYS + ALERT_DAYS) {
    const daysInPhase = daysSinceInstall - SILENT_DAYS;
    const daysLeftInPhase = ALERT_DAYS - daysInPhase;
    return {
      phase: PHASE_ALERT,
      daysElapsed: daysSinceInstall,
      daysLeft: daysLeftInPhase,
      trialDaysLeft: daysLeftInPhase,
      locked: false,
      showAlert: true,
      showBanner: false,
      showTawk: true,
      firstRun: firstRun.toISOString(),
    };
  } else if (daysSinceInstall < SILENT_DAYS + ALERT_DAYS + GRACE_DAYS) {
    const daysInPhase = daysSinceInstall - SILENT_DAYS - ALERT_DAYS;
    const daysLeftInPhase = GRACE_DAYS - daysInPhase;
    return {
      phase: PHASE_GRACE,
      daysElapsed: daysSinceInstall,
      daysLeft: daysLeftInPhase,
      trialDaysLeft: 0,
      locked: false,
      showAlert: true,
      showBanner: true,
      showTawk: true,
      firstRun: firstRun.toISOString(),
    };
  } else {
    return {
      phase: PHASE_LOCKED,
      daysElapsed: daysSinceInstall,
      daysLeft: 0,
      trialDaysLeft: 0,
      locked: true,
      showAlert: true,
      showBanner: true,
      showTawk: true,
      firstRun: firstRun.toISOString(),
    };
  }
}

module.exports = { getTrialStatus, PHASE_SILENT, PHASE_ALERT, PHASE_GRACE, PHASE_LOCKED };
