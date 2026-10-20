/**
 * CPU opponent. It sees the opponent (position, attacks, projectiles) only through a
 * delay of `reactionFrames`, like a human would, and produces the same input object a
 * player's keyboard does. Its own state is known immediately.
 */
export const DIFFICULTY = {
  easy: {
    reactionFrames: 30, blockChance: 0.2, antiAirChance: 0.1, aggression: 0.3, zoning: 0.15,
    specialChance: 0.1, superChance: 0.25, jumpChance: 0.04, mistakeChance: 0.35, think: [24, 42],
  },
  normal: {
    reactionFrames: 18, blockChance: 0.55, antiAirChance: 0.35, aggression: 0.5, zoning: 0.3,
    specialChance: 0.2, superChance: 0.5, jumpChance: 0.06, mistakeChance: 0.15, think: [14, 26],
  },
  hard: {
    reactionFrames: 12, blockChance: 0.85, antiAirChance: 0.65, aggression: 0.7, zoning: 0.4,
    specialChance: 0.3, superChance: 0.8, jumpChance: 0.06, mistakeChance: 0.05, think: [8, 16],
  },
};

const CLOSE = 190;
const FAR = 450;
const PROJECTILE_ALERT = 420;
const DEFAULT_REACH = 150;

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeSnapshot() {
  return {
    x: 0, inAir: false, attacking: false, attackId: 0, level: 'mid', reach: 0,
    jumpId: 0, projActive: false, projId: 0, projX: 0, projVx: 0,
  };
}

function threatReach(move) {
  if (!move.hitbox) return 0;
  let reach = move.hitbox.x + move.hitbox.w;
  if (move.motion) reach += move.motion.vx * (move.motion.to - move.motion.from);
  return reach || DEFAULT_REACH;
}

export class FighterAI {
  constructor({ difficulty = 'normal', seed = Date.now() } = {}) {
    this.cfg = DIFFICULTY[difficulty] || DIFFICULTY.normal;
    this.rng = mulberry32(seed);
    const size = this.cfg.reactionFrames + 1;
    this.history = Array.from({ length: size }, makeSnapshot);
    this.recorded = 0;
    this.attackCounter = 0;
    this.jumpCounter = 0;
    this.lastOppMoveFrame = 0;
    this.lastOppInAir = false;
    this.plan = null;
    this.thinkTimer = 0;
    this.reacted = { attack: -1, proj: -1, jump: -1 };
    this.guard = null;
    this.output = {
      left: false, right: false, up: false, down: false,
      lp: false, hp: false, lk: false, hk: false, special: false, super: false,
    };
  }

  update(sim, index) {
    const me = sim.fighters[index];
    const opp = sim.fighters[1 - index];
    this.record(opp, sim);
    return this.decide(me, this.perceived(), sim.fighters[index].def);
  }

  record(opp, sim) {
    const snap = this.history[this.recorded % this.history.length];
    this.recorded++;
    const attacking = opp.state === 'attack' && (opp.phase === 'startup' || opp.phase === 'active');
    if (opp.state === 'attack' && (opp.moveFrame < this.lastOppMoveFrame || this.lastOppMoveFrame === 0)) {
      this.attackCounter++;
    }
    this.lastOppMoveFrame = opp.state === 'attack' ? opp.moveFrame : 0;
    if (opp.inAir && !this.lastOppInAir) this.jumpCounter++;
    this.lastOppInAir = opp.inAir;

    snap.x = opp.x;
    snap.inAir = opp.inAir;
    snap.attacking = attacking;
    snap.attackId = this.attackCounter;
    snap.level = attacking ? opp.move.level || 'mid' : 'mid';
    snap.reach = attacking ? threatReach(opp.move) : 0;
    snap.jumpId = this.jumpCounter;
    snap.projActive = false;
    for (const p of sim.projectiles) {
      if (p.owner === opp.index && !p.dead) {
        snap.projActive = true;
        snap.projId = p.id;
        snap.projX = p.x;
        snap.projVx = p.vx;
        break;
      }
    }
  }

  perceived() {
    const delay = this.history.length - 1;
    const idx = this.recorded > delay ? (this.recorded - 1 - delay) % this.history.length : 0;
    return this.history[idx];
  }

  release() {
    const o = this.output;
    o.left = o.right = o.up = o.down = false;
    o.lp = o.hp = o.lk = o.hk = o.special = o.super = false;
    return o;
  }

  /** dir: +1 towards the perceived opponent, -1 away from it. */
  hold(o, dir) {
    if (dir === 0) return;
    const right = this.towardSign > 0 ? dir > 0 : dir < 0;
    o.right = right;
    o.left = !right;
  }

  rand(min, max) {
    return min + Math.floor(this.rng() * (max - min + 1));
  }

  decide(me, seen, def) {
    const o = this.release();
    const dist = Math.abs(seen.x - me.x);
    this.towardSign = seen.x >= me.x ? 1 : -1;

    // Keep guarding through block/hitstun while the perceived threat lasts,
    // matching the height of each new perceived attack.
    if (this.guard && seen.attacking && this.reacted.attack !== seen.attackId) {
      this.reacted.attack = seen.attackId;
      if (this.rng() >= this.cfg.blockChance) this.guard = null;
    }
    if (this.guard && (seen.attacking || this.guard.ticks > 0)) {
      this.guard.ticks--;
      if (seen.attacking) this.guard.low = seen.level === 'low';
      this.hold(o, -1);
      o.down = this.guard.low;
      if (this.guard.ticks <= 0 && !seen.attacking) this.guard = null;
      return o;
    }
    this.guard = null;
    if (this.plan?.kind === 'air' && !me.inAir) this.plan = null;

    if (me.state !== 'idle' && me.state !== 'walk' && me.state !== 'crouch') {
      if (me.state === 'jump' && this.plan && this.plan.airAttack && me.y < 140 && me.vy < 0) {
        o[this.plan.airAttack] = true;
        this.plan.airAttack = null;
      }
      return o;
    }

    if (this.reactToThreats(o, me, seen, dist)) return o;

    if (--this.thinkTimer <= 0 || !this.plan) this.makePlan(me, seen, dist, def);
    return this.executePlan(o);
  }

  reactToThreats(o, me, seen, dist) {
    const { cfg } = this;
    if (seen.attacking && dist < seen.reach + 70 && this.reacted.attack !== seen.attackId) {
      this.reacted.attack = seen.attackId;
      if (this.rng() < cfg.blockChance) {
        this.guard = { ticks: 14, low: seen.level === 'low' };
        this.hold(o, -1);
        o.down = this.guard.low;
        return true;
      }
    }

    const incoming = seen.projActive && Math.sign(seen.projVx) === -this.towardSign;
    if (incoming && Math.abs(seen.projX - me.x) < PROJECTILE_ALERT && this.reacted.proj !== seen.projId) {
      this.reacted.proj = seen.projId;
      const roll = this.rng();
      if (roll < cfg.blockChance * 0.5) {
        this.plan = { kind: 'jump', dir: 1, ticks: 1 };
        this.thinkTimer = 30;
      } else if (roll < cfg.blockChance) {
        this.guard = { ticks: 30, low: false };
        this.hold(o, -1);
        return true;
      }
    }

    if (seen.inAir && dist < 300 && this.reacted.jump !== seen.jumpId) {
      this.reacted.jump = seen.jumpId;
      const roll = this.rng();
      if (roll < cfg.antiAirChance) {
        this.plan = { kind: 'press', buttons: ['hp'], dir: 0, ticks: 1 };
        this.thinkTimer = 20;
      } else if (roll < cfg.antiAirChance + cfg.blockChance * 0.5) {
        this.guard = { ticks: 24, low: false };
        this.hold(o, -1);
        return true;
      }
    }
    return false;
  }

  makePlan(me, seen, dist, def) {
    const { cfg } = this;
    const r = this.rng();
    this.thinkTimer = this.rand(cfg.think[0], cfg.think[1]);
    const specials = def.specials || {};
    const canSuper = def.super && me.meter >= def.super.cost;

    if (this.rng() < cfg.mistakeChance) {
      const pick = ['lp', 'lk', 'hp', 'hk'][this.rand(0, 3)];
      this.plan = r < 0.5 ? { kind: 'press', buttons: [pick], dir: 0, ticks: 1 } : { kind: 'wait', ticks: this.thinkTimer };
      return;
    }

    if (canSuper && dist < 520 && r < cfg.superChance * 0.35) {
      this.plan = { kind: 'press', buttons: ['super'], dir: 0, ticks: 1 };
      return;
    }

    if (dist > FAR) {
      if (specials.neutral && r < cfg.zoning) {
        this.plan = { kind: 'press', buttons: ['special'], dir: 0, ticks: 1 };
      } else if (r < cfg.zoning + cfg.jumpChance) {
        this.plan = { kind: 'jump', dir: 1, ticks: 1 };
      } else {
        this.plan = { kind: 'walk', dir: 1, ticks: this.thinkTimer };
      }
      return;
    }

    if (dist > CLOSE) {
      if (specials.forward && r < cfg.specialChance * 0.5) {
        this.plan = { kind: 'press', buttons: ['special'], dir: 1, ticks: 1 };
      } else if (specials.neutral && r < cfg.specialChance * 0.5 + cfg.zoning * 0.4) {
        this.plan = { kind: 'press', buttons: ['special'], dir: 0, ticks: 1 };
      } else if (r < cfg.specialChance * 0.5 + cfg.zoning * 0.4 + cfg.jumpChance) {
        this.plan = { kind: 'jump', dir: 1, ticks: 1, airAttack: this.rng() < 0.5 ? 'hk' : 'hp' };
      } else if (r < 0.35 + cfg.aggression * 0.6) {
        this.plan = { kind: 'walk', dir: 1, ticks: this.thinkTimer };
      } else {
        this.plan = { kind: 'walk', dir: -1, ticks: Math.ceil(this.thinkTimer / 2) };
      }
      return;
    }

    if (r < cfg.aggression) {
      const options = [
        ['lp'], ['lk'], ['hp'], ['hk'], ['lk', 'down'], ['hk', 'down'], ['lp', 'down'],
      ];
      if (specials.down) options.push(['special', 'down']);
      if (specials.forward && this.rng() < cfg.specialChance) options.push(['special', 'forward']);
      const [button, modifier] = options[this.rand(0, options.length - 1)];
      this.plan = {
        kind: 'press', buttons: [button], dir: modifier === 'forward' ? 1 : 0, down: modifier === 'down', ticks: 1,
      };
    } else if (r < cfg.aggression + (1 - cfg.aggression) * 0.5) {
      this.plan = { kind: 'guard', ticks: this.thinkTimer, low: this.rng() < 0.5 };
    } else {
      this.plan = { kind: 'walk', dir: -1, ticks: Math.ceil(this.thinkTimer / 2) };
    }
  }

  executePlan(o) {
    const plan = this.plan;
    if (!plan) return o;
    switch (plan.kind) {
      case 'walk':
        this.hold(o, plan.dir);
        break;
      case 'jump':
        o.up = true;
        this.hold(o, plan.dir);
        this.plan = plan.airAttack ? { kind: 'air', airAttack: plan.airAttack, ticks: 60 } : null;
        return o;
      case 'press':
        for (const b of plan.buttons) o[b] = true;
        this.hold(o, plan.dir);
        o.down = !!plan.down;
        this.plan = { kind: 'wait', ticks: 4 };
        return o;
      case 'guard':
        this.hold(o, -1);
        o.down = plan.low;
        break;
      default:
        break;
    }
    if (--plan.ticks <= 0) this.plan = null;
    return o;
  }
}
