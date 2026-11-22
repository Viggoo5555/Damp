/* =====================================================================
   PET CAFÉ — furniture models
   One builder per kind. Pieces are built at real-world scale, with the
   origin on the floor (or the centre of a wall piece / top of a hanging
   one), so the placement system can treat them all the same way.
   ===================================================================== */
import * as THREE from "three";
import { mat, glass, metal, box, cyl, ball, cone, torus, group, textTexture } from "./models.js";

const skyCache = new Map();
function windowView() {
  if (skyCache.has("view")) return skyCache.get("view");
  const c = document.createElement("canvas");
  c.width = 256; c.height = 256;
  const x = c.getContext("2d");
  const grad = x.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, "#bfe0ef");
  grad.addColorStop(0.55, "#efe4e2");
  grad.addColorStop(1, "#cfe0c3");
  x.fillStyle = grad; x.fillRect(0, 0, 256, 256);
  // soft hills and blossom
  x.fillStyle = "rgba(160,190,155,0.55)";
  x.beginPath(); x.moveTo(0, 210); x.bezierCurveTo(70, 170, 150, 205, 256, 165); x.lineTo(256, 256); x.lineTo(0, 256); x.fill();
  x.fillStyle = "rgba(255,255,255,0.5)";
  [[50, 55, 26], [120, 40, 18], [190, 66, 22]].forEach(([cx, cy, r]) => {
    x.beginPath(); x.ellipse(cx, cy, r, r * 0.5, 0, 0, Math.PI * 2); x.fill();
  });
  x.fillStyle = "rgba(226,170,175,0.75)";
  for (let i = 0; i < 26; i++) {
    x.beginPath(); x.arc(Math.random() * 256, 130 + Math.random() * 70, 2 + Math.random() * 2.5, 0, Math.PI * 2); x.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  skyCache.set("view", tex);
  return tex;
}

function floorBoardTexture(tone, accent, pattern) {
  const key = pattern + tone + accent;
  if (skyCache.has(key)) return skyCache.get(key);
  const c = document.createElement("canvas");
  c.width = c.height = 512;
  const x = c.getContext("2d");
  x.fillStyle = tone; x.fillRect(0, 0, 512, 512);
  if (pattern === "checker") {
    const n = 4, s = 512 / n;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      if ((i + j) % 2) { x.fillStyle = accent; x.fillRect(i * s, j * s, s, s); }
    }
  } else if (pattern === "terrazzo") {
    for (let i = 0; i < 900; i++) {
      x.fillStyle = i % 7 === 0 ? accent : (i % 3 === 0 ? "#cfc6b8" : "#f4efe6");
      x.beginPath();
      x.ellipse(Math.random() * 512, Math.random() * 512, 2 + Math.random() * 5, 2 + Math.random() * 4, Math.random() * 3, 0, Math.PI * 2);
      x.fill();
    }
  } else {
    const rows = 6, h = 512 / rows;
    for (let i = 0; i < rows; i++) {
      x.fillStyle = i % 2 ? accent : tone;
      x.fillRect(0, i * h, 512, h - 2);
      x.strokeStyle = "rgba(90,62,40,0.13)"; x.lineWidth = 1.5;
      x.beginPath(); x.moveTo(0, i * h + h - 1); x.lineTo(512, i * h + h - 1); x.stroke();
      for (let j = 0; j < 8; j++) {
        x.strokeStyle = "rgba(90,62,40,0.06)"; x.lineWidth = 1;
        const y = i * h + 10 + Math.random() * (h - 20);
        x.beginPath(); x.moveTo(0, y);
        x.bezierCurveTo(150, y + 5, 330, y - 5, 512, y + 2);
        x.stroke();
      }
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  skyCache.set(key, tex);
  return tex;
}

function cakeCount(group, x, y, z, count = 3, tone = "#f3ddc0", accent = "#e0a0a4") {
  for (let i = 0; i < count; i++) {
    const s = 0.09;
    cyl(group, s, s * 0.92, 0.065, tone, x + (i % 2 ? 0.1 : -0.1), y + 0.033, z + Math.floor(i / 2) * 0.16, 14);
    cyl(group, s, s, 0.02, accent, x + (i % 2 ? 0.1 : -0.1), y + 0.075, z + Math.floor(i / 2) * 0.16, 14);
    ball(group, 0.014, "#c95a72", x + (i % 2 ? 0.1 : -0.1), y + 0.093, z + Math.floor(i / 2) * 0.16, 8);
  }
}

function tableTop(g, w, d, h, tone, accent, radius = 0.05) {
  box(g, w, 0.07, d, tone, 0, h, 0, { r: radius });
  box(g, w * 0.97, 0.018, d * 0.97, accent, 0, h - 0.045, 0, { r: 0.012 });
  return h;
}

function leaf(parent, length, width, color, x, y, z, rx, ry) {
  const leafGeo = new THREE.SphereGeometry(0.5, 8, 6);
  const m = new THREE.Mesh(leafGeo, mat(color, { side: THREE.DoubleSide }));
  m.scale.set(width, 0.035, length);
  m.position.set(x, y, z);
  m.rotation.set(rx || 0, ry || 0, 0);
  parent.add(m);
  return m;
}

export function buildFurniture(def) {
  const g = new THREE.Group();
  const tone = def.tone || "#d9b98e";
  const accent = def.accent || "#b08f68";
  const w = def.w || 1, d = def.d || 1, h = def.h || 1;
  const kind = def.kind;

  switch (kind) {
    /* ---------------- tables ---------------- */
    case "round": {
      cyl(g, w / 2, w / 2, 0.075, tone, 0, 0.735, 0, 28);
      cyl(g, w / 2 + 0.004, w / 2 + 0.004, 0.018, accent, 0, 0.69, 0, 28);
      cyl(g, 0.09, 0.11, 0.66, accent, 0, 0.36, 0, 16);
      cyl(g, 0.26, 0.3, 0.035, accent, 0, 0.03, 0, 24);
      break;
    }
    case "square": {
      tableTop(g, w, d, 0.72, tone, accent, 0.04);
      [-1, 1].forEach((sx) => [-1, 1].forEach((sz) => {
        box(g, 0.075, 0.72, 0.075, accent, sx * (w / 2 - 0.09), 0.36, sz * (d / 2 - 0.09), { r: 0.02 });
      }));
      box(g, w - 0.2, 0.045, 0.045, accent, 0, 0.25, d / 2 - 0.09, { r: 0.012 });
      break;
    }
    case "marble": {
      cyl(g, w / 2, w / 2, 0.075, tone, 0, 0.75, 0, 32);
      cyl(g, w / 2 - 0.01, w / 2 - 0.01, 0.012, "#efe7db", 0, 0.793, 0, 32);
      cyl(g, 0.075, 0.075, 0.68, metal("#c9a86a"), 0, 0.39, 0, 18);
      cyl(g, 0.24, 0.26, 0.03, metal("#c9a86a"), 0, 0.03, 0, 24);
      break;
    }
    case "long": {
      tableTop(g, w, d, 0.74, tone, accent, 0.05);
      [-1, 1].forEach((sx) => {
        box(g, 0.1, 0.74, d * 0.8, accent, sx * (w / 2 - 0.3), 0.37, 0, { r: 0.025 });
        box(g, 0.55, 0.07, d * 0.84, accent, sx * (w / 2 - 0.3), 0.08, 0, { r: 0.02 });
      });
      box(g, w - 0.7, 0.06, 0.06, accent, 0, 0.2, 0, { r: 0.018 });
      break;
    }
    case "picnic": {
      tableTop(g, w, d * 0.62, 0.72, tone, accent, 0.03);
      for (let i = 0; i < 5; i++) box(g, w - 0.1, 0.012, d * 0.1, accent, 0, 0.765, -d * 0.25 + i * d * 0.115, { r: 0.004 });
      [-1, 1].forEach((sx) => {
        const leg = box(g, 0.1, 0.9, 0.1, accent, sx * (w / 2 - 0.35), 0.42, 0, { r: 0.02 });
        leg.rotation.z = sx * 0.22;
        box(g, 0.11, 0.06, d * 0.95, accent, sx * (w / 2 - 0.42), 0.36, 0, { r: 0.018 });
      });
      break;
    }
    case "coffee": {
      tableTop(g, w, d, 0.38, tone, accent, 0.03);
      [-1, 1].forEach((sx) => [-1, 1].forEach((sz) => {
        box(g, 0.06, 0.38, 0.06, accent, sx * (w / 2 - 0.07), 0.19, sz * (d / 2 - 0.06), { r: 0.016 });
      }));
      box(g, w - 0.15, 0.035, d - 0.1, accent, 0, 0.12, 0, { r: 0.012 });
      break;
    }
    case "patioround": {
      cyl(g, w / 2, w / 2, 0.06, tone, 0, 0.71, 0, 28);
      cyl(g, w / 2 + 0.005, w / 2 + 0.005, 0.016, accent, 0, 0.675, 0, 28);
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
        box(g, 0.05, 0.7, 0.05, accent, Math.cos(a) * w * 0.28, 0.35, Math.sin(a) * d * 0.28, { r: 0.02 });
      }
      break;
    }

    /* ---------------- chairs ---------------- */
    case "bent": {
      box(g, 0.47, 0.055, 0.45, tone, 0, 0.45, 0, { r: 0.025 });
      box(g, 0.4, 0.035, 0.38, accent, 0, 0.485, 0.01, { r: 0.015 });
      [-1, 1].forEach((sx) => {
        [-1, 1].forEach((sz) => box(g, 0.04, 0.45, 0.04, accent, sx * 0.19, 0.225, sz * 0.17, { r: 0.015 }));
        box(g, 0.04, 0.46, 0.04, accent, sx * 0.19, 0.7, -0.18, { r: 0.015 });
      });
      torus(g, 0.21, 0.022, tone, 0, 0.9, -0.18, { rx: 0, ry: 0, rz: 0, arc: Math.PI });
      box(g, 0.36, 0.045, 0.035, accent, 0, 0.74, -0.18, { r: 0.014 });
      box(g, 0.3, 0.03, 0.03, accent, 0, 0.64, -0.18, { r: 0.012 });
      break;
    }
    case "stool": {
      cyl(g, 0.21, 0.21, 0.06, tone, 0, 0.66, 0, 20);
      cyl(g, 0.2, 0.19, 0.02, accent, 0, 0.625, 0, 20);
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * Math.PI * 2;
        const leg = box(g, 0.038, 0.65, 0.038, accent, Math.cos(a) * 0.14, 0.33, Math.sin(a) * 0.14, { r: 0.014 });
        leg.rotation.z = Math.cos(a) * -0.10;
        leg.rotation.x = Math.sin(a) * 0.10;
      }
      torus(g, 0.15, 0.014, accent, 0, 0.22, 0, { rx: Math.PI / 2 });
      break;
    }
    case "arm": {
      box(g, 0.74, 0.16, 0.7, accent, 0, 0.4, 0, { r: 0.09 });
      box(g, 0.64, 0.12, 0.6, tone, 0, 0.5, 0.02, { r: 0.08 });
      box(g, 0.72, 0.62, 0.16, tone, 0, 0.72, -0.28, { r: 0.1 });
      [-1, 1].forEach((sx) => box(g, 0.12, 0.22, 0.6, accent, sx * 0.34, 0.56, 0.02, { r: 0.05 }));
      [-1, 1].forEach((sx) => [-1, 1].forEach((sz) => box(g, 0.055, 0.32, 0.055, accent, sx * 0.3, 0.16, sz * 0.25, { r: 0.02 })));
      break;
    }
    case "rattan": {
      cyl(g, 0.34, 0.34, 0.06, accent, 0, 0.47, 0, 20);
      cyl(g, 0.3, 0.3, 0.07, tone, 0, 0.51, 0, 20);
      const back = torus(g, 0.33, 0.035, tone, 0, 0.86, -0.24, { arc: Math.PI });
      back.scale.set(1, 1.25, 1);
      for (let i = 0; i < 7; i++) {
        const a = (i / 6) * Math.PI;
        box(g, 0.022, 0.5, 0.022, tone, Math.cos(a) * 0.33, 0.66, -0.24 + Math.sin(a) * 0.0, { r: 0.01 });
      }
      for (let i = 0; i < 4; i++) torus(g, 0.33 - i * 0.005, 0.012, accent, 0, 0.58 + i * 0.1, -0.24, { arc: Math.PI });
      [-1, 1].forEach((sx) => [-1, 1].forEach((sz) => {
        const leg = box(g, 0.045, 0.47, 0.045, tone, sx * 0.2, 0.23, sz * 0.17, { r: 0.018 });
        leg.rotation.z = sx * 0.08;
      }));
      break;
    }
    case "booth": {
      box(g, 0.5, 0.12, d - 0.05, accent, 0, 0.44, 0, { r: 0.05 });
      box(g, w - 0.2, 0.15, d, tone, 0, 0.42, 0, { r: 0.06 });
      box(g, w, 0.65, 0.16, tone, 0, 0.75, -d / 2 + 0.08, { r: 0.08 });
      [-1, 1].forEach((sx) => box(g, 0.12, 0.4, d, accent, sx * (w / 2 - 0.06), 0.6, 0, { r: 0.04 }));
      box(g, 0.12, 0.12, d, tone, 0, 0.53, 0, { r: 0.05 });
      [-1, 1].forEach((sx) => box(g, 0.06, 0.36, 0.06, accent, sx * (w / 2 - 0.14), 0.18, 0, { r: 0.02 }));
      break;
    }
    case "cushion": {
      box(g, 0.58, 0.16, 0.58, tone, 0, 0.09, 0, { r: 0.14 });
      box(g, 0.46, 0.1, 0.46, accent, 0, 0.18, 0, { r: 0.12 });
      ball(g, 0.035, accent, 0, 0.24, 0, 10, [1, 0.4, 1]);
      break;
    }
    case "highback": {
      box(g, 0.66, 0.18, 0.64, accent, 0, 0.42, 0, { r: 0.08 });
      box(g, 0.6, 0.12, 0.56, tone, 0, 0.53, 0.02, { r: 0.08 });
      box(g, 0.68, 1.05, 0.16, tone, 0, 0.85, -0.27, { r: 0.12 });
      for (let i = 0; i < 3; i++) box(g, 0.5, 0.012, 0.012, accent, 0, 0.55 + i * 0.22, -0.19, { r: 0.005 });
      [-1, 1].forEach((sx) => [-1, 1].forEach((sz) => box(g, 0.045, 0.4, 0.045, accent, sx * 0.28, 0.2, sz * 0.23, { r: 0.018, rz: sx * 0.06 })));
      break;
    }
    case "kids": {
      box(g, 0.48, 0.09, 0.46, tone, 0, 0.34, 0, { r: 0.05 });
      box(g, 0.46, 0.5, 0.1, tone, 0, 0.56, -0.19, { r: 0.07 });
      [-1, 1].forEach((sx) => {
        ball(g, 0.09, accent, sx * 0.14, 0.84, -0.19, 12, [1, 0.9, 0.5]);
        box(g, 0.035, 0.3, 0.035, accent, sx * 0.19, 0.16, 0.17, { r: 0.014 });
        box(g, 0.035, 0.3, 0.035, accent, sx * 0.19, 0.16, -0.17, { r: 0.014 });
      });
      box(g, 0.42, 0.035, 0.035, accent, 0, 0.13, 0.2, { r: 0.012 });
      break;
    }

    /* ---------------- sofas ---------------- */
    case "loveseat": {
      box(g, w, 0.22, d, accent, 0, 0.3, 0, { r: 0.09 });
      [-1, 0, 1].slice(1, 3).forEach((i) => box(g, w / 2 - 0.08, 0.16, d - 0.12, tone, i * (w / 4), 0.46, 0.04, { r: 0.08 }));
      box(g, w, 0.58, 0.18, tone, 0, 0.6, -d / 2 + 0.09, { r: 0.1 });
      [-1, 1].forEach((sx) => box(g, 0.16, 0.3, d, accent, sx * (w / 2 - 0.08), 0.48, 0, { r: 0.07 }));
      [-1, 1].forEach((sx) => [-1, 1].forEach((sz) => box(g, 0.06, 0.26, 0.06, accent, sx * (w / 2 - 0.14), 0.13, sz * (d / 2 - 0.12), { r: 0.02 })));
      break;
    }
    case "sofa": {
      box(g, w, 0.34, d, accent, 0, 0.3, 0, { r: 0.1 });
      for (let i = 0; i < 3; i++) box(g, w / 3 - 0.08, 0.18, d - 0.16, tone, -w / 3 + i * (w / 3), 0.55, 0.05, { r: 0.09 });
      box(g, w, 0.62, 0.2, tone, 0, 0.66, -d / 2 + 0.1, { r: 0.11 });
      [-1, 1].forEach((sx) => box(g, 0.18, 0.34, d, accent, sx * (w / 2 - 0.09), 0.53, 0, { r: 0.08 }));
      [-1, 1].forEach((sx) => [-1, 1].forEach((sz) => box(g, 0.06, 0.24, 0.06, accent, sx * (w / 2 - 0.16), 0.12, sz * (d / 2 - 0.14), { r: 0.02 })));
      break;
    }
    case "corner": {
      box(g, w, 0.3, d * 0.52, accent, 0, 0.3, -d * 0.24, { r: 0.1 });
      box(g, w * 0.5, 0.3, d, accent, -w * 0.25, 0.3, 0, { r: 0.1 });
      box(g, w - 0.2, 0.16, d * 0.42, tone, 0, 0.5, -d * 0.24, { r: 0.08 });
      box(g, w * 0.42, 0.16, d - 0.3, tone, -w * 0.24, 0.5, 0.05, { r: 0.08 });
      box(g, w, 0.55, 0.18, tone, 0, 0.62, -d / 2 + 0.09, { r: 0.1 });
      box(g, 0.18, 0.55, d, tone, -w / 2 + 0.09, 0.62, 0, { r: 0.1 });
      [-1, 1].forEach((sx) => box(g, 0.05, 0.24, 0.05, accent, wx(sx, 0.16, w), 0.13, d / 2 - 0.18, { r: 0.02 }));
      break;
    }
    case "beanbag": {
      ball(g, 0.44, tone, 0, 0.32, 0, 18, [1, 0.78, 1]);
      ball(g, 0.3, accent, 0, 0.14, 0, 16, [1.15, 0.45, 1.15]);
      ball(g, 0.11, tone, 0, 0.55, -0.16, 12, [1.2, 0.55, 1]);
      break;
    }
    case "windowbench": {
      box(g, w, 0.12, d, accent, 0, 0.42, 0, { r: 0.04 });
      box(g, w - 0.1, 0.1, d - 0.08, tone, 0, 0.53, 0.01, { r: 0.04 });
      for (let i = 0; i < 3; i++) box(g, w / 3 - 0.06, 0.07, d - 0.06, accent, -w / 3 + i * (w / 3), 0.58, 0.01, { r: 0.03 });
      [-1, 1].forEach((sx) => box(g, 0.07, 0.42, d - 0.08, accent, sx * (w / 2 - 0.06), 0.21, 0, { r: 0.02 }));
      break;
    }

    /* ---------------- counters ---------------- */
    case "pastry": {
      box(g, w, h - 0.12, d, tone, 0, (h - 0.12) / 2, 0, { r: 0.05 });
      box(g, w + 0.06, 0.09, d + 0.06, accent, 0, h - 0.05, 0, { r: 0.025 });
      for (let i = 0; i < 4; i++) {
        box(g, 0.04, h - 0.3, 0.02, accent, -w / 2 + 0.2 + i * (w - 0.4) / 3, (h - 0.2) / 2, d / 2 + 0.005, { r: 0.01 });
      }
      // glass display case
      box(g, w * 0.52, 0.04, d * 0.7, "#fbf6ec", -w * 0.18, h + 0.02, 0, { r: 0.02 });
      box(g, w * 0.52, 0.62, 0.03, glass(), -w * 0.18, h + 0.32, d * 0.3, { r: 0.01, matOpts: {} });
      box(g, w * 0.52, 0.03, d * 0.66, glass(), -w * 0.18, h + 0.64, 0, { r: 0.01 });
      cakeCount(g, -w * 0.18, h + 0.04, 0, 4, "#f4dfc2", "#dfa3a2");
      // register
      box(g, 0.34, 0.22, 0.3, "#e8e2d6", w * 0.32, h + 0.11, 0, { r: 0.04 });
      box(g, 0.22, 0.16, 0.02, "#55645c", w * 0.32, h + 0.23, 0.14, { r: 0.02 });
      // little vase
      cyl(g, 0.05, 0.06, 0.16, "#ecdfe5", w * 0.04, h + 0.08, -d * 0.22, 12);
      for (let i = 0; i < 3; i++) ball(g, 0.045, i % 2 ? "#eab2b8" : "#f4ddb6", w * 0.04 + (i - 1) * 0.04, h + 0.2, -d * 0.22, 8);
      break;
    }
    case "bar":
    case "bar2": {
      const big = kind === "bar2";
      box(g, w, h - 0.1, d, big ? tone : accent, 0, (h - 0.1) / 2, 0, { r: 0.05 });
      box(g, w + 0.08, 0.08, d + 0.08, big ? "#f4eee2" : tone, 0, h - 0.04, 0, { r: 0.025 });
      for (let i = 0; i < 3; i++) box(g, 0.5, 0.5, 0.02, big ? accent : tone, -w / 3 + i * (w / 3), h * 0.45, d / 2 + 0.005, { r: 0.02 });
      // espresso machine on the bar
      const mx = -w * 0.2;
      box(g, 0.52, 0.32, 0.4, "#d6d8d2", mx, h + 0.16, 0, { r: 0.05 });
      box(g, 0.44, 0.09, 0.32, "#9aa29d", mx, h + 0.36, 0, { r: 0.03 });
      cyl(g, 0.055, 0.055, 0.1, "#8d9490", mx - 0.12, h + 0.12, 0.22, 12);
      cyl(g, 0.055, 0.055, 0.1, "#8d9490", mx + 0.12, h + 0.12, 0.22, 12);
      box(g, 0.22, 0.03, 0.16, "#6f7873", mx, h + 0.04, 0.2, { r: 0.01 });
      cyl(g, 0.035, 0.025, 0.06, "#fdf8ee", mx - 0.12, h + 0.035, 0.24, 10);
      cyl(g, 0.035, 0.025, 0.06, "#fdf8ee", mx + 0.12, h + 0.035, 0.24, 10);
      // cups and pastry dome
      for (let i = 0; i < 4; i++) cyl(g, 0.04, 0.032, 0.06, i % 2 ? "#f7efe1" : "#e9c4be", w * 0.14 + (i - 1.5) * 0.1, h + 0.05, -d * 0.2, 10);
      const dome = new THREE.Mesh(new THREE.SphereGeometry(0.16, 18, 12, 0, Math.PI * 2, 0, Math.PI / 2), glass());
      dome.position.set(w * 0.28, h + 0.02, 0);
      g.add(dome);
      cakeCount(g, w * 0.28, h + 0.02, 0, 2, "#f5e3c6", "#dba0a2");
      if (big) {
        for (let i = 0; i < 3; i++) box(g, 0.02, h - 0.3, 0.02, metal("#c9a86a"), -w / 2 + 0.15, (h - 0.2) / 2, d / 2 + 0.012, { r: 0.008 });
      }
      break;
    }
    case "display": {
      box(g, w, 0.9, d, "#efe6d8", 0, 0.45, 0, { r: 0.04 });
      box(g, w + 0.05, 0.06, d + 0.05, accent, 0, 0.92, 0, { r: 0.02 });
      box(g, w - 0.12, 0.62, d - 0.1, glass(), 0, 1.25, 0, { r: 0.02, matOpts: {} });
      box(g, w - 0.1, 0.03, d - 0.08, "#fbf6ec", 0, 1.56, 0, { r: 0.01 });
      box(g, w - 0.16, 0.03, d - 0.14, "#fbf6ec", 0, 1.22, 0, { r: 0.01 });
      cakeCount(g, 0, 1.58, 0, 2, "#f2ddc0", "#dea5a8");
      cakeCount(g, 0, 1.24, 0, 2, "#eccfa8", "#ba7f6b");
      cyl(g, 0.035, 0.03, 0.06, "#c9a86a", w / 2 - 0.08, 0.95, -d / 2 + 0.08, 10);
      break;
    }
    case "reception": {
      box(g, w, h - 0.08, d, tone, 0, (h - 0.08) / 2, 0, { r: 0.05 });
      box(g, w + 0.06, 0.08, d + 0.08, accent, 0, h - 0.04, 0, { r: 0.025 });
      box(g, w - 0.2, h - 0.3, 0.03, accent, 0, (h - 0.1) / 2, d / 2 + 0.006, { r: 0.01 });
      for (let i = 0; i < 2; i++) box(g, 0.03, h - 0.32, 0.02, "#efe4d2", -0.18 + i * 0.36, (h - 0.1) / 2, d / 2 + 0.02, { r: 0.01 });
      // bell
      const bell = new THREE.Mesh(new THREE.SphereGeometry(0.075, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2), metal("#d8bd86"));
      bell.position.set(w * 0.24, h + 0.01, 0);
      g.add(bell);
      cyl(g, 0.08, 0.08, 0.015, metal("#c8a86f"), w * 0.24, h + 0.005, 0, 16);
      box(g, 0.02, 0.05, 0.02, metal("#b99a65"), w * 0.24, h + 0.07, 0, { r: 0.006 });
      cyl(g, 0.06, 0.07, 0.12, "#e8d6c4", -w * 0.3, h + 0.06, 0, 12);
      for (let i = 0; i < 3; i++) leaf(g, 0.28, 0.09, "#6f9470", -w * 0.3, h + 0.2, 0, -0.5 + i * 0.4, i * 1.2);
      break;
    }
    case "cake": {
      box(g, w, 0.6, d, "#ead9c4", 0, 0.3, 0, { r: 0.04 });
      box(g, w + 0.06, 0.05, d + 0.06, accent, 0, 0.62, 0, { r: 0.02 });
      box(g, w - 0.1, 1.0, d - 0.08, glass(), 0, 1.15, 0, { r: 0.02, matOpts: {} });
      box(g, w - 0.02, 0.05, d - 0.02, "#f8f1e5", 0, 1.68, 0, { r: 0.02 });
      cakeCount(g, 0, 1.66, 0, 3, "#f4dfc4", "#dfa6a4");
      cakeCount(g, 0, 1.2, 0, 3, "#ecd0a9", "#c08b75");
      box(g, w - 0.16, 0.03, d - 0.14, "#fbf6ec", 0, 1.18, 0, { r: 0.01 });
      box(g, 0.03, 1.0, d - 0.08, glass(), 0, 1.15, 0, { r: 0.01 });
      break;
    }

    /* ---------------- kitchen ---------------- */
    case "stove": {
      box(g, w, 0.82, d, tone, 0, 0.41, 0, { r: 0.04 });
      box(g, w + 0.02, 0.06, d + 0.02, "#4a4f4b", 0, 0.86, 0, { r: 0.02 });
      for (let i = 0; i < 4; i++) {
        const bx = -w * 0.24 + (i % 2) * w * 0.48;
        const bz = -d * 0.18 + Math.floor(i / 2) * d * 0.36;
        torus(g, 0.085, 0.014, "#333634", bx, 0.895, bz, { rx: Math.PI / 2 });
        torus(g, 0.055, 0.009, "#6d736e", bx, 0.897, bz, { rx: Math.PI / 2 });
      }
      for (let i = 0; i < 3; i++) cyl(g, 0.022, 0.022, 0.04, "#d8d4c9", -w * 0.25 + i * 0.09, 0.62, d / 2 + 0.005, 10, { rx: Math.PI / 2 });
      // pot with steam lid
      cyl(g, 0.14, 0.12, 0.16, "#b7bdb8", -w * 0.22, 1.0, 0, 16);
      cyl(g, 0.145, 0.145, 0.025, "#9aa19c", -w * 0.22, 1.09, 0, 16);
      ball(g, 0.028, "#e6e2d8", -w * 0.22, 1.11, 0, 10);
      torus(g, 0.14, 0.012, "#8b928d", -w * 0.22, 1.0, 0, { rx: Math.PI / 2 });
      // pan
      cyl(g, 0.13, 0.12, 0.035, "#4e5250", w * 0.22, 0.92, 0, 16);
      box(g, 0.035, 0.02, 0.22, "#4e5250", w * 0.22, 0.94, 0.18, { r: 0.01 });
      box(g, w - 0.2, 0.16, 0.02, "#5b615c", 0, 0.5, d / 2 + 0.004, { r: 0.01 });
      break;
    }
    case "oven": {
      box(g, w, h, d, tone, 0, h / 2, 0, { r: 0.05 });
      box(g, w - 0.18, 0.5, 0.035, "#35393a", 0, h * 0.42, d / 2 + 0.005, { r: 0.03 });
      box(g, w - 0.24, 0.4, 0.02, glass(), 0, h * 0.42, d / 2 + 0.03, { r: 0.02 });
      box(g, w - 0.3, 0.03, 0.05, "#d9d3c5", 0, h * 0.42, d / 2 + 0.02, { r: 0.01 });
      box(g, w - 0.2, 0.04, 0.05, metal("#bcb6a7"), 0, h * 0.72, d / 2 + 0.04, { r: 0.015 });
      for (let i = 0; i < 2; i++) cyl(g, 0.028, 0.028, 0.03, "#4b4f4d", w * 0.24 + i * 0.12, h * 0.85, d / 2 + 0.03, 10, { rx: Math.PI / 2 });
      box(g, w - 0.1, 0.04, d - 0.1, "#5a5f5b", 0, h + 0.01, 0, { r: 0.02 });
      break;
    }
    case "espresso": {
      box(g, 0.78, 0.2, 0.6, "#d8dad4", 0, 0.1, 0, { r: 0.04 });
      box(g, w, 0.42, d, "#d3d6d0", 0, 0.42, 0, { r: 0.06 });
      box(g, w - 0.06, 0.08, d - 0.06, "#a7ada7", 0, h - 0.02, 0, { r: 0.03 });
      box(g, 0.5, 0.2, 0.03, "#5f6661", 0, 0.58, d / 2 + 0.005, { r: 0.02 });
      [-1, 1].forEach((sx) => {
        cyl(g, 0.06, 0.06, 0.1, "#8d948f", sx * 0.16, 0.4, d / 2 + 0.02, 12);
        cyl(g, 0.05, 0.035, 0.07, "#fdf8ed", sx * 0.16, 0.3, d / 2 + 0.04, 12);
        cyl(g, 0.018, 0.018, 0.1, "#6d736e", sx * 0.29, 0.55, 0.12, 8, { rz: 0.2 });
      });
      cyl(g, 0.16, 0.16, 0.02, "#ece5d6", 0, h + 0.02, 0, 18);
      for (let i = 0; i < 4; i++) cyl(g, 0.035, 0.028, 0.05, "#fbf5e9", -0.12 + (i % 2) * 0.24, h + 0.05, -0.1 + Math.floor(i / 2) * 0.2, 10);
      cyl(g, 0.06, 0.07, 0.1, "#c7bda9", 0.28, 0.66, -0.1, 12);
      for (let i = 0; i < 3; i++) cyl(g, 0.012, 0.012, 0.2, "#8d6b4f", 0.28, 0.78, -0.1 + (i - 1) * 0.03, 6);
      break;
    }
    case "blender": {
      cyl(g, 0.24, 0.26, 0.07, "#e7eae6", 0, 0.035, 0, 18);
      box(g, 0.22, 0.16, 0.22, "#d6dbd6", 0, 0.13, 0, { r: 0.04 });
      cyl(g, 0.17, 0.2, 0.3, glass(), 0, 0.35, 0, 18);
      cyl(g, 0.16, 0.19, 0.22, "#eec3a8", 0, 0.31, 0, 18);
      cyl(g, 0.2, 0.2, 0.04, "#b9c3bd", 0, 0.52, 0, 18);
      ball(g, 0.05, "#c78a5e", 0, 0.55, 0, 12);
      cyl(g, 0.025, 0.022, 0.36, "#dfe2dc", 0.02, 0.72, 0, 10);
      break;
    }
    case "freezer": {
      box(g, w, 0.86, d, "#eef2f2", 0, 0.43, 0, { r: 0.07 });
      box(g, w - 0.08, 0.06, d - 0.08, "#d6e1e3", 0, 0.9, 0, { r: 0.03 });
      box(g, w - 0.16, 0.32, 0.03, glass(), 0, 0.95, d / 2 - 0.05, { r: 0.02 });
      box(g, w - 0.4, 0.04, 0.06, metal("#b8c3c5"), 0, 0.7, d / 2 + 0.01, { r: 0.015 });
      for (let i = 0; i < 4; i++) {
        cyl(g, 0.055, 0.04, 0.09, i % 2 ? "#f2dcc4" : "#e8c5cf", -w * 0.3 + i * w * 0.2, 0.98, -0.02, 12);
        ball(g, 0.045, "#f6e9dc", -w * 0.3 + i * w * 0.2, 1.05, -0.02, 10);
      }
      break;
    }
    case "fridge": {
      box(g, w, h, d, "#e9eef0", 0, h / 2, 0, { r: 0.06 });
      box(g, w - 0.05, h * 0.55, 0.02, "#dde5e7", 0, h * 0.72, d / 2 + 0.005, { r: 0.02 });
      box(g, w - 0.05, h * 0.38, 0.02, "#dde5e7", 0, h * 0.23, d / 2 + 0.005, { r: 0.02 });
      box(g, 0.04, 0.4, 0.05, metal("#b8c0c1"), w * 0.3, h * 0.72, d / 2 + 0.04, { r: 0.015 });
      box(g, 0.04, 0.26, 0.05, metal("#b8c0c1"), w * 0.3, h * 0.26, d / 2 + 0.04, { r: 0.015 });
      ball(g, 0.02, "#7f9698", -w * 0.25, h * 0.86, d / 2 + 0.03, 8);
      box(g, 0.02, 0.02, 0.02, "#7f9698", -w * 0.25, h * 0.9, d / 2 + 0.03, { r: 0.005 });
      break;
    }
    case "prep": {
      box(g, w, 0.84, d, tone, 0, 0.42, 0, { r: 0.05 });
      box(g, w + 0.06, 0.075, d + 0.06, "#f1e6d5", 0, 0.86, 0, { r: 0.03 });
      for (let i = 0; i < 2; i++) box(g, w * 0.42, 0.5, 0.03, accent, -w * 0.24 + i * w * 0.48, 0.42, d / 2 + 0.005, { r: 0.02 });
      box(g, 0.45, 0.03, 0.32, "#c8a276", -w * 0.18, 0.9, 0, { r: 0.02 });
      ball(g, 0.1, "#e7d7c2", w * 0.24, 0.95, 0, 14, [1, 0.5, 1]);
      ball(g, 0.09, "#d6e3d3", w * 0.24, 0.96, 0.01, 14, [1, 0.35, 1]);
      cyl(g, 0.05, 0.04, 0.2, "#b7c2b3", w * 0.05, 1.0, -0.05, 10);
      break;
    }
    case "spices": {
      box(g, w, 0.06, d, tone, 0, 0, 0, { r: 0.02 });
      box(g, w, 0.06, d, tone, 0, 0.42, 0, { r: 0.02 });
      box(g, 0.05, 0.45, d, accent, -w / 2 + 0.03, 0.21, 0, { r: 0.015 });
      box(g, 0.05, 0.45, d, accent, w / 2 - 0.03, 0.21, 0, { r: 0.015 });
      const colors = ["#c98f5a", "#a9b97e", "#d6a4a4", "#8f9fb5", "#d9c07e", "#b7868f"];
      for (let i = 0; i < 6; i++) {
        cyl(g, 0.055, 0.055, 0.12, colors[i], -w * 0.36 + i * w * 0.14, 0.1, 0, 12);
        cyl(g, 0.058, 0.058, 0.02, "#c9b28a", -w * 0.36 + i * w * 0.14, 0.17, 0, 12);
      }
      for (let i = 0; i < 4; i++) {
        cyl(g, 0.06, 0.06, 0.12, colors[(i + 2) % 6], -w * 0.28 + i * w * 0.19, 0.53, 0, 12);
        cyl(g, 0.063, 0.063, 0.02, "#c9b28a", -w * 0.28 + i * w * 0.19, 0.6, 0, 12);
      }
      break;
    }
    case "sink": {
      box(g, w, 0.82, d, tone, 0, 0.41, 0, { r: 0.04 });
      box(g, w + 0.04, 0.07, d + 0.04, "#eeeae0", 0, 0.84, 0, { r: 0.03 });
      box(g, w * 0.62, 0.06, d * 0.62, "#b9c4c1", 0, 0.865, 0, { r: 0.03 });
      box(g, w * 0.55, 0.03, d * 0.55, "#9ba9a6", 0, 0.875, 0, { r: 0.02 });
      box(g, 0.05, 0.32, 0.05, metal("#b9c0ba"), 0, 1.02, -d * 0.28, { r: 0.018 });
      const spout = box(g, 0.035, 0.035, 0.2, metal("#b9c0ba"), 0, 1.17, -d * 0.28 + 0.09, { r: 0.015 });
      spout.rotation.x = 0.35;
      cyl(g, 0.06, 0.06, 0.2, "#e4dccd", w * 0.38, 0.95, 0, 12);
      for (let i = 0; i < 3; i++) leaf(g, 0.22, 0.07, "#7ba078", w * 0.38, 1.09, 0.02, -0.4 + i * 0.4, i * 1.3);
      break;
    }

    /* ---------------- plants ---------------- */
    case "monstera":
    case "fern":
    case "palm":
    case "olive":
    case "tulips":
    case "cactus":
    case "ivy":
    case "herbs": {
      const potH = kind === "olive" ? 0.4 : kind === "herbs" ? 0.24 : 0.28;
      if (kind === "herbs") {
        box(g, w, potH, d, "#b98b66", 0, potH / 2, 0, { r: 0.04 });
        for (let i = 0; i < 3; i++) {
          const hx = -0.22 + i * 0.22;
          for (let j = 0; j < 4; j++) leaf(g, 0.18, 0.1, i === 1 ? "#6f9668" : "#86a878", hx, potH + 0.1 + j * 0.03, 0, -0.9 + j * 0.3, j);
        }
        break;
      }
      const potR = Math.min(w, d) * 0.34;
      cyl(g, potR, potR * 0.78, potH, tone, 0, potH / 2, 0, 18);
      cyl(g, potR * 1.08, potR * 1.05, 0.05, accent, 0, potH, 0, 18);
      cyl(g, potR * 0.9, potR * 0.9, 0.02, "#5c4a3a", 0, potH + 0.02, 0, 18);
      if (kind === "cactus") {
        cyl(g, 0.09, 0.11, 0.5, accent, 0, potH + 0.27, 0, 12);
        ball(g, 0.09, accent, 0, potH + 0.52, 0, 12, [1, 0.6, 1]);
        const arm = cyl(g, 0.055, 0.06, 0.22, accent, 0.12, potH + 0.34, 0, 10, { rz: -0.9 });
        cyl(g, 0.05, 0.055, 0.2, accent, 0.2, potH + 0.43, 0, 10);
        ball(g, 0.04, "#e79aa4", 0, potH + 0.58, 0, 8);
      } else if (kind === "tulips") {
        for (let i = 0; i < 5; i++) {
          const a = (i / 5) * Math.PI * 2;
          cyl(g, 0.008, 0.01, 0.34, "#7d9a64", Math.cos(a) * 0.05, potH + 0.17, Math.sin(a) * 0.05, 6);
          const bulb = ball(g, 0.045, i % 2 ? accent : "#f0c7cb", Math.cos(a) * 0.05, potH + 0.36, Math.sin(a) * 0.05, 10, [1, 1.35, 1]);
          leaf(g, 0.2, 0.07, "#7d9a64", Math.cos(a) * 0.08, potH + 0.12, Math.sin(a) * 0.08, -0.7, a);
        }
      } else if (kind === "ivy") {
        for (let i = 0; i < 5; i++) {
          const a = (i / 5) * Math.PI * 2;
          const strand = group(g, Math.cos(a) * potR * 0.8, potH, Math.sin(a) * potR * 0.8);
          for (let j = 0; j < 5; j++) {
            const px = Math.cos(a) * 0.02 * j;
            const pz = Math.sin(a) * 0.02 * j;
            leaf(strand, 0.12, 0.09, accent, px, -0.12 - j * 0.11, pz, 0.3, a + j);
          }
        }
        ball(g, 0.12, accent, 0, potH + 0.1, 0, 12, [1.3, 0.7, 1.3]);
      } else if (kind === "olive") {
        cyl(g, 0.06, 0.09, 0.9, "#9c7f62", 0, potH + 0.45, 0, 12);
        for (let i = 0; i < 4; i++) {
          const a = (i / 4) * Math.PI * 2;
          const branch = cyl(g, 0.028, 0.04, 0.5, "#9c7f62", Math.cos(a) * 0.15, potH + 0.9, Math.sin(a) * 0.15, 8, { rz: Math.cos(a) * 0.55, rx: -Math.sin(a) * 0.55 });
          for (let j = 0; j < 7; j++) {
            leaf(g, 0.2, 0.06, j % 2 ? accent : "#a3b79a", Math.cos(a) * (0.25 + j * 0.025) + (Math.random() - 0.5) * 0.16, potH + 1.02 + j * 0.06, Math.sin(a) * (0.25 + j * 0.025) + (Math.random() - 0.5) * 0.16, -0.5, Math.random() * 3);
          }
        }
        break;
      } else if (kind === "palm") {
        cyl(g, 0.055, 0.08, 1.15, "#a58a68", 0, potH + 0.57, 0, 10);
        for (let i = 0; i < 9; i++) {
          const a = (i / 9) * Math.PI * 2;
          leaf(g, 0.72, 0.12, i % 2 ? accent : "#79a074", Math.cos(a) * 0.24, potH + 1.14, Math.sin(a) * 0.24, -0.5 + Math.sin(i) * 0.2, a);
        }
        break;
      } else {
        const tall = kind === "monstera";
        const stems = tall ? 5 : 9;
        for (let i = 0; i < stems; i++) {
          const a = (i / stems) * Math.PI * 2 + 0.4;
          const hgt = 0.42 + (tall ? 0.5 : 0.16) + Math.random() * 0.1;
          const st = cyl(g, 0.012, 0.016, hgt, "#6d8b5f", Math.cos(a) * 0.05, potH + hgt / 2, Math.sin(a) * 0.05, 6, { rz: Math.cos(a) * 0.14, rx: -Math.sin(a) * 0.14 });
          leaf(g, tall ? 0.34 : 0.26, tall ? 0.24 : 0.08, accent, Math.cos(a) * 0.14, potH + hgt, Math.sin(a) * 0.14, -0.55 + Math.random() * 0.3, a + Math.PI / 2);
        }
        if (tall) {
          ball(g, 0.18, accent, 0, potH + 0.62, 0, 12, [1.4, 0.5, 1.4]);
        }
      }
      break;
    }

    /* ---------------- decor ---------------- */
    case "cakestand": {
      cyl(g, 0.17, 0.18, 0.02, tone, 0, 0.02, 0, 20);
      cyl(g, 0.025, 0.03, 0.14, accent, 0, 0.1, 0, 10);
      cyl(g, 0.2, 0.19, 0.025, tone, 0, 0.19, 0, 22);
      cyl(g, 0.12, 0.12, 0.13, "#f6e6cf", 0, 0.27, 0, 16);
      cyl(g, 0.125, 0.125, 0.03, accent, 0, 0.35, 0, 16);
      for (let i = 0; i < 3; i++) ball(g, 0.022, "#d0687d", Math.cos(i * 2.1) * 0.07, 0.37, Math.sin(i * 2.1) * 0.07, 8);
      break;
    }
    case "books": {
      const colors = ["#c78b7e", "#8fa5b8", "#d9b98d", "#a3b393"];
      for (let i = 0; i < 4; i++) {
        const b = box(g, 0.27 - i * 0.02, 0.045, 0.2 - i * 0.01, colors[i], 0.01 * i, 0.024 + i * 0.048, 0, { r: 0.008 });
        b.rotation.y = i * 0.14 - 0.18;
      }
      box(g, 0.2, 0.03, 0.16, "#e8dcc7", 0.08, 0.21, 0.01, { r: 0.006, ry: -0.4 });
      break;
    }
    case "vase": {
      cyl(g, 0.08, 0.06, 0.22, tone, 0, 0.11, 0, 14);
      cyl(g, 0.065, 0.08, 0.06, tone, 0, 0.24, 0, 14);
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        cyl(g, 0.005, 0.006, 0.28, "#7f9b6f", Math.cos(a) * 0.02, 0.36, Math.sin(a) * 0.02, 5, { rz: Math.cos(a) * 0.18, rx: -Math.sin(a) * 0.18 });
        ball(g, 0.045, i % 2 ? accent : "#f3d7a8", Math.cos(a) * 0.1, 0.47, Math.sin(a) * 0.1, 9, [1, 1, 0.6]);
      }
      break;
    }
    case "clock": {
      cyl(g, 0.24, 0.24, 0.06, tone, 0, 0, 0, 26, { rx: Math.PI / 2 });
      cyl(g, 0.205, 0.205, 0.02, "#fbf6ec", 0, 0, 0.035, 26, { rx: Math.PI / 2 });
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        box(g, 0.012, 0.03, 0.01, accent, Math.sin(a) * 0.16, Math.cos(a) * 0.16, 0.048, { r: 0.004, rz: -a });
      }
      const h1 = box(g, 0.018, 0.085, 0.01, "#5b4a3c", 0, 0.035, 0.055, { r: 0.006 });
      h1.rotation.z = 0.7;
      const h2 = box(g, 0.014, 0.13, 0.01, "#5b4a3c", 0, 0.045, 0.06, { r: 0.005 });
      h2.rotation.z = -1.9;
      ball(g, 0.018, accent, 0, 0, 0.065, 8);
      break;
    }
    case "picture": {
      box(g, w + 0.09, h + 0.09, 0.05, tone, 0, 0, 0, { r: 0.012 });
      box(g, w - 0.02, h - 0.02, 0.02, "#f7f0e2", 0, 0, 0.035, { r: 0.006 });
      const art = new THREE.Mesh(new THREE.PlaneGeometry(w - 0.12, h - 0.12), new THREE.MeshBasicMaterial({ map: textTexture(["☕"], { w: 256, h: 256, bg: "#e8d3c0", color: "#8d6553", size: 110, sparkle: "#c99b83" }) }));
      art.position.z = 0.05;
      g.add(art);
      break;
    }
    case "rug": {
      const c = document.createElement("canvas");
      c.width = 256; c.height = 256;
      const x = c.getContext("2d");
      x.fillStyle = tone; x.fillRect(0, 0, 256, 256);
      x.strokeStyle = accent; x.lineWidth = 10; x.strokeRect(12, 12, 232, 232);
      x.strokeStyle = "rgba(255,255,255,0.45)"; x.lineWidth = 3;
      for (let i = 0; i < 10; i++) x.strokeRect(22 + i * 5, 22 + i * 5, 212 - i * 10, 212 - i * 10);
      x.fillStyle = accent;
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        x.beginPath(); x.ellipse(128 + Math.cos(a) * 46, 128 + Math.sin(a) * 46, 16, 9, a, 0, Math.PI * 2); x.fill();
      }
      const tex = new THREE.CanvasTexture(c);
      tex.colorSpace = THREE.SRGBColorSpace;
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.95 }));
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.y = 0.012;
      g.add(mesh);
      break;
    }
    case "cushionpile": {
      for (let i = 0; i < 3; i++) {
        const c = box(g, 0.55 - i * 0.06, 0.16, 0.5 - i * 0.05, i % 2 ? tone : accent, (i - 1) * 0.06, 0.09 + i * 0.13, 0, { r: 0.09 });
        c.rotation.y = i * 0.5 - 0.4;
      }
      break;
    }
    case "candles": {
      cyl(g, 0.12, 0.13, 0.03, "#c9b08c", 0, 0.015, 0, 16);
      for (let i = 0; i < 3; i++) {
        const hh = 0.14 + i * 0.07;
        cyl(g, 0.035, 0.04, hh, tone, (i - 1) * 0.08, 0.03 + hh / 2, (i % 2) * 0.05, 12);
        const flame = cone(g, 0.018, 0.06, "#ffd27a", (i - 1) * 0.08, 0.06 + hh, (i % 2) * 0.05, 8);
        flame.material = new THREE.MeshBasicMaterial({ color: 0xffcf72 });
      }
      break;
    }
    case "statue": {
      cyl(g, 0.2, 0.22, 0.09, accent, 0, 0.045, 0, 18);
      ball(g, 0.17, tone, 0, 0.24, 0, 16, [1, 1.05, 0.9]);
      ball(g, 0.12, tone, 0, 0.44, 0.02, 14);
      ball(g, 0.045, tone, -0.11, 0.55, 0, 10);
      ball(g, 0.045, tone, 0.11, 0.55, 0, 10);
      ball(g, 0.035, tone, -0.11, 0.61, 0, 9);
      ball(g, 0.035, tone, 0.11, 0.61, 0, 9);
      ball(g, 0.02, "#5c4b3b", -0.05, 0.47, 0.1, 8);
      ball(g, 0.02, "#5c4b3b", 0.05, 0.47, 0.1, 8);
      ball(g, 0.02, "#5c4b3b", 0, 0.43, 0.11, 8);
      break;
    }
    case "garland": {
      const colors = [tone, accent, "#f4d7a8", "#c7d7c0"];
      for (let i = 0; i < 9; i++) {
        const px = -w / 2 + (i / 8) * w;
        const py = -Math.abs(Math.sin((i / 8) * Math.PI)) * 0.16;
        const flag = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.14, 3), mat(colors[i % colors.length], { side: THREE.DoubleSide }));
        flag.rotation.z = Math.PI;
        flag.position.set(px, py + 0.02, 0);
        g.add(flag);
      }
      const line = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, w, 4), mat("#8d7a63"));
      line.rotation.z = Math.PI / 2;
      line.position.y = 0.11;
      g.add(line);
      break;
    }

    /* ---------------- windows & doors ---------------- */
    case "widewin":
    case "roundwin":
    case "archwin":
    case "stainwin": {
      const frame = tone;
      if (kind === "roundwin") {
        const ring = torus(g, w / 2, 0.055, frame, 0, 0, 0, {});
        const pane = new THREE.Mesh(new THREE.CircleGeometry(w / 2 - 0.04, 28), new THREE.MeshBasicMaterial({ map: windowView() }));
        pane.position.z = 0.01;
        g.add(pane);
        torus(g, w / 2 - 0.05, 0.016, frame, 0, 0, 0.03, {});
        box(g, 0.03, w - 0.08, 0.025, frame, 0, 0, 0.035, { r: 0.008 });
        box(g, w - 0.08, 0.03, 0.025, frame, 0, 0, 0.035, { r: 0.008 });
        box(g, w + 0.16, 0.05, 0.14, frame, 0, -w / 2 - 0.05, 0.04, { r: 0.02 });
      } else if (kind === "archwin") {
        box(g, w, h - w * 0.3, 0.07, frame, 0, -w * 0.15, 0, { r: 0.02 });
        const pane = new THREE.Mesh(new THREE.PlaneGeometry(w - 0.14, h - w * 0.3 - 0.1), new THREE.MeshBasicMaterial({ map: windowView() }));
        pane.position.set(0, -w * 0.15, 0.045);
        g.add(pane);
        const arch = new THREE.Mesh(new THREE.CircleGeometry(w / 2 - 0.02, 24, 0, Math.PI), new THREE.MeshBasicMaterial({ map: windowView() }));
        arch.position.set(0, h / 2 - w * 0.42, 0.045);
        g.add(arch);
        const ring = torus(g, w / 2, 0.045, frame, 0, h / 2 - w * 0.42, 0.02, { arc: Math.PI });
        box(g, w + 0.08, 0.07, 0.1, frame, 0, h / 2 - w * 0.42, 0, { r: 0.02 });
        for (let i = 0; i < 2; i++) box(g, w / 4, h - w * 0.3, 0.03, frame, 0, -w * 0.15, 0.05, { r: 0.01 });
        box(g, w, 0.04, 0.08, frame, 0, -h / 2 + 0.02, 0.03, { r: 0.01 });
      } else {
        box(g, w + 0.12, h + 0.12, 0.06, frame, 0, 0, 0, { r: 0.02 });
        const pane = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: kind === "stainwin" ? textTexture(["❀"], { w: 256, h: 256, bg: "#d9c3e0", color: "#f8f1e3", size: 150, sparkle: "#b7d0d9" }) : windowView() }));
        pane.position.z = 0.04;
        g.add(pane);
        box(g, 0.04, h, 0.05, frame, 0, 0, 0.05, { r: 0.012 });
        box(g, w, 0.04, 0.05, frame, 0, 0, 0.05, { r: 0.012 });
        box(g, w + 0.1, 0.05, 0.16, frame, 0, h / 2 + 0.06, 0.06, { r: 0.02 });
        box(g, w + 0.2, 0.06, 0.2, frame, 0, -h / 2 - 0.05, 0.06, { r: 0.02 });
        if (kind === "stainwin") {
          for (let i = 0; i < 3; i++) box(g, w, 0.025, 0.05, frame, 0, -h / 2 + (i + 1) * h / 4, 0.055, { r: 0.008 });
        }
      }
      break;
    }
    case "cafedoor":
    case "archdoor":
    case "patiodoor": {
      const arch = kind === "archdoor";
      box(g, w + 0.16, h + 0.1, 0.1, tone, 0, 0, 0, { r: 0.02 });
      box(g, w, h, 0.06, kind === "patiodoor" ? glass() : accent, 0, 0, 0.03, { r: 0.02 });
      if (kind === "cafedoor") {
        box(g, w - 0.18, h * 0.45, 0.03, glass(), 0, h * 0.2, 0.08, { r: 0.01 });
        box(g, w - 0.18, h * 0.25, 0.03, "#c9a67a", 0, -h * 0.24, 0.08, { r: 0.01 });
        ball(g, 0.035, metal("#c8a86a"), w * 0.35, 0.02, 0.1, 10);
      } else if (arch) {
        box(g, w - 0.2, h * 0.5, 0.03, glass(), 0, h * 0.16, 0.08, { r: 0.01 });
        for (let i = 0; i < 3; i++) box(g, 0.03, h * 0.5, 0.03, "#f3e5d1", -w * 0.25 + i * w * 0.25, h * 0.16, 0.1, { r: 0.01 });
        ball(g, 0.04, metal("#c8a86a"), w * 0.32, 0.02, 0.1, 10);
        const top = new THREE.Mesh(new THREE.CircleGeometry(w / 2, 20, 0, Math.PI), mat(tone));
        top.position.set(0, h / 2, 0.06);
        g.add(top);
      } else {
        box(g, 0.05, h, 0.06, tone, 0, 0, 0.09, { r: 0.01 });
        box(g, w - 0.1, 0.05, 0.06, tone, 0, 0, 0.09, { r: 0.01 });
        for (let i = 0; i < 2; i++) box(g, w - 0.14, 0.05, 0.07, metal("#c8c3b6"), 0, -h * 0.2 + i * 0.18, 0.1, { r: 0.015 });
      }
      box(g, w + 0.34, 0.07, 0.24, accent, 0, -h / 2 - 0.02, 0.06, { r: 0.02 });
      break;
    }

    /* ---------------- lamps ---------------- */
    case "pendant": {
      cyl(g, 0.008, 0.008, 0.62, "#8c7a62", 0, -0.31, 0, 6);
      const shade = cone(g, 0.26, 0.24, tone, 0, -0.72, 0, 24, { rx: Math.PI });
      const bulb = ball(g, 0.075, "#ffe3a3", 0, -0.78, 0, 12);
      bulb.material = new THREE.MeshBasicMaterial({ color: 0xffe0a0 });
      cyl(g, 0.27, 0.27, 0.02, accent, 0, -0.6, 0, 24);
      break;
    }
    case "floorlamp": {
      cyl(g, 0.22, 0.24, 0.04, accent, 0, 0.02, 0, 20);
      cyl(g, 0.022, 0.022, 1.35, "#9c866a", 0, 0.7, 0, 8);
      const shade = cyl(g, 0.26, 0.34, 0.34, tone, 0, 1.45, 0, 20, { open: true });
      shade.material = mat(tone, { side: THREE.DoubleSide });
      const bulb = ball(g, 0.06, "#ffe6b0", 0, 1.35, 0, 10);
      bulb.material = new THREE.MeshBasicMaterial({ color: 0xffe2a6 });
      break;
    }
    case "tablelamp": {
      cyl(g, 0.13, 0.15, 0.03, accent, 0, 0.015, 0, 18);
      cyl(g, 0.02, 0.03, 0.23, "#b59a7a", 0, 0.14, 0, 8);
      const shade = cyl(g, 0.15, 0.22, 0.22, tone, 0, 0.33, 0, 18, { open: true });
      shade.material = mat(tone, { side: THREE.DoubleSide });
      const bulb = ball(g, 0.045, "#ffe6b0", 0, 0.28, 0, 10);
      bulb.material = new THREE.MeshBasicMaterial({ color: 0xffe2a6 });
      break;
    }
    case "string": {
      const line = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, w, 4), mat("#7f715d"));
      line.rotation.z = Math.PI / 2;
      g.add(line);
      for (let i = 0; i < 11; i++) {
        const px = -w / 2 + (i / 10) * w;
        const py = -Math.sin((i / 10) * Math.PI) * 0.12;
        cyl(g, 0.004, 0.004, 0.06, "#7f715d", px, py - 0.03, 0, 4);
        const bulb = ball(g, 0.038, "#ffe1a1", px, py - 0.1, 0, 9);
        bulb.material = new THREE.MeshBasicMaterial({ color: 0xffdf9d });
      }
      break;
    }
    case "lantern": {
      cyl(g, 0.005, 0.005, 0.36, "#8c7a62", 0, -0.18, 0, 5);
      const lantern = ball(g, 0.21, tone, 0, -0.5, 0, 16, [1, 0.85, 1]);
      lantern.material = mat(tone, { transparent: true, opacity: 0.9, emissive: "#ffcf96", emissiveIntensity: 0.4 });
      torus(g, 0.17, 0.012, accent, 0, -0.5, 0, { rx: Math.PI / 2 });
      cyl(g, 0.11, 0.11, 0.02, accent, 0, -0.7, 0, 14);
      ball(g, 0.06, "#fff0c4", 0, -0.5, 0, 10).material = new THREE.MeshBasicMaterial({ color: 0xffeec0 });
      break;
    }

    /* ---------------- outdoor ---------------- */
    case "patiotable": {
      cyl(g, w / 2, w / 2, 0.055, tone, 0, 0.7, 0, 26);
      cyl(g, w / 2 - 0.02, w / 2 - 0.02, 0.02, accent, 0, 0.735, 0, 26);
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
        const leg = box(g, 0.05, 0.7, 0.05, metal("#cfc6b6"), Math.cos(a) * w * 0.3, 0.35, Math.sin(a) * d * 0.3, { r: 0.02 });
        leg.rotation.z = Math.cos(a) * 0.06;
      }
      torus(g, 0.2, 0.014, metal("#cfc6b6"), 0, 0.22, 0, { rx: Math.PI / 2 });
      break;
    }
    case "patioset": {
      cyl(g, w / 2, w / 2, 0.055, tone, 0, 0.7, 0, 26);
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * Math.PI * 2 + 0.5;
        const chair = group(g, Math.cos(a) * 0.72, 0, Math.sin(a) * 0.72);
        chair.rotation.y = -a + Math.PI / 2;
        box(chair, 0.44, 0.05, 0.42, accent, 0, 0.42, 0, { r: 0.02 });
        box(chair, 0.46, 0.42, 0.06, tone, 0, 0.64, -0.18, { r: 0.03 });
        for (let j = 0; j < 4; j++) box(chair, 0.035, 0.42, 0.035, metal("#d8cfbf"), (j % 2 ? 0.18 : -0.18), 0.21, (j > 1 ? 0.16 : -0.16), { r: 0.012 });
      }
      cyl(g, 0.07, 0.09, 0.7, metal("#d8cfbf"), 0, 0.35, 0, 12);
      break;
    }
    case "patiochair": {
      box(g, 0.56, 0.06, 0.54, tone, 0, 0.42, 0, { r: 0.03 });
      box(g, 0.52, 0.08, 0.48, accent, 0, 0.47, 0.02, { r: 0.04 });
      box(g, 0.58, 0.52, 0.08, tone, 0, 0.68, -0.24, { r: 0.04 });
      [-1, 1].forEach((sx) => {
        box(g, 0.06, 0.08, 0.5, tone, sx * 0.28, 0.56, 0.02, { r: 0.025 });
        [-1, 1].forEach((sz) => box(g, 0.04, 0.42, 0.04, accent, sx * 0.24, 0.21, sz * 0.22, { r: 0.014 }));
      });
      break;
    }
    case "umbrella": {
      cyl(g, 0.05, 0.06, 2.1, "#a98f74", 0, 1.05, 0, 10);
      cyl(g, 0.3, 0.34, 0.07, "#9c948b", 0, 0.035, 0, 18);
      const canopy = new THREE.Mesh(new THREE.ConeGeometry(1.05, 0.42, 12, 1, true), mat(tone, { side: THREE.DoubleSide }));
      canopy.position.y = 2.05;
      g.add(canopy);
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        const panel = new THREE.Mesh(new THREE.ConeGeometry(1.06, 0.43, 12, 1, true, a, Math.PI / 6), mat(accent, { side: THREE.DoubleSide }));
        panel.position.y = 2.052;
        g.add(panel);
      }
      ball(g, 0.05, "#b99a76", 0, 2.29, 0, 10);
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        ball(g, 0.025, accent, Math.cos(a) * 1.0, 1.86, Math.sin(a) * 1.0, 6);
      }
      break;
    }
    case "gardenbench": {
      for (let i = 0; i < 3; i++) box(g, w - 0.1, 0.055, 0.15, tone, 0, 0.44, -0.16 + i * 0.16, { r: 0.02 });
      for (let i = 0; i < 2; i++) box(g, w - 0.16, 0.12, 0.04, accent, 0, 0.6 + i * 0.16, -0.26, { r: 0.02 });
      [-1, 1].forEach((sx) => {
        box(g, 0.08, 0.44, 0.5, accent, sx * (w / 2 - 0.12), 0.22, 0, { r: 0.02 });
        box(g, 0.08, 0.55, 0.07, accent, sx * (w / 2 - 0.12), 0.62, -0.26, { r: 0.02 });
      });
      break;
    }
    case "planter": {
      box(g, w, 0.46, d, tone, 0, 0.23, 0, { r: 0.035 });
      box(g, w - 0.1, 0.04, d - 0.1, "#5b4a3a", 0, 0.46, 0, { r: 0.02 });
      for (let i = 0; i < 9; i++) {
        const px = -w / 2 + 0.12 + (i / 8) * (w - 0.24);
        ball(g, 0.12, accent, px, 0.56 + (i % 3) * 0.035, (i % 2 ? 0.06 : -0.06), 10, [1, 0.8, 1]);
        if (i % 2 === 0) ball(g, 0.035, i % 4 ? "#f0c7cd" : "#f4dfae", px + 0.02, 0.67, 0.02, 8);
      }
      break;
    }
    case "firepit": {
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        const stone = ball(g, 0.11, i % 2 ? "#b6ada1" : "#a79e93", Math.cos(a) * 0.42, 0.1, Math.sin(a) * 0.42, 10, [1.3, 0.8, 1]);
      }
      cyl(g, 0.34, 0.34, 0.05, "#5d5348", 0, 0.03, 0, 18);
      for (let i = 0; i < 3; i++) {
        const log = cyl(g, 0.05, 0.05, 0.5, "#6d5741", 0, 0.1, 0, 8, { rz: Math.PI / 2 });
        log.rotation.y = i * 1.1;
      }
      for (let i = 0; i < 4; i++) {
        const flame = cone(g, 0.09 - i * 0.015, 0.28 + i * 0.05, i % 2 ? "#f5a04f" : "#ffd27a", (i - 1.5) * 0.05, 0.2, 0, 8);
        flame.material = new THREE.MeshBasicMaterial({ color: i % 2 ? 0xf5a04f : 0xffd27a, transparent: true, opacity: 0.9 });
      }
      break;
    }
    case "swing": {
      [-1, 1].forEach((sx) => {
        const post = box(g, 0.1, 2.0, 0.1, tone, sx * 0.62, 1.0, 0, { r: 0.03 });
        post.rotation.z = sx * 0.06;
      });
      box(g, 1.5, 0.1, 0.12, accent, 0, 2.0, 0, { r: 0.03 });
      [-1, 1].forEach((sx) => cyl(g, 0.012, 0.012, 1.1, "#9c8a72", sx * 0.42, 1.42, 0, 5));
      box(g, 1.1, 0.1, 0.5, tone, 0, 0.85, 0, { r: 0.04 });
      for (let i = 0; i < 3; i++) box(g, 1.02, 0.09, 0.42, i % 2 ? accent : tone, 0, 0.9 + i * 0.01, -0.12 + i * 0.12, { r: 0.03 });
      box(g, 1.0, 0.5, 0.08, accent, 0, 1.12, -0.24, { r: 0.04 });
      break;
    }
    case "birdbath": {
      cyl(g, 0.22, 0.28, 0.5, "#d8d2c6", 0, 0.25, 0, 16);
      cyl(g, 0.4, 0.26, 0.09, "#ddd7ca", 0, 0.55, 0, 20);
      cyl(g, 0.34, 0.34, 0.03, "#afd4dc", 0, 0.6, 0, 20);
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * Math.PI * 2;
        ball(g, 0.06, i % 2 ? "#f2e3d0" : "#b9cfd4", Math.cos(a) * 0.22, 0.66, Math.sin(a) * 0.22, 10);
      }
      cyl(g, 0.02, 0.02, 0.16, "#c9c2b5", 0.34, 0.62, 0, 6, { rz: 0.6 });
      break;
    }

    /* ---------------- signs ---------------- */
    case "hangingsign": {
      box(g, 0.05, 0.05, 0.4, "#8c7458", -w / 2 + 0.05, 0.34, -0.1, { r: 0.015 });
      box(g, 0.05, 0.4, 0.05, "#8c7458", -w / 2 + 0.05, 0.18, 0.06, { r: 0.015 });
      cyl(g, 0.008, 0.008, 0.16, "#8c7458", -w * 0.2, 0.25, 0.06, 4);
      const board = box(g, w, h, 0.07, tone, 0, -0.1, 0.06, { r: 0.035 });
      box(g, w - 0.08, h - 0.08, 0.02, accent, 0, -0.1, 0.1, { r: 0.02 });
      const label = new THREE.Mesh(new THREE.PlaneGeometry(w - 0.12, h - 0.14), new THREE.MeshBasicMaterial({ map: textTexture(["PET", "CAFÉ"], { w: 512, h: 256, bg: "#f5e7d2", color: "#6d4b39", size: 62, font: "Georgia, serif" }) }));
      label.position.set(0, -0.1, 0.115);
      g.add(label);
      break;
    }
    case "chalk": {
      box(g, w, h, 0.06, tone, 0, 0, 0, { r: 0.03 });
      box(g, w - 0.1, h - 0.1, 0.02, "#3f413c", 0, 0, 0.04, { r: 0.02 });
      const menu = new THREE.Mesh(new THREE.PlaneGeometry(w - 0.14, h - 0.16), new THREE.MeshBasicMaterial({ map: textTexture(["TODAY", "~ cake ~", "~ coffee ~", "~ cookies ~"], { w: 512, h: 640, color: "#f3e6cb", size: 54, font: "Georgia, serif" }) }));
      menu.position.z = 0.055;
      g.add(menu);
      box(g, 0.06, 0.06, 0.05, "#c9a06d", 0, h / 2 + 0.04, 0, { r: 0.015 });
      break;
    }
    case "opensign": {
      box(g, w, h, 0.05, tone, 0, 0, 0, { r: 0.03 });
      const label = new THREE.Mesh(new THREE.PlaneGeometry(w - 0.1, h - 0.1), new THREE.MeshBasicMaterial({ map: textTexture("OPEN", { w: 512, h: 256, bg: "#3e413d", color: "#ffdf9b", size: 110 }) }));
      label.position.z = 0.035;
      g.add(label);
      break;
    }
    case "woodsign": {
      box(g, w, h, 0.08, tone, 0, 0, 0, { r: 0.03 });
      box(g, w - 0.08, h - 0.08, 0.02, accent, 0, 0, 0.045, { r: 0.02 });
      const name = new THREE.Mesh(new THREE.PlaneGeometry(w - 0.12, h - 0.12), new THREE.MeshBasicMaterial({ map: textTexture("PET CAFÉ", { w: 640, h: 200, bg: "#f5e7d2", color: "#6d4b39", size: 92, font: "Georgia, serif" }) }));
      name.position.z = 0.06;
      g.add(name);
      break;
    }
    default: {
      box(g, w, 0.6, d, tone, 0, 0.3, 0, { r: 0.05 });
      box(g, w + 0.05, 0.06, d + 0.05, accent, 0, 0.63, 0, { r: 0.02 });
    }
  }

  g.traverse((o) => {
    if (o.isMesh) {
      const m = o.material;
      o.castShadow = !(m && m.transparent);
      o.receiveShadow = true;
    }
  });
  g.userData.buildId = def.id;
  return g;
}

/* helper used by the corner sofa */
function wx(sx, offset, width) { return sx * (width / 2 - offset); }

export { floorBoardTexture };
