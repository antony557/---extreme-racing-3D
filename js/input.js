import { clamp } from './utils.js';

export class Input {
  constructor() {
    this.state = { throttle: 0, brake: 0, steer: 0, handbrake: false, nitro: false };
    this.keys = {};
    this.touch = { throttle: 0, brake: 0, steerL: 0, steerR: 0, handbrake: false, nitro: false };
    this.onPause = null;
    this.onCamera = null;
    this.onReset = null;
    this.enabled = true;
    window.addEventListener('keydown', (e) => this.keyDown(e));
    window.addEventListener('keyup', (e) => this.keyUp(e));
    window.addEventListener('blur', () => { this.keys = {}; });
  }
  keyDown(e) {
    const k = e.key.toLowerCase();
    if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(k)) e.preventDefault();
    if (!this.enabled) { this.keys[k] = true; return; }
    if (!this.keys[k]) {
      if (k === 'escape' && this.onPause) this.onPause();
      if (k === 'c' && this.onCamera) this.onCamera();
      if (k === 'r' && this.onReset) this.onReset();
    }
    this.keys[k] = true;
  }
  keyUp(e) { this.keys[e.key.toLowerCase()] = false; }
  bindTouch() {
    const bind = (id, on, off) => {
      const el = document.getElementById(id);
      if (!el) return;
      const down = (e) => { e.preventDefault(); el.classList.add('pressed'); if (this.enabled) on(); };
      const up = (e) => { e.preventDefault(); el.classList.remove('pressed'); off(); };
      el.addEventListener('pointerdown', down);
      el.addEventListener('pointerup', up);
      el.addEventListener('pointercancel', up);
      el.addEventListener('pointerleave', up);
      el.addEventListener('contextmenu', (e) => e.preventDefault());
    };
    bind('tc-throttle', () => this.touch.throttle = 1, () => this.touch.throttle = 0);
    bind('tc-brake', () => this.touch.brake = 1, () => this.touch.brake = 0);
    bind('tc-left-btn', () => this.touch.steerL = 1, () => this.touch.steerL = 0);
    bind('tc-right-btn', () => this.touch.steerR = 1, () => this.touch.steerR = 0);
    bind('tc-handbrake', () => this.touch.handbrake = true, () => this.touch.handbrake = false);
    bind('tc-nitro', () => this.touch.nitro = true, () => this.touch.nitro = false);
    bind('tc-reset', () => { if (this.onReset) this.onReset(); }, () => {});
    bind('tc-camera', () => { if (this.onCamera) this.onCamera(); }, () => {});
  }
  sample() {
    const k = this.keys, t = this.touch;
    const kThrottle = (k['w'] || k['arrowup']) ? 1 : 0;
    const kBrake = (k['s'] || k['arrowdown']) ? 1 : 0;
    const kLeft = (k['a'] || k['arrowleft']) ? 1 : 0;
    const kRight = (k['d'] || k['arrowright']) ? 1 : 0;
    if (!this.enabled) return { throttle: 0, brake: 0, steer: 0, handbrake: false, nitro: false };
    return {
      throttle: Math.min(1, kThrottle + t.throttle),
      brake: Math.min(1, kBrake + t.brake),
      steer: clamp(kLeft + t.steerL - kRight - t.steerR, -1, 1),
      handbrake: !!k[' '] || t.handbrake,
      nitro: (!!k['shift'] || t.nitro),
    };
  }
  setEnabled(v) {
    this.enabled = v;
    if (!v) { this.touch = { throttle: 0, brake: 0, steerL: 0, steerR: 0, handbrake: false, nitro: false }; }
  }
}
