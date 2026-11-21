/* =====================================================================
   games-set1.js — reflex / timing / speed tests (nine microgames)
   ===================================================================== */
import {
  W, H, TAU, COLORS, text, rr, grid, clear, vignette, pad, glowRect,
  head, mono, shuffle, dist
} from './games-core.js';

const C = COLORS;

/* ------------------------------------------------------- 1. TARGET FLASH */
const targetFlash = {
  id: 'target-flash', name: 'TARGET FLASH', skill: 'Reflexes', best: 3200,
  brief: 'A target blinks into the grid. Click it the instant it appears.', keys: 'mouse / tap',
  seconds: 14,
  make(api) {
    let round = 0, state = 'wait', t = 0, waitFor = 600, appearAt = 0, tx = 0, ty = 0, r = 62, score = 0, times = [], flash = 0;
    const place = () => {
      tx = 120 + api.rng() * (W - 240);
      ty = 130 + api.rng() * (H - 250);
      r = 58 - round * 4;
    };
    const nextWait = () => { state = 'wait'; waitFor = 260 + api.rng() * 900; t = 0; place(); };
    const showTarget = () => { state = 'live'; appearAt = performance.now(); api.sfx.tick(); };
    const scoreRun = () => score + Math.round(times.reduce((a, b) => a + b, 0));
    return {
      get score() { return scoreRun(); },
      update(dt) {
        t += dt * 1000;
        if (flash > 0) flash -= dt;
        if (state === 'wait' && t >= waitFor) showTarget();
        if (state === 'live' && performance.now() - appearAt > 1250) {
          times.push(0); round++; api.sfx.bad();
          if (round >= 5) api.done(scoreRun()); else nextWait();
        }
      },
      pointer(type, x, y) {
        if (type !== 'down') return;
        if (state === 'wait') { score -= 300; flash = 0.3; api.sfx.bad(); return; }
        if (state !== 'live') return;
        const ms = performance.now() - appearAt;
        if (dist(x, y, tx, ty) > r + 12) { score -= 60; api.sfx.bad(); return; }
        const pts = Math.max(0, Math.round(880 - ms * 1.15));
        times.push(pts);
        api.sfx.ok(); round++;
        if (round >= 5) api.done(scoreRun()); else nextWait();
      },
      draw(ctx) {
        clear(ctx, C.bg); grid(ctx, 48);
        vignette(ctx);
        text(ctx, `TARGET ${Math.min(round + 1, 5)} / 5`, W / 2, 52, 22, 'rgba(236,235,255,0.6)');
        if (state === 'wait') {
          text(ctx, 'WAIT…', W / 2, H / 2 - 10, 54, 'rgba(255,255,255,0.16)');
          text(ctx, 'do not click yet', W / 2, H / 2 + 44, 16, 'rgba(255,255,255,0.22)', 'center', true);
        }
        if (state === 'live') {
          const age = (performance.now() - appearAt) / 1000;
          const pulse = 1 + Math.sin(age * 18) * 0.05;
          ctx.save();
          ctx.translate(tx, ty);
          ctx.scale(pulse, pulse);
          ctx.shadowColor = C.cyan; ctx.shadowBlur = 30;
          ctx.strokeStyle = C.cyan; ctx.lineWidth = 4;
          ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.stroke();
          ctx.shadowBlur = 0;
          ctx.fillStyle = C.magenta;
          ctx.beginPath(); ctx.arc(0, 0, r * 0.45, 0, TAU); ctx.fill();
          ctx.fillStyle = C.white;
          ctx.beginPath(); ctx.arc(0, 0, r * 0.16, 0, TAU); ctx.fill();
          ctx.restore();
        }
        if (flash > 0) { ctx.fillStyle = `rgba(255,59,92,${flash})`; ctx.fillRect(0, 0, W, H); }
        text(ctx, `SCORE ${Math.max(0, scoreRun())}`, 24, H - 26, 20, C.cyan, 'left', true);
        if (times.length) text(ctx, `last ${times[times.length - 1]}`, W - 24, H - 26, 18, 'rgba(236,235,255,0.5)', 'right', true);
      }
    };
  }
};

/* -------------------------------------------------------- 2. COLOUR GATE */
const colourGate = {
  id: 'colour-gate', name: 'COLOUR GATE', skill: 'Reaction', best: 2300,
  brief: 'Tap when the gate turns CYAN. Freeze when it turns MAGENTA.', keys: 'mouse / tap / space',
  seconds: 15,
  make(api) {
    let i = 0, t = 0, gap = 700, state = 'idle', shown = 0, score = 0, isGo = false, flash = 0, reacted = false, log = [];
    const arm = () => {
      state = 'gap'; t = 0; gap = 340 + api.rng() * 620; reacted = false;
    };
    const show = () => {
      isGo = api.rng() < 0.62;
      state = 'show'; shown = 0; reacted = false;
    };
    const settle = (good, bonus) => {
      if (good) score += (isGo ? 170 : 90) + (bonus || 0); else score -= 240;
      log.push(good ? 1 : 0);
      i++;
      state = 'gap';
      if (i >= 10) api.done(Math.max(0, score)); else arm();
    };
    return {
      get score() { return Math.max(0, score); },
      update(dt) {
        t += dt * 1000;
        if (flash > 0) flash -= dt;
        if (state === 'gap' && t >= gap) show();
        if (state === 'show') {
          shown += dt * 1000;
          if (shown > 620 && !reacted) settle(!isGo, 0);
        }
      },
      pointer(type) { if (type === 'down') this.press(); },
      key(code, down) { if (down && (code === 'Space' || code === 'Enter')) this.press(); },
      press() {
        if (state !== 'show' || reacted) return;
        reacted = true;
        if (isGo) { api.sfx.ok(); settle(true, Math.round(Math.max(0, 90 - shown * 0.14))); }
        else { flash = 0.35; api.sfx.bad(); settle(false, 0); }
      },
      draw(ctx) {
        clear(ctx, state === 'show' && isGo ? '#06323a' : state === 'show' ? '#3a0620' : C.bg);
        grid(ctx, 60, 'rgba(255,255,255,0.05)');
        if (state === 'show') {
          const word = isGo ? 'TAP' : 'FREEZE';
          const col = isGo ? C.cyan : C.magenta;
          ctx.save();
          ctx.shadowColor = col; ctx.shadowBlur = 50;
          text(ctx, word, W / 2, H / 2 - 10, 116, col);
          ctx.restore();
          text(ctx, isGo ? 'gate open' : 'do not tap', W / 2, H / 2 + 78, 18, 'rgba(255,255,255,0.5)', 'center', true);
        } else {
          text(ctx, 'WAIT', W / 2, H / 2, 62, 'rgba(255,255,255,0.15)');
        }
        // progress pips
        for (let k = 0; k < 10; k++) {
          const x = W / 2 - 4.5 * 34 + k * 34;
          ctx.fillStyle = k < log.length ? (log[k] ? C.lime : C.red) : 'rgba(255,255,255,0.14)';
          ctx.fillRect(x, H - 62, 26, 8);
        }
        text(ctx, `${Math.min(i, 10)} / 10`, W / 2, H - 30, 16, 'rgba(236,235,255,0.55)', 'center', true);
        text(ctx, `${Math.max(0, score)}`, 24, 34, 22, C.cyan, 'left', true);
        if (flash > 0) { ctx.fillStyle = `rgba(255,59,92,${flash})`; ctx.fillRect(0, 0, W, H); }
      }
    };
  }
};

/* ---------------------------------------------------------- 3. LOCK BAR */
const lockBar = {
  id: 'lock-bar', name: 'LOCK BAR', skill: 'Timing', best: 2400,
  brief: 'Slam the marker inside the light zone. The zone shrinks every hit.', keys: 'mouse / tap / space',
  seconds: 14,
  make(api) {
    const bx = 140, bw = W - 280, by = H / 2 - 16, bh = 32;
    let pos = 0, dir = 1, speed = 1.55, zone = 92, hits = 0, score = 0, flash = 0, lastTxt = '';
    const centre = () => bx + bw / 2;
    return {
      get score() { return Math.round(score); },
      update(dt) {
        pos += dir * speed * dt * (1 + hits * 0.16) * 260;
        if (pos > 1) { pos = 1; dir = -1; }
        if (pos < 0) { pos = 0; dir = 1; }
        if (flash > 0) flash -= dt;
      },
      pointer(type) { if (type === 'down') this.lock(); },
      key(code, down) { if (down && (code === 'Space' || code === 'Enter')) this.lock(); },
      lock() {
        const x = bx + pos * bw;
        const d = Math.abs(x - centre());
        if (d <= zone / 2) {
          const acc = 1 - d / (zone / 2);
          const pts = 240 + 200 * acc + (d < 7 ? 180 : 0);
          score += pts;
          lastTxt = d < 7 ? 'PERFECT' : `+${Math.round(pts)}`;
          if (d < 7) api.sfx.perfect(); else api.sfx.ok();
          zone = Math.max(24, zone * 0.78);
          hits++;
          if (hits >= 5) api.done(Math.round(score));
        } else {
          score = Math.max(0, score - 90);
          lastTxt = 'MISS';
          flash = 0.25;
          api.sfx.bad();
        }
      },
      draw(ctx) {
        clear(ctx, C.bg); grid(ctx, 44);
        text(ctx, 'LOCK IT', W / 2, 80, 44, 'rgba(236,235,255,0.85)');
        // track
        ctx.fillStyle = 'rgba(255,255,255,0.07)';
        rr(ctx, bx, by, bw, bh, 3); ctx.fill();
        // zone
        const zx = centre() - zone / 2;
        ctx.save();
        ctx.shadowColor = C.lime; ctx.shadowBlur = 22;
        ctx.fillStyle = 'rgba(185,255,66,0.5)';
        rr(ctx, zx, by - 8, zone, bh + 16, 3); ctx.fill();
        ctx.restore();
        // marker
        const mx = bx + pos * bw;
        ctx.fillStyle = C.cyan;
        ctx.save(); ctx.shadowColor = C.cyan; ctx.shadowBlur = 20;
        rr(ctx, mx - 4, by - 20, 8, bh + 40, 2); ctx.fill();
        ctx.restore();
        text(ctx, `${hits} / 5 HITS`, W / 2, by + bh + 52, 18, 'rgba(236,235,255,0.5)', 'center', true);
        if (lastTxt) text(ctx, lastTxt, W / 2, H - 70, 28, lastTxt === 'PERFECT' ? C.gold : C.cyan);
        text(ctx, `${Math.round(score)}`, 24, 34, 22, C.cyan, 'left', true);
        if (flash > 0) { ctx.fillStyle = `rgba(255,59,92,${flash * 0.6})`; ctx.fillRect(0, 0, W, H); }
      }
    };
  }
};

/* ----------------------------------------------------------- 4. BULLSEYE */
const bullseye = {
  id: 'bullseye', name: 'BULLSEYE', skill: 'Accuracy', best: 2600,
  brief: 'Pop the drifting targets. Closer to the core scores more.', keys: 'mouse / tap',
  seconds: 15,
  make(api) {
    const targets = [];
    let score = 0, spawnAt = 0, misses = 0, ripple = [];
    const spawn = () => {
      const r = 26 + api.rng() * 34;
      targets.push({
        x: 90 + api.rng() * (W - 180), y: 100 + api.rng() * (H - 220),
        r, vx: (api.rng() - 0.5) * 190, vy: (api.rng() - 0.5) * 150, life: 2.4 + api.rng() * 1.4, age: 0
      });
    };
    return {
      get score() { return Math.max(0, Math.round(score)); },
      update(dt) {
        spawnAt -= dt;
        if (spawnAt <= 0 && targets.length < 5) { spawn(); spawnAt = 0.35 + api.rng() * 0.5; }
        for (const t of targets) {
          t.age += dt; t.x += t.vx * dt; t.y += t.vy * dt;
          if (t.x < t.r) { t.x = t.r; t.vx *= -1; }
          if (t.x > W - t.r) { t.x = W - t.r; t.vx *= -1; }
          if (t.y < t.r + 70) { t.y = t.r + 70; t.vy *= -1; }
          if (t.y > H - t.r - 30) { t.y = H - t.r - 30; t.vy *= -1; }
        }
        for (let i = targets.length - 1; i >= 0; i--) if (targets[i].age > targets[i].life) targets.splice(i, 1);
        ripple = ripple.filter((r) => { r.age += dt; return r.age < 0.4; });
      },
      pointer(type, x, y) {
        if (type !== 'down') return;
        let hit = -1;
        for (let i = targets.length - 1; i >= 0; i--) {
          if (dist(x, y, targets[i].x, targets[i].y) <= targets[i].r) { hit = i; break; }
        }
        if (hit >= 0) {
          const t = targets[hit];
          const off = dist(x, y, t.x, t.y) / t.r;
          score += Math.round(160 + 220 * (1 - off));
          if (off < 0.28) api.sfx.perfect(); else api.sfx.ok();
          ripple.push({ x: t.x, y: t.y, r: t.r, age: 0, good: true });
          targets.splice(hit, 1);
        } else {
          score -= 45; misses++;
          api.sfx.bad();
          ripple.push({ x, y, r: 24, age: 0, good: false });
        }
      },
      draw(ctx) {
        clear(ctx, C.bg); grid(ctx, 54, 'rgba(61,243,255,0.06)');
        for (const t of targets) {
          const left = 1 - t.age / t.life;
          ctx.save();
          ctx.globalAlpha = 0.35 + left * 0.65;
          ctx.strokeStyle = t.r > 40 ? C.magenta : C.cyan;
          ctx.lineWidth = 3;
          ctx.shadowColor = ctx.strokeStyle; ctx.shadowBlur = 16;
          ctx.beginPath(); ctx.arc(t.x, t.y, t.r, 0, TAU); ctx.stroke();
          ctx.beginPath(); ctx.arc(t.x, t.y, t.r * 0.55, 0, TAU); ctx.stroke();
          ctx.fillStyle = C.white;
          ctx.beginPath(); ctx.arc(t.x, t.y, 4, 0, TAU); ctx.fill();
          if (left < 0.3) {
            ctx.shadowBlur = 0; ctx.strokeStyle = C.red; ctx.globalAlpha = 0.8;
            ctx.beginPath(); ctx.arc(t.x, t.y, t.r + 8 + (1 - left) * 10, 0, TAU); ctx.stroke();
          }
          ctx.restore();
        }
        for (const r of ripple) {
          ctx.save();
          ctx.globalAlpha = 1 - r.age / 0.4;
          ctx.strokeStyle = r.good ? C.lime : C.red;
          ctx.lineWidth = 3;
          ctx.beginPath(); ctx.arc(r.x, r.y, r.r + r.age * 220, 0, TAU); ctx.stroke();
          ctx.restore();
        }
        text(ctx, `${Math.round(score)}`, 24, 34, 22, C.cyan, 'left', true);
        text(ctx, misses ? `miss ${misses}` : 'clean', W - 24, 34, 16, misses ? C.red : C.lime, 'right', true);
      }
    };
  }
};

/* ------------------------------------------------------ 5. SEQUENCE PADS */
const sequencePads = {
  id: 'sequence-pads', name: 'MEMORY STACK', skill: 'Memory', best: 2800,
  brief: 'Watch the pads light up, then repeat the order. Every round adds one.', keys: 'mouse / tap / 1-4',
  seconds: 22,
  make(api) {
    const pads = 4, pw = 150, ph = 150, gap = 16;
    const px0 = (W - (pads * pw + (pads - 1) * gap)) / 2, py0 = H / 2 - ph / 2;
    let seq = [], step = 0, phase = 'show', timer = 0, lit = -1, level = 1, score = 0, flash = 0;
    const sounds = [C.cyan, C.magenta, C.lime, C.amber];
    const padAt = (x) => {
      for (let i = 0; i < pads; i++) {
        const x0 = px0 + i * (pw + gap);
        if (x >= x0 && x <= x0 + pw && y2 >= py0 && y2 <= py0 + ph) return i;
      }
      return -1;
    };
    let y2 = 0;
    const newSeq = () => { seq = []; for (let i = 0; i < level + 2; i++) seq.push((api.rng() * pads) | 0); };
    const begin = () => { newSeq(); phase = 'show'; step = 0; timer = 0; };
    begin();
    return {
      get score() { return Math.round(score); },
      update(dt) {
        timer += dt;
        if (flash > 0) flash -= dt;
        if (phase === 'show') {
          const every = 0.42;
          const idx = Math.floor(timer / every);
          lit = idx < seq.length * 2 ? (idx % 2 === 0 ? seq[idx / 2] : -1) : -1;
          if (idx % 2 === 0 && idx < seq.length * 2) api.sfx.tone({ freq: 380 + seq[idx / 2] * 130, dur: 0.09, vol: 0.12, type: 'square' });
          if (timer > seq.length * every * 2 + 0.15) { phase = 'input'; step = 0; timer = 0; }
        } else if (phase === 'input') {
          lit = -1;
          if (timer > seq.length * 1.15 + 1.4) {
            flash = 0.35; api.sfx.bad();
            api.done(Math.round(score));
          }
        }
      },
      pointer(type, x, y) {
        y2 = y;
        if (type !== 'down' || phase !== 'input') return;
        const p = padAt(x);
        if (p < 0) return;
        if (p === seq[step]) {
          step++;
          score += 30;
          api.sfx.tone({ freq: 380 + p * 130, dur: 0.1, vol: 0.16, type: 'square' });
          if (step >= seq.length) {
            score += 200 + level * 40;
            level++;
            api.sfx.ok();
            begin();
          }
        } else {
          flash = 0.35; api.sfx.bad();
          score = Math.max(0, score - 40);
          api.done(Math.round(score));
        }
      },
      key(code, down) {
        if (!down || phase !== 'input') return;
        const map = { Digit1: 0, Digit2: 1, Digit3: 2, Digit4: 3 };
        if (map[code] != null) this.pointer('down', px0 + map[code] * (pw + gap) + pw / 2, py0 + ph / 2);
      },
      draw(ctx) {
        clear(ctx, C.bg); grid(ctx, 40);
        text(ctx, `STACK ${level}`, W / 2, 62, 26, 'rgba(236,235,255,0.7)', 'center', true);
        for (let i = 0; i < pads; i++) {
          pad(ctx, px0 + i * (pw + gap), py0, pw, ph, sounds[i], lit === i);
          text(ctx, String(i + 1), px0 + i * (pw + gap) + pw / 2, py0 + ph - 22, 15, 'rgba(255,255,255,0.35)', 'center', true);
        }
        text(ctx, phase === 'show' ? 'WATCH' : 'REPEAT', W / 2, py0 - 44, 26, phase === 'show' ? C.amber : C.cyan);
        text(ctx, `${seq.length} steps`, W / 2, py0 + ph + 42, 16, 'rgba(236,235,255,0.45)', 'center', true);
        text(ctx, `${Math.round(score)}`, 24, 34, 22, C.cyan, 'left', true);
        if (flash > 0) { ctx.fillStyle = `rgba(255,59,92,${flash * 0.55})`; ctx.fillRect(0, 0, W, H); }
      }
    };
  }
};

/* ------------------------------------------------------------ 6. ODD ONE */
const oddOne = {
  id: 'odd-one', name: 'ODD ONE OUT', skill: 'Pattern', best: 2800,
  brief: 'One glyph is different. Find it before the grid resets.', keys: 'mouse / tap',
  seconds: 16,
  make(api) {
    let round = 0, cols = 4, cells = [], target = 0, t = 0, limit = 3.2, score = 0, flash = 0, y2 = 0;
    const build = () => {
      cols = round < 2 ? 3 : round < 4 ? 4 : 5;
      const n = cols * cols;
      target = (api.rng() * n) | 0;
      const baseRot = api.rng() * TAU;
      const baseCol = [C.cyan, C.magenta, C.lime, C.amber, C.violet][(api.rng() * 5) | 0];
      const odd = api.rng() < 0.5 ? 'rot' : 'col';
      cells = [];
      for (let i = 0; i < n; i++) {
        const isOdd = i === target;
        cells.push({
          rot: baseRot + (isOdd && odd === 'rot' ? 0.55 : 0),
          col: isOdd && odd === 'col' ? C.white : baseCol,
          shape: (i % 3)
        });
      }
      limit = Math.max(1.2, 3.0 - round * 0.28);
      t = 0;
    };
    build();
    const size = () => Math.min(96, (W - 220) / cols - 8);
    const originX = () => (W - (cols * size() + (cols - 1) * 8)) / 2;
    const originY = () => (H - (cols * size() + (cols - 1) * 8)) / 2 + 10;
    return {
      get score() { return Math.max(0, Math.round(score)); },
      update(dt) {
        t += dt;
        if (flash > 0) flash -= dt;
        if (t > limit) {
          score -= 120; flash = 0.3; api.sfx.bad();
          round++;
          if (round >= 6) api.done(Math.max(0, Math.round(score))); else build();
        }
      },
      pointer(type, x, y) {
        y2 = y;
        if (type !== 'down') return;
        const s = size(), ox = originX(), oy = originY();
        const cx = Math.floor((x - ox) / (s + 8)), cy = Math.floor((y - oy) / (s + 8));
        if (cx < 0 || cy < 0 || cx >= cols || cy >= cols) return;
        const idx = cy * cols + cx;
        if (idx === target) {
          const speed = 1 - t / limit;
          score += 240 + Math.round(speed * 160);
          api.sfx.ok(); round++;
          if (round >= 6) api.done(Math.round(score)); else build();
        } else {
          score -= 150; flash = 0.25; api.sfx.bad();
        }
      },
      draw(ctx) {
        clear(ctx, C.bg);
        const s = size(), ox = originX(), oy = originY();
        for (let i = 0; i < cells.length; i++) {
          const c = cells[i];
          const x = ox + (i % cols) * (s + 8), y = oy + Math.floor(i / cols) * (s + 8);
          ctx.save();
          ctx.translate(x + s / 2, y + s / 2);
          ctx.fillStyle = 'rgba(255,255,255,0.04)';
          rr(ctx, -s / 2, -s / 2, s, s, 3); ctx.fill();
          ctx.rotate(c.rot);
          ctx.fillStyle = c.col;
          ctx.shadowColor = c.col; ctx.shadowBlur = 14;
          const u = s * 0.3;
          if (c.shape === 0) {
            ctx.beginPath();
            ctx.moveTo(0, -u); ctx.lineTo(u, u * 0.7); ctx.lineTo(-u, u * 0.7); ctx.closePath(); ctx.fill();
          } else if (c.shape === 1) {
            ctx.fillRect(-u * 0.8, -u * 0.8, u * 1.6, u * 1.6);
          } else {
            ctx.beginPath(); ctx.arc(0, 0, u * 0.9, 0, TAU); ctx.fill();
          }
          ctx.restore();
        }
        text(ctx, `ROUND ${Math.min(round + 1, 6)} / 6`, W / 2, 44, 20, 'rgba(236,235,255,0.6)', 'center', true);
        // time bar
        const p = 1 - t / limit;
        ctx.fillStyle = 'rgba(255,255,255,0.1)'; ctx.fillRect(W / 2 - 200, H - 40, 400, 6);
        ctx.fillStyle = p < 0.35 ? C.red : C.cyan; ctx.fillRect(W / 2 - 200, H - 40, 400 * Math.max(0, p), 6);
        text(ctx, `${Math.max(0, Math.round(score))}`, 24, 34, 22, C.cyan, 'left', true);
        if (flash > 0) { ctx.fillStyle = `rgba(255,59,92,${flash * 0.5})`; ctx.fillRect(0, 0, W, H); }
      }
    };
  }
};

/* --------------------------------------------------------- 7. NUMBER RUN */
const numberRun = {
  id: 'number-run', name: 'NUMBER RUN', skill: 'Speed', best: 1800,
  brief: 'Hit 1 to 9 in order. Fast and clean beats frantic.', keys: 'mouse / tap / 1-9',
  seconds: 12,
  make(api) {
    const nodes = [];
    let next = 1, started = 0, mistakes = 0, done = false, flash = 0, y2 = 0;
    for (let i = 1; i <= 9; i++) {
      nodes.push({ n: i, x: 130 + api.rng() * (W - 260), y: 140 + api.rng() * (H - 280), r: 34, hit: false });
    }
    const finish = () => {
      const ms = performance.now() - started;
      api.done(Math.max(0, Math.round(1500 - ms * 0.85 + (mistakes === 0 ? 350 : 0))));
    };
    return {
      get score() { return Math.max(0, next - 1); },
      update(dt) { if (!started) started = performance.now(); if (flash > 0) flash -= dt; },
      pointer(type, x, y) {
        y2 = y;
        if (type !== 'down' || done) return;
        for (const nd of nodes) {
          if (nd.hit) continue;
          if (dist(x, y, nd.x, nd.y) <= nd.r + 6) {
            if (nd.n === next) {
              nd.hit = true; next++; api.sfx.ok();
              if (next > 9) { done = true; finish(); }
            } else {
              mistakes++; flash = 0.2; api.sfx.bad();
            }
            return;
          }
        }
      },
      key(code, down) {
        if (!down || done) return;
        const m = /^Digit([1-9])$/.exec(code);
        if (!m) return;
        const n = +m[1];
        const nd = nodes.find((q) => q.n === n);
        if (nd && !nd.hit) this.pointer('down', nd.x, nd.y);
      },
      draw(ctx) {
        clear(ctx, C.bg); grid(ctx, 60, 'rgba(255,255,255,0.04)');
        for (const nd of nodes) {
          if (nd.hit) {
            ctx.save(); ctx.globalAlpha = 0.2;
            ctx.fillStyle = C.lime; ctx.beginPath(); ctx.arc(nd.x, nd.y, nd.r * 0.6, 0, TAU); ctx.fill();
            ctx.restore();
            continue;
          }
          const isNext = nd.n === next;
          ctx.save();
          ctx.shadowColor = isNext ? C.cyan : 'rgba(139,92,255,0.6)';
          ctx.shadowBlur = isNext ? 26 : 10;
          ctx.fillStyle = isNext ? 'rgba(61,243,255,0.18)' : 'rgba(255,255,255,0.05)';
          ctx.beginPath(); ctx.arc(nd.x, nd.y, nd.r, 0, TAU); ctx.fill();
          ctx.strokeStyle = isNext ? C.cyan : 'rgba(139,92,255,0.8)';
          ctx.lineWidth = isNext ? 3 : 2;
          ctx.beginPath(); ctx.arc(nd.x, nd.y, nd.r, 0, TAU); ctx.stroke();
          ctx.restore();
          text(ctx, String(nd.n), nd.x, nd.y + 2, 28, isNext ? '#fff' : 'rgba(236,235,255,0.6)');
        }
        text(ctx, `NEXT ${Math.min(next, 9)}`, W / 2, 46, 24, C.cyan, 'center', true);
        if (flash > 0) { ctx.fillStyle = `rgba(255,59,92,${flash * 0.5})`; ctx.fillRect(0, 0, W, H); }
      }
    };
  }
};

/* -------------------------------------------------------------- 8. STROOP */
const stroop = {
  id: 'stroop', name: 'INK TEST', skill: 'Decision', best: 2400,
  brief: 'Ignore the word. Pick the colour the word is painted in.', keys: 'mouse / tap / 1-4',
  seconds: 16,
  make(api) {
    const names = ['RED', 'CYAN', 'LIME', 'AMBER', 'VIOLET'];
    const cols = [C.red, C.cyan, C.lime, C.amber, C.violet];
    let word = 0, ink = 1, round = 0, t = 0, score = 0, flash = 0, options = [], y2 = 0, msg = '', msgT = 0;
    const nextRound = () => {
      round += 1;
      if (round >= 10) api.done(Math.max(0, Math.round(score)));
      else build();
    };
    const build = () => {
      word = (api.rng() * 5) | 0;
      ink = (api.rng() * 5) | 0;
      if (ink === word && api.rng() < 0.8) ink = (ink + 1 + ((api.rng() * 4) | 0)) % 5;
      const idx = [0, 1, 2, 3, 4].filter((i) => i !== ink);
      options = shuffle([ink, idx[0], idx[1], idx[2]]);
      t = 0;
    };
    build();
    return {
      get score() { return Math.max(0, Math.round(score)); },
      update(dt) {
        t += dt;
        if (msgT > 0) msgT -= dt;
        if (t > 4) { score -= 80; flash = 0.22; api.sfx.bad(); nextRound(); }
        if (flash > 0) flash -= dt;
      },
      pointer(type, x, y) {
        y2 = y;
        if (type !== 'down') return;
        for (let i = 0; i < 4; i++) {
          const bx = W / 2 - 380 + i * 190, by = H - 150;
          if (x >= bx && x <= bx + 170 && y >= by && y <= by + 92) {
            this.answer(options[i], i);
            return;
          }
        }
      },
      key(code, down) {
        if (!down) return;
        const m = /^Digit([1-4])$/.exec(code);
        if (m) this.answer(options[+m[1] - 1], +m[1] - 1);
      },
      answer(opt, i) {
        if (opt === ink) {
          score += 200 + Math.round((1 - t / 4) * 80);
          msg = 'CLEAN'; msgT = 0.6;
          api.sfx.ok();
          nextRound();
        } else {
          score -= 150; flash = 0.25; msg = 'WRONG'; msgT = 0.6;
          api.sfx.bad();
        }
      },
      draw(ctx) {
        clear(ctx, C.bg);
        ctx.fillStyle = 'rgba(255,255,255,0.03)';
        ctx.fillRect(0, 0, W, H);
        ctx.save();
        ctx.shadowColor = cols[ink]; ctx.shadowBlur = 40;
        text(ctx, names[word], W / 2, H / 2 - 70, 118, cols[ink]);
        ctx.restore();
        text(ctx, 'WHAT COLOUR IS THE INK?', W / 2, H / 2 + 20, 18, 'rgba(236,235,255,0.55)', 'center', true);
        for (let i = 0; i < 4; i++) {
          const bx = W / 2 - 380 + i * 190, by = H - 150;
          ctx.fillStyle = 'rgba(255,255,255,0.05)';
          rr(ctx, bx, by, 170, 92, 2); ctx.fill();
          ctx.strokeStyle = cols[options[i]]; ctx.lineWidth = 2;
          ctx.stroke();
          text(ctx, names[options[i]], bx + 85, by + 46, 20, cols[options[i]], 'center', true);
          text(ctx, String(i + 1), bx + 12, by + 14, 11, 'rgba(255,255,255,0.3)', 'left', true);
        }
        text(ctx, `${round} / 10`, W / 2, 40, 18, 'rgba(236,235,255,0.5)', 'center', true);
        text(ctx, `${Math.max(0, Math.round(score))}`, 24, 34, 22, C.cyan, 'left', true);
        if (msgT > 0) text(ctx, msg, W - 30, 40, 20, msg === 'CLEAN' ? C.lime : C.red, 'right');
        if (flash > 0) { ctx.fillStyle = `rgba(255,59,92,${flash * 0.45})`; ctx.fillRect(0, 0, W, H); }
      }
    };
  }
};
/* ---------------------------------------------------------------- 9. DODGE */
const dodge = {
  id: 'dodge', name: 'DODGE GRID', skill: 'Movement', best: 2000,
  brief: 'Steer the runner. Survive the falling blocks as long as you can.', keys: '← → / A D / drag',
  seconds: 18,
  make(api) {
    const ship = { x: W / 2, y: H - 70, vx: 0, r: 16 };
    let blocks = [], spawn = 0, score = 0, alive = true, keys = {}, dragX = null, near = 0, dead = 0;
    return {
      get score() { return Math.round(score); },
      update(dt) {
        if (!alive) { dead += dt; if (dead > 0.8) api.done(Math.round(score)); return; }
        score += dt * 110;
        let ax = 0;
        if (keys.ArrowLeft || keys.KeyA) ax -= 1;
        if (keys.ArrowRight || keys.KeyD) ax += 1;
        if (dragX != null) ax = Math.max(-1, Math.min(1, (dragX - ship.x) / 60));
        ship.vx += ax * 2400 * dt;
        ship.vx *= Math.pow(0.0016, dt);
        ship.x += ship.vx * dt;
        if (ship.x < ship.r + 10) { ship.x = ship.r + 10; ship.vx = 0; }
        if (ship.x > W - ship.r - 10) { ship.x = W - ship.r - 10; ship.vx = 0; }

        spawn -= dt;
        if (spawn <= 0) {
          const speed = 210 + score * 0.06;
          const w = 42 + api.rng() * 70;
          blocks.push({ x: api.rng() * (W - w), y: -40, w, h: 18 + api.rng() * 22, vy: speed, passed: false });
          spawn = Math.max(0.2, 0.62 - score * 0.00016) * (0.7 + api.rng() * 0.6);
        }
        for (const b of blocks) {
          b.y += b.vy * dt;
          if (!b.passed && b.y > ship.y + 30) { b.passed = true; score += 22; }
          if (b.y < H + 40 && b.x < ship.x + ship.r && b.x + b.w > ship.x - ship.r &&
              b.y + b.h > ship.y - ship.r && b.y < ship.y + ship.r) {
            alive = false; api.sfx.elim();
          }
        }
        blocks = blocks.filter((b) => b.y < H + 60);
      },
      pointer(type, x) {
        if (type === 'down') dragX = x;
        if (type === 'move' && dragX != null) dragX = x;
        if (type === 'up') dragX = null;
      },
      key(code, down) {
        keys[code] = down;
        if (down && (code === 'ArrowLeft' || code === 'ArrowRight')) api.sfx.click();
      },
      draw(ctx) {
        clear(ctx, '#070512');
        // scrolling rails
        ctx.strokeStyle = 'rgba(139,92,255,0.16)';
        ctx.lineWidth = 1;
        const off = (performance.now() * 0.12) % 60;
        for (let y = -60 + off; y < H; y += 60) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
        for (let x = 60; x < W; x += 120) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
        for (const b of blocks) {
          ctx.save();
          ctx.shadowColor = C.magenta; ctx.shadowBlur = 16;
          ctx.fillStyle = 'rgba(255,47,156,0.85)';
          rr(ctx, b.x, b.y, b.w, b.h, 2); ctx.fill();
          ctx.restore();
        }
        if (alive) {
          ctx.save();
          ctx.translate(ship.x, ship.y);
          ctx.shadowColor = C.cyan; ctx.shadowBlur = 26;
          ctx.fillStyle = C.cyan;
          ctx.beginPath();
          ctx.moveTo(0, -ship.r); ctx.lineTo(ship.r, ship.r); ctx.lineTo(0, ship.r * 0.45); ctx.lineTo(-ship.r, ship.r);
          ctx.closePath(); ctx.fill();
          ctx.restore();
        } else {
          ctx.fillStyle = 'rgba(255,59,92,0.14)'; ctx.fillRect(0, 0, W, H);
          text(ctx, 'CRASHED', W / 2, H / 2, 74, C.red);
        }
        text(ctx, `${Math.round(score)}`, 24, 34, 22, C.cyan, 'left', true);
        text(ctx, 'SURVIVE', W - 24, 34, 16, 'rgba(236,235,255,0.5)', 'right', true);
      }
    };
  }
};

export const SET_ONE = [targetFlash, colourGate, lockBar, bullseye, sequencePads, oddOne, numberRun, stroop, dodge];
