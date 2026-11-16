// Campo de alturas determinístico — geografia coerente do mundo
// Norte: cordilheira | Centro: colinas e vales | Sul: campos e rio | Lago a sudoeste
import { fbm, ridge, smoothstep, lerp, clamp, dist2 } from '../core/utils.js';
import { WORLD } from '../core/config.js';

// Sítios aplainados para construções (fonte única de verdade)
export const FLAT_SITES = [
  { x: 120,  z: 60,   r: 95,  name: 'village_west' },
  { x: 480,  z: -60,  r: 85,  name: 'village_east' },
  { x: -60,  z: -420, r: 110, name: 'base_military' },
  { x: 380,  z: -360, r: 60,  name: 'camp_north' },
  { x: -420, z: 180,  r: 55,  name: 'camp_south' },
  { x: 620,  z: 320,  r: 45,  name: 'tower_east' },
  { x: -640, z: -80,  r: 45,  name: 'tower_west' },
  { x: 40,   z: 380,  r: 50,  name: 'village_south' },
];

// Torre de observação extra e pontos cênicos
export const POI = {
  waterfall: { x: -520, z: -240 },
  peak: { x: -140, z: -680 },
};

export function riverZ(x) {
  return 250 * Math.sin(x * 0.0035) + 90 * Math.sin(x * 0.0011 + 2.0) + 120;
}

function rawHeight(x, z) {
  // Colinas base
  let h = fbm(x * 0.004 + 13.7, z * 0.004 + 7.3, 4) * 16 - 3;
  h += fbm(x * 0.02 + 3.1, z * 0.02 + 9.4, 3) * 2.4 - 1.2;

  // Cordilheira ao norte (z negativo)
  const mMask = smoothstep(-220, -600, z);
  h += ridge(x * 0.0055 + 7.7, z * 0.0055 + 3.3, 4) * 92 * mMask;

  // Elevações ao sul
  const sMask = smoothstep(320, 640, z);
  h += fbm(x * 0.006 + 21.4, z * 0.006 + 11.9, 3) * 26 * sMask;

  // Rochedo a leste
  const eMask = smoothstep(480, 760, x);
  h += fbm(x * 0.009 + 31.2, z * 0.009 + 5.5, 3) * 30 * eMask;

  // Bacia do lago
  const L = WORLD.LAKE;
  const dl = Math.sqrt(dist2(x, z, L.x, L.z));
  const lake = smoothstep(L.r, L.r * 0.30, dl);
  h = lerp(h, -6.5, lake);

  // Rio oeste→leste
  const dz = Math.abs(z - riverZ(x));
  const carve = smoothstep(46, 8, dz);
  h = lerp(h, -3.0, carve);

  // Cachoeira: degrau de falha a noroeste
  const dw = Math.sqrt(dist2(x, z, POI.waterfall.x, POI.waterfall.z));
  const cliff = smoothstep(70, 18, dw);
  h += cliff * 26;

  return h;
}

function siteFlatten(x, z, h) {
  for (const s of FLAT_SITES) {
    const d = Math.sqrt(dist2(x, z, s.x, s.z));
    if (d < s.r) {
      const t = smoothstep(s.r, s.r * 0.55, d);
      if (!s.h) s.h = rawHeight(s.x, s.z);
      h = lerp(h, s.h, t);
    }
  }
  return h;
}

// Altura do terreno em (x, z) — usada por física, IA, colocação e render
export function terrainHeight(x, z) {
  const h = rawHeight(x, z);
  return siteFlatten(x, z, h);
}

// Normal aproximada por diferenças finitas
export function terrainNormal(x, z, out = null) {
  const e = 1.2;
  const hL = terrainHeight(x - e, z), hR = terrainHeight(x + e, z);
  const hD = terrainHeight(x, z - e), hU = terrainHeight(x, z + e);
  const nx = hL - hR, nz = hD - hU, ny = 2 * e;
  const len = Math.hypot(nx, ny, nz) || 1;
  if (out) {
    if (typeof out.set === 'function') { out.set(nx / len, ny / len, nz / len); return out; }
    out.x = nx / len; out.y = ny / len; out.z = nz / len;
    return out;
  }
  return { x: nx / len, y: ny / len, z: nz / len };
}

export function terrainSlope(x, z) {
  const n = terrainNormal(x, z);
  return 1 - n.y; // 0 plano .. ~1 vertical
}

// Cor de bioma por altura/inclinação/umidade — [r, g, b] 0..1
export function biomeColor(x, z, h, slope, out) {
  const moisture = fbm(x * 0.008 + 40, z * 0.008 + 17, 3);
  let r, g, b;
  if (h < WORLD.WATER_LEVEL + 0.9) {
    // Areia
    r = 0.72; g = 0.65; b = 0.47;
  } else if (h > 62) {
    // Neve
    const t = smoothstep(62, 74, h);
    r = lerp(0.42, 0.93, t); g = lerp(0.40, 0.95, t); b = lerp(0.36, 0.98, t);
  } else if (slope > 0.42 || h > 44) {
    // Rocha
    const v = 0.36 + fbm(x * 0.05, z * 0.05, 2) * 0.16;
    const t = smoothstep(0.42, 0.75, slope);
    r = lerp(0.30, v + 0.08, t); g = lerp(0.34, v + 0.05, t); b = lerp(0.24, v, t);
    if (h > 44) { const s = smoothstep(44, 62, h); r = lerp(r, 0.5, s); g = lerp(g, 0.5, s); b = lerp(b, 0.48, s); }
  } else {
    // Grama com variação de umidade
    const dry = smoothstep(0.35, 0.75, moisture);
    r = lerp(0.22, 0.42, dry) + fbm(x * 0.11, z * 0.11, 2) * 0.05;
    g = lerp(0.40, 0.46, dry) + fbm(x * 0.13 + 5, z * 0.13, 2) * 0.05;
    b = lerp(0.13, 0.16, dry);
  }
  // Estradas de terra
  const rd = roadDistance(x, z);
  if (rd < 5.5) {
    const t = smoothstep(5.5, 2.2, rd);
    r = lerp(r, 0.48, t); g = lerp(g, 0.39, t); b = lerp(b, 0.27, t);
  }
  out[0] = clamp(r, 0, 1); out[1] = clamp(g, 0, 1); out[2] = clamp(b, 0, 1);
  return out;
}

// Estradas: polilinhas entre povoados/base
const ROADS = [
  [[120, 60], [40, 380], [480, 380], [480, -60]],
  [[120, 60], [-60, -420], [380, -360], [480, -60]],
  [[-60, -420], [-420, 180], [40, 380]],
  [[120, 60], [480, -60]],
];
const ROAD_SEGS = [];
for (const road of ROADS) {
  for (let i = 0; i < road.length - 1; i++) {
    ROAD_SEGS.push([road[i][0], road[i][1], road[i + 1][0], road[i + 1][1]]);
  }
}

export function roadDistance(x, z) {
  let best = 1e9;
  for (const [ax, az, bx, bz] of ROAD_SEGS) {
    const abx = bx - ax, abz = bz - az;
    const t = clamp(((x - ax) * abx + (z - az) * abz) / (abx * abx + abz * abz), 0, 1);
    const px = ax + abx * t, pz = az + abz * t;
    const d = dist2(x, z, px, pz);
    if (d < best) best = d;
  }
  return Math.sqrt(best);
}
