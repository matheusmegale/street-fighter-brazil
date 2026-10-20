import Phaser from 'phaser';
import { WIDTH, HEIGHT, GROUND_Y, STAGE_WIDTH, STEP_MS } from '../config/game.js';
import { CHARACTERS } from '../characters/index.js';
import { Match, FPS } from '../combat/Match.js';
import { toWorld } from '../combat/HitboxSystem.js';
import { FighterAI } from '../ai/FighterAI.js';
import { buildStage } from '../view/Stage.js';
import { FighterSprite } from '../view/FighterSprite.js';
import { Effects, ProjectileViews, SuperCutIn } from '../view/Effects.js';
import { Hud } from '../ui/Hud.js';
import { arcadeText } from '../ui/text.js';
import { input } from '../input/InputManager.js';
import { sound } from '../audio/Sound.js';

const MAX_STEPS_PER_FRAME = 5;
const RESULT_DELAY_MS = 1600;
const WINNER_CALL_FRAME = 75;

export class FightScene extends Phaser.Scene {
  constructor() {
    super('Fight');
  }

  init(data) {
    this.config = { mode: 'cpu', difficulty: 'normal', p1: 'bolsonaro', p2: 'lula', ...data };
  }

  create() {
    const { mode, difficulty, p1, p2 } = this.config;
    this.defs = [CHARACTERS[p1], CHARACTERS[p2]];
    this.match = new Match({ characters: this.defs, stageWidth: STAGE_WIDTH });
    this.ai = mode === 'cpu' ? new FighterAI({ difficulty }) : null;

    this.cameras.main.setBounds(0, 0, STAGE_WIDTH, HEIGHT);
    buildStage(this);
    const mirror = p1 === p2;
    this.views = this.match.fighters.map(
      (f, i) => new FighterSprite(this, f, { depth: 10 + i, tint: mirror && i === 1 ? 0xb8ffb8 : null }),
    );
    this.projectileViews = new ProjectileViews(this, this.defs);
    this.effects = new Effects(this);
    this.cutIn = new SuperCutIn(this);
    const labels = mode === 'cpu' ? ['1P', 'CPU'] : ['1P', '2P'];
    this.hud = new Hud(this, this.match, this.defs, labels);
    this.debugGraphics = this.add.graphics().setDepth(70);
    this.debug = false;
    this.paused = false;
    this.leaving = false;
    this.accumulator = 0;
    this.createPauseMenu();

    this.input.keyboard.on('keydown-F1', () => {
      this.debug = !this.debug;
      this.debugGraphics.clear();
    });
    this.input.keyboard.on('keydown-ESC', () => this.togglePause());

    this.updateCamera(true);
    sound.music('fight');
    this.announceRound(this.match.round);
    input.resetMenu();
  }

  createPauseMenu() {
    const dim = this.add.rectangle(0, 0, WIDTH, HEIGHT, 0x05080f, 0.75).setOrigin(0, 0);
    const title = arcadeText(this, WIDTH / 2, 260, 'PAUSA', 48, '#ffd400');
    this.pauseItems = [
      { label: 'CONTINUAR', action: () => this.togglePause() },
      { label: 'MENU PRINCIPAL', action: () => this.exitTo('Menu') },
    ].map((item, i) => ({ ...item, text: arcadeText(this, WIDTH / 2, 360 + i * 56, item.label, 24, '#ffffff') }));
    const help = arcadeText(this, WIDTH / 2, 520, 'F1: MOSTRAR HITBOXES', 12, '#9fd3ff');
    this.pauseLayer = [dim, title, help, ...this.pauseItems.map((it) => it.text)];
    this.pauseLayer.forEach((o) => o.setScrollFactor(0).setDepth(200).setVisible(false));
    this.pauseIndex = 0;
  }

  togglePause() {
    if (this.leaving) return;
    this.paused = !this.paused;
    this.pauseLayer.forEach((o) => o.setVisible(this.paused));
    this.pauseIndex = 0;
    this.highlightPause();
    if (this.paused) {
      this.tweens.pauseAll();
      input.resetMenu();
    } else {
      this.tweens.resumeAll();
      this.accumulator = 0;
    }
  }

  highlightPause() {
    this.pauseItems.forEach((it, i) => it.text.setColor(i === this.pauseIndex ? '#ffd400' : '#ffffff'));
  }

  updatePause() {
    const m = input.pollMenu()[2];
    if (m.up || m.down) {
      this.pauseIndex = (this.pauseIndex + 1) % this.pauseItems.length;
      this.highlightPause();
      sound.play('select');
    }
    if (m.confirm) {
      sound.play('confirm');
      this.pauseItems[this.pauseIndex].action();
    }
  }

  update(time, delta) {
    if (this.paused) {
      this.updatePause();
      return;
    }
    this.accumulator += Math.min(delta, STEP_MS * MAX_STEPS_PER_FRAME);
    while (this.accumulator >= STEP_MS) {
      this.tick();
      this.accumulator -= STEP_MS;
    }
    this.render();
  }

  tick() {
    const { match } = this;
    const p1 = input.player(0);
    const p2 = this.ai ? this.ai.update(match.sim, 1) : input.player(1);
    match.step(p1, p2);
    for (const e of match.events) this.handleEvent(e);

    if (match.phase === 'roundOver' && match.phaseFrame === WINNER_CALL_FRAME) this.announceWinner();
    if (match.phase === 'fight') this.spawnTrails();
  }

  spawnTrails() {
    for (const f of this.match.fighters) {
      if (f.state === 'attack' && f.move.effect === 'dust' && f.phase === 'active' && f.moveFrame % 4 === 0) {
        this.effects.dust(f.x - f.facing * 60, f.facing);
      }
    }
  }

  handleEvent(e) {
    const { effects, hud } = this;
    switch (e.type) {
      case 'roundStart':
        this.projectileViews.clear();
        this.announceRound(e.round);
        break;
      case 'fightCall':
        hud.announce('FIGHT!', { color: '#ff4a4a', size: 96, hold: 600 });
        sound.play('fight');
        break;
      case 'attackStart': {
        const f = this.match.fighters[e.fighter];
        if (e.kind === 'special') {
          sound.play(f.move.sfx || 'special');
          if (f.move.effect === 'crowdBurst') effects.ring(f.x, 120, f.def.colors.primary, 9);
        } else if (e.kind === 'normal') {
          sound.play('whoosh');
        }
        break;
      }
      case 'super': {
        const def = this.defs[e.fighter];
        const ms = ((def.super.freeze || 30) / FPS) * 1000;
        this.cutIn.play(def, e.fighter, ms);
        effects.flash(0xffffff, 0.5, 200);
        sound.play('super');
        break;
      }
      case 'hit': {
        const kind = e.kind === 'super' ? 'super' : e.heavy || e.kind === 'special' ? 'heavy' : 'hit';
        effects.spark(e.x, e.y, kind);
        this.views[e.defender].flash();
        hud.onHit(e.defender);
        if (e.combo >= 2) hud.showCombo(e.attacker, e.combo);
        if (kind === 'super') {
          sound.play('superHit');
          effects.shake(0.012, 260);
        } else if (kind === 'heavy') {
          sound.play('heavy');
          effects.shake(0.006, 140);
        } else {
          sound.play('light');
        }
        break;
      }
      case 'block':
        effects.spark(e.x, e.y, 'block');
        sound.play('block');
        break;
      case 'clash':
        effects.spark(e.x, e.y, 'clash');
        sound.play('heavy');
        break;
      case 'ko':
        effects.flash(0xffffff, 0.8, 300);
        sound.play('ko');
        break;
      case 'roundOver':
        this.onRoundOver(e);
        break;
      case 'matchOver':
        this.time.delayedCall(RESULT_DELAY_MS, () => this.showResult(e.winner));
        break;
      default:
        break;
    }
  }

  announceRound(round) {
    const last = this.match.wins.every((w) => w === this.match.roundsToWin - 1);
    this.hud.announce(last ? 'ROUND FINAL' : `ROUND ${round}`, { size: last ? 56 : 72, hold: 1100 });
    sound.play('round');
  }

  onRoundOver(e) {
    if (e.reason === 'ko') {
      this.hud.announce(e.winner === null ? 'DOUBLE K.O.' : 'K.O.', { color: '#ff4a4a', size: 110, hold: 1000 });
    } else {
      this.hud.announce('TIME OVER', { color: '#ffffff', size: 72, hold: 1000 });
      sound.play('ko');
    }
  }

  announceWinner() {
    const { winner } = this.match.lastResult;
    if (winner === null) {
      this.hud.announce('EMPATE', { color: '#ffffff', hold: 1200 });
      return;
    }
    const finalRound = this.match.wins[winner] >= this.match.roundsToWin;
    let text = `${this.defs[winner].shortName} VENCE`;
    if (finalRound) {
      if (this.config.mode === 'cpu') text = winner === 0 ? 'YOU WIN!' : 'YOU LOSE';
      else text = winner === 0 ? 'P1 WINS!' : 'P2 WINS!';
    }
    const perfect = this.match.fighters[winner].health === this.match.fighters[winner].maxHealth;
    this.hud.announce(text, { size: 64, hold: 1300, subtitle: perfect ? 'PERFEITO!' : '' });
    if (finalRound) sound.play('victory');
  }

  showResult(winner) {
    if (this.leaving) return;
    this.exitTo('Result', { ...this.config, winner, wins: [...this.match.wins] });
  }

  exitTo(scene, data = {}) {
    this.leaving = true;
    this.tweens.resumeAll();
    this.scene.start(scene, data);
  }

  updateCamera(snap = false) {
    const [a, b] = this.match.fighters;
    const target = Phaser.Math.Clamp((a.x + b.x) / 2 - WIDTH / 2, 0, STAGE_WIDTH - WIDTH);
    const cam = this.cameras.main;
    cam.scrollX = snap ? target : cam.scrollX + (target - cam.scrollX) * 0.2;
  }

  render() {
    const clock = this.match.sim.frame;
    this.views.forEach((v) => v.sync(clock));
    this.projectileViews.sync(this.match.sim.projectiles, clock);
    this.updateCamera();
    this.hud.update();
    if (this.debug) this.drawDebug();
  }

  drawDebug() {
    const g = this.debugGraphics;
    g.clear();
    const draw = (b, color) => g.lineStyle(2, color, 1).strokeRect(b.left, GROUND_Y - b.top, b.right - b.left, b.top - b.bottom);
    const w = {};
    for (const f of this.match.fighters) {
      for (const hb of f.hurtboxes()) draw(toWorld(hb, f.x, f.y, f.facing, w), 0x37a3ff);
      draw(toWorld({ x: -f.halfWidth, y: 0, w: f.halfWidth * 2, h: f.pushHeight }, f.x, f.y, f.facing, w), 0xffffff);
      if (f.state === 'attack' && f.move.hitbox && f.phase === 'active') draw(toWorld(f.move.hitbox, f.x, f.y, f.facing, w), 0xff3030);
    }
    for (const p of this.match.sim.projectiles) draw(p.box(w), 0xff9a1f);
  }
}
