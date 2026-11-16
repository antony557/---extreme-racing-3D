// Entrada unificada — teclado/mouse (PC) e toque (Android) simultâneos
import { IS_MOBILE } from './config.js';
import { clamp } from './utils.js';
import { JOYSTICK } from '../ui/mobileLayout.js';

export class Input {
  constructor(canvas, opts = {}) {
    this.canvas = canvas;
    this.sensitivity = opts.sensitivity || 1;
    this.touchSensitivity = opts.touchSensitivity || 1;
    this.aimToggleMode = IS_MOBILE;

    this.move = { x: 0, y: 0 };
    this._lookX = 0; this._lookY = 0;
    this.aim = false;
    this.run = false;
    this.holdBreath = false;

    // Pressed (borda) — limpos em endFrame()
    this.firePressed = false;
    this.jumpPressed = false;
    this.binocPressed = false;
    this.zoomPressed = false;
    this.interactPressed = false;
    this.reloadPressed = false;
    this.crouchPressed = false;
    this.pronePressed = false;
    this.medPressed = false;
    this.inventoryPressed = false;
    this.pausePressed = false;

    this._keys = new Set();
    this._fireHeld = false;
    this._pointerLocked = false;
    this._touchLook = null;
    this._joyPointer = null;
    this._joyOrigin = { x: 0, y: 0 };
    this._enabled = true;

    this._bind();
  }

  _bind() {
    const c = this.canvas;

    document.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      this._keys.add(e.code);
      this._keyAction(e.code, true);
      if (['Tab', 'Space'].includes(e.code)) e.preventDefault();
    });
    document.addEventListener('keyup', (e) => this._keys.delete(e.code));

    c.addEventListener('mousedown', (e) => {
      if (this._pointerLocked) {
        if (e.button === 0) { this._fireHeld = true; this.firePressed = true; }
        if (e.button === 2) this.aim = true;
      }
    });
    document.addEventListener('mouseup', (e) => {
      if (e.button === 0) this._fireHeld = false;
      if (e.button === 2) this.aim = false;
    });
    c.addEventListener('contextmenu', (e) => e.preventDefault());
    document.addEventListener('pointerlockchange', () => {
      this._pointerLocked = document.pointerLockElement === c;
    });
    document.addEventListener('mousemove', (e) => {
      if (!this._enabled) return;
      if (this._pointerLocked) {
        this._lookX += e.movementX * 0.0022;
        this._lookY += e.movementY * 0.0022;
      }
    });
    c.addEventListener('wheel', (e) => {
      if (this.aim || this._binocMode) {
        this.zoomPressed = true;
        e.preventDefault();
      }
    }, { passive: false });

    // ---- Toque ----
    c.addEventListener('touchstart', (e) => this._touch(e, 'start'), { passive: false });
    c.addEventListener('touchmove', (e) => this._touch(e, 'move'), { passive: false });
    c.addEventListener('touchend', (e) => this._touch(e, 'end'), { passive: false });
    c.addEventListener('touchcancel', (e) => this._touch(e, 'end'), { passive: false });

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this._resetTouches();
    });

    this._bindButtons();
  }

  _resetTouches() {
    this._touchLook = null;
    this._joyPointer = null;
    this.move.x = 0; this.move.y = 0;
    this._fireHeld = false;
  }

  _bindButtons() {
    const bind = (id, down, up) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.addEventListener('pointerdown', (e) => {
        e.preventDefault(); e.stopPropagation();
        el.classList.add('active');
        if (down) down();
      });
      const end = (e) => {
        e && e.preventDefault(); e && e.stopPropagation();
        el.classList.remove('active');
        if (up) up();
      };
      el.addEventListener('pointerup', end);
      el.addEventListener('pointercancel', end);
      el.addEventListener('pointerleave', end);
    };

    bind('btn-fire', () => { this._fireHeld = true; this.firePressed = true; }, () => { this._fireHeld = false; });
    bind('btn-aim', () => { this.aim = this.aimToggleMode ? !this.aim : true; }, () => { if (!this.aimToggleMode) this.aim = false; });
    bind('btn-reload', () => { this.reloadPressed = true; });
    bind('btn-jump', () => { this.jumpPressed = true; });
    bind('btn-run', () => { this.run = true; }, () => { this.run = false; });
    bind('btn-crouch', () => { this.crouchPressed = true; });
    bind('btn-prone', () => { this.pronePressed = true; });
    bind('btn-interact', () => { this.interactPressed = true; });
    bind('btn-binoc', () => { this.binocPressed = true; });
    bind('btn-inventory', () => { this.inventoryPressed = true; });
    bind('btn-pause', () => { this.pausePressed = true; });
    bind('btn-med', () => { this.medPressed = true; });
    bind('btn-zoom', () => { this.zoomPressed = true; });
  }

  _keyAction(code, down) {
    if (!this._enabled) return;
    switch (code) {
      case 'KeyR': if (down) this.reloadPressed = true; break;
      case 'Space': if (down) this.jumpPressed = true; break;
      case 'KeyC': if (down) this.crouchPressed = true; break;
      case 'KeyZ': if (down) this.pronePressed = true; break;
      case 'KeyB': if (down) this.binocPressed = true; break;
      case 'KeyE': if (down) this.interactPressed = true; break;
      case 'KeyH': if (down) this.medPressed = true; break;
      case 'Tab': if (down) this.inventoryPressed = true; break;
      case 'Escape': if (down) this.pausePressed = true; break;
      case 'ShiftLeft': case 'ShiftRight': this.run = down; if (down) this.holdBreath = this.aim; if (!down) this.holdBreath = false; break;
    }
  }

  _touch(e, phase) {
    e.preventDefault();
    const w = window.innerWidth, h = window.innerHeight;
    for (const t of e.changedTouches) {
      // Zona do analógico: exclusivamente canto inferior esquerdo.
      // Todo o resto da tela (incluindo o lado direito inteiro) controla a câmera.
      const inJoyZone = t.clientX < w * JOYSTICK.zoneX && t.clientY > h * JOYSTICK.zoneY;
      if (phase === 'start') {
        if (!this._enabled) continue;
        if (inJoyZone && this._joyPointer === null) {
          this._joyPointer = t.identifier;
          this._joyOrigin = { x: t.clientX, y: t.clientY };
        } else if (!inJoyZone && this._touchLook === null) {
          this._touchLook = { id: t.identifier, x: t.clientX, y: t.clientY };
        }
      } else if (phase === 'move') {
        if (!this._enabled) continue;
        if (t.identifier === this._joyPointer) {
          const dx = t.clientX - this._joyOrigin.x, dy = t.clientY - this._joyOrigin.y;
          const max = 58;
          const len = Math.hypot(dx, dy);
          const f = len > max ? max / len : 1;
          this.move.x = clamp((dx * f) / max, -1, 1);
          this.move.y = clamp((-dy * f) / max, -1, 1);
        } else if (this._touchLook && t.identifier === this._touchLook.id) {
          this._lookX += (t.clientX - this._touchLook.x) * 0.0042 * this.touchSensitivity;
          this._lookY += (t.clientY - this._touchLook.y) * 0.0042 * this.touchSensitivity;
          this._touchLook.x = t.clientX; this._touchLook.y = t.clientY;
        }
      } else {
        // touchend/touchcancel SEMPRE processados, mesmo com input desabilitado
        // (menus abertos) — sem isso o ID do toque fica preso e a câmera morre.
        if (t.identifier === this._joyPointer) {
          this._joyPointer = null;
          this.move.x = 0; this.move.y = 0;
        } else if (this._touchLook && t.identifier === this._touchLook.id) {
          this._touchLook = null;
        }
      }
    }
  }

  requestPointerLock() {
    if (!IS_MOBILE && this.canvas.requestPointerLock) {
      this.canvas.requestPointerLock();
    }
  }

  consumeLookX() { const v = this._lookX * this.sensitivity; this._lookX = 0; return v; }
  consumeLookY() { const v = this._lookY * this.sensitivity; this._lookY = 0; return v; }

  get fireHeld() { return this._fireHeld; }

  endFrame() {
    this.firePressed = false;
    this.jumpPressed = false;
    this.binocPressed = false;
    this.zoomPressed = false;
    this.interactPressed = false;
    this.reloadPressed = false;
    this.crouchPressed = false;
    this.pronePressed = false;
    this.medPressed = false;
    this.inventoryPressed = false;
    this.pausePressed = false;
  }

  setEnabled(v) {
    this._enabled = v;
    if (!v) {
      this.move.x = 0; this.move.y = 0;
      this._fireHeld = false; this.aim = false; this.run = false;
      this._keys.clear();
      this._touchLook = null;
      this._joyPointer = null;
      this.endFrame();
    }
  }
}
