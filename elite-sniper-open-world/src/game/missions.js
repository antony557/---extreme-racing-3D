// Campanha — missões progressivas com objetivos, progresso e recompensas
import { ANIMALS } from '../core/config.js';
import { addXp, isMissionDone, markMissionDone, addStat } from './progression.js';
import { dist2 } from '../core/utils.js';

export const CAMPAIGN = [
  {
    id: 'm1', title: 'Primeiro Contato', type: 'reach', xp: 120,
    desc: 'Alcance o vilarejo abandonado a oeste e avalie a região.',
    target: { x: 120, z: 60, r: 40 }, marker: 'Vilarejo Oeste',
  },
  {
    id: 'm2', title: 'Olhos na Floresta', type: 'hunt', xp: 180,
    desc: 'Abata 3 veados para garantir provisões.',
    species: 'deer', count: 3,
  },
  {
    id: 'm3', title: 'Reconhecimento Aéreo', type: 'observe', xp: 220,
    desc: 'Observação prolongada: mantenha a luneta no ponto marcado por 15s.',
    target: { x: -140, z: -680, r: 130 }, holdTime: 15, marker: 'Pico Norte',
  },
  {
    id: 'm4', title: 'Rastro de Sangue', type: 'hunt', xp: 220,
    desc: 'Os javalis estão destruindo as plantações. Abata 2.',
    species: 'boar', count: 2,
  },
  {
    id: 'm5', title: 'Vozes na Base', type: 'eliminate', xp: 320,
    desc: 'Milícias ocuparam a base militar central. Neutralize 4 hostis.',
    count: 4, near: { x: -60, z: -420, r: 110 },
  },
  {
    id: 'm6', title: 'Precisão Extrema', type: 'longshot', xp: 360,
    desc: 'Confirme um abate a mais de 250 metros.',
    distance: 250,
  },
  {
    id: 'm7', title: 'Intel Recuperada', type: 'collect', xp: 300,
    desc: 'Recupere 3 relatórios de inteligência na base militar.',
    count: 3,
  },
  {
    id: 'm8', title: 'Sobrevivência', type: 'survive', xp: 280,
    desc: 'Sobreviva 90 segundos durante uma tempestade.',
    time: 90, weather: 'storm',
  },
  {
    id: 'm9', title: 'Sentinela das Torres', type: 'explore', xp: 280,
    desc: 'Visite as torres de observação leste, oeste e o vilarejo sul.',
    points: [
      { x: 620, z: 320, r: 35, name: 'Torre Leste' },
      { x: -640, z: -80, r: 35, name: 'Torre Oeste' },
      { x: 40, z: 380, r: 35, name: 'Vilarejo Sul' },
    ],
  },
  {
    id: 'm10', title: 'Caçada Noturna', type: 'huntNight', xp: 420,
    desc: 'Abata 2 lobos durante a noite.',
    species: 'wolf', count: 2,
  },
  {
    id: 'm11', title: 'O Abate', type: 'eliminate', xp: 520,
    desc: 'Neutralize 6 hostis em qualquer região.',
    count: 6,
  },
];

export class MissionManager {
  constructor(hooks = {}) {
    this.hooks = hooks; // { onComplete(mission, result), onProgress(mission, progress) }
    this.activeId = null;
    this.progress = 0;
    this.observeTime = 0;
    this.surviveTime = 0;
    this.visited = new Set();
    this.stormTime = 0;
  }

  get active() { return CAMPAIGN.find(m => m.id === this.activeId) || null; }

  available() {
    return CAMPAIGN.filter(m => !isMissionDone(m.id));
  }

  start(id) {
    const m = CAMPAIGN.find(x => x.id === id);
    if (!m) return false;
    this.activeId = id;
    this.progress = 0;
    this.observeTime = 0;
    this.surviveTime = 0;
    this.visited.clear();
    this.stormTime = 0;
    return true;
  }

  abandon() { this.activeId = null; }

  _complete(m, result = {}) {
    markMissionDone(m.id, result);
    addStat('missionsDone', 1);
    const res = addXp(m.xp);
    this.activeId = null;
    if (this.hooks.onComplete) this.hooks.onComplete(m, { ...result, xp: m.xp, levelUp: res });
  }

  // ---- Eventos do jogo ----
  onAnimalKilled(kind, distance) {
    const m = this.active;
    if (!m) return;
    if (m.type === 'hunt' && m.species === kind) {
      this.progress++;
      this._progress(m);
      if (this.progress >= m.count) this._complete(m, { detail: `${m.count} ${ANIMALS[kind].name.toLowerCase()}(s)` });
    }
    if (m.type === 'huntNight' && m.species === kind) {
      this.progress++;
      this._progress(m);
      if (this.progress >= m.count) this._complete(m, {});
    }
    if (m.type === 'longshot' && distance >= m.distance) {
      this._complete(m, { detail: `${Math.round(distance)} m` });
    }
  }

  onNpcKilled(distance, x, z) {
    const m = this.active;
    if (!m) return;
    if (m.type === 'longshot' && distance >= m.distance) {
      this._complete(m, { detail: `${Math.round(distance)} m` });
      return;
    }
    if (m.type === 'eliminate') {
      if (m.near) {
        if (dist2(x, z, m.near.x, m.near.z) < m.near.r * m.near.r) {
          this.progress++;
          this._progress(m);
          if (this.progress >= m.count) this._complete(m, {});
        }
      } else {
        this.progress++;
        this._progress(m);
        if (this.progress >= m.count) this._complete(m, {});
      }
    }
  }

  onCollectIntel(collected) {
    const m = this.active;
    if (!m || m.type !== 'collect') return;
    this.progress = collected;
    this._progress(m);
    if (collected >= m.count) this._complete(m, {});
  }

  onShotFired() { /* reservado para missões de disparo */ }

  update(dt, player, sky, weather, aiming, world) {
    const m = this.active;
    if (!m) return;
    switch (m.type) {
      case 'reach': {
        const d = Math.sqrt(dist2(player.pos.x, player.pos.z, m.target.x, m.target.z));
        this.progress = Math.max(0, 1 - d / (m.target.r * 4));
        this._progress(m);
        if (d < m.target.r) this._complete(m, {});
        break;
      }
      case 'observe': {
        const d = Math.sqrt(dist2(player.pos.x, player.pos.z, m.target.x, m.target.z));
        if (aiming && d < m.target.r) {
          this.observeTime += dt;
          this.progress = this.observeTime / m.holdTime;
          this._progress(m);
          if (this.observeTime >= m.holdTime) this._complete(m, {});
        } else {
          this.observeTime = Math.max(0, this.observeTime - dt * 0.5);
        }
        break;
      }
      case 'survive': {
        if (weather.target === 'storm') {
          this.stormTime += dt;
          this.progress = this.stormTime / m.time;
          this._progress(m);
          if (this.stormTime >= m.time) this._complete(m, {});
        } else {
          this.stormTime = Math.max(0, this.stormTime - dt * 0.5);
        }
        break;
      }
      case 'explore': {
        for (const p of m.points) {
          if (this.visited.has(p.name)) continue;
          if (dist2(player.pos.x, player.pos.z, p.x, p.z) < p.r * p.r) {
            this.visited.add(p.name);
            this.progress = this.visited.size / m.points.length;
            this._progress(m);
          }
        }
        if (this.visited.size >= m.points.length) this._complete(m, {});
        break;
      }
    }
  }

  _progress(m) {
    if (this.hooks.onProgress) this.hooks.onProgress(m, Math.min(1, this.progress));
  }

  progressLabel(m = this.active) {
    if (!m) return '';
    switch (m.type) {
      case 'hunt': case 'huntNight': case 'eliminate': case 'collect':
        return `${Math.min(this.progress, m.count)}/${m.count}`;
      case 'observe': return `${Math.floor(this.observeTime)}/${m.holdTime}s`;
      case 'survive': return `${Math.floor(this.stormTime)}/${m.time}s`;
      case 'explore': return `${this.visited.size}/${m.points.length}`;
      case 'reach': return this.progress > 0.7 ? 'Próximo' : 'Siga o marcador';
      case 'longshot': return `Recorde: ${Math.round(this.progress)}m`;
      default: return '';
    }
  }
}
