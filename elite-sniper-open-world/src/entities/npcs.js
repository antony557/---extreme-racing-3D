// NPCs hostis — patrulha, investigação de ruídos, cobertura, combate em grupo
import * as THREE from 'three';
import { terrainHeight } from '../world/heightfield.js';
import { NPC } from '../core/config.js';
import { rng, clamp, lerp, dist2, angleDiff } from '../core/utils.js';

const MAT = {
  uniform: new THREE.MeshStandardMaterial({ color: 0x4a5240, roughness: 0.85 }),
  vest: new THREE.MeshStandardMaterial({ color: 0x2e3328, roughness: 0.8 }),
  skin: new THREE.MeshStandardMaterial({ color: 0xb08a68, roughness: 0.7 }),
  helmet: new THREE.MeshStandardMaterial({ color: 0x3a4032, roughness: 0.6, metalness: 0.3 }),
  rifle: new THREE.MeshStandardMaterial({ color: 0x22262a, roughness: 0.5, metalness: 0.6 }),
  flashMat: new THREE.MeshBasicMaterial({ color: 0xffcc66 }),
};

function buildSoldier() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.62, 0.3), MAT.uniform);
  body.position.y = 1.12;
  body.castShadow = true;
  g.add(body);
  const vest = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.4, 0.36), MAT.vest);
  vest.position.y = 1.16;
  g.add(vest);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 8), MAT.skin);
  head.position.y = 1.58;
  g.add(head);
  const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2), MAT.helmet);
  helmet.position.y = 1.6;
  g.add(helmet);
  const legs = [];
  for (const side of [-1, 1]) {
    const pivot = new THREE.Group();
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.07, 0.82, 6), MAT.uniform);
    leg.position.y = -0.41;
    leg.castShadow = true;
    pivot.add(leg);
    pivot.position.set(side * 0.14, 0.82, 0);
    g.add(pivot);
    legs.push(pivot);
  }
  const arms = [];
  for (const side of [-1, 1]) {
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.055, 0.6, 6), MAT.uniform);
    arm.position.set(side * 0.32, 1.2, -0.1);
    arm.rotation.x = -0.9;
    g.add(arm);
    arms.push(arm);
  }
  const rifle = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.1, 0.9), MAT.rifle);
  rifle.position.set(0.1, 1.22, -0.42);
  g.add(rifle);
  const muzzle = new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 6), MAT.flashMat);
  muzzle.position.set(0.1, 1.22, -0.95);
  muzzle.visible = false;
  g.add(muzzle);
  g.userData = { legs, muzzle, rifle };
  return g;
}

let NEXT_NPC = 1;

export class Npc {
  constructor(x, z, world, audio, difficulty, homeRadius) {
    this.id = NEXT_NPC++;
    this.world = world;
    this.audio = audio;
    this.difficulty = difficulty;
    this.hp = NPC.hp * (1 + difficulty * 0.25);
    this.alive = true;
    this.faction = 'npc';
    this.state = 'patrol';
    this.stateTimer = 0;
    this.heading = Math.random() * Math.PI * 2;
    this.speed = 0;
    this.homeX = x; this.homeZ = z;
    this.homeRadius = homeRadius;
    this.wpX = x; this.wpZ = z;
    this.lastKnownX = 0; this.lastKnownZ = 0;
    this.detectTimer = 0;
    this.lostTimer = 0;
    this.fireTimer = 1 + Math.random();
    this.burst = 0;
    this.deadTimer = 0;
    this.legPhase = Math.random() * 6;
    this.crouching = false;
    this.coverX = 0; this.coverZ = 0;
    this.alertLevel = 0;

    this.group = buildSoldier();
    this.pos = this.group.position;
    this.pos.set(x, terrainHeight(x, z), z);

    this.entity = {
      pos: this.pos, radius: 0.42, height: 1.75,
      alive: true, faction: 'npc', ref: this, isPlayer: false,
      takeDamage: (dmg, point, headshot) => this.takeDamage(dmg, point, headshot),
      onNoise: (nx, nz, radius, source) => this.onNoise(nx, nz, radius, source),
    };
    world.addEntity(this.entity);
    world.scene.add(this.group);
    this._pickWaypoint();
  }

  takeDamage(dmg, point, headshot) {
    if (!this.alive) return;
    this.hp -= dmg;
    this.alertLevel = 1;
    this.lastKnownX = point.x; this.lastKnownZ = point.z;
    if (this.hp <= 0) {
      this.alive = false;
      this.entity.alive = false;
      this.state = 'dead';
      this.audio.npcDeath(this.pos);
    } else {
      this.state = 'combat';
      this.lostTimer = 0;
      this.audio.npcShout(this.pos);
    }
  }

  onNoise(nx, nz, radius, source) {
    if (!this.alive || this.state === 'combat') return;
    const d = Math.sqrt(dist2(this.pos.x, this.pos.z, nx, nz));
    if (d > radius) return;
    this.lastKnownX = nx; this.lastKnownZ = nz;
    if (source === 'gunshot') {
      this.state = 'combat';
      this.lostTimer = 0;
      this.alertLevel = 1;
    } else if (this.state === 'patrol') {
      this.state = 'suspect';
      this.stateTimer = 12;
      this.audio.npcShout(this.pos);
    }
  }

  _pickWaypoint() {
    const a = Math.random() * Math.PI * 2;
    const d = Math.random() * this.homeRadius;
    this.wpX = this.homeX + Math.cos(a) * d;
    this.wpZ = this.homeZ + Math.sin(a) * d;
  }

  _canSeePlayer(player) {
    const pd = Math.sqrt(dist2(this.pos.x, this.pos.z, player.pos.x, player.pos.z));
    if (pd > NPC.sight * (1 - this.alertLevel * 0.1)) return false;
    // FOV ~ 120º
    const toPlayer = Math.atan2(player.pos.x - this.pos.x, player.pos.z - this.pos.z);
    if (Math.abs(angleDiff(this.heading, toPlayer)) > 1.1 && pd > 8) return false;
    const eye = _e1.set(this.pos.x, this.pos.y + 1.55, this.pos.z);
    const pe = _e2.set(player.pos.x, player.pos.y + player.eyeHeight * 0.9, player.pos.z);
    return this.world.lineOfSight(eye, pe);
  }

  update(dt, player, ballistics, hooks) {
    if (!this.alive) {
      this.deadTimer += dt;
      this.group.rotation.x = Math.min(this.deadTimer * 4, Math.PI / 2);
      this.pos.y = terrainHeight(this.pos.x, this.pos.z) + Math.max(0, 0.25 - this.deadTimer * 0.5);
      return;
    }

    const pd = Math.sqrt(dist2(this.pos.x, this.pos.z, player.pos.x, player.pos.z));
    const sees = player.alive && this._canSeePlayer(player);

    if (sees) {
      this.lastKnownX = player.pos.x; this.lastKnownZ = player.pos.z;
      this.detectTimer += dt * (pd < 30 ? 4 : 1.4);
      if (this.detectTimer > 1 || this.state === 'combat') {
        if (this.state !== 'combat') { this.state = 'combat'; this.audio.npcShout(this.pos); }
        this.lostTimer = 0;
      }
    } else {
      this.detectTimer = Math.max(0, this.detectTimer - dt);
      if (this.state === 'combat') this.lostTimer += dt;
    }

    let speed = 0;
    switch (this.state) {
      case 'patrol': {
        speed = NPC.walk;
        if (dist2(this.pos.x, this.pos.z, this.wpX, this.wpZ) < 4) {
          if (Math.random() < 0.4) { this.state = 'idle'; this.stateTimer = 2 + Math.random() * 4; }
          else this._pickWaypoint();
        }
        this._faceTo(this.wpX, this.wpZ, dt, 2.5);
        break;
      }
      case 'idle':
        speed = 0;
        this.stateTimer -= dt;
        if (this.stateTimer <= 0) { this.state = 'patrol'; this._pickWaypoint(); }
        break;
      case 'suspect': {
        this.stateTimer -= dt;
        speed = NPC.walk * 1.4;
        this._faceTo(this.lastKnownX, this.lastKnownZ, dt, 3);
        if (dist2(this.pos.x, this.pos.z, this.lastKnownX, this.lastKnownZ) < 9 || this.stateTimer <= 0) {
          this.state = 'patrol';
          this._pickWaypoint();
        }
        break;
      }
      case 'combat': {
        this._faceTo(player.alive ? player.pos.x : this.lastKnownX, player.alive ? player.pos.z : this.lastKnownZ, dt, 7);
        if (this.lostTimer > 7) {
          this.state = 'suspect';
          this.stateTimer = 14;
          this.crouching = false;
          break;
        }
        // Busca cobertura se sob fogo e longe
        if (pd > 25 && Math.random() < dt * 0.4) this._seekCover(player);
        const inCover = this.coverX !== 0;
        const distToCover = inCover ? Math.sqrt(dist2(this.pos.x, this.pos.z, this.coverX, this.coverZ)) : 1e9;
        if (inCover && distToCover > 1.5) {
          speed = NPC.run;
          this._faceTo(this.coverX, this.coverZ, dt, 4);
        } else {
          speed = 0;
          this.crouching = pd > 40;
          // Dispara rajadas
          this.fireTimer -= dt;
          if (sees && this.fireTimer <= 0 && pd < NPC.sight) {
            this._shoot(player, ballistics, hooks, pd);
            this.burst++;
            if (this.burst >= 3) { this.burst = 0; this.fireTimer = NPC.fireRate[this.difficulty] * 2.2; }
            else this.fireTimer = 0.14;
          }
        }
        break;
      }
    }

    // Movimento
    this.speed = lerp(this.speed, speed, 1 - Math.exp(-6 * dt));
    if (this.speed > 0.05) {
      const nx = this.pos.x + Math.sin(this.heading) * this.speed * dt;
      const nz = this.pos.z + Math.cos(this.heading) * this.speed * dt;
      const nh = terrainHeight(nx, nz);
      if (nh > 0.3) { this.pos.x = nx; this.pos.z = nz; }
      else this._pickWaypoint();
    }
    this.pos.y = terrainHeight(this.pos.x, this.pos.z);
    this.group.rotation.y = this.heading;
    this.group.scale.y = lerp(this.group.scale.y, this.crouching ? 0.72 : 1, 1 - Math.exp(-8 * dt));

    // Animação das pernas
    this.legPhase += dt * (2 + this.speed * 2.2);
    const legs = this.group.userData.legs;
    const amp = this.speed > 0.1 ? clamp(this.speed * 0.14, 0.05, 0.55) : 0;
    legs[0].rotation.x = Math.sin(this.legPhase) * amp;
    legs[1].rotation.x = Math.sin(this.legPhase + Math.PI) * amp;

    // Muzzle flash
    const mz = this.group.userData.muzzle;
    if (mz.visible) { mz.visible = false; }
  }

  _seekCover(player) {
    const colliders = this.world.structures.colliders;
    let best = null, bestScore = 1e9;
    for (const c of colliders) {
      const cx = (c.minX + c.maxX) / 2, cz = (c.minZ + c.maxZ) / 2;
      const d = Math.sqrt(dist2(this.pos.x, this.pos.z, cx, cz));
      if (d > 30 || c.y1 - c.y0 < 1.2) continue;
      // ponto atrás da cobertura em relação ao jogador
      const dx = cx - player.pos.x, dz = cz - player.pos.z;
      const len = Math.hypot(dx, dz) || 1;
      const px = cx + (dx / len) * 2.2, pz = cz + (dz / len) * 2.2;
      const score = d + Math.sqrt(dist2(px, pz, player.pos.x, player.pos.z)) * 0.1;
      if (score < bestScore) { bestScore = score; best = { x: px, z: pz }; }
    }
    if (best) { this.coverX = best.x; this.coverZ = best.z; }
  }

  _shoot(player, ballistics, hooks, pd) {
    const mz = this.group.userData.muzzle;
    mz.visible = true;
    this.audio.npcShot(this.pos, pd);
    const origin = _e1.set(this.pos.x, this.pos.y + 1.3, this.pos.z);
    const target = _e2.set(player.pos.x, player.pos.y + player.eyeHeight * 0.8, player.pos.z);
    const dir = target.sub(origin).normalize();
    const acc = NPC.accuracy[this.difficulty];
    dir.x += (Math.random() - 0.5) * acc * 2;
    dir.y += (Math.random() - 0.5) * acc;
    dir.z += (Math.random() - 0.5) * acc * 2;
    dir.normalize();
    const weapon = { damage: NPC.damage[this.difficulty], muzzleVelocity: 780, id: 'npc' };
    ballistics.fire(origin, dir, weapon, this.entity, null);
  }

  _faceTo(x, z, dt, rate) {
    const want = Math.atan2(x - this.pos.x, z - this.pos.z);
    this.heading += clamp(angleDiff(this.heading, want), -rate * dt, rate * dt);
  }

  dispose(world) {
    world.removeEntity(this.entity);
    world.scene.remove(this.group);
    this.group.traverse(o => { if (o.geometry) o.geometry.dispose(); });
  }
}

export class NpcManager {
  constructor(world, audio) {
    this.world = world;
    this.audio = audio;
    this.npcs = [];
    this.spawnTimer = 1;
    this.difficulty = 0;
    this.maxActive = 12;
    this.hooks = {};
  }

  setDifficulty(d) { this.difficulty = d; }

  update(dt, player, ballistics) {
    for (let i = this.npcs.length - 1; i >= 0; i--) {
      const n = this.npcs[i];
      const d = Math.sqrt(dist2(n.pos.x, n.pos.z, player.pos.x, player.pos.z));
      const gone = (!n.alive && n.deadTimer > 30) || d > 700;
      if (gone) {
        n.dispose(this.world);
        this.npcs.splice(i, 1);
        continue;
      }
      if (d < 500) n.update(dt, player, ballistics, this.hooks);
    }

    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.spawnTimer = 2.5;
      if (this.npcs.length < this.maxActive) this._trySpawn(player);
    }
  }

  _trySpawn(player) {
    for (const spawn of this.world.structures.npcSpawns) {
      const d = Math.sqrt(dist2(spawn.x, spawn.z, player.pos.x, player.pos.z));
      if (d < 420 || d > 700) continue;
      const existing = this.npcs.filter(n => n.alive).length;
      const count = Math.min(spawn.count, this.maxActive - existing);
      for (let i = 0; i < count; i++) {
        const a = Math.random() * Math.PI * 2;
        const r = Math.random() * spawn.radius;
        const x = spawn.x + Math.cos(a) * r, z = spawn.z + Math.sin(a) * r;
        this.npcs.push(new Npc(x, z, this.world, this.audio, this.difficulty, spawn.radius * 0.7));
      }
      return;
    }
  }

  countAlive() {
    let n = 0;
    for (const n2 of this.npcs) if (n2.alive) n++;
    return n;
  }

  clear() {
    for (const n of this.npcs) n.dispose(this.world);
    this.npcs.length = 0;
  }
}

const _e1 = new THREE.Vector3();
const _e2 = new THREE.Vector3();
