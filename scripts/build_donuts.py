"""Import the donut pixel-art into public/food as donut_*.png.

The 27 source PNGs land in Downloads as huge (~1500 px) canvases named
"Background (n)(m).png", so this script owns the mapping from that meaningless
filename to the donut id the app knows it by. Re-run it after replacing a
source file; it is idempotent and only writes public/food.

Two things the plain `normalize_food_art.py` cannot do on these sources:

1. STRAY EDGE PIXELS. Almost every export carries a column of near-invisible
   pixels at x=0, so a plain alpha bbox spans the whole canvas and the donut
   ends up a speck in the middle of a mostly-empty square. Fixed by thresholding
   alpha hard and keeping only the LARGEST connected blob — the donut — before
   taking the bbox.

2. LEFTOVER WHITE SLABS. `Background.png` (white chocolate) exports the donut on
   a 5441x1665 canvas that also carries a blank white rectangle wider than the
   donut itself, so "largest blob" picks the rectangle. Any opaque component
   that is almost entirely pure white is discarded before that vote — a donut
   never is, not even the cream-glazed one, whose glaze sits a few shades under
   #FFF.

Output matches normalize_food_art.py's contract exactly — a 128x128 square with
the art centred and scaled so its geometric mean size hits TARGET — so donuts
sit at the same visual weight as every other dish and `object-fit: contain`
centres the food, not the canvas.

Run with `py scripts/build_donuts.py` (plain `python` has no Pillow).
"""

from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage

SRC_DIR = Path.home() / 'Downloads'
OUT_DIR = Path(__file__).resolve().parent.parent / 'public' / 'food'

# Same numbers as normalize_food_art.py — donuts have to weigh the same as the
# plates they sit beside in the fridge.
BOX = 128
TARGET = 100
MAX_SIDE = 124

ALPHA_SOLID = 96   # "really part of the art", not an anti-aliased halo
BLANK_WHITE = 0.9  # a blob this pure-white is export filler, never a donut

# source filename -> donut id. The only place the two vocabularies meet.
DONUTS = {
    # ── Kitchen staples ──
    'Background(9).png':      'donut',              # pink glaze, rainbow sprinkles
    'Background (3)(4).png':  'donut_choco',        # chocolate glaze, rainbow sprinkles
    # ── Bakery daily specials ──
    'Background (20)(1).png': 'donut_vanilla',
    'Background (4)(4).png':  'donut_honey',
    'Background (4)(3).png':  'donut_caramel',
    'Background (5)(2).png':  'donut_mint',
    'Background (3)(3).png':  'donut_matcha',
    'Background (1)(5).png':  'donut_blueberry',
    'Background (2)(3).png':  'donut_red_velvet',
    'Background (6)(1).png':  'donut_mocha',
    'Background (7)(1).png':  'donut_lattice',
    'Background (8)(1).png':  'donut_sakura',
    'Background (9)(1).png':  'donut_hibiscus',
    'Background (11)(1).png': 'donut_black_forest',
    'Background (12)(1).png': 'donut_ube',
    'Background (13)(1).png': 'donut_maple_bacon',
    'Background (14)(1).png': 'donut_mochi',
    'Background (15)(1).png': 'donut_sesame',
    'Background (16)(1).png': 'donut_gold_leaf',
    'Background (17)(1).png': 'donut_pizza',
    'Background (21)(1).png': 'donut_lavender',
    'Background (2)(4).png':  'donut_biscoff',
    'Background (1)(6).png':  'donut_pistachio',
    'Background.png':         'donut_white_choc',
    # ── Gacha exclusives ──
    'Background (10)(1).png': 'donut_tiger',
    'Background (18)(1).png': 'donut_arcade',
    'Background (19)(1).png': 'donut_neon',
}


def art_box(im: Image.Image):
    """Bounding box of the donut itself — largest solid blob, filler ignored."""
    arr = np.array(im)
    solid = arr[:, :, 3] >= ALPHA_SOLID
    if not solid.any():
        return None

    labels, count = ndimage.label(solid)
    pure_white = (arr[:, :, :3] >= 250).all(axis=2)
    best, best_size = 0, 0
    for idx in range(1, count + 1):
        blob = labels == idx
        size = int(blob.sum())
        # Sprigs, stickers and flowers touch the ring, so the donut is always
        # the biggest blob left once blank slabs and edge debris are out.
        if size <= best_size or pure_white[blob].mean() >= BLANK_WHITE:
            continue
        best, best_size = idx, size
    if best == 0:
        return None

    ys, xs = np.nonzero(labels == best)
    return int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1


def build(src: Path, out: Path) -> str:
    im = Image.open(src).convert('RGBA')
    bbox = art_box(im)
    if bbox is None:
        return f'{src.name}: nothing visible, skipped'

    art = im.crop(bbox)
    w, h = art.size
    scale = min(TARGET / (w * h) ** 0.5, MAX_SIDE / max(w, h))
    tw, th = max(1, round(w * scale)), max(1, round(h * scale))
    art = art.resize((tw, th), Image.LANCZOS)

    canvas = Image.new('RGBA', (BOX, BOX), (0, 0, 0, 0))
    canvas.paste(art, ((BOX - tw) // 2, (BOX - th) // 2))
    canvas.save(out, optimize=True)
    return f'{out.name:<22} {w}x{h} -> {tw}x{th} in {BOX}x{BOX}'


if __name__ == '__main__':
    missing = [name for name in DONUTS if not (SRC_DIR / name).exists()]
    if missing:
        raise SystemExit('missing sources:\n  ' + '\n  '.join(missing))
    for name, donut_id in DONUTS.items():
        print(build(SRC_DIR / name, OUT_DIR / f'{donut_id}.png'))
