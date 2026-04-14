import express from 'express';
import cors from 'cors';
import { BigQuery } from '@google-cloud/bigquery';
import admin from 'firebase-admin';
import path from 'path';
import { fileURLToPath } from 'url';
import { calculateBusinessMinutes } from './businessHours.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(cors());
app.use(express.json());

// ─── Firebase Admin ──────────────────────────────────────
let firestoreDb = null;
const fs = await import('fs');

// Try to find Firebase credentials for Firestore access
const fbCredPaths = [
  path.resolve(__dirname, './firebase-credentials.json'),
  '/etc/secrets/firebase-credentials.json',
  '/etc/secrets/firestore-credentials.json',
  path.resolve(__dirname, './credentials.json'),
];
let fbCred = null;
for (const p of fbCredPaths) {
  try {
    fbCred = JSON.parse(fs.readFileSync(p, 'utf8'));
    console.log(`Firebase credentials found at: ${p} (project: ${fbCred.project_id})`);
    break;
  } catch {
    console.log(`Firebase credentials not found at: ${p}`);
  }
}

if (fbCred && fbCred.project_id === 'front-report') {
  // We have Firebase credentials — init with them for both Auth and Firestore
  admin.initializeApp({ credential: admin.credential.cert(fbCred), projectId: 'front-report' });
  firestoreDb = admin.firestore();
  console.log('Firebase Admin: initialized with credentials (Auth + Firestore)');
} else {
  // No Firebase credentials — Auth-only mode (Firestore disabled)
  admin.initializeApp({ projectId: 'front-report' });
  console.log('Firebase Admin: initialized without Firestore credentials (Auth only)');
}

async function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing auth token' });
  }
  try {
    const token = authHeader.split('Bearer ')[1];
    const decoded = await admin.auth().verifyIdToken(token);
    if (!decoded.email || !decoded.email.endsWith('@freightright.com')) {
      return res.status(403).json({ error: 'Unauthorized domain' });
    }
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

app.use('/api', requireAuth);

const bigquery = new BigQuery({
  // In production (Render/Firebase), the credentials file is usually in the same dir or provided via Secret
  keyFilename: path.resolve(__dirname, process.env.GOOGLE_APPLICATION_CREDENTIALS || '../../credentials.json'),
  projectId: 'possible-ace-317306'
});

const PROJECT = 'possible-ace-317306';
const FRONT = `${PROJECT}.front`;
const AI = `${PROJECT}.sm_stage_ai`;
const TZ = 'America/Los_Angeles';

// ─── Front API Helper ────────────────────────────────────
const FRONT_TOKEN         = process.env.FRONT_API_TOKEN;
const FRONT_API_BASE      = 'https://api2.frontapp.com';
const SALES_INBOX_ID      = 'inb_kkq08';
const ZERO_REPLIES_TAG_ID = 'tag_6si6eg';

/**
 * Fetch ALL open (assigned + unassigned) conversations in the Sales Team inbox
 * that carry the zero-replies tag, following pagination automatically.
 *
 * Front search treats multiple "is:" clauses as AND, so we run two searches
 * (is:assigned and is:unassigned) and merge the results.
 */
async function fetchPendingReplies() {
  const baseQ = `inbox:${SALES_INBOX_ID} tag:${ZERO_REPLIES_TAG_ID}`;

  // Paginated fetch helper for a single search query
  async function fetchAll(query) {
    const results = [];
    let url = `${FRONT_API_BASE}/conversations/search/${encodeURIComponent(query)}?limit=100`;
    while (url) {
      const resp = await fetch(url, {
        headers: { Authorization: `Bearer ${FRONT_TOKEN}` }
      });
      if (!resp.ok) throw new Error(`Front API ${resp.status}: ${await resp.text()}`);
      const data = await resp.json();
      for (const conv of (data._results || [])) results.push(conv);
      url = data._pagination?.next || null;
    }
    return results;
  }

  // Run both searches in parallel
  const [assigned, unassigned] = await Promise.all([
    fetchAll(`${baseQ} is:assigned is:open`),
    fetchAll(`${baseQ} is:unassigned is:open`),
  ]);

  // Merge and deduplicate by ID
  const seen = new Set();
  const merged = [];
  for (const conv of [...assigned, ...unassigned]) {
    if (seen.has(conv.id)) continue;
    seen.add(conv.id);
    merged.push(conv);
  }

  // Map to the shape the frontend expects
  const results = merged.map(conv => {
    const assignee    = conv.assignee;
    const firstName   = assignee?.first_name || '';
    const lastName    = assignee?.last_name  || '';
    const teammate    = firstName || lastName ? `${firstName} ${lastName}`.trim() : '—';
    const createdMs   = (conv.created_at || 0) * 1000;
    const createdDate = new Date(createdMs).toLocaleString('en-US', {
      month: 'short', day: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: true,
      timeZone: 'America/Los_Angeles'
    }) + ' PST';
    const ageHours    = Math.floor((Date.now() - createdMs) / 3_600_000);
    const tags        = (conv.tags || []).map(t => t.name).join(', ');

    return {
      conversation_id: conv.id,
      teammate,
      first_name: firstName,
      last_name:  lastName,
      created_date: createdDate,
      age_hours:    ageHours,
      subject:      conv.subject || '',
      tags
    };
  });

  // Sort oldest first (same as original BigQuery ORDER BY c.created_at ASC)
  results.sort((a, b) => b.age_hours - a.age_hours);
  return results;
}

// Reusable Sales Team inbox filter subquery
const SALES_INBOX_FILTER = `
  INNER JOIN \`${FRONT}.conversation_inbox\` ci_sales ON ci_sales.conversation_id = c.id
  INNER JOIN \`${FRONT}.inbox\` ib_sales ON ib_sales.id = ci_sales.inbox_id AND LOWER(ib_sales.name) = 'sales team'
`;

// ─── Helpers ───────────────────────────────────────────────
function dateParams(req) {
  const now = new Date();
  const end = req.query.end
    ? new Date(req.query.end)
    : new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  const start = req.query.start
    ? new Date(req.query.start)
    : new Date(end.getTime() - 6 * 86400000);
  if (!req.query.start) start.setHours(0, 0, 0, 0);
  return { startStr: start.toISOString(), endStr: end.toISOString() };
}

async function runQuery(sql, params = {}) {
  const options = { query: sql, params, location: 'US' };
  const [rows] = await bigquery.query(options);
  return rows;
}

// ─── Team Schedules Endpoints ────────────────────────────
app.get('/api/team-schedules', async (req, res) => {
  if (!firestoreDb) return res.json({});
  try {
    const snap = await firestoreDb.collection('teammate_schedules').get();
    const schedules = {};
    snap.forEach(doc => { schedules[doc.id] = doc.data(); });
    res.json(schedules);
  } catch (err) {
    console.error('get-schedules error:', err);
    res.json({});
  }
});

app.post('/api/team-schedules', async (req, res) => {
  if (!firestoreDb) return res.status(503).json({ error: 'Firestore not configured' });
  try {
    const { teammate_id, schedule } = req.body;
    if (!teammate_id || !schedule) return res.status(400).json({ error: 'Missing data' });
    await firestoreDb.collection('teammate_schedules').doc(String(teammate_id)).set(schedule);
    res.json({ success: true });
  } catch (err) {
    console.error('post-schedules error:', err.code, err.message, err.details || '');
    res.status(500).json({ error: err.message });
  }
});

// ─── 1. Dashboard Stats (Conversation Overview + Direction Donuts) ─────
// Now filtered to Sales Team inbox only
app.get('/api/dashboard-stats', async (req, res) => {
  try {
    const { startStr, endStr } = dateParams(req);
    const sql = `
      WITH base AS (
        SELECT
          c.id,
          c.status,
          c.status_category,
          MAX(CASE WHEN LOWER(t.name) = 'import' THEN 1 ELSE 0 END) AS is_import,
          MAX(CASE WHEN LOWER(t.name) = 'export' THEN 1 ELSE 0 END) AS is_export,
          MAX(CASE WHEN LOWER(t.name) = 'domestic' THEN 1 ELSE 0 END) AS is_domestic,
          MAX(CASE WHEN LOWER(t.name) = 'cross-trade' THEN 1 ELSE 0 END) AS is_crosstrade,
          MAX(CASE WHEN LOWER(t.name) = 'fcl' THEN 1 ELSE 0 END) AS is_fcl,
          MAX(CASE WHEN LOWER(t.name) = 'lcl' THEN 1 ELSE 0 END) AS is_lcl,
          MAX(CASE WHEN LOWER(t.name) = 'ltl' THEN 1 ELSE 0 END) AS is_ltl,
          MAX(CASE WHEN LOWER(t.name) = 'ftl' THEN 1 ELSE 0 END) AS is_ftl,
          COALESCE(
            CASE
              WHEN UPPER(JSON_VALUE(q.quote_data, '$.mode')) IN ('SEA','OCEAN') THEN 'OCEAN'
              WHEN UPPER(JSON_VALUE(q.quote_data, '$.mode')) = 'AIR' THEN 'AIR'
              WHEN UPPER(JSON_VALUE(q.quote_data, '$.mode')) = 'ROAD' THEN 'ROAD'
              ELSE ''
            END, '') AS qr_mode
        FROM \`${FRONT}.conversation\` c
        ${SALES_INBOX_FILTER}
        LEFT JOIN \`${FRONT}.conversation_tag\` ct ON ct.conversation_id = c.id
        LEFT JOIN \`${FRONT}.tag\` t ON t.id = ct.tag_id
        LEFT JOIN \`${AI}.email_quote_requests\` q ON q.front_conversation_id = c.id
        WHERE c.created_at >= TIMESTAMP(@start) AND c.created_at <= TIMESTAMP(@end)
        GROUP BY c.id, c.status, c.status_category, qr_mode
      )
      SELECT
        COUNT(DISTINCT CASE WHEN status IN ('assigned','unassigned') THEN id END) AS total_open,
        COUNT(DISTINCT CASE WHEN status = 'unassigned' THEN id END) AS total_waiting,
        COUNT(DISTINCT CASE WHEN status_category = 'resolved' THEN id END) AS total_resolved,
        COUNT(DISTINCT CASE WHEN status = 'archived' AND COALESCE(status_category,'') != 'resolved' THEN id END) AS total_archived,

        -- Import breakdowns (mode + load type combos)
        COUNT(DISTINCT CASE WHEN is_import=1 THEN id END) AS import_total,
        COUNT(DISTINCT CASE WHEN is_import=1 AND qr_mode='OCEAN' AND is_fcl=1 THEN id END) AS import_ocean_fcl,
        COUNT(DISTINCT CASE WHEN is_import=1 AND qr_mode='OCEAN' AND is_lcl=1 THEN id END) AS import_ocean_lcl,
        COUNT(DISTINCT CASE WHEN is_import=1 AND qr_mode='AIR' AND is_lcl=1 THEN id END) AS import_air_lcl,
        COUNT(DISTINCT CASE WHEN is_import=1 AND qr_mode='ROAD' AND is_ltl=1 THEN id END) AS import_road_ltl,
        COUNT(DISTINCT CASE WHEN is_import=1 AND qr_mode='ROAD' AND is_ftl=1 THEN id END) AS import_road_ftl,
        COUNT(DISTINCT CASE WHEN is_import=1 AND qr_mode='' AND is_fcl=1 THEN id END) AS import_fcl_only,
        COUNT(DISTINCT CASE WHEN is_import=1 AND qr_mode='' AND is_lcl=1 THEN id END) AS import_lcl_only,
        COUNT(DISTINCT CASE WHEN is_import=1 AND qr_mode='' AND is_ltl=1 THEN id END) AS import_ltl_only,
        COUNT(DISTINCT CASE WHEN is_import=1 AND qr_mode='' AND is_ftl=1 THEN id END) AS import_ftl_only,

        -- Export breakdowns
        COUNT(DISTINCT CASE WHEN is_export=1 THEN id END) AS export_total,
        COUNT(DISTINCT CASE WHEN is_export=1 AND qr_mode='OCEAN' AND is_fcl=1 THEN id END) AS export_ocean_fcl,
        COUNT(DISTINCT CASE WHEN is_export=1 AND qr_mode='OCEAN' AND is_lcl=1 THEN id END) AS export_ocean_lcl,
        COUNT(DISTINCT CASE WHEN is_export=1 AND qr_mode='AIR' AND is_lcl=1 THEN id END) AS export_air_lcl,
        COUNT(DISTINCT CASE WHEN is_export=1 AND qr_mode='ROAD' AND is_ltl=1 THEN id END) AS export_road_ltl,
        COUNT(DISTINCT CASE WHEN is_export=1 AND qr_mode='ROAD' AND is_ftl=1 THEN id END) AS export_road_ftl,
        COUNT(DISTINCT CASE WHEN is_export=1 AND qr_mode='' AND is_fcl=1 THEN id END) AS export_fcl_only,
        COUNT(DISTINCT CASE WHEN is_export=1 AND qr_mode='' AND is_lcl=1 THEN id END) AS export_lcl_only,
        COUNT(DISTINCT CASE WHEN is_export=1 AND qr_mode='' AND is_ltl=1 THEN id END) AS export_ltl_only,
        COUNT(DISTINCT CASE WHEN is_export=1 AND qr_mode='' AND is_ftl=1 THEN id END) AS export_ftl_only,

        -- Domestic breakdowns
        COUNT(DISTINCT CASE WHEN is_domestic=1 THEN id END) AS domestic_total,
        COUNT(DISTINCT CASE WHEN is_domestic=1 AND qr_mode='OCEAN' AND is_fcl=1 THEN id END) AS domestic_ocean_fcl,
        COUNT(DISTINCT CASE WHEN is_domestic=1 AND qr_mode='OCEAN' AND is_lcl=1 THEN id END) AS domestic_ocean_lcl,
        COUNT(DISTINCT CASE WHEN is_domestic=1 AND qr_mode='AIR' AND is_lcl=1 THEN id END) AS domestic_air_lcl,
        COUNT(DISTINCT CASE WHEN is_domestic=1 AND qr_mode='ROAD' AND is_ltl=1 THEN id END) AS domestic_road_ltl,
        COUNT(DISTINCT CASE WHEN is_domestic=1 AND qr_mode='ROAD' AND is_ftl=1 THEN id END) AS domestic_road_ftl,
        COUNT(DISTINCT CASE WHEN is_domestic=1 AND qr_mode='' AND is_fcl=1 THEN id END) AS domestic_fcl_only,
        COUNT(DISTINCT CASE WHEN is_domestic=1 AND qr_mode='' AND is_lcl=1 THEN id END) AS domestic_lcl_only,
        COUNT(DISTINCT CASE WHEN is_domestic=1 AND qr_mode='' AND is_ltl=1 THEN id END) AS domestic_ltl_only,
        COUNT(DISTINCT CASE WHEN is_domestic=1 AND qr_mode='' AND is_ftl=1 THEN id END) AS domestic_ftl_only,

        -- Cross-Trade breakdowns
        COUNT(DISTINCT CASE WHEN is_crosstrade=1 THEN id END) AS crosstrade_total,
        COUNT(DISTINCT CASE WHEN is_crosstrade=1 AND qr_mode='OCEAN' AND is_fcl=1 THEN id END) AS crosstrade_ocean_fcl,
        COUNT(DISTINCT CASE WHEN is_crosstrade=1 AND qr_mode='OCEAN' AND is_lcl=1 THEN id END) AS crosstrade_ocean_lcl,
        COUNT(DISTINCT CASE WHEN is_crosstrade=1 AND qr_mode='AIR' AND is_lcl=1 THEN id END) AS crosstrade_air_lcl,
        COUNT(DISTINCT CASE WHEN is_crosstrade=1 AND qr_mode='ROAD' AND is_ltl=1 THEN id END) AS crosstrade_road_ltl,
        COUNT(DISTINCT CASE WHEN is_crosstrade=1 AND qr_mode='ROAD' AND is_ftl=1 THEN id END) AS crosstrade_road_ftl,
        COUNT(DISTINCT CASE WHEN is_crosstrade=1 AND qr_mode='' AND is_fcl=1 THEN id END) AS crosstrade_fcl_only,
        COUNT(DISTINCT CASE WHEN is_crosstrade=1 AND qr_mode='' AND is_lcl=1 THEN id END) AS crosstrade_lcl_only,
        COUNT(DISTINCT CASE WHEN is_crosstrade=1 AND qr_mode='' AND is_ltl=1 THEN id END) AS crosstrade_ltl_only,
        COUNT(DISTINCT CASE WHEN is_crosstrade=1 AND qr_mode='' AND is_ftl=1 THEN id END) AS crosstrade_ftl_only
      FROM base
    `;
    const rows = await runQuery(sql, { start: startStr, end: endStr });
    const r = rows[0] || {};

    function buildBreakdowns(prefix) {
      const items = [
        { label: 'Ocean FCL', count: Number(r[`${prefix}_ocean_fcl`] || 0) },
        { label: 'Ocean LCL', count: Number(r[`${prefix}_ocean_lcl`] || 0) },
        { label: 'Air LCL',   count: Number(r[`${prefix}_air_lcl`] || 0) },
        { label: 'Road LTL',  count: Number(r[`${prefix}_road_ltl`] || 0) },
        { label: 'Road FTL',  count: Number(r[`${prefix}_road_ftl`] || 0) },
        { label: 'FCL', count: Number(r[`${prefix}_fcl_only`] || 0) },
        { label: 'LCL', count: Number(r[`${prefix}_lcl_only`] || 0) },
        { label: 'LTL', count: Number(r[`${prefix}_ltl_only`] || 0) },
        { label: 'FTL', count: Number(r[`${prefix}_ftl_only`] || 0) },
      ];
      return items.filter(i => i.count > 0).sort((a, b) => b.count - a.count);
    }

    res.json({
      total_open: Number(r.total_open || 0),
      total_waiting: Number(r.total_waiting || 0),
      total_resolved: Number(r.total_resolved || 0),
      total_archived: Number(r.total_archived || 0),
      quotes: {
        IMPORT: { total: Number(r.import_total || 0), breakdowns: buildBreakdowns('import') },
        EXPORT: { total: Number(r.export_total || 0), breakdowns: buildBreakdowns('export') },
        DOMESTIC: { total: Number(r.domestic_total || 0), breakdowns: buildBreakdowns('domestic') },
        CROSSTRADE: { total: Number(r.crosstrade_total || 0), breakdowns: buildBreakdowns('crosstrade') },
      }
    });
  } catch (err) {
    console.error('dashboard-stats error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ─── 2. Conversation Trend ────────────────────────────────
app.get('/api/conversation-trend', async (req, res) => {
  try {
    const { startStr, endStr } = dateParams(req);
    const sql = `
      WITH convs AS (
        SELECT FORMAT_TIMESTAMP('%Y-%m-%d', c.created_at, '${TZ}') AS day,
               COUNT(*) AS count_conversations
        FROM \`${FRONT}.conversation\` c
        ${SALES_INBOX_FILTER}
        WHERE c.created_at >= TIMESTAMP(@start) AND c.created_at <= TIMESTAMP(@end)
        GROUP BY 1
      ),
      replies AS (
        SELECT FORMAT_TIMESTAMP('%Y-%m-%d', m.created_at, '${TZ}') AS day,
               COUNT(*) AS count_replies
        FROM \`${FRONT}.message\` m
        JOIN \`${FRONT}.conversation\` c ON c.id = m.conversation_id
        ${SALES_INBOX_FILTER}
        WHERE m.created_at >= TIMESTAMP(@start) AND m.created_at <= TIMESTAMP(@end)
          AND m.is_inbound = false
        GROUP BY 1
      )
      SELECT
        COALESCE(c.day, r.day) AS day,
        COALESCE(c.count_conversations, 0) AS conversations,
        COALESCE(r.count_replies, 0) AS replies
      FROM convs c
      FULL OUTER JOIN replies r ON c.day = r.day
      ORDER BY day
    `;
    const rows = await runQuery(sql, { start: startStr, end: endStr });
    res.json(rows.map(r => ({
      day: r.day,
      conversations: Number(r.conversations),
      replies: Number(r.replies)
    })));
  } catch (err) {
    console.error('conversation-trend error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ─── 3. Team Performance ──────────────────────────────────
// Fixed: Scoped all CTEs to Sales Team inbox only
// Fixed: first_reply inbound also date-filtered so AVG 1st Reply reflects the selected period
app.get('/api/team-performance', async (req, res) => {
  try {
    const { startStr, endStr } = dateParams(req);
    const sql = `
      -- Sales Team inbox conversations (reusable filter for all CTEs)
      WITH sales_convos AS (
        SELECT DISTINCT ci_s.conversation_id
        FROM \`${FRONT}.conversation_inbox\` ci_s
        INNER JOIN \`${FRONT}.inbox\` ib_s ON ib_s.id = ci_s.inbox_id AND LOWER(ib_s.name) = 'sales team'
      ),
      assigned AS (
        SELECT
          c.teammate_id AS teammate_id,
          COUNT(DISTINCT c.id) AS assigned_convos
        FROM \`${FRONT}.conversation\` c
        INNER JOIN sales_convos sc ON sc.conversation_id = c.id
        WHERE c.status IN ('assigned','unassigned')
          AND c.created_at >= TIMESTAMP(@start) AND c.created_at <= TIMESTAMP(@end)
        GROUP BY 1
      ),
      msg_activity AS (
        SELECT
          m.author_id AS teammate_id,
          COUNT(DISTINCT m.conversation_id) AS touched_via_msg,
          COUNT(CASE WHEN m.is_inbound = false THEN 1 END) AS messages_sent
        FROM \`${FRONT}.message\` m
        INNER JOIN sales_convos sc ON sc.conversation_id = m.conversation_id
        WHERE m.created_at >= TIMESTAMP(@start) AND m.created_at <= TIMESTAMP(@end)
          AND m.is_inbound = false
        GROUP BY 1
      ),
      touched AS (
        SELECT teammate_id, COUNT(DISTINCT sub.conversation_id) AS touched_convos
        FROM (
          SELECT author_id AS teammate_id, conversation_id
          FROM \`${FRONT}.message\`
          WHERE created_at >= TIMESTAMP(@start) AND created_at <= TIMESTAMP(@end)
            AND is_inbound = false
          UNION ALL
          SELECT author_id, conversation_id
          FROM \`${FRONT}.comment\`
          WHERE posted_at >= TIMESTAMP(@start) AND posted_at <= TIMESTAMP(@end)
          UNION ALL
          SELECT source_teammate_id, conversation_id
          FROM \`${FRONT}.conversation_tag_history\`
          WHERE updated_at >= TIMESTAMP(@start) AND updated_at <= TIMESTAMP(@end)
            AND source_teammate_id IS NOT NULL
        ) sub
        INNER JOIN sales_convos sc ON sc.conversation_id = sub.conversation_id
        WHERE teammate_id IS NOT NULL
        GROUP BY 1
      ),
      replies_sent AS (
        SELECT
          m_out.author_id AS teammate_id,
          COUNT(*) AS reply_count
        FROM \`${FRONT}.message\` m_out
        INNER JOIN sales_convos sc ON sc.conversation_id = m_out.conversation_id
        WHERE m_out.is_inbound = false
          AND m_out.created_at >= TIMESTAMP(@start) AND m_out.created_at <= TIMESTAMP(@end)
          AND EXISTS (
            SELECT 1 FROM \`${FRONT}.message\` m_in
            WHERE m_in.conversation_id = m_out.conversation_id
              AND m_in.is_inbound = true
              AND m_in.created_at < m_out.created_at
          )
        GROUP BY 1
      ),
      reply_times AS (
        SELECT
          m_out.author_id AS teammate_id,
          ARRAY_AGG(STRUCT(m_out.created_at AS out_ts, m_in_max.last_inbound AS in_ts)) AS pairs
        FROM \`${FRONT}.message\` m_out
        INNER JOIN sales_convos sc ON sc.conversation_id = m_out.conversation_id
        JOIN (
          SELECT m_out2.id AS out_msg_id, MAX(m_in2.created_at) AS last_inbound
          FROM \`${FRONT}.message\` m_out2
          INNER JOIN sales_convos sc2 ON sc2.conversation_id = m_out2.conversation_id
          JOIN \`${FRONT}.message\` m_in2
            ON m_in2.conversation_id = m_out2.conversation_id
            AND m_in2.is_inbound = true
            AND m_in2.created_at < m_out2.created_at
            AND m_in2.created_at >= TIMESTAMP(@start)
          WHERE m_out2.is_inbound = false
            AND m_out2.created_at >= TIMESTAMP(@start) AND m_out2.created_at <= TIMESTAMP(@end)
          GROUP BY 1
        ) m_in_max ON m_in_max.out_msg_id = m_out.id
        WHERE m_out.is_inbound = false
          AND m_out.created_at >= TIMESTAMP(@start) AND m_out.created_at <= TIMESTAMP(@end)
        GROUP BY 1
      ),
      first_reply AS (
        SELECT
          fo.author_id AS teammate_id,
          ARRAY_AGG(STRUCT(fo.first_out AS out_ts, fi.first_in AS in_ts)) AS pairs
        FROM (
          SELECT conversation_id, author_id, MIN(created_at) AS first_out
          FROM \`${FRONT}.message\`
          WHERE is_inbound = false
            AND created_at >= TIMESTAMP(@start) AND created_at <= TIMESTAMP(@end)
          GROUP BY conversation_id, author_id
        ) fo
        INNER JOIN sales_convos sc ON sc.conversation_id = fo.conversation_id
        JOIN (
          SELECT conversation_id, MIN(created_at) AS first_in
          FROM \`${FRONT}.message\`
          WHERE is_inbound = true
            AND created_at >= TIMESTAMP(@start) AND created_at <= TIMESTAMP(@end)
          GROUP BY conversation_id
        ) fi ON fi.conversation_id = fo.conversation_id
        WHERE fo.first_out > fi.first_in
        GROUP BY 1
      )
      SELECT
        tm.id AS teammate_id,
        CONCAT(tm.first_name, ' ', tm.last_name) AS name,
        tm.first_name,
        tm.last_name,
        COALESCE(a.assigned_convos, 0) AS assigned_conversations,
        COALESCE(tc.touched_convos, 0) AS touched_conversations,
        COALESCE(ma.messages_sent, 0) AS messages_sent,
        COALESCE(rs.reply_count, 0) AS replies_sent,
        -- Fetch pairs arrays 
        rt.pairs AS reply_pairs,
        fr.pairs AS first_reply_pairs
      FROM \`${FRONT}.teammate\` tm
      LEFT JOIN assigned a ON a.teammate_id = tm.id
      LEFT JOIN touched tc ON tc.teammate_id = tm.id
      LEFT JOIN msg_activity ma ON ma.teammate_id = tm.id
      LEFT JOIN replies_sent rs ON rs.teammate_id = tm.id
      LEFT JOIN reply_times rt ON rt.teammate_id = tm.id
      LEFT JOIN first_reply fr ON fr.teammate_id = tm.id
      WHERE COALESCE(a.assigned_convos, 0) + COALESCE(tc.touched_convos, 0) > 0
      ORDER BY assigned_conversations DESC
    `;
    const rows = await runQuery(sql, { start: startStr, end: endStr });
    
    // Fetch all schedules from Firestore to calculate business minutes
    const schedules = {};
    if (firestoreDb) {
      try {
        const snap = await firestoreDb.collection('teammate_schedules').get();
        snap.forEach(doc => { schedules[doc.id] = doc.data(); });
      } catch (e) { console.error('Failed to fetch schedules:', e.message); }
    }

    res.json(rows.map(r => {
      const schedule = schedules[r.teammate_id] || null;
      let avg_reply_minutes = 0;
      let avg_first_reply_minutes = 0;

      if (r.reply_pairs && r.reply_pairs.length > 0) {
        let total = 0;
        for (const p of r.reply_pairs) total += calculateBusinessMinutes(p.in_ts.value, p.out_ts.value, schedule);
        avg_reply_minutes = total / r.reply_pairs.length;
      }

      if (r.first_reply_pairs && r.first_reply_pairs.length > 0) {
        let total = 0;
        for (const p of r.first_reply_pairs) total += calculateBusinessMinutes(p.in_ts.value, p.out_ts.value, schedule);
        avg_first_reply_minutes = total / r.first_reply_pairs.length;
      }

      return {
        teammate_id: r.teammate_id,
        name: r.name,
        first_name: r.first_name,
        last_name: r.last_name,
        assigned_conversations: Number(r.assigned_conversations),
        touched_conversations: Number(r.touched_conversations),
        messages_sent: Number(r.messages_sent),
        replies_sent: Number(r.replies_sent),
        avg_reply_minutes,
        avg_first_reply_minutes,
      };
    }));
  } catch (err) {
    console.error('team-performance error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ─── 4. Pending Replies (Zero Replies) — Front.com API ───
app.get('/api/zero-replies-conversations', async (req, res) => {
  try {
    const rows = await fetchPendingReplies();
    res.json(rows);
  } catch (err) {
    console.error('zero-replies error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ─── 5. Top 5 Accounts ───────────────────────────────────
app.get('/api/top-accounts', async (req, res) => {
  try {
    const { startStr, endStr } = dateParams(req);
    const sql = `
      SELECT
        a.name AS account_name,
        COUNT(DISTINCT c.id) AS total,
        COUNT(DISTINCT CASE WHEN c.status IN ('assigned','unassigned') THEN c.id END) AS open_count,
        COUNT(DISTINCT CASE WHEN c.status = 'unassigned' THEN c.id END) AS waiting_count,
        COUNT(DISTINCT CASE WHEN c.status_category = 'resolved' THEN c.id END) AS resolved_count,
        COUNT(DISTINCT CASE WHEN c.status = 'archived' AND COALESCE(c.status_category,'') != 'resolved' THEN c.id END) AS archived_count
      FROM \`${FRONT}.conversation\` c
      JOIN \`${FRONT}.message\` m ON m.conversation_id = c.id AND m.is_inbound = true
      JOIN \`${FRONT}.message_recipient\` mr ON mr.message_id = m.id
      JOIN \`${FRONT}.contact\` ct ON ct.id = mr.contact_id
      JOIN \`${FRONT}.account\` a ON a.id = ct.account_id
      WHERE c.created_at >= TIMESTAMP(@start) AND c.created_at <= TIMESTAMP(@end)
        AND a.name IS NOT NULL AND a.name != ''
      GROUP BY a.name
      ORDER BY total DESC
      LIMIT 5
    `;
    const rows = await runQuery(sql, { start: startStr, end: endStr });
    res.json(rows.map(r => ({
      account_name: r.account_name,
      total: Number(r.total),
      open: Number(r.open_count),
      waiting: Number(r.waiting_count),
      resolved: Number(r.resolved_count),
      archived: Number(r.archived_count),
    })));
  } catch (err) {
    console.error('top-accounts error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ─── 6. Management KPIs ──────────────────────────────────
app.get('/api/management-kpis', async (req, res) => {
  try {
    const { startStr, endStr } = dateParams(req);
    const sql = `
      WITH base AS (
        SELECT
          c.id,
          q.quote_request_number AS qrn,
          MAX(CASE WHEN LOWER(t.name) = 'won' THEN 1 ELSE 0 END) AS is_won,
          MAX(CASE WHEN LOWER(t.name) = 'lost' THEN 1 ELSE 0 END) AS is_lost
        FROM \`${FRONT}.conversation\` c
        ${SALES_INBOX_FILTER}
        LEFT JOIN \`${AI}.email_quote_requests\` q ON q.front_conversation_id = c.id
        LEFT JOIN \`${FRONT}.conversation_tag\` ct ON ct.conversation_id = c.id
        LEFT JOIN \`${FRONT}.tag\` t ON t.id = ct.tag_id
        WHERE c.created_at >= TIMESTAMP(@start) AND c.created_at <= TIMESTAMP(@end)
          AND q.quote_request_number IS NOT NULL
        GROUP BY c.id, q.quote_request_number
      )
      SELECT
        COUNT(DISTINCT qrn) AS total_conversations,
        COUNT(DISTINCT CASE WHEN is_won = 1 THEN qrn END) AS won_conversations,
        COUNT(DISTINCT CASE WHEN is_lost = 1 THEN qrn END) AS lost_conversations
      FROM base
    `;
    const rows = await runQuery(sql, { start: startStr, end: endStr });
    const r = rows[0] || {};
    const total = Number(r.total_conversations || 0);
    const won = Number(r.won_conversations || 0);
    const lost = Number(r.lost_conversations || 0);
    const winRate = (won + lost) > 0 ? (won / (won + lost)) * 100 : 0;

    res.json({
      total_conversations: total,
      won_conversations: won,
      lost_conversations: lost,
      win_rate: winRate,
    });
  } catch (err) {
    console.error('management-kpis error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ─── 7. Global Search ────────────────────────────────────
app.get('/api/search', async (req, res) => {
  try {
    const keyword = (req.query.q || '').trim();
    if (!keyword || keyword.length < 2) return res.status(400).json({ error: 'Query too short (min 2 chars)' });

    const sql = `
      WITH matches AS (
        -- Match in conversation subject
        SELECT c.id AS conversation_id, c.subject, 'subject' AS match_source,
               c.subject AS snippet, c.created_at
        FROM \`${FRONT}.conversation\` c
        ${SALES_INBOX_FILTER}
        WHERE LOWER(c.subject) LIKE LOWER(CONCAT('%', @keyword, '%'))

        UNION ALL

        -- Match in message body
        SELECT c.id AS conversation_id, c.subject, 'message' AS match_source,
               SUBSTR(m.body, GREATEST(1, STRPOS(LOWER(m.body), LOWER(@keyword)) - 60), 160) AS snippet,
               c.created_at
        FROM \`${FRONT}.message\` m
        JOIN \`${FRONT}.conversation\` c ON c.id = m.conversation_id
        ${SALES_INBOX_FILTER}
        WHERE LOWER(m.body) LIKE LOWER(CONCAT('%', @keyword, '%'))

        UNION ALL

        -- Match in quote_data
        SELECT c.id AS conversation_id, c.subject, 'quote' AS match_source,
               SUBSTR(CAST(q.quote_data AS STRING), GREATEST(1, STRPOS(LOWER(CAST(q.quote_data AS STRING)), LOWER(@keyword)) - 60), 160) AS snippet,
               c.created_at
        FROM \`${AI}.email_quote_requests\` q
        JOIN \`${FRONT}.conversation\` c ON c.id = q.front_conversation_id
        ${SALES_INBOX_FILTER}
        WHERE LOWER(CAST(q.quote_data AS STRING)) LIKE LOWER(CONCAT('%', @keyword, '%'))

        UNION ALL

        -- Match in quote_request_number (QRN)
        SELECT c.id AS conversation_id, c.subject, 'qrn' AS match_source,
               CONCAT('QRN: ', q.quote_request_number) AS snippet,
               c.created_at
        FROM \`${AI}.email_quote_requests\` q
        JOIN \`${FRONT}.conversation\` c ON c.id = q.front_conversation_id
        ${SALES_INBOX_FILTER}
        WHERE q.quote_request_number IS NOT NULL
          AND LOWER(q.quote_request_number) LIKE LOWER(CONCAT('%', @keyword, '%'))
      )
      SELECT conversation_id, ANY_VALUE(subject) AS subject,
             ARRAY_AGG(DISTINCT match_source) AS sources,
             ANY_VALUE(snippet) AS snippet,
             MAX(created_at) AS created_at
      FROM matches
      GROUP BY conversation_id
      ORDER BY created_at DESC
      LIMIT 50
    `;

    const rows = await runQuery(sql, { keyword });
    res.json(rows.map(r => ({
      conversation_id: r.conversation_id,
      subject: r.subject || '(no subject)',
      sources: r.sources || [],
      snippet: (r.snippet || '').replace(/<[^>]*>/g, '').substring(0, 160),
      created_at: r.created_at?.value || null,
    })));
  } catch (err) {
    console.error('search error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ─── 8. CSV Download ──────────────────────────────────────
app.get('/api/download-conversations', async (req, res) => {
  try {
    const type = req.query.type || 'conversation-trend';
    const { startStr, endStr } = dateParams(req);

    let whereClause = '';
    if (type === 'conversation-trend') {
      whereClause = `WHERE c.created_at >= TIMESTAMP(@start) AND c.created_at <= TIMESTAMP(@end)`;
    } else if (type === 'team-assignments') {
      whereClause = `WHERE c.id IN (
        SELECT DISTINCT conversation_id
        FROM \`${FRONT}.conversation_status_history\`
        WHERE status = 'assign'
          AND updated_at >= TIMESTAMP(@start) AND updated_at <= TIMESTAMP(@end)
      )`;
    } else if (type === 'pending-replies') {
      // Handled separately below via Front.com API — not BigQuery
    }

    const sql = `
      SELECT
        c.id AS conversation_id,
        COALESCE(CONCAT(tm.first_name, ' ', tm.last_name), '—') AS teammate,
        FORMAT_TIMESTAMP('%b %d, %Y %I:%M %p PST', c.created_at, '${TZ}') AS created_date,
        CONCAT(CAST(TIMESTAMP_DIFF(CURRENT_TIMESTAMP(), c.created_at, DAY) AS STRING), 'd') AS age,
        c.subject,
        STRING_AGG(DISTINCT t.name, ', ' ORDER BY t.name) AS tags,
        c.status_category AS status
      FROM \`${FRONT}.conversation\` c
      LEFT JOIN \`${FRONT}.teammate\` tm ON tm.id = c.teammate_id
      LEFT JOIN \`${FRONT}.conversation_tag\` ct ON ct.conversation_id = c.id
      LEFT JOIN \`${FRONT}.tag\` t ON t.id = ct.tag_id
      ${whereClause}
      GROUP BY c.id, tm.first_name, tm.last_name, c.created_at, c.subject, c.status_category
      ORDER BY c.created_at DESC
    `;

    // ── Pending Replies CSV: sourced from Front.com API, not BigQuery ──
    if (type === 'pending-replies') {
      const convs = await fetchPendingReplies();
      const headers = ['Conversation ID', 'Teammate', 'Created Date', 'Age (hrs)', 'Subject', 'Tags'];
      const csvRows = [headers.join(',')];
      for (const r of convs) {
        const vals = [
          r.conversation_id,
          r.teammate,
          r.created_date,
          r.age_hours,
          r.subject,
          r.tags
        ].map(v => `"${String(v || '').replace(/"/g, '""')}"`);
        csvRows.push(vals.join(','));
      }
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="pending-replies.csv"');
      return res.send(csvRows.join('\n'));
    }

    // ── All other types: BigQuery ──
    const rows = await runQuery(sql, { start: startStr, end: endStr });

    const headers = ['Conversation ID', 'Teammate', 'Created Date', 'Age', 'Subject', 'Tags', 'Status'];
    const csvRows = [headers.join(',')];
    for (const r of rows) {
      const vals = [
        r.conversation_id,
        r.teammate,
        r.created_date,
        r.age,
        r.subject,
        r.tags || '',
        r.status || ''
      ].map(v => `"${String(v || '').replace(/"/g, '""')}"`);
      csvRows.push(vals.join(','));
    }

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${type}.csv"`);
    res.send(csvRows.join('\n'));
  } catch (err) {
    console.error('download error:', err);
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, '0.0.0.0', () => console.log(`Server running on port ${PORT}`));
