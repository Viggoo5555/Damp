/* =====================================================================
   LITTLE TOWN — simulation
   The town state, roads and river rules, placement, residents walking
   the network, economy, housing, happiness, seasons, quests, achievements
   and local saves. Everything here is plain data so it can be synced.
   ===================================================================== */
import { CONFIG } from "./config.js";
import {
  DEF_BY_ID, DEFS, ROAD_BY_ID, BUILDINGS, DECOR, CAT_LABEL,
  DAILY_POOL, WEEKLY_POOL, ACHIEVEMENTS, SEASONS, TIPS,
  xpForLevel, levelFromXp
} from "./data.js";

const G = CONFIG.grid;
const T = CONFIG.tile;
const START = CONFIG.startCoins;
const absKeys = new Set(["population", "happiness", "level", "capacity", "jobs", "likes"]);
const keyOf = (i, j) => i + "," + j;
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const hash = (str) => { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
const rng = (seed) => {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

export let S = null;
export const runtime = {
  started: false,
  mode: "town",
  residents: [],
  tool: null,
  selected: null,
  hover: null,
  eco: null,
  happinessTimer: 0,
  populationTimer: 0,
  scheduleTimer: 0,
  dayReport: null,
  lastError: null,
  lastSaveAt: 0,
  spawnTimer: 0,
  visited: null
};
let hooks = {};

export function setHooks(h) { hooks = h || {}; }
const toast = (a, b, c) => { if (hooks.onToast) hooks.onToast(a, b, c); };
const hud = () => { if (hooks.onHud) hooks.onHud(hudData()); };
function dirty() {
  runtime.eco = null;
  if (hooks.onSave) hooks.onSave();
  hud();
}

/* ---------------------------------------------------------------------
   Definitions and geometry
   --------------------------------------------------------------------- */
export function defOf(type) { return DEF_BY_ID[type] || null; }
export function roadDef(id) { return ROAD_BY_ID[id] || null; }
export function isBuilding(def) { return !!def && ["house", "shop", "civic", "green"].includes(def.model); }
export function isDecor(def) { return !!def && def.cat === "decor"; }
export function dims(def, rot = 0) {
  const s = def.size || [1, 1];
  return (rot % 2) ? [s[1], s[0]] : [s[0], s[1]];
}
export function insideLand(i, j) {
  if (!S) return false;
  const half = landHalf();
  const cx = i + 0.5 - G / 2;
  const cz = j + 0.5 - G / 2;
  return Math.abs(cx) <= half + 0.01 && Math.abs(cz) <= half + 0.01;
}
export function landHalf() {
  const step = CONFIG.landSteps.find((s) => s.level === (S ? S.land : 1)) || CONFIG.landSteps[0];
  return step.half;
}
export function landStep(level = S ? S.land : 1) {
  return CONFIG.landSteps.find((s) => s.level === level) || CONFIG.landSteps[0];
}
export function tileWorld(i, j) {
  return { x: (i + 0.5 - G / 2) * T, z: (j + 0.5 - G / 2) * T };
}
export function objectCenter(obj) {
  const def = defOf(obj.type);
  if (!def) return { x: 0, z: 0 };
  const [w, d] = dims(def, obj.rot || 0);
  return { x: (obj.i + w / 2 - G / 2) * T, z: (obj.j + d / 2 - G / 2) * T };
}
export function isWater(i, j) {
  const x = i + 0.5 - G / 2;
  const z = j + 0.5 - G / 2;
  const river = 8.05 + Math.sin(x * 0.46) * 1.15 + x * 0.045;
  return Math.abs(z - river) < 1.18;
}
export function isRoad(i, j) { return !!(S && S.roads[keyOf(i, j)]); }
export function roadFamily(kind) {
  const def = roadDef(kind);
  const real = def ? def.kind : kind;
  return real === "path" ? "path" : "street";
}
export function roadAt(i, j) { return S ? S.roads[keyOf(i, j)] || null : null; }
export function roadMask(i, j, kind) {
  const fam = roadFamily(kind);
  let mask = 0;
  const joins = (neighbour) => neighbour && (fam === "path" ? true : roadFamily(neighbour) === "street");
  const n = roadAt(i, j - 1), e = roadAt(i + 1, j), s = roadAt(i, j + 1), w = roadAt(i - 1, j);
  if (joins(n)) mask |= 1;
  if (joins(e)) mask |= 2;
  if (joins(s)) mask |= 4;
  if (joins(w)) mask |= 8;
  return mask;
}
export function objectCells(obj) {
  const def = defOf(obj.type);
  if (!def) return [];
  const [w, d] = dims(def, obj.rot || 0);
  const out = [];
  for (let x = 0; x < w; x++) for (let y = 0; y < d; y++) out.push([obj.i + x, obj.j + y]);
  return out;
}
export function entranceTile(obj) {
  const def = defOf(obj.type);
  if (!def) return { i: obj.i, j: obj.j };
  const [w, d] = dims(def, obj.rot || 0);
  const rot = ((obj.rot || 0) % 4 + 4) % 4;
  if (rot === 0) return { i: obj.i + Math.floor(w / 2), j: obj.j + d };
  if (rot === 1) return { i: obj.i + w, j: obj.j + Math.floor(d / 2) };
  if (rot === 2) return { i: obj.i + Math.floor(w / 2), j: obj.j - 1 };
  return { i: obj.i - 1, j: obj.j + Math.floor(d / 2) };
}
export function hasRoadAccess(obj, cache) {
  const def = defOf(obj.type);
  if (!def || isDecor(def)) return true;
  const e = entranceTile(obj);
  if (isRoad(e.i, e.j)) return true;
  // a corner entrance may sit on a road one tile to either side
  for (const [di, dj] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
    if (isRoad(e.i + di, e.j + dj)) return true;
  }
  void cache;
  return false;
}
export function objectMap() {
  const map = new Map();
  for (const obj of S.objects) for (const [i, j] of objectCells(obj)) map.set(keyOf(i, j), obj);
  return map;
}
export function canPlace(def, i, j, rot, ignoreId = null) {
  if (!def) return { ok: false, reason: "Unknown building." };
  const [w, d] = dims(def, rot);
  const occ = objectMap();
  for (let x = 0; x < w; x++) for (let y = 0; y < d; y++) {
    const ii = i + x, jj = j + y;
    if (!insideLand(ii, jj)) return { ok: false, reason: "Outside your land." };
    if (isWater(ii, jj)) return { ok: false, reason: "That is the river." };
    if (isRoad(ii, jj)) return { ok: false, reason: "A road is in the way." };
    const other = occ.get(keyOf(ii, jj));
    if (other && other.id !== ignoreId) return { ok: false, reason: "Something is already there." };
  }
  return { ok: true };
}
export function canPlaceRoad(kind, i, j) {
  if (!insideLand(i, j)) return { ok: false, reason: "Outside your land." };
  if (!roadDef(kind)) return { ok: false, reason: "Unknown road." };
  const water = isWater(i, j);
  if (kind === "bridge" && !water) return { ok: false, reason: "A bridge can only cross the river." };
  if (kind !== "bridge" && water) return { ok: false, reason: "Use a bridge to cross the river." };
  if (objectMap().has(keyOf(i, j))) return { ok: false, reason: "A building is in the way." };
  if (kind === "crossing" && !isRoad(i, j)) return { ok: false, reason: "Place a crossing on an existing street." };
  return { ok: true };
}

/* ---------------------------------------------------------------------
   New town / save / load
   --------------------------------------------------------------------- */
function starter() {
  const roads = {};
  for (let i = 7; i <= 18; i++) roads[keyOf(i, 12)] = "cobble-street";
  const objects = [
    { id: "obj-starter", type: "willow-cottage", i: 8, j: 9, rot: 0, level: 1, variant: 0 },
    { id: "obj-oak", type: "old-oak", i: 15, j: 9, rot: 0, level: 1, variant: 0 },
    { id: "obj-blossom", type: "blossom-tree", i: 16, j: 14, rot: 0, level: 1, variant: 0 },
    { id: "obj-bench", type: "park-bench", i: 12, j: 13, rot: 0, level: 1, variant: 0 },
    { id: "obj-lamp", type: "lamp-post", i: 8, j: 13, rot: 0, level: 1, variant: 0 },
    { id: "obj-mail", type: "mailbox", i: 11, j: 13, rot: 0, level: 1, variant: 0 }
  ];
  return {
    version: 1,
    name: "Willow Green",
    coins: START,
    xp: 0,
    level: 1,
    day: 1,
    dayProgress: 0.08,
    land: 1,
    objects,
    roads,
    roadsRev: 1,
    population: 2,
    happiness: 52,
    likes: 0,
    seasonIndex: 0,
    seasonClaimed: false,
    seasonBase: null,
    uid: null,
    dayKey: null,
    weekKey: null,
    daily: null,
    weekly: null,
    achievements: {},
    stats: { spent: 0, incomeTotal: 0, upgrades: 0, dailyClaims: 0, built: objects.length },
    todayIncome: 0,
    todayExpense: 0,
    history: [],
    lastSeen: 0
  };
}

export function newTown(name = "Willow Green") {
  S = starter();
  S.name = String(name || "Willow Green").slice(0, 24);
  runtime.mode = "town";
  runtime.started = false;
  runtime.residents = [];
  runtime.eco = null;
  ensureSchedule(true);
  ensureSeason(true);
  recomputeHappiness();
  saveLocal(true);
  return S;
}

export function hasSave() {
  try { return !!localStorage.getItem(CONFIG.storageKey); } catch (error) { return false; }
}
export function readLocal() {
  try {
    const raw = localStorage.getItem(CONFIG.storageKey);
    return raw ? JSON.parse(raw) : null;
  } catch (error) { return null; }
}
export function loadState(data) {
  const base = starter();
  const merged = { ...base, ...(data || {}) };
  merged.objects = Array.isArray(data && data.objects) ? data.objects.filter((o) => o && DEF_BY_ID[o.type] && Number.isFinite(+o.i) && Number.isFinite(+o.j)).map((o) => ({
    id: String(o.id || "obj-" + Math.random().toString(36).slice(2)), type: o.type,
    i: clamp(Math.round(+o.i), 0, G - 1), j: clamp(Math.round(+o.j), 0, G - 1),
    rot: ((Math.round(+o.rot) || 0) % 4 + 4) % 4,
    level: clamp(Math.round(+o.level) || 1, 1, 3),
    variant: clamp(Math.round(+o.variant) || 0, 0, 7)
  })).slice(0, CONFIG.maxObjects) : base.objects;
  merged.roads = {};
  if (data && data.roads && typeof data.roads === "object") {
    for (const [k, v] of Object.entries(data.roads)) {
      const [i, j] = k.split(",").map(Number);
      if (Number.isFinite(i) && Number.isFinite(j) && ROAD_BY_ID[v]) merged.roads[k] = v;
    }
  }
  merged.land = clamp(Math.round(+merged.land) || 1, 1, CONFIG.landSteps.length);
  merged.coins = Math.max(0, Math.round(+merged.coins) || 0);
  merged.xp = Math.max(0, Math.round(+merged.xp) || 0);
  merged.level = levelFromXp(merged.xp);
  merged.day = Math.max(1, Math.round(+merged.day) || 1);
  merged.dayProgress = clamp(+merged.dayProgress || 0, 0, 0.999);
  merged.population = clamp(Math.round(+merged.population) || 0, 0, CONFIG.maxResidents);
  merged.happiness = clamp(Math.round(+merged.happiness) || 50, 0, 100);
  merged.stats = { spent: 0, incomeTotal: 0, upgrades: 0, dailyClaims: 0, built: merged.objects.length, ...(data && data.stats ? data.stats : {}) };
  merged.history = Array.isArray(merged.history) ? merged.history.slice(0, 40) : [];
  merged.achievements = merged.achievements && typeof merged.achievements === "object" ? merged.achievements : {};
  merged.daily = merged.daily && typeof merged.daily === "object" ? merged.daily : null;
  merged.weekly = merged.weekly && typeof merged.weekly === "object" ? merged.weekly : null;
  merged.roadsRev = 1;
  S = merged;
  runtime.mode = "town";
  runtime.residents = [];
  runtime.eco = null;
  ensureSchedule();
  ensureSeason();
  recomputeEconomy();
  recomputeHappiness();
  return S;
}
export function serialize() {
  S.lastSeen = Date.now();
  return JSON.parse(JSON.stringify({ ...S, roadsRev: S.roadsRev }));
}
export function saveLocal(force = false) {
  if (!S) return;
  const now = Date.now();
  if (!force && now - runtime.lastSaveAt < 900) return;
  runtime.lastSaveAt = now;
  try { localStorage.setItem(CONFIG.storageKey, JSON.stringify(S)); } catch (error) { /* storage may be full */ }
}
export function townSnapshot() {
  return {
    name: S.name,
    level: S.level,
    rating: Math.round(rating() * 10) / 10,
    residents: S.population,
    happiness: S.happiness,
    buildings: S.objects.filter((o) => isBuilding(defOf(o.type))).length,
    decor: S.objects.filter((o) => isDecor(defOf(o.type))).length,
    roads: Object.keys(S.roads).length,
    land: S.land,
    season: season().name,
    likes: S.likes,
    layout: JSON.stringify({ name: S.name, land: S.land, season: S.seasonIndex, objects: S.objects, roads: S.roads })
  };
}

export function enterTown() {
  runtime.started = true;
  runtime.mode = "town";
  runtime.spawnTimer = 0;
  syncVisualPopulation();
}
export function clearResidents() {
  runtime.residents = [];
}

/* ---------------------------------------------------------------------
   Placement actions
   --------------------------------------------------------------------- */
let idCounter = 0;
function newId() { return "o" + Date.now().toString(36) + "-" + (++idCounter); }

export function placeObject(type, i, j, rot = 0) {
  const def = defOf(type);
  if (!def) return { ok: false, reason: "Unknown building." };
  if (S.level < def.unlock) return { ok: false, reason: "Unlocks at level " + def.unlock + "." };
  if (S.coins < def.cost) return { ok: false, reason: "Not enough coins." };
  if (S.objects.length >= CONFIG.maxObjects) return { ok: false, reason: "This town is full. Remove something first." };
  const check = canPlace(def, i, j, rot);
  if (!check.ok) return check;
  const obj = { id: newId(), type, i, j, rot: ((rot % 4) + 4) % 4, level: 1, variant: 0 };
  S.coins -= def.cost;
  S.stats.spent += def.cost;
  S.stats.built++;
  S.objects.push(obj);
  addXp(Math.round(6 + def.cost / 180));
  checkAchievements();
  dirty();
  saveLocal();
  return { ok: true, object: obj };
}

export function moveObject(id, i, j, rot = null) {
  const obj = S.objects.find((o) => o.id === id);
  if (!obj) return { ok: false, reason: "That building is gone." };
  const def = defOf(obj.type);
  const nextRot = rot === null ? obj.rot : ((rot % 4) + 4) % 4;
  const check = canPlace(def, i, j, nextRot, id);
  if (!check.ok) return check;
  obj.i = i; obj.j = j; obj.rot = nextRot;
  dirty(); saveLocal();
  return { ok: true, object: obj };
}

export function rotateObject(id) {
  const obj = S.objects.find((o) => o.id === id);
  if (!obj) return { ok: false, reason: "That building is gone." };
  const def = defOf(obj.type);
  const rot = (obj.rot + 1) % 4;
  const check = canPlace(def, obj.i, obj.j, rot, id);
  if (!check.ok) return check;
  obj.rot = rot;
  dirty(); saveLocal();
  return { ok: true, object: obj };
}

export function removeObject(id) {
  const idx = S.objects.findIndex((o) => o.id === id);
  if (idx < 0) return { ok: false, reason: "That building is gone." };
  const obj = S.objects[idx];
  const def = defOf(obj.type);
  const refund = Math.round(def.cost * 0.35);
  S.coins += refund;
  S.objects.splice(idx, 1);
  if (runtime.selected === id) runtime.selected = null;
  addXp(2);
  dirty(); saveLocal();
  return { ok: true, refund };
}

export function upgradeObject(id) {
  const obj = S.objects.find((o) => o.id === id);
  if (!obj) return { ok: false, reason: "That building is gone." };
  const def = defOf(obj.type);
  if (isDecor(def)) return { ok: false, reason: "Decorations do not need upgrading." };
  if (obj.level >= 3) return { ok: false, reason: "Already fully upgraded." };
  const cost = upgradeCost(obj);
  if (S.coins < cost) return { ok: false, reason: "Not enough coins." };
  S.coins -= cost;
  S.stats.spent += cost;
  S.stats.upgrades++;
  obj.level++;
  addXp(28 + obj.level * 14);
  checkAchievements();
  dirty(); saveLocal();
  return { ok: true, object: obj, cost };
}
export function upgradeCost(obj) {
  const def = defOf(obj.type);
  return Math.round((def ? def.cost : 1000) * 0.62 * obj.level);
}
export function paintObject(id, variant = null) {
  const obj = S.objects.find((o) => o.id === id);
  if (!obj) return { ok: false, reason: "That building is gone." };
  obj.variant = variant === null || variant === undefined ? (obj.variant + 1) % 8 : clamp(Math.round(+variant) || 0, 0, 7);
  dirty(); saveLocal();
  return { ok: true, variant: obj.variant };
}

export function setRoad(kind, i, j, free = false) {
  const def = roadDef(kind);
  if (!def) return { ok: false, reason: "Unknown road." };
  const check = canPlaceRoad(kind, i, j);
  if (!check.ok) return check;
  const existing = S.roads[keyOf(i, j)];
  if (existing === kind) return { ok: true, unchanged: true };
  if (!free) {
    const price = def.cost;
    if (S.coins < price) return { ok: false, reason: "Not enough coins." };
    S.coins -= price;
    S.stats.spent += price;
  }
  S.roads[keyOf(i, j)] = kind;
  S.roadsRev++;
  addXp(1);
  dirty(); saveLocal();
  return { ok: true };
}
export function removeRoad(i, j) {
  const k = keyOf(i, j);
  if (!S.roads[k]) return { ok: false };
  delete S.roads[k];
  S.roadsRev++;
  dirty(); saveLocal();
  return { ok: true };
}
export function paintRoad(i, j, kind) {
  if (!S.roads[keyOf(i, j)]) return { ok: false };
  return setRoad(kind, i, j);
}

export function expandLand() {
  const next = CONFIG.landSteps[S.land];
  if (!next) return { ok: false, reason: "The whole valley is already yours." };
  if (S.coins < next.cost) return { ok: false, reason: "Not enough coins for " + next.name + "." };
  S.coins -= next.cost;
  S.stats.spent += next.cost;
  S.land++;
  addXp(60);
  dirty(); saveLocal();
  return { ok: true, land: S.land };
}

export function renameTown(name) {
  const clean = String(name || "").trim().slice(0, 24);
  if (clean.length < 2) return { ok: false, reason: "Use at least 2 characters." };
  S.name = clean;
  dirty(); saveLocal(true);
  return { ok: true };
}

/* ---------------------------------------------------------------------
   Economy, population, happiness
   --------------------------------------------------------------------- */
export function isHospitality(def) {
  if (!def) return false;
  return !!(def.style && def.style.tables) || /cafe|café|restaurant|bistro|tea|patisserie|ice-cream|hotel/i.test(def.id);
}
export function economy() {
  if (runtime.eco) return runtime.eco;
  let shops = 0, upkeep = 0, tax = 0, capacity = 0, jobs = 0, services = 0, green = 0, appeal = 0;
  const autumn = season().id === "autumn";
  for (const obj of S.objects) {
    const def = defOf(obj.type);
    if (!def) continue;
    if (isDecor(def)) { appeal += def.appeal * (autumn ? 2 : 1); continue; }
    if (!hasRoadAccess(obj)) continue;
    capacity += def.pop || 0;
    jobs += def.jobs || 0;
    upkeep += def.upkeep || 0;
    appeal += def.appeal || 0;
    if (def.model === "shop") {
      let income = def.income || 0;
      let mult = 1;
      if (season().id === "summer") mult *= 1.15;
      if (season().id === "winter" && isHospitality(def)) mult *= 2;
      income *= mult;
      shops += income;
    }
    if (def.cat === "service") services++;
    if (def.model === "green") green++;
  }
  const population = S.population;
  const jobPenalty = population > 0 ? Math.max(0, population - jobs) / population * 11 : 0;
  const crowding = capacity > 0 ? Math.max(0, population - capacity) * 4 : population > 0 ? 30 : 0;
  let happy = 52 + Math.min(30, appeal * 0.6) + Math.min(10, green * 1.6) + Math.min(8, services * 1.15) - jobPenalty - crowding;
  if (season().id === "spring") happy += 3;
  if (season().id === "summer") happy += 1;
  if (season().id === "winter") happy -= 1;
  happy = Math.round(clamp(happy, 0, 100));
  S.happiness = happy;
  const customer = 0.3 + Math.min(0.7, population / 45);
  const incomePerDay = shops * customer + population * 1.9;
  const roadUpkeep = Object.keys(S.roads).length * 0.12;
  const expensePerDay = upkeep + roadUpkeep;
  const target = Math.floor(capacity * (0.55 + happy / 180) * (season().id === "spring" ? 1.25 : 1));
  const eco = {
    shops, upkeep, incomePerDay, expensePerDay, tax, capacity, jobs, services, green, appeal,
    target: clamp(target, 0, CONFIG.maxResidents),
    incomeRate: incomePerDay / CONFIG.dayLength,
    expenseRate: expensePerDay / CONFIG.dayLength,
    netRate: (incomePerDay - expensePerDay) / CONFIG.dayLength,
    employment: population > 0 ? Math.min(1, jobs / population) : 1
  };
  runtime.eco = eco;
  return eco;
}
function recomputeEconomy() { runtime.eco = null; return economy(); }
export function recomputeHappiness() { economy(); hud(); return S ? S.happiness : 0; }
export function rating() { return clamp(1 + S.happiness / 25, 1, 5); }
export function townLevel() {
  const buildings = S.objects.filter((o) => isBuilding(defOf(o.type))).length;
  return clamp(1 + Math.floor((S.population * 1.5 + buildings * 2 + economy().capacity * 0.2) / 25), 1, 20);
}

function updateEconomy(dt) {
  const eco = economy();
  const inc = eco.incomeRate * dt;
  const exp = eco.expenseRate * dt;
  const before = S.coins;
  S.coins = Math.max(0, S.coins + inc - exp);
  const realInc = Math.max(0, S.coins - before + exp);
  S.todayIncome += inc;
  S.todayExpense += exp;
  S.stats.incomeTotal += inc;
  void realInc;
}

function updatePopulation(dt) {
  runtime.populationTimer += dt;
  if (runtime.populationTimer < 1.8) return;
  runtime.populationTimer = 0;
  const target = economy().target;
  if (S.population < target) {
    S.population += 1;
    syncVisualPopulation();
    if (S.population === 5 || S.population === 10 || S.population === 25 || S.population === 50 || S.population === 100) {
      toast("Population " + S.population, "The town is growing. New neighbours have arrived.", "good");
    }
    checkAchievements();
    hud();
  } else if (S.population > target) {
    S.population -= 1;
    syncVisualPopulation();
    hud();
  }
  if (runtime.residents.length < Math.min(S.population, CONFIG.maxVisibleResidents)) spawnResident();
  if (runtime.residents.length > Math.min(S.population, CONFIG.maxVisibleResidents)) {
    runtime.residents.pop();
  }
}

function recomputeHappinessTick(dt) {
  runtime.happinessTimer += dt;
  if (runtime.happinessTimer < 0.8) return;
  runtime.happinessTimer = 0;
  recomputeEconomy();
  recomputeHappiness();
}

/* ---------------------------------------------------------------------
   Residents
   --------------------------------------------------------------------- */
const LOOKS = [
  { skin: "#f0c9a8", hair: "#4a3527", coat: "#b85f51" },
  { skin: "#e2b08a", hair: "#7a4f33", coat: "#6f9077" },
  { skin: "#c98d63", hair: "#2f2a26", coat: "#5f7f9a" },
  { skin: "#a56f4b", hair: "#c08a4e", coat: "#c19a55" },
  { skin: "#8a5a3d", hair: "#a35f3f", coat: "#8a6f9f" },
  { skin: "#f5d7bc", hair: "#d9b98a", coat: "#d0786e" }
];
function activeBuildings() {
  return S.objects.filter((o) => {
    const def = defOf(o.type);
    return isBuilding(def) && hasRoadAccess(o);
  });
}
function homes() {
  return S.objects.filter((o) => defOf(o.type) && defOf(o.type).model === "house" && hasRoadAccess(o));
}
function roadKeys() { return Object.keys(S.roads); }
function nearestRoadKey(i, j, max = 6) {
  for (let r = 0; r <= max; r++) {
    for (let dx = -r; dx <= r; dx++) for (let dy = -r; dy <= r; dy++) {
      if (Math.abs(dx) + Math.abs(dy) !== r) continue;
      if (isRoad(i + dx, j + dy)) return keyOf(i + dx, j + dy);
    }
  }
  return null;
}
function buildingRoadKey(obj) {
  const e = entranceTile(obj);
  if (isRoad(e.i, e.j)) return keyOf(e.i, e.j);
  return nearestRoadKey(e.i, e.j, 5);
}
function bfsRoads(startKey, goalKey) {
  if (!startKey || !goalKey) return null;
  if (startKey === goalKey) return [startKey];
  const q = [startKey];
  const prev = new Map([[startKey, null]]);
  let guard = 0;
  while (q.length && guard++ < 1600) {
    const cur = q.shift();
    const [ci, cj] = cur.split(",").map(Number);
    for (const [di, dj] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) {
      const k = keyOf(ci + di, cj + dj);
      if (prev.has(k) || !isRoad(ci + di, cj + dj)) continue;
      prev.set(k, cur);
      if (k === goalKey) {
        const out = [k];
        let p = cur;
        while (p) { out.push(p); p = prev.get(p); }
        return out.reverse();
      }
      q.push(k);
    }
  }
  return null;
}
function roadWorldPath(keys) {
  return keys.map((k) => { const [i, j] = k.split(",").map(Number); const p = tileWorld(i, j); return { x: p.x, z: p.z }; });
}
function pickDestination(res) {
  const options = activeBuildings().filter((o) => o.id !== res.home && defOf(o.type).model !== "house");
  if (!options.length) return null;
  const weighted = [];
  for (const o of options) {
    const def = defOf(o.type);
    let w = def.model === "shop" ? 5 : def.model === "green" ? 4 : def.model === "civic" ? 3 : 2;
    if (o.id === res.lastTarget) w *= 0.4;
    for (let i = 0; i < Math.max(1, Math.round(w)); i++) weighted.push(o);
  }
  return weighted.length ? weighted[Math.floor(Math.random() * weighted.length)] : options[0];
}
function spawnResident() {
  const roads = roadKeys();
  if (!roads.length) return;
  const homeList = homes();
  const home = homeList.length ? homeList[Math.floor(Math.random() * homeList.length)] : null;
  const doorKey = home ? buildingRoadKey(home) : roads[Math.floor(Math.random() * roads.length)];
  if (!doorKey) return;
  const [di, dj] = doorKey.split(",").map(Number);
  const nearby = roads.filter((k) => { const [i, j] = k.split(",").map(Number); return Math.abs(i - di) + Math.abs(j - dj) <= 3; });
  const startKey = nearby.length ? nearby[Math.floor(Math.random() * nearby.length)] : doorKey;
  const p = startKey.split(",").map(Number);
  const world = tileWorld(p[0], p[1]);
  const look = LOOKS[Math.floor(Math.random() * LOOKS.length)];
  const res = {
    id: "r" + Math.random().toString(36).slice(2),
    home: home ? home.id : null,
    x: world.x + (Math.random() - 0.5) * 0.5,
    z: world.z + (Math.random() - 0.5) * 0.5,
    look, phase: Math.random() * 10, state: "walk",
    speed: 1.8 + Math.random() * 0.7,
    path: [], pathIndex: 0, timer: 0, lastTarget: null,
    dir: 0, mesh: null
  };
  chooseRoute(res, home);
  runtime.residents.push(res);
}
function chooseRoute(res, fromBuilding = null) {
  const target = pickDestination(res);
  const here = nearestRoadKey(Math.round(res.x / T + G / 2 - 0.5), Math.round(res.z / T + G / 2 - 0.5), 3);
  const start = here || (fromBuilding ? buildingRoadKey(fromBuilding) : null);
  let keys = null;
  let goal = target ? buildingRoadKey(target) : null;
  if (target && start && goal) keys = bfsRoads(start, goal);
  // A young town has nowhere to visit yet, but the lane still has a life of
  // its own: neighbours stroll to a different stretch of street and back.
  if (!keys || keys.length < 2) {
    const roads = roadKeys();
    const far = roads.filter((k) => {
      const [i, j] = k.split(",").map(Number);
      const [si, sj] = (start || k).split(",").map(Number);
      return Math.abs(i - si) + Math.abs(j - sj) > 4;
    });
    const stroll = far.length ? far[Math.floor(Math.random() * far.length)] : roads[Math.floor(Math.random() * roads.length)];
    keys = start && stroll ? bfsRoads(start, stroll) : null;
    goal = stroll;
  }
  if (!keys) { res.state = "idle"; res.timer = 2 + Math.random() * 3; return; }
  res.path = roadWorldPath(keys);
  res.pathIndex = 0;
  res.state = "walk";
  res.timer = 0;
  res.lastTarget = target ? target.id : null;
  res.target = target ? target.id : null;
  res.stroll = !target;
}
function updateResidents(dt) {
  for (const res of runtime.residents) {
    if (res.state === "walk" && res.path.length) {
      const target = res.path[res.pathIndex];
      if (!target) { res.state = "idle"; res.timer = 2 + Math.random() * 4; continue; }
      const dx = target.x - res.x, dz = target.z - res.z;
      const dist = Math.hypot(dx, dz);
      if (dist < 0.12) {
        res.pathIndex++;
        if (res.pathIndex >= res.path.length) {
          res.state = "idle";
          res.timer = 3 + Math.random() * 5;
          res.path = [];
        }
      } else {
        const step = Math.min(dist, res.speed * dt);
        res.x += dx / dist * step;
        res.z += dz / dist * step;
        res.dir = Math.atan2(dx, dz);
        res.phase += dt * res.speed * 3.4;
      }
    } else if (res.state === "idle") {
      res.timer -= dt;
      res.phase += dt * 0.8;
      if (res.timer <= 0) {
        const homeBuilding = res.home ? S.objects.find((o) => o.id === res.home) : null;
        chooseRoute(res, homeBuilding);
      }
    }
  }
}
export function syncVisualPopulation() {
  const target = Math.min(S.population, CONFIG.maxVisibleResidents);
  let guard = 0;
  while (runtime.residents.length < target && guard++ < 8) spawnResident();
  while (runtime.residents.length > target) runtime.residents.pop();
}

/* ---------------------------------------------------------------------
   Seasons & schedule
   --------------------------------------------------------------------- */
export function season() {
  const idx = ((S ? S.seasonIndex : 0) % SEASONS.length + SEASONS.length) % SEASONS.length;
  return SEASONS[idx];
}
export function seasonDaysLeft() {
  return 7 - ((S.day - 1) % 7);
}
function ensureSeason(force = false) {
  const idx = Math.floor((S.day - 1) / 7) % SEASONS.length;
  if (force || idx !== S.seasonIndex || !S.seasonBase) {
    S.seasonIndex = idx;
    S.seasonBase = { shops: metric("shops"), decor: metric("decor"), upgrades: metric("upgrades"), population: S.population };
    S.seasonClaimed = false;
  }
}
export function seasonalQuest() {
  const s = season();
  const base = S.seasonBase || {};
  const defs = {
    spring: { id: "s-spring", text: "Build 2 shops for the Blossom Festival", metric: "shops", need: 2, coins: 1600, xp: 180 },
    summer: { id: "s-summer", text: "Reach 40 residents for the Midsummer Fair", metric: "population", need: 40, coins: 2200, xp: 240 },
    autumn: { id: "s-autumn", text: "Place 6 decorations for Harvest Week", metric: "decor", need: 6, coins: 1800, xp: 200 },
    winter: { id: "s-winter", text: "Upgrade 2 buildings for Lights & Lanterns", metric: "upgrades", need: 2, coins: 2400, xp: 260 }
  };
  const q = defs[s.id];
  const absolute = absKeys.has(q.metric);
  const progress = absolute ? metric(q.metric) : Math.max(0, metric(q.metric) - (base[q.metric] || 0));
  return { ...q, title: s.event, event: s.id, progress: clamp(progress, 0, q.need), done: progress >= q.need, claimed: !!S.seasonClaimed, season: s };
}

export function dateKey() {
  const d = new Date();
  return d.getUTCFullYear() + "-" + String(d.getUTCMonth() + 1).padStart(2, "0") + "-" + String(d.getUTCDate()).padStart(2, "0");
}
export function weekKey() {
  const d = new Date();
  const day = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - day);
  return d.getUTCFullYear() + "-" + String(d.getUTCMonth() + 1).padStart(2, "0") + "-" + String(d.getUTCDate()).padStart(2, "0");
}
function pickQuests(pool, seed, count) {
  const r = rng(hash(seed));
  const copy = pool.slice();
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, count);
}
function ensureSchedule(force = false) {
  if (!S) return;
  const dk = dateKey(), wk = weekKey();
  if (force || !S.daily || S.daily.key !== dk) {
    const ids = pickQuests(DAILY_POOL, "daily-" + dk + "-" + S.name, 3).map((q) => q.id);
    S.daily = { key: dk, ids, base: snapshotMetrics(), claimed: [] };
    S.dayKey = dk;
  }
  if (force || !S.weekly || S.weekly.key !== wk) {
    const ids = pickQuests(WEEKLY_POOL, "weekly-" + wk, 3).map((q) => q.id);
    S.weekly = { key: wk, ids, base: snapshotMetrics(), claimed: [] };
    S.weekKey = wk;
  }
}
function snapshotMetrics() {
  const out = {};
  for (const q of DAILY_POOL.concat(WEEKLY_POOL)) out[q.metric] = metric(q.metric);
  return out;
}
export function metric(name) {
  if (!S) return 0;
  const defs = S.objects.map((o) => defOf(o.type)).filter(Boolean);
  switch (name) {
    case "houses": return defs.filter((d) => d.model === "house").length;
    case "shops": return defs.filter((d) => d.model === "shop").length;
    case "services": return defs.filter((d) => d.cat === "service").length;
    case "buildings": return defs.filter(isBuilding).length;
    case "decor": return defs.filter(isDecor).length;
    case "trees": return defs.filter((d) => d.model === "tree").length;
    case "green": return defs.filter((d) => d.model === "green").length;
    case "roads": return Object.keys(S.roads).length;
    case "population": return S.population;
    case "capacity": return economy().capacity;
    case "jobs": return economy().jobs;
    case "happiness": return S.happiness;
    case "income": return Math.round(S.stats.incomeTotal);
    case "spent": return Math.round(S.stats.spent);
    case "upgrades": return S.stats.upgrades;
    case "level": return S.level;
    case "likes": return S.likes || 0;
    case "dailyClaimed": return S.stats.dailyClaims;
    default: return 0;
  }
}
function enrichQuest(q, state, base) {
  const absolute = absKeys.has(q.metric);
  const current = metric(q.metric);
  const start = base && base[q.metric] !== undefined ? base[q.metric] : 0;
  const progress = absolute ? current : Math.max(0, current - start);
  return { ...q, progress: Math.min(q.need, progress), done: progress >= q.need, claimed: state.includes(q.id), absolute };
}
export function dailyQuests() {
  if (!S || !S.daily) return [];
  return S.daily.ids.map((id) => {
    const q = DAILY_POOL.find((x) => x.id === id);
    return q ? enrichQuest(q, S.daily.claimed, S.daily.base) : null;
  }).filter(Boolean);
}
export function weeklyQuests() {
  if (!S || !S.weekly) return [];
  return S.weekly.ids.map((id) => {
    const q = WEEKLY_POOL.find((x) => x.id === id);
    return q ? enrichQuest(q, S.weekly.claimed, S.weekly.base) : null;
  }).filter(Boolean);
}
export function achievements() {
  return ACHIEVEMENTS.map((a) => ({
    ...a,
    progress: Math.min(a.need, metric(a.metric)),
    unlocked: !!S.achievements[a.id]
  }));
}
export function claimQuest(scope, id) {
  if (scope === "season") {
    const q = seasonalQuest();
    if (q.id !== id) return { ok: false };
    if (!q.done) return { ok: false, reason: "Not finished yet." };
    if (q.claimed) return { ok: false, reason: "Already claimed." };
    S.seasonClaimed = true;
    S.coins += q.coins;
    addXp(q.xp);
    checkAchievements();
    dirty(); saveLocal();
    toast("Seasonal event complete", q.title + " celebrated. +" + q.coins + " coins.", "good");
    return { ok: true };
  }
  const store = scope === "daily" ? S.daily : scope === "weekly" ? S.weekly : null;
  const pool = scope === "daily" ? DAILY_POOL : WEEKLY_POOL;
  if (!store) return { ok: false };
  if (store.claimed.includes(id)) return { ok: false, reason: "Already claimed." };
  const q = pool.find((x) => x.id === id);
  if (!q) return { ok: false };
  const quest = enrichQuest(q, store.claimed, store.base);
  if (!quest.done) return { ok: false, reason: "Not finished yet." };
  store.claimed.push(id);
  S.coins += q.coins;
  addXp(q.xp);
  if (scope === "daily") {
    S.stats.dailyClaims++;
    if (store.claimed.length === 3 && !store.bonus) {
      store.bonus = true;
      S.coins += 800;
      addXp(80);
      toast("All daily quests claimed", "A perfect day in Little Town. +800 bonus coins.", "good");
    }
  }
  checkAchievements();
  dirty(); saveLocal();
  toast("Quest complete", q.text + " +" + q.coins + " coins.", "good");
  return { ok: true };
}
export function checkAchievements() {
  if (!S) return [];
  const unlocked = [];
  let changed = false;
  for (const a of ACHIEVEMENTS) {
    if (S.achievements[a.id]) continue;
    if (metric(a.metric) >= a.need) {
      S.achievements[a.id] = true;
      changed = true;
      unlocked.push(a);
      if (a.xp) addXp(a.xp);
      toast("Achievement", a.name, "good");
    }
  }
  if (changed) { dirty(); saveLocal(); }
  return unlocked;
}
export function addXp(n) {
  if (!S) return;
  S.xp += Math.max(0, Math.round(n));
  const next = levelFromXp(S.xp);
  if (next > S.level) {
    const gained = next - S.level;
    S.level = next;
    S.coins += gained * 280;
    if (hooks.onLevel) hooks.onLevel(next);
    toast("Level " + next, "New buildings unlocked and " + gained * 280 + " coins awarded.", "good");
  }
}
export function xpInfo() {
  const level = S.level;
  const start = xpForLevel(level);
  const end = xpForLevel(level + 1);
  return { level, start, end, need: Math.max(1, end - S.xp), span: Math.max(1, end - start), pct: clamp((S.xp - start) / Math.max(1, end - start), 0, 1) };
}

/* ---------------------------------------------------------------------
   Day cycle and HUD
   --------------------------------------------------------------------- */
function endDay() {
  const report = {
    day: S.day,
    population: S.population,
    happiness: S.happiness,
    income: Math.round(S.todayIncome),
    expense: Math.round(S.todayExpense),
    buildings: metric("buildings"),
    season: season().name
  };
  S.history.unshift(report);
  S.history = S.history.slice(0, 40);
  S.day += 1;
  S.dayProgress = 0;
  S.todayIncome = 0;
  S.todayExpense = 0;
  ensureSeason();
  ensureSchedule();
  checkAchievements();
  saveLocal(true);
  if (hooks.onDay) hooks.onDay(report);
  hud();
}

export function tick(dt) {
  if (!S || !runtime.started || runtime.mode !== "town") return;
  const step = Math.min(0.12, Math.max(0, dt));
  S.dayProgress += step / CONFIG.dayLength;
  updateEconomy(step);
  recomputeHappinessTick(step);
  updatePopulation(step);
  updateResidents(step);
  runtime.scheduleTimer += step;
  if (runtime.scheduleTimer > 4) {
    runtime.scheduleTimer = 0;
    ensureSeason();
    ensureSchedule();
    checkAchievements();
  }
  if (S.dayProgress >= 1) endDay();
}

export function hudData() {
  const eco = economy();
  const info = xpInfo();
  const nextLand = CONFIG.landSteps[S.land] || null;
  return {
    coins: Math.round(S.coins),
    name: S.name,
    level: S.level,
    xpPct: info.pct,
    population: S.population,
    capacity: eco.capacity,
    happiness: S.happiness,
    jobs: eco.jobs,
    employment: eco.employment,
    rating: rating(),
    townLevel: townLevel(),
    day: S.day,
    dayProgress: S.dayProgress,
    season: season(),
    seasonDays: seasonDaysLeft(),
    income: eco.incomeRate,
    expense: eco.expenseRate,
    net: eco.netRate,
    buildings: metric("buildings"),
    roads: metric("roads"),
    land: S.land,
    landName: landStep(S.land).name,
    nextLand: nextLand ? { name: nextLand.name, cost: nextLand.cost } : null,
    likes: S.likes || 0
  };
}

export function tip() {
  const i = (S.day + S.objects.length) % TIPS.length;
  return TIPS[i];
}

/* ---------------------------------------------------------------------
   Visiting another town
   --------------------------------------------------------------------- */
export function readVisitLayout(town) {
  if (!town || !town.layout) return null;
  try {
    const layout = JSON.parse(town.layout);
    if (!layout || !Array.isArray(layout.objects) || layout.objects.length > 420) return null;
    const roads = {};
    if (layout.roads && typeof layout.roads === "object") {
      for (const [k, v] of Object.entries(layout.roads).slice(0, 3000)) {
        const [i, j] = k.split(",").map(Number);
        if (Number.isFinite(i) && Number.isFinite(j) && ROAD_BY_ID[v]) roads[k] = v;
      }
    }
    return { name: layout.name || town.name || "A town", land: clamp(Math.round(+layout.land) || 1, 1, 5), season: clamp(Math.round(+layout.season) || 0, 0, 3), objects: layout.objects.slice(0, 420), roads };
  } catch (error) { return null; }
}

/* ---------------------------------------------------------------------
   Small helpers for UI
   --------------------------------------------------------------------- */
export function objectDef(obj) { return defOf(obj.type); }
export function objectActive(obj) { return isDecor(defOf(obj.type)) || hasRoadAccess(obj); }
export function buildingCategories() {
  return [
    { id: "house", name: "Homes", icon: "🏡" },
    { id: "shop", name: "Shops", icon: "🥐" },
    { id: "service", name: "Services", icon: "🏛️" },
    { id: "community", name: "Community", icon: "🌳" }
  ];
}
export function catalog(cat) {
  return BUILDINGS.filter((d) => d.cat === cat).sort((a, b) => a.unlock - b.unlock || a.cost - b.cost);
}
export function decorCatalog(group) {
  return DECOR.filter((d) => !group || group === "All" || d.group === group).sort((a, b) => a.unlock - b.unlock || a.cost - b.cost);
}
export function roadCatalog() { return Object.values(ROAD_BY_ID); }
export function catLabel(cat) { return CAT_LABEL[cat] || cat; }
export { DEFS, BUILDINGS, DECOR, SEASONS, ACHIEVEMENTS, DAILY_POOL, WEEKLY_POOL };
