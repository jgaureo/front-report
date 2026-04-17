(function(){const t=document.createElement("link").relList;if(t&&t.supports&&t.supports("modulepreload"))return;for(const s of document.querySelectorAll('link[rel="modulepreload"]'))o(s);new MutationObserver(s=>{for(const a of s)if(a.type==="childList")for(const d of a.addedNodes)d.tagName==="LINK"&&d.rel==="modulepreload"&&o(d)}).observe(document,{childList:!0,subtree:!0});function n(s){const a={};return s.integrity&&(a.integrity=s.integrity),s.referrerPolicy&&(a.referrerPolicy=s.referrerPolicy),s.crossOrigin==="use-credentials"?a.credentials="include":s.crossOrigin==="anonymous"?a.credentials="omit":a.credentials="same-origin",a}function o(s){if(s.ep)return;s.ep=!0;const a=n(s);fetch(s.href,a)}})();firebase.initializeApp({apiKey:"AIzaSyB9bzvJnQgQTsXajtKmOWXjut4gN9PRsLU",authDomain:"front-report.firebaseapp.com",projectId:"front-report",storageBucket:"front-report.firebasestorage.app",messagingSenderId:"797597961440",appId:"1:797597961440:web:9c975ccf35db6aa1b3d485"});const O=firebase.auth(),me=new firebase.auth.GoogleAuthProvider;me.setCustomParameters({hd:"freightright.com"});let I=null,B=null,ee={};const oe={"Ocean FCL":"#5B86AD","Ocean LCL":"#588B8B","Air LCL":"#D1A677","Road LTL":"#FB923C","Road FTL":"#1e3063",FCL:"#5B86AD",LCL:"#588B8B",LTL:"#D1A677",FTL:"#FB923C"},F=["#818CF8","#34D399","#F472B6","#38BDF8","#FCD34D","#6366F1"],ae=["#1e3063","#73be4b","#5B86AD","#D1A677","#FB923C","#588B8B","#FF4081","#818CF8"],re={open:{bg:"bg-sea-fcl",hex:"#5B86AD",label:"Open"},waiting:{bg:"bg-road-ltl",hex:"#FB923C",label:"Waiting"},resolved:{bg:"bg-accent-green",hex:"#73be4b",label:"Resolved"},archived:{bg:"bg-slate-400",hex:"#9CA3AF",label:"Archived"}},xe="https://app.frontapp.com/open/";function fe(e){const t=new Date,n=new Date(t.getFullYear(),t.getMonth(),t.getDate()),o=s=>new Date(s.getFullYear(),s.getMonth(),s.getDate(),23,59,59,999);switch(e){case"today":return{start:n,end:o(n)};case"yesterday":{const s=new Date(n);return s.setDate(s.getDate()-1),{start:s,end:o(s)}}case"this-week":{const s=new Date(n);return s.setDate(s.getDate()-s.getDay()),{start:s,end:o(n)}}case"last-7":{const s=new Date(n);return s.setDate(s.getDate()-6),{start:s,end:o(n)}}case"last-week":{const s=new Date(n);s.setDate(s.getDate()-s.getDay()-7);const a=new Date(s);return a.setDate(a.getDate()+6),{start:s,end:o(a)}}case"last-month":{const s=new Date(t.getFullYear(),t.getMonth()-1,1),a=new Date(t.getFullYear(),t.getMonth(),0);return{start:s,end:o(a)}}case"last-quarter":{const s=Math.floor(t.getMonth()/3),a=new Date(t.getFullYear(),(s-1)*3,1),d=new Date(t.getFullYear(),s*3,0);return{start:a,end:o(d)}}case"last-year":return{start:new Date(t.getFullYear()-1,0,1),end:o(new Date(t.getFullYear()-1,11,31))};case"ytd":return{start:new Date(t.getFullYear(),0,1),end:o(n)};default:return{start:n,end:o(n)}}}let H=fe("last-7");const te=window.location.hostname==="localhost"?"":"https://front-report.onrender.com",j=()=>`start=${H.start.toISOString()}&end=${H.end.toISOString()}`,k=async(e,t={},n)=>{const o={...t.headers||{}};B&&(o.Authorization=`Bearer ${B}`);const s={...t,headers:o},a=await fetch(te+e,s);if(a.status===401&&!n&&I)return B=await I.getIdToken(!0),k(e,t,!0);if(!a.ok){let d=String(a.status);try{const u=await a.json();u.error&&(d+=": "+u.error)}catch{}throw new Error(d)}return a.json()},T=document.createElement("div");T.id="loadingOverlay";T.className="fixed inset-0 z-[60] bg-background-light/60 backdrop-blur-sm flex items-center justify-center pointer-events-auto transition-opacity duration-200";T.innerHTML=`
  <div class="bg-white rounded-2xl shadow-lg px-8 py-6 flex flex-col items-center gap-3">
    <div class="size-8 border-3 border-primary/20 border-t-primary rounded-full animate-spin"></div>
    <span class="text-sm font-semibold text-primary">Loading dashboard…</span>
  </div>`;T.style.display="none";document.body.appendChild(T);function ye(){T.style.display="flex"}function we(){T.style.display="none"}const ne=document.createElement("div");ne.className="fixed top-16 left-1/2 -translate-x-1/2 z-[80] flex flex-col items-center gap-2 pointer-events-none";document.body.appendChild(ne);function G(e,t="success"){const n={success:"bg-accent-green text-white",error:"bg-red-500 text-white",info:"bg-primary text-white"},o={success:"check_circle",error:"error",info:"info"},s=document.createElement("div");s.className=`flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg text-sm font-semibold pointer-events-auto ${n[t]||n.info} opacity-0 translate-y-[-8px] transition-all duration-300`,s.innerHTML=`<span class="material-symbols-outlined text-lg">${o[t]||o.info}</span>${S(e)}`,ne.appendChild(s),requestAnimationFrame(()=>{s.classList.remove("opacity-0","translate-y-[-8px]")}),setTimeout(()=>{s.classList.add("opacity-0","translate-y-[-8px]"),setTimeout(()=>s.remove(),300)},3e3)}function ge(e){var n;document.querySelectorAll(".page").forEach(o=>o.classList.remove("active")),(n=document.getElementById(`page-${e}`))==null||n.classList.add("active"),document.querySelectorAll(".nav-tab").forEach(o=>{const s=o.dataset.page===e;o.className=`nav-tab flex flex-col items-center gap-1 ${s?"text-primary":"text-slate-400"}`;const a=o.querySelector(".material-symbols-outlined");a&&(a.style.fontVariationSettings=s?"'FILL' 1":"'FILL' 0")});const t=document.getElementById("datePreset");t&&(t.style.display=e==="pricing-dashboard"||e==="management-dashboard"?"":"none"),e==="pricing-dashboard"&&V&&he(V),e==="management-dashboard"&&Z&&ve(Z)}document.querySelectorAll(".nav-tab").forEach(e=>{e.addEventListener("click",t=>{t.preventDefault(),ge(e.dataset.page)})});function q(e){let t=0;for(let n=0;n<e.length;n++)t=e.charCodeAt(n)+((t<<5)-t);return ae[Math.abs(t)%ae.length]}function se(e,t){return(((e==null?void 0:e[0])||"")+((t==null?void 0:t[0])||"")).toUpperCase()}function X(e){if(e=Math.round(e),e<60)return`${e}m`;const t=Math.floor(e/60),n=e%60;return t<24?`${t}h ${n}m`:`${Math.floor(t/24)}d ${t%24}h`}function S(e){return(e||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;")}function $e(e){document.getElementById("kpi-open").textContent=e.total_open.toLocaleString(),document.getElementById("kpi-waiting").textContent=e.total_waiting.toLocaleString(),document.getElementById("kpi-resolved").textContent=e.total_resolved.toLocaleString(),document.getElementById("kpi-archived").textContent=e.total_archived.toLocaleString()}function Le(e){const t=document.getElementById("donutGrid");t.innerHTML="";const n=[{key:"IMPORT",label:"Import"},{key:"EXPORT",label:"Export"},{key:"DOMESTIC",label:"Domestic"},{key:"CROSSTRADE",label:"Cross-Trade"}];for(const o of n){const s=e[o.key]||{total:0,breakdowns:[]},a=s.breakdowns.filter(i=>i.count>0),d=a.reduce((i,p)=>i+p.count,0)||0;let u='<circle class="stroke-slate-100" cx="18" cy="18" fill="none" r="16" stroke-width="4"></circle>',m=0;a.forEach((i,p)=>{const g=i.count/d*100,h=oe[i.label]||F[p%F.length];u+=`<circle cx="18" cy="18" fill="none" r="16" stroke="${h}" stroke-width="4" stroke-dasharray="${g} ${100-g}" stroke-dashoffset="${-m}"></circle>`,m+=g});const v=a.map((i,p)=>`<span class="inline-flex items-center gap-1 text-[9px] text-slate-500"><span class="size-1.5 rounded-full inline-block" style="background:${oe[i.label]||F[p%F.length]}"></span>${i.label}: ${i.count}</span>`).join(" ");t.innerHTML+=`
      <div class="bg-white dark:bg-background-dark/50 p-4 rounded-xl shadow-sm border border-primary/5 flex flex-col items-center">
        <div class="relative size-20 mb-2">
          <svg class="size-full rotate-[-90deg]" viewBox="0 0 36 36">${u}</svg>
          <div class="absolute inset-0 flex items-center justify-center text-sm font-extrabold text-slate-700">${s.total}</div>
        </div>
        <span class="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">${o.label}</span>
        <div class="flex flex-wrap justify-center gap-x-2 gap-y-0.5">${v}</div>
      </div>`}}function he(e){V=e;const t=document.getElementById("trendChart"),n=document.getElementById("trendTooltip");if(t.innerHTML="",!e||!e.length){t.innerHTML='<text x="50%" y="50%" text-anchor="middle" fill="#9CA3AF" font-size="12">No data</text>';return}const o=t.getBoundingClientRect().width||600,s=200;t.setAttribute("viewBox",`0 0 ${o} ${s}`);const a={t:16,r:16,b:32,l:40},d=o-a.l-a.r,u=s-a.t-a.b,m=Math.max(...e.map(r=>Math.max(r.conversations,r.replies)),1),v=e.length>1?d/(e.length-1):d/2,i=r=>a.l+r*v,p=r=>a.t+u-r/m*u,g="http://www.w3.org/2000/svg";for(let r=0;r<=4;r++){const b=a.t+u/4*r,l=document.createElementNS(g,"line");Object.entries({x1:a.l,x2:o-a.r,y1:b,y2:b,stroke:"#F3F4F6","stroke-width":1}).forEach(([x,L])=>l.setAttribute(x,L)),t.appendChild(l);const c=document.createElementNS(g,"text");c.setAttribute("x",a.l-6),c.setAttribute("y",b+3),c.setAttribute("text-anchor","end"),c.setAttribute("fill","#9CA3AF"),c.setAttribute("font-size","9"),c.textContent=Math.round(m-m/4*r),t.appendChild(c)}const h=Math.max(1,Math.floor(e.length/7));e.forEach((r,b)=>{if(b%h!==0&&b!==e.length-1)return;const l=document.createElementNS(g,"text");l.setAttribute("x",i(b)),l.setAttribute("y",s-6),l.setAttribute("text-anchor","middle"),l.setAttribute("fill","#9CA3AF"),l.setAttribute("font-size","9");const c=new Date(r.day+"T00:00:00");l.textContent=c.toLocaleDateString("en-US",{month:"short",day:"numeric"}),t.appendChild(l)});function y(r,b,l){let c=`M ${i(0)} ${p(e[0][r])}`;for(let f=1;f<e.length;f++)c+=` L ${i(f)} ${p(e[f][r])}`;c+=` L ${i(e.length-1)} ${a.t+u} L ${i(0)} ${a.t+u} Z`;const x=document.createElementNS(g,"path");x.setAttribute("d",c),x.setAttribute("fill",l),t.appendChild(x);let L=`M ${i(0)} ${p(e[0][r])}`;for(let f=1;f<e.length;f++)L+=` L ${i(f)} ${p(e[f][r])}`;const w=document.createElementNS(g,"path");w.setAttribute("d",L),w.setAttribute("fill","none"),w.setAttribute("stroke",b),w.setAttribute("stroke-width","2"),t.appendChild(w),e.forEach((f,E)=>{const $=document.createElementNS(g,"circle");$.setAttribute("cx",i(E)),$.setAttribute("cy",p(f[r])),$.setAttribute("r","3"),$.setAttribute("fill",b),$.setAttribute("stroke","#fff"),$.setAttribute("stroke-width","1.5"),t.appendChild($)})}y("conversations","#5B86AD","rgba(91,134,173,0.08)"),y("replies","#FF4081","rgba(255,64,129,0.08)"),e.forEach((r,b)=>{const l=document.createElementNS(g,"rect");l.setAttribute("x",i(b)-v/2),l.setAttribute("y",a.t),l.setAttribute("width",v),l.setAttribute("height",u),l.setAttribute("fill","transparent"),l.addEventListener("mouseenter",()=>{n.classList.remove("hidden");const c=new Date(r.day+"T00:00:00");n.innerHTML=`<strong>${c.toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"})}</strong><br>Conversations: ${r.conversations}<br>Replies: ${r.replies}`}),l.addEventListener("mousemove",c=>{const x=t.closest(".relative").getBoundingClientRect();n.style.left=c.clientX-x.left+12+"px",n.style.top=c.clientY-x.top-40+"px"}),l.addEventListener("mouseleave",()=>n.classList.add("hidden")),t.appendChild(l)})}function ke(e){const t=document.getElementById("topAccounts");if(!e||!e.length){t.innerHTML='<div class="text-xs text-slate-400 text-center py-4">No account data</div>';return}const n=Math.max(...e.map(o=>o.total),1);t.innerHTML=e.map(o=>{const s=["open","waiting","resolved","archived"].filter(a=>o[a]>0).map(a=>`<div class="h-full ${re[a].bg} rounded" style="width:${o[a]/n*100}%" title="${re[a].label}: ${o[a]}"></div>`).join("");return`<div class="space-y-1.5">
      <div class="flex justify-between text-xs font-bold text-slate-600"><span>${S(o.account_name)}</span><span>${o.total} requests</span></div>
      <div class="h-2 w-full bg-slate-100 rounded-full overflow-hidden flex">${s}</div>
    </div>`}).join("")}let V=null,Z=null,N=[],M="assigned_conversations",_=!1;function Ee(){const e=[...N];return e.sort((t,n)=>{let o=t[M],s=n[M];return M==="name"?(o=(o||"").toLowerCase(),s=(s||"").toLowerCase(),_?o.localeCompare(s):s.localeCompare(o)):_?o-s:s-o}),e}function Ae(){document.querySelectorAll("th[data-sort]").forEach(e=>{const t=e.querySelector(".sort-arrow");e.dataset.sort===M?t.textContent=_?"↑":"↓":t.textContent=""})}function be(e){e&&(N=e);const t=document.getElementById("teamBody");if(!N||!N.length){t.innerHTML='<tr><td colspan="7" class="px-4 py-6 text-center text-xs text-slate-400">No data</td></tr>';return}const n=Ee();Ae(),t.innerHTML=n.map(o=>{const s=se(o.first_name,o.last_name);return`<tr>
      <td class="px-4 py-3"><div class="flex items-center gap-2 whitespace-nowrap">
        <div class="size-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white" style="background:${q(o.name)}">${s}</div>
        <span class="text-xs font-semibold text-slate-700">${S(o.name)}</span>
      </div></td>
      <td class="px-3 py-3 text-center text-xs font-medium text-slate-600">${o.assigned_conversations}</td>
      <td class="px-3 py-3 text-center text-xs font-medium text-slate-600">${o.touched_conversations}</td>
      <td class="px-3 py-3 text-center text-xs font-medium text-slate-600">${o.messages_sent}</td>
      <td class="px-3 py-3 text-center text-xs font-medium text-slate-600">${o.replies_sent}</td>
      <td class="px-3 py-3 text-center text-xs font-medium text-slate-600 whitespace-nowrap">${X(o.avg_reply_minutes)}</td>
      <td class="px-3 py-3 text-center text-xs font-medium text-slate-600 whitespace-nowrap">${X(o.avg_first_reply_minutes)}</td>
    </tr>`}).join("")}function Se(e){const t=document.getElementById("pendingBody");if(!e||!e.length){t.innerHTML='<tr><td colspan="4" class="px-4 py-6 text-center text-xs text-slate-400">No pending replies</td></tr>';return}t.innerHTML=e.map(n=>{const o=se(n.first_name,n.last_name),s=q(n.teammate),a=n.age_hours<24?`${n.age_hours}h`:`${Math.floor(n.age_hours/24)}d ${n.age_hours%24}h`,d=n.age_hours>48?"text-red-500":n.age_hours>12?"text-amber-600":"text-slate-400",u=`${xe}${n.conversation_id}`;return`<tr>
      <td class="px-4 py-3"><div class="flex items-center gap-2">
        <div class="size-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white" style="background:${s}">${o}</div>
        <span class="text-xs font-semibold text-slate-700">${S(n.teammate)}</span>
      </div></td>
      <td class="px-4 py-3 text-xs font-bold ${d}">${a}</td>
      <td class="px-4 py-3 text-xs text-slate-500 truncate max-w-[200px]" title="${S(n.subject)}">${S(n.subject)}</td>
      <td class="px-4 py-3">
        <a href="${u}" target="_blank" rel="noopener noreferrer"
           class="inline-flex items-center gap-1 text-[10px] font-mono text-primary hover:text-accent-green transition-colors"
           title="Open in Front">
          ${n.conversation_id}
          <span class="material-symbols-outlined text-[14px]">open_in_new</span>
        </a>
      </td>
    </tr>`}).join("")}function Be(e){const t=document.getElementById("teamDirectory");if(!e||!e.length){t.innerHTML='<div class="p-6 text-center text-xs text-slate-400">No team data</div>';return}t.innerHTML=e.map(n=>{const o=se(n.first_name,n.last_name);return`<div class="p-4 flex items-center justify-between">
      <div class="flex items-center gap-3">
        <div class="h-12 w-12 rounded-full flex items-center justify-center text-sm font-bold text-white border border-slate-200 dark:border-slate-700" style="background:${q(n.name)}">${o}</div>
        <div>
          <p class="font-bold text-slate-900 dark:text-slate-100">${S(n.name)}</p>
          <p class="text-xs text-slate-500">${n.assigned_conversations} assigned · ${n.messages_sent} messages</p>
        </div>
      </div>
      <div class="flex flex-col items-end gap-1.5">
        <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
          <span class="w-1.5 h-1.5 rounded-full bg-green-500"></span>Active
        </span>
        <button class="text-[10px] font-bold text-primary hover:underline edit-schedule-btn" data-id="${n.teammate_id}" data-name="${S(n.first_name)}">Edit Schedule</button>
        <p class="text-[10px] text-slate-400 mt-1 font-medium">Avg reply: ${X(n.avg_reply_minutes)}</p>
      </div>
    </div>`}).join("")}function Te(e){const t=document.getElementById("mgmtKpiCards");if(!e||!e.current)return;const n=e.current,o=e.previous||{},s=e.status_breakdown||[],a=e.daily||[],d=l=>Number(l).toLocaleString();function u(l,c,x=!1){if(!c||c===0)return'<span class="text-[10px] text-slate-300 font-medium">—</span>';const L=(l-c)/c*100,w=L>=0,f=x?!w:w;return`<span class="${f?"text-[#73be4b]":"text-red-400"} text-[10px] font-bold bg-${f?"[#73be4b]":"red-400"}/10 px-1.5 py-0.5 rounded">${w?"↑":"↓"} ${Math.abs(L).toFixed(1)}%</span>`}function m(l,c){if(c==null)return'<span class="text-[10px] text-slate-300 font-medium">—</span>';const x=l-c,L=x>=0?"text-[#73be4b]":"text-red-400",w=x>=0?"↑":"↓";return`<span class="${L} text-[10px] font-bold">${w} ${Math.abs(x).toFixed(1)}pp</span>`}function v(l,c){if(a.length<2)return"";const x=a.map(A=>Number(A[l])),L=Math.max(...x,1),w=80,f=34,E=A=>A/(x.length-1)*(w-4)+2,$=A=>f-3-A/L*(f-8),R=x.map((A,K)=>`${E(K)},${$(A)}`).join(" L "),Y=x[x.length-1];return`<svg width="${w}" height="${f}" viewBox="0 0 ${w} ${f}" class="overflow-visible flex-shrink-0">
      <defs><linearGradient id="sg-${l}" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="${c}" stop-opacity="0.25"/>
        <stop offset="100%" stop-color="${c}" stop-opacity="0"/>
      </linearGradient></defs>
      <path d="M ${R} L ${E(x.length-1)},${f} L ${E(0)},${f} Z" fill="url(#sg-${l})"/>
      <polyline points="${x.map((A,K)=>`${E(K)},${$(A)}`).join(" ")}" fill="none" stroke="${c}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
      <circle cx="${E(x.length-1)}" cy="${$(Y)}" r="2.5" fill="${c}" stroke="#fff" stroke-width="1.5"/>
    </svg>`}function i(l){const R=Math.PI*22,Y=Math.min(l/100,1)*R;return`<svg width="54" height="30" viewBox="0 0 54 30" class="overflow-visible flex-shrink-0">
      <path d="M 5,30 A 22,22 0 0,0 49,30" fill="none" stroke="#E2E8F0" stroke-width="5" stroke-linecap="round"/>
      <path d="M 5,30 A 22,22 0 0,0 49,30" fill="none" stroke="${l>=60?"#73be4b":l>=35?"#f59e0b":"#f87171"}" stroke-width="5" stroke-linecap="round"
        stroke-dasharray="${Y.toFixed(1)} ${(R+1).toFixed(1)}"/>
    </svg>`}const p={Contacted:"#5B86AD","Need to Quote":"#f59e0b",Quoted:"#73be4b","Need to Requote":"#f97316","Need to Onboard":"#8b5cf6","Pending Review":"#ec4899"},g=s.reduce((l,c)=>l+c.count,0)||1,h=s.length?`
    <div class="flex w-full h-2 rounded-full overflow-hidden gap-px mt-3 mb-2.5">
      ${s.map(l=>`<div style="width:${(l.count/g*100).toFixed(1)}%;background:${p[l.status]||"#9CA3AF"}" title="${l.status}: ${d(l.count)}"></div>`).join("")}
    </div>
    <div class="flex flex-wrap gap-x-3 gap-y-1.5">
      ${s.map(l=>`
        <div class="flex items-center gap-1">
          <div class="size-2 rounded-sm flex-shrink-0" style="background:${p[l.status]||"#9CA3AF"}"></div>
          <span class="text-[9px] text-slate-500">${l.status}</span>
          <span class="text-[9px] font-bold text-slate-600 dark:text-slate-300">${d(l.count)}</span>
        </div>`).join("")}
    </div>`:"",y=n.won_conversations+n.lost_conversations,r=y>0?(n.won_conversations/y*100).toFixed(1):"0.0",b=y>0?(n.lost_conversations/y*100).toFixed(1):"0.0";t.innerHTML=`
    <!-- Total Conversations -->
    <div class="bg-white dark:bg-background-dark/50 p-4 rounded-xl shadow-sm border border-primary/5">
      <div class="flex items-center justify-between mb-1">
        <p class="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Total Conversations</p>
        ${u(n.total_conversations,o.total_conversations)}
      </div>
      <div class="flex items-end justify-between">
        <p class="text-3xl font-bold text-primary leading-none">${d(n.total_conversations)}</p>
        ${v("total","#5B86AD")}
      </div>
      ${h}
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
        ${v("won","#73be4b")}
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
        ${v("lost","#f87171")}
      </div>
      <div class="mt-2.5 flex items-center gap-2">
        <div class="flex-1 h-1.5 rounded-full bg-slate-100 overflow-hidden">
          <div class="h-full rounded-full bg-red-400" style="width:${b}%"></div>
        </div>
        <span class="text-[10px] font-bold text-red-400 flex-shrink-0">${b}% of closed</span>
      </div>
      ${o.lost_conversations!=null?`<p class="text-[9px] text-slate-400 mt-1.5">prev period: ${d(o.lost_conversations)}</p>`:""}
    </div>

    <!-- Win Rate -->
    <div class="bg-white dark:bg-background-dark/50 p-4 rounded-xl shadow-sm border border-primary/5">
      <div class="flex items-center justify-between mb-1">
        <p class="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Win Rate</p>
        ${m(n.win_rate,o.win_rate)}
      </div>
      <div class="flex items-end justify-between">
        <p class="text-3xl font-bold text-primary leading-none">${n.win_rate.toFixed(2)}%</p>
        ${i(n.win_rate)}
      </div>
      <p class="text-[9px] text-slate-400 mt-2.5">${y.toLocaleString()} closed deals (${d(n.won_conversations)} won · ${d(n.lost_conversations)} lost)</p>
      ${o.win_rate!=null?`<p class="text-[9px] text-slate-400 mt-0.5">prev period: ${o.win_rate.toFixed(1)}%</p>`:""}
    </div>`}function ve(e){Z=e;const t=document.getElementById("winRateChart"),n=document.getElementById("winRateTooltip");if(t.innerHTML="",!e||!e.length){t.innerHTML='<text x="50%" y="50%" text-anchor="middle" fill="#9CA3AF" font-size="12">No data</text>';return}const o=t.getBoundingClientRect().width||600,s=200;t.setAttribute("viewBox",`0 0 ${o} ${s}`);const a={t:16,r:16,b:32,l:40},d=o-a.l-a.r,u=s-a.t-a.b,m=Math.max(...e.map(r=>Math.max(r.won,r.lost)),1),v=e.length>1?d/(e.length-1):d/2,i=r=>a.l+r*v,p=r=>a.t+u-r/m*u,g="http://www.w3.org/2000/svg";for(let r=0;r<=4;r++){const b=a.t+u/4*r,l=document.createElementNS(g,"line");Object.entries({x1:a.l,x2:o-a.r,y1:b,y2:b,stroke:"#F3F4F6","stroke-width":1}).forEach(([x,L])=>l.setAttribute(x,L)),t.appendChild(l);const c=document.createElementNS(g,"text");c.setAttribute("x",a.l-6),c.setAttribute("y",b+3),c.setAttribute("text-anchor","end"),c.setAttribute("fill","#9CA3AF"),c.setAttribute("font-size","9"),c.textContent=Math.round(m-m/4*r),t.appendChild(c)}const h=Math.max(1,Math.floor(e.length/7));e.forEach((r,b)=>{if(b%h!==0&&b!==e.length-1)return;const l=document.createElementNS(g,"text");l.setAttribute("x",i(b)),l.setAttribute("y",s-6),l.setAttribute("text-anchor","middle"),l.setAttribute("fill","#9CA3AF"),l.setAttribute("font-size","9");const c=new Date(r.day+"T00:00:00");l.textContent=c.toLocaleDateString("en-US",{month:"short",day:"numeric"}),t.appendChild(l)});function y(r,b,l){let c=`M ${i(0)} ${p(e[0][r])}`;for(let f=1;f<e.length;f++)c+=` L ${i(f)} ${p(e[f][r])}`;c+=` L ${i(e.length-1)} ${a.t+u} L ${i(0)} ${a.t+u} Z`;const x=document.createElementNS(g,"path");x.setAttribute("d",c),x.setAttribute("fill",l),t.appendChild(x);let L=`M ${i(0)} ${p(e[0][r])}`;for(let f=1;f<e.length;f++)L+=` L ${i(f)} ${p(e[f][r])}`;const w=document.createElementNS(g,"path");w.setAttribute("d",L),w.setAttribute("fill","none"),w.setAttribute("stroke",b),w.setAttribute("stroke-width","2"),t.appendChild(w),e.forEach((f,E)=>{const $=document.createElementNS(g,"circle");$.setAttribute("cx",i(E)),$.setAttribute("cy",p(f[r])),$.setAttribute("r","3"),$.setAttribute("fill",b),$.setAttribute("stroke","#fff"),$.setAttribute("stroke-width","1.5"),t.appendChild($)})}y("won","#73be4b","rgba(115,190,75,0.08)"),y("lost","#f87171","rgba(248,113,113,0.08)"),e.forEach((r,b)=>{const l=document.createElementNS(g,"rect");l.setAttribute("x",i(b)-v/2),l.setAttribute("y",a.t),l.setAttribute("width",v),l.setAttribute("height",u),l.setAttribute("fill","transparent");const c=r.won+r.lost>0?(r.won/(r.won+r.lost)*100).toFixed(1):"—";l.addEventListener("mouseenter",()=>{n.classList.remove("hidden");const x=new Date(r.day+"T00:00:00");n.innerHTML=`<strong>${x.toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"})}</strong><br>Won: ${r.won} &nbsp; Lost: ${r.lost} &nbsp; Total: ${r.total}<br>Win Rate: ${c}%`}),l.addEventListener("mousemove",x=>{const L=t.closest(".relative").getBoundingClientRect();n.style.left=x.clientX-L.left+12+"px",n.style.top=x.clientY-L.top-40+"px"}),l.addEventListener("mouseleave",()=>n.classList.add("hidden")),t.appendChild(l)})}function Ce(e){const t=document.getElementById("freightBreakdown");if(!e||!e.directions){t.innerHTML='<div class="text-xs text-slate-400 text-center py-4">No data</div>';return}const{grand_total:n,no_direction_total:o,directions:s}=e,a=i=>Number(i).toLocaleString(),d=(i,p)=>p>0?(i/p*100).toFixed(1):"0.0",u=s.map(i=>{const p=d(i.total,n),g=d(i.won,i.won+i.lost),h=d(i.lost,i.won+i.lost);return`
      <div class="bg-slate-50 dark:bg-slate-800/60 rounded-lg p-3 flex flex-col gap-1 min-w-0">
        <div class="text-[10px] font-bold text-slate-500 uppercase tracking-wide truncate">${i.label}</div>
        <div class="text-xl font-extrabold text-primary leading-none">${a(i.total)}</div>
        <div class="text-[10px] text-slate-400">${p}% of total</div>
        <div class="flex items-center gap-2 mt-1">
          <span class="text-xs font-bold text-[#73be4b]">${a(i.won)} Won</span>
          <span class="text-[10px] text-slate-300">|</span>
          <span class="text-xs font-bold text-red-400">${a(i.lost)} Lost</span>
        </div>
        <div class="flex items-center gap-2">
          <span class="text-[10px] font-semibold text-[#73be4b]">${g}% win</span>
          <span class="text-[10px] text-slate-300">|</span>
          <span class="text-[10px] font-semibold text-red-400">${h}% loss</span>
        </div>
      </div>`}).join(""),m=s.flatMap(i=>i.modes.map(p=>{const g=d(p.total,i.total),h=d(p.won,p.won+p.lost);return`<tr class="border-t border-slate-100 dark:border-slate-700/50">
        <td class="py-1.5 px-2 text-[11px] text-slate-500">${i.label}</td>
        <td class="py-1.5 px-2 text-[11px] font-semibold text-slate-700 dark:text-slate-300">${p.label}</td>
        <td class="py-1.5 px-2 text-[11px] text-right text-slate-700 dark:text-slate-300">${a(p.total)}</td>
        <td class="py-1.5 px-2 text-[11px] text-right text-slate-400">${g}%</td>
        <td class="py-1.5 px-2 text-[11px] text-right text-[#73be4b] font-semibold">${a(p.won)}</td>
        <td class="py-1.5 px-2 text-[11px] text-right text-red-400 font-semibold">${a(p.lost)}</td>
        <td class="py-1.5 px-2 text-[11px] text-right font-bold text-slate-700 dark:text-slate-300">${h}%</td>
      </tr>`})).join(""),v=o>0?`<div class="mt-3 text-[10px] text-slate-400 italic">
        * ${a(o)} QRN(s) have no direction recorded and are excluded from the totals above.
        Grand total including unclassified: ${a(n+o)}.
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
        <tbody>${m||'<tr><td colspan="7" class="py-3 text-center text-xs text-slate-400">No mode data</td></tr>'}</tbody>
      </table>
    </div>
    ${v}`}const U=document.getElementById("scheduleModal");document.addEventListener("click",e=>{const t=e.target.closest(".edit-schedule-btn");t&&Me(t.dataset.id,t.dataset.name)});function Me(e,t){const n=ee[e]||{timezone:"America/Los_Angeles",workDays:[1,2,3,4,5],startHour:"08:00",endHour:"17:00"};document.getElementById("scheduleModalTitle").textContent=`Shift Schedule: ${t}`,document.getElementById("scheduleTeammateId").value=e,document.getElementById("scheduleTimezone").value=n.timezone||"America/Los_Angeles";const o=["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"],s=document.getElementById("workingDaysContainer");let a=o.map((d,u)=>{const m=(n.workDays||[]).includes(u);return`
      <label class="flex items-center gap-3 cursor-pointer p-2 rounded hover:bg-slate-50 dark:hover:bg-slate-800">
        <input type="checkbox" class="schedule-day-cb rounded border-slate-300 text-primary focus:ring-primary w-4 h-4" value="${u}" ${m?"checked":""} />
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
  `,s.innerHTML=a,U.classList.remove("hidden"),U.classList.add("flex")}document.getElementById("closeScheduleModal")&&(document.getElementById("closeScheduleModal").addEventListener("click",()=>{U.classList.add("hidden"),U.classList.remove("flex")}),document.getElementById("cancelScheduleBtn").addEventListener("click",()=>{document.getElementById("closeScheduleModal").click()}),document.getElementById("saveScheduleBtn").addEventListener("click",async()=>{const e=document.getElementById("saveScheduleBtn"),t=document.getElementById("scheduleTeammateId").value,n=document.getElementById("scheduleTimezone").value,o=document.getElementById("scheduleStartTime").value,s=document.getElementById("scheduleEndTime").value,a=document.querySelectorAll(".schedule-day-cb:checked"),d=Array.from(a).map(m=>Number(m.value)),u={timezone:n,workDays:d,startHour:o,endHour:s};e.disabled=!0,e.innerHTML='<div class="size-4 border-2 border-primary/20 border-t-primary rounded-full animate-spin"></div> Saving...';try{const m=await k("/api/team-schedules",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({teammate_id:t,schedule:u})});m.success?(ee[t]=u,document.getElementById("closeScheduleModal").click(),G("Schedule saved successfully"),P()):G(m.error||"Failed to save schedule","error")}catch(m){console.error("Save schedule error:",m);const v=m.message.startsWith("503")?"Firestore not configured on server":"Failed to save schedule: "+m.message;G(v,"error")}finally{e.disabled=!1,e.innerHTML="Save Changes"}}));document.querySelectorAll(".dl-btn").forEach(e=>{e.addEventListener("click",async()=>{const t=e.dataset.type,n={};B&&(n.Authorization=`Bearer ${B}`);try{if(t==="management-freight-breakdown"){const m=await k(`/api/management-freight-breakdown?${j()}`),v=[["Direction","Mode","Total","% of Direction","Won","Lost","Win %"]],i=(y,r)=>r>0?(y/r*100).toFixed(2):"0.00";for(const y of m.directions||[])for(const r of y.modes||[])v.push([y.label,r.label,r.total,i(r.total,y.total),r.won,r.lost,i(r.won,r.won+r.lost)]);const p=v.map(y=>y.map(r=>`"${String(r).replace(/"/g,'""')}"`).join(",")).join(`
`),g=new Blob([p],{type:"text/csv;charset=utf-8;"}),h=document.createElement("a");h.href=URL.createObjectURL(g),h.download="management-freight-breakdown.csv",h.click(),URL.revokeObjectURL(h.href);return}if(t==="management-win-rate"){const m=await k(`/api/management-win-rate?${j()}`),v=[["Date","Won","Lost","Total","Win Rate (%)"]];for(const h of m){const y=h.won+h.lost>0?(h.won/(h.won+h.lost)*100).toFixed(2):"0.00";v.push([h.day,h.won,h.lost,h.total,y])}const i=v.map(h=>h.map(y=>`"${String(y).replace(/"/g,'""')}"`).join(",")).join(`
`),p=new Blob([i],{type:"text/csv;charset=utf-8;"}),g=document.createElement("a");g.href=URL.createObjectURL(p),g.download="management-win-rate.csv",g.click(),URL.revokeObjectURL(g.href);return}const o=t!=="pending-replies";let s=`${te}/api/download-conversations?type=${t}`;o&&(s+=`&${j()}`);const a=await fetch(s,{headers:n});if(!a.ok)throw new Error(a.status);const d=await a.blob(),u=document.createElement("a");u.href=URL.createObjectURL(d),u.download=e.dataset.filename||`${t}.csv`,u.click(),URL.revokeObjectURL(u.href)}catch(o){console.error("Download error:",o)}})});const Q=document.getElementById("datePreset"),le=document.getElementById("customRange");Q.addEventListener("change",()=>{if(Q.value==="custom"){le.classList.remove("hidden");return}le.classList.add("hidden"),H=fe(Q.value),P()});document.getElementById("applyCustom").addEventListener("click",()=>{const e=document.getElementById("customStart").value,t=document.getElementById("customEnd").value;e&&t&&(H={start:new Date(e+"T00:00:00"),end:new Date(t+"T23:59:59.999")},P())});document.querySelectorAll("th[data-sort]").forEach(e=>{e.addEventListener("click",()=>{const t=e.dataset.sort;M===t?_=!_:(M=t,_=t==="name"),be()})});var ue;(ue=document.getElementById("themeLight"))==null||ue.addEventListener("click",()=>{document.documentElement.classList.remove("dark")});var pe;(pe=document.getElementById("themeDark"))==null||pe.addEventListener("click",()=>{document.documentElement.classList.add("dark")});async function P(){ye();const e=j();try{const[t,n,o,s,a,d,u,m,v]=await Promise.all([k(`/api/dashboard-stats?${e}`),k(`/api/conversation-trend?${e}`),k(`/api/team-performance?${e}`),k("/api/zero-replies-conversations"),k(`/api/top-accounts?${e}`),k("/api/team-schedules"),k(`/api/management-kpis?${e}`),k(`/api/management-win-rate?${e}`),k(`/api/management-freight-breakdown?${e}`).catch(()=>null)]);ee=d||{},$e(t),Le(t.quotes),he(n),be(o),Se(s),ke(a),Be(o),Te(u),ve(m),Ce(v)}catch(t){console.error("Load error:",t)}finally{we()}}const z=document.getElementById("searchModal"),W=document.getElementById("searchInput"),D=document.getElementById("searchResults");let ie=null;document.getElementById("searchToggle").addEventListener("click",()=>{z.classList.remove("hidden"),z.classList.add("flex"),W.value="",W.focus(),D.innerHTML='<div class="text-center text-sm text-slate-400 py-12">Type a keyword to search across conversations, messages, quotes, and QRN.</div>'});document.getElementById("searchBack").addEventListener("click",()=>{z.classList.add("hidden"),z.classList.remove("flex")});W.addEventListener("input",()=>{clearTimeout(ie);const e=W.value.trim();if(e.length<2){D.innerHTML='<div class="text-center text-sm text-slate-400 py-12">Type at least 2 characters to search.</div>';return}D.innerHTML='<div class="flex justify-center py-12"><div class="size-6 border-2 border-primary/20 border-t-primary rounded-full animate-spin"></div></div>',ie=setTimeout(()=>_e(e),400)});async function _e(e){try{const t=await k(`/api/search?q=${encodeURIComponent(e)}`);if(!t.length){D.innerHTML='<div class="text-center text-sm text-slate-400 py-12">No results found.</div>';return}const n={subject:"Subject",message:"Message",quote:"Quote",qrn:"QRN"},o={subject:"bg-primary/10 text-primary",message:"bg-amber-100 text-amber-700",quote:"bg-green-100 text-green-700",qrn:"bg-violet-100 text-violet-700"};D.innerHTML=`<p class="text-xs text-slate-400 mb-2">${t.length} result${t.length>1?"s":""}</p>`+t.map(s=>{const a=`${xe}${s.conversation_id}`,d=s.sources.map(m=>`<span class="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${o[m]||"bg-slate-100 text-slate-500"}">${n[m]||m}</span>`).join(" "),u=S(s.snippet).replace(new RegExp(`(${e.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")})`,"gi"),'<mark class="bg-yellow-200 rounded px-0.5">$1</mark>');return`<a href="${a}" target="_blank" rel="noopener noreferrer" class="block bg-white rounded-xl border border-slate-100 p-4 hover:border-primary/30 hover:shadow-sm transition-all group">
          <div class="flex items-start justify-between gap-2 mb-1.5">
            <p class="text-sm font-semibold text-slate-800 group-hover:text-primary line-clamp-1">${S(s.subject)}</p>
            <span class="material-symbols-outlined text-slate-300 group-hover:text-primary text-base shrink-0">open_in_new</span>
          </div>
          <p class="text-xs text-slate-500 line-clamp-2 mb-2">${u}</p>
          <div class="flex items-center gap-1.5">${d}</div>
        </a>`}).join("")}catch(t){console.error("Search error:",t),D.innerHTML='<div class="text-center text-sm text-red-500 py-12">Search failed. Please try again.</div>'}}const ce=document.getElementById("loginOverlay"),C=document.getElementById("loginError"),J=document.getElementById("loginSpinner");function de(e){const t=document.getElementById("authBtn");if(e){if(e.photoURL)t.innerHTML=`<img src="${e.photoURL}" alt="" class="size-10 rounded-full object-cover" referrerpolicy="no-referrer" />`;else{const a=(e.displayName||e.email||"?").split(" ").map(u=>u[0]).join("").substring(0,2).toUpperCase(),d=q(e.displayName||e.email);t.innerHTML=`<span class="size-10 rounded-full flex items-center justify-center text-xs font-bold text-white" style="background:${d}">${a}</span>`}t.title=`Signed in as ${e.email}`;const n=document.getElementById("settingsName"),o=document.getElementById("settingsEmail"),s=document.getElementById("settingsAvatar");n&&(n.textContent=e.displayName||e.email),o&&(o.textContent=e.email),s&&e.photoURL&&(s.innerHTML=`<img src="${e.photoURL}" alt="" class="size-12 rounded-full object-cover" referrerpolicy="no-referrer" />`)}else t.innerHTML='<span class="material-symbols-outlined">login</span>',t.title="Sign in"}fetch(te+"/api/dashboard-stats").catch(()=>{});document.getElementById("googleSignInBtn").addEventListener("click",async()=>{C.classList.add("hidden"),J.classList.remove("hidden");try{await O.signInWithPopup(me)}catch(e){J.classList.add("hidden"),C.textContent=e.code==="auth/popup-closed-by-user"?"":e.message||"Sign-in failed",C.classList.toggle("hidden",!C.textContent)}});document.getElementById("authBtn").addEventListener("click",async()=>{I&&(await O.signOut(),window.location.reload())});O.onAuthStateChanged(async e=>{if(e){if(!e.email.endsWith("@freightright.com")){await O.signOut(),J.classList.add("hidden"),C.textContent="Access restricted to @freightright.com accounts.",C.classList.remove("hidden");return}I=e,B=await e.getIdToken(),de(e),ce.style.display="none",ge("pricing-dashboard"),P()}else I=null,B=null,de(null),ce.style.display="flex"});
