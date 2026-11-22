/* =====================================================================
   BAKE OFF! — the match
   Matchmaking, private rooms, the lobby, all four baking rounds, the
   vote and the results. Online matches are driven by a Firestore
   document; practice matches run the same state machine locally with
   rival chefs.
   ===================================================================== */
import * as game from "./game.js";
import * as cloud from "./cloud.js";
import * as world from "./scene.js";
import { ui } from "./ui.js";
import {
  themeById, recipeById, TOPPINGS, toppingById, FROSTINGS, PLATES, SHAPES,
  FROSTING_STYLES, phaseById, PHASES, RECIPES
} from "./data.js";

const $ = (id) => document.getElementById(id);
const sound = ui.sound;

export const M = {
  mode: null,          // "practice" | "online"
  matchId: null,
  match: null,
  unsub: null,
  unsubVotes: null,
  votes: {},
  myVote: null,
  submitted: false,
  readySent: false,
  reward: null,
  results: null,
  appliedPhase: null,
  hostTimer: null,
  busy: false,
  selectedTopping: null,
  kitchenTimer: null,
  messageTimer: null,
  lastPhaseChange: 0
};

/* ---------------------------------------------------------------------
   Small helpers shared inside this file
   --------------------------------------------------------------------- */
function runtime() { return game.runtime; }
function meUid() { return (cloud.getUser() || {}).uid || game.S.uid || "me"; }
function myPlayer() { return M.match && M.match.players ? M.match.players.find((p) => p.isMe) : null; }
function onlinePlayers() { return (M.match && M.match.players) || []; }
function activePlayers() { return onlinePlayers().filter((p) => p.online); }
function allReady() {
  const list = activePlayers();
  const phase = (M.match && M.match.phase) || "";
  return list.length > 0 && list.every((p) => p.readyPhase === phase);
}
function isHost() {
  if (M.mode !== "online") return true;
  return !!(M.match && M.match.hostUid === meUid());
}
function remaining() { return Math.max(0, Math.round(runtime().secondsLeft)); }
function mmss(seconds) {
  const s = Math.max(0, Math.ceil(seconds));
  return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0");
}
function myDesign() { return runtime().design; }

/* ---------------------------------------------------------------------
   Entry points
   --------------------------------------------------------------------- */
export function practiceFlow() {
  closeAll();
  game.beginMatch({ practice: true, theme: game.themeForMatch("practice-" + Date.now()) });
  game.makeRivals(3);
  M.mode = "practice";
  M.matchId = null;
  M.match = { players: practicePlayers(), count: 4, phase: "theme", themeId: runtime().theme.id, hostUid: meUid() };
  M.votes = {};
  M.myVote = null;
  M.reward = null;
  M.results = null;
  M.submitted = false;
  M.readySent = false;
  M.lastAdded = -1;
  M.appliedPhase = "theme";
  ui.match = M;
  runtime().online = false;
  enterMatchUI();
  game.setPhase("theme", 6);
  applyPhaseVisuals("theme");
  renderMatch();
  ui.toast("Practice kitchen", "Three rival bakers, same theme, same clock.", "users");
}

function practicePlayers() {
  const me = { uid: meUid(), name: game.S.name || "You", level: game.level(), isMe: true, online: true, ready: false, design: null };
  const rivals = (runtime().rivals || []).map((r) => ({ uid: r.uid, name: r.name, level: r.level, isMe: false, online: true, ready: false, design: r.design }));
  return [me, ...rivals];
}

export async function quickMatchFlow() {
  if (!ui.online) {
    gatePrompt("Online matchmaking needs an account. Practice with rivals uses the exact same rules and pays the same coins.");
    return;
  }
  closeAll();
  ui.openModal(`
    <div class="matchmaking-visual"><div class="mm-ring"><b><svg><use href="#i-whisk"/></svg></b></div></div>
    <div class="center"><h2>Looking for a kitchen…</h2><p class="sub" id="mm-sub">Checking for an open table. If there isn't one, we'll set one up for you.</p></div>
    <div class="mm-list" id="mm-list"></div>
    <div class="modal-actions"><button class="btn ghost" id="mm-cancel">Cancel</button><button class="btn soft" id="mm-practice">Practise instead</button></div>
  `, { dismissable: false });
  let cancelled = false;
  $("mm-cancel").addEventListener("click", () => { cancelled = true; closeAll(); });
  $("mm-practice").addEventListener("click", () => { cancelled = true; closeAll(); practiceFlow(); });
  try {
    const result = await cloud.quickMatch();
    if (cancelled) { if (result && result.matchId) cloud.leaveMatch(result.matchId); return; }
    openRoom(result.matchId);
  } catch (error) {
    closeAll();
    ui.toast("Could not find a kitchen", error.message || "Try again in a moment.", "bad");
    ui.openModal(`
      <div class="center"><h2>No kitchen answered</h2><p class="sub">${ui.esc(error.message || "Matchmaking failed.")}</p></div>
      <div class="modal-actions">
        <button class="btn ghost" data-close="1">Close</button>
        <button class="btn soft" id="mm-offline">Practise instead</button>
        <button class="btn primary" id="mm-retry">Try again</button>
      </div>`);
    $("modals").querySelectorAll("[data-close]").forEach((b) => b.addEventListener("click", closeAll));
    $("mm-offline").addEventListener("click", () => { closeAll(); practiceFlow(); });
    $("mm-retry").addEventListener("click", () => { closeAll(); quickMatchFlow(); });
  }
}

export function roomFlow() {
  if (!ui.online) {
    gatePrompt("Private rooms and room codes need an account. Practice is always open.");
    return;
  }
  closeAll();
  ui.openModal(`
    <div class="modal-head"><div><p class="eyebrow">Private kitchen</p><h2>Bake with your people</h2><p class="sub">Open a room and share the six-letter code, or type a code a friend sent you.</p></div></div>
    <div class="stack">
      <button class="btn primary wide" id="room-create"><svg><use href="#i-plus"/></svg>Create a room</button>
      <div class="gate-or"><span>or join</span></div>
      <div class="code-input">
        <input id="room-code" maxlength="6" placeholder="CODE" autocomplete="off" spellcheck="false">
        <button class="btn soft" id="room-join">Join</button>
      </div>
      <p class="section-note">Up to ${cloud.isReady() ? 8 : 8} bakers. Rooms start when the host says so, and fill up with anyone who has the code.</p>
    </div>
    <div class="modal-actions"><button class="btn ghost" data-close="1">Close</button></div>
  `, { dismissable: true });
  $("modals").querySelectorAll("[data-close]").forEach((b) => b.addEventListener("click", closeAll));
  $("room-create").addEventListener("click", async () => {
    $("room-create").disabled = true;
    try {
      const room = await cloud.createRoom({ public: false });
      openRoom(room.matchId);
    } catch (error) {
      ui.toast("Could not open a room", error.message || "", "bad");
      $("room-create").disabled = false;
    }
  });
  const join = async () => {
    const code = ($("room-code").value || "").trim();
    if (code.length < 4) { ui.toast("That code is short", "Room codes are six characters.", "bad"); return; }
    $("room-join").disabled = true;
    try {
      const id = await cloud.joinByCode(code);
      openRoom(id);
    } catch (error) {
      ui.toast("Could not join", error.message || "", "bad");
      $("room-join").disabled = false;
    }
  };
  $("room-join").addEventListener("click", join);
  $("room-code").addEventListener("keydown", (e) => { if (e.key === "Enter") join(); });
  setTimeout(() => { const el = $("room-code"); if (el) el.focus(); }, 80);
}

export async function joinFromInvite(invite) {
  if (!invite) return;
  if (!ui.online) { gatePrompt("Sign in to join a friend's kitchen."); return; }
  closeAll();
  try {
    let id = null;
    if (invite.matchId) id = invite.matchId;
    if (!id && invite.code) id = await cloud.joinByCode(invite.code);
    if (!id) throw new Error("That invitation is missing its room.");
    await cloud.joinMatch(id).catch(() => {});
    openRoom(id);
    ui.toast("You're in", "The kitchen is open.", "good");
  } catch (error) {
    ui.toast("Could not join", error.message || "", "bad");
  }
}

function gatePrompt(text) {
  ui.openModal(`
    <div class="matchmaking-visual"><div class="mm-ring"><b><svg><use href="#i-lock"/></svg></b></div></div>
    <div class="center"><h2>Online needs a name</h2><p class="sub">${ui.esc(text)}</p></div>
    <div class="modal-actions">
      <button class="btn ghost" data-close="1">Not now</button>
      <button class="btn primary" id="gate-open">Sign in</button>
      <button class="btn soft" id="gate-practice">Practice</button>
    </div>`);
  $("modals").querySelectorAll("[data-close]").forEach((b) => b.addEventListener("click", closeAll));
  $("gate-open").addEventListener("click", () => { closeAll(); if (ui.gateHandler) ui.gateHandler.show(true); });
  $("gate-practice").addEventListener("click", () => { closeAll(); practiceFlow(); });
}

/* ---------------------------------------------------------------------
   Lobby (online room)
   --------------------------------------------------------------------- */
function openRoom(matchId) {
  closeAll();
  M.mode = "online";
  M.matchId = matchId;
  M.appliedPhase = null;
  M.myVote = null;
  M.votes = {};
  M.reward = null;
  M.results = null;
  M.submitted = false;
  M.readySent = false;
  ui.match = M;
  runtime().online = true;
  runtime().practice = false;
  runtime().matchId = matchId;
  subscribe();
  ui.openModal(`
    <div class="modal-head"><div><p class="eyebrow">Private kitchen</p><h2>Gathering the bakers</h2><p class="sub" id="lobby-sub">Reading the room…</p></div></div>
    <div class="room-code"><b id="lobby-code">······</b><button class="icon-btn" id="copy-code" title="Copy code"><svg><use href="#i-copy"/></svg></button></div>
    <div class="players-list" id="lobby-players"></div>
    <div class="modal-actions" id="lobby-actions"></div>
    <p class="section-note" id="lobby-hint"></p>
  `, { dismissable: false, wide: true });
  $("copy-code").addEventListener("click", copyCode);
}

function copyCode() {
  const code = (M.match && M.match.code) || $("lobby-code").textContent;
  if (!code) return;
  try {
    navigator.clipboard.writeText(code);
    ui.toast("Code copied", "Send it to whoever you want at the table.", "good");
  } catch (error) {
    ui.toast("Room code", code, "info");
  }
}

function subscribe() {
  if (!M.matchId) return;
  if (M.unsub) M.unsub();
  M.unsub = cloud.subscribeMatch(M.matchId, (match) => {
    if (!match) {
      ui.toast("The kitchen closed", "The room is no longer there.", "bad");
      leaveToLobby();
      return;
    }
    const previous = M.match;
    M.match = match;
    // Host migration: if the host vanished and nobody else has claimed it,
    // the earliest remaining baker takes over.
    maybeClaimHost(match);
    if (match.phase === "lobby") renderLobby(match);
    else {
      if (M.mode !== "online") return;
      if (M.appliedPhase === null) closeAll();
      applyServerPhase(match);
    }
    if (previous && previous.phase === "lobby" && match.phase !== "lobby") {
      closeAll();
      enterMatchUI();
    }
    if (!M.unsubVotes) M.unsubVotes = cloud.subscribeVotes(M.matchId, (votes) => {
      M.votes = votes;
      if (runtime().phase === "vote" || runtime().phase === "results") {
        runtime().votes = votes;
        updateVoteUI();
      }
    });
  }, (error) => {
    console.warn("Bake Off: match listener", error);
    ui.toast("Connection trouble", "Trying to keep up with the kitchen.", "bad");
  });
}

function maybeClaimHost(match) {
  if (!match || !match.hostUid || match.hostUid === meUid()) return;
  const host = match.players.find((p) => p.uid === match.hostUid);
  if (host && host.online) return;
  const candidates = match.players.filter((p) => !p.left).sort((a, b) => (a.joinedAt || 0) - (b.joinedAt || 0));
  if (!candidates.length || candidates[0].uid !== meUid()) return;
  cloud.claimHost(M.matchId).catch(() => {});
}

function renderLobby(match) {
  const codeEl = $("lobby-code");
  if (!codeEl) return;
  codeEl.textContent = match.code || "······";
  const sub = $("lobby-sub");
  if (sub) sub.textContent = `${match.count} of 8 bakers at the table · ${match.public ? "public matchmaking" : "private room"}`;
  const list = $("lobby-players");
  if (list) {
    list.innerHTML = match.players.map((p) => `
      <div class="player-row">
        <span class="friend-av" style="width:28px;height:28px;font-size:11px">${ui.esc((p.name || "?")[0].toUpperCase())}</span>
        <span class="who"><b>${ui.esc(p.name)}${p.isHost ? " · host" : ""}${p.isMe ? " · you" : ""}</b><small>Level ${p.level || 1}${p.online ? "" : " · disconnected"}</small></span>
        <span class="ready-tag ${p.ready ? "" : "wait"}">${p.ready ? "Ready" : "Waiting"}</span>
      </div>`).join("");
  }
  const actions = $("lobby-actions");
  if (!actions) return;
  const me = match.players.find((p) => p.isMe);
  const host = isHost();
  const canStart = match.count >= 2;
  actions.innerHTML = `
    <button class="btn ghost" id="lobby-leave">Leave</button>
    ${me ? `<button class="btn ${me.ready ? "soft" : "ghost"}" id="lobby-ready">${me.ready ? "Ready ✓" : "I'm ready"}</button>` : ""}
    ${host ? `<button class="btn primary" id="lobby-start" ${canStart ? "" : "disabled"}><svg><use href="#i-flame"/></svg>Start the bake</button>`
      : `<span class="chip"><svg><use href="#i-clock"/></svg>Waiting for the host</span>`}
    <button class="btn soft" id="lobby-invite"><svg><use href="#i-users"/></svg>Invite</button>
  `;
  $("lobby-leave").addEventListener("click", leaveToLobby);
  if ($("lobby-ready")) $("lobby-ready").addEventListener("click", () => {
    M.readySent = !M.readySent;
    cloud.setReady(M.matchId, M.readySent ? "lobby" : "");
    sound("tap");
  });
  if ($("lobby-start")) $("lobby-start").addEventListener("click", startOnlineMatch);
  $("lobby-invite").addEventListener("click", inviteFriends);
  const hint = $("lobby-hint");
  if (hint) hint.textContent = canStart
    ? (host ? "Start whenever you like. Everyone gets the same theme and the same clock." : "The host starts the bake. Invite someone while you wait.")
    : "Need at least two bakers. Share the code, or invite a friend from your list.";
}

async function startOnlineMatch() {
  if (!M.matchId || M.busy) return;
  M.busy = true;
  try {
    const theme = game.themeForMatch(M.matchId + "-" + Date.now());
    await cloud.startMatch(M.matchId, theme.id, 6);
  } catch (error) {
    ui.toast("Could not start", error.message || "Check the rules are deployed.", "bad");
  } finally { M.busy = false; }
}

async function inviteFriends() {
  if (!ui.online) return;
  const { following, followers } = ui.friends;
  const friends = following.filter((f) => followers.some((b) => b.from === f.from));
  if (!friends.length) {
    ui.toast("No friends yet", "Follow bakers from the leaderboard; invite them once they follow back.", "info");
    return;
  }
  const top = await cloud.fetchTopPlayers();
  ui.openModal(`
    <div class="modal-head"><div><p class="eyebrow">Invite</p><h2>Who's coming?</h2><p class="sub">They will get an invitation with the room code.</p></div></div>
    <div class="players-list">
      ${friends.map((f) => {
        const person = top.find((r) => r.uid === f.to) || { name: f.name || "Baker" };
        return `<div class="player-row">
          <span class="friend-av" style="width:28px;height:28px;font-size:11px">${ui.esc((person.name || "?")[0].toUpperCase())}</span>
          <span class="who"><b>${ui.esc(person.name)}</b><small>Friend</small></span>
          <button class="btn tiny primary" data-invite="${ui.esc(f.to)}">Invite</button>
        </div>`;
      }).join("")}
    </div>
    <div class="modal-actions"><button class="btn ghost" data-close="1">Done</button></div>
  `);
  $("modals").querySelectorAll("[data-close]").forEach((b) => b.addEventListener("click", closeAll));
  $("modals").querySelectorAll("[data-invite]").forEach((btn) => btn.addEventListener("click", async () => {
    btn.disabled = true;
    try {
      await cloud.inviteFriend(btn.dataset.invite, M.matchId, M.match.code, themeById(M.match.themeId).name);
      btn.textContent = "Sent";
      ui.toast("Invitation sent", "They will see it next time they are in the lobby.", "good");
    } catch (error) {
      ui.toast("Could not invite", error.message || "", "bad");
      btn.disabled = false;
    }
  }));
}

function leaveToLobby(silent) {
  const matchId = M.matchId;
  cleanup();
  if (matchId) cloud.leaveMatch(matchId).catch(() => {});
  ui.match = null;
  M.mode = null;
  M.matchId = null;
  M.match = null;
  M.appliedPhase = null;
  M.votes = {};
  M.myVote = null;
  M.selectedTopping = null;
  game.runtime.ready = false;
  game.runtime.phase = "lobby";
  hidePhaseBar();
  document.body.classList.remove("decorating-ui");
  try { world.setMode("wide"); world.setCreation(null); } catch (error) { /* scene not ready */ }
  ui.setScreen("lobby");
  ui.refreshHud();
}

function cleanup() {
  if (M.unsub) { M.unsub(); M.unsub = null; }
  if (M.unsubVotes) { M.unsubVotes(); M.unsubVotes = null; }
  if (M.hostTimer) { clearTimeout(M.hostTimer); M.hostTimer = null; }
  if (M.kitchenTimer) { clearTimeout(M.kitchenTimer); M.kitchenTimer = null; }
  if (M.messageTimer) { clearTimeout(M.messageTimer); M.messageTimer = null; }
  closeAll();
}

function closeAll() { ui.closeModal(); }

/* ---------------------------------------------------------------------
   Phase transitions
   --------------------------------------------------------------------- */
function applyServerPhase(match) {
  const phase = match.phase;
  if (phase === "lobby") return;
  const phaseChanged = M.appliedPhase !== phase;
  const theme = themeById(match.themeId || runtime().theme.id);
  const endsAt = match.phaseEndsAt || (Date.now() + phaseById(phase).seconds * 1000);
  if (phaseChanged) {
    M.appliedPhase = phase;
    M.lastPhaseChange = Date.now();
    if (runtime().theme.id !== theme.id) runtime().theme = theme;
    if (phase === "theme") {
      game.prepareOnlineMatch(theme);
      M.votes = {};
      M.myVote = null;
      M.submitted = false;
      M.reward = null;
      M.results = null;
    } else {
      game.setPhaseAt(phase, endsAt);
    }
    M.readySent = false;
    M.selectedTopping = null;
    if (phase === "prepare" && !runtime().design) runtime().design = game.newDesign(game.suggestRecipe(theme));
    if (phase === "decorate") {
      runtime().design.quality = {
        prep: runtime().prep.quality || 0, mix: runtime().mixQuality || 0, oven: runtime().oven.quality || 0
      };
    }
    if (phase === "vote") {
      runtime().votes = M.votes;
    }
    if (phase === "results") buildOnlineResults();
    applyPhaseVisuals(phase);
    enterMatchUI();
    renderMatch();
    pulsePhase();
  } else {
    // keep the local clock honest even between snapshots
    if (Math.abs(runtime().phaseEndsAt - endsAt) > 900) runtime().phaseEndsAt = endsAt;
  }
}

function pulsePhase() { sound("tap"); }

function applyPhaseVisuals(phase) {
  document.body.classList.toggle("decorating-ui", phase === "decorate");
  try {
    if (phase === "prepare") {
      world.setMode("prep");
      world.setPlacement(null, false);
      world.setIngredientJars(game.recipeNeeds().map((i) => i.id));
      world.setBatter(0, recipeById(runtime().design.recipeId).tone);
      world.setMixer(false);
      world.setOvenBaking(false);
    } else if (phase === "bake") {
      world.setMode("oven");
      world.setPlacement(null, false);
      world.setMixer(false);
      world.setBatter(1, recipeById(runtime().design.recipeId).tone);
      world.loadTrayIntoOven(true);
      world.setOven(false);
    } else if (phase === "decorate") {
      world.setMode("decor");
      world.setOvenDone(false);
      world.loadTrayIntoOven(false);
      world.setCreation(runtime().design, { scale: 1.02 });
    } else if (phase === "show") {
      world.setMode("stage");
      world.setPlacement(null, false);
      world.setCreation(runtime().design, { stage: true, scale: 1.1 });
      world.celebrate();
    } else if (phase === "vote") {
      world.setMode("stage");
      world.setCreation(runtime().design, { stage: true, scale: 1.0 });
    } else if (phase === "theme") {
      world.setMode("wide");
    }
  } catch (error) {
    console.warn("Bake Off: could not set the kitchen", error);
  }
}

/* ---------------------------------------------------------------------
   Phase driving
   --------------------------------------------------------------------- */
export function onPhaseEnd(phase) {
  if (!ui.match) return;
  if (M.mode === "practice") {
    setTimeout(() => advancePractice(phase), 450);
  } else if (M.mode === "online") {
    // The host moves the match on. If the host is gone, any baker may do it
    // once the phase is a few seconds overdue (the rules allow that).
    if (isHost()) {
      advanceOnline(phase);
    } else {
      const overdue = Date.now() - runtime().phaseEndsAt;
      if (overdue > 3500) advanceOnline(phase);
    }
  }
}

function nextPhaseId(phase) {
  const idx = PHASES.findIndex((p) => p.id === phase);
  const next = PHASES[Math.min(PHASES.length - 1, idx + 1)];
  return next ? next.id : "results";
}

function advancePractice(phase) {
  if (!ui.match) return;
  if (phase === "theme") { beginRound("prepare"); return; }
  if (phase === "prepare") { game.autoMixQuality(); beginRound("bake"); return; }
  if (phase === "bake") {
    if (!runtime().oven.taken) game.takeOut(true);
    beginRound("decorate");
    return;
  }
  if (phase === "decorate") {
    finalizeDesignLocal();
    beginRound("show");
    return;
  }
  if (phase === "show") { beginRound("vote"); return; }
  if (phase === "vote") {
    buildPracticeResults();
    beginRound("results");
    return;
  }
  if (phase === "results") { leaveToLobby(); }
}

function advanceOnline(phase) {
  if (!ui.match || !M.matchId) return;
  if (phase === "results") return;
  const next = nextPhaseId(phase);
  cloud.advancePhase(M.matchId, next, phaseById(next).seconds).catch(() => {});
}

function beginRound(phase) {
  const seconds = phaseById(phase).seconds;
  game.setPhase(phase, seconds);
  M.appliedPhase = phase;
  M.readySent = false;
  M.selectedTopping = null;
  if (phase === "prepare" && !runtime().design) runtime().design = game.newDesign(game.suggestRecipe(runtime().theme));
  if (phase === "bake") {
    const recipe = recipeById(runtime().design.recipeId);
    runtime().oven.window = [recipe.bake * 0.82, recipe.bake * 1.18];
  }
  if (phase === "vote") {
    game.simulateRivalVotes();
    runtime().votes = M.votes;
  }
  applyPhaseVisuals(phase);
  renderMatch();
  sound("tap");
}

function finalizeDesignLocal() {
  if (!runtime().design) return;
  const score = game.scoreDesign(runtime().design, runtime().theme, {});
  runtime().myScore = score;
  runtime().design.quality = {
    prep: runtime().prep.quality || 0, mix: runtime().mixQuality || 0, oven: runtime().oven.quality || 0
  };
}

/* ---------------------------------------------------------------------
   Match UI
   --------------------------------------------------------------------- */
function enterMatchUI() {
  document.getElementById("app").hidden = false;
  $("phase-bar").classList.add("show");
  document.querySelectorAll(".nav-btn").forEach((btn) => btn.classList.remove("on"));
}

function hidePhaseBar() { $("phase-bar").classList.remove("show"); }

export function renderMatch() {
  if (!ui.match) return;
  const phase = runtime().phase;
  const host = $("screen");
  if (!host) return;
  renderPhaseBar();
  host.innerHTML = `<div class="match">
    <div class="match-top">${themeCard()}${hostNote()}</div>
    <div style="flex:1;min-height:12px"></div>
    ${phasePanel(phase)}
  </div>`;
  bindMatch();
  if (phase === "decorate") applyPhaseVisuals("decorate");
  if (phase === "show") applyPhaseVisuals("show");
  if (phase === "vote") applyPhaseVisuals("vote");
}

function themeCard() {
  const theme = runtime().theme;
  const recipe = runtime().design ? recipeById(runtime().design.recipeId) : null;
  return `<div class="theme-card">
    <div class="swatches">${theme.colors.map((c) => `<i style="background:${c}"></i>`).join("")}</div>
    <div style="flex:1;min-width:0">
      <p class="eyebrow">The theme</p>
      <h2>${ui.esc(theme.name)}</h2>
      <p>${ui.esc(theme.blurb)}${recipe ? " · " + ui.esc(recipe.name) : ""}</p>
    </div>
  </div>`;
}

function hostNote() {
  if (M.mode !== "online") {
    return `<div class="theme-card" style="flex:0 0 auto;min-width:0">
      <svg style="font-size:20px;color:var(--mint-deep)"><use href="#i-users"/></svg>
      <div><p class="eyebrow">Practice</p><p style="font-size:12px">${onlinePlayers().length || 4} bakers · same rules</p></div>
    </div>`;
  }
  const match = M.match;
  const hostPlayer = match && match.players.find((p) => p.isHost);
  return `<div class="theme-card" style="flex:0 0 auto;min-width:0">
    <svg style="font-size:20px;color:var(--rose-deep)"><use href="#i-${match && match.public ? "users" : "lock"}"/></svg>
    <div><p class="eyebrow">${match && match.public ? "Public match" : "Private room"}</p><p style="font-size:12px">${match ? match.count : 1} bakers · ${ui.esc((hostPlayer && hostPlayer.name) || "host")}</p></div>
  </div>`;
}

function renderPhaseBar() {
  const phase = runtime().phase;
  const order = ["theme", "prepare", "bake", "decorate", "show", "vote", "results"];
  const idx = order.indexOf(phase);
  const steps = $("phase-steps");
  if (steps && M.lastBarPhase !== phase) {
    M.lastBarPhase = phase;
    steps.innerHTML = order.map((id, i) => {
      const def = phaseById(id);
      const state = i < idx ? "done" : i === idx ? "on" : "";
      return `<span class="step ${state}"><i>${i < idx ? `<svg><use href="#i-check"/></svg>` : i + 1}</i><span>${def.name}</span></span>`;
    }).join("");
  }
  const clock = $("phase-clock");
  if (clock) {
    const left = remaining();
    clock.querySelector("b").textContent = mmss(left);
    clock.classList.toggle("low", left <= 10);
  }
  const players = $("phase-players");
  if (players) {
    const list = onlinePlayers();
    const sig = list.map((p) => p.uid + p.name + (p.online === false ? "0" : "1") + p.readyPhase).join("|");
    if (sig !== M.lastPlayerSig) {
      M.lastPlayerSig = sig;
      players.innerHTML = list.slice(0, 8).map((p) => `<span class="avatar-dot ${p.online === false ? "off" : ""}" title="${ui.esc(p.name)}${p.ready ? " · ready" : ""}">${ui.esc((p.name || "?")[0].toUpperCase())}</span>`).join("");
    }
  }
}

function phasePanel(phase) {
  if (phase === "theme") return panelTheme();
  if (phase === "prepare") return panelPrepare();
  if (phase === "bake") return panelBake();
  if (phase === "decorate") return panelDecorate();
  if (phase === "show") return panelShow();
  if (phase === "vote") return panelVote();
  if (phase === "results") return panelResults();
  return panelTheme();
}

/* ---------------------------------------------------------------------
   Theme round
   --------------------------------------------------------------------- */
function panelTheme() {
  const theme = runtime().theme;
  return `<section class="phase-panel">
    <div class="phase-head">
      <div><p class="eyebrow">Round 1 · the challenge</p><h3>${ui.esc(theme.name)}</h3><p>${ui.esc(theme.blurb)}</p></div>
      <div class="spacer"></div>
      <span class="chip"><svg><use href="#i-clock"/></svg>${remaining()}s</span>
    </div>
    <div class="row" style="gap:14px;align-items:flex-start">
      <div style="display:flex;gap:6px">${theme.colors.map((c) => `<div style="width:54px;height:54px;border-radius:16px;background:${c};box-shadow:inset 0 0 0 3px rgba(255,255,255,0.5)"></div>`).join("")}</div>
      <div style="flex:1;min-width:200px">
        <p class="hint">Judges reward the theme's flavours and colours. Suggested toppings: ${theme.hint.map((t) => ui.esc(toppingById(t).name)).join(", ")}.</p>
        <div class="row" style="margin-top:8px">${theme.tags.map((t) => `<span class="chip">${ui.esc(t)}</span>`).join("")}</div>
      </div>
    </div>
  </section>`;
}

/* ---------------------------------------------------------------------
   Prepare
   --------------------------------------------------------------------- */
function panelPrepare() {
  const design = myDesign();
  if (!design) return `<section class="phase-panel"><p>Preparing your bench…</p></section>`;
  const recipe = recipeById(design.recipeId);
  const needs = game.recipeNeeds();
  const added = runtime().prep.added;
  const wrong = runtime().prep.wrong.length;
  const allAdded = added.length >= needs.length;
  const mixed = runtime().prep.mixed;
  const ownedRecipes = RECIPES.filter((r) => game.owns("recipe", r.id));
  return `<section class="phase-panel">
    <div class="phase-head">
      <div><p class="eyebrow">Round 2 · prepare</p><h3>Weigh it, mix it</h3><p>Click the jars on the bench (or below) until the bowl has everything.</p></div>
      <div class="spacer"></div>
      ${wrong ? `<span class="chip" style="color:#a3314a"><svg><use href="#i-x"/></svg>${wrong} wrong</span>` : ""}
      <span class="chip"><svg><use href="#i-clock"/></svg>${remaining()}s</span>
    </div>
    <div class="decor-layout" style="grid-template-columns:280px 1fr">
      <div>
        <div class="recipe-card">
          <div class="recipe-art"><img src="${ui.recipeArt(recipe.id)}" alt=""></div>
          <div class="recipe-main">
            <b>${ui.esc(recipe.name)}</b>
            <small>${ui.esc(recipe.blurb)}</small>
            <div class="recipe-tags"><span>${ui.esc(recipe.kind)}</span><span>${recipe.bake}s bake</span><span>Level ${recipe.level}</span></div>
          </div>
        </div>
        <div class="recipe-pick">
          ${ownedRecipes.map((r) => `<button class="pill-option ${r.id === recipe.id ? "on" : ""}" data-recipe="${r.id}" ${runtime().prep.added.length ? "disabled" : ""}>${ui.esc(r.name.replace(/ (Cake|Cookie|Donut|Brownie|Macaron)$/, ""))}</button>`).join("")}
        </div>
      </div>
      <div>
        <div class="ing-check">${needs.map((n) => `<span class="${added.includes(n.id) ? "on" : ""}">${ui.esc(n.name)}</span>`).join("")}</div>
        <div class="pantry">
          ${needs.map((n) => `<button class="ing-btn ${added.includes(n.id) ? "added" : ""}" data-ing="${n.id}">
            <img src="${ui.ingredientArt(n.id)}" alt="">
            <span>${ui.esc(n.name)}</span>
            ${added.includes(n.id) ? `<i class="tick"><svg><use href="#i-check"/></svg></i>` : ""}
          </button>`).join("")}
        </div>
        <div class="mix-wrap">
          <div class="mix-meter" id="mix-meter">
            <div class="zone" id="mix-zone" style="left:42%;width:18%"></div>
            <div class="needle" id="mix-needle" style="left:0%"></div>
            <div class="label">${mixed ? "Batter ready" : allAdded ? "Stop it in the pink" : "Add every ingredient"}</div>
          </div>
          <div class="mix-hits" id="mix-hits">${[0, 1, 2].map((i) => `<i class="${(runtime().mix.hits[i] || 0) > 0 ? "hit" : ""}"></i>`).join("")}</div>
          <button class="btn primary" id="mix-btn" ${!allAdded || mixed ? "disabled" : ""}>${mixed ? "Mixed" : "Mix"}</button>
        </div>
        <div class="between" style="margin-top:10px">
          <p class="hint">${mixed ? "Batter looks right. Ready when you are." : allAdded ? "Three taps, each inside the band, makes a silky batter." : "The recipe card above lists exactly what it needs."}</p>
          <button class="btn soft" id="stage-ready" ${mixed ? "" : "disabled"}>${M.mode === "practice" ? "Take it to the oven" : "I'm ready"}</button>
        </div>
      </div>
    </div>
  </section>`;
}

/* ---------------------------------------------------------------------
   Bake
   --------------------------------------------------------------------- */
function panelBake() {
  const oven = runtime().oven;
  const recipe = recipeById(myDesign().recipeId);
  const state = !oven.started ? "waiting" : oven.taken ? (oven.burnt ? "burnt" : "taken") : "baking";
  return `<section class="phase-panel">
    <div class="phase-head">
      <div><p class="eyebrow">Round 3 · bake</p><h3>${state === "baking" ? "Watch the window" : state === "taken" ? "Out of the oven" : "Into the oven"}</h3>
        <p>${state === "taken" ? `Bake quality ${Math.round((oven.quality || 0) * 100)}%${oven.burnt ? " — a little dark" : ""}.` : `A ${recipe.name} wants about ${recipe.bake} seconds at 180°C.`}</p></div>
      <div class="spacer"></div>
      <span class="chip"><svg><use href="#i-flame"/></svg>${oven.temp}°C</span>
      <span class="chip"><svg><use href="#i-clock"/></svg>${remaining()}s</span>
    </div>
    <div class="oven-wrap">
      <div>
        <div class="temp-row">
          ${[160, 180, 200].map((t) => `<button class="temp ${oven.temp === t ? "on" : ""}" data-temp="${t}" ${oven.started ? "disabled" : ""}>${t}°C</button>`).join("")}
        </div>
        <div class="oven-progress" id="oven-progress">
          <div class="golden" style="left:${(oven.window[0] / (recipe.bake * 1.45)) * 100}%;width:${((oven.window[1] - oven.window[0]) / (recipe.bake * 1.45)) * 100}%"></div>
          <div class="fill" id="oven-fill"></div>
          <div class="mark" id="oven-mark" style="left:0%"></div>
        </div>
        <div class="oven-scale"><span>0s</span><span>golden ${Math.round(oven.window[0])}–${Math.round(oven.window[1])}s</span><span>${Math.round(recipe.bake * 1.45)}s</span></div>
        <div class="row" style="margin-top:12px">
          ${!oven.started ? `<button class="btn primary" id="bake-start"><svg><use href="#i-flame"/></svg>Put it in</button>`
            : !oven.taken ? `<button class="btn primary" id="bake-out">Take it out</button>`
            : `<span class="chip"><svg><use href="#i-check"/></svg>Baked · ${Math.round((oven.quality || 0) * 100)}%</span>`}
          ${oven.started && !oven.taken ? `<span class="bake-status" id="bake-status"><span class="pulse-dot"></span><b id="bake-time">0.0s</b> in the oven</span>` : ""}
          ${oven.taken ? `<button class="btn soft" id="stage-ready">${M.mode === "practice" ? "On to decorating" : "I'm ready"}</button>` : ""}
        </div>
      </div>
      <div>
        <p class="hint">${state === "waiting" ? "180°C is the safe middle. Hotter bakes faster but the golden window gets narrow." : state === "baking" ? "Pull it out while the marker is inside the gold band. Too early is doughy, too late is dry." : "Nice. The cake keeps its quality score through judging."}</p>
        <div class="row" style="margin-top:10px">
          ${[1, 2, 3].map((i) => `<span class="chip">${i <= (oven.taken ? 3 : oven.started ? 2 : 1) ? "✓ " : ""}${["Mixed", "Baking", "Baked"][i - 1]}</span>`).join("")}
        </div>
      </div>
    </div>
  </section>`;
}

/* ---------------------------------------------------------------------
   Decorate
   --------------------------------------------------------------------- */
function panelDecorate() {
  const design = myDesign();
  const recipe = recipeById(design.recipeId);
  const shapes = game.allowedShapes(recipe.kind);
  return `<section class="phase-panel decorating">
    <div class="phase-head">
      <div><p class="eyebrow">Round 4 · decorate</p><h3>Make it yours</h3><p>Pick a topping, then tap the cake. Frosting colours score against the theme.</p></div>
      <div class="spacer"></div>
      <span class="chip"><svg><use href="#i-palette"/></svg>${design.toppings.length} toppings</span>
      <span class="chip"><svg><use href="#i-clock"/></svg>${remaining()}s</span>
      <button class="btn primary" id="stage-ready">${M.mode === "practice" ? "Present it" : "I'm finished"}</button>
    </div>
    <div class="decor-layout">
      <div class="decor-tools">
        <div class="tool-group">
          <h4>Frosting</h4>
          <div class="swatch-row">
            ${FROSTINGS.map((f) => `<button class="swatch ${design.frosting === f.id ? "on" : ""}" data-frost="${f.id}" title="${ui.esc(f.name)}" style="background:${f.color}" aria-label="${ui.esc(f.name)}"></button>`).join("")}
          </div>
        </div>
        <div class="tool-group">
          <h4>Finish</h4>
          <div class="option-row">
            ${FROSTING_STYLES.map((s) => `<button class="option-pill ${design.style === s.id ? "on" : ""}" data-style="${s.id}">${ui.esc(s.name.split(" ")[0])}</button>`).join("")}
          </div>
        </div>
        <div class="tool-group">
          <h4>Shape</h4>
          <div class="option-row">
            ${SHAPES.filter((s) => shapes.includes(s.id)).map((s) => `<button class="option-pill ${design.shape === s.id ? "on" : ""}" data-shape="${s.id}">${ui.esc(s.name)}</button>`).join("")}
          </div>
        </div>
        <div class="tool-group">
          <h4>Plate</h4>
          <div class="option-row">
            ${PLATES.filter((p) => game.owns("plate", p.id)).map((p) => `<button class="option-pill ${design.plate === p.id ? "on" : ""}" data-plate="${p.id}">${ui.esc(p.name.split(" ")[0])}</button>`).join("")}
          </div>
        </div>
        <div class="tool-group">
          <h4>Toppings</h4>
          <div class="topping-row">
            ${TOPPINGS.map((t) => {
              const owned = game.owns("topping", t.id);
              return `<button class="topping-btn ${M.selectedTopping === t.id ? "on" : ""} ${owned ? "" : "locked"}" data-top="${t.id}" ${owned ? "" : "disabled"} title="${ui.esc(t.name)}">
                <img src="${ui.toppingArt(t.id)}" alt=""><span>${ui.esc(t.name.split(" ")[0])}</span>
              </button>`;
            }).join("")}
          </div>
          <p class="decor-note">${M.selectedTopping ? "Tap the cake to place it. Tap again to keep going." : "Select a topping to start placing."}</p>
        </div>
        <div class="tool-group">
          <h4>Sprinkles <b id="sprinkle-val">${design.sprinkles}</b></h4>
          <div class="slider-row"><input type="range" id="sprinkle-range" min="0" max="90" step="10" value="${design.sprinkles}"></div>
        </div>
        <div class="tool-group">
          <h4>Candles <b id="candle-val">${design.candles}</b></h4>
          <div class="slider-row"><input type="range" id="candle-range" min="0" max="8" step="1" value="${design.candles}"></div>
        </div>
        <div class="tool-group">
          <h4>Message</h4>
          <input id="cake-message" class="message-input" maxlength="26" placeholder="Happy birthday…" value="${ui.esc(design.message || "")}">
        </div>
        <div class="row">
          <button class="btn tiny ghost" id="undo-top"><svg><use href="#i-left"/></svg>Undo</button>
          <button class="btn tiny ghost" id="clear-tops">Clear</button>
          <button class="btn tiny soft" id="randomise"><svg><use href="#i-sparkle"/></svg>Surprise me</button>
        </div>
      </div>
      <div class="decor-side">
        <p class="hint" style="max-width:330px">Drag on the turntable to see the whole cake. Every choice here is rebuilt in 3D immediately.</p>
      </div>
    </div>
  </section>`;
}

/* ---------------------------------------------------------------------
   Show
   --------------------------------------------------------------------- */
function panelShow() {
  const score = runtime().myScore || game.scoreDesign(runtime().design, runtime().theme, {});
  const design = runtime().design;
  return `<section class="phase-panel">
    <div class="show-wrap">
      <p class="eyebrow">Round 5 · the presentation</p>
      <h2>${ui.esc(recipeById(design.recipeId).name)}</h2>
      <div class="show-score">${score.base}<small>out of 100 before votes</small></div>
      <div class="breakdown" style="width:100%;max-width:540px">
        ${[["Theme", score.theme, 25], ["Creativity", score.creativity, 20], ["Decoration", score.decoration, 25], ["Presentation", score.presentation, 15], ["Completion", score.completion, 15]]
          .map(([name, val, max]) => `<div class="bd"><b>${val}</b><small>${name} / ${max}</small></div>`).join("")}
      </div>
      <div class="row" style="justify-content:center;margin-top:8px">
        <span class="chip"><svg><use href="#i-clock"/></svg>${remaining()}s until voting</span>
        <button class="btn soft" id="stage-ready">${M.mode === "practice" ? "Go to the vote" : "I'm ready to vote"}</button>
      </div>
    </div>
  </section>`;
}

/* ---------------------------------------------------------------------
   Vote
   --------------------------------------------------------------------- */
function votePlayers() {
  if (M.mode === "practice") {
    return (runtime().rivals || []).map((r) => ({ uid: r.uid, name: r.name, design: r.design, level: r.level, isMe: false }));
  }
  return onlinePlayers().filter((p) => !p.isMe && p.design).map((p) => ({ uid: p.uid, name: p.name, design: p.design, level: p.level, isMe: false, online: p.online }));
}

function panelVote() {
  const list = votePlayers();
  const myVote = M.myVote || (M.mode === "practice" ? runtime().myVote : null);
  return `<section class="phase-panel">
    <div class="phase-head">
      <div><p class="eyebrow">Round 6 · vote</p><h3>Which one would you order?</h3><p>Everyone sees the actual cakes. You cannot vote for your own.</p></div>
      <div class="spacer"></div>
      <span class="chip"><svg><use href="#i-heart"/></svg>${Object.keys(M.votes || {}).length || (runtime().votes ? Object.keys(runtime().votes).length : 0)} votes in</span>
      <span class="chip"><svg><use href="#i-clock"/></svg>${remaining()}s</span>
    </div>
    ${list.length ? `<div class="vote-grid">
      ${list.map((p) => `<button class="vote-card ${myVote === p.uid ? "picked" : ""} ${myVote ? "locked" : ""}" data-vote="${ui.esc(p.uid)}">
        <img src="${ui.designArt(p.design, 300)}" alt="Cake by ${ui.esc(p.name)}">
        <div class="meta"><b>${ui.esc(p.name)}</b><small>Level ${p.level || 1}${p.online === false ? " · left" : ""}</small></div>
      </button>`).join("")}
    </div>` : `<p class="empty-note">No other bakers submitted a cake. Your own still counts — the results will show it.</p>`}
    <div class="between" style="margin-top:10px">
      <p class="hint">${myVote ? "Vote locked in. Results in a moment." : "One vote each. It is worth six points to whoever you choose."}</p>
      ${M.mode === "online" && isHost() ? `<button class="btn soft" id="vote-finish">${remaining() > 6 ? "Finish voting early" : "Tally the votes"}</button>` : ""}
    </div>
    <div id="own-cake" style="display:none"></div>
  </section>`;
}

function updateVoteUI() {
  if (runtime().phase !== "vote") return;
  const cards = document.querySelectorAll("[data-vote]");
  cards.forEach((card) => card.classList.toggle("picked", card.dataset.vote === M.myVote));
}

/* ---------------------------------------------------------------------
   Results
   --------------------------------------------------------------------- */
function buildPracticeResults() {
  runtime().rivals = (runtime().rivals || []).map((r) => ({ ...r, design: r.design }));
  const results = game.buildResults();
  runtime().results = results;
  M.results = results;
  if (!M.reward) {
    M.reward = game.grantRewards(results);
    ui.refreshHud();
    sound(results.rank === 1 ? "win" : "good");
  }
}

async function buildOnlineResults() {
  const players = onlinePlayers();
  runtime().rivals = players
    .filter((p) => !p.isMe && p.design)
    .map((p) => ({ uid: p.uid, name: p.name, level: p.level, design: p.design, online: p.online }));
  runtime().votes = M.votes || {};
  const results = game.buildResults();
  runtime().results = results;
  M.results = results;
  if (!M.reward) {
    try {
      const fresh = await cloud.claimMatchReward(M.matchId);
      if (fresh) {
        M.reward = game.grantRewards(results);
        ui.refreshHud();
        cloud.saveProfile(game.packProfile()).catch(() => {});
        sound(results.rank === 1 ? "win" : "good");
      } else {
        M.reward = { ok: false, reason: "Already rewarded for this match" };
      }
    } catch (error) {
      M.reward = { ok: false, reason: "Could not confirm the reward" };
    }
    if (runtime().phase === "results") renderMatch();
  }
}

function panelResults() {
  const results = M.results || runtime().results;
  if (!results) return `<section class="phase-panel"><div class="show-wrap"><h2>Tallying…</h2><p class="hint">Reading the votes.</p></div></section>`;
  const reward = M.reward;
  const mine = results.mine;
  return `<section class="phase-panel">
    <div class="phase-head">
      <div><p class="eyebrow">The verdict · ${ui.esc(results.theme.name)}</p><h3>${results.rank === 1 ? "You took the tent" : results.rank <= 3 ? "On the podium" : "Good bake, better next time"}</h3>
        <p>${results.total} bakers · your cake scored ${mine ? mine.base : 0} before votes.</p></div>
      <div class="spacer"></div>
      ${reward && reward.ok ? `<span class="reward-pill"><svg><use href="#i-coin"/></svg>+${reward.coins}</span><span class="reward-pill"><svg><use href="#i-star"/></svg>+${reward.xp} XP</span>` : ""}
    </div>
    <div class="results">
      ${results.rows.map((row, i) => `<div class="result-row ${row.isMe ? "me" : ""}">
        <span class="result-rank ${i === 0 ? "g" : i === 1 ? "s" : i === 2 ? "b" : ""}">${i + 1}</span>
        <span class="friend-av" style="width:28px;height:28px;font-size:11px">${ui.esc((row.name || "?")[0].toUpperCase())}</span>
        <span class="result-who"><b>${ui.esc(row.name)}${row.isMe ? " (you)" : ""}</b><small>${row.base} base · ${row.votes} vote${row.votes === 1 ? "" : "s"}</small></span>
        <span class="result-score"><b>${row.final}</b><small>final</small></span>
      </div>`).join("")}
    </div>
    <div id="my-breakdown"></div>
    <div class="between" style="margin-top:12px">
      <p class="hint">${M.mode === "practice" ? "Practice pays the same coins and XP. Online results also go to the leaderboard." : "Rewards are claimed once per match, verified by the rules."}</p>
      <div class="row">
        <button class="btn ghost" id="res-leave">Back to the lobby</button>
        <button class="btn primary" id="res-again"><svg><use href="#i-whisk"/></svg>Bake again</button>
      </div>
    </div>
  </section>`;
}

/* ---------------------------------------------------------------------
   Binding
   --------------------------------------------------------------------- */
function bindMatch() {
  const host = $("screen");
  if (!host) return;
  host.querySelectorAll("[data-ing]").forEach((btn) => btn.addEventListener("click", () => pickIngredient(btn.dataset.ing, btn)));
  const recipeButtons = host.querySelectorAll("[data-recipe]");
  recipeButtons.forEach((btn) => btn.addEventListener("click", () => {
    const res = game.chooseRecipe(btn.dataset.recipe);
    if (!res.ok) { ui.toast("Locked", res.reason || "", "bad"); return; }
    sound("tap");
    applyPhaseVisuals("prepare");
    renderMatch();
  }));
  const mixBtn = $("mix-btn");
  if (mixBtn) mixBtn.addEventListener("click", doMix);
  host.querySelectorAll("[data-temp]").forEach((btn) => btn.addEventListener("click", () => {
    game.setOvenTemp(Number(btn.dataset.temp));
    sound("tap");
    renderMatch();
  }));
  const bakeStart = $("bake-start");
  if (bakeStart) bakeStart.addEventListener("click", () => {
    game.startBake();
    world.setOvenBaking(true);
    sound("good");
    renderMatch();
  });
  const bakeOut = $("bake-out");
  if (bakeOut) bakeOut.addEventListener("click", () => {
    const res = game.takeOut(false);
    world.setOvenDone(true);
    if (res.ok) ui.toast(res.perfect ? "Perfect bake" : res.burnt ? "A touch dark" : "Out of the oven", `${Math.round(res.quality * 100)}% bake quality`, res.perfect ? "good" : res.burnt ? "bad" : "info");
    sound(res.perfect ? "win" : "ding");
    renderMatch();
  });
  const readyBtn = $("stage-ready");
  if (readyBtn) readyBtn.addEventListener("click", markReady);

  // decoration
  host.querySelectorAll("[data-frost]").forEach((btn) => btn.addEventListener("click", () => {
    game.setDecoration({ frosting: btn.dataset.frost });
    refreshCake(); renderMatch();
  }));
  host.querySelectorAll("[data-style]").forEach((btn) => btn.addEventListener("click", () => {
    game.setDecoration({ style: btn.dataset.style });
    refreshCake(); renderMatch();
  }));
  host.querySelectorAll("[data-shape]").forEach((btn) => btn.addEventListener("click", () => {
    game.setDecoration({ shape: btn.dataset.shape });
    refreshCake(); renderMatch();
  }));
  host.querySelectorAll("[data-plate]").forEach((btn) => btn.addEventListener("click", () => {
    game.setDecoration({ plate: btn.dataset.plate });
    refreshCake(); renderMatch();
  }));
  host.querySelectorAll("[data-top]").forEach((btn) => btn.addEventListener("click", () => selectTopping(btn.dataset.top)));
  const sprinkle = $("sprinkle-range");
  if (sprinkle) sprinkle.addEventListener("input", () => {
    $("sprinkle-val").textContent = sprinkle.value;
    game.setDecoration({ sprinkles: Number(sprinkle.value) });
    debounceCake();
  });
  const candle = $("candle-range");
  if (candle) candle.addEventListener("input", () => {
    $("candle-val").textContent = candle.value;
    game.setDecoration({ candles: Number(candle.value) });
    debounceCake();
  });
  const msg = $("cake-message");
  if (msg) msg.addEventListener("input", () => {
    game.setDecoration({ message: msg.value });
    debounceCake();
  });
  const undo = $("undo-top");
  if (undo) undo.addEventListener("click", () => { game.undoTopping(); refreshCake(); renderMatch(); });
  const clear = $("clear-tops");
  if (clear) clear.addEventListener("click", () => { game.clearToppings(); refreshCake(); renderMatch(); });
  const random = $("randomise");
  if (random) random.addEventListener("click", () => { game.randomizeDesign(); refreshCake(); renderMatch(); });

  host.querySelectorAll("[data-vote]").forEach((btn) => btn.addEventListener("click", () => castVote(btn.dataset.vote)));
  const voteFinish = $("vote-finish");
  if (voteFinish) voteFinish.addEventListener("click", () => {
    if (M.matchId) cloud.advancePhase(M.matchId, "results", PHASES[PHASES.length - 1].seconds);
  });
  const leave = $("res-leave");
  if (leave) leave.addEventListener("click", () => leaveToLobby());
  const again = $("res-again");
  if (again) again.addEventListener("click", () => { leaveToLobby(true); if (M.mode === "online") quickMatchFlow(); else practiceFlow(); });
}

function pickIngredient(id, btn) {
  if (runtime().phase !== "prepare") return;
  const res = game.addIngredient(id);
  if (!res.ok) {
    sound("bad");
    if (btn) { btn.classList.add("wrong"); setTimeout(() => btn.classList.remove("wrong"), 320); }
    if (res.reason) ui.toast("Not this one", res.reason, "bad");
    return;
  }
  sound("add");
  const needs = game.recipeNeeds().length;
  world.setBatter(runtime().prep.added.length / needs, recipeById(myDesign().recipeId).tone);
  if (res.complete) {
    ui.toast("Everything's in", "Now mix: stop the needle in the pink band three times.", "good");
    sound("good");
  }
  renderMatch();
}

function doMix() {
  const res = game.mixPress();
  if (!res.ok) return;
  sound(res.quality > 0.6 ? "good" : "tap");
  if (res.done) {
    world.setMixer(false);
    ui.toast("Batter ready", `Mix quality ${Math.round(res.quality * 100)}%.`, "good");
  } else {
    world.setBatter(1, recipeById(myDesign().recipeId).tone);
  }
  renderMatch();
}

function selectTopping(id) {
  if (!game.owns("topping", id)) { ui.toast("Locked", "Buy that topping in the shop.", "bad"); return; }
  M.selectedTopping = M.selectedTopping === id ? null : id;
  if (M.selectedTopping) {
    world.setPlacement(id, true);
    sound("tap");
  } else {
    world.setPlacement(null, false);
  }
  renderMatch();
}

function refreshCake() {
  if (!myDesign()) return;
  try { world.setCreation(myDesign(), { scale: 1.02 }); } catch (error) { console.warn(error); }
}

function debounceCake() {
  clearTimeout(M.messageTimer);
  M.messageTimer = setTimeout(refreshCake, 220);
}

function markReady() {
  if (M.mode === "practice") {
    const phase = runtime().phase;
    if (phase === "prepare") {
      game.autoMixQuality();
      beginRound("bake");
    } else if (phase === "bake") {
      if (!runtime().oven.taken) game.takeOut(false);
      beginRound("decorate");
    } else if (phase === "decorate") {
      finalizeDesignLocal();
      beginRound("show");
    } else if (phase === "show") {
      beginRound("vote");
    }
    return;
  }
  if (runtime().phase === "prepare" && !runtime().prep.mixed) game.autoMixQuality();
  if (runtime().phase === "bake" && !runtime().oven.taken) game.takeOut(true);
  if (runtime().phase === "decorate") {
    finalizeDesignLocal();
    syncDesignToRoom();
  }
  M.readySent = true;
  cloud.setReady(M.matchId, runtime().phase);
  if (runtime().phase === "vote") { /* the vote is the ready signal */ }
  sound("tap");
  if (isHost()) hostAutoAdvance();
  renderMatch();
}

function hostAutoAdvance() {
  if (M.hostTimer) clearTimeout(M.hostTimer);
  M.hostTimer = setTimeout(() => {
    if (!ui.match || !isHost()) return;
    if (allReady()) {
      const phase = runtime().phase;
      const next = nextPhaseId(phase);
      if (M.matchId) cloud.advancePhase(M.matchId, next, phaseById(next).seconds);
    }
  }, 2200);
}

function syncDesignToRoom() {
  if (!M.matchId || !myDesign()) return;
  const score = game.scoreDesign(myDesign(), runtime().theme, {});
  runtime().myScore = score;
  cloud.submitDesign(M.matchId, myDesign(), score.base).catch((error) => {
    ui.toast("Could not send your cake", error.message || "", "bad");
  });
}

/* ---------------------------------------------------------------------
   Votes
   --------------------------------------------------------------------- */
async function castVote(toUid) {
  if (M.myVote) return;
  if (M.mode === "practice") {
    const res = game.castLocalVote(toUid);
    if (!res.ok) { ui.toast("Not this one", res.reason || "", "bad"); return; }
    M.myVote = toUid;
    runtime().votes = runtime().votes || {};
    sound("good");
    renderMatch();
    setTimeout(() => {
      if (!ui.match || M.mode !== "practice") return;
      buildPracticeResults();
      beginRound("results");
    }, 900);
    return;
  }
  try {
    await cloud.castVote(M.matchId, toUid);
    M.myVote = toUid;
    M.votes = { ...(M.votes || {}), [meUid()]: toUid };
    sound("good");
    ui.toast("Vote cast", "Results in a moment.", "good");
    if (isHost()) {
      const voters = onlinePlayers().filter((p) => p.online && p.uid !== meUid());
      const allVoted = voters.every((p) => M.votes[p.uid]);
      if (allVoted) cloud.advancePhase(M.matchId, "results", 24);
    }
    renderMatch();
  } catch (error) {
    ui.toast("Vote not accepted", error.message || "", "bad");
  }
}

/* ---------------------------------------------------------------------
   Live ticking
   --------------------------------------------------------------------- */
export function tickMatch(dt) {
  if (!ui.match) return;
  renderPhaseBar();
  const phase = runtime().phase;
  const at = $("#phase-clock b");
  if (at) {
    at.textContent = mmss(remaining());
    $("#phase-clock").classList.toggle("low", remaining() <= 10);
  }
  if (phase === "prepare") {
    const meter = $("mix-needle");
    if (meter) meter.style.left = Math.round((runtime().mix.marker || 0) * 100) + "%";
    const zone = $("mix-zone");
    if (zone) {
      zone.style.left = Math.round(runtime().mix.zone[0] * 100) + "%";
      zone.style.width = Math.round((runtime().mix.zone[1] - runtime().mix.zone[0]) * 100) + "%";
    }
    if (runtime().prep.added.length && M.lastAdded !== runtime().prep.added.length) {
      M.lastAdded = runtime().prep.added.length;
      world.setBatter(runtime().prep.added.length / game.recipeNeeds().length, recipeById(myDesign().recipeId).tone);
    }
  }
  if (phase === "bake") {
    const oven = runtime().oven;
    const recipe = recipeById(myDesign().recipeId);
    const p = Math.min(1, oven.elapsed / (recipe.bake * 1.45));
    const fill = $("oven-fill");
    if (fill) fill.style.width = (p * 100) + "%";
    const mark = $("oven-mark");
    if (mark) mark.style.left = (p * 100) + "%";
    const time = $("bake-time");
    if (time) time.textContent = oven.elapsed.toFixed(1) + "s";
    if (oven.started && !oven.taken) world.setMixer(false);
    if (oven.taken && !M.readySent) {
      world.setOvenDone(true);
    }
  }
  if (phase === "decorate" && M.selectedTopping) {
    // keep the placement ghost attached after a rebuild
    if (!world.placement) world.setPlacement(M.selectedTopping, true);
  }
  // Host: move on as soon as everyone is ready.
  if (M.mode === "online" && isHost() && M.match && M.match.phase !== "lobby" && allReady() && !M.hostTimer) hostAutoAdvance();
}

export function onDesignChange() {
  if (ui.match && runtime().phase === "decorate") debounceCake();
}

/* ---------------------------------------------------------------------
   Public hooks used by main.js
   --------------------------------------------------------------------- */
export function isInMatch() { return !!ui.match; }
export function matchStateCallback() { return M; }

export function leaveMatchToLobby() { leaveToLobby(); }

export function initialiseMatch() {
  world.setPickCallback((pick) => {
    if (!ui.match) return;
    if (pick.type === "ingredient" && runtime().phase === "prepare") pickIngredient(pick.id, null);
    if (pick.type === "topping" && runtime().phase === "decorate") selectTopping(pick.id);
  });
  world.setPlaceCallback(({ id, x, z }) => {
    if (!ui.match || runtime().phase !== "decorate") return;
    const res = game.addToppingAt(id, x, z);
    if (!res.ok) {
      if (res.reason) ui.toast("Could not place that", res.reason, "bad");
      return;
    }
    refreshCake();
    const count = myDesign().toppings.length;
    const chip = document.querySelector(".phase-head .chip");
    if (chip) chip.innerHTML = `<svg><use href="#i-palette"/></svg>${count} toppings`;
    sound("add");
  });
}
