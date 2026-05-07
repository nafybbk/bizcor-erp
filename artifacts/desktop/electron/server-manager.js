"use strict";

const { fork } = require("child_process");
const path = require("path");
const EmbeddedPostgres = require("embedded-postgres");

const SERVER_PORT = process.env.BIZCOR_PORT || 3737;
const PG_PORT = 5737;
const PG_USER = "bizcor";
const PG_DB = "bizcor_erp";

let pg = null;
let serverProcess = null;
let _status = "stopped";
let _onStatusChange = null;

function setStatus(s) {
  _status = s;
  if (_onStatusChange) _onStatusChange(s);
}

function onStatusChange(fn) {
  _onStatusChange = fn;
}

function getStatus() {
  return _status;
}

function getServerPort() {
  return SERVER_PORT;
}

async function startPostgres(dataDir) {
  pg = new EmbeddedPostgres({
    databaseDir: dataDir,
    user: PG_USER,
    password: "bizcor_pg_pass",
    port: PG_PORT,
    persistent: true,
  });

  setStatus("starting-db");
  await pg.initialise();
  await pg.start();

  try {
    await pg.createDatabase(PG_DB);
  } catch (_) {}

  return `postgresql://${PG_USER}:bizcor_pg_pass@localhost:${PG_PORT}/${PG_DB}`;
}

async function startServer(databaseUrl, resourcesPath) {
  const serverBundle = path.join(resourcesPath, "server-bundle", "index.js");

  setStatus("starting-server");

  serverProcess = fork(serverBundle, [], {
    env: {
      ...process.env,
      PORT: String(SERVER_PORT),
      DATABASE_URL: databaseUrl,
      NODE_ENV: "production",
      DESKTOP_MODE: "true",
      FRONTEND_PATH: path.join(resourcesPath, "frontend-dist"),
      SESSION_SECRET: "BizCorDesktop2025!SecretKey#LAN",
    },
    silent: false,
  });

  serverProcess.on("message", (msg) => {
    if (msg === "ready") setStatus("running");
  });

  serverProcess.on("exit", (code) => {
    setStatus("stopped");
  });

  serverProcess.on("error", (err) => {
    console.error("Server process error:", err);
    setStatus("error");
  });

  await new Promise((resolve) => setTimeout(resolve, 3000));
  setStatus("running");
}

async function start(dataDir, resourcesPath) {
  try {
    const dbUrl = await startPostgres(dataDir);
    await startServer(dbUrl, resourcesPath);
  } catch (err) {
    console.error("Failed to start services:", err);
    setStatus("error");
    throw err;
  }
}

async function stop() {
  if (serverProcess) {
    serverProcess.kill("SIGTERM");
    serverProcess = null;
  }
  if (pg) {
    await pg.stop();
    pg = null;
  }
  setStatus("stopped");
}

module.exports = { start, stop, getStatus, onStatusChange, getServerPort };
