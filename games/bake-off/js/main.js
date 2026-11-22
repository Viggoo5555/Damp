/* =====================================================================
   BAKE OFF! — boot
   The login gate, the cloud session, the animation loop and the wiring
   between the kitchen, the game and the interface.
   ===================================================================== */
import * as game from "./game.js";
import * as cloud from "./cloud.js";
import * as world from "./scene.js";
import { ui } from "./ui.js";
import * as match from "./match.js";
import { CONFIG } from "./config.js";

const $ = (id) => document.getElementById(id);
const bootLines = [
  "Heating the oven…",
  "Sifting the flour…",
  "Warming the ganache…",
  "Choosing today's theme…"
];
let bootStep = 0;
let gateMode = "in";
let busy = false;
let started = false;
let last = 0;
let presenceTimer = null;
let inviteUnsub = null;
let lastInviteKey = "";

/* ---------------------------------------------------------------------
   Boot
   --------------------------------------------------------------------- */
async function main() {
  const bootLine = $("boot-line");
  const bootTimer = setInterval(() => {
    bootStep = (bootStep + 1) % bootLines.length;
    if (bootLine) bootLine.textContent = bootLines[bootStep];
  }, 800);

  const hadSave = game.loadLocal();
  if (!game.S.name || game.S.name === "Guest baker") {
    const stored = localStorage.getItem(CONFIG.storageKey + "-name");
    if (stored) game.S.name = stored.slice(0, 20);
  }

  try {
    world.initWorld($("gl"));
    world.placeChef(game.chefCosmetics());
    world.setMode("wide");
  } catch (error) {
    console.error("Bake Off: the 3D kitchen could not start", error);
    if (bootLine) bootLine.textContent = "This browser could not start WebGL. Try a different one.";
  }

  ui.initUI();
  ui.showGateHook({ show: showGate });
  match.initialiseMatch();
  game.setHooks({
    onToast: (title, text, kind) => ui.toast(title, text, kind),
    onPhaseEnd: (phase) => match.onPhaseEnd(phase),
    onDesignChange: () => match.onDesignChange(),
    onCelebrate: () => { try { world.celebrate(); } catch (error) { /* ignore */ } }
  });
  bindGate();
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
    console.warn("Bake Off: cloud unavailable", error);
  }

  clearInterval(bootTimer);
  hideBoot();

  if (session && !session.guest) {
    await enterWithAccount(session, hadSave);
  } else if (hadSave && game.S.stats.bakes > 0) {
    enterAsGuest(true);
  } else {
    showGate(false);
  }

  if (!cloudReady) {
    const note = $("gate-note");
    if (note) note.textContent = "The online kitchen is unreachable right now, so you can bake on this device. Practice pays coins and XP just the same.";
  } else {
    presenceTimer = setInterval(() => {
      if (ui.online && !match.isInMatch()) cloud.presence("lobby");
    }, 20000);
  }
}

function hideBoot() {
  const boot = $("boot");
  if (boot) {
    boot.classList.add("gone");
    setTimeout(() => { boot.hidden = true; }, 520);
  }
}

async function enterWithAccount(session, hadSave) {
  const remote = await cloud.loadProfile(session.uid);
  if (remote && (remote.xp || 0) >= game.S.xp) {
    game.hydrateProfile({ ...remote, name: remote.name || session.name });
  } else {
    game.S.uid = session.uid;
    if (!game.S.name || game.S.name === "Guest baker") game.S.name = session.name;
    if (game.S.coins > 0) cloud.saveProfile(game.packProfile()).catch(() => {});
  }
  game.S.uid = session.uid;
  if (!game.S.name || game.S.name === "Guest baker") game.S.name = session.name;
  ui.online = true;
  started = true;
  game.runtime.ready = true;
  $("app").hidden = false;
  $("gate").hidden = true;
  game.checkDay();
  game.saveLocal(true);
  ui.refreshAll();
  ui.toast(hadSave ? "Welcome back" : "You're in", `${session.name} — the ovens are hot.`, "good");
  cloud.presence("lobby");
  watchInvites();
  cloud.fetchTopPlayers().then((rows) => { ui.leaderboard = rows; }).catch(() => {});
}

function enterAsGuest(returning) {
  started = true;
  game.runtime.ready = true;
  if (!game.S.name || game.S.name === "Guest baker") game.S.name = "Guest baker";
  $("app").hidden = false;
  $("gate").hidden = true;
  game.checkDay();
  ui.online = false;
  ui.refreshAll();
  ui.toast(returning ? "Welcome back" : "Your kitchen is ready", returning ? "Everything is where you left it." : "Quick match and practice are both open.", "good");
}

/* ---------------------------------------------------------------------
   Gate
   --------------------------------------------------------------------- */
function showGate(allowClose) {
  if (!started) allowClose = false;
  $("gate").hidden = false;
  $("gate-back").hidden = !allowClose;
  $("gate-error").hidden = true;
  $("gate-name").value = game.S.name && game.S.name !== "Guest baker" ? game.S.name : "";
  $("gate-pass").value = "";
  setGateMode(gateMode);
  setTimeout(() => { if (!$("gate").hidden) $("gate-name").focus(); }, 90);
}

function hideGate() { $("gate").hidden = true; }

function setGateMode(mode) {
  gateMode = mode;
  document.querySelectorAll(".gate-tab").forEach((tab) => {
    const on = tab.dataset.gateTab === mode;
    tab.classList.toggle("on", on);
    tab.setAttribute("aria-selected", on ? "true" : "false");
  });
  $("gate-submit").querySelector("span").textContent = mode === "new" ? "Create my kitchen" : "Sign in";
  $("gate-pass").autocomplete = mode === "new" ? "new-password" : "current-password";
  $("gate-note").textContent = mode === "new"
    ? "Pick the name other bakers will see. Passwords need at least six characters."
    : "Guest progress lives on this device. Sign in any time to carry it into online matches.";
  $("gate-form").querySelector("button[type=submit]").disabled = false;
}

function gateError(message) {
  const box = $("gate-error");
  box.textContent = message;
  box.hidden = !message;
}

function bindGate() {
  document.querySelectorAll(".gate-tab").forEach((tab) => tab.addEventListener("click", () => {
    setGateMode(tab.dataset.gateTab);
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
    submit.querySelector("span").textContent = gateMode === "new" ? "Opening…" : "Signing in…";
    try {
      const user = await cloud.signIn(name, pass, gateMode === "new");
      await enterWithAccount(user, true);
      hideGate();
      ui.setScreen("lobby");
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
    const typed = $("gate-name").value.trim();
    if (typed) {
      game.S.name = typed.slice(0, 20);
      game.saveLocal(true);
    }
    hideGate();
    if (started) { ui.refreshAll(); return; }
    enterAsGuest(false);
  });

  $("gate-back").addEventListener("click", () => hideGate());
}

/* ---------------------------------------------------------------------
   Invitations
   --------------------------------------------------------------------- */
function watchInvites() {
  if (inviteUnsub) inviteUnsub();
  inviteUnsub = cloud.subscribeInvites((invite) => {
    if (!invite) { lastInviteKey = ""; return; }
    const key = `${invite.from}:${invite.matchId}:${invite.at}`;
    if (key === lastInviteKey) return;
    if (Date.now() - (invite.at || 0) > 120000) return;
    if (match.isInMatch()) return;
    lastInviteKey = key;
    ui.showInviteToast(invite);
  });
}

/* ---------------------------------------------------------------------
   Loop
   --------------------------------------------------------------------- */
function loop(now) {
  requestAnimationFrame(loop);
  const time = now || performance.now();
  if (!last) last = time;
  const dt = Math.min(0.05, Math.max(0.001, (time - last) / 1000));
  last = time;
  try {
    if (started) game.tick(dt);
    world.frame(dt);
    if (match.isInMatch()) match.tickMatch(dt);
  } catch (error) {
    console.error("Bake Off: frame error", error);
    last = time;
  }
}

/* ---------------------------------------------------------------------
   Housekeeping
   --------------------------------------------------------------------- */
document.addEventListener("visibilitychange", () => {
  if (document.hidden) { try { game.saveLocal(true); } catch (error) { /* ignore */ } }
  else if (started) {
    game.checkDay();
    ui.renderHud();
    if (ui.online) {
      cloud.presence(match.isInMatch() ? "match" : "lobby");
      if (M_hasProfile()) cloud.saveProfile(game.packProfile()).catch(() => {});
    }
  }
});

function M_hasProfile() { return ui.online && !match.isInMatch(); }

window.addEventListener("pagehide", () => { try { game.saveLocal(true); } catch (error) { /* ignore */ } });
window.addEventListener("beforeunload", () => { try { game.saveLocal(true); } catch (error) { /* ignore */ } });

// A debug handle for checking the simulation without clicking.
window.__bakeoff = { game, world, cloud, ui, match, CONFIG };

main().catch((error) => {
  console.error("Bake Off failed to start", error);
  const line = $("boot-line");
  if (line) line.textContent = "Something went wrong while opening the kitchen. Refresh to try again.";
  setTimeout(hideBoot, 1200);
});
