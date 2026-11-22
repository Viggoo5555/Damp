/* =====================================================================
   BAKE OFF! — the game
   The profile, the baking mechanics, the match clock, the judging and
   the rewards. This file has no DOM and no network in it, which makes
   the rules of the game easy to follow (and easy to test).
   ===================================================================== */
import {
  RECIPES, recipeById, ingredientById, themeById, THEMES, FROSTINGS, TOPPINGS, PLATES,
  SHAPES, FROSTING_STYLES, ACHIEVEMENTS, DAILY_REWARDS, pickDaily, pickWeekly, dayKey, weekKey,
  levelInfo, LEVEL_XP, HATS, APRONS, HAIRS, KITCHENS, EQUIPMENT, phaseById, PHASES,
  toppingById, frostingById, shapeById, seedFrom
} from "./data.js";

const STORE = "bake-off-v1";

/* ---------------------------------------------------------------------
   Profile
   --------------------------------------------------------------------- */
const START_RECIPES = ["birthday-vanilla", "chocolate-fudge", "vanilla-cupcake", "choc-chip-cookie", "glazed-donut", "buttermilk-pancakes", "belgian-waffle", "fudge-brownie"];
const START_PLATES = ["ceramic", "wood"];
const START_TOPPINGS = ["strawberry", "sprinkles", "candle", "star", "chocolate", "mint"];

function defaultProfile() {
  return {
    uid: null,
    name: "Guest baker",
    coins: 900,
    xp: 0,
    recipes: Object.fromEntries(START_RECIPES.map((id) => [id, true])),
    plates: Object.fromEntries(START_PLATES.map((id) => [id, true])),
    toppings: Object.fromEntries(START_TOPPINGS.map((id) => [id, true])),
    hats: { toque: true },
    aprons: { cream: true, blush: true },
    hairs: { honey: true, black: true },
    skins: { 0: true },
    kitchens: { peach: true },
    equipment: { classic: true, pink: true },
    equipped: { hat: "toque", apron: "cream", hair: "honey", skin: 0, kitchen: "peach", oven: "classic" },
    stats: {
      bakes: 0, wins: 0, podiums: 0, votes: 0, perfectBakes: 0, bestScore: 0, themed: 0,
      decorations: 0, bigMatches: 0, bestStreak: 0, streak: 0, nightBakes: 0, matches: 0
    },
    history: [],
    achievements: {},
    daily: { date: "", progress: {}, done: {}, claimed: {} },
    weekly: { key: "", progress: {}, done: {} },
    dailyReward: { last: "", streak: 0 },
    settings: { sound: true },
    createdAt: Date.now()
  };
}

export const S = defaultProfile();

export const runtime = {
  phase: "lobby",
  phaseEndsAt: 0,
  theme: THEMES[0],
  practice: true,
  online: false,
  matchId: null,
  round: 0,
  secondsLeft: 0,
  prep: { added: [], wrong: [], mixed: false, mixQuality: 0 },
  mix: { active: false, marker: 0, dir: 1, hits: [], taps: 0, need: 3, zone: [0.42, 0.6], speed: 0.55 },
  oven: { temp: 180, tempChosen: false, started: false, startedAt: 0, elapsed: 0, window: [18, 26], quality: 0, taken: false, burnt: false, done: false },
  design: null,
  rivals: [],
  votes: {},
  myVote: null,
  results: null,
  ready: false,
  paused: false
};

export const hooks = {
  onPhase: null,
  onPhaseEnd: null,
  onToast: null,
  onDesignChange: null,
  onScore: null,
  onCelebrate: null
};
export function setHooks(next) { Object.assign(hooks, next); }

export function toast(title, text, kind = "info") {
  if (hooks.onToast) hooks.onToast(title, text, kind);
}

/* ---------------------------------------------------------------------
   Save / load
   --------------------------------------------------------------------- */
export function packProfile() {
  return {
    version: 1,
    name: S.name,
    coins: S.coins,
    xp: S.xp,
    recipes: S.recipes,
    plates: S.plates,
    toppings: S.toppings,
    hats: S.hats,
    aprons: S.aprons,
    hairs: S.hairs,
    skins: S.skins,
    kitchens: S.kitchens,
    equipment: S.equipment,
    equipped: S.equipped,
    stats: S.stats,
    history: S.history.slice(0, 30),
    achievements: S.achievements,
    daily: S.daily,
    weekly: S.weekly,
    dailyReward: S.dailyReward,
    settings: S.settings,
    createdAt: S.createdAt,
    updated: Date.now()
  };
}

export function hydrateProfile(data) {
  if (!data || typeof data !== "object") return false;
  const base = defaultProfile();
  S.uid = data.uid || null;
  S.name = typeof data.name === "string" ? data.name.slice(0, 20) : base.name;
  S.coins = clampInt(data.coins, 0, 9999999, base.coins);
  S.xp = clampInt(data.xp, 0, 9999999, 0);
  for (const key of ["recipes", "plates", "toppings", "hats", "aprons", "hairs", "skins", "kitchens", "equipment", "achievements"]) {
    S[key] = { ...base[key], ...(data[key] && typeof data[key] === "object" ? data[key] : {}) };
  }
  S.equipped = { ...base.equipped, ...(data.equipped || {}) };
  S.stats = { ...base.stats, ...(data.stats || {}) };
  S.history = Array.isArray(data.history) ? data.history.slice(0, 30) : [];
  S.daily = { ...base.daily, ...(data.daily || {}) };
  S.weekly = { ...base.weekly, ...(data.weekly || {}) };
  S.dailyReward = { ...base.dailyReward, ...(data.dailyReward || {}) };
  S.settings = { ...base.settings, ...(data.settings || {}) };
  S.createdAt = data.createdAt || Date.now();
  checkDay();
  return true;
}

function clampInt(value, min, max, fallback) {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

export function loadLocal() {
  try {
    const raw = localStorage.getItem(STORE);
    if (!raw) return false;
    const data = JSON.parse(raw);
    const ok = hydrateProfile(data);
    if (ok) {
      const name = localStorage.getItem(STORE + "-name");
      if (name && (!data.name || data.name === "Guest baker")) S.name = name.slice(0, 20);
    }
    return ok;
  } catch (error) {
    console.warn("Bake Off: could not read the local save", error);
    return false;
  }
}

let saveTimer = null;
export function saveLocal(now = false) {
  const write = () => {
    try {
      localStorage.setItem(STORE, JSON.stringify(packProfile()));
      if (S.name) localStorage.setItem(STORE + "-name", S.name);
    } catch (error) { /* storage full or blocked */ }
  };
  if (now) { clearTimeout(saveTimer); write(); }
  else { clearTimeout(saveTimer); saveTimer = setTimeout(write, 400); }
}

export function resetLocal() {
  try { localStorage.removeItem(STORE); localStorage.removeItem(STORE + "-name"); } catch (error) { /* ignore */ }
}

/* ---------------------------------------------------------------------
   Profile helpers
   --------------------------------------------------------------------- */
export function level() { return levelInfo(S.xp).level; }
export function xpProgress() { return levelInfo(S.xp); }

export function addCoins(amount) {
  S.coins = Math.max(0, S.coins + Math.round(amount));
  saveLocal();
}
export function addXp(amount) {
  const before = level();
  S.xp = Math.max(0, S.xp + Math.round(amount));
  const after = level();
  saveLocal();
  if (after > before) {
    hooks.onToast && hooks.onToast("Level " + after, "New recipes and a bigger bench await.", "level");
    unlockForLevel(after);
  }
  return after > before;
}

function unlockForLevel(lv) {
  RECIPES.forEach((r) => { if (r.level <= lv) S.recipes[r.id] = true; });
}

export function owns(kind, id) {
  const map = { recipe: S.recipes, plate: S.plates, topping: S.toppings, hat: S.hats, apron: S.aprons, hair: S.hairs, kitchen: S.kitchens, equipment: S.equipment };
  return !!(map[kind] && map[kind][id]);
}

export function priceOfRecipe(recipe) {
  return 60 + recipe.level * 45;
}
export function buy(kind, id) {
  const costs = {
    hat: () => (HATS.find((h) => h.id === id) || {}).price,
    apron: () => (APRONS.find((a) => a.id === id) || {}).price,
    kitchen: () => (KITCHENS.find((k) => k.id === id) || {}).price,
    equipment: () => (EQUIPMENT.find((e) => e.id === id) || {}).price,
    plate: () => 180,
    topping: () => 240,
    recipe: () => {
      const r = recipeById(id);
      if (level() < r.level) return null;
      return priceOfRecipe(r);
    }
  };
  const get = costs[kind];
  if (!get) return { ok: false, reason: "Unknown item" };
  const price = get();
  if (price === null || price === undefined) return { ok: false, reason: "Not unlocked yet" };
  if (owns(kind, id)) return { ok: false, reason: "Already yours" };
  if (S.coins < price) return { ok: false, reason: "Not enough coins", price };
  S.coins -= price;
  const map = { recipe: "recipes", plate: "plates", topping: "toppings", hat: "hats", apron: "aprons", hair: "hairs", kitchen: "kitchens", equipment: "equipment" }[kind];
  if (kind === "hair") S.hairs[id] = true;
  else S[map][id] = true;
  saveLocal();
  return { ok: true, price };
}

export function equip(slot, id) {
  if (slot === "hat" && !S.hats[id]) return false;
  if (slot === "apron" && !S.aprons[id]) return false;
  if (slot === "hair" && !S.hairs[id]) return false;
  if (slot === "kitchen" && !S.kitchens[id]) return false;
  if (slot === "oven" && !S.equipment[id]) return false;
  S.equipped[slot] = id;
  saveLocal();
  return true;
}

export function chefCosmetics() {
  return {
    hat: S.equipped.hat, apron: S.equipped.apron, hair: S.equipped.hair,
    skin: S.equipped.skin, kitchen: S.equipped.kitchen, oven: S.equipped.oven
  };
}

/* ---------------------------------------------------------------------
   Day / week bookkeeping
   --------------------------------------------------------------------- */
export function checkDay() {
  const today = dayKey();
  if (S.daily.date !== today) {
    S.daily = { date: today, progress: {}, done: {}, claimed: {} };
    saveLocal();
  }
  const week = weekKey();
  if (S.weekly.key !== week) {
    S.weekly = { key: week, progress: {}, done: {} };
    saveLocal();
  }
}

export function dailyChallenges() { checkDay(); return pickDaily(new Date()); }
export function weeklyChallenge() { checkDay(); return pickWeekly(new Date()); }

export function bump(metric, amount = 1) {
  checkDay();
  const day = S.daily.progress;
  day[metric] = (day[metric] || 0) + amount;
  if (metric === "dailyBestScore") day[metric] = Math.max(day[metric] || 0, amount);
  S.weekly.progress[metric] = (S.weekly.progress[metric] || 0) + amount;
  saveLocal();
}

export function bumpWeekly(metric, amount = 1) {
  checkDay();
  S.weekly.progress[metric] = (S.weekly.progress[metric] || 0) + amount;
  saveLocal();
}

export function dailyState() {
  checkDay();
  return pickDaily(new Date()).map((c) => {
    const progress = S.daily.progress[c.metric] || 0;
    return { ...c, progress, complete: progress >= c.goal, claimed: !!S.daily.claimed[c.id] };
  });
}
export function claimDaily(id) {
  const item = dailyState().find((c) => c.id === id);
  if (!item) return { ok: false, reason: "Unknown challenge" };
  if (!item.complete) return { ok: false, reason: "Not finished yet" };
  if (item.claimed) return { ok: false, reason: "Already claimed" };
  S.daily.claimed[id] = true;
  addCoins(item.coins);
  addXp(item.xp);
  return { ok: true, coins: item.coins, xp: item.xp };
}

export function weeklyState() {
  checkDay();
  const c = pickWeekly(new Date());
  const progress = S.weekly.progress[c.metric] || 0;
  return { ...c, progress, complete: progress >= c.goal, claimed: !!S.weekly.done[c.id] };
}
export function claimWeekly() {
  const item = weeklyState();
  if (!item.complete) return { ok: false, reason: "Not finished yet" };
  if (item.claimed) return { ok: false, reason: "Already claimed" };
  S.weekly.done[item.id] = true;
  addCoins(item.coins);
  addXp(item.xp);
  return { ok: true, coins: item.coins, xp: item.xp };
}

export function dailyRewardAvailable() { return S.dailyReward.last !== dayKey(); }
export function claimDailyReward() {
  if (!dailyRewardAvailable()) return { ok: false, reason: "Come back tomorrow" };
  const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
  const continuing = S.dailyReward.last === dayKey(yesterday);
  S.dailyReward.streak = continuing ? Math.min(7, S.dailyReward.streak + 1) : 1;
  S.dailyReward.last = dayKey();
  const coins = DAILY_REWARDS[S.dailyReward.streak - 1];
  addCoins(coins);
  addXp(Math.round(coins * 0.4));
  saveLocal();
  return { ok: true, coins, streak: S.dailyReward.streak };
}

/* ---------------------------------------------------------------------
   Achievements
   --------------------------------------------------------------------- */
export function checkAchievements() {
  const earned = [];
  ACHIEVEMENTS.forEach((a) => {
    if (S.achievements[a.id]) return;
    const value = a.metric === "bestScore" ? S.stats.bestScore : a.metric === "plates" ? Object.keys(S.plates).length
      : a.metric === "hats" ? Object.keys(S.hats).length : (S.stats[a.metric] || 0);
    if (value >= a.goal) {
      S.achievements[a.id] = Date.now();
      S.coins += a.coins;
      S.xp += a.xp;
      earned.push(a);
    }
  });
  if (earned.length) {
    saveLocal(true);
    earned.forEach((a) => toast("Achievement · " + a.name, a.desc + "  +" + a.coins + " coins", "trophy"));
  }
  return earned;
}

export function achievementList() {
  return ACHIEVEMENTS.map((a) => {
    const value = a.metric === "bestScore" ? S.stats.bestScore : a.metric === "plates" ? Object.keys(S.plates).length
      : a.metric === "hats" ? Object.keys(S.hats).length : (S.stats[a.metric] || 0);
    return { ...a, progress: Math.min(value, a.goal), earned: !!S.achievements[a.id] };
  });
}

/* ---------------------------------------------------------------------
   Designs
   --------------------------------------------------------------------- */
export function newDesign(recipeId) {
  const recipe = recipeById(recipeId || "birthday-vanilla");
  return {
    recipeId: recipe.id,
    shape: recipe.kind === "cake" ? "round" : "round",
    layers: recipe.kind === "cake" ? 3 : recipe.kind === "pancake" ? 5 : 3,
    frosting: "blush",
    style: recipe.kind === "cookie" ? "drip" : "smooth",
    plate: "ceramic",
    message: "",
    toppings: [],
    candles: 0,
    sprinkles: 0,
    quality: { prep: 0, mix: 0, oven: 0 }
  };
}

export function allowedShapes(kind) {
  if (kind === "cupcake") return ["round"];
  if (kind === "cookie" || kind === "donut" || kind === "macaron") return ["round"];
  if (kind === "pancake" || kind === "waffle" || kind === "brownie" || kind === "cheesecake") return ["round", "square"];
  return SHAPES.map((s) => s.id);
}

/* ---------------------------------------------------------------------
   Match lifecycle
   --------------------------------------------------------------------- */
export function beginMatch(opts = {}) {
  const theme = opts.theme || THEMES[Math.floor(Math.random() * THEMES.length)];
  runtime.theme = theme;
  runtime.practice = opts.practice !== false;
  runtime.online = !!opts.online;
  runtime.matchId = opts.matchId || null;
  runtime.round = 0;
  runtime.prep = { added: [], wrong: [], mixed: false, mixQuality: 0 };
  runtime.mix = { active: false, marker: 0, dir: 1, hits: [], taps: 0, need: 3, zone: [0.42, 0.6], speed: 0.5 };
  runtime.oven = { temp: 180, tempChosen: false, started: false, startedAt: 0, elapsed: 0, window: [0, 0], quality: 0, taken: false, burnt: false, done: false };
  runtime.design = null;
  runtime.rivals = opts.rivals || [];
  runtime.votes = {};
  runtime.myVote = null;
  runtime.results = null;
  runtime.rewardClaimed = false;
  runtime.myScore = null;
  runtime.endHandled = false;
  runtime.ready = true;
  setPhase("theme", phaseById("theme").seconds);
}

export function setPhase(id, seconds, endsAt) {
  runtime.phase = id;
  runtime.phaseEndsAt = endsAt || Date.now() + Math.max(0, seconds || 0) * 1000;
  runtime.secondsLeft = Math.max(0, Math.round((runtime.phaseEndsAt - Date.now()) / 1000));
  runtime.endHandled = false;
  if (id === "prepare") {
    // A fresh recipe suggestion comes with the theme.
    if (!runtime.design) runtime.design = newDesign(suggestRecipe(runtime.theme));
  }
  if (id === "bake") {
    runtime.mix.active = false;
    const recipe = recipeById(runtime.design.recipeId);
    const ideal = recipe.bake;
    runtime.oven.window = [ideal * 0.82, ideal * 1.18];
    runtime.oven.started = false;
    runtime.oven.taken = false;
    runtime.oven.burnt = false;
    runtime.oven.done = false;
    runtime.oven.elapsed = 0;
  }
  if (id === "decorate" && runtime.design) {
    runtime.design.quality = {
      prep: runtime.prep.quality || 0,
      mix: runtime.mixQuality || 0,
      oven: runtime.oven.quality || 0
    };
  }
  if (id === "show") {
    runtime.design && (runtime.design.quality = runtime.design.quality || {});
    finalizeLocalScore();
  }
  if (id === "vote") {
    runtime.myVote = null;
  }
  if (hooks.onPhase) hooks.onPhase(id);
  saveLocal();
}

/* Online matches are driven by the room document, so the local clock has
   to follow the server's deadline rather than start a fresh one. */
export function setPhaseAt(id, endsAt) {
  setPhase(id, 0, endsAt || Date.now());
}

/* Reset everything a *new online* match needs without starting a phase;
   the caller then calls setPhaseAt with the room's deadline. */
export function prepareOnlineMatch(theme) {
  runtime.theme = theme;
  runtime.practice = false;
  runtime.online = true;
  runtime.prep = { added: [], wrong: [], mixed: false, mixQuality: 0 };
  runtime.mix = { active: false, marker: 0, dir: 1, hits: [], taps: 0, need: 3, zone: [0.42, 0.6], speed: 0.5 };
  runtime.oven = { temp: 180, tempChosen: false, started: false, startedAt: 0, elapsed: 0, window: [0, 0], quality: 0, taken: false, burnt: false, done: false };
  runtime.design = null;
  runtime.rivals = [];
  runtime.votes = {};
  runtime.myVote = null;
  runtime.results = null;
  runtime.myScore = null;
  runtime.rewardClaimed = false;
  runtime.endHandled = false;
  runtime.ready = true;
}

export function tick(dt) {
  if (!runtime.ready) return;
  const left = Math.max(0, (runtime.phaseEndsAt - Date.now()) / 1000);
  runtime.secondsLeft = left;
  if (runtime.mix.active) {
    runtime.mix.marker += dt * runtime.mix.speed * runtime.mix.dir;
    if (runtime.mix.marker > 1) { runtime.mix.marker = 1; runtime.mix.dir = -1; }
    if (runtime.mix.marker < 0) { runtime.mix.marker = 0; runtime.mix.dir = 1; }
  }
  if (runtime.phase === "bake" && runtime.oven.started && !runtime.oven.taken) {
    // Wall-clock rather than accumulated frames: a background tab must not
    // stop the cake from baking (or from burning).
    runtime.oven.elapsed = (Date.now() - runtime.oven.startedAt) / 1000;
    const recipe = recipeById(runtime.design ? runtime.design.recipeId : "birthday-vanilla");
    if (runtime.oven.elapsed > recipe.bake * 1.55) takeOut(true);
  }
  if (left <= 0 && !runtime.endHandled) {
    runtime.endHandled = true;
    if (hooks.onPhaseEnd) hooks.onPhaseEnd(runtime.phase);
  }
}

export function suggestRecipe(theme) {
  const owned = RECIPES.filter((r) => S.recipes[r.id]);
  const scored = owned.map((r) => {
    let score = 0;
    r.tags.forEach((t) => { if (theme.tags.includes(t)) score += 2; });
    if (theme.id.includes(r.kind)) score += 2;
    return { r, score };
  }).sort((a, b) => b.score - a.score || a.r.level - b.r.level);
  const pool = scored.slice(0, 5);
  return (pool[Math.floor(Math.random() * pool.length)] || { r: RECIPES[0] }).r.id;
}

/* ---------------------------------------------------------------------
   Prepare: ingredients + mixing
   --------------------------------------------------------------------- */
export function chooseRecipe(id) {
  if (!S.recipes[id]) return { ok: false, reason: "That recipe is still locked" };
  if (runtime.phase !== "prepare" && runtime.phase !== "theme") return { ok: false, reason: "Too late to change recipe" };
  runtime.design = newDesign(id);
  runtime.prep = { added: [], wrong: [], mixed: false, mixQuality: 0 };
  runtime.mix = { active: false, marker: 0, dir: 1, hits: [], taps: 0, need: 3, zone: [0.42, 0.6], speed: 0.5 };
  return { ok: true };
}

export function recipeNeeds() {
  const recipe = recipeById(runtime.design ? runtime.design.recipeId : "birthday-vanilla");
  return recipe.ingredients.map(ingredientById);
}

export function addIngredient(id) {
  if (!runtime.design) return { ok: false };
  if (runtime.phase !== "prepare") return { ok: false, reason: "The mixing bowl is closed" };
  const need = recipeNeeds();
  const wanted = need.find((n) => n.id === id);
  if (!wanted) {
    runtime.prep.wrong.push(id);
    return { ok: false, reason: "Not in this recipe", penalty: true };
  }
  if (runtime.prep.added.includes(id)) return { ok: true, already: true };
  runtime.prep.added.push(id);
  const added = runtime.prep.added.length;
  if (hooks.onDesignChange) hooks.onDesignChange();
  if (added >= need.length) runtime.mix.active = true;
  return { ok: true, added, total: need.length, complete: added >= need.length };
}

export function mixPress() {
  if (!runtime.mix.active) return { ok: false, reason: "Add every ingredient first" };
  const m = runtime.mix;
  const zone = m.zone;
  const centre = (zone[0] + zone[1]) / 2;
  const half = (zone[1] - zone[0]) / 2;
  const dist = Math.abs(m.marker - centre);
  let quality = 0;
  if (dist <= half) quality = 1 - (dist / half) * 0.35;
  else quality = Math.max(0, 0.4 - (dist - half) * 0.9);
  m.hits.push(quality);
  m.taps += 1;
  m.zone = [Math.min(0.7, zone[0] + 0.05), Math.min(0.85, zone[1] + 0.05)];
  m.speed = Math.min(1.15, m.speed + 0.12);
  const avg = m.hits.reduce((a, b) => a + b, 0) / m.hits.length;
  runtime.mixQuality = avg;
  if (m.taps >= m.need) {
    m.active = false;
    runtime.prep.mixed = true;
    runtime.prep.quality = Math.max(0, runtime.prep.added.length / recipeNeeds().length - runtime.prep.wrong.length * 0.12);
    if (runtime.design) runtime.design.quality.prep = runtime.prep.quality;
    if (runtime.design) runtime.design.quality.mix = avg;
    return { ok: true, done: true, quality: avg };
  }
  return { ok: true, quality, taps: m.taps, need: m.need };
}

export function autoMixQuality() {
  if (runtime.prep.mixed) return;
  runtime.mix.active = false;
  runtime.prep.mixed = true;
  runtime.mixQuality = 0.3;
  runtime.prep.quality = Math.max(0, runtime.prep.added.length / recipeNeeds().length * 0.5);
  if (runtime.design) runtime.design.quality = { ...(runtime.design.quality || {}), prep: runtime.prep.quality, mix: 0.3 };
}

/* ---------------------------------------------------------------------
   Bake: temperature + timing
   --------------------------------------------------------------------- */
export function setOvenTemp(temp) {
  if (runtime.phase !== "bake") return { ok: false };
  if (runtime.oven.started) return { ok: false, reason: "It is already baking" };
  runtime.oven.temp = temp;
  runtime.oven.tempChosen = true;
  return { ok: true, temp };
}

export function startBake() {
  if (runtime.phase !== "bake") return { ok: false, reason: "Not baking yet" };
  if (runtime.oven.started) return { ok: false };
  runtime.oven.started = true;
  runtime.oven.startedAt = Date.now();
  runtime.oven.elapsed = 0;
  return { ok: true };
}

export function ovenProgress() {
  const recipe = recipeById(runtime.design ? runtime.design.recipeId : "birthday-vanilla");
  const elapsed = runtime.oven.elapsed;
  const total = recipe.bake * 1.45;
  return {
    elapsed,
    ideal: recipe.bake,
    window: runtime.oven.window,
    progress: Math.min(1, elapsed / total),
    started: runtime.oven.started,
    taken: runtime.oven.taken
  };
}

export function takeOut(auto = false) {
  const oven = runtime.oven;
  if (!oven.started || oven.taken) return { ok: false };
  const recipe = recipeById(runtime.design ? runtime.design.recipeId : "birthday-vanilla");
  oven.taken = true;
  const ideal = recipe.bake;
  const off = oven.elapsed - ideal;
  let quality;
  if (oven.elapsed < oven.window[0]) {
    quality = Math.max(0.05, 0.45 - (oven.window[0] - oven.elapsed) / ideal * 1.4);
  } else if (oven.elapsed > oven.window[1]) {
    quality = Math.max(0.05, 0.55 - (oven.elapsed - oven.window[1]) / ideal * 1.3);
    oven.burnt = oven.elapsed > ideal * 1.4;
  } else {
    quality = 0.8 + (1 - Math.abs(off) / Math.max(1, oven.window[1] - ideal)) * 0.2;
    quality = Math.min(1, quality);
  }
  // temperature accuracy
  const perfectTemp = 180;
  const tempPenalty = Math.abs(oven.temp - perfectTemp) / 100;
  quality = Math.max(0.05, quality - tempPenalty * 0.45);
  oven.quality = quality;
  oven.done = true;
  if (runtime.design) runtime.design.quality.oven = quality;
  if (auto) oven.burnt = true;
  const perfect = quality > 0.94 && !oven.burnt;
  if (perfect) S.stats.perfectBakes += 1;
  saveLocal();
  return { ok: true, quality, perfect, burnt: oven.burnt, elapsed: oven.elapsed, auto };
}

/* ---------------------------------------------------------------------
   Decoration
   --------------------------------------------------------------------- */
export function addToppingAt(id, x, z) {
  if (runtime.phase !== "decorate") return { ok: false, reason: "Decorate phase only" };
  if (!S.toppings[id]) return { ok: false, reason: "That topping is locked" };
  const design = runtime.design;
  if (!design) return { ok: false };
  if ((design.toppings || []).length >= 60) return { ok: false, reason: "That cake is full" };
  const dist = Math.hypot(x, z);
  if (dist > 1.02) return { ok: false };
  design.toppings = design.toppings || [];
  design.toppings.push({ id, x: +x.toFixed(3), z: +z.toFixed(3) });
  S.stats.decorations += 1;
  bump("dailyDecorations", 1);
  bumpWeekly("weekDecorations", 1);
  saveLocal();
  return { ok: true, count: design.toppings.length };
}

export function undoTopping() {
  if (!runtime.design || !runtime.design.toppings || !runtime.design.toppings.length) return { ok: false };
  runtime.design.toppings.pop();
  return { ok: true };
}

export function clearToppings() {
  if (!runtime.design) return { ok: false };
  runtime.design.toppings = [];
  return { ok: true };
}

export function setDecoration(patch) {
  if (!runtime.design) return { ok: false };
  const allowed = ["frosting", "style", "shape", "plate", "message", "candles", "sprinkles", "layers", "frostingCustom"];
  Object.keys(patch).forEach((key) => {
    if (!allowed.includes(key)) return;
    if (key === "message") runtime.design.message = String(patch[key] || "").slice(0, 26);
    else if (key === "candles") runtime.design.candles = Math.max(0, Math.min(8, patch[key] | 0));
    else if (key === "sprinkles") runtime.design.sprinkles = Math.max(0, Math.min(90, patch[key] | 0));
    else if (key === "layers") runtime.design.layers = Math.max(2, Math.min(4, patch[key] | 0));
    else runtime.design[key] = patch[key];
  });
  if (patch.message !== undefined) bump("dailyMessages", 1);
  if (patch.candles) bump("dailyCandles", 1);
  if (hooks.onDesignChange) hooks.onDesignChange();
  return { ok: true };
}

export function randomizeDesign() {
  if (!runtime.design) return null;
  const kinds = ["smooth", "swirl", "drip", "piped"];
  const frost = FROSTINGS[Math.floor(Math.random() * FROSTINGS.length)];
  const plate = PLATES[Math.floor(Math.random() * PLATES.length)];
  const ownedPlates = PLATES.filter((p) => S.plates[p.id]);
  const ownedTops = TOPPINGS.filter((t) => S.toppings[t.id]);
  const choices = [];
  const n = 1 + Math.floor(Math.random() * 3);
  for (let i = 0; i < n; i++) {
    const t = ownedTops[Math.floor(Math.random() * ownedTops.length)];
    if (t && !choices.includes(t.id)) choices.push(t.id);
  }
  setDecoration({
    frosting: frost.id,
    style: kinds[Math.floor(Math.random() * kinds.length)],
    plate: (ownedPlates[Math.floor(Math.random() * ownedPlates.length)] || plate).id,
    shape: allowedShapes(recipeById(runtime.design.recipeId).kind)[Math.floor(Math.random() * allowedShapes(recipeById(runtime.design.recipeId).kind).length)],
    sprinkles: Math.random() > 0.5 ? 40 : 0,
    candles: Math.random() > 0.6 ? 2 : 0
  });
  runtime.design.toppings = [];
  choices.forEach((id) => {
    for (let k = 0; k < 3; k++) {
      const a = Math.random() * Math.PI * 2, r = Math.random() * 0.7;
      runtime.design.toppings.push({ id, x: +(Math.cos(a) * r).toFixed(3), z: +(Math.sin(a) * r).toFixed(3) });
    }
  });
  if (hooks.onDesignChange) hooks.onDesignChange();
  return runtime.design;
}

/* ---------------------------------------------------------------------
   Judging
   --------------------------------------------------------------------- */
function colourDistance(a, b) {
  const ca = new THREE_COLOR(a), cb = new THREE_COLOR(b);
  if (!ca || !cb) return 1;
  return Math.sqrt((ca[0] - cb[0]) ** 2 + (ca[1] - cb[1]) ** 2 + (ca[2] - cb[2]) ** 2) / 1.732;
}
function THREE_COLOR(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || ""));
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255];
}

export function scoreDesign(design, theme, opts = {}) {
  const recipe = recipeById(design.recipeId);
  const frost = frostingById(design.frosting);
  const shape = shapeById(design.shape);
  const plate = PLATES.find((p) => p.id === design.plate) || PLATES[0];
  const toppings = (design.toppings || []).map((t) => ({ ...t, def: toppingById(t.id) }));

  /* --- theme fit (max 25) --- */
  let tagHits = 0;
  const tagPool = [...recipe.tags, ...frost.tags, ...shape.tags, ...toppings.map((t) => t.def.tags).flat()];
  tagPool.forEach((t) => { if (theme.tags.includes(t)) tagHits += 1; });
  const tagScore = Math.min(1, tagHits / 7);

  const palette = theme.colors || ["#f7c3d0"];
  const colourHits = [];
  [frost.color, plate.color, design.frostingCustom].filter(Boolean).forEach((c) => {
    const best = Math.min(...palette.map((p) => colourDistance(c, p)));
    colourHits.push(best < 0.18 ? 1 : best < 0.34 ? 0.6 : best < 0.52 ? 0.3 : 0);
  });
  const colourScore = colourHits.length ? Math.max(...colourHits) * 0.75 + (colourHits.reduce((a, b) => a + b, 0) / colourHits.length) * 0.25 : 0;
  const themeScore = Math.round(25 * (tagScore * 0.62 + colourScore * 0.38));

  /* --- creativity (max 20) --- */
  const uniqueToppings = new Set(toppings.map((t) => t.id)).size;
  let creativity = 0;
  creativity += Math.min(8, uniqueToppings * 2.2);
  creativity += design.message ? 3 : 0;
  creativity += design.candles ? Math.min(2, design.candles * 0.6) : 0;
  creativity += design.sprinkles ? 1.5 : 0;
  creativity += design.style === "smooth" ? 0 : 2;
  creativity += design.shape === "tiered3" ? 2.5 : design.shape === "tiered2" ? 1.5 : design.shape === "heart" ? 1.2 : 0;
  creativity += Math.min(2, toppings.length / 8);
  creativity = Math.round(Math.min(20, creativity));

  /* --- decoration (max 25) --- */
  const coverage = Math.min(1, toppings.length / 10);
  const spread = spreadScore(toppings);
  let decoration = 0;
  decoration += coverage * 11;
  decoration += spread * 6;
  decoration += design.sprinkles ? Math.min(3, design.sprinkles / 22) : 0;
  decoration += design.candles ? Math.min(2.5, design.candles * 0.5) : 0;
  decoration += design.style === "piped" || design.style === "swirl" ? 2.5 : design.style === "drip" ? 2 : 0.8;
  decoration = Math.round(Math.min(25, decoration));

  /* --- presentation (max 15) --- */
  let presentation = 3;
  presentation += plate.id === "gold" || plate.id === "marble" || plate.id === "glass" ? 2.5 : plate.id === "slate" ? 1.5 : 1;
  presentation += shape.tiers > 1 ? 2.5 : 1;
  presentation += design.message ? 2.5 : 0;
  presentation += (design.layers || 3) >= 4 ? 1.5 : 1;
  presentation += frost.id === "noir" || frost.id === "lilac" ? 1 : 0.6;
  presentation = Math.round(Math.min(15, presentation));

  /* --- completion (max 15) --- */
  const q = design.quality || {};
  const completion = Math.round(15 * (0.45 * (q.prep === undefined ? 0.7 : q.prep) + 0.3 * (q.mix === undefined ? 0.6 : q.mix) + 0.25 * (q.oven === undefined ? 0.6 : q.oven)));

  const base = Math.max(0, Math.min(100, themeScore + creativity + decoration + presentation + completion));
  return {
    theme: themeScore, creativity, decoration, presentation, completion, base,
    tags: tagHits, colours: Math.round(colourScore * 100),
    uniqueToppings, toppingCount: toppings.length,
    votes: opts.votes || 0,
    final: base + (opts.votes || 0) * 6
  };
}

function spreadScore(toppings) {
  if (toppings.length < 2) return toppings.length ? 0.4 : 0;
  let sum = 0;
  for (let i = 0; i < toppings.length; i++) {
    let nearest = 9;
    for (let j = 0; j < toppings.length; j++) {
      if (i === j) continue;
      const d = Math.hypot(toppings[i].x - toppings[j].x, toppings[i].z - toppings[j].z);
      nearest = Math.min(nearest, d);
    }
    sum += Math.min(1, nearest / 0.42);
  }
  return Math.min(1, sum / toppings.length);
}

export function finalizeLocalScore() {
  if (!runtime.design) return null;
  const votes = countVotesFor(S.uid || "me");
  const score = scoreDesign(runtime.design, runtime.theme, { votes });
  runtime.myScore = score;
  if (hooks.onScore) hooks.onScore(score);
  return score;
}

/* ---------------------------------------------------------------------
   Practice rivals
   --------------------------------------------------------------------- */
export function makeRivals(count = 3) {
  const names = ["Luna", "Emma", "Sofie", "Mila", "Iris", "Theo", "Ada", "Jonas"].sort(() => Math.random() - 0.5).slice(0, count);
  const rivals = names.map((name, i) => {
    const skill = 0.45 + Math.random() * 0.5;
    const design = rivalDesign(runtime.theme, skill);
    const score = scoreDesign(design, runtime.theme, { votes: 0 });
    return {
      uid: "rival-" + i, name, level: 2 + Math.floor(skill * 20), rival: true,
      design, skill, base: score.base, score, votes: 0, online: true
    };
  });
  runtime.rivals = rivals;
  return rivals;
}

function rivalDesign(theme, skill) {
  const ownedPool = RECIPES.filter((r) => r.level <= 2 + skill * 30);
  const recipe = ownedPool[Math.floor(Math.random() * ownedPool.length)] || RECIPES[0];
  const frostPool = FROSTINGS.filter((f) => f.tags.some((t) => theme.tags.includes(t)));
  const frost = (frostPool.length ? frostPool : FROSTINGS)[Math.floor(Math.random() * (frostPool.length || FROSTINGS.length))];
  const tops = TOPPINGS.filter((t) => t.tags.some((tag) => theme.tags.includes(t)));
  const design = newDesign(recipe.id);
  design.frosting = frost.id;
  design.style = ["smooth", "swirl", "drip", "piped"][Math.floor(Math.random() * 4)];
  design.shape = allowedShapes(recipe.kind)[Math.floor(Math.random() * allowedShapes(recipe.kind).length)];
  design.plate = PLATES[Math.floor(Math.random() * PLATES.length)].id;
  const count = Math.round(2 + skill * 9);
  for (let i = 0; i < count; i++) {
    const t = (tops.length ? tops : TOPPINGS)[Math.floor(Math.random() * (tops.length || TOPPINGS.length))];
    const a = Math.random() * Math.PI * 2, r = Math.random() * 0.78;
    design.toppings.push({ id: t.id, x: Math.cos(a) * r, z: Math.sin(a) * r });
  }
  design.sprinkles = Math.random() > 0.5 ? 30 : 0;
  design.candles = Math.random() > 0.7 ? 3 : 0;
  if (Math.random() < skill * 0.7) design.message = ["HAPPY DAY", "FOR YOU", "BAKE OFF", "SWEET", "LOVE"][Math.floor(Math.random() * 5)];
  design.quality = { prep: 0.5 + skill * 0.45, mix: 0.4 + skill * 0.5, oven: 0.4 + skill * 0.55 };
  return design;
}

/* ---------------------------------------------------------------------
   Votes & results
   --------------------------------------------------------------------- */
export function playersInMatch() {
  const me = {
    uid: (S.uid || "me"), name: S.name || "You", level: level(), rival: false,
    design: runtime.design, isMe: true, online: true
  };
  return [me, ...runtime.rivals];
}

export function countVotesFor(uid) {
  return Object.values(runtime.votes || {}).filter((v) => v === uid).length;
}

export function castLocalVote(toUid) {
  if (toUid === (S.uid || "me")) return { ok: false, reason: "You cannot vote for yourself" };
  if (runtime.myVote) return { ok: false, reason: "You have already voted" };
  const target = runtime.rivals.find((r) => r.uid === toUid);
  if (!target) return { ok: false, reason: "That baker is not in this match" };
  runtime.myVote = toUid;
  runtime.votes[S.uid || "me"] = toUid;
  target.votes = (target.votes || 0) + 1;
  S.stats.votes += 1;
  bump("dailyVotes", 1);
  bumpWeekly("weekVotes", 1);
  saveLocal();
  return { ok: true, to: toUid };
}

/* Rival chefs vote too: they prefer good cakes, but each has a small bias. */
export function simulateRivalVotes() {
  if (runtime.online) return;
  const others = playersInMatch();
  runtime.rivals.forEach((voter) => {
    const options = others.filter((p) => p.uid !== voter.uid && p.design);
    if (!options.length) return;
    let best = null, bestScore = -1;
    options.forEach((p) => {
      const s = scoreDesign(p.design, runtime.theme, {}).base + Math.random() * 14;
      if (s > bestScore) { bestScore = s; best = p; }
    });
    if (best) {
      runtime.votes[voter.uid] = best.uid;
      if (best.isMe && S.uid) runtime.votes[voter.uid] = S.uid;
    }
  });
}

export function buildResults() {
  const theme = runtime.theme;
  const myVotes = countVotesFor(S.uid || "me");
  const mine = runtime.design ? scoreDesign(runtime.design, theme, { votes: myVotes }) : { base: 0, final: 0, theme: 0, creativity: 0, decoration: 0, presentation: 0, completion: 0 };
  const rows = [{
    uid: S.uid || "me", name: S.name || "You", isMe: true,
    level: level(), base: mine.base, votes: myVotes, final: mine.final, breakdown: mine,
    design: runtime.design, online: true
  }];
  runtime.rivals.forEach((r) => {
    const votes = countVotesFor(r.uid);
    const score = scoreDesign(r.design, theme, { votes });
    rows.push({
      uid: r.uid, name: r.name, isMe: false, level: r.level, base: score.base, votes,
      final: score.final, breakdown: score, design: r.design, online: r.online !== false
    });
  });
  rows.sort((a, b) => b.final - a.final);
  const mineRow = rows.find((r) => r.isMe);
  const rank = rows.indexOf(mineRow) + 1;
  const results = { rows, rank, total: rows.length, mine: mineRow, theme };
  runtime.results = results;
  return results;
}

/* Rewards are computed from the player's own result and a rank bonus.
   `onceKey` makes double claiming impossible in the same match. */
export function grantRewards(results) {
  if (!results || !results.mine) return { ok: false };
  const claimedKey = "reward:" + (runtime.matchId || "practice");
  if (runtime.rewardClaimed) return { ok: false, reason: "Already rewarded" };
  runtime.rewardClaimed = true;
  const rank = results.rank;
  const score = results.mine.final;
  const rankBonus = rank === 1 ? 140 : rank === 2 ? 90 : rank === 3 ? 60 : 30;
  const coins = 40 + Math.round(score * 0.95) + rankBonus + (results.total >= 4 ? 25 : 0);
  const xp = 45 + Math.round(score * 0.8) + (rank === 1 ? 60 : 0);

  S.stats.bakes += 1;
  S.stats.matches += 1;
  S.stats.bestScore = Math.max(S.stats.bestScore, score);
  if (results.mine.breakdown.theme >= 18) S.stats.themed += 1;
  if (rank === 1) {
    S.stats.wins += 1;
    S.stats.streak += 1;
    S.stats.bestStreak = Math.max(S.stats.bestStreak, S.stats.streak);
  } else {
    S.stats.streak = 0;
  }
  if (rank <= 3) S.stats.podiums += 1;
  if (results.total >= 4) S.stats.bigMatches += 1;
  const hour = new Date().getHours();
  if (hour >= 0 && hour < 5) S.stats.nightBakes += 1;

  bump("dailyBakes", 1);
  if (rank === 1) bump("dailyWins", 1);
  if (results.mine.breakdown.theme >= 18) bump("dailyThemeMatches", 3);
  bump("dailyBestScore", score);
  bump("weekBakes", 1);
  if (rank === 1) bump("weekWins", 1);

  addCoins(coins);
  addXp(xp);

  S.history.unshift({
    id: runtime.matchId || "practice-" + Date.now(),
    at: Date.now(), theme: results.theme.name, themeId: results.theme.id,
    recipe: recipeById(runtime.design ? runtime.design.recipeId : "birthday-vanilla").name,
    score, rank, total: results.total, coins, xp,
    design: runtime.design,
    online: !!runtime.online
  });
  S.history = S.history.slice(0, 30);
  saveLocal(true);
  checkAchievements();
  const newLevel = level();
  return { ok: true, coins, xp, rank, score, newLevel };
}

/* ---------------------------------------------------------------------
   Match presets
   --------------------------------------------------------------------- */
export function matchSummary() {
  const design = runtime.design;
  return {
    recipe: design ? recipeById(design.recipeId).name : "",
    theme: runtime.theme.name,
    toppings: design ? design.toppings.length : 0,
    score: runtime.myScore ? runtime.myScore.base : 0
  };
}

export function historyStats() {
  const list = S.history || [];
  const wins = list.filter((h) => h.rank === 1).length;
  const avg = list.length ? Math.round(list.reduce((a, h) => a + h.score, 0) / list.length) : 0;
  return { played: list.length, wins, avg, best: S.stats.bestScore };
}

export function phaseFlow() { return PHASES.map((p) => p.id); }

export function nextPhase(id) {
  const idx = PHASES.findIndex((p) => p.id === id);
  return PHASES[Math.min(PHASES.length - 1, idx + 1)].id;
}

export function secondsForPhase(id) {
  return phaseById(id).seconds;
}

/* ---------------------------------------------------------------------
   A tiny deterministic shuffle used by the theme picker so every player
   in a room lands on the same challenge.
   --------------------------------------------------------------------- */
export function themeForMatch(seedText) {
  const seed = seedFrom(String(seedText || "bake-off"));
  return THEMES[seed % THEMES.length];
}
