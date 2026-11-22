import * as THREE from 'three';
import { RoundedBoxGeometry } from '../../../vendor/three/RoundedBoxGeometry.js';

/* =====================================================================
   COZY FARM — the valley
   A meadow, a red barn, a silo, a farm shop, a pond, a windmill and a
   lot of soft green. Everything is built from real geometry so the
   whole place can be driven around at any angle.
   ===================================================================== */

export const ZONES = {
  shop: { x: 16, z: 6.5, r: 7.5 },
  pond: { x: -20, z: 14, r: 8.5 }
};

export const OBSTACLES = [
  { x: -24, z: -3, r: 6.4 },     // barn
  { x: -30.5, z: -6, r: 3.4 },   // silo
  { x: 16, z: 6.5, r: 3.2 },     // shop stand
  { x: 24, z: -18, r: 3.6 },     // windmill
  { x: -20, z: 14, r: 6.2 }      // pond
];

export const MAP = { minX: -38, maxX: 40, minZ: -34, maxZ: 32 };

const rand = (() => {
  let seed = 20261122;
  return () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
})();

const mat = (color, roughness = 0.9, metalness = 0) =>
  new THREE.MeshStandardMaterial({ color, roughness, metalness });

function rb(parent, w, h, d, x, y, z, material, radius = 0.03) {
  const geo = new RoundedBoxGeometry(w, h, d, 2, Math.min(radius, w / 2, h / 2, d / 2));
  const mesh = new THREE.Mesh(geo, material);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function cyl(parent, rTop, rBottom, h, x, y, z, material, segments = 16) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBottom, h, segments), material);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function leafTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const x = c.getContext('2d');
  x.fillStyle = '#89a763';
  x.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 2600; i++) {
    const g = 120 + Math.random() * 60;
    x.fillStyle = `rgba(${Math.round(g * 0.72)},${Math.round(g)},${Math.round(g * 0.55)},${0.16 + Math.random() * 0.3})`;
    const px = Math.random() * 256, py = Math.random() * 256;
    x.fillRect(px, py, 1 + Math.random() * 2, 2 + Math.random() * 5);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.repeat.set(60, 60);
  tex.anisotropy = 4;
  return tex;
}

function gravelTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const x = c.getContext('2d');
  x.fillStyle = '#cbb79b';
  x.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 900; i++) {
    const v = 160 + Math.random() * 60;
    x.fillStyle = `rgba(${v},${v - 14},${v - 34},${0.25 + Math.random() * 0.4})`;
    x.fillRect(Math.random() * 128, Math.random() * 128, 1 + Math.random() * 2.4, 1 + Math.random() * 2.4);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.repeat.set(12, 12);
  return tex;
}

function textTexture(lines, opts = {}) {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 256;
  const x = c.getContext('2d');
  x.fillStyle = opts.bg || '#f7ecd9';
  x.fillRect(0, 0, 512, 256);
  if (opts.border) {
    x.strokeStyle = opts.border;
    x.lineWidth = 12;
    x.strokeRect(10, 10, 492, 236);
  }
  x.fillStyle = opts.fg || '#5d4632';
  x.textAlign = 'center';
  x.textBaseline = 'middle';
  const list = Array.isArray(lines) ? lines : [lines];
  list.forEach((line, i) => {
    x.font = `${i === 0 ? '700' : '500'} ${i === 0 ? 58 : 26}px Georgia, serif`;
    x.fillText(line, 256, list.length === 1 ? 128 : 86 + i * (58 + 26));
  });
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function awningTexture() {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 64;
  const x = c.getContext('2d');
  for (let i = 0; i < 8; i++) {
    x.fillStyle = i % 2 ? '#f7ecd9' : '#8fae7b';
    x.fillRect(i * 32, 0, 32, 64);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function skyDome(scene) {
  const c = document.createElement('canvas');
  c.width = 32; c.height = 256;
  const x = c.getContext('2d');
  const grad = x.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, '#8fb9d9');
  grad.addColorStop(0.45, '#c4dce9');
  grad.addColorStop(0.8, '#f3e6d3');
  grad.addColorStop(1, '#f7e9d5');
  x.fillStyle = grad;
  x.fillRect(0, 0, 32, 256);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(260, 24, 16),
    new THREE.MeshBasicMaterial({ map: tex, side: THREE.BackSide, fog: false, depthWrite: false })
  );
  scene.add(dome);
  return dome;
}

function buildBarn() {
  const g = new THREE.Group();
  const red = mat('#b45a45', 0.9);
  const darkRed = mat('#8f4031', 0.9);
  const cream = mat('#f6ecda', 0.85);
  const roofMat = mat('#5b5150', 0.85);
  const woodMat = mat('#8c6a4a', 0.9);

  rb(g, 11, 5.2, 7.6, 0, 2.6, 0, red, 0.06);
  // gable roof: two slabs and two triangle ends
  const slab = new THREE.Mesh(new RoundedBoxGeometry(6.4, 0.34, 8.4, 2, 0.08), roofMat);
  slab.position.set(-2.65, 6.5, 0);
  slab.rotation.z = 0.56;
  slab.castShadow = true;
  g.add(slab);
  const slab2 = slab.clone();
  slab2.position.x = 2.65;
  slab2.rotation.z = -0.56;
  g.add(slab2);
  const triShape = new THREE.Shape();
  triShape.moveTo(-5.5, 0); triShape.lineTo(5.5, 0); triShape.lineTo(0, 3.1); triShape.lineTo(-5.5, 0);
  const triGeo = new THREE.ShapeGeometry(triShape);
  const tri = new THREE.Mesh(triGeo, red);
  tri.position.set(0, 5.2, 3.8);
  tri.castShadow = true;
  g.add(tri);
  const tri2 = tri.clone();
  tri2.position.z = -3.8;
  tri2.rotation.y = Math.PI;
  g.add(tri2);

  // big doors
  rb(g, 4.6, 4.2, 0.22, 0, 2.15, 3.86, darkRed, 0.04);
  rb(g, 0.18, 4.3, 0.3, 0, 2.2, 3.92, cream, 0.02);
  const brace1 = rb(g, 5.4, 0.16, 0.3, 0, 2.15, 3.94, cream, 0.02);
  brace1.rotation.z = 0.66;
  const brace2 = brace1.clone();
  brace2.rotation.z = -0.66;
  g.add(brace2);
  rb(g, 0.22, 4.4, 0.3, -2.36, 2.24, 3.9, cream, 0.02);
  rb(g, 0.22, 4.4, 0.3, 2.36, 2.24, 3.9, cream, 0.02);
  // loft window
  rb(g, 1.5, 1.4, 0.24, 0, 6.1, 3.72, darkRed, 0.02);
  rb(g, 1.7, 0.16, 0.3, 0, 6.85, 3.78, cream, 0.02);
  // side windows
  [-2.2, 2.2].forEach(x => {
    rb(g, 1.5, 1.4, 0.18, x, 3.4, 3.86, cream, 0.02);
    rb(g, 1.1, 1.0, 0.14, x, 3.4, 3.94, mat('#7c9fb0', 0.35, 0.1), 0.01);
  });
  // corner boards
  [-5.4, 5.4].forEach(x => rb(g, 0.3, 5.2, 0.28, x, 2.6, 3.82, cream, 0.02));
  // weather vane
  cyl(g, 0.06, 0.06, 1.9, 0, 8.35, 0, mat('#6d635c', 0.5, 0.5));
  const vane = rb(g, 1.2, 0.5, 0.08, 0.35, 8.9, 0, mat('#8a7a6a', 0.6, 0.3), 0.02);
  vane.rotation.z = 0.1;
  // stone footing
  rb(g, 11.4, 0.5, 8, 0, 0.25, 0, mat('#9a9186', 0.95), 0.04);
  return g;
}

function buildSilo() {
  const g = new THREE.Group();
  const body = mat('#b7c4c9', 0.65, 0.25);
  cyl(g, 2.5, 2.5, 9.4, 0, 4.7, 0, body, 26);
  for (let i = 0; i < 5; i++) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(2.52, 0.055, 6, 26), mat('#8d9ca1', 0.6, 0.35));
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 1.3 + i * 1.85;
    g.add(ring);
  }
  const dome = new THREE.Mesh(new THREE.SphereGeometry(2.5, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), mat('#93a4aa', 0.6, 0.3));
  dome.position.y = 9.4;
  dome.castShadow = true;
  g.add(dome);
  cyl(g, 0.5, 0.6, 0.5, 0, 11.65, 0, mat('#7f9096', 0.7, 0.2), 12);
  // ladder
  [-0.32, 0.32].forEach(x => cyl(g, 0.035, 0.035, 9.2, 2.62 + x, 4.7, 0, mat('#77706a', 0.6, 0.4), 6));
  for (let i = 0; i < 12; i++) {
    const rung = rb(g, 0.7, 0.05, 0.05, 2.62, 0.35 + i * 0.75, 0, mat('#8a817a', 0.6, 0.4), 0.01);
    rung.rotation.y = 0;
  }
  return g;
}

function buildShop() {
  const g = new THREE.Group();
  const wood = mat('#b58a5c', 0.9);
  const dark = mat('#8a6542', 0.9);
  const cream = mat('#f6ecda', 0.85);
  // counter and posts
  rb(g, 5.4, 0.9, 2.4, 0, 0.45, 0, dark, 0.04);
  rb(g, 5.8, 0.22, 2.7, 0, 1.0, 0, wood, 0.04);
  [[-2.4, -1.0], [2.4, -1.0], [-2.4, 1.0], [2.4, 1.0]].forEach(([x, z]) => {
    cyl(g, 0.12, 0.14, 3.2, x, 1.9, z, wood, 8);
  });
  // roof
  const roof = new THREE.Mesh(new RoundedBoxGeometry(6.6, 0.26, 3.3, 2, 0.06), mat('#6e6258', 0.85));
  roof.position.set(0, 3.5, 0);
  roof.castShadow = true;
  g.add(roof);
  // striped awning
  const awn = new THREE.Mesh(new THREE.PlaneGeometry(6.2, 2.8), new THREE.MeshStandardMaterial({ map: awningTexture(), roughness: 0.85, side: THREE.DoubleSide }));
  awn.rotation.x = -0.38;
  awn.position.set(0, 3.15, 1.6);
  awn.castShadow = true;
  g.add(awn);
  // sign
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(4.4, 1.3), new THREE.MeshStandardMaterial({ map: textTexture(['FARM SHOP', 'today’s market prices'], { bg: '#fbf3e4', fg: '#5d4632', border: '#b58a5c' }), roughness: 0.9 }));
  sign.position.set(0, 4.35, 1.42);
  g.add(sign);
  const signBack = rb(g, 4.6, 1.5, 0.16, 0, 4.35, 1.3, cream, 0.03);
  signBack.position.z = 1.28;
  // crates of produce
  const produce = ['#d9b45c', '#e08a3f', '#c8b184', '#7f9e54'];
  [[-1.9, 0.6], [-0.6, 0.75], [0.7, 0.55], [1.9, 0.7]].forEach(([x, z], i) => {
    rb(g, 0.95, 0.55, 0.8, x, 1.25, z, wood, 0.03);
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.17, 10, 8), mat(produce[i], 0.85));
    ball.position.set(x, 1.6, z);
    ball.castShadow = true;
    g.add(ball);
    const ball2 = ball.clone();
    ball2.position.set(x - 0.22, 1.55, z + 0.12);
    g.add(ball2);
    const ball3 = ball.clone();
    ball3.position.set(x + 0.2, 1.57, z - 0.1);
    g.add(ball3);
  });
  // a little open ledger and a scale on the counter
  rb(g, 0.7, 0.06, 0.5, 0.2, 1.14, 0.4, cream, 0.01).rotation.x = -0.12;
  cyl(g, 0.06, 0.06, 0.5, 2.0, 1.35, -0.2, mat('#8d7c68', 0.6, 0.3), 8);
  const pan = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.06, 16), mat('#c9a45f', 0.5, 0.5));
  pan.position.set(2.0, 1.6, -0.2);
  g.add(pan);
  // ground ring marking the sell spot
  const ring = new THREE.Mesh(new THREE.RingGeometry(4.6, 5.0, 48), new THREE.MeshBasicMaterial({ color: '#f0d79a', transparent: true, opacity: 0.5, side: THREE.DoubleSide }));
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.02;
  g.add(ring);
  return g;
}

function buildPond() {
  const g = new THREE.Group();
  const water = new THREE.Mesh(new THREE.CircleGeometry(6.2, 40), new THREE.MeshStandardMaterial({ color: '#7fb3bd', roughness: 0.18, metalness: 0.35, transparent: true, opacity: 0.9 }));
  water.rotation.x = -Math.PI / 2;
  water.position.y = 0.03;
  g.add(water);
  const bank = new THREE.Mesh(new THREE.RingGeometry(6.2, 7.3, 40), mat('#b9a37f', 0.95));
  bank.rotation.x = -Math.PI / 2;
  bank.position.y = 0.02;
  bank.receiveShadow = true;
  g.add(bank);
  for (let i = 0; i < 18; i++) {
    const a = (i / 18) * Math.PI * 2;
    const r = 7.2 + rand() * 0.8;
    const rock = new THREE.Mesh(new THREE.IcosahedronGeometry(0.35 + rand() * 0.4, 0), mat('#a8a091', 0.95));
    rock.position.set(Math.cos(a) * r, 0.18, Math.sin(a) * r);
    rock.scale.y = 0.6;
    rock.castShadow = true;
    g.add(rock);
  }
  for (let i = 0; i < 22; i++) {
    const a = rand() * Math.PI * 2;
    const r = 6.4 + rand() * 1.4;
    const reed = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.04, 1 + rand() * 1.1, 5), mat('#7f9a5c', 0.9));
    reed.position.set(Math.cos(a) * r, 0.5, Math.sin(a) * r);
    reed.rotation.z = (rand() - 0.5) * 0.18;
    g.add(reed);
  }
  for (let i = 0; i < 7; i++) {
    const pad = new THREE.Mesh(new THREE.CircleGeometry(0.35 + rand() * 0.3, 12), mat('#6d9a5b', 0.8));
    pad.rotation.x = -Math.PI / 2;
    const a = rand() * Math.PI * 2, r = rand() * 4.6;
    pad.position.set(Math.cos(a) * r, 0.05, Math.sin(a) * r);
    g.add(pad);
  }
  // water sign
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.7), new THREE.MeshStandardMaterial({ map: textTexture(['WATER'], { bg: '#f7ecd9', fg: '#4d6f7a', border: '#8fb3bd' }), roughness: 0.9, side: THREE.DoubleSide }));
  sign.position.set(0, 1.75, 7.6);
  g.add(sign);
  [-0.5, 0.5].forEach(x => cyl(g, 0.06, 0.07, 1.7, x, 0.85, 7.6, mat('#8a7355', 0.9), 6));
  return g;
}

function buildWindmill() {
  const g = new THREE.Group();
  const stone = mat('#d6c7b0', 0.95);
  const wood = mat('#a8835c', 0.9);
  cyl(g, 1.35, 2.3, 7.6, 0, 3.8, 0, stone, 10);
  cyl(g, 2.0, 2.2, 0.5, 0, 7.8, 0, wood, 10);
  const cap = new THREE.Mesh(new THREE.ConeGeometry(2.1, 2.1, 10), mat('#7a6a5b', 0.9));
  cap.position.y = 9.1;
  cap.castShadow = true;
  g.add(cap);
  rb(g, 1.2, 1.7, 0.2, 0, 1.1, 2.15, wood, 0.02);
  const blades = new THREE.Group();
  blades.position.set(0, 8.6, 2.15);
  for (let i = 0; i < 4; i++) {
    const arm = new THREE.Group();
    arm.rotation.z = i * Math.PI / 2;
    const spar = rb(arm, 0.16, 5.4, 0.12, 0, 2.7, 0, wood, 0.02);
    spar.castShadow = true;
    for (let j = 0; j < 5; j++) {
      rb(arm, 1.0, 0.1, 0.06, 0.56, 0.8 + j * 1.0, 0, mat('#f2e6d2', 0.85), 0.01);
    }
    blades.add(arm);
  }
  g.add(blades);
  g.userData.blades = blades;
  return g;
}

function buildTree(kind) {
  const g = new THREE.Group();
  const trunk = mat('#8a6a4d', 0.95);
  const leafA = mat('#6f955f', 0.9);
  const leafB = mat('#7fa66b', 0.9);
  const leafC = mat('#5f8552', 0.9);
  if (kind === 'pine') {
    cyl(g, 0.22, 0.34, 2.4, 0, 1.2, 0, trunk, 8);
    for (let i = 0; i < 4; i++) {
      const cone = new THREE.Mesh(new THREE.ConeGeometry(2.1 - i * 0.4, 2.5, 9), i % 2 ? leafB : leafC);
      cone.position.y = 2.2 + i * 1.35;
      cone.castShadow = true;
      cone.receiveShadow = true;
      g.add(cone);
    }
  } else {
    cyl(g, 0.28, 0.45, 3.0, 0, 1.5, 0, trunk, 8);
    const blobs = [
      [0, 4.3, 0, 2.0, leafA], [-1.2, 3.8, 0.5, 1.4, leafB], [1.1, 3.9, -0.4, 1.5, leafB],
      [0.2, 4.6, 1.1, 1.35, leafC], [-0.4, 4.5, -1.1, 1.3, leafC], [1.3, 4.6, 0.6, 1.05, leafA]
    ];
    blobs.forEach(([x, y, z, r, m]) => {
      const blob = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 1), m);
      blob.position.set(x, y, z);
      blob.castShadow = true;
      blob.receiveShadow = true;
      g.add(blob);
    });
    if (kind === 'apple') {
      for (let i = 0; i < 7; i++) {
        const a = rand() * Math.PI * 2, r = 1.2 + rand() * 1.1;
        const apple = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 6), mat('#c9563f', 0.7));
        apple.position.set(Math.cos(a) * r, 3.6 + rand() * 1.1, Math.sin(a) * r);
        g.add(apple);
      }
    }
  }
  return g;
}

function fenceLine(g, x1, z1, x2, z2, gapEvery = 0) {
  const wood = mat('#c2a37a', 0.95);
  const dx = x2 - x1, dz = z2 - z1;
  const len = Math.hypot(dx, dz);
  const posts = Math.max(2, Math.round(len / 2.4));
  for (let i = 0; i <= posts; i++) {
    if (gapEvery && i % gapEvery === 0) continue;
    const t = i / posts;
    cyl(g, 0.09, 0.11, 1.25, x1 + dx * t, 0.62, z1 + dz * t, wood, 6);
  }
  const angle = Math.atan2(dx, dz);
  [0.55, 0.98].forEach(h => {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.12, len), wood);
    rail.position.set(x1 + dx / 2, h, z1 + dz / 2);
    rail.rotation.y = angle;
    rail.castShadow = true;
    g.add(rail);
  });
}

function buildClouds(scene) {
  const clouds = [];
  for (let i = 0; i < 8; i++) {
    const cloud = new THREE.Group();
    const white = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.82 });
    const count = 3 + Math.floor(rand() * 3);
    for (let j = 0; j < count; j++) {
      const puff = new THREE.Mesh(new THREE.SphereGeometry(2 + rand() * 2.2, 10, 8), white);
      puff.position.set(j * 2.3 - count, rand() * 1.1, rand() * 1.8 - 0.9);
      puff.scale.y = 0.55;
      cloud.add(puff);
    }
    cloud.position.set(-90 + rand() * 180, 26 + rand() * 14, -70 + rand() * 150);
    cloud.scale.setScalar(0.9 + rand() * 0.7);
    scene.add(cloud);
    clouds.push(cloud);
  }
  return clouds;
}

export function createWorld(scene) {
  const root = new THREE.Group();
  scene.add(root);

  skyDome(scene);
  scene.fog = new THREE.Fog('#e6e2cf', 70, 190);

  // meadow
  const grass = new THREE.Mesh(
    new THREE.PlaneGeometry(360, 360),
    new THREE.MeshStandardMaterial({ map: leafTexture(), color: '#c7d6b1', roughness: 1 })
  );
  grass.rotation.x = -Math.PI / 2;
  grass.receiveShadow = true;
  root.add(grass);

  // a wide dirt apron under the working field
  const apron = new THREE.Mesh(new THREE.PlaneGeometry(25.6, 18.6), new THREE.MeshStandardMaterial({ color: '#b79a75', roughness: 1 }));
  apron.rotation.x = -Math.PI / 2;
  apron.position.set(-0.5, 0.012, -6.9);
  apron.receiveShadow = true;
  root.add(apron);

  // gravel lanes: barn to field, field to shop
  const gravel = new THREE.MeshStandardMaterial({ map: gravelTexture(), roughness: 0.95, color: '#d8c6ab' });
  const laneA = new THREE.Mesh(new THREE.PlaneGeometry(26, 3.6), gravel);
  laneA.rotation.x = -Math.PI / 2;
  laneA.rotation.z = 0.12;
  laneA.position.set(-9, 0.016, 5.6);
  laneA.receiveShadow = true;
  root.add(laneA);
  const laneB = new THREE.Mesh(new THREE.PlaneGeometry(24, 3.4), gravel);
  laneB.rotation.x = -Math.PI / 2;
  laneB.rotation.z = -0.1;
  laneB.position.set(6, 0.017, 9.2);
  laneB.receiveShadow = true;
  root.add(laneB);

  const barn = buildBarn();
  barn.position.set(-24, 0, -3);
  barn.rotation.y = Math.PI / 2;
  root.add(barn);

  const silo = buildSilo();
  silo.position.set(-30.5, 0, -6);
  root.add(silo);

  const shop = buildShop();
  shop.position.set(16, 0, 6.5);
  shop.rotation.y = -0.55;
  root.add(shop);

  const pond = buildPond();
  pond.position.set(-20, 0, 14);
  root.add(pond);

  const windmill = buildWindmill();
  windmill.position.set(24, 0, -18);
  windmill.rotation.y = -0.4;
  root.add(windmill);

  // fences along the north and west edges of the field, open to the south
  const fence = new THREE.Group();
  fenceLine(fence, -12.4, 2.4, -12.4, -16.2);
  fenceLine(fence, -12.4, -16.2, 11.4, -16.2);
  fenceLine(fence, 11.4, -16.2, 11.4, 2.4);
  fenceLine(fence, -12.4, 2.4, -6.2, 2.4);
  fenceLine(fence, 1.2, 2.4, 11.4, 2.4);
  root.add(fence);

  // pasture fence in front of the barn
  const pasture = new THREE.Group();
  fenceLine(pasture, -31, 3, -17, 3);
  fenceLine(pasture, -31, 3, -31, -12);
  root.add(pasture);

  // trees, hedges and flowers (kept clear of the field, lanes and zones)
  const trees = new THREE.Group();
  const spots = [
    [-34, 8], [-36, 18], [-28, 22], [-12, 24], [4, 22], [18, 18], [28, 12],
    [32, 0], [30, -10], [34, -24], [20, -26], [6, -24], [-6, -26], [-18, -22],
    [-30, -18], [-36, -6], [-36, -18], [10, 26], [24, 24], [-24, 26], [-8, 20]
  ];
  const kinds = ['round', 'round', 'apple', 'pine', 'round', 'pine'];
  spots.forEach(([x, z], i) => {
    const tree = buildTree(kinds[i % kinds.length]);
    const s = 0.85 + rand() * 0.55;
    tree.scale.setScalar(s);
    tree.position.set(x + (rand() - 0.5) * 2, 0, z + (rand() - 0.5) * 2);
    tree.rotation.y = rand() * Math.PI * 2;
    trees.add(tree);
  });
  root.add(trees);

  // distant hills
  const hills = new THREE.Group();
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2 + rand() * 0.15;
    const r = 95 + rand() * 45;
    const hill = new THREE.Mesh(new THREE.SphereGeometry(18 + rand() * 18, 12, 8), mat(i % 2 ? '#9fb88c' : '#aec39a', 1));
    hill.position.set(Math.cos(a) * r, -4 - rand() * 4, Math.sin(a) * r);
    hill.scale.y = 0.4;
    hills.add(hill);
  }
  root.add(hills);

  // grass tufts and flowers
  const tuftGeo = new THREE.ConeGeometry(0.075, 0.5, 3);
  const tuftMat = new THREE.MeshStandardMaterial({ color: '#88a866', roughness: 1 });
  const tufts = new THREE.InstancedMesh(tuftGeo, tuftMat, 900);
  const dummy = new THREE.Object3D();
  let placed = 0;
  while (placed < 900) {
    const x = (rand() - 0.5) * 76;
    const z = (rand() - 0.5) * 70;
    if (x > -13 && x < 12 && z > -17 && z < 3) continue;
    if (Math.hypot(x + 20, z - 14) < 8) continue;
    dummy.position.set(x, 0.22, z);
    dummy.scale.setScalar(0.7 + rand() * 0.8);
    dummy.rotation.y = rand() * Math.PI;
    dummy.updateMatrix();
    tufts.setMatrixAt(placed++, dummy.matrix);
  }
  tufts.receiveShadow = true;
  root.add(tufts);

  const flowerGeo = new THREE.SphereGeometry(0.055, 6, 5);
  const flowerMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9 });
  const flowers = new THREE.InstancedMesh(flowerGeo, flowerMat, 200);
  const colors = ['#fdf4dc', '#f5df98', '#f0d2bd', '#f7ead0', '#e6d8ea'];
  for (let i = 0; i < 200; i++) {
    const x = (rand() - 0.5) * 70;
    const z = (rand() - 0.5) * 64;
    if (x > -13 && x < 12 && z > -17 && z < 3) { i--; continue; }
    dummy.position.set(x, 0.22 + rand() * 0.1, z);
    dummy.scale.setScalar(0.8 + rand() * 0.9);
    dummy.updateMatrix();
    flowers.setMatrixAt(i, dummy.matrix);
    flowers.setColorAt(i, new THREE.Color(colors[i % colors.length]));
  }
  root.add(flowers);

  // hay bales by the barn and a few crates
  [[-16, 1.6], [-14.8, 1.2], [-15.6, 2.6], [-17.2, 2.2]].forEach(([x, z], i) => {
    const bale = new THREE.Mesh(new THREE.CylinderGeometry(0.72, 0.72, 1.0, 14), mat('#dbc279', 0.95));
    bale.rotation.z = Math.PI / 2;
    bale.position.set(x, 0.72 + (i > 2 ? 1.3 : 0), z);
    bale.castShadow = true;
    bale.receiveShadow = true;
    root.add(bale);
  });

  const clouds = buildClouds(scene);

  // birds
  const birds = new THREE.Group();
  const birdMat = new THREE.MeshBasicMaterial({ color: '#5b6266' });
  for (let i = 0; i < 5; i++) {
    const bird = new THREE.Group();
    const wingGeo = new THREE.BoxGeometry(0.7, 0.05, 0.12);
    const l = new THREE.Mesh(wingGeo, birdMat);
    l.position.x = -0.36;
    l.rotation.z = 0.3;
    const r = new THREE.Mesh(wingGeo, birdMat);
    r.position.x = 0.36;
    r.rotation.z = -0.3;
    bird.add(l, r);
    bird.userData.phase = rand() * Math.PI * 2;
    bird.userData.radius = 18 + rand() * 12;
    bird.userData.height = 16 + rand() * 8;
    birds.add(bird);
  }
  scene.add(birds);

  let time = 0;
  return {
    root,
    update(dt) {
      time += dt;
      windmill.userData.blades.rotation.z += dt * 0.35;
      clouds.forEach((cloud, i) => {
        cloud.position.x += dt * (0.6 + i * 0.04);
        if (cloud.position.x > 110) cloud.position.x = -110;
      });
      birds.children.forEach(bird => {
        const a = time * 0.08 + bird.userData.phase;
        bird.position.set(Math.cos(a) * bird.userData.radius, bird.userData.height + Math.sin(a * 2) * 1.4, Math.sin(a) * bird.userData.radius);
        bird.rotation.y = -a;
        bird.rotation.z = Math.sin(time * 2.4 + bird.userData.phase) * 0.15;
      });
    }
  };
}
