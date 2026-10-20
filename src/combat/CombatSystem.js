import { toWorld, overlaps, hitsFighter } from './HitboxSystem.js';

const DEFAULT_HITSTOP = 6;
const MIN_COMBO_SCALE = 0.5;
const COMBO_SCALE_STEP = 0.1;

const pending = [];
const strikeBox = {};
const boxA = {};
const boxB = {};

/** Damage multiplier for the n-th hit of a combo. */
export function comboScale(combo) {
  return Math.max(MIN_COMBO_SCALE, 1 - COMBO_SCALE_STEP * (combo - 1));
}

function strikeIsLive(f) {
  if (f.state !== 'attack' || !f.move.hitbox || f.phase !== 'active') return false;
  const maxHits = f.move.hits || 1;
  if (f.moveHits >= maxHits) return false;
  return f.moveHits === 0 || f.moveFrame - f.lastHitFrame >= (f.move.hitInterval || 1);
}

/**
 * Resolves every collision of the tick. Hits are gathered first and applied afterwards
 * so that simultaneous hits trade (including double knockouts).
 */
export function resolveCombat(sim) {
  pending.length = 0;
  const [a, b] = sim.fighters;

  for (const [att, def] of [[a, b], [b, a]]) {
    if (!strikeIsLive(att) || def.isInvulnerable()) continue;
    toWorld(att.move.hitbox, att.x, att.y, att.facing, strikeBox);
    if (hitsFighter(strikeBox, def)) {
      pending.push({
        attacker: att, defender: def, move: att.move, kind: att.moveKind, sourceX: att.x,
        sparkX: att.facing > 0 ? Math.min(strikeBox.right, def.x) : Math.max(strikeBox.left, def.x),
        sparkY: (strikeBox.bottom + strikeBox.top) / 2,
        projectile: null,
      });
    }
  }

  resolveClashes(sim);

  for (const p of sim.projectiles) {
    if (!p.canHit) continue;
    const def = sim.fighters[1 - p.owner];
    if (def.isInvulnerable()) continue;
    p.box(boxA);
    if (hitsFighter(boxA, def)) {
      pending.push({
        attacker: sim.fighters[p.owner], defender: def, move: p.spec, kind: p.kind, sourceX: p.x,
        sparkX: p.x + p.vx, sparkY: p.y, projectile: p,
      });
    }
  }

  for (const hit of pending) applyHit(sim, hit);
}

function resolveClashes(sim) {
  const list = sim.projectiles;
  for (let i = 0; i < list.length; i++) {
    const p = list[i];
    if (p.dead) continue;
    for (let j = i + 1; j < list.length; j++) {
      const q = list[j];
      if (q.dead || q.owner === p.owner) continue;
      if (!overlaps(p.box(boxA), q.box(boxB))) continue;
      if (p.priority === q.priority) {
        p.dead = true;
        q.dead = true;
      } else {
        (p.priority > q.priority ? q : p).dead = true;
      }
      sim.emit({ type: 'clash', x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 });
      if (p.dead) break;
    }
  }
}

function applyHit(sim, hit) {
  const { attacker, defender, move, projectile } = hit;
  if (defender.isInvulnerable()) return;
  if (projectile) {
    if (projectile.dead) return;
    projectile.spendHit();
  } else {
    attacker.moveHits++;
    attacker.moveConnected = true;
    attacker.lastHitFrame = attacker.moveFrame;
  }

  const dir = Math.sign(defender.x - hit.sourceX) || attacker.facing;
  const gain = hit.kind === 'super' ? 0 : move.meterGain ?? Math.round(move.damage / 10);
  const knockback = (move.knockback || 0) * dir;
  const defenderCornered = sim.atWall(defender, dir);

  if (defender.blocks(move.level || 'mid', hit.sourceX)) {
    const chip = Math.floor(move.damage * (move.chip || 0));
    defender.health = Math.max(0, defender.health - chip);
    attacker.addMeter(Math.floor(gain / 2));
    defender.enterBlockstun(move.blockstun, knockback);
    if (!projectile && defenderCornered) attacker.slide = -knockback;
    sim.emit({
      type: 'block', attacker: attacker.index, defender: defender.index, x: hit.sparkX, y: hit.sparkY,
      kind: hit.kind, damage: chip,
    });
    if (defender.health <= 0) knockOut(sim, defender, dir);
    sim.freezeFor(Math.max(2, Math.floor((move.hitstop ?? DEFAULT_HITSTOP) / 2)));
    return;
  }

  attacker.combo = defender.isComboable() ? attacker.combo + 1 : 1;
  const damage = Math.round(move.damage * comboScale(attacker.combo));
  defender.health = Math.max(0, defender.health - damage);
  attacker.addMeter(gain);
  defender.addMeter(Math.floor(damage / 20));

  if (defender.health <= 0) {
    knockOut(sim, defender, dir);
  } else if ((move.knockdown && (!projectile || projectile.dead)) || defender.inAir) {
    defender.launch('knockdown', dir);
  } else {
    defender.enterHitstun(move.hitstun, knockback);
    if (!projectile && defenderCornered) attacker.slide = -knockback;
  }

  sim.emit({
    type: 'hit', attacker: attacker.index, defender: defender.index, damage, combo: attacker.combo,
    x: hit.sparkX, y: hit.sparkY, kind: hit.kind, heavy: damage >= 80, ko: defender.health <= 0,
  });
  sim.freezeFor(move.hitstop ?? DEFAULT_HITSTOP);
}

function knockOut(sim, fighter, dir) {
  fighter.launch('ko', dir);
  sim.emit({ type: 'ko', fighter: fighter.index });
}
