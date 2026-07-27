"""Normalise the food plate art in public/food so every dish reads the same size
and sits dead-centre.

Two things go wrong when plates are merely trimmed and downscaled to fit a box:

1. OFF-CENTRE. Pillow's `Image.getbbox()` on an RGBA image keeps any pixel whose
   RGB is non-zero even when it is fully transparent, so white-ish transparent
   padding survives the trim. The canvas ends up wider than the dish, and
   `object-fit: contain` centres the CANVAS, not the food — so temaki, chicken,
   carbonara and fried egg all sat visibly left of their plate.

2. UNEVEN WEIGHT. With every canvas the same width, a tall squarish dish
   (maki, 128x127 of content) renders ~1.6x the visual mass of a flat one
   (fried egg, 87x70) inside the same box.

Both are fixed at the source rather than with per-food fudge factors in React:
trim on the ALPHA channel only, scale each dish so its geometric mean size hits
one target, then paste it centred into a SQUARE canvas. Square + centred means
`object-fit: contain` does the right thing for free.

Flat wide dishes (sardine, doner) can't reach the target without overflowing, so
they clamp to MAX_SIDE and stay full-width — which is what a long thin fish
should look like anyway.

Run with `py scripts/normalize_food_art.py` (plain `python` has no Pillow).
Idempotent: a second run is a no-op.
"""

from pathlib import Path
from PIL import Image

FOOD_DIR = Path(__file__).resolve().parent.parent / 'public' / 'food'

BOX = 128        # square output canvas
TARGET = 100     # sqrt(w*h) every dish is scaled toward
MAX_SIDE = 124   # ...unless that overflows; leaves a 2px breathing margin
ALPHA_FLOOR = 8  # ignore near-invisible halo pixels when finding the content


def content_box(im: Image.Image):
    """Bounding box of the visible art — alpha only, halo ignored."""
    solid = im.split()[3].point(lambda a: 255 if a >= ALPHA_FLOOR else 0)
    return solid.getbbox()


def normalise(path: Path) -> str:
    im = Image.open(path).convert('RGBA')
    bbox = content_box(im)
    if bbox is None:
        return f'{path.name}: fully transparent, skipped'

    art = im.crop(bbox)
    w, h = art.size
    scale = min(TARGET / (w * h) ** 0.5, MAX_SIDE / max(w, h))
    tw, th = max(1, round(w * scale)), max(1, round(h * scale))

    if abs(scale - 1) > 0.01:  # skip the resample when already on target
        art = art.resize((tw, th), Image.LANCZOS)
    else:
        tw, th = w, h

    out = Image.new('RGBA', (BOX, BOX), (0, 0, 0, 0))
    out.paste(art, ((BOX - tw) // 2, (BOX - th) // 2))
    out.save(path, optimize=True)
    return f'{path.name:<20} {w}x{h} -> {tw}x{th} in {BOX}x{BOX}'


if __name__ == '__main__':
    for png in sorted(FOOD_DIR.glob('*.png')):
        print(normalise(png))
