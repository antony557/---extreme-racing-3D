// Balística virtual — projéteis com gravidade, vento, tempo de voo e impactos
import * as THREE from 'three';
import { PLAYER } from '../core/config.js';

const GRAVITY = 9.81;
const MAX_PROJECTILES = 40;

export class Ballistics {
  constructor(world, hooks = {}) {
    this.world = world;
    this.hooks = hooks; // { onImpact(point, kind, entity, dir), onEntityHit(entity, dmg, point, headshot) }
    this.projectiles = [];
    this.pool = [];
    this.scene = world.scene;

    // Tracers reutilizados
    const geo = new THREE.CylinderGeometry(0.012, 0.012, 1, 4);
    geo.rotateX(Math.PI / 2);
    this.tracerGeo = geo;
    this.tracerMat = new THREE.MeshBasicMaterial({ color: 0xffd9a0, transparent: true, opacity: 0.75, depthWrite: false });
  }

  fire(origin, dir, weapon, shooterEntity, wind) {
    if (this.projectiles.length >= MAX_PROJECTILES) return;
    const vel = dir.clone().multiplyScalar(weapon.muzzleVelocity);
    const tracer = new THREE.Mesh(this.tracerGeo, this.tracerMat);
    tracer.frustumCulled = false;
    this.scene.add(tracer);
    this.projectiles.push({
      pos: origin.clone(), vel, prev: origin.clone(),
      weapon, shooter: shooterEntity, tracer, life: 6, dist: 0,
      wind,
    });
  }

  update(dt) {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.prev.copy(p.pos);
      p.vel.y -= GRAVITY * dt;
      p.vel.x += (p.wind ? p.wind.x : 0) * dt * 0.6;
      p.vel.z += (p.wind ? p.wind.z : 0) * dt * 0.6;
      const step = p.vel.length() * dt;
      const dir = _d1.copy(p.vel).normalize();
      const hit = this.world.raycast(p.pos, dir, step, p.shooter);
      p.pos.addScaledVector(dir, step);
      p.dist += step;
      p.life -= dt;

      // tracer orienta e escala
      p.tracer.position.copy(p.pos);
      p.tracer.lookAt(_d2.copy(p.pos).add(dir));
      const tl = Math.min(step * 2.2, 14);
      p.tracer.scale.set(1, 1, tl);

      if (hit) {
        this._impact(p, hit, dir);
        this._kill(i);
        continue;
      }
      if (p.life <= 0 || p.pos.y < -30 || p.dist > 3000) {
        this._kill(i);
      }
    }
  }

  _impact(p, hit, dir) {
    if (hit.kind === 'entity' && hit.entity) {
      const e = hit.entity;
      const speed = p.vel.length();
      const falloff = Math.min(1, 0.45 + 0.55 * (speed / p.weapon.muzzleVelocity));
      let dmg = p.weapon.damage * falloff;
      const hitY = hit.point.y - e.pos.y;
      const headshot = hitY > e.height * 0.82;
      if (headshot) dmg *= 2.5;
      if (this.hooks.onEntityHit) this.hooks.onEntityHit(e, dmg, hit.point, headshot, dir);
    } else if (this.hooks.onImpact) {
      this.hooks.onImpact(hit.point, hit.kind, dir);
    }
    if (this.hooks.onImpactSound) this.hooks.onImpactSound(hit.point, hit.kind);
  }

  _kill(i) {
    const p = this.projectiles[i];
    this.scene.remove(p.tracer);
    this.projectiles.splice(i, 1);
  }

  dispose() {
    for (const p of this.projectiles) this.scene.remove(p.tracer);
    this.projectiles.length = 0;
  }
}

const _d1 = new THREE.Vector3();
const _d2 = new THREE.Vector3();
