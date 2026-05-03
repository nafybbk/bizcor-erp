import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

const sslDisabled = process.env.DB_SSL === "false";
const sslForced = process.env.DB_SSL === "true";
const isSupabase = /supabase\.(com|co)/.test(process.env.DATABASE_URL) || process.env.DATABASE_URL.includes("pooler.supabase");
const isProduction = process.env.NODE_ENV === "production";

const useSSL = !sslDisabled && (sslForced || isSupabase || isProduction);

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: useSSL ? { rejectUnauthorized: false } : false,
});
export const db = drizzle(pool, { schema });

export * from "./schema";
