import * as THREE from 'three';
import { mergeGeometries } from '../../../vendor/three/BufferGeometryUtils.js';
import { CROPS } from './store.js';

/* =====================================================================
   COZY FARM — the field
   Ten rows by seven, each square a little patch of soil that remembers
   whether it has been ploughed, sown, watered, fed and reaped. Crops are
   merged geometry so the whole field stays light.
   ===================================================================== */

export const FIELD = { cols: 10, rows: 7, tile: 2.3, x: -0.5, z: -7 };

function furrowTexture() {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 256;
  const x = c.getContext('2d');
  x.fillStyle = '#8d6a4b';
  x.fillRect(0, 0, 128, 256);
  for (let i = 0; i < 12; i++) {
    const y = i * 22;
    x.fillStyle = i % 2 ? '#7d5c40' : '#9a7654';
    x.fillRect(0, y, 128, 16);
    x.fillStyle = 'rgba(60,42,28,0.28)';
    x.fillRect(0, y + 14, 128, 5);
    x.fillStyle = 'rgba(255,240,210,0.07)';
    x.fillRect(0, y + 1, 128, 3);
  }
  for (let i = 0; i < 700; i++) {
    x.fillStyle = `rgba(${90 + Math.random() * 60},${65 + Math.random() * 40},${45 + Math.random() * 30},${0.15 + Math.random() * 0.25})`;
    x.fillRect(Math.random() * 128, Math.random() * 256, 1 + Math.random() * 2, 1 + Math.random() * 2);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.repeat.set(1, 2);
  return tex;
}

function stubbleTexture() {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 128;
  const x = c.getContext('2d');
  x.fillStyle = '#b49a6f';
  x.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 900; i++) {
    x.strokeStyle = `rgba(${190 + Math.random() * 40},${170 + Math.random() * 40},${120 + Math.random() * 30},${0.3 + Math.random() * 0.4})`;
    x.lineWidth = 1;
    x.beginPath();
    const px = Math.random() * 128, py = Math.random() * 128;
    x.moveTo(px, py);
    x.lineTo(px + 1, py - 3 - Math.random() * 4);
    x.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function grassTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const x = c.getContext('2d');
  x.fillStyle = '#8ea96b';
  x.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 1500; i++) {
    x.fillStyle = `rgba(${90 + Math.random() * 70},${130 + Math.random() * 60},${70 + Math.random() * 40},${0.2 + Math.random() * 0.35})`;
    x.fillRect(Math.random() * 128, Math.random() * 128, 1.4, 2 + Math.random() * 4);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/* ---- merged crop geometry ------------------------------------------- */
function mergeShapes(shapes) {
  const dummy = new THREE.Object3D();
  const geos = shapes.map(s => {
    dummy.position.set(s.x || 0, s.y || 0, s.z || 0);
    dummy.rotation.set(s.rx || 0, s.ry || 0, s.rz || 0);
    dummy.scale.set(s.sx ?? 1, s.sy ?? 1, s.sz ?? 1);
    dummy.updateMatrix();
    const geo = s.geo.clone();
    geo.applyMatrix4(dummy.matrix);
    return geo;
  });
  const merged = mergeGeometries(geos, false);
  geos.forEach(g => g.dispose());
  return merged;
}

const cropCache = {};
function cropGeometry(id) {
  if (cropCache[id]) return cropCache[id];
  const leaves = [];
  const heads = [];
  const spread = 0.86;
  const rnd = (() => { let s = id.length * 137 + 11; return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }; })();
  if (id === 'wheat' || id === 'corn') {
    const count = id === 'wheat' ? 16 : 8;
    const tall = id === 'wheat' ? 1.0 : 1.55;
    for (let i = 0; i < count; i++) {
      const x = (rnd() - 0.5) * spread * 2;
      const z = (rnd() - 0.5) * spread * 2;
      leaves.push({ geo: new THREE.CylinderGeometry(0.014, 0.028, tall, 4), x, y: tall / 2, z, rz: (rnd() - 0.5) * 0.1 });
      if (id === 'wheat') {
        heads.push({ geo: new THREE.SphereGeometry(0.055, 5, 6), x, y: tall + 0.04, z, sy: 2.1 });
      } else {
        heads.push({ geo: new THREE.SphereGeometry(0.09, 6, 6), x: x + 0.1, y: tall * 0.62, z, sy: 2.4, rz: 0.2 });
      }
    }
    if (id === 'corn') {
      for (let i = 0; i < 8; i++) {
        const x = (rnd() - 0.5) * spread * 2;
        const z = (rnd() - 0.5) * spread * 2;
        leaves.push({ geo: new THREE.ConeGeometry(0.14, 1.1, 3), x, y: 0.85, z, rz: 0.7 + rnd() * 0.4, ry: rnd() * 3, sx: 0.4, sz: 1.4 });
      }
    }
  } else if (id === 'potato') {
    for (let i = 0; i < 11; i++) {
      const x = (rnd() - 0.5) * spread * 2;
      const z = (rnd() - 0.5) * spread * 2;
      leaves.push({ geo: new THREE.IcosahedronGeometry(0.26, 1), x, y: 0.2 + rnd() * 0.18, z, sx: 1.2, sy: 0.7, sz: 1.2 });
      if (i % 3 === 0) heads.push({ geo: new THREE.SphereGeometry(0.05, 5, 4), x: x + 0.1, y: 0.4, z, sx: 1, sy: 0.6, sz: 1 });
    }
  } else if (id === 'carrot') {
    for (let i = 0; i < 15; i++) {
      const x = (rnd() - 0.5) * spread * 2;
      const z = (rnd() - 0.5) * spread * 2;
      leaves.push({ geo: new THREE.ConeGeometry(0.075, 0.72, 3), x, y: 0.36, z, ry: rnd() * 3, rz: (rnd() - 0.5) * 0.5, sx: 0.6, sz: 1.1 });
      if (i % 4 === 0) heads.push({ geo: new THREE.ConeGeometry(0.11, 0.2, 6), x, y: 0.08, z, rx: Math.PI });
    }
  } else {
    // pumpkin: broad leaves, vines and fat fruit
    for (let i = 0; i < 9; i++) {
      const x = (rnd() - 0.5) * spread * 2;
      const z = (rnd() - 0.5) * spread * 2;
      leaves.push({ geo: new THREE.SphereGeometry(0.3, 8, 6), x, y: 0.13, z, sy: 0.22, sx: 1.1, sz: 1.1 });
    }
    for (let i = 0; i < 3; i++) {
      const x = (rnd() - 0.5) * 1.2;
      const z = (rnd() - 0.5) * 1.2;
      heads.push({ geo: new THREE.SphereGeometry(0.24, 10, 8), x, y: 0.22, z, sy: 0.82 });
    }
  }
  const result = {
    leaves: mergeShapes(leaves),
    heads: mergeShapes(heads)
  };
  cropCache[id] = result;
  return result;
}

export function createField(scene, savedTiles) {
  const { cols, rows, tile: size, x: fx, z: fz } = FIELD;
  const saved = Array.isArray(savedTiles) && savedTiles.length === cols * rows ? savedTiles : null;
  const tiles = [];
  const group = new THREE.Group();
  scene.add(group);

  const furrow = new THREE.MeshStandardMaterial({ map: furrowTexture(), roughness: 1 });
  const furrowWet = new THREE.MeshStandardMaterial({ map: furrowTexture(), roughness: 0.75, color: '#8d8d8d' });
  const grassMat = new THREE.MeshStandardMaterial({ map: grassTexture(), color: '#cbd9b6', roughness: 1 });
  const stubbleMat = new THREE.MeshStandardMaterial({ map: stubbleTexture(), roughness: 1 });
  const mowedMat = new THREE.MeshStandardMaterial({ map: stubbleTexture(), color: '#c9d2a2', roughness: 1 });
  const tileGeo = new THREE.BoxGeometry(size - 0.14, 0.07, size - 0.14);

  const leafMaterials = {};
  const headMaterials = {};
  CROPS.forEach(c => {
    leafMaterials[c.id] = new THREE.MeshStandardMaterial({ color: c.leaf, roughness: 0.9 });
    headMaterials[c.id] = new THREE.MeshStandardMaterial({ color: c.head, roughness: 0.8, emissive: c.head, emissiveIntensity: 0.04 });
  });

  const highlight = new THREE.Mesh(
    new THREE.RingGeometry(size * 0.48, size * 0.56, 4),
    new THREE.MeshBasicMaterial({ color: '#f5e6b0', transparent: true, opacity: 0.8, depthWrite: false })
  );
  highlight.rotation.x = -Math.PI / 2;
  highlight.rotation.z = Math.PI / 4;
  highlight.visible = false;
  highlight.position.y = 0.075;
  scene.add(highlight);

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const x = fx + (col - (cols - 1) / 2) * size;
      const z = fz + (row - (rows - 1) / 2) * size;
      const mesh = new THREE.Mesh(tileGeo, grassMat);
      mesh.position.set(x, 0.035, z);
      mesh.receiveShadow = true;
      group.add(mesh);

      const prev = saved ? saved[row * cols + col] || {} : {};
      const tile = {
        index: row * cols + col,
        col, row, x, z,
        state: prev.state || 'grass',
        crop: prev.crop || '',
        plantedAt: +prev.plantedAt || 0,
        watered: !!prev.watered,
        fertilized: !!prev.fertilized,
        mowedAt: +prev.mowedAt || 0,
        stage: 0, ready: false,
        mesh, group: null, leaves: null, heads: null
      };
      tiles.push(tile);
    }
  }

  function refresh(tile) {
    if (saved) {
      saved[tile.index] = {
        state: tile.state, crop: tile.crop, plantedAt: tile.plantedAt,
        watered: tile.watered, fertilized: tile.fertilized, mowedAt: tile.mowedAt
      };
    }
    let material = grassMat;
    if (tile.state === 'plowed') material = furrow;
    else if (tile.state === 'crop' || tile.state === 'stubble') material = tile.fertilized ? furrowWet : furrow;
    else if (tile.state === 'mowed') material = mowedMat;
    if (tile.state === 'stubble') material = stubbleMat;
    tile.mesh.material = material;

    const hasCrop = tile.state === 'crop' && tile.crop;
    if (hasCrop) {
      const geo = cropGeometry(tile.crop);
      if (!tile.group) {
        tile.group = new THREE.Group();
        tile.group.position.set(tile.x, 0.07, tile.z);
        tile.leaves = new THREE.Mesh(geo.leaves, leafMaterials[tile.crop]);
        tile.leaves.castShadow = true;
        tile.leaves.receiveShadow = true;
        tile.heads = new THREE.Mesh(geo.heads, headMaterials[tile.crop]);
        tile.heads.castShadow = false;
        tile.group.add(tile.leaves, tile.heads);
        scene.add(tile.group);
      }
      if (tile.leaves.material !== leafMaterials[tile.crop]) tile.leaves.material = leafMaterials[tile.crop];
      if (tile.heads.material !== headMaterials[tile.crop]) tile.heads.material = headMaterials[tile.crop];
      tile.group.visible = true;
    } else if (tile.group) {
      tile.group.visible = false;
    }
  }

  function updateGrowth(now) {
    tiles.forEach(tile => {
      if (tile.state !== 'crop') { tile.stage = 0; tile.ready = false; return; }
      const crop = CROPS.find(c => c.id === tile.crop);
      if (!crop) return;
      const speed = (tile.watered ? 1.35 : 1) * (tile.fertilized ? 1.15 : 1);
      // plantedAt is wall-clock so a crop keeps growing between visits
      const raw = (Date.now() - tile.plantedAt) / (crop.grow * 1000) * speed;
      tile.stage = Math.max(0, Math.min(1, raw));
      tile.ready = tile.stage >= 1;
      if (tile.leaves) {
        const s = 0.16 + tile.stage * 0.84;
        tile.leaves.scale.set(s, s, s);
        const headScale = tile.stage > 0.55 ? Math.min(1, (tile.stage - 0.55) / 0.4) : 0.001;
        tile.heads.visible = headScale > 0.02;
        tile.heads.scale.set(headScale, headScale, headScale);
        tile.heads.position.y = (tile.stage > 0.9 ? Math.sin((now / 700) + tile.index) * 0.02 : 0);
      }
    });
  }

  function tileAt(point) {
    const col = Math.round((point.x - fx) / size + (cols - 1) / 2);
    const row = Math.round((point.z - fz) / size + (rows - 1) / 2);
    if (col < 0 || col >= cols || row < 0 || row >= rows) return null;
    return tiles[row * cols + col] || null;
  }

  function nearestTile(point, radius = 1.55) {
    let best = null, bestD = radius;
    tiles.forEach(tile => {
      const d = Math.hypot(tile.x - point.x, tile.z - point.z);
      if (d < bestD) { bestD = d; best = tile; }
    });
    return best;
  }

  function showHighlight(tile) {
    if (!tile) { highlight.visible = false; return; }
    highlight.visible = true;
    highlight.position.set(tile.x, 0.075, tile.z);
  }

  /* Apply one tool to one tile. The caller owns supplies and money. */
  function work(tile, toolId, cropId, store, now) {
    if (!tile) return { ok: false, reason: 'none' };
    if (toolId === 'plow') {
      if (tile.state === 'grass' || tile.state === 'mowed' || tile.state === 'stubble') {
        tile.state = 'plowed';
        tile.crop = '';
        tile.plantedAt = 0;
        tile.watered = false;
        tile.fertilized = false;
        tile.stage = 0;
        tile.ready = false;
        if (tile.group) tile.group.visible = false;
        refresh(tile);
        store.state.stats.plowed += 1;
        store.touch();
        return { ok: true, kind: 'plow' };
      }
      return { ok: false, reason: 'already' };
    }
    if (toolId === 'seed') {
      if (tile.state !== 'plowed') return { ok: false, reason: 'needs-plough' };
      const crop = store.cropById(cropId);
      if (!store.spend(crop.seed)) return { ok: false, reason: 'money', cost: crop.seed };
      tile.state = 'crop';
      tile.crop = crop.id;
      tile.plantedAt = Date.now();
      tile.watered = false;
      tile.fertilized = false;
      tile.stage = 0;
      tile.ready = false;
      store.state.stats.planted += 1;
      refresh(tile);
      store.touch();
      return { ok: true, kind: 'seed', crop: crop.id, cost: crop.seed };
    }
    if (toolId === 'water') {
      if (tile.state !== 'crop' || tile.watered) return { ok: false, reason: 'no-water' };
      tile.watered = true;
      store.state.stats.watered += 1;
      refresh(tile);
      store.touch();
      return { ok: true, kind: 'water', used: 'water' };
    }
    if (toolId === 'fertilize') {
      if (tile.state !== 'crop' || tile.fertilized) return { ok: false, reason: 'no-feed' };
      tile.fertilized = true;
      refresh(tile);
      store.touch();
      return { ok: true, kind: 'fertilize', used: 'fertilizer' };
    }
    if (toolId === 'harvest') {
      if (tile.state !== 'crop' || tile.stage < 1) return { ok: false, reason: 'not-ripe' };
      const crop = store.cropById(tile.crop);
      const bonus = (tile.fertilized ? 1.3 : 1) * (tile.watered ? 1.12 : 1);
      const kg = Math.round(crop.yield * bonus);
      store.addHarvest(crop.id, kg);
      tile.state = 'stubble';
      tile.crop = '';
      tile.watered = false;
      tile.fertilized = false;
      tile.stage = 0;
      tile.ready = false;
      if (tile.group) tile.group.visible = false;
      refresh(tile);
      return { ok: true, kind: 'harvest', kg, crop: crop.id };
    }
    if (toolId === 'mower') {
      if (tile.state !== 'grass') return { ok: false, reason: 'no-grass' };
      if (Date.now() - tile.mowedAt < 18000) return { ok: false, reason: 'cooldown' };
      tile.mowedAt = Date.now();
      tile.state = 'mowed';
      refresh(tile);
      return { ok: true, kind: 'mow' };
    }
    return { ok: false, reason: 'none' };
  }

  tiles.forEach(refresh);

  return { tiles, group, updateGrowth, tileAt, nearestTile, showHighlight, work, refresh, FIELD };
}
