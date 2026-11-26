/* =====================================================================
   TEXAS HOLD'EM — no-limit rules engine
   Blinds, betting rounds, all-ins, side pots and showdown. Pure JS.
   ===================================================================== */

import {
  createDeck, shuffle, evaluateCards, compareHands, describeHole, cardLabel
} from './cards.js';

const BETTING_PHASES = new Set(['preflop', 'flop', 'turn', 'river']);

export const DEFAULT_STACK = 10000;

export const AI_PROFILES = [
  { name: 'Marcus Vale', title: 'The Banker', personality: 'Patient. Buys the button. Makes you show first.', aggression: 0.82, tightness: 1.18, bluff: 0.05 },
  { name: 'Sofia Reyes', title: 'The Shark', personality: 'Pressure is a language and she speaks it fluently.', aggression: 1.25, tightness: 0.9, bluff: 0.16 },
  { name: 'Doc Harlan', title: 'The Professor', personality: 'Counts the outs, then finds one more reason to call.', aggression: 1.0, tightness: 1.02, bluff: 0.1 },
  { name: 'Yuki Tanaka', title: 'The Ice Queen', personality: 'Has folded more winners than most people have played.', aggression: 0.72, tightness: 1.3, bluff: 0.04 },
  { name: 'Big Sal', title: 'The Anchor', personality: 'No hand is too small and no raise is too big.', aggression: 1.35, tightness: 0.8, bluff: 0.2 },
  { name: 'Nadia Kova', title: 'The Wildcard', personality: 'Plays the table, not the cards. Dangerous either way.', aggression: 1.12, tightness: 0.96, bluff: 0.24 }
];

/* Split a hand's total contributions into a main pot and any side pots.
   Folded money stays in the pot it helped build but cannot be won. */
export function buildSidePots(seats) {
  const levels = [...new Set(
    seats.filter((s) => s.inHand && s.totalBet > 0).map((s) => s.totalBet)
  )].sort((a, b) => a - b);
  const pots = [];
  let previous = 0;
  for (const level of levels) {
    let amount = 0;
    const eligible = [];
    for (const seat of seats) {
      if (!seat.inHand) continue;
      amount += Math.max(0, Math.min(seat.totalBet, level) - previous);
      if (seat.totalBet >= level && !seat.folded) eligible.push(seat.index);
    }
    if (amount > 0) pots.push({ amount, eligible, cap: level });
    previous = level;
  }
  return pots;
}

export class PokerGame {
  constructor(options = {}) {
    const configs = options.seats || [
      { name: 'You', isHuman: true },
      { name: 'Marcus Vale', persona: AI_PROFILES[0] },
      { name: 'Sofia Reyes', persona: AI_PROFILES[1] },
      { name: 'Doc Harlan', persona: AI_PROFILES[2] },
      { name: 'Yuki Tanaka', persona: AI_PROFILES[3] },
      { name: 'Big Sal', persona: AI_PROFILES[4] }
    ];
    this.seats = configs.map((config, index) => ({
      index,
      name: config.name || `Seat ${index + 1}`,
      isHuman: Boolean(config.isHuman),
      stack: Number.isFinite(config.stack) ? config.stack : DEFAULT_STACK,
      startingStack: Number.isFinite(config.stack) ? config.stack : DEFAULT_STACK,
      persona: config.persona || { aggression: 1, tightness: 1, bluff: 0.08 },
      look: config.look ?? index,
      folded: false,
      allIn: false,
      hasActed: false,
      inHand: false,
      roundBet: 0,
      totalBet: 0,
      hole: [],
      lastAction: null,
      raisesThisStreet: 0,
      best: null,
      _eqCache: null
    }));
    this.seatCount = this.seats.length;
    this.sb = options.sb || 50;
    this.bb = options.bb || this.sb * 2;
    this.random = options.random || Math.random;
    this.dealer = -1;
    this.handNo = 0;
    this.phase = 'idle';
    this.board = [];
    this.burn = [];
    this.deck = [];
    this.pot = 0;
    this.currentBet = 0;
    this.lastRaiseSize = this.bb;
    this.actor = null;
    this.sbSeat = null;
    this.bbSeat = null;
    this.lastResult = null;
    this.events = [];
  }

  get human() { return this.seats.find((seat) => seat.isHuman); }

  get activeSeats() { return this.seats.filter((seat) => seat.inHand); }

  get contenders() { return this.seats.filter((seat) => seat.inHand && !seat.folded); }

  get isBetting() { return BETTING_PHASES.has(this.phase); }

  get streetLabel() {
    if (this.phase === 'preflop') return 'Pre-flop';
    if (this.phase === 'flop') return 'Flop';
    if (this.phase === 'turn') return 'Turn';
    if (this.phase === 'river') return 'River';
    if (this.phase === 'showdown') return 'Showdown';
    return 'Waiting';
  }

  totalPot() {
    return this.pot + this.seats.reduce((sum, seat) => sum + seat.roundBet, 0);
  }

  orderAfter(from) {
    const order = [];
    for (let i = 1; i <= this.seatCount; i++) order.push((from + i) % this.seatCount);
    return order;
  }

  nextSeatWithStack(from) {
    for (let i = 1; i <= this.seatCount; i++) {
      const index = (from + i) % this.seatCount;
      if (this.seats[index].stack > 0) return index;
    }
    return from;
  }

  nextActionableAfter(from) {
    for (let i = 1; i <= this.seatCount; i++) {
      const index = (from + i) % this.seatCount;
      const seat = this.seats[index];
      if (seat.inHand && !seat.folded && !seat.allIn && seat.stack > 0) return index;
    }
    return null;
  }

  nextActionableFrom(from, include) {
    for (let i = include ? 0 : 1; i <= this.seatCount; i++) {
      const index = (from + i) % this.seatCount;
      const seat = this.seats[index];
      if (seat.inHand && !seat.folded && !seat.allIn && seat.stack > 0) return index;
    }
    return null;
  }

  emit(event) { this.events.push(event); }

  takeEvents() { const out = this.events; this.events = []; return out; }

  startHand() {
    this.events = [];
    if (this.phase === 'over') return this.takeEvents();

    const human = this.human;
    if (human && human.stack <= 0) {
      this.phase = 'over';
      this.emit({ type: 'over', reason: 'busted', humanStack: human ? human.stack : 0 });
      return this.takeEvents();
    }

    const funded = this.seats.filter((seat) => seat.stack > 0);
    if (funded.length < 2) {
      this.phase = 'over';
      this.emit({
        type: 'over',
        reason: funded.length === 1 && human && human.stack > 0 ? 'victory' : 'empty',
        winnerSeat: funded[0] ? funded[0].index : null,
        humanStack: human ? human.stack : 0
      });
      return this.takeEvents();
    }

    this.handNo += 1;
    if (this.dealer < 0) {
      this.dealer = funded[Math.min(funded.length - 1, Math.floor(this.random() * funded.length))].index;
    } else {
      this.dealer = this.nextSeatWithStack(this.dealer);
    }

    // Reset every seat for the new hand.
    for (const seat of this.seats) {
      seat.folded = false;
      seat.allIn = false;
      seat.hasActed = false;
      seat.roundBet = 0;
      seat.totalBet = 0;
      seat.hole = [];
      seat.inHand = seat.stack > 0;
      seat.lastAction = null;
      seat.raisesThisStreet = 0;
      seat.best = null;
      seat._eqCache = null;
    }

    this.phase = 'preflop';
    this.board = [];
    this.burn = [];
    this.deck = shuffle(createDeck(), this.random);
    this.pot = 0;
    this.actor = null;
    this.currentBet = this.bb;
    this.lastRaiseSize = this.bb;
    this.lastResult = null;

    const fundedNow = this.seats.filter((seat) => seat.inHand);
    if (fundedNow.length === 2) {
      this.sbSeat = this.dealer;
      this.bbSeat = this.nextSeatWithStack(this.dealer);
    } else {
      this.sbSeat = this.nextSeatWithStack(this.dealer);
      this.bbSeat = this.nextSeatWithStack(this.sbSeat);
    }

    this.emit({
      type: 'hand-start',
      handNo: this.handNo,
      dealer: this.dealer,
      sbSeat: this.sbSeat,
      bbSeat: this.bbSeat,
      inHand: fundedNow.map((seat) => seat.index),
      stacks: this.seats.map((seat) => seat.stack)
    });

    this.postBlind(this.sbSeat, this.sb, 'sb');
    this.postBlind(this.bbSeat, this.bb, 'bb');

    // Two cards each, starting to the dealer's left.
    const order = this.orderAfter(this.dealer).filter((index) => this.seats[index].inHand);
    for (let round = 0; round < 2; round++) {
      for (const index of order) {
        this.seats[index].hole.push(this.deck.pop());
      }
    }
    for (const index of order) {
      const seat = this.seats[index];
      this.emit({ type: 'hole', seat: index, cards: seat.hole.slice(), faceUp: seat.isHuman });
    }

    if (fundedNow.length === 2) {
      this.actor = this.nextActionableFrom(this.dealer, true);
    } else {
      this.actor = this.nextActionableAfter(this.bbSeat);
    }

    if (this.actor === null) {
      this.collectBets();
      this.runOutBoard();
      return this.takeEvents();
    }

    this.emit({ type: 'actor', seat: this.actor });
    return this.takeEvents();
  }

  postBlind(index, amount, blind) {
    const seat = this.seats[index];
    const paid = this.commit(seat, amount);
    this.emit({
      type: 'post',
      seat: index,
      amount: paid,
      blind,
      allIn: seat.allIn,
      stack: seat.stack,
      roundBet: seat.roundBet
    });
  }

  commit(seat, amount) {
    const paid = Math.max(0, Math.min(seat.stack, amount));
    seat.stack -= paid;
    seat.roundBet += paid;
    seat.totalBet += paid;
    if (seat.stack <= 0) {
      seat.stack = 0;
      seat.allIn = true;
    }
    return paid;
  }

  collectBets() {
    for (const seat of this.seats) {
      if (seat.roundBet > 0) {
        this.pot += seat.roundBet;
        seat.roundBet = 0;
      }
    }
    return this.pot;
  }

  legalActions(index) {
    if (!this.isBetting || index !== this.actor) return null;
    const seat = this.seats[index];
    if (!seat || seat.folded || seat.allIn) return null;
    const toCall = Math.max(0, this.currentBet - seat.roundBet);
    const maxRaiseTo = seat.roundBet + seat.stack;
    const minRaiseTo = Math.min(maxRaiseTo, Math.max(this.currentBet + this.lastRaiseSize, this.bb));
    return {
      toCall,
      callAmount: Math.min(seat.stack, toCall),
      canCheck: toCall === 0,
      canCall: toCall > 0 && seat.stack > 0,
      canRaise: maxRaiseTo > this.currentBet && seat.stack > 0,
      canFold: true,
      minRaiseTo,
      maxRaiseTo,
      currentBet: this.currentBet,
      stack: seat.stack,
      roundBet: seat.roundBet,
      pot: this.totalPot(),
      bigBlind: this.bb
    };
  }

  act(index, action, raiseTo) {
    if (this.actor !== index) return { ok: false, error: 'It is not that seat\'s turn.', events: [] };
    if (!this.isBetting) return { ok: false, error: 'Betting is closed.', events: [] };
    const seat = this.seats[index];
    const legal = this.legalActions(index);
    if (!seat || !legal) return { ok: false, error: 'That seat cannot act.', events: [] };

    this.events = [];
    const type = String(action || '').toLowerCase();
    let added = 0;
    let to = null;

    if (type === 'fold') {
      seat.folded = true;
      seat.hasActed = true;
      seat.lastAction = { type: 'fold', amount: 0 };
      this.emit({ type: 'action', seat: index, action: 'fold', amount: 0, stack: seat.stack, allIn: false, roundBet: seat.roundBet, pot: this.totalPot(), currentBet: this.currentBet });

    } else if (type === 'check') {
      if (legal.toCall > 0) return { ok: false, error: 'You cannot check while facing a bet.', events: [] };
      seat.hasActed = true;
      seat.lastAction = { type: 'check', amount: 0 };
      this.emit({ type: 'action', seat: index, action: 'check', amount: 0, stack: seat.stack, allIn: false, roundBet: seat.roundBet, pot: this.totalPot(), currentBet: this.currentBet });

    } else if (type === 'call') {
      if (legal.toCall === 0) {
        seat.hasActed = true;
        seat.lastAction = { type: 'check', amount: 0 };
        this.emit({ type: 'action', seat: index, action: 'check', amount: 0, stack: seat.stack, allIn: false, roundBet: seat.roundBet, pot: this.totalPot(), currentBet: this.currentBet });
      } else {
        added = this.commit(seat, legal.toCall);
        seat.hasActed = true;
        seat.lastAction = { type: 'call', amount: added };
        this.emit({ type: 'action', seat: index, action: 'call', amount: added, stack: seat.stack, allIn: seat.allIn, roundBet: seat.roundBet, pot: this.totalPot(), currentBet: this.currentBet });
      }

    } else if (type === 'raise' || type === 'bet') {
      if (!legal.canRaise) return { ok: false, error: 'There is nothing left to raise.', events: [] };
      const target = Math.round(Number(raiseTo));
      if (!Number.isFinite(target) || target <= this.currentBet) {
        return { ok: false, error: 'Raise is not high enough.', events: [] };
      }
      if (target > legal.maxRaiseTo) return { ok: false, error: 'You do not have that many chips.', events: [] };
      if (target < legal.minRaiseTo && target !== legal.maxRaiseTo) {
        return { ok: false, error: `The minimum raise is to ${legal.minRaiseTo}.`, events: [] };
      }
      const previousBet = this.currentBet;
      added = this.commit(seat, target - seat.roundBet);
      const actualTo = seat.roundBet;
      const raiseSize = actualTo - previousBet;
      if (raiseSize >= this.lastRaiseSize) this.lastRaiseSize = raiseSize;
      this.currentBet = actualTo;
      seat.hasActed = true;
      seat.raisesThisStreet += 1;
      seat.lastAction = { type: actualTo >= legal.maxRaiseTo ? 'all-in' : 'raise', amount: added };
      for (const other of this.contenders) {
        if (other.index !== index && !other.allIn) other.hasActed = false;
      }
      to = actualTo;
      this.emit({
        type: 'action', seat: index, action: actualTo >= legal.maxRaiseTo ? 'all-in' : 'raise',
        amount: added, raiseTo: actualTo, allIn: seat.allIn, stack: seat.stack,
        roundBet: seat.roundBet, pot: this.totalPot(), currentBet: this.currentBet
      });

    } else {
      return { ok: false, error: 'Unknown action.', events: [] };
    }

    this.progress(index);
    return { ok: true, events: this.takeEvents(), added, raiseTo: to };
  }

  progress(fromSeat) {
    this.actor = null;
    const contenders = this.contenders;
    if (contenders.length <= 1) {
      this.finishUncontested();
      return;
    }
    const actionable = contenders.filter((seat) => !seat.allIn);
    if (actionable.length === 0) {
      this.runOutBoard();
      return;
    }
    const roundComplete = actionable.every((seat) => seat.hasActed && seat.roundBet === this.currentBet);
    if (roundComplete) {
      this.endStreet();
      return;
    }
    const next = this.nextActionableAfter(fromSeat);
    if (next === null) {
      this.endStreet();
      return;
    }
    this.actor = next;
    this.emit({ type: 'actor', seat: next });
  }

  burnCard() {
    if (!this.deck.length) return;
    this.burn.push(this.deck.pop());
  }

  dealToBoard(count) {
    const cards = [];
    this.burnCard();
    for (let i = 0; i < count; i++) {
      const card = this.deck.pop();
      if (!card) break;
      this.board.push(card);
      cards.push(card);
    }
    return cards;
  }

  setStreetPhase() {
    if (this.board.length >= 5) this.phase = 'river';
    else if (this.board.length === 4) this.phase = 'turn';
    else if (this.board.length === 3) this.phase = 'flop';
    else this.phase = 'preflop';
  }

  resetRound() {
    this.currentBet = 0;
    this.lastRaiseSize = this.bb;
    for (const seat of this.seats) {
      seat.roundBet = 0;
      seat.hasActed = false;
      seat.raisesThisStreet = 0;
    }
  }

  endStreet() {
    this.collectBets();
    const contenders = this.contenders;
    if (contenders.length <= 1) {
      this.finishUncontested();
      return;
    }
    if (this.board.length >= 5) {
      this.showdown();
      return;
    }
    const newCards = this.dealToBoard(this.board.length === 0 ? 3 : 1);
    this.setStreetPhase();
    this.resetRound();
    const next = this.nextActionableAfter(this.dealer);
    const event = {
      type: 'street',
      phase: this.phase,
      board: this.board.slice(),
      newCards,
      pot: this.pot,
      actor: next,
      allInRunout: false
    };
    this.emit(event);
    if (next === null) {
      this.runOutBoard();
      return;
    }
    this.actor = next;
    this.emit({ type: 'actor', seat: next });
  }

  runOutBoard() {
    this.collectBets();
    this.resetRound();
    while (this.board.length < 5) {
      const newCards = this.dealToBoard(this.board.length === 0 ? 3 : 1);
      this.setStreetPhase();
      this.emit({
        type: 'street',
        phase: this.phase,
        board: this.board.slice(),
        newCards,
        pot: this.pot,
        actor: null,
        allInRunout: true
      });
    }
    this.actor = null;
    this.showdown();
  }

  finishUncontested() {
    this.collectBets();
    const winner = this.contenders[0];
    const total = this.pot;
    this.pot = 0;
    for (const seat of this.seats) seat.roundBet = 0;
    if (winner) winner.stack += total;
    this.phase = 'handover';
    this.actor = null;
    const result = {
      handNo: this.handNo,
      totalPot: total,
      uncontested: true,
      winners: winner ? [{
        seat: winner.index,
        amount: total,
        handName: 'Last player standing',
        hole: winner.hole.slice(),
        cards: winner.hole.slice(),
        split: false
      }] : [],
      potResults: [],
      busted: this.seats.filter((seat) => seat.inHand && seat.stack <= 0).map((seat) => seat.index),
      board: this.board.slice()
    };
    this.lastResult = result;
    if (winner) this.emit({ type: 'award', winners: result.winners, totalPot: total, uncontested: true });
    this.emit({ type: 'hand-end', ...result });
  }

  showdown() {
    this.collectBets();
    const contenders = this.contenders.slice();
    for (const seat of contenders) {
      seat.best = evaluateCards([...seat.hole, ...this.board]);
    }

    const pots = buildSidePots(this.seats);
    const awarded = new Map();
    const potResults = [];
    const winnerSeats = new Set();

    for (let potIndex = 0; potIndex < pots.length; potIndex++) {
      const pot = pots[potIndex];
      const eligible = pot.eligible.filter((index) => this.seats[index] && this.seats[index].best);
      if (!eligible.length) continue;
      let bestSeat = eligible[0];
      for (const index of eligible.slice(1)) {
        if (compareHands(this.seats[index].best, this.seats[bestSeat].best) > 0) bestSeat = index;
      }
      const tied = eligible.filter((index) => compareHands(this.seats[index].best, this.seats[bestSeat].best) === 0);
      const share = Math.floor(pot.amount / tied.length);
      let remainder = pot.amount - share * tied.length;
      const ordered = tied.slice().sort((a, b) => ((a - this.dealer - 1 + this.seatCount) % this.seatCount) - ((b - this.dealer - 1 + this.seatCount) % this.seatCount));
      const potWinners = [];
      for (const index of ordered) {
        const amount = share + (remainder > 0 ? 1 : 0);
        if (remainder > 0) remainder -= 1;
        if (amount > 0) {
          this.seats[index].stack += amount;
          awarded.set(index, (awarded.get(index) || 0) + amount);
          winnerSeats.add(index);
          potWinners.push({ seat: index, amount });
        }
      }
      potResults.push({
        index: potIndex,
        amount: pot.amount,
        winners: potWinners,
        handName: this.seats[bestSeat].best ? this.seats[bestSeat].best.name : '',
        split: tied.length > 1
      });
    }

    const totalPot = pots.reduce((sum, pot) => sum + pot.amount, 0);
    this.pot = 0;
    for (const seat of this.seats) seat.roundBet = 0;
    this.phase = 'showdown';
    this.actor = null;

    const reveals = contenders.map((seat) => ({
      seat: seat.index,
      cards: seat.best ? seat.best.cards : [],
      hole: seat.hole.slice(),
      name: seat.best ? seat.best.name : '',
      category: seat.best ? seat.best.category : -1,
      score: seat.best ? seat.best.score.slice() : [],
      isWinner: winnerSeats.has(seat.index)
    }));

    const winners = [...awarded.entries()].map(([seatIndex, amount]) => {
      const seat = this.seats[seatIndex];
      const won = potResults.filter((pot) => pot.winners.some((w) => w.seat === seatIndex));
      return {
        seat: seatIndex,
        amount,
        handName: seat.best ? seat.best.name : '',
        hole: seat.hole.slice(),
        cards: seat.best ? seat.best.cards : [],
        split: won.some((pot) => pot.split)
      };
    }).sort((a, b) => b.amount - a.amount);

    const result = {
      handNo: this.handNo,
      totalPot,
      uncontested: false,
      winners,
      potResults,
      reveals,
      busted: this.seats.filter((seat) => seat.inHand && seat.stack <= 0).map((seat) => seat.index),
      board: this.board.slice()
    };
    this.lastResult = result;

    this.emit({
      type: 'showdown',
      board: this.board.slice(),
      reveals,
      potResults,
      totalPot
    });
    if (winners.length) this.emit({ type: 'award', winners, totalPot, uncontested: false });
    this.emit({ type: 'hand-end', ...result });
  }
}

export { cardLabel, describeHole };
