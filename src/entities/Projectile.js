import { centeredBox } from '../combat/HitboxSystem.js';

let nextId = 1;

/** Pooled projectile; `spec` comes from a move's `projectile` config. x/y are the center. */
export class Projectile {
  init(owner, spec, kind) {
    this.id = nextId++;
    this.owner = owner.index;
    this.spec = spec;
    this.kind = kind;
    this.facing = owner.facing;
    this.x = owner.x + owner.facing * (spec.offsetX || 0);
    this.y = spec.offsetY || 0;
    this.vx = owner.facing * spec.speed;
    this.life = spec.life || 240;
    this.hitsLeft = spec.hits || 1;
    this.priority = spec.priority || 1;
    this.cooldown = 0;
    this.dead = false;
    return this;
  }

  update(stageWidth) {
    if (this.cooldown > 0) this.cooldown--;
    this.x += this.vx;
    const margin = this.spec.w;
    if (--this.life <= 0 || this.x < -margin || this.x > stageWidth + margin) this.dead = true;
  }

  get canHit() {
    return !this.dead && this.cooldown === 0;
  }

  /** Consumes one hit; multi-hit projectiles wait `hitInterval` ticks between hits. */
  spendHit() {
    this.hitsLeft--;
    this.cooldown = this.spec.hitInterval || 0;
    if (this.hitsLeft <= 0) this.dead = true;
  }

  box(out) {
    return centeredBox(this.x, this.y, this.spec.w, this.spec.h, out);
  }
}
