/* =====================================================================
   LITTLE TOWN — interface
   Shop panels, the object inspector, quests, town statistics, discovery,
   visits, friends, the weekly contest, profile and settings. It talks to
   the simulation through town.js and to the scene through world.js.
   ===================================================================== */
import * as game from "./town.js";
import * as world from "./world.js";
import * as cloud from "./cloud.js";
import { CONFIG } from "./config.js";
import {
  BUILDINGS, DECOR, ROADS, CAT_LABEL, SEASONS, DAILY_POOL, WEEKLY_POOL,
  ACHIEVEMENTS, DEF_BY_ID, ROAD_BY_ID, xpForLevel
} from "./data.js";
import { PAINTS } from "./models.js";
import { thumb, roadThumb, cachedThumb, cachedRoadThumb } from "./thumbs.js";
let thumbToken = 0;

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s === undefined || s === null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const fmt = (n) => Math.round(Number(n) || 0).toLocaleString("en-US");
const money = (n) => '<svg><use href="#i-coin"/></svg>' + fmt(n);
const stars = (n) => "★".repeat(Math.max(0, Math.min(5, Math.round(n || 0)))) + "☆".repeat(Math.max(0, 5 - Math.round(n || 0)));
const rate = (n) => (n >= 0 ? "+" : "−") + fmt(Math.abs(n));
const isMobile = () => window.matchMedia("(max-width: 900px)").matches;
const seasonList = SEASONS;

export const ui = {
  online: false,
  user: null,
  panel: null,
  buildTab: "house",
  decorGroup: "All",
  roadMode: false,
  tool: null,
  selectedId: null,
  hover: null,
  painting: false,
  questTab: "daily",
  discoverTab: "towns",
  towns: [],
  leaders: [],
  weekly: [],
  weekEntry: null,
  weekVote: null,
  following: [],
  followers: [],
  discoverLoaded: false,
  discoverLoading: false,
  townsUnsub: null,
  searchTerm: "",
  loadingSearch: false,
  visit: null,
  modalOpen: false,
  confirmFn: null,
  hintTimer: null,
  syncing: false,
  onlinePanelRefresh: 0,
  hooks: {}
};

/* ---------------------------------------------------------------------
   Boot
   --------------------------------------------------------------------- */
export function initUI(hooks = {}) {
  ui.hooks = hooks;
  bindDock();
  bindHud();
  bindMenu();
  bindPanel();
  bindToolbar();
  bindKeyboard();
  bindModals();
  bindVisitBanner();
  const canvas = $("gl");
  if (canvas) {
    canvas.addEventListener("pointerdown", () => { ui.painting = true; });
    window.addEventListener("pointerup", () => { ui.painting = false; });
  }
  world.world.callbacks.onClick = onWorldClick;
  world.world.callbacks.onHover = onWorldHover;
  world.world.callbacks.onObject = onWorldObject;
  renderHud(game.hudData());
  setOnline(false, null);
  showHint("Drag to look around · right-drag to pan · scroll to zoom · Q/E rotate", 7600);
}

export function setOnline(online, user) {
  const wasOnline = ui.online;
  ui.online = !!online;
  ui.user = user || null;
  if (ui.online && !wasOnline) { ui.discoverLoaded = false; ui.discoverTab = "towns"; }
  const account = $("menu-account");
  if (account) account.textContent = ui.online
    ? `Signed in as ${user ? user.name : "a town mayor"} · your town syncs to every device`
    : "Playing as a guest · this town lives on this device";
  if (ui.panel === "profile" || ui.panel === "discover") renderPanel();
}

export function refreshAll() {
  if (!game.S) return;
  renderHud(game.hudData());
  if ($("menu") && !$("menu").hidden) renderMenuStats();
  if (ui.panel) renderPanel();
}

/* ---------------------------------------------------------------------
   HUD
   --------------------------------------------------------------------- */
function bindHud() {
  $("btn-menu").addEventListener("click", showMenu);
  $("btn-settings").addEventListener("click", openSettings);
  $("btn-townname").addEventListener("click", openRename);
  document.querySelectorAll(".camera-bar button").forEach((b) => b.addEventListener("click", () => {
    const cam = b.dataset.cam;
    if (cam === "turn-left") world.rotateCamera(1);
    else if (cam === "turn-right") world.rotateCamera(-1);
    else world.setCameraMode(cam);
  }));
}
export function renderHud(data) {
  if (!data) return;
  $("hud-coins").textContent = fmt(data.coins);
  $("town-name").textContent = data.name;
  $("hud-pop").textContent = data.population;
  $("hud-cap").textContent = data.capacity;
  $("hud-happiness").textContent = data.happiness;
  $("hud-level").textContent = data.level;
  $("hud-xp").style.width = Math.max(3, Math.min(100, data.xpPct * 100)) + "%";
  $("hud-day").textContent = "Day " + data.day;
  $("hud-day-fill").style.width = Math.min(100, Math.max(0, data.dayProgress * 100)) + "%";
  const hour = 7 + Math.min(1, data.dayProgress) * 15;
  const h = Math.floor(hour), m = Math.floor((hour - h) * 60);
  $("hud-clock").textContent = String(h).padStart(2, "0") + ":" + String(m).padStart(2, "0");
  $("hud-season-icon").textContent = data.season.icon;
  $("hud-season-name").textContent = data.season.name;
  $("hud-season-bonus").textContent = data.season.event + " · " + data.season.bonus;
  $("hud-season").title = data.season.event + " — " + data.season.bonus + " (" + data.seasonDays + " days left)";
  if ($("menu") && !$("menu").hidden) renderMenuStats();
}
function renderMenuStats() {
  if (!game.S) return;
  const h = game.hudData();
  $("menu-stats").innerHTML = `
    <div><b>${fmt(h.coins)}</b><small>coins</small></div>
    <div><b>${h.population}</b><small>residents</small></div>
    <div><b>${h.happiness}%</b><small>happy</small></div>
    <div><b>${h.level}</b><small>level</small></div>`;
  $("menu-town").textContent = h.name;
  $("menu-tip").textContent = game.tip();
}
export function showMenu() {
  closeModal();
  if (ui.tool) cancelTool();
  $("menu").hidden = false;
  renderMenuStats();
}
export function hideMenu() { $("menu").hidden = true; }

/* ---------------------------------------------------------------------
   Menu
   --------------------------------------------------------------------- */
function bindMenu() {
  $("menu-close").addEventListener("click", hideMenu);
  $("menu-play").addEventListener("click", () => {
    hideMenu();
    if (ui.visit) leaveVisit();
    world.setCameraMode("orbit");
  });
  $("menu-build").addEventListener("click", () => { hideMenu(); openPanel("build"); });
  $("menu-quests").addEventListener("click", () => { hideMenu(); openPanel("quests"); });
  $("menu-discover").addEventListener("click", () => { hideMenu(); openPanel("discover"); });
  $("menu-settings").addEventListener("click", () => { hideMenu(); openSettings(); });
}

/* ---------------------------------------------------------------------
   Dock & panel dispatch
   --------------------------------------------------------------------- */
function bindDock() {
  document.querySelectorAll(".dock button").forEach((b) => b.addEventListener("click", () => {
    if (ui.panel === b.dataset.panel) closePanel();
    else openPanel(b.dataset.panel);
  }));
}
export function openPanel(name, keep = false) {
  if (!game.S) return;
  if (name === "build" || name === "roads" || name === "decor" || name === "quests") {
    if (ui.visit) { toast("Visiting", "Return to your own town before building.", "info"); return; }
  }
  if (!keep && name !== "object" && ui.selectedId) clearSelection();
  ui.panel = name;
  $("panel").hidden = false;
  renderPanel();
  document.querySelectorAll(".dock button").forEach((b) => b.classList.toggle("on", b.dataset.panel === name));
  if (isMobile() && name !== "quests" && name !== "stats") { /* keep panel: shops need room to scroll */ }
  if (name === "discover" && !ui.discoverLoaded) loadDiscover();
}
export function closePanel() {
  $("panel").hidden = true;
  ui.panel = null;
  clearSelection();
  document.querySelectorAll(".dock button").forEach((b) => b.classList.remove("on"));
}
function clearSelection() {
  ui.selectedId = null;
  game.runtime.selected = null;
  world.hideSelection();
}
function renderPanel() {
  if (!ui.panel) return;
  if (ui.panel === "build") renderBuildPanel();
  else if (ui.panel === "roads") renderRoadsPanel();
  else if (ui.panel === "decor") renderDecorPanel();
  else if (ui.panel === "quests") renderQuestPanel();
  else if (ui.panel === "stats") renderStatsPanel();
  else if (ui.panel === "discover") renderDiscoverPanel();
  else if (ui.panel === "profile") renderProfilePanel();
  else if (ui.panel === "object") renderObjectPanel();
}

/* ---------------------------------------------------------------------
   Shop panels
   --------------------------------------------------------------------- */
function renderBuildPanel() {
  const tabs = game.buildingCategories();
  const items = game.catalog(ui.buildTab);
  const body = `
    <div class="tabs">${tabs.map((t) => `<button class="${ui.buildTab === t.id ? "on" : ""}" data-buildtab="${t.id}">${t.icon} ${t.name}</button>`).join("")}</div>
    <div class="panel-body">
      <div class="item-grid">${items.map((d) => cardFor(d)).join("")}</div>
    </div>`;
  $("panel").innerHTML = `
    <div class="panel-head">
      <div><h3>Build</h3><p>${BUILDINGS.length} buildings · ${game.metric("buildings")} placed</p></div>
      <div class="spacer"></div><button class="icon-btn" data-action="close"><svg><use href="#i-close"/></svg></button>
    </div>${body}`;
  hydrateThumbs();
}
function renderDecorPanel() {
  const groups = ["All", "Trees", "Flowers", "Street", "Gardens", "Water", "Play", "Landmarks"];
  const items = game.decorCatalog(ui.decorGroup);
  $("panel").innerHTML = `
    <div class="panel-head">
      <div><h3>Decorations</h3><p>${DECOR.length} pieces · trees, gardens, street life</p></div>
      <div class="spacer"></div><button class="icon-btn" data-action="close"><svg><use href="#i-close"/></svg></button>
    </div>
    <div class="tabs">${groups.map((g) => `<button class="${ui.decorGroup === g ? "on" : ""}" data-group="${g}">${g}</button>`).join("")}</div>
    <div class="panel-body"><div class="item-grid">${items.map((d) => cardFor(d)).join("")}</div></div>`;
  hydrateThumbs();
}
function cardFor(d) {
  const locked = game.S.level < d.unlock;
  const afford = game.S.coins >= d.cost;
  const selected = ui.tool && ui.tool.defId === d.id;
  const benefit = d.pop ? `${d.pop} beds` : d.jobs ? `${d.jobs} jobs` : d.income ? `+${d.income}/day` : d.appeal ? `+${d.appeal} appeal` : "";
  const art = cachedThumb(d.id);
  return `<button class="item-card ${locked ? "locked" : ""} ${selected ? "selected" : ""}" data-pick="${d.id}">
    <div class="item-art"${art ? "" : ` data-thumb="b:${d.id}"`}>
      <span class="ribbon">${esc(d.cat === "decor" ? d.group : CAT_LABEL[d.cat])}</span>
      ${art ? `<img class="thumb-img" src="${art}" alt="">` : `<span class="emoji-big">${d.icon}</span>`}
      ${locked ? `<span class="lock-tag"><svg><use href="#i-lock"/></svg>Lv ${d.unlock}</span>` : ""}
    </div>
    <div class="item-main">
      <b>${esc(d.name)}</b>
      <small>${esc(d.desc)}</small>
      <div class="item-foot">${money(d.cost)}${benefit ? `<span class="benefit">${benefit}</span>` : ""}</div>
      ${!locked && d.cat !== "decor" && d.cat !== "community" ? `<span class="needs-road">↳ needs a road by the door</span>` : ""}
    </div>
  </button>`;
}
function renderRoadsPanel() {
  const roads = game.roadCatalog();
  const next = CONFIG.landSteps[game.S.land] || null;
  $("panel").innerHTML = `
    <div class="panel-head">
      <div><h3>Roads & land</h3><p>${game.metric("roads")} tiles laid · ${game.landStep(game.S.land).name}</p></div>
      <div class="spacer"></div><button class="icon-btn" data-action="close"><svg><use href="#i-close"/></svg></button>
    </div>
    <div class="panel-body">
      <div class="item-grid">${roads.map((r) => { const art = cachedRoadThumb(r.id); return `<button class="item-card" data-road="${r.id}">
        <div class="item-art"${art ? "" : ` data-thumb="r:${r.id}"`}><span class="ribbon">${r.kind === "path" ? "Paths" : "Street"}</span>${art ? `<img class="thumb-img" src="${art}" alt="">` : `<span class="emoji-big">${r.icon}</span>`}</div>
        <div class="item-main"><b>${esc(r.name)}</b><small>${esc(r.desc)}</small>
        <div class="item-foot">${money(r.cost)}${game.S.level < r.unlock ? `<span class="lock-tag" style="position:static"><svg><use href="#i-lock"/></svg>Lv ${r.unlock}</span>` : ""}</div></div>
      </button>`; }).join("")}</div>
      <div style="height:10px"></div>
      <button class="btn danger wide" data-action="erase-roads"><svg><use href="#i-trash"/></svg> Remove roads</button>
      <div class="divider"></div>
      <div class="land-up">
        <div style="font-size:26px">🗺️</div>
        <div class="grow"><b>${next ? esc(next.name) : "The whole valley"}</b>
        <small>${next ? `Unlock more land and the river bank for ${fmt(next.cost)} coins.` : "Every corner of the valley is yours."}</small></div>
        ${next ? `<button class="btn tiny primary" data-buyland>${money(next.cost).replace("<svg><use href=\"#i-coin\"/></svg>", "")}</button>` : ""}
      </div>
      <p class="small muted" style="margin-top:10px">Streets auto-curve into corners, T-junctions and crossings. Only bridges can span the river.</p>
    </div>`;
  hydrateThumbs();
}

function hydrateThumbs() {
  const token = ++thumbToken;
  const nodes = [...document.querySelectorAll("#panel [data-thumb]")];
  let index = 0;
  const step = () => {
    if (token !== thumbToken) return;
    const node = nodes[index++];
    if (!node || !node.isConnected) {
      if (index < nodes.length) setTimeout(step, 30);
      return;
    }
    const [kind, id] = String(node.dataset.thumb || "").split(":");
    const src = kind === "r" ? roadThumb(id) : thumb(id);
    if (src && node.isConnected) {
      const img = document.createElement("img");
      img.className = "thumb-img";
      img.alt = "";
      img.src = src;
      const emoji = node.querySelector(".emoji-big");
      if (emoji) emoji.replaceWith(img); else node.appendChild(img);
    }
    if (index < nodes.length) setTimeout(step, 45);
  };
  setTimeout(step, 80);
}
function renderQuestPanel() {
  const daily = game.dailyQuests(), weekly = game.weeklyQuests(), seasonQ = game.seasonalQuest();
  const ach = game.achievements();
  const tabs = [["daily", "Daily"], ["weekly", "Weekly"], ["season", "Season"], ["achievements", "Achievements"]];
  let content = "";
  if (ui.questTab === "daily") {
    content = `<div class="quest-hero"><b>Daily quests</b><p>Three small jobs for today. Reset at midnight (${daily.filter((q) => q.claimed).length}/3 claimed).</p></div>
      ${daily.map((q) => questCard(q, "daily")).join("")}`;
  } else if (ui.questTab === "weekly") {
    content = `<div class="quest-hero"><b>Weekly challenge</b><p>Bigger goals for the whole week. Resets on Monday (${weekly.filter((q) => q.claimed).length}/3 claimed).</p></div>
      ${weekly.map((q) => questCard(q, "weekly")).join("")}`;
  } else if (ui.questTab === "season") {
    content = `<div class="quest-hero"><b>${seasonQ.season.icon} ${esc(seasonQ.title)}</b><p>${esc(seasonQ.season.bonus)}. ${game.seasonDaysLeft()} days left in ${esc(seasonQ.season.name)}.</p></div>
      ${questCard(seasonQ, "season")}`;
  } else {
    content = `<div class="ach-grid">${ach.map((a) => `<div class="ach-card ${a.unlocked ? "on" : ""}">
      <span class="medal">${a.unlocked ? "🏅" : "🔒"}</span>
      <b>${esc(a.name)}</b><small>${esc(a.desc)}</small>
      <div class="mini-bar"><i style="width:${Math.min(100, a.progress / a.need * 100)}%"></i></div>
    </div>`).join("")}</div>`;
  }
  $("panel").innerHTML = `
    <div class="panel-head">
      <div><h3>Quests</h3><p>${daily.filter((q) => q.claimed).length + weekly.filter((q) => q.claimed).length} claimed · ${ach.filter((a) => a.unlocked).length}/${ach.length} achievements</p></div>
      <div class="spacer"></div><button class="icon-btn" data-action="close"><svg><use href="#i-close"/></svg></button>
    </div>
    <div class="tabs">${tabs.map(([id, label]) => `<button class="${ui.questTab === id ? "on" : ""}" data-questtab="${id}">${label}</button>`).join("")}</div>
    <div class="panel-body">${content}</div>`;
}
function questCard(q, scope) {
  const pct = Math.min(100, (q.progress / q.need) * 100);
  return `<div class="quest-card ${q.done ? "done" : ""} ${q.claimed ? "claimed" : ""}">
    <div class="quest-top"><div class="grow"><b>${esc(q.text)}</b><small>${q.claimed ? "Claimed" : q.done ? "Ready to claim" : `${Math.floor(q.progress)} / ${q.need}`}</small></div>
    ${q.claimed ? `<span class="pillchip"><svg><use href="#i-check"/></svg>Done</span>` : `<button class="btn tiny ${q.done ? "teal" : ""}" data-claim-scope="${scope}" data-claim-id="${q.id}" ${q.done ? "" : "disabled"}>Claim</button>`}</div>
    <div class="qbar ${q.done ? "full" : ""}"><i style="width:${pct}%"></i></div>
    <div class="quest-reward">${money(q.coins)}<span class="xp">+${q.xp} XP</span></div>
  </div>`;
}

/* ---------------------------------------------------------------------
   Stats
   --------------------------------------------------------------------- */
function renderStatsPanel() {
  const h = game.hudData();
  const eco = game.economy();
  const next = CONFIG.landSteps[game.S.land] || null;
  const counts = game.buildingCategories().map((c) => [c.name, game.S.objects.filter((o) => {
    const d = game.defOf(o.type);
    return d && d.cat === c.id;
  }).length]);
  const history = game.S.history.slice(0, 6);
  $("panel").innerHTML = `
    <div class="panel-head">
      <div><h3>Town statistics</h3><p>${esc(h.name)} · Town level ${h.townLevel} · ${stars(h.rating)}</p></div>
      <div class="spacer"></div><button class="icon-btn" data-action="close"><svg><use href="#i-close"/></svg></button>
    </div>
    <div class="panel-body">
      <div class="stat-grid">
        <div class="stat-box"><small>Residents</small><b>${h.population}</b><span class="sub">of ${h.capacity} beds</span></div>
        <div class="stat-box"><small>Happiness</small><b>${h.happiness}%</b><span class="sub">${h.happiness >= 75 ? "very happy" : h.happiness >= 55 ? "content" : "needs care"}</span></div>
        <div class="stat-box"><small>Jobs</small><b>${h.jobs}</b><span class="sub">${Math.round(h.employment * 100)}% employed</span></div>
        <div class="stat-box"><small>Buildings</small><b>${h.buildings}</b><span class="sub">${h.buildings === 1 ? "building" : "buildings"} · ${h.roads} road tiles</span></div>
      </div>
      <div class="income-box">
        <div><small>Income / day</small><b class="up">${money(Math.round(eco.incomePerDay))}</b></div>
        <div><small>Upkeep / day</small><b class="down">${money(Math.round(eco.expensePerDay))}</b></div>
      </div>
      <div class="bar-row"><div class="label"><span>Happiness</span><span>${h.happiness}%</span></div><div class="track gold"><i style="width:${h.happiness}%"></i></div></div>
      <div class="bar-row"><div class="label"><span>Housing filled</span><span>${h.capacity ? Math.round(h.population / h.capacity * 100) : 0}%</span></div><div class="track"><i style="width:${h.capacity ? Math.min(100, h.population / h.capacity * 100) : 0}%"></i></div></div>
      <div class="bar-row"><div class="label"><span>Employment</span><span>${Math.round(h.employment * 100)}%</span></div><div class="track rose"><i style="width:${h.employment * 100}%"></i></div></div>
      <div class="tagline">${counts.map(([n, c]) => `<span>${n}: ${c}</span>`).join("")}<span>Decor: ${game.metric("decor")}</span></div>
      <div class="divider"></div>
      <p class="eyebrow">Recent days</p>
      ${history.length ? history.map((r) => `<div class="history-row"><span class="day">D${r.day}</span><span class="grow">${r.population} residents · ${r.happiness}% happy</span><span class="inc">+${fmt(r.income)}</span><span class="exp">−${fmt(r.expense)}</span></div>`).join("") : `<p class="small muted">Finish a day to see the ledger. A town day lasts about ${Math.round(CONFIG.dayLength / 60)} minutes.</p>`}
      <div class="divider"></div>
      <div class="land-up">
        <div style="font-size:26px">🌳</div>
        <div class="grow"><b>${next ? esc(next.name) : "The whole valley"}</b>
        <small>${next ? `Next expansion: ${fmt(next.cost)} coins.` : "No more land to unlock."}</small></div>
        ${next ? `<button class="btn tiny primary" data-buyland>Expand</button>` : ""}
      </div>
      <p class="small muted" style="margin-top:10px">Homes give beds. Shops give jobs and daily income. Parks, gardens and fountains raise happiness. Schools and services make the whole town happier.</p>
    </div>`;
}

/* ---------------------------------------------------------------------
   Discover
   --------------------------------------------------------------------- */
async function loadDiscover() {
  if (!game.S) return;
  if (!ui.online) { ui.discoverLoaded = true; renderPanel(); return; }
  if (ui.discoverLoading) return;
  ui.discoverLoading = true;
  if (ui.panel === "discover") renderPanel();
  try {
    const [towns, leaders, weekly, following, followers, entry, vote] = await Promise.all([
      cloud.fetchTowns(), cloud.fetchLeaderboard(), cloud.fetchWeekly(game.weekKey()),
      cloud.following(), cloud.followers(), cloud.myWeeklyEntry(game.weekKey()), cloud.myWeeklyVote(game.weekKey())
    ]);
    ui.towns = towns || [];
    ui.leaders = leaders || [];
    ui.weekly = weekly || [];
    ui.following = following || [];
    ui.followers = followers || [];
    ui.weekEntry = entry || null;
    ui.weekVote = vote || null;
  } catch (error) { toast("Discover", "The town board could not be reached.", "bad"); }
  ui.discoverLoading = false;
  ui.discoverLoaded = true;
  if (!ui.townsUnsub) {
    ui.townsUnsub = cloud.subscribeTowns((rows) => {
      ui.towns = rows || [];
      if (ui.panel === "discover" && ui.discoverTab === "towns") renderPanel();
    });
  }
  if (ui.panel === "discover") renderPanel();
}
function renderDiscoverPanel() {
  const tabs = [["towns", "Towns"], ["leaders", "Leaderboard"], ["weekly", "Weekly"], ["friends", "Friends"]];
  let body = "";
  if (!ui.online) {
    body = `<div class="empty"><b>Meet the neighbours</b>Sign in to discover real towns, visit other mayors, leave likes and enter the weekly contest.<br><br><button class="btn primary" data-action="signin">Sign in or create an account</button></div>`;
  } else if (!ui.discoverLoaded || ui.discoverLoading) {
    body = `<div class="empty"><b>Looking down the lane…</b>Fetching published towns from the town board.</div>`;
  } else if (ui.discoverTab === "towns") {
    body = `${discoverSearch()}<div class="town-list">${ui.towns.length ? ui.towns.map(townCard).join("") : `<div class="empty"><b>No towns published yet</b>Be the first: open your profile and publish your town.</div>`}</div>`;
  } else if (ui.discoverTab === "leaders") {
    body = `${ui.leaders.length ? `<div class="leader-head"><span>#</span><span>Mayor & town</span><span>Residents</span><span>Lvl</span></div>${ui.leaders.map((t, i) => `<div class="leader-row"><span class="rank">${i + 1}</span><span><b>${esc(t.name || "A town")}</b><small>${esc(t.owner || "Mayor")}</small></span><span class="num">${fmt(t.residents || 0)}</span><span class="num">${t.level || 1}</span></div>`).join("")}` : `<div class="empty"><b>The board is quiet</b>Publish a town and climb the leaderboard.</div>`}`;
  } else if (ui.discoverTab === "weekly") {
    body = renderWeekly();
  } else {
    body = renderFriends();
  }
  $("panel").innerHTML = `
    <div class="panel-head">
      <div><h3>Discover</h3><p>${ui.online ? "Real towns from other mayors" : "Sign in to meet other mayors"}</p></div>
      <div class="spacer"></div><button class="icon-btn" data-action="close"><svg><use href="#i-close"/></svg></button>
    </div>
    <div class="tabs">${tabs.map(([id, label]) => `<button class="${ui.discoverTab === id ? "on" : ""}" data-discovertab="${id}">${label}</button>`).join("")}</div>
    <div class="panel-body">${body}</div>`;
}
function discoverSearch() {
  return `<div style="display:flex;gap:6px;margin-bottom:9px">
    <input id="town-search" value="${esc(ui.searchTerm)}" placeholder="Search town names" style="flex:1;border:1px solid var(--line);border-radius:10px;padding:8px 10px;font:inherit;font-size:12px;background:#fffdf7">
    <button class="btn tiny teal" data-town-search>Search</button>
    ${ui.searchTerm ? `<button class="btn tiny ghost" data-town-clear>Clear</button>` : ""}
  </div>`;
}
function townCard(t) {
  const likes = Number(t.likes) || 0;
  return `<div class="town-card">
    <div class="town-badge">${esc((t.name || "T").slice(0, 1).toUpperCase())}</div>
    <div class="grow"><b>${esc(t.name || "A town")}</b><small>by ${esc(t.owner || "a mayor")} · Lv ${t.level || 1} · ${fmt(t.residents || 0)} residents · ♥ ${likes}</small></div>
    <div class="town-actions">
      <button class="btn tiny primary" data-visit="${esc(t.uid || t.id)}">Visit</button>
      <button class="like-btn" data-like="${esc(t.uid || t.id)}"><svg><use href="#i-heart"/></svg>${likes}</button>
      ${ui.online && (t.uid || t.id) !== (ui.user && ui.user.uid) ? `<button class="btn tiny ghost" data-follow="${esc(t.uid || t.id)}">Follow</button>` : ""}
    </div>
  </div>`;
}
function renderWeekly() {
  const own = ui.weekEntry;
  return `<div class="weekly-card">
    <p class="eyebrow">This week's town competition</p>
    <b style="font-family:var(--display);font-size:17px">Show the town board your best lane</b>
    <p class="small muted" style="margin:4px 0 9px">${own ? `Your entry is in with ${own.votes || 0} votes.` : "Submit your saved town once. Other mayors can visit and vote for it."}</p>
    <button class="btn small teal" data-week-submit>${own ? "Update my entry" : "Enter this week's contest"}</button>
  </div>
  ${ui.weekly.length ? ui.weekly.map((e, i) => `<div class="weekly-card" style="display:flex;gap:10px;align-items:center">
    <span class="rank">${i + 1}</span>
    <div class="grow"><b style="font-size:13px">${esc(e.name || "A town")}</b><small class="muted" style="display:block;font-size:10.5px">${esc(e.owner || "Mayor")} · ${fmt(e.votes || 0)} votes · ${fmt(e.residents || 0)} residents</small></div>
    <button class="btn tiny" data-visit="${esc(e.uid)}">Visit</button>
    <button class="btn tiny ${ui.weekVote === e.uid ? "" : "primary"}" data-vote="${esc(e.uid)}" ${ui.weekVote ? "disabled" : ""}>${ui.weekVote === e.uid ? "Voted" : "Vote"}</button>
  </div>`).join("") : `<div class="empty"><b>No entries yet</b>Be the first town on this week's board.</div>`}`;
}
function renderFriends() {
  return `<p class="eyebrow">Mayors you follow</p>
    ${ui.following.length ? ui.following.map((f) => `<div class="friend-row"><div class="friend-av">${esc((f.name || "M").slice(0, 1).toUpperCase())}</div><div class="grow"><b>${esc(f.name || "A mayor")}</b><small>Following</small></div><button class="btn tiny" data-unfollow="${esc(f.to)}">Unfollow</button></div>`).join("") : `<p class="small muted">No one followed yet. Use the Follow buttons on town cards.</p>`}
    <div class="divider"></div>
    <p class="eyebrow">Following you</p>
    ${ui.followers.length ? ui.followers.map((f) => `<div class="friend-row"><div class="friend-av">${esc((f.name || "M").slice(0, 1).toUpperCase())}</div><div class="grow"><b>${esc(f.name || "A mayor")}</b><small>Follows your town</small></div><button class="btn tiny" data-follow="${esc(f.from)}">Follow back</button></div>`).join("") : `<p class="small muted">No followers yet. Publish your town and share it with other mayors.</p>`}
    <div class="divider"></div>
    <button class="btn soft wide" data-town-search>Find mayors in Towns</button>`;
}

/* ---------------------------------------------------------------------
   Profile
   --------------------------------------------------------------------- */
function renderProfilePanel() {
  const h = game.hudData();
  const ach = game.achievements();
  const done = ach.filter((a) => a.unlocked).length;
  const name = ui.online && ui.user ? ui.user.name : "Guest mayor";
  $("panel").innerHTML = `
    <div class="panel-head">
      <div><h3>Profile</h3><p>${ui.online ? "Signed in" : "Local guest town"}</p></div>
      <div class="spacer"></div><button class="icon-btn" data-action="close"><svg><use href="#i-close"/></svg></button>
    </div>
    <div class="panel-body">
      <div class="profile-head"><div class="profile-av">${esc(name.slice(0, 1).toUpperCase())}</div><div><b>${esc(name)}</b><small>Level ${h.level} · ${esc(h.name)}</small></div></div>
      <div class="stat-grid">
        <div class="stat-box"><small>Residents</small><b>${h.population}</b><span class="sub">${h.capacity} beds</span></div>
        <div class="stat-box"><small>Happiness</small><b>${h.happiness}%</b><span class="sub">${stars(h.rating)}</span></div>
        <div class="stat-box"><small>Town level</small><b>${h.townLevel}</b><span class="sub">${h.buildings} buildings</span></div>
        <div class="stat-box"><small>Likes</small><b>${h.likes}</b><span class="sub">${done} achievements</span></div>
      </div>
      <p class="eyebrow">About your town</p>
      <p class="small muted" style="line-height:1.5">${esc(game.S.name)} has ${h.population} neighbours, ${h.roads} road tiles and ${game.metric("decor")} decorations. ${ui.online ? "Your town is saved to the cloud and published for other mayors to visit." : "Guest towns are saved on this device. Sign in to keep it everywhere and publish it."}</p>
      <div class="action-grid">
        ${ui.online ? `<button class="btn soft" data-action="sync"><svg><use href="#i-save"/></svg> Sync now</button>` : `<button class="btn primary" data-action="signin"><svg><use href="#i-user"/></svg> Sign in</button>`}
        <button class="btn soft" data-action="discover"><svg><use href="#i-globe"/></svg> Discover</button>
        <button class="btn soft wide" data-action="quests"><svg><use href="#i-quest"/></svg> Quests & achievements</button>
        ${ui.online ? `<button class="btn ghost" data-action="signout">Sign out</button>` : ""}
      </div>
      <div class="divider"></div>
      <p class="eyebrow">Recent achievements</p>
      <div class="ach-grid">${ach.filter((a) => a.unlocked).slice(0, 4).map((a) => `<div class="ach-card on"><span class="medal">🏅</span><b>${esc(a.name)}</b><small>${esc(a.desc)}</small></div>`).join("") || `<p class="small muted">No achievements yet — build your first house.</p>`}</div>
      <div class="divider"></div>
      <button class="btn ghost wide" data-action="settings"><svg><use href="#i-gear"/></svg> Settings</button>
    </div>`;
}

/* ---------------------------------------------------------------------
   Object inspector
   --------------------------------------------------------------------- */
function selectObject(obj) {
  if (!obj || !game.S) return;
  ui.selectedId = obj.id;
  game.runtime.selected = obj.id;
  world.setSelected(obj);
  ui.panel = "object";
  $("panel").hidden = false;
  renderObjectPanel();
  document.querySelectorAll(".dock button").forEach((b) => b.classList.remove("on"));
}
function renderObjectPanel() {
  const obj = game.S.objects.find((o) => o.id === ui.selectedId);
  if (!obj) { closePanel(); return; }
  const def = game.defOf(obj.type);
  if (!def) { closePanel(); return; }
  const active = game.objectActive(obj);
  const road = game.hasRoadAccess(obj);
  const upCost = game.upgradeCost(obj);
  const isDecor = def.cat === "decor";
  const tags = [];
  if (def.pop) tags.push(`${def.pop} beds`);
  if (def.jobs) tags.push(`${def.jobs} jobs`);
  if (def.income) tags.push(`+${def.income} coins/day`);
  if (def.appeal) tags.push(`+${def.appeal} appeal`);
  if (def.upkeep) tags.push(`${def.upkeep} upkeep/day`);
  const swatches = PAINTS.slice(0, 8).map((c, i) => `<button class="swatch ${obj.variant % 8 === i ? "on" : ""}" style="background:${c}" data-action="paint" data-variant="${i}" title="Paint ${i + 1}"></button>`).join("");
  const objArt = thumb(def.id);
  $("panel").innerHTML = `
    <div class="panel-head">
      <div class="obj-head"><div class="obj-ico">${objArt ? `<img class="obj-thumb" src="${objArt}" alt="">` : def.icon}</div><div><h3>${esc(def.name)}</h3><p>${esc(isDecor ? def.group : CAT_LABEL[def.cat])} · level ${obj.level} · ${'●'.repeat(obj.level)}${'○'.repeat(Math.max(0, 3 - obj.level))}</p></div></div>
      <div class="spacer"></div><button class="icon-btn" data-action="close"><svg><use href="#i-close"/></svg></button>
    </div>
    <div class="panel-body">
      <div class="tagline">${tags.map((t) => `<span>${t}</span>`).join("")}</div>
      <p class="small muted" style="line-height:1.5">${esc(def.desc)}</p>
      ${!road ? `<p class="small" style="background:#fbe9df;border:1px solid #f0d0bf;border-radius:10px;padding:8px 10px;color:#9a533a;line-height:1.4"><b>No road access.</b> Put a street beside the door so residents can use this building.</p>` : active ? `<p class="small" style="background:#edf4e5;border:1px solid #d3e0c7;border-radius:10px;padding:8px 10px;color:#557049">Connected to the street and working.</p>` : ""}
      <p class="eyebrow" style="margin-top:12px">Paint</p>
      <div class="swatches">${swatches}</div>
      ${!isDecor ? `<div class="rowline"><div class="grow"><b>Upgrade to level ${obj.level + 1}</b><small>${obj.level >= 3 ? "Fully upgraded" : `Add a floor, flower boxes and more income · ${fmt(upCost)} coins`}</small></div>${obj.level < 3 ? `<button class="btn tiny primary" data-action="upgrade">${money(upCost)}</button>` : `<span class="pillchip">Max</span>`}</div>` : ""}
      <div class="action-grid">
        <button class="btn soft" data-action="rotate"><svg><use href="#i-rotate"/></svg> Rotate</button>
        <button class="btn soft" data-action="move"><svg><use href="#i-move"/></svg> Move</button>
        <button class="btn soft" data-action="focus"><svg><use href="#i-camera"/></svg> Look</button>
        <button class="btn danger" data-action="remove"><svg><use href="#i-trash"/></svg> Remove</button>
      </div>
      <p class="small muted" style="margin-top:10px">Rotate with <b>R</b>, move with <b>M</b>, remove with <b>Delete</b>.</p>
    </div>`;
}

/* ---------------------------------------------------------------------
   Build tools
   --------------------------------------------------------------------- */
function startPlace(def) {
  if (ui.visit) { toast("Visiting", "Leave this town before building.", "info"); return; }
  if (!def) return;
  if (game.S.level < def.unlock) { toast("Locked", `${def.name} unlocks at level ${def.unlock}.`, "info"); return; }
  ui.tool = { kind: "place", defId: def.id, rot: 0 };
  game.runtime.tool = ui.tool;
  world.setTool(ui.tool);
  showToolbar(true, true);
  setToolHint(`Click to place ${def.name} · R rotates · Esc cancels`);
  if (ui.hover) onWorldHover(ui.hover);
  if (isMobile()) closePanelKeepTool();
  renderHud(game.hudData());
}
function startRoad(road) {
  if (ui.visit) { toast("Visiting", "Leave this town before laying roads.", "info"); return; }
  if (game.S.level < road.unlock) { toast("Locked", `${road.name} unlocks at level ${road.unlock}.`, "info"); return; }
  ui.tool = { kind: "road", roadId: road.id };
  game.runtime.tool = ui.tool;
  world.setTool(ui.tool);
  showToolbar(true, false);
  setToolHint(`Click or drag to lay ${road.name} · Esc cancels`);
  if (ui.hover) onWorldHover(ui.hover);
  if (isMobile()) closePanelKeepTool();
}
function startEraseRoads() {
  ui.tool = { kind: "erase-road" };
  game.runtime.tool = ui.tool;
  world.setTool(ui.tool);
  showToolbar(true, false);
  setToolHint("Click a road tile to remove it · Esc cancels");
  closePanelKeepTool();
}
function startMove(obj) {
  if (!obj) return;
  ui.tool = { kind: "move", id: obj.id, rot: obj.rot };
  game.runtime.tool = ui.tool;
  world.setTool(ui.tool);
  showToolbar(true, true);
  setToolHint("Click a new spot · R rotates · Esc cancels");
  closePanelKeepTool();
  hideSelectionForTool(obj);
}
function hideSelectionForTool(obj) {
  ui.selectedId = obj.id;
  world.setSelected(obj);
  if (isMobile()) $("panel").hidden = true;
}
function eraseObject(obj) {
  if (!obj) return;
  pendingConfirm("Remove building?", `Remove ${game.defOf(obj.type).name}? You get 35% of its value back.`, "Remove", () => {
    const res = game.removeObject(obj.id);
    if (res.ok) {
      world.removeObjectMesh(obj.id);
      clearSelection();
      closePanel();
      renderHud(game.hudData());
      toast("Removed", `${res.refund} coins returned.`, "info");
    }
  });
}
function cancelTool() {
  ui.tool = null;
  game.runtime.tool = null;
  world.setTool(null);
  world.clearGhost();
  showToolbar(false);
  hideHint();
  renderHud(game.hudData());
}
function closePanelKeepTool() {
  $("panel").hidden = true;
  ui.panel = null;
  document.querySelectorAll(".dock button").forEach((b) => b.classList.remove("on"));
}
function showToolbar(show, rotate) {
  const bar = $("toolbar");
  bar.hidden = !show;
  document.body.classList.toggle("tooling", !!show);
  $("tool-rotate").hidden = !rotate;
  const moveBtn = $("tool-move");
  if (moveBtn) moveBtn.hidden = true;
}
function bindToolbar() {
  $("tool-rotate").addEventListener("click", () => {
    if (ui.tool && (ui.tool.kind === "place" || ui.tool.kind === "move")) {
      ui.tool.rot = (ui.tool.rot + 1) % 4;
      if (ui.hover) onWorldHover(ui.hover);
    }
  });
  $("tool-cancel").addEventListener("click", cancelTool);
  $("tool-move").addEventListener("click", () => cancelTool());
}

/* ---------------------------------------------------------------------
   World input
   --------------------------------------------------------------------- */
function tileForTool(tile) {
  if (!ui.tool || !tile) return null;
  const def = ui.tool.defId ? game.defOf(ui.tool.defId) : null;
  if (!def) return tile;
  const [w, d] = game.dims(def, ui.tool.rot);
  return { i: tile.i - Math.floor(w / 2), j: tile.j - Math.floor(d / 2), raw: tile };
}
function onWorldHover(tile) {
  ui.hover = tile;
  if (!tile || !game.S) return;
  if (ui.visit) { world.clearGhost(); return; }
  const tool = ui.tool;
  if (!tool) { world.clearGhost(); return; }
  if (tool.kind === "place") {
    const def = game.defOf(tool.defId);
    const pos = tileForTool(tile);
    if (!def || !pos) return;
    const check = game.canPlace(def, pos.i, pos.j, tool.rot);
    const afford = game.S.coins >= def.cost && game.S.level >= def.unlock;
    world.setGhost(def, pos.i, pos.j, tool.rot, check.ok && afford);
  } else if (tool.kind === "road") {
    const road = game.roadDef(tool.roadId);
    const check = game.canPlaceRoad(tool.roadId, tile.i, tile.j);
    world.setRoadGhost(tool.roadId, tile.i, tile.j, check.ok && game.S.coins >= (road ? road.cost : 0));
    if (ui.painting) layRoadAt(tile);
  } else if (tool.kind === "erase-road") {
    world.clearGhost();
    if (ui.painting) eraseRoadAt(tile);
  } else if (tool.kind === "move") {
    const obj = game.S.objects.find((o) => o.id === tool.id);
    const def = obj ? game.defOf(obj.type) : null;
    if (!obj || !def) return;
    const pos = tileForTool(tile);
    const check = game.canPlace(def, pos.i, pos.j, tool.rot, obj.id);
    world.setGhost(def, pos.i, pos.j, tool.rot, check.ok);
  }
}
function onWorldClick(tile) {
  if (!tile || !game.S) return;
  if (ui.visit) { toast("Visiting another town", "Only the owner can build here.", "info"); return; }
  const tool = ui.tool;
  if (!tool) {
    closePanel();
    ui.selectedId = null;
    world.hideSelection();
    return;
  }
  if (tool.kind === "place") {
    const def = game.defOf(tool.defId);
    const pos = tileForTool(tile);
    if (!def) return;
    if (game.S.coins < def.cost) { toast("Not enough coins", "Try a smaller building or earn a little more.", "bad"); return; }
    const res = game.placeObject(def.id, pos.i, pos.j, tool.rot);
    if (!res.ok) { toast("Cannot build there", res.reason, "bad"); return; }
    world.addObjectMesh(res.object);
    renderHud(game.hudData());
    if (!game.hasRoadAccess(res.object)) showHint("No road by the door yet — this building will wait for a street.", 3400);
    if (ui.hover) onWorldHover(ui.hover);
    flashPlace(res.object);
  } else if (tool.kind === "road") {
    layRoadAt(tile);
  } else if (tool.kind === "erase-road") {
    eraseRoadAt(tile);
  } else if (tool.kind === "move") {
    const obj = game.S.objects.find((o) => o.id === tool.id);
    if (!obj) return cancelTool();
    const pos = tileForTool(tile);
    const res = game.moveObject(obj.id, pos.i, pos.j, tool.rot);
    if (!res.ok) { toast("Cannot move there", res.reason, "bad"); return; }
    world.refreshLayout();
    ui.tool = null; game.runtime.tool = null; world.setTool(null); showToolbar(false); hideHint();
    const moved = game.S.objects.find((o) => o.id === obj.id);
    selectObject(moved);
    toast("Moved", "The building is in its new spot.", "good");
  } else if (tool.kind === "erase") {
    const at = game.objectMap().get(tile.i + "," + tile.j);
    if (at) eraseObject(at);
  }
}
function layRoadAt(tile) {
  const tool = ui.tool;
  if (!tool || tool.kind !== "road") return;
  const road = game.roadDef(tool.roadId);
  if (!road) return;
  if (game.S.level < road.unlock) return;
  const res = game.setRoad(tool.roadId, tile.i, tile.j);
  if (res.ok && !res.unchanged) {
    world.syncRoads(game.S.roads, game.S.roadsRev);
    renderHud(game.hudData());
  } else if (res.ok === false && !ui.painting) toast("Cannot place road", res.reason, "bad");
}
function eraseRoadAt(tile) {
  const res = game.removeRoad(tile.i, tile.j);
  if (res.ok) { world.syncRoads(game.S.roads, game.S.roadsRev); renderHud(game.hudData()); }
}
function onWorldObject(obj) {
  if (!obj) return;
  if (ui.visit) { toast("Visiting", "Only the owner can change this town.", "info"); return; }
  const tool = ui.tool;
  if (tool && tool.kind === "erase") { eraseObject(obj); return; }
  if (tool && tool.kind === "move") return;
  if (tool) return;
  selectObject(obj);
}
function flashPlace(obj) {
  const mesh = world.world.scene && world.world.scene.children;
  void mesh;
  if (!obj) return;
  // A short golden pulse is enough feedback without extra geometry.
  const ring = document.createElement("div");
  ring.className = "toast good";
  ring.innerHTML = `<span class="dot"></span><span>${esc(game.defOf(obj.type).name)} placed</span>`;
  ring.style.position = "fixed";
  ring.style.left = "50%";
  ring.style.bottom = "148px";
  ring.style.transform = "translateX(-50%)";
  ring.style.zIndex = "25";
  ring.style.pointerEvents = "none";
  document.body.appendChild(ring);
  setTimeout(() => ring.remove(), 1400);
}

/* ---------------------------------------------------------------------
   Panel click actions
   --------------------------------------------------------------------- */
function bindPanel() {
  $("panel").addEventListener("click", (event) => {
    const pick = event.target.closest("[data-pick]");
    if (pick) {
      const def = game.defOf(pick.dataset.pick);
      if (def) startPlace(def);
      return;
    }
    const road = event.target.closest("[data-road]");
    if (road) {
      const r = game.roadDef(road.dataset.road);
      if (r) startRoad(r);
      return;
    }
    const tab = event.target.closest("[data-buildtab]");
    if (tab) { ui.buildTab = tab.dataset.buildtab; renderBuildPanel(); return; }
    const group = event.target.closest("[data-group]");
    if (group) { ui.decorGroup = group.dataset.group; renderDecorPanel(); return; }
    const qtab = event.target.closest("[data-questtab]");
    if (qtab) { ui.questTab = qtab.dataset.questtab; renderQuestPanel(); return; }
    const dtab = event.target.closest("[data-discovertab]");
    if (dtab) {
      ui.discoverTab = dtab.dataset.discovertab;
      if (ui.discoverTab === "weekly") refreshWeekly().then(() => renderPanel());
      renderPanel();
      return;
    }
    const claim = event.target.closest("[data-claim-scope]");
    if (claim) {
      const res = game.claimQuest(claim.dataset.claimScope, claim.dataset.claimId);
      if (!res.ok) toast("Quest", res.reason || "Not ready yet.", "info");
      renderHud(game.hudData());
      renderPanel();
      return;
    }
    if (event.target.closest("[data-buyland]")) {
      const res = game.expandLand();
      if (!res.ok) toast("Land", res.reason, "info");
      else { world.updateLand(res.land); toast("Land unlocked", "The town has room to grow.", "good"); renderHud(game.hudData()); }
      renderPanel();
      return;
    }
    const visit = event.target.closest("[data-visit]");
    if (visit) { visitByUid(visit.dataset.visit); return; }
    const like = event.target.closest("[data-like]");
    if (like) { likeTown(like.dataset.like); return; }
    const follow = event.target.closest("[data-follow]");
    if (follow) { followMayor(follow.dataset.follow); return; }
    const unfollow = event.target.closest("[data-unfollow]");
    if (unfollow) { unfollowMayor(unfollow.dataset.unfollow); return; }
    const vote = event.target.closest("[data-vote]");
    if (vote) { voteEntry(vote.dataset.vote); return; }
    if (event.target.closest("[data-week-submit]")) { submitWeekly(); return; }
    if (event.target.closest("[data-town-search]")) { searchTowns(); return; }
    if (event.target.closest("[data-town-clear]")) { ui.searchTerm = ""; reloadDiscover(); return; }
    if (event.target.closest("[data-action]")) { panelAction(event.target.closest("[data-action]")); return; }
  });
  $("panel").addEventListener("keydown", (event) => {
    if (event.key === "Enter" && event.target.id === "town-search") { ui.searchTerm = event.target.value; searchTowns(); }
  });
}
function panelAction(el) {
  const action = el.dataset.action;
  if (action === "close") { closeModal(); closePanel(); if (ui.tool) cancelTool(); return; }
  if (action === "signin") { ui.hooks.showGate && ui.hooks.showGate(); return; }
  if (action === "signout") { ui.hooks.signOut && ui.hooks.signOut(); return; }
  if (action === "sync") { ui.hooks.syncNow && ui.hooks.syncNow(); toast("Saving", "Your town is being synced.", "info"); return; }
  if (action === "discover") { openPanel("discover"); return; }
  if (action === "quests") { openPanel("quests"); return; }
  if (action === "settings") { openSettings(); return; }
  if (action === "erase-roads") { startEraseRoads(); return; }
  if (!ui.selectedId) return;
  const obj = game.S.objects.find((o) => o.id === ui.selectedId);
  if (!obj) return;
  const def = game.defOf(obj.type);
  if (action === "paint") {
    const v = Number(el.dataset.variant);
    const res = game.paintObject(obj.id, v);
    if (res.ok) refreshObjectMesh(obj.id);
    renderObjectPanel();
  } else if (action === "upgrade") {
    const res = game.upgradeObject(obj.id);
    if (!res.ok) toast("Upgrade", res.reason, "info");
    else { refreshObjectMesh(obj.id); renderObjectPanel(); renderHud(game.hudData()); toast("Upgraded", `${def.name} is now level ${res.object.level}.`, "good"); }
  } else if (action === "rotate") {
    const res = game.rotateObject(obj.id);
    if (!res.ok) toast("Rotate", res.reason, "info");
    else { world.refreshLayout(); selectObject(game.S.objects.find((o) => o.id === obj.id)); }
  } else if (action === "move") {
    startMove(obj);
  } else if (action === "remove") {
    eraseObject(obj);
  } else if (action === "focus") {
    world.focusObject(obj);
    closePanel();
  }
}
function refreshObjectMesh(id) {
  const obj = game.S.objects.find((o) => o.id === id);
  if (!obj) return;
  world.removeObjectMesh(id);
  world.addObjectMesh(obj);
  const current = game.S.objects.find((o) => o.id === id);
  world.setSelected(current);
}

/* ---------------------------------------------------------------------
   Visiting
   --------------------------------------------------------------------- */
async function visitByUid(uid) {
  if (!uid) return;
  let town = ui.towns.find((t) => (t.uid || t.id) === uid) || ui.weekly.find((e) => e.uid === uid);
  if (!town || !town.layout) {
    town = await cloud.fetchTown(uid);
  }
  if (!town) { toast("Visit", "That town is no longer published.", "bad"); return; }
  visitTown(town);
}
export function visitTown(town) {
  const layout = game.readVisitLayout(town);
  if (!layout) { toast("Visit", "This town's layout could not be read.", "bad"); return; }
  const safeObjects = layout.objects.filter((o) => o && DEF_BY_ID[o.type] && Number.isFinite(+o.i) && Number.isFinite(+o.j)).slice(0, 420);
  game.saveLocal(true);
  game.clearResidents();
  game.runtime.mode = "visit";
  game.runtime.started = false;
  ui.visit = { uid: town.uid || town.id, name: layout.name || town.name || "A town", owner: town.owner || "a mayor", likes: town.likes || 0 };
  world.clearResidentMeshes();
  world.setLayout({ objects: safeObjects, roads: layout.roads, roadsRev: Date.now(), land: layout.land });
  const banner = $("visit-banner");
  banner.hidden = false;
  banner.innerHTML = `<span>Visiting <b>${esc(ui.visit.name)}</b> by ${esc(ui.visit.owner)}</span>
    <button class="like-btn" data-banner="like"><svg><use href="#i-heart"/></svg>${ui.visit.likes || 0}</button>
    <button data-banner="leave">Leave town</button>`;
  closePanel();
  toast("Welcome to " + ui.visit.name, "Look around and leave a like.", "info");
}
export function leaveVisit() {
  if (!ui.visit) return;
  ui.visit = null;
  game.runtime.mode = "town";
  game.runtime.started = true;
  world.setLayout(game.S);
  game.clearResidents();
  game.enterTown();
  $("visit-banner").hidden = true;
  closePanel();
  renderHud(game.hudData());
  world.setCameraMode("overview");
}
function bindVisitBanner() {
  $("visit-banner").addEventListener("click", async (event) => {
    const btn = event.target.closest("[data-banner]");
    if (!btn) return;
    if (btn.dataset.banner === "leave") leaveVisit();
    if (btn.dataset.banner === "like") {
      if (!ui.online) { toast("Sign in", "Sign in to leave a like.", "info"); return; }
      try {
        const res = await cloud.toggleLike(ui.visit.uid);
        ui.visit.likes = res.likes;
        btn.innerHTML = `<svg><use href="#i-heart"/></svg>${res.likes}`;
        btn.classList.toggle("liked", res.liked);
      } catch (error) { toast("Like", error.message || "Could not like this town.", "bad"); }
    }
  });
}

/* ---------------------------------------------------------------------
   Discovery actions
   --------------------------------------------------------------------- */
async function likeTown(uid) {
  if (!ui.online) { toast("Sign in", "Sign in to like towns.", "info"); return; }
  try {
    const res = await cloud.toggleLike(uid);
    const t = ui.towns.find((x) => (x.uid || x.id) === uid);
    if (t) t.likes = res.likes;
    if (ui.visit && ui.visit.uid === uid) ui.visit.likes = res.likes;
    toast(res.liked ? "Liked" : "Like removed", res.liked ? "The mayor will see your heart." : "Your like was removed.", "good");
    renderPanel();
  } catch (error) { toast("Like", error.message || "Could not like this town.", "bad"); }
}
async function followMayor(uid) {
  if (!ui.online) { toast("Sign in", "Sign in to follow mayors.", "info"); return; }
  try {
    await cloud.follow(uid);
    toast("Following", "Their town will be easy to find in your friends list.", "good");
    ui.following = await cloud.following();
    renderPanel();
  } catch (error) { toast("Friends", error.message || "Could not follow this mayor.", "bad"); }
}
async function unfollowMayor(uid) {
  try {
    await cloud.unfollow(uid);
    ui.following = await cloud.following();
    renderPanel();
  } catch (error) { toast("Friends", error.message || "Could not unfollow.", "bad"); }
}
async function searchTowns() {
  if (!ui.online) return;
  const input = $("town-search");
  const term = input ? input.value.trim() : ui.searchTerm;
  ui.searchTerm = term;
  if (!term) { reloadDiscover(); return; }
  ui.loadingSearch = true;
  const rows = await cloud.searchTowns(term);
  ui.towns = rows;
  ui.loadingSearch = false;
  renderPanel();
}
async function reloadDiscover() {
  ui.towns = await cloud.fetchTowns();
  renderPanel();
}
async function refreshWeekly() {
  if (!ui.online) return;
  try {
    ui.weekly = await cloud.fetchWeekly(game.weekKey());
    ui.weekEntry = await cloud.myWeeklyEntry(game.weekKey());
    ui.weekVote = await cloud.myWeeklyVote(game.weekKey());
  } catch (error) { /* keep previous */ }
}
async function submitWeekly() {
  if (!ui.online) { toast("Sign in", "Sign in to enter the weekly contest.", "info"); return; }
  try {
    const res = await cloud.submitWeekly(game.weekKey(), game.townSnapshot());
    if (!res.ok) { toast("Weekly contest", res.reason || "Could not enter.", "info"); return; }
    ui.weekEntry = await cloud.myWeeklyEntry(game.weekKey());
    ui.weekly = await cloud.fetchWeekly(game.weekKey());
    toast("You're in", "Your town is on this week's board.", "good");
    renderPanel();
  } catch (error) { toast("Weekly contest", error.message || "Could not enter this week.", "bad"); }
}
async function voteEntry(uid) {
  if (!ui.online) { toast("Sign in", "Sign in to vote.", "info"); return; }
  try {
    await cloud.voteWeekly(game.weekKey(), uid);
    ui.weekVote = uid;
    ui.weekly = await cloud.fetchWeekly(game.weekKey());
    toast("Vote cast", "One vote each week — choose well.", "good");
    renderPanel();
  } catch (error) { toast("Vote", error.message || "Could not vote.", "bad"); }
}

/* ---------------------------------------------------------------------
   Settings, rename, confirmations
   --------------------------------------------------------------------- */
function openSettings() {
  const name = ui.online && ui.user ? ui.user.name : "Guest mayor";
  openModal(`
    <div class="modal-head"><div><h2>Settings</h2><p>${esc(name)} · ${ui.online ? "cloud town" : "local guest town"}</p></div><div class="spacer"></div><button class="icon-btn" data-modal-close><svg><use href="#i-close"/></svg></button></div>
    <div class="modal-body">
      <p class="eyebrow">Town name</p>
      <div style="display:flex;gap:7px;margin:7px 0 14px">
        <input id="settings-name" value="${esc(game.S.name)}" maxlength="24" style="flex:1;border:1px solid var(--line);border-radius:10px;padding:9px 11px;font:inherit;font-size:13px;background:#fffdf7">
        <button class="btn primary" data-modal-action="rename">Rename</button>
      </div>
      <div class="divider"></div>
      <p class="eyebrow">Account</p>
      <p class="small muted" style="line-height:1.5">${ui.online ? "Your town is saved to Firebase and published for other mayors to visit. Only you can edit it." : "You are playing as a guest. Sign in to sync and publish your town."}</p>
      <div class="action-grid">
        ${ui.online ? `<button class="btn soft" data-modal-action="sync"><svg><use href="#i-save"/></svg> Sync now</button>` : `<button class="btn primary" data-modal-action="gate"><svg><use href="#i-user"/></svg> Sign in</button>`}
        ${ui.online ? `<button class="btn ghost" data-modal-action="signout">Sign out</button>` : ""}
      </div>
      <div class="divider"></div>
      <p class="eyebrow">Controls</p>
      <p class="small muted" style="line-height:1.6">Left-drag pans · right-drag pans · scroll or pinch zooms · Q/E rotate the camera · R rotates a building · Esc cancels a tool. Click any building to paint, upgrade, move or remove it.</p>
      <p class="eyebrow" style="margin-top:12px">This week</p>
      <p class="small muted">${game.season().icon} ${esc(game.season().event)} — ${esc(game.season().bonus)}. ${game.seasonDaysLeft()} days left in ${esc(game.season().name)}.</p>
      <div class="divider"></div>
      <p class="eyebrow">Danger zone</p>
      <div class="action-grid">
        ${ui.online ? `<button class="btn danger" data-modal-action="delete-cloud">Delete cloud copy</button>` : ""}
        <button class="btn danger" data-modal-action="erase">Reset this town</button>
      </div>
      <p class="small muted" style="margin-top:10px;line-height:1.5">Little Town saves automatically. Reset starts a fresh town with the starter cottage, street and 16,000 coins.</p>
    </div>`);
}
function openRename() {
  openModal(`
    <div class="modal-head"><div><h2>Name your town</h2><p>This is what other mayors see.</p></div><div class="spacer"></div><button class="icon-btn" data-modal-close><svg><use href="#i-close"/></svg></button></div>
    <div class="modal-body">
      <input id="rename-input" value="${esc(game.S.name)}" maxlength="24" autocomplete="off" style="width:100%;border:1px solid var(--line);border-radius:11px;padding:11px 12px;font:inherit;font-size:15px;background:#fffdf7">
      <div class="modal-foot" style="padding:14px 0 0;border:0"><button class="btn ghost" data-modal-close>Cancel</button><button class="btn primary" data-modal-action="rename-town">Save name</button></div>
    </div>`);
  setTimeout(() => { const i = $("rename-input"); if (i) i.select(); }, 60);
}
function pendingConfirm(title, text, label, fn) {
  ui.confirmFn = fn;
  openModal(`
    <div class="modal-head"><div><h2>${esc(title)}</h2><p>${esc(text)}</p></div><div class="spacer"></div><button class="icon-btn" data-modal-close><svg><use href="#i-close"/></svg></button></div>
    <div class="modal-foot"><button class="btn ghost" data-modal-close>Cancel</button><button class="btn danger" data-modal-action="confirm">${esc(label)}</button></div>`);
}
function openModal(html) {
  $("modals").innerHTML = `<div class="modal-back" data-modal-close></div><div class="modal">${html}</div>`;
  $("modals").hidden = false;
  ui.modalOpen = true;
}
function closeModal() {
  if (!ui.modalOpen) return;
  $("modals").innerHTML = "";
  $("modals").hidden = true;
  ui.modalOpen = false;
  ui.confirmFn = null;
}
function bindModals() {
  $("modals").addEventListener("click", (event) => {
    if (event.target.closest("[data-modal-close]")) { closeModal(); return; }
    const el = event.target.closest("[data-modal-action]");
    if (!el) return;
    const action = el.dataset.modalAction;
    if (action === "rename" || action === "rename-town") {
      const input = action === "rename" ? $("settings-name") : $("rename-input");
      const res = game.renameTown(input ? input.value : "");
      if (!res.ok) { toast("Name", res.reason, "bad"); return; }
      closeModal();
      renderHud(game.hudData());
      if ($("menu") && !$("menu").hidden) renderMenuStats();
      toast("Renamed", "Welcome to " + game.S.name + ".", "good");
    } else if (action === "sync") {
      ui.hooks.syncNow && ui.hooks.syncNow();
      toast("Saving", "Syncing your town to the cloud.", "info");
      closeModal();
    } else if (action === "gate") {
      closeModal();
      ui.hooks.showGate && ui.hooks.showGate();
    } else if (action === "signout") {
      closeModal();
      ui.hooks.signOut && ui.hooks.signOut();
    } else if (action === "delete-cloud") {
      closeModal();
      pendingConfirm("Delete the cloud copy?", "Your local town stays on this device, but the published town and its likes will be removed.", "Delete cloud copy", async () => {
        const ok = await cloud.deleteCloud();
        closeModal();
        toast(ok ? "Cloud copy deleted" : "Not deleted", ok ? "Your published town is no longer online." : "Sign in and try again.", ok ? "info" : "bad");
        if (ok && ui.panel === "profile") renderPanel();
      });
    } else if (action === "erase") {
      closeModal();
      pendingConfirm("Reset this town?", "This will remove every building and start again with the starter cottage, street and 16,000 coins. Your local save is replaced.", "Reset town", () => {
        closeModal();
        ui.hooks.resetTown && ui.hooks.resetTown();
      });
    } else if (action === "confirm") {
      const fn = ui.confirmFn;
      ui.confirmFn = null;
      if (fn) fn();
    }
  });
}

/* ---------------------------------------------------------------------
   Hints, toasts, keyboard
   --------------------------------------------------------------------- */
export function toast(title, text, kind = "info") {
  const box = $("toasts");
  if (!box) return;
  const el = document.createElement("div");
  el.className = "toast " + (kind || "info");
  el.innerHTML = `<span class="dot"></span><span>${esc(title)}${text ? `<small>${esc(text)}</small>` : ""}</span>`;
  box.appendChild(el);
  while (box.children.length > 3) box.firstElementChild.remove();
  setTimeout(() => { el.style.opacity = "0"; el.style.transition = "opacity .3s"; setTimeout(() => el.remove(), 320); }, 3400);
}
export function showHint(text, ms = 0) {
  const bar = $("hint");
  if (!bar) return;
  bar.innerHTML = `<span>${esc(text).replace(/R rotates/g, "<kbd>R</kbd> rotates").replace(/Esc cancels/g, "<kbd>Esc</kbd> cancels").replace(/Click or drag/g, "<b>Click or drag</b>")}</span>`;
  bar.hidden = false;
  clearTimeout(ui.hintTimer);
  if (ms) ui.hintTimer = setTimeout(() => { bar.hidden = true; }, ms);
}
export function hideHint() { const bar = $("hint"); if (bar) bar.hidden = true; clearTimeout(ui.hintTimer); }
function setToolHint(text) { showHint(text, 0); }
function bindKeyboard() {
  document.addEventListener("keydown", (event) => {
    if (event.target && /INPUT|TEXTAREA|SELECT/.test(event.target.tagName)) return;
    const key = event.key;
    if (key === "Escape") {
      if (ui.modalOpen) { closeModal(); return; }
      if (ui.tool) { cancelTool(); return; }
      if (ui.panel) { closePanel(); return; }
      if (ui.visit) return;
      if ($("menu").hidden) showMenu(); else hideMenu();
      return;
    }
    if (ui.visit) return;
    if (key === "r" || key === "R") {
      if (ui.tool && ui.tool.rot !== undefined) {
        ui.tool.rot = (ui.tool.rot + 1) % 4;
        if (ui.hover) onWorldHover(ui.hover);
      } else if (ui.selectedId) {
        const obj = game.S.objects.find((o) => o.id === ui.selectedId);
        if (obj) { const res = game.rotateObject(obj.id); if (res.ok) { world.refreshLayout(); selectObject(game.S.objects.find((o) => o.id === obj.id)); } }
      }
      return;
    }
    if (key === "b" || key === "B") { openPanel("build"); return; }
    if (key === "v" || key === "V") { openPanel("discover"); return; }
    if (key === "j" || key === "J") { openPanel("quests"); return; }
    if (key === "Delete" || key === "Backspace") {
      if (ui.selectedId) {
        const obj = game.S.objects.find((o) => o.id === ui.selectedId);
        if (obj) { event.preventDefault(); eraseObject(obj); }
      }
    }
    if (key === "m" || key === "M") {
      if (ui.selectedId) { const obj = game.S.objects.find((o) => o.id === ui.selectedId); if (obj) startMove(obj); }
    }
  });
}

/* Public methods on the shared ui object, so other modules can call them. */
Object.assign(ui, {
  initUI, setOnline, refreshAll, renderHud, showMenu, hideMenu,
  openPanel, closePanel, toast, showHint, hideHint, visitTown, leaveVisit
});
