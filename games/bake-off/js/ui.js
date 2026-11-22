/* =====================================================================
   BAKE OFF! — the interface
   Lobby, shop, profile, leaderboard, friends, challenges and the little
   bits of furniture every screen shares. The match screens live in
   match.js.
   ===================================================================== */
import * as game from "./game.js";
import * as cloud from "./cloud.js";
import * as world from "./scene.js";
import {
  RECIPES, recipeById, THEMES, themeById, TOPPINGS, toppingById, PLATES, plateById,
  HATS, APRONS, HAIRS, SKINS, KITCHENS, EQUIPMENT, INGREDIENTS, ingredientById,
  FROSTINGS, SHAPES, ACHIEVEMENTS, levelInfo, dayKey, pickDaily, pickWeekly,
  DAILY_REWARDS, CHEF_NAMES, TIPS
} from "./data.js";

const $ = (id) => document.getElementById(id);
export const ui = {
  screen: "lobby",
  tab: { shop: "recipes", you: "look" },
  online: false,
  match: null,
  matchId: null,
  isHost: false,
  buying: false,
  gateOpen: false,
  leaderboard: [],
  friends: { following: [], followers: [] },
  invites: null,
  busy: false
};

/* ---------------------------------------------------------------------
   Tiny helpers
   --------------------------------------------------------------------- */
export function esc(value) {
  return String(value === undefined || value === null ? "" : value)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
export function money(n) { return Number(n || 0).toLocaleString("en-US"); }
export function timeAgo(ts) {
  if (!ts) return "";
  const s = Math.max(1, Math.round((Date.now() - ts) / 1000));
  if (s < 60) return s + "s ago";
  if (s < 3600) return Math.round(s / 60) + "m ago";
  if (s < 86400) return Math.round(s / 3600) + "h ago";
  return Math.round(s / 86400) + "d ago";
}

/* ---------------------------------------------------------------------
   Sound
   --------------------------------------------------------------------- */
let audio = null;
function audioCtx() {
  if (!audio) {
    try { audio = new (window.AudioContext || window.webkitAudioContext)(); } catch (error) { audio = null; }
  }
  return audio;
}
export function sound(kind = "tap") {
  if (!game.S.settings.sound) return;
  const ctx = audioCtx();
  if (!ctx) return;
  try {
    if (ctx.state === "suspended") ctx.resume();
    const notes = {
      tap: [[660, 0.05, 0.05]],
      add: [[520, 0.06, 0.06], [780, 0.07, 0.1]],
      good: [[660, 0.09, 0.06], [880, 0.1, 0.12], [1180, 0.12, 0.2]],
      bad: [[200, 0.12, 0.08], [150, 0.14, 0.15]],
      ding: [[1046, 0.08, 0.05], [1568, 0.16, 0.15]],
      win: [[523, 0.12, 0.08], [659, 0.12, 0.16], [784, 0.12, 0.24], [1046, 0.24, 0.34]],
      level: [[440, 0.1, 0.05], [554, 0.1, 0.11], [659, 0.1, 0.17], [880, 0.3, 0.26]]
    }[kind] || [[600, 0.05, 0.04]];
    notes.forEach(([freq, dur, delay]) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = kind === "bad" ? "sawtooth" : "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, ctx.currentTime + delay);
      gain.gain.exponentialRampToValueAtTime(0.16, ctx.currentTime + delay + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + delay + dur);
      osc.connect(gain).connect(ctx.destination);
      osc.start(ctx.currentTime + delay);
      osc.stop(ctx.currentTime + delay + dur + 0.02);
    });
  } catch (error) { /* audio blocked */ }
}

/* ---------------------------------------------------------------------
   Toasts and modals
   --------------------------------------------------------------------- */
const ICON_FOR = { good: "i-check", bad: "i-x", trophy: "i-trophy", level: "i-sparkle", info: "i-whisk", coin: "i-coin", users: "i-users" };
export function toast(title, text, kind = "info") {
  const host = $("toasts");
  if (!host) return;
  const node = document.createElement("div");
  node.className = "toast " + (kind === "bad" ? "bad" : kind === "good" || kind === "trophy" ? "good" : "");
  node.innerHTML = `<span class="t-icon"><svg><use href="#${ICON_FOR[kind] || ICON_FOR.info}"/></svg></span><span><b>${esc(title)}</b><small>${esc(text || "")}</small></span>`;
  host.appendChild(node);
  if (kind === "good" || kind === "trophy" || kind === "level") sound("ding");
  setTimeout(() => { node.classList.add("out"); setTimeout(() => node.remove(), 320); }, 3400);
}

export function openModal(html, opts = {}) {
  const host = $("modals");
  if (!host) return null;
  host.innerHTML = `<div class="modal-scrim" data-close="1"></div><div class="modal-card ${opts.wide ? "wide-card" : ""}" role="dialog" aria-modal="true">${html}</div>`;
  host.style.pointerEvents = "auto";
  const scrim = host.querySelector(".modal-scrim");
  if (opts.dismissable !== false) {
    scrim.addEventListener("click", () => closeModal());
    host.querySelectorAll("[data-close]").forEach((btn) => btn.addEventListener("click", () => closeModal()));
  }
  host.querySelectorAll("[data-focus]").forEach((el) => setTimeout(() => el.focus(), 60));
  return host.querySelector(".modal-card");
}

export function closeModal() {
  const host = $("modals");
  if (host) { host.innerHTML = ""; host.style.pointerEvents = "none"; }
}

export function isModalOpen() { return !!($("modals") && $("modals").children.length); }

export function confirmDialog(title, text, yes = "Yes", no = "Never mind") {
  return new Promise((resolve) => {
    openModal(`
      <div class="center">
        <div style="width:56px;height:56px;border-radius:18px;background:var(--blush);color:var(--rose-deep);display:grid;place-items:center;margin:0 auto 12px;"><svg style="font-size:26px"><use href="#i-whisk"/></svg></div>
        <h2>${esc(title)}</h2>
        <p class="sub">${esc(text)}</p>
        <div class="modal-actions">
          <button class="btn ghost" id="cf-no">${esc(no)}</button>
          <button class="btn primary" id="cf-yes">${esc(yes)}</button>
        </div>
      </div>`);
    $("cf-no").addEventListener("click", () => { closeModal(); resolve(false); });
    $("cf-yes").addEventListener("click", () => { closeModal(); resolve(true); });
  });
}

/* ---------------------------------------------------------------------
   Portraits
   --------------------------------------------------------------------- */
const portraitCache = new Map();
function cache(key, build) {
  if (portraitCache.has(key)) return portraitCache.get(key);
  let src = "";
  try { src = build(); } catch (error) { console.warn("Bake Off: portrait", error); }
  portraitCache.set(key, src);
  return src;
}
export function recipeArt(id) {
  return cache("recipe:" + id, () => {
    const design = game.newDesign(id);
    design.frosting = recipeById(id).kind === "chocolate" ? "chocolate" : "blush";
    design.toppings = [{ id: "strawberry", x: -0.2, z: 0.1 }, { id: "mint", x: 0.25, z: -0.1 }];
    return world.creationPortrait(design, 220);
  });
}
export function toppingArt(id) { return cache("top:" + id, () => world.toppingPortrait(id, 120)); }
export function ingredientArt(id) { return cache("ing:" + id, () => world.ingredientPortrait(id, 120)); }
export function plateArt(id) { return cache("plate:" + id, () => world.platePortrait(id, 200)); }
export function chefArt(cos) {
  const key = "chef:" + JSON.stringify(cos);
  return cache(key, () => world.chefPortrait(cos, 260));
}
export function designArt(design, size = 320) {
  if (!design) return "";
  const key = "design:" + JSON.stringify(design) + ":" + size;
  return cache(key, () => world.creationPortrait(design, size));
}

/* ---------------------------------------------------------------------
   HUD
   --------------------------------------------------------------------- */
export function renderHud() {
  const info = levelInfo(game.S.xp);
  $("level-value").textContent = info.level;
  $("xp-value").textContent = `${info.into} / ${info.span} XP`;
  $("xp-fill").style.width = Math.round(info.progress * 100) + "%";
  $("coin-value").textContent = money(game.S.coins);
  const dot = $("daily-dot");
  if (dot) dot.hidden = !game.dailyRewardAvailable();
  const sub = $("brand-sub");
  if (sub) sub.textContent = ui.online ? "signed in · online" : "guest · practice kitchen";
}
export function refreshAll() { renderHud(); renderScreen(); }
export function refreshHud() { renderHud(); }

/* ---------------------------------------------------------------------
   Navigation
   --------------------------------------------------------------------- */
export function setScreen(name) {
  ui.screen = name;
  document.querySelectorAll(".nav-btn").forEach((btn) => btn.classList.toggle("on", btn.dataset.nav === name));
  if (ui.match && !["lobby", "you", "shop"].includes(name)) { /* the match owns the screen */ }
  renderScreen();
  sound("tap");
}

function renderScreen() {
  if (ui.match) return; // match.js draws over the screen
  const host = $("screen");
  if (!host) return;
  if (ui.screen === "shop") host.innerHTML = viewShop();
  else if (ui.screen === "friends") host.innerHTML = viewFriends();
  else if (ui.screen === "ranks") host.innerHTML = viewRanks();
  else if (ui.screen === "you") host.innerHTML = viewYou();
  else host.innerHTML = viewLobby();
  bindScreen();
  if (ui.screen === "ranks") loadLeaderboard();
  if (ui.screen === "friends") loadFriends();
}

/* ---------------------------------------------------------------------
   Lobby
   --------------------------------------------------------------------- */
function themeOfDay() {
  const seed = game.themeForMatch("daily-" + dayKey()).id;
  return themeById(seed) || THEMES[0];
}

function viewLobby() {
  const today = themeOfDay();
  const stats = game.historyStats();
  const daily = game.dailyState();
  const weekly = game.weeklyState();
  const recent = (game.S.history || []).slice(0, 5);
  const tip = TIPS[Math.floor(Math.random() * TIPS.length)];
  return `
  <div class="lobby">
    <section class="hero">
      <div class="hero-copy">
        <span class="hero-eyebrow"><svg><use href="#i-sparkle"/></svg> Live baking competition</span>
        <h1>One theme.<br>Everybody's <em>oven</em>.</h1>
        <p>Get a mystery theme, weigh and mix for real, time your bake, then decorate a cake the other bakers will actually see — and vote on. Two to eight players, about four minutes.</p>
        <div class="hero-actions">
          <button class="btn primary" data-act="quick"><svg><use href="#i-users"/></svg>Quick match</button>
          <button class="btn ghost" data-act="room"><svg><use href="#i-lock"/></svg>Private room</button>
          <button class="btn soft" data-act="practice"><svg><use href="#i-chef"/></svg>Practice with rivals</button>
        </div>
        <p class="hint" style="margin-top:10px">${ui.online ? `<span class="pulse-dot"></span> Online matchmaking is ready.` : "Playing as a guest — practice works fully, and you can sign in any time to compete."}</p>
      </div>
      <div class="hero-side">
        <div class="hero-theme">
          <span class="eyebrow">Today's theme</span>
          <b>${esc(today.name)}</b>
          <div class="swatches">${today.colors.map((c) => `<i style="background:${c}"></i>`).join("")}</div>
          <small>${esc(today.blurb)}</small>
        </div>
        <div class="hero-mini">
          <div><b>${stats.played}</b><small>Bakes</small></div>
          <div><b>${stats.wins}</b><small>Wins</small></div>
          <div><b>${stats.best}</b><small>Best</small></div>
        </div>
      </div>
    </section>

    <div class="grid-2">
      <section class="card">
        <div class="card-head">
          <div><p class="eyebrow">Three a day</p><h3>Daily challenges</h3></div>
          <button class="btn small soft" data-act="challenges">All challenges</button>
        </div>
        <div class="daily-row">
          ${daily.map((q) => `
            <div class="quest">
              <span class="quest-icon"><svg><use href="#i-${q.id.includes("vote") ? "heart" : q.id.includes("decor") ? "palette" : q.id.includes("score") ? "star" : "cake"}"/></svg></span>
              <div class="quest-main">
                <b>${esc(q.text)}</b>
                <span>${q.progress} / ${q.goal}${q.complete ? " · ready" : ""}</span>
                <div class="quest-bar"><i style="width:${Math.min(100, Math.round(q.progress / q.goal * 100))}%"></i></div>
              </div>
              ${q.claimed ? `<span class="chip"><svg><use href="#i-check"/></svg>Done</span>`
                : q.complete ? `<button class="btn tiny primary" data-claim="${esc(q.id)}">+${q.coins}</button>`
                : `<span class="chip">${q.coins}c</span>`}
            </div>`).join("")}
        </div>
        <div class="divider"></div>
        <div class="between">
          <div>
            <p class="eyebrow">This week</p>
            <b style="font-size:13px">${esc(weekly.text)}</b>
            <p class="hint">${weekly.progress} / ${weekly.goal}${weekly.claimed ? " · claimed" : ""}</p>
          </div>
          ${weekly.complete && !weekly.claimed ? `<button class="btn small primary" data-act="claim-weekly">Claim ${weekly.coins}</button>` : `<span class="chip"><svg><use href="#i-trophy"/></svg>${weekly.progress}/${weekly.goal}</span>`}
        </div>
      </section>

      <section class="card">
        <div class="card-head"><div><p class="eyebrow">Last time</p><h3>Your recent bakes</h3></div>
          <button class="btn small ghost" data-act="nav" data-nav-to="you">All stats</button>
        </div>
        ${recent.length ? recent.map((h) => `
          <div class="recent-row">
            <span class="rank ${h.rank === 1 ? "gold" : h.rank === 2 ? "silver" : h.rank === 3 ? "bronze" : ""}">${h.rank}</span>
            <span class="who"><b>${esc(h.recipe || "Bake")}</b><br><small class="muted">${esc(h.theme)} · ${timeAgo(h.at)}${h.online ? "" : " · practice"}</small></span>
            <span class="score">${h.score}</span>
          </div>`).join("")
        : `<p class="empty-note">No bakes yet. Your first theme is waiting — quick match takes about four minutes.</p>`}
        <div class="divider"></div>
        <div class="between">
          <div><p class="eyebrow">Today's tip</p><b style="font-size:12.5px;font-weight:600;line-height:1.5">${esc(tip)}</b></div>
          <button class="btn small soft" data-act="gallery">Cake ideas</button>
        </div>
      </section>
    </div>

    <section class="card">
      <div class="card-head"><div><p class="eyebrow">The show</p><h3>Four rounds, one winner</h3></div><span class="chip"><svg><use href="#i-clock"/></svg>≈ 4 minutes</span></div>
      <div class="grid-3" style="gap:9px">
        ${[
          ["whisk", "Prepare", "Weigh every ingredient into the bowl, then mix to the mark."],
          ["oven", "Bake", "Pick a temperature and pull the tray in the golden window."],
          ["palette", "Decorate", "Frosting, toppings, candles, a message and a plate — all 3D."],
          ["trophy", "Vote", "Everyone sees the real cakes. You can't vote for your own."]
        ].map(([icon, title, text]) => `
          <div style="display:flex;gap:10px;align-items:flex-start;padding:11px;border-radius:14px;background:rgba(255,255,255,0.6)">
            <span style="width:34px;height:34px;border-radius:11px;background:var(--blush);color:var(--rose-deep);display:grid;place-items:center;flex:0 0 auto"><svg style="font-size:17px"><use href="#i-${icon}"/></svg></span>
            <div><b style="font-size:12.5px">${title}</b><p class="hint" style="margin-top:2px">${text}</p></div>
          </div>`).join("")}
      </div>
    </section>
  </div>`;
}

/* ---------------------------------------------------------------------
   Shop
   --------------------------------------------------------------------- */
const SHOP_TABS = [
  ["recipes", "Recipes"], ["plates", "Plates"], ["toppings", "Toppings"],
  ["chef", "Chef"], ["kitchens", "Kitchen"], ["equipment", "Equipment"]
];

function viewShop() {
  const tab = ui.tab.shop;
  return `
  <div class="panel-page">
    <div class="panel-title">
      <div><p class="eyebrow">Spend those coins</p><h1>The pantry shop</h1><p>Recipes unlock with levels, or buy them early. Plates, toppings and outfits are yours to keep.</p></div>
      <span class="stat coin" style="pointer-events:none"><svg><use href="#i-coin"/></svg><b>${money(game.S.coins)}</b></span>
    </div>
    <div class="tabs">${SHOP_TABS.map(([id, name]) => `<button class="tab ${tab === id ? "on" : ""}" data-shop-tab="${id}">${name}</button>`).join("")}</div>
    <div class="shop-grid" id="shop-grid">${shopItems(tab)}</div>
    <p class="section-note">Coins come from every bake — finishing, scoring well and placing on the podium all pay. Practice matches count too, they just don't appear on the online leaderboard.</p>
  </div>`;
}

function shopItems(tab) {
  if (tab === "recipes") {
    return RECIPES.map((r) => {
      const owned = game.owns("recipe", r.id);
      const locked = game.level() < r.level;
      const price = game.priceOfRecipe(r);
      return `<div class="item-card">
        <div class="item-art"><img src="${recipeArt(r.id)}" alt="${esc(r.name)}" loading="lazy">
          ${owned ? `<span class="owned-tag">In your book</span>` : locked ? `<span class="lock-tag"><svg><use href="#i-lock"/></svg>Level ${r.level}</span>` : ""}
        </div>
        <div class="item-body">
          <b>${esc(r.name)}</b>
          <small>${esc(r.blurb)}</small>
          <div class="row" style="justify-content:space-between">
            <span class="chip">${esc(r.kind)}</span>
            ${owned ? `<span class="chip"><svg><use href="#i-check"/></svg>Owned</span>`
              : `<button class="btn tiny ${locked ? "ghost" : "primary"}" data-buy="recipe" data-id="${r.id}" ${locked ? "disabled" : ""}><svg><use href="#i-coin"/></svg>${price}</button>`}
          </div>
        </div>
      </div>`;
    }).join("");
  }
  if (tab === "plates") {
    return PLATES.map((p) => `<div class="item-card">
      <div class="item-art"><img src="${plateArt(p.id)}" alt="${esc(p.name)}" loading="lazy">${game.owns("plate", p.id) ? `<span class="owned-tag">Owned</span>` : ""}</div>
      <div class="item-body"><b>${esc(p.name)}</b><small>${p.tags.join(" · ")}</small>
        ${game.owns("plate", p.id) ? `<span class="chip"><svg><use href="#i-check"/></svg>In your cupboard</span>` : `<button class="btn tiny primary" data-buy="plate" data-id="${p.id}"><svg><use href="#i-coin"/></svg>180</button>`}
      </div></div>`).join("");
  }
  if (tab === "toppings") {
    return TOPPINGS.map((t) => `<div class="item-card">
      <div class="item-art"><img src="${toppingArt(t.id)}" alt="${esc(t.name)}" loading="lazy">${game.owns("topping", t.id) ? `<span class="owned-tag">Owned</span>` : ""}</div>
      <div class="item-body"><b>${esc(t.name)}</b><small>${t.tags.join(" · ")}</small>
        ${game.owns("topping", t.id) ? `<span class="chip"><svg><use href="#i-check"/></svg>Unlocked</span>` : `<button class="btn tiny primary" data-buy="topping" data-id="${t.id}"><svg><use href="#i-coin"/></svg>240</button>`}
      </div></div>`).join("");
  }
  if (tab === "chef") {
    const cos = game.chefCosmetics();
    const hats = HATS.map((h) => shopOutfit("hat", h, cos.hat, "hats")).join("");
    const aprons = APRONS.map((a) => shopOutfit("apron", a, cos.apron, "aprons")).join("");
    const hairs = HAIRS.map((h) => shopOutfit("hair", h, cos.hair, "hairs")).join("");
    return hats + aprons + hairs;
  }
  if (tab === "kitchens") {
    return KITCHENS.map((k) => `<div class="item-card">
      <div class="item-art" style="background:linear-gradient(150deg, ${k.wall}, ${k.accent})"><span style="font-family:var(--display);font-size:23px;color:#6f4956">${esc(k.name.split(" ")[0])}</span>${game.owns("kitchen", k.id) ? `<span class="owned-tag">Owned</span>` : ""}</div>
      <div class="item-body"><b>${esc(k.name)}</b><small>Wall, cabinets and bench in a matching palette.</small>
        ${game.owns("kitchen", k.id) ? `<button class="btn tiny ${game.S.equipped.kitchen === k.id ? "ghost" : "soft"}" data-equip="kitchen" data-id="${k.id}">${game.S.equipped.kitchen === k.id ? "In use" : "Use this kitchen"}</button>`
          : `<button class="btn tiny primary" data-buy="kitchen" data-id="${k.id}"><svg><use href="#i-coin"/></svg>${k.price}</button>`}
      </div></div>`).join("");
  }
  return EQUIPMENT.map((e) => `<div class="item-card">
    <div class="item-art" style="background:linear-gradient(150deg, ${e.color}, ${e.trim})"><svg style="font-size:38px;color:#7d6a5d"><use href="#i-oven"/></svg>${game.owns("equipment", e.id) ? `<span class="owned-tag">Owned</span>` : ""}</div>
    <div class="item-body"><b>${esc(e.name)}</b><small>A prettier oven, same reliable heat.</small>
      ${game.owns("equipment", e.id) ? `<button class="btn tiny ${game.S.equipped.oven === e.id ? "ghost" : "soft"}" data-equip="oven" data-id="${e.id}">${game.S.equipped.oven === e.id ? "In use" : "Install"}</button>`
        : `<button class="btn tiny primary" data-buy="equipment" data-id="${e.id}"><svg><use href="#i-coin"/></svg>${e.price}</button>`}
    </div></div>`).join("");
}

function shopOutfit(kind, item, equipped, map) {
  const owned = !!game.S[map][item.id];
  const cos = { ...game.chefCosmetics(), [kind]: item.id };
  return `<div class="item-card">
    <div class="item-art"><img src="${chefArt(cos)}" alt="${esc(item.name)}" loading="lazy">${owned ? `<span class="owned-tag">Owned</span>` : ""}</div>
    <div class="item-body"><b>${esc(item.name)}</b><small>${kind === "hat" ? "Chef's hat" : kind === "apron" ? "Apron" : "Hairstyle"}</small>
      ${owned ? `<button class="btn tiny ${equipped === item.id ? "ghost" : "soft"}" data-equip="${kind}" data-id="${item.id}">${equipped === item.id ? "Wearing" : "Wear"}</button>`
        : `<button class="btn tiny primary" data-buy="${kind}" data-id="${item.id}"><svg><use href="#i-coin"/></svg>${item.price}</button>`}
    </div></div>`;
}

/* ---------------------------------------------------------------------
   Profile
   --------------------------------------------------------------------- */
function viewYou() {
  const info = levelInfo(game.S.xp);
  const stats = game.S.stats;
  const cos = game.chefCosmetics();
  const tab = ui.tab.you;
  const recent = game.S.history || [];
  const ach = game.achievementList();
  const earned = ach.filter((a) => a.earned).length;
  return `
  <div class="panel-page">
    <div class="panel-title">
      <div><p class="eyebrow">Your kitchen</p><h1>Chef ${esc(game.S.name || "Guest")}</h1><p>Level ${info.level} · ${money(game.S.xp)} XP · ${ui.online ? "signed in" : "guest on this device"}</p></div>
      <button class="btn small ghost" data-act="settings"><svg><use href="#i-settings"/></svg>Settings</button>
    </div>

    <section class="card">
      <div class="profile-hero">
        <div class="chef-frame"><img src="${chefArt(cos)}" alt="Your chef"></div>
        <div class="profile-main">
          <h2>${esc(game.S.name || "Guest baker")}</h2>
          <p>${esc(game.S.equipped.hat)} hat · ${esc(game.S.equipped.apron)} apron · ${esc(game.S.equipped.kitchen)} kitchen</p>
          <div class="stat-row">
            <div class="stat-cell"><b>${stats.bakes}</b><small>Bakes</small></div>
            <div class="stat-cell"><b>${stats.wins}</b><small>Wins</small></div>
            <div class="stat-cell"><b>${stats.bestScore}</b><small>Best score</small></div>
            <div class="stat-cell"><b>${stats.bestStreak}</b><small>Best streak</small></div>
          </div>
          <div class="row" style="margin-top:10px">
            <span class="chip"><svg><use href="#i-trophy"/></svg>${stats.podiums} podiums</span>
            <span class="chip"><svg><use href="#i-heart"/></svg>${stats.votes} votes cast</span>
            <span class="chip"><svg><use href="#i-cake"/></svg>${Object.keys(game.S.recipes).length} recipes</span>
          </div>
        </div>
      </div>
    </section>

    <div class="tabs">
      <button class="tab ${tab === "look" ? "on" : ""}" data-you-tab="look">Wardrobe</button>
      <button class="tab ${tab === "achievements" ? "on" : ""}" data-you-tab="achievements">Achievements ${earned}/${ach.length}</button>
      <button class="tab ${tab === "history" ? "on" : ""}" data-you-tab="history">History</button>
    </div>

    ${tab === "look" ? viewWardrobe() : tab === "achievements" ? viewAchievements(ach) : viewHistory(recent)}
  </div>`;
}

function viewWardrobe() {
  const cos = game.chefCosmetics();
  const row = (kind, list, map, current) => `
    <div class="tool-group" style="margin-bottom:12px">
      <h4>${kind === "hat" ? "Hats" : kind === "apron" ? "Aprons" : "Hair"}</h4>
      <div class="topping-row" style="grid-template-columns:repeat(auto-fill,minmax(64px,1fr))">
        ${list.map((item) => {
          const owned = !!game.S[map][item.id];
          return `<button class="topping-btn ${current === item.id ? "on" : ""} ${owned ? "" : "locked"}" data-equip="${kind}" data-id="${item.id}" title="${esc(owned ? item.name : item.name + " — buy in the shop")}">
            <img src="${chefArt({ ...cos, [kind]: item.id })}" alt="${esc(item.name)}" loading="lazy">
            <span>${owned ? esc(item.name.split(" ")[0]) : "🔒"}</span>
          </button>`;
        }).join("")}
      </div>
    </div>`;
  return `
  <section class="card">
    <div class="grid-2">
      <div>${row("hat", HATS, "hats", cos.hat)}${row("apron", APRONS, "aprons", cos.apron)}</div>
      <div>${row("hair", HAIRS, "hairs", cos.hair)}
        <div class="tool-group">
          <h4>Skin tone</h4>
          <div class="swatch-row">
            ${SKINS.map((c, i) => `<button class="swatch ${game.S.equipped.skin === i ? "on" : ""}" style="background:${c};width:34px;height:34px" data-equip="skin" data-id="${i}" aria-label="Skin tone ${i + 1}"></button>`).join("")}
          </div>
        </div>
        <div class="tool-group" style="margin-top:10px">
          <h4>Kitchen</h4>
          <div class="option-row">
            ${KITCHENS.map((k) => `<button class="option-pill ${game.S.equipped.kitchen === k.id ? "on" : ""} ${game.owns("kitchen", k.id) ? "" : "locked"}" data-equip="kitchen" data-id="${k.id}">${esc(k.name.split(" ")[0])}</button>`).join("")}
          </div>
        </div>
      </div>
    </div>
    <p class="section-note" style="margin-top:12px">Everything you wear shows up in the kitchen and at the presentation table. More outfits live in the shop.</p>
  </section>`;
}

function viewAchievements(ach) {
  return `<section class="card"><div class="ach-grid">
    ${ach.map((a) => `<div class="ach ${a.earned ? "earned" : ""}">
      <span class="ach-icon"><svg><use href="#i-${a.earned ? "trophy" : "star"}"/></svg></span>
      <div style="flex:1;min-width:0"><b>${esc(a.name)}</b><small>${esc(a.desc)}</small>
        <div class="bar"><i style="width:${Math.round(a.progress / a.goal * 100)}%"></i></div>
        <small>${a.progress} / ${a.goal} · +${a.coins}c</small>
      </div></div>`).join("")}
  </div></section>`;
}

function viewHistory(recent) {
  if (!recent.length) return `<section class="card"><p class="empty-note">Nothing in the book yet. Every match you finish gets recorded here with the theme, the score and the cake.</p></section>`;
  return `<section class="card"><div class="stack">
    ${recent.map((h) => `<div class="recent-row" style="gap:12px">
      <span class="rank ${h.rank === 1 ? "gold" : h.rank === 2 ? "silver" : h.rank === 3 ? "bronze" : ""}">${h.rank}</span>
      <span class="who"><b>${esc(h.recipe)}</b><br><small class="muted">${esc(h.theme)} · ${esc(h.total)} bakers · ${timeAgo(h.at)}</small></span>
      <span class="score">${h.score}</span>
    </div>`).join("")}
  </div></section>`;
}

/* ---------------------------------------------------------------------
   Leaderboard
   --------------------------------------------------------------------- */
function viewRanks() {
  return `
  <div class="panel-page">
    <div class="panel-title"><div><p class="eyebrow">The bake-off table</p><h1>Leaderboard</h1><p>Ranked by experience earned across every match.</p></div>
      <button class="btn small ghost" data-act="refresh-ranks"><svg><use href="#i-refresh"/></svg>Refresh</button>
    </div>
    <section class="card" id="lb-card">
      <p class="empty-note">${ui.online ? "Reading the table…" : "Sign in to see the online leaderboard. Practice matches still count towards your own stats."}</p>
    </section>
    <section class="card">
      <div class="card-head"><div><p class="eyebrow">How it is counted</p><h3>Scoring</h3></div></div>
      <div class="grid-3" style="gap:9px">
        ${[["Theme fit", "25", "Ingredients, flavours and colours against the theme palette."], ["Creativity", "20", "Variety, message, candles and unusual combinations."], ["Decoration", "25", "How much you place, and how well it is spread over the cake."], ["Presentation", "15", "Plate, shape, tiers and the finish."], ["Completion", "15", "Your mixing and oven timing, honestly measured."], ["Votes", "+6 each", "Every vote another baker gives you is worth six points."]].map(([n, v, t]) => `
          <div style="padding:11px;border-radius:14px;background:rgba(255,255,255,0.62)">
            <div class="between"><b style="font-size:12.5px">${n}</b><span class="chip">${v}</span></div>
            <p class="hint" style="margin-top:4px">${t}</p>
          </div>`).join("")}
      </div>
    </section>
  </div>`;
}

async function loadLeaderboard() {
  if (!ui.online) return;
  const rows = await cloud.fetchTopPlayers();
  ui.leaderboard = rows;
  const card = $("lb-card");
  if (!card) return;
  if (!rows.length) { card.innerHTML = `<p class="empty-note">No one has baked online yet. You could be the first name here.</p>`; return; }
  card.innerHTML = rows.map((r, i) => `<div class="lb-row ${r.uid === (cloud.getUser() || {}).uid ? "me" : ""}">
    <span class="n">${i + 1}</span>
    <span class="friend-av" style="width:28px;height:28px;font-size:11px">${esc((r.name || "?")[0].toUpperCase())}</span>
    <span class="who"><b>${esc(r.name || "Baker")}</b><small>Level ${r.level || 1} · ${r.wins || 0} wins · best ${r.bestScore || 0}</small></span>
    <span class="val">${money(r.xp || 0)} XP</span>
  </div>`).join("");
}

/* ---------------------------------------------------------------------
   Friends
   --------------------------------------------------------------------- */
function viewFriends() {
  const { following, followers } = ui.friends;
  const mutual = following.filter((f) => followers.some((b) => b.from === f.to));
  const suggestions = ui.leaderboard.filter((r) => r.uid !== (cloud.getUser() || {}).uid && !following.some((f) => f.to === r.uid)).slice(0, 6);
  return `
  <div class="panel-page">
    <div class="panel-title"><div><p class="eyebrow">Bake together</p><h1>Friends</h1><p>Follow a baker back and they become a friend you can invite to a private kitchen.</p></div>
      <button class="btn small primary" data-act="room"><svg><use href="#i-lock"/></svg>Open a room</button>
    </div>
    ${ui.online ? `
    <section class="card">
      <div class="card-head"><div><p class="eyebrow">Friends</p><h3>${mutual.length} mutual · ${following.length} following</h3></div></div>
      ${mutual.length ? mutual.map((f) => {
        const person = ui.leaderboard.find((r) => r.uid === f.to) || { name: f.name || "Baker", level: 1, xp: 0 };
        return `<div class="friend-row">
          <span class="friend-av">${esc((person.name || "?")[0].toUpperCase())}</span>
          <span class="who"><b>${esc(person.name)}</b><small><span class="online-dot"></span>Level ${person.level || 1} · ${money(person.xp || 0)} XP</small></span>
          <button class="btn tiny soft" data-follow="${esc(f.to)}">Unfollow</button>
        </div>`;
      }).join("") : `<p class="empty-note">No mutual friends yet. Follow someone from the suggestions below — when they follow you back, you can invite each other.</p>`}
    </section>
    <section class="card">
      <div class="card-head"><div><p class="eyebrow">Bakers you have met</p><h3>Suggestions</h3></div></div>
      ${suggestions.length ? suggestions.map((r) => `<div class="friend-row">
        <span class="friend-av">${esc((r.name || "?")[0].toUpperCase())}</span>
        <span class="who"><b>${esc(r.name)}</b><small>Level ${r.level || 1} · ${r.wins || 0} wins</small></span>
        <button class="btn tiny primary" data-follow="${esc(r.uid)}">Follow</button>
      </div>`).join("") : `<p class="empty-note">Follow a few bakers from the leaderboard and they will show up here.</p>`}
    </section>` : `<section class="card"><p class="empty-note">Friend lists need an account. Sign in from settings (or the login screen) to add bakers and invite them to a private room. Practice with rivals is always available.</p></section>`}
  </div>`;
}

async function loadFriends() {
  if (!ui.online) return;
  const [following, followers, top] = await Promise.all([cloud.following(), cloud.followers(), cloud.fetchTopPlayers()]);
  ui.friends = { following, followers };
  ui.leaderboard = top;
  if (ui.screen === "friends" && !ui.match) renderScreen();
}

/* ---------------------------------------------------------------------
   Challenges modal
   --------------------------------------------------------------------- */
export function openChallenges() {
  const daily = game.dailyState();
  const weekly = game.weeklyState();
  const streak = game.S.dailyReward.streak || 0;
  openModal(`
    <div class="modal-head"><div><p class="eyebrow">Something to aim for</p><h2>Challenges</h2><p class="sub">Three new daily challenges every morning, plus one weekly goal and a reward for turning up.</p></div></div>
    <div class="daily-row">
      ${daily.map((q) => `<div class="quest">
        <span class="quest-icon"><svg><use href="#i-${q.complete ? "check" : "star"}"/></svg></span>
        <div class="quest-main"><b>${esc(q.text)}</b><span>${q.progress} / ${q.goal} · +${q.coins} coins · +${q.xp} XP</span>
        <div class="quest-bar"><i style="width:${Math.min(100, Math.round(q.progress / q.goal * 100))}%"></i></div></div>
        ${q.claimed ? `<span class="chip">Claimed</span>` : q.complete ? `<button class="btn tiny primary" data-claim="${esc(q.id)}">Claim</button>` : `<span class="chip">${q.progress}/${q.goal}</span>`}
      </div>`).join("")}
    </div>
    <div class="divider"></div>
    <div class="quest">
      <span class="quest-icon"><svg><use href="#i-trophy"/></svg></span>
      <div class="quest-main"><b>${esc(weekly.text)}</b><span>${weekly.progress} / ${weekly.goal} · +${weekly.coins} coins · +${weekly.xp} XP</span>
        <div class="quest-bar"><i style="width:${Math.min(100, Math.round(weekly.progress / weekly.goal * 100))}%"></i></div></div>
      ${weekly.claimed ? `<span class="chip">Claimed</span>` : weekly.complete ? `<button class="btn tiny primary" data-act="claim-weekly">Claim</button>` : `<span class="chip">${weekly.progress}/${weekly.goal}</span>`}
    </div>
    <div class="divider"></div>
    <div class="between">
      <div><p class="eyebrow">Daily reward</p><b style="font-size:13px">Day ${Math.min(7, streak + (game.dailyRewardAvailable() ? 1 : 0))} of 7 · ${DAILY_REWARDS[Math.max(0, Math.min(6, streak + (game.dailyRewardAvailable() ? 0 : -1)))]} coins</b>
        <p class="hint">${game.dailyRewardAvailable() ? "Ready to claim." : "Already claimed today — come back tomorrow."}</p></div>
      <button class="btn small gold" data-act="daily-reward" ${game.dailyRewardAvailable() ? "" : "disabled"}><svg><use href="#i-gift"/></svg>${game.dailyRewardAvailable() ? "Claim" : "Claimed"}</button>
    </div>
    <div class="modal-actions"><button class="btn ghost" data-close="1">Close</button></div>
  `);
  $("modals").querySelectorAll("[data-close]").forEach((b) => b.addEventListener("click", closeModal));
  bindClaims();
}

function bindClaims() {
  document.querySelectorAll("[data-claim]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const result = game.claimDaily(btn.dataset.claim);
      if (result.ok) {
        sound("win");
        toast("Challenge complete", `+${result.coins} coins and +${result.xp} XP.`, "good");
        closeModal();
        refreshAll();
      } else {
        toast("Not yet", result.reason || "", "bad");
      }
    });
  });
}

/* ---------------------------------------------------------------------
   Gallery of example cakes (used from the lobby)
   --------------------------------------------------------------------- */
export function openGallery() {
  const cards = [
    { theme: "pink-paradise", recipe: "strawberry-cream", frosting: "blush", style: "swirl", plate: "gold", shape: "tiered2", message: "HAPPY DAY", toppings: ["strawberry", "rose", "pearl"], candles: 3, sprinkles: 40 },
    { theme: "chocolate-heaven", recipe: "chocolate-fudge", frosting: "chocolate", style: "drip", plate: "slate", shape: "round", message: "", toppings: ["chocolate", "wafer", "cherry"], candles: 0, sprinkles: 20 },
    { theme: "dream-wedding", recipe: "wedding-tier", frosting: "vanilla", style: "piped", plate: "marble", shape: "tiered3", message: "J & A", toppings: ["rose", "pearl", "gold"], candles: 0, sprinkles: 0 },
    { theme: "halloween", recipe: "fudge-brownie", frosting: "caramel", style: "drip", plate: "wood", shape: "sheet", message: "", toppings: ["chocolate", "star", "cherry"], candles: 2, sprinkles: 30 },
    { theme: "underwater", recipe: "cheesecake-berry", frosting: "sky", style: "smooth", plate: "glass", shape: "round", message: "DIVE IN", toppings: ["pearl", "blueberry", "mint"], candles: 1, sprinkles: 12 },
    { theme: "sakura", recipe: "raspberry-macaron", frosting: "blush", style: "piped", plate: "lace", shape: "round", message: "", toppings: ["rose", "raspberry", "pearl"], candles: 0, sprinkles: 0 }
  ].map((d) => {
    const design = game.newDesign(d.recipe);
    Object.assign(design, { frosting: d.frosting, style: d.style, plate: d.plate, shape: d.shape, message: d.message, candles: d.candles, sprinkles: d.sprinkles });
    design.toppings = d.toppings.map((id, i) => ({ id, x: Math.cos(i * 2.1) * 0.5, z: Math.sin(i * 2.1) * 0.5 }));
    return { ...d, design };
  });
  openModal(`
    <div class="modal-head"><div><p class="eyebrow">For inspiration</p><h2>Six cakes, six themes</h2><p class="sub">Every one of these is built from the same tools you get in the decorating round.</p></div></div>
    <div class="vote-grid">
      ${cards.map((c) => `<div class="vote-card" style="cursor:default">
        <img src="${designArt(c.design, 320)}" alt="Example cake" loading="lazy">
        <div class="meta"><b>${esc(themeById(c.theme).name)}</b><small>${esc(recipeById(c.recipe).name)}</small></div>
      </div>`).join("")}
    </div>
    <div class="modal-actions"><button class="btn ghost" data-close="1">Close</button></div>
  `, { wide: true });
  $("modals").querySelectorAll("[data-close]").forEach((b) => b.addEventListener("click", closeModal));
}

/* ---------------------------------------------------------------------
   Settings
   --------------------------------------------------------------------- */
export function openSettings() {
  const user = cloud.getUser();
  openModal(`
    <div class="modal-head"><div><p class="eyebrow">Your account</p><h2>Settings</h2><p class="sub">${ui.online ? "Signed in as " + esc(user.name) + "." : "Playing as a guest on this device."}</p></div></div>
    <div class="stack">
      <div class="between" style="padding:10px 12px;border-radius:12px;background:rgba(255,255,255,0.66)">
        <div><b style="font-size:12.5px">Sound</b><p class="hint">Little oven dings, mostly.</p></div>
        <button class="btn small ${game.S.settings.sound ? "primary" : "ghost"}" data-act="toggle-sound">${game.S.settings.sound ? "On" : "Off"}</button>
      </div>
      ${ui.online ? `
        <div class="between" style="padding:10px 12px;border-radius:12px;background:rgba(255,255,255,0.66)">
          <div><b style="font-size:12.5px">Cloud save</b><p class="hint">Your coins, recipes and chef are saved to your account.</p></div>
          <button class="btn small soft" data-act="save-cloud">Save now</button>
        </div>
        <button class="btn ghost wide" data-act="signout">Sign out</button>
      ` : `<button class="btn primary wide" data-act="open-gate">Sign in or create an account</button>`}
      <button class="btn ghost wide" data-act="guest-name">Change guest name</button>
      <button class="btn danger wide" data-act="reset">Reset this device's progress</button>
      <p class="section-note">Bake Off! v1 · built with Three.js and Firebase. Cakes are generated in code, not photos.</p>
    </div>
    <div class="modal-actions"><button class="btn ghost" data-close="1">Close</button></div>
  `);
  $("modals").querySelectorAll("[data-close]").forEach((b) => b.addEventListener("click", closeModal));
}

/* ---------------------------------------------------------------------
   Binding
   --------------------------------------------------------------------- */
function bindScreen() {
  const host = $("screen");
  host.querySelectorAll("[data-shop-tab]").forEach((btn) => btn.addEventListener("click", () => {
    ui.tab.shop = btn.dataset.shopTab;
    renderScreen();
  }));
  host.querySelectorAll("[data-you-tab]").forEach((btn) => btn.addEventListener("click", () => {
    ui.tab.you = btn.dataset.youTab;
    renderScreen();
  }));
  host.querySelectorAll("[data-buy]").forEach((btn) => btn.addEventListener("click", () => buyItem(btn.dataset.buy, btn.dataset.id, btn)));
  host.querySelectorAll("[data-equip]").forEach((btn) => btn.addEventListener("click", () => equipItem(btn.dataset.equip, btn.dataset.id, btn)));
  host.querySelectorAll("[data-follow]").forEach((btn) => btn.addEventListener("click", () => toggleFollow(btn.dataset.follow, btn)));
  host.querySelectorAll("[data-claim]").forEach((btn) => btn.addEventListener("click", () => {
    const result = game.claimDaily(btn.dataset.claim);
    if (result.ok) { toast("Challenge complete", `+${result.coins} coins, +${result.xp} XP`, "good"); sound("win"); }
    refreshAll();
  }));
  host.querySelectorAll("[data-nav-to]").forEach((btn) => btn.addEventListener("click", () => setScreen(btn.dataset.navTo)));
  host.querySelectorAll("[data-act]").forEach((btn) => btn.addEventListener("click", () => screenAction(btn)));
}

function screenAction(btn) {
  const act = btn.dataset.act;
  if (act === "quick" || act === "room" || act === "practice") {
    import("./match.js").then((m) => {
      if (act === "quick") m.quickMatchFlow();
      else if (act === "room") m.roomFlow();
      else m.practiceFlow();
    });
  } else if (act === "gallery") openGallery();
  else if (act === "challenges") openChallenges();
  else if (act === "settings") openSettings();
  else if (act === "claim-weekly") {
    const r = game.claimWeekly();
    if (r.ok) { toast("Weekly goal complete", `+${r.coins} coins, +${r.xp} XP`, "trophy"); sound("win"); }
    else toast("Not yet", r.reason || "", "bad");
    refreshAll();
  } else if (act === "daily-reward") {
    const r = game.claimDailyReward();
    if (r.ok) { toast("Daily reward", `+${r.coins} coins · day ${r.streak}`, "good"); sound("win"); closeModal(); refreshAll(); }
    else toast("Already claimed", r.reason || "", "bad");
  } else if (act === "toggle-sound") {
    game.S.settings.sound = !game.S.settings.sound;
    game.saveLocal(true);
    btn.textContent = game.S.settings.sound ? "On" : "Off";
    btn.className = "btn small " + (game.S.settings.sound ? "primary" : "ghost");
  } else if (act === "save-cloud") {
    cloud.saveProfile(game.packProfile()).then(() => toast("Saved", "Your kitchen is in the cloud.", "good")).catch(() => toast("Could not save", "Check your connection.", "bad"));
  } else if (act === "signout") {
    cloud.signOut().then(() => {
      ui.online = false;
      toast("Signed out", "You are baking as a guest now.", "info");
      closeModal();
      refreshAll();
    });
  } else if (act === "open-gate") {
    closeModal();
    if (ui.gateHandler) ui.gateHandler.show(true);
  } else if (act === "guest-name") {
    const name = prompt("What should we call you?", game.S.name === "Guest baker" ? "" : game.S.name);
    if (name && name.trim()) {
      game.S.name = name.trim().slice(0, 20);
      game.saveLocal(true);
      closeModal();
      toast("Nice to meet you", "Hello, " + game.S.name + ".", "good");
      refreshAll();
    }
  } else if (act === "reset") {
    confirmDialog("Reset this device?", "Your guest coins, recipes, cakes and history on this browser will be cleared. Cloud saves are untouched.", "Reset", "Keep it").then((yes) => {
      if (!yes) return;
      game.resetLocal();
      location.reload();
    });
  } else if (act === "refresh-ranks") {
    loadLeaderboard();
    sound("tap");
  }
}

function buyItem(kind, id, btn) {
  if (ui.buying) return;
  ui.buying = true;
  const result = game.buy(kind, id);
  ui.buying = false;
  if (result.ok) {
    sound("good");
    toast("Added to your kitchen", "Paid " + result.price + " coins.", "good");
    renderAll();
    cloud.saveProfile(game.packProfile()).catch(() => {});
  } else {
    sound("bad");
    toast("Cannot buy that", result.reason || "", "bad");
    if (result.reason === "Not enough coins") setTimeout(() => { game.S.coins += 0; }, 0);
  }
}

function equipItem(kind, id, btn) {
  const slot = kind;
  const owned = kind === "skin" ? true : kind === "hat" ? game.S.hats[id] : kind === "apron" ? game.S.aprons[id] : kind === "hair" ? game.S.hairs[id] : kind === "kitchen" ? game.S.kitchens[id] : kind === "oven" ? game.S.equipment[id] : true;
  if (!owned) {
    toast("Not in your wardrobe", "Buy it in the shop first.", "bad");
    return;
  }
  if (kind === "skin") {
    game.S.equipped.skin = Number(id);
    game.saveLocal();
  } else if (!game.equip(slot, id)) {
    toast("Cannot wear that", "Buy it first.", "bad");
    return;
  }
  sound("tap");
  renderAll();
  try { world.placeChef(game.chefCosmetics()); } catch (error) { /* scene may not be ready */ }
  cloud.saveProfile(game.packProfile()).catch(() => {});
}

async function toggleFollow(uid, btn) {
  if (!ui.online) { toast("Sign in first", "Friends need an account.", "bad"); return; }
  btn.disabled = true;
  try {
    const following = ui.friends.following.some((f) => f.to === uid);
    if (following) await cloud.unfollow(uid);
    else await cloud.follow(uid);
    await loadFriends();
    toast(following ? "Unfollowed" : "Following", following ? "They are off your list." : "When they follow back you become friends.", "good");
  } catch (error) {
    toast("Could not do that", error.message || "", "bad");
  } finally { btn.disabled = false; }
}

/* ---------------------------------------------------------------------
   Init
   --------------------------------------------------------------------- */
export function initUI() {
  document.querySelectorAll(".nav-btn").forEach((btn) => btn.addEventListener("click", () => {
    if (ui.match) {
      toast("Bake first", "Finish this match, then you can browse.", "info");
      return;
    }
    setScreen(btn.dataset.nav);
  }));
  $("brand").addEventListener("click", () => {
    if (ui.match) { toast("You are mid-bake", "Finish or leave the match to go back to the lobby.", "info"); return; }
    setScreen("lobby");
  });
  $("btn-daily").addEventListener("click", () => {
    const r = game.claimDailyReward();
    if (r.ok) { toast("Daily reward", `+${r.coins} coins · day ${r.streak} of 7`, "good"); sound("win"); refreshAll(); }
    else openChallenges();
  });
  $("btn-challenges").addEventListener("click", openChallenges);
  $("btn-settings").addEventListener("click", openSettings);
  $("stat-coins").addEventListener("click", () => { if (!ui.match) setScreen("shop"); });
  bindClaims();
}

export function showGateHook(fn) { ui.gateHandler = fn; }

export function renderAll() {
  renderHud();
  renderScreen();
  if (ui.match) import("./match.js").then((m) => m.renderMatch());
}

export function showInviteToast(invite) {
  if (!invite) return;
  toast("Room invitation", `${invite.fromName || "A baker"} invited you to ${invite.code || "a room"}.`, "users");
  openModal(`
    <div class="matchmaking-visual"><div class="mm-ring"><b><svg><use href="#i-users"/></svg></b></div></div>
    <div class="center"><h2>You're invited</h2><p class="sub">${esc(invite.fromName || "A baker")} has a private kitchen open${invite.theme ? " for " + esc(invite.theme) : ""}. Jump in while there is space.</p></div>
    <div class="room-code"><b>${esc(invite.code || "")}</b></div>
    <div class="modal-actions">
      <button class="btn ghost" data-close="1">Later</button>
      <button class="btn primary" id="accept-invite">Join the kitchen</button>
    </div>`);
  $("modals").querySelectorAll("[data-close]").forEach((b) => b.addEventListener("click", closeModal));
  const accept = $("accept-invite");
  if (accept) accept.addEventListener("click", () => {
    closeModal();
    import("./match.js").then((m) => m.joinFromInvite(invite));
  });
}

/* ---------------------------------------------------------------------
   One shared object for both functions and screen state.
   ES module namespaces are read-only, so anything that keeps track of
   "which screen are we on" needs this single mutable `ui` object. Modules
   import it by name (`import { ui } from "./ui.js"`).
   --------------------------------------------------------------------- */
Object.assign(ui, {
  esc, money, timeAgo, sound, toast, openModal, closeModal, isModalOpen, confirmDialog,
  renderHud, refreshAll, refreshHud, setScreen, openChallenges, openGallery, openSettings,
  initUI, showGateHook, renderAll, showInviteToast,
  recipeArt, toppingArt, ingredientArt, plateArt, chefArt, designArt
});
