/* =====================================================================
   LITTLE TOWN — catalogue previews
   Renders each real 3D model to a small warm thumbnail, once, so the
   build shop shows the same buildings the player gets in the world.
   ===================================================================== */
import * as THREE from "three";
import { buildObject, buildRoadTile } from "./models.js";
import { DEF_BY_ID, ROAD_BY_ID } from "./data.js";

const cache = new Map();
let rig = null;
let failed = false;

function setup() {
  if (rig || failed) return rig;
  try {
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true, powerPreference: "low-power" });
    renderer.setPixelRatio(1);
    renderer.setSize(240, 168, false);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;
    const scene = new THREE.Scene();
    scene.add(new THREE.AmbientLight(0xfff2dc, 1.9));
    const key = new THREE.DirectionalLight(0xfff0cd, 2.5);
    key.position.set(6, 12, 8);
    scene.add(key);
    const fill = new THREE.DirectionalLight(0xdfe9ff, 0.9);
    fill.position.set(-8, 6, -6);
    scene.add(fill);
    const camera = new THREE.OrthographicCamera(-2, 2, 1.4, -1.4, 0.1, 120);
    rig = { renderer, scene, camera };
    return rig;
  } catch (error) {
    failed = true;
    console.warn("Little Town: previews unavailable", error);
    return null;
  }
}

function frameObject(object, aspect = 240 / 168, padding = 1.55) {
  object.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(object);
  if (box.isEmpty()) return null;
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const span = Math.max(size.x, size.y, size.z);
  const height = Math.max(size.y * 1.25, span * 0.95) * padding;
  const width = Math.max(height * aspect, span * padding);
  const camera = rig.camera;
  camera.left = -width / 2;
  camera.right = width / 2;
  camera.top = height / 2;
  camera.bottom = -height / 2;
  camera.near = 0.1;
  camera.far = height * 8 + 60;
  const dir = new THREE.Vector3(1, 1.05, 1).normalize();
  camera.position.copy(center).addScaledVector(dir, height * 3.2 + 14);
  camera.lookAt(center);
  camera.updateProjectionMatrix();
  return center;
}

function renderThumb(object, ground = false) {
  const r = setup();
  if (!r) return "";
  try {
    r.scene.add(object);
    if (ground) {
      const plate = new THREE.Mesh(
        new THREE.CircleGeometry(1.72, 40),
        new THREE.MeshStandardMaterial({ color: "#d6dcb2", roughness: 1 })
      );
      plate.rotation.x = -Math.PI / 2;
      plate.position.y = 0.012;
      plate.receiveShadow = true;
      r.scene.add(object.userData.plate = plate);
    }
    const center = frameObject(object);
    if (!center) return "";
    r.renderer.render(r.scene, r.camera);
    const url = r.renderer.domElement.toDataURL("image/png");
    r.scene.remove(object);
    if (object.userData.plate) { r.scene.remove(object.userData.plate); object.userData.plate.geometry.dispose(); }
    object.traverse((node) => { if (node.isMesh && node.geometry) node.geometry.dispose(); });
    return url;
  } catch (error) {
    try { r.scene.remove(object); } catch (e) { /* ignore */ }
    return "";
  }
}

export function cachedThumb(defId) { return cache.get(defId) || ""; }
export function cachedRoadThumb(roadId) { return cache.get("road:" + roadId) || ""; }

export function thumb(defId) {
  if (cache.has(defId)) return cache.get(defId);
  const def = DEF_BY_ID[defId];
  if (!def) return "";
  const object = buildObject(def, { level: 1, variant: 0, season: "spring" });
  object.updateMatrixWorld(true);
  const src = renderThumb(object);
  cache.set(defId, src);
  return src;
}

export function roadThumb(roadId) {
  const key = "road:" + roadId;
  if (cache.has(key)) return cache.get(key);
  const def = ROAD_BY_ID[roadId];
  if (!def) return "";
  const r = setup();
  if (!r) return "";
  try {
    const group = new THREE.Group();
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(3.46, 3.46, 1, 1),
      new THREE.MeshStandardMaterial({ color: "#a9bf80", roughness: 1 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = 0.005;
    group.add(ground);
    const mask = def.kind === "bridge" ? 5 : def.kind === "plaza" ? 0 : 15;
    const tile = buildRoadTile(def.kind, mask);
    if (def.kind === "bridge") {
      group.add(tile);
    } else {
      tile.position.y = -0.09;
      group.add(tile);
    }
    r.scene.add(group);
    group.updateMatrixWorld(true);
    const camera = r.camera;
    const width = 6.8;
    const height = width * (168 / 240);
    camera.left = -width / 2; camera.right = width / 2;
    camera.top = height / 2; camera.bottom = -height / 2;
    camera.near = 0.1; camera.far = 80;
    camera.position.set(6.4, 7.4, 7.4);
    camera.lookAt(0, 0.2, 0);
    camera.updateProjectionMatrix();
    r.renderer.render(r.scene, r.camera);
    const url = r.renderer.domElement.toDataURL("image/png");
    r.scene.remove(group);
    group.traverse((node) => { if (node.isMesh && node.geometry) node.geometry.dispose(); });
    cache.set(key, url);
    return url;
  } catch (error) {
    return "";
  }
}

export function warmThumbnails(ids) {
  for (const id of ids) { try { thumb(id); } catch (error) { /* ignore */ } }
}
