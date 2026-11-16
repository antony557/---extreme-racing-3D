// Teste E2E — boota o JOGO INTEIRO (main.js) em Node com DOM/renderizador simulados
// e roda o loop de jogo real: menu → startGame → frames → tiro → pausa → campanha

// ---- Stubs de DOM ----
const elements = new Map();
function makeEl(id) {
  return {
    id, style: {}, value: '1', selected: false, className: '',
    textContent: '', innerHTML: '',
    classList: { add() {}, remove() {}, toggle() {} },
    children: [],
    appendChild(c) { this.children.push(c); return c; },
    remove() {},
    addEventListener() {},
    parentElement: { clientWidth: 420 },
    requestPointerLock() {},
    getContext: () => ({
      clearRect() {}, createRadialGradient: () => ({ addColorStop() {} }),
      fillRect() {}, beginPath() {}, arc() {}, fill() {}, fillStyle: null,
    }),
  };
}
globalThis.document = {
  createElement: () => makeEl('dyn'),
  getElementById: (id) => { if (!elements.has(id)) elements.set(id, makeEl(id)); return elements.get(id); },
  addEventListener() {},
  querySelectorAll: () => [],
  pointerLockElement: null,
  exitPointerLock() {},
};
const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, v),
  removeItem: (k) => store.delete(k),
};
globalThis.window = {
  innerWidth: 1280, innerHeight: 720, devicePixelRatio: 1,
  addEventListener() {}, AudioContext: undefined,
};
globalThis.requestAnimationFrame = () => 0; // loop controlado manualmente

// ---- Substitui o WebGLRenderer ANTES de importar main.js ----
// (exports ESM são congelados: aplica patch numa cópia temporária de node_modules/three)
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const here = path.dirname(fileURLToPath(import.meta.url));
const target = path.join(here, '..', 'node_modules', 'three', 'three.module.js');
const original = fs.readFileSync(path.join(here, '..', 'lib', 'three.module.js'), 'utf8');
let patched = original.replace(
  'class WebGLRenderer {',
  'class WebGLRenderer_Orig {'
).replace(
  'class WebGL1Renderer extends WebGLRenderer {}',
  'let WebGLRenderer = WebGLRenderer_Orig;\nexport function __installFakeRenderer(cls) { WebGLRenderer = cls; }\nclass WebGL1Renderer extends WebGLRenderer_Orig {}'
);
if (!patched.includes('__installFakeRenderer')) { console.error('FALHOU: patch do three falhou'); process.exit(1); }
fs.writeFileSync(target, patched);
try {
  const THREE = await import('three');
class FakeRenderer {
  constructor() { this.shadowMap = { enabled: false, type: 0, }; this.domElement = makeEl('canvas'); }
  setPixelRatio() {} setSize() {} render() {}
}
THREE.__installFakeRenderer(FakeRenderer);

const assert = (cond, msg) => {
  if (!cond) { console.error('FALHOU: ' + msg); process.exitCode = 1; }
  else { console.log('ok — ' + msg); }
};

// ---- Boot real do jogo ----
await import('../src/main.js');
const game = globalThis.window.__game;
assert(!!game, 'jogo boota sem erros (main.js executa até o fim)');
assert(game.state === 'menu', 'estado inicial: menu');

// Frames no menu (câmera cinematográfica + mundo)
game.clock.getDelta = () => 1 / 60;
for (let i = 0; i < 60; i++) game._loop();
assert(Number.isFinite(game.world.sky.sun.intensity), 'intensidade do sol finita no menu (sem NaN de clima)');
assert(game.world.terrain.chunks.size > 0, 'mundo carregado no menu');

// ---- Entra no modo caça livre ----
game.startGame('hunt', null);
assert(game.state === 'playing', 'CAÇA LIVRE entra em jogo (state=playing)');
assert(game.weapons.ammo === 5 && game.weapons.reserve === 30, 'rifle equipado com munição correta');

// 600 frames de gameplay (10s simulados)
for (let i = 0; i < 600; i++) game._loop();
assert(game.state === 'playing', '600 frames de gameplay sem crash');
assert(Number.isFinite(game.world.sky.sun.intensity) && Number.isFinite(game.world.sky.hemi.intensity), 'luzes finitas durante o jogo');
assert(Number.isFinite(game.camera.position.x + game.camera.position.y + game.camera.position.z), 'câmera em posição válida');
assert(game.world.terrain.chunks.size > 0, 'streaming de terreno ativo em jogo');

// Movimento
const x0 = game.player.pos.x;
game.input.move.x = 1;
for (let i = 0; i < 120; i++) game._loop();
game.input.move.x = 0;
assert(Math.abs(game.player.pos.x - x0) > 0.5, 'jogador se move com entrada do joystick/teclado');

// Disparo
game.input.firePressed = true;
game._loop();
assert(game.weapons.ammo === 4, 'botão de tiro dispara (munição 5→4)');

// Mira e zoom
game.input.aim = true;
game._loop();
assert(game.weapons.mode === 'aim', 'botão MIRAR ativa a luneta');
game.input.zoomPressed = true;
game._loop();
assert(game.weapons.zoomIndex === 1, 'botão ZOOM alterna ampliação');
game.input.aim = false;
game._loop();

// Posturas
game.input.pronePressed = true;
game._loop();
assert(game.player.stanceTarget === 2, 'botão DEITAR muda para prona');
game.input.pronePressed = true;
game._loop();

// Pausa e retorno
game.pause();
assert(game.state === 'paused', 'pausa funciona');
game.resume();
assert(game.state === 'playing', 'continuar funciona');

// ---- Campanha ----
game.startGame('campaign', 'm2');
assert(game.state === 'playing' && game.missionMgr.active && game.missionMgr.active.id === 'm2', 'CAMPANHA inicia missão selecionada');
for (let i = 0; i < 120; i++) game._loop();
assert(game.state === 'playing', 'frames de campanha sem crash');

// Morte e respawn
game.player.damage(1000);
game._loop();
assert(game.state === 'dead', 'morte leva à tela de morte');
game.respawn();
assert(game.state === 'playing' && game.player.alive, 'respawn volta ao jogo com vida cheia');

// Sair para o menu e reentrar
game.quitToMenu();
assert(game.state === 'menu', 'sair para o menu funciona');
game.startGame('hunt', null);
assert(game.state === 'playing', 'reentrar no jogo após sair funciona');
for (let i = 0; i < 120; i++) game._loop();

// Autosave gravou algo
assert(store.has('elite-sniper-save-v1'), 'autosave persistiu dados');

console.log('\n== RESUMO E2E ==');
console.log(process.exitCode ? 'HÁ FALHAS ACIMA' : 'BOOT COMPLETO DO JOGO: TODOS OS TESTES PASSARAM');
} finally {
  fs.writeFileSync(target, original);
}
