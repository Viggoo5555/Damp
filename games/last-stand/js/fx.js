/* =====================================================================
   fx.js — sound, particles, toasts, screen shake, cabinet background
   All audio is synthesised at runtime, so there are no sample files to
   license or download.
   ===================================================================== */

export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const rand = (a = 1, b = 0) => b + Math.random() * (a - b);
export const pick = (arr) => arr[(Math.random() * arr.length) | 0];
export const fmt = (n) => (n >= 10000 ? (n / 1000).toFixed(1) + 'k' : String(Math.round(n)));
export const pad2 = (n) => String(n).padStart(2, '0');
export function hashStr(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
export const todayKey = () => new Date().toISOString().slice(0, 10);
export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
export function el(tag, cls, html) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (html != null) n.innerHTML = html;
  return n;
}

/* ------------------------------------------------------------------ audio */
const S = { music: 0.5, sfx: 0.7, muted: false };

export const audio = {
  ctx: null,
  master: null,
  musicGain: null,
  sfxGain: null,
  started: false,
  step: 0,
  nextAt: 0,
  timer: 0,

  init() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.9;
    this.master.connect(this.ctx.destination);
    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.value = S.music * 0.32;
    this.musicGain.connect(this.master);
    this.sfxGain = this.ctx.createGain();
    this.sfxGain.gain.value = S.sfx * 0.8;
    this.sfxGain.connect(this.master);
  },
  resume() {
    this.init();
    if (!this.ctx) return;
    if (this.ctx.state === 'suspended') this.ctx.resume();
    if (!this.started) { this.started = true; this.startMusic(); }
  },
  setVolumes(music, sfx, muted) {
    S.music = music; S.sfx = sfx; S.muted = !!muted;
    if (!this.ctx) return;
    this.musicGain.gain.value = S.muted ? 0 : S.music * 0.32;
    this.sfxGain.gain.value = S.muted ? 0 : S.sfx * 0.8;
  },

  /* one short synthesised voice */
  tone({ freq = 440, freq2 = null, dur = 0.12, type = 'square', vol = 0.3, delay = 0, bend = 0, when = 0 }) {
    if (!this.ctx || S.muted) return;
    const t0 = when || this.ctx.currentTime + delay;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    if (freq2) o.frequency.exponentialRampToValueAtTime(Math.max(24, freq2), t0 + dur * (1 - bend));
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), t0 + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(this.sfxGain);
    o.start(t0); o.stop(t0 + dur + 0.02);
  },
  noise({ dur = 0.2, vol = 0.25, delay = 0, hp = 600 }) {
    if (!this.ctx || S.muted) return;
    const t0 = this.ctx.currentTime + delay;
    const len = Math.ceil(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const f = this.ctx.createBiquadFilter();
    f.type = 'highpass'; f.frequency.value = hp;
    const g = this.ctx.createGain();
    g.gain.value = vol;
    src.connect(f); f.connect(g); g.connect(this.sfxGain);
    src.start(t0);
  },

  click() { this.tone({ freq: 520, freq2: 380, dur: 0.06, type: 'square', vol: 0.16 }); },
  hover() { this.tone({ freq: 900, dur: 0.03, type: 'sine', vol: 0.05 }); },
  ok() { this.tone({ freq: 660, dur: 0.09, type: 'square', vol: 0.22 }); this.tone({ freq: 990, dur: 0.12, type: 'square', vol: 0.18, delay: 0.07 }); },
  perfect() { [784, 1046, 1318].forEach((f, i) => this.tone({ freq: f, dur: 0.13, type: 'triangle', vol: 0.2, delay: i * 0.06 })); },
  bad() { this.tone({ freq: 200, freq2: 90, dur: 0.26, type: 'sawtooth', vol: 0.2 }); this.noise({ dur: 0.14, vol: 0.1, hp: 300 }); },
  tick() { this.tone({ freq: 880, dur: 0.05, type: 'square', vol: 0.14 }); },
  go() { this.tone({ freq: 520, freq2: 1040, dur: 0.22, type: 'square', vol: 0.26 }); },
  join() { this.tone({ freq: 440, dur: 0.08, type: 'triangle', vol: 0.16 }); this.tone({ freq: 660, dur: 0.1, type: 'triangle', vol: 0.14, delay: 0.07 }); },
  leave() { this.tone({ freq: 400, freq2: 200, dur: 0.18, type: 'triangle', vol: 0.14 }); },
  elim() { this.tone({ freq: 300, freq2: 60, dur: 0.5, type: 'sawtooth', vol: 0.24 }); this.noise({ dur: 0.4, vol: 0.16, hp: 200 }); },
  coin() { this.tone({ freq: 1200, dur: 0.06, type: 'square', vol: 0.16 }); this.tone({ freq: 1800, dur: 0.1, type: 'square', vol: 0.14, delay: 0.05 }); },
  win() { [523, 659, 784, 1046, 1318].forEach((f, i) => this.tone({ freq: f, dur: 0.24, type: 'triangle', vol: 0.22, delay: i * 0.1 })); },
  level() { [660, 880, 1100, 1320, 1760].forEach((f, i) => this.tone({ freq: f, dur: 0.18, type: 'square', vol: 0.18, delay: i * 0.07 })); },
  hit() { this.tone({ freq: 300, dur: 0.05, type: 'square', vol: 0.12 }); },

  /* procedural arcade loop: bass line + hats, scheduled ahead of time */
  startMusic() {
    if (!this.ctx) return;
    const bpm = 128, beat = 60 / bpm / 2;
    this.nextAt = this.ctx.currentTime + 0.1;
    const bass = [0, 0, 7, 0, 3, 0, 7, 5];
    const root = 55;
    const tickFn = () => {
      if (!this.ctx) return;
      while (this.nextAt < this.ctx.currentTime + 0.4) {
        const i = this.step % 16;
        const t = this.nextAt;
        if (!S.muted && S.music > 0) {
          const semis = bass[i % 8];
          const f = root * Math.pow(2, semis / 12);
          this.musicTone(f, t, beat * 0.9, 'sawtooth', 0.16);
          if (i % 4 === 0) this.musicTone(f / 2, t, beat * 1.6, 'square', 0.12);
          if (i % 2 === 1) this.musicHat(t);
          if (i === 0 || i === 8) this.musicHat(t, 0.05, 0.14);
        }
        this.nextAt += beat;
        this.step++;
      }
      this.timer = setTimeout(tickFn, 120);
    };
    tickFn();
  },
  musicTone(freq, at, dur, type, vol) {
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.value = 1400; f.Q.value = 6;
    o.type = type; o.frequency.setValueAtTime(freq, at);
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(vol, at + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    o.connect(f); f.connect(g); g.connect(this.musicGain);
    o.start(at); o.stop(at + dur + 0.02);
  },
  musicHat(at, vol = 0.03, freq = 7000) {
    const len = 900;
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 2;
    const src = this.ctx.createBufferSource(); src.buffer = buf;
    const f = this.ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = freq;
    const g = this.ctx.createGain(); g.gain.value = vol;
    src.connect(f); f.connect(g); g.connect(this.musicGain);
    src.start(at);
  }
};

/* ----------------------------------------------------------------- toasts */
export function toast(text, kind = '', ms = 2600) {
  const root = $('#toasts');
  if (!root) return;
  const t = el('div', 'toast ' + kind, text);
  root.appendChild(t);
  setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 320); }, ms);
}

/* --------------------------------------------------------------- shake/fx */
let shakeAmount = 0;
let shakeOn = true;
export function shake(n = 6) {
  if (!shakeOn) return;
  shakeAmount = Math.min(18, Math.max(shakeAmount, n));
}
export function setShake(on) { shakeOn = !!on; }

export function burst(x, y, color = '#3df3ff', count = 14, power = 1) {
  const layer = $('#fx-layer');
  if (!layer) return;
  if (document.body.classList.contains('reduced-motion')) count = Math.min(6, count);
  for (let i = 0; i < count; i++) {
    const p = el('div', 'px');
    p.style.background = color;
    p.style.left = x + 'px';
    p.style.top = y + 'px';
    const ang = Math.random() * Math.PI * 2;
    const sp = (0.6 + Math.random() * 2.4) * power;
    const dx = Math.cos(ang) * sp * 34;
    const dy = Math.sin(ang) * sp * 34;
    p.style.transition = `transform ${420 + Math.random() * 380}ms cubic-bezier(.2,.7,.4,1), opacity 700ms ease`;
    layer.appendChild(p);
    requestAnimationFrame(() => {
      p.style.transform = `translate(${dx}px, ${dy + 26}px) scale(${Math.random() > 0.5 ? 1 : 0.5})`;
      p.style.opacity = '0';
    });
    setTimeout(() => p.remove(), 900);
  }
}

export function confetti(colors = ['#3df3ff', '#ff2f9c', '#b9ff42', '#ffd35c', '#8b5cff']) {
  const w = window.innerWidth;
  for (let i = 0; i < 90; i++) {
    setTimeout(() => burst(rand(w), rand(window.innerHeight * 0.5, 0), pick(colors), 3, 1.4), i * 22);
  }
}

export function levelBurst(level) {
  const wrap = el('div', 'lvl-burst', `<b>LEVEL ${level}</b><span>RANK UP</span>`);
  document.body.appendChild(wrap);
  setTimeout(() => wrap.remove(), 1500);
}

/* --------------------------------------------------------- background art */
export function startWall() {
  const cv = $('#wall-canvas');
  if (!cv) return;
  const ctx = cv.getContext('2d');
  let W = 0, H = 0, dpr = Math.min(2, window.devicePixelRatio || 1);
  const stars = [];
  const blocks = [];
  const resize = () => {
    W = cv.clientWidth; H = cv.clientHeight;
    cv.width = Math.floor(W * dpr); cv.height = Math.floor(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    stars.length = 0;
    for (let i = 0; i < 90; i++) stars.push({ x: Math.random() * W, y: Math.random() * H, z: Math.random() * 0.8 + 0.2, s: Math.random() > 0.86 ? 2 : 1 });
    blocks.length = 0;
    for (let i = 0; i < 16; i++) {
      blocks.push({
        x: Math.random() * W, y: Math.random() * H,
        w: 8 + Math.random() * 26, h: 3 + Math.random() * 6,
        v: 6 + Math.random() * 20, c: Math.random() > 0.5 ? 'rgba(61,243,255,0.20)' : 'rgba(255,47,156,0.16)'
      });
    }
  };
  resize();
  window.addEventListener('resize', resize);
  const reduced = () => document.body.classList.contains('reduced-motion');
  let t = 0;
  const loop = () => {
    t += 0.016;
    ctx.clearRect(0, 0, W, H);
    // neon horizon
    const hy = H * 0.72;
    const g = ctx.createLinearGradient(0, hy - 160, 0, hy + 4);
    g.addColorStop(0, 'rgba(255,47,156,0)');
    g.addColorStop(0.7, 'rgba(255,47,156,0.10)');
    g.addColorStop(1, 'rgba(61,243,255,0.16)');
    ctx.fillStyle = g;
    ctx.fillRect(0, hy - 160, W, 164);
    // stars
    for (const s of stars) {
      if (!reduced()) s.y += s.z * 0.16;
      if (s.y > H) { s.y = -4; s.x = Math.random() * W; }
      ctx.fillStyle = s.z > 0.7 ? 'rgba(180,220,255,0.75)' : 'rgba(150,140,220,0.35)';
      ctx.fillRect(s.x | 0, s.y | 0, s.s, s.s);
    }
    // drifting pixel shards
    for (const b of blocks) {
      if (!reduced()) { b.y -= b.v * 0.016; if (b.y < -12) { b.y = H + 10; b.x = Math.random() * W; } }
      ctx.fillStyle = b.c;
      ctx.fillRect(b.x | 0, b.y | 0, b.w, b.h);
    }
    // sun stripes
    const cx = W * 0.5, cy = hy - 40, R = Math.min(W, H) * 0.3;
    const sg = ctx.createLinearGradient(0, cy - R, 0, cy + R);
    sg.addColorStop(0, 'rgba(255,47,156,0.16)');
    sg.addColorStop(1, 'rgba(61,243,255,0.06)');
    ctx.fillStyle = sg;
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(5,4,12,0.55)';
    for (let i = 0; i < 9; i++) {
      const yy = cy + R * 0.08 + i * (R * 0.1);
      ctx.fillRect(cx - R, yy, R * 2, 3 + i * 0.9);
    }
    requestAnimationFrame(loop);
  };
  loop();

  // keep the shake transform on the whole cabinet
  const cab = $('#cabinet');
  const shakeLoop = () => {
    if (shakeAmount > 0.1) {
      shakeAmount *= 0.86;
      const x = (Math.random() * 2 - 1) * shakeAmount;
      const y = (Math.random() * 2 - 1) * shakeAmount;
      if (cab) cab.style.transform = `translate(${x.toFixed(2)}px, ${y.toFixed(2)}px)`;
    } else if (cab && cab.style.transform) {
      cab.style.transform = '';
      shakeAmount = 0;
    }
    requestAnimationFrame(shakeLoop);
  };
  shakeLoop();
}

/* small pixel avatar drawn deterministically from the player's name */
export function drawAvatar(canvas, seedStr, color) {
  const ctx = canvas.getContext('2d');
  const N = 9, S = 4;
  canvas.width = N * S; canvas.height = N * S;
  ctx.imageSmoothingEnabled = false;
  const tint = color || '#3df3ff';
  const h = hashStr(seedStr || 'x');
  ctx.fillStyle = '#120e24';
  ctx.fillRect(0, 0, N * S, N * S);
  // helmet / hair cap
  ctx.fillStyle = tint;
  ctx.globalAlpha = 0.85;
  ctx.fillRect(2 * S, 1 * S, 5 * S, 2 * S);
  ctx.fillRect(1 * S, 2 * S, 7 * S, 1 * S);
  ctx.globalAlpha = 1;
  // face
  ctx.fillStyle = '#f0d6c4';
  ctx.fillRect(2 * S, 3 * S, 5 * S, 4 * S);
  ctx.fillRect(1 * S, 4 * S, 1 * S, 2 * S);
  ctx.fillRect(7 * S, 4 * S, 1 * S, 2 * S);
  // eyes
  ctx.fillStyle = '#131022';
  const eyeShift = (h & 1) ? 1 : 0;
  ctx.fillRect((2 + eyeShift) * S, 4 * S, S, S);
  ctx.fillRect((6 - eyeShift) * S, 4 * S, S, S);
  // brows / mask stripe from the seed
  ctx.fillStyle = tint;
  ctx.globalAlpha = 0.9;
  if ((h >> 3) & 1) ctx.fillRect(2 * S, 3 * S, 5 * S, S);
  // mouth
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#8a5a68';
  const mouth = (h >> 5) % 3;
  if (mouth === 0) ctx.fillRect(4 * S, 6 * S, S, S);
  else if (mouth === 1) ctx.fillRect(3 * S, 6 * S, 3 * S, S);
  else { ctx.fillRect(3 * S, 6 * S, S, S); ctx.fillRect(5 * S, 6 * S, S, S); }
  // chin shade
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.fillRect(2 * S, 7 * S, 5 * S, S);
}

