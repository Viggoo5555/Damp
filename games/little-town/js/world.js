/* =====================================================================
   LITTLE TOWN — the 3D world
   A warm, isometric valley: grass plots, a winding river, low hills,
   drifting clouds, detailed buildings, animated water and villagers.
   The camera pans, rotates, zooms and can swing down to street level.
   ===================================================================== */
import * as THREE from "three";
import { CONFIG } from "./config.js";
import { DEF_BY_ID, ROAD_BY_ID } from "./data.js";
import { buildObject, buildRoadTile, createResident, animateResident, mergeStatic } from "./models.js";
import { isWater, landHalf, roadMask, objectCenter, dims, season as getSeason, S } from "./town.js";

const G = CONFIG.grid;
const T = CONFIG.tile;
const SEASONS = {
  spring: { top: "#9ecfe4", bottom: "#f8e9d5", ground: "#93b467", fog: "#dfe9d8", sun: "#fff0cf" },
  summer: { top: "#8fc9e8", bottom: "#f7e6c9", ground: "#8aab5c", fog: "#dbe8d4", sun: "#ffe7b8" },
  autumn: { top: "#b7cbd6", bottom: "#f3d9b5", ground: "#a89a5a", fog: "#e5d9c2", sun: "#ffd9a0" },
  winter: { top: "#c5d8e2", bottom: "#f3eee5", ground: "#dfe4da", fog: "#e8ece8", sun: "#f2f4f6" }
};

export const world = {
  scene: null,
  camera: null,
  renderer: null,
  callbacks: { onClick: null, onHover: null, onObject: null },
  hover: null,
  selected: null,
  tool: null,
  ready: false
};

const cam = {
  target: new THREE.Vector3(0, 0, 0),
  goalTarget: new THREE.Vector3(0, 0, 0),
  azimuth: Math.PI * 0.28,
  goalAzimuth: Math.PI * 0.28,
  elevation: 0.9,
  goalElevation: 0.9,
  view: 42,
  goalView: 42,
  focus: null
};
let scene, camera, renderer, sun, hemi;
let objectsGroup, roadsGroup, selectionGroup, ghostGroup, hoverGroup, residentsGroup, borderGroup, gridGroup, plotMesh;
let waterMesh, waterMat, foamGroup, cloudGroup, particlePoints;
let currentSeason = "summer";
let roadsRev = -1;
let lastState = null;
let ghostKey = "";
let ghostObj = null;
let ghostValid = true;
let pointer = { down: false, x: 0, y: 0, moved: 0, id: null, pan: false, mode: "none" };
let hoverTile = null;
let roadGhostMesh = null;
let resizeObserver = null;

/* ---------------------------------------------------------------------
   Textures
   --------------------------------------------------------------------- */
function grassTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 256; canvas.height = 256;
  const c = canvas.getContext("2d");
  c.fillStyle = "#9ab26b"; c.fillRect(0, 0, 256, 256);
  let seed = 7;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  for (let i = 0; i < 2400; i++) {
    const x = rnd() * 256, y = rnd() * 256;
    const tone = 125 + Math.floor(rnd() * 55);
    c.fillStyle = `rgba(${tone - 15},${tone + 15},${tone - 45},${0.15 + rnd() * 0.3})`;
    c.fillRect(x, y, 1 + rnd() * 2, 2 + rnd() * 5);
  }
  for (let i = 0; i < 60; i++) {
    c.fillStyle = "rgba(245,235,190,0.5)";
    c.beginPath(); c.arc(rnd() * 256, rnd() * 256, rnd() * 1.6, 0, Math.PI * 2); c.fill();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(16, 16);
  return tex;
}
function waterTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 256; canvas.height = 256;
  const c = canvas.getContext("2d");
  c.fillStyle = "#78afb2"; c.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 90; i++) {
    const y = Math.random() * 256;
    c.strokeStyle = `rgba(220,245,242,${0.05 + Math.random() * 0.18})`;
    c.lineWidth = 1 + Math.random() * 2;
    c.beginPath();
    for (let x = 0; x <= 256; x += 8) c.lineTo(x, y + Math.sin((x + i * 30) * 0.05) * 5);
    c.stroke();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(5, 2);
  return tex;
}

/* ---------------------------------------------------------------------
   Boot
   --------------------------------------------------------------------- */
export function initWorld(canvas) {
  scene = new THREE.Scene();
  scene.background = new THREE.Color("#cfe5ec");
  scene.fog = new THREE.Fog("#dfe8dc", 95, 190);
  camera = new THREE.OrthographicCamera(-20, 20, 20, -20, 0.1, 320);
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.06;
  world.scene = scene; world.camera = camera; world.renderer = renderer;

  hemi = new THREE.HemisphereLight("#e8f3f1", "#6f7c54", 1.05);
  scene.add(hemi);
  sun = new THREE.DirectionalLight("#ffeac4", 2.1);
  sun.position.set(30, 48, 22);
  sun.target.position.set(0, 0, 6);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -45; sun.shadow.camera.right = 45;
  sun.shadow.camera.top = 45; sun.shadow.camera.bottom = -45;
  sun.shadow.camera.near = 1; sun.shadow.camera.far = 140;
  sun.shadow.bias = -0.0006;
  sun.shadow.normalBias = 0.03;
  scene.add(sun); scene.add(sun.target);

  buildSky();
  buildGround();
  buildRiver();
  buildOutskirts();
  buildClouds();
  buildParticles();

  objectsGroup = new THREE.Group();
  roadsGroup = new THREE.Group();
  selectionGroup = new THREE.Group();
  ghostGroup = new THREE.Group();
  hoverGroup = new THREE.Group();
  residentsGroup = new THREE.Group();
  borderGroup = new THREE.Group();
  gridGroup = new THREE.Group();
  scene.add(objectsGroup, roadsGroup, selectionGroup, ghostGroup, hoverGroup, residentsGroup, borderGroup, gridGroup);
  selectionGroup.visible = false;
  hoverGroup.visible = false;
  ghostGroup.visible = false;
  gridGroup.visible = false;
  buildSelectionMesh();
  buildHoverMesh();

  bindPointer(canvas);
  window.addEventListener("resize", resizeWorld);
  world.ready = true;
  updateCamera(true);
  return world;
}

export function resizeWorld() {
  if (!renderer) return;
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h);
  const aspect = w / Math.max(1, h);
  camera.left = -cam.view * aspect * 0.5;
  camera.right = cam.view * aspect * 0.5;
  camera.top = cam.view * 0.5;
  camera.bottom = -cam.view * 0.5;
  camera.updateProjectionMatrix();
}

/* ---------------------------------------------------------------------
   Sky, ground, river, outskirts
   --------------------------------------------------------------------- */
function buildSky() {
  const geo = new THREE.SphereGeometry(220, 32, 20);
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      top: { value: new THREE.Color(SEASONS.summer.top) },
      bottom: { value: new THREE.Color(SEASONS.summer.bottom) }
    },
    vertexShader: "varying vec3 vWorld; void main(){ vWorld = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",
    fragmentShader: "uniform vec3 top; uniform vec3 bottom; varying vec3 vWorld; void main(){ float h = clamp(normalize(vWorld).y*1.4+0.25,0.0,1.0); gl_FragColor = vec4(mix(bottom, top, h),1.0); }"
  });
  const sky = new THREE.Mesh(geo, mat);
  sky.frustumCulled = false;
  scene.add(sky);
  world.skyMat = mat;
}
function buildGround() {
  const groundMat = new THREE.MeshStandardMaterial({ map: grassTexture(), color: "#d7e0c3", roughness: 1 });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(320, 320, 1, 1), groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);
  world.groundMat = groundMat;
  plotMesh = new THREE.Mesh(new THREE.PlaneGeometry(36, 36), new THREE.MeshStandardMaterial({ map: grassTexture(), color: "#c6d79c", roughness: 1, transparent: true, opacity: 0.96 }));
  plotMesh.rotation.x = -Math.PI / 2;
  plotMesh.position.y = 0.015;
  plotMesh.receiveShadow = true;
  scene.add(plotMesh);
  world.plotMat = plotMesh.material;
}
function riverCenterZ(x) {
  const xr = x / T;
  return (8.05 + Math.sin(xr * 0.46) * 1.15 + xr * 0.045) * T;
}
function buildRiver() {
  const points = [];
  for (let x = -110; x <= 110; x += 2.5) points.push({ x, z: riverCenterZ(x) });
  const width = 2.36 * T;
  const pos = [], uv = [], idx = [];
  points.forEach((p, i) => {
    pos.push(p.x, 0.16, p.z - width / 2, p.x, 0.16, p.z + width / 2);
    uv.push(i / 8, 0, i / 8, 1);
    if (i < points.length - 1) {
      const a = i * 2, b = i * 2 + 1, c = i * 2 + 2, d = i * 2 + 3;
      idx.push(a, c, b, b, c, d);
    }
  });
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  waterMat = new THREE.MeshStandardMaterial({ map: waterTexture(), color: "#a8d2d2", roughness: 0.18, metalness: 0.18, transparent: true, opacity: 0.88 });
  waterMesh = new THREE.Mesh(geo, waterMat);
  waterMesh.receiveShadow = true;
  scene.add(waterMesh);
  // banks
  for (const side of [-1, 1]) {
    const bp = [], bi = [];
    points.forEach((p, i) => {
      bp.push(p.x, 0.09, p.z + side * width / 2, p.x, 0.12, p.z + side * (width / 2 + 0.8));
      if (i < points.length - 1) {
        const a = i * 2, b = i * 2 + 1, c = i * 2 + 2, d = i * 2 + 3;
        bi.push(a, b, c, b, d, c);
      }
    });
    const bg = new THREE.BufferGeometry();
    bg.setAttribute("position", new THREE.Float32BufferAttribute(bp, 3));
    bg.setIndex(bi);
    bg.computeVertexNormals();
    const bank = new THREE.Mesh(bg, new THREE.MeshStandardMaterial({ color: "#c8b98f", roughness: 1 }));
    bank.receiveShadow = true;
    scene.add(bank);
  }
  foamGroup = new THREE.Group();
  const rockMat = new THREE.MeshStandardMaterial({ color: "#a99e89", roughness: 1 });
  for (let i = 0; i < 32; i++) {
    const x = -50 + (i % 16) * 6.5;
    const side = i < 16 ? -1 : 1;
    const z = riverCenterZ(x) + side * (width / 2 + 0.35);
    const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.35 + (i % 3) * 0.14, 0), rockMat);
    rock.position.set(x, 0.18, z); rock.rotation.set(Math.random(), Math.random(), Math.random());
    rock.scale.y = 0.55; rock.castShadow = true; rock.receiveShadow = true;
    foamGroup.add(rock);
  }
  for (let i = 0; i < 18; i++) {
    const x = -40 + i * 4.8;
    const side = i % 2 ? 1 : -1;
    const z = riverCenterZ(x) + side * (width / 2 + 0.65);
    const reedMat = new THREE.MeshStandardMaterial({ color: i % 3 ? "#6f8f4e" : "#8aa35d", roughness: 0.9 });
    for (let j = 0; j < 4; j++) {
      const reed = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.04, 0.8 + Math.random() * 0.6, 4), reedMat);
      reed.position.set(x + (Math.random() - 0.5), 0.5, z + (Math.random() - 0.5));
      reed.rotation.z = (Math.random() - 0.5) * 0.15;
      foamGroup.add(reed);
    }
  }
  scene.add(foamGroup);
}
function buildOutskirts() {
  const group = new THREE.Group();
  const inner = landHalf() * T + 6;
  // meadow trees ring, always beyond the current plot
  const treeIds = ["old-oak", "pine-stand", "birch-grove", "blossom-tree", "poplar-tree", "willow-tree"];
  let seed = 91;
  const rnd = () => { seed = (seed * 48271) % 2147483647; return seed / 2147483647; };
  for (let i = 0; i < 54; i++) {
    const a = rnd() * Math.PI * 2;
    const radius = inner + 2 + rnd() * 30;
    const x = Math.cos(a) * radius;
    const z = Math.sin(a) * radius + 4;
    if (Math.abs(z - riverCenterZ(x)) < 4.8) continue;
    const def = DEF_BY_ID[treeIds[Math.floor(rnd() * treeIds.length)]];
    if (!def) continue;
    const tree = buildObject(def, { level: 1, variant: Math.floor(rnd() * 6), season: currentSeason });
    tree.position.set(x, 0, z);
    tree.scale.setScalar(0.9 + rnd() * 0.5);
    group.add(tree);
  }
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2 + 0.15;
    const radius = inner + 0.4 + (i % 3) * 0.9;
    const def = DEF_BY_ID[i % 3 === 0 ? "rose-bush" : i % 3 === 1 ? "tulip-bed" : "lavender-patch"];
    if (!def) continue;
    const flower = buildObject(def, { level: 1, variant: 0, season: currentSeason });
    const x = Math.cos(a) * radius, z = Math.sin(a) * radius + 2;
    if (Math.abs(z - riverCenterZ(x)) < 5) continue;
    flower.position.set(x, 0, z);
    group.add(flower);
  }
  // low hills on the horizon
  const hillMat = new THREE.MeshStandardMaterial({ color: "#8ca76a", roughness: 1, flatShading: true });
  for (let i = 0; i < 9; i++) {
    const a = -0.4 + i * 0.65;
    const radius = 84 + (i % 3) * 12;
    const hill = new THREE.Mesh(new THREE.SphereGeometry(15 + (i % 4) * 4, 12, 7), hillMat);
    hill.position.set(Math.cos(a) * radius, -7 - (i % 2) * 3, Math.sin(a) * radius + 8);
    hill.scale.set(1.7, 0.48, 1.2);
    hill.receiveShadow = true;
    group.add(hill);
  }
  // a few tiny distant cottages
  for (let i = 0; i < 5; i++) {
    const a = 0.5 + i * 0.55;
    const x = Math.cos(a) * 60, z = Math.sin(a) * 60 + 8;
    const def = DEF_BY_ID[i % 2 ? "rosewood-cottage" : "willow-cottage"];
    const house = buildObject(def, { level: 1, variant: 2, season: currentSeason });
    house.position.set(x, 0, z); house.scale.setScalar(0.8); house.rotation.y = -a;
    group.add(house);
    const t = buildObject(DEF_BY_ID["old-oak"], { level: 1, variant: 0, season: currentSeason });
    t.position.set(x + 4, 0, z + 2); t.scale.setScalar(0.8);
    group.add(t);
  }
  scene.add(group);
  world.outskirts = group;
}
function buildClouds() {
  // The isometric camera looks down, so a wide sky is never in frame. Distant
  // white puffs only read as boulders on the meadow, so the warm gradient sky
  // and seasonal particles do the atmospheric work instead.
  cloudGroup = new THREE.Group();
  scene.add(cloudGroup);
}
function buildParticles() {
  const count = 160;
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    positions[i * 3] = (Math.random() - 0.5) * 70;
    positions[i * 3 + 1] = 2 + Math.random() * 22;
    positions[i * 3 + 2] = (Math.random() - 0.5) * 70;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const mat = new THREE.PointsMaterial({ color: "#f5c8d8", size: 0.16, transparent: true, opacity: 0.8, depthWrite: false });
  particlePoints = new THREE.Points(geo, mat);
  scene.add(particlePoints);
  world.particleMat = mat;
  setSeason("summer");
}

/* ---------------------------------------------------------------------
   Seasons
   --------------------------------------------------------------------- */
export function setSeason(id, force = false) {
  if (!SEASONS[id]) id = "summer";
  if (!force && id === currentSeason && world.skyMat && world.skyMat.uniforms.top.value.getHex() === new THREE.Color(SEASONS[id].top).getHex()) return;
  currentSeason = id;
  const s = SEASONS[id];
  if (world.skyMat) { world.skyMat.uniforms.top.value.set(s.top); world.skyMat.uniforms.bottom.value.set(s.bottom); }
  if (world.groundMat) world.groundMat.color.set(s.ground);
  if (world.plotMat) world.plotMat.color.set(s.ground).offsetHSL(0.02, 0.03, 0.06);
  scene.background = new THREE.Color(s.top);
  scene.fog.color.set(s.fog);
  if (sun) sun.color.set(s.sun);
  if (waterMat) waterMat.color.set(id === "winter" ? "#a7c8d0" : "#a8d2d2");
  if (world.particleMat) {
    world.particleMat.color.set(id === "spring" ? "#f5c8d8" : id === "autumn" ? "#d99a5d" : id === "winter" ? "#ffffff" : "#f7f1c8");
    world.particleMat.size = id === "winter" ? 0.22 : 0.14;
    world.particleMat.opacity = id === "winter" ? 0.9 : 0.65;
  }
  void force;
}
export function currentSeasonId() { return currentSeason; }

/* ---------------------------------------------------------------------
   Camera & input
   --------------------------------------------------------------------- */
const UP = new THREE.Vector3(0, 1, 0);
function updateCamera(instant = false) {
  if (!camera) return;
  const ease = instant ? 1 : 0.12;
  cam.target.lerp(cam.goalTarget, ease);
  cam.azimuth += (cam.goalAzimuth - cam.azimuth) * ease;
  cam.elevation += (cam.goalElevation - cam.elevation) * ease;
  cam.view += (cam.goalView - cam.view) * ease;
  const dist = 80;
  const x = cam.target.x + Math.sin(cam.azimuth) * Math.cos(cam.elevation) * dist;
  const z = cam.target.z + Math.cos(cam.azimuth) * Math.cos(cam.elevation) * dist;
  const y = cam.target.y + Math.sin(cam.elevation) * dist;
  camera.position.set(x, y, z);
  camera.lookAt(cam.target);
  const aspect = window.innerWidth / Math.max(1, window.innerHeight);
  camera.left = -cam.view * aspect * 0.5;
  camera.right = cam.view * aspect * 0.5;
  camera.top = cam.view * 0.5;
  camera.bottom = -cam.view * 0.5;
  camera.updateProjectionMatrix();
}
export function setCameraMode(mode) {
  const narrow = window.innerWidth < 700 || window.innerWidth / Math.max(1, window.innerHeight) < 0.85;
  if (mode === "top") { cam.goalElevation = 1.42; cam.goalAzimuth = Math.PI * 0.25; cam.goalView = cam.view < 26 ? cam.view : 30; }
  else if (mode === "overview") { cam.goalElevation = 0.9; cam.goalView = narrow ? 48 : 42; }
  else if (mode === "close") { cam.goalElevation = 0.72; cam.goalView = Math.min(20, Math.max(14, cam.view)); }
  else { cam.goalElevation = 0.88; cam.goalAzimuth = Math.PI * 0.28; cam.goalView = narrow ? 46 : 36; }
  world.tool = null;
}
export function rotateCamera(dir = 1) {
  cam.goalAzimuth += dir * Math.PI / 4;
  cam.focus = null;
}
export function panCamera(dx, dy) {
  const scale = cam.view / Math.max(300, window.innerHeight);
  const forward = new THREE.Vector3();
  camera.getWorldDirection(forward);
  forward.y = 0; forward.normalize();
  const right = new THREE.Vector3().crossVectors(forward, UP).normalize();
  cam.goalTarget.addScaledVector(right, dx * scale);
  cam.goalTarget.addScaledVector(forward, dy * scale);
  cam.goalTarget.x = clamp(cam.goalTarget.x, -45, 45);
  cam.goalTarget.z = clamp(cam.goalTarget.z, -35, 50);
  cam.focus = null;
}
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
export function zoomCamera(delta) {
  cam.goalView = clamp(cam.goalView * (1 + delta * 0.0012), 9, 48);
}
export function focusPoint(x, z, view = 17) {
  cam.goalTarget.set(x, 0, z);
  cam.goalView = view;
  cam.goalElevation = 0.72;
  cam.focus = { x, z };
}
export function focusObject(obj) {
  if (!obj) return;
  const c = objectCenter(obj);
  focusPoint(c.x, c.z, 15);
}
function bindPointer(canvas) {
  canvas.addEventListener("pointerdown", (e) => {
    if (e.button !== 0 && e.button !== 1 && e.button !== 2) return;
    pointer = { down: true, x: e.clientX, y: e.clientY, moved: 0, id: e.pointerId, pan: e.button !== 0 || e.shiftKey, mode: "idle" };
    canvas.setPointerCapture && canvas.setPointerCapture(e.pointerId);
  });
  window.addEventListener("pointermove", (e) => {
    if (!pointer.down) { updateHover(e.clientX, e.clientY); return; }
    const dx = e.clientX - pointer.x, dy = e.clientY - pointer.y;
    pointer.moved += Math.abs(dx) + Math.abs(dy);
    pointer.x = e.clientX; pointer.y = e.clientY;
    if (!pointer.pan && pointer.moved > 8 && !world.tool) pointer.mode = "pan";
    if (pointer.pan || pointer.mode === "pan") {
      panCamera(-dx, -dy);
    } else {
      updateHover(e.clientX, e.clientY);
    }
  });
  window.addEventListener("pointerup", (e) => {
    if (!pointer.down) return;
    const wasPan = pointer.pan || pointer.moved > 6;
    pointer.down = false;
    if (!wasPan) {
      const hit = !world.tool ? pickAt(e.clientX, e.clientY) : null;
      if (hit && hit.object && world.callbacks.onObject) world.callbacks.onObject(hit.object, hit.point);
      else {
        const tile = tileFromClient(e.clientX, e.clientY);
        if (tile && world.callbacks.onClick) world.callbacks.onClick(tile);
      }
    }
    pointer.mode = "none";
  });
  canvas.addEventListener("contextmenu", (e) => e.preventDefault());
  canvas.addEventListener("wheel", (e) => { e.preventDefault(); zoomCamera(e.deltaY); }, { passive: false });
  document.addEventListener("keydown", (e) => {
    if (e.target && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
    if (e.key === "q" || e.key === "Q") rotateCamera(1);
    if (e.key === "e" || e.key === "E") rotateCamera(-1);
  });
  // pinch zoom
  let pinch = null;
  canvas.addEventListener("touchstart", (e) => {
    if (e.touches.length === 2) {
      pinch = { dist: Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY), x: (e.touches[0].clientX + e.touches[1].clientX) / 2, y: (e.touches[0].clientY + e.touches[1].clientY) / 2 };
    }
  }, { passive: true });
  canvas.addEventListener("touchmove", (e) => {
    if (e.touches.length === 2 && pinch) {
      const dist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
      zoomCamera((pinch.dist - dist) * 1.6);
      pinch.dist = dist;
    }
  }, { passive: true });
  canvas.addEventListener("touchend", () => { pinch = null; }, { passive: true });
}
function tileFromClient(x, y) {
  const rect = renderer.domElement.getBoundingClientRect();
  const ndc = new THREE.Vector2(((x - rect.left) / rect.width) * 2 - 1, -((y - rect.top) / rect.height) * 2 + 1);
  const raycaster = new THREE.Raycaster();
  raycaster.setFromCamera(ndc, camera);
  const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const point = new THREE.Vector3();
  if (!raycaster.ray.intersectPlane(plane, point)) return null;
  const i = Math.floor(point.x / T + G / 2);
  const j = Math.floor(point.z / T + G / 2);
  if (i < 0 || j < 0 || i >= G || j >= G) return null;
  return { i, j, x: point.x, z: point.z };
}
function updateHover(x, y) {
  const tile = tileFromClient(x, y);
  hoverTile = tile;
  if (world.callbacks.onHover) world.callbacks.onHover(tile);
  if (hoverGroup && tile) {
    hoverGroup.visible = true;
    hoverGroup.position.set((tile.i + 0.5 - G / 2) * T, 0.06, (tile.j + 0.5 - G / 2) * T);
  } else if (hoverGroup) hoverGroup.visible = false;
}
function pickAt(x, y) {
  const rect = renderer.domElement.getBoundingClientRect();
  const ndc = new THREE.Vector2(((x - rect.left) / rect.width) * 2 - 1, -((y - rect.top) / rect.height) * 2 + 1);
  const ray = new THREE.Raycaster();
  ray.setFromCamera(ndc, camera);
  const hits = ray.intersectObjects(objectsGroup.children, true);
  for (const hit of hits) {
    let node = hit.object;
    while (node && !node.userData.objId) node = node.parent;
    if (node && node.userData.objId) {
      const obj = S ? S.objects.find((o) => o.id === node.userData.objId) : null;
      return { object: obj, point: hit.point };
    }
  }
  return null;
}

/* ---------------------------------------------------------------------
   Layout, roads, land
   --------------------------------------------------------------------- */
export function setLayout(state) {
  if (!state) return;
  lastState = state;
  currentSeason = getSeason().id;
  setSeason(currentSeason, true);
  clearGroup(objectsGroup);
  for (const obj of state.objects) addObjectMesh(obj);
  syncRoads(state.roads, state.roadsRev || 1);
  updateLand(state.land);
  world.tool = null;
}
export function refreshLayout() { if (lastState) setLayout(lastState); }
function clearGroup(group) {
  if (!group) return;
  while (group.children.length) {
    const child = group.children.pop();
    child.traverse && child.traverse((o) => { if (o.isMesh && o.geometry) o.geometry.dispose(); });
  }
}
export function addObjectMesh(obj) {
  if (!obj || !DEF_BY_ID[obj.type] || !objectsGroup) return null;
  const def = DEF_BY_ID[obj.type];
  const mesh = buildObject(def, { level: obj.level || 1, variant: obj.variant || 0, season: currentSeason });
  const c = objectCenter(obj);
  mesh.position.set(c.x, 0, c.z);
  mesh.rotation.y = ((obj.rot || 0) * Math.PI) / 2;
  mesh.userData.objId = obj.id;
  mesh.traverse((o) => { if (o.isMesh) { o.userData.objId = obj.id; o.castShadow = true; o.receiveShadow = true; } });
  objectsGroup.add(mesh);
  return mesh;
}
export function removeObjectMesh(id) {
  if (!objectsGroup) return;
  const node = objectsGroup.children.find((c) => c.userData.objId === id);
  if (node) {
    objectsGroup.remove(node);
    node.traverse((o) => { if (o.isMesh && o.geometry) o.geometry.dispose(); });
  }
}
export function syncRoads(roads, rev) {
  if (!roadsGroup || (rev === roadsRev && roadsGroup.children.length)) return;
  roadsRev = rev;
  clearGroup(roadsGroup);
  for (const [key, kind] of Object.entries(roads)) {
    const [i, j] = key.split(",").map(Number);
    if (!Number.isFinite(i) || !Number.isFinite(j)) continue;
    const roadKind = ROAD_BY_ID[kind] ? ROAD_BY_ID[kind].kind : kind;
    const mask = roadMask(i, j, roadKind);
    const tile = buildRoadTile(roadKind, mask, T);
    const p = { x: (i + 0.5 - G / 2) * T, z: (j + 0.5 - G / 2) * T };
    tile.position.set(p.x, 0, p.z);
    roadsGroup.add(tile);
  }
  if (roadsGroup.children.length) mergeStatic(roadsGroup);
}
export function updateLand(level) {
  if (!plotMesh) return;
  const half = landHalf();
  const size = half * 2 * T;
  plotMesh.geometry.dispose();
  plotMesh.geometry = new THREE.PlaneGeometry(size, size);
  plotMesh.position.set(0, 0.015, 0);
  clearGroup(borderGroup);
  const hedgeMat = new THREE.MeshStandardMaterial({ color: "#6f8f55", roughness: 1 });
  const edge = half * T + 0.3;
  const seg = T * 0.94;
  for (let i = -half; i <= half; i++) {
    const x = (i + 0.5) * T - 0.5;
    for (const z of [-edge, edge]) {
      const hedge = new THREE.Mesh(new THREE.BoxGeometry(seg, 0.62, 0.5), hedgeMat);
      hedge.position.set(x, 0.31, z); hedge.castShadow = true; hedge.receiveShadow = true; borderGroup.add(hedge);
      if ((i + half) % 4 === 0) {
        const flower = new THREE.Mesh(new THREE.SphereGeometry(0.12, 6, 5), new THREE.MeshStandardMaterial({ color: "#e7b44c" }));
        flower.position.set(x + 0.2, 0.68, z + 0.18); borderGroup.add(flower);
      }
    }
  }
  for (let j = -half; j <= half; j++) {
    const z = (j + 0.5) * T - 0.5;
    for (const x of [-edge, edge]) {
      const hedge = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.62, seg), hedgeMat);
      hedge.position.set(x, 0.31, z); hedge.castShadow = true; hedge.receiveShadow = true; borderGroup.add(hedge);
    }
  }
  mergeStatic(borderGroup);
  buildGrid(half);
  if (world.outskirts && scene) {
    scene.remove(world.outskirts);
    world.outskirts.traverse((o) => { if (o.isMesh && o.geometry) o.geometry.dispose(); });
    buildOutskirts();
  }
}
function buildGrid(half) {
  clearGroup(gridGroup);
  const pts = [];
  const size = half * 2 * T;
  for (let i = 0; i <= half * 2; i++) {
    const v = -size / 2 + i * T;
    pts.push(-size / 2, 0, v, size / 2, 0, v);
    pts.push(v, 0, -size / 2, v, 0, size / 2);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
  const mat = new THREE.LineBasicMaterial({ color: "#ffffff", transparent: true, opacity: 0.18 });
  const lines = new THREE.LineSegments(geo, mat);
  lines.position.y = 0.03;
  gridGroup.add(lines);
}
export function showGrid(on) { if (gridGroup) gridGroup.visible = !!on; }
export function setTool(tool) {
  world.tool = tool;
  showGrid(tool && (tool.kind === "place" || tool.kind === "road" || tool.kind === "move"));
  if (!tool) { clearGhost(); setSelected(world.selected); }
}

/* ---------------------------------------------------------------------
   Ghosts, hover and selection
   --------------------------------------------------------------------- */
export function setGhost(def, i, j, rot, valid) {
  if (!ghostGroup || !def) return;
  const key = def.id + "|" + rot + "|" + (valid ? 1 : 0);
  const [w, d] = dims(def, rot);
  const cx = (i + w / 2 - G / 2) * T;
  const cz = (j + d / 2 - G / 2) * T;
  if (key !== ghostKey) {
    ghostKey = key;
    ghostGroup.clear();
    let node;
    if (def.model === "road") node = buildRoadTile(def.kind || def.id, 15, T);
    else node = buildObject(def, { level: 1, variant: 0, season: currentSeason });
    node.traverse((o) => {
      if (o.isMesh) {
        o.material = o.material.clone();
        o.material.transparent = true;
        o.material.opacity = 0.72;
        o.material.depthWrite = false;
        if (!valid) o.material.color.offsetHSL(-0.02, 0.15, 0.06);
        o.castShadow = false;
      }
    });
    ghostObj = node;
    ghostGroup.add(node);
    const pad = new THREE.Mesh(new THREE.PlaneGeometry(w * T - 0.25, d * T - 0.25), new THREE.MeshBasicMaterial({ color: valid ? "#6fbf7a" : "#d0645c", transparent: true, opacity: 0.26, depthWrite: false }));
    pad.rotation.x = -Math.PI / 2; pad.position.y = 0.04;
    ghostGroup.add(pad);
  }
  ghostValid = valid;
  ghostGroup.position.set(cx, 0, cz);
  ghostGroup.rotation.y = (rot * Math.PI) / 2;
  ghostGroup.visible = true;
}
export function setRoadGhost(kind, i, j, valid) {
  if (!ghostGroup) return;
  ghostGroup.clear();
  ghostKey = "road|" + kind;
  const node = buildRoadTile(ROAD_BY_ID[kind] ? ROAD_BY_ID[kind].kind : kind, 15, T);
  node.traverse((o) => { if (o.isMesh) { o.material = o.material.clone(); o.material.transparent = true; o.material.opacity = 0.7; o.material.depthWrite = false; o.castShadow = false; } });
  ghostGroup.add(node);
  const pad = new THREE.Mesh(new THREE.PlaneGeometry(T - 0.2, T - 0.2), new THREE.MeshBasicMaterial({ color: valid ? "#6fbf7a" : "#d0645c", transparent: true, opacity: 0.3, depthWrite: false }));
  pad.rotation.x = -Math.PI / 2; pad.position.y = 0.05;
  ghostGroup.add(pad);
  const p = { x: (i + 0.5 - G / 2) * T, z: (j + 0.5 - G / 2) * T };
  ghostGroup.position.set(p.x, 0, p.z);
  ghostGroup.visible = true;
}
export function clearGhost() {
  if (!ghostGroup) return;
  ghostGroup.clear();
  ghostGroup.visible = false;
  ghostKey = "";
  ghostObj = null;
}
function buildHoverMesh() {
  const geo = new THREE.PlaneGeometry(T - 0.14, T - 0.14);
  const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: "#fff6dd", transparent: true, opacity: 0.28, depthWrite: false }));
  mesh.rotation.x = -Math.PI / 2;
  hoverGroup.add(mesh);
  const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geo), new THREE.LineBasicMaterial({ color: "#fffdf2", transparent: true, opacity: 0.7 }));
  edges.rotation.x = -Math.PI / 2;
  edges.position.y = 0.01;
  hoverGroup.add(edges);
}
function buildSelectionMesh() {
  const geo = new THREE.PlaneGeometry(1, 1);
  const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: "#ffe7a8", transparent: true, opacity: 0.22, depthWrite: false }));
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = 0.055;
  mesh.name = "sel-fill";
  selectionGroup.add(mesh);
}
export function setSelected(obj) {
  world.selected = obj || null;
  if (!selectionGroup) return;
  if (!obj) { selectionGroup.visible = false; return; }
  const def = DEF_BY_ID[obj.type];
  if (!def) return;
  const [w, d] = dims(def, obj.rot || 0);
  const c = objectCenter(obj);
  selectionGroup.visible = true;
  selectionGroup.position.set(c.x, 0, c.z);
  const fill = selectionGroup.getObjectByName("sel-fill");
  if (fill) fill.scale.set(w * T - 0.2, d * T - 0.2, 1);
  world.selected = obj;
}
export function hideSelection() { world.selected = null; if (selectionGroup) selectionGroup.visible = false; }

/* ---------------------------------------------------------------------
   Residents
   --------------------------------------------------------------------- */
export function createResidentMesh(look) {
  if (!residentsGroup) return null;
  const mesh = createResident(look);
  residentsGroup.add(mesh);
  return mesh;
}
export function updateResidentMesh(res) {
  if (!res.mesh) return;
  res.mesh.position.set(res.x, 0.02, res.z);
  res.mesh.rotation.y = res.dir || 0;
  if (res.state === "walk") animateResident(res.mesh, res.phase, res.speed);
  else { const limbs = res.mesh.userData.limbs; if (limbs) { limbs.legL.rotation.x = 0; limbs.legR.rotation.x = 0; limbs.armL.rotation.x = 0; limbs.armR.rotation.x = 0; } res.mesh.position.y = 0.02; }
}
export function removeResidentMesh(res) {
  if (!res.mesh || !residentsGroup) return;
  residentsGroup.remove(res.mesh);
  res.mesh.traverse((o) => { if (o.isMesh && o.geometry) o.geometry.dispose(); });
  res.mesh = null;
}
export function clearResidentMeshes() {
  for (const child of [...residentsGroup.children]) {
    residentsGroup.remove(child);
    child.traverse((o) => { if (o.isMesh && o.geometry) o.geometry.dispose(); });
  }
}

/* ---------------------------------------------------------------------
   Frame
   --------------------------------------------------------------------- */
export function update(dt) {
  if (!renderer) return;
  updateCamera();
  if (waterMat && waterMat.map) waterMat.map.offset.x += dt * 0.012;
  if (cloudGroup) cloudGroup.children.forEach((c, i) => { c.position.x += dt * (0.18 + i * 0.02); if (c.position.x > 90) c.position.x = -90; });
  if (particlePoints) {
    const pos = particlePoints.geometry.getAttribute("position");
    const seasonNow = currentSeason;
    const fall = seasonNow === "spring" ? 0.28 : seasonNow === "autumn" ? 0.5 : seasonNow === "winter" ? 0.7 : 0.08;
    const sway = seasonNow === "winter" ? 0.25 : 0.6;
    for (let i = 0; i < pos.count; i++) {
      let y = pos.getY(i) - dt * fall;
      let x = pos.getX(i) + Math.sin((performance.now() * 0.0005) + i) * dt * sway;
      if (y < 0.5) { y = 18 + Math.random() * 8; x = (Math.random() - 0.5) * 70; }
      pos.setY(i, y); pos.setX(i, x);
    }
    pos.needsUpdate = true;
  }
  renderer.render(scene, camera);
}
