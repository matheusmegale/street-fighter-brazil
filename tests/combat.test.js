import { describe, it, expect } from 'vitest';
import { makeCharacter, makeSim, press, NONE, run, stepUntil } from './helpers.js';

const once = (spec, at = 1) => (t) => (t === at ? press(spec) : NONE);
const at = (map) => (t) => (map[t] ? press(map[t]) : NONE);
const startsOf = (events, fighter) => events.filter((e) => e.type === 'attackStart' && e.fighter === fighter);

describe('move timing', () => {
  it('a light punch deals damage exactly on the first active frame (startup + 1)', () => {
    const sim = makeSim();
    const steps = stepUntil(sim, (s) => s.fighters[1].health < 1000, 30, once('lp'));
    expect(steps).toBe(4);
  });

  it('holding a button attacks once; a new press is needed for the next attack', () => {
    const sim = makeSim({ startPositions: [800, 1400] });
    const events = run(sim, 30, press('lp'));
    expect(startsOf(events, 0)).toHaveLength(1);
  });

  it('presses register even when the controller reuses one mutable input object', () => {
    const sim = makeSim();
    const shared = press();
    const events = [];
    for (let t = 1; t <= 20; t++) {
      shared.lp = t === 1;
      sim.step(shared, NONE);
      events.push(...sim.events);
    }
    expect(startsOf(events, 0)).toHaveLength(1);
    expect(sim.fighters[1].health).toBe(1000 - 40);
  });

  it('a fighter cannot walk during an attack and walks again once recovery ends', () => {
    const sim = makeSim({ startPositions: [800, 1400] });
    const xs = [];
    for (let t = 1; t <= 14; t++) {
      sim.step(t === 1 ? press('lp') : press('right'), NONE);
      xs.push(sim.fighters[0].x);
    }
    // lp lasts 3 + 2 + 6 = 11 frames
    expect(new Set(xs.slice(0, 11)).size).toBe(1);
    expect(xs[11]).toBeGreaterThan(xs[10]);
  });

  it('a new attack never starts before the previous one has fully recovered', () => {
    const sim = makeSim({ startPositions: [800, 1400] });
    const starts = [];
    for (let t = 1; t <= 60; t++) {
      sim.step(t % 2 ? press('lp') : NONE, NONE);
      if (startsOf(sim.events, 0).length) starts.push(t);
    }
    expect(starts.length).toBeGreaterThan(2);
    for (let i = 1; i < starts.length; i++) {
      expect(starts[i] - starts[i - 1]).toBeGreaterThanOrEqual(11);
    }
  });
});

describe('hitboxes', () => {
  it('hits an opponent at the edge of the hitbox and misses one just beyond it', () => {
    // lp reaches 80px ahead; the opponent's hurtbox begins 40px before its center.
    const inRange = makeSim({ startPositions: [800, 915] });
    run(inRange, 30, once('lp'));
    expect(inRange.fighters[1].health).toBe(1000 - 40);

    const outOfRange = makeSim({ startPositions: [800, 925] });
    run(outOfRange, 30, once('lp'));
    expect(outOfRange.fighters[1].health).toBe(1000);
  });

  it('a single-hit move connects only once even with several active frames', () => {
    const sim = makeSim();
    run(sim, 40, once('hp'));
    expect(sim.fighters[1].health).toBe(1000 - 90);
  });
});

describe('blocking', () => {
  it('holding back blocks a normal: no damage and the defender enters blockstun', () => {
    const sim = makeSim();
    const events = [];
    let sawBlockstun = false;
    for (let t = 1; t <= 30; t++) {
      sim.step(t === 1 ? press('hp') : NONE, press('right'));
      events.push(...sim.events);
      if (sim.fighters[1].state === 'blockstun') sawBlockstun = true;
    }
    expect(events.some((e) => e.type === 'block' && e.defender === 1)).toBe(true);
    expect(sim.fighters[1].health).toBe(1000);
    expect(sawBlockstun).toBe(true);
  });

  it('crouching while holding back also blocks mid attacks', () => {
    const sim = makeSim();
    const events = run(sim, 30, once('hp'), press('down right'));
    expect(events.some((e) => e.type === 'block')).toBe(true);
    expect(sim.fighters[1].health).toBe(1000);
  });

  it('a blocked special deals less damage than an unblocked one', () => {
    const blocked = makeSim();
    run(blocked, 60, once('down special'), press('right'));
    const open = makeSim();
    run(open, 60, once('down special'));
    const blockedLoss = 1000 - blocked.fighters[1].health;
    const openLoss = 1000 - open.fighters[1].health;
    expect(openLoss).toBe(110);
    expect(blockedLoss).toBeGreaterThan(0);
    expect(blockedLoss).toBeLessThan(openLoss);
  });

  it('a low attack beats a standing block but not a crouching block', () => {
    const standing = makeSim();
    run(standing, 30, once('down lk'), press('right'));
    expect(standing.fighters[1].health).toBe(1000 - 40);

    const crouching = makeSim();
    const events = run(crouching, 30, once('down lk'), press('down right'));
    expect(crouching.fighters[1].health).toBe(1000);
    expect(events.some((e) => e.type === 'block')).toBe(true);
  });

  it('a jumping attack beats a crouching block but not a standing block', () => {
    const jumpIn = (sim) => {
      let lastY = 0;
      let kicked = false;
      return (t) => {
        const f = sim.fighters[0];
        const descending = f.y < lastY;
        lastY = f.y;
        if (t === 1) return press('up right');
        if (!kicked && descending && f.y < 170) {
          kicked = true;
          return press('lk');
        }
        return NONE;
      };
    };
    const crouching = makeSim({ startPositions: [800, 1000] });
    run(crouching, 60, jumpIn(crouching), press('down right'));
    expect(crouching.fighters[1].health).toBe(1000 - 70);

    // the standing defender walks back while holding back, so start closer
    const standing = makeSim({ startPositions: [820, 1000] });
    const events = run(standing, 60, jumpIn(standing), press('right'));
    expect(standing.fighters[1].health).toBe(1000);
    expect(events.some((e) => e.type === 'block')).toBe(true);
  });
});

describe('hitstun and combos', () => {
  it('a fighter in hitstun cannot attack until the hitstun ends', () => {
    const sim = makeSim();
    let hitAt = null;
    let p2AttackAt = null;
    for (let t = 1; t <= 60 && p2AttackAt === null; t++) {
      const p2 = hitAt !== null && t % 2 === 0 ? press('lp') : NONE;
      sim.step(t === 1 ? press('lp') : NONE, p2);
      if (hitAt === null && sim.events.some((e) => e.type === 'hit' && e.attacker === 0)) hitAt = t;
      if (startsOf(sim.events, 1).length) p2AttackAt = t;
    }
    // lp hitstun is 16 frames
    expect(hitAt).toBe(4);
    expect(p2AttackAt).toBeGreaterThanOrEqual(hitAt + 16);
    expect(p2AttackAt).toBeLessThanOrEqual(hitAt + 18);
  });

  it('a second hit landing during hitstun increases the combo counter', () => {
    const sim = makeSim();
    const events = run(sim, 40, at({ 1: 'lp', 12: 'lp' }));
    const hits = events.filter((e) => e.type === 'hit' && e.attacker === 0);
    expect(hits.map((h) => h.combo)).toEqual([1, 2]);
  });

  it('the combo counter starts over once the opponent recovers', () => {
    const sim = makeSim();
    const events = run(sim, 60, at({ 1: 'lp', 40: 'lp' }));
    const hits = events.filter((e) => e.type === 'hit' && e.attacker === 0);
    expect(hits.map((h) => h.combo)).toEqual([1, 1]);
  });

  it('a knocked-down fighter cannot be hit until it gets back up', () => {
    const sim = makeSim();
    run(sim, 12, once('down hk'));
    expect(sim.fighters[1].state).toBe('knockdown');

    // walk in until in punching range, then keep jabbing
    const pressure = (t) => {
      const [a, b] = sim.fighters;
      if (b.x - a.x > 100) return press('right');
      return t % 2 ? press('lp') : NONE;
    };
    let attacksWhileDown = 0;
    let healthWhileDown = null;
    stepUntil(sim, (s) => {
      if (s.fighters[1].state !== 'knockdown') return true;
      attacksWhileDown += startsOf(s.events, 0).length;
      healthWhileDown = s.fighters[1].health;
      return false;
    }, 300, pressure);
    expect(attacksWhileDown).toBeGreaterThan(0);
    expect(healthWhileDown).toBe(1000 - 80);

    run(sim, 40, pressure);
    expect(sim.fighters[1].health).toBeLessThan(1000 - 80);
  });
});

describe('bodies and arena', () => {
  it('fighters walking into each other never pass through and end up touching', () => {
    const sim = makeSim({ startPositions: [700, 1000] });
    for (let t = 0; t < 150; t++) {
      sim.step(press('right'), press('left'));
      const [a, b] = sim.fighters;
      expect(b.x - a.x).toBeGreaterThanOrEqual(80 - 1e-6);
    }
    expect(sim.fighters[1].x - sim.fighters[0].x).toBeCloseTo(80);
  });

  it('a fighter cannot leave the arena', () => {
    const sim = makeSim({ startPositions: [300, 500] });
    let minX = Infinity;
    for (let t = 0; t < 400; t++) {
      sim.step(press('left'), NONE);
      minX = Math.min(minX, sim.fighters[0].x);
    }
    expect(minX).toBe(40);
  });

  it('fighters cannot drift farther apart than the screen allows', () => {
    const sim = makeSim();
    expect(sim.maxSeparation).toBeLessThanOrEqual(1280 - 80);
    for (let t = 0; t < 600; t++) {
      sim.step(press('left'), press('right'));
      const [a, b] = sim.fighters;
      expect(b.x - a.x).toBeLessThanOrEqual(sim.maxSeparation + 1e-6);
      expect(a.x).toBeGreaterThanOrEqual(40);
      expect(b.x).toBeLessThanOrEqual(1920 - 40);
    }
    expect(sim.fighters[1].x - sim.fighters[0].x).toBeCloseTo(sim.maxSeparation);
  });

  it('after jumping over the opponent both fighters turn to face each other', () => {
    const sim = makeSim();
    stepUntil(sim, (s) => s.fighters[0].y > 0, 10, press('up right'));
    stepUntil(sim, (s) => s.fighters[0].y === 0, 120);
    run(sim, 2);
    const [a, b] = sim.fighters;
    expect(a.x).toBeGreaterThan(b.x);
    expect(a.facing).toBe(-1);
    expect(b.facing).toBe(1);
  });
});

describe('projectiles', () => {
  it('a projectile travels, hits the opponent and disappears', () => {
    const sim = makeSim({ startPositions: [400, 900] });
    stepUntil(sim, (s) => s.projectiles.length === 1, 20, once('special'));
    const x0 = sim.projectiles[0].x;
    run(sim, 5);
    expect(sim.projectiles[0].x).toBeGreaterThan(x0);
    stepUntil(sim, (s) => s.fighters[1].health < 1000, 200);
    expect(sim.fighters[1].health).toBe(1000 - 80);
    expect(sim.projectiles.length).toBe(0);
  });

  it('a blocked projectile deals chip damage and disappears', () => {
    const sim = makeSim({ startPositions: [400, 900] });
    const events = run(sim, 200, once('special'), press('right'));
    expect(events.some((e) => e.type === 'block')).toBe(true);
    expect(sim.fighters[1].health).toBe(1000 - 20);
    expect(sim.projectiles.length).toBe(0);
  });

  it('a fighter can only have one projectile on screen at a time', () => {
    const sim = makeSim({ startPositions: [300, 1300] });
    let max = 0;
    for (let t = 1; t <= 120; t++) {
      sim.step(t === 1 || t === 40 || t === 80 ? press('special') : NONE, NONE);
      max = Math.max(max, sim.projectiles.filter((p) => p.owner === 0).length);
    }
    expect(max).toBe(1);
  });

  it('projectiles that collide cancel each other out', () => {
    const sim = makeSim({ startPositions: [400, 1100] });
    const events = run(sim, 120, once('special'), once('special'));
    expect(events.some((e) => e.type === 'clash')).toBe(true);
    expect(sim.projectiles.length).toBe(0);
    expect(sim.fighters[0].health).toBe(1000);
    expect(sim.fighters[1].health).toBe(1000);
  });
});

describe('special meter and super', () => {
  const strong = () => makeCharacter({ moves: { lp: { meterGain: 50 } } });

  it('the meter fills when landing hits and when the hit is blocked', () => {
    const hit = makeSim();
    run(hit, 20, once('lp'));
    expect(hit.fighters[0].meter).toBeGreaterThan(0);

    const blocked = makeSim();
    run(blocked, 20, once('lp'), press('right'));
    expect(blocked.fighters[0].meter).toBeGreaterThan(0);
  });

  it('the meter never exceeds 100', () => {
    const sim = makeSim({ p1: strong() });
    const events = run(sim, 50, at({ 1: 'lp', 12: 'lp', 23: 'lp' }));
    expect(events.filter((e) => e.type === 'hit')).toHaveLength(3);
    expect(sim.fighters[0].meter).toBe(100);
  });

  it('the super does nothing without a full meter', () => {
    const sim = makeSim();
    const events = run(sim, 60, once('super'));
    expect(events.some((e) => e.type === 'super')).toBe(false);
    expect(sim.projectiles.length).toBe(0);
    expect(sim.fighters[1].health).toBe(1000);
  });

  it('with a full meter the super fires, empties the meter and deals heavy damage', () => {
    const sim = makeSim({ p1: strong() });
    run(sim, 40, at({ 1: 'lp', 12: 'lp' }));
    expect(sim.fighters[0].meter).toBe(100);
    const hp = sim.fighters[1].health;
    const events = run(sim, 150, once('super'));
    expect(events.some((e) => e.type === 'super' && e.fighter === 0)).toBe(true);
    expect(sim.fighters[0].meter).toBeLessThan(100);
    expect(hp - sim.fighters[1].health).toBe(300);
  });

  it('the super is invulnerable while it starts up', () => {
    const sim = makeSim({ p1: strong() });
    run(sim, 40, at({ 1: 'lp', 12: 'lp' }));
    // super freezes the action for 30 ticks, then 9 startup frames remain
    const events = run(sim, 60, once('super'), once('lp', 31));
    expect(startsOf(events, 1)).toHaveLength(1);
    expect(sim.fighters[0].health).toBe(1000);
  });

  it("the super's projectile overpowers a regular projectile and still connects", () => {
    const sim = makeSim({ p1: strong() });
    run(sim, 40, at({ 1: 'lp', 12: 'lp' }));
    run(sim, 60, press('left'));
    const hp = sim.fighters[1].health;
    const events = run(sim, 150, once('super'), once('special'));
    expect(events.some((e) => e.type === 'clash')).toBe(true);
    expect(sim.fighters[0].health).toBe(1000);
    expect(hp - sim.fighters[1].health).toBe(300);
  });
});
