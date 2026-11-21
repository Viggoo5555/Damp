// ---------------------------------------------------------------------------
// The tool belt: grab, weld, rope, hinge, rotate, scale, freeze, repair,
// delete and the free camera. Everything acts through the physics layer, so
// a welded tower, a roped trailer and a frozen bridge all behave for real.
// ---------------------------------------------------------------------------
import * as THREE from 'three';
import { clamp } from './core.js';
import { TOOLS } from './config.js';

const NO_TOOL = new Set(['world', 'scenery', 'anchor']);

export class Tools {
  constructor(game) {
    this.game = game;
    this.current = 'grab';
    this.hover = null;
    this.selected = null;
    this.linkFirst = null;
    this.grabbed = null;
    this.holdDistance = 3.8;
    this.pointerDown = false;

    this.box = new THREE.BoxHelper(new THREE.Object3D(), 0xe9b44c);
    this.box.material.depthTest = false;
    this.box.material.transparent = true;
    this.box.material.opacity = 0.9;
    this.box.renderOrder = 999;
    this.box.visible = false;
    game.scene.add(this.box);

    this.aimDirection = new THREE.Vector3(0, 0, -1);
    this.aimPoint = new THREE.Vector3();
    this.tmp = new THREE.Vector3();
  }

  setTool(id) {
    if (!TOOLS.some((tool) => tool.id === id)) return;
    if (this.current === id) {
      this.game.ui?.renderToolbar(id);
      return;
    }
    this.release();
    this.selected = null;
    this.linkFirst = null;
    this.current = id;

    const player = this.game.player;
    if (id === 'camera') {
      player.freeCam = true;
      player.freePos.copy(this.game.camera.position);
      this.game.ui?.setMode('Free camera');
    } else if (player.freeCam) {
      player.freeCam = false;
      player.camInitialised = false;
      this.game.ui?.setMode(player.mode === 'vehicle' ? 'Driving' : 'Sandbox');
      this.game.audio?.startEngineIfDriving?.();
    }

    const tool = TOOLS.find((entry) => entry.id === id);
    this.game.ui?.renderToolbar(id);
    this.game.ui?.setContext(tool);
    this.game.ui?.setHints(tool.hints);
    this.game.audio?.ui();
  }

  aim(maxDistance = 140) {
    const camera = this.game.camera;
    const direction = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
    const hit = this.game.physics.raycast(camera.position, direction, maxDistance, this.game.player.entity?.body, null);
    this.aimDirection.copy(direction);
    if (hit) this.aimPoint.copy(hit.point);
    return hit;
  }

  usable(hit) {
    if (!hit || !hit.entity) return null;
    if (NO_TOOL.has(hit.entity.kind)) return null;
    if (hit.entity.dead) return null;
    return hit.entity;
  }

  // -------------------------------------------------------------------------
  // Mouse
  // -------------------------------------------------------------------------
  primaryDown() {
    this.pointerDown = true;
    const hit = this.aim();
    const entity = this.usable(hit);
    switch (this.current) {
      case 'grab': return this.startGrab(entity, hit);
      case 'weld': return this.pickSecond(entity, 'weld');
      case 'rope': return this.pickSecond(entity, 'rope');
      case 'hinge': return this.pickSecond(entity, 'hinge');
      case 'rotate': return this.select(entity, 'Rotate with the wheel. Shift snaps to 15°.');
      case 'scale': return this.select(entity, 'Scale with the wheel. Shift for bigger steps.');
      case 'freeze': return this.toggleFreeze(entity);
      case 'repair': return this.repair(entity);
      case 'delete': return this.deleteEntity(entity, hit);
      default: return null;
    }
  }

  primaryUp() {
    this.pointerDown = false;
    if (this.current === 'grab' && this.grabbed) this.release();
  }

  secondaryDown() {
    if (this.current === 'grab' && this.grabbed) this.throwGrabbed();
    else if (this.current === 'rotate' && this.selected) this.rotateSelected(Math.PI / 4);
  }

  wheel(delta, shift) {
    const step = delta > 0 ? 1 : -1;
    if (this.current === 'grab' && this.grabbed) {
      this.holdDistance = clamp(this.holdDistance + step * 0.55, 1.8, 12);
      return;
    }
    if (this.current === 'rotate' && this.selected) {
      this.rotateSelected(step * (shift ? Math.PI / 12 : Math.PI / 36));
      return;
    }
    if (this.current === 'scale' && this.selected) {
      this.scaleSelected(step, shift);
      return;
    }
    this.game.player.distance = clamp(this.game.player.distance + step * 0.5, 2.4, 11);
  }

  keyRotate() {
    if (this.grabbed) this.rotateSelected(Math.PI / 4, this.grabbed);
    else if (this.selected) this.rotateSelected(Math.PI / 8);
  }

  // -------------------------------------------------------------------------
  // Grab
  // -------------------------------------------------------------------------
  startGrab(entity, hit) {
    if (!entity) return;
    if (entity.kind === 'building') {
      this.game.ui?.toast('Buildings are far too heavy to carry. Try the welder, or a car.', 'bad');
      return;
    }
    if (entity.vehicle?.occupied) return;
    if (!['prop', 'vehicle', 'debris', 'npc', 'ragdoll'].includes(entity.kind)) return;
    this.grabbed = entity;
    this.holdDistance = clamp(hit?.distance ?? 3.8, 1.8, 10);
    entity.body.wakeUp();
    this.game.audio?.pop(hit?.point || entity.body.translation(), 0.2);
    this.game.ui?.setPrompt('Hold <kbd>LMB</kbd> to carry · <kbd>R</kbd> rotate · <kbd>RMB</kbd> throw');
  }

  release() {
    if (!this.grabbed) return;
    this.grabbed = null;
    this.game.ui?.setPrompt('');
  }

  throwGrabbed() {
    if (!this.grabbed) return;
    const body = this.grabbed.body;
    const mass = Math.max(1, body.mass());
    const direction = this.aimDirection;
    body.applyImpulse({
      x: direction.x * mass * 11,
      y: direction.y * mass * 11 + mass * 2.2,
      z: direction.z * mass * 11,
    }, true);
    this.game.audio?.impact(body.translation(), 0.3, 'wood');
    this.release();
  }

  carry(dt) {
    if (!this.grabbed) return;
    if (this.grabbed.dead) {
      this.release();
      return;
    }
    const body = this.grabbed.body;
    const camera = this.game.camera;
    const target = this.tmp.copy(camera.position).addScaledVector(this.aimDirection, this.holdDistance);
    const t = body.translation();
    const v = body.linvel();
    const dx = target.x - t.x;
    const dy = target.y - t.y;
    const dz = target.z - t.z;
    const distance = Math.hypot(dx, dy, dz);
    if (distance > 9) {
      this.release();
      return;
    }
    const mass = Math.max(1, body.mass());
    const k = 26;
    const damp = 7;
    let ix = (dx * k - v.x * damp) * mass * dt;
    let iy = (dy * k - v.y * damp) * mass * dt;
    let iz = (dz * k - v.z * damp) * mass * dt;
    const max = mass * 45 * dt;
    const length = Math.hypot(ix, iy, iz);
    if (length > max) {
      const scale = max / length;
      ix *= scale; iy *= scale; iz *= scale;
    }
    body.applyImpulse({ x: ix, y: iy, z: iz }, true);
    body.wakeUp();
    // slow the spin so carried objects read clearly
    const av = body.angvel();
    body.setAngvel({ x: av.x * 0.92, y: av.y * 0.92, z: av.z * 0.92 }, true);
  }

  // -------------------------------------------------------------------------
  // Joint tools
  // -------------------------------------------------------------------------
  pickSecond(entity, mode) {
    if (!entity) return;
    if (entity.kind === 'building') {
      this.game.ui?.toast('That is part of a building. Pick a prop, vehicle or piece you spawned.', 'bad');
      return;
    }
    if (!this.linkFirst || this.linkFirst.dead) {
      this.linkFirst = entity;
      this.selected = entity;
      const names = { weld: 'welder', rope: 'rope', hinge: 'hinge' };
      this.game.ui?.toast(`First piece set for the ${names[mode]}. Click the second.`, 'good');
      return;
    }
    if (this.linkFirst === entity) {
      this.linkFirst = null;
      this.game.ui?.toast('Pick a different second object.', 'bad');
      return;
    }
    const a = this.linkFirst;
    const b = entity;
    const mid = new THREE.Vector3(
      (a.body.translation().x + b.body.translation().x) / 2,
      (a.body.translation().y + b.body.translation().y) / 2,
      (a.body.translation().z + b.body.translation().z) / 2
    );
    if (mode === 'weld') {
      this.game.physics.weld(a, b, mid);
      this.game.ui?.toast('Welded. They move as one now.', 'good');
    } else if (mode === 'rope') {
      const distance = Math.hypot(
        a.body.translation().x - b.body.translation().x,
        a.body.translation().y - b.body.translation().y,
        a.body.translation().z - b.body.translation().z
      );
      this.game.physics.rope(a, b, Math.max(1, distance));
      this.game.fx.rope(a, b);
      this.game.ui?.toast('Roped together.', 'good');
    } else {
      this.game.physics.hinge(a, b, new THREE.Vector3(0, 1, 0));
      this.game.ui?.toast('Hinged. It should swing freely.', 'good');
    }
    this.game.audio?.pop(mid, 0.4);
    this.linkFirst = null;
  }

  // -------------------------------------------------------------------------
  // Single-object tools
  // -------------------------------------------------------------------------
  select(entity, hint) {
    if (!entity) {
      this.selected = null;
      return;
    }
    this.selected = entity;
    if (hint) this.game.ui?.toast(hint);
    this.game.audio?.ui();
  }

  rotateSelected(angle, entity = this.selected) {
    if (!entity || entity.dead) return;
    if (entity.kind === 'building' || entity.kind === 'npc' || entity.kind === 'player') {
      this.game.ui?.toast('That object cannot be turned.', 'bad');
      return;
    }
    const r = entity.body.rotation();
    const quat = new THREE.Quaternion(r.x, r.y, r.z, r.w);
    const spin = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), angle);
    quat.multiply(spin);
    entity.body.setRotation({ x: quat.x, y: quat.y, z: quat.z, w: quat.w }, true);
    entity.body.wakeUp();
  }

  scaleSelected(direction, big) {
    const entity = this.selected;
    if (!entity || entity.dead) return;
    if (!['prop', 'debris', 'ragdoll'].includes(entity.kind)) {
      this.game.ui?.toast('Only props and debris can be resized.', 'bad');
      return;
    }
    const current = entity.visualScale || 1;
    const step = big ? 0.3 : 0.12;
    const next = clamp(current + direction * step, 0.35, 3.2);
    if (Math.abs(next - current) < 0.01) return;
    this.game.physics.resize(entity, next);
    this.game.ui?.toast(`Scale ${next.toFixed(2)}×`);
  }

  toggleFreeze(entity) {
    if (!entity) return;
    if (entity.kind === 'building') {
      this.game.ui?.toast('Buildings are already fixed in place.', 'bad');
      return;
    }
    if (entity.kind === 'player' || entity.kind === 'npc') return;
    const frozen = !entity.frozen;
    this.game.physics.freeze(entity, frozen);
    this.game.ui?.toast(frozen ? `${entity.name} frozen` : `${entity.name} released`, 'good');
    this.game.audio?.pop(entity.body.translation(), 0.3);
  }

  repair(entity) {
    if (!entity) return;
    if (entity.kind === 'building' && entity.building) {
      this.game.city.repair(entity.building);
      this.game.ui?.toast(`${entity.building.name} restored`, 'good');
      this.game.audio?.pop(entity.body.translation(), 0.4);
      return;
    }
    if (entity.vehicle) {
      entity.vehicle.repair();
      this.game.ui?.toast(`${entity.vehicle.spec.name} repaired`, 'good');
      return;
    }
    if (entity.kind === 'prop' || entity.kind === 'debris') {
      this.game.physics.clearJoints(entity);
      this.game.physics.freeze(entity, false);
      entity.hp = entity.maxHp;
      const home = entity.home;
      entity.body.setTranslation({ x: home.position[0], y: home.position[1], z: home.position[2] }, true);
      if (home.rotation) entity.body.setRotation(home.rotation, true);
      entity.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
      entity.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
      if ((entity.visualScale || 1) !== 1) this.game.physics.resize(entity, 1);
      entity.body.wakeUp();
      this.game.ui?.toast(`${entity.name} repaired`, 'good');
      this.game.audio?.pop(entity.body.translation(), 0.3);
      return;
    }
    this.game.ui?.toast('Nothing to repair there.', 'bad');
  }

  deleteEntity(entity, hit) {
    if (!entity) return;
    if (entity.kind === 'building' && entity.building) {
      const building = entity.building;
      if (building.kindOf === 'tower') this.game.city.cascade(building);
      else this.game.city.collapseHouse(entity, hit?.point || entity.body.translation());
      this.game.ui?.toast(`${building.name} coming down`, 'bad');
      return;
    }
    if (entity.vehicle) {
      entity.vehicle.explode(hit?.point);
      return;
    }
    if (entity.kind === 'npc') {
      this.game.physics.remove(entity, { silent: true });
      this.game.ui?.toast('Pedestrian removed', 'good');
      return;
    }
    this.game.physics.remove(entity, { silent: true });
    if (this.selected === entity) this.selected = null;
    this.game.ui?.toast('Removed', 'good');
  }

  // -------------------------------------------------------------------------
  // Frame
  // -------------------------------------------------------------------------
  update(dt) {
    if (this.grabbed) this.carry(dt);
    const hit = this.aim();
    const entity = this.usable(hit);
    this.hover = entity;

    const highlighted = this.grabbed || this.selected || entity;
    if (highlighted && highlighted.mesh && !highlighted.dead) {
      this.box.setFromObject(highlighted.mesh);
      this.box.visible = true;
      this.box.material.color.setHex(this.selected ? 0xe9b44c : 0x6fd8d3);
    } else {
      this.box.visible = false;
    }

    this.game.ui?.setTarget(highlighted);
    this.game.ui?.setCrosshair(!!highlighted);
  }
}
