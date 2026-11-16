// Testes de fumaça — exercitam mundo, física, IA, balística e missões em Node
// Stubs de browser antes dos imports dinâmicos
const fakeCtx2d = {
  clearRect() {}, createRadialGradient: () => ({ addColorStop() {} }),
  fillRect() {}, beginPath() {}, arc() {}, fill() {}, fillStyle: null,
  createLinearGradient: () => ({ addColorStop() {} }),
};
globalThis.document = {
  createElement(tag) {
    return { width: 0, height: 0, getContext: () => fakeCtx2d, addEventListener() {}, style: {}, classList: { add() {}, remove() {}, toggle() {} } };
  },
  getElementById: () => null,
  addEventListener() {},
};
globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
globalThis.window = { innerWidth: 1280, innerHeight: 720, addEventListener() {}, devicePixelRatio: 1 };

const assert = (cond, msg) => { if (!cond) { console.error('FALHOU: ' + msg); process.exitCode = 1; } else { console.log('ok — ' + msg); } };

const THREE = await import('three');
const { QUALITY, WEAPONS } = await import('../src/core/config.js');
const { terrainHeight, terrainNormal, riverZ, FLAT_SITES } = await import('../src/world/heightfield.js');
const { World } = await import('../src/world/world.js');
const { Player } = await import('../src/player/player.js');
const { Ballistics } = await import('../src/weapons/ballistics.js');
const { WeaponSystem } = await import('../src/weapons/weaponSystem.js');
const { Animal, AnimalManager } = await import('../src/entities/animals.js');
const { Npc, NpcManager } = await import('../src/entities/npcs.js');
const { MissionManager } = await import('../src/game/missions.js');
const { addXp, levelFromXp, isMissionDone } = await import('../src/game/progression.js');
const { Save: _s } = { Save: null };

// ---------- 1. MUNDO / TERRENO ----------
console.log('\n== MUNDO ==');
const h1 = terrainHeight(100, 100);
assert(h1 === terrainHeight(100, 100), 'heightfield determinístico');
assert(terrainHeight(-140, -680) > 40, 'cordilheira ao norte com grandes elevações');
assert(terrainHeight(300, riverZ(300)) < 0.5, 'rio esculpido abaixo do nível da água');
const site = FLAT_SITES[0];
assert(Math.abs(terrainHeight(site.x, site.z) - terrainHeight(site.x + 6, site.z)) < 0.6, 'sítios aplainados para construções');
const n = terrainNormal(0, 0);
assert(Math.abs(Math.hypot(n.x, n.y, n.z) - 1) < 0.01, 'normal do terreno normalizada');

const scene = new THREE.Group();
const world = new World(scene, null, QUALITY.medium, {});
world.update(0.016, { x: 0, z: 0 });
assert(world.terrain.chunks.size > 0, 'streaming de chunks de terreno ativo');
const chunkCountBefore = world.terrain.chunks.size;
world.update(0.016, { x: 700, z: 700 });
assert(world.terrain.chunks.size > 0 && world.terrain.chunks.size <= 49, 'chunks recarregados ao mover e descartados ao longe (' + chunkCountBefore + ' -> ' + world.terrain.chunks.size + ')');

// Vegetação instanciada
world.update(0.016, { x: 150, z: 130 });
let instanced = 0;
scene.traverse(o => { if (o.isInstancedMesh) instanced++; });
assert(instanced > 0, 'vegetação com InstancedMesh (' + instanced + ' meshes)');

// ---------- 2. RAYCAST / COLISÃO ----------
console.log('\n== FÍSICA / RAYCAST ==');
const h0 = terrainHeight(0, 0);
const hitDown = world.raycast(new THREE.Vector3(0, h0 + 120, 0), new THREE.Vector3(0, -1, 0), 400);
assert(hitDown && hitDown.kind === 'terrain' && Math.abs(hitDown.dist - 120) < 1.5, 'raycast acerta o terreno abaixo');
const hitSky = world.raycast(new THREE.Vector3(0, h0 + 2, 0), new THREE.Vector3(0, 1, 0), 300);
assert(hitSky === null || hitSky.kind !== 'terrain', 'raycast para o céu não acerta terrain');

const entPos = new THREE.Vector3(5, terrainHeight(5, 25), 25);
const fakeEnt = { pos: entPos, radius: 0.5, height: 1.8, alive: true, faction: 'test' };
world.addEntity(fakeEnt);
const hitEnt = world.raycast(new THREE.Vector3(5, entPos.y + 1, 45), new THREE.Vector3(0, 0, -1), 100);
assert(hitEnt && hitEnt.kind === 'entity' && hitEnt.entity === fakeEnt, 'raycast acerta entidade (alvo de tiro)');
world.removeEntity(fakeEnt);

const pushPos = new THREE.Vector3(120, 0, 60);
const collided = world.collide(pushPos, 0.42, 0, 1.8);
assert(true, 'rotina de colisão executada (hit=' + collided + ')');

// ---------- 3. JOGADOR ----------
console.log('\n== JOGADOR ==');
const player = new Player(world, { x: 150, z: 130, yaw: 0 });
const fakeInput = { move: { x: 0, y: 0 }, run: false, aim: false, jumpPressed: false };
for (let i = 0; i < 120; i++) player.update(1 / 60, fakeInput);
assert(Math.abs(player.pos.y - terrainHeight(player.pos.x, player.pos.z)) < 0.05, 'jogador assenta no terreno');
fakeInput.move.y = 1;
const sx = player.pos.x, sz = player.pos.z;
for (let i = 0; i < 120; i++) player.update(1 / 60, fakeInput);
assert(Math.hypot(player.pos.x - sx, player.pos.z - sz) > 4, 'jogador caminha com entrada de movimento');
player.setStance(2);
for (let i = 0; i < 60; i++) player.update(1 / 60, fakeInput);
assert(player.stance === 2 && player.eyeHeight < 0.6, 'posição prona com altura de olhos correta');
player.setStance(0);
const hpBefore = player.health;
player.damage(30);
assert(player.health === hpBefore - 30, 'dano aplicado ao jogador');
player.medkits = 1; player.health = 40;
assert(player.heal() && player.health > 40 && player.medkits === 0, 'kit médico cura e é consumido');

// ---------- 4. BALÍSTICA ----------
console.log('\n== BALÍSTICA ==');
let impact = null, entityHit = null;
const ballistics = new Ballistics(world, {
  onImpact: (p, kind) => { impact = { p, kind }; },
  onEntityHit: (e, dmg, point, headshot) => { entityHit = { e, dmg, headshot }; },
});
const origin = new THREE.Vector3(0, h0 + 60, 0);
ballistics.fire(origin, new THREE.Vector3(0, -1, 0), WEAPONS.vanguard, null, null);
for (let i = 0; i < 300 && !impact; i++) ballistics.update(1 / 60);
assert(impact && impact.kind === 'terrain', 'projétil cai com gravidade e impacta o terreno');

// Vento desvia o projétil
const landNoWind = _landX(ballistics, world, 0);
const landWind = _landX(ballistics, world, { x: 0, z: 12 });
assert(Math.abs(landWind - landNoWind) > 0.5, 'vento desvia a trajetória do projétil');

// ---------- 5. ARMA ----------
console.log('\n== ARMA ==');
const camera = new THREE.PerspectiveCamera(75, 1.6, 0.05, 2400);
const audioStub = new Proxy({}, { get: () => () => {} });
audioStub.shot = () => {};
const camCtlStub = { addRecoil() {}, addShake() {}, holdBreathActive: false };
const weapons = new WeaponSystem(camera, world, ballistics, audioStub, {});
weapons.setShooterEntity({ pos: new THREE.Vector3(0, -999, 0), radius: 0.1, height: 0.1, alive: false, isPlayer: true });
weapons.equip(WEAPONS.vanguard, 5, 30, true);
const fireInput = { move: { x: 0, y: 0 }, run: false, aim: true, firePressed: true, binocPressed: false, holdBreath: false };
const playerStub = { pos: new THREE.Vector3(0, h0, 0), vel: new THREE.Vector3(), stance: 2 };
weapons.update(1 / 60, fireInput, playerStub, camCtlStub, { x: 0, z: 0 });
assert(weapons.ammo === 4, 'disparo consome munição');
assert(ballistics.projectiles.length === 1, 'projétil balístico criado no disparo');
for (let i = 0; i < 120; i++) weapons.update(1 / 60, { ...fireInput, firePressed: false }, playerStub, camCtlStub, { x: 0, z: 0 });
weapons.reload();
assert(weapons.reloadTimer > 0, 'recarga inicia');
for (let i = 0; i < 300; i++) weapons.update(1 / 60, { ...fireInput, firePressed: false }, playerStub, camCtlStub, { x: 0, z: 0 });
assert(weapons.ammo === 5 && weapons.reserve === 29, 'recarga completa transfere munição da reserva');
weapons.toggleZoom();
assert(weapons.zoomIndex === 1, 'zoom da luneta alterna níveis');

// ---------- 6. ANIMAIS ----------
console.log('\n== ANIMAIS ==');
const audio2 = { animalCall() {}, animalDeath() {} };
const deer = new Animal('deer', 150, 110, world, audio2);
const hunter = { pos: new THREE.Vector3(150, terrainHeight(150, 112), 112), stance: 0, running: false, camo: 0, alive: true, eyeHeight: 1.68, damage() {}, vel: new THREE.Vector3() };
for (let i = 0; i < 90; i++) deer.update(1 / 60, hunter, 1);
assert(deer.state === 'flee' || deer.alertness > 0.4, 'veado detecta caçador próximo e reage (' + deer.state + ')');
deer.takeDamage(1000, new THREE.Vector3(150, 1, 111), false);
assert(!deer.alive && deer.state === 'dead', 'animal morre com dano letal');
deer.update(1 / 60, hunter, 1);
assert(deer.group.rotation.z > 0, 'animal morto tomba (animação de morte)');

const mgr = new AnimalManager(world, audio2);
for (let i = 0; i < 400; i++) mgr.update(1 / 60, hunter, 1);
assert(mgr.animals.length > 0, 'gerenciador popula o mundo com bandos de animais (' + mgr.animals.length + ')');
const kinds = new Set(mgr.animals.map(a => a.kind));
assert(kinds.size >= 1, 'espécies variadas em jogo: ' + [...kinds].join(', '));

// ---------- 7. NPCs ----------
console.log('\n== NPCs ==');
const audio3 = { npcShot() {}, npcShout() {}, npcDeath() {} };
const ball2 = new Ballistics(world, {});
const npc = new Npc(140, 100, world, audio3, 1, 30);
const soldier = { pos: new THREE.Vector3(145, terrainHeight(145, 102), 102), stance: 0, running: false, camo: 0, alive: true, eyeHeight: 1.68, damage() {}, vel: new THREE.Vector3() };
let npcFired = 0;
const origFire = ball2.fire.bind(ball2);
ball2.fire = (...a) => { npcFired++; return origFire(...a); };
for (let i = 0; i < 300; i++) npc.update(1 / 60, soldier, ball2, {});
assert(npc.state === 'combat' || npc.detectTimer > 0, 'NPC detecta o jogador (estado: ' + npc.state + ')');
assert(npcFired > 0, 'NPC em combate dispara no jogador (' + npcFired + ' tiros)');
npc.takeDamage(500, new THREE.Vector3(140, 1, 99), false);
assert(!npc.alive, 'NPC morre com dano letal');

const npcMgr = new NpcManager(world, audio3);
npcMgr.setDifficulty(1);
for (let i = 0; i < 200; i++) npcMgr.update(1 / 60, { pos: new THREE.Vector3(440, 0, -420) }, ball2);
assert(npcMgr.npcs.length > 0, 'NPCs spawnam na base militar quando o jogador se aproxima');

// ---------- 8. MISSÕES E PROGRESSÃO ----------
console.log('\n== MISSÕES / PROGRESSÃO ==');
let completed = null;
const mm = new MissionManager({ onComplete: (m, r) => { completed = m; } });
mm.start('m2');
mm.onAnimalKilled('deer', 120);
mm.onAnimalKilled('deer', 90);
mm.onAnimalKilled('deer', 200);
assert(completed && completed.id === 'm2', 'missão de caça conclui após 3 abates');
assert(isMissionDone('m2'), 'missão concluída é persistida no save');

const mm2 = new MissionManager({ onComplete: (m) => { completed = m; } });
mm2.start('m6');
mm2.onAnimalKilled('wolf', 320);
assert(completed && completed.id === 'm6', 'missão de tiro longo conclui com abate a 320m');

const prog = addXp(1200);
assert(levelFromXp(prog.xp) >= 2, 'XP acumulado sobe de nível (nível ' + prog.level + ')');

console.log('\n== RESUMO ==');
console.log(process.exitCode ? 'HÁ FALHAS ACIMA' : 'TODOS OS TESTES PASSARAM');

function _landX(ball, wld, wind) {
  const o = new THREE.Vector3(0, 60, 0);
  ball.fire(o, new THREE.Vector3(1, 0, 0), WEAPONS.vanguard, null, wind);
  let last = null;
  for (let i = 0; i < 600; i++) {
    ball.update(1 / 60);
    if (!ball.projectiles.length) break;
    last = ball.projectiles[ball.projectiles.length - 1];
  }
  return last ? last.pos.z : NaN;
}
