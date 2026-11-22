/* =====================================================================
   DREAM PARK — catalogue previews
   Every shop card shows the actual 3D model the player gets. The renders
   are made once, at card size, and cached so opening a catalogue stays
   smooth even with all thirty attractions.
   ===================================================================== */
import * as THREE from "three";
import {
  buildRide, buildBuilding, mat,
  buildTree, buildFlowers, buildFlowerbed, buildHedge, buildTopiary,
  buildBench, buildBin, buildLamp, buildFountain, buildStatue, buildFlag,
  buildArch, buildBalloonArch, buildPond, buildBridge
} from "./models.js";
import { RIDE_BY_ID, BUILDING_BY_ID, DECOR_BY_ID } from "./data.js";

const cache = new Map();
const queue = [];
const queued = new Set();
let rig = null;
let failed = false;
let pumping = false;

function setup() {
  if (rig || failed) return rig;
  try {
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true, powerPreference: "low-power" });
    renderer.setPixelRatio(1);
    renderer.setSize(390, 150, false);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    const scene = new THREE.Scene();
    scene.add(new THREE.HemisphereLight(0xfff4e2, 0x75919c, 1.75));
    const key = new THREE.DirectionalLight(0xfff1d6, 2.35);
    key.position.set(5, 10, 7);
    key.castShadow = true;
    key.shadow.mapSize.set(512, 512);
    key.shadow.camera.left = -6;
    key.shadow.camera.right = 6;
    key.shadow.camera.top = 6;
    key.shadow.camera.bottom = -6;
    scene.add(key);
    const fill = new THREE.DirectionalLight(0xbfe3f0, 0.85);
    fill.position.set(-7, 4, -5);
    scene.add(fill);
    const camera = new THREE.OrthographicCamera(-1, 1, 0.6, -0.6, 0.1, 120);
    rig = { renderer, scene, camera, holder: new THREE.Group() };
    scene.add(rig.holder);
    return rig;
  } catch (error) {
    failed = true;
    console.warn("Dream Park: catalogue previews unavailable", error);
    return null;
  }
}

function pathModel(id) {
  const g = new THREE.Group();
  g.userData.flat = true;
  const p = id === "plaza" ? 4.4 : 3.6;
  const grass = new THREE.Mesh(new THREE.BoxGeometry(p + 0.5, 0.12, p + 0.5), mat("#a8c58b"));
  grass.position.y = 0.02;
  g.add(grass);
  const pave = new THREE.Mesh(new THREE.BoxGeometry(p, 0.11, p), mat(id === "queue" ? "#d8c7ad" : "#ebdbc2"));
  pave.position.y = 0.12;
  g.add(pave);
  if (id === "plaza") {
    for (let i = -1; i <= 1; i++) {
      const line = new THREE.Mesh(new THREE.BoxGeometry(p * 0.92, 0.015, 0.045), mat("#cbb79b"));
      line.position.set(0, 0.185, i * p * 0.24);
      g.add(line);
    }
  } else if (id === "path") {
    for (let i = 0; i < 3; i++) {
      const seam = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.015, p * 0.9), mat("#cdbb9f"));
      seam.position.set(-p * 0.24 + i * p * 0.24, 0.185, 0);
      g.add(seam);
    }
  } else {
    for (const x of [-p * 0.3, p * 0.3]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.07, 0.85, 8), mat("#f1e5d1"));
      post.position.set(x, 0.55, 0);
      g.add(post);
    }
    const rope = new THREE.Mesh(new THREE.TorusGeometry(p * 0.3, 0.03, 5, 18, Math.PI), mat("#c8785d"));
    rope.position.y = 0.62;
    rope.rotation.z = Math.PI;
    g.add(rope);
  }
  return g;
}

function decorPreview(def) {
  switch (def.model) {
    case "oak": return buildTree("oak", 1);
    case "pine": return buildTree("pine", 1);
    case "palm": return buildTree("palm", 1);
    case "blossom": return buildTree("blossom", 1);
    case "flowers": return buildFlowers();
    case "flowerbed": return buildFlowerbed();
    case "hedge": return buildHedge();
    case "topiary": return buildTopiary();
    case "bench": return buildBench();
    case "bin": return buildBin();
    case "lamp": return buildLamp();
    case "fountain": return buildFountain(1);
    case "statue": return buildStatue();
    case "flag": return buildFlag();
    case "arch": return buildArch();
    case "balloonarch": return buildBalloonArch();
    case "pond": return buildPond();
    case "bridge": return buildBridge();
    case "fence": {
      const g = new THREE.Group();
      for (const x of [-1.6, 1.6]) {
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 1.2, 6), mat("#f4e3cf"));
        post.position.set(x, 0.6, 0);
        g.add(post);
      }
      const rail = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.12, 0.1), mat("#f4e3cf"));
      rail.position.y = 0.9;
      g.add(rail);
      return g;
    }
    default: {
      const g = new THREE.Group();
      const box = new THREE.Mesh(new THREE.BoxGeometry(3, 2, 3), mat("#c9b28a"));
      box.position.y = 1;
      g.add(box);
      return g;
    }
  }
}

function buildPreview(id) {
  if (id.startsWith("path:")) return pathModel(id.slice(5));
  if (RIDE_BY_ID[id]) return buildRide(RIDE_BY_ID[id]).group;
  if (BUILDING_BY_ID[id]) return buildBuilding(BUILDING_BY_ID[id]);
  if (DECOR_BY_ID[id]) return decorPreview(DECOR_BY_ID[id]);
  return null;
}

function frameObject(object) {
  const r = rig;
  object.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(object);
  if (!Number.isFinite(box.min.x) || box.isEmpty()) return false;
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  object.position.sub(center);
  const max = Math.max(size.x, size.y, size.z, 1);
  const scale = 5.2 / max;
  object.scale.multiplyScalar(scale);
  object.position.set(-center.x * scale, -center.y * scale, -center.z * scale);
  const halfHeight = (size.y * scale) / 2;

  const platform = new THREE.Mesh(
    new THREE.CylinderGeometry(Math.max(size.x, size.z) * scale * 0.56, Math.max(size.x, size.z) * scale * 0.6, 0.08, 40),
    mat("#efe0ca")
  );
  platform.position.y = -halfHeight - 0.04;
  platform.receiveShadow = true;
  r.holder.add(platform);

  const camera = r.camera;
  const aspect = 390 / 150;
  const halfWidth = (Math.max(size.x, size.z) * scale) / 2;
  // The camera looks down at an angle, so the far edge of a wide ride projects
  // above its bounding-box height. Flat paving needs extra side room too.
  const flat = !!object.userData.flat;
  const widthTerm = (halfWidth / aspect) * (flat ? 1.55 : 1);
  const viewY = Math.max(halfHeight + halfWidth * (flat ? 0.45 : 0.34), widthTerm) * 1.13 + 0.16;
  const viewX = viewY * aspect;
  camera.left = -viewX;
  camera.right = viewX;
  camera.top = viewY;
  camera.bottom = -viewY;
  camera.near = 0.1;
  camera.far = 120;
  camera.position.set(max * 0.72, max * 0.72, max * 1.25);
  camera.lookAt(0, 0, 0);
  camera.updateProjectionMatrix();
  return true;
}

function renderThumb(id) {
  if (cache.has(id)) return cache.get(id);
  const r = setup();
  if (!r) return "";
  try {
    const object = buildPreview(id);
    if (!object) return "";
    r.holder.clear();
    r.holder.add(object);
    if (!frameObject(object)) return "";
    r.renderer.render(r.scene, r.camera);
    const src = r.renderer.domElement.toDataURL("image/png");
    cache.set(id, src);
    return src;
  } catch (error) {
    console.warn("Dream Park: preview failed for " + id, error);
    return "";
  } finally {
    // Rounded-box geometry is shared between every model in the park, so the
    // preview must let the cache own it instead of disposing it here.
    r.holder.clear();
  }
}

function applyThumb(img, src) {
  if (!img || !img.isConnected) return;
  if (!src) return;
  img.src = src;
  img.dataset.ready = "1";
}

function pump() {
  if (pumping || !queue.length) return;
  pumping = true;
  const run = () => {
    const batch = queue.splice(0, 2);
    for (const id of batch) {
      queued.delete(id);
      if (cache.has(id)) continue;
      renderThumb(id);
    }
    document.querySelectorAll("img[data-thumb]").forEach((img) => {
      if (cache.has(img.dataset.thumb)) applyThumb(img, cache.get(img.dataset.thumb));
    });
    if (queue.length) requestAnimationFrame(run);
    else pumping = false;
  };
  requestAnimationFrame(run);
}

export function mountThumbs(root) {
  if (!root) return;
  root.querySelectorAll("img[data-thumb]").forEach((img) => {
    const id = img.dataset.thumb;
    if (!id) return;
    if (cache.has(id)) { applyThumb(img, cache.get(id)); return; }
    if (!queued.has(id)) { queued.add(id); queue.push(id); }
  });
  pump();
}

export function thumbFor(id) {
  if (cache.has(id)) return cache.get(id);
  return renderThumb(id);
}
