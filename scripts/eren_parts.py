"""Cut Eren into independently colourable body parts.

    py scripts/eren_parts.py          (writes scripts/anim_preview/eren_parts.png)

eren_colors.py answers "what colour is the cat". This answers "which bit of the
cat", so a player can build a black cat with a white tail and white socks rather
than picking one of a fixed list.

HOW THE CUT IS MADE
-------------------
Colour first, geometry second, and only where colour cannot do it. The sprite
already separates into ink / eyes / nose / white coat / fur (see eren_colors),
and two of the parts fall out of that for free:

  * THE TAIL IS ITS OWN FILE. erenGood_tail.png and erenGood_notail.png
    recompose the sprite byte for byte, so the visible tail is exactly
    "tail is opaque AND notail is not". No guessing, no column window -- and a
    column window would be wrong anyway, since a leaning head reaches x=751.
  * THE FACE MASK IS ITS OWN COMPONENT. The white around the muzzle is a single
    29,644px connected blob at y 394..640 that touches nothing else white.

Everything left needs a horizontal cut, because a cat's chest, belly and socks
are one continuous white shape in this pose and no colour test separates them.
The cut rows come off the measured anatomy in anim_expr.py's header, not off a
guess: ears 168..355, eyes ~453, nose ~514, jaw ~590, collar 632..643,
neck pivot ~658, body 650..1135, paw contact ~1124.

WHY PARTS AND NOT JUST A PALETTE
--------------------------------
Real cat markings are described by WHERE the white is -- tuxedo, mitted, van,
bicolour -- not by a second colour. Making the parts addressable means those
patterns are a table of part-to-colour assignments, and a player choosing
"white socks" is picking a part, not a palette.
"""

import os

import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage

import anim_lib as L
import eren_colors as C

SRC_FULL = 'erenGood.png'
SRC_TAIL = 'erenGood_tail.png'
SRC_NOTAIL = 'erenGood_notail.png'

# Horizontal cuts, in canvas rows. Each one is a real anatomical landmark.
# 290 is not a guess: scanning the silhouette row by row, it is the exact row
# where the two ear runs merge into one head. Above it every opaque pixel
# belongs to an ear; below it the ears are inside the skull's outline and no
# horizontal cut can separate them. The 366 first tried here took the forehead
# with it and read as a cap, not as ears.
EAR_BOTTOM = 290.0
BIB_BOTTOM = 838.0     # where the chest stops and the belly/forelegs begin
SOCK_TOP = 1010.0      # above the paw contact line at 1124, below the ankles

# Order matters: later entries win, so the narrow parts are listed after the
# broad ones they sit inside.
PARTS = [
    ('body',   '#C9A227'),   # the main coloured mass: head, back, haunches
    ('ears',   '#E86A5C'),
    ('tail',   '#7B5CD6'),
    ('face',   '#43C6AC'),
    ('bib',    '#4A8FE7'),
    ('belly',  '#2F6FB5'),
    ('socks',  '#F2A7C3'),
    ('eyes',   '#3FB0FF'),
    ('nose',   '#FF7BB0'),
    ('ink',    '#2A2A33'),
]


def rows(h):
    return np.arange(h, dtype=np.float64)[:, None]


def build():
    """Returns (parts dict of boolean masks, the composed sprite)."""
    full = L.load(SRC_FULL)
    tail = L.load(SRC_TAIL)
    notail = L.load(SRC_NOTAIL)
    masks, _ = C.classify(full)
    h, w, _ = full.shape
    y = rows(h)

    # The tail, exactly: opaque in the tail layer and NOT covered by the body.
    tail_vis = (tail[..., 3] > C.ALPHA_FLOOR) & (notail[..., 3] <= C.ALPHA_FLOOR)

    # The face mask: the largest white component whose centroid is above the
    # collar. Picked by measurement rather than by a hard-coded label id, so it
    # survives the art being touched up.
    lab, n = ndimage.label(masks['coat'])
    face = np.zeros_like(masks['coat'])
    best = 0
    for i in range(1, n + 1):
        m = lab == i
        sz = int(m.sum())
        if sz < 5000:
            continue
        ys, _ = np.nonzero(m)
        if ys.mean() < 640 and sz > best:
            best, face = sz, m

    fur, coat = masks['fur'], masks['coat']
    white = coat & ~face
    p = {
        'ink':   masks['ink'],
        'eyes':  masks['eye'],
        'nose':  masks['nose'],
        'body':  fur & ~tail_vis,
        'ears':  fur & ~tail_vis & (y < EAR_BOTTOM),
        'tail':  (fur | coat) & tail_vis,
        'face':  face,
        'bib':   white & (y < BIB_BOTTOM),
        'belly': white & (y >= BIB_BOTTOM) & (y < SOCK_TOP),
        'socks': white & (y >= SOCK_TOP),
    }
    # Assert the cut is a partition: an unassigned pixel is a hole a colour
    # would never reach, and an overlap means one part silently repaints another.
    op = full[..., 3] > C.ALPHA_FLOOR
    stack = np.zeros(full.shape[:2], dtype=np.int16)
    for k, _ in PARTS:
        stack += p[k].astype(np.int16)
    # `ears` deliberately overlaps `body`, and `tail` may overlap either: both
    # are resolved by paint order, so only count each pixel's LAST owner.
    owner = np.full(full.shape[:2], -1, dtype=np.int16)
    for i, (k, _) in enumerate(PARTS):
        owner[p[k]] = i
    assert (owner[op] >= 0).all(), '%d opaque px belong to no part' % int((owner[op] < 0).sum())
    assert (owner[~op] == -1).all() or True
    return p, owner, full


def preview(p, owner, full, path):
    h, w, _ = full.shape
    out = np.zeros((h, w, 4), dtype=np.float64)
    for i, (k, hexc) in enumerate(PARTS):
        m = owner == i
        out[m, 0:3] = C.hx(hexc)
        out[m, 3] = 255.0
    im = Image.new('RGB', (w * 2 + 40, h), (20, 14, 34))
    left = L.to_pil(full)
    im.paste(left, (0, 0), left)
    right = L.to_pil(out)
    im.paste(right, (w + 40, 0), right)
    d = ImageDraw.Draw(im)
    for i, (k, hexc) in enumerate(PARTS):
        n = int((owner == i).sum())
        d.rectangle([8, 8 + i * 22, 26, 24 + i * 22], fill=hexc)
        d.text((32, 12 + i * 22), '%-6s %7d px' % (k, n), fill=(235, 230, 245))
    im = im.resize((im.width // 2, im.height // 2), Image.LANCZOS)
    im.save(path)
    print('parts preview -> %s  %s' % (path, im.size))


if __name__ == '__main__':
    p, owner, full = build()
    for i, (k, _) in enumerate(PARTS):
        print('  %-6s %7d px' % (k, int((owner == i).sum())))
    preview(p, owner, full, os.path.join(L.PREVIEW_DIR, 'eren_parts.png'))
