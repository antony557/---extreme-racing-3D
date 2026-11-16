import { Track, TRACKS } from '../js/tracks.js';
import { CarPhysics } from '../js/physics.js';
import { AIController } from '../js/ai.js';
import { CAR_SPECS, buildCarMesh, setBrakeLights } from '../js/cars.js';
import { DIFFICULTY } from '../js/config.js';
import { clamp, mulberry32 } from '../js/utils.js';

function ctxStub() {
  return new Proxy({}, {
    get: (t, p) => {
      if (p === 'createLinearGradient' || p === 'createRadialGradient') return () => ({ addColorStop: () => {} });
      if (typeof p === 'string') return () => {};
      return undefined;
    },
    set: () => true,
  });
}
function canvasStub() {
  return { width: 0, height: 0, style: {}, getContext: () => ctxStub() };
}
global.document = { createElement: () => canvasStub() };

let failures = 0;
function check(name, cond, extra = '') {
  if (cond) console.log(`  PASS ${name} ${extra}`);
  else { console.log(`  FAIL ${name} ${extra}`); failures++; }
}

const QUALITY = { shadows: false, props: 0.5, particles: 0.4, shadowSize: 512, spotlights: false };

console.log('== Pistas ==');
for (const def of TRACKS) {
  const track = new Track(def, QUALITY, undefined);
  const s0 = track.nearest(track.samples[0].pos, 0);
  check(`${def.id}: nearest no centro`, s0.index >= 0 && Math.abs(s0.lateral) < 0.5, `(lat=${s0.lateral.toFixed(2)})`);
  const spawn = track.spawn(6);
  check(`${def.id}: spawn 6 carros`, spawn.length === 6);
  const near = track.nearest(spawn[0].pos, 0);
  check(`${def.id}: spawn sobre a pista`, Math.abs(near.lateral) < 3.5, `(lat=${near.lateral.toFixed(2)})`);
  const ahead = track.sampleAhead(near.s, 50);
  check(`${def.id}: sampleAhead`, isFinite(ahead.pos.x) && isFinite(ahead.pos.z));
  const curv = track.curvatureAhead(near.s, 60);
  check(`${def.id}: curvatura`, curv > 0, `(curv=${curv.toFixed(4)})`);
  const mm = track.toMinimap(spawn[0].pos.x, spawn[0].pos.z);
  check(`${def.id}: minimap`, mm.every((v) => isFinite(v)));
}

console.log('== Física: acelerar, frear, virar, drift ==');
function makeFollower(phys, track) {
  let reverseUntil = 0, now = 0;
  return function follower(throttle, steerBias = 0, handbrake = false) {
    now++;
    if (now < reverseUntil) return { throttle: 0, brake: 1, steer: 0.4, handbrake: false, nitro: false };
    if (phys.stuckTime > 2) { reverseUntil = now + 90; return { throttle: 0, brake: 1, steer: 0.4, handbrake: false, nitro: false }; }
    const info = phys.trackInfo;
    const ahead = track.sampleAhead(info.s, 12 + Math.abs(phys.forwardSpeed) * 0.6);
    const desired = Math.atan2(ahead.pos.x - phys.pos.x, ahead.pos.z - phys.pos.z);
    let diff = desired - phys.heading;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    return { throttle, brake: 0, steer: clamp(diff * 2.2 + steerBias, -1, 1), handbrake, nitro: false };
  };
}
const track = new Track(TRACKS[0], QUALITY, undefined);
const spec = CAR_SPECS[5];
const phys = new CarPhysics(spec, { engine: 0, tires: 0, nitro: 0 }, { isPlayer: true });
phys.setTrack(track);
const spawn = track.spawn(1);
phys.placeAt(spawn[0].pos, spawn[0].heading);
const dt = 1 / 60;
const follower = makeFollower(phys, track);
let vmax = 0, maxStuck = 0;
for (let i = 0; i < 60 * 40; i++) {
  phys.update(dt, follower(1));
  vmax = Math.max(vmax, phys.speedKmh);
  maxStuck = Math.max(maxStuck, phys.stuckTime);
}
check('acelera acima de 100 km/h', vmax > 100, `(vmax=${vmax.toFixed(1)})`);
check('não ultrapassa top speed', vmax <= spec.topSpeed + 1, `(top=${spec.topSpeed})`);
check('dirigindo sem ficar preso', maxStuck < 3, `(stuck=${maxStuck.toFixed(2)})`);
let minBrakeV = Infinity, reachedReverse = false;
for (let i = 0; i < 60 * 4; i++) {
  phys.update(dt, { throttle: 0, brake: 1, steer: 0, handbrake: false, nitro: false });
  minBrakeV = Math.min(minBrakeV, phys.speedKmh);
  if (phys.forwardSpeed < -0.5) reachedReverse = true;
}
check('freia até quase parar', minBrakeV < 5, `(minV=${minBrakeV.toFixed(1)})`);
check('freio parado engata ré (S = ré)', reachedReverse, `(v=${phys.speedKmh.toFixed(1)})`);

const headingBefore = phys.heading;
const sp2 = track.spawn(1);
phys.placeAt(sp2[0].pos, sp2[0].heading);
for (let i = 0; i < 60 * 6; i++) phys.update(dt, follower(0.7));
if (phys.speedKmh < 20) { for (let i = 0; i < 60 * 5; i++) phys.update(dt, follower(1)); }
const headingBeforeTurn = phys.heading;
for (let i = 0; i < 60 * 2; i++) phys.update(dt, { throttle: 0.5, brake: 0, steer: 1, handbrake: false, nitro: false });
const turned = ((phys.heading - headingBeforeTurn + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
check('vira à esquerda (ângulo positivo)', turned > 0.4, `(dθ=${turned.toFixed(2)}, v=${phys.speedKmh.toFixed(0)})`);

for (let i = 0; i < 60 * 8; i++) phys.update(dt, follower(1));
for (let i = 0; i < 60 * 12 && phys.speedKmh < 60; i++) phys.update(dt, follower(1));
check('velocidade suficiente para drift', phys.speedKmh > 60, `(v=${phys.speedKmh.toFixed(0)})`);
for (let i = 0; i < 60 * 2; i++) phys.update(dt, { throttle: 1, brake: 0, steer: 0.7, handbrake: true, nitro: false });
check('freio de mão provoca derrapagem', Math.abs(phys.lateralSpeed) > 2 || phys.drifting, `(lat=${phys.lateralSpeed.toFixed(2)}, skid=${phys.skidLevel.toFixed(2)})`);

console.log('== IA segue o percurso ==');
for (const diff of [{ speed: 0.92, grip: 0.95 }]) {
  const aiSpec = CAR_SPECS[4];
  const car = new CarPhysics(aiSpec, { engine: 2, tires: 1, nitro: 0 }, {});
  car.setTrack(track);
  const sp = track.spawn(2);
  car.placeAt(sp[1].pos, sp[1].heading);
  const ai = new AIController(car, diff, track, 1);
  let maxLateral = 0, progressOk = true, prevProgress = 0, collisions = 0;
  for (let i = 0; i < 60 * 60; i++) {
    const ctl = ai.update(dt, [car]);
    car.update(dt, ctl);
    maxLateral = Math.max(maxLateral, Math.abs(car.trackInfo.lateral));
    if (i % 600 === 0 && car.trackInfo.s <= prevProgress + 1 && i > 0) progressOk = false;
    prevProgress = car.trackInfo.s;
    collisions += car.consumeEvents().length;
  }
  check('IA percorre o traçado (progresso avança)', car.trackInfo.s > 10 || prevProgress > 10, `(s=${car.trackInfo.s.toFixed(0)}m)`);
  check('IA não sai da pista', maxLateral < track.halfWidth + track.shoulder, `(maxLat=${maxLateral.toFixed(1)}, limite=${(track.halfWidth + track.shoulder).toFixed(1)})`);
  check('IA sem colisões na pista limpa', collisions === 0, `(hits=${collisions})`);
}

console.log('== Voltas: corrida completa da IA em todas as pistas ==');
for (const def of TRACKS) {
  const trk = new Track(def, QUALITY, undefined);
  const car = new CarPhysics(CAR_SPECS[7], { engine: 3, tires: 2, nitro: 0 }, {});
  car.setTrack(trk);
  const sp = trk.spawn(1);
  car.placeAt(sp[0].pos, sp[0].heading);
  const ai = new AIController(car, { speed: 0.92, grip: 0.95 }, trk, 0);
  let laps = 0, prevS = car.trackInfo.s, halfFlag = false;
  const L = trk.length;
  for (let i = 0; i < 60 * 400 && laps < 3; i++) {
    car.update(1 / 60, ai.update(1 / 60, [car]));
    const s = car.trackInfo.s;
    const raw = s - prevS;
    prevS = s;
    if (s > L * 0.45 && s < L * 0.55) halfFlag = true;
    if (raw < -L * 0.5 && halfFlag) { halfFlag = false; laps++; }
  }
  check(`${def.id}: IA completa 3 voltas`, laps === 3, `(laps=${laps})`);
}

console.log('== Mesh do carro ==');
{
  const mesh = buildCarMesh(CAR_SPECS[8], { color: '#ff0000', wheel: 2 });
  const wheels = mesh.userData.wheels;
  check('carro tem 4 rodas', wheels.length === 4);
  check('2 rodas dianteiras', wheels.filter((w) => w.front).length === 2);
  check('paint material presente', !!mesh.userData.paint);
  check('lanternas de freio presentes', mesh.userData.brakeMats.length >= 1);
  const before = mesh.userData.brakeMats[0].emissiveIntensity;
  setBrakeLights(mesh, true);
  const on = mesh.userData.brakeMats[0].emissiveIntensity;
  setBrakeLights(mesh, false);
  const off = mesh.userData.brakeMats[0].emissiveIntensity;
  check('luz de freio acende/apaga', on > before && off < on, `(on=${on.toFixed(1)}, off=${off.toFixed(1)})`);

  let meshes = 0, tris = 0;
  mesh.traverse((o) => {
    if (o.isMesh) {
      meshes++;
      const g = o.geometry;
      tris += (g.index ? g.index.count : g.attributes.position.count) / 3;
    }
  });
  check('carro compacto (<= 20 malhas)', meshes <= 20, `(malhas=${meshes})`);
  check('carroceria com curvatura (muitos v\u00e9rtices)', tris > 3000, `(tris=${Math.round(tris)})`);

  const specs = new Set();
  for (const spec of CAR_SPECS) {
    const m = buildCarMesh(spec, { color: '#00ff00', wheel: 0 });
    const pts = [];
    m.traverse((o) => { if (o.isMesh && o.geometry.attributes.position) pts.push(o.geometry.attributes.position.count); });
    specs.add(spec.id + ':' + pts.join(','));
  }
  check('12 carros com silhuetas distintas', specs.size === CAR_SPECS.length, `(unicos=${specs.size}/${CAR_SPECS.length})`);
}

console.log('== Partículas instanciadas ==');
{
  const { ParticleSystem } = await import('../js/particles.js');
  const added = [];
  const fakeScene = { add: (o) => added.push(o), remove: (o) => { const i = added.indexOf(o); if (i >= 0) added.splice(i, 1); } };
  const ps = new ParticleSystem(fakeScene, { particles: 1 });
  check('partículas: 1 malha de billboards + 1 de skids', added.length === 2, `(objetos=${added.length})`);
  for (let i = 0; i < 500; i++) ps.smoke(i * 0.1, 0.3, i * 0.2);
  for (let i = 0; i < 60; i++) ps.update(1 / 60);
  check('pool de partículas limitado', ps.count <= ps.max, `(count=${ps.count}, max=${ps.max})`);
  check('instanceCount acompanha pool', ps.billGeo.instanceCount === ps.count);
  for (let i = 0; i < 500; i++) ps.skidMark(i * 0.3, 0, 0, 0.5);
  check('skids: ring buffer limitado', ps.skidMesh.count <= ps.skidMax, `(count=${ps.skidMesh.count}, max=${ps.skidMax})`);
  ps.sparks(0, 0, 0, 12);
  ps.nitro(0, 0, 0);
  ps.dust(0, 0, 0);
  ps.update(1 / 60);
  ps.dispose();
  check('dispose sem erro e remove da cena', added.length === 0);
}

console.log('== Auditoria das pistas ==');
for (const def of TRACKS) {
  const tr = new Track(def, QUALITY, undefined);
  let maxMedianRatio = 0;
  const gaps = [];
  for (let i = 0; i < tr.sampleCount; i++) {
    const a = tr.samples[i].pos, b = tr.samples[(i + 1) % tr.sampleCount].pos;
    gaps.push(Math.hypot(b.x - a.x, b.z - a.z));
  }
  const sorted = [...gaps].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  for (const g of gaps) maxMedianRatio = Math.max(maxMedianRatio, g / Math.max(median, 1e-6));
  check(`${def.id}: sem buracos/descontinuidade no asfalto`, maxMedianRatio < 3, `(max/mediana=${maxMedianRatio.toFixed(2)})`);
  let worstLat = -Infinity;
  for (const c of tr.colliders) {
    let bestD = Infinity, bestI = 0;
    for (let i = 0; i < tr.sampleCount; i++) {
      const p = tr.samples[i].pos;
      const d = (p.x - c.x) ** 2 + (p.z - c.z) ** 2;
      if (d < bestD) { bestD = d; bestI = i; }
    }
    const sm = tr.samples[bestI];
    const nx = -sm.tan.z, nz = sm.tan.x;
    const lat = Math.abs((c.x - sm.pos.x) * nx + (c.z - sm.pos.z) * nz);
    worstLat = Math.max(worstLat, tr.halfWidth - (lat - c.r));
  }
  check(`${def.id}: nenhum obstáculo sólido dentro da pista`, worstLat <= 0.2, `(invasão=${worstLat.toFixed(2)}m)`);
}

console.log('== Corridas progressivas com NPCs ==');
{
  const raceDefs = [TRACKS[0], TRACKS[4]];
  for (const npcCount of [1, 2, 4, 6, 7]) {
    for (const def of raceDefs) {
      const tr = new Track(def, QUALITY, undefined);
      const spawns = tr.spawn(npcCount + 1);
      const rng = mulberry32(def.seed + npcCount);
      const entries = [];
      for (let i = 0; i <= npcCount; i++) {
        const sp = CAR_SPECS[Math.floor(rng() * CAR_SPECS.length)];
        const p = new CarPhysics(sp, { engine: 0, tires: 0, nitro: 0 }, { isPlayer: i === 0 });
        p.setTrack(tr);
        p.placeAt(spawns[i].pos, spawns[i].heading);
        entries.push({ physics: p, ai: i === 0 ? null : new AIController(p, DIFFICULTY.medium, tr, i) });
      }
      const playerFollower = makeFollower(entries[0].physics, tr);
      const L = tr.length;
      let laps = 0, prevS = entries[0].physics.trackInfo.s, halfFlag = false;
      let maxStepMs = 0, nan = false;
      const maxFrames = 60 * 420;
      let f = 0;
      for (; f < maxFrames && laps < 3; f++) {
        const t0 = process.hrtime.bigint();
        const pctl = playerFollower(1);
        for (const e of entries) {
          const ctl = e.ai ? e.ai.update(dt, entries.map((x) => x.physics)) : pctl;
          e.physics.update(dt, ctl);
        }
        for (let i = 0; i < entries.length; i++) {
          for (let j = i + 1; j < entries.length; j++) entries[i].physics.applyCarCollision(entries[j].physics);
        }
        const ms = Number(process.hrtime.bigint() - t0) / 1e6;
        if (ms > maxStepMs) maxStepMs = ms;
        const s = entries[0].physics.trackInfo.s;
        const raw = s - prevS;
        prevS = s;
        if (s > L * 0.45 && s < L * 0.55) halfFlag = true;
        if (raw < -L * 0.5 && halfFlag) { halfFlag = false; laps++; }
        for (const e of entries) {
          if (!Number.isFinite(e.physics.pos.x + e.physics.pos.z)) nan = true;
        }
      }
      const minProgress = Math.min(...entries.map((e) => e.physics.distanceTraveled || 0));
      check(`${def.id} com ${npcCount} NPC(s): corrida completa sem congelar`, laps === 3, `(voltas=${laps}, frames=${f})`);
      check(`${def.id} com ${npcCount} NPC(s): sem posições NaN`, !nan);
      check(`${def.id} com ${npcCount} NPC(s): todos avançaram`, minProgress > 50, `(min=${Math.round(minProgress)}m)`);
      check(`${def.id} com ${npcCount} NPC(s): passo de simulação rápido`, maxStepMs < 12, `(pico=${maxStepMs.toFixed(2)}ms)`);
    }
  }
}

console.log(failures === 0 ? '\nTODOS OS TESTES PASSARAM' : `\n${failures} TESTES FALHARAM`);
process.exit(failures === 0 ? 0 : 1);
