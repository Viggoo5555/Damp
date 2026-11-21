/* =====================================================================
   store.js — player profile, progression, quests, achievements, shop
   ===================================================================== */
import { todayKey, hashStr, clamp } from './fx.js';

export const SAVE_KEY = 'last-stand-v1';
export const CONFIG = {
  startCoins: 350,
  xpBase: 120,
  xpStep: 70
};

export const RANKS = [
  { id: 'bronze', name: 'BRONZE', min: 0, color: '#c08457' },
  { id: 'silver', name: 'SILVER', min: 900, color: '#c9d2e3' },
  { id: 'gold', name: 'GOLD', min: 1100, color: '#ffd35c' },
  { id: 'platinum', name: 'PLATINUM', min: 1300, color: '#6df0e0' },
  { id: 'diamond', name: 'DIAMOND', min: 1450, color: '#7db6ff' },
  { id: 'master', name: 'MASTER', min: 1600, color: '#c07bff' },
  { id: 'grandmaster', name: 'GRANDMASTER', min: 1750, color: '#ff4f8f' }
];

export function rankFor(rating) {
  let r = RANKS[0];
  for (const k of RANKS) if (rating >= k.min) r = k;
  return r;
}

export function xpNeeded(level) { return CONFIG.xpBase + (level - 1) * CONFIG.xpStep; }

/* ------------------------------------------------------------ cosmetics */
export const COSMETICS = [
  { id: 'plate-standard', type: 'plate', name: 'Standard Tag', desc: 'The factory nameplate.', price: 0, color: '#ecebff' },
  { id: 'plate-cyan', type: 'plate', name: 'Ion Tag', desc: 'Cyan nameplate in lobbies and boards.', price: 260, color: '#3df3ff' },
  { id: 'plate-magenta', type: 'plate', name: 'Hotline Tag', desc: 'Magenta nameplate, impossible to miss.', price: 260, color: '#ff2f9c' },
  { id: 'plate-lime', type: 'plate', name: 'Toxic Tag', desc: 'Sickly green nameplate for sore winners.', price: 320, color: '#b9ff42' },
  { id: 'plate-gold', type: 'plate', name: 'Champion Tag', desc: 'Gold nameplate. People will assume things.', price: 900, color: '#ffd35c' },
  { id: 'trail-cyan', type: 'trail', name: 'Cyan Spark', desc: 'Particle colour when you score.', price: 0, color: '#3df3ff' },
  { id: 'trail-magenta', type: 'trail', name: 'Pink Static', desc: 'Scoring particles burn magenta.', price: 180, color: '#ff2f9c' },
  { id: 'trail-lime', type: 'trail', name: 'Acid Rain', desc: 'Scoring particles drip acid green.', price: 220, color: '#b9ff42' },
  { id: 'trail-violet', type: 'trail', name: 'Void Dust', desc: 'Purple particles from another cabinet.', price: 220, color: '#8b5cff' },
  { id: 'burst-gold', type: 'burst', name: 'Gold Confetti', desc: 'Victory confetti in champion gold.', price: 640, color: '#ffd35c' },
  { id: 'burst-pink', type: 'burst', name: 'Bubblegum Win', desc: 'Victory confetti in riot pink.', price: 480, color: '#ff2f9c' },
  { id: 'frame-white', type: 'frame', name: 'White Frame', desc: 'A clean white frame around your avatar.', price: 200, color: '#ffffff' },
  { id: 'frame-gold', type: 'frame', name: 'Gold Frame', desc: 'Chunky gold frame on your avatar.', price: 700, color: '#ffd35c' },
  { id: 'elim-glitch', type: 'elim', name: 'GLITCH OUT', desc: 'Eliminations flash the word GLITCH.', price: 0, color: '#ff3b5c', word: 'GLITCH' },
  { id: 'elim-burn', type: 'elim', name: 'BURN OUT', desc: 'Eliminations stamp BURNED in embers.', price: 340, color: '#ff8a2b', word: 'BURNED' },
  { id: 'elim-void', type: 'elim', name: 'VOIDED', desc: 'Eliminations whisper VOIDED in purple.', price: 340, color: '#8b5cff', word: 'VOIDED' },
  { id: 'badge-skull', type: 'badge', name: 'Skull Badge', desc: 'A skull where your avatar would be.', price: 300, glyph: 'skull' },
  { id: 'badge-star', type: 'badge', name: 'Star Badge', desc: 'A pixel star avatar.', price: 300, glyph: 'star' },
  { id: 'badge-ghost', type: 'badge', name: 'Ghost Badge', desc: 'A friendly little ghost avatar.', price: 300, glyph: 'ghost' }
];

/* --------------------------------------------------------------- quests */
export const QUEST_POOL = [
  { id: 'play3', text: 'Play 3 matches', goal: 3, key: 'matches', coins: 120, xp: 60 },
  { id: 'win1', text: 'Win a match', goal: 1, key: 'wins', coins: 180, xp: 80 },
  { id: 'top3x2', text: 'Reach the top 3 twice', goal: 2, key: 'top3', coins: 140, xp: 70 },
  { id: 'rounds12', text: 'Survive 12 rounds', goal: 12, key: 'rounds', coins: 130, xp: 70 },
  { id: 'perfect3', text: 'Bank 3 clean rounds (80%+)', goal: 3, key: 'clean', coins: 160, xp: 80 },
  { id: 'games5', text: 'Play 5 different microgames', goal: 5, key: 'uniqueGames', coins: 110, xp: 60 },
  { id: 'elims6', text: 'Knock out 6 rivals', goal: 6, key: 'elims', coins: 150, xp: 70 }
];

/* --------------------------------------------------------- achievements */
export const ACHIEVEMENTS = [
  { id: 'first-blood', name: 'First Blood', desc: 'Win your first match.', test: (p) => p.stats.wins >= 1 },
  { id: 'ten-wins', name: 'Serial Winner', desc: 'Win 10 matches.', test: (p) => p.stats.wins >= 10 },
  { id: 'hundred-wins', name: 'Cabinet Legend', desc: 'Win 100 matches.', test: (p) => p.stats.wins >= 100 },
  { id: 'ten-matches', name: 'Regular', desc: 'Play 10 matches.', test: (p) => p.stats.matches >= 10 },
  { id: 'century', name: 'Century', desc: 'Play 100 matches.', test: (p) => p.stats.matches >= 100 },
  { id: 'level10', name: 'Level 10', desc: 'Reach level 10.', test: (p) => p.level >= 10 },
  { id: 'level25', name: 'Level 25', desc: 'Reach level 25.', test: (p) => p.level >= 25 },
  { id: 'gold-rank', name: 'Gold Standard', desc: 'Reach Gold rank.', test: (p) => p.rating >= 1100 },
  { id: 'diamond-rank', name: 'Diamond Hands', desc: 'Reach Diamond rank.', test: (p) => p.rating >= 1450 },
  { id: 'perfect-round', name: 'Flawless', desc: 'Score 98%+ in a round.', test: (p) => (p.stats.perfects || 0) >= 1 },
  { id: 'untouchable', name: 'Untouchable', desc: 'Win a match without ever placing bottom half.', test: (p) => (p.stats.flawlessWins || 0) >= 1 },
  { id: 'streak5', name: 'On Fire', desc: 'Win 5 matches in a row.', test: (p) => (p.stats.bestStreak || 0) >= 5 },
  { id: 'collector', name: 'Collector', desc: 'Own 8 cosmetics.', test: (p) => (p.owned || []).length >= 8 },
  { id: 'questmaster', name: 'Quest Master', desc: 'Claim 20 quests.', test: (p) => (p.stats.quests || 0) >= 20 },
  { id: 'allgames', name: 'Omnivore', desc: 'Play every microgame.', test: (p) => Object.keys(p.stats.byGame || {}).length >= 18 }
];

/* -------------------------------------------------------------- profile */
export function defaultProfile(name) {
  return {
    v: 2,
    name: name || 'guest',
    level: 1,
    xp: 0,
    coins: CONFIG.startCoins,
    rating: 1000,
    created: Date.now(),
    updated: Date.now(),
    stats: {
      matches: 0, wins: 0, top3: 0, rounds: 0, elims: 0, perfects: 0,
      bestPlace: 0, flawlessWins: 0, streak: 0, bestStreak: 0, quests: 0,
      clean: 0, byGame: {}
    },
    daily: { day: '', counters: {}, quests: [] },
    achievements: {},
    owned: ['plate-standard', 'trail-cyan', 'elim-glitch'],
    equipped: { plate: 'plate-standard', trail: 'trail-cyan', burst: 'burst-pink', frame: '', elim: 'elim-glitch', badge: '' },
    pb: {},
    settings: {
      music: 0.5, sfx: 0.7, muted: false, shake: true, crt: true,
      reduced: false, quality: 'high', hints: true
    },
    seenTutorial: false
  };
}

function mergeProfile(base, incoming) {
  if (!incoming || typeof incoming !== 'object') return base;
  const out = Object.assign({}, base, incoming);
  out.stats = Object.assign({}, base.stats, incoming.stats || {});
  out.stats.byGame = Object.assign({}, base.stats.byGame || {}, (incoming.stats || {}).byGame || {});
  out.settings = Object.assign({}, base.settings, incoming.settings || {});
  out.equipped = Object.assign({}, base.equipped, incoming.equipped || {});
  out.owned = Array.from(new Set([...(base.owned || []), ...(incoming.owned || [])]));
  out.achievements = Object.assign({}, base.achievements, incoming.achievements || {});
  out.pb = Object.assign({}, base.pb, incoming.pb || {});
  out.daily = Object.assign({}, base.daily, incoming.daily || {});
  return out;
}

class Store {
  constructor() {
    this.profile = defaultProfile('guest');
    this.listeners = [];
    this.remote = null;
    this.uid = null;
    this.localOnly = true;
  }
  on(fn) { this.listeners.push(fn); return () => { this.listeners = this.listeners.filter((f) => f !== fn); }; }
  emit(what) { this.listeners.forEach((fn) => { try { fn(what, this.profile); } catch (e) { console.warn(e); } }); }

  load() {
    let raw = null;
    try { raw = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null'); } catch (e) { raw = null; }
    if (raw) this.profile = mergeProfile(defaultProfile(raw.name), raw);
    this.rollDaily();
    this.applySettings();
    return this.profile;
  }
  bindRemote(profile, uid) {
    this.remote = profile || null;
    this.uid = uid || null;
    this.localOnly = !uid;
    if (profile) {
      // remote wins on progression, local wins on settings that were changed offline
      const merged = mergeProfile(this.profile, profile);
      merged.settings = this.profile.settings;
      this.profile = merged;
      this.emit('remote');
    }
    this.rollDaily();
    return this.profile;
  }
  save() {
    this.profile.updated = Date.now();
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(this.profile)); } catch (e) { /* storage full */ }
    if (this.pushRemote) this.pushRemote(this.profile);
  }

  /* ------------------------------------------------------------ economy */
  addCoins(n) {
    this.profile.coins = Math.max(0, this.profile.coins + n);
    this.save(); this.emit('coins');
  }
  addXp(n) {
    const p = this.profile;
    p.xp += n;
    let levelled = 0;
    while (p.xp >= xpNeeded(p.level)) {
      p.xp -= xpNeeded(p.level);
      p.level += 1;
      levelled = p.level;
    }
    this.save(); this.emit('xp');
    return levelled;
  }
  levelProgress() {
    const p = this.profile;
    return { have: p.xp, need: xpNeeded(p.level), pct: clamp(p.xp / xpNeeded(p.level), 0, 1) };
  }

  /* --------------------------------------------------------------- shop */
  owns(id) { return this.profile.owned.includes(id); }
  cosmetic(id) { return COSMETICS.find((c) => c.id === id); }
  buy(id) {
    const c = this.cosmetic(id);
    if (!c || this.owns(id)) return false;
    if (this.profile.coins < c.price) return false;
    this.profile.coins -= c.price;
    this.profile.owned.push(id);
    this.save(); this.emit('shop');
    return true;
  }
  equip(id) {
    const c = this.cosmetic(id);
    if (!c || !this.owns(id)) return false;
    this.profile.equipped[c.type] = id;
    this.save(); this.emit('shop');
    return true;
  }
  unequip(type) {
    this.profile.equipped[type] = '';
    this.save(); this.emit('shop');
  }
  equippedColor(type, fallback = '#3df3ff') {
    const id = this.profile.equipped[type];
    const c = id ? this.cosmetic(id) : null;
    return c && c.color ? c.color : fallback;
  }
  equippedWord() {
    const c = this.cosmetic(this.profile.equipped.elim || '');
    return (c && c.word) || 'GLITCH';
  }

  /* -------------------------------------------------------------- daily */
  rollDaily() {
    const p = this.profile;
    const day = todayKey();
    if (p.daily && p.daily.day === day) return;
    const seed = hashStr(day + '|' + (this.uid || p.name || 'guest'));
    const pool = QUEST_POOL.slice();
    const chosen = [];
    for (let i = 0; i < 3 && pool.length; i++) {
      const idx = (seed >> (i * 5)) % pool.length;
      chosen.push(Object.assign({ progress: 0, claimed: false }, pool.splice(idx, 1)[0]));
    }
    p.daily = { day, counters: {}, quests: chosen };
    this.save(); this.emit('daily');
  }
  bumpCounter(key, by = 1) {
    const p = this.profile;
    if (!p.daily) this.rollDaily();
    p.daily.counters[key] = (p.daily.counters[key] || 0) + by;
    this.refreshQuests();
  }
  questProgress(q) {
    if (q.key === 'uniqueGames') return (this.profile.daily.counters.gamesSet || []).length;
    return this.profile.daily.counters[q.key] || 0;
  }
  refreshQuests() {
    const p = this.profile;
    if (!p.daily) return;
    p.daily.quests.forEach((q) => { q.progress = Math.min(q.goal, this.questProgress(q)); });
  }
  claimQuest(id) {
    const p = this.profile;
    const q = (p.daily.quests || []).find((x) => x.id === id);
    if (!q || q.claimed || q.progress < q.goal) return false;
    q.claimed = true;
    p.coins += q.coins;
    p.xp += q.xp;
    p.stats.quests = (p.stats.quests || 0) + 1;
    let levelled = 0;
    while (p.xp >= xpNeeded(p.level)) { p.xp -= xpNeeded(p.level); p.level += 1; levelled = p.level; }
    this.save(); this.emit('quest');
    return { coins: q.coins, xp: q.xp, level: levelled };
  }
  countGames(games) {
    const p = this.profile;
    if (!p.daily) this.rollDaily();
    p.daily.counters.gamesSet = Array.from(new Set([...(p.daily.counters.gamesSet || []), ...games]));
    this.refreshQuests();
  }

  /* -------------------------------------------------------- achievements */
  checkAchievements() {
    const p = this.profile;
    const newly = [];
    for (const a of ACHIEVEMENTS) {
      if (p.achievements[a.id]) continue;
      let ok = false;
      try { ok = !!a.test(p); } catch (e) { ok = false; }
      if (ok) { p.achievements[a.id] = Date.now(); newly.push(a); }
    }
    if (newly.length) this.save();
    return newly;
  }

  /* ------------------------------------------------------------- settings */
  applySettings() {
    const s = this.profile.settings;
    document.body.classList.toggle('no-crt', !s.crt);
    document.body.classList.toggle('reduced-motion', !!s.reduced);
    if (this.onSettings) this.onSettings(s);
  }
  setSetting(key, value) {
    this.profile.settings[key] = value;
    this.applySettings();
    this.save();
    this.emit('settings');
  }

  /* -------------------------------------------------------------- result */
  recordMatch(res) {
    const p = this.profile;
    const s = p.stats;
    s.matches += 1;
    s.rounds += res.rounds || 0;
    s.byGame = s.byGame || {};
    (res.games || []).forEach((g) => { s.byGame[g] = (s.byGame[g] || 0) + 1; });
    // a solo gauntlet is practice, not a competitive win
    if (res.place === 1 && !res.solo) {
      s.wins += 1;
      s.streak = (s.streak || 0) + 1;
      if (s.streak > (s.bestStreak || 0)) s.bestStreak = s.streak;
      if (res.flawless) s.flawlessWins = (s.flawlessWins || 0) + 1;
    } else {
      s.streak = 0;
    }
    if (res.place <= 3 && !res.solo) s.top3 += 1;
    if (!res.solo) {
      if (res.place <= 3 && !s.bestPlace) s.bestPlace = res.place;
      if (res.place < (s.bestPlace || 99)) s.bestPlace = res.place;
    }
    const wins = res.knockedOut || 0;
    s.elims += wins;

    // rating
    let delta = 0;
    if (res.ranked && !res.solo) {
      if (res.place === 1 && !res.solo) delta = 24;
      else if (res.place <= 3) delta = 12;
      else if (res.place <= Math.max(4, Math.ceil(res.field / 2))) delta = 2;
      else delta = -8;
      if (res.field <= 2 && res.place === 1) delta = 14;
      p.rating = Math.max(0, p.rating + delta);
    }

    // rewards
    const xp = (res.xp != null ? res.xp : 0);
    const coins = (res.coins != null ? res.coins : 0);
    p.coins += coins;
    let levelled = 0;
    p.xp += xp;
    while (p.xp >= xpNeeded(p.level)) { p.xp -= xpNeeded(p.level); p.level += 1; levelled = p.level; }

    // daily counters
    if (!p.daily) this.rollDaily();
    const c = p.daily.counters;
    c.matches = (c.matches || 0) + 1;
    if (res.place === 1 && !res.solo) c.wins = (c.wins || 0) + 1;
    if (res.place <= 3 && !res.solo) c.top3 = (c.top3 || 0) + 1;
    c.rounds = (c.rounds || 0) + (res.rounds || 0);
    c.clean = (c.clean || 0) + (res.cleanRounds || 0);
    c.elims = (c.elims || 0) + wins;
    this.countGames(res.games || []);
    this.refreshQuests();

    this.save();
    const ach = this.checkAchievements();
    this.emit('match');
    return { delta, levelled, achievements: ach, xp, coins };
  }
}

export const store = new Store();
