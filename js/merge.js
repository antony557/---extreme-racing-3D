import * as THREE from './vendor/three.module.min.js';

export function mergeGeoms(items) {
  let vCount = 0, iCount = 0;
  for (const it of items) {
    const g = it.geo.index ? it.geo : it.geo.toNonIndexed();
    it._g = g;
    vCount += g.attributes.position.count;
    iCount += g.index ? g.index.count : g.attributes.position.count;
  }
  const pos = new Float32Array(vCount * 3);
  const nor = new Float32Array(vCount * 3);
  const uv = new Float32Array(vCount * 2);
  const col = items.some((it) => it.color) ? new Float32Array(vCount * 3) : null;
  const idx = new Uint32Array(iCount);
  let vo = 0, io = 0;
  const nm = new THREE.Matrix3();
  for (const it of items) {
    const g = it._g;
    const p = g.attributes.position, n = g.attributes.normal, u = g.attributes.uv;
    const m = it.matrix || null;
    if (m) nm.getNormalMatrix(m);
    const e = m ? m.elements : null, ne = m ? nm.elements : null;
    const c = it.color;
    for (let i = 0; i < p.count; i++) {
      let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      if (e) {
        const nx0 = n ? n.getX(i) : 0, ny0 = n ? n.getY(i) : 0, nz0 = n ? n.getZ(i) : 0;
        const px = e[0] * x + e[4] * y + e[8] * z + e[12];
        const py = e[1] * x + e[5] * y + e[9] * z + e[13];
        const pz = e[2] * x + e[6] * y + e[10] * z + e[14];
        x = px; y = py; z = pz;
        if (n) {
          const tx = ne[0] * nx0 + ne[3] * ny0 + ne[6] * nz0;
          const ty = ne[1] * nx0 + ne[4] * ny0 + ne[7] * nz0;
          const tz = ne[2] * nx0 + ne[5] * ny0 + ne[8] * nz0;
          nor[vo * 3] = tx; nor[vo * 3 + 1] = ty; nor[vo * 3 + 2] = tz;
        }
      } else if (n) {
        nor[vo * 3] = n.getX(i); nor[vo * 3 + 1] = n.getY(i); nor[vo * 3 + 2] = n.getZ(i);
      }
      pos[vo * 3] = x; pos[vo * 3 + 1] = y; pos[vo * 3 + 2] = z;
      if (u) { uv[vo * 2] = u.getX(i); uv[vo * 2 + 1] = u.getY(i); }
      if (col && c) { col[vo * 3] = c[0]; col[vo * 3 + 1] = c[1]; col[vo * 3 + 2] = c[2]; }
      vo++;
    }
    if (g.index) {
      const gi = g.index;
      for (let i = 0; i < gi.count; i++) idx[io++] = gi.getX(i) + vo - p.count;
    } else {
      for (let i = 0; i < p.count; i++) idx[io++] = vo - p.count + i;
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  if (col) geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.setIndex(new THREE.BufferAttribute(idx, 1));
  return geo;
}

export function boxGeo(w, h, d, x = 0, y = 0, z = 0, ry = 0, rz = 0) {
  const g = new THREE.BoxGeometry(w, h, d);
  if (rz) g.rotateZ(rz);
  if (ry) g.rotateY(ry);
  g.translate(x, y, z);
  return g;
}

export function cylGeo(rt, rb, h, seg, x = 0, y = 0, z = 0, rx = 0, rz = 0) {
  const g = new THREE.CylinderGeometry(rt, rb, h, seg);
  if (rx) g.rotateX(rx);
  if (rz) g.rotateZ(rz);
  g.translate(x, y, z);
  return g;
}
