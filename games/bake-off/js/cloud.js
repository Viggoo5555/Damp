/* =====================================================================
   BAKE OFF! — Firebase
   Accounts, cloud saves, matchmaking, live matches, voting, friends,
   invitations and the leaderboard. Every network call fails softly so
   the game stays playable as a guest on one device.
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

/* ---------------------------------------------------------------------
   Boot
   --------------------------------------------------------------------- */
function emulatorTarget() {
  try {
    const params = new URLSearchParams(location.search);
    const target = params.get("emulator") || localStorage.getItem("bake-off-emulator");
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
            name: (u.displayName || nameFromMail(u.email) || "Baker").slice(0, 20),
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
      console.warn("Bake Off: Firebase unavailable — the practice kitchen still works.", error);
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
  if (!fb) throw new Error("The online kitchen isn't reachable right now. You can bake as a guest.");
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
  if (code === "auth/network-request-failed") return "No connection to the kitchen. Try again or play solo.";
  if (code === "auth/too-many-requests") return "Too many attempts. Wait a moment and try again.";
  return (error && error.message) || "Something went wrong. Try again.";
}

/* ---------------------------------------------------------------------
   Profile & leaderboard
   --------------------------------------------------------------------- */
const savesRef = () => fb.f.doc(fb.db, CONFIG.collections.saves, current.uid);
const profileRef = (uid) => fb.f.doc(fb.db, CONFIG.collections.profiles, uid);

export async function saveProfile(packed) {
  await init();
  if (!fb || !current || current.guest) return false;
  const clean = sanitizeProfile(packed);
  await fb.f.setDoc(savesRef(), { ...clean, uid: current.uid, updated: Date.now() }, { merge: false });
  await publishProfile(clean);
  return true;
}

function sanitizeProfile(p) {
  return {
    name: String(p.name || current.name).slice(0, 20),
    coins: clampInt(p.coins, 0, 9999999),
    xp: clampInt(p.xp, 0, 9999999),
    recipes: p.recipes || {},
    plates: p.plates || {},
    toppings: p.toppings || {},
    hats: p.hats || {},
    aprons: p.aprons || {},
    hairs: p.hairs || {},
    skins: p.skins || {},
    kitchens: p.kitchens || {},
    equipment: p.equipment || {},
    equipped: p.equipped || {},
    stats: p.stats || {},
    achievements: p.achievements || {},
    daily: p.daily || {},
    weekly: p.weekly || {},
    dailyReward: p.dailyReward || {},
    history: (p.history || []).slice(0, 12).map((h) => ({
      at: h.at, theme: h.theme, recipe: h.recipe, score: h.score, rank: h.rank,
      total: h.total, online: !!h.online
    })),
    settings: p.settings || {},
    createdAt: p.createdAt || Date.now()
  };
}

export async function loadProfile(uid) {
  await init();
  if (!fb) return null;
  try {
    const snap = await fb.f.getDoc(fb.f.doc(fb.db, CONFIG.collections.saves, uid));
    return snap.exists() ? snap.data() : null;
  } catch (error) { return null; }
}

export async function publishProfile(profile) {
  if (!fb || !current || current.guest) return false;
  const pub = {
    uid: current.uid,
    name: String(profile.name || current.name).slice(0, 20),
    level: Math.max(1, Math.min(99, Math.floor((profile.xp || 0) / 100))),
    xp: clampInt(profile.xp, 0, 9999999),
    wins: clampInt(profile.stats && profile.stats.wins, 0, 99999),
    matches: clampInt(profile.stats && profile.stats.matches, 0, 99999),
    bestScore: clampInt(profile.stats && profile.stats.bestScore, 0, 200),
    chef: profile.equipped || {},
    updated: Date.now()
  };
  try { await fb.f.setDoc(profileRef(current.uid), pub, { merge: true }); } catch (error) { /* leaderboard is a nicety */ }
  return true;
}

export function subscribeLeaderboard(callback) {
  if (!fb) return () => {};
  const q = fb.f.query(fb.f.collection(fb.db, CONFIG.collections.profiles), fb.f.orderBy("xp", "desc"), fb.f.limit(25));
  return fb.f.onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ ...(d.data() || {}), uid: d.id })));
  }, () => {});
}

export async function fetchTopPlayers() {
  await init();
  if (!fb) return [];
  try {
    const snap = await fb.f.getDocs(fb.f.query(fb.f.collection(fb.db, CONFIG.collections.profiles), fb.f.orderBy("xp", "desc"), fb.f.limit(25)));
    return snap.docs.map((d) => ({ ...(d.data() || {}), uid: d.id }));
  } catch (error) { return []; }
}

/* ---------------------------------------------------------------------
   Presence
   --------------------------------------------------------------------- */
export async function presence(state = "lobby") {
  if (!fb || !current || current.guest) return;
  try {
    await fb.f.setDoc(fb.f.doc(fb.db, CONFIG.collections.presence, current.uid), {
      name: current.name, state, at: Date.now()
    }, { merge: true });
  } catch (error) { /* nicety */ }
}

/* ---------------------------------------------------------------------
   Friends (mutual follows) and invitations
   --------------------------------------------------------------------- */
export async function follow(toUid) {
  requireSignedIn();
  if (toUid === current.uid) throw new Error("That's you");
  await fb.f.setDoc(fb.f.doc(fb.db, CONFIG.collections.follows, current.uid + "_" + toUid), {
    from: current.uid, to: toUid, name: current.name, at: Date.now()
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

export async function inviteFriend(toUid, matchId, code, themeName) {
  requireSignedIn();
  if (toUid === current.uid) throw new Error("Invite someone else");
  await fb.f.setDoc(fb.f.doc(fb.db, CONFIG.collections.invites, toUid), {
    from: current.uid, fromName: current.name, matchId, code,
    theme: String(themeName || ""), at: Date.now()
  });
}

export function subscribeInvites(callback) {
  if (!fb || !current || current.guest) return () => {};
  return fb.f.onSnapshot(fb.f.doc(fb.db, CONFIG.collections.invites, current.uid), (snap) => {
    callback(snap.exists() ? snap.data() : null);
  }, () => {});
}

export async function clearInvite() {
  if (!fb || !current || current.guest) return;
  try { await fb.f.deleteDoc(fb.f.doc(fb.db, CONFIG.collections.invites, current.uid)); } catch (error) { /* ignore */ }
}

/* ---------------------------------------------------------------------
   Matches
   --------------------------------------------------------------------- */
function requireSignedIn() {
  if (!fb) throw new Error("The online kitchen isn't reachable right now.");
  if (!current || current.guest) throw new Error("Sign in to play with other bakers.");
}
const matchesRef = () => fb.f.collection(fb.db, CONFIG.collections.matches);
const matchRef = (id) => fb.f.doc(fb.db, CONFIG.collections.matches, id);

export function makeCode(seed) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let n = Math.abs(seed || Date.now());
  let out = "";
  for (let i = 0; i < 6; i++) { out += alphabet[n % alphabet.length]; n = Math.floor(n / alphabet.length) + 7; }
  return out;
}

function playerEntry(extra = {}) {
  return {
    name: current.name,
    level: 1,
    chef: {},
    joinedAt: Date.now(),
    at: Date.now(),
    ready: false,
    readyPhase: "",
    score: 0,
    design: "",
    left: false,
    ...extra
  };
}

export async function createRoom(opts = {}) {
  requireSignedIn();
  const ref = fb.f.doc(matchesRef());
  const code = opts.code || makeCode(parseInt(ref.id.slice(-6), 36) || Date.now());
  const themeSeed = opts.themeSeed || Math.random().toString(36).slice(2, 10);
  const doc = {
    code,
    public: opts.public !== false,
    hostUid: current.uid,
    createdAt: Date.now(),
    phase: "lobby",
    phaseEndsAt: 0,
    seq: 0,
    themeId: "",
    themeSeed,
    players: { [current.uid]: playerEntry({ ...(opts.entry || {}) }) },
    results: ""
  };
  await fb.f.setDoc(ref, doc);
  return { matchId: ref.id, code, public: doc.public };
}

export async function joinMatch(matchId) {
  requireSignedIn();
  await fb.f.runTransaction(fb.db, async (tx) => {
    const snap = await tx.get(matchRef(matchId));
    if (!snap.exists()) throw new Error("That kitchen has closed.");
    const data = snap.data();
    const players = data.players || {};
    if (players[current.uid]) return data;
    if (data.phase !== "lobby") throw new Error("That match has already started.");
    if (Object.keys(players).length >= CONFIG.maxPlayers) throw new Error("That kitchen is full.");
    const entry = playerEntry();
    tx.update(matchRef(matchId), { players: { ...players, [current.uid]: entry } });
    return { ...data, players: { ...players, [current.uid]: entry } };
  });
  return matchId;
}

export async function joinByCode(rawCode) {
  requireSignedIn();
  const code = String(rawCode || "").trim().toUpperCase();
  if (code.length < 4) throw new Error("Room codes are six characters.");
  const q = fb.f.query(matchesRef(), fb.f.where("code", "==", code), fb.f.where("phase", "==", "lobby"), fb.f.limit(4));
  const snap = await fb.f.getDocs(q);
  if (snap.empty) throw new Error("No open kitchen with that code.");
  let best = null;
  snap.forEach((doc) => {
    const d = doc.data();
    const count = Object.keys(d.players || {}).length;
    if (!best || count < best.count) best = { id: doc.id, count };
  });
  if (!best) throw new Error("No open kitchen with that code.");
  await joinMatch(best.id);
  return best.id;
}

export async function quickMatch() {
  requireSignedIn();
  const q = fb.f.query(matchesRef(), fb.f.where("public", "==", true), fb.f.where("phase", "==", "lobby"), fb.f.limit(8));
  const snap = await fb.f.getDocs(q);
  const open = snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((m) => Object.keys(m.players || {}).length < CONFIG.maxPlayers && !(m.players || {})[current.uid])
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  for (const match of open) {
    try {
      await joinMatch(match.id);
      return { matchId: match.id, code: match.code, created: false };
    } catch (error) {
      if (/full|started|closed/i.test(error.message)) continue;
      throw error;
    }
  }
  const room = await createRoom({ public: true });
  return { ...room, created: true };
}

export async function leaveMatch(matchId) {
  if (!fb || !current || current.guest) return;
  try {
    await fb.f.updateDoc(matchRef(matchId), {
      [`players.${current.uid}.left`]: true,
      [`players.${current.uid}.at`]: Date.now()
    });
  } catch (error) { /* the match may be gone */ }
}

/* `phase` doubles as the ready flag: a player is ready for the phase they
   tapped ready in, so stale readiness never carries into the next round. */
export async function setReady(matchId, phase) {
  requireSignedIn();
  try {
    await fb.f.updateDoc(matchRef(matchId), {
      [`players.${current.uid}.ready`]: !!phase,
      [`players.${current.uid}.readyPhase`]: String(phase || ""),
      [`players.${current.uid}.at`]: Date.now()
    });
  } catch (error) { /* permission or missing */ }
}

/* If the host disconnects, the earliest remaining baker can take over.
   The rules only allow this when the current host is stale. */
export async function claimHost(matchId) {
  requireSignedIn();
  try {
    await fb.f.updateDoc(matchRef(matchId), { hostUid: current.uid });
    return true;
  } catch (error) { return false; }
}

export async function heartbeat(matchId) {
  if (!fb || !current || current.guest) return;
  try {
    await fb.f.updateDoc(matchRef(matchId), {
      [`players.${current.uid}.at`]: Date.now(),
      [`players.${current.uid}.name`]: current.name
    });
  } catch (error) { /* ignore */ }
}

export async function submitDesign(matchId, design, score) {
  requireSignedIn();
  const packed = JSON.stringify(design);
  if (packed.length > 2400) throw new Error("That cake is too complicated to send.");
  await fb.f.updateDoc(matchRef(matchId), {
    [`players.${current.uid}.design`]: packed,
    [`players.${current.uid}.score`]: clampInt(score, 0, 200),
    [`players.${current.uid}.at`]: Date.now()
  });
}

export async function startMatch(matchId, themeId, seconds) {
  requireSignedIn();
  await fb.f.updateDoc(matchRef(matchId), {
    phase: "theme",
    phaseEndsAt: Date.now() + (seconds || 7) * 1000,
    themeId,
    seq: Date.now(),
    startedAt: Date.now()
  });
}

export async function advancePhase(matchId, phase, seconds) {
  requireSignedIn();
  try {
    await fb.f.updateDoc(matchRef(matchId), {
      phase,
      phaseEndsAt: Date.now() + Math.max(0, seconds || 0) * 1000,
      seq: Date.now()
    });
  } catch (error) {
    // If the rules refuse (not host and not past the deadline) another
    // client will move the match on. Nothing to do here.
  }
}

export async function resetMatch(matchId) {
  requireSignedIn();
  await fb.f.updateDoc(matchRef(matchId), {
    phase: "lobby", phaseEndsAt: 0, themeId: "", results: "", seq: Date.now()
  });
}

/* ---------------------------------------------------------------------
   Live match subscription
   --------------------------------------------------------------------- */
export function subscribeMatch(matchId, callback, onError) {
  if (!fb) return () => {};
  let beat = null;
  const unsub = fb.f.onSnapshot(matchRef(matchId), (snap) => {
    if (!snap.exists()) {
      callback(null);
      return;
    }
    const data = { id: snap.id, ...snap.data() };
    callback(normalizeMatch(data), data);
    if (!beat) beat = setInterval(() => heartbeat(matchId), 5000);
  }, (error) => {
    if (onError) onError(error);
  });
  return () => {
    if (beat) clearInterval(beat);
    try { unsub(); } catch (error) { /* ignore */ }
  };
}

function normalizeMatch(data) {
  const players = Object.entries(data.players || {}).map(([uid, p]) => {
    let design = null;
    if (p.design) {
      try { design = JSON.parse(p.design); } catch (error) { design = null; }
    }
    const stale = Date.now() - (p.at || 0) > 14000;
    return {
      uid,
      name: p.name || "Baker",
      level: p.level || 1,
      chef: p.chef || {},
      ready: !!p.ready,
      readyPhase: p.readyPhase || "",
      score: p.score || 0,
      design,
      online: !stale && !p.left,
      left: !!p.left,
      away: stale && !p.left,
      isMe: !!(current && uid === current.uid),
      isHost: uid === data.hostUid,
      joinedAt: p.joinedAt || 0
    };
  }).sort((a, b) => (a.isHost ? -1 : b.isHost ? 1 : (a.name || "").localeCompare(b.name || "")));
  return {
    id: data.id,
    code: data.code,
    public: !!data.public,
    hostUid: data.hostUid,
    phase: data.phase || "lobby",
    phaseEndsAt: data.phaseEndsAt || 0,
    themeId: data.themeId || "",
    themeSeed: data.themeSeed || "",
    players,
    count: players.length,
    secs: Math.max(0, Math.round(((data.phaseEndsAt || 0) - Date.now()) / 1000)),
    startedAt: data.startedAt || 0
  };
}

export async function fetchMatch(matchId) {
  await init();
  if (!fb) return null;
  try {
    const snap = await fb.f.getDoc(matchRef(matchId));
    return snap.exists() ? normalizeMatch({ id: snap.id, ...snap.data() }) : null;
  } catch (error) { return null; }
}

/* ---------------------------------------------------------------------
   Votes — one document per voter, created once, never for yourself.
   --------------------------------------------------------------------- */
export function subscribeVotes(matchId, callback) {
  if (!fb) return () => {};
  return fb.f.onSnapshot(fb.f.collection(fb.db, CONFIG.collections.matches, matchId, "votes"), (snap) => {
    const votes = {};
    snap.forEach((doc) => {
      const d = doc.data() || {};
      if (d.from && d.to) votes[d.from] = d.to;
    });
    callback(votes);
  }, () => {});
}

export async function castVote(matchId, toUid) {
  requireSignedIn();
  if (toUid === current.uid) throw new Error("You cannot vote for yourself.");
  const ref = fb.f.doc(fb.db, CONFIG.collections.matches, matchId, "votes", current.uid);
  const existing = await fb.f.getDoc(ref);
  if (existing.exists()) throw new Error("You have already voted in this match.");
  await fb.f.setDoc(ref, { from: current.uid, to: toUid, at: Date.now() });
}

export async function fetchVotes(matchId) {
  if (!fb) return {};
  try {
    const snap = await fb.f.getDocs(fb.f.collection(fb.db, CONFIG.collections.matches, matchId, "votes"));
    const votes = {};
    snap.forEach((doc) => { const d = doc.data() || {}; if (d.from && d.to) votes[d.from] = d.to; });
    return votes;
  } catch (error) { return {}; }
}

/* ---------------------------------------------------------------------
   Reward claims — one per account per match.
   --------------------------------------------------------------------- */
export async function claimMatchReward(matchId) {
  requireSignedIn();
  const id = matchId + "_" + current.uid;
  const ref = fb.f.doc(fb.db, CONFIG.collections.claims, id);
  try {
    const snap = await fb.f.getDoc(ref);
    if (snap.exists()) return false;
    await fb.f.setDoc(ref, { uid: current.uid, matchId, at: Date.now() });
    return true;
  } catch (error) {
    return false;
  }
}

export async function hasClaimed(matchId) {
  if (!fb || !current || current.guest) return false;
  try {
    const snap = await fb.f.getDoc(fb.f.doc(fb.db, CONFIG.collections.claims, matchId + "_" + current.uid));
    return snap.exists();
  } catch (error) { return false; }
}

/* ---------------------------------------------------------------------
   Small helpers
   --------------------------------------------------------------------- */
function clampInt(value, min, max) {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, n));
}

export function matchAge(match) {
  if (!match || !match.phaseEndsAt) return 0;
  return Math.max(0, Math.round((match.phaseEndsAt - Date.now()) / 1000));
}

export function isEmulator() { return !!(fb && fb.emulator); }
