// Progressão — XP, níveis, desbloqueios e estatísticas
import { getSave, patchSave } from '../core/save.js';
import { WEAPONS } from '../core/config.js';

export function xpForLevel(level) {
  return Math.round(280 * Math.pow(level - 1, 1.35));
}

export function levelFromXp(xp) {
  let lvl = 1;
  while (xpForLevel(lvl + 1) <= xp) lvl++;
  return lvl;
}

export function unlockedWeapons() {
  const s = getSave();
  return Object.values(WEAPONS).filter(w => s.level >= w.unlockLevel || s.unlockedWeapons.includes(w.id));
}

export function addXp(amount) {
  const s = getSave();
  const before = s.level;
  s.xp += amount;
  s.level = levelFromXp(s.xp);
  patchSave(() => {});
  return { leveledUp: s.level > before, level: s.level, xp: s.xp, next: xpForLevel(s.level + 1) };
}

export function addStat(key, amount = 1) {
  patchSave(s => { if (s.stats[key] !== undefined) s.stats[key] += amount; });
}

export function setStat(key, value) {
  patchSave(s => { s.stats[key] = value; });
}

export function markMissionDone(id, extra = {}) {
  patchSave(s => { s.missions[id] = { done: true, ...extra }; });
}

export function isMissionDone(id) {
  const s = getSave();
  return !!(s.missions[id] && s.missions[id].done);
}

export function saveLoadout(loadout) {
  patchSave(s => { s.loadout = { ...s.loadout, ...loadout }; });
}

export function saveSettings(settings) {
  patchSave(s => { s.settings = { ...s.settings, ...settings }; });
}

export function saveWorldState(time, position) {
  patchSave(s => { s.worldTime = time; s.position = position; });
}
