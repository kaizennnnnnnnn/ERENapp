"""Cut the new food/jelly art out of the raw generator sheets in Downloads.

The sheets aren't single sprites. Each one is TWO panels side by side:

    [ subject on transparent ]  [ opaque white card with the subject knocked out ]

...plus stray leftovers from the prompt — a ghost plate outline floating beside
the cake, a wisp of a rim beside the tart. Pasting a sheet straight into
public/food gives a dish sitting in the left third of a huge canvas with junk
next to it, which `object-fit: contain` then shrinks into nothing.

Three passes, each one keyed to a property of the junk rather than to hand-typed
crop boxes (there are 13 of these and there will be more):

  1. DROP THE WHITE CARD. It's the only region that is both near-white AND
     fully opaque, and it's one huge contiguous slab — so it's the largest
     connected blob of opaque-white, and its bounding box is the panel. Erasing
     by BBOX rather than by pixel matters: the subject has white in it too (the
     cake's cream, a jelly's highlight), and a per-pixel white test would punch
     holes straight through the art. The card's own knocked-out silhouette
     doesn't disconnect it, so one blob covers the whole panel.
  2. KEEP THE SUBJECT. Label what's left; the dish is the biggest blob. Ghost
     plates are thin outlines, so they lose on AREA even when they're wide.
     Anything under 20% of the winner's area is junk and gets its alpha zeroed
     — that threshold keeps genuinely detached bits (a shrimp's antennae) while
     killing the wisps.
  3. TRIM. Crop to what survived, on alpha only.

Sizing/centring is NOT done here — scripts/normalize_food_art.py owns that, and
running it after this is what makes a new dish match the other 40.

Run: py scripts/cut_food_art.py
"""

from pathlib import Path
import sys

from PIL import Image
import numpy as np
from scipy import ndimage

DOWNLOADS = Path.home() / 'Downloads'
ROOT = Path(__file__).resolve().parent.parent

ALPHA_FLOOR = 8       # below this a pixel is invisible, not art
CARD_MIN_FRAC = 0.05  # a white blob smaller than this share of the sheet isn't a card
JUNK_AREA_FRAC = 0.2  # blob smaller than this share of the biggest one is junk

# source sheet -> where it lands. Food goes to public/food/<id>.png, which is
# what foodArt() serves; jellies get their own folder.
JOBS = [
    ('Background (1).png',    'public/food/cake.png'),
    ('Background (2).png',    'public/food/jelly_caka.png'),
    ('Background (1)(7).png', 'public/food/kibble.png'),
    ('Background (2)(5).png', 'public/food/biscuit.png'),
    ('Background (3)(5).png', 'public/food/tuna.png'),
    ('Background (4)(5).png', 'public/food/salmon.png'),
    ('Background (6)(2).png', 'public/food/shrimp.png'),
    ('Background (3).png',    'public/jelly/jelly_red.png'),
    ('Background (4).png',    'public/jelly/jelly_green.png'),
    ('Background (5).png',    'public/jelly/jelly_purple.png'),
    ('Background (6).png',    'public/jelly/jelly_yellow.png'),
    ('Background (7).png',    'public/jelly/jelly_orange.png'),
]


def cut(src: Path) -> Image.Image:
    im = Image.open(src).convert('RGBA')
    a = np.array(im)
    rgb, alpha = a[..., :3], a[..., 3]

    # 1 — drop the opaque white card
    card = (rgb > 238).all(-1) & (alpha > 200)
    clab, cn = ndimage.label(card)
    if cn:
        careas = ndimage.sum(np.ones_like(clab), clab, range(1, cn + 1))
        top = int(np.argmax(careas)) + 1
        if careas[top - 1] >= card.size * CARD_MIN_FRAC:
            ys, xs = np.nonzero(clab == top)
            a[ys.min():ys.max() + 1, xs.min():xs.max() + 1, 3] = 0
    alpha = a[..., 3]

    # 2 — keep the biggest blob (+ anything comparably sized), zero the junk
    lab, n = ndimage.label(alpha >= ALPHA_FLOOR)
    if n == 0:
        raise SystemExit(f'{src.name}: nothing visible after the card cut')
    areas = ndimage.sum(np.ones_like(lab), lab, range(1, n + 1))
    biggest = areas.max()
    winners = {i + 1 for i, ar in enumerate(areas) if ar >= biggest * JUNK_AREA_FRAC}
    a[..., 3] = np.where(np.isin(lab, list(winners)), alpha, 0)

    # 3 — trim to what's left
    out = Image.fromarray(a, 'RGBA')
    bbox = out.split()[3].point(lambda v: 255 if v >= ALPHA_FLOOR else 0).getbbox()
    return out.crop(bbox) if bbox else out


if __name__ == '__main__':
    for name, dest in JOBS:
        src = DOWNLOADS / name
        if not src.exists():
            print(f'MISSING {name}', file=sys.stderr)
            continue
        art = cut(src)
        target = ROOT / dest
        target.parent.mkdir(parents=True, exist_ok=True)
        art.save(target, optimize=True)
        print(f'{name:<24} -> {dest:<32} {art.width}x{art.height}')
