import * as THREE from './vendor/three.module.min.js';
import { PHYS } from './config.js';
import { clamp } from './utils.js';

const GEARS = [0.13, 0.24, 0.37, 0.53, 0.73, 1.0];

export class CarPhysics {
  constructor(spec, upgrades, opts = {}) {
    this.spec = spec;
    this.upgrades = upgrades || { engine: 0, tires: 0, nitro: 0 };
    this.isPlayer = !!opts.isPlayer;
    this.track = null;
    this.pos = new THREE.Vector3();
    this.vel = new THREE.Vector3();
    this.heading = 0;
    this.hintIndex = 0;
    this.trackInfo = { index: 0, s: 0, lateral: 0, tangent: new THREE.Vector3(0, 0, 1), pos: new THREE.Vector3(), height: 0, ds: 0 };
    this.forwardSpeed = 0;
    this.lateralSpeed = 0;
    this.latAccel = 0;
    this.longAccel = 0;
    this.gear = 1;
    this.gearChanged = false;
    this.rpm = 0.15;
    this.nitro = 1;
    this.nitroActive = false;
    this.drifting = false;
    this.skidLevel = 0;
    this.onGrass = false;
    this.pitch = 0;
    this.roll = 0;
    this.wheelSpinAngle = 0;
    this.steerAngle = 0;
    this.stuckTime = 0;
    this.speedKmh = 0;
    this.events = [];
    this.recomputeStats();
  }

  recomputeStats() {
    const up = this.upgrades;
    this.topSpeed = (this.spec.topSpeed * (1 + up.engine * 0.045)) / 3.6;
    this.accelBase = 27.78 / (this.spec.accel / (1 + up.engine * 0.06));
    this.gripMul = 1 + up.tires * 0.05;
    this.nitroCap = this.spec.nitroCap * (1 + up.nitro * 0.12);
    this.nitroPower = 1.45 + up.nitro * 0.06;
  }

  setTrack(track) {
    this.track = track;
    this.hintIndex = 0;
  }

  placeAt(pos, heading) {
    this.pos.copy(pos);
    this.pos.y = 0;
    this.heading = heading;
    this.vel.set(0, 0, 0);
    this.forwardSpeed = 0;
    this.lateralSpeed = 0;
    this.gear = 1;
    this.rpm = 0.15;
    this.nitro = 1;
    if (this.track) {
      const info = this.track.nearest(this.pos, this.hintIndex);
      this.hintIndex = info.index;
      this.trackInfo = info;
    }
  }

  respawn() {
    if (!this.track) return;
    const p = this.track.pointAtS(this.trackInfo.s);
    this.placeAt(new THREE.Vector3(p.pos.x, p.pos.y, p.pos.z), Math.atan2(p.tan.x, p.tan.z));
  }

  update(dt, ctl) {
    if (!Number.isFinite(this.pos.x + this.pos.z + this.heading) || !Number.isFinite(this.vel.x + this.vel.z)) {
      this.vel.set(0, 0, 0);
      this.heading = 0;
      this.hintIndex = 0;
      if (this.track) {
        const p = this.track.pointAtS(0);
        this.pos.set(p.pos.x, 0, p.pos.z);
        this.heading = Math.atan2(p.tan.x, p.tan.z);
      } else {
        this.pos.set(0, 0, 0);
      }
    }
    const t = this.track;
    const info = t ? t.nearest(this.pos, this.hintIndex) : null;
    if (info) {
      const prevS = this.trackInfo.s;
      const L = t.length;
      let ds = info.s - prevS;
      if (ds < -L / 2) ds += L;
      if (ds > L / 2) ds -= L;
      info.ds = ds;
      this.hintIndex = info.index;
      this.trackInfo = info;
      if (ds > 0) this.distanceTraveled = (this.distanceTraveled || 0) + ds;
    }

    const sinH = Math.sin(this.heading), cosH = Math.cos(this.heading);
    const fwdX = sinH, fwdZ = cosH;
    const rgtX = -cosH, rgtZ = sinH;
    let vF = this.vel.x * fwdX + this.vel.z * fwdZ;
    let vR = this.vel.x * rgtX + this.vel.z * rgtZ;

    const halfW = t ? t.halfWidth : 100;
    const lat = info ? info.lateral : 0;
    const onGrass = Math.abs(lat) > halfW - 0.7;
    this.onGrass = onGrass;
    const surfaceGrip = onGrass ? 0.5 : 1;

    this.nitroActive = ctl.nitro && this.nitro > 0.001 && ctl.throttle > 0;
    if (this.nitroActive) this.nitro = Math.max(0, this.nitro - dt / this.nitroCap);
    else this.nitro = Math.min(1, this.nitro + dt * 0.028);

    let accel = 0;
    if (ctl.throttle > 0 && vF < this.topSpeed) {
      const falloff = 1 - (Math.max(0, vF) / this.topSpeed) * 0.5;
      accel += this.accelBase * falloff * ctl.throttle * (this.nitroActive ? this.nitroPower : 1);
    }
    if (ctl.brake > 0) {
      if (vF > 0.6) accel -= PHYS.brakeDecel * this.gripMul * ctl.brake;
      else if (vF > -PHYS.maxReverse) accel -= this.accelBase * 0.45 * ctl.brake;
    }
    accel -= Math.sign(vF) * (PHYS.dragK * 400 * 0.001 * vF * vF + (onGrass ? PHYS.rrGrass : PHYS.rrAsphalt));

    let slope = 0;
    if (t && info) {
      slope = (t.heightAtS((info.s + 4) % t.length) - t.heightAtS((info.s - 4 + t.length) % t.length)) / 8;
      if (Math.abs(vF) > 0.5) accel -= PHYS.gravity * slope * Math.sign(vF);
    }

    const prevVF = vF;
    vF += accel * dt;
    if (ctl.brake > 0 && prevVF > 0.6 && vF < 0) vF = 0;

    const handbrake = ctl.handbrake;
    const maxLatA = this.spec.grip * PHYS.gravity * this.gripMul * surfaceGrip * (handbrake ? 0.38 : 1) * (onGrass ? 0.65 : 1);
    const corrected = clamp(vR / dt, -maxLatA, maxLatA);
    vR -= corrected * dt;
    this.latAccel = -corrected;
    vF -= Math.abs(vR) * 0.12 * dt * (handbrake ? 2.2 : 1);
    if (handbrake && Math.abs(vF) > 1) vF -= Math.sign(vF) * 4.5 * dt;

    const speedFactor = clamp(Math.abs(vF) / 9, 0, 1);
    const steerMax = 0.6 / (1 + Math.abs(vF) * 0.052);
    const steerTarget = ctl.steer * steerMax;
    this.steerAngle += (steerTarget - this.steerAngle) * Math.min(1, dt * 8);
    let yawRate = (vF / this.spec.wheelbase) * Math.tan(this.steerAngle);
    const driftAssist = this.spec.drift * 0.5 + 0.3;
    yawRate += ctl.steer * speedFactor * 0.9 * driftAssist * (Math.abs(vR) > 2 ? 1 : 0.25) * (handbrake ? 1.8 : 1);
    if (Math.abs(vF) > 0.5) {
      yawRate -= vR * 0.06;
      this.heading += yawRate * dt;
    }

    this.vel.set(fwdX * vF + rgtX * vR, 0, fwdZ * vF + rgtZ * vR);
    this.pos.x += this.vel.x * dt;
    this.pos.z += this.vel.z * dt;

    this.collideProps();
    if (t) this.collideBoundary();

    this.pos.y = info ? info.height : 0;

    this.forwardSpeed = vF;
    this.lateralSpeed = vR;
    this.longAccel = (vF - prevVF) / Math.max(dt, 1e-4);
    this.speedKmh = Math.abs(vF) * 3.6;
    let skid = clamp((Math.abs(vR) - 2.5) / 6, 0, 1) * clamp(Math.abs(vF) / 6, 0, 1);
    if (handbrake && Math.abs(vF) > 6) skid = Math.max(skid, 0.5);
    if (onGrass && Math.abs(vF) > 8) skid = Math.max(skid, 0.3);
    this.skidLevel = Math.min(1, skid);
    this.drifting = this.skidLevel > 0.25;

    const frac = clamp(Math.abs(vF) / this.topSpeed, 0, 1);
    let g = 0;
    while (g < GEARS.length - 1 && frac > GEARS[g]) g++;
    const lo = g === 0 ? 0 : GEARS[g - 1];
    const hi = GEARS[g];
    const targetRpm = clamp(0.18 + ((frac - lo) / (hi - lo)) * 0.82, 0.12, 1);
    if (Math.round(targetRpm * 100) > this.rpm * 100 && g + 1 !== this.gear && frac > 0.05) this.gearChanged = true;
    this.rpm += (targetRpm - this.rpm) * Math.min(1, dt * 6);
    this.gear = g + 1;

    this.wheelSpinAngle += (vF / 0.35) * dt;

    const rollTarget = clamp(this.latAccel * 0.011, -0.14, 0.14);
    const pitchTarget = clamp(-this.longAccel * 0.006, -0.07, 0.07) + slope * 0.85;
    this.roll += (rollTarget - this.roll) * Math.min(1, dt * 7);
    this.pitch += (pitchTarget - this.pitch) * Math.min(1, dt * 7);

    this.wallTime = this._pinned ? (this.wallTime || 0) + dt : 0;
    this._pinned = false;
    if (Math.abs(vF) < 0.6 && Math.abs(vR) < 0.6) this.stuckTime += dt;
    else this.stuckTime = 0;
    if (this.stuckTime > (this.isPlayer ? 8 : 4) || this.wallTime > 2.5) {
      this.stuckTime = 0;
      this.wallTime = 0;
      this.respawn();
    }
  }

  collideProps() {
    if (!this.track) return;
    const list = this.track.queryColliders(this.pos.x, this.pos.z, 6);
    const r = PHYS.carRadius;
    for (const c of list) {
      const dx = this.pos.x - c.x, dz = this.pos.z - c.z;
      const d2 = dx * dx + dz * dz;
      const minD = c.r + r;
      if (d2 < minD * minD && d2 > 1e-6) {
        const d = Math.sqrt(d2);
        const nx = dx / d, nz = dz / d;
        const push = minD - d;
        this.pos.x += nx * push;
        this.pos.z += nz * push;
        const vn = this.vel.x * nx + this.vel.z * nz;
        if (vn < 0) {
          this.vel.x -= nx * vn * 1.5;
          this.vel.z -= nz * vn * 1.5;
          const impact = -vn;
          if (impact > 3) this.events.push({ type: 'collision', impact, x: this.pos.x - nx * r, z: this.pos.z - nz * r });
        }
      }
    }
  }

  collideBoundary() {
    const t = this.track;
    const limit = t.halfWidth + t.shoulder;
    const info = this.trackInfo;
    if (!info.tangent) return;
    const overs = Math.abs(info.lateral) - limit;
    if (overs <= 0) {
      this.wallTime = 0;
      return;
    }
    const sign = Math.sign(info.lateral);
    const nx = -info.tangent.z * sign, nz = info.tangent.x * sign;
    this.pos.x -= nx * overs;
    this.pos.z -= nz * overs;
    const vn = this.vel.x * nx + this.vel.z * nz;
    if (vn > 0) {
      this.vel.x -= nx * vn * 1.4;
      this.vel.z -= nz * vn * 1.4;
      if (vn > 2) this.vel.multiplyScalar(0.9);
      if (vn > 3) this.events.push({ type: 'collision', impact: vn, x: this.pos.x, z: this.pos.z });
    }
    info.lateral = limit * sign;
    this._pinned = Math.abs(info.ds || 0) < 0.02;
  }

  applyCarCollision(other) {
    const dx = other.pos.x - this.pos.x, dz = other.pos.z - this.pos.z;
    const d2 = dx * dx + dz * dz;
    const minD = PHYS.carRadius * 2;
    if (d2 > minD * minD || d2 < 1e-6) return null;
    const d = Math.sqrt(d2);
    const nx = dx / d, nz = dz / d;
    const overlap = minD - d;
    const m1 = this.spec.mass, m2 = other.spec.mass;
    const total = m1 + m2;
    this.pos.x -= nx * overlap * (m2 / total);
    this.pos.z -= nz * overlap * (m2 / total);
    other.pos.x += nx * overlap * (m1 / total);
    other.pos.z += nz * overlap * (m1 / total);
    const rvx = other.vel.x - this.vel.x, rvz = other.vel.z - this.vel.z;
    const vn = rvx * nx + rvz * nz;
    if (vn < 0) {
      const j = -1.35 * vn / (1 / m1 + 1 / m2);
      this.vel.x -= (j / m1) * nx; this.vel.z -= (j / m1) * nz;
      other.vel.x += (j / m2) * nx; other.vel.z += (j / m2) * nz;
      return { impact: -vn, x: this.pos.x + nx * PHYS.carRadius, z: this.pos.z + nz * PHYS.carRadius };
    }
    return null;
  }

  consumeEvents() {
    const e = this.events;
    this.events = [];
    return e;
  }
}
