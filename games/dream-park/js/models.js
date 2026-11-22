/* =====================================================================
   DREAM PARK — 3D models
   Everything visible is built procedurally: thirty ride families, shops,
   facilities, trees, flowers, fountains, the entrance gate, guests and
   staff. No image stand-ins.
   ===================================================================== */
import * as THREE from "three";
import { RoundedBoxGeometry } from "../../../vendor/three/RoundedBoxGeometry.js";
import { buildCoasterRide } from "./coaster.js";

/* ---------------------------------------------------------------------
   Shared materials & primitives
   --------------------------------------------------------------------- */
const mats = new Map();
export function mat(color, opts = {}) {
  const key = color + "|" + JSON.stringify(opts);
  if (mats.has(key)) return mats.get(key);
  const m = new THREE.MeshStandardMaterial({
    color: new THREE.Color(color),
    roughness: opts.rough !== undefined ? opts.rough : 0.78,
    metalness: opts.metal || 0,
    emissive: opts.emissive ? new THREE.Color(opts.emissive) : 0x000000,
    emissiveIntensity: opts.emissiveIntensity || 0,
    transparent: !!opts.transparent,
    opacity: opts.opacity !== undefined ? opts.opacity : 1,
    side: opts.side || THREE.FrontSide,
    depthWrite: opts.depthWrite !== undefined ? opts.depthWrite : true,
    flatShading: !!opts.flat
  });
  mats.set(key, m);
  return m;
}
export const shine = (color, opts = {}) => mat(color, { rough: 0.34, metal: 0.12, ...opts });
export const metal = (color = "#c9ced6") => mat(color, { rough: 0.3, metal: 0.85 });
export const glass = (tint = "#dff2f7") => mat(tint, { rough: 0.1, metal: 0.05, transparent: true, opacity: 0.32, depthWrite: false });
export const glow = (color, strength = 1.5) => mat(color, { emissive: color, emissiveIntensity: strength, rough: 0.4 });

const geos = new Map();
function rgeo(w, h, d, r = 0.05) {
  const key = [w, h, d, r].map((n) => (+n).toFixed(3)).join("|");
  if (!geos.has(key)) {
    const radius = Math.max(0.002, Math.min(r, w / 2 - 0.001, h / 2 - 0.001, d / 2 - 0.001));
    geos.set(key, new RoundedBoxGeometry(w, h, d, 3, radius));
  }
  return geos.get(key);
}

export function box(parent, w, h, d, color, x = 0, y = 0, z = 0, opts = {}) {
  const m = new THREE.Mesh(rgeo(w, h, d, opts.r === undefined ? 0.04 : opts.r), typeof color === "string" ? mat(color, opts.matOpts || {}) : color);
  m.position.set(x, y, z);
  m.rotation.set(opts.rx || 0, opts.ry || 0, opts.rz || 0);
  m.castShadow = opts.shadow !== false; m.receiveShadow = true;
  parent.add(m);
  return m;
}
export function cyl(parent, rt, rb, h, color, x = 0, y = 0, z = 0, seg = 24, opts = {}) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg, 1, !!opts.open, opts.ts || 0, opts.tl || Math.PI * 2), typeof color === "string" ? mat(color, opts.matOpts || {}) : color);
  m.position.set(x, y, z);
  m.rotation.set(opts.rx || 0, opts.ry || 0, opts.rz || 0);
  m.castShadow = opts.shadow !== false; m.receiveShadow = true;
  parent.add(m);
  return m;
}
export function ball(parent, r, color, x = 0, y = 0, z = 0, seg = 16, scale) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, seg, Math.max(8, Math.round(seg * 0.7))), typeof color === "string" ? mat(color) : color);
  m.position.set(x, y, z);
  if (scale) m.scale.set(scale[0], scale[1], scale[2]);
  m.castShadow = true; m.receiveShadow = true;
  parent.add(m);
  return m;
}
export function cone(parent, r, h, color, x = 0, y = 0, z = 0, seg = 18, opts = {}) {
  const m = new THREE.Mesh(new THREE.ConeGeometry(r, h, seg, 1, !!opts.open), typeof color === "string" ? mat(color, opts.matOpts || {}) : color);
  m.position.set(x, y, z);
  m.rotation.set(opts.rx || 0, opts.ry || 0, opts.rz || 0);
  m.castShadow = true; m.receiveShadow = true;
  parent.add(m);
  return m;
}
export function torus(parent, r, tube, color, x = 0, y = 0, z = 0, opts = {}) {
  const m = new THREE.Mesh(new THREE.TorusGeometry(r, tube, 8, Math.max(12, opts.seg || 26), opts.arc || Math.PI * 2), typeof color === "string" ? mat(color, opts.matOpts || {}) : color);
  m.position.set(x, y, z);
  m.rotation.set(opts.rx || 0, opts.ry || 0, opts.rz || 0);
  m.castShadow = true;
  parent.add(m);
  return m;
}
export function group(parent, x = 0, y = 0, z = 0) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  if (parent) parent.add(g);
  return g;
}
export function plane(parent, w, d, color, x = 0, y = 0, z = 0, opts = {}) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), typeof color === "string" ? mat(color, opts.matOpts || {}) : color);
  m.rotation.x = opts.rx !== undefined ? opts.rx : -Math.PI / 2;
  m.position.set(x, y, z);
  m.receiveShadow = true;
  parent.add(m);
  return m;
}

/* ---------------------------------------------------------------------
   Little helpers used all over the park
   --------------------------------------------------------------------- */
function stripedCanopy(parent, r, h, y, c1, c2, seg = 16) {
  for (let i = 0; i < seg; i++) {
    const a = (i / seg) * Math.PI * 2;
    const wedge = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.16, r, h, 2, 1, false, a, (Math.PI * 2) / seg), mat(i % 2 ? c1 : c2, { rough: 0.6, side: THREE.DoubleSide }));
    wedge.position.set(0, y, 0);
    wedge.castShadow = true;
    parent.add(wedge);
  }
}

function bunting(parent, from, to, y, count, colors) {
  for (let i = 0; i < count; i++) {
    const t = i / (count - 1);
    const x = from[0] + (to[0] - from[0]) * t;
    const z = from[1] + (to[1] - from[1]) * t;
    const flag = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.6), mat(colors[i % colors.length], { side: THREE.DoubleSide }));
    flag.position.set(x, y - Math.abs(Math.sin(t * Math.PI)) * 0.5, z);
    flag.rotation.y = Math.PI / 2;
    parent.add(flag);
  }
}

function signBoard(parent, text, w, h, color, bg, x, y, z, ry = 0) {
  const c = document.createElement("canvas");
  c.width = 512; c.height = 256;
  const g = c.getContext("2d");
  g.fillStyle = bg; g.fillRect(0, 0, 512, 256);
  g.strokeStyle = color; g.lineWidth = 12; g.strokeRect(10, 10, 492, 236);
  g.fillStyle = color;
  g.font = "700 72px Georgia, serif";
  g.textAlign = "center"; g.textBaseline = "middle";
  const words = text.split(" ");
  if (words.length > 2) {
    g.fillText(words.slice(0, Math.ceil(words.length / 2)).join(" "), 256, 100);
    g.fillText(words.slice(Math.ceil(words.length / 2)).join(" "), 256, 176);
  } else g.fillText(text, 256, 128);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex, transparent: true }));
  mesh.position.set(x, y, z);
  mesh.rotation.y = ry;
  parent.add(mesh);
  return mesh;
}

function fenceRing(parent, r, y, color, posts = 24) {
  for (let i = 0; i < posts; i++) {
    const a = (i / posts) * Math.PI * 2;
    cyl(parent, 0.06, 0.06, 1, color, Math.cos(a) * r, y + 0.5, Math.sin(a) * r, 8);
  }
  torus(parent, r, 0.05, color, 0, y + 0.95, 0, { rx: Math.PI / 2, seg: 30 });
  torus(parent, r, 0.035, color, 0, y + 0.5, 0, { rx: Math.PI / 2, seg: 30 });
}

/* ---------------------------------------------------------------------
   People — guests and staff
   --------------------------------------------------------------------- */
export function buildPerson(opts = {}) {
  const g = new THREE.Group();
  const skin = opts.skin || "#f1c9a5";
  const shirt = opts.shirt || "#e07a5f";
  const trousers = opts.trousers || "#3d5a80";
  const hair = opts.hair || "#3a2b22";
  const scale = opts.scale || 1;
  const body = cyl(g, 0.26, 0.3, 0.72, shirt, 0, 1.12, 0, 12, { rough: 0.8 });
  ball(g, 0.135, skin, 0, 1.62, 0, 12);
  const hairMesh = ball(g, 0.15, hair, 0, 1.68, -0.015, 12, [1.02, 0.8, 1.02]);
  if (opts.hat) cone(g, 0.16, 0.24, opts.hat, 0, 1.84, 0, 10);
  const legL = group(g, -0.12, 0.76, 0);
  cyl(legL, 0.09, 0.08, 0.76, trousers, 0, -0.38, 0, 8);
  const legR = group(g, 0.12, 0.76, 0);
  cyl(legR, 0.09, 0.08, 0.76, trousers, 0, -0.38, 0, 8);
  const armL = group(g, -0.32, 1.4, 0);
  cyl(armL, 0.07, 0.06, 0.58, shirt, 0, -0.29, 0, 8);
  const armR = group(g, 0.32, 1.4, 0);
  cyl(armR, 0.07, 0.06, 0.58, shirt, 0, -0.29, 0, 8);
  if (opts.bag) box(g, 0.2, 0.26, 0.12, opts.bag, 0.3, 1.0, 0.12, { r: 0.03 });
  g.scale.setScalar(scale);
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return {
    group: g,
    animate(t, moving) {
      const s = moving ? Math.sin(t * 9) : Math.sin(t * 1.6) * 0.15;
      legL.rotation.x = s * 0.55;
      legR.rotation.x = -s * 0.55;
      armL.rotation.x = -s * 0.45;
      armR.rotation.x = s * 0.45;
      body.position.y = 1.12 + (moving ? Math.abs(Math.sin(t * 9)) * 0.03 : 0);
      hairMesh.visible = !!hair;
    }
  };
}

export function buildStaff(role) {
  const colors = { mechanic: "#3a86ff", cleaner: "#2a9d8f", entertainer: "#ff006e", security: "#1d3557", operator: "#f4a261" };
  const hats = { mechanic: "#2b4c7e", cleaner: "#22776d", entertainer: "#ff4797", security: "#14243c", operator: "#d98644" };
  const p = buildPerson({ shirt: colors[role] || "#666", hat: hats[role] || "#555", trousers: "#2f3b4c", bag: role === "mechanic" ? "#e0b25a" : null });
  if (role === "security") box(p.group, 0.42, 0.1, 0.12, "#ffd166", 0, 1.5, 0.3, { r: 0.03 });
  return p;
}

/* ---------------------------------------------------------------------
   Nature & decoration
   --------------------------------------------------------------------- */
export function buildTree(kind = "oak", scale = 1) {
  const g = new THREE.Group();
  const trunk = mat("#8a5a3c", { rough: 0.9 });
  if (kind === "pine") {
    cyl(g, 0.22, 0.32, 3.2, trunk, 0, 1.6, 0, 8);
    for (let i = 0; i < 4; i++) cone(g, 1.55 - i * 0.28, 1.9 - i * 0.15, i % 2 ? "#3f7d4e" : "#4f9560", 0, 2.8 + i * 0.9, 0, 10);
  } else if (kind === "palm") {
    cyl(g, 0.16, 0.28, 4.4, "#a97c50", 0, 2.2, 0, 8, { rz: 0.06 });
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2;
      const leaf = new THREE.Mesh(new THREE.SphereGeometry(1.5, 8, 5), mat("#4f9d5d", { rough: 0.85 }));
      leaf.scale.set(1, 0.14, 0.42);
      leaf.position.set(Math.cos(a) * 1.2, 4.4 + Math.sin(i) * 0.1, Math.sin(a) * 1.2);
      leaf.rotation.y = -a;
      leaf.rotation.z = 0.32;
      leaf.castShadow = true;
      g.add(leaf);
    }
    for (let i = 0; i < 3; i++) ball(g, 0.16, "#8a5a3c", (Math.random() - 0.5) * 0.5, 4.2, (Math.random() - 0.5) * 0.5, 8);
  } else if (kind === "blossom") {
    cyl(g, 0.2, 0.34, 2.6, trunk, 0, 1.3, 0, 8);
    ball(g, 1.5, "#f6c2d4", 0, 3.3, 0, 12, [1, 0.86, 1]);
    ball(g, 1.1, "#f9d6e3", -0.8, 3.0, 0.4, 10);
    ball(g, 1.0, "#f4b3c9", 0.9, 3.1, -0.3, 10);
    for (let i = 0; i < 18; i++) ball(g, 0.06, "#ffe4ee", (Math.random() - 0.5) * 2.4, 2.2 + Math.random() * 1.4, (Math.random() - 0.5) * 2.4, 5);
  } else {
    cyl(g, 0.24, 0.38, 2.4, trunk, 0, 1.2, 0, 9);
    const greens = ["#4f9560", "#5aa86c", "#3f7d4e"];
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      ball(g, 1.15 + (i % 2) * 0.3, greens[i % 3], Math.cos(a) * 0.9, 3.0 + (i % 3) * 0.35, Math.sin(a) * 0.9, 10, [1, 0.9, 1]);
    }
    ball(g, 1.45, greens[1], 0, 3.7, 0, 12, [1, 0.85, 1]);
  }
  g.scale.setScalar(scale);
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}

export function buildFlowers() {
  const g = new THREE.Group();
  plane(g, 3.2, 3.2, "#5b8f5a", 0, 0.02, 0, { matOpts: { rough: 0.95 } });
  const palette = ["#ff6b9d", "#ffd166", "#f78fb3", "#c77dff", "#ff9f1c"];
  for (let i = 0; i < 22; i++) {
    const x = (Math.random() - 0.5) * 2.8, z = (Math.random() - 0.5) * 2.8;
    cyl(g, 0.015, 0.015, 0.28, "#3f7d4e", x, 0.14, z, 4);
    ball(g, 0.075, palette[i % palette.length], x, 0.3, z, 6);
  }
  return g;
}

export function buildFlowerbed() {
  const g = new THREE.Group();
  box(g, 7.2, 0.24, 3.2, "#b98d63", 0, 0.12, 0, { r: 0.05 });
  plane(g, 6.8, 2.8, "#5b8f5a", 0, 0.26, 0);
  const palette = ["#ff6b9d", "#ffd166", "#c77dff", "#ff9f1c", "#f78fb3"];
  for (let i = 0; i < 30; i++) {
    const x = (Math.random() - 0.5) * 6.2, z = (Math.random() - 0.5) * 2.3;
    ball(g, 0.085, palette[i % palette.length], x, 0.34, z, 6);
  }
  return g;
}

export function buildHedge() {
  const g = new THREE.Group();
  box(g, 7.2, 1.5, 1.5, "#4f9560", 0, 0.75, 0, { r: 0.34 });
  for (let i = 0; i < 10; i++) ball(g, 0.55, i % 2 ? "#5aa86c" : "#468a57", -3.2 + i * 0.72, 1.45, (i % 2 ? 0.2 : -0.2), 8, [1, 0.7, 1]);
  return g;
}

export function buildTopiary() {
  const g = new THREE.Group();
  cyl(g, 0.4, 0.5, 0.8, "#b98d63", 0, 0.4, 0, 12);
  ball(g, 0.85, "#3f7d4e", 0, 1.5, 0, 12);
  ball(g, 0.65, "#4f9560", 0, 2.5, 0, 12);
  ball(g, 0.45, "#5aa86c", 0, 3.25, 0, 10);
  return g;
}

export function buildBench() {
  const g = new THREE.Group();
  const wood = "#b5794a";
  box(g, 3.3, 0.14, 0.6, wood, 0, 0.62, 0, { r: 0.04 });
  box(g, 3.3, 0.55, 0.12, wood, 0, 0.95, -0.24, { r: 0.04 });
  for (const x of [-1.35, 1.35]) {
    box(g, 0.12, 0.6, 0.5, "#5c5c5c", x, 0.3, 0.06, { r: 0.03 });
    box(g, 0.12, 0.35, 0.12, "#5c5c5c", x, 0.62, -0.24, { r: 0.03 });
  }
  return g;
}

export function buildBin() {
  const g = new THREE.Group();
  cyl(g, 0.34, 0.29, 0.9, "#4a7c59", 0, 0.45, 0, 12);
  torus(g, 0.34, 0.045, "#35594a", 0, 0.9, 0, { rx: Math.PI / 2 });
  ball(g, 0.1, "#e9f5ec", 0, 0.94, 0, 8);
  return g;
}

export function buildLamp() {
  const g = new THREE.Group();
  cyl(g, 0.09, 0.14, 3.6, "#3d4a54", 0, 1.8, 0, 8);
  cyl(g, 0.28, 0.34, 0.18, "#3d4a54", 0, 3.62, 0, 10);
  ball(g, 0.26, "#fff3c4", 0, 3.85, 0, 12);
  const light = new THREE.PointLight(0xffe0a8, 0, 14, 2);
  light.position.set(0, 3.8, 0);
  g.add(light);
  g.userData.lamp = light;
  return g;
}

export function buildFlag() {
  const g = new THREE.Group();
  cyl(g, 0.07, 0.09, 4.6, "#d9d9d9", 0, 2.3, 0, 8);
  const flag = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1), mat("#ff6b9d", { side: THREE.DoubleSide }));
  flag.position.set(0.85, 4.0, 0);
  g.add(flag);
  return g;
}

export function buildArch() {
  const g = new THREE.Group();
  const pink = "#e07a9b", green = "#5aa86c";
  for (const x of [-3.2, 3.2]) {
    cyl(g, 0.22, 0.26, 3.4, "#f4e3cf", x, 1.7, 0, 10);
    for (let i = 0; i < 5; i++) ball(g, 0.34, i % 2 ? pink : green, x + (Math.random() - 0.5) * 0.4, 1.1 + i * 0.55, (Math.random() - 0.5) * 0.4, 8);
  }
  for (let i = 0; i <= 16; i++) {
    const t = i / 16;
    const x = -3.2 + t * 6.4;
    const y = 3.4 + Math.sin(t * Math.PI) * 1.3;
    ball(g, 0.32, i % 2 ? pink : "#f5c4d6", x, y, 0, 8);
  }
  return g;
}

export function buildBalloonArch() {
  const g = new THREE.Group();
  const palette = ["#ff6b9d", "#ffd166", "#4cc9f0", "#c77dff", "#90be6d"];
  for (const x of [-3, 3]) cyl(g, 0.1, 0.12, 3.4, "#d9d9d9", x, 1.7, 0, 8);
  for (let i = 0; i <= 12; i++) {
    const t = i / 12;
    const x = -3 + t * 6, y = 3.4 + Math.sin(t * Math.PI) * 1.1;
    ball(g, 0.42, palette[i % palette.length], x, y, 0, 10, [1, 1.2, 1]);
    cyl(g, 0.01, 0.01, 0.3, "#888", x, y - 0.55, 0, 4);
  }
  return g;
}

export function buildFence() {
  const g = new THREE.Group();
  box(g, 3.8, 0.12, 0.12, "#f4e3cf", 0, 1.0, 0, { r: 0.02 });
  box(g, 3.8, 0.12, 0.12, "#f4e3cf", 0, 0.55, 0, { r: 0.02 });
  for (let i = 0; i < 5; i++) box(g, 0.12, 1.25, 0.12, "#efe0c8", -1.8 + i * 0.9, 0.62, 0, { r: 0.02 });
  return g;
}

export function buildFountain(scale = 1) {
  const g = new THREE.Group();
  cyl(g, 4.2, 4.4, 0.55, "#e6dccb", 0, 0.28, 0, 32, { matOpts: { rough: 0.7 } });
  cyl(g, 4.0, 4.0, 0.12, "#7ec8e3", 0, 0.55, 0, 32, { matOpts: { rough: 0.15, metal: 0.1 } });
  cyl(g, 0.6, 0.9, 1.4, "#f0e6d6", 0, 1.2, 0, 16);
  cyl(g, 2.0, 1.1, 0.32, "#f0e6d6", 0, 2.0, 0, 24);
  cyl(g, 1.75, 1.75, 0.08, "#8ed4ea", 0, 2.18, 0, 24);
  ball(g, 0.28, "#f7f3ea", 0, 2.4, 0, 12);
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    const jet = cyl(g, 0.03, 0.06, 0.9 + (i % 3) * 0.25, "#c9eefb", Math.cos(a) * 1.2, 2.5, Math.sin(a) * 1.2, 6, { matOpts: { transparent: true, opacity: 0.7 } });
    jet.rotation.z = Math.cos(a) * 0.25;
    jet.rotation.x = Math.sin(a) * 0.25;
  }
  g.scale.setScalar(scale);
  return g;
}

export function buildStatue() {
  const g = new THREE.Group();
  cyl(g, 1.3, 1.5, 0.5, "#d9cbb3", 0, 0.25, 0, 18);
  box(g, 1.2, 0.5, 1.2, "#c9b394", 0, 0.72, 0, { r: 0.06 });
  cyl(g, 0.34, 0.42, 1.1, "#c9a24a", 0, 1.5, 0, 12, { matOpts: { metal: 0.7, rough: 0.35 } });
  ball(g, 0.36, "#d9b25a", 0, 2.2, 0, 14);
  for (const s of [-1, 1]) {
    ball(g, 0.16, "#d9b25a", s * 0.32, 2.42, 0, 10);
    cyl(g, 0.09, 0.09, 0.75, "#d9b25a", s * 0.3, 1.6, 0.05, 8, { rz: s * 0.25 });
  }
  ball(g, 0.4, "#d9b25a", 0, 1.05, 0, 12, [1, 0.7, 1]);
  return g;
}

export function buildPond() {
  const g = new THREE.Group();
  const water = new THREE.Mesh(new THREE.CircleGeometry(7, 32), mat("#5fb8d6", { rough: 0.12, metal: 0.1, transparent: true, opacity: 0.92 }));
  water.rotation.x = -Math.PI / 2; water.position.y = 0.08;
  g.add(water);
  for (let i = 0; i < 22; i++) {
    const a = (i / 22) * Math.PI * 2;
    ball(g, 0.5 + Math.random() * 0.5, i % 2 ? "#7fae7a" : "#6d9e69", Math.cos(a) * 7.2, 0.18, Math.sin(a) * 6.4, 7, [1, 0.55, 1]);
  }
  for (let i = 0; i < 5; i++) {
    const pad = new THREE.Mesh(new THREE.CircleGeometry(0.65, 12), mat("#5aa86c"));
    pad.rotation.x = -Math.PI / 2;
    pad.position.set((Math.random() - 0.5) * 9, 0.1, (Math.random() - 0.5) * 8);
    g.add(pad);
    ball(g, 0.13, "#ffd1dc", pad.position.x, 0.2, pad.position.z, 6);
  }
  const duck = group(g, 1.6, 0.15, 1.2);
  ball(duck, 0.28, "#f7f3ea", 0, 0.2, 0, 8, [1.3, 0.8, 0.9]);
  ball(duck, 0.16, "#f7f3ea", 0.32, 0.36, 0, 8);
  cone(duck, 0.07, 0.18, "#f4a261", 0.47, 0.34, 0, 6, { rz: -Math.PI / 2 });
  return g;
}

export function buildBridge() {
  const g = new THREE.Group();
  const wood = "#c99b6a";
  for (let i = 0; i < 12; i++) {
    const t = i / 11;
    box(g, 0.62, 0.12, 3.2, wood, -2.6 + t * 5.2, 0.35 + Math.sin(t * Math.PI) * 0.7, 0, { r: 0.02 });
  }
  for (const z of [-1.5, 1.5]) {
    for (let i = 0; i <= 6; i++) {
      const t = i / 6;
      cyl(g, 0.05, 0.05, 1.1, "#e3cba8", -2.6 + t * 5.2, 0.95 + Math.sin(t * Math.PI) * 0.7, z, 6);
    }
    for (let i = 0; i < 6; i++) {
      const t0 = i / 6, t1 = (i + 1) / 6;
      const x0 = -2.6 + t0 * 5.2, x1 = -2.6 + t1 * 5.2;
      const y0 = 1.5 + Math.sin(t0 * Math.PI) * 0.7, y1 = 1.5 + Math.sin(t1 * Math.PI) * 0.7;
      const rail = box(g, Math.hypot(x1 - x0, y1 - y0), 0.08, 0.08, "#e3cba8", (x0 + x1) / 2, (y0 + y1) / 2, z, { r: 0.02 });
      rail.rotation.z = Math.atan2(y1 - y0, x1 - x0);
    }
  }
  return g;
}

/* ---------------------------------------------------------------------
   Shops, facilities and the entrance
   --------------------------------------------------------------------- */
function stallShell(g, def, w, d) {
  const [c1, c2, c3] = def.palette;
  const W = w * 0.9, D = d * 0.8;
  // paved base
  box(g, W, 0.22, D, "#e9dcc6", 0, 0.11, 0, { r: 0.05 });
  // little kiosk: back wall, side walls, counter
  box(g, W, 2.3, 0.22, "#fbf1df", 0, 1.2, -D / 2 + 0.11, { r: 0.04 });
  for (const s of [-1, 1]) box(g, 0.22, 1.05, D * 0.62, "#fbf1df", s * (W / 2 - 0.11), 0.63, D * 0.15, { r: 0.04 });
  box(g, W * 0.94, 0.95, D * 0.46, c2, 0, 0.48, D * 0.18, { r: 0.05 });
  box(g, W, 0.14, D * 0.52, c3, 0, 1.0, D * 0.18, { r: 0.03 });
  // awning: alternating stripes sloping over the counter
  const awning = group(g, 0, 2.52, D * 0.14);
  for (let i = 0; i < 6; i++) box(awning, W * 0.17, 0.09, D * 0.68, i % 2 ? c2 : c1, -W * 0.42 + i * W * 0.17, 0, 0, { r: 0.03 });
  awning.rotation.x = 0.16;
  for (const s of [-1, 1]) cyl(g, 0.05, 0.05, 2.5, "#d9c9b1", s * W * 0.45, 1.25, D * 0.4, 6);
  // sign and menu
  signBoard(g, def.name, W * 0.72, 0.62, "#3f342c", c2, 0, 1.82, -D / 2 + 0.24);
  box(g, W * 0.3, 0.36, 0.05, "#fff8e8", W * 0.3, 1.28, D * 0.36, { r: 0.02 });
  for (let i = 0; i < 3; i++) box(g, 0.22, 0.22, 0.22, [c1, c3, c2][i], -W * 0.3 + i * 0.42, 1.18, D * 0.22, { r: 0.03 });
  return awning;
}

export function buildBuilding(def) {
  const g = new THREE.Group();
  const [w, d] = [def.size[0] * 4 - 0.6, def.size[1] * 4 - 0.6];
  const [c1, c2, c3] = def.palette;
  if (def.model === "cart") {
    box(g, w * 0.8, 0.8, d * 0.7, c2, 0, 0.7, 0, { r: 0.08 });
    for (const x of [-w * 0.3, w * 0.3]) {
      const wheel = cyl(g, 0.55, 0.55, 0.14, "#5c3d2e", x, 0.55, d * 0.36, 16, { rx: Math.PI / 2 });
      wheel.rotation.z = 0.4;
    }
    cyl(g, 0.07, 0.07, 3.4, "#8a6b4a", 0, 1.7, 0, 8);
    const umb = group(g, 0, 3.3, 0);
    stripedCanopy(umb, w * 0.72, 1.1, 0, c1, c2, 12);
    signBoard(g, def.name, w * 0.7, 0.55, "#4a3b32", c2, 0, 2.3, d * 0.3);
    return g;
  }
  if (def.model === "shop" || def.model === "restaurant" || def.model === "staffroom") {
    box(g, w, 2.6, d, "#f8f0e2", 0, 1.3, 0, { r: 0.08 });
    box(g, w + 0.3, 0.4, d + 0.3, c1, 0, 2.75, 0, { r: 0.06 });
    for (let i = -1; i <= 1; i++) {
      const win = box(g, w * 0.22, 1.1, 0.1, "#bfe4ef", i * w * 0.28, 1.45, d / 2 + 0.02, { r: 0.03, matOpts: { rough: 0.1, metal: 0.1 } });
      win.material = glass("#cdeaf3");
    }
    box(g, w * 0.24, 1.5, 0.14, c3, 0, 0.78, d / 2 + 0.03, { r: 0.03 });
    const roof = box(g, w * 1.02, 0.5, d * 1.02, c3, 0, 3.1, 0, { r: 0.08 });
    roof.rotation.x = 0.02;
    signBoard(g, def.name, w * 0.72, 0.62, "#40342c", c2, 0, 2.2, d / 2 + 0.09);
    if (def.model === "restaurant") {
      for (let i = -1; i <= 1; i += 2) {
        cyl(g, 0.55, 0.5, 0.1, "#f2e6d4", i * w * 0.32, 0.9, d / 2 + 1.5, 12);
        cyl(g, 0.06, 0.06, 0.9, "#b9a58a", i * w * 0.32, 0.45, d / 2 + 1.5, 8);
        for (let k = -1; k <= 1; k += 2) cyl(g, 0.24, 0.2, 0.5, "#d9a066", i * w * 0.32 + k * 0.9, 0.25, d / 2 + 1.5, 10);
      }
    }
    return g;
  }
  if (def.model === "toilet") {
    box(g, w * 0.9, 2.4, d * 0.8, "#eef3f5", 0, 1.2, 0, { r: 0.08 });
    box(g, w * 0.95, 0.35, d * 0.85, "#9fb6c2", 0, 2.55, 0, { r: 0.06 });
    signBoard(g, "Toilets", 2.4, 0.7, "#123", "#eaf6ff", 0, 2.0, d * 0.4 + 0.06);
    for (const x of [-w * 0.2, w * 0.2]) box(g, 0.8, 1.7, 0.12, "#c3d4dc", x, 0.9, d * 0.4 + 0.03, { r: 0.03 });
    return g;
  }
  if (def.model === "aid") {
    box(g, w * 0.9, 2.2, d * 0.85, "#ffffff", 0, 1.1, 0, { r: 0.08 });
    box(g, w * 0.95, 0.3, d * 0.9, "#e63946", 0, 2.35, 0, { r: 0.05 });
    box(g, 0.5, 1.0, 0.05, "#e63946", 0, 1.4, d * 0.43, { r: 0.02 });
    box(g, 1.0, 0.5, 0.05, "#e63946", 0, 1.4, d * 0.43, { r: 0.02 });
    signBoard(g, "First Aid", 2.2, 0.6, "#a4161a", "#fff", 0, 2.0, d * 0.43 + 0.02);
    return g;
  }
  if (def.model === "info") {
    box(g, w * 0.85, 2.0, d * 0.85, c2, 0, 1.0, 0, { r: 0.08 });
    box(g, w * 0.9, 0.3, d * 0.9, c1, 0, 2.15, 0, { r: 0.05 });
    signBoard(g, "Info", 2.0, 0.6, "#fff", c1, 0, 1.6, d * 0.43 + 0.03);
    return g;
  }
  stallShell(g, def, w, d);
  return g;
}

export function buildEntrance() {
  const g = new THREE.Group();
  const cream = "#f7ecdb", pink = "#e07a9b", teal = "#3a9d94";
  box(g, 13, 0.3, 5, "#d8c7ae", 0, 0.15, 0, { r: 0.05 });
  for (const x of [-5.4, -1.9, 1.9, 5.4]) {
    box(g, 0.6, 5.2, 0.6, cream, x, 2.6, 0, { r: 0.06 });
  }
  box(g, 12, 0.7, 0.9, cream, 0, 5.2, 0, { r: 0.1 });
  box(g, 10, 0.4, 0.7, pink, 0, 4.65, 0, { r: 0.08 });
  for (const x of [-5.4, 5.4]) {
    const roof = cone(g, 1.1, 1.4, pink, x, 6.2, 0, 4);
    roof.rotation.y = Math.PI / 4;
  }
  signBoard(g, "DREAM PARK", 8.4, 1.5, "#fff9ef", "#c94f70", 0, 6.0, 0.1);
  // ticket booths
  for (const x of [-4.2, 4.2]) {
    box(g, 2.0, 1.6, 1.6, "#fbf3e6", x, 0.8, -1.8, { r: 0.08 });
    box(g, 2.2, 0.25, 1.8, teal, x, 1.7, -1.8, { r: 0.05 });
    box(g, 1.2, 0.55, 0.06, "#bfe4ef", x, 0.95, -0.98, { r: 0.02, matOpts: { rough: 0.15 } });
  }
  // turnstiles
  for (const x of [-0.8, 0.8]) {
    cyl(g, 0.12, 0.12, 1.1, "#c9ced6", x, 0.55, 0, 8, { matOpts: { metal: 0.8 } });
    for (let i = 0; i < 3; i++) {
      const arm = box(g, 0.5, 0.05, 0.05, "#c9ced6", x + 0.25 * Math.cos(i), 1.0, 0.25 * Math.sin(i), { r: 0.01 });
      arm.rotation.y = i * 2.1;
    }
  }
  // flower urns
  for (const x of [-6.6, 6.6]) {
    cyl(g, 0.7, 0.5, 0.9, "#d9c3a5", x, 0.45, 1.6, 12);
    for (let i = 0; i < 5; i++) ball(g, 0.26, ["#ff6b9d", "#ffd166", "#c77dff"][i % 3], x + (Math.random() - 0.5) * 0.6, 1.0 + Math.random() * 0.3, 1.6 + (Math.random() - 0.5) * 0.6, 8);
  }
  return g;
}

/* ---------------------------------------------------------------------
   Rides
   Each builder returns { group, update(dt, api), seats }
   api = { running, time, phase (0..1 of a cycle) }
   --------------------------------------------------------------------- */
function gondola(color, roofColor) {
  const g = new THREE.Group();
  ball(g, 0.52, color, 0, -0.75, 0, 10, [1, 0.75, 0.9]);
  box(g, 1.05, 0.12, 1.0, "#f4eadb", 0, -0.5, 0, { r: 0.06 });
  cyl(g, 0.05, 0.05, 1.4, "#b9c0c8", 0, 0.1, 0, 6);
  const roof = cone(g, 0.62, 0.45, roofColor, 0, -0.16, 0, 8);
  roof.position.y = -0.18;
  return g;
}

function seat(color, chain = 1.4) {
  const g = new THREE.Group();
  for (const s of [-0.22, 0.22]) cyl(g, 0.015, 0.015, chain, "#c9ced6", s, -chain / 2, 0, 4);
  box(g, 0.62, 0.1, 0.5, color, 0, -chain, 0, { r: 0.04 });
  box(g, 0.62, 0.5, 0.1, color, 0, -chain + 0.28, -0.22, { r: 0.04 });
  return g;
}

function car(color, accent = "#fdf6ea") {
  const g = new THREE.Group();
  box(g, 1.3, 0.35, 0.8, color, 0, 0.28, 0, { r: 0.14 });
  box(g, 0.8, 0.3, 0.6, accent, 0, 0.55, 0, { r: 0.1 });
  for (const x of [-0.42, 0.42]) for (const z of [-0.34, 0.34]) {
    const wheel = cyl(g, 0.13, 0.13, 0.1, "#2b2b2b", x, 0.14, z, 8, { rx: Math.PI / 2 });
    wheel.rotation.z = 0.1;
  }
  return g;
}

function riderDots(parent, count, radius, y, color, seatHeight = 0.5) {
  const people = [];
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2;
    const p = buildPerson({ shirt: color, scale: 0.62 });
    p.group.position.set(Math.cos(a) * radius, y + seatHeight, Math.sin(a) * radius);
    p.group.rotation.y = -a + Math.PI / 2;
    parent.add(p.group);
    people.push(p.group);
  }
  return people;
}

export function buildRide(def) {
  const g = new THREE.Group();
  const [c1, c2, c3] = def.palette;
  const R = Math.min(def.size[0], def.size[1]) * 1.7;
  let update = () => {};
  let seats = def.capacity;

  switch (def.model) {
    case "carousel": {
      const spin = group(g, 0, 0.1, 0);
      cyl(spin, R * 0.98, R, 0.35, c2, 0, 0.18, 0, 30);
      cyl(spin, R * 0.9, R * 0.9, 0.08, c1, 0, 0.37, 0, 30, { matOpts: { rough: 0.5 } });
      torus(spin, R * 0.93, 0.1, c3, 0, 0.4, 0, { rx: Math.PI / 2 });
      cyl(spin, 0.65, 0.8, 3.4, c3, 0, 2.0, 0, 16);
      ball(spin, 0.75, c3, 0, 3.75, 0, 14);
      const canopy = group(spin, 0, 3.1, 0);
      stripedCanopy(canopy, R * 1.02, 1.5, 0, c1, c2, 18);
      torus(canopy, R * 1.04, 0.09, c3, 0, -0.02, 0, { rx: Math.PI / 2 });
      for (let i = 0; i < 10; i++) ball(canopy, 0.11, "#fff6c8", Math.cos((i / 10) * Math.PI * 2) * R * 1.02, -0.08, Math.sin((i / 10) * Math.PI * 2) * R * 1.02, 6);
      const horses = [];
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        const h = group(spin, Math.cos(a) * R * 0.62, 0.4, Math.sin(a) * R * 0.62);
        h.rotation.y = -a;
        ball(h, 0.34, c2, 0, 0.5, 0, 10, [1.5, 0.85, 0.8]);
        ball(h, 0.2, c2, 0.45, 0.78, 0, 8, [1.3, 1, 0.9]);
        cone(h, 0.08, 0.3, c3, 0.56, 1.0, 0, 6);
        for (const s of [-0.22, 0.22]) cyl(h, 0.05, 0.04, 0.55, "#d9b25a", s, 0.22, 0, 6);
        cyl(h, 0.03, 0.03, 2.6, c3, 0, 1.5, 0, 6);
        horses.push(h);
      }
      update = (dt, api) => {
        if (api.running) spin.rotation.y += dt * 0.42;
        horses.forEach((h, i) => { h.position.y = 0.4 + Math.sin(api.time * 3 + i) * 0.12 * (api.running ? 1 : 0.2); });
      };
      riderDots(spin, 6, R * 0.4, 0.55, "#ffffff", 0.5);
      break;
    }
    case "wheel": {
      const H = 13.5, RR = R * 0.95;
      for (const s of [-1, 1]) {
        const legA = cyl(g, 0.28, 0.36, H, "#dfe4ea", s * 1.0, H / 2, -0.7, 10, { matOpts: { metal: 0.6 } });
        legA.rotation.x = 0.22;
        legA.rotation.z = s * 0.1;
        const legB = cyl(g, 0.28, 0.36, H, "#dfe4ea", s * 1.0, H / 2, 0.7, 10, { matOpts: { metal: 0.6 } });
        legB.rotation.x = -0.22;
        legB.rotation.z = s * 0.1;
      }
      box(g, 3.4, 0.5, 2.6, c3, 0, 0.25, 0, { r: 0.08 });
      const wheel = group(g, 0, H * 0.62, 0);
      torus(wheel, RR, 0.14, c1, 0, 0, 0, { seg: 40 });
      torus(wheel, RR * 0.74, 0.1, c3, 0, 0, 0, { seg: 36 });
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * Math.PI * 2;
        const spoke = box(wheel, RR * 2 - 0.3, 0.09, 0.09, "#e6ebef", 0, 0, 0, { r: 0.02, matOpts: { metal: 0.5 } });
        spoke.rotation.z = a;
      }
      const pods = [];
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        const pod = gondola(i % 2 ? c2 : c3, c1);
        pod.position.set(Math.cos(a) * RR, Math.sin(a) * RR, 0);
        wheel.add(pod);
        pods.push(pod);
      }
      update = (dt, api) => {
        if (api.running) wheel.rotation.z += dt * 0.16;
        pods.forEach((p) => { p.rotation.z = -wheel.rotation.z; });
      };
      break;
    }
    case "teacups": {
      const base = group(g, 0, 0.2, 0);
      cyl(base, R * 0.98, R, 0.3, c2, 0, 0.15, 0, 28);
      torus(base, R * 0.99, 0.09, c1, 0, 0.3, 0, { rx: Math.PI / 2 });
      cyl(base, 0.55, 0.7, 2.2, c1, 0, 1.2, 0, 14);
      ball(base, 0.5, c3, 0, 2.35, 0, 12);
      cone(base, 0.2, 0.6, c3, 0, 2.9, 0, 8);
      const cups = [];
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        const cup = group(base, Math.cos(a) * R * 0.58, 0.3, Math.sin(a) * R * 0.58);
        cyl(cup, 1.0, 1.0, 0.09, c2, 0, 0.05, 0, 16);
        cyl(cup, 0.85, 0.58, 1.25, i % 2 ? c1 : "#fff6ec", 0, 0.67, 0, 16, { tl: Math.PI * 2 });
        torus(cup, 0.87, 0.07, c3, 0, 1.28, 0, { rx: Math.PI / 2 });
        const handle = torus(cup, 0.28, 0.05, c3, 0.86, 0.75, 0, { ry: Math.PI / 2, arc: Math.PI * 1.3 });
        handle.rotation.z = 0.2;
        cups.push(cup);
      }
      update = (dt, api) => {
        if (api.running) { base.rotation.y += dt * 0.35; cups.forEach((c, i) => { c.rotation.y += dt * (1.4 - i * 0.15); }); }
      };
      riderDots(base, 6, R * 0.58, 0.72, "#ffd166", 0.3);
      break;
    }
    case "swing": {
      const col = cyl(g, 0.5, 0.7, 7.5, "#e6ebef", 0, 3.75, 0, 14, { matOpts: { metal: 0.5 } });
      cyl(g, 1.2, 1.6, 0.5, c3, 0, 0.25, 0, 16);
      const rotor = group(g, 0, 7.2, 0);
      cyl(rotor, 2.4, 2.6, 0.3, c1, 0, 0, 0, 20);
      stripedCanopy(rotor, 3.0, 1.1, 0.6, c1, c2, 16);
      const chairs = [];
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2;
        const arm = group(rotor, Math.cos(a) * 2.5, -0.1, Math.sin(a) * 2.5);
        const ch = seat(i % 2 ? c3 : c2, 3.0);
        ch.position.y = 0;
        arm.add(ch);
        arm.rotation.y = -a;
        chairs.push(ch);
      }
      update = (dt, api) => {
        const want = api.running ? 0.55 : 0;
        rotor.rotation.y += dt * want;
        const tilt = api.running ? 0.22 : 0.02;
        chairs.forEach((ch, i) => { ch.rotation.z = Math.sin(api.time * 1.4 + i) * tilt; });
      };
      break;
    }
    case "bumper": {
      cyl(g, R, R * 1.02, 0.2, "#5d6b7a", 0, 0.1, 0, 30);
      torus(g, R * 0.99, 0.14, c2, 0, 0.24, 0, { rx: Math.PI / 2 });
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        cyl(g, 0.1, 0.1, 3.4, "#c9ced6", Math.cos(a) * R * 0.92, 1.8, Math.sin(a) * R * 0.92, 6, { matOpts: { metal: 0.7 } });
      }
      cyl(g, R * 1.02, R * 1.02, 0.3, c1, 0, 3.6, 0, 30);
      for (let i = 0; i < 14; i++) ball(g, 0.1, "#fff2b0", Math.cos((i / 14) * 6.28) * R * 0.95, 3.42, Math.sin((i / 14) * 6.28) * R * 0.95, 6);
      const cars = [];
      for (let i = 0; i < 8; i++) {
        const ca = car(i % 2 ? c2 : c3, c1);
        ca.position.set((Math.random() - 0.5) * R, 0.2, (Math.random() - 0.5) * R);
        g.add(ca);
        cars.push({ mesh: ca, a: Math.random() * 6.28, r: 0.4 + Math.random() * 0.5, sp: 0.5 + Math.random() * 0.5 });
      }
      update = (dt, api) => {
        if (!api.running) return;
        cars.forEach((c) => {
          c.a += dt * c.sp * 0.9;
          c.mesh.position.x = Math.cos(c.a) * R * c.r;
          c.mesh.position.z = Math.sin(c.a * 1.3) * R * c.r;
          c.mesh.rotation.y = -c.a + Math.PI / 2;
        });
      };
      break;
    }
    case "tower": {
      const H = 22;
      cyl(g, 1.5, 2.0, 0.6, c3, 0, 0.3, 0, 20);
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2;
        cyl(g, 0.16, 0.2, H, "#dfe4ea", Math.cos(a) * 1.1, H / 2, Math.sin(a) * 1.1, 8, { matOpts: { metal: 0.6 } });
      }
      for (let y = 3; y < H; y += 3) {
        const ring = torus(g, 1.15, 0.06, "#c9ced6", 0, y, 0, { rx: Math.PI / 2 });
        ring.material = metal();
      }
      cyl(g, 0.6, 0.6, 0.6, c1, 0, H + 0.3, 0, 12);
      ball(g, 0.35, glow("#ff5d5d", 1.4), 0, H + 0.7, 0, 10);
      const lift = group(g, 1.6, 1.2, 0);
      const carriage = cyl(lift, 1.5, 1.5, 0.3, c1, 0, 0, 0, 18);
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        box(lift, 0.45, 0.5, 0.4, c2, Math.cos(a) * 1.5, -0.2, Math.sin(a) * 1.5, { r: 0.06 });
        cyl(lift, 0.04, 0.04, 1.1, c3, Math.cos(a) * 1.5, 0.5, Math.sin(a) * 1.5, 4);
      }
      update = (dt, api) => {
        const t = api.time % 16;
        const up = t < 6 ? t / 6 : t < 9 ? 1 : t < 11 ? 1 - (t - 9) / 2 : 0;
        lift.position.y = 1.2 + up * (H - 3);
      };
      break;
    }
    case "flume": {
      const pts = [];
      const w = R * 0.95, d = R * 0.8;
      for (let i = 0; i <= 24; i++) {
        const t = i / 24;
        const a = t * Math.PI * 2;
        pts.push(new THREE.Vector3(Math.cos(a) * w, 1.6 + Math.sin(t * Math.PI * 2) * 0.8 + Math.max(0, Math.sin(a * 2)) * 0.6, Math.sin(a) * d));
      }
      const curve = new THREE.CatmullRomCurve3(pts, true);
      const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 120, 1.5, 10, true), mat("#b9d9e6", { rough: 0.35, side: THREE.DoubleSide }));
      tube.receiveShadow = true;
      g.add(tube);
      const water = new THREE.Mesh(new THREE.TubeGeometry(curve, 120, 1.2, 10, true), mat("#5cb8d6", { rough: 0.15, transparent: true, opacity: 0.9, side: THREE.DoubleSide }));
      g.add(water);
      box(g, 4, 1.2, 3, c3, 0, 0.6, -d * 0.4, { r: 0.1 });
      const logs = [];
      for (let i = 0; i < 3; i++) {
        const log = group(g);
        cyl(log, 0.8, 0.8, 3.2, c3, 0, 0.4, 0, 10, { rz: Math.PI / 2 });
        const nose = cone(log, 0.8, 1.2, c3, 0, 0.4, 1.9, 10, { rx: Math.PI / 2 });
        nose.rotation.x = -Math.PI / 2;
        riderDots(log, 2, 0.4, 0.55, "#ffd166", 0.5);
        g.add(log);
        logs.push({ mesh: log, offset: i / 3 });
      }
      update = (dt, api) => {
        if (!api.running) return;
        logs.forEach((l) => {
          const t = (api.time * 0.06 + l.offset) % 1;
          const p = curve.getPointAt(t);
          const tangent = curve.getTangentAt(t);
          l.mesh.position.copy(p);
          l.mesh.rotation.y = Math.atan2(tangent.x, tangent.z);
          l.mesh.position.y -= 0.5;
        });
      };
      break;
    }
    case "ship": {
      cyl(g, R * 0.95, R, 0.5, "#d9cfc0", 0, 0.25, 0, 26);
      for (const s of [-1, 1]) {
        const leg = cyl(g, 0.3, 0.42, 9.5, "#dfe4ea", s * R * 0.55, 4.6, 0, 10, { matOpts: { metal: 0.5 } });
        leg.rotation.z = s * 0.24;
      }
      const arm = group(g, 0, 8.4, 0);
      cyl(arm, 0.25, 0.25, R * 1.6, "#c9ced6", 0, 0, 0, 10, { rz: Math.PI / 2, matOpts: { metal: 0.6 } });
      const ship = group(arm, 0, -0.6, 0);
      const hull = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.0, 5.6, 14, 1, false), mat(c1, { rough: 0.6, side: THREE.DoubleSide }));
      hull.rotation.z = Math.PI / 2;
      hull.scale.set(1, 1, 0.55);
      hull.position.y = -0.6;
      ship.add(hull);
      box(ship, 5.4, 0.2, 1.2, c2, 0, 0.2, 0, { r: 0.04 });
      for (let i = -2; i <= 2; i++) box(ship, 0.8, 0.5, 1.0, c1, i * 1.05, 0.35, 0, { r: 0.08 });
      cyl(ship, 0.08, 0.08, 3.2, c3, 0, 1.9, 0, 6);
      const sail = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 2.0), mat(c2, { side: THREE.DoubleSide }));
      sail.position.set(0, 1.9, 0.05);
      ship.add(sail);
      update = (dt, api) => {
        const swing = api.running ? Math.sin(api.time * 0.8) * 0.85 : Math.sin(api.time * 0.4) * 0.05;
        arm.rotation.z = swing;
      };
      break;
    }
    case "kiddie": {
      const base = group(g, 0, 0.12, 0);
      cyl(base, R * 0.95, R, 0.3, c2, 0, 0.15, 0, 26);
      ringRing(base, R);
      cyl(base, 0.4, 0.55, 2.4, c3, 0, 1.3, 0, 12);
      cone(base, R * 0.7, 1.1, c1, 0, 2.9, 0, 14);
      const animals = [];
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        const animal = group(base, Math.cos(a) * R * 0.62, 0.35, Math.sin(a) * R * 0.62);
        animal.rotation.y = -a;
        ball(animal, 0.4, i % 2 ? c1 : "#f7d6c8", 0, 0.45, 0, 10, [1.4, 0.9, 0.9]);
        ball(animal, 0.24, i % 2 ? c1 : "#f7d6c8", 0.45, 0.7, 0, 8);
        for (const s of [-0.18, 0.18]) ball(animal, 0.16, i % 2 ? c1 : "#f7d6c8", 0.4, 0.8, s, 7, [0.5, 1, 0.3]);
        cyl(animal, 0.05, 0.05, 0.5, c3, 0, 0.9, 0, 5);
        animals.push(animal);
      }
      update = (dt, api) => {
        if (api.running) base.rotation.y += dt * 0.4;
        animals.forEach((a, i) => { a.position.y = 0.35 + Math.sin(api.time * 4 + i) * 0.08; });
      };
      break;
    }
    case "train": {
      const pts = [];
      for (let i = 0; i <= 30; i++) {
        const t = i / 30, a = t * Math.PI * 2;
        pts.push(new THREE.Vector3(Math.cos(a) * R * 0.95, 0.35, Math.sin(a) * R * 0.8));
      }
      const curve = new THREE.CatmullRomCurve3(pts, true);
      const railPts = curve.getPoints(140);
      for (const off of [-0.55, 0.55]) {
        const shifted = railPts.map((p) => new THREE.Vector3(p.x, p.y, p.z + off));
        const rail = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(shifted, true), 140, 0.07, 5, true), metal("#a9845f"));
        g.add(rail);
      }
      for (let i = 0; i < 30; i++) {
        const a = (i / 30) * Math.PI * 2;
        box(g, 1.4, 0.12, 0.3, "#b98455", Math.cos(a) * R * 0.95, 0.28, Math.sin(a) * R * 0.8, { r: 0.03, matOpts: { rough: 0.9 } });
        if (i % 3 === 0) cyl(g, 0.08, 0.1, 0.3, "#8a6b4a", Math.cos(a) * R * 0.95, 0.15, Math.sin(a) * R * 0.8, 6);
      }
      box(g, 3.2, 0.9, 3.2, "#d9c3a5", R * 1.1, 0.45, 0, { r: 0.1 });
      box(g, 3.6, 0.25, 3.6, c3, R * 1.1, 1.0, 0, { r: 0.06 });
      const train = group(g);
      const loco = group(train, 0, 0, 0);
      box(loco, 1.4, 0.9, 2.4, c1, 0, 0.6, 0, { r: 0.12 });
      cyl(loco, 0.3, 0.34, 1.0, "#3d3d3d", 0, 1.1, 0.7, 10);
      ball(loco, 0.25, glow("#ffd166", 1.2), 0, 1.75, 1.2, 8);
      for (let i = 0; i < 2; i++) {
        const c = group(train, 0, 0, (i + 1) * 2.6);
        box(c, 1.3, 0.8, 2.2, c2, 0, 0.55, 0, { r: 0.12 });
        box(c, 1.2, 0.5, 2.0, c3, 0, 1.1, 0, { r: 0.08 });
      }
      train.position.y = 0.4;
      update = (dt, api) => {
        if (!api.running) return;
        train.position.copy(curve.getPointAt((api.time * 0.035) % 1));
        const tan = curve.getTangentAt((api.time * 0.035) % 1);
        train.rotation.y = Math.atan2(tan.x, tan.z);
      };
      break;
    }
    case "house": {
      const haunted = def.id === "haunted-house";
      const fun = def.id === "fun-house";
      box(g, R * 1.7, 4.2, R * 1.4, haunted ? "#7c6a85" : c2, 0, 2.1, 0, { r: 0.1 });
      const roof = cone(g, R * 1.35, 2.6, haunted ? "#4d3d57" : c3, 0, 5.4, 0, 4);
      roof.rotation.y = Math.PI / 4;
      for (let i = -1; i <= 1; i += 2) {
        cyl(g, R * 0.22, R * 0.24, 6.4, haunted ? "#5b4b64" : c1, i * R * 0.55, 3.2, -R * 0.5, 8);
        cone(g, R * 0.3, 1.6, c3, i * R * 0.55, 7.1, -R * 0.5, 8);
      }
      const winColor = haunted ? "#ffdd88" : "#ffd166";
      for (let i = -1; i <= 1; i++) {
        const w = box(g, 0.9, 1.2, 0.08, winColor, i * 1.5, 2.6, R * 0.72, { r: 0.03, matOpts: { emissive: winColor, emissiveIntensity: haunted ? 0.9 : 0.3 } });
        if (haunted) w.material = glow("#ffcf6e", 0.8);
      }
      box(g, 1.8, 2.4, 0.2, "#3b2b33", 0, 1.2, R * 0.72, { r: 0.04 });
      signBoard(g, def.name, R * 1.1, 0.9, "#fff6e6", haunted ? "#3a2b44" : c1, 0, 4.4, R * 0.74);
      if (fun) {
        const slide = group(g, R * 1.0, 1.4, 0);
        const chute = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([
          new THREE.Vector3(0, 2.6, 0), new THREE.Vector3(1.8, 2.2, 0.4), new THREE.Vector3(2.6, 1.2, 1.2), new THREE.Vector3(2.2, 0.4, 2.4)
        ]), 20, 0.6, 8, false), mat(c1, { side: THREE.DoubleSide, rough: 0.4 }));
        g.add(chute);
      }
      if (haunted) {
        for (let i = 0; i < 4; i++) {
          const a = (i / 4) * Math.PI * 2 + 0.4;
          const tree = buildTree("pine", 0.7);
          tree.position.set(Math.cos(a) * R * 1.1, 0, Math.sin(a) * R * 1.0);
          g.add(tree);
        }
      }
      update = (dt, api) => {
        if (haunted) g.children.forEach((c, i) => { if (c.material && c.material.emissiveIntensity) c.material.emissiveIntensity = 0.6 + Math.sin(api.time * 2 + i) * 0.3; });
      };
      break;
    }
    case "cinema": {
      box(g, R * 1.8, 4.4, R * 1.7, c1, 0, 2.2, 0, { r: 0.12 });
      box(g, R * 1.9, 0.6, R * 1.8, c3, 0, 4.6, 0, { r: 0.1 });
      signBoard(g, "4D CINEMA", R * 1.2, 1.0, "#fff8e7", "#3d405b", 0, 3.4, R * 0.86 + 0.05);
      for (let i = -1; i <= 1; i++) {
        const b = box(g, 0.4, 0.4, 0.1, glow("#ffd166", 1.2), i * 1.1, 2.2, R * 0.87, { r: 0.04 });
      }
      const canopy = box(g, R * 1.4, 0.2, 1.4, c3, 0, 3.0, R * 0.95, { r: 0.05 });
      for (let i = -3; i <= 3; i++) ball(g, 0.1, glow("#fff2b0", 1), i * 0.8, 2.85, R * 1.55, 6);
      break;
    }
    case "arcade": {
      box(g, R * 1.8, 4.0, R * 1.6, c1, 0, 2.0, 0, { r: 0.1 });
      box(g, R * 1.5, 1.2, 0.16, glow("#ff5d8f", 1.1), 0, 3.0, R * 0.82, { r: 0.04 });
      signBoard(g, "ARCADE", R * 1.1, 0.8, "#ffd166", "#241f3a", 0, 3.9, R * 0.83);
      for (let i = 0; i < 6; i++) box(g, 0.4, 0.9, 0.4, ["#ff006e", "#3a86ff", "#ffbe0b"][i % 3], -R * 0.7 + i * 0.55, 0.55, R * 0.78, { r: 0.06 });
      for (let i = 0; i < 12; i++) ball(g, 0.08, i % 2 ? "#ffd166" : "#4cc9f0", -R + i * (R / 6), 4.1, R * 0.8, 5, undefined);
      break;
    }
    case "slide": {
      const H = 11;
      cyl(g, 1.5, 1.9, H, "#e8eef3", 0, H / 2, 0, 16);
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2;
        cyl(g, 0.14, 0.18, H, c3, Math.cos(a) * 1.2, H / 2, Math.sin(a) * 1.2, 6);
      }
      cyl(g, 2.0, 2.0, 0.4, c1, 0, H, 0, 18);
      cone(g, 1.4, 1.4, c2, 0, H + 0.9, 0, 12);
      const spiral = [];
      for (let i = 0; i <= 60; i++) {
        const t = i / 60, a = t * Math.PI * 4.2;
        spiral.push(new THREE.Vector3(Math.cos(a) * (2.6 + t * 2.2), H - 0.3 - t * (H - 0.6), Math.sin(a) * (2.6 + t * 2.2)));
      }
      const chute = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(spiral), 90, 0.85, 8, false), mat(c1, { rough: 0.35, side: THREE.DoubleSide }));
      g.add(chute);
      cyl(g, 3.2, 3.2, 0.3, "#8ed4ea", 4.4, 0.15, 0, 22);
      break;
    }
    case "pool": {
      box(g, R * 1.7, 0.4, R * 1.5, "#d9cfc0", 0, 0.2, 0, { r: 0.1 });
      box(g, R * 1.55, 0.12, R * 1.35, "#5cb8d6", 0, 0.42, 0, { r: 0.05, matOpts: { rough: 0.12 } });
      const boats = [];
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2;
        const boat = group(g, Math.cos(a) * R * 0.45, 0.5, Math.sin(a) * R * 0.4);
        ball(boat, 0.9, i % 2 ? c1 : c3, 0, 0.2, 0, 10, [1.4, 0.5, 1]);
        box(boat, 0.9, 0.6, 0.7, c2, 0, 0.55, 0, { r: 0.1 });
        cyl(boat, 0.08, 0.08, 0.8, "#c9ced6", 0.5, 0.8, 0.3, 6);
        boat.userData.a = a;
        boats.push(boat);
      }
      update = (dt, api) => {
        if (!api.running) return;
        boats.forEach((b) => { b.userData.a += dt * 0.35; b.position.x = Math.cos(b.userData.a) * R * 0.45; b.position.z = Math.sin(b.userData.a) * R * 0.4; b.rotation.y = -b.userData.a; });
      };
      break;
    }
    case "rapids": {
      cyl(g, R * 1.05, R * 1.1, 0.5, "#cfd8d3", 0, 0.25, 0, 30);
      const water = cyl(g, R * 1.0, R * 1.0, 0.14, "#4aa8b8", 0, 0.52, 0, 30, { matOpts: { rough: 0.1 } });
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        ball(g, 0.5, "#d9e8e6", Math.cos(a) * R * 0.85, 0.55, Math.sin(a) * R * 0.85, 6, [1, 0.5, 1]);
      }
      const rafts = [];
      for (let i = 0; i < 3; i++) {
        const raft = group(g, 0, 0.7, 0);
        cyl(raft, 1.1, 1.1, 0.35, "#3b3b3b", 0, 0.1, 0, 12);
        torus(raft, 1.1, 0.28, "#f4a261", 0, 0.1, 0, { rx: Math.PI / 2 });
        raft.userData.a = (i / 3) * Math.PI * 2;
        rafts.push(raft);
      }
      update = (dt, api) => {
        if (!api.running) return;
        rafts.forEach((r) => { r.userData.a += dt * 0.3; r.position.set(Math.cos(r.userData.a) * R * 0.6, 0.7, Math.sin(r.userData.a) * R * 0.55); r.rotation.y = -r.userData.a; });
      };
      break;
    }
    case "observation": {
      cyl(g, 1.6, 2.2, 0.6, c3, 0, 0.3, 0, 20);
      cyl(g, 0.9, 1.1, 18, "#e3e9ee", 0, 9, 0, 16);
      cyl(g, 2.2, 2.2, 0.4, c1, 0, 18.2, 0, 20);
      const cabin = group(g, 0, 3, 0);
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        box(cabin, 1.4, 1.6, 0.1, glass("#bfe4ef"), Math.cos(a) * 2.0, 0.8, Math.sin(a) * 2.0, { r: 0.04, matOpts: { rough: 0.1 } }).rotation.y = -a + Math.PI / 2;
      }
      cyl(cabin, 2.4, 2.4, 0.25, c1, 0, 1.7, 0, 20);
      cone(cabin, 2.5, 0.8, c2, 0, 2.2, 0, 20);
      update = (dt, api) => {
        if (!api.running) return;
        const t = (api.time % 22) / 22;
        cabin.position.y = 2.4 + (t < 0.45 ? t / 0.45 : t < 0.55 ? 1 : 1 - (t - 0.55) / 0.45) * 14;
        cabin.rotation.y += dt * 0.15;
      };
      break;
    }
    case "starflyer": {
      const H = 26;
      cyl(g, 2.2, 3.0, 0.6, c3, 0, 0.3, 0, 24);
      cyl(g, 0.7, 1.2, H, "#e3e9ee", 0, H / 2, 0, 16);
      const rotor = group(g, 0, H - 1.5, 0);
      cyl(rotor, 2.6, 2.8, 0.5, c1, 0, 0, 0, 20);
      cone(rotor, 2.4, 1.0, c2, 0, 0.7, 0, 18);
      const chairs = [];
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        const arm = group(rotor, Math.cos(a) * 2.5, -0.2, Math.sin(a) * 2.5);
        arm.rotation.y = -a;
        const ch = seat(i % 2 ? c3 : c2, 4.2);
        arm.add(ch);
        chairs.push(ch);
      }
      update = (dt, api) => {
        rotor.rotation.y += dt * (api.running ? 0.7 : 0.05);
        const tilt = api.running ? 0.3 : 0.05;
        chairs.forEach((c, i) => { c.rotation.z = Math.sin(api.time * 1.2 + i * 0.4) * tilt; });
      };
      break;
    }
    case "toboggan": {
      cyl(g, 3.2, 4.0, 0.8, "#e9edc9", 0, 0.4, 0, 22);
      cone(g, 2.6, 10, "#dfe8d8", 0, 5.8, 0, 18);
      const spiral = [];
      for (let i = 0; i <= 80; i++) {
        const t = i / 80, a = t * Math.PI * 5.2;
        spiral.push(new THREE.Vector3(Math.cos(a) * (2.2 + t * 4.0), 9.5 - t * 8.6, Math.sin(a) * (2.2 + t * 4.0)));
      }
      const chute = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(spiral), 100, 0.55, 7, false), mat(c1, { side: THREE.DoubleSide, rough: 0.5 }));
      g.add(chute);
      const sled = group(g);
      box(sled, 0.7, 0.2, 1.2, c3, 0, 0, 0, { r: 0.08 });
      const curve = new THREE.CatmullRomCurve3(spiral);
      update = (dt, api) => {
        if (!api.running) return;
        const t = (api.time * 0.12) % 1;
        sled.position.copy(curve.getPointAt(t));
        const tan = curve.getTangentAt(t);
        sled.rotation.y = Math.atan2(tan.x, tan.z);
      };
      break;
    }
    case "treehouse": {
      const trunk = cyl(g, 0.7, 1.1, 6.5, "#8a5a3c", 0, 3.2, 0, 12, { matOpts: { rough: 0.95 } });
      ball(g, 3.2, "#4f9560", 0, 7.4, 0, 14, [1.1, 0.8, 1.1]);
      ball(g, 2.2, "#5aa86c", -2.2, 6.4, 1.2, 12);
      ball(g, 2.0, "#468a57", 2.3, 6.6, -1.0, 12);
      const deck = group(g, 0, 4.6, 0);
      cyl(deck, 3.0, 3.0, 0.25, "#c99b6a", 0, 0, 0, 20);
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2;
        cyl(deck, 0.06, 0.06, 0.9, "#a87a4f", Math.cos(a) * 2.9, 0.55, Math.sin(a) * 2.9, 4);
      }
      box(deck, 2.2, 1.8, 2.0, "#b5794a", -0.8, 1.0, -0.4, { r: 0.08 });
      cone(deck, 1.7, 1.0, "#c1121f", -0.8, 2.35, -0.4, 4);
      const slide = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([
        new THREE.Vector3(1.2, 4.8, 0.6), new THREE.Vector3(2.6, 3.6, 1.4), new THREE.Vector3(3.2, 1.4, 2.2), new THREE.Vector3(3.0, 0.3, 3.2)
      ]), 24, 0.55, 8, false), mat("#f4a261", { side: THREE.DoubleSide, rough: 0.4 }));
      g.add(slide);
      const kid = buildPerson({ shirt: "#ffd166", scale: 0.7 });
      kid.group.position.set(0.6, 4.8, 0);
      g.add(kid.group);
      update = (dt, api) => {
        kid.animate(api.time, api.running);
        kid.group.rotation.y += dt * (api.running ? 0.4 : 0);
      };
      break;
    }
    case "trampoline": {
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        const x = Math.cos(a) * R * 0.55, z = Math.sin(a) * R * 0.55;
        cyl(g, 1.2, 1.2, 0.25, "#3d4a54", x, 0.15, z, 16);
        cyl(g, 1.05, 1.05, 0.08, "#222", x, 0.32, z, 16);
        const kid = buildPerson({ shirt: ["#ffd166", "#4cc9f0", "#ff6b9d"][i % 3], scale: 0.6 });
        kid.group.position.set(x, 0.3, z);
        g.add(kid.group);
        kid.group.userData.kid = kid;
      }
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        cyl(g, 0.06, 0.06, 1.4, "#c9ced6", Math.cos(a) * R * 0.95, 0.7, Math.sin(a) * R * 0.95, 4);
      }
      update = (dt, api) => {
        g.children.forEach((c, i) => {
          const kid = c.userData && c.userData.kid;
          if (kid) { c.position.y = 0.3 + Math.abs(Math.sin(api.time * 2.4 + i)) * (api.running ? 0.9 : 0.1); kid.group.rotation.y += dt * 0.5; }
        });
      };
      break;
    }
    case "darkride": {
      box(g, R * 1.8, 5.0, R * 1.7, "#4a4e69", 0, 2.5, 0, { r: 0.12 });
      const roof = cone(g, R * 1.35, 2.2, "#3a3d52", 0, 6.1, 0, 4);
      roof.rotation.y = Math.PI / 4;
      for (let i = -1; i <= 1; i++) box(g, 1.0, 1.4, 0.1, glow("#ff9f43", 0.9), i * 1.6, 3.0, R * 0.86, { r: 0.03 });
      box(g, 2.2, 2.8, 0.3, "#221f2e", 0, 1.4, R * 0.86, { r: 0.05 });
      signBoard(g, def.name, R * 1.2, 0.9, "#f4e3c1", "#2b2635", 0, 5.0, R * 0.87);
      const cart = car(c1, c3);
      g.add(cart);
      update = (dt, api) => {
        if (!api.running) return;
        const t = api.time * 0.1;
        cart.position.set(Math.sin(t) * R * 0.55, 0.1, Math.cos(t) * R * 0.5);
        cart.rotation.y = t + Math.PI / 2;
      };
      break;
    }
    case "carpet": {
      cyl(g, 2.2, 2.8, 0.6, c3, 0, 0.3, 0, 20);
      for (const s of [-1, 1]) {
        const arm = cyl(g, 0.22, 0.3, 10, "#e3e9ee", s * R * 0.6, 5, 0, 8, { matOpts: { metal: 0.5 } });
        arm.rotation.z = s * 0.12;
      }
      cyl(g, 3.6, 3.8, 0.4, c1, 0, 10.2, 0, 20);
      const swing = group(g, 0, 9.8, 0);
      box(swing, 6.4, 0.25, 3.2, c1, 0, -1.6, 0, { r: 0.06 });
      box(swing, 6.0, 0.5, 0.4, c3, 0, -1.2, 1.6, { r: 0.06 });
      for (const x of [-2.6, 0, 2.6]) for (const z of [-1.2, 1.2]) cyl(swing, 0.03, 0.03, 1.6, "#c9ced6", x, -0.8, z, 4);
      riderDots(swing, 8, 2.2, -1.45, "#fff", 0.35);
      update = (dt, api) => {
        const wave = api.running ? Math.sin(api.time * 1.1) : Math.sin(api.time * 0.4) * 0.08;
        swing.rotation.z = wave * 0.5;
        swing.rotation.x = Math.cos(api.time * 0.9) * (api.running ? 0.18 : 0.02);
        swing.position.y = 9.8 + Math.abs(Math.cos(api.time * 0.9)) * (api.running ? 0.9 : 0.05);
      };
      break;
    }
    case "coaster": {
      const built = buildCoasterRide(def);
      g.add(built.group);
      update = built.update;
      break;
    }
    default: {
      cyl(g, R, R, 0.4, c1, 0, 0.2, 0, 20);
      signBoard(g, def.name, 4, 1, "#fff", c1, 0, 2, 0);
    }
  }
  if (def.model !== "coaster") {
    signBoard(g, def.name, 3.6, 0.8, "#4a3b32", "#fff7e9", 0, 2.4, R + 0.1);
  }
  // a little queue fence in front of every ride
  for (let i = 0; i < 5; i++) {
    cyl(g, 0.05, 0.05, 0.9, "#d9cfc0", -2.6 + i * 1.3, 0.45, R * 0.75 + 1.6, 5);
  }
  box(g, 5.2, 0.06, 0.06, "#d9cfc0", 0, 0.85, R * 0.75 + 1.6, { r: 0.02 });
  g.userData.seats = seats;
  return { group: g, update };
}

function ringRing(parent, r) {
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    ball(parent, 0.12, "#fff2b0", Math.cos(a) * r * 0.98, 0.42, Math.sin(a) * r * 0.98, 5);
  }
}
