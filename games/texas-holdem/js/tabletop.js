/* =====================================================================
   TEXAS HOLD'EM — things on the felt
   Cards with real thickness, clay chips, dealer puck and blind markers.
   ===================================================================== */

import * as THREE from 'three';
import { RoundedBoxGeometry } from '../../../vendor/three/RoundedBoxGeometry.js';
import {
  cardFaceTexture, cardBackTexture, chipTextures, makePuckTexture
} from './assets.js';
import { tween, easeOutCubic } from './tween.js';

// Standard poker card: 63.5 x 88.9 mm, 0.5 mm stock.
export const CARD_WIDTH = 0.0635;
export const CARD_HEIGHT = 0.0889;

const bodyGeometry = new RoundedBoxGeometry(CARD_WIDTH, CARD_HEIGHT, 0.0007, 1, 0.0016);
const faceGeometry = new THREE.PlaneGeometry(CARD_WIDTH * 0.965, CARD_HEIGHT * 0.967);
const bodyMaterial = new THREE.MeshStandardMaterial({ color: '#d8cbb8', roughness: 0.78 });
const backMaterial = new THREE.MeshStandardMaterial({
  map: cardBackTexture(), transparent: true, roughness: 0.58, metalness: 0.02
});
const faceMaterialCache = new Map();

function faceMaterial(card) {
  if (!faceMaterialCache.has(card.id)) {
    faceMaterialCache.set(card.id, new THREE.MeshBasicMaterial({
      map: cardFaceTexture(card), color: '#f2eadb', transparent: true, toneMapped: false
    }));
  }
  return faceMaterialCache.get(card.id);
}

const glowGeometry = new THREE.RingGeometry(0.045, 0.058, 32);
const glowMaterial = new THREE.MeshBasicMaterial({
  color: '#e7c27b', transparent: true, opacity: 0.55,
  blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide
});

export function createCard(card, faceUp = true) {
  const root = new THREE.Group();
  root.rotation.order = 'YXZ';
  root.rotation.x = -Math.PI / 2;
  const inner = new THREE.Group();
  root.add(inner);

  const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
  body.castShadow = true;
  body.receiveShadow = true;
  inner.add(body);

  const front = new THREE.Mesh(faceGeometry, faceMaterial(card));
  front.position.z = 0.001;
  front.receiveShadow = true;
  inner.add(front);

  const back = new THREE.Mesh(faceGeometry, backMaterial);
  back.position.z = -0.001;
  back.rotation.y = Math.PI;
  inner.add(back);

  const glow = new THREE.Mesh(glowGeometry, glowMaterial.clone());
  glow.position.z = -0.0012;
  glow.scale.set(0.95, 1.32, 1);
  glow.visible = false;
  root.add(glow);

  root.userData = {
    card,
    inner,
    front,
    back,
    glow,
    faceUp,
    baseY: 0,
    baseYaw: 0,
    highlighted: false,
    ringPhase: Math.random() * 6
  };
  setCardFace(root, faceUp);
  return root;
}

export function setCardFace(cardObject, faceUp) {
  const data = cardObject.userData;
  data.faceUp = faceUp;
  data.front.visible = faceUp;
  data.back.visible = !faceUp;
  data.inner.rotation.y = faceUp ? 0 : Math.PI;
}

export function flipCard(cardObject, faceUp, options = {}) {
  const data = cardObject.userData;
  if (data.faceUp === faceUp) return;
  const start = data.inner.rotation.y;
  const target = faceUp ? 0 : Math.PI;
  const baseY = data.baseY || cardObject.position.y;
  const duration = options.duration || 0.42;
  let swapped = false;
  tween({
    duration,
    delay: options.delay || 0,
    ease: (t) => t,
    onUpdate: (eased) => {
      data.inner.rotation.y = start + (target - start) * eased;
      cardObject.position.y = baseY + Math.sin(eased * Math.PI) * 0.012;
      if (!swapped && eased >= 0.5) {
        swapped = true;
        data.front.visible = faceUp;
        data.back.visible = !faceUp;
        data.faceUp = faceUp;
      }
    },
    onDone: () => {
      cardObject.position.y = baseY;
      data.inner.rotation.y = target;
      data.front.visible = faceUp;
      data.back.visible = !faceUp;
      data.faceUp = faceUp;
      if (options.onDone) options.onDone();
    }
  });
}

export function highlightCard(cardObject, on = true) {
  if (!cardObject) return;
  cardObject.userData.highlighted = on;
  cardObject.userData.glow.visible = on;
}

// 39 mm casino chip, 3.3 mm thick.
const chipGeometry = new THREE.CylinderGeometry(0.0195, 0.0195, 0.0033, 20);
const chipMaterials = new Map();
function materialsFor(value) {
  if (!chipMaterials.has(value)) {
    const textures = chipTextures(value);
    chipMaterials.set(value, [
      new THREE.MeshStandardMaterial({ map: textures.side, roughness: 0.42, metalness: 0.05 }),
      new THREE.MeshStandardMaterial({ map: textures.top, roughness: 0.36, metalness: 0.05 }),
      new THREE.MeshStandardMaterial({ map: textures.top, roughness: 0.36, metalness: 0.05 })
    ]);
  }
  return chipMaterials.get(value);
}

export function createChip(value) {
  const chip = new THREE.Mesh(chipGeometry, materialsFor(value));
  chip.receiveShadow = true;
  chip.castShadow = false;
  chip.rotation.y = Math.random() * Math.PI;
  return chip;
}

function expandBreakdown(amount, maximum) {
  const values = [5000, 1000, 500, 100, 25];
  let rest = Math.max(0, Math.round(amount));
  const breakdown = [];
  for (const value of values) {
    while (rest >= value) { breakdown.push(value); rest -= value; }
  }
  if (rest > 0) breakdown.push(25);
  const splitMap = { 5000: 1000, 1000: 500, 500: 100, 100: 25 };
  let guard = 0;
  while (breakdown.length < 5 && guard++ < 30) {
    const index = breakdown.findIndex((value) => splitMap[value]);
    if (index < 0) break;
    const value = breakdown.splice(index, 1)[0];
    const next = splitMap[value];
    for (let i = 0; i < 5; i++) breakdown.push(next);
  }
  while (breakdown.length > maximum) {
    let combined = false;
    for (let i = 0; i < breakdown.length - 1; i++) {
      if (breakdown[i] === breakdown[i + 1] && breakdown[i] <= 1000) {
        breakdown.splice(i, 2);
        combined = true;
        break;
      }
    }
    if (!combined) breakdown.pop();
  }
  breakdown.sort((a, b) => b - a);
  return breakdown;
}

function makeContactShadow() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 128;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createRadialGradient(64, 64, 4, 64, 64, 62);
  gradient.addColorStop(0, 'rgba(0,0,0,0.42)');
  gradient.addColorStop(0.6, 'rgba(0,0,0,0.18)');
  gradient.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 128, 128);
  const texture = new THREE.CanvasTexture(canvas);
  return texture;
}
const contactShadowTexture = makeContactShadow();

export function createChipStack(amount, options = {}) {
  const group = new THREE.Group();
  const value = Math.max(0, Math.round(amount));
  if (!value) return group;
  const maximum = options.maxChips || 22;
  const breakdown = expandBreakdown(value, maximum);
  const columns = Math.min(3, Math.max(1, Math.ceil(breakdown.length / 7)));
  const perColumn = Math.ceil(breakdown.length / columns);
  const spacing = 0.043;
  const height = 0.0034;

  for (let column = 0; column < columns; column++) {
    const count = Math.min(perColumn, breakdown.length - column * perColumn);
    for (let i = 0; i < count; i++) {
      const chip = createChip(breakdown[column * perColumn + i]);
      chip.position.set(
        (column - (columns - 1) / 2) * spacing,
        0.0026 + i * height,
        (Math.random() - 0.5) * 0.0012
      );
      group.add(chip);
    }
  }

  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(0.10 + columns * 0.04, 0.07),
    new THREE.MeshBasicMaterial({ map: contactShadowTexture, transparent: true, opacity: 0.6, depthWrite: false })
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.001;
  group.add(shadow);
  return group;
}

export function createPuck(text, radius = 0.025) {
  const textures = makePuckTexture(text);
  const side = new THREE.MeshStandardMaterial({ color: '#dfd2b8', roughness: 0.45 });
  const top = new THREE.MeshStandardMaterial({ map: textures, roughness: 0.4 });
  const puck = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, 0.008, 24), [side, top, top]);
  puck.castShadow = true;
  puck.receiveShadow = true;
  return puck;
}

export function createBlindMarker(text) {
  const puck = createPuck(text, 0.021);
  const rim = new THREE.Mesh(
    new THREE.TorusGeometry(0.022, 0.0016, 5, 18),
    new THREE.MeshStandardMaterial({ color: '#b09056', metalness: 0.75, roughness: 0.3 })
  );
  rim.rotation.x = -Math.PI / 2;
  rim.position.y = 0.005;
  puck.add(rim);
  return puck;
}

export function animateCardDeal(cardObject, from, to, options = {}) {
  const start = from.clone();
  const end = to.clone();
  const arc = options.arc ?? 0.06;
  const duration = options.duration ?? 0.4;
  cardObject.position.copy(start);
  cardObject.rotation.y = options.startYaw ?? Math.random() * Math.PI;
  cardObject.scale.setScalar(0.96);
  tween({
    duration,
    delay: options.delay || 0,
    ease: easeOutCubic,
    onUpdate: (eased) => {
      cardObject.position.lerpVectors(start, end, eased);
      cardObject.position.y += Math.sin(eased * Math.PI) * arc;
      cardObject.rotation.y = (options.startYaw ?? 0) + ((options.endYaw ?? 0) - (options.startYaw ?? 0)) * eased;
      cardObject.scale.setScalar(0.96 + eased * 0.04);
    },
    onDone: () => {
      cardObject.position.copy(end);
      cardObject.rotation.y = options.endYaw ?? 0;
      cardObject.scale.setScalar(1);
      cardObject.userData.baseY = end.y;
      cardObject.userData.baseYaw = options.endYaw ?? 0;
      if (options.onDone) options.onDone();
    }
  });
}

export function animateChipToss(group, from, to, options = {}) {
  const start = from.clone();
  const end = to.clone();
  group.position.copy(start);
  group.scale.setScalar(0.01);
  tween({
    duration: options.duration ?? 0.32,
    delay: options.delay || 0,
    ease: easeOutCubic,
    onUpdate: (eased) => {
      group.position.lerpVectors(start, end, eased);
      group.position.y += Math.sin(eased * Math.PI) * 0.06;
      group.scale.setScalar(0.01 + eased * 0.99);
    },
    onDone: () => {
      group.position.copy(end);
      group.scale.setScalar(1);
      if (options.onDone) options.onDone();
    }
  });
}
