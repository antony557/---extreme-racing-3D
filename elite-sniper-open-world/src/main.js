// ELITE SNIPER — OPEN WORLD :: Bootstrap e loop principal
import * as THREE from 'three';
import { QUALITY, WEAPONS, IS_MOBILE, STANCE } from './core/config.js';
import { loadSave, getSave, saveNow } from './core/save.js';
import { AudioEngine } from './core/audio.js';
import { Input } from './core/input.js';
import { World } from './world/world.js';
import { terrainHeight } from './world/heightfield.js';
import { Player } from './player/player.js';
import { CameraController } from './player/camera.js';
import { Ballistics } from './weapons/ballistics.js';
import { WeaponSystem } from './weapons/weaponSystem.js';
import { AnimalManager } from './entities/animals.js';
import { NpcManager } from './entities/npcs.js';
import { MissionManager } from './game/missions.js';
import { addStat, setStat, saveWorldState, addXp, saveSettings } from './game/progression.js';
import { Hud } from './ui/hud.js';
import { Menus } from './ui/menus.js';
import { applyMobileLayout } from './ui/mobileLayout.js';
import { fbm, clamp } from './core/utils.js';

class Game {
  constructor() {
    this.state = 'menu';
    this.canvas = document.getElementById('game-canvas');

    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas, antialias: true, powerPreference: 'high-performance',
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(75, 1, 0.05, 2400);
    this.scene.add(this.camera);

    this.audio = new AudioEngine();
    this.input = new Input(this.canvas);
    this.hud = new Hud();

    const save = loadSave();
    const qKey = save.settings?.quality || (IS_MOBILE ? 'medium' : 'ultra');
    this.qualityKey = qKey;
    this.quality = QUALITY[qKey];
    this.applyQuality(qKey);

    this.world = new World(this.scene, this.renderer, this.quality, {
      onThunder: () => this.audio.thunder(),
    });

    this.ballistics = new Ballistics(this.world, {
      onEntityHit: (e, dmg, point, headshot) => this._onEntityHit(e, dmg, point, headshot),
      onImpact: (point, kind) => this._spawnImpactParticles(point, kind),
      onImpactSound: (point, kind) => this.audio.impact(point, kind),
    });

    this.player = new Player(this.world, { x: 150, z: 130, yaw: 2.4 });
    this.player.onFootstep = (x, z, running) => this.audio.footstep(running);
    this.player.onNoise = (x, z, radius) => this.world.noiseEvent(x, z, radius, 'footstep');

    this.playerEntity = {
      pos: this.player.pos, radius: 0.42, height: 1.7,
      alive: true, faction: 'player', isPlayer: true, ref: null,
    };
    this.world.addEntity(this.playerEntity);

    this.cameraCtl = new CameraController(this.camera, this.player, this.input);
    this.weapons = new WeaponSystem(this.camera, this.world, this.ballistics, this.audio, {
      onShot: (x, z) => {
        this.world.noiseEvent(x, z, 340, 'gunshot');
        addStat('shotsFired');
      },
      onStats: (k, v) => addStat(k, v),
      onAmmoChange: () => {},
    });
    this.weapons.setShooterEntity(this.playerEntity);

    this.animalMgr = new AnimalManager(this.world, this.audio);
    this.npcMgr = new NpcManager(this.world, this.audio);
    this.missionMgr = new MissionManager({
      onComplete: (m, result) => this._onMissionComplete(m, result),
      onProgress: () => {},
    });

    this.menus = new Menus({
      onStartGame: (mode) => this.startGame(mode, null),
      onResume: () => this.resume(),
      onQuit: () => this.quitToMenu(),
      onSettings: (q, sens) => this._onSettings(q, sens),
      onMissionStart: (id) => { this.menus.hideAll(); this.startGame('campaign', id); },
      onLoadoutBack: () => {
        if (this.state === 'paused') this.menus.showPause();
        else this.menus.showMain();
      },
    });

    document.getElementById('btn-back-loadout').onclick = () => this.menus.cb.onLoadoutBack();
    document.getElementById('btn-death-respawn').onclick = () => this.respawn();

    this.intelItems = [];
    this.intelCollected = 0;
    this.particles = [];
    this.fpsEma = 60;
    this.fpsLowTime = 0;
    this.resScale = this.quality.resScale;
    this.autosaveTimer = 0;
    this.menuAngle = 0;
    this.mode = 'hunt';

    window.addEventListener('resize', () => { this._resize(); applyMobileLayout(); });
    applyMobileLayout();
    this._resize();
    this.menus.showMain();

    this.clock = new THREE.Clock();
    this._loop = this._loop.bind(this);
    requestAnimationFrame(this._loop);
  }

  applyQuality(key) {
    this.qualityKey = key;
    this.quality = QUALITY[key];
    const q = this.quality;
    this.renderer.shadowMap.enabled = q.shadowMap > 0;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.resScale = q.resScale;
    if (this.world) this.world.setQuality(q);
    this._resize();
  }

  _onSettings(quality, sens) {
    this.input.sensitivity = sens;
    this.input.touchSensitivity = sens;
    this.applyQuality(quality);
    saveSettings({ quality, sensitivity: sens });
  }

  _resize() {
    const q = this.quality;
    const dpr = Math.min(window.devicePixelRatio || 1, q.maxPixelRatio) * this.resScale;
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
  }

  // ---- Fluxo de estados ----
  startGame(mode, missionId) {
    this.audio.init();
    const save = getSave();
    const loadout = save.loadout || {};
    const spawn = mode === 'campaign' && save.position ? save.position : { x: 150, z: 130, yaw: 2.4 };
    this.player.pos.set(spawn.x, 0, spawn.z);
    this.player.pos.y = terrainHeight(spawn.x, spawn.z);
    this.player.yaw = spawn.yaw || 0;
    this.player.alive = true;
    this.player.health = 100;
    this.player.stamina = 100;
    this.player.medkits = loadout.medkits ?? 2;
    this.player.camo = loadout.camo || 0;
    this.player.hasBipod = loadout.bipod !== false;

    const def = WEAPONS[loadout.rifle] || WEAPONS.vanguard;
    this.weapons.equip(def, def.magazine, def.reserve, this.player.hasBipod);

    this.world.sky.time = save.worldTime ?? 8 * 3600;
    this.mode = mode;
    this.npcMgr.setDifficulty(mode === 'campaign' ? 1 : 0);
    this.npcMgr.clear();
    this.animalMgr.clear();
    this._clearIntel();
    this._clearParticles();

    if (missionId) this.missionMgr.start(missionId);
    else this.missionMgr.abandon();
    if (mode === 'campaign' && !missionId) {
      const first = this.missionMgr.available()[0];
      if (first) this.missionMgr.start(first.id);
    }
    if (this.missionMgr.active && this.missionMgr.active.id === 'm7') this._spawnIntel();

    this.state = 'playing';
    this.menus.hideAll();
    document.getElementById('hud').classList.remove('hidden');
    document.getElementById('mobile-controls').classList.toggle('hidden', !IS_MOBILE);
    applyMobileLayout();
    this.input.setEnabled(true);
    if (!IS_MOBILE) this.input.requestPointerLock();
    this.hud.banner(mode === 'campaign' ? 'MODO CAMPANHA' : 'MODO CAÇA LIVRE',
      this.missionMgr.active ? this.missionMgr.active.title : 'Explore, cace e sobreviva');
  }

  pause() {
    if (this.state !== 'playing') return;
    this.state = 'paused';
    this.input.setEnabled(false);
    if (document.pointerLockElement) document.exitPointerLock();
    this.menus.showPause();
  }

  resume() {
    this.state = 'playing';
    this.menus.hideAll();
    this.input.setEnabled(true);
    if (!IS_MOBILE) this.input.requestPointerLock();
  }

  quitToMenu() {
    this._saveWorld();
    this.state = 'menu';
    this.input.setEnabled(false);
    document.getElementById('hud').classList.add('hidden');
    document.getElementById('mobile-controls').classList.add('hidden');
    if (document.pointerLockElement) document.exitPointerLock();
    this.menus.showMain();
  }

  _onMissionComplete(m, result) {
    this.audio.missionComplete();
    this.hud.banner('MISSÃO CONCLUÍDA', `${m.title} · +${m.xp} XP`);
    this.menus.showResults(m, result.detail, result.levelUp);
    this.state = 'results';
    this.input.setEnabled(false);
    if (document.pointerLockElement) document.exitPointerLock();
  }

  _onEntityHit(e, dmg, point, headshot) {
    if (!e.alive) return;
    const dist = this.camera.position.distanceTo(point);
    if (e.isPlayer) {
      this.player.damage(dmg, point.x, point.z);
      this.hud.showDamage();
      this.audio.hurt();
      this.cameraCtl.addShake(0.4);
      if (!this.player.alive) this._onPlayerDeath();
      return;
    }
    addStat('hits');
    this.hud.hitMarker(headshot);
    this.audio.hitmarker();
    if (e.faction === 'animal') {
      e.ref.takeDamage(dmg, point, headshot);
      if (!e.ref.alive) {
        addStat('killsAnimal');
        this.hud.killFeed(`${e.ref.def.name} abatido · ${Math.round(dist)}m${headshot ? ' · HEADSHOT' : ''}`);
        this.missionMgr.onAnimalKilled(e.ref.kind, dist);
        this._checkLongshot(dist);
        addXp(e.ref.def.xp);
      }
    } else if (e.faction === 'npc') {
      e.ref.takeDamage(dmg, point, headshot);
      if (!e.ref.alive) {
        addStat('killsNpc');
        this.hud.killFeed(`Hostil neutralizado · ${Math.round(dist)}m${headshot ? ' · HEADSHOT' : ''}`);
        this.missionMgr.onNpcKilled(dist, e.ref.pos.x, e.ref.pos.z);
        this._checkLongshot(dist);
        addXp(50);
      }
    }
  }

  _checkLongshot(dist) {
    const s = getSave();
    if (dist > s.stats.longestShot) setStat('longestShot', dist);
  }

  _onPlayerDeath() {
    this.state = 'dead';
    this.input.setEnabled(false);
    if (document.pointerLockElement) document.exitPointerLock();
    this.audio.missionFailed();
    const s = getSave();
    this.menus.showDeath(`Abates NPC: ${s.stats.killsNpc} · Caças: ${s.stats.killsAnimal} · Missões: ${s.stats.missionsDone}`);
  }

  respawn() {
    this.startGame(this.mode || 'hunt', this.missionMgr.active ? this.missionMgr.active.id : null);
  }

  // ---- Intel (missão m7) ----
  _spawnIntel() {
    const base = { x: -60, z: -420 };
    const spots = [[-20, -450], [10, -390], [-45, -395]];
    for (const [dx, dz] of spots) {
      const geo = new THREE.BoxGeometry(0.5, 0.35, 0.35);
      const mat = new THREE.MeshStandardMaterial({ color: 0x8a6d2f, emissive: 0x554411, emissiveIntensity: 0.6, roughness: 0.5, metalness: 0.4 });
      const m = new THREE.Mesh(geo, mat);
      const y = terrainHeight(base.x + dx, base.z + dz);
      m.position.set(base.x + dx, y + 0.5, base.z + dz);
      this.world.scene.add(m);
      this.intelItems.push(m);
    }
    this.intelCollected = 0;
  }

  _clearIntel() {
    for (const m of this.intelItems) this.world.scene.remove(m);
    this.intelItems = [];
    this.intelCollected = 0;
  }

  // ---- Partículas de impacto ----
  _spawnImpactParticles(point, kind) {
    const count = Math.max(4, Math.floor(10 * this.quality.particles));
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(count * 3);
    const vel = [];
    for (let i = 0; i < count; i++) {
      pos[i * 3] = point.x; pos[i * 3 + 1] = point.y; pos[i * 3 + 2] = point.z;
      vel.push(new THREE.Vector3((Math.random() - 0.5) * 4, Math.random() * 3 + 1, (Math.random() - 0.5) * 4));
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const color = kind === 'entity' ? 0xa01818 : 0x9a8868;
    const mat = new THREE.PointsMaterial({ color, size: 0.08, transparent: true, opacity: 1, depthWrite: false });
    const pts = new THREE.Points(geo, mat);
    this.world.scene.add(pts);
    this.particles.push({ pts, vel, life: 0.7 });
  }

  _updateParticles(dt) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      const arr = p.pts.geometry.attributes.position.array;
      for (let j = 0; j < p.vel.length; j++) {
        p.vel[j].y -= 9.8 * dt;
        arr[j * 3] += p.vel[j].x * dt;
        arr[j * 3 + 1] += p.vel[j].y * dt;
        arr[j * 3 + 2] += p.vel[j].z * dt;
      }
      p.pts.geometry.attributes.position.needsUpdate = true;
      p.pts.material.opacity = Math.max(0, p.life / 0.7);
      if (p.life <= 0) {
        this.world.scene.remove(p.pts);
        p.pts.geometry.dispose();
        p.pts.material.dispose();
        this.particles.splice(i, 1);
      }
    }
  }

  _clearParticles() {
    for (const p of this.particles) {
      this.world.scene.remove(p.pts);
      p.pts.geometry.dispose();
      p.pts.material.dispose();
    }
    this.particles = [];
  }

  _saveWorld() {
    saveWorldState(this.world.sky.time, {
      x: this.player.pos.x, z: this.player.pos.z, yaw: this.player.yaw,
    });
  }

  // ---- Interação (E) ----
  _updateInteraction() {
    const p = this.player;
    let best = null, bestD = 3.2;
    for (const it of this.world.structures.interactables) {
      const d = Math.hypot(p.pos.x - it.x, p.pos.z - it.z);
      const dy = Math.abs((p.pos.y + p.eyeHeight) - it.y);
      if (d < bestD && dy < 2.5) { bestD = d; best = it; }
    }
    for (const m of this.intelItems) {
      const d = Math.hypot(p.pos.x - m.position.x, p.pos.z - m.position.z);
      if (d < bestD && Math.abs(p.pos.y - m.position.y) < 3) {
        best = { type: 'intel', label: 'Coletar inteligência', mesh: m };
        bestD = d;
      }
    }
    this.hud.prompt(best ? '[E] ' + best.label : null);
    if (best && this.input.interactPressed) {
      if (best.type === 'ladderUp' || best.type === 'ladderDown') {
        p.pos.y = best.topY;
        p.vel.set(0, 0, 0);
        this.audio.click();
      } else if (best.type === 'intel') {
        this.world.scene.remove(best.mesh);
        this.intelItems = this.intelItems.filter(m => m !== best.mesh);
        this.intelCollected++;
        this.missionMgr.onCollectIntel(this.intelCollected);
        this.audio.click();
        this.hud.killFeed('Relatório de inteligência recuperado');
      }
    }
  }

  // ---- Loop principal ----
  _loop() {
    requestAnimationFrame(this._loop);
    const dt = Math.min(this.clock.getDelta(), 0.05);

    if (this.state === 'menu' || this.state === 'results' || this.state === 'dead') {
      this.menuAngle += dt * 0.05;
      const cx = 120 + Math.cos(this.menuAngle) * 60;
      const cz = 60 + Math.sin(this.menuAngle) * 60;
      const cy = terrainHeight(cx, cz) + 22;
      this.camera.position.set(cx, cy, cz);
      this.camera.lookAt(120, terrainHeight(120, 60) + 6, 60);
      this.camera.fov = 60;
      this.camera.updateProjectionMatrix();
      this.world.update(dt, this.camera.position, this.audio);
    } else if (this.state === 'playing') {
      this._updatePlaying(dt);
    }

    this._updateParticles(dt);

    const fps = 1 / Math.max(dt, 1e-4);
    this.fpsEma = this.fpsEma * 0.95 + fps * 0.05;
    if (this.state === 'playing') {
      if (this.fpsEma < 26) {
        this.fpsLowTime += dt;
        if (this.fpsLowTime > 4 && this.resScale > 0.55) {
          this.resScale = Math.max(0.55, this.resScale * 0.85);
          this._resize();
          this.fpsLowTime = 0;
        }
      } else {
        this.fpsLowTime = 0;
      }
      this.hud.setFps(this.fpsEma);
    }

    this.renderer.render(this.scene, this.camera);
  }

  _updatePlaying(dt) {
    const input = this.input;

    if (!this.player.alive) { this._onPlayerDeath(); return; }
    if (input.pausePressed) { this.pause(); input.endFrame(); return; }
    if (input.inventoryPressed) {
      this.pause();
      this.menus._openLoadout();
      input.endFrame();
      return;
    }

    input.holdBreath = input.run && input.aim;
    if (input.crouchPressed) this.player.toggleCrouch();
    if (input.pronePressed) this.player.toggleProne();
    if (input.reloadPressed) this.weapons.reload();
    if (input.zoomPressed) this.weapons.toggleZoom();
    if (input.medPressed) {
      if (this.player.heal()) this.audio.click();
    }

    const stealth = (this.player.stance === STANCE.PRONE ? 0.45 : this.player.stance === STANCE.CROUCH ? 0.65 : 1)
      * (1 - this.player.camo * 0.12) * (this.player.running ? 1.5 : 1);
    this.playerEntity.alive = this.player.alive;

    this.player.update(dt, input);
    this.cameraCtl.update(dt, this.weapons.aiming, this.weapons.def ? this.weapons.def.sway : 1);
    this.weapons.update(dt, input, this.player, this.cameraCtl, this.world.weather.state);
    this.ballistics.update(dt);
    this.animalMgr.update(dt, this.player, stealth);
    this.npcMgr.update(dt, this.player, this.ballistics);
    this.missionMgr.update(dt, this.player, this.world.sky, this.world.weather, this.weapons.aiming, this.world);
    this.world.update(dt, this.player.pos, this.audio);
    this._updateInteraction();

    const w = this.world.weather.state;
    const inForest = fbm(this.player.pos.x * 0.01 + 77, this.player.pos.z * 0.01 + 31, 3) > 0.52;
    this.audio.setAmbient(w.wind, w.rain, this.world.sky.dayFactor, inForest);
    this.audio.updateAmbient(dt, this.world.sky.dayFactor);
    this.audio.setListener(this.camera);

    this.hud.update(dt, this.player, this.weapons, this.world.sky, this.world.weather, this.missionMgr, this.camera);
    this.hud.updateCompass(this.player.yaw, [], this.camera);

    if (this.weapons.mode === 'aim') this.cameraCtl.setFov(this.weapons.scopeFov);
    else if (this.weapons.mode === 'binoc') this.cameraCtl.setFov(20);
    else this.cameraCtl.setFov(75);

    this.autosaveTimer -= dt;
    if (this.autosaveTimer <= 0) {
      this.autosaveTimer = 12;
      this._saveWorld();
      saveNow();
    }

    input.endFrame();
  }
}

const game = new Game();
window.__game = game;
