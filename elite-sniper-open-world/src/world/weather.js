// Clima: estados, transições, chuva, vento, trovoada e neblina
import * as THREE from 'three';
import { clamp, lerp, damp } from '../core/utils.js';

export const WEATHER_STATES = {
  clear:  { label: 'Céu limpo',  cloud: 0.08, fogMul: 1.0,  lightMul: 1.0,  rain: 0, wind: 2.0,  thunder: 0 },
  cloudy: { label: 'Nublado',    cloud: 0.55, fogMul: 0.8,  lightMul: 0.72, rain: 0, wind: 4.0,  thunder: 0 },
  rain:   { label: 'Chuva',      cloud: 0.8,  fogMul: 0.55, lightMul: 0.5,  rain: 1, wind: 6.5,  thunder: 0.05 },
  storm:  { label: 'Tempestade', cloud: 0.95, fogMul: 0.4,  lightMul: 0.35, rain: 2, wind: 11.0, thunder: 0.3 },
  fog:    { label: 'Neblina',    cloud: 0.4,  fogMul: 0.22, lightMul: 0.6,  rain: 0, wind: 1.0,  thunder: 0 },
  windy:  { label: 'Vento forte',cloud: 0.35, fogMul: 0.9,  lightMul: 0.9,  rain: 0, wind: 14.0, thunder: 0 },
};

export class Weather {
  constructor(scene, quality, hooks = {}) {
    this.scene = scene;
    this.q = quality;
    this.hooks = hooks; // { onThunder(intensity), onRain(active) }
    this.current = 'clear';
    this.target = 'clear';
    this.blend = 1; // 1 = totalmente no estado atual
    this.timer = 60 + Math.random() * 120;
    this.windAngle = Math.random() * Math.PI * 2;

    this.state = { cloud: 0.1, fogMul: 1, lightMul: 1, rain: 0, wind: 2, thunder: 0 };
    this.windX = 2; this.windZ = 0;
    this.flash = 0;

    // Partículas de chuva
    const maxRain = 2600;
    const pos = new Float32Array(maxRain * 3);
    for (let i = 0; i < maxRain; i++) {
      pos[i * 3] = (Math.random() * 2 - 1) * 55;
      pos[i * 3 + 1] = Math.random() * 40;
      pos[i * 3 + 2] = (Math.random() * 2 - 1) * 55;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.rainMat = new THREE.PointsMaterial({
      color: 0x9fb8cc, size: 0.09, transparent: true, opacity: 0.6, depthWrite: false,
    });
    this.rain = new THREE.Points(geo, this.rainMat);
    this.rain.frustumCulled = false;
    this.rain.visible = false;
    scene.add(this.rain);

    this.fog = new THREE.Fog(0xc4ddef, 10, quality.viewDist);
    scene.fog = this.fog;
  }

  setQuality(q) { this.q = q; }

  force(state) {
    if (WEATHER_STATES[state]) { this.target = state; this.blend = 0; this.timer = 90 + Math.random() * 120; }
  }

  update(dt, px, pz, sky, audio) {
    this.timer -= dt;
    if (this.timer <= 0) {
      const keys = Object.keys(WEATHER_STATES);
      this.target = keys[Math.floor(Math.random() * keys.length)];
      this.blend = 0;
      this.timer = 90 + Math.random() * 150;
    }
    this.blend = clamp(this.blend + dt / 18, 0, 1);

    const tgt = WEATHER_STATES[this.target];
    const k = this.blend;
    this.state.cloud = damp(this.state.cloud, tgt.cloud, 0.5, dt);
    this.state.fogMul = damp(this.state.fogMul, tgt.fogMul, 0.5, dt);
    this.state.lightMul = damp(this.state.lightMul, tgt.lightMul, 0.5, dt);
    this.state.rain = damp(this.state.rain, tgt.rain, 0.5, dt);
    this.state.wind = damp(this.state.wind, tgt.wind, 0.3, dt);
    this.state.thunder = tgt.thunder;

    this.windAngle += dt * 0.02;
    this.windX = Math.cos(this.windAngle) * this.state.wind;
    this.windZ = Math.sin(this.windAngle) * this.state.wind;

    // Trovoada
    if (this.flash > 0) {
      this.flash -= dt * 3;
      sky.hemi.intensity += this.flash * 3;
    }
    if (this.state.thunder > 0 && Math.random() < this.state.thunder * dt) {
      this.flash = 1.4;
      if (this.hooks.onThunder) this.hooks.onThunder();
    }

    // Chuva
    const rainCount = Math.floor(this.state.rain * 1400 * this.q.particles);
    this.rain.visible = rainCount > 10;
    if (this.rain.visible) {
      this.rain.position.set(px, 0, pz);
      const pos = this.rain.geometry.attributes.position;
      const fall = dt * 32;
      for (let i = 0; i < rainCount * 3; i += 3) {
        let y = pos.array[i + 1] - fall;
        if (y < 0) { y = 38 + Math.random() * 6; pos.array[i] = (Math.random() * 2 - 1) * 55; pos.array[i + 2] = (Math.random() * 2 - 1) * 55; }
        pos.array[i + 1] = y;
      }
      pos.needsUpdate = true;
      this.rainMat.opacity = 0.35 + this.state.rain * 0.15;
      if (this.hooks.onRain) this.hooks.onRain(this.state.rain);
    }

    // Neblina acompanha céu e clima
    const far = this.q.viewDist * this.state.fogMul;
    this.fog.near = far * this.q.fogNear;
    this.fog.far = far;
    this.fog.color.copy(sky.horizonColor).multiplyScalar(0.9 + sky.dayFactor * 0.1);
  }

  get label() { return WEATHER_STATES[this.target].label; }
}
