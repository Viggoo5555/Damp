/* =====================================================================
   TEXAS HOLD'EM — opponent brains
   A Monte Carlo equity estimate plus personality-driven betting.
   ===================================================================== */

import {
  createDeck, evaluateCards, compareHands
} from './cards.js';

const FULL_DECK = createDeck();
export const AI_NAMES = ['Marcus Vale', 'Sofia Reyes', 'Doc Harlan', 'Yuki Tanaka', 'Big Sal', 'Nadia Kova'];

/* Win share for `hole` against `opponents` random hands with the board as it
   stands. Board completion is sampled, so the same function works pre-flop,
   on the flop, on the turn and on the river. */
export function estimateEquity(hole, board, opponents, options = {}) {
  if (!hole || hole.length !== 2) return 0;
  if (opponents <= 0) return 1;
  const random = options.random || Math.random;
  const samples = options.samples || (board.length === 0 ? 120 : board.length === 3 ? 160 : 170);
  const known = new Set([...hole, ...board].map((card) => card.id));
  const remaining = FULL_DECK.filter((card) => !known.has(card.id));
  const needBoard = 5 - board.length;
  let equity = 0;
  let counted = 0;

  for (let sample = 0; sample < samples; sample++) {
    const pool = remaining.slice();
    const draw = () => {
      const index = Math.min(pool.length - 1, Math.floor(random() * pool.length));
      const card = pool[index];
      pool[index] = pool[pool.length - 1];
      pool.pop();
      return card;
    };
    const fullBoard = board.slice();
    for (let i = 0; i < needBoard; i++) fullBoard.push(draw());
    const hero = evaluateCards([...hole, ...fullBoard]);
    if (!hero) continue;
    counted += 1;

    let beaten = false;
    let tied = 0;
    for (let opponent = 0; opponent < opponents; opponent++) {
      const theirHole = [draw(), draw()];
      const theirHand = evaluateCards([...theirHole, ...fullBoard]);
      const comparison = compareHands(hero, theirHand);
      if (comparison < 0) { beaten = true; break; }
      if (comparison === 0) tied += 1;
    }
    if (beaten) continue;
    equity += 1 / (tied + 1);
  }
  return counted ? equity / counted : 0;
}

function eqCacheKey(game, seat, opponents) {
  return `${game.handNo}|${game.phase}|${opponents}|${seat.hole.map((c) => c.id).join('')}|${game.board.map((c) => c.id).join('')}`;
}

/* The AI always returns a legal action object: {type, raiseTo?}. */
export function aiDecide(game, random = Math.random) {
  if (game.actor === null || !game.isBetting) return null;
  const seat = game.seats[game.actor];
  const legal = game.legalActions(game.actor);
  if (!seat || !legal) return null;

  const opponents = game.seats.filter((s) => s.inHand && !s.folded && s.index !== seat.index).length;
  const cacheKey = eqCacheKey(game, seat, opponents);
  if (!seat._eqCache || seat._eqCache.key !== cacheKey) {
    seat._eqCache = { key: cacheKey, value: estimateEquity(seat.hole, game.board, opponents, { random }) };
  }
  let equity = seat._eqCache.value;
  equity = Math.max(0, Math.min(1, equity + (random() - 0.5) * 0.05));
  const persona = seat.persona || { aggression: 1, tightness: 1, bluff: 0.08 };
  const aggression = Math.max(0.4, persona.aggression || 1);
  const tightness = Math.max(0.6, persona.tightness || 1);
  const bluff = Math.max(0, persona.bluff || 0);
  const opponentScale = Math.max(1, opponents);
  const strong = equity > 0.36 + 0.36 / opponentScale;
  const good = equity > 0.28 + 0.3 / opponentScale;
  const playable = equity > 0.2 + 0.3 / opponentScale;

  const pot = game.totalPot();
  const call = legal.callAmount;
  const toCall = legal.toCall;
  const potOdds = toCall > 0 ? call / (pot + call) : 0;
  const postflop = game.board.length >= 3;
  const cheap = call <= game.bb;
  const canRaise = legal.canRaise && seat.raisesThisStreet < 2;

  const raiseTo = (fraction) => {
    if (!canRaise) return null;
    let increment;
    if (game.board.length === 0) {
      increment = Math.max(game.bb * 2.5, (pot + call) * 0.55);
    } else {
      increment = Math.max(game.bb, (pot + call) * fraction);
    }
    let target = game.currentBet + increment;
    const step = target > 1500 ? 100 : 25;
    target = Math.round(target / step) * step;
    if (target >= legal.maxRaiseTo - step) target = legal.maxRaiseTo;
    if (target < legal.minRaiseTo) target = legal.minRaiseTo;
    target = Math.min(target, legal.maxRaiseTo);
    if (target <= game.currentBet) return null;
    return { type: 'raise', raiseTo: target };
  };
  const jam = () => {
    if (!canRaise) return null;
    return { type: 'raise', raiseTo: legal.maxRaiseTo };
  };

  if (toCall === 0) {
    if (canRaise && strong && random() < 0.86 * aggression) {
      if (seat.stack <= game.bb * 12 && random() < 0.45) return jam() || { type: 'check' };
      return raiseTo(0.72) || { type: 'check' };
    }
    if (canRaise && good && random() < 0.42 * aggression) return raiseTo(0.55) || { type: 'check' };
    if (canRaise && postflop && random() < bluff * 0.5 && equity < 0.34) return raiseTo(0.65) || { type: 'check' };
    return { type: 'check' };
  }

  // Facing a bet. A short stack can be forced all-in by a call.
  const callingAllIn = call >= seat.stack;
  if (canRaise && strong && random() < 0.58 * aggression) {
    if (legal.maxRaiseTo <= legal.minRaiseTo || (seat.stack <= game.bb * 14 && random() < 0.35)) {
      return jam() || { type: 'call' };
    }
    return raiseTo(0.85) || { type: 'call' };
  }
  if (canRaise && good && random() < 0.17 * aggression && !callingAllIn) return raiseTo(0.6) || { type: 'call' };
  if (canRaise && postflop && random() < bluff * 0.2 && equity < 0.3) return raiseTo(0.7) || { type: 'call' };

  if (callingAllIn) {
    if (equity > potOdds + 0.035) return { type: 'call' };
    if (equity > 0.5 && random() < 0.25 * aggression) return { type: 'call' };
    return { type: 'fold' };
  }

  if (potOdds < 0.1 && equity > 0.2) return { type: 'call' };

  const foldMargin = 0.035 + (tightness - 1) * 0.05;
  if (equity < potOdds - foldMargin && random() > bluff * 0.6) return { type: 'fold' };
  if (equity < 0.3 && !cheap && random() > 0.16) return { type: 'fold' };
  if (!playable && toCall > pot * 0.4 && random() > bluff * 0.8) return { type: 'fold' };
  return { type: 'call' };
}

export function thinkTime(random = Math.random) {
  return 520 + Math.floor(random() * 1050);
}
