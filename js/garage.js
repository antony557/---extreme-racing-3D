import * as THREE from './vendor/three.module.min.js';
import { CAR_SPECS, buildCarMesh, getSpec } from './cars.js';
import { PAINTS, WHEEL_STYLES, UPGRADES } from './config.js';
import { formatCoins, clamp } from './utils.js';

export class Garage {
  constructor(game) {
    this.game = game;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(45, game.aspect, 0.1, 200);
    this.currentId = null;
    this.carMesh = null;
    this.theta = 0.6;
    this.phi = 1.25;
    this.radius = 7.5;
    this.autoRotate = true;
    this.dragging = false;
    this.lastX = 0;
    this.lastY = 0;
    this.idleTime = 0;

    this.scene.background = new THREE.Color(0x0a0d13);
    this.scene.fog = new THREE.Fog(0x0a0d13, 18, 60);

    const floor = new THREE.Mesh(
      new THREE.CircleGeometry(30, 48),
      new THREE.MeshStandardMaterial({ color: 0x14181f, metalness: 0.75, roughness: 0.28, envMapIntensity: 1.2 })
    );
    floor.rotation.x = -Math.PI / 2;
    this.scene.add(floor);

    const platform = new THREE.Mesh(
      new THREE.CylinderGeometry(3.4, 3.6, 0.18, 48),
      new THREE.MeshStandardMaterial({ color: 0x1d232e, metalness: 0.6, roughness: 0.35 })
    );
    platform.position.y = 0.09;
    this.scene.add(platform);

    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(3.5, 0.05, 8, 64),
      new THREE.MeshStandardMaterial({ color: 0xff6a00, emissive: 0xff6a00, emissiveIntensity: 2.4 })
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.2;
    this.scene.add(ring);

    const strip = new THREE.Mesh(
      new THREE.TorusGeometry(9, 0.08, 8, 64),
      new THREE.MeshStandardMaterial({ color: 0x00d4ff, emissive: 0x00d4ff, emissiveIntensity: 1.6 })
    );
    strip.rotation.x = Math.PI / 2;
    strip.position.y = 0.05;
    this.scene.add(strip);

    this.scene.add(new THREE.AmbientLight(0x404860, 0.9));
    const key = new THREE.SpotLight(0xffffff, 900, 40, 0.6, 0.5, 1.6);
    key.position.set(5, 9, 5);
    key.target.position.set(0, 0.5, 0);
    this.scene.add(key, key.target);
    const fill = new THREE.SpotLight(0x88aaff, 400, 40, 0.7, 0.6, 1.6);
    fill.position.set(-6, 7, -4);
    fill.target.position.set(0, 0.5, 0);
    this.scene.add(fill, fill.target);
    const rim = new THREE.SpotLight(0xff8844, 300, 30, 0.8, 0.6, 1.6);
    rim.position.set(0, 5, -8);
    rim.target.position.set(0, 0.8, 0);
    this.scene.add(rim, rim.target);

    const pmrem = new THREE.PMREMGenerator(game.renderer);
    const c = document.createElement('canvas');
    c.width = 16; c.height = 64;
    const x = c.getContext('2d');
    const g = x.createLinearGradient(0, 0, 0, 64);
    g.addColorStop(0, '#3a4a66');
    g.addColorStop(0.45, '#141a24');
    g.addColorStop(0.5, '#0a0d13');
    g.addColorStop(1, '#06080c');
    x.fillStyle = g;
    x.fillRect(0, 0, 16, 64);
    const tex = new THREE.CanvasTexture(c);
    tex.mapping = THREE.EquirectangularReflectionMapping;
    const rt = pmrem.fromEquirectangular(tex);
    this.scene.environment = rt.texture;
    tex.dispose();
    pmrem.dispose();

    this.bindInput();
    this.bindUI();
  }

  bindInput() {
    const el = this.game.renderer.domElement;
    el.addEventListener('pointerdown', (e) => {
      if (this.game.state !== 'garage') return;
      this.dragging = true;
      this.autoRotate = false;
      this.lastX = e.clientX; this.lastY = e.clientY;
      this.idleTime = 0;
    });
    window.addEventListener('pointermove', (e) => {
      if (!this.dragging || this.game.state !== 'garage') return;
      this.theta -= (e.clientX - this.lastX) * 0.008;
      this.phi = clamp(this.phi - (e.clientY - this.lastY) * 0.006, 0.55, 1.5);
      this.lastX = e.clientX; this.lastY = e.clientY;
      this.idleTime = 0;
    });
    window.addEventListener('pointerup', () => { this.dragging = false; });
  }

  bindUI() {
    const $ = (id) => document.getElementById(id);
    $('btn-buy-car').addEventListener('click', () => this.buyCurrent());
    $('btn-select-car').addEventListener('click', () => this.selectCurrent());
    $('paint-swatches').addEventListener('click', (e) => {
      const sw = e.target.closest('.swatch');
      if (!sw || !this.currentOwned()) return;
      const idx = [...$('paint-swatches').children].indexOf(sw);
      this.game.save.customize(this.currentId, { color: idx });
      this.refreshPanel();
      this.rebuildCar();
    });
    $('wheel-seg').addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b || !this.currentOwned()) return;
      const idx = +b.dataset.wheel;
      this.game.save.customize(this.currentId, { wheel: idx });
      this.refreshPanel();
      this.rebuildCar();
    });
    $('upgrade-list').addEventListener('click', (e) => {
      const b = e.target.closest('.upg-buy');
      if (!b || b.classList.contains('max') || !this.currentOwned()) return;
      const kind = b.dataset.kind;
      const up = UPGRADES[kind];
      const entry = this.game.save.carEntry(this.currentId);
      const price = up.basePrice + up.step * entry.upgrades[kind];
      if (this.game.save.buyUpgrade(this.currentId, kind, price)) {
        this.game.audio.coin();
        this.refreshPanel();
        this.game.ui.refreshCoins();
      } else {
        this.game.ui.toast('Moedas insuficientes!');
      }
    });
  }

  currentOwned() {
    const e = this.game.save.data.cars[this.currentId];
    return e && e.owned;
  }

  open() {
    this.currentId = this.game.save.data.selected || CAR_SPECS[0].id;
    this.renderCarList();
    this.refreshPanel();
    this.rebuildCar();
  }

  renderCarList() {
    const list = document.getElementById('car-list');
    list.innerHTML = '';
    const save = this.game.save.data;
    for (const spec of CAR_SPECS) {
      const entry = save.cars[spec.id];
      const owned = entry && entry.owned;
      const item = document.createElement('button');
      item.className = 'car-item' + (spec.id === this.currentId ? ' sel' : '') + (owned ? '' : ' locked');
      const paintIdx = entry ? entry.color : 0;
      item.innerHTML = `<span class="ci-dot" style="background:${PAINTS[paintIdx % PAINTS.length]}"></span>
        <div><h4>${spec.name}</h4><p>${spec.cls} · ${spec.topSpeed} km/h</p></div>
        ${owned ? '<span class="ci-price">' + (spec.id === save.selected ? 'EM USO' : 'SUA') + '</span>' : '<span class="ci-price">' + formatCoins(spec.price) + '</span>'}`;
      item.addEventListener('click', () => {
        this.currentId = spec.id;
        this.renderCarList();
        this.refreshPanel();
        this.rebuildCar();
        this.game.audio.click();
      });
      list.appendChild(item);
    }
  }

  refreshPanel() {
    const $ = (id) => document.getElementById(id);
    const spec = getSpec(this.currentId);
    const save = this.game.save.data;
    const entry = save.cars[this.currentId] || { owned: false, color: 0, wheel: 0, upgrades: { engine: 0, tires: 0, nitro: 0 } };
    const owned = entry.owned;
    $('gp-name').textContent = spec.name;
    $('gp-class').textContent = spec.cls + ' · ' + (owned ? 'ADQUIRIDO' : formatCoins(spec.price) + ' MOEDAS');
    $('gp-buy-section').style.display = owned ? 'none' : 'block';
    $('gp-custom').style.display = owned ? 'block' : 'none';
    $('btn-select-car').style.display = owned ? 'block' : 'none';
    const buyBtn = $('btn-buy-car');
    buyBtn.textContent = 'COMPRAR POR ' + formatCoins(spec.price);
    buyBtn.style.opacity = save.coins < spec.price ? 0.5 : 1;

    const topSpeed = spec.topSpeed * (1 + entry.upgrades.engine * 0.045);
    const stats = [
      ['VELOCIDADE', clamp(topSpeed / 380, 0, 1), Math.round(topSpeed) + ' km/h'],
      ['ACELERAÇÃO', clamp(6 / spec.accel, 0, 1), spec.accel.toFixed(1) + 's (0-100)'],
      ['ADERÊNCIA', clamp((spec.grip + entry.upgrades.tires * 0.05) / 1.6, 0, 1), (spec.grip + entry.upgrades.tires * 0.05).toFixed(2)],
      ['PESO', clamp(spec.mass / 1800, 0, 1), spec.mass + ' kg'],
      ['NITRO', clamp(0.15 + entry.upgrades.nitro / 5 * 0.85, 0, 1), 'Nv ' + entry.upgrades.nitro],
    ];
    $('gp-stats').innerHTML = stats.map(([label, frac, val]) =>
      `<div class="stat-bar"><span>${label}</span><div class="sb-track"><div class="sb-fill" style="width:${Math.round(frac * 100)}%"></div></div><span class="sb-val">${val}</span></div>`
    ).join('');

    const sw = $('paint-swatches');
    sw.innerHTML = '';
    PAINTS.forEach((p, i) => {
      const d = document.createElement('button');
      d.className = 'swatch' + (i === entry.color ? ' sel' : '');
      d.style.background = p;
      sw.appendChild(d);
    });

    const ws = $('wheel-seg');
    ws.innerHTML = '';
    WHEEL_STYLES.forEach((w, i) => {
      const b = document.createElement('button');
      b.textContent = w.label;
      b.dataset.wheel = i;
      if (i === entry.wheel) b.classList.add('sel');
      ws.appendChild(b);
    });

    const ul = $('upgrade-list');
    ul.innerHTML = '';
    for (const [kind, up] of Object.entries(UPGRADES)) {
      const lvl = entry.upgrades[kind];
      const price = up.basePrice + up.step * lvl;
      const row = document.createElement('div');
      row.className = 'upg-row';
      row.innerHTML = `<span class="upg-name">${up.label}</span>
        <span class="upg-pips">${Array.from({ length: up.max }, (_, i) => `<span class="pip${i < lvl ? ' on' : ''}"></span>`).join('')}</span>
        <button class="upg-buy${lvl >= up.max ? ' max' : ''}" data-kind="${kind}">${lvl >= up.max ? 'MÁX' : formatCoins(price)}</button>`;
      ul.appendChild(row);
    }
  }

  rebuildCar() {
    if (this.carMesh) {
      this.scene.remove(this.carMesh);
      this.carMesh.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
        if (o.material) {
          const mats = Array.isArray(o.material) ? o.material : [o.material];
          for (const m of mats) m.dispose();
        }
      });
    }
    const spec = getSpec(this.currentId);
    const entry = this.game.save.data.cars[this.currentId] || { color: 0, wheel: 0 };
    this.carMesh = buildCarMesh(spec, { color: PAINTS[(entry.color || 0) % PAINTS.length], wheel: entry.wheel || 0 });
    this.carMesh.position.y = 0.18;
    this.scene.add(this.carMesh);
  }

  buyCurrent() {
    const spec = getSpec(this.currentId);
    if (this.game.save.buyCar(spec.id, spec.price)) {
      this.game.audio.coin();
      this.game.ui.toast(`${spec.name} adquirido!`);
      this.renderCarList();
      this.refreshPanel();
      this.game.ui.refreshCoins();
    } else {
      this.game.ui.toast('Moedas insuficientes!');
    }
  }

  selectCurrent() {
    if (this.game.save.selectCar(this.currentId)) {
      this.game.audio.click();
      this.game.ui.toast(`${getSpec(this.currentId).name} selecionado`);
      this.renderCarList();
      this.refreshPanel();
    }
  }

  update(dt) {
    this.idleTime += dt;
    if (this.idleTime > 2.5) this.autoRotate = true;
    if (this.autoRotate && !this.dragging) this.theta += dt * 0.35;
    const cx = Math.sin(this.theta) * Math.sin(this.phi) * this.radius;
    const cy = Math.cos(this.phi) * this.radius * 0.6 + 0.6;
    const cz = Math.cos(this.theta) * Math.sin(this.phi) * this.radius;
    this.camera.position.set(cx, Math.max(0.9, cy), cz);
    this.camera.lookAt(0, 0.7, 0);
  }
}
