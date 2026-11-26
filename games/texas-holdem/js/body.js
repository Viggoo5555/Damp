/* =====================================================================
   TEXAS HOLD'EM — the bodies
   A hand-built low-poly human: complete bone chain, facet-shaded skin
   and clothing, separate finger bones, and a seated bind pose sized to
   real furniture (1.78 m standing, 0.60 m seat height).
   ===================================================================== */

import * as THREE from 'three';
import {
  LowPolyBuilder, handQuaternion, torsoMaterial, accessoryMaterial
} from './lowpoly.js';

const FINGER_NAMES = ['index', 'middle', 'ring', 'pinky'];
const FINGER_X = [0.031, 0.010, -0.011, -0.032];

/*
  Absolute bind positions in metres. The seated pose is the actual pose a
  person holds at the table, so the skinned mesh starts in a natural sit
  instead of a T-pose. Standing is used for the dealer.
*/
const POSES = {
  seated: {
    hips: [0, 0.60, 0],
    spine: [0, 0.73, 0.005],
    chest: [0, 0.90, 0.01],
    neck: [0, 1.10, 0.01],
    head: [0, 1.17, 0.01],
    shoulder: [0.19, 1.055, 0.02],
    upperArm: [0.25, 1.035, 0.03],
    elbow: [0.335, 0.835, 0.15],
    wrist: [0.315, 0.79, 0.39],
    thigh: [0.105, 0.59, 0.015],
    knee: [0.112, 0.56, 0.43],
    ankle: [0.118, 0.10, 0.45],
    toe: [0.12, 0.055, 0.62]
  },
  standing: {
    hips: [0, 0.98, 0],
    spine: [0, 1.10, 0],
    chest: [0, 1.28, 0],
    neck: [0, 1.48, 0],
    head: [0, 1.56, 0],
    shoulder: [0.185, 1.40, 0],
    upperArm: [0.225, 1.38, 0],
    elbow: [0.245, 1.10, 0.005],
    wrist: [0.25, 0.83, 0.02],
    thigh: [0.105, 0.95, 0],
    knee: [0.11, 0.51, 0.01],
    ankle: [0.115, 0.09, 0],
    toe: [0.12, 0.05, 0.14]
  }
};

function mirrored(value) {
  return [-value[0], value[1], value[2]];
}

export function createSkeleton(pose = 'seated') {
  const p = POSES[pose] || POSES.seated;
  const qHand = handQuaternion(pose);
  const defs = [
    ['root', null, [0, 0, 0]],
    ['hips', 'root', p.hips],
    ['spine', 'hips', p.spine],
    ['chest', 'spine', p.chest],
    ['neck', 'chest', p.neck],
    ['head', 'neck', p.head]
  ];

  const arms = {};
  for (const side of [-1, 1]) {
    const tag = side < 0 ? 'L' : 'R';
    const s = (value) => (side < 0 ? mirrored(value) : value);
    defs.push(
      [`shoulder${tag}`, 'chest', s(p.shoulder)],
      [`upperArm${tag}`, `shoulder${tag}`, s(p.upperArm)],
      [`forearm${tag}`, `upperArm${tag}`, s(p.elbow)],
      [`hand${tag}`, `forearm${tag}`, s(p.wrist)]
    );
    const wrist = new THREE.Vector3(...s(p.wrist));
    const fingers = [];
    FINGER_NAMES.forEach((name, index) => {
      const lateral = -side * FINGER_X[index] * 0.82;
      const base1 = wrist.clone().add(new THREE.Vector3(lateral, -0.004, 0.088).applyQuaternion(qHand));
      const base2 = base1.clone().add(new THREE.Vector3(0, 0.002, 0.034).applyQuaternion(qHand));
      const tip = base2.clone().add(new THREE.Vector3(0, 0.001, 0.027).applyQuaternion(qHand));
      const name1 = `${name}${tag}1`;
      const name2 = `${name}${tag}2`;
      defs.push([name1, `hand${tag}`, base1.toArray()], [name2, name1, base2.toArray()]);
      fingers.push({ name, bone1: name1, bone2: name2, base1, base2, tip });
    });
    const thumb1 = wrist.clone().add(new THREE.Vector3(-side * 0.044, -0.012, 0.025).applyQuaternion(qHand));
    const thumb2 = thumb1.clone().add(new THREE.Vector3(-side * 0.013, -0.003, 0.030).applyQuaternion(qHand));
    const thumbTip = thumb2.clone().add(new THREE.Vector3(0, 0.002, 0.025).applyQuaternion(qHand));
    defs.push([`thumb${tag}1`, `hand${tag}`, thumb1.toArray()], [`thumb${tag}2`, `thumb${tag}1`, thumb2.toArray()]);
    fingers.push({ name: 'thumb', bone1: `thumb${tag}1`, bone2: `thumb${tag}2`, base1: thumb1, base2: thumb2, tip: thumbTip });
    arms[side] = { side, tag, fingers, qHand };
    defs.push(
      [`thigh${tag}`, 'hips', s(p.thigh)],
      [`shin${tag}`, `thigh${tag}`, s(p.knee)],
      [`foot${tag}`, `shin${tag}`, s(p.ankle)]
    );
  }

  const absolute = new Map([['root', new THREE.Vector3(0, 0, 0)]]);
  const bones = [];
  const byName = {};
  for (const [name, parent, position] of defs) {
    const bone = new THREE.Bone();
    bone.name = name;
    const point = new THREE.Vector3(...position);
    if (parent) {
      const parentBone = byName[parent];
      const parentPoint = absolute.get(parent);
      bone.position.copy(point).sub(parentPoint);
      parentBone.add(bone);
    } else {
      bone.position.copy(point);
    }
    absolute.set(name, point);
    byName[name] = bone;
    bones.push(bone);
  }

  for (const side of [-1, 1]) {
    const tag = side < 0 ? 'L' : 'R';
    const arm = arms[side];
    arm.upper = byName[`upperArm${tag}`];
    arm.fore = byName[`forearm${tag}`];
    arm.hand = byName[`hand${tag}`];
    arm.shoulder = byName[`shoulder${tag}`];
    arm.upperPos = absolute.get(`upperArm${tag}`).clone();
    arm.elbowPos = absolute.get(`forearm${tag}`).clone();
    arm.wristPos = absolute.get(`hand${tag}`).clone();
    arm.upperDir = arm.elbowPos.clone().sub(arm.upperPos).normalize();
    arm.foreDir = arm.wristPos.clone().sub(arm.elbowPos).normalize();
    arm.handDir = new THREE.Vector3(0, 0, 1).applyQuaternion(qHand).normalize();
    arm.upperLength = arm.elbowPos.distanceTo(arm.upperPos);
    arm.foreLength = arm.wristPos.distanceTo(arm.elbowPos);
    arm.fingerBones = arm.fingers.map((finger) => ({
      ...finger,
      b1: byName[finger.bone1],
      b2: byName[finger.bone2]
    }));
  }

  const legs = {};
  for (const side of [-1, 1]) {
    const tag = side < 0 ? 'L' : 'R';
    legs[side] = {
      side,
      thigh: byName[`thigh${tag}`],
      shin: byName[`shin${tag}`],
      foot: byName[`foot${tag}`]
    };
  }

  return { pose, bones, byName, absolute, arms, legs, head: byName.head, hips: byName.hips, qHand };
}

/* ---------------- body, clothing and hands -------------------------- */

function addHand(builder, arm, bones, palette) {
  const { wristPos, handDir, qHand } = arm;
  const lateral = new THREE.Vector3(1, 0, 0).applyQuaternion(qHand);
  const palmEnd = wristPos.clone().addScaledVector(handDir, 0.083);
  builder.prism(
    wristPos, palmEnd,
    [0.041, 0.024], [0.045, 0.019], 5,
    palette.skin, [[bones[arm.hand.name], 1]], [[bones[arm.hand.name], 1]],
    { capStart: false }
  );
  // knuckle ridge
  builder.box(
    wristPos.clone().addScaledVector(handDir, 0.082).addScaledVector(lateral, 0),
    [0.082, 0.026, 0.020], palette.skin, [[bones[arm.hand.name], 1]], qHand
  );
  for (const finger of arm.fingerBones) {
    const thick = finger.name === 'thumb' ? 0.0125 : 0.0102;
    builder.prism(
      finger.base1, finger.base2, thick, thick * 0.9, 4,
      palette.skin, [[finger.b1, 1]], [[finger.b1, 1]], { capStart: false, capEnd: false }
    );
    builder.prism(
      finger.base2, finger.tip, thick * 0.9, thick * 0.7, 4,
      palette.skin, [[finger.b2, 1]], [[finger.b2, 1]], { capStart: false }
    );
    builder.blob(finger.base2, [thick, thick, thick], palette.skin, [[finger.b1, 0.5], [finger.b2, 0.5]]);
  }
}

function addArm(builder, arm, bones, palette, look) {
  const { upperPos, elbowPos, wristPos } = arm;
  const upper = bones[arm.upper.name];
  const fore = bones[arm.fore.name];
  const hand = bones[arm.hand.name];
  const sleeve = look.sleeve || look.jacket;
  builder.prism(
    upperPos, elbowPos, [0.052, 0.049], [0.045, 0.042], 6,
    sleeve, [[upper, 1]], [[upper, 1]], { capStart: false, capEnd: false }
  );
  builder.blob(elbowPos, [0.05, 0.05, 0.05], sleeve, [[fore, 0.65], [upper, 0.35]]);
  builder.prism(
    elbowPos, wristPos, [0.048, 0.045], [0.039, 0.036], 6,
    sleeve, [[fore, 1]], [[fore, 1]], { capStart: false, capEnd: false }
  );
  // rolled shirt cuff at the wrist
  const cuffStart = wristPos.clone().addScaledVector(arm.foreDir, -0.03);
  builder.prism(
    cuffStart, wristPos, [0.043, 0.04], [0.042, 0.039], 5,
    palette.shirt, [[fore, 1]], [[fore, 1]], { capStart: false, capEnd: false }
  );
  if (look.cufflink) {
    const side = arm.tag === 'L' ? -1 : 1;
    builder.blob(
      wristPos.clone().add(new THREE.Vector3(side * 0.04, 0.012, 0)),
      [0.008, 0.008, 0.008], palette.gold, [[fore, 1]]
    );
  }
  addHand(builder, arm, bones, palette);
}

function addLeg(builder, leg, bones, palette, look, pose) {
  const { side } = leg;
  const thigh = bones[leg.thigh.name];
  const shin = bones[leg.shin.name];
  const foot = bones[leg.foot.name];
  const p = POSES[pose] || POSES.seated;
  const s = (value) => (side < 0 ? value : mirrored(value));
  const hip = new THREE.Vector3(...s(p.thigh));
  const knee = new THREE.Vector3(...s(p.knee));
  const ankle = new THREE.Vector3(...s(p.ankle));
  const toe = new THREE.Vector3(...s(p.toe));
  builder.prism(
    hip, knee, [0.086, 0.078], [0.069, 0.064], 6,
    look.trousers, [[thigh, 1]], [[thigh, 1]], { capStart: false, capEnd: false }
  );
  builder.blob(knee, [0.07, 0.068, 0.07], look.trousers, [[shin, 0.7], [thigh, 0.3]]);
  builder.prism(
    knee, ankle, [0.068, 0.063], [0.047, 0.044], 6,
    look.trousers, [[shin, 1]], [[shin, 1]], { capStart: false, capEnd: false }
  );
  builder.prism(
    ankle, toe, [0.058, 0.052], [0.041, 0.034], 6,
    look.boots, [[foot, 1]], [[foot, 1]], { capStart: true, capEnd: true }
  );
  builder.box(
    ankle.clone().add(new THREE.Vector3(0, -0.032, 0.035)),
    [0.09, 0.035, 0.17], look.boots, [[foot, 1]]
  );
}

function addTorso(builder, skeleton, palette, look) {
  const bones = skeleton.byName;
  const abs = skeleton.absolute;
  const hipY = abs.get('hips').y;
  const chestY = abs.get('chest').y;
  const shoulderY = abs.get('shoulderL').y;
  const neckY = abs.get('neck').y;
  const headY = abs.get('head').y;
  const W = (name, blend, t = 1) => (
    blend ? [[bones[name], t], [bones[blend], 1 - t]] : [[bones[name], 1]]
  );

  // hips / trousers
  builder.prism(
    [0, hipY - 0.15, 0], [0, hipY + 0.085, 0.004], [0.175, 0.122], [0.195, 0.136], 8,
    look.trousers, W('hips'), W('hips'), { capStart: true, capEnd: false }
  );
  // torso
  builder.prism(
    [0, hipY + 0.08, 0.004], [0, chestY + 0.01, 0.01], [0.19, 0.132], [0.212, 0.145], 8,
    look.jacket, W('hips', 'spine', 0.7), W('spine'), { capStart: false, capEnd: false }
  );
  builder.prism(
    [0, chestY - 0.01, 0.01], [0, shoulderY + 0.022, 0.012], [0.204, 0.141], [0.216, 0.139], 8,
    look.jacket, W('spine', 'chest', 0.5), W('chest'), { capStart: false, capEnd: false }
  );
  // shoulder line
  builder.prism(
    [0, shoulderY + 0.008, 0.012], [0, shoulderY + 0.042, 0.01], [0.212, 0.136], [0.15, 0.102], 8,
    look.jacket, W('chest'), W('chest'), { capStart: false, capEnd: true }
  );

  // belt and buckle
  builder.prism(
    [0, hipY + 0.055, 0.004], [0, hipY + 0.105, 0.006], [0.202, 0.141], [0.203, 0.142], 8,
    palette.belt, W('hips'), W('hips'), { capStart: false, capEnd: false }
  );
  builder.box([0, hipY + 0.08, 0.147], [0.055, 0.038, 0.014], palette.gold, W('hips'));
  builder.box([0, hipY + 0.08, 0.154], [0.032, 0.020, 0.006], palette.belt, W('hips'));

  // shirt front and jacket lapels
  const shirtTop = shoulderY + 0.005;
  const shirtBottom = chestY - 0.075;
  builder.box([0, (shirtTop + shirtBottom) / 2, 0.148], [0.142, shirtTop - shirtBottom, 0.014], look.shirt, W('chest'));
  builder.box([-0.103, (shirtTop + shirtBottom) / 2 + 0.01, 0.15], [0.056, shirtTop - shirtBottom + 0.02, 0.016], look.jacket, W('chest'), new THREE.Euler(0, 0, -0.22));
  builder.box([0.103, (shirtTop + shirtBottom) / 2 + 0.01, 0.15], [0.056, shirtTop - shirtBottom + 0.02, 0.016], look.jacket, W('chest'), new THREE.Euler(0, 0, 0.22));
  if (look.tieStyle === 'tie') {
    builder.box([0, chestY + 0.045, 0.163], [0.034, 0.215, 0.012], look.tie, W('chest'));
    builder.box([0, shoulderY + 0.005, 0.163], [0.046, 0.038, 0.015], look.tie, W('chest'));
  } else if (look.tieStyle === 'bow') {
    builder.box([-0.034, shoulderY + 0.005, 0.162], [0.055, 0.038, 0.013], look.tie, W('chest'), new THREE.Euler(0, 0, 0.18));
    builder.box([0.034, shoulderY + 0.005, 0.162], [0.055, 0.038, 0.013], look.tie, W('chest'), new THREE.Euler(0, 0, -0.18));
    builder.blob([0, shoulderY + 0.005, 0.168], [0.014, 0.014, 0.012], palette.gold, W('chest'));
  }
  if (look.vest) {
    const vestCenter = (chestY + shoulderY) / 2 - 0.015;
    for (const side of [-1, 1]) {
      builder.box([side * 0.092, vestCenter, 0.151], [0.09, shoulderY - chestY + 0.04, 0.018], look.jacket, W('spine', 'chest', 0.6), new THREE.Euler(0, 0, -side * 0.05));
    }
    for (let i = 0; i < 3; i++) {
      builder.blob([0.01, chestY - 0.065 + i * 0.055, 0.163], [0.007, 0.007, 0.005], palette.gold, W('spine'));
    }
  }
  for (let i = 0; i < 3; i++) {
    builder.blob([0, chestY - 0.045 + i * 0.06, 0.158], [0.006, 0.006, 0.005], palette.dark, W('spine', 'chest', 0.55));
  }
  if (look.pocket) {
    builder.box([0.118, chestY - 0.055, 0.152], [0.055, 0.03, 0.012], look.shirt, W('spine'));
  }
  if (look.pocketSquare) {
    builder.box([0.115, shoulderY - 0.065, 0.158], [0.045, 0.022, 0.008], look.accent, W('chest'));
  }

  // shoulders
  for (const side of [-1, 1]) {
    builder.blob([side * 0.166, shoulderY - 0.022, 0.02], [0.058, 0.052, 0.062], look.jacket, W('chest'));
    builder.blob([side * 0.208, shoulderY - 0.038, 0.028], [0.046, 0.046, 0.048], look.jacket, W('chest'));
  }

  // neck
  builder.prism(
    [0, neckY - 0.015, 0.015], [0, headY + 0.005, 0.015], [0.056, 0.054], [0.064, 0.06], 6,
    palette.skin, [[bones.neck, 1]], [[bones.head, 0.7], [bones.neck, 0.3]], { capStart: false, capEnd: false }
  );
}

function addHead(builder, skeleton, palette, look) {
  const bones = skeleton.byName;
  const dy = skeleton.absolute.get('head').y - 1.17;
  const P = (x, y, z) => [x, y + dy, z];
  const head = [[bones.head, 1]];
  // skull
  builder.blob(P(0, 1.295, 0.02), [0.104, 0.126, 0.106], palette.skin, head);
  // angular jaw
  builder.prism(
    P(0, 1.17, 0.038), P(0, 1.245, 0.026), [0.06, 0.058], [0.086, 0.09], 6,
    palette.skin, head, head, { capStart: true, capEnd: false }
  );
  // cheek plane
  builder.blob(P(0, 1.243, 0.06), [0.06, 0.042, 0.03], palette.skin, head);
  // ears
  for (const side of [-1, 1]) {
    builder.blob(P(side * 0.105, 1.268, 0.015), [0.017, 0.03, 0.014], palette.skin, head);
    if (look.earrings) builder.blob(P(side * 0.107, 1.225, 0.02), [0.009, 0.011, 0.009], palette.gold, head);
  }
  // recessed sockets, brow ridge and nose
  builder.box(P(-0.039, 1.284, 0.096), [0.044, 0.024, 0.008], palette.skinShade, head);
  builder.box(P(0.039, 1.284, 0.096), [0.044, 0.024, 0.008], palette.skinShade, head);
  builder.box(P(0, 1.322, 0.108), [0.12, 0.012, 0.022], palette.skin, head);
  builder.blob(P(0, 1.277, 0.111), [0.014, 0.024, 0.018], palette.skin, head);
  builder.box(P(-0.043, 1.326, 0.114), [0.038, 0.007, 0.01], palette.hair, head, new THREE.Euler(0, 0, 0.07));
  builder.box(P(0.043, 1.326, 0.114), [0.038, 0.007, 0.01], palette.hair, head, new THREE.Euler(0, 0, -0.07));
  // mouth
  builder.box(P(0, 1.208, 0.108), [0.046, 0.006, 0.008], palette.mouth, head);
  if (look.beard) {
    builder.blob(P(0, 1.187, 0.06), [0.086, 0.07, 0.075], palette.beard, head);
    builder.box(P(0, 1.228, 0.114), [0.062, 0.012, 0.012], palette.beard, head);
  }
}

function buildBodyGeometry(skeleton, look, palette) {
  const builder = new LowPolyBuilder(skeleton.bones);
  addTorso(builder, skeleton, palette, look);
  for (const side of [-1, 1]) {
    addArm(builder, skeleton.arms[side], skeleton.byName, palette, look);
    addLeg(builder, skeleton.legs[side], skeleton.byName, palette, look, skeleton.pose);
  }
  addHead(builder, skeleton, palette, look);
  return builder.build();
}

/* ---------------- separate head pieces ------------------------------ */

function lowSphere(widthSegments = 8, heightSegments = 5, phiStart = 0, phiLength = Math.PI * 2, thetaStart = 0, thetaLength = Math.PI) {
  return new THREE.SphereGeometry(1, widthSegments, heightSegments, phiStart, phiLength, thetaStart, thetaLength);
}

function addHair(head, look, materials) {
  const hair = materials.hair;
  const group = new THREE.Group();
  const style = look.hairStyle || 'short';
  if (look.hat) {
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.155, 0.158, 0.012, 8), materials.hat);
    brim.position.set(0, 0.222, 0.012);
    brim.rotation.y = Math.PI / 8;
    group.add(brim);
    const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.082, 0.11, 0.092, 8), materials.hat);
    crown.position.set(0, 0.272, 0.005);
    crown.rotation.y = Math.PI / 8;
    group.add(crown);
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.1085, 0.1105, 0.022, 8), materials.band);
    band.position.set(0, 0.232, 0.006);
    band.rotation.y = Math.PI / 8;
    group.add(band);
    if (style !== 'bald') {
      const sideburnL = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.055, 0.045), hair);
      sideburnL.position.set(-0.095, 0.175, 0.02);
      group.add(sideburnL);
      const sideburnR = sideburnL.clone();
      sideburnR.position.x *= -1;
      group.add(sideburnR);
    }
  } else if (style !== 'bald') {
    const cap = new THREE.Mesh(lowSphere(9, 5, 0, Math.PI * 2, 0, Math.PI * 0.53), hair);
    cap.scale.set(0.116, 0.12, 0.12);
    cap.position.set(0, 0.172, -0.012);
    group.add(cap);
    for (const side of [-1, 1]) {
      const sideburn = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.08, 0.06), hair);
      sideburn.position.set(side * 0.098, 0.14, 0.018);
      sideburn.rotation.z = side * 0.05;
      group.add(sideburn);
    }
    const nape = new THREE.Mesh(new THREE.BoxGeometry(0.145, 0.095, 0.045), hair);
    nape.position.set(0, 0.105, -0.1);
    group.add(nape);
    if (style === 'silver') {
      const part = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.02, 0.1), hair);
      part.position.set(-0.035, 0.232, 0.035);
      part.rotation.z = 0.18;
      group.add(part);
      const fringe = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.016, 0.03), hair);
      fringe.position.set(0.032, 0.208, 0.085);
      fringe.rotation.z = -0.1;
      group.add(fringe);
    }
    if (style === 'bun') {
      const bun = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 0), hair);
      bun.scale.set(0.055, 0.055, 0.05);
      bun.position.set(0, 0.17, -0.125);
      group.add(bun);
    }
    if (style === 'bob' || style === 'long') {
      for (const side of [-1, 1]) {
        const slab = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.155, 0.115), hair);
        slab.position.set(side * 0.098, 0.085, -0.015);
        slab.rotation.z = side * 0.06;
        group.add(slab);
      }
      const back = new THREE.Mesh(new THREE.BoxGeometry(0.17, style === 'long' ? 0.26 : 0.15, 0.045), hair);
      back.position.set(0, style === 'long' ? 0.045 : 0.10, -0.115);
      group.add(back);
    }
  }
  if (look.glasses || look.sunglasses) {
    const frameMat = look.sunglasses ? materials.dark : materials.gold;
    const lensMat = look.sunglasses ? materials.lensDark : materials.lens;
    for (const side of [-1, 1]) {
      const lens = new THREE.Mesh(new THREE.BoxGeometry(0.055, look.sunglasses ? 0.032 : 0.034, 0.006), lensMat);
      lens.position.set(side * 0.044, 0.102, 0.128);
      group.add(lens);
      const barTop = new THREE.Mesh(new THREE.BoxGeometry(0.058, 0.005, 0.006), frameMat);
      barTop.position.set(side * 0.044, 0.121, 0.128);
      group.add(barTop);
      const barBottom = barTop.clone();
      barBottom.position.y = 0.083;
      group.add(barBottom);
      const barSide = new THREE.Mesh(new THREE.BoxGeometry(0.005, 0.043, 0.006), frameMat);
      barSide.position.set(side * 0.0725, 0.102, 0.128);
      group.add(barSide);
    }
    const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.005, 0.006), frameMat);
    bridge.position.set(0, 0.112, 0.129);
    group.add(bridge);
    for (const side of [-1, 1]) {
      const temple = new THREE.Mesh(new THREE.BoxGeometry(0.004, 0.005, 0.105), frameMat);
      temple.position.set(side * 0.076, 0.112, 0.075);
      group.add(temple);
    }
  }
  group.traverse((object) => {
    if (object.isMesh) {
      object.castShadow = true;
      object.receiveShadow = true;
    }
  });
  head.add(group);
  return group;
}

function addEyes(head, look, materials) {
  const eyes = [];
  for (const side of [-1, 1]) {
    const group = new THREE.Group();
    group.position.set(side * 0.039, 0.101, 0.103);
    const white = new THREE.Mesh(new THREE.SphereGeometry(1, 8, 6), materials.eyeWhite);
    white.scale.set(0.0125, 0.0085, 0.0068);
    group.add(white);
    if (!look.sunglasses) {
      const iris = new THREE.Mesh(new THREE.SphereGeometry(1, 7, 5), materials.iris);
      iris.scale.set(0.0056, 0.0056, 0.0028);
      iris.position.z = 0.0064;
      group.add(iris);
      const pupil = new THREE.Mesh(new THREE.SphereGeometry(1, 6, 4), materials.pupil);
      pupil.scale.set(0.0028, 0.0028, 0.0016);
      pupil.position.z = 0.0082;
      group.add(pupil);
      const lid = new THREE.Mesh(new THREE.BoxGeometry(0.026, 0.006, 0.009), materials.skin);
      lid.position.set(0, 0.0068, 0.003);
      group.add(lid);
    }
    group.traverse((object) => { if (object.isMesh) object.castShadow = false; });
    head.add(group);
    eyes.push(group);
  }
  return eyes;
}

/* ---------------- public model -------------------------------------- */

export function buildCharacterModel(look, pose = 'seated') {
  const skeleton = createSkeleton(pose);
  const palette = {
    skin: look.skin,
    skinShade: look.skinShade || look.skin,
    shirt: look.shirt,
    belt: look.belt || '#2a1c12',
    gold: look.gold || '#b08b52',
    dark: '#1b1714',
    mouth: '#6a3b34',
    hair: look.hair,
    beard: look.beardColour || look.hair
  };
  const geometry = buildBodyGeometry(skeleton, look, palette);
  const material = torsoMaterial();
  material.vertexColors = true;
  const mesh = new THREE.SkinnedMesh(geometry, material);
  mesh.name = 'body';
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.frustumCulled = false;

  const group = new THREE.Group();
  group.add(mesh);
  for (const bone of skeleton.bones) if (!bone.parent) mesh.add(bone);
  group.updateMatrixWorld(true);
  skeleton.skeleton = new THREE.Skeleton(skeleton.bones);
  mesh.bind(skeleton.skeleton);

  const materials = {
    hair: accessoryMaterial(look.hair, { roughness: 0.94 }),
    hat: accessoryMaterial(look.hatColour || '#b59a6b', { roughness: 0.85 }),
    beard: accessoryMaterial(look.beardColour || look.hair, { roughness: 0.92 }),
    band: accessoryMaterial(look.bandColour || '#3c2a1a', { roughness: 0.8 }),
    gold: accessoryMaterial(look.gold || '#b08c55', { roughness: 0.32, metalness: 0.75 }),
    dark: accessoryMaterial('#15161a', { roughness: 0.42 }),
    lensDark: accessoryMaterial('#0a0b0d', { roughness: 0.16, metalness: 0.35 }),
    lens: accessoryMaterial('#dfe7ea', { roughness: 0.12, metalness: 0.05, transparent: true, opacity: 0.22 }),
    eyeWhite: accessoryMaterial('#b8ab97', { roughness: 0.5 }),
    skin: accessoryMaterial(look.skin, { roughness: 0.72 }),
    iris: accessoryMaterial(look.eyes || '#3a2a20', { roughness: 0.3 }),
    pupil: accessoryMaterial('#090807', { roughness: 0.2 })
  };

  addHair(skeleton.head, look, materials);
  const eyes = addEyes(skeleton.head, look, materials);

  return {
    group,
    mesh,
    skeleton: skeleton.skeleton,
    bones: skeleton.byName,
    boneList: skeleton.bones,
    arms: skeleton.arms,
    legs: skeleton.legs,
    head: skeleton.head,
    hips: skeleton.hips,
    eyeL: eyes[0],
    eyeR: eyes[1],
    materials,
    look,
    pose
  };
}

/* First-person hands and forearms. These are a separate skinned rig
   living in world space so they sit exactly on the real table edge. */
export function buildPlayerHandsModel(look) {
  const bonesList = [];
  const byName = {};
  const defs = [];
  const arms = {};
  for (const side of [-1, 1]) {
    const tag = side < 0 ? 'L' : 'R';
    const shoulder = new THREE.Vector3(side * 0.34, 0.7, 1.02);
    const elbow = new THREE.Vector3(side * 0.36, 0.58, 0.84);
    const wrist = new THREE.Vector3(side * 0.23, 0.9, 0.64);
    defs.push(
      [`upperArm${tag}`, null, shoulder.toArray()],
      [`forearm${tag}`, `upperArm${tag}`, elbow.toArray()],
      [`hand${tag}`, `forearm${tag}`, wrist.toArray()]
    );
    const fingers = [];
    FINGER_NAMES.forEach((name, index) => {
      const lateral = -side * FINGER_X[index] * 0.78;
      const base1 = wrist.clone().add(new THREE.Vector3(lateral, -0.004, -0.076));
      const base2 = base1.clone().add(new THREE.Vector3(0, 0.002, -0.036));
      const tip = base2.clone().add(new THREE.Vector3(0, 0.001, -0.029));
      defs.push([`${name}${tag}1`, `hand${tag}`, base1.toArray()], [`${name}${tag}2`, `${name}${tag}1`, base2.toArray()]);
      fingers.push({ name, bone1: `${name}${tag}1`, bone2: `${name}${tag}2`, base1, base2, tip });
    });
    const thumb1 = wrist.clone().add(new THREE.Vector3(-side * 0.044, -0.012, -0.028));
    const thumb2 = thumb1.clone().add(new THREE.Vector3(-side * 0.014, -0.003, -0.033));
    const thumbTip = thumb2.clone().add(new THREE.Vector3(0, 0.002, -0.028));
    defs.push([`thumb${tag}1`, `hand${tag}`, thumb1.toArray()], [`thumb${tag}2`, `thumb${tag}1`, thumb2.toArray()]);
    fingers.push({ name: 'thumb', bone1: `thumb${tag}1`, bone2: `thumb${tag}2`, base1: thumb1, base2: thumb2, tip: thumbTip });
    arms[side] = { side, tag, shoulder, elbow, wrist, fingers };
  }
  const absolute = new Map();
  for (const [name, parent, position] of defs) {
    const bone = new THREE.Bone();
    bone.name = name;
    const point = new THREE.Vector3(...position);
    if (parent) {
      const parentPoint = absolute.get(parent);
      bone.position.copy(point).sub(parentPoint);
      byName[parent].add(bone);
    } else {
      bone.position.copy(point);
    }
    absolute.set(name, point);
    byName[name] = bone;
    bonesList.push(bone);
  }
  for (const side of [-1, 1]) {
    const arm = arms[side];
    const tag = arm.tag;
    arm.upper = byName[`upperArm${tag}`];
    arm.fore = byName[`forearm${tag}`];
    arm.hand = byName[`hand${tag}`];
    arm.upperDir = arm.elbow.clone().sub(arm.shoulder).normalize();
    arm.foreDir = arm.wrist.clone().sub(arm.elbow).normalize();
    arm.handDir = new THREE.Vector3(0, 0, -1);
    arm.upperLength = arm.elbow.distanceTo(arm.shoulder);
    arm.foreLength = arm.wrist.distanceTo(arm.elbow);
    arm.fingerBones = arm.fingers.map((finger) => ({
      ...finger, b1: byName[finger.bone1], b2: byName[finger.bone2]
    }));
  }

  const builder = new LowPolyBuilder(bonesList);
  const skin = look.skin;
  const sleeve = look.jacket || '#1c222c';
  const cuff = look.shirt || '#cdbfa9';
  for (const side of [-1, 1]) {
    const arm = arms[side];
    const { shoulder, elbow, wrist } = arm;
    const upper = arm.upper;
    const fore = arm.fore;
    const hand = arm.hand;
    const sleeveStart = wrist.clone().addScaledVector(arm.foreDir, -0.11);
    builder.prism(
      sleeveStart, wrist, [0.026, 0.024], [0.028, 0.026], 7,
      sleeve, [[fore, 1]], [[fore, 1]], { capStart: false, capEnd: false }
    );
    const cuffStart = wrist.clone().add(new THREE.Vector3(0, 0, 0.012));
    builder.prism(
      cuffStart, wrist, [0.03, 0.028], [0.029, 0.027], 6,
      cuff, [[fore, 1]], [[fore, 1]], { capStart: true, capEnd: false }
    );
    builder.prism(
      wrist, wrist.clone().add(new THREE.Vector3(0, 0, -0.095)),
      [0.038, 0.016], [0.041, 0.013], 6,
      skin, [[hand, 1]], [[hand, 1]], { capStart: true, capEnd: true }
    );
    for (const finger of arm.fingerBones) {
      const thick = finger.name === 'thumb' ? 0.0115 : 0.0105;
      builder.prism(finger.base1, finger.base2, thick, thick * 0.92, 6, skin, [[finger.b1, 1]], [[finger.b1, 1]], { capStart: false, capEnd: false });
      builder.prism(finger.base2, finger.tip, thick * 0.92, thick * 0.68, 6, skin, [[finger.b2, 1]], [[finger.b2, 1]], { capStart: false });
      builder.blob(finger.base2, [thick * 0.95, thick * 0.95, thick * 0.95], skin, [[finger.b1, 0.5], [finger.b2, 0.5]]);
    }
  }

  const geometry = builder.build();
  const material = torsoMaterial();
  material.color.set('#d6ccc0');
  material.roughness = 1.0;
  const mesh = new THREE.SkinnedMesh(geometry, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.frustumCulled = false;
  const group = new THREE.Group();
  group.add(mesh);
  for (const bone of bonesList) if (!bone.parent) mesh.add(bone);
  group.updateMatrixWorld(true);
  const skeleton = new THREE.Skeleton(bonesList);
  mesh.bind(skeleton);

  return { group, mesh, skeleton, bones: byName, boneList: bonesList, arms, look };
}
