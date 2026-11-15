import { formatTime, clamp } from './utils.js';

export class HUD {
  constructor() {
    this.root = document.getElementById('hud');
    this.el = {
      position: document.getElementById('hud-position'),
      total: document.getElementById('hud-total'),
      lap: document.getElementById('hud-lap'),
      laps: document.getElementById('hud-laps'),
      time: document.getElementById('hud-time'),
      laptime: document.getElementById('hud-laptime'),
      nitro: document.getElementById('nitro-fill'),
      message: document.getElementById('hud-message'),
      wrongway: document.getElementById('hud-wrongway'),
    };
    this.speedo = document.getElementById('speedo');
    this.sctx = this.speedo.getContext('2d');
    this.minimap = document.getElementById('minimap');
    this.mctx = this.minimap.getContext('2d');
    this.msgTimer = null;
    this.trackPts = null;
    this.mapTransform = null;
  }

  show(v) { this.root.classList.toggle('hidden', !v); }

  setTrack(track) {
    this.trackPts = track.minimapPts;
    this.redrawMinimapBase();
  }

  redrawMinimapBase() {
    const c = this.minimap, x = this.mctx;
    const w = c.width, h = c.height;
    x.clearRect(0, 0, w, h);
    if (!this.trackPts) return;
    let mnx = Infinity, mxx = -Infinity, mny = Infinity, mxy = -Infinity;
    for (const p of this.trackPts) {
      mnx = Math.min(mnx, p[0]); mxx = Math.max(mxx, p[0]);
      mny = Math.min(mny, p[1]); mxy = Math.max(mxy, p[1]);
    }
    const pad = 14;
    const sw = (w - pad * 2) / Math.max(mxx - mnx, 0.001);
    const sh = (h - pad * 2) / Math.max(mxy - mny, 0.001);
    const sc = Math.min(sw, sh);
    this.mapTransform = { sc, ox: (w - (mxx - mnx) * sc) / 2 - mnx * sc, oy: (h - (mxy - mny) * sc) / 2 - mny * sc };
    x.strokeStyle = 'rgba(255,255,255,0.85)';
    x.lineWidth = 4;
    x.lineJoin = 'round';
    x.beginPath();
    this.trackPts.forEach((p, i) => {
      const px = this.mapTransform.ox + p[0] * sc;
      const py = this.mapTransform.oy + p[1] * sc;
      if (i === 0) x.moveTo(px, py); else x.lineTo(px, py);
    });
    x.closePath();
    x.stroke();
    x.strokeStyle = 'rgba(0,0,0,0.55)';
    x.lineWidth = 1.5;
    x.stroke();
  }

  mapPoint(wx, wz, track) {
    if (!this.mapTransform) return null;
    const [mx, mz] = track.toMinimap(wx, wz);
    const t = this.mapTransform;
    return [t.ox + mx * t.sc, t.oy + mz * t.sc];
  }

  drawMinimap(cars, track) {
    const c = this.minimap, x = this.mctx;
    x.clearRect(0, 0, c.width, c.height);
    this.redrawMinimapBase();
    if (!this.mapTransform) return;
    for (let i = cars.length - 1; i >= 0; i--) {
      const car = cars[i];
      if (car.eliminated) continue;
      const pt = this.mapPoint(car.physics.pos.x, car.physics.pos.z, track);
      if (!pt) continue;
      x.beginPath();
      x.arc(pt[0], pt[1], car.isPlayer ? 5 : 3.4, 0, 7);
      x.fillStyle = car.isPlayer ? '#ff6a00' : car.colorHex;
      x.fill();
      if (car.isPlayer) { x.strokeStyle = '#fff'; x.lineWidth = 1.6; x.stroke(); }
    }
  }

  drawSpeedo(kmh, rpm, gear, maxKmh) {
    const c = this.speedo, x = this.sctx;
    const w = c.width, h = c.height;
    x.clearRect(0, 0, w, h);
    const cx = w / 2, cy = h / 2, r = w / 2 - 10;
    x.beginPath();
    x.arc(cx, cy, r, 0, Math.PI * 2);
    x.fillStyle = 'rgba(8,12,18,0.72)';
    x.fill();
    x.strokeStyle = 'rgba(255,255,255,0.25)';
    x.lineWidth = 2;
    x.stroke();

    const a0 = Math.PI * 0.75, a1 = Math.PI * 2.25;
    x.lineWidth = 7;
    x.strokeStyle = 'rgba(255,255,255,0.12)';
    x.beginPath();
    x.arc(cx, cy, r - 12, a0, a1);
    x.stroke();
    const frac = clamp(kmh / maxKmh, 0, 1);
    x.strokeStyle = '#00d4ff';
    x.beginPath();
    x.arc(cx, cy, r - 12, a0, a0 + (a1 - a0) * frac * 0.7);
    x.stroke();
    x.strokeStyle = '#ff6a00';
    x.beginPath();
    x.arc(cx, cy, r - 12, a0 + (a1 - a0) * 0.7, a0 + (a1 - a0) * frac);
    x.stroke();

    x.strokeStyle = 'rgba(255,255,255,0.35)';
    x.lineWidth = 2;
    for (let i = 0; i <= 12; i++) {
      const a = a0 + (a1 - a0) * (i / 12);
      x.beginPath();
      x.moveTo(cx + Math.cos(a) * (r - 22), cy + Math.sin(a) * (r - 22));
      x.lineTo(cx + Math.cos(a) * (r - 16), cy + Math.sin(a) * (r - 16));
      x.stroke();
    }

    const na = a0 + (a1 - a0) * frac;
    x.strokeStyle = '#ff6a00';
    x.lineWidth = 3.5;
    x.beginPath();
    x.moveTo(cx - Math.cos(na) * 12, cy - Math.sin(na) * 12);
    x.lineTo(cx + Math.cos(na) * (r - 26), cy + Math.sin(na) * (r - 26));
    x.stroke();
    x.beginPath();
    x.arc(cx, cy, 5, 0, 7);
    x.fillStyle = '#ff6a00';
    x.fill();

    x.fillStyle = '#fff';
    x.font = '900 34px Arial';
    x.textAlign = 'center';
    x.fillText(String(Math.round(kmh)), cx, cy + 30);
    x.font = '700 11px Arial';
    x.fillStyle = 'rgba(255,255,255,0.6)';
    x.fillText('KM/H', cx, cy + 44);

    const rpmFrac = clamp(rpm, 0, 1);
    x.strokeStyle = rpmFrac > 0.9 ? '#ff2244' : '#00d4ff';
    x.lineWidth = 4;
    x.beginPath();
    x.arc(cx, cy, r - 24, a0, a0 + (a1 - a0) * rpmFrac);
    x.stroke();

    x.fillStyle = '#ffd75e';
    x.font = '900 26px Arial';
    x.fillText(gear === -1 ? 'R' : String(gear), cx, cy - 18);
  }

  update(data) {
    this.el.position.textContent = data.position;
    this.el.total.textContent = data.total;
    this.el.lap.textContent = data.lap;
    this.el.laps.textContent = data.laps;
    this.el.time.textContent = formatTime(data.time);
    this.el.laptime.textContent = data.lastLap ? 'Última: ' + formatTime(data.lastLap) : '';
    this.el.nitro.style.height = Math.round(data.nitro * 100) + '%';
    this.drawSpeedo(data.speed, data.rpm, data.gear, 380);
    this.el.wrongway.classList.toggle('hidden', !data.wrongWay);
  }

  message(text, duration) {
    this.el.message.textContent = text;
    if (this.msgTimer) clearTimeout(this.msgTimer);
    if (duration) this.msgTimer = setTimeout(() => { this.el.message.textContent = ''; }, duration * 1000);
  }
}
