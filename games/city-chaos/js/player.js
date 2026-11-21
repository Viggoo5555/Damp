// ---------------------------------------------------------------------------
// Third-person player: a capsule body with locked rotation, a smooth orbit
// camera with collision, vehicle enter/exit and a free camera.
// ---------------------------------------------------------------------------
import * as THREE from 'three';
import { box, mat, clamp, lerp, damp } from './core.js';

const UP = new THREE.Vector3(0, 1, 0);

// A low-poly builder: work jacket, hard hat, gloves, boots and a packed
// rucksack. Limbs hang from hip and shoulder pivots so the walk cycle swings
// from the joint instead of spinning each box around its own middle.
function buildCharacter() {
  const group = new THREE.Group();
  const jacket = 0x5d8797;
  const jacketDark = 0x456b79;
  const trousers = 0x3f4a55;
  const trouserDark = 0x333d46;
  const skin = 0xd6b18d;
  const boot = 0x33302c;
  const glove = 0x2b3338;
  const pack = 0xe0a93f;
  const strap = 0xa9752a;

  const add = (parent, mesh, x, y, z) => {
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    parent.add(mesh);
    return mesh;
  };

  // hips, belt and buckle
  add(group, box(0.4, 0.2, 0.26, trousers, { flat: true }), 0, -0.02, 0);
  add(group, box(0.42, 0.055, 0.27, 0x2b3238, { flat: true }), 0, 0.09, 0);
  add(group, box(0.07, 0.05, 0.02, 0xb9c0c2, { flat: true }), 0, 0.09, 0.145);

  // torso: jacket, shoulder yoke, hem, zip, pocket, collar
  add(group, box(0.46, 0.42, 0.28, jacket, { flat: true }), 0, 0.31, 0);
  add(group, box(0.5, 0.13, 0.3, jacket, { flat: true }), 0, 0.45, 0);
  add(group, box(0.47, 0.08, 0.29, jacketDark, { flat: true }), 0, 0.13, 0);
  add(group, box(0.045, 0.34, 0.02, jacketDark, { flat: true }), 0, 0.32, 0.15);
  add(group, box(0.13, 0.11, 0.02, jacketDark, { flat: true }), 0.14, 0.37, 0.152);
  add(group, box(0.3, 0.09, 0.24, 0x3c5f6b, { flat: true }), 0, 0.55, 0);

  // rucksack with flap, straps and a bedroll on top
  add(group, box(0.28, 0.34, 0.16, pack, { flat: true }), 0, 0.28, -0.23);
  add(group, box(0.3, 0.08, 0.18, strap, { flat: true }), 0, 0.41, -0.23);
  add(group, box(0.05, 0.38, 0.03, strap, { flat: true }), -0.1, 0.3, 0.155);
  add(group, box(0.05, 0.38, 0.03, strap, { flat: true }), 0.1, 0.3, 0.155);
  const roll = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.065, 0.28, 7), mat(0x5c6b4a, { flat: true }));
  roll.rotation.z = Math.PI / 2;
  roll.position.set(0, 0.49, -0.23);
  roll.castShadow = true;
  group.add(roll);

  // neck, head and face
  add(group, box(0.13, 0.1, 0.13, 0xc9a483, { flat: true }), 0, 0.6, 0);
  add(group, box(0.24, 0.25, 0.23, skin, { flat: true }), 0, 0.75, 0);
  add(group, box(0.025, 0.07, 0.055, skin, { flat: true }), -0.125, 0.75, 0);
  add(group, box(0.025, 0.07, 0.055, skin, { flat: true }), 0.125, 0.75, 0);
  add(group, box(0.05, 0.038, 0.02, 0x2a2521, { flat: true }), -0.057, 0.775, 0.12);
  add(group, box(0.05, 0.038, 0.02, 0x2a2521, { flat: true }), 0.057, 0.775, 0.12);
  add(group, box(0.07, 0.02, 0.02, 0x3a2b23, { flat: true }), -0.057, 0.805, 0.12);
  add(group, box(0.07, 0.02, 0.02, 0x3a2b23, { flat: true }), 0.057, 0.805, 0.12);
  add(group, box(0.05, 0.055, 0.045, 0xc79a78, { flat: true }), 0, 0.745, 0.13);
  add(group, box(0.065, 0.016, 0.02, 0x8a5b4b, { flat: true }), 0, 0.695, 0.12);
  add(group, box(0.25, 0.09, 0.24, 0x2c2622, { flat: true }), 0, 0.855, -0.005);
  add(group, box(0.25, 0.18, 0.07, 0x2c2622, { flat: true }), 0, 0.785, -0.095);

  // hard hat: dome, brim and a top ridge
  const dome = new THREE.Mesh(new THREE.CylinderGeometry(0.155, 0.18, 0.12, 9), mat(0xf0b73f, { flat: true }));
  dome.position.set(0, 0.9, 0);
  dome.castShadow = true;
  group.add(dome);
  const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.215, 0.215, 0.03, 10), mat(0xdfa22e, { flat: true }));
  brim.position.set(0, 0.845, 0.02);
  brim.castShadow = true;
  group.add(brim);
  add(group, box(0.045, 0.045, 0.18, 0xe6ad35, { flat: true }), 0, 0.965, 0);

  // arms from the shoulder pivots
  const arms = [];
  for (const side of [-1, 1]) {
    const pivot = new THREE.Group();
    pivot.position.set(side * 0.3, 0.46, 0);
    pivot.rotation.z = side * 0.06;
    group.add(pivot);
    add(pivot, box(0.165, 0.13, 0.155, jacket, { flat: true }), 0, -0.02, 0);
    add(pivot, box(0.13, 0.24, 0.14, jacket, { flat: true }), 0, -0.11, 0);
    add(pivot, box(0.12, 0.05, 0.13, 0x3c5f6b, { flat: true }), 0, -0.225, 0);
    add(pivot, box(0.115, 0.22, 0.125, jacketDark, { flat: true }), 0, -0.33, 0.008);
    add(pivot, box(0.13, 0.11, 0.13, glove, { flat: true }), 0, -0.465, 0.012);
    arms.push(pivot);
  }

  // legs from the hip pivots, boots included
  const legs = [];
  for (const side of [-1, 1]) {
    const pivot = new THREE.Group();
    pivot.position.set(side * 0.115, -0.06, 0);
    group.add(pivot);
    add(pivot, box(0.165, 0.3, 0.18, trousers, { flat: true }), 0, -0.15, 0);
    add(pivot, box(0.15, 0.05, 0.06, 0x4a5560, { flat: true }), 0, -0.28, 0.085);
    add(pivot, box(0.15, 0.26, 0.165, trouserDark, { flat: true }), 0, -0.41, 0.005);
    add(pivot, box(0.185, 0.13, 0.3, boot, { flat: true }), 0, -0.545, 0.045);
    add(pivot, box(0.19, 0.04, 0.31, 0x211f1c, { flat: true }), 0, -0.6, 0.045);
    legs.push(pivot);
  }

  group.userData.arms = arms;
  group.userData.legs = legs;
  return group;
}

export class Player {
  constructor(game) {
    this.game = game;
    this.mode = 'walk';
    this.vehicle = null;
    this.yaw = Math.PI;
    this.pitch = -0.16;
    this.distance = 6.1;
    this.freeDistance = 6.1;
    this.radius = 0.34;
    this.height = 1.75;
    this.walkSpeed = 4.4;
    this.runSpeed = 7.4;
    this.grounded = false;
    this.phase = 0;
    this.mesh = buildCharacter();
    this.mesh.visible = false;
    game.scene.add(this.mesh);
    this.entity = null;
    this.freeCam = false;
    this.freePos = new THREE.Vector3(0, 30, 0);
    this.camPos = new THREE.Vector3(0, 6, 10);
    this.lookAt = new THREE.Vector3();
    this.camInitialised = false;
    this.enterHint = null;
  }

  spawn(position) {
    if (this.entity) this.game.physics.remove(this.entity, { silent: true });
    if (!this.mesh.parent) this.game.scene.add(this.mesh);
    const entity = this.game.physics.create({
      mesh: this.mesh, shape: 'capsule', size: [this.radius, this.height, this.radius],
      position: [position.x, position.y, position.z], kind: 'player', name: 'You',
      mass: 78, friction: 0, restitution: 0, linearDamping: 0, angularDamping: 0.4,
      visualOffset: [0, -0.26, 0],
    });
    entity.body.lockRotations(true, true);
    this.entity = entity;
    this.mesh.visible = true;
    this.mesh.position.copy(position);
    this.mode = 'walk';
    this.vehicle = null;
    this.camInitialised = false;
    this.yaw = this.game.city.spawnFacing ?? Math.PI;
    this.mesh.rotation.y = this.yaw + Math.PI;
  }

  look(dx, dy) {
    const scale = 0.0022 * (this.game.settings.mouseSensitivity / 100);
    this.yaw -= dx * scale;
    this.pitch = clamp(this.pitch - dy * scale, -1.2, 1.05);
  }

  get camera() {
    return this.game.camera;
  }

  // -------------------------------------------------------------------------
  // Camera helpers
  // -------------------------------------------------------------------------
  cameraBasis() {
    const forward = new THREE.Vector3(
      -Math.sin(this.yaw) * Math.cos(this.pitch),
      Math.sin(this.pitch),
      -Math.cos(this.yaw) * Math.cos(this.pitch)
    );
    const flatForward = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    const right = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    return { forward, flatForward, right };
  }

  // -------------------------------------------------------------------------
  // Update
  // -------------------------------------------------------------------------
  update(dt) {
    if (!this.entity || this.entity.dead) return;
    if (this.freeCam) {
      this.updateFreeCamera(dt);
      return;
    }
    if (this.mode === 'vehicle' && this.vehicle && !this.vehicle.dead) {
      this.updateDriver(dt);
    } else {
      if (this.mode === 'vehicle') this.exitVehicle(true);
      this.updateWalk(dt);
    }
    this.updateCamera(dt);
  }

  updateWalk(dt) {
    const entity = this.entity;
    const body = entity.body;
    const input = this.game.input;
    const { flatForward, right } = this.cameraBasis();
    const forwardPressed = (input.keys.has('KeyW') ? 1 : 0) - (input.keys.has('KeyS') ? 1 : 0);
    const sidePressed = (input.keys.has('KeyD') ? 1 : 0) - (input.keys.has('KeyA') ? 1 : 0);
    const running = input.keys.has('ShiftLeft') || input.keys.has('ShiftRight');
    const speed = running ? this.runSpeed : this.walkSpeed;

    const wish = new THREE.Vector3()
      .addScaledVector(flatForward, forwardPressed)
      .addScaledVector(right, sidePressed);
    if (wish.lengthSq() > 0) wish.normalize().multiplyScalar(speed);

    // face the way the character is walking instead of sliding sideways
    if (wish.lengthSq() > 0.001) {
      let delta = Math.atan2(wish.x, wish.z) - this.mesh.rotation.y;
      while (delta > Math.PI) delta -= Math.PI * 2;
      while (delta < -Math.PI) delta += Math.PI * 2;
      this.mesh.rotation.y += delta * (1 - Math.exp(-16 * dt));
    }

    const velocity = body.linvel();
    const blend = 1 - Math.exp(-14 * dt);
    body.setLinvel({
      x: lerp(velocity.x, wish.x, blend),
      y: velocity.y,
      z: lerp(velocity.z, wish.z, blend),
    }, true);

    // ground probe keeps the jump honest
    const t = body.translation();
    const ground = this.game.physics.raycast(
      new THREE.Vector3(t.x, t.y, t.z), new THREE.Vector3(0, -1, 0),
      this.height / 2 + 0.25, body
    );
    this.grounded = !!ground;
    if (ground && (input.keys.has('Space') || input.jumpQueued)) {
      body.setLinvel({ x: velocity.x, y: 6.4, z: velocity.z }, true);
      this.grounded = false;
      this.game.audio?.pop(new THREE.Vector3(t.x, t.y, t.z), 0.15);
    }
    input.jumpQueued = false;

    // face the walk direction, and swing the limbs while moving
    const horizontalSpeed = Math.hypot(body.linvel().x, body.linvel().z);
    if (horizontalSpeed > 0.4) {
      const targetYaw = Math.atan2(body.linvel().x, body.linvel().z);
      this.mesh.rotation.y = damp(this.mesh.rotation.y, targetYaw + Math.PI, 10, dt);
      this.phase += dt * horizontalSpeed * 2.1;
    } else {
      this.phase += dt * 0.6;
    }
    const swing = Math.sin(this.phase) * Math.min(0.55, horizontalSpeed * 0.1);
    this.mesh.userData.legs[0].rotation.x = swing;
    this.mesh.userData.legs[1].rotation.x = -swing;
    this.mesh.userData.arms[0].rotation.x = -swing * 0.85;
    this.mesh.userData.arms[1].rotation.x = swing * 0.85;

    this.mesh.position.set(t.x, t.y - 0.26, t.z);

    // nearby vehicles offer themselves up with F
    this.findEnterableVehicle();
  }

  findEnterableVehicle() {
    const t = this.entity.body.translation();
    let nearest = null;
    let best = 5.2;
    for (const vehicle of this.game.vehicles) {
      if (vehicle.dead) continue;
      const d = Math.hypot(vehicle.entity.body.translation().x - t.x, vehicle.entity.body.translation().z - t.z);
      if (d < best) {
        best = d;
        nearest = vehicle;
      }
    }
    this.enterHint = nearest;
    this.game.ui?.setPrompt(nearest ? '<kbd>F</kbd>Drive ' + nearest.spec.name : '');
  }

  updateDriver(dt) {
    const vehicle = this.vehicle;
    if (!vehicle || vehicle.dead) {
      this.exitVehicle(true);
      return;
    }
    const input = this.game.input;
    const throttle = (input.keys.has('KeyW') ? 1 : 0) - (input.keys.has('KeyS') ? 1 : 0);
    const steer = (input.keys.has('KeyA') ? 1 : 0) - (input.keys.has('KeyD') ? 1 : 0);
    vehicle.setInput({
      throttle,
      steer,
      brake: input.keys.has('KeyS'),
      handbrake: input.keys.has('Space'),
      pitch: (input.keys.has('Space') ? 1 : 0) - (input.keys.has('ShiftLeft') ? 1 : 0),
    });
    vehicle.update(dt);

    const t = vehicle.entity.body.translation();
    this.mesh.position.set(t.x, t.y, t.z);
    this.mesh.visible = false;
    this.game.ui?.setPrompt('<kbd>F</kbd>Leave vehicle');
    this.game.audio?.updateEngine(vehicle.speed, throttle, true);
    if ((input.keys.has('KeyF') && !input.fLatch)) {
      input.fLatch = true;
      this.exitVehicle(false);
    }
  }

  updateCamera(dt) {
    const camera = this.camera;
    const shake = this.game.fx?.shakeOffset(dt) || { x: 0, y: 0, z: 0 };
    const { forward } = this.cameraBasis();
    let target = new THREE.Vector3();
    let desired = new THREE.Vector3();
    let distance = this.distance;

    if (this.mode === 'vehicle' && this.vehicle && !this.vehicle.dead) {
      const body = this.vehicle.entity.body;
      const t = body.translation();
      const r = body.rotation();
      const quat = new THREE.Quaternion(r.x, r.y, r.z, r.w);
      const forwardV = new THREE.Vector3(0, 0, 1).applyQuaternion(quat);
      const upV = new THREE.Vector3(0, 1, 0).applyQuaternion(quat);
      const size = this.vehicle.size;
      distance = Math.max(9, size[2] * 1.65);
      target.set(t.x, t.y + size[1] * 0.55 + 0.9, t.z);
      desired.copy(target).addScaledVector(forwardV, -distance).addScaledVector(upV, Math.max(2.6, size[1] * 1.1));
      // blend the camera's yaw a little so reversing is readable
      desired.x += -Math.sin(this.yaw) * 0.0;
    } else {
      const t = this.entity.body.translation();
      target.set(t.x, t.y + 1.5, t.z);
      desired.copy(target).addScaledVector(forward, -distance);
      desired.y += 0.55;
      if (desired.y < target.y - 1.6) desired.y = target.y - 1.6;
    }

    // keep the camera out of walls
    const direction = desired.clone().sub(target);
    const distanceToDesired = direction.length();
    direction.normalize();
    const hit = this.game.physics.raycast(target, direction, distanceToDesired, this.entity?.body, null);
    if (hit && hit.distance < distanceToDesired) {
      desired.copy(target).addScaledVector(direction, Math.max(1.1, hit.distance - 0.35));
    }

    if (!this.camInitialised) {
      this.camPos.copy(desired);
      this.camInitialised = true;
    } else {
      const smoothing = this.mode === 'vehicle' ? 7 : 12;
      this.camPos.x = damp(this.camPos.x, desired.x, smoothing, dt);
      this.camPos.y = damp(this.camPos.y, desired.y, smoothing, dt);
      this.camPos.z = damp(this.camPos.z, desired.z, smoothing, dt);
    }

    camera.position.set(this.camPos.x + shake.x, this.camPos.y + shake.y, this.camPos.z + shake.z);
    this.lookAt.set(target.x, target.y, target.z);
    camera.lookAt(this.lookAt);
    if (this.mode === 'vehicle' && this.vehicle) {
      camera.position.y += 0.3;
    }
  }

  updateFreeCamera(dt) {
    const input = this.game.input;
    const camera = this.camera;
    const speed = (input.keys.has('ShiftLeft') ? 46 : 18) * (this.game.settings.camSensitivity / 100);
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
    const move = new THREE.Vector3();
    if (input.keys.has('KeyW')) move.add(forward);
    if (input.keys.has('KeyS')) move.sub(forward);
    if (input.keys.has('KeyD')) move.add(right);
    if (input.keys.has('KeyA')) move.sub(right);
    if (input.keys.has('KeyE')) move.y += 1;
    if (input.keys.has('KeyQ')) move.y -= 1;
    if (move.lengthSq() > 0) this.freePos.addScaledVector(move.normalize(), speed * dt);
    this.freePos.y = Math.max(0.8, this.freePos.y);

    const shake = this.game.fx?.shakeOffset(dt) || { x: 0, y: 0, z: 0 };
    camera.position.set(this.freePos.x + shake.x, this.freePos.y + shake.y, this.freePos.z + shake.z);
    camera.rotation.set(this.pitch, this.yaw, 0, 'YXZ');
    this.camPos.copy(this.freePos);
    this.game.ui?.setPrompt('<kbd>V</kbd>Back to the city');
  }

  // -------------------------------------------------------------------------
  // Vehicles and camera modes
  // -------------------------------------------------------------------------
  enterVehicle(vehicle) {
    if (!vehicle || vehicle.dead) return false;
    this.mode = 'vehicle';
    this.vehicle = vehicle;
    vehicle.occupied = true;
    this.mesh.visible = false;
    const body = this.entity.body;
    if (typeof body.setEnabled === 'function') body.setEnabled(false);
    else body.setBodyType(this.game.physics.R.RigidBodyType.Fixed, true);
    this.camInitialised = false;
    this.game.audio?.startEngine();
    this.game.audio?.ui();
    this.game.ui?.toast(`Driving ${vehicle.spec.name}`, 'good');
    return true;
  }

  exitVehicle(forced = false) {
    if (!this.vehicle) return;
    const vehicle = this.vehicle;
    vehicle.occupied = false;
    const body = vehicle.entity.body;
    const t = body.translation();
    const r = body.rotation();
    const quat = new THREE.Quaternion(r.x, r.y, r.z, r.w);
    const side = new THREE.Vector3(1, 0, 0).applyQuaternion(quat).multiplyScalar(2.6);
    const spot = { x: t.x + side.x, y: Math.max(1.2, t.y + 1.1), z: t.z + side.z };
    this.mode = 'walk';
    this.vehicle = null;
    this.mesh.visible = true;
    const playerBody = this.entity.body;
    if (typeof playerBody.setEnabled === 'function') playerBody.setEnabled(true);
    else playerBody.setBodyType(this.game.physics.R.RigidBodyType.Dynamic, true);
    playerBody.setTranslation(spot, true);
    playerBody.setLinvel({ x: 0, y: 0, z: 0 }, true);
    playerBody.wakeUp();
    this.camInitialised = false;
    this.game.audio?.updateEngine(0, 0, false);
    this.game.audio?.stopEngine();
    if (!forced) this.game.audio?.ui();
  }

  toggleFreeCam(on = !this.freeCam) {
    this.freeCam = on;
    this.game.ui?.setMode(on ? 'Free camera' : this.mode === 'vehicle' ? 'Driving' : 'Sandbox');
    if (on) {
      this.freePos.copy(this.camera.position);
      this.game.audio?.updateEngine(0, 0, false);
      this.game.audio?.stopEngine();
    } else {
      this.camInitialised = false;
      if (this.mode === 'vehicle') this.game.audio?.startEngine();
    }
    this.game.tools?.setTool(on ? 'camera' : 'grab');
  }
}
