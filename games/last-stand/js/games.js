/* =====================================================================
   games.js — the microgame catalogue
   ===================================================================== */
import { SET_ONE } from './games-set1.js';
import { SET_TWO } from './games-set2.js';

export const GAMES = [...SET_ONE, ...SET_TWO];

export const SKILL_TAG = {
  Reflexes: 'REFLEX', Reaction: 'REACTION', Timing: 'TIMING', Accuracy: 'PRECISION',
  Memory: 'MEMORY', Pattern: 'PATTERN', Speed: 'SPEED', Decision: 'DECISION',
  Movement: 'MOVEMENT', Precision: 'PRECISION', Aim: 'AIM', Perception: 'PERCEPTION'
};

export function gameById(id) {
  return GAMES.find((g) => g.id === id) || null;
}

/* pick n distinct games, preferring ones not used recently */
export function pickGames(n, recent = []) {
  const pool = GAMES.filter((g) => !recent.includes(g.id));
  const source = pool.length >= n ? pool : GAMES.slice();
  const out = [];
  const copy = source.slice();
  while (out.length < n && copy.length) {
    const i = (Math.random() * copy.length) | 0;
    out.push(copy.splice(i, 1)[0]);
  }
  return out;
}

/* How many players drop this round. Fast early cuts, single eliminations late. */
export function eliminationCount(alive) {
  if (alive <= 2) return 1;
  if (alive <= 5) return 1;
  if (alive <= 9) return 2;
  return Math.max(2, Math.ceil(alive * 0.33));
}
