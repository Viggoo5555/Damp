/* =====================================================================
   DREAM PARK — interface
   The HUD, the build shop, management, staff, research, the coaster
   workshop, discovery, friends, profile and settings. It talks to the
   simulation through game.js and to the scene through world.js.
   ===================================================================== */
import * as game from "./game.js";
import * as world from "./world.js";
import * as cloud from "./cloud.js";
import { CONFIG } from "./config.js";
import {
  RIDES, BUILDINGS, DECOR, PATHS, STAFF, RESEARCH, ACHIEVEMENTS, DAILY, WEEKLY,
  CAT_LABEL, TIPS, DEF_BY_ID, xpForLevel
} from "./data.js";
import { PIECES, PLAN_DEFAULT, simulatePlan, drawPlan } from "./coaster.js";

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s === undefined || s === null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const fmt = (n) => Math.round(Number(n) || 0).toLocaleString("en-US");
const money = (n) => '<svg><use href="#i-coin"/></svg>' + fmt(n);
const stars = (r) => "★".repeat(Math.max(0, Math.min(5, Math.round(r || 0)))) + "☆".repeat(Math.max(0, 5 - Math.round(r || 0)));

export const ui = {
  online: false,
  user: null,
  panel: null,
  tab: "rides",
  cat: "all",
  decorCat: "all",
  tool: null,
  selected: null,
  painting: false,
  hover: null,
  hooks: {},
  parks: [],
  leaders: [],
  weekly: [],
  followers: [],
  following: [],
  weekEntry: null,
  weekVote: null,
  discoverLoaded: false,
  discoverTab: "parks",
  parksUnsub: null,
  modal: null,
  coaster: null,
  hintTimer: null,
  syncing: false,
  lastSaveAt: 0
};

/* ---------------------------------------------------------------------
   Item artwork — a picture per model, so cards do not all look alike.
   --------------------------------------------------------------------- */
const RIDE_ART = {
  carousel: "🎠", "ferris-wheel": "🎡", teacups: "🍵", "swing-ride": "🎪",
  "bumper-cars": "🚗", "drop-tower": "🗼", "log-flume": "🪵", "pirate-ship": "🏴‍☠️",
  "kiddie-elephants": "🐘", "mini-train": "🚂", "custom-coaster": "🎢", "mine-coaster": "⛏️",
  "haunted-house": "🏚️", "fun-house": "🪞", "mirror-maze": "🔮", cinema: "🎬",
  arcade: "🕹️", "water-slide": "🛝", "splash-battle": "💦", rapids: "🌊",
  "observation-tower": "🔭", "star-flyer": "⭐", "wave-swinger": "🏖️", "rockin-tug": "⛵",
  "balloon-ride": "🎈", toboggan: "🛷", treehouse: "🌳", trampoline: "🤸",
  "dark-ride": "👻", "flying-carpet": "🧞"
};
const BUILD_ART = {
  burger: "🍔", pizza: "🍕", churros: "🥨", "ice-cream": "🍦", popcorn: "🍿",
  drinks: "🥤", coffee: "☕", candy: "🍬", souvenir: "🛍️", balloons: "🎈",
  photos: "📸", restaurant: "🍽️", toilet: "🚻", "first-aid": "⛑️", info: "ℹ️", staffroom: "🫖"
};
const DECOR_ART = {
  "tree-oak": "🌳", "tree-pine": "🌲", "tree-palm": "🌴", "tree-blossom": "🌸",
  flowers: "🌼", flowerbed: "🌷", hedge: "🌿", topiary: "🌳", bench: "🪑",
  bin: "🗑️", lamp: "💡", fountain: "⛲", statue: "🗽", flag: "🚩", arch: "🌺",
  "balloon-arch": "🎈", fence: "🚧", pond: "🦆", bridge: "🌉"
};
function artFor(def) {
  return RIDE_ART[def.id] || BUILD_ART[def.id] || DECOR_ART[def.id] || "🎡";
}

/* ---------------------------------------------------------------------
   Boot
   --------------------------------------------------------------------- */
export function initUI(hooks = {}) {
  ui.hooks = hooks;
  bindDock();
  bindHud();
  bindPanel();
  bindKeyboard();
  world.world.callbacks.onClick = onWorldClick;
  world.world.callbacks.onHover = onWorldHover;
  const canvas = $("gl");
  if (canvas) {
    canvas.addEventListener("pointerdown", () => { ui.painting = true; });
    window.addEventListener("pointerup", () => { ui.painting = false; });
  }
  renderHud(game.hudData());
  bindMenu();
  showHint("Drag to look around · scroll to zoom · right-drag to pan", 7000);
}

export function setOnline(online, user) {
  ui.online = !!online;
  ui.user = user || null;
  const menuAccount = $("menu-account");
  if (menuAccount) {
    menuAccount.textContent = ui.online
      ? `Signed in as ${user ? user.name : "park keeper"} · your park syncs to every device`
      : "Playing as a guest · this park lives on this device";
  }
  if (ui.panel === "profile") openPanel("profile", true);
}

/* ---------------------------------------------------------------------
   HUD
   --------------------------------------------------------------------- */
function bindHud() {
  $("btn-open").addEventListener("click", () => {
    game.setOpen(!game.S.open);
    renderHud(game.hudData());
    saveSoon();
  });
  $("btn-settings").addEventListener("click", openSettings);
  $("btn-menu").addEventListener("click", showMenu);
  $("btn-parkname").addEventListener("click", openRename);
  document.querySelectorAll(".camera-bar button").forEach((b) => b.addEventListener("click", () => setCamera(b.dataset.cam)));
  $("hud-stars").title = "Park rating — happiness, value, variety, cleanliness";
}

export function renderHud(data) {
  if (!data) return;
  $("hud-coins").textContent = fmt(data.coins);
  $("hud-guests").textContent = data.guests;
  $("hud-cap").textContent = data.capacity;
  $("hud-level").textContent = data.level;
  $("hud-stars").textContent = stars(data.rating);
  $("hud-stars").title = `Park rating ${data.rating.toFixed(1)} / 5`;
  $("hud-day").textContent = "Day " + data.day;
  $("hud-day-fill").style.width = Math.min(100, Math.max(0, data.dayProgress * 100)) + "%";
  const hour = CONFIG.openHour + Math.min(1, data.dayProgress) * (CONFIG.closeHour - CONFIG.openHour);
  const h = Math.floor(hour), m = Math.floor((hour - h) * 60);
  $("hud-clock").textContent = String(h).padStart(2, "0") + ":" + String(m).padStart(2, "0");
  $("park-name").textContent = data.name;
  const lvl = data.level;
  const span = Math.max(1, xpForLevel(lvl + 1) - xpForLevel(lvl));
  $("hud-xp").style.width = Math.min(100, Math.max(2, (1 - data.xpNeed / span) * 100)) + "%";
  const open = $("btn-open");
  open.classList.toggle("closed", !data.open);
  open.querySelector("b").textContent = data.open ? "Park open" : "Open park";
  const weather = $("hud-weather");
  if (weather) weather.textContent = data.open ? `Sunny · ${data.guests} guests · ${data.cleanliness}% clean` : `Closed · ${data.staff} staff · ${data.happiness}% happy`;
  if ($("menu") && !$("menu").hidden) renderMenuStats();
}

function renderMenuStats() {
  const box = $("menu-stats");
  if (!box) return;
  const h = game.hudData();
  box.innerHTML = `
    <div><b>${fmt(h.coins)}</b><small>coins</small></div>
    <div><b>${h.level}</b><small>level</small></div>
    <div><b>${h.rating.toFixed(1)}</b><small>rating</small></div>
    <div><b>${h.guests}</b><small>guests now</small></div>`;
  $("menu-park").textContent = game.S.name;
}

/* ---------------------------------------------------------------------
   Dock / panels
   --------------------------------------------------------------------- */
function bindDock() {
  document.querySelectorAll(".dock button").forEach((b) => {
    b.addEventListener("click", () => {
      const name = b.dataset.panel;
      if (ui.panel === name) closePanel(); else openPanel(name);
    });
  });
}

function bindPanel() {
  $("panel").addEventListener("click", (event) => {
    const el = event.target.closest("[data-action],[data-tab],[data-cat],[data-pick],[data-path],[data-hire],[data-fire],[data-research],[data-repair],[data-focus],[data-claim],[data-like],[data-visit],[data-follow],[data-unfollow],[data-vote],[data-weekly],[data-buyland],[data-open],[data-object]");
    if (!el) {
      if (event.target.closest("[data-close-panel]")) closePanel();
      return;
    }
    const d = el.dataset;
    if (event.target.closest("[data-close-panel]")) { closePanel(); return; }
    if (d.tab) {
      const [prefix, value] = d.tab.includes(":") ? d.tab.split(":") : [null, d.tab];
      if (prefix === "decor") { ui.decorCat = value; openPanel("decor", true); }
      else if (prefix === "discover") { ui.discoverTab = value; openPanel("discover", true); }
      else { ui.tab = value; ui.cat = "all"; openPanel(ui.panel, true); }
      return;
    }
    if (d.cat) { ui.cat = d.cat; openPanel("build", true); return; }
    if (d.pick) { pickItem(d.pick); return; }
    if (d.path) { startPathTool(d.path, d.erase === "1"); return; }
    if (d.hire) { game.hire(d.hire, 1); openPanel("staff", true); return; }
    if (d.fire) { game.hire(d.fire, -1); openPanel("staff", true); return; }
    if (d.research) {
      const res = game.buyResearch(d.research);
      if (!res.ok) toast("Research", res.reason || "Not available yet", "bad");
      openPanel("research", true);
      renderHud(game.hudData());
      return;
    }
    if (d.repair) {
      const r = game.repairRide(d.repair);
      if (!r.ok) toast("Maintenance", r.reason || "Nothing to repair", "info");
      openPanel(ui.panel, true);
      renderHud(game.hudData());
      return;
    }
    if (d.focus) { focusObject(d.focus); return; }
    if (d.claim) {
      const r = game.claimChallenge(d.claim);
      if (!r.ok) toast("Challenge", r.reason || "Not ready", "info");
      openPanel("profile", true);
      renderHud(game.hudData());
      return;
    }
    if (d.buyland) {
      const r = game.buyLand();
      if (r.ok) { world.buildFence(game.S.land); toast("Land", "More room for rides.", "good"); }
      else toast("Land", r.reason || "Not now", "bad");
      openPanel(ui.panel, true);
      renderHud(game.hudData());
      return;
    }
    if (d.open !== undefined) {
      game.setOpen(d.open === "1");
      renderHud(game.hudData());
      return;
    }
    if (d.object) { selectObject(d.object); return; }
    if (d.like) handleLike(d.like);
    if (d.visit) handleVisit(d.visit);
    if (d.follow) handleFollow(d.follow, true);
    if (d.unfollow) handleFollow(d.unfollow, false);
    if (d.vote) handleVote(d.vote);
    if (d.weekly !== undefined) handleWeeklySubmit();
  });
}

export function openPanel(name, keep) {
  const panel = $("panel");
  if (!name) { closePanel(); return; }
  ui.panel = name;
  if (!keep && name !== "object") {
    ui.selected = null;
    world.setSelected(null);
    cancelTool();
  }
  panel.hidden = false;
  document.querySelectorAll(".dock button").forEach((b) => b.classList.toggle("on", b.dataset.panel === name));
  panel.innerHTML = renderPanel(name);
  const body = panel.querySelector(".panel-body");
  if (body) body.scrollTop = 0;
  if (name === "discover" && !ui.discoverLoaded) loadDiscover();
  if (name === "profile" && !keep) loadProfileExtras();
}

export function closePanel() {
  ui.panel = null;
  $("panel").hidden = true;
  document.querySelectorAll(".dock button").forEach((b) => b.classList.remove("on"));
  cancelTool();
}

/* Hide the sheet without cancelling the tool that was just picked. */
function collapsePanel() {
  ui.panel = null;
  $("panel").hidden = true;
  document.querySelectorAll(".dock button").forEach((b) => b.classList.remove("on"));
}

function renderPanel(name) {
  switch (name) {
    case "build": return renderShop();
    case "paths": return renderPaths();
    case "decor": return renderDecor();
    case "staff": return renderStaff();
    case "manage": return renderManage();
    case "research": return renderResearch();
    case "discover": return renderDiscover();
    case "profile": return renderProfile();
    case "object": return renderObjectPanel();
    default: return renderShop();
  }
}

function head(title, sub) {
  return `<div class="panel-head">
    <div><h3>${esc(title)}</h3><p>${esc(sub)}</p></div>
    <div class="spacer"></div>
    <button class="icon-btn" data-close-panel title="Close"><svg><use href="#i-close"/></svg></button>
  </div>`;
}

/* ---------------------------------------------------------------------
   Shops
   --------------------------------------------------------------------- */
function catTabs(list, active, key) {
  return `<div class="chips">${list.map(([id, label]) => `<button class="${active === id ? "on" : ""}" ${key === "cat" ? "data-cat" : "data-tab"}="${id}">${label}</button>`).join("")}</div>`;
}

function lockLabel(def) {
  if (game.isUnlocked(def)) return "";
  return `Lv ${def.level}`;
}

function itemCard(def, action, note) {
  const unlocked = game.isUnlocked(def);
  const price = game.priceOf(def);
  const affordable = game.S.coins >= price;
  const foot = note !== undefined ? note : `${money(price)}${def.fun !== undefined ? `<span class="fun"><svg><use href="#i-heart"/></svg>${def.fun}</span>` : ""}`;
  return `<button class="item-card ${unlocked ? "" : "locked"}" data-${action}="${def.id}">
    <span class="item-art"><span class="emoji">${artFor(def)}</span>${unlocked ? "" : `<span class="lock-tag"><svg><use href="#i-lock"/></svg>${esc(lockLabel(def))}</span>`}</span>
    <span class="item-main">
      <b>${esc(def.name)}</b>
      <small>${esc((def.desc || "").slice(0, 62))}</small>
      <span class="item-foot" style="${!unlocked || !affordable ? "opacity:.7" : ""}">${foot}</span>
    </span>
  </button>`;
}

function renderShop() {
  if (ui.tab !== "rides" && ui.tab !== "shops" && ui.tab !== "facilities") ui.tab = "rides";
  if (ui.tab === "rides" && !["all", "thrill", "family", "kiddie", "water", "dark", "coaster", "transport"].includes(ui.cat)) ui.cat = "all";
  if (ui.tab === "shops" && !["all", "food", "drink", "goods"].includes(ui.cat)) ui.cat = "all";
  let list, cats;
  if (ui.tab === "rides") {
    list = RIDES.filter((r) => ui.cat === "all" || r.cat === ui.cat);
    cats = [["all", "All"], ...Object.keys(CAT_LABEL).filter((c) => c !== "food" && c !== "drink" && c !== "goods" && c !== "facility").map((c) => [c, CAT_LABEL[c]])];
  } else if (ui.tab === "shops") {
    list = BUILDINGS.filter((b) => b.kind === "food" || b.kind === "drink" || b.kind === "goods");
    cats = [["all", "All"],
      ["food", "Food"], ["drink", "Drink"], ["goods", "Shops"]];
    list = list.filter((b) => ui.cat === "all" || b.kind === ui.cat);
  } else {
    list = BUILDINGS.filter((b) => b.kind === "facility");
    cats = [["all", "All"]];
  }
  const ridesCount = game.S.objects.filter((o) => game.kindOf(game.defOf(o.type)) === "ride").length;
  return head("Build", `${ridesCount} attractions in the park`)
    + `<div class="tabs">
        <button class="${ui.tab === "rides" ? "on" : ""}" data-tab="rides">Rides</button>
        <button class="${ui.tab === "shops" ? "on" : ""}" data-tab="shops">Shops</button>
        <button class="${ui.tab === "facilities" ? "on" : ""}" data-tab="facilities">Facilities</button>
      </div>
      <div class="panel-body">
        ${ui.tab === "rides" || ui.tab === "shops" ? catTabs(cats, ui.cat, "cat") : ""}
        <div class="chips">
          <button data-action="delete-mode">🗑 Remove something</button>
          <button data-action="cam-top">Top view</button>
        </div>
        <div class="item-grid">${list.map((def) => itemCard(def, "pick")).join("")}</div>
        <p class="small muted" style="margin-top:14px;line-height:1.5">Rides need a path beside them before guests can queue. Prices shown include the build cost; the daily upkeep appears in Management.</p>
      </div>`;
}

function renderDecor() {
  const cats = [["all", "All"], ["tree", "Trees"], ["flower", "Flowers"], ["rest", "Comfort"], ["water", "Water"], ["light", "Light"], ["other", "Other"]];
  let list = DECOR;
  if (ui.decorCat !== "all") {
    list = DECOR.filter((d) => {
      if (ui.decorCat === "tree") return d.model.startsWith("tree") || d.model === "hedge" || d.model === "topiary";
      if (ui.decorCat === "flower") return d.model === "flowers" || d.model === "flowerbed";
      if (ui.decorCat === "rest") return d.effect === "rest" || d.effect === "clean";
      if (ui.decorCat === "water") return d.effect === "water";
      if (ui.decorCat === "light") return d.effect === "light";
      return d.effect !== "rest" && d.effect !== "clean" && d.effect !== "water" && d.effect !== "light" && !d.model.startsWith("tree") && d.model !== "flowers" && d.model !== "flowerbed";
    });
  }
  const placed = game.S.objects.filter((o) => game.kindOf(game.defOf(o.type)) === "decor").length;
  return head("Decorations", `${placed} pieces placed · ${placed < 8 ? 8 - placed + " more for the challenge" : "the grounds look lovely"}`)
    + `<div class="panel-body">
      <div class="chips">${cats.map(([id, label]) => `<button class="${ui.decorCat === id ? "on" : ""}" data-tab="decor:${id}">${label}</button>`).join("")}</div>
      <div class="item-grid">${list.map((def) => itemCard(def, "pick")).join("")}</div>
    </div>`;
}

function renderPaths() {
  return head("Paths", "Guests only walk where you pave")
    + `<div class="panel-body">
      <div class="item-grid">
        ${PATHS.map((p) => `<button class="item-card" data-path="${p.id}">
          <span class="item-art"><span class="emoji">${p.id === "path" ? "🧱" : p.id === "plaza" ? "🟨" : "🧍"}</span></span>
          <span class="item-main"><b>${p.name}</b><small>${p.desc}</small><span class="item-foot">${money(p.price)} each</span></span>
        </button>`).join("")}
      </div>
      <div class="divider"></div>
      <div class="stack">
        <button class="btn teal" data-path="path" data-erase="1">Erase paths</button>
        <p class="small muted" style="line-height:1.5">Click and drag to paint. Paths connect queues, shops and benches to the entrance. A ride with no adjacent path stays empty.</p>
      </div>
    </div>`;
}

/* ---------------------------------------------------------------------
   Staff
   --------------------------------------------------------------------- */
function renderStaff() {
  const wages = game.wageBill();
  return head("Staff", `${game.staffCount()} on the team · ${fmt(wages)} coins in daily wages`)
    + `<div class="panel-body">
      <div class="staff-grid">
        ${STAFF.map((role) => {
          const n = game.S.staff[role.id] || 0;
          return `<div class="staff-card">
            <div class="staff-av" style="background:${role.color}">${n}</div>
            <div class="grow">
              <b>${role.name}</b>
              <small>${role.desc}</small>
              <div class="small" style="margin-top:3px;color:var(--coral-deep);font-weight:700">${fmt(role.wage)} / day each</div>
            </div>
            <div class="hire-controls">
              <button class="btn tiny soft" data-fire="${role.id}" ${n <= 0 ? "disabled" : ""}>−</button>
              <span class="count">${n}</span>
              <button class="btn tiny teal" data-hire="${role.id}">+</button>
            </div>
          </div>`;
        }).join("")}
      </div>
      <p class="small muted" style="margin-top:14px;line-height:1.5">Hiring costs 2½ days of wages up front. Mechanics repair breakdowns automatically, cleaners slow litter, entertainers lift happiness, security calms crowds and operators shorten boarding.</p>
    </div>`;
}

/* ---------------------------------------------------------------------
   Management
   --------------------------------------------------------------------- */
function renderManage() {
  const h = game.hudData();
  const rides = game.S.objects.filter((o) => game.kindOf(game.defOf(o.type)) === "ride");
  const land = game.landPrice();
  const hist = game.S.history.slice(0, 4);
  return head("Management", `Day ${h.day} · ${h.rating.toFixed(1)} / 5 rating`)
    + `<div class="panel-body">
      <div class="stat-grid">
        <div class="stat-box"><small>Today income</small><b>${fmt(game.S.dayIncome)}</b><div class="sub">${game.S.dayServed} guests served</div></div>
        <div class="stat-box"><small>Today expenses</small><b>${fmt(game.S.dayExpense + game.wageBill() + game.upkeepBill())}</b><div class="sub">wages ${fmt(game.wageBill())}</div></div>
        <div class="stat-box"><small>Happiness</small><b>${h.happiness}%</b><div class="sub">${h.guests} in park</div></div>
        <div class="stat-box"><small>Cleanliness</small><b>${h.cleanliness}%</b><div class="sub">${h.staff} staff</div></div>
      </div>

      <div class="rowline">
        <div class="grow"><b>Park gates</b><small>${game.S.open ? "Visitors are arriving" : "Closed — no new guests"}</small></div>
        <button class="btn ${game.S.open ? "danger" : "teal"}" data-open="${game.S.open ? "0" : "1"}">${game.S.open ? "Close park" : "Open park"}</button>
      </div>

      <div class="divider"></div>
      <p class="eyebrow">Prices</p>
      <div class="range-row">
        <label>Entrance ticket</label>
        <input type="range" min="0" max="90" step="1" value="${game.S.ticket}" data-price-range="ticket">
        <output>${game.S.ticket}</output>
      </div>
      <div class="range-row">
        <label>Shop prices</label>
        <input type="range" min="0.6" max="2.2" step="0.1" value="${game.S.shopMarkup}" data-price-range="markup">
        <output>${game.S.shopMarkup.toFixed(1)}×</output>
      </div>

      <div class="divider"></div>
      <p class="eyebrow">Attractions · ${rides.length}</p>
      ${rides.length ? rides.map((o) => {
        const def = game.defOf(o.type);
        const st = game.S.rideState[o.id] || { condition: 100, queue: [], served: 0 };
        const cond = Math.round(st.condition);
        const price = game.ridePriceFor(o);
        return `<div class="rowline">
          <div class="grow">
            <b>${esc(def.name)}</b>
            <small>${fmt(st.served || 0)} riders · queue ${st.queue ? st.queue.length : 0}</small>
            <div class="cond-bar ${st.broken ? "broken" : cond < 45 ? "low" : ""}" style="margin-top:5px"><i style="width:${cond}%"></i></div>
          </div>
          <div class="right">
            <div class="small" style="font-weight:800;color:#9a6a12">${price} coins</div>
            <div style="display:flex;gap:3px;margin-top:4px">
              <button class="btn tiny ghost" data-price="${o.id}" data-delta="-1">−</button>
              <button class="btn tiny ghost" data-price="${o.id}" data-delta="1">+</button>
              <button class="btn tiny soft" data-focus="${o.id}">View</button>
            </div>
            ${st.broken || cond < 96 ? `<button class="btn tiny ${st.broken ? "danger" : "soft"}" data-repair="${o.id}" style="margin-top:4px">${st.broken ? "Repair" : "Service"}</button>` : ""}
          </div>
        </div>`;
      }).join("") : '<p class="small muted">No attractions yet. Open Build to place your first ride.</p>'}

      <div class="divider"></div>
      <div class="land-card">
        <div class="grow">
          <div class="big">${land === null ? "Park complete" : "Expand the park"}</div>
          <p>${land === null ? "Every plot of land is yours." : `Next ring of land for ${fmt(land)} coins. Current radius: ${game.S.land} tiles.`}</p>
        </div>
        ${land === null ? "" : `<button class="btn primary" data-buyland>Buy</button>`}
      </div>

      ${hist.length ? `<div class="divider"></div><p class="eyebrow">Recent days</p>${hist.map((d) => `<div class="rowline"><div class="grow"><b>Day ${d.day}</b><small>${d.served} guests · rating ${d.rating}</small></div><div class="right small"><span style="color:var(--teal-deep);font-weight:800">+${fmt(d.income)}</span><br><span class="muted">−${fmt(d.expense)}</span></div></div>`).join("")}` : ""}
    </div>`;
}

/* price buttons use delegation on the panel, added separately because
   range inputs need live handling */
document.addEventListener("input", (event) => {
  const range = event.target.closest("[data-price-range]");
  if (!range) return;
  if (range.dataset.priceRange === "ticket") {
    game.setTicket(Number(range.value));
    const out = range.parentElement.querySelector("output");
    if (out) out.textContent = game.S.ticket;
  } else {
    game.setMarkup(Number(range.value));
    const out = range.parentElement.querySelector("output");
    if (out) out.textContent = game.S.shopMarkup.toFixed(1) + "×";
  }
  saveSoon();
});

document.addEventListener("click", (event) => {
  const btn = event.target.closest("[data-price]");
  if (!btn) return;
  const obj = game.S.objects.find((o) => o.id === btn.dataset.price);
  if (!obj) return;
  const next = game.ridePriceFor(obj) + Number(btn.dataset.delta);
  game.setRidePrice(obj.id, next);
  renderHud(game.hudData());
  if (ui.panel === "manage") openPanel("manage", true);
});

/* ---------------------------------------------------------------------
   Research
   --------------------------------------------------------------------- */
function renderResearch() {
  return head("Research", `${game.S.researchPoints} research points available`)
    + `<div class="panel-body">
      <p class="small muted" style="margin:0 0 10px;line-height:1.5">Earn a research point at every level. Research unlocks early access to rides and improves the park's running costs.</p>
      <div class="research-grid">
        ${RESEARCH.map((node) => {
          const done = game.S.research.includes(node.id);
          const locked = node.requires.some((r) => !game.S.research.includes(r));
          const afford = game.S.researchPoints >= node.cost;
          return `<div class="research-card ${done ? "done" : ""} ${locked ? "locked" : ""}">
            <div class="research-ico"><svg><use href="#i-${node.id === "land" ? "globe" : node.id === "marketing" ? "users" : node.id === "staffing" ? "staff" : node.id === "decor" ? "tree" : node.id === "comfort" ? "heart" : node.id === "food" ? "build" : "flask"}"/></svg></div>
            <div class="grow" style="flex:1">
              <b>${node.name} ${done ? "✓" : ""}</b>
              <p>${node.desc}</p>
              <div class="small" style="margin-top:5px;font-weight:700;color:${done ? "var(--teal)" : "var(--coral-deep)"}">${done ? "Researched" : node.cost + " point" + (node.cost > 1 ? "s" : "")}${locked ? " · needs " + node.requires.map((r) => RESEARCH.find((x) => x.id === r).name).join(", ") : ""}</div>
            </div>
            ${done || locked ? "" : `<button class="btn tiny ${afford ? "teal" : "soft"}" data-research="${node.id}" ${afford ? "" : "disabled"}>Research</button>`}
          </div>`;
        }).join("")}
      </div>
    </div>`;
}

/* ---------------------------------------------------------------------
   Discovery, leaderboard, weekly, friends
   --------------------------------------------------------------------- */
function renderDiscover() {
  const tabs = [["parks", "Parks"], ["leaders", "Leaderboard"], ["weekly", "Weekly"], ["friends", "Friends"]];
  if (!ui.discoverLoaded) {
    return head("Discover", "Loading parks from around the world…")
      + `<div class="panel-body"><p class="small muted">Fetching public parks…</p></div>`;
  }
  let body = "";
  if (ui.discoverTab === "parks") body = renderParkList(ui.parks);
  else if (ui.discoverTab === "leaders") body = renderLeaderList();
  else if (ui.discoverTab === "weekly") body = renderWeekly();
  else body = renderFriends();
  return head("Discover", `${ui.parks.length} public parks · visit, like, get ideas`)
    + `<div class="tabs">${tabs.map(([id, label]) => `<button class="${ui.discoverTab === id ? "on" : ""}" data-tab="discover:${id}">${label}</button>`).join("")}</div>
      <div class="panel-body">${body}</div>`;
}

function parkCard(p, action) {
  const mine = ui.user && p.uid === ui.user.uid;
  return `<div class="park-card">
    <div class="park-badge">${esc((p.owner || p.name || "P").slice(0, 1).toUpperCase())}</div>
    <div class="grow">
      <b>${esc(p.name || "Untitled park")}</b>
      <small>${esc(p.owner || "keeper")} · Lv ${p.level || 1} · ${Number(p.rating || 0).toFixed(1)}★ · ${fmt(p.rides || 0)} rides</small>
    </div>
    <button class="like-btn" data-like="${p.uid}" title="Like this park"><svg><use href="#i-heart"/></svg>${fmt(p.likes || 0)}</button>
    ${mine ? `<span class="pillchip">Yours</span>` : `<button class="btn tiny teal" data-visit="${p.uid}">Visit</button>`}
  </div>`;
}

function renderParkList(list) {
  if (!list.length) {
    return `<p class="small muted" style="line-height:1.5">No public parks yet. Publish yours from Profile → Publish park, and it will appear here for everyone.</p>`;
  }
  return `<div class="park-list">${list.map((p) => parkCard(p)).join("")}</div>`;
}

function renderLeaderList() {
  if (!ui.leaders.length) return `<p class="small muted">The leaderboard fills up as parks are published. Be the first.</p>`;
  return `<div class="park-list">${ui.leaders.map((p, i) => `<div class="park-card">
    <div class="park-badge" style="background:${i < 3 ? "linear-gradient(150deg,#ffe08a,#ffc457)" : "linear-gradient(150deg,#e3f2f7,#eef7fa)"}">${i + 1}</div>
    <div class="grow"><b>${esc(p.name || "Park")}</b><small>Lv ${p.level || 1} · ${Number(p.rating || 0).toFixed(1)}★ · ${fmt(p.visitors || 0)} visitors</small></div>
    <button class="btn tiny soft" data-visit="${p.uid}">Visit</button>
  </div>`).join("")}</div>`;
}

function renderWeekly() {
  const week = game.weekKey();
  const entry = ui.weekEntry;
  return `<p class="small muted" style="margin:0 0 10px;line-height:1.5">This week (${week}): enter your park once, then vote for one other entry. The most votes when the week turns over takes the ribbon.</p>
    ${ui.online ? (entry ? `<div class="pillchip" style="margin-bottom:10px"><svg><use href="#i-check"/></svg>Your entry is in — ${fmt(entry.votes || 0)} votes</div>` : `<button class="btn teal wide" data-weekly="1" style="margin-bottom:10px">Enter this week's contest</button>`) : `<p class="small" style="background:#fff6e6;padding:9px;border-radius:10px">Sign in to enter and vote.</p>`}
    ${ui.weekly.length ? `<div class="park-list">${ui.weekly.map((e) => `<div class="park-card">
      <div class="park-badge">${esc((e.owner || "P").slice(0, 1).toUpperCase())}</div>
      <div class="grow"><b>${esc(e.name || "Park")}</b><small>${esc(e.owner || "keeper")} · Lv ${e.level || 1} · ${fmt(e.votes || 0)} votes</small></div>
      ${ui.online && e.uid !== (ui.user && ui.user.uid) ? `<button class="btn tiny ${ui.weekVote === e.uid ? "soft" : "primary"}" data-vote="${e.uid}" ${ui.weekVote ? "disabled" : ""}>${ui.weekVote === e.uid ? "Voted" : "Vote"}</button>` : ""}
      <button class="btn tiny ghost" data-visit="${e.uid}">Visit</button>
    </div>`).join("")}</div>` : `<p class="small muted">No entries yet this week.</p>`}`;
}

function renderFriends() {
  if (!ui.online) return `<p class="small muted" style="line-height:1.5">Sign in to follow other park keepers. You can still visit public parks as a guest.</p>`;
  const followIds = new Set(ui.following.map((f) => f.to));
  const known = [...ui.leaders, ...ui.parks].filter((p) => p.uid);
  const seen = new Set();
  const unique = known.filter((p) => { if (!p.uid || seen.has(p.uid)) return false; seen.add(p.uid); return p.uid !== (ui.user && ui.user.uid); });
  return `<div class="park-list">
      ${unique.slice(0, 18).map((p) => `<div class="park-card">
        <div class="park-badge">${esc((p.owner || "K").slice(0, 1).toUpperCase())}</div>
        <div class="grow"><b>${esc(p.owner || "keeper")}</b><small>${esc(p.name || "A park")} · Lv ${p.level || 1}</small></div>
        <button class="btn tiny ${followIds.has(p.uid) ? "soft" : "teal"}" data-${followIds.has(p.uid) ? "unfollow" : "follow"}="${p.uid}">${followIds.has(p.uid) ? "Following" : "Follow"}</button>
      </div>`).join("") || `<p class="small muted">Publish your park and visit others — keepers you meet show up here.</p>`}
    </div>
    ${ui.followers.length ? `<div class="divider"></div><p class="eyebrow">Following you (${ui.followers.length})</p>${ui.followers.map((f) => `<span class="pillchip" style="margin:3px">${esc(f.name || "keeper")}</span>`).join("")}` : ""}`;
}

async function loadDiscover() {
  ui.discoverLoaded = true;
  try {
    const [parks, leaders, weekly, following, followers] = await Promise.all([
      cloud.fetchParks(), cloud.fetchLeaderboard(), cloud.fetchWeekly(game.weekKey()),
      cloud.following(), cloud.followers()
    ]);
    ui.parks = parks; ui.leaders = leaders; ui.weekly = weekly;
    ui.following = following; ui.followers = followers;
    if (ui.online) {
      ui.weekEntry = await cloud.myWeeklyEntry(game.weekKey());
      ui.weekVote = await cloud.myWeeklyVote(game.weekKey());
    }
    if (!ui.parksUnsub) {
      ui.parksUnsub = cloud.subscribeParks((rows) => {
        ui.parks = rows;
        if (ui.panel === "discover" && ui.discoverTab === "parks") openPanel("discover", true);
      });
    }
  } catch (error) { /* offline is fine */ }
  if (ui.panel === "discover") openPanel("discover", true);
}

async function handleLike(uid) {
  try {
    const res = await cloud.toggleLike(uid);
    toast(res.liked ? "Liked" : "Like removed", res.liked ? "The keeper will see it." : "Fair enough.", "good");
    ui.parks = ui.parks.map((p) => p.uid === uid ? { ...p, likes: res.likes } : p);
    if (ui.panel === "discover") openPanel("discover", true);
  } catch (error) {
    toast("Likes", error.message || "Sign in to like parks.", "bad");
  }
}

async function handleFollow(uid, add) {
  try {
    if (add) await cloud.follow(uid); else await cloud.unfollow(uid);
    if (add) ui.following.push({ to: uid }); else ui.following = ui.following.filter((f) => f.to !== uid);
    openPanel("discover", true);
    toast(add ? "Following" : "Unfollowed", add ? "Their parks are easier to find now." : "Done.", "info");
  } catch (error) { toast("Friends", error.message, "bad"); }
}

async function handleVote(uid) {
  try {
    await cloud.voteWeekly(game.weekKey(), uid);
    ui.weekVote = uid;
    toast("Vote cast", "One vote per week. Thanks for playing fair.", "good");
    openPanel("discover", true);
  } catch (error) { toast("Vote", error.message, "bad"); }
}

async function handleWeeklySubmit() {
  try {
    const res = await cloud.submitWeekly(game.weekKey(), game.parkSnapshot());
    if (!res.ok) throw new Error(res.reason);
    ui.weekEntry = await cloud.myWeeklyEntry(game.weekKey());
    toast("Entered", "Your park is in this week's contest.", "good");
    openPanel("discover", true);
  } catch (error) { toast("Weekly contest", error.message || "Could not enter.", "bad"); }
}

/* ---------------------------------------------------------------------
   Profile
   --------------------------------------------------------------------- */
function renderProfile() {
  const h = game.hudData();
  const m = game.metrics();
  const challenges = game.challengeList();
  const unlocked = ACHIEVEMENTS.filter((a) => game.S.achievements[a.id]);
  const weeklyEntry = game.S.weekly;
  return head("Profile", ui.online ? `Signed in as ${ui.user ? ui.user.name : ""}` : "Playing as a guest")
    + `<div class="panel-body">
      <div class="stat-grid">
        <div class="stat-box"><small>Park level</small><b>${h.level}</b><div class="sub">${fmt(game.S.xp)} XP</div></div>
        <div class="stat-box"><small>Rating</small><b>${h.rating.toFixed(1)}</b><div class="sub">${game.S.likes} likes received</div></div>
        <div class="stat-box"><small>Visitors served</small><b>${fmt(m.visitorsServed)}</b><div class="sub">all time</div></div>
        <div class="stat-box"><small>Rides built</small><b>${fmt(m.ridesBuilt)}</b><div class="sub">${fmt(m.decorPlaced)} decorations</div></div>
      </div>

      <div class="rowline">
        <div class="grow"><b>${ui.online ? esc(ui.user.name) : "Guest keeper"}</b><small>${ui.online ? "Cloud save is on" : "Sign in to save and publish"}</small></div>
        ${ui.online
          ? `<button class="btn tiny soft" data-action="publish">Publish park</button>`
          : `<button class="btn tiny teal" data-action="signin">Sign in</button>`}
      </div>

      <div class="divider"></div>
      <div class="rowline">
        <div class="grow"><b>Weekly contest</b><small>Enter this week's build-off</small></div>
        <button class="btn tiny ${ui.weekEntry ? "soft" : "primary"}" data-action="weekly" ${!ui.online ? "disabled" : ""}>${ui.weekEntry ? "Entered" : "Enter"}</button>
      </div>

      <div class="divider"></div>
      <p class="eyebrow">Daily challenges</p>
      ${challenges.daily.map((c) => `<div class="challenge">
        <div class="grow"><b>${esc(c.text)}</b><small>${c.value} / ${c.goal}</small><div class="mini-bar"><i style="width:${Math.min(100, (c.value / c.goal) * 100)}%"></i></div></div>
        <button class="btn tiny ${c.done && !c.claimed ? "teal" : "soft"}" data-claim="${c.id}" ${!c.done || c.claimed ? "disabled" : ""}>${c.claimed ? "Done" : c.done ? "+" + c.coins : c.coins + "c"}</button>
      </div>`).join("")}

      <div class="divider"></div>
      <p class="eyebrow">Weekly challenges</p>
      ${challenges.weekly.map((c) => `<div class="challenge">
        <div class="grow"><b>${esc(c.text)}</b><small>${c.value} / ${c.goal}</small><div class="mini-bar"><i style="width:${Math.min(100, (c.value / c.goal) * 100)}%"></i></div></div>
        <button class="btn tiny ${c.done && !c.claimed ? "teal" : "soft"}" data-claim="${c.id}" ${!c.done || c.claimed ? "disabled" : ""}>${c.claimed ? "Done" : c.done ? "+" + c.coins : c.coins + "c"}</button>
      </div>`).join("")}

      <div class="divider"></div>
      <p class="eyebrow">Achievements · ${unlocked.length}/${ACHIEVEMENTS.length}</p>
      <div class="ach-grid">
        ${ACHIEVEMENTS.map((a) => `<div class="ach-card ${game.S.achievements[a.id] ? "on" : ""}">
          <span class="medal">${game.S.achievements[a.id] ? "🏅" : "🔒"}</span>
          <b>${esc(a.name)}</b><small>${esc(a.desc)}</small>
        </div>`).join("")}
      </div>

      <div class="divider"></div>
      <div class="stack">
        <button class="btn soft" data-action="settings">Settings & account</button>
        <button class="btn ghost" data-action="signout" ${!ui.online ? "disabled" : ""}>Sign out</button>
      </div>
      <p class="small muted" style="margin-top:10px;line-height:1.5">Daily challenges reset at midnight. Weekly ones reset on Monday. ${weeklyEntry && weeklyEntry.claimed ? "This week's rewards are claimed." : ""}</p>
    </div>`;
}

async function loadProfileExtras() {
  if (!ui.online) { ui.weekEntry = null; ui.weekVote = null; return; }
  try {
    const [entry, vote, following, followers] = await Promise.all([
      cloud.myWeeklyEntry(game.weekKey()), cloud.myWeeklyVote(game.weekKey()), cloud.following(), cloud.followers()
    ]);
    ui.weekEntry = entry; ui.weekVote = vote; ui.following = following; ui.followers = followers;
  } catch (error) { /* offline */ }
  if (ui.panel === "profile") openPanel("profile", true);
}

/* Profile button actions are delegated once. */
document.addEventListener("click", (event) => {
  const el = event.target.closest("[data-action]");
  if (!el) return;
  const action = el.dataset.action;
  if (action === "publish") publishParkNow();
  else if (action === "signin") { if (ui.hooks.showGate) ui.hooks.showGate(); }
  else if (action === "signout") { if (ui.hooks.signOut) ui.hooks.signOut(); }
  else if (action === "settings") openSettings();
  else if (action === "weekly") handleWeeklySubmit();
  else if (action === "delete-mode") {
    if (game.runtime.mode === "visit") { toast("Visiting", "Head back to your own park first.", "info"); return; }
    ui.tool = { kind: "delete" };
    game.runtime.tool = ui.tool;
    showHint("Remove: click a decoration, shop or ride to sell it · Esc stops", 0);
  }
  else if (action === "cam-top") setCamera("top");
});

async function publishParkNow() {
  try {
    await cloud.publishPark(game.parkSnapshot());
    toast("Park published", "Other keepers can now visit and like it.", "good");
    if (ui.online) await cloud.saveCloud(game.serialize());
  } catch (error) { toast("Publish", error.message || "Could not publish right now.", "bad"); }
}

/* ---------------------------------------------------------------------
   World interaction
   --------------------------------------------------------------------- */
function pickItem(typeId) {
  const def = DEF_BY_ID[typeId];
  if (!def) return;
  if (game.runtime.mode === "visit") { toast("Visiting", "Head back to your own park to build.", "info"); return; }
  if (!game.isUnlocked(def)) {
    toast("Locked", `${def.name} unlocks at level ${def.level}, or through research.`, "bad");
    return;
  }
  if (typeId === "custom-coaster" || typeId === "mine-coaster") {
    openCoaster(typeId);
    return;
  }
  if (game.S.coins < game.priceOf(def)) {
    toast("Not enough coins", `${def.name} costs ${fmt(game.priceOf(def))}.`, "bad");
    return;
  }
  ui.tool = { kind: "place", typeId, rot: 0, plan: null };
  game.runtime.tool = ui.tool;
  world.setCameraMode("build");
  showHint(`${def.name}: click to place · R rotates · click again for another · Esc stops`, 0);
  if (window.innerWidth < 900) collapsePanel();
}

function startPathTool(type, erase) {
  ui.tool = { kind: "path", pathType: type, erase: !!erase };
  game.runtime.tool = ui.tool;
  showHint(erase ? "Click or drag over paths to remove them · Esc stops" : "Click or drag to paint paths · Esc stops", 0);
  if (window.innerWidth < 900) collapsePanel();
}

function cancelTool() {
  ui.tool = null;
  game.runtime.tool = null;
  world.hideGhost();
  hideHint();
}

function onWorldHover(tile, objId) {
  if (!tile) return;
  ui.hover = { tile, objId };
  const t = ui.tool;
  if (t && (t.kind === "place" || t.kind === "move")) {
    const def = t.kind === "place" ? DEF_BY_ID[t.typeId] : game.defOf((game.S.objects.find((o) => o.id === t.id) || {}).type);
    if (!def) { world.hideGhost(); return; }
    const rot = t.kind === "move" ? (t.rot || 0) : t.rot;
    const size = game.rotationSize(def, rot);
    const i = tile.i - Math.floor((size[0] - 1) / 2);
    const j = tile.j - Math.floor((size[1] - 1) / 2);
    const check = t.kind === "place" ? game.canPlace(t.typeId, i, j, rot) : game.canPlace(def.id, i, j, rot, t.id);
    world.setGhost(def, i, j, rot, check.ok, t.plan);
    ui.hover.place = { i, j, rot, ok: check.ok, reason: check.reason };
  }
  if (t && t.kind === "path" && ui.painting) applyPath(tile);
}

function onWorldClick(tile, objId) {
  if (!tile) return;
  const t = ui.tool;
  if (game.runtime.mode === "visit") {
    toast("Visiting", "You are looking around someone else's park. Head back to build.", "info");
    return;
  }
  if (t && t.kind === "place") { placeCurrent(tile); return; }
  if (t && t.kind === "path") { applyPath(tile); return; }
  if (t && t.kind === "delete") { deleteAt(tile, objId); return; }
  if (t && t.kind === "move") { moveCurrent(tile); return; }
  if (objId) selectObject(objId);
  else if (ui.panel === "object") closePanel();
}

function placeCurrent(tile) {
  const t = ui.tool;
  const def = DEF_BY_ID[t.typeId];
  if (!def) return;
  if (game.runtime.mode === "visit") { toast("Visiting", "You can only build in your own park.", "info"); return; }
  const [w, h] = game.rotationSize(def, t.rot);
  const i = tile.i - Math.floor((w - 1) / 2);
  const j = tile.j - Math.floor((h - 1) / 2);
  const res = game.placeObject(t.typeId, i, j, t.rot, { plan: t.plan });
  if (!res.ok) { toast("Can't build there", res.reason || "Try another spot", "bad"); return; }
  world.addObject(res.object);
  renderHud(game.hudData());
  toast("Built", `${def.name} for ${fmt(res.cost)} coins.`, "good");
  if (t.typeId === "custom-coaster" || t.typeId === "mine-coaster") {
    cancelTool();
    openPanel("manage");
  } else {
    showHint(`${def.name}: click to place another · R rotates · Esc stops`, 0);
    saveSoon();
  }
}

function applyPath(tile) {
  const t = ui.tool;
  if (!t || t.kind !== "path") return;
  const res = t.erase ? game.removePath(tile.i, tile.j) : game.setPath(tile.i, tile.j, t.pathType);
  if (res.ok && !res.unchanged) {
    world.paintPaths(game.S.paths);
    renderHud(game.hudData());
    saveSoon();
  } else if (!res.ok && res.reason === "Not enough coins") {
    toast("Paths", "Not enough coins for that path.", "bad");
  }
}

function deleteAt(tile, objId) {
  if (objId) {
    const res = game.removeObject(objId);
    if (res.ok) {
      world.removeObjectMesh(objId);
      if (ui.selected === objId) { ui.selected = null; world.setSelected(null); }
      toast("Removed", `Refunded ${fmt(res.refund)} coins.`, "info");
      renderHud(game.hudData());
    }
    return;
  }
  const path = game.S.paths.find((p) => p.i === tile.i && p.j === tile.j);
  if (path) {
    game.removePath(tile.i, tile.j);
    world.paintPaths(game.S.paths);
    renderHud(game.hudData());
  }
}

function moveCurrent(tile) {
  const t = ui.tool;
  const obj = game.S.objects.find((o) => o.id === t.id);
  if (!obj) { cancelTool(); return; }
  const rot = t.rot === undefined ? obj.rot || 0 : t.rot;
  const size = game.rotationSize(game.defOf(obj.type), rot);
  const i = tile.i - Math.floor((size[0] - 1) / 2);
  const j = tile.j - Math.floor((size[1] - 1) / 2);
  const res = game.moveObject(obj.id, i, j, rot);
  if (!res.ok) { toast("Can't move there", res.reason, "bad"); return; }
  world.moveObjectMesh(obj);
  toast("Moved", game.defOf(obj.type).name + " is in its new spot.", "good");
  cancelTool();
  saveSoon();
  renderHud(game.hudData());
}

export function selectObject(id) {
  const obj = game.S.objects.find((o) => o.id === id);
  if (!obj) return;
  cancelTool();
  ui.selected = id;
  world.setSelected(id);
  openPanel("object");
}

function renderObjectPanel() {
  const obj = game.S.objects.find((o) => o.id === ui.selected);
  if (!obj) return head("Object", "Nothing selected") + `<div class="panel-body"><p class="small muted">Pick something in the park.</p></div>`;
  const def = game.defOf(obj.type);
  const kind = game.kindOf(def);
  const st = game.S.rideState[obj.id];
  return head(def.name, kind === "ride" ? CAT_LABEL[def.cat] + " attraction" : kind === "building" ? "Shop & facility" : "Decoration")
    + `<div class="panel-body">
      <div class="item-art" style="height:130px;border-radius:14px;margin-bottom:12px"><span class="emoji" style="font-size:64px">${artFor(def)}</span></div>
      <p class="small" style="line-height:1.5;margin:0 0 12px">${esc(def.desc || "")}</p>
      ${kind === "ride" ? `<div class="stat-grid">
        <div class="stat-box"><small>Ride price</small><b>${game.ridePriceFor(obj)}</b><div class="sub">coins per rider</div></div>
        <div class="stat-box"><small>Condition</small><b>${Math.round(st ? st.condition : 100)}%</b><div class="sub">${st && st.broken ? "broken down" : "running"}</div></div>
        <div class="stat-box"><small>Fun score</small><b>${def.fun}</b><div class="sub">capacity ${def.capacity}</div></div>
        <div class="stat-box"><small>Riders</small><b>${st ? fmt(st.served || 0) : 0}</b><div class="sub">queue ${st && st.queue ? st.queue.length : 0}</div></div>
      </div>` : `<div class="stat-grid">
        <div class="stat-box"><small>Appeal</small><b>+${def.appeal || 0}</b><div class="sub">to park rating</div></div>
        <div class="stat-box"><small>Daily upkeep</small><b>${def.upkeep || 0}</b><div class="sub">coins</div></div>
      </div>`}
      <div class="stack">
        ${kind === "ride" ? `<button class="btn teal" data-focus="${obj.id}">Ride camera</button>` : ""}
        ${kind === "ride" && (def.id === "custom-coaster" || def.id === "mine-coaster") ? `<button class="btn soft" data-edit-track="${obj.id}">Edit the track</button>` : ""}
        ${kind === "ride" && st && (st.broken || st.condition < 96) ? `<button class="btn soft" data-repair="${obj.id}">Service · ${fmt(120 + (100 - st.condition) * 9)} coins</button>` : ""}
        <button class="btn soft" data-move="${obj.id}">Move</button>
        <button class="btn danger" data-remove="${obj.id}">Sell · refund ${fmt(Math.round(game.priceOf(def) * 0.45))}</button>
      </div>
    </div>`;
}

/* Object panel actions */
document.addEventListener("click", (event) => {
  const el = event.target.closest("[data-move],[data-remove],[data-edit-track]");
  if (!el) return;
  if (el.dataset.move) {
    const obj = game.S.objects.find((o) => o.id === el.dataset.move);
    if (!obj) return;
    closePanel();
    ui.tool = { kind: "move", id: obj.id, rot: obj.rot || 0 };
    game.runtime.tool = ui.tool;
    showHint("Click the new spot · R rotates · Esc cancels", 0);
  } else if (el.dataset.remove) {
    const id = el.dataset.remove;
    const obj = game.S.objects.find((o) => o.id === id);
    if (!obj) return;
    confirmDialog("Sell this?", `${game.defOf(obj.type).name} will be removed and part of its price refunded.`, () => {
      const res = game.removeObject(id);
      if (res.ok) {
        world.removeObjectMesh(id);
        world.setSelected(null);
        ui.selected = null;
        closePanel();
        renderHud(game.hudData());
        toast("Sold", `${fmt(res.refund)} coins back.`, "info");
        saveSoon();
      }
    });
  } else if (el.dataset.editTrack) {
    const obj = game.S.objects.find((o) => o.id === el.dataset.editTrack);
    if (obj) openCoaster(obj.type, obj);
  }
});

function focusObject(id) {
  const obj = game.S.objects.find((o) => o.id === id);
  if (!obj) return;
  world.focusRide(obj);
  document.querySelectorAll(".camera-bar button").forEach((b) => b.classList.toggle("on", b.dataset.cam === "inspect"));
  toast("Ride camera", "Drag to orbit the ride. Camera buttons switch back.", "info");
}

function setCamera(mode) {
  document.querySelectorAll(".camera-bar button").forEach((b) => b.classList.toggle("on", b.dataset.cam === mode));
  if (mode === "inspect") {
    const obj = game.S.objects.find((o) => o.id === ui.selected)
      || game.S.objects.find((o) => game.kindOf(game.defOf(o.type)) === "ride");
    if (obj) world.focusRide(obj);
    else toast("Ride camera", "Build an attraction first.", "info");
    return;
  }
  world.setCameraMode(mode);
}

/* ---------------------------------------------------------------------
   Keyboard
   --------------------------------------------------------------------- */
function bindKeyboard() {
  window.addEventListener("keydown", (event) => {
    if (event.target && /input|textarea|select/i.test(event.target.tagName)) return;
    if (event.key === "r" || event.key === "R") {
      if (ui.tool && (ui.tool.kind === "place" || ui.tool.kind === "move")) {
        ui.tool.rot = ((ui.tool.rot || 0) + 1) % 4;
        if (ui.hover) onWorldHover(ui.hover.tile, ui.hover.objId);
        event.preventDefault();
      }
    }
    if (event.key === "Escape") {
      if ($("modals").children.length) closeModal();
      else if (ui.panel) closePanel();
      else cancelTool();
    }
    if ((event.key === "Delete" || event.key === "Backspace") && ui.selected) {
      const id = ui.selected;
      const res = game.removeObject(id);
      if (res.ok) {
        world.removeObjectMesh(id);
        world.setSelected(null);
        ui.selected = null;
        closePanel();
        renderHud(game.hudData());
        toast("Removed", `Refunded ${fmt(res.refund)} coins.`, "info");
      }
    }
    if (event.key === "b" || event.key === "B") openPanel("build");
    if (event.key === "m" || event.key === "M") openPanel("manage");
    if (event.key === "p" || event.key === "P") $("btn-open").click();
  });
}

/* ---------------------------------------------------------------------
   Hints & toasts
   --------------------------------------------------------------------- */
export function showHint(text, ms = 4500) {
  const hint = $("hint");
  if (!hint) return;
  hint.innerHTML = esc(text).replace(/R rotates/g, "<kbd>R</kbd> rotates").replace(/Esc/g, "<kbd>Esc</kbd>");
  hint.hidden = false;
  clearTimeout(ui.hintTimer);
  if (ms) ui.hintTimer = setTimeout(hideHint, ms);
}
export function hideHint() {
  const hint = $("hint");
  if (hint) hint.hidden = true;
}

export function toast(title, text, kind = "info") {
  const box = $("toasts");
  if (!box) return;
  const el = document.createElement("div");
  el.className = "toast " + (kind || "");
  el.innerHTML = `<span class="dot"></span><div><b>${esc(title)}</b>${text ? `<small>${esc(text)}</small>` : ""}</div>`;
  box.appendChild(el);
  while (box.children.length > 3) box.firstChild.remove();
  setTimeout(() => {
    el.style.transition = "opacity .3s, transform .3s";
    el.style.opacity = "0";
    el.style.transform = "translateY(6px)";
    setTimeout(() => el.remove(), 320);
  }, 3600);
}

function saveSoon() {
  game.saveLocal();
  if (ui.hooks.saveNow) ui.hooks.saveNow();
}

/* ---------------------------------------------------------------------
   Modals
   --------------------------------------------------------------------- */
export function openModal(html, opts = {}) {
  closeModal();
  const wrap = $("modals");
  const back = document.createElement("div");
  back.className = "modal-back";
  back.addEventListener("click", () => { if (opts.dismissible !== false) closeModal(); });
  const modal = document.createElement("div");
  modal.className = "modal " + (opts.wide ? "wide" : "");
  modal.innerHTML = html;
  wrap.append(back, modal);
  const closeBtn = modal.querySelector("[data-close-modal]");
  if (closeBtn) closeBtn.addEventListener("click", closeModal);
  return modal;
}

export function closeModal() {
  const wrap = $("modals");
  if (!wrap) return;
  wrap.innerHTML = "";
  ui.modal = null;
  if (ui.coasterAnim) { cancelAnimationFrame(ui.coasterAnim); ui.coasterAnim = null; }
}

function confirmDialog(title, text, onYes) {
  const modal = openModal(`<div class="modal-head"><div><h2>${esc(title)}</h2><p>${esc(text)}</p></div></div>
    <div class="modal-foot"><button class="btn ghost" data-close-modal>Cancel</button><button class="btn danger" id="confirm-yes">Yes, do it</button></div>`);
  modal.querySelector("#confirm-yes").addEventListener("click", () => { closeModal(); onYes(); });
}

/* ---------------------------------------------------------------------
   Rename, settings, sign in
   --------------------------------------------------------------------- */
function openRename() {
  const modal = openModal(`<div class="modal-head"><div><h2>Name your park</h2><p>It appears on the entrance sign and in discovery.</p></div></div>
    <div class="modal-body"><input id="rename-input" maxlength="24" value="${esc(game.S.name)}" style="width:100%;padding:12px;border-radius:12px;border:1px solid var(--line);font:inherit"></div>
    <div class="modal-foot"><button class="btn ghost" data-close-modal>Cancel</button><button class="btn primary" id="rename-save">Save name</button></div>`);
  const input = modal.querySelector("#rename-input");
  setTimeout(() => input.focus(), 50);
  const save = () => {
    const name = input.value.trim().slice(0, 24) || "Sunny Meadows";
    game.S.name = name;
    game.saveLocal(true);
    world.setLayout(game.S);
    renderHud(game.hudData());
    closeModal();
    toast("Renamed", "The sign is repainted.", "good");
    if (ui.hooks.saveNow) ui.hooks.saveNow();
  };
  modal.querySelector("#rename-save").addEventListener("click", save);
  input.addEventListener("keydown", (e) => { if (e.key === "Enter") save(); });
}

export function openSettings() {
  const modal = openModal(`<div class="modal-head"><div><h2>Settings</h2><p>Account, park and display.</p></div><button class="icon-btn" data-close-modal><svg><use href="#i-close"/></svg></button></div>
    <div class="modal-body">
      <div class="rowline"><div class="grow"><b>Sound effects</b><small>Ride and crowd sounds</small></div>
        <button class="btn tiny ${game.S.settings.sound ? "teal" : "soft"}" id="set-sound">${game.S.settings.sound ? "On" : "Off"}</button></div>
      <div class="rowline"><div class="grow"><b>Graphics</b><small>Shadows and detail</small></div>
        <select id="set-quality" style="padding:8px;border-radius:9px;border:1px solid var(--line);font:inherit">
          <option value="high" ${game.S.settings.quality === "high" ? "selected" : ""}>High</option>
          <option value="balanced" ${game.S.settings.quality === "balanced" ? "selected" : ""}>Balanced</option>
        </select></div>
      <div class="rowline"><div class="grow"><b>Park name</b><small>${esc(game.S.name)}</small></div>
        <button class="btn tiny soft" id="set-rename">Rename</button></div>
      <div class="divider"></div>
      ${ui.online ? `<div class="rowline"><div class="grow"><b>${esc(ui.user ? ui.user.name : "Signed in")}</b><small>Cloud save active</small></div>
        <button class="btn tiny soft" id="set-signout">Sign out</button></div>
        <button class="btn soft wide" id="set-publish" style="margin-top:8px">Publish park to discovery</button>`
      : `<p class="small muted" style="line-height:1.5">You are playing as a guest. Sign in to keep this park in the cloud, publish it and enter the weekly contest.</p>
         <button class="btn primary wide" id="set-signin">Sign in or create an account</button>`}
      <div class="divider"></div>
      <p class="eyebrow">Danger zone</p>
      <button class="btn danger wide" id="set-reset" style="margin-top:8px">Start a brand new park</button>
      <p class="small muted" style="margin-top:8px;line-height:1.4">This replaces the park on this device${ui.online ? " and in your cloud save" : ""}. It cannot be undone.</p>
    </div>`);
  modal.querySelector("#set-sound").addEventListener("click", (event) => {
    game.S.settings.sound = !game.S.settings.sound;
    event.currentTarget.textContent = game.S.settings.sound ? "On" : "Off";
    event.currentTarget.className = "btn tiny " + (game.S.settings.sound ? "teal" : "soft");
    game.saveLocal(true);
  });
  modal.querySelector("#set-quality").addEventListener("change", (event) => {
    game.S.settings.quality = event.target.value;
    world.renderer.shadowMap.enabled = event.target.value === "high";
    game.saveLocal(true);
  });
  modal.querySelector("#set-rename").addEventListener("click", () => { closeModal(); openRename(); });
  const reset = modal.querySelector("#set-reset");
  reset.addEventListener("click", () => {
    closeModal();
    confirmDialog("Start over?", "Your rides, coins and progress will be replaced by a fresh park.", () => {
      game.newPark(game.S.name === "Sunny Meadows" ? "Sunny Meadows" : game.S.name);
      game.clearVisitors();
      game.enterPark();
      world.setLayout(game.S);
      ui.selected = null;
      world.setSelected(null);
      closePanel();
      renderHud(game.hudData());
      if (ui.hooks.saveNow) ui.hooks.saveNow();
      toast("New park", "A clean field, an entrance and a carousel. Build well.", "good");
    });
  });
  const signin = modal.querySelector("#set-signin");
  if (signin) signin.addEventListener("click", () => { closeModal(); if (ui.hooks.showGate) ui.hooks.showGate(); });
  const signout = modal.querySelector("#set-signout");
  if (signout) signout.addEventListener("click", () => { closeModal(); if (ui.hooks.signOut) ui.hooks.signOut(); });
  const publish = modal.querySelector("#set-publish");
  if (publish) publish.addEventListener("click", () => { closeModal(); publishParkNow(); });
}

/* ---------------------------------------------------------------------
   Coaster workshop
   --------------------------------------------------------------------- */
export function openCoaster(typeId, existing) {
  const base = existing && existing.plan ? existing.plan : PLAN_DEFAULT;
  ui.coaster = {
    typeId: existing ? existing.type : typeId,
    editing: existing ? existing.id : null,
    stationY: base.stationY === undefined ? 2 : base.stationY,
    pieces: (base.pieces || []).slice(),
    testT: null
  };
  const modal = openModal(`<div class="modal-head"><div><h2>Coaster workshop</h2><p>Add pieces until the track returns to the station.</p></div><button class="icon-btn" data-close-modal><svg><use href="#i-close"/></svg></button></div>
    <div class="modal-body">
      <div class="coaster-layout">
        <div>
          <div class="coaster-canvas-wrap"><canvas id="coaster-canvas"></canvas></div>
          <div class="coaster-verdict" id="coaster-verdict" style="margin-top:10px">Add pieces…</div>
        </div>
        <div>
          <p class="eyebrow">Track pieces</p>
          <div class="coaster-pieces">
            ${PIECES.map((p) => `<button data-piece="${p.id}" title="${esc(p.desc)}"><b>${p.icon}</b>${p.label}</button>`).join("")}
          </div>
          <div class="coaster-stats" id="coaster-stats"></div>
          <div class="stack">
            <button class="btn tiny ghost" data-cpiece="undo">Undo last</button>
            <button class="btn tiny ghost" data-cpiece="clear">Clear track</button>
            <button class="btn tiny soft" id="coaster-test">Test the train</button>
          </div>
        </div>
      </div>
    </div>
    <div class="modal-foot">
      <button class="btn ghost" data-close-modal>Cancel</button>
      <button class="btn primary" id="coaster-save">${existing ? "Save changes" : "Build coaster"}</button>
    </div>`, { wide: true });

  const canvas = modal.querySelector("#coaster-canvas");
  const draw = () => {
    const wrap = canvas.parentElement;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.max(200, wrap.clientWidth * dpr);
    canvas.height = Math.max(220, wrap.clientHeight * dpr);
    const ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const stats = simulatePlan(ui.coaster);
    drawPlan(ctx, ui.coaster, wrap.clientWidth, wrap.clientHeight, {
      valid: stats.ok,
      testT: ui.coaster.testT,
      color: stats.ok ? "#e76f51" : "#b23a48"
    });
    modal.querySelector("#coaster-verdict").className = "coaster-verdict " + (stats.ok ? "good" : "bad");
    modal.querySelector("#coaster-verdict").textContent = stats.ok
      ? `Lap ${stats.time.toFixed(1)}s · ${Math.round(stats.topKmh)} km/h · ${stats.length.toFixed(0)} m of track. Excitement ${stats.excitement}/100.`
      : stats.reason;
    modal.querySelector("#coaster-stats").innerHTML = `
      <div><small>Pieces</small><b>${ui.coaster.pieces.length}</b></div>
      <div><small>Closed</small><b>${stats.ok ? "Yes" : "No"}</b></div>
      <div><small>Top speed</small><b>${Math.round(stats.topKmh || 0)}</b><small>km/h</small></div>
      <div><small>Drop</small><b>${(stats.maxDrop || 0).toFixed(0)}</b><small>m</small></div>`;
    modal.querySelector("#coaster-save").disabled = !stats.ok;
    return stats;
  };
  const refresh = () => { ui.coaster.testT = null; draw(); };

  modal.addEventListener("click", (event) => {
    const piece = event.target.closest("[data-piece]");
    if (piece) {
      if (ui.coaster.pieces.length >= 40) { toast("Workshop", "That is as long as the welding shop will go.", "info"); return; }
      ui.coaster.pieces.push(piece.dataset.piece);
      refresh();
      return;
    }
    const act = event.target.closest("[data-cpiece]");
    if (act) {
      if (act.dataset.cpiece === "undo") ui.coaster.pieces.pop();
      else ui.coaster.pieces = [];
      refresh();
    }
  });

  modal.querySelector("#coaster-test").addEventListener("click", () => {
    const stats = simulatePlan(ui.coaster);
    if (!stats.ok) { toast("Not ready", stats.reason, "bad"); return; }
    if (ui.coasterAnim) cancelAnimationFrame(ui.coasterAnim);
    const start = performance.now();
    const step = () => {
      const t = (performance.now() - start) / (Math.max(4, stats.time) * 1000);
      ui.coaster.testT = t % 1;
      draw();
      if (!ui.modal) return;
      ui.coasterAnim = requestAnimationFrame(step);
    };
    ui.modal = true;
    step();
    toast("Test run", `${Math.round(stats.topKmh)} km/h at the bottom of the drop.`, "good");
  });

  modal.querySelector("#coaster-save").addEventListener("click", () => {
    const stats = simulatePlan(ui.coaster);
    if (!stats.ok) return;
    const c = ui.coaster;
    const buildCost = game.priceOf(DEF_BY_ID[c.typeId]);
    if (c.editing) {
      const obj = game.S.objects.find((o) => o.id === c.editing);
      if (obj) {
        obj.plan = { stationY: c.stationY, pieces: c.pieces.slice() };
        world.removeObjectMesh(obj.id);
        world.addObject(obj);
        game.saveLocal(true);
        if (ui.hooks.saveNow) ui.hooks.saveNow();
        toast("Track updated", `Excitement ${stats.excitement}/100.`, "good");
      }
      closeModal();
      return;
    }
    if (game.S.coins < buildCost) { toast("Not enough coins", "The workshop needs " + fmt(buildCost) + " coins for the track and train.", "bad"); return; }
    ui.tool = { kind: "place", typeId: c.typeId, rot: 0, plan: { stationY: c.stationY, pieces: c.pieces.slice() } };
    game.runtime.tool = ui.tool;
    closeModal();
    showHint("Click a clear 6×6 patch for the station · R rotates · Esc cancels", 0);
  });

  ui.modal = modal;
  requestAnimationFrame(draw);
  setTimeout(draw, 60);
  return modal;
}

/* ---------------------------------------------------------------------
   Main menu
   --------------------------------------------------------------------- */
function bindMenu() {
  $("menu-play").addEventListener("click", hideMenu);
  $("menu-close").addEventListener("click", hideMenu);
  $("menu-build").addEventListener("click", () => { hideMenu(); openPanel("build"); });
  $("menu-discover").addEventListener("click", () => { hideMenu(); openPanel("discover"); });
  $("menu-weekly").addEventListener("click", () => { hideMenu(); ui.discoverTab = "weekly"; openPanel("discover"); });
  $("menu-settings").addEventListener("click", () => { hideMenu(); openSettings(); });
}

export function showMenu() {
  renderMenuStats();
  const tip = TIPS[Math.floor(Math.random() * TIPS.length)];
  $("menu-tip").textContent = "Tip: " + tip;
  $("menu").hidden = false;
  $("menu-account").textContent = ui.online
    ? `Signed in as ${ui.user ? ui.user.name : "keeper"} · cloud save on`
    : "Guest park · saved on this device";
}
export function hideMenu() { $("menu").hidden = true; }

/* ---------------------------------------------------------------------
   Visiting
   --------------------------------------------------------------------- */
let visitBanner = null;

async function handleVisit(uid) {
  try {
    const park = await cloud.fetchPark(uid);
    if (!park) { toast("Visit", "That park is not published any more.", "bad"); return; }
    let layout;
    try { layout = JSON.parse(park.layout || "{}"); } catch (error) { layout = null; }
    if (!layout || !Array.isArray(layout.objects) || layout.objects.length > 420 || (layout.paths && layout.paths.length > 3000)) {
      toast("Visit", "The park layout could not be read.", "bad");
      return;
    }
    game.saveLocal(true);
    game.runtime.started = false;
    game.runtime.mode = "visit";
    game.clearVisitors();
    world.setLayout({ objects: layout.objects, paths: layout.paths || [], land: layout.land || 8, name: layout.name || park.name });
    world.setCameraMode("overview");
    ui.visiting = { uid, name: park.name, owner: park.owner, likes: park.likes };
    showVisitBanner(park);
    closePanel();
    if (window.innerWidth < 900) hideMenu();
    toast("Visiting", `${park.name} by ${park.owner || "a keeper"}.`, "good");
  } catch (error) {
    toast("Visit", error.message || "Could not open that park.", "bad");
  }
}

function showVisitBanner(park) {
  hideVisitBanner();
  visitBanner = document.createElement("div");
  visitBanner.className = "visit-banner";
  visitBanner.innerHTML = `<span>Visiting <b>${esc(park.name)}</b> by ${esc(park.owner || "a keeper")}</span>
    <button id="visit-like"><svg style="width:12px;height:12px"><use href="#i-heart"/></svg> ${fmt(park.likes || 0)}</button>
    <button id="visit-home">Back to my park</button>`;
  $("app").appendChild(visitBanner);
  visitBanner.querySelector("#visit-like").addEventListener("click", () => handleLike(park.uid));
  visitBanner.querySelector("#visit-home").addEventListener("click", leaveVisit);
}

function hideVisitBanner() {
  if (visitBanner) { visitBanner.remove(); visitBanner = null; }
}

export function leaveVisit() {
  if (game.runtime.mode !== "visit") return;
  game.runtime.mode = "park";
  game.runtime.started = true;
  ui.visiting = null;
  world.setLayout(game.S);
  world.setCameraMode("orbit");
  hideVisitBanner();
  renderHud(game.hudData());
  toast("Home", "Back in your own park.", "info");
}

/* ---------------------------------------------------------------------
   Refresh
   --------------------------------------------------------------------- */
export function refreshAll() {
  renderHud(game.hudData());
  if (ui.panel) openPanel(ui.panel, true);
  if (!$("menu").hidden) renderMenuStats();
}

/* The boot module talks to one object; bind the exported functions to it
   so both styles work from anywhere. */
Object.assign(ui, {
  initUI, setOnline, renderHud, openPanel, closePanel, selectObject, toast,
  showHint, hideHint, openSettings, openCoaster, showMenu, hideMenu,
  refreshAll, leaveVisit, openModal, closeModal
});
