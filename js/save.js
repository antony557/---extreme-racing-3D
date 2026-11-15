import { PAINTS } from './config.js';

const KEY = 'extremeRacing3D.save.v1';

function defaultData() {
  return {
    coins: 1500,
    cars: {},
    selected: null,
    bestTimes: {},
    stats: { races: 0, wins: 0, podiums: 0, km: 0, playTime: 0, eliminations: 0, championships: 0 },
    championship: null,
    settings: { quality: 'medium', autoQuality: true, sound: true, music: true, touch: 'auto', camera: 0 },
  };
}

export class SaveManager {
  constructor(firstCarId) {
    this.data = this.load();
    if (!this.data.cars[firstCarId] || !this.data.cars[firstCarId].owned) {
      this.data.cars[firstCarId] = this.newCarEntry();
      this.data.selected = firstCarId;
    }
    if (!this.data.selected || !this.data.cars[this.data.selected]) this.data.selected = firstCarId;
    this.save();
  }
  newCarEntry() {
    return { owned: true, color: 0, wheel: 0, upgrades: { engine: 0, tires: 0, nitro: 0 } };
  }
  load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return defaultData();
      const parsed = JSON.parse(raw);
      const def = defaultData();
      return {
        ...def, ...parsed,
        stats: { ...def.stats, ...(parsed.stats || {}) },
        settings: { ...def.settings, ...(parsed.settings || {}) },
        cars: parsed.cars || def.cars,
        bestTimes: parsed.bestTimes || {},
      };
    } catch (e) {
      return defaultData();
    }
  }
  save() {
    try { localStorage.setItem(KEY, JSON.stringify(this.data)); } catch (e) { /* storage unavailable */ }
  }
  carEntry(id) {
    if (!this.data.cars[id]) this.data.cars[id] = { owned: false, color: Math.floor(Math.random() * PAINTS.length), wheel: 0, upgrades: { engine: 0, tires: 0, nitro: 0 } };
    return this.data.cars[id];
  }
  addCoins(n) { this.data.coins = Math.max(0, Math.round(this.data.coins + n)); this.save(); }
  buyCar(id, price) {
    const entry = this.carEntry(id);
    if (entry.owned || this.data.coins < price) return false;
    this.data.coins -= price;
    entry.owned = true;
    this.data.selected = id;
    this.save();
    return true;
  }
  selectCar(id) {
    if (this.data.cars[id] && this.data.cars[id].owned) { this.data.selected = id; this.save(); return true; }
    return false;
  }
  customize(id, patch) {
    const entry = this.carEntry(id);
    Object.assign(entry, patch);
    this.save();
  }
  buyUpgrade(id, kind, price) {
    const entry = this.carEntry(id);
    if (this.data.coins < price) return false;
    this.data.coins -= price;
    entry.upgrades[kind] += 1;
    this.save();
    return true;
  }
  recordTime(trackId, ms) {
    const prev = this.data.bestTimes[trackId];
    if (prev == null || ms < prev) { this.data.bestTimes[trackId] = Math.round(ms); this.save(); return true; }
    return false;
  }
  reset() {
    this.data = defaultData();
    this.save();
  }
}
