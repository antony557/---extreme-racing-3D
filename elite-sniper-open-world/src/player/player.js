// Jogador em primeira pessoa — movimento, posturas, stamina, vida
import * as THREE from 'three';
import { terrainHeight } from '../world/heightfield.js';
import { STANCE, STANCE_DATA, PLAYER } from '../core/config.js';
import { clamp, damp } from '../core/utils.js';

export class Player {
  constructor(world, spawn) {
    this.world = world;
    this.pos = new THREE.Vector3(spawn.x, 0, spawn.z);
    this.pos.y = terrainHeight(spawn.x, spawn.z);
    this.vel = new THREE.Vector3();
    this.yaw = spawn.yaw || 0;
    this.stance = STANCE.STAND;
    this.stanceTarget = STANCE.STAND;
    this.eyeHeight = STANCE_DATA[0].eye;
    this.onGround = true;
    this.health = 100;
    this.stamina = PLAYER.staminaMax;
    this.alive = true;
    this.moving = false;
    this.running = false;
    this.strideDist = 0;
    this.medkits = 2;
    this.camo = 0;
    this.hasBipod = true;
    this.onFootstep = null;   // callback(x, z, running)
    this.onNoise = null;
  }

  get eyePos() {
    return new THREE.Vector3(this.pos.x, this.pos.y + this.eyeHeight, this.pos.z);
  }

  stanceData() { return STANCE_DATA[this.stance]; }

  setStance(s) {
    if (s === this.stanceTarget) return;
    if (s === STANCE.PRONE && this.stanceTarget !== STANCE.CROUCH && this.stanceTarget !== STANCE.STAND) return;
    this.stanceTarget = s;
  }

  toggleCrouch() {
    this.setStance(this.stanceTarget === STANCE.CROUCH ? STANCE.STAND : STANCE.CROUCH);
  }
  toggleProne() {
    this.setStance(this.stanceTarget === STANCE.PRONE ? STANCE.STAND : STANCE.PRONE);
  }
  standUp() { this.setStance(STANCE.STAND); }

  damage(amount, fromX, fromZ) {
    if (!this.alive) return;
    this.health = clamp(this.health - amount, 0, 100);
    if (this.health <= 0) this.alive = false;
  }

  heal() {
    if (this.medkits <= 0 || this.health >= 100) return false;
    this.medkits--;
    this.health = clamp(this.health + 55, 0, 100);
    return true;
  }

  update(dt, input) {
    if (!this.alive) return;

    // transição suave da altura dos olhos
    const targetEye = STANCE_DATA[this.stanceTarget].eye;
    this.eyeHeight = damp(this.eyeHeight, targetEye, 9, dt);
    if (Math.abs(this.eyeHeight - targetEye) < 0.02) this.stance = this.stanceTarget;

    // Direção de movimento
    let mx = input.move.x, mz = input.move.y;
    const mag = Math.hypot(mx, mz);
    this.moving = mag > 0.08;
    if (mag > 1) { mx /= mag; mz /= mag; }

    // Corrida
    const wantRun = input.run && this.moving && this.stanceTarget !== STANCE.PRONE && this.stamina > 2;
    this.running = wantRun;
    if (wantRun) this.stamina = clamp(this.stamina - PLAYER.runDrain * dt, 0, PLAYER.staminaMax);
    else this.stamina = clamp(this.stamina + PLAYER.regen * dt, 0, PLAYER.staminaMax);

    const base = STANCE_DATA[this.stanceTarget].speed;
    const speed = base * (wantRun ? 1.85 : 1) * (input.aim ? 0.55 : 1);

    // Velocidade horizontal com aceleração
    const sin = Math.sin(this.yaw), cos = Math.cos(this.yaw);
    const dirX = mx * cos - mz * sin;
    const dirZ = -mx * sin - mz * cos;
    const accel = this.onGround ? 10 : 2.5;
    this.vel.x = damp(this.vel.x, dirX * speed, accel, dt);
    this.vel.z = damp(this.vel.z, dirZ * speed, accel, dt);

    // Pulo e gravidade
    if (input.jumpPressed && this.onGround && this.stanceTarget !== STANCE.PRONE) {
      this.vel.y = PLAYER.jump;
      this.onGround = false;
      this.standUp();
    }
    this.vel.y -= PLAYER.gravity * dt;

    // Integração + colisão
    this.pos.x += this.vel.x * dt;
    this.pos.z += this.vel.z * dt;
    this.pos.y += this.vel.y * dt;

    const feet = this.pos.y, head = this.pos.y + this.eyeHeight;
    this.world.collide(this.pos, PLAYER.radius, feet, head);

    const groundY = this.world.supportHeight(this.pos.x, this.pos.z, this.pos.y);
    if (this.pos.y <= groundY) {
      if (!this.onGround && this.vel.y < -9) {
        const fallDmg = Math.min(60, (-this.vel.y - 9) * 4);
        if (fallDmg > 4) this.damage(fallDmg);
      }
      this.pos.y = groundY;
      this.vel.y = 0;
      this.onGround = true;
    } else if (this.pos.y > groundY + 0.05) {
      this.onGround = false;
    }

    // Limites do mundo
    this.pos.x = clamp(this.pos.x, -WORLD_LIMIT, WORLD_LIMIT);
    this.pos.z = clamp(this.pos.z, -WORLD_LIMIT, WORLD_LIMIT);

    // Passos e ruído
    const hSpeed = Math.hypot(this.vel.x, this.vel.z);
    if (this.onGround && hSpeed > 0.4) {
      this.strideDist += hSpeed * dt;
      const stride = this.stance === STANCE.PRONE ? 1.6 : this.running ? 2.4 : 1.9;
      if (this.strideDist > stride) {
        this.strideDist = 0;
        if (this.onFootstep) this.onFootstep(this.pos.x, this.pos.z, this.running);
        if (this.onNoise) this.onNoise(this.pos.x, this.pos.z, STANCE_DATA[this.stance].noise);
      }
    }
  }
}

const WORLD_LIMIT = 790;
