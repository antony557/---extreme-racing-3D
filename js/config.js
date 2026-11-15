export const QUALITY = {
  low:    { pixelRatioCap: 1.0, shadows: false, shadowSize: 512,  particles: 0.35, drawDistance: 280, antialias: false, props: 0.55, spotlights: false },
  medium: { pixelRatioCap: 1.5, shadows: true,  shadowSize: 1024, particles: 0.8,  drawDistance: 460, antialias: true,  props: 1.0,  spotlights: true },
  high:   { pixelRatioCap: 2.0, shadows: true,  shadowSize: 2048, particles: 1.3,  drawDistance: 700, antialias: true,  props: 1.4,  spotlights: true },
};

export const DIFFICULTY = {
  easy:   { label: 'Fácil',   speed: 0.80, grip: 0.85, reward: 0.8 },
  medium: { label: 'Médio',   speed: 0.92, grip: 0.95, reward: 1.0 },
  hard:   { label: 'Difícil', speed: 1.01, grip: 1.06, reward: 1.4 },
};

export const UPGRADES = {
  engine: { label: 'Motor', max: 5, basePrice: 800, step: 550 },
  tires:  { label: 'Pneus', max: 5, basePrice: 600, step: 450 },
  nitro:  { label: 'Nitro', max: 5, basePrice: 700, step: 500 },
};

export const PAINTS = [
  '#c8102e', '#ff6a00', '#ffb400', '#ffd75e', '#35d07f', '#00a86b',
  '#00d4ff', '#0a66ff', '#5a3fd4', '#c0c6d0', '#7a828e', '#2b2f36',
  '#ffffff', '#101318', '#8b1a4a', '#4a2c14',
];

export const WHEEL_STYLES = [
  { label: 'Esportiva', spokes: 5, rimColor: '#c8ccd4' },
  { label: 'Esportiva Preta', spokes: 5, rimColor: '#2a2e35' },
  { label: 'Multi-raio', spokes: 10, rimColor: '#d8b24a' },
  { label: 'Corrida', spokes: 6, rimColor: '#e8e8e8' },
];

export const PHYS = {
  gravity: 9.81,
  carRadius: 1.35,
  maxReverse: 9,
  dragK: 0.00075,
  rrAsphalt: 0.45,
  rrGrass: 3.4,
  brakeDecel: 15,
};

export const MODES = {
  quick:       { label: 'Corrida Rápida', laps: true, opponents: true, difficulty: true, lapsDefault: 3 },
  championship:{ label: 'Campionato', laps: true, opponents: false, difficulty: true, lapsDefault: 3, fixedOpponents: 5 },
  timeattack:  { label: 'Contrarrelógio', laps: true, opponents: false, difficulty: false, lapsDefault: 3 },
  free:        { label: 'Corrida Livre', laps: false, opponents: false, difficulty: false, lapsDefault: 0 },
  elimination: { label: 'Eliminação', laps: false, opponents: true, difficulty: true, lapsDefault: 0, fixedOpponents: 7 },
};

export const CHAMPIONSHIP_POINTS = [10, 8, 6, 5, 4, 3, 2, 1];
export const ELIMINATION_INTERVAL = 15;
