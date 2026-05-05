// One-off schema probe for the `rates` Postgres prod DB.
// SELECT-only — uses the read-only pool wrapper, so any non-SELECT is
// rejected at both the application and server layers.
//
// Usage:  node probes/postgres_schema_check.js
//
// Goals:
//   1. Find a users table that maps email → first/last name (so we can
//      resolve `quotes_quote.created_by_user_email` to a display name).
//   2. Confirm the actual column names on `quotes_quote` (qrn, bill_to_org_id,
//      created_by_user_email, etc.) so query-writing doesn't have to guess.
//   3. Confirm `quotes_customer` has a name column keyed on the org id.

import { readOnlyQuery } from '../db/postgres.js';

async function run(label, sql, params = []) {
  console.log(`\n── ${label} ──`);
  try {
    const { rows } = await readOnlyQuery(sql, params);
    if (!rows.length) { console.log('  (no rows)'); return rows; }
    console.table(rows);
    return rows;
  } catch (err) {
    console.error(`  ERROR: ${err.message}`);
    return [];
  }
}

try {
  // ─── PROBE 1: candidate user/auth tables in the public schema ───────────
  await run(
    'PROBE 1: tables matching user/auth/account/profile',
    `SELECT table_schema, table_name
     FROM information_schema.tables
     WHERE table_schema NOT IN ('pg_catalog','information_schema')
       AND (table_name ILIKE '%user%'
         OR table_name ILIKE '%auth%'
         OR table_name ILIKE '%account%'
         OR table_name ILIKE '%profile%'
         OR table_name ILIKE '%employee%')
     ORDER BY table_schema, table_name`
  );

  // ─── PROBE 2: columns on those candidate tables ─────────────────────────
  await run(
    'PROBE 2: columns on candidate user/auth tables',
    `SELECT table_name, column_name, data_type
     FROM information_schema.columns
     WHERE table_schema NOT IN ('pg_catalog','information_schema')
       AND (table_name ILIKE '%user%'
         OR table_name ILIKE '%auth%'
         OR table_name ILIKE '%account%'
         OR table_name ILIKE '%profile%'
         OR table_name ILIKE '%employee%')
     ORDER BY table_name, ordinal_position`
  );

  // ─── PROBE 3: columns on quotes_quote ───────────────────────────────────
  await run(
    'PROBE 3: columns on quotes_quote',
    `SELECT column_name, data_type, is_nullable
     FROM information_schema.columns
     WHERE table_name = 'quotes_quote'
     ORDER BY ordinal_position`
  );

  // ─── PROBE 4: sample row from quotes_quote (1 row, all columns) ─────────
  await run(
    'PROBE 4: sample row from quotes_quote',
    `SELECT * FROM quotes_quote
     WHERE qrn IS NOT NULL
     ORDER BY id DESC
     LIMIT 1`
  );

  // ─── PROBE 5: columns on quotes_customer ────────────────────────────────
  await run(
    'PROBE 5: columns on quotes_customer',
    `SELECT column_name, data_type
     FROM information_schema.columns
     WHERE table_name = 'quotes_customer'
     ORDER BY ordinal_position`
  );

  // ─── PROBE 6: columns on quotes_quotechargeline ─────────────────────────
  await run(
    'PROBE 6: columns on quotes_quotechargeline',
    `SELECT column_name, data_type
     FROM information_schema.columns
     WHERE table_name = 'quotes_quotechargeline'
     ORDER BY ordinal_position`
  );

  // ─── PROBE 7: columns on quotes_quotepricing ────────────────────────────
  await run(
    'PROBE 7: columns on quotes_quotepricing',
    `SELECT column_name, data_type
     FROM information_schema.columns
     WHERE table_name = 'quotes_quotepricing'
     ORDER BY ordinal_position`
  );

  console.log('\nDone.');
  process.exit(0);
} catch (err) {
  console.error('\nProbe failed:', err.message);
  process.exit(1);
}
