// Read-only sanity probes for Management Dashboard.
// Verifies: (1) raw direction values to size cross-trade hyphen impact,
// (2) KPI Won total = Won by Month sum, (3) Direction by Month vs Freight
// Breakdown grand_total per direction.
// Usage: node probes/sanity_check.js [days=30]
//
// All queries are SELECT-only. No DDL/DML. BigQuery `query()` cannot mutate.

import { BigQuery } from '@google-cloud/bigquery';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const days = Number(process.argv[2] || 30);

const bigquery = new BigQuery({
  keyFilename: path.resolve(__dirname, '../../../credentials.json'),
  projectId: 'possible-ace-317306',
});

const PROJECT = 'possible-ace-317306';
const FRONT = `${PROJECT}.front`;
const AI = `${PROJECT}.sm_stage_ai`;
const TZ = 'America/Los_Angeles';
const SALES_INBOX_FILTER = `
  INNER JOIN \`${FRONT}.conversation_inbox\` ci_sales ON ci_sales.conversation_id = c.id
  INNER JOIN \`${FRONT}.inbox\` ib_sales ON ib_sales.id = ci_sales.inbox_id AND LOWER(ib_sales.name) = 'sales team'
`;

const end = new Date();
const start = new Date(end.getTime() - days * 24 * 60 * 60 * 1000);
const startStr = start.toISOString();
const endStr = end.toISOString();

async function run(label, sql, params = {}) {
  const [rows] = await bigquery.query({ query: sql, params });
  console.log(`\n── ${label} ──`);
  if (!rows.length) { console.log('  (no rows)'); return rows; }
  console.table(rows);
  return rows;
}

console.log(`Window: ${startStr}  →  ${endStr}  (${days} days)\n`);

// ─── PROBE 1: Raw direction values, count of QRNs per value ──────────────
// Tells us if `cross-trade`, `Cross-Trade`, etc. exist in the data — i.e.
// how many QRNs the old (pre-fix) crosstrade matcher was misclassifying.
const probe1 = `
  SELECT
    COALESCE(JSON_VALUE(q.quote_data, '$.direction'), '<null>') AS raw_direction,
    LOWER(REPLACE(COALESCE(JSON_VALUE(q.quote_data, '$.direction'), ''), '-', '')) AS normalized,
    COUNT(DISTINCT q.quote_request_number) AS qrn_count,
    COUNT(DISTINCT c.id) AS conv_count
  FROM \`${FRONT}.conversation\` c
  ${SALES_INBOX_FILTER}
  INNER JOIN \`${AI}.email_quote_requests\` q
    ON q.front_conversation_id = c.id AND q.quote_request_number IS NOT NULL
  WHERE c.created_at >= TIMESTAMP(@start) AND c.created_at <= TIMESTAMP(@end)
  GROUP BY raw_direction, normalized
  ORDER BY qrn_count DESC
`;

// ─── PROBE 2: KPI Won total vs Won by Month sum ──────────────────────────
// These should match exactly (same source: Sales inbox, qrn IS NOT NULL,
// 'won' tag, c.created_at window). If they diverge, a QRN has multiple
// JSON direction values across rows — would inflate Won by Month.
const probe2 = `
  WITH kpi AS (
    SELECT COUNT(DISTINCT q.quote_request_number) AS kpi_won
    FROM \`${FRONT}.conversation\` c
    ${SALES_INBOX_FILTER}
    INNER JOIN \`${AI}.email_quote_requests\` q
      ON q.front_conversation_id = c.id AND q.quote_request_number IS NOT NULL
    INNER JOIN \`${FRONT}.conversation_tag\` ct ON ct.conversation_id = c.id
    INNER JOIN \`${FRONT}.tag\` t ON t.id = ct.tag_id AND LOWER(t.name) = 'won'
    WHERE c.created_at >= TIMESTAMP(@start) AND c.created_at <= TIMESTAMP(@end)
  ),
  by_month AS (
    SELECT
      FORMAT_TIMESTAMP('%Y-%m', c.created_at, '${TZ}') AS month,
      q.quote_request_number AS qrn,
      LOWER(REPLACE(COALESCE(JSON_VALUE(q.quote_data, '$.direction'), ''), '-', '')) AS direction
    FROM \`${FRONT}.conversation\` c
    ${SALES_INBOX_FILTER}
    INNER JOIN \`${AI}.email_quote_requests\` q
      ON q.front_conversation_id = c.id AND q.quote_request_number IS NOT NULL
    INNER JOIN \`${FRONT}.conversation_tag\` ct ON ct.conversation_id = c.id
    INNER JOIN \`${FRONT}.tag\` t ON t.id = ct.tag_id AND LOWER(t.name) = 'won'
    WHERE c.created_at >= TIMESTAMP(@start) AND c.created_at <= TIMESTAMP(@end)
    GROUP BY month, qrn, direction
  ),
  wbm_sum AS (
    SELECT SUM(c) AS wbm_sum FROM (
      SELECT COUNT(DISTINCT qrn) AS c FROM by_month GROUP BY month, direction
    )
  )
  SELECT kpi.kpi_won, wbm_sum.wbm_sum, (wbm_sum.wbm_sum - kpi.kpi_won) AS diff
  FROM kpi, wbm_sum
`;

// ─── PROBE 3: Direction by Month total vs Freight Breakdown grand_total ──
// Direction by Month = COUNT(DISTINCT qrn). Freight Breakdown grand_total
// counts (conv × direction × mode) tuples. Per direction, these will diverge
// when a conv has 2+ QRNs of the same direction (DbM higher) or when a
// conv has 2+ modes recorded (FB higher). Sizing the gap.
const probe3 = `
  WITH dbm AS (
    SELECT
      LOWER(REPLACE(COALESCE(JSON_VALUE(q.quote_data, '$.direction'), ''), '-', '')) AS direction,
      COUNT(DISTINCT q.quote_request_number) AS dbm_qrn_count
    FROM \`${FRONT}.conversation\` c
    ${SALES_INBOX_FILTER}
    INNER JOIN \`${AI}.email_quote_requests\` q
      ON q.front_conversation_id = c.id AND q.quote_request_number IS NOT NULL
    WHERE c.created_at >= TIMESTAMP(@start) AND c.created_at <= TIMESTAMP(@end)
    GROUP BY direction
  ),
  per_conv AS (
    SELECT
      c.id,
      LOWER(REPLACE(COALESCE(JSON_VALUE(q.quote_data, '$.direction'), ''), '-', '')) AS direction,
      COALESCE(
        CASE
          WHEN UPPER(JSON_VALUE(q.quote_data, '$.mode')) IN ('SEA','OCEAN') THEN 'OCEAN'
          WHEN UPPER(JSON_VALUE(q.quote_data, '$.mode')) = 'AIR'            THEN 'AIR'
          WHEN UPPER(JSON_VALUE(q.quote_data, '$.mode')) = 'ROAD'           THEN 'ROAD'
          ELSE ''
        END, '') AS qr_mode
    FROM \`${FRONT}.conversation\` c
    ${SALES_INBOX_FILTER}
    INNER JOIN \`${AI}.email_quote_requests\` q
      ON q.front_conversation_id = c.id AND q.quote_request_number IS NOT NULL
    WHERE c.created_at >= TIMESTAMP(@start) AND c.created_at <= TIMESTAMP(@end)
    GROUP BY c.id, direction, qr_mode
  ),
  fb AS (
    SELECT direction, COUNT(*) AS fb_tuple_count
    FROM per_conv
    GROUP BY direction
  )
  SELECT
    COALESCE(dbm.direction, fb.direction) AS direction,
    dbm.dbm_qrn_count,
    fb.fb_tuple_count,
    (fb.fb_tuple_count - dbm.dbm_qrn_count) AS diff_fb_minus_dbm
  FROM dbm
  FULL OUTER JOIN fb USING (direction)
  ORDER BY COALESCE(dbm.dbm_qrn_count, fb.fb_tuple_count) DESC
`;

const params = { start: startStr, end: endStr };

try {
  await run('PROBE 1: Raw direction values (sizes cross-trade hyphen impact)', probe1, params);
  await run('PROBE 2: KPI Won vs Won by Month sum (should be 0 diff)', probe2, params);
  await run('PROBE 3: Direction by Month vs Freight Breakdown per direction', probe3, params);
  console.log('\nDone.');
  process.exit(0);
} catch (err) {
  console.error('\nProbe failed:', err.message);
  process.exit(1);
}
