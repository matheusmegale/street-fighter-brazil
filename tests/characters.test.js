import { describe, it, expect } from 'vitest';
import { CHARACTERS } from '../src/characters/index.js';
import { Match } from '../src/combat/Match.js';
import { Simulation } from '../src/combat/Simulation.js';
import { press, NONE } from './helpers.js';

const ids = Object.keys(CHARACTERS);

describe('playable characters', () => {
  for (const a of ids) {
    for (const b of ids) {
      it(`${a} can knock out ${b} by walking in and punching`, () => {
        const match = new Match({ characters: [CHARACTERS[a], CHARACTERS[b]] });
        let t = 0;
        while (match.phase !== 'roundOver' && t++ < 6000) {
          const [p1, p2] = match.sim.fighters;
          const inRange = p2.x - p1.x < 150;
          match.step(inRange ? (t % 2 ? press('hp') : NONE) : press('right'), NONE);
        }
        expect(match.lastResult).toEqual({ winner: 0, reason: 'ko' });
      });
    }
  }

  for (const id of ids) {
    for (const direction of ['neutral', 'forward', 'down']) {
      it(`${id}'s ${direction} special damages a nearby opponent`, () => {
        const sim = new Simulation({ characters: [CHARACTERS[id], CHARACTERS[id]], startPositions: [800, 960] });
        const command = { neutral: 'special', forward: 'right special', down: 'down special' }[direction];
        for (let t = 1; t <= 150; t++) sim.step(t === 1 ? press(command) : NONE, NONE);
        expect(sim.fighters[1].health).toBeLessThan(sim.fighters[1].maxHealth);
      });
    }
  }
});
