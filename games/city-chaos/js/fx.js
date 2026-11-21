// ---------------------------------------------------------------------------
// Effects: instanced debris with real rigid bodies, two particle systems
// (smoke and additive sparks), explosion shockwaves and camera shake.
// ---------------------------------------------------------------------------
import * as THREE from 'three';
import { createLightPool } from './core.js';
import { clamp } from './core.js';

const particleVertex = `
attribute float aSize;
attribute float aAlpha;
attribute vec3 aColor;
varying float vAlpha;
varying vec3 vColor;
void main() {
  vAlpha = aAlpha;
  vColor = aColor;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = aSize * (360.0 / max(1.0, -mv.z));
  gl_Position = projectionMatrix * mv;
}`;

const particleFragment = `
varying float vAlpha;
varying vec3 vColor;
void main() {
  vec2 d = gl_PointCoord - vec2(0.5);
  float r = length(d);
  if (r > 0.5) discard;
  float a = smoothstep(0.5, 0.12, r) * vAlpha;
  gl_FragColor = vec4(vColor, a);
}`;

class ParticleSystem {
  constructor(scene, capacity, blending, depthWrite = false) {
    this.capacity = capacity;
    this.cursor = 0;
    this.positions = new Float32Array(capacity * 3);
    this.colors = new Float32Array(capacity * 3);
    this.sizes = new Float32Array(capacity);
    this.alphas = new Float32Array(capacity);
    this.velocities = new Float32Array(capacity * 3);
    this.life = new Float32Array(capacity);
    this.maxLife = new Float32Array(capacity);
    this.drag = new Float32Array(capacity);
    this.gravity = new Float32Array(capacity);
    this.grow = new Float32Array(capacity);

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    geometry.setAttribute('aColor', new THREE.BufferAttribute(this.colors, 3));
    geometry.setAttribute('aSize', new THREE.BufferAttribute(this.sizes, 1));
    geometry.setAttribute('aAlpha', new THREE.BufferAttribute(this.alphas, 1));
    const material = new THREE.ShaderMaterial({
      vertexShader: particleVertex,
      fragmentShader: particleFragment,
      transparent: true,
      depthWrite,
      blending,
    });
    this.points = new THREE.Points(geometry, material);
    this.points.frustumCulled = false;
    scene.add(this.points);
    this.geometry = geometry;
  }

  emit({ position, velocity = { x: 0, y: 0, z: 0 }, color = 0xffffff, size = 0.4, life = 1, drag = 1.4, gravity = -1, grow = 0.6 }) {
    const index = this.cursor;
    this.cursor = (this.cursor + 1) % this.capacity;
    const i3 = index * 3;
    this.positions[i3] = position.x;
    this.positions[i3 + 1] = position.y;
    this.positions[i3 + 2] = position.z;
    this.velocities[i3] = velocity.x;
    this.velocities[i3 + 1] = velocity.y;
    this.velocities[i3 + 2] = velocity.z;
    const c = new THREE.Color(color);
    this.colors[i3] = c.r;
    this.colors[i3 + 1] = c.g;
    this.colors[i3 + 2] = c.b;
    this.sizes[index] = size;
    this.alphas[index] = 1;
    this.life[index] = life;
    this.maxLife[index] = life;
    this.drag[index] = drag;
    this.gravity[index] = gravity;
    this.grow[index] = grow;
  }

  update(dt) {
    for (let i = 0; i < this.capacity; i++) {
      if (this.life[i] <= 0) continue;
      this.life[i] -= dt;
      if (this.life[i] <= 0) {
        this.alphas[i] = 0;
        continue;
      }
      const i3 = i * 3;
      const dragFactor = Math.max(0, 1 - this.drag[i] * dt);
      this.velocities[i3] *= dragFactor;
      this.velocities[i3 + 1] = this.velocities[i3 + 1] * dragFactor + this.gravity[i] * dt;
      this.velocities[i3 + 2] *= dragFactor;
      this.positions[i3] += this.velocities[i3] * dt;
      this.positions[i3 + 1] += this.velocities[i3 + 1] * dt;
      this.positions[i3 + 2] += this.velocities[i3 + 2] * dt;
      const fade = clamp(this.life[i] / this.maxLife[i], 0, 1);
      this.alphas[i] = fade;
      this.sizes[i] += this.grow[i] * dt;
    }
    this.geometry.attributes.position.needsUpdate = true;
    this.geometry.attributes.aColor.needsUpdate = true;
    this.geometry.attributes.aSize.needsUpdate = true;
    this.geometry.attributes.aAlpha.needsUpdate = true;
  }
}

export class FX {
  constructor({ scene, physics, quality }) {
    this.scene = scene;
    this.physics = physics;
    this.quality = quality;
    this.listener = new THREE.Vector3();
    this.shake = 0;
    this.shakeDecay = 3.4;
    this.lights = createLightPool(scene, 4);
    this.smokeParticles = new ParticleSystem(scene, 700, THREE.NormalBlending, false);
    this.sparkParticles = new ParticleSystem(scene, 700, THREE.AdditiveBlending, false);
    this.time = 0;

    // instanced debris
    this.capacity = quality?.debris ?? 150;
    this.debrisGeometry = new THREE.BoxGeometry(1, 1, 1);
    const material = new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true });
    this.debrisMesh = new THREE.InstancedMesh(this.debrisGeometry, material, this.capacity);
    this.debrisMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.debrisMesh.castShadow = true;
    this.debrisMesh.receiveShadow = true;
    this.debrisMesh.frustumCulled = false;
    scene.add(this.debrisMesh);
    this.debrisSlots = new Array(this.capacity).fill(null);
    this.debrisCursor = 0;
    this.debrisCount = 0;
    this.tmpMatrix = new THREE.Matrix4();
    this.tmpQuat = new THREE.Quaternion();
    this.tmpScale = new THREE.Vector3();
    this.tmpPos = new THREE.Vector3();
    const zero = new THREE.Matrix4().makeScale(0, 0, 0);
    for (let i = 0; i < this.capacity; i++) this.debrisMesh.setMatrixAt(i, zero);
    this.debrisMesh.instanceMatrix.needsUpdate = true;

    // expanding shockwave spheres
    this.rings = [];
    for (let i = 0; i < 5; i++) {
      const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(1, 16, 12),
        new THREE.MeshBasicMaterial({ color: 0xffc27a, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false })
      );
      mesh.visible = false;
      scene.add(mesh);
      this.rings.push({ mesh, life: 0, max: 1, radius: 1 });
    }

    // simple rope visuals for anchored props
    this.ropes = [];
  }

  setQuality(quality) {
    this.quality = quality;
  }

  setListener(position) {
    this.listener.copy(position);
  }

  // -------------------------------------------------------------------------
  // Debris
  // -------------------------------------------------------------------------
  debris(position, velocity, size = 0.4, color = 0x9a9a94, life = 6, dims = null) {
    const w = dims?.w ?? size;
    const h = dims?.h ?? size;
    const d = dims?.d ?? size;
    let slot = -1;
    for (let i = 0; i < this.capacity; i++) {
      const index = (this.debrisCursor + i) % this.capacity;
      if (!this.debrisSlots[index]) { slot = index; break; }
    }
    if (slot === -1) {
      slot = this.debrisCursor;
      const existing = this.debrisSlots[slot];
      if (existing && !existing.entity.dead) this.physics.remove(existing.entity, { silent: true });
    }
    this.debrisCursor = (slot + 1) % this.capacity;

    const mass = clamp(w * h * d * 220, 0.5, 45);
    const entity = this.physics.create({
      mesh: null, shape: 'box', size: [w, h, d], mass,
      position: [position.x, position.y, position.z], kind: 'debris', name: 'Debris',
      friction: 0.85, restitution: 0.16, damageable: false,
      linearDamping: 0.04, angularDamping: 0.18,
    });
    entity.body.setLinvel({ x: velocity.x, y: velocity.y, z: velocity.z }, true);
    entity.body.setAngvel({
      x: (Math.random() - 0.5) * 9, y: (Math.random() - 0.5) * 9, z: (Math.random() - 0.5) * 9,
    }, true);
    const record = { entity, slot, life, max: life, color: new THREE.Color(color), dims: [w, h, d] };
    this.debrisSlots[slot] = record;
    this.debrisMesh.setColorAt(slot, record.color);
    if (this.debrisMesh.instanceColor) this.debrisMesh.instanceColor.needsUpdate = true;
    this.debrisCount++;
    return entity;
  }

  removeDebrisRecord(record) {
    if (!record) return;
    if (record.entity && !record.entity.dead) this.physics.remove(record.entity, { silent: true });
    this.debrisMesh.setMatrixAt(record.slot, this.tmpMatrix.makeScale(0, 0, 0));
    this.debrisSlots[record.slot] = null;
    this.debrisCount = Math.max(0, this.debrisCount - 1);
    this.debrisMesh.instanceMatrix.needsUpdate = true;
  }

  clearDebris() {
    for (const record of this.debrisSlots) if (record) this.removeDebrisRecord(record);
  }

  // -------------------------------------------------------------------------
  // Particles
  // -------------------------------------------------------------------------
  dust(position, count = 10, strength = 2) {
    for (let i = 0; i < count; i++) {
      this.smokeParticles.emit({
        position: { x: position.x + (Math.random() - 0.5) * strength, y: position.y + Math.random() * strength * 0.5, z: position.z + (Math.random() - 0.5) * strength },
        velocity: { x: (Math.random() - 0.5) * strength * 1.6, y: 0.6 + Math.random() * strength * 0.6, z: (Math.random() - 0.5) * strength * 1.6 },
        color: 0xb9b2a4,
        size: 0.9 + Math.random() * strength * 0.8,
        life: 1.1 + Math.random() * 1.4,
        drag: 1.6, gravity: -0.2, grow: 1.4,
      });
    }
  }

  smoke(position, strength = 0.4) {
    this.smokeParticles.emit({
      position: { x: position.x + (Math.random() - 0.5) * 0.4, y: position.y, z: position.z + (Math.random() - 0.5) * 0.4 },
      velocity: { x: (Math.random() - 0.5) * 0.6, y: 0.7 + Math.random() * 0.7, z: (Math.random() - 0.5) * 0.6 },
      color: 0x4a4a48,
      size: 0.5 + strength,
      life: 1.4 + Math.random(),
      drag: 1.2, gravity: 0.2, grow: 1.1,
    });
  }

  spark(position, normal = new THREE.Vector3(0, 1, 0), count = 6, color = 0xffb060) {
    for (let i = 0; i < count; i++) {
      this.sparkParticles.emit({
        position: { x: position.x, y: position.y, z: position.z },
        velocity: {
          x: normal.x * 2 + (Math.random() - 0.5) * 7,
          y: normal.y * 2 + Math.random() * 6,
          z: normal.z * 2 + (Math.random() - 0.5) * 7,
        },
        color,
        size: 0.16 + Math.random() * 0.18,
        life: 0.35 + Math.random() * 0.5,
        drag: 0.6, gravity: -12, grow: -0.05,
      });
    }
  }

  // -------------------------------------------------------------------------
  // Explosions
  // -------------------------------------------------------------------------
  explosion(position, power = 1, source = null) {
    const radius = 8.5 * power;
    this.lights.flash(position, 0xffae5e, 40 * power, 0.5);
    this.shakeAt(position, 0.9 * power, 34);
    this.dust(position, 22, 3.4 * power);

    for (let i = 0; i < 26 * power; i++) {
      this.sparkParticles.emit({
        position: { x: position.x, y: position.y + 0.4, z: position.z },
        velocity: {
          x: (Math.random() - 0.5) * 16 * power,
          y: Math.random() * 12 * power,
          z: (Math.random() - 0.5) * 16 * power,
        },
        color: Math.random() > 0.4 ? 0xffc46a : 0xff7a3d,
        size: 0.3 + Math.random() * 0.4,
        life: 0.4 + Math.random() * 0.7,
        drag: 0.4, gravity: -9, grow: 0.4,
      });
    }

    const ring = this.rings.find((entry) => entry.life <= 0) || this.rings[0];
    ring.life = 0.5;
    ring.max = 0.5;
    ring.radius = 1.4 * power;
    ring.mesh.position.copy(position);
    ring.mesh.scale.setScalar(1);
    ring.mesh.material.opacity = 0.55;
    ring.mesh.material.color.setHex(0xffc27a);
    ring.mesh.visible = true;

    for (let i = 0; i < 10 * power; i++) {
      this.debris(
        new THREE.Vector3(position.x + (Math.random() - 0.5) * 2, position.y + Math.random(), position.z + (Math.random() - 0.5) * 2),
        new THREE.Vector3((Math.random() - 0.5) * 14 * power, 3 + Math.random() * 10 * power, (Math.random() - 0.5) * 14 * power),
        0.2 + Math.random() * 0.4, 0x3a3a36, 4.5
      );
    }

    // knockback and damage in the blast radius
    for (const entity of this.physics.entities) {
      if (entity === source || entity.dead) continue;
      if (entity.kind === 'world' || entity.kind === 'anchor' || entity.kind === 'scenery') continue;
      const t = entity.body.translation();
      const dx = t.x - position.x;
      const dy = t.y - position.y;
      const dz = t.z - position.z;
      const distance = Math.hypot(dx, dy, dz);
      if (distance > radius) continue;
      const falloff = 1 - distance / radius;
      const norm = Math.max(0.6, distance);
      if (!entity.frozen) {
        const impulse = entity.mass * 11 * power * falloff;
        entity.body.applyImpulse({
          x: (dx / norm) * impulse,
          y: (dy / norm + 0.55) * impulse,
          z: (dz / norm) * impulse,
        }, true);
        entity.body.wakeUp();
      }
      this.physics.damage(entity, 150 * power * falloff, new THREE.Vector3(t.x, t.y, t.z));
    }
  }

  fireworkShow(position, count = 8) {
    this.queue = this.queue || [];
    for (let i = 0; i < count; i++) {
      this.queue.push({
        at: this.time + i * 0.22,
        position: new THREE.Vector3(
          position.x + (Math.random() - 0.5) * 10,
          position.y + 9 + Math.random() * 12,
          position.z + (Math.random() - 0.5) * 10
        ),
        color: [0xffcf6a, 0x79e0d2, 0xff8f8f, 0xa0b8ff][i % 4],
      });
    }
  }

  burst(position, color) {
    this.lights.flash(position, color, 18, 0.35);
    for (let i = 0; i < 40; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const speed = 6 + Math.random() * 7;
      this.sparkParticles.emit({
        position: { x: position.x, y: position.y, z: position.z },
        velocity: {
          x: Math.sin(phi) * Math.cos(theta) * speed,
          y: Math.cos(phi) * speed,
          z: Math.sin(phi) * Math.sin(theta) * speed,
        },
        color,
        size: 0.22 + Math.random() * 0.26,
        life: 0.9 + Math.random() * 0.8,
        drag: 0.55, gravity: -4.5, grow: 0.05,
      });
    }
  }

  shockwave(position, power = 1) {
    const ring = this.rings.find((entry) => entry.life <= 0) || this.rings[0];
    ring.life = 0.45;
    ring.max = 0.45;
    ring.radius = 1.2 * power;
    ring.mesh.position.copy(position);
  }

  rope(a, b) {
    const geometry = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
    const mesh = new THREE.Line(geometry, new THREE.LineBasicMaterial({ color: 0x3a4246 }));
    mesh.frustumCulled = false;
    this.scene.add(mesh);
    this.ropes.push({ a, b, mesh });
  }

  ribbon(a, b) {
    this.rope({ body: { translation: () => ({ x: a.x, y: a.y, z: a.z }) } }, { body: { translation: () => ({ x: b.x, y: b.y, z: b.z }) } });
  }

  shakeAt(position, amount, radius = 24) {
    const distance = this.listener.distanceTo(position);
    const falloff = clamp(1 - distance / radius, 0, 1);
    this.shake = Math.min(1.4, this.shake + amount * falloff);
  }

  addShake(amount) {
    this.shake = Math.min(1.4, this.shake + amount);
  }

  shakeOffset(dt) {
    this.shake = Math.max(0, this.shake - this.shakeDecay * dt * (0.4 + this.shake));
    const intensity = this.shake * 0.42;
    return {
      x: (Math.random() - 0.5) * intensity,
      y: (Math.random() - 0.5) * intensity,
      z: (Math.random() - 0.5) * intensity,
    };
  }

  // -------------------------------------------------------------------------
  update(dt) {
    this.time += dt;

    // debris lifetimes and transforms
    for (let i = 0; i < this.capacity; i++) {
      const record = this.debrisSlots[i];
      if (!record) continue;
      record.life -= dt;
      const t = record.entity.body.translation();
      if (record.life <= 0 || t.y < -6 || record.entity.dead) {
        this.removeDebrisRecord(record);
        continue;
      }
      const q = record.entity.body.rotation();
      this.tmpPos.set(t.x, t.y, t.z);
      this.tmpQuat.set(q.x, q.y, q.z, q.w);
      this.tmpScale.set(record.dims[0], record.dims[1], record.dims[2]);
      this.tmpMatrix.compose(this.tmpPos, this.tmpQuat, this.tmpScale);
      this.debrisMesh.setMatrixAt(i, this.tmpMatrix);
      this.debrisMesh.setColorAt(i, record.color);
    }
    this.debrisMesh.instanceMatrix.needsUpdate = true;
    if (this.debrisMesh.instanceColor) this.debrisMesh.instanceColor.needsUpdate = true;

    this.smokeParticles.update(dt);
    this.sparkParticles.update(dt);
    this.lights.update();

    // shockwave rings
    for (const ring of this.rings) {
      if (ring.life <= 0) continue;
      ring.life -= dt;
      const progress = 1 - clamp(ring.life / ring.max, 0, 1);
      ring.mesh.scale.setScalar(ring.radius + progress * ring.radius * 9);
      ring.mesh.material.opacity = (1 - progress) * 0.5;
      if (ring.life <= 0) ring.mesh.visible = false;
    }

    // delayed firework bursts
    if (this.queue && this.queue.length) {
      for (let i = this.queue.length - 1; i >= 0; i--) {
        if (this.time >= this.queue[i].at) {
          const job = this.queue.splice(i, 1)[0];
          this.burst(job.position, job.color);
        }
      }
    }

    // rope lines
    for (let i = this.ropes.length - 1; i >= 0; i--) {
      const { a, b, mesh } = this.ropes[i];
      if (!a || !b || (a.dead && a.kind) || (b.dead && b.kind)) {
        this.scene.remove(mesh);
        mesh.geometry.dispose();
        this.ropes.splice(i, 1);
        continue;
      }
      const pa = a.body.translation();
      const pb = b.body.translation();
      const positions = mesh.geometry.attributes.position.array;
      positions[0] = pa.x; positions[1] = pa.y + 0.4; positions[2] = pa.z;
      positions[3] = pb.x; positions[4] = pb.y; positions[5] = pb.z;
      mesh.geometry.attributes.position.needsUpdate = true;
    }
  }

  fadeColor(record, fade) {
    return record.color;
  }
}
