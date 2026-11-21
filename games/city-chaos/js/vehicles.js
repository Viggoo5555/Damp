// ---------------------------------------------------------------------------
// Vehicles: chassis = one dynamic Rapier body, wheels = four raycasts with
// spring/damper suspension, engine force at the contacts, lateral grip on the
// ground. Planes and helicopters swap the same body for lift and control
// surfaces so they still collide with everything.
// ---------------------------------------------------------------------------
import * as THREE from 'three';
import { box, cylinder, mat, clamp, lerp, damp } from './core.js';
import { CATALOG_BY_ID } from './config.js';

const UP = new THREE.Vector3(0, 1, 0);
const tmpV = new THREE.Vector3();
const tmpV2 = new THREE.Vector3();
const tmpWheel = new THREE.Vector3();
const tmpQ = new THREE.Quaternion();
const tmpQ2 = new THREE.Quaternion();

function panel(group, w, h, d, color, x, y, z, opts = {}) {
  const mesh = box(w, h, d, color, { flat: false, ...opts });
  mesh.position.set(x, y, z);
  group.add(mesh);
  return mesh;
}

function wheelMesh(radius, width, dark = 0x1c2022) {
  const pivot = new THREE.Group();
  pivot.rotation.order = 'YXZ';
  const tyre = cylinder(radius, radius, width, dark, 14, { flat: false });
  tyre.rotation.z = Math.PI / 2;
  tyre.castShadow = true;
  pivot.add(tyre);
  const rim = cylinder(radius * 0.55, radius * 0.55, width * 1.02, 0x9aa3a5, 8, { flat: false });
  rim.rotation.z = Math.PI / 2;
  pivot.add(rim);
  return pivot;
}

function addHeadlights(group, w, y, z, color = 0xfff0c4) {
  const headMat = new THREE.MeshBasicMaterial({ color });
  for (const side of [-1, 1]) {
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.16, 0.06), headMat);
    lamp.position.set(side * w, y, z);
    group.add(lamp);
  }
  return headMat;
}

function addTailLights(group, w, y, z) {
  const tailMat = new THREE.MeshBasicMaterial({ color: 0xd94a3a });
  for (const side of [-1, 1]) {
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.14, 0.06), tailMat);
    lamp.position.set(side * w, y, z);
    group.add(lamp);
  }
  return tailMat;
}

export class Vehicle {
  constructor(game, type, position, heading = 0) {
    this.game = game;
    this.type = type;
    const spec = CATALOG_BY_ID.get(type) || CATALOG_BY_ID.get(type === 'heli' ? 'heli' : 'sedan');
    this.spec = spec;
    this.mode = type === 'plane' ? 'plane' : type === 'heli' ? 'heli' : type === 'trailer' ? 'trailer' : 'car';
    this.input = { throttle: 0, steer: 0, brake: false, handbrake: false, pitch: 0 };
    this.speed = 0;
    this.steerAngle = 0;
    this.hp = 1200;
    this.maxHp = 1200;
    this.damage = 0;
    this.dead = false;
    this.occupied = false;
    this.headlightOn = false;

    const size = spec.size;
    this.size = size;
    this.mesh = this.buildMesh(type, spec);
    this.mesh.rotation.y = heading;
    game.scene.add(this.mesh);

    const q = new THREE.Quaternion().setFromAxisAngle(UP, heading);
    const entity = game.physics.create({
      mesh: this.mesh, shape: 'box', size: [size[0], size[1], size[2]],
      position: [position.x, position.y, position.z],
      rotation: q, kind: 'vehicle', name: spec.name, mass: spec.mass,
      friction: 0.55, restitution: 0.15, ccd: true, damageable: true,
      hp: 1200, linearDamping: 0.04, angularDamping: 0.28,
    });
    this.entity = entity;
    entity.vehicle = this;
    entity.onDamage = (amount, point) => this.takeDamage(amount, point);
    entity.onBreak = (point) => this.explode(point);

    // Wheel layout in metres, relative to the chassis centre.
    this.wheelRadius = Math.min(0.44, Math.max(0.3, size[1] * 0.42));
    const halfLength = size[2] / 2;
    const halfWidth = size[0] / 2;
    this.wheels = [];
    const axleZ = this.mode === 'car' ? halfLength * 0.62 : halfLength * 0.5;
    const axleX = halfWidth * 0.86;
    const wheelPositions = this.mode === 'car'
      ? [[-axleX, -size[1] * 0.34, axleZ], [axleX, -size[1] * 0.34, axleZ], [-axleX, -size[1] * 0.34, -axleZ], [axleX, -size[1] * 0.34, -axleZ]]
      : this.mode === 'plane'
        ? [[-axleX * 0.7, -size[1] * 0.45, axleZ * 0.6], [axleX * 0.7, -size[1] * 0.45, axleZ * 0.6], [0, -size[1] * 0.45, -axleZ * 0.95]]
        : [];
    for (const [x, y, z] of wheelPositions) {
      this.wheels.push({ local: new THREE.Vector3(x, y, z), contact: false, spin: 0, steer: 0, compression: 0 });
    }

    this.wheelMeshes = this.mesh.userData.wheels || [];
    this.rotor = this.mesh.userData.rotor || null;
    this.bodyMesh = this.mesh.userData.body || null;
    this.lightTarget = 0;

    // The visual wheels are redrawn onto the exact physics wheel positions and
    // radius, so a car never looks like it is hovering above its own tyres.
    for (let i = 0; i < Math.min(this.wheelMeshes.length, this.wheels.length); i++) {
      const pivot = this.wheelMeshes[i];
      pivot.position.copy(this.wheels[i].local);
      const designed = pivot.userData.wheelRadius || this.wheelRadius;
      pivot.scale.setScalar(this.wheelRadius / designed);
    }
  }

  // -------------------------------------------------------------------------
  // Meshes
  // -------------------------------------------------------------------------
  buildMesh(type, spec) {
    const group = new THREE.Group();
    const color = spec.color;
    const wheels = [];
    let body = null;
    let rotor = null;

    if (type === 'sedan' || type === 'coupe') {
      const h = type === 'coupe' ? 0.52 : 0.6;
      body = panel(group, 1.9, h, 4.3, color, 0, 0.02, 0);
      const cabin = panel(group, 1.55, 0.52, 1.9, color, 0, h * 0.6 + 0.26, -0.2);
      panel(group, 1.56, 0.36, 1.72, 0x2a3d47, 0, h * 0.6 + 0.24, -0.2, { flat: true });
      if (type === 'coupe') {
        cabin.scale.z = 1.3;
        cabin.position.y += 0.04;
        panel(group, 1.9, 0.12, 0.5, 0x2b3236, 0, h * 0.6 + 0.52, -1.5, { flat: true });
      }
      addHeadlights(group, 0.62, 0.12, 2.16);
      addTailLights(group, 0.62, 0.16, -2.16);
      this.addWheelVisuals(group, wheels, 0.34, 0.26, 1.55, 0.9);
    } else if (type === 'van') {
      body = panel(group, 2.05, 1.15, 5.1, color, 0, 0.22, 0);
      panel(group, 2.06, 0.85, 2.6, color, 0, 1.16, -0.9);
      panel(group, 2.06, 0.42, 1.6, 0x2a3d47, 0, 0.95, 1.55, { flat: true });
      panel(group, 2.07, 0.3, 4.6, 0x7d8a8e, 0, 0.95, -0.2, { flat: true });
      addHeadlights(group, 0.72, 0.2, 2.56);
      addTailLights(group, 0.72, 0.34, -2.56);
      this.addWheelVisuals(group, wheels, 0.38, 0.28, 1.75, 1.0);
    } else if (type === 'pickup') {
      body = panel(group, 2.15, 0.75, 5.4, color, 0, 0.16, 0);
      panel(group, 2.0, 0.85, 1.9, color, 0, 0.9, 0.75);
      panel(group, 1.9, 0.4, 1.5, 0x2a3d47, 0, 0.95, 0.9, { flat: true });
      panel(group, 2.1, 0.5, 2.3, 0x8b9497, 0, 0.62, -1.6, { flat: true });
      addHeadlights(group, 0.78, 0.22, 2.68);
      addTailLights(group, 0.78, 0.26, -2.68);
      this.addWheelVisuals(group, wheels, 0.42, 0.3, 1.85, 1.02);
    } else if (type === 'truck') {
      body = panel(group, 2.4, 1.3, 7.0, color, 0, 0.35, 0);
      panel(group, 2.35, 1.6, 2.4, color, 0, 1.2, 2.2);
      panel(group, 2.2, 0.7, 3.9, 0xd9d5ca, 0, 1.55, -1.3);
      panel(group, 2.1, 0.48, 0.2, 0x2a3d47, 0, 1.35, 3.42, { flat: true });
      addHeadlights(group, 0.86, 0.3, 3.52);
      addTailLights(group, 0.86, 0.4, -3.52);
      this.addWheelVisuals(group, wheels, 0.46, 0.32, 2.3, 1.12);
    } else if (type === 'bus') {
      body = panel(group, 2.5, 2.4, 10.6, color, 0, 0.55, 0);
      panel(group, 2.52, 0.9, 10.2, 0x2f4a55, 0, 1.35, 0, { flat: true });
      panel(group, 2.4, 0.9, 0.16, 0x24333a, 0, 1.1, 5.32, { flat: true });
      panel(group, 2.52, 0.24, 10.5, 0xd9d5c6, 0, 2.32, 0, { flat: true });
      addHeadlights(group, 0.92, 0.4, 5.34);
      addTailLights(group, 0.92, 0.5, -5.34);
      this.addWheelVisuals(group, wheels, 0.5, 0.36, 3.5, 1.15);
    } else if (type === 'plane') {
      body = panel(group, 1.15, 1.05, 7.4, color, 0, 0.1, 0);
      const nose = cylinder(0.5, 0.66, 1.5, color, 10, { flat: false });
      nose.rotation.x = Math.PI / 2;
      nose.position.set(0, 0.1, 3.9);
      group.add(nose);
      panel(group, 9.8, 0.16, 1.5, color, 0, 0.25, 0.3);
      panel(group, 3.4, 0.12, 0.85, color, 0, 0.3, -3.1);
      panel(group, 0.12, 1.15, 1.1, color, 0, 0.85, -3.2);
      panel(group, 1.5, 0.36, 1.2, 0x2a3d47, 0, 0.62, 1.5, { flat: true });
      addHeadlights(group, 0.4, 0.1, 4.6, 0xfff6d6);
      // propeller
      rotor = new THREE.Group();
      const blade = box(0.14, 2.6, 0.1, 0x2c3336, { flat: true });
      rotor.add(blade);
      const blade2 = box(2.6, 0.14, 0.1, 0x2c3336, { flat: true });
      rotor.add(blade2);
      rotor.position.set(0, 0.1, 4.75);
      group.add(rotor);
      this.addWheelVisuals(group, wheels, 0.3, 0.22, 2.4, 0.86, [[-0.85, -0.52, 1.9], [0.85, -0.52, 1.9], [0, -0.55, -2.6]]);
    } else if (type === 'heli') {
      body = panel(group, 2.0, 1.5, 3.4, color, 0, 0.2, 0);
      const nose = new THREE.Mesh(new THREE.SphereGeometry(1.0, 10, 8), mat(0x2f4a44, { flat: false }));
      nose.scale.set(1.0, 0.75, 1.3);
      nose.position.set(0, 0.2, 1.7);
      nose.castShadow = true;
      group.add(nose);
      panel(group, 0.42, 0.42, 3.4, color, 0, 0.4, -3.0);
      panel(group, 0.16, 1.2, 0.7, color, 0, 0.9, -4.4);
      panel(group, 1.9, 0.4, 1.2, 0x2a3d47, 0, 0.6, 1.15, { flat: true });
      const mast = cylinder(0.12, 0.12, 0.7, 0x4a5357, 6, { flat: false });
      mast.position.set(0, 1.1, 0);
      group.add(mast);
      rotor = new THREE.Group();
      for (let i = 0; i < 2; i++) {
        const blade = box(7.4, 0.08, 0.34, 0x30383b, { flat: true });
        blade.rotation.y = i * Math.PI / 2;
        rotor.add(blade);
      }
      rotor.position.set(0, 1.5, 0);
      group.add(rotor);
      for (const side of [-1, 1]) {
        const skid = box(0.16, 0.16, 2.6, 0x596366, { flat: false });
        skid.position.set(side * 0.95, -0.85, 0.2);
        group.add(skid);
      }
    } else if (type === 'trailer') {
      body = panel(group, 2.2, 1.8, 5.8, color, 0, 0.75, 0);
      panel(group, 2.24, 0.4, 5.6, 0x8b9497, 0, -0.02, 0, { flat: true });
      const hitch = box(0.16, 0.16, 1.1, 0x6f777a, { flat: false });
      hitch.position.set(0, -0.6, 3.35);
      group.add(hitch);
      this.addWheelVisuals(group, wheels, 0.42, 0.3, 1.9, 1.0, [[-1.0, -0.62, 0.2], [1.0, -0.62, 0.2], [-1.0, -0.62, -1.5], [1.0, -0.62, -1.5]]);
      addTailLights(group, 0.88, 0.28, -2.94);
    }

    this.spawnWheels(group, wheels, type, spec);
    group.userData.body = body;
    group.userData.wheels = this.collectWheelGroups(group);
    group.userData.rotor = rotor;
    return group;
  }

  addWheelVisuals(group, wheels, radius, width, frontZ, rearZ, layout = null) {
    const positions = layout || [
      [-0.82, -radius * 0.4, frontZ], [0.82, -radius * 0.4, frontZ],
      [-0.82, -radius * 0.4, -rearZ], [0.82, -radius * 0.4, -rearZ],
    ];
    for (const [x, y, z] of positions) {
      const pivot = wheelMesh(radius, width);
      pivot.position.set(x, y, z);
      pivot.userData.wheelRadius = radius;
      group.add(pivot);
      wheels.push(pivot);
    }
  }

  collectWheelGroups(group) {
    const found = [];
    group.traverse((child) => {
      if (child.userData.wheelRadius) found.push(child);
    });
    return found;
  }

  spawnWheels(group, wheels, type, spec) {
    // wheel pivots already added by addWheelVisuals
    this.wheelGroups = wheels;
  }

  // -------------------------------------------------------------------------
  // Driving
  // -------------------------------------------------------------------------
  setInput(input) {
    this.input.throttle = clamp(input.throttle ?? 0, -1, 1);
    this.input.steer = clamp(input.steer ?? 0, -1, 1);
    this.input.brake = !!input.brake;
    this.input.handbrake = !!input.handbrake;
    this.input.pitch = clamp(input.pitch ?? 0, -1, 1);
  }

  update(dt) {
    if (this.dead) return;
    const body = this.entity.body;
    const t = body.translation();
    const r = body.rotation();
    tmpQ.set(r.x, r.y, r.z, r.w);
    const forward = tmpV.set(0, 0, 1).applyQuaternion(tmpQ);
    const right = tmpV2.set(1, 0, 0).applyQuaternion(tmpQ);
    const vel = body.linvel();
    const speed = Math.hypot(vel.x, vel.z);
    this.speed = forward.x * vel.x + forward.z * vel.z;

    if (this.mode === 'plane' || this.mode === 'heli') {
      this.updateFlight(dt, forward, right, t, vel, speed);
    } else {
      this.updateCar(dt, forward, right, t, vel, speed);
    }

    // wheel visuals: spin with speed, steer at the front
    const steer = this.input.steer;
    this.steerAngle = damp(this.steerAngle, steer * 0.46, 8, dt);
    for (let i = 0; i < this.wheelGroups.length; i++) {
      const wheel = this.wheelGroups[i];
      const isFront = wheel.position.z > 0;
      if (this.mode === 'car') wheel.rotation.y = isFront ? this.steerAngle : 0;
      wheel.rotation.x += (this.speed / (wheel.userData.wheelRadius || 0.4)) * dt;
    }

    // rotor spin
    if (this.rotor) {
      this.rotor.rotation.y += (this.mode === 'heli' ? 26 : 18) * dt;
    }

    this.updateLights(dt);
    this.emitDamageFx(dt);
  }

  updateCar(dt, forward, right, t, vel, speed) {
    const body = this.entity.body;
    const mass = body.mass();
    const grounded = this.raycastWheels(dt, mass);

    // engine
    const spec = this.spec;
    const maxSpeed = spec.speed || 30;
    const throttle = this.input.throttle;
    let drive = 0;
    if (throttle > 0) drive = throttle * Math.min(1, Math.max(0, (maxSpeed - Math.max(0, this.speed)) / maxSpeed));
    else if (throttle < 0) drive = throttle * Math.min(1, Math.max(0, (maxSpeed * 0.45 + Math.min(0, this.speed)) / (maxSpeed * 0.45)));
    if (this.mode === 'trailer') drive = 0;
    const engineForce = mass * (this.mode === 'car' ? 15.5 : 0);
    const driveImpulse = engineForce * drive * dt;
    if (grounded && driveImpulse !== 0) {
      body.applyImpulseAtPoint(
        { x: forward.x * driveImpulse, y: 0, z: forward.z * driveImpulse },
        { x: t.x, y: t.y - this.size[1] * 0.3, z: t.z }, true
      );
    }

    // braking
    if (this.input.brake || this.input.handbrake) {
      const brakeAmount = (this.input.handbrake ? 14 : 8) * mass * dt;
      const forwardSpeed = forward.x * vel.x + forward.z * vel.z;
      const scale = Math.min(1, brakeAmount / Math.max(1, mass * Math.abs(forwardSpeed)));
      body.applyImpulse({ x: -forward.x * forwardSpeed * mass * scale, y: 0, z: -forward.z * forwardSpeed * mass * scale }, true);
    }

    // steering: yaw rate scales with speed and grip
    if (grounded) {
      const speedFactor = clamp(Math.abs(this.speed) / 8, 0, 1) * (1 - clamp(Math.abs(this.speed) / (maxSpeed * 1.45), 0, 0.72));
      const targetYaw = -this.steerAngle * 1.55 * speedFactor * (this.speed < 0 ? -1 : 1);
      const av = body.angvel();
      body.setAngvel({ x: av.x, y: lerp(av.y, targetYaw, clamp(dt * 9, 0, 1)), z: av.z }, true);

      // lateral grip: cancel sideways velocity, harder at low speed
      const sideways = right.x * vel.x + right.z * vel.z;
      const grip = this.mode === 'bus' || this.mode === 'truck' ? 0.55 : 0.82;
      const gripImpulse = -sideways * mass * grip * clamp(dt * 22, 0, 1);
      body.applyImpulse({ x: right.x * gripImpulse, y: 0, z: right.z * gripImpulse }, true);

      // aerodynamic drag and a little downforce keep fast cars planted
      const drag = -this.speed * mass * 0.02 * dt * 6;
      body.applyImpulse({ x: forward.x * drag, y: 0, z: forward.z * drag }, true);
      body.applyImpulse({ x: 0, y: -clamp(speed * 2.2, 0, mass * 3) * dt, z: 0 }, true);
    }
  }

  raycastWheels(dt, mass) {
    const physics = this.game.physics;
    const body = this.entity.body;
    const t = body.translation();
    const r = body.rotation();
    tmpQ2.set(r.x, r.y, r.z, r.w);
    let grounded = 0;
    const up = UP;
    const springK = mass * 34;
    const dampingK = mass * 4.2;
    const vel = body.linvel();

    for (const wheel of this.wheels) {
      const local = tmpWheel.copy(wheel.local).applyQuaternion(tmpQ2);
      const origin = { x: t.x + local.x, y: t.y + local.y, z: t.z + local.z };
      const hit = physics.raycast(new THREE.Vector3(origin.x, origin.y + 0.1, origin.z), new THREE.Vector3(0, -1, 0), this.wheelRadius + 0.75, this.entity.body);
      wheel.contact = !!hit;
      wheel.compression = 0;
      if (!hit) continue;
      grounded++;
      const distance = hit.distance;
      const rest = this.wheelRadius + 0.37;
      const compression = clamp(1 - distance / rest, 0, 1);
      wheel.compression = compression;
      const point = { x: origin.x, y: origin.y - distance, z: origin.z };
      const verticalSpeed = vel.y;
      const force = springK * compression * 0.25 - dampingK * verticalSpeed * 0.25;
      const impulse = clamp(force, -mass * 12, mass * 26) * dt;
      body.applyImpulseAtPoint({ x: 0, y: impulse, z: 0 }, point, true);
    }

    if (!grounded) {
      // a small amount of air stabilising so jumps are not instant flips
      const av = body.angvel();
      body.setAngvel({ x: lerp(av.x, 0, dt * 0.8), y: av.y, z: lerp(av.z, 0, dt * 0.8) }, true);
    }
    this.grounded = grounded;
    return grounded > 0;
  }

  updateFlight(dt, forward, right, t, vel, speed) {
    const body = this.entity.body;
    const mass = body.mass();
    const isHeli = this.mode === 'heli';
    const forwardSpeed = forward.x * vel.x + forward.z * vel.z;
    const verticalSpeed = vel.y;
    const controlled = this.occupied;

    if (isHeli) {
      const lift = mass * 9.81 * (0.92 + this.input.throttle * 0.9);
      body.applyImpulse({ x: 0, y: lift * dt, z: 0 }, true);
      const av = body.angvel();
      const yawTarget = -this.input.steer * 1.4;
      body.setAngvel({ x: lerp(av.x, controlled ? -this.input.pitch * 0.55 : 0, dt * 2), y: lerp(av.y, yawTarget, dt * 2), z: lerp(av.z, controlled ? this.input.steer * 0.5 : 0, dt * 2) }, true);
      if (controlled) {
        const push = mass * 15 * dt;
        body.applyImpulse({ x: forward.x * push, y: 0, z: forward.z * push }, true);
      }
    } else {
      // plane: lift rises with speed, pitch is the elevator, roll is ailerons
      const airSpeed = Math.hypot(vel.x, vel.y, vel.z);
      const lift = Math.min(1, airSpeed / 26) * mass * 9.81 * 1.16;
      body.applyImpulse({ x: 0, y: lift * dt, z: 0 }, true);
      const av = body.angvel();
      if (controlled) {
        body.applyTorqueImpulse({ x: -this.input.pitch * mass * 1.15 * dt, y: 0, z: -this.input.steer * mass * 0.75 * dt }, true);
      } else {
        // keep a parked plane level
        const pitch = Math.asin(clamp(2 * (body.rotation().w * body.rotation().x + body.rotation().y * body.rotation().z), -1, 1));
        body.applyTorqueImpulse({ x: -pitch * mass * 0.4 * dt, y: 0, z: 0 }, true);
      }
      const thrust = mass * (this.spec.speed || 50) * 0.34 * this.input.throttle * dt;
      body.applyImpulse({ x: forward.x * thrust, y: 0, z: forward.z * thrust }, true);
      const dragScale = -airSpeed * mass * 0.02 * dt;
      body.applyImpulse({ x: vel.x * dragScale, y: vel.y * dragScale * 0.4, z: vel.z * dragScale }, true);
    }

    // auto-level a little when the pilot lets go
    if (!controlled) {
      const q = body.rotation();
      const up = new THREE.Vector3(0, 1, 0).applyQuaternion(tmpQ2.set(q.x, q.y, q.z, q.w));
      const correction = up.clone().cross(UP).multiplyScalar(mass * 3 * dt);
      body.applyTorqueImpulse({ x: correction.x, y: 0, z: correction.z }, true);
    }
    this.grounded = 0;
  }

  updateLights(dt) {
    if (!this.lightMaterial) return;
    const night = this.game.daylight?.state.night || 0;
    const on = this.occupied || night > 0.3;
    this.lightMaterial.color.setHex(on ? 0xfff3cc : 0x5b5b52);
    if (this.spot) {
      this.spot.intensity = damp(this.spot.intensity, on ? 55 : 0, 6, dt);
      this.spot.visible = this.spot.intensity > 2;
    }
  }

  emitDamageFx(dt) {
    if (this.hp > this.maxHp * 0.55) return;
    this.smokeTimer = (this.smokeTimer || 0) - dt;
    if (this.smokeTimer <= 0) {
      this.smokeTimer = 0.12;
      const t = this.entity.body.translation();
      const target = this.game.player?.vehicle === this ? 0.5 : 0.25;
      this.game.fx.smoke(new THREE.Vector3(t.x, t.y + 0.5, t.z), target);
    }
  }

  takeDamage(amount, point) {
    if (this.dead) return;
    this.hp -= amount;
    this.damage = 1 - this.hp / this.maxHp;
    // visible deformation: the body sags and leans as it takes hits
    if (this.bodyMesh && this.damage > 0.05) {
      const sag = Math.min(1, this.damage) * 0.16;
      this.bodyMesh.scale.y = 1 - sag * 0.5;
      this.bodyMesh.position.y = -sag * 0.16;
      this.bodyMesh.rotation.z = Math.sin(this.damage * 12) * sag * 0.12;
    }
    if (this.damage > 0.5) {
      this.game.audio?.impact(point || this.entity.body.translation(), 0.8, 'metal');
    }
    if (this.hp <= 0) this.explode(point);
  }

  explode(point) {
    if (this.dead) return;
    this.dead = true;
    const t = this.entity.body.translation();
    const position = new THREE.Vector3(t.x, t.y, t.z);
    this.game.fx.explosion(position, 1.35, this);
    this.game.audio?.explosion(position, 1);
    if (this.game.player?.vehicle === this) this.game.player.exitVehicle(true);
    this.game.physics.remove(this.entity, { silent: true });
    if (this.mesh.parent) this.mesh.parent.remove(this.mesh);
    this.game.vehicles = this.game.vehicles.filter((v) => v !== this);
    this.game.ui?.toast(`${this.spec.name} destroyed`, 'bad');
  }

  repair() {
    if (this.dead) return;
    this.hp = this.maxHp;
    this.damage = 0;
    if (this.bodyMesh) {
      this.bodyMesh.scale.y = 1;
      this.bodyMesh.position.y = 0;
      this.bodyMesh.rotation.z = 0;
    }
    const home = this.entity.home;
    this.entity.body.setTranslation({ x: home.position[0], y: home.position[1], z: home.position[2] }, true);
    if (home.rotation) this.entity.body.setRotation(home.rotation, true);
    this.entity.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    this.entity.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
  }

  distanceTo(point) {
    const t = this.entity.body.translation();
    return Math.hypot(t.x - point.x, t.z - point.z);
  }
}

export function createVehicle(game, type, position, heading = 0) {
  const vehicle = new Vehicle(game, type, position, heading);
  game.vehicles.push(vehicle);
  return vehicle;
}
