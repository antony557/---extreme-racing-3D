import { readFileSync, writeFileSync } from 'node:fs';

const CDN = 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.min.js';
const ORDER = [
  'utils', 'config', 'audio', 'input', 'save', 'cars', 'tracks',
  'physics', 'ai', 'camera', 'particles', 'hud', 'ui', 'garage', 'race', 'game', 'main',
];

function moduleSource(name) {
  let src = readFileSync(new URL(`./js/${name}.js`, import.meta.url), 'utf8');
  src = src.replace(/^import[\s\S]*?from\s*['"][^'"]+['"];[ \t]*$/gm, '');
  src = src.replace(/^import\s*['"][^'"]+['"];[ \t]*$/gm, '');
  src = src.replace(/^export(?=\s+(?:const|let|var|class|function|async))/gm, '');
  return src.trim();
}

const body = `import * as THREE from '${CDN}';\n\n` + ORDER.map(moduleSource).join('\n\n') + '\n';

const jsTmp = writeFileSync(new URL('./.bundle-check.mjs', import.meta.url), body);
const html = readFileSync(new URL('./index.html', import.meta.url), 'utf8');
const css = readFileSync(new URL('./css/style.css', import.meta.url), 'utf8');

let out = html.replace('<link rel="stylesheet" href="css/style.css">', `<style>\n${css}\n</style>`);
out = out.replace(/<script type="importmap">[\s\S]*?<\/script>\s*/, '');
out = out.replace('<script type="module" src="js/main.js"></script>', `<script type="module">\n${body}</script>`);

if (out === html || out.includes('css/style.css') || out.includes('js/main.js')) {
  throw new Error('substituicao falhou');
}
writeFileSync(new URL('./EXTREME-RACING-3D.html', import.meta.url), out);
console.log('OK', out.length, 'bytes');
