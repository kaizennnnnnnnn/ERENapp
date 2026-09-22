"""Export the coat swatches and a few recoloured STRIPS for the bench page.

    py scripts/export_bench_colors.py <out_dir>

Two kinds of output:
  coat_<key>.webp    the still cat, one per palette -- the picker preview
  cheer_<key>.webp   a recoloured 12-frame strip, same geometry as the original

The strips matter more than the stills. They are the evidence that colour and
animation are not a trade-off: the recolour runs on the ALREADY BAKED, already
lossy-compressed strip and the region masks still land (coat share drifts 0.25
points at q80, everything else inside noise). So the app ships ONE strip per
expression and repaints it, instead of 12 coats x 5 expressions = 10.7MB of
WebP into a public/ that has already blown the Vercel budget once.
"""

import os
import sys

import numpy as np
from PIL import Image

import anim_lib as L
import eren_colors as C

STILL_W = 340          # the swatch width in the bench grid, at 2x for retina
STRIP_COATS = ['ginger', 'black', 'grey']


def load_webp(path):
    return L.unpremul(np.asarray(Image.open(path).convert('RGBA'), dtype=np.float64))


def save_webp(img, path, quality=88):
    L.to_pil(L.premul(img)).save(path, 'WEBP', quality=quality, method=6)
    return os.path.getsize(path) / 1024.0


def main():
    out = sys.argv[1]
    os.makedirs(out, exist_ok=True)

    still = L.load(C.SRC)
    total = 0.0
    for key, label, fd, fl, eye, nose, coat in C.PALETTES:
        img = C.recolor(still, fd, fl, eye, nose, coat)
        kb = save_webp(L._resize(img, STILL_W / float(img.shape[1])),
                       os.path.join(out, 'coat_%s.webp' % key))
        total += kb
        print('  coat_%-10s %-12s %5.0fKB' % (key, label, kb))
    print('  %d stills, %.0fKB' % (len(C.PALETTES), total))

    # The recoloured strips. Note these are recoloured FROM the shipped webp,
    # not re-baked from a recoloured source -- that is the whole point.
    src = os.path.join(L.ANIM_DIR, 'eren_cheer.webp')
    strip = load_webp(src)
    print('\n  source strip %s  %dx%d  %.0fKB'
          % (os.path.basename(src), strip.shape[1], strip.shape[0],
             os.path.getsize(src) / 1024.0))
    for key in STRIP_COATS:
        pal = next(p for p in C.PALETTES if p[0] == key)
        kb = save_webp(C.recolor(strip, *pal[2:]),
                       os.path.join(out, 'cheer_%s.webp' % key), quality=80)
        print('  cheer_%-10s %5.0fKB' % (key, kb))


if __name__ == '__main__':
    main()
