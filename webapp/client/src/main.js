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
const qs = () => `start=${currentRange.start.toISOString()}&end=${currentRange.end.toISOString()}`;
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

  // Show date picker only on pricing-dashboard and management-dashboard
  const dp = document.getElementById('datePreset');
  if (dp) dp.style.display = (page === 'pricing-dashboard' || page === 'management-dashboard') ? '' : 'none';
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
      <div class="flex flex-col items-end gap-1.5">
        <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
          <span class="w-1.5 h-1.5 rounded-full bg-green-500"></span>Active
        </span>
        <button class="text-[10px] font-bold text-primary hover:underline edit-schedule-btn" data-id="${tm.teammate_id}" data-name="${escHtml(tm.first_name)}">Edit Schedule</button>
        <p class="text-[10px] text-slate-400 mt-1 font-medium">Avg reply: ${fmtMin(tm.avg_reply_minutes)}</p>
      </div>
    </div>`;
  }).join('');
}

// ─── Render: Management Dashboard KPIs ──────────────
function renderManagementKPIs(data) {
  document.getElementById('mgmt-total-conv').textContent = (data.total_conversations || 0).toLocaleString();
  document.getElementById('mgmt-won-conv').textContent = (data.won_conversations || 0).toLocaleString();
  document.getElementById('mgmt-lost-conv').textContent = (data.lost_conversations || 0).toLocaleString();
  const winRate = data.win_rate != null ? data.win_rate.toFixed(2) + '%' : '0%';
  document.getElementById('mgmt-win-rate').textContent = winRate;
}

// ─── Render: Win Rate Chart ──────────────────────────
function renderWinRateChart(data) {
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

// ─── Render: Freight Breakdown ───────────────────────────
function renderFreightBreakdown(data) {
  const container = document.getElementById('freightBreakdown');
  if (!data || !data.directions) {
    container.innerHTML = '<div class="text-xs text-slate-400 text-center py-4">No data</div>';
    return;
  }

  const { grand_total, directions } = data;
  const fmt = n => Number(n).toLocaleString();
  const pct = (n, d) => d > 0 ? ((n / d) * 100).toFixed(1) : '0.0';

  // Direction KPI cards
  const cards = directions.map(d => {
    const share    = pct(d.total, grand_total);
    const winRate  = pct(d.won, d.won + d.lost);
    const lossRate = pct(d.lost, d.won + d.lost);
    return `
      <div class="bg-slate-50 dark:bg-slate-800/60 rounded-lg p-3 flex flex-col gap-1 min-w-0">
        <div class="text-[10px] font-bold text-slate-500 uppercase tracking-wide truncate">${d.label}</div>
        <div class="text-xl font-extrabold text-primary leading-none">${fmt(d.total)}</div>
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
      const mWinRate = pct(m.won, m.won + m.lost);
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

  container.innerHTML = `
    <div class="grid grid-cols-5 gap-2 mb-4">${cards}</div>
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
    </div>`;
}

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
document.querySelectorAll('.dl-btn').forEach(btn => {
  btn.addEventListener('click', async () => {
    const type = btn.dataset.type;
    const headers = {};
    if (idToken) headers['Authorization'] = `Bearer ${idToken}`;

    try {
      if (type === 'management-freight-breakdown') {
        const data = await api(`/api/management-freight-breakdown?${qs()}`);
        const rows = [['Direction', 'Mode', 'Total', '% of Direction', 'Won', 'Lost', 'Win %']];
        const pct = (n, d) => d > 0 ? ((n / d) * 100).toFixed(2) : '0.00';
        for (const dir of (data.directions || [])) {
          for (const m of (dir.modes || [])) {
            rows.push([
              dir.label,
              m.label,
              m.total,
              pct(m.total, dir.total),
              m.won,
              m.lost,
              pct(m.won, m.won + m.lost),
            ]);
          }
        }
        const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'management-freight-breakdown.csv';
        a.click();
        URL.revokeObjectURL(a.href);
        return;
      }

      if (type === 'management-win-rate') {
        // Build CSV client-side from the win-rate endpoint
        const data = await api(`/api/management-win-rate?${qs()}`);
        const rows = [['Date', 'Won', 'Lost', 'Total', 'Win Rate (%)']];
        for (const d of data) {
          const wr = (d.won + d.lost) > 0 ? ((d.won / (d.won + d.lost)) * 100).toFixed(2) : '0.00';
          rows.push([d.day, d.won, d.lost, d.total, wr]);
        }
        const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'management-win-rate.csv';
        a.click();
        URL.revokeObjectURL(a.href);
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
    const [stats, trend, team, pending, accounts, schedules, mgmtKpis, winRate, freightBreakdown] = await Promise.all([
      api(`/api/dashboard-stats?${q}`),
      api(`/api/conversation-trend?${q}`),
      api(`/api/team-performance?${q}`),
      api('/api/zero-replies-conversations'),
      api(`/api/top-accounts?${q}`),
      api(`/api/team-schedules`),
      api(`/api/management-kpis?${q}`),
      api(`/api/management-win-rate?${q}`),
      api(`/api/management-freight-breakdown?${q}`).catch(() => null),
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
    renderFreightBreakdown(freightBreakdown);
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
  } else {
    currentUser = null;
    idToken = null;
    updateAuthUI(null);
    loginOverlay.style.display = 'flex';
  }
});
