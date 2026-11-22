/* =====================================================================
   DREAM PARK — rules of the park
   Money, building, paths, visitors, queues, rides running, shops selling,
   staff, ratings, days, XP, research, challenges and achievements.
   ===================================================================== */
import { CONFIG } from "./config.js";
import {
  GRID, RIDES, BUILDINGS, DECOR, PATHS, STAFF, RESEARCH, DAILY, WEEKLY,
  ACHIEVEMENTS, RIDE_BY_ID, BUILDING_BY_ID, DECOR_BY_ID, PATH_BY_ID,
  DEF_BY_ID, levelFromXp, xpForLevel, xpToNext, LAND_STEPS, LAND_PRICES,
  START_TILES, GUEST_NAMES, GUEST_COLORS, GUEST_SHIRTS
} from "./data.js";
import { simulatePlan } from "./coaster.js";

const STORE = CONFIG.storageKey;
const T = GRID.tile;
const CX = (GRID.w - 1) / 2;
const CZ = (GRID.h - 1) / 2;
const ENTRANCE_TILE = { i: Math.floor(GRID.w / 2), j: GRID.h - 2 };
const SPAWN_TILE = { i: Math.floor(GRID.w / 2), j: GRID.h - 3 };

export const tileKey = (i, j) => i + "," + j;
export const tileCenter = (i, j) => ({ x: (i - CX) * T, z: (j - CZ) * T });
export const defOf = (id) => DEF_BY_ID[id];
export const kindOf = (def) => (def.fun !== undefined ? "ride" : def.kind ? "building" : "decor");

/* ---------------------------------------------------------------------
   State
   --------------------------------------------------------------------- */
function defaultState() {
  return {
    v: 1,
    uid: null,
    name: "Sunny Meadows",
    createdAt: Date.now(),
    coins: CONFIG.startCoins,
    xp: 0,
    level: 1,
    land: START_TILES,
    research: [],
    researchPoints: 0,
    open: false,
    ticket: 25,
    ridePrice: {},
    shopMarkup: 1,
    objects: [],
    paths: [],
    staff: { mechanic: 0, cleaner: 0, entertainer: 0, security: 0, operator: 0 },
    rideState: {},
    stats: {
      visitorsServed: 0, ridesBuilt: 0, decorPlaced: 0, coastersBuilt: 0,
      income: 0, expenses: 0, bestRating: 0, likes: 0, days: 0,
      bestDayIncome: 0, staffHired: 0, researchDone: 0
    },
    day: 1,
    dayProgress: 0,
    dayIncome: 0,
    dayExpense: 0,
    dayServed: 0,
    dayBuilt: 0,
    dayDecor: 0,
    dayRating: 0,
    week: weekKey(),
    weekServed: 0,
    weekIncome: 0,
    weekDecor: 0,
    servedRating: 0,
    ratingsCount: 0,
    daily: { date: dayKey(), done: {}, claimed: {} },
    weekly: { key: weekKey(), done: {}, claimed: {} },
    achievements: {},
    researchLog: [],
    history: [],
    likes: 0,
    rating: 3,
    settings: { sound: true, quality: "high" },
    lastSeen: Date.now()
  };
}

export const S = defaultState();

export const runtime = {
  started: false,
  mode: "park",          // park | visit
  visiting: null,        // { name, layout, owner } when visiting another park
  visitors: [],
  visitorSeq: 0,
  tool: null,            // { kind, typeId, rot }
  selectedId: null,
  staffMeshes: [],
  time: 0,
  spawnTimer: 2,
  hudTimer: 0,
  dirtyTimer: 0,
  cleanliness: 92,
  happinessAvg: 4.2,
  hall: { demand: 1 },
  coasterDraft: null
};

export const hooks = {
  onHud: null, onToast: null, onSave: null, onState: null, onLevel: null,
  onDay: null, onVisitors: null, onOpenChange: null, onRating: null, onAchievement: null
};
export function setHooks(next) { Object.assign(hooks, next); }

export function toast(title, text, kind = "info") { if (hooks.onToast) hooks.onToast(title, text, kind); }
export function level() { return levelFromXp(S.xp); }
export function xpNeed() { return xpToNext(S.xp); }
export function rating() { return Math.round(S.rating * 10) / 10; }
export function isUnlocked(def) {
  if (!def) return false;
  if (RESEARCH.some((r) => S.research.includes(r.id) && unlockMap[r.id] && unlockMap[r.id].includes(def.id))) return true;
  return (def.level || 1) <= level();
}

const unlockMap = {
  thrills: ["drop-tower", "star-flyer", "pirate-ship"],
  water: ["water-slide", "splash-battle", "rapids"],
  coasters: ["custom-coaster", "mine-coaster"],
  food: ["restaurant", "pizza", "churros"],
  decor: ["fountain", "statue", "pond", "tree-blossom", "topiary"],
  comfort: ["toilet"]
};

/* ---------------------------------------------------------------------
   Local storage
   --------------------------------------------------------------------- */
export function serialize() {
  return {
    v: S.v, uid: S.uid, name: S.name, createdAt: S.createdAt, coins: Math.round(S.coins), xp: Math.round(S.xp),
    level: S.level, land: S.land, research: S.research, researchPoints: S.researchPoints,
    open: S.open, ticket: S.ticket, ridePrice: S.ridePrice, shopMarkup: S.shopMarkup,
    objects: S.objects, paths: S.paths, staff: S.staff, rideState: S.rideState,
    stats: S.stats, day: S.day, dayProgress: S.dayProgress,
    dayIncome: S.dayIncome, dayExpense: S.dayExpense, dayServed: S.dayServed,
    dayBuilt: S.dayBuilt, dayDecor: S.dayDecor, dayRating: S.dayRating,
    week: S.week, weekServed: S.weekServed, weekIncome: S.weekIncome, weekDecor: S.weekDecor,
    servedRating: S.servedRating, ratingsCount: S.ratingsCount,
    daily: S.daily, weekly: S.weekly, achievements: S.achievements,
    researchLog: S.researchLog, history: S.history, likes: S.likes, rating: S.rating,
    settings: S.settings, lastSeen: Date.now()
  };
}

export function saveLocal(now = false) {
  const write = () => {
    try { localStorage.setItem(STORE, JSON.stringify(serialize())); } catch (err) { /* quota */ }
    if (hooks.onSave) hooks.onSave(serialize());
  };
  if (now) { write(); runtime.dirtyTimer = 0; return; }
  runtime.dirtyTimer = 2.5;
}

export function hasSave() {
  try { return !!localStorage.getItem(STORE); } catch (err) { return false; }
}

export function readLocal() {
  try { const raw = localStorage.getItem(STORE); return raw ? JSON.parse(raw) : null; } catch (err) { return null; }
}

export function loadState(data) {
  if (!data) return false;
  Object.assign(S, defaultState(), data);
  S.staff = { mechanic: 0, cleaner: 0, entertainer: 0, security: 0, operator: 0, ...(data.staff || {}) };
  S.stats = { ...defaultState().stats, ...(data.stats || {}) };
  S.objects = (data.objects || []).map((o) => ({ ...o }));
  S.paths = (data.paths || []).map((p) => ({ ...p }));
  S.rideState = data.rideState || {};
  S.daily = data.daily || { date: dayKey(), done: {}, claimed: {} };
  S.weekly = data.weekly || { key: weekKey(), done: {}, claimed: {} };
  S.achievements = data.achievements || {};
  S.settings = { sound: true, quality: "high", ...(data.settings || {}) };
  S.level = levelFromXp(S.xp);
  runtime.visitors = [];
  const decorPieces = S.objects.filter((o) => kindOf(defOf(o.type)) === "decor").length;
  runtime.cleanliness = 88 + Math.min(10, decorPieces * 0.5);
  if (hooks.onState) hooks.onState();
  refreshDaily();
  computeRating();
  return true;
}

/* ---------------------------------------------------------------------
   A brand new park
   --------------------------------------------------------------------- */
export function newPark(name) {
  Object.assign(S, defaultState());
  S.name = String(name || "Sunny Meadows").slice(0, 24);
  S.uid = null;
  S.paths = [];
  const col = (i, j0, j1, type = "path") => { for (let j = j0; j <= j1; j++) S.paths.push({ i, j, type }); };
  const row = (j, i0, i1, type = "plaza") => { for (let i = i0; i <= i1; i++) S.paths.push({ i, j, type }); };
  col(13, 13, 22);
  row(18, 9, 17);
  row(13, 9, 17);
  col(9, 13, 18);
  col(17, 13, 18);
  addPrebuilt("carousel", 10, 15, 0);
  addPrebuilt("burger", 15, 16, 0);
  addPrebuilt("bench", 10, 14, 0);
  addPrebuilt("bench", 14, 19, 0);
  addPrebuilt("tree-oak", 8, 15, 0);
  addPrebuilt("tree-pine", 18, 14, 0);
  addPrebuilt("flowers", 8, 19, 0);
  addPrebuilt("bin", 16, 18, 0);
  S.coins = CONFIG.startCoins;
  S.stats.ridesBuilt = 1;
  runtime.cleanliness = 94;
  computeRating();
  saveLocal(true);
  if (hooks.onState) hooks.onState();
  return S;
}

function addPrebuilt(type, i, j, rot) {
  const def = defOf(type);
  if (!def) return;
  const [w, h] = def.size;
  S.objects.push({ id: "o" + (Date.now().toString(36)) + Math.random().toString(36).slice(2, 5), type, i, j, w, h, rot: rot || 0 });
}

/* ---------------------------------------------------------------------
   Land & placement
   --------------------------------------------------------------------- */
export function inLand(i, j) {
  return Math.abs(i - CX) <= S.land && Math.abs(j - CZ) <= S.land && i >= 0 && j >= 0 && i < GRID.w && j < GRID.h;
}

export function footprint(o) {
  const tiles = [];
  for (let x = 0; x < o.w; x++) for (let z = 0; z < o.h; z++) tiles.push({ i: o.i + x, j: o.j + z });
  return tiles;
}

export function occupiedMap(ignoreId) {
  const map = new Map();
  S.paths.forEach((p) => map.set(tileKey(p.i, p.j), { kind: "path" }));
  S.objects.forEach((o) => {
    if (o.id === ignoreId) return;
    footprint(o).forEach((t) => map.set(tileKey(t.i, t.j), { kind: "object", id: o.id }));
  });
  return map;
}

export function rotationSize(def, rot) {
  return rot % 2 === 1 ? [def.size[1], def.size[0]] : def.size;
}

export function canPlace(type, i, j, rot = 0, ignoreId = null) {
  const def = defOf(type);
  if (!def) return { ok: false, reason: "Unknown item" };
  if (!isUnlocked(def)) return { ok: false, reason: "Not unlocked yet" };
  const [w, h] = rotationSize(def, rot);
  if (i < 0 || j < 0 || i + w > GRID.w || j + h > GRID.h) return { ok: false, reason: "Outside the park" };
  for (let x = 0; x < w; x++) for (let z = 0; z < h; z++) {
    if (!inLand(i + x, j + z)) return { ok: false, reason: "Buy more land first" };
    if (j + z >= GRID.h - 3) return { ok: false, reason: "Keep the entrance clear" };
  }
  const map = occupiedMap(ignoreId);
  for (let x = 0; x < w; x++) for (let z = 0; z < h; z++) {
    const at = map.get(tileKey(i + x, j + z));
    if (at) return { ok: false, reason: at.kind === "path" ? "There is a path here" : "Something is already here" };
  }
  if (kindOf(def) === "ride" && S.objects.filter((o) => kindOf(defOf(o.type)) === "ride").length >= 30) return { ok: false, reason: "Ride limit reached" };
  return { ok: true, w, h };
}

export function placeObject(type, i, j, rot = 0, opts = {}) {
  const def = defOf(type);
  const check = canPlace(type, i, j, rot);
  if (!check.ok) return { ok: false, reason: check.reason };
  const cost = opts.free ? 0 : priceOf(def);
  if (!opts.free && S.coins < cost) return { ok: false, reason: "Not enough coins" };
  const id = "o" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
  const obj = { id, type, i, j, w: check.w, h: check.h, rot, plan: opts.plan || null };
  S.objects.push(obj);
  if (!opts.free) {
    S.coins -= cost;
    S.dayExpense += cost;
    S.stats.expenses += cost;
  }
  if (kindOf(def) === "ride") {
    S.rideState[id] = { condition: 100, broken: false, queue: [], riders: [], phase: "idle", timer: 0, served: 0, phaseT: 0 };
    S.stats.ridesBuilt += 1;
    S.dayBuilt += 1;
    if (def.id === "custom-coaster") S.stats.coastersBuilt += 1;
    addXp(Math.round(cost / 420) + 8);
  } else if (kindOf(def) === "building") {
    S.dayBuilt += 1;
    addXp(Math.round(cost / 500) + 4);
  } else {
    S.stats.decorPlaced += 1;
    S.dayDecor += 1;
    S.weekDecor += 1;
    addXp(Math.max(1, Math.round(cost / 700)));
  }
  saveLocal();
  computeRating();
  checkAchievements();
  refreshChallenges();
  return { ok: true, object: obj, cost };
}

export function priceOf(def) {
  if (!def) return 0;
  let p = def.price;
  if (def.id === "custom-coaster") p = 18000;
  return p;
}

export function removeObject(id) {
  const idx = S.objects.findIndex((o) => o.id === id);
  if (idx < 0) return { ok: false };
  const obj = S.objects[idx];
  const def = defOf(obj.type);
  S.objects.splice(idx, 1);
  delete S.rideState[id];
  // riders on a removed ride find themselves at the entrance
  runtime.visitors.forEach((v) => { if (v.rideId === id) { v.rideId = null; v.state = "idle"; v.timer = 0.5; if (v.mesh) v.mesh.group.visible = true; } });
  const refund = Math.round(priceOf(def) * 0.45);
  S.coins += refund;
  if (kindOf(def) === "decor") S.stats.decorPlaced = Math.max(0, S.stats.decorPlaced - 1);
  saveLocal();
  computeRating();
  return { ok: true, refund };
}

export function moveObject(id, i, j, rot) {
  const obj = S.objects.find((o) => o.id === id);
  if (!obj) return { ok: false, reason: "Not found" };
  const r = rot === undefined ? obj.rot : rot;
  const check = canPlace(obj.type, i, j, r, id);
  if (!check.ok) return check;
  obj.i = i; obj.j = j; obj.rot = r; obj.w = check.w; obj.h = check.h;
  saveLocal();
  return { ok: true, object: obj };
}

/* ---------------------------------------------------------------------
   Paths
   --------------------------------------------------------------------- */
export function setPath(i, j, type = "path") {
  const def = PATH_BY_ID[type] || PATHS[0];
  if (!inLand(i, j) || j >= GRID.h - 3) return { ok: false, reason: "Outside your land" };
  if (S.paths.some((p) => p.i === i && p.j === j)) {
    const p = S.paths.find((q) => q.i === i && q.j === j);
    if (p.type === type) return { ok: true, unchanged: true };
    p.type = type;
    saveLocal();
    return { ok: true, changed: true };
  }
  if (S.objects.some((o) => footprint(o).some((t) => t.i === i && t.j === j))) return { ok: false, reason: "Something is in the way" };
  if (S.coins < def.price) return { ok: false, reason: "Not enough coins" };
  S.paths.push({ i, j, type });
  S.coins -= def.price;
  S.dayExpense += def.price;
  S.stats.expenses += def.price;
  saveLocal();
  return { ok: true, added: true };
}

export function removePath(i, j) {
  const idx = S.paths.findIndex((p) => p.i === i && p.j === j);
  if (idx < 0) return { ok: false };
  const p = S.paths[idx];
  S.paths.splice(idx, 1);
  S.coins += Math.round((PATH_BY_ID[p.type] || PATHS[0]).price * 0.4);
  saveLocal();
  return { ok: true };
}

export function pathSet() {
  const s = new Set();
  S.paths.forEach((p) => s.add(tileKey(p.i, p.j)));
  return s;
}

export function adjacentPath(i, j, w = 1, h = 1) {
  const set = pathSet();
  const spots = [];
  for (let x = 0; x < w; x++) {
    if (set.has(tileKey(i + x, j - 1))) spots.push({ i: i + x, j: j - 1 });
    if (set.has(tileKey(i + x, j + h))) spots.push({ i: i + x, j: j + h });
  }
  for (let z = 0; z < h; z++) {
    if (set.has(tileKey(i - 1, j + z))) spots.push({ i: i - 1, j: j + z });
    if (set.has(tileKey(i + w, j + z))) spots.push({ i: i + w, j: j + z });
  }
  return spots;
}

/* ---------------------------------------------------------------------
   Economy
   --------------------------------------------------------------------- */
export function ridePriceFor(obj) {
  const def = defOf(obj.type);
  if (S.ridePrice[obj.id] !== undefined) return S.ridePrice[obj.id];
  let base = Math.round(def.fun / 9) + 2;
  if (obj.plan) {
    const st = simulatePlan(obj.plan);
    if (st.ok) base = Math.max(4, Math.round(st.excitement / 8) + 2);
  }
  return base;
}
export function setRidePrice(id, value) {
  const v = Math.max(0, Math.min(120, Math.round(value)));
  S.ridePrice[id] = v;
  saveLocal();
  return v;
}
export function setTicket(v) {
  S.ticket = Math.max(0, Math.min(90, Math.round(v)));
  saveLocal();
  computeRating();
}
export function setMarkup(v) {
  S.shopMarkup = Math.max(0.6, Math.min(2.2, Math.round(v * 10) / 10));
  saveLocal();
}
export function wageBill() {
  const discount = S.research.includes("staffing") ? 0.85 : 1;
  return Math.round(STAFF.reduce((sum, r) => sum + (S.staff[r.id] || 0) * r.wage, 0) * discount);
}
export function upkeepBill() {
  const rides = S.objects.filter((o) => kindOf(defOf(o.type)) === "ride");
  return Math.round(rides.reduce((sum, o) => sum + (defOf(o.type).upkeep || 0), 0) / 4);
}
export function addCoins(n, why) {
  S.coins += n;
  if (n > 0) { S.dayIncome += n; S.weekIncome += n; S.stats.income += n; }
  else { S.dayExpense += -n; S.stats.expenses += -n; }
  if (n > 0) checkAchievements();
}
export function addXp(n) {
  const before = level();
  S.xp += n;
  const after = level();
  if (after > before) {
    S.level = after;
    S.researchPoints += after - before;
    if (hooks.onLevel) hooks.onLevel(after);
    toast("Level " + after, "A new research point and new attractions in the shop.", "good");
    checkAchievements();
  }
}
export function spend(n) {
  if (S.coins < n) { toast("Not enough coins", "Open the park for a while, or lower your spending.", "bad"); return false; }
  S.coins -= n;
  S.dayExpense += n;
  S.stats.expenses += n;
  saveLocal();
  return true;
}

/* ---------------------------------------------------------------------
   Staff
   --------------------------------------------------------------------- */
export function hire(role, delta = 1) {
  const def = STAFF.find((r) => r.id === role);
  if (!def) return;
  const count = S.staff[role] || 0;
  if (delta > 0) {
    const cost = Math.round(def.wage * 2.5);
    if (!spend(cost)) return;
    S.staff[role] = count + 1;
    S.stats.staffHired += 1;
    toast("Hired", def.name + " joined the team. Wages are paid at the end of each day.", "good");
    addXp(6);
  } else {
    if (count <= 0) return;
    S.staff[role] = count - 1;
    toast("Let go", def.name + " left the team.", "info");
  }
  syncStaffMeshes();
  saveLocal();
  refreshChallenges();
  checkAchievements();
}
export function staffCount() { return STAFF.reduce((n, r) => n + (S.staff[r.id] || 0), 0); }
export function staffBonus(effect) {
  const staffRoom = S.objects.some((o) => defOf(o.type).staff);
  const scale = (S.research.includes("staffing") ? 1.25 : 1) * (staffRoom ? 1.15 : 1);
  const map = { condition: "mechanic", clean: "cleaner", happiness: "entertainer", safety: "security", throughput: "operator" };
  return (S.staff[map[effect]] || 0) * scale;
}

function syncStaffMeshes() {
  const total = Math.min(8, staffCount());
  const list = runtime.staffMeshes;
  while (list.length > total) { const s = list.pop(); s.mesh.group.parent && s.mesh.group.parent.remove(s.mesh.group); }
  const roles = [];
  STAFF.forEach((r) => { for (let i = 0; i < (S.staff[r.id] || 0); i++) roles.push(r.id); });
  while (list.length < total) {
    const role = roles[list.length] || "cleaner";
    list.push({ role, mesh: null, x: 0, z: 0, route: [], idx: 0, timer: Math.random() * 4, heading: 0, animTime: 0, moving: false });
  }
}

/* ---------------------------------------------------------------------
   Visitors
   --------------------------------------------------------------------- */
function pickName() { return GUEST_NAMES[Math.floor(Math.random() * GUEST_NAMES.length)]; }
function guestLook() {
  return {
    shirt: GUEST_SHIRTS[Math.floor(Math.random() * GUEST_SHIRTS.length)],
    trousers: GUEST_COLORS[Math.floor(Math.random() * GUEST_COLORS.length)],
    hair: ["#3a2b22", "#6b4226", "#c99a5b", "#1f1b18", "#a35c2e"][Math.floor(Math.random() * 5)],
    skin: ["#f1c9a5", "#d9a678", "#a86f45", "#6f4a2f", "#f6d9bd"][Math.floor(Math.random() * 5)],
    bag: Math.random() > 0.75 ? "#e0b25a" : null
  };
}

export function spawnVisitor() {
  if (runtime.visitors.length >= maxVisitors()) return null;
  const v = {
    id: "v" + (++runtime.visitorSeq),
    name: pickName(),
    look: guestLook(),
    x: 0, z: 0, heading: 0,
    state: "walk",
    route: [], routeIdx: 0,
    timer: 0.4,
    hunger: 62 + Math.random() * 34,
    thirst: 60 + Math.random() * 36,
    energy: 70 + Math.random() * 30,
    comfort: 75 + Math.random() * 25,
    happiness: 74 + Math.random() * 16,
    money: 40 + Math.random() * 90,
    rideId: null,
    shopId: null,
    spent: 0,
    animTime: Math.random() * 5,
    moving: false,
    mesh: null,
    patience: 0,
    queueIndex: 0,
    leaving: false,
    wander: 0
  };
  const spot = tileCenter(SPAWN_TILE.i, SPAWN_TILE.j);
  v.x = spot.x + (Math.random() - 0.5) * 2;
  v.z = spot.z + (Math.random() - 0.5) * 2;
  runtime.visitors.push(v);
  if (hooks.onVisitors) hooks.onVisitors(runtime.visitors.length);
  // entrance ticket
  const price = S.ticket;
  if (v.money >= price) {
    v.money -= price;
    addCoins(price, "ticket");
    v.spent += price;
  }
  v.timer = 0.8 + Math.random() * 1.2;
  return v;
}

export function maxVisitors() {
  const rides = S.objects.filter((o) => kindOf(defOf(o.type)) === "ride").length;
  const shops = S.objects.filter((o) => kindOf(defOf(o.type)) === "building").length;
  const draw = rides * 3.2 + shops * 1.4 + rating() * 4 + level() * 1.5;
  return Math.max(14, Math.min(CONFIG.maxVisitors, Math.round(draw)));
}

function pathNeighbours(i, j, set) {
  const list = [];
  if (set.has(tileKey(i + 1, j))) list.push({ i: i + 1, j });
  if (set.has(tileKey(i - 1, j))) list.push({ i: i - 1, j });
  if (set.has(tileKey(i, j + 1))) list.push({ i, j: j + 1 });
  if (set.has(tileKey(i, j - 1))) list.push({ i, j: j - 1 });
  return list;
}

export function findPath(from, goalSet, limit = 900) {
  const set = pathSet();
  if (!set.has(tileKey(from.i, from.j))) {
    // step to the nearest path tile
    let best = null, bestD = 99;
    S.paths.forEach((p) => {
      const d = Math.abs(p.i - from.i) + Math.abs(p.j - from.j);
      if (d < bestD) { bestD = d; best = p; }
    });
    if (!best) return [];
    from = { i: best.i, j: best.j };
  }
  const start = tileKey(from.i, from.j);
  const q = [from];
  const came = new Map([[start, null]]);
  let found = null;
  let guard = 0;
  while (q.length && guard++ < limit) {
    const cur = q.shift();
    if (goalSet.has(tileKey(cur.i, cur.j))) { found = cur; break; }
    for (const n of pathNeighbours(cur.i, cur.j, set)) {
      const k = tileKey(n.i, n.j);
      if (came.has(k)) continue;
      came.set(k, cur);
      q.push(n);
    }
  }
  if (!found) return [];
  const route = [];
  let cur = found;
  while (cur) { route.unshift({ i: cur.i, j: cur.j }); cur = came.get(tileKey(cur.i, cur.j)); }
  return route;
}

function rideEntrySpots(obj) {
  const def = defOf(obj.type);
  return adjacentPath(obj.i, obj.j, obj.w, obj.h);
}

function chooseTarget(v) {
  const options = [];
  const mood = v.hunger < 40 ? "hungry" : v.thirst < 38 ? "thirsty" : v.energy < 30 ? "tired" : v.comfort < 25 ? "toilet" : "fun";
  S.objects.forEach((obj) => {
    const def = defOf(obj.type);
    if (!def) return;
    const kind = kindOf(def);
    const spots = adjacentPath(obj.i, obj.j, obj.w, obj.h);
    if (!spots.length) return;
    if (kind === "ride") {
      const st = S.rideState[obj.id];
      if (!st || st.broken) return;
      if (st.queue.length > def.capacity * 2.5) return;
      if (runtime.visitors.filter((x) => x.rideId === obj.id && x.state === "riding").length >= def.capacity * 1.4) return;
      let weight = def.fun + (mood === "fun" ? 30 : 0) - st.queue.length * 2.5;
      if (v.lastRide === obj.id) weight *= 0.35;
      options.push({ obj, def, spots, weight });
    } else if (kind === "building") {
      if (mood === "hungry" && def.kind === "food") weightPush(options, obj, def, spots, 120);
      else if (mood === "thirsty" && def.kind === "drink") weightPush(options, obj, def, spots, 120);
      else if (mood === "toilet" && def.model === "toilet") weightPush(options, obj, def, spots, 140);
      else if (def.kind === "goods") weightPush(options, obj, def, spots, 18 + v.happiness * 0.1);
      else weightPush(options, obj, def, spots, 12);
    } else {
      if (def.effect === "rest" && v.energy < 62) weightPush(options, obj, def, spots, 90);
      if (def.effect === "rest" && v.energy >= 62) weightPush(options, obj, def, spots, 8);
    }
  });
  if (!options.length) return null;
  // Nearby options get a small edge so the crowd spreads through the park
  // instead of everyone walking to the same three headliners.
  const here = { i: Math.round(v.x / T + CX), j: Math.round(v.z / T + CZ) };
  options.forEach((o) => {
    const s = o.spots[0];
    o.weight -= Math.min(24, Math.abs(s.i - here.i) + Math.abs(s.j - here.j)) * 0.35;
  });
  options.sort((a, b) => b.weight - a.weight);
  const top = options.slice(0, 8);
  const total = top.reduce((n, o) => n + Math.max(1, o.weight), 0);
  let pick = Math.random() * total;
  for (const o of top) { pick -= Math.max(1, o.weight); if (pick <= 0) return o; }
  return top[0];
}

function weightPush(options, obj, def, spots, weight) {
  options.push({ obj, def, spots, weight });
}

function sendTo(v, target) {
  const goalSet = new Set(target.spots.map((s) => tileKey(s.i, s.j)));
  const route = findPath({ i: Math.round(v.x / T + CX), j: Math.round(v.z / T + CZ) }, goalSet);
  if (!route.length) return false;
  v.route = route;
  v.routeIdx = 0;
  v.state = "walk";
  v.target = { id: target.obj.id, kind: kindOf(target.def) };
  v.moving = true;
  return true;
}

export function decide(v) {
  if (!S.open) { goHome(v); return; }
  if (v.happiness < 18 || v.energy < 8) { goHome(v); return; }
  const target = chooseTarget(v);
  if (!target) {
    v.wander = (v.wander || 0) + 1;
    if (v.wander > 2) { goHome(v); return; }
    // a stroll around the paths
    const set = pathSet();
    const keys = [...set];
    if (!keys.length) { goHome(v); return; }
    const k = keys[Math.floor(Math.random() * keys.length)].split(",");
    v.route = findPath({ i: Math.round(v.x / T + CX), j: Math.round(v.z / T + CZ) }, new Set([tileKey(+k[0], +k[1])]));
    v.routeIdx = 0;
    v.state = "walk";
    v.target = null;
    v.moving = true;
    v.timer = 1;
    return;
  }
  if (sendTo(v, target)) {
    v.pending = { id: target.obj.id, kind: kindOf(target.def), def: target.def };
  } else {
    goHome(v);
  }
}

export function goHome(v) {
  const route = findPath({ i: Math.round(v.x / T + CX), j: Math.round(v.z / T + CZ) }, new Set([tileKey(SPAWN_TILE.i, SPAWN_TILE.j)]));
  v.route = route;
  v.routeIdx = 0;
  v.state = route.length ? "walk" : "leaving";
  v.leaving = true;
  v.target = null;
  v.moving = true;
  if (!route.length) v.state = "leaving";
}

function arrive(v) {
  const p = v.pending;
  v.pending = null;
  if (!p) { v.state = "idle"; v.timer = 0.6 + Math.random(); return; }
  const obj = S.objects.find((o) => o.id === p.id);
  if (!obj) { v.state = "idle"; v.timer = 0.4; return; }
  if (p.kind === "ride") {
    const st = S.rideState[obj.id];
    const def = defOf(obj.type);
    if (!st || st.broken) { v.state = "idle"; v.timer = 0.6; return; }
    if (st.queue.length >= def.capacity * 3) { v.state = "idle"; v.timer = 0.6; return; }
    st.queue.push(v.id);
    v.state = "queue";
    v.rideId = obj.id;
    v.queueIndex = st.queue.length - 1;
    v.timer = 0;
    v.patience = 18 + Math.random() * 12;
    v.mesh && (v.mesh.group.visible = true);
  } else if (p.kind === "building") {
    v.state = "shopping";
    v.shopId = obj.id;
    v.timer = defOf(obj.type).serve || 3;
  } else {
    v.state = "sitting";
    v.timer = 8 + Math.random() * 6;
    v.resting = obj.id;
  }
}

function payFor(v, amount) {
  if (v.money < amount) return false;
  v.money -= amount;
  v.spent += amount;
  addCoins(amount, "guest");
  return true;
}

export function tickVisitors(dt) {
  const list = runtime.visitors;
  for (let n = list.length - 1; n >= 0; n--) {
    const v = list[n];
    v.animTime += dt;
    if (v.state === "walk") {
      if (v.routeIdx < v.route.length) {
        const t = v.route[v.routeIdx];
        const c = tileCenter(t.i, t.j);
        const dx = c.x - v.x, dz = c.z - v.z;
        const d = Math.hypot(dx, dz);
        const speed = 3.4;
        if (d < 0.14) {
          v.routeIdx++;
          if (v.routeIdx >= v.route.length) {
            v.moving = false;
            if (v.leaving) { v.state = "leaving"; }
            else arrive(v);
          }
        } else {
          v.x += (dx / d) * speed * dt;
          v.z += (dz / d) * speed * dt;
          v.heading = Math.atan2(dx, dz);
          v.moving = true;
        }
      } else {
        v.moving = false;
        if (v.leaving) v.state = "leaving"; else arrive(v);
      }
    } else if (v.state === "queue") {
      const st = S.rideState[v.rideId];
      v.moving = false;
      if (!st) { v.state = "idle"; v.timer = 0.4; v.rideId = null; continue; }
      const idx = st.queue.indexOf(v.id);
      v.queueIndex = idx;
      const obj = S.objects.find((o) => o.id === v.rideId);
      if (obj) {
        const spots = rideEntrySpots(obj);
        const spot = spots[0] || { i: obj.i, j: obj.j + obj.h };
        const base = tileCenter(spot.i, spot.j);
        v.x += ((base.x + (idx % 6) * 0.5 - 1.2) - v.x) * Math.min(1, dt * 6);
        v.z += ((base.z + Math.floor(idx / 6) * 0.6) - v.z) * Math.min(1, dt * 6);
      }
      v.patience -= dt * Math.max(0.55, 1 - staffBonus("safety") * 0.05);
      if (v.patience <= 0 || (st.broken)) {
        st.queue = st.queue.filter((x) => x !== v.id);
        v.happiness = Math.max(0, v.happiness - 18);
        v.state = "idle"; v.timer = 0.5; v.rideId = null;
        toastOnce(v, "Queue too long", v.name + " gave up waiting in the queue.");
      }
    } else if (v.state === "shopping") {
      v.timer -= dt;
      const obj = S.objects.find((o) => o.id === v.shopId);
      const def = obj ? defOf(obj.type) : null;
      if (!def) { v.state = "idle"; v.timer = 0.4; continue; }
      if (v.timer <= 0) {
        const price = Math.max(1, Math.round((def.spend || 0) * S.shopMarkup));
        const sale = def.spend ? payFor(v, price) : true;
        if (sale) {
          if (def.kind === "food") v.hunger = Math.min(100, v.hunger + def.restore);
          else if (def.kind === "drink") v.thirst = Math.min(100, v.thirst + def.restore);
          else if (def.model === "toilet") v.comfort = 100;
          else v.happiness = Math.min(100, v.happiness + 4);
          v.happiness = Math.min(100, v.happiness + 1.5);
          S.stats.visitorsServed += 1;
          S.dayServed += 1;
          S.weekServed += 1;
          if (S.dayServed % 5 === 0) addXp(2);
        } else {
          v.happiness = Math.max(0, v.happiness - 4);
        }
        v.state = "idle"; v.timer = 0.8; v.shopId = null;
      }
    } else if (v.state === "sitting") {
      v.timer -= dt;
      v.energy = Math.min(100, v.energy + dt * (S.research.includes("comfort") ? 18 : 9));
      v.happiness = Math.min(100, v.happiness + dt * 0.25);
      if (v.timer <= 0) { v.state = "idle"; v.timer = 0.5; }
    } else if (v.state === "idle") {
      v.timer -= dt;
      if (v.timer <= 0) decide(v);
    } else if (v.state === "leaving") {
      if (v.mesh) v.mesh.group.visible = false;
      removeVisitor(v);
      continue;
    }

    // needs
    const hungerRate = 0.55, thirstRate = 0.72, energyRate = 0.35, comfortRate = 0.3;
    v.hunger = Math.max(0, v.hunger - hungerRate * dt);
    v.thirst = Math.max(0, v.thirst - thirstRate * dt);
    v.energy = Math.max(0, v.energy - (v.state === "queue" ? energyRate * 1.6 : energyRate) * dt);
    v.comfort = Math.max(0, v.comfort - (v.state === "shopping" ? comfortRate * 2 : comfortRate) * dt);
    let happyDelta = 0;
    if (v.hunger < 25) happyDelta -= 0.5;
    if (v.thirst < 25) happyDelta -= 0.6;
    if (v.energy < 20) happyDelta -= 0.5;
    if (v.comfort < 20) happyDelta -= 0.5;
    happyDelta += (runtime.cleanliness - 70) * 0.006;
    happyDelta += staffBonus("happiness") * 0.01;
    happyDelta += staffBonus("safety") * 0.008;
    v.happiness = Math.max(0, Math.min(100, v.happiness + happyDelta * dt));
    if (v.happiness < 15 && v.state !== "leaving") { goHome(v); }

    // dirt
    if (Math.random() < dt * 0.012) {
      runtime.cleanliness = Math.max(30, runtime.cleanliness - (S.objects.some((o) => defOf(o.type).effect === "clean") ? 0.05 : 0.13));
    }
  }
  runtime.happinessAvg = list.length ? list.reduce((n, v) => n + v.happiness, 0) / list.length : 0;
}

const toasted = new Set();
function toastOnce(v, title, text) {
  if (toasted.has(v.id + title)) return;
  toasted.add(v.id + title);
  if (toasted.size > 200) toasted.clear();
  toast(title, text, "info");
}

export function removeVisitor(v) {
  const i = runtime.visitors.indexOf(v);
  if (i >= 0) runtime.visitors.splice(i, 1);
  if (v.mesh) { v.mesh.group.parent && v.mesh.group.parent.remove(v.mesh.group); v.mesh = null; }
  if (v.rideId) {
    const st = S.rideState[v.rideId];
    if (st) st.queue = st.queue.filter((id) => id !== v.id);
  }
  if (hooks.onVisitors) hooks.onVisitors(runtime.visitors.length);
}

/* Rides board, run and unload. Called from tick. */
export function tickRides(dt) {
  const operators = staffBonus("throughput");
  const mechanics = staffBonus("condition");
  S.objects.forEach((obj) => {
    const def = defOf(obj.type);
    if (kindOf(def) !== "ride") return;
    const st = S.rideState[obj.id] || (S.rideState[obj.id] = { condition: 100, broken: false, queue: [], riders: [], phase: "idle", timer: 0, served: 0, phaseT: 0 });
    if (st.broken) {
      if (mechanics > 0) {
        st.condition = Math.min(100, st.condition + dt * (3.2 + mechanics * 2.4));
        if (st.condition >= 62) {
          st.broken = false;
          toast("Back in service", def.name + " has been repaired.", "good");
        }
      }
      return;
    }
    st.condition = Math.max(0, st.condition - dt * (S.open ? 0.018 : 0.004));
    if (st.condition <= 0) {
      st.broken = true;
      st.phase = "idle";
      st.queue.forEach((id) => { const v = byId(id); if (v) { v.state = "idle"; v.rideId = null; v.timer = 0.4; v.happiness = Math.max(0, v.happiness - 10); } });
      st.queue = [];
      if (st.riders.length) releaseRiders(obj, st, true);
      toast("Ride broken down", def.name + " needs a mechanic. " + (mechanics ? "One is on the way." : "Hire a mechanic, or repair it from Management."), "bad");
      return;
    }
    // breakdown risk
    if (S.open && st.phase === "running" && Math.random() < dt * 0.0012 * (1 + (100 - st.condition) / 45) / (1 + mechanics * 0.4)) {
      st.condition = Math.max(0, st.condition - 16);
    }

    if (!S.open) {
      if (st.phase !== "running" && st.phase !== "unloading") return;
    }
    st.timer -= dt;
    if (st.phase === "idle") {
      if (S.open && st.queue.length) {
        st.phase = "boarding";
        st.timer = Math.max(1.2, 2.6 - operators * 0.18);
      }
    } else if (st.phase === "boarding") {
      if (st.timer <= 0) {
        const cap = def.capacity;
        const ids = st.queue.splice(0, cap);
        st.riders = ids;
        ids.forEach((id) => {
          const v = byId(id);
          if (!v) return;
          v.state = "riding";
          v.moving = false;
          if (v.mesh) v.mesh.group.visible = false;
        });
        st.phase = "running";
        st.timer = Math.max(6, def.cycle * (1 - Math.min(0.28, operators * 0.035)) * (st.condition < 45 ? 1.15 : 1));
      }
    } else if (st.phase === "running") {
      if (st.timer <= 0) {
        releaseRiders(obj, st, false);
        st.phase = "unloading";
        st.timer = 1.1;
      }
    } else if (st.phase === "unloading") {
      if (st.timer <= 0) { st.phase = "idle"; st.timer = 0; }
    }
  });
}

function releaseRiders(obj, st, broken) {
  const def = defOf(obj.type);
  const price = ridePriceFor(obj);
  const spots = rideEntrySpots(obj);
  const spot = spots[0] || { i: obj.i, j: obj.j + obj.h };
  const base = tileCenter(spot.i, spot.j);
  st.riders.forEach((id, i) => {
    const v = byId(id);
    if (!v) return;
    v.state = "idle";
    v.timer = 0.8 + Math.random();
    v.rideId = null;
    v.lastRide = obj.id;
    if (v.mesh) v.mesh.group.visible = true;
    v.x = base.x + (Math.random() - 0.5) * 2.2;
    v.z = base.z + (Math.random() - 0.5) * 2.2 + (i % 3) * 0.4;
    if (!broken) {
      const paid = payFor(v, price);
      if (!paid) v.happiness = Math.max(0, v.happiness - 5);
      const value = def.fun - price * 1.8;
      v.energy = Math.max(0, v.energy - 2);
      v.happiness = Math.min(100, Math.max(0, v.happiness + (broken ? -22 : (value > 0 ? 7 : 1))));
      st.served = (st.served || 0) + 1;
      S.stats.visitorsServed += 1;
      S.servedRating += broken ? 1 : Math.min(5, Math.max(1, 3 + value / 30));
      S.ratingsCount += 1;
      S.dayServed += 1;
      S.weekServed += 1;
      if (S.dayServed % 4 === 0) addXp(2);
    }
  });
  st.riders = [];
}

function byId(id) { return runtime.visitors.find((v) => v.id === id); }

/* ---------------------------------------------------------------------
   Day cycle, rating, challenges
   --------------------------------------------------------------------- */
export function tick(dt) {
  if (!runtime.started) return;
  runtime.time += dt;
  if (S.open) {
    S.dayProgress += dt / CONFIG.dayLength;
    runtime.spawnTimer -= dt;
    if (runtime.spawnTimer <= 0) {
      spawnVisitor();
      const draw = rating() / 5;
      const marketing = S.research.includes("marketing") ? 1.25 : 1;
      const ticketFactor = Math.max(0.45, 1.25 - S.ticket / 70);
      const interval = Math.max(0.9, (5.4 - draw * 2.6) / marketing / ticketFactor);
      runtime.spawnTimer = interval * (0.75 + Math.random() * 0.6);
    }
  } else {
    runtime.spawnTimer = Math.max(runtime.spawnTimer, 1.2);
  }
  tickVisitors(dt);
  tickRides(dt);
  tickStaff(dt);

  // cleaners and bins
  const bins = S.objects.filter((o) => defOf(o.type).effect === "clean").length;
  const cleaners = staffBonus("clean");
  runtime.cleanliness = Math.min(100, runtime.cleanliness + dt * (cleaners * 1.2 + bins * 0.05));
  if (S.open && runtime.visitors.length) runtime.cleanliness = Math.max(20, runtime.cleanliness - dt * runtime.visitors.length * 0.012);

  runtime.hudTimer -= dt;
  if (runtime.hudTimer <= 0) {
    runtime.hudTimer = 0.35;
    computeRating();
    if (hooks.onHud) hooks.onHud(hudData());
  }
  if (runtime.dirtyTimer > 0) {
    runtime.dirtyTimer -= dt;
    if (runtime.dirtyTimer <= 0) saveLocal(true);
  }
  if (S.dayProgress >= 1) endDay();
}

function tickStaff(dt) {
  const meshes = runtime.staffMeshes;
  if (!meshes.length) return;
  const paths = S.paths;
  if (!paths.length) return;
  meshes.forEach((s) => {
    if (!s.mesh) return;
    if (!s.route || !s.route.length || s.idx >= s.route.length) {
      s.timer -= dt;
      s.moving = false;
      if (s.timer <= 0) {
        const p = paths[Math.floor(Math.random() * paths.length)];
        s.route = findPath({ i: Math.round(s.x / T + CX), j: Math.round(s.z / T + CZ) }, new Set([tileKey(p.i, p.j)]));
        s.idx = 0;
        s.timer = 4 + Math.random() * 6;
      }
    } else {
      const t = s.route[s.idx];
      const c = tileCenter(t.i, t.j);
      const dx = c.x - s.x, dz = c.z - s.z;
      const d = Math.hypot(dx, dz);
      if (d < 0.2) { s.idx++; }
      else {
        s.x += (dx / d) * 2.6 * dt;
        s.z += (dz / d) * 2.6 * dt;
        s.heading = Math.atan2(dx, dz);
        s.moving = true;
      }
    }
    s.animTime += dt;
    s.mesh.group.position.set(s.x, 0, s.z);
    s.mesh.group.rotation.y = s.heading;
    s.mesh.animate(s.animTime, s.moving);
  });
}

export function computeRating() {
  const rides = S.objects.filter((o) => kindOf(defOf(o.type)) === "ride");
  const variety = new Set(rides.map((o) => o.type)).size;
  const appeal = S.objects.reduce((n, o) => n + (defOf(o.type).appeal || 0), 0);
  const happy = runtime.visitors.length ? runtime.visitors.reduce((n, v) => n + v.happiness, 0) / runtime.visitors.length : 72;
  const value = Math.max(0, 1.2 - S.ticket / 60 - (avgRidePrice() - 6) / 60);
  const cleanliness = runtime.cleanliness / 100;
  const staffed = Math.min(1, staffCount() / 6);
  let score = 1.6 + (happy / 100) * 1.4 + Math.min(0.5, variety * 0.05) + Math.min(0.4, appeal * 0.006) + cleanliness * 0.35 + value * 0.35 + staffed * 0.2;
  S.rating = Math.max(1, Math.min(5, Math.round(score * 10) / 10));
  S.stats.bestRating = Math.max(S.stats.bestRating, S.rating);
}

function avgRidePrice() {
  const rides = S.objects.filter((o) => kindOf(defOf(o.type)) === "ride");
  if (!rides.length) return 0;
  return rides.reduce((n, o) => n + ridePriceFor(o), 0) / rides.length;
}

export function endDay() {
  const wages = wageBill();
  const upkeep = upkeepBill();
  S.coins -= wages + upkeep;
  S.dayExpense += wages + upkeep;
  S.stats.expenses += wages + upkeep;
  S.stats.days += 1;
  S.stats.bestDayIncome = Math.max(S.stats.bestDayIncome, S.dayIncome);
  S.history.unshift({ day: S.day, income: Math.round(S.dayIncome), expense: Math.round(S.dayExpense), served: S.dayServed, rating: rating() });
  S.history = S.history.slice(0, 30);
  addXp(12 + Math.min(30, Math.round(S.dayIncome / 400)));
  if (S.coins < 0) {
    S.coins = 0;
    toast("The bank called", "You ran out of coins. Close the park, or sell a ride, and rebuild.", "bad");
  }
  if (hooks.onDay) hooks.onDay({ income: S.dayIncome, expense: S.dayExpense, served: S.dayServed, day: S.day });
  S.day += 1;
  S.dayProgress = 0;
  S.dayIncome = 0;
  S.dayExpense = 0;
  S.dayServed = 0;
  S.dayBuilt = 0;
  S.dayDecor = 0;
  S.weekServed = S.week === weekKey() ? S.weekServed : 0;
  if (S.week !== weekKey()) { S.week = weekKey(); S.weekIncome = 0; S.weekDecor = 0; S.weekly = { key: weekKey(), done: {}, claimed: {} }; }
  // overnight tidying
  runtime.cleanliness = Math.min(100, runtime.cleanliness + 6 + staffBonus("clean") * 3);
  checkAchievements();
  refreshChallenges();
  saveLocal(true);
}

/* ---------------------------------------------------------------------
   Research & land
   --------------------------------------------------------------------- */
export function buyResearch(id) {
  const node = RESEARCH.find((r) => r.id === id);
  if (!node) return { ok: false };
  if (S.research.includes(id)) return { ok: false, reason: "Already researched" };
  if (node.requires.some((r) => !S.research.includes(r))) return { ok: false, reason: "Research the prerequisites first" };
  if (S.researchPoints < node.cost) return { ok: false, reason: "Not enough research points" };
  S.researchPoints -= node.cost;
  S.research.push(id);
  S.stats.researchDone = S.research.length;
  S.researchLog.push({ id, at: Date.now() });
  toast("Research complete", node.name + " unlocked.", "good");
  addXp(40);
  saveLocal();
  checkAchievements();
  return { ok: true };
}

export function landPrice() {
  const idx = S.land - START_TILES;
  if (idx >= LAND_STEPS.length) return null;
  const base = LAND_PRICES[idx];
  return S.research.includes("land") ? Math.round(base * 0.8) : base;
}

export function buyLand() {
  const price = landPrice();
  if (price === null) return { ok: false, reason: "The park is as big as it gets" };
  if (!spend(price)) return { ok: false, reason: "Not enough coins" };
  S.land = Math.min(GRID.w / 2 - 1, S.land + 1);
  addXp(60);
  toast("Land purchased", "The fence moved out. Build something big.", "good");
  saveLocal(true);
  return { ok: true };
}

/* ---------------------------------------------------------------------
   Challenges & achievements
   --------------------------------------------------------------------- */
export function metrics() {
  return {
    dayServed: S.dayServed, dayIncome: Math.round(S.dayIncome), dayBuilt: S.dayBuilt, dayDecor: S.dayDecor,
    happinessPct: Math.round(runtime.happinessAvg),
    staff: staffCount(), weekServed: S.weekServed, weekIncome: Math.round(S.weekIncome), weekDecor: S.weekDecor,
    coastersBuilt: S.stats.coastersBuilt, ridesBuilt: S.stats.ridesBuilt, visitorsServed: S.stats.visitorsServed,
    bestRating: S.stats.bestRating, level: level(), coins: Math.round(S.coins), decorPlaced: S.stats.decorPlaced,
    likes: S.likes, researchDone: S.stats.researchDone
  };
}

export function refreshDaily() {
  if (S.daily.date !== dayKey()) { S.daily = { date: dayKey(), done: {}, claimed: {} }; S.weekDecor = S.weekDecor; }
  if (S.weekly.key !== weekKey()) { S.weekly = { key: weekKey(), done: {}, claimed: {} }; S.weekServed = 0; S.weekIncome = 0; S.weekDecor = 0; }
}

export function challengeList() {
  refreshDaily();
  const m = metrics();
  return {
    daily: DAILY.map((c) => ({ ...c, value: Math.min(c.goal, Math.round(m[c.metric] || 0)), done: (m[c.metric] || 0) >= c.goal, claimed: !!S.daily.claimed[c.id] })),
    weekly: WEEKLY.map((c) => ({ ...c, value: Math.min(c.goal, Math.round(m[c.metric] || 0)), done: (m[c.metric] || 0) >= c.goal, claimed: !!S.weekly.claimed[c.id] }))
  };
}

export function claimChallenge(id) {
  refreshDaily();
  const list = challengeList();
  const daily = list.daily.find((c) => c.id === id);
  const weekly = list.weekly.find((c) => c.id === id);
  const c = daily || weekly;
  if (!c) return { ok: false };
  if (!c.done) return { ok: false, reason: "Not finished yet" };
  if (c.claimed) return { ok: false, reason: "Already claimed" };
  if (daily) S.daily.claimed[id] = true; else S.weekly.claimed[id] = true;
  S.coins += c.coins;
  addXp(c.xp);
  toast("Challenge complete", "+" + c.coins + " coins and " + c.xp + " XP.", "good");
  saveLocal(true);
  return { ok: true };
}

export function refreshChallenges() {
  const list = challengeList();
  list.daily.concat(list.weekly).forEach((c) => {
    if (c.done && !c.claimed) {
      const store = list.daily.includes(c) ? S.daily : S.weekly;
      if (!store.done[c.id]) {
        store.done[c.id] = true;
        if (hooks.onHud) hooks.onHud(hudData());
      }
    }
  });
}

export function checkAchievements() {
  const m = metrics();
  ACHIEVEMENTS.forEach((a) => {
    if (S.achievements[a.id]) return;
    if ((m[a.metric] || 0) < a.goal) return;
    S.achievements[a.id] = true;
    S.coins += a.coins;
    if (a.xp) addXp(a.xp);
    toast("Achievement", a.name + " — +" + a.coins + " coins.", "good");
    if (hooks.onAchievement) hooks.onAchievement(a);
  });
}

/* ---------------------------------------------------------------------
   HUD
   --------------------------------------------------------------------- */
export function hudData() {
  return {
    name: S.name, coins: Math.round(S.coins), xp: Math.round(S.xp), level: level(), xpNeed: xpNeed(),
    rating: rating(), guests: runtime.visitors.length, capacity: maxVisitors(), open: S.open,
    day: S.day, dayProgress: S.dayProgress, cleanliness: Math.round(runtime.cleanliness),
    happiness: Math.round(runtime.happinessAvg), ticket: S.ticket, wages: wageBill(), upkeep: upkeepBill(),
    land: S.land, landPrice: landPrice(), staff: staffCount(), researchPoints: S.researchPoints
  };
}

/* ---------------------------------------------------------------------
   Opening / closing / visiting
   --------------------------------------------------------------------- */
export function setOpen(open) {
  S.open = !!open;
  if (!S.open) {
    runtime.visitors.forEach((v) => { if (v.state !== "riding") goHome(v); });
    toast("Park closed", "Guests are heading home. Wages are paid at the end of the day.", "info");
  } else {
    toast("Park open", "Guests are on their way. Watch the queues.", "good");
    if (S.dayProgress > 0.92) S.dayProgress = 0.15;
  }
  if (hooks.onOpenChange) hooks.onOpenChange(S.open);
  saveLocal(true);
}

let running = false;
export function startSimulation() { runtime.started = true; if (!running) { running = true; } }
export function pauseSimulation() { runtime.started = false; }

export function clearVisitors() {
  runtime.visitors.slice().forEach(removeVisitor);
  runtime.visitors = [];
}

export function enterPark() {
  runtime.mode = "park";
  runtime.visiting = null;
  runtime.started = true;
  syncStaffMeshes();
  if (hooks.onState) hooks.onState();
}

export function parkSnapshot() {
  return {
    name: S.name,
    level: level(),
    rating: rating(),
    likes: S.likes,
    visitors: S.stats.visitorsServed,
    staff: staffCount(),
    rides: S.objects.filter((o) => kindOf(defOf(o.type)) === "ride").length,
    decor: S.objects.filter((o) => kindOf(defOf(o.type)) === "decor").length,
    layout: JSON.stringify({ objects: S.objects, paths: S.paths, land: S.land, ticket: S.ticket, rating: S.rating, name: S.name }),
    updated: Date.now(),
    day: S.day
  };
}

/* Time keys */
export function dayKey() {
  const d = new Date();
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}
export function weekKey() {
  const d = new Date();
  const first = new Date(d.getFullYear(), 0, 1);
  const week = Math.ceil(((d - first) / 86400000 + first.getDay() + 1) / 7);
  return d.getFullYear() + "-W" + String(week).padStart(2, "0");
}

/* Repair a ride for coins. */
export function repairRide(id) {
  const obj = S.objects.find((o) => o.id === id);
  if (!obj) return { ok: false };
  const st = S.rideState[id];
  if (!st) return { ok: false };
  if (!st.broken && st.condition > 96) return { ok: false, reason: "It is in good shape" };
  const cost = Math.round(120 + (100 - st.condition) * 9);
  if (!spend(cost)) return { ok: false, reason: "Not enough coins" };
  st.condition = 100;
  st.broken = false;
  toast("Maintenance", defOf(obj.type).name + " repaired for " + cost + " coins.", "good");
  return { ok: true, cost };
}
