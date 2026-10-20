/** Frame-data helpers. Frame 1 is the tick on which the move starts. */

export function totalFrames(move) {
  return move.startup + move.active + move.recovery;
}

export function movePhase(move, frame) {
  if (frame <= move.startup) return 'startup';
  if (frame <= move.startup + move.active) return 'active';
  if (frame <= totalFrames(move)) return 'recovery';
  return 'done';
}

const STRENGTH_ORDER = ['hk', 'hp', 'lk', 'lp'];

const STANDING = { lp: 'lp', hp: 'hp', lk: 'lk', hk: 'hk' };
const CROUCHING = { lp: 'crouchLp', hp: 'crouchHp', lk: 'crouchLk', hk: 'crouchHk' };
const AIRBORNE = { lp: 'airP', hp: 'airP', lk: 'airK', hk: 'airK' };

/**
 * Picks the move a set of freshly pressed buttons asks for.
 * Returns { key, kind, move } or null. `special` resolves by held direction:
 * down -> specials.down, toward the opponent -> specials.forward, otherwise specials.neutral.
 */
export function chooseMove(def, pressed, held, { airborne, forwardHeld, meter }) {
  if (pressed.super && !airborne && def.super && meter >= def.super.cost) {
    return { key: 'super', kind: 'super', move: def.super };
  }
  if (pressed.special && !airborne && def.specials) {
    const dir = held.down ? 'down' : forwardHeld ? 'forward' : 'neutral';
    const move = def.specials[dir];
    if (move) return { key: dir, kind: 'special', move };
  }
  const table = airborne ? AIRBORNE : held.down ? CROUCHING : STANDING;
  for (const button of STRENGTH_ORDER) {
    if (pressed[button]) {
      const key = table[button];
      const move = def.moves[key];
      if (move) return { key, kind: 'normal', move };
    }
  }
  return null;
}
