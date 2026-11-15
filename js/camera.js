import * as THREE from './vendor/three.module.min.js';
import { clamp, damp } from './utils.js';

export const CAMERA_MODES = ['Perseguição', 'Próxima', 'Cockpit', 'Cinemática'];

export class CameraRig {
  constructor(camera) {
    this.camera = camera;
    this.mode = 0;
    this.pos = new THREE.Vector3(0, 5, -10);
    this.look = new THREE.Vector3();
    this.orbitAngle = 0;
    this.shake = 0;
    this.baseFov = 62;
  }
  cycle() { this.mode = (this.mode + 1) % 4; return this.mode; }
  addShake(v) { this.shake = Math.min(1.2, this.shake + v); }
  update(dt, car, speed01) {
    const cam = this.camera;
    const fwdX = Math.sin(car.heading), fwdZ = Math.cos(car.heading);
    const carPos = car.pos;
    let targetPos, targetLook, lambda = 5;
    if (this.mode === 0) {
      targetPos = new THREE.Vector3(carPos.x - fwdX * 6.4, carPos.y + 2.7, carPos.z - fwdZ * 6.4);
      targetLook = new THREE.Vector3(carPos.x + fwdX * 4, carPos.y + 1.1, carPos.z + fwdZ * 4);
      lambda = 4.5;
    } else if (this.mode === 1) {
      targetPos = new THREE.Vector3(carPos.x - fwdX * 3.6, carPos.y + 1.7, carPos.z - fwdZ * 3.6);
      targetLook = new THREE.Vector3(carPos.x + fwdX * 4, carPos.y + 0.9, carPos.z + fwdZ * 4);
      lambda = 7;
    } else if (this.mode === 2) {
      const rx = -Math.cos(car.heading), rz = Math.sin(car.heading);
      targetPos = new THREE.Vector3(carPos.x + fwdX * 0.1 - rx * 0.34, carPos.y + 1.12, carPos.z + fwdZ * 0.1 - rz * 0.34);
      targetLook = new THREE.Vector3(carPos.x + fwdX * 12, carPos.y + 1.0, carPos.z + fwdZ * 12);
      lambda = 20;
    } else {
      this.orbitAngle += dt * 0.35;
      const d = 8.5;
      targetPos = new THREE.Vector3(carPos.x + Math.cos(this.orbitAngle) * d, carPos.y + 2.6 + Math.sin(this.orbitAngle * 0.7) * 0.8, carPos.z + Math.sin(this.orbitAngle) * d);
      targetLook = new THREE.Vector3(carPos.x, carPos.y + 0.8, carPos.z);
      lambda = 3;
    }
    const k = 1 - Math.exp(-lambda * dt);
    this.pos.lerp(targetPos, k);
    this.look.lerp(targetLook, Math.min(1, k * 1.4));
    this.shake = Math.max(0, this.shake - dt * 2.2);
    const rumble = car.onGrass && Math.abs(car.forwardSpeed) > 6 ? 0.035 : 0;
    const sh = this.shake * 0.25 + rumble;
    cam.position.set(
      this.pos.x + (Math.random() - 0.5) * sh,
      this.pos.y + (Math.random() - 0.5) * sh,
      this.pos.z + (Math.random() - 0.5) * sh
    );
    cam.lookAt(this.look);
    const targetFov = this.baseFov + speed01 * 16 + (car.nitroActive ? 9 : 0);
    cam.fov = damp(cam.fov, targetFov, 4, dt);
    cam.updateProjectionMatrix();
  }
  snapTo(car) {
    const fwdX = Math.sin(car.heading), fwdZ = Math.cos(car.heading);
    this.pos.set(car.pos.x - fwdX * 6.4, car.pos.y + 2.7, car.pos.z - fwdZ * 6.4);
    this.look.copy(car.pos);
    this.camera.position.copy(this.pos);
    this.camera.lookAt(this.look);
  }
}
