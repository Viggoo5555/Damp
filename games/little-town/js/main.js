/* =====================================================================
   LITTLE TOWN — boot
   The sign-in gate, cloud session, animation loop, resident meshes and
   the wiring between simulation, world and interface.
   ===================================================================== */
import * as game from "./town.js";
import * as world from "./world.js";
import * as cloud from "./cloud.js";
import { ui } from "./ui.js";
import { CONFIG } from "./config.js";

const $ = (id) => document.getElementById(id);
let started = false;
let gateMode = "in";
let busy = false;
let last = 0;
let syncTimer = null;
let frameErrorLogged = false;
let lastSeason = null;
let countSync = 0;

async function main() {
  const local = game.readLocal();
  const hadLocal = !!local;
  if (local) {
    try { game.loadState(local); } catch (error) { game.newTown("Willow Green"); }
  } else {
    game.newTown("Willow Green");
  }

  try {
    world.initWorld($("gl"));
    world.setLayout(game.S);
    world.setCameraMode("overview");
  } catch (error) {
    console.error("Little Town: the 3D valley could not start", error);
    const line = $("boot-line");
    if (line) line.textContent = "This browser could not start WebGL. Try another browser or device.";
  }

  ui.initUI({ showGate, signOut, saveNow, syncNow, resetTown });
  game.setHooks({
    onHud: (data) => ui.renderHud(data),
    onToast: (title, text, kind) => ui.toast(title, text, kind),
    onSave: () => saveNow(),
    onState: () => {},
    onLevel: (lvl) => ui.toast("Level " + lvl, "New buildings and 280 coins per level.", "good"),
    onDay: (report) => ui.toast("Day " + report.day + " complete", report.population + " residents · " + fmt(report.income) + " in, " + fmt(report.expense) + " out.", "info")
  });
  bindGate();
  window.addEventListener("resize", () => world.resizeWorld());
  requestAnimationFrame(loop);

  let cloudReady = false;
  let session = null;
  try {
    cloudReady = await Promise.race([cloud.init(), new Promise((resolve) => setTimeout(() => resolve(false), 4500))]);
    if (cloudReady) session = await cloud.restore();
  } catch (error) {
    console.warn("Little Town: cloud unavailable", error);
  }

  hideBoot();

  if (session && !session.guest) {
    await adoptAccount(session, hadLocal);
    start();
  } else if (hadLocal) {
    ui.setOnline(false, null);
    start();
    ui.toast("Welcome back", "Willow Green is just as you left it.", "good");
  } else {
    showGate(false);
  }

  if (!cloudReady) {
    const note = $("gate-note");
    if (note) note.textContent = "The online town board is unreachable right now, so you can build on this device. Progress saves locally.";
  }

  setInterval(() => {
    if (ui.online && cloud.isSignedIn() && game.runtime.mode !== "visit" && !document.hidden) syncCloud();
  }, 60000);

  window.__littletown = { game, world, cloud, ui, CONFIG };
}

function fmt(n) { return Math.round(Number(n) || 0).toLocaleString("en-US"); }

function hideBoot() {
  const boot = $("boot");
  if (!boot) return;
  boot.classList.add("gone");
  setTimeout(() => { boot.hidden = true; }, 460);
}

function start() {
  started = true;
  game.enterTown();
  game.saveLocal(true);
  $("app").hidden = false;
  $("gate").hidden = true;
  ui.refreshAll();
  ui.showMenu();
  lastSeason = game.season().id;
}

/* ---------------------------------------------------------------------
   Accounts
   --------------------------------------------------------------------- */
async function adoptAccount(session, hadLocal) {
  let remote = null;
  try { remote = await cloud.loadCloud(session.uid); } catch (error) { /* offline */ }
  // A cloud town belongs to this account: never replace it with an unrelated
  // guest town that merely happens to be on this device. A local save made by
  // this same account can still be newer (for example after an offline stint).
  const localUid = game.S && game.S.uid;
  const keepLocal = !!remote && hadLocal && localUid === session.uid
    && (game.S.lastSeen || 0) >= (remote.lastSeen || 0);
  if (remote && !keepLocal) {
    game.clearResidents();
    game.loadState(remote);
    world.clearResidentMeshes();
    world.setLayout(game.S);
    game.enterTown();
    ui.toast("Cloud town loaded", "Welcome back to your saved town.", "good");
  } else if (hadLocal) {
    game.S.uid = session.uid;
    if (!remote) ui.toast("Cloud save created", "This device's town is now saved to your account.", "good");
  }
  game.S.uid = session.uid;
  ui.setOnline(true, session);
  syncCloud();
}

function bindGate() {
  document.querySelectorAll(".gate-tabs button").forEach((tab) => tab.addEventListener("click", () => {
    gateMode = tab.dataset.gate === "up" ? "up" : "in";
    setGateMode(gateMode);
    gateError("");
  }));
  $("gate-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    if (busy) return;
    const name = $("gate-name").value.trim();
    const pass = $("gate-pass").value;
    gateError("");
    busy = true;
    const submit = $("gate-submit");
    submit.disabled = true;
    submit.innerHTML = gateMode === "up" ? "Creating…" : "Signing in…";
    try {
      const session = await cloud.signIn(name, pass, gateMode === "up");
      await adoptAccount(session, game.hasSave());
      if (!started) start();
      else { $("gate").hidden = true; ui.refreshAll(); }
      ui.toast(gateMode === "up" ? "Account created" : "Signed in", "Your town is now saved in the cloud.", "good");
      hideGate();
    } catch (error) {
      gateError(cloud.friendlyAuthError(error));
    } finally {
      busy = false;
      submit.disabled = false;
      setGateMode(gateMode);
    }
  });
  $("gate-guest").addEventListener("click", () => {
    if (busy) return;
    hideGate();
    if (!started) {
      ui.setOnline(false, null);
      start();
      ui.toast("Guest town", "Saved on this device. Sign in any time to sync it.", "good");
    }
  });
  const close = $("gate-close");
  if (close) close.addEventListener("click", () => { if (started) hideGate(); });
  $("gate-back").addEventListener("click", (event) => {
    if (started) { event.preventDefault(); hideGate(); }
  });
}

function setGateMode(mode) {
  document.querySelectorAll(".gate-tabs button").forEach((tab) => {
    const on = (tab.dataset.gate === "up" ? "up" : "in") === mode;
    tab.classList.toggle("on", on);
    tab.setAttribute("aria-selected", on ? "true" : "false");
  });
  const submit = $("gate-submit");
  submit.innerHTML = (mode === "up" ? "Create my account" : "Sign in") + ' <svg><use href="#i-arrow"/></svg>';
  $("gate-pass").autocomplete = mode === "up" ? "new-password" : "current-password";
  $("gate-note").textContent = mode === "up"
    ? "Pick the mayor name others will see. Passwords need at least six characters."
    : "Guest towns live on this device. Sign in to keep your town everywhere and visit others.";
}

function gateError(message) {
  const box = $("gate-error");
  if (!box) return;
  box.textContent = message || "";
  box.hidden = !message;
}

function showGate() {
  if (!started) gateMode = "in";
  setGateMode(gateMode);
  $("gate").hidden = false;
  $("gate-name").value = ui.online && ui.user ? ui.user.name : "";
  $("gate-pass").value = "";
  gateError("");
  const close = $("gate-close");
  if (close) close.hidden = !started;
  setTimeout(() => { if (!$("gate").hidden) $("gate-name").focus(); }, 80);
}
function hideGate() { $("gate").hidden = true; }

async function signOut() {
  await cloud.signOut();
  ui.setOnline(false, null);
  game.S.uid = null;
  game.saveLocal(true);
  ui.refreshAll();
  ui.toast("Signed out", "This town stays on this device as a guest town.", "info");
  showGate();
}

/* ---------------------------------------------------------------------
   Save & sync
   --------------------------------------------------------------------- */
function saveNow() {
  if (game.runtime.mode === "visit") return;
  clearTimeout(syncTimer);
  syncTimer = setTimeout(syncCloud, 9000);
}
function syncNow() {
  clearTimeout(syncTimer);
  syncCloud();
  game.saveLocal(true);
}
async function syncCloud() {
  if (!ui.online || !cloud.isSignedIn() || game.runtime.mode === "visit") return;
  try {
    ui.syncing = true;
    await cloud.saveCloud(game.serialize());
    const likes = await cloud.publishTown(game.townSnapshot());
    if (typeof likes === "number" && likes !== game.S.likes) {
      const rose = likes > game.S.likes;
      game.S.likes = likes;
      if (rose) game.checkAchievements();
      ui.renderHud(game.hudData());
    }
    await cloud.touchTownPresence();
  } catch (error) {
    if (countSync < 3) console.warn("Little Town: sync failed", error);
  } finally {
    ui.syncing = false;
    countSync++;
  }
}

function resetTown() {
  game.clearResidents();
  world.clearResidentMeshes();
  game.newTown("Willow Green");
  world.setLayout(game.S);
  world.setCameraMode("overview");
  game.enterTown();
  ui.refreshAll();
  ui.closePanel();
  ui.showMenu();
  ui.toast("A fresh start", "The starter cottage is waiting for its first neighbours.", "good");
  if (ui.online) syncNow();
}

/* ---------------------------------------------------------------------
   Frame
   --------------------------------------------------------------------- */
function loop(now) {
  requestAnimationFrame(loop);
  const time = now || performance.now();
  if (!last) last = time;
  const dt = Math.min(0.06, Math.max(0.001, (time - last) / 1000));
  last = time;
  try {
    if (started && game.runtime.started && game.runtime.mode !== "visit") game.tick(dt);
    syncResidents();
    const seasonId = game.S ? game.season().id : "summer";
    if (!ui.visit && seasonId !== lastSeason) {
      lastSeason = seasonId;
      world.setLayout(game.S);
      if (ui.panel === "object") ui.refreshAll();
    }
    world.update(dt);
  } catch (error) {
    if (!frameErrorLogged) {
      console.error("Little Town: frame error", error);
      frameErrorLogged = true;
    }
  }
}

const rendered = new Map();
function syncResidents() {
  if (!world.world.ready) return;
  const active = new Set();
  for (const res of game.runtime.residents) {
    active.add(res.id);
    if (!res.mesh) {
      try { res.mesh = world.createResidentMesh(res.look); } catch (error) { continue; }
    }
    world.updateResidentMesh(res);
    rendered.set(res.id, res);
  }
  for (const [id, res] of rendered) {
    if (!active.has(id)) {
      world.removeResidentMesh(res);
      rendered.delete(id);
    }
  }
}

/* ---------------------------------------------------------------------
   Global keys and lifecycle
   --------------------------------------------------------------------- */
document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    try { game.saveLocal(true); } catch (error) { /* ignore */ }
    if (ui.online) syncCloud();
  } else if (started) {
    ui.refreshAll();
  }
});
window.addEventListener("pagehide", () => { try { game.saveLocal(true); } catch (error) { /* ignore */ } });
window.addEventListener("beforeunload", () => { try { game.saveLocal(true); } catch (error) { /* ignore */ } });

main().catch((error) => {
  console.error("Little Town failed to start", error);
  window.__ltBootError = String((error && (error.stack || error.message)) || error);
  const line = $("boot-line");
  if (line) line.textContent = "Something went wrong opening the town. Refresh to try again.";
  setTimeout(hideBoot, 1400);
});
