export class AudioManager {
  constructor() {
    this.ctx = null;
    this.soundOn = true;
    this.musicOn = true;
    this.musicTimer = null;
    this.musicStep = 0;
    this.musicNextTime = 0;
  }
  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    const ctx = this.ctx;
    this.master = ctx.createGain();
    this.master.gain.value = 0.8;
    this.master.connect(ctx.destination);

    this.sfxBus = ctx.createGain();
    this.sfxBus.gain.value = this.soundOn ? 1 : 0;
    this.sfxBus.connect(this.master);

    this.musicBus = ctx.createGain();
    this.musicBus.gain.value = this.musicOn ? 0.32 : 0;
    this.musicBus.connect(this.master);

    const noiseLen = ctx.sampleRate * 2;
    this.noiseBuffer = ctx.createBuffer(1, noiseLen, ctx.sampleRate);
    const d = this.noiseBuffer.getChannelData(0);
    for (let i = 0; i < noiseLen; i++) d[i] = Math.random() * 2 - 1;

    this.engOsc1 = ctx.createOscillator();
    this.engOsc1.type = 'sawtooth';
    this.engOsc2 = ctx.createOscillator();
    this.engOsc2.type = 'square';
    this.engFilter = ctx.createBiquadFilter();
    this.engFilter.type = 'lowpass';
    this.engFilter.frequency.value = 400;
    this.engGain = ctx.createGain();
    this.engGain.gain.value = 0;
    const engMix = ctx.createGain();
    engMix.gain.value = 0.5;
    this.engOsc1.connect(engMix);
    this.engOsc2.connect(engMix);
    engMix.connect(this.engFilter);
    this.engFilter.connect(this.engGain);
    this.engGain.connect(this.sfxBus);
    this.engOsc1.start();
    this.engOsc2.start();

    this.exhaust = ctx.createBufferSource();
    this.exhaust.buffer = this.noiseBuffer;
    this.exhaust.loop = true;
    this.exFilter = ctx.createBiquadFilter();
    this.exFilter.type = 'lowpass';
    this.exFilter.frequency.value = 220;
    this.exGain = ctx.createGain();
    this.exGain.gain.value = 0;
    this.exhaust.connect(this.exFilter);
    this.exFilter.connect(this.exGain);
    this.exGain.connect(this.sfxBus);
    this.exhaust.start();

    this.skidSrc = ctx.createBufferSource();
    this.skidSrc.buffer = this.noiseBuffer;
    this.skidSrc.loop = true;
    this.skidFilter = ctx.createBiquadFilter();
    this.skidFilter.type = 'bandpass';
    this.skidFilter.frequency.value = 950;
    this.skidFilter.Q.value = 1.4;
    this.skidGain = ctx.createGain();
    this.skidGain.gain.value = 0;
    this.skidSrc.connect(this.skidFilter);
    this.skidFilter.connect(this.skidGain);
    this.skidGain.connect(this.sfxBus);
    this.skidSrc.start();

    this.windSrc = ctx.createBufferSource();
    this.windSrc.buffer = this.noiseBuffer;
    this.windSrc.loop = true;
    this.windFilter = ctx.createBiquadFilter();
    this.windFilter.type = 'lowpass';
    this.windFilter.frequency.value = 500;
    this.windGain = ctx.createGain();
    this.windGain.gain.value = 0;
    this.windSrc.connect(this.windFilter);
    this.windFilter.connect(this.windGain);
    this.windGain.connect(this.sfxBus);
    this.windSrc.start();

    this.nitroSrc = ctx.createBufferSource();
    this.nitroSrc.buffer = this.noiseBuffer;
    this.nitroSrc.loop = true;
    this.nitroFilter = ctx.createBiquadFilter();
    this.nitroFilter.type = 'highpass';
    this.nitroFilter.frequency.value = 1800;
    this.nitroGain = ctx.createGain();
    this.nitroGain.gain.value = 0;
    this.nitroSrc.connect(this.nitroFilter);
    this.nitroFilter.connect(this.nitroGain);
    this.nitroGain.connect(this.sfxBus);
    this.nitroSrc.start();
  }
  setSound(on) {
    this.soundOn = on;
    if (this.sfxBus) this.sfxBus.gain.value = on ? 1 : 0;
  }
  setMusic(on) {
    this.musicOn = on;
    if (this.musicBus) this.musicBus.gain.value = on ? 0.32 : 0;
  }
  setEngine(rpm01, throttle, moving) {
    if (!this.ctx || this.ctx.state !== 'running') return;
    const t = this.ctx.currentTime;
    const freq = 42 + rpm01 * 175;
    this.engOsc1.frequency.setTargetAtTime(freq, t, 0.03);
    this.engOsc2.frequency.setTargetAtTime(freq * 0.501, t, 0.03);
    this.engFilter.frequency.setTargetAtTime(280 + rpm01 * 2600, t, 0.05);
    const vol = moving ? 0.035 + rpm01 * 0.075 + throttle * 0.05 : 0.03 + rpm01 * 0.03;
    this.engGain.gain.setTargetAtTime(vol, t, 0.05);
    this.exGain.gain.setTargetAtTime(0.02 + rpm01 * 0.06 + throttle * 0.05, t, 0.06);
  }
  setSkid(level) {
    if (!this.ctx) return;
    this.skidGain.gain.setTargetAtTime(level * 0.16, this.ctx.currentTime, 0.04);
  }
  setWind(speed01) {
    if (!this.ctx) return;
    this.windGain.gain.setTargetAtTime(speed01 * 0.09, this.ctx.currentTime, 0.15);
    this.windFilter.frequency.setTargetAtTime(300 + speed01 * 900, this.ctx.currentTime, 0.2);
  }
  setNitro(active) {
    if (!this.ctx) return;
    this.nitroGain.gain.setTargetAtTime(active ? 0.14 : 0, this.ctx.currentTime, 0.08);
  }
  gearShift() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.engGain.gain.cancelScheduledValues(t);
    this.engGain.gain.setTargetAtTime(0.01, t, 0.02);
    this.engGain.gain.setTargetAtTime(0.09, t + 0.09, 0.04);
  }
  thump(intensity) {
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const vol = Math.min(0.5, 0.08 + intensity * 0.05);
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(120, t);
    osc.frequency.exponentialRampToValueAtTime(38, t + 0.14);
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
    osc.connect(g); g.connect(this.sfxBus);
    osc.start(t); osc.stop(t + 0.25);
    const n = ctx.createBufferSource();
    n.buffer = this.noiseBuffer;
    const nf = ctx.createBiquadFilter();
    nf.type = 'lowpass'; nf.frequency.value = 900;
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(vol * 0.8, t);
    ng.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
    n.connect(nf); nf.connect(ng); ng.connect(this.sfxBus);
    n.start(t); n.stop(t + 0.18);
  }
  beep(freq, dur, vol) {
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol || 0.12, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(g); g.connect(this.sfxBus);
    osc.start(t); osc.stop(t + dur + 0.02);
  }
  chime() { this.beep(880, 0.18, 0.1); setTimeout(() => this.beep(1320, 0.22, 0.1), 110); }
  coin() { this.beep(1200, 0.08, 0.08); setTimeout(() => this.beep(1600, 0.12, 0.08), 70); }
  click() { this.beep(600, 0.04, 0.05); }
  stopEngine() {
    if (!this.ctx) return;
    this.engGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.1);
    this.exGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.1);
    this.setSkid(0); this.setWind(0); this.setNitro(false);
  }
  startMusic() {
    if (!this.ctx || this.musicTimer) return;
    this.musicStep = 0;
    this.musicNextTime = this.ctx.currentTime + 0.1;
    this.musicTimer = setInterval(() => this.scheduleMusic(), 90);
  }
  stopMusic() {
    if (this.musicTimer) { clearInterval(this.musicTimer); this.musicTimer = null; }
  }
  scheduleMusic() {
    if (!this.ctx) return;
    const bpm = 112, stepDur = 60 / bpm / 2;
    while (this.musicNextTime < this.ctx.currentTime + 0.25) {
      this.playMusicStep(this.musicStep, this.musicNextTime, stepDur);
      this.musicStep = (this.musicStep + 1) % 64;
      this.musicNextTime += stepDur;
    }
  }
  playMusicStep(step, time, dur) {
    const ctx = this.ctx;
    const bassLine = [0, 0, 7, 0, 3, 0, 5, 7];
    const roots = [45, 45, 41, 43];
    const bar = Math.floor(step / 16) % 4;
    const root = roots[bar];
    if (step % 2 === 0) {
      const semi = bassLine[(step / 2) % 8];
      this.note(37 + root - 45 + semi, time, dur * 0.9, 0.16, 'triangle');
    }
    if (step % 4 === 0) this.drum(time, 0.24);
    if (step % 8 === 4) this.hat(time, 0.1);
    if (step % 2 === 1) this.hat(time, 0.045);
    const arp = [12, 15, 19, 22, 19, 15, 24, 19];
    if (step >= 32) {
      const n = arp[(step - 32) % 8];
      this.note(root + n, time, dur * 0.8, 0.055, 'square');
    }
  }
  note(semiFromA2, time, dur, vol, type) {
    const ctx = this.ctx;
    const freq = 110 * Math.pow(2, semiFromA2 / 12);
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, time);
    g.gain.exponentialRampToValueAtTime(0.001, time + dur);
    osc.connect(g); g.connect(this.musicBus);
    osc.start(time); osc.stop(time + dur + 0.02);
  }
  drum(time, vol) {
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(150, time);
    osc.frequency.exponentialRampToValueAtTime(45, time + 0.1);
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, time);
    g.gain.exponentialRampToValueAtTime(0.001, time + 0.14);
    osc.connect(g); g.connect(this.musicBus);
    osc.start(time); osc.stop(time + 0.16);
  }
  hat(time, vol) {
    const ctx = this.ctx;
    const n = ctx.createBufferSource();
    n.buffer = this.noiseBuffer;
    n.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = 'highpass'; f.frequency.value = 7000;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, time);
    g.gain.exponentialRampToValueAtTime(0.001, time + 0.05);
    n.connect(f); f.connect(g); g.connect(this.musicBus);
    n.start(time); n.stop(time + 0.07);
  }
}
