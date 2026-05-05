// Two follow-up probes:
//   A) BigQuery — schema of front.conversation_tag (does it have a timestamp
//      or sequence column we can use to determine the LATEST stage tag?).
//   B) Postgres — look for any table that maps the varchar org code
//      (e.g. 'LAKLEACRU') to a numeric customer id. If none, we'll just use
//      quotes_quote.bill_to_org_name directly.
//
// Usage: node probes/latest_tag_and_org_check.js

import { BigQuery } from '@google-cloud/bigquery';
import path from 'path';
import { fileURLToPath } from 'url';
import { readOnlyQuery } from '../db/postgres.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const bigquery = new BigQuery({
  keyFilename: path.resolve(__dirname, '../../../credentials.json'),
  projectId: 'possible-ace-317306',
});

async function bq(label, sql) {
  console.log(`\n── ${label} ──`);
  try { const [rows] = await bigquery.query({ query: sql });
    if (!rows.length) { console.log('  (no rows)'); return; }
    console.table(rows);
  } catch (e) { console.error('  ERROR:', e.message); }
}

async function pg(label, sql, params = []) {
  console.log(`\n── ${label} ──`);
  try { const { rows } = await readOnlyQuery(sql, params);
    if (!rows.length) { console.log('  (no rows)'); return; }
    console.table(rows);
  } catch (e) { console.error('  ERROR:', e.message); }
}

try {
  // ─── A: front.conversation_tag schema ───────────────────────────────────
  await bq(
    'BQ A: front.conversation_tag column schema',
    `SELECT column_name, data_type
     FROM \`possible-ace-317306.front.INFORMATION_SCHEMA.COLUMNS\`
     WHERE table_name = 'conversation_tag'
     ORDER BY ordinal_position`
  );

  // Sample a few rows to see what's actually there.
  await bq(
    'BQ A2: 5 sample conversation_tag rows',
    `SELECT * FROM \`possible-ace-317306.front.conversation_tag\` LIMIT 5`
  );

  // ─── B1: List all tables in public schema for finding customer-code lookup ─
  await pg(
    'PG B1: tables in public schema (search for customer/org/company)',
    `SELECT table_name
     FROM information_schema.tables
     WHERE table_schema = 'public'
       AND (table_name ILIKE '%customer%'
         OR table_name ILIKE '%organi%'
         OR table_name ILIKE '%company%'
         OR table_name ILIKE '%merchant%'
         OR table_name ILIKE '%client%')
     ORDER BY table_name`
  );

  // ─── B2: For each candidate, list columns ─────────────────────────────
  await pg(
    'PG B2: columns on customer/org candidate tables',
    `SELECT table_name, column_name, data_type
     FROM information_schema.columns
     WHERE table_schema = 'public'
       AND (table_name ILIKE '%customer%'
         OR table_name ILIKE '%organi%'
         OR table_name ILIKE '%company%'
         OR table_name ILIKE '%merchant%'
         OR table_name ILIKE '%client%')
     ORDER BY table_name, ordinal_position`
  );

  // ─── B3: Does any customer table have a varchar code column matching 'LAKLEACRU' style? ──
  // Try common column names.
  await pg(
    "PG B3: search for varchar 'code' or 'short' columns across the public schema",
    `SELECT table_name, column_name, data_type
     FROM information_schema.columns
     WHERE table_schema = 'public'
       AND data_type IN ('character varying','text')
       AND (column_name ILIKE '%code%'
         OR column_name ILIKE '%short%'
         OR column_name ILIKE '%abbrev%'
         OR column_name ILIKE '%external%id%'
         OR column_name ILIKE '%cw_%'
         OR column_name ILIKE '%cargowise%')
     ORDER BY table_name, column_name
     LIMIT 50`
  );

  // ─── B4: How does quotes_customer connect to org codes? (sample rows) ─
  await pg(
    'PG B4: 5 sample quotes_customer rows',
    `SELECT * FROM quotes_customer LIMIT 5`
  );

  console.log('\nDone.');
  process.exit(0);
} catch (err) {
  console.error('\nProbe failed:', err.message);
  process.exit(1);
}
