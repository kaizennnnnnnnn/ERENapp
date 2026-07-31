"""Turn a raw Monsta can render into shop-ready art in public/food.

The can art arrives as an opaque RGB render on a white studio background. Two
steps stand between that and a usable food PNG:

1. CUT THE BACKGROUND. A plain "delete every white pixel" pass also eats the
   white inside the can — the MONSTER wordmark, the ORIGINAL band, the lid
   highlights. So the white is removed by FLOOD FILL from the border instead:
   only white that is reachable from the edge without crossing the can is
   background. Interior white is unreachable, so it survives untouched.

2. FEATHER THE CUT EDGE. The render is anti-aliased, so the pixel ring just
   inside the silhouette is a white/art blend. Left opaque it reads as a white
   halo over a dark shop card. Those border-adjacent pixels get an alpha ramped
   by how white they are, which dissolves the ring without nibbling the art.

Then normalize_food_art.py does the rest (trim on alpha, scale, centre), so a
new can lands at exactly the same size as the eight already in the fridge.

    py scripts/import_can_art.py <source.png> <food_id>
    py scripts/import_can_art.py ~/Downloads/hf_2026.png monsta_original

Run normalize_food_art.py afterwards (this script calls it for the one file).
"""

import sys
from collections import deque
from pathlib import Path

import numpy as np
from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parent))
from normalize_food_art import normalise  # noqa: E402

FOOD_DIR = Path(__file__).resolve().parent.parent / 'public' / 'food'

BG_MIN = 236    # a pixel this bright in every channel counts as studio white
EDGE_MIN = 200  # ...and this bright is "white enough" to feather at the cut


def cut_background(im: Image.Image) -> Image.Image:
    """Flood-fill the studio white from the border, then feather the cut edge."""
    rgb = np.array(im.convert('RGB'), dtype=np.int16)
    h, w, _ = rgb.shape
    white = rgb.min(axis=2) >= BG_MIN

    bg = np.zeros((h, w), dtype=bool)
    q = deque()
    for x in range(w):
        for y in (0, h - 1):
            if white[y, x] and not bg[y, x]:
                bg[y, x] = True
                q.append((y, x))
    for y in range(h):
        for x in (0, w - 1):
            if white[y, x] and not bg[y, x]:
                bg[y, x] = True
                q.append((y, x))

    while q:
        y, x = q.popleft()
        for ny, nx in ((y - 1, x), (y + 1, x), (y, x - 1), (y, x + 1)):
            if 0 <= ny < h and 0 <= nx < w and white[ny, nx] and not bg[ny, nx]:
                bg[ny, nx] = True
                q.append((ny, nx))

    alpha = np.where(bg, 0, 255).astype(np.uint8)

    # Feather: a kept pixel touching the background gets an alpha scaled by how
    # far it is from pure white, so the anti-aliased rim fades instead of
    # forming a bright outline.
    touches_bg = np.zeros((h, w), dtype=bool)
    touches_bg[1:, :] |= bg[:-1, :]
    touches_bg[:-1, :] |= bg[1:, :]
    touches_bg[:, 1:] |= bg[:, :-1]
    touches_bg[:, :-1] |= bg[:, 1:]

    brightness = rgb.min(axis=2)
    rim = touches_bg & ~bg & (brightness >= EDGE_MIN)
    ramp = np.clip((BG_MIN - brightness) / (BG_MIN - EDGE_MIN), 0, 1)
    alpha[rim] = (ramp[rim] * 255).astype(np.uint8)

    out = im.convert('RGBA')
    out.putalpha(Image.fromarray(alpha))
    return out


if __name__ == '__main__':
    if len(sys.argv) != 3:
        raise SystemExit(__doc__)
    src, food_id = Path(sys.argv[1]).expanduser(), sys.argv[2]
    dest = FOOD_DIR / f'{food_id}.png'
    cut_background(Image.open(src)).save(dest)
    print(f'cut  {src.name} -> {dest.relative_to(FOOD_DIR.parent.parent)}')
    print(f'norm {normalise(dest)}')
