/* =====================================================================
   LITTLE TOWN — 3D models
   Every building is assembled from real geometry: plaster walls, timber
   framing, tiled or thatched roofs, shop awnings, signs, window boxes,
   clock towers, bandstands, gardens and street furniture. Static meshes
   are merged by material so a detailed house still costs a handful of
   draw calls.
   ===================================================================== */
import * as THREE from "three";
import { RoundedBoxGeometry } from "../../../vendor/three/RoundedBoxGeometry.js";
import { CONFIG } from "./config.js";

const TILE = CONFIG.tile;
const PI = Math.PI;

/* ---------------------------------------------------------------------
   Shared materials & small geometry helpers
   --------------------------------------------------------------------- */
const materialCache = new Map();
export function mat(color, opts = {}) {
  const key = color + "|" + JSON.stringify(opts);
  if (materialCache.has(key)) return materialCache.get(key);
  const params = {
    color: new THREE.Color(color),
    roughness: opts.rough !== undefined ? opts.rough : 0.82,
    metalness: opts.metal || 0,
    emissive: opts.emissive ? new THREE.Color(opts.emissive) : 0x000000,
    emissiveIntensity: opts.emissiveIntensity || 0,
    transparent: !!opts.transparent,
    opacity: opts.opacity !== undefined ? opts.opacity : 1,
    side: opts.side || THREE.FrontSide,
    depthWrite: opts.depthWrite !== undefined ? opts.depthWrite : true,
    map: opts.map || null,
    flatShading: !!opts.flat
  };
  const m = new THREE.MeshStandardMaterial(params);
  if (opts.map) {
    m.map.wrapS = m.map.wrapT = THREE.RepeatWrapping;
    if (opts.repeat) m.map.repeat.set(opts.repeat[0], opts.repeat[1]);
  }
  materialCache.set(key, m);
  return m;
}
const geoCache = new Map();
function rb(w, h, d, r = 0.05) {
  const key = [w, h, d, r].map((n) => (+n).toFixed(3)).join("|");
  if (!geoCache.has(key)) {
    const radius = Math.max(0.002, Math.min(r, w / 2 - 0.001, h / 2 - 0.001, d / 2 - 0.001));
    geoCache.set(key, new RoundedBoxGeometry(w, h, d, 2, radius));
  }
  return geoCache.get(key);
}
export function box(parent, w, h, d, color, x = 0, y = 0, z = 0, opts = {}) {
  const mesh = new THREE.Mesh(rb(w, h, d, opts.r === undefined ? Math.min(w, h, d) * 0.06 : opts.r), typeof color === "string" ? mat(color, opts.matOpts || {}) : color);
  mesh.position.set(x, y, z);
  mesh.rotation.set(opts.rx || 0, opts.ry || 0, opts.rz || 0);
  if (opts.scale) mesh.scale.set(opts.scale[0], opts.scale[1], opts.scale[2]);
  parent.add(mesh);
  return mesh;
}
export function cyl(parent, rt, rb2, h, color, x = 0, y = 0, z = 0, seg = 16, opts = {}) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb2, h, seg, 1, !!opts.open), typeof color === "string" ? mat(color, opts.matOpts || {}) : color);
  mesh.position.set(x, y, z);
  mesh.rotation.set(opts.rx || 0, opts.ry || 0, opts.rz || 0);
  parent.add(mesh);
  return mesh;
}
export function ball(parent, r, color, x = 0, y = 0, z = 0, seg = 12, opts = {}) {
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(r, seg, Math.max(6, Math.round(seg * 0.7))), typeof color === "string" ? mat(color, opts.matOpts || {}) : color);
  mesh.position.set(x, y, z);
  if (opts.scale) mesh.scale.set(opts.scale[0], opts.scale[1], opts.scale[2]);
  parent.add(mesh);
  return mesh;
}
export function cone(parent, r, h, color, x = 0, y = 0, z = 0, seg = 12, opts = {}) {
  const mesh = new THREE.Mesh(new THREE.ConeGeometry(r, h, seg, 1, !!opts.open), typeof color === "string" ? mat(color, opts.matOpts || {}) : color);
  mesh.position.set(x, y, z);
  mesh.rotation.set(opts.rx || 0, opts.ry || 0, opts.rz || 0);
  parent.add(mesh);
  return mesh;
}
export function torus(parent, r, tube, color, x = 0, y = 0, z = 0, opts = {}) {
  const mesh = new THREE.Mesh(new THREE.TorusGeometry(r, tube, 8, 22, opts.arc || PI * 2), typeof color === "string" ? mat(color) : color);
  mesh.position.set(x, y, z);
  mesh.rotation.set(opts.rx || 0, opts.ry || 0, opts.rz || 0);
  parent.add(mesh);
  return mesh;
}
export function group(parent, x = 0, y = 0, z = 0) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  if (parent) parent.add(g);
  return g;
}
const rand = (seed) => {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};
const hash = (str) => { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };

/* ---------------------------------------------------------------------
   Canvas textures: shop signs, clocks and roof tiles
   --------------------------------------------------------------------- */
const signCache = new Map();
function signTexture(text) {
  if (signCache.has(text)) return signCache.get(text);
  const canvas = document.createElement("canvas");
  canvas.width = 512; canvas.height = 128;
  const c = canvas.getContext("2d");
  c.fillStyle = "#faf0dc"; c.fillRect(0, 0, 512, 128);
  c.strokeStyle = "#7c5a3e"; c.lineWidth = 8; c.strokeRect(8, 8, 496, 112);
  c.strokeStyle = "#d9b98a"; c.lineWidth = 2; c.strokeRect(18, 18, 476, 92);
  c.fillStyle = "#4b3527";
  c.font = "600 46px Georgia, 'Times New Roman', serif";
  c.textAlign = "center"; c.textBaseline = "middle";
  const label = String(text).length > 20 ? String(text).slice(0, 19) + "…" : String(text);
  c.fillText(label, 256, 66);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  signCache.set(text, tex);
  return tex;
}
const roofTexture = (() => {
  let tex = null;
  return () => {
    if (tex) return tex;
    const canvas = document.createElement("canvas");
    canvas.width = 128; canvas.height = 128;
    const c = canvas.getContext("2d");
    c.fillStyle = "#c9c9c9"; c.fillRect(0, 0, 128, 128);
    for (let row = 0; row < 8; row++) {
      const y = row * 16;
      for (let col = 0; col < 8; col++) {
        const x = col * 16 + (row % 2 ? 8 : 0);
        c.fillStyle = (row + col) % 2 ? "#b8b8b8" : "#d7d7d7";
        c.beginPath();
        c.roundRect(x + 1, y + 1, 15, 15, 4);
        c.fill();
        c.strokeStyle = "#a7a7a7"; c.lineWidth = 1; c.stroke();
      }
    }
    tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(3, 2);
    return tex;
  };
})();
function roofMat(color) {
  return mat(color, { map: roofTexture(), rough: 0.88, repeat: [3, 2] });
}
const cobbleTexture = (() => {
  let tex = null;
  return () => {
    if (tex) return tex;
    const canvas = document.createElement("canvas");
    canvas.width = 128; canvas.height = 128;
    const c = canvas.getContext("2d");
    c.fillStyle = "#9d9487"; c.fillRect(0, 0, 128, 128);
    const rng = rand(77);
    for (let i = 0; i < 90; i++) {
      const x = rng() * 128, y = rng() * 128, w = 10 + rng() * 12, h = 8 + rng() * 9;
      const tone = 135 + Math.floor(rng() * 45);
      c.fillStyle = `rgb(${tone},${tone - 5},${tone - 15})`;
      c.beginPath(); c.roundRect(x, y, w, h, 3); c.fill();
      c.strokeStyle = "rgba(95,85,72,0.45)"; c.lineWidth = 1; c.stroke();
    }
    tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(3, 3);
    return tex;
  };
})();
export const cobbleMat = () => mat("#b6ab99", { map: cobbleTexture(), rough: 0.95 });
export const paveMat = () => mat("#d5cbb8", { rough: 0.96 });
export const pathMat = () => mat("#c3b8a2", { map: cobbleTexture(), rough: 0.95 });

/* ---------------------------------------------------------------------
   Static merge — turns a detailed building into one mesh per material
   --------------------------------------------------------------------- */
export function mergeStatic(root) {
  root.updateMatrixWorld(true);
  const meshes = [];
  root.traverse((o) => { if (o.isMesh && !o.userData.noMerge) meshes.push(o); });
  if (!meshes.length) return root;
  const buckets = new Map();
  for (const mesh of meshes) {
    const src = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone();
    src.applyMatrix4(mesh.matrixWorld);
    const pos = src.getAttribute("position");
    if (!pos) { src.dispose(); continue; }
    const norm = src.getAttribute("normal");
    const uv = src.getAttribute("uv");
    const count = pos.count;
    const bucket = buckets.get(mesh.material) || { pos: [], norm: [], uv: [], count: 0 };
    for (let i = 0; i < count; i++) {
      bucket.pos.push(pos.getX(i), pos.getY(i), pos.getZ(i));
      if (norm) bucket.norm.push(norm.getX(i), norm.getY(i), norm.getZ(i));
      else bucket.norm.push(0, 1, 0);
      if (uv) bucket.uv.push(uv.getX(i), uv.getY(i));
      else bucket.uv.push(0, 0);
    }
    bucket.count += count;
    buckets.set(mesh.material, bucket);
    src.dispose();
  }
  const keep = [];
  for (const child of root.children) if (child.userData.keep) keep.push(child);
  root.clear();
  for (const child of keep) root.add(child);
  for (const [material, b] of buckets) {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(b.pos, 3));
    g.setAttribute("normal", new THREE.Float32BufferAttribute(b.norm, 3));
    g.setAttribute("uv", new THREE.Float32BufferAttribute(b.uv, 2));
    g.computeBoundingSphere();
    const mesh = new THREE.Mesh(g, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    root.add(mesh);
  }
  return root;
}

/* ---------------------------------------------------------------------
   Colour palettes
   --------------------------------------------------------------------- */
export const PAINTS = ["#f5e6c8", "#f1d7c8", "#e7e9d8", "#dce8e2", "#e8dcef", "#f1dfae", "#e5dccd", "#dbe5ee"];
const FLOWERS = ["#d96a7c", "#e8b44c", "#c58ad4", "#e88c5d", "#f4f0e6", "#7fa9d6"];
const AWNING_COLORS = ["#b85f51", "#6f9077", "#8a789f", "#c18c4e", "#5d7f91", "#a85f78"];

function styleOf(def, level, variant) {
  const style = { ...(def.style || {}) };
  if (def.model !== "decor" && def.model !== "tree" && def.model !== "flower" && def.model !== "street" && def.model !== "garden" && def.model !== "water" && def.model !== "play") {
    style.wall = variant ? PAINTS[variant % PAINTS.length] : style.wall || "#f2e4c9";
  }
  style.trim = style.trim || "#6b4b37";
  style.roofColor = style.roofColor || "#8c5f45";
  style.floors = style.floors || 1;
  return style;
}

/* ---------------------------------------------------------------------
   Windows, doors, awnings, signs
   --------------------------------------------------------------------- */
function windowUnit(parent, x, y, z, facing, style, opts = {}) {
  const g = group(parent, x, y, z);
  g.rotation.y = facing === "front" ? 0 : facing === "back" ? PI : facing === "left" ? -PI / 2 : PI / 2;
  const w = opts.w || 0.92, h = opts.h || 1.2;
  const trim = opts.trim || style.trim;
  box(g, w + 0.22, 0.1, 0.1, trim, 0, -h / 2, 0.05);
  box(g, w + 0.22, 0.09, 0.1, trim, 0, h / 2, 0.05);
  box(g, 0.1, h + 0.18, 0.1, trim, -w / 2, 0, 0.05);
  box(g, 0.1, h + 0.18, 0.1, trim, w / 2, 0, 0.05);
  box(g, 0.06, h, 0.06, trim, 0, 0, 0.04);
  box(g, w, 0.05, 0.06, trim, 0, 0.05, 0.04);
  box(g, w - 0.04, h - 0.04, 0.05, mat("#a9d7d0", { rough: 0.18, metal: 0.15, emissive: "#ffe7b0", emissiveIntensity: 0.18, transparent: true, opacity: 0.82 }), 0, 0, 0.02);
  if (opts.shutters) {
    box(g, 0.24, h, 0.07, opts.shutterColor || style.shutter || "#6f8b81", -w / 2 - 0.2, 0, 0.06);
    box(g, 0.24, h, 0.07, opts.shutterColor || style.shutter || "#6f8b81", w / 2 + 0.2, 0, 0.06);
  }
  if (opts.flowers) {
    box(g, w + 0.1, 0.22, 0.26, "#8a5a3b", 0, -h / 2 - 0.05, 0.16);
    const rng = rand(hash(style.wall + x + y + facing));
    for (let i = 0; i < 3; i++) {
      ball(g, 0.1, FLOWERS[Math.floor(rng() * FLOWERS.length)], -w / 3 + i * w / 3, -h / 2 + 0.12, 0.2, 7);
      ball(g, 0.13, "#5d8a4f", -w / 3 + i * w / 3, -h / 2 + 0.04, 0.2, 6);
    }
  }
  if (opts.arch) {
    torus(g, w / 2, 0.06, trim, 0, h / 2, 0.04, { arc: PI });
  }
  return g;
}

function doorUnit(parent, x, z, facing, style, opts = {}) {
  const g = group(parent, x, 0, z);
  g.rotation.y = facing === "back" ? PI : facing === "left" ? -PI / 2 : facing === "right" ? PI / 2 : 0;
  const color = opts.color || style.trim;
  box(g, 1.32, 2.35, 0.12, color, 0, 1.18, 0.03);
  box(g, 1.08, 2.12, 0.1, opts.doorColor || "#7a4d35", 0, 1.08, 0.09);
  box(g, 0.72, 0.72, 0.05, "#a9d7d0", 0, 1.55, 0.14, { matOpts: { rough: 0.2, transparent: true, opacity: 0.8 } });
  ball(g, 0.055, "#d9b25e", 0.42, 1.02, 0.17, 8);
  box(g, 1.7, 0.18, 0.55, "#cfc3ad", 0, 0.09, 0.28);
  box(g, 1.45, 0.1, 0.3, "#bcae97", 0, 0.23, 0.2);
  if (opts.canopy) {
    box(g, 1.8, 0.1, 0.9, style.trim, 0, 2.55, 0.4, { rx: -0.12 });
    box(g, 1.55, 0.08, 0.82, opts.canopy, 0, 2.62, 0.38, { rx: -0.12 });
  }
  if (opts.lamp) {
    box(g, 0.08, 0.08, 0.34, "#3f3a33", 0.95, 2.38, 0.22);
    ball(g, 0.13, "#ffe3a1", 0.95, 2.22, 0.3, 8, { matOpts: { emissive: "#ffd98a", emissiveIntensity: 1.2 } });
  }
  return g;
}

function awning(parent, width, y, z, color, style) {
  const count = Math.max(4, Math.round(width / 0.42));
  const w = width / count;
  const stripe = color || AWNING_COLORS[0];
  for (let i = 0; i < count; i++) {
    box(parent, w * 0.96, 0.09, 0.92, i % 2 ? stripe : "#f8efdc", -width / 2 + w * (i + 0.5), y, z + 0.44, { rx: -0.2 });
  }
  box(parent, width + 0.15, 0.07, 0.12, style.trim, 0, y - 0.09, z + 0.82);
  for (const side of [-1, 1]) {
    box(parent, 0.06, 1.7, 0.06, style.trim, side * width / 2, y - 0.9, z + 0.72);
  }
}

function signBoard(parent, text, width, y, z, opts = {}) {
  const tex = signTexture(text);
  const material = mat("#f8efdc", { map: tex, rough: 0.7 });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, width * 0.25), material);
  mesh.position.set(0, y, z);
  mesh.rotation.y = opts.back ? PI : 0;
  parent.add(mesh);
  box(parent, width + 0.12, width * 0.25 + 0.12, 0.06, opts.frame || "#6b4b37", 0, y, z - 0.02);
  return mesh;
}

/* ---------------------------------------------------------------------
   Roofs
   --------------------------------------------------------------------- */
function gableRoof(parent, w, d, eave, rise, style, opts = {}) {
  const over = opts.over === undefined ? 0.42 : opts.over;
  const half = d / 2 + over;
  const slope = Math.hypot(half, rise);
  const angle = Math.atan2(rise, half);
  const color = style.roofColor;
  const material = opts.thatch ? mat(color, { rough: 1 }) : roofMat(color);
  for (const side of [-1, 1]) {
    const mesh = new THREE.Mesh(rb(w + over * 2, opts.thatch ? 0.26 : 0.15, slope, 0.04), material);
    mesh.position.set(0, eave + rise / 2, side * half / 2);
    mesh.rotation.x = side * angle;
    parent.add(mesh);
  }
  // gable triangles
  const shape = new THREE.Shape();
  shape.moveTo(-d / 2, 0); shape.lineTo(d / 2, 0); shape.lineTo(0, rise); shape.closePath();
  for (const side of [-1, 1]) {
    const g = new THREE.ShapeGeometry(shape);
    const m = new THREE.Mesh(g, mat(style.wall, { flat: true }));
    m.rotation.y = side * PI / 2;
    m.position.set(side * (w / 2 + 0.01), eave, 0);
    m.userData.noMerge = false;
    parent.add(m);
  }
  box(parent, w + over * 2 + 0.05, opts.thatch ? 0.22 : 0.12, 0.3, color === "#b68551" ? "#9a7448" : style.trim, 0, eave + rise + 0.02, 0);
  if (opts.thatch) {
    for (let i = 0; i < 3; i++) {
      cyl(parent, 0.1, 0.1, w + over * 2, "#c7a06b", 0, eave + rise - i * 0.06, 0, 8, { rz: PI / 2 });
    }
  }
  if (style.timber) {
    for (const z of [-d / 4, d / 4]) {
      box(parent, 0.08, rise * 0.7, 0.08, style.trim, w / 2 + 0.02, eave + rise * 0.42, z, { rz: 0.12 });
    }
  }
}

function hipRoof(parent, w, d, eave, rise, style) {
  const g = group(parent, 0, eave, 0);
  const roof = cone(g, Math.max(w, d) * 0.64, rise, style.roofColor, 0, rise / 2, 0, 4, { matOpts: { map: roofTexture(), rough: 0.9 } });
  roof.scale.set(w / Math.max(w, d), 1, d / Math.max(w, d));
  roof.rotation.y = PI / 4;
  box(parent, w + 0.7, 0.13, d + 0.7, style.roofColor, 0, eave - 0.02, 0);
  box(parent, 0.12, 0.5, 0.12, style.trim, 0, eave + rise + 0.2, 0);
  return g;
}

function mansardRoof(parent, w, d, eave, rise, style) {
  const lower = rise * 0.65;
  const half = d / 2 + 0.35;
  const angle = Math.atan2(lower, half);
  for (const side of [-1, 1]) {
    const slope = Math.hypot(half, lower);
    const mesh = new THREE.Mesh(rb(w + 0.6, 0.16, slope, 0.04), roofMat(style.roofColor));
    mesh.position.set(0, eave + lower / 2, side * half / 2);
    mesh.rotation.x = side * angle;
    parent.add(mesh);
  }
  const topH = rise * 0.4;
  box(parent, w * 0.72, topH, d * 0.62, style.roofColor, 0, eave + lower + topH / 2, 0);
  box(parent, w * 0.76, 0.1, d * 0.66, style.trim, 0, eave + lower + topH, 0);
  box(parent, w + 0.2, 0.1, d + 0.2, style.trim, 0, eave + 0.02, 0);
}

function dormer(parent, x, z, y, style) {
  const g = group(parent, x, y, z);
  box(g, 0.94, 0.85, 0.7, style.wall, 0, 0.42, 0);
  windowUnit(g, 0, 0.44, 0.36, "front", style, { w: 0.52, h: 0.56 });
  const roof = group(g, 0, 0.85, 0);
  for (const side of [-1, 1]) {
    const m = new THREE.Mesh(rb(1.08, 0.08, 0.52, 0.02), roofMat(style.roofColor));
    m.position.set(0, 0.2, side * 0.2); m.rotation.x = side * 0.65;
    roof.add(m);
  }
  return g;
}

function chimney(parent, x, z, baseY, height, style) {
  const color = style.stone ? "#b7ab96" : "#a8886a";
  box(parent, 0.52, height, 0.52, color, x, baseY + height / 2, z);
  box(parent, 0.62, 0.12, 0.62, "#85735f", x, baseY + height, z);
  box(parent, 0.2, 0.2, 0.2, "#6d5a48", x - 0.12, baseY + height + 0.1, z - 0.12);
}

/* ---------------------------------------------------------------------
   Core house body
   --------------------------------------------------------------------- */
function addShell(root, def, style, floors, opts = {}) {
  const w = def.size[0] * TILE - 0.4;
  const d = def.size[1] * TILE - 0.4;
  const baseH = 0.3;
  const floorH = opts.floorH || 2.55;
  const bodyH = floors * floorH;
  const eave = baseH + bodyH;
  const wallMat = mat(style.wall, { rough: 0.92 });
  const trim = style.trim;
  box(root, w + 0.25, baseH, d + 0.25, "#b6a992", 0, baseH / 2, 0);
  box(root, w, bodyH, d, wallMat, 0, baseH + bodyH / 2, 0);
  // corner stones
  if (style.stone) {
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      box(root, 0.32, bodyH, 0.32, "#b9ad98", sx * w / 2, baseH + bodyH / 2, sz * d / 2);
    }
  }
  // floor bands
  for (let f = 1; f < floors; f++) {
    box(root, w + 0.1, 0.12, d + 0.1, trim, 0, baseH + f * floorH, 0);
  }
  box(root, w + 0.14, 0.16, d + 0.14, trim, 0, eave - 0.05, 0);
  if (style.timber) addTimbering(root, w, d, baseH, floors, floorH, trim);
  if (style.stoneBase) box(root, w + 0.03, 0.85, d + 0.03, "#b9ad98", 0, baseH + 0.42, 0);
  return { w, d, baseH, floorH, bodyH, eave };
}

function addTimbering(root, w, d, baseH, floors, floorH, trim) {
  for (let f = 0; f < floors; f++) {
    const y0 = baseH + f * floorH;
    const beamY = y0 + floorH - 0.12;
    box(root, w + 0.02, 0.11, d + 0.02, trim, 0, beamY, 0);
    if (f > 0) box(root, w + 0.02, 0.07, d + 0.02, trim, 0, y0 + 0.15, 0);
    for (const face of [-1, 1]) {
      const z = face * (d / 2 + 0.01);
      const n = Math.max(2, Math.round(w / 2.4));
      for (let i = 0; i <= n; i++) {
        const x = -w / 2 + (w / n) * i;
        box(root, 0.09, floorH, 0.07, trim, x, y0 + floorH / 2, z);
      }
      box(root, w, 0.08, 0.07, trim, 0, y0 + 0.17, z);
      // diagonal braces in the outer panels
      box(root, 0.07, floorH * 0.9, 0.07, trim, -w / 2 + w / n * 0.5, y0 + floorH / 2, z, { rz: 0.65 });
      box(root, 0.07, floorH * 0.9, 0.07, trim, w / 2 - w / n * 0.5, y0 + floorH / 2, z, { rz: -0.65 });
    }
    for (const face of [-1, 1]) {
      const x = face * (w / 2 + 0.01);
      box(root, 0.07, floorH, 0.09, trim, x, y0 + floorH / 2, 0);
      box(root, 0.07, 0.08, d, trim, x, y0 + 0.17, 0);
    }
  }
}

/* ---------------------------------------------------------------------
   HOUSE
   --------------------------------------------------------------------- */
function buildHouse(def, style, level, rng) {
  const root = new THREE.Group();
  const floors = Math.min(4, (style.floors || 1) + (level - 1));
  const s = addShell(root, def, style, floors);
  const { w, d, baseH, floorH, eave } = s;
  const doorColor = style.doorColor || (style.trim ? "#7d4f35" : "#6b4a36");
  doorUnit(root, style.twin ? -w * 0.22 : 0, d / 2 + 0.04, "front", style, { color: doorColor, canopy: style.canopy, lamp: true });
  if (style.twin) doorUnit(root, w * 0.22, d / 2 + 0.04, "front", style, { color: doorColor, lamp: false });
  // windows
  const cols = Math.max(2, Math.round(w / 2.15));
  for (let f = 0; f < floors; f++) {
    const y = baseH + f * floorH + 1.45;
    for (let i = 0; i < cols; i++) {
      const x = -w / 2 + (w / cols) * (i + 0.5);
      if (f === 0 && Math.abs(x) < 1.15) continue;
      if (style.twin && f === 0 && Math.abs(Math.abs(x) - w * 0.22) < 0.85) continue;
      windowUnit(root, x, y, d / 2 + 0.07, "front", style, { flowers: f > 0 && (style.flowers || style.garden), shutters: style.shutters });
    }
    for (const sideZ of [-d * 0.22, d * 0.2]) {
      for (const sx of [-1, 1]) {
        if (rng() > 0.25) windowUnit(root, sx * (w / 2 + 0.07), y, sideZ, sx < 0 ? "left" : "right", style, { w: 0.78, h: 1.05, flowers: f > 0 });
      }
    }
    if (f > 0) {
      for (let i = 0; i < cols; i++) {
        const x = -w / 2 + (w / cols) * (i + 0.5);
        windowUnit(root, x, y, -d / 2 - 0.07, "back", style, { w: 0.78, flowers: false });
      }
    }
  }
  // balcony
  if (style.balcony || (style.balconies && floors > 1)) {
    const by = baseH + floorH * (floors - 1) + 0.15;
    const bw = w * 0.55;
    box(root, bw, 0.14, 0.8, style.trim, 0, by, d / 2 + 0.45);
    for (let i = 0; i < 6; i++) box(root, 0.06, 0.7, 0.06, style.trim, -bw / 2 + (bw / 5) * i, by + 0.42, d / 2 + 0.8);
    box(root, bw, 0.08, 0.08, style.trim, 0, by + 0.78, d / 2 + 0.8);
    box(root, bw * 0.9, 0.16, 0.2, "#8a5a3b", 0, by + 0.18, d / 2 + 0.86);
    for (let i = 0; i < 4; i++) ball(root, 0.08, FLOWERS[i % FLOWERS.length], -bw * 0.3 + i * bw * 0.2, by + 0.34, d / 2 + 0.88, 6);
  }
  if (style.dormer) dormer(root, w * 0.2, d * 0.23, eave - 0.6, style);
  if (style.chimney) chimney(root, -w * 0.26, -d * 0.12, eave, 1.25, style);
  // roof
  if (style.roof === "thatch") gableRoof(root, w, d, eave, 1.35, { ...style, roofColor: style.roofColor || "#b68551" }, { thatch: true });
  else if (style.roof === "hip") hipRoof(root, w, d, eave, 1.5, style);
  else if (style.roof === "mansard") mansardRoof(root, w, d, eave, 2.1, style);
  else gableRoof(root, w, d, eave, 1.55, style);
  // garden bits at the front corners
  if (style.garden || style.flowers) {
    const rng2 = rand(hash(def.id + "garden"));
    for (const sx of [-1, 1]) {
      const gx = sx * (w / 2 - 0.45), gz = d / 2 + 0.55;
      box(root, 0.8, 0.16, 0.65, "#7c9a5f", gx, 0.08, gz);
      for (let i = 0; i < 3; i++) {
        ball(root, 0.1, FLOWERS[Math.floor(rng2() * FLOWERS.length)], gx - 0.25 + i * 0.25, 0.26, gz + 0.05, 6);
        box(root, 0.04, 0.22, 0.04, "#5c8248", gx - 0.25 + i * 0.25, 0.16, gz + 0.05);
      }
    }
  }
  if (style.grand) {
    box(root, w * 0.5, 0.4, 0.9, "#d6c9b4", 0, 0.2, d / 2 + 0.45);
    box(root, 0.18, 2.7, 0.18, "#cbbda7", -w / 2 + 0.6, 1.35, d / 2 + 0.45);
    box(root, 0.18, 2.7, 0.18, "#cbbda7", w / 2 - 0.6, 1.35, d / 2 + 0.45);
  }
  return root;
}

/* ---------------------------------------------------------------------
   SHOP
   --------------------------------------------------------------------- */
function buildShop(def, style, level, rng) {
  const root = new THREE.Group();
  const floors = Math.min(3, (style.floors || 1) + (level - 1));
  const s = addShell(root, def, style, floors);
  const { w, d, baseH, floorH, eave } = s;
  const awningColor = style.awning || AWNING_COLORS[hash(def.id) % AWNING_COLORS.length];
  // shopfront: big display windows either side of the door
  const groundY = baseH + 1.4;
  const doorX = w * 0.26;
  doorUnit(root, doorX, d / 2 + 0.05, "front", style, { color: awningColor, doorColor: style.trim });
  const bayW = Math.min(2.6, w * 0.42);
  for (const bx of [-w * 0.24, w * 0.58]) {
    if (Math.abs(bx - doorX) < 1.1) continue;
    box(root, bayW, 1.9, 0.12, style.trim, bx, 1.4, d / 2 + 0.04);
    box(root, bayW - 0.2, 1.65, 0.08, mat("#a9d7d0", { rough: 0.18, transparent: true, opacity: 0.86, emissive: "#ffe7b0", emissiveIntensity: 0.25 }), bx, 1.42, d / 2 + 0.09);
    box(root, 0.08, 1.7, 0.1, style.trim, bx, 1.42, d / 2 + 0.13);
    box(root, bayW * 0.9, 0.18, 0.25, "#8a5a3b", bx, 0.42, d / 2 + 0.22);
    for (let i = 0; i < 3; i++) ball(root, 0.09, FLOWERS[(i + 2) % FLOWERS.length], bx - bayW * 0.3 + i * bayW * 0.28, 0.58, d / 2 + 0.24, 6);
  }
  // hanging sign and facade board
  signBoard(root, def.name, Math.min(3.2, w * 0.62), baseH + 2.78, d / 2 + 0.11, { frame: style.trim });
  const bracket = group(root, w / 2 - 0.3, baseH + 2.5, d / 2 + 0.1);
  box(bracket, 0.9, 0.07, 0.07, "#4a4038", 0.4, 0, 0);
  box(bracket, 0.55, 0.5, 0.06, awningColor, 0.7, -0.32, 0.16);
  ball(bracket, 0.04, "#3f3a33", 0.85, 0.02, 0);
  awning(root, w * 0.82, baseH + 2.5, d / 2 + 0.08, awningColor, style);
  // upper windows
  for (let f = 1; f < floors; f++) {
    const y = baseH + f * floorH + 1.3;
    const cols = Math.max(2, Math.round(w / 2.4));
    for (let i = 0; i < cols; i++) {
      windowUnit(root, -w / 2 + (w / cols) * (i + 0.5), y, d / 2 + 0.07, "front", style, { flowers: true, shutters: style.shutters });
    }
  }
  // café tables outside and crates
  if (style.tables) {
    for (const sx of [-1, 1]) {
      const tx = sx * (w * 0.34);
      const tz = d / 2 + 0.95;
      cyl(root, 0.42, 0.42, 0.07, "#f1e8d6", tx, 0.72, tz, 12);
      cyl(root, 0.05, 0.05, 0.7, "#5f5044", tx, 0.36, tz, 8);
      cyl(root, 0.3, 0.36, 0.05, "#5f5044", tx, 0.03, tz, 10);
      for (const cx of [-0.62, 0.62]) {
        box(root, 0.3, 0.06, 0.3, "#8f6b4c", tx + cx, 0.52, tz, { ry: sx * 0.3 });
        box(root, 0.28, 0.5, 0.06, "#8f6b4c", tx + cx, 0.72, tz - 0.13);
        box(root, 0.06, 0.5, 0.06, "#5f5044", tx + cx, 0.26, tz);
      }
      cyl(root, 0.05, 0.05, 0.25, "#a9d7d0", tx, 0.85, tz, 8);
      for (let i = 0; i < 2; i++) ball(root, 0.07, FLOWERS[i], tx - 0.04 + i * 0.08, 0.99, tz, 6);
    }
  }
  if (style.crates) {
    for (let i = 0; i < 2; i++) {
      box(root, 0.5, 0.34, 0.42, "#9a7448", -w / 2 + 0.5 + i * 0.55, 0.19, d / 2 + 0.35);
      for (let j = 0; j < 3; j++) ball(root, 0.08, i ? "#c96a4a" : "#87a35a", -w / 2 + 0.36 + i * 0.55 + j * 0.13, 0.4, d / 2 + 0.35, 6);
    }
  }
  if (style.books) {
    for (let i = 0; i < 3; i++) box(root, 0.12, 0.4, 0.3, ["#a95f5f", "#5f7899", "#c7a14f"][i], w / 2 - 0.45, 0.32, d / 2 + 0.55 + i * 0.08, { rz: i % 2 ? 0.1 : -0.08 });
  }
  if (style.flowers) {
    for (let i = 0; i < 4; i++) {
      cyl(root, 0.16, 0.13, 0.42, "#a7a396", -w / 2 + 0.25 + i * 0.28, 0.22, d / 2 + 0.4, 8);
      for (let j = 0; j < 3; j++) ball(root, 0.11, FLOWERS[(i + j) % FLOWERS.length], -w / 2 + 0.25 + i * 0.28 + (j - 1) * 0.08, 0.5, d / 2 + 0.4 + (j - 1) * 0.06, 6);
    }
  }
  chimney(root, -w * 0.3, -d * 0.2, eave, 0.9, style);
  if (style.roof === "mansard") mansardRoof(root, w, d, eave, 1.9, style);
  else if (style.roof === "hip") hipRoof(root, w, d, eave, 1.4, style);
  else gableRoof(root, w, d, eave, 1.35, style);
  return root;
}

/* ---------------------------------------------------------------------
   CIVIC
   --------------------------------------------------------------------- */
function buildCivic(def, style, level, rng) {
  const kind = style.kind || "hall";
  const root = new THREE.Group();
  let customFloors = style.floors || 2;
  if (kind === "hall" || kind === "museum" || kind === "theatre") customFloors = Math.max(customFloors, 2);
  if (kind === "school") customFloors = Math.max(customFloors, 2);
  if (kind === "hotel") customFloors = Math.max(customFloors, 3);
  const floors = Math.min(4, customFloors + Math.max(0, level - 2));
  const s = addShell(root, def, style, floors, { floorH: kind === "school" ? 2.8 : 2.7 });
  const { w, d, baseH, floorH, eave } = s;
  const columns = style.columns;
  // windows all round
  const cols = Math.max(2, Math.round(w / 2.3));
  for (let f = 0; f < floors; f++) {
    const y = baseH + f * floorH + 1.45;
    for (let i = 0; i < cols; i++) {
      const x = -w / 2 + (w / cols) * (i + 0.5);
      if (f === 0 && Math.abs(x) < 1.25) continue;
      windowUnit(root, x, y, d / 2 + 0.07, "front", style, { w: 1, h: kind === "church" ? 1.8 : 1.4, arch: kind === "church", flowers: f === 1 });
    }
    for (const sx of [-1, 1]) {
      windowUnit(root, sx * (w / 2 + 0.07), y, 0, sx < 0 ? "left" : "right", style, { w: 1, h: 1.35, arch: kind === "church" });
    }
    for (let i = 0; i < Math.max(2, cols - 1); i++) {
      windowUnit(root, -w / 2 + (w / Math.max(2, cols - 1)) * (i + 0.5), y, -d / 2 - 0.07, "back", style, { w: 0.9, h: 1.3 });
    }
  }
  doorUnit(root, 0, d / 2 + 0.05, "front", style, { doorColor: style.doorColor || "#5b4032", canopy: style.marquee ? "#b4544f" : null, lamp: true });
  // steps
  for (let i = 0; i < 3; i++) box(root, 3.2 - i * 0.3, 0.14, 0.7, "#d0c4b0", 0, 0.07 + (2 - i) * 0.14, d / 2 + 0.5 + i * 0.25);
  if (columns) {
    for (const sx of [-1, 1]) {
      for (const x of [sx * w * 0.28, sx * w * 0.4]) {
        cyl(root, 0.17, 0.2, floorH * 0.85, "#e3dac8", x, baseH + floorH * 0.42, d / 2 + 0.42, 12);
        box(root, 0.5, 0.15, 0.5, "#d3c8b4", x, baseH + 0.1, d / 2 + 0.42);
        box(root, 0.46, 0.14, 0.46, "#d3c8b4", x, baseH + floorH * 0.85, d / 2 + 0.42);
      }
    }
    const pediment = new THREE.Shape();
    pediment.moveTo(-w * 0.48, 0); pediment.lineTo(w * 0.48, 0); pediment.lineTo(0, 1.1); pediment.closePath();
    const mesh = new THREE.Mesh(new THREE.ExtrudeGeometry(pediment, { depth: 0.22, bevelEnabled: false }), mat("#e3dac8"));
    mesh.position.set(0, baseH + floorH * 0.9, d / 2 + 0.33);
    root.add(mesh);
  }
  if (kind === "hall") {
    const tx = 0, tz = -d * 0.06;
    box(root, 1.7, eave + 1.8, 1.7, style.wall, tx, (eave + 1.8) / 2, tz);
    box(root, 1.9, 0.18, 1.9, style.trim, tx, eave + 1.8, tz);
    for (const [sx, sz] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
      box(root, sx ? 0.12 : 0.6, 0.6, sz ? 0.12 : 0.6, "#f8efdc", tx + sx * 0.86, eave + 0.9, tz + sz * 0.86);
    }
    const clock = new THREE.Mesh(new THREE.CircleGeometry(0.52, 24), mat("#f8efdc"));
    clock.position.set(tx, eave + 1.15, tz + d * 0.0 + 0.87);
    root.add(clock);
    cyl(root, 0.028, 0.028, 0.32, "#4b3527", tx, eave + 1.18, tz + 0.9, 6);
    cyl(root, 0.02, 0.02, 0.22, "#4b3527", tx + 0.08, eave + 1.14, tz + 0.9, 6, { rz: PI / 2 });
    cone(root, 1.35, 2, style.roofColor, tx, eave + 2.0 + 1.0, tz, 4, { ry: PI / 4 });
    ball(root, 0.13, "#d9b25e", tx, eave + 3.1, tz, 8);
    signBoard(root, def.name, Math.min(4, w * 0.7), baseH + floorH * 0.86, d / 2 + 0.35);
    for (const sx of [-1, 1]) {
      cyl(root, 0.05, 0.05, 2.6, "#3f3a33", sx * w * 0.3, 1.3, d / 2 + 1.1, 8);
      ball(root, 0.14, "#ffe3a1", sx * w * 0.3, 2.7, d / 2 + 1.1, 8, { matOpts: { emissive: "#ffd98a", emissiveIntensity: 0.8 } });
    }
  } else if (kind === "school") {
    box(root, 1.1, 2.1, 1.1, style.wall, -w * 0.32, eave + 1.05, -d * 0.1);
    cone(root, 0.9, 1.2, style.roofColor, -w * 0.32, eave + 2.7, -d * 0.1, 4, { ry: PI / 4 });
    cone(root, 0.28, 0.32, "#c9a84e", -w * 0.32, eave + 2.2, -d * 0.1, 12);
    ball(root, 0.12, "#c9a84e", -w * 0.32, eave + 1.9, -d * 0.1, 8);
    signBoard(root, "VILLAGE SCHOOL", w * 0.6, baseH + floorH * 0.82, d / 2 + 0.34);
    for (const x of [-w * 0.3, w * 0.3]) box(root, 0.12, 1.6, 0.12, "#5c6b62", x, eave + 0.8, d / 2 + 0.1);
  } else if (kind === "library") {
    signBoard(root, "LIBRARY", w * 0.45, baseH + floorH * 0.82, d / 2 + 0.35);
    ball(root, 0.18, "#c9a84e", 0, eave + 1.15, d / 2 + 0.35, 10);
    for (let i = 0; i < 4; i++) box(root, 0.5, 0.12, 0.32, "#8a6a4f", -w * 0.2 + i * w * 0.13, 0.35, d / 2 + 0.55);
  } else if (kind === "clinic") {
    signBoard(root, "CLINIC", w * 0.45, baseH + floorH * 0.85, d / 2 + 0.35);
    box(root, w * 0.5, 0.12, 0.8, "#6f927f", 0, 2.5, d / 2 + 0.42);
    box(root, 0.2, 0.55, 0.08, "#4f8c67", w * 0.24, 2.7, d / 2 + 0.86);
    box(root, 0.55, 0.2, 0.08, "#4f8c67", w * 0.24, 2.7, d / 2 + 0.86);
  } else if (kind === "post") {
    signBoard(root, "POST OFFICE", w * 0.55, baseH + floorH * 0.85, d / 2 + 0.35);
    box(root, 0.78, 1.25, 0.6, "#b6453f", w / 2 + 0.55, 0.62, d / 2 + 0.3);
    box(root, 0.7, 0.12, 0.58, "#8e332f", w / 2 + 0.55, 1.24, d / 2 + 0.3);
    box(root, 0.5, 0.08, 0.05, "#3b2f2a", w / 2 + 0.55, 1.0, d / 2 + 0.6);
  } else if (kind === "bank") {
    signBoard(root, "SAVINGS BANK", w * 0.55, baseH + floorH * 0.85, d / 2 + 0.35);
    cyl(root, 0.04, 0.04, 1.4, "#c9a84e", 0, baseH + 1.4, d / 2 + 0.55, 8);
    ball(root, 0.16, "#c9a84e", 0, baseH + 2.1, d / 2 + 0.55, 10);
  } else if (kind === "police") {
    signBoard(root, "CONSTABULARY", w * 0.55, baseH + floorH * 0.85, d / 2 + 0.35);
    cyl(root, 0.06, 0.06, 2.7, "#3f4b4a", w * 0.28, 1.35, d / 2 + 0.15, 8);
    ball(root, 0.2, "#5f89b4", w * 0.28, 2.75, d / 2 + 0.15, 10, { matOpts: { emissive: "#6d9bcb", emissiveIntensity: 0.8 } });
  } else if (kind === "fire") {
    for (const x of [-w * 0.2, w * 0.2]) {
      box(root, w * 0.32, 2.4, 0.12, "#a85145", x, 1.25, d / 2 + 0.06, { r: 0.02 });
      box(root, w * 0.26, 0.8, 0.05, "#cfe6e2", x, 1.8, d / 2 + 0.13);
      box(root, w * 0.3, 0.08, 0.28, "#6d4b3d", x, 0.07, d / 2 + 0.25);
    }
    box(root, 1.1, 3.4, 1.1, style.wall, -w * 0.32, eave + 1.7, -d * 0.2);
    cone(root, 0.85, 0.8, style.roofColor, -w * 0.32, eave + 3.7, -d * 0.2, 4, { ry: PI / 4 });
    signBoard(root, "FIRE STATION", w * 0.55, baseH + 2.8, d / 2 + 0.1);
  } else if (kind === "museum") {
    const dome = new THREE.Mesh(new THREE.SphereGeometry(1.35, 20, 12, 0, PI * 2, 0, PI / 2), mat("#a9c6be", { metal: 0.45, rough: 0.3 }));
    dome.position.set(0, eave + 0.12, 0); dome.scale.set(1.4, 1.0, 1.1);
    root.add(dome);
    ball(root, 0.14, "#d9b25e", 0, eave + 1.45, 0, 10);
    signBoard(root, "MUSEUM", w * 0.45, baseH + floorH * 0.85, d / 2 + 0.35);
    for (const sx of [-1, 1]) box(root, 0.9, 1.6, 0.1, "#b6534f", sx * w * 0.34, 1.0, d / 2 + 0.18);
  } else if (kind === "theatre") {
    box(root, w * 0.8, 1.3, 0.55, "#6b4444", 0, 3.1, d / 2 + 0.42);
    const tex = signTexture("THE LITTLE THEATRE");
    const board = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.62, w * 0.16), mat("#f8efdc", { map: tex }));
    board.position.set(0, 3.12, d / 2 + 0.7);
    root.add(board);
    for (let i = 0; i < 9; i++) ball(root, 0.055, "#ffe3a1", -w * 0.3 + i * w * 0.075, 2.55, d / 2 + 0.7, 6, { matOpts: { emissive: "#ffd98a", emissiveIntensity: 1.4 } });
    for (const sx of [-1, 1]) box(root, 0.55, 2.6, 0.12, "#8d3f46", sx * w * 0.3, 1.4, d / 2 + 0.16);
  } else if (kind === "church") {
    box(root, 2.1, 4.6, 2.1, style.wall, 0, eave + 2.3, -d * 0.1);
    cone(root, 1.8, 4.6, style.roofColor, 0, eave + 6.9, -d * 0.1, 4, { ry: PI / 4 });
    box(root, 0.12, 1.1, 0.12, "#c9a84e", 0, eave + 9.1, -d * 0.1);
    box(root, 0.65, 0.12, 0.12, "#c9a84e", 0, eave + 8.85, -d * 0.1);
    windowUnit(root, 0, eave + 1.1, -d * 0.1 + 1.07, "front", style, { w: 0.8, h: 1.5, arch: true });
    for (let i = 0; i < 3; i++) box(root, 0.55, 0.12, 0.3, "#cabfa9", -1.1 + i * 1.1, 0.45, d / 2 + 0.5);
  } else if (kind === "station") {
    box(root, w * 0.8, 0.16, 2.2, style.roofColor, 0, baseH + 2.7, d / 2 + 1.0, { rx: 0.08 });
    for (const sx of [-1, 1]) for (const z of [d / 2 + 0.2, d / 2 + 1.8]) cyl(root, 0.07, 0.07, 2.7, "#5d5148", sx * w * 0.33, 1.35, z, 8);
    for (let i = 0; i < 3; i++) box(root, 0.5, 0.08, 0.5, "#6d5f52", -w * 0.22 + i * w * 0.22, 0.75, d / 2 + 1.55);
    box(root, w * 0.9, 0.06, 0.1, "#8c8071", 0, 0.35, d / 2 + 2.3);
    signBoard(root, "LINDEN STATION", w * 0.55, baseH + 2.25, d / 2 + 0.12);
  } else if (kind === "hotel") {
    signBoard(root, "THE LINDEN ARMS", w * 0.6, baseH + 2.9, d / 2 + 0.11);
    for (let f = 1; f < floors; f++) {
      const by = baseH + f * floorH + 0.05;
      box(root, w * 0.5, 0.1, 0.6, "#5a4639", 0, by, d / 2 + 0.3);
      for (let i = 0; i < 5; i++) box(root, 0.05, 0.5, 0.05, "#5a4639", -w * 0.23 + i * w * 0.115, by + 0.3, d / 2 + 0.55);
    }
    awning(root, w * 0.6, 2.2, d / 2 + 0.1, "#b4544f", style);
    for (const sx of [-1, 1]) ball(root, 0.12, "#ffe3a1", sx * w * 0.36, 2.4, d / 2 + 0.55, 6, { matOpts: { emissive: "#ffd98a", emissiveIntensity: 1.0 } });
  } else if (kind === "centre") {
    signBoard(root, "COMMUNITY CENTRE", w * 0.66, baseH + floorH * 0.9, d / 2 + 0.35);
    awning(root, w * 0.5, 2.35, d / 2 + 0.14, "#7f9d7a", style);
    for (let i = 0; i < 2; i++) box(root, 0.6, 0.5, 0.12, ["#c97f5f", "#6d8fb4"][i], -w * 0.18 + i * w * 0.36, 2.9, d / 2 + 0.22);
  } else {
    signBoard(root, def.name, w * 0.55, baseH + floorH * 0.9, d / 2 + 0.35);
  }
  // roof
  if (kind === "church" || kind === "station" || kind === "fire") {
    if (kind !== "station") gableRoof(root, w, d, eave, 1.4, style);
    else gableRoof(root, w, d, eave, 1.0, style);
  } else if (kind === "hotel" || style.kind === "museum" || kind === "theatre") {
    mansardRoof(root, w, d, eave, 2.2, style);
  } else if (style.dome) {
    hipRoof(root, w, d, eave, 1.3, style);
  } else {
    gableRoof(root, w, d, eave, 1.55, style);
  }
  if (kind !== "church") chimney(root, -w * 0.3, -d * 0.16, eave, 1.1, style);
  // flower beds at the front
  if (kind !== "station") {
    for (const sx of [-1, 1]) {
      box(root, 1.2, 0.18, 0.55, "#7c9a5f", sx * (w / 2 - 0.75), 0.09, d / 2 + 0.48);
      for (let i = 0; i < 4; i++) ball(root, 0.1, FLOWERS[(i + sx + 2) % FLOWERS.length], sx * (w / 2 - 0.75) - 0.4 + i * 0.27, 0.27, d / 2 + 0.48, 6);
    }
  }
  return root;
}

/* ---------------------------------------------------------------------
   COMMUNITY GARDENS
   --------------------------------------------------------------------- */
function treeModel(kind, s = 1, season) {
  const g = new THREE.Group();
  const rng = rand(hash(kind + s));
  const foliage = season === "autumn" ? "#c07a3f" : season === "winter" ? "#8c9a82" : season === "spring" ? "#8fbe6a" : "#6c9c58";
  if (kind === "pine") {
    cyl(g, 0.13 * s, 0.2 * s, 2.2 * s, "#6b4f38", 0, 1.1 * s, 0, 8);
    for (let i = 0; i < 4; i++) {
      cone(g, (1.15 - i * 0.18) * s, 1.3 * s, i % 2 ? "#5c8248" : "#527a42", 0, (1.6 + i * 0.7) * s, 0, 9);
    }
  } else if (kind === "willow") {
    cyl(g, 0.16 * s, 0.26 * s, 2.4 * s, "#6f5239", 0, 1.2 * s, 0, 8);
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * PI * 2;
      ball(g, 0.48 * s, foliage, Math.cos(a) * 0.6 * s, (2.25 + (i % 2) * 0.2) * s, Math.sin(a) * 0.6 * s, 8, { scale: [1.1, 1.5, 1.1] });
      cyl(g, 0.05 * s, 0.03 * s, 1.1 * s, "#5f8448", Math.cos(a) * 0.9 * s, 1.7 * s, Math.sin(a) * 0.9 * s, 5, { rz: Math.cos(a) * 0.18 });
    }
  } else if (kind === "birch") {
    cyl(g, 0.1 * s, 0.16 * s, 3.2 * s, "#eee9dd", 0, 1.6 * s, 0, 8);
    for (let i = 0; i < 5; i++) box(g, 0.2 * s, 0.07 * s, 0.02 * s, "#5b5348", 0.02 * s, (0.8 + i * 0.4) * s, 0.14 * s);
    for (let i = 0; i < 4; i++) ball(g, 0.55 * s, i % 2 ? "#9cc471" : "#8ab965", (rng() - 0.5) * 0.8 * s, (2.4 + i * 0.32) * s, (rng() - 0.5) * 0.7 * s, 8, { scale: [1, 1.15, 1] });
  } else if (kind === "blossom") {
    cyl(g, 0.14 * s, 0.22 * s, 2.2 * s, "#6b4d38", 0, 1.1 * s, 0, 8);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * PI * 2;
      ball(g, 0.5 * s, i % 2 ? "#f0b7c6" : "#f5cad5", Math.cos(a) * 0.5 * s, (2.1 + (i % 3) * 0.25) * s, Math.sin(a) * 0.5 * s, 8);
    }
  } else if (kind === "poplar") {
    cyl(g, 0.12 * s, 0.18 * s, 3.2 * s, "#6b5139", 0, 1.6 * s, 0, 8);
    ball(g, 0.65 * s, "#7fa65c", 0, 3.0 * s, 0, 9, { scale: [0.75, 2.2, 0.75] });
    ball(g, 0.45 * s, "#8db56a", 0.15 * s, 2.2 * s, 0.1 * s, 8, { scale: [0.8, 1.5, 0.8] });
  } else {
    cyl(g, 0.18 * s, 0.3 * s, 2.1 * s, "#6f5139", 0, 1.05 * s, 0, 8);
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * PI * 2;
      cyl(g, 0.07 * s, 0.12 * s, 1.2 * s, "#6f5139", Math.cos(a) * 0.35 * s, 2.0 * s, Math.sin(a) * 0.35 * s, 6, { rz: Math.cos(a) * 0.5, rx: Math.sin(a) * 0.5 });
    }
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * PI * 2;
      ball(g, (0.55 + (i % 3) * 0.1) * s, foliage, Math.cos(a) * 0.62 * s, (2.5 + (i % 3) * 0.35) * s, Math.sin(a) * 0.62 * s, 8);
    }
    ball(g, 0.65 * s, foliage, 0, 3.3 * s, 0, 9);
  }
  return g;
}

function flowerPatch(kind) {
  const g = new THREE.Group();
  const rng = rand(hash(kind));
  const colors = { tulip: ["#d95f7a", "#e8b44c", "#d989b4"], rose: ["#b84a5f", "#d76a7e"], lavender: ["#9b83c9", "#b39ad9"], sunflower: ["#e8b43c"], bluebell: ["#7f8fd6"], cart: ["#d96a7c", "#e8b44c", "#8fa9d9"] };
  const list = colors[kind] || colors.tulip;
  if (kind === "cart") {
    box(g, 1.7, 0.55, 0.95, "#9a6a45", 0, 0.5, 0);
    for (const sx of [-1, 1]) {
      torus(g, 0.38, 0.07, "#5c4636", sx * 0.7, 0.38, 0.48, { rx: PI / 2 });
      torus(g, 0.38, 0.07, "#5c4636", sx * 0.7, 0.38, -0.48, { rx: PI / 2 });
    }
    box(g, 1.5, 0.75, 0.85, "#b78a5c", 0, 0.95, 0);
    for (let i = 0; i < 12; i++) ball(g, 0.13, list[i % list.length], -0.6 + (i % 4) * 0.4, 1.3 + Math.floor(i / 4) * 0.08, -0.25 + Math.floor(i / 4) * 0.25, 6);
    return g;
  }
  const count = kind === "sunflower" ? 7 : kind === "lavender" ? 20 : 14;
  for (let i = 0; i < count; i++) {
    const x = (rng() - 0.5) * 2.2;
    const z = (rng() - 0.5) * 1.3;
    const h = kind === "sunflower" ? 1.5 + rng() * 0.5 : kind === "lavender" ? 0.8 : 0.5 + rng() * 0.35;
    cyl(g, 0.025, 0.035, h, "#5f8448", x, h / 2, z, 5);
    if (kind === "sunflower") {
      ball(g, 0.2, "#7d5b38", x, h + 0.05, z, 8);
      for (let p = 0; p < 7; p++) ball(g, 0.09, "#e8b43c", x + Math.cos(p / 7 * PI * 2) * 0.25, h + 0.05, z + Math.sin(p / 7 * PI * 2) * 0.25, 5);
    } else if (kind === "lavender") {
      ball(g, 0.09, list[i % list.length], x, h, z, 5, { scale: [0.8, 1.7, 0.8] });
    } else {
      ball(g, 0.12, list[i % list.length], x, h, z, 6);
      ball(g, 0.09, "#f4e6cf", x, h + 0.04, z, 5, { scale: [0.6, 0.6, 0.6] });
    }
    if (i % 3 === 0) ball(g, 0.16, "#6f9858", x + 0.1, h * 0.35, z, 6);
  }
  return g;
}

function bench(parent, x, z, ry = 0) {
  const g = group(parent, x, 0, z);
  g.rotation.y = ry;
  for (const sx of [-0.55, 0.55]) {
    box(g, 0.09, 0.4, 0.42, "#4f463d", sx, 0.2, 0);
    box(g, 0.09, 0.55, 0.07, "#4f463d", sx, 0.55, -0.18);
  }
  for (let i = 0; i < 3; i++) box(g, 1.4, 0.07, 0.13, "#9a6c48", 0, 0.44, -0.16 + i * 0.16);
  for (let i = 0; i < 2; i++) box(g, 1.4, 0.12, 0.06, "#9a6c48", 0, 0.62 + i * 0.17, -0.23);
  return g;
}

function lamp(parent, x, z, s = 1) {
  const g = group(parent, x, 0, z);
  cyl(g, 0.055, 0.09, 2.3 * s, "#45413a", 0, 1.15 * s, 0, 8);
  cyl(g, 0.16, 0.2, 0.12, "#45413a", 0, 0.06, 0, 10);
  box(g, 0.34, 0.38, 0.34, "#5b5145", 0, 2.4 * s, 0);
  box(g, 0.26, 0.28, 0.26, "#ffe7ad", 0, 2.4 * s, 0, { matOpts: { emissive: "#ffd98a", emissiveIntensity: 1.3 } });
  cone(g, 0.27, 0.22, "#45413a", 0, 2.68 * s, 0, 4, { ry: PI / 4 });
  ball(g, 0.05, "#45413a", 0, 2.82 * s, 0, 6);
  return g;
}

function fountain(parent, x, z, size = 2.4) {
  const g = group(parent, x, 0, z);
  cyl(g, size / 2, size / 2 + 0.08, 0.34, "#b8ad9a", 0, 0.17, 0, 22);
  cyl(g, size / 2 - 0.18, size / 2 - 0.18, 0.08, "#8fc4cf", 0, 0.38, 0, 22, { matOpts: { rough: 0.15, metal: 0.15, transparent: true, opacity: 0.9 } });
  cyl(g, 0.3, 0.38, 1.1, "#b8ad9a", 0, 0.9, 0, 12);
  cyl(g, 0.95, 0.7, 0.22, "#c8bda9", 0, 1.35, 0, 18);
  cyl(g, 0.82, 0.82, 0.05, "#8fc4cf", 0, 1.48, 0, 18, { matOpts: { transparent: true, opacity: 0.9, rough: 0.15 } });
  cyl(g, 0.1, 0.1, 0.8, "#a9d7e0", 0, 1.8, 0, 8, { matOpts: { transparent: true, opacity: 0.75 } });
  for (let i = 0; i < 7; i++) {
    const a = i / 7 * PI * 2;
    ball(g, 0.06, "#cfeaf0", Math.cos(a) * 0.5, 2.15 + (i % 2) * 0.18, Math.sin(a) * 0.5, 6, { matOpts: { transparent: true, opacity: 0.8 } });
  }
  for (let i = 0; i < 4; i++) {
    const a = i / 4 * PI * 2 + 0.4;
    box(g, 0.7, 0.3, 0.55, "#7c9a5f", Math.cos(a) * (size / 2 + 0.35), 0.15, Math.sin(a) * (size / 2 + 0.35), { ry: -a });
    for (let f = 0; f < 3; f++) ball(g, 0.09, FLOWERS[(i + f) % FLOWERS.length], Math.cos(a) * (size / 2 + 0.35) - 0.22 + f * 0.22, 0.36, Math.sin(a) * (size / 2 + 0.35), 6);
  }
  return g;
}

function buildGreen(def, style, level, rng) {
  const kind = style.kind || "green";
  const root = new THREE.Group();
  const w = def.size[0] * TILE - 0.35;
  const d = def.size[1] * TILE - 0.35;
  const grass = "#87a95d";
  box(root, w, 0.16, d, grass, 0, 0.08, 0, { r: 0.25 });
  // mown stripes
  const stripes = Math.max(2, Math.round(w / 1.2));
  for (let i = 0; i < stripes; i++) {
    if (i % 2) box(root, w * 0.46, 0.02, d * 0.9, "#90b266", -w / 2 + (w / stripes) * (i + 0.5), 0.17, 0, { r: 0.02 });
  }
  if (kind === "green") {
    // winding path
    for (let i = 0; i < 5; i++) box(root, 0.7, 0.05, 1.3, "#cdbfa7", -w * 0.25 + Math.sin(i * 0.9) * 0.5, 0.18, -d * 0.35 + i * d * 0.17, { r: 0.3, ry: Math.sin(i) * 0.25 });
    bench(root, w * 0.2, d * 0.05, 0.3);
    const t1 = treeModel("oak", 0.95); t1.position.set(-w * 0.3, 0.16, -d * 0.18); root.add(t1);
    const t2 = treeModel("blossom", 0.8); t2.position.set(w * 0.28, 0.16, -d * 0.3); root.add(t2);
    for (let i = 0; i < 8; i++) {
      const a = i / 8 * PI * 2;
      ball(root, 0.11, FLOWERS[i % FLOWERS.length], Math.cos(a) * w * 0.4, 0.28, Math.sin(a) * d * 0.4, 6);
    }
    lamp(root, -w * 0.36, d * 0.3, 0.9);
  } else if (kind === "playground") {
    const sand = group(root, 0, 0, 0);
    box(sand, w * 0.5, 0.1, d * 0.42, "#dfc99b", -w * 0.16, 0.23, d * 0.12, { r: 0.4 });
    // swing frame
    const sw = group(sand, -w * 0.16, 0.2, d * 0.12);
    for (const sx of [-1, 1]) {
      box(sw, 0.1, 1.9, 0.1, "#7c5a3e", sx * 0.85, 0.95, -0.55, { rx: 0.25 });
      box(sw, 0.1, 1.9, 0.1, "#7c5a3e", sx * 0.85, 0.95, 0.55, { rx: -0.25 });
    }
    box(sw, 2.1, 0.12, 0.12, "#7c5a3e", 0, 1.9, 0);
    for (const x of [-0.45, 0.45]) {
      box(sw, 0.04, 1.2, 0.04, "#5f5044", x, 1.25, 0);
      box(sw, 0.55, 0.08, 0.24, "#b85f51", x, 0.62, 0);
    }
    // slide
    const sl = group(root, w * 0.24, 0.2, -d * 0.15);
    for (const sx of [-0.35, 0.35]) box(sl, 0.08, 1.8, 0.08, "#7c5a3e", sx, 0.9, -0.7);
    box(sl, 0.9, 0.1, 1.7, "#c56b5a", 0, 0.9, 0, { rx: 0.42 });
    box(sl, 0.8, 0.08, 0.8, "#7c9a5f", 0, 0.12, 0.6);
    for (let i = 0; i < 3; i++) box(sl, 0.6, 0.06, 0.22, "#a98255", 0, 0.3 + i * 0.28, -0.6);
    // sand toys
    cyl(root, 0.13, 0.09, 0.22, "#d9b25e", w * 0.05, 0.3, d * 0.18, 8);
    cone(root, 0.12, 0.25, "#c76f5e", w * 0.1, 0.4, d * 0.2, 6);
    for (let i = 0; i < 3; i++) ball(root, 0.045, ["#b85f51", "#e8b44c", "#7fa9d6"][i], -w * 0.32 + i * 0.12, 0.3, d * 0.26, 5);
  } else if (kind === "fountain") {
    // A proper paved circle under the fountain, with a darker kerb ring.
    cyl(root, Math.min(w, d) * 0.46, Math.min(w, d) * 0.46, 0.07, "#b3a790", 0, 0.2, 0, 30);
    cyl(root, Math.min(w, d) * 0.42, Math.min(w, d) * 0.42, 0.05, "#d3c7b0", 0, 0.235, 0, 30);
    fountain(root, 0, 0, 2.4);
    for (const [x, z, r] of [[-w * 0.38, -d * 0.36, 0.3], [w * 0.38, -d * 0.36, -0.3], [-w * 0.38, d * 0.36, -0.2], [w * 0.38, d * 0.36, 0.2]]) bench(root, x, z, r);
    lamp(root, -w * 0.42, 0, 0.95); lamp(root, w * 0.42, 0, 0.95);
  } else if (kind === "rosegarden") {
    for (let i = 0; i < 2; i++) box(root, w * 0.95, 0.05, 0.7, "#cdbfa7", 0, 0.19, -d * 0.18 + i * d * 0.36);
    box(root, 0.7, 0.05, d * 0.95, "#cdbfa7", 0, 0.19, 0);
    for (let i = 0; i < 6; i++) {
      const gx = -w * 0.36 + (i % 3) * w * 0.36;
      const gz = i < 3 ? -d * 0.34 : d * 0.34;
      box(root, w * 0.26, 0.16, d * 0.22, "#7c9a5f", gx, 0.22, gz);
      for (let j = 0; j < 5; j++) ball(root, 0.13, j % 2 ? "#c95a70" : "#e88c9d", gx - w * 0.08 + j * w * 0.04, 0.35, gz + (j % 2 ? 0.16 : -0.16), 6);
    }
    for (const [x, z] of [[-w * 0.36, 0], [w * 0.36, 0]]) {
      for (const sx of [-1, 1]) box(root, 0.08, 2.1, 0.08, "#f1e8d6", x + sx * 0.75, 1.05, z);
      box(root, 1.6, 0.08, 0.08, "#f1e8d6", x, 2.1, z);
      for (let i = 0; i < 4; i++) ball(root, 0.14, "#c95a70", x - 0.6 + i * 0.4, 2.0, z, 6);
    }
    bench(root, 0, d * 0.32, PI);
  } else if (kind === "gazebo" || kind === "bandstand") {
    const size = kind === "gazebo" ? 1.05 : 1.3;
    cyl(root, size, size, 0.3, "#c9b79b", 0, 0.3, 0, 8);
    for (let i = 0; i < 8; i++) {
      const a = i / 8 * PI * 2;
      cyl(root, 0.07, 0.08, 2.1, "#f2ead9", Math.cos(a) * size * 0.86, 1.35, Math.sin(a) * size * 0.86, 8);
    }
    cyl(root, size * 1.03, size * 1.03, 0.08, "#f2ead9", 0, 2.4, 0, 8);
    cone(root, size * 1.2, 1.2, kind === "gazebo" ? "#7f9a74" : "#8f5d4c", 0, 3.05, 0, 8);
    ball(root, 0.12, "#d9b25e", 0, 3.7, 0, 8);
    if (kind === "bandstand") {
      for (let i = 0; i < 8; i++) {
        const a = i / 8 * PI * 2;
        box(root, 0.05, 0.55, 0.05, "#f2ead9", Math.cos(a) * size * 0.98, 2.7, Math.sin(a) * size * 0.98);
      }
      box(root, 1.4, 0.7, 0.5, "#8a5f42", 0, 0.75, -0.2);
      for (const x of [-0.4, 0.4]) ball(root, 0.18, "#c9a84e", x, 1.15, -0.2, 8);
    }
    bench(root, 0, size + 0.8, PI);
  } else if (kind === "sports") {
    box(root, w * 0.9, 0.05, d * 0.9, "#a9b57e", 0, 0.19, 0, { r: 0.1 });
    for (let i = 0; i < 9; i++) box(root, w * 0.86, 0.02, 0.06, "#f2ead9", 0, 0.22, -d * 0.3 + i * d * 0.075);
    box(root, 0.06, 0.02, d * 0.82, "#f2ead9", 0, 0.22, 0);
    for (const x of [-w * 0.4, w * 0.4]) {
      cyl(root, 0.07, 0.07, 1.7, "#5f5147", x, 0.95, 0);
      box(root, 0.06, 0.8, 0.9, "#f2ead9", x, 1.2, 0);
    }
    for (let i = 0; i < 10; i++) box(root, w * 0.9, 0.03, 0.03, "#f2ead9", 0, 0.23 + 0.0, 0);
    for (const [x, z] of [[-w * 0.32, -d * 0.3], [w * 0.32, -d * 0.3], [-w * 0.32, d * 0.3], [w * 0.32, d * 0.3]]) lamp(root, x, z, 0.65);
  } else if (kind === "picnic") {
    for (const [x, z] of [[-w * 0.2, -d * 0.22], [w * 0.24, -d * 0.05], [-w * 0.05, d * 0.24]]) {
      box(root, 1.4, 0.1, 0.7, "#9a6c48", x, 0.55, z);
      for (const sx of [-0.55, 0.55]) box(root, 0.1, 0.55, 0.55, "#6b4f38", x + sx, 0.28, z);
      for (const sz of [-0.65, 0.65]) box(root, 1.3, 0.08, 0.32, "#9a6c48", x, 0.35, z + sz);
      box(root, 0.65, 0.05, 0.5, "#d9c4a1", x, 0.63, z);
      ball(root, 0.09, "#c76f5e", x - 0.15, 0.7, z, 6);
    }
    for (let i = 0; i < 3; i++) {
      const t = treeModel(i === 1 ? "blossom" : "oak", 0.8 + i * 0.1);
      t.position.set(-w * 0.38 + i * w * 0.33, 0.17, i === 1 ? d * 0.32 : -d * 0.34);
      root.add(t);
    }
  }
  return root;
}

/* ---------------------------------------------------------------------
   DECORATION builders
   --------------------------------------------------------------------- */
function buildStreet(def, style) {
  const kind = style.kind;
  const root = new THREE.Group();
  if (kind === "lamp") return lamp(root, 0, 0, 1);
  if (kind === "bench") return bench(root, 0, 0, 0);
  if (kind === "bike") {
    for (const sx of [-0.45, 0.45]) {
      torus(root, 0.3, 0.045, "#3f3a33", sx, 0.33, 0.15, { rx: PI / 2 });
      torus(root, 0.3, 0.045, "#3f3a33", sx, 0.33, -0.15, { rx: PI / 2 });
    }
    box(root, 0.9, 0.05, 0.05, "#8d5f4b", 0, 0.6, 0);
    box(root, 0.05, 0.5, 0.05, "#8d5f4b", -0.45, 0.45, 0);
    box(root, 0.05, 0.5, 0.05, "#8d5f4b", 0.4, 0.45, 0);
    box(root, 0.06, 0.06, 0.55, "#6a5747", 0.55, 0.95, 0);
    box(root, 0.35, 0.06, 0.12, "#6a5747", 0.55, 1.0, 0.18);
    for (let i = 0; i < 5; i++) box(root, 0.02, 0.7, 0.02, "#59615a", -0.9 + i * 0.45, 0.38, -0.45);
    return root;
  }
  if (kind === "mailbox") {
    cyl(root, 0.28, 0.32, 0.2, "#8f8475", 0, 0.1, 0, 10);
    cyl(root, 0.26, 0.26, 1.2, "#b6453f", 0, 0.72, 0, 12);
    ball(root, 0.26, "#b6453f", 0, 1.32, 0, 12, { scale: [1, 0.6, 1] });
    box(root, 0.4, 0.05, 0.05, "#3b2f2a", 0, 1.15, 0.25);
    box(root, 0.34, 0.22, 0.05, "#f2e6d4", 0, 0.9, 0.25);
    return root;
  }
  if (kind === "notice") {
    for (const sx of [-0.5, 0.5]) box(root, 0.1, 1.7, 0.1, "#7c5a3e", sx, 0.85, 0);
    box(root, 1.5, 0.95, 0.1, "#8a6446", 0, 1.35, 0);
    for (let i = 0; i < 3; i++) {
      box(root, 0.38, 0.28, 0.02, "#f4ead6", -0.45 + i * 0.45, 1.35 + (i % 2) * 0.2, 0.07, { rz: i % 2 ? 0.05 : -0.04 });
    }
    return root;
  }
  if (kind === "bus") {
    box(root, 2.2, 0.12, 0.9, "#5f6b63", 0, 2.1, 0);
    for (const sx of [-1, 1]) box(root, 0.1, 2.1, 0.1, "#5f6b63", sx * 0.95, 1.05, 0.35);
    box(root, 1.9, 0.08, 0.85, "#9fbdba", 0, 1.0, 0.3, { matOpts: { transparent: true, opacity: 0.35 } });
    box(root, 1.9, 0.5, 0.08, "#9fbdba", 0, 1.7, 0.4, { matOpts: { transparent: true, opacity: 0.35 } });
    box(root, 1.9, 0.08, 0.6, "#7c5a3e", 0, 0.55, 0.1);
    box(root, 0.45, 0.7, 0.05, "#f4ead6", -0.4, 1.4, 0.39);
    return root;
  }
  if (kind === "table") {
    cyl(root, 0.4, 0.4, 0.06, "#f1e8d6", 0, 0.72, 0, 12);
    cyl(root, 0.05, 0.05, 0.7, "#5f5044", 0, 0.36, 0, 8);
    for (const [sx, sz] of [[-0.7, 0], [0.7, 0]]) {
      box(root, 0.28, 0.06, 0.28, "#8f6b4c", sx, 0.48, sz);
      box(root, 0.26, 0.45, 0.05, "#8f6b4c", sx, 0.66, sz + 0.12);
      for (const lx of [-0.1, 0.1]) for (const lz of [-0.1, 0.1]) box(root, 0.04, 0.46, 0.04, "#5f5044", sx + lx, 0.23, sz + lz);
    }
    cyl(root, 0.04, 0.04, 0.18, "#a9d7d0", 0, 0.8, 0, 6);
    ball(root, 0.06, "#d96a7c", 0, 0.92, 0, 5);
    return root;
  }
  if (kind === "stall") {
    for (const sx of [-0.9, 0.9]) {
      box(root, 0.1, 1.8, 0.1, "#7c5a3e", sx, 0.9, -0.7);
      box(root, 0.1, 1.8, 0.1, "#7c5a3e", sx, 0.9, 0.7);
    }
    box(root, 2.1, 1.0, 0.85, "#a98255", 0, 0.72, 0);
    for (let i = 0; i < 6; i++) {
      const x = -1.05 + i * 0.42;
      box(root, 0.4, 0.08, 1.9, i % 2 ? "#f2e6d4" : "#c76f5e", x, 1.95, 0, { rx: -0.15 });
    }
    for (let i = 0; i < 6; i++) ball(root, 0.1, ["#c95a4f", "#d9a94f", "#87a35a"][i % 3], -0.6 + i * 0.22, 0.46, 0.15, 6);
    return root;
  }
  return root;
}

function buildGarden(def, style) {
  const kind = style.kind;
  const root = new THREE.Group();
  if (kind === "hedge") {
    for (let i = 0; i < 3; i++) box(root, 2.1, 0.8, 0.7, i % 2 ? "#5f8448" : "#6d9254", 0, 0.4, -0.6 + i * 0.6, { r: 0.18 });
    for (let i = 0; i < 6; i++) ball(root, 0.25, "#7da263", -0.9 + i * 0.36, 0.85, 0, 7);
    return root;
  }
  if (kind === "fence") {
    for (let i = 0; i < 7; i++) box(root, 0.12, 0.95, 0.08, "#f1e8d6", -1.2 + i * 0.4, 0.48, 0, { ry: i % 3 === 0 ? 0.03 : 0 });
    for (const y of [0.35, 0.7]) box(root, 2.6, 0.09, 0.06, "#e4d8c2", 0, y, 0);
    return root;
  }
  if (kind === "wall") {
    const rng = rand(7);
    for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) {
      box(root, 0.85, 0.35, 0.5, ["#b7ab96", "#c3b7a0", "#a99d89"][Math.floor(rng() * 3)], -0.9 + i * 0.9 + (j % 2) * 0.15, 0.2 + j * 0.34, 0.02, { ry: (rng() - 0.5) * 0.06 });
    }
    for (let i = 0; i < 4; i++) ball(root, 0.14, "#7c9a5f", -1.0 + i * 0.6, 0.8, 0.1, 5);
    return root;
  }
  if (kind === "pergola") {
    for (const sx of [-0.85, 0.85]) for (const sz of [-0.85, 0.85]) box(root, 0.12, 2.3, 0.12, "#f1e8d6", sx, 1.15, sz);
    for (let i = 0; i < 5; i++) box(root, 2.0, 0.1, 0.12, "#f1e8d6", 0, 2.35, -0.9 + i * 0.45);
    for (let i = 0; i < 3; i++) box(root, 0.12, 0.1, 2.0, "#f1e8d6", -0.85 + i * 0.85, 2.42, 0);
    for (let i = 0; i < 7; i++) ball(root, 0.16, i % 2 ? "#c95a70" : "#e88c9d", -0.9 + i * 0.3, 2.3, 0.75, 6);
    for (let i = 0; i < 4; i++) ball(root, 0.2, "#6d9254", 0.85, 1.8 - i * 0.32, -0.5 + i * 0.3, 6);
    bench(root, 0, 0.1, PI);
    return root;
  }
  if (kind === "pots") {
    for (let i = 0; i < 3; i++) {
      cyl(root, 0.22, 0.16, 0.42, "#b5714f", -0.45 + i * 0.45, 0.21, 0, 10);
      ball(root, 0.26, "#6d9254", -0.45 + i * 0.45, 0.6, 0, 7);
      for (let j = 0; j < 3; j++) ball(root, 0.08, FLOWERS[(i + j) % FLOWERS.length], -0.45 + i * 0.45 + (j - 1) * 0.13, 0.75, 0.1, 5);
    }
    return root;
  }
  if (kind === "birdbath") {
    cyl(root, 0.08, 0.13, 0.8, "#b7ab96", 0, 0.4, 0, 8);
    cyl(root, 0.34, 0.3, 0.12, "#c3b7a0", 0, 0.85, 0, 12);
    cyl(root, 0.28, 0.28, 0.03, "#9fc9d2", 0, 0.92, 0, 12, { matOpts: { transparent: true, opacity: 0.85, rough: 0.1 } });
    ball(root, 0.09, "#b85f51", 0.05, 1.05, 0.1, 6);
    return root;
  }
  return root;
}

function buildWater(def, style) {
  const kind = style.kind;
  const root = new THREE.Group();
  if (kind === "pond") {
    box(root, 4.5, 0.16, 2.8, "#7c9a5f", 0, 0.08, 0, { r: 0.5 });
    const water = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 0.06, 20), mat("#8fc4cf", { rough: 0.12, metal: 0.2, transparent: true, opacity: 0.88 }));
    water.scale.set(2.3, 1, 1.2); water.position.y = 0.2; root.add(water);
    for (let i = 0; i < 10; i++) {
      const a = i / 10 * PI * 2;
      ball(root, 0.18 + (i % 3) * 0.06, "#a99d89", Math.cos(a) * 1.9, 0.16, Math.sin(a) * 1.1, 6, { scale: [1, 0.6, 1] });
    }
    for (let i = 0; i < 5; i++) {
      const x = -1.1 + i * 0.55, z = (i % 2 ? 0.3 : -0.3);
      cyl(root, 0.16, 0.16, 0.03, "#6d9254", x, 0.24, z, 10);
      ball(root, 0.08, "#f2e6d4", x + 0.08, 0.28, z, 6);
    }
    for (let i = 0; i < 7; i++) cyl(root, 0.03, 0.03, 0.8 + (i % 3) * 0.2, "#6d9254", -2 + i * 0.6, 0.4, 1.15, 5, { rz: (i % 2 ? 1 : -1) * 0.08 });
    box(root, 0.7, 0.1, 0.9, "#9a7448", 1.7, 0.3, 0.75);
    return root;
  }
  if (kind === "fountain") return fountain(root, 0, 0, 1.5);
  if (kind === "well") {
    cyl(root, 0.55, 0.62, 0.85, "#b7ab96", 0, 0.42, 0, 14);
    cyl(root, 0.4, 0.4, 0.08, "#7f9ea6", 0, 0.82, 0, 12);
    for (const sx of [-0.55, 0.55]) box(root, 0.1, 1.6, 0.1, "#8a6446", sx, 1.2, 0);
    box(root, 1.3, 0.12, 0.7, "#8a6446", 0, 1.95, 0, { rx: -0.2 });
    for (const sx of [-0.55, 0.55]) box(root, 0.08, 0.1, 0.8, "#8a6446", sx, 1.0, 0);
    cyl(root, 0.05, 0.05, 0.9, "#5f5044", 0, 1.35, 0, 8, { rz: PI / 2 });
    box(root, 0.15, 0.24, 0.15, "#7a5a3e", 0.2, 1.0, 0);
    return root;
  }
  return root;
}

function buildPlay(def, style) {
  const kind = style.kind;
  const root = new THREE.Group();
  if (kind === "swing") {
    for (const sx of [-0.85, 0.85]) {
      box(root, 0.1, 1.9, 0.1, "#7c5a3e", sx, 0.95, -0.55, { rx: 0.25 });
      box(root, 0.1, 1.9, 0.1, "#7c5a3e", sx, 0.95, 0.55, { rx: -0.25 });
    }
    box(root, 2.1, 0.12, 0.12, "#7c5a3e", 0, 1.9, 0);
    for (const x of [-0.45, 0.45]) {
      box(root, 0.04, 1.2, 0.04, "#5f5044", x, 1.25, 0);
      box(root, 0.55, 0.08, 0.24, "#b85f51", x, 0.62, 0);
    }
    return root;
  }
  if (kind === "sand") {
    box(root, 2.2, 0.14, 1.2, "#dfc99b", 0, 0.09, 0, { r: 0.3 });
    cyl(root, 0.13, 0.09, 0.22, "#d9b25e", -0.4, 0.25, 0.1, 8);
    cone(root, 0.12, 0.25, "#c76f5e", -0.2, 0.33, 0.15, 6);
    for (let i = 0; i < 4; i++) ball(root, 0.05, ["#b85f51", "#e8b44c", "#7fa9d6", "#f2e6d4"][i], 0.3 + i * 0.12, 0.2, -0.1 + (i % 2) * 0.2, 5);
    return root;
  }
  if (kind === "seesaw") {
    box(root, 0.35, 0.5, 0.35, "#6b4f38", 0, 0.25, 0);
    box(root, 2.2, 0.08, 0.24, "#c76f5e", 0, 0.55, 0, { rz: 0.08 });
    for (const sx of [-0.9, 0.9]) box(root, 0.2, 0.06, 0.2, "#5f5044", sx, 0.65 + sx * 0.08, 0);
    return root;
  }
  if (kind === "slide") {
    for (const sz of [-0.7, 0.7]) {
      box(root, 0.08, 1.8, 0.08, "#7c5a3e", -0.4, 0.9, sz);
      box(root, 0.08, 1.8, 0.08, "#7c5a3e", 0.4, 0.9, sz);
    }
    box(root, 0.9, 0.9, 0.1, "#7c5a3e", 0, 1.4, 0.7);
    box(root, 0.9, 0.1, 1.8, "#c56b5a", 0, 0.85, 0, { rx: 0.5 });
    for (let i = 0; i < 4; i++) box(root, 0.6, 0.06, 0.2, "#a98255", 0, 0.3 + i * 0.28, -0.6);
    return root;
  }
  return root;
}

function buildDecorModel(def, style) {
  const kind = style.kind;
  const root = new THREE.Group();
  if (kind === "statue") {
    cyl(root, 0.8, 0.9, 0.4, "#b7ab96", 0, 0.2, 0, 8);
    box(root, 0.75, 0.9, 0.75, "#c3b7a0", 0, 0.85, 0);
    cyl(root, 0.22, 0.3, 1.5, "#a99d89", 0, 2.05, 0, 8);
    ball(root, 0.26, "#a99d89", 0, 2.95, 0, 10);
    box(root, 0.16, 1.0, 0.16, "#a99d89", 0.3, 2.25, 0, { rz: -0.35 });
    box(root, 0.5, 0.12, 0.3, "#a99d89", 0.35, 1.8, 0, { rz: -0.25 });
    return root;
  }
  if (kind === "dovecote") {
    cyl(root, 0.6, 0.68, 1.8, "#e7dcc7", 0, 0.9, 0, 10);
    cone(root, 0.85, 0.9, "#8a6446", 0, 2.2, 0, 10);
    ball(root, 0.08, "#5f5044", 0, 2.7, 0, 6);
    for (let i = 0; i < 5; i++) {
      const a = i / 5 * PI * 2;
      box(root, 0.14, 0.18, 0.06, "#5f5044", Math.cos(a) * 0.62, 1.7, Math.sin(a) * 0.62, { ry: -a });
    }
    return root;
  }
  if (kind === "laundry") {
    for (const sx of [-0.9, 0.9]) {
      cyl(root, 0.05, 0.07, 1.9, "#7c5a3e", sx, 0.95, 0, 8);
      box(root, 1.0, 0.06, 0.06, "#7c5a3e", sx * 0.5, 1.7, 0);
    }
    for (let i = 0; i < 4; i++) {
      const x = -0.55 + i * 0.38;
      box(root, 0.3, 0.5 + (i % 2) * 0.2, 0.02, ["#f2e6d4", "#c7d9dd", "#e4c2b8", "#f2e6d4"][i], x, 1.45, 0, { rz: 0.04 });
    }
    return root;
  }
  return root;
}

/* ---------------------------------------------------------------------
   Public entry point
   --------------------------------------------------------------------- */
export function buildObject(def, opts = {}) {
  const level = Math.max(1, opts.level || 1);
  const variant = opts.variant || 0;
  const season = opts.season || "summer";
  const style = styleOf(def, level, variant);
  const seed = hash(def.id + "|" + level + "|" + variant);
  const rng = rand(seed);
  let root;
  if (def.model === "house") root = buildHouse(def, style, level, rng);
  else if (def.model === "shop") root = buildShop(def, style, level, rng);
  else if (def.model === "civic") root = buildCivic(def, style, level, rng);
  else if (def.model === "green") root = buildGreen(def, style, level, rng);
  else if (def.model === "tree") {
    root = new THREE.Group();
    const t = treeModel(style.kind, style.s || 1, season); root.add(t);
  } else if (def.model === "flower") {
    root = new THREE.Group();
    root.add(flowerPatch(style.kind));
  } else if (def.model === "street") root = buildStreet(def, style);
  else if (def.model === "garden") root = buildGarden(def, style);
  else if (def.model === "water") root = buildWater(def, style);
  else if (def.model === "play") root = buildPlay(def, style);
  else root = buildDecorModel(def, style);
  root.userData.defId = def.id;
  root.userData.size = def.size;
  mergeStatic(root);
  root.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return root;
}

/* ---------------------------------------------------------------------
   Roads — auto-tiled pieces with pavements, bridges and crossings.
   mask bits: 1 north, 2 east, 4 south, 8 west
   --------------------------------------------------------------------- */
export function buildRoadTile(kind, mask, tile = TILE) {
  const root = new THREE.Group();
  const surfaceMat = kind === "path" ? paveMat() : cobbleMat();
  if (kind === "plaza") {
    box(root, tile, 0.1, tile, paveMat(), 0, 0.05, 0, { r: 0.04 });
    for (let i = 0; i < 3; i++) box(root, tile, 0.02, 0.06, "#c1b6a2", 0, 0.12, -tile * 0.3 + i * tile * 0.3);
    return root;
  }
  const center = kind === "path" ? 1.05 : 2.28;
  const armW = kind === "path" ? 1.05 : 2.28;
  const pavement = kind === "road" || kind === "crossing" || kind === "bridge";
  const baseY = kind === "bridge" ? 0.42 : 0.03;
  if (kind === "path") box(root, center + 0.3, 0.06, center + 0.3, "#9a927f", 0, baseY + 0.015, 0, { r: 0.1 });
  if (pavement) box(root, center + 0.5, 0.09, center + 0.5, paveMat(), 0, baseY + 0.005, 0, { r: 0.1 });
  box(root, center, 0.09, center, surfaceMat, 0, baseY + 0.06, 0, { r: 0.08 });
  for (const bit of [1, 2, 4, 8]) {
    if (!(mask & bit)) continue;
    const north = bit === 1, south = bit === 4, east = bit === 2, west = bit === 8;
    const x = east ? tile / 4 : west ? -tile / 4 : 0;
    const z = south ? tile / 4 : north ? -tile / 4 : 0;
    const reach = kind === "path" ? tile / 2 + 0.42 : tile / 2 + 0.1;
    const w = east || west ? reach : armW;
    const d = north || south ? reach : armW;
    if (kind === "path") {
      const bw = east || west ? reach + 0.04 : armW + 0.3;
      const bd = north || south ? reach + 0.04 : armW + 0.3;
      box(root, bw, 0.06, bd, "#9a927f", x, baseY + 0.015, z, { r: 0.1 });
    }
    if (pavement) {
      const pw = east || west ? tile / 2 + 0.3 : armW + 0.5;
      const pd = north || south ? tile / 2 + 0.3 : armW + 0.5;
      box(root, pw, 0.09, pd, paveMat(), x, baseY + 0.005, z, { r: 0.08 });
    }
    box(root, w, 0.09, d, surfaceMat, x, baseY + 0.06, z, { r: 0.08 });
  }
  if (kind === "crossing") {
    for (let i = 0; i < 5; i++) box(root, 0.3, 0.02, 2.1, "#f0e8d7", -1.1 + i * 0.55, 0.13, 0, { r: 0.01 });
  }
  if (kind === "bridge") {
    // stone sides + railings along the open edges
    const alongZ = (mask & 1 || mask & 4);
    const sideX = alongZ ? tile / 2 : 0;
    const sideZ = alongZ ? 0 : tile / 2;
    for (const side of [-1, 1]) {
      const sx = alongZ ? side * (tile / 2 - 0.08) : 0;
      const sz = alongZ ? 0 : side * (tile / 2 - 0.08);
      const len = alongZ ? tile : tile;
      box(root, alongZ ? 0.16 : len, 0.22, alongZ ? len : 0.16, "#b7ab96", sx, 0.48, sz);
      for (let i = 0; i < 5; i++) {
        const t = -tile / 2 + 0.35 + i * (tile - 0.7) / 4;
        const px = alongZ ? sx : t;
        const pz = alongZ ? t : sz;
        box(root, 0.08, 0.6, 0.08, "#8a6446", px, 0.82, pz);
      }
      box(root, alongZ ? 0.1 : tile, 0.08, alongZ ? tile : 0.1, "#8a6446", sx, 1.1, sz);
    }
    // arches underneath
    for (const t of [-tile * 0.25, tile * 0.25]) {
      cyl(root, 0.35, 0.35, 0.14, "#9d9282", alongZ ? 0 : t, 0.22, alongZ ? t : 0, 10, { rx: PI / 2, rz: PI / 2 });
    }
  }
  return root;
}

/* ---------------------------------------------------------------------
   Residents — chunky, cheerful villagers with separately animated limbs
   --------------------------------------------------------------------- */
const SKIN = ["#f0c9a8", "#e2b08a", "#c98d63", "#a56f4b", "#8a5a3d", "#f5d7bc"];
const HAIR = ["#4a3527", "#7a4f33", "#c08a4e", "#2f2a26", "#a35f3f", "#d9b98a"];
const COAT = ["#b85f51", "#6f9077", "#5f7f9a", "#c19a55", "#8a6f9f", "#d0786e", "#7d9b8a", "#a76b4d", "#567a6b", "#d9a25e"];
const TROUSER = ["#4f5a63", "#5d4b3f", "#3f4b52", "#6b5b4b", "#4a4a55"];

export function createResident(look = {}) {
  const root = new THREE.Group();
  const seed = hash(JSON.stringify(look) + Math.random());
  const rng = rand(seed);
  const skin = look.skin || SKIN[Math.floor(rng() * SKIN.length)];
  const hair = look.hair || HAIR[Math.floor(rng() * HAIR.length)];
  const coat = look.coat || COAT[Math.floor(rng() * COAT.length)];
  const trouser = look.trouser || TROUSER[Math.floor(rng() * TROUSER.length)];
  const scale = 0.9 + rng() * 0.12;
  root.scale.setScalar(scale);
  // legs
  const legL = new THREE.Group(); legL.position.set(-0.13, 0.62, 0);
  const legR = new THREE.Group(); legR.position.set(0.13, 0.62, 0);
  for (const [leg, x] of [[legL, -0.13], [legR, 0.13]]) {
    const m = box(leg, 0.17, 0.6, 0.2, trouser, 0, -0.3, 0);
    m.castShadow = true;
    root.add(leg);
  }
  // body
  box(root, 0.46, 0.62, 0.28, coat, 0, 0.9, 0);
  box(root, 0.5, 0.16, 0.3, rng() > 0.5 ? "#f2e6d4" : coat, 0, 1.18, 0);
  // arms
  const armL = new THREE.Group(); armL.position.set(-0.28, 1.14, 0);
  const armR = new THREE.Group(); armR.position.set(0.28, 1.14, 0);
  for (const arm of [armL, armR]) {
    box(arm, 0.12, 0.55, 0.14, coat, 0, -0.25, 0);
    ball(arm, 0.075, skin, 0, -0.55, 0, 6);
    root.add(arm);
  }
  // head
  ball(root, 0.27, skin, 0, 1.55, 0, 12);
  ball(root, 0.28, hair, 0, 1.63, -0.02, 10, { scale: [1.02, 0.7, 1.02] });
  ball(root, 0.1, "#3a2d26", 0, 1.58, 0.27, 6);
  if (rng() > 0.55) {
    const hat = rng() > 0.5 ? "cap" : "beanie";
    if (hat === "cap") {
      cyl(root, 0.28, 0.28, 0.09, "#5f6b63", 0, 1.78, 0, 12);
      box(root, 0.3, 0.05, 0.24, "#5f6b63", 0, 1.76, 0.24);
    } else {
      ball(root, 0.28, "#b85f51", 0, 1.74, 0, 10, { scale: [1, 0.7, 1] });
      ball(root, 0.07, "#f2e6d4", 0, 1.9, 0, 6);
    }
  }
  if (rng() > 0.7) box(root, 0.18, 0.3, 0.1, "#8a6446", 0.3, 0.85, 0.12);
  root.userData.limbs = { legL, legR, armL, armR };
  root.userData.look = { skin, hair, coat, trouser };
  root.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return root;
}

export function animateResident(root, phase, speed) {
  const limbs = root.userData.limbs;
  if (!limbs) return;
  const swing = Math.sin(phase) * Math.min(0.7, speed * 0.12);
  limbs.legL.rotation.x = swing;
  limbs.legR.rotation.x = -swing;
  limbs.armL.rotation.x = -swing * 0.8;
  limbs.armR.rotation.x = swing * 0.8;
  root.position.y = Math.abs(Math.sin(phase * 2)) * 0.035;
}
