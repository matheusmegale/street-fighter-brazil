import Phaser from 'phaser';
import { CHARACTER_LIST } from '../characters/index.js';
import { WIDTH, HEIGHT, FONT } from '../config/game.js';
import { createEffectTextures } from '../view/textures.js';
import { createStageTextures } from '../view/Stage.js';
import { input } from '../input/InputManager.js';
import { sound } from '../audio/Sound.js';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  preload() {
    const bar = this.add.rectangle(WIDTH / 2 - 200, HEIGHT / 2, 0, 16, 0xffd400).setOrigin(0, 0.5);
    this.add.rectangle(WIDTH / 2, HEIGHT / 2, 408, 24).setStrokeStyle(2, 0xffffff);
    this.load.on('progress', (v) => bar.setSize(400 * v, 16));

    for (const def of CHARACTER_LIST) {
      const { base, atlas, portrait, superArt, extra } = def.assets;
      this.load.atlas(def.id, `${base}${atlas}.png`, `${base}${atlas}.json`);
      this.load.image(`${def.id}-${portrait}`, `${base}${portrait}.png`);
      this.load.image(`${def.id}-${superArt}`, `${base}${superArt}.png`);
      for (const name of extra) this.load.image(`${def.id}-${name}`, `${base}${name}.png`);
    }
  }

  create() {
    createEffectTextures(this);
    createStageTextures(this);
    for (const def of CHARACTER_LIST) {
      for (const [name, anim] of Object.entries(def.animations)) {
        this.anims.create({
          key: `${def.id}-${name}`,
          frames: anim.frames.map((frame) => ({ key: def.id, frame })),
          frameRate: anim.fps,
          repeat: -1,
        });
      }
    }
    input.attach(window);
    input.onFirstInput = () => sound.unlock();

    const start = () => this.scene.start('Menu');
    if (document.fonts?.load) document.fonts.load(`16px ${FONT}`).then(start, start);
    else start();
  }
}
