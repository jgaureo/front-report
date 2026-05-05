// Read-only Postgres pool for the `rates` prod DB.
//
// THREE LAYERS of read-only enforcement:
//   1. Server-side: `default_transaction_read_only=on` set as a connection
//      option, so Postgres itself rejects any INSERT/UPDATE/DELETE/DDL with
//      `ERROR: cannot execute ... in a read-only transaction`.
//   2. Application-side: every call goes through `readOnlyQuery()`, which
//      rejects any SQL not starting with SELECT or WITH (case-insensitive,
//      after stripping leading whitespace and `/* */` block comments).
//   3. Pool config: short statement_timeout to bound runaway queries.
//
// Do NOT export the raw pool. Do NOT add a generic `query()` helper that
// bypasses the SELECT-only guard.

import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const {
  PROD_POSTGRES_DB,
  PROD_POSTGRES_HOST,
  PROD_POSTGRES_PORT,
  PROD_POSTGRES_USER,
  PROD_POSTGRES_PASSWORD,
} = process.env;

const missing = ['PROD_POSTGRES_DB','PROD_POSTGRES_HOST','PROD_POSTGRES_PORT','PROD_POSTGRES_USER','PROD_POSTGRES_PASSWORD']
  .filter(k => !process.env[k]);
if (missing.length) {
  console.warn(`[postgres] Missing env vars: ${missing.join(', ')} — pool not initialized.`);
}

const pool = missing.length ? null : new pg.Pool({
  database: PROD_POSTGRES_DB,
  host:     PROD_POSTGRES_HOST,
  port:     Number(PROD_POSTGRES_PORT),
  user:     PROD_POSTGRES_USER,
  password: PROD_POSTGRES_PASSWORD,
  ssl: { rejectUnauthorized: false },
  // Server-level guard: every connection enters read-only mode.
  options: '-c default_transaction_read_only=on',
  max: 5,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
  statement_timeout: 30_000,
});

if (pool) {
  pool.on('error', (err) => console.error('[postgres] idle client error:', err.message));
}

// Strip leading whitespace and /* ... */ block comments, then verify the
// statement begins with SELECT or WITH. Everything else is rejected.
function isReadOnlySql(sql) {
  const stripped = String(sql)
    .replace(/^\s*\/\*[\s\S]*?\*\/\s*/g, '')
    .replace(/^\s*--[^\n]*\n/g, '')
    .trimStart();
  return /^(select|with)\b/i.test(stripped);
}

export async function readOnlyQuery(sql, params = []) {
  if (!pool) throw new Error('[postgres] pool not initialized — check .env');
  if (!isReadOnlySql(sql)) {
    throw new Error('[postgres] read-only guard: only SELECT / WITH statements are permitted');
  }
  return pool.query(sql, params);
}

export function isPostgresAvailable() {
  return pool !== null;
}
