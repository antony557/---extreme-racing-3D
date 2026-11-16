// HUD — bússola, coordenadas, status, mira, marcadores e avisos
import * as THREE from 'three';
import { STANCE } from '../core/config.js';
import { clamp, lerp } from '../core/utils.js';

const $ = (id) => document.getElementById(id);

export class Hud {
  constructor() {
    this.el = {
      compass: $('compass-tape'),
      compassMark: $('compass-mark'),
      coords: $('hud-coords'),
      clock: $('hud-clock'),
      weather: $('hud-weather'),
      objective: $('hud-objective'),
      objectiveText: $('hud-objective-text'),
      objectiveProgress: $('hud-objective-progress'),
      health: $('bar-health'),
      stamina: $('bar-stamina'),
      healthNum: $('health-num'),
      ammo: $('hud-ammo'),
      reserve: $('hud-reserve'),
      weaponName: $('hud-weapon'),
      stance: $('hud-stance'),
      zoom: $('hud-zoom'),
      crosshair: $('crosshair'),
      scope: $('scope-overlay'),
      scopeZoom: $('scope-zoom'),
      binoc: $('binoc-overlay'),
      hitmarker: $('hitmarker'),
      vignette: $('damage-vignette'),
      prompt: $('interact-prompt'),
      killfeed: $('killfeed'),
      banner: $('mission-banner'),
      medkits: $('hud-medkits'),
      fps: $('hud-fps'),
    };
    this.marker = $('objective-marker');
    this.markerLabel = $('objective-marker-label');
    this._vignetteTimer = 0;
    this._bannerTimer = 0;
    this._compassItems = [];
    this._initCompass();
    this._lastHealth = 100;
    this._heartTimer = 0;
  }

  _initCompass() {
    const tape = this.el.compass;
    const names = { 0: 'N', 45: 'NE', 90: 'L', 135: 'SE', 180: 'S', 225: 'SO', 270: 'O', 315: 'NO' };
    for (let rep = 0; rep < 3; rep++) {
      for (let deg = 0; deg < 360; deg += 15) {
        const d = document.createElement('div');
        d.className = 'compass-tick' + (deg % 45 === 0 ? ' major' : '');
        d.style.left = (rep * 360 + deg) * 3 + 'px';
        if (deg % 45 === 0) d.textContent = names[deg];
        tape.appendChild(d);
      }
    }
  }

  updateCompass(yaw, markers, camera) {
    // yaw: 0 = -Z (norte). converter para graus
    let deg = (-yaw * 180 / Math.PI) % 360;
    if (deg < 0) deg += 360;
    // tira centralizada: usa repetição para evitar salto
    const half = this.el.compass.parentElement.clientWidth / 2;
    this.el.compass.style.transform = `translateX(${half - (deg + 360) * 3}px)`;

    // marcadores no mundo (objetivo, POIs)
    for (const item of this._compassItems) item.remove();
    this._compassItems = [];
    const parent = this.el.compass.parentElement;
    for (const m of markers) {
      const dx = m.x - camera.position.x, dz = m.z - camera.position.z;
      const dist = Math.hypot(dx, dz);
      if (dist > 900) continue;
      let bearing = Math.atan2(dx, -dz) * 180 / Math.PI;
      let rel = bearing - deg;
      while (rel > 180) rel -= 360;
      while (rel < -180) rel += 360;
      if (Math.abs(rel) > 60) continue;
      const el = document.createElement('div');
      el.className = 'compass-marker' + (m.kind === 'objective' ? ' objective' : '');
      el.textContent = m.label || '◆';
      el.style.left = `calc(50% + ${rel * 3}px)`;
      parent.appendChild(el);
      this._compassItems.push(el);
    }
  }

  setMarker(worldPos, label, camera) {
    if (!worldPos) {
      this.marker.style.display = 'none';
      return;
    }
    const v = _v1.copy(worldPos).project(camera);
    const behind = v.z > 1;
    const x = (v.x * 0.5 + 0.5) * window.innerWidth;
    const y = (-v.y * 0.5 + 0.5) * window.innerHeight;
    const dist = camera.position.distanceTo(worldPos);
    this.marker.style.display = 'block';
    this.markerLabel.textContent = `${label || ''} · ${Math.round(dist)}m`;
    if (behind || x < 40 || x > window.innerWidth - 40 || y < 60 || y > window.innerHeight - 60) {
      // fixa na borda
      const cx = window.innerWidth / 2, cy = window.innerHeight / 2;
      let dx = x - cx, dy = y - cy;
      if (behind) { dx = -dx; dy = -dy; }
      const ang = Math.atan2(dy, dx);
      const rx = Math.min(window.innerWidth * 0.42, Math.abs(Math.cos(ang)) * window.innerWidth) ;
      const scale = Math.min((window.innerWidth * 0.42) / Math.max(Math.abs(dx), 1), (window.innerHeight * 0.38) / Math.max(Math.abs(dy), 1));
      this.marker.style.left = (cx + dx * scale) + 'px';
      this.marker.style.top = (cy + dy * scale) + 'px';
    } else {
      this.marker.style.left = x + 'px';
      this.marker.style.top = y + 'px';
    }
  }

  update(dt, player, weapon, sky, weather, missionMgr, camera) {
    // Topo
    this.el.coords.textContent = `${Math.round(player.pos.x)} / ${Math.round(player.pos.z)} · ALT ${Math.round(player.pos.y)}m`;
    this.el.clock.textContent = sky.clock;
    this.el.weather.textContent = weather.label;

    // Objetivo
    const m = missionMgr.active;
    if (m) {
      this.el.objective.style.display = 'block';
      this.el.objectiveText.textContent = m.title;
      this.el.objectiveProgress.textContent = missionMgr.progressLabel(m);
      if (m.target) this.setMarker(_v2.set(m.target.x, (player.pos.y + 2), m.target.z), m.marker || m.title, camera);
      else if (m.points) {
        let nearest = null, nd = 1e9;
        for (const p of m.points) {
          if (missionMgr.visited.has(p.name)) continue;
          const d = dist2d(player.pos.x, player.pos.z, p.x, p.z);
          if (d < nd) { nd = d; nearest = p; }
        }
        if (nearest) this.setMarker(_v2.set(nearest.x, player.pos.y + 2, nearest.z), nearest.name, camera);
        else this.setMarker(null);
      } else this.setMarker(null);
    } else {
      this.el.objective.style.display = 'none';
      this.setMarker(null);
    }

    // Inferior
    const hp = Math.round(player.health);
    this.el.health.style.width = hp + '%';
    this.el.health.classList.toggle('low', hp < 35);
    this.el.healthNum.textContent = hp;
    this.el.stamina.style.width = player.stamina + '%';
    this.el.ammo.textContent = weapon.ammo;
    this.el.reserve.textContent = '/ ' + weapon.reserve;
    this.el.weaponName.textContent = weapon.def ? weapon.def.name : '—';
    this.el.medkits.textContent = '✚ ' + player.medkits;
    this.el.stance.textContent = ['EM PÉ', 'AGACHADO', 'PRONA'][player.stance >= 1.5 ? 2 : Math.round(player.stance) === 1 ? 1 : 0];
    this.el.zoom.textContent = weapon.mode === 'aim' ? `${weapon.def.zoomFov[weapon.zoomIndex]}×` : weapon.mode === 'binoc' ? 'BINÓCULO' : '';

    // Overlays
    const scoped = weapon.mode === 'aim';
    const binoc = weapon.mode === 'binoc';
    this.el.scope.classList.toggle('visible', scoped);
    this.el.binoc.classList.toggle('visible', binoc);
    this.el.crosshair.classList.toggle('hidden', scoped || binoc);
    if (scoped) this.el.scopeZoom.textContent = weapon.def.zoomFov[weapon.zoomIndex] + '×';

    // Vinheta de dano
    this._vignetteTimer = Math.max(0, this._vignetteTimer - dt);
    const lowHp = hp < 30 ? (30 - hp) / 30 : 0;
    this.el.vignette.style.opacity = clamp(this._vignetteTimer + lowHp * 0.5, 0, 0.95);

    // Batimento em vida baixa
    if (hp < 30 && hp > 0) {
      this._heartTimer -= dt;
      if (this._heartTimer <= 0) { this._heartTimer = lerp(0.5, 1.1, hp / 30); }
    }

    // Banner de missão
    this._bannerTimer = Math.max(0, this._bannerTimer - dt);
    if (this._bannerTimer === 0) this.el.banner.classList.remove('visible');
  }

  hitMarker(headshot) {
    this.el.hitmarker.classList.toggle('headshot', !!headshot);
    this.el.hitmarker.classList.add('show');
    clearTimeout(this._hmTimer);
    this._hmTimer = setTimeout(() => this.el.hitmarker.classList.remove('show'), 180);
  }

  showDamage() { this._vignetteTimer = 0.6; }

  killFeed(text) {
    const el = document.createElement('div');
    el.className = 'killfeed-item';
    el.textContent = text;
    this.el.killfeed.appendChild(el);
    setTimeout(() => el.classList.add('fade'), 2600);
    setTimeout(() => el.remove(), 3200);
  }

  prompt(text) {
    if (text) {
      this.el.prompt.textContent = text;
      this.el.prompt.classList.add('visible');
    } else {
      this.el.prompt.classList.remove('visible');
    }
  }

  banner(text, sub) {
    this.el.banner.innerHTML = `<div class="banner-title">${text}</div>${sub ? `<div class="banner-sub">${sub}</div>` : ''}`;
    this.el.banner.classList.add('visible');
    this._bannerTimer = 4.5;
  }

  setFps(fps) {
    if (this.el.fps) this.el.fps.textContent = Math.round(fps) + ' FPS';
  }
}

const _v1 = new THREE.Vector3();
const _v2 = new THREE.Vector3();
function dist2d(ax, az, bx, bz) { const dx = ax - bx, dz = az - bz; return Math.sqrt(dx * dx + dz * dz); }
