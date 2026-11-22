/* =====================================================================
   PET CAFÉ — the world
   A cosy cutaway café: warm walls, a sunny patio, soft shadows, clickable
   guests, wandering animals and a proper grid for building.
   ===================================================================== */
import * as THREE from "three";
import { buildFurniture, floorBoardTexture } from "./furniture-models.js";
import { buildAnimal, buildFood, buildCreatureShadow, animateCreature } from "./models.js";
import { CONFIG } from "./config.js";
import { FLOORING, WALLS, furnitureById } from "./data.js";

const ROOM = CONFIG.room;

export const world = {
  renderer: null,
  scene: null,
  camera: null,
  canvas: null,
  roomGroup: null,
  itemGroup: null,
  actorGroup: null,
  ghostGroup: null,
  grid: null,
  layout: null,
  readonly: false,
  mode: "play",
  actors: new Map(),
  pickables: [],
  stationMeshes: [],
  stationRings: new Map(),
  cameraState: { az: 0.58, polar: 0.6, dist: 20, target: new THREE.Vector3(-0.5, 1.35, 0.8) },
  cameraWanted: { az: 0.58, polar: 0.6, dist: 20 },
  pointer: new THREE.Vector2(),
  raycaster: new THREE.Raycaster(),
  ground: new THREE.Plane(new THREE.Vector3(0, 1, 0), 0),
  callbacks: {},
  hoverItem: null,
  ghostValid: true,
  time: 0,
  ready: false,
  particleBudget: 0,
  expanded: 0
};

const FLOOR_CACHE = new Map();

/* ---------------------------------------------------------------------
   Boot
   --------------------------------------------------------------------- */
export function initWorld(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.94;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  scene.background = skyColour();
  scene.fog = new THREE.Fog(new THREE.Color("#f0ddca"), 46, 92);

  const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 200);

  scene.add(new THREE.HemisphereLight(0xfff3e2, 0xcbb49d, 1.05));
  const sun = new THREE.DirectionalLight(0xffe6c4, 1.6);
  sun.position.set(13, 19, 11);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.near = 2;
  sun.shadow.camera.far = 60;
  sun.shadow.camera.left = -18;
  sun.shadow.camera.right = 18;
  sun.shadow.camera.top = 18;
  sun.shadow.camera.bottom = -18;
  sun.shadow.bias = -0.0008;
  sun.shadow.normalBias = 0.03;
  scene.add(sun);
  const fill = new THREE.DirectionalLight(0xb9d2dc, 0.36);
  fill.position.set(-10, 8, 9);
  scene.add(fill);
  const bounce = new THREE.PointLight(0xffd9b0, 5, 16, 2);
  bounce.position.set(0, 3.3, -1.5);
  scene.add(bounce);

  world.renderer = renderer;
  world.scene = scene;
  world.camera = camera;
  world.canvas = canvas;
  world.sunLight = sun;
  world.bounceLight = bounce;

  world.roomGroup = new THREE.Group();
  world.itemGroup = new THREE.Group();
  world.actorGroup = new THREE.Group();
  world.ghostGroup = new THREE.Group();
  scene.add(world.roomGroup, world.itemGroup, world.actorGroup, world.ghostGroup);

  buildScenery();
  buildShell();
  buildGrid();
  bindPointer();

  resizeWorld();
  window.addEventListener("resize", resizeWorld);
  world.ready = true;
  return world;
}

function skyColour() {
  const c = document.createElement("canvas");
  c.width = 512; c.height = 512;
  const x = c.getContext("2d");
  const grad = x.createLinearGradient(0, 0, 0, 512);
  grad.addColorStop(0, "#a9d3e2");
  grad.addColorStop(0.42, "#d9e7e1");
  grad.addColorStop(0.7, "#f6e3cd");
  grad.addColorStop(1, "#f4d9c1");
  x.fillStyle = grad; x.fillRect(0, 0, 512, 512);
  x.fillStyle = "rgba(255,255,255,0.28)";
  [[90, 80, 55], [220, 55, 40], [350, 110, 66], [460, 70, 30]].forEach(([cx, cy, r]) => {
    x.beginPath(); x.ellipse(cx, cy, r, r * 0.36, 0, 0, Math.PI * 2); x.fill();
  });
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.mapping = THREE.EquirectangularReflectionMapping;
  return tex;
}

/* ---------------------------------------------------------------------
   Scenery outside the café
   --------------------------------------------------------------------- */
function buildScenery() {
  const g = new THREE.Group();
  g.name = "scenery";
  world.scene.add(g);

  const grassMat = new THREE.MeshStandardMaterial({ color: new THREE.Color("#b7cba0"), roughness: 1 });
  const grass = new THREE.Mesh(new THREE.CircleGeometry(70, 48), grassMat);
  grass.rotation.x = -Math.PI / 2;
  grass.position.y = -0.16;
  grass.receiveShadow = true;
  g.add(grass);

  const pathMat = new THREE.MeshStandardMaterial({ color: new THREE.Color("#e4cdb0"), roughness: 0.95 });
  const path = new THREE.Mesh(new THREE.PlaneGeometry(11, 26), pathMat);
  path.rotation.x = -Math.PI / 2;
  path.position.set(-14, -0.12, 4);
  g.add(path);

  // blossom trees and hedges frame the café
  const tree = (x, z, s, blossom) => {
    const t = new THREE.Group();
    t.position.set(x, -0.14, z);
    t.scale.setScalar(s);
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.26, 2.6, 8), new THREE.MeshStandardMaterial({ color: 0x8b6a4c, roughness: 1 }));
    trunk.position.y = 1.3;
    trunk.castShadow = true;
    t.add(trunk);
    const colours = blossom ? ["#f3c6cf", "#eeb4c2", "#f7d8db"] : ["#9fbb8a", "#8fae79", "#b3c99a"];
    for (let i = 0; i < 6; i++) {
      const crown = new THREE.Mesh(new THREE.SphereGeometry(0.95, 12, 9), new THREE.MeshStandardMaterial({ color: new THREE.Color(colours[i % 3]), roughness: 1 }));
      crown.position.set((i % 3 - 1) * 0.8, 2.6 + Math.floor(i / 3) * 0.6, (i % 2 ? 0.5 : -0.45));
      crown.scale.set(1, 0.85, 1);
      crown.castShadow = true;
      t.add(crown);
    }
    g.add(t);
  };
  tree(-15.5, -10.5, 0.8, true);
  tree(12.5, -7, 1.0, true);
  tree(-21, 16, 0.85, false);
  tree(18, 10, 1.2, true);

  const hedgeMat = new THREE.MeshStandardMaterial({ color: new THREE.Color("#9cb887"), roughness: 1 });
  for (let i = 0; i < 9; i++) {
    const h = new THREE.Mesh(new THREE.SphereGeometry(0.65, 10, 8), hedgeMat);
    h.position.set(-19 + i * 2.2, 0.32, 21.8);
    h.scale.set(1.1, 0.8, 1);
    h.castShadow = true;
    g.add(h);
  }
  const fenceMat = new THREE.MeshStandardMaterial({ color: 0xece0cd, roughness: 0.9 });
  for (let i = 0; i < 16; i++) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.06, 0.8, 6), fenceMat);
    post.position.set(-10 + i * 1.35, 0.36, 20.6);
    g.add(post);
  }
  for (let i = 0; i < 2; i++) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(20.4, 0.06, 0.06), fenceMat);
    rail.position.set(0.1, 0.32 + i * 0.32, 20.6);
    g.add(rail);
  }
}

/* ---------------------------------------------------------------------
   The café shell
   --------------------------------------------------------------------- */
function buildShell() {
  const g = world.roomGroup;
  g.clear();

  const W = ROOM.w, D = ROOM.d, H = ROOM.h;

  // interior floor
  const floorDef = FLOORING.find((f) => f.id === (world.layout && world.layout.floor)) || FLOORING[0];
  const floorTex = floorBoardTexture(floorDef.tone, floorDef.accent, floorDef.pattern);
  floorTex.repeat.set(W / 1.8, D / 1.8);
  const floorMat = new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.82 });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(W, D), floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  g.add(floor);
  world.floorMat = floorMat;

  // patio deck
  const patioDepth = ROOM.patio + (world.layout ? world.layout.expansions || 0 : 0) * 3;
  world.patioDepth = patioDepth;
  const deckTex = floorBoardTexture("#d9bb93", "#c6a377", "planks");
  deckTex.repeat.set(W / 2.2, patioDepth / 2.2);
  const deck = new THREE.Mesh(new THREE.PlaneGeometry(W, patioDepth), new THREE.MeshStandardMaterial({ map: deckTex, roughness: 0.9 }));
  deck.rotation.x = -Math.PI / 2;
  deck.position.set(0, -0.01, D / 2 + patioDepth / 2);
  deck.receiveShadow = true;
  g.add(deck);

  // patio edge steps and border
  box(g, W + 0.5, 0.16, 0.4, "#e9dbc7", 0, -0.06, D / 2);
  box(g, W + 0.3, 0.22, 0.28, "#efe5d5", 0, -0.11, D / 2 + patioDepth);
  for (let i = 0; i < 4; i++) {
    box(g, W + 0.34, 0.03, 0.05, "#d6c3a8", 0, 0.02, D / 2 + 0.4 + i * (patioDepth / 4.4));
  }

  // walls
  const wallDef = WALLS.find((w) => w.id === (world.layout && world.layout.wall)) || WALLS[0];
  const wallMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(wallDef.tone), roughness: 0.95, side: THREE.DoubleSide });
  world.wallMat = wallMat;
  const back = new THREE.Mesh(new THREE.PlaneGeometry(W, H), wallMat);
  back.position.set(0, H / 2, -D / 2);
  back.receiveShadow = true;
  g.add(back);
  const left = new THREE.Mesh(new THREE.PlaneGeometry(D, H), wallMat);
  left.rotation.y = Math.PI / 2;
  left.position.set(-W / 2, H / 2, 0);
  left.receiveShadow = true;
  g.add(left);
  // a short right wall keeps the room feeling enclosed without hiding it
  const right = new THREE.Mesh(new THREE.PlaneGeometry(D, 1.1), wallMat);
  right.rotation.y = -Math.PI / 2;
  right.position.set(W / 2, 0.55, 0);
  right.receiveShadow = true;
  g.add(right);

  // wall pattern
  if (wallDef.pattern) {
    const c = document.createElement("canvas");
    c.width = c.height = 256;
    const x = c.getContext("2d");
    x.fillStyle = wallDef.tone; x.fillRect(0, 0, 256, 256);
    if (wallDef.pattern === "stripe") {
      x.fillStyle = wallDef.accent;
      for (let i = 0; i < 8; i++) x.fillRect(i * 32 + 18, 0, 12, 256);
    } else {
      x.fillStyle = wallDef.accent;
      for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) {
        x.beginPath(); x.arc(16 + i * 32, 16 + j * 32, 4 + (i + j) % 2 * 2, 0, Math.PI * 2); x.fill();
      }
    }
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(4, 2);
    tex.colorSpace = THREE.SRGBColorSpace;
    back.material = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.95, side: THREE.DoubleSide });
    left.material = back.material;
  }

  // skirting boards
  box(g, W, 0.14, 0.05, "#f7ecdd", 0, 0.07, -D / 2 + 0.026);
  box(g, 0.05, 0.14, D, "#f7ecdd", -W / 2 + 0.026, 0.07, 0);
  box(g, W, 0.05, 0.12, "#e8d8c3", 0, H - 0.03, -D / 2 + 0.06);
  box(g, 0.12, 0.05, D, "#e8d8c3", -W / 2 + 0.06, H - 0.03, 0);

  // corner beam and open front posts
  box(g, 0.24, H, 0.24, "#efe1ce", -W / 2, H / 2, -D / 2);
  box(g, 0.22, H, 0.22, "#efe1ce", W / 2, H / 2, -D / 2);
  [W / 2, -W / 2].forEach((x) => {
    box(g, 0.2, 0.18, 0.2, "#e6d5bf", x, H - 0.1, D / 2 + 0.1);
  });

  // soft ambient particles indoors: dust motes in the sun
  const dustGeo = new THREE.BufferGeometry();
  const positions = new Float32Array(90 * 3);
  for (let i = 0; i < 90; i++) {
    positions[i * 3] = (Math.random() - 0.5) * W;
    positions[i * 3 + 1] = 0.4 + Math.random() * (H - 0.6);
    positions[i * 3 + 2] = (Math.random() - 0.5) * D;
  }
  dustGeo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({ color: 0xfff0d5, size: 0.035, transparent: true, opacity: 0.5, depthWrite: false }));
  g.add(dust);
  world.dust = dust;
}

function box(parent, w, h, d, colour, x, y, z) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshStandardMaterial({ color: new THREE.Color(colour), roughness: 0.9 }));
  mesh.position.set(x, y, z);
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

/* ---------------------------------------------------------------------
   Placement grid
   --------------------------------------------------------------------- */
function buildGrid() {
  const size = 64;
  const divisions = 32;
  const grid = new THREE.GridHelper(28, 56, new THREE.Color("#c9a98a"), new THREE.Color("#dcc9b2"));
  grid.material.transparent = true;
  grid.material.opacity = 0.4;
  grid.position.y = 0.022;
  grid.visible = false;
  world.scene.add(grid);
  world.grid = grid;
}

export function showGrid(show) {
  if (world.grid) world.grid.visible = !!show;
}
export function setMode(mode) {
  world.mode = mode;
  showGrid(mode === "build");
  setStationGlow(mode === "build" ? [] : world.glowingStations || []);
}

/* ---------------------------------------------------------------------
   Layout rendering
   --------------------------------------------------------------------- */
export function setLayout(layout, options = {}) {
  world.layout = layout;
  world.readonly = !!options.readonly;
  world.expanded = layout.expansions || 0;
  buildShell();
  rebuildItems();
  updateStationGlow();
  world.actorGroup.clear();
  world.actors.clear();
  setMode(world.readonly ? "visit" : (options.mode || "play"));
}

export function rebuildItems() {
  if (!world.itemGroup) return;
  world.itemGroup.clear();
  world.pickables = [];
  world.stationMeshes = [];
  const items = (world.layout && world.layout.items) || [];
  items.forEach((entry) => addItemMeshes(entry));
  updateStationGlow();
}

export function mountHeight(def) {
  if (!def) return 0;
  if (def.place === "wall") return wallMountY(def);
  if (def.place === "ceiling") return ROOM.h - 0.04;
  return 0;
}

function wallMountY(def) {
  if (def.kind === "cafedoor" || def.kind === "archdoor" || def.kind === "patiodoor") return def.h / 2 + 0.06;
  if (def.cat === "Windows") return 1.85;
  if (def.cat === "Signs") return 2.55;
  if (def.kind === "clock" || def.kind === "picture") return 1.95;
  if (def.kind === "garland") return 2.8;
  if (def.kind === "string") return 3.0;
  return 1.6;
}

export function wallRotation(wall) {
  return wall === "left" ? Math.PI / 2 : wall === "right" ? -Math.PI / 2 : 0;
}

function addItemMeshes(entry) {
  const def = furnitureById(entry.id);
  if (!def || def.kind === "floor" || def.kind === "wall") return;
  const group3d = buildFurniture(def);
  const ry = entry.ry || 0;
  group3d.rotation.y = ry;
  let y = 0;
  if (def.place === "wall") y = wallMountY(def);
  else if (def.place === "ceiling") y = ROOM.h - 0.04;
  group3d.position.set(entry.x || 0, y, entry.z || 0);
  group3d.userData.item = entry;
  group3d.userData.def = def;
  if (def.station) {
    group3d.userData.station = def.station;
    world.stationMeshes.push(group3d);
  }
  group3d.traverse((o) => {
    if (o.isMesh) {
      o.userData.item = entry;
      o.userData.def = def;
      if (def.station) o.userData.station = def.station;
    }
  });
  world.itemGroup.add(group3d);
  world.pickables.push(group3d);
  entry._g = group3d;
  return group3d;
}

export function entryWorldPosition(entry) {
  const def = furnitureById(entry.id);
  if (!def) return new THREE.Vector3(entry.x || 0, 0.8, entry.z || 0);
  let y = def.place === "wall" ? wallMountY(def) : def.place === "ceiling" ? ROOM.h - 0.04 : 0;
  return new THREE.Vector3(entry.x || 0, y + (def.place ? 0 : def.h * 0.6), entry.z || 0);
}

/* ---------------------------------------------------------------------
   Stations: a warm pulsing ring when an order needs them
   --------------------------------------------------------------------- */
export function setStationGlow(kinds) {
  world.glowingStations = kinds || [];
  updateStationGlow();
}
function updateStationGlow() {
  world.stationRings.forEach((ring) => ring.parent && ring.parent.remove(ring));
  world.stationRings.clear();
  if (!world.itemGroup) return;
  const kinds = world.glowingStations || [];
  kinds.forEach((kind) => {
    const stations = world.stationMeshes.filter((m) => m.userData.station === kind);
    stations.slice(0, 3).forEach((mesh) => {
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(0.55, 0.72, 32),
        new THREE.MeshBasicMaterial({ color: new THREE.Color("#f3c171"), transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthWrite: false })
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(0, 0.03, 0);
      mesh.add(ring);
      world.stationRings.set(kind + "_" + mesh.id, ring);
    });
  });
}

export function stationPositions() {
  const out = {};
  world.stationMeshes.forEach((mesh) => {
    const kind = mesh.userData.station;
    if (!out[kind]) {
      const p = new THREE.Vector3();
      mesh.getWorldPosition(p);
      out[kind] = p;
    }
  });
  return out;
}

/* ---------------------------------------------------------------------
   Building ghost
   --------------------------------------------------------------------- */
export function makeGhost(def) {
  clearGhost();
  if (!def) return null;
  const g = buildFurniture(def);
  g.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = false;
      o.receiveShadow = false;
      if (o.material && o.material.transparent !== undefined && !o.material.transparent) {
        o.material = o.material.clone();
        o.material.transparent = true;
        o.material.opacity = 0.62;
      }
    }
  });
  const disc = new THREE.Mesh(
    new THREE.CircleGeometry(Math.max(def.w, def.d) * 0.5, 28),
    new THREE.MeshBasicMaterial({ color: 0x7fbf8e, transparent: true, opacity: 0.22, depthWrite: false })
  );
  disc.rotation.x = -Math.PI / 2;
  disc.position.y = 0.025;
  g.add(disc);
  g.userData.disc = disc;
  g.userData.def = def;
  world.ghostGroup.add(g);
  world.ghost = g;
  return g;
}

export function moveGhost(x, z, ry, mountY) {
  if (!world.ghost) return;
  world.ghost.position.set(x, mountY || 0, z);
  world.ghost.rotation.y = ry || 0;
}

export function setGhostValid(valid) {
  if (!world.ghost || !world.ghost.userData.disc) return;
  world.ghostValid = valid;
  world.ghost.userData.disc.material.color.set(valid ? 0x7fbf8e : 0xd98b7d);
  world.ghost.userData.disc.material.opacity = valid ? 0.26 : 0.32;
}

export function clearGhost() {
  if (world.ghost) {
    world.ghostGroup.remove(world.ghost);
    world.ghost = null;
  }
}

/* ---------------------------------------------------------------------
   Actors: guests, residents and strays
   --------------------------------------------------------------------- */
export function spawnActor(opts) {
  const rig = buildAnimal(opts.cfg);
  const holder = new THREE.Group();
  holder.add(rig.group);
  const shadow = buildCreatureShadow(0.36);
  shadow.position.y = 0.008;
  holder.add(shadow);
  holder.position.set(opts.x || 0, 0.02, opts.z || 0);
  holder.rotation.y = opts.yaw || 0;
  holder.userData.actorId = opts.id;
  holder.userData.actor = opts;
  rig.group.traverse((o) => {
    if (o.isMesh) {
      o.userData.actorId = opts.id;
      o.userData.actor = opts;
    }
  });
  world.actorGroup.add(holder);
  const handle = {
    id: opts.id, kind: opts.kind, group: holder, rig, shadow,
    x: opts.x || 0, z: opts.z || 0, yaw: opts.yaw || 0,
    moving: false, time: Math.random() * 10, phase: Math.random() * 6,
    headVec: new THREE.Vector3(),
    outfit: opts.outfit
  };
  world.actors.set(opts.id, handle);
  world.pickables.push(holder);
  setActorPose(handle, handle.x, handle.z, handle.yaw, false);
  return handle;
}

export function setActorSeated(handle, seated) {
  if (!handle) return;
  handle.seated = !!seated;
}

export function setActorPose(handle, x, z, yaw, moving) {
  if (!handle) return;
  handle.x = x; handle.z = z;
  if (yaw !== undefined && yaw !== null) handle.yaw = yaw;
  handle.group.position.x = x;
  handle.group.position.z = z;
  // shortest-path turn
  const current = handle.group.rotation.y;
  let delta = ((handle.yaw - current + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
  handle.group.rotation.y = current + delta * 0.22;
  handle.moving = !!moving;
}

export function removeActor(handleOrId) {
  const handle = typeof handleOrId === "string" ? world.actors.get(handleOrId) : handleOrId;
  if (!handle) return;
  world.actorGroup.remove(handle.group);
  world.actors.delete(handle.id);
  world.pickables = world.pickables.filter((p) => p !== handle.group);
}

export function clearActors() {
  world.actors.forEach((h) => world.actorGroup.remove(h.group));
  world.actors.clear();
  world.pickables = world.pickables.filter((p) => p.parent);
}

export function updateActors(dt, time) {
  world.actors.forEach((handle) => {
    handle.time += dt;
    animateCreature(handle.rig, handle.time + handle.phase, handle.moving, handle.kind === "customer" ? 1 : 0.8, !!handle.seated);
    const restY = handle.seated ? 0.26 : 0.02;
    handle.group.position.y += (restY - handle.group.position.y) * Math.min(1, dt * 8);
    if (handle.kind === "animal" && !handle.moving && !handle.seated) {
      handle.group.position.y += Math.max(0, Math.sin(handle.time * 1.6 + handle.phase)) * 0.004;
    }
    handle.group.updateMatrixWorld();
    handle.headVec.copy(handle.rig.headAnchor || new THREE.Vector3(0, 0.8, 0));
    handle.group.localToWorld(handle.headVec);
  });
}

/* ---------------------------------------------------------------------
   Picking & camera
   --------------------------------------------------------------------- */
function bindPointer() {
  const canvas = world.canvas;
  let down = null;
  let dragging = false;
  let last = null;
  const pointers = new Map();
  let pinchStart = 0;

  const pos = (e) => {
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top, nx: ((e.clientX - rect.left) / rect.width) * 2 - 1, ny: -((e.clientY - rect.top) / rect.height) * 2 + 1 };
  };

  canvas.addEventListener("pointerdown", (e) => {
    if (e.button !== undefined && e.button > 0) return;
    canvas.setPointerCapture && canvas.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, pos(e));
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      pinchStart = Math.hypot(a.x - b.x, a.y - b.y);
      down = null;
      return;
    }
    down = { ...pos(e), time: performance.now() };
    last = down;
    dragging = false;
  });

  canvas.addEventListener("pointermove", (e) => {
    if (pointers.has(e.pointerId)) pointers.set(e.pointerId, pos(e));
    if (pointers.size === 2 && pinchStart) {
      const [a, b] = [...pointers.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      world.cameraWanted.dist = clamp(world.cameraWanted.dist * (pinchStart / Math.max(1, dist)), 12, 36);
      pinchStart = dist;
      return;
    }
    if (!down) {
      const p = pos(e);
      hoverAt(p.x, p.y);
      if (world.callbacks.onMove) world.callbacks.onMove({ x: p.x, y: p.y });
      return;
    }
    const p = pos(e);
    if (Math.hypot(p.x - down.x, p.y - down.y) > 7) dragging = true;
    if (dragging) {
      const dx = p.x - last.x, dy = p.y - last.y;
      world.cameraWanted.az = clamp(world.cameraWanted.az - dx * 0.006, -0.35, 1.9);
      world.cameraWanted.polar = clamp(world.cameraWanted.polar + dy * 0.005, 0.34, 1.18);
      last = p;
    }
  });

  const end = (e) => {
    pointers.delete(e.pointerId);
    if (pointers.size < 2) pinchStart = 0;
    const p = pos(e);
    if (down && !dragging && performance.now() - down.time < 700 && Math.hypot(p.x - down.x, p.y - down.y) < 9) {
      tapAt(p.x, p.y);
    }
    down = null;
    last = null;
    dragging = false;
  };
  canvas.addEventListener("pointerup", end);
  canvas.addEventListener("pointercancel", (e) => {
    pointers.delete(e.pointerId);
    down = null; last = null; dragging = false;
  });
  canvas.addEventListener("pointerleave", () => {
    if (world.callbacks.onHover) world.callbacks.onHover(null);
  });
  canvas.addEventListener("wheel", (e) => {
    e.preventDefault();
    world.cameraWanted.dist = clamp(world.cameraWanted.dist + e.deltaY * 0.012, 12, 36);
  }, { passive: false });
  canvas.addEventListener("contextmenu", (e) => e.preventDefault());
}

function rayFrom(x, y) {
  const rect = world.canvas.getBoundingClientRect();
  world.pointer.x = (x / rect.width) * 2 - 1;
  world.pointer.y = -(y / rect.height) * 2 + 1;
  world.raycaster.setFromCamera(world.pointer, world.camera);
  return world.raycaster;
}

function infoFrom(object) {
  let node = object;
  while (node) {
    if (node.userData && node.userData.actorId) {
      const handle = world.actors.get(node.userData.actorId);
      if (handle) return { type: handle.kind === "customer" ? "customer" : handle.kind === "stray" ? "stray" : "animal", handle, object: node };
    }
    if (node.userData && node.userData.item) {
      return { type: "item", entry: node.userData.item, def: node.userData.def, object: node };
    }
    node = node.parent;
  }
  return null;
}

function intersectStage(x, y) {
  const ray = rayFrom(x, y);
  const hits = ray.intersectObjects(world.pickables, true);
  for (const hit of hits) {
    const info = infoFrom(hit.object);
    if (info) return { info, point: hit.point };
  }
  return null;
}

export function groundAt(x, y) {
  const ray = rayFrom(x, y);
  const point = new THREE.Vector3();
  if (ray.ray.intersectPlane(world.ground, point)) return point;
  return null;
}

export function wallAt(x, y) {
  const ray = rayFrom(x, y);
  const D = ROOM.d, W = ROOM.w;
  const planes = [
    { wall: "back", plane: new THREE.Plane(new THREE.Vector3(0, 0, 1), D / 2) },
    { wall: "left", plane: new THREE.Plane(new THREE.Vector3(1, 0, 0), W / 2) },
    { wall: "right", plane: new THREE.Plane(new THREE.Vector3(-1, 0, 0), W / 2) }
  ];
  let best = null;
  for (const p of planes) {
    const point = new THREE.Vector3();
    if (ray.ray.intersectPlane(p.plane, point)) {
      const dist = point.distanceTo(ray.ray.origin);
      if (!best || dist < best.dist) best = { wall: p.wall, point, dist };
    }
  }
  return best;
}

function tapAt(x, y) {
  const hit = intersectStage(x, y);
  if (hit) {
    if (world.callbacks.onTap) world.callbacks.onTap(hit.info, hit.point, { x, y, mode: world.mode });
    return;
  }
  const ground = groundAt(x, y);
  if (world.callbacks.onGround) world.callbacks.onGround(ground, { x, y, mode: world.mode });
  if (world.callbacks.onTap) world.callbacks.onTap(null, ground, { x, y, mode: world.mode });
}

function hoverAt(x, y) {
  if (!world.callbacks.onHover) return;
  const hit = intersectStage(x, y);
  const info = hit ? hit.info : null;
  const key = info ? (info.type + "_" + (info.handle ? info.handle.id : info.entry ? info.entry.uid : "")) : null;
  if (key !== world.hoverKey) {
    world.hoverKey = key;
    world.callbacks.onHover(info);
  }
  world.canvas.style.cursor = info ? (world.mode === "build" ? "grab" : "pointer") : (world.mode === "build" ? "crosshair" : "default");
}

export function projectToScreen(vec3) {
  if (!world.camera) return { x: 0, y: 0, visible: false };
  const v = vec3.clone().project(world.camera);
  const rect = world.canvas.getBoundingClientRect();
  return {
    x: (v.x * 0.5 + 0.5) * rect.width,
    y: (-v.y * 0.5 + 0.5) * rect.height,
    visible: v.z < 1 && v.z > -1 && Math.abs(v.x) < 1.25 && Math.abs(v.y) < 1.25,
    depth: v.z
  };
}

export function resizeWorld() {
  if (!world.renderer) return;
  const parent = world.canvas.parentElement;
  const w = parent.clientWidth, h = parent.clientHeight;
  if (!w || !h) return;
  world.renderer.setSize(w, h, false);
  world.camera.aspect = w / h;
  world.camera.fov = w < 760 ? 44 : 34;
  world.camera.updateProjectionMatrix();
}

export function updateCamera(dt) {
  const c = world.cameraState, want = world.cameraWanted;
  c.az += (want.az - c.az) * Math.min(1, dt * 7);
  c.polar += (want.polar - c.polar) * Math.min(1, dt * 7);
  c.dist += (want.dist - c.dist) * Math.min(1, dt * 6);
  const cp = Math.cos(c.polar), sp = Math.sin(c.polar);
  world.camera.position.set(
    c.target.x + c.dist * cp * Math.sin(c.az),
    c.target.y + c.dist * sp,
    c.target.z + c.dist * cp * Math.cos(c.az)
  );
  world.camera.lookAt(c.target);
}

export function nudgeCamera(direction) {
  world.cameraWanted.az = clamp(world.cameraWanted.az + direction * 0.32, -0.35, 1.9);
}
export function zoomCamera(delta) {
  world.cameraWanted.dist = clamp(world.cameraWanted.dist + delta, 12, 36);
}
export function resetCamera() {
  world.cameraWanted.az = 0.58;
  world.cameraWanted.polar = 0.6;
  world.cameraWanted.dist = 20;
}

export function frame(dt) {
  world.time += dt;
  updateCamera(dt);
  updateActors(dt, world.time);
  if (world.dust) {
    const pos = world.dust.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      pos.array[i * 3 + 1] += dt * 0.035 * (i % 3 === 0 ? 1 : 0.4);
      if (pos.array[i * 3 + 1] > ROOM.h - 0.4) pos.array[i * 3 + 1] = 0.4;
    }
    pos.needsUpdate = true;
  }
  world.stationRings.forEach((ring) => {
    ring.material.opacity = 0.35 + Math.sin(world.time * 3.2) * 0.22;
    ring.scale.setScalar(1 + Math.sin(world.time * 3.2) * 0.06);
  });
  if (world.ghost) {
    world.ghost.position.y += Math.sin(world.time * 4) * 0.0008;
  }
  world.renderer.render(world.scene, world.camera);
}

function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

/* ---------------------------------------------------------------------
   3D portraits for the shop, collection, order rail and menus
   --------------------------------------------------------------------- */
let portrait = null;
export function makePortrait(buildFn, opts = {}) {
  try {
    if (!portrait) {
      const canvas = document.createElement("canvas");
      const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
      renderer.setPixelRatio(1);
      renderer.setClearColor(0x000000, 0);
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.02;
      const scene = new THREE.Scene();
      scene.background = new THREE.Color("#dfc7ae");
      scene.add(new THREE.HemisphereLight(0xfff3e2, 0x8e705a, 1.15));
      const key = new THREE.DirectionalLight(0xffebd5, 2.45);
      key.position.set(3.5, 5.5, 4.5);
      scene.add(key);
      const rim = new THREE.DirectionalLight(0xbfd9ef, 1.0);
      rim.position.set(-4, 2.2, -3);
      scene.add(rim);
      // A warm little photo corner makes cream furniture separate from its
      // card instead of disappearing into a pale square.
      const wall = new THREE.Mesh(new THREE.PlaneGeometry(18, 12), new THREE.MeshBasicMaterial({ color: "#d7bda5" }));
      wall.position.set(0, 3.2, -4.2);
      scene.add(wall);
      const halo = new THREE.Mesh(new THREE.CircleGeometry(2.35, 48), new THREE.MeshBasicMaterial({ color: "#efdcc7" }));
      halo.position.set(0, 0.35, -2.6);
      scene.add(halo);
      const floor = new THREE.Mesh(new THREE.PlaneGeometry(18, 18), new THREE.MeshStandardMaterial({ color: "#c0a084", roughness: 1 }));
      floor.rotation.x = -Math.PI / 2;
      floor.position.y = -1.62;
      scene.add(floor);
      const camera = new THREE.PerspectiveCamera(32, 1, 0.01, 100);
      portrait = { renderer, scene, camera, holder: new THREE.Group() };
      scene.add(portrait.holder);
    }
    const size = opts.size || 256;
    portrait.renderer.setSize(size, size);
    portrait.camera.aspect = 1;
    portrait.holder.clear();
    const model = buildFn();
    const frame = new THREE.Group();
    frame.add(model);
    portrait.holder.add(frame);
    const bbox = new THREE.Box3().setFromObject(frame);
    const sphere = bbox.getBoundingSphere(new THREE.Sphere());
    const scale = (opts.zoom || 1.55) / Math.max(0.001, sphere.radius);
    frame.scale.setScalar(scale);
    const center = sphere.center.clone().multiplyScalar(scale);
    frame.position.sub(center);
    frame.position.y += (opts.lift || 0);
    const fitDist = (opts.zoom || 1.55) * 1.16 / Math.sin(THREE.MathUtils.degToRad(portrait.camera.fov / 2));
    portrait.camera.position.set(fitDist * 0.09, fitDist * 0.11, fitDist);
    portrait.camera.lookAt(0, 0, 0);
    portrait.camera.updateProjectionMatrix();
    portrait.renderer.render(portrait.scene, portrait.camera);
    return portrait.renderer.domElement.toDataURL("image/png");
  } catch (error) {
    console.warn("Pet Café: portrait failed", error);
    return "";
  }
}

export function animalPortrait(cfg, size = 220) {
  return makePortrait(() => buildAnimal(cfg).group, { size, zoom: 1.55, lift: 0 });
}
export function foodPortrait(recipe, size = 180) {
  return makePortrait(() => {
    const g = buildFood(recipe);
    const holder = new THREE.Group();
    holder.add(g);
    g.rotation.y = 0.5;
    return holder;
  }, { size, zoom: 1.6 });
}
export function furniturePortrait(def, size = 190) {
  return makePortrait(() => buildFurniture(def), { size, zoom: 1.4 });
}

/* exported for the UI to reuse the same camera behaviour */
export { ROOM };
