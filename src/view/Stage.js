import { WIDTH, STAGE_WIDTH } from '../config/game.js';

/**
 * "Praça dos Três Poderes": a stylised, fictional Brasília at sunset, drawn procedurally
 * at half resolution into canvas textures (once), then shown as parallax layers.
 */
const H = 360;
const CAMERA_TRAVEL = STAGE_WIDTH - WIDTH;
const LAYERS = [
  { key: 'stage-sky', scroll: 0, draw: drawSky },
  { key: 'stage-far', scroll: 0.25, draw: drawFar },
  { key: 'stage-mid', scroll: 0.5, draw: drawCongress },
  { key: 'stage-near', scroll: 0.8, draw: drawNear },
  { key: 'stage-floor', scroll: 1, draw: drawFloor },
];

const layerWidth = (scroll) => Math.ceil((WIDTH + CAMERA_TRAVEL * scroll) / 2);

export function createStageTextures(scene) {
  for (const layer of LAYERS) {
    if (scene.textures.exists(layer.key)) continue;
    const w = layerWidth(layer.scroll);
    const tex = scene.textures.createCanvas(layer.key, w, H);
    const ctx = tex.getContext();
    ctx.imageSmoothingEnabled = false;
    layer.draw(ctx, w);
    tex.refresh();
  }
}

/** Adds the layers to a scene; returns the flag image so it can wave. */
export function buildStage(scene, { dim = 0 } = {}) {
  const images = LAYERS.map((layer) =>
    scene.add.image(0, 0, layer.key).setOrigin(0, 0).setScale(2).setScrollFactor(layer.scroll).setDepth(-10),
  );
  if (dim > 0) {
    scene.add.rectangle(0, 0, WIDTH, 720, 0x05080f, dim).setOrigin(0, 0).setScrollFactor(0).setDepth(-5);
  }
  return images;
}

function rect(ctx, color, x, y, w, h) {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}

function drawSky(ctx, w) {
  const g = ctx.createLinearGradient(0, 0, 0, 260);
  g.addColorStop(0, '#16224f');
  g.addColorStop(0.45, '#5b3a78');
  g.addColorStop(0.8, '#d9675a');
  g.addColorStop(1, '#f5a855');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, H);
  // Banded retro sun.
  const sx = 430;
  const sy = 222;
  for (let y = -46; y <= 46; y++) {
    if (y > 8 && Math.floor((y - 8) / 4) % 2 === 1) continue;
    const half = Math.sqrt(46 * 46 - y * y);
    const t = (y + 46) / 92;
    ctx.fillStyle = `rgb(255,${Math.round(230 - 90 * t)},${Math.round(120 - 60 * t)})`;
    ctx.fillRect(Math.round(sx - half), sy + y, Math.round(half * 2), 1);
  }
  // Pixel clouds.
  const cloud = (x, y, s) => {
    rect(ctx, 'rgba(255,190,170,0.55)', x, y, 46 * s, 6 * s);
    rect(ctx, 'rgba(255,210,190,0.6)', x + 8 * s, y - 4 * s, 26 * s, 5 * s);
    rect(ctx, 'rgba(120,70,120,0.35)', x + 4 * s, y + 6 * s, 40 * s, 2 * s);
  };
  cloud(60, 70, 1.4);
  cloud(250, 120, 1);
  cloud(520, 60, 1.2);
  cloud(560, 150, 0.8);
  for (let i = 0; i < 40; i++) {
    const x = (i * 97) % w;
    const y = (i * 53) % 90;
    rect(ctx, 'rgba(255,255,255,0.5)', x, y, 1, 1);
  }
}

function drawFar(ctx, w) {
  const base = 262;
  // Esplanada: rows of identical ministry blocks.
  for (let i = 0; i < 9; i++) {
    const x = 30 + i * 74;
    rect(ctx, '#4a3a68', x, base - 46, 44, 46);
    for (let fy = base - 42; fy < base - 4; fy += 5) rect(ctx, '#6c5a8c', x + 3, fy, 38, 2);
  }
  // TV tower.
  rect(ctx, '#3b2f57', 690, base - 150, 4, 150);
  rect(ctx, '#3b2f57', 684, base - 120, 16, 6);
  rect(ctx, '#e04848', 691, base - 156, 2, 6);
  // Cathedral crown.
  ctx.fillStyle = '#3b2f57';
  for (let i = 0; i < 9; i++) {
    const x = 90 + i * 6;
    ctx.beginPath();
    ctx.moveTo(x, base);
    ctx.quadraticCurveTo(114, base - 40, 116 + (i - 4) * 3, base - 66);
    ctx.lineTo(118 + (i - 4) * 3, base - 66);
    ctx.quadraticCurveTo(116, base - 40, x + 4, base);
    ctx.fill();
  }
  rect(ctx, '#32284b', 0, base, w, H - base);
}

function drawCongress(ctx, w) {
  const cx = Math.round(w / 2);
  const top = 236;
  const lit = '#f2e2c8';
  const shade = '#b99c8c';
  const dark = '#6d5167';
  // Reflecting pool.
  rect(ctx, '#3c4f8a', 0, 262, w, 10);
  rect(ctx, '#f5a855', cx - 120, 264, 240, 1);
  // Platform.
  rect(ctx, lit, cx - 260, top, 520, 16);
  rect(ctx, shade, cx - 260, top + 16, 520, 10);
  rect(ctx, dark, cx - 260, top + 26, 520, 2);
  // Twin towers with the connecting bridge.
  for (const dx of [-14, 6]) {
    rect(ctx, lit, cx + dx, top - 128, 12, 128);
    rect(ctx, shade, cx + dx + 8, top - 128, 4, 128);
    for (let y = top - 124; y < top; y += 4) rect(ctx, 'rgba(90,70,110,0.35)', cx + dx + 1, y, 10, 1);
  }
  rect(ctx, lit, cx - 4, top - 78, 12, 8);
  // Senate dome (convex).
  ctx.fillStyle = lit;
  ctx.beginPath();
  ctx.arc(cx - 120, top, 30, Math.PI, 0);
  ctx.fill();
  ctx.fillStyle = shade;
  ctx.beginPath();
  ctx.arc(cx - 120, top, 30, -Math.PI / 4, 0);
  ctx.lineTo(cx - 120, top);
  ctx.fill();
  // Chamber bowl (concave).
  ctx.fillStyle = lit;
  ctx.beginPath();
  ctx.moveTo(cx + 70, top - 30);
  ctx.quadraticCurveTo(cx + 120, top + 6, cx + 170, top - 30);
  ctx.lineTo(cx + 166, top - 30);
  ctx.quadraticCurveTo(cx + 120, top - 18, cx + 74, top - 30);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(cx + 74, top - 30);
  ctx.quadraticCurveTo(cx + 120, top - 18, cx + 166, top - 30);
  ctx.quadraticCurveTo(cx + 120, top + 4, cx + 74, top - 30);
  ctx.fillStyle = shade;
  ctx.fill();
  rect(ctx, shade, cx + 116, top - 12, 8, 12);
  // Ramp.
  ctx.fillStyle = lit;
  ctx.beginPath();
  ctx.moveTo(cx - 40, top + 26);
  ctx.lineTo(cx - 10, top);
  ctx.lineTo(cx + 10, top);
  ctx.lineTo(cx - 20, top + 26);
  ctx.fill();
}

function columns(ctx, x, y, width, height, count, lit, shade) {
  const step = width / count;
  for (let i = 0; i <= count; i++) {
    const cx = x + i * step;
    ctx.fillStyle = lit;
    ctx.beginPath();
    ctx.moveTo(cx - step * 0.45, y);
    ctx.quadraticCurveTo(cx, y + height * 0.55, cx - 1, y + height);
    ctx.lineTo(cx + 1, y + height);
    ctx.quadraticCurveTo(cx, y + height * 0.55, cx + step * 0.45, y);
    ctx.fill();
    rect(ctx, shade, cx, y + height * 0.4, 1, height * 0.6);
  }
}

function drawFlag(ctx, x, y, w, h) {
  rect(ctx, '#1f9e3a', x, y, w, h);
  ctx.fillStyle = '#ffd400';
  ctx.beginPath();
  ctx.moveTo(x + w / 2, y + 3);
  ctx.lineTo(x + w - 4, y + h / 2);
  ctx.lineTo(x + w / 2, y + h - 3);
  ctx.lineTo(x + 4, y + h / 2);
  ctx.fill();
  ctx.fillStyle = '#1b3d8f';
  ctx.beginPath();
  ctx.arc(x + w / 2, y + h / 2, h * 0.24, 0, Math.PI * 2);
  ctx.fill();
  rect(ctx, '#ffffff', x + w / 2 - h * 0.22, y + h / 2 - 1, h * 0.44, 1);
}

function drawNear(ctx, w) {
  const base = 282;
  const lit = '#efe3d0';
  const shade = '#a88f86';
  // Planalto (left) and the court building (right): flat slabs on curved columns.
  rect(ctx, '#2d3a66', 30, base - 34, 260, 22);
  rect(ctx, lit, 22, base - 40, 276, 6);
  columns(ctx, 30, base - 34, 260, 34, 12, lit, shade);
  rect(ctx, shade, 22, base - 2, 276, 2);

  rect(ctx, '#2d3a66', w - 270, base - 30, 220, 20);
  rect(ctx, lit, w - 278, base - 36, 236, 6);
  columns(ctx, w - 270, base - 30, 220, 30, 10, lit, shade);
  rect(ctx, shade, w - 278, base - 2, 236, 2);

  // Flag mast.
  const mx = Math.round(w / 2) + 10;
  rect(ctx, '#d9d2c5', mx, 40, 3, base - 40);
  rect(ctx, '#8b7f75', mx + 2, 40, 1, base - 40);
  drawFlag(ctx, mx + 3, 44, 54, 36);
  // Lamps.
  for (const lx of [330, 410, w - 330, w - 410]) {
    rect(ctx, '#3a3150', lx, base - 46, 2, 46);
    rect(ctx, '#ffe9a8', lx - 3, base - 50, 8, 4);
  }
}

function drawFloor(ctx, w) {
  const top = 285;
  const g = ctx.createLinearGradient(0, top, 0, H);
  g.addColorStop(0, '#a7927f');
  g.addColorStop(1, '#d8c7ad');
  ctx.fillStyle = g;
  ctx.fillRect(0, top, w, H - top);
  rect(ctx, '#7c6a63', 0, top, w, 2);
  // Paver joints in perspective towards a vanishing point.
  const vx = w / 2;
  const vy = 200;
  ctx.strokeStyle = 'rgba(100,80,70,0.35)';
  ctx.lineWidth = 1;
  for (let i = -24; i <= 24; i++) {
    const bx = vx + i * 46;
    ctx.beginPath();
    ctx.moveTo(vx + (bx - vx) * ((top - vy) / (H - vy)), top);
    ctx.lineTo(bx, H);
    ctx.stroke();
  }
  let y = top + 4;
  let gap = 4;
  while (y < H) {
    rect(ctx, 'rgba(100,80,70,0.3)', 0, y, w, 1);
    gap *= 1.35;
    y += gap;
  }
}
