// Layout dos controles mobile — fonte única de verdade (posições em % da tela,
// referência 800×360 paisagem). Também usado pelos testes para provar que
// nenhum botão sobrepõe outro nem cobre o analógico.
//
// ESQUERDA: apenas o analógico (canto inferior esquerdo) + CORRER acima dele.
// DIREITA: tiro, mira, recarga, zoom, agachar, deitar, pular, binóculo, usar, kit.

export const JOYSTICK = { cx: 13.75, cy: 79, rPx: 62, zoneX: 0.26, zoneY: 0.52 };

export const MOBILE_LAYOUT = {
  'btn-run':       { x: 3,    y: 44.4, w: 8,   h: 11.1 },
  'btn-fire':      { x: 86,   y: 67.8, w: 12,  h: 26.7 },
  'btn-aim':       { x: 74.5, y: 70,   w: 9.5, h: 21.1 },
  'btn-reload':    { x: 87.5, y: 48.9, w: 7.5, h: 16.7 },
  'btn-zoom':      { x: 78.5, y: 50.6, w: 7,   h: 16.7 },
  'btn-crouch':    { x: 70,   y: 52.8, w: 7,   h: 15.6 },
  'btn-prone':     { x: 62,   y: 58.3, w: 7,   h: 15.6 },
  'btn-jump':      { x: 87.5, y: 30,   w: 7,   h: 15.6 },
  'btn-binoc':     { x: 77.5, y: 32.2, w: 7,   h: 15.6 },
  'btn-interact':  { x: 68,   y: 35.6, w: 6.5, h: 14.4 },
  'btn-med':       { x: 13.5, y: 44.4, w: 6.5, h: 11.1 },
  'btn-inventory': { x: 90,   y: 12.2, w: 8,   h: 10 },
  'btn-pause':     { x: 81,   y: 12.2, w: 8,   h: 10 },
};

export function applyMobileLayout() {
  for (const [id, r] of Object.entries(MOBILE_LAYOUT)) {
    const el = document.getElementById(id);
    if (!el) continue;
    el.style.position = 'absolute';
    el.style.left = r.x + '%';
    el.style.top = r.y + '%';
    el.style.width = r.w + '%';
    el.style.height = r.h + '%';
    el.style.minWidth = '0';
    el.style.minHeight = '0';
    el.style.borderRadius = '14px';
    el.style.fontSize = '10px';
  }
  const hint = document.getElementById('joystick-hint');
  if (hint) {
    hint.style.position = 'absolute';
    hint.style.left = (JOYSTICK.cx - JOYSTICK.rPx / 8) + '%';
    hint.style.top = (JOYSTICK.cy - (JOYSTICK.rPx / 360) * 100) + '%';
    hint.style.width = ((JOYSTICK.rPx * 2) / 800) * 100 + '%';
    hint.style.aspectRatio = '1 / 1';
    hint.style.height = 'auto';
  }
}
