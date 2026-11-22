/* =====================================================================
   PET CAFÉ — interface
   HUD, order rail, speech bubbles, building, shops and every panel.
   ===================================================================== */
import * as game from "./game.js";
import * as cloud from "./cloud.js";
import * as world from "./scene.js";
import { buildAnimal, buildFood } from "./models.js";
import { buildFurniture } from "./furniture-models.js";
import { CONFIG } from "./config.js";
import {
  S, runtime, level, ambience, unlockedRecipes, averageHappiness,
  stationCount, patioDepth, animalUnlockedForAdopt, dailyAvailable
} from "./game.js";
import {
  ANIMALS, animalById, RARITIES, RECIPES, recipeById, FURNITURE, FURNITURE_CATS,
  FLOORING, WALLS, furnitureById, PANTRY, PANTRY_PACKS, ACHIEVEMENTS,
  DAILY_REWARDS, EXPANSIONS, TIPS, animalUnlockText, levelInfo
} from "./data.js";

const $ = (id) => document.getElementById(id);
const esc = (value) => String(value === undefined || value === null ? "" : value)
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
const ico = (name) => `<svg aria-hidden="true"><use href="#i-${name}"/></svg>`;
const money = (n) => Number(n || 0).toLocaleString("en-GB");
const stars = (n) => "★".repeat(Math.max(0, n)) + "☆".repeat(Math.max(0, 5 - n));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export const U = {
  screen: null,
  tabs: { kitchen: "orders", animals: "collection", shop: "furniture", discover: "popular", profile: "you", quests: "daily", friends: "friends" },
  buildMode: false,
  buildCat: "All",
  placing: null,
  movingEntry: null,
  ghostRy: 0,
  selectedEntry: null,
  cookOrder: null,
  cookRunning: false,
  detailKind: null,
  detailId: null,
  cafes: [],
  cafesLoaded: false,
  comp: { entries: [], votes: [], voted: false, loading: false },
  friends: { following: [], followers: [], cafes: [], presence: {}, loading: false, loaded: false },
  visits: { liked: false, rating: 0 },
  feedStarted: false,
  search: "",
  loading: {},
  confirmCb: null,
  tipIndex: 0,
  lastHud: 0,
  bubbleEls: new Map(),
  toastCount: 0
};

/* ---------------------------------------------------------------------
   Portraits: real renders of the 3D models, drawn once and cached.
   --------------------------------------------------------------------- */
const portraitCache = { animal: new Map(), food: new Map(), furniture: new Map() };
const portraitQueue = [];
const portraitPending = new Set();
let portraitPump = false;

function portraitKey(kind, id) { return kind + ":" + id; }

function requestPortrait(kind, id, img) {
  const key = portraitKey(kind, id);
  if (portraitCache[kind].has(id)) {
    img.src = portraitCache[kind].get(id);
    img.dataset.done = "1";
    return;
  }
  if (!portraitPending.has(key)) {
    portraitPending.add(key);
    portraitQueue.push({ kind, id, key });
  }
  pumpPortraits();
}

function pumpPortraits() {
  if (portraitPump || !portraitQueue.length) return;
  portraitPump = true;
  const run = () => {
    const batch = portraitQueue.splice(0, 2);
    batch.forEach((entry) => {
      portraitPending.delete(entry.key);
      if (portraitCache[entry.kind].has(entry.id)) return;
      try {
        let src = "";
        if (entry.kind === "animal") src = world.animalPortrait(animalById(entry.id) || ANIMALS[0], 340);
        else if (entry.kind === "food") src = world.foodPortrait(recipeById(entry.id) || RECIPES[0], 220);
        else if (entry.kind === "furniture") src = world.furniturePortrait(furnitureById(entry.id), 220);
        if (src) portraitCache[entry.kind].set(entry.id, src);
      } catch (error) { /* the card keeps its soft placeholder */ }
    });
    document.querySelectorAll("img[data-p]").forEach((img) => {
      if (img.dataset.done) return;
      const [kind, ...rest] = img.dataset.p.split(":");
      const id = rest.join(":");
      if (portraitCache[kind] && portraitCache[kind].has(id)) {
        img.src = portraitCache[kind].get(id);
        img.dataset.done = "1";
      }
    });
    if (portraitQueue.length) requestAnimationFrame(run);
    else portraitPump = false;
  };
  requestAnimationFrame(run);
}

function pimg(kind, id, cls = "") {
  return `<img class="${cls}" data-p="${esc(kind)}:${esc(id)}" alt="" draggable="false" loading="lazy">`;
}
function portraitSrc(kind, id) {
  if (portraitCache[kind].has(id)) return portraitCache[kind].get(id);
  let src = "";
  try {
    if (kind === "animal") src = world.animalPortrait(animalById(id) || ANIMALS[0], 340);
    if (kind === "food") src = world.foodPortrait(recipeById(id) || RECIPES[0], 220);
    if (kind === "furniture") src = world.furniturePortrait(furnitureById(id), 220);
    if (src) portraitCache[kind].set(id, src);
  } catch (error) { /* ignore */ }
  return src;
}
function paint(root) {
  if (!root) return;
  root.querySelectorAll("img[data-p]").forEach((img) => {
    if (img.dataset.done) return;
    const [kind, ...rest] = img.dataset.p.split(":");
    const id = rest.join(":");
    requestPortrait(kind, id, img);
  });
}

/* ---------------------------------------------------------------------
   Sound — tiny warm WebAudio chimes, no files
   --------------------------------------------------------------------- */
let audio = null;
const SOUNDS = {
  click: [[480, 0.03, 0.03]],
  chime: [[660, 0.05, 0], [880, 0.05, 0.07], [1320, 0.04, 0.15]],
  coin: [[740, 0.05, 0], [1100, 0.05, 0.06]],
  buy: [[520, 0.04, 0], [780, 0.05, 0.05]],
  place: [[300, 0.04, 0]],
  level: [[523, 0.06, 0], [659, 0.06, 0.08], [784, 0.06, 0.16], [1047, 0.05, 0.24]],
  perfect: [[880, 0.05, 0], [1175, 0.06, 0.06]],
  ding: [[988, 0.05, 0]],
  adopt: [[523, 0.06, 0], [784, 0.06, 0.09]],
  purr: [[190, 0.07, 0], [150, 0.07, 0.1]],
  nom: [[220, 0.03, 0], [180, 0.03, 0.07]],
  bell: [[1046, 0.05, 0], [1318, 0.04, 0.07]],
  quack: [[320, 0.03, 0], [260, 0.04, 0.06]],
  sad: [[330, 0.08, 0], [240, 0.1, 0.1]]
};
export function playSound(kind) {
  if (!S.settings.sound) return;
  try {
    audio = audio || new (window.AudioContext || window.webkitAudioContext)();
    if (audio.state === "suspended") audio.resume();
    const now = audio.currentTime;
    (SOUNDS[kind] || SOUNDS.click).forEach(([freq, gainValue, delay]) => {
      const osc = audio.createOscillator();
      const gain = audio.createGain();
      osc.type = kind === "purr" ? "triangle" : "sine";
      osc.frequency.value = freq;
      const start = now + delay;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(gainValue, start + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.32);
      osc.connect(gain).connect(audio.destination);
      osc.start(start);
      osc.stop(start + 0.34);
    });
  } catch (error) { /* audio waits for a gesture */ }
}

/* ---------------------------------------------------------------------
   Toasts, floaters, confirm
   --------------------------------------------------------------------- */
export function toast(title, text, icon = "check", bad = false) {
  const box = $("toasts");
  if (!box) return;
  while (box.children.length >= 4) box.firstChild.remove();
  const el = document.createElement("div");
  el.className = "toast" + (bad ? " bad" : "");
  el.innerHTML = `${ico(bad ? "x" : icon)}<div><strong>${esc(title)}</strong>${text ? `<div class="hint">${esc(text)}</div>` : ""}</div>`;
  box.appendChild(el);
  setTimeout(() => {
    el.classList.add("leaving");
    setTimeout(() => el.remove(), 260);
  }, 4600);
}
export function floatText(pos, text, kind = "") {
  const box = $("floaters");
  if (!box || !pos || !pos.visible) return;
  const el = document.createElement("div");
  el.className = "floater " + kind;
  el.textContent = text;
  el.style.left = pos.x + "px";
  el.style.top = pos.y + "px";
  box.appendChild(el);
  setTimeout(() => el.remove(), 1600);
}
function askConfirm(title, text, yesLabel, cb) {
  $("confirm-title").textContent = title;
  $("confirm-text").textContent = text;
  $("confirm-yes").textContent = yesLabel || "Yes";
  $("confirm-icon").innerHTML = ico("check");
  U.confirmCb = cb;
  $("confirm-modal").hidden = false;
}

/* ---------------------------------------------------------------------
   HUD
   --------------------------------------------------------------------- */
export function renderHud() {
  const info = levelInfo(S.xp);
  $("cafe-name").textContent = S.name && S.name !== "Guest" ? S.name : "Pet Café";
  $("cafe-tagline").textContent = game.runtime.visiting ? "visiting" : "your little café";
  $("level-value").textContent = info.level;
  $("xp-value").textContent = `${money(info.into)} / ${money(info.need)} XP`;
  $("xp-fill").style.width = Math.round(info.pct * 100) + "%";
  $("coin-value").textContent = money(S.coins);
  $("like-value").textContent = money(S.likes);
  $("treat-value").textContent = money(S.treats);
  $("today-earnings").textContent = money(S.earnings.coins);
  $("today-guests").textContent = `${S.earnings.customers} guest${S.earnings.customers === 1 ? "" : "s"}`;
  $("rep-label").textContent = `Reputation ${Math.round(S.rep)}`;
  $("rep-fill").style.width = clamp(S.rep, 0, 100) + "%";
  const dot = $("daily-dot");
  if (dot) dot.hidden = !dailyAvailable();
  const soundBtn = $("cam-sound");
  if (soundBtn) {
    soundBtn.innerHTML = ico(S.settings.sound ? "sound" : "mute");
    soundBtn.classList.toggle("off", !S.settings.sound);
  }
  const badge = $("animal-badge");
  if (badge) {
    const rescue = game.getStrays().length;
    const ready = ANIMALS.filter((a) => !S.animals.some((owned) => owned.id === a.id)).filter((a) => {
      const state = animalUnlockedForAdopt(a);
      return state.ready && a.unlock.type !== "shop";
    }).length;
    const total = rescue + ready;
    badge.hidden = total === 0;
    badge.textContent = total > 9 ? "9+" : total;
  }
  $("tip-text").textContent = TIPS[U.tipIndex % TIPS.length];
  renderVisitBar();
}

export function renderVisitBar() {
  const bar = $("visitbar");
  const visit = runtime.visiting;
  bar.hidden = !visit;
  if (!visit) return;
  $("visit-name").textContent = visit.name;
  $("visit-meta").textContent = `Level ${visit.level} · ${visit.likes || 0} heart${visit.likes === 1 ? "" : "s"}`;
  const like = $("visit-like");
  like.classList.toggle("primary", U.visits.liked);
  like.querySelector("span").textContent = U.visits.liked ? "Heart left" : "Leave a heart";
  document.querySelectorAll("#visit-rate button").forEach((b) => {
    b.classList.toggle("on", Number(b.dataset.stars) <= U.visits.rating);
  });
}

export function setSavePill(state) {
  const pill = $("save-pill");
  if (!pill) return;
  pill.classList.remove("saving", "error");
  if (state === "saving") { pill.textContent = "Saving…"; pill.classList.add("saving"); }
  else if (state === "error") { pill.textContent = "Offline save"; pill.classList.add("error"); }
  else if (state === "cloud") { pill.textContent = "Saved to cloud"; }
  else { pill.textContent = "Saved"; }
}

/* ---------------------------------------------------------------------
   Order rail
   --------------------------------------------------------------------- */
function activeOrders() {
  return runtime.orders.filter((o) => o.state === "waiting" || o.state === "ready");
}

export function renderOrders() {
  const rail = $("orders");
  if (!rail) return;
  if (runtime.visiting) { rail.innerHTML = ""; return; }
  const orders = activeOrders();
  rail.innerHTML = orders.map((order) => {
    const recipe = recipeById(order.recipeId);
    const customer = runtime.customers.find((c) => c.id === order.customerId);
    const pct = customer ? clamp(customer.patience / Math.max(1, customer.maxPatience), 0, 1) : 0;
    const ready = order.state === "ready";
    return `<div class="order ${ready ? "ready" : ""}" data-order="${esc(order.id)}">
      ${order.qualityLabel ? `<span class="o-quality">${esc(order.qualityLabel)}</span>` : ""}
      ${pimg("food", order.recipeId, "food-img")}
      <div>
        <span class="o-name">${esc(recipe ? recipe.name : "Order")}</span>
        <span class="o-who">${esc(order.customerName)} · ${esc(recipe ? stationLabel(recipe.station) : "")}</span>
        <div class="o-bar ${pct < 0.3 ? "low" : ""}" data-bar="${esc(order.id)}"><i style="width:${Math.round(pct * 100)}%"></i></div>
      </div>
      <div class="o-act">
        ${ready
          ? `<button class="btn small primary" data-act="serve" data-id="${esc(order.id)}">${ico("bell")}Serve</button>`
          : `<button class="btn small" data-act="cook" data-id="${esc(order.id)}">${ico("pot")}Cook</button>`}

      </div>
    </div>`;
  }).join("");
  paint(rail);
  updateOrderBars();
}

export function updateOrderBars() {
  const orders = activeOrders();
  orders.forEach((order) => {
    const customer = runtime.customers.find((c) => c.id === order.customerId);
    const bar = document.querySelector(`[data-bar="${order.id}"]`);
    if (!bar || !customer) return;
    const pct = clamp(customer.patience / Math.max(1, customer.maxPatience), 0, 1);
    bar.querySelector("i").style.width = Math.round(pct * 100) + "%";
    bar.classList.toggle("low", pct < 0.3);
  });
}

function stationLabel(kind) {
  return { oven: "pastry oven", stove: "cooktop", espresso: "espresso bar", blender: "blender", freezer: "freezer" }[kind] || "kitchen";
}

/* ---------------------------------------------------------------------
   Speech bubbles over the guests
   --------------------------------------------------------------------- */
function customerTap(customer) {
  if (!customer) return;
  if (customer.phase === "ordering") {
    game.takeOrder(customer);
  } else if (customer.phase === "waiting") {
    if (game.serveCustomer(customer)) return;
    if (runtime.orders.some((o) => o.customerId === customer.id && o.state === "ready")) game.serveCustomer(customer);
  } else if (customer.phase === "eating") {
    floatText(world.projectToScreen(customer.handle.headVec), "♥", "heart");
  }
}

function bubbleKeyFor(customer) {
  if (customer.phase === "ordering") return "order:" + customer.recipe.id;
  if (customer.phase === "waiting") {
    const order = runtime.orders.find((o) => o.customerId === customer.id);
    return "wait:" + (order ? order.state : "cooking") + ":" + (order ? order.qualityLabel || "" : "");
  }
  return "";
}

export function renderBubbles() {
  const host = $("bubbles");
  if (!host) return;
  const seen = new Set();
  if (!runtime.visiting) {
    runtime.customers.forEach((customer) => {
      const phase = customer.phase;
      if (phase !== "ordering" && phase !== "waiting") return;
      const order = runtime.orders.find((o) => o.customerId === customer.id);
      if (phase === "waiting" && !order) return;
      const pos = world.projectToScreen(customer.handle.headVec);
      if (!pos.visible) return;
      const key = bubbleKeyFor(customer);
      let el = U.bubbleEls.get(customer.id);
      if (!el) {
        el = document.createElement("button");
        el.type = "button";
        el.className = "bubble";
        el.dataset.customer = customer.id;
        el.addEventListener("click", () => customerTap(customer));
        host.appendChild(el);
        U.bubbleEls.set(customer.id, el);
      }
      if (el.dataset.key !== key) {
        el.dataset.key = key;
        el.classList.toggle("ready", order && order.state === "ready");
        const recipe = customer.recipe;
        el.innerHTML = `${pimg("food", recipe.id)}
          <span class="b-info"><span class="b-recipe">${esc(recipe.name)}</span><span class="b-state">${order && order.state === "ready" ? "Tap to serve" : phase === "ordering" ? "Tap to order" : order && order.state === "waiting" && !(game.runtime.cooking && game.runtime.cooking.orderId === order.id) ? "Tap to cook" : "Cooking…"}</span></span>
          <span class="b-ring"><span></span></span>`;
        paint(el);
      }
      const pct = clamp(customer.patience / Math.max(1, customer.maxPatience), 0, 1);
      const ring = el.querySelector(".b-ring");
      if (ring) {
        ring.style.setProperty("--p", Math.round(pct * 100));
        ring.classList.toggle("low", pct < 0.3);
      }
      el.style.left = pos.x + "px";
      el.style.top = pos.y + "px";
      seen.add(customer.id);
    });

    game.getStrays().forEach((stray) => {
      const id = "stray_" + stray.animalId;
      const pos = world.projectToScreen(stray.handle.headVec);
      if (!pos.visible) return;
      let el = U.bubbleEls.get(id);
      if (!el) {
        el = document.createElement("button");
        el.type = "button";
        el.className = "bubble stray";
        el.dataset.stray = stray.animalId;
        el.innerHTML = `${pimg("animal", stray.animalId)}<span class="b-info"><span class="b-recipe">${esc(stray.def.name)}</span><span class="b-state">Tap to adopt</span></span><span class="b-ring" style="--p:100"><span></span></span>`;
        el.addEventListener("click", () => {
          if (game.petStray(stray.animalId)) {
            toast("Rescued", `${stray.def.name} has a home here now.`, "paw");
            renderHud();
          }
        });
        host.appendChild(el);
        U.bubbleEls.set(id, el);
        paint(el);
      }
      el.style.left = pos.x + "px";
      el.style.top = pos.y + "px";
      seen.add(id);
    });
  }
  U.bubbleEls.forEach((el, id) => {
    if (!seen.has(id)) { el.remove(); U.bubbleEls.delete(id); }
  });
}

/* ---------------------------------------------------------------------
   Build mode
   --------------------------------------------------------------------- */
export function enterBuild() {
  if (runtime.visiting) { toast("You're visiting", "Head home to redecorate your own café.", "home", true); return; }
  closePanel();
  U.buildMode = true;
  U.buildCat = U.buildCat || "All";
  world.setMode("build");
  $("buildbar").hidden = false;
  $("sheet-scrim").hidden = true;
  setNav("build");
  renderBuildBar();
  hint("Pick a piece, then tap the floor to place it.");
}

export function exitBuild() {
  U.buildMode = false;
  U.placing = null;
  U.movingEntry = null;
  U.selectedEntry = null;
  world.clearGhost();
  world.setMode("play");
  $("buildbar").hidden = true;
  setNav("cafe");
  $("build-hint").textContent = "Pick a piece, then tap the floor to place it.";
}

function hint(text) { $("build-hint").textContent = text; }

export function renderBuildBar() {
  const cats = ["All", ...FURNITURE_CATS.filter((c) => c !== "All")];
  $("build-cats").innerHTML = cats.map((cat) =>
    `<button type="button" class="tab ${U.buildCat === cat ? "on" : ""}" data-act="build-cat" data-cat="${esc(cat)}">${esc(cat)}</button>`
  ).join("");
  const owned = Object.keys(S.inv).filter((id) => S.inv[id] > 0 && furnitureById(id));
  const shown = owned.filter((id) => U.buildCat === "All" || furnitureById(id).cat === U.buildCat);
  const selected = U.placing ? U.placing.id : U.movingEntry ? U.movingEntry.id : null;
  const strip = $("build-items");
  if (!shown.length) {
    strip.innerHTML = `<div class="empty" style="width:100%;padding:16px"><strong>Nothing in storage</strong><p>Buy furniture from the shop, then place it here.</p><button class="btn small primary" data-act="shop-open">${ico("shop")}Furniture shop</button></div>`;
  } else {
    strip.innerHTML = shown.map((id) => {
      const def = furnitureById(id);
      return `<button type="button" class="build-item ${selected === id ? "on" : ""}" data-act="build-pick" data-id="${esc(id)}" title="${esc(def.name)}">
        ${pimg("furniture", id)}
        <b>${esc(def.name)}</b>
        <em>${S.inv[id]}</em>
      </button>`;
    }).join("");
  }
  $("build-snap").classList.toggle("on", !!S.settings.snap);
  $("build-snap").querySelector("span").textContent = S.settings.snap ? "Snap on" : "Snap off";
  paint($("buildbar"));
}

function buildPick(id) {
  const def = furnitureById(id);
  if (!def || !(S.inv[id] > 0)) return;
  U.movingEntry = null;
  U.selectedEntry = null;
  U.placing = { id, ry: 0 };
  U.ghostRy = 0;
  world.makeGhost(def);
  world.setGhostValid(false);
  hint(`Placing ${def.name} — tap a spot. R rotates, X cancels.`);
  renderBuildBar();
}

function beginMove(entry) {
  const def = furnitureById(entry.id);
  if (!def) return;
  U.placing = null;
  U.movingEntry = entry;
  U.selectedEntry = entry;
  U.ghostRy = entry.ry || 0;
  world.makeGhost(def);
  world.moveGhost(entry.x, entry.z, entry.ry || 0, world.mountHeight(def));
  hint(`Moving ${def.name} — tap a new spot. R rotates.`);
  renderBuildBar();
}

function rotateGhost() {
  if (!U.placing && !U.movingEntry) return;
  U.ghostRy += Math.PI / 2;
  const ghost = world.world.ghost;
  if (ghost) ghost.rotation.y = U.ghostRy;
}

function buildTarget(meta) {
  const def = U.placing ? furnitureById(U.placing.id) : U.movingEntry ? furnitureById(U.movingEntry.id) : null;
  if (!def) return null;
  const ground = world.groundAt(meta.x, meta.y);
  if (!ground) return null;
  let x = ground.x, z = ground.z, wall = null;
  if (def.place === "wall") {
    const hit = world.wallAt(meta.x, meta.y);
    if (!hit) return null;
    wall = hit.wall;
    if (wall === "back") { x = hit.point.x; z = -CONFIG.room.d / 2 + 0.07; }
    else if (wall === "left") { x = -CONFIG.room.w / 2 + 0.07; z = hit.point.z; }
    else { x = CONFIG.room.w / 2 - 0.07; z = hit.point.z; }
  }
  return { x, z, wall, def, ry: def.place === "wall" ? world.wallRotation(wall) : U.ghostRy };
}

function updateGhost(meta) {
  if (!U.buildMode || (!U.placing && !U.movingEntry)) return;
  const target = buildTarget(meta);
  if (!target) { world.setGhostValid(false); return; }
  const y = world.mountHeight(target.def);
  if (target.def.place === "wall") {
    world.moveGhost(target.x, target.z, target.ry, y);
    world.setGhostValid(true);
  } else {
    world.moveGhost(target.x, target.z, target.ry, y);
    world.setGhostValid(game.canPlace(target.def, target.x, target.z, target.ry, null, U.movingEntry && U.movingEntry.uid));
  }
}

function commitBuild(meta) {
  const target = buildTarget(meta);
  if (!target) { toast("Find a spot inside the café", "Tap the floor or a wall to place it.", "warning", true); return; }
  if (U.placing) {
    const id = U.placing.id;
    const ok = game.placeItem(id, target.x, target.z, target.ry, target.wall);
    if (ok) {
      world.clearGhost();
      U.placing = null;
      if ((S.inv[id] || 0) > 0) {
        buildPick(id);
      } else {
        hint("Placed. Pick another piece or press Done.");
      }
      renderBuildBar();
      renderHud();
    }
  } else if (U.movingEntry) {
    const entry = U.movingEntry;
    const ok = game.moveItem(entry.uid, target.x, target.z, target.ry, target.wall || entry.wall);
    if (ok) {
      world.clearGhost();
      U.movingEntry = null;
      U.selectedEntry = null;
      hint("Moved. Tap another piece to move it, or pick something new.");
      renderBuildBar();
    }
  }
}

function removeSelected() {
  if (U.movingEntry) {
    const entry = U.movingEntry;
    game.removeItem(entry.uid);
    world.clearGhost();
    U.movingEntry = null;
    U.selectedEntry = null;
    hint("Put back in storage.");
    renderBuildBar();
    return;
  }
  if (U.placing) {
    U.placing = null;
    world.clearGhost();
    hint("Cancelled.");
    renderBuildBar();
    return;
  }
  toast("Nothing selected", "Tap a piece of furniture to pick it up.", "build", true);
}

/* ---------------------------------------------------------------------
   Panels
   --------------------------------------------------------------------- */
const SCREEN_META = {
  kitchen: { eyebrow: "The kitchen", title: "Cooking & pantry", sub: "Every order is cooked to order. Time it well for a better tip." },
  animals: { eyebrow: "Little friends", title: "Animals", sub: "Collect them, keep them happy, and let them wander the café." },
  shop: { eyebrow: "The shop", title: "Furniture & supplies", sub: "Build the café you want, one piece at a time." },
  friends: { eyebrow: "People", title: "Friends", sub: "Follow other cafés, see who is open, and drop by for a visit." },
  discover: { eyebrow: "Out there", title: "Discover cafés", sub: "Real cafés from real players, saved exactly as they built them." },
  profile: { eyebrow: "You", title: "Your café", sub: "Everything you have built, served and collected." },
  quests: { eyebrow: "A little direction", title: "Quests & awards", sub: "Small goals, warm rewards. A fresh set arrives every day." },
  settings: { eyebrow: "The back office", title: "Settings", sub: "Sound, saving and your account." }
};

const SCREEN_TABS = {
  kitchen: [["orders", "Orders"], ["pantry", "Pantry"], ["recipes", "Recipe book"]],
  animals: [["collection", "Collection"], ["shop", "Animal shop"]],
  shop: [["furniture", "Furniture"], ["paint", "Paint & space"], ["pantry", "Pantry"], ["treats", "Treats"]],
  friends: [["friends", "Friends"], ["find", "Find cafés"]],
  discover: [["popular", "Popular"], ["new", "Newest"], ["rated", "Top rated"], ["competition", "Competition"], ["leaderboard", "Leaderboard"]],
  profile: [["you", "You"], ["reviews", "Reviews"], ["achievements", "Awards"]],
  quests: [["daily", "Daily quests"], ["awards", "Achievements"]],
  settings: []
};

export function openPanel(screen, tab) {
  if (screen === "build") { enterBuild(); return; }
  if (!SCREEN_META[screen]) return;
  if (runtime.visiting && (screen === "kitchen" || screen === "build")) {
    toast("You're visiting", "Kitchen and building are closed while you visit.", "home", true);
    return;
  }
  if (U.buildMode) exitBuild();
  const changed = U.screen !== screen;
  U.screen = screen;
  if (tab) U.tabs[screen] = tab;
  const meta = SCREEN_META[screen];
  $("panel-eyebrow").textContent = meta.eyebrow;
  $("panel-title").textContent = meta.title;
  $("panel-sub").textContent = meta.sub;
  $("panel").hidden = false;
  setNav(screen === "kitchen" ? "cook" : screen);
  renderTabs();
  renderPanel();
  if (changed) $("panel-body").scrollTop = 0;
  loadScreenData(screen);
}

export function closePanel() {
  U.screen = null;
  $("panel").hidden = true;
  setNav(U.buildMode ? "build" : "cafe");
}

function renderTabs() {
  const tabs = SCREEN_TABS[U.screen] || [];
  const host = $("panel-tabs");
  host.innerHTML = tabs.map(([id, label]) =>
    `<button type="button" class="tab ${U.tabs[U.screen] === id ? "on" : ""}" data-act="tab" data-tab="${esc(id)}" role="tab">${esc(label)}</button>`
  ).join("");
  host.hidden = !tabs.length;
}

export function renderPanel() {
  if (!U.screen) return;
  const body = $("panel-body");
  const scroll = body.scrollTop;
  let html = "";
  try {
    if (U.screen === "kitchen") html = renderKitchen(U.tabs.kitchen);
    else if (U.screen === "animals") html = renderAnimals(U.tabs.animals);
    else if (U.screen === "shop") html = renderShop(U.tabs.shop);
    else if (U.screen === "friends") html = renderFriends(U.tabs.friends);
    else if (U.screen === "discover") html = renderDiscover(U.tabs.discover);
    else if (U.screen === "profile") html = renderProfile(U.tabs.profile);
    else if (U.screen === "quests") html = renderQuests(U.tabs.quests);
    else if (U.screen === "settings") html = renderSettings();
  } catch (error) {
    console.warn("Pet Café: panel failed", error);
    html = `<div class="empty"><strong>That didn't load</strong><p>Try closing and opening the panel again.</p></div>`;
  }
  body.innerHTML = html;
  body.scrollTop = scroll;
  renderTabs();
  paint(body);
}

function loadScreenData(screen) {
  if (screen === "discover") {
    ensureFeeds();
    if (U.tabs.discover === "competition") loadCompetition();
    if (!U.cafesLoaded) loadCafesOnce();
  }
  if (screen === "friends") {
    if (!U.friends.loaded && !U.friends.loading) loadFriends();
  }
}

function setNav(name) {
  document.querySelectorAll(".rail-btn").forEach((btn) => {
    btn.classList.toggle("on", btn.dataset.nav === name || (name === "cafe" && btn.dataset.nav === "cafe"));
  });
}

/* ---------------------------- kitchen ---------------------------- */
function renderKitchen(tab) {
  const active = activeOrders();
  const ordersHtml = active.length ? active.map((order) => {
    const recipe = recipeById(order.recipeId);
    const customer = runtime.customers.find((c) => c.id === order.customerId);
    const pct = customer ? Math.round(clamp(customer.patience / Math.max(1, customer.maxPatience), 0, 1) * 100) : 0;
    return `<div class="recipe-row">
      ${pimg("food", recipe.id)}
      <div>
        <div class="r-name">${esc(recipe.name)}</div>
        <div class="r-meta">${esc(order.customerName)} · ${esc(stationLabel(recipe.station))}</div>
        <div class="quest" style="padding:0;background:none;border:0;margin:4px 0 0"><div class="q-bar"><i style="width:${pct}%"></i></div></div>
      </div>
      ${order.state === "ready"
        ? `<button class="btn small primary" data-act="serve" data-id="${esc(order.id)}">Serve</button>`
        : `<button class="btn small" data-act="cook" data-id="${esc(order.id)}">Cook</button>`}
    </div>`;
  }).join("") : `<div class="empty">${ico("pot")}<strong>No orders waiting</strong><p>Click a guest's speech bubble in the café to take their order.</p></div>`;

  const stations = ["stove", "oven", "espresso", "blender", "freezer"].map((kind) => {
    const count = stationCount(kind);
    return `<span class="station-pill ${count ? "" : "missing"}"><i class="led"></i>${esc(stationLabel(kind))}${count ? " ×" + count : " missing"}</span>`;
  }).join("");

  const pantry = PANTRY.map((item) => `
    <div class="pantry-chip ${(S.pantry[item.id] || 0) <= 2 ? "low" : ""}">
      <span class="jar" style="--jar:${esc(item.color)}"></span>
      <small>${esc(item.name)}</small>
      <b>${S.pantry[item.id] || 0}</b>
      <button type="button" data-act="pantry" data-id="${esc(item.id)}">+${item.packet} · ${item.price}</button>
    </div>`).join("");

  const recipes = RECIPES.slice().sort((a, b) => a.level - b.level || a.price - b.price).map((recipe) => {
    const locked = level() < recipe.level;
    return `<div class="recipe-row" style="${locked ? "opacity:.62" : ""}">
      ${pimg("food", recipe.id)}
      <div>
        <div class="r-name">${esc(recipe.name)}</div>
        <div class="r-meta">${esc(recipe.cat)} · ${recipe.price} coins · ${recipe.xp} XP</div>
        <div class="r-station">${esc(stationLabel(recipe.station))}</div>
      </div>
      ${locked ? `<span class="r-lock">${ico("lock")}Lv ${recipe.level}</span>` : `<span class="badge-soft">${ico("check")}Ready</span>`}
    </div>`;
  }).join("");

  if (tab === "pantry") {
    return `<section class="panel-section">
      <div class="section-head"><h3>Pantry</h3><span class="sub">${S.treats} treats · ${money(S.coins)} coins</span></div>
      <div class="pantry-strip">${pantry}</div>
      <p class="panel-note">Every dish uses fresh ingredients. Tap an ingredient to buy a packet, or pick up a bundle below.</p>
      <div class="grid two" style="margin-top:10px">
        ${PANTRY_PACKS.map((pack) => `<div class="card"><div class="card-body">
          <span class="card-title">${esc(pack.name)}</span>
          <span class="card-meta">${Object.keys(pack.contents).filter((k) => pack.contents[k] > 0 && PANTRY.some((p) => p.id === k)).map((k) => `${pack.contents[k]}× ${esc(PANTRY.find((p) => p.id === k).name)}`).join(" · ")}</span>
          <div class="card-foot"><span class="price">${ico("coin")}${pack.price}</span><button class="btn small primary" data-act="pack" data-id="${esc(pack.id)}">Buy</button></div>
        </div></div>`).join("")}
      </div>
    </section>`;
  }
  if (tab === "recipes") {
    return `<section class="panel-section">
      <div class="section-head"><h3>Recipe book</h3><span class="sub">${unlockedRecipes().length} of ${RECIPES.length} unlocked</span></div>
      ${recipes}
      <p class="panel-note"><strong>Unlocking:</strong> recipes arrive as your café levels up. Every new level also pays a small bonus into the till.</p>
    </section>`;
  }
  return `<section class="panel-section">
    <div class="section-head"><h3>Orders</h3><span class="sub">${active.length} of ${CONFIG.maxOrders}</span></div>
    ${ordersHtml}
    </section>
    <section class="panel-section">
      <div class="section-head"><h3>Stations</h3><span class="sub">${ambience()} ambience</span></div>
      <div class="station-row">${stations}</div>
      <p class="panel-note">A station must be in the café to cook its dishes. Buy more in the furniture shop and place them in Build mode.</p>
    </section>
    <section class="panel-section">
      <div class="section-head"><h3>Pantry</h3><span class="sub"><button class="link" data-act="tab" data-tab="pantry">Restock →</button></span></div>
      <div class="pantry-strip">${pantry}</div>
    </section>`;
}

/* ---------------------------- animals ---------------------------- */
function renderAnimals(tab) {
  const ownedIds = new Set(S.animals.map((a) => a.id));
  const rarityStyle = (animal) => {
    const rarity = RARITIES[animal.rarity];
    return `style="--rarity:${rarity.color};--rarity-soft:${rarity.soft}"`;
  };
  if (tab === "shop") {
    const list = ANIMALS.filter((a) => !ownedIds.has(a.id)).sort((a, b) => RARITIES[a.rarity].order - RARITIES[b.rarity].order || a.name.localeCompare(b.name));
    return `<section class="panel-section">
      <div class="section-head"><h3>Animal shop</h3><span class="sub">${S.animals.length} of ${ANIMALS.length} collected</span></div>
      ${list.length ? `<div class="grid two">${list.map((animal) => {
        const state = animalUnlockedForAdopt(animal);
        const unlock = animal.unlock;
        let label = "Adopt";
        if (unlock.type === "shop") label = state.ready ? `Adopt · ${unlock.price}` : level() < unlock.level ? `Level ${unlock.level}` : `${money(S.coins)} / ${unlock.price}`;
        if (unlock.type === "rescue") label = "Rescue";
        if (unlock.type === "quest") label = state.ready ? "Claim" : "Quest";
        if (unlock.type === "event") label = state.ready ? "Claim" : "Event";
        return `<div class="card animal-card tap" data-act="animal" data-id="${esc(animal.id)}" ${rarityStyle(animal)}>
          ${state.ready ? "" : `<span class="lock-flag">${ico("lock")}${esc(unlock.type === "shop" && level() < unlock.level ? "Lv " + unlock.level : "Locked")}</span>`}
          <span class="rarity-flag">${RARITIES[animal.rarity].label}</span>
          <div class="tile">${pimg("animal", animal.id)}</div>
          <div class="card-body">
            <span class="card-title">${esc(animal.name)}</span>
            <span class="card-meta">${esc(animal.family)} · ${esc(animalUnlockText(animal))}</span>
            <div class="card-foot">
              <span class="price">${unlock.type === "shop" ? ico("coin") + money(unlock.price) : unlock.type === "rescue" ? "At the door" : "Free"}</span>
              <button class="btn small ${state.ready ? "primary" : "ghost"}" data-act="adopt" data-id="${esc(animal.id)}" ${state.ready ? "" : "disabled"}>${esc(label)}</button>
            </div>
          </div>
        </div>`;
      }).join("")}</div>` : `<div class="empty">${ico("paw")}<strong>Every animal is home</strong><p>All ${ANIMALS.length} friends live in your café. Extraordinary.</p></div>`}
    </section>`;
  }
  const sorted = ANIMALS.slice().sort((a, b) => {
    const ao = ownedIds.has(a.id) ? 0 : 1, bo = ownedIds.has(b.id) ? 0 : 1;
    return ao - bo || RARITIES[a.rarity].order - RARITIES[b.rarity].order || a.name.localeCompare(b.name);
  });
  return `<section class="panel-section">
    <div class="section-head"><h3>Collection</h3><span class="sub">${S.animals.length} / ${ANIMALS.length} · ${Math.round(averageHappiness())}% happy</span></div>
    <div class="grid three">
      ${sorted.map((animal) => {
        const owned = S.animals.find((a) => a.id === animal.id);
        return `<div class="card animal-card tap ${owned ? "owned" : "locked"}" data-act="animal" data-id="${esc(animal.id)}" ${rarityStyle(animal)}>
          <span class="rarity-flag">${RARITIES[animal.rarity].label}</span>
          <div class="tile">${pimg("animal", animal.id)}</div>
          <div class="card-body">
            <span class="card-title">${esc(owned ? owned.name : animal.name)}</span>
            <span class="card-meta">${owned ? esc(animal.family) : "Not yet adopted"}</span>
            ${owned ? `<div class="happiness"><div class="bar"><i style="width:${owned.happiness}%"></i></div><small>${owned.happiness}%</small></div>` : `<span class="card-meta">${esc(animalUnlockText(animal))}</span>`}
          </div>
          ${owned && owned.active ? `<span class="active-flag">In café</span>` : ""}
        </div>`;
      }).join("")}
    </div>
    <p class="panel-note">Up to ${CONFIG.maxActiveAnimals} animals can wander the café at once. Tap one to pet them, or open their card to feed them and manage who is out.</p>
  </section>`;
}

/* ---------------------------- shop ---------------------------- */
function renderShop(tab) {
  if (tab === "paint") {
    return `<section class="panel-section">
      <div class="section-head"><h3>Floors</h3><span class="sub">Owned paint can be reapplied free</span></div>
      <div class="grid two">
        ${FLOORING.map((floor) => {
          const owned = S.paints.includes(floor.id);
          const on = S.layout.floor === floor.id;
          return `<div class="card">
            <div class="tile" style="background:radial-gradient(circle at 40% 30%, ${floor.tone}, ${floor.accent}); aspect-ratio:1.9/1"></div>
            <div class="card-body">
              <span class="card-title">${esc(floor.name)}</span>
              <span class="card-meta">${owned ? "In your paint box" : "Unlocks at level " + floor.level}</span>
              <div class="card-foot">
                <span class="price">${owned ? "Owned" : ico("coin") + floor.price}</span>
                <button class="btn small ${on ? "" : "primary"}" data-act="paint" data-id="${esc(floor.id)}" ${on ? "disabled" : ""}>${on ? "On the floor" : owned ? "Apply" : "Buy"}</button>
              </div>
            </div>
          </div>`;
        }).join("")}
      </div>
    </section>
    <section class="panel-section">
      <div class="section-head"><h3>Walls</h3><span class="sub">A fresh coat changes everything</span></div>
      <div class="grid two">
        ${WALLS.map((wall) => {
          const owned = S.paints.includes(wall.id);
          const on = S.layout.wall === wall.id;
          return `<div class="card">
            <div class="tile" style="background:${wall.tone}; aspect-ratio:1.9/1"><span style="display:block;width:70%;height:60%;border-radius:8px;background:${wall.pattern === "stripe" ? `repeating-linear-gradient(90deg, ${wall.tone} 0 10px, ${wall.accent} 10px 20px)` : wall.pattern === "dots" ? `radial-gradient(${wall.accent} 2px, transparent 3px) 0 0/14px 14px, ${wall.tone}` : wall.tone};border:2px solid rgba(255,255,255,.55)"></span></div>
            <div class="card-body">
              <span class="card-title">${esc(wall.name)}</span>
              <span class="card-meta">${owned ? "In your paint box" : "Unlocks at level " + wall.level}</span>
              <div class="card-foot">
                <span class="price">${owned ? "Owned" : ico("coin") + wall.price}</span>
                <button class="btn small ${on ? "" : "primary"}" data-act="paint" data-id="${esc(wall.id)}" ${on ? "disabled" : ""}>${on ? "On the walls" : owned ? "Apply" : "Buy"}</button>
              </div>
            </div>
          </div>`;
        }).join("")}
      </div>
    </section>
    <section class="panel-section">
      <div class="section-head"><h3>Space</h3><span class="sub">Patio depth ${patioDepth()} m</span></div>
      ${EXPANSIONS.map((expansion, index) => {
        const owned = S.layout.expansions > index;
        const locked = level() < expansion.level;
        return `<div class="recipe-row">
          <span class="medal" style="width:46px;height:46px;border-radius:12px;background:var(--sage-soft);display:grid;place-items:center;color:var(--sage-deep)">${ico(owned ? "check" : "globe")}</span>
          <div>
            <div class="r-name">${esc(expansion.name)}</div>
            <div class="r-meta">${esc(expansion.text)}</div>
            <div class="r-station">${owned ? "Open" : locked ? "Level " + expansion.level : "Available now"}</div>
          </div>
          ${owned ? `<span class="badge-soft">${ico("check")}Built</span>` : `<button class="btn small primary" data-act="expand" ${locked ? "disabled" : ""}>${ico("coin")}${expansion.price}</button>`}
        </div>`;
      }).join("")}
    </section>`;
  }
  if (tab === "pantry") {
    return `<section class="panel-section">
      <div class="section-head"><h3>Ingredients</h3><span class="sub">${money(S.coins)} coins</span></div>
      <div class="pantry-strip">${PANTRY.map((item) => `
        <div class="pantry-chip ${(S.pantry[item.id] || 0) <= 2 ? "low" : ""}">
          <span class="jar" style="--jar:${esc(item.color)}"></span>
          <small>${esc(item.name)}</small><b>${S.pantry[item.id] || 0}</b>
          <button type="button" data-act="pantry" data-id="${esc(item.id)}">+${item.packet} · ${item.price}</button>
        </div>`).join("")}</div>
      <div class="grid two" style="margin-top:12px">
        ${PANTRY_PACKS.map((pack) => `<div class="card"><div class="card-body">
          <span class="card-title">${esc(pack.name)}</span>
          <span class="card-meta">${Object.keys(pack.contents).filter((k) => pack.contents[k] > 0 && PANTRY.some((p) => p.id === k)).map((k) => `${pack.contents[k]}× ${esc(PANTRY.find((p) => p.id === k).name)}`).join(" · ")}</span>
          <div class="card-foot"><span class="price">${ico("coin")}${pack.price}</span><button class="btn small primary" data-act="pack" data-id="${esc(pack.id)}">Buy</button></div>
        </div></div>`).join("")}
      </div>
    </section>`;
  }
  if (tab === "treats") {
    return `<section class="panel-section">
      <div class="section-head"><h3>Animal treats</h3><span class="sub">${S.treats} in the tin</span></div>
      <div class="card"><div class="card-body">
        <span class="card-title">A bag of little biscuits</span>
        <span class="card-meta">Five treats. Each one makes a friend happier, and happy animals bring better reviews.</span>
        <div class="card-foot"><span class="price">${ico("coin")}60</span><button class="btn small primary" data-act="treats">Buy five</button></div>
      </div></div>
      <p class="panel-note">You can also feed animals from their card in the collection.</p>
    </section>`;
  }
  const cat = U.shopCat || "Tables";
  const list = FURNITURE.filter((f) => f.cat === cat).sort((a, b) => a.level - b.level || a.price - b.price);
  return `<section class="panel-section">
    <div class="tabs" style="padding:0 0 10px; flex-wrap:wrap">${FURNITURE_CATS.filter((c) => c !== "All").map((category) =>
      `<button type="button" class="tab ${category === cat ? "on" : ""}" data-act="shop-cat" data-cat="${esc(category)}">${esc(category)}</button>`).join("")}</div>
    <div class="grid three">
      ${list.map((def) => {
        const owned = S.inv[def.id] || 0;
        const locked = level() < def.level;
        return `<div class="card ${owned ? "owned" : ""} ${locked ? "locked" : ""}" ${owned ? 'data-owned="1"' : ""}>
          ${locked ? `<span class="lock-flag">${ico("lock")}Lv ${def.level}</span>` : ""}
          <div class="tile">${pimg("furniture", def.id)}</div>
          <div class="card-body">
            <span class="card-title">${esc(def.name)}</span>
            <span class="card-meta">${esc(def.cat)}${owned ? ` · ${owned} in storage` : ""}${def.station ? " · station" : ""}</span>
            <div class="card-foot">
              <span class="price">${ico("coin")}${money(def.price)}</span>
              <button class="btn small ${owned ? "sage" : "primary"}" data-act="buy-furn" data-id="${esc(def.id)}" ${locked ? "disabled" : ""}>${locked ? "Locked" : owned ? "Buy another" : "Buy"}</button>
            </div>
          </div>
        </div>`;
      }).join("")}
    </div>
    <p class="panel-note">Buying puts a piece in storage. Open <strong>Build</strong> to place it, then move or rotate it whenever you like.</p>
  </section>`;
}

/* ---------------------------- friends ---------------------------- */
function renderFriends(tab) {
  if (!cloud.getUser() || cloud.getUser().guest) {
    return `<div class="empty">${ico("friends")}<strong>Friends need an account</strong><p>Sign in to follow other cafés, see who is online and visit their rooms. Your guest café will come with you.</p><button class="btn primary" data-act="sign-in">Sign in or create an account</button></div>`;
  }
  const data = U.friends;
  const followingIds = new Set(data.following.map((f) => f.to));
  const followerIds = new Set(data.followers.map((f) => f.from));
  if (tab === "find") {
    const query = (U.search || "").trim().toLowerCase();
    const rows = U.cafes.filter((cafe) => !query || (cafe.name || "").toLowerCase().includes(query) || (cafe.nameLower || "").includes(query));
    return `<section class="panel-section">
      <div class="search-row"><div class="search-wrap">${ico("search")}<input id="friend-search" type="search" placeholder="Search by café name…" value="${esc(U.search)}" autocomplete="off"></div></div>
      ${rows.length ? rows.map((cafe) => cafeRow(cafe, { following: followingIds.has(cafe.uid), followsYou: followerIds.has(cafe.uid) })).join("") : `<div class="empty">${ico("search")}<strong>No cafés found</strong><p>${query ? "Try a different name." : "Open Discovery once you're signed in — public cafés appear there."}</p></div>`}
    </section>`;
  }
  if (data.loading && !data.loaded) {
    return `<div class="grid" style="gap:8px"><div class="skel"></div><div class="skel"></div><div class="skel"></div></div>`;
  }
  const ids = [...new Set([...followingIds, ...followerIds, ...data.cafes.map((c) => c.uid)])];
  const byUid = new Map(data.cafes.map((c) => [c.uid, c]));
  const friends = ids.filter((id) => followingIds.has(id) && followerIds.has(id));
  const rows = ids.map((uid) => {
    const cafe = byUid.get(uid) || { uid, name: "A café", level: 1, likes: 0 };
    const online = data.presence[uid] && Date.now() - (data.presence[uid].at || 0) < 120000;
    return cafeRow(cafe, { following: followingIds.has(uid), followsYou: followerIds.has(uid), online, friend: friends.includes(uid) });
  });
  return `<section class="panel-section">
    <div class="search-row"><div class="search-wrap">${ico("search")}<input id="friend-search" type="search" placeholder="Search by café name…" value="${esc(U.search)}" autocomplete="off"></div><button class="btn small" data-act="friends-refresh">${ico("rotate")}</button></div>
    ${rows.length ? rows.join("") : `<div class="empty">${ico("friends")}<strong>No friends yet</strong><p>Follow a café from Discover. When they follow back, you're friends.</p><button class="btn small primary" data-act="nav" data-nav="discover">Find cafés</button></div>`}
    <p class="panel-note">${friends.length} mutual friend${friends.length === 1 ? "" : "s"} · ${followingIds.size} following · ${followerIds.size} follower${followerIds.size === 1 ? "" : "s"}. A green dot means they have the café open right now.</p>
  </section>`;
}

function cafeRow(cafe, opts = {}) {
  const online = opts.online;
  return `<div class="cafe-row">
    <span class="cafe-thumb">${ico("home")}</span>
    <div>
      <span class="c-name">${esc(cafe.name || "A café")}${online ? '<i class="online"></i>' : ""}</span>
      <span class="c-meta">Lv ${cafe.level || 1} · ${ico("heart-filled")}${cafe.likes || 0} · ${cafe.rating ? cafe.rating.toFixed(1) + "★" : "unrated"}${opts.friend ? " · friends" : opts.followsYou ? " · follows you" : ""}</span>
    </div>
    <div class="c-actions">
      <button class="btn small ghost" data-act="${opts.following ? "unfollow" : "follow"}" data-id="${esc(cafe.uid)}" data-name="${esc(cafe.name || "")}">${opts.following ? "Following" : "Follow"}</button>
      <button class="btn small primary" data-act="visit" data-id="${esc(cafe.uid)}">${ico("visit")}</button>
    </div>
  </div>`;
}

/* ---------------------------- discover ---------------------------- */
function renderDiscover(tab) {
  if (!cloud.getUser() || cloud.getUser().guest) {
    return `<div class="empty">${ico("globe")}<strong>Real cafés live online</strong><p>Sign in to visit other players' cafés, leave hearts, rate them and enter the weekly competition.</p><button class="btn primary" data-act="sign-in">Sign in or create an account</button></div>`;
  }
  if (tab === "competition") return renderCompetition();
  if (tab === "leaderboard") {
    const rows = U.cafes.slice().sort((a, b) => (b.xp || 0) - (a.xp || 0)).slice(0, 20);
    return `<section class="panel-section">
      <div class="section-head"><h3>Top cafés</h3><span class="sub">by experience</span></div>
      ${rows.length ? rows.map((cafe, i) => `<div class="leader-row ${i < 3 ? "top" : ""}">
        <span class="rank">${i + 1}</span>
        <span><b>${esc(cafe.name)}</b> <span class="pts">Lv ${cafe.level || 1}</span></span>
        <span class="pts">${money(cafe.xp || 0)} XP</span>
      </div>`).join("") : `<div class="empty"><strong>No cafés on the board yet</strong><p>Be the first — open your café and start serving.</p></div>`}
    </section>`;
  }
  let list = U.cafes.slice();
  if (tab === "new") list.sort((a, b) => (b.updated || 0) - (a.updated || 0));
  else if (tab === "rated") list.sort((a, b) => (b.rating || 0) - (a.rating || 0) || (b.likes || 0) - (a.likes || 0));
  else list.sort((a, b) => (b.likes || 0) - (a.likes || 0) || (b.updated || 0) - (a.updated || 0));
  if (!U.cafesLoaded) {
    return `<div class="grid" style="gap:8px"><div class="skel"></div><div class="skel"></div><div class="skel"></div></div>`;
  }
  return `<section class="panel-section">
    <div class="section-head"><h3>${tab === "new" ? "Just opened" : tab === "rated" ? "Best rated" : "Most loved"}</h3><span class="sub">${list.length} cafés</span></div>
    ${list.length ? list.map((cafe) => cafeRow(cafe, {})).join("") : `<div class="empty">${ico("globe")}<strong>No public cafés yet</strong><p>Your café is published as soon as you're signed in. Invite a friend to do the same.</p></div>`}
    <p class="panel-note">Visits load the other player's real saved layout and animals. Hearts and ratings are stored in the cloud, one per visitor.</p>
  </section>`;
}

function renderCompetition() {
  const week = cloud.weekKey();
  const entries = U.comp.entries.slice();
  const votes = U.comp.votes;
  const counts = new Map();
  votes.forEach((vote) => counts.set(vote.to, (counts.get(vote.to) || 0) + 1));
  entries.forEach((entry) => { entry.votes = counts.get(entry.uid) || 0; });
  entries.sort((a, b) => b.votes - a.votes || (b.level || 0) - (a.level || 0));
  const entered = S.comp.enteredWeek === week;
  const voted = U.comp.voted;
  if (entries.length) {
    const rank = entries.findIndex((entry) => cloud.getUser() && entry.uid === cloud.getUser().uid) + 1;
    if (rank > 0) game.recordCompetitionResult(rank);
  }
  return `<section class="panel-section">
    <div class="week-banner">
      <p class="eyebrow">This week · ${esc(week)}</p>
      <h3>The prettiest little café</h3>
      <p class="sub">Decorate your café, then enter a snapshot. Everyone signed in gets one vote a week.</p>
      <button class="btn small primary" data-act="enter-comp" ${entered ? "disabled" : ""}>${entered ? "You're entered" : "Enter this week"}</button>
    </div>
    ${U.comp.loading ? `<div class="grid" style="gap:8px"><div class="skel"></div><div class="skel"></div></div>` : entries.length ? entries.map((entry, i) => `
      <div class="comp-entry">
        <div>
          <div class="ce-name">${i === 0 ? "🏆 " : ""}${esc(entry.name)} <span class="ce-rank">#${i + 1}</span></div>
          <div class="ce-meta">Level ${entry.level || 1} · ${(entry.layout && entry.layout.items || []).length} pieces placed</div>
          <div class="ce-animals">${(entry.animals || []).slice(0, 5).map((a) => `<span title="${esc(a.name)}">${pimg("animal", a.id)}</span>`).join("")}</div>
        </div>
        <div>
          <div class="ce-votes">${entry.votes} vote${entry.votes === 1 ? "" : "s"}</div>
          <button class="btn small ${voted ? "ghost" : "primary"}" data-act="vote" data-id="${esc(entry.uid)}" ${voted || (cloud.getUser() && entry.uid === cloud.getUser().uid) ? "disabled" : ""}>${voted ? "Voted" : "Vote"}</button>
        </div>
      </div>`).join("") : `<div class="empty">${ico("trophy")}<strong>No entries yet</strong><p>Be the first café on the podium this week.</p></div>`}
    <p class="panel-note">The top three cafés unlock <strong>Nimbus</strong>, the mythical cloud cat. Votes reset every Monday.</p>
  </section>`;
}

/* ---------------------------- profile ---------------------------- */
function renderProfile(tab) {
  const info = levelInfo(S.xp);
  const mainAnimal = S.animals[0] || { id: "mochi", name: "Mochi" };
  const likes = S.likes;
  const head = `<div class="profile-head">
    <div class="avatar">${pimg("animal", mainAnimal.id)}</div>
    <div>
      <h3>${esc(S.name)}</h3>
      <p class="sub">Level ${info.level} · ${money(S.xp)} XP · ${S.animals.length} animals</p>
      <div class="pill-row">
        <span class="pill">${ico("coin")}${money(S.coins)}</span>
        <span class="pill">${ico("heart")}${likes}</span>
        <span class="pill ${S.rep >= 80 ? "good" : S.rep < 45 ? "warn" : ""}">${ico("star")}${S.rating ? S.rating.toFixed(1) + "★" : Math.round(S.rep) + " rep"}</span>
        ${cloud.getUser() && !cloud.getUser().guest ? `<span class="pill good">${ico("check")}Cloud save</span>` : `<span class="pill warn">${ico("user")}Guest</span>`}
      </div>
    </div>
  </div>`;
  if (tab === "reviews") {
    return `<section class="panel-section">${head}
      <div class="section-head"><h3>Recent reviews</h3><span class="sub">${S.reviews.length} of the last 12</span></div>
      ${S.reviews.length ? S.reviews.slice().reverse().map((review) => `<div class="review">
        <div class="r-top"><b>${esc(review.name)}</b><small>${esc(review.recipe || "")}</small><span class="stars">${stars(review.stars)}</span></div>
        <p>${esc(review.text)}</p>
      </div>`).join("") : `<div class="empty">${ico("star")}<strong>No reviews yet</strong><p>Serve a few guests and they'll write something.</p></div>`}
    </section>`;
  }
  if (tab === "achievements") {
    return `<section class="panel-section">${head}
      <div class="section-head"><h3>Achievements</h3><span class="sub">${Object.keys(S.achievements).length} / ${ACHIEVEMENTS.length}</span></div>
      ${ACHIEVEMENTS.map((a) => {
        const got = !!S.achievements[a.id];
        const progress = game.achievementMetric(a.metric);
        return `<div class="achievement ${got ? "got" : ""}">
          <span class="medal">${ico(got ? "trophy" : "star")}</span>
          <div><b>${esc(a.name)}</b><small>${esc(a.text)}</small></div>
          <span class="progress">${got ? "Earned" : Math.min(progress, a.goal) + " / " + a.goal}</span>
        </div>`;
      }).join("")}
    </section>`;
  }
  const recent = S.reviews.slice(-3).reverse();
  const quests = S.quests.list.slice(0, 3);
  return `<section class="panel-section">${head}
    <div class="stat-grid">
      <div class="stat-box"><span>Customers</span><b>${money(S.stats.served)}</b></div>
      <div class="stat-box"><span>Perfect cooks</span><b>${money(S.stats.perfect)}</b></div>
      <div class="stat-box"><span>From service</span><b>${money(S.stats.earned)}</b></div>
      <div class="stat-box"><span>Animals</span><b>${S.animals.length}</b></div>
      <div class="stat-box"><span>Visits</span><b>${money(S.stats.visits)}</b></div>
      <div class="stat-box"><span>Hearts</span><b>${money(S.likes)}</b></div>
    </div>
    <div class="divider"></div>
    <div class="section-head"><h3>Today's quests</h3><button class="link" data-act="panel" data-screen="quests">See all →</button></div>
    ${quests.map((quest) => `<div class="quest ${quest.progress >= quest.goal ? "done" : ""}">
      <div class="q-top"><b>${esc(quest.text)}</b><small>${Math.min(quest.progress, quest.goal)} / ${quest.goal}</small></div>
      <div class="q-bar"><i style="width:${Math.min(100, quest.progress / quest.goal * 100)}%"></i></div>
      ${quest.progress >= quest.goal && !quest.claimed ? `<button class="btn small primary" data-act="quest-claim" data-id="${esc(quest.id)}">Claim ${ico("coin")}${quest.coins}</button>` : quest.claimed ? `<small class="muted">Claimed</small>` : ""}
    </div>`).join("")}
    <div class="divider"></div>
    <div class="section-head"><h3>Latest reviews</h3><button class="link" data-act="tab" data-tab="reviews">All reviews →</button></div>
    ${recent.length ? recent.map((review) => `<div class="review"><div class="r-top"><b>${esc(review.name)}</b><small>${esc(review.recipe || "")}</small><span class="stars">${stars(review.stars)}</span></div><p>${esc(review.text)}</p></div>`).join("") : `<p class="mini-note">No reviews yet. The first guest is always the most honest.</p>`}
    <div class="divider"></div>
    <div class="row-between">
      <div><b style="font-size:12.5px">Your café name</b><div class="mini-note">Share it so friends can find you.</div></div>
      <button class="btn small" data-act="copy-name">${ico("pencil")}${esc(S.name)}</button>
    </div>
  </section>`;
}

/* ---------------------------- quests ---------------------------- */
function renderQuests(tab) {
  if (tab === "awards") {
    return `<section class="panel-section">
      <div class="section-head"><h3>All achievements</h3><span class="sub">${Object.keys(S.achievements).length} of ${ACHIEVEMENTS.length}</span></div>
      ${ACHIEVEMENTS.map((a) => {
        const got = !!S.achievements[a.id];
        return `<div class="achievement ${got ? "got" : ""}">
          <span class="medal">${ico(got ? "trophy" : "star")}</span>
          <div><b>${esc(a.name)}</b><small>${esc(a.text)}</small></div>
          <span class="progress">${got ? "Earned" : Math.min(game.achievementMetric(a.metric), a.goal) + " / " + a.goal}</span>
        </div>`;
      }).join("")}
    </section>`;
  }
  return `<section class="panel-section">
    <div class="section-head"><h3>Daily quests</h3><span class="sub">Reset at midnight</span></div>
    ${S.quests.list.map((quest) => {
      const done = quest.progress >= quest.goal;
      return `<div class="quest ${done ? "done" : ""}">
        <div class="q-top"><b>${esc(quest.text)}</b><small>${Math.min(quest.progress, quest.goal)} / ${quest.goal}</small></div>
        <div class="q-bar"><i style="width:${Math.min(100, quest.progress / quest.goal * 100)}%"></i></div>
        <div class="row-between"><small class="muted">${ico("coin")}${quest.coins} · ${quest.xp} XP</small>
        ${quest.claimed ? `<span class="badge-soft">${ico("check")}Claimed</span>` : done ? `<button class="btn small primary" data-act="quest-claim" data-id="${esc(quest.id)}">Claim</button>` : `<span class="badge-soft">In progress</span>`}</div>
      </div>`;
    }).join("")}
    <div class="divider"></div>
    <div class="section-head"><h3>Daily streak</h3><span class="sub">${S.daily.streak} day${S.daily.streak === 1 ? "" : "s"}</span></div>
    <div class="daily-days">${DAILY_REWARDS.map((coins, i) => {
      const day = i + 1;
      const done = S.daily.streak % 7 >= day && S.daily.streak > 0 && !dailyAvailable();
      return `<div class="daily-day ${done ? "done" : ""}"><span>Day ${day}</span><b>${coins}</b></div>`;
    }).join("")}</div>
    <button class="btn wide ${dailyAvailable() ? "primary" : "ghost"}" data-act="daily-open">${dailyAvailable() ? "Open today's reward" : "Come back tomorrow"}</button>
  </section>`;
}

/* ---------------------------- settings ---------------------------- */
function renderSettings() {
  const user = cloud.getUser();
  const signed = user && !user.guest;
  const saveState = signed ? "Saved to your account" : "Saved on this device";
  return `<section class="panel-section">
    <div class="settings-row"><div class="s-label"><b>Sound</b><small>Little chimes, bells and purrs</small></div><button type="button" class="switch ${S.settings.sound ? "on" : ""}" data-act="toggle-sound" aria-label="Sound"></button></div>
    <div class="settings-row"><div class="s-label"><b>High quality</b><small>Sharper shadows and a higher render scale</small></div><button type="button" class="switch ${S.settings.quality ? "on" : ""}" data-act="toggle-quality" aria-label="Quality"></button></div>
    <div class="settings-row"><div class="s-label"><b>Grid snapping</b><small>Furniture lines up neatly</small></div><button type="button" class="switch ${S.settings.snap ? "on" : ""}" data-act="toggle-snap" aria-label="Snapping"></button></div>
    <div class="settings-row"><div class="s-label"><b>Account</b><small>${signed ? "Signed in as " + esc(S.name) : "Playing as a guest"}</small></div>
      ${signed ? `<button class="btn small ghost" data-act="sign-out">Sign out</button>` : `<button class="btn small primary" data-act="sign-in">Sign in</button>`}
    </div>
    <div class="settings-row"><div class="s-label"><b>Saving</b><small>${esc(saveState)}${signed ? " · includes visits, hearts and competitions" : " · sign in to sync"}</small></div><button class="btn small ghost" data-act="save-now">Save now</button></div>
    <div class="settings-row"><div class="s-label"><b>Your name</b><small>Shown above your café</small></div></div>
    <div class="input-row"><input id="name-input" type="text" maxlength="20" value="${esc(S.name)}" placeholder="Café name"><button class="btn small" data-act="rename">Rename</button></div>
    <div class="divider"></div>
    <div class="settings-row"><div class="s-label"><b>Start over</b><small>Clears this café and its progress. This cannot be undone.</small></div><button class="btn small danger" data-act="reset">Reset</button></div>
    <div class="settings-row"><div class="s-label"><b>All the games</b><small>Back to the Damp catalogue</small></div><a class="btn small ghost" href="../../index.html">Catalogue</a></div>
    <p class="panel-note">Pet Café · a cosy game for Damp. Built with Three.js and Firebase. Clouds, coffee and thirty-six animals, all made from scratch.</p>
  </section>`;
}

/* ---------------------------- animal detail ---------------------------- */
export function openAnimalDetail(id) {
  const def = animalById(id);
  if (!def) return;
  U.detailKind = "animal";
  U.detailId = id;
  const owned = S.animals.find((a) => a.id === id);
  const state = animalUnlockedForAdopt(def);
  const rarity = RARITIES[def.rarity];
  const body = $("detail-body");
  body.innerHTML = `<div class="detail-hero">
      <div class="portrait">${pimg("animal", id)}</div>
      <div>
        <p class="eyebrow" style="color:${rarity.color}">${esc(rarity.label)} · ${esc(def.family)}</p>
        <h2>${esc(owned ? owned.name : def.name)}</h2>
        <p class="sub">${owned ? `Living here since ${new Date(owned.at || Date.now()).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}` : esc(animalUnlockText(def))}</p>
        <div class="pill-row" style="margin-top:6px">
          <span class="pill" style="background:${rarity.soft};color:${rarity.color}">${esc(rarity.label)}</span>
          ${owned ? `<span class="pill ${owned.active ? "good" : ""}">${owned.active ? "Wandering the café" : "Resting inside"}</span>` : ""}
        </div>
      </div>
    </div>
    <p class="detail-blurb">${esc(def.blurb)}</p>
    ${owned ? `<div class="happy-big"><div class="row-between"><small class="muted">Happiness</small><b style="font-size:12px">${owned.happiness}%</b></div><div class="bar"><i style="width:${owned.happiness}%"></i></div></div>
      <div class="detail-stats">
        <div class="detail-stat"><span>Treats</span><b>${S.treats} in the tin</b></div>
        <div class="detail-stat"><span>Friends</span><b>${S.animals.length} of ${ANIMALS.length}</b></div>
      </div>
      <div class="detail-actions">
        <button class="btn primary" data-act="pet" data-id="${esc(id)}">${ico("paw")}Pet</button>
        <button class="btn sage" data-act="feed" data-id="${esc(id)}">${ico("basket")}Feed a treat</button>
        <button class="btn ghost" data-act="toggle-active" data-id="${esc(id)}">${owned.active ? "Keep inside" : "Bring out"}</button>
      </div>`
    : `<div class="unlock-box">${ico("lock")}<span>${esc(animalUnlockText(def))}${state.progress !== undefined ? ` · ${state.progress} / ${state.target}` : ""}</span></div>
      <div class="detail-actions">
        <button class="btn primary" data-act="adopt" data-id="${esc(id)}" ${state.ready ? "" : "disabled"}>${def.unlock.type === "shop" ? `Adopt · ${ico("coin")}${def.unlock.price}` : state.ready ? "Adopt" : "Not available yet"}</button>
        <button class="btn ghost" data-act="animal-shop">Animal shop</button>
      </div>`}
    <p class="mini-note">${esc(def.name)}'s happiness rises when you pet or feed them, and falls slowly while the café is open. Happy animals make guests happier too.</p>`;
  $("detail-modal").hidden = false;
  paint(body);
}

/* ---------------------------- cook dialog ---------------------------- */
function openCook(orderId) {
  const order = runtime.orders.find((o) => o.id === orderId);
  if (!order || order.state !== "waiting") {
    if (order && order.state === "ready") { toast("Already made", "Serve it to the guest.", "bell"); return; }
    toast("That order is gone", "The guest may have left.", "clock", true);
    return;
  }
  const recipe = recipeById(order.recipeId);
  U.cookOrder = order;
  U.cookRunning = false;
  game.cancelCooking();
  $("cook-name").textContent = recipe.name;
  $("cook-station").textContent = stationLabel(recipe.station);
  $("cook-for").textContent = `For ${order.customerName} · ${recipe.price} coins base`;
  $("cook-art").innerHTML = pimg("food", recipe.id);
  $("cook-result").hidden = true;
  $("cook-result").className = "cook-result";
  $("cook-start").hidden = false;
  $("cook-start").disabled = false;
  $("cook-stop").hidden = true;
  $("cook-cancel").textContent = "Put it back";
  $("cook-hint").textContent = "Start the oven, then stop the meter in the golden zone.";
  $("cook-needle").style.left = "18%";
  $("cook-needle").classList.remove("perfect");
  $("cook-ing").innerHTML = Object.keys(recipe.ing).map((key) => {
    const item = PANTRY.find((p) => p.id === key);
    const have = S.pantry[key] || 0;
    const need = recipe.ing[key];
    return `<span class="ing-chip ${have < need ? "short" : ""}"><i class="jar-mini" style="--jar:${item ? item.color : "#d9bd86"}"></i>${esc(item ? item.name : key)} ${have}/${need}</span>`;
  }).join("") + `<span class="ing-chip">${ico("clock")}${recipe.time}s</span>`;
  $("cook-modal").hidden = false;
  paint($("cook-modal"));
}

function startCook() {
  if (!U.cookOrder) return;
  const result = game.beginCooking(U.cookOrder.id);
  if (!result.ok) {
    toast("Can't start yet", result.reason, "pot", true);
    if (result.restock) {
      closeCook();
      openPanel("kitchen", "pantry");
    }
    return;
  }
  U.cookRunning = true;
  $("cook-start").hidden = true;
  $("cook-stop").hidden = false;
  $("cook-cancel").textContent = "Leave it";
  $("cook-hint").textContent = "Stop it right in the golden zone for a perfect dish.";
  playSound("click");
}

function stopCook() {
  if (!U.cookRunning) return;
  const result = game.stopCooking();
  U.cookRunning = false;
  if (!result) return;
  $("cook-stop").hidden = true;
  $("cook-start").hidden = true;
  $("cook-cancel").textContent = "Take it out";
  const box = $("cook-result");
  box.hidden = false;
  box.className = "cook-result " + (result.quality === 1.35 ? "perfect" : result.quality < 1 ? "rushed" : "");
  box.innerHTML = `<b>${esc(result.label)}</b><small>${result.quality === 1.35 ? "The smell alone will bring in a tip." : result.quality === 1.14 ? "Lovely. The guest will notice." : "A little hurried, but it will do."}</small>`;
  $("cook-hint").textContent = "Ready on the pass — click the guest's bubble, or Serve from the order rail.";
  renderOrders();
  renderHud();
  paint(box);
}

function closeCook() {
  if (U.cookRunning) {
    game.cancelCooking();
    U.cookRunning = false;
  }
  $("cook-modal").hidden = true;
  U.cookOrder = null;
}

/* ---------------------------- daily dialog ---------------------------- */
function openDaily() {
  const today = new Date().toISOString().slice(0, 10);
  const available = S.daily.last !== today;
  const next = available ? (S.daily.last === new Date(Date.now() - 86400000).toISOString().slice(0, 10) ? S.daily.streak % 7 : S.daily.streak % 7) : (S.daily.streak - 1) % 7;
  $("daily-sub").textContent = available
    ? (S.daily.streak > 0 ? `Day ${S.daily.streak + 1} of your streak.` : "A fresh start — day one.")
    : `You've claimed today. ${7 - (S.daily.streak % 7)} days until the big one.`;
  $("daily-days").innerHTML = DAILY_REWARDS.map((coins, i) => {
    const claimed = !available && i <= (S.daily.streak - 1) % 7;
    const isToday = available && i === (S.daily.streak % 7);
    return `<div class="daily-day ${claimed ? "done" : ""} ${isToday ? "today" : ""}">
      <span>Day ${i + 1}</span><b>${coins}</b>
    </div>`;
  }).join("");
  $("daily-claim").disabled = !available;
  $("daily-claim").textContent = available ? `Claim ${DAILY_REWARDS[S.daily.streak % 7]} coins` : "Claimed today";
  $("daily-modal").hidden = false;
}

/* ---------------------------- visit helpers ---------------------------- */
function findCafe(uid) {
  return U.cafes.find((c) => c.uid === uid) ||
    U.friends.cafes.find((c) => c.uid === uid) ||
    U.comp.entries.find((c) => c.uid === uid) ||
    null;
}

async function visitCafe(uid) {
  let cafe = findCafe(uid);
  if (!cafe) cafe = await cloud.fetchCafe(uid);
  if (!cafe || !cafe.layout) {
    toast("Could not load that café", "It may have been deleted, or the connection dropped.", "home", true);
    return;
  }
  if (!game.startVisit(cafe)) {
    toast("Could not open that café", "The layout was empty or unreadable.", "home", true);
    return;
  }
  closePanel();
  setNav("cafe");
  U.visits = { liked: false, rating: 0 };
  renderVisitBar();
  renderOrders();
  renderHud();
  if (cloud.getUser() && !cloud.getUser().guest) {
    cloud.hasLiked(uid).then((liked) => { U.visits.liked = liked; renderVisitBar(); }).catch(() => {});
    cloud.myRating(uid).then((rating) => { U.visits.rating = rating; renderVisitBar(); }).catch(() => {});
  }
  game.renderHudSoon = true;
}

function leaveVisit() {
  game.exitVisit();
  U.visits = { liked: false, rating: 0 };
  renderVisitBar();
  renderOrders();
  renderHud();
}

/* ---------------------------- data loaders ---------------------------- */
function ensureFeeds() {
  if (U.feedStarted || !cloud.getUser() || cloud.getUser().guest) return;
  U.feedStarted = true;
  try {
    cloud.subscribeCafes((rows) => {
      U.cafes = rows;
      U.cafesLoaded = true;
      if (U.screen === "discover") renderPanel();
    }, () => { U.cafesLoaded = true; });
  } catch (error) { /* online only */ }
}

async function loadCafesOnce() {
  if (U.cafesLoaded) return;
  const rows = await cloud.fetchCafes();
  U.cafes = rows.filter((row) => !cloud.getUser() || row.uid !== cloud.getUser().uid);
  U.cafesLoaded = true;
  if (U.screen === "discover") renderPanel();
}

async function loadCompetition() {
  if (!cloud.getUser() || cloud.getUser().guest) return;
  U.comp.loading = true;
  if (U.screen === "discover") renderPanel();
  try {
    const week = cloud.weekKey();
    const [entries, votes, voted] = await Promise.all([cloud.listEntries(week), cloud.listVotes(week), cloud.hasVoted(week)]);
    U.comp.entries = entries;
    U.comp.votes = votes;
    U.comp.voted = voted;
  } catch (error) { /* keep the panel usable */ }
  U.comp.loading = false;
  if (U.screen === "discover" && U.tabs.discover === "competition") renderPanel();
}

async function loadFriends(force) {
  if (!cloud.getUser() || cloud.getUser().guest) return;
  if (U.friends.loading) return;
  if (U.friends.loaded && !force) return;
  U.friends.loading = true;
  if (U.screen === "friends") renderPanel();
  try {
    const [following, followers] = await Promise.all([cloud.following(), cloud.followers()]);
    const ids = [...new Set([...following.map((f) => f.to), ...followers.map((f) => f.from)])];
    const [cafes, presence] = await Promise.all([cloud.friendCafes(ids), cloud.presenceOf(ids)]);
    U.friends = { following, followers, cafes, presence, loading: false, loaded: true };
    if (!U.feedStarted) ensureFeeds();
  } catch (error) {
    U.friends.loading = false;
    U.friends.loaded = true;
    toast("Could not load friends", "Check your connection and try again.", "friends", true);
  }
  if (U.screen === "friends") renderPanel();
  renderHud();
}

/* ---------------------------------------------------------------------
   Actions
   --------------------------------------------------------------------- */
async function action(name, data, el) {
  switch (name) {
    case "nav": {
      const nav = data.nav;
      if (nav === "cafe") {
        closePanel();
        if (U.buildMode) exitBuild();
        setNav("cafe");
        world.resetCamera();
      } else if (nav === "build") enterBuild();
      else if (nav === "cook") openPanel("kitchen");
      else openPanel(nav);
      playSound("click");
      break;
    }
    case "tab": {
      if (!U.screen) return;
      U.tabs[U.screen] = data.tab;
      renderPanel();
      loadScreenData(U.screen);
      playSound("click");
      break;
    }
    case "panel":
      openPanel(data.screen);
      break;
    case "panel-close":
      closePanel();
      break;
    case "shop-open":
      openPanel("shop");
      break;
    case "sign-in":
      showGate(true);
      break;
    case "sign-out":
      askConfirm("Sign out?", "Your café stays saved in the cloud. You can sign back in any time.", "Sign out", async () => {
        await cloud.signOut();
        S.name = S.settings.name || "Guest";
        game.saveLocal();
        showGate(true);
        toast("Signed out", "Your café is safe in the cloud.", "check");
      });
      break;
    case "save-now":
      game.saveLocal();
      game.syncPublic();
      toast("Saved", "This café is safe.", "check");
      setSavePill(cloud.getUser() && !cloud.getUser().guest ? "cloud" : "local");
      break;
    case "toggle-sound":
      S.settings.sound = !S.settings.sound;
      if (S.settings.sound) playSound("click");
      game.markDirty();
      renderHud();
      renderPanel();
      break;
    case "toggle-quality":
      S.settings.quality = !S.settings.quality;
      game.markDirty();
      if (world.world.renderer) {
        world.world.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, S.settings.quality ? 1.75 : 1));
        world.world.renderer.shadowMap.enabled = !!S.settings.quality;
        world.resizeWorld();
        world.rebuildMaterials && world.rebuildMaterials();
      }
      renderPanel();
      break;
    case "toggle-snap":
      S.settings.snap = !S.settings.snap;
      game.markDirty();
      renderBuildBar();
      renderPanel();
      break;
    case "rename": {
      const input = $("name-input");
      const clean = (input && input.value || "").trim();
      if (clean.length < 2) { toast("A little longer", "Use at least two characters.", "pencil", true); return; }
      if (!game.setPlayerName(clean)) { toast("That name won't work", "Try letters, numbers and spaces.", "pencil", true); return; }
      game.syncPublic();
      renderHud();
      renderPanel();
      toast("Renamed", "The sign outside has been repainted.", "pencil");
      break;
    }
    case "reset":
      askConfirm("Start over?", "This clears your café, coins, recipes and animals on this device and, if signed in, in the cloud. There is no undo.", "Start over", async () => {
        try { localStorage.removeItem(CONFIG.storageKey); } catch (error) { /* ignore */ }
        if (cloud.getUser() && !cloud.getUser().guest) {
          try { await cloud.saveGame({ coins: 0, reset: Date.now(), layout: null }, game.publicDoc()); } catch (error) { /* ignore */ }
        }
        location.reload();
      });
      break;
    case "daily-open":
      $("daily-modal").hidden = false;
      openDaily();
      break;
    case "daily-claim": {
      const reward = game.claimDaily();
      if (!reward) { toast("Already claimed", "Come back tomorrow for another.", "gift"); $("daily-claim").disabled = true; return; }
      $("daily-claim").disabled = true;
      $("daily-claim").textContent = "Claimed";
      $("daily-sub").textContent = `Day ${reward.streak} claimed. See you tomorrow.`;
      renderHud();
      renderPanel();
      playSound("coin");
      break;
    }
    case "daily-close":
      $("daily-modal").hidden = true;
      break;
    case "quest-claim":
      if (game.claimQuest(data.id)) { renderHud(); renderPanel(); }
      break;
    case "adopt": {
      if (game.adoptAnimal(data.id)) {
        toast("A new friend", `${esc(animalById(data.id).name)} joined the café.`, "paw");
        $("detail-modal").hidden = true;
        renderHud();
        renderPanel();
      }
      break;
    }
    case "animal":
      openAnimalDetail(data.id);
      break;
    case "animal-shop":
      $("detail-modal").hidden = true;
      openPanel("animals", "shop");
      break;
    case "feed":
      if (game.feedAnimal(data.id)) {
        toast("A little treat", "Happiness up.", "basket");
        if (U.screen === "animals") renderPanel();
        openAnimalDetail(data.id);
        renderHud();
      }
      break;
    case "pet":
      if (game.petAnimal(data.id, { x: innerWidth / 2, y: innerHeight / 2, visible: true })) {
        if (U.screen === "animals") renderPanel();
        openAnimalDetail(data.id);
      }
      break;
    case "toggle-active":
      if (game.toggleAnimalActive(data.id)) {
        openAnimalDetail(data.id);
        if (U.screen === "animals") renderPanel();
        renderHud();
      }
      break;
    case "buy-furn": {
      const result = game.buyFurniture(data.id);
      if (result.ok) {
        toast("In storage", `${esc(furnitureById(data.id).name)} — place it in Build mode.`, "box");
        renderHud();
        renderPanel();
      } else {
        toast("Not just now", result.reason || "That isn't available.", "shop", true);
      }
      break;
    }
    case "paint":
      if (game.buyPaint(data.id)) {
        renderHud();
        renderPanel();
      }
      break;
    case "expand":
      if (game.buyExpansion()) {
        renderHud();
        renderPanel();
      }
      break;
    case "pantry":
      if (game.buyPantry(data.id)) { renderHud(); renderPanel(); }
      break;
    case "pack":
      if (game.buyPantry(data.id)) { renderHud(); renderPanel(); }
      break;
    case "treats":
      if (game.buyTreats()) { renderHud(); renderPanel(); }
      break;
    case "cook":
      openCook(data.id);
      break;
    case "serve": {
      const order = runtime.orders.find((o) => o.id === data.id);
      if (!order) return;
      const customer = runtime.customers.find((c) => c.id === order.customerId);
      if (!customer) { toast("That guest has gone", "The order was abandoned.", "clock", true); return; }
      game.serveCustomer(customer);
      renderOrders();
      renderHud();
      break;
    }
    case "cook-start":
      startCook();
      break;
    case "cook-stop":
      stopCook();
      break;
    case "cook-cancel":
    case "cook-close":
      closeCook();
      break;
    case "detail-close":
      $("detail-modal").hidden = true;
      break;
    case "shop-cat":
      U.shopCat = data.cat;
      renderPanel();
      break;
    case "build-cat":
      U.buildCat = data.cat;
      renderBuildBar();
      break;
    case "build-pick":
      buildPick(data.id);
      break;
    case "build-rotate":
      rotateGhost();
      break;
    case "build-remove":
      removeSelected();
      break;
    case "build-snap":
      S.settings.snap = !S.settings.snap;
      game.markDirty();
      renderBuildBar();
      break;
    case "build-expand":
      if (game.buyExpansion()) { renderBuildBar(); renderHud(); }
      break;
    case "build-done":
      exitBuild();
      break;
    case "visit": {
      closePanel();
      visitCafe(data.id);
      break;
    }
    case "visit-back":
      leaveVisit();
      break;
    case "visit-like": {
      if (!runtime.visiting) return;
      const liked = await game.leaveLike(runtime.visiting.uid);
      if (liked !== null) {
        U.visits.liked = liked;
        renderVisitBar();
        playSound(liked ? "chime" : "click");
      }
      break;
    }
    case "rate": {
      if (!runtime.visiting) return;
      const count = Number(data.stars || el.dataset.stars || 0);
      if (!count) return;
      const ok = await game.rateCafe(runtime.visiting.uid, count);
      if (ok) {
        U.visits.rating = count;
        renderVisitBar();
      }
      break;
    }
    case "follow":
      try {
        await cloud.follow(data.id);
        toast("Following", `You'll find ${esc(data.name || "them")} in your friends list.`, "friends");
        await loadFriends(true);
      } catch (error) {
        toast("Could not follow", cloud.friendlyAuthError(error), "friends", true);
      }
      break;
    case "unfollow":
      try {
        await cloud.unfollow(data.id);
        toast("Unfollowed", "No hard feelings.", "friends");
        await loadFriends(true);
      } catch (error) {
        toast("Could not unfollow", "Check your connection.", "friends", true);
      }
      break;
    case "friends-refresh":
      await loadFriends(true);
      break;
    case "enter-comp":
      if (await game.enterCompetition(cloud.weekKey())) {
        renderPanel();
        loadCompetition();
      }
      break;
    case "vote": {
      if (!runtime) return;
      if (S.comp.votedWeek === cloud.weekKey()) { toast("Already voted", "One vote per week, I'm afraid.", "star", true); return; }
      if (await game.voteCompetition(cloud.weekKey(), data.id)) {
        U.comp.voted = true;
        loadCompetition();
      }
      break;
    }
    case "copy-name":
      try {
        await navigator.clipboard.writeText(S.name);
        toast("Copied", "Your café name is on the clipboard.", "check");
      } catch (error) {
        toast("Your café name", S.name, "user");
      }
      break;
    default:
      break;
  }
}

/* ---------------------------------------------------------------------
   Scene interaction
   --------------------------------------------------------------------- */
function sceneTap(info, point, meta) {
  if (U.buildMode) {
    if (info && info.type === "item") { beginMove(info.entry); return; }
    if (U.placing || U.movingEntry) { commitBuild(meta); return; }
    return;
  }
  if (!info) return;
  if (info.type === "customer") {
    if (runtime.visiting) { toast("Say hello", "Guests here belong to the café you're visiting.", "paw"); return; }
    customerTap(info.handle.customer);
  } else if (info.type === "stray") {
    const stray = game.getStrays().find((s) => s.handle === info.handle);
    if (stray && game.petStray(stray.animalId)) {
      toast("Rescued", `${stray.def.name} is home now.`, "paw");
      renderHud();
    }
  } else if (info.type === "animal") {
    if (runtime.visiting) {
      floatText(world.projectToScreen(info.handle.headVec), "♥", "heart");
      playSound("purr");
      return;
    }
    const id = info.handle.id.startsWith("pet_") ? info.handle.id.slice(4) : null;
    if (id) {
      const pos = world.projectToScreen(info.handle.headVec);
      if (game.petAnimal(id, pos)) renderHud();
    }
  } else if (info.type === "item" && info.def && info.def.station) {
    if (runtime.visiting) return;
    openPanel("kitchen", "orders");
    toast("Ready to cook", "Take an order first, then cook it here.", "pot");
  }
}

/* ---------------------------------------------------------------------
   Initialisation
   --------------------------------------------------------------------- */
export function initUI() {
  game.setHooks({
    toast,
    save: setSavePill,
    sound: playSound,
    float: floatText,
    refresh() {
      renderHud();
      renderOrders();
      if (U.buildMode) renderBuildBar();
      if (U.screen === "kitchen" && U.tabs.kitchen === "orders") renderPanel();
    },
    levelUp(payload) {
      openLevelUp(payload);
      renderHud();
      renderPanel();
    }
  });
  game.listen(() => {
    renderHud();
    renderOrders();
  });

  // static controls
  $("panel-close").addEventListener("click", closePanel);
  $("brand").addEventListener("click", () => { closePanel(); if (U.buildMode) exitBuild(); setNav("cafe"); });
  $("btn-daily").addEventListener("click", () => { $("daily-modal").hidden = false; openDaily(); });
  $("btn-quests").addEventListener("click", () => openPanel("quests"));
  $("btn-settings").addEventListener("click", () => openPanel("settings"));
  $("build-done").addEventListener("click", exitBuild);
  $("build-rotate").addEventListener("click", rotateGhost);
  $("build-remove").addEventListener("click", removeSelected);
  $("build-snap").addEventListener("click", () => { S.settings.snap = !S.settings.snap; game.markDirty(); renderBuildBar(); });
  $("build-expand").addEventListener("click", () => { if (game.buyExpansion()) { renderBuildBar(); renderHud(); } });
  $("cam-left").addEventListener("click", () => { world.nudgeCamera(-1); playSound("click"); });
  $("cam-right").addEventListener("click", () => { world.nudgeCamera(1); playSound("click"); });
  $("cam-reset").addEventListener("click", () => { world.resetCamera(); playSound("click"); });
  $("cam-sound").addEventListener("click", () => { S.settings.sound = !S.settings.sound; game.markDirty(); renderHud(); if (S.settings.sound) playSound("click"); });
  $("visit-back").addEventListener("click", leaveVisit);
  $("visit-like").addEventListener("click", () => action("visit-like", {}, $("visit-like")));
  document.querySelectorAll("#visit-rate button").forEach((btn) => {
    btn.addEventListener("click", () => action("rate", { stars: btn.dataset.stars }, btn));
  });
  $("cook-start").addEventListener("click", startCook);
  $("cook-stop").addEventListener("click", stopCook);
  $("cook-close").addEventListener("click", closeCook);
  $("cook-cancel").addEventListener("click", closeCook);
  $("detail-close").addEventListener("click", () => { $("detail-modal").hidden = true; });
  $("daily-close").addEventListener("click", () => { $("daily-modal").hidden = true; });
  $("daily-claim").addEventListener("click", () => action("daily-claim", {}, $("daily-claim")));
  $("confirm-no").addEventListener("click", () => { $("confirm-modal").hidden = true; U.confirmCb = null; });
  $("confirm-yes").addEventListener("click", () => {
    const cb = U.confirmCb;
    U.confirmCb = null;
    $("confirm-modal").hidden = true;
    if (cb) cb();
  });
  $("cook-modal").addEventListener("click", (e) => { if (e.target === $("cook-modal")) closeCook(); });
  $("detail-modal").addEventListener("click", (e) => { if (e.target === $("detail-modal")) $("detail-modal").hidden = true; });
  $("daily-modal").addEventListener("click", (e) => { if (e.target === $("daily-modal")) $("daily-modal").hidden = true; });
  $("confirm-modal").addEventListener("click", (e) => { if (e.target === $("confirm-modal")) $("confirm-modal").hidden = true; });
  $("sheet-scrim").addEventListener("click", () => { if (U.buildMode) exitBuild(); else closePanel(); });

  document.querySelectorAll(".rail-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const nav = btn.dataset.nav;
      if (nav === "cafe") { closePanel(); if (U.buildMode) exitBuild(); setNav("cafe"); world.resetCamera(); }
      else if (nav === "build") enterBuild();
      else if (nav === "cook") openPanel("kitchen");
      else openPanel(nav);
      playSound("click");
    });
  });

  // delegated clicks + inputs
  document.addEventListener("click", (event) => {
    const el = event.target.closest("[data-act]");
    if (!el || el.disabled) return;
    event.preventDefault();
    action(el.dataset.act, el.dataset, el);
  });
  document.addEventListener("input", (event) => {
    if (event.target.id === "friend-search") {
      U.search = event.target.value;
      const body = $("panel-body");
      const screen = U.screen;
      if (screen === "friends") {
        renderPanel();
        const input = $("friend-search");
        if (input) { input.focus(); input.setSelectionRange(input.value.length, input.value.length); }
      }
    }
  });

  // keyboard
  window.addEventListener("keydown", (event) => {
    const tag = (event.target && event.target.tagName) || "";
    if (tag === "INPUT" || tag === "TEXTAREA") {
      if (event.key === "Escape") event.target.blur();
      return;
    }
    if (event.key === "Escape") {
      if (!$("confirm-modal").hidden) { $("confirm-modal").hidden = true; return; }
      if (!$("cook-modal").hidden) { closeCook(); return; }
      if (!$("detail-modal").hidden) { $("detail-modal").hidden = true; return; }
      if (!$("daily-modal").hidden) { $("daily-modal").hidden = true; return; }
      if (U.buildMode) { exitBuild(); return; }
      if (U.screen) { closePanel(); return; }
    }
    if (event.code === "Space" && !$("cook-modal").hidden) {
      event.preventDefault();
      if (U.cookRunning) stopCook();
      else if (!$("cook-start").hidden) startCook();
      return;
    }
    if (!U.buildMode) return;
    if (event.key === "r" || event.key === "R") rotateGhost();
    if (event.key === "x" || event.key === "X") removeSelected();
  });

  // scene hooks
  world.world.callbacks.onTap = sceneTap;
  world.world.callbacks.onMove = (meta) => updateGhost(meta);
  world.world.callbacks.onHover = () => {};
  world.world.callbacks.onGround = () => {};

  setInterval(() => {
    U.tipIndex = (U.tipIndex + 1) % TIPS.length;
    const tip = $("tip-text");
    if (tip) tip.textContent = TIPS[U.tipIndex];
  }, 24000);

  renderHud();
  renderOrders();
}

export function openLevelUp(payload) {
  const recipeNames = payload.recipes.slice(0, 5).map((r) => r.name);
  const pieceNames = payload.pieces.slice(0, 4).map((p) => p.name);
  $("detail-body").innerHTML = `<div style="text-align:center;display:grid;gap:6px;justify-items:center;padding:6px 0 2px">
      <span class="daily-gift" style="width:60px;height:60px">${ico("trophy")}</span>
      <p class="eyebrow">Level up</p>
      <h2 style="font-size:34px">Level ${payload.level}</h2>
      <p class="sub">The café is getting a name for itself.</p>
      <span class="badge-soft">${ico("coin")}+${payload.coins} coins</span>
    </div>
    <div class="divider"></div>
    ${recipeNames.length ? `<div class="panel-section"><div class="section-head"><h3>New recipes</h3></div>${recipeNames.map((name) => `<div class="badge-soft" style="margin:0 4px 4px 0">${ico("pot")}${esc(name)}</div>`).join("")}</div>` : ""}
    ${pieceNames.length ? `<div class="panel-section"><div class="section-head"><h3>New in the shop</h3></div>${pieceNames.map((name) => `<div class="badge-soft" style="margin:0 4px 4px 0">${ico("box")}${esc(name)}</div>`).join("")}</div>` : ""}
    <button class="btn primary wide" data-act="detail-close">Back to the café</button>`;
  $("detail-modal").hidden = false;
}

export function renderAll() {
  renderHud();
  renderOrders();
  renderBubbles();
  if (U.screen) renderPanel();
  if (U.buildMode) renderBuildBar();
}

export function tick(time) {
  updateOrderBars();
  renderBubbles();
  if (U.cookRunning && game.runtime.cooking) {
    const value = game.runtime.cooking.value;
    const needle = $("cook-needle");
    if (needle) {
      needle.style.left = (value * 100).toFixed(1) + "%";
      needle.classList.toggle("perfect", Math.abs(value - 0.5) <= game.runtime.cooking.zone);
    }
  }
  if (time - U.lastHud > 1200) {
    U.lastHud = time;
    renderHud();
  }
}

export function startFeeds() { ensureFeeds(); }

/* The gate is owned by main.js — these let UI ask for it. */
let gateHandler = { show() {}, hide() {} };
export function setGateHandlers(handlers) { gateHandler = handlers; }
export function showGate(allowClose) { gateHandler.show(allowClose); }

export { findCafe, loadCompetition, loadFriends, loadCafesOnce };
