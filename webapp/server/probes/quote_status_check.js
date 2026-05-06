// Confirm quotes_quote.status column shape and value distribution before
// switching the Need to Onboard Revenue endpoint to use it.
//
// Usage: node probes/quote_status_check.js

import { readOnlyQuery } from '../db/postgres.js';

async function pg(label, sql, params = []) {
  console.log(`\n── ${label} ──`);
  try {
    const { rows } = await readOnlyQuery(sql, params);
    if (!rows.length) { console.log('  (no rows)'); return; }
    console.table(rows);
  } catch (e) { console.error('  ERROR:', e.message); }
}

try {
  await pg(
    'A: quotes_quote.status column shape',
    `SELECT column_name, data_type, is_nullable
     FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = 'quotes_quote'
       AND column_name = 'status'`
  );

  await pg(
    'B: distinct status values + count (all-time)',
    `SELECT status, COUNT(*) AS n
     FROM quotes_quote
     GROUP BY status
     ORDER BY n DESC`
  );

  await pg(
    'C: status distribution for quotes with a QRN (last 90 days)',
    `SELECT status, COUNT(*) AS n
     FROM quotes_quote
     WHERE qrn IS NOT NULL
       AND created_at >= NOW() - INTERVAL '90 days'
     GROUP BY status
     ORDER BY n DESC`
  );

  await pg(
    'D: per-QRN latest-quote status (last 90 days, distinct on qrn)',
    `WITH latest AS (
       SELECT DISTINCT ON (q.qrn) q.qrn, q.status, q.created_at
       FROM quotes_quote q
       WHERE q.qrn IS NOT NULL
         AND q.created_at >= NOW() - INTERVAL '90 days'
       ORDER BY q.qrn, q.created_at DESC
     )
     SELECT status, COUNT(*) AS n
     FROM latest
     GROUP BY status
     ORDER BY n DESC`
  );

  console.log('\nDone.');
  process.exit(0);
} catch (err) {
  console.error('\nProbe failed:', err.message);
  process.exit(1);
}
