/* =====================================================================
   TEXAS HOLD'EM — low-poly geometry
   A small hand-rolled builder for flat-shaded, vertex-coloured, skinned
   geometry. Every face is pushed separately so the facets stay crisp.
   ===================================================================== */

import * as THREE from 'three';

const icoSource = new THREE.IcosahedronGeometry(1, 0);
const icoGeometry = icoSource.index ? icoSource.toNonIndexed() : icoSource;
const icoPositions = icoGeometry.getAttribute('position').array;

const UP = new THREE.Vector3(0, 1, 0);
const SIDE = new THREE.Vector3(1, 0, 0);
const AXIS_Z = new THREE.Vector3(0, 0, 1);

const tempAxis = new THREE.Vector3();
const tempU = new THREE.Vector3();
const tempV = new THREE.Vector3();
const tempA = new THREE.Vector3();
const tempB = new THREE.Vector3();
const tempC = new THREE.Vector3();
const tempD = new THREE.Vector3();
const tempOut = new THREE.Vector3();
const tempNormal = new THREE.Vector3();
const tempQuat = new THREE.Quaternion();

function colorOf(value) {
  return value && value.isColor ? value.clone() : new THREE.Color(value);
}

function vary(color, amount, seed) {
  const jitter = 1 + (((seed * 37) % 11) / 11 - 0.5) * amount;
  return color.clone().multiplyScalar(jitter);
}

function frameFor(axis) {
  const reference = Math.abs(axis.y) > 0.86 ? AXIS_Z : UP;
  tempU.crossVectors(reference, axis).normalize();
  if (tempU.lengthSq() < 0.0001) tempU.crossVectors(SIDE, axis).normalize();
  tempV.crossVectors(axis, tempU).normalize();
}

export class LowPolyBuilder {
  constructor(bones) {
    this.bones = bones;
    this.boneIndex = new Map(bones.map((bone, index) => [bone, index]));
    this.positions = [];
    this.colors = [];
    this.skinIndices = [];
    this.skinWeights = [];
    this.count = 0;
    this.seed = 0;
  }

  weights(list) {
    const entries = (list || []).filter((entry) => entry && entry[0]);
    if (!entries.length) throw new Error('lowpoly: vertex needs a bone weight');
    entries.sort((a, b) => b[1] - a[1]);
    const picked = entries.slice(0, 4);
    const total = picked.reduce((sum, entry) => sum + Math.max(0, entry[1]), 0) || 1;
    const indices = [0, 0, 0, 0];
    const values = [0, 0, 0, 0];
    picked.forEach((entry, index) => {
      indices[index] = this.boneIndex.get(entry[0]);
      values[index] = entry[1] / total;
    });
    return { indices, values };
  }

  vertex(point, color, weightList) {
    const weight = this.weights(weightList);
    this.positions.push(point.x, point.y, point.z);
    this.colors.push(color.r, color.g, color.b);
    this.skinIndices.push(...weight.indices);
    this.skinWeights.push(...weight.values);
    this.count += 1;
    return this.count - 1;
  }

  triangle(a, b, c, colorHex, weightList, outward = null) {
    if (outward) {
      tempA.subVectors(b, a);
      tempB.subVectors(c, a);
      tempNormal.crossVectors(tempA, tempB);
      if (tempNormal.dot(outward) < 0) {
        const swap = b;
        b = c;
        c = swap;
      }
    }
    const color = vary(colorOf(colorHex), 0.055, this.seed++);
    this.vertex(a, color, weightList);
    this.vertex(b, color, weightList);
    this.vertex(c, color, weightList);
  }

  quad(a, b, c, d, colorHex, weightList, outward = null) {
    this.triangle(a, b, c, colorHex, weightList, outward);
    this.triangle(a, c, d, colorHex, weightList, outward);
  }

  /* A tapered low-poly tube between two points. Radii can be numbers
     (round) or [rx, rz] pairs measured along the tube's local frame. */
  prism(start, end, radiusStart, radiusEnd, sides, color, weightsStart, weightsEnd, options = {}) {
    const a = start.isVector3 ? start.clone() : new THREE.Vector3(...start);
    const b = end.isVector3 ? end.clone() : new THREE.Vector3(...end);
    tempAxis.subVectors(b, a);
    const length = tempAxis.length();
    if (length < 0.0001) return;
    tempAxis.multiplyScalar(1 / length);
    frameFor(tempAxis);
    const u = tempU.clone();
    const v = tempV.clone();
    const startRadius = Array.isArray(radiusStart) ? radiusStart : [radiusStart, radiusStart];
    const endRadius = Array.isArray(radiusEnd) ? radiusEnd : [radiusEnd, radiusEnd];
    const twist = options.twist || 0;
    const startRing = [];
    const endRing = [];
    for (let i = 0; i < sides; i++) {
      const angle = twist + (i / sides) * Math.PI * 2;
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      startRing.push(new THREE.Vector3(
        a.x + u.x * cos * startRadius[0] + v.x * sin * startRadius[1],
        a.y + u.y * cos * startRadius[0] + v.y * sin * startRadius[1],
        a.z + u.z * cos * startRadius[0] + v.z * sin * startRadius[1]
      ));
      endRing.push(new THREE.Vector3(
        b.x + u.x * cos * endRadius[0] + v.x * sin * endRadius[1],
        b.y + u.y * cos * endRadius[0] + v.y * sin * endRadius[1],
        b.z + u.z * cos * endRadius[0] + v.z * sin * endRadius[1]
      ));
    }
    for (let i = 0; i < sides; i++) {
      const j = (i + 1) % sides;
      tempOut.set(
        (startRing[i].x + startRing[j].x + endRing[i].x + endRing[j].x) * 0.25 - (a.x + b.x) * 0.5,
        (startRing[i].y + startRing[j].y + endRing[i].y + endRing[j].y) * 0.25 - (a.y + b.y) * 0.5,
        (startRing[i].z + startRing[j].z + endRing[i].z + endRing[j].z) * 0.25 - (a.z + b.z) * 0.5
      );
      this.quad(startRing[i], startRing[j], endRing[j], endRing[i], color, weightsStart, tempOut);
    }
    if (options.capStart !== false) {
      for (let i = 1; i < sides - 1; i++) {
        tempOut.copy(tempAxis).multiplyScalar(-1);
        this.triangle(a, startRing[i], startRing[i + 1], color, weightsStart, tempOut);
      }
    }
    if (options.capEnd !== false) {
      for (let i = 1; i < sides - 1; i++) {
        this.triangle(b, endRing[i + 1], endRing[i], color, weightsEnd, tempAxis);
      }
    }
    return { start: a, end: b, startRing, endRing };
  }

  /* A box built from six low-poly faces. Rotation is optional. */
  box(center, size, color, weightList, rotation = null) {
    const c = center.isVector3 ? center.clone() : new THREE.Vector3(...center);
    const half = new THREE.Vector3(size[0] * 0.5, size[1] * 0.5, size[2] * 0.5);
    const corners = [
      new THREE.Vector3(-half.x, -half.y, -half.z),
      new THREE.Vector3(half.x, -half.y, -half.z),
      new THREE.Vector3(half.x, -half.y, half.z),
      new THREE.Vector3(-half.x, -half.y, half.z),
      new THREE.Vector3(-half.x, half.y, -half.z),
      new THREE.Vector3(half.x, half.y, -half.z),
      new THREE.Vector3(half.x, half.y, half.z),
      new THREE.Vector3(-half.x, half.y, half.z)
    ];
    const quaternion = new THREE.Quaternion();
    if (rotation) {
      if (rotation.isQuaternion) quaternion.copy(rotation);
      else quaternion.setFromEuler(rotation);
    }
    for (const corner of corners) corner.applyQuaternion(quaternion).add(c);
    const faces = [
      [corners[1], corners[2], corners[6], corners[5], new THREE.Vector3(1, 0, 0)],
      [corners[0], corners[4], corners[7], corners[3], new THREE.Vector3(-1, 0, 0)],
      [corners[3], corners[7], corners[6], corners[2], new THREE.Vector3(0, 0, 1)],
      [corners[0], corners[1], corners[5], corners[4], new THREE.Vector3(0, 0, -1)],
      [corners[4], corners[5], corners[6], corners[7], new THREE.Vector3(0, 1, 0)],
      [corners[0], corners[3], corners[2], corners[1], new THREE.Vector3(0, -1, 0)]
    ];
    for (const [a, b, d, e, normal] of faces) {
      const outward = normal.clone().applyQuaternion(quaternion);
      this.quad(a, b, d, e, color, weightList, outward);
    }
  }

  /* Faceted blob from an icosahedron: the workhorse for skulls, joints
     and other organic-but-angular shapes. */
  blob(center, scale, color, weightList, rotation = null) {
    const c = center.isVector3 ? center.clone() : new THREE.Vector3(...center);
    const s = Array.isArray(scale) ? scale : [scale, scale, scale];
    const quaternion = new THREE.Quaternion();
    if (rotation) {
      if (rotation.isQuaternion) quaternion.copy(rotation);
      else quaternion.setFromEuler(rotation);
    }
    for (let i = 0; i < icoPositions.length; i += 9) {
      const points = [];
      for (let k = 0; k < 3; k++) {
        const p = new THREE.Vector3(
          icoPositions[i + k * 3] * s[0],
          icoPositions[i + k * 3 + 1] * s[1],
          icoPositions[i + k * 3 + 2] * s[2]
        ).applyQuaternion(quaternion).add(c);
        points.push(p);
      }
      this.triangle(points[0], points[1], points[2], color, weightList, null);
    }
  }

  /* Add an arbitrary Three geometry (non-indexed) as faceted geometry. */
  geometry(source, center, scale, color, weightList, rotation = null) {
    const geometry = source.index ? source.toNonIndexed() : source;
    const position = geometry.getAttribute('position');
    const c = center.isVector3 ? center.clone() : new THREE.Vector3(...center);
    const s = Array.isArray(scale) ? scale : [scale, scale, scale];
    const quaternion = new THREE.Quaternion();
    if (rotation) {
      if (rotation.isQuaternion) quaternion.copy(rotation);
      else quaternion.setFromEuler(rotation);
    }
    const points = [];
    for (let i = 0; i < position.count; i++) {
      points.push(new THREE.Vector3(
        position.getX(i) * s[0],
        position.getY(i) * s[1],
        position.getZ(i) * s[2]
      ).applyQuaternion(quaternion).add(c));
    }
    for (let i = 0; i < points.length; i += 3) {
      this.triangle(points[i], points[i + 1], points[i + 2], color, weightList, null);
    }
  }

  build() {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(this.positions, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(this.colors, 3));
    geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(this.skinIndices, 4));
    geometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute(this.skinWeights, 4));
    geometry.computeVertexNormals();
    geometry.computeBoundingSphere();
    return geometry;
  }
}

export function handQuaternion(pose) {
  if (pose === 'standing') {
    return new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2);
  }
  return new THREE.Quaternion();
}

export function torsoMaterial() {
  return new THREE.MeshStandardMaterial({
    vertexColors: true,
    flatShading: true,
    roughness: 0.82,
    metalness: 0.015
  });
}

export function accessoryMaterial(color, options = {}) {
  return new THREE.MeshStandardMaterial({
    color,
    flatShading: true,
    roughness: options.roughness ?? 0.78,
    metalness: options.metalness ?? 0,
    ...options
  });
}

export { tempQuat };
