/* =====================================================================
   PET CAFÉ — procedural models
   Every animal, every pastry and every piece of furniture in the game is
   real geometry built here. No image stand-ins, no imported assets.
   ===================================================================== */
import * as THREE from "three";
import { RoundedBoxGeometry } from "../../../vendor/three/RoundedBoxGeometry.js";

/* ---------- shared materials & geometry ---------- */
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
    depthWrite: opts.depthWrite !== undefined ? opts.depthWrite : true
  };
  const material = opts.physical
    ? new THREE.MeshPhysicalMaterial({ ...params, clearcoat: 0.35, clearcoatRoughness: 0.4 })
    : new THREE.MeshStandardMaterial(params);
  materialCache.set(key, material);
  return material;
}
export const glass = () => mat("#dfeef2", { rough: 0.12, metal: 0.05, transparent: true, opacity: 0.34, depthWrite: false });
export const metal = (color = "#c9b48d") => mat(color, { rough: 0.3, metal: 0.75 });
export const glowMat = (color) => new THREE.MeshBasicMaterial({ color: new THREE.Color(color), transparent: true, opacity: 0.85 });

const geoCache = new Map();
export function rbGeo(w, h, d, r = 0.04) {
  const key = [w, h, d, r].map((n) => n.toFixed(3)).join("|");
  if (!geoCache.has(key)) {
    const radius = Math.min(r, w / 2 - 0.001, h / 2 - 0.001, d / 2 - 0.001);
    geoCache.set(key, new RoundedBoxGeometry(w, h, d, 3, Math.max(0.001, radius)));
  }
  return geoCache.get(key);
}

export function box(parent, w, h, d, color, x = 0, y = 0, z = 0, opts = {}) {
  const mesh = new THREE.Mesh(rbGeo(w, h, d, opts.r !== undefined ? opts.r : 0.035), typeof color === "string" ? mat(color, opts.matOpts || {}) : color);
  mesh.position.set(x, y, z);
  if (opts.rx) mesh.rotation.x = opts.rx;
  if (opts.ry) mesh.rotation.y = opts.ry;
  if (opts.rz) mesh.rotation.z = opts.rz;
  parent.add(mesh);
  return mesh;
}
export function cyl(parent, rt, rb, h, color, x = 0, y = 0, z = 0, seg = 20, opts = {}) {
  const material = typeof color === "string" ? mat(color, opts.matOpts || {}) : color;
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg, 1, !!opts.open), material);
  mesh.position.set(x, y, z);
  if (opts.rx) mesh.rotation.x = opts.rx;
  if (opts.ry) mesh.rotation.y = opts.ry;
  if (opts.rz) mesh.rotation.z = opts.rz;
  parent.add(mesh);
  return mesh;
}
export function ball(parent, r, color, x = 0, y = 0, z = 0, seg = 16, scale) {
  const material = typeof color === "string" ? mat(color) : color;
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(r, seg, Math.max(8, seg / 2)), material);
  mesh.position.set(x, y, z);
  if (scale) mesh.scale.set(scale[0], scale[1], scale[2]);
  parent.add(mesh);
  return mesh;
}
export function cone(parent, r, h, color, x = 0, y = 0, z = 0, seg = 12, opts = {}) {
  const mesh = new THREE.Mesh(new THREE.ConeGeometry(r, h, seg), typeof color === "string" ? mat(color) : color);
  mesh.position.set(x, y, z);
  if (opts.rx) mesh.rotation.x = opts.rx;
  if (opts.ry) mesh.rotation.y = opts.ry;
  if (opts.rz) mesh.rotation.z = opts.rz;
  parent.add(mesh);
  return mesh;
}
export function torus(parent, r, tube, color, x = 0, y = 0, z = 0, opts = {}) {
  const mesh = new THREE.Mesh(new THREE.TorusGeometry(r, tube, 8, 24, opts.arc || Math.PI * 2), typeof color === "string" ? mat(color) : color);
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

/* ---------- a little canvas paintbox for signs & rugs ---------- */
export function textTexture(lines, opts = {}) {
  const w = opts.w || 512, h = opts.h || 256;
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  const x = c.getContext("2d");
  if (opts.bg) { x.fillStyle = opts.bg; x.fillRect(0, 0, w, h); }
  if (opts.border) {
    x.strokeStyle = opts.border; x.lineWidth = opts.borderWidth || 10;
    x.strokeRect(x.lineWidth / 2, x.lineWidth / 2, w - x.lineWidth, h - x.lineWidth);
  }
  x.fillStyle = opts.color || "#3b2f28";
  x.textAlign = "center";
  x.textBaseline = "middle";
  const list = Array.isArray(lines) ? lines : [lines];
  const size = opts.size || Math.min(w / 9, h / (list.length + 0.8));
  x.font = `${opts.weight || 600} ${size}px ${opts.font || "Georgia, serif"}`;
  list.forEach((line, i) => {
    x.fillText(line, w / 2, h / 2 + (i - (list.length - 1) / 2) * size * 1.25);
  });
  if (opts.sparkle) {
    x.fillStyle = opts.sparkle;
    for (let i = 0; i < 18; i++) {
      const sx = Math.random() * w, sy = Math.random() * h;
      x.beginPath(); x.arc(sx, sy, Math.random() * 2.4 + 1, 0, Math.PI * 2); x.fill();
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

const glowTexture = (() => {
  let tex = null;
  return () => {
    if (tex) return tex;
    const c = document.createElement("canvas");
    c.width = c.height = 128;
    const x = c.getContext("2d");
    const grad = x.createRadialGradient(64, 64, 2, 64, 64, 62);
    grad.addColorStop(0, "rgba(255,255,255,0.85)");
    grad.addColorStop(0.45, "rgba(255,255,255,0.24)");
    grad.addColorStop(1, "rgba(255,255,255,0)");
    x.fillStyle = grad; x.fillRect(0, 0, 128, 128);
    tex = new THREE.CanvasTexture(c);
    return tex;
  };
})();
export function glowSprite(parent, color, size = 1.3) {
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTexture(), color: new THREE.Color(color), transparent: true,
    blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.55
  }));
  sprite.scale.setScalar(size);
  parent.add(sprite);
  return sprite;
}

/* =====================================================================
   ANIMALS
   Faces +Z. Every creature is assembled from the same affectionate
   vocabulary of shapes, then given its own ears, tail, pattern and size.
   ===================================================================== */
export function buildAnimal(cfg) {
  const palette = cfg.palette || {};
  const shape = cfg.shape || {};
  const variant = shape.variant || "quad";
  const root = new THREE.Group();
  const fur = palette.fur || "#d9b48b";
  const belly = palette.belly || "#f8ecd9";
  const accent = palette.accent || "#b58a63";
  const eye = palette.eye || "#3b3129";
  const nose = palette.nose || "#4a3a30";
  const chubby = shape.chubby || 1;
  const fluff = shape.fluff || 1;
  const rig = { group: root, refs: { legs: [], ears: [], wings: [], eyes: [] }, height: 0.8, kind: variant };

  if (variant === "bird") buildBird(root, cfg, rig, { fur, belly, accent, eye, nose });
  else if (variant === "dragon") buildQuad(root, cfg, rig, { fur, belly, accent, eye, nose }, true);
  else buildQuad(root, cfg, rig, { fur, belly, accent, eye, nose }, false);

  if (shape.glow) {
    glowSprite(root, palette.glow || accent, 1.5).position.y = 0.42;
  }
  if (shape.hat === "chef") {
    const hat = group(root, 0, rig.height - 0.02, 0.02);
    cyl(hat, 0.13, 0.115, 0.16, "#fdfaf2", 0, 0.08, 0, 18);
    ball(hat, 0.155, "#fffdf7", 0, 0.19, 0, 16, [1, 0.65, 1]);
    cyl(hat, 0.132, 0.132, 0.045, "#f3ead9", 0, 0.015, 0, 18);
  }

  root.scale.setScalar((shape.size || 0.85) * 1.15);
  root.userData.rig = rig;
  return rig;
}

function eyePair(parent, x, y, z, eye, scale = 1) {
  const eyes = [];
  [-1, 1].forEach((side) => {
    const e = ball(parent, 0.052 * scale, eye, side * x, y, z, 14);
    e.scale.set(1, 1.14, 0.5);
    const sparkle = ball(parent, 0.017 * scale, "#ffffff", side * x + 0.013, y + 0.018, z + 0.022, 8);
    sparkle.material = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.25 });
    eyes.push(e);
  });
  return eyes;
}

function buildQuad(root, cfg, rig, colors, dragon) {
  const shape = cfg.shape || {};
  const chubby = shape.chubby || 1;
  const fluff = shape.fluff || 1;
  const legH = 0.25 * (shape.legs || 1);
  const bodyW = 0.33 * chubby;
  const bodyH = 0.29 * chubby;
  const bodyD = 0.58 * (shape.long ? 1.2 : 1);
  const bodyY = legH + bodyH / 2;

  const bodyWrapper = group(root, 0, 0, 0);
  const body = group(bodyWrapper, 0, bodyY, 0);
  rig.refs.body = bodyWrapper;
  rig.refs.bodyBase = bodyY;

  box(body, bodyW, bodyH, bodyD, colors.fur, 0, 0, 0, { r: Math.min(bodyH, bodyW) * 0.46 });
  if (shape.spikes) {
    for (let i = 0; i < 7; i++) {
      cone(body, 0.045, 0.16, colors.accent, (i % 2 ? 0.12 : -0.12), bodyH / 2 + 0.02, -0.2 + i * 0.07, 7, { rz: (i % 2 ? -1 : 1) * 0.5 });
    }
  }
  if (dragon) {
    for (let i = 0; i < 5; i++) cone(body, 0.055, 0.14, colors.accent, 0, bodyH / 2 + 0.03, 0.16 - i * 0.11, 6);
  }

  // soft belly
  const bellyPatch = box(body, bodyW * 0.76, bodyH * 0.66, bodyD * 0.7, colors.belly, 0, -bodyH * 0.08, bodyD * 0.13, { r: 0.09 });
  bellyPatch.scale.z = 0.98;

  // legs
  const rows = [bodyD * 0.29, -bodyD * 0.26];
  [-1, 1].forEach((side, si) => {
    rows.forEach((z, zi) => {
      const hip = group(bodyWrapper, side * (bodyW * 0.32), legH, z);
      const leg = box(hip, 0.105, legH, 0.11, colors.fur, 0, -legH / 2, 0, { r: 0.045 });
      box(hip, 0.13, 0.07, 0.17, colors.belly, 0, -legH + 0.02, 0.026, { r: 0.032 });
      rig.refs.legs.push(hip);
    });
  });

  // head
  const head = group(bodyWrapper, 0, bodyY + bodyH * 0.46, bodyD * 0.42);
  rig.refs.head = head;
  rig.refs.headBase = head.position.y;
  const headR = 0.21 * (shape.head || 1);
  ball(head, headR, colors.fur, 0, 0.02, 0.02, 18, [1.02, 1, 1.02]);
  ball(head, headR * 0.92, colors.belly, 0, -0.03, headR * 0.58, 16, [0.74, 0.56, 0.3]);

  // muzzle & nose
  const snout = shape.snout || 1;
  const muzzle = box(head, headR * 0.72, headR * 0.52, headR * 0.44 * snout, colors.belly, 0, -0.045, headR * 0.82, { r: 0.05 });
  ball(head, 0.033, colors.nose, 0, -0.015, headR * 0.82 + headR * 0.24 * snout, 10, [1.2, 0.85, 0.8]);

  rig.refs.eyes = eyePair(head, headR * 0.4, headR * 0.14, headR * 0.9, colors.eye, 1);
  // blush
  [-1, 1].forEach((side) => {
    const blush = ball(head, 0.045, "#f0a6a2", side * headR * 0.62, -0.06, headR * 0.7, 10, [1, 0.55, 0.25]);
    blush.material = mat("#f0a6a2", { transparent: true, opacity: 0.55 });
  });

  // ears
  const earType = shape.ears || "point";
  const earY = headR * 0.8, earZ = headR * 0.02;
  [-1, 1].forEach((side) => {
    let ear;
    if (earType === "long") {
      ear = group(head, side * headR * 0.3, earY, earZ);
      const inner = box(ear, 0.075, 0.34 * fluff, 0.055, colors.fur, 0, 0.16, 0, { r: 0.035 });
      box(ear, 0.042, 0.26 * fluff, 0.02, colors.accent, 0, 0.15, 0.038, { r: 0.02 });
      ear.rotation.z = side * -0.13;
    } else if (earType === "lop") {
      ear = group(head, side * headR * 0.6, earY * 0.82, earZ);
      const e = box(ear, 0.16, 0.075, 0.13, colors.fur, side * 0.08, 0, 0, { r: 0.036 });
      e.rotation.z = side * 0.25;
      ball(ear, 0.055, colors.accent, side * 0.15, -0.005, 0.03, 10, [1, 0.5, 0.7]);
    } else if (earType === "round") {
      ear = group(head, side * headR * 0.55, earY * 0.9, earZ);
      ball(ear, 0.085, colors.fur, 0, 0.02, 0, 14, [1, 1, 0.55]);
      ball(ear, 0.05, colors.accent, side * 0.008, 0.02, 0.032, 12, [1, 1, 0.4]);
    } else if (earType === "tuft") {
      ear = group(head, side * headR * 0.52, earY * 0.86, earZ);
      cone(ear, 0.07, 0.17, colors.fur, 0, 0.08, 0, 8, { rz: side * -0.25 });
      cone(ear, 0.03, 0.09, colors.accent, side * 0.03, 0.14, 0, 6, { rz: side * -0.4 });
    } else if (earType === "none") {
      ear = group(head, side * headR * 0.5, earY * 0.85, earZ);
    } else {
      ear = group(head, side * headR * 0.48, earY * 0.86, earZ);
      cone(ear, 0.095, 0.2, colors.fur, 0, 0.08, 0, 8, { rz: side * -0.16, rx: -0.08 });
      cone(ear, 0.048, 0.12, colors.accent, 0, 0.075, 0.025, 7, { rz: side * -0.16 });
    }
    rig.refs.ears.push(ear);
  });

  // horns, antlers and crowns
  if (shape.horns === "small") {
    [-1, 1].forEach((side) => cone(head, 0.035, 0.14, colors.accent, side * headR * 0.42, headR * 0.92, -0.02, 7, { rz: side * -0.32 }));
  } else if (shape.horns === "antler") {
    [-1, 1].forEach((side) => {
      const a = group(head, side * headR * 0.35, headR * 0.9, -0.02);
      cyl(a, 0.018, 0.024, 0.22, "#b99a72", 0, 0.11, 0, 7);
      cyl(a, 0.014, 0.018, 0.13, "#b99a72", side * 0.06, 0.16, 0, 7, { rz: side * -0.7 });
      cyl(a, 0.012, 0.015, 0.1, "#b99a72", side * -0.02, 0.24, 0.03, 7, { rz: side * 0.4, rx: 0.3 });
      rig.refs.ears.push(a);
    });
  } else if (shape.horns === "crescent") {
    const crescent = torus(head, 0.075, 0.016, colors.accent, 0, headR * 0.9, 0.22, { arc: Math.PI * 1.15, rz: Math.PI * 0.1 });
    crescent.rotation.x = 0.2;
  }

  // mane for the sun lion
  if (shape.mane) {
    for (let i = 0; i < 14; i++) {
      const angle = (i / 14) * Math.PI * 2;
      const tuft = cone(head, 0.055, 0.18, colors.accent, Math.cos(angle) * headR * 0.95, Math.sin(angle) * headR * 0.9, -0.03, 7);
      tuft.rotation.z = -angle + Math.PI / 2;
    }
  }

  // tail
  const tail = group(bodyWrapper, 0, bodyY + bodyH * 0.18, -bodyD * 0.52);
  rig.refs.tail = tail;
  const tailType = shape.tail || "fluff";
  if (tailType === "bushy") {
    const t = box(tail, 0.15, 0.15, 0.38 * fluff, colors.fur, 0, 0.04, -0.16, { r: 0.07 });
    t.rotation.x = -0.4;
    ball(tail, 0.09, colors.belly, 0, 0.11, -0.3, 12, [1, 1, 0.8]);
  } else if (tailType === "nine") {
    for (let i = 0; i < 9; i++) {
      const a = (i / 8 - 0.5) * 1.5;
      const t = group(tail, 0, 0, -0.02);
      const seg = box(t, 0.1, 0.1, 0.42 * fluff, i % 2 ? colors.accent : colors.fur, 0, 0.04, -0.2, { r: 0.045 });
      seg.rotation.x = -0.5;
      t.rotation.y = a;
      ball(t, 0.07, colors.belly, 0, 0.13, -0.42, 10, [1, 1, 0.9]);
    }
  } else if (tailType === "curl") {
    const t = torus(tail, 0.11, 0.045, colors.fur, 0, 0.08, -0.06, { rx: Math.PI / 2, ry: 0.3, arc: Math.PI * 1.5 });
    box(tail, 0.1, 0.1, 0.14, colors.fur, 0, 0.03, -0.07, { r: 0.05 });
  } else if (tailType === "stub") {
    ball(tail, 0.075, colors.belly, 0, 0.02, -0.05, 12, [1, 0.9, 0.8]);
  } else if (tailType === "puff") {
    ball(tail, 0.098, colors.belly, 0, 0.02, -0.04, 14);
  } else if (tailType === "stripe") {
    for (let i = 0; i < 3; i++) box(tail, 0.13, 0.13, 0.19, i % 2 ? colors.accent : colors.fur, 0, 0.06, -0.12 - i * 0.13, { r: 0.05, rx: -0.35 });
  } else if (tailType === "spade") {
    box(tail, 0.11, 0.1, 0.34, colors.fur, 0, 0.02, -0.15, { r: 0.04, rx: -0.2 });
    cone(tail, 0.11, 0.2, colors.accent, 0, 0.04, -0.34, 5, { rx: -Math.PI / 2 });
  } else if (tailType === "flipper") {
    box(tail, 0.26, 0.05, 0.2, colors.accent, 0, 0.01, -0.14, { r: 0.025, rz: 0.2 });
  } else if (tailType === "tuft") {
    box(tail, 0.055, 0.055, 0.3, colors.fur, 0, 0.02, -0.13, { r: 0.026, rx: -0.2 });
    ball(tail, 0.075, colors.accent, 0, 0.08, -0.28, 10);
  } else {
    box(tail, 0.09, 0.09, 0.3 * fluff, colors.fur, 0, 0.04, -0.12, { r: 0.05, rx: -0.5 });
    ball(tail, 0.075, colors.belly, 0, 0.11, -0.28, 10, [1, 1, 1.1]);
  }

  // wings (fantasy creatures)
  if (shape.wings) {
    [-1, 1].forEach((side) => {
      const wing = group(bodyWrapper, side * bodyW * 0.5, bodyY + bodyH * 0.18, -0.02);
      const shapeGeo = new THREE.Shape();
      shapeGeo.moveTo(0, 0);
      shapeGeo.quadraticCurveTo(side * 0.34, 0.26, side * 0.42, 0.03);
      shapeGeo.quadraticCurveTo(side * 0.3, -0.06, side * 0.32, -0.19);
      shapeGeo.quadraticCurveTo(side * 0.12, -0.08, 0, -0.03);
      const geo = new THREE.ExtrudeGeometry(shapeGeo, { depth: 0.012, bevelEnabled: false });
      const w = new THREE.Mesh(geo, mat(colors.belly, { transparent: true, opacity: 0.9, side: THREE.DoubleSide, emissive: cfg.palette.glow || colors.accent, emissiveIntensity: 0.16 }));
      w.rotation.y = side * 0.25;
      wing.add(w);
      rig.refs.wings.push(wing);
    });
  }

  // patterns
  const pattern = shape.pattern || "plain";
  const addSpot = (x, y, z, r = 0.05) => {
    const spot = ball(body, r, colors.accent, x, y, z, 10, [1, 1, 0.42]);
    return spot;
  };
  if (pattern === "stripe") {
    for (let i = 0; i < 4; i++) box(body, bodyW + 0.006, 0.035, 0.075, colors.accent, 0, bodyH * 0.28, bodyD * 0.28 - i * 0.17, { r: 0.02 });
  } else if (pattern === "spot") {
    for (let i = 0; i < 8; i++) {
      addSpot((Math.random() - 0.5) * bodyW * 0.85, bodyH * 0.16 + Math.random() * bodyH * 0.2, (Math.random() - 0.5) * bodyD * 0.8, 0.035 + Math.random() * 0.028);
    }
  } else if (pattern === "patch") {
    addSpot(-bodyW * 0.3, bodyH * 0.32, bodyD * 0.12, 0.11);
    addSpot(bodyW * 0.26, bodyH * 0.16, -bodyD * 0.18, 0.08);
    const earPatch = ball(head, headR * 0.5, colors.accent, 0, 0.02, headR * 0.68, 14, [0.7, 0.5, 0.3]);
  } else if (pattern === "tuxedo") {
    box(body, bodyW * 0.5, bodyH * 0.75, bodyD * 0.62, colors.belly, 0, 0.01, bodyD * 0.16, { r: 0.1 });
  }

  // chest tuft / fluffy collar
  if (fluff > 1.1) {
    for (let i = 0; i < 5; i++) {
      ball(body, 0.065 * fluff, colors.belly, (i - 2) * 0.055, bodyH * 0.42, bodyD * 0.18 + Math.abs(i - 2) * 0.012, 8, [1, 1, 0.8]);
    }
  }

  rig.height = bodyY + bodyH * 0.46 + headR * 1.7;
  rig.headAnchor = new THREE.Vector3(0, rig.height + 0.06, 0);
}

function buildBird(root, cfg, rig, colors) {
  const shape = cfg.shape || {};
  const bodyWrapper = group(root, 0, 0.2, 0);
  const body = group(bodyWrapper, 0, 0.13, 0);
  rig.refs.body = bodyWrapper;
  rig.refs.bodyBase = 0.2;
  ball(body, 0.21, colors.fur, 0, 0, 0, 18, [1, 1.12, 1.38]);
  ball(body, 0.15, colors.belly, 0, -0.04, 0.1, 16, [0.9, 0.82, 0.75]);

  const head = group(bodyWrapper, 0, 0.37, 0.08);
  rig.refs.head = head;
  rig.refs.headBase = head.position.y;
  ball(head, 0.155, colors.fur, 0, 0, 0, 18, [1, 1, 1]);
  if (shape.ear === "tuft" || family === "owl") {
    [-1, 1].forEach((side) => cone(head, 0.045, 0.12, colors.fur, side * 0.09, 0.13, -0.02, 6, { rz: side * -0.3 }));
  }
  // eyes sit on the sides for birds, front for owls
  const family = cfg.family || cfg.species || "";
  const owl = family === "owl";
  [-1, 1].forEach((side) => {
    const e = ball(head, 0.038, colors.eye, side * (owl ? 0.058 : 0.115), 0.025, owl ? 0.12 : 0.055, 12, [1, 1.1, 0.8]);
    ball(head, 0.012, "#ffffff", side * (owl ? 0.058 : 0.115) + 0.01, 0.042, owl ? 0.145 : 0.08, 8);
    rig.refs.eyes.push(e);
  });
  if (owl) {
    [-1, 1].forEach((side) => torus(head, 0.068, 0.014, colors.accent, side * 0.062, 0.025, 0.115, { rx: 0, ry: 0 }));
  }
  // beak
  if (owl) {
    cone(head, 0.038, 0.075, colors.nose, 0, -0.018, 0.145, 7, { rx: Math.PI / 2 });
  } else if (family === "duck") {
    box(head, 0.09, 0.038, 0.16, colors.nose, 0, -0.005, 0.2, { r: 0.018 });
  } else {
    cone(head, 0.045, 0.11, colors.nose, 0, -0.015, 0.18, 7, { rx: Math.PI / 2 });
  }
  [-1, 1].forEach((side) => ball(head, 0.03, "#f0a6a2", side * 0.11, -0.03, owl ? 0.08 : 0.07, 8, [1, 0.5, 0.5]));

  const wings = [];
  [-1, 1].forEach((side) => {
    const wing = group(bodyWrapper, side * 0.2, 0.24, 0);
    const w = box(wing, 0.06, 0.22, 0.3, colors.accent, side * 0.03, -0.06, -0.01, { r: 0.03 });
    w.rotation.z = side * 0.22;
    w.rotation.x = -0.12;
    rig.refs.wings.push(wing);
    wings.push(w);
  });

  // feet
  [-1, 1].forEach((side) => {
    const leg = group(bodyWrapper, side * 0.075, 0.17, 0.02);
    cyl(leg, 0.012, 0.012, 0.15, colors.nose, 0, -0.075, 0, 6);
    box(leg, 0.08, 0.016, 0.11, colors.nose, 0, -0.155, 0.035, { r: 0.008 });
    rig.refs.legs.push(leg);
  });

  // tail feathers
  const tail = group(bodyWrapper, 0, 0.2, -0.24);
  rig.refs.tail = tail;
  [-1, 0, 1].forEach((side, i) => {
    const f = box(tail, 0.07, 0.025, 0.22, i === 1 ? colors.belly : colors.accent, side * 0.05, 0.01 + Math.abs(side) * 0.02, -0.1, { r: 0.012 });
    f.rotation.y = side * 0.28;
    f.rotation.x = -0.25;
  });

  rig.height = 0.72;
  rig.headAnchor = new THREE.Vector3(0, 0.58, 0.05);
}

const animCache = new WeakMap();
export function animateCreature(rig, time, moving, energy = 1, seated = false) {
  if (!rig || !rig.refs) return;
  const refs = rig.refs;
  const speed = moving ? 8 : 2;
  const step = time * speed;
  const legs = refs.legs || [];
  legs.forEach((leg, i) => {
    const target = moving
      ? Math.sin(step + (i % 2 ? Math.PI : 0) + (i > 1 ? Math.PI : 0)) * 0.55 * energy
      : seated ? (i > 1 ? -1.15 : 0.18) : Math.sin(time * 1.2 + i) * 0.025;
    leg.rotation.x += (target - leg.rotation.x) * 0.2;
  });
  if (refs.body) {
    const base = refs.bodyBase || 0;
    const bob = moving ? Math.abs(Math.sin(step)) * 0.028 : Math.sin(time * 1.5) * 0.009;
    refs.body.position.y = base + bob;
    refs.body.rotation.z = moving ? Math.sin(step) * 0.025 : Math.sin(time * 0.7) * 0.008;
  }
  if (refs.head) {
    const base = refs.headBase || 0;
    refs.head.position.y = base + (moving ? Math.abs(Math.sin(step + 0.4)) * 0.008 : 0);
    refs.head.rotation.y = Math.sin(time * (moving ? 1.6 : 0.7)) * (moving ? 0.06 : 0.12);
    refs.head.rotation.z = Math.sin(time * 0.9 + 1) * 0.025;
  }
  if (refs.tail) {
    refs.tail.rotation.y = Math.sin(time * (moving ? 5.5 : 2.1)) * 0.42;
    refs.tail.rotation.x = Math.sin(time * 1.7) * 0.08;
  }
  (refs.ears || []).forEach((ear, i) => {
    if (ear.userData.baseZ === undefined) ear.userData.baseZ = ear.rotation.z;
    ear.rotation.z = ear.userData.baseZ + Math.sin(time * 1.4 + i * 2.1) * 0.035;
  });
  (refs.wings || []).forEach((wing, i) => {
    const flap = moving ? Math.sin(time * 11 + i * Math.PI) * 0.22 : Math.sin(time * 1.4 + i) * 0.05;
    wing.rotation.z = flap;
  });
}

export function buildCreatureShadow(radius = 0.3) {
  const disc = new THREE.Mesh(
    new THREE.CircleGeometry(radius, 16),
    new THREE.MeshBasicMaterial({ color: 0x6a5544, transparent: true, opacity: 0.14, depthWrite: false })
  );
  disc.rotation.x = -Math.PI / 2;
  disc.position.y = 0.006;
  return disc;
}

/* =====================================================================
   FOOD — one little sculpture per recipe family
   ===================================================================== */
export function buildFood(recipe, options = {}) {
  const g = new THREE.Group();
  const tone = recipe.tone || "#f3e3cc";
  const accent = recipe.accent || "#e6b8ae";
  const cat = recipe.cat;
  const art = recipe.art;

  if (cat === "Cakes") {
    const slice = new THREE.Mesh(
      new THREE.CylinderGeometry(0.19, 0.19, 0.14, 18, 1, false, 0, Math.PI / 3),
      mat(tone)
    );
    slice.rotation.y = -Math.PI / 6;
    slice.position.y = 0.07;
    g.add(slice);
    const icing = new THREE.Mesh(
      new THREE.CylinderGeometry(0.195, 0.195, 0.03, 18, 1, false, 0, Math.PI / 3),
      mat(accent)
    );
    icing.rotation.y = -Math.PI / 6;
    icing.position.y = 0.15;
    g.add(icing);
    for (let i = 0; i < 3; i++) ball(g, 0.022, accent, 0.03 + i * 0.025, 0.175, 0.02 + i * 0.03, 8);
    ball(g, 0.028, "#e0728a", 0.08, 0.19, 0.08, 8);
    cyl(g, 0.16, 0.16, 0.012, "#f7f1e5", 0, 0.006, 0, 24);
  } else if (cat === "Cookies") {
    for (let i = 0; i < 3; i++) {
      const c = cyl(g, 0.1, 0.1, 0.028, tone, 0, 0.018 + i * 0.026, 0, 14);
      c.rotation.y = i * 0.5;
      for (let j = 0; j < 5; j++) {
        const a = (j / 5) * Math.PI * 2 + i;
        ball(g, 0.012, accent, Math.cos(a) * 0.05, 0.035 + i * 0.026, Math.sin(a) * 0.05, 6);
      }
    }
  } else if (cat === "Cupcakes") {
    cyl(g, 0.115, 0.085, 0.14, accent, 0, 0.07, 0, 18);
    for (let i = 0; i < 5; i++) cyl(g, 0.118 - i * 0.002, 0.118 - i * 0.002, 0.01, "#fdf2e0", 0, 0.02 + i * 0.028, 0, 18);
    ball(g, 0.1, tone, 0, 0.17, 0, 14, [1, 0.7, 1]);
    ball(g, 0.075, tone, 0, 0.225, 0, 14, [1, 0.8, 1]);
    ball(g, 0.045, accent, 0, 0.275, 0, 12);
    ball(g, 0.025, "#d95f7a", 0, 0.31, 0, 8);
  } else if (cat === "Pancakes") {
    for (let i = 0; i < 3; i++) {
      cyl(g, 0.16, 0.155, 0.035, tone, 0, 0.022 + i * 0.038, 0, 22);
      cyl(g, 0.16, 0.16, 0.008, accent, 0, 0.042 + i * 0.038, 0, 22);
    }
    box(g, 0.055, 0.045, 0.055, "#f9e6a6", 0, 0.155, 0, { r: 0.012 });
    const syrup = cyl(g, 0.145, 0.145, 0.012, "#c68a4b", 0, 0.14, 0, 22);
    ball(g, 0.03, "#d0567a", 0.06, 0.15, 0.04, 8);
    ball(g, 0.028, "#d0567a", -0.05, 0.15, -0.04, 8);
  } else if (cat === "Waffles") {
    const base = box(g, 0.28, 0.045, 0.28, tone, 0, 0.05, 0, { r: 0.03 });
    for (let i = 0; i < 4; i++) {
      box(g, 0.26, 0.012, 0.025, accent, 0, 0.078, -0.09 + i * 0.06, { r: 0.006 });
      box(g, 0.025, 0.012, 0.26, accent, -0.09 + i * 0.06, 0.078, 0, { r: 0.006 });
    }
    for (let i = 0; i < 4; i++) ball(g, 0.023, "#cf5f7c", Math.cos(i * 1.6) * 0.08, 0.09, Math.sin(i * 1.6) * 0.08, 8);
    cyl(g, 0.05, 0.04, 0.016, "#fdf3d8", 0.06, 0.1, -0.05, 12);
  } else if (cat === "Coffee") {
    cyl(g, 0.09, 0.075, 0.04, "#f4ead9", 0, 0.02, 0, 20);
    cyl(g, 0.072, 0.058, 0.15, "#faf4e8", 0, 0.115, 0, 20);
    cyl(g, 0.066, 0.052, 0.012, "#6f4a35", 0, 0.19, 0, 18);
    const foam = cyl(g, 0.055, 0.055, 0.01, tone, 0, 0.198, 0, 18);
    torus(g, 0.045, 0.01, "#faf4e8", 0.082, 0.12, 0, { ry: Math.PI / 2 });
    ball(g, 0.012, accent, 0.01, 0.204, 0.02, 6);
    if (art === "coffee-iced") {
      cyl(g, 0.075, 0.055, 0.22, glass(), 0, 0.13, 0, 18, { open: true });
      cyl(g, 0.06, 0.045, 0.16, tone, 0, 0.12, 0, 18);
      box(g, 0.16, 0.012, 0.012, "#e6758d", 0.02, 0.25, 0, { r: 0.006 });
    }
  } else if (cat === "Tea") {
    cyl(g, 0.1, 0.095, 0.018, "#f4ead9", 0, 0.012, 0, 20);
    cyl(g, 0.075, 0.055, 0.11, "#fbf6ea", 0, 0.08, 0, 20);
    cyl(g, 0.068, 0.05, 0.008, tone, 0, 0.135, 0, 18);
    torus(g, 0.05, 0.011, "#fbf6ea", 0.085, 0.085, 0, { ry: Math.PI / 2 });
    ball(g, 0.018, accent, 0, 0.148, 0.03, 8);
    if (art === "tea-matcha") cyl(g, 0.068, 0.05, 0.012, "#8fae6f", 0, 0.142, 0, 18);
  } else if (cat === "Smoothies") {
    cyl(g, 0.075, 0.06, 0.24, glass(), 0, 0.13, 0, 20, { open: true });
    cyl(g, 0.065, 0.05, 0.18, tone, 0, 0.11, 0, 20);
    cyl(g, 0.075, 0.075, 0.012, accent, 0, 0.24, 0, 20);
    box(g, 0.016, 0.2, 0.016, "#e2819b", 0.02, 0.29, 0, { r: 0.006, rz: 0.18 });
    const fruit = ball(g, 0.035, accent, -0.06, 0.25, 0.02, 10, [1, 1, 0.5]);
    fruit.rotation.z = 0.4;
  } else if (cat === "Sandwiches") {
    box(g, 0.26, 0.04, 0.2, "#e9d3a8", 0, 0.02, 0, { r: 0.02 });
    box(g, 0.24, 0.02, 0.18, "#a9c58c", 0, 0.05, 0, { r: 0.01 });
    box(g, 0.24, 0.02, 0.18, "#f0d28b", 0, 0.07, 0, { r: 0.01 });
    box(g, 0.24, 0.02, 0.18, "#d98a76", 0, 0.09, 0.01, { r: 0.01 });
    box(g, 0.26, 0.04, 0.2, "#edd9b4", 0, 0.12, 0, { r: 0.02 });
    for (let i = 0; i < 2; i++) box(g, 0.02, 0.16, 0.02, "#c9a06d", -0.05 + i * 0.1, 0.16, 0, { r: 0.006 });
    if (art === "sand-cheese") {
      for (let i = 0; i < 3; i++) ball(g, 0.02, "#e0b463", 0.08 - i * 0.03, 0.13, 0.11 - i * 0.02, 6);
    }
  } else if (cat === "Ice Cream") {
    if (art === "ice-affogato") {
      cyl(g, 0.08, 0.06, 0.22, glass(), 0, 0.12, 0, 18, { open: true });
      ball(g, 0.065, "#e8dcc9", 0, 0.14, 0, 14, [1, 0.9, 1]);
      cyl(g, 0.05, 0.04, 0.05, tone, 0.05, 0.23, 0.02, 12);
      cyl(g, 0.055, 0.055, 0.006, "#fbf6ea", 0, 0.006, 0, 18);
    } else {
      cone(g, 0.11, 0.24, "#d9a86f", 0, 0.12, 0, 12);
      cone(g, 0.1, 0.05, "#c2905a", 0, 0.13, 0, 12, { rx: Math.PI });
      ball(g, 0.095, tone, 0, 0.28, 0, 16, [1, 0.9, 1]);
      ball(g, 0.075, accent, 0.02, 0.35, -0.01, 14, [1, 0.85, 1]);
      const cherry = ball(g, 0.03, "#bf4c5e", 0, 0.41, 0.02, 10);
      cyl(g, 0.008, 0.008, 0.06, "#5d7d4f", 0.015, 0.45, 0.02, 6, { rz: 0.3 });
      for (let i = 0; i < 4; i++) ball(g, 0.008, "#f2d18a", Math.cos(i * 1.6) * 0.06, 0.33 + i * 0.012, Math.sin(i * 1.6) * 0.05, 6);
    }
  }

  g.traverse((child) => {
    if (child.isMesh) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });
  const scale = options.scale || 1;
  g.scale.setScalar(scale);
  return g;
}
