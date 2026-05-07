import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

const connectionString = process.env.SUPABASE_DATABASE_URL || process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

const sslDisabled = process.env.DB_SSL === "false";
const sslForced = process.env.DB_SSL === "true";
const isSupabase = /supabase\.(com|co)/.test(connectionString) || connectionString.includes("pooler.supabase");
const isNeon = connectionString.includes("neon.tech");
const isProduction = process.env.NODE_ENV === "production";

const useSSL = !sslDisabled && (sslForced || isSupabase || isNeon || isProduction);

export const pool = new Pool({
  connectionString,
  ssl: useSSL ? { rejectUnauthorized: false } : false,
});
export const db = drizzle(pool, { schema });

export * from "./schema";
