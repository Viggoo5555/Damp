/* =====================================================================
   TEXAS HOLD'EM — cards, deck and hand evaluation
   Pure JavaScript. No DOM, no three.js. Safe to run in Node for tests.
   ===================================================================== */

export const SUITS = [
  { id: 's', glyph: '♠', name: 'spades', colour: 'black' },
  { id: 'h', glyph: '♥', name: 'hearts', colour: 'red' },
  { id: 'd', glyph: '♦', name: 'diamonds', colour: 'red' },
  { id: 'c', glyph: '♣', name: 'clubs', colour: 'black' }
];

export const RANKS = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14];

const SUIT_BY_ID = Object.fromEntries(SUITS.map((suit) => [suit.id, suit]));
const RANK_LABEL = { 2: '2', 3: '3', 4: '4', 5: '5', 6: '6', 7: '7', 8: '8', 9: '9', 10: '10', 11: 'J', 12: 'Q', 13: 'K', 14: 'A' };
const RANK_NAME = { 2: 'Two', 3: 'Three', 4: 'Four', 5: 'Five', 6: 'Six', 7: 'Seven', 8: 'Eight', 9: 'Nine', 10: 'Ten', 11: 'Jack', 12: 'Queen', 13: 'King', 14: 'Ace' };
const RANK_PLURAL = { 2: 'Twos', 3: 'Threes', 4: 'Fours', 5: 'Fives', 6: 'Sixes', 7: 'Sevens', 8: 'Eights', 9: 'Nines', 10: 'Tens', 11: 'Jacks', 12: 'Queens', 13: 'Kings', 14: 'Aces' };

export const CATEGORY_NAMES = [
  'High Card', 'Pair', 'Two Pair', 'Three of a Kind', 'Straight',
  'Flush', 'Full House', 'Four of a Kind', 'Straight Flush'
];

export function rankLabel(rank) { return RANK_LABEL[rank] || String(rank); }
export function rankName(rank) { return RANK_NAME[rank] || String(rank); }
export function rankPlural(rank) { return RANK_PLURAL[rank] || String(rank); }
export function suitGlyph(suitId) { return (SUIT_BY_ID[suitId] || SUITS[0]).glyph; }
export function suitColour(suitId) { return (SUIT_BY_ID[suitId] || SUITS[0]).colour; }
export function cardLabel(card) { return card ? rankLabel(card.rank) + suitGlyph(card.suit) : ''; }
export function cardId(rank, suitId) { return rankLabel(rank) + suitId; }

/* ---------- randomness ------------------------------------------------ */

export function secureRandom() {
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const value = new Uint32Array(1);
    crypto.getRandomValues(value);
    return value[0] / 4294967296;
  }
  return Math.random();
}

export function createDeck() {
  const deck = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({
        id: rankLabel(rank) + suit.id,
        rank,
        suit: suit.id,
        label: rankLabel(rank)
      });
    }
  }
  return deck;
}

export function shuffle(deck, random = secureRandom) {
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.max(0, Math.min(i, Math.floor(random() * (i + 1))));
    const card = deck[i];
    deck[i] = deck[j];
    deck[j] = card;
  }
  return deck;
}

/* ---------- evaluation ------------------------------------------------ */

function compareDesc(a, b) { return b - a; }

function findStraightHigh(rankSet) {
  for (let high = 14; high >= 6; high--) {
    let ok = true;
    for (let i = 0; i < 5; i++) {
      if (!rankSet.has(high - i)) { ok = false; break; }
    }
    if (ok) return high;
  }
  if (rankSet.has(14) && rankSet.has(5) && rankSet.has(4) && rankSet.has(3) && rankSet.has(2)) return 5;
  return 0;
}

function straightCards(cards, high, suitId) {
  const ranks = high === 5 ? [5, 4, 3, 2, 14] : [high, high - 1, high - 2, high - 3, high - 4];
  const out = [];
  for (const rank of ranks) {
    const card = cards.find((c) => c.rank === rank && (!suitId || c.suit === suitId));
    if (card) out.push(card);
  }
  return out;
}

function groupCards(cards) {
  const map = new Map();
  for (const card of cards) {
    if (!map.has(card.rank)) map.set(card.rank, []);
    map.get(card.rank).push(card);
  }
  return [...map.entries()]
    .map(([rank, list]) => ({ rank, cards: list.sort((a, b) => a.suit.localeCompare(b.suit)) }))
    .sort((a, b) => b.cards.length - a.cards.length || b.rank - a.rank);
}

function finish(category, tiebreak, cards, detail) {
  const score = [category, ...tiebreak];
  const best = cards.slice(0, 5);
  return {
    category,
    categoryName: CATEGORY_NAMES[category],
    score,
    cards: best,
    name: handName(score, detail || {})
  };
}

/**
 * Evaluate any five to seven cards and return the best five-card hand.
 * { category, categoryName, score, cards, name }
 */
export function evaluateCards(cards) {
  if (!cards || cards.length < 5 || cards.length > 7) return null;

  const all = cards.slice();
  const rankSet = new Set(all.map((c) => c.rank));
  const groups = groupCards(all);
  const bySuit = new Map();
  for (const card of all) {
    if (!bySuit.has(card.suit)) bySuit.set(card.suit, []);
    bySuit.get(card.suit).push(card);
  }

  // Straight flush
  let bestStraightFlush = 0;
  let bestStraightFlushSuit = null;
  for (const [suitId, suited] of bySuit) {
    if (suited.length < 5) continue;
    const suitedRanks = new Set(suited.map((c) => c.rank));
    const high = findStraightHigh(suitedRanks);
    if (high > bestStraightFlush) { bestStraightFlush = high; bestStraightFlushSuit = suitId; }
  }
  if (bestStraightFlush) {
    const suited = all.filter((c) => c.suit === bestStraightFlushSuit).sort((a, b) => b.rank - a.rank);
    return finish(8, [bestStraightFlush], straightCards(suited, bestStraightFlush, bestStraightFlushSuit), { high: bestStraightFlush });
  }

  // Four of a kind
  const quad = groups.find((g) => g.cards.length === 4);
  if (quad) {
    const kicker = all.filter((c) => c.rank !== quad.rank).sort((a, b) => b.rank - a.rank)[0];
    return finish(7, [quad.rank, kicker.rank], [...quad.cards, kicker], { quad: quad.rank });
  }

  // Full house
  const trips = groups.filter((g) => g.cards.length >= 3).sort((a, b) => b.rank - a.rank);
  if (trips.length) {
    const trip = trips[0];
    const pair = groups.filter((g) => g.cards.length >= 2 && g.rank !== trip.rank).sort((a, b) => b.rank - a.rank)[0];
    if (pair) {
      return finish(6, [trip.rank, pair.rank], [...trip.cards.slice(0, 3), ...pair.cards.slice(0, 2)], { full: trip.rank, pair: pair.rank });
    }
  }

  // Flush
  for (const suited of bySuit.values()) {
    if (suited.length >= 5) {
      const best = suited.slice().sort((a, b) => b.rank - a.rank).slice(0, 5);
      return finish(5, best.map((c) => c.rank), best, { high: best[0].rank });
    }
  }

  // Straight
  const straightHigh = findStraightHigh(rankSet);
  if (straightHigh) {
    return finish(4, [straightHigh], straightCards(all, straightHigh), { high: straightHigh });
  }

  // Three of a kind
  if (trips.length) {
    const trip = trips[0];
    const kickers = all.filter((c) => c.rank !== trip.rank).sort((a, b) => b.rank - a.rank).slice(0, 2);
    return finish(3, [trip.rank, ...kickers.map((c) => c.rank)], [...trip.cards.slice(0, 3), ...kickers], { trip: trip.rank });
  }

  // Two pair
  const pairs = groups.filter((g) => g.cards.length === 2).sort((a, b) => b.rank - a.rank);
  if (pairs.length >= 2) {
    const highPair = pairs[0];
    const lowPair = pairs[1];
    const kicker = all
      .filter((c) => c.rank !== highPair.rank && c.rank !== lowPair.rank)
      .sort((a, b) => b.rank - a.rank)[0];
    return finish(2, [highPair.rank, lowPair.rank, kicker.rank], [...highPair.cards, ...lowPair.cards, kicker], { highPair: highPair.rank, lowPair: lowPair.rank });
  }

  // One pair
  if (pairs.length === 1) {
    const pair = pairs[0];
    const kickers = all.filter((c) => c.rank !== pair.rank).sort((a, b) => b.rank - a.rank).slice(0, 3);
    return finish(1, [pair.rank, ...kickers.map((c) => c.rank)], [...pair.cards, ...kickers], { pair: pair.rank });
  }

  // High card
  const high = all.slice().sort((a, b) => b.rank - a.rank).slice(0, 5);
  return finish(0, high.map((c) => c.rank), high, { high: high[0].rank });
}

export function compareScores(a, b) {
  const length = Math.max(a.length, b.length);
  for (let i = 0; i < length; i++) {
    const av = a[i] || 0;
    const bv = b[i] || 0;
    if (av !== bv) return av > bv ? 1 : -1;
  }
  return 0;
}

export function compareHands(a, b) {
  if (!a && !b) return 0;
  if (!a) return -1;
  if (!b) return 1;
  return compareScores(a.score, b.score);
}

function handName(score, detail) {
  const category = score[0];
  switch (category) {
    case 8:
      return score[1] === 14 ? 'Royal Flush' : `${rankName(score[1])}-High Straight Flush`;
    case 7:
      return `Four of a Kind, ${rankPlural(score[1])}`;
    case 6:
      return `${rankPlural(score[1])} Full of ${rankPlural(score[2])}`;
    case 5:
      return `${rankName(score[1])}-High Flush`;
    case 4:
      return `${rankName(score[1])}-High Straight`;
    case 3:
      return `Three of a Kind, ${rankPlural(score[1])}`;
    case 2:
      return `Two Pair, ${rankPlural(score[1])} & ${rankPlural(score[2])}`;
    case 1:
      return `Pair of ${rankPlural(score[1])}`;
    default:
      return `${rankName(score[1] || detail.high || 0)} High`;
  }
}

/* A compact player-facing read of two hole cards. */
export function describeHole(hole) {
  if (!hole || hole.length !== 2) return '';
  const [a, b] = hole.slice().sort((x, y) => y.rank - x.rank);
  if (a.rank === b.rank) return `Pocket ${rankPlural(a.rank)}`;
  return `${rankName(a.rank)}-${rankName(b.rank)}${a.suit === b.suit ? ' suited' : ' offsuit'}`;
}

export const HAND_RANKINGS = [
  { title: 'Royal Flush', example: 'A♠ K♠ Q♠ J♠ 10♠', note: 'The ace-high straight flush. The rarest hand in the game.' },
  { title: 'Straight Flush', example: '9♥ 8♥ 7♥ 6♥ 5♥', note: 'Five cards in sequence, all of the same suit.' },
  { title: 'Four of a Kind', example: 'K♣ K♦ K♥ K♠ 7♠', note: 'All four cards of the same rank.' },
  { title: 'Full House', example: 'Q♠ Q♥ Q♦ 8♣ 8♥', note: 'Three of a kind plus a pair.' },
  { title: 'Flush', example: 'A♦ J♦ 8♦ 5♦ 2♦', note: 'Five cards of the same suit, any order.' },
  { title: 'Straight', example: '10♠ 9♥ 8♦ 7♣ 6♠', note: 'Five cards in sequence, mixed suits.' },
  { title: 'Three of a Kind', example: '7♠ 7♥ 7♦ K♣ 4♠', note: 'Three cards of one rank.' },
  { title: 'Two Pair', example: 'J♠ J♥ 5♦ 5♣ A♠', note: 'Two different pairs.' },
  { title: 'One Pair', example: 'A♠ A♦ K♥ 9♣ 3♠', note: 'Two cards of one rank.' },
  { title: 'High Card', example: 'A♠ Q♦ 9♥ 6♣ 3♠', note: 'Nothing better — the highest card decides.' }
];
