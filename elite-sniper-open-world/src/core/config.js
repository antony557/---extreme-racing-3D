// ELITE SNIPER — OPEN WORLD :: Configuração global e presets de qualidade

export const WORLD = {
  SIZE: 1600,            // metros (x/z), mundo de -800..800
  HALF: 800,
  WATER_LEVEL: 0.0,
  CHUNK: 200,            // tamanho do chunk de terreno
  CHUNKS: 8,             // 8x8 chunks
  LAKE: { x: -380, z: -420, r: 190 },
};

export const DAY_LENGTH = 480; // segundos para um ciclo completo (8 min)

export const WEAPONS = {
  vanguard: {
    id: 'vanguard', name: 'VANGUARD .338', caliber: '.338 Lapua',
    damage: 95, muzzleVelocity: 915, magazine: 5, reserve: 30,
    reloadTime: 3.4, boltTime: 1.05, recoil: 1.0, sway: 1.0,
    zoomFov: [15, 8, 4], weight: 1.0, unlockLevel: 1,
  },
  nomad: {
    id: 'nomad', name: 'NOMAD .308', caliber: '.308 Win',
    damage: 70, muzzleVelocity: 850, magazine: 10, reserve: 50,
    reloadTime: 2.7, boltTime: 0.85, recoil: 0.7, sway: 0.8,
    zoomFov: [18, 9, 5], weight: 0.85, unlockLevel: 3,
  },
  longshadow: {
    id: 'longshadow', name: 'LONGSHADOW .50', caliber: '.50 BMG',
    damage: 160, muzzleVelocity: 880, magazine: 5, reserve: 20,
    reloadTime: 4.2, boltTime: 1.35, recoil: 1.6, sway: 1.25,
    zoomFov: [12, 7, 3.5], weight: 1.35, unlockLevel: 6,
  },
};

export const ANIMALS = {
  deer:   { name: 'Veado',   hp: 90,  walk: 1.6, run: 9.0,  sight: 95,  hear: 240, herd: 3, xp: 60,  height: 1.5, radius: 0.6 },
  elk:    { name: 'Cervo',   hp: 120, walk: 1.5, run: 8.5,  sight: 90,  hear: 230, herd: 2, xp: 80,  height: 1.8, radius: 0.7 },
  boar:   { name: 'Javali',  hp: 110, walk: 1.2, run: 7.5,  sight: 55,  hear: 200, herd: 4, xp: 70,  height: 1.0, radius: 0.6 },
  wolf:   { name: 'Lobo',    hp: 80,  walk: 1.8, run: 10.5, sight: 110, hear: 260, herd: 3, xp: 90,  height: 0.9, radius: 0.45, hostile: true },
  fox:    { name: 'Raposa',  hp: 40,  walk: 1.5, run: 9.5,  sight: 80,  hear: 220, herd: 1, xp: 45,  height: 0.5, radius: 0.3 },
  rabbit: { name: 'Coelho',  hp: 15,  walk: 0.8, run: 8.0,  sight: 45,  hear: 180, herd: 2, xp: 20,  height: 0.3, radius: 0.2 },
  bear:   { name: 'Urso',    hp: 300, walk: 1.4, run: 8.0,  sight: 70,  hear: 210, herd: 1, xp: 150, height: 1.7, radius: 0.9, hostile: true },
  bird:   { name: 'Ave',     hp: 8,   walk: 0,   run: 12,   sight: 70,  hear: 200, herd: 6, xp: 15,  height: 0.3, radius: 0.2, flying: true },
};

export const NPC = {
  hp: 100, sight: 120, hear: 280, walk: 1.7, run: 5.2,
  fireRate: [1.1, 0.8, 0.55], accuracy: [0.10, 0.06, 0.035], damage: [8, 12, 17],
};

export const QUALITY = {
  low: {
    label: 'BAIXA', resScale: 0.72, shadowMap: 0, shadowDist: 0, viewDist: 340,
    fogNear: 0.55, grass: 0, treeDensity: 0.55, rockDensity: 0.6, particles: 0.4,
    lod: { near: 24, mid: 12, far: 6 }, lodRadius: [220, 420, 620], maxPixelRatio: 1,
  },
  medium: {
    label: 'MÉDIA', resScale: 1.0, shadowMap: 1024, shadowDist: 90, viewDist: 560,
    fogNear: 0.45, grass: 0.5, treeDensity: 0.85, rockDensity: 0.85, particles: 0.7,
    lod: { near: 40, mid: 20, far: 10 }, lodRadius: [260, 480, 720], maxPixelRatio: 1.5,
  },
  ultra: {
    label: 'ULTRA', resScale: 1.0, shadowMap: 2048, shadowDist: 130, viewDist: 800,
    fogNear: 0.35, grass: 1.0, treeDensity: 1.15, rockDensity: 1.0, particles: 1.0,
    lod: { near: 56, mid: 28, far: 14 }, lodRadius: [300, 560, 820], maxPixelRatio: 2,
  },
};

export const STANCE = { STAND: 0, CROUCH: 1, PRONE: 2 };

export const STANCE_DATA = [
  { eye: 1.68, speed: 4.2,  noise: 26, sway: 1.0 },
  { eye: 1.12, speed: 2.3,  noise: 12, sway: 0.45 },
  { eye: 0.38, speed: 0.85, noise: 5,  sway: 0.16 },
];

export const PLAYER = {
  radius: 0.42, height: 1.8, jump: 5.0, gravity: 18.0,
  staminaMax: 100, runDrain: 14, regen: 9,
};

export const IS_MOBILE = typeof navigator !== 'undefined' &&
  (/Android|iPhone|iPad|Mobile|Tablet/i.test(navigator.userAgent) ||
   (typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches));

export function defaultQuality() {
  return IS_MOBILE ? 'medium' : 'ultra';
}
