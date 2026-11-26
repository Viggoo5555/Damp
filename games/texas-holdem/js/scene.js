/* =====================================================================
   TEXAS HOLD'EM — the living table
   Camera direction, seat positions, dealing, chips and all the small
   theatre around a hand. Everything is procedural, no external models.
   ===================================================================== */

import * as THREE from 'three';
import { RoomEnvironment } from '../../../vendor/three/RoomEnvironment.js';
import { buildRoom, TABLE } from './room.js';
import {
  buildSeatedCharacter, buildDealer, buildChairs, buildPlayerHands,
  updateCharacter, updateDealer, updatePlayerHands, CHARACTER_LOOKS
} from './characters.js';
import {
  createCard, flipCard, highlightCard, createChipStack, createPuck,
  createBlindMarker, animateCardDeal, CARD_WIDTH
} from './tabletop.js';
import { setAnisotropy, makeGlowTexture } from './assets.js';
import { tween, updateTweens, clearTweens, easeInOutCubic, easeOutCubic, smootherstep } from './tween.js';

export const SEAT_LAYOUTS = {
  2: [180],
  3: [120, 240],
  4: [90, 180, 270],
  5: [72, 144, 216, 288],
  6: [60, 120, 180, 240, 300]
};

const rad = (degrees) => degrees * Math.PI / 180;

function seatWorld(angleDeg) {
  const angle = rad(angleDeg);
  return new THREE.Vector3(Math.sin(angle) * TABLE.seatRx, 0, Math.cos(angle) * TABLE.seatRz);
}

function tablePoint(angleDeg, factor) {
  const angle = rad(angleDeg);
  return new THREE.Vector3(
    Math.sin(angle) * TABLE.rx * factor,
    TABLE.topY,
    Math.cos(angle) * TABLE.rz * factor
  );
}

function tangentFor(angleDeg) {
  const angle = rad(angleDeg);
  return new THREE.Vector3(Math.cos(angle), 0, -Math.sin(angle));
}

const cardData = (id) => ({
  id,
  rank: { A: 14, K: 13, Q: 12, J: 11, T: 10 }[id[0]] || Number(id[0]),
  suit: id[1].toLowerCase(),
  label: id[0].toUpperCase()
});

export function createPokerScene(canvas) {
  const renderer = new THREE.WebGLRenderer({
    canvas, antialias: true, alpha: false, powerPreference: 'high-performance'
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.35));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.06;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.shadowMap.autoUpdate = false;
  renderer.shadowMap.needsUpdate = true;

  setAnisotropy(renderer.capabilities.getMaxAnisotropy());

  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#070504');
  scene.fog = new THREE.FogExp2('#080605', 0.0125);

  const camera = new THREE.PerspectiveCamera(58, 1, 0.04, 60);
  camera.rotation.order = 'YXZ';

  const pmrem = new THREE.PMREMGenerator(renderer);
  const environment = pmrem.fromScene(new RoomEnvironment(), 0.04);
  scene.environment = environment.texture;
  scene.environmentIntensity = 0.34;
  pmrem.dispose();

  const room = buildRoom();
  scene.add(room.group);

  const itemRoot = new THREE.Group();
  const decorRoot = new THREE.Group();
  const fxRoot = new THREE.Group();
  scene.add(itemRoot, decorRoot, fxRoot);

  // people
  const rigs = CHARACTER_LOOKS.slice(0, 5).map((look, index) => buildSeatedCharacter(look, index));
  for (const rig of rigs) {
    rig.group.visible = false;
    rig.group.castShadow = true;
    scene.add(rig.group);
  }
  const dealer = buildDealer();
  dealer.group.position.set(TABLE.dealer.x, 0, TABLE.dealer.z);
  dealer.group.rotation.y = Math.atan2(-TABLE.dealer.x, -TABLE.dealer.z);
  scene.add(dealer.group);

  const chairs = buildChairs(6);
  for (const chair of chairs) {
    chair.visible = false;
    scene.add(chair);
  }

  const hands = buildPlayerHands();
  scene.add(hands);

  // seat state
  const seatCount = { value: 6 };
  const seats = Array.from({ length: 6 }, (_, index) => ({
    index,
    angle: 0,
    used: false,
    pos: new THREE.Vector3(),
    cardPos: new THREE.Vector3(),
    betPos: new THREE.Vector3(),
    chipPos: new THREE.Vector3(),
    tangent: new THREE.Vector3(1, 0, 0),
    rig: null,
    chair: null,
    holeCards: [],
    revealed: false,
    betGroup: null,
    betAmount: -1,
    stackGroup: null,
    stackAmount: -1,
    mood: 'idle'
  }));

  // dealer puck and markers
  const puck = createPuck('D', 0.056);
  puck.visible = false;
  const sbMarker = createBlindMarker('SB');
  const bbMarker = createBlindMarker('BB');
  sbMarker.visible = bbMarker.visible = false;
  itemRoot.add(puck, sbMarker, bbMarker);

  // active turn ring
  const actorRing = new THREE.Mesh(
    new THREE.RingGeometry(0.31, 0.345, 64),
    new THREE.MeshBasicMaterial({
      color: '#e6bf75', transparent: true, opacity: 0.42,
      blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide
    })
  );
  actorRing.rotation.x = -Math.PI / 2;
  actorRing.scale.set(1.5, 1.1, 1);
  actorRing.visible = false;
  itemRoot.add(actorRing);

  let boardCards = [];
  let potGroup = new THREE.Group();
  let potAmount = -1;
  itemRoot.add(potGroup);
  let activeSeat = null;
  let dealSequence = 0;
  let mode = 'menu';
  let quality = 'high';
  let cinematic = false;
  let idleMotion = true;
  let lookSensitivity = 1;
  const lookTarget = { x: 0, y: 0 };
  const lookCurrent = { x: 0, y: 0 };
  let tension = 0;
  let shadowElapsed = 0;
  let menuTime = 0;
  let currentMenuQuat = new THREE.Quaternion();
  let flight = null;
  let lastStacks = [];

  const SEAT_FOV = 63;
  const MENU_FOV = 43;
  const menuFovFor = () => Math.max(MENU_FOV, Math.min(58, MENU_FOV * (1.3 / Math.max(0.6, camera.aspect))));
  const seatFovFor = () => Math.max(SEAT_FOV, Math.min(72, SEAT_FOV * (1.3 / Math.max(0.6, camera.aspect))));
  const seatBase = new THREE.Vector3(0, 1.34, 2.2);
  const seatPitch = -0.13;

  // menu camera loop
  const menuPoints = [
    new THREE.Vector3(4.3, 2.9, 4.6),
    new THREE.Vector3(1.5, 2.65, 5.0),
    new THREE.Vector3(-2.8, 2.95, 4.5),
    new THREE.Vector3(-4.8, 3.15, 1.4),
    new THREE.Vector3(-3.6, 2.9, -3.4),
    new THREE.Vector3(1.4, 3.2, -4.6),
    new THREE.Vector3(4.6, 2.75, -2.7),
    new THREE.Vector3(5.25, 3.2, 1.9)
  ];
  const menuCurve = new THREE.CatmullRomCurve3(menuPoints, true, 'centripetal', 0.5);
  const menuLook = new THREE.Vector3(-0.35, 0.96, 0);

  const glowTexture = makeGlowTexture();

  function applyMaterialQuality(level) {
    const low = level === 'low';
    const medium = level === 'medium';
    scene.traverse((object) => {
      const materials = object.material
        ? (Array.isArray(object.material) ? object.material : [object.material])
        : [];
      for (const material of materials) {
        if (!material || !material.isMeshPhysicalMaterial) continue;
        if (material.userData.baseClearcoat === undefined) {
          material.userData.baseClearcoat = material.clearcoat || 0;
          material.userData.baseSheen = material.sheen || 0;
        }
        const clearcoat = low ? 0 : medium ? Math.min(0.18, material.userData.baseClearcoat) : material.userData.baseClearcoat;
        const sheen = low ? 0 : medium ? Math.min(0.15, material.userData.baseSheen) : material.userData.baseSheen;
        if (material.clearcoat !== clearcoat) { material.clearcoat = clearcoat; material.needsUpdate = true; }
        if (material.sheen !== sheen) { material.sheen = sheen; material.needsUpdate = true; }
      }
    });
  }

  function resize() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    renderer.setSize(width, height, false);
    camera.aspect = width / Math.max(1, height);
    camera.updateProjectionMatrix();
  }
  resize();
  window.addEventListener('resize', resize);

  function clearGroup(group) {
    while (group.children.length) group.remove(group.children[0]);
  }

  function setSeatMood(index, mood) {
    const seat = seats[index];
    if (!seat || !seat.rig) return;
    seat.mood = mood;
    seat.rig.mood = mood;
  }

  function configure(count) {
    clearTweens();
    seatCount.value = count;
    const angles = [0, ...(SEAT_LAYOUTS[count] || SEAT_LAYOUTS[6])];
    for (let i = 0; i < 6; i++) {
      const seat = seats[i];
      seat.used = i < count;
      if (!seat.used) {
        if (seat.rig) seat.rig.group.visible = false;
        if (seat.chair) seat.chair.visible = false;
        seat.holeCards.length = 0;
        if (seat.betGroup) { seat.betGroup.visible = false; }
        if (seat.stackGroup) { seat.stackGroup.visible = false; }
        continue;
      }
      const angle = angles[i] ?? 0;
      seat.angle = angle;
      seat.pos.copy(seatWorld(angle));
      seat.tangent.copy(tangentFor(angle));
      seat.cardPos.copy(tablePoint(angle, 0.66));
      seat.betPos.copy(tablePoint(angle, 0.52));
      seat.chipPos.copy(tablePoint(angle, 0.855)).addScaledVector(seat.tangent, 0.22);
      seat.holeCards.length = 0;
      seat.betAmount = -1;
      seat.stackAmount = -1;
      if (i === 0) {
        if (seat.rig) seat.rig.group.visible = false;
        if (seat.chair) seat.chair.visible = false;
      } else {
        const rig = rigs[i - 1];
        seat.rig = rig;
        rig.group.visible = true;
        rig.group.position.set(seat.pos.x, 0, seat.pos.z);
        rig.group.rotation.y = Math.atan2(-seat.pos.x, -seat.pos.z);
        rig.mood = 'idle';
        rig.group.scale.setScalar(1);
        rig.head.rotation.set(0, 0, 0);
        const chair = chairs[i];
        seat.chair = chair;
        chair.visible = true;
        const chairPos = seatWorld(angle).multiplyScalar(1.13);
        chair.position.set(chairPos.x, 0, chairPos.z);
        chair.rotation.y = Math.atan2(-chairPos.x, -chairPos.z);
        setSeatMood(i, 'idle');
      }
      if (i === 0) seat.rig = null;
    }
    lastStacks = [];
    activeSeat = null;
    actorRing.visible = false;
    puck.visible = false;
    sbMarker.visible = bbMarker.visible = false;
  }

  function menuDecor() {
    clearGroup(decorRoot);
    const board = ['As', 'Ks', 'Qs', 'Js', 'Ts'].map(cardData);
    board.forEach((card, i) => {
      const mesh = createCard(card, true);
      mesh.position.set((i - 2) * (CARD_WIDTH + 0.017), TABLE.topY + 0.008, TABLE.board.z);
      mesh.rotation.y = (Math.random() - 0.5) * 0.025;
      mesh.userData.baseY = mesh.position.y;
      decorRoot.add(mesh);
    });
    const holes = [cardData('Ah'), cardData('Kh')];
    holes.forEach((card, i) => {
      const mesh = createCard(card, true);
      mesh.position.set(-0.1 + i * 0.185, TABLE.topY + 0.008, 0.79);
      mesh.rotation.y = -0.03 + i * 0.025;
      mesh.userData.baseY = mesh.position.y;
      decorRoot.add(mesh);
    });
    const pot = createChipStack(18200, { maxChips: 24 });
    pot.position.set(TABLE.pot.x, TABLE.topY + 0.002, TABLE.pot.z);
    decorRoot.add(pot);
    for (let i = 1; i < 6; i++) {
      const seat = seats[i];
      const chips = createChipStack([7600, 12400, 9800, 15200, 4300][i - 1], { maxChips: 16 });
      chips.position.set(seat.chipPos.x, TABLE.topY + 0.002, seat.chipPos.z);
      decorRoot.add(chips);
      const bet = createChipStack([250, 1200, 600, 0, 450][i - 1], { maxChips: 8 });
      bet.position.set(seat.betPos.x, TABLE.topY + 0.002, seat.betPos.z);
      if (bet.children.length) decorRoot.add(bet);
    }
    const decorPuck = createPuck('D', 0.056);
    decorPuck.position.set(0.9, TABLE.topY + 0.012, -0.22);
    decorRoot.add(decorPuck);
    decorRoot.visible = true;
  }

  function resetHandVisuals() {
    for (const seat of seats) {
      for (const card of seat.holeCards) if (card.parent) card.parent.remove(card);
      seat.holeCards.length = 0;
      seat.revealed = false;
      if (seat.betGroup) { if (seat.betGroup.parent) seat.betGroup.parent.remove(seat.betGroup); seat.betGroup = null; seat.betAmount = -1; }
      if (seat.stackGroup) { if (seat.stackGroup.parent) seat.stackGroup.parent.remove(seat.stackGroup); seat.stackGroup = null; seat.stackAmount = -1; }
      setSeatMood(seat.index, 'idle');
    }
    for (const card of boardCards) if (card.parent) card.parent.remove(card);
    boardCards = [];
    if (potGroup.parent) potGroup.parent.remove(potGroup);
    potGroup = new THREE.Group();
    itemRoot.add(potGroup);
    potAmount = -1;
    lastStacks = [];
    activeSeat = null;
    actorRing.visible = false;
    clearGroup(fxRoot);
    dealSequence = 0;
    for (const group of [sbMarker, bbMarker]) group.visible = false;
  }

  function enterSeat(count, onDone) {
    configure(count);
    clearGroup(decorRoot);
    resetHandVisuals();
    hands.visible = false;
    setModeFlight(
      new THREE.Vector3(seatBase.x, seatBase.y, seatBase.z),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(seatPitch, 0, 0, 'YXZ')),
      seatFovFor(),
      2.05,
      () => {
        mode = 'seated';
        hands.visible = false;
        hands.position.set(0, 0, 0);
        lookCurrent.x = lookCurrent.y = lookTarget.x = lookTarget.y = 0;
        if (onDone) onDone();
      }
    );
  }

  function setModeFlight(position, quaternion, fov, duration, onDone) {
    flight = {
      fromPos: camera.position.clone(),
      fromQuat: camera.quaternion.clone(),
      fromFov: camera.fov,
      toPos: position.clone(),
      toQuat: quaternion.clone(),
      toFov: fov,
      startedAt: performance.now(),
      duration,
      onDone
    };
    mode = 'flight';
  }

  function returnToMenu(onDone) {
    hands.visible = false;
    configure(6);
    resetHandVisuals();
    menuDecor();
    const position = new THREE.Vector3(3.35, 2.0, 3.7);
    const dummy = new THREE.Object3D();
    dummy.position.copy(position);
    dummy.lookAt(0, 1.0, 0);
    setModeFlight(position, dummy.quaternion, menuFovFor(), 1.7, () => {
      mode = 'menu';
      hands.visible = false;
      if (onDone) onDone();
    });
  }

  function showMenu() {
    configure(6);
    resetHandVisuals();
    menuDecor();
    mode = 'menu';
    hands.visible = false;
    orbitAt(0.04);
  }

  function orbitAt(t) {
    menuTime = t;
    const point = menuCurve.getPointAt(t);
    camera.position.copy(point);
    camera.position.y += Math.sin(t * Math.PI * 2 * 2.2) * 0.07;
    menuLook.set(-0.35 + Math.sin(t * Math.PI * 2) * 0.28, 0.96 + Math.sin(t * Math.PI * 2 * 1.4) * 0.04, Math.cos(t * Math.PI * 2 * 0.6) * 0.16);
    camera.lookAt(menuLook);
    camera.fov = menuFovFor();
    camera.updateProjectionMatrix();
    currentMenuQuat.copy(camera.quaternion);
  }

  showMenu();

  /* ---------- dealing ----------------------------------------------- */

  function seatCardTarget(seat, index) {
    const offset = (index - 0.5) * 0.182;
    return new THREE.Vector3(
      seat.cardPos.x + seat.tangent.x * offset - seat.tangent.z * 0.0,
      TABLE.topY + 0.008,
      seat.cardPos.z + seat.tangent.z * offset
    );
  }

  function boardTarget(index) {
    return new THREE.Vector3(
      (index - 2) * (CARD_WIDTH + 0.017),
      TABLE.topY + 0.008,
      TABLE.board.z
    );
  }

  const deckOrigin = new THREE.Vector3(TABLE.deck.x, TABLE.topY + 0.06, TABLE.deck.z);

  function dealHole(index, cards, faceUp) {
    const seat = seats[index];
    if (!seat || !seat.used) return;
    for (const old of seat.holeCards) if (old.parent) old.parent.remove(old);
    seat.holeCards = [];
    seat.revealed = false;
    const baseDelay = dealSequence * 0.155;
    dealSequence += 1;
    cards.forEach((card, cardIndex) => {
      const mesh = createCard(card, false);
      mesh.position.copy(deckOrigin);
      itemRoot.add(mesh);
      const target = seatCardTarget(seat, cardIndex);
      const delay = baseDelay + cardIndex * 0.105;
      animateCardDeal(mesh, deckOrigin.clone().add(new THREE.Vector3(0, cardIndex * 0.012, 0)), target, {
        delay,
        duration: 0.42,
        arc: 0.18 + Math.random() * 0.08,
        startYaw: (Math.random() - 0.5) * 0.9,
        endYaw: (Math.random() - 0.5) * 0.06,
        onDone: () => {
          if (faceUp) {
            flipCard(mesh, true, { delay: 0.03, duration: 0.32 });
          }
        }
      });
      seat.holeCards.push(mesh);
    });
    dealer.dealPulse = 1;
  }

  function revealHole(index) {
    const seat = seats[index];
    if (!seat) return;
    seat.revealed = true;
    seat.holeCards.forEach((card, i) => flipCard(card, true, { delay: i * 0.08, duration: 0.38 }));
  }

  function dealBoard(board, newCards) {
    if (!newCards || !newCards.length) return;
    const start = board.length - newCards.length;
    newCards.forEach((card, i) => {
      const boardIndex = start + i;
      const existing = boardCards[boardIndex];
      if (existing && existing.parent) existing.parent.remove(existing);
      const mesh = createCard(card, false);
      itemRoot.add(mesh);
      const target = boardTarget(boardIndex);
      animateCardDeal(mesh, deckOrigin.clone(), target, {
        delay: i * 0.14,
        duration: 0.4,
        arc: 0.16,
        startYaw: (Math.random() - 0.5) * 0.8,
        endYaw: (Math.random() - 0.5) * 0.03,
        onDone: () => flipCard(mesh, true, { duration: 0.36, delay: 0.02 })
      });
      boardCards[boardIndex] = mesh;
    });
    dealer.dealPulse = 1;
  }

  function revealShowdown(reveals) {
    const allBest = new Set();
    for (const reveal of reveals) {
      if (reveal.isWinner) {
        for (const card of reveal.cards) allBest.add(card.id);
      }
      if (reveal.seat !== 0) revealHole(reveal.seat);
      const seat = seats[reveal.seat];
      if (seat) {
        for (const card of seat.holeCards) {
          if (reveal.isWinner && card.userData.card && allBest.has(card.userData.card.id)) {
            highlightCard(card, true);
          }
        }
      }
    }
    for (const card of boardCards) {
      if (card.userData.card && allBest.has(card.userData.card.id)) highlightCard(card, true);
    }
  }

  function clearHighlights() {
    for (const seat of seats) for (const card of seat.holeCards) highlightCard(card, false);
    for (const card of boardCards) highlightCard(card, false);
  }

  /* ---------- chips -------------------------------------------------- */

  function updateStacks(stacks) {
    for (let i = 0; i < seats.length; i++) {
      const seat = seats[i];
      if (!seat.used) continue;
      const amount = Math.max(0, Math.round(stacks[i] ?? 0));
      if (seat.stackAmount === amount) continue;
      seat.stackAmount = amount;
      if (seat.stackGroup && seat.stackGroup.parent) seat.stackGroup.parent.remove(seat.stackGroup);
      seat.stackGroup = null;
      if (!amount) continue;
      const group = createChipStack(amount, { maxChips: i === 0 ? 20 : 16 });
      group.position.set(seat.chipPos.x, TABLE.topY + 0.003, seat.chipPos.z);
      itemRoot.add(group);
      seat.stackGroup = group;
      group.scale.setScalar(0.9);
      tween({ duration: 0.25, onUpdate: (t) => group.scale.setScalar(0.9 + 0.1 * t) });
    }
  }

  function syncBets(roundBets) {
    for (let i = 0; i < seats.length; i++) {
      const seat = seats[i];
      if (!seat.used) continue;
      const amount = Math.max(0, Math.round(roundBets[i] ?? 0));
      if (seat.betAmount === amount) continue;
      seat.betAmount = amount;
      if (seat.betGroup && seat.betGroup.parent) seat.betGroup.parent.remove(seat.betGroup);
      seat.betGroup = null;
      if (!amount) continue;
      const group = createChipStack(amount, { maxChips: 12 });
      group.position.set(seat.betPos.x, TABLE.topY + 0.003, seat.betPos.z);
      itemRoot.add(group);
      seat.betGroup = group;
      group.scale.setScalar(0.5);
      tween({ duration: 0.28, ease: easeOutCubic, onUpdate: (t) => group.scale.setScalar(0.5 + 0.5 * t) });
    }
  }

  function setPot(amount) {
    const value = Math.max(0, Math.round(amount));
    if (potAmount === value) return;
    potAmount = value;
    if (potGroup.parent) potGroup.parent.remove(potGroup);
    potGroup = new THREE.Group();
    itemRoot.add(potGroup);
    if (!value) return;
    const chips = createChipStack(value, { maxChips: 26 });
    potGroup.add(chips);
    potGroup.position.set(TABLE.pot.x, TABLE.topY + 0.003, TABLE.pot.z);
    potGroup.scale.setScalar(0.82);
    tween({ duration: 0.3, ease: easeOutCubic, onUpdate: (t) => potGroup.scale.setScalar(0.82 + 0.18 * t) });
  }

  function collectBets() {
    for (const seat of seats) {
      if (!seat.betGroup) continue;
      const group = seat.betGroup;
      seat.betGroup = null;
      seat.betAmount = -1;
      const start = group.position.clone();
      const target = new THREE.Vector3(TABLE.pot.x, TABLE.topY + 0.02, TABLE.pot.z);
      tween({
        duration: 0.38,
        ease: easeInOutCubic,
        onUpdate: (t) => {
          group.position.lerpVectors(start, target, t);
          group.position.y += Math.sin(t * Math.PI) * 0.06;
          group.scale.setScalar(1 - t * 0.55);
        },
        onDone: () => { if (group.parent) group.parent.remove(group); }
      });
    }
  }

  function sweepPotTo(index) {
    const seat = seats[index];
    if (!seat || !potGroup || !potGroup.children.length) return;
    const group = potGroup;
    potGroup = new THREE.Group();
    itemRoot.add(potGroup);
    potAmount = -1;
    const start = group.position.clone();
    const target = new THREE.Vector3(seat.chipPos.x, TABLE.topY + 0.03, seat.chipPos.z);
    tween({
      duration: 0.7,
      ease: easeInOutCubic,
      onUpdate: (t) => {
        group.position.lerpVectors(start, target, t);
        group.position.y += Math.sin(t * Math.PI) * 0.22;
        group.scale.setScalar(1 - t * 0.35);
      },
      onDone: () => { if (group.parent) group.parent.remove(group); }
    });
  }

  /* ---------- turn and action theatre ------------------------------- */

  function setActor(index) {
    activeSeat = index;
    for (const seat of seats) {
      if (!seat.rig || seat.index === index) continue;
      if (seat.mood !== 'folded' && seat.mood !== 'out') setSeatMood(seat.index, 'idle');
    }
    if (index === null || index === undefined) {
      actorRing.visible = false;
      return;
    }
    const seat = seats[index];
    if (!seat) return;
    const lookAt = seat.cardPos.clone();
    lookAt.y = TABLE.topY + 0.004;
    actorRing.position.copy(lookAt);
    actorRing.visible = true;
    if (index !== 0 && seat.rig) setSeatMood(index, 'thinking');
    if (index === 0) tension = 1;
  }

  function clearActor() {
    activeSeat = null;
    actorRing.visible = false;
    for (const seat of seats) {
      if (seat.rig && seat.mood === 'thinking') setSeatMood(seat.index, 'idle');
    }
  }

  function react(index, action, amount) {
    const seat = seats[index];
    if (!seat) return;
    const isPlayer = index === 0;
    if (action === 'fold') {
      setSeatMood(index, 'folded');
      seat.holeCards.forEach((card, i) => {
        setTimeout(() => {
          flipCard(card, false, { duration: 0.3 });
          const start = card.position.clone();
          const target = new THREE.Vector3(TABLE.muck.x + i * 0.08, TABLE.topY + 0.01, TABLE.muck.z + i * 0.03);
          tween({
            duration: 0.45, ease: easeOutCubic,
            onUpdate: (t) => { card.position.lerpVectors(start, target, t); card.scale.setScalar(1 - t * 0.25); },
            onDone: () => { if (card.parent) card.parent.remove(card); }
          });
        }, i * 80 + 300);
      });
      if (isPlayer) {
        hands.visible = true;
        tween({
          duration: 0.6, ease: easeInOutCubic,
          onUpdate: (t) => {
            hands.position.z = -Math.sin(t * Math.PI) * 0.16;
            hands.position.y = -Math.sin(t * Math.PI) * 0.02;
          },
          onDone: () => { hands.position.set(0, 0, 0); hands.visible = false; }
        });
      }
    } else if (action === 'raise' || action === 'bet' || action === 'all-in') {
      chipToss(seat, Math.min(amount, 600));
      if (isPlayer) playerReach(action);
    } else if (action === 'call') {
      chipToss(seat, Math.min(amount, 350));
      if (isPlayer) playerReach(action);
    } else if (action === 'check') {
      if (isPlayer) playerReach(action);
    }
  }

  function chipToss(seat, amount) {
    if (!seat || !seat.used) return;
    const group = createChipStack(Math.max(25, amount), { maxChips: 3 });
    group.position.set(seat.chipPos.x, TABLE.topY + 0.06, seat.chipPos.z);
    fxRoot.add(group);
    const start = group.position.clone();
    const target = new THREE.Vector3(seat.betPos.x, TABLE.topY + 0.02, seat.betPos.z);
    tween({
      duration: 0.36,
      ease: easeOutCubic,
      onUpdate: (t) => {
        group.position.lerpVectors(start, target, t);
        group.position.y += Math.sin(t * Math.PI) * 0.11;
      },
      onDone: () => {
        tween({
          duration: 0.3,
          onUpdate: (t) => group.scale.setScalar(1 - t),
          onDone: () => { if (group.parent) group.parent.remove(group); }
        });
      }
    });
  }

  function playerReach(action) {
    hands.visible = true;
    tween({
      duration: 0.7,
      ease: easeInOutCubic,
      onUpdate: (t) => {
        const reach = Math.sin(t * Math.PI);
        hands.position.z = -reach * (action === 'check' ? 0.12 : 0.24);
        hands.position.y = -reach * 0.015;
      },
      onDone: () => { hands.position.set(0, 0, 0); hands.visible = false; }
    });
  }

  function showWinner(index) {
    const seat = seats[index];
    if (!seat) return;
    if (seat.rig) setSeatMood(index, 'idle');
    const origin = seat.cardPos.clone();
    origin.y = TABLE.topY + 0.1;
    const group = new THREE.Group();
    fxRoot.add(group);
    const sprites = [];
    for (let i = 0; i < 26; i++) {
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
        map: glowTexture, color: i % 3 === 0 ? '#ffe2a5' : '#e7b85d',
        transparent: true, opacity: 0.8, depthWrite: false, blending: THREE.AdditiveBlending
      }));
      sprite.position.copy(origin);
      sprite.scale.setScalar(0.04 + Math.random() * 0.05);
      group.add(sprite);
      const angle = Math.random() * Math.PI * 2;
      const speed = 0.4 + Math.random() * 0.9;
      sprites.push({
        sprite,
        dx: Math.cos(angle) * speed * 0.5,
        dz: Math.sin(angle) * speed * 0.5,
        dy: 0.5 + Math.random() * 0.9,
        life: 0
      });
    }
    let elapsed = 0;
    const tick = (dt) => {
      elapsed += dt;
      for (const particle of sprites) {
        particle.life += dt;
        particle.sprite.position.x = origin.x + particle.dx * particle.life;
        particle.sprite.position.z = origin.z + particle.dz * particle.life;
        particle.sprite.position.y = origin.y + particle.dy * particle.life - 0.7 * particle.life * particle.life;
        particle.sprite.material.opacity = Math.max(0, 0.8 - particle.life * 0.8);
      }
      if (elapsed > 1.35) {
        fxRoot.remove(group);
        activeBursts.delete(tick);
      }
    };
    activeBursts.add(tick);
  }
  const activeBursts = new Set();

  function setDealerButton(index, animate = true) {
    const seat = seats[index];
    if (!seat) { puck.visible = false; return; }
    const target = new THREE.Vector3(
      seat.chipPos.x + seat.tangent.x * 0.12,
      TABLE.topY + 0.013,
      seat.chipPos.z + seat.tangent.z * 0.12
    );
    if (!puck.visible || !animate) {
      puck.position.copy(target);
    } else {
      const start = puck.position.clone();
      tween({
        duration: 0.55, ease: easeInOutCubic,
        onUpdate: (t) => {
          puck.position.lerpVectors(start, target, t);
          puck.position.y += Math.sin(t * Math.PI) * 0.08;
        }
      });
    }
    puck.visible = true;
  }

  function setBlinds(sbIndex, bbIndex) {
    for (const [marker, index, offset] of [[sbMarker, sbIndex, -0.13], [bbMarker, bbIndex, 0.13]]) {
      const seat = seats[index];
      if (!seat) { marker.visible = false; continue; }
      marker.visible = true;
      marker.position.set(
        seat.betPos.x + seat.tangent.x * offset,
        TABLE.topY + 0.012,
        seat.betPos.z + seat.tangent.z * offset
      );
      marker.rotation.y = Math.random() * Math.PI;
    }
  }

  function clearPuck() {
    puck.visible = false;
    sbMarker.visible = bbMarker.visible = false;
  }

  function setMood(index, mood) { setSeatMood(index, mood); }

  /* ---------- camera ------------------------------------------------- */

  function setLook(nx, ny) {
    lookTarget.x = Math.max(-1, Math.min(1, nx));
    lookTarget.y = Math.max(-1, Math.min(1, ny));
  }

  function setCinematic(on) { cinematic = Boolean(on); }
  function setLookSensitivity(value) { lookSensitivity = Math.max(0.2, Math.min(2, value)); }
  function setIdleMotion(on) { idleMotion = Boolean(on); }

  let timeElapsed = 0;

  function update(dt, now) {
    const time = now / 1000;
    timeElapsed += dt;
    shadowElapsed += dt;
    updateTweens(dt);
    room.update(dt, time);
    if (renderer.shadowMap.enabled && shadowElapsed > (quality === 'high' ? 0.26 : 0.4)) {
      renderer.shadowMap.needsUpdate = true;
      shadowElapsed = 0;
    }

    for (const rig of rigs) if (rig.group.visible) updateCharacter(rig, dt, time + rig.index * 1.7);
    updateDealer(dealer, dt, time);
    if (hands.visible) updatePlayerHands(hands, dt, time, tension);
    tension = Math.max(0, tension - dt * 1.6);

    if (mode === 'menu') {
      menuTime = (menuTime + dt / 84) % 1;
      const point = menuCurve.getPointAt(menuTime);
      camera.position.copy(point);
      camera.position.x += Math.sin(time * 0.17) * 0.025;
      camera.position.y += Math.sin(time * 0.23) * 0.045;
      menuLook.set(
        -0.35 + Math.sin(time * 0.11) * 0.26,
        0.96 + Math.sin(time * 0.17) * 0.05,
        Math.cos(time * 0.07) * 0.16
      );
      camera.lookAt(menuLook);
      camera.fov = menuFovFor();
      camera.updateProjectionMatrix();
    } else if (mode === 'flight' && flight) {
      const elapsed = Math.max(0, (now - flight.startedAt) / 1000);
      const t = Math.min(1, elapsed / flight.duration);
      const eased = smootherstep(t);
      camera.position.lerpVectors(flight.fromPos, flight.toPos, eased);
      camera.quaternion.slerpQuaternions(flight.fromQuat, flight.toQuat, eased);
      camera.fov = flight.fromFov + (flight.toFov - flight.fromFov) * eased;
      camera.updateProjectionMatrix();
      if (t >= 1) {
        const done = flight.onDone;
        const targetPos = flight.toPos;
        camera.position.copy(targetPos);
        camera.quaternion.copy(flight.toQuat);
        camera.fov = flight.toFov;
        camera.updateProjectionMatrix();
        flight = null;
        if (done) done();
      }
    } else if (mode === 'seated') {
      const smoothing = 1 - Math.exp(-dt * 3.4);
      lookCurrent.x += (lookTarget.x - lookCurrent.x) * smoothing;
      lookCurrent.y += (lookTarget.y - lookCurrent.y) * smoothing;
      const motion = idleMotion ? 1 : 0;
      const breath = Math.sin(time * 1.15) * 0.0022 * motion;
      const idleYaw = Math.sin(time * 0.27) * 0.0045 * motion;
      const idlePitch = Math.sin(time * 0.41 + 1.4) * 0.0032 * motion;
      let yaw = -lookCurrent.x * 0.52 * lookSensitivity + idleYaw;
      let pitch = seatPitch - lookCurrent.y * 0.17 + idlePitch;
      let roll = 0;
      if (cinematic) {
        yaw += Math.sin(time * 0.055) * 0.2;
        pitch += Math.sin(time * 0.043 + 0.5) * 0.035;
        roll = Math.sin(time * 0.028) * 0.012;
      }
      if (tension > 0.01) pitch -= tension * 0.012;
      camera.position.set(
        seatBase.x + Math.sin(time * 0.19) * 0.0035 * motion,
        seatBase.y + breath,
        seatBase.z + Math.sin(time * 0.13) * 0.003 * motion - tension * 0.012
      );
      camera.rotation.set(pitch, yaw, roll, 'YXZ');
      const targetFov = seatFovFor();
      if (camera.fov !== targetFov) {
        camera.fov = targetFov;
        camera.updateProjectionMatrix();
      }
    }

    // highlights and turn ring
    for (const seat of seats) {
      for (const card of seat.holeCards) {
        const glow = card.userData.glow;
        if (glow && glow.visible) {
          const pulse = 0.42 + Math.sin(time * 3 + card.userData.ringPhase) * 0.16;
          glow.material.opacity = pulse;
          const scale = 1 + Math.sin(time * 2.4 + card.userData.ringPhase) * 0.04;
          glow.scale.set(0.95 * scale, 1.32 * scale, 1);
        }
      }
    }
    for (const card of boardCards) {
      const glow = card.userData.glow;
      if (glow && glow.visible) {
        const pulse = 0.45 + Math.sin(time * 3 + card.userData.ringPhase) * 0.15;
        glow.material.opacity = pulse;
        const scale = 1 + Math.sin(time * 2.4 + card.userData.ringPhase) * 0.04;
        glow.scale.set(0.95 * scale, 1.32 * scale, 1);
      }
    }
    if (actorRing.visible) {
      actorRing.material.opacity = 0.28 + Math.sin(time * 2.6) * 0.12;
      const pulse = 1 + Math.sin(time * 2.6) * 0.035;
      actorRing.scale.set(1.5 * pulse, 1.1 * pulse, 1);
    }
    for (const burst of [...activeBursts]) burst(dt);
  }

  function render() {
    renderer.render(scene, camera);
  }

  function projectSeat(index) {
    const seat = seats[index];
    if (!seat || !seat.used) return { x: 0, y: 0, visible: false };
    const vector = seat.pos.clone();
    vector.y = 1.72;
    vector.project(camera);
    const width = renderer.domElement.clientWidth;
    const height = renderer.domElement.clientHeight;
    const x = (vector.x * 0.5 + 0.5) * width;
    const y = (-vector.y * 0.5 + 0.5) * height;
    const visible = vector.z < 1 && vector.z > -1 && x > -80 && x < width + 80 && y > -60 && y < height + 60;
    return { x, y, visible };
  }

  function setQuality(level) {
    quality = ['high', 'medium', 'low'].includes(level) ? level : 'high';
    const high = quality === 'high';
    const low = quality === 'low';
    renderer.shadowMap.enabled = !low;
    renderer.shadowMap.needsUpdate = true;
    const ratio = high ? 1.35 : quality === 'medium' ? 1.0 : 0.8;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, ratio));
    resize();
    room.tableSpot.castShadow = !low;
    if (room.tableSpot.shadow.map) {
      room.tableSpot.shadow.map.dispose();
      room.tableSpot.shadow.map = null;
    }
    room.tableSpot.shadow.mapSize.set(high ? 1024 : 512, high ? 1024 : 512);
    room.dust.visible = !low;
    for (const shaft of room.shafts || []) shaft.visible = !low;
    for (const cloud of room.smoke || []) cloud.sprite.visible = !low;
    applyMaterialQuality(quality);
    scene.environmentIntensity = low ? 0.24 : high ? 0.36 : 0.32;
    renderer.toneMappingExposure = high ? 1.06 : low ? 1.0 : 1.03;
  }

  return {
    renderer,
    camera,
    scene,
    configure,
    enterSeat,
    returnToMenu,
    showMenu,
    update,
    render,
    resize,
    projectSeat,
    setLook,
    setCinematic,
    setLookSensitivity,
    setIdleMotion,
    setQuality,
    dealHole,
    revealHole,
    dealBoard,
    revealShowdown,
    clearHighlights,
    syncBets,
    collectBets,
    setPot,
    sweepPotTo,
    updateStacks,
    setDealerButton,
    setBlinds,
    clearPuck,
    setActor,
    clearActor,
    react,
    showWinner,
    setMood,
    resetHandVisuals,
    get mode() { return mode; },
    get quality() { return quality; },
    get seatCount() { return seatCount.value; }
  };
}

function makeFallbackMessage(error) {
  const box = document.createElement('div');
  box.style.cssText = 'position:fixed;inset:0;display:grid;place-items:center;background:#080605;color:#e9d8b7;font:16px Georgia,serif;padding:40px;text-align:center;z-index:99999';
  box.innerHTML = `<div><h1 style="font-weight:400;letter-spacing:.06em">The room could not be opened</h1><p style="opacity:.65;max-width:520px;line-height:1.6">This table needs WebGL. Try a newer browser or turn hardware acceleration back on.</p><pre style="opacity:.4;font-size:11px;margin-top:20px;white-space:pre-wrap">${String(error && error.message || error || '')}</pre></div>`;
  document.body.appendChild(box);
}

export function bootPokerScene(canvas) {
  try {
    return createPokerScene(canvas);
  } catch (error) {
    console.error(error);
    makeFallbackMessage(error);
    return null;
  }
}
