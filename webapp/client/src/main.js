// ─── Colors ──────────────────────────────────────────
const DONUT_COLORS = {
  'Ocean FCL': '#5B86AD', 'Ocean LCL': '#588B8B', 'Air LCL': '#D1A677',
  'Road LTL': '#FB923C', 'Road FTL': '#1e3063',
  'FCL': '#5B86AD', 'LCL': '#588B8B', 'LTL': '#D1A677', 'FTL': '#FB923C',
};
const FALLBACK_COLORS = ['#818CF8', '#34D399', '#F472B6', '#38BDF8', '#FCD34D', '#6366F1'];
const AVATAR_COLORS = ['#1e3063', '#73be4b', '#5B86AD', '#D1A677', '#FB923C', '#588B8B', '#FF4081', '#818CF8'];
const STATUS_CFG = {
  open:     { bg: 'bg-sea-fcl',      hex: '#5B86AD', label: 'Open' },
  waiting:  { bg: 'bg-road-ltl',     hex: '#FB923C', label: 'Waiting' },
  resolved: { bg: 'bg-accent-green', hex: '#73be4b', label: 'Resolved' },
  archived: { bg: 'bg-slate-400',    hex: '#9CA3AF', label: 'Archived' },
};

// Front conversation URL pattern
const FRONT_URL = 'https://app.frontapp.com/open/';

// ─── Date Range ──────────────────────────────────────
function getDateRange(preset) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const eod = d => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);

  switch (preset) {
    case 'today': return { start: today, end: eod(today) };
    case 'yesterday': { const y = new Date(today); y.setDate(y.getDate()-1); return { start: y, end: eod(y) }; }
    case 'this-week': { const s = new Date(today); s.setDate(s.getDate()-s.getDay()); return { start: s, end: eod(today) }; }
    case 'last-7': { const s = new Date(today); s.setDate(s.getDate()-6); return { start: s, end: eod(today) }; }
    case 'last-week': { const s = new Date(today); s.setDate(s.getDate()-s.getDay()-7); const e = new Date(s); e.setDate(e.getDate()+6); return { start: s, end: eod(e) }; }
    case 'last-month': { const s = new Date(now.getFullYear(), now.getMonth()-1, 1); const e = new Date(now.getFullYear(), now.getMonth(), 0); return { start: s, end: eod(e) }; }
    case 'last-quarter': { const cq = Math.floor(now.getMonth()/3); const s = new Date(now.getFullYear(), (cq-1)*3, 1); const e = new Date(now.getFullYear(), cq*3, 0); return { start: s, end: eod(e) }; }
    case 'last-year': { return { start: new Date(now.getFullYear()-1,0,1), end: eod(new Date(now.getFullYear()-1,11,31)) }; }
    case 'ytd': return { start: new Date(now.getFullYear(),0,1), end: eod(today) };
    default: return { start: today, end: eod(today) };
  }
}

let currentRange = getDateRange('last-7');
const API_BASE_URL = window.location.hostname === 'localhost' ? '' : 'https://front-report.onrender.com';
const api = async (url) => { 
  const r = await fetch(API_BASE_URL + url); 
  if (!r.ok) throw new Error(r.status); 
  return r.json(); 
};

// ─── Loading Overlay ─────────────────────────────────
const loadingOverlay = document.createElement('div');
loadingOverlay.id = 'loadingOverlay';
loadingOverlay.className = 'fixed inset-0 z-[60] bg-background-light/60 backdrop-blur-sm flex items-center justify-center pointer-events-auto transition-opacity duration-200';
loadingOverlay.innerHTML = `
  <div class="bg-white rounded-2xl shadow-lg px-8 py-6 flex flex-col items-center gap-3">
    <div class="size-8 border-3 border-primary/20 border-t-primary rounded-full animate-spin"></div>
    <span class="text-sm font-semibold text-primary">Loading dashboard…</span>
  </div>`;
loadingOverlay.style.display = 'none';
document.body.appendChild(loadingOverlay);

function showLoading() { loadingOverlay.style.display = 'flex'; }
function hideLoading() { loadingOverlay.style.display = 'none'; }

// ─── SPA Routing ─────────────────────────────────────
function navigateTo(page) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById(`page-${page}`)?.classList.add('active');

  document.querySelectorAll('.nav-tab').forEach(tab => {
    const isActive = tab.dataset.page === page;
    tab.className = `nav-tab flex flex-col items-center gap-1 ${isActive ? 'text-primary' : 'text-slate-400'}`;
    const icon = tab.querySelector('.material-symbols-outlined');
    if (icon) icon.style.fontVariationSettings = isActive ? "'FILL' 1" : "'FILL' 0";
  });

  // Show date picker only on dashboard
  const dp = document.getElementById('datePreset');
  if (dp) dp.style.display = page === 'dashboard' ? '' : 'none';
}

document.querySelectorAll('.nav-tab').forEach(tab => {
  tab.addEventListener('click', e => { e.preventDefault(); navigateTo(tab.dataset.page); });
});

// ─── Helpers ─────────────────────────────────────────
function avatarColor(name) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}

function initials(first, last) {
  return ((first?.[0] || '') + (last?.[0] || '')).toUpperCase();
}

function fmtMin(mins) {
  mins = Math.round(mins);
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60), m = mins % 60;
  if (h < 24) return `${h}h ${m}m`;
  return `${Math.floor(h/24)}d ${h%24}h`;
}

function escHtml(s) { return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

// ─── Render: KPI Cards ──────────────────────────────
function renderKPI(data) {
  document.getElementById('kpi-open').textContent = data.total_open.toLocaleString();
  document.getElementById('kpi-waiting').textContent = data.total_waiting.toLocaleString();
  document.getElementById('kpi-resolved').textContent = data.total_resolved.toLocaleString();
  document.getElementById('kpi-archived').textContent = data.total_archived.toLocaleString();
}

// ─── Render: Donuts (total count center, mode+type labels) ─
function renderDonuts(quotes) {
  const grid = document.getElementById('donutGrid');
  grid.innerHTML = '';

  const dirs = [
    { key: 'IMPORT', label: 'Import' }, { key: 'EXPORT', label: 'Export' },
    { key: 'DOMESTIC', label: 'Domestic' }, { key: 'CROSSTRADE', label: 'Cross-Trade' },
  ];

  for (const dir of dirs) {
    const d = quotes[dir.key] || { total: 0, breakdowns: [] };
    const slices = d.breakdowns.filter(b => b.count > 0);
    const total = slices.reduce((s, b) => s + b.count, 0) || 0;

    // Build SVG donut
    let circles = `<circle class="stroke-slate-100" cx="18" cy="18" fill="none" r="16" stroke-width="4"></circle>`;
    let offset = 0;

    slices.forEach((slice, i) => {
      const pct = (slice.count / total) * 100;
      const color = DONUT_COLORS[slice.label] || FALLBACK_COLORS[i % FALLBACK_COLORS.length];
      circles += `<circle cx="18" cy="18" fill="none" r="16" stroke="${color}" stroke-width="4" stroke-dasharray="${pct} ${100 - pct}" stroke-dashoffset="${-offset}"></circle>`;
      offset += pct;
    });

    // Legend items showing counts with mode+type labels
    const legendItems = slices.map((s, i) => {
      const color = DONUT_COLORS[s.label] || FALLBACK_COLORS[i % FALLBACK_COLORS.length];
      return `<span class="inline-flex items-center gap-1 text-[9px] text-slate-500"><span class="size-1.5 rounded-full inline-block" style="background:${color}"></span>${s.label}: ${s.count}</span>`;
    }).join(' ');

    grid.innerHTML += `
      <div class="bg-white dark:bg-background-dark/50 p-4 rounded-xl shadow-sm border border-primary/5 flex flex-col items-center">
        <div class="relative size-20 mb-2">
          <svg class="size-full rotate-[-90deg]" viewBox="0 0 36 36">${circles}</svg>
          <div class="absolute inset-0 flex items-center justify-center text-sm font-extrabold text-slate-700">${d.total}</div>
        </div>
        <span class="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">${dir.label}</span>
        <div class="flex flex-wrap justify-center gap-x-2 gap-y-0.5">${legendItems}</div>
      </div>`;
  }
}

// ─── Render: Conversation Trend ─────────────────────
function renderTrend(data) {
  const svg = document.getElementById('trendChart');
  const tooltip = document.getElementById('trendTooltip');
  svg.innerHTML = '';
  if (!data || !data.length) { svg.innerHTML = '<text x="50%" y="50%" text-anchor="middle" fill="#9CA3AF" font-size="12">No data</text>'; return; }

  const W = svg.getBoundingClientRect().width || 600;
  const H = 200;
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  const pad = { t: 16, r: 16, b: 32, l: 40 };
  const cw = W - pad.l - pad.r, ch = H - pad.t - pad.b;

  const maxV = Math.max(...data.map(d => Math.max(d.conversations, d.replies)), 1);
  const xS = data.length > 1 ? cw / (data.length - 1) : cw / 2;
  const x = i => pad.l + i * xS;
  const y = v => pad.t + ch - (v / maxV) * ch;

  const ns = 'http://www.w3.org/2000/svg';
  for (let i = 0; i <= 4; i++) {
    const yy = pad.t + (ch / 4) * i;
    const line = document.createElementNS(ns, 'line');
    Object.entries({ x1: pad.l, x2: W - pad.r, y1: yy, y2: yy, stroke: '#F3F4F6', 'stroke-width': 1 }).forEach(([k, v]) => line.setAttribute(k, v));
    svg.appendChild(line);
    const lbl = document.createElementNS(ns, 'text');
    lbl.setAttribute('x', pad.l - 6); lbl.setAttribute('y', yy + 3);
    lbl.setAttribute('text-anchor', 'end'); lbl.setAttribute('fill', '#9CA3AF'); lbl.setAttribute('font-size', '9');
    lbl.textContent = Math.round(maxV - (maxV / 4) * i);
    svg.appendChild(lbl);
  }

  const step = Math.max(1, Math.floor(data.length / 7));
  data.forEach((d, i) => {
    if (i % step !== 0 && i !== data.length - 1) return;
    const lbl = document.createElementNS(ns, 'text');
    lbl.setAttribute('x', x(i)); lbl.setAttribute('y', H - 6);
    lbl.setAttribute('text-anchor', 'middle'); lbl.setAttribute('fill', '#9CA3AF'); lbl.setAttribute('font-size', '9');
    const dt = new Date(d.day + 'T00:00:00');
    lbl.textContent = dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    svg.appendChild(lbl);
  });

  function draw(key, lineColor, fillColor) {
    let aD = `M ${x(0)} ${y(data[0][key])}`;
    for (let i = 1; i < data.length; i++) aD += ` L ${x(i)} ${y(data[i][key])}`;
    aD += ` L ${x(data.length-1)} ${pad.t+ch} L ${x(0)} ${pad.t+ch} Z`;
    const area = document.createElementNS(ns, 'path');
    area.setAttribute('d', aD); area.setAttribute('fill', fillColor);
    svg.appendChild(area);

    let lD = `M ${x(0)} ${y(data[0][key])}`;
    for (let i = 1; i < data.length; i++) lD += ` L ${x(i)} ${y(data[i][key])}`;
    const line = document.createElementNS(ns, 'path');
    line.setAttribute('d', lD); line.setAttribute('fill', 'none');
    line.setAttribute('stroke', lineColor); line.setAttribute('stroke-width', '2');
    svg.appendChild(line);

    data.forEach((d, i) => {
      const c = document.createElementNS(ns, 'circle');
      c.setAttribute('cx', x(i)); c.setAttribute('cy', y(d[key]));
      c.setAttribute('r', '3'); c.setAttribute('fill', lineColor);
      c.setAttribute('stroke', '#fff'); c.setAttribute('stroke-width', '1.5');
      svg.appendChild(c);
    });
  }

  draw('conversations', '#5B86AD', 'rgba(91,134,173,0.08)');
  draw('replies', '#FF4081', 'rgba(255,64,129,0.08)');

  data.forEach((d, i) => {
    const hit = document.createElementNS(ns, 'rect');
    hit.setAttribute('x', x(i) - xS/2); hit.setAttribute('y', pad.t);
    hit.setAttribute('width', xS); hit.setAttribute('height', ch);
    hit.setAttribute('fill', 'transparent');
    hit.addEventListener('mouseenter', () => {
      tooltip.classList.remove('hidden');
      const dt = new Date(d.day + 'T00:00:00');
      tooltip.innerHTML = `<strong>${dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</strong><br>Conversations: ${d.conversations}<br>Replies: ${d.replies}`;
    });
    hit.addEventListener('mousemove', e => {
      const cr = svg.closest('.relative').getBoundingClientRect();
      tooltip.style.left = (e.clientX - cr.left + 12) + 'px';
      tooltip.style.top = (e.clientY - cr.top - 40) + 'px';
    });
    hit.addEventListener('mouseleave', () => tooltip.classList.add('hidden'));
    svg.appendChild(hit);
  });
}

// ─── Render: Top 5 Accounts ─────────────────────────
function renderTopAccounts(data) {
  const el = document.getElementById('topAccounts');
  if (!data || !data.length) { el.innerHTML = '<div class="text-xs text-slate-400 text-center py-4">No account data</div>'; return; }
  const maxT = Math.max(...data.map(d => d.total), 1);

  el.innerHTML = data.map(acc => {
    const segs = ['open', 'waiting', 'resolved', 'archived']
      .filter(s => acc[s] > 0)
      .map(s => `<div class="h-full ${STATUS_CFG[s].bg} rounded" style="width:${(acc[s]/maxT)*100}%" title="${STATUS_CFG[s].label}: ${acc[s]}"></div>`)
      .join('');

    return `<div class="space-y-1.5">
      <div class="flex justify-between text-xs font-bold text-slate-600"><span>${escHtml(acc.account_name)}</span><span>${acc.total} requests</span></div>
      <div class="h-2 w-full bg-slate-100 rounded-full overflow-hidden flex">${segs}</div>
    </div>`;
  }).join('');
}

// ─── Render: Team Performance Table ─────────────────
function renderTeam(data) {
  const tbody = document.getElementById('teamBody');
  if (!data || !data.length) { tbody.innerHTML = '<tr><td colspan="7" class="px-4 py-6 text-center text-xs text-slate-400">No data</td></tr>'; return; }

  tbody.innerHTML = data.map(tm => {
    const ini = initials(tm.first_name, tm.last_name);
    const c = avatarColor(tm.name);
    return `<tr>
      <td class="px-4 py-3"><div class="flex items-center gap-2 whitespace-nowrap">
        <div class="size-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white" style="background:${c}">${ini}</div>
        <span class="text-xs font-semibold text-slate-700">${escHtml(tm.name)}</span>
      </div></td>
      <td class="px-3 py-3 text-center text-xs font-medium text-slate-600">${tm.assigned_conversations}</td>
      <td class="px-3 py-3 text-center text-xs font-medium text-slate-600">${tm.touched_conversations}</td>
      <td class="px-3 py-3 text-center text-xs font-medium text-slate-600">${tm.messages_sent}</td>
      <td class="px-3 py-3 text-center text-xs font-medium text-slate-600">${tm.replies_sent}</td>
      <td class="px-3 py-3 text-center text-xs font-medium text-slate-600 whitespace-nowrap">${fmtMin(tm.avg_reply_minutes)}</td>
      <td class="px-3 py-3 text-center text-xs font-medium text-slate-600 whitespace-nowrap">${fmtMin(tm.avg_first_reply_minutes)}</td>
    </tr>`;
  }).join('');
}

// ─── Render: Pending Replies (with conversation link) ─
function renderPending(data) {
  const tbody = document.getElementById('pendingBody');
  if (!data || !data.length) { tbody.innerHTML = '<tr><td colspan="4" class="px-4 py-6 text-center text-xs text-slate-400">No pending replies</td></tr>'; return; }

  tbody.innerHTML = data.map(r => {
    const ini = initials(r.first_name, r.last_name);
    const c = avatarColor(r.teammate);
    const age = r.age_hours < 24 ? `${r.age_hours}h` : `${Math.floor(r.age_hours/24)}d ${r.age_hours%24}h`;
    const ageColor = r.age_hours > 48 ? 'text-red-500' : r.age_hours > 12 ? 'text-amber-600' : 'text-slate-400';
    const frontLink = `${FRONT_URL}${r.conversation_id}`;

    return `<tr>
      <td class="px-4 py-3"><div class="flex items-center gap-2">
        <div class="size-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white" style="background:${c}">${ini}</div>
        <span class="text-xs font-semibold text-slate-700">${escHtml(r.teammate)}</span>
      </div></td>
      <td class="px-4 py-3 text-xs font-bold ${ageColor}">${age}</td>
      <td class="px-4 py-3 text-xs text-slate-500 truncate max-w-[200px]" title="${escHtml(r.subject)}">${escHtml(r.subject)}</td>
      <td class="px-4 py-3">
        <a href="${frontLink}" target="_blank" rel="noopener noreferrer"
           class="inline-flex items-center gap-1 text-[10px] font-mono text-primary hover:text-accent-green transition-colors"
           title="Open in Front">
          ${r.conversation_id}
          <span class="material-symbols-outlined text-[14px]">open_in_new</span>
        </a>
      </td>
    </tr>`;
  }).join('');
}

// ─── Render: Teams Directory Page ───────────────────
function renderTeamDirectory(data) {
  const el = document.getElementById('teamDirectory');
  if (!data || !data.length) { el.innerHTML = '<div class="p-6 text-center text-xs text-slate-400">No team data</div>'; return; }

  el.innerHTML = data.map(tm => {
    const ini = initials(tm.first_name, tm.last_name);
    const c = avatarColor(tm.name);
    return `<div class="p-4 flex items-center justify-between">
      <div class="flex items-center gap-3">
        <div class="h-12 w-12 rounded-full flex items-center justify-center text-sm font-bold text-white border border-slate-200 dark:border-slate-700" style="background:${c}">${ini}</div>
        <div>
          <p class="font-bold text-slate-900 dark:text-slate-100">${escHtml(tm.name)}</p>
          <p class="text-xs text-slate-500">${tm.assigned_conversations} assigned · ${tm.messages_sent} messages</p>
        </div>
      </div>
      <div class="flex flex-col items-end">
        <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
          <span class="w-1.5 h-1.5 rounded-full bg-green-500"></span>Active
        </span>
        <p class="text-[10px] text-slate-400 mt-1 font-medium">Avg reply: ${fmtMin(tm.avg_reply_minutes)}</p>
      </div>
    </div>`;
  }).join('');
}

// ─── CSV Download ────────────────────────────────────
document.querySelectorAll('.dl-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const type = btn.dataset.type;
    const useDateRange = type !== 'pending-replies';
    let url = `${API_BASE_URL}/api/download-conversations?type=${type}`;
    if (useDateRange) url += `&${qs()}`;
    window.open(url, '_blank');
  });
});

// ─── Date Picker ─────────────────────────────────────
const dateSelect = document.getElementById('datePreset');
const customDiv = document.getElementById('customRange');

dateSelect.addEventListener('change', () => {
  if (dateSelect.value === 'custom') { customDiv.classList.remove('hidden'); return; }
  customDiv.classList.add('hidden');
  currentRange = getDateRange(dateSelect.value);
  loadAll();
});

document.getElementById('applyCustom').addEventListener('click', () => {
  const s = document.getElementById('customStart').value;
  const e = document.getElementById('customEnd').value;
  if (s && e) {
    currentRange = { start: new Date(s + 'T00:00:00'), end: new Date(e + 'T23:59:59.999') };
    loadAll();
  }
});

// ─── Theme Toggle ────────────────────────────────────
document.getElementById('themeLight')?.addEventListener('click', () => {
  document.documentElement.classList.remove('dark');
});
document.getElementById('themeDark')?.addEventListener('click', () => {
  document.documentElement.classList.add('dark');
});

// ─── Load All Data ───────────────────────────────────
async function loadAll() {
  showLoading();
  const q = qs();
  try {
    const [stats, trend, team, pending, accounts] = await Promise.all([
      api(`/api/dashboard-stats?${q}`),
      api(`/api/conversation-trend?${q}`),
      api(`/api/team-performance?${q}`),
      api('/api/zero-replies-conversations'),
      api(`/api/top-accounts?${q}`),
    ]);

    renderKPI(stats);
    renderDonuts(stats.quotes);
    renderTrend(trend);
    renderTeam(team);
    renderPending(pending);
    renderTopAccounts(accounts);
    renderTeamDirectory(team);
  } catch (err) {
    console.error('Load error:', err);
  } finally {
    hideLoading();
  }
}

// ─── Init ────────────────────────────────────────────
navigateTo('dashboard');
loadAll();
