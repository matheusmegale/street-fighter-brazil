import Phaser from 'phaser';
import { WIDTH, HEIGHT } from '../config/game.js';
import { buildStage } from '../view/Stage.js';
import { arcadeText } from '../ui/text.js';
import { input } from '../input/InputManager.js';
import { sound } from '../audio/Sound.js';
import { settings } from '../config/settings.js';

const DIFFICULTIES = [
  { id: 'easy', label: 'FÁCIL' },
  { id: 'normal', label: 'NORMAL' },
  { id: 'hard', label: 'DIFÍCIL' },
];

export class MenuScene extends Phaser.Scene {
  constructor() {
    super('Menu');
  }

  create() {
    sound.music('menu');
    this.cameras.main.setBounds(0, 0, 1920, HEIGHT).setScroll(320, 0);
    buildStage(this, { dim: 0.55 });

    const left = this.add.image(140, 430, 'bolsonaro-portrait').setScale(1.45).setAlpha(0.95).setScrollFactor(0);
    const right = this.add.image(WIDTH - 140, 430, 'lula-portrait').setScale(1.45).setFlipX(true).setAlpha(0.95)
      .setScrollFactor(0);
    this.tweens.add({ targets: left, x: 170, duration: 600, ease: 'Cubic.Out' });
    this.tweens.add({ targets: right, x: WIDTH - 170, duration: 600, ease: 'Cubic.Out' });

    const brasil = arcadeText(this, WIDTH / 2, 120, 'BRASIL', 76, '#2fd14f', { stroke: '#0b3d18', strokeThickness: 14 });
    const fighters = arcadeText(this, WIDTH / 2, 205, 'FIGHTERS', 60, '#ffd400', { stroke: '#7a3b00', strokeThickness: 12 });
    [brasil, fighters].forEach((t) => t.setScrollFactor(0));
    this.tweens.add({ targets: [brasil, fighters], y: '+=6', duration: 900, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
    arcadeText(this, WIDTH / 2, 262, 'ARENA: PRAÇA DOS TRÊS PODERES', 14, '#ffffff').setScrollFactor(0);

    this.mainItems = [
      { label: 'JOGAR', action: () => this.startSelect('cpu', settings.difficulty) },
      { label: 'CONTRA CPU', action: () => this.openDifficulty() },
      { label: 'VERSUS LOCAL', action: () => this.startSelect('versus') },
      { label: 'CONFIGURAÇÕES', action: () => this.scene.start('Settings') },
    ];
    this.difficultyItems = [
      ...DIFFICULTIES.map((d) => ({ label: d.label, action: () => this.startSelect('cpu', d.id) })),
      { label: 'VOLTAR', action: () => this.closeDifficulty() },
    ];
    this.texts = [];
    this.cursor = arcadeText(this, 0, 0, '►', 24, '#ffd400').setScrollFactor(0);
    this.tweens.add({ targets: this.cursor, alpha: 0.3, duration: 350, yoyo: true, repeat: -1 });
    this.header = arcadeText(this, WIDTH / 2, 330, '', 16, '#9fd3ff').setScrollFactor(0);
    this.showItems(this.mainItems, '');

    arcadeText(this, WIDTH / 2, HEIGHT - 52, 'ENTER / F CONFIRMA   ·   ESC VOLTA   ·   SETAS / WASD NAVEGAM', 12, '#c9d2ff')
      .setScrollFactor(0);
    arcadeText(this, WIDTH / 2, HEIGHT - 26, 'PARÓDIA DE HUMOR FICTÍCIA. QUALQUER SEMELHANÇA É PURA CARICATURA.', 10, '#8890b0')
      .setScrollFactor(0);
    input.resetMenu();
  }

  showItems(items, header) {
    this.texts.forEach((t) => t.destroy());
    this.items = items;
    this.index = 0;
    this.header.setText(header);
    this.texts = items.map((item, i) => {
      const t = arcadeText(this, WIDTH / 2, 380 + i * 52, item.label, 24, '#ffffff').setScrollFactor(0)
        .setInteractive({ useHandCursor: true });
      t.on('pointerover', () => this.select(i));
      t.on('pointerdown', () => this.activate());
      return t;
    });
    this.select(0, true);
  }

  select(i, silent = false) {
    this.index = (i + this.items.length) % this.items.length;
    this.texts.forEach((t, n) => t.setColor(n === this.index ? '#ffd400' : '#ffffff').setScale(n === this.index ? 1.1 : 1));
    const t = this.texts[this.index];
    this.cursor.setPosition(t.x - t.displayWidth / 2 - 34, t.y);
    if (!silent) sound.play('select');
  }

  activate() {
    sound.play('confirm');
    this.items[this.index].action();
  }

  openDifficulty() {
    this.showItems(this.difficultyItems, 'DIFICULDADE DA CPU');
    const current = DIFFICULTIES.findIndex((d) => d.id === settings.difficulty);
    this.select(Math.max(0, current), true);
  }

  closeDifficulty() {
    this.showItems(this.mainItems, '');
    this.select(1, true);
  }

  startSelect(mode, difficulty) {
    this.scene.start('Select', { mode, difficulty });
  }

  update() {
    const m = input.pollMenu()[2];
    if (m.up) this.select(this.index - 1);
    if (m.down) this.select(this.index + 1);
    if (m.confirm) this.activate();
    if (m.back && this.items === this.difficultyItems) {
      sound.play('back');
      this.closeDifficulty();
    }
  }
}
