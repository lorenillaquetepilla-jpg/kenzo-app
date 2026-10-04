// Modo demostración: mismos métodos que backend-firebase.js, con los datos en este navegador.
const KEY = "kenzo-demo-v1";

function isoWeek(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = d.getUTCDay() || 7; d.setUTCDate(d.getUTCDate() + 4 - day);
  const y = d.getUTCFullYear(); const w = Math.ceil(((d - Date.UTC(y, 0, 1)) / 864e5 + 1) / 7);
  return `${y}-W${String(w).padStart(2, "0")}`;
}
function wk(off) { const d = new Date(); d.setDate(d.getDate() + off * 7); return isoWeek(d); }

function seed() {
  const now = new Date().toISOString();
  const db = {
    "config/setup": { by: "demo-paula", at: now },
    "members/demo-paula": { role: "admin", name: "Paula", email: "paula@demo" },
    "members/demo-ana": { role: "student", studentId: "s-ana", name: "Ana", email: "ana@demo", code: "ANA12345" },
    "students/s-ana": { id: "s-ana", name: "Ana López", calId: "panda-ini-2", createdAt: new Date(Date.now()-20*864e5).toISOString() },
    "students/s-marcos": { id: "s-marcos", name: "Marcos Ruiz", calId: "koi-av-56", createdAt: new Date(Date.now()-10*864e5).toISOString() },
    "students/s-lucia": { id: "s-lucia", name: "Lucía Gómez", calId: "bonsai-ini-34", createdAt: now },
    "invites/ANA12345": { role: "student", studentId: "s-ana", createdAt: now },
    "invites/MAR67890": { role: "student", studentId: "s-marcos", createdAt: now },
    "invites/LUC24680": { role: "student", studentId: "s-lucia", createdAt: now }
  };
  const mk = (sid, w, checks) => { db[`weeks/${sid}__${w}`] = { studentId: sid, week: w, checks }; };
  const at = now;
  mk("s-ana", wk(-1), { t0_0: { st: "done", at }, t1_0: { st: "done", at }, t2_0: { st: "done", at }, t3_0: { st: "no", why: "Turno de trabajo", at }, t4_0: { st: "done", at }, t5_0: { st: "done", score: 6.8, at } });
  mk("s-ana", wk(0), { t0_0: { st: "done", at }, t1_0: { st: "done", at }, t2_0: { st: "no", why: "Médico", at } });
  mk("s-marcos", wk(-1), { t0_0: { st: "done", at }, t0_1: { st: "no", at }, t0_2: { st: "done", score: 7.5, at }, t1_0: { st: "done", at }, t1_1: { st: "no", at } });
  mk("s-marcos", wk(0), { t0_0: { st: "done", at }, t0_1: { st: "no", why: "Cansado", at } });
  db[`extras/s-ana__${wk(0)}`] = { studentId: "s-ana", week: wk(0), tasks: [{ id: "x1", d: 3, s: "19:00", e: "19:30", t: "Repasar tema 7", k: "repaso" }] };
  db[`notes/s-marcos__${wk(0)}`] = { studentId: "s-marcos", week: wk(0), note: "Hablar con él el lunes." };
  return db;
}

let data;
try { data = JSON.parse(localStorage.getItem(KEY) || "null"); } catch (e) { data = null; }
if (!data) data = seed();
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) {} };
const clone = v => v == null ? null : JSON.parse(JSON.stringify(v));

const listeners = new Set();
function notify() { save(); for (const l of [...listeners]) l(); }

function deepMerge(a, b) {
  const out = { ...(a || {}) };
  for (const [k, v] of Object.entries(b)) out[k] = v && typeof v === "object" && !Array.isArray(v) ? deepMerge(out[k], v) : v;
  return out;
}
function match(doc, [f, op, v]) {
  const x = doc[f];
  return op === "==" ? x === v : op === ">=" ? x >= v : op === "<=" ? x <= v : op === "!=" ? x !== v : true;
}

const USERS = { "paula@demo": "demo-paula", "ana@demo": "demo-ana" };
let authUser = null; try { authUser = JSON.parse(sessionStorage.getItem("kenzo-demo-user") || "null"); } catch (e) {}
const authCbs = new Set();
function setUser(u) { authUser = u; try { sessionStorage.setItem("kenzo-demo-user", JSON.stringify(u)); } catch (e) {} for (const c of authCbs) c(u); }
const err = code => Object.assign(new Error(code), { code });

export default {
  demo: true,
  reseed() { data = seed(); notify(); },
  onAuth(cb) { authCbs.add(cb); setTimeout(() => cb(authUser), 0); return () => authCbs.delete(cb); },
  async signIn(email, pw) {
    email = email.trim().toLowerCase();
    const uid = USERS[email] || data[`_users/${email}`]?.uid;
    if (!uid || (USERS[email] ? pw !== "demo" : data[`_users/${email}`].pw !== pw)) throw err("auth/invalid-credential");
    setUser({ uid, email });
  },
  async signUp(email, pw) {
    email = email.trim().toLowerCase();
    if (USERS[email] || data[`_users/${email}`]) throw err("auth/email-already-in-use");
    if (pw.length < 6) throw err("auth/weak-password");
    const uid = "u-" + Math.random().toString(36).slice(2, 10);
    data[`_users/${email}`] = { uid, pw }; save(); setUser({ uid, email });
  },
  async signOut() { setUser(null); },
  async reset() {},
  async get(p) { return clone(data[p]); },
  watch(p, cb) { let last; const l = () => { const v = JSON.stringify(data[p] ?? null); if (v !== last) { last = v; cb(clone(data[p])); } }; listeners.add(l); setTimeout(l, 0); return () => listeners.delete(l); },
  watchQuery(c, filters, cb) {
    let last;
    const l = () => {
      const o = {};
      for (const [k, v] of Object.entries(data)) {
        const i = k.indexOf("/"); if (k.slice(0, i) !== c || k.indexOf("/", i + 1) !== -1) continue;
        if (filters.every(f => match(v, f))) o[k.slice(i + 1)] = clone(v);
      }
      const s = JSON.stringify(o); if (s !== last) { last = s; cb(o); }
    };
    listeners.add(l); setTimeout(l, 0); return () => listeners.delete(l);
  },
  async set(p, v) { data[p] = clone(v); notify(); },
  async merge(p, v) { data[p] = deepMerge(data[p], clone(v)); notify(); },
  async del(p) { delete data[p]; notify(); },
  async bootstrap(uid, member) { data["members/" + uid] = member; data["config/setup"] = { by: uid }; notify(); }
};
