// Terreno em chunks com streaming e LOD
import * as THREE from 'three';
import { terrainHeight, terrainNormal, biomeColor } from './heightfield.js';
import { WORLD } from '../core/config.js';
import { rng } from '../core/utils.js';

const _c = [0, 0, 0];
const _n = { x: 0, y: 1, z: 0 };

function buildChunkGeometry(cx, cz, segments) {
  const size = WORLD.CHUNK;
  const x0 = cx * size, z0 = cz * size;
  const n = segments + 1;
  const positions = new Float32Array(n * n * 3);
  const colors = new Float32Array(n * n * 3);
  const normals = new Float32Array(n * n * 3);
  const step = size / segments;

  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const x = x0 + i * step, z = z0 + j * step;
      const h = terrainHeight(x, z);
      const idx = (j * n + i) * 3;
      positions[idx] = x; positions[idx + 1] = h; positions[idx + 2] = z;
      terrainNormal(x, z, _n);
      normals[idx] = _n.x; normals[idx + 1] = _n.y; normals[idx + 2] = _n.z;
      const slope = 1 - _n.y;
      biomeColor(x, z, h, slope, _c);
      colors[idx] = _c[0]; colors[idx + 1] = _c[1]; colors[idx + 2] = _c[2];
    }
  }

  const indices = new Uint32Array(segments * segments * 6);
  let k = 0;
  for (let j = 0; j < segments; j++) {
    for (let i = 0; i < segments; i++) {
      const a = j * n + i, b = a + 1, c = a + n, d = c + 1;
      indices[k++] = a; indices[k++] = c; indices[k++] = b;
      indices[k++] = b; indices[k++] = c; indices[k++] = d;
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  geo.setIndex(new THREE.BufferAttribute(indices, 1));
  geo.computeBoundingSphere();
  return geo;
}

function groundDetailTexture() {
  // Textura procedural de micro-detalhe (terra/grama) — multiplica as cores
  // dos vértices e dá granulação ao terreno sem custo de download.
  const S = 256;
  const cv = document.createElement('canvas');
  cv.width = S; cv.height = S;
  const ctx = cv.getContext('2d');
  ctx.fillStyle = '#b4b4b4';
  ctx.fillRect(0, 0, S, S);
  const rand = rng(777);
  for (let i = 0; i < 5200; i++) {
    const x = rand() * S, y = rand() * S;
    const v = 140 + Math.floor(rand() * 110);
    const s = 1 + rand() * 2.4;
    ctx.fillStyle = `rgb(${v},${v - Math.floor(rand() * 24)},${v - Math.floor(rand() * 34)})`;
    ctx.fillRect(x, y, s, s);
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(90, 90);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export class Terrain {
  constructor(scene, quality) {
    this.scene = scene;
    this.q = quality;
    this.material = new THREE.MeshStandardMaterial({
      vertexColors: true, roughness: 0.95, metalness: 0.0,
      map: groundDetailTexture(),
    });
    this.chunks = new Map();
    this.group = new THREE.Group();
    scene.add(this.group);
  }

  setQuality(q) { this.q = q; }

  _lodFor(dist) {
    const r = this.q.lodRadius;
    if (dist < r[0]) return this.q.lod.near;
    if (dist < r[1]) return this.q.lod.mid;
    return this.q.lod.far;
  }

  update(px, pz) {
    const size = WORLD.CHUNK, half = WORLD.HALF;
    const pcx = Math.floor((px + half) / size), pcz = Math.floor((pz + half) / size);
    const reach = Math.ceil(this.q.viewDist / size) + 1;
    const keep = new Set();

    for (let dz = -reach; dz <= reach; dz++) {
      for (let dx = -reach; dx <= reach; dx++) {
        const cx = pcx + dx, cz = pcz + dz;
        if (cx < 0 || cz < 0 || cx >= WORLD.CHUNKS || cz >= WORLD.CHUNKS) continue;
        const ccx = cx * size + size / 2, ccz = cz * size + size / 2;
        const dist = Math.hypot(ccx - px, ccz - pz);
        if (dist > this.q.viewDist + size) continue;
        const key = cx + ',' + cz;
        keep.add(key);
        const lod = this._lodFor(dist);
        const existing = this.chunks.get(key);
        if (!existing) {
          const mesh = new THREE.Mesh(buildChunkGeometry(cx, cz, lod), this.material);
          mesh.receiveShadow = this.q.shadowMap > 0;
          mesh.matrixAutoUpdate = false;
          this.group.add(mesh);
          this.chunks.set(key, { mesh, lod });
        } else if (existing.lod !== lod) {
          // histerese: só troca LOD se diferença relevante
          const ratio = lod / existing.lod;
          if (ratio < 0.6 || ratio > 1.6) {
            existing.mesh.geometry.dispose();
            existing.mesh.geometry = buildChunkGeometry(cx, cz, lod);
            existing.lod = lod;
          }
        }
      }
    }

    for (const [key, entry] of this.chunks) {
      if (!keep.has(key)) {
        this.group.remove(entry.mesh);
        entry.mesh.geometry.dispose();
        this.chunks.delete(key);
      }
    }
  }

  dispose() {
    for (const [, e] of this.chunks) { e.mesh.geometry.dispose(); }
    this.chunks.clear();
    this.scene.remove(this.group);
  }
}
