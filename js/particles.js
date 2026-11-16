import * as THREE from './vendor/three.module.min.js';

function makeAtlas() {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 128;
  const x = c.getContext('2d');
  const quad = (cx, cy, inner, outer) => {
    const g = x.createRadialGradient(cx, cy, 2, cx, cy, 30);
    g.addColorStop(0, inner);
    g.addColorStop(1, outer);
    x.fillStyle = g;
    x.fillRect(cx - 32, cy - 32, 64, 64);
  };
  quad(32, 32, 'rgba(255,255,255,0.9)', 'rgba(255,255,255,0)');
  quad(96, 32, 'rgba(210,170,110,0.9)', 'rgba(210,170,110,0)');
  quad(32, 96, 'rgba(255,240,180,1)', 'rgba(255,120,20,0)');
  quad(96, 96, 'rgba(120,200,255,1)', 'rgba(0,80,255,0)');
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const BILLBOARD_VERT = `
attribute vec3 iPos;
attribute vec2 iOff;
attribute float iScale;
attribute float iAlpha;
varying vec2 vUv;
varying float vAlpha;
void main() {
  vUv = uv * 0.5 + iOff;
  vAlpha = iAlpha;
  vec3 right = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
  vec3 up = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
  vec3 p = iPos + (right * position.x + up * position.y) * iScale;
  gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
}`;

const BILLBOARD_FRAG = `
uniform sampler2D map;
varying vec2 vUv;
varying float vAlpha;
void main() {
  vec4 tex = texture2D(map, vUv);
  float a = tex.a * vAlpha;
  if (a < 0.012) discard;
  gl_FragColor = vec4(tex.rgb, a);
}`;

const SKID_VERT = `
attribute float aAlpha;
varying float vAlpha;
void main() {
  vAlpha = aAlpha;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const SKID_FRAG = `
varying float vAlpha;
void main() {
  if (vAlpha < 0.01) discard;
  gl_FragColor = vec4(0.05, 0.05, 0.055, vAlpha);
}`;

export class ParticleSystem {
  constructor(scene, quality) {
    this.scene = scene;
    this.max = Math.floor(420 * quality.particles) + 60;
    this.atlas = makeAtlas();

    this.px = new Float32Array(this.max * 3);
    this.vx = new Float32Array(this.max * 3);
    this.life = new Float32Array(this.max);
    this.maxLife = new Float32Array(this.max);
    this.grow = new Float32Array(this.max);
    this.fade0 = new Float32Array(this.max);
    this.scale0 = new Float32Array(this.max);
    this.texIdx = new Uint8Array(this.max);
    this.count = 0;

    const geo = new THREE.InstancedBufferGeometry();
    const quad = new THREE.PlaneGeometry(1, 1);
    geo.setAttribute('position', quad.attributes.position);
    geo.setAttribute('uv', quad.attributes.uv);
    geo.setIndex(quad.index);
    this.iPos = new THREE.InstancedBufferAttribute(new Float32Array(this.max * 3), 3);
    this.iOff = new THREE.InstancedBufferAttribute(new Float32Array(this.max * 2), 2);
    this.iScale = new THREE.InstancedBufferAttribute(new Float32Array(this.max), 1);
    this.iAlpha = new THREE.InstancedBufferAttribute(new Float32Array(this.max), 1);
    for (const a of [this.iPos, this.iOff, this.iScale, this.iAlpha]) a.setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('iPos', this.iPos);
    geo.setAttribute('iOff', this.iOff);
    geo.setAttribute('iScale', this.iScale);
    geo.setAttribute('iAlpha', this.iAlpha);
    geo.instanceCount = 0;
    this.billGeo = geo;

    this.billMat = new THREE.ShaderMaterial({
      uniforms: { map: { value: this.atlas } },
      vertexShader: BILLBOARD_VERT,
      fragmentShader: BILLBOARD_FRAG,
      transparent: true,
      depthWrite: false,
    });
    this.billMesh = new THREE.Mesh(geo, this.billMat);
    this.billMesh.frustumCulled = false;
    this.billMesh.renderOrder = 8;
    scene.add(this.billMesh);

    this.skidMax = Math.floor(360 * quality.particles) + 40;
    this.skidLife = new Float32Array(this.skidMax);
    this.skidCount = 0;
    this.skidCursor = 0;
    const skidGeo = new THREE.PlaneGeometry(0.28, 1);
    skidGeo.rotateX(-Math.PI / 2);
    this.skidAlpha = new THREE.InstancedBufferAttribute(new Float32Array(this.skidMax), 1);
    this.skidAlpha.setUsage(THREE.DynamicDrawUsage);
    skidGeo.setAttribute('aAlpha', this.skidAlpha);
    this.skidMat = new THREE.ShaderMaterial({
      vertexShader: SKID_VERT,
      fragmentShader: SKID_FRAG,
      transparent: true,
      depthWrite: false,
    });
    this.skidMesh = new THREE.InstancedMesh(skidGeo, this.skidMat, this.skidMax);
    this.skidMesh.frustumCulled = false;
    this.skidMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.skidMesh.renderOrder = 2;
    this.skidMesh.count = 0;
    scene.add(this.skidMesh);

    this._m4 = new THREE.Matrix4();
    this._q = new THREE.Quaternion();
    this._e = new THREE.Euler();
    this._p = new THREE.Vector3();
    this._s = new THREE.Vector3(1, 1, 1.4);
  }

  emit(texIdx, x, y, z, vx, vy, vz, size, life, grow, opacity) {
    let n;
    if (this.count >= this.max) {
      n = 0;
      let oldestT = Infinity;
      for (let i = 0; i < this.count; i++) {
        const t = this.life[i] / this.maxLife[i];
        if (t < oldestT) { oldestT = t; n = i; }
      }
    } else {
      n = this.count++;
    }
    const i3 = n * 3;
    this.px[i3] = x; this.px[i3 + 1] = y; this.px[i3 + 2] = z;
    this.vx[i3] = vx; this.vx[i3 + 1] = vy; this.vx[i3 + 2] = vz;
    this.life[n] = life; this.maxLife[n] = life;
    this.grow[n] = grow; this.fade0[n] = opacity; this.scale0[n] = size;
    this.texIdx[n] = texIdx;
  }

  smoke(x, y, z) {
    this.emit(0, x, y, z,
      (Math.random() - 0.5) * 1.2, 1.2 + Math.random(), (Math.random() - 0.5) * 1.2,
      0.7, 0.9, 2.2, 0.45);
  }
  dust(x, y, z) {
    this.emit(1, x, y, z,
      (Math.random() - 0.5) * 2, 0.8 + Math.random(), (Math.random() - 0.5) * 2,
      0.9, 1.1, 2.8, 0.5);
  }
  sparks(x, y, z, n) {
    for (let i = 0; i < n; i++) {
      this.emit(2, x, y, z,
        (Math.random() - 0.5) * 7, Math.random() * 4, (Math.random() - 0.5) * 7,
        0.22, 0.4, 0.5, 0.95);
    }
  }
  nitro(x, y, z) {
    this.emit(3, x, y, z,
      (Math.random() - 0.5) * 0.6, 0.3, (Math.random() - 0.5) * 0.6,
      0.5, 0.35, 1.6, 0.8);
  }

  skidMark(x, y, z, angle) {
    const i = this.skidCursor;
    this.skidCursor = (this.skidCursor + 1) % this.skidMax;
    this.skidLife[i] = 9;
    this._e.set(0, -angle, 0);
    this._q.setFromEuler(this._e);
    this._p.set(x, y + 0.06, z);
    this._m4.compose(this._p, this._q, this._s);
    this.skidMesh.setMatrixAt(i, this._m4);
    this.skidMesh.instanceMatrix.needsUpdate = true;
    if (this.skidCount < this.skidMax) this.skidMesh.count = ++this.skidCount;
  }

  update(dt) {
    const { px, vx, life, maxLife, grow, fade0, scale0, texIdx } = this;
    const iPosA = this.iPos.array, iOffA = this.iOff.array, iScaleA = this.iScale.array, iAlphaA = this.iAlpha.array;
    let n = 0;
    for (let i = 0; i < this.count; i++) {
      if (life[i] <= 0) continue;
      life[i] -= dt;
      if (life[i] <= 0) continue;
      const i3 = i * 3;
      vx[i3 + 1] -= 1.5 * dt;
      px[i3] += vx[i3] * dt;
      px[i3 + 1] += vx[i3 + 1] * dt;
      px[i3 + 2] += vx[i3 + 2] * dt;
      if (px[i3 + 1] < 0.1) { px[i3 + 1] = 0.1; vx[i3] *= 0.9; vx[i3 + 1] *= 0.9; vx[i3 + 2] *= 0.9; }
      const t = life[i] / maxLife[i];
      const o3 = n * 3, o2 = n * 2;
      iPosA[o3] = px[i3]; iPosA[o3 + 1] = px[i3 + 1]; iPosA[o3 + 2] = px[i3 + 2];
      iScaleA[n] = scale0[i] + (1 - t) * grow[i] * maxLife[i] * 0.5;
      iAlphaA[n] = fade0[i] * t;
      const ti = texIdx[i];
      iOffA[o2] = (ti % 2) * 0.5;
      iOffA[o2 + 1] = ti >= 2 ? 0.5 : 0;
      n++;
    }
    this.count = n;
    this.billGeo.instanceCount = n;
    if (n > 0) {
      this.iPos.needsUpdate = true;
      this.iOff.needsUpdate = true;
      this.iScale.needsUpdate = true;
      this.iAlpha.needsUpdate = true;
    }

    const sa = this.skidAlpha.array;
    let dirty = false;
    for (let i = 0; i < this.skidMax; i++) {
      if (this.skidLife[i] <= 0) continue;
      this.skidLife[i] -= dt;
      if (this.skidLife[i] <= 0) { sa[i] = 0; dirty = true; continue; }
      const a = this.skidLife[i] < 2 ? 0.5 * (this.skidLife[i] / 2) : 0.5;
      if (sa[i] !== a) { sa[i] = a; dirty = true; }
    }
    if (dirty) this.skidAlpha.needsUpdate = true;
  }

  dispose() {
    this.scene.remove(this.billMesh);
    this.scene.remove(this.skidMesh);
    this.billGeo.dispose();
    this.billMat.dispose();
    this.skidMesh.geometry.dispose();
    this.skidMat.dispose();
    this.atlas.dispose();
  }
}
