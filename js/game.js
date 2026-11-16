import * as THREE from './vendor/three.module.min.js';
import { SaveManager } from './save.js';
import { AudioManager } from './audio.js';
import { Input } from './input.js';
import { HUD } from './hud.js';
import { UI } from './ui.js';
import { Garage } from './garage.js';
import { Race } from './race.js';
import { buildCarMesh, getSpec } from './cars.js';
import { QUALITY, QUALITY_LABELS, PAINTS } from './config.js';
import { CAMERA_MODES } from './camera.js';
import { isTouchDevice } from './utils.js';

export class Game {
  constructor() {
    this.canvas = document.getElementById('game-canvas');
    const settings = this.loadSettings();
    this.quality = QUALITY[settings.quality] || QUALITY.medium;
    this.qualityKey = settings.quality === 'high' ? 'ultra' : (settings.quality || 'medium');

    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: this.quality.antialias, powerPreference: 'high-performance' });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.shadowMap.enabled = this.quality.shadows;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.applyPixelRatio();
    this.renderer.setSize(window.innerWidth, window.innerHeight);

    this.aspect = window.innerWidth / window.innerHeight;
    window.addEventListener('resize', () => this.onResize());

    this.save = new SaveManager('compacto');
    const s = this.save.data.settings;
    this.audio = new AudioManager();
    this.audio.soundOn = s.sound;
    this.audio.musicOn = s.music;
    this.input = new Input();
    this.input.bindTouch();
    this.hud = new HUD();
    this.ui = new UI(this);
    this.garage = new Garage(this);

    this.state = 'menu';
    this.race = null;
    this.paused = false;
    this.lastResults = null;
    this.lastRaceConfig = null;

    this.input.onPause = () => {
      if (this.state === 'race') { this.paused ? this.resumeRace() : this.pauseRace(); }
    };
    this.input.onCamera = () => {
      if (this.state === 'race' && this.race) {
        const m = this.race.rig.cycle();
        this.save.data.settings.camera = m;
        this.save.save();
        this.ui.toast('Câmera: ' + CAMERA_MODES[m], 1400);
      }
    };
    this.input.onReset = () => {
      if (this.state === 'race' && this.race && this.race.state === 'racing') {
        this.race.player.physics.respawn();
        this.ui.toast('Carro reposicionado', 1200);
      }
    };

    this.buildMenuScene();
    this.ui.refreshCoins();
    this.ui.show('screen-menu');

    this.clock = new THREE.Clock();
    this.fpsAccum = 0;
    this.fpsFrames = 0;
    this.fps = 60;
    this.lowFpsTime = 0;

    const unlock = () => {
      this.audio.init();
      this.audio.setSound(this.save.data.settings.sound);
      this.audio.setMusic(this.save.data.settings.music);
      if (this.state === 'menu' || this.state === 'garage') this.audio.startMusic();
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);

    this.checkOrientation();
    this.renderer.setAnimationLoop(() => this.loop());
  }

  loadSettings() {
    try {
      const raw = localStorage.getItem('extremeRacing3D.save.v1');
      if (raw) {
        const settings = JSON.parse(raw).settings || {};
        if (settings.quality === 'high') settings.quality = 'ultra';
        return settings;
      }
    } catch (e) { /* ignore */ }
    return {};
  }

  applyPixelRatio() {
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, this.quality.pixelRatioCap));
  }

  onResize() {
    this.aspect = window.innerWidth / window.innerHeight;
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    if (this.menuCam) { this.menuCam.aspect = this.aspect; this.menuCam.updateProjectionMatrix(); }
    if (this.garage) { this.garage.camera.aspect = this.aspect; this.garage.camera.updateProjectionMatrix(); }
    if (this.race) { this.race.camera.aspect = this.aspect; this.race.camera.updateProjectionMatrix(); }
    this.checkOrientation();
  }

  checkOrientation() {
    const overlay = document.getElementById('rotate-overlay');
    const portrait = window.innerHeight > window.innerWidth;
    overlay.classList.toggle('forced', !!(this.state === 'race' && portrait && isTouchDevice()));
  }

  buildMenuScene() {
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x07090d);
    scene.fog = new THREE.Fog(0x07090d, 20, 70);
    const floor = new THREE.Mesh(
      new THREE.CircleGeometry(40, 48),
      new THREE.MeshStandardMaterial({ color: 0x10141b, metalness: 0.8, roughness: 0.25, envMapIntensity: 1.1 })
    );
    floor.rotation.x = -Math.PI / 2;
    scene.add(floor);
    scene.add(new THREE.AmbientLight(0x404860, 0.8));
    const key = new THREE.SpotLight(0xffffff, 1200, 50, 0.5, 0.5, 1.5);
    key.position.set(6, 10, 6);
    scene.add(key, key.target);
    const back = new THREE.SpotLight(0xff6a00, 700, 40, 0.7, 0.6, 1.5);
    back.position.set(-7, 6, -7);
    scene.add(back, back.target);

    const pmrem = new THREE.PMREMGenerator(this.renderer);
    const c = document.createElement('canvas');
    c.width = 16; c.height = 64;
    const x = c.getContext('2d');
    const g = x.createLinearGradient(0, 0, 0, 64);
    g.addColorStop(0, '#4a5a7a');
    g.addColorStop(0.45, '#181f2c');
    g.addColorStop(0.52, '#0a0d13');
    g.addColorStop(1, '#05070a');
    x.fillStyle = g;
    x.fillRect(0, 0, 16, 64);
    const tex = new THREE.CanvasTexture(c);
    tex.mapping = THREE.EquirectangularReflectionMapping;
    const rt = pmrem.fromEquirectangular(tex);
    scene.environment = rt.texture;
    tex.dispose();
    pmrem.dispose();

    const spec = getSpec('vento');
    this.menuCar = buildCarMesh(spec, { color: PAINTS[1], wheel: 0 });
    this.menuCar.position.y = 0.02;
    scene.add(this.menuCar);

    this.menuCam = new THREE.PerspectiveCamera(45, this.aspect, 0.1, 200);
    this.menuScene = scene;
    this.menuAngle = 0;
  }

  setQuality(key) {
    this.qualityKey = key;
    this.save.data.settings.quality = key;
    this.save.save();
    this.quality = QUALITY[key];
    this.renderer.shadowMap.enabled = this.quality.shadows;
    this.applyPixelRatio();
    this.ui.toast(`Qualidade ${QUALITY_LABELS[key] || key} aplicada.`, 2000);
  }

  openGarage() {
    this.state = 'garage';
    this.garage.open();
    this.ui.show('screen-garage');
    this.ui.refreshCoins();
  }

  startRace(config) {
    if (this.race) { this.race.dispose(); this.race = null; }
    this.lastRaceConfig = config;
    this.paused = false;
    this.audio.init();
    this.audio.stopMusic();
    this.race = new Race(this, config);
    this.state = 'race';
    this.ui.hideAll();
    this.input.setEnabled(true);
    this.updateTouchVisibility();
    this.checkOrientation();
  }

  updateTouchVisibility() {
    const tc = document.getElementById('touch-controls');
    if (!tc) return;
    const s = this.save.data.settings.touch;
    const active = this.state === 'race' && (s === 'on' || (s === 'auto' && isTouchDevice()));
    tc.classList.toggle('hidden', !active);
  }

  pauseRace() {
    if (this.state !== 'race' || this.paused) return;
    this.paused = true;
    this.input.setEnabled(false);
    this.race.pause();
    this.ui.show('screen-pause');
  }

  resumeRace() {
    if (this.state !== 'race' || !this.paused) return;
    this.paused = false;
    this.input.setEnabled(true);
    this.ui.hideAll();
    this.audio.init();
  }

  restartRace() {
    if (!this.lastRaceConfig) return;
    this.startRace({ ...this.lastRaceConfig });
  }

  quitRace() {
    if (this.race) { this.race.dispose(); this.race = null; }
    this.paused = false;
    this.state = 'menu';
    this.input.setEnabled(false);
    this.ui.show('screen-menu');
    this.ui.refreshCoins();
    this.audio.setSkid(0); this.audio.setWind(0); this.audio.setNitro(false);
    if (this.save.data.settings.music) this.audio.startMusic();
    this.checkOrientation();
  }

  onRaceFinished(results) {
    this.lastResults = results;
    this.state = 'results';
    this.input.setEnabled(false);
    this.updateTouchVisibility();
    this.ui.showResults(results);
    this.ui.refreshCoins();
  }

  quitToMenu() {
    this.quitRace();
  }

  monitorPerformance(dt) {
    this.fpsAccum += dt;
    this.fpsFrames++;
    if (this.fpsAccum >= 1) {
      this.fps = this.fpsFrames / this.fpsAccum;
      this.fpsAccum = 0;
      this.fpsFrames = 0;
      if (this.state === 'race' && !this.paused && this.save.data.settings.autoQuality) {
        if (this.fps < 28) {
          this.lowFpsTime += 1;
          if (this.lowFpsTime >= 4 && this.qualityKey !== 'low') {
            const next = this.qualityKey === 'ultra' || this.qualityKey === 'high' ? 'medium' : 'low';
            this.setQuality(next);
            this.lowFpsTime = 0;
            this.ui.toast('Qualidade ajustada automaticamente para manter o desempenho.', 3000);
          }
        } else {
          this.lowFpsTime = 0;
        }
      }
    }
  }

  loop() {
    const dt = Math.min(this.clock.getDelta(), 0.05);
    this.monitorPerformance(dt);

    if (this.state === 'race' && this.race) {
      if (!this.paused) this.race.update(dt);
      this.renderer.render(this.race.scene, this.race.camera);
    } else if (this.state === 'garage') {
      this.garage.update(dt);
      this.renderer.render(this.garage.scene, this.garage.camera);
    } else if (this.state === 'results') {
      if (this.race) {
        this.race.particles.update(dt);
        this.renderer.render(this.race.scene, this.race.camera);
      }
    } else {
      this.menuAngle += dt * 0.22;
      const r = 8.2;
      this.menuCam.position.set(Math.sin(this.menuAngle) * r, 2.4 + Math.sin(this.menuAngle * 0.6) * 0.6, Math.cos(this.menuAngle) * r);
      this.menuCam.lookAt(0, 0.6, 0);
      this.renderer.render(this.menuScene, this.menuCam);
    }
  }
}
