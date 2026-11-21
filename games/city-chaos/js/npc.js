// ---------------------------------------------------------------------------
// Pedestrians: capsule bodies with locked rotation, a wander target, vehicle
// avoidance and a short stumble state when something hits them.
// ---------------------------------------------------------------------------
import * as THREE from 'three';
import { box, mat, clamp } from './core.js';

const PALETTE = [0x5f8fa6, 0xa6645f, 0x6f8a4f, 0xb08a5c, 0x7b6a9a, 0x9a8f7a, 0x4f7f74];
const SKIN = [0xd9b38f, 0xb98a63, 0x8a6446, 0xe0c2a2];

function buildBody(color, skin) {
  const group = new THREE.Group();
  const torso = box(0.44, 0.62, 0.26, color, { flat: true });
  torso.position.y = 0.2;
  group.add(torso);
  const head = box(0.26, 0.26, 0.26, skin, { flat: true });
  head.position.y = 0.67;
  group.add(head);
  const limbMat = mat(color, { flat: true });
  const pantsMat = mat(0x39434c, { flat: true });
  const arms = [];
  const legs = [];
  for (const side of [-1, 1]) {
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.46, 0.12), limbMat);
    arm.position.set(side * 0.3, 0.32, 0);
    arm.castShadow = true;
    group.add(arm);
    arms.push(arm);
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.5, 0.16), pantsMat);
    leg.position.set(side * 0.12, -0.28, 0);
    leg.castShadow = true;
    group.add(leg);
    legs.push(leg);
  }
  return { group, arms, legs };
}

export class NPCManager {
  constructor(game) {
    this.game = game;
    this.list = [];
    this.max = 18;
    this.time = 0;
  }

  build(count) {
    this.removeAll();
    this.max = count ?? this.max;
    const positions = this.pickSpawns(this.max);
    for (const position of positions) this.spawn(position);
  }

  pickSpawns(count) {
    const spawned = [];
    const PITCH = 74;
    for (let attempt = 0; attempt < count * 6 && spawned.length < count; attempt++) {
      const i = Math.floor(Math.random() * 5) - 2;
      const j = Math.floor(Math.random() * 5) - 2;
      const cx = i * PITCH;
      const cz = j * PITCH;
      const half = 25;
      const side = Math.floor(Math.random() * 4);
      let x = cx;
      let z = cz;
      if (side === 0) { x = cx - half; z = cz + (Math.random() - 0.5) * half * 2; }
      else if (side === 1) { x = cx + half; z = cz + (Math.random() - 0.5) * half * 2; }
      else if (side === 2) { x = cx + (Math.random() - 0.5) * half * 2; z = cz - half; }
      else { x = cx + (Math.random() - 0.5) * half * 2; z = cz + half; }
      const position = new THREE.Vector3(x, 1.05, z);
      spawned.push(position);
    }
    return spawned;
  }

  spawn(position) {
    const color = PALETTE[Math.floor(Math.random() * PALETTE.length)];
    const skin = SKIN[Math.floor(Math.random() * SKIN.length)];
    const { group, arms, legs } = buildBody(color, skin);
    const entity = this.game.physics.create({
      mesh: group, shape: 'capsule', size: [0.3, 1.7, 0.3],
      position: [position.x, position.y, position.z], kind: 'npc',
      name: 'Pedestrian', mass: 76, friction: 0.1, restitution: 0.02,
      linearDamping: 0.3, angularDamping: 0.9, damageable: false,
      visualOffset: [0, -0.34, 0],
    });
    entity.body.lockRotations(true, true);

    const npc = {
      entity, group, arms, legs, color,
      target: new THREE.Vector3(position.x, position.y, position.z),
      home: new THREE.Vector3(position.x, 1.05, position.z),
      wait: Math.random() * 2,
      fleeUntil: 0,
      limp: 0,
      stuck: 0,
      phase: Math.random() * 10,
      speed: 1.5 + Math.random() * 0.9,
    };
    this.list.push(npc);
    return entity;
  }

  removeAll() {
    for (const npc of this.list) {
      if (!npc.entity.dead) this.game.physics.remove(npc.entity, { silent: true });
    }
    this.list.length = 0;
  }

  alert(position, radius = 18) {
    for (const npc of this.list) {
      if (npc.entity.dead) continue;
      const t = npc.entity.body.translation();
      if (Math.hypot(t.x - position.x, t.z - position.z) < radius) {
        npc.fleeUntil = this.time + 2.6 + Math.random() * 2;
      }
    }
  }

  update(dt) {
    this.time += dt;
    const physics = this.game.physics;

    for (let index = this.list.length - 1; index >= 0; index--) {
      const npc = this.list[index];
      const entity = npc.entity;
      if (entity.dead) {
        this.list.splice(index, 1);
        continue;
      }
      const t = entity.body.translation();
      const vel = entity.body.linvel();

      // a hard knock sends them sprawling for a moment
      const speed = Math.hypot(vel.x, vel.y, vel.z);
      if (speed > 5.5 && npc.limp <= 0) {
        npc.limp = 2.4;
        entity.body.lockRotations(false, true);
        entity.body.applyTorqueImpulse({
          x: (Math.random() - 0.5) * 40, y: (Math.random() - 0.5) * 30, z: (Math.random() - 0.5) * 40,
        }, true);
        this.game.audio?.impact(t, 0.35, 'wood');
      }

      if (npc.limp > 0) {
        npc.limp -= dt;
        if (npc.limp <= 0) {
          entity.body.setRotation({ x: 0, y: 0, z: 0, w: 1 }, true);
          entity.body.lockRotations(true, true);
          entity.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
          entity.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
        }
        npc.group.position.set(t.x, t.y - 0.34, t.z);
        npc.group.quaternion.set(entity.body.rotation().x, entity.body.rotation().y, entity.body.rotation().z, entity.body.rotation().w);
        continue;
      }

      // pick a fresh wander target when one is reached or the walker is stuck
      const dx = npc.target.x - t.x;
      const dz = npc.target.z - t.z;
      const distance = Math.hypot(dx, dz);
      if (distance < 1.4 || npc.wait > 0) {
        npc.wait -= dt;
        if (npc.wait <= 0) {
          const angle = Math.random() * Math.PI * 2;
          const radius = 8 + Math.random() * 20;
          npc.target.set(npc.home.x + Math.cos(angle) * radius, t.y, npc.home.z + Math.sin(angle) * radius);
          npc.wait = 0;
        }
      }
      if (Math.abs(speed) < 0.25) npc.stuck += dt;
      else npc.stuck = 0;
      if (npc.stuck > 1.6) {
        npc.stuck = 0;
        npc.target.set(npc.home.x + (Math.random() - 0.5) * 18, t.y, npc.home.z + (Math.random() - 0.5) * 18);
      }

      const fleeing = this.time < npc.fleeUntil;
      let dirX = distance > 0.1 ? dx / distance : 0;
      let dirZ = distance > 0.1 ? dz / distance : 0;
      let speedTarget = fleeing ? 4.1 : npc.speed;

      // step around traffic: look ahead, then sideways
      const lookAhead = physics.raycast(
        new THREE.Vector3(t.x, t.y, t.z),
        new THREE.Vector3(dirX, 0, dirZ),
        3.4, null
      );
      if (lookAhead && lookAhead.entity?.kind === 'vehicle') {
        const side = Math.random() > 0.5 ? 1 : -1;
        dirX = -dirZ * side;
        dirZ = dirX * side;
        speedTarget = 3.6;
      } else {
        for (const vehicle of this.game.vehicles) {
          if (vehicle.dead || Math.abs(vehicle.speed) < 3) continue;
          const vt = vehicle.entity.body.translation();
          const vdx = vt.x - t.x;
          const vdz = vt.z - t.z;
          const d = Math.hypot(vdx, vdz);
          if (d < 9) {
            dirX -= (vdx / Math.max(0.6, d)) * 1.6;
            dirZ -= (vdz / Math.max(0.6, d)) * 1.6;
            speedTarget = 3.9;
          }
        }
        const length = Math.hypot(dirX, dirZ) || 1;
        dirX /= length;
        dirZ /= length;
      }

      entity.body.setLinvel({ x: dirX * speedTarget, y: vel.y, z: dirZ * speedTarget }, true);
      entity.body.wakeUp();

      // face the direction of travel and swing the limbs
      npc.phase += dt * (speedTarget * 2.2);
      const swing = Math.sin(npc.phase) * (speedTarget > 2 ? 0.7 : 0.4);
      npc.legs[0].rotation.x = swing;
      npc.legs[1].rotation.x = -swing;
      npc.arms[0].rotation.x = -swing * 0.8;
      npc.arms[1].rotation.x = swing * 0.8;
      npc.group.position.set(t.x, t.y - 0.34, t.z);
      npc.group.rotation.y = Math.atan2(dirX, dirZ);

      // keep walkers wandering around their own block, not across the whole map
      if (Math.hypot(t.x - npc.home.x, t.z - npc.home.z) > 46) {
        npc.target.set(npc.home.x, t.y, npc.home.z);
        npc.wait = 0;
      }
    }
  }
}
