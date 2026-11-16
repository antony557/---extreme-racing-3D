// Menus — principal, loadout, missões, configurações, pausa, resultados
import { QUALITY, WEAPONS, IS_MOBILE } from '../core/config.js';
import { getSave, saveNow, resetSave } from '../core/save.js';
import { unlockedWeapons, levelFromXp, xpForLevel } from '../game/progression.js';
import { CAMPAIGN } from '../game/missions.js';
import { isMissionDone } from '../game/progression.js';

const $ = (id) => document.getElementById(id);

export class Menus {
  constructor(cb) {
    this.cb = cb; // { onStartGame(mode, missionId), onResume, onQuit, onSettings(quality, sens), onMissionStart }
    this.quality = getSave().settings?.quality || (IS_MOBILE ? 'medium' : 'ultra');
    this.sens = getSave().settings?.sensitivity || 1;
    this.selectedRifle = getSave().loadout?.rifle || 'vanguard';
    this._bind();
  }

  _bind() {
    $('btn-play-hunt').onclick = () => this.cb.onStartGame('hunt', null);
    $('btn-campaign').onclick = () => this._show('screen-missions');
    $('btn-loadout').onclick = () => this._openLoadout();
    $('btn-settings').onclick = () => this._openSettings();
    $('btn-back-missions').onclick = () => this._show('screen-main');
    $('btn-back-loadout').onclick = () => this._show('screen-main');
    $('btn-back-settings').onclick = () => this._show('screen-main');
    $('btn-resume').onclick = () => this.cb.onResume();
    $('btn-quit').onclick = () => this.cb.onQuit();
    $('btn-results-ok').onclick = () => this.cb.onQuit();
    $('btn-death-menu').onclick = () => this.cb.onQuit();
    $('btn-wipe').onclick = () => {
      resetSave();
      location.reload();
    };
    this._buildQualitySelect();
    this._buildSens();
  }

  _show(id) {
    for (const el of document.querySelectorAll('.screen')) el.classList.remove('open');
    if (id) $(id).classList.add('open');
  }

  _buildQualitySelect() {
    const sel = $('sel-quality');
    sel.innerHTML = '';
    for (const [key, q] of Object.entries(QUALITY)) {
      const opt = document.createElement('option');
      opt.value = key;
      opt.textContent = q.label;
      if (key === this.quality) opt.selected = true;
      sel.appendChild(opt);
    }
    sel.onchange = () => {
      this.quality = sel.value;
      this.cb.onSettings(this.quality, this.sens);
    };
  }

  _buildSens() {
    const sl = $('sl-sens');
    sl.value = this.sens;
    $('sens-val').textContent = this.sens.toFixed(1);
    sl.oninput = () => {
      this.sens = parseFloat(sl.value);
      $('sens-val').textContent = this.sens.toFixed(1);
      this.cb.onSettings(this.quality, this.sens);
    };
  }

  _openLoadout() {
    const list = $('loadout-rifles');
    list.innerHTML = '';
    const save = getSave();
    for (const w of Object.values(WEAPONS)) {
      const unlocked = save.level >= w.unlockLevel;
      const div = document.createElement('div');
      div.className = 'item-card' + (unlocked ? '' : ' locked') + (this.selectedRifle === w.id ? ' selected' : '');
      div.innerHTML = `
        <div class="item-name">${w.name}</div>
        <div class="item-stats">
          <span>DANO ${w.damage}</span><span>VEL ${w.muzzleVelocity} m/s</span>
          <span>CARREGADOR ${w.magazine}</span><span>ZOOM ${w.zoomFov.join('/')}</span>
        </div>
        <div class="item-lock">${unlocked ? '' : '🔒 Nível ' + w.unlockLevel}</div>`;
      if (unlocked) {
        div.onclick = () => {
          this.selectedRifle = w.id;
          this._openLoadout();
        };
      }
      list.appendChild(div);
    }
    const med = $('loadout-medkits');
    med.value = save.loadout?.medkits ?? 2;
    med.onchange = () => { save.loadout.medkits = parseInt(med.value); saveNow(); };
    this._show('screen-loadout');
  }

  openMissions() {
    const list = $('mission-list');
    list.innerHTML = '';
    for (const m of CAMPAIGN) {
      const done = isMissionDone(m.id);
      const div = document.createElement('div');
      div.className = 'mission-card' + (done ? ' done' : '');
      div.innerHTML = `
        <div class="mission-title">${done ? '✔ ' : ''}${m.title}</div>
        <div class="mission-desc">${m.desc}</div>
        <div class="mission-xp">+${m.xp} XP</div>`;
      if (!done) div.onclick = () => this.cb.onMissionStart(m.id);
      list.appendChild(div);
    }
    this._show('screen-missions');
  }

  showMain() {
    const save = getSave();
    $('main-level').textContent = `NÍVEL ${save.level}`;
    const cur = xpForLevel(save.level), next = xpForLevel(save.level + 1);
    const pct = save.level > 1 ? Math.round(((save.xp - cur) / Math.max(1, next - cur)) * 100) : Math.round((save.xp / next) * 100);
    $('main-xpbar').style.width = pct + '%';
    $('main-stats').textContent =
      `Abates NPC: ${save.stats.killsNpc} · Caças: ${save.stats.killsAnimal} · Tiro mais longo: ${Math.round(save.stats.longestShot)}m · Missões: ${save.stats.missionsDone}`;
    this._show('screen-main');
  }

  showPause() { this._show('screen-pause'); }
  hideAll() { this._show(null); }

  showResults(mission, detail, levelUp) {
    $('results-title').textContent = 'MISSÃO CONCLUÍDA';
    $('results-name').textContent = mission.title;
    $('results-detail').textContent = detail || '';
    $('results-xp').textContent = `+${mission.xp} XP`;
    $('results-level').textContent = levelUp && levelUp.leveledUp ? `SUBIU PARA O NÍVEL ${levelUp.level}!` : `Nível ${levelUp ? levelUp.level : '?'}`;
    this._show('screen-results');
  }

  showDeath(stats) {
    $('death-stats').textContent = stats || '';
    this._show('screen-death');
  }
}
