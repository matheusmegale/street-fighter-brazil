/** Procedural effect textures, drawn once at boot at low resolution (scaled up with nearest filtering). */

function canvas(scene, key, w, h, draw) {
  if (scene.textures.exists(key)) return;
  const tex = scene.textures.createCanvas(key, w, h);
  const ctx = tex.getContext();
  ctx.imageSmoothingEnabled = false;
  draw(ctx, w, h);
  tex.refresh();
}

function star(ctx, cx, cy, outer, inner, points, rotation = -Math.PI / 2) {
  ctx.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = rotation + (i * Math.PI) / points;
    const x = cx + Math.cos(a) * r;
    const y = cy + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

export function createEffectTextures(scene) {
  canvas(scene, 'fx-spark', 32, 32, (ctx) => {
    ctx.fillStyle = '#ff9d00';
    star(ctx, 16, 16, 16, 5, 8);
    ctx.fill();
    ctx.fillStyle = '#ffe14d';
    star(ctx, 16, 16, 11, 4, 8, -Math.PI / 2 + 0.2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(12, 12, 8, 8);
  });

  canvas(scene, 'fx-block', 32, 32, (ctx) => {
    ctx.strokeStyle = '#7fe3ff';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(16, 16, 12, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    star(ctx, 16, 16, 9, 3, 4);
    ctx.fill();
  });

  canvas(scene, 'fx-shot', 44, 14, (ctx) => {
    const g = ctx.createLinearGradient(0, 0, 44, 0);
    g.addColorStop(0, 'rgba(255,170,0,0)');
    g.addColorStop(0.5, '#ffb300');
    g.addColorStop(1, '#ffffff');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(0, 7);
    ctx.lineTo(30, 1);
    ctx.lineTo(44, 7);
    ctx.lineTo(30, 13);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#fff6c2';
    ctx.fillRect(28, 5, 12, 4);
  });

  canvas(scene, 'fx-star', 36, 36, (ctx) => {
    const glow = ctx.createRadialGradient(18, 18, 2, 18, 18, 18);
    glow.addColorStop(0, 'rgba(255,90,80,0.9)');
    glow.addColorStop(1, 'rgba(200,0,20,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, 36, 36);
    ctx.fillStyle = '#e0202a';
    star(ctx, 18, 18, 15, 6.5, 5);
    ctx.fill();
    ctx.fillStyle = '#fff0e0';
    star(ctx, 18, 18, 8, 3.5, 5);
    ctx.fill();
  });

  canvas(scene, 'fx-wave', 56, 120, (ctx, w, h) => {
    for (let y = 0; y < h; y++) {
      const off = Math.sin(y / 9) * 4;
      const fade = Math.min(1, y / 10, (h - y) / 10);
      ctx.fillStyle = `rgba(31,158,58,${0.85 * fade})`;
      ctx.fillRect(6 + off, y, w - 14, 1);
    }
    ctx.fillStyle = '#ffd400';
    ctx.beginPath();
    ctx.moveTo(28, 18);
    ctx.lineTo(50, 60);
    ctx.lineTo(28, 102);
    ctx.lineTo(6, 60);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#1b3d8f';
    ctx.beginPath();
    ctx.arc(28, 60, 13, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(16, 58, 24, 2);
    for (let y = 0; y < h; y++) {
      const off = Math.sin(y / 9) * 4;
      ctx.fillStyle = `rgba(255,232,120,${0.7 * Math.min(1, y / 10, (h - y) / 10)})`;
      ctx.fillRect(w - 10 + off, y, 3, 1);
    }
  });

  canvas(scene, 'fx-dust', 18, 12, (ctx) => {
    ctx.fillStyle = 'rgba(235,225,210,0.9)';
    ctx.beginPath();
    ctx.arc(6, 7, 5, 0, Math.PI * 2);
    ctx.arc(12, 6, 6, 0, Math.PI * 2);
    ctx.fill();
  });

  canvas(scene, 'fx-shadow', 64, 12, (ctx) => {
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath();
    ctx.ellipse(32, 6, 31, 5, 0, 0, Math.PI * 2);
    ctx.fill();
  });

  canvas(scene, 'fx-ring', 64, 64, (ctx) => {
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(32, 32, 28, 0, Math.PI * 2);
    ctx.stroke();
  });

  canvas(scene, 'fx-flash', 64, 64, (ctx) => {
    const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 64);
  });

  canvas(scene, 'fx-pixel', 4, 4, (ctx) => {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, 4, 4);
  });
}
