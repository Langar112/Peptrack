/**
 * Idempotent SQL migrations that run at server startup.
 *
 * Each statement must be safe to run multiple times against a database that
 * may already be fully or partially migrated. Use IF EXISTS / IF NOT EXISTS
 * guards, or rely on PostgreSQL's no-op behaviour for operations that are
 * already satisfied (e.g. DROP NOT NULL on a column that is already nullable).
 *
 * Migrations are applied in order; add new ones at the bottom.
 */

import { pool } from "@workspace/db";
import { logger } from "./logger.js";

const migrations: { name: string; sql: string }[] = [
  // Task #18 – anonymous sessions: users.email and users.password_hash were
  // originally NOT NULL. The Drizzle schema was updated to nullable but the
  // deployed database retains the old constraints until this runs.
  {
    name: "users.email nullable",
    sql: "ALTER TABLE users ALTER COLUMN email DROP NOT NULL",
  },
  {
    name: "users.password_hash nullable",
    sql: "ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL",
  },
];

export async function runStartupMigrations(): Promise<void> {
  const client = await pool.connect();
  try {
    for (const migration of migrations) {
      try {
        await client.query(migration.sql);
        logger.info({ migration: migration.name }, "startup migration applied");
      } catch (err: unknown) {
        // PostgreSQL raises 0A000 (feature_not_supported) or 42601 when the
        // ALTER is a no-op that the driver surfaces as an error in some builds.
        // Any error here means the migration failed in an unexpected way.
        const pg = err as { code?: string; message?: string };
        // "column has no not-null constraint" → already nullable, treat as OK
        if (pg.message?.includes("has no not-null constraint")) {
          logger.debug(
            { migration: migration.name },
            "startup migration already applied – skipping",
          );
        } else {
          logger.error(
            { err, migration: migration.name },
            "startup migration failed",
          );
          throw err;
        }
      }
    }
  } finally {
    client.release();
  }
}
