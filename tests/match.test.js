import { describe, it, expect } from 'vitest';
import { Match } from '../src/combat/Match.js';
import { makeCharacter, press, NONE } from './helpers.js';

const fragile = () => makeCharacter({ stats: { health: 40 } });

function makeMatch(p1 = makeCharacter(), p2 = makeCharacter(), startPositions = [800, 880]) {
  return new Match({ characters: [p1, p2], startPositions, stageWidth: 1920 });
}

function toFight(match, input1 = NONE) {
  let guard = 0;
  while (match.phase !== 'fight') {
    match.step(input1, NONE);
    if (++guard > 1000) throw new Error('fight never started');
  }
}

/** Steps through the fight; returns number of fight ticks until the round ended. */
function fightUntilRoundEnds(match, input1 = () => NONE, input2 = () => NONE) {
  let t = 0;
  while (match.phase === 'fight') {
    t++;
    match.step(input1(t), input2(t));
    if (t > 10000) throw new Error('round never ended');
  }
  return t;
}

const lpOnce = (t) => (t === 1 ? press('lp') : NONE);

describe('round flow', () => {
  // Inputs are ignored on every step until the match reports the 'fight' phase.
  it('ignores inputs during the round intro', () => {
    const match = makeMatch();
    toFight(match, press('right'));
    expect(match.sim.fighters[0].x).toBe(800);
  });

  it('starts each round with 99 seconds on the clock', () => {
    const match = makeMatch();
    toFight(match);
    expect(match.timer).toBe(99);
  });

  it('a knockout gives the round to the fighter who scored it', () => {
    const match = makeMatch(makeCharacter(), fragile());
    toFight(match);
    fightUntilRoundEnds(match, lpOnce);
    expect(match.lastResult).toMatchObject({ winner: 0, reason: 'ko' });
    expect(match.wins).toEqual([1, 0]);
  });

  it('time runs out after 99 seconds of fighting and the healthier fighter wins', () => {
    const match = makeMatch();
    toFight(match);
    const ticks = fightUntilRoundEnds(match, lpOnce);
    expect(ticks).toBe(99 * 60);
    expect(match.lastResult).toMatchObject({ winner: 0, reason: 'timeover' });
    expect(match.wins).toEqual([1, 0]);
  });

  it('a time over with equal health is a draw and counts for both', () => {
    const match = makeMatch();
    toFight(match);
    fightUntilRoundEnds(match);
    expect(match.lastResult).toMatchObject({ winner: null, reason: 'timeover' });
    expect(match.wins).toEqual([1, 1]);
  });

  it('a double knockout is a draw', () => {
    const match = makeMatch(fragile(), fragile());
    toFight(match);
    fightUntilRoundEnds(match, lpOnce, lpOnce);
    expect(match.lastResult).toMatchObject({ winner: null, reason: 'ko' });
    expect(match.wins).toEqual([1, 1]);
  });

  it('a knockout on the very last tick beats the time over', () => {
    const match = makeMatch(makeCharacter(), fragile());
    toFight(match);
    // lp connects on the 4th tick after the press
    const ticks = fightUntilRoundEnds(match, (t) => (t === 99 * 60 - 3 ? press('lp') : NONE));
    expect(ticks).toBe(99 * 60);
    expect(match.lastResult).toMatchObject({ winner: 0, reason: 'ko' });
  });

  it('nothing can hurt the fighters once the round has been decided', () => {
    const match = makeMatch(makeCharacter(), makeCharacter(), [300, 1000]);
    toFight(match);
    // P2 fires just before the clock runs out; the projectile is still flying at time over
    fightUntilRoundEnds(match, () => NONE, (t) => (t === 99 * 60 - 20 ? press('special') : NONE));
    expect(match.lastResult).toMatchObject({ reason: 'timeover' });
    const health = match.sim.fighters.map((f) => f.health);
    const hitsAfter = [];
    while (match.phase === 'roundOver') {
      match.step(NONE, NONE);
      hitsAfter.push(...match.events.filter((e) => e.type === 'hit'));
    }
    expect(hitsAfter).toHaveLength(0);
    expect(match.wins).toEqual([1, 1]);
    expect(health).toEqual([1000, 1000]);
  });

  it('the next round restores health and starting positions', () => {
    const match = makeMatch(makeCharacter(), fragile());
    toFight(match);
    fightUntilRoundEnds(match, (t) => (t < 30 ? press('right') : t === 30 ? press('lp') : NONE));
    expect(match.sim.fighters[1].health).toBeLessThanOrEqual(0);
    toFight(match);
    expect(match.round).toBe(2);
    expect(match.timer).toBe(99);
    expect(match.sim.fighters.map((f) => f.health)).toEqual([1000, 40]);
    expect(match.sim.fighters.map((f) => f.x)).toEqual([800, 880]);
  });

  it('the first fighter to win two rounds wins the match', () => {
    const match = makeMatch(makeCharacter(), fragile());
    toFight(match);
    fightUntilRoundEnds(match, lpOnce);
    expect(match.phase).not.toBe('matchOver');
    toFight(match);
    fightUntilRoundEnds(match, lpOnce);
    let guard = 0;
    while (match.phase !== 'matchOver' && guard++ < 1000) match.step(NONE, NONE);
    expect(match.phase).toBe('matchOver');
    expect(match.matchWinner).toBe(0);
    expect(match.wins).toEqual([2, 0]);
  });

  it('two drawn rounds end the match as a draw game', () => {
    const match = makeMatch();
    toFight(match);
    fightUntilRoundEnds(match);
    toFight(match);
    fightUntilRoundEnds(match);
    let guard = 0;
    while (match.phase !== 'matchOver' && guard++ < 1000) match.step(NONE, NONE);
    expect(match.phase).toBe('matchOver');
    expect(match.matchWinner).toBe(null);
    expect(match.wins).toEqual([2, 2]);
  });
});
