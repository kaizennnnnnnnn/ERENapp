"""Re-encode a full-screen backdrop as WebP at a sane resolution.

The gacha deck mounts all three machine backdrops at once, each on its own
transformed compositor layer. As PNGs they were 1.8 / 2.4 / 7.2 MB on the wire
and ~29 MB of decoded bitmap resident on the GPU — enough texture pressure to
make the swipe stutter on a phone (and, earlier, to blank the pull buttons).

Two things shrink them without a visible change:

1. CAP THE HEIGHT. A backdrop is painted full-screen behind a `scale(1.12)`
   overscan. Past roughly 1700px tall there is no phone that can show the extra
   detail, so anything taller is pure memory. Never upscales.

2. DROP DEAD ALPHA. The FoodSuits art shipped as RGBA over an opaque black
   page — a whole channel of nothing, and RGBA forbids some encoder paths.

WebP rather than a smaller PNG because this is painted artwork: at q82 it is
visually indistinguishable and roughly a tenth the bytes.

    py scripts/backdrop_to_webp.py public/gacha_food.png public/gacha_animal.png
"""

import sys
from pathlib import Path

from PIL import Image

MAX_H = 1700   # tallest a phone backdrop is worth storing
QUALITY = 82   # painted art; artefacts are invisible well below this


def convert(src: Path) -> str:
    im = Image.open(src)
    before = src.stat().st_size
    w, h = im.size

    if im.mode in ('RGBA', 'LA', 'P'):
        # Composite onto the page black rather than just discarding alpha, so a
        # semi-transparent edge doesn't turn into a bright fringe.
        flat = Image.new('RGB', im.size, (5, 5, 7))
        rgba = im.convert('RGBA')
        flat.paste(rgba, mask=rgba.split()[3])
        im = flat
    else:
        im = im.convert('RGB')

    if h > MAX_H:
        w, h = round(w * MAX_H / h), MAX_H
        im = im.resize((w, h), Image.LANCZOS)

    dest = src.with_suffix('.webp')
    im.save(dest, format='WEBP', quality=QUALITY, method=6)
    after = dest.stat().st_size
    return (f'{src.name:<22} {Image.open(src).size} {before/1e6:5.2f} MB  ->  '
            f'{dest.name:<24} {(w, h)} {after/1e6:5.2f} MB  '
            f'({before/after:.1f}x smaller, ~{w*h*4/1e6:.1f} MB decoded)')


if __name__ == '__main__':
    if len(sys.argv) < 2:
        raise SystemExit(__doc__)
    for arg in sys.argv[1:]:
        print(convert(Path(arg)))
