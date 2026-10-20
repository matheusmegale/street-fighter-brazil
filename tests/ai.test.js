import { describe, it, expect } from 'vitest';
import { FighterAI } from '../src/ai/FighterAI.js';
import { makeCharacter, makeSim, press, NONE } from './helpers.js';

/** Runs a sim where P2 is the AI; script(t) drives P1. Returns the AI inputs per tick. */
function playAgainst(sim, ai, ticks, script = () => NONE) {
  const inputs = [];
  for (let t = 1; t <= ticks; t++) {
    const aiInput = ai.update(sim, 1);
    inputs.push(JSON.stringify(aiInput));
    sim.step(script(t), aiInput);
  }
  return inputs;
}

// The AI side has no projectile of its own, so only the threat can change what it does.
const threatSetup = () =>
  makeSim({ p2: makeCharacter({ specials: { neutral: null } }), startPositions: [300, 1100] });

// Minimum believable human reaction, in ticks at 60/s.
const MIN_REACTION = { easy: 25, normal: 15, hard: 10 };

describe('FighterAI', () => {
  for (const difficulty of ['easy', 'normal', 'hard']) {
    it(`${difficulty}: answers an incoming projectile, but never faster than a human could`, () => {
      const T = 30;
      const quiet = playAgainst(threatSetup(), new FighterAI({ difficulty, seed: 7 }), 200);
      const threatened = playAgainst(threatSetup(), new FighterAI({ difficulty, seed: 7 }), 200, (t) =>
        t === T ? press('special') : NONE,
      );
      const firstDifference = quiet.findIndex((v, i) => v !== threatened[i]) + 1;
      expect(firstDifference).toBeGreaterThan(0);
      expect(firstDifference).toBeGreaterThanOrEqual(T + MIN_REACTION[difficulty]);
    });
  }

  it('hard reacts faster than easy to the same threat', () => {
    const reaction = (difficulty) => {
      const quiet = playAgainst(threatSetup(), new FighterAI({ difficulty, seed: 5 }), 200);
      const threatened = playAgainst(threatSetup(), new FighterAI({ difficulty, seed: 5 }), 200, (t) =>
        t === 30 ? press('special') : NONE,
      );
      return quiet.findIndex((v, i) => v !== threatened[i]);
    };
    expect(reaction('hard')).toBeLessThan(reaction('easy'));
  });

  it('closes the distance when the opponent is far away', () => {
    const noFireball = makeCharacter({ specials: { neutral: null } });
    const sim = makeSim({ p1: noFireball, p2: noFireball, startPositions: [300, 1300] });
    playAgainst(sim, new FighterAI({ difficulty: 'normal', seed: 3 }), 240);
    const [a, b] = sim.fighters;
    expect(Math.abs(b.x - a.x)).toBeLessThan(700);
  });

  it('hard CPU damages an opponent that does nothing', () => {
    const sim = makeSim({ startPositions: [700, 1000] });
    playAgainst(sim, new FighterAI({ difficulty: 'hard', seed: 11 }), 600);
    expect(sim.fighters[0].health).toBeLessThan(1000);
  });

  it('hard CPU gets caught by a slow telegraphed attack far less often than easy CPU', () => {
    const timesHit = (difficulty) => {
      let hits = 0;
      for (let seed = 1; seed <= 30; seed++) {
        const sim = makeSim({ startPositions: [800, 930] });
        const ai = new FighterAI({ difficulty, seed });
        const wait = 40 + (seed % 20);
        let caught = false;
        for (let t = 1; t <= wait + 60; t++) {
          const aiInput = ai.update(sim, 1);
          sim.step(t >= wait && t % 2 === 0 ? press('hk') : NONE, aiInput);
          if (sim.events.some((e) => e.type === 'hit' && e.attacker === 0)) caught = true;
        }
        if (caught) hits++;
      }
      return hits;
    };
    const easy = timesHit('easy');
    const hard = timesHit('hard');
    expect(easy).toBeGreaterThanOrEqual(10);
    expect(hard).toBeLessThanOrEqual(easy / 2);
  });
});
