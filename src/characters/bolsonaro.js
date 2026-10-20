import { box } from './shared.js';

/**
 * Hitboxes/hurtboxes are in game pixels relative to the feet, facing right (see HitboxSystem).
 * Frame data is in 60 Hz ticks. `frames` lists atlas frames per move phase.
 */
export default {
  id: 'bolsonaro',
  name: 'Jair Bolsonaro',
  shortName: 'BOLSONARO',
  style: 'Pressão e avanço',
  colors: { primary: 0x1f9e3a, secondary: 0xffd400, accent: 0x1b3d8f },
  assets: {
    base: 'assets/characters/bolsonaro/',
    atlas: 'atlas',
    portrait: 'portrait',
    superArt: 'superart',
    extra: ['superfx'],
  },
  scale: 2,
  // The source sheet draws some rows smaller than the idle row.
  frameScale: { punch: 1.07, kick: 1.07, crouchatk: 1.05, sp1: 1.07, sp3: 1.07, hit: 1.1, ko: 1.05 },

  stats: { health: 1000, walkSpeed: 4.6, backSpeed: 3.6, jumpVelocity: 21, jumpForward: 5.2, gravity: 1 },
  body: { width: 84, standHeight: 280, crouchHeight: 196 },
  hurtboxes: {
    stand: [box(-44, 0, 88, 292)],
    crouch: [box(-48, 0, 96, 200)],
    air: [box(-42, 40, 84, 210)],
  },

  moves: {
    lp: {
      startup: 4, active: 3, recovery: 7, damage: 40, hitstun: 15, blockstun: 10, knockback: 3,
      hitbox: box(52, 180, 76, 40), level: 'mid', meterGain: 6, hitstop: 7, sfx: 'light',
      frames: { startup: ['punch_1'], active: ['punch_3'], recovery: ['punch_1'] },
    },
    hp: {
      startup: 7, active: 3, recovery: 14, damage: 90, hitstun: 20, blockstun: 15, knockback: 5,
      hitbox: box(60, 172, 98, 46), level: 'mid', meterGain: 10, hitstop: 11, sfx: 'heavy',
      frames: { startup: ['punch_2'], active: ['punch_4'], recovery: ['punch_2', 'punch_0'] },
    },
    lk: {
      startup: 5, active: 3, recovery: 9, damage: 50, hitstun: 16, blockstun: 11, knockback: 3,
      hitbox: box(50, 108, 88, 42), level: 'mid', meterGain: 7, hitstop: 8, sfx: 'light',
      frames: { startup: ['kick_0'], active: ['kick_1'], recovery: ['kick_0'] },
    },
    hk: {
      startup: 9, active: 4, recovery: 16, damage: 100, hitstun: 22, blockstun: 16, knockback: 6,
      hitbox: box(62, 150, 108, 64), level: 'mid', meterGain: 11, hitstop: 12, sfx: 'heavy',
      frames: { startup: ['kick_0', 'kick_2'], active: ['kick_3'], recovery: ['kick_2', 'kick_0'] },
    },
    crouchLp: {
      startup: 4, active: 3, recovery: 6, damage: 30, hitstun: 14, blockstun: 9, knockback: 3,
      hitbox: box(50, 98, 76, 36), level: 'mid', meterGain: 5, hitstop: 7, sfx: 'light',
      frames: { startup: ['crouch_1'], active: ['crouchatk_0'], recovery: ['crouch_1'] },
    },
    crouchHp: {
      startup: 6, active: 4, recovery: 12, damage: 70, hitstun: 19, blockstun: 13, knockback: 4,
      hitbox: box(36, 110, 78, 70), level: 'mid', meterGain: 8, hitstop: 10, sfx: 'heavy',
      frames: { startup: ['crouch_1'], active: ['crouchatk_1'], recovery: ['crouch_1'] },
    },
    crouchLk: {
      startup: 5, active: 3, recovery: 9, damage: 40, hitstun: 15, blockstun: 10, knockback: 3,
      hitbox: box(40, 0, 96, 42), level: 'low', meterGain: 6, hitstop: 8, sfx: 'light',
      frames: { startup: ['crouch_2'], active: ['crouchatk_2'], recovery: ['crouch_2'] },
    },
    crouchHk: {
      startup: 8, active: 4, recovery: 20, damage: 85, hitstun: 20, blockstun: 13, knockback: 4,
      hitbox: box(40, 0, 116, 46), level: 'low', knockdown: true, meterGain: 10, hitstop: 12, sfx: 'heavy',
      frames: { startup: ['crouch_2'], active: ['crouchatk_2'], recovery: ['crouch_2', 'crouch_1'] },
    },
    airP: {
      startup: 4, active: 10, recovery: 4, damage: 65, hitstun: 17, blockstun: 11, knockback: 3,
      hitbox: box(20, 60, 104, 120), level: 'overhead', meterGain: 8, hitstop: 9, sfx: 'light',
      frames: { startup: ['jump_1'], active: ['jump_2'], recovery: ['jump_2'] },
    },
    airK: {
      startup: 5, active: 10, recovery: 4, damage: 75, hitstun: 18, blockstun: 12, knockback: 4,
      hitbox: box(30, 20, 124, 110), level: 'overhead', meterGain: 9, hitstop: 10, sfx: 'heavy',
      frames: { startup: ['jump_1'], active: ['jump_0'], recovery: ['jump_0'] },
    },
  },

  specials: {
    neutral: {
      name: 'Tiro Certeiro', startup: 10, active: 4, recovery: 22, meterGain: 8, sfx: 'shot',
      frames: { startup: ['sp1_1'], active: ['sp1_0'], recovery: ['sp1_1'] },
      projectile: {
        visual: 'shot', offsetX: 170, offsetY: 172, w: 76, h: 34, speed: 13, life: 160,
        damage: 75, chip: 0.25, hitstun: 18, blockstun: 14, knockback: 4, hitstop: 8, sfx: 'special',
      },
    },
    forward: {
      name: 'Motociata', startup: 8, active: 22, recovery: 14, damage: 110, chip: 0.25,
      hitstun: 22, blockstun: 16, knockback: 7, knockdown: true, level: 'mid',
      hitbox: box(20, 20, 140, 180), motion: { vx: 11, from: 6, to: 30 },
      meterGain: 10, hitstop: 12, sfx: 'engine', effect: 'dust',
      frames: { startup: ['sp2_0'], active: ['sp2_1', 'sp2_2', 'sp2_3'], recovery: ['sp2_3'] },
      loopActive: true,
    },
    down: {
      name: 'Chute na Esquerda', startup: 8, active: 5, recovery: 20, damage: 120, chip: 0.25,
      hitstun: 22, blockstun: 16, knockback: 6, knockdown: true, level: 'mid',
      hitbox: box(60, 90, 170, 90), motion: { vx: 6, from: 4, to: 12 },
      meterGain: 10, hitstop: 13, sfx: 'heavy',
      frames: { startup: ['kick_0'], active: ['sp3_0'], recovery: ['sp3_1'] },
    },
  },

  super: {
    name: 'Brasil Acima de Tudo', cost: 100, freeze: 50, startup: 12, active: 4, recovery: 36,
    invulnerable: true, sfx: 'super',
    frames: { startup: ['jump_1'], active: ['punch_4'], recovery: ['punch_4', 'punch_2'] },
    projectile: {
      visual: 'sprite', sprite: 'superfx', spriteScale: 1.3, offsetX: 150, offsetY: 150, w: 210, h: 150,
      speed: 14, life: 120, damage: 330, chip: 0.25, hitstun: 30, blockstun: 22, knockback: 6,
      knockdown: true, priority: 2, hitstop: 18, sfx: 'superHit',
    },
  },

  animations: {
    idle: { frames: ['idle_0', 'idle_1', 'idle_2', 'idle_3', 'idle_4', 'idle_3', 'idle_2', 'idle_1'], fps: 9 },
    walk: { frames: ['walk_0', 'walk_1', 'walk_2', 'walk_3'], fps: 9 },
    walkBack: { frames: ['walk_3', 'walk_2', 'walk_1', 'walk_0'], fps: 8 },
    crouch: { frames: ['crouch_1'], fps: 1 },
    jumpUp: { frames: ['jump_1'], fps: 1 },
    jumpDown: { frames: ['jump_3'], fps: 1 },
    block: { frames: ['punch_0'], fps: 1 },
    crouchBlock: { frames: ['crouch_2'], fps: 1 },
    hit: { frames: ['hit_0', 'hit_1', 'hit_2'], fps: 14 },
    crouchHit: { frames: ['crouch_0'], fps: 1 },
    knockdown: { frames: ['ko_0', 'ko_1'], fps: 8 },
    rise: { frames: ['crouch_0', 'crouch_1'], fps: 10 },
    ko: { frames: ['ko_0', 'ko_1'], fps: 6 },
    victory: { frames: ['jump_1'], fps: 1 },
  },
  faces: {
    normal: 'face_normal', hurt: 'face_dor', angry: 'face_raiva', ko: 'face_surpreso',
    win: 'face_sorriso', select: 'face_bravo', talk: 'face_falando', smug: 'face_ironico',
  },
  winQuote: 'Ninguém segura quem tem a faixa!',
};
