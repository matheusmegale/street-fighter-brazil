import Phaser from 'phaser';
import { WIDTH, HEIGHT } from '../config/game.js';
import { buildStage } from '../view/Stage.js';
import { arcadeText } from '../ui/text.js';
import { input } from '../input/InputManager.js';
import { sound } from '../audio/Sound.js';
import { settings, saveSettings } from '../config/settings.js';
import { ACTIONS, DEFAULT_BINDINGS, keyLabel, rebind } from '../input/bindings.js';

const DIFFICULTIES = ['easy', 'normal', 'hard'];
const DIFFICULTY_LABEL = { easy: 'FÁCIL', normal: 'NORMAL', hard: 'DIFÍCIL' };
const ACTION_LABEL = {
  left: 'ESQUERDA', right: 'DIREITA', up: 'PULAR', down: 'AGACHAR', lp: 'SOCO FRACO', hp: 'SOCO FORTE',
  lk: 'CHUTE FRACO', hk: 'CHUTE FORTE', special: 'ESPECIAL', super: 'SUPERATAQUE',
};

export class SettingsScene extends Phaser.Scene {
  constructor() {
    super('Settings');
  }

  create() {
    this.cameras.main.setBounds(0, 0, 1920, HEIGHT).setScroll(320, 0);
    buildStage(this, { dim: 0.8 });
    this.title = arcadeText(this, WIDTH / 2, 60, '', 32, '#ffd400').setScrollFactor(0);
    this.hint = arcadeText(this, WIDTH / 2, HEIGHT - 40, '', 12, '#9fd3ff').setScrollFactor(0);
    this.rows = [];
    this.capturing = false;
    this.showMain();
    input.resetMenu();
  }

  setRows(entries) {
    this.rows.forEach((r) => {
      r.label.destroy();
      r.value.destroy();
    });
    this.entries = entries;
    const top = entries.length > 8 ? 130 : 180;
    const gap = entries.length > 8 ? 44 : 56;
    this.rows = entries.map((e, i) => {
      const y = top + i * gap;
      const centered = !e.value;
      return {
        label: arcadeText(this, centered ? WIDTH / 2 : WIDTH / 2 - 24, y, e.label, 18, '#ffffff', {
          originX: centered ? 0.5 : 1,
        }).setScrollFactor(0),
        value: arcadeText(this, WIDTH / 2 + 24, y, '', 18, '#9fd3ff', { originX: 0 }).setScrollFactor(0),
      };
    });
    this.index = 0;
    this.refresh();
  }

  refresh() {
    this.entries.forEach((e, i) => {
      const selected = i === this.index;
      const row = this.rows[i];
      row.label.setColor(selected ? '#ffd400' : '#ffffff');
      if (!e.value) return;
      const value = e.value();
      row.value.setText(e.change ? `‹ ${value} ›` : value).setColor(selected ? '#ffd400' : '#9fd3ff');
    });
  }

  showMain() {
    this.page = 'main';
    this.title.setText('CONFIGURAÇÕES');
    this.hint.setText('←/→ ALTERA   ·   ENTER CONFIRMA   ·   ESC VOLTA');
    const volume = (key) => ({
      value: () => `${Math.round(settings[key] * 10)}`,
      change: (d) => {
        settings[key] = Math.min(1, Math.max(0, Math.round(settings[key] * 10 + d) / 10));
        sound.applyVolumes();
        sound.play('select');
      },
    });
    this.setRows([
      {
        label: 'DIFICULDADE CPU',
        value: () => DIFFICULTY_LABEL[settings.difficulty],
        change: (d) => {
          const i = DIFFICULTIES.indexOf(settings.difficulty);
          settings.difficulty = DIFFICULTIES[(i + d + DIFFICULTIES.length) % DIFFICULTIES.length];
        },
      },
      { label: 'MÚSICA', ...volume('musicVolume') },
      { label: 'EFEITOS', ...volume('sfxVolume') },
      { label: 'CONTROLES JOGADOR 1', action: () => this.showControls(0) },
      { label: 'CONTROLES JOGADOR 2', action: () => this.showControls(1) },
      {
        label: 'RESTAURAR CONTROLES PADRÃO',
        action: () => {
          input.setBindings(DEFAULT_BINDINGS);
          sound.play('confirm');
        },
      },
      { label: 'VOLTAR', action: () => this.leave() },
    ]);
  }

  showControls(player) {
    this.page = 'controls';
    this.player = player;
    this.title.setText(`CONTROLES JOGADOR ${player + 1}`);
    this.hint.setText('ENTER E DEPOIS A NOVA TECLA   ·   ESC VOLTA   ·   CONTROLES TAMBÉM VIA GAMEPAD');
    this.setRows([
      ...ACTIONS.map((action) => ({
        label: ACTION_LABEL[action],
        value: () => keyLabel(input.bindings[player][action]),
        action: () => this.capture(player, action),
      })),
      { label: 'VOLTAR', action: () => this.showMain() },
    ]);
  }

  capture(player, action) {
    this.capturing = true;
    this.rows[this.index].value.setText('PRESSIONE UMA TECLA...');
    input.captureNextKey((code) => {
      this.capturing = false;
      if (code !== 'Escape') {
        input.setBindings(rebind(input.bindings, player, action, code));
        sound.play('confirm');
      }
      input.resetMenu();
      this.refresh();
    });
  }

  leave() {
    saveSettings();
    this.scene.start('Menu');
  }

  update() {
    if (this.capturing) return;
    const m = input.pollMenu()[2];
    const entry = this.entries[this.index];
    if (m.up || m.down) {
      this.index = (this.index + (m.up ? -1 : 1) + this.entries.length) % this.entries.length;
      sound.play('select');
      this.refresh();
    }
    if ((m.left || m.right) && entry.change) {
      entry.change(m.left ? -1 : 1);
      this.refresh();
    }
    if (m.confirm && entry.action) {
      sound.play('confirm');
      entry.action();
    }
    if (m.back) {
      sound.play('back');
      if (this.page === 'controls') this.showMain();
      else this.leave();
    }
  }
}
