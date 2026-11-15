import * as THREE from './vendor/three.module.min.js';
import { WHEEL_STYLES } from './config.js';

export const CAR_SPECS = [
  { id: 'compacto', name: 'Compacto FX', cls: 'Hatch', price: 0, topSpeed: 165, accel: 11.5, mass: 1050, grip: 0.95, drift: 0.35, nitroCap: 2.2, wheelbase: 2.5,
    body: { len: 3.8, wid: 1.68, noseH: 0.52, hoodH: 0.72, roofH: 1.32, tailH: 0.95, cabinF: 0.42, cabinR: 0.86, spoiler: 0, scoop: false, style: 'hatch' } },
  { id: 'prisma', name: 'Sedã Prisma', cls: 'Sedã', price: 3500, topSpeed: 185, accel: 9.8, mass: 1250, grip: 1.0, drift: 0.3, nitroCap: 2.4, wheelbase: 2.7,
    body: { len: 4.5, wid: 1.76, noseH: 0.5, hoodH: 0.7, roofH: 1.34, tailH: 0.92, cabinF: 0.35, cabinR: 0.78, spoiler: 0, scoop: false, style: 'sedan' } },
  { id: 'titan', name: 'SUV Titan', cls: 'SUV', price: 6000, topSpeed: 175, accel: 10.5, mass: 1750, grip: 0.88, drift: 0.25, nitroCap: 2.2, wheelbase: 2.85,
    body: { len: 4.6, wid: 1.9, noseH: 0.72, hoodH: 1.0, roofH: 1.72, tailH: 1.5, cabinF: 0.34, cabinR: 0.8, spoiler: 0, scoop: false, style: 'suv' } },
  { id: 'bravado', name: 'Muscle Bravado', cls: 'Muscle', price: 9000, topSpeed: 225, accel: 6.8, mass: 1500, grip: 1.02, drift: 0.75, nitroCap: 2.8, wheelbase: 2.85,
    body: { len: 4.9, wid: 1.92, noseH: 0.58, hoodH: 0.78, roofH: 1.28, tailH: 1.0, cabinF: 0.4, cabinR: 0.72, spoiler: 0.1, scoop: true, style: 'muscle' } },
  { id: 'terra', name: 'Rally Terra', cls: 'Rally', price: 12000, topSpeed: 195, accel: 7.2, mass: 1300, grip: 1.08, drift: 0.85, nitroCap: 2.6, wheelbase: 2.6,
    body: { len: 4.2, wid: 1.78, noseH: 0.6, hoodH: 0.8, roofH: 1.42, tailH: 1.1, cabinF: 0.4, cabinR: 0.8, spoiler: 0.22, scoop: true, style: 'rally' } },
  { id: 'zephyr', name: 'Cupê Zephyr', cls: 'Cupê', price: 16000, topSpeed: 240, accel: 6.0, mass: 1350, grip: 1.1, drift: 0.5, nitroCap: 3.0, wheelbase: 2.7,
    body: { len: 4.5, wid: 1.84, noseH: 0.46, hoodH: 0.66, roofH: 1.22, tailH: 0.88, cabinF: 0.44, cabinR: 0.8, spoiler: 0.12, scoop: false, style: 'coupe' } },
  { id: 'kaze', name: 'Drifter Kaze', cls: 'Drift', price: 21000, topSpeed: 230, accel: 6.2, mass: 1280, grip: 0.98, drift: 1.0, nitroCap: 3.2, wheelbase: 2.65,
    body: { len: 4.4, wid: 1.82, noseH: 0.5, hoodH: 0.68, roofH: 1.26, tailH: 0.94, cabinF: 0.42, cabinR: 0.78, spoiler: 0.3, scoop: false, style: 'coupe' } },
  { id: 'vento', name: 'Esportivo Vento', cls: 'Esportivo', price: 28000, topSpeed: 265, accel: 5.0, mass: 1380, grip: 1.18, drift: 0.45, nitroCap: 3.4, wheelbase: 2.65,
    body: { len: 4.4, wid: 1.9, noseH: 0.4, hoodH: 0.6, roofH: 1.16, tailH: 0.84, cabinF: 0.46, cabinR: 0.82, spoiler: 0.18, scoop: false, style: 'sport' } },
  { id: 'aurora', name: 'GT Aurora', cls: 'GT', price: 38000, topSpeed: 285, accel: 4.4, mass: 1450, grip: 1.22, drift: 0.4, nitroCap: 3.6, wheelbase: 2.75,
    body: { len: 4.7, wid: 1.94, noseH: 0.42, hoodH: 0.62, roofH: 1.2, tailH: 0.86, cabinF: 0.44, cabinR: 0.8, spoiler: 0.22, scoop: true, style: 'gt' } },
  { id: 'vultur', name: 'Super Vultur', cls: 'Super', price: 55000, topSpeed: 310, accel: 3.6, mass: 1420, grip: 1.3, drift: 0.5, nitroCap: 3.8, wheelbase: 2.7,
    body: { len: 4.5, wid: 1.98, noseH: 0.34, hoodH: 0.52, roofH: 1.1, tailH: 0.8, cabinF: 0.5, cabinR: 0.86, spoiler: 0.26, scoop: false, style: 'super' } },
  { id: 'nyx', name: 'Hiper Nyx', cls: 'Hiper', price: 85000, topSpeed: 340, accel: 3.0, mass: 1380, grip: 1.36, drift: 0.55, nitroCap: 4.2, wheelbase: 2.72,
    body: { len: 4.6, wid: 2.02, noseH: 0.3, hoodH: 0.48, roofH: 1.06, tailH: 0.78, cabinF: 0.52, cabinR: 0.88, spoiler: 0.3, scoop: false, style: 'hyper' } },
  { id: 'apex', name: 'Protótipo Apex', cls: 'Protótipo', price: 140000, topSpeed: 365, accel: 2.6, mass: 1250, grip: 1.45, drift: 0.6, nitroCap: 4.5, wheelbase: 2.8,
    body: { len: 4.8, wid: 2.0, noseH: 0.28, hoodH: 0.44, roofH: 1.02, tailH: 0.72, cabinF: 0.54, cabinR: 0.9, spoiler: 0.4, scoop: false, style: 'proto' } },
];

export function getSpec(id) { return CAR_SPECS.find((c) => c.id === id) || CAR_SPECS[0]; }

const glassMat = () => new THREE.MeshPhysicalMaterial({
  color: 0x0c1420, metalness: 0.1, roughness: 0.05, transparent: true, opacity: 0.55,
  envMapIntensity: 1.6, clearcoat: 1, clearcoatRoughness: 0.05,
});
const trimMat = () => new THREE.MeshStandardMaterial({ color: 0x14161a, metalness: 0.5, roughness: 0.5 });
const chromeMat = () => new THREE.MeshStandardMaterial({ color: 0xdfe4ea, metalness: 1, roughness: 0.12, envMapIntensity: 1.4 });
const tireMat = () => new THREE.MeshStandardMaterial({ color: 0x121316, metalness: 0, roughness: 0.92 });
const lightMat = (color, intensity) => new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: intensity, metalness: 0.2, roughness: 0.2 });
const carbonMat = () => new THREE.MeshStandardMaterial({ color: 0x0d0f13, metalness: 0.6, roughness: 0.35 });

function bodyProfile(b) {
  const L = b.len, hN = b.noseH, hH = b.hoodH, hR = b.roofH, hT = b.tailH;
  const cf = b.cabinF * L, cr = b.cabinR * L;
  return [
    [-L / 2 + 0.04, 0.16],
    [-L / 2 + 0.02, hT * 0.55],
    [-L / 2 + 0.1, hT],
    [-L / 2 + cr, hT],
    [-L / 2 + cr + (hR - hT) * 1.4, hR],
    [-L / 2 + cf, hR],
    [-L / 2 + cf - 0.55, hH],
    [-L / 2 + 0.45, hH * 0.96],
    [-L / 2 + 0.06, hN],
    [-L / 2 + 0.02, 0.2],
  ];
}

function extrudeProfile(pts, width, bevel) {
  const shape = new THREE.Shape();
  shape.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) shape.lineTo(pts[i][0], pts[i][1]);
  shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: width - bevel * 2, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 3, curveSegments: 4,
  });
  geo.translate(0, 0, -(width - bevel * 2) / 2);
  geo.computeVertexNormals();
  return geo;
}

function buildWheel(styleIdx, radius, width) {
  const style = WHEEL_STYLES[styleIdx % WHEEL_STYLES.length];
  const g = new THREE.Group();
  const tire = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, width, 22), tireMat());
  tire.rotation.x = Math.PI / 2;
  g.add(tire);
  const rimR = radius * 0.62;
  const rimMaterial = new THREE.MeshStandardMaterial({ color: style.rimColor, metalness: 0.9, roughness: 0.25, envMapIntensity: 1.3 });
  const rim = new THREE.Mesh(new THREE.CylinderGeometry(rimR, rimR, width * 0.55, 18), rimMaterial);
  rim.rotation.x = Math.PI / 2;
  g.add(rim);
  const spokeGeo = new THREE.BoxGeometry(rimR * 0.28, rimR * 1.85, width * 0.5);
  for (let i = 0; i < style.spokes; i++) {
    const s = new THREE.Mesh(spokeGeo, rimMaterial);
    s.rotation.z = (i / style.spokes) * Math.PI * 2;
    g.add(s);
  }
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(rimR * 0.22, rimR * 0.22, width * 0.62, 10), chromeMat());
  cap.rotation.x = Math.PI / 2;
  g.add(cap);
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(rimR * 0.72, rimR * 0.72, width * 0.2, 16), new THREE.MeshStandardMaterial({ color: 0x3a3f46, metalness: 0.8, roughness: 0.4 }));
  disc.rotation.x = Math.PI / 2;
  g.add(disc);
  return g;
}

export function buildCarMesh(spec, opts = {}) {
  const b = spec.body;
  const group = new THREE.Group();
  const bodyGroup = new THREE.Group();
  const model = new THREE.Group();
  model.rotation.y = -Math.PI / 2;
  model.add(bodyGroup);
  group.add(model);

  const paint = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(opts.color || '#c8102e'), metalness: 0.72, roughness: 0.22,
    clearcoat: 1, clearcoatRoughness: 0.06, envMapIntensity: 1.5,
  });
  const glass = glassMat();
  const trim = trimMat();

  const bevel = Math.min(0.09, b.wid * 0.045);
  const shell = new THREE.Mesh(extrudeProfile(bodyProfile(b), b.wid, bevel), paint);
  shell.castShadow = true;
  bodyGroup.add(shell);

  const cabLen = (b.cabinR - b.cabinF) * b.len - 0.3;
  const cabH = b.roofH - b.hoodH + 0.06;
  const cabX = -b.len / 2 + (b.cabinF + b.cabinR) / 2 * b.len;
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(cabLen, cabH, b.wid * 0.82), glass);
  cabin.position.set(cabX, b.hoodH + cabH / 2 - 0.03, 0);
  cabin.castShadow = true;
  bodyGroup.add(cabin);
  const roof = new THREE.Mesh(new THREE.BoxGeometry(cabLen * 0.98, 0.06, b.wid * 0.84), paint);
  roof.position.set(cabX, b.hoodH + cabH - 0.01, 0);
  bodyGroup.add(roof);
  const frame = new THREE.Mesh(new THREE.BoxGeometry(cabLen + 0.16, cabH * 0.28, b.wid * 0.9), trim);
  frame.position.set(cabX, b.hoodH + cabH * 0.16, 0);
  bodyGroup.add(frame);

  const nose = new THREE.Mesh(new THREE.BoxGeometry(0.3, b.noseH * 0.8, b.wid * 0.94), trim);
  nose.position.set(b.len / 2 - 0.08, b.noseH * 0.45, 0);
  bodyGroup.add(nose);
  const diffuser = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.22, b.wid * 0.9), carbonMat());
  diffuser.position.set(-b.len / 2 + 0.1, 0.18, 0);
  bodyGroup.add(diffuser);

  const skirtGeo = new THREE.BoxGeometry(b.len * 0.5, 0.1, 0.06);
  for (const s of [-1, 1]) {
    const skirt = new THREE.Mesh(skirtGeo, carbonMat());
    skirt.position.set(0, 0.14, s * (b.wid / 2 - 0.02));
    bodyGroup.add(skirt);
  }

  const headMat = lightMat(0xfff6d8, 1.6);
  const headlights = [];
  const brakeMats = [];
  for (const s of [-1, 1]) {
    const hl = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.12, b.wid * 0.26), headMat);
    hl.position.set(b.len / 2 - 0.16, b.noseH * 0.72, s * b.wid * 0.3);
    bodyGroup.add(hl);
    headlights.push(hl);
    const tailMat = lightMat(0xff2222, 0.9);
    const tl = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.11, b.wid * 0.3), tailMat);
    tl.position.set(-b.len / 2 + 0.06, b.tailH * 0.7, s * b.wid * 0.3);
    bodyGroup.add(tl);
    brakeMats.push(tailMat);
  }

  const grille = new THREE.Mesh(new THREE.BoxGeometry(0.06, b.noseH * 0.4, b.wid * 0.4), carbonMat());
  grille.position.set(b.len / 2 - 0.02, b.noseH * 0.5, 0);
  bodyGroup.add(grille);

  for (const s of [-1, 1]) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.07, 0.16), trim);
    m.position.set(-b.len / 2 + b.cabinF * b.len - 0.1, b.roofH - 0.1, s * (b.wid / 2 + 0.08));
    bodyGroup.add(m);
  }

  if (b.spoiler > 0) {
    const wing = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.05, b.wid * 0.88), b.style === 'proto' ? carbonMat() : paint);
    wing.position.set(-b.len / 2 + 0.24, b.tailH + b.spoiler, 0);
    wing.rotation.z = 0.12;
    bodyGroup.add(wing);
    for (const s of [-1, 1]) {
      const stand = new THREE.Mesh(new THREE.BoxGeometry(0.06, b.spoiler, 0.05), carbonMat());
      stand.position.set(-b.len / 2 + 0.24, b.tailH + b.spoiler / 2, s * b.wid * 0.32);
      bodyGroup.add(stand);
    }
  }
  if (b.scoop) {
    const scoop = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.09, b.wid * 0.3), paint);
    scoop.position.set(-b.len / 2 + b.cabinF * b.len - 0.9, b.hoodH + 0.05, 0);
    bodyGroup.add(scoop);
  }

  for (const s of [-1, 1]) {
    const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.14, 10), chromeMat());
    pipe.rotation.z = Math.PI / 2;
    pipe.position.set(-b.len / 2 - 0.02, 0.24, s * b.wid * 0.22);
    bodyGroup.add(pipe);
  }

  const plateM = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.12, 0.36), new THREE.MeshStandardMaterial({ color: 0xe8e8e8, roughness: 0.6 }));
  plateM.position.set(b.len / 2 + 0.01, b.noseH * 0.4, 0);
  bodyGroup.add(plateM);

  const wheelRadius = b.style === 'suv' || b.style === 'rally' ? 0.38 : b.style === 'proto' || b.style === 'hyper' ? 0.36 : 0.34;
  const wheelWidth = b.style === 'suv' || b.style === 'rally' ? 0.28 : 0.24;
  const wheels = [];
  const axleF = b.len / 2 - 0.78;
  const axleR = -b.len / 2 + 0.82;
  const zs = b.wid / 2 - wheelWidth / 2 + 0.02;
  for (const [x, z, front] of [[axleF, zs, true], [axleF, -zs, true], [axleR, zs, false], [axleR, -zs, false]]) {
    const w = buildWheel(opts.wheel || 0, wheelRadius, wheelWidth);
    const holder = new THREE.Group();
    holder.position.set(x, wheelRadius, z);
    holder.add(w);
    model.add(holder);
    wheels.push({ holder, spin: w, front, radius: wheelRadius });
  }

  const blob = new THREE.Mesh(new THREE.CircleGeometry(b.len * 0.42, 20), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.28, depthWrite: false }));
  blob.rotation.x = -Math.PI / 2;
  blob.position.y = 0.02;
  blob.name = 'blobShadow';
  model.add(blob);

  group.userData = {
    spec, wheels, paint, headlights, brakeMats,
    dims: { len: b.len, wid: b.wid, wheelRadius },
    bodyGroup,
  };
  return group;
}

export function setCarColor(mesh, colorStr) {
  mesh.userData.paint.color.set(colorStr);
}

export function setBrakeLights(mesh, on) {
  for (const m of mesh.userData.brakeMats) m.emissiveIntensity = on ? 3.2 : 0.9;
}
