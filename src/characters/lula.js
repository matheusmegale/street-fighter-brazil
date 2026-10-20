import { box } from './shared.js';

/** See bolsonaro.js for units and conventions. */
export default {
  id: 'lula',
  name: 'Luiz Inácio Lula da Silva',
  shortName: 'LULA',
  style: 'Resistência e área',
  colors: { primary: 0xd7262e, secondary: 0xffd400, accent: 0x1b3d8f },
  assets: {
    base: 'assets/characters/lula/',
    atlas: 'atlas',
    portrait: 'portrait',
    superArt: 'superart',
    extra: [],
  },
  scale: 2,
  frameScale: { hit: 1.12 },

  stats: { health: 1040, walkSpeed: 4.2, backSpeed: 3.4, jumpVelocity: 20.5, jumpForward: 5, gravity: 1 },
  body: { width: 88, standHeight: 280, crouchHeight: 196 },
  hurtboxes: {
    stand: [box(-46, 0, 92, 290)],
    crouch: [box(-50, 0, 100, 198)],
    air: [box(-44, 40, 88, 205)],
  },

  moves: {
    lp: {
      startup: 4, active: 3, recovery: 7, damage: 42, hitstun: 15, blockstun: 10, knockback: 3,
      hitbox: box(52, 170, 80, 40), level: 'mid', meterGain: 6, hitstop: 7, sfx: 'light',
      frames: { startup: ['punch_1'], active: ['punch_3'], recovery: ['punch_1'] },
    },
    hp: {
      startup: 8, active: 3, recovery: 15, damage: 95, hitstun: 20, blockstun: 15, knockback: 5,
      hitbox: box(60, 165, 100, 48), level: 'mid', meterGain: 10, hitstop: 11, sfx: 'heavy',
      frames: { startup: ['punch_2'], active: ['punch_4'], recovery: ['punch_2', 'punch_0'] },
    },
    lk: {
      startup: 5, active: 3, recovery: 9, damage: 48, hitstun: 16, blockstun: 11, knockback: 3,
      hitbox: box(40, 105, 74, 46), level: 'mid', meterGain: 7, hitstop: 8, sfx: 'light',
      frames: { startup: ['kick_0'], active: ['kick_1'], recovery: ['kick_0'] },
    },
    hk: {
      startup: 10, active: 4, recovery: 17, damage: 105, hitstun: 22, blockstun: 16, knockback: 6,
      hitbox: box(64, 140, 112, 64), level: 'mid', meterGain: 11, hitstop: 12, sfx: 'heavy',
      frames: { startup: ['kick_0', 'kick_2'], active: ['kick_3'], recovery: ['kick_2', 'kick_0'] },
    },
    crouchLp: {
      startup: 4, active: 3, recovery: 6, damage: 30, hitstun: 14, blockstun: 9, knockback: 3,
      hitbox: box(48, 96, 72, 36), level: 'mid', meterGain: 5, hitstop: 7, sfx: 'light',
      frames: { startup: ['crouch_1'], active: ['crouchatk_0'], recovery: ['crouch_1'] },
    },
    crouchHp: {
      startup: 6, active: 4, recovery: 13, damage: 75, hitstun: 19, blockstun: 13, knockback: 4,
      hitbox: box(30, 110, 76, 74), level: 'mid', meterGain: 8, hitstop: 10, sfx: 'heavy',
      frames: { startup: ['crouch_1'], active: ['crouchatk_1'], recovery: ['crouch_1'] },
    },
    crouchLk: {
      startup: 5, active: 3, recovery: 9, damage: 40, hitstun: 15, blockstun: 10, knockback: 3,
      hitbox: box(40, 0, 92, 42), level: 'low', meterGain: 6, hitstop: 8, sfx: 'light',
      frames: { startup: ['crouch_2'], active: ['crouchatk_2'], recovery: ['crouch_2'] },
    },
    crouchHk: {
      startup: 8, active: 4, recovery: 20, damage: 85, hitstun: 20, blockstun: 13, knockback: 4,
      hitbox: box(40, 0, 108, 46), level: 'low', knockdown: true, meterGain: 10, hitstop: 12, sfx: 'heavy',
      frames: { startup: ['crouch_2'], active: ['crouchatk_2'], recovery: ['crouch_2', 'crouch_1'] },
    },
    airP: {
      startup: 4, active: 10, recovery: 4, damage: 65, hitstun: 17, blockstun: 11, knockback: 3,
      hitbox: box(20, 60, 110, 120), level: 'overhead', meterGain: 8, hitstop: 9, sfx: 'light',
      frames: { startup: ['jump_1'], active: ['jump_2'], recovery: ['jump_2'] },
    },
    airK: {
      startup: 5, active: 10, recovery: 4, damage: 78, hitstun: 18, blockstun: 12, knockback: 4,
      hitbox: box(30, 20, 130, 110), level: 'overhead', meterGain: 9, hitstop: 10, sfx: 'heavy',
      frames: { startup: ['jump_1'], active: ['jump_0'], recovery: ['jump_0'] },
    },
  },

  specials: {
    neutral: {
      name: 'Discurso do Povo', startup: 12, active: 4, recovery: 24, meterGain: 8, sfx: 'speech',
      frames: { startup: ['sp1_1'], active: ['sp1_0'], recovery: ['sp1_1'] },
      projectile: {
        visual: 'star', offsetX: 150, offsetY: 180, w: 64, h: 64, speed: 9, life: 200,
        damage: 82, chip: 0.25, hitstun: 19, blockstun: 15, knockback: 4, hitstop: 9, sfx: 'special',
      },
    },
    forward: {
      name: 'Chute do Povo', startup: 9, active: 6, recovery: 20, damage: 115, chip: 0.25,
      hitstun: 22, blockstun: 16, knockback: 6, knockdown: true, level: 'mid',
      hitbox: box(60, 80, 180, 90), motion: { vx: 9, from: 5, to: 14 },
      meterGain: 10, hitstop: 13, sfx: 'heavy',
      frames: { startup: ['kick_0'], active: ['sp3_0'], recovery: ['sp3_1'] },
    },
    down: {
      name: 'Paz e Diálogo', startup: 12, active: 10, recovery: 26, damage: 100, chip: 0.25,
      hitstun: 24, blockstun: 16, knockback: 8, level: 'mid', invulnerable: true,
      hitbox: box(-210, 0, 420, 320), meterGain: 10, hitstop: 12, sfx: 'crowd', effect: 'crowdBurst',
      frames: { startup: ['jump_1'], active: ['sp2_0'], recovery: ['sp2_0', 'idle_0'] },
    },
  },

  super: {
    name: 'União do Brasil', cost: 100, freeze: 50, startup: 14, active: 6, recovery: 40,
    invulnerable: true, sfx: 'super',
    frames: { startup: ['jump_1'], active: ['sp2_0'], recovery: ['sp2_0', 'idle_0'] },
    projectile: {
      visual: 'wave', offsetX: 130, offsetY: 160, w: 170, h: 320, speed: 8, life: 150,
      hits: 4, hitInterval: 6, damage: 80, chip: 0.25, hitstun: 22, blockstun: 14, knockback: 2,
      knockdown: true, priority: 2, hitstop: 10, sfx: 'superHit',
    },
  },

  animations: {
    idle: { frames: ['idle_0', 'idle_1', 'idle_2', 'idle_3', 'idle_4', 'idle_3', 'idle_2', 'idle_1'], fps: 8 },
    walk: { frames: ['walk_0', 'walk_1', 'walk_2', 'walk_3'], fps: 8 },
    walkBack: { frames: ['walk_3', 'walk_2', 'walk_1', 'walk_0'], fps: 7 },
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
    normal: 'face_normal', hurt: 'face_dor', angry: 'face_bravo', ko: 'face_surpreso',
    win: 'face_sorriso', select: 'face_determinado', talk: 'face_falando', smug: 'face_ironico',
  },
  winQuote: 'O povo unido jamais será vencido!',
};
