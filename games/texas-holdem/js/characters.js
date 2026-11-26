/* =====================================================================
   TEXAS HOLD'EM — the people at the table
   Built from primitives with enough detail to read as real people in
   warm, low light. Each opponent has a distinct face, suit and idle life.
   ===================================================================== */

import * as THREE from 'three';
import { RoundedBoxGeometry } from '../../../vendor/three/RoundedBoxGeometry.js';

export const CHARACTER_LOOKS = [
  {
    skin: '#8d5f43', skinShade: '#70482f', jacket: '#20242b', shirt: '#ded6c6', accent: '#70603f',
    hair: '#a9a49a', hairStyle: 'silver', tie: '#4e3823', eyes: '#4b3c2e', tieStyle: 'tie', pocket: true
  },
  {
    skin: '#b77a58', skinShade: '#97603f', jacket: '#56212b', shirt: '#f1e8da', accent: '#c39d5d',
    hair: '#241a16', hairStyle: 'bun', tie: '#c39d5d', eyes: '#2c1e18', tieStyle: 'none', earrings: true
  },
  {
    skin: '#cfa17d', skinShade: '#ae8060', jacket: '#3b3b2e', shirt: '#e8e0cf', accent: '#7f2d2b',
    hair: '#66594a', hairStyle: 'short', tie: '#7f2d2b', eyes: '#3c4b5b', tieStyle: 'bow', glasses: true
  },
  {
    skin: '#e2bb98', skinShade: '#c49a77', jacket: '#141a22', shirt: '#f0e9dd', accent: '#a4adb7',
    hair: '#12100f', hairStyle: 'bob', tie: '#262f3a', eyes: '#191c22', tieStyle: 'none', sunglasses: true
  },
  {
    skin: '#c18860', skinShade: '#9f6a45', jacket: '#6d5a3b', shirt: '#f3e6ce', accent: '#892b21',
    hair: '#2b211a', hairStyle: 'bald', tie: '#892b21', eyes: '#3b2c20', tieStyle: 'tie', beard: true
  },
  {
    skin: '#d7a07b', skinShade: '#b8805c', jacket: '#213d34', shirt: '#f0e6d4', accent: '#a67c3c',
    hair: '#6e291a', hairStyle: 'long', tie: '#a67c3c', eyes: '#2c1d17', tieStyle: 'none', earrings: true
  }
];

function material(colour, options = {}) {
  return new THREE.MeshStandardMaterial({
    color: colour,
    roughness: options.roughness ?? 0.72,
    metalness: options.metalness ?? 0,
    ...options
  });
}

function addMesh(parent, geometry, mat, x = 0, y = 0, z = 0, cast = true) {
  const mesh = new THREE.Mesh(geometry, mat);
  mesh.position.set(x, y, z);
  mesh.castShadow = cast;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function roundedBox(width, height, depth, radius, materialRef, x, y, z, cast = true) {
  const geometry = new RoundedBoxGeometry(width, height, depth, 3, radius);
  return addMesh(this, geometry, materialRef, x, y, z, cast);
}

function makeHand(skinMat, cuffMat, goldMat) {
  const group = new THREE.Group();
  const palm = addMesh(group, new RoundedBoxGeometry(0.075, 0.035, 0.1, 3, 0.012), skinMat, 0, 0, 0.04);
  palm.scale.set(1, 0.8, 1);
  const cuff = addMesh(group, new THREE.CylinderGeometry(0.055, 0.06, 0.03, 16), cuffMat, 0, 0, -0.025);
  cuff.rotation.x = Math.PI / 2;
  addMesh(group, new THREE.SphereGeometry(0.007, 8, 8), goldMat, 0.034, 0.01, -0.025, false);
  for (let i = 0; i < 4; i++) {
    const finger = addMesh(group, new THREE.CapsuleGeometry(0.0116, 0.055 - Math.abs(i - 1.5) * 0.008, 3, 8), skinMat, -0.03 + i * 0.021, -0.006, 0.115 - Math.abs(i - 1.5) * 0.008, false);
    finger.rotation.x = Math.PI / 2.2;
  }
  const thumb = addMesh(group, new THREE.CapsuleGeometry(0.014, 0.045, 3, 8), skinMat, 0.052, -0.004, 0.065, false);
  thumb.rotation.set(Math.PI / 2.4, 0, -0.65);
  return group;
}

function makeEye(irisColour) {
  const group = new THREE.Group();
  addMesh(group, new THREE.SphereGeometry(0.021, 14, 12), material('#f0e9dd', { roughness: 0.4 }), 0, 0, 0, false);
  addMesh(group, new THREE.SphereGeometry(0.0105, 12, 10), material(irisColour, { roughness: 0.3 }), 0, 0, 0.0155, false);
  addMesh(group, new THREE.SphereGeometry(0.0048, 8, 8), material('#0b0908', { roughness: 0.2 }), 0, 0, 0.023, false);
  return group;
}

function makeGlasses(goldMat, lensMat, style) {
  const group = new THREE.Group();
  for (const side of [-1, 1]) {
    addMesh(group, new THREE.TorusGeometry(0.035, 0.0045, 8, 22), goldMat, side * 0.052, 0, 0, false);
    const lens = addMesh(group, new THREE.CircleGeometry(0.031, 20), lensMat, side * 0.052, 0, 0.001, false);
    if (style === 'sunglasses') lens.scale.set(1, 0.78, 1);
    else lens.material.opacity = 0.18;
  }
  addMesh(group, new THREE.BoxGeometry(0.035, 0.006, 0.006), goldMat, 0, 0.006, 0, false);
  return group;
}

function buildHead(look, mats) {
  const head = new THREE.Group();
  head.position.set(0, 1.395, 0.015);

  const skull = addMesh(head, new THREE.SphereGeometry(0.13, 28, 22), mats.skin, 0, 0, 0);
  skull.scale.set(1, 1.17, 1.02);
  // jaw / chin
  const jaw = addMesh(head, new THREE.SphereGeometry(0.097, 22, 16), mats.skin, 0, -0.075, 0.014);
  jaw.scale.set(0.96, 0.8, 0.92);
  // ears
  for (const side of [-1, 1]) {
    const ear = addMesh(head, new THREE.SphereGeometry(0.026, 12, 10), mats.skin, side * 0.124, -0.005, -0.005, false);
    ear.scale.set(0.55, 1, 0.75);
    if (look.earrings) addMesh(head, new THREE.SphereGeometry(0.009, 10, 8), mats.gold, side * 0.124, -0.048, 0, false);
  }
  // nose
  const nose = addMesh(head, new THREE.SphereGeometry(0.024, 12, 10), mats.skin, 0, -0.012, 0.123, false);
  nose.scale.set(0.82, 1.3, 0.9);
  // brows
  for (const side of [-1, 1]) {
    const brow = addMesh(head, new THREE.BoxGeometry(0.055, 0.009, 0.01), mats.brow, side * 0.048, 0.055, 0.117, false);
    brow.rotation.z = side * -0.09;
  }
  // eyes
  const eyeL = makeEye(look.eyes);
  eyeL.position.set(-0.049, 0.029, 0.108);
  const eyeR = makeEye(look.eyes);
  eyeR.position.set(0.049, 0.029, 0.108);
  head.add(eyeL, eyeR);
  // mouth
  const mouth = addMesh(head, new THREE.BoxGeometry(0.052, 0.009, 0.008), material('#6e3d36', { roughness: 0.5 }), 0, -0.075, 0.117, false);
  // hair
  const hairMat = material(look.hair, { roughness: 0.85 });
  if (look.hairStyle !== 'bald') {
    const cap = addMesh(head, new THREE.SphereGeometry(0.138, 26, 18), hairMat, 0, 0.038, -0.038);
    cap.scale.set(1.02, 1.04, 1.03);
  }
  if (look.hairStyle === 'bun') {
    const bun = addMesh(head, new THREE.SphereGeometry(0.055, 14, 12), hairMat, 0, 0.075, -0.145);
    bun.scale.set(1, 1, 0.85);
    for (const side of [-1, 1]) {
      const sideHair = addMesh(head, new THREE.CapsuleGeometry(0.022, 0.1, 3, 8), hairMat, side * 0.128, -0.02, -0.02);
      sideHair.rotation.z = side * 0.18;
    }
  }
  if (look.hairStyle === 'bob' || look.hairStyle === 'long') {
    for (const side of [-1, 1]) {
      const sideHair = addMesh(head, new THREE.CapsuleGeometry(0.033, 0.13, 3, 8), hairMat, side * 0.112, -0.06, -0.018);
      sideHair.rotation.z = side * 0.18;
    }
    if (look.hairStyle === 'long') {
      addMesh(head, new RoundedBoxGeometry(0.19, 0.26, 0.07, 3, 0.03), hairMat, 0, -0.16, -0.1);
    }
  }
  if (look.hairStyle === 'silver') {
    const sweep = addMesh(head, new THREE.CapsuleGeometry(0.04, 0.1, 3, 8), hairMat, -0.035, 0.08, 0.075);
    sweep.rotation.z = 1.15;
    sweep.rotation.x = 0.4;
  }
  // beard / moustache
  if (look.beard) {
    const beard = addMesh(head, new THREE.SphereGeometry(0.093, 18, 14, 0, Math.PI * 2, Math.PI * 0.48, Math.PI * 0.45), hairMat, 0, -0.033, 0.018);
    beard.scale.set(1.08, 1.22, 1.04);
    addMesh(head, new THREE.BoxGeometry(0.058, 0.012, 0.012), hairMat, 0, -0.055, 0.117, false);
  }
  if (look.sunglasses) {
    const glasses = makeGlasses(mats.darkMetal, material('#0a0b0c', { roughness: 0.12, metalness: 0.4 }), 'sunglasses');
    glasses.position.set(0, 0.028, 0.118);
    head.add(glasses);
  } else if (look.glasses) {
    const glasses = makeGlasses(mats.gold, material('#dfe7ea', { roughness: 0.1, metalness: 0.1, transparent: true, opacity: 0.18 }), 'glasses');
    glasses.position.set(0, 0.028, 0.118);
    head.add(glasses);
  }
  return { head, eyeL, eyeR, mouth };
}

export function buildSeatedCharacter(look, index) {
  const group = new THREE.Group();
  group.userData.look = look;
  const mats = {
    skin: material(look.skin, { roughness: 0.62 }),
    skinShade: material(look.skinShade, { roughness: 0.68 }),
    jacket: material(look.jacket, { roughness: 0.62 }),
    shirt: material(look.shirt, { roughness: 0.7 }),
    tie: material(look.tie, { roughness: 0.55 }),
    hair: material(look.hair, { roughness: 0.85 }),
    brow: material(look.hair, { roughness: 0.9 }),
    gold: material('#b8935a', { roughness: 0.3, metalness: 0.85 }),
    darkMetal: material('#22252a', { roughness: 0.3, metalness: 0.7 })
  };

  // lower body / lap
  addMesh(group, new RoundedBoxGeometry(0.4, 0.24, 0.32, 3, 0.06), mats.jacket, 0, 0.63, 0.02);

  // torso
  const torso = new THREE.Group();
  torso.position.y = 0.98;
  group.add(torso);
  addMesh(torso, new RoundedBoxGeometry(0.46, 0.5, 0.3, 4, 0.07), mats.jacket, 0, 0, 0);
  // shirt front
  addMesh(torso, new RoundedBoxGeometry(0.19, 0.36, 0.018, 2, 0.008), mats.shirt, 0, 0.01, 0.148);
  // lapels
  for (const side of [-1, 1]) {
    const lapel = addMesh(torso, new THREE.BoxGeometry(0.075, 0.32, 0.014), mats.jacket, side * 0.115, 0.03, 0.158);
    lapel.rotation.z = side * 0.24;
    lapel.rotation.x = -0.05;
  }
  if (look.tieStyle === 'tie') {
    const tie = addMesh(torso, new THREE.BoxGeometry(0.042, 0.23, 0.012), mats.tie, 0, 0.02, 0.165);
    tie.rotation.x = -0.04;
    addMesh(torso, new THREE.BoxGeometry(0.055, 0.035, 0.014), mats.tie, 0, 0.145, 0.166);
  } else if (look.tieStyle === 'bow') {
    for (const side of [-1, 1]) {
      const bow = addMesh(torso, new THREE.BoxGeometry(0.055, 0.04, 0.014), mats.tie, side * 0.038, 0.16, 0.166);
      bow.rotation.z = side * 0.2;
    }
    addMesh(torso, new THREE.SphereGeometry(0.014, 10, 8), mats.tie, 0, 0.16, 0.17, false);
  }
  if (look.pocket) {
    addMesh(torso, new THREE.BoxGeometry(0.07, 0.035, 0.01), mats.shirt, 0.12, -0.13, 0.153, false);
  }
  // shoulders
  for (const side of [-1, 1]) {
    addMesh(torso, new THREE.SphereGeometry(0.092, 16, 12), mats.jacket, side * 0.215, 0.11, 0);
    addMesh(torso, new THREE.SphereGeometry(0.07, 12, 10), mats.jacket, side * 0.25, 0.02, 0.01);
  }

  // arms, articulated at the shoulder
  const arms = [];
  for (const side of [-1, 1]) {
    const pivot = new THREE.Group();
    pivot.position.set(side * 0.235, 1.08, 0.02);
    group.add(pivot);
    const upper = addMesh(pivot, new THREE.CapsuleGeometry(0.055, 0.26, 4, 10), mats.jacket, 0, -0.13, 0.015);
    upper.rotation.z = side * 0.22;
    const elbow = new THREE.Group();
    elbow.position.set(side * 0.035, -0.27, 0.03);
    pivot.add(elbow);
    addMesh(elbow, new THREE.SphereGeometry(0.056, 12, 10), mats.jacket, 0, 0, 0);
    const forearm = addMesh(elbow, new THREE.CapsuleGeometry(0.048, 0.25, 4, 10), mats.jacket, 0, -0.1, 0.1);
    forearm.rotation.x = Math.PI / 2.6;
    forearm.rotation.z = side * -0.06;
    addMesh(elbow, new THREE.CylinderGeometry(0.047, 0.051, 0.022, 14), mats.shirt, 0, -0.17, 0.205).rotation.x = Math.PI / 2.6;
    const hand = makeHand(mats.skin, mats.shirt, mats.gold);
    hand.position.set(side * 0.005, -0.16, 0.235);
    hand.rotation.x = -0.38;
    elbow.add(hand);
    arms.push({ pivot, elbow, hand, side });
  }

  // neck
  addMesh(group, new THREE.CylinderGeometry(0.052, 0.062, 0.09, 16), mats.skin, 0, 1.25, 0.01);

  const { head, eyeL, eyeR, mouth } = buildHead(look, mats);
  group.add(head);

  const rig = {
    group,
    index,
    look,
    torso,
    head,
    eyeL,
    eyeR,
    mouth,
    arms,
    headBase: head.rotation.clone(),
    blinkAt: 2 + Math.random() * 3,
    blinkUntil: 0,
    glanceAt: 0,
    glanceYaw: 0,
    glancePitch: 0,
    phase: Math.random() * Math.PI * 2,
    mood: 'idle',
    dealPulse: 0
  };
  return rig;
}

/* The house dealer, standing at the far rail. */
export function buildDealer() {
  const group = new THREE.Group();
  const mats = {
    skin: material('#9a6b4c', { roughness: 0.62 }),
    shirt: material('#efe8da', { roughness: 0.7 }),
    vest: material('#1b1e24', { roughness: 0.5 }),
    trousers: material('#141518', { roughness: 0.8 }),
    hair: material('#2a211a', { roughness: 0.85 }),
    gold: material('#b8935a', { roughness: 0.3, metalness: 0.85 }),
    darkMetal: material('#22252a', { roughness: 0.3, metalness: 0.7 }),
    brow: material('#2a211a', { roughness: 0.9 })
  };
  // legs / shoes
  for (const side of [-1, 1]) {
    addMesh(group, new THREE.CapsuleGeometry(0.075, 0.72, 4, 10), mats.trousers, side * 0.105, 0.45, 0);
    const shoe = addMesh(group, new RoundedBoxGeometry(0.11, 0.06, 0.24, 3, 0.03), material('#0b0b0b', { roughness: 0.4 }), side * 0.105, 0.04, 0.045);
  }
  addMesh(group, new RoundedBoxGeometry(0.42, 0.22, 0.3, 3, 0.06), mats.trousers, 0, 0.86, 0);
  // waistcoat
  addMesh(group, new RoundedBoxGeometry(0.44, 0.52, 0.28, 4, 0.06), mats.vest, 0, 1.18, 0);
  addMesh(group, new RoundedBoxGeometry(0.16, 0.43, 0.018, 2, 0.008), mats.shirt, 0, 1.16, 0.14);
  // bow tie and buttons
  for (const side of [-1, 1]) {
    const bow = addMesh(group, new THREE.BoxGeometry(0.052, 0.035, 0.012), mats.gold, side * 0.033, 1.4, 0.155, false);
    bow.rotation.z = side * 0.2;
  }
  for (let i = 0; i < 3; i++) addMesh(group, new THREE.SphereGeometry(0.009, 8, 8), mats.gold, 0, 1.26 - i * 0.07, 0.148, false);
  // head
  const look = { skin: '#9a6b4c', hair: '#2a211a', hairStyle: 'short', eyes: '#33261c', tieStyle: 'bow', glasses: false };
  const { head, eyeL, eyeR } = buildHead(look, mats);
  head.position.y = 1.65;
  group.add(head);
  addMesh(group, new THREE.CylinderGeometry(0.055, 0.065, 0.1, 16), mats.skin, 0, 1.5, 0.01);
  // dealer visor
  const visor = addMesh(group, new THREE.BoxGeometry(0.23, 0.012, 0.11), material('#1a1a1c', { roughness: 0.5 }), 0, 1.79, 0.08, false);
  visor.rotation.x = 0.12;
  addMesh(group, new THREE.CylinderGeometry(0.12, 0.13, 0.035, 16, 1, true), material('#1a1a1c', { roughness: 0.6 }), 0, 1.74, 0.01, false);
  // name badge
  addMesh(group, new THREE.BoxGeometry(0.11, 0.022, 0.008), mats.gold, 0.12, 1.18, 0.148, false).rotation.z = -0.04;
  // articulated dealing arm
  const arm = new THREE.Group();
  arm.position.set(-0.23, 1.33, 0.02);
  group.add(arm);
  addMesh(arm, new THREE.CapsuleGeometry(0.055, 0.24, 4, 10), mats.vest, 0, -0.11, 0.045).rotation.x = 0.4;
  const forearm = new THREE.Group();
  forearm.position.set(0, -0.2, 0.11);
  arm.add(forearm);
  addMesh(forearm, new THREE.CapsuleGeometry(0.047, 0.24, 4, 10), mats.vest, 0, -0.06, 0.08).rotation.x = 1.05;
  addMesh(forearm, new THREE.CylinderGeometry(0.045, 0.05, 0.022, 14), mats.shirt, 0, -0.02, 0.2).rotation.x = 1.05;
  const hand = makeHand(mats.skin, mats.shirt, mats.gold);
  hand.position.set(0, -0.03, 0.25);
  hand.rotation.x = 0.2;
  forearm.add(hand);
  // other arm rests at the waist
  const still = new THREE.Group();
  still.position.set(0.23, 1.33, 0.02);
  group.add(still);
  addMesh(still, new THREE.CapsuleGeometry(0.055, 0.24, 4, 10), mats.vest, 0, -0.14, 0.02).rotation.z = -0.22;
  addMesh(still, new THREE.CapsuleGeometry(0.047, 0.22, 4, 10), mats.vest, -0.03, -0.3, 0.08).rotation.x = 0.5;
  return { group, head, eyeL, eyeR, arm, forearm, phase: 0, dealPulse: 0 };
}

export function buildChairs(count = 6) {
  const wood = material('#2b1b12', { roughness: 0.45 });
  const leather = material('#241a18', { roughness: 0.55 });
  const brass = material('#a88654', { roughness: 0.35, metalness: 0.8 });
  const chairs = [];
  for (let i = 0; i < count; i++) {
    const group = new THREE.Group();
    const back = addMesh(group, new RoundedBoxGeometry(0.52, 0.62, 0.1, 4, 0.05), leather, 0, 0.92, -0.22);
    back.rotation.x = -0.08;
    for (const side of [-1, 1]) {
      addMesh(group, new THREE.CylinderGeometry(0.02, 0.02, 0.68, 8), brass, side * 0.24, 0.92, -0.2, false);
    }
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 2; col++) {
        addMesh(group, new THREE.SphereGeometry(0.006, 6, 6), brass, (col ? 1 : -1) * 0.08, 0.76 + row * 0.13, -0.165, false);
      }
    }
    addMesh(group, new RoundedBoxGeometry(0.5, 0.1, 0.45, 4, 0.05), leather, 0, 0.58, -0.02);
    addMesh(group, new RoundedBoxGeometry(0.48, 0.22, 0.42, 3, 0.04), leather, 0, 0.47, -0.02);
    for (const side of [-1, 1]) {
      const leg = addMesh(group, new THREE.CylinderGeometry(0.024, 0.034, 0.42, 10), wood, side * 0.2, 0.21, -0.02);
      leg.rotation.z = side * 0.08;
      addMesh(group, new THREE.CylinderGeometry(0.03, 0.03, 0.016, 10), brass, side * 0.22, 0.03, -0.02, false);
    }
    group.userData.chair = i;
    chairs.push(group);
  }
  return chairs;
}

/* First-person hands resting at the player's edge of the table. */
export function buildPlayerHands() {
  const group = new THREE.Group();
  const sleeve = material('#1c222c', { roughness: 0.72 });
  const cuff = material('#cdbfa9', { roughness: 0.7 });
  const skin = material('#c98f68', { roughness: 0.6 });
  const gold = material('#b08b52', { roughness: 0.3, metalness: 0.85 });
  const hands = [];
  for (const side of [-1, 1]) {
    const pivot = new THREE.Group();
    pivot.position.set(side * 0.42, 0.94, 1.16);
    group.add(pivot);
    addMesh(pivot, new THREE.CapsuleGeometry(0.04, 0.26, 5, 12), sleeve, side * 0.012, 0.0, 0.15).rotation.x = Math.PI / 2;
    addMesh(pivot, new THREE.CylinderGeometry(0.028, 0.032, 0.02, 16), cuff, side * 0.012, 0.0, -0.015).rotation.x = Math.PI / 2;
    addMesh(pivot, new THREE.SphereGeometry(0.0075, 8, 8), gold, side * 0.044, 0.03, -0.02, false);
    const hand = makeHand(skin, cuff, gold);
    hand.position.set(side * 0.012, -0.02, -0.14);
    hand.rotation.y = Math.PI;
    hand.rotation.x = -0.18;
    hand.scale.setScalar(0.9);
    pivot.add(hand);
    hands.push({ pivot, hand, side, baseY: 0.94 });
  }
  group.userData.hands = hands;
  group.visible = false;
  return group;
}

/* ------ animation ---------------------------------------------------- */

export function updateCharacter(rig, dt, time) {
  const active = rig.mood !== 'out';
  const speed = rig.mood === 'folded' ? 0.45 : 1;
  rig.phase += dt * speed;
  const breath = Math.sin(time * 1.35 + rig.phase) * 0.004;
  rig.torso.position.y = 0.98 + breath;
  rig.torso.rotation.x = Math.sin(time * 0.5 + rig.phase) * 0.008;

  if (time > rig.blinkAt) {
    rig.blinkUntil = time + 0.13;
    rig.blinkAt = time + 3.2 + Math.random() * 4.5;
  }
  const blink = time < rig.blinkUntil ? 0.12 : 1;
  rig.eyeL.scale.y += (blink - rig.eyeL.scale.y) * 0.5;
  rig.eyeR.scale.y = rig.eyeL.scale.y;

  if (time > rig.glanceAt) {
    rig.glanceAt = time + 2.8 + Math.random() * 5;
    rig.glanceYaw = (Math.random() - 0.5) * 0.55;
    rig.glancePitch = (Math.random() - 0.5) * 0.22;
  }
  let yawTarget = rig.glanceYaw;
  let pitchTarget = rig.glancePitch;
  if (rig.mood === 'thinking') {
    yawTarget = Math.sin(time * 0.9 + rig.phase) * 0.18;
    pitchTarget = 0.14 + Math.sin(time * 0.6) * 0.04;
  } else if (rig.mood === 'folded') {
    yawTarget = -0.2;
    pitchTarget = -0.18;
  } else if (!active) {
    yawTarget = 0;
    pitchTarget = -0.25;
  }
  rig.head.rotation.y += (yawTarget - rig.head.rotation.y) * Math.min(1, dt * 2.4);
  rig.head.rotation.x += (pitchTarget - rig.head.rotation.x) * Math.min(1, dt * 2.4);

  // occasional hand movement: a knuckle tap or a chip fidget
  for (const arm of rig.arms) {
    const target = Math.sin(time * 0.7 + rig.phase + arm.side) * 0.035;
    arm.elbow.rotation.x = target + (rig.mood === 'thinking' ? 0.12 : 0);
    arm.elbow.rotation.z = Math.sin(time * 0.44 + arm.side * 2 + rig.phase) * 0.025;
  }
  if (rig.mood === 'thinking' && rig.arms[1]) {
    rig.arms[1].pivot.rotation.x = -0.08 + Math.sin(time * 1.1) * 0.02;
  } else if (rig.arms[1]) {
    rig.arms[1].pivot.rotation.x *= 0.94;
  }
}

export function updateDealer(dealer, dt, time) {
  dealer.phase += dt;
  dealer.head.rotation.y = Math.sin(time * 0.32) * 0.16;
  dealer.head.rotation.x = Math.sin(time * 0.45 + 1) * 0.03 - 0.02;
  if (dealer.dealPulse > 0) {
    dealer.dealPulse = Math.max(0, dealer.dealPulse - dt * 2.4);
    const swing = Math.sin(Math.min(1, 1 - dealer.dealPulse) * Math.PI) * 0.7;
    dealer.forearm.rotation.x = -0.15 - swing;
    dealer.arm.rotation.x = -swing * 0.25;
  } else {
    dealer.forearm.rotation.x *= 0.9;
    dealer.arm.rotation.x *= 0.9;
  }
  const blink = (time % 6.5) < 0.12 ? 0.15 : 1;
  dealer.eyeL.scale.y += (blink - dealer.eyeL.scale.y) * 0.4;
  dealer.eyeR.scale.y = dealer.eyeL.scale.y;
}

export function updatePlayerHands(hands, dt, time, tension = 0) {
  const data = hands.userData.hands;
  for (const item of data) {
    const side = item.side;
    const idle = Math.sin(time * 0.8 + side) * 0.006;
    item.pivot.position.y = item.baseY + idle + tension * 0.012;
    item.pivot.rotation.x = Math.sin(time * 0.35 + side * 2) * 0.012;
    item.pivot.rotation.z = side * 0.035 + Math.sin(time * 0.6 + side) * 0.008;
  }
}
