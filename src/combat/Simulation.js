import { Fighter } from '../entities/Fighter.js';
import { Projectile } from '../entities/Projectile.js';
import { resolveCombat } from './CombatSystem.js';

export const DEFAULT_STAGE_WIDTH = 1920;
/** Fighters must stay fully on one camera-width screen. */
export const DEFAULT_MAX_SEPARATION = 1100;
/** Above this height pushboxes are ignored, so fighters can jump over each other. */
const AIR_PUSH_HEIGHT = 60;

/**
 * Deterministic 60 Hz simulation of two fighters, independent of rendering.
 * `events` holds what happened during the last step (hits, blocks, KOs...).
 */
export class Simulation {
  constructor({ characters, startPositions, stageWidth = DEFAULT_STAGE_WIDTH, maxSeparation = DEFAULT_MAX_SEPARATION }) {
    this.stageWidth = stageWidth;
    this.maxSeparation = maxSeparation;
    this.startPositions = startPositions || [stageWidth / 2 - 170, stageWidth / 2 + 170];
    this.fighters = characters.map((def, i) => new Fighter(def, i));
    this.projectiles = [];
    this.pool = [];
    this.events = [];
    this.freeze = 0;
    this.frame = 0;
    this.combatEnabled = true;
    this.resetRound();
  }

  resetRound() {
    const [x1, x2] = this.startPositions;
    this.fighters[0].reset(x1, 1);
    this.fighters[1].reset(x2, -1);
    this.clearProjectiles();
    this.freeze = 0;
    this.combatEnabled = true;
  }

  clearProjectiles() {
    for (const p of this.projectiles) this.pool.push(p);
    this.projectiles.length = 0;
  }

  get isFrozen() {
    return this.freeze > 0;
  }

  emit(event) {
    this.events.push(event);
  }

  freezeFor(frames) {
    this.freeze = Math.max(this.freeze, frames);
  }

  hasProjectile(owner) {
    return this.projectiles.some((p) => p.owner === owner && !p.dead);
  }

  spawnProjectile(fighter, spec, kind) {
    const p = (this.pool.pop() || new Projectile()).init(fighter, spec, kind);
    this.projectiles.push(p);
    this.emit({ type: 'projectile', fighter: fighter.index, kind, x: p.x, y: p.y });
  }

  minX(f) {
    return f.halfWidth;
  }

  maxX(f) {
    return this.stageWidth - f.halfWidth;
  }

  /** True if `f` is pressed against the arena edge in direction `dir`. */
  atWall(f, dir) {
    return dir > 0 ? f.x >= this.maxX(f) - 1 : f.x <= this.minX(f) + 1;
  }

  step(input1, input2) {
    this.events.length = 0;
    const [a, b] = this.fighters;
    a.readInput(input1);
    b.readInput(input2);
    if (this.freeze > 0) {
      this.freeze--;
      return;
    }
    this.frame++;

    for (const p of this.projectiles) p.update(this.stageWidth);
    a.tick(b, this);
    b.tick(a, this);

    a.integrate(a.def.stats.gravity);
    b.integrate(b.def.stats.gravity);
    this.separateBodies();
    this.limitSeparation();
    this.clampToArena(a);
    this.clampToArena(b);

    if (this.combatEnabled) resolveCombat(this);

    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      if (p.dead) {
        this.projectiles.splice(i, 1);
        this.pool.push(p);
      }
    }
    a.endTick();
    b.endTick();
  }

  separateBodies() {
    const [a, b] = this.fighters;
    if (a.y > AIR_PUSH_HEIGHT || b.y > AIR_PUSH_HEIGHT) return;
    let left = a;
    let right = b;
    if (a.x > b.x || (a.x === b.x && a.prevX > b.prevX)) {
      left = b;
      right = a;
    }
    const overlap = left.halfWidth + right.halfWidth - (right.x - left.x);
    if (overlap <= 0) return;
    const leftRoom = Math.max(0, left.x - this.minX(left));
    const rightRoom = Math.max(0, this.maxX(right) - right.x);
    let lm = overlap / 2;
    let rm = overlap / 2;
    if (lm > leftRoom) {
      rm += lm - leftRoom;
      lm = leftRoom;
    }
    if (rm > rightRoom) {
      lm = Math.min(leftRoom, lm + rm - rightRoom);
      rm = rightRoom;
    }
    left.x -= lm;
    right.x += rm;
  }

  /** Whoever moved outward this tick gives the ground back so both stay on screen. */
  limitSeparation() {
    const [a, b] = this.fighters;
    const [left, right] = a.x <= b.x ? [a, b] : [b, a];
    const excess = right.x - left.x - this.maxSeparation;
    if (excess <= 0) return;
    const lo = Math.max(0, left.prevX - left.x);
    const ro = Math.max(0, right.x - right.prevX);
    const total = lo + ro;
    if (total > 0) {
      left.x += (excess * lo) / total;
      right.x -= (excess * ro) / total;
    } else {
      left.x += excess / 2;
      right.x -= excess / 2;
    }
  }

  clampToArena(f) {
    if (f.x < this.minX(f)) f.x = this.minX(f);
    else if (f.x > this.maxX(f)) f.x = this.maxX(f);
  }
}
