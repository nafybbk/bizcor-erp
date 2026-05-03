import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

const isSupabase = process.env.DATABASE_URL.includes("supabase.com") || process.env.DATABASE_URL.includes("pooler.supabase");
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DB_SSL === "false" ? false
    : (isSupabase || process.env.DB_SSL === "true") ? { rejectUnauthorized: false }
    : false,
});
export const db = drizzle(pool, { schema });

export * from "./schema";
