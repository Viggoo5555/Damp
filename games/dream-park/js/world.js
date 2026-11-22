/* =====================================================================
   DREAM PARK — the world
   Sky, ground, paths, every placed object, the entrance, the camera rig,
   visitor meshes and the day/night light. The simulation lives in game.js;
   this file knows how to show it.
   ===================================================================== */
import * as THREE from "three";
import { GRID, DEF_BY_ID, PATH_BY_ID } from "./data.js";
import {
  buildRide, buildBuilding, buildEntrance, buildTree, buildFlowers, buildFlowerbed,
  buildHedge, buildTopiary, buildBench, buildBin, buildLamp, buildFlag, buildArch,
  buildBalloonArch, buildFountain, buildStatue, buildPond, buildBridge,
  buildPerson, mat, plane
} from "./models.js";

const T = GRID.tile;
export const tileCenter = (i, j) => ({ x: (i - (GRID.w - 1) / 2) * T, z: (j - (GRID.h - 1) / 2) * T });

export const world = {
  scene: null, camera: null, renderer: null, clock: 0, ready: false,
  sun: null, hemi: null, sky: null, clouds: [],
  ground: null, pathLayer: null, objectLayer: null, visitorLayer: null, decorLayer: null,
  cam: { yaw: 0.55, pitch: 0.86, dist: 62, target: new THREE.Vector3(0, 0, 0) },
  camWanted: { yaw: 0.55, pitch: 0.86, dist: 62, target: new THREE.Vector3(0, 0, 0) },
  mode: "overview",
  objects: new Map(),
  rides: new Map(),
  pathways: new Set(),
  ghost: null, ghostKey: "",
  selectionRing: null, selectedId: null,
  callbacks: { onClick: null, onHover: null, onCamera: null },
  entrance: null,
  fence: null,
  quality: "high",
  night: 0,
  dayFactor: 1,
  pointer: new THREE.Vector2(),
  raycaster: new THREE.Raycaster(),
  dragging: false,
  moved: 0,
  lastPointer: { x: 0, y: 0 },
  rideFocus: null
};

/* ---------------------------------------------------------------------
   Boot
   --------------------------------------------------------------------- */
export function initWorld(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.7));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.02;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  world.renderer = renderer;

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0xcfe6f2, 120, 240);
  world.scene = scene;

  const camera = new THREE.PerspectiveCamera(42, 1, 0.5, 400);
  camera.position.set(0, 55, 60);
  world.camera = camera;

  buildSky(scene);
  buildLights(scene);
  buildGround(scene);

  world.pathLayer = new THREE.Group(); scene.add(world.pathLayer);
  world.objectLayer = new THREE.Group(); scene.add(world.objectLayer);
  world.visitorLayer = new THREE.Group(); scene.add(world.visitorLayer);
  world.decorLayer = new THREE.Group(); scene.add(world.decorLayer);

  world.entrance = buildEntrance();
  const e = tileCenter(Math.floor(GRID.w / 2), GRID.h - 2);
  world.entrance.position.set(e.x, 0, e.z + 4);
  scene.add(world.entrance);

  const ring = new THREE.Mesh(
    new THREE.RingGeometry(1.7, 2.1, 32),
    new THREE.MeshBasicMaterial({ color: 0xffd166, transparent: true, opacity: 0.9, side: THREE.DoubleSide })
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.08;
  ring.visible = false;
  scene.add(ring);
  world.selectionRing = ring;

  bindPointer(canvas);
  resizeWorld();
  setCameraMode("overview");
  world.ready = true;
  return world;
}

function buildSky(scene) {
  const c = document.createElement("canvas");
  c.width = 64; c.height = 512;
  const ctx = c.getContext("2d");
  const grad = ctx.createLinearGradient(0, 0, 0, 512);
  grad.addColorStop(0, "#4a9bd8");
  grad.addColorStop(0.35, "#7ec4e8");
  grad.addColorStop(0.62, "#c8e8f5");
  grad.addColorStop(0.82, "#f7e8cf");
  grad.addColorStop(1, "#f4dcc0");
  ctx.fillStyle = grad; ctx.fillRect(0, 0, 64, 512);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sky = new THREE.Mesh(new THREE.SphereGeometry(230, 24, 16), new THREE.MeshBasicMaterial({ map: tex, side: THREE.BackSide, depthWrite: false }));
  scene.add(sky);
  world.sky = sky;

  const sun = new THREE.Mesh(new THREE.SphereGeometry(5.5, 16, 12), new THREE.MeshBasicMaterial({ color: 0xfff4c9 }));
  sun.position.set(-80, 105, -70);
  scene.add(sun);
  const glowMat = new THREE.SpriteMaterial({ map: radialTexture("#fff2c9"), transparent: true, opacity: 0.75, depthWrite: false });
  const halo = new THREE.Sprite(glowMat);
  halo.scale.set(46, 46, 1);
  halo.position.copy(sun.position);
  scene.add(halo);

  const cloudMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, transparent: true, opacity: 0.94, flatShading: false });
  for (let i = 0; i < 14; i++) {
    const g = new THREE.Group();
    const puffs = 3 + Math.floor(Math.random() * 3);
    for (let k = 0; k < puffs; k++) {
      const puff = new THREE.Mesh(new THREE.SphereGeometry(3 + Math.random() * 3, 10, 8), cloudMat);
      puff.position.set((k - puffs / 2) * 4, Math.random() * 1.6, Math.random() * 3);
      puff.scale.y = 0.68;
      g.add(puff);
    }
    const a = Math.random() * Math.PI * 2;
    const r = 95 + Math.random() * 70;
    g.position.set(Math.cos(a) * r, 38 + Math.random() * 26, Math.sin(a) * r);
    scene.add(g);
    world.clouds.push(g);
  }
}

function radialTexture(color) {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const x = c.getContext("2d");
  const g = x.createRadialGradient(64, 64, 2, 64, 64, 64);
  g.addColorStop(0, color);
  g.addColorStop(0.35, color);
  g.addColorStop(1, "rgba(255,255,255,0)");
  x.fillStyle = g; x.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function buildLights(scene) {
  const hemi = new THREE.HemisphereLight(0xdff1ff, 0x7a9b5a, 1.05);
  scene.add(hemi);
  world.hemi = hemi;
  const sun = new THREE.DirectionalLight(0xfff1d6, 1.9);
  sun.position.set(-45, 70, 30);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.near = 4;
  sun.shadow.camera.far = 180;
  sun.shadow.camera.left = -70;
  sun.shadow.camera.right = 70;
  sun.shadow.camera.top = 70;
  sun.shadow.camera.bottom = -70;
  sun.shadow.bias = -0.0008;
  sun.shadow.normalBias = 0.04;
  scene.add(sun);
  world.sun = sun;
  const fill = new THREE.DirectionalLight(0xcfe6ff, 0.4);
  fill.position.set(40, 30, -40);
  scene.add(fill);
}

function grassTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 512;
  const x = c.getContext("2d");
  x.fillStyle = "#7cb26a"; x.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 5200; i++) {
    const g = 110 + Math.random() * 60;
    x.fillStyle = `rgba(${70 + Math.random() * 40},${g},${60 + Math.random() * 40},${0.16 + Math.random() * 0.2})`;
    x.fillRect(Math.random() * 512, Math.random() * 512, 1 + Math.random() * 2, 1 + Math.random() * 3);
  }
  for (let i = 0; i < 26; i++) {
    x.fillStyle = `rgba(255,255,255,0.035)`;
    x.beginPath(); x.arc(Math.random() * 512, Math.random() * 512, 20 + Math.random() * 50, 0, 6.3); x.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(7, 7);
  return t;
}

function buildGround(scene) {
  const size = GRID.w * T + 26;
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(size, size, 1, 1), new THREE.MeshStandardMaterial({ map: grassTexture(), roughness: 0.95 }));
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);
  world.ground = ground;

  // a sandy ring and a shallow lake beyond the fence so the horizon is not empty
  const ring = new THREE.Mesh(new THREE.RingGeometry(size * 0.52, size * 0.53, 64), new THREE.MeshStandardMaterial({ color: 0xe8d6b6, roughness: 0.9 }));
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = -0.02;
  scene.add(ring);

  const lake = new THREE.Mesh(new THREE.CircleGeometry(26, 40), new THREE.MeshStandardMaterial({ color: 0x59b3cf, roughness: 0.12, metalness: 0.1 }));
  lake.rotation.x = -Math.PI / 2;
  lake.position.set(-86, -0.1, 40);
  scene.add(lake);

  // trees and shrubs around the outside, so the park sits in a landscape
  const outer = new THREE.Group();
  for (let i = 0; i < 46; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = 74 + Math.random() * 30;
    const kind = ["oak", "pine", "blossom", "oak", "pine"][i % 5];
    const tree = buildTree(kind, 0.9 + Math.random() * 0.7);
    tree.position.set(Math.cos(a) * r, 0, Math.sin(a) * r);
    tree.rotation.y = Math.random() * 6.28;
    outer.add(tree);
  }
  for (let i = 0; i < 30; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = 60 + Math.random() * 18;
    const bush = new THREE.Mesh(new THREE.SphereGeometry(1.6 + Math.random(), 8, 6), mat(Math.random() > 0.5 ? "#5c9c63" : "#4f8f58", { rough: 0.9 }));
    bush.position.set(Math.cos(a) * r, 0.7, Math.sin(a) * r);
    bush.scale.y = 0.65;
    bush.castShadow = true;
    outer.add(bush);
  }
  scene.add(outer);
  world.outer = outer;
}

/* ---------------------------------------------------------------------
   Camera
   --------------------------------------------------------------------- */
export function setCameraMode(mode, opts = {}) {
  world.mode = mode;
  const w = world.camWanted;
  if (mode === "top") { w.pitch = 1.44; w.dist = 58; w.target.set(0, 0, 6); }
  else if (mode === "overview") { w.pitch = 0.8; w.dist = 78; w.target.set(0, 0, 8); }
  else if (mode === "orbit") { w.pitch = Math.max(0.45, w.pitch); w.dist = 48; }
  else if (mode === "ride" && opts.target) {
    w.target.copy(opts.target);
    w.pitch = 0.34; w.dist = 22;
  } else if (mode === "build") { w.pitch = 0.95; w.dist = 46; }
  if (opts.yaw !== undefined) w.yaw = opts.yaw;
}

export function focusRide(obj) {
  if (!obj) return;
  const c = tileCenter(obj.i + (obj.w - 1) / 2, obj.j + (obj.h - 1) / 2);
  setCameraMode("ride", { target: new THREE.Vector3(c.x, 5, c.z) });
  world.rideFocus = obj.id;
  world.camWanted.yaw = 0.8;
}

export function resetCamera() { setCameraMode("orbit"); world.rideFocus = null; }

/* ---------------------------------------------------------------------
   Layout & objects
   --------------------------------------------------------------------- */
export function setLayout(state) {
  world.objectLayer.clear();
  world.pathLayer.clear();
  world.rides.clear();
  world.objects.clear();
  world.pathways.clear();
  (state.paths || []).forEach((p) => world.pathways.add(p.i + "," + p.j));
  paintPaths(state.paths || []);
  (state.objects || []).forEach((o) => addObject(o));
  buildFence(state.land || 8);
  buildEntranceSign(state.name);
}

let entranceLabel = null;
function buildEntranceSign(name) {
  if (entranceLabel) { entranceLabel.parent && entranceLabel.parent.remove(entranceLabel); entranceLabel = null; }
  if (!name) return;
  const c = document.createElement("canvas");
  c.width = 512; c.height = 128;
  const x = c.getContext("2d");
  x.fillStyle = "rgba(255,249,239,0.92)";
  x.beginPath(); x.roundRect(0, 0, 512, 128, 26); x.fill();
  x.fillStyle = "#c94f70";
  x.font = "700 54px Georgia, serif";
  x.textAlign = "center"; x.textBaseline = "middle";
  x.fillText(String(name).slice(0, 22), 256, 66);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(8.2, 2.05), new THREE.MeshBasicMaterial({ map: tex, transparent: true }));
  mesh.position.set(0, 6.0, 0.12);
  world.entrance.add(mesh);
  entranceLabel = mesh;
}

export function buildFence(radius) {
  if (world.fence) { world.scene.remove(world.fence); world.fence = null; }
  const g = new THREE.Group();
  const min = 0, max = GRID.w - 1;
  const lo = Math.max(min, Math.floor((GRID.w - 1) / 2 - radius));
  const hi = Math.min(max, Math.ceil((GRID.w - 1) / 2 + radius));
  const color = "#e8dcc6";
  const post = (i, j) => {
    const c = tileCenter(i, j);
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.16, 1.6, 6), mat(color, { rough: 0.7 }));
    p.position.set(c.x, 0.8, c.z);
    p.castShadow = true;
    g.add(p);
  };
  for (let i = lo; i <= hi + 1; i++) {
    for (const j of [lo, hi + 1]) {
      const c = tileCenter(i, j);
      const rail = new THREE.Mesh(new THREE.BoxGeometry(T, 0.12, 0.12), mat(color));
      rail.position.set(c.x + T / 2, 1.1, c.z);
      g.add(rail);
      post(i, j);
    }
  }
  for (let j = lo; j <= hi + 1; j++) {
    for (const i of [lo, hi + 1]) {
      const c = tileCenter(i, j);
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, T), mat(color));
      rail.position.set(c.x, 1.1, c.z + T / 2);
      g.add(rail);
      post(i, j);
    }
  }
  world.scene.add(g);
  world.fence = g;
}

export function paintPaths(paths) {
  world.pathLayer.clear();
  const geo = new THREE.BoxGeometry(T - 0.24, 0.1, T - 0.24);
  const mats = {
    path: new THREE.MeshStandardMaterial({ color: 0xe4d3b8, roughness: 0.85 }),
    plaza: new THREE.MeshStandardMaterial({ color: 0xf0e2c9, roughness: 0.8 }),
    queue: new THREE.MeshStandardMaterial({ color: 0xd7c3a5, roughness: 0.9 })
  };
  paths.forEach((p) => {
    const c = tileCenter(p.i, p.j);
    const tile = new THREE.Mesh(geo, mats[p.type] || mats.path);
    tile.position.set(c.x, 0.06, c.z);
    tile.receiveShadow = true;
    world.pathLayer.add(tile);
  });
}

export function addObject(obj) {
  const def = DEF_BY_ID[obj.type];
  if (!def) return null;
  const c = tileCenter(obj.i + (obj.w - 1) / 2, obj.j + (obj.h - 1) / 2);
  let root;
  let update = null;
  if (def.model && def.fun !== undefined) {
    const built = buildRide(obj.plan ? { ...def, plan: obj.plan } : def);
    root = built.group;
    update = built.update;
    world.rides.set(obj.id, { update, def, obj, time: Math.random() * 20, group: root, boarded: 0 });
  } else if (def.kind) {
    root = buildBuilding(def);
  } else {
    root = buildDecor(def);
  }
  root.position.set(c.x, 0, c.z);
  root.rotation.y = (obj.rot || 0) * Math.PI / 2;
  root.userData.oid = obj.id;
  root.userData.type = obj.type;
  world.objectLayer.add(root);
  world.objects.set(obj.id, { root, obj, def, update });
  return root;
}

function buildDecor(def) {
  switch (def.model) {
    case "oak": return buildTree("oak", 1);
    case "pine": return buildTree("pine", 1);
    case "palm": return buildTree("palm", 1);
    case "blossom": return buildTree("blossom", 1);
    case "flowers": return buildFlowers();
    case "flowerbed": return buildFlowerbed();
    case "hedge": return buildHedge();
    case "topiary": return buildTopiary();
    case "bench": return buildBench();
    case "bin": return buildBin();
    case "lamp": return buildLamp();
    case "fountain": return buildFountain(1);
    case "statue": return buildStatue();
    case "flag": return buildFlag();
    case "arch": return buildArch();
    case "balloonarch": return buildBalloonArch();
    case "fence": return buildFencePiece();
    case "pond": return buildPond();
    case "bridge": return buildBridge();
    default: {
      const g = new THREE.Group();
      const box = new THREE.Mesh(new THREE.BoxGeometry(3, 2, 3), mat("#c9b28a"));
      box.position.y = 1;
      g.add(box);
      return g;
    }
  }
}

function buildFencePiece() {
  const g = new THREE.Group();
  const posts = 2;
  for (let i = 0; i < posts; i++) {
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 1.2, 6), mat("#f4e3cf"));
    p.position.set(-1.6 + i * 3.2, 0.6, 0);
    g.add(p);
  }
  const rail = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.12, 0.1), mat("#f4e3cf"));
  rail.position.y = 0.9;
  g.add(rail);
  return g;
}

export function removeObjectMesh(id) {
  const rec = world.objects.get(id);
  if (!rec) return;
  world.objectLayer.remove(rec.root);
  rec.root.traverse((o) => { if (o.isMesh && o.geometry && o.geometry.dispose && o.material && o.material.__shared !== true) { /* geometries are cached */ } });
  world.objects.delete(id);
  world.rides.delete(id);
}

export function moveObjectMesh(obj) {
  const rec = world.objects.get(obj.id);
  if (!rec) return;
  const c = tileCenter(obj.i + (obj.w - 1) / 2, obj.j + (obj.h - 1) / 2);
  rec.root.position.set(c.x, 0, c.z);
  rec.obj = obj;
}

export function setSelected(id) {
  world.selectedId = id;
  const rec = id ? world.objects.get(id) : null;
  if (!rec) { world.selectionRing.visible = false; return; }
  const o = rec.obj;
  const c = tileCenter(o.i + (o.w - 1) / 2, o.j + (o.h - 1) / 2);
  world.selectionRing.position.set(c.x, 0.09, c.z);
  world.selectionRing.scale.setScalar(Math.max(o.w, o.h) * 0.62);
  world.selectionRing.visible = true;
}

/* ---------------------------------------------------------------------
   Ghost preview
   --------------------------------------------------------------------- */
export function setGhost(def, i, j, rot, valid, plan) {
  const key = def.id + "|" + (valid ? "1" : "0") + "|" + (plan && plan.pieces ? plan.pieces.length : 0);
  if (!world.ghost || world.ghostKey !== key) {
    if (world.ghost) world.scene.remove(world.ghost);
    const root = def.fun !== undefined
      ? buildRide(plan && plan.pieces ? { ...def, plan } : def).group
      : def.kind ? buildBuilding(def) : buildDecor(def);
    root.traverse((o) => {
      if (o.isMesh) {
        o.material = o.material.clone();
        o.material.transparent = true;
        o.material.opacity = 0.55;
        o.material.color = new THREE.Color(valid ? "#7ddc8a" : "#ff7d7d");
        o.material.emissive = new THREE.Color(valid ? "#2c7a3a" : "#7a2c2c");
        o.material.emissiveIntensity = 0.25;
        o.castShadow = false;
      }
    });
    world.ghost = root;
    world.ghostKey = key;
    world.scene.add(root);
  }
  const c = tileCenter(i + (def.size[0] - 1) / 2, j + (def.size[1] - 1) / 2);
  world.ghost.position.set(c.x, 0, c.z);
  world.ghost.rotation.y = rot * Math.PI / 2;
  world.ghost.visible = true;
}

export function hideGhost() {
  if (world.ghost) world.ghost.visible = false;
}

/* ---------------------------------------------------------------------
   Picking
   --------------------------------------------------------------------- */
export function pickTile(clientX, clientY) {
  const rect = world.renderer.domElement.getBoundingClientRect();
  world.pointer.set(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
  world.raycaster.setFromCamera(world.pointer, world.camera);
  const hit = world.raycaster.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), new THREE.Vector3());
  if (!hit) return null;
  const i = Math.round(hit.x / T + (GRID.w - 1) / 2);
  const j = Math.round(hit.z / T + (GRID.h - 1) / 2);
  return { i, j, x: hit.x, z: hit.z };
}

export function pickObject(clientX, clientY) {
  const rect = world.renderer.domElement.getBoundingClientRect();
  world.pointer.set(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
  world.raycaster.setFromCamera(world.pointer, world.camera);
  const hits = world.raycaster.intersectObjects(world.objectLayer.children, true);
  for (const h of hits) {
    let o = h.object;
    while (o && !o.userData.oid) o = o.parent;
    if (o && o.userData.oid) return o.userData.oid;
  }
  return null;
}

function bindPointer(canvas) {
  let down = null;
  const el = canvas;
  canvas.addEventListener("pointerdown", (e) => {
    canvas.setPointerCapture(e.pointerId);
    down = { x: e.clientX, y: e.clientY, button: e.button, yaw: world.camWanted.yaw, pitch: world.camWanted.pitch, tx: world.camWanted.target.x, tz: world.camWanted.target.z };
    world.moved = 0;
  });
  canvas.addEventListener("pointermove", (e) => {
    const tile = pickTile(e.clientX, e.clientY);
    if (tile && world.callbacks.onHover) world.callbacks.onHover(tile, pickObject(e.clientX, e.clientY));
    if (!down) return;
    const dx = e.clientX - down.x, dy = e.clientY - down.y;
    world.moved = Math.max(world.moved, Math.hypot(dx, dy));
    if (down.button === 2 || e.shiftKey) {
      const s = world.cam.dist * 0.0016;
      const rightX = Math.cos(world.camWanted.yaw), rightZ = -Math.sin(world.camWanted.yaw);
      world.camWanted.target.x = down.tx - (dx * rightX - dy * Math.sin(world.camWanted.yaw)) * s;
      world.camWanted.target.z = down.tz - (dx * rightZ - dy * Math.cos(world.camWanted.yaw)) * s;
    } else {
      world.camWanted.yaw = down.yaw - dx * 0.006;
      world.camWanted.pitch = Math.max(0.18, Math.min(1.48, down.pitch + dy * 0.005));
    }
    if (world.mode === "top" || world.mode === "overview") world.mode = "orbit";
  });
  const end = (e) => {
    if (down && world.moved < 6 && e.button === 0) {
      const tile = pickTile(e.clientX, e.clientY);
      const objId = pickObject(e.clientX, e.clientY);
      if (tile && world.callbacks.onClick) world.callbacks.onClick(tile, objId, e);
    }
    down = null;
  };
  canvas.addEventListener("pointerup", end);
  canvas.addEventListener("pointercancel", () => { down = null; });
  canvas.addEventListener("contextmenu", (e) => e.preventDefault());
  canvas.addEventListener("wheel", (e) => {
    e.preventDefault();
    world.camWanted.dist = Math.max(14, Math.min(130, world.camWanted.dist + e.deltaY * 0.06));
    if (world.mode === "overview" || world.mode === "top") world.mode = "orbit";
  }, { passive: false });

  // keyboard pan
  window.addEventListener("keydown", (e) => {
    if (e.target && /input|textarea|select/i.test(e.target.tagName)) return;
    const step = world.camWanted.dist * 0.08;
    const yaw = world.camWanted.yaw;
    if (e.key === "w" || e.key === "ArrowUp") { world.camWanted.target.x += Math.sin(yaw) * step; world.camWanted.target.z += Math.cos(yaw) * step; }
    if (e.key === "s" || e.key === "ArrowDown") { world.camWanted.target.x -= Math.sin(yaw) * step; world.camWanted.target.z -= Math.cos(yaw) * step; }
    if (e.key === "a" || e.key === "ArrowLeft") { world.camWanted.target.x -= Math.cos(yaw) * step; world.camWanted.target.z += Math.sin(yaw) * step; }
    if (e.key === "d" || e.key === "ArrowRight") { world.camWanted.target.x += Math.cos(yaw) * step; world.camWanted.target.z -= Math.sin(yaw) * step; }
  });

  // two-finger pinch
  let pinch = null;
  canvas.addEventListener("touchstart", (e) => {
    if (e.touches.length === 2) pinch = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
  }, { passive: true });
  canvas.addEventListener("touchmove", (e) => {
    if (e.touches.length === 2 && pinch) {
      const d = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
      world.camWanted.dist = Math.max(14, Math.min(130, world.camWanted.dist * (pinch / d)));
      pinch = d;
    }
  }, { passive: true });
  canvas.addEventListener("touchend", () => { pinch = null; });
}

/* ---------------------------------------------------------------------
   Visitors
   --------------------------------------------------------------------- */
export function createVisitorMesh(colors) {
  const p = buildPerson({ shirt: colors.shirt, trousers: colors.trousers, hair: colors.hair, skin: colors.skin, bag: colors.bag });
  world.visitorLayer.add(p.group);
  return p;
}

export function removeVisitorMesh(p) {
  if (p && p.group.parent) p.group.parent.remove(p.group);
}

export function createStaffMesh(role) {
  const p = buildStaffProxy(role);
  world.visitorLayer.add(p.group);
  return p;
}

import { buildStaff } from "./models.js";
function buildStaffProxy(role) { return buildStaff(role); }

/* ---------------------------------------------------------------------
   Frame
   --------------------------------------------------------------------- */
export function update(dt, state) {
  if (!world.ready) return;
  world.clock += dt;
  const c = world.cam, w = world.camWanted;
  const k = Math.min(1, dt * 3.2);
  c.yaw += (w.yaw - c.yaw) * k;
  c.pitch += (w.pitch - c.pitch) * k;
  c.dist += (w.dist - c.dist) * k;
  c.target.lerp(w.target, k);
  if (world.mode === "ride") w.yaw += dt * 0.09;
  const cp = Math.cos(c.pitch);
  world.camera.position.set(c.target.x + c.dist * cp * Math.sin(c.yaw), c.target.y + c.dist * Math.sin(c.pitch), c.target.z + c.dist * cp * Math.cos(c.yaw));
  world.camera.lookAt(c.target);

  world.clouds.forEach((cloud, i) => {
    cloud.position.x += dt * (0.25 + (i % 3) * 0.12);
    if (cloud.position.x > 190) cloud.position.x = -190;
  });

  const open = state ? !!state.open : true;
  world.rides.forEach((r) => {
    r.time += dt;
    const phase = state && state.rideState ? state.rideState[r.obj.id] : null;
    const running = open && !(phase && phase.broken);
    try { if (r.update) r.update(dt, { running, time: r.time, phase: phase ? phase.phase : 0 }); } catch (err) { /* a single bad model must not stop the park */ }
  });
  if (world.mode === "ride" && world.rideFocus && state && state.objects) {
    const o = state.objects.find((ob) => ob.id === world.rideFocus);
    if (o) {
      const tc = tileCenter(o.i + (o.w - 1) / 2, o.j + (o.h - 1) / 2);
      w.target.x += (tc.x - w.target.x) * 0.05;
      w.target.z += (tc.z - w.target.z) * 0.05;
    }
  }

  // lamps at night
  const lampsOn = world.night > 0.35;
  world.objectLayer.traverse((o) => {
    if (o.userData && o.userData.lamp) o.userData.lamp.intensity = lampsOn ? 2.2 : 0;
  });

  world.renderer.render(world.scene, world.camera);
}

export function updateVisitor(v) {
  if (!v.mesh) return;
  v.mesh.group.position.set(v.x, 0, v.z);
  if (v.heading !== undefined) v.mesh.group.rotation.y = v.heading;
  v.mesh.animate(v.animTime || 0, !!v.moving);
}

export function setVisitorVisible(v, visible) {
  if (v.mesh) v.mesh.group.visible = visible;
}

export function resizeWorld() {
  if (!world.renderer) return;
  const parent = world.renderer.domElement.parentElement;
  const w = parent.clientWidth, h = parent.clientHeight;
  if (!w || !h) return;
  world.renderer.setSize(w, h, false);
  world.camera.aspect = w / h;
  world.camera.fov = w < 760 ? 50 : 42;
  world.camera.updateProjectionMatrix();
}

export function setDayPhase(t) {
  // t: 0..1 through the opening day. Golden hour near the end, warm nights off-hours.
  const warm = Math.max(0, Math.sin((t - 0.65) * Math.PI * 1.6));
  world.night = t > 0.9 || t < 0.04 ? 0.6 : 0;
  world.dayFactor = 1 - warm * 0.25;
  if (world.sun) {
    world.sun.intensity = 1.9 - warm * 0.7 - world.night * 0.9;
    world.sun.color.setHex(warm > 0.3 ? 0xffc48a : 0xfff1d6);
  }
  if (world.hemi) {
    world.hemi.intensity = 1.05 - warm * 0.2 - world.night * 0.45;
    world.hemi.color.setHex(world.night > 0.3 ? 0x8fa6c4 : 0xdff1ff);
  }
  if (world.renderer) world.renderer.toneMappingExposure = 1.02 - warm * 0.1 - world.night * 0.16;
  if (world.sky) world.sky.material.color.setHex(world.night > 0.3 ? 0xa8b8d0 : 0xffffff);
}
