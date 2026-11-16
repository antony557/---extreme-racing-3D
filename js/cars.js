import * as THREE from './vendor/three.module.min.js';
import { WHEEL_STYLES } from './config.js';
import { mergeGeoms, boxGeo, cylGeo } from './merge.js';

export const CAR_SPECS = [
  { id: 'compacto', name: 'Compacto FX', cls: 'Hatch', price: 0, topSpeed: 165, accel: 11.5, mass: 1050, grip: 0.95, drift: 0.35, nitroCap: 2.2, wheelbase: 2.5,
    body: { len: 3.8, wid: 1.68, noseH: 0.52, hoodH: 0.72, roofH: 1.32, tailH: 0.95, cabinF: 0.42, cabinR: 0.86, spoiler: 0, scoop: false, style: 'hatch' } },
  { id: 'prisma', name: 'Sed\u00e3 Prisma', cls: 'Sed\u00e3', price: 3500, topSpeed: 185, accel: 9.8, mass: 1250, grip: 1.0, drift: 0.3, nitroCap: 2.4, wheelbase: 2.7,
    body: { len: 4.5, wid: 1.76, noseH: 0.5, hoodH: 0.7, roofH: 1.34, tailH: 0.92, cabinF: 0.35, cabinR: 0.78, spoiler: 0, scoop: false, style: 'sedan' } },
  { id: 'titan', name: 'SUV Titan', cls: 'SUV', price: 6000, topSpeed: 175, accel: 10.5, mass: 1750, grip: 0.88, drift: 0.25, nitroCap: 2.2, wheelbase: 2.85,
    body: { len: 4.6, wid: 1.9, noseH: 0.72, hoodH: 1.0, roofH: 1.72, tailH: 1.5, cabinF: 0.34, cabinR: 0.8, spoiler: 0, scoop: false, style: 'suv' } },
  { id: 'bravado', name: 'Muscle Bravado', cls: 'Muscle', price: 9000, topSpeed: 225, accel: 6.8, mass: 1500, grip: 1.02, drift: 0.75, nitroCap: 2.8, wheelbase: 2.85,
    body: { len: 4.9, wid: 1.92, noseH: 0.58, hoodH: 0.78, roofH: 1.28, tailH: 1.0, cabinF: 0.4, cabinR: 0.72, spoiler: 0.1, scoop: true, style: 'muscle' } },
  { id: 'terra', name: 'Rally Terra', cls: 'Rally', price: 12000, topSpeed: 195, accel: 7.2, mass: 1300, grip: 1.08, drift: 0.85, nitroCap: 2.6, wheelbase: 2.6,
    body: { len: 4.2, wid: 1.78, noseH: 0.6, hoodH: 0.8, roofH: 1.42, tailH: 1.1, cabinF: 0.4, cabinR: 0.8, spoiler: 0.22, scoop: true, style: 'rally' } },
  { id: 'zephyr', name: 'Cup\u00ea Zephyr', cls: 'Cup\u00ea', price: 16000, topSpeed: 240, accel: 6.0, mass: 1350, grip: 1.1, drift: 0.5, nitroCap: 3.0, wheelbase: 2.7,
    body: { len: 4.5, wid: 1.84, noseH: 0.46, hoodH: 0.66, roofH: 1.22, tailH: 0.88, cabinF: 0.44, cabinR: 0.8, spoiler: 0.12, scoop: false, style: 'coupe' } },
  { id: 'kaze', name: 'Drifter Kaze', cls: 'Drift', price: 21000, topSpeed: 230, accel: 6.2, mass: 1280, grip: 0.98, drift: 1.0, nitroCap: 3.2, wheelbase: 2.65,
    body: { len: 4.4, wid: 1.82, noseH: 0.5, hoodH: 0.68, roofH: 1.26, tailH: 0.94, cabinF: 0.42, cabinR: 0.78, spoiler: 0.3, scoop: false, style: 'coupe' } },
  { id: 'vento', name: 'Esportivo Vento', cls: 'Esportivo', price: 28000, topSpeed: 265, accel: 5.0, mass: 1380, grip: 1.18, drift: 0.45, nitroCap: 3.4, wheelbase: 2.65,
    body: { len: 4.4, wid: 1.9, noseH: 0.4, hoodH: 0.6, roofH: 1.16, tailH: 0.84, cabinF: 0.46, cabinR: 0.82, spoiler: 0.18, scoop: false, style: 'sport' } },
  { id: 'aurora', name: 'GT Aurora', cls: 'GT', price: 38000, topSpeed: 285, accel: 4.4, mass: 1450, grip: 1.22, drift: 0.4, nitroCap: 3.6, wheelbase: 2.75,
    body: { len: 4.7, wid: 1.94, noseH: 0.42, hoodH: 0.62, roofH: 1.2, tailH: 0.86, cabinF: 0.44, cabinR: 0.8, spoiler: 0.22, scoop: true, style: 'gt' } },
  { id: 'vultur', name: 'Super Vultur', cls: 'Super', price: 55000, topSpeed: 310, accel: 3.6, mass: 1420, grip: 1.3, drift: 0.5, nitroCap: 3.8, wheelbase: 2.7,
    body: { len: 4.5, wid: 1.98, noseH: 0.34, hoodH: 0.52, roofH: 1.1, tailH: 0.8, cabinF: 0.5, cabinR: 0.86, spoiler: 0.26, scoop: false, style: 'super' } },
  { id: 'nyx', name: 'Hiper Nyx', cls: 'Hiper', price: 85000, topSpeed: 340, accel: 3.0, mass: 1380, grip: 1.36, drift: 0.55, nitroCap: 4.2, wheelbase: 2.72,
    body: { len: 4.6, wid: 2.02, noseH: 0.3, hoodH: 0.48, roofH: 1.06, tailH: 0.78, cabinF: 0.52, cabinR: 0.88, spoiler: 0.3, scoop: false, style: 'hyper' } },
  { id: 'apex', name: 'Prot\u00f3tipo Apex', cls: 'Prot\u00f3tipo', price: 140000, topSpeed: 365, accel: 2.6, mass: 1250, grip: 1.45, drift: 0.6, nitroCap: 4.5, wheelbase: 2.8,
    body: { len: 4.8, wid: 2.0, noseH: 0.28, hoodH: 0.44, roofH: 1.02, tailH: 0.72, cabinF: 0.54, cabinR: 0.9, spoiler: 0.4, scoop: false, style: 'proto' } },
];

export function getSpec(id) { return CAR_SPECS.find((c) => c.id === id) || CAR_SPECS[0]; }

const SHARED = {};
function shared(key, make) {
  if (!SHARED[key]) {
    const r = make();
    if (r) r.userData = Object.assign(r.userData || {}, { cached: true });
    SHARED[key] = r;
  }
  return SHARED[key];
}
const glassMat = () => shared('glass', () => new THREE.MeshPhysicalMaterial({
  color: 0x0c1420, metalness: 0.1, roughness: 0.05, transparent: true, opacity: 0.5,
  envMapIntensity: 1.6, clearcoat: 1, clearcoatRoughness: 0.05,
}));
const trimMat = () => shared('trim', () => new THREE.MeshStandardMaterial({ color: 0x14161a, metalness: 0.5, roughness: 0.5 }));
const chromeMat = () => shared('chrome', () => new THREE.MeshStandardMaterial({ color: 0xdfe4ea, metalness: 1, roughness: 0.12, envMapIntensity: 1.4 }));
const tireMat = () => shared('tire', () => new THREE.MeshStandardMaterial({ color: 0x121316, metalness: 0, roughness: 0.92 }));
const interiorMat = () => shared('interior', () => new THREE.MeshStandardMaterial({ color: 0x1a1d22, metalness: 0.1, roughness: 0.85 }));
const headMat = () => shared('head', () => new THREE.MeshStandardMaterial({ color: 0xfff6d8, emissive: 0xfff6d8, emissiveIntensity: 1.6, metalness: 0.2, roughness: 0.2 }));
const wheelMetalMat = () => shared('wheelMetal', () => new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0.85, roughness: 0.3, envMapIntensity: 1.3 }));
const paintSeams = () => shared('seams', makePaintTexture);

function makePaintTexture() {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 256;
  const x = c.getContext('2d');
  x.fillStyle = '#ffffff';
  x.fillRect(0, 0, 512, 256);
  const seam = 'rgba(20,22,26,0.85)';
  x.strokeStyle = seam;
  x.lineWidth = 3;
  for (const u of [0.47, 0.74]) {
    for (const v of [[0.14, 0.36], [0.64, 0.86]]) {
      x.beginPath();
      x.moveTo(u * 512, v[0] * 256);
      x.lineTo(u * 512, v[1] * 256);
      x.stroke();
    }
  }
  x.fillStyle = seam;
  for (const v of [0.25, 0.75]) {
    x.fillRect(0.5 * 512 - 14, v * 256 - 4, 28, 8);
  }
  x.fillStyle = 'rgba(0,0,0,0.28)';
  x.fillRect(0, 0, 512, 10);
  x.fillRect(0, 246, 512, 10);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function bump(u, center, width) {
  const d = (u - center) / width;
  return Math.exp(-d * d);
}

function beltY(b, u) {
  const L = [b.tailH * 0.92, b.tailH, b.tailH, b.hoodH + (b.tailH - b.hoodH) * 0.28, b.hoodH + (b.tailH - b.hoodH) * 0.22, b.hoodH, b.hoodH * 0.97, b.noseH];
  const us = [0, 0.05, 0.14, 0.3, 0.62, 0.78, 0.94, 1];
  if (u <= us[0]) return L[0];
  for (let i = 1; i < us.length; i++) {
    if (u <= us[i]) {
      const t = (u - us[i - 1]) / (us[i] - us[i - 1]);
      const s = (1 - Math.cos(t * Math.PI)) / 2;
      return L[i - 1] + (L[i] - L[i - 1]) * s;
    }
  }
  return L[L.length - 1];
}

function hullSection(b, u, wheelR, out) {
  out.top = beltY(b, u);
  const archH = wheelR * 0.8;
  const arch = Math.min(1, bump(u, 0.2, 0.09) + bump(u, 0.8, 0.09));
  out.bot = 0.16 + (archH - 0.16) * arch;
  const mid = 0.88 + 0.12 * Math.sin(Math.PI * Math.min(u / 0.94, 1));
  const taper = u > 0.93 ? 1 - (u - 0.93) * 1.1 : u < 0.04 ? 0.9 + u * 2.5 : 1;
  out.hw = (b.wid / 2) * mid * taper * (1 + 0.05 * (bump(u, 0.2, 0.07) + bump(u, 0.8, 0.07)));
  return out;
}

function buildHull(b, wheelR) {
  const STATIONS = 30, SEG = 22;
  const sec = {};
  const pos = [], uvA = [], idx = [];
  const rows = [];
  for (let si = 0; si <= STATIONS; si++) {
    const u = si / STATIONS;
    hullSection(b, u, wheelR, sec);
    const top = sec.top, bot = sec.bot, hw = si === 0 || si === STATIONS ? sec.hw * 0.55 : sec.hw;
    const cy = (top + bot) / 2, hh = (top - bot) / 2;
    const row = [];
    for (let k = 0; k <= SEG; k++) {
      const t = k / SEG;
      const th = -Math.PI / 2 + t * Math.PI * 2;
      const c = Math.cos(th), s = Math.sin(th);
      const n = s >= 0 ? 2.1 : 3.6;
      let z = Math.sign(c) * Math.pow(Math.abs(c), 2 / n) * hw;
      let y = cy + Math.sign(s) * Math.pow(Math.abs(s), 2 / n) * hh;
      if (s > 0.35) z *= 1 - 0.2 * (s - 0.35);
      if (s < -0.5) y = Math.max(y, bot + 0.01);
      row.push([z, y, t]);
    }
    rows.push(row);
  }
  for (let si = 0; si <= STATIONS; si++) {
    const u = si / STATIONS;
    for (const [z, y, t] of rows[si]) {
      pos.push(-b.len / 2 + u * b.len, y, z);
      uvA.push(u * 3.2, t);
    }
  }
  const W = SEG + 1;
  for (let si = 0; si < STATIONS; si++) {
    for (let k = 0; k < SEG; k++) {
      const a = si * W + k, bq = (si + 1) * W + k;
      idx.push(a, bq, a + 1, a + 1, bq, bq + 1);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvA, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return geo;
}

function buildCanopy(b) {
  const u0 = 1 - b.cabinR, u1 = 1 - b.cabinF;
  const STATIONS = 12, SEG = 16;
  const pos = [], uvA = [], idxGlass = [], idxPaint = [];
  const sec = {};
  for (let si = 0; si <= STATIONS; si++) {
    const u = u0 + (u1 - u0) * (si / STATIONS);
    const uc = (u - u0) / (u1 - u0);
    hullSection(b, u, 0.34, sec);
    const base = beltY(b, u) + 0.02;
    const peak = b.roofH + (b.style === 'suv' || b.style === 'rally' ? 0.06 : 0);
    const arc = Math.sin(uc * Math.PI);
    const topY = base + (peak - base) * Math.pow(arc, 0.72);
    const edge = Math.min(1, arc * 3.2);
    const hw = (b.wid / 2) * (0.8 - 0.1 * uc) * (0.35 + 0.65 * edge);
    const hh = (topY - base) / 2;
    const cy = (topY + base) / 2;
    for (let k = 0; k <= SEG; k++) {
      const t = k / SEG;
      const th = -Math.PI / 2 + t * Math.PI;
      const c = Math.cos(th), s = Math.sin(th);
      const n = 2.0;
      const z = Math.sign(c) * Math.pow(Math.abs(c), 2 / n) * hw;
      const y = cy + Math.max(0, Math.pow(Math.abs(s), 2 / n)) * hh;
      pos.push(-b.len / 2 + u * b.len, y, z);
      uvA.push(u * b.len, t);
    }
  }
  const W = SEG + 1;
  for (let si = 0; si < STATIONS; si++) {
    for (let k = 0; k < SEG; k++) {
      const a = si * W + k, bq = (si + 1) * W + k;
      const upper = k > SEG * 0.68 && k < SEG;
      (upper ? idxPaint : idxGlass).push(a, bq, a + 1, a + 1, bq, bq + 1);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvA, 2));
  const total = idxGlass.length + idxPaint.length;
  const idx = new Uint32Array(total);
  idx.set(idxGlass, 0);
  idx.set(idxPaint, idxGlass.length);
  geo.setIndex(new THREE.BufferAttribute(idx, 1));
  geo.addGroup(0, idxGlass.length, 0);
  geo.addGroup(idxGlass.length, idxPaint.length, 1);
  geo.computeVertexNormals();
  return geo;
}

const wheelGeoCache = new Map();
function buildWheelGeos(styleIdx, radius, width) {
  const key = styleIdx + '_' + radius.toFixed(2);
  if (wheelGeoCache.has(key)) return wheelGeoCache.get(key);
  const style = WHEEL_STYLES[styleIdx % WHEEL_STYLES.length];
  const rimR = radius * 0.62;

  const tire = cylGeo(radius, radius, width, 24, 0, 0, 0, Math.PI / 2);

  const rimCol = new THREE.Color(style.rimColor);
  const rc = [rimCol.r, rimCol.g, rimCol.b];
  const chromeC = [0.87, 0.89, 0.92];
  const steelC = [0.23, 0.25, 0.28];
  const calC = [0.85, 0.12, 0.12];
  const parts = [];
  parts.push({ geo: cylGeo(rimR, rimR, width * 0.56, 18, 0, 0, 0, Math.PI / 2), color: rc });
  const spokeGeo = boxGeo(rimR * 0.26, rimR * 1.8, width * 0.5);
  for (let i = 0; i < style.spokes; i++) {
    const m = new THREE.Matrix4().makeRotationZ((i / style.spokes) * Math.PI * 2);
    parts.push({ geo: spokeGeo, matrix: m, color: rc });
  }
  parts.push({ geo: cylGeo(rimR * 0.24, rimR * 0.24, width * 0.64, 10, 0, 0, 0, Math.PI / 2), color: chromeC });
  parts.push({ geo: cylGeo(rimR * 0.74, rimR * 0.74, width * 0.18, 16, 0, 0, 0, Math.PI / 2), color: steelC });
  const cal = boxGeo(rimR * 0.5, rimR * 0.34, width * 0.3, rimR * 0.5, rimR * 0.28, 0);
  parts.push({ geo: cal, color: calC });
  const rest = mergeGeoms(parts);

  tire.userData = { cached: true };
  rest.userData = { cached: true };
  const pair = { tire, rest };
  wheelGeoCache.set(key, pair);
  return pair;
}

export function buildCarMesh(spec, opts = {}) {
  const b = spec.body;
  const group = new THREE.Group();
  const bodyGroup = new THREE.Group();
  const model = new THREE.Group();
  model.rotation.y = -Math.PI / 2;
  model.add(bodyGroup);
  group.add(model);

  const paint = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(opts.color || '#c8102e'), metalness: 0.72, roughness: 0.22,
    clearcoat: 1, clearcoatRoughness: 0.06, envMapIntensity: 1.5,
    map: paintSeams(),
  });
  const glass = glassMat();
  const trim = trimMat();
  const chrome = chromeMat();
  const interior = interiorMat();
  const head = headMat();

  const wheelRadius = b.style === 'suv' || b.style === 'rally' ? 0.38 : b.style === 'proto' || b.style === 'hyper' ? 0.36 : 0.34;
  const wheelWidth = b.style === 'suv' || b.style === 'rally' ? 0.28 : 0.24;
  const L = b.len, halfL = L / 2;

  const paintParts = [{ geo: buildHull(b, wheelRadius) }];
  const glassParts = [];
  const trimParts = [];
  const chromeParts = [];
  const interiorParts = [];

  const canopy = buildCanopy(b);

  const cabXr = -halfL + (1 - b.cabinR) * L;
  const cabXf = -halfL + (1 - b.cabinF) * L;
  const cabMid = (cabXr + cabXf) / 2;
  const beltR = beltY(b, 1 - b.cabinR) + 0.02;
  const beltF = beltY(b, 1 - b.cabinF) + 0.02;

  trimParts.push({ geo: boxGeo(0.06, b.noseH * 0.42, b.wid * 0.42, halfL - 0.02, b.noseH * 0.5, 0) });
  chromeParts.push({ geo: boxGeo(0.05, b.noseH * 0.5, b.wid * 0.48, halfL - 0.05, b.noseH * 0.5, 0) });
  trimParts.push({ geo: boxGeo(0.24, 0.2, b.wid * 0.86, -halfL + 0.12, 0.2, 0) });
  trimParts.push({ geo: boxGeo(0.3, 0.06, b.wid * 0.92, halfL - 0.18, 0.12, 0) });
  const skirtGeo = boxGeo(L * 0.52, 0.1, 0.07);
  for (const s of [-1, 1]) trimParts.push({ geo: skirtGeo, matrix: new THREE.Matrix4().setPosition(0, 0.14, s * (b.wid / 2 - 0.03)) });

  for (const s of [-1, 1]) {
    trimParts.push({ geo: boxGeo(0.05, 0.05, 0.12, cabXf + 0.1, beltF, s * (b.wid / 2 - 0.1)) });
    paintParts.push({ geo: boxGeo(0.16, 0.09, 0.2, cabXf + 0.18, beltF + 0.06, s * (b.wid / 2 + 0.05)) });
  }

  if (b.spoiler > 0) {
    paintParts.push({ geo: boxGeo(0.3, 0.05, b.wid * 0.86, -halfL + 0.26, b.tailH + b.spoiler, 0, 0, 0.12) });
    for (const s of [-1, 1]) trimParts.push({ geo: boxGeo(0.06, b.spoiler, 0.05, -halfL + 0.26, b.tailH + b.spoiler / 2, s * b.wid * 0.3) });
  }
  if (b.scoop) {
    paintParts.push({ geo: boxGeo(0.55, 0.1, b.wid * 0.32, -halfL + b.cabinF * L - 0.85, b.hoodH + 0.06, 0) });
  }

  for (const s of [-1, 1]) {
    chromeParts.push({ geo: cylGeo(0.055, 0.055, 0.16, 10, -halfL - 0.04, 0.24, s * b.wid * 0.24, 0, Math.PI / 2) });
    trimParts.push({ geo: cylGeo(0.04, 0.04, 0.05, 8, -halfL - 0.12, 0.24, s * b.wid * 0.24, 0, Math.PI / 2) });
  }

  chromeParts.push({ geo: boxGeo(0.02, 0.13, 0.38, halfL + 0.01, b.noseH * 0.38, 0) });

  interiorParts.push({ geo: boxGeo(0.5, 0.12, b.wid * 0.76, cabXf - 0.18, beltF - 0.04, 0) });
  for (const s of [-1, 1]) {
    interiorParts.push({ geo: boxGeo(0.5, 0.14, 0.42, cabMid, (beltR + beltF) / 2 + 0.02, s * b.wid * 0.19) });
    interiorParts.push({ geo: boxGeo(0.14, 0.44, 0.4, cabXr + 0.12, (beltR + beltF) / 2 + 0.24, s * b.wid * 0.19, 0, -0.16) });
  }
  interiorParts.push({ geo: new THREE.TorusGeometry(0.14, 0.025, 6, 14), matrix: new THREE.Matrix4().makeRotationY(Math.PI / 2).setPosition(cabXf - 0.32, beltF + 0.1, -b.wid * 0.19) });

  const headParts = [];
  const tailParts = [];
  for (const s of [-1, 1]) {
    headParts.push({ geo: boxGeo(0.1, 0.11, b.wid * 0.24, halfL - 0.14, beltY(b, 0.97) - 0.06, s * b.wid * 0.31) });
    tailParts.push({ geo: boxGeo(0.08, 0.1, b.wid * 0.3, -halfL + 0.05, beltY(b, 0.04) - 0.04, s * b.wid * 0.3) });
  }

  const addMerged = (parts, mat, shadows) => {
    if (!parts.length) return null;
    const items = parts.map((p) => ({ geo: p.geo, matrix: p.matrix, color: p.color }));
    const mesh = new THREE.Mesh(mergeGeoms(items), mat);
    mesh.castShadow = !!shadows;
    bodyGroup.add(mesh);
    return mesh;
  };

  addMerged(paintParts, paint, true);
  const canopyMesh = new THREE.Mesh(canopy, [glass, paint]);
  canopyMesh.castShadow = true;
  bodyGroup.add(canopyMesh);
  addMerged(trimParts, trim, false);
  addMerged(chromeParts, chrome, false);
  addMerged(interiorParts, interior, false);
  addMerged(headParts, head, false);
  const rearMat = new THREE.MeshStandardMaterial({ color: 0xff2222, emissive: 0xff2222, emissiveIntensity: 0.9, metalness: 0.2, roughness: 0.2 });
  addMerged(tailParts, rearMat, false);

  const wheels = [];
  const axleF = halfL - 0.78;
  const axleR = -halfL + 0.82;
  const zs = b.wid / 2 - wheelWidth / 2 + 0.02;
  const wgeos = buildWheelGeos(opts.wheel || 0, wheelRadius, wheelWidth);
  for (const [x, z, front] of [[axleF, zs, true], [axleF, -zs, true], [axleR, zs, false], [axleR, -zs, false]]) {
    const spin = new THREE.Group();
    const tireMesh = new THREE.Mesh(wgeos.tire, tireMat());
    tireMesh.castShadow = true;
    const restMesh = new THREE.Mesh(wgeos.rest, wheelMetalMat());
    spin.add(tireMesh, restMesh);
    const holder = new THREE.Group();
    holder.position.set(x, wheelRadius, z);
    holder.add(spin);
    model.add(holder);
    wheels.push({ holder, spin, front, radius: wheelRadius });
  }

  const blob = new THREE.Mesh(new THREE.CircleGeometry(L * 0.42, 20), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.28, depthWrite: false }));
  blob.rotation.x = -Math.PI / 2;
  blob.position.y = 0.02;
  blob.name = 'blobShadow';
  model.add(blob);

  group.userData = {
    spec, wheels, paint, headlights: head, brakeMats: [rearMat],
    dims: { len: L, wid: b.wid, wheelRadius },
    bodyGroup,
  };
  return group;
}

export function setCarColor(mesh, colorStr) {
  mesh.userData.paint.color.set(colorStr);
}

export function setBrakeLights(mesh, on) {
  for (const m of mesh.userData.brakeMats) m.emissiveIntensity = on ? 3.2 : 0.9;
}
