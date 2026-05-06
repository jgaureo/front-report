// Dry-run new logic for /api/revenue-by-company and /api/quoted-potential-revenue.
//
//   revenue-by-company  → all QRNs in window whose latest quotes_quote.status = 'BOOKED'
//   quoted-potential    → BQ 'quoted' tag (precedence-agnostic) ∩ status NOT IN ('BOOKED','CANCELLED')
//
// Compares against the OLD precedence-based logic for context.
//
// Usage: node probes/revenue_endpoints_dryrun.js

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

// ── 1. BQ: all QRNs in window with their precedence-resolved stage
console.log('── BQ A: all QRNs + precedence stage (90d) ──');
const [allRows] = await bigquery.query({
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
    )
    SELECT qrn, ${STAGE_CASE_SQL} AS stage FROM qrn_tags GROUP BY qrn
  `,
  params: { start: start.toISOString(), end: end.toISOString() },
});
console.log(`Total QRNs in window: ${allRows.length}`);
const stageDist = {};
for (const r of allRows) stageDist[r.stage || '(none)'] = (stageDist[r.stage || '(none)'] || 0) + 1;
console.table(stageDist);
const allQrns = allRows.map(r => r.qrn);

// ── 2. BQ: precedence-agnostic 'quoted' tag set
console.log('\n── BQ B: QRNs tagged "quoted" (precedence-agnostic, 90d) ──');
const [quotedRows] = await bigquery.query({
  query: `
    SELECT DISTINCT q.quote_request_number AS qrn
    FROM \`${FRONT}.conversation\` c
    ${SALES_INBOX_FILTER}
    INNER JOIN \`${AI}.email_quote_requests\` q
      ON q.front_conversation_id = c.id AND q.quote_request_number IS NOT NULL
    INNER JOIN \`${FRONT}.conversation_tag\` ct ON ct.conversation_id = c.id
    INNER JOIN \`${FRONT}.tag\` t ON t.id = ct.tag_id
    WHERE c.created_at >= TIMESTAMP(@start) AND c.created_at <= TIMESTAMP(@end)
      AND LOWER(t.name) = 'quoted'
  `,
  params: { start: start.toISOString(), end: end.toISOString() },
});
const quotedQrns = quotedRows.map(r => r.qrn);
console.log(`Tagged quoted: ${quotedQrns.length} QRNs`);

// ── 3. PG: latest quote per QRN (status + quoted_value) for ALL QRNs in window
console.log('\n── PG: latest quote_status + quoted_value for all QRNs ──');
const { rows: pgRows } = await readOnlyQuery(`
  WITH input_qrns AS (SELECT UNNEST($1::text[]) AS qrn),
  latest AS (
    SELECT DISTINCT ON (q.qrn) q.id, q.qrn, q.status,
      NULLIF(q.bill_to_org_name, '') AS bill_to_org_name,
      NULLIF(q.manual_company_name, '') AS manual_company_name,
      NULLIF(q.bill_to_org_id, '') AS bill_to_org_id
    FROM quotes_quote q
    INNER JOIN input_qrns iq ON iq.qrn = q.qrn
    ORDER BY q.qrn, q.created_at DESC
  ),
  latest_pricing AS (
    SELECT DISTINCT ON (qp.quote_id) qp.quote_id, qp.id AS pricing_id
    FROM quotes_quotepricing qp
    WHERE qp.quote_id IN (SELECT id FROM latest)
    ORDER BY qp.quote_id, qp.created_at DESC
  ),
  totals AS (
    SELECT lp.quote_id, COALESCE(SUM(qcl.sell_amount), 0) AS quoted_value
    FROM latest_pricing lp
    LEFT JOIN quotes_quotechargeline qcl ON qcl.quote_pricing_id = lp.pricing_id
    GROUP BY lp.quote_id
  )
  SELECT l.qrn, l.status, l.bill_to_org_name, l.manual_company_name, l.bill_to_org_id,
         COALESCE(t.quoted_value, 0) AS quoted_value
  FROM latest l
  LEFT JOIN totals t ON t.quote_id = l.id
`, [allQrns]);

const byQrn = new Map(pgRows.map(r => [r.qrn, r]));
console.log(`Postgres rows: ${pgRows.length} / ${allQrns.length} BQ QRNs (${allQrns.length - pgRows.length} missing in PG)`);
const pgStatusDist = {};
for (const r of pgRows) pgStatusDist[r.status] = (pgStatusDist[r.status] || 0) + 1;
console.table(pgStatusDist);

// ── 4. Revenue by Company — OLD vs NEW
console.log('\n── Revenue by Company ──');
const oldByCo = new Map();
const newByCo = new Map();
const companyOf = r => r.bill_to_org_name || r.manual_company_name || (r.bill_to_org_id ? `Unknown (${r.bill_to_org_id})` : 'Unknown');
for (const r of pgRows) {
  const co = companyOf(r);
  const val = Number(r.quoted_value) || 0;
  // OLD: include every QRN regardless of status
  const oc = oldByCo.get(co) || { name: co, total: 0, count: 0 };
  oc.total += val; oc.count += 1; oldByCo.set(co, oc);
  // NEW: BOOKED only
  if (r.status === 'BOOKED') {
    const nc = newByCo.get(co) || { name: co, total: 0, count: 0 };
    nc.total += val; nc.count += 1; newByCo.set(co, nc);
  }
}
const oldTotal = [...oldByCo.values()].reduce((s, c) => s + c.total, 0);
const newTotal = [...newByCo.values()].reduce((s, c) => s + c.total, 0);
console.log(`OLD (no filter):     ${[...oldByCo.values()].length} companies, ${pgRows.length} deals, $${oldTotal.toFixed(2)}`);
console.log(`NEW (BOOKED only):   ${[...newByCo.values()].length} companies, ${[...newByCo.values()].reduce((s,c)=>s+c.count,0)} deals, $${newTotal.toFixed(2)}`);
console.log('\nNEW Top 10 (BOOKED):');
console.table([...newByCo.values()].sort((a,b)=>b.total-a.total).slice(0,10).map(c => ({ name: c.name, qrns: c.count, total: c.total.toFixed(2) })));

// ── 5. Quoted Potential — OLD vs NEW
console.log('\n── Quoted Potential Revenue ──');
// OLD: stage === 'Quoted' precedence
const oldQuoted = allRows.filter(r => r.stage === 'Quoted').map(r => byQrn.get(r.qrn)).filter(Boolean);
const oldQuotedTotal = oldQuoted.reduce((s, r) => s + Number(r.quoted_value || 0), 0);
console.log(`OLD (stage='Quoted' precedence): ${oldQuoted.length} deals, $${oldQuotedTotal.toFixed(2)}`);

// NEW: BQ quoted tag (precedence-agnostic) ∩ status NOT IN BOOKED/CANCELLED
const EXCLUDED = new Set(['BOOKED', 'CANCELLED']);
const newQuoted = quotedQrns.map(q => byQrn.get(q)).filter(r => r && r.status && !EXCLUDED.has(r.status));
const newQuotedTotal = newQuoted.reduce((s, r) => s + Number(r.quoted_value || 0), 0);
const newStatusDist = {};
for (const r of newQuoted) newStatusDist[r.status] = (newStatusDist[r.status] || 0) + 1;
console.log(`NEW (quoted tag ∩ status NOT IN BOOKED/CANCELLED): ${newQuoted.length} deals, $${newQuotedTotal.toFixed(2)}`);
console.log('NEW status breakdown:');
console.table(newStatusDist);

// Also show how many quoted-tagged QRNs got dropped by the status filter
const droppedByStatus = quotedQrns.map(q => byQrn.get(q)).filter(r => r && EXCLUDED.has(r.status));
const droppedNoPg = quotedQrns.filter(q => !byQrn.has(q));
console.log(`Excluded by BOOKED/CANCELLED filter: ${droppedByStatus.length} QRNs`);
console.log(`Quoted-tagged QRNs missing in Postgres:  ${droppedNoPg.length}`);

console.log('\nDone.');
process.exit(0);
