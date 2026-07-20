import express, { type Express } from "express";
import cors from "cors";
import path from "path";
import { createReadStream, existsSync } from "fs";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
const configOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(",").map(o => o.trim())
  : [];

// Always allow all naewtgroup.com subdomains + any explicitly configured origins
// + localhost (the desktop EXE's own bundled server, which talks to this cloud
// API directly for cloud-only features like Gallery — see routes/gallery.ts).
app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    const isNaewtgroup = /^https?:\/\/([a-z0-9-]+\.)?naewtgroup\.com$/.test(origin);
    const isLocalhost = /^http:\/\/localhost(:\d+)?$/.test(origin);
    if (isNaewtgroup || isLocalhost || configOrigins.length === 0 || configOrigins.includes(origin)) {
      return callback(null, origin);
    }
    return callback(null, false);
  },
  credentials: true,
}));
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

app.use("/api", router);

// DESKTOP_MODE: serve built ERP frontend as static files
if (process.env.DESKTOP_MODE === "true") {
  const frontendPath = process.env.FRONTEND_PATH || path.join(__dirname, "../../frontend-dist");

  // Print-auth: sets localStorage token then redirects to invoice (same-origin, no requireAuth)
  app.get("/print-auth", (req, res) => {
    const { token, to } = req.query as { token?: string; to?: string };
    if (!token || !to) { res.status(400).send("Bad request"); return; }
    const safeRedirect = String(to).startsWith("http://localhost") ? String(to) : "/";
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(`<!DOCTYPE html><html><head><meta charset="utf-8">
<title>Loading...</title></head><body>
<script>
try{localStorage.setItem('erp_token',${JSON.stringify(String(token))});}catch(e){}
location.replace(${JSON.stringify(safeRedirect)});
</script>
<p style="font-family:sans-serif;padding:20px">Invoice load ho raha hai...</p>
</body></html>`);
  });

  if (existsSync(frontendPath)) {
    app.use(express.static(frontendPath));
    app.get("/{*splat}", (_req, res) => {
      const indexFile = path.join(frontendPath, "index.html");
      if (existsSync(indexFile)) {
        res.sendFile(indexFile);
      } else {
        res.status(404).send("Frontend not found");
      }
    });
    logger.info({ frontendPath }, "Serving static frontend in DESKTOP_MODE");
  } else {
    logger.warn({ frontendPath }, "DESKTOP_MODE enabled but frontend-dist not found");
  }
}

export default app;
