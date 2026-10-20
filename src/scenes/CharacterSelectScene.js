import Phaser from 'phaser';
import { WIDTH, HEIGHT } from '../config/game.js';
import { CHARACTER_LIST } from '../characters/index.js';
import { buildStage } from '../view/Stage.js';
import { arcadeText } from '../ui/text.js';
import { input } from '../input/InputManager.js';
import { sound } from '../audio/Sound.js';

const CARD_W = 210;
const CARD_H = 244;
const CARD_Y = 330;
const PLAYER_COLORS = [0x37a3ff, 0xff4a4a];

export class CharacterSelectScene extends Phaser.Scene {
  constructor() {
    super('Select');
  }

  init(data) {
    this.mode = data.mode || 'cpu';
    this.difficulty = data.difficulty || 'normal';
  }

  create() {
    sound.music('menu');
    this.cameras.main.setBounds(0, 0, 1920, HEIGHT).setScroll(320, 0);
    buildStage(this, { dim: 0.7 });
    arcadeText(this, WIDTH / 2, 56, 'ESCOLHA SEU LUTADOR', 32, '#ffd400').setScrollFactor(0);
    const modeLabel = this.mode === 'cpu' ? `CONTRA CPU · ${{ easy: 'FÁCIL', normal: 'NORMAL', hard: 'DIFÍCIL' }[this.difficulty]}` : 'VERSUS LOCAL';
    arcadeText(this, WIDTH / 2, 100, modeLabel, 14, '#9fd3ff').setScrollFactor(0);

    const n = CHARACTER_LIST.length;
    this.cards = CHARACTER_LIST.map((def, i) => {
      const x = WIDTH / 2 + (i - (n - 1) / 2) * (CARD_W + 30);
      this.add.rectangle(x, CARD_Y, CARD_W + 8, CARD_H + 8, 0x0b1020).setScrollFactor(0);
      const img = this.add.image(x, CARD_Y, `${def.id}-portrait`).setScrollFactor(0);
      img.setScale(Math.min(CARD_W / img.width, CARD_H / img.height));
      arcadeText(this, x, CARD_Y + CARD_H / 2 + 26, def.shortName, 16, '#ffffff').setScrollFactor(0);
      img.setInteractive({ useHandCursor: true }).on('pointerdown', () => this.pointerPick(i));
      return { x, def };
    });

    this.players = [0, 1].map((p) => this.createPlayer(p));
    this.starting = false;
    this.enterPressed = false;
    this.escapePressed = false;
    this.input.keyboard.on('keydown-ENTER', () => { this.enterPressed = true; });
    this.input.keyboard.on('keydown-ESC', () => { this.escapePressed = true; });
    input.resetMenu();
  }

  createPlayer(p) {
    const cpu = p === 1 && this.mode === 'cpu';
    const color = PLAYER_COLORS[p];
    const frame = this.add.rectangle(0, CARD_Y, CARD_W + 16, CARD_H + 16).setStrokeStyle(6, color).setScrollFactor(0)
      .setDepth(5);
    const tag = arcadeText(this, 0, CARD_Y - CARD_H / 2 - 24, cpu ? 'CPU' : `${p + 1}P`, 16, p ? '#ff6b6b' : '#6bc6ff')
      .setScrollFactor(0).setDepth(6);
    const sideX = p === 0 ? 170 : WIDTH - 170;
    const preview = this.add.sprite(sideX, 560, CHARACTER_LIST[0].id, 'idle_0').setScale(2).setScrollFactor(0)
      .setFlipX(p === 1);
    const name = arcadeText(this, sideX, 600, '', 16, '#ffffff').setScrollFactor(0);
    const style = arcadeText(this, sideX, 628, '', 10, '#c9d2ff').setScrollFactor(0);
    const status = arcadeText(this, sideX, 660, '', 12, '#ffd400').setScrollFactor(0);
    const player = { p, cpu, index: p % this.cards.length, confirmed: false, frame, tag, preview, name, style, status };
    if (cpu) {
      player.index = 1 % this.cards.length;
      status.setText('AGUARDANDO...');
    }
    this.place(player, true);
    return player;
  }

  place(player, silent = false) {
    const card = this.cards[player.index];
    const offset = this.players && this.players[1 - player.p]?.index === player.index ? (player.p ? 6 : -6) : 0;
    player.frame.setPosition(card.x + offset, CARD_Y);
    player.tag.setPosition(card.x + (player.p ? 40 : -40), CARD_Y - CARD_H / 2 - 24);
    const def = card.def;
    player.preview.play(`${def.id}-idle`);
    player.preview.setTint(player.p === 1 && this.players?.[0].index === player.index ? 0xc8ffc8 : 0xffffff);
    player.name.setText(def.shortName);
    player.style.setText(def.style.toUpperCase());
    if (!silent) sound.play('select');
  }

  move(player, dir) {
    if (player.confirmed) return;
    player.index = (player.index + dir + this.cards.length) % this.cards.length;
    this.place(player);
    this.players.forEach((other) => other !== player && this.place(other, true));
  }

  confirm(player) {
    if (player.confirmed) return;
    player.confirmed = true;
    player.status.setText('PRONTO!');
    player.preview.play(`${this.cards[player.index].def.id}-victory`);
    sound.play('confirm');
    this.tweens.add({ targets: player.frame, alpha: 0.4, duration: 80, yoyo: true, repeat: 3 });
    if (this.mode === 'cpu' && player.p === 0) this.cpuPick();
    this.checkReady();
  }

  cpuPick() {
    const cpu = this.players[1];
    cpu.status.setText('ESCOLHENDO...');
    const others = this.cards.map((_, i) => i).filter((i) => i !== this.players[0].index);
    const target = others.length ? others[0] : this.players[0].index;
    let steps = 7;
    this.time.addEvent({
      delay: 110,
      repeat: steps - 1,
      callback: () => {
        steps--;
        cpu.index = steps === 0 ? target : (cpu.index + 1) % this.cards.length;
        this.place(cpu);
        if (steps === 0) this.confirm(cpu);
      },
    });
  }

  unconfirm(player) {
    player.confirmed = false;
    player.status.setText('');
    player.preview.play(`${this.cards[player.index].def.id}-idle`);
    sound.play('back');
  }

  checkReady() {
    if (!this.players.every((pl) => pl.confirmed) || this.starting) return;
    this.starting = true;
    const [a, b] = this.players.map((pl) => this.cards[pl.index].def.id);
    const vs = arcadeText(this, WIDTH / 2, CARD_Y, 'VS', 120, '#ff4a4a', { strokeThickness: 16 }).setScrollFactor(0)
      .setDepth(20).setScale(3).setAlpha(0);
    this.tweens.add({ targets: vs, scale: 1, alpha: 1, duration: 300, ease: 'Back.Out' });
    sound.play('fight');
    this.time.delayedCall(1300, () => {
      this.scene.start('Fight', { mode: this.mode, difficulty: this.difficulty, p1: a, p2: b });
    });
  }

  pointerPick(i) {
    const player = this.players.find((pl) => !pl.confirmed && !pl.cpu);
    if (!player) return;
    player.index = i;
    this.place(player);
    this.confirm(player);
  }

  update() {
    if (this.starting) return;
    const [m1, m2, any] = input.pollMenu();
    const [p1, p2] = this.players;
    if (this.mode === 'cpu') {
      // Any key set (and Enter / Esc) drives player 1 against the CPU.
      if (any.left) this.move(p1, -1);
      if (any.right) this.move(p1, 1);
      if (any.confirm) this.confirm(p1);
      if (any.back && !p1.confirmed) this.leave();
      return;
    }
    if (m1.left) this.move(p1, -1);
    if (m1.right) this.move(p1, 1);
    if (m1.confirm || this.enterPressed) this.confirm(p1);
    if (m1.back && p1.confirmed) this.unconfirm(p1);
    if (m2.left) this.move(p2, -1);
    if (m2.right) this.move(p2, 1);
    if (m2.confirm) this.confirm(p2);
    if (m2.back && p2.confirmed) this.unconfirm(p2);
    if ((m1.back || m2.back) && !p1.confirmed && !p2.confirmed) this.escapePressed = true;
    if (this.escapePressed) {
      if (p1.confirmed || p2.confirmed) this.players.forEach((pl) => pl.confirmed && this.unconfirm(pl));
      else this.leave();
    }
    this.enterPressed = false;
    this.escapePressed = false;
  }

  leave() {
    sound.play('back');
    this.scene.start('Menu');
  }
}
