import { formatTime, clamp } from './utils.js';

function rr(x, px, py, w, h, r) {
  x.beginPath();
  x.moveTo(px + r, py);
  x.arcTo(px + w, py, px + w, py + h, r);
  x.arcTo(px + w, py + h, px, py + h, r);
  x.arcTo(px, py + h, px, py, r);
  x.arcTo(px, py, px + w, py, r);
  x.closePath();
}

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
    this.mapBase = document.createElement('canvas');
    this.mapBase.width = this.minimap.width;
    this.mapBase.height = this.minimap.height;
    this._lastLapTxt = '';
    this._lastTimeTxt = '';
  }

  show(v) { this.root.classList.toggle('hidden', !v); }

  setTrack(track) {
    this.trackPts = track.minimapPts;
    this.redrawMinimapBase();
  }

  redrawMinimapBase() {
    const c = this.mapBase, x = c.getContext('2d');
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
    x.lineJoin = 'round';
    x.lineCap = 'round';
    x.strokeStyle = 'rgba(232,32,42,0.9)';
    x.lineWidth = 7;
    x.beginPath();
    this.trackPts.forEach((p, i) => {
      const px = this.mapTransform.ox + p[0] * sc;
      const py = this.mapTransform.oy + p[1] * sc;
      if (i === 0) x.moveTo(px, py); else x.lineTo(px, py);
    });
    x.closePath();
    x.stroke();
    x.strokeStyle = 'rgba(235,240,246,0.95)';
    x.lineWidth = 3.5;
    x.stroke();
    x.strokeStyle = 'rgba(8,11,17,0.55)';
    x.lineWidth = 1.2;
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
    x.drawImage(this.mapBase, 0, 0);
    if (!this.mapTransform) return;
    for (let i = cars.length - 1; i >= 0; i--) {
      const car = cars[i];
      if (car.eliminated) continue;
      const pt = this.mapPoint(car.physics.pos.x, car.physics.pos.z, track);
      if (!pt) continue;
      x.beginPath();
      x.arc(pt[0], pt[1], car.isPlayer ? 5.5 : 3.6, 0, 7);
      x.fillStyle = car.isPlayer ? '#ff6a00' : car.colorHex;
      x.fill();
      if (car.isPlayer) { x.strokeStyle = '#fff'; x.lineWidth = 1.8; x.stroke(); }
    }
  }

  drawSpeedo(kmh, rpm, gear, maxKmh) {
    const c = this.speedo, x = this.sctx;
    const w = c.width, h = c.height;
    x.clearRect(0, 0, w, h);
    const cx = w / 2, cy = h / 2, r = w / 2 - 8;
    const a0 = Math.PI * 0.75, a1 = Math.PI * 2.25;

    x.beginPath();
    x.arc(cx, cy, r, 0, Math.PI * 2);
    x.fillStyle = 'rgba(8,11,17,0.78)';
    x.fill();
    x.lineWidth = 2;
    x.strokeStyle = 'rgba(255,255,255,0.16)';
    x.stroke();
    x.beginPath();
    x.arc(cx, cy, r, 0, Math.PI * 2);
    x.fillStyle = 'rgba(8,11,17,0)';
    x.strokeStyle = 'rgba(232,32,42,0.55)';
    x.lineWidth = 3;
    x.beginPath();
    x.arc(cx, cy, r + 1, Math.PI * 0.62, Math.PI * 0.88);
    x.stroke();
    x.strokeStyle = 'rgba(31,125,255,0.55)';
    x.beginPath();
    x.arc(cx, cy, r + 1, Math.PI * 0.12, Math.PI * 0.38);
    x.stroke();

    x.lineCap = 'round';
    x.lineWidth = 9;
    x.strokeStyle = 'rgba(255,255,255,0.09)';
    x.beginPath(); x.arc(cx, cy, r - 15, a0, a1); x.stroke();
    const rf = clamp(rpm, 0, 1);
    x.strokeStyle = rf > 0.82 ? '#ff2233' : '#1f7dff';
    x.beginPath(); x.arc(cx, cy, r - 15, a0, a0 + (a1 - a0) * rf); x.stroke();

    x.lineWidth = 2;
    x.strokeStyle = 'rgba(255,255,255,0.32)';
    x.lineCap = 'butt';
    for (let i = 0; i <= 10; i++) {
      const a = a0 + (a1 - a0) * (i / 10);
      const c1 = Math.cos(a), s1 = Math.sin(a);
      x.beginPath();
      x.moveTo(cx + c1 * (r - 26), cy + s1 * (r - 26));
      x.lineTo(cx + c1 * (r - 20), cy + s1 * (r - 20));
      x.stroke();
    }

    x.textAlign = 'center';
    x.fillStyle = '#f4f6f8';
    x.font = '900 52px Arial';
    x.fillText(String(Math.round(kmh)), cx, cy + 6);
    x.font = '700 12px Arial';
    x.fillStyle = 'rgba(255,255,255,0.55)';
    x.fillText('KM/H', cx, cy + 24);

    x.fillStyle = '#1f7dff';
    rr(x, cx - 17, cy + 34, 34, 30, 6);
    x.fill();
    x.fillStyle = '#ffffff';
    x.font = '900 21px Arial';
    x.fillText(gear === -1 ? 'R' : String(gear), cx, cy + 56);

    const sf = clamp(kmh / maxKmh, 0, 1);
    const na = a0 + (a1 - a0) * sf;
    x.strokeStyle = '#e8202a';
    x.lineWidth = 3.5;
    x.lineCap = 'round';
    x.beginPath();
    x.moveTo(cx - Math.cos(na) * 10, cy - Math.sin(na) * 10);
    x.lineTo(cx + Math.cos(na) * (r - 32), cy + Math.sin(na) * (r - 32));
    x.stroke();
    x.beginPath();
    x.arc(cx, cy, 5, 0, 7);
    x.fillStyle = '#e8202a';
    x.fill();
  }

  update(data) {
    const el = this.el;
    el.position.textContent = data.position;
    el.total.textContent = data.total;
    el.lap.textContent = data.lap;
    el.laps.textContent = data.laps;
    const timeTxt = formatTime(data.time);
    if (timeTxt !== this._lastTimeTxt) { el.time.textContent = timeTxt; this._lastTimeTxt = timeTxt; }
    const lapTxt = data.lastLap ? 'Última: ' + formatTime(data.lastLap) : '';
    if (lapTxt !== this._lastLapTxt) { el.laptime.textContent = lapTxt; this._lastLapTxt = lapTxt; }
    el.nitro.style.height = Math.round(data.nitro * 100) + '%';
    this.drawSpeedo(data.speed, data.rpm, data.gear, 380);
    el.wrongway.classList.toggle('hidden', !data.wrongWay);
  }

  message(text, duration) {
    this.el.message.textContent = text;
    if (this.msgTimer) clearTimeout(this.msgTimer);
    if (duration) this.msgTimer = setTimeout(() => { this.el.message.textContent = ''; }, duration * 1000);
  }
}
