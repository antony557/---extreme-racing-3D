// Salvamento — localStorage com versionamento + autosave
const KEY = 'elite-sniper-save-v1';

const DEFAULTS = {
  version: 1,
  xp: 0,
  level: 1,
  unlockedWeapons: ['vanguard'],
  unlockedGear: [],
  loadout: { rifle: 'vanguard', medkits: 2, camo: 0, bipod: true },
  stats: { killsNpc: 0, killsAnimal: 0, shotsFired: 0, hits: 0, distance: 0, longestShot: 0, missionsDone: 0, playTime: 0 },
  missions: {},          // id -> { done: true, bestTime }
  settings: null,        // preenchido pelo Settings
  worldTime: 8 * 3600,
  position: null,
};

let data = null;

export function loadSave() {
  if (data) return data;
  try {
    const raw = localStorage.getItem(KEY);
    data = raw ? { ...structuredClone(DEFAULTS), ...JSON.parse(raw) } : structuredClone(DEFAULTS);
  } catch (e) {
    data = structuredClone(DEFAULTS);
  }
  return data;
}

export function getSave() { return data || loadSave(); }

export function saveNow() {
  if (!data) return;
  try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) { /* quota */ }
}

export function resetSave() {
  data = structuredClone(DEFAULTS);
  saveNow();
}

export function patchSave(fn) {
  fn(getSave());
  saveNow();
}
