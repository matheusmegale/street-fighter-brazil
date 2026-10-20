"""Extracts character frames from the illustrated sheets in source-art/ into Phaser atlases.

Usage: python tools/extract_sprites.py [character_id ...]

Each tools/frames/<id>.json lists hand-measured rectangles (inclusive sheet coordinates).
Output goes to public/assets/characters/<id>/ (atlas.png, atlas.json, plus standalone
images) and a contact sheet to tools/out/<id>-contact.png for visual inspection.
"""
import json
import sys
from collections import deque
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
FRAMES_DIR = ROOT / "tools" / "frames"
OUT_DIR = ROOT / "public" / "assets" / "characters"
CONTACT_DIR = ROOT / "tools" / "out"

MIN_COMPONENT = 60
EDGE_FRAGMENT_RATIO = 0.25
SMALL_HOLE = 40
ATLAS_WIDTH = 2048
PADDING = 2


def background_mask(rgb):
    """The sheets share a dark navy backdrop with a slight vignette."""
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    return (r < 14) & (g >= 6) & (g <= 30) & (b >= 18) & (b <= 52) & (b - g >= 8)


def label_components(mask):
    h, w = mask.shape
    labels = np.zeros((h, w), np.int32)
    comps = []
    for y in range(h):
        row = mask[y]
        for x in np.flatnonzero(row & (labels[y] == 0)):
            if labels[y, x]:
                continue
            idx = len(comps) + 1
            labels[y, x] = idx
            queue = deque([(y, x)])
            pts = 0
            x0 = x1 = x
            y0 = y1 = y
            while queue:
                cy, cx = queue.popleft()
                pts += 1
                x0, x1 = min(x0, cx), max(x1, cx)
                y0, y1 = min(y0, cy), max(y1, cy)
                for dy in (-1, 0, 1):
                    for dx in (-1, 0, 1):
                        ny, nx = cy + dy, cx + dx
                        if 0 <= ny < h and 0 <= nx < w and mask[ny, nx] and not labels[ny, nx]:
                            labels[ny, nx] = idx
                            queue.append((ny, nx))
            comps.append({"id": idx, "area": pts, "box": (x0, y0, x1, y1)})
    return labels, comps


def fill_small_holes(alpha):
    """Dark suit shading can match the backdrop; re-fill tiny enclosed gaps."""
    outside = np.zeros_like(alpha)
    h, w = alpha.shape
    queue = deque()
    for x in range(w):
        for y in (0, h - 1):
            if not alpha[y, x] and not outside[y, x]:
                outside[y, x] = True
                queue.append((y, x))
    for y in range(h):
        for x in (0, w - 1):
            if not alpha[y, x] and not outside[y, x]:
                outside[y, x] = True
                queue.append((y, x))
    while queue:
        cy, cx = queue.popleft()
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            ny, nx = cy + dy, cx + dx
            if 0 <= ny < h and 0 <= nx < w and not alpha[ny, nx] and not outside[ny, nx]:
                outside[ny, nx] = True
                queue.append((ny, nx))
    holes = ~alpha & ~outside
    labels, comps = label_components(holes)
    for comp in comps:
        if comp["area"] < SMALL_HOLE:
            alpha[labels == comp["id"]] = True
    return alpha


def flood_background(rgb):
    """Transparent = backdrop pixels connected to the crop border (keeps inner darks)."""
    bg = background_mask(rgb)
    h, w = bg.shape
    seen = np.zeros_like(bg)
    queue = deque()
    for x in range(w):
        for y in (0, h - 1):
            if bg[y, x]:
                seen[y, x] = True
                queue.append((y, x))
    for y in range(h):
        for x in (0, w - 1):
            if bg[y, x] and not seen[y, x]:
                seen[y, x] = True
                queue.append((y, x))
    while queue:
        cy, cx = queue.popleft()
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            ny, nx = cy + dy, cx + dx
            if 0 <= ny < h and 0 <= nx < w and bg[ny, nx] and not seen[ny, nx]:
                seen[ny, nx] = True
                queue.append((ny, nx))
    return ~seen


def isolate_subject(rgb, rect, spec):
    """Keeps the connected blobs that belong to this frame, dropping neighbours and labels."""
    fg = ~background_mask(rgb)
    x0, y0 = rect[0], rect[1]
    for ex in spec.get("exclude", []):
        fg[max(ex[1] - y0, 0):ex[3] - y0 + 1, max(ex[0] - x0, 0):ex[2] - x0 + 1] = False
    labels, comps = label_components(fg)
    comps = [c for c in comps if c["area"] >= spec.get("minArea", MIN_COMPONENT)]
    if not comps:
        raise ValueError(f"no subject found in {rect}")
    largest = max(c["area"] for c in comps)
    w = fg.shape[1]
    alpha = np.zeros_like(fg)
    for c in comps:
        touches_side = c["box"][0] == 0 or c["box"][2] == w - 1
        if touches_side and c["area"] < largest * EDGE_FRAGMENT_RATIO:
            continue
        alpha[labels == c["id"]] = True
    return fill_small_holes(alpha)


def cut_frame(sheet, name, spec):
    rect = spec["rect"]
    crop = sheet[rect[1]:rect[3] + 1, rect[0]:rect[2] + 1]
    mode = spec.get("mode", "subject")
    if mode == "raw":
        alpha = np.ones(crop.shape[:2], bool)
    elif mode == "flood":
        alpha = flood_background(crop)
    else:
        alpha = isolate_subject(crop, rect, spec)

    ys, xs = np.nonzero(alpha)
    if len(xs) == 0:
        raise ValueError(f"{name}: empty frame")
    bx0, bx1, by0, by1 = xs.min(), xs.max(), ys.min(), ys.max()
    rgba = np.zeros((by1 - by0 + 1, bx1 - bx0 + 1, 4), np.uint8)
    rgba[..., :3] = crop[by0:by1 + 1, bx0:bx1 + 1]
    rgba[..., 3] = np.where(alpha[by0:by1 + 1, bx0:bx1 + 1], 255, 0)
    h, w = rgba.shape[:2]

    if "anchorX" in spec:
        anchor_x = spec["anchorX"] - rect[0] - bx0
    elif mode == "raw":
        anchor_x = w / 2
    else:
        band = max(4, int(h * 0.08))
        cols = np.nonzero(rgba[h - band:, :, 3])[1]
        anchor_x = float(cols.mean())
    anchor_y = h if mode != "raw" else h / 2
    if "anchorY" in spec:
        anchor_y = spec["anchorY"] - rect[1] - by0

    fade = spec.get("fadeX", 0)
    if fade:
        # Soft horizontal edges for crops that cut through a wide illustration.
        ramp = np.clip(np.minimum(np.arange(w), np.arange(w)[::-1]) / fade, 0, 1)
        rgba[..., 3] = (rgba[..., 3] * ramp[None, :]).astype(np.uint8)

    if spec.get("flipX"):
        rgba = rgba[:, ::-1]
        anchor_x = w - anchor_x
    return Image.fromarray(rgba, "RGBA"), (anchor_x, anchor_y)


def pack(images):
    """Shelf packing, tallest first."""
    order = sorted(images, key=lambda n: -images[n].size[1])
    x = y = shelf_h = 0
    placed = {}
    for name in order:
        w, h = images[name].size
        if x + w + PADDING > ATLAS_WIDTH:
            x = 0
            y += shelf_h + PADDING
            shelf_h = 0
        placed[name] = (x, y)
        x += w + PADDING
        shelf_h = max(shelf_h, h)
    total_h = y + shelf_h
    height = 1
    while height < total_h:
        height *= 2
    return placed, height


def contact_sheet(images, anchors, path):
    cell_w, cell_h, scale = 260, 220, 1
    cols = 8
    names = list(images)
    rows = (len(names) + cols - 1) // cols
    sheet = Image.new("RGBA", (cols * cell_w, rows * cell_h), (60, 60, 70, 255))
    draw = ImageDraw.Draw(sheet)
    for i, name in enumerate(names):
        cx, cy = (i % cols) * cell_w, (i // cols) * cell_h
        img = images[name]
        ax, ay = anchors[name]
        base_y = cy + cell_h - 30
        mid_x = cx + cell_w // 2
        draw.line([(cx, base_y), (cx + cell_w, base_y)], fill=(0, 255, 0))
        draw.line([(mid_x, cy), (mid_x, cy + cell_h)], fill=(255, 0, 255))
        sheet.alpha_composite(img, (int(mid_x - ax * scale), int(base_y - ay * scale)))
        draw.text((cx + 4, cy + cell_h - 24), name, fill=(255, 255, 255))
    sheet.save(path)


def build(char_id):
    spec = json.loads((FRAMES_DIR / f"{char_id}.json").read_text(encoding="utf-8"))
    sheet = np.asarray(Image.open(ROOT / spec["sheet"]).convert("RGB"))
    out = OUT_DIR / char_id
    out.mkdir(parents=True, exist_ok=True)

    images, anchors = {}, {}
    for name, frame in spec["frames"].items():
        images[name], anchors[name] = cut_frame(sheet, name, frame)

    placed, height = pack(images)
    atlas = Image.new("RGBA", (ATLAS_WIDTH, height), (0, 0, 0, 0))
    frames_json = {}
    for name, (x, y) in placed.items():
        img = images[name]
        atlas.alpha_composite(img, (x, y))
        w, h = img.size
        ax, ay = anchors[name]
        frames_json[name] = {
            "frame": {"x": x, "y": y, "w": w, "h": h},
            "rotated": False,
            "trimmed": False,
            "spriteSourceSize": {"x": 0, "y": 0, "w": w, "h": h},
            "sourceSize": {"w": w, "h": h},
            "pivot": {"x": round(ax / w, 4), "y": round(ay / h, 4)},
        }
    atlas.save(out / "atlas.png", optimize=True)
    (out / "atlas.json").write_text(json.dumps({
        "frames": frames_json,
        "meta": {"image": "atlas.png", "size": {"w": ATLAS_WIDTH, "h": height}, "scale": "1"},
    }, indent=1), encoding="utf-8")

    for name, image_spec in spec.get("images", {}).items():
        img, _ = cut_frame(sheet, name, image_spec)
        img.save(out / f"{name}.png", optimize=True)

    CONTACT_DIR.mkdir(parents=True, exist_ok=True)
    contact_sheet(images, anchors, CONTACT_DIR / f"{char_id}-contact.png")
    print(f"{char_id}: {len(images)} frames, atlas {ATLAS_WIDTH}x{height}")


if __name__ == "__main__":
    ids = sys.argv[1:] or [p.stem for p in sorted(FRAMES_DIR.glob("*.json"))]
    for cid in ids:
        build(cid)
