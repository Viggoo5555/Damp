/* =====================================================================
   DREAM PARK — Firebase
   Accounts, cloud park saves, public park discovery, likes, follows,
   leaderboards, weekly competition entries and presence. Every call
   fails softly: a guest park keeps working on one device.
   ===================================================================== */
import { CONFIG, CLOUD_READY } from "./config.js";

const SDK = "../../../vendor/firebase/";
let fb = null;
let current = null;
let authWatcher = null;
let initPromise = null;
let authResolve = null;
const authSettled = new Promise((resolve) => { authResolve = resolve; });
setTimeout(() => { if (authResolve) authResolve(current, false); }, 3200);

export function getUser() { return current; }
export function isReady() { return !!fb; }
export function onAuth(fn) { authWatcher = fn; if (current) fn(current); }
export function isSignedIn() { return !!(current && !current.guest); }
export function isGuest() { return !current || !!current.guest; }

/* ---------------------------------------------------------------------
   Boot
   --------------------------------------------------------------------- */
function emulatorTarget() {
  try {
    const params = new URLSearchParams(location.search);
    const target = params.get("emulator") || localStorage.getItem("dream-park-emulator");
    if (target && /^[a-z0-9.\-]+:\d+$/.test(target)) return target;
  } catch (error) { /* ignore */ }
  return null;
}

export async function init() {
  if (initPromise) return initPromise;
  initPromise = (async () => {
    if (!CLOUD_READY) return false;
    try {
      const [appMod, authMod, dbMod] = await Promise.all([
        import(SDK + "firebase-app.js"),
        import(SDK + "firebase-auth.js"),
        import(SDK + "firebase-firestore.js")
      ]);
      const app = appMod.initializeApp(CONFIG.firebase);
      const auth = authMod.getAuth(app);
      const db = dbMod.getFirestore(app);
      const emulator = emulatorTarget();
      if (emulator) {
        const [host, port] = emulator.split(":");
        try { authMod.connectAuthEmulator(auth, `http://${host}:${port}`, { disableWarnings: true }); } catch (error) { /* already connected */ }
        try { dbMod.connectFirestoreEmulator(db, host, Number(port)); } catch (error) { /* already connected */ }
      }
      fb = { app, a: authMod, f: dbMod, auth, db, emulator: !!emulator };
      authMod.onAuthStateChanged(auth, (u) => {
        if (u) {
          current = {
            uid: u.uid,
            name: (u.displayName || nameFromMail(u.email) || "Park keeper").slice(0, 20),
            guest: false,
            anonymous: !!u.isAnonymous
          };
          if (authWatcher) authWatcher(current);
        } else {
          current = null;
        }
        if (authResolve) { authResolve(current, true); authResolve = null; }
      });
      return true;
    } catch (error) {
      console.warn("Dream Park: Firebase unavailable — guest parks still work.", error);
      fb = null;
      return false;
    }
  })();
  return initPromise;
}

function mailFor(name) {
  const clean = String(name || "").trim().toLowerCase().replace(/[^a-z0-9_]/g, "");
  return clean + CONFIG.mailSuffix;
}
function nameFromMail(mail) {
  return mail && mail.endsWith(CONFIG.mailSuffix) ? mail.slice(0, -CONFIG.mailSuffix.length) : (mail || "");
}

export async function restore() {
  await init();
  if (!fb) return null;
  await Promise.race([authSettled, new Promise((resolve) => setTimeout(resolve, 2800))]);
  return current;
}

export function validateName(name) {
  const clean = String(name || "").trim();
  if (clean.length < 3) return "Use at least 3 characters.";
  if (clean.length > 20) return "Keep it to 20 characters or fewer.";
  if (!/^[a-zA-Z0-9_ ]+$/.test(clean)) return "Letters, numbers, spaces and underscores only.";
  return null;
}

export async function signIn(name, password, create) {
  await init();
  if (!fb) throw new Error("Online parks aren't reachable right now. You can build as a guest.");
  const clean = String(name || "").trim();
  const nameError = validateName(clean);
  if (nameError) throw new Error(nameError);
  if (!password || password.length < 6) throw new Error("Passwords need at least 6 characters.");
  let cred;
  try {
    cred = create
      ? await fb.a.createUserWithEmailAndPassword(fb.auth, mailFor(clean), password)
      : await fb.a.signInWithEmailAndPassword(fb.auth, mailFor(clean), password);
  } catch (error) {
    throw new Error(friendlyAuthError(error));
  }
  try { await fb.a.updateProfile(cred.user, { displayName: clean }); } catch (error) { /* optional */ }
  current = { uid: cred.user.uid, name: clean.slice(0, 20), guest: false, anonymous: false };
  return current;
}

export async function signOut() {
  if (fb && fb.auth) { try { await fb.a.signOut(fb.auth); } catch (error) { /* ignore */ } }
  current = null;
}

export function friendlyAuthError(error) {
  const code = error && error.code;
  if (code === "auth/email-already-in-use") return "That username is taken. Try another.";
  if (code === "auth/invalid-credential" || code === "auth/wrong-password" || code === "auth/user-not-found") return "That username and password don't match.";
  if (code === "auth/weak-password") return "Passwords need at least 6 characters.";
  if (code === "auth/network-request-failed") return "No connection to the park server. Try again or build as a guest.";
  if (code === "auth/too-many-requests") return "Too many attempts. Wait a moment and try again.";
  return (error && error.message) || "Something went wrong. Try again.";
}

/* ---------------------------------------------------------------------
   Cloud saves — one document per account, private to its owner.
   --------------------------------------------------------------------- */
const saveRef = () => fb.f.doc(fb.db, CONFIG.collections.saves, current.uid);
const parkRef = (uid) => fb.f.doc(fb.db, CONFIG.collections.parks, uid);
const parksCol = () => fb.f.collection(fb.db, CONFIG.collections.parks);

export async function saveCloud(state) {
  if (!fb || !current || current.guest) return false;
  const payload = JSON.stringify(state);
  if (payload.length > 780000) throw new Error("This park is too big to sync. Remove a few decorations.");
  const doc = {
    uid: current.uid,
    name: String(state.name || current.name).slice(0, 24),
    coins: clampInt(state.coins, 0, 99999999),
    xp: clampInt(state.xp, 0, 99999999),
    level: clampInt(state.level, 1, 99),
    land: clampInt(state.land, 4, 12),
    updated: Date.now(),
    state: payload
  };
  await fb.f.setDoc(saveRef(), doc);
  return true;
}

export async function loadCloud(uid) {
  if (!fb) return null;
  try {
    const snap = await fb.f.getDoc(fb.f.doc(fb.db, CONFIG.collections.saves, uid || current.uid));
    if (!snap.exists()) return null;
    const data = snap.data() || {};
    if (!data.state) return null;
    let state = null;
    try { state = JSON.parse(data.state); } catch (error) { return null; }
    return state;
  } catch (error) {
    return null;
  }
}

export async function deleteCloud() {
  if (!fb || !current || current.guest) return false;
  try {
    await fb.f.deleteDoc(saveRef());
    await fb.f.deleteDoc(parkRef(current.uid));
    return true;
  } catch (error) { return false; }
}

/* ---------------------------------------------------------------------
   Public parks — a snapshot anyone can look at, editable by its owner.
   --------------------------------------------------------------------- */
export async function publishPark(snapshot) {
  if (!fb || !current || current.guest) return false;
  const doc = {
    uid: current.uid,
    owner: current.name,
    name: String(snapshot.name || "A park").slice(0, 24),
    level: clampInt(snapshot.level, 1, 99),
    rating: clampFloat(snapshot.rating, 1, 5),
    visitors: clampInt(snapshot.visitors, 0, 9999999),
    staff: clampInt(snapshot.staff, 0, 500),
    rides: clampInt(snapshot.rides, 0, 60),
    decor: clampInt(snapshot.decor, 0, 400),
    likes: clampInt(snapshot.likes, 0, 999999),
    layout: String(snapshot.layout || "{}").slice(0, 220000),
    updated: Date.now()
  };
  // Keep an existing like count: the field is maintained by transactions.
  const ref = parkRef(current.uid);
  const existing = await fb.f.getDoc(ref);
  if (existing.exists()) doc.likes = clampInt(existing.data().likes, 0, 999999);
  await fb.f.setDoc(ref, doc, { merge: true });
  return doc.likes;
}

export async function touchParkPresence() {
  if (!fb || !current || current.guest) return;
  try {
    await fb.f.setDoc(fb.f.doc(fb.db, CONFIG.collections.presence, current.uid), {
      name: current.name, at: Date.now()
    }, { merge: true });
  } catch (error) { /* nicety */ }
}

export function subscribeParks(callback) {
  if (!fb) return () => {};
  let unsub = () => {};
  try {
    const q = fb.f.query(parksCol(), fb.f.orderBy("updated", "desc"), fb.f.limit(30));
    let first = true;
    unsub = fb.f.onSnapshot(q, (snap) => {
      const rows = snap.docs.map((d) => ({ id: d.id, ...(d.data() || {}) }));
      if (!rows.length && first) { first = false; fetchParks().then(callback).catch(() => callback([])); return; }
      first = false;
      callback(rows);
    }, () => {
      fetchParks().then(callback).catch(() => callback([]));
    });
  } catch (error) { fetchParks().then(callback).catch(() => callback([])); }
  return () => { try { unsub(); } catch (error) { /* ignore */ } };
}

export async function fetchParks() {
  await init();
  if (!fb) return [];
  try {
    const snap = await fb.f.getDocs(fb.f.query(parksCol(), fb.f.orderBy("updated", "desc"), fb.f.limit(30)));
    return snap.docs.map((d) => ({ id: d.id, ...(d.data() || {}) }));
  } catch (error) {
    return [];
  }
}

export async function fetchPark(uid) {
  await init();
  if (!fb) return null;
  try {
    const snap = await fb.f.getDoc(parkRef(uid));
    return snap.exists() ? { id: snap.id, ...snap.data() } : null;
  } catch (error) { return null; }
}

export async function fetchLeaderboard() {
  await init();
  if (!fb) return [];
  try {
    const snap = await fb.f.getDocs(fb.f.query(parksCol(), fb.f.orderBy("level", "desc"), fb.f.limit(40)));
    return snap.docs.map((d) => ({ id: d.id, ...(d.data() || {}) }))
      .sort((a, b) => (b.level || 0) - (a.level || 0) || (b.rating || 0) - (a.rating || 0));
  } catch (error) { return []; }
}

export async function searchParks(term) {
  await init();
  if (!fb) return [];
  const clean = String(term || "").trim();
  if (clean.length < 2) return [];
  try {
    const snap = await fb.f.getDocs(fb.f.query(parksCol(), fb.f.where("name", ">=", clean), fb.f.where("name", "<=", clean + "\uf8ff"), fb.f.limit(12)));
    return snap.docs.map((d) => ({ id: d.id, ...(d.data() || {}) }));
  } catch (error) { return []; }
}

/* Likes: one document per visitor inside the park, and a counter kept in
   step by a transaction so two likes at once cannot lose one. */
const likeRef = (parkUid) => fb.f.doc(fb.db, CONFIG.collections.parks, parkUid, CONFIG.collections.likes, current.uid);

export async function hasLiked(parkUid) {
  if (!fb || !current || current.guest) return false;
  try {
    const snap = await fb.f.getDoc(likeRef(parkUid));
    return snap.exists();
  } catch (error) { return false; }
}

export async function toggleLike(parkUid) {
  requireSignedIn();
  if (parkUid === current.uid) throw new Error("Liking your own park is a little sad.");
  const ref = likeRef(parkUid);
  const park = parkRef(parkUid);
  return fb.f.runTransaction(fb.db, async (tx) => {
    const [likeSnap, parkSnap] = await Promise.all([tx.get(ref), tx.get(park)]);
    if (!parkSnap.exists()) throw new Error("That park is no longer published.");
    const likes = clampInt(parkSnap.data().likes, 0, 999999);
    if (likeSnap.exists()) {
      tx.delete(ref);
      tx.update(park, { likes: Math.max(0, likes - 1) });
      return { liked: false, likes: Math.max(0, likes - 1) };
    }
    tx.set(ref, { uid: current.uid, name: current.name, at: Date.now() });
    tx.update(park, { likes: likes + 1 });
    return { liked: true, likes: likes + 1 };
  });
}

/* ---------------------------------------------------------------------
   Friends — follow another keeper, and see who follows you.
   --------------------------------------------------------------------- */
export async function follow(toUid) {
  requireSignedIn();
  if (toUid === current.uid) throw new Error("That's your own park.");
  await fb.f.setDoc(fb.f.doc(fb.db, CONFIG.collections.follows, current.uid + "_" + toUid), {
    from: current.uid, to: toUid, name: current.name, at: Date.now()
  });
}

export async function unfollow(toUid) {
  if (!fb || !current || current.guest) return;
  try { await fb.f.deleteDoc(fb.f.doc(fb.db, CONFIG.collections.follows, current.uid + "_" + toUid)); } catch (error) { /* ignore */ }
}

export async function following() {
  if (!fb || !current || current.guest) return [];
  try {
    const snap = await fb.f.getDocs(fb.f.query(fb.f.collection(fb.db, CONFIG.collections.follows), fb.f.where("from", "==", current.uid)));
    return snap.docs.map((d) => ({ ...(d.data() || {}), id: d.id }));
  } catch (error) { return []; }
}

export async function followers() {
  if (!fb || !current || current.guest) return [];
  try {
    const snap = await fb.f.getDocs(fb.f.query(fb.f.collection(fb.db, CONFIG.collections.follows), fb.f.where("to", "==", current.uid)));
    return snap.docs.map((d) => ({ ...(d.data() || {}), id: d.id }));
  } catch (error) { return []; }
}

/* ---------------------------------------------------------------------
   Weekly building competition — one entry per park each week, one vote
   per voter each week. The entry id encodes the week so old weeks never
   collide with new ones.
   --------------------------------------------------------------------- */
const entriesCol = () => fb.f.collection(fb.db, CONFIG.collections.entries);
const votesCol = () => fb.f.collection(fb.db, CONFIG.collections.votes);

export async function submitWeekly(week, snapshot) {
  requireSignedIn();
  const id = `${week}_${current.uid}`;
  const ref = fb.f.doc(entriesCol(), id);
  const existing = await fb.f.getDoc(ref);
  if (existing.exists() && existing.data().locked) return { ok: false, reason: "Your entry is already in this week's contest." };
  await fb.f.setDoc(ref, {
    week,
    uid: current.uid,
    owner: current.name,
    name: String(snapshot.name || "A park").slice(0, 24),
    level: clampInt(snapshot.level, 1, 99),
    rating: clampFloat(snapshot.rating, 1, 5),
    layout: String(snapshot.layout || "{}").slice(0, 220000),
    at: Date.now(),
    votes: clampInt(existing.exists() ? existing.data().votes : 0, 0, 999999)
  }, { merge: true });
  return { ok: true };
}

export async function fetchWeekly(week) {
  await init();
  if (!fb) return [];
  try {
    const snap = await fb.f.getDocs(fb.f.query(entriesCol(), fb.f.where("week", "==", week), fb.f.limit(40)));
    return snap.docs.map((d) => ({ id: d.id, ...(d.data() || {}) }))
      .sort((a, b) => (b.votes || 0) - (a.votes || 0) || (b.rating || 0) - (a.rating || 0));
  } catch (error) { return []; }
}

export async function myWeeklyEntry(week) {
  if (!fb || !current || current.guest) return null;
  try {
    const snap = await fb.f.getDoc(fb.f.doc(entriesCol(), `${week}_${current.uid}`));
    return snap.exists() ? { id: snap.id, ...snap.data() } : null;
  } catch (error) { return null; }
}

export async function voteWeekly(week, toUid) {
  requireSignedIn();
  if (toUid === current.uid) throw new Error("Vote for someone else's park.");
  const id = `${week}_${current.uid}`;
  const ref = fb.f.doc(votesCol(), id);
  const existing = await fb.f.getDoc(ref);
  if (existing.exists()) throw new Error("You have already voted this week.");
  const entryRef = fb.f.doc(entriesCol(), `${week}_${toUid}`);
  await fb.f.runTransaction(fb.db, async (tx) => {
    const entry = await tx.get(entryRef);
    if (!entry.exists()) throw new Error("That entry has gone.");
    const votes = clampInt(entry.data().votes, 0, 999999);
    tx.set(ref, { week, from: current.uid, to: toUid, at: Date.now() });
    tx.update(entryRef, { votes: votes + 1 });
  });
  return true;
}

export async function myWeeklyVote(week) {
  if (!fb || !current || current.guest) return null;
  try {
    const snap = await fb.f.getDoc(fb.f.doc(votesCol(), `${week}_${current.uid}`));
    return snap.exists() ? snap.data().to : null;
  } catch (error) { return null; }
}

/* ---------------------------------------------------------------------
   Helpers
   --------------------------------------------------------------------- */
function requireSignedIn() {
  if (!fb) throw new Error("Online parks aren't reachable right now.");
  if (!current || current.guest) throw new Error("Sign in to use the online park features.");
}

function clampInt(value, min, max) {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, n));
}
function clampFloat(value, min, max) {
  const n = Number(value);
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, Math.round(n * 10) / 10));
}

export function isEmulator() { return !!(fb && fb.emulator); }
