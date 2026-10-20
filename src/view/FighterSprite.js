import { GROUND_Y } from '../config/game.js';
import { movePhase } from '../combat/MoveSystem.js';

const prefixOf = (frame) => frame.slice(0, frame.lastIndexOf('_'));

function pickOnce(frames, elapsed, fps) {
  return frames[Math.min(frames.length - 1, Math.floor((elapsed * fps) / 60))];
}

function pickLoop(anim, elapsed) {
  return anim.frames[Math.floor((elapsed * anim.fps) / 60) % anim.frames.length];
}

/** Frame for the current phase of a move, spreading the phase's frames over its duration. */
function moveFrame(move, frame) {
  const frames = move.frames;
  const phase = movePhase(move, frame);
  if (phase === 'startup') return spread(frames.startup, frame - 1, move.startup);
  if (phase === 'active') {
    const t = frame - move.startup - 1;
    if (move.loopActive) return frames.active[Math.floor(t / 4) % frames.active.length];
    return spread(frames.active, t, move.active);
  }
  return spread(frames.recovery, Math.max(0, frame - move.startup - move.active - 1), move.recovery);
}

function spread(list, t, duration) {
  return list[Math.min(list.length - 1, Math.floor((t / duration) * list.length))];
}

/** Renders one Fighter from the simulation. Holds no game logic. */
export class FighterSprite {
  constructor(scene, fighter, { tint = null, depth = 10 } = {}) {
    this.scene = scene;
    this.fighter = fighter;
    this.def = fighter.def;
    this.baseDepth = depth;
    this.tint = tint;
    this.shadow = scene.add.image(fighter.x, GROUND_Y, 'fx-shadow').setDepth(4);
    this.sprite = scene.add.sprite(fighter.x, GROUND_Y, this.def.id, 'idle_0').setDepth(depth);
    if (tint) this.sprite.setTint(tint);
    this.currentFrame = null;
    this.flashUntil = 0;
  }

  flash(ms = 50) {
    this.flashUntil = this.scene.time.now + ms;
  }

  frameFor(f, clock) {
    const a = this.def.animations;
    switch (f.state) {
      case 'idle':
        return pickLoop(a.idle, clock);
      case 'walk':
        return pickLoop(f.walkDir > 0 ? a.walk : a.walkBack, f.stateFrame);
      case 'crouch':
        return a.crouch.frames[0];
      case 'jump':
        return (f.vy > 3 ? a.jumpUp : a.jumpDown).frames[0];
      case 'attack':
        return moveFrame(f.move, f.moveFrame);
      case 'hitstun':
        return f.crouching ? a.crouchHit.frames[0] : pickOnce(a.hit.frames, f.stateFrame, a.hit.fps);
      case 'blockstun':
        return (f.crouching ? a.crouchBlock : a.block).frames[0];
      case 'knockdown':
      case 'ko': {
        const anim = f.state === 'ko' ? a.ko : a.knockdown;
        if (f.knockdownPhase === 'rising') return pickOnce(a.rise.frames, f.stateFrame, a.rise.fps);
        return anim.frames[f.knockdownPhase === 'lying' ? anim.frames.length - 1 : 0];
      }
      case 'victory':
        return a.victory.frames[0];
      default:
        return a.idle.frames[0];
    }
  }

  /** `clock` is the simulation frame counter, so idle loops don't restart on every state change. */
  sync(clock) {
    const f = this.fighter;
    const frame = this.frameFor(f, clock);
    if (frame !== this.currentFrame) {
      this.currentFrame = frame;
      this.sprite.setFrame(frame);
      this.sprite.setScale(this.def.scale * (this.def.frameScale?.[prefixOf(frame)] || 1));
    }
    this.sprite.setPosition(Math.round(f.x), Math.round(GROUND_Y - f.y));
    this.sprite.setFlipX(f.facing < 0);
    this.sprite.setDepth(this.baseDepth + (f.state === 'attack' ? 2 : 0));

    const lift = Math.min(1, f.y / 250);
    this.shadow.setPosition(Math.round(f.x), GROUND_Y + 2);
    this.shadow.setScale(2.6 * (1 - lift * 0.5), 2);
    this.shadow.setAlpha(1 - lift * 0.6);

    if (this.scene.time.now < this.flashUntil) {
      this.sprite.setTintFill(0xffffff);
    } else if (this.sprite.tintFill) {
      this.sprite.clearTint();
      if (this.tint) this.sprite.setTint(this.tint);
    }
  }
}
