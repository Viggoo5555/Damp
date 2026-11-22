/* =====================================================================
   PET CAFÉ — the simulation
   Economy, customers, cooking, animals, quests, saving and cloud sync.
   ===================================================================== */
import * as THREE from "three";
import {
  ANIMALS, animalById, RECIPES, recipeById, FURNITURE, FLOORING, WALLS,
  furnitureById, CUSTOMERS, PANTRY, PANTRY_PACKS, QUEST_POOL, ACHIEVEMENTS,
  DAILY_REWARDS, EXPANSIONS, REVIEW_LINES, levelInfo, levelForXp, RARITIES
} from "./data.js";
import { CONFIG } from "./config.js";
import { buildFood } from "./models.js";
import * as world from "./scene.js";
import * as cloud from "./cloud.js";

/* ---------------------------------------------------------------------
   State
   --------------------------------------------------------------------- */
const DAY = () => new Date().toISOString().slice(0, 10);

function freshQuests() {
  const day = DAY();
  const seed = day.split("-").join("") | 0;
  const pool = QUEST_POOL.slice();
  const picked = [];
  for (let i = 0; i < 3; i++) {
    const index = Math.abs(Math.sin(seed * (i + 1.7)) * 10000) % pool.length | 0;
    picked.push({ ...pool.splice(index, 1)[0], progress: 0, claimed: false });
  }
  return { day, list: picked };
}

function defaultState() {
  return {
    version: 1,
    name: "Guest",
    coins: CONFIG.startCoins,
    xp: CONFIG.startXp,
    treats: 6,
    pantry: { beans: 10, milk: 12, flour: 12, fruit: 8, berries: 8, chocolate: 6, cream: 8, matcha: 6 },
    recipes: [],
    inv: {
      "counter-cafe": 1, "kitchen-stove": 1, "kitchen-oven": 1,
      "kitchen-espresso": 1, "kitchen-blender": 1, "kitchen-freezer": 1, "kitchen-prep": 1,
      "table-bistro": 2, "chair-bentwood": 4, "table-square": 1,
      "chair-arm": 2, "sofa-loveseat": 1,
      "plant-monstera": 1, "plant-tulips": 1,
      "door-cafe": 1, "window-wide": 1, "sign-chalk": 1, "sign-hanging": 1,
      "lamp-pendant": 2, "decor-rug": 1, "decor-picture": 1,
      "out-patiotable": 1, "out-chair": 2, "out-umbrella": 1, "out-planter": 1
    },
    layout: starterLayout(),
    paints: ["floor-oak", "wall-cream"],
    animals: [{ id: "mochi", name: "Mochi", happiness: 88, active: true, at: Date.now() }],
    likes: 0,
    rating: 0,
    visits: 0,
    rep: 62,
    stats: {
      served: 0, perfect: 0, cooked: 0, earned: 0, petted: 0, fed: 0,
      reviews5: 0, visits: 0, likesGiven: 0, restocks: 0, placed: 0, entered: 0, expansions: 0
    },
    achievements: {},
    eventUnlocks: {},
    reviews: [],
    quests: freshQuests(),
    daily: { last: null, streak: 0 },
    earnings: { day: DAY(), coins: 0, customers: 0 },
    comp: { enteredWeek: null, votedWeek: null },
    settings: { sound: true, quality: true, snap: true, name: "Guest" },
    lastSeen: Date.now()
  };
}

function starterLayout() {
  const items = [];
  let n = 0;
  const put = (id, x, z, ry = 0, wall = null) => {
    const def = furnitureById(id);
    items.push({ uid: "s" + (++n), id, x, z, ry, wall: wall || undefined, def });
  };
  put("counter-cafe", -3.4, -5.15);
  put("kitchen-stove", 1.1, -5.35);
  put("kitchen-oven", 2.6, -5.32);
  put("kitchen-espresso", 4.05, -5.28);
  put("kitchen-blender", 4.95, -5.28);
  put("kitchen-freezer", 6.25, -4.95);
  put("kitchen-prep", 5.4, -3.3);
  put("table-bistro", -3.5, -1.1);
  put("chair-bentwood", -4.35, -1.1);
  put("chair-bentwood", -2.65, -1.1);
  put("chair-bentwood", -3.5, -1.95);
  put("chair-bentwood", -3.5, -0.25);
  put("table-square", 0.75, 0.25);
  put("chair-bentwood", -0.1, 0.25);
  put("chair-bentwood", 1.6, 0.25);
  put("chair-bentwood", 0.75, -0.6);
  put("chair-bentwood", 0.75, 1.1);
  put("sofa-loveseat", -6.35, 1.1, Math.PI / 2);
  put("chair-arm", -6.2, 3.1, Math.PI / 2);
  put("decor-rug", 4.9, 2.15);
  put("sofa-loveseat", 4.9, 2.15, -Math.PI / 2);
  put("lamp-floor", 3.35, 3.25);
  put("plant-cactus", 6.35, 3.25);
  put("decor-books", 5.7, 3.05);
  put("plant-monstera", -7.05, -3.9);
  put("plant-tulips", 6.9, 0.2);
  put("decor-rug", 0.75, 0.25);
  put("door-cafe", -7.94, 2.6, Math.PI / 2, "left");
  put("window-wide", -5.8, -5.94, 0, "back");
  put("sign-chalk", 0.2, -5.94, 0, "back");
  put("decor-picture", 6.4, -5.94, 0, "back");
  put("sign-hanging", 2.0, -5.94, 0, "back");
  put("decor-garland", -2.9, -5.94, 0, "back");
  put("decor-clock", 3.9, -5.94, 0, "back");
  put("lamp-pendant", -2.4, -1.2);
  put("lamp-pendant", 0.8, 0.3);
  put("out-patiotable", 0, 8.2);
  put("out-chair", 0, 7.2);
  put("out-chair", 0, 9.2);
  put("out-umbrella", 0, 8.2);
  put("out-planter", -4.2, 9.0);
  put("out-planter", 4.2, 9.0);
  return { floor: "floor-oak", wall: "wall-cream", expansions: 0, items };
}

export const S = defaultState();

export const runtime = {
  customers: [], orders: [], residents: [], strays: [],
  seats: [], seatCache: 0, nextId: 1, nextOrder: 1,
  spawnTimer: 8, cooking: null, hover: null, visiting: null,
  sessionServed: 0, lastBump: {}, ready: false, lastFrame: 0
};

export const hooks = {
  toast() {}, save() {}, sound() {}, float() {}, refresh() {}, scene() {},
  bubble() {}, levelUp() {}, adoptable() {}
};
export function setHooks(next) { Object.assign(hooks, next); }

const listeners = new Set();
export function listen(fn) { listeners.add(fn); return () => listeners.delete(fn); }
function notify() { listeners.forEach((fn) => { try { fn(); } catch (error) { console.warn(error); } }); }

/* ---------------------------------------------------------------------
   Save / load
   --------------------------------------------------------------------- */
let saveTimer = null;
let lastCloud = 0;
let dirty = true;

export function packState() {
  return {
    version: 1, name: S.name, coins: S.coins, xp: S.xp, treats: S.treats,
    pantry: S.pantry, recipes: S.recipes, inv: S.inv,
    layout: {
      floor: S.layout.floor, wall: S.layout.wall, expansions: S.layout.expansions,
      items: S.layout.items.map((i) => ({ uid: i.uid, id: i.id, x: i.x, z: i.z, ry: i.ry || 0, wall: i.wall || null }))
    },
    paints: S.paints, animals: S.animals, likes: S.likes, rating: S.rating,
    visits: S.visits, rep: S.rep, stats: S.stats, achievements: S.achievements,
    eventUnlocks: S.eventUnlocks, reviews: S.reviews, quests: S.quests,
    daily: S.daily, earnings: S.earnings, comp: S.comp, settings: S.settings,
    lastSeen: Date.now()
  };
}

export function hydrate(data) {
  if (!data || typeof data !== "object") return;
  const base = defaultState();
  S.name = typeof data.name === "string" && data.name.trim() ? data.name.trim().slice(0, 20) : base.name;
  S.coins = clampInt(data.coins, 0, 99999999, base.coins);
  S.xp = clampInt(data.xp, 0, 99999999, 0);
  S.treats = clampInt(data.treats, 0, 9999, base.treats);
  S.pantry = Object.assign({}, base.pantry, data.pantry && typeof data.pantry === "object" ? data.pantry : {});
  Object.keys(S.pantry).forEach((k) => { S.pantry[k] = clampInt(S.pantry[k], 0, 9999, 0); });
  S.recipes = Array.isArray(data.recipes) ? data.recipes.filter((id) => recipeById(id)) : [];
  S.inv = {};
  if (data.inv && typeof data.inv === "object") {
    Object.keys(data.inv).forEach((id) => {
      if (furnitureById(id) && Number(data.inv[id]) > 0) S.inv[id] = clampInt(data.inv[id], 0, 99, 0);
    });
  }
  S.layout = {
    floor: FLOORING.some((f) => f.id === data.layout?.floor) ? data.layout.floor : base.layout.floor,
    wall: WALLS.some((w) => w.id === data.layout?.wall) ? data.layout.wall : base.layout.wall,
    expansions: clampInt(data.layout?.expansions, 0, EXPANSIONS.length, 0),
    items: []
  };
  const seen = new Set();
  (Array.isArray(data.layout?.items) ? data.layout.items : []).slice(0, CONFIG.maxLayoutItems).forEach((entry) => {
    const def = furnitureById(entry.id);
    if (!def || def.kind === "floor" || def.kind === "wall") return;
    const uid = typeof entry.uid === "string" ? entry.uid : "i" + Math.random().toString(36).slice(2, 8);
    if (seen.has(uid)) return;
    seen.add(uid);
    S.layout.items.push({
      uid, id: entry.id, x: clampNum(entry.x, -30, 30, 0), z: clampNum(entry.z, -30, 30, 0),
      ry: clampNum(entry.ry, -7, 7, 0), wall: entry.wall || undefined, def
    });
  });
  if (!S.layout.items.length) S.layout = starterLayout();
  S.paints = Array.isArray(data.paints) ? data.paints.filter((id) => FLOORING.some((f) => f.id === id) || WALLS.some((w) => w.id === id)) : base.paints;
  S.animals = [];
  (Array.isArray(data.animals) ? data.animals : base.animals).slice(0, 60).forEach((a) => {
    const def = animalById(a.id);
    if (!def || S.animals.some((x) => x.id === a.id)) return;
    S.animals.push({
      id: a.id, name: typeof a.name === "string" && a.name.trim() ? a.name.slice(0, 16) : def.name,
      happiness: clampInt(a.happiness, 0, 100, 80), active: !!a.active, at: +a.at || Date.now()
    });
  });
  if (!S.animals.some((a) => a.id === "mochi")) S.animals.unshift(base.animals[0]);
  S.likes = clampInt(data.likes, 0, 999999, 0);
  S.rating = clampNum(data.rating, 0, 5, 0);
  S.visits = clampInt(data.visits, 0, 999999, 0);
  S.rep = clampNum(data.rep, 0, 100, 62);
  S.stats = Object.assign({}, base.stats, data.stats && typeof data.stats === "object" ? data.stats : {});
  Object.keys(S.stats).forEach((k) => { S.stats[k] = clampInt(S.stats[k], 0, 99999999, 0); });
  S.achievements = data.achievements && typeof data.achievements === "object" ? data.achievements : {};
  S.eventUnlocks = data.eventUnlocks && typeof data.eventUnlocks === "object" ? data.eventUnlocks : {};
  S.reviews = Array.isArray(data.reviews) ? data.reviews.slice(-12).filter((r) => r && r.stars) : [];
  S.quests = data.quests && data.quests.day === DAY() && Array.isArray(data.quests.list) ? data.quests : freshQuests();
  if (!Array.isArray(S.quests.list) || S.quests.list.length !== 3) S.quests = freshQuests();
  S.daily = data.daily && typeof data.daily === "object" ? { last: data.daily.last || null, streak: clampInt(data.daily.streak, 0, 99, 0) } : base.daily;
  S.earnings = data.earnings && data.earnings.day === DAY() ? data.earnings : { day: DAY(), coins: 0, customers: 0 };
  S.comp = data.comp && typeof data.comp === "object" ? { enteredWeek: data.comp.enteredWeek || null, votedWeek: data.comp.votedWeek || null } : base.comp;
  S.settings = Object.assign({}, base.settings, data.settings || {});
  S.settings.name = S.name;
  S.recipes = RECIPES.filter((r) => r.level <= levelForXp(S.xp)).map((r) => r.id);
  S.ready = true;
}

export function loadLocal() {
  try {
    const raw = localStorage.getItem(CONFIG.storageKey);
    if (raw) {
      hydrate(JSON.parse(raw));
      return true;
    }
  } catch (error) { console.warn("Pet Café: could not read the local save", error); }
  return false;
}

export function saveLocal() {
  try {
    localStorage.setItem(CONFIG.storageKey, JSON.stringify(packState()));
    localStorage.setItem(CONFIG.storageKey + "-name", S.name);
  } catch (error) { /* storage full or blocked */ }
}

export function markDirty() {
  dirty = true;
  saveLocal();
  if (hooks.save) hooks.save("saving");
  clearTimeout(saveTimer);
  saveTimer = setTimeout(flush, 1100);
}
function flush() {
  saveLocal();
  if (cloud.getUser() && !cloud.getUser().guest) {
    cloud.saveGame(packState(), publicDoc())
      .then(() => hooks.save("cloud"))
      .catch(() => hooks.save("error"));
  } else {
    hooks.save("local");
  }
}
function touch(options = {}) {
  notify();
  markDirty();
  if (options.scene) hooks.scene();
  if (options.all) rebuildWorld();
}

export function publicDoc() {
  const info = levelInfo(S.xp);
  return {
    uid: cloud.getUser() ? cloud.getUser().uid : "guest",
    name: S.name.slice(0, 20),
    nameLower: S.name.toLowerCase().slice(0, 20),
    level: info.level,
    xp: S.xp,
    likes: S.likes,
    rating: S.rating,
    rep: Math.round(S.rep),
    layout: {
      floor: S.layout.floor, wall: S.layout.wall, expansions: S.layout.expansions,
      items: S.layout.items.map((i) => ({ id: i.id, x: round2(i.x), z: round2(i.z), ry: round3(i.ry || 0), wall: i.wall || null }))
    },
    animals: S.animals.filter((a) => a.active).slice(0, CONFIG.maxActiveAnimals).map((a) => ({ id: a.id, name: a.name })),
    updated: Date.now()
  };
}

export function setPlayerName(name) {
  const clean = String(name || "").trim().slice(0, 20);
  if (!clean) return false;
  S.name = clean;
  S.settings.name = clean;
  touch();
  return true;
}

export async function syncPublic() {
  if (!cloud.getUser() || cloud.getUser().guest) return;
  try { await cloud.savePublic(publicDoc()); } catch (error) { /* online only */ }
}

export async function attachAccount(user) {
  const local = packState();
  const remote = await cloud.loadGame(user.uid);
  if (remote && typeof remote === "object" && (remote.coins > 0 || remote.layout)) {
    hydrate(remote);
    if (!S.name || S.name === "Guest") S.name = user.name;
    hooks.toast("Welcome back", "Your café is right where you left it.", "check");
  } else {
    hydrate(local);
    S.name = user.name;
    await cloud.saveGame(packState(), publicDoc());
  }
  S.settings.name = S.name;
  runtime.ready = true;
  rebuildWorld();
  syncPublic();
  touch();
  startPresence();
}

let presenceTimer = null;
function startPresence() {
  clearInterval(presenceTimer);
  if (!cloud.getUser() || cloud.getUser().guest) return;
  const beat = () => cloud.presence().catch(() => {});
  beat();
  presenceTimer = setInterval(beat, 50000);
}

/* ---------------------------------------------------------------------
   Money, XP, levels
   --------------------------------------------------------------------- */
export function level() { return levelInfo(S.xp).level; }
export function addCoins(amount) {
  S.coins = Math.max(0, Math.round(S.coins + amount));
  touch();
}
export function addXp(amount) {
  const before = level();
  S.xp = Math.max(0, Math.round(S.xp + amount));
  const after = level();
  if (after > before) levelUp(before, after);
  touch();
}
function levelUp(from, to) {
  const coins = 80 + to * 45;
  S.coins += coins;
  const unlocked = RECIPES.filter((r) => r.level > from && r.level <= to);
  const pieces = FURNITURE.filter((f) => f.level > from && f.level <= to);
  S.recipes = RECIPES.filter((r) => r.level <= to).map((r) => r.id);
  hooks.levelUp({ level: to, coins, recipes: unlocked, pieces });
  hooks.sound("level");
  checkAchievements();
}
export function unlockedRecipes() {
  return RECIPES.filter((r) => r.level <= level());
}
export function averageHappiness() {
  if (!S.animals.length) return 0;
  return S.animals.reduce((sum, a) => sum + a.happiness, 0) / S.animals.length;
}
export function ambience() {
  return S.layout.items.reduce((sum, item) => {
    const def = furnitureById(item.id);
    return sum + (def ? def.ambience || 0 : 0);
  }, 0);
}
export function stationCount(kind) {
  return S.layout.items.filter((i) => { const d = furnitureById(i.id); return d && d.station === kind; }).length;
}

/* ---------------------------------------------------------------------
   Daily reset, quests, achievements
   --------------------------------------------------------------------- */
export function checkDay() {
  const day = DAY();
  if (S.earnings.day !== day) S.earnings = { day, coins: 0, customers: 0 };
  if (S.quests.day !== day) {
    S.quests = freshQuests();
    touch();
  }
}

export function bump(metric, amount = 1) {
  if (S.stats[metric] === undefined) S.stats[metric] = 0;
  S.stats[metric] += amount;
  let changed = false;
  S.quests.list.forEach((quest) => {
    if (quest.metric === metric && !quest.claimed && quest.progress < quest.goal) {
      quest.progress = Math.min(quest.goal, quest.progress + amount);
      changed = true;
    }
  });
  const done = checkAchievements();
  if (changed || done.length) touch();
}

export function claimQuest(id) {
  const quest = S.quests.list.find((q) => q.id === id);
  if (!quest || quest.claimed) return false;
  if (quest.progress < quest.goal) { hooks.toast("Not yet", "Keep going — this quest is still in progress.", "quest", true); return false; }
  quest.claimed = true;
  S.coins += quest.coins;
  addXp(quest.xp);
  hooks.toast("Quest complete", `+${quest.coins} coins · +${quest.xp} XP`, "coin");
  hooks.sound("chime");
  touch();
  return true;
}

export function achievementMetric(id) {
  if (id === "level") return level();
  if (id === "animals") return S.animals.length;
  if (id === "expansions") return S.layout.expansions;
  if (id === "likes") return S.likes;
  if (id === "mythical") return S.animals.filter((a) => animalById(a.id)?.rarity === "mythical").length;
  if (id === "entered") return S.stats.entered;
  return S.stats[id] || 0;
}

export function checkAchievements() {
  const unlocked = [];
  ACHIEVEMENTS.forEach((a) => {
    if (S.achievements[a.id]) return;
    if (achievementMetric(a.metric) >= a.goal) {
      S.achievements[a.id] = Date.now();
      S.coins += a.coins;
      unlocked.push(a);
      hooks.toast("Achievement", `${a.name} · +${a.coins} coins`, "trophy");
    }
  });
  if (unlocked.length) {
    hooks.sound("chime");
    // event animals that react to achievements
    if (S.stats.reviews5 >= 25) unlockEventAnimal("starburst");
  }
  return unlocked;
}

export function unlockEventAnimal(id) {
  if (S.animals.some((a) => a.id === id) || S.eventUnlocks[id]) return false;
  S.eventUnlocks[id] = Date.now();
  const def = animalById(id);
  if (def) hooks.toast("A new animal can be adopted", `${def.name} is waiting in the animal shop.`, "paw");
  touch();
  return true;
}

/* ---------------------------------------------------------------------
   Daily reward
   --------------------------------------------------------------------- */
export function dailyAvailable() { return S.daily.last !== DAY(); }
export function claimDaily() {
  if (!dailyAvailable()) return null;
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  S.daily.streak = S.daily.last === yesterday ? S.daily.streak + 1 : 1;
  S.daily.last = DAY();
  const index = (S.daily.streak - 1) % DAILY_REWARDS.length;
  const coins = DAILY_REWARDS[index];
  S.coins += coins;
  addXp(20 + index * 4);
  hooks.toast("Daily reward", `Day ${S.daily.streak} · +${coins} coins`, "gift");
  hooks.sound("chime");
  touch();
  return { coins, index, streak: S.daily.streak };
}

/* ---------------------------------------------------------------------
   Layout helpers
   --------------------------------------------------------------------- */
export function patioDepth() { return CONFIG.room.patio + S.layout.expansions * 3; }

export function bounds() {
  return {
    minX: -CONFIG.room.w / 2 + 0.35, maxX: CONFIG.room.w / 2 - 0.35,
    minZ: -CONFIG.room.d / 2 + 0.35, maxZ: CONFIG.room.d / 2 + patioDepth() - 0.4
  };
}

export function footprint(entry) {
  const def = furnitureById(entry.id) || entry.def;
  const s = 1;
  const w = (def.w || 0.5) * s, d = (def.d || 0.5) * s;
  const ry = entry.ry || 0;
  const c = Math.abs(Math.cos(ry)), si = Math.abs(Math.sin(ry));
  return { hw: (w * c + d * si) / 2, hd: (w * si + d * c) / 2 };
}

export function canPlace(def, x, z, ry, wall, ignoreUid) {
  if (!def) return false;
  if (def.place === "wall") {
    if (!wall) return false;
    if (wall === "back") return Math.abs(x) <= CONFIG.room.w / 2 - 0.15 && Math.abs(z + CONFIG.room.d / 2) < 0.5;
    if (wall === "left") return Math.abs(z) <= CONFIG.room.d / 2 - 0.15 && Math.abs(x + CONFIG.room.w / 2) < 0.5;
    if (wall === "right") return Math.abs(z) <= CONFIG.room.d / 2 - 0.15 && Math.abs(x - CONFIG.room.w / 2) < 0.5;
    return false;
  }
  const b = bounds();
  if (x < b.minX || x > b.maxX || z < b.minZ || z > b.maxZ) return false;
  if (def.place === "ceiling") return z < CONFIG.room.d / 2;
  const probe = { id: def.id, x, z, ry, def };
  const a = footprint(probe);
  if (def.rug) return true;
  for (const other of S.layout.items) {
    if (other.uid === ignoreUid) continue;
    const od = furnitureById(other.id);
    if (!od || od.place === "wall" || od.place === "ceiling" || od.rug) continue;
    const bf = footprint(other);
    if (Math.abs(x - other.x) < a.hw + bf.hw - 0.08 && Math.abs(z - other.z) < a.hd + bf.hd - 0.08) return false;
  }
  return true;
}

export function nearestWall(x, y) {
  const hit = world.wallAt(x, y);
  if (!hit) return null;
  const D = CONFIG.room.d, W = CONFIG.room.w;
  let wall = hit.wall;
  if (wall === "right") wall = "right";
  const point = hit.point;
  if (wall === "back") return { wall, x: clampNum(point.x, -W / 2 + 0.3, W / 2 - 0.3, 0), z: -D / 2 + 0.07 };
  if (wall === "left") return { wall, x: -W / 2 + 0.07, z: clampNum(point.z, -D / 2 + 0.3, D / 2 - 0.3, 0) };
  return { wall, x: W / 2 - 0.07, z: clampNum(point.z, -D / 2 + 0.3, D / 2 - 0.3, 0) };
}

export function placeItem(id, x, z, ry = 0, wall = null) {
  const def = furnitureById(id);
  if (!def) return false;
  if (def.place === "wall" && !wall) return false;
  if (S.layout.items.length >= CONFIG.maxLayoutItems) {
    hooks.toast("The café is full", "Remove a piece before adding another.", "warning", true);
    return false;
  }
  const snap = S.settings.snap ? CONFIG.grid : 0.05;
  x = Math.round(x / snap) * snap;
  z = Math.round(z / snap) * snap;
  if (!canPlace(def, x, z, ry, wall)) {
    hooks.toast("Not quite", "That spot is taken, or off the café floor.", "warning", true);
    return false;
  }
  const owned = S.inv[id] || 0;
  if (owned <= 0) {
    hooks.toast("Not in storage", "Buy another copy from the furniture shop.", "box", true);
    return false;
  }
  S.inv[id] = owned - 1;
  if (S.inv[id] <= 0) delete S.inv[id];
  S.layout.items.push({ uid: "i" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), id, x, z, ry, wall: wall || undefined });
  bump("placed");
  touch({ scene: true });
  hooks.sound("place");
  return true;
}

export function moveItem(uid, x, z, ry, wall) {
  const entry = S.layout.items.find((i) => i.uid === uid);
  if (!entry) return false;
  const def = furnitureById(entry.id);
  const snap = S.settings.snap ? CONFIG.grid : 0.05;
  x = Math.round(x / snap) * snap;
  z = Math.round(z / snap) * snap;
  if (!canPlace(def, x, z, ry, wall, uid)) {
    hooks.toast("Not quite", "That spot is taken.", "warning", true);
    return false;
  }
  entry.x = x; entry.z = z; entry.ry = ry; entry.wall = wall || entry.wall;
  touch({ scene: true });
  hooks.sound("place");
  return true;
}

export function removeItem(uid) {
  const index = S.layout.items.findIndex((i) => i.uid === uid);
  if (index < 0) return false;
  const entry = S.layout.items[index];
  S.inv[entry.id] = (S.inv[entry.id] || 0) + 1;
  S.layout.items.splice(index, 1);
  touch({ scene: true });
  hooks.sound("click");
  return true;
}

export function buyFurniture(id) {
  const def = furnitureById(id);
  if (!def) return { ok: false };
  if (level() < def.level) return { ok: false, reason: `Unlocks at level ${def.level}` };
  if (S.coins < def.price) return { ok: false, reason: "Not enough coins yet" };
  S.coins -= def.price;
  S.inv[id] = (S.inv[id] || 0) + 1;
  hooks.toast("Added to storage", def.name, "box");
  hooks.sound("buy");
  touch();
  return { ok: true };
}

export function buyPaint(id) {
  const def = FLOORING.find((f) => f.id === id) || WALLS.find((w) => w.id === id);
  if (!def) return false;
  if (S.paints.includes(id)) {
    if (def.kind === "floor") S.layout.floor = id; else S.layout.wall = id;
    touch({ scene: true });
    return true;
  }
  if (level() < def.level) { hooks.toast("Still locked", `Unlocks at level ${def.level}`, "lock", true); return false; }
  if (S.coins < def.price) { hooks.toast("Not enough coins", "Serve a few more guests first.", "coin", true); return false; }
  S.coins -= def.price;
  S.paints.push(id);
  if (def.kind === "floor") S.layout.floor = id; else S.layout.wall = id;
  hooks.toast("Painted", def.name, "paint");
  hooks.sound("buy");
  touch({ scene: true });
  return true;
}

export function buyExpansion() {
  const next = EXPANSIONS[S.layout.expansions];
  if (!next) return false;
  if (level() < next.level) { hooks.toast("Not yet", `${next.name} unlocks at level ${next.level}.`, "lock", true); return false; }
  if (S.coins < next.price) { hooks.toast("Not enough coins", `${next.name} costs ${next.price} coins.`, "coin", true); return false; }
  S.coins -= next.price;
  S.layout.expansions += 1;
  bump("expansions");
  hooks.toast("The café grew", next.name + " is open for business.", "sparkle");
  hooks.sound("level");
  touch({ scene: true });
  return true;
}

export function buyPantry(id, amount) {
  const item = PANTRY.find((p) => p.id === id) || PANTRY_PACKS.find((p) => p.id === id);
  if (!item) return false;
  if (S.coins < item.price) { hooks.toast("Not enough coins", "Serve a few more orders first.", "coin", true); return false; }
  S.coins -= item.price;
  if (item.contents) {
    Object.keys(item.contents).forEach((key) => {
      if (!S.pantry[key] && S.pantry[key] !== 0) return;
      S.pantry[key] = (S.pantry[key] || 0) + item.contents[key];
    });
  } else {
    S.pantry[id] = (S.pantry[id] || 0) + item.packet;
  }
  bump("restocks");
  hooks.toast("Pantry restocked", item.name, "basket");
  hooks.sound("buy");
  touch();
  return true;
}

export function buyTreats() {
  if (S.coins < 60) { hooks.toast("Not enough coins", "Treats cost 60 coins for five.", "coin", true); return false; }
  S.coins -= 60;
  S.treats += 5;
  hooks.toast("Treats", "Five little biscuits for your friends.", "bone");
  hooks.sound("buy");
  touch();
  return true;
}

/* ---------------------------------------------------------------------
   Seats
   --------------------------------------------------------------------- */
export function seats() {
  const now = performance.now();
  if (now - runtime.seatCache < 500 && runtime.seats.length) return runtime.seats;
  runtime.seatCache = now;
  const list = [];
  const tables = S.layout.items.filter((i) => { const d = furnitureById(i.id); return d && d.table; });
  const chairs = S.layout.items.filter((i) => { const d = furnitureById(i.id); return d && d.chair; });
  chairs.forEach((chair) => {
    let best = null, bestD = 3.2;
    tables.forEach((table) => {
      const d = Math.hypot(chair.x - table.x, chair.z - table.z);
      if (d < bestD) { bestD = d; best = table; }
    });
    if (!best) return;
    const yaw = Math.atan2(best.x - chair.x, best.z - chair.z);
    list.push({
      id: chair.uid, chair, table: best, x: chair.x, z: chair.z, yaw,
      occupied: runtime.customers.some((c) => c.seat && c.seat.id === chair.uid && c.phase !== "leave")
    });
  });
  runtime.seats = list;
  return list;
}

export function freeSeat() {
  return seats().find((s) => !s.occupied) || null;
}

/* ---------------------------------------------------------------------
   World
   --------------------------------------------------------------------- */
export function rebuildWorld() {
  world.setLayout(S.layout, { readonly: !!runtime.visiting });
  spawnResidents();
  if (runtime.visiting) {
    runtime.strays.forEach((s) => world.removeActor(s.handle));
    runtime.strays = [];
  } else {
    ensureStray();
  }
  hooks.scene();
}

export function startVisit(cafe) {
  if (!cafe || !cafe.layout) return false;
  exitVisit(true);
  runtime.visiting = { uid: cafe.uid, name: cafe.name || "A café", level: cafe.level || 1, likes: cafe.likes || 0, rating: cafe.rating || 0 };
  const layout = {
    floor: cafe.layout.floor || "floor-oak",
    wall: cafe.layout.wall || "wall-cream",
    expansions: Math.min(EXPANSIONS.length, +cafe.layout.expansions || 0),
    items: (cafe.layout.items || []).slice(0, CONFIG.maxLayoutItems).map((entry, i) => {
      const def = furnitureById(entry.id);
      return def ? { uid: "v" + i, id: entry.id, x: +entry.x || 0, z: +entry.z || 0, ry: +entry.ry || 0, wall: entry.wall || undefined, def } : null;
    }).filter(Boolean)
  };
  clearCustomers(true);
  runtime.orders = [];
  world.setLayout(layout, { readonly: true });
  world.clearActors();
  const animals = (cafe.animals || []).slice(0, 6);
  animals.forEach((a, i) => {
    const def = animalById(a.id);
    if (!def) return;
    const spot = visitorSpot(i);
    const handle = world.spawnActor({ id: "visit" + i, kind: "animal", cfg: def, x: spot.x, z: spot.z, yaw: spot.yaw });
    handle.name = a.name || def.name;
  });
  S.stats.visits += 1;
  bump("visits");
  hooks.toast(`Visiting ${runtime.visiting.name}`, "Look around, leave a heart if you like it.", "home");
  notify();
  markDirty();
  return true;
}

function visitorSpot(i) {
  const spots = [[-3, 1.5], [1.5, -0.5], [5, 1], [-5.5, 7.5], [2, 7], [5.5, 7.5]];
  return { x: spots[i % spots.length][0], z: spots[i % spots.length][1], yaw: Math.PI * 0.7 };
}

export function exitVisit(silent) {
  if (!runtime.visiting) return;
  runtime.visiting = null;
  world.setLayout(S.layout, { readonly: false });
  spawnResidents();
  if (!silent) hooks.toast("Home again", "Your café missed you.", "home");
  notify();
}

/* ---------------------------------------------------------------------
   Animals
   --------------------------------------------------------------------- */
export function activeAnimals() {
  return S.animals.filter((a) => a.active);
}
function randomInteriorSpot() {
  const inside = Math.random() < 0.75;
  const b = bounds();
  return inside
    ? { x: -5.4 + Math.random() * 10.8, z: -3.4 + Math.random() * 8.2 }
    : { x: -5.4 + Math.random() * 10.8, z: 6.8 + Math.random() * Math.max(1, patioDepth() - 2) };
}
export function spawnResidents() {
  runtime.residents.forEach((r) => world.removeActor(r.handle));
  runtime.residents = [];
  activeAnimals().slice(0, CONFIG.maxActiveAnimals).forEach((animal, i) => {
    const def = animalById(animal.id);
    if (!def) return;
    const spot = randomInteriorSpot();
    const handle = world.spawnActor({ id: "pet_" + animal.id, kind: "animal", cfg: def, x: spot.x, z: spot.z, yaw: Math.random() * 6.28 });
    const r = { animal, def, handle, x: spot.x, z: spot.z, target: null, timer: 1 + Math.random() * 3, speed: 0.5 + Math.random() * 0.3, cooldown: 0 };
    runtime.residents.push(r);
  });
}

export function toggleAnimalActive(id) {
  const animal = S.animals.find((a) => a.id === id);
  if (!animal) return false;
  if (!animal.active && activeAnimals().length >= CONFIG.maxActiveAnimals) {
    hooks.toast("The café is busy", `Only ${CONFIG.maxActiveAnimals} friends can wander at once.`, "paw", true);
    return false;
  }
  animal.active = !animal.active;
  spawnResidents();
  touch();
  hooks.sound("click");
  return true;
}

export function animalUnlockedForAdopt(def) {
  if (S.animals.some((a) => a.id === def.id)) return { ready: false, owned: true };
  const u = def.unlock;
  if (u.type === "shop") return { ready: level() >= u.level && S.coins >= u.price, price: u.price, level: u.level };
  if (u.type === "rescue") return { ready: true, rescue: true };
  if (u.type === "quest") {
    const metrics = { perfect25: S.stats.perfect, pet60: S.stats.petted, level10: level(), rep92: Math.round(S.rep) };
    return { ready: metrics[u.quest] >= (u.quest === "perfect25" ? 25 : u.quest === "pet60" ? 60 : u.quest === "level10" ? 10 : 92), progress: metrics[u.quest], target: u.quest === "perfect25" ? 25 : u.quest === "pet60" ? 60 : u.quest === "level10" ? 10 : 92 };
  }
  if (u.type === "event") return { ready: !!S.eventUnlocks[def.id], event: true };
  return { ready: false };
}

export function adoptAnimal(id) {
  const def = animalById(id);
  if (!def) return false;
  if (S.animals.some((a) => a.id === id)) { hooks.toast("Already family", def.name + " already lives here.", "paw", true); return false; }
  const state = animalUnlockedForAdopt(def);
  if (!state.ready) {
    hooks.toast("Not just yet", animalLockReason(def, state), "lock", true);
    return false;
  }
  if (def.unlock.type === "shop") S.coins -= def.unlock.price;
  S.animals.push({ id, name: def.name, happiness: 86, active: activeAnimals().length < CONFIG.maxActiveAnimals, at: Date.now() });
  hooks.toast("Welcome home", `${def.name} the ${def.family} joined your café.`, "paw");
  hooks.sound("adopt");
  checkAchievements();
  spawnResidents();
  touch();
  if (def.unlock.type === "rescue") {
    runtime.strays = runtime.strays.filter((s) => s.animalId !== id);
    const stray = runtime.strays[0];
    if (stray) world.removeActor(stray.handle);
    runtime.strays = [];
    ensureStray();
  }
  return true;
}

function animalLockReason(def, state) {
  const u = def.unlock;
  if (u.type === "shop") {
    if (level() < u.level) return `${def.name} arrives at level ${u.level}.`;
    return `${def.name} costs ${u.price} coins — you have ${S.coins}.`;
  }
  if (u.type === "quest") return u.text;
  if (u.type === "event") return u.text;
  if (u.type === "rescue") return `Rescue this friend after serving ${u.served} customers.`;
  return "Keep playing to find this one.";
}

export function petAnimal(id, screen) {
  const animal = S.animals.find((a) => a.id === id);
  if (!animal) return false;
  const r = runtime.residents.find((res) => res.animal.id === id);
  if (r && r.cooldown > 0) return false;
  if (r) r.cooldown = 1.6;
  animal.happiness = Math.min(100, animal.happiness + 4);
  bump("petted");
  hooks.sound("purr");
  const pos = screen || (r ? world.projectToScreen(r.handle.headVec) : null);
  hooks.float(pos, "♥", "heart");
  touch();
  return true;
}

export function feedAnimal(id) {
  const animal = S.animals.find((a) => a.id === id);
  if (!animal) return false;
  if (S.treats <= 0) { hooks.toast("No treats left", "Pick some up in the pantry shop.", "bone", true); return false; }
  S.treats -= 1;
  animal.happiness = Math.min(100, animal.happiness + 18);
  bump("fed");
  hooks.sound("nom");
  const r = runtime.residents.find((res) => res.animal.id === id);
  const pos = r ? world.projectToScreen(r.handle.headVec) : null;
  hooks.float(pos, "♥", "heart");
  touch();
  return true;
}

function ensureStray() {
  if (runtime.visiting) return;
  if (runtime.strays.length) return;
  const candidate = ANIMALS.find((a) => a.unlock.type === "rescue" && S.stats.served >= a.unlock.served && !S.animals.some((owned) => owned.id === a.id));
  if (!candidate) return;
  const handle = world.spawnActor({ id: "stray_" + candidate.id, kind: "stray", cfg: candidate, x: -9.6, z: 2.6, yaw: Math.PI / 2 });
  const stray = { animalId: candidate.id, def: candidate, handle, x: -9.6, z: 2.6, timer: 0 };
  runtime.strays.push(stray);
  hooks.toast("A little visitor", `${candidate.name} the ${candidate.family} is waiting by the door.`, "paw");
}

export function petStray(animalId) {
  const stray = runtime.strays.find((s) => s.animalId === animalId);
  if (!stray) return false;
  return adoptAnimal(animalId);
}

/* ---------------------------------------------------------------------
   Customers
   --------------------------------------------------------------------- */
function pickCustomerType() {
  const pool = CUSTOMERS.slice();
  return pool[Math.floor(Math.random() * pool.length)];
}

function pickRecipe(type, seated) {
  const unlocked = unlockedRecipes();
  if (!unlocked.length) return null;
  const preferred = unlocked.filter((r) => r.cat === type.pref);
  const pool = preferred.length && Math.random() < 0.65 ? preferred : unlocked;
  // higher level cafés get pricier orders, with a little randomness
  const weighted = pool.filter((r) => r.level <= level());
  return weighted[Math.floor(Math.random() * weighted.length)] || pool[0];
}

export function spawnCustomer(force) {
  if (runtime.visiting) return null;
  const active = runtime.customers.filter((c) => c.phase !== "leave");
  if (active.length >= 5 && !force) return null;
  const seat = freeSeat();
  const queued = runtime.customers.filter((c) => c.phase === "queue");
  if (!seat && queued.length >= 2 && !force) return null;
  if (!seat && queued.length >= 2) return null;
  const type = pickCustomerType();
  const id = "c" + runtime.nextId++;
  const start = { x: -10.6, z: 2.62 };
  const handle = world.spawnActor({
    id, kind: "customer", cfg: { family: type.species, palette: type.palette, shape: type.shape },
    x: start.x, z: start.z, yaw: Math.PI / 2
  });
  const customer = {
    id, type, handle, x: start.x, z: start.z, phase: "walk", seat: null, timer: 0,
    path: [], onArrive: null, order: null, patience: 0, maxPatience: 0, line: type.line,
    readyAt: 0, walkSpeed: 1.45 + Math.random() * 0.25, bubble: true, taken: false, sentiment: 1
  };
  handle.customer = customer;
  runtime.customers.push(customer);
  if (seat) {
    assignSeat(customer, seat);
  } else {
    const queueSpot = queuePosition();
    walk(customer, [{ x: queueSpot.x, z: queueSpot.z }], () => {
      customer.phase = "queue";
      customer.timer = 18;
    });
  }
  hooks.sound(customer.type.id === "quack" ? "quack" : "bell");
  return customer;
}

function queuePosition() {
  const count = runtime.customers.filter((c) => c.phase === "queue").length;
  return { x: 0.9 + count * 0.9, z: -3.1 };
}

function assignSeat(customer, seat) {
  customer.seat = seat;
  seat.occupied = true;
  walk(customer, [
    { x: -8.6, z: 2.62 },
    { x: -7.2, z: 2.62 },
    { x: seat.x + 0.05, z: seat.z + 0.05 }
  ], () => {
    customer.phase = "decide";
    customer.timer = 0.7;
    world.setActorSeated(customer.handle, true);
    world.setActorPose(customer.handle, seat.x, seat.z, seat.yaw, false);
  });
}

function walk(customer, points, onArrive) {
  customer.path = points.slice();
  customer.onArrive = onArrive;
  if (points.length) {
    customer.target = points[0];
    customer.phase = customer.phase === "leave" ? "leave" : "walk";
  }
}

function sitDownAndOrder(customer) {
  const recipe = pickRecipe(customer.type, customer.seat);
  if (!recipe) { leaveCustomer(customer, 3, true); return; }
  customer.phase = "ordering";
  customer.recipe = recipe;
  customer.maxPatience = Math.round(58 + customer.type.patience * 24 + Math.random() * 12);
  customer.patience = customer.maxPatience;
  customer.timer = 0;
  hooks.sound("bell");
  notify();
}

export function takeOrder(customer) {
  if (!customer || customer.phase !== "ordering" || customer.taken) return false;
  if (runtime.orders.filter((o) => o.state !== "done" && o.state !== "lost").length >= CONFIG.maxOrders) {
    hooks.toast("Hands full", `Finish one of your ${CONFIG.maxOrders} orders first.`, "warning", true);
    return false;
  }
  const recipe = customer.recipe;
  const order = {
    id: "o" + runtime.nextOrder++, customerId: customer.id, recipeId: recipe.id,
    customerName: customer.type.name, state: "waiting", quality: 0, createdAt: Date.now()
  };
  customer.order = order;
  customer.taken = true;
  customer.phase = "waiting";
  runtime.orders.push(order);
  hooks.toast("Order taken", `${customer.type.name} would like ${recipe.name}.`, "bell");
  hooks.sound("click");
  notify();
  return true;
}

export function beginCooking(orderId) {
  const order = runtime.orders.find((o) => o.id === orderId);
  if (!order || order.state !== "waiting") return { ok: false, reason: "That order is already handled." };
  if (runtime.cooking) return { ok: false, reason: "One dish at a time — finish the one on the counter." };
  const recipe = recipeById(order.recipeId);
  if (!recipe) return { ok: false, reason: "Unknown recipe." };
  if (!stationCount(recipe.station)) {
    return { ok: false, reason: `You need a ${stationName(recipe.station)} in the café. Place one from the furniture shop.` };
  }
  const missing = Object.keys(recipe.ing).filter((key) => (S.pantry[key] || 0) < recipe.ing[key]);
  if (missing.length) {
    return { ok: false, reason: `Missing ${missing.map((m) => pantryName(m)).join(", ")}. Restock the pantry first.`, restock: missing };
  }
  runtime.cooking = {
    orderId, recipeId: recipe.id, value: 0.18, dir: 1,
    speed: 0.62 + Math.min(0.5, level() * 0.018), running: true, zone: 0.065,
    startedAt: performance.now(), quality: null
  };
  return { ok: true, cooking: runtime.cooking, recipe };
}

export function stopCooking() {
  const cook = runtime.cooking;
  if (!cook || !cook.running) return null;
  const recipe = recipeById(cook.recipeId);
  const off = Math.abs(cook.value - 0.5);
  let quality, label;
  if (off <= cook.zone) { quality = 1.35; label = "Perfect"; }
  else if (off <= 0.2) { quality = 1.14; label = "Lovely"; }
  else { quality = 0.9; label = "A bit rushed"; }
  cook.running = false;
  cook.quality = quality;
  cook.label = label;
  Object.keys(recipe.ing).forEach((key) => { S.pantry[key] = Math.max(0, (S.pantry[key] || 0) - recipe.ing[key]); });
  const order = runtime.orders.find((o) => o.id === cook.orderId);
  if (!order) {
    runtime.cooking = null;
    return null;
  }
  {
    order.state = "ready";
    order.quality = quality;
    order.qualityLabel = label;
    order.readyAt = Date.now();
  }
  bump("cooked");
  if (quality === 1.35) bump("perfect");
  hooks.sound(quality === 1.35 ? "perfect" : "ding");
  hooks.toast(label, `${recipe.name} is ready — click ${order ? order.customerName : "the guest"} to serve.`, quality === 1.35 ? "sparkle" : "check");
  touch();
  return { quality, label, recipe, order };
}

export function cancelCooking() {
  runtime.cooking = null;
}

function stationName(kind) {
  return { stove: "cooktop", oven: "pastry oven", espresso: "espresso machine", blender: "blender", freezer: "freezer" }[kind] || "station";
}
function pantryName(id) {
  const p = PANTRY.find((x) => x.id === id);
  return p ? p.name : id;
}

export function cancelOrder(orderId) {
  const order = runtime.orders.find((o) => o.id === orderId);
  if (!order) return false;
  runtime.orders = runtime.orders.filter((o) => o.id !== orderId);
  const customer = runtime.customers.find((c) => c.id === order.customerId);
  if (customer) {
    customer.order = null;
    customer.taken = false;
    leaveCustomer(customer, 2, false);
  }
  notify();
  return true;
}

export function serveCustomer(customer) {
  if (!customer) return false;
  const order = runtime.orders.find((o) => o.customerId === customer.id && o.state === "ready");
  if (!order) {
    if (customer.phase === "ordering") return takeOrder(customer);
    if (customer.phase === "waiting") { hooks.toast("Still cooking", "That dish is not ready yet.", "clock", true); return false; }
    return false;
  }
  const recipe = recipeById(order.recipeId);
  const waited = 1 - Math.max(0, customer.patience) / Math.max(1, customer.maxPatience);
  const stars = clampInt(Math.round(5 - waited * 2.4 - Math.max(0, 1.35 - order.quality) * 1.6), 1, 5);
  const ambienceBoost = 1 + Math.min(0.25, ambience() * 0.0045);
  const happinessBoost = 1 + (averageHappiness() / 100) * 0.08;
  const tip = order.quality * customer.type.tip;
  const coins = Math.max(4, Math.round(recipe.price * ambienceBoost * happinessBoost * (0.85 + (stars / 5) * 0.35) * tip * 0.9));
  const xp = Math.round(recipe.xp * (0.9 + order.quality * 0.25));
  S.coins += coins;
  S.earnings.coins += coins;
  S.earnings.customers += 1;
  S.rep = clampNum(S.rep + (stars - 3) * 0.9 + (order.quality === 1.35 ? 0.35 : 0), 0, 100, 62);
  addXp(xp);
  bump("served");
  bump("earned", coins);
  if (stars === 5) bump("reviews5");
  order.state = "done";
  customer.phase = "eating";
  customer.timer = 5.2 + Math.random() * 2;
  customer.patience = 1;
  customer.sentiment = stars;
  const lines = REVIEW_LINES[stars] || REVIEW_LINES[4];
  const review = {
    name: customer.type.name, stars, recipe: recipe.name,
    text: lines[Math.floor(Math.random() * lines.length)], at: Date.now()
  };
  S.reviews.push(review);
  S.reviews = S.reviews.slice(-12);
  // a little plate of food in front of the guest
  try {
    const food = buildFood(recipe, { scale: 0.75 });
    food.position.set(0, 0.04, 0.42);
    food.rotation.y = 0.4;
    customer.handle.group.add(food);
    customer.food = food;
  } catch (error) { /* a missing plate is not fatal */ }
  hooks.sound("coin");
  hooks.toast(`${stars}★ review`, `+${coins} coins · +${xp} XP`, "star");
  hooks.float(world.projectToScreen(customer.handle.headVec), `+${coins}`, "coin");
  if (stars === 5) hooks.float(world.projectToScreen(customer.handle.headVec), "5★", "star");
  touch();
  ensureStray();
  return true;
}

function leaveCustomer(customer, stars, angry) {
  customer.phase = "leave";
  const path = customer.seat
    ? [{ x: customer.seat.x + 0.1, z: customer.seat.z }, { x: -7.2, z: 2.62 }, { x: -8.7, z: 2.62 }, { x: -11.4, z: 2.62 }]
    : [{ x: -8.7, z: 2.62 }, { x: -11.4, z: 2.62 }];
  runtime.orders = runtime.orders.filter((o) => o.customerId !== customer.id || o.state === "done");
  if (customer.seat) customer.seat.occupied = false;
  customer.seat = null;
  world.setActorSeated(customer.handle, false);
  if (customer.food) { customer.handle.group.remove(customer.food); customer.food = null; }
  if (angry) {
    S.rep = clampNum(S.rep - 1.6, 0, 100, 62);
    S.reviews.push({ name: customer.type.name, stars: 1, recipe: customer.recipe ? customer.recipe.name : "their order", text: (REVIEW_LINES[1] || REVIEW_LINES[2])[0], at: Date.now() });
    S.reviews = S.reviews.slice(-12);
    hooks.toast("A guest left", "Their patience ran out. Keep an eye on the bubbles.", "sad", true);
    hooks.sound("sad");
    touch();
  }
  walk(customer, path, () => {
    world.removeActor(customer.handle);
    runtime.customers = runtime.customers.filter((c) => c !== customer);
    notify();
  });
  notify();
}

function servedOrLeftCustomer(customer) {
  if (customer.phase === "eating") return "eating";
  return customer.phase;
}

/* ---------------------------------------------------------------------
   Simulation
   --------------------------------------------------------------------- */
let lastSpawn = 0;
export function update(dt) {
  if (!runtime.ready || runtime.visiting) return;
  checkDay();
  if (document.hidden) return;
  runtime.spawnTimer -= dt;
  const target = Math.max(8, 22 - level() * 0.45 - S.rep * 0.07) * (0.85 + Math.random() * 0.3);
  if (runtime.spawnTimer <= 0) {
    spawnCustomer();
    runtime.spawnTimer = target;
  }

  // customers
  runtime.customers.slice().forEach((customer) => {
    if (customer.cooldown === undefined) customer.cooldown = 0;
    // movement
    if (customer.path.length) {
      const target2 = customer.path[0];
      const dx = target2.x - customer.x, dz = target2.z - customer.z;
      const dist = Math.hypot(dx, dz);
      const step = customer.walkSpeed * dt;
      if (dist <= step || dist < 0.02) {
        customer.x = target2.x; customer.z = target2.z;
        customer.path.shift();
        if (!customer.path.length) {
          const cb = customer.onArrive;
          customer.onArrive = null;
          world.setActorPose(customer.handle, customer.x, customer.z, customer.handle.yaw, false);
          if (cb) cb();
          return;
        }
      } else {
        customer.x += (dx / dist) * step;
        customer.z += (dz / dist) * step;
        const yaw = Math.atan2(dx, dz);
        world.setActorPose(customer.handle, customer.x, customer.z, yaw, true);
      }
    }

    if (customer.phase === "decide") {
      customer.timer -= dt;
      if (customer.timer <= 0) sitDownAndOrder(customer);
    } else if (customer.phase === "ordering" || customer.phase === "waiting") {
      customer.patience -= dt;
      if (customer.patience <= 0) {
        leaveCustomer(customer, 1, true);
        return;
      }
    } else if (customer.phase === "queue") {
      customer.timer -= dt;
      const seat = freeSeat();
      if (seat) {
        customer.phase = "walk";
        assignSeat(customer, seat);
      } else if (customer.timer <= 0) {
        leaveCustomer(customer, 2, false);
      }
    } else if (customer.phase === "eating") {
      customer.timer -= dt;
      if (customer.timer <= 0) {
        runtime.orders = runtime.orders.filter((o) => o.customerId !== customer.id);
        leaveCustomer(customer, customer.sentiment || 4, false);
      }
    }
  });

  // residents
  runtime.residents.forEach((r) => {
    r.cooldown = Math.max(0, (r.cooldown || 0) - dt);
    if (r.target) {
      const dx = r.target.x - r.x, dz = r.target.z - r.z;
      const dist = Math.hypot(dx, dz);
      if (dist < 0.08) {
        r.target = null;
        r.timer = 2 + Math.random() * 6;
        world.setActorPose(r.handle, r.x, r.z, r.handle.yaw, false);
      } else {
        const step = r.speed * dt;
        r.x += (dx / dist) * Math.min(step, dist);
        r.z += (dz / dist) * Math.min(step, dist);
        world.setActorPose(r.handle, r.x, r.z, Math.atan2(dx, dz), true);
      }
    } else {
      r.timer -= dt;
      if (r.timer <= 0) {
        const spot = randomInteriorSpot();
        r.target = avoidFurniture(spot);
        r.timer = 0;
      }
    }
  });

  // stray glances at the door
  runtime.strays.forEach((s) => {
    s.timer += dt;
    if (s.handle && s.handle.headVec) {
      // gentle idle only — the actor animation handles the rest
    }
  });

  // cooking meter
  if (runtime.cooking && runtime.cooking.running) {
    const cook = runtime.cooking;
    cook.value += cook.dir * cook.speed * dt;
    if (cook.value >= 0.94) { cook.value = 0.94; cook.dir = -1; }
    if (cook.value <= 0.06) { cook.value = 0.06; cook.dir = 1; }
  }

  // happiness drifts down slowly while you are open
  if (Math.random() < dt * 0.02) {
    S.animals.forEach((a) => { a.happiness = Math.max(4, a.happiness - 1); });
    notify();
  }
}

function avoidFurniture(spot) {
  const occupied = S.layout.items.filter((i) => {
    const d = furnitureById(i.id);
    return d && !d.rug && d.place === "floor";
  });
  for (let attempt = 0; attempt < 4; attempt++) {
    const blocked = occupied.some((i) => Math.abs(i.x - spot.x) < 0.8 && Math.abs(i.z - spot.z) < 0.8);
    if (!blocked) return spot;
    spot = randomInteriorSpot();
  }
  return spot;
}

export function getStrays() { return runtime.strays; }

export function focusedCustomer() {
  return runtime.customers.find((c) => c.phase === "ordering") || null;
}

export function clearCustomers(keepOrders) {
  runtime.customers.forEach((c) => world.removeActor(c.handle));
  runtime.customers = [];
  runtime.seats.forEach((s) => { s.occupied = false; });
  if (!keepOrders) runtime.orders = [];
}

/* ---------------------------------------------------------------------
   Cloud-facing actions
   --------------------------------------------------------------------- */
export async function leaveLike(cafeUid) {
  if (!cloud.getUser() || cloud.getUser().guest) {
    hooks.toast("Sign in to leave a heart", "Guests can visit, but hearts need an account.", "heart", true);
    return null;
  }
  try {
    const liked = await cloud.toggleLike(cafeUid);
    if (liked) {
      bump("likesGiven");
      hooks.sound("chime");
      hooks.toast("Heart left", "They will see it in their profile.", "heart");
    } else {
      hooks.toast("Heart removed", "Changed your mind — that's allowed.", "heart");
    }
    return liked;
  } catch (error) {
    hooks.toast("Could not save that heart", "Check your connection and try again.", "heart", true);
    return null;
  }
}

export async function rateCafe(cafeUid, stars) {
  if (!cloud.getUser() || cloud.getUser().guest) {
    hooks.toast("Sign in to rate", "Ratings need an account.", "star", true);
    return false;
  }
  if (cafeUid === cloud.getUser().uid) {
    hooks.toast("That's your café", "Ask a guest to rate you instead.", "star", true);
    return false;
  }
  try {
    await cloud.rateCafe(cafeUid, stars);
    hooks.toast("Thanks!", `${stars} star${stars === 1 ? "" : "s"} sent.`, "star");
    hooks.sound("chime");
    return true;
  } catch (error) {
    hooks.toast("Could not save that rating", "Try again in a moment.", "star", true);
    return false;
  }
}

export async function enterCompetition(week) {
  if (!cloud.getUser() || cloud.getUser().guest) {
    hooks.toast("Sign in to compete", "The weekly competition is for signed-in cafés.", "trophy", true);
    return false;
  }
  try {
    await cloud.enterCompetition(week, publicDoc());
    S.comp.enteredWeek = week;
    bump("entered");
    hooks.toast("You're in", "Your café is entered in this week's competition.", "trophy");
    hooks.sound("chime");
    touch();
    return true;
  } catch (error) {
    hooks.toast("Could not enter", "Check your connection and try again.", "trophy", true);
    return false;
  }
}

export async function voteCompetition(week, entryUid) {
  if (!cloud.getUser() || cloud.getUser().guest) {
    hooks.toast("Sign in to vote", "Votes need an account.", "trophy", true);
    return false;
  }
  try {
    await cloud.voteCompetition(week, entryUid);
    S.comp.votedWeek = week;
    hooks.toast("Vote cast", "Good taste noted.", "star");
    hooks.sound("chime");
    touch();
    return true;
  } catch (error) {
    hooks.toast("Could not vote", error && error.code === "already-voted" ? "You have already voted this week." : "Check your connection and try again.", "trophy", true);
    return false;
  }
}

export function recordCompetitionResult(rank) {
  if (rank && rank <= 3) {
    if (unlockEventAnimal("nimbus")) {
      hooks.toast("Top three!", "Nimbus the cloud cat can now be adopted.", "sparkle");
    }
  }
}

export function refreshLikes(count) {
  S.likes = Math.max(0, count | 0);
  notify();
  markDirty();
}

export { clampInt, clampNum, round2, round3 };

function clampInt(v, min, max, fallback) {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : fallback;
}
function clampNum(v, min, max, fallback) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : fallback;
}
function round2(n) { return Math.round(n * 100) / 100; }
function round3(n) { return Math.round(n * 1000) / 1000; }
