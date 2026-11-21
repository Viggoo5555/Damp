/* =====================================================================
   games-set2.js — movement / aim / perception / memory (nine microgames)
   ===================================================================== */
import {
  W, H, TAU, COLORS, text, rr, grid, clear, vignette, pad, glowRect,
  head, mono, shuffle, dist
} from './games-core.js';

const C = COLORS;

/* ----------------------------------------------------------- 10. ORB RUSH */
const orbRush = {
  id: 'orb-rush', name: 'ORB RUSH', skill: 'Movement', best: 2200,
  brief: 'Sweep the pod through the orbs. Red caltrops cost you time.', keys: 'mouse / drag / arrows',
  seconds: 16,
  make(api) {
    const pod = { x: W / 2, y: H / 2, r: 15 };
    let orbs = [], spikes = [], score = 0, spawn = 0, spikeT = 1.5, keys = {}, target = null, flash = 0;
    return {
      get score() { return Math.max(0, Math.round(score)); },
      update(dt) {
        if (flash > 0) flash -= dt;
        let ax = 0, ay = 0;
        if (keys.ArrowLeft || keys.KeyA) ax -= 1;
        if (keys.ArrowRight || keys.KeyD) ax += 1;
        if (keys.ArrowUp || keys.KeyW) ay -= 1;
        if (keys.ArrowDown || keys.KeyS) ay += 1;
        if (target) {
          const dx = target.x - pod.x, dy = target.y - pod.y;
          const d = Math.hypot(dx, dy);
          if (d > 4) { ax = dx / d; ay = dy / d; }
        }
        const sp = 470;
        pod.x = Math.max(18, Math.min(W - 18, pod.x + ax * sp * dt));
        pod.y = Math.max(90, Math.min(H - 26, pod.y + ay * sp * dt));

        spawn -= dt;
        if (spawn <= 0 && orbs.length < 7) {
          orbs.push({ x: 50 + api.rng() * (W - 100), y: 110 + api.rng() * (H - 160), r: 13, t: 0 });
          spawn = 0.3 + api.rng() * 0.35;
        }
        spikeT -= dt;
        if (spikeT <= 0) {
          spikes.push({ x: 60 + api.rng() * (W - 120), y: 120 + api.rng() * (H - 180), vx: (api.rng() - 0.5) * 150, vy: (api.rng() - 0.5) * 130, r: 20 });
          spikeT = 1.1 + api.rng() * 0.8;
        }
        for (const o of orbs) o.t += dt;
        for (let i = orbs.length - 1; i >= 0; i--) {
          if (dist(pod.x, pod.y, orbs[i].x, orbs[i].y) < pod.r + orbs[i].r) {
            score += 105; api.sfx.coin(); orbs.splice(i, 1);
          }
        }
        for (const s of spikes) {
          s.x += s.vx * dt; s.y += s.vy * dt;
          if (s.x < s.r || s.x > W - s.r) s.vx *= -1;
          if (s.y < 110 + s.r || s.y > H - s.r) s.vy *= -1;
          if (dist(pod.x, pod.y, s.x, s.y) < pod.r + s.r) {
            score = Math.max(0, score - 140); flash = 0.25; api.sfx.bad();
            pod.x += (pod.x - s.x) * 1.6; pod.y += (pod.y - s.y) * 1.6;
          }
        }
      },
      pointer(type, x, y) {
        if (type === 'down') { target = { x, y }; api.sfx.click(); }
        if (type === 'move') target = { x, y };
        if (type === 'up') target = null;
      },
      key(code, down) { keys[code] = down; if (down && code === 'Space') target = null; },
      draw(ctx) {
        clear(ctx, '#05040f');
        ctx.strokeStyle = 'rgba(61,243,255,0.07)';
        for (let x = 0; x < W; x += 80) { ctx.beginPath(); ctx.moveTo(x, 90); ctx.lineTo(x, H); ctx.stroke(); }
        for (let y = 90; y < H; y += 80) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
        for (const o of orbs) {
          const s = 1 + Math.sin(o.t * 6) * 0.14;
          ctx.save();
          ctx.shadowColor = C.lime; ctx.shadowBlur = 22;
          ctx.fillStyle = C.lime;
          ctx.beginPath(); ctx.arc(o.x, o.y, o.r * s, 0, TAU); ctx.fill();
          ctx.restore();
        }
        for (const s of spikes) {
          ctx.save();
          ctx.translate(s.x, s.y);
          ctx.rotate(performance.now() * 0.002);
          ctx.fillStyle = C.red;
          ctx.shadowColor = C.red; ctx.shadowBlur = 16;
          for (let i = 0; i < 3; i++) {
            ctx.rotate(TAU / 3);
            ctx.beginPath(); ctx.moveTo(0, -s.r); ctx.lineTo(7, 0); ctx.lineTo(-7, 0); ctx.closePath(); ctx.fill();
          }
          ctx.restore();
        }
        ctx.save();
        ctx.shadowColor = C.cyan; ctx.shadowBlur = 24;
        ctx.fillStyle = C.cyan;
        ctx.beginPath(); ctx.arc(pod.x, pod.y, pod.r, 0, TAU); ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(pod.x, pod.y, pod.r * 0.35, 0, TAU); ctx.fill();
        ctx.restore();
        text(ctx, `${Math.max(0, Math.round(score))}`, 24, 34, 22, C.cyan, 'left', true);
        text(ctx, 'COLLECT', W - 24, 34, 16, 'rgba(236,235,255,0.5)', 'right', true);
        if (flash > 0) { ctx.fillStyle = `rgba(255,59,92,${flash * 0.4})`; ctx.fillRect(0, 0, W, H); }
      }
    };
  }
};

/* ---------------------------------------------------------- 11. MASH METER */
const mashMeter = {
  id: 'mash-meter', name: 'OVERDRIVE', skill: 'Speed', best: 96,
  brief: 'Hammer the pad. Every press charges the meter — do not stop.', keys: 'click / tap / space',
  seconds: 6,
  make(api) {
    let presses = 0, heat = 0, pulse = 0, decay = 0;
    return {
      get score() { return presses; },
      update(dt) {
        heat = Math.max(0, heat - dt * 26);
        pulse = Math.max(0, pulse - dt * 3);
        decay += dt;
      },
      pointer(type) { if (type === 'down') this.tap(); },
      key(code, down) { if (down && (code === 'Space' || code === 'Enter')) this.tap(); },
      tap() {
        presses++;
        heat = Math.min(100, heat + 9);
        pulse = 1;
        api.sfx.tone({ freq: 300 + heat * 7, dur: 0.05, vol: 0.1, type: 'square' });
      },
      draw(ctx) {
        clear(ctx, '#0a0616');
        const cx = W / 2, cy = H / 2;
        const r = 118 + pulse * 12;
        ctx.save();
        ctx.shadowColor = heat > 70 ? C.magenta : C.cyan;
        ctx.shadowBlur = 40 + heat;
        ctx.strokeStyle = heat > 70 ? C.magenta : C.cyan;
        ctx.lineWidth = 8;
        ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.stroke();
        ctx.restore();
        text(ctx, 'TAP', cx, cy - 6, 58, '#fff');
        text(ctx, `${presses}`, cx, cy + 56, 46, C.cyan);
        // heat bar
        const bw = 520, bx = cx - bw / 2, by = H - 78;
        ctx.fillStyle = 'rgba(255,255,255,0.08)'; ctx.fillRect(bx, by, bw, 14);
        const g = ctx.createLinearGradient(bx, 0, bx + bw, 0);
        g.addColorStop(0, C.cyan); g.addColorStop(0.7, C.violet); g.addColorStop(1, C.magenta);
        ctx.fillStyle = g; ctx.fillRect(bx, by, (bw * heat) / 100, 14);
        text(ctx, 'OVERDRIVE', cx, by - 22, 16, 'rgba(236,235,255,0.5)', 'center', true);
        text(ctx, `${presses} / PRESSES`, 24, 34, 20, C.cyan, 'left', true);
      }
    };
  }
};

/* ----------------------------------------------------------- 12. WHACK GRID */
const whackGrid = {
  id: 'whack-grid', name: 'WHACK GRID', skill: 'Reflexes', best: 2600,
  brief: 'Smack the lit cells. Cells expire fast — keep your eyes moving.', keys: 'mouse / tap',
  seconds: 13,
  make(api) {
    let score = 0, cells = null, spawn = 0, flash = 0, hitCount = 0;
    const n = 3, size = 132, gap = 12;
    const ox = (W - (n * size + (n - 1) * gap)) / 2, oy = (H - (n * size + (n - 1) * gap)) / 2 + 14;
    cells = Array.from({ length: n * n }, () => ({ up: 0, kind: 0 }));
    const pop = () => {
      const free = cells.map((c, i) => (c.up <= 0 ? i : -1)).filter((i) => i >= 0);
      if (!free.length) return;
      const i = free[(api.rng() * free.length) | 0];
      cells[i].up = Math.max(0.55, 1.05 - hitCount * 0.02);
      cells[i].kind = api.rng() < 0.16 ? 1 : 0; // 1 = decoy (do not hit)
    };
    return {
      get score() { return Math.max(0, Math.round(score)); },
      update(dt) {
        if (flash > 0) flash -= dt;
        spawn -= dt;
        if (spawn <= 0) { pop(); spawn = Math.max(0.19, 0.44 - hitCount * 0.012); }
        for (const c of cells) if (c.up > 0) c.up -= dt;
      },
      pointer(type, x, y) {
        if (type !== 'down') return;
        const cx = Math.floor((x - ox) / (size + gap)), cy = Math.floor((y - oy) / (size + gap));
        if (cx < 0 || cy < 0 || cx >= n || cy >= n) return;
        const idx = cy * n + cx;
        const c = cells[idx];
        if (c.up > 0) {
          if (c.kind === 1) { score -= 130; flash = 0.22; api.sfx.bad(); }
          else { score += 120 + Math.round(c.up * 60); hitCount++; api.sfx.hit(); }
          c.up = 0;
        } else {
          score -= 35; api.sfx.bad();
        }
      },
      draw(ctx) {
        clear(ctx, C.bg); grid(ctx, 44, 'rgba(139,92,255,0.06)');
        for (let i = 0; i < cells.length; i++) {
          const x = ox + (i % n) * (size + gap), y = oy + Math.floor(i / n) * (size + gap);
          const c = cells[i];
          ctx.fillStyle = 'rgba(255,255,255,0.035)';
          rr(ctx, x, y, size, size, 3); ctx.fill();
          ctx.strokeStyle = 'rgba(139,92,255,0.4)'; ctx.lineWidth = 2;
          rr(ctx, x, y, size, size, 3); ctx.stroke();
          if (c.up > 0) {
            const t = Math.min(1, c.up / 0.35);
            const col = c.kind === 1 ? C.red : C.lime;
            ctx.save();
            ctx.globalAlpha = 0.55 + t * 0.45;
            ctx.shadowColor = col; ctx.shadowBlur = 26;
            ctx.fillStyle = col;
            rr(ctx, x + 16, y + 16, size - 32, size - 32, 3); ctx.fill();
            ctx.restore();
            if (c.kind === 1) text(ctx, '×', x + size / 2, y + size / 2 + 2, 52, '#12061a');
            else text(ctx, '+', x + size / 2, y + size / 2, 56, '#0a1400');
          }
        }
        text(ctx, `${Math.max(0, Math.round(score))}`, 24, 34, 22, C.cyan, 'left', true);
        text(ctx, 'AVOID THE X', W - 24, 34, 15, 'rgba(255,59,92,0.8)', 'right', true);
        if (flash > 0) { ctx.fillStyle = `rgba(255,59,92,${flash * 0.4})`; ctx.fillRect(0, 0, W, H); }
      }
    };
  }
};

/* ------------------------------------------------------------- 13. BALANCE */
const balance = {
  id: 'balance', name: 'BALANCE BEAM', skill: 'Precision', best: 1700,
  brief: 'Hold the needle inside the moving band. Drift is constant.', keys: '← → / A D / hold screen halves',
  seconds: 16,
  make(api) {
    let pos = 0.5, vel = 0, band = 0.5, bandV = 0.34, inside = 0, keys = {}, hold = 0, score = 0, flash = 0;
    return {
      get score() { return Math.round(score); },
      update(dt) {
        if (flash > 0) flash -= dt;
        let ax = 0;
        if (keys.ArrowLeft || keys.KeyA) ax -= 1;
        if (keys.ArrowRight || keys.KeyD) ax += 1;
        if (hold) ax += hold;
        vel += ax * 1.55 * dt;
        vel += Math.sin(performance.now() * 0.0011) * 0.34 * dt;
        vel *= Math.pow(0.32, dt);
        pos += vel * dt;
        if (pos < 0) { pos = 0; vel = Math.abs(vel) * 0.4; }
        if (pos > 1) { pos = 1; vel = -Math.abs(vel) * 0.4; }
        band += bandV * dt;
        if (band > 0.86 || band < 0.14) bandV *= -1;
        const within = Math.abs(pos - band) < 0.085;
        if (within) { inside += dt; score += dt * 120; }
        else { flash = Math.max(flash, 0.12); }
        api.setHint && api.setHint(within ? 'STABLE' : 'DRIFTING');
      },
      pointer(type, x) {
        if (type === 'down') hold = x < W / 2 ? -1 : 1;
        if (type === 'up') hold = 0;
      },
      key(code, down) { keys[code] = down; },
      draw(ctx) {
        clear(ctx, '#070512');
        const gx = 90, gw = W - 180, gy = H / 2 + 40, gh = 26;
        ctx.fillStyle = 'rgba(255,255,255,0.06)';
        rr(ctx, gx, gy, gw, gh, 3); ctx.fill();
        const bx = gx + (band - 0.085) * gw, bw = 0.17 * gw;
        const within = Math.abs(pos - band) < 0.085;
        ctx.save();
        ctx.shadowColor = within ? C.lime : C.amber;
        ctx.shadowBlur = 24;
        ctx.fillStyle = within ? 'rgba(185,255,66,0.45)' : 'rgba(255,176,32,0.35)';
        rr(ctx, bx, gy - 6, bw, gh + 12, 3); ctx.fill();
        ctx.restore();
        const nx = gx + pos * gw;
        ctx.save();
        ctx.shadowColor = C.cyan; ctx.shadowBlur = 22;
        ctx.fillStyle = C.cyan;
        rr(ctx, nx - 3, gy - 26, 6, gh + 52, 2); ctx.fill();
        ctx.restore();
        text(ctx, 'KEEP THE NEEDLE IN THE ZONE', W / 2, gy - 76, 26, 'rgba(236,235,255,0.8)');
        text(ctx, `${Math.round(score)}`, 24, 34, 22, C.cyan, 'left', true);
        text(ctx, `${inside.toFixed(1)}s IN BAND`, W - 24, 34, 15, 'rgba(236,235,255,0.5)', 'right', true);
        if (flash > 0) { ctx.fillStyle = `rgba(255,176,32,${flash * 0.25})`; ctx.fillRect(0, 0, W, H); }
      }
    };
  }
};

/* -------------------------------------------------------------- 14. THREAD */
const thread = {
  id: 'thread', name: 'NEEDLE THREAD', skill: 'Precision', best: 1900,
  brief: 'Drag through the corridor without touching the walls.', keys: 'drag / move mouse',
  seconds: 15,
  make(api) {
    let scroll = 0, score = 0, hits = 0, flash = 0, px = W / 2, active = true, best = 0;
    const bandY = H * 0.68;
    const centreAt = (y, s) => W / 2 + Math.sin((y + s) * 0.006) * 180 + Math.sin((y + s) * 0.0021) * 120;
    const halfAt = (y, s) => 62 - Math.min(26, (s / 9000) * 26);
    return {
      get score() { return Math.round(score); },
      update(dt) {
        if (flash > 0) flash -= dt;
        if (!active) return;
        scroll += dt * 300;
        const c = centreAt(bandY, scroll), hw = halfAt(bandY, scroll);
        const off = Math.abs(px - c);
        if (off > hw) {
          hits++;
          flash = 0.25;
          scroll -= dt * 420;
          score = Math.max(0, score - 26);
          api.sfx.bad();
        } else {
          score += dt * 96 * (1 - (off / hw) * 0.55);
          best = Math.max(best, off / hw);
        }
      },
      pointer(type, x, y) {
        if (type === 'move' || type === 'down') { px = x; }
      },
      draw(ctx) {
        clear(ctx, '#05040f');
        // corridor ribbons
        const pts = [];
        for (let y = -40; y <= H + 40; y += 12) {
          const c = centreAt(y, scroll), hw = halfAt(y, scroll);
          pts.push([y, c - hw, c + hw]);
        }
        ctx.fillStyle = 'rgba(61,243,255,0.07)';
        ctx.beginPath();
        ctx.moveTo(pts[0][1], pts[0][0]);
        for (const p of pts) ctx.lineTo(p[1], p[0]);
        for (let i = pts.length - 1; i >= 0; i--) ctx.lineTo(pts[i][2], pts[i][0]);
        ctx.closePath(); ctx.fill();
        ctx.strokeStyle = C.cyan; ctx.lineWidth = 3;
        ctx.save(); ctx.shadowColor = C.cyan; ctx.shadowBlur = 16;
        ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo(p[1], p[0]) : ctx.moveTo(p[1], p[0]))); ctx.stroke();
        ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo(p[2], p[0]) : ctx.moveTo(p[2], p[0]))); ctx.stroke();
        ctx.restore();
        const c = centreAt(bandY, scroll), hw = halfAt(bandY, scroll);
        const off = Math.abs(px - c);
        const inside = off <= hw;
        ctx.save();
        ctx.shadowColor = inside ? C.lime : C.red; ctx.shadowBlur = 26;
        ctx.fillStyle = inside ? C.lime : C.red;
        ctx.beginPath(); ctx.arc(px, bandY, 11, 0, TAU); ctx.fill();
        ctx.restore();
        text(ctx, `${Math.round(score)}`, 24, 34, 22, C.cyan, 'left', true);
        text(ctx, hits ? `SCRAPES ${hits}` : 'SMOOTH', W - 24, 34, 15, hits ? C.red : C.lime, 'right', true);
        if (flash > 0) { ctx.fillStyle = `rgba(255,59,92,${flash * 0.35})`; ctx.fillRect(0, 0, W, H); }
      }
    };
  }
};

/* ------------------------------------------------------------ 15. BOMB RUN */
const bombRun = {
  id: 'bomb-run', name: 'BOMB RUN', skill: 'Aim', best: 2400,
  brief: 'Shoot the red bombs. Cyan pods are friendly — leave them alone.', keys: 'mouse / tap',
  seconds: 15,
  make(api) {
    let items = [], score = 0, spawn = 0, flash = 0, shot = [];
    const baseY = H - 60;
    return {
      get score() { return Math.max(0, Math.round(score)); },
      update(dt) {
        if (flash > 0) flash -= dt;
        spawn -= dt;
        if (spawn <= 0) {
          const friendly = api.rng() < 0.22;
          items.push({
            x: 80 + api.rng() * (W - 160), y: -30,
            vy: 90 + api.rng() * 120 + (performance.now() % 1000) * 0.02,
            friendly, r: friendly ? 18 : 20, sway: api.rng() * TAU
          });
          spawn = Math.max(0.22, 0.55 - score * 0.00012) * (0.7 + api.rng() * 0.6);
        }
        for (const it of items) {
          it.y += it.vy * dt;
          it.sway += dt * 2;
          it.x += Math.sin(it.sway) * 22 * dt;
          if (it.y > baseY) {
            it.dead = true;
            if (!it.friendly) { score = Math.max(0, score - 90); flash = 0.25; api.sfx.bad(); }
          }
        }
        items = items.filter((i) => !i.dead);
        shot = shot.filter((s) => { s.age += dt; return s.age < 0.3; });
      },
      pointer(type, x, y) {
        if (type !== 'down') return;
        shot.push({ x, y, age: 0 });
        let hit = -1;
        for (let i = items.length - 1; i >= 0; i--) {
          if (dist(x, y, items[i].x, items[i].y) < items[i].r + 18) { hit = i; break; }
        }
        if (hit >= 0) {
          const it = items[hit];
          it.dead = true;
          if (it.friendly) { score -= 170; flash = 0.3; api.sfx.bad(); }
          else { score += 150; api.sfx.hit(); }
        }
      },
      draw(ctx) {
        clear(ctx, '#07030f');
        ctx.strokeStyle = 'rgba(255,47,156,0.10)';
        for (let x = 0; x < W; x += 70) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
        ctx.fillStyle = 'rgba(61,243,255,0.10)';
        ctx.fillRect(0, baseY, W, H - baseY);
        ctx.strokeStyle = C.cyan; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(0, baseY); ctx.lineTo(W, baseY); ctx.stroke();
        for (const it of items) {
          ctx.save();
          ctx.shadowColor = it.friendly ? C.cyan : C.red;
          ctx.shadowBlur = 18;
          ctx.fillStyle = it.friendly ? C.cyan : C.red;
          ctx.beginPath(); ctx.arc(it.x, it.y, it.r, 0, TAU); ctx.fill();
          ctx.restore();
          if (!it.friendly) {
            ctx.strokeStyle = '#1a0310'; ctx.lineWidth = 3;
            ctx.beginPath(); ctx.moveTo(it.x - 7, it.y - 7); ctx.lineTo(it.x + 7, it.y + 7); ctx.stroke();
          } else {
            text(ctx, '+', it.x, it.y + 1, 20, '#04252b');
          }
        }
        for (const s of shot) {
          ctx.save();
          ctx.globalAlpha = 1 - s.age / 0.3;
          ctx.strokeStyle = C.amber; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.arc(s.x, s.y, 8 + s.age * 90, 0, TAU); ctx.stroke();
          ctx.restore();
        }
        text(ctx, `${Math.max(0, Math.round(score))}`, 24, 34, 22, C.cyan, 'left', true);
        text(ctx, 'RED = SHOOT', W - 24, 34, 14, 'rgba(255,59,92,0.9)', 'right', true);
        if (flash > 0) { ctx.fillStyle = `rgba(255,59,92,${flash * 0.4})`; ctx.fillRect(0, 0, W, H); }
      }
    };
  }
};

/* ------------------------------------------------------------ 16. DOT COUNT */
const dotCount = {
  id: 'dot-count', name: 'FLASH COUNT', skill: 'Perception', best: 2200,
  brief: 'Dots flash for a heartbeat. Pick how many there were.', keys: 'mouse / tap / 1-4',
  seconds: 20,
  make(api) {
    let round = 0, dots = [], phase = 'show', t = 0, score = 0, options = [], answer = 0, picked = 0, flash = 0, msg = '';
    const build = () => {
      const n = 7 + Math.round(api.rng() * 14);
      answer = n;
      dots = [];
      for (let i = 0; i < n; i++) {
        dots.push({ x: 200 + api.rng() * (W - 400), y: 140 + api.rng() * (H - 300), r: 7 + api.rng() * 6 });
      }
      const opts = new Set([n]);
      while (opts.size < 4) {
        const d = n + ((api.rng() * 9) | 0) - 4;
        if (d > 2 && d !== n) opts.add(d);
      }
      options = shuffle(Array.from(opts));
      phase = 'show'; t = 0; picked = 0; msg = '';
    };
    build();
    return {
      get score() { return Math.max(0, Math.round(score)); },
      update(dt) {
        t += dt;
        if (flash > 0) flash -= dt;
        if (phase === 'show' && t > 1.25) { phase = 'ask'; t = 0; }
      },
      pointer(type, x, y) {
        if (type !== 'down' || phase !== 'ask') return;
        for (let i = 0; i < 4; i++) {
          const bx = W / 2 - 350 + (i % 4) * 180, by = H - 150;
          if (x >= bx && x <= bx + 164 && y >= by && y <= by + 84) this.pick(i);
        }
      },
      key(code, down) {
        if (!down) return;
        const m = /^Digit([1-4])$/.exec(code);
        if (m) this.pick(+m[1] - 1);
      },
      pick(i) {
        if (phase !== 'ask' || picked) return;
        picked = 1;
        if (options[i] === answer) {
          score += 250 + Math.round(Math.max(0, 80 - t * 30));
          msg = 'CLEAN'; api.sfx.ok();
        } else {
          score -= 120; msg = `IT WAS ${answer}`; api.sfx.bad(); flash = 0.25;
        }
        round++;
        setTimeout(() => { if (round >= 6) api.done(Math.max(0, Math.round(score))); else build(); }, 620);
      },
      draw(ctx) {
        clear(ctx, '#05040f');
        if (phase === 'show') {
          for (const d of dots) {
            ctx.save();
            ctx.shadowColor = C.cyan; ctx.shadowBlur = 14;
            ctx.fillStyle = C.cyan;
            ctx.beginPath(); ctx.arc(d.x, d.y, d.r, 0, TAU); ctx.fill();
            ctx.restore();
          }
          const p = 1 - t / 1.25;
          ctx.fillStyle = 'rgba(255,255,255,0.1)'; ctx.fillRect(W / 2 - 160, H - 60, 320, 5);
          ctx.fillStyle = C.cyan; ctx.fillRect(W / 2 - 160, H - 60, 320 * p, 5);
        } else {
          text(ctx, 'HOW MANY?', W / 2, H / 2 - 40, 52, '#fff');
          if (msg) text(ctx, msg, W / 2, H / 2 + 20, 22, msg === 'CLEAN' ? C.lime : C.red);
          for (let i = 0; i < 4; i++) {
            const bx = W / 2 - 350 + i * 180, by = H - 150;
            ctx.fillStyle = 'rgba(255,255,255,0.06)';
            rr(ctx, bx, by, 164, 84, 3); ctx.fill();
            ctx.strokeStyle = 'rgba(61,243,255,0.5)'; ctx.lineWidth = 2; ctx.stroke();
            text(ctx, String(options[i]), bx + 82, by + 44, 40, C.cyan);
            text(ctx, String(i + 1), bx + 12, by + 14, 11, 'rgba(255,255,255,0.3)', 'left', true);
          }
        }
        text(ctx, `${round} / 6`, W / 2, 34, 16, 'rgba(236,235,255,0.5)', 'center', true);
        text(ctx, `${Math.max(0, Math.round(score))}`, 24, 34, 22, C.cyan, 'left', true);
        if (flash > 0) { ctx.fillStyle = `rgba(255,59,92,${flash * 0.35})`; ctx.fillRect(0, 0, W, H); }
      }
    };
  }
};

/* ---------------------------------------------------------- 17. RHYTHM RING */
const rhythmRing = {
  id: 'rhythm-ring', name: 'RHYTHM RING', skill: 'Timing', best: 2600,
  brief: 'Tap when the shrinking ring meets the core circle.', keys: 'click / tap / space',
  seconds: 16,
  make(api) {
    const beats = 12, gap = 0.78, target = 46;
    let beat = 0, t = 0, score = 0, last = '', flash = 0, judged = false;
    return {
      get score() { return Math.max(0, Math.round(score)); },
      update(dt) {
        if (flash > 0) flash -= dt;
        t += dt;
        if (t >= gap) { t -= gap; beat++; judged = false; last = ''; api.sfx.tick(); }
        if (beat >= beats) api.done(Math.max(0, Math.round(score)));
      },
      pointer(type) { if (type === 'down') this.tap(); },
      key(code, down) { if (down && (code === 'Space' || code === 'Enter')) this.tap(); },
      tap() {
        if (judged || beat >= beats) return;
        const p = t / gap;
        const r = 250 - (250 - target) * p;
        const err = Math.abs(r - target);
        judged = true;
        if (err < 7) { score += 240; last = 'PERFECT'; api.sfx.perfect(); }
        else if (err < 22) { score += 150; last = 'GOOD'; api.sfx.ok(); }
        else if (err < 46) { score += 70; last = 'LATE'; api.sfx.hit(); }
        else { score = Math.max(0, score - 40); last = 'MISS'; api.sfx.bad(); flash = 0.2; }
      },
      draw(ctx) {
        clear(ctx, '#08050f');
        const cx = W / 2, cy = H / 2, p = Math.min(1, t / gap);
        const r = 250 - (250 - target) * p;
        ctx.save();
        ctx.strokeStyle = 'rgba(139,92,255,0.35)'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(cx, cy, 250, 0, TAU); ctx.stroke();
        ctx.restore();
        // core
        ctx.save();
        ctx.shadowColor = C.magenta; ctx.shadowBlur = 30;
        ctx.strokeStyle = C.magenta; ctx.lineWidth = 6;
        ctx.beginPath(); ctx.arc(cx, cy, target, 0, TAU); ctx.stroke();
        ctx.restore();
        // moving ring
        const close = Math.abs(r - target) < 24;
        ctx.save();
        ctx.shadowColor = close ? C.lime : C.cyan; ctx.shadowBlur = close ? 34 : 18;
        ctx.strokeStyle = close ? C.lime : C.cyan; ctx.lineWidth = 5;
        ctx.beginPath(); ctx.arc(cx, cy, Math.max(10, r), 0, TAU); ctx.stroke();
        ctx.restore();
        // beat pips
        for (let i = 0; i < beats; i++) {
          const bx = W / 2 - (beats - 1) * 13 + i * 26;
          ctx.fillStyle = i < beat ? C.lime : i === beat ? C.cyan : 'rgba(255,255,255,0.14)';
          ctx.fillRect(bx - 8, H - 44, 16, 6);
        }
        text(ctx, last || 'TAP ON THE CORE', W / 2, 60, 24, last === 'PERFECT' ? C.gold : last === 'MISS' ? C.red : 'rgba(236,235,255,0.6)');
        text(ctx, `${beat} / ${beats}`, W / 2, H - 70, 16, 'rgba(236,235,255,0.45)', 'center', true);
        text(ctx, `${Math.max(0, Math.round(score))}`, 24, 34, 22, C.cyan, 'left', true);
        if (flash > 0) { ctx.fillStyle = `rgba(255,59,92,${flash * 0.3})`; ctx.fillRect(0, 0, W, H); }
      }
    };
  }
};

/* ----------------------------------------------------------- 18. GRID RECALL */
const gridRecall = {
  id: 'grid-recall', name: 'GRID RECALL', skill: 'Memory', best: 2400,
  brief: 'Memorise the lit cells, then rebuild the pattern exactly.', keys: 'mouse / tap',
  seconds: 22,
  make(api) {
    const n = 5;
    const size = 92, gap = 8;
    const ox = (W - (n * size + (n - 1) * gap)) / 2, oy = (H - (n * size + (n - 1) * gap)) / 2 + 12;
    let round = 0, pattern = new Set(), picked = new Set(), phase = 'show', t = 0, score = 0, flash = 0, wrong = 0;
    const build = () => {
      const count = 5 + round;
      pattern = new Set();
      while (pattern.size < count) pattern.add((api.rng() * n * n) | 0);
      picked = new Set();
      phase = 'show'; t = 0; wrong = 0;
    };
    build();
    return {
      get score() { return Math.max(0, Math.round(score)); },
      update(dt) {
        t += dt;
        if (flash > 0) flash -= dt;
        if (phase === 'show' && t > 1.5 + round * 0.18) { phase = 'input'; t = 0; }
      },
      pointer(type, x, y) {
        if (type !== 'down' || phase !== 'input') return;
        const cx = Math.floor((x - ox) / (size + gap)), cy = Math.floor((y - oy) / (size + gap));
        if (cx < 0 || cy < 0 || cx >= n || cy >= n) return;
        const idx = cy * n + cx;
        if (picked.has(idx)) return;
        if (pattern.has(idx)) {
          picked.add(idx); score += 90; api.sfx.tone({ freq: 500 + picked.size * 40, dur: 0.07, vol: 0.12, type: 'square' });
          if (picked.size === pattern.size) {
            score += 160; api.sfx.ok();
            round++;
            if (round >= 5) api.done(Math.round(score)); else build();
          }
        } else {
          wrong++; flash = 0.2; api.sfx.bad(); score = Math.max(0, score - 70);
        }
      },
      draw(ctx) {
        clear(ctx, '#05040f');
        for (let i = 0; i < n * n; i++) {
          const x = ox + (i % n) * (size + gap), y = oy + Math.floor(i / n) * (size + gap);
          const lit = pattern.has(i);
          const got = picked.has(i);
          ctx.fillStyle = got ? 'rgba(185,255,66,0.22)' : lit && phase === 'show' ? 'rgba(61,243,255,0.32)' : 'rgba(255,255,255,0.04)';
          rr(ctx, x, y, size, size, 2); ctx.fill();
          ctx.strokeStyle = got ? C.lime : lit && phase === 'show' ? C.cyan : 'rgba(139,92,255,0.35)';
          ctx.lineWidth = lit && phase === 'show' ? 3 : 1.5;
          rr(ctx, x, y, size, size, 2); ctx.stroke();
        }
        text(ctx, phase === 'show' ? 'MEMORISE' : 'REBUILD THE PATTERN', W / 2, oy - 40, 26, phase === 'show' ? C.amber : C.cyan);
        text(ctx, `${round + 1} / 5`, W / 2, H - 30, 16, 'rgba(236,235,255,0.5)', 'center', true);
        text(ctx, `${Math.max(0, Math.round(score))}`, 24, 34, 22, C.cyan, 'left', true);
        if (flash > 0) { ctx.fillStyle = `rgba(255,59,92,${flash * 0.3})`; ctx.fillRect(0, 0, W, H); }
      }
    };
  }
};

export const SET_TWO = [orbRush, mashMeter, whackGrid, balance, thread, bombRun, dotCount, rhythmRing, gridRecall];
