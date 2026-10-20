/**
 * Boxes in character configs are relative to the fighter's feet while facing right:
 * x = horizontal offset of the box's near edge, y = height of its bottom edge, w/h = size.
 * World boxes use a y-up space where 0 is the floor.
 */
export function toWorld(box, x, y, facing, out = {}) {
  out.left = facing > 0 ? x + box.x : x - box.x - box.w;
  out.right = out.left + box.w;
  out.bottom = y + box.y;
  out.top = out.bottom + box.h;
  return out;
}

export function centeredBox(cx, cy, w, h, out = {}) {
  out.left = cx - w / 2;
  out.right = cx + w / 2;
  out.bottom = cy - h / 2;
  out.top = cy + h / 2;
  return out;
}

export function overlaps(a, b) {
  return a.left < b.right && b.left < a.right && a.bottom < b.top && b.bottom < a.top;
}

const scratchHurt = {};

/** True if `worldBox` touches any of the fighter's current hurtboxes. */
export function hitsFighter(worldBox, fighter) {
  const boxes = fighter.hurtboxes();
  for (let i = 0; i < boxes.length; i++) {
    if (overlaps(worldBox, toWorld(boxes[i], fighter.x, fighter.y, fighter.facing, scratchHurt))) return true;
  }
  return false;
}
