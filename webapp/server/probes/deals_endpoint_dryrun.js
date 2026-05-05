// Dry-run the BQ → Postgres deals pipeline used by the new
//   /api/revenue-by-company, /api/need-to-onboard-revenue,
//   /api/quoted-potential-revenue
// endpoints. Reads only.
//
// Usage:  node probes/deals_endpoint_dryrun.js

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
const start = new Date(end.getTime() - 90 * 86_400_000); // 90 days back
console.log(`Window: ${start.toISOString()} → ${end.toISOString()}\n`);

// Step 1: BQ stages
const bqSql = `
  WITH qrn_tags AS (
    SELECT q.quote_request_number AS qrn, LOWER(t.name) AS tag_name
    FROM \`${FRONT}.conversation\` c
    ${SALES_INBOX_FILTER}
    INNER JOIN \`${AI}.email_quote_requests\` q
      ON q.front_conversation_id = c.id AND q.quote_request_number IS NOT NULL
    LEFT JOIN \`${FRONT}.conversation_tag\` ct ON ct.conversation_id = c.id
    LEFT JOIN \`${FRONT}.tag\` t ON t.id = ct.tag_id
    WHERE c.created_at >= TIMESTAMP(@start) AND c.created_at <= TIMESTAMP(@end)
  )
  SELECT qrn, ${STAGE_CASE_SQL} AS stage
  FROM qrn_tags
  GROUP BY qrn
`;

console.log('── Running BQ stage resolver ──');
const [bqRows] = await bigquery.query({
  query: bqSql,
  params: { start: start.toISOString(), end: end.toISOString() },
});
console.log(`BQ returned ${bqRows.length} QRNs`);
const stageCounts = {};
for (const r of bqRows) stageCounts[r.stage || '(no tags)'] = (stageCounts[r.stage || '(no tags)'] || 0) + 1;
console.table(stageCounts);

const qrnList = bqRows.map(r => r.qrn);
const stageMap = new Map(bqRows.map(r => [r.qrn, r.stage]));

// Step 2: Postgres deals
console.log('\n── Running Postgres deals fetch ──');
const pgSql = `
  WITH input_qrns AS (SELECT UNNEST($1::text[]) AS qrn),
  latest_quote AS (
    SELECT DISTINCT ON (q.qrn) q.id, q.qrn, q.bill_to_org_id, q.bill_to_org_name,
      q.manual_company_name, q.created_by_user_email
    FROM quotes_quote q
    INNER JOIN input_qrns iq ON iq.qrn = q.qrn
    ORDER BY q.qrn, q.created_at DESC
  ),
  latest_pricing AS (
    SELECT DISTINCT ON (qp.quote_id) qp.quote_id, qp.id AS pricing_id
    FROM quotes_quotepricing qp
    WHERE qp.quote_id IN (SELECT id FROM latest_quote)
    ORDER BY qp.quote_id, qp.created_at DESC
  ),
  pricing_totals AS (
    SELECT lp.quote_id, COALESCE(SUM(qcl.sell_amount), 0) AS quoted_value
    FROM latest_pricing lp
    LEFT JOIN quotes_quotechargeline qcl ON qcl.quote_pricing_id = lp.pricing_id
    GROUP BY lp.quote_id
  )
  SELECT
    lq.qrn,
    NULLIF(lq.bill_to_org_name, '') AS bill_to_org_name,
    NULLIF(lq.manual_company_name, '') AS manual_company_name,
    lq.created_by_user_email AS owner_email,
    NULLIF(TRIM(BOTH FROM CONCAT_WS(' ', u.first_name, u.last_name)), '') AS owner_name,
    COALESCE(pt.quoted_value, 0) AS quoted_value
  FROM latest_quote lq
  LEFT JOIN pricing_totals pt ON pt.quote_id = lq.id
  LEFT JOIN auth_user u ON LOWER(u.email) = LOWER(lq.created_by_user_email)
`;
const { rows: pgRows } = await readOnlyQuery(pgSql, [qrnList]);
console.log(`PG returned ${pgRows.length} deal rows for ${qrnList.length} QRN candidates`);
console.log('Sample (first 5):');
console.table(pgRows.slice(0, 5).map(r => ({
  qrn: r.qrn,
  stage: stageMap.get(r.qrn),
  company: r.bill_to_org_name || r.manual_company_name || '(none)',
  owner: r.owner_name || r.owner_email || '(none)',
  quoted_value: Number(r.quoted_value),
})));

// Aggregate revenue by company (mirror endpoint logic)
const byCo = new Map();
for (const r of pgRows) {
  const name = r.bill_to_org_name || r.manual_company_name || 'Unknown';
  const cur = byCo.get(name) || { name, quoted_value: 0, qrn_count: 0 };
  cur.quoted_value += Number(r.quoted_value) || 0;
  cur.qrn_count    += 1;
  byCo.set(name, cur);
}
const top10 = [...byCo.values()].sort((a, b) => b.quoted_value - a.quoted_value).slice(0, 10);
console.log('\n── Revenue by Company (Top 10) ──');
console.table(top10.map(c => ({ name: c.name, qrns: c.qrn_count, quoted_value: c.quoted_value.toFixed(2) })));

// Onboard / Quoted lists
const onboard = pgRows.filter(r => stageMap.get(r.qrn) === 'Need To Onboard');
const quoted  = pgRows.filter(r => stageMap.get(r.qrn) === 'Quoted');
console.log(`\nNeed To Onboard: ${onboard.length} deals, total $${onboard.reduce((s, r) => s + Number(r.quoted_value), 0).toFixed(2)}`);
console.log(`Quoted:          ${quoted.length} deals, total $${quoted.reduce((s, r) => s + Number(r.quoted_value), 0).toFixed(2)}`);

console.log('\nDone.');
process.exit(0);
