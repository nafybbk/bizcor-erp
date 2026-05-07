import * as schema from "./schema";

const pglitePath = process.env.PGLITE_PATH;
const connectionString = process.env.SUPABASE_DATABASE_URL || process.env.DATABASE_URL;

if (!pglitePath && !connectionString) {
  throw new Error("DATABASE_URL or PGLITE_PATH must be set.");
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let db: any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let pool: any = null;

if (pglitePath) {
  // Offline mode: PGlite (PostgreSQL in WASM — no internet, no setup needed)
  // pglite is not a pnpm dep — it's bundled separately in the EXE's node_modules
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-expect-error — pglite loaded at EXE runtime from server-bundle/node_modules
  const { PGlite } = await import("@electric-sql/pglite");
  const { drizzle } = await import("drizzle-orm/pglite");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = new (PGlite as any)(pglitePath);
  await client.waitReady;
  db = drizzle(client, { schema });
} else {
  // Cloud mode: real PostgreSQL (Supabase / Neon / etc)
  const { default: pg } = await import("pg");
  const { drizzle } = await import("drizzle-orm/node-postgres");
  const isSupabase = /supabase\.(com|co)/.test(connectionString!) || connectionString!.includes("pooler.supabase");
  const isNeon = connectionString!.includes("neon.tech");
  const sslDisabled = process.env.DB_SSL === "false";
  const sslForced = process.env.DB_SSL === "true";
  const useSSL = !sslDisabled && (sslForced || isSupabase || isNeon || process.env.NODE_ENV === "production");
  pool = new pg.Pool({
    connectionString: connectionString!,
    ssl: useSSL ? { rejectUnauthorized: false } : false,
  });
  db = drizzle(pool, { schema });
}

export { db, pool };
export * from "./schema";
