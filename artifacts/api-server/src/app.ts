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
app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    const isNaewtgroup = /^https?:\/\/([a-z0-9-]+\.)?naewtgroup\.com$/.test(origin);
    if (isNaewtgroup || configOrigins.length === 0 || configOrigins.includes(origin)) {
      return callback(null, origin);
    }
    return callback(new Error("Not allowed by CORS"));
  },
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

// DESKTOP_MODE: serve built ERP frontend as static files
if (process.env.DESKTOP_MODE === "true") {
  const frontendPath = process.env.FRONTEND_PATH || path.join(__dirname, "../../frontend-dist");

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
