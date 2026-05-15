import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build as esbuild } from "esbuild";
import esbuildPluginPino from "esbuild-plugin-pino";
import { rm, mkdir, writeFile } from "node:fs/promises";

globalThis.require = createRequire(import.meta.url);

const artifactDir = path.dirname(fileURLToPath(import.meta.url));
const apiDir = path.resolve(artifactDir, "api");
const publicDir = path.resolve(artifactDir, "public");

await rm(apiDir, { recursive: true, force: true });
await mkdir(apiDir, { recursive: true });

// Create public dir so Vercel doesn't complain about missing static output
await mkdir(publicDir, { recursive: true });
await writeFile(path.resolve(publicDir, ".gitkeep"), "");

console.log("Building Vercel serverless entry...");

// Plugin: stub native/desktop-only packages so Vercel never tries to load them
const stubPlugin = {
  name: "stub-native",
  setup(build) {
    const stubs = ["better-sqlite3", "sqlite3", "*.node"];
    for (const pkg of stubs) {
      const filter = pkg === "*.node"
        ? /\.node$/
        : new RegExp(`^${pkg.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`);
      build.onResolve({ filter }, (args) => ({
        path: args.path,
        namespace: "stub-ns",
      }));
    }
    build.onLoad({ filter: /.*/, namespace: "stub-ns" }, () => ({
      contents: "export default null; module.exports = null;",
      loader: "js",
    }));
  },
};

await esbuild({
  entryPoints: [path.resolve(artifactDir, "src/vercel-entry.ts")],
  platform: "node",
  bundle: true,
  format: "esm",
  outfile: path.resolve(apiDir, "index.js"),
  logLevel: "info",
  sourcemap: false,
  plugins: [stubPlugin, esbuildPluginPino({ transports: [] })],
  external: [
    "*.node",
    "sharp",
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
