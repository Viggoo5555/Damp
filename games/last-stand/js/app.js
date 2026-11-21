/* =====================================================================
   app.js — screens, match engine, panels and wiring
   ===================================================================== */
import {
  $, $$, el, clamp, rand, pick, fmt, pad2, toast, burst, confetti,
  audio, shake, setShake, levelBurst, startWall, drawAvatar, todayKey, hashStr
} from './fx.js';
import {
  store, RANKS, rankFor, COSMETICS, ACHIEVEMENTS, QUEST_POOL, xpNeeded, defaultProfile
} from './store.js';
import { net, authMessage, netErr } from './net.js';
import { GAMES, gameById, pickGames, eliminationCount } from './games.js';
import { W as GW, H as GH } from './games-core.js';

const SEASON = { num: '01', name: 'NEON UPRISING', start: new Date('2026-11-01T00:00:00Z').getTime(), days: 42 };

const state = {
  screen: 'auth',
  mode: 'ranked',
  panel: 'practice',
  panelTab: '',
  room: null,
  code: '',
  isHost: false,
  presence: [],
  unsub: { room: null, presence: null, scores: null },
  match: null,
  savedRoom: ''
};

/* =====================================================================
   small UI helpers
   ===================================================================== */
function showScreen(name) {
  state.screen = name;
  $$('.screen').forEach((s) => s.classList.toggle('on', s.dataset.screen === name));
  if (name === 'menu') renderMenu();
}
function showBoot(on, msg) {
  const b = $('#boot');
  if (!b) return;
  b.classList.toggle('gone', !on);
  if (msg) $('#boot-msg').textContent = msg;
}
function bootProgress(p, msg) {
  const bar = $('.boot-bar i');
  if (bar) bar.style.width = Math.round(p * 100) + '%';
  if (msg) $('#boot-msg').textContent = msg;
}
function modal(title, bodyHtml, actions) {
  const root = $('#modal-root');
  root.innerHTML = '';
  const m = el('div', 'modal');
  m.innerHTML = `<h3>${title}</h3><p>${bodyHtml}</p>`;
  const row = el('div', 'modal-actions');
  (actions || [{ label: 'OK', primary: true }]).forEach((a) => {
    const b = el('button', 'btn ' + (a.primary ? 'btn-primary' : 'btn-ghost'), a.label);
    b.onclick = () => { root.classList.remove('on'); audio.click(); if (a.fn) a.fn(); };
    row.appendChild(b);
  });
  m.appendChild(row);
  root.appendChild(m);
  root.classList.add('on');
  audio.click();
}
function closeModal() { $('#modal-root').classList.remove('on'); }
function seekScreen() {
  const b = document.activeElement;
  if (b && b.tagName === 'INPUT') return true;
  return false;
}

/* =====================================================================
   hud + menu
   ===================================================================== */
function renderHud() {
  const p = store.profile;
  const rank = rankFor(p.rating);
  $('#hud-coins').textContent = fmt(p.coins);
  $('#hud-name').textContent = p.name;
  $('#hud-name').style.color = store.equippedColor('plate', '#ecebff');
  $('#hud-level').textContent = p.level;
  const av = $('#hud-avatar');
  av.innerHTML = '';
  const cv = document.createElement('canvas');
  av.appendChild(cv);
  drawAvatar(cv, p.name, store.equippedColor('plate', '#3df3ff'));
  const frame = store.cosmetic(p.equipped.frame || '');
  av.style.borderColor = frame ? frame.color : 'var(--line-2)';
  const lp = store.levelProgress();
  $('#hud-xp').style.width = (lp.pct * 100).toFixed(1) + '%';
  const blocked = net.mode === 'online' && net.saveBlocked;
  const netState = blocked ? 'bad' : (net.mode === 'online' ? 'online' : net.mode === 'local' ? 'local' : 'offline');
  $('#net-chip').dataset.state = netState;
  $('#net-text').textContent = blocked ? 'local save' : net.mode === 'online' ? 'online' : net.mode === 'local' ? 'local' : 'offline';
  const left = Math.max(0, SEASON.days - Math.floor((Date.now() - SEASON.start) / 86400000));
  $('#season-days').textContent = left + 'd';
  $('#season-name').textContent = 'SEASON ' + SEASON.num;
  void rank;
}

function renderMenu() {
  const p = store.profile;
  const rank = rankFor(p.rating);
  $('#hero-mode').textContent = state.mode === 'ranked' ? 'RANKED QUEUE' : 'CASUAL QUEUE';
  $$('#mode-switch button').forEach((b) => b.classList.toggle('on', b.dataset.mode === state.mode));
  const wr = p.stats.matches ? Math.round((p.stats.wins / p.stats.matches) * 100) : 0;
  $('#hs-matches').textContent = p.stats.matches;
  $('#hs-winrate').textContent = wr + '%';
  $('#hs-rank').textContent = rank.name;
  $('#hs-queue').textContent = state.queueCount != null ? state.queueCount : (net.mode === 'online' ? '0' : 'off');
  $('#play-sub').textContent = net.mode === 'online' ? (state.mode === 'ranked' ? 'find a live ranked match' : 'find a live casual match') : 'solo gauntlet (no account)';

  $('#pc-name').textContent = p.name;
  $('#pc-level').textContent = p.level;
  $('#pc-rank').textContent = rank.name + ' · ' + p.rating;
  $('#pc-wins').textContent = p.stats.wins;
  $('#pc-played').textContent = p.stats.matches;
  $('#pc-elim').textContent = p.stats.elims;
  const lp = store.levelProgress();
  $('#pc-xp').style.width = (lp.pct * 100).toFixed(1) + '%';
  $('#pc-xp-text').textContent = `${lp.have} / ${lp.need} XP`;
  const plate = store.cosmetic(p.equipped.plate || '');
  const pl = $('#pc-plate');
  pl.textContent = 'NAMEPLATE: ' + (plate ? plate.name.toUpperCase() : 'STANDARD');
  pl.style.color = plate && plate.color ? plate.color : 'var(--cyan)';
  const pcAv = $('#pc-avatar');
  pcAv.innerHTML = '';
  const cv = document.createElement('canvas');
  pcAv.appendChild(cv);
  drawAvatar(cv, p.name, plate && plate.color ? plate.color : '#3df3ff');
  // rail weather
  $('#pc-avatar').style.borderColor = (store.cosmetic(p.equipped.frame || '') || {}).color || 'var(--line-2)';

  $('#sc-num').textContent = SEASON.num;
  $('#sc-sub').textContent = SEASON.name;
  const seasonPct = clamp((p.stats.wins % 10) / 10, 0.02, 1);
  $('#sc-fill').style.width = (seasonPct * 100).toFixed(0) + '%';
  const left = Math.max(0, SEASON.days - Math.floor((Date.now() - SEASON.start) / 86400000));
  $('#sc-left').textContent = left + ' days';
  $('#sc-reward').textContent = 250 + p.stats.wins * 20;

  // quests
  const ql = $('#rail-quests');
  ql.innerHTML = '';
  (p.daily.quests || []).forEach((q) => {
    const li = el('li');
    const pct = clamp(q.progress / q.goal, 0, 1);
    li.innerHTML = `<div class="q-top"><span>${q.text}</span><b>${q.progress}/${q.goal}</b></div>
      <div class="q-bar ${pct >= 1 ? 'done' : ''}"><i style="width:${pct * 100}%"></i></div>`;
    ql.appendChild(li);
  });

  renderRailBoard();
  if (net.mode === 'online') {
    net.listOnline().then((list) => {
      state.queueCount = list.filter((d) => d.inRoom).length;
      const elq = $('#hs-queue');
      if (elq) elq.textContent = list.length;
    }).catch(() => {});
  }
}

async function renderRailBoard() {
  const ol = $('#rail-board');
  ol.innerHTML = '<li><span class="b-name muted">loading…</span></li>';
  let rows = [];
  if (net.mode === 'online') rows = await net.fetchBoard('rating', 5);
  if (!rows.length) {
    rows = [{ name: store.profile.name, rating: store.profile.rating, wins: store.profile.stats.wins, uid: net.uid || 'me' }];
    ol.innerHTML = '<li class="me"><span class="b-pos">1</span><span class="b-name">' + rows[0].name + ' (you)</span><span class="b-score">' + rows[0].rating + '</span></li>';
    return;
  }
  ol.innerHTML = '';
  rows.forEach((r, i) => {
    const li = el('li', r.uid === net.uid ? 'me' : '');
    li.innerHTML = `<span class="b-pos">${i + 1}</span><span class="b-name">${escapeHtml(r.name)}</span><span class="b-score">${r.rating}</span>`;
    ol.appendChild(li);
  });
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/* =====================================================================
   AUTH
   ===================================================================== */
function setAuthMsg(msg, bad = false) {
  const m = $('#auth-msg');
  m.textContent = msg || '';
  m.style.color = bad ? 'var(--red)' : 'var(--amber)';
}

async function doAuth(kind) {
  const name = $('#auth-name').value.trim();
  const pass = $('#auth-pass').value;
  if (!/^[A-Za-z0-9_][A-Za-z0-9_.-]{2,15}$/.test(name)) return setAuthMsg('3–16 characters: letters, numbers, _ . -', true);
  if (pass.length < 6) return setAuthMsg('Password needs at least 6 characters.', true);
  if (net.mode === 'offline') return setAuthMsg('Online accounts are unavailable — play as a guest.', true);
  setAuthMsg(kind === 'signin' ? 'Signing in…' : 'Creating account…');
  try {
    const user = kind === 'signin' ? await net.signIn(name, pass) : await net.register(name, pass);
    net.name = name;
    await afterSignIn(user, name);
  } catch (err) {
    setAuthMsg(authMessage(err.code || err.message), true);
  }
}

async function afterSignIn(user, name) {
  net.name = name;
  net.uid = user.uid;
  showBoot(true, 'syncing profile…');
  bootProgress(0.6);
  const remote = await net.loadProfile(user.uid);
  if (remote && !remote.name) remote.name = name;
  store.bindRemote(remote, user.uid);
  if (!remote) store.profile.name = name;
  store.profile.name = store.profile.name || name;
  store.save();
  net.publishBoard(store.profile);
  net.setPresence({ inRoom: false });
  setAuthMsg('');
  showBoot(false);
  renderHud();
  showScreen('menu');
  toast('WELCOME ' + store.profile.name.toUpperCase(), 'good');
  if (net.saveBlocked) {
    toast('ONLINE SAVE UNAVAILABLE — progress stays on this device', 'bad', 5200);
    renderHud();
  }
  startHeartbeat();
}

function startGuest() {
  net.mode = net.mode === 'online' ? 'online' : 'local';
  store.bindRemote(null, net.uid);
  store.profile.name = store.profile.name === 'guest' ? 'guest' : store.profile.name;
  try { localStorage.setItem('ob-guest-mode', '1'); } catch (e) { /* ignore */ }
  renderHud();
  showScreen('menu');
  toast('GUEST MODE — progress saves on this device', 'gold', 3200);
}

let heartbeat = 0;
function startHeartbeat() {
  if (heartbeat) clearInterval(heartbeat);
  heartbeat = setInterval(() => {
    if (net.mode !== 'online' || !net.uid) return;
    net.setPresence({ inRoom: !!state.code, level: store.profile.level, rating: store.profile.rating });
    net.publishBoard(store.profile);
  }, 30000);
}

/* =====================================================================
   QUICK MATCH
   ===================================================================== */
async function quickMatch() {
  audio.resume();
  if (net.mode !== 'online' || !net.uid) {
    modal('SOLO GAUNTLET', 'You are not signed in to the arcade, so live matchmaking is closed. The solo gauntlet plays the same microgames back to back and still pays XP and coins — no pretend opponents.', [
      { label: 'CANCEL' },
      { label: 'START SOLO RUN', primary: true, fn: () => startSoloRun() }
    ]);
    return;
  }
  const btn = $('#btn-play');
  btn.disabled = true;
  $('#play-sub').textContent = 'searching…';
  try {
    let code = await net.findOpenRoom(state.mode);
    if (!code) code = await net.createRoom({ mode: state.mode, open: true, maxPlayers: 20 });
    await enterLobby(code);
  } catch (err) {
    audio.bad();
    modal('MATCHMAKING CLOSED', netErr(err) + ' You can still play the solo gauntlet and the practice range while that is sorted out.', [
      { label: 'BACK' },
      { label: 'SOLO GAUNTLET', primary: true, fn: () => startSoloRun() }
    ]);
    console.warn('[app] matchmaking failed', err && err.code);
    $('#play-sub').textContent = net.mode === 'online' ? 'find a live match' : 'solo gauntlet (no account)';
  } finally {
    btn.disabled = false;
  }
}

async function enterLobby(code) {
  leaveLobby(true);
  state.code = code;
  state.savedRoom = code;
  try { localStorage.setItem('ls-room', code); } catch (e) { /* ignore */ }
  await net.roomPresence(code, { level: store.profile.level, rating: store.profile.rating, ready: false, plate: store.profile.equipped.plate, joined: Date.now() });
  net.setPresence({ inRoom: true });
  showScreen('lobby');
  $('#lobby-code').textContent = code;
  $('#lobby-title').textContent = state.mode === 'ranked' ? 'RANKED QUEUE' : 'NEON UPRISING';
  $('#lobby-sub').textContent = 'Waiting for players…';
  $('#btn-ready').textContent = "I'M READY";
  state.ready = false;
  subscribeRoom(code);
  startLobbyTimers();
}

function subscribeRoom(code) {
  state.unsub.room = net.watchRoom(code, (room) => {
    if (!room) {
      toast('THE ROOM CLOSED', 'bad');
      leaveLobby(true);
      showScreen('menu');
      return;
    }
    const prevHost = state.room && state.room.host;
    state.room = room;
    state.isHost = room.host === net.uid;
    if (prevHost !== room.host) state.isHost = room.host === net.uid;
    if (room.phase === 'lobby') {
      if (state.screen !== 'lobby') { showScreen('lobby'); $('#lobby-code').textContent = code; }
      renderLobby();
    } else if (room.phase === 'round' || room.phase === 'results' || room.phase === 'over') {
      onRoomMatchUpdate(room);
    }
  });
  state.unsub.presence = net.watchPresence(code, (list) => {
    state.presence = list;
    if (state.room && state.room.phase === 'lobby') renderLobby();
    if (state.isHost) hostLobbyTick();
  });
}

let lobbyTimers = 0;
function startLobbyTimers() {
  if (lobbyTimers) clearInterval(lobbyTimers);
  lobbyTimers = setInterval(() => {
    if (!state.code) return;
    net.roomPresence(state.code, { level: store.profile.level, rating: store.profile.rating, ready: state.ready, plate: store.profile.equipped.plate });
    if (state.isHost) hostLobbyTick();
    hostWatchdog();
  }, 4000);
}

function renderLobby() {
  const room = state.room;
  if (!room) return;
  const slots = $('#lobby-slots');
  slots.innerHTML = '';
  const list = state.presence.slice().sort((a, b) => (a.joined || 0) - (b.joined || 0));
  const max = room.maxPlayers || 20;
  list.forEach((pl) => {
    const isMe = pl.uid === net.uid;
    const slot = el('div', 'slot' + (isMe ? ' me' : ''));
    const plate = store.cosmetic(pl.plate || '');
    slot.innerHTML = `
      <div class="slot-head">
        <span class="avatar"><canvas></canvas></span>
        <span class="slot-name" style="color:${plate && plate.color ? plate.color : 'inherit'}">${escapeHtml(pl.name || 'player')}</span>
      </div>
      <div class="slot-rank">LVL ${pl.level || 1} · ${(rankFor(pl.rating || 1000)).name}</div>
      <div class="slot-tags">
        ${pl.uid === room.host ? '<span class="tag host">HOST</span>' : ''}
        ${pl.ready ? '<span class="tag ready">READY</span>' : '<span class="tag">WAITING</span>'}
        ${isMe ? '<span class="tag you">YOU</span>' : ''}
      </div>`;
    const cv = slot.querySelector('canvas');
    drawAvatar(cv, pl.name || 'x', (store.cosmetic(pl.plate || '') || {}).color || '#3b2f6b');
    slots.appendChild(slot);
  });
  for (let i = list.length; i < Math.min(max, list.length + (4 - (list.length % 4 || 4)) + 4); i++) {
    slots.appendChild(el('div', 'slot empty', '<span class="muted tiny">open slot</span>'));
  }
  const readyN = list.filter((p) => p.ready).length;
  $('#ready-count').textContent = readyN;
  $('#lobby-sub').textContent = list.length < 2
    ? 'Waiting for players — share the room code.'
    : `${list.length} in the lobby · ${readyN} ready`;
  $('#btn-ready').textContent = state.ready ? 'READY ✓' : "I'M READY";
  $('#btn-ready').classList.toggle('btn-primary', !state.ready);
  $('#lobby-code-wrap').hidden = false;
  $('#lobby-hint').textContent = state.isHost
    ? 'You are the host — the match starts when everyone is ready (20s auto-start).'
    : 'The host starts the match when everyone is ready.';
}

function hostLobbyTick() {
  if (!state.isHost || !state.room || state.room.phase !== 'lobby') return;
  const list = state.presence;
  const now = Date.now();
  const roomAge = now - (state.room.createdAt || now);
  const everyone = list.length >= 2 && list.every((p) => p.ready);
  if (!state.lobbyDeadline && (everyone || (list.length >= 2 && roomAge > 20000))) {
    state.lobbyDeadline = now + 5200;
    showLobbyCountdown(true);
    countdownTo(5, () => startHostedMatch());
  }
  if (state.lobbyDeadline && now > state.lobbyDeadline) state.lobbyDeadline = 0;
}

function showLobbyCountdown(on) {
  const elx = $('#lobby-countdown');
  elx.hidden = !on;
  if (!on) return;
}
function countdownTo(sec, fn) {
  let n = sec;
  const elx = $('#lobby-cd-num');
  const tick = () => {
    if (n <= 0) { fn(); return; }
    if (elx) elx.textContent = n;
    audio.tick();
    n--;
    setTimeout(tick, 1000);
  };
  tick();
}

/* host builds the match */
async function startHostedMatch() {
  if (!state.isHost) return;
  const room = state.room;
  if (!room) return;
  showLobbyCountdown(false);
  state.lobbyDeadline = 0;
  const list = state.presence.slice().sort((a, b) => (a.joined || 0) - (b.joined || 0));
  if (list.length < 2) return;
  const players = {};
  list.forEach((p) => {
    players[p.uid] = {
      name: p.name || 'player', level: p.level || 1, rating: p.rating || 1000,
      alive: true, out: 0, total: 0, plate: p.plate || ''
    };
  });
  const games = pickGames(10).map((g) => g.id);
  await net.clearScores(state.code);
  await net.patchRoom(state.code, {
    phase: 'round', round: 1, seq: 1, game: games[0], games,
    players, lastResults: [], winner: '',
    startAt: Date.now() + 5600, endsAt: Date.now() + 5600 + (gameById(games[0]).seconds + 1) * 1000,
    hostSeen: Date.now()
  });
}

/* =====================================================================
   MATCH — shared plumbing
   ===================================================================== */
const match = {
  active: false, online: false, solo: false, practice: false,
  players: [], meUid: '', round: 0, seq: 0, gameId: '', game: null, inst: null,
  phase: 'idle', endsAt: 0, startedAt: 0, score: 0, done: false,
  results: [], scores: {}, watchdog: 0, raf: 0, lastTs: 0, finished: false,
  resultsRound: 0
};

function clearMatch() {
  cancelAnimationFrame(match.raf);
  match.active = false;
  match.inst = null;
  match.game = null;
  match.phase = 'idle';
  $('#match-overlay').innerHTML = '';
  $('#match-overlay').classList.remove('active');
}

function setOverlay(html, active = false) {
  const ov = $('#match-overlay');
  ov.innerHTML = html;
  ov.classList.toggle('active', active);
}

function alivePlayers() {
  return match.players.filter((p) => p.alive);
}

function renderMatchHud() {
  const alive = alivePlayers().length;
  $('#mh-round').textContent = 'ROUND ' + match.round;
  $('#mh-alive').textContent = alive + ' ALIVE';
  $('#mh-score').textContent = Math.round(match.score);
  const pips = $('#mh-pips');
  pips.innerHTML = '';
  match.players.forEach((p) => {
    const d = el('i', 'pip' + (p.alive ? '' : ' dead') + (p.uid === match.meUid ? ' me' : ''));
    d.title = p.name;
    pips.appendChild(d);
  });
  $('#mf-game').textContent = match.game ? match.game.name : '—';
}

function setTimer(frac, seconds) {
  const bar = $('#mh-timer');
  const fill = $('#mh-timer-fill');
  fill.style.width = clamp(frac, 0, 1) * 100 + '%';
  bar.classList.toggle('low', frac < 0.28);
  $('#mh-timer-text').textContent = pad2(Math.max(0, Math.ceil(seconds)));
}

/* ------------------------------------------------------- canvas runner */
function fitCanvas() {
  const cv = $('#game-canvas');
  const wrap = cv.parentElement;
  if (!wrap) return;
  const aw = wrap.clientWidth, ah = wrap.clientHeight;
  const scale = Math.min(aw / GW, ah / GH);
  cv.style.width = Math.floor(GW * scale) + 'px';
  cv.style.height = Math.floor(GH * scale) + 'px';
}

function canvasPoint(ev) {
  const cv = $('#game-canvas');
  const r = cv.getBoundingClientRect();
  return {
    x: ((ev.clientX - r.left) / r.width) * GW,
    y: ((ev.clientY - r.top) / r.height) * GH
  };
}

function runGame(gameDef, opts) {
  const cv = $('#game-canvas');
  const ctx = cv.getContext('2d');
  fitCanvas();
  const api = {
    rng: Math.random,
    sfx: audio,
    trail: store.equippedColor('trail', '#3df3ff'),
    setHint: (t) => { $('#mf-keys').textContent = t; },
    done: (raw) => finishGame(raw)
  };
  match.game = gameDef;
  match.gameId = gameDef.id;
  match.score = 0;
  match.done = false;
  match.inst = gameDef.make(api);
  match.phase = 'play';
  match.startedAt = performance.now();
  match.endsAt = match.startedAt + (opts && opts.seconds ? opts.seconds * 1000 : gameDef.seconds * 1000);
  $('#mf-keys').textContent = gameDef.keys;
  let last = performance.now();

  const loop = (ts) => {
    if (!match.active || !match.inst) return;
    const dt = Math.min(0.05, (ts - last) / 1000);
    last = ts;
    const remain = (match.endsAt - performance.now()) / 1000;
    const total = (match.endsAt - match.startedAt) / 1000;
    setTimer(remain / total, remain);
    if (remain <= 0 && !match.done) {
      finishGame(match.inst.score || 0);
      return;
    }
    if (!match.done) {
      try { match.inst.update(dt); } catch (e) { console.warn(e); }
      const live = match.inst.score || 0;
      if (live !== match.score) {
        match.score = live;
        $('#mh-score').textContent = Math.round(match.score);
      }
      ctx.save();
      try { match.inst.draw(ctx); } catch (e) { console.warn(e); }
      ctx.restore();
    }
    match.raf = requestAnimationFrame(loop);
  };
  match.raf = requestAnimationFrame(loop);
}

function finishGame(raw) {
  if (match.done) return;
  match.done = true;
  match.score = Math.max(0, Math.round(raw || 0));
  match.inst = null;
  $('#mh-score').textContent = match.score;
  if (match.onFinish) match.onFinish(match.score);
}

/* pointer / key plumbing */
(function bindInputs() {
  const cv = $('#game-canvas');
  const send = (type, ev) => {
    if (!match.inst) return;
    const p = canvasPoint(ev);
    try { match.inst.pointer && match.inst.pointer(type, p.x, p.y); } catch (e) { console.warn(e); }
    if (type === 'down' && !document.body.classList.contains('reduced-motion')) {
      burst(ev.clientX, ev.clientY, store.equippedColor('trail', '#3df3ff'), 4, 0.5);
    }
  };
  cv.addEventListener('pointerdown', (e) => { e.preventDefault(); audio.resume(); send('down', e); cv.setPointerCapture && cv.setPointerCapture(e.pointerId); });
  cv.addEventListener('pointermove', (e) => { if (e.buttons || e.pointerType === 'mouse') send('move', e); });
  cv.addEventListener('pointerup', (e) => send('up', e));
  cv.addEventListener('pointercancel', (e) => send('up', e));
  window.addEventListener('keydown', (e) => {
    if (!match.inst || seekScreen()) return;
    if (['Space', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.code)) e.preventDefault();
    try { match.inst.key && match.inst.key(e.code, true); } catch (err) { /* ignore */ }
  });
  window.addEventListener('keyup', (e) => {
    if (!match.inst) return;
    try { match.inst.key && match.inst.key(e.code, false); } catch (err) { /* ignore */ }
  });
  window.addEventListener('resize', fitCanvas);
})();

/* ---------------------------------------------------- intro / results */
function blankCanvas() {
  const cv = $('#game-canvas');
  const ctx = cv && cv.getContext('2d');
  if (!ctx) return;
  ctx.fillStyle = '#06040e';
  ctx.fillRect(0, 0, cv.width, cv.height);
}

function clearOverlay() {
  const ov = $('#match-overlay');
  ov.innerHTML = '';
  ov.classList.remove('active');
}

function roundIntro(gameDef, round, aliveCount, then) {
  setOverlay(`<div class="rintro">
      <span class="rk">ROUND ${round} · ${aliveCount} ALIVE</span>
      <h2>${gameDef.name}</h2>
      <p>${gameDef.brief}</p>
      <div class="cd" id="rcd">3</div>
    </div>`, true);
  $('#mf-game').textContent = gameDef.name;
  audio.tick();
  let n = 3;
  const step = () => {
    const cd = $('#rcd');
    if (!cd) return;
    n--;
    if (n > 0) { cd.textContent = n; audio.tick(); setTimeout(step, 800); }
    else { cd.className = 'go'; cd.textContent = 'GO'; audio.go(); setTimeout(() => { clearOverlay(); then(); }, 420); }
  };
  setTimeout(step, 900);
}

/* =====================================================================
   SOLO GAUNTLET
   ===================================================================== */
function startSoloRun() {
  const games = pickGames(7);
  match.active = true;
  match.online = false;
  match.solo = true;
  $('#btn-forfeit').style.visibility = '';
  match.practice = false;
  match.players = [{ uid: net.uid || 'you', name: store.profile.name, alive: true, level: store.profile.level }];
  match.meUid = net.uid || 'you';
  match.round = 0;
  match.finished = false;
  match.results = [];
  match.soloGames = games;
  match.soloScores = [];
  showScreen('match');
  setTimeout(fitCanvas, 60);
  nextSoloRound();
}

function nextSoloRound() {
  const games = match.soloGames;
  if (match.round >= games.length) return endSoloRun();
  const gameDef = games[match.round];
  match.round += 1;
  renderMatchHud();
  setTimer(1, gameDef.seconds);
  roundIntro(gameDef, match.round, 1, () => {
    runGame(gameDef, null);
    match.onFinish = (score) => {
      const perf = clamp(score / gameDef.best, 0, 1);
      match.soloScores.push({ game: gameDef.id, name: gameDef.name, score, perf });
      match.score = score;
      const pb = store.profile.pb[gameDef.id] || 0;
      if (score > pb) {
        store.profile.pb[gameDef.id] = score;
        store.save();
        toast('NEW PERSONAL BEST · ' + gameDef.name, 'gold');
        audio.coin();
      }
      setOverlay(`<div class="results-card">
          <h3>${gameDef.name}</h3>
          <div class="results-foot" style="margin:0 0 12px"><span>SCORE</span><span style="font-size:22px;color:var(--cyan)">${score}</span></div>
          <p class="muted" style="margin:0 0 10px">${Math.round(perf * 100)}% of the target ${gameDef.best} · personal best ${Math.max(pb, score)}</p>
          <div class="results-foot"><span>${match.round} / ${games.length}</span><span>${match.round < games.length ? 'NEXT UP…' : 'TALLYING…'}</span></div>
        </div>`, true);
      setTimeout(() => { if (match.round < games.length) nextSoloRound(); else endSoloRun(); }, 2200);
    };
  });
}

function endSoloRun() {
  const rows = match.soloScores;
  const avg = rows.reduce((a, b) => a + b.perf, 0) / Math.max(1, rows.length);
  const xp = 30 + Math.round(avg * 140) + rows.length * 8;
  const coins = 20 + Math.round(avg * 90);
  const res = store.recordMatch({
    place: 1, field: 1, rounds: rows.length, gameCount: rows.length,
    games: rows.map((r) => r.game), cleanRounds: rows.filter((r) => r.perf >= 0.8).length,
    ranked: false, solo: true, xp, coins, knockedOut: 0, flawless: avg >= 0.85
  });
  const best = rows.slice().sort((a, b) => b.perf - a.perf)[0];
  match.active = false;
  setOverlay(`<div class="winner">
      <div class="crown"></div>
      <h2>RUN COMPLETE</h2>
      <p>${rows.length} games · ${Math.round(avg * 100)}% average${best ? ' · best ' + best.name : ''}</p>
      <div class="rewards">
        <span class="reward-pill">+${xp} XP</span>
        <span class="reward-pill"><i class="ico-coin"></i>+${coins}</span>
      </div>
      <div style="display:flex;gap:8px;margin-top:14px">
        <button class="btn btn-primary" id="btn-again">RUN AGAIN</button>
        <button class="btn btn-ghost" id="btn-hub">BACK TO MENU</button>
      </div>
    </div>`, true);
  blankCanvas();
  $('#btn-forfeit').style.visibility = 'hidden';
  setTimeout(() => { if (res.levelled) levelBurst(res.levelled); }, 620);
  if (res.levelled) audio.level();
  else audio.win();
  confetti([store.equippedColor('burst', '#ff2f9c'), '#3df3ff', '#ffd35c']);
  $('#mh-round').textContent = 'RUN COMPLETE';
  $('#mh-alive').textContent = rows.length + ' GAMES';
  $('#mf-game').textContent = '—';
  $('#mf-keys').textContent = '';
  $('#btn-again').onclick = () => { audio.click(); startSoloRun(); };
  $('#btn-hub').onclick = () => { audio.click(); clearMatch(); showScreen('menu'); renderHud(); };
  renderHud();
  res.achievements.forEach((a) => toast('ACHIEVEMENT · ' + a.name, 'gold', 3600));
}

/* =====================================================================
   ONLINE MATCH — driven by the room document
   ===================================================================== */
function onRoomMatchUpdate(room) {
  const prevSeq = match.seq;
  const entering = !match.active || match.phase === 'idle';
  if (room.phase === 'over') return onMatchOver(room);

  const inRound = room.phase === 'round' || room.phase === 'results';
  if (!match.active && inRound) {
    // join the match view late (refresh / reconnect)
    match.active = true;
    match.online = true;
    match.solo = false;
    match.practice = false;
    match.meUid = net.uid;
    match.players = Object.entries(room.players || {}).map(([uid, p]) => Object.assign({ uid }, p));
    showScreen('match');
    setTimeout(fitCanvas, 60);
  }
  if (!match.active) return;
  match.players = Object.entries(room.players || {}).map(([uid, p]) => Object.assign({ uid }, p));
  match.round = room.round || match.round;

  if (room.phase === 'round' && room.seq !== match.seq) {
    match.seq = room.seq;
    startOnlineRound(room);
  } else if (room.phase === 'results' && room.lastResults) {
    renderRoundResults(room);
  }
  renderMatchHud();
}

function renderRoundResults(room) {
  if (match.finished || match.resultsRound === room.round) return;
  const rows = (room.lastResults || []).slice().sort((a, b) => (a.pos || 99) - (b.pos || 99));
  if (!rows.length) return;
  match.resultsRound = room.round;
  match.phase = 'results';
  const me = rows.find((r) => r.uid === net.uid);
  const out = rows.filter((r) => r.out);
  const left = Object.values(room.players || {}).filter((p) => p.alive).length;
  const def = gameById(room.game);
  const list = rows.slice(0, 12).map((r) => `
      <li class="${r.uid === net.uid ? 'me' : ''} ${r.out ? 'out' : ''}">
        <span class="r-pos">${r.pos || '—'}</span>
        <span class="r-name">${escapeHtml(r.name || 'player')}${r.uid === net.uid ? ' · you' : ''}</span>
        <span class="r-score">${Math.round((r.perf || 0) * 100)}%</span>
        <span class="r-out">${r.out ? 'OUT' : 'SAFE'}</span>
      </li>`).join('');
  setOverlay(`<div class="results-card wide">
      <div class="results-head"><span>ROUND ${room.round}${def ? ' · ' + escapeHtml(def.name) : ''}</span><span>${left} REMAIN</span></div>
      <ul class="results-list">${list}</ul>
      <div class="results-foot"><span>${me ? (me.out ? 'YOU ARE ELIMINATED' : 'YOU SURVIVED · #' + me.pos) : 'SPECTATING'}</span><span>${out.length ? out.length + ' OUT' : 'EVERYONE SURVIVED'}</span></div>
    </div>`, true);
  if (me && me.out) {
    audio.elim(); shake(12);
    toast('ELIMINATED — ' + store.equippedWord(), 'bad', 3600);
  } else {
    audio.ok();
    if (out.length) toast(out.length + ' ELIMINATED · ' + out.slice(0, 3).map((o) => o.name).join(', '), 'bad', 3200);
  }
}

function startOnlineRound(room) {
  const def = gameById(room.game);
  if (!def) return;
  const lead = Math.max(0, (room.startAt || 0) - Date.now());
  match.round = room.round;
  match.done = false;
  match.score = 0;
  match.submitted = false;
  match.gameId = def.id;
  match.players = Object.entries(room.players || {}).map(([uid, p]) => Object.assign({ uid }, p));
  match.meUid = net.uid;
  renderMatchHud();
  setTimer(1, def.seconds);
  const begin = () => {
    const remain = Math.max(1, ((room.endsAt || Date.now() + def.seconds * 1000) - Date.now()) / 1000);
    runGame(def, { seconds: Math.min(def.seconds, remain) });
    match.onFinish = (score) => {
      const perf = clamp(score / def.best, 0, 1);
      submitScore(room.seq, score, perf);
      // the host may already have published this round's placements
      if (match.phase === 'results' || match.finished) return;
      setOverlay(`<div class="results-card"><h3>${def.name}</h3>
        <div class="results-foot" style="margin:0"><span>YOUR SCORE</span><span style="font-size:24px;color:var(--cyan)">${score}</span></div>
        <div class="results-foot"><span>${Math.round(perf * 100)}% PERFORMANCE</span><span>AWAITING THE FIELD…</span></div></div>`, true);
    };
  };
  if (lead > 400) {
    // the host scheduled an intro; show our own countdown in sync
    const secs = Math.ceil(lead / 1000) - 1;
    setOverlay(`<div class="rintro"><span class="rk">ROUND ${room.round} · ${alivePlayers().length} ALIVE</span>
      <h2>${def.name}</h2><p>${def.brief}</p><div class="cd" id="rcd">${Math.max(1, secs)}</div></div>`, true);
    audio.tick();
    const t0 = Date.now();
    const watch = setInterval(() => {
      const left = Math.ceil((lead - (Date.now() - t0)) / 1000);
      const cd = $('#rcd');
      if (cd) cd.textContent = Math.max(1, left);
      if (left <= 0) { clearInterval(watch); audio.go(); clearOverlay(); begin(); }
    }, 200);
  } else {
    begin();
  }
}

async function submitScore(seq, score, perf) {
  if (match.submitted) return;
  match.submitted = true;
  if (!match.online) return;
  try {
    await net.writeScore(state.code, seq, { round: match.round, score, perf });
  } catch (e) { console.warn('[score] submit failed', e); toast('SCORE DID NOT REACH THE ROOM', 'bad'); }
}

/* host director: collect, rank, eliminate, advance */
function hostDirectorTick() {
  if (!state.isHost || !state.room || !match.online) return;
  const room = state.room;
  if (room.phase === 'round' && Date.now() > (room.endsAt || 0) + 2600) {
    if (!state.collecting) collectAndEliminate(room);
  }
  if (room.phase === 'results' && Date.now() > (room.nextAt || 0)) {
    if (!state.advancing) advanceRound(room);
  }
}

async function collectAndEliminate(room) {
  state.collecting = true;
  try {
    const { f, db } = net.fb;
    const snap = await f.getDocs(f.collection(db, 'ls_rooms', state.code, 'scores'));
    const scores = {};
    snap.docs.forEach((d) => {
      const s = d.data();
      if (s.seq === room.seq) scores[s.uid] = s;
    });
    const players = Object.entries(room.players || {}).map(([uid, p]) => Object.assign({ uid }, p));
    const alive = players.filter((p) => p.alive);
    const list = alive.map((p) => {
      const s = scores[p.uid];
      const stale = Date.now() - (p.seen || 0) > 20000;
      return {
        uid: p.uid, name: p.name,
        score: s ? s.score : 0,
        perf: s && !stale ? s.perf : 0,
        tie: hashStr(p.name) % 997
      };
    }).sort((a, b) => (b.perf - a.perf) || (b.score - a.score) || (a.tie - b.tie));

    const cut = Math.min(eliminationCount(alive.length), alive.length - 1);
    const outIds = list.slice(list.length - cut).map((r) => r.uid);
    const nextPlayers = Object.assign({}, room.players);
    outIds.forEach((uid) => {
      if (nextPlayers[uid]) { nextPlayers[uid].alive = false; nextPlayers[uid].out = room.round; }
    });
    list.forEach((r, i) => {
      if (nextPlayers[r.uid]) nextPlayers[r.uid].total = (nextPlayers[r.uid].total || 0) + r.perf;
    });

    const remaining = Object.values(nextPlayers).filter((p) => p.alive);
    const lastResults = list.map((r, i) => Object.assign({ pos: i + 1, out: outIds.includes(r.uid) }, r));
    const over = remaining.length <= 1;
    const patch = {
      players: nextPlayers,
      lastResults,
      phase: over ? 'over' : 'results',
      nextAt: Date.now() + 6000,
      hostSeen: Date.now()
    };
    if (over) {
      const winnerId = remaining[0] ? Object.keys(nextPlayers).find((k) => nextPlayers[k].alive) : '';
      patch.winner = winnerId || '';
      // rank by survival: the winner first, then whoever lasted longest
      patch.placements = Object.entries(nextPlayers)
        .map(([uid, p]) => ({ uid, name: p.name, alive: p.alive, rounds: p.out || 0 }))
        .sort((a, b) => (Number(b.alive) - Number(a.alive)) || (b.rounds - a.rounds))
        .map((p, i) => ({ uid: p.uid, name: p.name, place: i + 1, rounds: p.rounds }));
    }
    await net.patchRoom(state.code, patch);
  } catch (e) {
    console.warn('[host] collect failed', e);
  } finally {
    state.collecting = false;
  }
}

async function advanceRound(room) {
  state.advancing = true;
  try {
    const next = (room.round || 1) + 1;
    const games = room.games || pickGames(10).map((g) => g.id);
    const gid = games[(next - 1) % games.length];
    const def = gameById(gid);
    const start = Date.now() + 5600;
    await net.patchRoom(state.code, {
      phase: 'round', round: next, seq: (room.seq || 0) + 1, game: gid,
      startAt: start, endsAt: start + (def.seconds + 1) * 1000, lastResults: [], hostSeen: Date.now()
    });
  } catch (e) { console.warn('[host] advance failed', e); }
  finally { state.advancing = false; }
}

function onMatchOver(room) {
  if (match.finished) {
    if (match.phase !== 'over') renderFinal(room);
    return;
  }
  match.finished = true;
  renderFinal(room);
}

function renderFinal(room) {
  match.phase = 'over';
  const placements = room.placements || [];
  const me = placements.find((p) => p.uid === net.uid);
  const place = me ? me.place : placements.length;
  const field = placements.length || 1;
  const won = place === 1;
  const rounds = room.round || 1;
  const xp = 40 + Math.round((1 - (place - 1) / field) * 90) + rounds * 10 + (won ? 90 : 0);
  const coins = 25 + Math.round((1 - (place - 1) / field) * 70) + (won ? 70 : 0);
  const res = store.recordMatch({
    place, field, rounds, games: (room.games || []).slice(0, rounds),
    cleanRounds: 0, ranked: state.mode === 'ranked', xp, coins,
    knockedOut: 0, flawless: won && rounds >= 3
  });
  const rows = placements.slice(0, 10).map((p) => `
      <li class="${p.uid === net.uid ? 'me' : ''}">
        <span class="r-pos">${p.place}</span>
        <span class="r-name">${escapeHtml(p.name)}</span>
        <span class="r-score">${p.uid === room.winner ? 'WINNER' : 'round ' + p.rounds}</span>
      </li>`).join('');
  setOverlay(`<div class="winner">
      ${won ? '<div class="crown"></div>' : ''}
      <h2>${won ? 'LAST ONE STANDING' : '#' + place + ' OF ' + field}</h2>
      <p>${won ? 'You take the crown.' : 'Knocked out in round ' + Math.max(1, rounds) + ' — run it back.'}</p>
      <div class="rewards">
        <span class="reward-pill">+${xp} XP</span>
        <span class="reward-pill"><i class="ico-coin"></i>+${coins}</span>
        ${res.delta ? `<span class="reward-pill" style="color:${res.delta > 0 ? 'var(--lime)' : 'var(--red)'}">${res.delta > 0 ? '+' : ''}${res.delta} RATING</span>` : ''}
      </div>
      <ul class="results-list" style="margin-top:14px;width:min(520px,90%)">${rows}</ul>
      <div style="display:flex;gap:8px;margin-top:12px">
        <button class="btn btn-primary" id="btn-again">PLAY AGAIN</button>
        <button class="btn btn-ghost" id="btn-hub">BACK TO MENU</button>
      </div>
    </div>`, true);
  if (won) { audio.win(); confetti([store.equippedColor('burst', '#ff2f9c'), '#3df3ff', '#ffd35c']); }
  else audio.bad();
  blankCanvas();
  $('#btn-forfeit').style.visibility = 'hidden';
  setTimeout(() => { if (res.levelled) levelBurst(res.levelled); }, 620);
  if (res.levelled) audio.level();
  res.achievements.forEach((a) => toast('ACHIEVEMENT · ' + a.name, 'gold', 4000));
  toast(`+${xp} XP · +${coins} COINS`, 'gold', 3600);
  renderHud();
  store.pushRemote && store.pushRemote(store.profile);
  net.publishBoard(store.profile);
  $('#mh-round').textContent = 'MATCH OVER';
  $('#mh-alive').textContent = won ? 'WINNER' : '#' + place;
  $('#mf-game').textContent = '—';
  $('#mf-keys').textContent = '';
  $('#btn-again').onclick = () => { audio.click(); leaveLobby(true); quickMatch(); };
  $('#btn-hub').onclick = () => { audio.click(); leaveLobby(true); clearMatch(); showScreen('menu'); };
}

function hostWatchdog() {
  // keep the room's clock fresh, take over if the host vanished
  const room = state.room;
  if (!room) return;
  if (state.isHost) {
    net.patchRoom(state.code, { hostSeen: Date.now() }).catch(() => {});
    hostDirectorTick();
    return;
  }
  if (Date.now() - (room.hostSeen || 0) > 12000 && state.presence.length) {
    const oldest = state.presence.slice().sort((a, b) => (a.joined || 0) - (b.joined || 0))[0];
    if (oldest && oldest.uid === net.uid) {
      toast('HOST LEFT — TAKING OVER THE LOBBIES', 'bad', 3000);
      net.patchRoom(state.code, { host: net.uid, hostSeen: Date.now() }).then(() => {
        state.isHost = true;
      }).catch(() => {});
    }
  }
}

/* =====================================================================
   LEAVE
   ===================================================================== */
function leaveLobby(silent) {
  if (state.unsub.room) { state.unsub.room(); state.unsub.room = null; }
  if (state.unsub.presence) { state.unsub.presence(); state.unsub.presence = null; }
  if (state.code && net.uid) net.leaveRoom(state.code).catch(() => {});
  if (state.isHost && state.code && state.room && state.room.phase === 'lobby') {
    net.deleteRoom(state.code).catch(() => {});
  }
  state.code = '';
  state.room = null;
  state.isHost = false;
  state.presence = [];
  state.ready = false;
  state.lobbyDeadline = 0;
  match.finished = false;
  try { localStorage.removeItem('ls-room'); } catch (e) { /* ignore */ }
  if (!silent) {
    clearMatch();
    showScreen('menu');
    renderHud();
  }
}

/* =====================================================================
   PANELS
   ===================================================================== */
const PANELS = {
  practice: { title: 'PRACTICE RANGE', kick: 'TRAIN' },
  custom: { title: 'CUSTOM GAMES', kick: 'PRIVATE' },
  shop: { title: 'NEON SHOP', kick: 'COSMETICS' },
  quests: { title: 'QUESTS & SEASON', kick: 'PROGRESS' },
  leaderboard: { title: 'LEADERBOARD', kick: 'RANKINGS' },
  profile: { title: 'PROFILE', kick: 'CAREER' },
  settings: { title: 'SETTINGS', kick: 'CABINET' }
};

function openPanel(kind) {
  state.panel = kind;
  state.panelTab = '';
  showScreen('panel');
  const meta = PANELS[kind] || { title: kind, kick: '' };
  $('#panel-title').textContent = meta.title;
  $('#panel-kick').textContent = meta.kick;
  renderPanel();
}

function renderPanel() {
  const body = $('#panel-body');
  const tabs = $('#panel-tabs');
  tabs.innerHTML = '';
  body.innerHTML = '';
  const addTabs = (list, current, fn) => {
    tabs.innerHTML = '';
    list.forEach((t) => {
      const b = el('button', t.id === current ? 'on' : '', t.label);
      b.onclick = () => { audio.click(); fn(t.id); };
      tabs.appendChild(b);
    });
  };
  if (state.panel === 'practice') return renderPractice(body);
  if (state.panel === 'custom') return renderCustom(body);
  if (state.panel === 'shop') return renderShop(body, addTabs);
  if (state.panel === 'quests') return renderQuests(body);
  if (state.panel === 'leaderboard') return renderLeaderboard(body, addTabs);
  if (state.panel === 'profile') return renderProfile(body);
  if (state.panel === 'settings') return renderSettings(body);
}

function renderPractice(body) {
  const p = store.profile;
  body.innerHTML = `<p class="muted" style="margin:0 0 12px">Every microgame, on demand. Practice never touches your rating.</p>
    <div class="game-grid" id="prac-grid"></div>`;
  const grid = $('#prac-grid');
  GAMES.forEach((g) => {
    const pb = p.pb[g.id] || 0;
    const t = el('button', 'game-tile');
    t.innerHTML = `<b>${g.name}</b><span>${g.skill} · ${g.seconds}s</span><em>${pb ? 'PB ' + pb : 'not played'}</em>`;
    t.onclick = () => startPractice(g);
    grid.appendChild(t);
  });
}

function startPractice(gameDef) {
  match.active = true;
  match.online = false;
  match.solo = false;
  match.practice = true;
  match.players = [{ uid: 'you', name: store.profile.name, alive: true }];
  match.meUid = 'you';
  match.round = 1;
  match.finished = false;
  showScreen('match');
  setTimeout(fitCanvas, 60);
  renderMatchHud();
  setTimer(1, gameDef.seconds);
  roundIntro(gameDef, 1, 1, () => {
    runGame(gameDef, null);
    match.onFinish = (score) => {
      const pb = store.profile.pb[gameDef.id] || 0;
      const isPb = score > pb;
      if (isPb) {
        store.profile.pb[gameDef.id] = score;
        store.profile.coins += 5;
        store.save();
        toast('PERSONAL BEST +5 COINS', 'gold');
        audio.coin();
      }
      setOverlay(`<div class="results-card">
          <h3>${gameDef.name}</h3>
          <div class="results-foot" style="margin:0 0 10px"><span>SCORE</span><span style="font-size:26px;color:var(--cyan)">${score}</span></div>
          <p class="muted" style="margin:0 0 4px">${Math.round(clamp(score / gameDef.best, 0, 1) * 100)}% of the target (${gameDef.best})</p>
          <p class="muted" style="margin:0 0 12px">personal best ${Math.max(pb, score)}${isPb ? ' · new record' : ''}</p>
          <div style="display:flex;gap:8px;justify-content:flex-end">
            <button class="btn btn-primary" id="btn-retry">RETRY</button>
            <button class="btn btn-ghost" id="btn-range">RANGE</button>
          </div>
        </div>`, true);
      $('#btn-retry').onclick = () => { audio.click(); startPractice(gameDef); };
      $('#btn-range').onclick = () => { audio.click(); clearMatch(); openPanel('practice'); };
      renderHud();
    };
  });
}

function renderCustom(body) {
  body.innerHTML = `
    <div class="two-col">
      <div>
        <div class="section-title">CREATE A ROOM</div>
        <p class="muted" style="margin:0 0 10px">A private cabinet for you and your friends. Share the four-letter code; nobody else can walk in.</p>
        <label class="field"><span>MODE</span>
          <select id="c-mode" class="field-input">
            <option value="casual">CASUAL — friendly</option>
            <option value="ranked">RANKED — rating on the line</option>
          </select>
        </label>
        <label class="field"><span>MAX PLAYERS</span>
          <select id="c-max">
            <option>20</option><option>12</option><option>8</option><option>4</option><option>2</option>
          </select>
        </label>
        <button class="btn btn-primary" id="btn-create">CREATE ROOM</button>
      </div>
      <div>
        <div class="section-title">JOIN WITH A CODE</div>
        <p class="muted" style="margin:0 0 10px">Type the code your host gave you.</p>
        <div class="code-row">
          <input id="c-code" maxlength="4" placeholder="ABCD" autocomplete="off" spellcheck="false" />
          <button class="btn btn-primary" id="btn-join">JOIN</button>
        </div>
        <p class="muted tiny" id="c-msg" style="margin-top:10px"></p>
        <div class="panel-note" style="margin-top:16px">Custom rooms still pay XP and coins, but only ranked rooms move your rating.</div>
      </div>
    </div>`;
  body.querySelectorAll('select').forEach((s) => s.classList.add('field-input'));
  $('#btn-create').onclick = async () => {
    audio.click();
    if (net.mode !== 'online') { $('#c-msg').textContent = 'Sign in to host a room.'; return; }
    $('#btn-create').disabled = true;
    try {
      const code = await net.createRoom({ mode: $('#c-mode').value, open: false, maxPlayers: +$('#c-max').value });
      state.mode = $('#c-mode').value;
      await enterLobby(code);
      toast('ROOM ' + code + ' OPEN', 'good');
    } catch (e) { audio.bad(); $('#c-msg').textContent = netErr(e); console.warn('[app] create room failed', e && e.code); }
    finally { $('#btn-create').disabled = false; }
  };
  $('#btn-join').onclick = async () => {
    audio.click();
    const code = ($('#c-code').value || '').trim().toUpperCase();
    if (!/^[A-Z0-9]{4}$/.test(code)) { $('#c-msg').textContent = 'Codes are four letters or numbers.'; return; }
    if (net.mode !== 'online') { $('#c-msg').textContent = 'Sign in to join a room.'; return; }
    const room = await new Promise((res) => {
      let un = () => {};
      un = net.watchRoom(code, (r, err) => { un(); res(err ? { err } : r); });
      setTimeout(() => { un(); res(null); }, 4000);
    });
    if (room && room.err) { audio.bad(); $('#c-msg').textContent = netErr(room.err); return; }
    if (!room) { audio.bad(); $('#c-msg').textContent = 'No room with that code.'; return; }
    if (room.phase !== 'lobby') { $('#c-msg').textContent = 'That match already started.'; return; }
    state.mode = room.mode || 'casual';
    await enterLobby(code);
  };
  $('#c-code').addEventListener('input', (e) => { e.target.value = e.target.value.toUpperCase().slice(0, 4); });
}

function renderShop(body, addTabs) {
  const types = [['', 'ALL'], ['plate', 'NAMEPLATES'], ['trail', 'TRAILS'], ['elim', 'ELIM FX'], ['badge', 'BADGES'], ['frame', 'FRAMES'], ['burst', 'VICTORY']];
  addTabs(types.map(([id, label]) => ({ id: id || 'all', label })), state.panelTab || 'all', (id) => { state.panelTab = id === 'all' ? '' : id; renderPanel(); });
  const p = store.profile;
  body.innerHTML = `<div class="shop-head"><p class="muted" style="margin:0 0 12px">Coins earned by playing. Cosmetic only — nothing here changes a score.</p>
    <div class="chip chip-coins" style="display:inline-flex"><i class="ico-coin"></i><b>${fmt(p.coins)}</b></div></div>
    <div class="grid-cards" id="shop-grid"></div>`;
  const grid = $('#shop-grid');
  COSMETICS.filter((c) => !state.panelTab || c.type === state.panelTab).forEach((c) => {
    const owned = store.owns(c.id);
    const equipped = p.equipped[c.type] === c.id;
    const card = el('div', 'shop-card' + (owned ? ' owned' : '') + (equipped ? ' equipped' : ''));
    card.innerHTML = `
      <div class="shop-preview">${previewHtml(c)}</div>
      <div class="shop-name">${c.name}</div>
      <div class="shop-desc">${c.desc}</div>
      <div class="shop-row">
        <span class="shop-price">${owned ? '<span class="badge ' + (equipped ? 'equipped' : 'owned') + '">' + (equipped ? 'EQUIPPED' : 'OWNED') + '</span>' : '<i class="ico-coin"></i>' + c.price}</span>
        <button class="btn btn-tiny ${owned ? (equipped ? 'btn-ghost' : 'btn-primary') : ''}">${owned ? (equipped ? 'REMOVE' : 'EQUIP') : 'BUY'}</button>
      </div>`;
    const btn = card.querySelector('button');
    btn.onclick = () => {
      audio.click();
      if (equipped) { store.unequip(c.type); toast('REMOVED ' + c.name.toUpperCase()); renderPanel(); renderHud(); return; }
      if (owned) { store.equip(c.id); toast('EQUIPPED ' + c.name.toUpperCase(), 'good'); renderPanel(); renderHud(); return; }
      if (p.coins < c.price) { toast('NOT ENOUGH COINS', 'bad'); audio.bad(); return; }
      if (store.buy(c.id)) {
        store.equip(c.id);
        audio.coin(); toast('BOUGHT ' + c.name.toUpperCase(), 'gold');
        burst(window.innerWidth / 2, window.innerHeight / 2, '#ffd35c', 26, 1.2);
        renderPanel(); renderHud();
        store.checkAchievements().forEach((a) => toast('ACHIEVEMENT · ' + a.name, 'gold', 3600));
      }
    };
    grid.appendChild(card);
  });
}

function previewHtml(c) {
  if (c.type === 'plate') return `<span style="font-family:var(--font-head);font-size:22px;color:${c.color};text-shadow:0 0 14px ${c.color}">${escapeHtml(store.profile.name)}</span>`;
  if (c.type === 'trail') return `<span style="display:flex;gap:5px">${Array.from({ length: 7 }).map((_, i) => `<i style="width:9px;height:9px;background:${c.color};opacity:${1 - i * 0.11};box-shadow:0 0 10px ${c.color}"></i>`).join('')}</span>`;
  if (c.type === 'elim') return `<span style="font-family:var(--font-head);font-size:26px;letter-spacing:.18em;color:${c.color};text-shadow:0 0 16px ${c.color}">${c.word || 'OUT'}</span>`;
  if (c.type === 'frame') return `<span class="avatar avatar-lg" style="border:3px solid ${c.color};border-radius:0"></span>`;
  if (c.type === 'burst') return `<span style="display:flex;gap:4px">${Array.from({ length: 12 }).map(() => `<i style="width:6px;height:6px;background:${c.color};box-shadow:0 0 8px ${c.color}"></i>`).join('')}</span>`;
  if (c.type === 'badge') {
    const cv = document.createElement('canvas');
    drawAvatar(cv, 'badge-' + c.glyph, '#3df3ff');
    return cv.outerHTML.replace('<canvas', '<canvas style="width:56px;height:56px;image-rendering:pixelated"');
  }
  return '';
}

function renderQuests(body) {
  const p = store.profile;
  const left = Math.max(0, SEASON.days - Math.floor((Date.now() - SEASON.start) / 86400000));
  body.innerHTML = `
    <div class="two-col">
      <div>
        <div class="section-title">DAILY QUESTS · ${todayKey()}</div>
        <div id="quests-list" style="display:grid;gap:8px"></div>
        <p class="muted tiny" style="margin-top:10px">Quests refresh at midnight UTC. Unclaimed rewards are lost on reset.</p>
      </div>
      <div>
        <div class="section-title">SEASON ${SEASON.num} · ${SEASON.name}</div>
        <div class="rail-card" style="margin-bottom:10px">
          <div class="sc-row"><span>season ends</span><b>${left} days</b></div>
          <div class="sc-track" style="margin-top:8px"><i style="width:${clamp((p.stats.wins % 10) / 10, .02, 1) * 100}%"></i></div>
          <div class="sc-row" style="margin-top:8px"><span>wins this season</span><b>${p.stats.wins % 10} / 10</b></div>
          <div class="sc-reward"><i class="ico-coin"></i><b>${250 + p.stats.wins * 20}</b><span>projected payout</span></div>
        </div>
        <div class="panel-note">Ten wins in the season banks the full payout. Practice rounds don't count — matches do.</div>
      </div>
    </div>`;
  const list = $('#quests-list');
  (p.daily.quests || []).forEach((q) => {
    const pct = clamp(q.progress / q.goal, 0, 1);
    const row = el('div', 'rail-card');
    row.innerHTML = `<div class="q-top" style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:6px">
        <span>${q.text}</span><b style="font-family:var(--font-mono);color:var(--cyan);font-size:10px">${q.progress}/${q.goal}</b></div>
      <div class="q-bar ${pct >= 1 ? 'done' : ''}" style="height:6px;background:#150f2a"><i style="display:block;height:100%;width:${pct * 100}%;background:${pct >= 1 ? 'var(--gold)' : 'var(--lime)'}"></i></div>
      <div class="shop-row" style="margin-top:9px">
        <span class="shop-price" style="color:var(--muted);font-size:10px">+${q.xp} XP · +${q.coins} COINS</span>
        <button class="btn btn-tiny ${q.claimed ? '' : pct >= 1 ? 'btn-primary' : ''}" ${q.claimed || pct < 1 ? 'disabled' : ''}>${q.claimed ? 'CLAIMED' : pct >= 1 ? 'CLAIM' : 'LOCKED'}</button>
      </div>`;
    const b = row.querySelector('button');
    b.onclick = () => {
      const r = store.claimQuest(q.id);
      if (r) {
        audio.coin();
        toast(`QUEST CLAIMED · +${r.coins} COINS`, 'gold');
        if (r.level) { levelBurst(r.level); audio.level(); }
        renderPanel(); renderHud();
      }
    };
    list.appendChild(row);
  });
}

function renderLeaderboard(body, addTabs) {
  addTabs([{ id: 'rating', label: 'RATING' }, { id: 'wins', label: 'WINS' }, { id: 'level', label: 'LEVEL' }], state.panelTab || 'rating', (id) => { state.panelTab = id; renderPanel(); });
  const field = state.panelTab || 'rating';
  body.innerHTML = `<p class="muted" style="margin:0 0 12px">${net.mode === 'online' ? 'Live from the arcade database.' : 'Sign in to see the global board — showing your local record.'}</p><div id="lb-body">loading…</div>`;
  const target = $('#lb-body');
  (async () => {
    let rows = net.mode === 'online' ? await net.fetchBoard(field, 40) : [];
    if (!rows.length) {
      const p = store.profile;
      rows = [{ uid: net.uid || 'me', name: p.name, level: p.level, rating: p.rating, wins: p.stats.wins, matches: p.stats.matches }];
    }
    target.innerHTML = `<table class="table"><thead><tr><th class="pos">#</th><th>PLAYER</th><th class="num">LEVEL</th><th class="num">RATING</th><th class="num">WINS</th></tr></thead><tbody></tbody></table>`;
    const tb = target.querySelector('tbody');
    rows.forEach((r, i) => {
      const tr = el('tr', r.uid === net.uid ? 'me' : '');
      tr.innerHTML = `<td class="pos">${i + 1}</td><td>${escapeHtml(r.name || 'player')}</td>
        <td class="num">${r.level || 1}</td><td class="num">${r.rating || 1000} · ${rankFor(r.rating || 1000).name}</td><td class="num">${r.wins || 0}</td>`;
      tb.appendChild(tr);
    });
  })();
}

function renderProfile(body) {
  const p = store.profile;
  const rank = rankFor(p.rating);
  const wr = p.stats.matches ? Math.round((p.stats.wins / p.stats.matches) * 100) : 0;
  const achs = ACHIEVEMENTS.map((a) => {
    const got = !!p.achievements[a.id];
    return `<div class="ach ${got ? 'got' : ''}"><div class="a-ico">${got ? '★' : '?'}</div>
      <div><b>${a.name}</b><span>${a.desc}</span></div></div>`;
  }).join('');
  body.innerHTML = `
    <div class="two-col">
      <div class="rail-card">
        <div class="pc-top">
          <span class="avatar avatar-lg" id="pf-av"></span>
          <div class="pc-id"><b>${escapeHtml(p.name)}</b><span class="pc-rank">${rank.name} · ${p.rating}</span></div>
          <span class="pc-lvl"><b>${p.level}</b>LVL</span>
        </div>
        <div class="pc-bar"><i style="width:${store.levelProgress().pct * 100}%"></i><em>${store.levelProgress().have} / ${store.levelProgress().need} XP</em></div>
        <div class="pc-plate" style="color:${(store.cosmetic(p.equipped.plate) || {}).color || 'var(--cyan)'}">${((store.cosmetic(p.equipped.plate) || {}).name || 'Standard Tag').toUpperCase()}</div>
      </div>
      <div class="stat-grid">
        <div class="stat"><b>${p.stats.wins}</b><span>wins</span></div>
        <div class="stat"><b>${p.stats.matches}</b><span>matches</span></div>
        <div class="stat"><b>${wr}%</b><span>win rate</span></div>
        <div class="stat"><b>${p.stats.bestPlace || '—'}</b><span>best finish</span></div>
        <div class="stat"><b>${p.stats.rounds}</b><span>rounds survived</span></div>
        <div class="stat"><b>${p.stats.bestStreak || 0}</b><span>win streak</span></div>
      </div>
    </div>
    <div class="section-title">ACHIEVEMENTS · ${Object.keys(p.achievements).length}/${ACHIEVEMENTS.length}</div>
    <div class="ach-grid">${achs}</div>
    <div class="section-title">EQUIPPED</div>
    <div class="grid-cards" id="pf-equipped"></div>`;
  const av = $('#pf-av');
  av.innerHTML = '';
  const cv = document.createElement('canvas');
  av.appendChild(cv);
  drawAvatar(cv, p.name, (store.cosmetic(p.equipped.plate) || {}).color || '#3df3ff');
  const eq = $('#pf-equipped');
  ['plate', 'trail', 'elim', 'frame', 'badge', 'burst'].forEach((t) => {
    const c = store.cosmetic(p.equipped[t] || '');
    const d = el('div', 'shop-card');
    d.innerHTML = `<div class="shop-preview">${c ? previewHtml(c) : '<span class="muted tiny">empty slot</span>'}</div>
      <div class="shop-name">${c ? c.name : 'None'}</div><div class="shop-desc">${t.toUpperCase()}</div>`;
    eq.appendChild(d);
  });
}

function renderSettings(body) {
  const s = store.profile.settings;
  body.innerHTML = `
    <div class="two-col">
      <div>
        <div class="section-title">AUDIO</div>
        <div class="setting-row"><div><b>Music</b><span>Procedural arcade loop</span></div>
          <input type="range" id="set-music" min="0" max="1" step="0.05" value="${s.music}" /><span class="setting-val" id="v-music">${Math.round(s.music * 100)}%</span></div>
        <div class="setting-row"><div><b>Sound effects</b><span>Hits, clicks, countdowns</span></div>
          <input type="range" id="set-sfx" min="0" max="1" step="0.05" value="${s.sfx}" /><span class="setting-val" id="v-sfx">${Math.round(s.sfx * 100)}%</span></div>
        <div class="setting-row"><div><b>Mute everything</b><span>Silence the cabinet</span></div>
          <button class="switch ${s.muted ? 'on' : ''}" id="set-muted"></button></div>
        <div class="section-title">VIDEO &amp; FEEL</div>
        <div class="setting-row"><div><b>Screen shake</b><span>Impact on eliminations and crashes</span></div>
          <button class="switch ${s.shake ? 'on' : ''}" id="set-shake"></button></div>
        <div class="setting-row"><div><b>CRT scanlines</b><span>Cabinet glass effect</span></div>
          <button class="switch ${s.crt ? 'on' : ''}" id="set-crt"></button></div>
        <div class="setting-row"><div><b>Reduced motion</b><span>No particles or drifting background</span></div>
          <button class="switch ${s.reduced ? 'on' : ''}" id="set-reduced"></button></div>
        <div class="setting-row"><div><b>Control hints</b><span>Show controls under each game</span></div>
          <button class="switch ${s.hints ? 'on' : ''}" id="set-hints"></button></div>
      </div>
      <div>
        <div class="section-title">CABINET</div>
        <div class="setting-row"><div><b>Fullscreen</b><span>Fill the screen</span></div>
          <button class="btn btn-ghost btn-tiny" id="set-full">TOGGLE</button></div>
        <div class="setting-row"><div><b>Account</b><span>${net.mode === 'online' ? 'Signed in as ' + escapeHtml(store.profile.name) : 'Playing as guest'}</span></div>
          <button class="btn btn-ghost btn-tiny" id="set-account">${net.mode === 'online' ? 'SIGN OUT' : 'SIGN IN'}</button></div>
        <div class="panel-note" style="margin-top:14px">Progress saves to this device instantly and to your account when you are signed in. Practice, quests and shop items survive a refresh.</div>
        <div class="section-title">RESET</div>
        <div class="setting-row"><div><b>Wipe local progress</b><span>Keeps your online account intact</span></div>
          <button class="btn btn-danger btn-tiny" id="set-wipe">WIPE</button></div>
      </div>
    </div>`;
  const bindRange = (id, key, label) => {
    const input = $('#' + id);
    input.oninput = () => {
      store.setSetting(key, +input.value);
      $('#' + label).textContent = Math.round(+input.value * 100) + '%';
      audio.setVolumes(store.profile.settings.music, store.profile.settings.sfx, store.profile.settings.muted);
    };
  };
  bindRange('set-music', 'music', 'v-music');
  bindRange('set-sfx', 'sfx', 'v-sfx');
  const bindSwitch = (id, key, after) => {
    const b = $('#' + id);
    b.onclick = () => {
      const val = !store.profile.settings[key];
      store.setSetting(key, val);
      b.classList.toggle('on', val);
      audio.click();
      if (after) after(val);
    };
  };
  bindSwitch('set-muted', 'muted', () => audio.setVolumes(store.profile.settings.music, store.profile.settings.sfx, store.profile.settings.muted));
  bindSwitch('set-shake', 'shake', (v) => setShake(v));
  bindSwitch('set-crt', 'crt');
  bindSwitch('set-reduced', 'reduced');
  bindSwitch('set-hints', 'hints', (v) => { $('#mf-keys').style.display = v ? '' : 'none'; });
  $('#set-full').onclick = () => {
    audio.click();
    if (!document.fullscreenElement) document.documentElement.requestFullscreen && document.documentElement.requestFullscreen().catch(() => {});
    else document.exitFullscreen && document.exitFullscreen().catch(() => {});
  };
  $('#set-account').onclick = () => {
    audio.click();
    if (net.mode === 'online') {
      net.signOut().then(() => { leaveLobby(true); showScreen('auth'); });
    } else {
      showScreen('auth');
    }
  };
  $('#set-wipe').onclick = () => modal('WIPE LOCAL PROGRESS', 'This clears the save on this device. Your online account keeps its own copy until you sync again.', [
    { label: 'CANCEL' },
    { label: 'WIPE', primary: true, fn: () => { localStorage.removeItem('last-stand-v1'); location.reload(); } }
  ]);
}

/* =====================================================================
   BOOT
   ===================================================================== */
function bindGlobal() {
  document.addEventListener('pointerdown', () => audio.resume(), { once: true });
  $('#btn-signin').onclick = () => doAuth('signin');
  $('#btn-register').onclick = () => doAuth('register');
  $('#btn-guest').onclick = () => { audio.click(); startGuest(); };
  $('#auth-pass').addEventListener('keydown', (e) => { if (e.key === 'Enter') doAuth('signin'); });
  $('#btn-home').onclick = () => { audio.click(); if (state.code) leaveLobby(true); clearMatch(); showScreen('menu'); };
  $('#btn-profile').onclick = () => { audio.click(); openPanel('profile'); };
  $('#btn-play').onclick = () => quickMatch();
  $('#mode-switch').addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    state.mode = b.dataset.mode;
    audio.click();
    renderMenu();
  });
  document.addEventListener('click', (e) => {
    const go = e.target.closest('[data-go]');
    if (go) { audio.click(); openPanel(go.dataset.go); }
  });
  $('#btn-back').onclick = () => { audio.click(); if (state.code) leaveLobby(true); clearMatch(); showScreen('menu'); };
  $('#btn-ready').onclick = () => {
    audio.click();
    state.ready = !state.ready;
    net.setReady(state.code, state.ready).catch(() => {});
    renderLobby();
  };
  $('#btn-leave').onclick = () => { audio.click(); leaveLobby(); };
  $('#btn-copy').onclick = async () => {
    audio.click();
    try { await navigator.clipboard.writeText(state.code); toast('CODE COPIED'); }
    catch (e) { toast('CODE: ' + state.code); }
  };
  $('#btn-forfeit').onclick = () => {
    audio.click();
    modal('LEAVE THE MATCH?', 'Forfeiting counts as an elimination. Rating still moves.', [
      { label: 'STAY' },
      { label: 'FORFEIT', primary: true, fn: () => { leaveLobby(); } }
    ]);
  };
  window.addEventListener('beforeunload', () => {
    if (state.code) { net.leaveRoom(state.code).catch(() => {}); }
    if (state.isHost && state.code) { net.deleteRoom(state.code).catch(() => {}); }
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) return;
    if (state.code) net.roomPresence(state.code, { level: store.profile.level, rating: store.profile.rating, ready: state.ready });
  });
}

function paintModeChips() {
  $$('#mode-switch button').forEach((b) => b.classList.toggle('on', b.dataset.mode === state.mode));
}

async function boot() {
  showBoot(true, 'booting cabinet…');
  bootProgress(0.12);
  store.load();
  startWall();
  audio.setVolumes(store.profile.settings.music, store.profile.settings.sfx, store.profile.settings.muted);
  setShake(store.profile.settings.shake);
  store.onSettings = (s) => {
    audio.setVolumes(s.music, s.sfx, s.muted);
    setShake(s.shake);
    if ($('#mf-keys')) $('#mf-keys').style.display = s.hints ? '' : 'none';
  };
  store.pushRemote = (p) => net.pushProfile(p);
  bindGlobal();
  paintModeChips();
  renderHud();
  bootProgress(0.35, 'wiring the neon…');
  const ok = await net.init();
  bootProgress(0.55, ok ? 'contacting the arcade…' : 'offline cabinet…');
  if (ok) {
    net.watchAuth(async (user) => {
      if (!user) { showScreen('auth'); return; }
      const name = (user.displayName || '').trim() || (user.email || '').split('@')[0] || 'player';
      await afterSignIn(user, name);
    });
  }
  bootProgress(0.8, 'loading microgames…');
  // fonts for canvas text
  try { await document.fonts.load('800 40px "Big Shoulders"'); } catch (e) { /* fallback */ }
  bootProgress(1, 'ready');
  setTimeout(() => {
    showBoot(false);
    $('#cabinet').classList.remove('is-booting');
    if (!ok) {
      showScreen('auth');
      setAuthMsg('Online services are unreachable right now — guest mode still plays the full solo gauntlet and practice range.', true);
    }
  }, 420);
  if (!ok) renderHud();
  setInterval(() => {
    if (net.mode === 'online' && state.code) net.roomPresence(state.code, { level: store.profile.level, rating: store.profile.rating, ready: state.ready });
  }, 5000);
}

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') { closeModal(); }
});
window.addEventListener('resize', () => { if (match.active) fitCanvas(); });
boot();
