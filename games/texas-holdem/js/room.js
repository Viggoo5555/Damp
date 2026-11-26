/* =====================================================================
   TEXAS HOLD'EM — the room
   A private casino in walnut, brass and green felt. One practical light
   over the table, practicals in the walls, a fire, and a little smoke.
   ===================================================================== */

import * as THREE from 'three';
import { RoundedBoxGeometry } from '../../../vendor/three/RoundedBoxGeometry.js';
import {
  makeWoodTexture, makeFeltTexture, makeLeatherTexture, makeRugTexture,
  makeFabricTexture, makePaintingTexture, makeSignTexture, makeGlowTexture,
  makeParticleTexture, makeSmokeTexture, makeWindowTexture, chipTextures
} from './assets.js';

export const TABLE = {
  rx: 1.9,
  rz: 1.05,
  topY: 0.785,
  railY: 0.91,
  seatRx: 2.45,
  seatRz: 1.58,
  dealer: { x: 1.55, z: -1.95, yaw: -0.67 },
  deck: { x: 1.12, y: 0.8, z: -0.55 },
  board: { x: 0, y: 0.792, z: 0.02 },
  pot: { x: 0.62, y: 0.792, z: -0.52 },
  muck: { x: -0.82, y: 0.79, z: -0.5 }
};

export const ROOM = { width: 12.4, depth: 10.8, height: 4.25 };

function mat(colour, options = {}) {
  return new THREE.MeshStandardMaterial({ color: colour, roughness: 0.65, ...options });
}

function box(parent, width, height, depth, materialRef, x, y, z, rotation = 0, cast = true) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), materialRef);
  mesh.position.set(x, y, z);
  mesh.rotation.y = rotation;
  mesh.castShadow = cast;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function ellipseShape(rx, rz) {
  const shape = new THREE.Shape();
  shape.absellipse(0, 0, rx, rz, 0, Math.PI * 2, false, 0);
  return shape;
}

function ringShape(rxOuter, rzOuter, rxInner, rzInner) {
  const shape = ellipseShape(rxOuter, rzOuter);
  const hole = new THREE.Path();
  hole.absellipse(0, 0, rxInner, rzInner, 0, Math.PI * 2, true, 0);
  shape.holes.push(hole);
  return shape;
}

function glowSprite(texture, colour, scale, opacity) {
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
    map: texture, color: colour, transparent: true, opacity,
    depthWrite: false, blending: THREE.AdditiveBlending
  }));
  sprite.scale.set(scale, scale, 1);
  return sprite;
}

function addChandelier(parent, x, z, scale, glowTex, candleMat) {
  const group = new THREE.Group();
  group.position.set(x, 0, z);
  const gold = mat('#b08b52', { metalness: 0.85, roughness: 0.28, envMapIntensity: 1.3 });
  const crystal = new THREE.MeshPhysicalMaterial({
    color: '#fff0cf', metalness: 0.1, roughness: 0.08, transparent: true,
    opacity: 0.55, envMapIntensity: 1.8
  });
  // chain
  for (let i = 0; i < 4; i++) {
    const link = new THREE.Mesh(new THREE.TorusGeometry(0.055, 0.013, 6, 12), gold);
    link.position.y = 3.15 + i * 0.16 + 0.16;
    link.rotation.x = Math.PI / 2;
    group.add(link);
  }
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.05, 0.55, 12), gold);
  stem.position.y = 3.62;
  group.add(stem);
  const crown = new THREE.Mesh(new THREE.SphereGeometry(0.11, 16, 12), gold);
  crown.position.y = 3.88;
  group.add(crown);
  const tiers = [
    { radius: 0.76, y: 3.02, arms: 8, candles: 8 },
    { radius: 0.45, y: 3.42, arms: 6, candles: 6 }
  ];
  for (const tier of tiers) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(tier.radius, 0.022, 8, 36), gold);
    ring.position.y = tier.y;
    ring.rotation.x = Math.PI / 2;
    group.add(ring);
    const ring2 = new THREE.Mesh(new THREE.TorusGeometry(tier.radius * 0.94, 0.012, 6, 36), gold);
    ring2.position.y = tier.y + 0.05;
    ring2.rotation.x = Math.PI / 2;
    group.add(ring2);
    for (let i = 0; i < tier.arms; i++) {
      const angle = (i / tier.arms) * Math.PI * 2;
      const px = Math.cos(angle) * tier.radius;
      const pz = Math.sin(angle) * tier.radius;
      const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.018, 0.34, 6), gold);
      arm.position.set(px * 0.52, tier.y + 0.11, pz * 0.52);
      arm.rotation.z = Math.cos(angle) * 0.55;
      arm.rotation.x = Math.sin(angle) * 0.55;
      group.add(arm);
      const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.035, 0.06, 12), gold);
      cup.position.set(px, tier.y + 0.22, pz);
      group.add(cup);
      const candle = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.024, 0.15, 10), candleMat);
      candle.position.set(px, tier.y + 0.33, pz);
      group.add(candle);
      const flame = new THREE.Mesh(new THREE.SphereGeometry(0.018, 8, 8), new THREE.MeshBasicMaterial({ color: '#ffdba0' }));
      flame.scale.set(0.8, 1.5, 0.8);
      flame.position.set(px, tier.y + 0.42, pz);
      group.add(flame);
      const halo = glowSprite(glowTex, '#ffca7d', 0.34, 0.55);
      halo.position.copy(flame.position);
      group.add(halo);
    }
    for (let i = 0; i < 14; i++) {
      const angle = (i / 14) * Math.PI * 2;
      const drop = new THREE.Mesh(new THREE.OctahedronGeometry(0.045, 0), crystal);
      drop.position.set(Math.cos(angle) * tier.radius, tier.y - 0.17 - (i % 3) * 0.07, Math.sin(angle) * tier.radius);
      drop.scale.set(0.7, 1.8, 0.7);
      group.add(drop);
    }
  }
  const lower = new THREE.Mesh(new THREE.OctahedronGeometry(0.11, 0), crystal);
  lower.position.y = 2.82;
  lower.scale.set(0.8, 1.8, 0.8);
  group.add(lower);
  group.scale.setScalar(scale);
  group.position.y = 3.95 * (1 - scale);
  parent.add(group);
  return group;
}

function addSconce(parent, x, y, z, yaw, glowTex) {
  const gold = mat('#b08b52', { metalness: 0.85, roughness: 0.3 });
  const group = new THREE.Group();
  group.position.set(x, y, z);
  group.rotation.y = yaw;
  const plate = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.13, 0.035, 16), gold);
  plate.rotation.x = Math.PI / 2;
  group.add(plate);
  const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.02, 0.38, 8), gold);
  arm.position.set(0, 0.02, 0.2);
  arm.rotation.x = Math.PI / 2.4;
  group.add(arm);
  for (const side of [-1, 1]) {
    const candle = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.02, 0.14, 8), mat('#efe3cb', { roughness: 0.7 }));
    candle.position.set(side * 0.13, 0.15, 0.34);
    group.add(candle);
    const flame = new THREE.Mesh(new THREE.SphereGeometry(0.014, 8, 8), new THREE.MeshBasicMaterial({ color: '#ffd79b' }));
    flame.scale.y = 1.5;
    flame.position.set(side * 0.13, 0.24, 0.34);
    group.add(flame);
    const glow = glowSprite(glowTex, '#ffbc6e', 0.34, 0.5);
    glow.position.copy(flame.position);
    group.add(glow);
  }
  parent.add(group);
  return group;
}

function addPainting(parent, x, y, z, yaw, width, height, seed) {
  const frame = mat('#7b5a31', { metalness: 0.55, roughness: 0.4 });
  const group = new THREE.Group();
  group.position.set(x, y, z);
  group.rotation.y = yaw;
  const backing = new THREE.Mesh(new THREE.BoxGeometry(width + 0.14, height + 0.14, 0.055), frame);
  backing.castShadow = true;
  group.add(backing);
  const canvas = new THREE.Mesh(new THREE.PlaneGeometry(width, height), new THREE.MeshStandardMaterial({
    map: makePaintingTexture(seed), roughness: 0.62
  }));
  canvas.position.z = 0.032;
  group.add(canvas);
  const lip = new THREE.Mesh(new THREE.BoxGeometry(width + 0.2, height + 0.2, 0.02), mat('#a3824c', { metalness: 0.7, roughness: 0.35 }));
  lip.position.z = -0.015;
  group.add(lip);
  parent.add(group);
  return group;
}

function addBottle(parent, x, y, z, colour, height) {
  const glass = new THREE.MeshPhysicalMaterial({
    color: colour, roughness: 0.08, metalness: 0.05, transparent: true,
    opacity: 0.55, envMapIntensity: 1.2
  });
  const liquid = new THREE.MeshPhysicalMaterial({
    color: colour === '#7a3b16' ? '#6b3010' : colour, roughness: 0.2,
    transparent: true, opacity: 0.75, envMapIntensity: 0.8
  });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.064, height * 0.62, 14), glass);
  body.position.set(x, y + height * 0.31, z);
  parent.add(body);
  const inner = new THREE.Mesh(new THREE.CylinderGeometry(0.043, 0.051, height * 0.42, 12), liquid);
  inner.position.set(x, y + height * 0.24, z);
  parent.add(inner);
  const shoulder = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.055, 0.1, 14), glass);
  shoulder.position.set(x, y + height * 0.66, z);
  parent.add(shoulder);
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.025, height * 0.22, 12), glass);
  neck.position.set(x, y + height * 0.76, z);
  parent.add(neck);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.023, 0.023, 0.035, 12), mat('#2a1b0f', { roughness: 0.4 }));
  cap.position.set(x, y + height * 0.88, z);
  parent.add(cap);
  const label = new THREE.Mesh(new THREE.CylinderGeometry(0.058, 0.062, 0.1, 14, 1, true), mat('#d5c6a2', { roughness: 0.85 }));
  label.position.set(x, y + height * 0.32, z);
  parent.add(label);
}

function addGlass(parent, x, y, z) {
  const glassMat = new THREE.MeshPhysicalMaterial({
    color: '#d8d2c2', roughness: 0.05, metalness: 0.02, transparent: true,
    opacity: 0.35, envMapIntensity: 1.4
  });
  const tumbler = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.043, 0.11, 16, 1, true), glassMat);
  tumbler.position.set(x, y + 0.055, z);
  parent.add(tumbler);
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.044, 0.044, 0.012, 16), glassMat);
  base.position.set(x, y + 0.006, z);
  parent.add(base);
  const whiskey = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.039, 0.045, 16), new THREE.MeshPhysicalMaterial({
    color: '#8a4a17', roughness: 0.15, transparent: true, opacity: 0.85
  }));
  whiskey.position.set(x, y + 0.032, z);
  parent.add(whiskey);
}

function addPlant(parent, x, z) {
  const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.22, 0.42, 20), mat('#2b2620', { roughness: 0.6 }));
  pot.position.set(x, 0.21, z);
  pot.castShadow = true;
  parent.add(pot);
  const soil = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.27, 0.03, 20), mat('#1b120a', { roughness: 1 }));
  soil.position.set(x, 0.42, z);
  parent.add(soil);
  const leafMat = mat('#223f2a', { roughness: 0.8 });
  for (let i = 0; i < 11; i++) {
    const angle = Math.random() * Math.PI * 2;
    const lean = 0.2 + Math.random() * 0.7;
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.018, 0.5 + Math.random() * 0.8, 6), leafMat);
    stem.position.set(x, 0.55 + Math.random() * 0.3, z);
    stem.rotation.z = Math.cos(angle) * lean;
    stem.rotation.x = Math.sin(angle) * lean;
    stem.castShadow = true;
    parent.add(stem);
    const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.2 + Math.random() * 0.12, 10, 8), leafMat);
    leaf.scale.set(1.4, 0.22, 0.7);
    leaf.position.set(x + Math.cos(angle) * 0.32 * lean * 2, 0.9 + Math.random() * 0.7, z + Math.sin(angle) * 0.32 * lean * 2);
    leaf.rotation.z = Math.random() * 0.8;
    leaf.castShadow = true;
    parent.add(leaf);
  }
}

function addSofa(parent, x, z, yaw) {
  const leather = mat('#241a1a', { roughness: 0.52 });
  const walnut = mat('#2b1b12', { roughness: 0.45 });
  const group = new THREE.Group();
  group.position.set(x, 0, z);
  group.rotation.y = yaw;
  box(group, 2.35, 0.28, 0.92, leather, 0, 0.58, 0);
  box(group, 2.25, 0.52, 0.18, leather, 0, 0.92, -0.38);
  for (const side of [-1, 1]) {
    box(group, 0.17, 0.65, 0.92, leather, side * 1.1, 0.8, 0);
    for (let i = 0; i < 2; i++) {
      const cushion = new THREE.Mesh(new RoundedBoxGeometry(0.67, 0.2, 0.72, 4, 0.06), leather);
      cushion.position.set(-0.37 + i * 0.73, 0.78, 0.03);
      cushion.castShadow = true;
      group.add(cushion);
    }
    for (let i = 0; i < 5; i++) {
      const stud = new THREE.Mesh(new THREE.SphereGeometry(0.011, 6, 6), mat('#a88654', { metalness: 0.8, roughness: 0.35 }));
      stud.position.set(side * 1.195, 0.66 + i * 0.12, 0.4);
      group.add(stud);
    }
    box(group, 0.1, 0.5, 0.1, walnut, side * 0.85, 0.22, -0.3);
    box(group, 0.1, 0.5, 0.1, walnut, side * 0.85, 0.22, 0.3);
  }
  parent.add(group);
}

export function buildRoom() {
  const root = new THREE.Group();
  const props = new THREE.Group();
  root.add(props);

  const woodDark = makeWoodTexture({ base: '#2b1a12', grain: '#160d08', highlight: '#4a2f1e', repeat: [4, 2] });
  const woodFloor = makeWoodTexture({ base: '#3a2417', grain: '#241209', highlight: '#63412a', horizontal: false, repeat: [6, 5] });
  const woodRail = makeWoodTexture({ base: '#4a2c19', grain: '#2a150b', highlight: '#7a4d2d', repeat: [3, 1] });
  const feltTexture = makeFeltTexture();
  const leatherTexture = makeLeatherTexture('#201715');
  const rugTexture = makeRugTexture();
  const velvet = makeFabricTexture('#2c1517');
  const glowTex = makeGlowTexture();
  const particleTex = makeParticleTexture();
  const smokeTex = makeSmokeTexture();

  const wallMat = new THREE.MeshStandardMaterial({ map: woodDark, roughness: 0.68, envMapIntensity: 0.35 });
  const floorMat = new THREE.MeshPhysicalMaterial({
    map: woodFloor, roughness: 0.34, metalness: 0.03, clearcoat: 0.4,
    clearcoatRoughness: 0.35, envMapIntensity: 0.5
  });
  const railMat = new THREE.MeshPhysicalMaterial({
    map: woodRail, color: '#b08a6a', roughness: 0.36, clearcoat: 0.25, clearcoatRoughness: 0.4,
    envMapIntensity: 0.55
  });
  const leatherMat = new THREE.MeshPhysicalMaterial({
    map: leatherTexture, color: '#4a2f24', roughness: 0.55, sheen: 0.06,
    sheenColor: new THREE.Color('#8d6248'), envMapIntensity: 0.28
  });
  const feltMat = new THREE.MeshStandardMaterial({ map: feltTexture, roughness: 0.95, envMapIntensity: 0.08 });
  const brassMat = new THREE.MeshStandardMaterial({ color: '#b08a52', metalness: 0.9, roughness: 0.28, envMapIntensity: 1.2 });
  const blackWood = new THREE.MeshPhysicalMaterial({ map: woodRail, color: '#3b2518', roughness: 0.38, clearcoat: 0.2, envMapIntensity: 0.45 });

  // floor
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(ROOM.width + 2.5, ROOM.depth + 2.5), floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = 0;
  floor.receiveShadow = true;
  root.add(floor);

  const rug = new THREE.Mesh(new THREE.PlaneGeometry(6.8, 4.7), new THREE.MeshStandardMaterial({ map: rugTexture, roughness: 0.9, envMapIntensity: 0.18 }));
  rug.rotation.x = -Math.PI / 2;
  rug.position.set(0, 0.012, 0.05);
  rug.receiveShadow = true;
  root.add(rug);

  // ceiling and beams
  const ceiling = box(root, ROOM.width, 0.16, ROOM.depth, new THREE.MeshStandardMaterial({ color: '#21140e', roughness: 0.82 }), 0, ROOM.height, 0, 0, false);
  ceiling.receiveShadow = true;
  const beamMat = new THREE.MeshStandardMaterial({ map: woodDark, color: '#4a2c1c', roughness: 0.7 });
  for (const x of [-3.4, 0, 3.4]) box(root, 0.3, 0.24, ROOM.depth, beamMat, x, ROOM.height - 0.12, 0, 0, false);
  box(root, ROOM.width, 0.22, 0.3, beamMat, 0, ROOM.height - 0.12, -2.7, 0, false);
  box(root, ROOM.width, 0.22, 0.3, beamMat, 0, ROOM.height - 0.12, 2.7, 0, false);

  // walls
  const halfW = ROOM.width / 2;
  const halfD = ROOM.depth / 2;
  box(root, ROOM.width, ROOM.height, 0.18, wallMat, 0, ROOM.height / 2, -halfD);
  box(root, ROOM.width, ROOM.height, 0.18, wallMat, 0, ROOM.height / 2, halfD);
  box(root, 0.18, ROOM.height, ROOM.depth, wallMat, -halfW, ROOM.height / 2, 0);
  box(root, 0.18, ROOM.height, ROOM.depth, wallMat, halfW, ROOM.height / 2, 0);

  // wainscoting and mouldings
  const trimMat = new THREE.MeshStandardMaterial({ map: woodDark, color: '#573521', roughness: 0.5, envMapIntensity: 0.3 });
  const goldTrim = new THREE.MeshStandardMaterial({ color: '#9f7b46', metalness: 0.65, roughness: 0.4 });
  for (const side of [-1, 1]) {
    box(root, ROOM.width - 0.3, 1.05, 0.07, trimMat, 0, 0.55, side * (halfD - 0.1), 0, false);
    box(root, ROOM.width - 0.3, 0.07, 0.13, trimMat, 0, 1.1, side * (halfD - 0.12), 0, false);
    box(root, ROOM.width - 0.2, 0.14, 0.16, trimMat, 0, ROOM.height - 0.35, side * (halfD - 0.12), 0, false);
    box(root, 0.07, 1.05, ROOM.depth - 0.3, trimMat, side * (halfW - 0.1), 0.55, 0, 0, false);
    box(root, 0.13, 0.07, ROOM.depth - 0.3, trimMat, side * (halfW - 0.12), 1.1, 0, 0, false);
    box(root, 0.16, 0.14, ROOM.depth - 0.2, trimMat, side * (halfW - 0.12), ROOM.height - 0.35, 0, 0, false);
  }
  // upper wall panels on back wall
  for (const x of [-4.55, -3.15, 3.15, 4.55]) {
    box(root, 1.12, 2.2, 0.05, trimMat, x, 2.5, -halfD + 0.1, 0, false);
    box(root, 1.02, 2.1, 0.03, wallMat, x, 2.5, -halfD + 0.13, 0, false);
    box(root, 1.2, 0.025, 0.065, goldTrim, x, 3.62, -halfD + 0.12, 0, false);
    box(root, 1.2, 0.025, 0.065, goldTrim, x, 1.4, -halfD + 0.12, 0, false);
  }

  // back wall sign
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 1.15), new THREE.MeshStandardMaterial({
    map: makeSignTexture('THE DAMP ROOM', 'PRIVATE TABLE · Nº 7'), roughness: 0.6
  }));
  sign.position.set(0, 3, -halfD + 0.11);
  root.add(sign);
  box(root, 3.65, 1.4, 0.05, new THREE.MeshStandardMaterial({ color: '#1a110b', roughness: 0.6 }), 0, 3, -halfD + 0.07, 0, false);

  // fireplace on the left wall
  const stone = new THREE.MeshStandardMaterial({ color: '#3d3329', roughness: 0.85 });
  const fireGroup = new THREE.Group();
  fireGroup.position.set(-halfW + 0.22, 0, 0.9);
  fireGroup.rotation.y = Math.PI / 2;
  box(fireGroup, 2.3, 1.55, 0.36, stone, 0, 0.78, 0);
  box(fireGroup, 2.55, 0.14, 0.48, stone, 0, 1.58, 0.04);
  const opening = box(fireGroup, 1.35, 0.96, 0.4, new THREE.MeshStandardMaterial({ color: '#080504', roughness: 1 }), 0, 0.58, 0.06, 0, false);
  const emberMat = new THREE.MeshBasicMaterial({ color: '#ff7a2a' });
  for (let i = 0; i < 7; i++) {
    const log = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.06, 0.5 + Math.random() * 0.4, 8), new THREE.MeshStandardMaterial({ color: '#24140b', roughness: 0.9 }));
    log.rotation.z = Math.PI / 2;
    log.rotation.y = Math.random() * 0.7;
    log.position.set((Math.random() - 0.5) * 0.5, 0.2 + Math.random() * 0.2, 0.25);
    fireGroup.add(log);
  }
  for (let i = 0; i < 5; i++) {
    const ember = new THREE.Mesh(new THREE.SphereGeometry(0.04 + Math.random() * 0.04, 6, 5), emberMat);
    ember.position.set((Math.random() - 0.5) * 0.8, 0.13, 0.26);
    fireGroup.add(ember);
  }
  const flameMat = new THREE.MeshBasicMaterial({ color: '#ffab4b', transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false });
  const flames = [];
  for (let i = 0; i < 4; i++) {
    const flame = new THREE.Mesh(new THREE.ConeGeometry(0.11 + i * 0.02, 0.35 + i * 0.1, 8), flameMat);
    flame.position.set((i - 1.5) * 0.14, 0.32, 0.3);
    fireGroup.add(flame);
    flames.push(flame);
  }
  root.add(fireGroup);
  addPainting(root, -halfW + 0.12, 2.85, 0.9, Math.PI / 2, 1.5, 1.1, 3);

  // bar / sideboard on the right wall
  const barGroup = new THREE.Group();
  barGroup.position.set(halfW - 0.05, 0, 1.0);
  barGroup.rotation.y = -Math.PI / 2;
  box(barGroup, 2.6, 0.9, 0.6, blackWood, 0, 0.45, 0);
  box(barGroup, 2.7, 0.06, 0.68, new THREE.MeshStandardMaterial({ color: '#40291a', roughness: 0.35 }), 0, 0.93, 0);
  for (const side of [-1, 1]) {
    box(barGroup, 0.04, 0.62, 0.02, goldTrim, side * 0.62, 0.48, 0.29, 0, false);
    addMeshHandle(barGroup, side * 0.35, 0.48, 0.32);
  }
  for (const x of [-1.02, -0.6, 0.15, 0.7, 1.06]) addBottle(barGroup, x, 0.96, 0.02, x < 0 ? '#6b3111' : x > 0.5 ? '#3a1f0e' : '#224024', 0.36 + Math.abs(x) * 0.18);
  addGlass(barGroup, -0.28, 0.96, 0.15);
  addGlass(barGroup, 0.32, 0.96, -0.1);
  const mirrorBack = box(barGroup, 2.1, 1.55, 0.05, new THREE.MeshStandardMaterial({ color: '#17201f', metalness: 0.75, roughness: 0.2 }), 0, 2.15, -0.06, 0, false);
  box(barGroup, 2.2, 0.06, 0.08, goldTrim, 0, 2.95, -0.06, 0, false);
  box(barGroup, 2.2, 0.06, 0.08, goldTrim, 0, 1.35, -0.06, 0, false);
  root.add(barGroup);

  function addMeshHandle(parent, x, y, z) {
    const handle = new THREE.Mesh(new THREE.TorusGeometry(0.035, 0.007, 6, 14), brassMat);
    handle.position.set(x, y, z);
    handle.rotation.y = Math.PI / 2;
    parent.add(handle);
  }

  // curtained windows on the right wall
  for (const z of [-1.5, 1.9]) {
    const windowGroup = new THREE.Group();
    windowGroup.position.set(halfW - 0.12, 2.2, z);
    windowGroup.rotation.y = -Math.PI / 2;
    const frame = box(windowGroup, 1.1, 2.3, 0.13, trimMat, 0, 0, 0, 0, false);
    const night = new THREE.Mesh(new THREE.PlaneGeometry(0.92, 2.08), new THREE.MeshBasicMaterial({ map: makeWindowTexture(), color: '#8c9eb2' }));
    night.position.z = 0.075;
    windowGroup.add(night);
    box(windowGroup, 0.07, 2.15, 0.09, trimMat, -0.52, 0, 0.1, 0, false);
    box(windowGroup, 0.07, 2.15, 0.09, trimMat, 0.52, 0, 0.1, 0, false);
    box(windowGroup, 1.08, 0.07, 0.09, trimMat, 0, 1.05, 0.1, 0, false);
    for (const side of [-1, 1]) {
      const curtain = new THREE.Mesh(new THREE.PlaneGeometry(0.45, 2.8), new THREE.MeshStandardMaterial({ map: velvet, color: '#4a2022', roughness: 0.9, side: THREE.DoubleSide }));
      curtain.position.set(side * 0.78, 0.15, 0.12);
      curtain.rotation.z = side * 0.03;
      windowGroup.add(curtain);
    }
    root.add(windowGroup);
  }

  // lounge in the near-left corner
  addSofa(root, -3.95, 2.7, 0.65);
  const sideTable = new THREE.Group();
  sideTable.position.set(-2.55, 0, 3.25);
  const tableTop = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, 0.05, 24), blackWood);
  tableTop.position.y = 0.6;
  tableTop.castShadow = true;
  sideTable.add(tableTop);
  const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.07, 0.6, 12), brassMat);
  leg.position.y = 0.3;
  sideTable.add(leg);
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.3, 0.035, 20), brassMat);
  base.position.y = 0.02;
  sideTable.add(base);
  addGlass(sideTable, 0.1, 0.625, 0.05);
  root.add(sideTable);

  addPlant(root, -5.2, -4.2);
  addPlant(root, 5.15, 4.1);

  // paintings on side walls
  addPainting(root, -halfW + 0.12, 2.7, -2.3, Math.PI / 2, 1.1, 0.85, 7);
  addPainting(root, halfW - 0.12, 2.9, -2.65, -Math.PI / 2, 1.2, 0.9, 11);

  /* ---------------- table ------------------------------------------- */

  const tableGroup = new THREE.Group();
  tableGroup.position.y = 0;
  root.add(tableGroup);

  const felt = new THREE.Mesh(new THREE.CircleGeometry(1, 128), feltMat);
  felt.scale.set(TABLE.rx, TABLE.rz, 1);
  felt.rotation.x = -Math.PI / 2;
  felt.position.y = TABLE.topY;
  felt.receiveShadow = true;
  tableGroup.add(felt);

  const railBase = new THREE.Mesh(
    new THREE.ExtrudeGeometry(ringShape(TABLE.rx + 0.25, TABLE.rz + 0.23, TABLE.rx + 0.015, TABLE.rz + 0.0), {
      depth: 0.1, steps: 1, bevelEnabled: true, bevelSegments: 2, bevelSize: 0.025, bevelThickness: 0.02, curveSegments: 96
    }),
    railMat
  );
  railBase.rotation.x = -Math.PI / 2;
  railBase.position.y = TABLE.topY - 0.02;
  railBase.castShadow = true;
  railBase.receiveShadow = true;
  tableGroup.add(railBase);

  const armrest = new THREE.Mesh(
    new THREE.ExtrudeGeometry(ringShape(TABLE.rx + 0.27, TABLE.rz + 0.25, TABLE.rx + 0.06, TABLE.rz + 0.04), {
      depth: 0.022, steps: 1, bevelEnabled: true, bevelSegments: 3, bevelSize: 0.024, bevelThickness: 0.015, curveSegments: 96
    }),
    leatherMat
  );
  armrest.rotation.x = -Math.PI / 2;
  armrest.position.y = TABLE.railY - 0.055;
  armrest.castShadow = true;
  armrest.receiveShadow = true;
  tableGroup.add(armrest);

  // brass inlay
  const inlayCurve = new THREE.EllipseCurve(0, 0, TABLE.rx - 0.07, TABLE.rz - 0.035, 0, Math.PI * 2, false, 0);
  const inlayPoints = inlayCurve.getPoints(220).map((p) => new THREE.Vector3(p.x, 0, p.y));
  const inlay = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(inlayPoints, true), 220, 0.006, 6, true), brassMat);
  inlay.position.y = TABLE.topY + 0.004;
  tableGroup.add(inlay);

  // brass tacks around the armrest
  const tackGeo = new THREE.SphereGeometry(0.013, 8, 6);
  for (let i = 0; i < 64; i++) {
    const angle = (i / 64) * Math.PI * 2;
    const tack = new THREE.Mesh(tackGeo, brassMat);
    tack.position.set(Math.cos(angle) * (TABLE.rx + 0.195) * 1.0, TABLE.railY - 0.015, Math.sin(angle) * (TABLE.rz + 0.18));
    tack.scale.setScalar(0.7);
    tableGroup.add(tack);
  }

  // apron
  const apron = new THREE.Mesh(new THREE.CylinderGeometry(1, 0.97, 0.22, 64), blackWood);
  apron.scale.set(TABLE.rx + 0.08, 1, TABLE.rz + 0.04);
  apron.position.y = TABLE.topY - 0.17;
  apron.castShadow = true;
  tableGroup.add(apron);
  const trim = new THREE.Mesh(new THREE.TorusGeometry(1, 0.006, 6, 120), brassMat);
  trim.scale.set(TABLE.rx + 0.06, TABLE.rz + 0.02, 1);
  trim.rotation.x = Math.PI / 2;
  trim.position.y = TABLE.topY - 0.08;
  tableGroup.add(trim);

  // pedestal
  const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.36, 0.48, 24), blackWood);
  pillar.position.y = 0.36;
  pillar.castShadow = true;
  tableGroup.add(pillar);
  const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.44, 0.12, 24), railMat);
  collar.position.y = 0.62;
  collar.castShadow = true;
  tableGroup.add(collar);
  const footBase = new THREE.Mesh(new THREE.CylinderGeometry(0.52, 0.58, 0.08, 32), blackWood);
  footBase.position.y = 0.06;
  footBase.castShadow = true;
  tableGroup.add(footBase);
  for (let i = 0; i < 4; i++) {
    const angle = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const foot = new THREE.Mesh(new RoundedBoxGeometry(0.18, 0.13, 1.1, 3, 0.05), blackWood);
    foot.position.set(Math.cos(angle) * 0.42, 0.11, Math.sin(angle) * 0.42);
    foot.rotation.y = -angle;
    foot.castShadow = true;
    tableGroup.add(foot);
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.12, 0.03, 12), brassMat);
    cap.position.set(Math.cos(angle) * 0.93, 0.04, Math.sin(angle) * 0.93);
    tableGroup.add(cap);
  }

  // dealer tray on the far rail
  const tray = new THREE.Group();
  tray.position.set(1.18, TABLE.railY - 0.04, -0.98);
  tray.rotation.y = -0.6;
  box(tray, 0.7, 0.05, 0.24, blackWood, 0, 0, 0);
  for (let i = 0; i < 5; i++) {
    const colour = [[25, '#1f5b3b'], [100, '#181818'], [500, '#4b2864'], [1000, '#a67c28'], [5000, '#6b221d']][i];
    const textures = chipTextures(colour[0]);
    const chip = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.012, 24), [
      new THREE.MeshStandardMaterial({ map: textures.side, roughness: 0.4 }),
      new THREE.MeshStandardMaterial({ map: textures.top, roughness: 0.35 }),
      new THREE.MeshStandardMaterial({ map: textures.top, roughness: 0.35 })
    ]);
    chip.position.set(-0.26 + i * 0.13, 0.045, 0);
    tray.add(chip);
  }
  tableGroup.add(tray);

  // chips under the tray that a dealer keeps to hand
  /* ---------------- light ------------------------------------------- */

  const hemi = new THREE.HemisphereLight('#ffd8aa', '#140c08', 0.5);
  root.add(hemi);
  const ambient = new THREE.AmbientLight('#5d3c25', 0.55);
  root.add(ambient);

  const tableSpot = new THREE.SpotLight('#ffd3a0', 90, 10, 1.02, 0.72, 1.35);
  tableSpot.position.set(0, 3.9, 0.15);
  tableSpot.target.position.set(0, TABLE.topY, 0);
  tableSpot.castShadow = true;
  tableSpot.shadow.mapSize.set(2048, 2048);
  tableSpot.shadow.camera.near = 0.5;
  tableSpot.shadow.camera.far = 9;
  tableSpot.shadow.bias = -0.00025;
  tableSpot.shadow.normalBias = 0.018;
  tableSpot.shadow.radius = 4;
  root.add(tableSpot, tableSpot.target);

  const fireLight = new THREE.PointLight('#ff8137', 18, 6.5, 1.8);
  fireLight.position.set(-halfW + 0.9, 0.8, 0.9);
  root.add(fireLight);

  const chandelierLight = new THREE.PointLight('#ffc37b', 50, 8, 1.9);
  chandelierLight.position.set(0, 3.0, 0);
  root.add(chandelierLight);

  const candleMat = new THREE.MeshStandardMaterial({ color: '#e8dcc0', roughness: 0.7 });
  const chandelier = addChandelier(root, 0, 0, 1, glowTex, candleMat);
  const chandelierBar = addChandelier(root, 3.75, 2.0, 0.52, glowTex, candleMat);

  const sconces = [];
  const sconcePositions = [
    [-3.1, 2.35, -halfD + 0.24, 0],
    [3.1, 2.35, -halfD + 0.24, 0],
    [-halfW + 0.24, 2.25, -2.1, Math.PI / 2],
    [halfW - 0.24, 2.25, -2.15, -Math.PI / 2]
  ];
  for (const [x, y, z, yaw] of sconcePositions) {
    addSconce(root, x, y, z, yaw, glowTex);
  }

  // cool window spill for contrast
  const windowLight = new THREE.DirectionalLight('#7894b5', 0.34);
  windowLight.position.set(8, 3.4, -1);
  root.add(windowLight);

  /* ---------------- atmosphere ------------------------------------- */

  const dustCount = 420;
  const dustPositions = new Float32Array(dustCount * 3);
  const dustSeeds = [];
  for (let i = 0; i < dustCount; i++) {
    const x = (Math.random() - 0.5) * 9.5;
    const y = 0.3 + Math.random() * 3.4;
    const z = (Math.random() - 0.5) * 7.8;
    dustPositions.set([x, y, z], i * 3);
    dustSeeds.push({ x, y, z, phase: Math.random() * Math.PI * 2, speed: 0.02 + Math.random() * 0.06 });
  }
  const dustGeo = new THREE.BufferGeometry();
  dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPositions, 3));
  const dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({
    map: particleTex, color: '#ffd9a1', size: 0.026, transparent: true, opacity: 0.42,
    depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true
  }));
  dust.frustumCulled = false;
  root.add(dust);

  const smoke = [];
  for (let i = 0; i < 12; i++) {
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
      map: smokeTex, color: '#d8c7b4', transparent: true, opacity: 0.07,
      depthWrite: false, blending: THREE.NormalBlending
    }));
    const scale = 2.2 + Math.random() * 3.4;
    sprite.scale.set(scale, scale * 0.7, 1);
    sprite.position.set((Math.random() - 0.5) * 6, 2.3 + Math.random() * 1.4, (Math.random() - 0.5) * 5);
    root.add(sprite);
    smoke.push({ sprite, phase: Math.random() * 10, baseX: sprite.position.x, baseZ: sprite.position.z, drift: 0.05 + Math.random() * 0.08 });
  }

  // light shafts under the main chandelier
  const shafts = [];
  const shaftTexture = (() => {
    const canvas = document.createElement('canvas');
    canvas.width = 32;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');
    const gradient = ctx.createLinearGradient(0, 0, 0, 256);
    gradient.addColorStop(0, 'rgba(255,214,156,0.32)');
    gradient.addColorStop(0.35, 'rgba(255,202,132,0.12)');
    gradient.addColorStop(1, 'rgba(255,190,110,0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 32, 256);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  })();
  for (const [x, z, radius] of [[0, 0, 2.6], [3.75, 2.0, 1.3]]) {
    const shaft = new THREE.Mesh(new THREE.ConeGeometry(radius, 3.0, 32, 1, true), new THREE.MeshBasicMaterial({
      map: shaftTexture, color: '#ffd7a0', transparent: true, opacity: 0.3,
      blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide
    }));
    shaft.position.set(x, 1.55, z);
    root.add(shaft);
    shafts.push(shaft);
  }

  const flameLights = [fireLight, chandelierLight];

  function update(dt, time) {
    // dust
    const positions = dustGeo.attributes.position.array;
    for (let i = 0; i < dustCount; i++) {
      const seed = dustSeeds[i];
      positions[i * 3] = seed.x + Math.sin(time * seed.speed + seed.phase) * 0.35;
      positions[i * 3 + 1] = seed.y + Math.sin(time * seed.speed * 0.7 + seed.phase) * 0.16;
      positions[i * 3 + 2] = seed.z + Math.cos(time * seed.speed * 0.8 + seed.phase) * 0.32;
    }
    dustGeo.attributes.position.needsUpdate = true;

    for (const cloud of smoke) {
      cloud.sprite.position.x = cloud.baseX + Math.sin(time * cloud.drift + cloud.phase) * 0.6;
      cloud.sprite.position.z = cloud.baseZ + Math.cos(time * cloud.drift * 0.7 + cloud.phase) * 0.4;
      cloud.sprite.position.y += dt * 0.006;
      if (cloud.sprite.position.y > 3.9) cloud.sprite.position.y = 2.3;
    }
    for (const flame of flames) {
      flame.scale.y = 0.85 + Math.sin(time * 9 + flame.position.x * 20) * 0.16;
      flame.position.x += Math.sin(time * 4 + flame.position.x) * 0.0004;
    }
    fireLight.intensity = 18 + Math.sin(time * 7.3) * 2.1 + Math.sin(time * 13.1) * 1.0;
    chandelierLight.intensity = 50 + Math.sin(time * 2.1) * 0.9;
    for (const shaft of shafts) {
      shaft.rotation.y += dt * 0.012;
    }
  }

  return {
    group: root,
    tableGroup,
    tableSpot,
    chandelier,
    chandelierBar,
    fireLight,
    chandelierLight,
    glowTex,
    smoke,
    dust,
    shafts,
    update
  };
}
