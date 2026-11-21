/* =====================================================================
   games-core.js — shared drawing helpers + the microgame contract
   Every game is a factory: make(api) -> { update, draw, pointer, key, score }
   api.done(rawScore) ends the round early; higher score is always better.
   ===================================================================== */

export const W = 960;
export const H = 540;
export const TAU = Math.PI * 2;

export const COLORS = {
  bg: '#06040e',
  ink: '#0b0818',
  cyan: '#3df3ff',
  magenta: '#ff2f9c',
  violet: '#8b5cff',
  lime: '#b9ff42',
  amber: '#ffb020',
  red: '#ff3b5c',
  gold: '#ffd35c',
  white: '#f4f2ff',
  dim: '#5a5480'
};

export function head(ctx, size) { ctx.font = `800 ${size}px "Big Shoulders", "Arial Narrow", Impact, sans-serif`; }
export function mono(ctx, size) { ctx.font = `700 ${size}px ui-monospace, Menlo, Consolas, monospace`; }

export function text(ctx, str, x, y, size, color, align = 'center', useMono = false) {
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  if (useMono) mono(ctx, size); else head(ctx, size);
  ctx.fillStyle = color;
  ctx.fillText(str, x, y);
}

export function rr(ctx, x, y, w, h, r = 0) {
  ctx.beginPath();
  if (r <= 0) { ctx.rect(x, y, w, h); return; }
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function glowRect(ctx, x, y, w, h, color, blur = 18, fill = null) {
  ctx.save();
  ctx.shadowColor = color;
  ctx.shadowBlur = blur;
  ctx.fillStyle = fill || color;
  rr(ctx, x, y, w, h, 2);
  ctx.fill();
  ctx.restore();
}

export function grid(ctx, step = 40, color = 'rgba(139,92,255,0.10)') {
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = 0; x <= W; x += step) { ctx.moveTo(x, 0); ctx.lineTo(x, H); }
  for (let y = 0; y <= H; y += step) { ctx.moveTo(0, y); ctx.lineTo(W, y); }
  ctx.stroke();
}

export function vignette(ctx) {
  const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, H * 0.85);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, 'rgba(0,0,0,0.55)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
}

export function clear(ctx, color = COLORS.bg) {
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, W, H);
}

export function shuffle(arr, rng = Math.random) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = (rng() * (i + 1)) | 0;
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function inRect(px, py, x, y, w, h) {
  return px >= x && py >= y && px <= x + w && py <= y + h;
}

export function dist(ax, ay, bx, by) { return Math.hypot(ax - bx, ay - by); }

/* A run of numbered pads used by a few games */
export function pad(ctx, x, y, w, h, color, lit) {
  ctx.save();
  if (lit) { ctx.shadowColor = color; ctx.shadowBlur = 26; }
  ctx.fillStyle = lit ? color : 'rgba(255,255,255,0.05)';
  rr(ctx, x, y, w, h, 3);
  ctx.fill();
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.globalAlpha = lit ? 1 : 0.5;
  rr(ctx, x, y, w, h, 3);
  ctx.stroke();
  ctx.restore();
}
