# Dashboard Configurations

## BigQuery Environment

| Setting | Value |
|---|---|
| Project | `possible-ace-317306` |
| Front Dataset | `front` |
| AI Dataset | `sm_stage_ai` |
| Timezone | `America/Los_Angeles` (PST/PDT) |
| Backend Port | 3001 |
| Frontend Port | 5173 |

### Date Handling
- Frontend sends ISO strings via query params `start` and `end`
- Backend converts: `.toISOString().replace('T',' ').replace('Z','')` then wraps in `TIMESTAMP()`
- All `FORMAT_TIMESTAMP` calls include `'America/Los_Angeles'` as third argument
- Default range (if no params): last 7 days

---

## Tables Used

| Table | Key Fields |
|---|---|
| `front.conversation` | `id`, `status`, `status_category`, `created_at`, `teammate_id`, `subject` |
| `front.conversation_tag` | `conversation_id`, `tag_id` |
| `front.tag` | `id`, `name` |
| `front.teammate` | `id`, `first_name`, `last_name` |
| `front.message` | `id`, `conversation_id`, `is_inbound`, `author_id`, `created_at` |
| `front.conversation_status_history` | `conversation_id`, `target_teammate_id`, `status`, `updated_at` |
| `front.conversation_inbox` | `conversation_id`, `inbox_id` |
| `front.inbox` | `id`, `name` |
| `sm_stage_ai.email_quote_requests` | `front_conversation_id`, `conversation_type`, `quote_data` (JSON), `converted_at` |

### conversation.status values
- `assigned` — assigned to a teammate
- `unassigned` — open but not assigned
- `archived` — closed/archived
- `deleted` — resolved/deleted
- "Open" = `status IN ('assigned', 'unassigned')`

### conversation.status_category values
- `open`, `archived`, etc. (human-readable version used in CSV downloads)

---

## Chart 1: Conversation Overview (Sidebar — Bar Chart)

### Endpoint
`GET /api/dashboard-stats?start=&end=`

### Date Filtered
Yes — `c.created_at BETWEEN start AND end`

### Visual
4 horizontal progress bars in the sidebar

### BigQuery Tables
- `front.conversation` (main)
- `front.conversation_tag` + `front.tag` (LEFT JOIN for direction/load tags)
- `sm_stage_ai.email_quote_requests` (LEFT JOIN for mode)

### Formulas

| Bar | SQL |
|---|---|
| Open | `COUNT(DISTINCT CASE WHEN status IN ('assigned','unassigned') THEN id END)` |
| Waiting | `COUNT(DISTINCT CASE WHEN status = 'unassigned' THEN id END)` |
| Resolved | `COUNT(DISTINCT CASE WHEN status = 'deleted' THEN id END)` |
| Archived | `COUNT(DISTINCT CASE WHEN status = 'archived' THEN id END)` |

### Bar Width Formula
```
width = Math.max(3, (value / max_of_all_4) * 100) + '%'
```

### Download
- Button: top-right of "Conversation Overview" header
- Download type: `conversation-trend` (all conversations in date range)
- Filename: `conversation-overview.csv`

---

## Chart 2: Direction Donut Charts (Sidebar — 4 Donuts)

### Endpoint
Same `/api/dashboard-stats` response, nested under `quotes` key

### Date Filtered
Yes — same `c.created_at` range as Conversation Overview

### Visual
4 conic-gradient donut charts with legends: Import, Export, Domestic, Cross-Trade

### Direction Totals (from conversation tags)

| Direction | Tag Match (`LOWER(t.name)`) | SQL |
|---|---|---|
| Import | `'import'` | `COUNT(DISTINCT CASE WHEN is_import=1 THEN id END)` |
| Export | `'export'` | `COUNT(DISTINCT CASE WHEN is_export=1 THEN id END)` |
| Domestic | `'domestic'` | `COUNT(DISTINCT CASE WHEN is_domestic=1 THEN id END)` |
| Cross-Trade | `'cross-trade'` | `COUNT(DISTINCT CASE WHEN is_crosstrade=1 THEN id END)` |

### Breakdown Slices (from conversation tags — load type)

Each direction has sub-counts per combined mode and load type:

| Slice | Match Logic | Example SQL (for Import) |
|---|---|---|
| OCEAN FCL | `mode='SEA' AND is_fcl=1` | `COUNT(DISTINCT CASE WHEN is_import=1 AND qr_mode='SEA' AND is_fcl=1 THEN id END)` |
| OCEAN LCL | `mode='SEA' AND is_lcl=1` | `COUNT(DISTINCT CASE WHEN is_import=1 AND qr_mode='SEA' AND is_lcl=1 THEN id END)` |
| AIR LCL | `mode='AIR' AND is_lcl=1` | `COUNT(DISTINCT CASE WHEN is_import=1 AND qr_mode='AIR' AND is_lcl=1 THEN id END)` |
| ROAD LTL | `mode='ROAD' AND is_ltl=1` | `COUNT(DISTINCT CASE WHEN is_import=1 AND qr_mode='ROAD' AND is_ltl=1 THEN id END)` |
| ROAD FTL | `mode='ROAD' AND is_ftl=1` | `COUNT(DISTINCT CASE WHEN is_import=1 AND qr_mode='ROAD' AND is_ftl=1 THEN id END)` |

Only slices with `count > 0` are shown. Sorted descending by count.

### Donut Colors

| Label | Color |
|---|---|
| FCL | `#5B86AD` |
| LCL | `#588B8B` |
| LTL | `#D1A677` |
| FTL | `#FB923C` |
| Fallback | cycles: `#818CF8`, `#34D399`, `#F472B6`, `#38BDF8`, `#FCD34D`, `#6366F1` |

### Response Shape
```json
{
  "total_open": 47,
  "total_waiting": 37,
  "total_resolved": 0,
  "total_archived": 17,
  "quotes": {
    "IMPORT":     { "total": 12, "breakdowns": [{"label":"LCL","count":8}, {"label":"FCL","count":3}] },
    "EXPORT":     { "total": 9,  "breakdowns": [{"label":"LCL","count":6}, {"label":"FCL","count":3}] },
    "DOMESTIC":   { "total": 3,  "breakdowns": [{"label":"LTL","count":2}, {"label":"FCL","count":1}] },
    "CROSSTRADE": { "total": 1,  "breakdowns": [{"label":"FCL","count":1}] }
  }
}
```

### Note on Mode Fields
The query also LEFT JOINs `email_quote_requests` and extracts `JSON_VALUE(q.quote_data, '$.mode')` as `qr_mode` (AIR/SEA/ROAD). These fields are computed in SQL (`import_air`, `export_sea`, etc.) but `buildBreakdowns()` currently only returns tag-based load types (FCL/LCL/LTL/FTL). Mode fields exist in the query but are not surfaced to the frontend.

---

## Chart 3: Team Assignments (Main Grid — 4 columns)

### Endpoint
`GET /api/team-table?start=&end=`

### Date Filtered
Yes — `conversation_status_history.updated_at BETWEEN start AND end`

### Visual
Table with 3 columns

### BigQuery Tables
- `front.conversation_status_history` — assignment events
- `front.teammate` — names
- `front.conversation` — current assignment state

### Columns

| Column | Formula |
|---|---|
| Teammate | `CONCAT(tm.first_name, ' ', tm.last_name)` |
| Assigned | `COUNT(DISTINCT conversation_id)` from `conversation_status_history` WHERE `status = 'assign'` AND `updated_at` in date range, per `target_teammate_id` |
| Reassigned | Distinct conversations assigned to teammate that were later re-assigned to a DIFFERENT teammate. Uses `EXISTS` subquery: `a2.updated_at > a1.updated_at AND a2.target_teammate_id != a1.target_teammate_id` |

### Sorting
Descending by Assigned. Only teammates with `total > 0`.

### Download
- Button: top-right of panel header
- Download type: `team-assignments`
- Filter: conversations in `conversation_status_history` with `status = 'assign'` AND `updated_at` in date range
- Filename: `team-assignments.csv`

---

## Chart 4: Conversation Trend (Main Grid — 8 columns)

### Endpoint
`GET /api/conversation-trend?start=&end=`

### Date Filtered
Yes — `conversation.created_at BETWEEN start AND end`

### Visual
Two SVG trend lines with area fills and hover tooltips:
1. **Conversations** (Primary)
2. **Replies** (Secondary)

### BigQuery Tables
- `front.conversation` — `created_at`
- `front.message` — `created_at` where `is_inbound = false`

### SQL
```sql
WITH convs AS (
  SELECT DATE(created_at) AS day, COUNT(*) AS count_conversations
  FROM `possible-ace-317306.front.conversation`
  WHERE created_at >= TIMESTAMP(start) AND created_at <= TIMESTAMP(end)
  GROUP BY 1
),
replies AS (
  SELECT DATE(created_at) AS day, COUNT(*) AS count_replies
  FROM `possible-ace-317306.front.message`
  WHERE created_at >= TIMESTAMP(start) AND created_at <= TIMESTAMP(end)
  AND is_inbound = false
  GROUP BY 1
)
SELECT 
  COALESCE(c.day, r.day) AS day,
  COALESCE(c.count_conversations, 0) AS conversations,
  COALESCE(r.count_replies, 0) AS replies
FROM convs c
FULL OUTER JOIN replies r ON c.day = r.day
ORDER BY day
```

### Tooltip (on hover)
Shows date and both values:
- "Mar 5, 2026"
- Conversations: 50
- Replies: 120

### Chart Config
- **Conversations Line**: `#5B86AD` (Blue)
- **Conversations Fill**: `rgba(91, 134, 173, 0.08)`
- **Replies Line**: `#FF4081` (Pink)
- **Replies Fill**: `rgba(255, 64, 129, 0.08)`
- Grid lines: `#F3F4F6`
- Axis labels: `#9CA3AF`, font-size 10
- Tooltip bg: `#1e293b`, opacity 0.95
- Max 7 x-axis labels evenly spaced
- Point radius: 3.5 (normal), 5 (hover)

### Download
- Button: top-right of panel header
- Download type: `conversation-trend`
- Filter: all conversations with `created_at` in date range
- Filename: `conversation-trend.csv`

---

## Chart 5: Win Rate Trend (Management Dashboard)

### Endpoint
`GET /api/management-win-rate?start=&end=`

### Date Filtered
Yes — `c.created_at BETWEEN start AND end`

### Visual
SVG line chart — two lines (Won = green `#73be4b`, Lost = red `#f87171`) with area fills.
Tooltip shows: date, Won, Lost, Total, Win Rate %.

### BigQuery Tables
- `front.conversation` — `id`, `created_at`
- `front.conversation_tag` + `front.tag` — for `won`/`lost` tags
- `sm_stage_ai.email_quote_requests` — `front_conversation_id`, `quote_request_number`
- Sales Team inbox filter applied via `SALES_INBOX_FILTER`

### SQL (summary)
Groups by `DATE(c.created_at, 'America/Los_Angeles')`. Only rows where `quote_request_number IS NOT NULL`.
Per day: `won = COUNT(DISTINCT CASE WHEN tag='won')`, `lost = COUNT(DISTINCT CASE WHEN tag='lost')`, `total = COUNT(DISTINCT qrn)`.

### Response Shape
```json
[
  { "day": "2026-03-12", "total": 5, "won": 3, "lost": 1 },
  ...
]
```

### Win Rate Formula (client-side, per day)
```
win_rate = won / (won + lost) * 100   (shown in tooltip only)
```

### Chart Config
- **Won Line**: `#73be4b` (accent green), fill `rgba(115,190,75,0.08)`
- **Lost Line**: `#f87171` (red-400), fill `rgba(248,113,113,0.08)`
- Y-axis: count (0 → max of won/lost)
- X-axis: up to 7 evenly-spaced date labels
- Point radius: 3, stroke white 1.5
- Grid lines: `#F3F4F6`

### Download
- Button: top-right of "Win Rate Trend" panel header
- Type param: `management-win-rate` (handled client-side, not via `/api/download-conversations`)
- Columns: Date, Won, Lost, Total, Win Rate (%)
- Filename: `management-win-rate.csv`

---

## Chart 6: Freight Breakdown (Management Dashboard)

### Endpoint
`GET /api/management-freight-breakdown?start=&end=`

### Date Filtered
Yes — `c.created_at BETWEEN start AND end`

### Visual
- **KPI Cards row** (5 columns): one card per direction (Import, Export, Domestic, Customs, Cross-Trade).
  Each card shows: total, % of grand total, Won count, Lost count, Win %, Loss %.
- **Mode Breakdown Table** (below cards): one row per direction × mode combination.
  Columns: Direction, Mode, Total, % of Direction, Won, Lost, Win %.

### BigQuery Tables
- `front.conversation` — `id`, `created_at`
- `front.conversation_tag` + `front.tag` — load type (fcl/lcl/ltl/ftl) and won/lost tags only
- `sm_stage_ai.email_quote_requests` — INNER JOIN on `front_conversation_id` WHERE `quote_request_number IS NOT NULL`; `JSON_VALUE(quote_data, '$.direction')` for direction; `quote_data.mode` for OCEAN/AIR/ROAD
- Sales Team inbox filter applied via `SALES_INBOX_FILTER`

### Direction Source
`JSON_VALUE(q.quote_data, '$.direction')` from `email_quote_requests`, lowercased.
Values: `import`, `export`, `domestic`, `crosstrade`. Customs shows 0 (not present in `quote_data.direction`).

### Mode Labels
| Condition | Label |
|---|---|
| `qr_mode='OCEAN' AND is_fcl=1` | OCEAN FCL |
| `qr_mode='OCEAN' AND is_lcl=1` | OCEAN LCL |
| `qr_mode='OCEAN'` (no load type) | OCEAN |
| `qr_mode='AIR'` | AIR |
| `qr_mode='ROAD' AND is_ltl=1` | ROAD LTL |
| `qr_mode='ROAD' AND is_ftl=1` | ROAD FTL |
| `qr_mode='ROAD'` (no load type) | ROAD |
| else | Other |

### Response Shape
```json
{
  "grand_total": 3368,
  "directions": [
    {
      "key": "import", "label": "Import", "total": 1464, "won": 310, "lost": 890,
      "modes": [
        { "label": "OCEAN FCL", "total": 600, "won": 140, "lost": 340 },
        { "label": "AIR",       "total": 200, "won": 60,  "lost": 100 }
      ]
    },
    { "key": "export",     "label": "Export",      ... },
    { "key": "domestic",   "label": "Domestic",    ... },
    { "key": "customs",    "label": "Customs",     ... },
    { "key": "crosstrade", "label": "Cross-Trade", ... }
  ]
}
```

### Client-side Formulas
- **Share %** = `direction.total / grand_total * 100`
- **% of Direction** (mode) = `mode.total / direction.total * 100`
- **Win %** = `won / (won + lost) * 100`
- **Loss %** = `lost / (won + lost) * 100`

### Download
- Button: top-right of "Freight Breakdown" panel header
- Type param: `management-freight-breakdown` (handled client-side, not via `/api/download-conversations`)
- Columns: Direction, Mode, Total, % of Direction, Won, Lost, Win %
- Filename: `management-freight-breakdown.csv`

---

## Chart 7: Pending Replies (Main Grid — 12 columns)

### Endpoint
`GET /api/zero-replies-conversations` (no date params)

### Data Source
**Front.com REST API** (real-time) — migrated from BigQuery on 2026-03-18.
No more 6-hour lag; data reflects Front.com current state at request time.

### Front API Call
```
GET https://api2.frontapp.com/conversations
  ?inbox_id=inb_kkq08          # Sales Team inbox
  &tag_id=tag_6si6eg           # zero-replies tag
  &q[statuses][]=assigned
  &q[statuses][]=unassigned
  &limit=100
```
Pagination: follows `_pagination.next` until exhausted.
Token: stored in `.env` as `FRONT_API_TOKEN`.

### Date Filtered
No — live current state view

### Visual
Table with 6 columns

### Columns

| Column | Field / Formula | Display |
|---|---|---|
| Teammate | `conv.assignee.first_name + last_name` or `—` | Avatar + name |
| Created Date | `new Date(conv.created_at * 1000).toLocaleString(...)` formatted in America/Los_Angeles | e.g., "Mar 06, 2026 08:30 AM PST" |
| Age | `Math.floor((Date.now() - createdMs) / 3_600_000)` | Displayed as `Xh` |
| Subject | `conv.subject` | Truncated via CSS (max-width 320px, ellipsis) |
| Tags | `conv.tags.map(t => t.name).join(', ')` | All tags, compact badges, wrapped |
| Conversation ID | `conv.id` | Monospace font |

### Sorting
`age_hours ASC` (oldest first)

### Download
- Button: top-right of panel header
- Download type: `pending-replies`
- Source: Front.com API (same `fetchPendingReplies()` function)
- Filename: `pending-replies.csv`
- Columns: Conversation ID, Teammate, Created Date, Age (hrs), Subject, Tags

---

## CSV Download Configuration

### Endpoint
`GET /api/download-conversations?type=X&start=&end=`

### Uniform CSV Headers (all types)

| # | Header | BigQuery Source |
|---|---|---|
| 1 | Conversation ID | `c.id` |
| 2 | Teammate | `COALESCE(CONCAT(tm.first_name, ' ', tm.last_name), '—')` |
| 3 | Created Date | `FORMAT_TIMESTAMP('%b %d, %Y', c.created_at, 'America/Los_Angeles')` |
| 4 | Age | `TIMESTAMP_DIFF(CURRENT_TIMESTAMP(), c.created_at, DAY)` — shown as `Xd` in CSV |
| 5 | Subject | `c.subject` |
| 6 | Tags | `STRING_AGG(DISTINCT t.name, ', ' ORDER BY t.name)` |
| 7 | Status | `c.status_category` (values: "open", "archived", etc.) |

### WHERE Clause per Type

| Type Param | WHERE Clause | Date Filtered |
|---|---|---|
| `conversation-trend` (default) | `c.created_at >= TIMESTAMP(start) AND c.created_at <= TIMESTAMP(end)` | Yes |
| `team-assignments` | `c.id IN (SELECT DISTINCT conversation_id FROM conversation_status_history WHERE status = 'assign' AND updated_at BETWEEN start AND end)` | Yes |
| `pending-replies` | `c.id IN (SELECT ... WHERE tag = 'zero-replies') AND c.status IN ('assigned','unassigned')` | No |

### BigQuery Tables (download query)
- `front.conversation` — `id`, `subject`, `status_category`, `created_at`, `teammate_id`
- `front.teammate` — `id`, `first_name`, `last_name`
- `front.conversation_tag` — `conversation_id`, `tag_id`
- `front.tag` — `id`, `name`
- `front.conversation_status_history` — `conversation_id`, `status`, `updated_at` (subquery for team-assignments type)

### Frontend CSV Generation
- Values double-quote wrapped, internal quotes escaped as `""`
- Blob MIME type: `text/csv;charset=utf-8;`
- Download triggered via programmatic `<a>` element click

### Download Buttons Summary

| Location | Position | Type Param | Date Filtered | Source | Filename |
|---|---|---|---|---|---|
| Conversation Overview (sidebar) | Next to section title | `conversation-trend` | Yes | BigQuery | `conversation-overview.csv` |
| Team Assignments (panel) | Panel header right | `team-assignments` | Yes | BigQuery | `team-assignments.csv` |
| Conversation Trend (panel) | Panel header right | `conversation-trend` | Yes | BigQuery | `conversation-trend.csv` |
| Pending Replies (panel) | Panel header right | `pending-replies` | No | **Front.com API** | `pending-replies.csv` |

---

## Date Presets (Frontend)

| Preset | Start | End |
|---|---|---|
| Today | today 00:00:00 | today 23:59:59.999 |
| Yesterday | yesterday 00:00:00 | yesterday 23:59:59.999 |
| This week to date | Sunday 00:00:00 | today 23:59:59.999 |
| Last 7 days | 6 days ago 00:00:00 | today 23:59:59.999 |
| Last week | prev Sunday 00:00:00 | prev Saturday 23:59:59.999 |
| Last month | 1st of prev month 00:00:00 | last day of prev month 23:59:59.999 |
| Last quarter | 1st of prev quarter 00:00:00 | last day of prev quarter 23:59:59.999 |
| Last year | Jan 1 prev year 00:00:00 | Dec 31 prev year 23:59:59.999 |
| This year to date | Jan 1 current year 00:00:00 | today 23:59:59.999 |
| Custom range | user-selected start | user-selected end |

Default: **Last 7 days**

---

## Branding

### Logo
- File: `webapp/client/src/assets/logo.png` (copied from `.tmp/Corporate Image/main logo.png`)
- Display: sidebar header, 160px wide, auto height
- Shows "Freight" (white on navy) + "Right" (navy on white)

### Favicon
- File: `webapp/client/src/assets/favicon.png` (from `.tmp/Corporate Image/32x32-All-caps.png`)

### Colors

| Name | Hex | Usage |
|---|---|---|
| Navy (primary) | `#1e3063` | Brand primary |
| Green (accent) | `#73be4b` | Active indicators |
| Chart blue | `#5B86AD` | Trend line, FCL donut |
| Chart teal | `#588B8B` | LCL donut |
| Chart gold | `#D1A677` | LTL donut |
| Chart orange | `#FB923C` | FTL donut |
