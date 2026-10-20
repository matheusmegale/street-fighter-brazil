import { Simulation } from '../src/combat/Simulation.js';

const box = (x, y, w, h) => ({ x, y, w, h });

/**
 * Minimal character config with round, easy-to-reason-about frame data.
 * Units: px and ticks (60/s). `knockback` is the defender's initial slide speed in px/tick,
 * decaying by 0.5 px/tick (knockback 2 slides 5 px). Pushboxes are ignored while a
 * fighter is high in the air, which is what allows jumping over an opponent.
 */
export function makeCharacter(overrides = {}) {
  const base = {
    id: 'test',
    name: 'Test',
    stats: {
      health: 1000,
      walkSpeed: 4,
      backSpeed: 3,
      jumpVelocity: 20,
      jumpForward: 5,
      gravity: 1,
    },
    body: { width: 80 },
    hurtboxes: {
      stand: [box(-40, 0, 80, 280)],
      crouch: [box(-40, 0, 80, 190)],
      air: [box(-40, 40, 80, 220)],
    },
    moves: {
      lp: { startup: 3, active: 2, recovery: 6, damage: 40, hitstun: 16, blockstun: 10, knockback: 2, hitbox: box(30, 180, 50, 30), level: 'mid', meterGain: 25, hitstop: 0 },
      hp: { startup: 6, active: 3, recovery: 12, damage: 90, hitstun: 20, blockstun: 14, knockback: 4, hitbox: box(30, 180, 80, 30), level: 'mid', meterGain: 25, hitstop: 0 },
      lk: { startup: 4, active: 3, recovery: 8, damage: 50, hitstun: 16, blockstun: 10, knockback: 2, hitbox: box(30, 120, 70, 30), level: 'mid', meterGain: 25, hitstop: 0 },
      hk: { startup: 20, active: 3, recovery: 14, damage: 100, hitstun: 22, blockstun: 16, knockback: 4, hitbox: box(30, 150, 90, 40), level: 'mid', meterGain: 25, hitstop: 0 },
      crouchLp: { startup: 3, active: 2, recovery: 6, damage: 30, hitstun: 14, blockstun: 9, knockback: 2, hitbox: box(30, 110, 50, 30), level: 'mid', meterGain: 10, hitstop: 0 },
      crouchHp: { startup: 5, active: 3, recovery: 10, damage: 70, hitstun: 18, blockstun: 12, knockback: 3, hitbox: box(30, 120, 70, 40), level: 'mid', meterGain: 10, hitstop: 0 },
      crouchLk: { startup: 4, active: 3, recovery: 8, damage: 40, hitstun: 14, blockstun: 10, knockback: 2, hitbox: box(30, 0, 80, 30), level: 'low', meterGain: 10, hitstop: 0 },
      crouchHk: { startup: 6, active: 3, recovery: 16, damage: 80, hitstun: 20, blockstun: 12, knockback: 3, hitbox: box(30, 0, 100, 30), level: 'low', knockdown: true, meterGain: 10, hitstop: 0 },
      airP: { startup: 3, active: 8, recovery: 2, damage: 60, hitstun: 16, blockstun: 10, knockback: 2, hitbox: box(10, 40, 90, 120), level: 'overhead', meterGain: 10, hitstop: 0 },
      airK: { startup: 3, active: 8, recovery: 2, damage: 70, hitstun: 16, blockstun: 10, knockback: 2, hitbox: box(10, 0, 100, 120), level: 'overhead', meterGain: 10, hitstop: 0 },
    },
    specials: {
      neutral: {
        name: 'Fireball', startup: 8, active: 1, recovery: 20,
        projectile: { offsetX: 60, offsetY: 160, w: 40, h: 40, speed: 10, life: 200, damage: 80, chip: 0.25, hitstun: 18, blockstun: 14, knockback: 3, hitstop: 0 },
      },
      forward: { name: 'Rush', startup: 6, active: 12, recovery: 14, damage: 100, chip: 0.25, hitstun: 20, blockstun: 14, knockback: 6, hitbox: box(20, 40, 90, 160), level: 'mid', motion: { vx: 10, from: 6, to: 18 }, meterGain: 5, hitstop: 0 },
      down: { name: 'Big Kick', startup: 8, active: 4, recovery: 18, damage: 110, chip: 0.25, hitstun: 20, blockstun: 14, knockback: 6, hitbox: box(30, 100, 100, 60), level: 'mid', knockdown: true, meterGain: 5, hitstop: 0 },
    },
    super: {
      name: 'Super', cost: 100, freeze: 30, startup: 10, active: 1, recovery: 30, invulnerable: true,
      projectile: { offsetX: 60, offsetY: 120, w: 120, h: 140, speed: 12, life: 200, damage: 300, chip: 0.25, hitstun: 30, blockstun: 20, knockback: 6, hits: 1, priority: 2, knockdown: true, hitstop: 0 },
    },
  };
  return deepMerge(base, overrides);
}

function deepMerge(target, src) {
  const out = Array.isArray(target) ? [...target] : { ...target };
  for (const [k, v] of Object.entries(src)) {
    out[k] = v && typeof v === 'object' && !Array.isArray(v) && target[k] && typeof target[k] === 'object'
      ? deepMerge(target[k], v)
      : v;
  }
  return out;
}

/** press('right lp') -> { right: true, lp: true }; unlisted buttons are released. */
export function press(spec = '') {
  const input = { left: false, right: false, up: false, down: false, lp: false, hp: false, lk: false, hk: false, special: false, super: false };
  for (const key of spec.split(/\s+/).filter(Boolean)) {
    if (!(key in input)) throw new Error(`unknown input ${key}`);
    input[key] = true;
  }
  return input;
}

export const NONE = press();

export function makeSim({ p1 = makeCharacter(), p2 = makeCharacter(), startPositions = [800, 880], stageWidth = 1920 } = {}) {
  return new Simulation({ characters: [p1, p2], startPositions, stageWidth });
}

/** Steps the sim; inputs may be functions of the 1-based tick index. Returns events collected. */
export function run(sim, ticks, input1 = NONE, input2 = NONE) {
  const events = [];
  for (let t = 1; t <= ticks; t++) {
    sim.step(typeof input1 === 'function' ? input1(t) : input1, typeof input2 === 'function' ? input2(t) : input2);
    events.push(...sim.events);
  }
  return events;
}

/** Steps until predicate(sim) is true; returns number of steps taken (throws past max). */
export function stepUntil(sim, predicate, max = 2000, input1 = NONE, input2 = NONE) {
  for (let t = 1; t <= max; t++) {
    sim.step(typeof input1 === 'function' ? input1(t) : input1, typeof input2 === 'function' ? input2(t) : input2);
    if (predicate(sim)) return t;
  }
  throw new Error('condition not reached');
}
