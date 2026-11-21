// ---------------------------------------------------------------------------
// City Chaos: bootstrap, input and the frame loop. Systems talk through this
// file: the city, the player, the people, the tools and the interface all get
// the same `game` handle.
// ---------------------------------------------------------------------------
import * as THREE from 'three';
import RAPIER from 'rapier';
import { createRenderer, createAtmosphere, createLights, createDaylight, clamp } from './core.js';
import { QUALITY, TIME_PRESETS, TOOLS, TOOL_KEYS, CATALOG } from './config.js';
import { Physics } from './physics.js';
import { FX } from './fx.js';
import { GameAudio } from './audio.js';
import { City } from './city.js';
import { NPCManager } from './npc.js';
import { Player } from './player.js';
import { Tools } from './tools.js';
import { UI } from './ui.js';
import { spawnItem, buildVisual } from './entities.js';

const canvas = document.getElementById('view');

const game = {
  qualityName: 'medium',
  settings: { mouseSensitivity: 100, camSensitivity: 100, shake: 0.7 },
  input: { keys: new Set(), jumpQueued: false, fLatch: false },
  vehicles: [],
  ragdolls: [],
  specials: [],
  thumbs: new Map(),
  paused: false,
  unlocking: false,
  pointerLocked: false,
  lastTime: 0,
};
window.CITY = game;
game.ui = new UI(game);

// ---------------------------------------------------------------------------
// Input
// ---------------------------------------------------------------------------
function bindInput() {
  const ui = game.ui;

  window.addEventListener('keydown', (event) => {
    game.audio?.start();
    game.audio?.resume();
    if (event.code === 'Tab') {
      event.preventDefault();
      if (ui.modal === 'spawn') ui.closeSpawn();
      else if (!ui.modal) ui.openSpawn();
      return;
    }
    if (event.code === 'Escape') {
      event.preventDefault();
      ui.togglePause();
      return;
    }
    if (ui.modal) {
      if (event.code === 'Enter' && ui.selectedItem) ui.spawnSelected();
      return;
    }

    const tool = TOOLS.find((entry) => entry.key === event.key);
    if (tool && /^[0-9]$/.test(event.key)) {
      game.tools.setTool(tool.id);
      return;
    }

    switch (event.code) {
      case 'Space':
        event.preventDefault();
        game.input.keys.add('Space');
        game.input.jumpQueued = true;
        break;
      case 'KeyF':
        if (!game.input.fLatch) {
          game.input.fLatch = true;
          if (game.player.mode === 'vehicle') game.player.exitVehicle(false);
          else if (game.player.enterHint) game.player.enterVehicle(game.player.enterHint);
        }
        break;
      case 'KeyV':
        game.player.toggleFreeCam(!game.player.freeCam);
        break;
      case 'KeyG': {
        const order = ['day', 'dusk', 'night'];
        const next = order[(order.indexOf(game.daylight.state.mode) + 1) % order.length];
        game.daylight.setMode(next);
        game.ui.setTimeMode(next);
        game.ui.setTimeSelect(next);
        game.ui.toast(next === 'day' ? 'Daylight' : next === 'dusk' ? 'Dusk' : 'Night');
        break;
      }
      case 'KeyR':
        game.tools.keyRotate();
        break;
      case 'KeyX': {
        const hit = game.tools.aim();
        game.tools.deleteEntity(game.tools.usable(hit), hit);
        break;
      }
      case 'KeyM':
        ui.openSpawn();
        break;
      case 'KeyH':
        game.ui.toast('WASD move · Shift run · Space jump · Tab spawn · F drive · V free camera · G time · Esc menu');
        break;
      default:
        break;
    }
    game.input.keys.add(event.code);
  });

  window.addEventListener('keyup', (event) => {
    game.input.keys.delete(event.code);
    if (event.code === 'KeyF') game.input.fLatch = false;
  });

  window.addEventListener('blur', () => {
    game.input.keys.clear();
  });

  canvas.addEventListener('mousedown', (event) => {
    game.audio?.start();
    game.audio?.resume();
    if (ui.modal) return;
    if (!game.pointerLocked) {
      lockPointer();
      return;
    }
    if (event.button === 0) game.tools.primaryDown();
    else if (event.button === 2) game.tools.secondaryDown();
  });

  window.addEventListener('mouseup', (event) => {
    if (event.button === 0) game.tools.primaryUp();
  });

  window.addEventListener('mousemove', (event) => {
    if (!game.pointerLocked || game.paused || ui.modal) return;
    game.player.look(event.movementX || 0, event.movementY || 0);
  });

  canvas.addEventListener('wheel', (event) => {
    if (ui.modal || game.paused) return;
    event.preventDefault();
    const shift = event.shiftKey;
    game.tools.wheel(event.deltaY, shift);
  }, { passive: false });

  canvas.addEventListener('contextmenu', (event) => event.preventDefault());

  document.addEventListener('pointerlockchange', () => {
    const locked = document.pointerLockElement === canvas;
    game.pointerLocked = locked;
    if (!locked && !game.unlocking && !ui.modal && !game.paused) {
      ui.openPause();
    }
    game.unlocking = false;
  });
}

function lockPointer() {
  if (!canvas.requestPointerLock) return;
  game.unlocking = false;
  try {
    const result = canvas.requestPointerLock();
    if (result && typeof result.catch === 'function') result.catch(() => {});
  } catch (error) { /* the menu still works without a lock */ }
}

function releasePointer() {
  game.unlocking = true;
  if (document.pointerLockElement) document.exitPointerLock();
}

// ---------------------------------------------------------------------------
// Spawning from the menu
// ---------------------------------------------------------------------------
function spawnPointFor(item) {
  const camera = game.camera;
  const direction = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
  const isVehicle = item.cat === 'vehicles';
  const lift = isVehicle ? 1.3 : 0.5;

  if (game.player.freeCam) {
    const hit = game.physics.raycast(camera.position, direction, 60, null);
    if (hit) {
      const point = hit.point.clone().addScaledVector(hit.normal, lift + 0.3);
      return point;
    }
    return camera.position.clone().addScaledVector(direction, 12);
  }

  const base = game.player.mode === 'vehicle' && game.player.vehicle
    ? game.player.vehicle.entity.body.translation()
    : game.player.entity.body.translation();
  const flat = new THREE.Vector3(-Math.sin(game.player.yaw), 0, -Math.cos(game.player.yaw));
  const position = new THREE.Vector3(base.x, base.y, base.z).addScaledVector(flat, isVehicle ? 8 : 4.5);
  const ground = game.physics.raycast(
    new THREE.Vector3(position.x, position.y + 12, position.z),
    new THREE.Vector3(0, -1, 0), 30, null
  );
  position.y = (ground ? ground.point.y : 0.2) + lift + 0.6;
  return position;
}

game.spawnFromMenu = (item) => {
  if (!item) return null;
  const quality = QUALITY[game.qualityName];
  const count = [...game.physics.entities].filter((entity) => entity.kind === 'prop' || entity.kind === 'vehicle').length;
  if (count >= quality.props) {
    game.ui.toast('Object limit reached. Delete something, or raise physics quality.', 'bad');
    return null;
  }
  const position = spawnPointFor(item);
  const heading = game.player.freeCam ? game.player.yaw + Math.PI : game.player.yaw + Math.PI;
  const entity = spawnItem(game, item.id, position, { heading });
  if (entity) game.audio?.pop(position, 0.35);
  return entity;
};

// Thumbnails: one tiny offscreen renderer, one PNG per catalogue entry.
game.makeThumb = (item) => {
  if (game.thumbs.has(item.id)) return game.thumbs.get(item.id);
  try {
    if (!game.thumbRenderer) {
      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
      renderer.setPixelRatio(1);
      renderer.setSize(220, 165);
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.0;
      const scene = new THREE.Scene();
      scene.add(new THREE.HemisphereLight(0xdbe9f2, 0x35434c, 1.2));
      const key = new THREE.DirectionalLight(0xfff4e2, 1.8);
      key.position.set(4, 6, 5);
      scene.add(key);
      const rim = new THREE.DirectionalLight(0x8ec8ff, 0.9);
      rim.position.set(-4, 3, -5);
      scene.add(rim);
      const camera = new THREE.PerspectiveCamera(36, 220 / 165, 0.1, 200);
      game.thumbRenderer = renderer;
      game.thumbScene = scene;
      game.thumbCamera = camera;
    }
    const mesh = buildVisual(item);
    const bounds = new THREE.Box3().setFromObject(mesh);
    if (!bounds.isEmpty()) {
      const sphere = bounds.getBoundingSphere(new THREE.Sphere());
      mesh.position.sub(sphere.center);
      const distance = (sphere.radius / Math.sin((36 * Math.PI) / 360)) * 1.02;
      game.thumbCamera.position.set(distance * 0.72, distance * 0.5, distance * 0.86);
      game.thumbCamera.lookAt(0, 0, 0);
    }
    game.thumbScene.add(mesh);
    game.thumbRenderer.render(game.thumbScene, game.thumbCamera);
    const url = game.thumbRenderer.domElement.toDataURL('image/png');
    game.thumbScene.remove(mesh);
    game.thumbs.set(item.id, url);
    return url;
  } catch (error) {
    return null;
  }
};

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------
game.applySettings = (settings) => {
  const quality = QUALITY[settings.quality] || QUALITY.medium;
  game.qualityName = settings.quality || 'medium';
  game.settings.mouseSensitivity = settings.mouse ?? 100;
  game.settings.camSensitivity = settings.cam ?? 100;
  game.settings.shake = settings.shake ?? 0.7;
  game.physics.setQuality(quality);
  game.fx.setQuality(quality);
  game.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, quality.pixelRatio));
  game.renderer.setSize(window.innerWidth, window.innerHeight);
  game.scene.fog.far = quality.fogFar;
  game.audio.setVolume(settings.volume ?? 0.65);

  const shadows = settings.shadows || 'high';
  game.renderer.shadowMap.enabled = shadows !== 'off';
  game.lights.sun.castShadow = shadows !== 'off';
  if (shadows !== 'off') {
    const size = shadows === 'high' ? quality.shadows : 1024;
    if (game.lights.sun.shadow.mapSize.x !== size) {
      game.lights.sun.shadow.mapSize.set(size, size);
      if (game.lights.sun.shadow.map) {
        game.lights.sun.shadow.map.dispose();
        game.lights.sun.shadow.map = null;
      }
    }
    const range = quality.shadowRange;
    const camera = game.lights.sun.shadow.camera;
    camera.left = -range;
    camera.right = range;
    camera.top = range;
    camera.bottom = -range;
    camera.far = range * 4;
    camera.updateProjectionMatrix();
  }
  game.daylight.setMode(settings.time || 'day');
  game.ui.setTimeMode(settings.time || 'day');
};

// ---------------------------------------------------------------------------
// Contacts: the moment damage, sound and chain reactions happen
// ---------------------------------------------------------------------------
function contactPoint(a, b) {
  const ta = a.body.translation();
  const tb = b.body.translation();
  return new THREE.Vector3((ta.x + tb.x) / 2, (ta.y + tb.y) / 2, (ta.z + tb.z) / 2);
}

function onContact(a, b, speed) {
  if (!a || !b) return;
  if (a.kind === 'player' && b.kind === 'player') return;
  const point = contactPoint(a, b);
  const material = a.material || b.material || 'concrete';

  if (speed > 5) {
    game.audio?.impact(point, clamp(speed / 24, 0.1, 1), material);
  }

  // bouncy pads actually launch things
  for (const [pad, mover] of [[a, b], [b, a]]) {
    if (pad.data?.bouncy && mover.kind !== 'building') {
      const direction = mover.body.linvel();
      if (Math.hypot(direction.x, direction.y, direction.z) > 3) {
        mover.body.applyImpulse({ x: direction.x * mover.mass * 0.25, y: mover.mass * 6.5, z: direction.z * mover.mass * 0.25 }, true);
        mover.body.wakeUp();
        game.audio?.pop(point, 0.4);
      }
    }
  }

  const applyDamage = (target, other) => {
    if (!target || target.dead || target.kind === 'debris' || target.kind === 'player') return;
    if (!target.onDamage && !target.damageable) return;
    const otherMass = Math.max(2, other.mass || other.baseMass || 40);
    const massFactor = clamp(otherMass / 220, 0.1, 11);
    let amount = Math.max(0, speed - 4.5) * massFactor * 3.2;
    // a sprinting body-check is enough to take a tree down; a walk just bumps it
    if (target.data?.tree && other.kind === 'player' && speed > 5) amount *= 10;
    if (amount < 1.5) return;
    game.physics.damage(target, amount, point, null);
  };
  applyDamage(a, b);
  applyDamage(b, a);

  // pedestrians are not damageable, but they do notice
  if ((a.kind === 'npc' || b.kind === 'npc') && speed > 4) {
    game.npc.alert(point, 10);
  }
}

// ---------------------------------------------------------------------------
// City rebuild
// ---------------------------------------------------------------------------
game.rebuildCity = () => {
  game.paused = false;
  game.specials.length = 0;
  game.ragdolls.length = 0;
  game.vehicles.length = 0;
  game.fx.clearDebris();
  game.npc.removeAll();
  game.tools.release();
  game.tools.selected = null;
  for (const entity of [...game.physics.entities]) game.physics.remove(entity, { silent: true });
  game.city.build(Math.floor(Math.random() * 99999));
  populateCity();
  game.player.spawn(game.city.playerSpawn);
  game.ui.toast('A fresh city. Nothing has happened here yet.', 'good');
};

function populateCity() {
  const spots = game.city.parkingSpots.slice(0, 4);
  spots.forEach((spot, index) => {
    const type = index % 3 === 0 ? 'van' : index % 3 === 1 ? 'sedan' : 'coupe';
    spawnItem(game, type, spot.position, { heading: spot.heading });
  });
  spawnItem(game, 'sedan', new THREE.Vector3(-41, 1.3, 52), { heading: Math.PI });
  spawnItem(game, 'truck', new THREE.Vector3(-33, 1.5, 8), { heading: 0.06 });
  spawnItem(game, 'bus', new THREE.Vector3(60, 1.7, 37), { heading: Math.PI / 2 });
  game.npc.build(QUALITY[game.qualityName].npc);
}

// ---------------------------------------------------------------------------
// Frame
// ---------------------------------------------------------------------------
function syncMeshes() {
  for (const entity of game.physics.entities) {
    if (entity.dead || !entity.mesh) continue;
    if (entity.kind === 'player' || entity.kind === 'npc') continue;
    const t = entity.body.translation();
    const r = entity.body.rotation();
    entity.mesh.position.set(t.x, t.y, t.z);
    if (entity.visualOffset) entity.mesh.position.add(entity.visualOffset);
    if (entity.kind !== 'ragdoll' || entity.mesh) entity.mesh.quaternion.set(r.x, r.y, r.z, r.w);
  }
}

function updateSpecials(dt) {
  for (let i = game.specials.length - 1; i >= 0; i--) {
    const special = game.specials[i];
    if (!special.entity || special.entity.dead) {
      game.specials.splice(i, 1);
      continue;
    }
    special.update(dt);
  }
}

let last = performance.now();
let frameCount = 0;
let fpsTimer = 0;

function frame(now) {
  requestAnimationFrame(frame);
  const raw = (now - last) / 1000;
  last = now;
  const dt = Math.min(0.05, Math.max(0.0001, raw));
  const active = !game.paused && !game.ui.modal;

  if (active) {
    game.player.update(dt);
    game.npc.update(dt);
    updateSpecials(dt);
    game.physics.step(dt, onContact);
    syncMeshes();
    game.city.update(dt, game.daylight.state.night);
    game.fx.update(dt);
    game.tools.update(dt);
    game.daylight.update(dt);

    // engine and tyre noise follow the driven vehicle
    if (game.player.vehicle && !game.player.vehicle.dead) {
      const vehicle = game.player.vehicle;
      if (Math.abs(vehicle.steerAngle) > 0.22 && Math.abs(vehicle.speed) > 9 && vehicle.grounded) {
        game.audio?.screech(clamp(Math.abs(vehicle.speed) / 30, 0, 1), vehicle.entity.body.translation());
      }
    }
  } else {
    game.daylight.update(dt);
    game.fx.update(dt);
  }

  game.fx.setListener(game.camera.position);
  game.audio?.setListener(game.camera.position);
  game.camera.updateMatrixWorld();
  game.renderer.render(game.scene, game.camera);

  game.ui.tickFPS(dt);
  frameCount++;
  fpsTimer += dt;
  if (fpsTimer > 0.5) {
    game.debugFPS = Math.round(frameCount / fpsTimer);
    frameCount = 0;
    fpsTimer = 0;
  }
}

function resize() {
  const width = window.innerWidth;
  const height = window.innerHeight;
  game.camera.aspect = width / height;
  game.camera.updateProjectionMatrix();
  game.renderer.setSize(width, height);
}

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------
async function boot() {
  game.ui.setLoading(8, 'Pouring the concrete…');

  await RAPIER.init();
  game.RAPIER = RAPIER;
  game.ui.setLoading(22, 'Wiring the physics world…');

  const renderer = createRenderer(canvas);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, QUALITY.medium.pixelRatio));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0xc2d4dc, 80, QUALITY.medium.fogFar);

  const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.12, 1500);
  camera.position.set(-37, 7, 48);

  const atmosphere = createAtmosphere(scene);
  const lights = createLights(scene);
  const daylight = createDaylight({ scene, renderer, atmosphere, lights, presets: TIME_PRESETS });

  const physics = new Physics(RAPIER, QUALITY.medium);
  const fx = new FX({ scene, physics, quality: QUALITY.medium });
  const audio = new GameAudio();

  Object.assign(game, {
    renderer, scene, camera, atmosphere, lights, daylight, physics, fx, audio,
  });

  game.ui.setLoading(40, 'Laying out the streets…');
  const city = new City({
    scene, physics, fx, audio,
    spawnItem: (id, position, opts) => spawnItem(game, id, position, opts),
    explode: (position, power) => fx.explosion(position, power),
    onBuildingGone: (building) => {
      if (building && building.kindOf === 'tower') game.ui.toast(`${building.name} is gone`, 'bad');
    },
  });
  game.city = city;
  city.build(Math.floor(Math.random() * 99999));

  game.ui.setLoading(62, 'Hanging the traffic lights…');
  game.player = new Player(game);
  game.npc = new NPCManager(game);
  game.tools = new Tools(game);
  game.ui.init();
  game.makeThumb = game.makeThumb.bind(game);
  game.spawnFromMenu = game.spawnFromMenu.bind(game);
  game.lockPointer = lockPointer;
  game.releasePointer = releasePointer;

  game.ui.setLoading(78, 'Parking the cars…');
  populateCity();

  game.ui.setLoading(92, 'Waking up the residents…');
  game.player.spawn(city.playerSpawn);
  bindInput();
  window.addEventListener('resize', resize);

  game.ui.setLoading(100, 'Ready.');
  game.ui.hideLoading();
  game.ui.toast('Click to look around. Tab opens the spawn menu, F gets you into a car.', 'good');

  last = performance.now();
  game.started = true;
  requestAnimationFrame(frame);
  console.log('[City Chaos] ready', { buildings: city.buildings.length, entities: physics.entities.size });
}

window.addEventListener('error', (event) => {
  console.error('[City Chaos]', event.error || event.message);
  if (!game.started) {
    game.ui?.showCrash?.('The city could not be built: ' + (event.message || 'unknown error'));
  }
});

boot().catch((error) => {
  console.error('[City Chaos] boot failed', error);
  const crash = document.getElementById('crash');
  const text = document.getElementById('crash-text');
  if (text) text.textContent = 'The city could not be built: ' + (error?.message || error);
  if (crash) crash.hidden = false;
  const loading = document.getElementById('loading');
  if (loading) loading.hidden = true;
});
