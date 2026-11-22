import * as THREE from 'three';
import { createStore, CROPS } from './store.js';
import { createWorld, ZONES, OBSTACLES, MAP } from './world.js';
import { createTractor, IMPLEMENTS } from './tractor.js';
import { createField, FIELD } from './field.js';
import { createUI } from './ui.js';

/* =====================================================================
   COZY FARM — a little tractor, a big meadow
   Drive, hitch a tool, work the field, sell at the farm shop.
   ===================================================================== */

const canvas = document.getElementById('gl');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.background = new THREE.Color('#e8e2cd');
const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 500);

const hemi = new THREE.HemisphereLight('#eaf4ff', '#cbb28d', 0.95);
scene.add(hemi);
const sun = new THREE.DirectionalLight('#ffe6bd', 2.05);
sun.position.set(28, 40, 18);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
sun.shadow.camera.left = -38;
sun.shadow.camera.right = 38;
sun.shadow.camera.top = 38;
sun.shadow.camera.bottom = -38;
sun.shadow.camera.near = 1;
sun.shadow.camera.far = 120;
sun.shadow.bias = -0.0007;
sun.shadow.normalBias = 0.02;
scene.add(sun);
const fill = new THREE.DirectionalLight('#cfe4ff', 0.4);
fill.position.set(-30, 18, -26);
scene.add(fill);

const store = createStore(FIELD.cols, FIELD.rows);
const state = store.state;
const world = createWorld(scene);
const field = createField(scene, state.tiles);
const tractor = createTractor(scene);

const input = { forward: 0, back: 0, left: 0, right: 0 };
const cam = { yaw: 0, offset: 0.4, pitch: 0.48, dist: 18, dragging: false, px: 0, py: 0, pinned: 0, points: new Map() };

let started = false;
let lastWorkAt = 0;
let lastToastAt = 0;
let growthAt = 0;
let uiAt = 0;
let lastDay = state.day;
let trailerBales = 0;
const bales = [];
const workTools = new Set(['plow', 'seed', 'water', 'fertilize', 'harvest', 'mower']);

// fence runs the tractor should not drive through; the field gate is the gap
// between (-6.2, 2.4) and (1.2, 2.4)
const FENCES = [
  [-12.4, 2.4, -6.2, 2.4], [1.2, 2.4, 11.4, 2.4],
  [-12.4, 2.4, -12.4, -16.2], [11.4, 2.4, 11.4, -16.2], [-12.4, -16.2, 11.4, -16.2],
  [-31, 3, -17, 3], [-31, 3, -31, -12]
];

/* ---------- atmosphere: dust, chaff and spray ----------------------- */
function particleTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const x = c.getContext('2d');
  const grad = x.createRadialGradient(32, 32, 2, 32, 32, 30);
  grad.addColorStop(0, 'rgba(255,255,255,0.95)');
  grad.addColorStop(0.55, 'rgba(255,255,255,0.4)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = grad;
  x.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

const sparkTex = particleTexture();
const particles = [];
for (let i = 0; i < 90; i++) {
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: sparkTex, transparent: true, depthWrite: false }));
  sprite.visible = false;
  scene.add(sprite);
  particles.push({ sprite, life: 0, max: 1, vy: 0, vx: 0, vz: 0, grow: 1 });
}

function puff(x, y, z, color, count = 4, spread = 0.5, size = 0.55, rise = 1.2, grow = 1.6) {
  for (let i = 0; i < count; i++) {
    const p = particles.find(q => q.life <= 0);
    if (!p) return;
    p.life = p.max = 0.6 + Math.random() * 0.6;
    p.sprite.visible = true;
    p.sprite.material.color.set(color);
    p.sprite.material.opacity = 0.65;
    p.sprite.position.set(x + (Math.random() - 0.5) * spread, y + Math.random() * 0.2, z + (Math.random() - 0.5) * spread);
    p.sprite.scale.setScalar(size * (0.6 + Math.random() * 0.7));
    p.vy = rise * (0.6 + Math.random() * 0.6);
    p.vx = (Math.random() - 0.5) * 0.6;
    p.vz = (Math.random() - 0.5) * 0.6;
    p.grow = grow;
  }
}

function updateParticles(dt) {
  particles.forEach(p => {
    if (p.life <= 0) return;
    p.life -= dt;
    p.sprite.position.x += p.vx * dt;
    p.sprite.position.y += p.vy * dt;
    p.sprite.position.z += p.vz * dt;
    p.vy -= dt * 0.9;
    p.sprite.scale.multiplyScalar(1 + dt * p.grow);
    p.sprite.material.opacity = Math.max(0, p.life / p.max) * 0.6;
    if (p.life <= 0) p.sprite.visible = false;
  });
}

/* ---------- hay bales ---------------------------------------------- */
const baleGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.85, 12);
const baleMat = new THREE.MeshStandardMaterial({ color: '#dcc27c', roughness: 0.95 });
const bandMat = new THREE.MeshStandardMaterial({ color: '#b99a58', roughness: 0.9 });

function spawnBale(x, z) {
  const g = new THREE.Group();
  const roll = new THREE.Mesh(baleGeo, baleMat);
  roll.rotation.z = Math.PI / 2;
  roll.castShadow = true;
  roll.receiveShadow = true;
  g.add(roll);
  [-0.25, 0.25].forEach(o => {
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.43, 0.018, 5, 14), bandMat);
    band.position.x = o;
    band.rotation.y = Math.PI / 2;
    g.add(band);
  });
  g.position.set(x, 0.45, z);
  g.scale.setScalar(0.01);
  scene.add(g);
  bales.push({ group: g, x, z, born: performance.now() });
}

function updateBales(dt, now) {
  for (let i = bales.length - 1; i >= 0; i--) {
    const bale = bales[i];
    const age = (now - bale.born) / 1000;
    bale.group.scale.setScalar(Math.min(1, 0.25 + age * 2.4));
    if (state.tool !== 'trailer') continue;
    const d = Math.hypot(tractor.position.x - bale.x, tractor.position.z - bale.z);
    if (d < 2.6) {
      store.addHay(1);
      store.save();
      trailerBales = Math.min(6, trailerBales + 1);
      puff(bale.x, 0.6, bale.z, '#e6d19a', 5, 0.5, 0.4, 1.4);
      scene.remove(bale.group);
      bales.splice(i, 1);
      ui.toast('Bale loaded', 'The trailer is taking them to the shop.', 'good');
    }
  }
  const trailer = tractor.implements.trailer;
  if (trailer && trailer.userData.bales) {
    trailer.userData.bales.visible = trailerBales > 0;
    trailer.userData.bales.children.forEach((child, i) => { child.visible = i < trailerBales; });
  }
}

/* ---------- the tools ---------------------------------------------- */
function chooseTool(id) {
  const def = IMPLEMENTS.find(t => t.id === id);
  if (!def) return;
  if (state.tool === id) {
    state.tool = '';
    tractor.detach();
    store.touch();
    ui.toast('Tool unhitched', 'Pick another from the row below.', 'soft');
    return;
  }
  state.tool = id;
  tractor.setTool(id);
  store.touch();
  store.save();
  ui.toast(def.name + ' hitched', def.tag, 'good');
}

function chooseCrop(id) {
  const crop = store.cropById(id);
  state.selectedCrop = crop.id;
  store.save();
  ui.toast(crop.name + ' in the drill', crop.seed + ' kr of seed per square.', 'good');
}

function sell() {
  const near = Math.hypot(tractor.position.x - ZONES.shop.x, tractor.position.z - ZONES.shop.z) < ZONES.shop.r;
  if (!near) {
    ui.toast('Not at the shop', 'Drive to the stall with the striped awning, then sell.', 'bad');
    return;
  }
  const result = store.sellAll();
  if (result.total <= 0) {
    ui.toast('Nothing to sell', 'Harvest a crop or pick up some hay first.', 'soft');
    return;
  }
  trailerBales = 0;
  puff(tractor.position.x, 1.6, tractor.position.z, '#f3d68e', 10, 1.2, 0.5, 1.8);
  const list = result.lines.map(l => l.bales ? l.kg + (l.kg === 1 ? ' bale' : ' bales') : Math.round(l.kg) + ' kg ' + l.name.toLowerCase()).join(', ');
  ui.toast('Sold at market', store.money(result.total) + ' · ' + list, 'good');
  store.save();
}

/* ---------- driving aids ------------------------------------------- */
function keepOnFarm() {
  const p = tractor.position;
  p.x = Math.max(MAP.minX, Math.min(MAP.maxX, p.x));
  p.z = Math.max(MAP.minZ, Math.min(MAP.maxZ, p.z));
  OBSTACLES.forEach(o => {
    const dx = p.x - o.x, dz = p.z - o.z;
    const d = Math.hypot(dx, dz);
    const min = o.r + 1.35;
    if (d < min && d > 0.0001) {
      p.x = o.x + (dx / d) * min;
      p.z = o.z + (dz / d) * min;
      tractor.speed *= 0.55;
    }
  });
  FENCES.forEach(([x1, z1, x2, z2]) => {
    const dx = x2 - x1, dz = z2 - z1;
    const len2 = dx * dx + dz * dz;
    const t = Math.max(0, Math.min(1, ((p.x - x1) * dx + (p.z - z1) * dz) / len2));
    const cx = x1 + dx * t, cz = z1 + dz * t;
    let ox = p.x - cx, oz = p.z - cz;
    let d = Math.hypot(ox, oz);
    if (d >= 1.15) return;
    if (d < 0.0001) { ox = dz; oz = -dx; d = Math.hypot(ox, oz); }
    p.x = cx + (ox / d) * 1.15;
    p.z = cz + (oz / d) * 1.15;
    tractor.speed *= 0.7;
  });
}

function nearShop() {
  return Math.hypot(tractor.position.x - ZONES.shop.x, tractor.position.z - ZONES.shop.z) < ZONES.shop.r;
}
function nearPond() {
  return Math.hypot(tractor.position.x - ZONES.pond.x, tractor.position.z - ZONES.pond.z) < ZONES.pond.r;
}

function gameToast(title, text, tone) {
  const now = performance.now();
  if (now - lastToastAt < 900) return;
  lastToastAt = now;
  ui.toast(title, text, tone);
}

function canWork(tile, now) {
  if (!tile) return false;
  switch (state.tool) {
    case 'plow': return tile.state === 'grass' || tile.state === 'mowed' || tile.state === 'stubble';
    case 'seed': return tile.state === 'plowed' && state.money >= store.cropById(state.selectedCrop).seed;
    case 'water': return tile.state === 'crop' && !tile.watered && state.water > 0.01;
    case 'fertilize': return tile.state === 'crop' && !tile.fertilized && state.fertilizer > 0.01;
    case 'harvest': return tile.state === 'crop' && tile.ready;
    case 'mower': return tile.state === 'grass' && Date.now() - tile.mowedAt > 18000;
    default: return false;
  }
}

function workLoop(now) {
  if (!started || !workTools.has(state.tool)) { field.showHighlight(null); return; }
  const target = field.nearestTile(tractor.work, 1.7);
  field.showHighlight(target);
  if (!target) return;
  if (Math.abs(tractor.speed) < 0.35) return;
  if (now - lastWorkAt < 300) return;
  if (!canWork(target, now)) return;

  const result = field.work(target, state.tool, state.selectedCrop, store, now);
  if (!result.ok) {
    if (result.reason === 'money') gameToast('The seed drawer is empty', 'You need ' + result.cost + ' kr for that square.', 'bad');
    if (result.reason === 'needs-plough') gameToast('Plough first', 'Seeds only go into bare, ploughed soil.', 'soft');
    return;
  }
  lastWorkAt = now;

  if (result.kind === 'plow') {
    puff(target.x, 0.25, target.z, '#b28a5f', 4, 0.7, 0.4, 0.9);
  } else if (result.kind === 'seed') {
    puff(target.x, 0.3, target.z, '#efe0b8', 3, 0.6, 0.3, 1.1);
    gameToast('Sowing ' + store.cropById(result.crop).name, result.cost + ' kr of seed · keep the rows watered', 'good');
  } else if (result.kind === 'water') {
    state.water = Math.max(0, state.water - 0.018);
    puff(target.x, 0.5, target.z, '#bfe0e8', 4, 0.5, 0.3, 0.7);
  } else if (result.kind === 'fertilize') {
    state.fertilizer = Math.max(0, state.fertilizer - 0.024);
    puff(target.x, 0.5, target.z, '#d9e4c2', 4, 0.5, 0.3, 0.8);
  } else if (result.kind === 'harvest') {
    puff(target.x, 0.7, target.z, store.cropById(result.crop).head, 6, 0.6, 0.35, 1.2);
    gameToast(store.cropById(result.crop).name + ' harvested', '+' + result.kg + ' kg into the barn', 'good');
  } else if (result.kind === 'mow') {
    puff(target.x, 0.4, target.z, '#d9d29a', 5, 0.7, 0.35, 0.9);
    spawnBale(target.x, target.z);
    if (trailerBales === 0 && state.tool !== 'trailer') gameToast('Bale ready', 'Hitch the hay trailer to pick up the bales.', 'soft');
  }
  store.touch();
}

/* ---------- camera -------------------------------------------------- */
function updateCamera(dt) {
  const target = new THREE.Vector3(tractor.position.x, 2.0, tractor.position.z).addScaledVector(tractor.forward, 1.8);
  const yaw = tractor.heading + Math.PI + cam.offset + cam.yaw;
  const d = cam.dist;
  const wanted = new THREE.Vector3(
    target.x + Math.sin(yaw) * Math.cos(cam.pitch) * d,
    target.y + Math.sin(cam.pitch) * d,
    target.z + Math.cos(yaw) * Math.cos(cam.pitch) * d
  );
  camera.position.lerp(wanted, 1 - Math.pow(0.0008, dt));
  camera.lookAt(target);
  if (Math.abs(tractor.speed) > 0.5) cam.yaw *= Math.pow(0.35, dt);
}

function resetCamera() {
  cam.yaw = 0;
  cam.pitch = 0.48;
  cam.dist = 18;
}

/* ---------- interface ---------------------------------------------- */
const ui = createUI({
  store,
  input,
  onTool: chooseTool,
  onCrop: chooseCrop,
  onSell: sell,
  onReset: () => { store.reset(); location.reload(); },
  onStart: () => { started = true; }
});

function hintText(now) {
  const s = state;
  if (!started) return '';
  if (s.tool === 'water' && s.water < 0.15 && !nearPond()) return 'Water tank low — refill at the pond';
  if (s.tool === 'fertilize' && s.fertilizer < 0.15 && !nearShop()) return 'Spreader empty — refill at the farm shop';
  if (nearShop() && store.barnValue() > 0) return 'At the shop — open Market and sell';
  if (bales.length && s.tool !== 'trailer') return 'Bales on the grass — hitch the hay trailer';
  if (!s.tool) return 'Pick a tool from the row below the field';
  if (s.tool === 'harvest' && s.stats.planted > 0 && !field.tiles.some(t => t.ready)) {
    return 'Nothing ripe yet — water and feed the rows to hurry them along';
  }
  if (s.tool === 'plow' && s.stats.plowed < 6) return 'Drive over the meadow with the plough';
  if (s.tool === 'seed' && s.stats.plowed === 0) return 'Plough a strip first, then sow';
  const target = field.nearestTile(tractor.work, 1.7);
  if (target && !canWork(target, now)) {
    if (s.tool === 'seed' && target.state !== 'plowed') return 'This square needs ploughing first';
    if (s.tool === 'water' && target.state === 'crop' && target.watered) return 'This row is already watered';
    if (s.tool === 'harvest' && target.state === 'crop' && !target.ready) return 'Still growing — give it a moment';
    if (s.tool === 'mower' && target.state === 'mowed') return 'The grass here is still short';
  }
  return '';
}

document.querySelectorAll('[data-tool]').forEach(el => el.setAttribute('aria-label', 'Hitch tool'));

/* ---------- input --------------------------------------------------- */
const keyMap = {
  ArrowUp: 'forward', KeyW: 'forward',
  ArrowDown: 'back', KeyS: 'back',
  ArrowLeft: 'left', KeyA: 'left',
  ArrowRight: 'right', KeyD: 'right'
};
window.addEventListener('keydown', e => {
  if (e.code === 'Escape') { ui.closeSheet(); return; }
  if (e.code === 'KeyH') { ui.openSheet('help'); return; }
  if (e.code === 'KeyM') { ui.openSheet('market'); return; }
  const dir = keyMap[e.code];
  if (dir) { input[dir] = 1; e.preventDefault(); return; }
  if (/^Digit[1-7]$/.test(e.code)) {
    const tool = IMPLEMENTS[Number(e.code.slice(5)) - 1];
    if (tool) chooseTool(tool.id);
  }
});
window.addEventListener('keyup', e => {
  const dir = keyMap[e.code];
  if (dir) { input[dir] = 0; e.preventDefault(); }
});
window.addEventListener('blur', () => { input.forward = input.back = input.left = input.right = 0; });

// camera drag and pinch
canvas.addEventListener('pointerdown', e => {
  canvas.setPointerCapture(e.pointerId);
  cam.points.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (cam.points.size === 1) {
    cam.dragging = true;
    cam.px = e.clientX;
    cam.py = e.clientY;
  }
});
canvas.addEventListener('pointermove', e => {
  if (!cam.points.has(e.pointerId)) return;
  const prev = cam.points.get(e.pointerId);
  cam.points.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (cam.points.size >= 2) {
    const pts = [...cam.points.values()];
    const before = Math.hypot(pts[0].x - prev.x, pts[0].y - prev.y);
    const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
    cam.dist = Math.max(8, Math.min(24, cam.dist + (before - dist) * 0.02));
    return;
  }
  if (!cam.dragging) return;
  const dx = e.clientX - cam.px;
  const dy = e.clientY - cam.py;
  cam.px = e.clientX;
  cam.py = e.clientY;
  cam.yaw -= dx * 0.006;
  cam.pitch = Math.max(0.14, Math.min(0.9, cam.pitch + dy * 0.003));
});
function endPointer(e) {
  cam.points.delete(e.pointerId);
  if (cam.points.size === 0) cam.dragging = false;
}
canvas.addEventListener('pointerup', endPointer);
canvas.addEventListener('pointercancel', endPointer);
canvas.addEventListener('dblclick', resetCamera);
canvas.addEventListener('wheel', e => {
  e.preventDefault();
  cam.dist = Math.max(8, Math.min(24, cam.dist + e.deltaY * 0.012));
}, { passive: false });

/* ---------- size ---------------------------------------------------- */
function resize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / Math.max(1, h);
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();

/* ---------- start the day ------------------------------------------ */
if (IMPLEMENTS.some(t => t.id === state.tool)) tractor.setTool(state.tool);
else { state.tool = 'plow'; tractor.setTool('plow'); }

resetCamera();
camera.position.set(-4, 13.5, 29);
camera.lookAt(-4, 2, 2);

let seen = false;
try { seen = localStorage.getItem('cozy-farm-seen') === '1'; } catch (error) { /* blocked */ }
ui.showIntro(!seen);
if (seen) ui.start();

let last = performance.now();
let elapsed = 0;

function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  elapsed += dt;

  if (started) {
    tractor.update(dt, input, elapsed);
    keepOnFarm();
  } else {
    tractor.update(dt, { forward: 0, back: 0, left: 0, right: 0 }, elapsed);
  }

  world.update(dt);
  updateParticles(dt);
  updateBales(dt, now);
  workLoop(now);
  updateCamera(dt);

  if (now - growthAt > 420) {
    growthAt = now;
    field.updateGrowth(now);
    if (nearPond() && state.water < 1) state.water = Math.min(1, state.water + 0.012);
    if (nearShop() && state.fertilizer < 1) state.fertilizer = Math.min(1, state.fertilizer + 0.008);
    store.tickMarket(now);
    if (state.day !== lastDay) {
      lastDay = state.day;
      ui.toast('A new day on the farm', 'The market has moved. Check the board before you sell.', 'soft');
    }
  }

  if (now - uiAt > 160) {
    uiAt = now;
    ui.update({
      speedKmh: tractor.speedKmh,
      nearShop: nearShop(),
      nearPond: nearPond(),
      hint: hintText(now)
    });
  }

  store.tickSave(dt, now);
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

window.addEventListener('beforeunload', () => store.save());
document.addEventListener('visibilitychange', () => { if (document.hidden) store.save(); });
