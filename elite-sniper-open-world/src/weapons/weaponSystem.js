// Sistema de armas — mira, luneta, binóculos, dispersão, recuo, ferrolho e recarga
import * as THREE from 'three';
import { buildRifle, buildBinoculars, makeMuzzleFlash } from './rifles.js';
import { STANCE } from '../core/config.js';
import { clamp, damp, lerp } from '../core/utils.js';

const HIP_POS = new THREE.Vector3(0.24, -0.24, -0.5);
const HIP_ROT = new THREE.Euler(0.03, 0.06, 0.02);
const AIM_POS = new THREE.Vector3(0, -0.083, -0.3);
const AIM_ROT = new THREE.Euler(0, 0, 0);
const BINOC_POS = new THREE.Vector3(0, -0.075, -0.32);

export class WeaponSystem {
  constructor(camera, world, ballistics, audio, hooks = {}) {
    this.camera = camera;
    this.world = world;
    this.ballistics = ballistics;
    this.audio = audio;
    this.hooks = hooks; // { onShot(x,z), onHitEntity(entity, dmg, headshot, dist), onAmmoChange(ammo, reserve) }

    this.def = null;
    this.model = null;
    this.binocs = buildBinoculars();
    camera.add(this.binocs);
    this.flash = makeMuzzleFlash();
    this.flash.position.set(0, 0.01, -1.35);
    camera.add(this.flash);
    this.flashLight = new THREE.PointLight(0xffa040, 0, 14, 2);
    this.flashLight.position.copy(this.flash.position);
    camera.add(this.flashLight);

    this.mode = 'hip';           // hip | aim | binoc
    this.zoomIndex = 0;
    this.ammo = 0;
    this.reserve = 0;
    this.boltTimer = 0;
    this.reloadTimer = 0;
    this.fireCooldown = 0;
    this.swayTime = 0;
    this.kick = 0;
    this.bipodDeployed = false;
    this.lastShotDist = 0;

    this._dir = new THREE.Vector3();
    this._origin = new THREE.Vector3();
    this.shooterEntity = null;
  }

  setShooterEntity(e) { this.shooterEntity = e; }

  equip(def, ammo, reserve, hasBipod) {
    if (this.model) {
      this.camera.remove(this.model);
      this.model = null;
    }
    this.def = def;
    this.model = buildRifle(def);
    this.camera.add(this.model);
    this.ammo = ammo;
    this.reserve = reserve;
    this.bipodDeployed = false;
    this.hasBipod = hasBipod;
    this.mode = 'hip';
    this.zoomIndex = 0;
    this._emitAmmo();
  }

  _emitAmmo() {
    if (this.hooks.onAmmoChange) this.hooks.onAmmoChange(this.ammo, this.reserve);
  }

  get aiming() { return this.mode === 'aim'; }
  get scoped() { return this.mode === 'aim'; }

  toggleZoom() {
    if (this.mode !== 'aim' || !this.def) return;
    this.zoomIndex = (this.zoomIndex + 1) % this.def.zoomFov.length;
    this.audio.click();
  }

  reload() {
    if (!this.def || this.reloadTimer > 0 || this.boltTimer > 0) return;
    if (this.ammo >= this.def.magazine || this.reserve <= 0) return;
    this.reloadTimer = this.def.reloadTime;
    this.audio.reload();
  }

  _finishReload() {
    const need = this.def.magazine - this.ammo;
    const take = Math.min(need, this.reserve);
    this.ammo += take;
    this.reserve -= take;
    this._emitAmmo();
  }

  update(dt, input, player, cameraCtl, wind) {
    if (!this.def || !this.model) return;
    const d = this.def;

    // Modo de visão
    if (input.binocPressed) {
      this.mode = this.mode === 'binoc' ? 'hip' : 'binoc';
      this.audio.click();
    }
    if (input.aim) {
      if (this.mode !== 'aim') { this.mode = 'aim'; this.zoomIndex = 0; this.audio.scopedIn(); }
    } else if (this.mode === 'aim') {
      this.mode = 'hip';
      this.audio.scopedOut();
    }

    // Timers
    if (this.boltTimer > 0) {
      this.boltTimer -= dt;
      if (this.boltTimer <= 0) this.audio.boltClose();
    }
    if (this.reloadTimer > 0) {
      this.reloadTimer -= dt;
      if (this.reloadTimer <= 0) this._finishReload();
    }
    this.fireCooldown = Math.max(0, this.fireCooldown - dt);
    this.kick = damp(this.kick, 0, 9, dt);

    // Bipé: automático em prona
    const wantBipod = this.hasBipod && player.stance === STANCE.PRONE;
    this.bipodDeployed = wantBipod;
    const bipod = this.model.getObjectByName('bipod');
    if (bipod) {
      const target = wantBipod ? 1 : 0;
      bipod.userData.t = lerp(bipod.userData.t || 0, target, 1 - Math.exp(-8 * dt));
      for (const leg of bipod.children) {
        leg.rotation.x = (leg.name.endsWith('L') ? -1 : 1) * 0.35 * (1 - bipod.userData.t) - 0.55 * bipod.userData.t;
        leg.rotation.z = (leg.name.endsWith('L') ? -0.5 : 0.5) * (1 - bipod.userData.t);
      }
    }

    // Disparo
    if (input.firePressed && this.fireCooldown <= 0 && this.boltTimer <= 0 && this.reloadTimer <= 0) {
      if (this.ammo > 0) this._fire(player, cameraCtl, wind);
      else {
        this.audio.dryFire();
        this.fireCooldown = 0.3;
        this.reload();
      }
    }

    // Animação do modelo
    this._animateModel(dt, player, input);

    // Flash decai
    this.flash.material.opacity = Math.max(0, this.flash.material.opacity - dt * 12);
    this.flashLight.intensity = Math.max(0, this.flashLight.intensity - dt * 60);
  }

  _fire(player, cameraCtl, wind) {
    const d = this.def;
    this.ammo--;
    this._emitAmmo();
    this.fireCooldown = Math.max(d.boltTime, 0.25);
    this.boltTimer = d.boltTime;

    this.camera.getWorldDirection(this._dir);
    this._origin.copy(this.camera.position);

    // Dispersão simulada: maior sem mira, mínima com bipé em prona
    let spread = 0.0022;
    if (this.mode === 'aim') {
      const stanceFac = player.stance === STANCE.PRONE ? 0.25 : player.stance === STANCE.CROUCH ? 0.6 : 1.0;
      const bipodFac = this.bipodDeployed ? 0.4 : 1.0;
      const breathFac = cameraCtl.holdBreathActive ? 0.5 : 1.0;
      spread = 0.0004 * stanceFac * bipodFac * breathFac * d.sway;
    } else {
      spread = 0.02;
    }
    this._dir.x += (Math.random() - 0.5) * spread;
    this._dir.y += (Math.random() - 0.5) * spread;
    this._dir.z += (Math.random() - 0.5) * spread * 0.3;
    this._dir.normalize();

    const shooter = this.shooterEntity || { pos: player.pos, isPlayer: true };
    this.ballistics.fire(this._origin, this._dir, d, shooter, wind);

    // Recuo
    const recoil = d.recoil * (this.bipodDeployed ? 0.55 : 1) * (player.stance === STANCE.PRONE ? 0.7 : 1);
    cameraCtl.addRecoil(recoil * 0.045, (Math.random() - 0.5) * recoil * 0.014);
    this.kick = 1;
    this.flash.material.opacity = 1;
    this.flashLight.intensity = 8;
    this.audio.shot(d);

    if (this.hooks.onShot) this.hooks.onShot(player.pos.x, player.pos.z);
    if (this.hooks.onStats) this.hooks.onStats('shotsFired', 1);
  }

  _animateModel(dt, player, input) {
    const m = this.model;
    const aiming = this.mode === 'aim';
    const binoc = this.mode === 'binoc';
    this.binocs.visible = binoc;
    m.visible = !binoc;

    const tp = aiming ? AIM_POS : HIP_POS;
    const tr = aiming ? AIM_ROT : HIP_ROT;
    const k = 1 - Math.exp(-12 * dt);

    m.position.lerp(tp, k);
    m.rotation.x = lerp(m.rotation.x, tr.x, k);
    m.rotation.y = lerp(m.rotation.y, tr.y, k);
    m.rotation.z = lerp(m.rotation.z, tr.z, k);

    // Balanço com movimento
    const hSpeed = Math.hypot(player.vel.x, player.vel.z);
    const moveFac = clamp(hSpeed / 4, 0, 1.4);
    const t = performance.now() * 0.001;
    m.position.x += Math.sin(t * 5.2) * 0.006 * moveFac;
    m.position.y += Math.abs(Math.cos(t * 5.2)) * 0.008 * moveFac;

    // Recuo visual
    m.position.z += this.kick * 0.06;
    m.rotation.x += this.kick * 0.06;

    // Ferrolho
    const bolt = m.getObjectByName('bolt');
    if (bolt) {
      const cycle = this.boltTimer > 0 ? 1 - Math.abs((this.boltTimer / this.def.boltTime) - 0.5) * 2 : 0;
      bolt.position.z = 0.05 + cycle * 0.07;
      bolt.rotation.z = cycle * 1.2;
    }
    // Carregador
    const mag = m.getObjectByName('magazine');
    if (mag) {
      const rt = this.reloadTimer > 0 ? 1 - Math.abs((this.reloadTimer / this.def.reloadTime) - 0.5) * 2 : 0;
      mag.position.y = -0.085 - rt * 0.12;
    }
    // Binóculos
    if (binoc) {
      this.binocs.position.lerp(BINOC_POS, k);
    }
  }

  get scopeFov() {
    return this.def ? this.def.zoomFov[this.zoomIndex] : 15;
  }
}
