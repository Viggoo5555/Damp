/* =====================================================================
   DREAM PARK — rollercoaster design and physics

   A coaster is a plan: a station, then a list of pieces (straight, left,
   right, hill, drop, brake). The plan is turned into a closed 3D spline.
   A lap is simulated with real energy exchange (v² = v₀² − 2gΔh) plus
   friction, a chain lift on the first climb, and a stall check — the
   numbers the designer sees are the numbers the ride runs at.
   ===================================================================== */
import * as THREE from "three";

export const CELL = 4;          // world units per plan cell
export const HEIGHT_UNIT = 2.2; // world units per height step
const G = 9.81;
const LIFT_FRACTION = 0.32;     // the chain lift may only help early on

export const PIECES = [
  { id: "straight", label: "Straight", icon: "→", desc: "One cell of level track." },
  { id: "left", label: "Left turn", icon: "↰", desc: "Turns a quarter to the left." },
  { id: "right", label: "Right turn", icon: "↱", desc: "Turns a quarter to the right." },
  { id: "hill", label: "Hill", icon: "⌃", desc: "Climbs one step." },
  { id: "drop", label: "Drop", icon: "⌄", desc: "Falls one step — this is where speed comes from." },
  { id: "brake", label: "Brake run", icon: "▬", desc: "Level track, scrubs a little speed." }
];

export const PLAN_DEFAULT = {
  stationY: 2,
  pieces: ["hill", "straight", "right", "straight", "right", "straight", "right", "drop"]
};

const DIRS = [[1, 0], [0, 1], [-1, 0], [0, -1]];

export function planNodes(plan) {
  const pieces = plan.pieces || [];
  let x = 0, z = 0, dir = 0;
  let y = plan.stationY === undefined ? 2 : plan.stationY;
  const nodes = [{ x, z, y, dir, type: "station" }];
  pieces.forEach((type) => {
    if (type === "left") dir = (dir + 3) % 4;
    else if (type === "right") dir = (dir + 1) % 4;
    x += DIRS[dir][0];
    z += DIRS[dir][1];
    if (type === "hill") y += 1;
    if (type === "drop") y = Math.max(0.6, y - 1);
    nodes.push({ x, z, y, dir, type });
  });
  return nodes;
}

export function planClosed(plan) {
  const nodes = planNodes(plan);
  const last = nodes[nodes.length - 1];
  const first = nodes[0];
  return nodes.length > 3 && Math.hypot(last.x - first.x, last.z - first.z) <= 1.01 && Math.abs(last.y - first.y) <= 1.01;
}

/** An ordered, closed list of points for the track. */
export function planPoints(plan) {
  const nodes = planNodes(plan);
  const first = nodes[0];
  const pts = nodes.map((n) => ({ x: n.x, z: n.z, y: n.y }));
  if (planClosed(plan)) pts.push({ ...first });
  // centre the layout on the origin
  const minX = Math.min(...pts.map((p) => p.x)), maxX = Math.max(...pts.map((p) => p.x));
  const minZ = Math.min(...pts.map((p) => p.z)), maxZ = Math.max(...pts.map((p) => p.z));
  const cx = (minX + maxX) / 2, cz = (minZ + maxZ) / 2;
  return pts.map((p) => new THREE.Vector3((p.x - cx) * CELL, p.y * HEIGHT_UNIT, (p.z - cz) * CELL));
}

export function planCurve(plan, samples = 220) {
  const pts = planPoints(plan);
  const curve = new THREE.CatmullRomCurve3(pts, planClosed(plan), "centripetal", 0.5);
  return { curve, points: curve.getPoints(samples), closed: planClosed(plan) };
}

/* ---------------------------------------------------------------------
   The physics lap
   --------------------------------------------------------------------- */
export function simulatePlan(plan) {
  const closed = planClosed(plan);
  const nodes = planNodes(plan);
  const pieces = plan.pieces || [];
  if (pieces.length < 4) return { ok: false, reason: "Add at least four pieces.", excitement: 0 };
  if (nodes.length > 46) return { ok: false, reason: "That is as long as the workshop can weld.", excitement: 0 };
  if (!closed) return { ok: false, reason: "The track has to come back to the station.", excitement: 0 };
  if (nodes.some((n) => n.y < 0.6)) return { ok: false, reason: "The track dips below ground level.", excitement: 0 };

  const { points } = planCurve(plan, 260);
  const n = points.length;
  let length = 0;
  const seg = [];
  for (let i = 0; i < n; i++) {
    const a = points[i], b = points[(i + 1) % n];
    const ds = Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
    seg.push(ds);
    length += ds;
  }
  let v = 3.4;
  let maxSpeed = v, maxDrop = 0, maxG = 0, stallAt = -1;
  let time = 0;
  const timeAt = [0];
  const minY = Math.min(...points.map((p) => p.y)), maxY = Math.max(...points.map((p) => p.y));
  maxDrop = maxY - minY;
  for (let i = 0; i < n; i++) {
    const a = points[i], b = points[(i + 1) % n], ds = seg[i];
    const dy = b.y - a.y;
    const climbing = dy > 0.01;
    if (climbing && i < n * LIFT_FRACTION) v = Math.max(v, 3.4);
    const v2 = Math.max(0.01, v * v - 2 * G * dy);
    v = Math.sqrt(v2);
    v *= 1 - Math.min(0.25, ds * 0.0035);
    if (pieces[i % Math.max(1, pieces.length)] === "brake") v *= 0.985;
    if (v < 1.0 && i > 6 && i < n - 6) { stallAt = i; break; }
    maxSpeed = Math.max(maxSpeed, v);
    if (ds > 0.001) {
      const t1 = new THREE.Vector3(b.x - a.x, b.y - a.y, b.z - a.z).normalize();
      const prev = points[(i - 1 + n) % n];
      const t0 = new THREE.Vector3(a.x - prev.x, a.y - prev.y, a.z - prev.z).normalize();
      const ang = Math.acos(Math.max(-1, Math.min(1, t0.dot(t1))));
      const radius = Math.max(0.6, ds / Math.max(0.0001, ang));
      maxG = Math.max(maxG, (v * v) / radius / G);
    }
    time += ds / Math.max(0.3, v);
    timeAt.push(time);
  }
  const topKmh = maxSpeed * 3.6;
  const turns = pieces.filter((p) => p === "left" || p === "right").length;
  const hills = pieces.filter((p) => p === "hill").length;
  const drops = pieces.filter((p) => p === "drop").length;
  if (stallAt > 0) {
    return { ok: false, reason: "The train stalls — add a taller first hill or more drops.", excitement: 0, length, maxDrop, topKmh, maxG, time };
  }
  const excitement = Math.max(8, Math.min(100, Math.round(18 + topKmh * 0.95 + maxDrop * 2.4 + turns * 1.6 + hills * 2 + drops * 2.5 + Math.min(6, maxG * 2.4))));
  return {
    ok: true,
    length,
    maxDrop,
    topKmh,
    maxG,
    time,
    turns,
    hills,
    drops,
    timeAt,
    excitement,
    reason: ""
  };
}

/* ---------------------------------------------------------------------
   Building the ride in the park
   --------------------------------------------------------------------- */
export function buildCoasterRide(def) {
  const plan = def.plan && def.plan.pieces && def.plan.pieces.length ? def.plan : PLAN_DEFAULT;
  const built = new THREE.Group();
  const [c1, c2, c3] = def.palette || ["#e76f51", "#f4e3c1", "#264653"];
  const { curve, points, closed } = planCurve(plan, 240);
  const railA = [], railB = [];
  const UP = new THREE.Vector3(0, 1, 0);
  points.forEach((p, i) => {
    const next = points[(i + 1) % points.length];
    const tan = new THREE.Vector3(next.x - p.x, next.y - p.y, next.z - p.z).normalize();
    const side = new THREE.Vector3().crossVectors(tan, UP).normalize();
    railA.push(new THREE.Vector3(p.x + side.x * 0.5, p.y + 0.06, p.z + side.z * 0.5));
    railB.push(new THREE.Vector3(p.x - side.x * 0.5, p.y + 0.06, p.z - side.z * 0.5));
  });
  const railMat = metric(c1);
  const railTubeA = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(railA, closed), 220, 0.09, 6, closed), railMat);
  const railTubeB = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(railB, closed), 220, 0.09, 6, closed), railMat);
  railTubeA.castShadow = railTubeB.castShadow = true;
  built.add(railTubeA, railTubeB);

  // ties
  const tieGeo = new THREE.BoxGeometry(1.16, 0.08, 0.22);
  const tieMat = metric("#5c4a3a");
  const ties = new THREE.InstancedMesh(tieGeo, tieMat, Math.floor(points.length / 3));
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  let ti = 0;
  for (let i = 0; i < points.length; i += 3) {
    const p = points[i], next = points[(i + 1) % points.length];
    const tan = new THREE.Vector3(next.x - p.x, next.y - p.y, next.z - p.z).normalize();
    q.setFromUnitVectors(new THREE.Vector3(1, 0, 0), tan);
    m4.compose(new THREE.Vector3(p.x, p.y - 0.02, p.z), q, new THREE.Vector3(1, 1, 1));
    ties.setMatrixAt(ti++, m4);
  }
  ties.instanceMatrix.needsUpdate = true;
  ties.castShadow = true;
  built.add(ties);

  // supports down to the ground
  for (let i = 0; i < points.length; i += 9) {
    const p = points[i];
    if (p.y < 0.7) continue;
    const h = p.y;
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, h, 6), metric("#d9d4c9"));
    post.position.set(p.x, h / 2, p.z);
    post.castShadow = true;
    built.add(post);
    if (h > 3) {
      const brace = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.6, 5), metric("#c9bfae"));
      brace.position.set(p.x, h * 0.6, p.z);
      brace.rotation.z = 0.6;
      built.add(brace);
    }
  }

  // station platform and sign at the start point
  const start = points[0];
  const station = new THREE.Group();
  station.position.set(start.x, 0, start.z);
  const base = new THREE.Mesh(new THREE.BoxGeometry(7, 0.4, 5.4), metric("#d9c3a5"));
  base.position.y = 0.2;
  base.receiveShadow = true;
  station.add(base);
  const platform = new THREE.Mesh(new THREE.BoxGeometry(6.6, 0.35, 2.4), metric("#efe0c8"));
  platform.position.set(0, start.y - 0.5, 0);
  station.add(platform);
  for (const x of [-3, 3]) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 3.2, 6), metric("#f4e3cf"));
    post.position.set(x, 1.6, -1.8);
    station.add(post);
  }
  const roof = new THREE.Mesh(new THREE.ConeGeometry(4.2, 1.2, 4), metric(c3));
  roof.position.set(0, 3.6, -1.8);
  roof.rotation.y = Math.PI / 4;
  station.add(roof);
  built.add(station);

  // the train
  const train = new THREE.Group();
  const cars = [];
  for (let i = 0; i < 3; i++) {
    const carGroup = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.7, 2.2), metric(i === 0 ? c1 : c2));
    body.position.y = 0.5;
    body.castShadow = true;
    carGroup.add(body);
    for (const x of [-0.5, 0.5]) for (const z of [-0.7, 0.7]) {
      const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.12, 8), metric("#2b2b2b"));
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(x, 0.18, z);
      carGroup.add(wheel);
    }
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6), metric("#ffd166"));
    if (i === 0) { head.position.set(0, 0.9, 1.0); carGroup.add(head); }
    train.add(carGroup);
    cars.push(carGroup);
  }
  built.add(train);

  // ride-time profile: progress along the spline is not linear in time
  const stats = simulatePlan(plan);
  const lap = stats.ok ? Math.max(8, stats.time) : 18;
  const gaps = [0, 0.022, 0.044];

  const api = {
    group: built,
    update(dt, state) {
      if (!state.running && !state.always) return;
      const t = (state.time % lap) / lap;
      cars.forEach((car, i) => {
        const u = (t + gaps[i]) % 1;
        const p = curve.getPointAt(u);
        const tan = curve.getTangentAt(u);
        car.position.copy(p);
        car.rotation.y = Math.atan2(tan.x, tan.z);
        car.rotation.x = -Math.asin(Math.max(-1, Math.min(1, tan.y))) * 0.55;
      });
    },
    stats
  };
  return api;
}

function metric(color) {
  return new THREE.MeshStandardMaterial({ color: new THREE.Color(color), roughness: 0.55, metalness: 0.25 });
}

/* ---------------------------------------------------------------------
   Editor drawing (top-down canvas)
   --------------------------------------------------------------------- */
export function drawPlan(ctx, plan, w, h, opts = {}) {
  const pieces = plan.pieces || [];
  const nodes = planNodes(plan);
  const minX = Math.min(...nodes.map((n) => n.x)), maxX = Math.max(...nodes.map((n) => n.x));
  const minZ = Math.min(...nodes.map((n) => n.z)), maxZ = Math.max(...nodes.map((n) => n.z));
  const spanX = Math.max(3, maxX - minX), spanZ = Math.max(3, maxZ - minZ);
  const pad = 0.9;
  const cell = Math.min((w - 40) / (spanX + pad * 2), (h - 40) / (spanZ + pad * 2));
  const ox = w / 2 - ((minX + maxX) / 2) * cell;
  const oz = h / 2 - ((minZ + maxZ) / 2) * cell;
  const px = (x) => ox + x * cell;
  const pz = (z) => oz + z * cell;

  ctx.clearRect(0, 0, w, h);
  // grid
  ctx.strokeStyle = "rgba(74,48,64,0.10)";
  ctx.lineWidth = 1;
  for (let x = -8; x <= 12; x++) {
    ctx.beginPath(); ctx.moveTo(px(x), 0); ctx.lineTo(px(x), h); ctx.stroke();
  }
  for (let z = -8; z <= 12; z++) {
    ctx.beginPath(); ctx.moveTo(0, pz(z)); ctx.lineTo(w, pz(z)); ctx.stroke();
  }

  // track body
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = "rgba(38,70,83,0.18)";
  ctx.lineWidth = Math.max(10, cell * 0.5);
  ctx.beginPath();
  nodes.forEach((n, i) => { if (i) ctx.lineTo(px(n.x), pz(n.z)); else ctx.moveTo(px(n.x), pz(n.z)); });
  ctx.stroke();
  ctx.strokeStyle = opts.valid === false ? "#b23a48" : (opts.color || "#e76f51");
  ctx.lineWidth = Math.max(6, cell * 0.3);
  ctx.beginPath();
  nodes.forEach((n, i) => { if (i) ctx.lineTo(px(n.x), pz(n.z)); else ctx.moveTo(px(n.x), pz(n.z)); });
  ctx.stroke();

  // station
  const s = nodes[0];
  ctx.fillStyle = "#264653";
  ctx.beginPath();
  ctx.arc(px(s.x), pz(s.z), Math.max(9, cell * 0.34), 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.font = "700 12px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("S", px(s.x), pz(s.z) + 1);

  // pieces: arrows and heights
  ctx.font = "600 11px system-ui, sans-serif";
  nodes.forEach((n, i) => {
    if (!i) return;
    const prev = nodes[i - 1];
    const mx = px((n.x + prev.x) / 2), mz = pz((n.z + prev.z) / 2);
    const label = { hill: "+", drop: "−", left: "↰", right: "↱", brake: "=", straight: "" }[n.type] || "";
    if (label) {
      ctx.fillStyle = n.type === "drop" ? "#1d6b7a" : n.type === "hill" ? "#b23a48" : "#4a3040";
      ctx.fillText(label, mx, mz);
    }
    ctx.fillStyle = "rgba(38,70,83,0.55)";
    ctx.font = "600 9px system-ui, sans-serif";
    ctx.fillText(String(Math.round(n.y)), px(n.x), pz(n.z) - cell * 0.36);
    ctx.font = "600 11px system-ui, sans-serif";
  });

  if (opts.testT !== undefined && opts.testT !== null) {
    const idx = Math.floor(opts.testT * (nodes.length - 1));
    const a = nodes[idx], b = nodes[Math.min(nodes.length - 1, idx + 1)];
    const t = opts.testT * (nodes.length - 1) - idx;
    ctx.fillStyle = "#ffbe0b";
    ctx.beginPath();
    ctx.arc(px(a.x + (b.x - a.x) * t), pz(a.z + (b.z - a.z) * t), Math.max(7, cell * 0.22), 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#7a4b00";
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  return { cell, px, pz };
}
