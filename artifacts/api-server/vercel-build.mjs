import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build as esbuild } from "esbuild";
import { rm, mkdir } from "node:fs/promises";

globalThis.require = createRequire(import.meta.url);

const artifactDir = path.dirname(fileURLToPath(import.meta.url));
const apiDir = path.resolve(artifactDir, "api");

await rm(apiDir, { recursive: true, force: true });
await mkdir(apiDir, { recursive: true });

console.log("Building Vercel serverless entry...");

await esbuild({
  entryPoints: [path.resolve(artifactDir, "src/vercel-entry.ts")],
  platform: "node",
  bundle: true,
  format: "esm",
  outfile: path.resolve(apiDir, "index.js"),
  logLevel: "info",
  sourcemap: false,
  // Externalize only native addons and packages that can't be bundled
  external: [
    "*.node",
    "sharp",
    "better-sqlite3",
    "sqlite3",
    "canvas",
    "bcrypt",
    "argon2",
    "fsevents",
    "re2",
    "pg-native",
    "oracledb",
    "@prisma/client",
    "@mikro-orm/*",
    "nodemailer",
    "puppeteer",
    "playwright",
    "electron",
  ],
  banner: {
    js: `import { createRequire as __bannerCrReq } from 'node:module';
import __bannerPath from 'node:path';
import __bannerUrl from 'node:url';
globalThis.require = __bannerCrReq(import.meta.url);
globalThis.__filename = __bannerUrl.fileURLToPath(import.meta.url);
globalThis.__dirname = __bannerPath.dirname(globalThis.__filename);
`,
  },
});

console.log("Vercel build complete → api/index.js");
