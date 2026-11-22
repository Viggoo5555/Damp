import * as THREE from 'three';
import { RoundedBoxGeometry } from '../../../vendor/three/RoundedBoxGeometry.js';

/* =====================================================================
   COZY FARM — the tractor and everything you can hang on it
   One tractor, seven tools, all built from real geometry. The model faces
   +z, so the world heading is simply group.rotation.y.
   ===================================================================== */

export const IMPLEMENTS = [
  { id: 'plow',      name: 'Plough',    icon: 'plow',   tag: 'Tills grass into soil',     behind: 2.3 },
  { id: 'seed',      name: 'Seed drill', icon: 'seed',  tag: 'Sows the chosen crop',      behind: 2.2 },
  { id: 'fertilize', name: 'Spreader',  icon: 'bag',    tag: 'Feeds the crop, +30% yield', behind: 2.1 },
  { id: 'water',     name: 'Water tank', icon: 'water', tag: 'Waters the rows, grows faster', behind: 2.2 },
  { id: 'harvest',   name: 'Harvester', icon: 'harvest', tag: 'Takes ripe crops to the barn', behind: 2.4 },
  { id: 'mower',     name: 'Hay mower', icon: 'mower',  tag: 'Cuts meadow into bales',     behind: 2.2 },
  { id: 'trailer',   name: 'Hay trailer', icon: 'trailer', tag: 'Collects the bales you cut', behind: 2.6 }
];

const mat = (color, roughness = 0.75, metalness = 0) =>
  new THREE.MeshStandardMaterial({ color, roughness, metalness });

function box(parent, w, h, d, x, y, z, material, radius = 0.04) {
  const mesh = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 2, Math.min(radius, w / 2, h / 2, d / 2)), material);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function cyl(parent, rt, rbm, h, x, y, z, material, seg = 14, rotZ = 0) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(rt, rbm, h, seg), material);
  mesh.position.set(x, y, z);
  mesh.rotation.z = rotZ;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function wheel(radius, width, treads) {
  const g = new THREE.Group();
  const tire = mat('#3f3b39', 0.95);
  const rim = mat('#e8dfcd', 0.6, 0.15);
  const hub = mat('#6f665c', 0.7, 0.3);
  cyl(g, radius, radius, width, 0, 0, 0, tire, 22, Math.PI / 2);
  cyl(g, radius * 0.62, radius * 0.62, width + 0.02, 0, 0, 0, rim, 18, Math.PI / 2);
  const cap = cyl(g, radius * 0.2, radius * 0.2, width + 0.09, 0, 0, 0, hub, 10, Math.PI / 2);
  cap.castShadow = false;
  for (let i = 0; i < treads; i++) {
    const a = (i / treads) * Math.PI * 2;
    const bar = new THREE.Mesh(new THREE.BoxGeometry(width * 0.9, 0.07, radius * 0.28), tire);
    bar.position.set(0, Math.cos(a) * radius * 0.97, Math.sin(a) * radius * 0.97);
    bar.rotation.x = -a;
    bar.castShadow = true;
    g.add(bar);
  }
  g.userData.spin = 0;
  return g;
}

function buildTractorBody() {
  const g = new THREE.Group();
  const green = mat('#7d9b6b', 0.55);
  const greenDark = mat('#5f7c52', 0.6);
  const cream = mat('#efe2cb', 0.65);
  const charcoal = mat('#4c4a45', 0.7, 0.15);
  const steel = mat('#9aa0a0', 0.45, 0.55);
  const glass = new THREE.MeshStandardMaterial({ color: '#bcd5db', roughness: 0.08, metalness: 0.2, transparent: true, opacity: 0.42 });
  const lamp = new THREE.MeshStandardMaterial({ color: '#ffe7ac', emissive: '#ffd27a', emissiveIntensity: 1.2, roughness: 0.4 });
  const red = mat('#a4503f', 0.7);

  // chassis and hood
  box(g, 1.2, 0.34, 3.1, 0, 0.62, 0.1, charcoal, 0.06);
  box(g, 1.16, 0.86, 1.62, 0, 1.12, 0.82, green, 0.16);
  box(g, 1.0, 0.16, 0.9, 0, 1.6, 0.5, greenDark, 0.06);
  // grille and face
  box(g, 1.0, 0.62, 0.12, 0, 1.1, 1.64, charcoal, 0.03);
  for (let i = 0; i < 6; i++) box(g, 0.82, 0.045, 0.05, 0, 0.86 + i * 0.1, 1.71, steel, 0.01);
  cyl(g, 0.16, 0.16, 0.1, -0.36, 1.38, 1.7, lamp, 12, Math.PI / 2);
  cyl(g, 0.16, 0.16, 0.1, 0.36, 1.38, 1.7, lamp, 12, Math.PI / 2);
  // nose weight and bumper
  box(g, 1.3, 0.22, 0.4, 0, 0.5, 1.78, greenDark, 0.06);
  box(g, 0.5, 0.16, 0.14, 0, 0.42, 1.98, steel, 0.03);

  // cab frame
  box(g, 1.62, 0.18, 1.7, 0, 2.62, -0.35, cream, 0.08);           // roof
  box(g, 1.55, 0.08, 1.66, 0, 2.72, -0.35, cream, 0.06);
  [[-0.76, -1.15], [0.76, -1.15], [-0.76, 0.44], [0.76, 0.44]].forEach(([x, z]) => {
    box(g, 0.11, 1.55, 0.11, x, 1.9, z, cream, 0.03);
  });
  // glass panels
  const windscreen = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 1.35), glass);
  windscreen.position.set(0, 1.95, 0.47);
  windscreen.rotation.x = -0.08;
  g.add(windscreen);
  const rearGlass = windscreen.clone();
  rearGlass.position.z = -1.18;
  rearGlass.rotation.x = 0.06;
  rearGlass.rotation.y = Math.PI;
  g.add(rearGlass);
  [-0.77, 0.77].forEach(x => {
    const side = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 1.3), glass);
    side.rotation.y = Math.PI / 2 * Math.sign(x);
    side.position.set(x, 1.95, -0.36);
    g.add(side);
  });
  // engine cover in front of the glass, dash
  box(g, 1.42, 0.3, 0.9, 0, 1.16, -0.55, greenDark, 0.06);
  // seat and steering
  box(g, 0.62, 0.12, 0.62, 0, 1.28, -0.7, red, 0.09);
  box(g, 0.62, 0.5, 0.1, 0, 1.5, -1.02, red, 0.05);
  const column = cyl(g, 0.045, 0.05, 0.75, 0, 1.55, -0.32, steel, 8);
  column.rotation.x = 0.6;
  const steering = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.035, 8, 20), charcoal);
  steering.position.set(0, 1.82, -0.18);
  steering.rotation.x = 1.1;
  steering.castShadow = true;
  g.add(steering);
  cyl(g, 0.04, 0.04, 0.3, 0.45, 1.62, -0.78, charcoal, 6);
  box(g, 0.1, 0.1, 0.1, 0.45, 1.78, -0.78, red, 0.02);

  // fenders over the rear wheels
  [-0.94, 0.94].forEach(x => {
    const fender = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.0, 0.5, 18, 1, true, 0, Math.PI), greenDark);
    fender.rotation.z = Math.PI / 2;
    fender.position.set(x, 0.78, -0.62);
    fender.material.side = THREE.DoubleSide;
    fender.castShadow = true;
    g.add(fender);
  });

  // steps, toolbox, exhaust and beacon
  box(g, 0.55, 0.08, 0.3, -0.18, 0.62, -1.3, steel, 0.02);
  box(g, 0.62, 0.3, 0.36, 0.52, 0.8, -1.28, charcoal, 0.04);
  const pipe = cyl(g, 0.075, 0.09, 1.3, 0.5, 1.92, 1.28, steel, 10);
  pipe.rotation.z = 0;
  cyl(g, 0.12, 0.12, 0.1, 0.5, 2.6, 1.28, charcoal, 10);
  const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 8), new THREE.MeshStandardMaterial({ color: '#ffb25c', emissive: '#ff9a2e', emissiveIntensity: 0.9, roughness: 0.4 }));
  beacon.position.set(-0.55, 2.8, -0.4);
  g.add(beacon);
  // rear lights
  box(g, 0.16, 0.16, 0.08, -0.72, 1.25, -1.82, new THREE.MeshStandardMaterial({ color: '#e08a70', emissive: '#a33a2a', emissiveIntensity: 0.6, roughness: 0.4 }), 0.03);
  box(g, 0.16, 0.16, 0.08, 0.72, 1.25, -1.82, new THREE.MeshStandardMaterial({ color: '#e08a70', emissive: '#a33a2a', emissiveIntensity: 0.6, roughness: 0.4 }), 0.03);

  // hitch
  box(g, 0.16, 0.12, 0.25, 0, 0.58, -1.86, steel, 0.02);
  cyl(g, 0.06, 0.06, 0.7, -0.4, 0.7, -1.9, steel, 6);
  cyl(g, 0.06, 0.06, 0.7, 0.4, 0.7, -1.9, steel, 6);

  return g;
}

function buildPlough() {
  const g = new THREE.Group();
  const red = mat('#a5553f', 0.7);
  const steel = mat('#9ba1a3', 0.4, 0.6);
  box(g, 1.9, 0.14, 0.18, 0, 0.62, -0.3, red, 0.03);
  [-0.62, 0, 0.62].forEach((x, i) => {
    box(g, 0.13, 0.13, 1.1, x, 0.55, -0.9, red, 0.02);
    const blade = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.1, 10, 1, false, 0, Math.PI), steel);
    blade.position.set(x, 0.32, -1.28);
    blade.rotation.set(Math.PI / 2, 0, 0.5);
    blade.castShadow = true;
    g.add(blade);
    box(g, 0.1, 0.6, 0.12, x + 0.2, 0.35, -1.1, red, 0.02);
    if (i === 1) cyl(g, 0.26, 0.26, 0.12, x, 0.26, -0.2, mat('#3f3b39', 0.9), 12, Math.PI / 2);
  });
  box(g, 0.18, 0.16, 1.0, 0, 0.55, 0.2, steel, 0.02);
  return g;
}

function buildSeedDrill() {
  const g = new THREE.Group();
  const cream = mat('#e7d6b8', 0.8);
  const green = mat('#6f8f60', 0.7);
  const steel = mat('#9aa0a0', 0.4, 0.55);
  box(g, 0.2, 0.16, 1.2, 0, 0.55, 0.3, steel, 0.02);
  box(g, 1.7, 0.8, 1.25, 0, 1.16, -0.72, cream, 0.08);
  box(g, 1.5, 0.12, 1.05, 0, 1.58, -0.72, green, 0.04);
  box(g, 0.5, 0.16, 0.5, 0, 1.68, -0.72, green, 0.04);
  for (let i = 0; i < 6; i++) {
    const x = -0.65 + i * 0.26;
    box(g, 0.06, 0.55, 0.06, x, 0.55, -1.25, steel, 0.01);
    const disc = cyl(g, 0.2, 0.2, 0.05, x, 0.28, -1.3, steel, 10, Math.PI / 2);
    disc.rotation.x = 0.4;
  }
  const roller = cyl(g, 0.26, 0.26, 1.6, 0, 0.28, -0.05, mat('#7b7368', 0.8), 12, Math.PI / 2);
  roller.userData.spin = true;
  g.userData.rollers = [roller];
  cyl(g, 0.24, 0.3, 0.18, 0, 1.3, 0.3, green, 10);
  return g;
}

function buildSpreader() {
  const g = new THREE.Group();
  const green = mat('#718f62', 0.7);
  const steel = mat('#a2a8a8', 0.4, 0.55);
  const yellow = mat('#d9b25f', 0.6);
  box(g, 0.2, 0.16, 1.3, 0, 0.5, 0.35, steel, 0.02);
  const hopper = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.34, 1.0, 14, 1, true), green);
  hopper.position.set(0, 1.25, -0.6);
  hopper.material.side = THREE.DoubleSide;
  hopper.castShadow = true;
  g.add(hopper);
  cyl(g, 0.6, 0.6, 0.08, 0, 1.76, -0.6, yellow, 14);
  box(g, 0.55, 0.5, 0.55, 0, 0.62, -0.6, steel, 0.04);
  const spinner = cyl(g, 0.55, 0.55, 0.06, 0, 0.36, -0.6, steel, 18);
  spinner.userData.spin = true;
  const vanes = new THREE.Group();
  for (let i = 0; i < 4; i++) {
    const vane = box(vanes, 0.5, 0.16, 0.04, 0, 0.38, 0, yellow, 0.01);
    vane.rotation.y = i * Math.PI / 2;
  }
  vanes.position.set(0, 0, -0.6);
  g.add(vanes);
  g.userData.spinners = [spinner, vanes];
  return g;
}

function buildWaterTank() {
  const g = new THREE.Group();
  const tankMat = mat('#8fb0b8', 0.5, 0.15);
  const steel = mat('#9aa0a0', 0.4, 0.55);
  const blue = mat('#6c97a4', 0.5);
  box(g, 0.2, 0.16, 1.3, 0, 0.5, 0.35, steel, 0.02);
  const tank = cyl(g, 0.62, 0.62, 1.9, 0, 1.12, -0.95, tankMat, 18);
  tank.rotation.z = Math.PI / 2;
  [-0.68, 0.68].forEach(x => cyl(g, 0.5, 0.5, 0.06, x, 1.12, -0.95, steel, 14, Math.PI / 2));
  const mouth = cyl(g, 0.2, 0.2, 0.16, 0, 1.74, -0.4, blue, 10);
  mouth.castShadow = false;
  box(g, 2.1, 0.08, 0.1, 0, 0.42, -2.0, steel, 0.02);
  for (let i = 0; i < 7; i++) {
    const x = -0.9 + i * 0.3;
    box(g, 0.06, 0.16, 0.06, x, 0.32, -2.0, blue, 0.01);
    const nozzle = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.18, 8), steel);
    nozzle.position.set(x, 0.22, -2.0);
    nozzle.rotation.x = Math.PI;
    g.add(nozzle);
  }
  box(g, 0.08, 0.5, 0.08, -0.55, 0.55, -1.55, blue, 0.01);
  box(g, 0.08, 0.5, 0.08, 0.55, 0.55, -1.55, blue, 0.01);
  return g;
}

function buildHarvester() {
  const g = new THREE.Group();
  const red = mat('#a95743', 0.7);
  const cream = mat('#ecdfc8', 0.7);
  const steel = mat('#a3a9a8', 0.4, 0.55);
  const dark = mat('#4f4c47', 0.7);
  box(g, 0.2, 0.16, 1.4, 0, 0.55, 0.35, steel, 0.02);
  box(g, 1.8, 0.55, 1.3, 0, 0.92, -0.55, red, 0.08);
  box(g, 1.6, 0.16, 1.1, 0, 1.24, -0.55, cream, 0.04);
  box(g, 0.2, 0.16, 1.0, 0, 0.6, 0.2, steel, 0.02);
  // header
  box(g, 2.6, 0.32, 0.8, 0, 0.55, -1.75, red, 0.05);
  box(g, 2.6, 0.08, 0.9, 0, 0.34, -1.8, dark, 0.02);
  [-1.3, 1.3].forEach(x => box(g, 0.2, 0.5, 0.9, x, 0.62, -1.75, cream, 0.03));
  const reel = new THREE.Group();
  reel.position.set(0, 1.02, -1.55);
  const shaft = cyl(reel, 0.06, 0.06, 2.4, 0, 0, 0, steel, 8, Math.PI / 2);
  shaft.rotation.z = 0;
  for (let i = 0; i < 5; i++) {
    const a = i * Math.PI * 2 / 5;
    const bar = box(reel, 2.35, 0.05, 0.06, 0, Math.sin(a) * 0.42, Math.cos(a) * 0.42, steel, 0.01);
  }
  cyl(reel, 0.1, 0.1, 0.2, -1.2, 0, 0, cream, 8, Math.PI / 2);
  g.add(reel);
  const auger = cyl(g, 0.16, 0.16, 2.3, 0, 0.62, -1.1, steel, 10, Math.PI / 2);
  auger.userData.spin = true;
  for (let i = 0; i < 9; i++) {
    const flight = box(g, 0.06, 0.3, 0.06, -1.0 + i * 0.25, 0.62, -1.1, cream, 0.01);
    flight.rotation.x = 0.6;
  }
  g.userData.reel = reel;
  g.userData.spinners = [auger];
  return g;
}

function buildMower() {
  const g = new THREE.Group();
  const green = mat('#6d8f5f', 0.7);
  const steel = mat('#a2a8a8', 0.4, 0.55);
  const cream = mat('#eadcc4', 0.7);
  box(g, 0.2, 0.16, 1.4, 0, 0.5, 0.35, steel, 0.02);
  box(g, 1.9, 0.26, 0.9, 0, 0.48, -0.8, green, 0.05);
  box(g, 2.2, 0.1, 0.4, 0, 0.32, -1.9, cream, 0.03);
  const drums = [];
  for (let i = 0; i < 3; i++) {
    const x = -0.7 + i * 0.7;
    const drum = new THREE.Group();
    drum.position.set(x, 0.3, -1.95);
    cyl(drum, 0.28, 0.28, 0.1, 0, 0, 0, steel, 12);
    for (let j = 0; j < 3; j++) {
      const blade = box(drum, 0.5, 0.04, 0.12, 0, 0.0, 0.14, cream, 0.01);
      blade.rotation.y = j * Math.PI / 3;
      blade.position.set(Math.sin(j * Math.PI * 2 / 3) * 0.2, 0.02, Math.cos(j * Math.PI * 2 / 3) * 0.2);
    }
    g.add(drum);
    drums.push(drum);
  }
  box(g, 0.24, 0.3, 0.5, 0, 0.5, 0.15, steel, 0.02);
  g.userData.drums = drums;
  return g;
}

function buildTrailer() {
  const g = new THREE.Group();
  const wood = mat('#b98c5a', 0.9);
  const woodDark = mat('#976e43', 0.9);
  const steel = mat('#9aa0a0', 0.4, 0.55);
  const cream = mat('#efe2cb', 0.7);
  box(g, 0.14, 0.12, 1.3, 0, 0.42, 0.55, steel, 0.02);
  box(g, 2.0, 0.16, 2.6, 0, 0.72, -1.5, woodDark, 0.04);
  // slatted sides
  [-1.0, 1.0].forEach(x => {
    for (let i = 0; i < 3; i++) box(g, 0.08, 0.18, 2.5, x, 0.95 + i * 0.26, -1.5, wood, 0.02);
    box(g, 0.12, 0.9, 0.12, x, 1.15, 0.25, wood, 0.02);
    box(g, 0.12, 0.9, 0.12, x, 1.15, -3.25, wood, 0.02);
  });
  box(g, 2.0, 0.8, 0.1, 0, 1.12, -2.75, wood, 0.03);
  box(g, 2.0, 0.1, 0.1, 0, 1.5, -2.75, cream, 0.02);
  // wheels
  [[-1.05, -1.35], [1.05, -1.35]].forEach(([x, z]) => {
    const w = wheel(0.52, 0.3, 10);
    w.position.set(x, 0.52, z);
    g.add(w);
    g.userData.wheels = g.userData.wheels || [];
    g.userData.wheels.push(w);
  });
  // bales riding in the trailer
  const bales = new THREE.Group();
  for (let i = 0; i < 6; i++) {
    const bale = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.62, 10), mat('#dcc27c', 0.95));
    bale.rotation.x = Math.PI / 2;
    bale.position.set(i % 2 ? 0.34 : -0.34, 0.98, -0.7 - Math.floor(i / 2) * 0.62);
    bale.castShadow = true;
    bales.add(bale);
  }
  bales.visible = false;
  g.add(bales);
  g.userData.bales = bales;
  return g;
}

function buildImplement(id) {
  switch (id) {
    case 'plow': return buildPlough();
    case 'seed': return buildSeedDrill();
    case 'fertilize': return buildSpreader();
    case 'water': return buildWaterTank();
    case 'harvest': return buildHarvester();
    case 'mower': return buildMower();
    case 'trailer': return buildTrailer();
    default: return new THREE.Group();
  }
}

export function createTractor(scene) {
  const group = new THREE.Group();
  const body = buildTractorBody();
  group.add(body);

  const rearLeft = wheel(0.78, 0.46, 16);
  rearLeft.position.set(-0.95, 0.78, -0.62);
  const rearRight = wheel(0.78, 0.46, 16);
  rearRight.position.set(0.95, 0.78, -0.62);
  group.add(rearLeft, rearRight);

  const frontLeftPivot = new THREE.Group();
  frontLeftPivot.position.set(-0.84, 0.46, 1.12);
  const frontLeft = wheel(0.46, 0.32, 12);
  frontLeftPivot.add(frontLeft);
  const frontRightPivot = new THREE.Group();
  frontRightPivot.position.set(0.84, 0.46, 1.12);
  const frontRight = wheel(0.46, 0.32, 12);
  frontRightPivot.add(frontRight);
  group.add(frontLeftPivot, frontRightPivot);

  // exhaust smoke puffs
  const puffs = [];
  const puffMat = new THREE.MeshBasicMaterial({ color: 0xd8d2c4, transparent: true, opacity: 0.5, depthWrite: false });
  for (let i = 0; i < 8; i++) {
    const puff = new THREE.Mesh(new THREE.SphereGeometry(0.12, 6, 5), puffMat.clone());
    puff.visible = false;
    scene.add(puff);
    puffs.push({ mesh: puff, life: 0, max: 0 });
  }

  const forward = new THREE.Vector3(0, 0, 1);
  const position = new THREE.Vector3(-4, 0, 7);
  group.position.copy(position);

  const state = {
    group,
    position,
    forward,
    heading: Math.PI,
    speed: 0,
    steer: 0,
    current: 'plow',
    implements: {},
    hitch: new THREE.Vector3(),
    work: new THREE.Vector3(),
    puffs,
    dustClock: 0,
    speedKmh: 0
  };

  IMPLEMENTS.forEach(def => {
    const model = buildImplement(def.id);
    model.position.set(0, 0, -1.86);
    model.visible = false;
    group.add(model);
    state.implements[def.id] = model;
  });
  state.implements.plow.visible = true;

  group.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  scene.add(group);

  function setTool(id) {
    if (!state.implements[id]) return;
    Object.values(state.implements).forEach(m => { m.visible = false; });
    state.implements[id].visible = true;
    state.current = id;
    const model = state.implements[id];
    model.scale.setScalar(0.8);
    model.userData.pop = 0.35;
  }

  function detach() {
    Object.values(state.implements).forEach(m => { m.visible = false; });
    state.current = '';
  }

  function update(dt, input, elapsed) {
    const throttle = input.forward - input.back;
    const steer = input.right - input.left;
    const targetSpeed = throttle > 0 ? 6.4 : throttle < 0 ? -2.6 : 0;
    const accel = throttle === 0 ? 4.6 : 3.4;
    state.speed += Math.max(-accel * dt, Math.min(accel * dt, targetSpeed - state.speed));
    if (Math.abs(state.speed) < 0.04 && throttle === 0) state.speed = 0;

    const grip = Math.min(1, Math.abs(state.speed) / 1.6);
    state.steer += (steer - state.steer) * Math.min(1, dt * 7);
    const turn = state.steer * grip * 0.9 * Math.sign(state.speed || 1);
    state.heading += turn * dt;
    forward.set(Math.sin(state.heading), 0, Math.cos(state.heading));
    position.addScaledVector(forward, state.speed * dt);

    group.position.set(position.x, Math.abs(state.speed) > 0.2 ? Math.sin(elapsed * 16) * 0.012 : 0, position.z);
    group.rotation.y = state.heading;
    // a touch of body roll in the corners
    body.rotation.z = -state.steer * grip * 0.02;
    state.speedKmh = Math.abs(state.speed) * 3.6;

    const wheelSpin = state.speed * dt / 0.78;
    rearLeft.rotation.x += wheelSpin;
    rearRight.rotation.x += wheelSpin;
    frontLeft.rotation.x += state.speed * dt / 0.46;
    frontRight.rotation.x += state.speed * dt / 0.46;
    frontLeftPivot.rotation.y = state.steer * 0.45;
    frontRightPivot.rotation.y = state.steer * 0.45;

    state.hitch.copy(position).addScaledVector(forward, -1.95);
    const behind = IMPLEMENTS.find(i => i.id === state.current);
    state.work.copy(position).addScaledVector(forward, -(behind ? behind.behind : 2.2));

    // implement animations
    const impl = state.implements[state.current];
    if (impl) {
      impl.userData.pop = Math.max(0, (impl.userData.pop || 0) - dt);
      const pop = impl.userData.pop;
      impl.scale.setScalar(pop > 0 ? 1 - pop * 0.45 : 1);
      if (impl.userData.spinners) impl.userData.spinners.forEach(s => { s.rotation.y += dt * 7; });
      if (impl.userData.reel) impl.userData.reel.rotation.x += dt * 2.2;
      if (impl.userData.drums) impl.userData.drums.forEach((d, i) => { d.rotation.y += dt * (8 + i); });
      if (impl.userData.wheels) impl.userData.wheels.forEach(w => { w.rotation.x += state.speed * dt / 0.5; });
      if (impl.userData.rollers) impl.userData.rollers.forEach(w => { w.rotation.x += state.speed * dt / 0.26; });
    }

    // exhaust puffs
    state.dustClock += dt;
    if (Math.abs(state.speed) > 0.3 && state.dustClock > 0.16) {
      state.dustClock = 0;
      const puff = puffs.find(p => p.life <= 0);
      if (puff) {
        puff.life = puff.max = 1.1;
        puff.mesh.visible = true;
        puff.mesh.position.set(position.x + forward.x * 1.28 + 0.5 * Math.cos(state.heading), 2.65, position.z + forward.z * 1.28 - 0.5 * Math.sin(state.heading));
        puff.mesh.scale.setScalar(0.5);
      }
    }
    puffs.forEach(p => {
      if (p.life <= 0) return;
      p.life -= dt;
      p.mesh.position.y += dt * 0.55;
      p.mesh.position.x += dt * 0.2;
      p.mesh.scale.setScalar(0.5 + (1 - p.life / p.max) * 1.4);
      p.mesh.material.opacity = Math.max(0, p.life / p.max) * 0.4;
      if (p.life <= 0) p.mesh.visible = false;
    });

    return state;
  }

  return Object.assign(state, { setTool, detach, update, IMPLEMENTS });
}
