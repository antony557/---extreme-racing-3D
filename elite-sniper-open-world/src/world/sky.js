// Céu dinâmico: domo shader, sol, lua, estrelas, nuvens e ciclo dia/noite
import * as THREE from 'three';
import { DAY_LENGTH } from '../core/config.js';
import { clamp, lerp, smoothstep } from '../core/utils.js';

const SKY_VERT = `
varying vec3 vDir;
void main() {
  vDir = normalize(position);
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
}`;

const SKY_FRAG = `
uniform vec3 uZenith;
uniform vec3 uHorizon;
uniform vec3 uSunDir;
uniform float uSunI;
varying vec3 vDir;
void main() {
  float t = clamp(vDir.y * 1.6 + 0.12, 0.0, 1.0);
  vec3 col = mix(uHorizon, uZenith, pow(t, 0.8));
  float sd = max(dot(normalize(vDir), normalize(uSunDir)), 0.0);
  col += vec3(1.0, 0.85, 0.6) * pow(sd, 350.0) * uSunI * 3.0;
  col += vec3(1.0, 0.7, 0.45) * pow(sd, 8.0) * uSunI * 0.22;
  gl_FragColor = vec4(col, 1.0);
}`;

function cloudTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, 256, 256);
  for (let i = 0; i < 40; i++) {
    const x = 40 + Math.random() * 176, y = 70 + Math.random() * 116;
    const r = 20 + Math.random() * 45;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, 'rgba(255,255,255,0.55)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  return tex;
}

const KEYFRAMES = [
  // hora, zin, hor, luzSol, corSol, ambiente, hemi
  { h: 0.0,  zen: 0x050a1a, hor: 0x0a1226, sun: 0.0,  sunCol: 0x223355, amb: 0.16 },
  { h: 5.0,  zen: 0x12203c, hor: 0x3a2f45, sun: 0.05, sunCol: 0x554466, amb: 0.22 },
  { h: 6.5,  zen: 0x3f6fa8, hor: 0xf2a45c, sun: 0.55, sunCol: 0xffb070, amb: 0.45 },
  { h: 9.0,  zen: 0x4a90d9, hor: 0xbcd8ee, sun: 1.0,  sunCol: 0xfff2dd, amb: 0.62 },
  { h: 13.0, zen: 0x3f86d6, hor: 0xc4ddef, sun: 1.12, sunCol: 0xfff8ec, amb: 0.68 },
  { h: 17.5, zen: 0x4a7fbe, hor: 0xe8c9a0, sun: 0.8,  sunCol: 0xffe0b0, amb: 0.55 },
  { h: 19.0, zen: 0x2a3f6e, hor: 0xe07840, sun: 0.35, sunCol: 0xff8850, amb: 0.38 },
  { h: 20.5, zen: 0x0a1430, hor: 0x1a2340, sun: 0.02, sunCol: 0x334466, amb: 0.2 },
  { h: 24.0, zen: 0x050a1a, hor: 0x0a1226, sun: 0.0,  sunCol: 0x223355, amb: 0.16 },
];

const _ca = new THREE.Color(), _cb = new THREE.Color();

export class Sky {
  constructor(scene, renderer) {
    this.scene = scene;
    this.time = 8 * 3600; // 08:00

    this.uniforms = {
      uZenith: { value: new THREE.Color(0x3f86d6) },
      uHorizon: { value: new THREE.Color(0xc4ddef) },
      uSunDir: { value: new THREE.Vector3(0, 1, 0) },
      uSunI: { value: 1 },
    };
    const geo = new THREE.SphereGeometry(1400, 24, 16);
    const mat = new THREE.ShaderMaterial({
      uniforms: this.uniforms, vertexShader: SKY_VERT, fragmentShader: SKY_FRAG,
      side: THREE.BackSide, depthWrite: false, fog: false,
    });
    this.dome = new THREE.Mesh(geo, mat);
    this.dome.frustumCulled = false;
    scene.add(this.dome);

    this.sun = new THREE.DirectionalLight(0xfff2dd, 1.0);
    this.sun.castShadow = false;
    scene.add(this.sun);
    scene.add(this.sun.target);
    this.hemi = new THREE.HemisphereLight(0xbcd8ee, 0x3a4a2e, 0.6);
    scene.add(this.hemi);

    // Estrelas
    const starCount = 700;
    const pos = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
      const v = new THREE.Vector3().randomDirection().multiplyScalar(1300);
      v.y = Math.abs(v.y) * 0.9 + 60;
      pos.set([v.x, v.y, v.z], i * 3);
    }
    const sg = new THREE.BufferGeometry();
    sg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.starMat = new THREE.PointsMaterial({ color: 0xcfe0ff, size: 2.2, sizeAttenuation: false, transparent: true, opacity: 0, fog: false, depthWrite: false });
    this.stars = new THREE.Points(sg, this.starMat);
    this.stars.frustumCulled = false;
    scene.add(this.stars);

    // Nuvens
    const tex = cloudTexture();
    this.clouds = [];
    this.cloudMat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0.5, depthWrite: false, fog: false });
    for (let i = 0; i < 12; i++) {
      const s = 260 + Math.random() * 320;
      const m = new THREE.Mesh(new THREE.PlaneGeometry(s, s * 0.55), this.cloudMat);
      m.rotation.x = -Math.PI / 2;
      m.position.set((Math.random() * 2 - 1) * 900, 170 + Math.random() * 90, (Math.random() * 2 - 1) * 900);
      m.frustumCulled = false;
      scene.add(m);
      this.clouds.push(m);
    }

    this.sunDir = new THREE.Vector3(0, 1, 0);
    this.horizonColor = new THREE.Color(0xc4ddef);
    this.dayFactor = 1;
  }

  setShadow(enabled, size, dist) {
    this.sun.castShadow = enabled;
    if (enabled) {
      this.sun.shadow.mapSize.set(size, size);
      const c = this.sun.shadow.camera;
      c.left = -dist; c.right = dist; c.top = dist; c.bottom = -dist;
      c.near = 1; c.far = dist * 4;
      c.updateProjectionMatrix();
      this.sun.shadow.bias = -0.0004;
      if (this.sun.shadow.map) { this.sun.shadow.map.dispose(); this.sun.shadow.map = null; }
    }
  }

  update(dt, px, pz, weather) {
    this.time += dt;
    if (this.time >= DAY_LENGTH) this.time -= DAY_LENGTH;
    const hour = (this.time / DAY_LENGTH) * 24;

    // interpolação de keyframes
    let a = KEYFRAMES[0], b = KEYFRAMES[KEYFRAMES.length - 1];
    for (let i = 0; i < KEYFRAMES.length - 1; i++) {
      if (hour >= KEYFRAMES[i].h && hour <= KEYFRAMES[i + 1].h) { a = KEYFRAMES[i]; b = KEYFRAMES[i + 1]; break; }
    }
    const t = smoothstep(a.h, b.h, hour);
    _ca.setHex(a.zen); _cb.setHex(b.zen);
    this.uniforms.uZenith.value.lerpColors(_ca, _cb, t);
    _ca.setHex(a.hor); _cb.setHex(b.hor);
    this.uniforms.uHorizon.value.lerpColors(_ca, _cb, t);
    this.horizonColor.copy(this.uniforms.uHorizon.value);
    _ca.setHex(a.sunCol); _cb.setHex(b.sunCol);
    this.sun.color.lerpColors(_ca, _cb, t);

    const sunI = lerp(a.sun, b.sun, t);
    this.dayFactor = clamp(sunI * 1.4, 0, 1);
    const w = weather || { cloud: 0, lightMul: 1 };
    this.sun.intensity = sunI * 2.2 * w.lightMul;
    this.hemi.intensity = lerp(a.amb, b.amb, t) * 1.6 * lerp(1, 0.55, w.cloud);
    this.uniforms.uSunI.value = sunI * (1 - w.cloud * 0.85);

    // posição do sol
    const ang = ((hour - 6) / 12) * Math.PI; // 6h nascente .. 18h poente
    const elev = Math.sin(ang), azim = Math.cos(ang);
    this.sunDir.set(azim * 0.8, Math.max(elev, -0.4), 0.35).normalize();
    this.uniforms.uSunDir.value.copy(this.sunDir);

    this.sun.position.set(px + this.sunDir.x * 260, this.sunDir.y * 260 + 30, pz + this.sunDir.z * 260);
    this.sun.target.position.set(px, 0, pz);
    this.sun.target.updateMatrixWorld();

    this.dome.position.set(px, 0, pz);
    this.stars.position.set(px, 0, pz);
    this.starMat.opacity = clamp(1 - this.dayFactor * 2.2, 0, 1) * (1 - w.cloud);

    this.cloudMat.opacity = 0.18 + w.cloud * 0.65;
    for (const c of this.clouds) {
      c.position.x += (w.windX || 2) * dt * 1.5;
      c.position.z += (w.windZ || 0.5) * dt * 1.5;
      if (c.position.x - px > 1000) c.position.x -= 2000;
      if (c.position.x - px < -1000) c.position.x += 2000;
      if (c.position.z - pz > 1000) c.position.z -= 2000;
      if (c.position.z - pz < -1000) c.position.z += 2000;
    }
  }

  get hour() { return (this.time / DAY_LENGTH) * 24; }
  get clock() {
    const h = Math.floor(this.hour), m = Math.floor((this.hour % 1) * 60);
    return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
  }
  get isNight() { return this.dayFactor < 0.25; }
}
