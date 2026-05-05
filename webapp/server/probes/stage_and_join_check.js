// Two probes:
//   A) BigQuery — list distinct tag names that look like deal stages, with
//      occurrence counts so we can pick the canonical strings.
//   B) Postgres — verify quotes_quote.bill_to_org_id (varchar) joins to
//      quotes_customer.id (bigint), and that bill_to_org_name is consistent
//      with the joined customer name. SELECT-only via the read-only pool.
//
// Usage: node probes/stage_and_join_check.js

import { BigQuery } from '@google-cloud/bigquery';
import path from 'path';
import { fileURLToPath } from 'url';
import { readOnlyQuery } from '../db/postgres.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const bigquery = new BigQuery({
  keyFilename: path.resolve(__dirname, '../../../credentials.json'),
  projectId: 'possible-ace-317306',
});

const PROJECT = 'possible-ace-317306';
const FRONT = `${PROJECT}.front`;

async function bq(label, sql) {
  console.log(`\n── ${label} ──`);
  try {
    const [rows] = await bigquery.query({ query: sql });
    if (!rows.length) { console.log('  (no rows)'); return rows; }
    console.table(rows);
    return rows;
  } catch (e) {
    console.error('  ERROR:', e.message);
    return [];
  }
}

async function pg(label, sql, params = []) {
  console.log(`\n── ${label} ──`);
  try {
    const { rows } = await readOnlyQuery(sql, params);
    if (!rows.length) { console.log('  (no rows)'); return rows; }
    console.table(rows);
    return rows;
  } catch (e) {
    console.error('  ERROR:', e.message);
    return [];
  }
}

try {
  // ─── A1: All tag names that smell like deal stages ──────────────────────
  await bq(
    'BQ A1: tag names matching stage keywords (contact / quote / requote / onboard / lost / won)',
    `SELECT t.name AS tag_name, COUNT(DISTINCT ct.conversation_id) AS conv_count
     FROM \`${FRONT}.tag\` t
     INNER JOIN \`${FRONT}.conversation_tag\` ct ON ct.tag_id = t.id
     WHERE LOWER(t.name) LIKE '%contact%'
        OR LOWER(t.name) LIKE '%quot%'
        OR LOWER(t.name) LIKE '%onboard%'
        OR LOWER(t.name) LIKE '%lost%'
        OR LOWER(t.name) LIKE '%won%'
     GROUP BY tag_name
     ORDER BY conv_count DESC
     LIMIT 50`
  );

  // ─── A2: All distinct tags (top 100 by usage) so we can spot anything missed ─
  await bq(
    'BQ A2: top 100 tags by conversation count (full list, not just stages)',
    `SELECT t.name AS tag_name, COUNT(DISTINCT ct.conversation_id) AS conv_count
     FROM \`${FRONT}.tag\` t
     INNER JOIN \`${FRONT}.conversation_tag\` ct ON ct.tag_id = t.id
     GROUP BY tag_name
     ORDER BY conv_count DESC
     LIMIT 100`
  );

  // ─── B1: Sample bill_to_org_id values + try cast to bigint ──────────────
  await pg(
    'PG B1: sample non-empty bill_to_org_id values from quotes_quote',
    `SELECT bill_to_org_id, bill_to_org_name, COUNT(*) AS row_count
     FROM quotes_quote
     WHERE bill_to_org_id <> ''
     GROUP BY bill_to_org_id, bill_to_org_name
     ORDER BY row_count DESC
     LIMIT 5`
  );

  // ─── B2: Verify cast + join to quotes_customer ──────────────────────────
  await pg(
    'PG B2: join quotes_quote → quotes_customer via bill_to_org_id::bigint',
    `SELECT q.bill_to_org_id, q.bill_to_org_name, c.id AS customer_id, c.name AS customer_name, COUNT(*) AS quote_count
     FROM quotes_quote q
     LEFT JOIN quotes_customer c ON c.id = NULLIF(q.bill_to_org_id, '')::bigint
     WHERE q.bill_to_org_id <> ''
     GROUP BY q.bill_to_org_id, q.bill_to_org_name, c.id, c.name
     ORDER BY quote_count DESC
     LIMIT 10`
  );

  // ─── B3: Count quotes where the customer join misses ────────────────────
  await pg(
    'PG B3: how often does the customer join miss?',
    `SELECT
       COUNT(*) AS total_with_org_id,
       COUNT(c.id) AS joined_ok,
       COUNT(*) FILTER (WHERE c.id IS NULL) AS join_missed
     FROM quotes_quote q
     LEFT JOIN quotes_customer c ON c.id = NULLIF(q.bill_to_org_id, '')::bigint
     WHERE q.bill_to_org_id <> ''`
  );

  console.log('\nDone.');
  process.exit(0);
} catch (err) {
  console.error('\nProbe failed:', err.message);
  process.exit(1);
}
