import { clamp, wrapAngle } from './utils.js';

const AI_NAMES = ['V. Russo', 'K. Tanaka', 'L. Mendes', 'D. Costa', 'A. Silva', 'M. Ivanov', 'R. Duarte', 'P. Laurent', 'J. Okada', 'B. Ferreira'];

export class AIController {
  constructor(car, difficulty, track, index) {
    this.car = car;
    this.track = track;
    this.difficulty = difficulty;
    this.name = AI_NAMES[index % AI_NAMES.length];
    this.laneOffset = (index % 2 === 0 ? -1 : 1) * (1 + (index % 3)) * 0.9;
    this.speedMul = difficulty.speed * (0.97 + (index % 4) * 0.015);
    this.latA = 9.81 * car.spec.grip * difficulty.grip;
    this.eliminated = false;
    this.avoidTimer = 0;
    this.avoidDir = 0;
    this.lastBrake = false;
    this._acc = 1;
    this._ctl = { throttle: 0, brake: 0, steer: 0, handbrake: false, nitro: false };
    this._brakeCtl = { throttle: 0, brake: 1, steer: 0, handbrake: false, nitro: false };
  }

  update(dt, cars) {
    if (this.eliminated) return this._brakeCtl;
    this._acc += dt;
    if (this._acc >= 0.05) {
      this._acc = 0;
      this.decide(cars, dt);
    }
    return this._ctl;
  }

  decide(cars, dt) {
    const car = this.car;
    const ctl = this._ctl;
    const info = car.trackInfo;
    const track = this.track;
    const speed = Math.abs(car.forwardSpeed);

    const lookDist = 9 + speed * 0.6;
    const aheadPoint = track.sampleAhead(info.s, lookDist);
    const farPoint = track.sampleAhead(info.s, lookDist * 2.2);

    const targetLat = clamp(this.laneOffset + this.avoidDir * 3.2, -(track.halfWidth - 1.6), track.halfWidth - 1.6);
    const nx = -aheadPoint.tan.z, nz = aheadPoint.tan.x;
    const tx = aheadPoint.pos.x + nx * targetLat;
    const tz = aheadPoint.pos.z + nz * targetLat;

    const desired = Math.atan2(tx - car.pos.x, tz - car.pos.z);
    const diff = wrapAngle(desired - car.heading);
    const steer = clamp(diff * 2.4, -1, 1);

    const curvNear = track.curvatureAhead(info.s, 12 + speed * 1.1);
    const curvFar = track.curvatureAhead(info.s, 30 + speed * 2.4);
    const curv = Math.max(curvNear, curvFar * 0.75);
    let vTarget = Math.min(car.topSpeed * this.speedMul, Math.sqrt(this.latA / curv));

    let avoid = 0;
    let brakeForCar = false;
    for (const other of cars) {
      if (other === car || other.eliminated) continue;
      const dx = other.pos.x - car.pos.x, dz = other.pos.z - car.pos.z;
      const dist = Math.hypot(dx, dz);
      if (dist > 24) continue;
      const relHeading = Math.atan2(dx, dz);
      const angleTo = wrapAngle(relHeading - car.heading);
      if (Math.abs(angleTo) > 0.6) continue;
      const otherInfo = other.trackInfo;
      let ds = otherInfo.s - info.s;
      const L = track.length;
      if (ds < -L / 2) ds += L;
      if (ds > L / 2) ds -= L;
      if (ds > 0.5 && ds < 20) {
        const latDiff = otherInfo.lateral - info.lateral;
        if (Math.abs(latDiff) < 2.6) {
          avoid = latDiff >= 0 ? -1 : 1;
          if (ds < 9 && car.forwardSpeed > other.forwardSpeed + 1) brakeForCar = true;
        }
      }
    }
    if (avoid !== 0) {
      this.avoidDir = avoid;
      this.avoidTimer = 1.4;
    } else if (this.avoidTimer > 0) {
      this.avoidTimer -= dt;
      if (this.avoidTimer <= 0) this.avoidDir = 0;
    }

    if (brakeForCar) vTarget = Math.min(vTarget, Math.max(4, this.findAheadSpeed(cars) - 2));

    const vNow = car.forwardSpeed;
    let throttle = 0, brake = 0;
    if (vNow < vTarget - 0.5) throttle = 1;
    else if (vNow > vTarget + 1.5) brake = clamp((vNow - vTarget) * 0.28, 0, 1);
    else throttle = 0.4;

    ctl.throttle = throttle;
    ctl.brake = brake;
    ctl.steer = steer;
    this.lastBrake = brake > 0;
  }

  findAheadSpeed(cars) {
    let best = this.car.topSpeed;
    for (const other of cars) {
      if (other === this.car) continue;
      const dx = other.pos.x - this.car.pos.x, dz = other.pos.z - this.car.pos.z;
      const dist = Math.hypot(dx, dz);
      if (dist < 12 && Math.abs(wrapAngle(Math.atan2(dx, dz) - this.car.heading)) < 0.5) {
        best = Math.min(best, other.forwardSpeed);
      }
    }
    return best;
  }
}
