import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

/**
 * SILEX 2.0 Server-Side Drizzle ORM Singleton Instance.
 *
 * CRITICAL SECURITY & ARCHITECTURE RULES:
 * 1. This database handle must ONLY be imported and executed in server-side code (TanStack Start server functions).
 * 2. It must NEVER be imported into client-side React components or browser-bundled files.
 * 3. `DATABASE_URL` must remain in server-side environment variables and NEVER exposed via VITE_* prefix.
 */

const globalForDb = globalThis as unknown as {
  conn: postgres.Sql | undefined;
  db: PostgresJsDatabase<typeof schema> | undefined;
};

function getDatabaseUrl(): string {
  if (typeof window !== "undefined") {
    throw new Error(
      "[SILEX Security Guard] Database client initialized in client browser context. Database access is strictly restricted to server functions.",
    );
  }

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    if (process.env.NODE_ENV === "development") {
      console.warn(
        "[SILEX DB Warning] DATABASE_URL environment variable is not defined. Server queries will fail until DATABASE_URL is set.",
      );
    }
    return "";
  }

  return connectionString;
}

function createDbClient(): PostgresJsDatabase<typeof schema> | null {
  const url = getDatabaseUrl();
  if (!url) return null;

  if (!globalForDb.conn) {
    // Disable prepared statements for connection poolers (e.g., Supabase Transaction Pooler / PgBouncer)
    globalForDb.conn = postgres(url, { prepare: false });
    globalForDb.db = drizzle(globalForDb.conn, { schema });
  }

  return globalForDb.db!;
}

/**
 * Primary server-side Drizzle ORM database client.
 * Returns null if DATABASE_URL is unconfigured.
 */
export const db = createDbClient();
export { schema };
