import * as THREE from './vendor/three.module.min.js';

function makeSoftTexture(inner, outer) {
  const c = document.createElement('canvas');
  c.width = 64; c.height = 64;
  const x = c.getContext('2d');
  const g = x.createRadialGradient(32, 32, 2, 32, 32, 30);
  g.addColorStop(0, inner);
  g.addColorStop(1, outer);
  x.fillStyle = g;
  x.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export class ParticleSystem {
  constructor(scene, quality) {
    this.scene = scene;
    this.max = Math.floor(420 * quality.particles) + 60;
    this.smokeTex = makeSoftTexture('rgba(255,255,255,0.9)', 'rgba(255,255,255,0)');
    this.dustTex = makeSoftTexture('rgba(210,170,110,0.9)', 'rgba(210,170,110,0)');
    this.sparkTex = makeSoftTexture('rgba(255,240,180,1)', 'rgba(255,120,20,0)');
    this.fireTex = makeSoftTexture('rgba(120,200,255,1)', 'rgba(0,80,255,0)');

    const geo = new THREE.PlaneGeometry(1, 1);
    this.pool = [];
    for (let i = 0; i < this.max; i++) {
      const mat = new THREE.MeshBasicMaterial({ map: this.smokeTex, transparent: true, opacity: 0, depthWrite: false });
      const m = new THREE.Mesh(geo, mat);
      m.visible = false;
      scene.add(m);
      this.pool.push({ mesh: m, life: 0, maxLife: 1, vel: new THREE.Vector3(), grow: 1, fade: 1 });
    }
    this.cursor = 0;

    this.skidMax = Math.floor(360 * quality.particles) + 40;
    this.skidPool = [];
    const skidGeo = new THREE.PlaneGeometry(0.28, 1);
    this.skidCursor = 0;
    for (let i = 0; i < this.skidMax; i++) {
      const mat = new THREE.MeshBasicMaterial({ color: 0x0c0c0e, transparent: true, opacity: 0, depthWrite: false });
      const m = new THREE.Mesh(skidGeo, mat);
      m.rotation.x = -Math.PI / 2;
      m.visible = false;
      scene.add(m);
      this.skidPool.push({ mesh: m, life: 0 });
    }
  }

  spawn(tex, color, pos, vel, size, life, grow, opacity) {
    const p = this.pool[this.cursor];
    this.cursor = (this.cursor + 1) % this.max;
    p.mesh.visible = true;
    p.mesh.material.map = tex;
    p.mesh.material.color.set(color);
    p.mesh.material.opacity = opacity;
    p.mesh.position.copy(pos);
    p.mesh.scale.set(size, size, size);
    p.mesh.rotation.z = Math.random() * Math.PI * 2;
    p.vel.copy(vel);
    p.life = life;
    p.maxLife = life;
    p.grow = grow;
    p.fade = opacity;
  }

  smoke(pos) {
    this.spawn(this.smokeTex, 0xdddddd, pos,
      new THREE.Vector3((Math.random() - 0.5) * 1.2, 1.2 + Math.random(), (Math.random() - 0.5) * 1.2),
      0.7, 0.9, 2.2, 0.45);
  }
  dust(pos) {
    this.spawn(this.dustTex, 0xc8a060, pos,
      new THREE.Vector3((Math.random() - 0.5) * 2, 0.8 + Math.random(), (Math.random() - 0.5) * 2),
      0.9, 1.1, 2.8, 0.5);
  }
  sparks(pos, n) {
    for (let i = 0; i < n; i++) {
      this.spawn(this.sparkTex, 0xffcc66, pos,
        new THREE.Vector3((Math.random() - 0.5) * 7, Math.random() * 4, (Math.random() - 0.5) * 7),
        0.22, 0.4, 0.5, 0.95);
    }
  }
  nitro(pos) {
    this.spawn(this.fireTex, 0x66ccff, pos,
      new THREE.Vector3((Math.random() - 0.5) * 0.6, 0.3, (Math.random() - 0.5) * 0.6),
      0.5, 0.35, 1.6, 0.8);
  }

  skidMark(x, y, z, angle) {
    const p = this.skidPool[this.skidCursor];
    this.skidCursor = (this.skidCursor + 1) % this.skidMax;
    p.mesh.visible = true;
    p.mesh.position.set(x, y + 0.06, z);
    p.mesh.rotation.z = angle;
    p.mesh.scale.set(1, 1.4, 1);
    p.mesh.material.opacity = 0.5;
    p.life = 9;
  }

  update(dt) {
    for (const p of this.pool) {
      if (p.life <= 0) continue;
      p.life -= dt;
      if (p.life <= 0) { p.mesh.visible = false; p.mesh.material.opacity = 0; continue; }
      p.mesh.position.addScaledVector(p.vel, dt);
      p.vel.y -= 1.5 * dt;
      if (p.mesh.position.y < 0.1) { p.mesh.position.y = 0.1; p.vel.multiplyScalar(0.9); }
      const t = p.life / p.maxLife;
      p.mesh.material.opacity = p.fade * t;
      const s = p.mesh.scale.x + p.grow * dt;
      p.mesh.scale.set(s, s, s);
    }
    for (const p of this.skidPool) {
      if (p.life <= 0) continue;
      p.life -= dt;
      if (p.life <= 0) { p.mesh.visible = false; continue; }
      if (p.life < 2) p.mesh.material.opacity = 0.5 * (p.life / 2);
    }
  }

  dispose() {
    for (const p of this.pool) { this.scene.remove(p.mesh); p.mesh.material.dispose(); }
    for (const p of this.skidPool) { this.scene.remove(p.mesh); p.mesh.material.dispose(); }
  }
}
