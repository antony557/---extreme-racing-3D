import * as THREE from './vendor/three.module.min.js';
import { Track, TRACKS } from './tracks.js';
import { CarPhysics } from './physics.js';
import { AIController, AI_NAMES } from './ai.js';
import { buildCarMesh, setBrakeLights, getSpec, CAR_SPECS } from './cars.js';
import { ParticleSystem } from './particles.js';
import { CameraRig } from './camera.js';
import { ELIMINATION_INTERVAL, DIFFICULTY, CHAMPIONSHIP_POINTS, PAINTS } from './config.js';
import { clamp, mulberry32, formatTime } from './utils.js';

const REWARDS = [500, 350, 250, 200, 160, 130, 110, 100];
const NEUTRAL = { throttle: 0, brake: 0, steer: 0, handbrake: false, nitro: false };
const BRAKE = { throttle: 0, brake: 1, steer: 0, handbrake: false, nitro: false };

export class Race {
  constructor(game, config) {
    this.game = game;
    this.config = config;
    this.mode = config.mode;
    this.laps = config.laps;
    this.state = 'countdown';
    this.countdown = 3.6;
    this.lastCount = '';
    this.elapsed = 0;
    this.finishCount = 0;
    this.finishTimer = 0;
    this.playerLost = false;
    this.elimTimer = ELIMINATION_INTERVAL;
    this.results = null;

    const def = TRACKS.find((t) => t.id === config.trackId);
    const quality = game.quality;
    this.scene = new THREE.Scene();
    this.track = new Track(def, quality, game.renderer);
    this.scene.add(this.track.group);
    const th = this.track.theme;
    this.scene.fog = new THREE.FogExp2(th.fog, th.fogDensity);
    if (this.track.envMap) this.scene.environment = this.track.envMap;

    this.camera = new THREE.PerspectiveCamera(62, game.aspect, 0.3, quality.far || 2200);
    this.rig = new CameraRig(this.camera);
    this.rig.mode = game.save.data.settings.camera || 0;

    this.particles = new ParticleSystem(this.scene, quality);

    this.cars = [];
    this.buildCars();

    this.player = this.cars.find((c) => c.isPlayer);
    if (quality.shadows) {
      for (const car of this.cars) {
        const blob = car.mesh.getObjectByName('blobShadow');
        if (blob) blob.visible = false;
      }
    }
    this.rig.snapTo(this.player.physics);
    this.hud = game.hud;
    this.hud.setTrack(this.track);
    this.hud.show(true);

    this.headlight = null;
    if (quality.spotlights) {
      this.headlight = new THREE.SpotLight(0xfff2d0, 180, 90, 0.55, 0.5, 1.4);
      this.headlight.visible = false;
      this.scene.add(this.headlight);
      this.scene.add(this.headlight.target);
    }

    game.audio.init();
    game.audio.stopMusic();
    this.updateHud();
    this.hud.message('PREPARE-SE', 1.6);
  }

  buildCars() {
    const cfg = this.config;
    const save = this.game.save.data;
    const spawns = this.track.spawn(cfg.opponents + 1);
    const rng = mulberry32(this.track.def.seed * 31 + 7);

    const playerSpec = getSpec(save.selected);
    const playerEntry = save.cars[save.selected];
    this.cars.push(this.makeCar(playerSpec, playerEntry, spawns[0], true, 'VOCÊ', 0));

    const aiCount = cfg.opponents;
    const pool = CAR_SPECS.filter((c) => c.price <= playerSpec.price * 1.6 + 9000);
    for (let i = 0; i < aiCount; i++) {
      const spec = pool.length ? pool[Math.floor(rng() * pool.length)] : CAR_SPECS[i % CAR_SPECS.length];
      const entry = { color: 0, wheel: Math.floor(rng() * 4), upgrades: { engine: Math.min(5, Math.floor(rng() * 4)), tires: Math.floor(rng() * 3), nitro: 0 } };
      const car = this.makeCar(spec, entry, spawns[i + 1], false, AI_NAMES[i % AI_NAMES.length], Math.floor(rng() * 0xffffff));
      car.ai = new AIController(car.physics, DIFFICULTY[cfg.difficulty], this.track, i);
      this.cars.push(car);
    }
  }

  makeCar(spec, entry, spawn, isPlayer, name, colorHex) {
    const color = isPlayer ? PAINTS[(entry.color || 0) % PAINTS.length] : '#' + colorHex.toString(16).padStart(6, '0');
    const mesh = buildCarMesh(spec, { color, wheel: entry.wheel || 0 });
    mesh.position.copy(spawn.pos);
    mesh.rotation.y = spawn.heading;
    this.scene.add(mesh);
    const physics = new CarPhysics(spec, entry.upgrades, { isPlayer });
    physics.setTrack(this.track);
    physics.placeAt(spawn.pos, spawn.heading);
    return {
      physics, mesh, isPlayer, name, colorHex: color,
      spec, entry, ai: null,
      lap: 1, progress: 0, halfFlag: false, prevS: physics.trackInfo.s,
      finished: false, finishTime: 0, finishOrder: 0,
      eliminated: false, lapStart: 0, lastLap: 0, bestLap: 0, position: 1,
    };
  }

  update(dt) {
    if (this.state === 'countdown') {
      this.countdown -= dt;
      const label = this.countdown > 0.6 ? String(Math.max(1, Math.ceil(this.countdown - 0.6))) : 'GO!';
      if (this.lastCount !== label) {
        this.lastCount = label;
        this.hud.message(label);
        this.game.audio.beep(label === 'GO!' ? 880 : 440, label === 'GO!' ? 0.4 : 0.15, 0.15);
      }
      if (this.countdown <= 0) {
        this.state = 'racing';
        this.hud.message('', 0);
      }
      this.updateVisuals(dt);
      this.hud.drawMinimap(this.cars, this.track);
      return;
    }

    if (this.state === 'racing' || this.state === 'ending') {
      this.elapsed += dt;
      this.frameCtl = this.state === 'racing' ? this.game.input.sample() : NEUTRAL;
      const substeps = dt > 0.025 ? 2 : 1;
      const sdt = dt / substeps;
      for (let s = 0; s < substeps; s++) this.step(sdt);
      this.updatePositions();
      this.updateVisuals(dt);
      this.updateHud();

      if (this.state === 'racing') {
        if (this.mode === 'elimination') this.updateElimination(dt);
        else this.checkModeEnd();
      }
      if (this.state === 'ending') {
        this.finishTimer -= dt;
        if (this.finishTimer <= 0) this.showResults();
      }
    }
    this.track.update(dt);
    this.particles.update(dt);
    this.hud.drawMinimap(this.cars, this.track);
  }

  step(dt) {
    const racing = this.state === 'racing';
    const playerCtl = this.frameCtl || NEUTRAL;
    const cars = this.cars;

    for (const car of cars) {
      if (car.eliminated) { car.physics.update(dt, BRAKE); continue; }
      let ctl;
      if (car.isPlayer) ctl = playerCtl;
      else if (car.ai) ctl = car.ai.update(dt, cars);
      else ctl = BRAKE;
      if (!racing) ctl = BRAKE;
      car.physics.update(dt, ctl);
    }

    for (let i = 0; i < cars.length; i++) {
      for (let j = i + 1; j < cars.length; j++) {
        if (cars[i].eliminated || cars[j].eliminated) continue;
        const hit = cars[i].physics.applyCarCollision(cars[j].physics);
        if (hit && hit.impact > 3) this.onCollision(hit.impact, hit.x, hit.z, cars[i], cars[j]);
      }
    }

    if (racing) this.updateLaps();
  }

  updateLaps() {
    const L = this.track.length;
    for (const car of this.cars) {
      if (car.eliminated) continue;
      const info = car.physics.trackInfo;
      const s = info.s;
      let raw = s - car.prevS;
      let ds = raw;
      if (ds < -L / 2) ds += L;
      if (ds > L / 2) ds -= L;
      car.prevS = s;
      if (!car.finished) car.progress += ds;
      if (s > L * 0.45 && s < L * 0.55) car.halfFlag = true;

      if (raw < -L * 0.5 && car.halfFlag && !car.finished) {
        car.halfFlag = false;
        const lapTime = (this.elapsed - car.lapStart) * 1000;
        car.lastLap = lapTime;
        if (!car.bestLap || lapTime < car.bestLap) car.bestLap = lapTime;
        car.lapStart = this.elapsed;
        car.lap++;
        if (this.laps > 0 && car.lap > this.laps) {
          this.finishCar(car);
          if (car.isPlayer) this.hud.message('CHEGADA!', 2.5);
        } else if (car.isPlayer) {
          this.game.audio.chime();
          const isRecord = this.game.save.recordTime(this.track.def.id, lapTime);
          this.hud.message(isRecord ? 'NOVO RECORDE! ' + formatTime(lapTime) : 'VOLTA ' + car.lap, 2);
        }
      }
    }
  }

  finishCar(car) {
    car.finished = true;
    car.finishTime = this.elapsed;
    car.finishOrder = ++this.finishCount;
    car.progress = this.laps * this.track.length + 1000 + (1000 - car.finishOrder);
  }

  checkModeEnd() {
    if (this.player.finished) {
      this.state = 'ending';
      this.finishTimer = 2.2;
      this.playerLost = false;
    }
  }

  updateElimination(dt) {
    this.elimTimer -= dt;
    if (this.elimTimer > 0) return;
    this.elimTimer = ELIMINATION_INTERVAL;
    const alive = this.cars.filter((c) => !c.eliminated && !c.finished);
    if (alive.length > 1) {
      alive.sort((a, b) => a.progress - b.progress);
      const out = alive[0];
      out.eliminated = true;
      if (out.ai) out.ai.eliminated = true;
      this.game.audio.beep(220, 0.5, 0.2);
      this.hud.message(`${out.name} ELIMINADO`, 2.2);
      if (out.isPlayer) {
        this.state = 'ending';
        this.finishTimer = 2;
        this.playerLost = true;
      }
    } else if (alive.length === 1) {
      const winner = alive[0];
      this.finishCar(winner);
      if (winner.isPlayer) {
        this.state = 'ending';
        this.finishTimer = 2;
        this.playerLost = false;
      }
    }
  }

  updatePositions() {
    const sorted = [...this.cars].sort((a, b) => {
      if (a.finished && b.finished) return a.finishOrder - b.finishOrder;
      if (a.finished) return -1;
      if (b.finished) return 1;
      if (a.eliminated !== b.eliminated) return a.eliminated ? 1 : -1;
      return b.progress - a.progress;
    });
    sorted.forEach((c, i) => c.position = i + 1);
  }

  onCollision(impact, x, z, a, b) {
    this.particles.sparks(x, 0.4, z, Math.min(10, Math.floor(impact)));
    if (a.isPlayer || b.isPlayer) {
      this.game.audio.thump(impact);
      this.rig.addShake(impact * 0.05);
    }
  }

  updateVisuals(dt) {
    const playerCtl = this.frameCtl || NEUTRAL;
    for (const car of this.cars) {
      const ph = car.physics;
      car.mesh.position.set(ph.pos.x, ph.pos.y, ph.pos.z);
      car.mesh.rotation.y = ph.heading;
      const ud = car.mesh.userData;
      if (ud.bodyGroup) {
        ud.bodyGroup.rotation.z = ph.roll;
        ud.bodyGroup.rotation.x = ph.pitch;
      }
      for (const w of ud.wheels) {
        w.spin.rotation.z = ph.wheelSpinAngle;
        if (w.front) w.holder.rotation.y = ph.steerAngle;
      }
      const braking = car.isPlayer ? playerCtl.brake > 0 && ph.forwardSpeed > 1 : ph.forwardSpeed > 1 && car.ai && car.ai.lastBrake;
      setBrakeLights(car.mesh, !!braking);

      const speed = Math.abs(ph.forwardSpeed);
      if (ph.drifting && Math.random() < ph.skidLevel * 0.9) {
        const bx = ph.pos.x - Math.sin(ph.heading) * 1.4, bz = ph.pos.z - Math.cos(ph.heading) * 1.4;
        if (ph.onGrass) this.particles.dust(bx, 0.2, bz);
        else this.particles.smoke(bx, 0.25, bz);
        this.particles.skidMark(bx, ph.pos.y, bz, -ph.heading);
      } else if (ph.onGrass && speed > 10 && Math.random() < 0.5) {
        this.particles.dust(ph.pos.x - Math.sin(ph.heading) * 1.4, 0.2, ph.pos.z - Math.cos(ph.heading) * 1.4);
      }
      if (ph.nitroActive && Math.random() < 0.85) {
        const bx = ph.pos.x - Math.sin(ph.heading) * (car.spec.body.len / 2 + 0.2);
        const bz = ph.pos.z - Math.cos(ph.heading) * (car.spec.body.len / 2 + 0.2);
        this.particles.nitro(bx, 0.35, bz);
      }
      for (const ev of ph.consumeEvents()) {
        if (ev.type === 'collision') {
          this.particles.sparks(ev.x, 0.4, ev.z, Math.min(8, Math.floor(ev.impact)));
          if (car.isPlayer) { this.game.audio.thump(ev.impact); this.rig.addShake(ev.impact * 0.06); }
        }
      }
    }

    const p = this.player.physics;
    this.track.sun.position.set(
      p.pos.x + this.track.theme.sunPos[0] * 160,
      this.track.theme.sunPos[1] * 160 + 40,
      p.pos.z + this.track.theme.sunPos[2] * 160
    );
    this.track.sun.target.position.set(p.pos.x, p.pos.y, p.pos.z);

    if (this.headlight) {
      this.headlight.visible = true;
      this.headlight.position.set(p.pos.x + Math.sin(p.heading) * 2, p.pos.y + 0.8, p.pos.z + Math.cos(p.heading) * 2);
      this.headlight.target.position.set(p.pos.x + Math.sin(p.heading) * 40, p.pos.y, p.pos.z + Math.cos(p.heading) * 40);
    }

    const speed01 = clamp(Math.abs(p.forwardSpeed) / (p.topSpeed || 1), 0, 1);
    this.rig.update(dt, p, speed01);

    const audio = this.game.audio;
    const ctl = this.state === 'racing' ? playerCtl : { throttle: 0 };
    audio.setEngine(p.rpm, ctl.throttle || 0, this.state === 'racing');
    audio.setSkid(this.state === 'racing' ? p.skidLevel : 0);
    audio.setWind(speed01);
    audio.setNitro(p.nitroActive);
    if (p.gearChanged) { p.gearChanged = false; audio.gearShift(); }
  }

  updateHud() {
    const p = this.player.physics;
    const wrongWay = p.forwardSpeed > 4 && p.trackInfo.tangent &&
      (p.vel.x * p.trackInfo.tangent.x + p.vel.z * p.trackInfo.tangent.z) < -2;
    this.hud.update({
      position: this.player.position,
      total: this.cars.length,
      lap: Math.min(this.player.lap, this.laps || 99),
      laps: this.laps > 0 ? this.laps : '—',
      time: this.elapsed * 1000,
      lastLap: this.player.lastLap,
      nitro: p.nitro,
      speed: Math.abs(p.forwardSpeed) * 3.6,
      rpm: p.rpm,
      gear: p.forwardSpeed < -0.5 ? -1 : p.gear,
      wrongWay,
    });
  }

  showResults() {
    if (this.results) return;
    const sorted = [...this.cars].sort((a, b) => {
      if (a.finished && b.finished) return a.finishOrder - b.finishOrder;
      if (a.finished) return -1;
      if (b.finished) return 1;
      if (a.eliminated !== b.eliminated) return a.eliminated ? 1 : -1;
      return b.progress - a.progress;
    });
    const playerPos = sorted.indexOf(this.player) + 1;
    const diff = DIFFICULTY[this.config.difficulty] || { reward: 1 };
    let coins = 0;
    if (this.mode === 'free') coins = 0;
    else if (this.mode === 'elimination') coins = this.playerLost ? 100 : 800;
    else if (this.mode === 'timeattack') {
      coins = 150 * diff.reward;
      const best = this.player.bestLap;
      if (best && this.game.save.recordTime(this.track.def.id, best)) coins += 300;
    } else {
      coins = Math.round(REWARDS[Math.min(playerPos - 1, REWARDS.length - 1)] * diff.reward);
    }

    const save = this.game.save;
    if (this.mode !== 'free') {
      save.data.stats.races++;
      if (playerPos === 1 && !this.playerLost) save.data.stats.wins++;
      if (playerPos <= 3 && !this.playerLost) save.data.stats.podiums++;
      save.data.stats.km += (this.player.physics.distanceTraveled || 0) / 1000;
      save.addCoins(coins);
    }
    if (this.mode === 'championship' && save.data.championship) {
      const champ = save.data.championship;
      for (const car of sorted) {
        const pos = sorted.indexOf(car) + 1;
        const pts = CHAMPIONSHIP_POINTS[pos - 1] || 0;
        champ.points[car.name] = (champ.points[car.name] || 0) + pts;
      }
      champ.round++;
      save.save();
    }

    this.results = {
      rows: sorted.map((c, i) => ({
        pos: i + 1, name: c.name, me: c.isPlayer,
        time: c.finished ? formatTime(c.finishTime * 1000) : c.eliminated ? 'Eliminado' : '—',
        out: c.eliminated,
      })),
      playerPos, coins, playerLost: this.playerLost,
      bestLap: this.player.bestLap,
      mode: this.mode,
    };
    this.game.audio.stopEngine();
    this.game.onRaceFinished(this.results);
  }

  dispose() {
    this.game.audio.stopEngine();
    this.hud.show(false);
    this.scene.remove(this.camera);
    this.track.dispose();
    this.particles.dispose();
    this.scene.traverse((o) => {
      if (o.geometry && !(o.geometry.userData && o.geometry.userData.cached)) o.geometry.dispose();
      if (o.material) {
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        for (const m of mats) {
          if (m.userData && m.userData.cached) continue;
          if (m.map && !(m.map.userData && m.map.userData.cached)) m.map.dispose();
          m.dispose();
        }
      }
    });
  }
}
