import { FONT } from '../config/game.js';

/** Arcade-style text: pixel font, thick dark outline, drop shadow. */
export function arcadeText(scene, x, y, str, size = 16, color = '#ffffff', options = {}) {
  const t = scene.add.text(x, y, str, {
    fontFamily: FONT,
    fontSize: `${size}px`,
    color,
    stroke: options.stroke || '#0b1020',
    strokeThickness: options.strokeThickness ?? Math.max(4, Math.round(size / 4)),
    align: options.align || 'center',
    ...(options.wordWrap ? { wordWrap: { width: options.wordWrap } } : {}),
  });
  if (options.shadow !== false) t.setShadow(0, Math.max(2, size / 8), '#000000', 0, true, true);
  t.setOrigin(options.originX ?? 0.5, options.originY ?? 0.5);
  return t;
}
