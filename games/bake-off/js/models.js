/* =====================================================================
   BAKE OFF! — everything you can see is built here
   Cakes, cupcakes, cookies, donuts, pancakes, waffles, brownies,
   macarons, cheesecakes, every ingredient jar, every topping, the chef
   and the kitchen furniture. No image stand-ins anywhere.
   ===================================================================== */
import * as THREE from "three";
import { RoundedBoxGeometry } from "../../../vendor/three/RoundedBoxGeometry.js";
import { recipeById, frostingById, plateById, toppingById, INGREDIENTS } from "./data.js";

/* ---------------------------------------------------------------------
   Shared materials & primitives
   --------------------------------------------------------------------- */
const materialCache = new Map();
export function mat(color, opts = {}) {
  const key = color + "|" + JSON.stringify(opts);
  if (materialCache.has(key)) return materialCache.get(key);
  const params = {
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
  };
  const material = opts.physical
    ? new THREE.MeshPhysicalMaterial({ ...params, clearcoat: opts.clearcoat !== undefined ? opts.clearcoat : 0.45, clearcoatRoughness: 0.35 })
    : new THREE.MeshStandardMaterial(params);
  materialCache.set(key, material);
  return material;
}
export const cream = (color, opts = {}) => mat(color, { rough: 0.55, physical: true, clearcoat: 0.25, ...opts });
export const chocolateMat = (color) => mat(color, { rough: 0.42, physical: true, clearcoat: 0.6 });
export const metal = (color = "#c9b48d") => mat(color, { rough: 0.28, metal: 0.82 });
export const glass = () => mat("#dfeef2", { rough: 0.1, metal: 0.06, transparent: true, opacity: 0.3, depthWrite: false });
export const emissive = (color, strength = 1.4) => mat(color, { emissive: color, emissiveIntensity: strength, rough: 0.4 });

const geoCache = new Map();
export function rbGeo(w, h, d, r = 0.04) {
  const key = [w, h, d, r].map((n) => (+n).toFixed(3)).join("|");
  if (!geoCache.has(key)) {
    const radius = Math.min(r, w / 2 - 0.001, h / 2 - 0.001, d / 2 - 0.001);
    geoCache.set(key, new RoundedBoxGeometry(w, h, d, 4, Math.max(0.001, radius)));
  }
  return geoCache.get(key);
}

export function box(parent, w, h, d, color, x = 0, y = 0, z = 0, opts = {}) {
  const mesh = new THREE.Mesh(rbGeo(w, h, d, opts.r !== undefined ? opts.r : 0.03), typeof color === "string" ? mat(color, opts.matOpts || {}) : color);
  mesh.position.set(x, y, z);
  mesh.rotation.set(opts.rx || 0, opts.ry || 0, opts.rz || 0);
  parent.add(mesh);
  return mesh;
}
export function cyl(parent, rt, rb, h, color, x = 0, y = 0, z = 0, seg = 26, opts = {}) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg, 1, !!opts.open, opts.thetaStart || 0, opts.thetaLength || Math.PI * 2), typeof color === "string" ? mat(color, opts.matOpts || {}) : color);
  mesh.position.set(x, y, z);
  mesh.rotation.set(opts.rx || 0, opts.ry || 0, opts.rz || 0);
  parent.add(mesh);
  return mesh;
}
export function ball(parent, r, color, x = 0, y = 0, z = 0, seg = 18, scale) {
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(r, seg, Math.max(8, Math.round(seg * 0.7))), typeof color === "string" ? mat(color) : color);
  mesh.position.set(x, y, z);
  if (scale) mesh.scale.set(scale[0], scale[1], scale[2]);
  parent.add(mesh);
  return mesh;
}
export function cone(parent, r, h, color, x = 0, y = 0, z = 0, seg = 16, opts = {}) {
  const mesh = new THREE.Mesh(new THREE.ConeGeometry(r, h, seg, 1, !!opts.open), typeof color === "string" ? mat(color) : color);
  mesh.position.set(x, y, z);
  mesh.rotation.set(opts.rx || 0, opts.ry || 0, opts.rz || 0);
  parent.add(mesh);
  return mesh;
}
export function torus(parent, r, tube, color, x = 0, y = 0, z = 0, opts = {}) {
  const mesh = new THREE.Mesh(new THREE.TorusGeometry(r, tube, 10, 30, opts.arc || Math.PI * 2), typeof color === "string" ? mat(color) : color);
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
export function lathe(parent, points, color, seg = 30, opts = {}) {
  const mesh = new THREE.Mesh(
    new THREE.LatheGeometry(points.map(([r, y]) => new THREE.Vector2(Math.max(0.0001, r), y)), seg),
    typeof color === "string" ? mat(color, opts.matOpts || {}) : color
  );
  parent.add(mesh);
  return mesh;
}

/* ---------------------------------------------------------------------
   Canvas textures: messages, labels, tiles
   --------------------------------------------------------------------- */
export function textTexture(lines, opts = {}) {
  const w = opts.w || 512, h = opts.h || 256;
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  const x = c.getContext("2d");
  if (opts.bg) { x.fillStyle = opts.bg; x.fillRect(0, 0, w, h); }
  if (opts.glow) {
    const g = x.createRadialGradient(w / 2, h / 2, 4, w / 2, h / 2, w * 0.6);
    g.addColorStop(0, opts.glow); g.addColorStop(1, "rgba(255,255,255,0)");
    x.fillStyle = g; x.fillRect(0, 0, w, h);
  }
  x.fillStyle = opts.color || "#5a3b3b";
  x.textAlign = "center";
  x.textBaseline = "middle";
  const list = Array.isArray(lines) ? lines : [lines];
  const size = opts.size || Math.min(w / 9, h / (list.length + 0.9));
  x.font = `${opts.weight || 700} ${size}px ${opts.font || "Georgia, 'Times New Roman', serif"}`;
  if (opts.shadow) { x.shadowColor = opts.shadow; x.shadowBlur = size * 0.22; }
  list.forEach((line, i) => {
    x.save();
    if (opts.stroke) { x.lineWidth = size * 0.09; x.strokeStyle = opts.stroke; x.strokeText(line, w / 2, h / 2 + (i - (list.length - 1) / 2) * size * 1.18); }
    x.fillText(line, w / 2, h / 2 + (i - (list.length - 1) / 2) * size * 1.18);
    x.restore();
  });
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

export function woodTexture(opts = {}) {
  const w = 512, h = 512;
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  const x = c.getContext("2d");
  x.fillStyle = opts.base || "#d8a970";
  x.fillRect(0, 0, w, h);
  for (let i = 0; i < 90; i++) {
    x.strokeStyle = `rgba(${120 + Math.random() * 40},${75 + Math.random() * 30},${40 + Math.random() * 20},${0.03 + Math.random() * 0.07})`;
    x.lineWidth = 1 + Math.random() * 3;
    x.beginPath();
    const y = Math.random() * h;
    for (let px = 0; px <= w; px += 32) x.lineTo(px, y + Math.sin(px * 0.02 + i) * 5);
    x.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

export function tileTexture(base = "#f8e6dc", line = "#efd3c6") {
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const x = c.getContext("2d");
  x.fillStyle = base; x.fillRect(0, 0, 256, 256);
  x.strokeStyle = line; x.lineWidth = 4;
  for (let i = 0; i <= 256; i += 64) {
    x.beginPath(); x.moveTo(i, 0); x.lineTo(i, 256); x.stroke();
    x.beginPath(); x.moveTo(0, i); x.lineTo(256, i); x.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(3, 1.6);
  return tex;
}

/* ---------------------------------------------------------------------
   Decorations: each topping has its own little model
   --------------------------------------------------------------------- */
export function buildTopping(id, scale = 1) {
  const g = new THREE.Group();
  const def = toppingById(id);
  switch (def.model) {
    case "strawberry": {
      const body = ball(g, 0.075, "#d93a54", 0, 0.075, 0, 14, [1, 1.22, 1]);
      body.material = mat("#d93a54", { rough: 0.35, physical: true, clearcoat: 0.5 });
      for (let i = 0; i < 12; i++) {
        const a = i * 2.4, y = 0.035 + (i % 4) * 0.038;
        ball(g, 0.007, "#f6dfa0", Math.cos(a) * 0.062, y, Math.sin(a) * 0.062, 5);
      }
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        const leaf = box(g, 0.032, 0.005, 0.07, "#5f8f4a", Math.cos(a) * 0.045, 0.157, Math.sin(a) * 0.045, { r: 0.004, matOpts: { rough: 0.6 } });
        leaf.rotation.y = -a;
        leaf.rotation.x = -0.3;
      }
      break;
    }
    case "raspberry": {
      for (let i = 0; i < 14; i++) {
        const a = (i / 14) * Math.PI * 2, r = i % 3 === 0 ? 0.032 : 0.052;
        ball(g, 0.026, "#a8244b", Math.cos(a) * r, 0.03 + (i % 3) * 0.026, Math.sin(a) * r, 8);
      }
      ball(g, 0.03, "#c23a63", 0, 0.09, 0, 10);
      break;
    }
    case "blueberry": {
      ball(g, 0.038, "#4f5f9c", 0, 0.038, 0, 12, [1, 0.92, 1]);
      torus(g, 0.014, 0.004, "#38446f", 0, 0.068, 0, { rx: Math.PI / 2 });
      ball(g, 0.008, "#7b88bd", -0.012, 0.062, 0.016, 6);
      break;
    }
    case "cherry": {
      ball(g, 0.052, "#9e1f33", 0, 0.05, 0, 14, [1, 0.94, 1]);
      const stem = cyl(g, 0.006, 0.005, 0.1, "#5b7a44", 0.02, 0.13, 0, 6);
      stem.rotation.z = 0.3;
      ball(g, 0.011, "#c73a4d", -0.028, 0.082, 0.018, 6);
      break;
    }
    case "shard": {
      for (let i = 0; i < 4; i++) {
        const shard = box(g, 0.035, 0.11, 0.012, "#43281f", Math.cos(i * 1.9) * 0.03, 0.075, Math.sin(i * 1.9) * 0.03, { r: 0.004, matOpts: { rough: 0.4, physical: true, clearcoat: 0.7 } });
        shard.rotation.set(0.2, i, 0.3 - i * 0.14);
      }
      break;
    }
    case "macaron": {
      ball(g, 0.07, "#f0b3c3", 0, 0.028, 0, 16, [1, 0.55, 1]);
      cyl(g, 0.062, 0.062, 0.018, "#fbefd8", 0, 0.05, 0, 16);
      ball(g, 0.07, "#f0b3c3", 0, 0.072, 0, 16, [1, 0.55, 1]);
      break;
    }
    case "leaf": {
      for (let i = 0; i < 3; i++) {
        const leaf = box(g, 0.05, 0.008, 0.11, "#5f9450", Math.cos(i * 2.1) * 0.03, 0.03 + i * 0.012, Math.sin(i * 2.1) * 0.03, { r: 0.006, matOpts: { rough: 0.5 } });
        leaf.rotation.set(-0.4, i * 1.2, 0.1);
      }
      break;
    }
    case "lemon": {
      cyl(g, 0.072, 0.072, 0.016, "#f4d34f", 0, 0.016, 0, 20);
      cyl(g, 0.058, 0.058, 0.018, "#f9e89b", 0, 0.024, 0, 20);
      torus(g, 0.05, 0.006, "#fff6c9", 0, 0.032, 0, { rx: Math.PI / 2 });
      for (let i = 0; i < 6; i++) {
        const wedge = box(g, 0.006, 0.004, 0.05, "#fff6cf", Math.cos(i * 1.05) * 0.018, 0.034, Math.sin(i * 1.05) * 0.018, { r: 0.002 });
        wedge.rotation.y = -i * 1.05;
      }
      break;
    }
    case "sprinkles": {
      const palette = ["#f27a9b", "#f7d05c", "#7fc4e0", "#9fd18a", "#c9a6e8", "#fbf6ea"];
      for (let i = 0; i < 16; i++) {
        const a = Math.random() * Math.PI * 2, r = Math.random() * 0.09;
        const stick = box(g, 0.02, 0.008, 0.008, palette[i % palette.length], Math.cos(a) * r, 0.01 + Math.random() * 0.02, Math.sin(a) * r, { r: 0.003 });
        stick.rotation.set(Math.random(), Math.random() * 3, Math.random());
      }
      break;
    }
    case "gold": {
      for (let i = 0; i < 3; i++) {
        const flake = new THREE.Mesh(new THREE.PlaneGeometry(0.05 + i * 0.012, 0.04 + i * 0.01), mat("#e8c56d", { rough: 0.22, metal: 0.9, side: THREE.DoubleSide }));
        flake.position.set(Math.cos(i * 2.2) * 0.035, 0.02 + i * 0.012, Math.sin(i * 2.2) * 0.035);
        flake.rotation.set(-1.2 + i * 0.25, i * 1.4, 0);
        g.add(flake);
      }
      break;
    }
    case "candle": {
      const wax = cyl(g, 0.016, 0.018, 0.2, "#fdf3e2", 0, 0.1, 0, 14, { matOpts: { rough: 0.6 } });
      for (let i = 0; i < 3; i++) {
        const stripe = torus(g, 0.017, 0.005, "#f0a3b5", 0, 0.05 + i * 0.058, 0, { rx: Math.PI / 2, arc: Math.PI * 1.6 });
        stripe.rotation.z = i * 1.1;
      }
      cyl(g, 0.003, 0.003, 0.03, "#4c3a2a", 0, 0.212, 0, 6);
      const flame = ball(g, 0.017, "#ffc46b", 0, 0.242, 0, 10, [1, 1.7, 1]);
      flame.material = emissive("#ff9d3b", 1.15);
      const glow = new THREE.PointLight(0xffc978, 0.55, 1.4, 2);
      glow.position.set(0, 0.25, 0);
      g.add(glow);
      g.userData.flame = flame;
      break;
    }
    case "star": {
      const shape = starShape(0.07, 0.032, 5);
      const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.012, bevelEnabled: true, bevelSize: 0.004, bevelThickness: 0.004, bevelSegments: 2 });
      geo.center();
      const star = new THREE.Mesh(geo, mat("#f3d47d", { rough: 0.3, metal: 0.5 }));
      star.rotation.x = -Math.PI / 2;
      star.position.y = 0.012;
      g.add(star);
      break;
    }
    case "marshmallow": {
      const m = box(g, 0.06, 0.055, 0.06, "#fdf7f0", 0, 0.028, 0, { r: 0.018, matOpts: { rough: 0.9 } });
      m.rotation.y = 0.4;
      break;
    }
    case "wafer": {
      const roll = cyl(g, 0.032, 0.026, 0.12, "#c08f57", 0.02, 0.06, 0, 12, { matOpts: { rough: 0.65 } });
      roll.rotation.z = 0.5;
      const inner = cyl(g, 0.014, 0.014, 0.122, "#6d4630", 0.02, 0.06, 0, 8);
      inner.rotation.z = 0.5;
      break;
    }
    case "rose": {
      for (let i = 0; i < 4; i++) {
        const petal = ball(g, 0.026, i % 2 ? "#e79bad" : "#f0b4c3", Math.cos(i * 1.5) * 0.018, 0.026 + i * 0.008, Math.sin(i * 1.5) * 0.018, 10, [1, 0.8, 1]);
        petal.rotation.z = i;
      }
      ball(g, 0.016, "#d98498", 0, 0.052, 0, 8);
      break;
    }
    case "pearl": {
      for (let i = 0; i < 3; i++) {
        ball(g, 0.02 + i * 0.004, "#f3e8da", Math.cos(i * 2.1) * 0.035, 0.02, Math.sin(i * 2.1) * 0.035, 12);
      }
      break;
    }
    default:
      ball(g, 0.04, def.color || "#f5c9d4", 0, 0.04, 0, 12);
  }
  g.scale.setScalar(scale);
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}

function starShape(outer, inner, points) {
  const shape = new THREE.Shape();
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 ? inner : outer;
    const a = (i / (points * 2)) * Math.PI * 2 - Math.PI / 2;
    const x = Math.cos(a) * r, y = Math.sin(a) * r;
    if (i === 0) shape.moveTo(x, y); else shape.lineTo(x, y);
  }
  shape.closePath();
  return shape;
}

export function heartShape(scale = 1) {
  const s = new THREE.Shape();
  s.moveTo(0, -0.52 * scale);
  s.bezierCurveTo(0.62 * scale, 0.05 * scale, 0.52 * scale, 0.62 * scale, 0, 0.3 * scale);
  s.bezierCurveTo(-0.52 * scale, 0.62 * scale, -0.62 * scale, 0.05 * scale, 0, -0.52 * scale);
  return s;
}

/* ---------------------------------------------------------------------
   Plates
   --------------------------------------------------------------------- */
export function buildPlate(id, radius = 1.25) {
  const def = plateById(id);
  const g = new THREE.Group();
  if (id === "wood") {
    const board = cyl(g, radius, radius * 0.98, 0.05, "#c99b63", 0, 0.025, 0, 40, { matOpts: { rough: 0.75 } });
    board.material = mat("#c99b63", { rough: 0.7 });
    for (let i = 0; i < 3; i++) torus(g, radius * (0.55 + i * 0.15), 0.004, "#b98c55", 0, 0.052, 0, { rx: Math.PI / 2 });
  } else if (id === "glass") {
    cyl(g, radius * 0.42, radius * 0.5, 0.05, glass(), 0, 0.025, 0, 28);
    cyl(g, radius * 0.09, radius * 0.09, 0.16, glass(), 0, -0.06, 0, 20);
    cyl(g, radius * 0.62, radius * 0.66, 0.04, glass(), 0, -0.14, 0, 34);
    cyl(g, radius, radius, 0.028, "#eef4f4", 0, 0.055, 0, 40, { matOpts: { rough: 0.2, transparent: true, opacity: 0.55 } });
  } else if (id === "slate") {
    const board = box(g, radius * 2, 0.055, radius * 1.85, "#545a60", 0, 0.028, 0, { r: 0.02, matOpts: { rough: 0.85 } });
    for (let i = 0; i < 12; i++) box(g, 0.1 + Math.random() * 0.2, 0.001, 0.004, "rgba(255,255,255,0.08)", (Math.random() - 0.5) * radius * 1.6, 0.058, (Math.random() - 0.5) * radius * 1.5, { r: 0.001 });
  } else if (id === "lace") {
    cyl(g, radius, radius * 0.99, 0.02, "#fbf6ea", 0, 0.01, 0, 48);
    for (let i = 0; i < 26; i++) {
      const a = (i / 26) * Math.PI * 2;
      torus(g, 0.055, 0.008, "#efe4d0", Math.cos(a) * radius * 0.92, 0.014, Math.sin(a) * radius * 0.92, { rx: Math.PI / 2 });
    }
  } else {
    const lift = 0.055;
    lathe(g, [[0, 0.01], [radius * 0.62, 0.012], [radius * 0.8, 0.03], [radius * 0.97, 0.075], [radius, 0.085], [radius * 0.985, 0.075], [radius * 0.8, 0.022], [radius * 0.6, 0.016], [0, 0.016]], def.color, 46, { matOpts: { rough: 0.25, physical: true, clearcoat: 0.4 } });
    torus(g, radius * 0.94, 0.008, def.rim, 0, 0.082, 0, { rx: Math.PI / 2 });
    if (id === "marble") {
      for (let i = 0; i < 8; i++) {
        const vein = torus(g, radius * (0.25 + i * 0.08), 0.0025, "rgba(140,140,150,0.35)", 0, 0.058 - i * 0.001, 0, { rx: Math.PI / 2, arc: 1.2 });
        vein.rotation.z = i * 0.9;
      }
    }
  }
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}

/* ---------------------------------------------------------------------
   The cake (and friends)
   ---------------------------------------------------------------------
   design = {
     recipeId, shape, layers, frosting, style, plate, message,
     toppings: [{id, x, z}], candles, sprinkles, seed
   }
   --------------------------------------------------------------------- */
const FROST_OVERHANG = 0.045;

export function buildCreation(design, opts = {}) {
  const recipe = recipeById(design.recipeId);
  const g = new THREE.Group();
  const plate = buildPlate(design.plate || "ceramic", opts.plateRadius || 1.12);
  plate.position.y = -0.02;
  g.add(plate);

  const topY = buildByKind(g, design, recipe, opts);
  if (design.message && design.message.trim()) addMessage(g, design, topY, g.userData.topRadius || 0.6);
  // Keep what the builders recorded (top radius, message plaque), then add
  // the data the rest of the game reads back off the model.
  g.userData = { ...g.userData, recipe, topY, design };
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}

function buildByKind(g, design, recipe, opts) {
  switch (recipe.kind) {
    case "cupcake": return buildCupcake(g, design, recipe, opts);
    case "cookie": return buildCookie(g, design, recipe);
    case "donut": return buildDonut(g, design, recipe);
    case "pancake": return buildPancakes(g, design, recipe);
    case "waffle": return buildWaffle(g, design, recipe);
    case "brownie": return buildBrownie(g, design, recipe);
    case "macaron": return buildMacaron(g, design, recipe);
    case "cheesecake": return buildCheesecake(g, design, recipe);
    default: return buildLayerCake(g, design, recipe);
  }
}

function frostColor(design) { return frostingById(design.frosting).color; }

function addToppings(g, design, topY, radius) {
  const list = (design.toppings || []).slice(0, 60);
  list.forEach((t, i) => {
    const piece = buildTopping(t.id, 0.85 + (i % 3) * 0.08);
    const x = (t.x || 0) * radius * 0.88;
    const z = (t.z || 0) * radius * 0.88;
    const dist = Math.min(1, Math.hypot(x, z) / Math.max(0.001, radius));
    piece.position.set(x, topY + 0.002 - dist * dist * 0.05, z);
    piece.rotation.y = (i * 1.7) % 6.28;
    g.add(piece);
  });
}

function addCandles(g, design, topY, radius) {
  const count = Math.min(8, design.candles || 0);
  for (let i = 0; i < count; i++) {
    const a = count === 1 ? 0 : (i / count) * Math.PI * 2;
    const candle = buildTopping("candle", 0.95);
    candle.position.set(Math.cos(a) * radius * 0.55, topY, Math.sin(a) * radius * 0.55);
    g.add(candle);
  }
  return count;
}

function addSprinkles(g, design, topY, radius) {
  if (!design.sprinkles) return;
  const palette = ["#f27a9b", "#f7d05c", "#7fc4e0", "#9fd18a", "#c9a6e8", "#fdf3e2"];
  const n = Math.min(90, design.sprinkles);
  const geo = new THREE.CylinderGeometry(0.011, 0.011, 0.035, 6);
  const groups = new Map();
  for (let i = 0; i < n; i++) {
    const color = palette[i % palette.length];
    if (!groups.has(color)) groups.set(color, []);
    groups.get(color).push(i);
  }
  groups.forEach((indices, color) => {
    const inst = new THREE.InstancedMesh(geo, mat(color, { rough: 0.5 }), indices.length);
    inst.castShadow = true;
    const dummy = new THREE.Object3D();
    indices.forEach((idx, k) => {
      const a = Math.random() * Math.PI * 2;
      const r = Math.sqrt(Math.random()) * radius * 0.92;
      dummy.position.set(Math.cos(a) * r, topY + 0.006, Math.sin(a) * r);
      dummy.rotation.set(Math.random() * 1.4, Math.random() * 3, Math.random() * 1.4);
      dummy.scale.setScalar(1);
      dummy.updateMatrix();
      inst.setMatrixAt(k, dummy.matrix);
    });
    inst.instanceMatrix.needsUpdate = true;
    g.add(inst);
  });
}

function addDrip(g, design, topY, radius, color) {
  // Glaze sits on the outside of the frosting shell, not inside it, with a
  // tapered run and a fat bead at the tip so it reads as poured icing.
  // The glaze is a shade darker than the frosting so it reads as a separate
  // pour, and it overhangs the shell slightly before running down.
  const glaze = new THREE.Color(color).multiplyScalar(0.84).getStyle();
  const shellR = radius + 0.014;
  cyl(g, shellR, shellR + 0.006, 0.034, glaze, 0, topY - 0.006, 0, 44, { matOpts: { rough: 0.28, physical: true, clearcoat: 0.9 } });
  const count = 18;
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2 + 0.1;
    const len = 0.08 + ((i * 37) % 10) / 10 * 0.22;
    const x = Math.cos(a) * (shellR - 0.004), z = Math.sin(a) * (shellR - 0.004);
    cyl(g, 0.04, 0.018, len, glaze, x, topY - 0.022 - len / 2, z, 10, { matOpts: { rough: 0.28, physical: true, clearcoat: 0.9 } });
    ball(g, 0.022, glaze, x, topY - 0.022 - len, z, 10, [1, 0.85, 1]);
  }
}

function addPiping(g, design, topY, radius, color) {
  const count = 12;
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2;
    const x = Math.cos(a) * radius * 0.9, z = Math.sin(a) * radius * 0.9;
    for (let j = 0; j < 3; j++) ball(g, 0.036 - j * 0.007, color, x, topY + 0.012 + j * 0.022, z, 10, [1, 0.85, 1]);
  }
}

function addSwirl(g, design, topY, radius, color) {
  // A piped spiral: three concentric turns that rise toward the middle, so it
  // reads as soft-serve frosting from every angle instead of one flat ribbon.
  const points = [];
  const turns = 2.6, steps = 96;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const a = t * Math.PI * 2 * turns;
    const r = radius * (0.9 - t * 0.72);
    points.push(new THREE.Vector3(Math.cos(a) * r, topY + 0.035 + t * 0.13, Math.sin(a) * r));
  }
  const curve = new THREE.CatmullRomCurve3(points);
  const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 160, 0.048, 9, false), cream(color));
  tube.castShadow = true;
  g.add(tube);
  // a little peak where the piping was lifted away
  const peak = ball(g, 0.055, color, 0, topY + 0.185, 0, 12, [0.85, 1.3, 0.85]);
  peak.material = cream(color, { rough: 0.35 });
}

function buildLayerCake(g, design, recipe) {
  const shape = design.shape || "round";
  const tiers = shape === "tiered2" ? 2 : shape === "tiered3" ? 3 : 1;
  const frost = frostColor(design);
  const style = design.style || "smooth";
  const sponge = mat(recipe.tone, { rough: 0.72 });
  const filling = mat(recipe.accent, { rough: 0.5 });
  const frostMat = cream(frost);
  const layerH = 0.18;
  const baseR = shape === "sheet" ? 1.0 : 0.86;
  const tierSpecs = tiers === 3
    ? [{ r: 0.88, h: 0.32, y: 0 }, { r: 0.64, h: 0.27, y: 0.34 }, { r: 0.42, h: 0.22, y: 0.63 }]
    : tiers === 2
      ? [{ r: 0.9, h: 0.38, y: 0 }, { r: 0.62, h: 0.3, y: 0.4 }]
      : [{ r: baseR, h: 0.52, y: 0 }];

  let topY = 0;
  let topR = baseR;
  tierSpecs.forEach((tier, ti) => {
    const layers = Math.max(2, Math.min(4, design.layers || 3));
    const totalH = tier.h;
    const per = totalH / layers;
    for (let i = 0; i < layers; i++) {
      const spongeH = per * 0.68, fillH = per * 0.32;
      const y = tier.y + per * i + spongeH / 2;
      if (shape === "square" || shape === "sheet") {
        const w = tier.r * 1.85;
        box(g, w, spongeH, shape === "sheet" ? w * 0.72 : w, recipe.tone, 0, y, 0, { r: 0.02, matOpts: { rough: 0.72 } });
        box(g, w * 1.01, fillH, (shape === "sheet" ? w * 0.72 : w) * 1.01, recipe.accent, 0, y + spongeH / 2 + fillH / 2, 0, { r: 0.01, matOpts: { rough: 0.5 } });
      } else if (shape === "heart") {
        const geo = new THREE.ExtrudeGeometry(heartShape(tier.r * 0.8), { depth: spongeH, bevelEnabled: true, bevelSize: 0.012, bevelThickness: 0.012, bevelSegments: 2 });
        geo.rotateX(-Math.PI / 2);
        geo.translate(0, spongeH, 0);
        const mesh = new THREE.Mesh(geo, sponge);
        mesh.position.y = y - spongeH / 2 + 0.02;
        mesh.rotation.y = Math.PI;
        g.add(mesh);
      } else {
        cyl(g, tier.r, tier.r * 1.005, spongeH, recipe.tone, 0, y, 0, 44, { matOpts: { rough: 0.72 } });
        cyl(g, tier.r * 1.012, tier.r * 1.012, fillH, recipe.accent, 0, y + spongeH / 2 + fillH / 2, 0, 44, { matOpts: { rough: 0.5 } });
      }
    }
    const tierTop = tier.y + totalH;
    // Frosting shell and top
    if (style !== "naked") {
      if (shape === "square" || shape === "sheet") {
        const w = tier.r * 1.9;
        box(g, w, totalH * 0.94, shape === "sheet" ? w * 0.76 : w, frost, 0, tier.y + totalH / 2, 0, { r: 0.035, matOpts: { rough: 0.52, physical: true, clearcoat: 0.3 } });
      } else if (shape === "heart") {
        const geo = new THREE.ExtrudeGeometry(heartShape(tier.r * 0.84), { depth: totalH * 0.98, bevelEnabled: true, bevelSize: 0.02, bevelThickness: 0.02, bevelSegments: 3 });
        geo.rotateX(-Math.PI / 2);
        geo.translate(0, totalH, 0);
        const shell = new THREE.Mesh(geo, frostMat);
        shell.position.y = tier.y;
        shell.rotation.y = Math.PI;
        g.add(shell);
      } else {
        cyl(g, tier.r + FROST_OVERHANG, tier.r + FROST_OVERHANG, totalH * 0.96, frost, 0, tier.y + totalH / 2, 0, 48, { matOpts: { rough: 0.52, physical: true, clearcoat: 0.3 } });
        // soft domed top
        lathe(g, [[tier.r + FROST_OVERHANG, 0], [tier.r + 0.03, 0.012], [tier.r * 0.9, 0.028], [tier.r * 0.55, 0.038], [0, 0.042]], frost, 48, { matOpts: { rough: 0.52, physical: true, clearcoat: 0.3 } }).position.y = tierTop - 0.005;
      }
    } else {
      // naked cake: exposed sponge with frosting rings
      if (shape !== "square" && shape !== "sheet") {
        cyl(g, tier.r + 0.01, tier.r + 0.01, totalH, recipe.tone, 0, tier.y + totalH / 2, 0, 44, { matOpts: { rough: 0.8 } });
        for (let i = 0; i < 3; i++) torus(g, tier.r + 0.005, 0.022, frost, 0, tier.y + totalH * (0.2 + i * 0.25), 0, { rx: Math.PI / 2 });
        cyl(g, tier.r + 0.02, tier.r + 0.02, 0.035, frost, 0, tierTop - 0.012, 0, 44);
      }
    }
    if (style === "drip" && ti === 0) {
      addDrip(g, design, tierTop, tier.r + FROST_OVERHANG, frost);
    }
    if (style === "piped") addPiping(g, design, tierTop + 0.01, tier.r, frost);
    if (style === "swirl" && ti === tierSpecs.length - 1) addSwirl(g, design, tierTop + 0.01, tier.r * 0.9, frost);

    topY = tierTop + 0.045;
    topR = tier.r + FROST_OVERHANG;
  });

  addSprinkles(g, design, topY, topR);
  addToppings(g, design, topY, topR);
  addCandles(g, design, topY, topR);

  // A little chocolate collar for tall tiers
  if (tiers === 1 && (design.layers || 3) >= 4) {
    torus(g, topR * 0.995, 0.014, recipe.accent, 0, topY - 0.04, 0, { rx: Math.PI / 2 });
  }
  g.userData.topRadius = topR;
  return topY;
}

function buildCupcake(g, design, recipe) {
  const frost = frostColor(design);
  const wrapper = group(g);
  const pleats = 16;
  for (let i = 0; i < pleats; i++) {
    const a = (i / pleats) * Math.PI * 2;
    const p = box(wrapper, 0.09, 0.26, 0.03, i % 2 ? "#f6e7d4" : "#efd9c2", Math.cos(a) * 0.2, 0.13, Math.sin(a) * 0.2, { r: 0.01, matOpts: { rough: 0.85 } });
    p.rotation.y = -a;
    p.rotation.z = 0.03;
  }
  cyl(wrapper, 0.19, 0.15, 0.05, "#e8d2b8", 0, 0.015, 0, 22);
  // cake dome
  ball(g, 0.2, recipe.tone, 0, 0.31, 0, 24, [1, 0.72, 1]);
  // buttercream swirl
  const swirl = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.19, 0.36, 0),
    new THREE.Vector3(0.1, 0.41, 0.13),
    new THREE.Vector3(-0.11, 0.45, 0.06),
    new THREE.Vector3(-0.06, 0.49, -0.12),
    new THREE.Vector3(0.08, 0.52, -0.03),
    new THREE.Vector3(0.01, 0.55, 0.01)
  ]);
  const tube = new THREE.Mesh(new THREE.TubeGeometry(swirl, 48, 0.065, 10, false), cream(frost));
  tube.castShadow = true;
  g.add(tube);
  ball(g, 0.052, frost, 0, 0.57, 0, 14, [1, 1.1, 1]);
  if (design.candles) addCandles(g, design, 0.54, 0.08);
  addSprinkles(g, design, 0.55, 0.2);
  addToppings(g, design, 0.53, 0.22);
  if (design.style === "drip") addDrip(g, design, 0.42, 0.2, frost);
  if (design.style === "piped") addPiping(g, design, 0.36, 0.19, frost);
  g.userData.topRadius = 0.22;
  return 0.53;
}

function buildCookie(g, design, recipe) {
  const frost = frostColor(design);
  const base = cyl(g, 0.62, 0.6, 0.09, recipe.tone, 0, 0.05, 0, 40, { matOpts: { rough: 0.85 } });
  for (let i = 0; i < 12; i++) {
    const a = i * 2.4, r = (i % 3) * 0.17 + 0.05;
    ball(g, 0.055, recipe.accent, Math.cos(a) * r, 0.095, Math.sin(a) * r, 10, [1, 0.55, 1]);
  }
  if (design.style === "drip") {
    const icing = cyl(g, 0.53, 0.53, 0.03, frost, 0, 0.1, 0, 30, { matOpts: { rough: 0.4, physical: true } });
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      ball(g, 0.055, frost, Math.cos(a) * 0.52, 0.1, Math.sin(a) * 0.52, 10, [1.4, 0.5, 1]);
    }
  } else {
    cyl(g, 0.5, 0.5, 0.025, frost, 0, 0.1, 0, 34, { matOpts: { rough: 0.45 } });
  }
  addSprinkles(g, design, 0.12, 0.52);
  addToppings(g, design, 0.115, 0.55);
  if (design.candles) addCandles(g, design, 0.1, 0.3);
  g.userData.topRadius = 0.6;
  return 0.12;
}

function buildDonut(g, design, recipe) {
  const frost = frostColor(design);
  torus(g, 0.52, 0.23, recipe.tone, 0, 0.2, 0, { rx: Math.PI / 2 });
  const glaze = torus(g, 0.52, 0.235, frost, 0, 0.215, 0, { rx: Math.PI / 2 });
  glaze.material = cream(frost, { rough: 0.3 });
  const dripCount = 14;
  for (let i = 0; i < dripCount; i++) {
    const a = (i / dripCount) * Math.PI * 2;
    const r = 0.52;
    ball(g, 0.05, frost, Math.cos(a) * r, 0.3 - (i % 3) * 0.03, Math.sin(a) * r, 8, [1, 1.5, 1]);
  }
  addSprinkles(g, design, 0.32, 0.66);
  addToppings(g, design, 0.33, 0.55);
  if (design.candles) addCandles(g, design, 0.28, 0.3);
  g.userData.topRadius = 0.66;
  return 0.33;
}

function buildPancakes(g, design, recipe) {
  const frost = frostColor(design);
  const count = Math.max(4, design.layers || 5);
  for (let i = 0; i < count; i++) {
    cyl(g, 0.52, 0.5, 0.055, recipe.tone, 0, 0.05 + i * 0.058, 0, 36, { matOpts: { rough: 0.8 } });
    cyl(g, 0.5, 0.5, 0.006, "#c58f4f", 0, 0.078 + i * 0.058, 0, 34, { matOpts: { rough: 0.7 } });
  }
  const topY = 0.05 + count * 0.058;
  cyl(g, 0.44, 0.44, 0.02, frost, 0, topY + 0.005, 0, 30, { matOpts: { rough: 0.35, physical: true } });
  if (design.style === "drip") {
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      const len = 0.08 + (i % 4) * 0.03;
      cyl(g, 0.03, 0.018, len, frost, Math.cos(a) * 0.5, topY - len / 2, Math.sin(a) * 0.5, 8);
    }
  }
  addSprinkles(g, design, topY + 0.02, 0.42);
  addToppings(g, design, topY + 0.02, 0.46);
  if (design.candles) addCandles(g, design, topY, 0.28);
  g.userData.topRadius = 0.5;
  return topY + 0.02;
}

function buildWaffle(g, design, recipe) {
  const frost = frostColor(design);
  const base = box(g, 0.95, 0.09, 0.95, recipe.tone, 0, 0.06, 0, { r: 0.06, matOpts: { rough: 0.8 } });
  for (let i = 0; i < 4; i++) {
    box(g, 0.86, 0.014, 0.055, "#a9723c", 0, 0.108, -0.33 + i * 0.22, { r: 0.006 });
    box(g, 0.055, 0.014, 0.86, "#a9723c", -0.33 + i * 0.22, 0.108, 0, { r: 0.006 });
  }
  cyl(g, 0.4, 0.4, 0.022, frost, 0, 0.118, 0, 30, { matOpts: { rough: 0.38, physical: true } });
  if (design.style === "drip") {
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const len = 0.07 + (i % 3) * 0.04;
      cyl(g, 0.032, 0.016, len, frost, Math.cos(a) * 0.44, 0.11 - len / 2, Math.sin(a) * 0.44, 8);
    }
  }
  addSprinkles(g, design, 0.14, 0.4);
  addToppings(g, design, 0.14, 0.42);
  if (design.candles) addCandles(g, design, 0.12, 0.3);
  g.userData.topRadius = 0.46;
  return 0.14;
}

function buildBrownie(g, design, recipe) {
  const frost = frostColor(design);
  const size = 0.82;
  box(g, size, 0.22, size, recipe.tone, 0, 0.12, 0, { r: 0.03, matOpts: { rough: 0.78 } });
  box(g, size * 0.96, 0.03, size * 0.96, recipe.accent, 0, 0.235, 0, { r: 0.02, matOpts: { rough: 0.5 } });
  box(g, size * 0.9, 0.02, size * 0.9, frost, 0, 0.25, 0, { r: 0.02, matOpts: { rough: 0.35, physical: true } });
  for (let i = 0; i < 20; i++) {
    box(g, 0.03, 0.002, 0.012, "#8a5a40", (Math.random() - 0.5) * 0.6, 0.262, (Math.random() - 0.5) * 0.6, { r: 0.001 });
  }
  addSprinkles(g, design, 0.262, 0.4);
  addToppings(g, design, 0.262, 0.4);
  if (design.candles) addCandles(g, design, 0.25, 0.25);
  g.userData.topRadius = size / 2;
  return 0.262;
}

function buildMacaron(g, design, recipe) {
  const frost = frostColor(design);
  const shell = mat(recipe.tone, { rough: 0.55, physical: true, clearcoat: 0.2 });
  const size = 0.5;
  ball(g, size, recipe.tone, 0, 0.09, 0, 30, [1, 0.44, 1]);
  cyl(g, size * 0.92, size * 0.92, 0.055, recipe.accent, 0, 0.19, 0, 30, { matOpts: { rough: 0.5 } });
  ball(g, size, recipe.tone, 0, 0.295, 0, 30, [1, 0.44, 1]);
  // ruffled foot
  torus(g, size * 0.72, 0.022, recipe.tone, 0, 0.2, 0, { rx: Math.PI / 2 });
  torus(g, size * 0.86, 0.016, frost, 0, 0.26, 0, { rx: Math.PI / 2 });
  addSprinkles(g, design, 0.32, 0.35);
  addToppings(g, design, 0.35, 0.34);
  if (design.candles) addCandles(g, design, 0.33, 0.14);
  g.userData.topRadius = size * 0.8;
  return 0.34;
}

function buildCheesecake(g, design, recipe) {
  const frost = frostColor(design);
  cyl(g, 0.85, 0.85, 0.14, "#c79a63", 0, 0.07, 0, 44, { matOpts: { rough: 0.9 } });
  for (let i = 0; i < 24; i++) {
    const a = i * 1.7, r = 0.1 + (i % 5) * 0.14;
    box(g, 0.08, 0.012, 0.06, "#a87b47", Math.cos(a) * r, 0.145, Math.sin(a) * r, { r: 0.004 });
  }
  cyl(g, 0.82, 0.82, 0.3, "#f8efda", 0, 0.28, 0, 46, { matOpts: { rough: 0.5, physical: true, clearcoat: 0.2 } });
  cyl(g, 0.82, 0.82, 0.03, frost, 0, 0.43, 0, 46, { matOpts: { rough: 0.3, physical: true, clearcoat: 0.5 } });
  // fruit swirl
  const swirlCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.55, 0.445, -0.3),
    new THREE.Vector3(-0.1, 0.448, 0.1),
    new THREE.Vector3(0.3, 0.448, -0.15),
    new THREE.Vector3(0.55, 0.448, 0.2)
  ]);
  const swirl = new THREE.Mesh(new THREE.TubeGeometry(swirlCurve, 40, 0.022, 6, false), mat(recipe.accent, { rough: 0.4 }));
  g.add(swirl);
  addSprinkles(g, design, 0.45, 0.78);
  addToppings(g, design, 0.45, 0.78);
  if (design.candles) addCandles(g, design, 0.44, 0.4);
  g.userData.topRadius = 0.78;
  return 0.45;
}

function addMessage(g, design, topY, topRadius) {
  const text = String(design.message).slice(0, 26);
  if (!text.trim()) return;
  if (topRadius >= 0.42) {
    // Dark chocolate ink on pale icing, cream ink on dark icing: the message
    // has to stay legible whatever colour the baker picked.
    const frost = String(frostColor(design)).replace("#", "");
    const r = parseInt(frost.slice(0, 2), 16) || 240, gg = parseInt(frost.slice(2, 4), 16) || 220, bb = parseInt(frost.slice(4, 6), 16) || 220;
    const light = (r * 0.299 + gg * 0.587 + bb * 0.114) / 255 > 0.62;
    const tex = textTexture(text, {
      w: 640, h: 170,
      color: light ? "#6d3b41" : "#fff8ea",
      shadow: light ? "rgba(255,252,246,0.7)" : "rgba(60,25,30,0.55)",
      size: 76, weight: 700, font: "Georgia, serif"
    });
    const w = Math.min(1.24, topRadius * 1.5), h = w * 0.266;
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }));
    plane.rotation.x = -Math.PI / 2;
    plane.position.set(0, topY + 0.016, topRadius * 0.06);
    g.add(plane);
    g.userData.messagePlane = plane;
    return;
  }
  // Small bakes get a chocolate plaque leaning on the plate instead.
  const tex = textTexture(text, { w: 512, h: 170, color: "#fdf3e2", bg: "#6b4230", size: 78, font: "Georgia, serif" });
  const plaque = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.34, 0.045), [
    chocolateMat("#6b4230"), chocolateMat("#6b4230"), chocolateMat("#6b4230"),
    chocolateMat("#6b4230"), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.5 }), chocolateMat("#6b4230")
  ]);
  plaque.rotation.x = -0.32;
  plaque.position.set(0, 0.19, 0.72);
  plaque.castShadow = true;
  g.add(plaque);
  g.userData.messagePlane = plaque;
}

/* ---------------------------------------------------------------------
   Ingredients, jars, bowls, tools
   --------------------------------------------------------------------- */
export function buildIngredient(id, scale = 1) {
  const def = INGREDIENTS.find((i) => i.id === id) || INGREDIENTS[0];
  const g = new THREE.Group();
  const color = def.color;
  switch (def.model) {
    case "sack": {
      lathe(g, [[0, 0], [0.14, 0.01], [0.16, 0.08], [0.13, 0.19], [0.08, 0.23], [0.07, 0.27], [0, 0.27]], "#e8dcc2", 22);
      cyl(g, 0.075, 0.075, 0.05, "#d5c6a8", 0, 0.28, 0, 16);
      const label = new THREE.Mesh(new THREE.PlaneGeometry(0.15, 0.1), new THREE.MeshBasicMaterial({ map: textTexture("FLOUR", { w: 256, h: 160, color: "#8a6b4a", bg: "#f6ecd8", size: 46 }), transparent: false }));
      label.position.set(0, 0.13, 0.152);
      g.add(label);
      break;
    }
    case "jar": {
      cyl(g, 0.115, 0.125, 0.26, glass(), 0, 0.13, 0, 22);
      cyl(g, 0.112, 0.118, 0.2, color, 0, 0.11, 0, 22, { matOpts: { rough: 0.9 } });
      cyl(g, 0.12, 0.12, 0.045, "#c9a879", 0, 0.28, 0, 22);
      break;
    }
    case "bottle": {
      lathe(g, [[0, 0], [0.1, 0.005], [0.105, 0.06], [0.09, 0.16], [0.045, 0.21], [0.042, 0.25], [0.05, 0.26], [0, 0.26]], "#f4f7f2", 20);
      cyl(g, 0.055, 0.055, 0.03, color, 0, 0.24, 0, 16);
      const label = new THREE.Mesh(new THREE.PlaneGeometry(0.11, 0.08), new THREE.MeshBasicMaterial({ map: textTexture("MILK", { w: 256, h: 180, color: "#8aa6bd", bg: "#f7fbfd", size: 40 }) }));
      label.position.set(0, 0.11, 0.104);
      g.add(label);
      break;
    }
    case "jug": {
      cyl(g, 0.1, 0.08, 0.2, "#fbf7ee", 0, 0.11, 0, 20);
      cyl(g, 0.045, 0.06, 0.06, "#fbf7ee", 0.09, 0.23, 0, 12, { rz: -0.5 });
      torus(g, 0.05, 0.012, "#fbf7ee", -0.1, 0.14, 0, { ry: Math.PI / 2 });
      cyl(g, 0.095, 0.095, 0.02, color, 0, 0.215, 0, 20);
      break;
    }
    case "block": {
      box(g, 0.22, 0.11, 0.14, color, 0, 0.06, 0, { r: 0.018, matOpts: { rough: 0.6 } });
      box(g, 0.225, 0.105, 0.145, "rgba(255,255,255,0.35)", 0, 0.12, 0, { r: 0.02 });
      cyl(g, 0.14, 0.14, 0.012, "#fbf7ee", 0, 0.006, 0, 18);
      break;
    }
    case "egg": {
      const egg = ball(g, 0.085, "#f3dcc0", 0, 0.1, 0, 18, [1, 1.25, 1]);
      const second = ball(g, 0.08, "#eed6b6", 0.11, 0.085, 0.03, 16, [1, 1.2, 1]);
      second.rotation.z = 0.4;
      break;
    }
    case "vial": {
      cyl(g, 0.03, 0.035, 0.14, glass(), 0, 0.07, 0, 14);
      cyl(g, 0.026, 0.03, 0.09, color, 0, 0.055, 0, 14);
      cyl(g, 0.038, 0.038, 0.03, "#b78a5e", 0, 0.155, 0, 14);
      break;
    }
    case "berry": {
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        const b = ball(g, 0.07, color, Math.cos(a) * 0.075, 0.07 + (i % 2) * 0.03, Math.sin(a) * 0.075, 14, [1, 1.15, 1]);
        b.rotation.z = a;
      }
      break;
    }
    case "citrus": {
      ball(g, 0.13, color, 0, 0.13, 0, 20);
      ball(g, 0.135, "rgba(255,255,255,0.18)", 0, 0.13, 0, 20);
      const leaf = box(g, 0.1, 0.012, 0.05, "#6f9c62", 0.04, 0.26, 0, { r: 0.006 });
      leaf.rotation.z = -0.4;
      break;
    }
    case "bar": {
      box(g, 0.28, 0.05, 0.16, color, 0, 0.03, 0, { r: 0.012, matOpts: { rough: 0.4, physical: true, clearcoat: 0.5 } });
      for (let i = 0; i < 4; i++) box(g, 0.06, 0.056, 0.15, color, -0.1 + i * 0.067, 0.032, 0, { r: 0.01 });
      break;
    }
    case "nut": {
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        const n = ball(g, 0.06, color, Math.cos(a) * 0.08, 0.055 + (i % 2) * 0.04, Math.sin(a) * 0.08, 10, [1, 0.8, 0.8]);
        n.rotation.set(0.6, a, 0.4);
      }
      break;
    }
    case "carrot": {
      cone(g, 0.075, 0.34, color, 0, 0.17, 0, 12, { rx: Math.PI });
      for (let i = 0; i < 3; i++) {
        const leaf = box(g, 0.03, 0.16, 0.01, "#6f9c62", -0.03 + i * 0.03, 0.37, 0, { r: 0.004 });
        leaf.rotation.z = (i - 1) * 0.4;
      }
      break;
    }
    default: {
      cyl(g, 0.11, 0.1, 0.2, color, 0, 0.11, 0, 20);
    }
  }
  if (def.kind === "powder") {
    // a little dusting of the ingredient on the bench
    for (let i = 0; i < 6; i++) ball(g, 0.012, color, (Math.random() - 0.5) * 0.3, 0.004, (Math.random() - 0.5) * 0.2, 6, [1, 0.4, 1]);
  }
  g.scale.setScalar(scale);
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}

export function buildBowl(radius = 0.5) {
  const g = new THREE.Group();
  lathe(g, [[0, 0], [radius * 0.55, 0.005], [radius * 0.8, 0.05], [radius * 0.97, 0.16], [radius, 0.24], [radius * 0.94, 0.25], [radius * 0.9, 0.22], [radius * 0.72, 0.1], [radius * 0.5, 0.035], [0, 0.03]], "#fdf8ef", 36, { matOpts: { rough: 0.3, physical: true, clearcoat: 0.4 } });
  torus(g, radius * 0.95, 0.012, "#efe3d0", 0, 0.24, 0, { rx: Math.PI / 2 });
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  g.userData.radius = radius;
  return g;
}

export function buildWhisk() {
  const g = new THREE.Group();
  cyl(g, 0.018, 0.022, 0.24, "#c9a87c", 0, 0.12, 0, 10);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const loop = torus(g, 0.055, 0.005, "#d7dade", Math.cos(a) * 0.03, -0.06, Math.sin(a) * 0.03, { rx: Math.PI / 2, arc: Math.PI });
    loop.rotation.y = a;
  }
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return g;
}

export function buildTray(radius = 0.72) {
  const g = new THREE.Group();
  cyl(g, radius, radius * 0.96, 0.05, "#b9bcc0", 0, 0.025, 0, 34, { matOpts: { rough: 0.3, metal: 0.7 } });
  torus(g, radius * 0.99, 0.026, "#a5a9ae", 0, 0.05, 0, { rx: Math.PI / 2 });
  for (let i = 0; i < 2; i++) {
    const handle = box(g, 0.16, 0.03, 0.05, "#c6c9cd", (i ? 1 : -1) * (radius + 0.07), 0.04, 0, { r: 0.01, matOpts: { metal: 0.7, rough: 0.35 } });
  }
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}

/* ---------------------------------------------------------------------
   The chef
   --------------------------------------------------------------------- */
export function buildChef(cos = {}, opts = {}) {
  const g = new THREE.Group();
  const skin = SKIN_TONES[cos.skin || 0] || SKIN_TONES[0];
  const hair = (HAIR_LIST.find((h) => h.id === cos.hair) || HAIR_LIST[0]).color;
  const hat = HATS_LIST.find((h) => h.id === cos.hat) || HATS_LIST[0];
  const apron = APRONS_LIST.find((a) => a.id === cos.apron) || APRONS_LIST[0];

  const root = group(g);
  const body = group(root);
  // Dress / torso
  lathe(body, [[0.0, 0.0], [0.26, 0.02], [0.3, 0.18], [0.27, 0.42], [0.21, 0.56], [0.12, 0.62], [0, 0.63]], apron.color === "#fbf1dd" ? "#f6d3c2" : "#f3dcc9", 26, { matOpts: { rough: 0.75 } });
  // Apron panel
  const panel = box(body, 0.34, 0.4, 0.03, apron.color, 0, 0.3, 0.235, { r: 0.04, matOpts: { rough: 0.8 } });
  panel.rotation.x = -0.06;
  box(body, 0.36, 0.05, 0.035, apron.color, 0, 0.51, 0.24, { r: 0.02 });
  // Apron tie
  box(body, 0.56, 0.045, 0.04, apron.color, 0, 0.32, -0.02, { r: 0.02 });
  // Collar
  cyl(body, 0.16, 0.14, 0.05, "#fdf6ea", 0, 0.6, 0, 20);
  // Head
  const head = group(root, 0, 0.74, 0);
  ball(head, 0.23, skin, 0, 0.1, 0, 26);
  ball(head, 0.06, skin, -0.2, 0.09, 0, 12);
  ball(head, 0.06, skin, 0.2, 0.09, 0, 12);
  // Eyes
  for (const s of [-1, 1]) {
    const white = ball(head, 0.045, "#fffdf8", s * 0.082, 0.12, 0.19, 14, [0.85, 1, 0.6]);
    const iris = ball(head, 0.026, "#5b4640", s * 0.084, 0.115, 0.222, 12, [1, 1, 0.6]);
    ball(head, 0.011, "#fffdf8", s * 0.075 + 0.008, 0.13, 0.238, 6);
    // lashes
    const lash = box(head, 0.05, 0.008, 0.008, "#4a3630", s * 0.085, 0.172, 0.215, { r: 0.003 });
    lash.rotation.z = s * -0.16;
    // blush
    ball(head, 0.036, mat("#e98e96", { transparent: true, opacity: 0.5, depthWrite: false, rough: 0.9 }), s * 0.135, 0.045, 0.175, 10, [1, 0.7, 0.4]);
  }
  // Nose + smile
  ball(head, 0.017, "rgba(210,150,130,0.9)", 0, 0.08, 0.228, 8);
  const smile = torus(head, 0.036, 0.007, "#b5645f", 0, 0.035, 0.218, { arc: Math.PI, rx: 0 });
  smile.rotation.set(Math.PI, 0, Math.PI);
  // Hair
  buildHair(head, cos.hair || "honey", hair);
  // Hat
  if (hat.id === "toque") {
    cyl(head, 0.2, 0.18, 0.12, "#fdfaf2", 0, 0.3, 0, 20, { matOpts: { rough: 0.8 } });
    ball(head, 0.21, "#fdfaf2", 0, 0.44, 0, 20, [1, 1.15, 1]);
    ball(head, 0.13, "#fdfaf2", -0.11, 0.42, 0.06, 14);
    ball(head, 0.12, "#fdfaf2", 0.12, 0.41, -0.04, 14);
  } else if (hat.id === "beret") {
    ball(head, 0.19, hat.color, 0.02, 0.31, 0, 18, [1.15, 0.42, 1.15]);
    cyl(head, 0.025, 0.02, 0.05, hat.color, 0.02, 0.38, 0, 8);
  } else if (hat.id === "bandana") {
    cyl(head, 0.215, 0.215, 0.075, hat.color, 0, 0.28, 0, 22);
    const knot = box(head, 0.12, 0.1, 0.05, hat.color, 0.18, 0.28, -0.1, { r: 0.02 });
    knot.rotation.set(0.2, 0.6, 0.4);
  } else if (hat.id === "bow") {
    for (const s of [-1, 1]) {
      const loop = ball(head, 0.09, hat.color, s * 0.14, 0.33, 0.06, 14, [1.1, 0.8, 0.5]);
      loop.rotation.z = s * 0.4;
    }
    ball(head, 0.04, hat.color, 0, 0.33, 0.07, 10);
  } else if (hat.id === "crown") {
    cyl(head, 0.15, 0.13, 0.08, "#e5c168", 0, 0.31, 0, 16, { matOpts: { metal: 0.7, rough: 0.3 } });
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      cone(head, 0.045, 0.12, "#e5c168", Math.cos(a) * 0.13, 0.39, Math.sin(a) * 0.13, 6, { matOpts: { metal: 0.7, rough: 0.3 } });
    }
  } else if (hat.id === "beanie") {
    ball(head, 0.21, hat.color, 0, 0.29, 0, 20, [1, 0.7, 1]);
    torus(head, 0.2, 0.03, hat.color, 0, 0.25, 0, { rx: Math.PI / 2 });
    ball(head, 0.05, "#fdf6ea", 0, 0.42, 0, 10);
  }
  // Arms
  const arms = {};
  for (const s of [-1, 1]) {
    const arm = group(root, s * 0.26, 0.46, 0);
    const upper = cyl(arm, 0.062, 0.056, 0.26, skin, 0, -0.1, 0, 12);
    upper.rotation.z = s * -0.16;
    const hand = ball(arm, 0.075, skin, s * 0.055, -0.24, 0, 14);
    arm.rotation.z = s * 0.24;
    arms[s > 0 ? "right" : "left"] = arm;
  }
  // Legs
  for (const s of [-1, 1]) {
    cyl(root, 0.065, 0.06, 0.2, skin, s * 0.1, 0.03, 0, 10);
    const shoe = box(root, 0.14, 0.08, 0.2, "#e8b4a8", s * 0.1, -0.04, 0.04, { r: 0.03 });
  }
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  g.userData = { arms, head, body, root, blink: 0 };
  g.scale.setScalar(opts.scale || 1);
  return g;
}

const SKIN_TONES = ["#f6d9c2", "#eec5a6", "#d9a077", "#b1714e", "#7a4a33"];
const HATS_LIST = [
  { id: "toque", color: "#fbf7ef" }, { id: "beret", color: "#e2879b" }, { id: "bandana", color: "#b9d5e8" },
  { id: "bow", color: "#f7c3d0" }, { id: "crown", color: "#e5c168" }, { id: "beanie", color: "#cfddb1" }
];
const APRONS_LIST = [
  { id: "cream", color: "#fbf1dd" }, { id: "blush", color: "#f7c3d0" }, { id: "mint", color: "#b9dfcd" },
  { id: "chocolate", color: "#8a5c42" }, { id: "gold", color: "#e5c168" }, { id: "denim", color: "#8fa6bd" }
];
const HAIR_LIST = [
  { id: "honey", color: "#d8a95f" }, { id: "chocolate", color: "#6b4632" }, { id: "blonde", color: "#e8cd8f" },
  { id: "pink", color: "#e58ba8" }, { id: "black", color: "#3a2c2c" }, { id: "lilac", color: "#b9a6d8" }
];

function buildHair(head, id, color) {
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.245, 26, 20, 0, Math.PI * 2, 0, Math.PI * 0.62), mat(color, { rough: 0.75 }));
  cap.position.y = 0.1;
  cap.rotation.x = -0.1;
  head.add(cap);
  if (id === "long-bob" || id === "blonde" || id === "pink") {
    for (const s of [-1, 1]) {
      const strand = ball(head, 0.1, color, s * 0.19, -0.02, -0.02, 14, [0.7, 1.9, 0.8]);
      strand.rotation.z = s * 0.12;
    }
  }
  if (id === "chocolate") {
    ball(head, 0.11, color, 0, 0.24, -0.16, 14);
    torus(head, 0.09, 0.03, color, 0, 0.19, -0.14, { rx: 1.1 });
  }
  if (id === "honey" || id === "blonde") {
    for (const s of [-1, 1]) {
      const wave = ball(head, 0.12, color, s * 0.21, -0.05, -0.05, 12, [0.75, 1.4, 0.9]);
      wave.rotation.z = s * 0.2;
    }
  }
  if (id === "black") {
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2;
      ball(head, 0.09, color, Math.cos(a) * 0.17, 0.02 + Math.sin(i) * 0.03, Math.sin(a) * 0.15, 10, [1, 1.2, 0.8]);
    }
  }
  if (id === "lilac" || id === "blonde") {
    const tail = ball(head, 0.12, color, 0, 0.16, -0.24, 12, [0.9, 1.5, 0.8]);
    tail.rotation.x = -0.4;
  }
}

export function animateChef(chef, dt, time, state = {}) {
  if (!chef || !chef.userData) return;
  const { arms, head, body } = chef.userData;
  const mood = state.mood || "idle";
  chef.userData.blink += dt;
  const blink = chef.userData.blink % 4 > 3.86;
  const breathe = Math.sin(time * 1.6) * 0.01;
  if (body) body.position.y = breathe;
  if (head) {
    head.rotation.z = Math.sin(time * 0.7) * 0.04;
    head.rotation.y = state.look === undefined ? Math.sin(time * 0.5) * 0.14 : state.look;
  }
  if (arms) {
    if (mood === "mix") {
      arms.right.rotation.x = -1.1 + Math.sin(time * 9) * 0.38;
      arms.right.rotation.z = 0.5;
      arms.left.rotation.x = -0.55 + Math.sin(time * 9 + 1.4) * 0.16;
    } else if (mood === "decorate") {
      arms.right.rotation.x = -0.95 + Math.sin(time * 3.4) * 0.16;
      arms.right.rotation.z = 0.42;
      arms.left.rotation.x = -0.4 + Math.sin(time * 2.1) * 0.1;
      arms.left.rotation.z = -0.3;
    } else if (mood === "cheer") {
      const bounce = Math.sin(time * 6) * 0.2;
      arms.right.rotation.x = -2.3 + bounce;
      arms.left.rotation.x = -2.3 - bounce;
      arms.right.rotation.z = 0.7;
      arms.left.rotation.z = -0.7;
    } else if (mood === "present") {
      arms.right.rotation.x = -0.6;
      arms.right.rotation.z = 0.9;
      arms.left.rotation.x = -0.6;
      arms.left.rotation.z = -0.9;
    } else {
      arms.right.rotation.x = Math.sin(time * 1.3) * 0.06;
      arms.left.rotation.x = Math.sin(time * 1.3 + 1) * 0.06;
      arms.right.rotation.z = 0.24;
      arms.left.rotation.z = -0.24;
    }
  }
}
