/* =====================================================================
   PET CAFÉ — boot
   The login gate, the animation loop and the bridge between the world,
   the simulation and the interface.
   ===================================================================== */
import * as game from "./game.js";
import * as cloud from "./cloud.js";
import * as world from "./scene.js";
import * as ui from "./ui.js";
import { CONFIG } from "./config.js";

const $ = (id) => document.getElementById(id);
const bootLines = [
  "Warming the ovens…",
  "Setting the little tables…",
  "Waking the animals…",
  "Polishing the coffee cups…"
];
let bootStep = 0;
let gateMode = "in";
let busy = false;
let started = false;

/* ---------------------------------------------------------------------
   Boot
   --------------------------------------------------------------------- */
async function main() {
  const bootLine = $("boot-line");
  const bootTimer = setInterval(() => {
    bootStep = (bootStep + 1) % bootLines.length;
    if (bootLine) bootLine.textContent = bootLines[bootStep];
  }, 900);

  const hadSave = game.loadLocal();
  if (!game.S.name || game.S.name === "Guest") {
    game.S.name = hadSave ? (localStorage.getItem(CONFIG.storageKey + "-name") || "Guest") : "Guest";
  }

  try {
    world.initWorld($("gl"));
    world.setLayout(game.S.layout, { readonly: true });
  } catch (error) {
    console.error("Pet Café: the 3D café could not start", error);
    if (bootLine) bootLine.textContent = "WebGL could not start in this browser.";
  }

  ui.initUI();
  ui.setGateHandlers({ show: showGate, hide: hideGate });
  bindGate();

  // The café renders behind the gate so the first thing you see is the room.
  requestAnimationFrame(loop);

  let cloudReady = false;
  let session = null;
  try {
    cloudReady = await Promise.race([
      cloud.init(),
      new Promise((resolve) => setTimeout(() => resolve(false), 4000))
    ]);
    if (cloudReady) session = await cloud.restore();
  } catch (error) {
    console.warn("Pet Café: cloud unavailable", error);
  }

  clearInterval(bootTimer);
  hideBoot();

  if (session) {
    try {
      await game.attachAccount(session);
      enterApp();
      ui.toast("Welcome back", `Your café is open, ${session.name}.`, "check");
    } catch (error) {
      console.warn("Pet Café: could not restore the account", error);
      enterAsGuest(hadSave);
    }
  } else if (hadSave) {
    enterAsGuest(true);
  } else {
    showGate(false);
  }

  if (!cloudReady) {
    const note = $("gate-note");
    if (note) note.textContent = "The cloud is unavailable right now, so this café saves on this device. You can still play everything except visits and friends.";
  }
}

function hideBoot() {
  const boot = $("boot");
  if (boot) {
    boot.classList.add("gone");
    setTimeout(() => { boot.hidden = true; }, 520);
  }
}

function enterApp() {
  started = true;
  $("app").hidden = false;
  $("gate").hidden = true;
  game.runtime.ready = true;
  game.checkDay();
  try { ui.closePanel(); } catch (error) { /* the first time there is nothing open */ }
  ui.renderAll();
  ui.renderBubbles();
  try { ui.startFeeds && ui.startFeeds(); } catch (error) { /* online only */ }
}

function enterAsGuest(returning) {
  game.runtime.ready = true;
  if (!game.S.name || game.S.name === "Guest") game.S.name = "Guest";
  game.S.settings.name = game.S.name;
  game.rebuildWorld();
  enterApp();
  if (returning) {
    ui.toast("Welcome back", "Your café is exactly as you left it.", "check");
  } else {
    ui.toast("The café is open", "Click a guest's bubble to take an order.", "bell");
  }
  game.saveLocal();
}

/* ---------------------------------------------------------------------
   Gate
   --------------------------------------------------------------------- */
function showGate(allowClose) {
  if (!started && allowClose) allowClose = true;
  $("gate").hidden = false;
  $("gate-back").hidden = !allowClose;
  $("gate-error").hidden = true;
  $("gate-name").value = game.S.name && game.S.name !== "Guest" ? game.S.name : "";
  $("gate-pass").value = "";
  setGateMode(gateMode);
  setTimeout(() => { if (!$("gate").hidden) $("gate-name").focus(); }, 90);
}

function hideGate() {
  $("gate").hidden = true;
}

function setGateMode(mode) {
  gateMode = mode;
  document.querySelectorAll(".gate-tab").forEach((tab) => {
    const on = tab.dataset.gateTab === mode;
    tab.classList.toggle("on", on);
    tab.setAttribute("aria-selected", on ? "true" : "false");
  });
  $("gate-submit").querySelector("span").textContent = mode === "new" ? "Create my café" : "Sign in";
  $("gate-pass").autocomplete = mode === "new" ? "new-password" : "current-password";
  $("gate-note").textContent = mode === "new"
    ? "Your username is your café name. Passwords need at least six characters."
    : "Guest progress saves on this device. Sign in any time to take it to the cloud.";
}

function gateError(message) {
  const box = $("gate-error");
  box.textContent = message;
  box.hidden = !message;
}

function bindGate() {
  document.querySelectorAll(".gate-tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      setGateMode(tab.dataset.gateTab);
      gateError("");
    });
  });

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
      await game.attachAccount(user);
      hideGate();
      enterApp();
      ui.toast(gateMode === "new" ? "Your café is ready" : "Welcome back", `${user.name}, the kettle's on.`, "check");
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
    if (typed && !game.S.name) game.S.name = typed.slice(0, 20);
    else if (typed && game.S.name === "Guest") game.S.name = typed.slice(0, 20);
    game.S.settings.name = game.S.name;
    hideGate();
    if (started) {
      game.rebuildWorld();
      ui.renderAll();
    } else {
      enterAsGuest(false);
    }
  });

  $("gate-back").addEventListener("click", () => hideGate());
}

/* ---------------------------------------------------------------------
   Loop
   --------------------------------------------------------------------- */
let last = 0;
function loop(now) {
  requestAnimationFrame(loop);
  const time = now || performance.now();
  if (!last) last = time;
  const dt = Math.min(0.05, Math.max(0.001, (time - last) / 1000));
  last = time;
  try {
    if (started) game.update(dt);
    world.frame(dt);
    ui.tick(time);
  } catch (error) {
    console.error("Pet Café: frame error", error);
    last = time;
  }
}

/* ---------------------------------------------------------------------
   Small niceties
   --------------------------------------------------------------------- */
document.addEventListener("visibilitychange", () => {
  if (!document.hidden && started) {
    game.checkDay();
    ui.renderAll();
    game.syncPublic();
  }
});

window.addEventListener("pagehide", () => {
  try { game.saveLocal(); } catch (error) { /* ignore */ }
});

window.addEventListener("beforeunload", () => {
  try { game.saveLocal(); } catch (error) { /* ignore */ }
});

// A tiny debug handle, handy for checking the simulation without clicking.
window.__petcafe = { game, world, cloud, ui, CONFIG };

main().catch((error) => {
  console.error("Pet Café failed to start", error);
  const line = $("boot-line");
  if (line) line.textContent = "Something went wrong while opening the café. Refresh to try again.";
  setTimeout(hideBoot, 1200);
});
