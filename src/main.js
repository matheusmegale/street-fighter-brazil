import Phaser from 'phaser';
import '@fontsource/press-start-2p/400.css';
import { WIDTH, HEIGHT } from './config/game.js';
import { BootScene } from './scenes/BootScene.js';
import { MenuScene } from './scenes/MenuScene.js';
import { CharacterSelectScene } from './scenes/CharacterSelectScene.js';
import { FightScene } from './scenes/FightScene.js';
import { ResultScene } from './scenes/ResultScene.js';
import { SettingsScene } from './scenes/SettingsScene.js';

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: WIDTH,
  height: HEIGHT,
  backgroundColor: '#05080f',
  pixelArt: true,
  roundPixels: true,
  banner: false,
  fps: { target: 60 },
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  scene: [BootScene, MenuScene, CharacterSelectScene, FightScene, ResultScene, SettingsScene],
});

if (import.meta.env.DEV) window.__game = game;
