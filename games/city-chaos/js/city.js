// ---------------------------------------------------------------------------
// The city: districts, roads, modular buildings, street furniture, parks and
// the destruction model. Buildings are built from storey modules that start as
// fixed bodies; when a storey gives way it becomes a real dynamic body, and
// when it lands it breaks into debris.
// ---------------------------------------------------------------------------
import * as THREE from 'three';
import { mat, box, cylinder, rng, clamp, makeCanvasTexture } from './core.js';

const BLOCK = 58;
const ROAD = 16;
const PITCH = BLOCK + ROAD; // 74
const GRID = [-2, -1, 0, 1, 2];
const ROAD_POS = [-185, -111, -37, 37, 111, 185];
const UNIT_BOX = new THREE.BoxGeometry(1, 1, 1);

const FACADE_STYLES = [
  { id: 'slate', wall: '#63737c', win: '#22333d', lit: '#ffcf8a', trim: '#8b9aa1' },
  { id: 'sand', wall: '#b6a58d', win: '#3b3a35', lit: '#ffdca4', trim: '#cbbda7' },
  { id: 'brick', wall: '#8f5f4e', win: '#2f2723', lit: '#ffd39a', trim: '#a97a66' },
  { id: 'glass', wall: '#4b6773', win: '#1d3a49', lit: '#bfe6ff', trim: '#6f8b96' },
  { id: 'pale', wall: '#c3c7c4', win: '#33403f', lit: '#ffe0ac', trim: '#d6d9d6' },
  { id: 'steel', wall: '#7b898e', win: '#2b3a40', lit: '#ffe6b8', trim: '#96a3a7' },
];

const STREETS = ['MAPLE AVE', '5TH STREET', 'HARBOR RD', 'ELM STREET', 'GRANITE WAY', 'UNION AVE', 'PINE ST', 'DOCKSIDE'];

function px(value) {
  return `${Math.round(value)}px`;
}

function facadeTextures(style, seed) {
  const random = rng(seed);
  const cols = 3;
  const rows = 2;
  const drawWindows = (ctx, s, litOnly) => {
    const pad = 9;
    const w = (s - pad * (cols + 1)) / cols;
    const h = (s - pad * (rows + 1)) / rows;
    for (let c = 0; c < cols; c++) {
      for (let r = 0; r < rows; r++) {
        const x = pad + c * (w + pad);
        const y = pad + r * (h + pad);
        if (litOnly) {
          if (random() > 0.4) continue;
          ctx.fillStyle = style.lit;
          ctx.globalAlpha = 0.5 + random() * 0.5;
          ctx.fillRect(x + 2, y + 2, w - 4, h * 0.72);
          ctx.globalAlpha = 1;
          continue;
        }
        // frame, glass, sill: a window you can actually read as a window
        ctx.fillStyle = style.trim;
        ctx.fillRect(x - 2, y - 2, w + 4, h * 0.82 + 4);
        ctx.fillStyle = style.win;
        ctx.fillRect(x, y, w, h * 0.82);
        ctx.fillStyle = 'rgba(190,225,240,0.20)';
        ctx.fillRect(x + 2, y + 2, w * 0.42, h * 0.5);
        ctx.fillStyle = style.trim;
        ctx.fillRect(x, y + h * 0.40, w, 2);
        ctx.fillRect(x + w * 0.5 - 1, y, 2, h * 0.82);
      }
    }
  };
  const map = makeCanvasTexture(128, (ctx, s) => {
    ctx.fillStyle = style.wall;
    ctx.fillRect(0, 0, s, s);
    ctx.strokeStyle = 'rgba(0,0,0,0.08)';
    ctx.lineWidth = 1;
    for (let y = 0; y < s; y += 32) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(s, y); ctx.stroke();
    }
    drawWindows(ctx, s, false);
  });
  const emissive = makeCanvasTexture(128, (ctx, s) => {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, s, s);
    drawWindows(ctx, s, true);
  });
  return { map, emissive };
}

function signTexture(text, background = '#1d4a34', color = '#eaf3ee') {
  return makeCanvasTexture(256, (ctx, s) => {
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, s, s);
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 4;
    ctx.strokeRect(8, 8, s - 16, s - 16);
    ctx.fillStyle = color;
    ctx.font = `700 ${s * 0.18}px "Schibsted Grotesk", system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const words = text.split(' ');
    words.forEach((word, i) => {
      ctx.fillText(word, s / 2, s / 2 + (i - (words.length - 1) / 2) * s * 0.22);
    });
  });
}

function crackTexture() {
  return makeCanvasTexture(128, (ctx, s) => {
    ctx.clearRect(0, 0, s, s);
    ctx.strokeStyle = 'rgba(12,10,9,0.85)';
    ctx.lineWidth = 2.2;
    let x = s * 0.5;
    let y = s * 0.5;
    for (let i = 0; i < 9; i++) {
      const nx = clamp(x + (Math.random() - 0.5) * s * 0.7, 2, s - 2);
      const ny = clamp(y + (Math.random() - 0.5) * s * 0.7, 2, s - 2);
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(nx, ny);
      ctx.stroke();
      x = nx; y = ny;
    }
    ctx.strokeStyle = 'rgba(255,255,255,0.14)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(s * 0.2, s * 0.8); ctx.lineTo(s * 0.8, s * 0.24); ctx.stroke();
  });
}

export class City {
  constructor({ scene, physics, fx, audio, spawnItem, explode, onBuildingGone }) {
    this.scene = scene;
    this.physics = physics;
    this.fx = fx;
    this.audio = audio;
    this.spawnItem = spawnItem;
    this.explode = explode;
    this.onBuildingGone = onBuildingGone;

    this.root = new THREE.Group();
    this.root.name = 'city';
    scene.add(this.root);

    this.entities = new Set();
    this.buildings = [];
    this.lamps = [];
    this.signals = [];
    this.cracks = [];
    this.materials = new Map();
    this.parkingSpots = [];
    this.blockMeshes = [];
    this.playerSpawn = new THREE.Vector3(37, 2.2, 37);
    this.spawnFacing = Math.PI / 4;
    this.crackMap = crackTexture();
    this.groundEntity = null;
    this.time = 0;
    this.night = 0;
    this.pendingCollapses = [];
    this.signMaterial = null;
  }

  // -------------------------------------------------------------------------
  // Build / teardown
  // -------------------------------------------------------------------------
  build(seed = Math.floor(Math.random() * 100000)) {
    this.dispose();
    this.random = rng(seed);
    this.seed = seed;

    this.buildGround();
    this.buildRoads();
    for (const i of GRID) {
      for (const j of GRID) {
        this.buildBlock(i, j);
      }
    }
    this.buildBridge();
    this.buildStreetFurniture();
    this.buildBoundary();

    this.pendingCollapses.length = 0;
    this.root.updateMatrixWorld(true);
  }

  dispose() {
    for (const entity of this.entities) this.physics.remove(entity, { silent: true });
    this.entities.clear();
    if (this.groundEntity) {
      this.physics.remove(this.groundEntity, { silent: true });
      this.groundEntity = null;
    }
    this.root.traverse((child) => {
      if (child.isMesh && child.userData.ownGeometry && child.geometry) child.geometry.dispose();
    });
    this.root.clear();
    this.buildings.length = 0;
    this.lamps.length = 0;
    this.signals.length = 0;
    this.cracks.length = 0;
    this.parkingSpots.length = 0;
    this.blockMeshes.length = 0;
    this.pendingCollapses.length = 0;
  }

  register(entity) {
    this.entities.add(entity);
    return entity;
  }

  addMesh(mesh, { shadow = true, receive = true } = {}) {
    mesh.castShadow = shadow;
    mesh.receiveShadow = receive;
    this.root.add(mesh);
    return mesh;
  }

  buildGround() {
    // The ground sits well below the road so the two planes never fight over
    // shadow-map depth (which read as a black hole around the player).
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(760, 760), mat(0x64785a, { flat: false }));
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.7;
    ground.receiveShadow = true;
    this.addMesh(ground, { shadow: false });
    this.groundEntity = this.physics.create({
      mesh: null, shape: 'box', size: [760, 1, 760], position: [0, -1.2, 0],
      fixed: true, kind: 'world', name: 'Ground', mass: 1, friction: 1,
    });
  }

  // -------------------------------------------------------------------------
  // Roads
  // -------------------------------------------------------------------------
  buildRoads() {
    // A little grain stops the asphalt reading as one flat black slab.
    const grain = this.asphaltTexture();
    const asphalt = new THREE.MeshLambertMaterial({ map: grain, color: 0xb9c2c6 });
    const extent = 408;

    for (const roadAxis of ROAD_POS) {
      // north-south road
      const ns = new THREE.Mesh(new THREE.PlaneGeometry(ROAD, extent), asphalt);
      ns.rotation.x = -Math.PI / 2;
      ns.position.set(roadAxis, 0.02, 0);
      ns.receiveShadow = true;
      this.addMesh(ns, { shadow: false });

      // east-west road
      const ew = new THREE.Mesh(new THREE.PlaneGeometry(extent, ROAD), asphalt);
      ew.rotation.x = -Math.PI / 2;
      ew.position.set(0, 0.021, roadAxis);
      ew.receiveShadow = true;
      this.addMesh(ew, { shadow: false });

      // the road surface is the floor for the whole city, so it needs a body
      this.physics.create({
        mesh: null, shape: 'box', size: [ROAD, 0.5, extent], position: [roadAxis, -0.23, 0],
        fixed: true, kind: 'scenery', name: 'Road', mass: 1, friction: 0.95,
      });
      this.physics.create({
        mesh: null, shape: 'box', size: [extent, 0.5, ROAD], position: [0, -0.23, roadAxis],
        fixed: true, kind: 'scenery', name: 'Road', mass: 1, friction: 0.95,
      });

      // kerbs
      for (const side of [-1, 1]) {
        const kerbNS = box(0.5, 0.22, extent, 0xb5bbba, { flat: false });
        kerbNS.position.set(roadAxis + side * (ROAD / 2 + 0.25), 0.11, 0);
        this.addMesh(kerbNS, { shadow: false });
        const kerbEW = box(extent, 0.22, 0.5, 0xb5bbba, { flat: false });
        kerbEW.position.set(0, 0.11, roadAxis + side * (ROAD / 2 + 0.25));
        this.addMesh(kerbEW, { shadow: false });
      }
    }

    // Block floors: grass in the leafy districts, paving elsewhere, with a
    // paved rim so every block still reads as a city block.
    const paving = mat(0xa9b0af, { flat: false });
    const grass = mat(0x6f8a58, { flat: false });
    for (const i of GRID) {
      for (const j of GRID) {
        const district = this.districtFor(i, j);
        const leafy = district === 'residential' || district === 'park';
        const slab = box(BLOCK, 0.16, BLOCK, leafy ? 0x6f8a58 : 0xa9b0af, { flat: false });
        slab.position.set(i * PITCH, 0.08, j * PITCH);
        this.addMesh(slab, { shadow: false });
        this.physics.create({
          mesh: null, shape: 'box', size: [BLOCK, 0.5, BLOCK], position: [i * PITCH, -0.08, j * PITCH],
          fixed: true, kind: 'scenery', name: 'Pavement', mass: 1, friction: 0.95,
        });
        if (!leafy) continue;
        const rim = 3.2;
        const strips = [
          [0, -BLOCK / 2 + rim / 2, BLOCK, rim],
          [0, BLOCK / 2 - rim / 2, BLOCK, rim],
          [-BLOCK / 2 + rim / 2, 0, rim, BLOCK - rim * 2],
          [BLOCK / 2 - rim / 2, 0, rim, BLOCK - rim * 2],
        ];
        for (const [dx, dz, bw, bd] of strips) {
          const strip = new THREE.Mesh(new THREE.BoxGeometry(bw, 0.17, bd), paving);
          strip.position.set(i * PITCH + dx, 0.085, j * PITCH + dz);
          strip.receiveShadow = false;
          this.addMesh(strip, { shadow: false });
        }
      }
    }

    // lane dashes, one instanced mesh for all of them
    const dashGeo = new THREE.BoxGeometry(0.22, 0.02, 2.6);
    const dashMat = mat(0xdfe3dc, { flat: false });
    const dashes = [];
    for (const roadAxis of ROAD_POS) {
      for (let d = -198; d < 198; d += 7.5) {
        let blocked = false;
        for (const cross of ROAD_POS) if (Math.abs(d - cross) < ROAD) blocked = true;
        if (blocked) continue;
        dashes.push([roadAxis, d, 0]);
        dashes.push([d, roadAxis, 1]);
      }
    }
    const inst = new THREE.InstancedMesh(dashGeo, dashMat, dashes.length);
    const m = new THREE.Matrix4();
    dashes.forEach(([x, z, vertical], index) => {
      m.makeRotationY(vertical ? Math.PI / 2 : 0);
      m.setPosition(x, 0.035, z);
      inst.setMatrixAt(index, m);
    });
    inst.instanceMatrix.needsUpdate = true;
    inst.receiveShadow = false;
    this.root.add(inst);

    // crosswalks at the four central intersections
    const stripeGeo = new THREE.BoxGeometry(0.55, 0.02, 3.2);
    const stripes = [];
    for (const x of [-37, 37]) {
      for (const z of [-37, 37]) {
        for (let k = -2; k <= 2; k++) {
          stripes.push([x + k * 1.5, z + ROAD / 2 + 2, 0]);
          stripes.push([x + k * 1.5, z - ROAD / 2 - 2, 0]);
          stripes.push([x + ROAD / 2 + 2, z + k * 1.5, 1]);
          stripes.push([x - ROAD / 2 - 2, z + k * 1.5, 1]);
        }
      }
    }
    const walk = new THREE.InstancedMesh(stripeGeo, mat(0xe8ebe4, { flat: false }), stripes.length);
    stripes.forEach(([x, z, vertical], index) => {
      m.makeRotationY(vertical ? Math.PI / 2 : 0);
      m.setPosition(x, 0.034, z);
      walk.setMatrixAt(index, m);
    });
    walk.instanceMatrix.needsUpdate = true;
    walk.receiveShadow = false;
    this.root.add(walk);
  }

  // -------------------------------------------------------------------------
  // Blocks
  // -------------------------------------------------------------------------
  buildBlock(i, j) {
    const cx = i * PITCH;
    const cz = j * PITCH;
    const district = this.districtFor(i, j);

    if (district === 'park') {
      this.buildPark(cx, cz, i, j);
    } else if (district === 'industrial') {
      this.buildIndustrial(cx, cz, i, j);
    } else if (district === 'shopping') {
      this.buildShopping(cx, cz, i, j);
    } else if (district === 'residential') {
      this.buildResidential(cx, cz, i, j);
    } else {
      this.buildDowntown(cx, cz, i, j);
    }

    // sidewalk trees on the corners of most blocks
    if (district !== 'park' && this.random() > 0.25) {
      const corners = [[-26, -26], [26, -26], [-26, 26], [26, 26]];
      for (const [ox, oz] of corners) {
        if (this.random() > 0.3) this.addTree(cx + ox, cz + oz, 1.1, this.random() > 0.5);
      }
    }
  }

  districtFor(i, j) {
    if (i === -2 && j <= -1) return 'park';
    if (i === 2 && j >= 1) return 'industrial';
    if (i >= 1 && j <= -1) return 'shopping';
    if (i < 0 || j === 2) return 'residential';
    return 'downtown';
  }

  // -------------------------------------------------------------------------
  // Downtown towers
  // -------------------------------------------------------------------------
  buildDowntown(cx, cz, i, j) {
    const random = this.random;
    const centerBias = 1 - (Math.abs(i) + Math.abs(j)) / 5;
    const towerCount = random() > 0.35 ? 2 : 1;

    if (i === 1 && j === 0) {
      this.buildParkingGarage(cx + 15, cz - 12);
      this.createTower(cx - 13, cz + 12, 12, 12, 22 + random() * 12, 'glass');
      return;
    }
    if (i === 0 && j === 1) {
      this.buildGasStation(cx - 12, cz + 14);
      this.createTower(cx + 14, cz - 12, 13, 13, 26 + random() * 16, 'slate');
      return;
    }

    const layout = towerCount === 2
      ? [[-13, -13, 15, 15], [14, 13, 14, 14]]
      : [[0, 0, 24 + random() * 5, 22 + random() * 5]];

    for (const [ox, oz, w, d] of layout) {
      const stories = Math.round(4 + centerBias * 9 + random() * 6);
      const style = FACADE_STYLES[Math.floor(random() * FACADE_STYLES.length)].id;
      this.createTower(cx + ox, cz + oz, w, d, Math.max(9, stories * 3.2), style);
    }

    // plaza details: planters, a bench, a bin — the bits that make a block
    // feel occupied even when the tower behind it is a hole in the ground
    for (const [ox, oz] of [[-20, 20], [21, -19]]) {
      const planter = box(3.4, 0.7, 3.4, 0x8d8f86, { flat: false });
      planter.position.set(cx + ox, 0.35, cz + oz);
      this.addMesh(planter);
      this.addTree(cx + ox, cz + oz, 1.2, random() > 0.5);
    }
    this.spawnItem('bench', new THREE.Vector3(cx + 20, 1, cz + 20), { rotationY: -Math.PI / 2 });
    this.spawnItem('box', new THREE.Vector3(cx - 21, 1, cz - 20));
  }

  createTower(x, z, w, d, height, styleId) {
    const random = this.random;
    const style = FACADE_STYLES.find((s) => s.id === styleId) || FACADE_STYLES[0];
    const floorH = 3.1;
    const storyCount = Math.max(2, Math.round(height / floorH));
    const texture = facadeTextures(style, Math.floor(random() * 1e9));
    const repeatX = Math.max(1, Math.round(w / 6));
    for (const map of [texture.map, texture.emissive]) {
      map.wrapS = THREE.RepeatWrapping;
      map.wrapT = THREE.RepeatWrapping;
      map.repeat.set(repeatX, 1);
      map.anisotropy = 4;
    }
    const side = new THREE.MeshStandardMaterial({
      map: texture.map,
      emissiveMap: texture.emissive,
      emissive: new THREE.Color(0xffe3b8),
      emissiveIntensity: 0,
      roughness: 0.82,
      metalness: 0.08,
    });
    const roofMat = mat(0x4d5457, { flat: false });
    const materials = [side, side, roofMat, roofMat, side, side];
    if (this.signMaterial === null) this.signMaterial = side;

    const building = {
      id: `b${this.buildings.length}`,
      kind: 'building',
      name: this.buildingName(),
      stories: [],
      downCount: 0,
      data: { cascaded: false },
      hp: 0,
      maxHp: 0,
      position: new THREE.Vector3(x, 0, z),
      materials: [side],
      destroyed: false,
      kindOf: 'tower',
      debrisColor: new THREE.Color(style.wall).getHex(),
    };

    const baseY = 0.16;
    for (let k = 0; k < storyCount; k++) {
      const node = new THREE.Group();
      const h = k === storyCount - 1 ? floorH * 1.05 : floorH * 0.99;
      const shell = new THREE.Mesh(UNIT_BOX, materials);
      shell.scale.set(w, h, d);
      shell.castShadow = true;
      shell.receiveShadow = true;
      node.add(shell);

      // top floor gets the roof furniture
      if (k === storyCount - 1) {
        const ac = box(w * 0.22, 1.1, d * 0.22, 0x7f878a, { flat: false });
        ac.position.set(w * 0.2, h / 2 + 0.55, -d * 0.2);
        ac.scale.set(1 / 1, 1, 1);
        node.add(ac);
        if (random() > 0.45) {
          const mast = cylinder(0.09, 0.13, 5 + random() * 6, 0x8a9296, 6);
          mast.position.set(-w * 0.28, h / 2 + 3.2, d * 0.24);
          node.add(mast);
        }
        if (random() > 0.6) {
          const tank = cylinder(1.3, 1.3, 2.1, 0x7d8285, 10, { flat: false });
          tank.position.set(-w * 0.16, h / 2 + 1.6, d * 0.3);
          node.add(tank);
        }
      }

      this.root.add(node);
      const storyY = baseY + k * floorH + h / 2;
      const entity = this.physics.create({
        mesh: node, shape: 'box', size: [w, h, d],
        position: [x, storyY, z], fixed: true, kind: 'building',
        name: `${building.name} floor ${k + 1}`, mass: w * h * d * 320,
        friction: 0.9, restitution: 0.02, damageable: true,
        hp: 220 + w * d * 1.6,
      });
      entity.building = building;
      entity.storyIndex = k;
      entity.roofMat = roofMat;
      entity.facade = side;
      entity.onDamage = (amount, point, normal, source) => this.hurtStory(building, entity, amount, point, normal, source);
      entity.onBreak = (point) => this.collapseStory(building, entity, point);
      this.register(entity);
      building.stories.push(entity);
      building.hp += entity.hp;
      building.maxHp += entity.maxHp;
    }

    building.height = storyCount * floorH;
    this.buildings.push(building);
    return building;
  }

  buildingName() {
    const random = this.random;
    const first = ['North', 'Hale', 'Civic', 'Lark', 'Granite', 'Union', 'Harbor', 'Beacon', 'Maple', 'Orchid', 'Kestrel', 'Vantage'];
    const second = ['Tower', 'House', 'Building', 'Exchange', 'Center', 'Plaza', 'Works', 'Lofts'];
    return `${first[Math.floor(random() * first.length)]} ${second[Math.floor(random() * second.length)]}`;
  }

  // -------------------------------------------------------------------------
  // Residential
  // -------------------------------------------------------------------------
  buildResidential(cx, cz, i, j) {
    const random = this.random;
    const lots = [[-14, -14], [14, -14], [-14, 14], [14, 14]];
    for (const [ox, oz] of lots) {
      if (random() > 0.82) continue;
      this.createHouse(cx + ox, cz + oz, 9 + random() * 3, 8 + random() * 3);
    }
    if (random() > 0.5) {
      this.spawnItem('chair', new THREE.Vector3(cx + 24, 1, cz + 23));
    }
  }

  createHouse(x, z, w, d) {
    const random = this.random;
    const wallColors = [0xd9cdb6, 0xc3cbc6, 0xd8b8a6, 0xb9c6cf, 0xcfc6a9];
    const wallColor = wallColors[Math.floor(random() * wallColors.length)];
    const roofColor = this.random() > 0.5 ? 0x6d4b3f : 0x4b5560;
    const storeys = this.random() > 0.45 ? 2 : 1;
    const floorH = 2.9;
    const totalH = storeys * floorH;
    const node = new THREE.Group();

    const walls = box(w, totalH, d, wallColor, { flat: false });
    walls.position.y = totalH / 2;
    node.add(walls);

    // pitched roof: a rotated box scaled like a prism, plus two gable planes
    const roof = new THREE.Mesh(new THREE.ConeGeometry(Math.max(w, d) * 0.78, 2.4, 4), mat(roofColor, { flat: true }));
    roof.rotation.y = Math.PI / 4;
    roof.position.y = totalH + 1.15;
    roof.scale.set(1, 1, d / w);
    roof.castShadow = true;
    node.add(roof);

    const windows = [];
    for (let wx = -1; wx <= 1; wx += 2) {
      for (let wy = 0; wy < storeys; wy++) {
        const win = box(1.1, 1.1, 0.1, 0x31434e, { flat: true, emissive: 0x22303a });
        win.position.set(wx * w * 0.24, 1.5 + wy * floorH, d / 2 + 0.03);
        node.add(win);
        windows.push(win);
      }
    }
    const door = box(1.05, 2.05, 0.14, 0x6d4c3a, { flat: false });
    door.position.set(0, 1.05, d / 2 + 0.05);
    node.add(door);

    const porch = box(w * 0.55, 0.22, 2.4, 0xb9b3a6, { flat: false });
    porch.position.set(0, 0.18, d / 2 + 1.1);
    node.add(porch);

    // front lawn
    const lawn = box(w + 10, 0.1, d + 12, 0x6f8a58, { flat: false });
    lawn.position.set(x, 0.18, z);
    this.addMesh(lawn, { shadow: false });

    // fence around the lot
    const fenceMat = mat(0xb8b2a4, { flat: true });
    for (let f = -1; f <= 1; f += 2) {
      const run = new THREE.Mesh(new THREE.BoxGeometry(0.14, 1.1, d + 9), fenceMat);
      run.position.set(x + f * (w / 2 + 4.2), 0.55, z);
      run.castShadow = true;
      this.addMesh(run);
    }

    this.root.add(node);
    const entity = this.physics.create({
      mesh: node, shape: 'box', size: [w, totalH + 2.4, d],
      position: [x, 0.16 + (totalH + 2.4) / 2, z], fixed: true,
      visualOffset: [0, -(totalH + 2.4) / 2, 0],
      kind: 'building', name: random() > 0.5 ? 'House' : 'Family home',
      mass: 60000, friction: 0.9, damageable: true, hp: 520,
    });
    entity.onDamage = (amount, point, normal, source) => this.hurtHouse(entity, amount, point, normal, source);
    entity.onBreak = (point) => this.collapseHouse(entity, point);
    entity.houseData = { wallColor, roofColor, w, d, totalH };
    this.register(entity);
    this.buildings.push({
      id: `h${this.buildings.length}`, kind: 'building', name: entity.name, stories: [entity],
      downCount: 0, data: { cascaded: false }, hp: entity.hp, maxHp: entity.maxHp,
      position: new THREE.Vector3(x, 0, z), materials: [], destroyed: false, kindOf: 'house',
    });
    entity.building = this.buildings[this.buildings.length - 1];
    entity.storyIndex = 0;
    return entity;
  }

  // -------------------------------------------------------------------------
  // Industrial
  // -------------------------------------------------------------------------
  buildIndustrial(cx, cz, i, j) {
    const random = this.random;
    const w = 30;
    const d = 20;
    const h = 9 + random() * 4;
    const node = new THREE.Group();
    const shell = box(w, h, d, 0x8e9894, { flat: false });
    shell.position.y = h / 2;
    node.add(shell);
    const roof = box(w + 1.6, 0.5, d + 1.6, 0x6c7570, { flat: false });
    roof.position.y = h + 0.2;
    node.add(roof);
    // roller doors
    for (let k = -1; k <= 1; k++) {
      const door = box(4.4, 5, 0.2, 0x5c6668, { flat: false });
      door.position.set(k * 8, 2.5, d / 2 + 0.05);
      node.add(door);
    }
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(12, 4), new THREE.MeshLambertMaterial({ map: signTexture('FREIGHT & CO'), flatShading: true }));
    sign.position.set(0, h - 2.4, d / 2 + 0.2);
    node.add(sign);

    this.root.add(node);
    const entity = this.physics.create({
      mesh: node, shape: 'box', size: [w, h, d],
      position: [cx, 0.16 + h / 2, cz], fixed: true, kind: 'building',
      visualOffset: [0, -h / 2, 0],
      name: 'Warehouse', mass: 220000, friction: 0.9, damageable: true, hp: 900,
    });
    entity.onDamage = (amount, point, normal, source) => this.hurtHouse(entity, amount, point, normal, source);
    entity.onBreak = (point) => this.collapseHouse(entity, point);
    entity.houseData = { wallColor: 0x8e9894, roofColor: 0x6c7570, w, d, totalH: h };
    this.register(entity);
    this.buildings.push({
      id: `w${this.buildings.length}`, kind: 'building', name: 'Warehouse', stories: [entity],
      downCount: 0, data: { cascaded: false }, hp: entity.hp, maxHp: entity.maxHp,
      position: new THREE.Vector3(cx, 0, cz), materials: [], destroyed: false, kindOf: 'warehouse',
    });
    entity.building = this.buildings[this.buildings.length - 1];

    // silos in the corner
    for (let s = 0; s < 2; s++) {
      const silo = cylinder(2.1, 2.1, 12, 0xb7bcb6, 12, { flat: false });
      silo.position.set(cx + 20 + s * 5, 6, cz + 24);
      this.addMesh(silo);
      const cap = new THREE.Mesh(new THREE.SphereGeometry(2.1, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), mat(0xa3a8a2, { flat: false }));
      cap.position.set(cx + 20 + s * 5, 12, cz + 24);
      this.addMesh(cap);
      const body = this.physics.create({
        mesh: silo, shape: 'cylinder', size: [2.1, 12, 2.1], position: [cx + 20 + s * 5, 6, cz + 24],
        fixed: true, kind: 'scenery', name: 'Silo', mass: 4000, friction: 0.8,
      });
      this.register(body);
    }

    // scattered crates
    for (let c = 0; c < 4; c++) {
      const x = cx + (random() - 0.5) * 26;
      const z = cz + (random() - 0.5) * 18;
      this.spawnItem('crate', new THREE.Vector3(x, 1.1 + c * 0.02, z));
    }
    if (random() > 0.4) this.spawnItem('barrel', new THREE.Vector3(cx - 12, 1.2, cz + 12));
  }

  // -------------------------------------------------------------------------
  // Shopping
  // -------------------------------------------------------------------------
  buildShopping(cx, cz, i, j) {
    const random = this.random;
    const w = 26;
    const d = 15;
    const h = 7;
    const node = new THREE.Group();
    const shell = box(w, h, d, 0xc9c2b4, { flat: false });
    shell.position.y = h / 2;
    node.add(shell);
    const band = box(w + 0.4, 1.6, d + 0.4, 0x9c5b4b, { flat: false });
    band.position.y = h - 1.6;
    node.add(band);
    const glass = box(w - 3, 3.4, 0.3, 0x3c5866, { flat: false });
    glass.position.set(0, 2.1, d / 2 + 0.06);
    node.add(glass);
    const signTex = signTexture('SUPERMARKET', '#9c5b4b', '#ffe9d6');
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(12, 4.4), new THREE.MeshLambertMaterial({ map: signTex, flatShading: true }));
    sign.position.set(0, h - 1.4, d / 2 + 0.25);
    node.add(sign);
    const roofMat = mat(0x8d8a82, { flat: false });
    const roof = box(w + 1, 0.4, d + 1, 0x8d8a82, { flat: false });
    roof.position.y = h + 0.2;
    node.add(roof);

    this.root.add(node);
    const entity = this.physics.create({
      mesh: node, shape: 'box', size: [w, h, d], position: [cx, 0.16 + h / 2, cz],
      visualOffset: [0, -h / 2, 0],
      fixed: true, kind: 'building', name: 'Supermarket', mass: 160000, friction: 0.9,
      damageable: true, hp: 760,
    });
    entity.onDamage = (amount, point, normal, source) => this.hurtHouse(entity, amount, point, normal, source);
    entity.onBreak = (point) => this.collapseHouse(entity, point);
    entity.houseData = { wallColor: 0xc9c2b4, roofColor: 0x8d8a82, w, d, totalH: h };
    this.register(entity);
    const building = {
      id: `s${this.buildings.length}`, kind: 'building', name: 'Supermarket', stories: [entity],
      downCount: 0, data: { cascaded: false }, hp: entity.hp, maxHp: entity.maxHp,
      position: new THREE.Vector3(cx, 0, cz), materials: [], destroyed: false, kindOf: 'store',
    };
    entity.building = building;
    this.buildings.push(building);

    this.buildParkingLot(cx, cz + 19, 30, 16);
    if (random() > 0.4) this.spawnItem('crate', new THREE.Vector3(cx - 16, 1, cz + 8));
  }

  buildParkingLot(cx, cz, w, d) {
    const lot = box(w, 0.06, d, 0x3b4043, { flat: false });
    lot.position.set(cx, 0.24, cz);
    this.addMesh(lot, { shadow: false });
    const bayMat = mat(0xd9ddd6, { flat: false });
    for (let k = -3; k <= 3; k++) {
      const line = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.02, 5.4), bayMat);
      line.position.set(cx + k * 4.2, 0.28, cz + d / 2 - 3.2);
      this.addMesh(line, { shadow: false });
    }
    this.parkingSpots.push({ position: new THREE.Vector3(cx - 4.2, 1.2, cz + d / 2 - 3.2), heading: Math.PI });
    this.parkingSpots.push({ position: new THREE.Vector3(cx + 4.2, 1.2, cz + d / 2 - 3.2), heading: Math.PI });
  }

  // -------------------------------------------------------------------------
  // Park
  // -------------------------------------------------------------------------
  buildPark(cx, cz, i, j) {
    const random = this.random;
    const lawn = box(BLOCK - 2, 0.22, BLOCK - 2, 0x6d8b52, { flat: false });
    lawn.position.set(cx, 0.24, cz);
    this.addMesh(lawn, { shadow: false });

    // paths
    const pathMat = mat(0xc0b9a6, { flat: false });
    const pathA = box(BLOCK - 6, 0.06, 4, 0xc0b9a6, { flat: false });
    pathA.position.set(cx, 0.28, cz);
    this.addMesh(pathA, { shadow: false });
    const pathB = box(4, 0.06, BLOCK - 6, 0xc0b9a6, { flat: false });
    pathB.position.set(cx, 0.28, cz);
    this.addMesh(pathB, { shadow: false });

    // fountain in the middle
    const basin = cylinder(4.4, 4.8, 1, 0xb5b2a4, 16, { flat: false });
    basin.position.set(cx, 0.75, cz);
    this.addMesh(basin);
    const water = cylinder(4, 4, 0.16, 0x4f8fa3, 16, { flat: false, opacity: 0.9 });
    water.position.set(cx, 1.25, cz);
    this.addMesh(water, { shadow: false });
    const plinth = cylinder(0.8, 1.1, 2.2, 0xa8a496, 10, { flat: false });
    plinth.position.set(cx, 2.2, cz);
    this.addMesh(plinth);
    this.physics.create({
      mesh: basin, shape: 'cylinder', size: [4.8, 1, 4.8], position: [cx, 0.75, cz],
      fixed: true, kind: 'scenery', name: 'Fountain', mass: 9000, friction: 0.9,
    });

    for (let t = 0; t < 9; t++) {
      const angle = random() * Math.PI * 2;
      const radius = 9 + random() * 16;
      this.addTree(cx + Math.cos(angle) * radius, cz + Math.sin(angle) * radius, 1.1 + random() * 0.7, random() > 0.6);
    }
    for (let b = 0; b < 2; b++) {
      this.spawnItem('bench', new THREE.Vector3(cx + (b ? 9 : -9), 1, cz + 6), { rotationY: Math.PI / 2 });
    }
    this.spawnItem('box', new THREE.Vector3(cx + 6, 1, cz - 8));
  }

  // -------------------------------------------------------------------------
  // Parking garage and gas station
  // -------------------------------------------------------------------------
  buildParkingGarage(cx, cz) {
    const levels = 3;
    const levelH = 3.2;
    const w = 16;
    const d = 22;
    const node = new THREE.Group();
    const slabMat = 0x9c9e97;
    for (let level = 0; level < levels; level++) {
      const slab = box(w, 0.35, d, slabMat, { flat: false });
      slab.position.y = level * levelH + 0.3;
      node.add(slab);
      for (let px2 = -1; px2 <= 1; px2 += 2) {
        for (let pz = -1; pz <= 1; pz += 2) {
          const pillar = box(0.7, levelH, 0.7, 0x8c8e88, { flat: false });
          pillar.position.set(px2 * (w / 2 - 1.1), level * levelH + levelH / 2, pz * (d / 2 - 1.1));
          node.add(pillar);
        }
      }
      // edge barriers
      for (let pz = -1; pz <= 1; pz += 2) {
        const rail = box(w, 0.9, 0.3, 0xb9bbb4, { flat: false });
        rail.position.set(0, level * levelH + 0.85, pz * (d / 2 - 0.2));
        node.add(rail);
      }
    }
    this.root.add(node);
    const entity = this.physics.create({
      mesh: node, shape: 'box', size: [w, levels * levelH, d],
      position: [cx, 0.16 + (levels * levelH) / 2, cz], fixed: true, kind: 'building',
      visualOffset: [0, -(levels * levelH) / 2, 0],
      name: 'Parking garage', mass: 500000, friction: 0.9, damageable: true, hp: 1600,
    });
    entity.onDamage = (amount, point, normal, source) => this.hurtHouse(entity, amount, point, normal, source);
    entity.onBreak = (point) => this.collapseHouse(entity, point);
    entity.houseData = { wallColor: 0x9c9e97, roofColor: 0x8c8e88, w, d, totalH: levels * levelH };
    this.register(entity);
    const building = {
      id: `g${this.buildings.length}`, kind: 'building', name: 'Parking garage', stories: [entity],
      downCount: 0, data: { cascaded: false }, hp: entity.hp, maxHp: entity.maxHp,
      position: new THREE.Vector3(cx, 0, cz), materials: [], destroyed: false, kindOf: 'garage',
    };
    entity.building = building;
    this.buildings.push(building);
    this.parkingSpots.push({ position: new THREE.Vector3(cx - 4, 1.3, cz + 4), heading: Math.PI / 2 });
    this.parkingSpots.push({ position: new THREE.Vector3(cx + 4, 1.3, cz - 4), heading: -Math.PI / 2 });
  }

  buildGasStation(cx, cz) {
    const node = new THREE.Group();
    const stationColor = 0xd9d5c6;
    const shop = box(12, 4.2, 8, stationColor, { flat: false });
    shop.position.set(0, 2.1, -10);
    node.add(shop);
    const shopSign = new THREE.Mesh(new THREE.PlaneGeometry(7, 2), new THREE.MeshLambertMaterial({ map: signTexture('FUEL & MART', '#2c4a57', '#e9f2f5'), flatShading: true }));
    shopSign.position.set(0, 3.2, -5.95);
    node.add(shopSign);

    // canopy on four pillars
    const canopy = box(18, 0.6, 12, 0xe2ded2, { flat: false });
    canopy.position.set(0, 5.4, 3);
    node.add(canopy);
    const canopyEdge = box(18.4, 0.5, 12.4, 0xbf5b47, { flat: false });
    canopyEdge.position.set(0, 5.05, 3);
    node.add(canopyEdge);
    for (let ox = -1; ox <= 1; ox += 2) {
      for (let oz = -1; oz <= 1; oz += 2) {
        const column = cylinder(0.32, 0.32, 5.2, 0xb9b5a8, 8, { flat: false });
        column.position.set(ox * 7.6, 2.6, 3 + oz * 4.6);
        node.add(column);
      }
    }
    // pumps are real physics props so they can be knocked over
    for (let p = -1; p <= 1; p += 2) {
      this.spawnItem('pump', new THREE.Vector3(cx + p * 4, 1, cz + 3));
    }
    this.root.add(node);
    const entity = this.physics.create({
      mesh: node, shape: 'box', size: [18, 5.7, 22],
      position: [cx, 0.16 + 2.85, cz - 1], fixed: true, kind: 'building',
      visualOffset: [0, -2.85, 0],
      name: 'Fuel station', mass: 120000, friction: 0.9, damageable: true, hp: 700,
    });
    entity.onDamage = (amount, point, normal, source) => this.hurtHouse(entity, amount, point, normal, source);
    entity.onBreak = (point) => this.collapseHouse(entity, point);
    entity.houseData = { wallColor: 0xd9d5c6, roofColor: 0xbf5b47, w: 18, d: 22, totalH: 5.7 };
    this.register(entity);
    const building = {
      id: `f${this.buildings.length}`, kind: 'building', name: 'Fuel station', stories: [entity],
      downCount: 0, data: { cascaded: false }, hp: entity.hp, maxHp: entity.maxHp,
      position: new THREE.Vector3(cx, 0, cz), materials: [], destroyed: false, kindOf: 'station',
    };
    entity.building = building;
    this.buildings.push(building);
  }

  // -------------------------------------------------------------------------
  // Overpass
  // -------------------------------------------------------------------------
  buildBridge() {
    const z = 111;
    const deckMat = mat(0x8f9391, { flat: false });
    const x = 0;
    // deck crossing the east-west road, high above it, running north-south
    const deck = box(13, 0.7, 62, 0x8f9391, { flat: false });
    deck.position.set(x, 7.4, z);
    this.addMesh(deck);
    for (let side = -1; side <= 1; side += 2) {
      const rail = box(0.4, 1.1, 62, 0xb0b4b1, { flat: false });
      rail.position.set(x + side * 6.4, 8.2, z);
      this.addMesh(rail);
    }
    // piers
    for (let pz = -22; pz <= 22; pz += 22) {
      for (let side = -1; side <= 1; side += 2) {
        const pier = box(0.8, 7.1, 0.8, 0x9a9d99, { flat: false });
        pier.position.set(x + side * 4.6, 3.55, z + pz);
        this.addMesh(pier);
      }
    }
    // ramps, tilted boxes with matching collider rotation
    for (let dir = -1; dir <= 1; dir += 2) {
      const rampLength = 26;
      const ramp = box(13, 0.6, rampLength, deckMat.color.getHex(), { flat: false });
      const angle = Math.atan2(7.4, rampLength * 0.9);
      ramp.rotation.x = dir * angle;
      ramp.position.set(x, 3.9, z + dir * (31 + rampLength * 0.32));
      this.addMesh(ramp);
      const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(dir * angle, 0, 0));
      const collider = this.physics.create({
        mesh: null, shape: 'box', size: [13, 0.6, rampLength], position: [x, 3.9, z + dir * (31 + rampLength * 0.32)],
        rotation: q, fixed: true, kind: 'scenery', name: 'Ramp', mass: 90000, friction: 1,
      });
      this.register(collider);
    }
    const entity = this.physics.create({
      mesh: deck, shape: 'box', size: [13, 0.7, 62], position: [x, 7.4, z], fixed: true,
      kind: 'building', name: 'Overpass', mass: 240000, friction: 0.9, damageable: true, hp: 1800,
    });
    entity.onDamage = (amount, point, normal, source) => this.hurtHouse(entity, amount, point, normal, source);
    entity.onBreak = (point) => this.collapseHouse(entity, point);
    entity.houseData = { wallColor: 0x8f9391, roofColor: 0x9a9d99, w: 13, d: 62, totalH: 0.7, flat: true };
    this.register(entity);
    const building = {
      id: `o${this.buildings.length}`, kind: 'building', name: 'Overpass', stories: [entity],
      downCount: 0, data: { cascaded: false }, hp: entity.hp, maxHp: entity.maxHp,
      position: new THREE.Vector3(x, 0, z), materials: [], destroyed: false, kindOf: 'bridge',
    };
    entity.building = building;
    this.buildings.push(building);
  }

  // -------------------------------------------------------------------------
  // Street furniture
  // -------------------------------------------------------------------------
  asphaltTexture() {
    if (this.roadTexture) return this.roadTexture;
    const texture = makeCanvasTexture(128, (ctx, size) => {
      ctx.fillStyle = '#41474b';
      ctx.fillRect(0, 0, size, size);
      for (let i = 0; i < 3200; i++) {
        const shade = 56 + Math.floor(Math.random() * 22);
        ctx.fillStyle = `rgba(${shade},${shade + 2},${shade + 4},${0.2 + Math.random() * 0.28})`;
        const r = 0.6 + Math.random() * 1.4;
        ctx.beginPath();
        ctx.arc(Math.random() * size, Math.random() * size, r, 0, Math.PI * 2);
        ctx.fill();
      }
    });
    if (texture) {
      texture.wrapS = THREE.RepeatWrapping;
      texture.wrapT = THREE.RepeatWrapping;
      texture.repeat.set(70, 70);
      texture.anisotropy = 8;
    }
    this.roadTexture = texture;
    return texture;
  }

  buildStreetFurniture() {
    const random = this.random;
    // streetlights along the main roads
    for (const roadAxis of [-37, 37]) {
      for (let t = -140; t <= 140; t += 78) {
        for (const side of [-1, 1]) {
          const x = roadAxis + side * (ROAD / 2 - 1.2);
          const z = t + side * 21;
          if (Math.abs(x) > 200 || Math.abs(z) > 200) continue;
          this.addStreetlight(x, z, side);
        }
      }
    }

    // traffic lights on the central intersections
    for (const x of [37, -37]) {
      for (const z of [37, -37]) {
        this.addTrafficLight(x - ROAD / 2 - 1, z - ROAD / 2 - 1, 0);
        this.addTrafficLight(x + ROAD / 2 + 1, z + ROAD / 2 + 1, Math.PI);
      }
    }

    // street name signs at the central crossings
    const names = STREETS.slice();
    for (const x of [-37, 37]) {
      for (const z of [-37, 37]) {
        this.addStreetSign(x + ROAD / 2 + 3, z - ROAD / 2 - 3, names[Math.floor(random() * names.length)]);
      }
    }
  }

  addStreetlight(x, z, side) {
    const group = new THREE.Group();
    const pole = cylinder(0.12, 0.16, 7.4, 0x5b6468, 8, { flat: false });
    pole.position.y = 3.7;
    group.add(pole);
    const arm = box(2.2, 0.16, 0.16, 0x5b6468, { flat: false });
    arm.position.set(-side * 1.1, 7.35, 0);
    group.add(arm);
    const head = box(0.9, 0.24, 0.42, 0x3c4447, { flat: false });
    head.position.set(-side * 2.1, 7.24, 0);
    group.add(head);
    const lampMat = new THREE.MeshBasicMaterial({ color: 0xffd79b });
    const glow = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.08, 0.3), lampMat);
    glow.position.set(-side * 2.1, 7.1, 0);
    group.add(glow);

    // soft halo sprite that only shows at night
    const haloTexture = this.lampHalo || (this.lampHalo = makeCanvasTexture(64, (ctx, size) => {
      const gradient = ctx.createRadialGradient(size / 2, size / 2, 1, size / 2, size / 2, size / 2);
      gradient.addColorStop(0, 'rgba(255,214,155,0.85)');
      gradient.addColorStop(0.5, 'rgba(255,205,140,0.22)');
      gradient.addColorStop(1, 'rgba(255,200,130,0)');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, size, size);
    }));
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: haloTexture, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, opacity: 0 }));
    halo.scale.set(9, 9, 1);
    halo.position.set(-side * 2.1, 7.05, 0);
    group.add(halo);

    group.position.set(x, 0.16, z);
    this.root.add(group);
    this.lamps.push({ halo, lampMat, position: new THREE.Vector3(x - side * 2.1, 7.05, z) });
    this.physics.create({
      mesh: null, shape: 'box', size: [0.4, 7.4, 0.4], position: [x, 3.7, z],
      fixed: true, kind: 'scenery', name: 'Streetlight', mass: 700, friction: 0.8,
    });
  }

  addTrafficLight(x, z, rotation) {
    const group = new THREE.Group();
    const pole = cylinder(0.15, 0.18, 5.4, 0x4b5357, 8, { flat: false });
    pole.position.y = 2.7;
    group.add(pole);
    const housing = box(0.5, 1.5, 0.5, 0x2f3739, { flat: false });
    housing.position.y = 4.9;
    group.add(housing);
    const lights = [];
    const colors = [0xe4553f, 0xe9b44c, 0x54c47a];
    for (let i = 0; i < 3; i++) {
      const bulbMat = new THREE.MeshBasicMaterial({ color: colors[i] });
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.15, 8, 6), bulbMat);
      bulb.position.set(0, 5.35 - i * 0.42, 0.27);
      group.add(bulb);
      lights.push(bulbMat);
    }
    group.rotation.y = rotation;
    group.position.set(x, 0.16, z);
    this.root.add(group);
    this.signals.push({ lights, phase: Math.random() * Math.PI * 2, position: new THREE.Vector3(x, 5, z) });
    this.physics.create({
      mesh: null, shape: 'box', size: [0.5, 5.4, 0.5], position: [x, 2.7, z],
      fixed: true, kind: 'scenery', name: 'Traffic light', mass: 300, friction: 0.8,
    });
  }

  addStreetSign(x, z, text) {
    const pole = cylinder(0.07, 0.07, 3.1, 0x6f787c, 6, { flat: false });
    pole.position.set(x, 1.7, z);
    this.addMesh(pole);
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 0.8), new THREE.MeshLambertMaterial({ map: signTexture(text), flatShading: true, side: THREE.DoubleSide }));
    sign.position.set(x, 3.05, z);
    sign.rotation.y = Math.PI / 4;
    this.addMesh(sign);
  }

  addTree(x, z, scale, conifer) {
    const group = new THREE.Group();
    const trunk = cylinder(0.16 * scale, 0.22 * scale, 2.6 * scale, 0x6b533d, 6, { flat: true });
    trunk.position.y = 1.3 * scale;
    group.add(trunk);
    if (conifer) {
      for (let i = 0; i < 3; i++) {
        const cone = new THREE.Mesh(new THREE.ConeGeometry((1.6 - i * 0.34) * scale, 2.4 * scale, 7), mat(0x3f6b4b, { flat: true }));
        cone.position.y = (2.5 + i * 1.35) * scale;
        cone.castShadow = true;
        group.add(cone);
      }
    } else {
      const canopy = new THREE.Mesh(new THREE.IcosahedronGeometry(1.75 * scale, 0), mat(0x4f7a4a, { flat: true }));
      canopy.position.y = 3.6 * scale;
      canopy.scale.set(1, 0.9, 1);
      canopy.castShadow = true;
      group.add(canopy);
      const canopy2 = new THREE.Mesh(new THREE.IcosahedronGeometry(1.2 * scale, 0), mat(0x5b8754, { flat: true }));
      canopy2.position.set(0.7 * scale, 4.3 * scale, 0.3 * scale);
      canopy2.castShadow = true;
      group.add(canopy2);
    }
    group.position.set(x, 0.2, z);
    this.root.add(group);
    this.physics.create({
      mesh: null, shape: 'cylinder', size: [0.28 * scale, 2.6 * scale, 0.28 * scale],
      position: [x, 1.3 * scale + 0.2, z], fixed: true, kind: 'scenery', name: 'Tree', mass: 900, friction: 0.9,
    });
  }

  buildBoundary() {
    const walls = [
      [0, 210, 420, 1], [0, -210, 420, 1], [210, 0, 1, 420], [-210, 0, 1, 420],
    ];
    for (const [x, z, w, d] of walls) {
      this.physics.create({
        mesh: null, shape: 'box', size: [w, 24, d], position: [x, 12, z],
        fixed: true, kind: 'scenery', name: 'City limits', mass: 1, friction: 0.4,
      });
    }
  }

  // -------------------------------------------------------------------------
  // Damage
  // -------------------------------------------------------------------------
  hurtStory(building, story, amount, point, normal, source) {
    if (!story || story.data.down || story.dead || building.destroyed) return;
    const before = story.hp;
    story.hp -= amount;
    building.hp = Math.max(0, building.hp - amount);

    // surface damage: dent, cracks, a few facade shards
    if (amount > 6 && story.mesh) {
      story.data.dents = (story.data.dents || 0) + 1;
      story.dent = Math.min(0.55, (story.data.dents || 0) * 0.045);
      if (!story.data.cracked || amount > 40) {
        story.data.cracked = true;
        this.addCrack(point, normal);
      }
      if (this.fx) {
        for (let i = 0; i < Math.min(4, Math.ceil(amount / 22)); i++) {
          this.fx.debris(
            new THREE.Vector3(point.x, point.y, point.z),
            new THREE.Vector3((Math.random() - 0.5) * 5, 1 + Math.random() * 4, (Math.random() - 0.5) * 5),
            0.22 + Math.random() * 0.35,
            building.debrisColor ?? 0x9b9c96, 2.6
          );
        }
      }
      this.audio?.impact(point, clamp(amount / 90, 0.1, 1), 'concrete');
    }

    if (story.hp <= 0 && before > 0) {
      story.hp = 0;
      this.collapseStory(building, story, point, true);
      return;
    }

    // once enough of a tower is gone, the rest follows
    if (!building.data.cascaded && building.kindOf === 'tower' && building.stories.length > 2) {
      const remaining = building.stories.filter((s) => !s.data.down);
      if (remaining.length <= Math.ceil(building.stories.length * 0.45)) {
        building.data.cascaded = true;
        this.cascade(building);
      }
    }
  }

  hurtHouse(entity, amount, point, normal) {
    if (!entity || entity.dead || entity.data.down) return;
    entity.hp -= amount;
    const building = entity.building;
    if (building) building.hp = Math.max(0, building.hp - amount);
    if (amount > 8) {
      this.addCrack(point, normal);
      this.audio?.impact(point, clamp(amount / 110, 0.1, 1), 'concrete');
      if (this.fx) {
        for (let i = 0; i < Math.min(5, Math.ceil(amount / 30)); i++) {
          this.fx.debris(
            new THREE.Vector3(point.x, point.y, point.z),
            new THREE.Vector3((Math.random() - 0.5) * 6, 1 + Math.random() * 5, (Math.random() - 0.5) * 6),
            0.24 + Math.random() * 0.4,
            entity.houseData?.wallColor ?? 0x9b9c96, 3
          );
        }
      }
    }
    if (entity.hp <= 0) this.collapseHouse(entity, point);
  }

  addCrack(point, normal) {
    if (this.cracks.length > 120) {
      const old = this.cracks.shift();
      if (old.parent) old.parent.remove(old);
    }
    // Accept anything with x/y/z so a contact point from Rapier works here too.
    const position = new THREE.Vector3(point.x, point.y, point.z);
    const facing = new THREE.Vector3(normal?.x ?? 0, normal?.y ?? 1, normal?.z ?? 0).normalize();
    const size = 1.2 + Math.random() * 1.8;
    const crack = new THREE.Mesh(
      new THREE.PlaneGeometry(size, size),
      new THREE.MeshBasicMaterial({ map: this.crackMap, transparent: true, opacity: 0.85, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 })
    );
    crack.position.copy(position).addScaledVector(facing, 0.035);
    crack.lookAt(position.clone().add(facing));
    crack.rotateZ(Math.random() * Math.PI * 2);
    this.root.add(crack);
    this.cracks.push(crack);
  }

  collapseStory(building, story, point, force = false) {
    if (!story || story.data.down || story.dead) return;
    if (!force && story.hp > 0) return;
    story.data.down = true;
    building.downCount++;
    story.damageable = false;
    story.onDamage = null;
    story.hp = 0;
    story.body.setBodyType(this.physics.R.RigidBodyType.Dynamic, true);
    story.body.enableCcd?.(true);
    story.frozen = false;
    story.body.wakeUp();
    const dir = new THREE.Vector3(
      (Math.random() - 0.5) * 0.7, -1, (Math.random() - 0.5) * 0.7
    ).normalize();
    story.body.applyImpulse(
      { x: dir.x * story.mass * 0.35, y: -story.mass * 0.55, z: dir.z * story.mass * 0.35 }, true
    );
    story.body.applyTorqueImpulse({
      x: (Math.random() - 0.5) * story.mass * 0.4,
      y: (Math.random() - 0.5) * story.mass * 0.4,
      z: (Math.random() - 0.5) * story.mass * 0.4,
    }, true);
    story.data.falling = true;
    story.data.fallAt = performance.now();
    this.audio?.collapse(story.body.translation(), 0.6);
    if (this.fx && point) this.fx.dust(new THREE.Vector3(point.x, point.y, point.z), 10, 2.2);

    if (building.kindOf === 'tower') {
      // keep the stack above from floating: everything above gives way too
      for (const other of building.stories) {
        if (other === story || other.data.down) continue;
        if (other.storyIndex > story.storyIndex) {
          this.scheduleCollapse(building, other, 90 + (other.storyIndex - story.storyIndex) * 45);
        }
      }
    } else if (building.stories.length <= 1) {
      building.destroyed = true;
      if (this.onBuildingGone) this.onBuildingGone(building);
    }
  }

  scheduleCollapse(building, story, delay) {
    this.pendingCollapses.push({ building, story, at: performance.now() + delay });
  }

  cascade(building) {
    if (this.audio) this.audio.collapse({ x: building.position.x, y: 6, z: building.position.z }, 1);
    let delay = 0;
    for (const story of building.stories) {
      if (story.data.down) continue;
      this.scheduleCollapse(building, story, delay);
      delay += 85;
    }
  }

  collapseHouse(entity, point) {
    if (!entity || entity.dead || entity.data.down) return;
    entity.data.down = true;
    const data = entity.houseData || {};
    const position = entity.body.translation();
    this.audio?.collapse(position, 1);
    if (this.fx) {
      this.fx.dust(new THREE.Vector3(position.x, position.y, position.z), 26, 3.4);
      this.fx.shakeAt(position, 0.7);
    }
    const pieces = 12;
    for (let i = 0; i < pieces; i++) {
      const w = (data.w || 10) * (0.14 + Math.random() * 0.2);
      const h = (data.totalH || 6) * (0.1 + Math.random() * 0.26);
      const d = (data.d || 8) * (0.14 + Math.random() * 0.24);
      const color = i % 3 === 0 ? (data.roofColor ?? 0x6d4b3f) : (data.wallColor ?? 0xcfc6a9);
      this.fx.debris(
        new THREE.Vector3(
          position.x + (Math.random() - 0.5) * (data.w || 10),
          Math.max(0.6, position.y + (Math.random() - 0.5) * (data.totalH || 6)),
          position.z + (Math.random() - 0.5) * (data.d || 8)
        ),
        new THREE.Vector3((Math.random() - 0.5) * 10, 2 + Math.random() * 7, (Math.random() - 0.5) * 10),
        Math.max(0.3, Math.min(1.2, (w + h + d) / 3)),
        color, 7, { w, h, d }
      );
    }
    entity.building && (entity.building.destroyed = true);
    this.physics.remove(entity, { silent: true });
    if (this.onBuildingGone) this.onBuildingGone(entity.building);
  }

  /** Called when a falling storey hits something at speed. */
  settleStory(story) {
    if (!story || story.dead || story.data.settled) return;
    const position = story.body.translation();
    const size = story.size;
    const building = story.building;
    story.data.settled = true;
    const pieces = 8;
    for (let i = 0; i < pieces; i++) {
      const w = size[0] * (0.2 + Math.random() * 0.28);
      const h = Math.max(0.3, size[1] * (0.12 + Math.random() * 0.3));
      const d = size[2] * (0.2 + Math.random() * 0.28);
      this.fx?.debris(
        new THREE.Vector3(
          position.x + (Math.random() - 0.5) * size[0],
          Math.max(0.5, position.y + (Math.random() - 0.5) * size[1]),
          position.z + (Math.random() - 0.5) * size[2]
        ),
        new THREE.Vector3((Math.random() - 0.5) * 7, 1 + Math.random() * 5, (Math.random() - 0.5) * 7),
        Math.max(0.3, Math.min(1.4, (w + h + d) / 3)),
        building?.debrisColor ?? 0x8d8f8a,
        6, { w, h, d }
      );
    }
    this.audio?.collapse(position, 0.7);
    this.fx?.dust(new THREE.Vector3(position.x, Math.max(0.6, position.y), position.z), 8, 2);
    this.physics.remove(story, { silent: true });
    if (building && !building.destroyed && building.stories.every((s) => s.data.down || s.dead)) {
      building.destroyed = true;
      if (this.onBuildingGone) this.onBuildingGone(building);
    }
  }

  /** Building under the crosshair, for the repair tool and the info panel. */
  buildingAt(point, radius = 2) {
    for (const building of this.buildings) {
      if (building.destroyed) continue;
      const dx = building.position.x - point.x;
      const dz = building.position.z - point.z;
      if (dx * dx + dz * dz < radius * radius) return building;
    }
    return null;
  }

  repair(building) {
    if (!building) return false;
    for (const story of building.stories) {
      if (story.dead) continue;
      story.hp = story.maxHp;
      story.data.down = false;
      story.data.settled = false;
      story.data.dents = 0;
      story.damageable = true;
      story.frozen = true;
      story.dent = 0;
      story.body.setBodyType(this.physics.R.RigidBodyType.Fixed, true);
      story.body.setTranslation({ x: story.home.position[0], y: story.home.position[1], z: story.home.position[2] }, true);
      story.body.setRotation(story.home.rotation || { x: 0, y: 0, z: 0, w: 1 }, true);
      story.body.wakeUp();
      if (story.mesh) {
        story.mesh.visible = true;
        if (!story.mesh.parent) this.root.add(story.mesh);
      }
      story.onDamage = null;
      story.onBreak = null;
    }
    building.hp = building.maxHp;
    building.downCount = 0;
    building.destroyed = false;
    building.data.cascaded = false;
    return true;
  }

  // -------------------------------------------------------------------------
  // Frame update
  // -------------------------------------------------------------------------
  update(dt, night) {
    this.time += dt;
    this.night = night;

    // pending staged collapses
    if (this.pendingCollapses.length) {
      const now = performance.now();
      for (let i = this.pendingCollapses.length - 1; i >= 0; i--) {
        const job = this.pendingCollapses[i];
        if (now >= job.at) {
          this.pendingCollapses.splice(i, 1);
          this.collapseStory(job.building, job.story, null, true);
        }
      }
    }

    // storeys that have landed break apart
    for (const entity of this.entities) {
      if (entity.kind !== 'building' || !entity.data.falling || entity.data.settled || entity.dead) continue;
      const y = entity.body.translation().y;
      const speed = entity.lastSpeed;
      if (y < entity.size[1] * 0.6 || (speed < 1.2 && performance.now() - entity.data.fallAt > 900)) {
        this.settleStory(entity);
      }
    }

    // window lights and street lamps follow the sun
    const lampPower = clamp((night - 0.25) / 0.6, 0, 1);
    for (const lamp of this.lamps) {
      lamp.halo.material.opacity = lampPower * 0.9;
      lamp.halo.visible = lampPower > 0.02;
    }
    if (this.signMaterial) this.signMaterial.emissiveIntensity = night * 1.5;
    for (const building of this.buildings) {
      for (const material of building.materials) material.emissiveIntensity = night * 1.35;
    }

    // traffic lights cycle: green, amber, red
    for (const signal of this.signals) {
      const phase = (this.time * 0.28 + signal.phase) % 1;
      const state = phase < 0.46 ? 2 : phase < 0.56 ? 1 : 0;
      signal.lights.forEach((material, index) => {
        const on = index === state;
        material.color.setHex(index === 0 ? (on ? 0xff6b52 : 0x3a2620) : index === 1 ? (on ? 0xffc75a : 0x3a3221) : (on ? 0x66e08e : 0x203a2a));
      });
    }

    // gentle tint on damaged storeys (a dent, not a texture swap)
    for (const building of this.buildings) {
      for (const story of building.stories) {
        if (!story.mesh || story.dead) continue;
        const dent = story.dent || 0;
        if (story.facade) story.facade.color.setRGB(1 - dent * 0.5, 1 - dent * 0.55, 1 - dent * 0.6);
      }
    }
  }
}
