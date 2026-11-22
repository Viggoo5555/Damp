/* =====================================================================
   PET CAFÉ — Firebase
   Accounts (username + password), cloud saves, public café discovery,
   hearts, ratings, friends, presence and the weekly competition.
   Every function fails softly: the café keeps running on this device.
   ===================================================================== */
import { CONFIG, CLOUD_READY } from "./config.js";

const SDK = "../../../vendor/firebase/";
let fb = null;             // { app, a, f, auth, db }
let current = null;        // { uid, name, guest:false }
let authWatcher = null;
let initPromise = null;
let authResolve;
const authSettled = new Promise((resolve) => { authResolve = resolve; });
setTimeout(() => { if (authResolve) authResolve(current); }, 3000);

export function getUser() { return current; }
export function isReady() { return !!fb; }
export function onAuth(fn) { authWatcher = fn; if (current) fn(current); }

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
      fb = { app, a: authMod, f: dbMod, auth, db };
      authMod.onAuthStateChanged(auth, (u) => {
        if (u) {
          current = { uid: u.uid, name: (u.displayName || nameFromMail(u.email) || "Player").slice(0, 20), guest: false };
          if (authWatcher) authWatcher(current);
        } else {
          current = null;
        }
        if (authResolve) { authResolve(current); authResolve = null; }
      });
      return true;
    } catch (error) {
      console.warn("Pet Café: Firebase unavailable — playing on this device.", error);
      fb = null;
      return false;
    }
  })();
  return initPromise;
}

function mailFor(name) {
  const clean = String(name || "").trim().toLowerCase().replace(/[^a-z0-9_]/g, "");
  return clean.indexOf("@") > -1 ? name : clean + CONFIG.mailSuffix;
}
function nameFromMail(mail) {
  return mail && mail.endsWith(CONFIG.mailSuffix) ? mail.slice(0, -CONFIG.mailSuffix.length) : (mail || "");
}

export async function restore() {
  await init();
  if (!fb) return null;
  await Promise.race([authSettled, new Promise((resolve) => setTimeout(resolve, 2600))]);
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
  if (!fb) throw new Error("The cloud isn't available right now. Play as a guest instead.");
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
  current = { uid: cred.user.uid, name: clean.slice(0, 20), guest: false };
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
  if (code === "auth/network-request-failed") return "No connection to the cloud. Try again or play as a guest.";
  if (code === "auth/too-many-requests") return "Too many attempts. Wait a moment and try again.";
  return (error && error.message) || "Something went wrong. Try again.";
}

/* ---------------------------------------------------------------------
   Own save
   --------------------------------------------------------------------- */
function saveRef(uid) { return fb.f.doc(fb.db, CONFIG.collections.saves, uid); }
function publicRef(uid) { return fb.f.doc(fb.db, CONFIG.collections.publicCafes, uid); }

export async function saveGame(state, publicDoc) {
  await init();
  if (!fb || !current || current.guest) return false;
  await fb.f.setDoc(saveRef(current.uid), state, { merge: true });
  await savePublic(publicDoc);
  return true;
}
export async function loadGame(uid) {
  await init();
  if (!fb) return null;
  try {
    const snap = await fb.f.getDoc(saveRef(uid));
    return snap.exists() ? snap.data() : null;
  } catch (error) { return null; }
}
export async function savePublic(doc) {
  if (!fb || !current || current.guest) return false;
  const clean = {
    uid: current.uid,
    name: String(doc.name || current.name).slice(0, 20),
    nameLower: String(doc.nameLower || current.name).toLowerCase().slice(0, 20),
    level: Math.max(1, Math.min(99, doc.level | 0)),
    xp: Math.max(0, doc.xp | 0),
    likes: Math.max(0, doc.likes | 0),
    rating: Math.max(0, Math.min(5, Number(doc.rating) || 0)),
    rep: Math.max(0, Math.min(100, doc.rep | 0)),
    layout: doc.layout,
    animals: doc.animals,
    updated: Date.now()
  };
  await fb.f.setDoc(publicRef(current.uid), clean, { merge: true });
  return true;
}

/* ---------------------------------------------------------------------
   Discovery — real-time listeners
   --------------------------------------------------------------------- */
export function subscribeCafes(callback, onError) {
  if (!fb) return () => {};
  const q = fb.f.query(
    fb.f.collection(fb.db, CONFIG.collections.publicCafes),
    fb.f.orderBy("updated", "desc"),
    fb.f.limit(60)
  );
  return fb.f.onSnapshot(q, (snap) => {
    const rows = [];
    snap.forEach((doc) => {
      const d = doc.data() || {};
      if (d.uid && d.uid !== (current && current.uid)) rows.push({ ...d, uid: doc.id });
    });
    callback(rows);
  }, (error) => { if (onError) onError(error); });
}

export async function fetchCafes() {
  await init();
  if (!fb) return [];
  try {
    const snap = await fb.f.getDocs(fb.f.query(fb.f.collection(fb.db, CONFIG.collections.publicCafes), fb.f.orderBy("updated", "desc"), fb.f.limit(60)));
    const rows = [];
    snap.forEach((doc) => rows.push({ ...(doc.data() || {}), uid: doc.id }));
    return rows;
  } catch (error) { return []; }
}

export async function fetchCafe(uid) {
  await init();
  if (!fb) return null;
  try {
    const snap = await fb.f.getDoc(publicRef(uid));
    return snap.exists() ? { ...snap.data(), uid } : null;
  } catch (error) { return null; }
}

/* ---------------------------------------------------------------------
   Hearts & ratings
   --------------------------------------------------------------------- */
export async function toggleLike(toUid) {
  await init();
  if (!fb || !current || current.guest) throw new Error("Sign in first");
  if (toUid === current.uid) throw new Error("That's your own café");
  const id = toUid + "_" + current.uid;
  const ref = fb.f.doc(fb.db, CONFIG.collections.likes, id);
  const snap = await fb.f.getDoc(ref);
  if (snap.exists()) {
    await fb.f.deleteDoc(ref);
    return false;
  }
  await fb.f.setDoc(ref, { from: current.uid, to: toUid, at: Date.now() });
  return true;
}
export async function hasLiked(toUid) {
  if (!fb || !current || current.guest) return false;
  try {
    const snap = await fb.f.getDoc(fb.f.doc(fb.db, CONFIG.collections.likes, toUid + "_" + current.uid));
    return snap.exists();
  } catch (error) { return false; }
}
export async function countLikes(uid) {
  if (!fb) return 0;
  try {
    const snap = await fb.f.getDocs(fb.f.query(fb.f.collection(fb.db, CONFIG.collections.likes), fb.f.where("to", "==", uid)));
    return snap.size;
  } catch (error) { return 0; }
}
export async function rateCafe(toUid, stars) {
  await init();
  if (!fb || !current || current.guest) throw new Error("Sign in first");
  if (toUid === current.uid) throw new Error("That's your own café");
  await fb.f.setDoc(fb.f.doc(fb.db, CONFIG.collections.ratings, toUid + "_" + current.uid), {
    from: current.uid, to: toUid, stars: Math.max(1, Math.min(5, stars | 0)), at: Date.now()
  });
}
export async function myRating(toUid) {
  if (!fb || !current || current.guest) return 0;
  try {
    const snap = await fb.f.getDoc(fb.f.doc(fb.db, CONFIG.collections.ratings, toUid + "_" + current.uid));
    return snap.exists() ? snap.data().stars || 0 : 0;
  } catch (error) { return 0; }
}

/* ---------------------------------------------------------------------
   Friends (mutual follows)
   --------------------------------------------------------------------- */
export async function follow(toUid) {
  await init();
  if (!fb || !current || current.guest) throw new Error("Sign in first");
  if (toUid === current.uid) throw new Error("That's you");
  await fb.f.setDoc(fb.f.doc(fb.db, CONFIG.collections.follows, current.uid + "_" + toUid), {
    from: current.uid, to: toUid, at: Date.now(), name: current.name
  });
}
export async function unfollow(toUid) {
  if (!fb || !current || current.guest) return;
  await fb.f.deleteDoc(fb.f.doc(fb.db, CONFIG.collections.follows, current.uid + "_" + toUid));
}
export async function following() {
  if (!fb || !current || current.guest) return [];
  try {
    const snap = await fb.f.getDocs(fb.f.query(fb.f.collection(fb.db, CONFIG.collections.follows), fb.f.where("from", "==", current.uid)));
    return snap.docs.map((d) => ({ ...d.data(), id: d.id }));
  } catch (error) { return []; }
}
export async function followers() {
  if (!fb || !current || current.guest) return [];
  try {
    const snap = await fb.f.getDocs(fb.f.query(fb.f.collection(fb.db, CONFIG.collections.follows), fb.f.where("to", "==", current.uid)));
    return snap.docs.map((d) => ({ ...d.data(), id: d.id }));
  } catch (error) { return []; }
}
export async function friendCafes(uids) {
  if (!fb || !uids.length) return [];
  try {
    const reads = uids.map((uid) => fb.f.getDoc(publicRef(uid)).then((snap) => snap.exists() ? { ...snap.data(), uid } : null).catch(() => null));
    return (await Promise.all(reads)).filter(Boolean);
  } catch (error) { return []; }
}
export async function presence() {
  if (!fb || !current || current.guest) return;
  try {
    await fb.f.setDoc(fb.f.doc(fb.db, CONFIG.collections.presence, current.uid), {
      name: current.name, online: true, at: Date.now()
    });
  } catch (error) { /* presence is a nicety */ }
}
export async function presenceOf(uids) {
  if (!fb || !uids.length) return {};
  const out = {};
  await Promise.all(uids.map(async (uid) => {
    try {
      const snap = await fb.f.getDoc(fb.f.doc(fb.db, CONFIG.collections.presence, uid));
      if (snap.exists()) out[uid] = snap.data();
    } catch (error) { /* ignore */ }
  }));
  return out;
}

/* ---------------------------------------------------------------------
   Weekly competition
   --------------------------------------------------------------------- */
export function weekKey(date = new Date()) {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
  return d.getUTCFullYear() + "-W" + String(week).padStart(2, "0");
}

export async function enterCompetition(week, publicDoc) {
  await init();
  if (!fb || !current || current.guest) throw new Error("Sign in first");
  await fb.f.setDoc(fb.f.doc(fb.db, CONFIG.collections.entries, week + "_" + current.uid), {
    uid: current.uid, name: current.name, level: publicDoc.level || 1,
    week, layout: publicDoc.layout, animals: publicDoc.animals, at: Date.now()
  });
  await presence();
}
export async function listEntries(week) {
  await init();
  if (!fb) return [];
  try {
    const snap = await fb.f.getDocs(fb.f.query(fb.f.collection(fb.db, CONFIG.collections.entries), fb.f.where("week", "==", week)));
    return snap.docs.map((d) => ({ ...d.data(), id: d.id }));
  } catch (error) { return []; }
}
export function subscribeEntries(week, callback) {
  if (!fb) return () => {};
  const q = fb.f.query(fb.f.collection(fb.db, CONFIG.collections.entries), fb.f.where("week", "==", week));
  return fb.f.onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ ...d.data(), id: d.id })));
  }, () => {});
}
export async function listVotes(week) {
  if (!fb) return [];
  try {
    const snap = await fb.f.getDocs(fb.f.query(fb.f.collection(fb.db, CONFIG.collections.votes), fb.f.where("week", "==", week)));
    return snap.docs.map((d) => ({ ...d.data(), id: d.id }));
  } catch (error) { return []; }
}
export async function hasVoted(week) {
  if (!fb || !current || current.guest) return false;
  try {
    const snap = await fb.f.getDoc(fb.f.doc(fb.db, CONFIG.collections.votes, week + "_" + current.uid));
    return snap.exists();
  } catch (error) { return false; }
}
export async function voteCompetition(week, toUid) {
  await init();
  if (!fb || !current || current.guest) throw new Error("Sign in first");
  if (toUid === current.uid) throw new Error("You cannot vote for yourself");
  const ref = fb.f.doc(fb.db, CONFIG.collections.votes, week + "_" + current.uid);
  const snap = await fb.f.getDoc(ref);
  if (snap.exists()) {
    const error = new Error("Already voted");
    error.code = "already-voted";
    throw error;
  }
  await fb.f.setDoc(ref, { from: current.uid, to: toUid, week, at: Date.now() });
}
