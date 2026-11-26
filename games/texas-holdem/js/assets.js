/* =====================================================================
   TEXAS HOLD'EM — procedural art
   Every texture in the room is painted here on a canvas.
   ===================================================================== */

import * as THREE from 'three';
import { rankLabel, suitGlyph, suitColour, SUITS } from './cards.js';

let maxAnisotropy = 4;
export function setAnisotropy(value) { maxAnisotropy = Math.max(1, Math.min(16, value || 4)); }

function canvas2d(width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return { canvas, ctx: canvas.getContext('2d') };
}

function toTexture(canvas, options = {}) {
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = maxAnisotropy;
  if (options.repeat) {
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(options.repeat[0], options.repeat[1]);
  }
  texture.needsUpdate = true;
  return texture;
}

function grain(ctx, width, height, amount, alpha, light = false) {
  const count = Math.floor(width * height * amount);
  for (let i = 0; i < count; i++) {
    const x = Math.random() * width;
    const y = Math.random() * height;
    const value = light ? 255 : 0;
    ctx.fillStyle = `rgba(${value},${value},${value},${Math.random() * alpha})`;
    ctx.fillRect(x, y, 1, 1);
  }
}

function roundedPath(ctx, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

/* ---------- room surfaces -------------------------------------------- */

export function makeWoodTexture(options = {}) {
  const width = 512;
  const height = 512;
  const { canvas, ctx } = canvas2d(width, height);
  const base = options.base || '#362318';
  const grainColour = options.grain || '#1d110a';
  const highlight = options.highlight || '#523725';
  const vertical = options.vertical !== false;
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, width, height);

  const gradient = ctx.createLinearGradient(0, 0, vertical ? 0 : width, vertical ? height : 0);
  gradient.addColorStop(0, 'rgba(255,255,255,0.04)');
  gradient.addColorStop(0.5, 'rgba(255,255,255,0)');
  gradient.addColorStop(1, 'rgba(0,0,0,0.12)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  for (let i = 0; i < 90; i++) {
    const offset = Math.random() * (vertical ? width : height);
    const thickness = 0.6 + Math.random() * 2.4;
    ctx.strokeStyle = i % 4 === 0 ? highlight : grainColour;
    ctx.globalAlpha = 0.12 + Math.random() * 0.22;
    ctx.lineWidth = thickness;
    ctx.beginPath();
    if (vertical) {
      ctx.moveTo(offset, 0);
      for (let y = 0; y <= height; y += 28) {
        ctx.lineTo(offset + Math.sin(y * 0.012 + i) * 4 + (Math.random() - 0.5) * 2, y);
      }
    } else {
      ctx.moveTo(0, offset);
      for (let x = 0; x <= width; x += 28) {
        ctx.lineTo(x, offset + Math.sin(x * 0.012 + i) * 4 + (Math.random() - 0.5) * 2);
      }
    }
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  for (let knot = 0; knot < 5; knot++) {
    const x = Math.random() * width;
    const y = Math.random() * height;
    const radius = 8 + Math.random() * 22;
    const knotGradient = ctx.createRadialGradient(x, y, 1, x, y, radius);
    knotGradient.addColorStop(0, 'rgba(8,4,2,0.55)');
    knotGradient.addColorStop(0.45, 'rgba(30,18,10,0.25)');
    knotGradient.addColorStop(1, 'rgba(30,18,10,0)');
    ctx.fillStyle = knotGradient;
    ctx.beginPath();
    ctx.ellipse(x, y, radius * 0.55, radius, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  grain(ctx, width, height, 0.35, 0.16);
  return toTexture(canvas, { repeat: options.repeat || [1, 1] });
}

export function makeFeltTexture() {
  const size = 1024;
  const { canvas, ctx } = canvas2d(size, size);
  const gradient = ctx.createRadialGradient(size * 0.5, size * 0.42, size * 0.05, size * 0.5, size * 0.5, size * 0.72);
  gradient.addColorStop(0, '#2b6048');
  gradient.addColorStop(0.55, '#1d4a37');
  gradient.addColorStop(1, '#123326');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);

  // fibres
  for (let i = 0; i < 26000; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const shade = Math.random() > 0.5 ? 255 : 0;
    ctx.fillStyle = `rgba(${shade},${shade},${shade},${Math.random() * 0.035})`;
    ctx.fillRect(x, y, 1, 1);
  }
  for (let i = 0; i < 1600; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    ctx.strokeStyle = `rgba(${Math.random() > 0.5 ? '255,255,255' : '0,0,0'},${Math.random() * 0.05})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + (Math.random() - 0.5) * 8, y + (Math.random() - 0.5) * 8);
    ctx.stroke();
  }

  // woven watermark: double oval and a small spade crest
  ctx.save();
  ctx.translate(size / 2, size / 2);
  ctx.strokeStyle = 'rgba(215,181,116,0.13)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.ellipse(0, 0, size * 0.28, size * 0.22, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(215,181,116,0.07)';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.ellipse(0, 0, size * 0.265, size * 0.207, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = 'rgba(215,181,116,0.13)';
  ctx.font = '600 92px Georgia, serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('♠', 0, -14);
  ctx.font = '500 17px Georgia, serif';
  ctx.letterSpacing = '8px';
  ctx.fillText('THE DAMP ROOM', 3, 68);
  ctx.restore();

  // vignette
  const vignette = ctx.createRadialGradient(size / 2, size / 2, size * 0.3, size / 2, size / 2, size * 0.72);
  vignette.addColorStop(0, 'rgba(0,0,0,0)');
  vignette.addColorStop(1, 'rgba(0,0,0,0.22)');
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, size, size);
  return toTexture(canvas);
}

export function makeLeatherTexture(base = '#241a15') {
  const { canvas, ctx } = canvas2d(512, 512);
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 12000; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    const light = Math.random() > 0.55;
    ctx.fillStyle = light ? `rgba(255,240,220,${Math.random() * 0.04})` : `rgba(0,0,0,${Math.random() * 0.07})`;
    ctx.fillRect(x, y, 1 + Math.random() * 1.5, 1 + Math.random());
  }
  for (let i = 0; i < 180; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    ctx.strokeStyle = `rgba(0,0,0,${Math.random() * 0.06})`;
    ctx.beginPath();
    ctx.arc(x, y, 3 + Math.random() * 9, 0, Math.PI * 2);
    ctx.stroke();
  }
  return toTexture(canvas, { repeat: [2, 2] });
}

export function makeRugTexture() {
  const size = 1024;
  const { canvas, ctx } = canvas2d(size, size);
  ctx.fillStyle = '#3a1718';
  ctx.fillRect(0, 0, size, size);
  const border = 44;
  ctx.fillStyle = '#241012';
  ctx.fillRect(border, border, size - border * 2, size - border * 2);
  ctx.strokeStyle = '#a37a48';
  ctx.lineWidth = 3;
  ctx.strokeRect(22, 22, size - 44, size - 44);
  ctx.strokeRect(62, 62, size - 124, size - 124);

  // repeating geometric border
  for (let x = 78; x < size - 78; x += 44) {
    for (const y of [40, size - 40]) {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(Math.PI / 4);
      ctx.fillStyle = '#b08a54';
      ctx.globalAlpha = 0.65;
      ctx.fillRect(-7, -7, 14, 14);
      ctx.globalAlpha = 1;
      ctx.restore();
    }
  }
  for (let y = 78; y < size - 78; y += 44) {
    for (const x of [40, size - 40]) {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(Math.PI / 4);
      ctx.fillStyle = '#b08a54';
      ctx.globalAlpha = 0.65;
      ctx.fillRect(-7, -7, 14, 14);
      ctx.globalAlpha = 1;
      ctx.restore();
    }
  }

  // field lattice
  ctx.strokeStyle = 'rgba(186,148,92,0.16)';
  ctx.lineWidth = 1.2;
  for (let i = -size; i < size; i += 64) {
    ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i + size, size); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(i + size, 0); ctx.lineTo(i, size); ctx.stroke();
  }

  // central medallion
  ctx.save();
  ctx.translate(size / 2, size / 2);
  for (let ring = 0; ring < 3; ring++) {
    ctx.beginPath();
    ctx.ellipse(0, 0, 250 - ring * 42, 290 - ring * 48, 0, 0, Math.PI * 2);
    ctx.strokeStyle = ['#a37a48', '#6e3d31', '#b08a54'][ring];
    ctx.lineWidth = ring === 1 ? 8 : 3;
    ctx.globalAlpha = 0.75;
    ctx.stroke();
  }
  ctx.globalAlpha = 0.5;
  ctx.fillStyle = '#5d2b28';
  ctx.beginPath();
  ctx.ellipse(0, 0, 190, 225, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 0.75;
  ctx.fillStyle = '#c4a06a';
  ctx.font = '500 150px Georgia, serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('♠', 0, 8);
  ctx.globalAlpha = 0.4;
  ctx.strokeStyle = '#d3b27b';
  for (let petal = 0; petal < 16; petal++) {
    const angle = (petal / 16) * Math.PI * 2;
    ctx.beginPath();
    ctx.ellipse(Math.cos(angle) * 330, Math.sin(angle) * 360, 22, 58, angle, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();

  // aged fade
  const vignette = ctx.createRadialGradient(size / 2, size / 2, 100, size / 2, size / 2, size * 0.75);
  vignette.addColorStop(0, 'rgba(255,220,180,0.03)');
  vignette.addColorStop(0.65, 'rgba(0,0,0,0.06)');
  vignette.addColorStop(1, 'rgba(0,0,0,0.4)');
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, size, size);
  grain(ctx, size, size, 0.25, 0.08);
  return toTexture(canvas);
}

export function makeFabricTexture(base = '#2e1a19') {
  const { canvas, ctx } = canvas2d(256, 256);
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 8000; i++) {
    const light = Math.random() > 0.5;
    ctx.fillStyle = light ? `rgba(255,235,210,${Math.random() * 0.045})` : `rgba(0,0,0,${Math.random() * 0.06})`;
    ctx.fillRect(Math.random() * 256, Math.random() * 256, 1, 1);
  }
  for (let x = 0; x < 256; x += 4) {
    ctx.fillStyle = 'rgba(0,0,0,0.035)';
    ctx.fillRect(x, 0, 1, 256);
  }
  return toTexture(canvas, { repeat: [3, 3] });
}

/* ---------- artwork --------------------------------------------------- */

export function makePaintingTexture(seed = 1) {
  const width = 512;
  const height = 392;
  const { canvas, ctx } = canvas2d(width, height);
  let value = seed * 9301 + 49297;
  const random = () => {
    value = (value * 9301 + 49297) % 233280;
    return value / 233280;
  };
  const sky = ctx.createLinearGradient(0, 0, 0, height);
  sky.addColorStop(0, '#2d3c48');
  sky.addColorStop(0.45, '#7d6a54');
  sky.addColorStop(0.7, '#b08b60');
  sky.addColorStop(1, '#241a16');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, width, height);

  // brooding clouds
  for (let i = 0; i < 26; i++) {
    const x = random() * width;
    const y = random() * height * 0.45;
    const radius = 30 + random() * 90;
    const cloud = ctx.createRadialGradient(x, y, 4, x, y, radius);
    cloud.addColorStop(0, `rgba(238,214,176,${0.08 + random() * 0.15})`);
    cloud.addColorStop(1, 'rgba(30,25,22,0)');
    ctx.fillStyle = cloud;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
  }
  // distant hills
  for (let layer = 0; layer < 3; layer++) {
    ctx.beginPath();
    ctx.moveTo(0, height);
    const baseline = height * (0.55 + layer * 0.11);
    ctx.lineTo(0, baseline);
    for (let x = 0; x <= width; x += 18) {
      ctx.lineTo(x, baseline - Math.sin(x * 0.018 + layer * 2) * (22 + layer * 14) - random() * 9);
    }
    ctx.lineTo(width, height);
    ctx.closePath();
    ctx.fillStyle = ['#4a3b2c', '#32261d', '#1b1411'][layer];
    ctx.fill();
  }
  // a house with one lit window
  ctx.fillStyle = '#17110d';
  ctx.fillRect(width * 0.62, height * 0.58, 52, 42);
  ctx.beginPath();
  ctx.moveTo(width * 0.6, height * 0.58);
  ctx.lineTo(width * 0.65, height * 0.5);
  ctx.lineTo(width * 0.71, height * 0.58);
  ctx.fill();
  ctx.fillStyle = '#e8b964';
  ctx.fillRect(width * 0.65, height * 0.63, 9, 11);

  // varnish and frame shadow
  ctx.fillStyle = 'rgba(28,16,8,0.18)';
  ctx.fillRect(0, 0, width, height);
  for (let i = 0; i < 120; i++) {
    ctx.strokeStyle = `rgba(255,226,180,${random() * 0.035})`;
    ctx.beginPath();
    ctx.moveTo(random() * width, random() * height);
    ctx.lineTo(random() * width, random() * height);
    ctx.stroke();
  }
  grain(ctx, width, height, 0.14, 0.12);
  return toTexture(canvas);
}

export function makeSignTexture(title, subtitle) {
  const width = 768;
  const height = 256;
  const { canvas, ctx } = canvas2d(width, height);
  const gradient = ctx.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, '#18110c');
  gradient.addColorStop(0.5, '#241a12');
  gradient.addColorStop(1, '#100b08');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
  ctx.strokeStyle = '#a17c48';
  ctx.lineWidth = 2;
  ctx.strokeRect(16, 16, width - 32, height - 32);
  ctx.strokeStyle = 'rgba(161,124,72,0.35)';
  ctx.lineWidth = 1;
  ctx.strokeRect(27, 27, width - 54, height - 54);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const gold = ctx.createLinearGradient(0, 80, 0, 150);
  gold.addColorStop(0, '#f1dcae');
  gold.addColorStop(0.45, '#c5a061');
  gold.addColorStop(1, '#87683a');
  ctx.fillStyle = gold;
  ctx.font = '500 72px "Cormorant Garamond", Georgia, serif';
  ctx.letterSpacing = '10px';
  ctx.fillText(title, width / 2 + 5, height * 0.45);
  ctx.font = '400 17px "Schibsted Grotesk", Georgia, serif';
  ctx.letterSpacing = '9px';
  ctx.fillStyle = 'rgba(214,185,135,0.72)';
  ctx.fillText(subtitle, width / 2 + 4, height * 0.72);

  // little diamond flourishes
  ctx.fillStyle = '#a17c48';
  for (const x of [110, width - 110]) {
    ctx.save();
    ctx.translate(x, height / 2);
    ctx.rotate(Math.PI / 4);
    ctx.fillRect(-4, -4, 8, 8);
    ctx.restore();
  }
  grain(ctx, width, height, 0.1, 0.12);
  return toTexture(canvas);
}

export function makeGlowTexture() {
  const size = 128;
  const { canvas, ctx } = canvas2d(size, size);
  const glow = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  glow.addColorStop(0, 'rgba(255,236,196,0.95)');
  glow.addColorStop(0.22, 'rgba(255,206,132,0.5)');
  glow.addColorStop(0.55, 'rgba(255,160,70,0.14)');
  glow.addColorStop(1, 'rgba(255,120,30,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, size, size);
  return toTexture(canvas);
}

export function makeParticleTexture() {
  const size = 64;
  const { canvas, ctx } = canvas2d(size, size);
  const dot = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  dot.addColorStop(0, 'rgba(255,247,226,0.95)');
  dot.addColorStop(0.4, 'rgba(255,226,175,0.35)');
  dot.addColorStop(1, 'rgba(255,200,120,0)');
  ctx.fillStyle = dot;
  ctx.fillRect(0, 0, size, size);
  return toTexture(canvas);
}

export function makeSmokeTexture() {
  const size = 256;
  const { canvas, ctx } = canvas2d(size, size);
  for (let i = 0; i < 22; i++) {
    const x = size / 2 + (Math.random() - 0.5) * size * 0.45;
    const y = size / 2 + (Math.random() - 0.5) * size * 0.45;
    const radius = size * (0.12 + Math.random() * 0.26);
    const puff = ctx.createRadialGradient(x, y, 0, x, y, radius);
    puff.addColorStop(0, `rgba(220,205,190,${0.025 + Math.random() * 0.03})`);
    puff.addColorStop(0.55, 'rgba(200,190,180,0.012)');
    puff.addColorStop(1, 'rgba(180,170,160,0)');
    ctx.fillStyle = puff;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
  }
  return toTexture(canvas);
}

/* ---------- chips ---------------------------------------------------- */

const CHIP_STYLES = {
  25: { base: '#1f5b3b', edge: '#e9e2cf', text: '#f3ead3' },
  100: { base: '#181818', edge: '#d9cdb6', text: '#f0e7d5' },
  500: { base: '#4b2864', edge: '#e4d4b0', text: '#f3e7cb' },
  1000: { base: '#a67c28', edge: '#f0e3c1', text: '#fff6dd' },
  5000: { base: '#6b221d', edge: '#e9d8b7', text: '#f5e6c9' }
};
const chipCache = new Map();

export function chipTextures(denomination) {
  if (chipCache.has(denomination)) return chipCache.get(denomination);
  const style = CHIP_STYLES[denomination] || CHIP_STYLES[100];

  const side = canvas2d(256, 64);
  side.ctx.fillStyle = style.base;
  side.ctx.fillRect(0, 0, 256, 64);
  for (let i = 0; i < 8; i++) {
    side.ctx.fillStyle = style.edge;
    side.ctx.globalAlpha = 0.85;
    side.ctx.fillRect(i * 32, 0, 12, 64);
  }
  side.ctx.globalAlpha = 1;
  side.ctx.fillStyle = 'rgba(0,0,0,0.24)';
  side.ctx.fillRect(0, 0, 256, 4);
  side.ctx.fillRect(0, 60, 256, 4);
  grain(side.ctx, 256, 64, 0.35, 0.14);

  const top = canvas2d(256, 256);
  const ctx = top.ctx;
  ctx.clearRect(0, 0, 256, 256);
  ctx.beginPath();
  ctx.arc(128, 128, 126, 0, Math.PI * 2);
  ctx.fillStyle = style.base;
  ctx.fill();
  ctx.strokeStyle = style.edge;
  ctx.lineWidth = 14;
  ctx.beginPath();
  ctx.arc(128, 128, 112, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(128, 128, 96, 0, Math.PI * 2);
  ctx.stroke();
  // edge spots clipped to the disc
  ctx.save();
  ctx.beginPath(); ctx.arc(128, 128, 126, 0, Math.PI * 2); ctx.clip();
  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2;
    ctx.save();
    ctx.translate(128 + Math.cos(angle) * 124, 128 + Math.sin(angle) * 124);
    ctx.rotate(angle + Math.PI / 2);
    ctx.fillStyle = style.edge;
    ctx.globalAlpha = 0.9;
    ctx.fillRect(-8, -12, 16, 24);
    ctx.restore();
  }
  ctx.restore();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = style.text;
  ctx.font = '600 62px "Schibsted Grotesk", Arial, sans-serif';
  ctx.fillText(denomination >= 1000 ? `${denomination / 1000}K` : String(denomination), 128, 122);
  ctx.font = '500 16px "Schibsted Grotesk", Arial, sans-serif';
  ctx.fillStyle = 'rgba(255,246,226,0.68)';
  ctx.letterSpacing = '4px';
  ctx.fillText('DAMP', 130, 170);
  grain(ctx, 256, 256, 0.25, 0.1);

  const result = { top: toTexture(top.canvas), side: toTexture(side.canvas) };
  chipCache.set(denomination, result);
  return result;
}

export const CHIP_VALUES = [5000, 1000, 500, 100, 25];

/* ---------- cards ---------------------------------------------------- */

const cardFaceCache = new Map();
let backTexture = null;

const PIP_LAYOUTS = {
  2: [[0.5, 0.2], [0.5, 0.8]],
  3: [[0.5, 0.19], [0.5, 0.5], [0.5, 0.81]],
  4: [[0.31, 0.2], [0.69, 0.2], [0.31, 0.8], [0.69, 0.8]],
  5: [[0.31, 0.2], [0.69, 0.2], [0.5, 0.5], [0.31, 0.8], [0.69, 0.8]],
  6: [[0.31, 0.2], [0.69, 0.2], [0.31, 0.5], [0.69, 0.5], [0.31, 0.8], [0.69, 0.8]],
  7: [[0.31, 0.19], [0.69, 0.19], [0.5, 0.34], [0.31, 0.5], [0.69, 0.5], [0.31, 0.81], [0.69, 0.81]],
  8: [[0.31, 0.19], [0.69, 0.19], [0.5, 0.34], [0.31, 0.45], [0.69, 0.45], [0.5, 0.66], [0.31, 0.81], [0.69, 0.81]],
  9: [[0.31, 0.16], [0.69, 0.16], [0.31, 0.37], [0.69, 0.37], [0.5, 0.5], [0.31, 0.64], [0.69, 0.64], [0.31, 0.85], [0.69, 0.85]],
  10: [[0.31, 0.155], [0.69, 0.155], [0.5, 0.27], [0.31, 0.365], [0.69, 0.365], [0.31, 0.635], [0.69, 0.635], [0.5, 0.73], [0.31, 0.845], [0.69, 0.845]]
};

function drawSuit(ctx, glyph, colour, x, y, size) {
  ctx.fillStyle = colour;
  ctx.font = `${size}px Georgia, "Times New Roman", serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(glyph, x, y + size * 0.03);
}

function drawCourt(ctx, width, height, rank, colour) {
  const centreX = width / 2;
  const centreY = height / 2;
  const drawHalf = (flip) => {
    ctx.save();
    ctx.translate(centreX, centreY);
    if (flip) ctx.rotate(Math.PI);
    // robe
    ctx.fillStyle = rank === 12 ? '#7a2630' : rank === 13 ? '#2b3a56' : '#3d4a32';
    ctx.beginPath();
    ctx.moveTo(-66, 128);
    ctx.quadraticCurveTo(-52, 28, -26, 22);
    ctx.lineTo(26, 22);
    ctx.quadraticCurveTo(52, 28, 66, 128);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(211,183,130,0.62)';
    ctx.lineWidth = 2;
    ctx.stroke();
    // gold trim
    ctx.strokeStyle = 'rgba(220,192,140,0.5)';
    ctx.beginPath();
    ctx.moveTo(-34, 34);
    ctx.quadraticCurveTo(0, 58, 34, 34);
    ctx.stroke();
    // collar
    ctx.fillStyle = '#e6d9bc';
    ctx.beginPath();
    ctx.moveTo(-17, 24);
    ctx.lineTo(0, 48);
    ctx.lineTo(17, 24);
    ctx.closePath();
    ctx.fill();
    // face
    ctx.fillStyle = '#c9a27b';
    ctx.beginPath();
    ctx.ellipse(0, -22, 29, 34, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(30,18,12,0.8)';
    ctx.beginPath();
    ctx.ellipse(-10, -26, 3, 2.2, 0, 0, Math.PI * 2);
    ctx.ellipse(10, -26, 3, 2.2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(60,32,22,0.55)';
    ctx.beginPath();
    ctx.arc(0, -13, 8, 0.15 * Math.PI, 0.85 * Math.PI);
    ctx.stroke();
    // hair or beard
    if (rank === 13) {
      ctx.fillStyle = '#d8d0bc';
      ctx.beginPath();
      ctx.ellipse(0, -5, 22, 16, 0, 0, Math.PI);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(0, -38, 27, Math.PI, Math.PI * 2);
      ctx.fill();
    } else if (rank === 12) {
      ctx.fillStyle = '#5a2a20';
      ctx.beginPath();
      ctx.arc(0, -30, 31, Math.PI, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(-30, -12, 9, 25, -0.25, 0, Math.PI * 2);
      ctx.ellipse(30, -12, 9, 25, 0.25, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillStyle = '#2a211b';
      ctx.beginPath();
      ctx.arc(0, -36, 28, Math.PI, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(24, -44);
      ctx.quadraticCurveTo(52, -38, 40, -8);
      ctx.quadraticCurveTo(30, -30, 24, -44);
      ctx.fill();
    }
    // crown or cap
    if (rank === 13 || rank === 12) {
      ctx.fillStyle = '#c7a45f';
      ctx.beginPath();
      ctx.moveTo(-24, -50);
      ctx.lineTo(-17, -70);
      ctx.lineTo(-6, -56);
      ctx.lineTo(0, -76);
      ctx.lineTo(7, -56);
      ctx.lineTo(18, -70);
      ctx.lineTo(25, -50);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = 'rgba(255,241,200,0.65)';
      for (const x of [-18, 0, 18]) {
        ctx.beginPath(); ctx.arc(x, -63, 2.4, 0, Math.PI * 2); ctx.fill();
      }
    } else {
      ctx.fillStyle = '#8c6b3f';
      ctx.beginPath();
      ctx.moveTo(-26, -43);
      ctx.quadraticCurveTo(0, -64, 26, -43);
      ctx.lineTo(20, -50);
      ctx.quadraticCurveTo(0, -60, -20, -50);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#d9c08c';
      ctx.beginPath();
      ctx.moveTo(18, -52);
      ctx.quadraticCurveTo(44, -82, 52, -60);
      ctx.stroke();
    }
    // chest badge
    ctx.fillStyle = 'rgba(226,206,166,0.85)';
    ctx.beginPath();
    ctx.arc(0, 74, 17, 0, Math.PI * 2);
    ctx.fill();
    drawSuit(ctx, suitGlyphFromColour(colour), colour, 0, 75, 25);
    ctx.restore();
  };
  drawHalf(false);
  drawHalf(true);
  // centre ornament
  ctx.strokeStyle = 'rgba(157,119,69,0.65)';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(width * 0.18, height / 2);
  ctx.lineTo(width * 0.82, height / 2);
  ctx.stroke();
  ctx.fillStyle = '#b38e55';
  ctx.save();
  ctx.translate(width / 2, height / 2);
  ctx.rotate(Math.PI / 4);
  ctx.fillRect(-4, -4, 8, 8);
  ctx.restore();
}

function suitGlyphFromColour(colour) {
  return colour === '#a8232f' || colour === '#b02b34' ? '♥' : '♠';
}

export function cardFaceTexture(card) {
  if (cardFaceCache.has(card.id)) return cardFaceCache.get(card.id);
  const width = 320;
  const height = 448;
  const { canvas, ctx } = canvas2d(width, height);
  const colour = suitColour(card.suit) === 'red' ? '#a8232f' : '#191816';
  const glyph = suitGlyph(card.suit);

  ctx.clearRect(0, 0, width, height);
  roundedPath(ctx, 4, 4, width - 8, height - 8, 20);
  const paper = ctx.createLinearGradient(0, 0, width, height);
  paper.addColorStop(0, '#fbf7ed');
  paper.addColorStop(0.5, '#f4ecdd');
  paper.addColorStop(1, '#efe5d3');
  ctx.fillStyle = paper;
  ctx.fill();
  ctx.save();
  roundedPath(ctx, 4, 4, width - 8, height - 8, 20);
  ctx.clip();
  grain(ctx, width, height, 0.12, 0.05);
  const sheen = ctx.createLinearGradient(0, 0, width, height);
  sheen.addColorStop(0, 'rgba(255,255,255,0.15)');
  sheen.addColorStop(0.35, 'rgba(255,255,255,0)');
  sheen.addColorStop(1, 'rgba(89,66,38,0.06)');
  ctx.fillStyle = sheen;
  ctx.fillRect(0, 0, width, height);
  ctx.restore();

  roundedPath(ctx, 5.5, 5.5, width - 11, height - 11, 19);
  ctx.strokeStyle = 'rgba(51,43,34,0.25)';
  ctx.lineWidth = 1.4;
  ctx.stroke();
  roundedPath(ctx, 16, 16, width - 32, height - 32, 13);
  ctx.strokeStyle = 'rgba(155,121,72,0.24)';
  ctx.lineWidth = 1;
  ctx.stroke();

  // corner indices
  const drawCorner = (flip) => {
    ctx.save();
    if (flip) {
      ctx.translate(width, height);
      ctx.rotate(Math.PI);
    }
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = colour;
    ctx.font = '600 47px "Cormorant Garamond", Georgia, serif';
    ctx.fillText(rankLabel(card.rank), 40, 56);
    drawSuit(ctx, glyph, colour, 40, 90, 27);
    ctx.restore();
  };
  drawCorner(false);
  drawCorner(true);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  if (card.rank === 14) {
    ctx.save();
    ctx.strokeStyle = 'rgba(160,125,74,0.3)';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.ellipse(width / 2, height / 2, 100, 136, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([2, 5]);
    ctx.beginPath();
    ctx.ellipse(width / 2, height / 2, 113, 149, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
    drawSuit(ctx, glyph, colour, width / 2, height / 2, 136);
  } else if (card.rank >= 11) {
    ctx.save();
    roundedPath(ctx, 62, 88, width - 124, height - 176, 12);
    ctx.strokeStyle = 'rgba(160,125,74,0.3)';
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.restore();
    drawCourt(ctx, width, height, card.rank, colour);
  } else {
    const layout = PIP_LAYOUTS[card.rank] || [];
    const size = card.rank === 10 ? 37 : card.rank >= 7 ? 39 : 44;
    for (const [px, py] of layout) {
      const x = 82 + px * 156;
      const y = 82 + py * 288;
      ctx.save();
      ctx.translate(x, y);
      if (py > 0.52) ctx.rotate(Math.PI);
      drawSuit(ctx, glyph, colour, 0, 0, size);
      ctx.restore();
    }
    // a faint suit watermark behind the pips
    ctx.save();
    ctx.globalAlpha = 0.035;
    drawSuit(ctx, glyph, colour, width / 2, height / 2, 200);
    ctx.restore();
  }

  ctx.fillStyle = 'rgba(121,94,55,0.6)';
  ctx.font = '500 7px "Schibsted Grotesk", Arial, sans-serif';
  ctx.letterSpacing = '4px';
  ctx.textAlign = 'center';
  ctx.fillText('DAMP', width / 2 + 2, height - 25);

  const texture = toTexture(canvas);
  cardFaceCache.set(card.id, texture);
  return texture;
}

export function cardBackTexture() {
  if (backTexture) return backTexture;
  const width = 320;
  const height = 448;
  const { canvas, ctx } = canvas2d(width, height);
  ctx.clearRect(0, 0, width, height);
  roundedPath(ctx, 4, 4, width - 8, height - 8, 20);
  const burgundy = ctx.createLinearGradient(0, 0, width, height);
  burgundy.addColorStop(0, '#671d23');
  burgundy.addColorStop(0.55, '#4d1319');
  burgundy.addColorStop(1, '#390e13');
  ctx.fillStyle = burgundy;
  ctx.fill();
  ctx.save();
  roundedPath(ctx, 4, 4, width - 8, height - 8, 20);
  ctx.clip();
  ctx.strokeStyle = 'rgba(203,168,105,0.3)';
  ctx.lineWidth = 1;
  for (let i = -height; i < width + height; i += 26) {
    ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i + height, height); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(i + height, 0); ctx.lineTo(i, height); ctx.stroke();
  }
  ctx.fillStyle = 'rgba(203,168,105,0.3)';
  for (let x = 24; x < width; x += 52) {
    for (let y = 24; y < height; y += 52) {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(Math.PI / 4);
      ctx.fillRect(-2, -2, 4, 4);
      ctx.restore();
    }
  }
  ctx.restore();
  roundedPath(ctx, 4, 4, width - 8, height - 8, 20);
  ctx.strokeStyle = 'rgba(219,184,119,0.7)';
  ctx.lineWidth = 2;
  ctx.stroke();
  roundedPath(ctx, 18, 18, width - 36, height - 36, 12);
  ctx.strokeStyle = 'rgba(219,184,119,0.4)';
  ctx.lineWidth = 1.2;
  ctx.stroke();

  ctx.save();
  ctx.translate(width / 2, height / 2);
  ctx.strokeStyle = 'rgba(224,190,128,0.7)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.ellipse(0, 0, 75, 105, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(224,190,128,0.3)';
  ctx.beginPath();
  ctx.ellipse(0, 0, 62, 90, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = 'rgba(229,197,139,0.9)';
  ctx.font = '500 74px Georgia, serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('♠', 0, -14);
  ctx.font = '500 12px "Cormorant Garamond", Georgia, serif';
  ctx.letterSpacing = '4px';
  ctx.fillText('DAMP', 2, 52);
  ctx.font = '400 7px "Schibsted Grotesk", Arial, sans-serif';
  ctx.fillStyle = 'rgba(229,197,139,0.55)';
  ctx.fillText('PRIVATE TABLE', 1, 70);
  ctx.restore();
  grain(ctx, width, height, 0.12, 0.08);
  backTexture = toTexture(canvas);
  return backTexture;
}

export function makePuckTexture(letter) {
  const { canvas, ctx } = canvas2d(256, 256);
  ctx.clearRect(0, 0, 256, 256);
  const disc = ctx.createRadialGradient(100, 90, 20, 128, 128, 128);
  disc.addColorStop(0, '#fbf5e4');
  disc.addColorStop(1, '#d8c9a8');
  ctx.fillStyle = disc;
  ctx.beginPath(); ctx.arc(128, 128, 124, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#8f6d3c';
  ctx.lineWidth = 5;
  ctx.beginPath(); ctx.arc(128, 128, 111, 0, Math.PI * 2); ctx.stroke();
  ctx.strokeStyle = 'rgba(60,44,25,0.3)';
  ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.arc(128, 128, 92, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = '#35281a';
  ctx.font = letter.length > 1 ? '600 64px "Schibsted Grotesk", Arial, sans-serif' : '600 100px "Cormorant Garamond", Georgia, serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(letter, 128, 130);
  grain(ctx, 256, 256, 0.25, 0.08);
  return toTexture(canvas);
}

export function makeTableLogoTexture() {
  const width = 512;
  const height = 512;
  const { canvas, ctx } = canvas2d(width, height);
  ctx.clearRect(0, 0, width, height);
  ctx.strokeStyle = 'rgba(220,188,128,0.18)';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.ellipse(256, 256, 220, 160, 0, 0, Math.PI * 2); ctx.stroke();
  ctx.strokeStyle = 'rgba(220,188,128,0.08)';
  ctx.beginPath(); ctx.ellipse(256, 256, 208, 148, 0, 0, Math.PI * 2); ctx.stroke();
  return toTexture(canvas);
}

export function makeWindowTexture() {
  const { canvas, ctx } = canvas2d(256, 512);
  const sky = ctx.createLinearGradient(0, 0, 0, 512);
  sky.addColorStop(0, '#0b1626');
  sky.addColorStop(0.55, '#122338');
  sky.addColorStop(1, '#060d16');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, 256, 512);
  for (let i = 0; i < 120; i++) {
    const x = Math.random() * 256;
    const y = Math.random() * 400;
    ctx.fillStyle = `rgba(205,222,245,${0.1 + Math.random() * 0.5})`;
    ctx.fillRect(x, y, 1 + Math.random(), 1 + Math.random());
  }
  const moon = ctx.createRadialGradient(180, 100, 8, 180, 100, 90);
  moon.addColorStop(0, 'rgba(202,220,245,0.9)');
  moon.addColorStop(0.15, 'rgba(174,198,230,0.35)');
  moon.addColorStop(1, 'rgba(120,150,190,0)');
  ctx.fillStyle = moon;
  ctx.fillRect(0, 0, 256, 512);
  ctx.fillStyle = 'rgba(170,195,225,0.75)';
  ctx.beginPath(); ctx.arc(180, 100, 18, 0, Math.PI * 2); ctx.fill();
  return toTexture(canvas);
}

export function makeLabelTexture(text, sub, colour = '#d8b97e') {
  const { canvas, ctx } = canvas2d(384, 128);
  ctx.fillStyle = 'rgba(20,15,11,0.92)';
  roundedPath(ctx, 4, 4, 376, 120, 10);
  ctx.fill();
  ctx.strokeStyle = colour;
  ctx.globalAlpha = 0.6;
  ctx.lineWidth = 1.4;
  roundedPath(ctx, 12, 12, 360, 104, 8);
  ctx.stroke();
  ctx.globalAlpha = 1;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = colour;
  ctx.font = '600 42px "Cormorant Garamond", Georgia, serif';
  ctx.fillText(text, 192, 54);
  if (sub) {
    ctx.font = '400 17px "Schibsted Grotesk", Arial, sans-serif';
    ctx.fillStyle = 'rgba(234,218,190,0.7)';
    ctx.letterSpacing = '5px';
    ctx.fillText(sub, 194, 92);
  }
  return toTexture(canvas);
}
