// ---------------------------------------------------------------------------
// Everything the spawn menu can produce: props, construction pieces, arcade
// specials, people and ragdolls. Each one builds a low-poly mesh and a matching
// physics body, plus the damage behaviour appropriate to its material.
// ---------------------------------------------------------------------------
import * as THREE from 'three';
import { box, cylinder, mat, clamp } from './core.js';
import { CATALOG_BY_ID } from './config.js';
import { Vehicle, createVehicle } from './vehicles.js';

// ---------------------------------------------------------------------------
// Mesh builders
// ---------------------------------------------------------------------------
function group() {
  return new THREE.Group();
}

function piece(parent, w, h, d, color, x, y, z, opts = {}) {
  const mesh = box(w, h, d, color, opts);
  mesh.position.set(x, y, z);
  parent.add(mesh);
  return mesh;
}

function roundPiece(parent, radius, height, color, x, y, z, opts = {}) {
  const mesh = cylinder(radius, radius, height, color, opts.segments || 12, opts);
  mesh.position.set(x, y, z);
  parent.add(mesh);
  return mesh;
}

const BUILDERS = {
  table(g, item) {
    piece(g, 2, 0.12, 1, item.color, 0, 0.38, 0, { flat: false });
    for (const x of [-0.82, 0.82]) for (const z of [-0.36, 0.36]) piece(g, 0.12, 0.76, 0.12, 0x7a5a3f, x, -0.04, z);
  },
  chair(g, item) {
    piece(g, 0.52, 0.1, 0.52, item.color, 0, -0.04, 0, { flat: false });
    piece(g, 0.52, 0.62, 0.1, item.color, 0, 0.24, -0.22);
    for (const x of [-0.2, 0.2]) for (const z of [-0.2, 0.2]) piece(g, 0.07, 0.42, 0.07, 0x6f5339, x, -0.29, z);
  },
  sofa(g, item) {
    piece(g, 2.4, 0.44, 0.95, item.color, 0, -0.16, 0, { flat: false });
    piece(g, 2.4, 0.55, 0.28, item.color, 0, 0.16, -0.34);
    for (const x of [-0.85, 0, 0.85]) piece(g, 0.72, 0.18, 0.8, 0x59684f, x, 0.06, 0.02);
    for (const x of [-0.72, 0.72]) piece(g, 0.12, 0.2, 0.12, 0x3a322a, x, 0.05, 0.36);
  },
  cabinet(g, item) {
    piece(g, 1.2, 1.9, 0.6, item.color, 0, 0, 0, { flat: false });
    piece(g, 0.04, 1.76, 0.02, 0x5b6165, 0, 0, 0.31);
    for (const y of [-0.4, 0.4]) piece(g, 0.4, 0.03, 0.03, 0xb9b9b4, 0.3, y, 0.32);
  },
  fridge(g, item) {
    piece(g, 0.85, 1.9, 0.78, item.color, 0, 0, 0, { flat: false });
    piece(g, 0.8, 0.03, 0.02, 0x8e9598, 0, 0.32, 0.4);
    piece(g, 0.04, 0.7, 0.05, 0xa8b0b2, 0.36, -0.28, 0.42);
    piece(g, 0.04, 0.5, 0.05, 0xa8b0b2, 0.36, 0.55, 0.42);
  },
  tv(g, item) {
    piece(g, 1.3, 0.8, 0.1, item.color, 0, 0.1, 0);
    piece(g, 1.18, 0.68, 0.02, 0x101b21, 0, 0.1, 0.06);
    piece(g, 0.5, 0.06, 0.3, 0x2b3236, 0, -0.36, 0);
    piece(g, 0.1, 0.3, 0.1, 0x2b3236, 0, -0.26, 0);
  },
  barrel(g, item) {
    roundPiece(g, 0.35, 1.05, item.color, 0, 0, 0, { flat: false });
    for (const y of [-0.28, 0.28]) {
      const ring = cylinder(0.365, 0.365, 0.07, 0x46565c, 12, { flat: false });
      ring.position.y = y;
      g.add(ring);
    }
    roundPiece(g, 0.31, 0.03, 0x83969c, 0, 0.54, 0, { flat: false });
  },
  crate(g, item) {
    piece(g, 1, 1, 1, item.color, 0, 0, 0);
    for (const y of [-0.42, 0.42]) piece(g, 1.04, 0.1, 1.04, 0x8a653f, 0, y, 0);
    piece(g, 0.1, 1.02, 1.04, 0x8a653f, -0.4, 0, 0);
  },
  box(g, item) {
    piece(g, 0.85, 0.7, 0.85, item.color, 0, 0, 0, { flat: false });
    piece(g, 0.86, 0.04, 0.06, 0xc9a778, 0, 0.3, 0);
    piece(g, 0.06, 0.71, 0.86, 0xc9a778, 0, 0, 0);
  },
  bench(g, item) {
    for (let i = 0; i < 3; i++) piece(g, 1.8, 0.09, 0.16, item.color, 0, -0.06, -0.18 + i * 0.18);
    for (let i = 0; i < 2; i++) piece(g, 1.8, 0.09, 0.16, item.color, 0, 0.2 + i * 0.18, -0.3);
    for (const x of [-0.76, 0.76]) {
      piece(g, 0.1, 0.76, 0.5, 0x3e4642, x, -0.05, 0);
    }
  },
  beam(g, item) {
    piece(g, 4, 0.3, 0.3, item.color, 0, 0, 0);
  },
  ibeam(g, item) {
    piece(g, 5, 0.4, 0.4, item.color, 0, 0, 0, { flat: false, metal: 0.7, roughness: 0.45 });
    piece(g, 5, 0.1, 0.62, 0x9aa2a6, 0, 0.2, 0, { flat: false, metal: 0.7, roughness: 0.45 });
  },
  cube(g, item) {
    piece(g, 1.2, 1.2, 1.2, item.color, 0, 0, 0, { flat: false });
    piece(g, 1.22, 0.04, 1.22, 0x8e8f8a, 0, 0.55, 0);
  },
  wall(g, item) {
    piece(g, 4, 3, 0.25, item.color, 0, 0, 0, { flat: false });
    piece(g, 4.02, 0.1, 0.28, 0x9d9e97, 0, 1.4, 0);
  },
  slab(g, item) {
    piece(g, item.size[0], item.size[1], item.size[2], item.color, 0, 0, 0, { flat: false });
    const stripe = item.size[0] * 0.8;
    piece(g, stripe, 0.02, 0.2, 0xd9b55a, 0, item.size[1] / 2 + 0.01, 0);
  },
  span(g, item) {
    piece(g, 10, 0.5, 4, item.color, 0, 0.4, 0, { flat: false });
    piece(g, 10.4, 0.25, 0.2, 0xc7c9c2, 0, 0.75, 1.9);
    piece(g, 10.4, 0.25, 0.2, 0xc7c9c2, 0, 0.75, -1.9);
    for (const x of [-3.6, 3.6]) piece(g, 1.2, 0.7, 1.4, 0x8d918e, x, 0, 0);
  },
  boomBarrel(g, item) {
    roundPiece(g, 0.4, 1.15, item.color, 0, 0, 0, { flat: false });
    for (const y of [-0.45, 0, 0.45]) {
      const band = cylinder(0.412, 0.412, 0.1, 0xe9b44c, 12, { flat: false, emissive: 0x2a1c02 });
      band.position.y = y;
      g.add(band);
    }
    piece(g, 0.5, 0.22, 0.06, 0x2a2a26, 0, 0.1, 0.41);
  },
  fireworks(g, item) {
    piece(g, 1.1, 0.9, 1.1, item.color, 0, 0, 0);
    for (let i = 0; i < 4; i++) {
      const rocket = roundPiece(g, 0.08, 0.5, i % 2 ? 0xe6e0d2 : 0xd1543f, -0.3 + (i % 2) * 0.6, 0.6, i < 2 ? -0.25 : 0.25, { flat: true });
      rocket.rotation.z = 0.2;
    }
    piece(g, 1.12, 0.08, 0.24, 0x8a653f, 0, 0.44, 0.35);
  },
  bouncy(g, item) {
    piece(g, 3.4, 0.24, 3.4, item.color, 0, 0.06, 0, { flat: false });
    piece(g, 3.2, 0.16, 3.2, 0x9fe4e8, 0, 0.2, 0, { flat: false, emissive: 0x1d4a4d });
    for (const x of [-1.3, 0, 1.3]) for (const z of [-1.3, 1.3]) piece(g, 0.16, 0.22, 0.16, 0x3d4a4a, x, -0.16, z);
  },
  gravity(g, item) {
    const core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.55, 1), mat(item.color, { flat: true, emissive: 0x2b1f5c }));
    g.add(core);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0xb9a6ff, transparent: true, opacity: 0.7 });
    for (let i = 0; i < 2; i++) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.85, 0.035, 6, 24), ringMat);
      ring.rotation.x = i ? Math.PI / 2 : 0.5;
      g.add(ring);
    }
    g.userData.spin = core;
  },
  fan(g, item) {
    roundPiece(g, 0.1, 0.9, 0x5c6668, 0, -0.5, 0, { flat: false });
    piece(g, 1.4, 0.14, 0.5, 0x5c6668, 0, 0, 0);
    const blades = new THREE.Group();
    for (let i = 0; i < 4; i++) {
      const blade = piece(blades, 0.9, 0.5, 0.06, 0x9aa6a9, 0.5, 0, 0, { flat: true });
      blade.rotation.z = 0.5;
      const pivot = new THREE.Group();
      pivot.rotation.x = (i * Math.PI) / 2;
      pivot.add(blade);
      blades.add(pivot);
    }
    blades.position.set(0, 0.35, 0.26);
    g.add(blades);
    g.userData.spin = blades;
  },
  ball(g, item) {
    const sphere = new THREE.Mesh(new THREE.IcosahedronGeometry(0.85, 1), mat(item.color, { flat: true, metal: 0.6, roughness: 0.5 }));
    sphere.castShadow = true;
    g.add(sphere);
    for (let i = 0; i < 3; i++) {
      const link = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.06, 5, 10), mat(0x8b9397, { flat: true }));
      link.position.y = 0.95 + i * 0.5;
      link.rotation.x = Math.PI / 2;
      g.add(link);
    }
  },
  pump(g, item) {
    piece(g, 0.7, 1.5, 0.5, 0xe4e0d3, 0, 0, 0, { flat: false });
    piece(g, 0.56, 0.4, 0.02, 0x1f2c33, 0, 0.35, 0.26);
    piece(g, 0.6, 0.12, 0.52, 0xbf5b47, 0, 0.76, 0);
    const hose = box(0.08, 0.7, 0.08, 0x2b3236, { flat: true });
    hose.position.set(0.42, 0.1, 0.16);
    hose.rotation.z = 0.3;
    g.add(hose);
  },
  ramp(g, item) {
    const geometry = wedgeGeometry(6, 2, 6);
    const mesh = new THREE.Mesh(geometry, mat(item.color, { flat: false, metal: 0.4, roughness: 0.6 }));
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    g.add(mesh);
    piece(g, 6.02, 0.06, 0.3, 0xd9b55a, 0, 0.02, -2.6);
  },
};

function wedgeGeometry(width, height, depth) {
  const hw = width / 2;
  const hd = depth / 2;
  const vertices = [
    -hw, -height / 2, -hd,
    hw, -height / 2, -hd,
    hw, -height / 2, hd,
    -hw, -height / 2, hd,
    -hw, height / 2, hd,
    hw, height / 2, hd,
  ];
  const indices = [
    0, 1, 2, 0, 2, 3,
    3, 2, 5, 3, 5, 4,
    0, 3, 4, 0, 4, 1,
    1, 4, 5, 1, 5, 2,
    0, 5, 2, 0, 4, 5,
  ];
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.userData.hull = new Float32Array(vertices);
  return geometry;
}

export function buildVisual(item) {
  if (!item) return group();
  if (item.cat === 'vehicles') {
    const fake = {
      addWheelVisuals: Vehicle.prototype.addWheelVisuals,
      collectWheelGroups: Vehicle.prototype.collectWheelGroups,
      spawnWheels: Vehicle.prototype.spawnWheels,
      size: item.size,
    };
    return Vehicle.prototype.buildMesh.call(fake, item.vehicle || item.id, item);
  }
  if (item.build === 'ragdoll') {
    const g = group();
    const c = item.color;
    piece(g, 0.44, 0.62, 0.26, c, 0, 0.2, 0, { flat: true });
    piece(g, 0.26, 0.26, 0.26, 0xd9b38f, 0, 0.65, 0, { flat: true });
    piece(g, 0.12, 0.46, 0.12, c, -0.3, 0.18, 0, { flat: true });
    piece(g, 0.12, 0.46, 0.12, c, 0.3, 0.18, 0, { flat: true });
    piece(g, 0.16, 0.5, 0.16, 0x3e4a52, -0.12, -0.32, 0, { flat: true });
    piece(g, 0.16, 0.5, 0.16, 0x3e4a52, 0.12, -0.32, 0, { flat: true });
    return g;
  }
  if (item.build === 'pedestrian') {
    const g = group();
    const c = item.color;
    piece(g, 0.44, 0.62, 0.26, c, 0, 0.2, 0, { flat: true });
    piece(g, 0.26, 0.26, 0.26, 0xd9b38f, 0, 0.65, 0, { flat: true });
    piece(g, 0.12, 0.46, 0.12, c, -0.3, 0.18, 0, { flat: true });
    piece(g, 0.12, 0.46, 0.12, c, 0.3, 0.18, 0, { flat: true });
    piece(g, 0.16, 0.5, 0.16, 0x3e4a52, -0.12, -0.32, 0, { flat: true });
    piece(g, 0.16, 0.5, 0.16, 0x3e4a52, 0.12, -0.32, 0, { flat: true });
    return g;
  }
  const builder = BUILDERS[item.build];
  const g = group();
  if (builder) builder(g, item);
  else piece(g, item.size[0], item.size[1], item.size[2], item.color || 0x999999, 0, 0, 0);
  return g;
}

// ---------------------------------------------------------------------------
// Damage behaviour for props
// ---------------------------------------------------------------------------
function materialFor(item) {
  if (item.material === 'metal' || item.build === 'ibeam') return 'metal';
  if (item.material === 'concrete') return 'concrete';
  if (['barrel', 'fridge', 'tv', 'cabinet', 'pump', 'boomBarrel', 'ball', 'fan', 'gravity'].includes(item.build)) return 'metal';
  return 'wood';
}

function hpFor(item) {
  const material = materialFor(item);
  if (material === 'concrete') return 260 + item.mass * 0.5;
  if (material === 'metal') return 180 + item.mass * 0.4;
  return 60 + item.mass * 1.2;
}

function shatter(game, entity, point, extraPower = 0) {
  if (!entity || entity.dead) return;
  const size = entity.size;
  const color = entity.data.color ?? 0x9a9a94;
  const count = clamp(Math.round(entity.mass / 22), 3, 12);
  for (let i = 0; i < count; i++) {
    const w = Math.max(0.14, size[0] * (0.18 + Math.random() * 0.3));
    const h = Math.max(0.12, size[1] * (0.16 + Math.random() * 0.32));
    const d = Math.max(0.14, size[2] * (0.18 + Math.random() * 0.3));
    game.fx.debris(
      new THREE.Vector3(
        point.x + (Math.random() - 0.5) * size[0],
        Math.max(point.y, 0.4) + (Math.random() - 0.5) * size[1],
        point.z + (Math.random() - 0.5) * size[2]
      ),
      new THREE.Vector3((Math.random() - 0.5) * 8, 1.4 + Math.random() * 5 + extraPower, (Math.random() - 0.5) * 8),
      Math.max(0.18, Math.min(0.9, (w + h + d) / 3)),
      color, 5.5, { w, h, d }
    );
  }
  game.fx.dust(new THREE.Vector3(point.x, Math.max(0.5, point.y), point.z), 6, 1.2);
  game.audio?.impact(point, 0.7, materialFor(entity.data.item || {}));
  game.physics.remove(entity, { silent: true });
}

// ---------------------------------------------------------------------------
// Spawning
// ---------------------------------------------------------------------------
export function spawnItem(game, id, position, opts = {}) {
  const item = id === 'pump' ? PUMP : CATALOG_BY_ID.get(id);
  if (!item) return null;

  if (item.cat === 'vehicles') {
    const heading = opts.heading ?? opts.rotationY ?? 0;
    const vehicle = createVehicle(game, item.vehicle || item.id, position, heading);
    return vehicle.entity;
  }

  if (item.build === 'ragdoll') return createRagdoll(game, item, position);
  if (item.build === 'pedestrian') return game.npc?.spawn(position) || null;

  const mesh = buildVisual(item);
  mesh.scale.setScalar(opts.scale || 1);
  const size = item.size;
  const shape = item.build === 'ball' || item.build === 'gravity' ? 'ball' : 'box';
  const physicsSize = item.build === 'ball' ? [0.85, 0.85, 0.85] : size;
  const heading = opts.heading ?? opts.rotationY ?? 0;
  const quat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), heading);
  // a ramp is a wedge: its hull collider is built from the visual geometry
  let hull = null;
  if (item.build === 'ramp') {
    mesh.traverse((child) => {
      if (child.isMesh && child.geometry?.userData?.hull) hull = child.geometry.userData.hull;
    });
  }

  const mass = item.mass;
  const entity = game.physics.create({
    mesh, shape, size: physicsSize, mass, position: [position.x, position.y, position.z],
    rotation: quat, kind: 'prop', name: item.name, friction: 0.72,
    restitution: item.build === 'bouncy' ? 0.9 : 0.12, damageable: true,
    hp: hpFor(item), hull,
    collisionGroups: item.build === 'bouncy' ? undefined : undefined,
    data: { item, color: item.color, bouncy: item.build === 'bouncy' },
  });
  entity.item = item;
  entity.material = materialFor(item);

  // every prop dents and then shatters
  entity.onDamage = (amount, point, normal) => {
    if (entity.dead) return;
    entity.hp -= amount;
    if (item.build === 'boomBarrel' || item.build === 'pump') {
      if (amount > 14 || entity.hp <= 0) {
        const p = point || entity.body.translation();
        game.fx.explosion(new THREE.Vector3(p.x, p.y, p.z), item.build === 'pump' ? 0.9 : 1.15, entity);
        game.audio?.explosion(p, 0.9);
        game.physics.remove(entity, { silent: true });
        return;
      }
    }
    if (item.build === 'fireworks' && (amount > 16 || entity.hp <= 0)) {
      const p = point || entity.body.translation();
      game.fx.fireworkShow(new THREE.Vector3(p.x, p.y + 1, p.z), 9);
      game.audio?.explosion(p, 0.55);
      game.physics.remove(entity, { silent: true });
      return;
    }
    if (amount > 4) {
      game.fx.spark(new THREE.Vector3(point.x, point.y, point.z), normal || new THREE.Vector3(0, 1, 0), Math.min(12, Math.round(amount / 6)), item.color);
      game.audio?.impact(point, clamp(amount / 70, 0.12, 1), entity.material);
      entity.mesh.rotation.z += (Math.random() - 0.5) * 0.02;
    }
    if (entity.hp <= 0) shatter(game, entity, point || entity.body.translation());
  };
  entity.onBreak = (point) => shatter(game, entity, point || entity.body.translation());

  if (item.build === 'gravity') {
    game.specials.push({ entity, kind: 'gravity', update: (dt) => gravityWell(game, entity, dt) });
  } else if (item.build === 'fan') {
    game.specials.push({ entity, kind: 'fan', update: (dt) => fanPush(game, entity, dt) });
  } else if (item.build === 'ball') {
    attachRope(game, entity);
  } else if (item.build === 'bouncy') {
    entity.data.bouncy = true;
  }

  game.audio?.pop(position, 0.35);
  return entity;
}

const PUMP = {
  id: 'pump', name: 'Fuel pump', desc: 'A city fuel pump. Not fond of impacts.', build: 'pump',
  color: 0xe4e0d3, mass: 120, size: [0.7, 1.5, 0.5], material: 'metal', cat: 'objects',
};

// ---------------------------------------------------------------------------
// Special behaviours
// ---------------------------------------------------------------------------
function gravityWell(game, entity, dt) {
  if (entity.dead) return;
  const t = entity.body.translation();
  const radius = 13;
  const strength = 1500;
  let touched = 0;
  for (const other of game.physics.entities) {
    if (other === entity || other.dead || other.frozen) continue;
    if (other.kind === 'building' || other.kind === 'world' || other.kind === 'scenery') continue;
    if (touched > 40) break;
    const o = other.body.translation();
    const dx = t.x - o.x;
    const dy = t.y - o.y;
    const dz = t.z - o.z;
    const distance = Math.hypot(dx, dy, dz);
    if (distance > radius || distance < 0.2) continue;
    touched++;
    const pull = (strength * other.mass * 0.02) / Math.max(1, distance * distance);
    other.body.applyImpulse({ x: (dx / distance) * pull * dt, y: (dy / distance) * pull * dt, z: (dz / distance) * pull * dt }, true);
    other.body.wakeUp();
  }
}

function fanPush(game, entity, dt) {
  if (entity.dead) return;
  const t = entity.body.translation();
  const r = entity.body.rotation();
  const q = new THREE.Quaternion(r.x, r.y, r.z, r.w);
  const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(q);
  const origin = new THREE.Vector3(t.x, t.y, t.z);
  for (const other of game.physics.entities) {
    if (other === entity || other.dead || other.frozen || other.kind === 'building') continue;
    const o = other.body.translation();
    const dx = o.x - origin.x;
    const dy = o.y - origin.y;
    const dz = o.z - origin.z;
    const distance = Math.hypot(dx, dy, dz);
    if (distance > 14 || distance < 0.3) continue;
    const dot = (dx * forward.x + dz * forward.z) / distance;
    if (dot < 0.55) continue;
    const push = 900 * dt * (1 - distance / 14);
    other.body.applyImpulse({ x: forward.x * push, y: push * 0.12, z: forward.z * push }, true);
    other.body.wakeUp();
  }
}

function attachRope(game, entity) {
  const t = entity.body.translation();
  const anchor = game.physics.create({
    mesh: null, shape: 'ball', size: [0.14, 0.14, 0.14], mass: 1,
    position: [t.x, t.y + 7.5, t.z], fixed: true, kind: 'anchor', name: 'Crane hook', friction: 0.5,
  });
  game.physics.rope(entity, anchor, 7, { x: t.x, y: t.y + 0.95, z: t.z }, { x: t.x, y: t.y + 7.5, z: t.z });
  const hook = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.9, 0.5), mat(0x3d4448, { flat: true }));
  hook.position.set(t.x, t.y + 7.5, t.z);
  game.scene.add(hook);
  anchor.mesh = hook;
  game.fx.rope(entity, anchor);
}

// ---------------------------------------------------------------------------
// Ragdolls: torso, head, two arms, two legs, jointed and floppy.
// ---------------------------------------------------------------------------
export function createRagdoll(game, item, position) {
  const color = item.color;
  const skin = 0xd9b38f;
  const pants = 0x39434c;
  const parts = [];
  const make = (name, size, offset, partColor, shape = 'box') => {
    const mesh = group();
    piece(mesh, size[0], size[1], size[2], partColor, 0, 0, 0, { flat: true });
    const entity = game.physics.create({
      mesh, shape, size, mass: item.mass / 6,
      position: [position.x + offset[0], position.y + offset[1], position.z + offset[2]],
      kind: 'ragdoll', name: 'Ragdoll', friction: 0.6, restitution: 0.05,
      damageable: false, linearDamping: 0.2, angularDamping: 0.35,
      collisionGroups: 0x0010ffef,
    });
    entity.data.ragdoll = true;
    parts.push({ entity, name, offset, size });
    return entity;
  };

  const torso = make('torso', [0.44, 0.62, 0.26], [0, 1.15, 0], color);
  const head = make('head', [0.26, 0.26, 0.26], [0, 1.62, 0], skin, 'ball');
  const armL = make('armL', [0.12, 0.46, 0.12], [-0.3, 1.16, 0], color);
  const armR = make('armR', [0.12, 0.46, 0.12], [0.3, 1.16, 0], color);
  const legL = make('legL', [0.16, 0.55, 0.16], [-0.12, 0.6, 0], pants);
  const legR = make('legR', [0.16, 0.55, 0.16], [0.12, 0.6, 0], pants);

  const jointAt = (a, b, p) => game.physics.spherical(a, b, p);
  jointAt(torso, head, { x: position.x, y: position.y + 1.45, z: position.z });
  jointAt(torso, armL, { x: position.x - 0.28, y: position.y + 1.38, z: position.z });
  jointAt(torso, armR, { x: position.x + 0.28, y: position.y + 1.38, z: position.z });
  jointAt(torso, legL, { x: position.x - 0.12, y: position.y + 0.86, z: position.z });
  jointAt(torso, legR, { x: position.x + 0.12, y: position.y + 0.86, z: position.z });

  const ragdoll = { parts: parts.map((p) => p.entity), torso, item };
  game.ragdolls.push(ragdoll);
  while (game.ragdolls.length > 6) {
    const old = game.ragdolls.shift();
    // the torso owns the joints, so removing it releases the limbs
    game.physics.remove(old.torso, { silent: true });
    for (const part of old.parts) if (part !== old.torso) game.physics.remove(part, { silent: true });
  }
  return torso;
}

export { materialFor, shatter };
