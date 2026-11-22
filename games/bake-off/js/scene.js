/* =====================================================================
   BAKE OFF! — the 3D studio
   One warm pastel kitchen, four camera stations: the bench where you mix,
   the oven, the decorating turntable and the presentation stage.
   ===================================================================== */
import * as THREE from "three";
import {
  mat, cream, metal, glass, emissive, box, cyl, ball, cone, torus, group, lathe,
  buildBowl, buildWhisk, buildTray, buildIngredient, buildTopping, buildCreation,
  buildChef, animateChef, buildPlate, textTexture, woodTexture, tileTexture
} from "./models.js";
import { ingredientById, toppingById, KITCHENS } from "./data.js";

export const world = {
  renderer: null,
  scene: null,
  camera: null,
  canvas: null,
  chef: null,
  kitchen: null,
  propGroup: null,
  prepGroup: null,
  ovenGroup: null,
  decorGroup: null,
  stageGroup: null,
  cakeGroup: null,
  mode: "wide",
  time: 0,
  pickables: [],
  callbacks: { onPick: null, onPlaceTop: null },
  cameraState: { az: 0.22, polar: 0.98, dist: 9, target: new THREE.Vector3(0, 1.4, -0.3) },
  cameraWanted: { az: 0.22, polar: 0.98, dist: 9, target: new THREE.Vector3(0, 1.4, -0.3) },
  cameraModes: {
    // `polar` is the elevation above the horizon, so small values are eye level.
    wide: { az: 0.3, polar: 0.3, dist: 8.4, target: [0, 1.35, -0.7] },
    prep: { az: 0.08, polar: 0.3, dist: 3.6, target: [-0.15, 1.18, 0.15] },
    oven: { az: -0.5, polar: 0.24, dist: 3.4, target: [1.6, 1.1, -1.5] },
    decor: { az: 0.05, polar: 0.62, dist: 4.2, target: [0, 1.45, 0.3] },
    stage: { az: 0.0, polar: 0.4, dist: 5.2, target: [0, 1.1, 0.35] },
    vote: { az: 0.0, polar: 0.4, dist: 5.2, target: [0, 1.1, 0.35] }
  },
  cakeTopY: 1.35,
  cakeTopRadius: 0.9,
  placement: null,
  ghostTopping: null,
  hover: null,
  raycaster: new THREE.Raycaster(),
  pointer: new THREE.Vector2(),
  pointerDown: null,
  oven: { open: false, baking: false, done: false, door: null, light: null, glow: null, tray: null },
  bowl: { fill: null, level: 0, color: "#f4e3c5" },
  mixer: { head: null, bowl: null, on: false, angle: 0 },
  steam: null,
  stageSpin: 0,
  ready: false
};

const KITCHEN = KITCHENS[0];

/* ---------------------------------------------------------------------
   Boot
   --------------------------------------------------------------------- */
export function initWorld(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.8));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.98;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#f7e7dc");
  scene.fog = new THREE.Fog(new THREE.Color("#f7e7dc"), 22, 44);

  const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 120);

  scene.add(new THREE.HemisphereLight(0xfff4e6, 0xd9bfa8, 0.95));
  const key = new THREE.DirectionalLight(0xffe9cd, 1.45);
  key.position.set(7, 11, 9);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.near = 1;
  key.shadow.camera.far = 40;
  key.shadow.camera.left = -9;
  key.shadow.camera.right = 9;
  key.shadow.camera.top = 9;
  key.shadow.camera.bottom = -9;
  key.shadow.bias = -0.0007;
  key.shadow.normalBias = 0.03;
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xcfe0ea, 0.42);
  rim.position.set(-8, 6, -6);
  scene.add(rim);
  const warm = new THREE.PointLight(0xffd9ae, 6, 12, 2);
  warm.position.set(0, 3.0, 1.2);
  scene.add(warm);
  world.keyLight = key;
  world.warmLight = warm;

  world.renderer = renderer;
  world.scene = scene;
  world.camera = camera;
  world.canvas = canvas;

  world.kitchen = new THREE.Group();
  world.propGroup = new THREE.Group();
  world.prepGroup = new THREE.Group();
  world.ovenGroup = new THREE.Group();
  world.decorGroup = new THREE.Group();
  world.stageGroup = new THREE.Group();
  scene.add(world.kitchen, world.propGroup, world.prepGroup, world.ovenGroup, world.decorGroup, world.stageGroup);

  buildRoom();
  buildIsland();
  buildPrepStation();
  buildOvenStation();
  buildDecorStation();
  buildStage();
  placeChef("honey");
  buildSteam();
  bindPointer();

  setMode("wide");
  resizeWorld();
  window.addEventListener("resize", resizeWorld);
  world.ready = true;
  return world;
}

/* ---------------------------------------------------------------------
   Room
   --------------------------------------------------------------------- */
function buildRoom() {
  const palette = world.palette || KITCHEN;
  // Floor — pale checkered tiles
  const floorTex = checkerTexture(palette.wall);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(22, 18), new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.7 }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, 0, 0.5);
  floor.receiveShadow = true;
  world.kitchen.add(floor);

  // Back wall
  const wallTex = tileTexture(palette.wall, palette.accent);
  const back = new THREE.Mesh(new THREE.PlaneGeometry(22, 4.6), new THREE.MeshStandardMaterial({ map: wallTex, roughness: 0.85 }));
  back.position.set(0, 2.3, -4.4);
  back.receiveShadow = true;
  world.kitchen.add(back);

  // Side wall
  const sideMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(palette.wall), roughness: 0.9 });
  const side = new THREE.Mesh(new THREE.PlaneGeometry(18, 4.6), sideMat);
  side.position.set(-7.6, 2.3, 0.6);
  side.rotation.y = Math.PI / 2;
  side.receiveShadow = true;
  world.kitchen.add(side);

  // Skirting
  box(world.kitchen, 22, 0.22, 0.12, "#f3e7d8", 0, 0.11, -4.33, { r: 0.02 });
  box(world.kitchen, 0.12, 0.22, 18, "#f3e7d8", -7.53, 0.11, 0.6, { r: 0.02 });

  // Window with a bright garden
  const win = group(world.kitchen, -3.9, 2.7, -4.33);
  box(win, 3.1, 2.0, 0.12, "#fdf8f0", 0, 0, 0, { r: 0.05 });
  const skyTex = windowTexture();
  const pane = new THREE.Mesh(new THREE.PlaneGeometry(2.7, 1.65), new THREE.MeshBasicMaterial({ map: skyTex }));
  pane.position.z = 0.075;
  win.add(pane);
  for (const [x, y, w, h] of [[0, 0, 0.06, 1.7], [0, 0, 2.75, 0.06]]) box(win, w, h, 0.06, "#fdf8f0", x, y, 0.1, { r: 0.01 });
  box(win, 3.4, 0.12, 0.42, "#fbf2e6", 0, -1.02, 0.1, { r: 0.02 });

  // Shelves of jars
  for (let s = 0; s < 2; s++) {
    const shelfY = 2.55 + s * 0.66;
    box(world.kitchen, 4.4, 0.09, 0.42, "#e8d3bb", 3.2, shelfY, -4.15, { r: 0.02 });
    const ids = ["flour", "sugar", "cocoa", "vanilla", "honey", "matcha", "lemon", "strawberry"];
    for (let i = 0; i < 7; i++) {
      const id = ids[(i + s * 3) % ids.length];
      const jar = buildIngredient(id, 0.85);
      jar.position.set(1.4 + i * 0.56, shelfY + 0.045, -4.12);
      jar.rotation.y = 0.2;
      world.kitchen.add(jar);
    }
  }
  // Cake stands on the wall shelf
  for (let i = 0; i < 2; i++) {
    const stand = group(world.kitchen, 3.0 + i * 1.7, 3.28, -4.05);
    cyl(stand, 0.05, 0.07, 0.28, "#dcd0be", 0, -0.14, 0, 12, { matOpts: { rough: 0.4 } });
    cyl(stand, 0.26, 0.26, 0.035, "#f4ead9", 0, 0.02, 0, 24);
    if (i === 0) {
      cyl(stand, 0.17, 0.17, 0.13, "#f7dcae", 0, 0.09, 0, 22);
      cyl(stand, 0.175, 0.175, 0.03, "#f3b6c4", 0, 0.16, 0, 22);
    } else {
      cyl(stand, 0.16, 0.16, 0.1, "#5d3a2a", 0, 0.08, 0, 22);
      cyl(stand, 0.165, 0.165, 0.025, "#fdf3e2", 0, 0.14, 0, 22);
      ball(stand, 0.035, "#b8305a", 0.06, 0.17, 0.02, 10);
    }
  }

  // Pendant lamps
  for (let i = 0; i < 3; i++) {
    const x = -3.2 + i * 3.2;
    cyl(world.kitchen, 0.012, 0.012, 1.2, "#c9a879", x, 4.0, -1.2, 6);
    const shade = cone(world.kitchen, 0.36, 0.3, "#f7e3d0", x, 3.28, -1.2, 20, { open: true, rx: Math.PI });
    shade.material = mat("#fdf3e6", { side: THREE.DoubleSide, rough: 0.6 });
    ball(world.kitchen, 0.11, emissive("#fff1d2", 1.8), x, 3.16, -1.2, 12);
    const glow = new THREE.PointLight(0xffe6c0, 2.2, 6, 2);
    glow.position.set(x, 3.0, -1.2);
    world.kitchen.add(glow);
  }

  // Fridge
  const fridge = group(world.kitchen, -6.3, 0, -3.2);
  box(fridge, 1.5, 2.5, 1.1, "#eef1ea", 0, 1.25, 0, { r: 0.08, matOpts: { rough: 0.4, physical: true } });
  box(fridge, 1.42, 1.1, 0.04, "#e3e7de", 0, 1.68, 0.56, { r: 0.02 });
  box(fridge, 1.42, 1.1, 0.04, "#e3e7de", 0, 0.62, 0.56, { r: 0.02 });
  box(fridge, 0.05, 0.5, 0.06, "#c9ccc6", 0.55, 1.68, 0.6, { r: 0.02, matOpts: { metal: 0.6, rough: 0.3 } });
  box(fridge, 0.05, 0.5, 0.06, "#c9ccc6", 0.55, 0.62, 0.6, { r: 0.02, matOpts: { metal: 0.6, rough: 0.3 } });
  // Magnets & a note
  for (let i = 0; i < 4; i++) ball(fridge, 0.04, ["#f3b6c4", "#b9dfcd", "#f5dd8a", "#b9d5e8"][i], -0.4 + i * 0.22, 1.55 + (i % 2) * 0.3, 0.6, 8);
  const note = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.42), new THREE.MeshBasicMaterial({ map: textTexture(["TODAY:", "bake", "something"], { w: 200, h: 240, bg: "#fdf8ee", color: "#a5836b", size: 34 }) }));
  note.position.set(-0.28, 0.9, 0.6);
  note.rotation.z = 0.06;
  fridge.add(note);

  // Plants
  plant(world.kitchen, 6.6, 0, -3.7, 1.1);
  plant(world.kitchen, -7.0, 0, 2.6, 0.8);

  // Chalkboard menu
  const board = group(world.kitchen, 6.4, 2.5, -4.3);
  box(board, 2.0, 1.5, 0.08, "#7d6552", 0, 0, 0, { r: 0.03 });
  box(board, 1.84, 1.34, 0.04, "#3f4a44", 0, 0, 0.05, { r: 0.01 });
  const chalk = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 1.2), new THREE.MeshBasicMaterial({ map: textTexture(["BAKE OFF!", "today's bakes", "· cake", "· cookies", "· macarons"], { w: 340, h: 240, color: "#f6efe0", size: 30, font: "Georgia, serif" }), transparent: true }));
  chalk.position.z = 0.08;
  board.add(chalk);

  // Tiled splashback behind the bench
  const splash = new THREE.Mesh(new THREE.PlaneGeometry(5.2, 1.2), new THREE.MeshStandardMaterial({ map: tileTexture("#fdf4ea", "#f2ddcd"), roughness: 0.4 }));
  splash.position.set(3.4, 1.7, -4.32);
  world.kitchen.add(splash);
}

function checkerTexture(base) {
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const x = c.getContext("2d");
  for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
    x.fillStyle = (i + j) % 2 ? "#f8ece0" : "#f3e0d1";
    x.fillRect(i * 64, j * 64, 64, 64);
  }
  x.fillStyle = "rgba(255,255,255,0.25)";
  x.fillRect(0, 0, 256, 8);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(10, 8);
  tex.anisotropy = 8;
  return tex;
}

function windowTexture() {
  const c = document.createElement("canvas");
  c.width = 256; c.height = 256;
  const x = c.getContext("2d");
  const sky = x.createLinearGradient(0, 0, 0, 256);
  sky.addColorStop(0, "#a9cfe4");
  sky.addColorStop(0.5, "#d9e9ea");
  sky.addColorStop(1, "#f3e5cf");
  x.fillStyle = sky; x.fillRect(0, 0, 256, 256);
  // distant rooftops
  x.fillStyle = "#c9b6a4";
  for (let i = 0; i < 6; i++) {
    const w = 30 + (i % 3) * 14, h = 40 + (i % 4) * 20;
    x.fillRect(i * 46 - 10, 190 - h, w, h + 40);
  }
  x.fillStyle = "#a9c39b";
  x.beginPath(); x.ellipse(60, 210, 60, 34, 0, 0, Math.PI * 2); x.fill();
  x.beginPath(); x.ellipse(200, 216, 70, 38, 0, 0, Math.PI * 2); x.fill();
  // a little tree
  x.fillStyle = "#8fae7f"; x.beginPath(); x.arc(190, 150, 30, 0, Math.PI * 2); x.fill();
  x.fillStyle = "#7a6653"; x.fillRect(186, 168, 8, 34);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function plant(parent, x, y, z, scale = 1) {
  const g = group(parent, x, y, z);
  cyl(g, 0.26 * scale, 0.2 * scale, 0.42 * scale, "#e6cdb6", 0, 0.21 * scale, 0, 18, { matOpts: { rough: 0.8 } });
  cyl(g, 0.28 * scale, 0.28 * scale, 0.06 * scale, "#d5b69c", 0, 0.42 * scale, 0, 18);
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    const leaf = box(g, 0.12 * scale, 0.62 * scale, 0.04 * scale, i % 2 ? "#7fa06d" : "#8fae7f", Math.cos(a) * 0.1 * scale, (0.72 + (i % 3) * 0.08) * scale, Math.sin(a) * 0.1 * scale, { r: 0.02 });
    leaf.rotation.set(0.2, -a, Math.cos(a) * 0.4);
  }
  return g;
}

/* ---------------------------------------------------------------------
   The bench
   --------------------------------------------------------------------- */
function buildIsland() {
  const g = group(world.kitchen, 0, 0, 0.35);
  world.island = g;
  box(g, 5.0, 0.9, 2.2, "#f4e6d4", 0, 0.45, 0, { r: 0.05, matOpts: { rough: 0.7 } });
  // panelled front
  for (let i = 0; i < 4; i++) {
    box(g, 1.06, 0.62, 0.05, "#efdcc6", -1.78 + i * 1.19, 0.44, 1.11, { r: 0.02 });
    ball(g, 0.045, "#cbb08d", -1.78 + i * 1.19, 0.62, 1.15, 8, [1, 1, 0.6]);
  }
  const top = box(g, 5.3, 0.14, 2.45, "#fbf5ea", 0, 0.97, 0, { r: 0.06, matOpts: { rough: 0.25, physical: true, clearcoat: 0.35 } });
  // marble veins
  for (let i = 0; i < 5; i++) {
    const vein = box(g, 2.0, 0.002, 0.012, "#e6dbcd", -1.6 + i * 0.9, 1.041, -0.9 + i * 0.45, { r: 0.001 });
    vein.rotation.y = 0.3 + i * 0.1;
  }
  // tea towel
  const towel = box(g, 0.5, 0.02, 0.36, "#f7d7d9", 1.9, 1.05, 0.55, { r: 0.01, matOpts: { rough: 0.9 } });
  towel.rotation.y = 0.2;
  for (let i = 0; i < 3; i++) box(g, 0.46, 0.021, 0.03, "#efbcc2", 1.9, 1.052, 0.45 + i * 0.1, { r: 0.005 });
  // A mixing spoon and scales
  const scale = group(g, -2.1, 1.04, 0.5);
  box(scale, 0.42, 0.05, 0.34, "#dfe3e6", 0, 0.03, 0, { r: 0.02, matOpts: { metal: 0.4, rough: 0.35 } });
  cyl(scale, 0.13, 0.12, 0.04, "#cfd4d8", -0.06, 0.07, 0, 20);
  const dial = new THREE.Mesh(new THREE.CircleGeometry(0.06, 22), mat("#fdf8ee", { rough: 0.4 }));
  dial.position.set(0.1, 0.062, 0.1);
  dial.rotation.x = -Math.PI / 2;
  scale.add(dial);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    box(scale, 0.006, 0.002, 0.014, "#8f8c85", 0.1 + Math.cos(a) * 0.045, 0.063, 0.1 + Math.sin(a) * 0.045, { r: 0.001 });
  }
  // Rolling pin
  const pin = cyl(g, 0.06, 0.06, 0.7, "#e0c49c", -1.25, 1.09, 0.85, 16, { matOpts: { rough: 0.55 } });
  pin.rotation.z = Math.PI / 2;
  pin.rotation.y = 0.55;
  pin.rotation.y = 0.2;
  for (const s of [-1, 1]) cyl(g, 0.028, 0.028, 0.16, "#d3b288", s * 0.43, 1.09, 1.0, 10, { rz: Math.PI / 2 });
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
}

/* ---------------------------------------------------------------------
   Prep station
   --------------------------------------------------------------------- */
function buildPrepStation() {
  const g = world.prepGroup;
  // Bowl
  const bowl = buildBowl(0.52);
  bowl.position.set(-0.55, 1.05, 0.25);
  g.add(bowl);
  world.bowlMesh = bowl;
  // Batter surface
  const batter = cyl(g, 0.44, 0.4, 0.02, "#f3e2c2", -0.55, 1.12, 0.25, 30, { matOpts: { rough: 0.4, physical: true } });
  batter.scale.setScalar(0.001);
  world.bowl.fill = batter;
  world.bowl.x = -0.55; world.bowl.z = 0.25; world.bowl.y = 1.11;
  // Whisk resting in the bowl
  const whisk = buildWhisk();
  whisk.position.set(-0.28, 1.31, 0.2);
  whisk.rotation.z = -0.5;
  whisk.rotation.x = 0.2;
  g.add(whisk);
  world.whisk = whisk;

  // Stand mixer
  const mixer = group(g, 0.95, 1.05, 0.1);
  world.mixer.root = mixer;
  box(mixer, 0.7, 0.1, 0.52, "#e9e3d8", 0, 0.05, 0, { r: 0.03, matOpts: { rough: 0.5 } });
  cyl(mixer, 0.2, 0.16, 0.3, "#f5f1e8", -0.02, 0.25, 0, 24);
  const headGroup = group(mixer, 0, 0.42, -0.12);
  box(headGroup, 0.42, 0.26, 0.44, "#efe9dd", 0, 0.02, 0.06, { r: 0.1, matOpts: { rough: 0.4, physical: true } });
  const paddle = group(headGroup, 0, -0.1, 0);
  paddle.position.set(0, -0.1, 0.18);
  cyl(paddle, 0.02, 0.02, 0.34, "#c9ccd0", 0, -0.17, 0, 8, { matOpts: { metal: 0.8, rough: 0.25 } });
  const beater = box(paddle, 0.16, 0.1, 0.03, "#d5d8dc", 0, -0.3, 0, { r: 0.01, matOpts: { metal: 0.8, rough: 0.25 } });
  world.mixer.head = headGroup;
  world.mixer.paddle = paddle;
  // bowl under the mixer
  const mbowl = lathe(mixer, [[0, 0.02], [0.13, 0.02], [0.19, 0.06], [0.22, 0.18], [0.21, 0.2], [0.18, 0.19], [0.14, 0.09], [0, 0.06]], "#e5e8e4", 26, { matOpts: { metal: 0.55, rough: 0.28 } });
  mbowl.position.set(0, 0.02, 0.16);
  torus(mixer, 0.21, 0.012, "#cfd3cd", 0, 0.22, 0.16, { rx: Math.PI / 2 });

  // Tray with parchment
  const tray = buildTray(0.72);
  tray.position.set(2.0, 1.05, 0.35);
  g.add(tray);
  world.tray = tray;
  const parchment = cyl(g, 0.62, 0.62, 0.012, "#fbf3e1", 2.0, 1.09, 0.35, 30, { matOpts: { rough: 0.95 } });
  world.parchment = parchment;

  // Ingredient jars on the bench, rebuilt to match the chosen recipe.
  world.prepJars = [];
  setIngredientJars(["flour", "sugar", "butter", "eggs", "milk", "cocoa"]);
  // ribbons of light
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
}

/* ---------------------------------------------------------------------
   Oven station
   --------------------------------------------------------------------- */
function buildOvenStation() {
  const g = world.ovenGroup;
  const oven = group(g, 2.55, 0, -3.1);
  world.oven.root = oven;
  box(oven, 2.0, 1.35, 1.2, "#efe9dd", 0, 0.68, 0, { r: 0.07, matOpts: { rough: 0.42, physical: true } });
  box(oven, 1.94, 0.5, 1.16, "#e7e0d2", 0, 1.45, 0, { r: 0.05 });
  // knobs
  for (let i = 0; i < 4; i++) {
    const knob = cyl(oven, 0.075, 0.075, 0.06, "#c9ccd0", -0.72 + i * 0.48, 1.5, 0.6, 16, { rx: Math.PI / 2, matOpts: { metal: 0.7, rough: 0.25 } });
    knob.rotation.x = Math.PI / 2;
    box(oven, 0.012, 0.06, 0.012, "#8d8f92", -0.72 + i * 0.48, 1.53, 0.64, { r: 0.002 });
  }
  // door with a window
  const door = group(oven, 0, 0.72, 0.61);
  world.oven.door = door;
  box(door, 1.72, 0.94, 0.09, "#dcd6c9", 0, 0, 0, { r: 0.05, matOpts: { rough: 0.35, physical: true } });
  box(door, 1.4, 0.62, 0.03, "#3d3a36", 0, 0.04, 0.055, { r: 0.02 });
  const inner = new THREE.Mesh(new THREE.PlaneGeometry(1.28, 0.52), new THREE.MeshBasicMaterial({ color: new THREE.Color("#2b2723") }));
  inner.position.set(0, 0.04, 0.072);
  door.add(inner);
  world.oven.inner = inner;
  // glass sheen
  const sheen = new THREE.Mesh(new THREE.PlaneGeometry(1.36, 0.58), mat("#cfe0e6", { transparent: true, opacity: 0.14, rough: 0.1, depthWrite: false }));
  sheen.position.set(0, 0.04, 0.076);
  door.add(sheen);
  box(door, 1.8, 0.09, 0.12, "#c8c2b5", 0, 0.53, 0.02, { r: 0.04, matOpts: { metal: 0.3, rough: 0.3 } });
  box(door, 0.9, 0.09, 0.16, "#b9b3a6", 0, 0.58, 0.16, { r: 0.04, matOpts: { metal: 0.5, rough: 0.25 } });
  // oven light
  const light = new THREE.PointLight(0xffb066, 0, 4, 2);
  light.position.set(0, 0.7, -0.2);
  oven.add(light);
  world.oven.light = light;
  // glow plane
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 0.54), new THREE.MeshBasicMaterial({ color: new THREE.Color("#ffb15c"), transparent: true, opacity: 0 }));
  glow.position.set(0, 0.72, 0.73);
  oven.add(glow);
  world.oven.glow = glow;
  // bake tray inside
  const tray = buildTray(0.62);
  tray.position.set(0, 0.56, 0.06);
  tray.visible = false;
  oven.add(tray);
  world.oven.tray = tray;
  world.oven.trayHome = new THREE.Vector3(0, 0.42, 0.05);

  // cooling rack beside the oven
  const rack = group(g, 4.2, 0, -2.5);
  box(rack, 1.1, 0.06, 0.9, "#d7c3a7", 0, 0.9, 0, { r: 0.02 });
  for (let i = 0; i < 10; i++) box(rack, 0.02, 0.05, 0.86, "#c4ad8e", -0.5 + i * 0.11, 0.95, 0, { r: 0.005 });
  for (const [x, z] of [[-0.5, -0.4], [0.5, -0.4], [-0.5, 0.4], [0.5, 0.4]]) cyl(rack, 0.03, 0.035, 0.9, "#b9a184", x, 0.45, z, 8);
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
}

/* ---------------------------------------------------------------------
   Decorating station
   --------------------------------------------------------------------- */
function buildDecorStation() {
  const g = world.decorGroup;
  // turntable
  const turn = group(g, 0, 1.05, 0.3);
  world.turntable = turn;
  cyl(turn, 0.98, 1.02, 0.09, "#f4e6d4", 0, 0.045, 0, 40, { matOpts: { rough: 0.5 } });
  cyl(turn, 0.95, 0.95, 0.02, "#fbf7ef", 0, 0.1, 0, 40, { matOpts: { rough: 0.3, physical: true } });
  torus(turn, 0.97, 0.012, "#e8d5bf", 0, 0.095, 0, { rx: Math.PI / 2 });
  const knob = cyl(turn, 0.05, 0.05, 0.05, "#d9c4ab", 0, 0.09, 0.98, 16);
  knob.rotation.x = Math.PI / 2;
  world.cakeMount = group(turn, 0, 0.12, 0);
  world.cakeMount.rotation.y = 0.35;

  // topping bowls ring on the bench
  world.toppingNodes = [];
  const ids = ["strawberry", "raspberry", "blueberry", "cherry", "chocolate", "macaron", "mint", "lemon", "gold", "star", "marshmallow", "rose"];
  ids.forEach((id, i) => {
    const a = (i / ids.length) * Math.PI * 2;
    const r = 1.55;
    const node = group(g, Math.cos(a) * r, 1.05, 0.3 + Math.sin(a) * r * 0.55);
    const dish = cyl(node, 0.2, 0.16, 0.08, "#f7f0e2", 0, 0.04, 0, 22, { matOpts: { rough: 0.4, physical: true } });
    cyl(node, 0.17, 0.17, 0.01, toppingById(id).color, 0, 0.085, 0, 20);
    for (let k = 0; k < 3; k++) {
      const piece = buildTopping(id, 0.55);
      piece.position.set((Math.random() - 0.5) * 0.16, 0.085, (Math.random() - 0.5) * 0.16);
      node.add(piece);
    }
    node.userData.pick = { type: "topping", id };
    g.add(node);
    world.pickables.push(node);
    world.toppingNodes.push(node);
  });

  // piping bag and palette knife
  const bag = group(g, 1.15, 1.06, -0.5);
  cone(bag, 0.13, 0.34, "#f9f2e4", 0, 0.28, 0, 16, { rx: 0.2 });
  cyl(bag, 0.02, 0.055, 0.1, "#d8dee2", 0, 0.06, 0, 10, { matOpts: { metal: 0.6, rough: 0.3 } });
  ball(bag, 0.12, "#f7dfe4", 0, 0.45, 0, 14);
  const knife = box(g, 0.06, 0.02, 0.4, "#dfe3e7", -1.2, 1.1, -0.35, { r: 0.01, matOpts: { metal: 0.7, rough: 0.2 } });
  knife.rotation.y = 0.4;
  // candles in a little jar
  const candleJar = cyl(g, 0.16, 0.14, 0.26, glass(), 1.55, 1.18, 0.2, 20);
  for (let i = 0; i < 4; i++) {
    const c = buildTopping("candle", 0.6);
    c.position.set(1.5 + (i % 2) * 0.08, 1.1, 0.16 + Math.floor(i / 2) * 0.08);
    g.add(c);
  }
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
}

/* ---------------------------------------------------------------------
   Presentation stage
   --------------------------------------------------------------------- */
function buildStage() {
  const g = world.stageGroup;
  const podium = group(g, 0, 0, 0.35);
  world.podium = podium;
  cyl(podium, 1.5, 1.65, 0.18, "#f2e3d2", 0, 0.09, 0, 44, { matOpts: { rough: 0.6 } });
  cyl(podium, 0.85, 1.0, 0.86, "#f8efe0", 0, 0.6, 0, 44, { matOpts: { rough: 0.4, physical: true } });
  cyl(podium, 1.18, 1.18, 0.1, "#fbf7ee", 0, 1.06, 0, 44, { matOpts: { rough: 0.3, physical: true } });
  torus(podium, 1.05, 0.016, "#e5c168", 0, 1.11, 0, { rx: Math.PI / 2 });
  world.stageMount = group(podium, 0, 1.13, 0);
  // spotlights
  for (const s of [-1, 1]) {
    const stand = group(g, s * 3.1, 0, -1.2);
    cyl(stand, 0.06, 0.09, 2.6, "#cfc9bd", 0, 1.3, 0, 10, { matOpts: { metal: 0.5, rough: 0.35 } });
    const head = cone(stand, 0.26, 0.4, "#3f3a36", 0, 2.68, 0, 16, { open: true });
    head.rotation.set(Math.PI * 0.72, 0, s * -0.3);
    const spot = new THREE.PointLight(0xfff0d0, 5, 10, 2);
    spot.position.set(0, 2.55, 0.4);
    stand.add(spot);
  }
  // curtain backdrop
  const curtain = group(g, 0, 0, -2.4);
  for (let i = 0; i < 12; i++) {
    const panel = box(curtain, 0.62, 4.2, 0.22, i % 2 ? "#f7d9d9" : "#f6e4e4", -3.4 + i * 0.62, 2.1, 0, { r: 0.14, matOpts: { rough: 0.95 } });
    panel.scale.z = 0.9 + (i % 3) * 0.1;
  }
  box(curtain, 8.4, 0.28, 0.5, "#e8c5c5", 0, 4.2, 0, { r: 0.1 });
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
}

/* ---------------------------------------------------------------------
   Chef, steam
   --------------------------------------------------------------------- */
export function placeChef(cos) {
  if (world.chef) world.scene.remove(world.chef);
  world.chef = buildChef(cos, { scale: 1.0 });
  world.chef.position.set(-2.2, 0, -1.1);
  world.chef.rotation.y = 0.4;
  world.scene.add(world.chef);
  world.chefBase = { x: -2.2, z: -1.1 };
}

function buildSteam() {
  const steam = new THREE.Group();
  const sprite = (() => {
    const c = document.createElement("canvas");
    c.width = c.height = 64;
    const x = c.getContext("2d");
    const grad = x.createRadialGradient(32, 32, 1, 32, 32, 30);
    grad.addColorStop(0, "rgba(255,255,255,0.7)");
    grad.addColorStop(1, "rgba(255,255,255,0)");
    x.fillStyle = grad; x.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(c);
  })();
  for (let i = 0; i < 10; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: sprite, transparent: true, opacity: 0.25, depthWrite: false }));
    s.position.set((Math.random() - 0.5) * 0.3, 1.3 + Math.random() * 0.5, (Math.random() - 0.5) * 0.3);
    s.scale.setScalar(0.2 + Math.random() * 0.2);
    s.userData.speed = 0.1 + Math.random() * 0.12;
    steam.add(s);
  }
  steam.position.set(1.05, 0, 0.35);
  world.scene.add(steam);
  world.steam = steam;
}

/* ---------------------------------------------------------------------
   Modes & camera
   --------------------------------------------------------------------- */
export function setMode(mode) {
  world.mode = mode;
  const cfg = world.cameraModes[mode] || world.cameraModes.wide;
  const narrow = window.innerWidth < 900;
  world.cameraWanted.az = cfg.az;
  world.cameraWanted.polar = cfg.polar;
  world.cameraWanted.dist = cfg.dist;
  world.cameraWanted.target.set(cfg.target[0], cfg.target[1], cfg.target[2]);
  if (mode === "decor" && narrow) {
    // On a phone the decorator is a bottom sheet: lift the cake into the
    // strip of canvas above it instead of centring it behind the controls.
    world.cameraWanted.target.y = -0.1;
    world.cameraWanted.dist = 8.0;
  }
  const showPrep = mode === "prep";
  const showDecor = mode === "decor";
  const showStage = mode === "stage";
  world.prepGroup.visible = showPrep;
  world.decorGroup.visible = showDecor;
  world.stageGroup.visible = showStage;
  world.ovenGroup.visible = mode === "oven" || mode === "wide";
  // The chef steps to whichever station is active.
  const spots = {
    wide: { x: -2.2, z: -1.1, ry: 0.4 },
    prep: { x: -1.1, z: -1.0, ry: 0.45 },
    oven: { x: 0.8, z: -2.4, ry: -0.7 },
    decor: { x: -1.9, z: -0.5, ry: 0.7 },
    stage: { x: 2.6, z: -0.4, ry: -0.6 },
    vote: { x: 2.6, z: -0.4, ry: -0.6 }
  };
  world.chefTarget = spots[mode] || spots.wide;
  // Keep the bench, utensils and jars out of the presentation shots: in those
  // views the island sits between the camera and the podium.
  world.prepGroup.visible = mode === "wide" || mode === "prep" || mode === "oven";
  world.decorGroup.visible = mode === "decor";
}

export function setPlacement(id, on) {
  if (world.ghostTopping) {
    world.ghostTopping.parent && world.ghostTopping.parent.remove(world.ghostTopping);
    world.ghostTopping = null;
  }
  world.placement = on ? { id } : null;
  if (on && world.cakeGroup) {
    const ghost = buildTopping(id, 1.1);
    ghost.traverse((o) => { if (o.isMesh) { o.material = o.material.clone(); o.material.transparent = true; o.material.opacity = 0.6; o.castShadow = false; } });
    ghost.visible = false;
    world.cakeGroup.add(ghost);
    world.ghostTopping = ghost;
  }
  world.canvas.style.cursor = on ? "crosshair" : "default";
}

export function setCreation(design, opts = {}) {
  if (world.cakeGroup) {
    world.cakeGroup.parent && world.cakeGroup.parent.remove(world.cakeGroup);
    world.cakeGroup = null;
  }
  if (!design) return null;
  const cake = buildCreation(design, opts);
  world.cakeGroup = cake;
  const mount = opts.stage ? world.stageMount : world.cakeMount;
  if (mount) mount.add(cake);
  world.cakeLocalTopY = cake.userData.topY || 0.4;
  world.cakeTopRadius = cake.userData.topRadius || 0.8;
  world.cakeScale = opts.scale || 1;
  cake.scale.setScalar(opts.scale || 1);
  if (world.placement) setPlacement(world.placement.id, true);
  return cake;
}

export function nudgeCamera(dir) {
  const cfg = world.cameraModes[world.mode] || world.cameraModes.wide;
  world.cameraWanted.az = cfg.az + dir * 0.45;
}
export function resetCamera() { setMode(world.mode); }

export function resizeWorld() {
  if (!world.renderer) return;
  const parent = world.canvas.parentElement;
  const w = parent.clientWidth, h = parent.clientHeight;
  if (!w || !h) return;
  world.renderer.setSize(w, h, false);
  world.camera.aspect = w / h;
  world.camera.fov = w < 820 ? 46 : 36;
  world.camera.updateProjectionMatrix();
}

export function projectToScreen(vec3) {
  if (!world.camera) return { x: 0, y: 0, visible: false };
  const v = vec3.clone().project(world.camera);
  const rect = world.canvas.getBoundingClientRect();
  return { x: (v.x * 0.5 + 0.5) * rect.width, y: (-v.y * 0.5 + 0.5) * rect.height, visible: v.z < 1 && v.z > -1 };
}

export function frame(dt) {
  if (!world.ready) return;
  world.time += dt;
  const c = world.cameraState, want = world.cameraWanted;
  c.az += (want.az - c.az) * Math.min(1, dt * 4);
  c.polar += (want.polar - c.polar) * Math.min(1, dt * 4);
  c.dist += (want.dist - c.dist) * Math.min(1, dt * 4);
  c.target.lerp(want.target, Math.min(1, dt * 4));
  const cp = Math.cos(c.polar), sp = Math.sin(c.polar);
  world.camera.position.set(
    c.target.x + c.dist * cp * Math.sin(c.az),
    c.target.y + c.dist * sp,
    c.target.z + c.dist * cp * Math.cos(c.az)
  );
  world.camera.lookAt(c.target);

  // chef walks to the active station
  if (world.chef && world.chefTarget) {
    const ch = world.chef;
    ch.position.x += (world.chefTarget.x - ch.position.x) * Math.min(1, dt * 2.4);
    ch.position.z += (world.chefTarget.z - ch.position.z) * Math.min(1, dt * 2.4);
    ch.rotation.y += (world.chefTarget.ry - ch.rotation.y) * Math.min(1, dt * 3);
  }
  if (world.chef) {
    let mood = "idle";
    if (world.mixer.on) mood = "mix";
    else if (world.mode === "decor") mood = "decorate";
    else if (world.mode === "stage") mood = "present";
    else if (world.celebrating > 0) mood = "cheer";
    if (world.celebrating > 0) world.celebrating -= dt;
    animateChef(world.chef, dt, world.time, { mood });
  }

  // mixer spin + wobble
  if (world.mixer.head) {
    if (world.mixer.on) {
      world.mixer.angle += dt * 9;
      world.mixer.head.rotation.z = Math.sin(world.time * 24) * 0.018;
      if (world.mixer.paddle) world.mixer.paddle.rotation.y = world.mixer.angle;
      if (world.bowl.fill) world.bowl.fill.rotation.y = world.mixer.angle * 0.2;
    } else {
      world.mixer.head.rotation.z *= 0.9;
    }
  }
  // batter surface breathing
  if (world.bowl.fill && world.bowl.fill.visible) {
    const s = world.bowl.fill.userData.level || 0;
    world.bowl.fill.scale.x = 0.001 + s * 0.98;
    world.bowl.fill.scale.z = 0.001 + s * 0.98;
    world.bowl.fill.position.y = world.bowl.y - 0.33 + s * 0.16 + Math.sin(world.time * 2.4) * 0.002;
  }
  // oven door swing
  if (world.oven.door && world.oven.door.userData.target === undefined) world.oven.door.userData.target = 0;
  if (world.oven.door && world.oven.door.userData.target !== undefined) {
    world.oven.door.rotation.x += (world.oven.door.userData.target - world.oven.door.rotation.x) * Math.min(1, dt * 6);
  }
  // oven glow pulse
  if (world.oven.light && world.oven.baking) {
    world.oven.light.intensity = 1.6 + Math.sin(world.time * 3.4) * 0.5;
    if (world.oven.glow) world.oven.glow.material.opacity = 0.24 + Math.sin(world.time * 3.4) * 0.07;
  } else if (world.oven.light) {
    world.oven.light.intensity = world.oven.done ? 0.9 : 0;
    if (world.oven.glow) world.oven.glow.material.opacity = world.oven.done ? 0.10 : 0;
  }
  // steam
  if (world.steam && world.steam.visible) {
    world.steam.children.forEach((s) => {
      s.position.y += dt * s.userData.speed;
      s.material.opacity = Math.max(0, 0.3 - (s.position.y - 1.3) * 0.35);
      if (s.position.y > 2.1) { s.position.y = 1.3; s.position.x = (Math.random() - 0.5) * 0.3; }
    });
  }
  // turntable & stage spin
  if (world.mode === "decor" && world.cakeMount) world.cakeMount.rotation.y += dt * 0.06;
  if (world.mode === "stage" || world.mode === "vote") {
    if (world.stageMount) world.stageMount.rotation.y += dt * 0.35;
  }
  // glowing CSS-independent sparkles on the stage
  if (world.mode === "stage" && world.cakeGroup) {
    world.cakeGroup.position.y = Math.sin(world.time * 1.4) * 0.012;
  }
  world.renderer.render(world.scene, world.camera);
}

/* ---------------------------------------------------------------------
   Live cake builder for the decorating view
   --------------------------------------------------------------------- */
export function updateCreation(design, opts = {}) {
  if (!world.cakeGroup) return setCreation(design, opts);
  // Rebuilding keeps the model honest about every choice; a cake is only
  // a few dozen meshes, so this stays instant even mid-decoration.
  return setCreation(design, { scale: world.cakeGroup.scale.x || 1.05, stage: opts.stage });
}

/* ---------------------------------------------------------------------
   Pointer
   --------------------------------------------------------------------- */
function bindPointer() {
  const canvas = world.canvas;
  canvas.addEventListener("pointermove", (event) => {
    const rect = canvas.getBoundingClientRect();
    world.pointer.set(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
    world.pointerClient = { x: event.clientX - rect.left, y: event.clientY - rect.top };
    if (world.placement && world.cakeGroup) {
      const hit = cakePoint();
      if (hit) {
        if (world.ghostTopping) {
          world.ghostTopping.visible = true;
          world.ghostTopping.position.set(hit.x, hit.y, hit.z);
        }
        canvas.style.cursor = "crosshair";
      } else if (world.ghostTopping) {
        world.ghostTopping.visible = false;
      }
      return;
    }
    // hover highlight for pickable objects
    const hits = visibleHits();
    const node = hits.length ? findPickable(hits[0].object) : null;
    if (world.hover && world.hover !== node) world.hover.scale.setScalar(world.hover.userData.baseScale || 1);
    world.hover = node;
    if (node) {
      if (!node.userData.baseScale) node.userData.baseScale = node.scale.x;
      node.scale.setScalar(node.userData.baseScale * 1.07);
      canvas.style.cursor = "pointer";
    } else {
      canvas.style.cursor = world.placement ? "crosshair" : "default";
    }
  });

  canvas.addEventListener("pointerdown", (event) => {
    world.pointerDown = { x: event.clientX, y: event.clientY, t: performance.now() };
  });

  canvas.addEventListener("pointerup", (event) => {
    const down = world.pointerDown;
    world.pointerDown = null;
    if (!down) return;
    const moved = Math.hypot(event.clientX - down.x, event.clientY - down.y);
    if (moved > 14) return;
    const rect = canvas.getBoundingClientRect();
    world.pointer.set(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
    if (world.placement && world.cakeGroup) {
      const hit = cakePoint();
      if (hit && world.callbacks.onPlaceTop) {
        const r = world.cakeTopRadius || 0.8;
        world.callbacks.onPlaceTop({ id: world.placement.id, x: hit.x / (r * 0.88), z: hit.z / (r * 0.88) });
      }
      return;
    }
    const hits = visibleHits();
    if (hits.length) {
      const node = findPickable(hits[0].object);
      if (node && world.callbacks.onPick) world.callbacks.onPick(node.userData.pick);
    }
  });

  canvas.addEventListener("pointerleave", () => {
    if (world.ghostTopping) world.ghostTopping.visible = false;
  });
}

function findPickable(object) {
  let node = object;
  while (node && !node.userData.pick) node = node.parent;
  return node && node.userData.pick ? node : null;
}

function chainVisible(object) {
  let node = object;
  while (node) {
    if (node.visible === false) return false;
    node = node.parent;
  }
  return true;
}

function visibleHits() {
  world.raycaster.setFromCamera(world.pointer, world.camera);
  return world.raycaster.intersectObjects(world.pickables, true).filter((hit) => chainVisible(hit.object));
}

const topPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
function cakePoint() {
  if (!world.cakeGroup) return null;
  const topWorld = new THREE.Vector3(0, world.cakeLocalTopY || 0.4, 0);
  world.cakeGroup.localToWorld(topWorld);
  world.raycaster.setFromCamera(world.pointer, world.camera);
  topPlane.constant = -topWorld.y;
  const point = new THREE.Vector3();
  if (!world.raycaster.ray.intersectPlane(topPlane, point)) return null;
  const local = world.cakeGroup.worldToLocal(point.clone());
  const r = world.cakeTopRadius || 0.8;
  const dist = Math.hypot(local.x, local.z);
  if (dist > r * 1.05) return null;
  return { x: local.x, z: local.z, y: world.cakeLocalTopY + 0.012 };
}

/* ---------------------------------------------------------------------
   Station state
   --------------------------------------------------------------------- */
/* The jars on the bench mirror the current recipe, so every ingredient a
   recipe asks for can actually be picked up in 3D. */
export function setIngredientJars(ids) {
  if (world.prepJars) {
    world.prepJars.forEach((jar) => {
      world.prepGroup.remove(jar);
      const index = world.pickables.indexOf(jar);
      if (index >= 0) world.pickables.splice(index, 1);
    });
  }
  world.prepJars = [];
  (ids || []).slice(0, 6).forEach((id, i) => {
    const jar = buildIngredient(id, 0.9);
    jar.position.set(-2.2 + i * 0.86, 1.05, -0.72);
    jar.rotation.y = 0.12;
    jar.userData.pick = { type: "ingredient", id };
    world.prepGroup.add(jar);
    world.pickables.push(jar);
    world.prepJars.push(jar);
  });
}

export function setPickCallback(fn) { world.callbacks.onPick = fn; }
export function setPlaceCallback(fn) { world.callbacks.onPlaceTop = fn; }

export function setBatter(level, color) {
  const fill = world.bowl.fill;
  if (!fill) return;
  const l = Math.max(0, Math.min(1, level));
  fill.userData.level = l;
  fill.visible = l > 0.01;
  if (color) fill.material = mat(color, { rough: 0.35, physical: true });
  fill.scale.setScalar(0.001);
  fill.position.y = world.bowl.y - 0.33 + l * 0.16;
  world.parchmentBatter && (world.parchmentBatter.visible = l > 0.9);
}

export function setMixer(on) { world.mixer.on = !!on; }

export function setOven(open) {
  world.oven.open = open;
  const door = world.oven.door;
  if (door) {
    door.rotation.x += 0;
    door.userData.target = open ? -1.9 : 0;
  }
  if (open && world.oven.glow) world.oven.glow.material.opacity = 0.05;
}

export function loadTrayIntoOven(on) {
  const tray = world.oven.tray;
  if (!tray) return;
  tray.visible = !!on;
}

export function setOvenBaking(on) {
  world.oven.baking = !!on;
  world.oven.done = false;
  world.oven.tray && (world.oven.tray.visible = !!on);
  if (on) {
    world.oven.door && (world.oven.door.userData.target = 0);
    world.oven.open = false;
  }
}

export function setOvenDone(done) {
  world.oven.baking = false;
  world.oven.done = !!done;
}

export function celebrate() { world.celebrating = 2.4; }

export function toastCamera() { world.cameraWanted.polar = 0.84; }

/* ---------------------------------------------------------------------
   Portraits — small square renders for cards, voting and shops
   --------------------------------------------------------------------- */
let portrait = null;
export function makePortrait(buildFn, opts = {}) {
  try {
    if (!portrait) {
      const canvas = document.createElement("canvas");
      const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
      renderer.setPixelRatio(1);
      renderer.setClearColor(0x000000, 0);
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.0;
      renderer.shadowMap.enabled = true;
      const scene = new THREE.Scene();
      scene.add(new THREE.HemisphereLight(0xfff4e6, 0xd9bfa8, 1.15));
      const key = new THREE.DirectionalLight(0xffe9d0, 1.65);
      key.position.set(3, 6, 4.5);
      key.castShadow = true;
      key.shadow.mapSize.set(512, 512);
      scene.add(key);
      const rim = new THREE.DirectionalLight(0xcfe0ea, 1.0);
      rim.position.set(-4, 2.5, -3.5);
      scene.add(rim);
      const camera = new THREE.PerspectiveCamera(30, 1, 0.01, 80);
      portrait = { renderer, scene, camera, holder: new THREE.Group() };
      scene.add(portrait.holder);
    }
    const size = opts.size || 320;
    portrait.renderer.setSize(size, size);
    portrait.camera.aspect = 1;
    portrait.holder.clear();
    const model = buildFn();
    const frame = new THREE.Group();
    frame.add(model);
    portrait.holder.add(frame);
    const bbox = new THREE.Box3().setFromObject(frame);
    const sphere = bbox.getBoundingSphere(new THREE.Sphere());
    const scale = (opts.zoom || 1.6) / Math.max(0.001, sphere.radius);
    frame.scale.setScalar(scale);
    const center = sphere.center.clone().multiplyScalar(scale);
    frame.position.sub(center);
    frame.position.y += opts.lift || 0;
    const fitDist = (opts.zoom || 1.6) * 1.2 / Math.sin(THREE.MathUtils.degToRad(portrait.camera.fov / 2));
    portrait.camera.position.set(fitDist * (opts.yaw || 0.12), fitDist * 0.16, fitDist);
    portrait.camera.lookAt(0, 0, 0);
    portrait.camera.updateProjectionMatrix();
    portrait.renderer.render(portrait.scene, portrait.camera);
    return portrait.renderer.domElement.toDataURL("image/png");
  } catch (error) {
    console.warn("Bake Off: portrait failed", error);
    return "";
  }
}

export function creationPortrait(design, size = 320) {
  if (!design) return "";
  return makePortrait(() => {
    const g = buildCreation(design);
    g.rotation.y = 0.4;
    return g;
  }, { size, zoom: 1.42, yaw: 0.1 });
}

export function chefPortrait(cos, size = 260) {
  return makePortrait(() => {
    const g = buildChef(cos);
    return g;
  }, { size, zoom: 1.3, yaw: 0.05, lift: -0.05 });
}

export function ingredientPortrait(id, size = 180) {
  return makePortrait(() => buildIngredient(id), { size, zoom: 1.5 });
}
export function toppingPortrait(id, size = 160) {
  return makePortrait(() => buildTopping(id), { size, zoom: 1.7 });
}
export function platePortrait(id, size = 220) {
  return makePortrait(() => {
    const g = new THREE.Group();
    g.add(buildPlate(id, 1.1));
    const cake = buildCreation({ recipeId: "birthday-vanilla", frosting: "blush", plate: id, shape: "round", toppings: ["strawberry"], layers: 3 });
    cake.position.y = 0.02;
    g.add(cake);
    return g;
  }, { size, zoom: 1.35 });
}
