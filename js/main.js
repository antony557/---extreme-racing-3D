import { Game } from './game.js';

const fill = document.getElementById('loading-fill');
const text = document.getElementById('loading-text');
let progress = 0;

const steps = [
  ['Iniciando motor gráfico...', 20],
  ['Construindo veículos...', 45],
  ['Preparando pistas...', 70],
  ['Calibrando física...', 90],
  ['Pronto!', 100],
];
let stepIdx = 0;

const timer = setInterval(() => {
  if (stepIdx >= steps.length) {
    clearInterval(timer);
    finish();
    return;
  }
  const [label, pct] = steps[stepIdx++];
  text.textContent = label;
  progress = pct;
  fill.style.width = pct + '%';
}, 220);

function finish() {
  setTimeout(() => {
    try {
      window.game = new Game();
      document.getElementById('screen-loading').classList.remove('active');
    } catch (err) {
      text.textContent = 'Erro ao iniciar: ' + err.message;
      console.error(err);
    }
  }, 250);
}
