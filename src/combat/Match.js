import { Simulation } from './Simulation.js';
import { EMPTY_INPUT } from '../entities/Fighter.js';

export const FPS = 60;
/** "ROUND n" is shown for the first part of the intro, "FIGHT!" for the rest. */
export const INTRO_FRAMES = 150;
export const FIGHT_CALL_FRAME = 90;
export const ROUND_OVER_FRAMES = 210;
const VICTORY_POSE_FRAME = 70;

/**
 * Round rules around a Simulation: intro, 99-second clock, KO / time over / draw,
 * best of three. Phases: intro -> fight -> roundOver -> (intro | matchOver).
 */
export class Match {
  constructor({ characters, startPositions, stageWidth, roundsToWin = 2, roundTime = 99 }) {
    this.sim = new Simulation({ characters, startPositions, stageWidth });
    this.roundsToWin = roundsToWin;
    this.roundTime = roundTime;
    this.round = 0;
    this.wins = [0, 0];
    this.lastResult = null;
    this.matchWinner = undefined;
    this.events = [];
    this.startRound();
  }

  get timer() {
    return Math.ceil(this.timerTicks / FPS);
  }

  get fighters() {
    return this.sim.fighters;
  }

  startRound() {
    this.round++;
    this.sim.resetRound();
    this.timerTicks = this.roundTime * FPS;
    this.phase = 'intro';
    this.phaseFrame = 0;
    this.events.push({ type: 'roundStart', round: this.round });
  }

  step(input1, input2) {
    this.events.length = 0;
    this.phaseFrame++;
    switch (this.phase) {
      case 'intro':
        this.sim.step(EMPTY_INPUT, EMPTY_INPUT);
        if (this.phaseFrame === FIGHT_CALL_FRAME) this.events.push({ type: 'fightCall' });
        if (this.phaseFrame >= INTRO_FRAMES) this.setPhase('fight');
        break;
      case 'fight':
        this.stepFight(input1, input2);
        break;
      case 'roundOver':
        this.sim.step(EMPTY_INPUT, EMPTY_INPUT);
        this.events.push(...this.sim.events);
        if (this.phaseFrame === VICTORY_POSE_FRAME && this.lastResult.winner !== null) {
          this.sim.fighters[this.lastResult.winner].setVictory();
        }
        if (this.phaseFrame >= ROUND_OVER_FRAMES) this.nextRound();
        break;
      case 'matchOver':
        this.sim.step(EMPTY_INPUT, EMPTY_INPUT);
        break;
      default:
        break;
    }
  }

  setPhase(phase) {
    this.phase = phase;
    this.phaseFrame = 0;
  }

  stepFight(input1, input2) {
    const frozen = this.sim.isFrozen;
    this.sim.step(input1, input2);
    this.events.push(...this.sim.events);
    const [a, b] = this.sim.fighters;
    const aDown = a.health <= 0;
    const bDown = b.health <= 0;
    if (aDown || bDown) {
      this.endRound(aDown && bDown ? null : aDown ? 1 : 0, 'ko');
      return;
    }
    if (!frozen) this.timerTicks--;
    if (this.timerTicks <= 0) {
      const winner = a.health === b.health ? null : a.health > b.health ? 0 : 1;
      this.endRound(winner, 'timeover');
    }
  }

  endRound(winner, reason) {
    this.lastResult = { winner, reason };
    this.sim.combatEnabled = false;
    this.sim.clearProjectiles();
    if (winner === null) {
      this.wins[0]++;
      this.wins[1]++;
    } else {
      this.wins[winner]++;
    }
    this.setPhase('roundOver');
    this.events.push({ type: 'roundOver', winner, reason });
  }

  nextRound() {
    const [w1, w2] = this.wins;
    const target = this.roundsToWin;
    if (w1 >= target || w2 >= target) {
      this.matchWinner = w1 >= target && w2 >= target ? null : w1 >= target ? 0 : 1;
      this.setPhase('matchOver');
      this.events.push({ type: 'matchOver', winner: this.matchWinner });
      return;
    }
    this.startRound();
  }
}
