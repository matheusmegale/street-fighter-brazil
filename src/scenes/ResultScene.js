import Phaser from 'phaser';
import { WIDTH, HEIGHT } from '../config/game.js';
import { CHARACTERS } from '../characters/index.js';
import { buildStage } from '../view/Stage.js';
import { arcadeText } from '../ui/text.js';
import { input } from '../input/InputManager.js';
import { sound } from '../audio/Sound.js';

export class ResultScene extends Phaser.Scene {
  constructor() {
    super('Result');
  }

  init(data) {
    this.data_ = data;
  }

  create() {
    const { mode, p1, p2, winner, wins } = this.data_;
    const ids = [p1, p2];
    sound.music('menu');
    this.cameras.main.setBounds(0, 0, 1920, HEIGHT).setScroll(320, 0);
    buildStage(this, { dim: 0.6 });

    if (winner === null || winner === undefined) {
      arcadeText(this, WIDTH / 2, 120, 'DRAW GAME', 64, '#ffffff').setScrollFactor(0);
      ids.forEach((id, i) => {
        const def = CHARACTERS[id];
        this.add.sprite(WIDTH / 2 + (i ? 220 : -220), 560, id, 'idle_0').setScale(2.2).setFlipX(i === 1)
          .setScrollFactor(0).play(`${id}-idle`);
        this.add.image(WIDTH / 2 + (i ? 220 : -220), 300, id, def.faces.hurt).setScale(1.4).setScrollFactor(0);
      });
    } else {
      const def = CHARACTERS[ids[winner]];
      const loser = CHARACTERS[ids[1 - winner]];
      const headline = mode === 'cpu' ? (winner === 0 ? 'YOU WIN!' : 'YOU LOSE') : `${winner === 0 ? 'P1' : 'P2'} WINS!`;
      arcadeText(this, WIDTH / 2, 84, headline, 64, winner === 0 || mode !== 'cpu' ? '#ffd400' : '#ff4a4a')
        .setScrollFactor(0);
      arcadeText(this, WIDTH / 2, 150, `${def.shortName}  ${wins[winner]} × ${wins[1 - winner]}  ${loser.shortName}`, 16,
        '#ffffff').setScrollFactor(0);

      const portrait = this.add.image(250, 400, `${def.id}-portrait`).setScale(1.35).setScrollFactor(0);
      portrait.x = -300;
      this.tweens.add({ targets: portrait, x: 250, duration: 500, ease: 'Cubic.Out' });
      const hero = this.add.sprite(WIDTH / 2 + 20, 600, def.id, 'jump_1').setScale(2.3).setScrollFactor(0);
      hero.play(`${def.id}-victory`);
      this.tweens.add({ targets: hero, y: 580, duration: 420, yoyo: true, repeat: -1, ease: 'Sine.InOut' });

      this.add.rectangle(WIDTH - 260, 330, 420, 170, 0x0b1020, 0.9).setStrokeStyle(4, def.colors.primary)
        .setScrollFactor(0);
      this.add.image(WIDTH - 400, 330, def.id, def.faces.win).setScale(1.15).setScrollFactor(0);
      arcadeText(this, WIDTH - 200, 330, `"${def.winQuote}"`, 13, '#ffffff', { wordWrap: 220 }).setScrollFactor(0);
      this.add.image(WIDTH - 120, 470, loser.id, loser.faces.hurt).setScale(0.8).setScrollFactor(0).setAlpha(0.9);
      sound.play('victory');
    }

    this.items = [
      { label: 'REVANCHE', action: () => this.scene.start('Fight', this.data_) },
      { label: 'TROCAR LUTADOR', action: () => this.scene.start('Select', { mode, difficulty: this.data_.difficulty }) },
      { label: 'MENU PRINCIPAL', action: () => this.scene.start('Menu') },
    ];
    this.texts = this.items.map((item, i) => {
      const t = arcadeText(this, WIDTH - 260, 520 + i * 46, item.label, 18, '#ffffff').setScrollFactor(0)
        .setInteractive({ useHandCursor: true });
      t.on('pointerover', () => this.select(i));
      t.on('pointerdown', () => this.activate());
      return t;
    });
    this.select(0, true);
    input.resetMenu();
  }

  select(i, silent = false) {
    this.index = (i + this.items.length) % this.items.length;
    this.texts.forEach((t, n) => t.setColor(n === this.index ? '#ffd400' : '#ffffff'));
    if (!silent) sound.play('select');
  }

  activate() {
    sound.play('confirm');
    this.items[this.index].action();
  }

  update() {
    const m = input.pollMenu()[2];
    if (m.up) this.select(this.index - 1);
    if (m.down) this.select(this.index + 1);
    if (m.confirm) this.activate();
  }
}
