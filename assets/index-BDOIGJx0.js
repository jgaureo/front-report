(function(){const t=document.createElement("link").relList;if(t&&t.supports&&t.supports("modulepreload"))return;for(const s of document.querySelectorAll('link[rel="modulepreload"]'))o(s);new MutationObserver(s=>{for(const a of s)if(a.type==="childList")for(const d of a.addedNodes)d.tagName==="LINK"&&d.rel==="modulepreload"&&o(d)}).observe(document,{childList:!0,subtree:!0});function n(s){const a={};return s.integrity&&(a.integrity=s.integrity),s.referrerPolicy&&(a.referrerPolicy=s.referrerPolicy),s.crossOrigin==="use-credentials"?a.credentials="include":s.crossOrigin==="anonymous"?a.credentials="omit":a.credentials="same-origin",a}function o(s){if(s.ep)return;s.ep=!0;const a=n(s);fetch(s.href,a)}})();firebase.initializeApp({apiKey:"AIzaSyB9bzvJnQgQTsXajtKmOWXjut4gN9PRsLU",authDomain:"front-report.firebaseapp.com",projectId:"front-report",storageBucket:"front-report.firebasestorage.app",messagingSenderId:"797597961440",appId:"1:797597961440:web:9c975ccf35db6aa1b3d485"});const O=firebase.auth(),me=new firebase.auth.GoogleAuthProvider;me.setCustomParameters({hd:"freightright.com"});let R=null,S=null,ee={};const oe={"Ocean FCL":"#5B86AD","Ocean LCL":"#588B8B","Air LCL":"#D1A677","Road LTL":"#FB923C","Road FTL":"#1e3063",FCL:"#5B86AD",LCL:"#588B8B",LTL:"#D1A677",FTL:"#FB923C"},j=["#818CF8","#34D399","#F472B6","#38BDF8","#FCD34D","#6366F1"],ae=["#1e3063","#73be4b","#5B86AD","#D1A677","#FB923C","#588B8B","#FF4081","#818CF8"],re={open:{bg:"bg-sea-fcl",hex:"#5B86AD",label:"Open"},waiting:{bg:"bg-road-ltl",hex:"#FB923C",label:"Waiting"},resolved:{bg:"bg-accent-green",hex:"#73be4b",label:"Resolved"},archived:{bg:"bg-slate-400",hex:"#9CA3AF",label:"Archived"}},xe="https://app.frontapp.com/open/";function fe(e){const t=new Date,n=new Date(t.getFullYear(),t.getMonth(),t.getDate()),o=s=>new Date(s.getFullYear(),s.getMonth(),s.getDate(),23,59,59,999);switch(e){case"today":return{start:n,end:o(n)};case"yesterday":{const s=new Date(n);return s.setDate(s.getDate()-1),{start:s,end:o(s)}}case"this-week":{const s=new Date(n);return s.setDate(s.getDate()-s.getDay()),{start:s,end:o(n)}}case"last-7":{const s=new Date(n);return s.setDate(s.getDate()-6),{start:s,end:o(n)}}case"last-week":{const s=new Date(n);s.setDate(s.getDate()-s.getDay()-7);const a=new Date(s);return a.setDate(a.getDate()+6),{start:s,end:o(a)}}case"last-month":{const s=new Date(t.getFullYear(),t.getMonth()-1,1),a=new Date(t.getFullYear(),t.getMonth(),0);return{start:s,end:o(a)}}case"last-quarter":{const s=Math.floor(t.getMonth()/3),a=new Date(t.getFullYear(),(s-1)*3,1),d=new Date(t.getFullYear(),s*3,0);return{start:a,end:o(d)}}case"last-year":return{start:new Date(t.getFullYear()-1,0,1),end:o(new Date(t.getFullYear()-1,11,31))};case"ytd":return{start:new Date(t.getFullYear(),0,1),end:o(n)};default:return{start:n,end:o(n)}}}let H=fe("last-7");const te=window.location.hostname==="localhost"?"":"https://front-report.onrender.com",I=()=>`start=${H.start.toISOString()}&end=${H.end.toISOString()}`,k=async(e,t={},n)=>{const o={...t.headers||{}};S&&(o.Authorization=`Bearer ${S}`);const s={...t,headers:o},a=await fetch(te+e,s);if(a.status===401&&!n&&R)return S=await R.getIdToken(!0),k(e,t,!0);if(!a.ok){let d=String(a.status);try{const u=await a.json();u.error&&(d+=": "+u.error)}catch{}throw new Error(d)}return a.json()},T=document.createElement("div");T.id="loadingOverlay";T.className="fixed inset-0 z-[60] bg-background-light/60 backdrop-blur-sm flex items-center justify-center pointer-events-auto transition-opacity duration-200";T.innerHTML=`
  <div class="bg-white rounded-2xl shadow-lg px-8 py-6 flex flex-col items-center gap-3">
    <div class="size-8 border-3 border-primary/20 border-t-primary rounded-full animate-spin"></div>
    <span class="text-sm font-semibold text-primary">Loading dashboard…</span>
  </div>`;T.style.display="none";document.body.appendChild(T);function ye(){T.style.display="flex"}function we(){T.style.display="none"}const ne=document.createElement("div");ne.className="fixed top-16 left-1/2 -translate-x-1/2 z-[80] flex flex-col items-center gap-2 pointer-events-none";document.body.appendChild(ne);function Q(e,t="success"){const n={success:"bg-accent-green text-white",error:"bg-red-500 text-white",info:"bg-primary text-white"},o={success:"check_circle",error:"error",info:"info"},s=document.createElement("div");s.className=`flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg text-sm font-semibold pointer-events-auto ${n[t]||n.info} opacity-0 translate-y-[-8px] transition-all duration-300`,s.innerHTML=`<span class="material-symbols-outlined text-lg">${o[t]||o.info}</span>${B(e)}`,ne.appendChild(s),requestAnimationFrame(()=>{s.classList.remove("opacity-0","translate-y-[-8px]")}),setTimeout(()=>{s.classList.add("opacity-0","translate-y-[-8px]"),setTimeout(()=>s.remove(),300)},3e3)}function ge(e){var n;document.querySelectorAll(".page").forEach(o=>o.classList.remove("active")),(n=document.getElementById(`page-${e}`))==null||n.classList.add("active"),document.querySelectorAll(".nav-tab").forEach(o=>{const s=o.dataset.page===e;o.className=`nav-tab flex flex-col items-center gap-1 ${s?"text-primary":"text-slate-400"}`;const a=o.querySelector(".material-symbols-outlined");a&&(a.style.fontVariationSettings=s?"'FILL' 1":"'FILL' 0")});const t=document.getElementById("datePreset");t&&(t.style.display=e==="pricing-dashboard"||e==="management-dashboard"?"":"none"),e==="pricing-dashboard"&&V&&he(V),e==="management-dashboard"&&Z&&ve(Z)}document.querySelectorAll(".nav-tab").forEach(e=>{e.addEventListener("click",t=>{t.preventDefault(),ge(e.dataset.page)})});function q(e){let t=0;for(let n=0;n<e.length;n++)t=e.charCodeAt(n)+((t<<5)-t);return ae[Math.abs(t)%ae.length]}function se(e,t){return(((e==null?void 0:e[0])||"")+((t==null?void 0:t[0])||"")).toUpperCase()}function X(e){if(e=Math.round(e),e<60)return`${e}m`;const t=Math.floor(e/60),n=e%60;return t<24?`${t}h ${n}m`:`${Math.floor(t/24)}d ${t%24}h`}function B(e){return(e||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;")}function $e(e){document.getElementById("kpi-open").textContent=e.total_open.toLocaleString(),document.getElementById("kpi-waiting").textContent=e.total_waiting.toLocaleString(),document.getElementById("kpi-resolved").textContent=e.total_resolved.toLocaleString(),document.getElementById("kpi-archived").textContent=e.total_archived.toLocaleString()}function Le(e){const t=document.getElementById("donutGrid");t.innerHTML="";const n=[{key:"IMPORT",label:"Import"},{key:"EXPORT",label:"Export"},{key:"DOMESTIC",label:"Domestic"},{key:"CROSSTRADE",label:"Cross-Trade"}];for(const o of n){const s=e[o.key]||{total:0,breakdowns:[]},a=s.breakdowns.filter(m=>m.count>0),d=a.reduce((m,c)=>m+c.count,0)||0;let u='<circle class="stroke-slate-100" cx="18" cy="18" fill="none" r="16" stroke-width="4"></circle>',x=0;a.forEach((m,c)=>{const p=m.count/d*100,b=oe[m.label]||j[c%j.length];u+=`<circle cx="18" cy="18" fill="none" r="16" stroke="${b}" stroke-width="4" stroke-dasharray="${p} ${100-p}" stroke-dashoffset="${-x}"></circle>`,x+=p});const y=a.map((m,c)=>`<span class="inline-flex items-center gap-1 text-[9px] text-slate-500"><span class="size-1.5 rounded-full inline-block" style="background:${oe[m.label]||j[c%j.length]}"></span>${m.label}: ${m.count}</span>`).join(" ");t.innerHTML+=`
      <div class="bg-white dark:bg-background-dark/50 p-4 rounded-xl shadow-sm border border-primary/5 flex flex-col items-center">
        <div class="relative size-20 mb-2">
          <svg class="size-full rotate-[-90deg]" viewBox="0 0 36 36">${u}</svg>
          <div class="absolute inset-0 flex items-center justify-center text-sm font-extrabold text-slate-700">${s.total}</div>
        </div>
        <span class="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">${o.label}</span>
        <div class="flex flex-wrap justify-center gap-x-2 gap-y-0.5">${y}</div>
      </div>`}}function he(e){V=e;const t=document.getElementById("trendChart"),n=document.getElementById("trendTooltip");if(t.innerHTML="",!e||!e.length){t.innerHTML='<text x="50%" y="50%" text-anchor="middle" fill="#9CA3AF" font-size="12">No data</text>';return}const o=t.getBoundingClientRect().width||600,s=200;t.setAttribute("viewBox",`0 0 ${o} ${s}`);const a={t:16,r:16,b:32,l:40},d=o-a.l-a.r,u=s-a.t-a.b,x=Math.max(...e.map(r=>Math.max(r.conversations,r.replies)),1),y=e.length>1?d/(e.length-1):d/2,m=r=>a.l+r*y,c=r=>a.t+u-r/x*u,p="http://www.w3.org/2000/svg";for(let r=0;r<=4;r++){const h=a.t+u/4*r,l=document.createElementNS(p,"line");Object.entries({x1:a.l,x2:o-a.r,y1:h,y2:h,stroke:"#F3F4F6","stroke-width":1}).forEach(([f,L])=>l.setAttribute(f,L)),t.appendChild(l);const i=document.createElementNS(p,"text");i.setAttribute("x",a.l-6),i.setAttribute("y",h+3),i.setAttribute("text-anchor","end"),i.setAttribute("fill","#9CA3AF"),i.setAttribute("font-size","9"),i.textContent=Math.round(x-x/4*r),t.appendChild(i)}const b=Math.max(1,Math.floor(e.length/7));e.forEach((r,h)=>{if(h%b!==0&&h!==e.length-1)return;const l=document.createElementNS(p,"text");l.setAttribute("x",m(h)),l.setAttribute("y",s-6),l.setAttribute("text-anchor","middle"),l.setAttribute("fill","#9CA3AF"),l.setAttribute("font-size","9");const i=new Date(r.day+"T00:00:00");l.textContent=i.toLocaleDateString("en-US",{month:"short",day:"numeric"}),t.appendChild(l)});function v(r,h,l){let i=`M ${m(0)} ${c(e[0][r])}`;for(let g=1;g<e.length;g++)i+=` L ${m(g)} ${c(e[g][r])}`;i+=` L ${m(e.length-1)} ${a.t+u} L ${m(0)} ${a.t+u} Z`;const f=document.createElementNS(p,"path");f.setAttribute("d",i),f.setAttribute("fill",l),t.appendChild(f);let L=`M ${m(0)} ${c(e[0][r])}`;for(let g=1;g<e.length;g++)L+=` L ${m(g)} ${c(e[g][r])}`;const w=document.createElementNS(p,"path");w.setAttribute("d",L),w.setAttribute("fill","none"),w.setAttribute("stroke",h),w.setAttribute("stroke-width","2"),t.appendChild(w),e.forEach((g,E)=>{const $=document.createElementNS(p,"circle");$.setAttribute("cx",m(E)),$.setAttribute("cy",c(g[r])),$.setAttribute("r","3"),$.setAttribute("fill",h),$.setAttribute("stroke","#fff"),$.setAttribute("stroke-width","1.5"),t.appendChild($)})}v("conversations","#5B86AD","rgba(91,134,173,0.08)"),v("replies","#FF4081","rgba(255,64,129,0.08)"),e.forEach((r,h)=>{const l=document.createElementNS(p,"rect");l.setAttribute("x",m(h)-y/2),l.setAttribute("y",a.t),l.setAttribute("width",y),l.setAttribute("height",u),l.setAttribute("fill","transparent"),l.addEventListener("mouseenter",()=>{n.classList.remove("hidden");const i=new Date(r.day+"T00:00:00");n.innerHTML=`<strong>${i.toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"})}</strong><br>Conversations: ${r.conversations}<br>Replies: ${r.replies}`}),l.addEventListener("mousemove",i=>{const f=t.closest(".relative").getBoundingClientRect();n.style.left=i.clientX-f.left+12+"px",n.style.top=i.clientY-f.top-40+"px"}),l.addEventListener("mouseleave",()=>n.classList.add("hidden")),t.appendChild(l)})}function ke(e){const t=document.getElementById("topAccounts");if(!e||!e.length){t.innerHTML='<div class="text-xs text-slate-400 text-center py-4">No account data</div>';return}const n=Math.max(...e.map(o=>o.total),1);t.innerHTML=e.map(o=>{const s=["open","waiting","resolved","archived"].filter(a=>o[a]>0).map(a=>`<div class="h-full ${re[a].bg} rounded" style="width:${o[a]/n*100}%" title="${re[a].label}: ${o[a]}"></div>`).join("");return`<div class="space-y-1.5">
      <div class="flex justify-between text-xs font-bold text-slate-600"><span>${B(o.account_name)}</span><span>${o.total} requests</span></div>
      <div class="h-2 w-full bg-slate-100 rounded-full overflow-hidden flex">${s}</div>
    </div>`}).join("")}let V=null,Z=null,N=[],D="assigned_conversations",M=!1;function Ee(){const e=[...N];return e.sort((t,n)=>{let o=t[D],s=n[D];return D==="name"?(o=(o||"").toLowerCase(),s=(s||"").toLowerCase(),M?o.localeCompare(s):s.localeCompare(o)):M?o-s:s-o}),e}function Ae(){document.querySelectorAll("th[data-sort]").forEach(e=>{const t=e.querySelector(".sort-arrow");e.dataset.sort===D?t.textContent=M?"↑":"↓":t.textContent=""})}function be(e){e&&(N=e);const t=document.getElementById("teamBody");if(!N||!N.length){t.innerHTML='<tr><td colspan="7" class="px-4 py-6 text-center text-xs text-slate-400">No data</td></tr>';return}const n=Ee();Ae(),t.innerHTML=n.map(o=>{const s=se(o.first_name,o.last_name);return`<tr>
      <td class="px-4 py-3"><div class="flex items-center gap-2 whitespace-nowrap">
        <div class="size-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white" style="background:${q(o.name)}">${s}</div>
        <span class="text-xs font-semibold text-slate-700">${B(o.name)}</span>
      </div></td>
      <td class="px-3 py-3 text-center text-xs font-medium text-slate-600">${o.assigned_conversations}</td>
      <td class="px-3 py-3 text-center text-xs font-medium text-slate-600">${o.touched_conversations}</td>
      <td class="px-3 py-3 text-center text-xs font-medium text-slate-600">${o.messages_sent}</td>
      <td class="px-3 py-3 text-center text-xs font-medium text-slate-600">${o.replies_sent}</td>
      <td class="px-3 py-3 text-center text-xs font-medium text-slate-600 whitespace-nowrap">${X(o.avg_reply_minutes)}</td>
      <td class="px-3 py-3 text-center text-xs font-medium text-slate-600 whitespace-nowrap">${X(o.avg_first_reply_minutes)}</td>
    </tr>`}).join("")}function Be(e){const t=document.getElementById("pendingBody");if(!e||!e.length){t.innerHTML='<tr><td colspan="4" class="px-4 py-6 text-center text-xs text-slate-400">No pending replies</td></tr>';return}t.innerHTML=e.map(n=>{const o=se(n.first_name,n.last_name),s=q(n.teammate),a=n.age_hours<24?`${n.age_hours}h`:`${Math.floor(n.age_hours/24)}d ${n.age_hours%24}h`,d=n.age_hours>48?"text-red-500":n.age_hours>12?"text-amber-600":"text-slate-400",u=`${xe}${n.conversation_id}`;return`<tr>
      <td class="px-4 py-3"><div class="flex items-center gap-2">
        <div class="size-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white" style="background:${s}">${o}</div>
        <span class="text-xs font-semibold text-slate-700">${B(n.teammate)}</span>
      </div></td>
      <td class="px-4 py-3 text-xs font-bold ${d}">${a}</td>
      <td class="px-4 py-3 text-xs text-slate-500 truncate max-w-[200px]" title="${B(n.subject)}">${B(n.subject)}</td>
      <td class="px-4 py-3">
        <a href="${u}" target="_blank" rel="noopener noreferrer"
           class="inline-flex items-center gap-1 text-[10px] font-mono text-primary hover:text-accent-green transition-colors"
           title="Open in Front">
          ${n.conversation_id}
          <span class="material-symbols-outlined text-[14px]">open_in_new</span>
        </a>
      </td>
    </tr>`}).join("")}function Se(e){const t=document.getElementById("teamDirectory");if(!e||!e.length){t.innerHTML='<div class="p-6 text-center text-xs text-slate-400">No team data</div>';return}t.innerHTML=e.map(n=>{const o=se(n.first_name,n.last_name);return`<div class="p-4 flex items-center justify-between">
      <div class="flex items-center gap-3">
        <div class="h-12 w-12 rounded-full flex items-center justify-center text-sm font-bold text-white border border-slate-200 dark:border-slate-700" style="background:${q(n.name)}">${o}</div>
        <div>
          <p class="font-bold text-slate-900 dark:text-slate-100">${B(n.name)}</p>
          <p class="text-xs text-slate-500">${n.assigned_conversations} assigned · ${n.messages_sent} messages</p>
        </div>
      </div>
      <div class="flex flex-col items-end gap-1.5">
        <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
          <span class="w-1.5 h-1.5 rounded-full bg-green-500"></span>Active
        </span>
        <button class="text-[10px] font-bold text-primary hover:underline edit-schedule-btn" data-id="${n.teammate_id}" data-name="${B(n.first_name)}">Edit Schedule</button>
        <p class="text-[10px] text-slate-400 mt-1 font-medium">Avg reply: ${X(n.avg_reply_minutes)}</p>
      </div>
    </div>`}).join("")}function Te(e){const t=document.getElementById("mgmtKpiCards");if(!e||!e.current)return;const n=e.current,o=e.previous||{},s=e.status_breakdown||[],a=e.daily||[],d=l=>Number(l).toLocaleString();function u(l,i,f=!1){if(!i||i===0)return'<span class="text-[10px] text-slate-300 font-medium">—</span>';const L=(l-i)/i*100,w=L>=0,g=f?!w:w;return`<span class="${g?"text-[#73be4b]":"text-red-400"} text-[10px] font-bold bg-${g?"[#73be4b]":"red-400"}/10 px-1.5 py-0.5 rounded">${w?"↑":"↓"} ${Math.abs(L).toFixed(1)}%</span>`}function x(l,i){if(i==null)return'<span class="text-[10px] text-slate-300 font-medium">—</span>';const f=l-i,L=f>=0?"text-[#73be4b]":"text-red-400",w=f>=0?"↑":"↓";return`<span class="${L} text-[10px] font-bold">${w} ${Math.abs(f).toFixed(1)}pp</span>`}function y(l,i){if(a.length<2)return"";const f=a.map(A=>Number(A[l])),L=Math.max(...f,1),w=80,g=34,E=A=>A/(f.length-1)*(w-4)+2,$=A=>g-3-A/L*(g-8),F=f.map((A,K)=>`${E(K)},${$(A)}`).join(" L "),Y=f[f.length-1];return`<svg width="${w}" height="${g}" viewBox="0 0 ${w} ${g}" class="overflow-visible flex-shrink-0">
      <defs><linearGradient id="sg-${l}" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="${i}" stop-opacity="0.25"/>
        <stop offset="100%" stop-color="${i}" stop-opacity="0"/>
      </linearGradient></defs>
      <path d="M ${F} L ${E(f.length-1)},${g} L ${E(0)},${g} Z" fill="url(#sg-${l})"/>
      <polyline points="${f.map((A,K)=>`${E(K)},${$(A)}`).join(" ")}" fill="none" stroke="${i}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
      <circle cx="${E(f.length-1)}" cy="${$(Y)}" r="2.5" fill="${i}" stroke="#fff" stroke-width="1.5"/>
    </svg>`}function m(l){const F=Math.PI*22,Y=Math.min(l/100,1)*F;return`<svg width="54" height="30" viewBox="0 0 54 30" class="overflow-visible flex-shrink-0">
      <path d="M 5,30 A 22,22 0 0,0 49,30" fill="none" stroke="#E2E8F0" stroke-width="5" stroke-linecap="round"/>
      <path d="M 5,30 A 22,22 0 0,0 49,30" fill="none" stroke="${l>=60?"#73be4b":l>=35?"#f59e0b":"#f87171"}" stroke-width="5" stroke-linecap="round"
        stroke-dasharray="${Y.toFixed(1)} ${(F+1).toFixed(1)}"/>
    </svg>`}const c={Contacted:"#5B86AD","Need to Quote":"#f59e0b",Quoted:"#73be4b","Need to Requote":"#f97316","Need to Onboard":"#8b5cf6","Pending Review":"#ec4899"},p=s.reduce((l,i)=>l+i.count,0)||1,b=s.length?`
    <div class="flex w-full h-2 rounded-full overflow-hidden gap-px mt-3 mb-2.5">
      ${s.map(l=>`<div style="width:${(l.count/p*100).toFixed(1)}%;background:${c[l.status]||"#9CA3AF"}" title="${l.status}: ${d(l.count)}"></div>`).join("")}
    </div>
    <div class="flex flex-wrap gap-x-3 gap-y-1.5">
      ${s.map(l=>`
        <div class="flex items-center gap-1">
          <div class="size-2 rounded-sm flex-shrink-0" style="background:${c[l.status]||"#9CA3AF"}"></div>
          <span class="text-[9px] text-slate-500">${l.status}</span>
          <span class="text-[9px] font-bold text-slate-600 dark:text-slate-300">${d(l.count)}</span>
        </div>`).join("")}
    </div>`:"",v=n.won_conversations+n.lost_conversations,r=v>0?(n.won_conversations/v*100).toFixed(1):"0.0",h=v>0?(n.lost_conversations/v*100).toFixed(1):"0.0";t.innerHTML=`
    <!-- Total Conversations -->
    <div class="bg-white dark:bg-background-dark/50 p-4 rounded-xl shadow-sm border border-primary/5">
      <div class="flex items-center justify-between mb-1">
        <p class="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Total Conversations</p>
        ${u(n.total_conversations,o.total_conversations)}
      </div>
      <div class="flex items-end justify-between">
        <p class="text-3xl font-bold text-primary leading-none">${d(n.total_conversations)}</p>
        ${y("total","#5B86AD")}
      </div>
      ${b}
      ${o.total_conversations?`<p class="text-[9px] text-slate-400 mt-2">prev period: ${d(o.total_conversations)}</p>`:""}
    </div>

    <!-- Won Conversations -->
    <div class="bg-white dark:bg-background-dark/50 p-4 rounded-xl shadow-sm border border-primary/5">
      <div class="flex items-center justify-between mb-1">
        <p class="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Won Conversations</p>
        ${u(n.won_conversations,o.won_conversations)}
      </div>
      <div class="flex items-end justify-between">
        <p class="text-3xl font-bold text-[#73be4b] leading-none">${d(n.won_conversations)}</p>
        ${y("won","#73be4b")}
      </div>
      <div class="mt-2.5 flex items-center gap-2">
        <div class="flex-1 h-1.5 rounded-full bg-slate-100 overflow-hidden">
          <div class="h-full rounded-full bg-[#73be4b]" style="width:${r}%"></div>
        </div>
        <span class="text-[10px] font-bold text-[#73be4b] flex-shrink-0">${r}% of closed</span>
      </div>
      ${o.won_conversations!=null?`<p class="text-[9px] text-slate-400 mt-1.5">prev period: ${d(o.won_conversations)}</p>`:""}
    </div>

    <!-- Lost Conversations -->
    <div class="bg-white dark:bg-background-dark/50 p-4 rounded-xl shadow-sm border border-primary/5">
      <div class="flex items-center justify-between mb-1">
        <p class="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Lost Conversations</p>
        ${u(n.lost_conversations,o.lost_conversations,!0)}
      </div>
      <div class="flex items-end justify-between">
        <p class="text-3xl font-bold text-red-400 leading-none">${d(n.lost_conversations)}</p>
        ${y("lost","#f87171")}
      </div>
      <div class="mt-2.5 flex items-center gap-2">
        <div class="flex-1 h-1.5 rounded-full bg-slate-100 overflow-hidden">
          <div class="h-full rounded-full bg-red-400" style="width:${h}%"></div>
        </div>
        <span class="text-[10px] font-bold text-red-400 flex-shrink-0">${h}% of closed</span>
      </div>
      ${o.lost_conversations!=null?`<p class="text-[9px] text-slate-400 mt-1.5">prev period: ${d(o.lost_conversations)}</p>`:""}
    </div>

    <!-- Win Rate -->
    <div class="bg-white dark:bg-background-dark/50 p-4 rounded-xl shadow-sm border border-primary/5">
      <div class="flex items-center justify-between mb-1">
        <p class="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Win Rate</p>
        ${x(n.win_rate,o.win_rate)}
      </div>
      <div class="flex items-end justify-between">
        <p class="text-3xl font-bold text-primary leading-none">${n.win_rate.toFixed(2)}%</p>
        ${m(n.win_rate)}
      </div>
      <p class="text-[9px] text-slate-400 mt-2.5">${v.toLocaleString()} closed deals (${d(n.won_conversations)} won · ${d(n.lost_conversations)} lost)</p>
      ${o.win_rate!=null?`<p class="text-[9px] text-slate-400 mt-0.5">prev period: ${o.win_rate.toFixed(1)}%</p>`:""}
    </div>`}function ve(e){Z=e;const t=document.getElementById("winRateChart"),n=document.getElementById("winRateTooltip");if(t.innerHTML="",!e||!e.length){t.innerHTML='<text x="50%" y="50%" text-anchor="middle" fill="#9CA3AF" font-size="12">No data</text>';return}const o=t.getBoundingClientRect().width||600,s=200;t.setAttribute("viewBox",`0 0 ${o} ${s}`);const a={t:16,r:16,b:32,l:40},d=o-a.l-a.r,u=s-a.t-a.b,x=Math.max(...e.map(r=>Math.max(r.won,r.lost)),1),y=e.length>1?d/(e.length-1):d/2,m=r=>a.l+r*y,c=r=>a.t+u-r/x*u,p="http://www.w3.org/2000/svg";for(let r=0;r<=4;r++){const h=a.t+u/4*r,l=document.createElementNS(p,"line");Object.entries({x1:a.l,x2:o-a.r,y1:h,y2:h,stroke:"#F3F4F6","stroke-width":1}).forEach(([f,L])=>l.setAttribute(f,L)),t.appendChild(l);const i=document.createElementNS(p,"text");i.setAttribute("x",a.l-6),i.setAttribute("y",h+3),i.setAttribute("text-anchor","end"),i.setAttribute("fill","#9CA3AF"),i.setAttribute("font-size","9"),i.textContent=Math.round(x-x/4*r),t.appendChild(i)}const b=Math.max(1,Math.floor(e.length/7));e.forEach((r,h)=>{if(h%b!==0&&h!==e.length-1)return;const l=document.createElementNS(p,"text");l.setAttribute("x",m(h)),l.setAttribute("y",s-6),l.setAttribute("text-anchor","middle"),l.setAttribute("fill","#9CA3AF"),l.setAttribute("font-size","9");const i=new Date(r.day+"T00:00:00");l.textContent=i.toLocaleDateString("en-US",{month:"short",day:"numeric"}),t.appendChild(l)});function v(r,h,l){let i=`M ${m(0)} ${c(e[0][r])}`;for(let g=1;g<e.length;g++)i+=` L ${m(g)} ${c(e[g][r])}`;i+=` L ${m(e.length-1)} ${a.t+u} L ${m(0)} ${a.t+u} Z`;const f=document.createElementNS(p,"path");f.setAttribute("d",i),f.setAttribute("fill",l),t.appendChild(f);let L=`M ${m(0)} ${c(e[0][r])}`;for(let g=1;g<e.length;g++)L+=` L ${m(g)} ${c(e[g][r])}`;const w=document.createElementNS(p,"path");w.setAttribute("d",L),w.setAttribute("fill","none"),w.setAttribute("stroke",h),w.setAttribute("stroke-width","2"),t.appendChild(w),e.forEach((g,E)=>{const $=document.createElementNS(p,"circle");$.setAttribute("cx",m(E)),$.setAttribute("cy",c(g[r])),$.setAttribute("r","3"),$.setAttribute("fill",h),$.setAttribute("stroke","#fff"),$.setAttribute("stroke-width","1.5"),t.appendChild($)})}v("won","#73be4b","rgba(115,190,75,0.08)"),v("lost","#f87171","rgba(248,113,113,0.08)"),e.forEach((r,h)=>{const l=document.createElementNS(p,"rect");l.setAttribute("x",m(h)-y/2),l.setAttribute("y",a.t),l.setAttribute("width",y),l.setAttribute("height",u),l.setAttribute("fill","transparent");const i=r.won+r.lost>0?(r.won/(r.won+r.lost)*100).toFixed(1):"—";l.addEventListener("mouseenter",()=>{n.classList.remove("hidden");const f=new Date(r.day+"T00:00:00");n.innerHTML=`<strong>${f.toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"})}</strong><br>Won: ${r.won} &nbsp; Lost: ${r.lost} &nbsp; Total: ${r.total}<br>Win Rate: ${i}%`}),l.addEventListener("mousemove",f=>{const L=t.closest(".relative").getBoundingClientRect();n.style.left=f.clientX-L.left+12+"px",n.style.top=f.clientY-L.top-40+"px"}),l.addEventListener("mouseleave",()=>n.classList.add("hidden")),t.appendChild(l)})}function Ce(e){const t=document.getElementById("freightBreakdown");if(!e||!e.directions){t.innerHTML='<div class="text-xs text-slate-400 text-center py-4">No data</div>';return}const{grand_total:n,no_direction_total:o,directions:s}=e,a=c=>Number(c).toLocaleString(),d=(c,p)=>p>0?(c/p*100).toFixed(1):"0.0",u=s.map(c=>{const p=d(c.total,n),b=d(c.won,c.won+c.lost),v=d(c.lost,c.won+c.lost);return`
      <div class="bg-slate-50 dark:bg-slate-800/60 rounded-lg p-3 flex flex-col gap-1 min-w-0">
        <div class="text-[10px] font-bold text-slate-500 uppercase tracking-wide truncate">${c.label}</div>
        <div class="text-xl font-extrabold text-primary leading-none">${a(c.total)}</div>
        <div class="text-[10px] text-slate-400">${p}% of total</div>
        <div class="flex items-center gap-2 mt-1">
          <span class="text-xs font-bold text-[#73be4b]">${a(c.won)} Won</span>
          <span class="text-[10px] text-slate-300">|</span>
          <span class="text-xs font-bold text-red-400">${a(c.lost)} Lost</span>
        </div>
        <div class="flex items-center gap-2">
          <span class="text-[10px] font-semibold text-[#73be4b]">${b}% win</span>
          <span class="text-[10px] text-slate-300">|</span>
          <span class="text-[10px] font-semibold text-red-400">${v}% loss</span>
        </div>
      </div>`}).join(""),x=s.flatMap(c=>c.modes.map(p=>{const b=d(p.total,c.total),v=d(p.won,p.won+p.lost);return`<tr class="border-t border-slate-100 dark:border-slate-700/50">
        <td class="py-1.5 px-2 text-[11px] text-slate-500">${c.label}</td>
        <td class="py-1.5 px-2 text-[11px] font-semibold text-slate-700 dark:text-slate-300">${p.label}</td>
        <td class="py-1.5 px-2 text-[11px] text-right text-slate-700 dark:text-slate-300">${a(p.total)}</td>
        <td class="py-1.5 px-2 text-[11px] text-right text-slate-400">${b}%</td>
        <td class="py-1.5 px-2 text-[11px] text-right text-[#73be4b] font-semibold">${a(p.won)}</td>
        <td class="py-1.5 px-2 text-[11px] text-right text-red-400 font-semibold">${a(p.lost)}</td>
        <td class="py-1.5 px-2 text-[11px] text-right font-bold text-slate-700 dark:text-slate-300">${v}%</td>
      </tr>`})).join(""),y=o>0?`<div class="mt-3 flex items-start gap-2">
        <span class="text-[10px] text-slate-400 italic leading-relaxed">
          * ${a(o)} QRN(s) have no direction recorded and are excluded from the totals above.
          Grand total including unclassified: ${a(n+o)}.
        </span>
        <button id="dlNoDirectionBtn" class="flex-shrink-0 inline-flex items-center gap-1 px-2 py-1 rounded text-[10px] font-bold text-primary bg-primary/10 hover:bg-primary/20 not-italic transition-colors">
          <span class="material-symbols-outlined text-[12px]">download</span>Download
        </button>
      </div>`:"";t.innerHTML=`
    <div class="grid grid-cols-4 gap-2 mb-4">${u}</div>
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
        <tbody>${x||'<tr><td colspan="7" class="py-3 text-center text-xs text-slate-400">No mode data</td></tr>'}</tbody>
      </table>
    </div>
    ${y}`;const m=t.querySelector("#dlNoDirectionBtn");m&&m.addEventListener("click",async()=>{m.disabled=!0,m.innerHTML='<span class="material-symbols-outlined text-[12px] animate-spin">progress_activity</span>';try{const c=await k(`/api/management-no-direction?${I()}`),p=[["Conversation ID","QRN"]];for(const h of c)p.push([h.conversation_id,h.qrn]);const b=p.map(h=>h.map(l=>`"${String(l||"").replace(/"/g,'""')}"`).join(",")).join(`
`),v=new Blob([b],{type:"text/csv;charset=utf-8;"}),r=document.createElement("a");r.href=URL.createObjectURL(v),r.download="no-direction-qrns.csv",r.click(),URL.revokeObjectURL(r.href)}catch(c){console.error("No-direction download error:",c)}finally{m.disabled=!1,m.innerHTML='<span class="material-symbols-outlined text-[12px]">download</span>Download'}})}const U=document.getElementById("scheduleModal");document.addEventListener("click",e=>{const t=e.target.closest(".edit-schedule-btn");t&&De(t.dataset.id,t.dataset.name)});function De(e,t){const n=ee[e]||{timezone:"America/Los_Angeles",workDays:[1,2,3,4,5],startHour:"08:00",endHour:"17:00"};document.getElementById("scheduleModalTitle").textContent=`Shift Schedule: ${t}`,document.getElementById("scheduleTeammateId").value=e,document.getElementById("scheduleTimezone").value=n.timezone||"America/Los_Angeles";const o=["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"],s=document.getElementById("workingDaysContainer");let a=o.map((d,u)=>{const x=(n.workDays||[]).includes(u);return`
      <label class="flex items-center gap-3 cursor-pointer p-2 rounded hover:bg-slate-50 dark:hover:bg-slate-800">
        <input type="checkbox" class="schedule-day-cb rounded border-slate-300 text-primary focus:ring-primary w-4 h-4" value="${u}" ${x?"checked":""} />
        <span class="text-sm font-medium text-slate-700 dark:text-slate-300 w-32">${d}</span>
      </label>
    `}).join("");a+=`
    <div class="flex items-center gap-3 mt-4 pt-4 border-t border-slate-100 dark:border-slate-800">
      <div class="flex-1">
        <label class="block text-xs font-bold text-slate-500 mb-1">Start Time</label>
        <input type="time" id="scheduleStartTime" class="w-full text-sm border border-slate-200 dark:border-slate-700 rounded-lg p-2 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:border-primary" value="${n.startHour||"08:00"}" />
      </div>
      <div class="flex-1">
        <label class="block text-xs font-bold text-slate-500 mb-1">End Time</label>
        <input type="time" id="scheduleEndTime" class="w-full text-sm border border-slate-200 dark:border-slate-700 rounded-lg p-2 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:border-primary" value="${n.endHour||"17:00"}" />
      </div>
    </div>
  `,s.innerHTML=a,U.classList.remove("hidden"),U.classList.add("flex")}document.getElementById("closeScheduleModal")&&(document.getElementById("closeScheduleModal").addEventListener("click",()=>{U.classList.add("hidden"),U.classList.remove("flex")}),document.getElementById("cancelScheduleBtn").addEventListener("click",()=>{document.getElementById("closeScheduleModal").click()}),document.getElementById("saveScheduleBtn").addEventListener("click",async()=>{const e=document.getElementById("saveScheduleBtn"),t=document.getElementById("scheduleTeammateId").value,n=document.getElementById("scheduleTimezone").value,o=document.getElementById("scheduleStartTime").value,s=document.getElementById("scheduleEndTime").value,a=document.querySelectorAll(".schedule-day-cb:checked"),d=Array.from(a).map(x=>Number(x.value)),u={timezone:n,workDays:d,startHour:o,endHour:s};e.disabled=!0,e.innerHTML='<div class="size-4 border-2 border-primary/20 border-t-primary rounded-full animate-spin"></div> Saving...';try{const x=await k("/api/team-schedules",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({teammate_id:t,schedule:u})});x.success?(ee[t]=u,document.getElementById("closeScheduleModal").click(),Q("Schedule saved successfully"),P()):Q(x.error||"Failed to save schedule","error")}catch(x){console.error("Save schedule error:",x);const y=x.message.startsWith("503")?"Firestore not configured on server":"Failed to save schedule: "+x.message;Q(y,"error")}finally{e.disabled=!1,e.innerHTML="Save Changes"}}));document.querySelectorAll(".dl-btn").forEach(e=>{e.addEventListener("click",async()=>{const t=e.dataset.type,n={};S&&(n.Authorization=`Bearer ${S}`);try{if(t==="management-freight-breakdown"){const x=await k(`/api/management-freight-breakdown?${I()}`),y=[["Direction","Mode","Total","% of Direction","Won","Lost","Win %"]],m=(v,r)=>r>0?(v/r*100).toFixed(2):"0.00";for(const v of x.directions||[])for(const r of v.modes||[])y.push([v.label,r.label,r.total,m(r.total,v.total),r.won,r.lost,m(r.won,r.won+r.lost)]);const c=y.map(v=>v.map(r=>`"${String(r).replace(/"/g,'""')}"`).join(",")).join(`
`),p=new Blob([c],{type:"text/csv;charset=utf-8;"}),b=document.createElement("a");b.href=URL.createObjectURL(p),b.download="management-freight-breakdown.csv",b.click(),URL.revokeObjectURL(b.href);return}if(t==="management-win-rate"){const x=await k(`/api/management-win-rate?${I()}`),y=[["Date","Won","Lost","Total","Win Rate (%)"]];for(const b of x){const v=b.won+b.lost>0?(b.won/(b.won+b.lost)*100).toFixed(2):"0.00";y.push([b.day,b.won,b.lost,b.total,v])}const m=y.map(b=>b.map(v=>`"${String(v).replace(/"/g,'""')}"`).join(",")).join(`
`),c=new Blob([m],{type:"text/csv;charset=utf-8;"}),p=document.createElement("a");p.href=URL.createObjectURL(c),p.download="management-win-rate.csv",p.click(),URL.revokeObjectURL(p.href);return}const o=t!=="pending-replies";let s=`${te}/api/download-conversations?type=${t}`;o&&(s+=`&${I()}`);const a=await fetch(s,{headers:n});if(!a.ok)throw new Error(a.status);const d=await a.blob(),u=document.createElement("a");u.href=URL.createObjectURL(d),u.download=e.dataset.filename||`${t}.csv`,u.click(),URL.revokeObjectURL(u.href)}catch(o){console.error("Download error:",o)}})});const G=document.getElementById("datePreset"),le=document.getElementById("customRange");G.addEventListener("change",()=>{if(G.value==="custom"){le.classList.remove("hidden");return}le.classList.add("hidden"),H=fe(G.value),P()});document.getElementById("applyCustom").addEventListener("click",()=>{const e=document.getElementById("customStart").value,t=document.getElementById("customEnd").value;e&&t&&(H={start:new Date(e+"T00:00:00"),end:new Date(t+"T23:59:59.999")},P())});document.querySelectorAll("th[data-sort]").forEach(e=>{e.addEventListener("click",()=>{const t=e.dataset.sort;D===t?M=!M:(D=t,M=t==="name"),be()})});var pe;(pe=document.getElementById("themeLight"))==null||pe.addEventListener("click",()=>{document.documentElement.classList.remove("dark")});var ue;(ue=document.getElementById("themeDark"))==null||ue.addEventListener("click",()=>{document.documentElement.classList.add("dark")});async function P(){ye();const e=I();try{const[t,n,o,s,a,d,u,x,y]=await Promise.all([k(`/api/dashboard-stats?${e}`),k(`/api/conversation-trend?${e}`),k(`/api/team-performance?${e}`),k("/api/zero-replies-conversations"),k(`/api/top-accounts?${e}`),k("/api/team-schedules"),k(`/api/management-kpis?${e}`),k(`/api/management-win-rate?${e}`),k(`/api/management-freight-breakdown?${e}`).catch(()=>null)]);ee=d||{},$e(t),Le(t.quotes),he(n),be(o),Be(s),ke(a),Se(o),Te(u),ve(x),Ce(y)}catch(t){console.error("Load error:",t)}finally{we()}}const z=document.getElementById("searchModal"),W=document.getElementById("searchInput"),_=document.getElementById("searchResults");let ie=null;document.getElementById("searchToggle").addEventListener("click",()=>{z.classList.remove("hidden"),z.classList.add("flex"),W.value="",W.focus(),_.innerHTML='<div class="text-center text-sm text-slate-400 py-12">Type a keyword to search across conversations, messages, quotes, and QRN.</div>'});document.getElementById("searchBack").addEventListener("click",()=>{z.classList.add("hidden"),z.classList.remove("flex")});W.addEventListener("input",()=>{clearTimeout(ie);const e=W.value.trim();if(e.length<2){_.innerHTML='<div class="text-center text-sm text-slate-400 py-12">Type at least 2 characters to search.</div>';return}_.innerHTML='<div class="flex justify-center py-12"><div class="size-6 border-2 border-primary/20 border-t-primary rounded-full animate-spin"></div></div>',ie=setTimeout(()=>Me(e),400)});async function Me(e){try{const t=await k(`/api/search?q=${encodeURIComponent(e)}`);if(!t.length){_.innerHTML='<div class="text-center text-sm text-slate-400 py-12">No results found.</div>';return}const n={subject:"Subject",message:"Message",quote:"Quote",qrn:"QRN"},o={subject:"bg-primary/10 text-primary",message:"bg-amber-100 text-amber-700",quote:"bg-green-100 text-green-700",qrn:"bg-violet-100 text-violet-700"};_.innerHTML=`<p class="text-xs text-slate-400 mb-2">${t.length} result${t.length>1?"s":""}</p>`+t.map(s=>{const a=`${xe}${s.conversation_id}`,d=s.sources.map(x=>`<span class="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${o[x]||"bg-slate-100 text-slate-500"}">${n[x]||x}</span>`).join(" "),u=B(s.snippet).replace(new RegExp(`(${e.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")})`,"gi"),'<mark class="bg-yellow-200 rounded px-0.5">$1</mark>');return`<a href="${a}" target="_blank" rel="noopener noreferrer" class="block bg-white rounded-xl border border-slate-100 p-4 hover:border-primary/30 hover:shadow-sm transition-all group">
          <div class="flex items-start justify-between gap-2 mb-1.5">
            <p class="text-sm font-semibold text-slate-800 group-hover:text-primary line-clamp-1">${B(s.subject)}</p>
            <span class="material-symbols-outlined text-slate-300 group-hover:text-primary text-base shrink-0">open_in_new</span>
          </div>
          <p class="text-xs text-slate-500 line-clamp-2 mb-2">${u}</p>
          <div class="flex items-center gap-1.5">${d}</div>
        </a>`}).join("")}catch(t){console.error("Search error:",t),_.innerHTML='<div class="text-center text-sm text-red-500 py-12">Search failed. Please try again.</div>'}}const ce=document.getElementById("loginOverlay"),C=document.getElementById("loginError"),J=document.getElementById("loginSpinner");function de(e){const t=document.getElementById("authBtn");if(e){if(e.photoURL)t.innerHTML=`<img src="${e.photoURL}" alt="" class="size-10 rounded-full object-cover" referrerpolicy="no-referrer" />`;else{const a=(e.displayName||e.email||"?").split(" ").map(u=>u[0]).join("").substring(0,2).toUpperCase(),d=q(e.displayName||e.email);t.innerHTML=`<span class="size-10 rounded-full flex items-center justify-center text-xs font-bold text-white" style="background:${d}">${a}</span>`}t.title=`Signed in as ${e.email}`;const n=document.getElementById("settingsName"),o=document.getElementById("settingsEmail"),s=document.getElementById("settingsAvatar");n&&(n.textContent=e.displayName||e.email),o&&(o.textContent=e.email),s&&e.photoURL&&(s.innerHTML=`<img src="${e.photoURL}" alt="" class="size-12 rounded-full object-cover" referrerpolicy="no-referrer" />`)}else t.innerHTML='<span class="material-symbols-outlined">login</span>',t.title="Sign in"}fetch(te+"/api/dashboard-stats").catch(()=>{});document.getElementById("googleSignInBtn").addEventListener("click",async()=>{C.classList.add("hidden"),J.classList.remove("hidden");try{await O.signInWithPopup(me)}catch(e){J.classList.add("hidden"),C.textContent=e.code==="auth/popup-closed-by-user"?"":e.message||"Sign-in failed",C.classList.toggle("hidden",!C.textContent)}});document.getElementById("authBtn").addEventListener("click",async()=>{R&&(await O.signOut(),window.location.reload())});O.onAuthStateChanged(async e=>{if(e){if(!e.email.endsWith("@freightright.com")){await O.signOut(),J.classList.add("hidden"),C.textContent="Access restricted to @freightright.com accounts.",C.classList.remove("hidden");return}R=e,S=await e.getIdToken(),de(e),ce.style.display="none",ge("pricing-dashboard"),P()}else R=null,S=null,de(null),ce.style.display="flex"});
