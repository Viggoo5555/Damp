/* =====================================================================
   TEXAS HOLD'EM — the people at the table
   Low-poly, faceted, fully skinned characters. Each seat has a complete
   bone chain with articulated fingers, an AnimationMixer for body mood,
   and procedural two-bone IK so hands find the real cards and chips.
   ===================================================================== */

import * as THREE from 'three';
import { buildCharacterModel, buildPlayerHandsModel } from './body.js';
import { accessoryMaterial } from './lowpoly.js';

export const CHARACTER_LOOKS = [
  {
    name: 'Vincent',
    skin: '#8d5f43', skinShade: '#70482f', jacket: '#20242b', shirt: '#ded6c6',
    accent: '#70603f', trousers: '#191b20', boots: '#0e0f12', belt: '#1a1410',
    hair: '#918d83', hairStyle: 'silver', tie: '#4e3823', eyes: '#4b3c2e',
    tieStyle: 'tie', pocket: true, pocketSquare: true, cufflink: true, beard: true, beardColour: '#3a2e26', sunglasses: true,
    hat: true, hatColour: '#27262a', bandColour: '#7d6438'
  },
  {
    name: 'Marisol',
    skin: '#b77a58', skinShade: '#97603f', jacket: '#56212b', shirt: '#f1e8da',
    accent: '#c39d5d', trousers: '#2c1b1d', boots: '#1b1113', belt: '#241512',
    hair: '#241a16', hairStyle: 'bun', tie: '#c39d5d', eyes: '#2c1e18',
    tieStyle: 'none', earrings: true, gold: '#c39d5d'
  },
  {
    name: 'Ellis',
    skin: '#cfa17d', skinShade: '#ae8060', jacket: '#3b3b2e', shirt: '#e8e0cf',
    accent: '#7f2d2b', trousers: '#2b2b22', boots: '#1c1a16', belt: '#2a2118',
    hair: '#66594a', hairStyle: 'short', tie: '#7f2d2b', eyes: '#3c4b5b',
    tieStyle: 'bow', glasses: true
  },
  {
    name: 'Nadia',
    skin: '#e2bb98', skinShade: '#c49a77', jacket: '#141a22', shirt: '#f0e9dd',
    accent: '#a4adb7', trousers: '#10141a', boots: '#0b0d10', belt: '#171a1e',
    hair: '#12100f', hairStyle: 'bob', tie: '#262f3a', eyes: '#191c22',
    tieStyle: 'none', sunglasses: true
  },
  {
    name: 'Big Sal',
    skin: '#c18860', skinShade: '#9f6a45', jacket: '#5d442c', shirt: '#e3d3ab',
    accent: '#892b21', trousers: '#3a3126', boots: '#3b2a1c', belt: '#3a2a18',
    hair: '#2b211a', hairStyle: 'short', tie: '#892b21', eyes: '#3b2c20',
    tieStyle: 'none', beard: true, hat: true, hatColour: '#b59a6b', bandColour: '#3c2a1a',
    sleeve: '#d8c79f', vest: true
  },
  {
    name: 'June',
    skin: '#d7a07b', skinShade: '#b8805c', jacket: '#213d34', shirt: '#f0e6d4',
    accent: '#a67c3c', trousers: '#1a2923', boots: '#141d19', belt: '#231c14',
    hair: '#6e291a', hairStyle: 'long', tie: '#a67c3c', eyes: '#2c1d17',
    tieStyle: 'none', earrings: true, gold: '#a67c3c'
  }
];

export const PLAYER_LOOK = {
  skin: '#8f6047', skinShade: '#6b4430', jacket: '#2b313a', shirt: '#a99b86',
  accent: '#8d744c', trousers: '#151a21', boots: '#0d0f12', belt: '#16110d',
  hair: '#2a211a', hairStyle: 'short', tieStyle: 'none', eyes: '#2b2019'
};

const DEALER_LOOK = {
  skin: '#9a6b4c', skinShade: '#7c5239', jacket: '#1b1e24', shirt: '#efe8da',
  accent: '#b08b52', trousers: '#141518', boots: '#0a0b0c', belt: '#0f1012',
  hair: '#2a211a', hairStyle: 'short', tieStyle: 'bow', tie: '#b08b52',
  eyes: '#33261c', gold: '#b08b52', beard: true, beardColour: '#2b211b'
};

export const HOLD_LOCAL = new THREE.Vector3(0, 1.03, 0.33);

const REST_L = new THREE.Vector3(-0.16, 0.825, 0.52);
const REST_R = new THREE.Vector3(0.16, 0.825, 0.52);
const REST_DIR = new THREE.Vector3(0, -0.45, 1).normalize();
const UP_DIR = new THREE.Vector3(0, 0.92, 0.25).normalize();
const CHIN_DIR = new THREE.Vector3(0, 0.7, -0.2).normalize();

const ACTION_DURATIONS = {
  inspect: 3.1, bet: 2.0, check: 1.25, fold: 2.3, think: 3.2,
  win: 2.6, lose: 2.8, idle: 0.4, deal: 1.1
};

function smoothstep(value) {
  const t = Math.max(0, Math.min(1, value));
  return t * t * (3 - 2 * t);
}

function damp(current, target, dt, speed) {
  return current + (target - current) * (1 - Math.exp(-dt * speed));
}

function quatTrack(name, keys) {
  const times = [];
  const values = [];
  const euler = new THREE.Euler();
  const quaternion = new THREE.Quaternion();
  for (const [time, x, y, z] of keys) {
    times.push(time);
    euler.set(x, y, z, 'YXZ');
    quaternion.setFromEuler(euler);
    values.push(quaternion.x, quaternion.y, quaternion.z, quaternion.w);
  }
  return new THREE.QuaternionKeyframeTrack(`${name}.quaternion`, times, values);
}

function makeClip(name, duration, tracks, loop = true) {
  const clip = new THREE.AnimationClip(name, duration, tracks);
  clip.userData = { loop };
  return clip;
}

const MOOD_CLIPS = {
  idle: makeClip('idle', 8, [
    quatTrack('spine', [[0, 0.006, 0.005, 0.002], [2, 0.014, 0.01, 0.004], [4, 0.006, -0.004, 0.001], [6, -0.002, -0.008, -0.003], [8, 0.006, 0.005, 0.002]]),
    quatTrack('chest', [[0, 0.012, 0.01, -0.004], [2, 0.022, 0.02, -0.008], [4, 0.014, 0.0, -0.001], [6, 0.004, -0.015, 0.006], [8, 0.012, 0.01, -0.004]])
  ]),
  think: makeClip('think', 4.4, [
    quatTrack('spine', [[0, 0.026, 0.015, 0.002], [2.2, 0.038, 0.03, 0.006], [4.4, 0.026, 0.015, 0.002]]),
    quatTrack('chest', [[0, 0.05, 0.02, 0.003], [2.2, 0.066, 0.04, 0.008], [4.4, 0.05, 0.02, 0.003]])
  ]),
  folded: makeClip('folded', 6, [
    quatTrack('spine', [[0, -0.012, -0.01, -0.006], [3, -0.004, -0.02, -0.01], [6, -0.012, -0.01, -0.006]]),
    quatTrack('chest', [[0, 0.004, -0.02, -0.008], [3, 0.016, -0.035, -0.015], [6, 0.004, -0.02, -0.008]])
  ]),
  win: makeClip('win', 2.6, [
    quatTrack('spine', [[0, 0.01, 0, 0], [0.7, -0.06, 0.02, 0], [2.6, -0.045, 0.01, 0]]),
    quatTrack('chest', [[0, 0.012, 0, 0], [0.7, -0.15, 0.03, 0.01], [2.6, -0.11, 0.02, 0.005]])
  ], false),
  lose: makeClip('lose', 2.8, [
    quatTrack('spine', [[0, 0.01, 0, 0], [1.1, 0.1, 0.02, 0.01], [2.8, 0.12, 0.03, 0.015]]),
    quatTrack('chest', [[0, 0.012, 0, 0], [1.1, 0.16, 0.02, 0.01], [2.8, 0.18, 0.03, 0.015]])
  ], false)
};

function setRigMood(rig, mood) {
  if (!rig.actions || rig.currentMood === mood) return;
  const next = rig.actions[mood];
  if (!next) return;
  const previous = rig.actions[rig.currentMood];
  next.reset();
  next.enabled = true;
  next.setEffectiveTimeScale(1);
  next.setEffectiveWeight(1);
  next.play();
  if (previous && previous !== next) previous.crossFadeTo(next, mood === 'win' || mood === 'lose' ? 0.35 : 0.6, false);
  rig.currentMood = mood;
}

function attachMixer(rig, offset = 0) {
  const mixer = new THREE.AnimationMixer(rig.group);
  rig.mixer = mixer;
  rig.actions = {};
  for (const [name, clip] of Object.entries(MOOD_CLIPS)) {
    const action = mixer.clipAction(clip);
    if (name === 'win' || name === 'lose') {
      action.setLoop(THREE.LoopOnce, 1);
      action.clampWhenFinished = true;
    } else {
      action.setLoop(THREE.LoopRepeat, Infinity);
    }
    rig.actions[name] = action;
  }
  rig.currentMood = 'idle';
  rig.actions.idle.play();
  mixer.time = offset;
  return mixer;
}

function makePerformer(rig) {
  rig.perform = function perform(name, options = {}) {
    const duration = options.duration || ACTION_DURATIONS[name] || 1.8;
    this.action = {
      name,
      time: 0,
      duration,
      world: {
        chip: options.chip ? options.chip.clone() : null,
        bet: options.bet ? options.bet.clone() : null,
        card: options.card ? options.card.clone() : null,
        muck: options.muck ? options.muck.clone() : null
      }
    };
    return this.action;
  };
  rig.reset = function reset() {
    this.action = null;
    this.lookAtWorld = null;
    this.headYaw = 0;
    this.headPitch = 0;
    this.lean = 0;
    this.mood = 'idle';
    this.handCurrent = null;
    setRigMood(this, 'idle');
  };
  rig.getHoldPoint = function getHoldPoint(target = new THREE.Vector3()) {
    this.group.updateWorldMatrix(true, false);
    return this.group.localToWorld(target.copy(HOLD_LOCAL));
  };
  return rig;
}

/* ---------------- seated cast --------------------------------------- */

export function buildSeatedCharacter(look, index) {
  const model = buildCharacterModel(look, 'seated');
  const rig = {
    ...model,
    index,
    look,
    mood: 'idle',
    currentMood: 'idle',
    action: null,
    actionTime: 0,
    lookAtWorld: null,
    headYaw: 0,
    headPitch: 0,
    lean: 0,
    handCurrent: null,
    phase: Math.random() * Math.PI * 2,
    blinkAt: 1.5 + Math.random() * 3,
    blinkUntil: 0,
    glanceAt: 0,
    glanceYaw: 0,
    glancePitch: 0,
    curlSign: 1
  };
  model.group.name = `seat-${index}`;
  attachMixer(rig, Math.random() * 4);
  return makePerformer(rig);
}

/* ---------------- the house dealer ---------------------------------- */

export function buildDealer() {
  const model = buildCharacterModel(DEALER_LOOK, 'standing');
  const rig = {
    ...model,
    mood: 'idle',
    currentMood: 'idle',
    phase: 0,
    dealPulse: 0,
    blinkAt: 2,
    blinkUntil: 0
  };
  model.group.name = 'dealer';
  attachMixer(rig, 1.2);
  // dealer visor
  const visor = new THREE.Group();
  const dark = accessoryMaterial('#14171a', { roughness: 0.55 });
  const brim = new THREE.Mesh(new THREE.BoxGeometry(0.185, 0.012, 0.105), dark);
  brim.position.set(0, 0.218, 0.105);
  brim.rotation.x = 0.08;
  visor.add(brim);
  const band = new THREE.Mesh(new THREE.CylinderGeometry(0.111, 0.113, 0.03, 8), dark);
  band.position.set(0, 0.207, 0.008);
  visor.add(band);
  visor.traverse((object) => { if (object.isMesh) object.castShadow = true; });
  rig.bones.head.add(visor);
  rig.visor = visor;
  rig.arms = model.arms;
  return rig;
}

/* ---------------- chairs -------------------------------------------- */

export function buildChairs(count = 6) {
  const wood = new THREE.MeshStandardMaterial({ color: '#2b1b12', roughness: 0.45, flatShading: true });
  const leather = new THREE.MeshStandardMaterial({ color: '#241a18', roughness: 0.55, flatShading: true });
  const brass = new THREE.MeshStandardMaterial({ color: '#a88654', roughness: 0.35, metalness: 0.8, flatShading: true });
  const chairs = [];
  for (let i = 0; i < count; i++) {
    const group = new THREE.Group();
    const back = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.58, 0.075), leather);
    back.position.set(0, 0.97, -0.205);
    back.rotation.x = -0.07;
    back.castShadow = true;
    back.receiveShadow = true;
    group.add(back);
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 2; col++) {
        const stud = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.012, 0.012), brass);
        stud.position.set((col ? 1 : -1) * 0.08, 0.76 + row * 0.12, -0.16);
        group.add(stud);
      }
    }
    const seat = new THREE.Mesh(new THREE.BoxGeometry(0.51, 0.085, 0.47), leather);
    seat.position.set(0, 0.57, -0.01);
    seat.castShadow = true;
    seat.receiveShadow = true;
    group.add(seat);
    const seatBase = new THREE.Mesh(new THREE.BoxGeometry(0.49, 0.18, 0.44), leather);
    seatBase.position.set(0, 0.46, -0.01);
    seatBase.castShadow = true;
    group.add(seatBase);
    for (const side of [-1, 1]) {
      const stile = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.58, 0.06), wood);
      stile.position.set(side * 0.235, 0.9, -0.19);
      stile.rotation.x = -0.07;
      stile.castShadow = true;
      group.add(stile);
      for (const backSide of [-1, 1]) {
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.032, 0.42, 6), wood);
        leg.position.set(side * 0.2, 0.21, backSide * 0.16);
        leg.rotation.z = side * 0.07;
        leg.castShadow = true;
        group.add(leg);
      }
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.031, 0.031, 0.016, 8), brass);
      cap.position.set(side * 0.22, 0.02, -0.02);
      group.add(cap);
    }
    group.userData.chair = i;
    chairs.push(group);
  }
  return chairs;
}

/* ---------------- first-person hands -------------------------------- */

export function buildPlayerHands() {
  const model = buildPlayerHandsModel(PLAYER_LOOK);
  const rig = {
    ...model,
    mood: 'idle',
    currentMood: 'idle',
    action: null,
    actionTime: 0,
    lean: 0,
    handCurrent: null,
    curlSign: -1,
    phase: Math.random() * 10
  };
  model.group.name = 'first-person-hands';
  const wrapper = new THREE.Group();
  wrapper.add(model.group);
  wrapper.visible = false;
  rig.wrapper = wrapper;
  rig.group = wrapper;
  rig.position = new THREE.Vector3();
  makePerformer(rig);
  // makePerformer expects group.getWorldPositions to already be correct
  rig.handCurrent = {
    L: { target: new THREE.Vector3(-0.2, 0.91, 0.63), dir: new THREE.Vector3(0, -0.35, -1).normalize() },
    R: { target: new THREE.Vector3(0.2, 0.91, 0.63), dir: new THREE.Vector3(0, -0.35, -1).normalize() }
  };
  return rig;
}

/* ---------------- animation ----------------------------------------- */

const _tmpVec = new THREE.Vector3();
const _tmpVec2 = new THREE.Vector3();
const _tmpQuat = new THREE.Quaternion();
const _tmpQuat2 = new THREE.Quaternion();
const _tmpEuler = new THREE.Euler();

const PLAYER_REST_L = new THREE.Vector3(-0.2, 0.91, 0.63);
const PLAYER_REST_R = new THREE.Vector3(0.2, 0.91, 0.63);
const PLAYER_REST_DIR = new THREE.Vector3(0, -0.35, -1).normalize();
const PLAYER_UP_DIR = new THREE.Vector3(0, 0.75, -0.5).normalize();
const FORWARD_DIR = new THREE.Vector3(0, -0.5, 1).normalize();
const DOWN_DIR = new THREE.Vector3(0, -1, 0.15).normalize();

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function applyLean(rig, amount) {
  if (Math.abs(amount) < 0.0005) return;
  _tmpQuat.setFromEuler(_tmpEuler.set(amount, 0, 0, 'YXZ'));
  rig.bones.chest.quaternion.multiply(_tmpQuat);
}

function aimBone(bone, directionWorld, restDir, dt, speed) {
  if (!bone.parent) return;
  bone.parent.getWorldQuaternion(_tmpQuat2);
  _tmpVec.copy(directionWorld).normalize().applyQuaternion(_tmpQuat2.invert());
  if (_tmpVec.lengthSq() < 0.000001) return;
  _tmpQuat.setFromUnitVectors(restDir, _tmpVec.normalize());
  const alpha = Math.min(0.85, 1 - Math.exp(-dt * speed));
  bone.quaternion.slerp(_tmpQuat, alpha);
}

function solveArm(rig, side, wristTargetWorld, handDirWorld, curl, dt) {
  const arm = rig.arms[side];
  if (!arm || !arm.upper) return;
  arm.upper.getWorldPosition(_tmpVec2);
  const shoulder = _tmpVec2.clone();
  const target = wristTargetWorld.clone();
  const toTarget = target.clone().sub(shoulder);
  let distance = toTarget.length();
  const maxReach = arm.upperLength + arm.foreLength - 0.004;
  if (distance > maxReach) {
    toTarget.normalize();
    target.copy(shoulder).addScaledVector(toTarget, maxReach);
    distance = maxReach;
  }
  if (distance < 0.04) return;
  const dir = toTarget.normalize();
  rig.group.getWorldQuaternion(_tmpQuat2);
  const poleBase = new THREE.Vector3(side * 0.18, -1.15, -0.08).applyQuaternion(_tmpQuat2);
  const pole = poleBase.addScaledVector(dir, -poleBase.dot(dir)).normalize();
  const cosAngle = clamp(
    (arm.upperLength * arm.upperLength + distance * distance - arm.foreLength * arm.foreLength) /
      (2 * arm.upperLength * distance), -1, 1
  );
  const angle = Math.acos(cosAngle);
  const elbow = shoulder.clone()
    .addScaledVector(dir, Math.cos(angle) * arm.upperLength)
    .addScaledVector(pole, Math.sin(angle) * arm.upperLength);
  aimBone(arm.upper, elbow.clone().sub(shoulder), arm.upperDir, dt, 17);
  arm.upper.updateMatrixWorld(true);
  arm.fore.getWorldPosition(_tmpVec2);
  aimBone(arm.fore, target.clone().sub(_tmpVec2.clone()), arm.foreDir, dt, 19);
  arm.fore.updateMatrixWorld(true);
  aimBone(arm.hand, handDirWorld, arm.handDir, dt, 15);
  arm.hand.updateMatrixWorld(true);
  applyFingerCurl(rig, side, curl, dt);
}

function applyFingerCurl(rig, side, curl, dt) {
  const arm = rig.arms[side];
  if (!arm) return;
  const sign = rig.curlSign ?? 1;
  for (const finger of arm.fingerBones) {
    const isThumb = finger.name === 'thumb';
    const first = curl * (isThumb ? 0.34 : 0.58) * sign;
    const second = curl * (isThumb ? 0.46 : 0.9) * sign;
    finger.b1.rotation.x = damp(finger.b1.rotation.x, first, dt, 13);
    finger.b2.rotation.x = damp(finger.b2.rotation.x, second, dt, 13);
    if (isThumb) finger.b1.rotation.z = damp(finger.b1.rotation.z, side * curl * 0.22 * sign, dt, 11);
  }
}

function currentHands(rig, restL, restR) {
  if (!rig.handCurrent) {
    rig.handCurrent = {
      L: { target: restL.clone(), dir: REST_DIR.clone() },
      R: { target: restR.clone(), dir: REST_DIR.clone() }
    };
  }
  return rig.handCurrent;
}

function aimHead(rig, targetWorld, dt, extraPitch = 0) {
  rig.head.getWorldPosition(_tmpVec2);
  const dir = targetWorld.clone().sub(_tmpVec2);
  rig.group.getWorldQuaternion(_tmpQuat);
  dir.applyQuaternion(_tmpQuat.invert());
  const horizontal = Math.sqrt(dir.x * dir.x + dir.z * dir.z);
  let yaw = Math.atan2(dir.x, dir.z);
  let pitch = Math.atan2(-dir.y, horizontal) + extraPitch;
  yaw = clamp(yaw, -0.85, 0.85);
  pitch = clamp(pitch, -0.6, 0.42);
  rig.headYaw = damp(rig.headYaw || 0, yaw, dt, 4.2);
  rig.headPitch = damp(rig.headPitch || 0, pitch, dt, 4.2);
  const neck = rig.bones.neck;
  neck.rotation.set(rig.headPitch * 0.32, rig.headYaw * 0.34, 0, 'YXZ');
  rig.head.rotation.set(rig.headPitch * 0.68, rig.headYaw * 0.66, 0, 'YXZ');
}

function manualHead(rig, yaw, pitch, dt) {
  yaw = clamp(yaw, -0.85, 0.85);
  pitch = clamp(pitch, -0.6, 0.42);
  rig.headYaw = damp(rig.headYaw || 0, yaw, dt, 4.2);
  rig.headPitch = damp(rig.headPitch || 0, pitch, dt, 4.2);
  rig.bones.neck.rotation.set(rig.headPitch * 0.32, rig.headYaw * 0.34, 0, 'YXZ');
  rig.head.rotation.set(rig.headPitch * 0.68, rig.headYaw * 0.66, 0, 'YXZ');
}

function blink(rig, dt, time) {
  if (time > rig.blinkAt) {
    rig.blinkUntil = time + 0.12;
    rig.blinkAt = time + 2.6 + Math.random() * 4.5;
  }
  const target = time < rig.blinkUntil ? 0.12 : 1;
  rig.eyeL.scale.y = damp(rig.eyeL.scale.y, target, dt, 22);
  rig.eyeR.scale.y = rig.eyeL.scale.y;
}

function glanceTarget(rig, time, dt) {
  if (!rig.glanceAt) rig.glanceAt = time + 2 + Math.random() * 3;
  if (time > rig.glanceAt) {
    rig.glanceAt = time + 2.6 + Math.random() * 4.5;
    rig.glanceYaw = (Math.random() - 0.5) * 1.1;
    rig.glancePitch = (Math.random() - 0.5) * 0.28;
  }
  const yaw = rig.glanceYaw || 0;
  const pitch = rig.glancePitch || 0;
  return new THREE.Vector3(Math.sin(yaw) * 2, 1.15 + Math.sin(pitch) * 2, Math.cos(yaw) * 2);
}

function convertWorldToLocal(rig, worldPoint, fallback) {
  if (!worldPoint) return fallback.clone();
  return rig.group.worldToLocal(worldPoint.clone());
}

function seatedPose(rig, dt, time) {
  const action = rig.action;
  const p = action ? clamp(action.time / action.duration, 0, 1) : 0;
  const targetL = REST_L.clone();
  const targetR = REST_R.clone();
  const dirL = REST_DIR.clone();
  const dirR = REST_DIR.clone();
  let curlL = 0.4;
  let curlR = 0.4;
  let lean = 0;
  let headTarget = null;
  let headYaw = null;
  let headPitch = null;

  if (!action) {
    headTarget = glanceTarget(rig, time, dt);
  } else if (action.name === 'inspect') {
    const lift = smoothstep(p / 0.22) * (1 - smoothstep((p - 0.7) / 0.3));
    const card = convertWorldToLocal(rig, action.world.card, new THREE.Vector3(0, 0.84, 0.58));
    targetL.set(card.x - 0.09, card.y - 0.075, card.z + 0.02);
    targetR.set(card.x + 0.09, card.y - 0.075, card.z + 0.02);
    dirL.copy(REST_DIR).lerp(UP_DIR, lift * 0.8).normalize();
    dirR.copy(dirL);
    curlL = 0.22 + 0.27 * lift;
    curlR = curlL;
    lean = 0.045 * lift;
    headTarget = rig.group.localToWorld(new THREE.Vector3(card.x, card.y - 0.03, card.z));
  } else if (action.name === 'bet' || action.name === 'call') {
    const chip = convertWorldToLocal(rig, action.world.chip, new THREE.Vector3(0.18, 0.82, 0.5));
    const bet = convertWorldToLocal(rig, action.world.bet, new THREE.Vector3(0.16, 0.82, 0.4));
    let reach;
    if (p < 0.3) {
      reach = smoothstep(p / 0.3);
      targetR.lerp(chip, reach);
    } else if (p < 0.68) {
      reach = smoothstep((p - 0.3) / 0.38);
      targetR.copy(chip.clone().lerp(bet, reach));
    } else {
      reach = smoothstep((p - 0.68) / 0.32);
      targetR.lerp(REST_R, reach);
    }
    targetR.y += Math.sin(p * Math.PI) * 0.025;
    dirR.copy(DOWN_DIR);
    curlR = 0.55;
    lean = 0.035 * (1 - smoothstep((p - 0.75) / 0.25));
    headTarget = rig.group.localToWorld(new THREE.Vector3(0.05, 0.8, 0.45));
  } else if (action.name === 'check') {
    const tap = Math.sin(Math.min(1, p / 0.7) * Math.PI);
    targetR.set(0.13, 0.808, 0.52).lerp(REST_R, 1 - tap);
    targetR.y += 0.02 * tap;
    dirR.copy(REST_DIR);
    curlR = 0.3;
    lean = 0.02;
    headTarget = rig.group.localToWorld(new THREE.Vector3(0.05, 0.8, 0.5));
  } else if (action.name === 'fold') {
    const card = convertWorldToLocal(rig, action.world.card, new THREE.Vector3(0, 0.82, 0.56));
    const reach = smoothstep(p / 0.16) * (1 - smoothstep((p - 0.24) / 0.14));
    const push = smoothstep((p - 0.36) / 0.2) * (1 - smoothstep((p - 0.86) / 0.14));
    targetL.set(-0.1, 0.82, 0.54).lerp(card, reach * 0.55);
    targetR.set(0.1, 0.82, 0.54).lerp(card, reach * 0.55);
    targetL.z += push * 0.12;
    targetR.z += push * 0.12;
    targetL.y -= push * 0.015;
    targetR.y -= push * 0.015;
    dirL.copy(FORWARD_DIR);
    dirR.copy(FORWARD_DIR);
    curlL = 0.18 + 0.35 * reach;
    curlR = curlL;
    lean = 0.05 * push;
    headTarget = rig.group.localToWorld(new THREE.Vector3(0, 0.8, 0.6));
  } else if (action.name === 'think') {
    const hold = smoothstep(p / 0.2) * (1 - smoothstep((p - 0.78) / 0.22));
    targetR.lerp(new THREE.Vector3(0.08, 1.16, 0.22), hold);
    dirR.copy(CHIN_DIR);
    curlR = 0.42;
    lean = 0.045 * hold;
    headTarget = rig.group.localToWorld(new THREE.Vector3(0.05, 0.8, 0.5));
  } else if (action.name === 'win') {
    const up = smoothstep(p / 0.22) * (1 - smoothstep((p - 0.8) / 0.2));
    const bounce = Math.sin(p * Math.PI * 3) * 0.014 * up;
    targetL.set(-0.22, 0.84 + 0.13 * up + bounce, 0.52);
    targetR.set(0.22, 0.84 + 0.13 * up + bounce, 0.52);
    dirL.copy(REST_DIR).lerp(UP_DIR, up * 0.55).normalize();
    dirR.copy(dirL);
    curlL = 0.25 + 0.45 * up;
    curlR = curlL;
    lean = -0.03 * up;
    headTarget = rig.group.localToWorld(new THREE.Vector3(0, 1.42, 0.35));
  } else if (action.name === 'lose') {
    const down = smoothstep(p / 0.3);
    targetL.set(-0.12, 0.84 - 0.05 * down, 0.51);
    targetR.set(0.12, 0.84 - 0.05 * down, 0.51);
    dirL.copy(REST_DIR).lerp(CHIN_DIR, down * 0.6).normalize();
    dirR.copy(dirL);
    curlL = 0.3 + 0.3 * down;
    curlR = curlL;
    lean = 0.08 * down;
    headTarget = rig.group.localToWorld(new THREE.Vector3(0, 0.74, 0.5));
  } else if (action.name === 'deal') {
    targetR.set(0.26, 0.84, 0.55);
    dirR.copy(FORWARD_DIR);
    curlR = 0.4;
    lean = 0.04;
    headTarget = rig.group.localToWorld(new THREE.Vector3(0, 0.8, 0.6));
  }

  if (action) rig.lookAtWorld = null;
  if (rig.mood === 'folded' && !action) {
    headYaw = -0.35;
    headPitch = 0.12;
    lean = 0.01;
  }
  if (rig.mood === 'thinking' && !action) {
    headYaw = 0;
    headPitch = 0.25;
  }
  return { targetL, targetR, dirL, dirR, curlL, curlR, lean, headTarget, headYaw, headPitch };
}

export function updateCharacter(rig, dt, time) {
  if (!rig.group.visible) return;
  rig.group.updateWorldMatrix(true, false);
  if (rig.action) {
    rig.action.time += dt;
    if (rig.action.time > rig.action.duration) rig.action = null;
  }
  rig.mixer.update(dt);

  const pose = seatedPose(rig, dt, time);
  rig.handCurrent = currentHands(rig, REST_L, REST_R);
  const smooth = 1 - Math.exp(-dt * 11);
  rig.handCurrent.L.target.lerp(pose.targetL, smooth);
  rig.handCurrent.R.target.lerp(pose.targetR, smooth);
  rig.handCurrent.L.dir.lerp(pose.dirL, smooth).normalize();
  rig.handCurrent.R.dir.lerp(pose.dirR, smooth).normalize();

  let mood = 'idle';
  if (rig.action?.name === 'win' || rig.mood === 'win') mood = 'win';
  else if (rig.action?.name === 'lose' || rig.mood === 'lose') mood = 'lose';
  else if (rig.action?.name === 'think' || rig.mood === 'thinking') mood = 'think';
  else if (rig.mood === 'folded') mood = 'folded';
  setRigMood(rig, mood);

  rig.lean = damp(rig.lean, pose.lean, dt, 5.5);
  applyLean(rig, rig.lean);
  rig.group.updateMatrixWorld(true);

  if (pose.headTarget) aimHead(rig, pose.headTarget, dt);
  else if (pose.headYaw !== null) manualHead(rig, pose.headYaw, pose.headPitch, dt);
  else if (rig.lookAtWorld) aimHead(rig, rig.lookAtWorld, dt);
  else manualHead(rig, 0, 0.02, dt);

  const worldTargetL = rig.group.localToWorld(rig.handCurrent.L.target.clone());
  const worldTargetR = rig.group.localToWorld(rig.handCurrent.R.target.clone());
  rig.group.getWorldQuaternion(_tmpQuat);
  const worldDirL = rig.handCurrent.L.dir.clone().applyQuaternion(_tmpQuat);
  const worldDirR = rig.handCurrent.R.dir.clone().applyQuaternion(_tmpQuat);
  solveArm(rig, -1, worldTargetL, worldDirL, pose.curlL, dt);
  solveArm(rig, 1, worldTargetR, worldDirR, pose.curlR, dt);
  blink(rig, dt, time);
}

/* ---------------- dealer -------------------------------------------- */

export function updateDealer(dealer, dt, time) {
  dealer.phase += dt;
  dealer.mixer.update(dt);
  const scan = Math.sin(time * 0.31) * 0.22 + Math.sin(time * 0.13) * 0.1;
  const nod = Math.sin(time * 0.42 + 1.2) * 0.03 - 0.03;
  manualHead(dealer, scan, nod, dt);

  let swing = 0;
  if (dealer.dealPulse > 0) {
    dealer.dealPulse = Math.max(0, dealer.dealPulse - dt * 2.3);
    swing = Math.sin(Math.min(1, 1 - dealer.dealPulse) * Math.PI);
  }
  const upper = dealer.bones.upperArmR;
  const fore = dealer.bones.forearmR;
  const upperTarget = new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.72 * swing, 0.02, -0.06));
  const foreTarget = new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.55 * swing, 0, 0));
  const alpha = 1 - Math.exp(-dt * (swing > 0 ? 12 : 4));
  upper.quaternion.slerp(upperTarget, alpha);
  fore.quaternion.slerp(foreTarget, alpha);
  const leftUpper = dealer.bones.upperArmL;
  leftUpper.quaternion.slerp(new THREE.Quaternion(), 1 - Math.exp(-dt * 3));
  blink(dealer, dt, time);
}

/* ---------------- first-person hands -------------------------------- */

function playerPose(hands, dt, time) {
  const action = hands.action;
  const p = action ? clamp(action.time / action.duration, 0, 1) : 0;
  const targetL = PLAYER_REST_L.clone();
  const targetR = PLAYER_REST_R.clone();
  const dirL = PLAYER_REST_DIR.clone();
  const dirR = PLAYER_REST_DIR.clone();
  let curlL = 0.28;
  let curlR = 0.28;
  let lean = 0;
  const idle = Math.sin(time * 1.1 + hands.phase) * 0.004;
  targetL.y += idle;
  targetR.y += idle;

  if (action?.name === 'inspect') {
    const lift = smoothstep(p / 0.22) * (1 - smoothstep((p - 0.7) / 0.3));
    const card = action.world.card || new THREE.Vector3(0, 1.0, 0.68);
    targetL.set(card.x - 0.055, card.y - 0.018, card.z + 0.016);
    targetR.set(card.x + 0.055, card.y - 0.018, card.z + 0.016);
    dirL.copy(PLAYER_REST_DIR).lerp(new THREE.Vector3(0, -0.12, -1).normalize(), lift).normalize();
    dirR.copy(dirL);
    curlL = 0.28 + 0.16 * lift;
    curlR = curlL;
    lean = -0.015 * lift;
  } else if (action?.name === 'bet' || action?.name === 'call') {
    let reach;
    if (p < 0.32) {
      reach = smoothstep(p / 0.32);
      targetR.lerp(new THREE.Vector3(0.14, 0.88, 0.55), reach);
    } else if (p < 0.7) {
      reach = smoothstep((p - 0.32) / 0.38);
      targetR.lerp(new THREE.Vector3(0.04, 0.88, 0.48), reach);
    } else {
      reach = smoothstep((p - 0.7) / 0.3);
      targetR.lerp(PLAYER_REST_R, reach);
    }
    targetR.y += Math.sin(p * Math.PI) * 0.03;
    dirR.copy(new THREE.Vector3(0, -1, -0.4).normalize());
    curlR = 0.5;
  } else if (action?.name === 'check') {
    const tap = Math.sin(Math.min(1, p / 0.7) * Math.PI);
    targetR.lerp(new THREE.Vector3(0.12, 0.885, 0.56), tap);
    targetR.y += tap * 0.02;
    curlR = 0.28;
  } else if (action?.name === 'fold') {
    const push = smoothstep(p / 0.2) * (1 - smoothstep((p - 0.75) / 0.25));
    targetL.set(-0.14, 0.88, 0.56 - 0.1 * push);
    targetR.set(0.14, 0.88, 0.56 - 0.1 * push);
    dirL.copy(PLAYER_REST_DIR).lerp(new THREE.Vector3(0, -0.65, -1).normalize(), push).normalize();
    dirR.copy(dirL);
    curlL = 0.3;
    curlR = 0.3;
  } else if (action?.name === 'win') {
    const up = smoothstep(p / 0.25) * (1 - smoothstep((p - 0.8) / 0.2));
    targetL.set(-0.19, 0.9 + 0.26 * up, 0.62 + 0.18 * up);
    targetR.set(0.19, 0.9 + 0.26 * up, 0.62 + 0.18 * up);
    dirL.copy(PLAYER_REST_DIR).lerp(PLAYER_UP_DIR, up).normalize();
    dirR.copy(dirL);
    curlL = 0.18 - 0.13 * up;
    curlR = curlL;
  } else if (action?.name === 'lose') {
    const down = smoothstep(p / 0.3);
    targetL.set(-0.11, 0.9 + 0.23 * down, 0.62 + 0.2 * down);
    targetR.set(0.11, 0.9 + 0.23 * down, 0.62 + 0.2 * down);
    dirL.copy(PLAYER_REST_DIR).lerp(PLAYER_UP_DIR, down).normalize();
    dirR.copy(dirL);
    curlL = 0.18 + 0.18 * down;
    curlR = curlL;
  }
  return { targetL, targetR, dirL, dirR, curlL, curlR, lean };
}

export function updatePlayerHands(hands, dt, time, tension = 0) {
  if (!hands.group.visible) return;
  hands.group.updateMatrixWorld(true);
  if (hands.action) {
    hands.action.time += dt;
    if (hands.action.time > hands.action.duration) hands.action = null;
  }
  const pose = playerPose(hands, dt, time);
  hands.handCurrent = currentHands(hands, PLAYER_REST_L, PLAYER_REST_R);
  const smooth = 1 - Math.exp(-dt * 12);
  hands.handCurrent.L.target.lerp(pose.targetL, smooth);
  hands.handCurrent.R.target.lerp(pose.targetR, smooth);
  hands.handCurrent.L.dir.lerp(pose.dirL, smooth).normalize();
  hands.handCurrent.R.dir.lerp(pose.dirR, smooth).normalize();
  const tremble = tension * Math.sin(time * 9) * 0.0012;
  solveArm(hands, -1, hands.handCurrent.L.target.clone().add(new THREE.Vector3(0, tremble, 0)), hands.handCurrent.L.dir, pose.curlL, dt);
  solveArm(hands, 1, hands.handCurrent.R.target.clone().add(new THREE.Vector3(0, -tremble, 0)), hands.handCurrent.R.dir, pose.curlR, dt);
}
