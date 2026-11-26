/* =====================================================================
   TEXAS HOLD'EM — the front of house
   Menu, HUD, betting controls and the pacing between the rules engine
   and the room.
   ===================================================================== */

import { PokerGame, AI_PROFILES } from './engine.js';
import { bootPokerScene } from './scene.js';
import { aiDecide, thinkTime } from './ai.js';
import {
  HAND_RANKINGS, evaluateCards, describeHole, cardLabel, rankLabel, suitGlyph, suitColour
} from './cards.js';

const $ = (id) => document.getElementById(id);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const fmt = (value) => Math.max(0, Math.round(Number(value) || 0)).toLocaleString('en-US');
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const els = {
  menu: $('menu'), setup: $('setup'), hud: $('hud'), loading: $('loading'), fade: $('fade'),
  gl: $('gl'), play: $('btn-play'), deal: $('btn-deal'), setupBack: $('setup-back'),
  seatDesc: $('seat-desc'), year: $('year'), rankList: $('rank-list'),
  pot: $('pot-amount'), handNo: $('hand-no'), handBlinds: $('hand-blinds'), streetTrack: $('street-track'),
  seatLabels: $('seat-labels'), tableMsg: $('table-msg'),
  playerStack: $('player-stack'), playerState: $('player-state'), playerCards: $('player-cards'),
  playerHand: $('player-hand-name'), sidePhase: $('side-phase'),
  actionBar: $('action-bar'), turnLabel: $('turn-label'), handName: $('hand-name'),
  fold: $('btn-fold'), call: $('btn-call'), raise: $('btn-raise'),
  raisePanel: $('raise-panel'), raiseRange: $('raise-range'), raiseValue: $('raise-value'), allIn: $('btn-all-in'),
  logPanel: $('log-panel'), logList: $('log-list'), logDot: $('log-dot'),
  result: $('result'), resultTitle: $('result-title'), resultSub: $('result-sub'),
  resultCards: $('result-cards'), resultAmount: $('result-amount'), resultCountdown: $('result-countdown'),
  next: $('btn-next'), gameover: $('gameover'), gameoverTitle: $('gameover-title'), gameoverSub: $('gameover-sub'),
  again: $('btn-again'), menuButton: $('btn-menu'), pause: $('btn-pause'),
  cinema: $('btn-cinema'), logButton: $('btn-log'), settingsButton: $('btn-settings'),
  settings: $('modal-settings'), how: $('modal-how'), credits: $('modal-credits'), pauseModal: $('modal-pause'),
  error: $('error-banner')
};

const settingsKey = 'damp-holdem-settings-v1';
const defaultSettings = { sensitivity: 1, sway: true, cinema: false, quality: 'high' };
let settings = loadSettings();

const state = {
  view: null,
  game: null,
  playerCount: 6,
  selectedSeats: 6,
  inGame: false,
  hudVisible: false,
  paused: false,
  modal: null,
  session: 0,
  turnTimer: 0,
  aiTimer: 0,
  nextTimer: 0,
  countdownTimer: 0,
  resultTimer: 0,
  gameOverTimer: 0,
  msgTimer: 0,
  lastResult: null,
  lastReveals: [],
  street: 'preflop',
  logOpen: false,
  gameOverPending: null,
  gameOverShown: false,
  lookArmedAt: 0,
  lastTime: performance.now()
};

const seatUI = [];
const performanceWatch = { frames: 0, since: 0, locked: false };
let qualityWarmupUntil = 0;
const seatDescriptions = {
  2: 'Heads-up. One opponent, no room to hide.',
  3: 'Three-handed. Every hand becomes a position battle.',
  4: 'Four seats. The table starts to breathe.',
  5: 'Five-handed. A short table with long memories.',
  6: 'Six-handed. The full cast takes their seats.'
};

/* ---------------- settings ------------------------------------------ */

function loadSettings() {
  try {
    const stored = JSON.parse(localStorage.getItem(settingsKey) || '{}');
    return {
      sensitivity: Math.max(0.3, Math.min(2, Number(stored.sensitivity) || defaultSettings.sensitivity)),
      sway: stored.sway === undefined ? defaultSettings.sway : Boolean(stored.sway),
      cinema: stored.cinema === undefined ? defaultSettings.cinema : Boolean(stored.cinema),
      quality: ['high', 'medium', 'low'].includes(stored.quality) ? stored.quality : defaultSettings.quality
    };
  } catch (error) {
    return { ...defaultSettings };
  }
}

function saveSettings() {
  try { localStorage.setItem(settingsKey, JSON.stringify(settings)); } catch (error) { /* storage off */ }
}

function syncSettingsControls() {
  $('set-sensitivity').value = String(settings.sensitivity);
  $('set-sensitivity-value').textContent = Number(settings.sensitivity).toFixed(2);
  $('set-sway').checked = settings.sway;
  $('set-cinema').checked = settings.cinema;
  $('set-quality').value = settings.quality;
  els.cinema.setAttribute('aria-pressed', String(settings.cinema));
  els.cinema.classList.toggle('is-on', settings.cinema);
}

function applySettings() {
  syncSettingsControls();
  if (!state.view) return;
  state.view.setLookSensitivity(settings.sensitivity);
  state.view.setIdleMotion(settings.sway);
  state.view.setCinematic(settings.cinema);
  state.view.setQuality(settings.quality);
}

/* ---------------- text ---------------------------------------------- */

const playerName = (index) => {
  if (!state.game) return '';
  const seat = state.game.seats[index];
  return seat ? (seat.isHuman ? 'You' : seat.name) : '';
};

const seatName = (index) => {
  if (!state.game) return '';
  const seat = state.game.seats[index];
  return seat ? seat.name : '';
};

const cardsText = (cards) => (cards || []).map((card) => cardLabel(card)).join(' ');

function actionWords(ev) {
  const name = playerName(ev.seat);
  if (ev.action === 'fold') return `${name} folds`;
  if (ev.action === 'check') return `${name} checks`;
  if (ev.action === 'call') return `${name} calls ${fmt(ev.amount)}${ev.allIn ? ' — all-in' : ''}`;
  if (ev.action === 'raise') return `${name} raises to ${fmt(ev.raiseTo)}${ev.allIn ? ' — all-in' : ''}`;
  if (ev.action === 'all-in') return `${name} moves all-in for ${fmt(ev.raiseTo || ev.amount)}`;
  return `${name} acts`;
}

function actionBubble(seat, phase) {
  if (!seat || !seat.inHand) return '';
  if (phase === 'handover' || phase === 'showdown') {
    if (seat.folded) return 'Folded';
    if (seat.allIn) return 'All-in';
    return '';
  }
  if (seat.allIn && seat.stack === 0) return 'All-in';
  if (seat.lastAction) {
    switch (seat.lastAction.type) {
      case 'fold': return 'Fold';
      case 'check': return 'Check';
      case 'call': return `Call ${fmt(seat.lastAction.amount)}`;
      case 'raise': return seat.allIn ? 'All-in' : `Raise ${fmt(seat.roundBet)}`;
      case 'all-in': return 'All-in';
      default: return '';
    }
  }
  return '';
}

/* ---------------- log ------------------------------------------------ */

function addLogText(text, options = {}) {
  if (options.hand) {
    const item = document.createElement('li');
    item.className = 'log-hand';
    item.textContent = text;
    els.logList.append(item);
  } else {
    const item = document.createElement('li');
    item.className = `log-entry${options.player ? ' is-player' : ''}`;
    item.textContent = text;
    els.logList.append(item);
  }
  while (els.logList.children.length > 110) els.logList.firstElementChild.remove();
  els.logList.scrollTop = els.logList.scrollHeight;
  if (!state.logOpen) els.logDot.hidden = false;
}

function clearLog() {
  els.logList.replaceChildren();
  els.logDot.hidden = true;
}

/* ---------------- seat labels --------------------------------------- */

function buildSeatLabels() {
  els.seatLabels.replaceChildren();
  seatUI.length = 0;
  for (let index = 1; index < 6; index++) {
    const el = document.createElement('div');
    el.className = 'seat-label is-hidden';
    el.innerHTML = `
      <div class="seat-plate">
        <span class="seat-tags"></span>
        <span class="seat-name"></span>
        <span class="seat-stack">0</span>
        <span class="seat-hand"></span>
      </div>
      <span class="seat-action"></span>`;
    els.seatLabels.append(el);
    seatUI[index] = {
      el,
      tags: el.querySelector('.seat-tags'),
      name: el.querySelector('.seat-name'),
      stack: el.querySelector('.seat-stack'),
      hand: el.querySelector('.seat-hand'),
      action: el.querySelector('.seat-action'),
      signature: ''
    };
  }
}

function updateSeatLabels() {
  if (!state.game || !state.hudVisible) {
    for (const ui of seatUI) if (ui) ui.el.classList.add('is-hidden');
    return;
  }
  const game = state.game;
  const winners = new Set((state.lastResult?.winners || []).map((winner) => winner.seat));
  const reveals = new Map((state.lastReveals || []).map((reveal) => [reveal.seat, reveal]));
  for (let index = 1; index < 6; index++) {
    const ui = seatUI[index];
    const seat = game.seats[index];
    if (!ui) continue;
    if (!seat || index >= game.seatCount) {
      ui.el.classList.add('is-hidden');
      continue;
    }
    const reveal = reveals.get(index);
    const action = actionBubble(seat, game.phase);
    const hand = reveal && !seat.folded ? reveal.name : '';
    const signature = [
      seat.name, seat.stack, game.actor === index, seat.folded, seat.stack <= 0,
      winners.has(index), game.dealer === index, game.sbSeat === index, game.bbSeat === index,
      action, hand
    ].join('|');
    if (signature !== ui.signature) {
      ui.signature = signature;
      ui.el.classList.remove('is-hidden');
      ui.name.textContent = seat.name;
      ui.stack.textContent = seat.stack <= 0 ? 'Out' : fmt(seat.stack);
      ui.hand.textContent = hand;
      ui.action.textContent = action;
      ui.action.classList.toggle('is-on', Boolean(action));
      ui.el.classList.toggle('is-active', game.actor === index && game.isBetting);
      ui.el.classList.toggle('is-folded', Boolean(seat.folded && seat.inHand));
      ui.el.classList.toggle('is-out', seat.stack <= 0);
      ui.el.classList.toggle('is-winner', winners.has(index));
      ui.el.classList.toggle('is-folded', seat.folded && seat.inHand);
      const badges = [];
      if (game.dealer === index) badges.push(['D', 'dealer']);
      if (game.sbSeat === index) badges.push(['SB', 'blind']);
      if (game.bbSeat === index) badges.push(['BB', 'blind']);
      if (seat.stack <= 0 && seat.inHand) badges.push(['Out', 'blind']);
      ui.tags.replaceChildren(...badges.map(([text, className]) => {
        const badge = document.createElement('span');
        badge.className = `seat-badge ${className}`;
        badge.textContent = text;
        return badge;
      }));
    }
  }
}

function placeSeatLabels() {
  if (!state.view || !state.hudVisible) return;
  for (let index = 1; index < 6; index++) {
    const ui = seatUI[index];
    if (!ui || ui.el.classList.contains('is-hidden')) continue;
    const point = state.view.projectSeat(index);
    if (!point.visible) {
      ui.el.style.visibility = 'hidden';
      continue;
    }
    ui.el.style.visibility = 'visible';
    ui.el.style.transform = `translate3d(${point.x}px, ${point.y}px, 0) translate(-50%, -100%)`;
  }
}

/* ---------------- HUD helpers --------------------------------------- */

function updateStreet(street) {
  state.street = street;
  const order = ['preflop', 'flop', 'turn', 'river', 'showdown'];
  const current = Math.max(0, order.indexOf(street));
  $$('#street-track span').forEach((el, index) => {
    el.classList.toggle('is-active', index === current);
    el.classList.toggle('is-done', index < current);
  });
  const labels = { preflop: 'Pre-flop', flop: 'Flop', turn: 'Turn', river: 'River', showdown: 'Showdown' };
  els.sidePhase.textContent = labels[street] || 'Waiting';
  els.sidePhase.classList.toggle('is-hot', street === 'showdown');
}

function updatePlayerCards() {
  if (!state.game) return;
  const seat = state.game.human;
  els.playerCards.replaceChildren();
  if (!seat) return;
  for (const card of seat.hole) {
    const chip = document.createElement('span');
    chip.className = `card-chip${suitColour(card.suit) === 'red' ? ' red' : ''}`;
    chip.textContent = cardLabel(card);
    els.playerCards.append(chip);
  }
  let name = '';
  if (seat.folded) name = 'Folded';
  else if (seat.hole.length === 2) {
    if (state.game.board.length >= 3) {
      const best = evaluateCards([...seat.hole, ...state.game.board]);
      name = best ? best.name : describeHole(seat.hole);
    } else {
      name = describeHole(seat.hole);
    }
  }
  els.playerHand.textContent = name;
  if (state.game.actor === 0 && state.game.isBetting) els.handName.textContent = name || 'Your turn';
  let status = '';
  if (seat.stack <= 0) status = 'All-in';
  else if (seat.allIn) status = 'All-in';
  else if (seat.folded) status = 'Folded';
  els.playerState.textContent = status;
  els.playerStack.textContent = fmt(seat.stack);
}

function updateHud() {
  if (!state.game) return;
  const game = state.game;
  els.handNo.textContent = `Hand ${Math.max(1, game.handNo)}`;
  els.handBlinds.textContent = `Blinds ${fmt(game.sb)} / ${fmt(game.bb)}`;
  els.pot.textContent = fmt(game.totalPot());
  els.playerStack.textContent = fmt(game.human.stack);
  updatePlayerCards();
  updateSeatLabels();
}

function syncTable() {
  if (!state.game || !state.view) return;
  const game = state.game;
  state.view.updateStacks(game.seats.map((seat) => seat.stack));
  state.view.syncBets(game.seats.map((seat) => seat.roundBet));
  state.view.setPot(game.pot);
  updateHud();
}

/* ---------------- table message ------------------------------------- */

function showTableMessage(text, duration = 1500) {
  clearTimeout(state.msgTimer);
  els.tableMsg.textContent = text;
  els.tableMsg.classList.add('is-on');
  state.msgTimer = window.setTimeout(() => els.tableMsg.classList.remove('is-on'), duration);
}

function showError(text) {
  els.error.textContent = text;
  els.error.hidden = false;
  window.clearTimeout(showError.timer);
  showError.timer = window.setTimeout(() => { els.error.hidden = true; }, 2800);
}

/* ---------------- action bar ---------------------------------------- */

function roundChips(value) {
  const step = value > 2000 ? 100 : 25;
  return Math.max(0, Math.round(value / step) * step);
}

function clampRaise(value, legal) {
  return Math.max(legal.minRaiseTo, Math.min(legal.maxRaiseTo, Math.round(Number(value) || legal.minRaiseTo)));
}

function updateRaiseValue(value) {
  const legal = state.game?.legalActions(0);
  if (!legal) return;
  const target = clampRaise(value, legal);
  els.raiseRange.value = String(target);
  els.raiseValue.textContent = fmt(target);
  const isAllIn = target >= legal.maxRaiseTo;
  els.raise.textContent = isAllIn ? 'All-in' : `Raise to ${fmt(target)}`;
  const kbd = document.createElement('kbd');
  kbd.textContent = 'R';
  els.raise.append(kbd);
}

function showPlayerActions() {
  if (!state.game || state.paused || !state.hudVisible) return;
  const legal = state.game.legalActions(0);
  if (!legal) { hideActions(); return; }
  hideActions();
  const game = state.game;
  const seat = game.human;
  els.turnLabel.textContent = legal.toCall === 0 ? 'Your turn — no bet to you' : `Your turn — ${fmt(legal.toCall)} to call`;
  els.handName.textContent = els.playerHand.textContent || 'Your hand';
  els.fold.disabled = false;
  els.call.disabled = false;
  els.call.replaceChildren(document.createTextNode(
    legal.canCheck ? 'Check' : (legal.callAmount >= seat.stack ? `All-in ${fmt(legal.callAmount)}` : `Call ${fmt(legal.callAmount)}`)
  ));
  const callKbd = document.createElement('kbd'); callKbd.textContent = 'C'; els.call.append(callKbd);
  els.raisePanel.hidden = !legal.canRaise;
  els.raise.hidden = !legal.canRaise;
  els.raise.disabled = !legal.canRaise;
  if (legal.canRaise) {
    const base = Math.max(legal.minRaiseTo, roundChips(game.currentBet + Math.max(game.bb, game.totalPot() * 0.55)));
    const initial = clampRaise(base, legal);
    els.raiseRange.min = String(legal.minRaiseTo);
    els.raiseRange.max = String(legal.maxRaiseTo);
    els.raiseRange.step = '25';
    els.raiseRange.value = String(initial);
    updateRaiseValue(initial);
  } else {
    els.raise.textContent = 'Raise';
  }
  els.actionBar.hidden = false;
}

function hideActions() {
  els.actionBar.hidden = true;
}

function submitPlayerAction(type, raiseTo) {
  if (!state.game || state.paused) return;
  const legal = state.game.legalActions(0);
  if (!legal) return;
  hideActions();
  const result = state.game.act(0, type, raiseTo);
  if (!result.ok) {
    showError(result.error || 'That action is not available.');
    showPlayerActions();
    return;
  }
  processEvents(result.events);
  syncTable();
  if (state.game.isBetting && state.game.actor !== null) beginTurn(600);
  else updateSeatLabels();
}

/* ---------------- timers and turns ---------------------------------- */

function clearTurnTimers() {
  window.clearTimeout(state.turnTimer);
  window.clearTimeout(state.aiTimer);
  state.turnTimer = 0;
  state.aiTimer = 0;
}

function clearAllTimers() {
  clearTurnTimers();
  window.clearTimeout(state.nextTimer);
  window.clearTimeout(state.countdownTimer);
  window.clearTimeout(state.resultTimer);
  window.clearTimeout(state.gameOverTimer);
  state.nextTimer = 0;
  state.countdownTimer = 0;
  state.resultTimer = 0;
  state.gameOverTimer = 0;
}

function canRun() {
  return Boolean(state.view && state.game && state.inGame && state.hudVisible && !state.paused);
}

function beginTurn(delay = 0) {
  clearTurnTimers();
  if (!canRun()) return;
  const token = state.session;
  state.turnTimer = window.setTimeout(() => {
    if (token !== state.session || !canRun() || !state.game) return;
    const game = state.game;
    if (!game.isBetting || game.actor === null) return;
    state.view.setActor(game.actor);
    updateSeatLabels();
    if (game.actor === 0) {
      showPlayerActions();
      return;
    }
    state.aiTimer = window.setTimeout(() => runAI(token), thinkTime());
  }, delay);
}

function runAI(token) {
  if (token !== state.session || !canRun() || !state.game || !state.game.isBetting) return;
  const game = state.game;
  const actor = game.actor;
  if (actor === null) return;
  let decision = aiDecide(game);
  if (!decision) return;
  let result = game.act(actor, decision.type, decision.raiseTo);
  if (!result.ok) {
    const legal = game.legalActions(actor);
    if (legal) result = game.act(actor, legal.canCheck ? 'check' : 'call');
  }
  if (!result || !result.ok) {
    console.error('AI action failed', result && result.error);
    return;
  }
  processEvents(result.events);
  syncTable();
  if (state.game.isBetting && state.game.actor !== null) beginTurn(500);
}

function startHand() {
  if (!state.game || !state.inGame) return;
  clearAllTimers();
  hideActions();
  hideResult();
  els.gameover.hidden = true;
  state.gameOverPending = null;
  state.gameOverShown = false;
  state.lastReveals = [];
  state.lastResult = null;
  state.view.clearHighlights();
  state.view.clearActor();
  const events = state.game.startHand();
  processEvents(events);
  syncTable();
  if (state.game.phase === 'over') return;
  updateStreet('preflop');
  if (state.game.isBetting && state.game.actor !== null) beginTurn(1950);
}

function startNextHand() {
  clearAllTimers();
  if (!state.game || !state.inGame) return;
  if (state.gameOverPending) { showGameOver(state.gameOverPending); return; }
  hideResult();
  startHand();
}

function scheduleAutoNext(seconds = 7) {
  window.clearTimeout(state.nextTimer);
  window.clearInterval(state.countdownTimer);
  if (!state.inGame || state.paused || state.gameOverPending) return;
  const deadline = performance.now() + seconds * 1000;
  const tick = () => {
    const remaining = Math.max(0, deadline - performance.now());
    els.resultCountdown.textContent = remaining > 0 ? `Next hand in ${Math.ceil(remaining / 1000)}s` : 'Dealing…';
    if (remaining <= 0) window.clearInterval(state.countdownTimer);
  };
  tick();
  state.countdownTimer = window.setInterval(tick, 250);
  state.nextTimer = window.setTimeout(() => {
    if (!state.inGame) return;
    if (state.paused) { els.resultCountdown.textContent = 'Table paused'; return; }
    startNextHand();
  }, seconds * 1000);
}

/* ---------------- event presentation -------------------------------- */

function processEvents(events) {
  if (!state.game || !state.view) return;
  const game = state.game;
  for (const event of events) {
    switch (event.type) {
      case 'hand-start': {
        hideActions();
        state.lastReveals = [];
        state.lastResult = null;
        hideResult();
        els.gameover.hidden = true;
        state.view.resetHandVisuals();
        state.view.setDealerButton(event.dealer, false);
        state.view.setBlinds(event.sbSeat, event.bbSeat);
        state.view.updateStacks(event.stacks);
        updateStreet('preflop');
        addLogText(`Hand ${event.handNo} · Dealer ${seatName(event.dealer)}`, { hand: true });
        showTableMessage(`Hand ${event.handNo}`, 1200);
        updateSeatLabels();
        break;
      }
      case 'post': {
        addLogText(`${seatName(event.seat)} posts the ${event.blind === 'sb' ? 'small' : 'big'} blind — ${fmt(event.amount)}`, { player: event.seat === 0 });
        break;
      }
      case 'hole': {
        state.view.dealHole(event.seat, event.cards, event.faceUp);
        if (event.seat === 0) {
          addLogText(`Your cards: ${cardsText(event.cards)}`, { player: true });
          updatePlayerCards();
          updateSeatLabels();
        }
        break;
      }
      case 'action': {
        hideActions();
        state.view.clearActor();
        addLogText(actionWords(event), { player: event.seat === 0 });
        state.view.react(event.seat, event.action, event.amount);
        if (event.seat === 0) {
          if (event.action === 'raise' || event.action === 'bet' || event.action === 'all-in') showTableMessage(`Raised to ${fmt(event.raiseTo || event.amount)}`, 1300);
          else if (event.action === 'call') showTableMessage(`Called ${fmt(event.amount)}`, 1100);
          else if (event.action === 'check') showTableMessage('Check', 900);
          else if (event.action === 'fold') showTableMessage('Folded', 1100);
        }
        updatePlayerCards();
        updateSeatLabels();
        break;
      }
      case 'street': {
        hideActions();
        state.view.clearActor();
        state.view.collectBets();
        state.view.setPot(event.pot);
        state.view.dealBoard(event.board, event.newCards);
        updateStreet(event.phase);
        const label = { flop: 'Flop', turn: 'Turn', river: 'River' }[event.phase] || 'Next street';
        addLogText(`${label} · ${cardsText(event.newCards)}`);
        showTableMessage(`${label} · ${cardsText(event.newCards)}`, 1900);
        updatePlayerCards();
        updateSeatLabels();
        break;
      }
      case 'showdown': {
        state.lastReveals = event.reveals || [];
        state.view.revealShowdown(event.reveals || []);
        updateStreet('showdown');
        hideActions();
        showTableMessage('Showdown', 2100);
        addLogText(`Showdown · ${event.reveals.map((reveal) => `${seatName(reveal.seat)}: ${reveal.name}`).join(' · ')}`);
        updateSeatLabels();
        break;
      }
      case 'award': {
        const primary = [...event.winners].sort((a, b) => b.amount - a.amount)[0];
        if (primary) {
          state.view.sweepPotTo(primary.seat);
          state.view.showWinner(primary.seat);
        }
        updatePlayerCards();
        break;
      }
      case 'hand-end': {
        state.lastResult = event;
        hideActions();
        state.view.clearActor();
        state.view.setPot(0);
        state.view.updateStacks(game.seats.map((seat) => seat.stack));
        updateSeatLabels();
        updatePlayerCards();
        const winnerNames = event.winners.map((winner) => `${seatName(winner.seat)}${winner.split ? ' (split)' : ''}`).join(' & ');
        addLogText(`${winnerNames} ${event.uncontested ? 'takes the pot' : 'wins'} — ${fmt(event.totalPot)}${!event.uncontested && event.winners[0] ? ` · ${event.winners[0].handName}` : ''}`);
        const human = game.human;
        const funded = game.seats.filter((seat) => seat.stack > 0);
        if (human.stack <= 0) {
          state.gameOverPending = { reason: 'busted' };
        } else if (funded.length <= 1 && human.stack > 0) {
          state.gameOverPending = { reason: 'victory' };
        }
        const token = state.session;
        window.clearTimeout(state.resultTimer);
        state.resultTimer = window.setTimeout(() => {
          if (token !== state.session || !state.inGame) return;
          showResultPanel(event);
        }, event.uncontested ? 700 : 1350);
        if (state.gameOverPending) {
          window.clearTimeout(state.gameOverTimer);
          state.gameOverTimer = window.setTimeout(() => {
            if (token !== state.session || !state.inGame) return;
            showGameOver(state.gameOverPending);
          }, 4300);
        }
        break;
      }
      case 'over': {
        showGameOver({ reason: event.reason, winnerSeat: event.winnerSeat });
        break;
      }
      default: break;
    }
  }
}

function showResultPanel(result) {
  if (!state.inGame || !result) return;
  const winners = result.winners || [];
  if (!winners.length) return;
  const primary = [...winners].sort((a, b) => b.amount - a.amount)[0];
  const split = winners.length > 1;
  els.resultTitle.textContent = split ? 'Split pot' : (primary.seat === 0 ? 'You win' : `${seatName(primary.seat)} wins`);
  if (split) {
    els.resultSub.textContent = `${winners.map((winner) => seatName(winner.seat)).join(' & ')} divide the pot.`;
  } else if (result.uncontested) {
    els.resultSub.textContent = `${seatName(primary.seat)} takes it down — everyone else folded.`;
  } else {
    els.resultSub.textContent = primary.seat === 0
      ? `${primary.handName}. The pot is yours.`
      : `${primary.handName}. Better luck next hand.`;
  }
  const cards = primary.cards || primary.hole || [];
  els.resultCards.replaceChildren(...cards.slice(0, 5).map((card) => {
    const el = document.createElement('span');
    el.className = `result-card${suitColour(card.suit) === 'red' ? ' red' : ''}`;
    const rank = document.createElement('span');
    rank.textContent = rankLabel(card.rank);
    const suit = document.createElement('small');
    suit.textContent = suitGlyph(card.suit);
    el.append(rank, suit);
    return el;
  }));
  els.resultAmount.textContent = fmt(result.totalPot);
  els.result.hidden = false;
  state.view.clearActor();
  if (state.gameOverPending) {
    els.next.hidden = true;
    els.resultCountdown.textContent = 'The table is closing…';
  } else {
    els.next.hidden = false;
    scheduleAutoNext(7);
  }
  updateSeatLabels();
}

function hideResult() {
  els.result.hidden = true;
  window.clearTimeout(state.nextTimer);
  window.clearInterval(state.countdownTimer);
  els.resultCountdown.textContent = '';
}

function showGameOver(details) {
  if (!state.inGame || state.gameOverShown) return;
  state.gameOverShown = true;
  state.gameOverPending = null;
  clearTurnTimers();
  window.clearTimeout(state.nextTimer);
  window.clearInterval(state.countdownTimer);
  window.clearTimeout(state.resultTimer);
  hideActions();
  hideResult();
  state.view?.clearActor();
  const reason = details?.reason || 'busted';
  if (reason === 'victory') {
    els.gameoverTitle.textContent = 'The table is yours';
    els.gameoverSub.textContent = 'You cleaned out every seat in the room. The dealer racks the last chips.';
  } else if (reason === 'empty') {
    els.gameoverTitle.textContent = 'The room empties';
    els.gameoverSub.textContent = 'There is nobody left with chips at Table Nº 7.';
  } else {
    els.gameoverTitle.textContent = "You're out";
    els.gameoverSub.textContent = 'The last of your chips slides across the felt. There is always another seat.';
  }
  els.gameover.hidden = false;
  addLogText(reason === 'victory' ? 'You take the last chip at the table.' : 'Your seat at Table Nº 7 closes.', { player: true });
}

/* ---------------- session flow --------------------------------------- */

function closeAllModals() {
  for (const modal of $$('.modal')) modal.hidden = true;
  state.modal = null;
  state.paused = false;
}

function openModal(name) {
  const map = { settings: els.settings, how: els.how, credits: els.credits, pause: els.pauseModal };
  const modal = map[name];
  if (!modal) return;
  for (const other of $$('.modal')) other.hidden = true;
  modal.hidden = false;
  state.modal = name;
  if (state.inGame) {
    state.paused = true;
    clearTurnTimers();
    hideActions();
    state.view?.setLook(0, 0);
  }
  window.setTimeout(() => {
    const focusable = modal.querySelector('button, input, select');
    if (focusable) focusable.focus({ preventScroll: true });
  }, 60);
}

function closeModal() {
  if (!state.modal) return;
  const modal = { settings: els.settings, how: els.how, credits: els.credits, pause: els.pauseModal }[state.modal];
  if (modal) modal.hidden = true;
  state.modal = null;
  if (state.inGame) {
    state.paused = false;
    if (!els.result.hidden) scheduleAutoNext(6);
    else if (state.game?.isBetting && state.game.actor !== null) beginTurn(420);
  }
}

function fadeTo(on) {
  els.fade.classList.toggle('is-on', Boolean(on));
}

function hideMenu() {
  els.menu.classList.add('is-hidden');
  els.menu.setAttribute('aria-hidden', 'true');
}

function showMenu() {
  els.menu.classList.remove('is-hidden');
  els.menu.removeAttribute('aria-hidden');
}

function resetHud() {
  els.hud.hidden = true;
  state.hudVisible = false;
  document.body.classList.remove('in-game');
  els.actionBar.hidden = true;
  els.result.hidden = true;
  els.gameover.hidden = true;
  els.logPanel.classList.remove('is-open');
  els.logPanel.setAttribute('aria-hidden', 'true');
  state.logOpen = false;
  els.logDot.hidden = true;
  els.pot.textContent = '0';
  els.playerStack.textContent = '10,000';
  els.playerCards.replaceChildren();
  els.playerHand.textContent = '';
  els.playerState.textContent = '';
  els.handNo.textContent = 'Hand 1';
  els.handBlinds.textContent = 'Blinds 50 / 100';
  updateStreet('preflop');
  for (const ui of seatUI) {
    if (!ui) continue;
    ui.el.classList.add('is-hidden');
    ui.signature = '';
  }
}

function startSession(seatCount) {
  if (!state.view) {
    showError('The table could not be opened in this browser.');
    return;
  }
  clearAllTimers();
  closeAllModals();
  hideResult();
  els.gameover.hidden = true;
  state.playerCount = seatCount;
  state.selectedSeats = seatCount;
  state.session += 1;
  const token = state.session;
  state.inGame = true;
  state.hudVisible = false;
  state.paused = false;
  state.gameOverPending = null;
  state.gameOverShown = false;
  state.lastReveals = [];
  state.lastResult = null;
  clearLog();
  resetHud();
  els.setup.hidden = true;
  const profiles = AI_PROFILES.slice(0, seatCount - 1);
  const configs = [
    { name: 'You', isHuman: true, stack: 10000, look: 5 },
    ...profiles.map((profile, index) => ({
      name: profile.name, stack: 10000, persona: profile, look: index
    }))
  ];
  state.game = new PokerGame({ seats: configs, sb: 50, bb: 100 });
  state.view.setCinematic(settings.cinema);
  state.view.clearHighlights();
  state.view.clearActor();
  fadeTo(true);
  window.setTimeout(() => {
    if (token !== state.session) return;
    hideMenu();
    state.view.enterSeat(seatCount, () => {
      if (token !== state.session) return;
      state.hudVisible = true;
      state.lookArmedAt = performance.now() + 900;
      state.view.setLook(0, 0);
      els.hud.hidden = false;
      document.body.classList.add('in-game');
      updateStreet('preflop');
      updateHud();
      updateSeatLabels();
      state.view.updateStacks(state.game.seats.map((seat) => seat.stack));
      state.view.syncBets(state.game.seats.map((seat) => seat.roundBet));
      addLogText('A new table. Ten thousand each. The house deals.', { player: true });
      window.setTimeout(() => {
        if (token !== state.session) return;
        startHand();
      }, 500);
    });
    window.setTimeout(() => {
      if (token === state.session) fadeTo(false);
    }, 140);
  }, 360);
}

function leaveTable(goMenu = true) {
  const token = ++state.session;
  clearAllTimers();
  closeAllModals();
  state.inGame = false;
  state.hudVisible = false;
  hideActions();
  hideResult();
  els.gameover.hidden = true;
  els.hud.hidden = true;
  document.body.classList.remove('in-game');
  els.logPanel.classList.remove('is-open');
  state.logOpen = false;
  fadeTo(true);
  window.setTimeout(() => {
    if (token !== state.session) return;
    if (goMenu) {
      state.view?.returnToMenu(() => {
        if (token !== state.session) return;
        state.game = null;
        resetHud();
        showMenu();
        fadeTo(false);
        window.setTimeout(() => { if (els.setup.hidden === false) els.setup.hidden = true; }, 100);
      });
      window.setTimeout(() => { if (token === state.session) fadeTo(false); }, 260);
    } else {
      fadeTo(false);
    }
  }, 330);
}

/* ---------------- menu and setup ------------------------------------- */

function selectSeats(count) {
  state.selectedSeats = count;
  $$('#setup [data-seats]').forEach((button) => {
    button.setAttribute('aria-checked', String(Number(button.dataset.seats) === count));
  });
  els.seatDesc.textContent = seatDescriptions[count] || '';
}

function openSetup() {
  selectSeats(state.selectedSeats);
  els.setup.hidden = false;
  els.menu.classList.add('is-setup');
  const button = $(`#setup [data-seats="${state.selectedSeats}"]`);
  if (button) button.focus({ preventScroll: true });
}

function closeSetup() {
  els.setup.hidden = true;
  els.menu.classList.remove('is-setup');
  els.play.focus({ preventScroll: true });
}

function buildRankList() {
  els.rankList.replaceChildren(...HAND_RANKINGS.map((rank, index) => {
    const row = document.createElement('div');
    row.className = 'rank-row';
    const number = document.createElement('span');
    number.className = 'rank-number';
    number.textContent = String(index + 1).padStart(2, '0');
    const copy = document.createElement('div');
    const title = document.createElement('strong');
    title.textContent = rank.title;
    const note = document.createElement('em');
    note.textContent = rank.note;
    copy.append(title, note);
    const example = document.createElement('code');
    example.textContent = rank.example;
    row.append(number, copy, example);
    return row;
  }));
}

function toggleLog(force) {
  const next = force === undefined ? !state.logOpen : Boolean(force);
  state.logOpen = next;
  els.logPanel.classList.toggle('is-open', next);
  els.logPanel.setAttribute('aria-hidden', String(!next));
  els.logButton.setAttribute('aria-expanded', String(next));
  if (next) {
    els.logDot.hidden = true;
    els.logList.scrollTop = els.logList.scrollHeight;
  }
}

function toggleCinema() {
  settings.cinema = !settings.cinema;
  saveSettings();
  syncSettingsControls();
  state.view?.setCinematic(settings.cinema);
  showTableMessage(settings.cinema ? 'Cinematic camera on' : 'Cinematic camera off', 1300);
}

/* ---------------- bindings ------------------------------------------- */

function bindEvents() {
  els.year.textContent = String(new Date().getFullYear());
  els.play.addEventListener('click', openSetup);
  els.setupBack.addEventListener('click', closeSetup);
  $$('#setup [data-seats]').forEach((button) => {
    button.addEventListener('click', () => selectSeats(Number(button.dataset.seats)));
  });
  els.deal.addEventListener('click', () => startSession(state.selectedSeats));

  $$('[data-open]').forEach((button) => {
    button.addEventListener('click', (event) => {
      event.preventDefault();
      openModal(button.dataset.open);
    });
  });
  $$('[data-close]').forEach((button) => button.addEventListener('click', closeModal));

  els.fold.addEventListener('click', () => submitPlayerAction('fold'));
  els.call.addEventListener('click', () => {
    const legal = state.game?.legalActions(0);
    if (!legal) return;
    submitPlayerAction(legal.canCheck ? 'check' : 'call');
  });
  els.raise.addEventListener('click', () => {
    const legal = state.game?.legalActions(0);
    if (!legal || !legal.canRaise) return;
    submitPlayerAction('raise', clampRaise(els.raiseRange.value, legal));
  });
  els.raiseRange.addEventListener('input', () => updateRaiseValue(els.raiseRange.value));
  els.raiseQuick = $('raise-quick');
  $$('#raise-quick [data-fraction]').forEach((button) => {
    button.addEventListener('click', () => {
      const legal = state.game?.legalActions(0);
      if (!legal || !legal.canRaise) return;
      const fraction = Number(button.dataset.fraction);
      const base = state.game.totalPot() + legal.callAmount;
      const value = state.game.currentBet === 0
        ? base * fraction
        : state.game.currentBet + base * fraction;
      updateRaiseValue(clampRaise(roundChips(value), legal));
    });
  });
  els.allIn.addEventListener('click', () => {
    const legal = state.game?.legalActions(0);
    if (!legal || !legal.canRaise) return;
    updateRaiseValue(legal.maxRaiseTo);
  });

  els.next.addEventListener('click', startNextHand);
  els.again.addEventListener('click', () => {
    els.gameover.hidden = true;
    startSession(state.playerCount);
  });
  els.menuButton.addEventListener('click', () => {
    closeAllModals();
    leaveTable(true);
  });
  els.pause.addEventListener('click', () => openModal('pause'));
  $('btn-resume').addEventListener('click', closeModal);
  $('btn-leave').addEventListener('click', () => {
    closeAllModals();
    leaveTable(true);
  });
  els.cinema.addEventListener('click', toggleCinema);
  els.logButton.addEventListener('click', () => toggleLog());
  $('btn-log-close').addEventListener('click', () => toggleLog(false));

  $('set-sensitivity').addEventListener('input', (event) => {
    settings.sensitivity = Number(event.target.value);
    $('set-sensitivity-value').textContent = settings.sensitivity.toFixed(2);
    saveSettings();
    state.view?.setLookSensitivity(settings.sensitivity);
  });
  $('set-sway').addEventListener('change', (event) => {
    settings.sway = event.target.checked;
    saveSettings();
    state.view?.setIdleMotion(settings.sway);
  });
  $('set-cinema').addEventListener('change', (event) => {
    settings.cinema = event.target.checked;
    saveSettings();
    state.view?.setCinematic(settings.cinema);
    els.cinema.setAttribute('aria-pressed', String(settings.cinema));
    els.cinema.classList.toggle('is-on', settings.cinema);
  });
  $('set-quality').addEventListener('change', (event) => {
    settings.quality = event.target.value;
    performanceWatch.locked = true;
    saveSettings();
    state.view?.setQuality(settings.quality);
  });
  $('settings-reset').addEventListener('click', () => {
    settings = { ...defaultSettings };
    performanceWatch.locked = false;
    saveSettings();
    applySettings();
  });

  $$('[data-exit]').forEach((link) => {
    link.addEventListener('click', (event) => {
      event.preventDefault();
      const target = new URL('../../index.html', window.location.href).href;
      try {
        if (window.top && window.top !== window.self) {
          window.top.location.href = target;
          return;
        }
      } catch (error) { /* cross-origin parent, fall through */ }
      window.location.href = target;
    });
  });

  window.addEventListener('pointermove', (event) => {
    if (!state.view || !state.inGame || state.paused || !state.hudVisible) return;
    if (performance.now() < state.lookArmedAt) {
      state.view.setLook(0, 0);
      return;
    }
    if (event.target.closest && event.target.closest('button, input, select, .modal, .result, .log-panel')) {
      state.view.setLook(0, 0);
      return;
    }
    const nx = (event.clientX / Math.max(1, window.innerWidth)) * 2 - 1;
    const ny = (event.clientY / Math.max(1, window.innerHeight)) * 2 - 1;
    state.view.setLook(nx, ny);
  });
  document.addEventListener('mouseleave', () => state.view?.setLook(0, 0));

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      if (state.modal) { closeModal(); return; }
      if (!els.setup.hidden) { closeSetup(); return; }
      if (state.inGame && state.hudVisible) { openModal('pause'); return; }
    }
    if (state.modal || state.paused) return;
    if (event.target.closest && event.target.closest('input, select, textarea')) return;
    if (!state.inGame || !state.hudVisible) return;
    if (!els.result.hidden && (event.code === 'Space' || event.key === 'Enter')) {
      event.preventDefault();
      startNextHand();
      return;
    }
    if (els.actionBar.hidden) {
      if (event.key.toLowerCase() === 'v') toggleCinema();
      if (event.key.toLowerCase() === 'l') toggleLog();
      return;
    }
    const legal = state.game?.legalActions(0);
    if (!legal) return;
    const key = event.key.toLowerCase();
    if (key === 'f') { event.preventDefault(); submitPlayerAction('fold'); }
    else if (key === 'c') { event.preventDefault(); submitPlayerAction(legal.canCheck ? 'check' : 'call'); }
    else if (key === 'r' && legal.canRaise) { event.preventDefault(); submitPlayerAction('raise', clampRaise(els.raiseRange.value, legal)); }
    else if (key === 'a' && legal.canRaise) { event.preventDefault(); submitPlayerAction('raise', legal.maxRaiseTo); }
    else if (key === 'v') toggleCinema();
    else if (key === 'l') toggleLog();
  });
}

/* ---------------- adaptive quality ---------------------------------- */

function watchPerformance(now) {
  if (!state.view || settings.quality === 'low' || performanceWatch.locked) return;
  if (document.visibilityState !== 'visible' || state.paused || state.modal || now < qualityWarmupUntil) {
    performanceWatch.frames = 0;
    performanceWatch.since = 0;
    return;
  }
  if (!performanceWatch.since) {
    performanceWatch.since = now;
    performanceWatch.frames = 0;
    return;
  }
  performanceWatch.frames += 1;
  const elapsed = now - performanceWatch.since;
  if (elapsed < 3200) return;
  const fps = performanceWatch.frames * 1000 / elapsed;
  performanceWatch.frames = 0;
  performanceWatch.since = now;
  const threshold = settings.quality === 'high' ? 30 : 22;
  if (fps < threshold) {
    const next = settings.quality === 'high' ? 'medium' : 'low';
    settings.quality = next;
    saveSettings();
    syncSettingsControls();
    state.view.setQuality(next);
    console.info(`[holdem] ${Math.round(fps)} fps — graphics set to ${next}`);
  }
}

/* ---------------- boot ----------------------------------------------- */

function frame(now) {
  const dt = Math.min(0.05, Math.max(0, (now - state.lastTime) / 1000));
  state.lastTime = now;
  if (state.view) {
    state.view.update(dt, now);
    state.view.render();
    if (state.hudVisible) placeSeatLabels();
    watchPerformance(now);
  }
  window.requestAnimationFrame(frame);
}

function init() {
  buildSeatLabels();
  buildRankList();
  bindEvents();
  applySettings();
  state.view = bootPokerScene(els.gl);
  if (!state.view) {
    els.loading.classList.add('is-done');
    showError('This table needs WebGL. Try a browser with hardware acceleration.');
    return;
  }
  applySettings();
  qualityWarmupUntil = performance.now() + 3000;
  requestAnimationFrame((now) => {
    state.lastTime = now;
    window.requestAnimationFrame(frame);
    window.setTimeout(() => els.loading.classList.add('is-done'), 220);
  });
}

init();
