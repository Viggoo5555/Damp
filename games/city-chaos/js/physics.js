// ---------------------------------------------------------------------------
// The physics layer: one Rapier world, one registry of game entities, rays,
// impulses, joints and the debris budget.
// ---------------------------------------------------------------------------
import * as THREE from 'three';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const tempQ = new THREE.Quaternion();
const tempV = new THREE.Vector3();

let nextId = 1;

export class Physics {
  constructor(RAPIER, quality) {
    this.R = RAPIER;
    this.world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
    this.world.timestep = 1 / 60;
    this.events = new RAPIER.EventQueue(true);
    this.byCollider = new Map();
    this.byBody = new Map();
    this.entities = new Set();
    this.quality = quality;
    this.lastStep = 0;
    this.stepCount = 0;
    this.accum = 0;
  }

  setQuality(quality) {
    this.quality = quality;
  }

  // -------------------------------------------------------------------------
  // Entity creation
  // -------------------------------------------------------------------------
  /**
   * shape: 'box' | 'ball' | 'cylinder' | 'capsule'
   * size: [x, y, z] full extents for a box, [radius, height, _] for round shapes
   */
  create(opts) {
    const R = this.R;
    const {
      mesh, shape = 'box', size = [1, 1, 1], mass = 50, position = [0, 1, 0], rotation = null,
      kind = 'prop', name = 'Object', fixed = false, friction = 0.7, restitution = 0.08,
      ccd = false, damageable = false, hp = 100, gravityScale = 1, material = 'solid',
      linearDamping = 0.06, angularDamping = 0.12, sensor = false, data = {},
      hull = null, collisionGroups = null, visualOffset = null,
    } = opts;

    let desc = fixed ? R.RigidBodyDesc.fixed() : R.RigidBodyDesc.dynamic();
    desc.setTranslation(position[0], position[1], position[2]);
    if (rotation) desc.setRotation({ x: rotation.x, y: rotation.y, z: rotation.z, w: rotation.w });
    desc.setLinearDamping(linearDamping).setAngularDamping(angularDamping);
    desc.setGravityScale(gravityScale);
    if (ccd) desc.setCcdEnabled(true);
    const body = this.world.createRigidBody(desc);

    const colliderDesc = (half, offset = null) => {
      let cd;
      if (shape === 'ball') cd = R.ColliderDesc.ball(size[0]);
      else if (shape === 'cylinder') cd = R.ColliderDesc.cylinder(size[1] / 2, size[0]);
      else if (shape === 'capsule') cd = R.ColliderDesc.capsule(Math.max(0.05, (size[1] - size[0] * 2) / 2), size[0]);
      else if (shape === 'hull' && hull) cd = R.ColliderDesc.convexHull(hull) || R.ColliderDesc.cuboid(half[0], half[1], half[2]);
      else cd = R.ColliderDesc.cuboid(half[0], half[1], half[2]);
      if (offset) {
        const [ox, oy, oz] = offset;
        cd.setTranslation(ox, oy, oz);
        if (shape === 'box') cd = R.ColliderDesc.cuboid(half[0], half[1], half[2]).setTranslation(ox, oy, oz);
      }
      cd.setFriction(friction).setRestitution(restitution);
      cd.setActiveEvents(R.ActiveEvents.COLLISION_EVENTS);
      if (sensor) cd.setSensor(true);
      const volume = shape === 'box' ? Math.max(0.0001, half[0] * half[1] * half[2] * 8)
        : shape === 'ball' ? Math.max(0.0001, (4 / 3) * Math.PI * size[0] ** 3)
          : Math.max(0.0001, Math.PI * size[0] * size[0] * size[1]);
      if (typeof cd.setMass === 'function') cd.setMass(Math.max(0.2, mass));
      else cd.setDensity(Math.max(0.2, mass) / volume);
      return cd;
    };

    const half = [size[0] / 2, size[1] / 2, size[2] / 2];
    let collider;
    try {
      collider = this.world.createCollider(colliderDesc(half), body);
    } catch (error) {
      // A degenerate shape (a scaled-to-nothing prop) still gets a tiny body.
      collider = this.world.createCollider(R.ColliderDesc.cuboid(0.08, 0.08, 0.08).setActiveEvents(R.ActiveEvents.COLLISION_EVENTS), body);
    }

    if (collisionGroups) collider.setCollisionGroups(collisionGroups);

    const entity = {
      id: nextId++, kind, name, mesh, body, collider, colliders: [collider],
      visualOffset: visualOffset ? new THREE.Vector3(...visualOffset) : null,
      size: [size[0], size[1], size[2]], baseMass: mass, mass, hp, maxHp: hp,
      damageable, dead: false, frozen: fixed, joints: [], data, material,
      home: { position: [...position], rotation: rotation ? { ...rotation } : null },
      onDamage: null, onBreak: null, radius: Math.max(size[0], size[1], size[2]) * 0.5,
      lastSpeed: 0,
    };

    if (mesh) {
      mesh.position.set(position[0], position[1], position[2]);
      if (entity.visualOffset) mesh.position.add(entity.visualOffset);
      if (rotation) mesh.quaternion.set(rotation.x, rotation.y, rotation.z, rotation.w);
      mesh.userData.entity = entity;
    }

    this.register(entity);
    return entity;
  }

  register(entity) {
    this.entities.add(entity);
    this.byBody.set(entity.body.handle, entity);
    for (const collider of entity.colliders) this.byCollider.set(collider.handle, entity);
    if (entity.mesh) this.byBody.get(entity.body.handle);
  }

  /** Apply damage through whatever handler the entity carries. */
  damage(entity, amount, point, normal) {
    if (!entity || entity.dead || amount <= 0) return;
    if (entity.onDamage) {
      entity.onDamage(amount, point || entity.body.translation(), normal || new THREE.Vector3(0, 1, 0));
      return;
    }
    if (!entity.damageable) return;
    entity.hp -= amount;
    if (entity.hp <= 0) entity.onBreak?.(point || entity.body.translation());
  }

  spherical(a, b, worldPoint) {
    if (!a || !b || a === b) return null;
    const p = worldPoint || (() => {
      const ta = a.body.translation();
      const tb = b.body.translation();
      return { x: (ta.x + tb.x) / 2, y: (ta.y + tb.y) / 2, z: (ta.z + tb.z) / 2 };
    })();
    const joint = this.world.createImpulseJoint(
      this.R.JointData.spherical(this.localPoint(a.body, p), this.localPoint(b.body, p)),
      a.body, b.body, true
    );
    a.joints.push(joint);
    b.joints.push(joint);
    return joint;
  }

  remove(entity, { silent = false } = {}) {
    if (!entity || entity.dead) return;
    entity.dead = true;
    for (const joint of entity.joints.splice(0)) {
      try { this.world.removeImpulseJoint(joint, true); } catch (error) { /* already gone */ }
    }
    this.byBody.delete(entity.body.handle);
    for (const collider of entity.colliders) this.byCollider.delete(collider.handle);
    try { this.world.removeRigidBody(entity.body); } catch (error) { /* already gone */ }
    this.entities.delete(entity);
    if (entity.mesh && entity.mesh.parent) entity.mesh.parent.remove(entity.mesh);
    if (entity.mesh && entity.disposeGeometry) entity.mesh.geometry.dispose();
    if (!silent) entity.data?.onRemoved?.();
  }

  // -------------------------------------------------------------------------
  // Queries
  // -------------------------------------------------------------------------
  entityOf(colliderHandle) {
    return this.byCollider.get(colliderHandle) || null;
  }

  raycast(origin, direction, maxDistance = 100, excludeBody = null, excludeCollider = null) {
    const ray = new this.R.Ray(
      { x: origin.x, y: origin.y, z: origin.z },
      { x: direction.x, y: direction.y, z: direction.z }
    );
    const hit = this.world.castRayAndGetNormal(
      ray, maxDistance, true, undefined, undefined,
      excludeCollider || undefined, excludeBody || undefined
    );
    if (!hit) return null;
    const distance = hit.timeOfImpact ?? hit.toi ?? 0;
    const point = V(
      origin.x + direction.x * distance,
      origin.y + direction.y * distance,
      origin.z + direction.z * distance
    );
    return {
      entity: this.byCollider.get(hit.collider.handle) || null,
      collider: hit.collider,
      point,
      distance,
      normal: V(hit.normal?.x ?? 0, hit.normal?.y ?? 1, hit.normal?.z ?? 0),
    };
  }

  // Rapier has no world-to-local helper on the JS side, so this does the math.
  localPoint(body, worldPoint) {
    const t = body.translation();
    const r = body.rotation();
    tempQ.set(r.x, r.y, r.z, r.w).invert();
    tempV.set(worldPoint.x - t.x, worldPoint.y - t.y, worldPoint.z - t.z).applyQuaternion(tempQ);
    return { x: tempV.x, y: tempV.y, z: tempV.z };
  }

  // -------------------------------------------------------------------------
  // Body state helpers
  // -------------------------------------------------------------------------
  freeze(entity, frozen) {
    if (!entity || entity.dead || entity.kind === 'building') return;
    entity.frozen = frozen;
    const type = frozen ? this.R.RigidBodyType.Fixed : this.R.RigidBodyType.Dynamic;
    entity.body.setBodyType(type, true);
    if (!frozen) entity.body.wakeUp();
  }

  moveTo(entity, position, rotation = null) {
    if (!entity || entity.dead) return;
    entity.body.setTranslation({ x: position.x, y: position.y, z: position.z }, true);
    if (rotation) entity.body.setRotation({ x: rotation.x, y: rotation.y, z: rotation.z, w: rotation.w }, true);
    entity.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    entity.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
    entity.body.wakeUp();
  }

  /** Replaces colliders and mesh scale. Used by the scale tool. */
  resize(entity, factor) {
    if (!entity || entity.dead) return;
    if (entity.kind === 'building' || entity.kind === 'player' || entity.kind === 'vehicle') return;
    const R = this.R;
    const old = entity.colliders.slice();
    for (const collider of old) {
      this.byCollider.delete(collider.handle);
      try { this.world.removeCollider(collider, true); } catch (error) { /* gone */ }
    }
    entity.colliders = [];
    const [x, y, z] = entity.size;
    const half = [Math.max(0.05, (x / 2) * factor), Math.max(0.05, (y / 2) * factor), Math.max(0.05, (z / 2) * factor)];
    const mass = Math.max(0.5, entity.baseMass * factor ** 3);
    let collider;
    try {
      collider = this.world.createCollider(
        R.ColliderDesc.cuboid(half[0], half[1], half[2])
          .setFriction(0.7).setRestitution(0.08)
          .setActiveEvents(R.ActiveEvents.COLLISION_EVENTS)
          .setMass(mass),
        entity.body
      );
    } catch (error) { return; }
    entity.colliders = [collider];
    entity.collider = collider;
    entity.mass = mass;
    entity.scale = (entity.scale || 1) * 1;
    entity.visualScale = factor;
    entity.mesh?.scale.setScalar(factor);
    this.register(entity);
    entity.body.wakeUp();
  }

  /** Total live dynamic bodies, used for the physics budget readout. */
  dynamicCount() {
    let count = 0;
    for (const entity of this.entities) {
      if (!entity.frozen && entity.body.isDynamic?.()) count++;
    }
    return count;
  }

  // -------------------------------------------------------------------------
  // Joints
  // -------------------------------------------------------------------------
  weld(a, b, worldPoint) {
    if (!a || !b || a === b) return null;
    const p = worldPoint || V(
      (a.body.translation().x + b.body.translation().x) / 2,
      (a.body.translation().y + b.body.translation().y) / 2,
      (a.body.translation().z + b.body.translation().z) / 2
    );
    const localA = this.localPoint(a.body, p);
    const localB = this.localPoint(b.body, p);
    const joint = this.world.createImpulseJoint(
      this.R.JointData.fixed(localA, { x: 0, y: 0, z: 0, w: 1 }, localB, { x: 0, y: 0, z: 0, w: 1 }),
      a.body, b.body, true
    );
    a.joints.push(joint);
    b.joints.push(joint);
    a.data.partner = b;
    b.data.partner = a;
    return joint;
  }

  rope(a, b, length, worldPointA, worldPointB) {
    if (!a || !b || a === b) return null;
    const ta = a.body.translation();
    const tb = b.body.translation();
    const distance = new THREE.Vector3(ta.x - tb.x, ta.y - tb.y, ta.z - tb.z).length();
    const anchorA = this.localPoint(a.body, worldPointA || V(ta.x, ta.y, ta.z));
    const anchorB = this.localPoint(b.body, worldPointB || V(tb.x, tb.y, tb.z));
    const joint = this.world.createImpulseJoint(
      this.R.JointData.rope(Math.max(1, length ?? distance), anchorA, anchorB),
      a.body, b.body, true
    );
    a.joints.push(joint);
    b.joints.push(joint);
    return joint;
  }

  hinge(a, b, axis = V(0, 1, 0)) {
    if (!a || !b || a === b) return null;
    const ta = a.body.translation();
    const tb = b.body.translation();
    const mid = V((ta.x + tb.x) / 2, (ta.y + tb.y) / 2, (ta.z + tb.z) / 2);
    const localA = this.localPoint(a.body, mid);
    const localB = this.localPoint(b.body, mid);
    const joint = this.world.createImpulseJoint(
      this.R.JointData.revolute(localA, localB, { x: axis.x, y: axis.y, z: axis.z }),
      a.body, b.body, true
    );
    a.joints.push(joint);
    b.joints.push(joint);
    return joint;
  }

  clearJoints(entity) {
    if (!entity) return;
    for (const joint of entity.joints.splice(0)) {
      try { this.world.removeImpulseJoint(joint, true); } catch (error) { /* gone */ }
    }
  }

  jointBetween(a, b) {
    return a.joints.find((joint) => b.joints.includes(joint)) || null;
  }

  // -------------------------------------------------------------------------
  // Stepping and contact reporting
  // -------------------------------------------------------------------------
  step(dt, onContact) {
    this.accum += Math.min(dt, 0.1);
    const hz = this.quality?.physicsHz ?? 60;
    const fixed = 1 / hz;
    this.world.timestep = fixed;
    let steps = 0;
    const maxSteps = hz >= 60 ? 3 : 2;
    while (this.accum >= fixed && steps < maxSteps) {
      for (const entity of this.entities) {
        if (entity.dead || entity.frozen) continue;
        const v = entity.body.linvel();
        entity.lastSpeed = Math.hypot(v.x, v.y, v.z);
      }
      this.world.step(this.events);
      this.stepCount++;
      steps++;
      this.accum -= fixed;
      if (onContact) {
        this.events.drainCollisionEvents((h1, h2, started) => {
          if (!started) return;
          const a = this.byCollider.get(h1);
          const b = this.byCollider.get(h2);
          if (!a || !b) return;
          const speed = Math.max(a.lastSpeed || 0, b.lastSpeed || 0);
          if (speed > 3.5) onContact(a, b, speed);
        });
      }
    }
    if (steps === maxSteps) this.accum = 0;
    this.lastStep = dt;
  }
}

export { V, tempQ };
