// Áudio procedural — Web Audio API, sons sintetizados e espacialização 3D
import { clamp } from './utils.js';

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.sfxGain = null;
    this.ambGain = null;
    this.enabled = false;
    this.noiseBuf = null;
    this.windGain = null;
    this.rainGain = null;
    this.birdTimer = 2;
    this.listener = null;
    this.volume = 0.8;
  }

  init() {
    if (this.ctx) { this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.volume;
    this.master.connect(this.ctx.destination);
    this.sfxGain = this.ctx.createGain();
    this.sfxGain.connect(this.master);
    this.ambGain = this.ctx.createGain();
    this.ambGain.gain.value = 0.7;
    this.ambGain.connect(this.master);

    // Buffer de ruído reutilizável
    const len = this.ctx.sampleRate * 2;
    this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;

    this._startWind();
    this._startRain();
    this.enabled = true;
  }

  setVolume(v) {
    this.volume = v;
    if (this.master) this.master.gain.value = v;
  }

  setListener(camera) {
    if (!this.ctx) return;
    const l = this.ctx.listener;
    const p = camera.position;
    const f = camera.getWorldDirection(_fwd);
    if (l.positionX) {
      const t = this.ctx.currentTime;
      l.positionX.setTargetAtTime(p.x, t, 0.05);
      l.positionY.setTargetAtTime(p.y, t, 0.05);
      l.positionZ.setTargetAtTime(p.z, t, 0.05);
      l.forwardX.setTargetAtTime(f.x, t, 0.05);
      l.forwardY.setTargetAtTime(f.y, t, 0.05);
      l.forwardZ.setTargetAtTime(f.z, t, 0.05);
      l.upX.setTargetAtTime(0, t, 0.05);
      l.upY.setTargetAtTime(1, t, 0.05);
      l.upZ.setTargetAtTime(0, t, 0.05);
    } else if (l.setPosition) {
      l.setPosition(p.x, p.y, p.z);
      l.setOrientation(f.x, f.y, f.z, 0, 1, 0);
    }
  }

  _panner(pos) {
    const p = this.ctx.createPanner();
    p.panningModel = 'HRTF';
    p.distanceModel = 'exponential';
    p.refDistance = 6;
    p.rolloffFactor = 1.4;
    p.maxDistance = 800;
    if (p.positionX) {
      p.positionX.value = pos.x; p.positionY.value = pos.y; p.positionZ.value = pos.z;
    } else if (p.setPosition) {
      p.setPosition(pos.x, pos.y, pos.z);
    }
    return p;
  }

  _noiseSource(gainVal, filterType, freq, loop = false) {
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.loop = loop;
    const filt = this.ctx.createBiquadFilter();
    filt.type = filterType;
    filt.frequency.value = freq;
    const g = this.ctx.createGain();
    g.gain.value = gainVal;
    src.connect(filt).connect(g);
    return { src, g, filt };
  }

  _startWind() {
    const { src, g } = this._noiseSource(0.0, 'lowpass', 400, true);
    src.start();
    this.windGain = g;
    g.connect(this.ambGain);
  }

  _startRain() {
    const { src, g } = this._noiseSource(0.0, 'highpass', 1400, true);
    src.start();
    this.rainGain = g;
    g.connect(this.ambGain);
  }

  setAmbient(windSpeed, rainAmount, dayFactor, inForest) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.windGain.gain.setTargetAtTime(clamp(windSpeed / 14, 0, 1) * 0.24, t, 0.5);
    this.rainGain.gain.setTargetAtTime(clamp(rainAmount, 0, 2) * 0.16, t, 0.8);
    this.birdVolume = dayFactor * (inForest ? 1 : 0.6) * (rainAmount > 0.3 ? 0.15 : 1);
  }

  updateAmbient(dt, dayFactor) {
    if (!this.ctx || !this.enabled) return;
    this.birdTimer -= dt;
    if (this.birdTimer <= 0) {
      this.birdTimer = 1.5 + Math.random() * 5;
      if ((this.birdVolume || 0) > 0.1 && Math.random() < 0.75) this._birdChirp();
    }
  }

  _birdChirp() {
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = 'sine';
    const base = 2200 + Math.random() * 1800;
    o.frequency.setValueAtTime(base, t);
    o.frequency.exponentialRampToValueAtTime(base * (1.3 + Math.random() * 0.6), t + 0.08);
    o.frequency.exponentialRampToValueAtTime(base * 0.9, t + 0.18);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.05 * (this.birdVolume || 0.5), t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.25);
    o.connect(g).connect(this.ambGain);
    o.start(t); o.stop(t + 0.3);
  }

  _burst(pos, { dur = 0.3, vol = 0.5, type = 'lowpass', freq = 800, endFreq = null, spatial = true }) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const { src, g, filt } = this._noiseSource(vol, type, freq);
    if (endFreq) filt.frequency.exponentialRampToValueAtTime(endFreq, t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    if (spatial && pos) {
      const p = this._panner(pos);
      g.connect(p).connect(this.sfxGain);
    } else {
      g.connect(this.sfxGain);
    }
    src.start(t); src.stop(t + dur + 0.05);
  }

  _tone(pos, { f0 = 440, f1 = null, dur = 0.2, vol = 0.2, type = 'sine', spatial = true }) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    if (f1) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    if (spatial && pos) {
      const p = this._panner(pos);
      g.connect(p); p.connect(this.sfxGain);
    } else {
      g.connect(this.sfxGain);
    }
    o.start(t); o.stop(t + dur + 0.05);
  }

  shot(def) {
    if (!this.ctx) return;
    const big = def.id === 'longshadow';
    this._burst(null, { dur: big ? 0.5 : 0.35, vol: big ? 0.9 : 0.7, freq: big ? 500 : 900, endFreq: 120 });
    this._tone(null, { f0: 90, f1: 40, dur: 0.25, vol: 0.5, type: 'triangle', spatial: false });
    // eco distante
    setTimeout(() => this._burst(null, { dur: 1.2, vol: 0.12, freq: 500, endFreq: 150 }), 180);
  }

  dryFire() { this._burst(null, { dur: 0.06, vol: 0.2, freq: 2500 }); }
  boltClose() { this._burst(null, { dur: 0.09, vol: 0.25, freq: 3000 }); this._tone(null, { f0: 900, f1: 500, dur: 0.07, vol: 0.12, type: 'square', spatial: false }); }
  reload() {
    this._burst(null, { dur: 0.1, vol: 0.25, freq: 2200 });
    setTimeout(() => this._burst(null, { dur: 0.12, vol: 0.3, freq: 1600 }), 500);
    setTimeout(() => this.boltClose(), 1200);
  }
  click() { this._tone(null, { f0: 1400, dur: 0.04, vol: 0.08, type: 'square', spatial: false }); }
  scopedIn() { this._burst(null, { dur: 0.12, vol: 0.1, freq: 1200 }); }
  scopedOut() { this._burst(null, { dur: 0.1, vol: 0.08, freq: 900 }); }

  footstep(running) {
    this._burst(null, { dur: 0.09, vol: running ? 0.14 : 0.08, freq: 500 + Math.random() * 300 });
  }

  impact(point, kind) {
    this._burst(point, { dur: 0.18, vol: 0.4, freq: kind === 'terrain' ? 400 : 1800, endFreq: 150 });
  }

  hitmarker() { this._tone(null, { f0: 1800, f1: 2400, dur: 0.07, vol: 0.15, type: 'sine', spatial: false }); }

  animalCall(kind, pos, alarmed) {
    const table = {
      deer: [420, 300], elk: [300, 210], boar: [140, 90], wolf: [520, 260],
      fox: [900, 1400], rabbit: [1200, 1600], bear: [120, 70], bird: [2600, 3200],
    };
    const [f0, f1] = table[kind] || [500, 400];
    const vol = alarmed ? 0.3 : 0.14;
    if (kind === 'wolf') this._tone(pos, { f0, f1, dur: alarmed ? 0.9 : 1.6, vol, type: 'sine' });
    else if (kind === 'bird') this._tone(pos, { f0, f1, dur: 0.15, vol: vol * 0.6 });
    else this._tone(pos, { f0, f1, dur: alarmed ? 0.35 : 0.6, vol, type: 'triangle' });
  }

  animalDeath(kind, pos) {
    this._tone(pos, { f0: 300, f1: 90, dur: 0.7, vol: 0.3, type: 'sawtooth' });
  }

  npcShot(pos, dist) {
    const vol = clamp(1 - dist / 300, 0.1, 1) * 0.5;
    this._burst(pos, { dur: 0.25, vol, freq: 800, endFreq: 140 });
  }

  npcShout(pos) {
    this._tone(pos, { f0: 260, f1: 190, dur: 0.4, vol: 0.25, type: 'sawtooth' });
  }

  npcDeath(pos) {
    this._tone(pos, { f0: 200, f1: 70, dur: 0.8, vol: 0.3, type: 'sawtooth' });
  }

  thunder() {
    this._burst(null, { dur: 2.2, vol: 0.6, freq: 300, endFreq: 60 });
  }

  hurt() { this._tone(null, { f0: 160, f1: 80, dur: 0.25, vol: 0.3, type: 'sawtooth', spatial: false }); }

  heartbeat() {
    this._tone(null, { f0: 55, f1: 40, dur: 0.14, vol: 0.4, type: 'sine', spatial: false });
  }

  missionComplete() {
    const notes = [523, 659, 784, 1047];
    notes.forEach((f, i) => setTimeout(() => this._tone(null, { f0: f, dur: 0.3, vol: 0.2, spatial: false }), i * 140));
  }

  missionFailed() {
    this._tone(null, { f0: 300, f1: 150, dur: 0.7, vol: 0.25, type: 'sawtooth', spatial: false });
  }

  uiOpen() { this._tone(null, { f0: 700, f1: 900, dur: 0.08, vol: 0.1, spatial: false }); }
}

const _fwd = { x: 0, y: 0, z: -1 };
