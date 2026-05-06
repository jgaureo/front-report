// Dry-run new Need-to-Onboard Revenue logic:
//   QRNs tagged 'need to onboard' in BQ ∩ quotes_quote.status NOT IN (BOOKED, CANCELLED).
// Compares against the OLD precedence-based stage='Need To Onboard' for context.
//
// Usage: node probes/need_to_onboard_dryrun.js

import { BigQuery } from '@google-cloud/bigquery';
import path from 'path';
import { fileURLToPath } from 'url';
import { readOnlyQuery } from '../db/postgres.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const bigquery = new BigQuery({
  keyFilename: path.resolve(__dirname, '../../../credentials.json'),
  projectId: 'possible-ace-317306',
});
const FRONT = 'possible-ace-317306.front';
const AI    = 'possible-ace-317306.sm_stage_ai';
const SALES_INBOX_FILTER = `
  INNER JOIN \`${FRONT}.conversation_inbox\` ci_sales ON ci_sales.conversation_id = c.id
  INNER JOIN \`${FRONT}.inbox\` ib_sales ON ib_sales.id = ci_sales.inbox_id AND LOWER(ib_sales.name) = 'sales team'
`;

const STAGE_CASE_SQL = `
  CASE
    WHEN MAX(CASE WHEN tag_name = 'won' THEN 1 ELSE 0 END) = 1 THEN 'Won'
    WHEN MAX(CASE WHEN tag_name = 'lost' THEN 1 ELSE 0 END) = 1 THEN 'Lost'
    WHEN MAX(CASE WHEN tag_name = 'need to onboard' THEN 1 ELSE 0 END) = 1 THEN 'Need To Onboard'
    WHEN MAX(CASE WHEN tag_name = 'quoted' THEN 1 ELSE 0 END) = 1 THEN 'Quoted'
    WHEN MAX(CASE WHEN tag_name = 'need to quote' THEN 1 ELSE 0 END) = 1 THEN 'Need To Quote'
    WHEN MAX(CASE WHEN tag_name = 'need to requote' THEN 1 ELSE 0 END) = 1 THEN 'Need To Re-Quote'
    WHEN MAX(CASE WHEN tag_name = 'contacted' THEN 1 ELSE 0 END) = 1 THEN 'Contacted'
    WHEN MAX(CASE WHEN tag_name = 'unable to quote' THEN 1 ELSE 0 END) = 1 THEN 'Unable To Quote'
    ELSE NULL
  END
`;

const end = new Date();
const start = new Date(end.getTime() - 90 * 86_400_000);
console.log(`Window: ${start.toISOString()} → ${end.toISOString()}\n`);

console.log('── BQ A: QRNs tagged need-to-onboard (precedence-agnostic) ──');
const [ntoRows] = await bigquery.query({
  query: `
    SELECT DISTINCT q.quote_request_number AS qrn
    FROM \`${FRONT}.conversation\` c
    ${SALES_INBOX_FILTER}
    INNER JOIN \`${AI}.email_quote_requests\` q
      ON q.front_conversation_id = c.id AND q.quote_request_number IS NOT NULL
    INNER JOIN \`${FRONT}.conversation_tag\` ct ON ct.conversation_id = c.id
    INNER JOIN \`${FRONT}.tag\` t ON t.id = ct.tag_id
    WHERE c.created_at >= TIMESTAMP(@start) AND c.created_at <= TIMESTAMP(@end)
      AND LOWER(t.name) = 'need to onboard'
  `,
  params: { start: start.toISOString(), end: end.toISOString() },
});
const ntoQrns = ntoRows.map(r => r.qrn);
console.log(`Tagged need-to-onboard: ${ntoQrns.length} QRNs`);

console.log('\n── BQ B: precedence-resolved stages for those QRNs ──');
const [precRows] = await bigquery.query({
  query: `
    WITH qrn_tags AS (
      SELECT q.quote_request_number AS qrn, LOWER(t.name) AS tag_name
      FROM \`${FRONT}.conversation\` c
      ${SALES_INBOX_FILTER}
      INNER JOIN \`${AI}.email_quote_requests\` q
        ON q.front_conversation_id = c.id AND q.quote_request_number IS NOT NULL
      LEFT JOIN \`${FRONT}.conversation_tag\` ct ON ct.conversation_id = c.id
      LEFT JOIN \`${FRONT}.tag\` t ON t.id = ct.tag_id
      WHERE c.created_at >= TIMESTAMP(@start) AND c.created_at <= TIMESTAMP(@end)
        AND q.quote_request_number IN UNNEST(@qrns)
    )
    SELECT qrn, ${STAGE_CASE_SQL} AS stage FROM qrn_tags GROUP BY qrn
  `,
  params: { start: start.toISOString(), end: end.toISOString(), qrns: ntoQrns },
});
const stagePrec = {};
for (const r of precRows) stagePrec[r.stage || '(none)'] = (stagePrec[r.stage || '(none)'] || 0) + 1;
console.table(stagePrec);

console.log('\n── PG: latest quote status for those QRNs ──');
const { rows: pgRows } = await readOnlyQuery(`
  WITH input_qrns AS (SELECT UNNEST($1::text[]) AS qrn),
  latest AS (
    SELECT DISTINCT ON (q.qrn) q.qrn, q.status,
      COALESCE((
        SELECT SUM(qcl.sell_amount) FROM quotes_quotechargeline qcl
        JOIN quotes_quotepricing qp ON qp.id = qcl.quote_pricing_id
        WHERE qp.quote_id = q.id
      ), 0) AS quoted_value
    FROM quotes_quote q
    INNER JOIN input_qrns iq ON iq.qrn = q.qrn
    ORDER BY q.qrn, q.created_at DESC
  )
  SELECT * FROM latest
`, [ntoQrns]);

const statusDist = {};
let kept = 0, keptValue = 0, dropped = 0, droppedValue = 0;
for (const r of pgRows) {
  statusDist[r.status] = (statusDist[r.status] || 0) + 1;
  const val = Number(r.quoted_value) || 0;
  if (r.status === 'BOOKED' || r.status === 'CANCELLED') { dropped++; droppedValue += val; }
  else { kept++; keptValue += val; }
}
console.log(`Postgres rows: ${pgRows.length} (vs ${ntoQrns.length} BQ QRNs — ${ntoQrns.length - pgRows.length} have no Postgres quote)`);
console.table(statusDist);
console.log(`\nKept (NOT in BOOKED/CANCELLED): ${kept} deals, $${keptValue.toFixed(2)}`);
console.log(`Excluded (BOOKED/CANCELLED):    ${dropped} deals, $${droppedValue.toFixed(2)}`);

console.log('\nDone.');
process.exit(0);
