// Animais — modelos procedurais, IA com estados, sentidos, bandos e fuga
import * as THREE from 'three';
import { terrainHeight } from '../world/heightfield.js';
import { ANIMALS, WORLD } from '../core/config.js';
import { rng, clamp, lerp, dist2, angleDiff } from '../core/utils.js';

const SKINS = {
  deer:   { body: 0x8a6238, belly: 0xa8845a, dark: 0x5d3f22 },
  elk:    { body: 0x6e4f2e, belly: 0x8a6a44, dark: 0x4a331c },
  boar:   { body: 0x4a3b30, belly: 0x5d4c3e, dark: 0x332720 },
  wolf:   { body: 0x7a7d82, belly: 0x9ba0a6, dark: 0x4d5054 },
  fox:    { body: 0xb5622a, belly: 0xe8d5c0, dark: 0x7a3d18 },
  rabbit: { body: 0x9a8a72, belly: 0xcfc2ab, dark: 0x6e614e },
  bear:   { body: 0x3e2f22, belly: 0x54422f, dark: 0x2a1f16 },
  bird:   { body: 0x3a4a5e, belly: 0x7a8ba0, dark: 0x242e3a },
};

function limb(geo, mat, x, y, z) {
  const pivot = new THREE.Group();
  const m = new THREE.Mesh(geo, mat);
  m.position.y = -geo.parameters.height / 2;
  m.castShadow = true;
  pivot.add(m);
  pivot.position.set(x, y, z);
  return pivot;
}

export function buildAnimalModel(kind, scale = 1) {
  const skin = SKINS[kind];
  const mat = new THREE.MeshStandardMaterial({ color: skin.body, roughness: 0.9 });
  const bellyMat = new THREE.MeshStandardMaterial({ color: skin.belly, roughness: 0.9 });
  const darkMat = new THREE.MeshStandardMaterial({ color: skin.dark, roughness: 0.85 });
  const g = new THREE.Group();
  const s = ANIMALS[kind];

  if (kind === 'bird') {
    const body = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.34, 6), mat);
    body.rotation.x = Math.PI / 2;
    g.add(body);
    g.add(new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 6), darkMat));
    for (const side of [-1, 1]) {
      const wing = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.14), bellyMat);
      wing.material.side = THREE.DoubleSide;
      wing.position.set(side * 0.18, 0.02, 0);
      wing.name = side < 0 ? 'wingL' : 'wingR';
      g.add(wing);
    }
    g.scale.setScalar(scale);
    return g;
  }

  const bodyR = s.radius * 1.15;
  const bodyH = s.height * 0.42;
  const legLen = s.height * 0.42;

  // Tronco
  const body = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 8), mat);
  body.scale.set(bodyR, bodyH, bodyR * 1.7);
  body.position.y = legLen + bodyH * 0.8;
  body.castShadow = true;
  g.add(body);
  // Peito
  const chest = new THREE.Mesh(new THREE.SphereGeometry(1, 8, 6), bellyMat);
  chest.scale.set(bodyR * 0.85, bodyH * 0.7, bodyR * 0.9);
  chest.position.set(0, legLen + bodyH * 0.55, -bodyR * 1.15);
  g.add(chest);

  // Pescoço e cabeça
  const neckLen = kind === 'deer' || kind === 'elk' ? s.height * 0.42 : s.height * 0.16;
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(bodyR * 0.28, bodyR * 0.4, neckLen, 6), mat);
  neck.position.set(0, legLen + bodyH * 1.2 + neckLen * 0.4, -bodyR * 1.35);
  neck.rotation.x = kind === 'boar' || kind === 'bear' ? 0.7 : 0.45;
  g.add(neck);
  const headZ = -bodyR * 1.35 - Math.sin(neck.rotation.x) * neckLen * 0.9;
  const headY = legLen + bodyH * 1.2 + Math.cos(neck.rotation.x) * neckLen * 0.8;
  const head = new THREE.Mesh(new THREE.SphereGeometry(bodyR * 0.34, 8, 6), mat);
  head.scale.set(0.9, 0.9, 1.5);
  head.position.set(0, headY, headZ);
  head.castShadow = true;
  g.add(head);
  // Focinho
  const snout = new THREE.Mesh(new THREE.BoxGeometry(bodyR * 0.3, bodyR * 0.26, bodyR * 0.5), darkMat);
  snout.position.set(0, headY - bodyR * 0.05, headZ - bodyR * 0.5);
  g.add(snout);
  // Orelhas
  for (const side of [-1, 1]) {
    const ear = new THREE.Mesh(new THREE.ConeGeometry(bodyR * 0.12, bodyR * 0.3, 5), darkMat);
    ear.position.set(side * bodyR * 0.22, headY + bodyR * 0.3, headZ + bodyR * 0.1);
    g.add(ear);
  }
  // Chifres (veado/cervo)
  if (kind === 'deer' || kind === 'elk') {
    for (const side of [-1, 1]) {
      const a1 = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.035, s.height * 0.32, 5), darkMat);
      a1.position.set(side * bodyR * 0.16, headY + s.height * 0.18, headZ + bodyR * 0.1);
      a1.rotation.z = side * 0.5;
      g.add(a1);
      const a2 = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.025, s.height * 0.2, 5), darkMat);
      a2.position.set(side * bodyR * 0.3, headY + s.height * 0.28, headZ + bodyR * 0.05);
      a2.rotation.z = side * 1.1;
      g.add(a2);
    }
  }
  // Cauda
  const tail = new THREE.Mesh(new THREE.ConeGeometry(bodyR * 0.16, bodyR * 0.6, 5), darkMat);
  tail.position.set(0, legLen + bodyH * 1.0, bodyR * 1.6);
  tail.rotation.x = -0.9;
  g.add(tail);

  // Pernas
  const legs = [];
  const legGeo = new THREE.CylinderGeometry(bodyR * 0.11, bodyR * 0.09, legLen, 5);
  for (const [lx, lz] of [[-bodyR * 0.6, -bodyR * 1.0], [bodyR * 0.6, -bodyR * 1.0], [-bodyR * 0.6, bodyR * 1.0], [bodyR * 0.6, bodyR * 1.0]]) {
    const leg = limb(legGeo, darkMat, lx, legLen, lz);
    leg.name = 'leg';
    g.add(leg);
    legs.push(leg);
  }

  g.userData.legs = legs;
  g.userData.bodyMesh = body;
  g.scale.setScalar(scale);
  return g;
}

let NEXT_ID = 1;

export class Animal {
  constructor(kind, x, z, world, audio) {
    this.id = NEXT_ID++;
    this.kind = kind;
    this.def = ANIMALS[kind];
    this.world = world;
    this.audio = audio;
    this.hp = this.def.hp;
    this.alive = true;
    this.faction = 'animal';
    this.hostile = !!this.def.hostile;
    this.state = 'idle';
    this.stateTimer = Math.random() * 4;
    this.heading = Math.random() * Math.PI * 2;
    this.speed = 0;
    this.targetX = x; this.targetZ = z;
    this.threatX = 0; this.threatZ = 0;
    this.alertness = 0;
    this.legPhase = Math.random() * 6;
    this.callTimer = 4 + Math.random() * 14;
    this.deadTimer = 0;
    this.fleeTime = 0;
    this.charge = false;
    this.attackCooldown = 0;

    this.group = buildAnimalModel(kind, 1);
    this.pos = this.group.position;
    this.pos.set(x, terrainHeight(x, z), z);
    this.group.rotation.y = this.heading;

    this.entity = {
      pos: this.pos, radius: this.def.radius, height: this.def.height,
      alive: true, faction: 'animal', ref: this, isPlayer: false,
      takeDamage: (dmg, point, headshot) => this.takeDamage(dmg, point, headshot),
      onNoise: (nx, nz, radius, source) => this.onNoise(nx, nz, radius, source),
    };
    world.addEntity(this.entity);
    world.scene.add(this.group);
  }

  takeDamage(dmg, point, headshot) {
    if (!this.alive) return;
    this.hp -= dmg;
    this.alertness = 1;
    this.threatX = point.x; this.threatZ = point.z;
    if (this.hp <= 0) {
      this.alive = false;
      this.entity.alive = false;
      this.state = 'dead';
      this.audio.animalDeath(this.kind, this.pos);
    } else {
      this._flee(point.x, point.z);
    }
  }

  onNoise(nx, nz, radius, source) {
    if (!this.alive) return;
    const d = Math.sqrt(dist2(this.pos.x, this.pos.z, nx, nz));
    if (d > radius) return;
    if (source === 'gunshot') {
      this.alertness = 1;
      this._flee(nx, nz);
    } else if (d < radius) {
      this.alertness = Math.max(this.alertness, 0.7);
      this.state = 'alert';
      this.stateTimer = 3;
      this.threatX = nx; this.threatZ = nz;
    }
  }

  _flee(fx, fz) {
    this.state = 'flee';
    this.fleeTime = 7 + Math.random() * 6;
    this.threatX = fx; this.threatZ = fz;
    if (this.audio) this.audio.animalCall(this.kind, this.pos, true);
  }

  update(dt, player, playerStealth) {
    if (!this.alive) {
      this.deadTimer += dt;
      this.group.rotation.z = Math.min(this.deadTimer * 3, Math.PI / 2);
      this.group.position.y = terrainHeight(this.pos.x, this.pos.z) + Math.max(0, 0.3 - this.deadTimer * 0.3);
      return;
    }
    this.stateTimer -= dt;
    this.callTimer -= dt;
    this.attackCooldown = Math.max(0, this.attackCooldown - dt);

    const pd = Math.sqrt(dist2(this.pos.x, this.pos.z, player.pos.x, player.pos.z));

    if (this.callTimer <= 0) {
      this.callTimer = 8 + Math.random() * 20;
      if (pd < 220) this.audio.animalCall(this.kind, this.pos, false);
    }

    if (this.def.flying) { this._updateBird(dt, player, pd); return; }

    // Detecção visual
    const sightRange = this.def.sight * playerStealth;
    if (pd < sightRange && this.state !== 'flee') {
      this.alertness = clamp(this.alertness + (1 - pd / sightRange) * dt * 2.5, 0, 1);
      if (this.alertness > 0.55) {
        if (this.hostile && pd < 45) {
          this.state = 'charge';
        } else if (this.alertness > 0.85 || pd < sightRange * 0.35) {
          this._flee(player.pos.x, player.pos.z);
        } else {
          this.state = 'alert';
          this.stateTimer = Math.max(this.stateTimer, 1.5);
          this.threatX = player.pos.x; this.threatZ = player.pos.z;
        }
      }
    } else {
      this.alertness = Math.max(0, this.alertness - dt * 0.25);
    }

    let speed = 0;
    switch (this.state) {
      case 'idle':
        speed = 0;
        if (this.stateTimer <= 0) { this._pickState(pd); }
        break;
      case 'graze':
        speed = this.def.walk * 0.3;
        if (this.stateTimer <= 0) this._pickState(pd);
        break;
      case 'wander':
        speed = this.def.walk;
        if (this._reachTarget(2)) this._pickState(pd);
        break;
      case 'drink':
        speed = this.stateTimer > 2 ? this.def.walk : 0;
        if (this.stateTimer <= 0) this._pickState(pd);
        break;
      case 'alert':
        speed = 0;
        this._faceTo(this.threatX, this.threatZ, dt, 3);
        if (this.stateTimer <= 0) this._pickState(pd);
        break;
      case 'flee':
        speed = this.def.run;
        this.fleeTime -= dt;
        this._faceAway(this.threatX, this.threatZ, dt);
        this._zigzag(dt);
        if (this.fleeTime <= 0) { this.state = 'alert'; this.stateTimer = 2; }
        break;
      case 'charge':
        speed = this.def.run;
        this._faceTo(player.pos.x, player.pos.z, dt, 6);
        if (pd < 1.6 && this.attackCooldown <= 0) {
          this.attackCooldown = 1.6;
          player.damage(this.kind === 'bear' ? 34 : 16, this.pos.x, this.pos.z);
          this.audio.animalCall(this.kind, this.pos, true);
        }
        if (pd > 70) { this.state = 'wander'; }
        break;
    }

    this._move(dt, speed);
    this._animate(dt, speed);
  }

  _pickState(pd) {
    const r = Math.random();
    this.stateTimer = 3 + Math.random() * 6;
    if (r < 0.3) { this.state = 'idle'; }
    else if (r < 0.6) { this.state = 'graze'; }
    else {
      this.state = 'wander';
      const a = Math.random() * Math.PI * 2;
      const d = 15 + Math.random() * 40;
      this.targetX = this.pos.x + Math.cos(a) * d;
      this.targetZ = this.pos.z + Math.sin(a) * d;
    }
    // Beber se perto da água
    const h = terrainHeight(this.pos.x, this.pos.z);
    if (h < 2.5 && r > 0.8) { this.state = 'drink'; this.stateTimer = 6; }
  }

  _reachTarget(radius) {
    return dist2(this.pos.x, this.pos.z, this.targetX, this.targetZ) < radius * radius;
  }

  _faceTo(x, z, dt, rate) {
    const want = Math.atan2(-(x - this.pos.x), -(z - this.pos.z));
    this.heading += clamp(angleDiff(this.heading, want), -rate * dt, rate * dt);
  }
  _faceAway(x, z, dt) {
    const want = Math.atan2((x - this.pos.x), (z - this.pos.z));
    this.heading += clamp(angleDiff(this.heading, want), -5 * dt, 5 * dt);
  }
  _zigzag(dt) {
    this.heading += Math.sin(this.legPhase * 0.7) * dt * 0.8;
  }

  _move(dt, speed) {
    this.speed = lerp(this.speed, speed, 1 - Math.exp(-4 * dt));
    if (this.state === 'wander' || this.state === 'graze') {
      this._faceTo(this.targetX, this.targetZ, dt, 2);
    }
    const nx = this.pos.x - Math.sin(this.heading) * this.speed * dt;
    const nz = this.pos.z - Math.cos(this.heading) * this.speed * dt;
    const nh = terrainHeight(nx, nz);
    // Evita água profunda e limites do mundo
    if (nh > (this.state === 'drink' ? -1.2 : 0.4) && Math.abs(nx) < WORLD.HALF - 10 && Math.abs(nz) < WORLD.HALF - 10) {
      this.pos.x = nx; this.pos.z = nz;
    } else {
      this.heading += 2.2 * dt;
    }
    this.pos.y = terrainHeight(this.pos.x, this.pos.z);
    this.group.rotation.y = this.heading;
  }

  _animate(dt, speed) {
    this.legPhase += dt * (2 + speed * 1.6);
    const legs = this.group.userData.legs;
    if (legs) {
      const amp = speed > 0.1 ? clamp(speed * 0.12, 0.08, 0.6) : 0;
      for (let i = 0; i < legs.length; i++) {
        legs[i].rotation.x = Math.sin(this.legPhase + (i % 2 === 0 ? 0 : Math.PI) + (i < 2 ? 0 : Math.PI * 0.5)) * amp;
      }
    }
  }

  _updateBird(dt, player, pd) {
    this.legPhase += dt * 10;
    if (pd < 45 && this.state !== 'scatter') {
      this.state = 'scatter';
      this.stateTimer = 12;
      this.audio.animalCall('bird', this.pos, true);
    }
    let speed;
    if (this.state === 'scatter') {
      speed = this.def.run;
      this.stateTimer -= dt;
      if (this.stateTimer <= 0) this.state = 'idle';
    } else {
      speed = 4;
      this.stateTimer -= dt;
      if (this.stateTimer <= 0) {
        this.stateTimer = 6 + Math.random() * 8;
        this.targetX = this.pos.x + (Math.random() - 0.5) * 120;
        this.targetZ = this.pos.z + (Math.random() - 0.5) * 120;
      }
      this._faceTo(this.targetX, this.targetZ, dt, 1.5);
    }
    const nx = this.pos.x - Math.sin(this.heading) * speed * dt;
    const nz = this.pos.z - Math.cos(this.heading) * speed * dt;
    if (Math.abs(nx) < WORLD.HALF && Math.abs(nz) < WORLD.HALF) { this.pos.x = nx; this.pos.z = nz; }
    const ground = terrainHeight(this.pos.x, this.pos.z);
    const wantY = this.state === 'scatter' ? ground + 16 + Math.sin(this.legPhase * 0.3) * 3 : ground + 3 + Math.sin(this.legPhase * 0.5) * 1.5;
    this.pos.y = lerp(this.pos.y, wantY, 1 - Math.exp(-2 * dt));
    const wl = this.group.children[1], wr = this.group.children[2];
    if (wl) {
      const flap = Math.sin(this.legPhase * 2.2) * 0.7;
      wl.rotation.z = flap; wr.rotation.z = -flap;
    }
  }

  dispose(world) {
    world.removeEntity(this.entity);
    world.scene.remove(this.group);
    this.group.traverse(o => { if (o.geometry) o.geometry.dispose(); });
  }
}

// Gerenciador de população — spawn por bandos perto do jogador
export class AnimalManager {
  constructor(world, audio) {
    this.world = world;
    this.audio = audio;
    this.animals = [];
    this.spawnTimer = 2;
    this.maxActive = 34;
  }

  update(dt, player, playerStealth) {
    for (let i = this.animals.length - 1; i >= 0; i--) {
      const a = this.animals[i];
      const d = Math.sqrt(dist2(a.pos.x, a.pos.z, player.pos.x, player.pos.z));
      const dead = !a.alive && a.deadTimer > 25;
      if (d > 650 || dead) {
        a.dispose(this.world);
        this.animals.splice(i, 1);
        continue;
      }
      if (d < 450) a.update(dt, player, playerStealth);
    }

    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.spawnTimer = 3;
      if (this.animals.length < this.maxActive) this._trySpawnHerd(player);
    }
  }

  _trySpawnHerd(player) {
    const rand = rng((Math.random() * 1e9) | 0);
    const kinds = ['deer', 'elk', 'boar', 'wolf', 'fox', 'rabbit', 'bear', 'bird'];
    const kind = kinds[Math.floor(rand() * kinds.length)];
    const def = ANIMALS[kind];
    for (let attempt = 0; attempt < 8; attempt++) {
      const a = rand() * Math.PI * 2;
      const d = 160 + rand() * 160;
      const x = player.pos.x + Math.cos(a) * d;
      const z = player.pos.z + Math.sin(a) * d;
      if (Math.abs(x) > WORLD.HALF - 30 || Math.abs(z) > WORLD.HALF - 30) continue;
      const h = terrainHeight(x, z);
      if (h < 1.5 || h > 55) continue;
      const herdSize = Math.max(1, Math.round(def.herd * (0.6 + rand() * 0.8)));
      if (this.animals.length + herdSize > this.maxActive) return;
      for (let i = 0; i < herdSize; i++) {
        const ox = x + (rand() - 0.5) * 14, oz = z + (rand() - 0.5) * 14;
        this.animals.push(new Animal(kind, ox, oz, this.world, this.audio));
      }
      return;
    }
  }

  countAlive(kind) {
    let n = 0;
    for (const a of this.animals) if (a.alive && a.kind === kind) n++;
    return n;
  }

  clear() {
    for (const a of this.animals) a.dispose(this.world);
    this.animals.length = 0;
  }
}
