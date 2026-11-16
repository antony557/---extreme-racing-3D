import { TRACKS } from './tracks.js';
import { MODES, DIFFICULTY, QUALITY, CHAMPIONSHIP_POINTS } from './config.js';
import { formatCoins, formatTime, isTouchDevice } from './utils.js';

export class UI {
  constructor(game) {
    this.game = game;
    this.mode = 'quick';
    this.trackId = TRACKS[0].id;
    this.difficulty = 'medium';
    this.laps = 3;
    this.opponents = 5;
    this.backTarget = 'screen-menu';
    this.bind();
  }

  $(id) { return document.getElementById(id); }

  show(screenId) {
    document.querySelectorAll('.screen').forEach((s) => s.classList.remove('active'));
    if (screenId) this.$(screenId).classList.add('active');
  }

  hideAll() { this.show(null); }

  toast(msg, ms = 2600) {
    const t = this.$('toast');
    t.textContent = msg;
    t.classList.remove('hidden');
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => t.classList.add('hidden'), ms);
  }

  isFullscreen() {
    return !!(document.fullscreenElement || document.webkitFullscreenElement);
  }

  toggleFullscreen() {
    if (this.isFullscreen()) {
      const exit = document.exitFullscreen || document.webkitExitFullscreen;
      if (exit) {
        try { const p = exit.call(document); if (p && p.catch) p.catch(() => {}); } catch (e) { /* ignore */ }
      }
    } else {
      const el = document.documentElement;
      const req = el.requestFullscreen || el.webkitRequestFullscreen;
      if (req) {
        try {
          const p = req.call(el);
          if (p && p.catch) p.catch(() => this.toast('Tela cheia bloqueada pelo navegador.', 2200));
        } catch (e) { this.toast('Tela cheia não suportada aqui.', 2200); }
      } else {
        this.toast('Tela cheia não suportada neste navegador.', 2200);
      }
      try {
        if (screen.orientation && screen.orientation.lock) screen.orientation.lock('landscape').catch(() => {});
      } catch (e) { /* ignore */ }
    }
    setTimeout(() => this.updateFullscreenButtons(), 120);
  }

  updateFullscreenButtons() {
    const on = this.isFullscreen();
    const menu = this.$('btn-fullscreen');
    if (menu) menu.textContent = on ? 'SAIR DA TELA CHEIA' : 'TELA CHEIA';
    const hud = this.$('btn-fullscreen-hud');
    if (hud) hud.innerHTML = on ? '&#x2715;' : '&#x26F6;';
  }

  refreshCoins() {
    this.$('menu-coins').textContent = formatCoins(this.game.save.data.coins);
    this.$('garage-coins').textContent = formatCoins(this.game.save.data.coins);
  }

  bind() {
    const g = this.game;
    const click = (id, fn) => { const el = this.$(id); if (el) el.addEventListener('click', () => { g.audio.init(); g.audio.click(); fn(); }); };

    click('btn-play', () => { this.openTrackSelect('quick'); });
    click('btn-modes', () => { this.show('screen-modes'); });
    click('btn-garage', () => { g.openGarage(); });
    click('btn-settings', () => { this.renderSettings(); this.show('screen-settings'); });
    click('btn-credits', () => { this.show('screen-credits'); });

    const fsToggle = () => this.toggleFullscreen();
    click('btn-fullscreen', fsToggle);
    const fsHud = this.$('btn-fullscreen-hud');
    if (fsHud) fsHud.addEventListener('click', fsToggle);
    for (const ev of ['fullscreenchange', 'webkitfullscreenchange']) {
      document.addEventListener(ev, () => this.updateFullscreenButtons());
    }

    document.querySelectorAll('[data-back]').forEach((b) => {
      b.addEventListener('click', () => { g.audio.click(); this.show(this.backTarget); });
    });

    document.querySelectorAll('.mode-card').forEach((card) => {
      card.addEventListener('click', () => {
        g.audio.init(); g.audio.click();
        this.openTrackSelect(card.dataset.mode);
      });
    });

    document.querySelectorAll('#seg-difficulty button').forEach((b) => {
      b.addEventListener('click', () => {
        this.difficulty = b.dataset.diff;
        this.segSelect('seg-difficulty', b);
      });
    });
    document.querySelectorAll('#seg-laps button').forEach((b) => {
      b.addEventListener('click', () => { this.laps = +b.dataset.laps; this.segSelect('seg-laps', b); });
    });
    document.querySelectorAll('#seg-opponents button').forEach((b) => {
      b.addEventListener('click', () => { this.opponents = +b.dataset.opp; this.segSelect('seg-opponents', b); });
    });

    click('btn-start-race', () => this.startSelected());

    click('btn-pause', () => g.pauseRace());
    click('btn-resume', () => g.resumeRace());
    click('btn-restart', () => g.restartRace());
    click('btn-quit', () => g.quitRace());

    click('btn-results-next', () => this.resultsNext());
    click('btn-results-retry', () => { this.hideAll(); g.startRace(this.lastRaceConfig); });
    click('btn-results-menu', () => { g.quitToMenu(); });

    document.querySelectorAll('#seg-quality button').forEach((b) => {
      b.addEventListener('click', () => {
        g.setQuality(b.dataset.q);
        this.renderSettings();
      });
    });
    document.querySelectorAll('#seg-touch button').forEach((b) => {
      b.addEventListener('click', () => {
        g.save.data.settings.touch = b.dataset.t;
        g.save.save();
        this.renderSettings();
        g.updateTouchVisibility();
      });
    });
    click('tgl-autoquality', () => {
      g.save.data.settings.autoQuality = !g.save.data.settings.autoQuality;
      g.save.save(); this.renderSettings();
    });
    click('tgl-sound', () => {
      g.save.data.settings.sound = !g.save.data.settings.sound;
      g.save.save(); g.audio.setSound(g.save.data.settings.sound); this.renderSettings();
    });
    click('tgl-music', () => {
      g.save.data.settings.music = !g.save.data.settings.music;
      g.save.save(); g.audio.setMusic(g.save.data.settings.music); this.renderSettings();
    });
    click('btn-reset-progress', () => {
      if (confirm('Apagar todo o progresso? Esta ação não pode ser desfeita.')) {
        g.save.reset();
        this.refreshCoins();
        this.renderSettings();
        this.toast('Progresso apagado.');
      }
    });
  }

  segSelect(segId, btn) {
    document.querySelectorAll(`#${segId} button`).forEach((b) => b.classList.remove('sel'));
    btn.classList.add('sel');
  }

  openTrackSelect(mode) {
    this.mode = mode;
    this.backTarget = mode === 'quick' ? 'screen-menu' : 'screen-modes';
    const m = MODES[mode];
    this.$('setup-mode').textContent = m.label.toUpperCase();
    const isChamp = mode === 'championship';
    this.$('setup-difficulty').style.display = m.difficulty ? 'block' : 'none';
    this.$('setup-laps').style.display = m.laps ? 'block' : 'none';
    this.$('setup-opponents').style.display = mode === 'quick' ? 'block' : 'none';
    this.renderTrackList();
    this.updateRecordBox();
    this.show('screen-track');
  }

  renderTrackList() {
    const list = this.$('track-list');
    list.innerHTML = '';
    const isChamp = this.mode === 'championship';
    if (isChamp) {
      const div = document.createElement('div');
      div.className = 'record-box';
      div.style.gridColumn = '1/-1';
      div.innerHTML = `<b>CAMPIONATO</b><br>Dispute as ${TRACKS.length} pistas em sequência. Quem somar mais pontos leva o título! (${CHAMPIONSHIP_POINTS.slice(0, 3).join('-')}-... pontos)`;
      list.appendChild(div);
      this.trackId = TRACKS[0].id;
      return;
    }
    TRACKS.forEach((t) => {
      const card = document.createElement('button');
      card.className = 'track-card' + (t.id === this.trackId ? ' sel' : '');
      card.innerHTML = `<div class="tc-swatch" style="background:linear-gradient(135deg, ${THEME_COLORS[t.theme]}, #101318)"></div>
        <h3>${t.name}</h3><p>${t.desc}</p>`;
      card.addEventListener('click', () => {
        this.trackId = t.id;
        this.game.audio.click();
        this.renderTrackList();
        this.updateRecordBox();
      });
      list.appendChild(card);
    });
  }

  updateRecordBox() {
    const box = this.$('record-box');
    const best = this.game.save.data.bestTimes[this.trackId];
    const t = TRACKS.find((x) => x.id === this.trackId);
    box.innerHTML = best
      ? `Recorde em <b>${t.name}</b>: <b>${formatTime(best)}</b>`
      : `Nenhum recorde em <b>${t.name}</b> ainda. Seja o primeiro!`;
  }

  startSelected() {
    const m = MODES[this.mode];
    const cfg = {
      mode: this.mode,
      trackId: this.trackId,
      difficulty: this.difficulty,
      laps: m.laps ? this.laps : 0,
      opponents: m.opponents ? (m.fixedOpponents || this.opponents) : 0,
    };
    if (this.mode === 'championship') {
      this.game.save.data.championship = { round: 0, points: {}, difficulty: this.difficulty };
      this.game.save.save();
      cfg.trackId = TRACKS[0].id;
    }
    this.lastRaceConfig = cfg;
    this.game.startRace(cfg);
  }

  resultsNext() {
    const g = this.game;
    const r = g.lastResults;
    if (r && r.mode === 'championship' && g.save.data.championship) {
      const champ = g.save.data.championship;
      if (champ.round >= TRACKS.length) {
        this.showStandings(true);
      } else {
        this.showStandings(false);
      }
      return;
    }
    g.quitToMenu();
  }

  showStandings(final) {
    const g = this.game;
    const champ = g.save.data.championship;
    const rows = Object.entries(champ.points).sort((a, b) => b[1] - a[1]);
    const title = this.$('results-title');
    title.textContent = final ? 'FIM DO CAMPIONATO' : 'CLASSIFICAÇÃO';
    const rowsEl = this.$('results-rows');
    rowsEl.innerHTML = rows.map(([name, pts], i) =>
      `<div class="res-row${name === 'VOCÊ' ? ' me' : ''}"><span class="rr-pos">${i + 1}º</span><span class="rr-name">${name}</span><span class="rr-time">${pts} pts</span></div>`
    ).join('');
    let bonus = 0;
    if (final) {
      const champion = rows[0] && rows[0][0];
      if (champion === 'VOCÊ') {
        bonus = 2000;
        g.save.addCoins(bonus);
        g.save.data.stats.championships++;
        g.save.save();
        title.textContent = 'VOCÊ É O CAMPEÃO!';
      } else {
        title.textContent = `CAMPEÃO: ${champion}`;
      }
      g.save.data.championship = null;
      g.save.save();
    }
    this.$('results-coins').textContent = final && bonus > 0 ? `+${formatCoins(bonus)} bônus` : '';
    const nextBtn = this.$('btn-results-next');
    nextBtn.textContent = final ? 'MENU' : 'PRÓXIMA CORRIDA';
    this.$('btn-results-retry').style.display = 'none';
    nextBtn.onclick = () => {
      if (final) { g.quitToMenu(); return; }
      const cfg = {
        mode: 'championship',
        trackId: TRACKS[champ.round].id,
        difficulty: champ.difficulty || 'medium',
        laps: 3,
        opponents: 5,
      };
      this.lastRaceConfig = cfg;
      this.hideAll();
      g.startRace(cfg);
    };
    this.show('screen-results');
  }

  showResults(results) {
    const g = this.game;
    this.$('btn-results-retry').style.display = results.mode === 'championship' ? 'none' : 'inline-block';
    const title = this.$('results-title');
    if (results.mode === 'free') title.textContent = 'CORRIDA LIVRE';
    else if (results.mode === 'timeattack') title.textContent = 'CONTRARRELÓGIO';
    else if (results.playerLost) title.textContent = 'ELIMINADO!';
    else if (results.playerPos === 1) title.textContent = 'VITÓRIA!';
    else title.textContent = `${results.playerPos}º LUGAR`;

    const rowsEl = this.$('results-rows');
    rowsEl.innerHTML = results.rows.map((r) =>
      `<div class="res-row${r.me ? ' me' : ''}${r.out ? ' out' : ''}"><span class="rr-pos">${r.pos}º</span><span class="rr-name">${r.name}</span><span class="rr-time">${r.time}</span></div>`
    ).join('');
    this.$('results-coins').textContent = '+' + formatCoins(results.coins);
    const nextBtn = this.$('btn-results-next');
    nextBtn.textContent = 'CONTINUAR';
    nextBtn.onclick = () => this.resultsNext();
    this.show('screen-results');
  }

  renderSettings() {
    const s = this.game.save.data.settings;
    document.querySelectorAll('#seg-quality button').forEach((b) => b.classList.toggle('sel', b.dataset.q === s.quality));
    document.querySelectorAll('#seg-touch button').forEach((b) => b.classList.toggle('sel', b.dataset.t === s.touch));
    this.$('tgl-autoquality').classList.toggle('on', !!s.autoQuality);
    this.$('tgl-sound').classList.toggle('on', !!s.sound);
    this.$('tgl-music').classList.toggle('on', !!s.music);
    const st = this.game.save.data.stats;
    this.$('stats-box').innerHTML = `<h4>ESTATÍSTICAS DO JOGADOR</h4><div class="stats-grid">
      <div class="stat-cell"><b>${st.races}</b><span>Corridas</span></div>
      <div class="stat-cell"><b>${st.wins}</b><span>Vitórias</span></div>
      <div class="stat-cell"><b>${st.podiums}</b><span>Pódios</span></div>
      <div class="stat-cell"><b>${st.km.toFixed(1)}</b><span>Km rodados</span></div>
      <div class="stat-cell"><b>${st.championships}</b><span>Títulos</span></div>
      <div class="stat-cell"><b>${Object.keys(this.game.save.data.bestTimes).length}</b><span>Recordes</span></div>
    </div>`;
  }
}

const THEME_COLORS = {
  city: 'linear-gradient(135deg,#1a2a5e,#ff8c42)',
  mountain: 'linear-gradient(135deg,#2f6fd0,#3f7a34)',
  highway: 'linear-gradient(135deg,#1e63c8,#4a7c3a)',
  circuit: 'linear-gradient(135deg,#1465c8,#c8ccd4)',
  desert: 'linear-gradient(135deg,#2a7ad4,#d8b070)',
};
