// Câmera em primeira pessoa — yaw/pitch, bob, recuo, tremor suave, transições de FOV
import * as THREE from 'three';
import { clamp, damp, lerp } from '../core/utils.js';

export class CameraController {
  constructor(camera, player, input) {
    this.camera = camera;
    this.player = player;
    this.input = input;
    this.pitch = 0;
    this.recoilPitch = 0;
    this.recoilYaw = 0;
    this.bobPhase = 0;
    this.shake = 0;
    this.baseFov = 75;
    this.targetFov = 75;
    this.fov = 75;
    this.holdBreath = 0;
    this.breathPhase = 0;
    this.swayX = 0;
    this.swayY = 0;
  }

  addRecoil(pitchKick, yawKick) {
    this.recoilPitch += pitchKick;
    this.recoilYaw += yawKick;
  }

  addShake(amount) { this.shake = Math.min(this.shake + amount, 1.2); }

  setFov(target) { this.targetFov = target; }

  update(dt, aiming, weaponSway) {
    const p = this.player;

    // Olhar
    const sens = this.input.sensitivity * (aiming ? 0.45 : 1);
    this.player.yaw -= this.input.consumeLookX() * sens;
    this.pitch -= this.input.consumeLookY() * sens;
    this.pitch = clamp(this.pitch, -1.45, 1.45);

    // Recuo decai
    this.recoilPitch = damp(this.recoilPitch, 0, 6, dt);
    this.recoilYaw = damp(this.recoilYaw, 0, 6, dt);

    // Respiração / apneia / oscilação da mira
    const wantHold = aiming && this.input.holdBreath && p.stamina > 1;
    this.holdBreathActive = !!wantHold;
    if (this.holdBreathActive) {
      p.stamina = Math.max(0, p.stamina - 11 * dt);
      this.holdTime = (this.holdTime || 0) + dt;
    } else {
      this.holdTime = 0;
      this.gasp = this.gasp > 0 ? this.gasp - dt : 0;
      if (p.stamina < 1 && aiming) this.gasp = 3;
    }
    this.breathPhase += dt * (this.holdBreathActive ? 0.25 : 1.6);
    let swayAmp = 0.0016 * weaponSway;
    if (this.holdBreathActive) swayAmp *= 0.18;
    if (this.gasp > 0) swayAmp *= 2.2;
    const breathe = aiming ? Math.sin(this.breathPhase) * swayAmp : 0;
    this.swayX = damp(this.swayX, breathe, 4, dt);
    this.swayY = damp(this.swayY, Math.cos(this.breathPhase * 0.8) * breathe * 0.6, 4, dt);

    // Bob de caminhada
    const hSpeed = Math.hypot(p.vel.x, p.vel.z);
    if (p.onGround && hSpeed > 0.5) {
      this.bobPhase += dt * hSpeed * 1.35;
    }
    const bobAmp = aiming ? 0.004 : 0.028;
    const bobY = Math.abs(Math.sin(this.bobPhase)) * bobAmp * Math.min(hSpeed / 4, 1.4);
    const bobX = Math.sin(this.bobPhase * 0.5) * bobAmp * 0.7 * Math.min(hSpeed / 4, 1.4);

    // Tremor (impactos, explosões)
    this.shake = damp(this.shake, 0, 5, dt);
    const shX = (Math.random() - 0.5) * this.shake * 0.02;
    const shY = (Math.random() - 0.5) * this.shake * 0.02;

    // Posição final
    const eye = p.eyePos;
    this.camera.position.set(
      eye.x + bobX * Math.cos(p.yaw) + shX,
      eye.y + bobY + shY,
      eye.z - bobX * Math.sin(p.yaw) + shX
    );
    this.camera.rotation.order = 'YXZ';
    this.camera.rotation.y = p.yaw + this.recoilYaw + this.swayX * 8 + shX;
    this.camera.rotation.x = this.pitch + this.recoilPitch + this.swayY * 8 + shY;
    this.camera.rotation.z = Math.sin(this.bobPhase * 0.5) * 0.004;

    // FOV suave
    this.fov = damp(this.fov, this.targetFov, 10, dt);
    if (Math.abs(this.camera.fov - this.fov) > 0.01) {
      this.camera.fov = this.fov;
      this.camera.updateProjectionMatrix();
    }
  }
}
