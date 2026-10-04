import CONFIG from "./firebase-config.js";

const DEMO = !CONFIG || !CONFIG.apiKey || CONFIG.apiKey.startsWith("PEGA");
const be = DEMO ? (await import("./backend-demo.js")).default
                : (await import("./backend-firebase.js")).makeBackend(CONFIG);

/* ---------- constants ---------- */
const DAYS = ["Lun","Mar","Mié","Jue","Vie","Sáb","Dom"];
const DAYS_L = ["Lunes","Martes","Miércoles","Jueves","Viernes","Sábado","Domingo"];
const SECTIONS = [
  {id:"panda",name:"Panda",sub:"Grupo de iniciados",groups:[{id:"ini",name:"Iniciados"}]},
  {id:"koi",name:"Dragón",sub:"Alumnos antiguos · grupo avanzado",groups:[{id:"av",name:"Avanzados"}]},
  {id:"bonsai",name:"Tora",sub:"Equipo con dos grupos",groups:[{id:"av",name:"Avanzados"},{id:"ini",name:"Iniciados (nuevos)"}]}
];
const TIERS = [
  {id:"2",label:"2 h",min:2,max:2},
  {id:"34",label:"3–4 h",min:3,max:4},
  {id:"56",label:"5–6 h",min:5,max:6},
  {id:"78",label:"7–8 h",min:7,max:8}
];
const KINDS = [
  {id:"materia",name:"Materia",c:"var(--panda)"},
  {id:"repaso",name:"Repaso",c:"var(--bonsai)"},
  {id:"test",name:"Test",c:"var(--warn)"},
  {id:"examen",name:"Examen / simulacro",c:"var(--seal)"},
  {id:"otro",name:"Otro",c:"var(--muted)"}
];
const SCORED = new Set(["test","examen"]);
const kindOf = s => KINDS.find(k => k.id === s.k) || KINDS[0];
const SEC_COLOR = {panda:"var(--panda)",koi:"var(--koi)",bonsai:"var(--bonsai)"};
const HISTORY_WEEKS = 8;
// The course runs month by month from November 2026 to October 2027.
const MONTHS = Array.from({length:12}, (_,i) => ({y:2026+Math.floor((10+i)/12), m:(10+i)%12}));
const MONTH_NAMES = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];

/* ---------- helpers ---------- */
const $ = s => document.querySelector(s);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const uid = () => Math.random().toString(36).slice(2,10) + Date.now().toString(36).slice(-4);
const mins = t => { const [h,m] = t.split(":").map(Number); return h*60 + m; };
const hrs = n => (Math.round(n*10)/10).toLocaleString("es-ES");
const calId = (sec,grp,tier) => `${sec}-${grp}-${tier}`;
function calLabel(id) {
  const [sec,grp,tier] = String(id).split("-");
  const S = SECTIONS.find(s => s.id === sec), G = S?.groups.find(g => g.id === grp), T = TIERS.find(t => t.id === tier);
  return {sec,S,G,T,text:`${S?.name ?? "?"} · ${(G?.name ?? "?").replace(/ \(.*\)/,"")} · ${T?.label ?? "?"}`};
}
function allCalIds() { const o=[]; for (const s of SECTIONS) for (const g of s.groups) for (const t of TIERS) o.push(calId(s.id,g.id,t.id)); return o; }
function newCode() { const A="ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; let c=""; const r=crypto.getRandomValues(new Uint8Array(8)); for (const x of r) c+=A[x%A.length]; return c; }

function isoWeek(date) {
  const d = new Date(Date.UTC(date.getFullYear(),date.getMonth(),date.getDate()));
  const day = d.getUTCDay() || 7; d.setUTCDate(d.getUTCDate()+4-day);
  const y = d.getUTCFullYear(); const w = Math.ceil(((d-Date.UTC(y,0,1))/864e5+1)/7);
  return `${y}-W${String(w).padStart(2,"0")}`;
}
function mondayFor(off) { const d=new Date(); d.setHours(12,0,0,0); d.setDate(d.getDate()-((d.getDay()+6)%7)+off*7); return d; }
const weekKey = off => isoWeek(mondayFor(off));
function weekLabel(off) { const m=mondayFor(off), s=new Date(m); s.setDate(m.getDate()+6); const f=d=>d.toLocaleDateString("es-ES",{day:"numeric",month:"short"}); return `Sem. ${weekKey(off).split("W")[1]} · ${f(m)} – ${f(s)}`; }
function dateOf(off,d) { const m=mondayFor(off); m.setDate(m.getDate()+d); return m; }
const ymd = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
const isDue = (off,d) => ymd(dateOf(off,d)) <= ymd(new Date());
const isToday = (off,d) => ymd(dateOf(off,d)) === ymd(new Date());
function ago(iso) {
  if (!iso) return "nunca";
  const days = Math.floor((Date.now()-new Date(iso))/864e5);
  return days<=0 ? "hoy" : days===1 ? "ayer" : `hace ${days} días`;
}
function toast(msg) { const t=$("#toast"); t.textContent=msg; t.hidden=false; clearTimeout(toast.t); toast.t=setTimeout(()=>t.hidden=true,2600); }
function errText(e) {
  const c = e?.code || "";
  return ({
    "auth/invalid-credential":"Email o contraseña incorrectos.",
    "auth/wrong-password":"Email o contraseña incorrectos.",
    "auth/user-not-found":"Email o contraseña incorrectos.",
    "auth/invalid-email":"Ese email no es válido.",
    "auth/email-already-in-use":"Ya hay una cuenta con ese email. Pulsa «Entrar».",
    "auth/weak-password":"La contraseña tiene que tener al menos 6 caracteres.",
    "auth/too-many-requests":"Demasiados intentos. Espera un momento y vuelve a probar.",
    "auth/network-request-failed":"No hay conexión. Revisa internet y vuelve a probar.",
    "permission-denied":"No tienes permiso para hacer esto."
  })[c] || "Algo ha fallado. Vuelve a intentarlo.";
}

/* ---------- calendars ---------- */
function template(tierId) {
  const B = {
    "2":[["17:00","19:00","Temario","materia"]],
    "34":[["09:30","11:30","Temario","materia"],["16:00","18:00","Repaso del día","repaso"]],
    "56":[["09:00","12:00","Temario","materia"],["16:00","18:00","Repaso del día","repaso"],["18:00","19:00","Test del tema","test"]],
    "78":[["08:30","12:30","Temario","materia"],["15:00","17:30","Repaso del día","repaso"],["17:30","19:00","Test del tema","test"]]
  }[tierId] || [];
  const out = [];
  for (let d=0; d<5; d++) B.forEach(([s,e,t,k],i) => out.push({id:`t${d}_${i}`,d,s,e,t,k}));
  out.push({id:"t5_0",d:5,s:"10:00",e:tierId==="2"?"12:00":"13:00",t:"Simulacro semanal",k:"examen"});
  return out;
}
function offFor(date) { const m=new Date(date); m.setHours(12,0,0,0); m.setDate(m.getDate()-((m.getDay()+6)%7)); return Math.round((m-mondayFor(0))/(7*864e5)); }
const courseEndOff = () => offFor(new Date(2027,9,31));
function monthIdxNow() { const d=new Date(); const i=MONTHS.findIndex(x=>x.y===d.getFullYear()&&x.m===d.getMonth()); return i<0?0:i; }
const wdOf = d => (d.getDay()+6)%7;
// A day's plan: the student's own change, else the group's change for that date, else the group's typical week.
function calDay(id, key, wd) { const o = S.calendars[id]?.days?.[key]; return o != null ? o : getCal(id).sessions.filter(s=>s.d===wd); }
function stuDay(stu, key, wd) { const o = stu.days?.[key]; return o != null ? o : calDay(stu.calId, key, wd); }
function getCal(id) {
  const c = S.calendars[id];
  if (c && Array.isArray(c.sessions)) return {sessions:c.sessions,isTemplate:false};
  return {sessions:template(String(id).split("-")[2]),isTemplate:true};
}
const dur = s => Math.max(0, mins(s.e)-mins(s.s))/60;
function dayHours(sessions) { const h=[0,0,0,0,0,0,0]; for (const s of sessions) h[s.d]+=dur(s); return h; }

/* ---------- state ---------- */
const S = {user:null, member:undefined, setupExists:null, calendars:{}, students:{}, weeks:{}, extras:{}, notes:{}, members:{}, invites:{}, me:null};
const ui = {tab:"panda", group:{panda:"ini",koi:"av",bonsai:"av"}, tier:{}, weekOff:0, open:null, confirmDel:null, authMode:"in", authMsg:"", authErr:"", month:monthIdxNow(), mode:"month", planFor:null, view:"week"};
try { const s=JSON.parse(localStorage.getItem("kenzo-ui")||"{}"); if (s.tab) ui.tab=s.tab; if (s.group) Object.assign(ui.group,s.group); if (s.tier) ui.tier=s.tier; } catch(e) {}
const saveUi = () => { try { localStorage.setItem("kenzo-ui",JSON.stringify({tab:ui.tab,group:ui.group,tier:ui.tier})); } catch(e) {} };

let subs = [];
const unsubAll = () => { subs.forEach(u => { try { u(); } catch(e) {} }); subs = []; };
// Right after joining, the member doc may not be on the server yet, so the first reads can be refused: retry a few times.
let retries = 0, retryTimer = null;
const onErr = e => {
  console.warn(e);
  if (e?.code !== "permission-denied") return;
  if (S.member && retries < 5) {
    if (!retryTimer) retryTimer = setTimeout(() => { retryTimer = null; retries++; unsubAll(); S.member.role === "admin" ? subscribeAdmin() : subscribeStudent(S.member.studentId); }, 1500);
    return;
  }
  toast("No tienes permiso para ver estos datos.");
};

async function write(fn) { try { await fn(); } catch (e) { console.warn(e); toast(errText(e)); } }

/* ---------- auth flow ---------- */
let memberUnsub = null;
be.onAuth(async u => {
  unsubAll(); if (memberUnsub) { memberUnsub(); memberUnsub = null; }
  retries = 0; clearTimeout(retryTimer); retryTimer = null;
  Object.assign(S, {user:u, member:undefined, calendars:{}, students:{}, weeks:{}, extras:{}, notes:{}, members:{}, invites:{}, me:null});
  render(true);
  if (!u) return;
  memberUnsub = be.watch(`members/${u.uid}`, async m => {
    const prevRole = S.member?.role, prevSid = S.member?.studentId;
    S.member = m;
    if (!m) { unsubAll(); try { S.setupExists = !!(await be.get("config/setup")); } catch(e) { S.setupExists = true; } render(true); if (ui.pendingCode) { const c=ui.pendingCode; ui.pendingCode=null; join(c); } return; }
    const changed = m.role !== prevRole || m.studentId !== prevSid;
    if (changed) { unsubAll(); m.role === "admin" ? subscribeAdmin() : subscribeStudent(m.studentId); }
    render(changed);
  }, onErr);
});

function subscribeAdmin() {
  const minWeek = weekKey(-HISTORY_WEEKS);
  subs.push(be.watchQuery("calendars", [], o => { S.calendars=o; render(); }, onErr));
  subs.push(be.watchQuery("students", [], o => { S.students=o; render(); }, onErr));
  subs.push(be.watchQuery("weeks", [["week",">=",minWeek]], o => { S.weeks=o; render(); }, onErr));
  subs.push(be.watchQuery("notes", [["week",">=",minWeek]], o => { S.notes=o; render(); }, onErr));
  subs.push(be.watchQuery("members", [], o => { S.members=o; render(); }, onErr));
  subs.push(be.watchQuery("invites", [], o => { S.invites=o; render(); }, onErr));
}
function subscribeStudent(sid) {
  if (!sid) return;
  let calUnsub = null;
  subs.push(be.watch(`students/${sid}`, st => {
    const prev = S.me?.calId; S.me = st ? {...st, id:sid} : null;
    if (st) S.students = {[sid]: S.me};
    if (st && st.calId !== prev) {
      if (calUnsub) calUnsub();
      calUnsub = be.watch(`calendars/${st.calId}`, c => { S.calendars = c ? {[st.calId]:c} : {}; render(); }, onErr);
      subs.push(() => calUnsub && calUnsub());
    }
    render();
  }, onErr));
  subs.push(be.watchQuery("weeks", [["studentId","==",sid]], o => { S.weeks=o; render(); }, onErr));
}

async function join(code) {
  code = code.trim().toUpperCase().replace(/\s+/g,"");
  if (!code) { ui.authErr = "Escribe el código que te ha dado la academia."; render(); return; }
  try {
    const inv = await be.get(`invites/${code}`);
    if (!inv) { ui.authErr = "Ese código no existe. Revísalo con la academia."; render(); return; }
    const m = {role:inv.role, code, email:S.user.email, joinedAt:new Date().toISOString()};
    if (inv.studentId) m.studentId = inv.studentId;
    if (inv.name) m.name = inv.name;
    ui.authErr = "";
    await be.set(`members/${S.user.uid}`, m);
    try { await be.del(`invites/${code}`); } catch (e) { console.warn(e); }
  } catch (e) { ui.authErr = errText(e); render(); }
}

/* ---------- stats ---------- */
function tasksFor(stu, off) {
  const out = [];
  for (let d=0; d<7; d++) { const key = ymd(dateOf(off,d)); const own = stu.days?.[key] != null;
    for (const s of stuDay(stu, key, d)) out.push({...s, d, src: own ? "own" : "cal"}); }
  return out.sort((a,b) => a.d-b.d || mins(a.s)-mins(b.s));
}
function stats(stu, off) {
  const wk = weekKey(off);
  const tasks = tasksFor(stu, off);
  const checks = S.weeks[`${stu.id}__${wk}`]?.checks || {};
  let due=0, done=0, no=0, unmarked=0, lastAt=null;
  const since = stu.createdAt ? ymd(new Date(stu.createdAt)) : null;
  const byKind = {}; const scores = [];
  for (const t of tasks) {
    const c = checks[t.id] || {};
    if (c.at && (!lastAt || c.at > lastAt)) lastAt = c.at;
    if (c.score != null && c.score !== "") scores.push({t, score:Number(c.score)});
    if (!isDue(off, t.d) || (since && ymd(dateOf(off, t.d)) < since)) continue;
    due++; const k = kindOf(t).id; byKind[k] ??= {due:0, done:0}; byKind[k].due++;
    if (c.st === "done") { done++; byKind[k].done++; } else if (c.st === "no") no++; else unmarked++;
  }
  return {tasks, checks, due, done, no, unmarked, lastAt, byKind, scores, pct: due ? Math.round(done/due*100) : null};
}
function lastActivity(stu) {
  let last = null;
  for (const [k,v] of Object.entries(S.weeks)) if (k.startsWith(stu.id+"__")) for (const c of Object.values(v.checks||{})) if (c?.at && c.by !== "admin" && (!last || c.at > last)) last = c.at;
  return last;
}
const pctClass = p => p==null ? "" : p>=80 ? "ok" : p>=60 ? "warn" : "bad";
function kchips(byKind) {
  return `<div class="kchips">${KINDS.filter(k=>byKind[k.id]).map(k=>{const b=byKind[k.id];return `<span class="kchip" style="--k:${k.c}">${k.name.split(" ")[0]} ${b.done}/${b.due}</span>`}).join("")}</div>`;
}

/* ---------- render ---------- */
let pendingRender = false;
function render(force) {
  const a = document.activeElement;
  if (!force && a && a.matches && a.matches("#main textarea, #main input:not([type=checkbox])")) { pendingRender = true; return; }
  pendingRender = false;
  const role = S.member?.role;
  document.body.dataset.sec = role === "admin" && SECTIONS.some(s=>s.id===ui.tab) ? ui.tab : "panda";
  $("#who").innerHTML = S.user ? `<span>${esc(S.member?.name || S.me?.name || S.user.email)}</span><button id="logout">Salir</button>` : "";
  $("#nav").hidden = role !== "admin";
  if (role === "admin") {
    $("#tabs").innerHTML = [...SECTIONS.map(s=>`<button role="tab" data-tab="${s.id}" aria-selected="${ui.tab===s.id}"><span class="dot" style="background:${SEC_COLOR[s.id]}"></span>${s.name}</button>`),
      `<button role="tab" data-tab="report" aria-selected="${ui.tab==="report"}">Informes</button>`,
      `<button role="tab" data-tab="team" aria-selected="${ui.tab==="team"}">Accesos</button>`].join("");
  }
  let html = DEMO ? `<div class="note demo">Modo demostración: los datos son de ejemplo y se guardan solo en este navegador. ${S.user?`<button class="ghost" id="reseed">Restaurar ejemplos</button>`:""}</div>` : "";
  if (!S.user) html += authHtml();
  else if (S.member === undefined) html += `<p class="empty">Cargando…</p>`;
  else if (!S.member) html += joinHtml();
  else if (role === "admin") html += ui.tab==="report" ? reportHtml() : ui.tab==="team" ? teamHtml() : sectionHtml();
  else html += studentHtml();
  $("#main").innerHTML = html;
}
document.addEventListener("focusout", () => { if (pendingRender) setTimeout(() => { if (pendingRender) render(); }, 0); });

function authHtml() {
  const up = ui.authMode === "up";
  return `<div class="auth">
    <div class="seg" role="group"><button data-auth="in" aria-pressed="${!up}">Entrar</button><button data-auth="up" aria-pressed="${up}">Crear cuenta</button></div>
    <form class="panel" id="authForm">
      <h2>${up ? "Crea tu cuenta" : "Hola de nuevo"}</h2>
      ${up ? `<p class="hint">Necesitas el código que te ha dado la academia.</p>` : ""}
      <label>Email<input id="aEmail" type="email" autocomplete="email" required></label>
      <label>Contraseña<input id="aPw" type="password" autocomplete="${up?"new-password":"current-password"}" ${up?'minlength="6"':""} required></label>
      ${up ? `<label>Código de la academia<input id="aCode" type="text" autocapitalize="characters" autocomplete="off" placeholder="Ej.: K7M2QX9A"></label>` : ""}
      <div class="err">${esc(ui.authErr)}</div>${ui.authMsg?`<div class="ok-msg">${esc(ui.authMsg)}</div>`:""}
      <button class="btn primary" type="submit">${up ? "Crear cuenta" : "Entrar"}</button>
      ${up ? "" : `<button type="button" class="ghost" id="forgot">He olvidado mi contraseña</button>`}
      ${DEMO ? `<p class="hint">Demo: entra como <b>paula@demo</b> (encargada) o <b>ana@demo</b> (alumna), contraseña <b>demo</b>.</p>` : ""}
    </form></div>`;
}
function joinHtml() {
  return `<div class="auth"><form class="panel" id="joinForm">
    <h2>Un paso más</h2>
    <p class="hint">Escribe el código que te ha dado la academia para entrar en tu planificador.</p>
    <label>Código<input id="jCode" type="text" autocapitalize="characters" autocomplete="off" placeholder="Ej.: K7M2QX9A"></label>
    <div class="err">${esc(ui.authErr)}</div>
    <button class="btn primary" type="submit">Entrar</button>
  </form>
  ${S.setupExists === false ? `<form class="panel" id="bootForm">
    <h2 style="font-size:22px">¿Primera vez?</h2>
    <p class="hint">Todavía no hay nadie al mando de la academia. Si eres la directora, configúrala ahora: tendrás acceso completo y podrás invitar a las encargadas y a los alumnos.</p>
    <label>Tu nombre<input id="bName" type="text" required maxlength="40"></label>
    <button class="btn primary" type="submit">Configurar la academia</button></form>` : ""}
  </div>`;
}

/* ---- student ---- */
function studentHtml() {
  const stu = S.me;
  if (!stu) return `<div class="empty">Tu ficha de alumno ya no existe. Habla con la academia.</div>`;
  const seg = `<div class="seg" role="group" aria-label="Vista" style="margin-bottom:16px"><button data-view="week" aria-pressed="${ui.view!=="year"}">Mi semana</button><button data-view="year" aria-pressed="${ui.view==="year"}">Mi calendario</button></div>`;
  if (ui.view === "year") return seg + studentMonthHtml(stu);
  return seg + studentWeekHtml(stu);
}
function studentMonthHtml(stu) {
  const M = MONTHS[ui.month] || MONTHS[0];
  const first = new Date(M.y, M.m, 1, 12); const nDays = new Date(M.y, M.m+1, 0).getDate(); const today = ymd(new Date());
  let h = `<section class="panel cal"><div class="monthbar"><button class="mnav" data-mo="-1" aria-label="Mes anterior" ${ui.month<=0?"disabled":""}>‹</button>
    <h3 class="mtitle">${MONTH_NAMES[M.m]} ${M.y}<span>${esc(calLabel(stu.calId).text)}</span></h3>
    <button class="mnav" data-mo="1" aria-label="Mes siguiente" ${ui.month>=MONTHS.length-1?"disabled":""}>›</button></div>
    <div class="mchips" role="group" aria-label="Meses del curso">${MONTHS.map((x,i)=>`<button data-month="${i}" aria-pressed="${i===ui.month}">${MONTH_NAMES[x.m].slice(0,3)}</button>`).join("")}</div>
    <div class="mgrid"><div class="mhead">${DAYS_L.map(d=>`<span>${d}</span>`).join("")}</div><div class="mdays">`;
  for (let i=0; i<wdOf(first); i++) h += `<div class="mday blank" aria-hidden="true"></div>`;
  for (let n=1; n<=nDays; n++) {
    const date = new Date(M.y, M.m, n, 12); const key = ymd(date); const wd = wdOf(date);
    const list = stuDay(stu, key, wd).slice().sort((a,b)=>mins(a.s)-mins(b.s));
    const checks = S.weeks[`${stu.id}__${isoWeek(date)}`]?.checks || {};
    h += `<div class="mday ${key===today?"today":""} ${wd>4?"wkend":""}"><span class="dnum"><b>${n}</b><span class="wdl">${DAYS_L[wd]}</span></span>
      ${list.map(t=>{ const st = checks[t.id]?.st; return `<span class="pill ${st||""}" style="--k:${kindOf(t).c}">${st==="done"?"✓ ":st==="no"?"✗ ":""}<span class="t">${t.s}</span> ${esc(t.t||kindOf(t).name)}</span>`; }).join("")}
      ${list.length ? "" : `<span class="rest">Libre</span>`}</div>`;
  }
  return h + `</div></div><div class="kinds" style="margin:12px 0 0">${KINDS.map(k=>`<span style="--c:${k.c}">${k.name}</span>`).join("")}</div>
    <p class="hint" style="margin:10px 0 0;font-size:13px;color:var(--muted)">Las tareas se marcan en «Mi semana».</p></section>`;
}
function studentWeekHtml(stu) {
  const off = ui.weekOff; const st = stats(stu, off); const lab = calLabel(stu.calId);
  const first = (stu.name || "").split(" ")[0];
  let h = `<div class="me-head"><div><h2>Hola, ${esc(first)}</h2><div class="sub">${esc(lab.text)} al día</div></div>
    <div class="ring" style="--p:${st.pct??0};--ring:${st.pct==null?"var(--soft)":st.pct>=80?"var(--ok)":st.pct>=60?"var(--warn)":"var(--bad)"}" title="Tareas completadas esta semana"><b>${st.pct==null?"—":st.pct+"%"}</b></div></div>
    <section class="panel"><div class="phead"><h3>Mis tareas</h3>${weekNav(1)}</div>
    <p class="hint" style="margin:0 0 14px;color:var(--muted);font-size:13px">Marca cada tarea cuando acabe el día: <b>Hecha</b> o <b>No</b>. Paula ve tu progreso en sus informes.</p><div class="daylist">`;
  let any = false;
  for (let d=0; d<7; d++) {
    const list = st.tasks.filter(t => t.d === d); if (!list.length) continue; any = true;
    const date = dateOf(off,d).toLocaleDateString("es-ES",{day:"numeric",month:"short"});
    h += `<div class="dayblock"><h4>${DAYS_L[d]} ${date}${isToday(off,d)?` <span class="chip">Hoy</span>`:""}</h4><div class="daylist" style="gap:8px">`;
    h += list.map(t => taskCard(stu, off, t, st.checks[t.id] || {})).join("");
    h += `</div></div>`;
  }
  if (!any) h += `<div class="empty">Esta semana no tienes tareas planificadas.</div>`;
  h += `</div></section>
    <div class="install" id="install">Para tenerla como app: en iPhone, abre esta página en Safari, pulsa Compartir y «Añadir a pantalla de inicio». En Android, abre el menú ⋮ de Chrome y pulsa «Instalar aplicación».${ui.canInstall?` <button class="btn" id="installBtn">Instalar ahora</button>`:""}</div>`;
  return h;
}
function taskCard(stu, off, t, c) {
  const k = kindOf(t); const due = isDue(off, t.d);
  const key = `${stu.id}|${off}|${t.id}`;
  return `<div class="task ${due?"":"future"}" style="--k:${k.c}">
    <div class="row"><div class="info"><span class="t">${t.s}–${t.e}</span><span class="k">${k.name}</span><span class="s">${esc(t.t || k.name)}</span></div>
    <div class="checks"><button data-check="${key}" data-st="done" data-on="${c.st==="done"?"done":""}" ${due?"":"disabled"}>✓ Hecha</button><button data-check="${key}" data-st="no" data-on="${c.st==="no"?"no":""}" ${due?"":"disabled"}>✗ No</button></div></div>
    ${c.st==="no" ? `<div class="extra"><input type="text" data-why="${key}" value="${esc(c.why||"")}" maxlength="120" placeholder="¿Qué ha pasado? (opcional)" aria-label="Motivo"></div>` : ""}
    ${c.st==="done" && SCORED.has(k.id) ? `<div class="extra"><label style="font-size:13px;color:var(--muted)">Nota</label><input class="score" type="number" inputmode="decimal" min="0" max="10" step="0.1" data-score="${key}" value="${c.score ?? ""}" placeholder="0–10" aria-label="Nota"></div>` : ""}
    ${!due ? `<span class="x" style="font-size:12px;color:var(--muted)">Podrás marcarla ese día</span>` : ""}
  </div>`;
}
function weekNav(maxAhead) {
  return `<div class="wknav"><button data-wk="-1" aria-label="Semana anterior" ${ui.weekOff<=-HISTORY_WEEKS?"disabled":""}>‹</button><span>${weekLabel(ui.weekOff)}</span><button data-wk="1" aria-label="Semana siguiente" ${ui.weekOff>=Math.max(maxAhead,courseEndOff())?"disabled":""}>›</button></div>`;
}

/* ---- admin: section ---- */
function currentCalId() { const Sx=SECTIONS.find(s=>s.id===ui.tab); const g=ui.group[Sx.id]; return calId(Sx.id,g,ui.tier[`${Sx.id}-${g}`]||"2"); }
function sectionHtml() {
  const Sx = SECTIONS.find(s=>s.id===ui.tab) || SECTIONS[0]; const g = ui.group[Sx.id];
  const tier = ui.tier[`${Sx.id}-${g}`] || "2"; const id = calId(Sx.id,g,tier); const T = TIERS.find(t=>t.id===tier);
  const {sessions,isTemplate} = getCal(id);
  let html = `<div class="sechead"><div><h2>${Sx.name}</h2><div class="sub">${Sx.sub}</div></div>`;
  if (Sx.groups.length>1) html += `<div class="seg" role="group" aria-label="Grupo">${Sx.groups.map(G=>`<button data-group="${G.id}" aria-pressed="${G.id===g}">${G.name}</button>`).join("")}</div>`;
  html += `</div><div class="tiers" role="group" aria-label="Horas de estudio al día">${TIERS.map(t=>{
    const n = Object.values(S.students).filter(s=>s.calId===calId(Sx.id,g,t.id)).length;
    return `<button data-tier="${t.id}" aria-pressed="${t.id===tier}"><b>${t.label}</b><span>al día · ${n} ${n===1?"alumno":"alumnos"}</span></button>`}).join("")}</div>`;
  html += ui.mode === "base" && !ui.planFor ? baseWeekHtml(id, T, sessions, isTemplate) : monthHtml(id, Sx, T);

  const studs = Object.values(S.students).filter(s=>s.calId===id).sort((a,b)=>a.name.localeCompare(b.name,"es"));
  html += `<section class="panel"><div class="phead"><h3>Alumnos de este calendario</h3>${weekNav(1)}</div>`;
  if (!studs.length) html += `<div class="empty">Todavía no hay alumnos en este calendario. Añade el primero aquí abajo y te daré su código de acceso.</div>`;
  html += `<div class="students">` + studs.map(stu => adminStudentCard(stu)).join("") + `</div>`;
  html += `<form class="addrow" id="addStu"><input id="newStu" type="text" placeholder="Nombre y apellido del alumno" maxlength="60" aria-label="Nombre del alumno"><button class="btn primary" type="submit">Añadir alumno</button></form></section>`;
  return html;
}
function baseWeekHtml(id, T, sessions, isTemplate) {
  const h = dayHours(sessions); const week = h.reduce((a,b)=>a+b,0);
  let html = `<section class="panel"><div class="phead"><h3>Semana tipo · ${esc(T.label)} al día</h3><div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
    ${isTemplate?`<span class="chip">Plantilla sugerida</span>`:""}<span class="chip">${hrs(week)} h / semana</span><button class="btn" data-mode="month">Volver al calendario</button></div></div>
    <p class="hint" style="margin:0 0 12px;font-size:13px;color:var(--muted)">La semana tipo rellena todos los días del curso que no hayas cambiado a mano.</p><div class="week">`;
  for (let d=0; d<7; d++) {
    const list = sessions.filter(s=>s.d===d).sort((a,b)=>mins(a.s)-mins(b.s));
    const cls = h[d]>T.max ? "over" : (h[d]>0 && h[d]<T.min) ? "under" : "";
    html += `<div class="day"><header><b>${DAYS_L[d]}</b><small class="${cls}">${h[d]?hrs(h[d])+" h":"—"}</small></header>`;
    html += list.map(s=>`<button class="sess" style="--k:${kindOf(s).c}" data-sess="${s.id}"><span class="t">${s.s}–${s.e}<span class="k">${kindOf(s).name}</span></span><span class="s">${esc(s.t||kindOf(s).name)}</span></button>`).join("");
    if (!list.length) html += `<div class="rest">Descanso</div>`;
    html += `<button class="add" data-add="${d}">+ Añadir</button></div>`;
  }
  return html + `</div></section>`;
}
function monthHtml(id, Sx, T) {
  const stu = ui.planFor ? S.students[ui.planFor] : null;
  const M = MONTHS[ui.month] || MONTHS[0];
  const first = new Date(M.y, M.m, 1, 12); const nDays = new Date(M.y, M.m+1, 0).getDate();
  const today = ymd(new Date()); const lab = calLabel(id);
  let html = `<section class="panel cal">`;
  if (stu) html += `<div class="planfor"><span>Estás planificando solo para <b>${esc(stu.name)}</b>. Lo que cambies aquí no afecta al resto del grupo.</span><button class="btn" data-planexit="1">Volver al calendario del grupo</button></div>`;
  html += `<div class="monthbar"><button class="mnav" data-mo="-1" aria-label="Mes anterior" ${ui.month<=0?"disabled":""}>‹</button>
    <h3 class="mtitle">${MONTH_NAMES[M.m]} ${M.y}<span>${esc(stu ? stu.name : `${Sx.name} · ${lab.G.name.replace(/ \(.*\)/,"")}`)} · ${esc(T.label)}</span></h3>
    <button class="mnav" data-mo="1" aria-label="Mes siguiente" ${ui.month>=MONTHS.length-1?"disabled":""}>›</button></div>
    <div class="mchips" role="group" aria-label="Meses del curso">${MONTHS.map((x,i)=>`<button data-month="${i}" aria-pressed="${i===ui.month}">${MONTH_NAMES[x.m].slice(0,3)}</button>`).join("")}</div>
    <div class="mgrid"><div class="mhead">${DAYS_L.map(d=>`<span>${d}</span>`).join("")}</div><div class="mdays">`;
  for (let i=0; i<wdOf(first); i++) html += `<div class="mday blank" aria-hidden="true"></div>`;
  for (let n=1; n<=nDays; n++) {
    const date = new Date(M.y, M.m, n, 12); const key = ymd(date); const wd = wdOf(date);
    const list = (stu ? stuDay(stu, key, wd) : calDay(id, key, wd)).slice().sort((a,b)=>mins(a.s)-mins(b.s));
    const changed = stu ? stu.days?.[key] != null : S.calendars[id]?.days?.[key] != null;
    const tot = list.reduce((a,s)=>a+dur(s),0);
    html += `<div class="mday ${key===today?"today":""} ${wd>4?"wkend":""} ${changed?"changed":""}">
      <button class="dnum" data-dayopt="${key}" aria-label="Opciones del ${n} de ${MONTH_NAMES[M.m]}"><b>${n}</b><span class="wdl">${DAYS_L[wd]}</span>${tot?`<small>${hrs(tot)} h</small>`:""}</button>
      ${list.map(s=>`<button class="pill" style="--k:${kindOf(s).c}" data-dsess="${key}|${s.id}"><span class="t">${s.s}</span> ${esc(s.t||kindOf(s).name)}</button>`).join("")}
      ${list.length ? "" : `<span class="rest">Libre</span>`}
      <button class="dadd" data-dadd="${key}" aria-label="Añadir sesión el ${n}">+</button></div>`;
  }
  html += `</div></div><div class="kinds" style="margin:12px 0 0">${KINDS.map(k=>`<span style="--c:${k.c}">${k.name}</span>`).join("")}<span class="chgkey">Día cambiado a mano</span></div>
    <div class="calfoot"><p>Toca una sesión para cambiarla, <b>+</b> para añadir y el número del día para más opciones.</p>
    ${stu ? "" : `<button class="btn" data-mode="base">Editar la semana tipo</button>`}</div></section>`;
  return html;
}
function studentAccess(stu) {
  const linked = Object.values(S.members).some(m => m.studentId === stu.id);
  const code = Object.entries(S.invites).find(([,v]) => v.studentId === stu.id)?.[0];
  return {linked, code};
}
function adminStudentCard(stu) {
  const off = ui.weekOff; const st = stats(stu, off); const open = ui.open === stu.id;
  const {linked, code} = studentAccess(stu);
  const note = S.notes[`${stu.id}__${weekKey(off)}`]?.note || "";
  let h = `<div class="stu"><div class="top"><span class="name">${esc(stu.name)}</span>
    <span style="display:flex;gap:8px;align-items:center;flex-wrap:wrap"><span class="pct ${pctClass(st.pct)}" title="Tareas hechas de las que ya tocaban">${st.pct==null?"sin tareas aún":st.pct+" %"}</span>
    <button class="ghost" data-open="${stu.id}">${open?"Cerrar":"Ver tareas"}</button></span></div>
    <div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;align-items:center">${kchips(st.byKind)}
    <span style="font-size:12px;color:var(--muted)">${st.done} hechas · ${st.no} no · ${st.unmarked} sin marcar</span></div>
    <div class="codebox">${linked ? `<span class="linked">✓ Tiene acceso a la app</span>` : code ? `Código de acceso: <code>${code}</code><button class="btn" data-copyinv="${code}" data-name="${esc(stu.name)}">Copiar mensaje para el alumno</button>` : `<button class="btn" data-mkinv="${stu.id}">Crear código de acceso</button>`}</div>`;
  if (open) {
    h += `<div class="tlist">` + (st.tasks.length ? st.tasks.map(t => {
      const c = st.checks[t.id] || {}; const due = isDue(off,t.d); const k = kindOf(t);
      const stTxt = c.st==="done" ? `✓ Hecha${c.score!=null&&c.score!==""?` · ${c.score}`:""}` : c.st==="no" ? "✗ No" : due ? "Sin marcar" : "Pendiente";
      return `<div class="trow" style="--k:${k.c}"><span class="st ${c.st||"pend"}">${DAYS[t.d]} ${t.s}</span>
        <span>${esc(t.t||k.name)} <small>· ${k.name}${t.src==="own"?" · solo para este alumno":""}${c.why?` · «${esc(c.why)}»`:""}</small></span>
        <span style="display:flex;gap:6px;align-items:center"><span class="st ${c.st||"pend"}">${stTxt}</span></span></div>`;
    }).join("") : `<div class="empty">No hay tareas esta semana.</div>`) + `</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn" data-planfor="${stu.id}">Planificar el año de ${esc(stu.name.split(" ")[0])}</button></div>
      <textarea data-note="${stu.id}" placeholder="Nota privada de la semana (el alumno no la ve)">${esc(note)}</textarea>`;
    const opts = allCalIds().map(c=>`<option value="${c}" ${c===stu.calId?"selected":""}>${esc(calLabel(c).text)}</option>`).join("");
    h += `<div class="edit"><input type="text" id="en-${stu.id}" value="${esc(stu.name)}" aria-label="Nombre"><select id="ec-${stu.id}" aria-label="Calendario">${opts}</select>
      <button class="btn primary" data-savestu="${stu.id}">Guardar cambios</button>
      ${ui.confirmDel===stu.id?`<button class="btn danger" data-delstu="${stu.id}">Sí, eliminar alumno</button>`:`<button class="btn danger" data-askdel="${stu.id}">Eliminar</button>`}</div>`;
  }
  return h + `</div>`;
}

/* ---- admin: team ---- */
function teamHtml() {
  const mem = Object.entries(S.members);
  const admins = mem.filter(([,m]) => m.role === "admin");
  const studs = mem.filter(([,m]) => m.role === "student");
  const adminInv = Object.entries(S.invites).filter(([,v]) => v.role === "admin");
  let h = `<div class="sechead"><div><h2 style="color:var(--ink)">Accesos</h2><div class="sub">Quién puede entrar en la app</div></div></div>
  <section class="panel"><div class="phead"><h3>Encargadas</h3></div><div class="members">`;
  h += admins.map(([id,m]) => `<div class="mrow"><span><b>${esc(m.name||"Sin nombre")}</b> <small style="color:var(--muted)">${esc(m.email||"")}</small></span>${id===S.user.uid?`<span class="chip">Tú</span>`:`<button class="btn danger" data-rmmem="${id}">Quitar acceso</button>`}</div>`).join("");
  h += adminInv.map(([code,v]) => `<div class="mrow"><span>Invitación para <b>${esc(v.name)}</b>: <span class="codebox" style="display:inline-flex"><code>${code}</code></span></span><span style="display:flex;gap:6px"><button class="btn" data-copyinv="${code}" data-name="${esc(v.name)}">Copiar mensaje</button><button class="btn danger" data-rminv="${code}">Anular</button></span></div>`).join("");
  h += `</div><form class="addrow" id="addAdmin"><input id="newAdmin" type="text" maxlength="40" placeholder="Nombre de la nueva encargada" aria-label="Nombre de la nueva encargada"><button class="btn primary" type="submit">Crear invitación</button></form></section>
  <section class="panel"><div class="phead"><h3>Alumnos con acceso</h3><span class="chip">${studs.length}</span></div><div class="members">`;
  h += studs.length ? studs.map(([id,m]) => { const st = S.students[m.studentId]; return `<div class="mrow"><span><b>${esc(st?.name || "Alumno eliminado")}</b> <small style="color:var(--muted)">${esc(m.email||"")}</small></span><button class="btn danger" data-rmmem="${id}">Quitar acceso</button></div>`; }).join("")
    : `<div class="empty">Ningún alumno ha entrado todavía. Sus códigos están en la ficha de cada alumno, dentro de su calendario.</div>`;
  return h + `</div></section>`;
}

/* ---- admin: report ---- */
function reportRows() {
  return Object.values(S.students).map(stu => {
    const cur = stats(stu,0);
    const hist = [-3,-2,-1,0].map(o => stats(stu,o).pct);
    const vals = hist.filter(v => v!=null);
    const avg = vals.length ? Math.round(vals.reduce((a,b)=>a+b,0)/vals.length) : null;
    const allScores = [-3,-2,-1,0].flatMap(o => stats(stu,o).scores);
    const lastScore = allScores.length ? allScores[allScores.length-1] : null;
    const byKind4 = {};
    for (const o of [-3,-2,-1,0]) for (const [k,v] of Object.entries(stats(stu,o).byKind)) { byKind4[k] ??= {due:0,done:0}; byKind4[k].due+=v.due; byKind4[k].done+=v.done; }
    return {stu, cur, hist, avg, lastScore, allScores, byKind4, last:lastActivity(stu), lab:calLabel(stu.calId), note:S.notes[`${stu.id}__${weekKey(0)}`]?.note || "", access:studentAccess(stu)};
  }).sort((a,b) => (a.cur.pct ?? 101) - (b.cur.pct ?? 101));
}
function reportHtml() {
  const rows = reportRows();
  const withData = rows.filter(r => r.cur.pct!=null);
  const avg = withData.length ? Math.round(withData.reduce((a,r)=>a+r.cur.pct,0)/withData.length) : null;
  const risk = rows.filter(r => r.cur.pct!=null && r.cur.pct<60).length;
  const quiet = rows.filter(r => r.access.linked && (!r.last || (Date.now()-new Date(r.last))/864e5 >= 3)).length;
  let h = `<div class="sechead"><div><h2 style="color:var(--ink)">Informes</h2><div class="sub">${weekLabel(0)} · basado en lo que marcan los alumnos</div></div>
    <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn" id="copyRep">Copiar informe</button><button class="btn" id="dlRep">Descargar CSV</button></div></div>
    <div class="tiles"><div class="tile"><b>${rows.length}</b><span>alumnos</span></div><div class="tile"><b>${avg==null?"—":avg+" %"}</b><span>tareas hechas esta semana (media)</span></div>
    <div class="tile"><b style="color:${risk?"var(--bad)":"inherit"}">${risk}</b><span>por debajo del 60 %</span></div><div class="tile"><b style="color:${quiet?"var(--warn)":"inherit"}">${quiet}</b><span>llevan 3 días o más sin marcar</span></div></div>`;
  if (!rows.length) return h + `<div class="empty">Cuando añadas alumnos y empiecen a marcar sus tareas, aquí verás cómo van.</div>`;
  h += `<section class="panel"><div class="tbl"><table><thead><tr><th>Alumno</th><th>Equipo · plan</th><th>Esta semana</th><th>Por tipo (4 sem.)</th><th>Últimas 4 sem.</th><th>Última nota</th><th>Marcó por última vez</th><th>Nota privada</th></tr></thead><tbody>`;
  h += rows.map(r => { const c = r.cur; const stale = r.access.linked && (!r.last || (Date.now()-new Date(r.last))/864e5 >= 3);
    return `<tr><td><b>${esc(r.stu.name)}</b>${r.access.linked?"":`<br><small style="color:var(--muted)">aún no ha entrado</small>`}</td>
    <td><span class="teamtag" style="--c:${SEC_COLOR[r.lab.sec]}">${esc(r.lab.text)}</span></td>
    <td class="num"><span class="pct ${pctClass(c.pct)}">${c.pct==null?"—":c.pct+" %"}</span><br><small style="color:var(--muted)">${c.done}/${c.due} hechas${c.unmarked?` · ${c.unmarked} sin marcar`:""}</small></td>
    <td>${kchips(r.byKind4)}</td>
    <td><div class="spark" title="${r.hist.map(v=>v==null?"—":v+"%").join(" · ")}">${r.hist.map((v,i)=>`<i class="${i===3?"cur":""}" style="height:${v==null?2:Math.max(3,v/100*26)}px"></i>`).join("")}</div><small style="color:var(--muted)">media ${r.avg==null?"—":r.avg+" %"}</small></td>
    <td class="num">${r.lastScore?`${r.lastScore.score}<br><small style="color:var(--muted)">${esc(r.lastScore.t.t||kindOf(r.lastScore.t).name)}</small>`:"—"}</td>
    <td class="${stale?"risk":""}" style="font-size:13px">${ago(r.last)}</td>
    <td style="max-width:240px;color:var(--muted);font-size:13px">${esc(r.note)}</td></tr>`; }).join("");
  return h + `</tbody></table></div></section>`;
}
function reportText() {
  const rows = reportRows(); const lines = [`Informe Kenzo · ${weekLabel(0)}`, ""];
  for (const Sx of SECTIONS) {
    const rs = rows.filter(r => r.lab.sec === Sx.id); if (!rs.length) continue; lines.push(Sx.name.toUpperCase());
    for (const r of rs) {
      const kinds = Object.entries(r.cur.byKind).map(([k,v]) => `${KINDS.find(x=>x.id===k)?.name.split(" ")[0]} ${v.done}/${v.due}`).join(", ");
      lines.push(`- ${r.stu.name} (${r.lab.G.name.replace(/ \(.*\)/,"")}, ${r.lab.T.label}/día): ${r.cur.pct==null?"sin tareas aún":r.cur.pct+"%"} esta semana (${r.cur.done}/${r.cur.due} hechas${kinds?`; ${kinds}`:""}); media 4 sem. ${r.avg==null?"—":r.avg+"%"}${r.lastScore?`; última nota ${r.lastScore.score}`:""}; marcó por última vez ${ago(r.last)}${r.note?`. Nota: ${r.note}`:""}`);
    }
    lines.push("");
  }
  return lines.join("\n");
}
function reportCsv() {
  const q = v => `"${String(v ?? "").replace(/"/g,'""')}"`;
  const head = ["Alumno","Equipo","Grupo","Plan","Semana","% hechas","Hechas","Tocaban","No hechas","Sin marcar","Media 4 sem %","Última nota","Último marcado","Nota privada"];
  return [head.map(q).join(";"), ...reportRows().map(r => [r.stu.name,r.lab.S?.name,r.lab.G?.name,r.lab.T?.label,weekKey(0),r.cur.pct??"",r.cur.done,r.cur.due,r.cur.no,r.cur.unmarked,r.avg??"",r.lastScore?.score??"",r.last?r.last.slice(0,10):"",r.note].map(q).join(";"))].join("\n");
}

/* ---------- actions ---------- */
async function setCheck(key, patch) {
  const [sid, off, tid] = key.split("|"); const wk = weekKey(Number(off));
  const by = S.member?.role === "admin" ? "admin" : "student";
  await write(() => be.merge(`weeks/${sid}__${wk}`, {studentId:sid, week:wk, checks:{[tid]:{...patch, at:new Date().toISOString(), by}}}));
}
function inviteMessage(code, name) {
  const url = location.origin + location.pathname;
  return `Hola ${name.split(" ")[0]}, ya tienes acceso al planificador de Kenzo.\n1. Entra en ${url}\n2. Pulsa «Crear cuenta» y elige tu email y una contraseña.\n3. Escribe este código: ${code}\nDespués podrás añadirla a la pantalla de inicio del móvil como una app.`;
}
async function copy(text, okMsg) {
  try { await navigator.clipboard.writeText(text); toast(okMsg); }
  catch (e) { const ta=document.createElement("textarea"); ta.value=text; document.body.appendChild(ta); ta.select(); try { document.execCommand("copy"); toast(okMsg); } catch(_) { toast("No se pudo copiar"); } ta.remove(); }
}
async function makeInvite(data) { const code = newCode(); try { await be.set(`invites/${code}`, {...data, createdAt:new Date().toISOString()}); return code; } catch (e) { console.warn(e); toast(errText(e)); return null; } }

document.addEventListener("click", async e => {
  const b = e.target.closest("button"); if (!b) return;
  const Sx = SECTIONS.find(s => s.id === ui.tab);
  if (b.id === "logout") { ui.weekOff = 0; await be.signOut(); return; }
  if (b.id === "reseed") { be.reseed?.(); toast("Ejemplos restaurados"); return; }
  if (b.dataset.auth) { ui.authMode = b.dataset.auth; ui.authErr = ui.authMsg = ""; render(true); return; }
  if (b.id === "forgot") { const em = $("#aEmail").value.trim(); if (!em) { ui.authErr = "Escribe tu email y vuelve a pulsar."; render(true); return; }
    try { await be.reset(em); ui.authErr=""; ui.authMsg = "Te hemos enviado un email para cambiar la contraseña."; } catch(err) { ui.authErr = errText(err); } render(true); return; }
  if (b.id === "installBtn" && ui.installEvt) { ui.installEvt.prompt(); ui.installEvt = null; ui.canInstall = false; render(); return; }
  if (b.dataset.tab) { ui.tab = b.dataset.tab; ui.open = null; ui.planFor = null; ui.mode = "month"; saveUi(); render(true); window.scrollTo({top:0}); return; }
  if (b.dataset.group) { ui.group[Sx.id] = b.dataset.group; ui.open = null; ui.planFor = null; saveUi(); render(true); return; }
  if (b.dataset.tier) { ui.tier[`${Sx.id}-${ui.group[Sx.id]}`] = b.dataset.tier; ui.open = null; ui.planFor = null; saveUi(); render(true); return; }
  if (b.dataset.wk) { ui.weekOff = Math.max(-HISTORY_WEEKS, Math.min(Math.max(1,courseEndOff()), ui.weekOff + Number(b.dataset.wk))); render(true); return; }
  if (b.dataset.add != null) { openDlg({mode:"cal", day:Number(b.dataset.add)}); return; }
  if (b.dataset.sess) { openDlg({mode:"cal", sessId:b.dataset.sess}); return; }
  if (b.dataset.planfor) { ui.planFor = b.dataset.planfor; ui.mode = "month"; render(true); window.scrollTo({top:0, behavior:"smooth"}); return; }
  if (b.dataset.planexit) { ui.planFor = null; render(true); return; }
  if (b.dataset.view) { ui.view = b.dataset.view; render(true); return; }
  if (b.dataset.mode) { ui.mode = b.dataset.mode; render(true); return; }
  if (b.dataset.mo) { ui.month = Math.max(0, Math.min(MONTHS.length-1, ui.month + Number(b.dataset.mo))); render(true); return; }
  if (b.dataset.month) { ui.month = Number(b.dataset.month); render(true); return; }
  if (b.dataset.dadd) { openDlg({mode:"day", key:b.dataset.dadd}); return; }
  if (b.dataset.dsess) { const [key, sid] = b.dataset.dsess.split("|"); openDlg({mode:"day", key, sessId:sid}); return; }
  if (b.dataset.dayopt) { openDayDlg(b.dataset.dayopt); return; }
  if (b.dataset.check) { const cur = stats(S.students[b.dataset.check.split("|")[0]] || S.me, Number(b.dataset.check.split("|")[1])).checks[b.dataset.check.split("|")[2]] || {};
    await setCheck(b.dataset.check, {st: cur.st === b.dataset.st ? null : b.dataset.st}); return; }
  if (b.dataset.open) { ui.open = ui.open === b.dataset.open ? null : b.dataset.open; ui.confirmDel = null; render(true); return; }
  if (b.dataset.mkinv) { await makeInvite({role:"student", studentId:b.dataset.mkinv}); return; }
  if (b.dataset.copyinv) { await copy(inviteMessage(b.dataset.copyinv, b.dataset.name), "Mensaje copiado. Pégalo en WhatsApp o en un email."); return; }
  if (b.dataset.rminv) { await write(() => be.del(`invites/${b.dataset.rminv}`)); return; }
  if (b.dataset.rmmem) { await write(() => be.del(`members/${b.dataset.rmmem}`)); toast("Acceso quitado"); return; }
  if (b.dataset.askdel) { ui.confirmDel = b.dataset.askdel; render(true); return; }
  if (b.dataset.savestu) { const id = b.dataset.savestu; const name = $("#en-"+id).value.trim(); if (!name) { toast("Escribe un nombre"); return; }
    const calNew = $("#ec-"+id).value; ui.open = null;
    await write(() => be.merge(`students/${id}`, {name, calId:calNew}));
    if (calNew !== currentCalId()) toast(`${name} ahora está en ${calLabel(calNew).text}`); return; }
  if (b.dataset.delstu) { const id = b.dataset.delstu; ui.open = ui.confirmDel = null;
    await write(async () => {
      for (const [code,v] of Object.entries(S.invites)) if (v.studentId === id) await be.del(`invites/${code}`);
      for (const [mid,m] of Object.entries(S.members)) if (m.studentId === id) await be.del(`members/${mid}`);
      await be.del(`students/${id}`);
    }); toast("Alumno eliminado"); return; }
  if (b.id === "copyRep") { await copy(reportText(), "Informe copiado"); return; }
  if (b.id === "dlRep") { const blob = new Blob(["﻿"+reportCsv()], {type:"text/csv;charset=utf-8"}); const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = `informe-kenzo-${weekKey(0)}.csv`; a.click(); setTimeout(()=>URL.revokeObjectURL(a.href), 2000); return; }
});

document.addEventListener("submit", async e => {
  const f = e.target; e.preventDefault();
  if (f.id === "authForm") {
    const em = $("#aEmail").value.trim(), pw = $("#aPw").value; ui.authErr = ui.authMsg = "";
    try {
      if (ui.authMode === "up") { ui.pendingCode = $("#aCode").value.trim() || null; await be.signUp(em, pw); }
      else await be.signIn(em, pw);
    } catch (err) { ui.pendingCode = null; ui.authErr = errText(err); render(true); }
    return;
  }
  if (f.id === "joinForm") { await join($("#jCode").value); return; }
  if (f.id === "bootForm") { const name = $("#bName").value.trim(); if (!name) return;
    try { await be.bootstrap(S.user.uid, {role:"admin", name, email:S.user.email, joinedAt:new Date().toISOString()}); }
    catch (err) { ui.authErr = errText(err); render(true); } return; }
  if (f.id === "addStu") { const inp = $("#newStu"); const name = inp.value.trim(); if (!name) return;
    const id = uid(); inp.value = "";
    await write(() => be.set(`students/${id}`, {id, name, calId:currentCalId(), createdAt:new Date().toISOString()}));
    if (!await makeInvite({role:"student", studentId:id})) return; ui.open = null; render(true); toast(`${name} añadido. Ya tiene su código de acceso.`); return; }
  if (f.id === "addAdmin") { const inp = $("#newAdmin"); const name = inp.value.trim(); if (!name) return; inp.value = "";
    if (!await makeInvite({role:"admin", name})) { inp.value = name; return; } render(true); toast("Invitación creada. Copia el mensaje y envíaselo."); return; }
});

document.addEventListener("change", async e => {
  const t = e.target;
  if (t.dataset.note) { const sid = t.dataset.note, wk = weekKey(ui.weekOff); const val = t.value.trim();
    if ((S.notes[`${sid}__${wk}`]?.note || "") === val) return;
    await write(() => be.set(`notes/${sid}__${wk}`, {studentId:sid, week:wk, note:val})); return; }
  if (t.dataset.why) { await setCheck(t.dataset.why, {st:"no", why:t.value.trim()}); toast("Guardado"); return; }
  if (t.dataset.score) { let v = t.value === "" ? null : Math.max(0, Math.min(10, Number(t.value.replace(",", "."))));
    if (v != null && isNaN(v)) v = null; await setCheck(t.dataset.score, {st:"done", score:v}); toast("Nota guardada"); return; }
});

/* ---------- session dialog ---------- */
const dlg = $("#dlg");
$("#fKind").innerHTML = KINDS.map(k => `<option value="${k.id}">${k.name}</option>`).join("");
$("#fDay").innerHTML = DAYS_L.map((d,i) => `<option value="${i}">${d}</option>`).join("");
let dlgCtx = null;
const longDate = key => { const [y,m,d] = key.split("-").map(Number); return new Date(y,m-1,d,12).toLocaleDateString("es-ES",{weekday:"long", day:"numeric", month:"long"}); };
// Where a day's plan is saved: the student's own calendar while planning for one, otherwise the group's.
function dayTarget(key) {
  const [y,m,d] = key.split("-").map(Number); const wd = wdOf(new Date(y,m-1,d,12));
  const stu = ui.planFor ? S.students[ui.planFor] : null; const id = currentCalId();
  return stu ? {path:`students/${stu.id}`, list: stuDay(stu, key, wd), changed: stu.days?.[key] != null, who: stu.name.split(" ")[0]}
             : {path:`calendars/${id}`, list: calDay(id, key, wd), changed: S.calendars[id]?.days?.[key] != null, who: null};
}
const saveDays = (path, days) => write(() => be.merge(path, {days, updatedAt:new Date().toISOString()}));
function openDlg(ctx) {
  dlgCtx = ctx;
  let s = null;
  if (ctx.mode === "cal" && ctx.sessId) s = getCal(currentCalId()).sessions.find(x => x.id === ctx.sessId);
  if (ctx.mode === "day" && ctx.sessId) s = dayTarget(ctx.key).list.find(x => x.id === ctx.sessId);
  const who = ctx.mode === "day" ? dayTarget(ctx.key).who : null;
  $("#dlgTitle").textContent = ctx.mode === "day" ? `${s ? "Editar sesión" : "Nueva sesión"} · ${longDate(ctx.key)}${who ? ` · solo ${who}` : ""}` : s ? "Editar sesión (semana tipo)" : "Nueva sesión (semana tipo)";
  $("#fDayWrap").hidden = ctx.mode === "day";
  $("#fDay").value = s ? s.d : (ctx.day ?? 0); $("#fStart").value = s ? s.s : "17:00"; $("#fEnd").value = s ? s.e : "19:00";
  $("#fSubj").value = s ? s.t : ""; $("#fKind").value = s ? kindOf(s).id : "materia";
  $("#fDel").hidden = !s; $("#fErr").textContent = ""; dlg.showModal();
}
$("#fCancel").onclick = () => dlg.close();
$("#dlgForm").addEventListener("submit", async e => {
  e.preventDefault(); e.stopPropagation();
  const s = $("#fStart").value, en = $("#fEnd").value;
  if (!s || !en || mins(en) <= mins(s)) { $("#fErr").textContent = "La hora de fin tiene que ser posterior a la de inicio."; return; }
  const data = {d:Number($("#fDay").value), s, e:en, t:$("#fSubj").value.trim(), k:$("#fKind").value};
  dlg.close();
  if (dlgCtx.mode === "day") {
    const T = dayTarget(dlgCtx.key); const [y,m,d] = dlgCtx.key.split("-").map(Number); data.d = wdOf(new Date(y,m-1,d,12));
    const list = T.list.map(x => ({...x}));
    if (dlgCtx.sessId) { const i = list.findIndex(x => x.id === dlgCtx.sessId); if (i >= 0) list[i] = {...list[i], ...data}; }
    else list.push({id:uid(), ...data});
    await saveDays(T.path, {[dlgCtx.key]: list}); toast("Día guardado"); return;
  }
  const id = currentCalId(); const sessions = getCal(id).sessions.map(x => ({...x}));
  if (dlgCtx.sessId) { const i = sessions.findIndex(x => x.id === dlgCtx.sessId); if (i >= 0) sessions[i] = {...sessions[i], ...data}; }
  else sessions.push({id:uid(), ...data});
  await write(() => be.merge(`calendars/${id}`, {sessions, updatedAt:new Date().toISOString()})); toast("Semana tipo guardada");
}, true);
$("#fDel").onclick = async () => {
  dlg.close();
  if (dlgCtx.mode === "day") { const T = dayTarget(dlgCtx.key); await saveDays(T.path, {[dlgCtx.key]: T.list.filter(x => x.id !== dlgCtx.sessId)}); toast("Sesión quitada de ese día"); return; }
  const id = currentCalId(); const sessions = getCal(id).sessions.filter(x => x.id !== dlgCtx.sessId);
  await write(() => be.merge(`calendars/${id}`, {sessions, updatedAt:new Date().toISOString()})); toast("Sesión eliminada");
};

/* ---------- day options ---------- */
const dayDlg = $("#dayDlg"); let dayKey = null;
function openDayDlg(key) {
  dayKey = key; const T = dayTarget(key);
  $("#ddTitle").textContent = longDate(key) + (T.who ? ` · solo ${T.who}` : "");
  $("#ddReset").hidden = !T.changed;
  $("#ddReset").textContent = T.who ? "Volver al calendario del grupo" : "Volver a la semana tipo";
  // Weeks left in the course after this one, to repeat this week's plan.
  const [y,m,d] = key.split("-").map(Number); const off = offFor(new Date(y,m-1,d,12)); const end = courseEndOff();
  const opts = []; for (let o = off+1; o <= end; o++) { const mo = mondayFor(o); opts.push(`<option value="${o}">${mo.toLocaleDateString("es-ES",{day:"numeric", month:"short", year:"numeric"})}</option>`); }
  $("#ddUntil").innerHTML = opts.length ? opts.join("") : `<option value="">No quedan semanas</option>`;
  if (opts.length) $("#ddUntil").value = String(Math.min(end, off+4));
  $("#ddRepeat").disabled = !opts.length;
  dayDlg.showModal();
}
$("#ddClose").onclick = () => dayDlg.close();
$("#ddAdd").onclick = () => { dayDlg.close(); openDlg({mode:"day", key:dayKey}); };
$("#ddFree").onclick = async () => { dayDlg.close(); const T = dayTarget(dayKey); await saveDays(T.path, {[dayKey]: []}); toast("Día libre"); };
$("#ddReset").onclick = async () => { dayDlg.close(); const T = dayTarget(dayKey); await saveDays(T.path, {[dayKey]: null}); toast("Día restablecido"); };
$("#ddRepeat").onclick = async () => {
  const until = Number($("#ddUntil").value); if (!until) return; dayDlg.close();
  const [y,m,d] = dayKey.split("-").map(Number); const off = offFor(new Date(y,m-1,d,12));
  const src = []; for (let i=0; i<7; i++) src.push(dayTarget(ymd(dateOf(off,i))).list);
  const days = {};
  for (let o = off+1; o <= until; o++) for (let i=0; i<7; i++) days[ymd(dateOf(o,i))] = src[i].map(x => ({...x, d:i}));
  await saveDays(dayTarget(dayKey).path, days); toast(`Semana repetida ${until-off} ${until-off===1?"vez":"veces"}`);
};

/* ---------- PWA ---------- */
window.addEventListener("beforeinstallprompt", e => { e.preventDefault(); ui.installEvt = e; ui.canInstall = true; render(); });
if ("serviceWorker" in navigator && location.protocol === "https:") navigator.serviceWorker.register("sw.js").catch(() => {});
render();
