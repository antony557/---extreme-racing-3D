// Água — plano gigante com shader de ondas, fresnel e cor do céu
import * as THREE from 'three';
import { WORLD } from '../core/config.js';

const VERT = `
varying vec3 vWorld;
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorld = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}`;

const FRAG = `
uniform vec3 uSky;
uniform vec3 uDeep;
uniform vec3 uSunDir;
uniform float uTime;
varying vec3 vWorld;

float wave(vec2 p) {
  return sin(p.x * 0.35 + uTime * 1.1) * 0.5
       + sin(p.y * 0.28 - uTime * 0.9) * 0.5
       + sin((p.x + p.y) * 0.6 + uTime * 1.7) * 0.25;
}

void main() {
  vec2 p = vWorld.xz;
  float e = 0.6;
  float h  = wave(p);
  float hx = wave(p + vec2(e, 0.0));
  float hz = wave(p + vec2(0.0, e));
  vec3 n = normalize(vec3(h - hx, 2.5, h - hz));
  vec3 viewDir = normalize(cameraPosition - vWorld);
  float fres = pow(1.0 - max(dot(viewDir, n), 0.0), 3.0);
  vec3 col = mix(uDeep, uSky, clamp(fres * 1.2 + 0.15, 0.0, 1.0));
  vec3 sun = normalize(uSunDir);
  float spec = pow(max(dot(reflect(-sun, n), viewDir), 0.0), 90.0);
  col += vec3(1.0, 0.95, 0.8) * spec * 1.4;
  gl_FragColor = vec4(col, 0.88);
}`;

export class Water {
  constructor(scene) {
    this.uniforms = {
      uSky: { value: new THREE.Color(0x9fc4e0) },
      uDeep: { value: new THREE.Color(0x0d3547) },
      uSunDir: { value: new THREE.Vector3(0, 1, 0) },
      uTime: { value: 0 },
    };
    const mat = new THREE.ShaderMaterial({
      uniforms: this.uniforms, vertexShader: VERT, fragmentShader: FRAG,
      transparent: true,
    });
    const geo = new THREE.PlaneGeometry(WORLD.SIZE * 1.5, WORLD.SIZE * 1.5, 1, 1);
    geo.rotateX(-Math.PI / 2);
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.position.y = WORLD.WATER_LEVEL;
    this.mesh.frustumCulled = false;
    scene.add(this.mesh);
  }

  update(px, pz, time, sunDir, skyColor) {
    this.mesh.position.x = Math.round(px / 20) * 20;
    this.mesh.position.z = Math.round(pz / 20) * 20;
    this.uniforms.uTime.value = time;
    this.uniforms.uSunDir.value.copy(sunDir);
    this.uniforms.uSky.value.copy(skyColor);
  }
}
