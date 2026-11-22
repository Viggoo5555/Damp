/* =====================================================================
   COZY FARM — the numbers
   Crops, the barn, the market board and the save file. Prices are per
   kilo and sit near real farm-gate prices, then drift like a commodity
   market so the board is worth watching.
   ===================================================================== */

export const CROPS = [
  { id: "wheat",    name: "Wheat",    price: 2.18, seed: 9,  grow: 50, yield: 120, leaf: "#7f9e54", head: "#dfc176", accent: "#b99a54", blurb: "Bread wheat. Steady, forgiving, always wanted." },
  { id: "corn",     name: "Corn",     price: 2.42, seed: 15, grow: 72, yield: 170, leaf: "#6f9450", head: "#e5c25f", accent: "#c9a13d", blurb: "Tall stalks. Slow, but a heavy trailer." },
  { id: "potato",   name: "Potatoes", price: 3.15, seed: 13, grow: 58, yield: 150, leaf: "#6d8f57", head: "#c8b184", accent: "#9c8458", blurb: "Leafy rows and a good price per kilo." },
  { id: "carrot",   name: "Carrots",  price: 4.30, seed: 8,  grow: 44, yield: 105, leaf: "#84a35c", head: "#e08a3f", accent: "#b96b2c", blurb: "Quick to grow and worth more than grain." },
  { id: "pumpkin",  name: "Pumpkins", price: 6.40, seed: 20, grow: 86, yield: 190, leaf: "#78995a", head: "#df8a3c", accent: "#b4642c", blurb: "The slow, cosy, high-price crop." }
];

export const HAY_PRICE = 68;
export const START_MONEY = 4200;
const SAVE_KEY = "cozy-farm-v1";
const MARKET_MS = 11000;
const DAY_MS = 180000;

function freshMarket() {
  const market = {};
  CROPS.forEach(c => {
    market[c.id] = {
      price: c.price,
      prev: c.price,
      base: c.price,
      hist: Array.from({ length: 12 }, () => c.price)
    };
  });
  return market;
}

function freshTiles(cols, rows) {
  return Array.from({ length: cols * rows }, () => ({
    state: "grass",
    crop: "",
    plantedAt: 0,
    watered: false,
    fertilized: false,
    mowedAt: 0
  }));
}

function fresh() {
  const now = Date.now();
  return {
    money: START_MONEY,
    hay: 0,
    barn: CROPS.reduce((b, c) => { b[c.id] = 0; return b; }, {}),
    selectedCrop: "wheat",
    tool: "plow",
    water: 1,
    fertilizer: 1,
    market: freshMarket(),
    marketAt: now,
    day: 1,
    dayStart: now,
    tiles: freshTiles(10, 7),
    stats: { plowed: 0, planted: 0, watered: 0, harvested: 0, sold: 0, earned: 0, hay: 0 },
    savedAt: now
  };
}

function load() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || typeof data !== "object") return null;
    const base = fresh();
    const state = Object.assign(base, data);
    state.market = Object.assign(freshMarket(), data.market || {});
    CROPS.forEach(c => {
      const m = state.market[c.id] || {};
      state.market[c.id] = {
        price: Number.isFinite(+m.price) ? +m.price : c.price,
        prev: Number.isFinite(+m.prev) ? +m.prev : c.price,
        base: c.price,
        hist: Array.isArray(m.hist) && m.hist.length ? m.hist.slice(-12) : [c.price]
      };
    });
    state.barn = Object.assign(CROPS.reduce((b, c) => { b[c.id] = 0; return b; }, {}), state.barn || {});
    if (!Array.isArray(state.tiles) || state.tiles.length !== 70) state.tiles = freshTiles(10, 7);
    state.stats = Object.assign(base.stats, state.stats || {});
    state.water = Math.max(0, Math.min(1, +state.water));
    state.fertilizer = Math.max(0, Math.min(1, +state.fertilizer));
    state.money = Math.max(0, +state.money || 0);
    state.hay = Math.max(0, Math.round(+state.hay || 0));
    return state;
  } catch (error) {
    return null;
  }
}

export function createStore(cols, rows) {
  const state = load() || fresh();
  if (state.tiles.length !== cols * rows) state.tiles = freshTiles(cols, rows);
  let dirty = false;
  let saveTimer = 0;

  function save(now) {
    state.savedAt = now || Date.now();
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(state)); } catch (error) { /* storage full or blocked */ }
  }

  function touch() {
    dirty = true;
  }

  function cropById(id) {
    return CROPS.find(c => c.id === id) || CROPS[0];
  }

  function format(amount) {
    return Math.round(amount).toLocaleString("en-GB");
  }

  function money(value) {
    return "kr " + format(value);
  }

  function tickMarket(now) {
    // a slow drift while you work, and a bigger move when the day turns
    if (!state.marketAt) state.marketAt = now;
    const dayTurned = now - state.dayStart >= DAY_MS;
    if (now - state.marketAt < MARKET_MS && !dayTurned) return false;
    state.marketAt = now;
    if (dayTurned) {
      state.day = 1 + Math.floor((now - state.dayStart) / DAY_MS);
    }
    CROPS.forEach(c => {
      const m = state.market[c.id];
      const swing = dayTurned ? 0.03 : 0.009;
      const drift = (Math.random() - 0.49) * swing;
      m.prev = m.price;
      m.price = Math.max(c.price * 0.72, Math.min(c.price * 1.32, m.price * (1 + drift)));
      m.hist.push(m.price);
      if (m.hist.length > 12) m.hist.shift();
    });
    touch();
    save(now);
    return true;
  }

  function addMoney(amount) {
    state.money = Math.max(0, state.money + amount);
    touch();
  }

  function spend(amount) {
    if (state.money < amount) return false;
    state.money -= amount;
    touch();
    return true;
  }

  function addHarvest(cropId, kg) {
    state.barn[cropId] = (state.barn[cropId] || 0) + kg;
    state.stats.harvested += kg;
    touch();
  }

  function addHay(n) {
    state.hay += n;
    state.stats.hay += n;
    touch();
  }

  function barnTotal() {
    return CROPS.reduce((sum, c) => sum + (state.barn[c.id] || 0), 0);
  }

  function barnValue() {
    return CROPS.reduce((sum, c) => sum + (state.barn[c.id] || 0) * state.market[c.id].price, 0) + state.hay * HAY_PRICE;
  }

  function sellAll() {
    const lines = [];
    let total = 0;
    CROPS.forEach(c => {
      const kg = Math.round(state.barn[c.id] || 0);
      if (!kg) return;
      const value = kg * state.market[c.id].price;
      lines.push({ id: c.id, name: c.name, kg, value });
      total += value;
      state.barn[c.id] = 0;
    });
    if (state.hay > 0) {
      const bales = state.hay;
      const value = bales * HAY_PRICE;
      lines.push({ id: "hay", name: "Hay bales", kg: bales, value, bales: true });
      total += value;
      state.hay = 0;
    }
    if (total > 0) {
      state.money += total;
      state.stats.sold += 1;
      state.stats.earned += total;
      touch();
      save();
    }
    return { total, lines };
  }

  function tickSave(dt, now) {
    saveTimer += dt;
    if (dirty && saveTimer > 6) { saveTimer = 0; dirty = false; save(now); }
  }

  function reset() {
    try { localStorage.removeItem(SAVE_KEY); } catch (error) { /* blocked */ }
  }

  return {
    state, CROPS, cropById, format, money,
    tickMarket, addMoney, spend, addHarvest, addHay,
    barnTotal, barnValue, sellAll, save, touch, tickSave, reset,
    HAY_PRICE
  };
}
