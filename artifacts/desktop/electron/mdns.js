"use strict";

/**
 * mDNS advertiser — broadcasts "bizcor.local" on the local network
 * so other devices can connect without knowing the IP address.
 *
 * Works on:
 *   - Windows 10/11 — Chrome, Edge, Firefox support mDNS natively
 *   - macOS — built-in Bonjour
 *   - Linux — avahi or systemd-resolved
 *
 * Client devices open: http://bizcor.local:<port>
 */

let _bonjour = null;
let _service = null;

function start(port) {
  try {
    const { Bonjour } = require("bonjour-service");
    _bonjour = new Bonjour();

    _service = _bonjour.publish({
      name: "BizCor ERP",
      type: "http",
      port: port,
      host: "bizcor.local",
      txt: { path: "/", app: "BizCor ERP" },
    });

    _service.on("up", () => {
      console.log(`[mdns] bizcor.local:${port} advertised on LAN`);
    });

    _service.on("error", (err) => {
      console.log("[mdns] advertise error:", err.message);
    });

  } catch (err) {
    console.log("[mdns] bonjour-service not available:", err.message);
  }
}

function stop() {
  try {
    if (_service) { _service.stop(); _service = null; }
    if (_bonjour) { _bonjour.destroy(); _bonjour = null; }
  } catch (_) {}
}

module.exports = { start, stop };
