import * as THREE from './vendor/three.module.min.js';
import { clamp, damp } from './utils.js';

export const CAMERA_MODES = ['Perseguição', 'Próxima', 'Cockpit', 'Cinemática'];

export class CameraRig {
  constructor(camera) {
    this.camera = camera;
    this.mode = 0;
    this.pos = new THREE.Vector3(0, 5, -10);
    this.look = new THREE.Vector3();
    this.tPos = new THREE.Vector3();
    this.tLook = new THREE.Vector3();
    this.orbitAngle = 0;
    this.shake = 0;
    this.baseFov = 62;
    this.smoothSpeed = 0;
    this.cornerLat = 0;
  }
  cycle() { this.mode = (this.mode + 1) % 4; return this.mode; }
  addShake(v) { this.shake = Math.min(1.2, this.shake + v); }
  update(dt, car, speed01) {
    const cam = this.camera;
    const fwdX = Math.sin(car.heading), fwdZ = Math.cos(car.heading);
    const rx = -Math.cos(car.heading), rz = Math.sin(car.heading);
    const carPos = car.pos;
    const tp = this.tPos, tl = this.tLook;
    let lambda = 5;

    this.smoothSpeed += (speed01 - this.smoothSpeed) * Math.min(1, dt * 2.5);
    const sp = this.smoothSpeed;

    if (this.mode === 0) {
      const latA = clamp(car.latAccel || 0, -16, 16);
      this.cornerLat += (-latA * 0.05 - this.cornerLat) * Math.min(1, dt * 2.2);
      const dist = 6.2 + sp * 2.6;
      const height = 2.6 + sp * 0.55;
      tp.set(
        carPos.x - fwdX * dist + rx * this.cornerLat,
        carPos.y + height,
        carPos.z - fwdZ * dist + rz * this.cornerLat
      );
      const lookAhead = 4.5 + sp * 6.5;
      tl.set(
        carPos.x + fwdX * lookAhead + rx * this.cornerLat * 0.7,
        carPos.y + 1.1,
        carPos.z + fwdZ * lookAhead + rz * this.cornerLat * 0.7
      );
      lambda = 4.2 + sp * 2.2;
    } else if (this.mode === 1) {
      const latA = clamp(car.latAccel || 0, -16, 16);
      this.cornerLat += (-latA * 0.035 - this.cornerLat) * Math.min(1, dt * 2.2);
      const dist = 3.5 + sp * 1.4;
      tp.set(
        carPos.x - fwdX * dist + rx * this.cornerLat,
        carPos.y + 1.65 + sp * 0.3,
        carPos.z - fwdZ * dist + rz * this.cornerLat
      );
      tl.set(carPos.x + fwdX * 5, carPos.y + 0.9, carPos.z + fwdZ * 5);
      lambda = 7;
    } else if (this.mode === 2) {
      tp.set(carPos.x + fwdX * 0.1 - rx * 0.34, carPos.y + 1.12, carPos.z + fwdZ * 0.1 - rz * 0.34);
      tl.set(carPos.x + fwdX * 12, carPos.y + 1.0, carPos.z + fwdZ * 12);
      lambda = 20;
    } else {
      this.orbitAngle += dt * 0.35;
      const d = 8.5;
      tp.set(carPos.x + Math.cos(this.orbitAngle) * d, carPos.y + 2.6 + Math.sin(this.orbitAngle * 0.7) * 0.8, carPos.z + Math.sin(this.orbitAngle) * d);
      tl.set(carPos.x, carPos.y + 0.8, carPos.z);
      lambda = 3;
    }
    const k = 1 - Math.exp(-lambda * dt);
    this.pos.lerp(tp, k);
    this.look.lerp(tl, Math.min(1, k * 1.4));
    this.shake = Math.max(0, this.shake - dt * 2.2);
    const rumble = car.onGrass && Math.abs(car.forwardSpeed) > 6 ? 0.035 : 0;
    const sh = this.shake * 0.25 + rumble;
    cam.position.set(
      this.pos.x + (Math.random() - 0.5) * sh,
      this.pos.y + (Math.random() - 0.5) * sh,
      this.pos.z + (Math.random() - 0.5) * sh
    );
    cam.lookAt(this.look);
    const targetFov = this.baseFov + sp * 17 + (car.nitroActive ? 9 : 0);
    cam.fov = damp(cam.fov, targetFov, 4, dt);
    cam.updateProjectionMatrix();
  }
  snapTo(car) {
    const fwdX = Math.sin(car.heading), fwdZ = Math.cos(car.heading);
    this.pos.set(car.pos.x - fwdX * 6.4, car.pos.y + 2.7, car.pos.z - fwdZ * 6.4);
    this.look.copy(car.pos);
    this.smoothSpeed = 0;
    this.cornerLat = 0;
    this.camera.position.copy(this.pos);
    this.camera.lookAt(this.look);
  }
}
