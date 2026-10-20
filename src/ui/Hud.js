import { WIDTH } from '../config/game.js';
import { METER_MAX } from '../entities/Fighter.js';
import { arcadeText } from './text.js';

const BAR_W = 470;
const BAR_H = 26;
const BAR_Y = 52;
const METER_W = 300;
const METER_Y = 694;
const MARGIN = 92;
const TRAIL_DELAY = 30;

/** Arcade HUD drawn in screen space. Reads match/fighter state; never changes it. */
export class Hud {
  constructor(scene, match, defs, labels) {
    this.scene = scene;
    this.match = match;
    this.defs = defs;
    this.sides = [0, 1].map((i) => this.createSide(i, defs[i], labels[i]));
    const timerBox = scene.add.rectangle(WIDTH / 2, BAR_Y + 4, 92, 70, 0x0b1020, 0.85)
      .setStrokeStyle(4, 0xffd400);
    this.timerText = arcadeText(scene, WIDTH / 2, BAR_Y + 6, '99', 32, '#ffffff');
    this.announcer = arcadeText(scene, WIDTH / 2, 300, '', 72, '#ffd400', { strokeThickness: 12 }).setVisible(false);
    this.subtitle = arcadeText(scene, WIDTH / 2, 390, '', 24, '#ffffff').setVisible(false);
    for (const o of [timerBox, this.timerText, this.announcer, this.subtitle]) o.setScrollFactor(0).setDepth(90);
    this.announcer.setDepth(95);
    this.subtitle.setDepth(95);
    this.lastTimer = null;
  }

  createSide(i, def, label) {
    const { scene } = this;
    const right = i === 1;
    const x0 = right ? WIDTH - MARGIN : MARGIN;
    const dir = right ? -1 : 1;
    const origin = right ? 1 : 0;
    const objects = [];
    const add = (o) => {
      objects.push(o.setScrollFactor(0).setDepth(90));
      return o;
    };

    add(scene.add.rectangle(x0 - dir * 4, BAR_Y, BAR_W + 8, BAR_H + 8, 0x0b1020).setOrigin(origin, 0.5));
    add(scene.add.rectangle(x0, BAR_Y, BAR_W, BAR_H, 0x3a0d14).setOrigin(origin, 0.5));
    const trail = add(scene.add.rectangle(x0, BAR_Y, BAR_W, BAR_H, 0xff3b3b).setOrigin(origin, 0.5));
    const fill = add(scene.add.rectangle(x0, BAR_Y, BAR_W, BAR_H, 0xffd400).setOrigin(origin, 0.5));
    add(scene.add.rectangle(x0, BAR_Y - 8, BAR_W, 4, 0xffffff, 0.35).setOrigin(origin, 0.5));

    const faceX = right ? WIDTH - 46 : 46;
    add(scene.add.rectangle(faceX, BAR_Y + 4, 76, 76, 0x0b1020).setStrokeStyle(3, def.colors.primary));
    const face = add(scene.add.image(faceX, BAR_Y + 4, def.id, def.faces.normal).setDisplaySize(70, 70).setFlipX(right));

    add(arcadeText(scene, x0, BAR_Y + 34, def.shortName, 16, '#ffffff', { originX: origin, originY: 0 }));
    add(arcadeText(scene, x0 + dir * BAR_W, BAR_Y - 28, label, 14, right ? '#ff6b6b' : '#6bc6ff', { originX: 1 - origin }));

    const stars = [0, 1].map((n) =>
      add(scene.add.star(x0 + dir * (BAR_W - 16 - n * 30), BAR_Y + 46, 5, 6, 13, 0x333a55).setStrokeStyle(2, 0x0b1020)),
    );

    const meterX = right ? WIDTH - 40 : 40;
    add(scene.add.rectangle(meterX - dir * 3, METER_Y, METER_W + 6, 20, 0x0b1020).setOrigin(origin, 0.5));
    const meter = add(scene.add.rectangle(meterX, METER_Y, 0, 14, 0x37a3ff).setOrigin(origin, 0.5));
    for (let s = 1; s < 4; s++) {
      add(scene.add.rectangle(meterX + dir * (METER_W * s) / 4, METER_Y, 2, 14, 0x0b1020).setOrigin(0.5));
    }
    const meterLabel = add(arcadeText(scene, meterX, METER_Y - 22, 'ENERGIA', 12, '#9fd3ff', { originX: origin }));
    const combo = add(arcadeText(scene, right ? WIDTH - 140 : 140, 230, '', 28, '#ffd400', { originX: origin }))
      .setVisible(false);

    return { right, fill, trail, face, stars, meter, meterLabel, combo, trailWidth: BAR_W, trailHold: 0, hurtUntil: 0 };
  }

  onHit(defenderIndex) {
    this.sides[defenderIndex].hurtUntil = this.scene.time.now + 450;
  }

  showCombo(attackerIndex, count) {
    const side = this.sides[attackerIndex];
    side.combo.setText(`${count} HITS!`).setVisible(true).setAlpha(1).setScale(1.3);
    this.scene.tweens.killTweensOf(side.combo);
    this.scene.tweens.add({ targets: side.combo, scale: 1, duration: 120 });
    this.scene.tweens.add({ targets: side.combo, alpha: 0, delay: 900, duration: 300 });
  }

  announce(text, { color = '#ffd400', size = 72, subtitle = '', hold = 900 } = {}) {
    const { scene } = this;
    scene.tweens.killTweensOf([this.announcer, this.subtitle]);
    this.announcer.setText(text).setColor(color).setFontSize(size).setVisible(true).setAlpha(1).setScale(2.4);
    scene.tweens.add({ targets: this.announcer, scale: 1, duration: 220, ease: 'Back.Out' });
    scene.tweens.add({ targets: this.announcer, alpha: 0, delay: hold, duration: 250 });
    this.subtitle.setText(subtitle).setVisible(!!subtitle).setAlpha(1);
    if (subtitle) scene.tweens.add({ targets: this.subtitle, alpha: 0, delay: hold, duration: 250 });
  }

  update() {
    const now = this.scene.time.now;
    const { match } = this;
    match.fighters.forEach((f, i) => {
      const side = this.sides[i];
      const ratio = Math.max(0, f.health) / f.maxHealth;
      const width = BAR_W * ratio;
      side.fill.setSize(width, BAR_H);
      side.fill.fillColor = ratio > 0.5 ? 0xffd400 : ratio > 0.25 ? 0xff9a1f : 0xff4a2b;
      if (side.trailWidth > width) {
        if (side.trailHold++ > TRAIL_DELAY) side.trailWidth = Math.max(width, side.trailWidth - 4);
      } else {
        side.trailWidth = width;
        side.trailHold = 0;
      }
      side.trail.setSize(side.trailWidth, BAR_H);

      const full = f.meter >= METER_MAX;
      side.meter.setSize((METER_W * f.meter) / METER_MAX, 14);
      side.meter.fillColor = full ? (Math.floor(now / 120) % 2 ? 0xffd400 : 0xffffff) : 0x37a3ff;
      if (side.meterFull !== full) {
        side.meterFull = full;
        side.meterLabel.setText(full ? 'SUPER!' : 'ENERGIA').setColor(full ? '#ffd400' : '#9fd3ff');
      }

      const faces = this.defs[i].faces;
      let face = faces.normal;
      if (f.state === 'ko') face = faces.ko;
      else if (f.state === 'victory') face = faces.win;
      else if (now < side.hurtUntil) face = faces.hurt;
      else if (ratio < 0.3) face = faces.angry;
      if (side.face.frame.name !== face) side.face.setFrame(face).setDisplaySize(70, 70);

      side.stars.forEach((star, n) => star.setFillStyle(match.wins[i] > n ? 0xffd400 : 0x333a55));
    });

    const timer = match.timer;
    if (timer !== this.lastTimer) {
      this.lastTimer = timer;
      this.timerText.setText(String(timer).padStart(2, '0'));
      this.timerText.setColor(timer <= 10 ? '#ff5a4a' : '#ffffff');
    }
  }
}
