import { chooseMove, movePhase, totalFrames } from '../combat/MoveSystem.js';

export const BUFFER_FRAMES = 6;
export const METER_MAX = 100;
const SLIDE_FRICTION = 0.5;
const LAUNCH_VY = 9;
const LAUNCH_VX = 3.5;
const KNOCKDOWN_LIE_FRAMES = 34;
const KNOCKDOWN_RISE_FRAMES = 14;
const NO_BOXES = Object.freeze([]);

const ACTIONABLE = new Set(['idle', 'walk', 'crouch']);
const CAN_BLOCK = new Set(['idle', 'walk', 'crouch', 'blockstun']);
const ATTACK_BUTTONS = ['lp', 'hp', 'lk', 'hk', 'special', 'super'];

export const EMPTY_INPUT = Object.freeze({
  left: false, right: false, up: false, down: false,
  lp: false, hp: false, lk: false, hk: false, special: false, super: false,
});

/**
 * Pure fighter state machine. Positions are in stage pixels; y is height above the floor.
 * States: idle, walk, crouch, jump, attack, hitstun, blockstun, knockdown, ko, victory.
 */
export class Fighter {
  constructor(def, index) {
    this.def = def;
    this.index = index;
    this.maxHealth = def.stats.health;
    this.meter = 0;
    this.pressed = { ...EMPTY_INPUT };
    this.buffer = { ...EMPTY_INPUT };
    // Owned copies: callers may reuse and mutate the input object they pass in.
    this.input = { ...EMPTY_INPUT };
    this.prevInput = { ...EMPTY_INPUT };
    this.reset(0, 1);
  }

  reset(x, facing) {
    this.x = x;
    this.prevX = x;
    this.y = 0;
    this.vx = 0;
    this.vy = 0;
    this.slide = 0;
    this.inAir = false;
    this.facing = facing;
    this.health = this.maxHealth;
    this.state = 'idle';
    this.stateFrame = 0;
    this.stun = 0;
    this.walkDir = 0;
    this.crouching = false;
    this.knockdownPhase = null;
    this.airAttackUsed = false;
    this.combo = 0;
    Object.assign(this.input, EMPTY_INPUT);
    Object.assign(this.prevInput, EMPTY_INPUT);
    this.bufferTtl = 0;
    this.clearMove();
  }

  clearMove() {
    this.move = null;
    this.moveKey = null;
    this.moveKind = null;
    this.moveFrame = 0;
    this.moveHits = 0;
    this.moveConnected = false;
    this.lastHitFrame = -99;
    this.moveAir = false;
  }

  get halfWidth() {
    return this.def.body.width / 2;
  }

  get pushHeight() {
    return this.isCrouchingPose() ? this.def.body.crouchHeight : this.def.body.standHeight;
  }

  get actionable() {
    return ACTIONABLE.has(this.state);
  }

  get phase() {
    return this.move ? movePhase(this.move, this.moveFrame) : null;
  }

  /** Called every tick, including hitstop ticks, so presses are never lost. */
  readInput(input) {
    const prev = this.input;
    this.input = this.prevInput;
    this.prevInput = prev;
    for (const key in EMPTY_INPUT) this.input[key] = !!input[key];
    let any = false;
    for (const b of ATTACK_BUTTONS) {
      this.pressed[b] = input[b] && !this.prevInput[b];
      if (this.pressed[b]) any = true;
    }
    if (any) {
      for (const b of ATTACK_BUTTONS) this.buffer[b] = this.pressed[b];
      this.bufferTtl = BUFFER_FRAMES;
    }
  }

  endTick() {
    if (this.bufferTtl > 0) this.bufferTtl--;
  }

  tick(opponent, sim) {
    this.prevX = this.x;
    this.stateFrame++;

    switch (this.state) {
      case 'attack':
        this.moveFrame++;
        if (this.moveFrame > totalFrames(this.move)) this.finishMove();
        break;
      case 'hitstun':
      case 'blockstun':
        if (--this.stun <= 0) this.setState('idle');
        break;
      case 'knockdown':
        if (this.knockdownPhase === 'lying' && this.stateFrame >= KNOCKDOWN_LIE_FRAMES) {
          this.knockdownPhase = 'rising';
          this.stateFrame = 0;
        } else if (this.knockdownPhase === 'rising' && this.stateFrame >= KNOCKDOWN_RISE_FRAMES) {
          this.setState('idle');
        }
        break;
      default:
        break;
    }

    if (this.actionable) {
      this.faceTowards(opponent);
      if (!this.tryStartFromBuffer(sim, false)) this.applyMovement();
    } else if (this.state === 'jump' && !this.airAttackUsed) {
      if (this.tryStartFromBuffer(sim, true)) this.airAttackUsed = true;
    } else if (this.state === 'attack' && this.moveKind === 'normal' && this.moveConnected) {
      this.tryCancel(sim);
    }

    if (this.state === 'attack' && this.move.projectile && this.moveFrame === this.move.startup + 1) {
      sim.spawnProjectile(this, this.move.projectile, this.moveKind);
    }
  }

  setState(state) {
    this.state = state;
    this.stateFrame = 0;
    if (state === 'idle') {
      this.crouching = false;
      this.knockdownPhase = null;
      this.vx = 0;
    }
  }

  faceTowards(opponent) {
    if (opponent.x > this.x) this.facing = 1;
    else if (opponent.x < this.x) this.facing = -1;
  }

  forwardHeld() {
    return this.facing > 0 ? this.input.right && !this.input.left : this.input.left && !this.input.right;
  }

  tryStartFromBuffer(sim, airborne) {
    if (this.bufferTtl <= 0) return false;
    const choice = chooseMove(this.def, this.buffer, this.input, {
      airborne,
      forwardHeld: this.forwardHeld(),
      meter: this.meter,
    });
    if (!choice) return false;
    this.bufferTtl = 0;
    return this.startMove(choice, sim, airborne);
  }

  tryCancel(sim) {
    if (this.bufferTtl <= 0 || !(this.buffer.special || this.buffer.super)) return;
    const choice = chooseMove(
      this.def,
      { ...EMPTY_INPUT, special: this.buffer.special, super: this.buffer.super },
      this.input,
      { airborne: false, forwardHeld: this.forwardHeld(), meter: this.meter },
    );
    if (!choice) return;
    this.bufferTtl = 0;
    this.startMove(choice, sim, false);
  }

  startMove(choice, sim, airborne) {
    if (choice.move.projectile && sim.hasProjectile(this.index)) return false;
    if (choice.kind === 'super') {
      this.meter -= choice.move.cost;
      sim.freezeFor(choice.move.freeze || 0);
      sim.emit({ type: 'super', fighter: this.index });
    }
    this.clearMove();
    this.state = 'attack';
    this.stateFrame = 0;
    this.move = choice.move;
    this.moveKey = choice.key;
    this.moveKind = choice.kind;
    this.moveFrame = 1;
    this.moveAir = airborne;
    this.crouching = choice.key.startsWith('crouch');
    if (!airborne) this.vx = 0;
    sim.emit({ type: 'attackStart', fighter: this.index, move: choice.key, kind: choice.kind });
    return true;
  }

  finishMove() {
    const wasAir = this.moveAir;
    this.clearMove();
    if (wasAir && this.inAir) {
      this.state = 'jump';
      this.stateFrame = 0;
    } else {
      this.setState('idle');
    }
  }

  applyMovement() {
    const { input, def } = this;
    if (input.up) {
      const dir = (input.right ? 1 : 0) - (input.left ? 1 : 0);
      this.setState('jump');
      this.inAir = true;
      this.airAttackUsed = false;
      this.vy = def.stats.jumpVelocity;
      this.vx = dir * def.stats.jumpForward;
      return;
    }
    if (input.down) {
      if (this.state !== 'crouch') this.setState('crouch');
      this.crouching = true;
      this.vx = 0;
      return;
    }
    const dir = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    if (dir === 0) {
      if (this.state !== 'idle') this.setState('idle');
      return;
    }
    const forward = dir === this.facing;
    if (this.state !== 'walk') this.setState('walk');
    this.walkDir = forward ? 1 : -1;
    this.vx = dir * (forward ? def.stats.walkSpeed : def.stats.backSpeed);
  }

  /** Integrates motion for one tick. */
  integrate(gravity) {
    if (this.state === 'attack' && this.move.motion && !this.moveConnected) {
      const { from, to, vx } = this.move.motion;
      if (this.moveFrame >= from && this.moveFrame <= to) this.x += this.facing * vx;
    }
    if (this.inAir) {
      this.x += this.vx;
      this.y += this.vy;
      this.vy -= gravity;
      if (this.y <= 0) this.land();
      return;
    }
    if (this.state === 'walk') this.x += this.vx;
    if (this.slide !== 0) {
      this.x += this.slide;
      const s = Math.abs(this.slide) - SLIDE_FRICTION;
      this.slide = s > 0 ? Math.sign(this.slide) * s : 0;
    }
  }

  land() {
    this.y = 0;
    this.vy = 0;
    this.vx = 0;
    this.inAir = false;
    if (this.state === 'knockdown' || this.state === 'ko') {
      this.knockdownPhase = 'lying';
      this.stateFrame = 0;
    } else if (this.state === 'jump' || this.state === 'attack') {
      this.clearMove();
      this.setState('idle');
    }
  }

  isCrouchingPose() {
    if (this.state === 'crouch') return true;
    if (this.state === 'attack' || this.state === 'hitstun' || this.state === 'blockstun') return this.crouching;
    return false;
  }

  hurtboxes() {
    if (this.state === 'knockdown' || this.state === 'ko') return NO_BOXES;
    const boxes = this.def.hurtboxes;
    if (this.inAir) return boxes.air;
    return this.isCrouchingPose() ? boxes.crouch : boxes.stand;
  }

  isInvulnerable() {
    if (this.state === 'knockdown' || this.state === 'ko' || this.state === 'victory') return true;
    return this.state === 'attack' && !!this.move.invulnerable && this.phase === 'startup';
  }

  /** Whether an attack of `level` coming from `sourceX` is blocked right now. */
  blocks(level, sourceX) {
    if (!CAN_BLOCK.has(this.state) || this.inAir) return false;
    const fromRight = sourceX > this.x || (sourceX === this.x && this.facing > 0);
    const back = fromRight ? this.input.left && !this.input.right : this.input.right && !this.input.left;
    if (!back) return false;
    const crouch = this.input.down;
    if (level === 'low' && !crouch) return false;
    if (level === 'overhead' && crouch) return false;
    return true;
  }

  isComboable() {
    return this.state === 'hitstun' || (this.state === 'knockdown' && this.knockdownPhase === 'falling');
  }

  enterBlockstun(frames, slide) {
    this.clearMove();
    this.crouching = this.input.down;
    this.state = 'blockstun';
    this.stateFrame = 0;
    this.stun = frames;
    this.slide = slide;
    this.vx = 0;
  }

  enterHitstun(frames, slide) {
    const crouched = this.isCrouchingPose();
    this.clearMove();
    this.crouching = crouched;
    this.state = 'hitstun';
    this.stateFrame = 0;
    this.stun = frames;
    this.slide = slide;
    this.vx = 0;
  }

  launch(state, dir) {
    this.clearMove();
    this.state = state;
    this.stateFrame = 0;
    this.knockdownPhase = 'falling';
    this.inAir = true;
    this.y = Math.max(this.y, 1);
    this.vy = LAUNCH_VY;
    this.vx = dir * LAUNCH_VX;
    this.slide = 0;
    this.crouching = false;
  }

  addMeter(amount) {
    this.meter = Math.max(0, Math.min(METER_MAX, this.meter + amount));
  }

  setVictory() {
    if (this.state === 'ko' || this.inAir) return;
    this.clearMove();
    this.setState('victory');
  }
}
