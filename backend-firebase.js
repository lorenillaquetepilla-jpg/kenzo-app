const V = "10.12.2";
const B = `https://www.gstatic.com/firebasejs/${V}`;
const { initializeApp } = await import(`${B}/firebase-app.js`);
const A = await import(`${B}/firebase-auth.js`);
const F = await import(`${B}/firebase-firestore.js`);

export function makeBackend(cfg) {
  const app = initializeApp(cfg);
  const auth = A.getAuth(app);
  let fs;
  const dbId = cfg.databaseId || "(default)";
  try { fs = F.initializeFirestore(app, { localCache: F.persistentLocalCache() }, dbId); }
  catch (e) { fs = F.getFirestore(app, dbId); }
  const d = p => F.doc(fs, p);
  return {
    demo: false,
    onAuth: cb => A.onAuthStateChanged(auth, u => cb(u ? { uid: u.uid, email: u.email } : null)),
    signIn: (e, p) => A.signInWithEmailAndPassword(auth, e, p),
    signUp: (e, p) => A.createUserWithEmailAndPassword(auth, e, p),
    signOut: () => A.signOut(auth),
    reset: e => A.sendPasswordResetEmail(auth, e),
    get: async p => { const s = await F.getDoc(d(p)); return s.exists() ? s.data() : null; },
    watch: (p, cb, err) => F.onSnapshot(d(p), s => cb(s.exists() ? s.data() : null), err),
    watchQuery: (c, filters, cb, err) =>
      F.onSnapshot(F.query(F.collection(fs, c), ...filters.map(f => F.where(...f))),
        s => { const o = {}; s.forEach(x => o[x.id] = x.data()); cb(o); }, err),
    set: (p, data) => F.setDoc(d(p), data),
    merge: (p, data) => F.setDoc(d(p), data, { merge: true }),
    del: p => F.deleteDoc(d(p)),
    bootstrap: async (uid, member) => {
      const b = F.writeBatch(fs);
      b.set(d("members/" + uid), member);
      b.set(d("config/setup"), { by: uid, at: new Date().toISOString() });
      await b.commit();
    }
  };
}
