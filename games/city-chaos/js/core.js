// ---------------------------------------------------------------------------
// Renderer, atmosphere and small shared helpers.
// ---------------------------------------------------------------------------
import * as THREE from 'three';

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const damp = (current, target, lambda, dt) => THREE.MathUtils.damp(current, target, lambda, dt);

// Small deterministic RNG so a rebuilt city can either repeat or surprise.
export function rng(seed) {
  let s = seed >>> 0;
  return function random() {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const materialCache = new Map();
export function mat(color, opts = {}) {
  const key = `${color}|${opts.flat ? 1 : 0}|${opts.emissive || 0}|${opts.opacity ?? 1}|${opts.roughness ?? ''}|${opts.metal ?? 0}`;
  let found = materialCache.get(key);
  if (found) return found;
  const useStandard = opts.metal !== undefined || opts.roughness !== undefined;
  const Ctor = useStandard ? THREE.MeshStandardMaterial : THREE.MeshLambertMaterial;
  found = new Ctor({
    color,
    flatShading: opts.flat !== false,
    emissive: opts.emissive || 0x000000,
    emissiveIntensity: opts.emissiveIntensity ?? 1,
    transparent: (opts.opacity ?? 1) < 1,
    opacity: opts.opacity ?? 1,
    roughness: opts.roughness ?? 0.85,
    metalness: opts.metal ?? 0,
  });
  materialCache.set(key, found);
  return found;
}

export function box(w, h, d, color, opts = {}) {
  const geometry = new THREE.BoxGeometry(w, h, d);
  const mesh = new THREE.Mesh(geometry, mat(color, opts));
  mesh.castShadow = opts.shadow !== false;
  mesh.receiveShadow = true;
  return mesh;
}

export function cylinder(rTop, rBottom, h, color, segments = 10, opts = {}) {
  const geometry = new THREE.CylinderGeometry(rTop, rBottom, h, segments);
  const mesh = new THREE.Mesh(geometry, mat(color, opts));
  mesh.castShadow = opts.shadow !== false;
  mesh.receiveShadow = true;
  return mesh;
}

const THREE_NS = THREE;

export function createRenderer(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance', stencil: false });
  renderer.setClearColor(0x9fb8c4, 1);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  return renderer;
}

// ---------------------------------------------------------------------------
// Sky dome: a vertical gradient with a sun glow and a night star field.
// ---------------------------------------------------------------------------
const skyVertex = `
varying vec3 vWorld;
void main() {
  vec4 world = modelMatrix * vec4(position, 1.0);
  vWorld = world.xyz;
  gl_Position = projectionMatrix * viewMatrix * world;
}`;
const skyFragment = `
uniform vec3 topColor;
uniform vec3 bottomColor;
uniform vec3 sunColor;
uniform vec3 sunDir;
uniform float night;
varying vec3 vWorld;
void main() {
  vec3 dir = normalize(vWorld);
  float h = clamp(dir.y * 0.5 + 0.5, 0.0, 1.0);
  vec3 col = mix(bottomColor, topColor, pow(h, 0.85));
  float glow = pow(max(dot(dir, normalize(sunDir)), 0.0), 180.0);
  float halo = pow(max(dot(dir, normalize(sunDir)), 0.0), 8.0) * 0.22;
  col += sunColor * (glow * 2.2 + halo);
  col = mix(col, col * 1.04, night);
  gl_FragColor = vec4(col, 1.0);
}`;

export function createAtmosphere(scene) {
  const skyUniforms = {
    topColor: { value: new THREE.Color(0x3f7fc4) },
    bottomColor: { value: new THREE.Color(0xc8dbe4) },
    sunColor: { value: new THREE.Color(0xfff3d6) },
    sunDir: { value: new THREE.Vector3(0.7, 0.9, 0.3) },
    night: { value: 0 },
  };
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(900, 24, 16),
    new THREE.ShaderMaterial({ uniforms: skyUniforms, vertexShader: skyVertex, fragmentShader: skyFragment, side: THREE.BackSide, depthWrite: false, fog: false })
  );
  sky.frustumCulled = false;
  scene.add(sky);

  // Stars only show at night; cheap points with no lighting.
  const starCount = 900;
  const starPositions = new Float32Array(starCount * 3);
  for (let i = 0; i < starCount; i++) {
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(Math.random() * 0.9 + 0.05);
    const r = 800;
    starPositions[i * 3] = Math.sin(phi) * Math.cos(theta) * r;
    starPositions[i * 3 + 1] = Math.cos(phi) * r * 0.9 + 60;
    starPositions[i * 3 + 2] = Math.sin(phi) * Math.sin(theta) * r;
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
  const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xdfe9ff, size: 2.2, sizeAttenuation: false, transparent: true, opacity: 0, fog: false, depthWrite: false }));
  stars.frustumCulled = false;
  scene.add(stars);

  // Clouds: clusters of flattened blobs that drift and wrap around the city.
  const cloudGroup = new THREE.Group();
  const cloudMat = new THREE.MeshLambertMaterial({ color: 0xf0f5f7, transparent: true, opacity: 0.92, flatShading: true, fog: false });
  for (let c = 0; c < 20; c++) {
    const cluster = new THREE.Group();
    const puffs = 3 + Math.floor(Math.random() * 4);
    for (let p = 0; p < puffs; p++) {
      const radius = 9 + Math.random() * 7;
      const puff = new THREE.Mesh(new THREE.IcosahedronGeometry(radius, 0), cloudMat);
      puff.position.set((Math.random() - 0.5) * 34, (Math.random() - 0.5) * 4, (Math.random() - 0.5) * 24);
      puff.scale.set(1, 0.44, 0.78);
      cluster.add(puff);
    }
    cluster.position.set((Math.random() - 0.5) * 900, 135 + Math.random() * 55, (Math.random() - 0.5) * 900);
    cluster.userData.drift = 1.2 + Math.random() * 1.8;
    cloudGroup.add(cluster);
  }
  scene.add(cloudGroup);

  return { sky, skyUniforms, stars, cloudGroup, cloudMat };
}

export function createLights(scene) {
  const hemi = new THREE.HemisphereLight(0xd9e6ec, 0x4a5a52, 0.85);
  scene.add(hemi);

  const ambient = new THREE.AmbientLight(0x9fb6c2, 0.55);
  scene.add(ambient);

  const sun = new THREE.DirectionalLight(0xfff3d6, 2.4);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 320;
  sun.shadow.camera.left = -80;
  sun.shadow.camera.right = 80;
  sun.shadow.camera.top = 80;
  sun.shadow.camera.bottom = -80;
  sun.shadow.bias = -0.0011;
  sun.shadow.normalBias = 0.055;
  scene.add(sun);
  scene.add(sun.target);

  return { hemi, ambient, sun };
}

// A point light pool for explosions and headlights. Real lights are expensive,
// so there are only a handful and they are lent out.
export function createLightPool(scene, count = 4) {
  const lights = [];
  for (let i = 0; i < count; i++) {
    const light = new THREE.PointLight(0xffb060, 0, 26, 2);
    light.visible = false;
    scene.add(light);
    lights.push({ light, until: 0, peak: 0 });
  }
  return {
    flash(position, color = 0xffb060, intensity = 30, time = 0.28) {
      let slot = lights.find((entry) => !entry.light.visible) || lights[0];
      const { light } = slot;
      light.position.copy(position);
      light.color.set(color);
      light.intensity = intensity;
      light.distance = 26 + intensity * 0.6;
      light.visible = true;
      slot.until = performance.now() / 1000 + time;
      slot.peak = intensity;
    },
    update() {
      const now = performance.now() / 1000;
      for (const slot of lights) {
        if (!slot.light.visible) continue;
        const left = slot.until - now;
        if (left <= 0) {
          slot.light.visible = false;
          slot.light.intensity = 0;
        } else {
          slot.light.intensity = slot.peak * clamp(left * 4, 0, 1);
        }
      }
    },
  };
}

// ---------------------------------------------------------------------------
// Day / night. Targets are eased so switching is a sunset, not a switch.
// ---------------------------------------------------------------------------
export function createDaylight({ scene, renderer, atmosphere, lights, presets }) {
  const state = {
    mode: 'day',
    night: 0,
    sunDir: new THREE.Vector3(0.7, 0.9, 0.3).normalize(),
    target: null,
    sunIntensity: 2.4,
    lamps: 0,
  };

  const current = {
    top: new THREE.Color(presets.day.skyTop),
    bottom: new THREE.Color(presets.day.skyBottom),
    sun: new THREE.Color(presets.day.sunColor),
    fog: new THREE.Color(presets.day.fog),
    ambient: new THREE.Color(presets.day.ambient),
    dir: new THREE.Vector3(...presets.day.sun).normalize(),
    intensity: presets.day.sunIntensity,
    hemi: presets.day.hemi,
    ambientIntensity: presets.day.ambientIntensity,
    night: 0,
  };

  function setMode(mode) {
    if (!presets[mode]) return;
    state.mode = mode;
    state.target = presets[mode];
  }
  setMode('day');

  function update(dt) {
    const target = state.target;
    if (!target) return;
    const k = 1 - Math.exp(-2.2 * dt);
    current.top.lerp(new THREE.Color(target.skyTop), k);
    current.bottom.lerp(new THREE.Color(target.skyBottom), k);
    current.sun.lerp(new THREE.Color(target.sunColor), k);
    current.fog.lerp(new THREE.Color(target.fog), k);
    current.ambient.lerp(new THREE.Color(target.ambient), k);
    const dir = new THREE.Vector3(...target.sun).normalize();
    current.dir.lerp(dir, k).normalize();
    current.intensity += (target.sunIntensity - current.intensity) * k;
    current.hemi += (target.hemi - current.hemi) * k;
    current.ambientIntensity += (target.ambientIntensity - current.ambientIntensity) * k;
    current.night += (target.night - current.night) * k;

    atmosphere.skyUniforms.topColor.value.copy(current.top);
    atmosphere.skyUniforms.bottomColor.value.copy(current.bottom);
    atmosphere.skyUniforms.sunColor.value.copy(current.sun);
    atmosphere.skyUniforms.sunDir.value.copy(current.dir);
    atmosphere.skyUniforms.night.value = current.night;
    atmosphere.stars.material.opacity = current.night * 0.9;
    atmosphere.cloudMat.color.setHex(0xf0f5f7).lerp(new THREE.Color(0x44536b), current.night * 0.85);
    atmosphere.cloudMat.opacity = 0.92 - current.night * 0.35;

    lights.sun.color.copy(current.sun);
    lights.sun.intensity = current.intensity;
    lights.sun.position.copy(current.dir).multiplyScalar(120);
    lights.hemi.intensity = current.hemi;
    lights.hemi.color.copy(current.bottom);
    lights.ambient.color.copy(current.ambient);
    lights.ambient.intensity = current.ambientIntensity;

    scene.fog.color.copy(current.fog);
    renderer.setClearColor(current.fog, 1);
    state.night = current.night;
    state.sunDir.copy(current.dir);
  }

  return { state, setMode, update };
}

export function makeCanvasTexture(size, draw) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  draw(ctx, size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

export { THREE_NS };
