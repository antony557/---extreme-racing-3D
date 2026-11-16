// Rifles de precisão — modelos 3D procedurais detalhados com peças animáveis
import * as THREE from 'three';

const M = {
  gunmetal: new THREE.MeshStandardMaterial({ color: 0x2e3236, roughness: 0.38, metalness: 0.85 }),
  black: new THREE.MeshStandardMaterial({ color: 0x1a1c1e, roughness: 0.55, metalness: 0.4 }),
  polymer: new THREE.MeshStandardMaterial({ color: 0x2c2e28, roughness: 0.8, metalness: 0.1 }),
  wood: new THREE.MeshStandardMaterial({ color: 0x5d4326, roughness: 0.65, metalness: 0.05 }),
  lens: new THREE.MeshStandardMaterial({ color: 0x1b2f4a, roughness: 0.1, metalness: 0.6, emissive: 0x0a1a30 }),
  brass: new THREE.MeshStandardMaterial({ color: 0xb08d3e, roughness: 0.35, metalness: 0.9 }),
};

function mesh(geo, mat, x, y, z, rx = 0, ry = 0, rz = 0) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.rotation.set(rx, ry, rz);
  return m;
}

// Eixos: -Z é a direção do cano (frente da câmera)
export function buildRifle(def) {
  const g = new THREE.Group();
  const big = def.id === 'longshadow';
  const woodStock = def.id === 'nomad';

  // Corpo / receiver
  g.add(mesh(new THREE.BoxGeometry(0.062, 0.085, 0.62), M.gunmetal, 0, 0, -0.12));
  // Trilho superior
  g.add(mesh(new THREE.BoxGeometry(0.03, 0.016, 0.5), M.black, 0, 0.052, -0.18));
  // Cano
  const barrelLen = big ? 0.85 : 0.72;
  g.add(mesh(new THREE.CylinderGeometry(big ? 0.021 : 0.016, big ? 0.024 : 0.018, barrelLen, 10), M.gunmetal, 0, 0.01, -0.42 - barrelLen / 2, Math.PI / 2));
  // Freio de boca
  g.add(mesh(new THREE.CylinderGeometry(0.03, 0.028, 0.1, 10), M.black, 0, 0.01, -0.44 - barrelLen, Math.PI / 2));
  // Coronha
  const stockMat = woodStock ? M.wood : M.polymer;
  const stock = mesh(new THREE.BoxGeometry(0.055, 0.13, 0.34), stockMat, 0, -0.012, 0.3);
  g.add(stock);
  g.add(mesh(new THREE.BoxGeometry(0.05, 0.05, 0.16), stockMat, 0, 0.045, 0.16)); // pescoço
  g.add(mesh(new THREE.BoxGeometry(0.055, 0.035, 0.2), stockMat, 0, 0.062, 0.28)); // apoio de bochecha
  g.add(mesh(new THREE.BoxGeometry(0.07, 0.16, 0.04), M.polymer, 0, -0.03, 0.46)); // soleira
  // Pistola de empunhadura
  g.add(mesh(new THREE.BoxGeometry(0.042, 0.13, 0.05), M.polymer, 0, -0.09, 0.06, 0.35));
  // Gatilho e guarda-mato
  g.add(mesh(new THREE.BoxGeometry(0.012, 0.035, 0.012), M.brass, 0, -0.055, -0.02, 0.2));
  g.add(mesh(new THREE.TorusGeometry(0.035, 0.006, 6, 12, Math.PI), M.black, 0, -0.055, -0.02, 0, 0, Math.PI));
  // Carregador
  const magGroup = new THREE.Group();
  magGroup.add(mesh(new THREE.BoxGeometry(0.045, big ? 0.16 : 0.11, 0.09), M.black, 0, 0, 0));
  magGroup.position.set(0, -0.085, -0.06);
  magGroup.rotation.x = -0.12;
  magGroup.name = 'magazine';
  g.add(magGroup);
  // Ferrolho (animável)
  const boltGroup = new THREE.Group();
  boltGroup.add(mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.09, 8), M.gunmetal, 0, 0, 0, Math.PI / 2));
  const knob = mesh(new THREE.SphereGeometry(0.016, 8, 8), M.gunmetal, 0.035, -0.02, 0.06);
  boltGroup.add(knob);
  boltGroup.add(mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.05, 6), M.gunmetal, 0.02, -0.01, 0.03, 0, 0, 1.1));
  boltGroup.position.set(0.02, 0.03, 0.05);
  boltGroup.name = 'bolt';
  g.add(boltGroup);
  // Luneta
  const scopeGroup = new THREE.Group();
  const scopeLen = big ? 0.4 : 0.34;
  scopeGroup.add(mesh(new THREE.CylinderGeometry(0.017, 0.017, scopeLen, 12), M.black, 0, 0, 0, Math.PI / 2));
  scopeGroup.add(mesh(new THREE.CylinderGeometry(0.026, 0.017, 0.06, 12), M.black, 0, 0, -scopeLen / 2 - 0.028, Math.PI / 2));
  scopeGroup.add(mesh(new THREE.CylinderGeometry(0.021, 0.017, 0.05, 12), M.black, 0, 0, scopeLen / 2 + 0.024, Math.PI / 2));
  scopeGroup.add(mesh(new THREE.CircleGeometry(0.024, 12), M.lens, 0, 0, -scopeLen / 2 - 0.059, 0, 0, 0));
  scopeGroup.add(mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.024, 8), M.black, 0, 0.026, 0));
  scopeGroup.add(mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.024, 8), M.black, 0.026, 0, 0, 0, 0, Math.PI / 2));
  // montagens
  scopeGroup.add(mesh(new THREE.BoxGeometry(0.014, 0.03, 0.02), M.black, 0, -0.024, -0.08));
  scopeGroup.add(mesh(new THREE.BoxGeometry(0.014, 0.03, 0.02), M.black, 0, -0.024, 0.08));
  scopeGroup.position.set(0, 0.105, -0.16);
  scopeGroup.name = 'scope';
  g.add(scopeGroup);
  // Bipé (dobrado por padrão)
  const bipod = new THREE.Group();
  for (const side of [-1, 1]) {
    const leg = mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.3, 6), M.black, side * 0.02, -0.12, -0.62, 0.35 * side, 0, side * 0.5);
    leg.name = 'leg' + (side < 0 ? 'L' : 'R');
    bipod.add(leg);
  }
  bipod.name = 'bipod';
  g.add(bipod);
  // Correia
  g.add(mesh(new THREE.BoxGeometry(0.012, 0.004, 0.5), M.woodDark || M.polymer, 0.045, -0.02, 0.05));

  g.traverse(o => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; o.frustumCulled = false; } });
  g.scale.setScalar(1.0);
  return g;
}

export function buildBinoculars() {
  const g = new THREE.Group();
  for (const side of [-1, 1]) {
    g.add(mesh(new THREE.CylinderGeometry(0.026, 0.03, 0.16, 10), M.black, side * 0.035, 0, -0.05, Math.PI / 2));
    g.add(mesh(new THREE.CylinderGeometry(0.022, 0.026, 0.05, 10), M.gunmetal, side * 0.035, 0, 0.06, Math.PI / 2));
  }
  g.add(mesh(new THREE.BoxGeometry(0.05, 0.02, 0.08), M.black, 0, -0.03, 0.0));
  g.traverse(o => { if (o.isMesh) o.frustumCulled = false; });
  g.visible = false;
  return g;
}

export function makeMuzzleFlash() {
  const tex = flashTexture();
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
  const s = new THREE.Sprite(mat);
  s.scale.setScalar(0.5);
  return s;
}

function flashTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(32, 32, 2, 32, 32, 30);
  g.addColorStop(0, 'rgba(255,240,180,1)');
  g.addColorStop(0.4, 'rgba(255,170,60,0.8)');
  g.addColorStop(1, 'rgba(255,120,20,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}
