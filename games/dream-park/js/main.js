/* =====================================================================
   DREAM PARK — boot
   The sign-in gate, the cloud session, the animation loop and the wiring
   between the simulation, the 3D world and the interface.
   ===================================================================== */
import * as game from "./game.js";
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

/* ---------------------------------------------------------------------
   Boot
   --------------------------------------------------------------------- */
async function main() {
  const local = game.readLocal();
  const hadLocal = !!local;
  if (local) {
    try { game.loadState(local); } catch (error) { game.newPark("Sunny Meadows"); }
  } else {
    game.newPark("Sunny Meadows");
  }

  try {
    world.initWorld($("gl"));
    world.setLayout(game.S);
    world.setCameraMode("overview");
  } catch (error) {
    console.error("Dream Park: the 3D park could not start", error);
    const line = $("boot-line");
    if (line) line.textContent = "This browser could not start WebGL. Try another browser or device.";
  }

  ui.initUI({ showGate, signOut, saveNow });
  game.setHooks({
    onHud: (data) => ui.renderHud(data),
    onToast: (title, text, kind) => ui.toast(title, text, kind),
    onSave: () => saveNow(),
    onState: () => {},
    onLevel: (lvl) => ui.toast("Level " + lvl, "A research point and new rides in the shop.", "good"),
    onDay: (report) => ui.toast("Day " + report.day + " done", report.served + " guests · " + fmtCoins(report.income) + " in, " + fmtCoins(report.expense) + " out.", "info"),
    onOpenChange: () => ui.renderHud(game.hudData())
  });
  bindGate();
  bindMenuOnce();
  window.addEventListener("resize", () => world.resizeWorld());
  requestAnimationFrame(loop);

  let cloudReady = false;
  let session = null;
  try {
    cloudReady = await Promise.race([
      cloud.init(),
      new Promise((resolve) => setTimeout(() => resolve(false), 4500))
    ]);
    if (cloudReady) session = await cloud.restore();
  } catch (error) {
    console.warn("Dream Park: cloud unavailable", error);
  }

  hideBoot();

  if (session && !session.guest) {
    await adoptAccount(session, hadLocal);
    start();
  } else if (hadLocal) {
    ui.setOnline(false, null);
    start();
    ui.toast("Welcome back", "Everything is where you left it.", "good");
  } else {
    showGate(false);
  }

  if (!cloudReady) {
    const note = $("gate-note");
    if (note) note.textContent = "Online parks are unreachable right now, so you can build on this device. Progress saves locally.";
  }

  setInterval(() => {
    if (ui.online && cloud.isSignedIn() && game.runtime.mode !== "visit" && !document.hidden) syncCloud();
  }, 60000);

  window.__dreampark = { game, world, cloud, ui, CONFIG };
}

function fmtCoins(n) { return Math.round(Number(n) || 0).toLocaleString("en-US"); }

function hideBoot() {
  const boot = $("boot");
  if (!boot) return;
  boot.classList.add("gone");
  setTimeout(() => { boot.hidden = true; }, 460);
}

function start() {
  started = true;
  game.enterPark();
  game.saveLocal(true);
  $("app").hidden = false;
  $("gate").hidden = true;
  ui.refreshAll();
  ui.showMenu();
}

/* ---------------------------------------------------------------------
   Accounts
   --------------------------------------------------------------------- */
async function adoptAccount(session, hadLocal) {
  let remote = null;
  try { remote = await cloud.loadCloud(session.uid); } catch (error) { /* offline */ }
  const remoteNewer = remote && (remote.lastSeen || 0) > (game.S.lastSeen || 0);
  if (remoteNewer) {
    game.clearVisitors();
    game.loadState(remote);
    world.setLayout(game.S);
    game.enterPark();
    ui.toast("Cloud park loaded", "This is the newest version of your park.", "good");
  } else if (hadLocal) {
    // keep the local park and push it up
    game.S.uid = session.uid;
  }
  game.S.uid = session.uid;
  ui.setOnline(true, session);
  syncCloud();
}

function bindGate() {
  const tabs = document.querySelectorAll(".gate-tabs button");
  tabs.forEach((tab) => tab.addEventListener("click", () => {
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
    submit.innerHTML = (gateMode === "up" ? "Creating…" : "Signing in…");
    try {
      const session = await cloud.signIn(name, pass, gateMode === "up");
      await adoptAccount(session, game.hasSave());
      if (!started) start();
      else { $("gate").hidden = true; ui.refreshAll(); }
      ui.toast(gateMode === "up" ? "Account created" : "Signed in", "Your park is now saved in the cloud.", "good");
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
      ui.toast("Guest park", "Saved on this device. Sign in any time to sync it.", "good");
    }
  });
  const close = $("gate-close");
  if (close) close.addEventListener("click", () => { if (started) hideGate(); });
  $("gate-back").addEventListener("click", () => { if (started) hideGate(); });
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
    ? "Pick the park-keeper name others will see. Passwords need at least six characters."
    : "Guest parks live on this device. Sign in to keep your park everywhere and visit others.";
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
  ui.toast("Signed out", "This park stays on this device as a guest park.", "info");
  showGate();
}

/* ---------------------------------------------------------------------
   Cloud sync
   --------------------------------------------------------------------- */
function saveNow() {
  if (!ui.online || game.runtime.mode === "visit") return;
  clearTimeout(syncTimer);
  syncTimer = setTimeout(syncCloud, 9000);
}

async function syncCloud() {
  if (!ui.online || !cloud.isSignedIn()) return;
  try {
    await cloud.saveCloud(game.serialize());
    const likes = await cloud.publishPark(game.parkSnapshot());
    if (typeof likes === "number" && likes !== game.S.likes) {
      const rose = likes > game.S.likes;
      game.S.likes = likes;
      if (rose) game.checkAchievements();
    }
    await cloud.touchParkPresence();
  } catch (error) {
    if (!ui.syncing) console.warn("Dream Park: sync failed", error);
  }
}

/* ---------------------------------------------------------------------
   Frame loop
   --------------------------------------------------------------------- */
function loop(now) {
  requestAnimationFrame(loop);
  const time = now || performance.now();
  if (!last) last = time;
  const dt = Math.min(0.05, Math.max(0.001, (time - last) / 1000));
  last = time;
  try {
    if (started && game.runtime.started && game.runtime.mode !== "visit") game.tick(dt);
    syncVisitorMeshes();
    syncStaffMeshes();
    world.update(dt, game.S);
    world.setDayPhase(game.S.dayProgress);
  } catch (error) {
    if (!frameErrorLogged) {
      console.error("Dream Park: frame error", error);
      frameErrorLogged = true;
    }
  }
}

function syncVisitorMeshes() {
  for (const v of game.runtime.visitors) {
    if (!v.mesh) {
      try { v.mesh = world.createVisitorMesh(v.look); } catch (error) { continue; }
    }
    world.updateVisitor(v);
    world.setVisitorVisible(v, v.state !== "riding" && v.state !== "leaving");
  }
}

function syncStaffMeshes() {
  for (const s of game.runtime.staffMeshes) {
    if (s.mesh) continue;
    try {
      s.mesh = world.createStaffMesh(s.role);
      const paths = game.S.paths;
      if (paths.length) {
        const p = paths[Math.floor(Math.random() * paths.length)];
        const c = game.tileCenter(p.i, p.j);
        s.x = c.x; s.z = c.z;
        s.mesh.group.position.set(c.x, 0, c.z);
      }
    } catch (error) { /* one bad model must not stop the loop */ }
  }
}

/* ---------------------------------------------------------------------
   Small fixes
   --------------------------------------------------------------------- */
function bindMenuOnce() {
  // The main menu is also the pause screen; Escape opens it when nothing
  // else is on top.
  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    const modals = $("modals");
    if (modals && modals.children.length) return;
    if (ui.panel) return;
    if (!started) return;
    if ($("menu").hidden) ui.showMenu(); else ui.hideMenu();
  });
}

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
  console.error("Dream Park failed to start", error);
  window.__dpBootError = String((error && (error.stack || error.message)) || error);
  const line = $("boot-line");
  if (line) line.textContent = "Something went wrong opening the park. Refresh to try again.";
  setTimeout(hideBoot, 1400);
});
