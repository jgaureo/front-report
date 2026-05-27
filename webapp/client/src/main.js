// ─── Firebase Auth ──────────────────────────────────
firebase.initializeApp({
  apiKey: "AIzaSyB9bzvJnQgQTsXajtKmOWXjut4gN9PRsLU",
  authDomain: "front-report.firebaseapp.com",
  projectId: "front-report",
  storageBucket: "front-report.firebasestorage.app",
  messagingSenderId: "797597961440",
  appId: "1:797597961440:web:9c975ccf35db6aa1b3d485",
});

const auth = firebase.auth();
const googleProvider = new firebase.auth.GoogleAuthProvider();
googleProvider.setCustomParameters({ hd: 'freightright.com' });

let currentUser = null;
let idToken = null;
let teamSchedules = {};

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
    case 'this-month': return { start: new Date(now.getFullYear(), now.getMonth(), 1), end: eod(today) };
    case 'this-quarter': { const cq = Math.floor(now.getMonth()/3); return { start: new Date(now.getFullYear(), cq*3, 1), end: eod(today) }; }
    case 'last-7':{ const s = new Date(today); s.setDate(s.getDate()-6); return { start: s, end: eod(today) }; }
    case 'last-week': { const s = new Date(today); s.setDate(s.getDate()-s.getDay()-7); const e = new Date(s); e.setDate(e.getDate()+6); return { start: s, end: eod(e) }; }
    case 'last-month': { const s = new Date(now.getFullYear(), now.getMonth()-1, 1); const e = new Date(now.getFullYear(), now.getMonth(), 0); return { start: s, end: eod(e) }; }
    case 'last-quarter': { const cq = Math.floor(now.getMonth()/3); const s = new Date(now.getFullYear(), (cq-1)*3, 1); const e = new Date(now.getFullYear(), cq*3, 0); return { start: s, end: eod(e) }; }
    case 'last-year': { return { start: new Date(now.getFullYear()-1,0,1), end: eod(new Date(now.getFullYear()-1,11,31)) }; }
    case 'ytd': return { start: new Date(now.getFullYear(),0,1), end: eod(today) };
    default: return { start: today, end: eod(today) };
  }
}

let currentRange = getDateRange('this-month');
const selectedSources = new Set();
const selectedClassifications = new Set();
const API_BASE_URL = window.location.hostname === 'localhost' ? '' : 'https://front-report.onrender.com';
const qs = () => {
  const base = `start=${currentRange.start.toISOString()}&end=${currentRange.end.toISOString()}`;
  const src = selectedSources.size ? `&source=${[...selectedSources].join(',')}` : '';
  const cls = selectedClassifications.size ? `&classification=${[...selectedClassifications].join(',')}` : '';
  return base + src + cls;
};
const api = async (url, opts = {}, _retry) => {
  const headers = { ...(opts.headers || {}) };
  if (idToken) headers['Authorization'] = `Bearer ${idToken}`;
  const fetchOpts = { ...opts, headers };
  const r = await fetch(API_BASE_URL + url, fetchOpts);
  if (r.status === 401 && !_retry && currentUser) {
    idToken = await currentUser.getIdToken(true);
    return api(url, opts, true);
  }
  if (!r.ok) {
    let msg = String(r.status);
    try { const b = await r.json(); if (b.error) msg += ': ' + b.error; } catch {}
    throw new Error(msg);
  }
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

// ─── Toast Notifications ─────────────────────────────
const toastContainer = document.createElement('div');
toastContainer.className = 'fixed top-16 left-1/2 -translate-x-1/2 z-[80] flex flex-col items-center gap-2 pointer-events-none';
document.body.appendChild(toastContainer);

function showToast(message, type = 'success') {
  const colors = {
    success: 'bg-accent-green text-white',
    error: 'bg-red-500 text-white',
    info: 'bg-primary text-white',
  };
  const icons = { success: 'check_circle', error: 'error', info: 'info' };
  const toast = document.createElement('div');
  toast.className = `flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg text-sm font-semibold pointer-events-auto ${colors[type] || colors.info} opacity-0 translate-y-[-8px] transition-all duration-300`;
  toast.innerHTML = `<span class="material-symbols-outlined text-lg">${icons[type] || icons.info}</span>${escHtml(message)}`;
  toastContainer.appendChild(toast);
  requestAnimationFrame(() => { toast.classList.remove('opacity-0', 'translate-y-[-8px]'); });
  setTimeout(() => {
    toast.classList.add('opacity-0', 'translate-y-[-8px]');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

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

  // Show date picker and source filter only on pricing-dashboard and management-dashboard
  const onDash = page === 'pricing-dashboard' || page === 'management-dashboard';
  const dp = document.getElementById('datePreset');
  if (dp) dp.style.display = onDash ? '' : 'none';
  const sf = document.getElementById('sourceFilter');
  if (sf) sf.style.display = onDash ? '' : 'none';

  // Re-render SVG charts now that the page is visible and has real dimensions
  if (page === 'pricing-dashboard' && lastTrendData) renderTrend(lastTrendData);
  if (page === 'management-dashboard' && lastWinRateData) renderWinRateChart(lastWinRateData);
  if (page === 'management-dashboard' && lastWonByMonthData) renderWonByMonth(lastWonByMonthData);
  if (page === 'management-dashboard' && lastDirByMonthData) renderDirectionByMonth(lastDirByMonthData);
  if (page === 'management-dashboard' && lastConvPerOwnerData) renderConvPerOwner(lastConvPerOwnerData);
}

document.querySelectorAll('.nav-tab').forEach(tab => {
  tab.addEventListener('click', e => { e.preventDefault(); navigateTo(tab.dataset.page); });
});

// ─── Management sub-tab toggle: Current Pipeline | Aging Pipeline ─
function setMgmtSubTab(subPage) {
  document.querySelectorAll('.mgmt-sub-tab').forEach(btn => {
    const active = btn.dataset.subPage === subPage;
    btn.className = `mgmt-sub-tab px-4 py-2 text-sm font-bold rounded-lg border border-primary/10 ${
      active ? 'bg-primary text-white' : 'bg-white text-slate-500 hover:text-primary'
    }`;
  });
  document.getElementById('current-pipeline-content')?.classList.toggle('hidden', subPage !== 'current-pipeline');
  document.getElementById('aging-pipeline-content')?.classList.toggle('hidden', subPage !== 'aging-pipeline');
}
document.querySelectorAll('.mgmt-sub-tab').forEach(btn =>
  btn.addEventListener('click', () => setMgmtSubTab(btn.dataset.subPage))
);

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
  lastTrendData = data;
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

// ─── Chart data cache (for re-render on tab switch) ──
let lastTrendData = null;
let lastWinRateData = null;
let lastWonByMonthData = null;
let lastConvPerOwnerData = null;

// ─── Render: Team Performance Table ─────────────────
let teamData = [];
let teamSortKey = 'assigned_conversations';
let teamSortAsc = false;

function sortTeamData() {
  const sorted = [...teamData];
  sorted.sort((a, b) => {
    let va = a[teamSortKey], vb = b[teamSortKey];
    if (teamSortKey === 'name') {
      va = (va || '').toLowerCase(); vb = (vb || '').toLowerCase();
      return teamSortAsc ? va.localeCompare(vb) : vb.localeCompare(va);
    }
    return teamSortAsc ? va - vb : vb - va;
  });
  return sorted;
}

function updateSortArrows() {
  document.querySelectorAll('th[data-sort]').forEach(th => {
    const arrow = th.querySelector('.sort-arrow');
    if (th.dataset.sort === teamSortKey) {
      arrow.textContent = teamSortAsc ? '↑' : '↓';
    } else {
      arrow.textContent = '';
    }
  });
}

function renderTeam(data) {
  if (data) teamData = data;
  const tbody = document.getElementById('teamBody');
  if (!teamData || !teamData.length) { tbody.innerHTML = '<tr><td colspan="7" class="px-4 py-6 text-center text-xs text-slate-400">No data</td></tr>'; return; }

  const sorted = sortTeamData();
  updateSortArrows();
  tbody.innerHTML = sorted.map(tm => {
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
  const countEl = document.getElementById('teamCount');
  if (!data || !data.length) {
    el.innerHTML = '<div class="col-span-full p-6 text-center text-xs text-slate-400">No team data</div>';
    if (countEl) countEl.textContent = '';
    return;
  }
  if (countEl) countEl.textContent = `${data.length} teammate${data.length === 1 ? '' : 's'}`;

  el.innerHTML = data.map(tm => {
    const ini = initials(tm.first_name, tm.last_name);
    const c = avatarColor(tm.name);
    return `<div class="bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800 shadow-sm p-3 hover:shadow-md transition-shadow">
      <div class="flex items-start gap-3">
        <div class="size-10 shrink-0 rounded-full flex items-center justify-center text-xs font-bold text-white" style="background:${c}">${ini}</div>
        <div class="min-w-0 flex-1">
          <div class="flex items-start justify-between gap-2">
            <p class="text-sm font-bold text-slate-900 dark:text-slate-100 truncate leading-tight">${escHtml(tm.name)}</p>
            <button class="size-6 shrink-0 inline-flex items-center justify-center rounded-md text-slate-400 hover:text-primary hover:bg-primary/5 edit-schedule-btn" data-id="${tm.teammate_id}" data-name="${escHtml(tm.first_name)}" title="Edit schedule">
              <span class="material-symbols-outlined text-base">schedule</span>
            </button>
          </div>
          <span class="inline-flex items-center gap-1 mt-1 text-[10px] font-semibold uppercase tracking-wider text-green-700 dark:text-green-400">
            <span class="w-1.5 h-1.5 rounded-full bg-green-500"></span>Active
          </span>
        </div>
      </div>
      <div class="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 grid grid-cols-3 gap-1 text-center">
        <div>
          <p class="text-sm font-bold text-slate-900 dark:text-slate-100 tabular-nums">${tm.assigned_conversations}</p>
          <p class="text-[10px] uppercase tracking-wider text-slate-400 mt-0.5">Assigned</p>
        </div>
        <div class="border-x border-slate-100 dark:border-slate-800">
          <p class="text-sm font-bold text-slate-900 dark:text-slate-100 tabular-nums">${tm.messages_sent}</p>
          <p class="text-[10px] uppercase tracking-wider text-slate-400 mt-0.5">Msgs</p>
        </div>
        <div>
          <p class="text-sm font-bold text-slate-900 dark:text-slate-100 tabular-nums">${fmtMin(tm.avg_reply_minutes)}</p>
          <p class="text-[10px] uppercase tracking-wider text-slate-400 mt-0.5">Avg reply</p>
        </div>
      </div>
    </div>`;
  }).join('');
}

// ─── Render: Management Dashboard KPIs ──────────────
function renderManagementKPIs(data) {
  const container = document.getElementById('mgmtKpiCards');
  if (!data || !data.current) return;

  const c = data.current;
  const p = data.previous || {};
  const statuses = data.status_breakdown || [];
  const daily = data.daily || [];

  const fmt = n => Number(n).toLocaleString();

  // % change badge (invertColors=true means green when value drops, e.g. Lost)
  function changeBadge(curr, prev, invertColors = false) {
    if (!prev || prev === 0) return '<span class="text-[10px] text-slate-300 font-medium">—</span>';
    const pct = ((curr - prev) / prev) * 100;
    const up = pct >= 0;
    const good = invertColors ? !up : up;
    const color = good ? 'text-[#73be4b]' : 'text-red-400';
    const arrow = up ? '↑' : '↓';
    return `<span class="${color} text-[10px] font-bold bg-${good ? '[#73be4b]' : 'red-400'}/10 px-1.5 py-0.5 rounded">${arrow} ${Math.abs(pct).toFixed(1)}%</span>`;
  }

  // Win-rate change in percentage points (invertColors=true → green when rate drops, for Lost Rate)
  function winRateChangeBadge(curr, prev, invertColors = false) {
    if (prev == null) return '<span class="text-[10px] text-slate-300 font-medium">—</span>';
    const diff = curr - prev;
    const up = diff >= 0;
    const good = invertColors ? !up : up;
    const color = good ? 'text-[#73be4b]' : 'text-red-400';
    const arrow = up ? '↑' : '↓';
    return `<span class="${color} text-[10px] font-bold">${arrow} ${Math.abs(diff).toFixed(1)}pp</span>`;
  }

  // Mini sparkline SVG
  function sparkline(key, color) {
    if (daily.length < 2) return '';
    const vals = daily.map(d => Number(d[key]));
    const max = Math.max(...vals, 1);
    const W = 80, H = 34;
    const xs = i => (i / (vals.length - 1)) * (W - 4) + 2;
    const ys = v => H - 3 - (v / max) * (H - 8);
    const pts = vals.map((v, i) => `${xs(i)},${ys(v)}`).join(' L ');
    const last = vals[vals.length - 1];
    return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" class="overflow-visible flex-shrink-0">
      <defs><linearGradient id="sg-${key}" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="${color}" stop-opacity="0.25"/>
        <stop offset="100%" stop-color="${color}" stop-opacity="0"/>
      </linearGradient></defs>
      <path d="M ${pts} L ${xs(vals.length-1)},${H} L ${xs(0)},${H} Z" fill="url(#sg-${key})"/>
      <polyline points="${vals.map((v,i) => `${xs(i)},${ys(v)}`).join(' ')}" fill="none" stroke="${color}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
      <circle cx="${xs(vals.length-1)}" cy="${ys(last)}" r="2.5" fill="${color}" stroke="#fff" stroke-width="1.5"/>
    </svg>`;
  }

  // Semicircle gauge for win/loss rate (invert=true → thresholds flip so low=green, high=red)
  function rateGauge(rate, invert = false) {
    const r = 22, W = 54, H = 30;
    const cx = W / 2, cy = H;
    const x1 = cx - r, x2 = cx + r;
    const arcLen = Math.PI * r;
    const dash = Math.min(rate / 100, 1) * arcLen;
    const color = invert
      ? (rate <= 40 ? '#73be4b' : rate <= 65 ? '#f59e0b' : '#f87171')
      : (rate >= 60 ? '#73be4b' : rate >= 35 ? '#f59e0b' : '#f87171');
    return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" class="overflow-visible flex-shrink-0">
      <path d="M ${x1},${cy} A ${r},${r} 0 0,0 ${x2},${cy}" fill="none" stroke="#E2E8F0" stroke-width="5" stroke-linecap="round"/>
      <path d="M ${x1},${cy} A ${r},${r} 0 0,0 ${x2},${cy}" fill="none" stroke="${color}" stroke-width="5" stroke-linecap="round"
        stroke-dasharray="${dash.toFixed(1)} ${(arcLen + 1).toFixed(1)}"/>
    </svg>`;
  }
  const winGauge = rate => rateGauge(rate, false);
  const lossGauge = rate => rateGauge(rate, true);

  // Status tag breakdown bar + legend dots
  const STATUS_TAG_COLORS = {
    'Contacted':       '#5B86AD',
    'Need to Quote':   '#f59e0b',
    'Quoted':          '#73be4b',
    'Need to Requote': '#f97316',
    'Need to Onboard': '#8b5cf6',
    'Pending Review':  '#ec4899',
  };
  const statusTotal = statuses.reduce((s, st) => s + st.count, 0) || 1;
  const statusBar = statuses.length ? `
    <div class="flex w-full h-2 rounded-full overflow-hidden gap-px mt-3 mb-2.5">
      ${statuses.map(st => `<div style="width:${(st.count/statusTotal*100).toFixed(1)}%;background:${STATUS_TAG_COLORS[st.status]||'#9CA3AF'}" title="${st.status}: ${fmt(st.count)}"></div>`).join('')}
    </div>
    <div class="flex flex-wrap gap-x-3 gap-y-1.5">
      ${statuses.map(st => `
        <div class="flex items-center gap-1">
          <div class="size-2 rounded-sm flex-shrink-0" style="background:${STATUS_TAG_COLORS[st.status]||'#9CA3AF'}"></div>
          <span class="text-[9px] text-slate-500">${st.status}</span>
          <span class="text-[9px] font-bold text-slate-600 dark:text-slate-300">${fmt(st.count)}</span>
        </div>`).join('')}
    </div>` : '';

  const closed = c.won_conversations + c.lost_conversations;
  const quoted = c.quoted_conversations || 0;
  const winRatePct  = closed > 0 ? ((c.won_conversations  / closed) * 100).toFixed(1) : '0.0';
  const lossRatePct = closed > 0 ? ((c.lost_conversations / closed) * 100).toFixed(1) : '0.0';

  container.innerHTML = `
    <!-- Total Conversations -->
    <div class="bg-white dark:bg-background-dark/50 p-4 rounded-xl shadow-sm border border-primary/5">
      <div class="flex items-center justify-between mb-1">
        <div class="flex items-center gap-1">
          <p class="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Total Conversations</p>
          <button class="info-btn text-slate-400 hover:text-primary transition-colors leading-none" data-info-key="kpi-total" aria-label="About this metric"><span class="material-symbols-outlined text-[14px] align-middle">info</span></button>
        </div>
        ${changeBadge(c.total_conversations, p.total_conversations)}
      </div>
      <div class="flex items-end justify-between">
        <p class="text-3xl font-bold text-primary leading-none">${fmt(c.total_conversations)}</p>
        ${sparkline('total', '#5B86AD')}
      </div>
      ${statusBar}
      ${p.total_conversations ? `<p class="text-[9px] text-slate-400 mt-2">prev period: ${fmt(p.total_conversations)}</p>` : ''}
    </div>

    <!-- Won Conversations -->
    <div class="bg-white dark:bg-background-dark/50 p-4 rounded-xl shadow-sm border border-primary/5">
      <div class="flex items-center justify-between mb-1">
        <div class="flex items-center gap-1">
          <p class="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Won Conversations</p>
          <button class="info-btn text-slate-400 hover:text-primary transition-colors leading-none" data-info-key="kpi-won" aria-label="About this metric"><span class="material-symbols-outlined text-[14px] align-middle">info</span></button>
        </div>
        ${changeBadge(c.won_conversations, p.won_conversations)}
      </div>
      <div class="flex items-end justify-between">
        <p class="text-3xl font-bold text-[#73be4b] leading-none">${fmt(c.won_conversations)}</p>
        ${sparkline('won', '#73be4b')}
      </div>
      <div class="mt-2.5 flex items-center gap-2">
        <div class="flex-1 h-1.5 rounded-full bg-slate-100 overflow-hidden">
          <div class="h-full rounded-full bg-[#73be4b]" style="width:${winRatePct}%"></div>
        </div>
        <span class="text-[10px] font-bold text-[#73be4b] flex-shrink-0">${winRatePct}% of closed</span>
      </div>
      ${p.won_conversations != null ? `<p class="text-[9px] text-slate-400 mt-1.5">prev period: ${fmt(p.won_conversations)}</p>` : ''}
    </div>

    <!-- Lost Conversations -->
    <div class="bg-white dark:bg-background-dark/50 p-4 rounded-xl shadow-sm border border-primary/5">
      <div class="flex items-center justify-between mb-1">
        <div class="flex items-center gap-1">
          <p class="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Lost Conversations</p>
          <button class="info-btn text-slate-400 hover:text-primary transition-colors leading-none" data-info-key="kpi-lost" aria-label="About this metric"><span class="material-symbols-outlined text-[14px] align-middle">info</span></button>
        </div>
        ${changeBadge(c.lost_conversations, p.lost_conversations, true)}
      </div>
      <div class="flex items-end justify-between">
        <p class="text-3xl font-bold text-red-400 leading-none">${fmt(c.lost_conversations)}</p>
        ${sparkline('lost', '#f87171')}
      </div>
      <div class="mt-2.5 flex items-center gap-2">
        <div class="flex-1 h-1.5 rounded-full bg-slate-100 overflow-hidden">
          <div class="h-full rounded-full bg-red-400" style="width:${lossRatePct}%"></div>
        </div>
        <span class="text-[10px] font-bold text-red-400 flex-shrink-0">${lossRatePct}% of closed</span>
      </div>
      ${p.lost_conversations != null ? `<p class="text-[9px] text-slate-400 mt-1.5">prev period: ${fmt(p.lost_conversations)}</p>` : ''}
    </div>

    <!-- Win Rate -->
    <div class="bg-white dark:bg-background-dark/50 p-4 rounded-xl shadow-sm border border-primary/5">
      <div class="flex items-center justify-between mb-1">
        <div class="flex items-center gap-1">
          <p class="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Win Rate</p>
          <button class="info-btn text-slate-400 hover:text-primary transition-colors leading-none" data-info-key="kpi-win-rate" aria-label="About this metric"><span class="material-symbols-outlined text-[14px] align-middle">info</span></button>
        </div>
        ${winRateChangeBadge(c.win_rate, p.win_rate)}
      </div>
      <div class="flex items-end justify-between">
        <p class="text-3xl font-bold text-primary leading-none">${c.win_rate.toFixed(2)}%</p>
        ${winGauge(c.win_rate)}
      </div>
      <p class="text-[9px] text-slate-400 mt-2.5">${fmt(c.won_conversations)} won ÷ ${fmt(quoted)} quoted</p>
      ${p.win_rate != null ? `<p class="text-[9px] text-slate-400 mt-0.5">prev period: ${p.win_rate.toFixed(1)}%</p>` : ''}
    </div>

    <!-- Lost Rate -->
    <div class="bg-white dark:bg-background-dark/50 p-4 rounded-xl shadow-sm border border-primary/5">
      <div class="flex items-center justify-between mb-1">
        <div class="flex items-center gap-1">
          <p class="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Lost Rate</p>
          <button class="info-btn text-slate-400 hover:text-primary transition-colors leading-none" data-info-key="kpi-lost-rate" aria-label="About this metric"><span class="material-symbols-outlined text-[14px] align-middle">info</span></button>
        </div>
        ${winRateChangeBadge(c.lost_rate, p.lost_rate, true)}
      </div>
      <div class="flex items-end justify-between">
        <p class="text-3xl font-bold text-red-400 leading-none">${c.lost_rate.toFixed(2)}%</p>
        ${lossGauge(c.lost_rate)}
      </div>
      <p class="text-[9px] text-slate-400 mt-2.5">${fmt(c.lost_conversations)} lost ÷ ${fmt(quoted)} quoted</p>
      ${p.lost_rate != null ? `<p class="text-[9px] text-slate-400 mt-0.5">prev period: ${p.lost_rate.toFixed(1)}%</p>` : ''}
    </div>`;
}

// ─── Render: Win Rate Chart ──────────────────────────
function renderWinRateChart(data) {
  lastWinRateData = data;
  const svg = document.getElementById('winRateChart');
  const tooltip = document.getElementById('winRateTooltip');
  svg.innerHTML = '';
  if (!data || !data.length) {
    svg.innerHTML = '<text x="50%" y="50%" text-anchor="middle" fill="#9CA3AF" font-size="12">No data</text>';
    return;
  }

  const W = svg.getBoundingClientRect().width || 600;
  const H = 200;
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  const pad = { t: 16, r: 16, b: 32, l: 40 };
  const cw = W - pad.l - pad.r, ch = H - pad.t - pad.b;

  const maxV = Math.max(...data.map(d => Math.max(d.won, d.lost)), 1);
  const xS = data.length > 1 ? cw / (data.length - 1) : cw / 2;
  const x = i => pad.l + i * xS;
  const y = v => pad.t + ch - (v / maxV) * ch;

  const ns = 'http://www.w3.org/2000/svg';

  // Grid lines + Y labels
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

  // X-axis date labels
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

  // Draw line helper
  function drawLine(key, lineColor, fillColor) {
    let aD = `M ${x(0)} ${y(data[0][key])}`;
    for (let i = 1; i < data.length; i++) aD += ` L ${x(i)} ${y(data[i][key])}`;
    aD += ` L ${x(data.length - 1)} ${pad.t + ch} L ${x(0)} ${pad.t + ch} Z`;
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

  drawLine('won',  '#73be4b', 'rgba(115,190,75,0.08)');
  drawLine('lost', '#f87171', 'rgba(248,113,113,0.08)');

  // Hover hit areas
  data.forEach((d, i) => {
    const hit = document.createElementNS(ns, 'rect');
    hit.setAttribute('x', x(i) - xS / 2); hit.setAttribute('y', pad.t);
    hit.setAttribute('width', xS); hit.setAttribute('height', ch);
    hit.setAttribute('fill', 'transparent');
    const winRatePct = (d.won + d.lost) > 0 ? ((d.won / (d.won + d.lost)) * 100).toFixed(1) : '—';
    hit.addEventListener('mouseenter', () => {
      tooltip.classList.remove('hidden');
      const dt = new Date(d.day + 'T00:00:00');
      tooltip.innerHTML = `<strong>${dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</strong><br>Won: ${d.won} &nbsp; Lost: ${d.lost} &nbsp; Total: ${d.total}<br>Win Rate: ${winRatePct}%`;
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

// ─── Render: Active Conversations ────────────────────────
function renderActiveConversations(data) {
  const container = document.getElementById('activeConversations');
  if (!container) return;
  if (!data || !data.total) {
    container.innerHTML = '<div class="text-xs text-slate-400 text-center py-4">No data</div>';
    return;
  }

  const fmt = n => Number(n).toLocaleString();
  const { total, open_count, waiting_count, breakdown } = data;

  const STATUS_COLORS = {
    'Contacted':       '#5B86AD',
    'Need to Quote':   '#f59e0b',
    'Quoted':          '#73be4b',
    'Need to Requote': '#f97316',
    'Need to Onboard': '#8b5cf6',
    'Pending Review':  '#ec4899',
    'New':             '#9CA3AF',
  };

  // Build donut chart slices (responsive full-width)
  // Use sum of breakdown counts as denominator — convs can carry multiple
  // status tags, so Σ(breakdown) ≥ total. Scaling against `total` would
  // produce overlapping sweeps that exceed 360°.
  const breakdownSum = breakdown.reduce((s, b) => s + b.count, 0) || 1;
  const R = 75, r = 46, cx = 100, cy = 100;
  let angle = -Math.PI / 2;
  const slicePaths = breakdown.map(b => {
    const sweep = (b.count / breakdownSum) * 2 * Math.PI;
    const x1 = cx + R * Math.cos(angle);
    const y1 = cy + R * Math.sin(angle);
    angle += sweep;
    const x2 = cx + R * Math.cos(angle);
    const y2 = cy + R * Math.sin(angle);
    const ix1 = cx + r * Math.cos(angle - sweep);
    const iy1 = cy + r * Math.sin(angle - sweep);
    const ix2 = cx + r * Math.cos(angle);
    const iy2 = cy + r * Math.sin(angle);
    const large = sweep > Math.PI ? 1 : 0;
    const color = STATUS_COLORS[b.status] || '#9CA3AF';
    return `<path d="M ${ix1},${iy1} L ${x1},${y1} A ${R},${R} 0 ${large},1 ${x2},${y2} L ${ix2},${iy2} A ${r},${r} 0 ${large},0 ${ix1},${iy1} Z" fill="${color}" stroke="white" stroke-width="1.5">
      <title>${b.status}: ${fmt(b.count)}</title></path>`;
  }).join('');

  const pieSvg = `<svg width="100%" viewBox="0 0 200 200" class="block">
    ${slicePaths}
    <text x="100" y="94" text-anchor="middle" font-size="20" font-weight="bold" fill="#1e3063">${fmt(total)}</text>
    <text x="100" y="110" text-anchor="middle" font-size="11" fill="#9CA3AF">Total</text>
  </svg>`;

  const rows = breakdown.map(b => `
    <div class="flex items-center justify-between py-1 border-b border-slate-50 last:border-0">
      <div class="flex items-center gap-1.5">
        <div class="size-2 rounded-sm flex-shrink-0" style="background:${STATUS_COLORS[b.status]||'#9CA3AF'}"></div>
        <span class="text-[10px] text-slate-500">${b.status}</span>
      </div>
      <span class="text-[10px] font-bold text-slate-700 dark:text-slate-300">${fmt(b.count)}</span>
    </div>`).join('');

  container.innerHTML = `
    <div class="flex items-center gap-3">
      <div class="w-1/2 flex-shrink-0">${pieSvg}</div>
      <div class="flex-1 min-w-0">
        ${rows}
        <div class="flex flex-col gap-1 mt-3 pt-2 border-t border-slate-100">
          <div class="flex items-center gap-1.5">
            <div class="size-2 rounded-full bg-[#5B86AD]"></div>
            <span class="text-[10px] text-slate-400">Open: <span class="font-bold text-slate-600">${fmt(open_count)}</span></span>
          </div>
          <div class="flex items-center gap-1.5">
            <div class="size-2 rounded-full bg-[#9CA3AF]"></div>
            <span class="text-[10px] text-slate-400">Waiting: <span class="font-bold text-slate-600">${fmt(waiting_count)}</span></span>
          </div>
        </div>
      </div>
    </div>`;
}

// ─── Render: Conversations Per Owner ─────────────────────
const OWNER_PALETTE = ['#1e3063','#73be4b','#5B86AD','#f59e0b','#f87171','#8b5cf6','#ec4899','#f97316','#14b8a6','#6366f1','#d946ef','#0ea5e9'];

function renderConvPerOwner(data) {
  lastConvPerOwnerData = data;
  const svg = document.getElementById('convPerOwnerChart');
  const tooltip = document.getElementById('convPerOwnerTooltip');
  const legendEl = document.getElementById('convPerOwnerLegend');
  svg.innerHTML = '';
  if (legendEl) legendEl.innerHTML = '';

  const months = data?.months || [];
  const owners = (data?.owners || []).slice(0, 12); // cap at 12 owners
  const dataMap = data?.data || {};

  if (!months.length) {
    svg.innerHTML = '<text x="50%" y="50%" text-anchor="middle" fill="#9CA3AF" font-size="12">No data</text>';
    return;
  }

  const ownerColor = {};
  owners.forEach((o, i) => { ownerColor[o] = OWNER_PALETTE[i % OWNER_PALETTE.length]; });

  // Legend
  if (legendEl) {
    legendEl.innerHTML = owners.map(o => `
      <div class="flex items-center gap-1">
        <div class="size-2 rounded-sm flex-shrink-0" style="background:${ownerColor[o]}"></div>
        <span class="text-[9px] text-slate-500">${o}</span>
      </div>`).join('');
  }

  const W = svg.getBoundingClientRect().width || 560;
  const H = 240;
  const PAD = { top: 24, right: 12, bottom: 32, left: 36 };
  const chartW = W - PAD.left - PAD.right;
  const chartH = H - PAD.top - PAD.bottom;

  // Per-month totals
  const monthTotals = months.map(m => owners.reduce((s, o) => s + (dataMap[m]?.[o] || 0), 0));
  const maxTotal = Math.max(...monthTotals, 1);

  const barW = Math.min(40, (chartW / months.length) * 0.6);
  const barGap = chartW / months.length;
  const NS = 'http://www.w3.org/2000/svg';

  // Y gridlines + labels
  const ticks = 4;
  for (let i = 0; i <= ticks; i++) {
    const v = Math.round((maxTotal / ticks) * i);
    const y = PAD.top + chartH - (v / maxTotal) * chartH;
    const line = document.createElementNS(NS, 'line');
    line.setAttribute('x1', PAD.left); line.setAttribute('x2', PAD.left + chartW);
    line.setAttribute('y1', y); line.setAttribute('y2', y);
    line.setAttribute('stroke', '#E2E8F0'); line.setAttribute('stroke-width', '0.5');
    svg.appendChild(line);
    const lbl = document.createElementNS(NS, 'text');
    lbl.setAttribute('x', PAD.left - 4); lbl.setAttribute('y', y + 3);
    lbl.setAttribute('text-anchor', 'end'); lbl.setAttribute('font-size', '8'); lbl.setAttribute('fill', '#9CA3AF');
    lbl.textContent = v >= 1000 ? (v / 1000).toFixed(1) + 'k' : v;
    svg.appendChild(lbl);
  }

  // Bars + x labels
  months.forEach((m, mi) => {
    const barX = PAD.left + mi * barGap + (barGap - barW) / 2;
    let stackY = PAD.top + chartH;

    owners.forEach(o => {
      const cnt = dataMap[m]?.[o] || 0;
      if (!cnt) return;
      const bH = (cnt / maxTotal) * chartH;
      const rect = document.createElementNS(NS, 'rect');
      rect.setAttribute('x', barX); rect.setAttribute('y', stackY - bH);
      rect.setAttribute('width', barW); rect.setAttribute('height', bH);
      rect.setAttribute('fill', ownerColor[o]); rect.setAttribute('rx', '1');
      svg.appendChild(rect);
      stackY -= bH;
    });

    // Total label on top
    const total = monthTotals[mi];
    if (total > 0) {
      const topY = PAD.top + chartH - (total / maxTotal) * chartH - 4;
      const lbl = document.createElementNS(NS, 'text');
      lbl.setAttribute('x', barX + barW / 2); lbl.setAttribute('y', topY);
      lbl.setAttribute('text-anchor', 'middle'); lbl.setAttribute('font-size', '8');
      lbl.setAttribute('font-weight', 'bold'); lbl.setAttribute('fill', '#475569');
      lbl.textContent = total;
      svg.appendChild(lbl);
    }

    // X-axis label
    const xLbl = document.createElementNS(NS, 'text');
    xLbl.setAttribute('x', barX + barW / 2);
    xLbl.setAttribute('y', PAD.top + chartH + 12);
    xLbl.setAttribute('text-anchor', 'middle'); xLbl.setAttribute('font-size', '8'); xLbl.setAttribute('fill', '#94A3B8');
    const [yr, mo] = m.split('-');
    xLbl.textContent = new Date(+yr, +mo - 1, 1).toLocaleString('en-US', { month: 'short' }) + " '" + yr.slice(2);
    svg.appendChild(xLbl);

    // Invisible hit area for tooltip
    const hit = document.createElementNS(NS, 'rect');
    hit.setAttribute('x', barX); hit.setAttribute('y', PAD.top);
    hit.setAttribute('width', barW); hit.setAttribute('height', chartH);
    hit.setAttribute('fill', 'transparent');
    hit.addEventListener('mouseenter', () => {
      const lines = owners.filter(o => (dataMap[m]?.[o] || 0) > 0)
        .map(o => `<div><span style="color:${ownerColor[o]}">■</span> ${o}: <b>${(dataMap[m][o] || 0).toLocaleString()}</b></div>`).join('');
      tooltip.innerHTML = `<div class="font-bold mb-1">${xLbl.textContent}</div>${lines}<div class="mt-1 pt-1 border-t border-white/20 font-bold">Total: ${total.toLocaleString()}</div>`;
      tooltip.classList.remove('hidden');
      const cx = barX + barW / 2;
      let left = cx + 8;
      if (left + 140 > W) left = cx - 148;
      tooltip.style.left = left + 'px';
      tooltip.style.top = (PAD.top + chartH / 3) + 'px';
    });
    hit.addEventListener('mouseleave', () => tooltip.classList.add('hidden'));
    svg.appendChild(hit);
  });
}

// ─── Render: Won Conversation by Direction ───────────────
function renderWonByMonth(data) {
  lastWonByMonthData = data;
  const svg = document.getElementById('wonByMonthChart');
  const tooltip = document.getElementById('wonByMonthTooltip');
  const noteEl = document.getElementById('wonByMonthNote');
  svg.innerHTML = '';
  if (noteEl) noteEl.innerHTML = '';

  const months = data?.months || [];
  const no_qrn_total = data?.no_qrn_total || 0;

  if (!months.length) {
    svg.innerHTML = '<text x="50%" y="50%" text-anchor="middle" fill="#9CA3AF" font-size="12">No data</text>';
    return;
  }

  // Footnote for won conversations with no QRN
  if (noteEl && no_qrn_total > 0) {
    noteEl.innerHTML = `<div class="mt-3 flex items-start gap-2">
      <span class="text-[10px] text-slate-400 italic leading-relaxed">
        * ${no_qrn_total.toLocaleString()} won conversation(s) have no QRN attached and are excluded from the chart above.
      </span>
      <button id="dlNoQrnWonBtn" class="flex-shrink-0 inline-flex items-center gap-1 px-2 py-1 rounded text-[10px] font-bold text-primary bg-primary/10 hover:bg-primary/20 not-italic transition-colors">
        <span class="material-symbols-outlined text-[12px]">download</span>Download
      </button>
    </div>`;

    const dlBtn = noteEl.querySelector('#dlNoQrnWonBtn');
    if (dlBtn) {
      dlBtn.addEventListener('click', async () => {
        dlBtn.disabled = true;
        dlBtn.innerHTML = `<span class="material-symbols-outlined text-[12px] animate-spin">progress_activity</span>`;
        try {
          await downloadMgmtCsv('no-qrn-won', 'won-no-qrn-conversations.csv');
        } catch (err) {
          console.error('No-QRN won download error:', err);
        } finally {
          dlBtn.disabled = false;
          dlBtn.innerHTML = `<span class="material-symbols-outlined text-[12px]">download</span>Download`;
        }
      });
    }
  }

  const COLORS = { domestic: '#1e3063', import: '#5B86AD', export: '#73be4b', crosstrade: '#f87171', other: '#9CA3AF' };
  const STACK_KEYS = ['other', 'crosstrade', 'export', 'import', 'domestic']; // bottom → top

  const W = svg.getBoundingClientRect().width || 600;
  const H = 240;
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  const pad = { t: 24, r: 16, b: 36, l: 40 };
  const cw = W - pad.l - pad.r, ch = H - pad.t - pad.b;

  const maxV = Math.max(...months.map(d => d.total), 1);
  const slotW = cw / months.length;
  const barW = Math.max(6, Math.min(40, slotW * 0.55));
  const xCenter = i => pad.l + i * slotW + slotW / 2;
  const yPos = v => pad.t + ch - (v / maxV) * ch;

  const ns = 'http://www.w3.org/2000/svg';

  // Grid lines + Y labels
  for (let i = 0; i <= 4; i++) {
    const yy = pad.t + (ch / 4) * i;
    const gl = document.createElementNS(ns, 'line');
    Object.entries({ x1: pad.l, x2: W - pad.r, y1: yy, y2: yy, stroke: '#F3F4F6', 'stroke-width': 1 }).forEach(([k, v]) => gl.setAttribute(k, v));
    svg.appendChild(gl);
    const lbl = document.createElementNS(ns, 'text');
    lbl.setAttribute('x', pad.l - 6); lbl.setAttribute('y', yy + 3);
    lbl.setAttribute('text-anchor', 'end'); lbl.setAttribute('fill', '#9CA3AF'); lbl.setAttribute('font-size', '9');
    lbl.textContent = Math.round(maxV - (maxV / 4) * i);
    svg.appendChild(lbl);
  }

  // Stacked bars
  months.forEach((d, i) => {
    let stackBase = pad.t + ch;
    for (const key of STACK_KEYS) {
      const v = d[key] || 0;
      if (v === 0) continue;
      const bH = (v / maxV) * ch;
      stackBase -= bH;
      const rect = document.createElementNS(ns, 'rect');
      rect.setAttribute('x', xCenter(i) - barW / 2);
      rect.setAttribute('y', stackBase);
      rect.setAttribute('width', barW);
      rect.setAttribute('height', bH);
      rect.setAttribute('fill', COLORS[key]);
      svg.appendChild(rect);
    }
    // Total label on top
    if (d.total > 0) {
      const lbl = document.createElementNS(ns, 'text');
      lbl.setAttribute('x', xCenter(i));
      lbl.setAttribute('y', yPos(d.total) - 4);
      lbl.setAttribute('text-anchor', 'middle');
      lbl.setAttribute('fill', '#475569');
      lbl.setAttribute('font-size', '8');
      lbl.setAttribute('font-weight', 'bold');
      lbl.textContent = d.total;
      svg.appendChild(lbl);
    }
  });

  // Line overlay for total
  if (months.length > 1) {
    let lineD = months.map((d, i) => `${i === 0 ? 'M' : 'L'} ${xCenter(i)} ${yPos(d.total)}`).join(' ');
    const linePath = document.createElementNS(ns, 'path');
    linePath.setAttribute('d', lineD);
    linePath.setAttribute('fill', 'none');
    linePath.setAttribute('stroke', '#f59e0b');
    linePath.setAttribute('stroke-width', '2');
    linePath.setAttribute('stroke-linejoin', 'round');
    svg.appendChild(linePath);

    months.forEach((d, i) => {
      const dot = document.createElementNS(ns, 'circle');
      dot.setAttribute('cx', xCenter(i)); dot.setAttribute('cy', yPos(d.total));
      dot.setAttribute('r', '3'); dot.setAttribute('fill', '#f59e0b');
      dot.setAttribute('stroke', '#fff'); dot.setAttribute('stroke-width', '1.5');
      svg.appendChild(dot);
    });
  }

  // X-axis month labels
  const showYear = months.length > 0 && (new Set(months.map(d => d.month.slice(0, 4))).size > 1 || months.length <= 6);
  months.forEach((d, i) => {
    const [yr, mo] = d.month.split('-');
    const dt = new Date(Number(yr), Number(mo) - 1, 1);
    const label = dt.toLocaleDateString('en-US', { month: 'short' }) + (showYear ? ` '${yr.slice(2)}` : '');
    const lbl = document.createElementNS(ns, 'text');
    lbl.setAttribute('x', xCenter(i)); lbl.setAttribute('y', H - 6);
    lbl.setAttribute('text-anchor', 'middle'); lbl.setAttribute('fill', '#9CA3AF'); lbl.setAttribute('font-size', '8');
    lbl.textContent = label;
    svg.appendChild(lbl);
  });

  // Hover hit areas
  months.forEach((d, i) => {
    const hit = document.createElementNS(ns, 'rect');
    hit.setAttribute('x', xCenter(i) - slotW / 2); hit.setAttribute('y', pad.t);
    hit.setAttribute('width', slotW); hit.setAttribute('height', ch);
    hit.setAttribute('fill', 'transparent');
    hit.addEventListener('mouseenter', () => {
      tooltip.classList.remove('hidden');
      const [yr, mo] = d.month.split('-');
      const mLabel = new Date(Number(yr), Number(mo) - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      tooltip.innerHTML = `<strong>${mLabel}</strong><br>Total Won: ${d.total}<br>` +
        `Import: ${d.import} &nbsp; Export: ${d.export}<br>` +
        `Domestic: ${d.domestic} &nbsp; Cross-Trade: ${d.crosstrade}` +
        (d.other > 0 ? `<br>Other: ${d.other}` : '');
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

// ─── Render: Revenue / Onboard / Quoted (Postgres-backed) ─
const fmtUSD = n => {
  const v = Number(n) || 0;
  return v.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
};

let lastRevenueByCompanyData = null;
let lastNeedToOnboardRevenueData = null;
let lastQuotedPotentialRevenueData = null;

function renderRevenueByCompany(data) {
  lastRevenueByCompanyData = data;
  const el = document.getElementById('revenueByCompany');
  if (!el) return;
  const companies = data?.companies || [];
  if (!companies.length) {
    el.innerHTML = '<div class="text-xs text-slate-400 text-center py-4">No data</div>';
    return;
  }
  const grand = data.grand_total || companies.reduce((s, c) => s + c.quoted_value, 0);
  const max = Math.max(...companies.map(c => c.quoted_value), 1);

  el.innerHTML = `
    <table class="w-full text-xs">
      <thead>
        <tr class="text-[10px] uppercase tracking-wide text-slate-400 border-b border-slate-100">
          <th class="text-left font-semibold py-2">Company</th>
          <th class="text-right font-semibold py-2">QRNs</th>
          <th class="text-right font-semibold py-2">Quoted Value</th>
          <th class="text-right font-semibold py-2 w-32">% of Total</th>
        </tr>
      </thead>
      <tbody>
        ${companies.map(c => {
          const pct = grand > 0 ? (c.quoted_value / grand) * 100 : 0;
          const barW = (c.quoted_value / max) * 100;
          return `<tr class="border-b border-slate-50 last:border-0">
            <td class="py-2 font-semibold text-slate-700">${escHtml(c.name)}</td>
            <td class="py-2 text-right text-slate-500">${c.qrn_count}</td>
            <td class="py-2 text-right font-bold text-slate-700">${fmtUSD(c.quoted_value)}</td>
            <td class="py-2 text-right">
              <div class="flex items-center gap-2 justify-end">
                <div class="h-1.5 w-20 bg-slate-100 rounded-full overflow-hidden"><div class="h-full bg-primary rounded-full" style="width:${barW}%"></div></div>
                <span class="text-[10px] font-semibold text-slate-500 w-10 text-right">${pct.toFixed(1)}%</span>
              </div>
            </td>
          </tr>`;
        }).join('')}
      </tbody>
      <tfoot>
        <tr>
          <td class="pt-3 text-[10px] text-slate-400">Total across ${data.qrn_total || 0} QRN${data.qrn_total === 1 ? '' : 's'}</td>
          <td colspan="3" class="pt-3 text-right text-[10px] font-bold text-slate-600">${fmtUSD(grand)}</td>
        </tr>
      </tfoot>
    </table>`;
}

function renderDealList(elId, data, emptyMsg) {
  const el = document.getElementById(elId);
  if (!el) return;
  const deals = data?.deals || [];
  if (!deals.length) {
    el.innerHTML = `<div class="text-xs text-slate-400 text-center py-4">${emptyMsg}</div>`;
    return;
  }
  const total = data.total || 0;
  const rows = deals.map(d => `
    <tr class="border-b border-slate-50 last:border-0">
      <td class="py-2 font-mono text-[10px] text-slate-600">${escHtml(d.qrn)}</td>
      <td class="py-2 text-[10px] text-slate-500">${escHtml(d.stage || '—')}</td>
      <td class="py-2 text-[10px] text-slate-500">${escHtml(d.owner_name || '—')}</td>
      <td class="py-2 text-right font-bold text-[10px] text-slate-700">${fmtUSD(d.quoted_value)}</td>
    </tr>`).join('');

  el.innerHTML = `
    <div class="flex items-baseline justify-between mb-2">
      <span class="text-[10px] text-slate-400 uppercase tracking-wide font-semibold">${deals.length} deal${deals.length === 1 ? '' : 's'}</span>
      <span class="text-sm font-bold text-primary">${fmtUSD(total)}</span>
    </div>
    <div class="max-h-72 overflow-y-auto">
      <table class="w-full text-xs">
        <thead class="sticky top-0 bg-white dark:bg-background-dark/50">
          <tr class="text-[10px] uppercase tracking-wide text-slate-400 border-b border-slate-100">
            <th class="text-left font-semibold py-2">QRN</th>
            <th class="text-left font-semibold py-2">Status</th>
            <th class="text-left font-semibold py-2">Owner</th>
            <th class="text-right font-semibold py-2">Quoted Value</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
}

function renderNeedToOnboardRevenue(data) {
  lastNeedToOnboardRevenueData = data;
  renderDealList('needToOnboardRevenue', data, 'No deals in Need to Onboard stage');
}

function renderQuotedPotentialRevenue(data) {
  lastQuotedPotentialRevenueData = data;
  renderDealList('quotedPotentialRevenue', data, 'No deals in Quoted stage');
}

// ─── Render: QRN-Blank Tiles (Current Pipeline) ──────
function renderQrnBlankTiles(data) {
  const a = document.getElementById('qrnBlankSpam');
  const b = document.getElementById('qrnBlankResolved');
  if (a) a.textContent = (data?.blank_qrn_unresolved ?? 0).toLocaleString();
  if (b) b.textContent = (data?.blank_qrn_resolved   ?? 0).toLocaleString();
}

// ─── Render: Aging Pipeline ──────────────────────────
function renderAgingOpenTiles(data) {
  const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = (v ?? 0).toLocaleString(); };
  set('agingOpen3',  data?.older_3);
  set('agingOpen7',  data?.older_7);
  set('agingOpen14', data?.older_14);
  set('agingOpen30', data?.older_30);
}

function renderAgingOpenBuckets(data) {
  const el = document.getElementById('agingOpenBuckets');
  if (!el) return;
  const buckets = [
    { label: '0–3 days',   count: Number(data?.bucket_0_3    || 0) },
    { label: '3–7 days',   count: Number(data?.bucket_3_7    || 0) },
    { label: '7–14 days',  count: Number(data?.bucket_7_14   || 0) },
    { label: '14–30 days', count: Number(data?.bucket_14_30  || 0) },
    { label: '30+ days',   count: Number(data?.bucket_30_plus|| 0) },
  ];
  const total = buckets.reduce((s, b) => s + b.count, 0);
  if (!total) { el.innerHTML = '<div class="text-xs text-slate-400 text-center py-4">No open conversations</div>'; return; }
  const max = Math.max(...buckets.map(b => b.count), 1);
  const colors = ['#73be4b', '#5B86AD', '#f59e0b', '#FB923C', '#f87171'];
  el.innerHTML = `
    <table class="w-full text-xs">
      <thead>
        <tr class="text-[10px] uppercase tracking-wide text-slate-400 border-b border-slate-100">
          <th class="text-left font-semibold py-2">Age</th>
          <th class="text-right font-semibold py-2">Count</th>
          <th class="text-right font-semibold py-2 w-1/2">Share</th>
        </tr>
      </thead>
      <tbody>
        ${buckets.map((b, i) => {
          const pct = total ? (b.count / total) * 100 : 0;
          const barW = (b.count / max) * 100;
          return `<tr class="border-b border-slate-50 last:border-0">
            <td class="py-2 font-semibold text-slate-700">${b.label}</td>
            <td class="py-2 text-right font-bold text-slate-700">${b.count.toLocaleString()}</td>
            <td class="py-2">
              <div class="flex items-center gap-2 justify-end">
                <div class="h-1.5 flex-1 max-w-[60%] bg-slate-100 rounded-full overflow-hidden"><div class="h-full rounded-full" style="width:${barW}%;background:${colors[i]}"></div></div>
                <span class="text-[10px] font-semibold text-slate-500 w-10 text-right">${pct.toFixed(1)}%</span>
              </div>
            </td>
          </tr>`;
        }).join('')}
      </tbody>
      <tfoot>
        <tr>
          <td class="pt-3 text-[10px] text-slate-400">Total open</td>
          <td colspan="2" class="pt-3 text-right text-[10px] font-bold text-slate-600">${total.toLocaleString()}</td>
        </tr>
      </tfoot>
    </table>`;
}

function renderAgingFollowups(noFollowup, noResponse) {
  const f = document.getElementById('agingQuotedNoFollowup');
  const r = document.getElementById('agingQuotedNoResponse');
  if (f) f.textContent = (noFollowup?.count ?? 0).toLocaleString();
  if (r) r.textContent = (noResponse?.count ?? 0).toLocaleString();
}

function renderAgingQuotedValue(data) {
  const el = document.getElementById('agingQuotedValue');
  if (!el) return;
  const buckets = data?.buckets || [];
  const total_value = Number(data?.total_value || 0);
  const total_count = Number(data?.total_count || 0);
  if (!total_count) { el.innerHTML = '<div class="text-xs text-slate-400 text-center py-4">No open quoted deals</div>'; return; }
  const max = Math.max(...buckets.map(b => Number(b.value) || 0), 1);
  const colors = ['#73be4b', '#5B86AD', '#f59e0b', '#FB923C', '#f87171'];
  el.innerHTML = `
    <table class="w-full text-xs">
      <thead>
        <tr class="text-[10px] uppercase tracking-wide text-slate-400 border-b border-slate-100">
          <th class="text-left font-semibold py-2">Age</th>
          <th class="text-right font-semibold py-2">Deals</th>
          <th class="text-right font-semibold py-2">Quoted Value</th>
          <th class="text-right font-semibold py-2 w-1/3">Share</th>
        </tr>
      </thead>
      <tbody>
        ${buckets.map((b, i) => {
          const value = Number(b.value) || 0;
          const count = Number(b.count) || 0;
          const pct = total_value > 0 ? (value / total_value) * 100 : 0;
          const barW = (value / max) * 100;
          return `<tr class="border-b border-slate-50 last:border-0">
            <td class="py-2 font-semibold text-slate-700">${b.label}</td>
            <td class="py-2 text-right text-slate-500">${count.toLocaleString()}</td>
            <td class="py-2 text-right font-bold text-slate-700">${fmtUSD(value)}</td>
            <td class="py-2">
              <div class="flex items-center gap-2 justify-end">
                <div class="h-1.5 flex-1 max-w-[60%] bg-slate-100 rounded-full overflow-hidden"><div class="h-full rounded-full" style="width:${barW}%;background:${colors[i]}"></div></div>
                <span class="text-[10px] font-semibold text-slate-500 w-10 text-right">${pct.toFixed(1)}%</span>
              </div>
            </td>
          </tr>`;
        }).join('')}
      </tbody>
      <tfoot>
        <tr>
          <td class="pt-3 text-[10px] text-slate-400">${total_count} deal${total_count === 1 ? '' : 's'}</td>
          <td colspan="3" class="pt-3 text-right text-[10px] font-bold text-slate-600">${fmtUSD(total_value)}</td>
        </tr>
      </tfoot>
    </table>`;
}

function downloadCsvRows(rows, filename) {
  const csv = rows.map(r => r.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

function downloadRevenueByCompanyCsv(data, filename) {
  if (!data) return;
  const deals = data.deals || [];
  const rows = [['Company', 'QRN', 'Owner', 'Status', 'Quoted Value']];
  for (const d of deals) {
    rows.push([
      d.company || '',
      d.qrn || '',
      d.owner_name || '',
      d.quote_status || '',
      (Number(d.quoted_value) || 0).toFixed(2),
    ]);
  }
  downloadCsvRows(rows, filename);
}

function downloadDealListCsv(data, filename) {
  if (!data) return;
  const deals = data.deals || [];
  const rows = [['QRN', 'Company', 'Status', 'Owner', 'Quoted Value']];
  for (const d of deals) {
    rows.push([
      d.qrn || '',
      d.company || '',
      d.stage || '',
      d.owner_name || '',
      (Number(d.quoted_value) || 0).toFixed(2),
    ]);
  }
  downloadCsvRows(rows, filename);
}

// Shared renderer for the two stage tables. `firstColLabel` and `firstColKey`
// pick whether each row keys off `name` (rep) or `type` (business type).
function renderStageTable(elId, data, firstColLabel, firstColKey, emptyMsg) {
  const el = document.getElementById(elId);
  if (!el) return;
  const rows = data?.reps || data?.rows || [];
  const pipeline = data?.pipeline || ['Contacted', 'Need To Quote', 'Quoted', 'Need To Re-Quote', 'Need To Onboard', 'Won'];
  const side = data?.side || ['Lost', 'Unable To Quote'];
  if (!rows.length) {
    el.innerHTML = `<div class="text-xs text-slate-400 text-center py-4">${emptyMsg}</div>`;
    return;
  }
  // Header: first col + (stage count, stage %) per pipeline stage + side stages + Total + Win% + Loss%
  const stageHeaders = pipeline.map(stage => {
    const stageTh = `<th class="text-right font-semibold py-2 px-2 whitespace-nowrap">${escHtml(stage)}</th>`;
    const pctTh = `<th class="text-center font-semibold py-2 px-1 text-slate-300">%</th>`;
    return stageTh + pctTh;
  }).join('');
  const sideHeaders = side.map(s => `<th class="text-right font-semibold py-2 px-2 whitespace-nowrap text-slate-400">${escHtml(s)}</th>`).join('');

  // Total column count (first col + 2 cells per pipeline stage + side stages + Total + Win% + Loss%)
  const totalCols = 1 + pipeline.length * 2 + side.length + 3;

  const bodyRows = rows.map(r => {
    const counts = r.counts || {};
    const stageReach = Array.isArray(r.stage_reach) ? r.stage_reach : [];
    const stageCells = pipeline.map((stage, i) => {
      const sr = stageReach[i] || { count: 0, pct: 0 };
      const cellClass = stage === 'Won' ? 'font-bold text-success' : 'text-slate-700';
      const stageTd = `<td class="py-2 px-2 text-right ${cellClass}">${sr.count || 0}</td>`;
      const pct = Number(sr.pct) || 0;
      const tone = pct >= 50 ? 'text-success' : pct >= 20 ? 'text-amber-500' : 'text-slate-400';
      const pctTd = `<td class="py-2 px-1 text-center text-[10px] font-semibold ${tone}">${pct.toFixed(0)}%</td>`;
      return stageTd + pctTd;
    }).join('');
    const sideCells = side.map(s => `<td class="py-2 px-2 text-right text-slate-400">${counts[s] || 0}</td>`).join('');
    const customers = Array.isArray(r.customers) ? r.customers : null;
    const mainRow = `<tr class="border-b border-slate-50 last:border-0 hover:bg-slate-50/40">
      <td class="py-2 pr-3 font-semibold text-slate-700 whitespace-nowrap">${escHtml(r[firstColKey] || '—')}</td>
      ${stageCells}
      ${sideCells}
      <td class="py-2 px-2 text-right font-bold text-slate-700">${r.total || 0}</td>
      <td class="py-2 px-2 text-right font-bold text-success">${(r.win_pct || 0).toFixed(1)}%</td>
      <td class="py-2 px-2 text-right font-bold text-rose-500">${(r.loss_pct || 0).toFixed(1)}%</td>
    </tr>`;
    if (!customers || !customers.length) return mainRow;
    const customerRows = customers.map(c => `
      <tr class="text-[11px] text-slate-600">
        <td class="py-1 pl-4 pr-3 whitespace-nowrap">${escHtml(c.name || '—')}</td>
        <td class="py-1 px-2 text-right">${c.total || 0}</td>
        <td class="py-1 px-2 text-right text-success">${c.won || 0}</td>
        <td class="py-1 px-2 text-right text-rose-500">${c.lost || 0}</td>
        <td class="py-1 px-2 text-right">${(c.win_pct || 0).toFixed(1)}%</td>
      </tr>`).join('');
    const detailsRow = `<tr class="border-b border-slate-100">
      <td colspan="${totalCols}" class="p-0">
        <details class="group">
          <summary class="cursor-pointer text-[11px] text-slate-500 hover:text-slate-700 py-1 pl-4 select-none">
            <span class="group-open:hidden">▸ Show ${customers.length} customer${customers.length === 1 ? '' : 's'}</span>
            <span class="hidden group-open:inline">▾ Hide customers</span>
          </summary>
          <div class="pb-2 pl-2">
            <table class="w-auto text-[11px]">
              <thead>
                <tr class="text-[10px] uppercase tracking-wide text-slate-400">
                  <th class="text-left font-semibold py-1 pl-4 pr-3">Customer</th>
                  <th class="text-right font-semibold py-1 px-2">Quotes</th>
                  <th class="text-right font-semibold py-1 px-2">Won</th>
                  <th class="text-right font-semibold py-1 px-2">Lost</th>
                  <th class="text-right font-semibold py-1 px-2">Win %</th>
                </tr>
              </thead>
              <tbody>${customerRows}</tbody>
            </table>
          </div>
        </details>
      </td>
    </tr>`;
    return mainRow + detailsRow;
  }).join('');

  el.innerHTML = `
    <div class="overflow-x-auto">
      <table class="w-full text-xs">
        <thead>
          <tr class="text-[10px] uppercase tracking-wide text-slate-400 border-b border-slate-100">
            <th class="text-left font-semibold py-2 pr-3 whitespace-nowrap">${escHtml(firstColLabel)}</th>
            ${stageHeaders}
            ${sideHeaders}
            <th class="text-right font-semibold py-2 px-2">Total</th>
            <th class="text-right font-semibold py-2 px-2">Win %</th>
            <th class="text-right font-semibold py-2 px-2">Loss %</th>
          </tr>
        </thead>
        <tbody>${bodyRows}</tbody>
      </table>
    </div>
    <div class="mt-2 text-[10px] text-slate-400">
      Each stage shows the cumulative count of deals that reached it (i.e. deals currently bucketed at that stage or any later pipeline stage). The % beside it = that count ÷ the row's total deals.
    </div>`;
}

let lastQuoteStagesByRepData = null;
let lastQuoteStagesByBusinessTypeData = null;

function renderQuoteStagesByRep(data) {
  lastQuoteStagesByRepData = data;
  renderStageTable('quoteStagesByRep', data, 'Rep', 'name', 'No reps with quotes');
}

function renderQuoteStagesByBusinessType(data) {
  lastQuoteStagesByBusinessTypeData = data;
  renderStageTable('quoteStagesByBusinessType', data, 'Business Type', 'type', 'No deals classified');
}

function downloadStageTableCsv(data, firstColLabel, _firstColKey, filename) {
  if (!data) return;
  const deals = Array.isArray(data.deals) ? data.deals : [];
  const groupKey = firstColLabel === 'Rep' ? 'rep_name' : 'business_type';
  const rows = [[firstColLabel, 'QRN', 'Company', 'Owner', 'Stage', 'Quote Status', 'Quoted Value']];
  for (const d of deals) {
    rows.push([
      d[groupKey] || '',
      d.qrn || '',
      d.company || '',
      d.owner_name || d.rep_name || '',
      d.stage || '',
      d.quote_status || '',
      (Number(d.quoted_value) || 0).toFixed(2),
    ]);
  }
  downloadCsvRows(rows, filename);
}

// ─── Render: Direction by Month ──────────────────────────
let lastDirByMonthData = null;

function renderDirectionByMonth(data) {
  lastDirByMonthData = data;
  const svg = document.getElementById('dirByMonthChart');
  const tooltip = document.getElementById('dirByMonthTooltip');
  const tableEl = document.getElementById('dirByMonthTable');
  if (!svg) return;
  svg.innerHTML = '';
  if (tableEl) tableEl.innerHTML = '';

  const months = data?.months || [];
  if (!months.length) {
    svg.innerHTML = '<text x="50%" y="50%" text-anchor="middle" fill="#9CA3AF" font-size="12">No data</text>';
    return;
  }

  const COLORS = { domestic: '#1e3063', import: '#5B86AD', export: '#73be4b', crosstrade: '#f87171', other: '#9CA3AF' };
  const STACK_KEYS = ['other', 'crosstrade', 'export', 'import', 'domestic'];
  const DIR_LABELS = { domestic: 'Domestic', import: 'Import', export: 'Export', crosstrade: 'Cross-Trade', other: 'Other' };

  const W = svg.getBoundingClientRect().width || 600;
  const H = 240;
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  const pad = { t: 24, r: 16, b: 36, l: 40 };
  const cw = W - pad.l - pad.r, ch = H - pad.t - pad.b;

  const maxV = Math.max(...months.map(d => d.total), 1);
  const slotW = cw / months.length;
  const barW = Math.max(6, Math.min(40, slotW * 0.55));
  const xCenter = i => pad.l + i * slotW + slotW / 2;
  const yPos = v => pad.t + ch - (v / maxV) * ch;
  const ns = 'http://www.w3.org/2000/svg';

  // Grid lines + Y labels
  for (let i = 0; i <= 4; i++) {
    const yy = pad.t + (ch / 4) * i;
    const gl = document.createElementNS(ns, 'line');
    Object.entries({ x1: pad.l, x2: W - pad.r, y1: yy, y2: yy, stroke: '#F3F4F6', 'stroke-width': 1 }).forEach(([k, v]) => gl.setAttribute(k, v));
    svg.appendChild(gl);
    const lbl = document.createElementNS(ns, 'text');
    lbl.setAttribute('x', pad.l - 6); lbl.setAttribute('y', yy + 3);
    lbl.setAttribute('text-anchor', 'end'); lbl.setAttribute('fill', '#9CA3AF'); lbl.setAttribute('font-size', '9');
    lbl.textContent = Math.round(maxV - (maxV / 4) * i);
    svg.appendChild(lbl);
  }

  // Stacked bars
  months.forEach((d, i) => {
    let stackBase = pad.t + ch;
    for (const key of STACK_KEYS) {
      const v = d[key] || 0;
      if (v === 0) continue;
      const bH = (v / maxV) * ch;
      stackBase -= bH;
      const rect = document.createElementNS(ns, 'rect');
      rect.setAttribute('x', xCenter(i) - barW / 2); rect.setAttribute('y', stackBase);
      rect.setAttribute('width', barW); rect.setAttribute('height', bH);
      rect.setAttribute('fill', COLORS[key]);
      svg.appendChild(rect);
    }
    if (d.total > 0) {
      const lbl = document.createElementNS(ns, 'text');
      lbl.setAttribute('x', xCenter(i)); lbl.setAttribute('y', yPos(d.total) - 4);
      lbl.setAttribute('text-anchor', 'middle'); lbl.setAttribute('fill', '#475569');
      lbl.setAttribute('font-size', '8'); lbl.setAttribute('font-weight', 'bold');
      lbl.textContent = d.total;
      svg.appendChild(lbl);
    }
  });

  // Total line overlay
  if (months.length > 1) {
    const lineD = months.map((d, i) => `${i === 0 ? 'M' : 'L'} ${xCenter(i)} ${yPos(d.total)}`).join(' ');
    const linePath = document.createElementNS(ns, 'path');
    linePath.setAttribute('d', lineD); linePath.setAttribute('fill', 'none');
    linePath.setAttribute('stroke', '#f59e0b'); linePath.setAttribute('stroke-width', '2');
    linePath.setAttribute('stroke-linejoin', 'round');
    svg.appendChild(linePath);
    months.forEach((d, i) => {
      const dot = document.createElementNS(ns, 'circle');
      dot.setAttribute('cx', xCenter(i)); dot.setAttribute('cy', yPos(d.total));
      dot.setAttribute('r', '3'); dot.setAttribute('fill', '#f59e0b');
      dot.setAttribute('stroke', '#fff'); dot.setAttribute('stroke-width', '1.5');
      svg.appendChild(dot);
    });
  }

  // X-axis labels + tooltips
  const showYear = new Set(months.map(d => d.month.slice(0, 4))).size > 1 || months.length <= 6;
  months.forEach((d, i) => {
    const [yr, mo] = d.month.split('-');
    const label = new Date(+yr, +mo - 1, 1).toLocaleString('en-US', { month: 'short' }) + (showYear ? ` '${yr.slice(2)}` : '');
    const lbl = document.createElementNS(ns, 'text');
    lbl.setAttribute('x', xCenter(i)); lbl.setAttribute('y', H - 6);
    lbl.setAttribute('text-anchor', 'middle'); lbl.setAttribute('fill', '#9CA3AF'); lbl.setAttribute('font-size', '8');
    lbl.textContent = label;
    svg.appendChild(lbl);

    const hit = document.createElementNS(ns, 'rect');
    hit.setAttribute('x', xCenter(i) - slotW / 2); hit.setAttribute('y', pad.t);
    hit.setAttribute('width', slotW); hit.setAttribute('height', ch); hit.setAttribute('fill', 'transparent');
    hit.addEventListener('mouseenter', () => {
      tooltip.classList.remove('hidden');
      tooltip.innerHTML = `<strong>${label}</strong><br>Total: ${d.total}<br>` +
        `Import: ${d.import} &nbsp; Export: ${d.export}<br>` +
        `Domestic: ${d.domestic} &nbsp; Cross-Trade: ${d.crosstrade}` +
        (d.other > 0 ? `<br>Other: ${d.other}` : '');
    });
    hit.addEventListener('mousemove', e => {
      const cr = svg.closest('.relative').getBoundingClientRect();
      tooltip.style.left = (e.clientX - cr.left + 12) + 'px';
      tooltip.style.top  = (e.clientY - cr.top  - 40) + 'px';
    });
    hit.addEventListener('mouseleave', () => tooltip.classList.add('hidden'));
    svg.appendChild(hit);
  });

  // Data table
  if (tableEl && months.length) {
    const mLabels = months.map(d => {
      const [yr, mo] = d.month.split('-');
      return new Date(+yr, +mo - 1, 1).toLocaleString('en-US', { month: 'short' }) + (showYear ? ` '${yr.slice(2)}` : '');
    });
    const dirTotals = Object.fromEntries(STACK_KEYS.map(k => [k, months.reduce((s, d) => s + (d[k] || 0), 0)]));
    const grandTotal = months.reduce((s, d) => s + d.total, 0);

    const thStyle = 'py-1 px-2 text-[10px] font-bold text-slate-500 uppercase tracking-wide text-right first:text-left';
    const tdStyle = 'py-1 px-2 text-[10px] text-right text-slate-600 first:text-left';
    const headerCells = ['Direction', ...mLabels, 'Total'].map((h, i) => `<th class="${thStyle}">${h}</th>`).join('');
    const dataRows = [...STACK_KEYS].reverse().map(key => {
      const cells = months.map(d => `<td class="${tdStyle}">${(d[key] || 0).toLocaleString()}</td>`).join('');
      const rowTotal = `<td class="${tdStyle} font-bold">${dirTotals[key].toLocaleString()}</td>`;
      return `<tr class="border-b border-slate-50 last:border-0">
        <td class="${tdStyle} flex items-center gap-1.5">
          <span class="inline-block size-2 rounded-sm flex-shrink-0" style="background:${COLORS[key]}"></span>${DIR_LABELS[key]}
        </td>${cells}${rowTotal}</tr>`;
    }).join('');
    const totalCells = months.map(d => `<td class="${tdStyle} font-bold text-primary">${d.total.toLocaleString()}</td>`).join('');

    tableEl.innerHTML = `<div class="overflow-x-auto">
      <table class="w-full border-collapse">
        <thead><tr class="bg-slate-50 dark:bg-slate-700/40">${headerCells}</tr></thead>
        <tbody>
          ${dataRows}
          <tr class="bg-slate-50 dark:bg-slate-700/20">
            <td class="${tdStyle} font-bold text-primary">Total</td>${totalCells}
            <td class="${tdStyle} font-bold text-primary">${grandTotal.toLocaleString()}</td>
          </tr>
        </tbody>
      </table>
    </div>`;
  }
}

// ─── Render: Freight Breakdown ───────────────────────────
function renderFreightBreakdown(data) {
  const container = document.getElementById('freightBreakdown');
  if (!data || !data.directions) {
    container.innerHTML = '<div class="text-xs text-slate-400 text-center py-4">No data</div>';
    return;
  }

  const { grand_total, no_direction_total, directions } = data;
  const fmt = n => Number(n).toLocaleString();
  const pct = (n, d) => d > 0 ? ((n / d) * 100).toFixed(1) : '0.0';

  // Direction KPI cards
  const cards = directions.map(d => {
    const share    = pct(d.total, grand_total);
    const winRate  = pct(d.won, d.quoted);
    const lossRate = pct(d.lost, d.quoted);
    return `
      <div class="bg-slate-50 dark:bg-slate-800/60 rounded-lg p-3 flex flex-col gap-1 min-w-0">
        <div class="text-[10px] font-bold text-slate-500 uppercase tracking-wide truncate">${d.label}</div>
        <div class="flex items-end gap-2">
          <div class="text-xl font-extrabold text-primary leading-none">${fmt(d.total)}</div>
          ${d.quoted > 0 ? `<div class="text-[10px] text-amber-600 font-semibold pb-0.5">${fmt(d.quoted)} quoted</div>` : ''}
        </div>
        <div class="text-[10px] text-slate-400">${share}% of total</div>
        <div class="flex items-center gap-2 mt-1">
          <span class="text-xs font-bold text-[#73be4b]">${fmt(d.won)} Won</span>
          <span class="text-[10px] text-slate-300">|</span>
          <span class="text-xs font-bold text-red-400">${fmt(d.lost)} Lost</span>
        </div>
        <div class="flex items-center gap-2">
          <span class="text-[10px] font-semibold text-[#73be4b]">${winRate}% win</span>
          <span class="text-[10px] text-slate-300">|</span>
          <span class="text-[10px] font-semibold text-red-400">${lossRate}% loss</span>
        </div>
      </div>`;
  }).join('');

  // Mode breakdown table — only directions that have mode rows
  const modeRows = directions.flatMap(d =>
    d.modes.map(m => {
      const mShare   = pct(m.total, d.total);
      const mWinRate = pct(m.won, m.quoted);
      return `<tr class="border-t border-slate-100 dark:border-slate-700/50">
        <td class="py-1.5 px-2 text-[11px] text-slate-500">${d.label}</td>
        <td class="py-1.5 px-2 text-[11px] font-semibold text-slate-700 dark:text-slate-300">${m.label}</td>
        <td class="py-1.5 px-2 text-[11px] text-right text-slate-700 dark:text-slate-300">${fmt(m.total)}</td>
        <td class="py-1.5 px-2 text-[11px] text-right text-slate-400">${mShare}%</td>
        <td class="py-1.5 px-2 text-[11px] text-right text-[#73be4b] font-semibold">${fmt(m.won)}</td>
        <td class="py-1.5 px-2 text-[11px] text-right text-red-400 font-semibold">${fmt(m.lost)}</td>
        <td class="py-1.5 px-2 text-[11px] text-right font-bold text-slate-700 dark:text-slate-300">${mWinRate}%</td>
      </tr>`;
    })
  ).join('');

  const noDirectionNote = no_direction_total > 0
    ? `<div class="mt-3 flex items-start gap-2">
        <span class="text-[10px] text-slate-400 italic leading-relaxed">
          * ${fmt(no_direction_total)} QRN(s) have no direction recorded and are excluded from the totals above.
          Grand total including unclassified: ${fmt(grand_total + no_direction_total)}.
        </span>
        <button id="dlNoDirectionBtn" class="flex-shrink-0 inline-flex items-center gap-1 px-2 py-1 rounded text-[10px] font-bold text-primary bg-primary/10 hover:bg-primary/20 not-italic transition-colors">
          <span class="material-symbols-outlined text-[12px]">download</span>Download
        </button>
      </div>`
    : '';

  container.innerHTML = `
    <div class="grid grid-cols-4 gap-2 mb-4">${cards}</div>
    <div class="overflow-x-auto">
      <table class="w-full text-left border-collapse">
        <thead>
          <tr class="bg-slate-100 dark:bg-slate-700/40">
            <th class="py-1.5 px-2 text-[10px] font-bold text-slate-500 uppercase tracking-wide">Direction</th>
            <th class="py-1.5 px-2 text-[10px] font-bold text-slate-500 uppercase tracking-wide">Mode</th>
            <th class="py-1.5 px-2 text-[10px] font-bold text-slate-500 uppercase tracking-wide text-right">Total</th>
            <th class="py-1.5 px-2 text-[10px] font-bold text-slate-500 uppercase tracking-wide text-right">% of Dir</th>
            <th class="py-1.5 px-2 text-[10px] font-bold text-slate-500 uppercase tracking-wide text-right">Won</th>
            <th class="py-1.5 px-2 text-[10px] font-bold text-slate-500 uppercase tracking-wide text-right">Lost</th>
            <th class="py-1.5 px-2 text-[10px] font-bold text-slate-500 uppercase tracking-wide text-right">Win %</th>
          </tr>
        </thead>
        <tbody>${modeRows || '<tr><td colspan="7" class="py-3 text-center text-xs text-slate-400">No mode data</td></tr>'}</tbody>
      </table>
    </div>
    ${noDirectionNote}`;

  const dlBtn = container.querySelector('#dlNoDirectionBtn');
  if (dlBtn) {
    dlBtn.addEventListener('click', async () => {
      dlBtn.disabled = true;
      dlBtn.innerHTML = `<span class="material-symbols-outlined text-[12px] animate-spin">progress_activity</span>`;
      try {
        await downloadMgmtCsv('no-direction', 'no-direction-conversations.csv');
      } catch (err) {
        console.error('No-direction download error:', err);
      } finally {
        dlBtn.disabled = false;
        dlBtn.innerHTML = `<span class="material-symbols-outlined text-[12px]">download</span>Download`;
      }
    });
  }
}

// ─── Info Popover (chart/KPI descriptions) ───────────────
const CHART_INFO = {
  'kpi-total': {
    title: 'Total Conversations',
    body: [
      'Count of unique conversations in the <b>Sales Team inbox</b> created within the selected date range — regardless of current status (open, won, lost, archived).',
      'The colored bar underneath shows the distribution across active workflow status tags (Contacted, Need to Quote, Quoted, etc.). The sparkline tracks daily volume across the window.',
      'The % badge compares this period to the previous equivalent window (e.g., last 30 days vs. the 30 days before that).',
    ],
  },
  'kpi-won': {
    title: 'Won Conversations',
    body: [
      'Conversations in the <b>Sales Team inbox</b>, created within the date range, that carry the <code>won</code> tag.',
      '<b>"% of closed"</b> = Won ÷ (Won + Lost). Open/in-progress conversations are <i>excluded</i> from the denominator, so this reflects the conversion rate among deals with a final outcome only.',
      'A conversation created inside the window but won later is still counted — the window is anchored on creation date, not close date.',
    ],
  },
  'kpi-lost': {
    title: 'Lost Conversations',
    body: [
      'Conversations in the <b>Sales Team inbox</b>, created within the date range, that carry the <code>lost</code> tag.',
      '"% of closed" is the inverse of the Won percentage — Lost ÷ (Won + Lost).',
      'The % change arrow is <b>inverted</b>: a drop in Lost is shown in green because fewer losses is a good outcome.',
    ],
  },
  'kpi-win-rate': {
    title: 'Win Rate',
    body: [
      '<b>Won ÷ Quoted × 100</b>, computed over QRNs whose conversation was created in the date range. Same denominator as Freight Breakdown\'s per-row win %.',
      '<b>Quoted</b> = QRNs tagged <code>quoted</code>. A QRN tagged <code>won</code> but never <code>quoted</code> still counts in the numerator, so the rate can occasionally exceed 100%.',
      'The change badge is in <b>percentage points (pp)</b>, not a relative % change. Moving from 40% to 45% is shown as +5.0 pp.',
    ],
  },
  'kpi-lost-rate': {
    title: 'Lost Rate',
    body: [
      '<b>Lost ÷ Quoted × 100</b>, mirroring Freight Breakdown\'s denominator.',
      'Win Rate and Lost Rate <i>do not</i> sum to 100% — Quoted can include QRNs that are still open, requoting, or otherwise not yet won/lost.',
      'The change badge is in <b>percentage points (pp)</b>, and colors are <b>inverted</b>: a drop in Lost Rate is shown in green because fewer losses is a good outcome.',
    ],
  },
  'win-rate-trend': {
    title: 'Win Rate Trend',
    body: [
      'Daily breakdown of won vs. lost conversations from the <b>Sales Team inbox</b> across the selected date range.',
      'Each dot represents conversations <b>created</b> that day (not closed that day) that later received a <code>won</code> or <code>lost</code> tag. Open conversations are not plotted.',
      'Hover a day to see raw Won, Lost, Total and the daily win rate. Totals across the window should match the Won / Lost KPI cards exactly.',
    ],
  },
  'won-by-direction': {
    title: 'Won Conversation by Direction',
    body: [
      'Monthly breakdown of <b>won</b> conversations that contain a quote request (QRN), grouped by trade direction: Import, Export, Domestic, Cross-Trade, Other.',
      'Counts <b>distinct QRNs</b> per month per direction. The orange total line is the sum across all directions and should match the KPI Won Conversations card over the same window.',
      '<b>Other</b> captures QRNs whose <code>quote_data.direction</code> is missing, null, or a non-standard value. The footnote below the chart exposes these so they can be audited.',
    ],
  },
  'freight-breakdown': {
    title: 'Freight Breakdown',
    body: [
      'Matrix of all conversations in the window, grouped by <b>freight mode</b> (Ocean, Air, Road) and <b>trade direction</b>. Each cell counts distinct conversation × direction × mode tuples.',
      'Includes <b>all</b> conversations (won, lost, open) with a QRN — not just won. A single conversation with multiple QRNs across different modes will appear in multiple cells.',
      'Totals here may differ slightly from the Direction by Month chart when a conversation carries QRNs of multiple modes — that\'s expected, since this table counts mode-tuples while Direction by Month counts unique QRNs.',
    ],
  },
  'requests-by-direction': {
    title: 'Number of Requests by Direction (MoM)',
    body: [
      'Monthly volume of <b>all</b> quote requests from the Sales inbox, grouped by direction — regardless of outcome (won, lost, pending, open).',
      'Useful for tracking raw demand and trade-lane mix <i>independently</i> of sales performance. Compare against Won by Direction to see where win rate is strongest vs. weakest.',
      'Counts distinct QRNs per month. The orange total line equals the sum of all direction bars.',
    ],
  },
  'active-conversations': {
    title: 'Active Conversations',
    body: [
      'Donut chart of conversations currently <b>open</b> in the Sales Team inbox (not archived), broken down by their workflow status tag.',
      'Buckets: <b>New</b> (open, no workflow tag yet — untouched), <b>Contacted</b>, <b>Need to Quote</b>, <b>Quoted</b>, <b>Need to Requote</b>, <b>Need to Onboard</b>, <b>Pending Review</b>.',
      'This is a <b>live</b> snapshot — it ignores the date-range filter and reflects state right now. Useful for surfacing workflow bottlenecks (e.g., a large "Need to Quote" bucket signals queue buildup).',
    ],
  },
  'conv-per-owner': {
    title: 'Number of Conversations Per Owner',
    body: [
      'Stacked bar chart showing conversations assigned to each Sales team member within the date range, split by current status.',
      'Includes all conversations (won, lost, in-progress) where an <b>owner is set</b>. Unassigned conversations are excluded from this view.',
      'Useful for workload balancing: tall bars indicate heavy queues, and the status stack reveals whether each rep is blocked on quoting, follow-up, or onboarding.',
    ],
  },
  'revenue-by-company': {
    title: 'Revenue by Company (Top 10)',
    body: [
      'Top 10 companies by total <b>booked revenue</b> across QRNs in the date range whose latest <code>quotes_quote.status</code> = <code>BOOKED</code> in Postgres (rates DB). Pending, draft, expired, and cancelled quotes are excluded.',
      'Quoted value sums the <b>latest pricing option</b> per quote — i.e. <code>SUM(sell_amount)</code> on the most recent <code>quote_pricing</code> row per QRN.',
      'Companies are grouped by <code>bill_to_org_name</code>; quotes without a billing org fall back to <code>manual_company_name</code>, then to <code>Unknown (org_id)</code> if only an id is present.',
    ],
  },
  'need-to-onboard-revenue': {
    title: 'Need to Onboard Revenue',
    body: [
      'QRNs that (1) carry the <b>need to onboard</b> tag in BigQuery (precedence-agnostic — counted even if the conversation also has won/lost tags, since Front auto-resolves these and another tag may otherwise win), AND (2) whose latest <code>quotes_quote.status</code> is <b>not</b> <code>BOOKED</code> and <b>not</b> <code>CANCELLED</code>.',
      'The Status column shows the Postgres <code>quotes_quote.status</code> (e.g. <code>DRAFT</code>, <code>CUSTOMER_APPROVAL</code>, <code>EXPIRED</code>) so the actual reason a deal is still pending is visible.',
      'Quoted value = <code>SUM(sell_amount)</code> on the latest <code>quote_pricing</code> per QRN. Owner = <code>created_by_user_email</code> on <code>quotes_quote</code>, resolved via <code>auth_user</code>.',
    ],
  },
  'quoted-potential-revenue': {
    title: 'Quoted Potential Revenue',
    body: [
      'QRNs that (1) carry the <b>quoted</b> tag in BigQuery (precedence-agnostic — counted even if the conversation also has won/lost/onboard tags, since Front auto-resolves and another tag may otherwise win), AND (2) whose latest <code>quotes_quote.status</code> is <b>not</b> <code>BOOKED</code> and <b>not</b> <code>CANCELLED</code>.',
      'The Status column shows the Postgres <code>quotes_quote.status</code> (e.g. <code>DRAFT</code>, <code>CUSTOMER_APPROVAL</code>, <code>EXPIRED</code>) so the state of each pending quote is visible.',
      'The total at the top is the upper bound on revenue still in play from quotes already delivered.',
    ],
  },
  'quote-stages-by-rep': {
    title: 'Quote Stages by Rep',
    body: [
      'Each row is a sales rep, each column is a stage in the quote pipeline. Respects the dashboard date filter — only QRNs whose conversation falls in the selected window are counted.',
      'Pipeline order: <b>Contacted → Need to Quote → Quoted → Need to Re-Quote → Need to Onboard → Won</b>. <b>Lost</b> and <b>Unable to Quote</b> are terminal off-pipeline outcomes shown alongside.',
      'Each deal is bucketed into a single stage by precedence (Won > Lost > Need to Onboard > Quoted > Need to Quote > Need to Re-Quote > Contacted > Unable to Quote).',
      'Each stage column shows the <b>cumulative</b> count of the rep\'s deals that reached that stage — i.e. deals currently bucketed at that stage or any later pipeline stage. Lost and Unable to Quote are off-pipeline and excluded from the cumulative count. The <b>%</b> beside each stage = that cumulative count ÷ the rep\'s total deals.',
      '<b>Win %</b> = Won ÷ rep total; <b>Loss %</b> = Lost ÷ rep total. Total counts every bucket including Lost and Unable to Quote. Reps with no resolvable owner are excluded.',
    ],
  },
  'quote-stages-by-business-type': {
    title: 'Quote Stages by New vs Returning Business',
    body: [
      'Each row is a business type bucket — <b>New Business</b> or <b>Returning Business</b>. Respects the dashboard date filter — only QRNs whose conversation falls in the selected window are counted (the new-vs-returning determination still looks at all-time history per company).',
      'A deal is <b>New Business</b> if the company had <b>zero prior QRNs</b> ranked before this one; <b>Returning Business</b> if ≥1 earlier QRN. Each QRN\'s company key is taken from its <b>latest</b> quote (matching the customer name shown), preferring the normalized <code>bill_to_org_name</code>, then <code>manual_company_name</code>, then <code>bill_to_org_id</code>. Ranking within a company is by the QRN\'s earliest quote date.',
      'Stage columns, %, and Win/Loss % use the same definitions as the Quote Stages by Rep widget (cumulative count + share of bucket total).',
    ],
  },
  'blank-qrn-spam': {
    title: 'Blank QRN — Assumed Spam',
    body: [
      'Conversations in the Sales Team inbox whose <b>QRN (Quote Request Number) was never assigned</b> and whose status is <b>not Resolved</b>.',
      'A QRN is normally created when a request is parsed as a real quote opportunity. When it is never created and the conversation is still around, the lead is treated as <b>likely spam or non-actionable</b> — it never escalated into the quoting workflow.',
      'Respects the dashboard date and source filters. Use this to spot how much inbound noise the Sales inbox is absorbing.',
    ],
  },
  'blank-qrn-resolved': {
    title: 'Blank QRN — Resolved',
    body: [
      'Conversations in the Sales Team inbox that were <b>marked Resolved</b> but had <b>no QRN ever assigned</b>.',
      'These are conversations the team closed out without ever turning into a quote request — useful for spotting cases where a quote opportunity may have been dismissed, or where the inbox is being used for unrelated correspondence.',
      'Respects the dashboard date and source filters.',
    ],
  },
  'aging-open-3': {
    title: 'Open Conversations > 3 Days',
    body: [
      'Conversations in the Sales Team inbox that are currently <b>open</b> (status = assigned or unassigned) and whose <code>created_at</code> is more than <b>3 days</b> ago.',
      'This is a <b>live</b> snapshot — it <i>ignores</i> the dashboard date range so older conversations remain visible. The source filter still applies.',
      'Threshold is cumulative: this tile includes everything older than 3 days, so it always ≥ the &gt; 7-day count.',
    ],
  },
  'aging-open-7': {
    title: 'Open Conversations > 7 Days',
    body: [
      'Open conversations in the Sales Team inbox whose <code>created_at</code> is more than <b>7 days</b> ago.',
      'Live snapshot — ignores the dashboard date range. Source filter still applies.',
      'Cumulative: includes everything older than 7 days (so always ≥ the &gt; 14-day count).',
    ],
  },
  'aging-open-14': {
    title: 'Open Conversations > 14 Days',
    body: [
      'Open conversations in the Sales Team inbox whose <code>created_at</code> is more than <b>14 days</b> ago.',
      'Live snapshot — ignores the dashboard date range. Source filter still applies.',
      'Cumulative: includes everything older than 14 days (so always ≥ the &gt; 30-day count).',
    ],
  },
  'aging-open-30': {
    title: 'Open Conversations > 30 Days',
    body: [
      'Open conversations in the Sales Team inbox whose <code>created_at</code> is more than <b>30 days</b> ago.',
      'Live snapshot — ignores the dashboard date range. Source filter still applies.',
      'These are the longest-stalled open items and the most urgent backlog to triage.',
    ],
  },
  'aging-open-buckets': {
    title: 'Open Conversations by Age',
    body: [
      'Distribution of currently-open conversations across <b>non-overlapping</b> age buckets: 0–3, 3–7, 7–14, 14–30, and 30+ days.',
      'Live snapshot — ignores the dashboard date range. Source filter still applies.',
      'The bucket counts here sum to the total open conversations in the Sales Team inbox right now.',
    ],
  },
  'aging-no-followup': {
    title: 'Quoted — No Follow-up 3+ Days',
    body: [
      'Open conversations carrying the <code>quoted</code> tag where the <b>latest outbound (team-sent) message</b> was 3 or more days ago — or where the team has never sent an outbound message at all.',
      'Surface this to spot quoted deals that have gone quiet on our side. Live snapshot — ignores the dashboard date range; source filter applies.',
    ],
  },
  'aging-no-response': {
    title: 'Quoted — No Customer Response 7+ Days',
    body: [
      'Open conversations carrying the <code>quoted</code> tag where the <b>latest inbound (customer-sent) message</b> was 7 or more days ago — or where the customer has never replied at all.',
      'Use this to spot stalled deals awaiting a customer decision. Live snapshot — ignores the dashboard date range; source filter applies.',
    ],
  },
  'aging-quoted-value': {
    title: 'Open Quoted Value by Age',
    body: [
      'Total dollar value of <b>open quoted deals</b> (conversations with the <code>quoted</code> tag and an attached QRN) grouped by how long the conversation has been around.',
      'Value per QRN = <code>SUM(sell_amount)</code> on the latest <code>quote_pricing</code> row (matches the Quoted Potential Revenue widget).',
      'Live snapshot — ignores the dashboard date range; source filter still applies. Helps see how much revenue is sitting in stale buckets.',
    ],
  },
};

(function initInfoPopover() {
  const pop = document.getElementById('infoPopover');
  if (!pop) return;
  const titleEl = document.getElementById('infoPopoverTitle');
  const bodyEl = document.getElementById('infoPopoverBody');
  const closeBtn = document.getElementById('infoPopoverClose');
  let currentAnchor = null;

  function position(anchor) {
    const rect = anchor.getBoundingClientRect();
    pop.style.visibility = 'hidden';
    pop.classList.remove('hidden');
    const pw = pop.offsetWidth, ph = pop.offsetHeight;
    const margin = 8;
    let left = rect.left;
    let top = rect.bottom + 6;
    if (left + pw > window.innerWidth - margin) left = window.innerWidth - pw - margin;
    if (left < margin) left = margin;
    if (top + ph > window.innerHeight - margin) top = rect.top - ph - 6;
    if (top < margin) top = margin;
    pop.style.left = `${left}px`;
    pop.style.top = `${top}px`;
    pop.style.visibility = '';
  }

  function open(anchor, key) {
    const info = CHART_INFO[key];
    if (!info) return;
    titleEl.textContent = info.title;
    bodyEl.innerHTML = info.body.map(p => `<p>${p}</p>`).join('');
    currentAnchor = anchor;
    position(anchor);
  }

  function close() {
    pop.classList.add('hidden');
    currentAnchor = null;
  }

  document.addEventListener('click', (e) => {
    const btn = e.target.closest('.info-btn');
    if (btn) {
      e.stopPropagation();
      const key = btn.dataset.infoKey;
      if (currentAnchor === btn) { close(); return; }
      open(btn, key);
      return;
    }
    if (currentAnchor && !pop.contains(e.target)) close();
  });
  closeBtn.addEventListener('click', close);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
  window.addEventListener('resize', () => { if (currentAnchor) position(currentAnchor); });
  window.addEventListener('scroll', () => { if (currentAnchor) position(currentAnchor); }, true);
})();

// ─── Shift Schedule Logic ─────────────────────────────────
const scheduleModal = document.getElementById('scheduleModal');

document.addEventListener('click', (e) => {
  const btn = e.target.closest('.edit-schedule-btn');
  if (btn) {
    openScheduleModal(btn.dataset.id, btn.dataset.name);
  }
});

function openScheduleModal(teammateId, name) {
  const sched = teamSchedules[teammateId] || {
    timezone: 'America/Los_Angeles',
    workDays: [1, 2, 3, 4, 5],
    startHour: '08:00',
    endHour: '17:00'
  };

  document.getElementById('scheduleModalTitle').textContent = `Shift Schedule: ${name}`;
  document.getElementById('scheduleTeammateId').value = teammateId;
  document.getElementById('scheduleTimezone').value = sched.timezone || 'America/Los_Angeles';

  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const container = document.getElementById('workingDaysContainer');
  
  let html = days.map((day, idx) => {
    const isW = (sched.workDays || []).includes(idx);
    return `
      <label class="flex items-center gap-3 cursor-pointer p-2 rounded hover:bg-slate-50 dark:hover:bg-slate-800">
        <input type="checkbox" class="schedule-day-cb rounded border-slate-300 text-primary focus:ring-primary w-4 h-4" value="${idx}" ${isW ? 'checked' : ''} />
        <span class="text-sm font-medium text-slate-700 dark:text-slate-300 w-32">${day}</span>
      </label>
    `;
  }).join('');
  
  html += `
    <div class="flex items-center gap-3 mt-4 pt-4 border-t border-slate-100 dark:border-slate-800">
      <div class="flex-1">
        <label class="block text-xs font-bold text-slate-500 mb-1">Start Time</label>
        <input type="time" id="scheduleStartTime" class="w-full text-sm border border-slate-200 dark:border-slate-700 rounded-lg p-2 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:border-primary" value="${sched.startHour || '08:00'}" />
      </div>
      <div class="flex-1">
        <label class="block text-xs font-bold text-slate-500 mb-1">End Time</label>
        <input type="time" id="scheduleEndTime" class="w-full text-sm border border-slate-200 dark:border-slate-700 rounded-lg p-2 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:border-primary" value="${sched.endHour || '17:00'}" />
      </div>
    </div>
  `;

  container.innerHTML = html;
  scheduleModal.classList.remove('hidden');
  scheduleModal.classList.add('flex');
}

if (document.getElementById('closeScheduleModal')) {
  document.getElementById('closeScheduleModal').addEventListener('click', () => {
    scheduleModal.classList.add('hidden');
    scheduleModal.classList.remove('flex');
  });
  document.getElementById('cancelScheduleBtn').addEventListener('click', () => {
    document.getElementById('closeScheduleModal').click();
  });

  document.getElementById('saveScheduleBtn').addEventListener('click', async () => {
    const btn = document.getElementById('saveScheduleBtn');
    const teammateId = document.getElementById('scheduleTeammateId').value;
    const timezone = document.getElementById('scheduleTimezone').value;
    const startHour = document.getElementById('scheduleStartTime').value;
    const endHour = document.getElementById('scheduleEndTime').value;
    
    const checkboxes = document.querySelectorAll('.schedule-day-cb:checked');
    const workDays = Array.from(checkboxes).map(cb => Number(cb.value));
    
    const schedule = { timezone, workDays, startHour, endHour };
    
    btn.disabled = true;
    btn.innerHTML = `<div class="size-4 border-2 border-primary/20 border-t-primary rounded-full animate-spin"></div> Saving...`;
    
    try {
      const res = await api('/api/team-schedules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teammate_id: teammateId, schedule })
      });
      if (res.success) {
        teamSchedules[teammateId] = schedule;
        document.getElementById('closeScheduleModal').click();
        showToast('Schedule saved successfully');
        loadAll();
      } else {
        showToast(res.error || 'Failed to save schedule', 'error');
      }
    } catch (err) {
      console.error('Save schedule error:', err);
      const msg = err.message.startsWith('503') ? 'Firestore not configured on server' : 'Failed to save schedule: ' + err.message;
      showToast(msg, 'error');
    } finally {
      btn.disabled = false;
      btn.innerHTML = `Save Changes`;
    }
  });
}

// ─── CSV Download ────────────────────────────────────
// Shared helper: downloads conversation-level CSV with uniform columns
async function downloadMgmtCsv(apiType, filename) {
  const rows = await api(`/api/management-download?type=${apiType}&${qs()}`);
  const csvRows = [['Conversation ID', 'QRN', 'Owner', 'Direction', 'Outcome']];
  for (const r of rows) csvRows.push([r.conversation_id, r.qrn, r.owner, r.direction, r.outcome]);
  const csv = csvRows.map(r => r.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

const MGMT_CSV_TYPES = {
  'management-win-rate':            { apiType: 'win-rate',            filename: 'win-rate-conversations.csv' },
  'management-freight-breakdown':   { apiType: 'freight-breakdown',   filename: 'freight-breakdown-conversations.csv' },
  'management-won-by-month':        { apiType: 'won-by-month',        filename: 'won-conversations-by-direction.csv' },
  'management-direction-by-month':  { apiType: 'direction-by-month',  filename: 'direction-by-month-conversations.csv' },
  'management-active-conversations':{ apiType: 'active-conversations', filename: 'active-conversations.csv' },
  'management-conv-per-owner':      { apiType: 'conv-per-owner',      filename: 'conversations-per-owner.csv' },
};

document.querySelectorAll('.dl-btn').forEach(btn => {
  btn.addEventListener('click', async () => {
    const type = btn.dataset.type;
    const headers = {};
    if (idToken) headers['Authorization'] = `Bearer ${idToken}`;

    try {
      if (MGMT_CSV_TYPES[type]) {
        const { apiType, filename } = MGMT_CSV_TYPES[type];
        await downloadMgmtCsv(apiType, filename);
        return;
      }

      if (type === 'quote-stages-by-rep') {
        downloadStageTableCsv(lastQuoteStagesByRepData, 'Rep', 'name', 'quote-stages-by-rep.csv');
        return;
      }
      if (type === 'quote-stages-by-business-type') {
        downloadStageTableCsv(lastQuoteStagesByBusinessTypeData, 'Business Type', 'type', 'quote-stages-by-business-type.csv');
        return;
      }
      if (type === 'revenue-by-company') {
        downloadRevenueByCompanyCsv(lastRevenueByCompanyData, 'revenue-by-company.csv');
        return;
      }
      if (type === 'need-to-onboard-revenue') {
        downloadDealListCsv(lastNeedToOnboardRevenueData, 'need-to-onboard-revenue.csv');
        return;
      }
      if (type === 'quoted-potential-revenue') {
        downloadDealListCsv(lastQuotedPotentialRevenueData, 'quoted-potential-revenue.csv');
        return;
      }

      const useDateRange = type !== 'pending-replies';
      let url = `${API_BASE_URL}/api/download-conversations?type=${type}`;
      if (useDateRange) url += `&${qs()}`;
      const r = await fetch(url, { headers });
      if (!r.ok) throw new Error(r.status);
      const blob = await r.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = btn.dataset.filename || `${type}.csv`;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch (err) { console.error('Download error:', err); }
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

// ─── Source Capsule Filter ───────────────────────────
function refreshSourceCapsuleStyles() {
  document.querySelectorAll('.src-cap').forEach(btn => {
    const cls = btn.dataset.classification;
    const active = cls ? selectedClassifications.has(cls) : selectedSources.has(btn.dataset.source);
    btn.className = `src-cap rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
      active ? 'bg-primary text-white hover:bg-primary/90' : 'bg-primary/5 text-primary hover:bg-primary/10'
    }`;
  });
}
document.querySelectorAll('.src-cap').forEach(btn => {
  btn.addEventListener('click', () => {
    const cls = btn.dataset.classification;
    if (cls) {
      if (selectedClassifications.has(cls)) selectedClassifications.delete(cls);
      else selectedClassifications.add(cls);
    } else {
      const src = btn.dataset.source;
      if (selectedSources.has(src)) selectedSources.delete(src);
      else selectedSources.add(src);
    }
    refreshSourceCapsuleStyles();
    loadAll();
  });
});

// ─── Classification Lists (Settings) ─────────────────
const DOMAIN_RX_CLIENT = /^[a-z0-9.-]+\.[a-z]{2,}$/;
const clsState = { direct: [], indirect: [], updated_at: null, updated_by: null, activeTab: 'direct', dirty: false, loaded: false };

function normalizeDomain(s) {
  return String(s || '').trim().toLowerCase().replace(/^@/, '').replace(/^https?:\/\//, '').replace(/\/.*$/, '');
}
function clsCurrentList() { return clsState[clsState.activeTab]; }
function clsOtherList() { return clsState[clsState.activeTab === 'direct' ? 'indirect' : 'direct']; }

function renderClsChips() {
  const wrap = document.getElementById('clsChips');
  const empty = document.getElementById('clsChipsEmpty');
  const meta = document.getElementById('clsMeta');
  const saveBtn = document.getElementById('clsSaveBtn');
  if (!wrap) return;
  ['direct', 'indirect'].forEach(t => {
    const cnt = document.querySelector(`[data-cls-count="${t}"]`);
    if (cnt) cnt.textContent = clsState[t].length;
  });
  const list = clsCurrentList();
  if (!list.length) { wrap.innerHTML = ''; empty?.classList.remove('hidden'); }
  else {
    empty?.classList.add('hidden');
    wrap.innerHTML = list.map(d => `
      <span class="inline-flex items-center gap-0.5 rounded-full bg-primary/10 text-primary pl-2.5 pr-1 py-0.5 text-[11px] font-medium">
        ${d}
        <button type="button" data-rm="${d}" class="size-4 inline-flex items-center justify-center rounded-full text-primary/60 hover:text-primary hover:bg-primary/10" aria-label="Remove ${d}">&times;</button>
      </span>`).join('');
    wrap.querySelectorAll('button[data-rm]').forEach(b => b.addEventListener('click', () => {
      const v = b.dataset.rm;
      const tab = clsState.activeTab;
      clsState[tab] = clsState[tab].filter(x => x !== v);
      clsState.dirty = true;
      renderClsChips();
    }));
  }
  if (meta) {
    if (clsState.updated_by && clsState.updated_at) {
      const when = new Date(clsState.updated_at);
      meta.textContent = `Last updated by ${clsState.updated_by} on ${when.toLocaleString()}`;
    } else {
      meta.textContent = '';
    }
  }
  if (saveBtn) saveBtn.disabled = !clsState.dirty;
}

function setClsTab(tab) {
  clsState.activeTab = tab;
  document.querySelectorAll('.cls-tab').forEach(b => {
    const active = b.dataset.clsTab === tab;
    b.className = `cls-tab inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium ${active ? 'bg-white dark:bg-transparent shadow-sm text-primary dark:text-slate-200' : 'text-slate-500 dark:text-white'}`;
  });
  renderClsChips();
}

function showClsError(msg) {
  const el = document.getElementById('clsError');
  if (!el) return;
  if (!msg) { el.classList.add('hidden'); el.textContent = ''; return; }
  el.classList.remove('hidden');
  el.textContent = msg;
}

function addClsDomain(raw) {
  showClsError('');
  const d = normalizeDomain(raw);
  if (!d) return;
  if (!DOMAIN_RX_CLIENT.test(d)) { showClsError(`"${raw}" is not a valid domain (expected e.g. acme.com)`); return; }
  if (clsCurrentList().includes(d)) { showClsError(`"${d}" is already in the ${clsState.activeTab} list`); return; }
  if (clsOtherList().includes(d)) {
    const other = clsState.activeTab === 'direct' ? 'Indirect' : 'Direct';
    showClsError(`"${d}" is already in ${other}. Remove it there first.`);
    return;
  }
  clsState[clsState.activeTab] = [...clsCurrentList(), d];
  clsState.dirty = true;
  renderClsChips();
}

function parseCsvDomains(text) {
  return text.split(/[\r\n,]+/).map(s => s.trim()).filter(Boolean)
    .filter(s => s.toLowerCase() !== 'domain')
    .map(normalizeDomain);
}

async function loadClsLists() {
  try {
    const data = await api(`/api/classification-lists`);
    clsState.direct = Array.isArray(data.direct) ? data.direct : [];
    clsState.indirect = Array.isArray(data.indirect) ? data.indirect : [];
    clsState.updated_at = data.updated_at || null;
    clsState.updated_by = data.updated_by || null;
    clsState.dirty = false;
    clsState.loaded = true;
    renderClsChips();
  } catch (err) {
    console.error('loadClsLists error:', err);
    showClsError('Failed to load lists.');
  }
}

async function saveClsLists() {
  showClsError('');
  const saveBtn = document.getElementById('clsSaveBtn');
  if (saveBtn) saveBtn.disabled = true;
  try {
    const res = await fetch(`${API_BASE_URL}/api/classification-lists`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}) },
      body: JSON.stringify({ direct: clsState.direct, indirect: clsState.indirect }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      if (res.status === 409 && body.conflicts) {
        showClsError(`Conflict — these are in both lists: ${body.conflicts.join(', ')}`);
      } else if (body.invalid) {
        showClsError(`Invalid entries: ${body.invalid.join(', ')}`);
      } else {
        showClsError(body.error || `Save failed (${res.status})`);
      }
      if (saveBtn) saveBtn.disabled = false;
      return;
    }
    clsState.direct = body.direct || clsState.direct;
    clsState.indirect = body.indirect || clsState.indirect;
    clsState.updated_at = body.updated_at || null;
    clsState.updated_by = body.updated_by || null;
    clsState.dirty = false;
    renderClsChips();
    if (typeof loadAll === 'function') loadAll();
  } catch (err) {
    console.error('saveClsLists error:', err);
    showClsError('Save failed — see console.');
    if (saveBtn) saveBtn.disabled = false;
  }
}

function initClassificationSettings() {
  document.querySelectorAll('.cls-tab').forEach(b => b.addEventListener('click', () => setClsTab(b.dataset.clsTab)));
  document.getElementById('clsAddBtn')?.addEventListener('click', () => {
    const inp = document.getElementById('clsAddInput');
    if (!inp) return;
    addClsDomain(inp.value);
    if (!document.getElementById('clsError').textContent) inp.value = '';
  });
  document.getElementById('clsAddInput')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); document.getElementById('clsAddBtn').click(); }
  });
  document.getElementById('clsCsvInput')?.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const parsed = parseCsvDomains(text);
    const bad = parsed.filter(d => !DOMAIN_RX_CLIENT.test(d));
    if (bad.length) showClsError(`Skipped ${bad.length} invalid entr${bad.length === 1 ? 'y' : 'ies'}: ${bad.slice(0, 5).join(', ')}${bad.length > 5 ? '…' : ''}`);
    const good = parsed.filter(d => DOMAIN_RX_CLIENT.test(d));
    const conflicts = good.filter(d => clsOtherList().includes(d));
    if (conflicts.length) {
      const other = clsState.activeTab === 'direct' ? 'Indirect' : 'Direct';
      showClsError(`Skipped ${conflicts.length} already in ${other}: ${conflicts.slice(0, 5).join(', ')}${conflicts.length > 5 ? '…' : ''}`);
    }
    const toAdd = good.filter(d => !clsCurrentList().includes(d) && !clsOtherList().includes(d));
    if (toAdd.length) {
      clsState[clsState.activeTab] = [...clsCurrentList(), ...toAdd];
      clsState.dirty = true;
      renderClsChips();
    }
    e.target.value = '';
  });
  document.getElementById('clsSaveBtn')?.addEventListener('click', saveClsLists);
  setClsTab('direct');
}
initClassificationSettings();

// ─── Team Performance Sort ───────────────────────────
document.querySelectorAll('th[data-sort]').forEach(th => {
  th.addEventListener('click', () => {
    const key = th.dataset.sort;
    if (teamSortKey === key) {
      teamSortAsc = !teamSortAsc;
    } else {
      teamSortKey = key;
      teamSortAsc = key === 'name';
    }
    renderTeam();
  });
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
    const [stats, trend, team, pending, accounts, schedules, mgmtKpis, winRate, freightBreakdown, wonByMonth, dirByMonth, activeConv, convPerOwner, revByCompany, needOnboard, quotedPotential, stagesByRep, stagesByBizType, qrnBlank, agingOpen, agingNoFollowup, agingNoResponse, agingQuotedValue] = await Promise.all([
      api(`/api/dashboard-stats?${q}`),
      api(`/api/conversation-trend?${q}`),
      api(`/api/team-performance?${q}`),
      api('/api/zero-replies-conversations'),
      api(`/api/top-accounts?${q}`),
      api(`/api/team-schedules`),
      api(`/api/management-kpis?${q}`),
      api(`/api/management-win-rate?${q}`),
      api(`/api/management-freight-breakdown?${q}`).catch(() => null),
      api(`/api/management-won-by-month?${q}`).catch(() => null),
      api(`/api/management-direction-by-month?${q}`).catch(() => null),
      api(`/api/management-active-conversations?${q}`).catch(() => null),
      api(`/api/management-conv-per-owner?${q}`).catch(() => null),
      api(`/api/revenue-by-company?${q}`).catch(() => null),
      api(`/api/need-to-onboard-revenue?${q}`).catch(() => null),
      api(`/api/quoted-potential-revenue?${q}`).catch(() => null),
      api(`/api/quote-stages-by-rep?${q}`).catch(() => null),
      api(`/api/quote-stages-by-business-type?${q}`).catch(() => null),
      api(`/api/management-qrn-blank-counts?${q}`).catch(() => null),
      api(`/api/management-aging-open-conversations?${q}`).catch(() => null),
      api(`/api/management-aging-quoted-no-followup?${q}`).catch(() => null),
      api(`/api/management-aging-quoted-no-response?${q}`).catch(() => null),
      api(`/api/management-aging-quoted-value?${q}`).catch(() => null),
    ]);

    teamSchedules = schedules || {};

    renderKPI(stats);
    renderDonuts(stats.quotes);
    renderTrend(trend);
    renderTeam(team);
    renderPending(pending);
    renderTopAccounts(accounts);
    renderTeamDirectory(team);
    renderManagementKPIs(mgmtKpis);
    renderWinRateChart(winRate);
    renderWonByMonth(wonByMonth);
    renderFreightBreakdown(freightBreakdown);
    renderDirectionByMonth(dirByMonth);
    renderActiveConversations(activeConv);
    renderConvPerOwner(convPerOwner);
    renderRevenueByCompany(revByCompany);
    renderNeedToOnboardRevenue(needOnboard);
    renderQuotedPotentialRevenue(quotedPotential);
    renderQuoteStagesByRep(stagesByRep);
    renderQuoteStagesByBusinessType(stagesByBizType);
    renderQrnBlankTiles(qrnBlank);
    renderAgingOpenTiles(agingOpen);
    renderAgingOpenBuckets(agingOpen);
    renderAgingFollowups(agingNoFollowup, agingNoResponse);
    renderAgingQuotedValue(agingQuotedValue);
  } catch (err) {
    console.error('Load error:', err);
  } finally {
    hideLoading();
  }
}

// ─── Global Search ──────────────────────────────────
const searchModal = document.getElementById('searchModal');
const searchInput = document.getElementById('searchInput');
const searchResults = document.getElementById('searchResults');
let searchTimeout = null;

document.getElementById('searchToggle').addEventListener('click', () => {
  searchModal.classList.remove('hidden');
  searchModal.classList.add('flex');
  searchInput.value = '';
  searchInput.focus();
  searchResults.innerHTML = '<div class="text-center text-sm text-slate-400 py-12">Type a keyword to search across conversations, messages, quotes, and QRN.</div>';
});

document.getElementById('searchBack').addEventListener('click', () => {
  searchModal.classList.add('hidden');
  searchModal.classList.remove('flex');
});

searchInput.addEventListener('input', () => {
  clearTimeout(searchTimeout);
  const q = searchInput.value.trim();
  if (q.length < 2) {
    searchResults.innerHTML = '<div class="text-center text-sm text-slate-400 py-12">Type at least 2 characters to search.</div>';
    return;
  }
  searchResults.innerHTML = '<div class="flex justify-center py-12"><div class="size-6 border-2 border-primary/20 border-t-primary rounded-full animate-spin"></div></div>';
  searchTimeout = setTimeout(() => performSearch(q), 400);
});

async function performSearch(q) {
  try {
    const data = await api(`/api/search?q=${encodeURIComponent(q)}`);
    if (!data.length) {
      searchResults.innerHTML = '<div class="text-center text-sm text-slate-400 py-12">No results found.</div>';
      return;
    }
    const SOURCE_LABELS = { subject: 'Subject', message: 'Message', quote: 'Quote', qrn: 'QRN' };
    const SOURCE_COLORS = { subject: 'bg-primary/10 text-primary', message: 'bg-amber-100 text-amber-700', quote: 'bg-green-100 text-green-700', qrn: 'bg-violet-100 text-violet-700' };

    searchResults.innerHTML = `<p class="text-xs text-slate-400 mb-2">${data.length} result${data.length > 1 ? 's' : ''}</p>` +
      data.map(r => {
        const frontLink = `${FRONT_URL}${r.conversation_id}`;
        const badges = r.sources.map(s => `<span class="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${SOURCE_COLORS[s] || 'bg-slate-100 text-slate-500'}">${SOURCE_LABELS[s] || s}</span>`).join(' ');
        const snippet = escHtml(r.snippet).replace(new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'), '<mark class="bg-yellow-200 rounded px-0.5">$1</mark>');
        return `<a href="${frontLink}" target="_blank" rel="noopener noreferrer" class="block bg-white rounded-xl border border-slate-100 p-4 hover:border-primary/30 hover:shadow-sm transition-all group">
          <div class="flex items-start justify-between gap-2 mb-1.5">
            <p class="text-sm font-semibold text-slate-800 group-hover:text-primary line-clamp-1">${escHtml(r.subject)}</p>
            <span class="material-symbols-outlined text-slate-300 group-hover:text-primary text-base shrink-0">open_in_new</span>
          </div>
          <p class="text-xs text-slate-500 line-clamp-2 mb-2">${snippet}</p>
          <div class="flex items-center gap-1.5">${badges}</div>
        </a>`;
      }).join('');
  } catch (err) {
    console.error('Search error:', err);
    searchResults.innerHTML = '<div class="text-center text-sm text-red-500 py-12">Search failed. Please try again.</div>';
  }
}

// ─── Auth UI ────────────────────────────────────────
const loginOverlay = document.getElementById('loginOverlay');
const loginError = document.getElementById('loginError');
const loginSpinner = document.getElementById('loginSpinner');

function updateAuthUI(user) {
  const btn = document.getElementById('authBtn');
  if (user) {
    if (user.photoURL) {
      btn.innerHTML = `<img src="${user.photoURL}" alt="" class="size-10 rounded-full object-cover" referrerpolicy="no-referrer" />`;
    } else {
      const ini = (user.displayName || user.email || '?').split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();
      const c = avatarColor(user.displayName || user.email);
      btn.innerHTML = `<span class="size-10 rounded-full flex items-center justify-center text-xs font-bold text-white" style="background:${c}">${ini}</span>`;
    }
    btn.title = `Signed in as ${user.email}`;
    // Update settings page
    const sName = document.getElementById('settingsName');
    const sEmail = document.getElementById('settingsEmail');
    const sAvatar = document.getElementById('settingsAvatar');
    if (sName) sName.textContent = user.displayName || user.email;
    if (sEmail) sEmail.textContent = user.email;
    if (sAvatar && user.photoURL) {
      sAvatar.innerHTML = `<img src="${user.photoURL}" alt="" class="size-12 rounded-full object-cover" referrerpolicy="no-referrer" />`;
    }
  } else {
    btn.innerHTML = `<span class="material-symbols-outlined">login</span>`;
    btn.title = 'Sign in';
  }
}

// Warm up Render backend while user sees login screen (response is 401, but wakes the server)
fetch(API_BASE_URL + '/api/dashboard-stats').catch(() => {});

// Google Sign-In button
document.getElementById('googleSignInBtn').addEventListener('click', async () => {
  loginError.classList.add('hidden');
  loginSpinner.classList.remove('hidden');
  try {
    await auth.signInWithPopup(googleProvider);
  } catch (err) {
    loginSpinner.classList.add('hidden');
    loginError.textContent = err.code === 'auth/popup-closed-by-user' ? '' : (err.message || 'Sign-in failed');
    loginError.classList.toggle('hidden', !loginError.textContent);
  }
});

// Header auth button: sign out when already signed in
document.getElementById('authBtn').addEventListener('click', async () => {
  if (currentUser) {
    await auth.signOut();
    window.location.reload();
  }
});

// Auth state listener
auth.onAuthStateChanged(async (user) => {
  if (user) {
    if (!user.email.endsWith('@freightright.com')) {
      await auth.signOut();
      loginSpinner.classList.add('hidden');
      loginError.textContent = 'Access restricted to @freightright.com accounts.';
      loginError.classList.remove('hidden');
      return;
    }
    currentUser = user;
    idToken = await user.getIdToken();
    updateAuthUI(user);
    loginOverlay.style.display = 'none';
    navigateTo('pricing-dashboard');
    loadAll();
    loadClsLists();
  } else {
    currentUser = null;
    idToken = null;
    updateAuthUI(null);
    loginOverlay.style.display = 'flex';
  }
});
