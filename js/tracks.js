import * as THREE from './vendor/three.module.min.js';
import { mulberry32, clamp } from './utils.js';
import { mergeGeoms, boxGeo, cylGeo } from './merge.js';

export const TRACKS = [
  {
    id: 'cidade', name: 'Cidade Neon', theme: 'city', width: 11, shoulder: 2.2, laps: 3, seed: 11,
    desc: 'Ruas largas entre arranha-céus iluminados.',
    points: [[0, 0, 0], [130, 10, 0], [210, 60, 0], [230, 150, 2], [170, 230, 4], [60, 250, 3], [-50, 210, 1], [-90, 120, 0], [-70, 40, 0]],
  },
  {
    id: 'serra', name: 'Serra Verde', theme: 'mountain', width: 8.5, shoulder: 2.6, laps: 3, seed: 27,
    desc: 'Curvas fechadas e subidas na floresta.',
    points: [[0, 0, 0], [90, -20, 5], [170, -60, 12], [200, -140, 20], [150, -210, 26], [50, -230, 22], [-50, -190, 14], [-80, -110, 7], [-40, -30, 2]],
  },
  {
    id: 'rodovia', name: 'Rodovia Infinito', theme: 'highway', width: 13, shoulder: 2.4, laps: 3, seed: 43,
    desc: 'Retas longas para velocidade máxima.',
    points: [[0, 0, 0], [260, 0, 0], [360, 70, 0], [390, 190, 0], [310, 310, 2], [150, 350, 4], [0, 330, 3], [-130, 270, 1], [-170, 140, 0], [-100, 40, 0]],
  },
  {
    id: 'autodromo', name: 'Autódromo Velocità', theme: 'circuit', width: 10.5, shoulder: 3, laps: 3, seed: 58,
    desc: 'Pista profissional com zebra e arquibancadas.',
    points: [[0, 0, 0], [150, -15, 0], [245, 35, 0], [265, 115, 0], [205, 155, 0], [245, 225, 0], [180, 285, 0], [80, 295, 0], [15, 235, 0], [-65, 265, 0], [-145, 215, 0], [-155, 120, 0], [-90, 55, 0]],
  },
  {
    id: 'deserto', name: 'Dunas Escaldantes', theme: 'desert', width: 12, shoulder: 4, laps: 3, seed: 77,
    desc: 'Paisagem aberta, areia e cactos gigantes.',
    points: [[0, 0, 0], [170, -25, 0], [290, 45, 0], [330, 170, 0], [250, 250, 3], [120, 225, 5], [55, 305, 8], [-70, 330, 6], [-170, 250, 3], [-150, 120, 1], [-60, 30, 0]],
  },
];

export const THEMES = {
  city: {
    skyTop: 0x0d1b3a, skyBottom: 0xff8c42, fog: 0x1a2340, fogDensity: 0.0022,
    ground: 0x2a2d33, road: 0x33363c, sun: 0xffd9a0, sunPos: [-0.5, 0.4, -0.6], sunInt: 1.6,
    hemiSky: 0x33456e, hemiGround: 0x1c1e24, hemiInt: 0.75, ambient: 0.25,
  },
  mountain: {
    skyTop: 0x2f6fd0, skyBottom: 0xbfe3ff, fog: 0xa8cbe8, fogDensity: 0.0026,
    ground: 0x3f7a34, road: 0x3a3d42, sun: 0xfff4e0, sunPos: [0.6, 0.8, 0.3], sunInt: 2.2,
    hemiSky: 0x9cc4ff, hemiGround: 0x2e5426, hemiInt: 0.9, ambient: 0.3,
  },
  highway: {
    skyTop: 0x1e63c8, skyBottom: 0x9fd4ff, fog: 0x9cc4e8, fogDensity: 0.0016,
    ground: 0x4a7c3a, road: 0x3c4046, sun: 0xfff8ea, sunPos: [0.3, 0.9, 0.4], sunInt: 2.4,
    hemiSky: 0xaad4ff, hemiGround: 0x3a6428, hemiInt: 1.0, ambient: 0.35,
  },
  circuit: {
    skyTop: 0x1465c8, skyBottom: 0xcfe8ff, fog: 0xb0d0ee, fogDensity: 0.0014,
    ground: 0x4e8a3c, road: 0x41454b, sun: 0xffffff, sunPos: [0.4, 1, 0.2], sunInt: 2.6,
    hemiSky: 0xb8dcff, hemiGround: 0x3f6e2e, hemiInt: 1.05, ambient: 0.4,
  },
  desert: {
    skyTop: 0x2a7ad4, skyBottom: 0xffe0b0, fog: 0xe8c896, fogDensity: 0.0018,
    ground: 0xd8b070, road: 0x4a4640, sun: 0xfff0d0, sunPos: [-0.3, 0.9, 0.5], sunInt: 2.8,
    hemiSky: 0xcfe0ff, hemiGround: 0xc09858, hemiInt: 1.1, ambient: 0.45,
  },
};

function makeAsphaltTexture(theme) {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 256;
  const x = c.getContext('2d');
  x.fillStyle = '#3a3d42';
  x.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 2600; i++) {
    const g = 40 + Math.random() * 45;
    x.fillStyle = `rgb(${g},${g},${g + 4})`;
    x.fillRect(Math.random() * 256, Math.random() * 256, 2, 2);
  }
  x.fillStyle = '#e8e8e8';
  x.fillRect(6, 0, 5, 256);
  x.fillRect(245, 0, 5, 256);
  x.fillStyle = '#f4d03f';
  for (let y = 0; y < 256; y += 64) x.fillRect(125, y, 6, 34);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function makeCurbTexture() {
  const c = document.createElement('canvas');
  c.width = 64; c.height = 64;
  const x = c.getContext('2d');
  x.fillStyle = '#d8d8d8'; x.fillRect(0, 0, 64, 64);
  x.fillStyle = '#cc2222'; x.fillRect(0, 0, 64, 32);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping; tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeCheckerTexture() {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 32;
  const x = c.getContext('2d');
  for (let i = 0; i < 16; i++) for (let j = 0; j < 4; j++) {
    x.fillStyle = (i + j) % 2 ? '#111' : '#eee';
    x.fillRect(i * 8, j * 8, 8, 8);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeWindowTexture(rng) {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 256;
  const x = c.getContext('2d');
  x.fillStyle = '#1c2430'; x.fillRect(0, 0, 128, 256);
  for (let wy = 8; wy < 250; wy += 16) {
    for (let wx = 8; wx < 122; wx += 14) {
      const lit = rng() < 0.45;
      x.fillStyle = lit ? (rng() < 0.5 ? '#ffd98a' : '#bfe0ff') : '#0d1420';
      x.fillRect(wx, wy, 9, 10);
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeCloudTexture() {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 64;
  const x = c.getContext('2d');
  for (let i = 0; i < 14; i++) {
    const gx = 20 + Math.random() * 88, gy = 22 + Math.random() * 24, r = 12 + Math.random() * 18;
    const grad = x.createRadialGradient(gx, gy, 2, gx, gy, r);
    grad.addColorStop(0, 'rgba(255,255,255,0.85)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = grad;
    x.beginPath(); x.arc(gx, gy, r, 0, 7); x.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function ribbonGeometry(samples, innerOff, outerOff, yOff, vScale) {
  const n = samples.length;
  const pos = new Float32Array((n + 1) * 2 * 3);
  const uv = new Float32Array((n + 1) * 2 * 2);
  const idx = [];
  for (let i = 0; i <= n; i++) {
    const s = samples[i % n];
    const cx = s.pos.x, cz = s.pos.z, y = s.pos.y + yOff;
    const nx = -s.tan.z, nz = s.tan.x;
    const o = i * 6;
    pos[o] = cx + nx * innerOff; pos[o + 1] = y; pos[o + 2] = cz + nz * innerOff;
    pos[o + 3] = cx + nx * outerOff; pos[o + 4] = y; pos[o + 5] = cz + nz * outerOff;
    const uo = i * 4;
    const v = (i === n ? n : i) * vScale;
    uv[uo] = 0; uv[uo + 1] = v;
    uv[uo + 2] = 1; uv[uo + 3] = v;
    if (i < n) {
      const a = i * 2;
      idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return geo;
}

function verticalRibbon(samples, off, y0, y1) {
  const n = samples.length;
  const pos = new Float32Array((n + 1) * 2 * 3);
  const idx = [];
  for (let i = 0; i <= n; i++) {
    const s = samples[i % n];
    const nx = -s.tan.z, nz = s.tan.x;
    const x = s.pos.x + nx * off, z = s.pos.z + nz * off, y = s.pos.y;
    const o = i * 6;
    pos[o] = x; pos[o + 1] = y + y0; pos[o + 2] = z;
    pos[o + 3] = x; pos[o + 4] = y + y1; pos[o + 5] = z;
    if (i < n) {
      const a = i * 2;
      idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return geo;
}

export class Track {
  constructor(def, quality, renderer) {
    this.def = def;
    this.theme = THEMES[def.theme];
    this.quality = quality;
    this.halfWidth = def.width;
    this.shoulder = def.shoulder;
    this.group = new THREE.Group();
    this.colliders = [];
    this.colliderGrid = new Map();
    this.rng = mulberry32(def.seed * 7919);

    const pts = def.points.map((p) => new THREE.Vector3(p[0], p[2], p[1]));
    this.curve = new THREE.CatmullRomCurve3(pts, true, 'catmullrom', 0.5);
    this.length = this.curve.getLength();
    const N = this.sampleCount = Math.max(240, Math.round(this.length / 2.2));
    this.samples = [];
    for (let i = 0; i < N; i++) {
      const t = i / N;
      const pos = this.curve.getPointAt(t);
      const tan = this.curve.getTangentAt(t);
      tan.y = 0;
      const len = Math.hypot(tan.x, tan.z) || 1;
      tan.x /= len; tan.z /= len;
      this.samples.push({ pos, tan, curv: 0 });
    }
    for (let i = 0; i < N; i++) {
      const a = this.samples[(i - 3 + N) % N].tan;
      const b = this.samples[(i + 3) % N].tan;
      const ang = Math.acos(clamp(a.x * b.x + a.z * b.z, -1, 1));
      const dist = 6 * (this.length / N);
      this.samples[i].curv = ang / Math.max(dist, 0.001);
    }

    this.buildSky();
    this.buildRoad();
    this.buildTerrain();
    this.buildProps();
    this.buildLighting(renderer);
    this.buildMinimap();

    this.clouds = [];
    this.group.traverse((o) => { if (o.userData.cloud) this.clouds.push(o); });
  }

  buildSky() {
    const th = this.theme;
    const skyGeo = new THREE.SphereGeometry(1500, 20, 12);
    const skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false,
      uniforms: {
        top: { value: new THREE.Color(th.skyTop) },
        bottom: { value: new THREE.Color(th.skyBottom) },
        sunDir: { value: new THREE.Vector3(...th.sunPos).normalize() },
        sunColor: { value: new THREE.Color(th.sun) },
      },
      vertexShader: `varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: `varying vec3 vP; uniform vec3 top; uniform vec3 bottom; uniform vec3 sunDir; uniform vec3 sunColor;
        void main(){ vec3 d = normalize(vP); float h = clamp(d.y*1.5+0.18, 0.0, 1.0);
        vec3 col = mix(bottom, top, h);
        float s = max(dot(d, sunDir), 0.0);
        col += sunColor * (pow(s, 220.0)*1.4 + pow(s, 6.0)*0.22);
        gl_FragColor = vec4(col, 1.0); }`,
    });
    const sky = new THREE.Mesh(skyGeo, skyMat);
    sky.frustumCulled = false;
    this.group.add(sky);

    const cloudTex = makeCloudTexture();
    const cloudMat = new THREE.SpriteMaterial({ map: cloudTex, transparent: true, opacity: 0.8, depthWrite: false, fog: false });
    for (let i = 0; i < 14; i++) {
      const sp = new THREE.Sprite(cloudMat);
      const ang = this.rng() * Math.PI * 2;
      const dist = 200 + this.rng() * 700;
      sp.position.set(Math.cos(ang) * dist, 130 + this.rng() * 160, Math.sin(ang) * dist);
      const sc = 90 + this.rng() * 160;
      sp.scale.set(sc, sc * 0.45, 1);
      sp.userData.cloud = { speed: 1.5 + this.rng() * 2.5 };
      this.group.add(sp);
    }
  }

  buildRoad() {
    const s = this.samples;
    const roadTex = makeAsphaltTexture(this.theme);
    roadTex.repeat.set(1, 1);
    const roadMat = new THREE.MeshStandardMaterial({ map: roadTex, roughness: 0.92, metalness: 0.05 });
    const roadGeo = ribbonGeometry(s, -this.halfWidth, this.halfWidth, 0.05, 1);
    const uv = roadGeo.getAttribute('uv');
    const rep = this.length / 8;
    for (let i = 0; i < uv.count; i += 2) {
      const row = Math.floor(i / 2);
      const v = Math.min(row, this.sampleCount) / this.sampleCount * rep;
      uv.setY(i, v); uv.setY(i + 1, v);
    }
    const road = new THREE.Mesh(roadGeo, roadMat);
    road.receiveShadow = true;
    this.group.add(road);

    const dirtMat = new THREE.MeshStandardMaterial({ color: this.theme.ground, roughness: 1 });
    for (const side of [1, -1]) {
      const sh = new THREE.Mesh(ribbonGeometry(s, this.halfWidth * side, (this.halfWidth + this.shoulder) * side, 0.02, 1), dirtMat);
      sh.receiveShadow = true;
      this.group.add(sh);
    }

    if (this.def.theme === 'circuit') {
      const curbTex = makeCurbTexture();
      curbTex.repeat.set(1, this.length / 4);
      const curbMat = new THREE.MeshStandardMaterial({ map: curbTex, roughness: 0.7 });
      for (const side of [1, -1]) {
        const curb = new THREE.Mesh(ribbonGeometry(s, (this.halfWidth - 0.1) * side, (this.halfWidth + 0.9) * side, 0.07, 1), curbMat);
        this.group.add(curb);
      }
    }

    const checker = makeCheckerTexture();
    const startS = this.samples[0];
    const start = new THREE.Mesh(new THREE.PlaneGeometry(this.halfWidth * 2, 3), new THREE.MeshStandardMaterial({ map: checker, roughness: 0.8 }));
    start.rotation.x = -Math.PI / 2;
    start.rotation.z = -Math.atan2(startS.tan.x, startS.tan.z);
    start.position.set(startS.pos.x, startS.pos.y + 0.08, startS.pos.z);
    this.group.add(start);

    const gantry = new THREE.Group();
    const postMat = new THREE.MeshStandardMaterial({ color: 0x2a2e35, metalness: 0.7, roughness: 0.4 });
    for (const side of [1, -1]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.5, 7, 0.5), postMat);
      post.position.set(side * (this.halfWidth + 1), 3.5, 0);
      gantry.add(post);
    }
    const bannerCanvas = document.createElement('canvas');
    bannerCanvas.width = 512; bannerCanvas.height = 64;
    const bx = bannerCanvas.getContext('2d');
    bx.fillStyle = '#0a0e14'; bx.fillRect(0, 0, 512, 64);
    bx.fillStyle = '#ff6a00'; bx.font = 'italic 900 40px Arial'; bx.textAlign = 'center';
    bx.fillText('EXTREME RACING 3D', 256, 46);
    const bannerTex = new THREE.CanvasTexture(bannerCanvas);
    bannerTex.colorSpace = THREE.SRGBColorSpace;
    const banner = new THREE.Mesh(new THREE.PlaneGeometry(this.halfWidth * 2 + 2, 1.6), new THREE.MeshBasicMaterial({ map: bannerTex, side: THREE.DoubleSide }));
    banner.position.set(0, 6.4, 0);
    gantry.add(banner);
    gantry.position.set(startS.pos.x, startS.pos.y, startS.pos.z);
    gantry.rotation.y = Math.atan2(startS.tan.x, startS.tan.z);
    this.group.add(gantry);
  }

  buildTerrain() {
    const th = this.theme;
    const ground = new THREE.Mesh(new THREE.CircleGeometry(1400, 48), new THREE.MeshStandardMaterial({ color: th.ground, roughness: 1 }));
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.08;
    ground.receiveShadow = true;
    this.group.add(ground);

    if (this.def.theme === 'mountain') {
      const mat = new THREE.MeshStandardMaterial({ color: 0x2e5e28, roughness: 1, flatShading: true });
      for (let i = 0; i < 26; i++) {
        const ang = (i / 26) * Math.PI * 2 + this.rng() * 0.2;
        const dist = 500 + this.rng() * 500;
        const h = 120 + this.rng() * 220;
        const m = new THREE.Mesh(new THREE.ConeGeometry(90 + this.rng() * 120, h, 6), mat);
        m.position.set(Math.cos(ang) * dist, h / 2 - 10, Math.sin(ang) * dist);
        m.rotation.y = this.rng() * 3;
        this.group.add(m);
      }
    }
    if (this.def.theme === 'desert') {
      const mat = new THREE.MeshStandardMaterial({ color: 0xcfa060, roughness: 1, flatShading: true });
      for (let i = 0; i < 30; i++) {
        const ang = this.rng() * Math.PI * 2;
        const dist = 150 + this.rng() * 600;
        const sc = 30 + this.rng() * 70;
        const m = new THREE.Mesh(new THREE.SphereGeometry(1, 8, 6), mat);
        m.scale.set(sc, sc * 0.16, sc * 0.7);
        m.position.set(Math.cos(ang) * dist, -2, Math.sin(ang) * dist);
        this.group.add(m);
      }
    }
  }

  addCollider(x, z, r) {
    const idx = this.colliders.length;
    this.colliders.push({ x, z, r });
    const cell = 20;
    const x0 = Math.floor((x - r) / cell), x1 = Math.floor((x + r) / cell);
    const z0 = Math.floor((z - r) / cell), z1 = Math.floor((z + r) / cell);
    for (let cx = x0; cx <= x1; cx++) for (let cz = z0; cz <= z1; cz++) {
      const key = cx + '_' + cz;
      if (!this.colliderGrid.has(key)) this.colliderGrid.set(key, []);
      this.colliderGrid.get(key).push(idx);
    }
  }

  queryColliders(x, z, r) {
    const cell = 20;
    const out = [];
    const x0 = Math.floor((x - r) / cell), x1 = Math.floor((x + r) / cell);
    const z0 = Math.floor((z - r) / cell), z1 = Math.floor((z + r) / cell);
    for (let cx = x0; cx <= x1; cx++) for (let cz = z0; cz <= z1; cz++) {
      const arr = this.colliderGrid.get(cx + '_' + cz);
      if (arr) for (const i of arr) {
        const c = this.colliders[i];
        if (!c._seen) { c._seen = true; out.push(c); }
      }
    }
    for (const c of out) c._seen = false;
    return out;
  }

  buildProps() {
    const density = this.quality.props;
    const theme = this.def.theme;
    const rng = this.rng;
    const s = this.samples;
    const step = Math.max(1, Math.round(14 / (this.length / this.sampleCount)));

    if (theme === 'city') {
      const winTex = makeWindowTexture(rng);
      const winTex2 = makeWindowTexture(rng);
      const mats = [
        new THREE.MeshStandardMaterial({ map: winTex, emissiveMap: winTex, emissive: 0xffffff, emissiveIntensity: 0.55, roughness: 0.8 }),
        new THREE.MeshStandardMaterial({ map: winTex2, emissiveMap: winTex2, emissive: 0xffffff, emissiveIntensity: 0.5, roughness: 0.8, color: 0x8a93a8 }),
      ];
      const buckets = [[], []];
      for (let i = 0; i < s.length; i += step) {
        for (const side of [1, -1]) {
          if (rng() > 0.75 * density) continue;
          const w = 10 + rng() * 16, d = 10 + rng() * 16, h = 10 + rng() * 40;
          const off = this.halfWidth + Math.max(w, d) / 2 + 3 + rng() * 20;
          const nx = -s[i].tan.z * side, nz = s[i].tan.x * side;
          const x = s[i].pos.x + nx * off, z = s[i].pos.z + nz * off;
          const g = new THREE.BoxGeometry(w, h, d);
          const uv = g.attributes.uv;
          for (let vi = 0; vi < uv.count; vi++) uv.setXY(vi, uv.getX(vi) * (w / 6), uv.getY(vi) * (h / 6));
          const m4 = new THREE.Matrix4().makeRotationY(rng() * Math.PI);
          m4.setPosition(x, h / 2 - 0.5, z);
          const mi = Math.floor(rng() * mats.length);
          buckets[mi].push({ geo: g, matrix: m4 });
          this.addCollider(x, z, Math.hypot(w, d) / 2 * 0.8);
        }
      }
      for (let k = 0; k < 2; k++) {
        if (buckets[k].length) this.group.add(new THREE.Mesh(mergeGeoms(buckets[k]), mats[k]));
      }
      const poleMat = new THREE.MeshStandardMaterial({ color: 0x3a4048, metalness: 0.7, roughness: 0.4 });
      const lampMat = new THREE.MeshStandardMaterial({ color: 0xfff2c0, emissive: 0xffe9a8, emissiveIntensity: 2.2 });
      const poleItems = [], lampItems = [];
      for (let i = 0; i < s.length; i += step * 3) {
        const side = (i / (step * 3)) % 2 < 1 ? 1 : -1;
        const nx = -s[i].tan.z * side, nz = s[i].tan.x * side;
        const poleDist = this.halfWidth + this.shoulder + 0.8;
        const x = s[i].pos.x + nx * poleDist, z = s[i].pos.z + nz * poleDist;
        poleItems.push({ geo: cylGeo(0.12, 0.16, 7, 6, x, s[i].pos.y + 3.5, z) });
        lampItems.push({ geo: boxGeo(0.9, 0.2, 0.4, x - nx * 1.2, s[i].pos.y + 6.9, z - nz * 1.2) });
        this.addCollider(x, z, 0.4);
      }
      if (poleItems.length) {
        this.group.add(new THREE.Mesh(mergeGeoms(poleItems), poleMat));
        this.group.add(new THREE.Mesh(mergeGeoms(lampItems), lampMat));
      }
    }

    if (theme === 'mountain' || theme === 'highway') {
      const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5a4028, roughness: 1 });
      const leafMatA = new THREE.MeshStandardMaterial({ color: 0x2d6a2d, roughness: 1, flatShading: true });
      const leafMatB = new THREE.MeshStandardMaterial({ color: 0x3d8a3a, roughness: 1, flatShading: true });
      const trunkGeo = new THREE.CylinderGeometry(0.22, 0.34, 2.2, 6);
      const leafGeo = new THREE.ConeGeometry(1.6, 3.6, 7);
      const count = Math.floor(190 * density * (theme === 'mountain' ? 1.4 : 0.5));
      const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, count);
      const leaves = new THREE.InstancedMesh(leafGeo, leafMatA, count);
      const leaves2 = new THREE.InstancedMesh(leafGeo, leafMatB, Math.floor(count / 3));
      leaves.castShadow = true;
      const m4 = new THREE.Matrix4();
      let ti = 0, l2 = 0;
      for (let k = 0; k < count; k++) {
        const i = Math.floor(rng() * s.length);
        const side = rng() < 0.5 ? 1 : -1;
        const off = this.halfWidth + 4 + rng() * (theme === 'mountain' ? 55 : 30);
        const nx = -s[i].tan.z * side, nz = s[i].tan.x * side;
        const x = s[i].pos.x + nx * off, z = s[i].pos.z + nz * off;
        const sc = 0.7 + rng() * 1.1;
        m4.makeScale(sc, sc, sc);
        m4.setPosition(x, s[i].pos.y + 1.1 * sc, z);
        trunks.setMatrixAt(ti, m4);
        m4.makeScale(sc, sc, sc);
        m4.setPosition(x, s[i].pos.y + (2.2 + 1.8) * sc, z);
        leaves.setMatrixAt(ti, m4);
        if (k % 3 === 0 && l2 < leaves2.count) {
          m4.setPosition(x + 1.5, s[i].pos.y + 2.4 * sc, z - 1);
          leaves2.setMatrixAt(l2++, m4);
        }
        if (rng() < 0.4) this.addCollider(x, z, 0.55 * sc);
        ti++;
      }
      this.group.add(trunks, leaves, leaves2);
    }

    if (theme === 'highway') {
      const railMat = new THREE.MeshStandardMaterial({ color: 0xb8c0c8, metalness: 0.85, roughness: 0.3 });
      for (const side of [1, -1]) {
        const rail = new THREE.Mesh(verticalRibbon(s, (this.halfWidth + 0.6) * side, 0.45, 0.85), railMat);
        this.group.add(rail);
      }
      const postGeo = new THREE.BoxGeometry(0.14, 0.85, 0.14);
      const postCount = Math.floor(s.length / 6) * 2;
      const posts = new THREE.InstancedMesh(postGeo, railMat, postCount);
      const m4 = new THREE.Matrix4();
      let pi = 0;
      for (let i = 0; i < s.length && pi < postCount; i += 6) {
        for (const side of [1, -1]) {
          const nx = -s[i].tan.z * side, nz = s[i].tan.x * side;
          m4.setPosition(s[i].pos.x + nx * (this.halfWidth + 0.6), s[i].pos.y + 0.42, s[i].pos.z + nz * (this.halfWidth + 0.6));
          posts.setMatrixAt(pi++, m4);
        }
      }
      this.group.add(posts);
      const signMat = new THREE.MeshStandardMaterial({ color: 0x1a6a3a, roughness: 0.6 });
      const postMat2 = new THREE.MeshStandardMaterial({ color: 0x8a8f96, metalness: 0.6, roughness: 0.5 });
      const postItems = [], boardItems = [];
      for (let i = 0; i < s.length; i += step * 7) {
        const side = rng() < 0.5 ? 1 : -1;
        const nx = -s[i].tan.z * side, nz = s[i].tan.x * side;
        const x = s[i].pos.x + nx * (this.halfWidth + this.shoulder + 1.2), z = s[i].pos.z + nz * (this.halfWidth + this.shoulder + 1.2);
        postItems.push({ geo: cylGeo(0.1, 0.1, 3.4, 6, x, s[i].pos.y + 1.7, z) });
        boardItems.push({ geo: boxGeo(2.6, 1.3, 0.1, x, s[i].pos.y + 3.6, z, Math.atan2(s[i].tan.x, s[i].tan.z)) });
        this.addCollider(x, z, 0.4);
      }
      if (postItems.length) {
        this.group.add(new THREE.Mesh(mergeGeoms(postItems), postMat2));
        this.group.add(new THREE.Mesh(mergeGeoms(boardItems), signMat));
      }
    }

    if (theme === 'circuit') {
      const standItems = [];
      const seatColors = [0xcc3344, 0x3366cc, 0xffcc33, 0x33aa66];
      const seatRGB = seatColors.map((c) => { const col = new THREE.Color(c); return [col.r, col.g, col.b]; });
      const backRGB = [0.78, 0.8, 0.83];
      for (let i = 0; i < s.length; i += step * 5) {
        if (rng() > 0.65 * density) continue;
        const side = rng() < 0.5 ? 1 : -1;
        const nx = -s[i].tan.z * side, nz = s[i].tan.x * side;
        const off = this.halfWidth + 11 + rng() * 4;
        const x = s[i].pos.x + nx * off, z = s[i].pos.z + nz * off;
        const rot = Math.atan2(s[i].tan.x, s[i].tan.z) + (side > 0 ? 0 : Math.PI);
        const m4 = new THREE.Matrix4().makeRotationY(rot);
        m4.setPosition(x, s[i].pos.y, z);
        for (let r = 0; r < 4; r++) {
          standItems.push({ geo: boxGeo(24, 1.2, 2.4, 0, 0.6 + r * 1.1, -r * 2.2), matrix: m4, color: seatRGB[Math.floor(rng() * 4)] });
        }
        standItems.push({ geo: boxGeo(24, 6, 0.6, 0, 3, -8.6), matrix: m4, color: backRGB });
        this.addCollider(x, z, 9);
      }
      if (standItems.length) {
        this.group.add(new THREE.Mesh(mergeGeoms(standItems), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8 })));
      }
      const tireMat = new THREE.MeshStandardMaterial({ color: 0x14161a, roughness: 0.95 });
      const tireGeo = new THREE.TorusGeometry(0.55, 0.24, 8, 14);
      const tireCount = 140;
      const tires = new THREE.InstancedMesh(tireGeo, tireMat, tireCount);
      const m4 = new THREE.Matrix4();
      let ti = 0;
      for (let i = 0; i < s.length && ti < tireCount; i++) {
        if (s[i].curv < 0.012 || rng() > 0.5) continue;
        const side = s[i].curvSign || (rng() < 0.5 ? 1 : -1);
        const nx = -s[i].tan.z * side, nz = s[i].tan.x * side;
        const x = s[i].pos.x + nx * (this.halfWidth + this.shoulder + 1), z = s[i].pos.z + nz * (this.halfWidth + this.shoulder + 1);
        m4.setPosition(x, s[i].pos.y + 0.3, z);
        tires.setMatrixAt(ti++, m4);
        if (ti < tireCount) { m4.setPosition(x + 1.2, s[i].pos.y + 0.3, z + 0.4); tires.setMatrixAt(ti++, m4); }
        this.addCollider(x, z, 0.8);
      }
      this.group.add(tires);
    }

    if (theme === 'desert') {
      const cactusMat = new THREE.MeshStandardMaterial({ color: 0x3a7a3a, roughness: 0.9 });
      const rockMat = new THREE.MeshStandardMaterial({ color: 0x9a7a52, roughness: 1, flatShading: true });
      const cactusCount = Math.floor(70 * density);
      const rockCount = Math.floor(90 * density);
      const cactusGeo = new THREE.CylinderGeometry(0.32, 0.4, 3.4, 7);
      const cacti = new THREE.InstancedMesh(cactusGeo, cactusMat, cactusCount);
      cacti.castShadow = true;
      const rockGeo = new THREE.DodecahedronGeometry(1, 0);
      const rocks = new THREE.InstancedMesh(rockGeo, rockMat, rockCount);
      rocks.castShadow = true;
      const m4 = new THREE.Matrix4();
      for (let k = 0; k < cactusCount; k++) {
        const i = Math.floor(rng() * s.length);
        const side = rng() < 0.5 ? 1 : -1;
        const off = this.halfWidth + 5 + rng() * 60;
        const nx = -s[i].tan.z * side, nz = s[i].tan.x * side;
        const x = s[i].pos.x + nx * off, z = s[i].pos.z + nz * off;
        const sc = 0.7 + rng() * 1;
        m4.makeScale(sc, sc, sc);
        m4.setPosition(x, s[i].pos.y + 1.7 * sc, z);
        cacti.setMatrixAt(k, m4);
        if (rng() < 0.5) this.addCollider(x, z, 0.5 * sc);
      }
      for (let k = 0; k < rockCount; k++) {
        const i = Math.floor(rng() * s.length);
        const side = rng() < 0.5 ? 1 : -1;
        const off = this.halfWidth + 4 + rng() * 70;
        const nx = -s[i].tan.z * side, nz = s[i].tan.x * side;
        const x = s[i].pos.x + nx * off, z = s[i].pos.z + nz * off;
        const sc = 0.5 + rng() * 2.2;
        m4.makeScale(sc, sc * 0.7, sc);
        m4.setPosition(x, s[i].pos.y + 0.3 * sc, z);
        rocks.setMatrixAt(k, m4);
        if (sc > 1 && rng() < 0.6) this.addCollider(x, z, sc * 0.8);
      }
      this.group.add(cacti, rocks);
    }
  }

  buildLighting(renderer) {
    const th = this.theme;
    this.hemi = new THREE.HemisphereLight(th.hemiSky, th.hemiGround, th.hemiInt);
    this.group.add(this.hemi);
    this.ambient = new THREE.AmbientLight(0xffffff, th.ambient);
    this.group.add(this.ambient);
    this.sun = new THREE.DirectionalLight(th.sun, th.sunInt);
    this.sun.position.set(th.sunPos[0] * 100, th.sunPos[1] * 100, th.sunPos[2] * 100);
    if (this.quality.shadows) {
      this.sun.castShadow = true;
      this.sun.shadow.mapSize.set(this.quality.shadowSize, this.quality.shadowSize);
      this.sun.shadow.camera.near = 10;
      this.sun.shadow.camera.far = 400;
      const d = 70;
      this.sun.shadow.camera.left = -d; this.sun.shadow.camera.right = d;
      this.sun.shadow.camera.top = d; this.sun.shadow.camera.bottom = -d;
      this.sun.shadow.bias = -0.0004;
    }
    this.group.add(this.sun);
    this.group.add(this.sun.target);

    if (renderer) {
      const pmrem = new THREE.PMREMGenerator(renderer);
      const c = document.createElement('canvas');
      c.width = 32; c.height = 64;
      const x = c.getContext('2d');
      const grad = x.createLinearGradient(0, 0, 0, 64);
      grad.addColorStop(0, '#' + new THREE.Color(th.skyTop).getHexString());
      grad.addColorStop(0.5, '#' + new THREE.Color(th.skyBottom).getHexString());
      grad.addColorStop(0.52, '#' + new THREE.Color(th.ground).getHexString());
      grad.addColorStop(1, '#' + new THREE.Color(th.ground).getHexString());
      x.fillStyle = grad;
      x.fillRect(0, 0, 32, 64);
      const tex = new THREE.CanvasTexture(c);
      tex.mapping = THREE.EquirectangularReflectionMapping;
      tex.colorSpace = THREE.SRGBColorSpace;
      const rt = pmrem.fromEquirectangular(tex);
      this.envMap = rt.texture;
      this.envRT = rt;
      tex.dispose();
      pmrem.dispose();
    }
  }

  buildMinimap() {
    const pts = [];
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    for (let i = 0; i < this.sampleCount; i += 4) {
      const p = this.samples[i].pos;
      pts.push([p.x, p.z]);
      if (p.x < minX) minX = p.x; if (p.x > maxX) maxX = p.x;
      if (p.z < minZ) minZ = p.z; if (p.z > maxZ) maxZ = p.z;
    }
    const w = maxX - minX, h = maxZ - minZ;
    const scale = 1 / Math.max(w, h);
    this.minimapPts = pts.map(([x, z]) => [(x - minX) * scale, (z - minZ) * scale, w * scale, h * scale]);
    this.minimapBounds = { minX, minZ, scale };
  }

  toMinimap(x, z) {
    const b = this.minimapBounds;
    return [(x - b.minX) * b.scale, (z - b.minZ) * b.scale];
  }

  nearest(pos, hint = 0) {
    const s = this.samples;
    const N = this.sampleCount;
    let best = -1, bestD = Infinity;
    const window = 30;
    for (let k = -window; k <= window; k++) {
      const i = ((hint + k) % N + N) % N;
      const dx = pos.x - s[i].pos.x, dz = pos.z - s[i].pos.z;
      const d = dx * dx + dz * dz;
      if (d < bestD) { bestD = d; best = i; }
    }
    if (bestD > 2500) {
      for (let i = 0; i < N; i += 5) {
        const dx = pos.x - s[i].pos.x, dz = pos.z - s[i].pos.z;
        const d = dx * dx + dz * dz;
        if (d < bestD) { bestD = d; best = i; }
      }
    }
    const sm = s[best];
    const nx = -sm.tan.z, nz = sm.tan.x;
    const lateral = (pos.x - sm.pos.x) * nx + (pos.z - sm.pos.z) * nz;
    return {
      index: best,
      s: (best / N) * this.length,
      lateral,
      tangent: sm.tan,
      pos: sm.pos,
      height: sm.pos.y,
      curv: sm.curv,
    };
  }

  sampleIndexAtS(sIdx) {
    const N = this.sampleCount;
    return ((Math.round(sIdx) % N) + N) % N;
  }

  pointAtS(s) {
    const N = this.sampleCount;
    let f = ((s / this.length) % 1 + 1) % 1;
    const fi = f * N;
    const i0 = Math.floor(fi) % N;
    const i1 = (i0 + 1) % N;
    const a = this.samples[i0], b = this.samples[i1];
    const t = fi - Math.floor(fi);
    return {
      pos: new THREE.Vector3().lerpVectors(a.pos, b.pos, t),
      tan: a.tan,
    };
  }

  heightAtS(s) {
    const N = this.sampleCount;
    const f = ((s / this.length) % 1 + 1) % 1;
    const fi = f * N;
    const i0 = Math.floor(fi) % N;
    const i1 = (i0 + 1) % N;
    const t = fi - Math.floor(fi);
    return this.samples[i0].pos.y + (this.samples[i1].pos.y - this.samples[i0].pos.y) * t;
  }

  sampleAhead(s, d) {
    return this.pointAtS(s + d);
  }

  curvatureAhead(s, d) {
    const N = this.sampleCount;
    const i0 = Math.floor((s / this.length) * N);
    const steps = Math.max(2, Math.floor(d / (this.length / N)));
    let maxC = 0;
    for (let k = 0; k <= steps; k++) {
      const c = this.samples[(i0 + k) % N].curv;
      if (c > maxC) maxC = c;
    }
    return Math.max(maxC, 1e-4);
  }

  spawn(count) {
    const out = [];
    for (let i = 0; i < count; i++) {
      const sBack = this.length - 10 - i * 7;
      const p = this.pointAtS(sBack);
      const lat = i % 2 === 0 ? -2.6 : 2.6;
      const nx = -p.tan.z, nz = p.tan.x;
      out.push({
        pos: new THREE.Vector3(p.pos.x + nx * lat, p.pos.y, p.pos.z + nz * lat),
        heading: Math.atan2(p.tan.x, p.tan.z),
      });
    }
    return out;
  }

  update(dt) {
    for (const c of this.clouds) {
      c.position.x += c.userData.cloud.speed * dt;
      if (c.position.x > 1000) c.position.x = -1000;
    }
  }

  dispose() {
    this.group.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) {
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        for (const m of mats) {
          if (m.map) m.map.dispose();
          m.dispose();
        }
      }
    });
    if (this.envRT) this.envRT.dispose();
  }
}
