// Estruturas: vilarejos, base militar, torres, acampamentos, cachoeira
import * as THREE from 'three';
import { terrainHeight, FLAT_SITES, POI } from './heightfield.js';
import { rng } from '../core/utils.js';

const MAT = {
  wall: new THREE.MeshStandardMaterial({ color: 0x9a8f7d, roughness: 0.9 }),
  wall2: new THREE.MeshStandardMaterial({ color: 0x7d7468, roughness: 0.9 }),
  wood: new THREE.MeshStandardMaterial({ color: 0x6b4f2f, roughness: 0.85 }),
  woodDark: new THREE.MeshStandardMaterial({ color: 0x4a3823, roughness: 0.9 }),
  roof: new THREE.MeshStandardMaterial({ color: 0x7a3b2c, roughness: 0.8 }),
  metal: new THREE.MeshStandardMaterial({ color: 0x5a6068, roughness: 0.5, metalness: 0.6 }),
  metalDark: new THREE.MeshStandardMaterial({ color: 0x3c4046, roughness: 0.55, metalness: 0.6 }),
  concrete: new THREE.MeshStandardMaterial({ color: 0x8a8a84, roughness: 0.95 }),
  canvas: new THREE.MeshStandardMaterial({ color: 0x5f6b4a, roughness: 0.95, side: THREE.DoubleSide }),
  door: new THREE.MeshStandardMaterial({ color: 0x3a2c1c, roughness: 0.9 }),
  glass: new THREE.MeshStandardMaterial({ color: 0x223344, roughness: 0.2, metalness: 0.4 }),
  flame: new THREE.MeshBasicMaterial({ color: 0xff8830 }),
  water: new THREE.MeshBasicMaterial({ color: 0xbfe0ee, transparent: true, opacity: 0.75 }),
};

function box(w, h, d, mat, x, y, z, ry = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  m.rotation.y = ry;
  m.castShadow = true; m.receiveShadow = true;
  return m;
}

function prismRoof(w, d, h, mat, x, y, z, ry = 0) {
  const geo = new THREE.CylinderGeometry(0.01, Math.min(w, d) * 0.72, h, 3, 1);
  const m = new THREE.Mesh(geo, mat);
  m.scale.set(Math.max(w, d) / Math.min(w, d), 1, 1);
  m.position.set(x, y, z);
  m.rotation.y = ry;
  m.castShadow = true;
  return m;
}

function house(g, colliders, x, z, ry, rand) {
  const w = 6.5 + rand() * 2, d = 8 + rand() * 3, h = 3 + rand() * 0.6;
  const y = terrainHeight(x, z);
  const wallMat = rand() < 0.5 ? MAT.wall : MAT.wall2;
  g.add(box(w, h, d, wallMat, x, y + h / 2, z, ry));
  g.add(prismRoof(w + 1.2, d + 1.2, 2.4 + rand(), MAT.roof, x, y + h + 1.2, z, ry));
  // porta e janelas
  const dx = Math.cos(ry) * (d / 2 + 0.05), dz = -Math.sin(ry) * (d / 2 + 0.05);
  g.add(box(1.1, 2.1, 0.12, MAT.door, x + dx, y + 1.05, z + dz, ry));
  g.add(box(1.0, 0.9, 0.1, MAT.glass, x + Math.cos(ry) * (d / 2 + 0.06) + 2, y + 1.8, z - Math.sin(ry) * (d / 2 + 0.06) + 2, ry));
  colliders.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2, y0: y, y1: y + h, type: 'box' });
  return { x, z, y };
}

function watchTower(g, colliders, interactables, x, z) {
  const y = terrainHeight(x, z);
  for (const [lx, lz] of [[-1.2, -1.2], [1.2, -1.2], [-1.2, 1.2], [1.2, 1.2]]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.18, 6.4, 6), MAT.woodDark);
    leg.position.set(x + lx, y + 3.2, z + lz);
    leg.castShadow = true;
    g.add(leg);
  }
  g.add(box(3.4, 0.25, 3.4, MAT.wood, x, y + 6.4, z));
  g.add(box(3.4, 0.9, 0.12, MAT.wood, x, y + 7.1, z - 1.65));
  g.add(box(3.4, 0.9, 0.12, MAT.wood, x, y + 7.1, z + 1.65));
  g.add(box(0.12, 0.9, 3.4, MAT.wood, x - 1.65, y + 7.1, z));
  g.add(box(0.12, 0.9, 3.4, MAT.wood, x + 1.65, y + 7.1, z));
  g.add(prismRoof(4.4, 4.4, 1.4, MAT.woodDark, x, y + 8.4, z));
  // escada
  const ladder = box(0.7, 6.4, 0.1, MAT.woodDark, x, y + 3.2, z + 1.85);
  g.add(ladder);
  colliders.push({ minX: x - 1.6, maxX: x + 1.6, minZ: z - 1.6, maxZ: z + 1.6, y0: y, y1: y + 6.4, type: 'box' });
  interactables.push({ x, z, y: y + 0.5, type: 'ladderUp', topY: y + 6.6, label: 'Subir na torre' });
  interactables.push({ x, z, y: y + 6.6, type: 'ladderDown', topY: y + 0.5, label: 'Descer da torre' });
  return { x, z, y: y + 6.6 };
}

function campfire(g, lights, x, z) {
  const y = terrainHeight(x, z);
  for (let i = 0; i < 4; i++) {
    const log = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 1.0, 5), MAT.woodDark);
    log.position.set(x, y + 0.15, z);
    log.rotation.set(Math.PI / 2.4, (i * Math.PI) / 2, 0);
    g.add(log);
  }
  const flame = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.7, 6), MAT.flame);
  flame.position.set(x, y + 0.5, z);
  g.add(flame);
  const light = new THREE.PointLight(0xff7733, 2.2, 16, 2);
  light.position.set(x, y + 1.1, z);
  lights.push({ light, flame, baseY: y });
}

function tent(g, colliders, x, z, ry) {
  const y = terrainHeight(x, z);
  const t = prismRoof(2.6, 3.6, 1.9, MAT.canvas, x, y + 0.95, z, ry);
  g.add(t);
  colliders.push({ minX: x - 1.3, maxX: x + 1.3, minZ: z - 1.8, maxZ: z + 1.8, y0: y, y1: y + 1.9, type: 'box' });
}

function crate(g, colliders, x, z, s, ry) {
  const y = terrainHeight(x, z);
  g.add(box(s, s, s, MAT.wood, x, y + s / 2, z, ry));
  if (s > 0.9) colliders.push({ minX: x - s / 2, maxX: x + s / 2, minZ: z - s / 2, maxZ: z + s / 2, y0: y, y1: y + s, type: 'box' });
}

export class Structures {
  constructor(scene, quality) {
    this.scene = scene;
    this.group = new THREE.Group();
    scene.add(this.group);
    this.colliders = [];
    this.interactables = [];
    this.lights = [];
    this.npcSpawns = [];
    this.fireflies = null;

    const sites = Object.fromEntries(FLAT_SITES.map(s => [s.name, s]));

    // Vilarejos
    this._village(sites.village_west, 7, 1331);
    this._village(sites.village_east, 6, 7717);
    this._village(sites.village_south, 4, 5153);

    // Base militar
    this._base(sites.base_military);

    // Acampamentos
    this._camp(sites.camp_north, 4241, true);
    this._camp(sites.camp_south, 8663, false);

    // Torres isoladas
    watchTower(this.group, this.colliders, this.interactables, sites.tower_east.x, sites.tower_east.z);
    watchTower(this.group, this.colliders, this.interactables, sites.tower_west.x, sites.tower_west.z);

    // Cachoeira
    this._waterfall(POI.waterfall);
  }

  _village(site, count, seed) {
    const rand = rng(seed);
    const cx = site.x, cz = site.z, r = site.r * 0.62;
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2 + rand() * 0.5;
      const d = r * (0.45 + rand() * 0.5);
      const x = cx + Math.cos(a) * d, z = cz + Math.sin(a) * d;
      house(this.group, this.colliders, x, z, rand() * Math.PI * 2, rand);
    }
    // poço central
    const well = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.2, 1.0, 10), MAT.concrete);
    well.position.set(cx, terrainHeight(cx, cz) + 0.5, cz);
    well.castShadow = true;
    this.group.add(well);
    this.colliders.push({ minX: cx - 1.2, maxX: cx + 1.2, minZ: cz - 1.2, maxZ: cz + 1.2, y0: terrainHeight(cx, cz), y1: terrainHeight(cx, cz) + 1, type: 'box' });
    for (let i = 0; i < 3; i++) {
      crate(this.group, this.colliders, cx + (rand() - 0.5) * r, cz + (rand() - 0.5) * r, 0.8 + rand() * 0.5, rand() * Math.PI);
    }
  }

  _base(site) {
    const cx = site.x, cz = site.z, R = 62;
    const y = terrainHeight(cx, cz);
    // Muros perímetro
    const segs = 16;
    for (let i = 0; i < segs; i++) {
      const a = (i / segs) * Math.PI * 2;
      const wx = cx + Math.cos(a) * R, wz = cz + Math.sin(a) * R;
      if (i === 4 || i === 12) continue; // portões
      this.group.add(box(9, 3.4, 0.5, MAT.concrete, wx, y + 1.7, wz, -a));
      this.colliders.push({
        minX: wx - 4.6, maxX: wx + 4.6, minZ: wz - 4.6, maxZ: wz + 4.6,
        y0: y, y1: y + 3.4, type: 'box', thin: true,
      });
    }
    // Torres de canto
    for (const [tx, tz] of [[-R * 0.7, -R * 0.7], [R * 0.7, -R * 0.7], [-R * 0.7, R * 0.7], [R * 0.7, R * 0.7]]) {
      watchTower(this.group, this.colliders, this.interactables, cx + tx, cz + tz);
    }
    // Barracas/barracos
    for (const [bx, bz, ry] of [[-18, -10, 0.3], [16, -14, -0.5], [4, 18, 1.2]]) {
      const x = cx + bx, z = cz + bz;
      const yy = terrainHeight(x, z);
      this.group.add(box(10, 3.2, 5, MAT.metal, x, yy + 1.6, z, ry));
      this.colliders.push({ minX: x - 5.5, maxX: x + 5.5, minZ: z - 3.2, maxZ: z + 3.2, y0: yy, y1: yy + 3.2, type: 'box' });
    }
    // Caixas e postos
    const rand = rng(90210);
    for (let i = 0; i < 12; i++) {
      crate(this.group, this.colliders, cx + (rand() - 0.5) * R * 1.2, cz + (rand() - 0.5) * R * 1.2, 0.9 + rand() * 0.6, rand() * Math.PI);
    }
    // Posto de comando
    const hqx = cx - 2, hqz = cz + 2;
    this.group.add(box(7, 4.2, 7, MAT.metalDark, hqx, terrainHeight(hqx, hqz) + 2.1, hqz, 0.4));
    this.colliders.push({ minX: hqx - 4, maxX: hqx + 4, minZ: hqz - 4, maxZ: hqz + 4, y0: terrainHeight(hqx, hqz), y1: terrainHeight(hqx, hqz) + 4.2, type: 'box' });

    this.npcSpawns.push({ x: cx, z: cz, radius: R * 0.85, count: 6, id: 'base' });
  }

  _camp(site, seed, hostile) {
    const rand = rng(seed);
    const cx = site.x, cz = site.z, r = site.r * 0.5;
    campfire(this.group, this.lights, cx, cz);
    for (let i = 0; i < 3; i++) {
      const a = rand() * Math.PI * 2;
      tent(this.group, this.colliders, cx + Math.cos(a) * r * 0.7, cz + Math.sin(a) * r * 0.7, rand() * Math.PI * 2);
    }
    for (let i = 0; i < 3; i++) {
      crate(this.group, this.colliders, cx + (rand() - 0.5) * r, cz + (rand() - 0.5) * r, 0.7 + rand() * 0.5, rand() * Math.PI);
    }
    if (hostile) this.npcSpawns.push({ x: cx, z: cz, radius: r + 25, count: 3, id: 'camp_north' });
  }

  _waterfall(poi) {
    const x = poi.x, z = poi.z;
    const topY = terrainHeight(x, z);
    const parts = 260;
    const pos = new Float32Array(parts * 3);
    const vel = new Float32Array(parts);
    for (let i = 0; i < parts; i++) {
      pos[i * 3] = x + (Math.random() - 0.5) * 3;
      pos[i * 3 + 1] = topY + Math.random() * 24;
      pos[i * 3 + 2] = z + (Math.random() - 0.5) * 3;
      vel[i] = 9 + Math.random() * 6;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({ color: 0xd8ecf4, size: 0.32, transparent: true, opacity: 0.8, depthWrite: false });
    this.waterfall = new THREE.Points(geo, mat);
    this.waterfall.frustumCulled = false;
    this.waterfall.userData = { vel, baseX: x, baseZ: z, topY };
    this.group.add(this.waterfall);
    this.waterfallPos = { x, z, topY };
  }

  update(dt, px, pz, night, quality) {
    // Fogueiras: acesas à noite, apenas perto do jogador
    for (const f of this.lights) {
      const d = Math.hypot(f.light.position.x - px, f.light.position.z - pz);
      const near = d < 160;
      f.light.visible = near && quality.shadowMap >= 0;
      f.light.intensity = night ? 2.6 : 0.7;
      if (f.flame) f.flame.scale.setScalar(0.85 + Math.sin(performance.now() * 0.01 + f.baseY) * 0.15);
    }
    // Cachoeira
    if (this.waterfall) {
      const d = Math.hypot(px - this.waterfallPos.x, pz - this.waterfallPos.z);
      this.waterfall.visible = d < 500;
      if (this.waterfall.visible) {
        const pos = this.waterfall.geometry.attributes.position;
        const { vel, baseX, baseZ, topY } = this.waterfall.userData;
        for (let i = 0; i < vel.length; i++) {
          pos.array[i * 3 + 1] -= vel[i] * dt;
          if (pos.array[i * 3 + 1] < topY - 26) {
            pos.array[i * 3] = baseX + (Math.random() - 0.5) * 3;
            pos.array[i * 3 + 1] = topY + Math.random() * 4;
            pos.array[i * 3 + 2] = baseZ + (Math.random() - 0.5) * 3;
          }
        }
        pos.needsUpdate = true;
      }
    }
  }
}
