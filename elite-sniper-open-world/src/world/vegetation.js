// Vegetação e rochas — geometrias fundidas, InstancedMesh por chunk, vento no vertex shader
import * as THREE from 'three';
import { terrainHeight, terrainSlope, roadDistance, FLAT_SITES } from './heightfield.js';
import { WORLD } from '../core/config.js';
import { rng, dist2, fbm, clamp } from '../core/utils.js';

function mergeGeoms(list) {
  // lista de { geo (não indexada), color: [r,g,b] } -> BufferGeometry única com vertex colors
  let total = 0;
  const parts = list.map(({ geo, color }) => {
    const g = geo.index ? geo.toNonIndexed() : geo;
    const count = g.attributes.position.count;
    total += count;
    return { g, color, count };
  });
  const pos = new Float32Array(total * 3);
  const nor = new Float32Array(total * 3);
  const col = new Float32Array(total * 3);
  let o = 0;
  for (const { g, color, count } of parts) {
    const p = g.attributes.position.array, n = g.attributes.normal.array;
    pos.set(p, o * 3); nor.set(n, o * 3);
    if (color) {
      for (let i = 0; i < count; i++) {
        col[(o + i) * 3] = color[0]; col[(o + i) * 3 + 1] = color[1]; col[(o + i) * 3 + 2] = color[2];
      }
    } else {
      col.set(g.attributes.color.array, o * 3);
    }
    o += count;
    g.dispose();
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  out.setAttribute('color', new THREE.BufferAttribute(col, 3));
  out.computeBoundingSphere();
  return out;
}

export function makePineGeometry() {
  const parts = [];
  const trunk = new THREE.CylinderGeometry(0.16, 0.34, 3.4, 6);
  trunk.translate(0, 1.7, 0);
  parts.push({ geo: trunk, color: [0.30, 0.21, 0.13] });
  const tiers = [
    [3.1, 2.4, 2.2, 0.10, 0.24, 0.12],
    [2.4, 2.0, 3.9, 0.11, 0.27, 0.14],
    [1.7, 1.6, 5.4, 0.13, 0.30, 0.16],
    [1.0, 1.2, 6.7, 0.15, 0.33, 0.18],
  ];
  for (const [r, h, y, cr, cg, cb] of tiers) {
    const cone = new THREE.ConeGeometry(r, h, 7);
    cone.translate(0, y, 0);
    parts.push({ geo: cone, color: [cr, cg, cb] });
  }
  return mergeGeoms(parts);
}

export function makeBroadleafGeometry() {
  const parts = [];
  const trunk = new THREE.CylinderGeometry(0.22, 0.42, 3.0, 6);
  trunk.translate(0, 1.5, 0);
  parts.push({ geo: trunk, color: [0.34, 0.24, 0.15] });
  for (const [rx, rz, tilt] of [[0.9, 0.3, 0.7], [-0.7, -0.5, 0.9], [0.2, -1.0, 0.8]]) {
    const br = new THREE.CylinderGeometry(0.07, 0.13, 2.2, 5);
    br.translate(0, 1.1, 0);
    br.rotateX(tilt * 0.5); br.rotateZ(tilt);
    br.translate(rx * 0.5, 2.8, rz * 0.5);
    parts.push({ geo: br, color: [0.32, 0.23, 0.14] });
  }
  const blobs = [
    [0, 4.6, 0, 1.9, 0.24, 0.42, 0.16],
    [1.3, 4.0, 0.6, 1.3, 0.27, 0.46, 0.18],
    [-1.2, 4.1, -0.5, 1.4, 0.22, 0.40, 0.15],
    [0.3, 5.4, -0.8, 1.2, 0.26, 0.45, 0.17],
    [-0.6, 4.9, 1.1, 1.1, 0.29, 0.48, 0.19],
    [1.0, 5.1, -0.4, 1.0, 0.21, 0.38, 0.14],
  ];
  for (const [x, y, z, r, cr, cg, cb] of blobs) {
    const b = new THREE.IcosahedronGeometry(r, 1);
    b.scale(1, 0.8, 1);
    b.translate(x, y, z);
    parts.push({ geo: b, color: [cr, cg, cb] });
  }
  return mergeGeoms(parts);
}

export function makeRockGeometry() {
  const g = new THREE.DodecahedronGeometry(1, 1);
  const p = g.attributes.position;
  const rand = rng(1234);
  for (let i = 0; i < p.count; i++) {
    const s = 0.75 + rand() * 0.5;
    p.setXYZ(i, p.getX(i) * s, p.getY(i) * (0.6 + rand() * 0.3), p.getZ(i) * s);
  }
  g.computeVertexNormals();
  // faixas de cor: base mais escura (terra úmida), topo mais claro
  const col = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) {
    const t = clamp((p.getY(i) + 0.8) / 1.6, 0, 1);
    const v = 0.36 + t * 0.16 + rand() * 0.05;
    col[i * 3] = v; col[i * 3 + 1] = v * 0.985; col[i * 3 + 2] = v * 0.95;
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return mergeGeoms([{ geo: g, color: null }]);
}

export function makeGrassGeometry() {
  // tufo: 6 lâminas afiladas (triângulos) com gradiente base-escura → ponta-clara
  const rand = rng(4242);
  const parts = [];
  for (let i = 0; i < 6; i++) {
    const h = 0.45 + rand() * 0.35;
    const w = 0.05 + rand() * 0.035;
    const lean = (rand() - 0.5) * 0.5;
    const g = new THREE.BufferGeometry();
    const pos = new Float32Array([
      -w, 0, 0,  w, 0, 0,  lean, h, (rand() - 0.5) * 0.12,
    ]);
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.BufferAttribute(new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1]), 3));
    const shade = 0.75 + rand() * 0.5;
    const base = [0.13 * shade, 0.26 * shade, 0.08 * shade];
    const tip = [0.42 * shade, 0.62 * shade, 0.22 * shade];
    g.setAttribute('color', new THREE.BufferAttribute(new Float32Array([
      base[0], base[1], base[2], base[0], base[1], base[2], tip[0], tip[1], tip[2],
    ]), 3));
    g.rotateY((i / 6) * Math.PI * 2 + rand() * 0.6);
    parts.push({ geo: g, color: null });
  }
  return mergeGeoms(parts);
}

function windMaterial(baseOpts, swayH = 1.2, swayAmp = 0.045) {
  const mat = new THREE.MeshStandardMaterial(baseOpts);
  mat.userData.time = { value: 0 };
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = mat.userData.time;
    shader.uniforms.uSwayH = { value: swayH };
    shader.uniforms.uSwayAmp = { value: swayAmp };
    shader.vertexShader = 'uniform float uTime;\nuniform float uSwayH;\nuniform float uSwayAmp;\n' + shader.vertexShader.replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
       #ifdef USE_INSTANCING
       float wPhase = instanceMatrix[3][0] * 0.35 + instanceMatrix[3][2] * 0.41;
       #else
       float wPhase = 0.0;
       #endif
       float sway = sin(uTime * 1.7 + wPhase) * 0.5 + sin(uTime * 3.1 + wPhase * 1.7) * 0.22;
       float hFac = max(transformed.y - uSwayH, 0.0) * uSwayAmp;
       transformed.x += sway * hFac;
       transformed.z += cos(uTime * 1.3 + wPhase) * hFac * 0.7;`
    );
  };
  return mat;
}

function siteClearance(x, z) {
  for (const s of FLAT_SITES) {
    if (dist2(x, z, s.x, s.z) < (s.r + 8) * (s.r + 8)) return false;
  }
  return true;
}

export class Vegetation {
  constructor(scene, quality) {
    this.scene = scene;
    this.q = quality;
    this.group = new THREE.Group();
    scene.add(this.group);
    this.chunks = new Map();

    this.pineGeo = makePineGeometry();
    this.leafGeo = makeBroadleafGeometry();
    this.rockGeo = makeRockGeometry();
    this.grassGeo = makeGrassGeometry();

    this.treeMat = windMaterial({ vertexColors: true, roughness: 0.9, metalness: 0 }, 1.2, 0.045);
    this.rockMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, metalness: 0.05 });
    this.grassMat = windMaterial({ vertexColors: true, roughness: 1.0, metalness: 0, side: THREE.DoubleSide }, 0.02, 0.30);

    this._dummy = new THREE.Object3D();
    this.colliders = new Map(); // key -> array de {x, z, r}
    this.grassMesh = null;
    this.grassCenter = { x: 1e9, z: 1e9 };
  }

  setQuality(q) { this.q = q; }

  update(px, pz, time) {
    this.treeMat.userData.time.value = time;
    this.grassMat.userData.time.value = time * 1.6;

    const size = WORLD.CHUNK, half = WORLD.HALF;
    const pcx = Math.floor((px + half) / size), pcz = Math.floor((pz + half) / size);
    const reach = Math.ceil(this.q.viewDist / size) + 1;
    const keep = new Set();

    for (let dz = -reach; dz <= reach; dz++) {
      for (let dx = -reach; dx <= reach; dx++) {
        const cx = pcx + dx, cz = pcz + dz;
        if (cx < 0 || cz < 0 || cx >= WORLD.CHUNKS || cz >= WORLD.CHUNKS) continue;
        const ccx = cx * size + size / 2, ccz = cz * size + size / 2;
        if (Math.hypot(ccx - px, ccz - pz) > this.q.viewDist + size) continue;
        const key = cx + ',' + cz;
        keep.add(key);
        if (!this.chunks.has(key)) this._buildChunk(cx, cz, key);
      }
    }
    for (const [key, entry] of this.chunks) {
      if (!keep.has(key)) {
        for (const m of entry.meshes) { this.group.remove(m); m.dispose(); }
        this.colliders.delete(key);
        this.chunks.delete(key);
      }
    }
    this._updateGrass(px, pz);
  }

  _buildChunk(cx, cz, key) {
    const size = WORLD.CHUNK;
    const rand = rng((cx * 73856093) ^ (cz * 19349663));
    const x0 = cx * size, z0 = cz * size;
    const pines = [], leafs = [], rocks = [], grass = [];
    const colliders = [];

    const density = this.q.treeDensity;
    const attempts = Math.floor(240 * density);
    for (let i = 0; i < attempts; i++) {
      const x = x0 + rand() * size, z = z0 + rand() * size;
      const h = terrainHeight(x, z);
      if (h < 1.2 || h > 58) continue;
      const slope = terrainSlope(x, z);
      if (slope > 0.45) continue;
      if (roadDistance(x, z) < 6) continue;
      if (!siteClearance(x, z)) continue;
      const forest = fbm(x * 0.01 + 77, z * 0.01 + 31, 3);
      if (forest < 0.52) continue;
      const s = 0.8 + rand() * 0.7;
      const rot = rand() * Math.PI * 2;
      const isPine = h > 18 || rand() < 0.55;
      const entry = { x, y: h - 0.15, z, s, rot };
      (isPine ? pines : leafs).push(entry);
      colliders.push({ x, z, r: 0.45 * s, type: 'tree' });
    }

    const rockCount = Math.floor(26 * this.q.rockDensity);
    for (let i = 0; i < rockCount; i++) {
      const x = x0 + rand() * size, z = z0 + rand() * size;
      const h = terrainHeight(x, z);
      if (h < 0.5) continue;
      if (roadDistance(x, z) < 5) continue;
      if (!siteClearance(x, z)) continue;
      const s = 0.5 + rand() * (h > 40 ? 3.2 : 1.6);
      const rot = rand() * Math.PI * 2;
      rocks.push({ x, y: h - s * 0.25, z, s, rot });
      if (s > 1.4) colliders.push({ x, z, r: s * 0.85, type: 'rock' });
    }

    const meshes = [];
    const dummy = this._dummy;
    const makeInstanced = (geo, mat, list) => {
      if (!list.length) return;
      const im = new THREE.InstancedMesh(geo, mat, list.length);
      im.receiveShadow = this.q.shadowMap > 0;
      im.castShadow = this.q.shadowMap > 0 && geo !== this.grassGeo;
      for (let i = 0; i < list.length; i++) {
        const e = list[i];
        dummy.position.set(e.x, e.y, e.z);
        dummy.rotation.set(0, e.rot, 0);
        dummy.scale.setScalar(e.s);
        dummy.updateMatrix();
        im.setMatrixAt(i, dummy.matrix);
      }
      im.instanceMatrix.needsUpdate = true;
      im.frustumCulled = true;
      this.group.add(im);
      meshes.push(im);
    };
    makeInstanced(this.pineGeo, this.treeMat, pines);
    makeInstanced(this.leafGeo, this.treeMat, leafs);
    makeInstanced(this.rockGeo, this.rockMat, rocks);

    this.chunks.set(key, { meshes });
    this.colliders.set(key, colliders);
  }

  _updateGrass(px, pz) {
    const g = this.q.grass;
    if (!this.grassMesh && g > 0) {
      const count = Math.floor(4000 * g);
      this.grassMesh = new THREE.InstancedMesh(this.grassGeo, this.grassMat, count);
      this.grassMesh.frustumCulled = false;
      this.group.add(this.grassMesh);
      this.grassCenter = { x: 1e9, z: 1e9 };
    }
    if (!this.grassMesh) return;
    if (g === 0) { this.grassMesh.visible = false; return; }
    this.grassMesh.visible = true;
    const dx = px - this.grassCenter.x, dz = pz - this.grassCenter.z;
    if (dx * dx + dz * dz < 400) return;
    this.grassCenter.x = px; this.grassCenter.z = pz;
    const rand = rng((Math.floor(px) * 31) ^ (Math.floor(pz) * 17) ^ 0x9e37);
    const dummy = this._dummy;
    const count = this.grassMesh.count;
    const range = 70;
    for (let i = 0; i < count; i++) {
      let x = 0, z = 0, h = -100, tries = 0;
      do {
        x = px + (rand() * 2 - 1) * range;
        z = pz + (rand() * 2 - 1) * range;
        h = terrainHeight(x, z);
        tries++;
      } while ((h < 1.5 || h > 45 || roadDistance(x, z) < 4) && tries < 4);
      dummy.position.set(x, h - 0.05, z);
      dummy.rotation.set(0, rand() * Math.PI, 0);
      dummy.scale.setScalar(0.7 + rand() * 0.9);
      dummy.updateMatrix();
      this.grassMesh.setMatrixAt(i, dummy.matrix);
    }
    this.grassMesh.instanceMatrix.needsUpdate = true;
  }

  getCollidersNear(px, pz, radius) {
    const out = [];
    const size = WORLD.CHUNK, half = WORLD.HALF;
    const r0 = Math.floor((px - radius + half) / size), r1 = Math.floor((px + radius + half) / size);
    const c0 = Math.floor((pz - radius + half) / size), c1 = Math.floor((pz + radius + half) / size);
    for (let cz = c0; cz <= c1; cz++) {
      for (let cx = r0; cx <= r1; cx++) {
        const arr = this.colliders.get(cx + ',' + cz);
        if (arr) out.push(...arr);
      }
    }
    return out;
  }

  dispose() {
    for (const [, e] of this.chunks) for (const m of e.meshes) m.dispose();
    this.chunks.clear();
    this.scene.remove(this.group);
  }
}
