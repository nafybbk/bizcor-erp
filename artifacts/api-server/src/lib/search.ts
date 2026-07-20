import { sql, type SQL } from "drizzle-orm";

// Case-insensitive LIKE that works identically on Postgres and SQLite — the
// app runs on both (cloud vs desktop/LAN), and Postgres' ILIKE keyword isn't
// valid SQLite SQL, so this normalizes both sides through lower() instead of
// relying on either dialect's own (inconsistent) LIKE case-sensitivity.
export function ilike(column: unknown, value: string): SQL {
  return sql`lower(${column}) like lower(${`%${value}%`})`;
}
