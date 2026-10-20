import { GROUND_Y, WIDTH, HEIGHT } from '../config/game.js';
import { arcadeText } from '../ui/text.js';

/** Small pool of images reused for short-lived visual effects. */
class ImagePool {
  constructor(scene, size, depth) {
    this.items = Array.from({ length: size }, () =>
      scene.add.image(0, 0, 'fx-spark').setVisible(false).setActive(false).setDepth(depth),
    );
    this.next = 0;
  }

  get() {
    const img = this.items[this.next];
    this.next = (this.next + 1) % this.items.length;
    img.scene.tweens.killTweensOf(img);
    img.setActive(true).setVisible(true).setAlpha(1).setAngle(0).clearTint().setFlipX(false);
    return img;
  }
}

const SPARKS = {
  hit: { texture: 'fx-spark', scale: 2.4, grow: 1.5, ms: 160 },
  heavy: { texture: 'fx-spark', scale: 3.6, grow: 1.6, ms: 220 },
  super: { texture: 'fx-spark', scale: 5, grow: 1.8, ms: 320 },
  block: { texture: 'fx-block', scale: 2.2, grow: 1.4, ms: 160 },
  clash: { texture: 'fx-spark', scale: 4, grow: 2, ms: 260 },
};

/** Hit sparks, dust, rings, flashes and screen shake. World coordinates use y-up sim space. */
export class Effects {
  constructor(scene) {
    this.scene = scene;
    this.pool = new ImagePool(scene, 32, 30);
    this.flashRect = scene.add.rectangle(0, 0, WIDTH, HEIGHT, 0xffffff, 0).setOrigin(0, 0)
      .setScrollFactor(0).setDepth(80);
  }

  spark(x, y, kind = 'hit') {
    const cfg = SPARKS[kind] || SPARKS.hit;
    const img = this.pool.get().setTexture(cfg.texture).setPosition(x, GROUND_Y - y)
      .setScale(cfg.scale).setAngle(Math.random() * 360);
    if (kind === 'super') img.setTint(0xfff3a0);
    this.scene.tweens.add({
      targets: img, scale: cfg.scale * cfg.grow, alpha: 0, duration: cfg.ms, ease: 'Quad.Out',
      onComplete: () => img.setVisible(false).setActive(false),
    });
  }

  dust(x, dir) {
    const img = this.pool.get().setTexture('fx-dust').setPosition(x, GROUND_Y - 8).setScale(2.5)
      .setFlipX(dir < 0);
    this.scene.tweens.add({
      targets: img, x: x - dir * 40, y: GROUND_Y - 30, scale: 4, alpha: 0, duration: 380,
      onComplete: () => img.setVisible(false).setActive(false),
    });
  }

  ring(x, y, color = 0xffffff, size = 6) {
    const img = this.pool.get().setTexture('fx-ring').setPosition(x, GROUND_Y - y).setScale(1).setTint(color);
    this.scene.tweens.add({
      targets: img, scale: size, alpha: 0, duration: 420, ease: 'Cubic.Out',
      onComplete: () => img.setVisible(false).setActive(false),
    });
  }

  flash(color = 0xffffff, alpha = 0.6, ms = 160) {
    this.flashRect.setFillStyle(color, alpha);
    this.scene.tweens.killTweensOf(this.flashRect);
    this.flashRect.setAlpha(1);
    this.scene.tweens.add({ targets: this.flashRect, alpha: 0, duration: ms });
  }

  shake(intensity = 0.006, ms = 120) {
    this.scene.cameras.main.shake(ms, intensity);
  }
}

const PROJECTILE_LOOK = {
  shot: { texture: 'fx-shot', scale: 3 },
  star: { texture: 'fx-star', scale: 2.6, spin: 9 },
  wave: { texture: 'fx-wave', scale: 2.7, wobble: true },
};

/** Keeps one image per live projectile in the simulation. */
export class ProjectileViews {
  constructor(scene, defs) {
    this.scene = scene;
    this.defs = defs;
    this.views = new Map();
    this.free = [];
  }

  sync(projectiles, clock) {
    for (const view of this.views.values()) view.seen = false;
    for (const p of projectiles) {
      let view = this.views.get(p.id);
      if (!view) {
        view = this.create(p);
        this.views.set(p.id, view);
      }
      view.seen = true;
      const img = view.img;
      img.setPosition(Math.round(p.x), Math.round(GROUND_Y - p.y));
      if (view.look.spin) img.setAngle(clock * view.look.spin);
      if (view.look.wobble) img.setScale(view.look.scale * (1 + Math.sin(clock / 3) * 0.06), view.look.scale);
      img.setAlpha(clock % 4 < 2 ? 1 : 0.85);
    }
    for (const [id, view] of this.views) {
      if (!view.seen) {
        view.img.setVisible(false);
        this.free.push(view.img);
        this.views.delete(id);
      }
    }
  }

  create(p) {
    const spec = p.spec;
    const look = spec.visual === 'sprite'
      ? { texture: `${this.defs[p.owner].id}-${spec.sprite}`, scale: spec.spriteScale || 1 }
      : PROJECTILE_LOOK[spec.visual] || PROJECTILE_LOOK.shot;
    const img = (this.free.pop() || this.scene.add.image(0, 0, look.texture)).setVisible(true).setDepth(20);
    img.setTexture(look.texture).setScale(look.scale).setAngle(0).setFlipX(p.facing < 0);
    return { img, look, seen: true };
  }

  clear() {
    this.sync([], 0);
  }
}

/** Full-screen "super art" banner shown during the super's freeze. */
export class SuperCutIn {
  constructor(scene) {
    this.scene = scene;
    this.dim = scene.add.rectangle(0, 0, WIDTH, HEIGHT, 0x05080f, 0.7).setOrigin(0, 0).setScrollFactor(0)
      .setDepth(60).setVisible(false);
    this.band = scene.add.rectangle(0, 360, WIDTH, 300, 0x0b1020, 0.9).setOrigin(0, 0.5).setScrollFactor(0)
      .setDepth(61).setVisible(false);
    this.art = scene.add.image(0, 360, '__DEFAULT').setScrollFactor(0).setDepth(62).setVisible(false);
    this.title = arcadeText(scene, WIDTH / 2, 560, '', 34, '#ffd400').setScrollFactor(0).setDepth(63).setVisible(false);
  }

  play(def, side, durationMs) {
    const { scene } = this;
    const key = `${def.id}-${def.assets.superArt}`;
    const fromLeft = side === 0;
    this.art.setTexture(key);
    const scale = Math.min(1180 / this.art.width, 280 / this.art.height);
    this.art.setScale(scale).setFlipX(!fromLeft);
    [this.dim, this.band, this.art, this.title].forEach((o) => {
      scene.tweens.killTweensOf(o);
      o.setVisible(true).setAlpha(1);
    });
    this.band.setFillStyle(def.colors.primary, 0.85);
    this.title.setText(def.super.name.toUpperCase());
    this.art.x = fromLeft ? -600 : WIDTH + 600;
    scene.tweens.add({ targets: this.art, x: WIDTH / 2, duration: 220, ease: 'Back.Out' });
    this.title.setScale(0.2);
    scene.tweens.add({ targets: this.title, scale: 1, duration: 260, ease: 'Back.Out', delay: 120 });
    scene.tweens.add({
      targets: [this.dim, this.band, this.art, this.title], alpha: 0, duration: 180, delay: durationMs - 180,
      onComplete: () => [this.dim, this.band, this.art, this.title].forEach((o) => o.setVisible(false)),
    });
  }
}
