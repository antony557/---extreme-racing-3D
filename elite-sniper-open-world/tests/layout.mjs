// Teste de layout mobile — prova geométrica de que nenhum botão sobrepõe
// outro, todos cabem na tela e nenhum cobre a zona do analógico.
// Executado em duas resoluções reais de Android em paisagem.
import { MOBILE_LAYOUT, JOYSTICK } from '../src/ui/mobileLayout.js';

const VIEWPORTS = [
  { name: 'Android pequeno (780×360)', w: 780, h: 360 },
  { name: 'Android grande (915×412)', w: 915, h: 412 },
  { name: 'Tablet (1280×720)', w: 1280, h: 720 },
];

let fails = 0;
const assert = (cond, msg) => {
  if (!cond) { console.error('FALHOU: ' + msg); fails++; }
  else console.log('ok — ' + msg);
};

const toPx = (r, vw, vh) => ({
  x1: (r.x / 100) * vw, y1: (r.y / 100) * vh,
  x2: ((r.x + r.w) / 100) * vw, y2: ((r.y + r.h) / 100) * vh,
});
const overlap = (a, b) => a.x1 < b.x2 && b.x1 < a.x2 && a.y1 < b.y2 && b.y1 < a.y2;
const circleRect = (cx, cy, r, rc) => {
  const nx = Math.max(rc.x1, Math.min(cx, rc.x2));
  const ny = Math.max(rc.y1, Math.min(cy, rc.y2));
  return Math.hypot(cx - nx, cy - ny) < r;
};

for (const vp of VIEWPORTS) {
  const { w, h, name } = vp;
  const rects = Object.fromEntries(
    Object.entries(MOBILE_LAYOUT).map(([id, r]) => [id, toPx(r, w, h)])
  );

  const ids = Object.keys(rects);
  let pairs = 0, bad = 0;
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      pairs++;
      if (overlap(rects[ids[i]], rects[ids[j]])) {
        bad++;
        console.error(`  sobreposição: ${ids[i]} × ${ids[j]} em ${name}`);
      }
    }
  }
  assert(bad === 0, `${name}: nenhum dos ${pairs} pares de botões se sobrepõe`);

  assert(
    Object.entries(rects).every(([, r]) => r.x1 >= 0 && r.y1 >= 0 && r.x2 <= w && r.y2 <= h),
    `${name}: todos os botões dentro da tela`
  );

  const jcx = (JOYSTICK.cx / 100) * w, jcy = (JOYSTICK.cy / 100) * h;
  const overJoy = ids.filter((id) => circleRect(jcx, jcy, JOYSTICK.rPx + 6, rects[id]));
  assert(overJoy.length === 0, `${name}: nenhum botão cobre o analógico${overJoy.length ? ' :: ' + overJoy.join(',') : ''}`);

  const rightSide = ['btn-fire', 'btn-aim', 'btn-reload', 'btn-zoom', 'btn-crouch', 'btn-prone', 'btn-jump', 'btn-binoc'];
  assert(
    rightSide.every((id) => rects[id].x1 > w * 0.55),
    `${name}: ações de combate todas no lado direito`
  );
}

console.log(fails ? `\nHÁ ${fails} FALHAS DE LAYOUT` : '\nLAYOUT MOBILE: TODOS OS TESTES PASSARAM');
process.exitCode = fails ? 1 : 0;
