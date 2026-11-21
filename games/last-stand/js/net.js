/* =====================================================================
   net.js — Firebase auth, profile sync, lobbies, live matches
   Collections are all prefixed ls_ so they never collide with other games.
   Everything degrades to local play when Firebase is unreachable.
   ===================================================================== */

export const FB_CONFIG = {
  apiKey: 'AIzaSyDJhWSi7QZKXtOPYwKHPF7zPg_klh1If7w',
  authDomain: 'damp-2406a.firebaseapp.com',
  projectId: 'damp-2406a',
  appId: '1:940989851976:web:f8fd07c258afa71fd22b7d'
};
const MAIL_SUFFIX = '@damp.example';
const P = {
  players: 'ls_players',
  board: 'ls_board',
  presence: 'ls_presence',
  rooms: 'ls_rooms'
};

export const net = {
  mode: 'offline',      // 'online' | 'local' | 'offline'
  uid: null,
  name: 'guest',
  fb: null,
  listeners: [],

  on(fn) { this.listeners.push(fn); },
  emit(...args) { this.listeners.forEach((f) => { try { f(...args); } catch (e) { console.warn(e); } }); },

  async init() {
    try {
      const [appMod, authMod, dbMod] = await Promise.all([
        import('../../../vendor/firebase/firebase-app.js'),
        import('../../../vendor/firebase/firebase-auth.js'),
        import('../../../vendor/firebase/firebase-firestore.js')
      ]);
      const app = appMod.initializeApp(FB_CONFIG);
      const auth = authMod.getAuth(app);
      const db = dbMod.getFirestore(app);
      try { await authMod.setPersistence(auth, authMod.browserLocalPersistence); } catch (e) { /* session only */ }
      this.fb = { a: authMod, f: dbMod, auth, db };
      this.mode = 'local';
      this.emit('state', this.mode);
      return true;
    } catch (err) {
      console.warn('[net] Firebase unavailable — local play only.', err);
      this.mode = 'offline';
      this.emit('state', this.mode);
      return false;
    }
  },

  mailFor(name) { return String(name).trim().toLowerCase().replace(/[^a-z0-9._-]/g, '') + MAIL_SUFFIX; },

  async signIn(name, pass) {
    if (!this.fb) throw new Error('Online play is unavailable right now.');
    const { a, auth } = this.fb;
    const cred = await a.signInWithEmailAndPassword(auth, this.mailFor(name), pass);
    return cred.user;
  },
  async register(name, pass) {
    if (!this.fb) throw new Error('Online play is unavailable right now.');
    const { a, auth } = this.fb;
    const cred = await a.createUserWithEmailAndPassword(auth, this.mailFor(name), pass);
    try { await a.updateProfile(cred.user, { displayName: name }); } catch (e) { /* optional */ }
    return cred.user;
  },
  async signOut() {
    if (!this.fb) return;
    try { await this.fb.a.signOut(this.fb.auth); } catch (e) { /* ignore */ }
  },
  watchAuth(cb) {
    if (!this.fb) { cb(null); return; }
    this.fb.a.onAuthStateChanged(this.fb.auth, (user) => {
      this.uid = user ? user.uid : null;
      this.mode = user ? 'online' : 'local';
      this.emit('state', this.mode);
      cb(user);
    });
  },

  /* ------------------------------------------------------------- profile */
  async loadProfile(uid) {
    if (!this.fb || !uid) return null;
    const { f, db } = this.fb;
    try {
      const snap = await f.getDoc(f.doc(db, P.players, uid));
      return snap.exists() ? snap.data() : null;
    } catch (e) { console.warn('[net] profile read failed', e); return null; }
  },
  async pushProfile(profile) {
    if (!this.fb || !this.uid || this.mode !== 'online') return;
    const { f, db } = this.fb;
    try {
      await f.setDoc(f.doc(db, P.players, this.uid), JSON.parse(JSON.stringify(profile)), { merge: true });
      this.saveBlocked = false;
    } catch (e) {
      this.saveBlocked = true;
      console.warn('[net] profile save failed', e && e.code);
    }
  },

  /* --------------------------------------------------------------- board */
  async publishBoard(profile) {
    if (!this.fb || !this.uid || this.mode !== 'online') return;
    const { f, db } = this.fb;
    try {
      await f.setDoc(f.doc(db, P.board, this.uid), {
        uid: this.uid,
        name: profile.name,
        level: profile.level,
        rating: profile.rating,
        wins: profile.stats.wins,
        matches: profile.stats.matches,
        at: Date.now()
      });
    } catch (e) { console.warn('[net] board write failed', e); }
  },
  async fetchBoard(field = 'rating', limitN = 30) {
    if (!this.fb) return [];
    const { f, db } = this.fb;
    try {
      const q = f.query(f.collection(db, P.board), f.orderBy(field, 'desc'), f.limit(limitN));
      const snap = await f.getDocs(q);
      return snap.docs.map((d) => d.data());
    } catch (e) { console.warn('[net] board read failed', e); return []; }
  },

  /* ------------------------------------------------------------ presence */
  async setPresence(info) {
    if (!this.fb || !this.uid || this.mode !== 'online') return;
    const { f, db } = this.fb;
    try {
      await f.setDoc(f.doc(db, P.presence, this.uid), Object.assign({ uid: this.uid, name: this.name, at: Date.now() }, info));
    } catch (e) { /* ignore */ }
  },
  async clearPresence() {
    if (!this.fb || !this.uid) return;
    const { f, db } = this.fb;
    try { await f.deleteDoc(f.doc(db, P.presence, this.uid)); } catch (e) { /* ignore */ }
  },
  async listOnline() {
    if (!this.fb) return [];
    const { f, db } = this.fb;
    try {
      const snap = await f.getDocs(f.query(f.collection(db, P.presence), f.limit(60)));
      const now = Date.now();
      return snap.docs.map((d) => d.data()).filter((d) => now - (d.at || 0) < 45000);
    } catch (e) { return []; }
  },

  /* --------------------------------------------------------------- rooms */
  randomCode() {
    const L = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let s = '';
    for (let i = 0; i < 4; i++) s += L[(Math.random() * L.length) | 0];
    return s;
  },
  async createRoom(cfg) {
    if (!this.fb || this.mode !== 'online') throw new Error('Sign in to play online.');
    const { f, db } = this.fb;
    for (let attempt = 0; attempt < 6; attempt++) {
      const code = this.randomCode();
      const ref = f.doc(db, P.rooms, code);
      const exists = await f.getDoc(ref);
      if (exists.exists()) continue;
      const now = Date.now();
      const doc = {
        code,
        host: this.uid,
        hostName: this.name,
        hostSeen: now,
        mode: cfg.mode || 'casual',
        open: cfg.open !== false,
        maxPlayers: cfg.maxPlayers || 20,
        phase: 'lobby',
        round: 0,
        seq: 0,
        game: '',
        startAt: 0,
        endsAt: 0,
        nextAt: 0,
        createdAt: now,
        updatedAt: now,
        players: {},
        lastResults: [],
        winner: ''
      };
      await f.setDoc(ref, doc);
      return code;
    }
    throw new Error('Could not open a room — try again.');
  },
  async findOpenRoom(mode) {
    if (!this.fb) return null;
    const { f, db } = this.fb;
    try {
      const snap = await f.getDocs(f.query(f.collection(db, P.rooms), f.where('phase', '==', 'lobby'), f.limit(12)));
      const now = Date.now();
      const rooms = snap.docs.map((d) => d.data())
        .filter((r) => r.mode === mode && r.open !== false && now - (r.hostSeen || 0) < 15000)
        .sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
      for (const r of rooms) {
        const pSnap = await f.getDocs(f.collection(db, P.rooms, r.code, 'presence'));
        const n = pSnap.docs.filter((d) => now - (d.data().at || 0) < 15000).length;
        if (n < (r.maxPlayers || 20)) return r.code;
      }
      return null;
    } catch (e) { console.warn('[net] room search failed', e); return null; }
  },
  watchRoom(code, cb) {
    if (!this.fb) return () => {};
    const { f, db } = this.fb;
    return f.onSnapshot(f.doc(db, P.rooms, code), (snap) => {
      cb(snap.exists() ? Object.assign({ code }, snap.data()) : null);
    }, (err) => { console.warn('[net] room watch', err); cb(null, err); });
  },
  async patchRoom(code, patch) {
    if (!this.fb) return;
    const { f, db } = this.fb;
    await f.updateDoc(f.doc(db, P.rooms, code), Object.assign({}, patch, { updatedAt: Date.now() }));
  },
  async deleteRoom(code) {
    if (!this.fb) return;
    const { f, db } = this.fb;
    try { await f.deleteDoc(f.doc(db, P.rooms, code)); } catch (e) { /* ignore */ }
  },

  async roomPresence(code, info) {
    if (!this.fb || !this.uid) return;
    const { f, db } = this.fb;
    await f.setDoc(f.doc(db, P.rooms, code, 'presence', this.uid), Object.assign({
      uid: this.uid, name: this.name, at: Date.now(), ready: false
    }, info), { merge: true });
  },
  async setReady(code, ready) {
    if (!this.fb || !this.uid) return;
    const { f, db } = this.fb;
    await f.setDoc(f.doc(db, P.rooms, code, 'presence', this.uid), { ready: !!ready, at: Date.now() }, { merge: true });
  },
  watchPresence(code, cb) {
    if (!this.fb) return () => {};
    const { f, db } = this.fb;
    return f.onSnapshot(f.collection(db, P.rooms, code, 'presence'), (snap) => {
      const now = Date.now();
      cb(snap.docs.map((d) => d.data()).filter((d) => now - (d.at || 0) < 16000));
    }, (err) => console.warn('[net] presence watch', err));
  },
  async leaveRoom(code) {
    if (!this.fb || !this.uid) return;
    const { f, db } = this.fb;
    try { await f.deleteDoc(f.doc(db, P.rooms, code, 'presence', this.uid)); } catch (e) { /* ignore */ }
  },

  /* -------------------------------------------------------------- scores */
  async writeScore(code, seq, data) {
    if (!this.fb || !this.uid) return;
    const { f, db } = this.fb;
    await f.setDoc(f.doc(db, P.rooms, code, 'scores', this.uid), Object.assign({
      uid: this.uid, name: this.name, seq, at: Date.now()
    }, data));
  },
  watchScores(code, seq, cb) {
    if (!this.fb) return () => {};
    const { f, db } = this.fb;
    return f.onSnapshot(f.collection(db, P.rooms, code, 'scores'), (snap) => {
      cb(snap.docs.map((d) => d.data()).filter((s) => s.seq === seq));
    }, (err) => console.warn('[net] scores watch', err));
  },
  async clearScores(code) {
    if (!this.fb) return;
    const { f, db } = this.fb;
    try {
      const snap = await f.getDocs(f.collection(db, P.rooms, code, 'scores'));
      await Promise.all(snap.docs.map((d) => f.deleteDoc(d.ref)));
    } catch (e) { /* ignore */ }
  }
};

export function netErr(err) {
  const code = (err && (err.code || err.message)) || '';
  if (String(code).includes('permission-denied')) {
    return 'The arcade server refused that. Online play needs the game\'s Firestore rules published.';
  }
  if (String(code).includes('unavailable') || String(code).includes('network')) {
    return 'No connection to the online arcade. Try again in a moment.';
  }
  if (String(code).includes('not-found')) return 'No room with that code.';
  return (err && err.message) || 'Something went wrong.';
}

export function authMessage(code) {
  const map = {
    'auth/invalid-credential': 'That name and password do not match.',
    'auth/wrong-password': 'That password is not right.',
    'auth/user-not-found': 'No player with that name — create an account.',
    'auth/email-already-in-use': 'That name is taken.',
    'auth/weak-password': 'Use at least 6 characters.',
    'auth/network-request-failed': 'No connection to the arcade. Try again.',
    'auth/too-many-requests': 'Too many attempts. Wait a minute.'
  };
  return map[code] || 'Something went wrong. Try again.';
}
