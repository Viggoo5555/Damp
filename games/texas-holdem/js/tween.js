/* Tiny animation queue. Durations are in seconds. */

export const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
export const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
export const easeOutBack = (t) => 1 + 2.2 * Math.pow(t - 1, 3) + 1.2 * Math.pow(t - 1, 2);
export const easeInOutSine = (t) => -(Math.cos(Math.PI * t) - 1) / 2;
export const smootherstep = (t) => t * t * t * (t * (t * 6 - 15) + 10);

const tweens = [];

export function tween(options) {
  const entry = {
    elapsed: -(options.delay || 0),
    duration: Math.max(0.001, options.duration || 0.3),
    ease: options.ease || easeOutCubic,
    onUpdate: options.onUpdate,
    onDone: options.onDone,
    done: false
  };
  tweens.push(entry);
  return entry;
}

export function updateTweens(dt) {
  for (let i = tweens.length - 1; i >= 0; i--) {
    const entry = tweens[i];
    entry.elapsed += dt;
    if (entry.elapsed < 0) continue;
    const raw = Math.min(1, entry.elapsed / entry.duration);
    const eased = entry.ease(raw);
    if (entry.onUpdate) entry.onUpdate(eased, raw);
    if (raw >= 1) {
      tweens.splice(i, 1);
      entry.done = true;
      if (entry.onDone) entry.onDone();
    }
  }
}

export function clearTweens() {
  tweens.length = 0;
}
