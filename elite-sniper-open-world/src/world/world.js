// Mundo — orquestra terreno, vegetação, água, céu, clima e estruturas
// Fornece colisão física e raycast balístico unificados
import * as THREE from 'three';
import { Terrain } from './terrain.js';
import { Vegetation } from './vegetation.js';
import { Water } from './water.js';
import { Sky } from './sky.js';
import { Weather } from './weather.js';
import { Structures } from './structures.js';
import { terrainHeight } from './heightfield.js';
import { WORLD } from '../core/config.js';
import { clamp } from '../core/utils.js';

const _v1 = new THREE.Vector3();

export class World {
  constructor(scene, renderer, quality, hooks = {}) {
    this.scene = scene;
    this.q = quality;
    this.entities = [];       // { pos, radius, height, alive, faction, ref }
    this.terrain = new Terrain(scene, quality);
    this.vegetation = new Vegetation(scene, quality);
    this.water = new Water(scene);
    this.sky = new Sky(scene, renderer);
    this.weather = new Weather(scene, quality, hooks);
    this.structures = new Structures(scene, quality);
    this.sky.setShadow(quality.shadowMap > 0, quality.shadowMap, quality.shadowDist);
  }

  setQuality(q) {
    this.q = q;
    this.terrain.setQuality(q);
    this.vegetation.setQuality(q);
    this.weather.setQuality(q);
    this.sky.setShadow(q.shadowMap > 0, q.shadowMap, q.shadowDist);
  }

  groundHeight(x, z) { return terrainHeight(x, z); }

  // Altura de apoio: terreno ou topo de caixas/torres/barracos (permite subir em estruturas)
  supportHeight(x, z, feetY) {
    let h = terrainHeight(x, z);
    for (const c of this.structures.colliders) {
      if (x > c.minX - 0.3 && x < c.maxX + 0.3 && z > c.minZ - 0.3 && z < c.maxZ + 0.3) {
        if (c.y1 <= feetY + 0.7 && c.y1 > h) h = c.y1;
      }
    }
    return h;
  }

  addEntity(e) { this.entities.push(e); }
  removeEntity(e) {
    const i = this.entities.indexOf(e);
    if (i >= 0) this.entities.splice(i, 1);
  }

  // ---- Colisão do jogador (círculo vs cilindros e caixas) ----
  collide(pos, radius, feetY, headY) {
    const colliders = this.vegetation.getCollidersNear(pos.x, pos.z, radius + 2);
    for (const s of this.structures.colliders) {
      if (pos.x > s.minX - 60 && pos.x < s.maxX + 60 && pos.z > s.minZ - 60 && pos.z < s.maxZ + 60) colliders.push(s);
    }
    let hit = false;
    for (const c of colliders) {
      if (c.type === 'tree' || c.type === 'rock') {
        const dx = pos.x - c.x, dz = pos.z - c.z;
        const rr = radius + c.r;
        const d2 = dx * dx + dz * dz;
        if (d2 < rr * rr && d2 > 1e-6) {
          const d = Math.sqrt(d2);
          pos.x = c.x + (dx / d) * rr;
          pos.z = c.z + (dz / d) * rr;
          hit = true;
        }
      } else if (c.type === 'box') {
        if (headY < c.y0 || feetY > c.y1 - 0.3) continue;
        const cx = clamp(pos.x, c.minX, c.maxX);
        const cz = clamp(pos.z, c.minZ, c.maxZ);
        const dx = pos.x - cx, dz = pos.z - cz;
        const d2 = dx * dx + dz * dz;
        if (d2 < radius * radius) {
          if (c.thin) {
            // muro: empurra pelo eixo de menor penetração
            const pl = pos.x - (c.minX - radius), pr = (c.maxX + radius) - pos.x;
            const pt = pos.z - (c.minZ - radius), pb = (c.maxZ + radius) - pos.z;
            const m = Math.min(pl, pr, pt, pb);
            if (m === pl) pos.x = c.minX - radius;
            else if (m === pr) pos.x = c.maxX + radius;
            else if (m === pt) pos.z = c.minZ - radius;
            else pos.z = c.maxZ + radius;
          } else if (d2 > 1e-6) {
            const d = Math.sqrt(d2);
            pos.x = cx + (dx / d) * radius;
            pos.z = cz + (dz / d) * radius;
          } else {
            pos.z = c.maxZ + radius;
          }
          hit = true;
        }
      }
    }
    return hit;
  }

  // ---- Raycast balístico / de visão ----
  // Retorna { dist, point, kind, entity } ou null
  raycast(origin, dir, maxDist, ignoreEntity = null, checkEntities = true) {
    let best = { dist: maxDist + 1, kind: null, entity: null, point: new THREE.Vector3() };

    // Terreno: marcha + refino
    const step = 3.0;
    let prevT = 0;
    let prevAbove = origin.y - terrainHeight(origin.x, origin.z) > 0;
    for (let t = step; t <= maxDist; t += step) {
      const x = origin.x + dir.x * t, y = origin.y + dir.y * t, z = origin.z + dir.z * t;
      const above = y - terrainHeight(x, z) > 0;
      if (!above && prevAbove) {
        let lo = prevT, hi = t;
        for (let i = 0; i < 7; i++) {
          const mid = (lo + hi) / 2;
          const mx = origin.x + dir.x * mid, my = origin.y + dir.y * mid, mz = origin.z + dir.z * mid;
          if (my - terrainHeight(mx, mz) > 0) lo = mid; else hi = mid;
        }
        if (hi < best.dist) {
          best.dist = hi; best.kind = 'terrain';
          best.point.set(origin.x + dir.x * hi, origin.y + dir.y * hi, origin.z + dir.z * hi);
        }
        break;
      }
      prevAbove = above; prevT = t;
      if (y < -20) break;
    }

    // Caixas (slab) e cilindros (vegetação)
    const colliders = this.vegetation.getCollidersNear(origin.x, origin.z, maxDist * 0.5 + 10);
    for (const s of this.structures.colliders) colliders.push(s);
    for (const c of colliders) {
      if (c.type === 'tree' || c.type === 'rock') {
        const d = this._rayCylinder(origin, dir, maxDist, c.x, c.z, c.r, 0, 400);
        if (d !== null && d < best.dist) {
          best.dist = d; best.kind = 'obstacle';
          best.point.copy(origin).addScaledVector(dir, d);
        }
      } else if (c.type === 'box') {
        const d = this._rayBox(origin, dir, maxDist, c);
        if (d !== null && d < best.dist) {
          best.dist = d; best.kind = 'obstacle';
          best.point.copy(origin).addScaledVector(dir, d);
        }
      }
    }

    // Entidades (cilindros verticais)
    if (checkEntities) {
      for (const e of this.entities) {
        if (!e.alive || e === ignoreEntity) continue;
        const dx = origin.x - e.pos.x, dz = origin.z - e.pos.z;
        const maxR = Math.hypot(dx, dz) + e.radius + maxDist;
        if (maxR > maxDist * 2) continue;
        const d = this._rayCylinder(origin, dir, maxDist, e.pos.x, e.pos.z, e.radius, e.pos.y, e.pos.y + e.height);
        if (d !== null && d < best.dist) {
          best.dist = d; best.kind = 'entity'; best.entity = e;
          best.point.copy(origin).addScaledVector(dir, d);
        }
      }
    }

    if (best.kind === null) return null;
    best.distance = best.dist;
    return best;
  }

  _rayCylinder(o, d, maxDist, cx, cz, r, y0, y1) {
    const ox = o.x - cx, oz = o.z - cz;
    const a = d.x * d.x + d.z * d.z;
    if (a < 1e-8) return null;
    const b = 2 * (ox * d.x + oz * d.z);
    const c = ox * ox + oz * oz - r * r;
    const disc = b * b - 4 * a * c;
    if (disc < 0) return null;
    const sq = Math.sqrt(disc);
    let t = (-b - sq) / (2 * a);
    if (t < 0) t = (-b + sq) / (2 * a);
    if (t < 0 || t > maxDist) return null;
    const y = o.y + d.y * t;
    if (y < y0 || y > y1) return null;
    return t;
  }

  _rayBox(o, d, maxDist, c) {
    let tmin = 0, tmax = maxDist;
    const axes = [
      [o.x, d.x, c.minX, c.maxX],
      [o.y, d.y, c.y0, c.y1],
      [o.z, d.z, c.minZ, c.maxZ],
    ];
    for (const [oo, dd, lo, hi] of axes) {
      if (Math.abs(dd) < 1e-8) {
        if (oo < lo || oo > hi) return null;
      } else {
        let t1 = (lo - oo) / dd, t2 = (hi - oo) / dd;
        if (t1 > t2) { const tmp = t1; t1 = t2; t2 = tmp; }
        tmin = Math.max(tmin, t1);
        tmax = Math.min(tmax, t2);
        if (tmin > tmax) return null;
      }
    }
    if (tmin < 0 || tmin > maxDist) return null;
    return tmin;
  }

  lineOfSight(from, to) {
    _v1.copy(to).sub(from);
    const dist = _v1.length();
    if (dist < 0.01) return true;
    _v1.divideScalar(dist);
    const hit = this.raycast(from, _v1, dist - 0.5, null, false);
    return hit === null;
  }

  // Evento de ruído (tiro, passos) — consumido por animais e NPCs
  noiseEvent(x, z, radius, source = 'generic') {
    for (const e of this.entities) {
      if (e.alive && e.onNoise) e.onNoise(x, z, radius, source);
    }
  }

  update(dt, playerPos, audio) {
    this.sky.update(dt, playerPos.x, playerPos.z, this.weather);
    this.weather.update(dt, playerPos.x, playerPos.z, this.sky, audio);
    this.terrain.update(playerPos.x, playerPos.z);
    this.vegetation.update(playerPos.x, playerPos.z, this.sky.time);
    this.water.update(playerPos.x, playerPos.z, this.sky.time, this.sky.sunDir, this.sky.horizonColor);
    this.structures.update(dt, playerPos.x, playerPos.z, this.sky.isNight, this.q);
  }
}
