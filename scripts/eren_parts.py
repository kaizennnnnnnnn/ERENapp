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

Everything left is cut WITHOUT A STRAIGHT LINE, because the first version used
three of them and the user's verdict was exact: "straight up half of him is
cut ... looks not natural". No cat's markings stop on a horizontal.

  * THE BIB AND THE LEGS COME OFF THE ART'S OWN INK. The chest, the two front
    legs and the paws are one connected white shape, but the ink lines that
    draw the legs almost close each region off -- so eroding the white mask by
    12px snaps the last gaps shut and it falls into exactly three pieces: a
    rounded V of chest (the bib) and two legs. Every white pixel then goes to
    its nearest piece. The bib's bottom edge is the shoulder/leg shading the
    artist drew, which is where a tuxedo's bib actually ends. Asserted to be
    three pieces, so a touched-up sprite fails loudly instead of quietly
    handing the chest to a leg.
  * THE EARS HAVE A SLANTED BASE. There is no ink line where an ear meets the
    skull, and the silhouette only separates the two ears above the row where
    they merge (y=290). So the base is a diagonal from the V between the ears
    out and DOWN to the cheek. A horizontal at 290 gave "just the top of the
    ear", which the user called out; the outer base of a real ear sits lower
    than the inner one.
  * THE SOCKS HAVE A SLANTED TOP at the angle of the hind paw's own ink line
    (the thick stroke at block rows 72..75 that runs down toward the middle),
    two rows above it, so the cut reads as the art's own slope, not a ruler.

Cuts are in BLOCK coordinates on the art's 14px grid at phase (10, 10), and a
line is evaluated at each block's centre, so every boundary is a staircase of
whole blocks like everything else on the sprite.

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

GRID, PHASE_X, PHASE_Y = 14, 10, 10
CX = 416.0                      # the sprite's centre column; everything mirrors about it

# The ear base, LEFT ear, in block coords (col, row): from the inner corner at
# the bottom of the V between the ears, out and down to the cheek. Mirrored for
# the right ear. Row 20 is where the two ears merge into one silhouette; the
# outer end is 4 rows lower on purpose (see the header).
EAR_INNER = (24.5, 20.0)
EAR_OUTER = (7.0, 24.0)

# The first block row of the chest. White above it is a fur highlight on the
# head, not a patch (see build()).
COLLAR_ROW = 44

# How far to erode the white body before labelling. 6 leaves it one piece,
# 9..15 all give the same three, 12 is the middle of that plateau.
BODY_ERODE = 12
BODY_MIN_PX = 1500

# The sock line, LEFT leg, block coords. Parallel to the hind paw's ink stroke
# (rows 72..75.5) and two rows above it: ON the stroke the socks were 8,758px,
# under 2% of the cat and about 10px tall at ship size -- a player choosing
# white socks on a black cat could barely see them. Two rows up they read as
# mittens and the cut still runs at the stroke's angle.
SOCK_OUTER = (15.0, 70.0)
SOCK_INNER = (26.0, 73.5)

# Order matters: later entries win, so the narrow parts are listed after the
# broad ones they sit inside.
PARTS = [
    ('body',   '#C9A227'),   # the main coloured mass: head, back, haunches
    ('ears',   '#E86A5C'),
    ('tail',   '#7B5CD6'),
    ('face',   '#43C6AC'),
    ('bib',    '#4A8FE7'),
    ('legs',   '#2F6FB5'),
    ('socks',  '#F2A7C3'),
    ('eyes',   '#3FB0FF'),
    ('nose',   '#FF7BB0'),
    ('ink',    '#2A2A33'),
]


def below_line(shape, a, b, mirror=False):
    """True for every pixel whose BLOCK CENTRE lies below the line through block
    points a and b (col, row). `mirror` reflects the line about CX first, so one
    left-side definition serves both sides of a symmetric cat."""
    h, w = shape
    (x0, y0), (x1, y1) = a, b
    if mirror:
        c = (CX - PHASE_X) / GRID                     # centre column, in blocks
        x0, x1 = 2 * c - x0, 2 * c - x1
    bx = np.floor((np.arange(w) - PHASE_X) / GRID) + 0.5   # block-centre columns
    by = np.floor((np.arange(h) - PHASE_Y) / GRID) + 0.5   # block-centre rows
    line = y0 + (bx - x0) / (x1 - x0) * (y1 - y0)
    return by[:, None] > line[None, :]


def split_white(white):
    """Erode the white body until the art's ink lines close it into pieces,
    then give every white pixel to its nearest piece. Returns (bib, legs)."""
    er = ndimage.binary_erosion(white, iterations=BODY_ERODE)
    lab, n = ndimage.label(er)
    sizes = ndimage.sum(er, lab, range(1, n + 1))
    keep = [i + 1 for i, sz in enumerate(sizes) if sz >= BODY_MIN_PX]
    assert len(keep) == 3, 'expected chest + two legs, erosion found %d pieces' % len(keep)
    seed = np.isin(lab, keep)
    _, idx = ndimage.distance_transform_edt(~seed, return_indices=True)
    assign = np.where(white, lab[idx[0], idx[1]], 0)
    # The bib is the piece whose centre of mass is highest; the other two are legs.
    cy = {k: np.nonzero(assign == k)[0].mean() for k in keep}
    bib_k = min(keep, key=lambda k: cy[k])
    return assign == bib_k, np.isin(assign, [k for k in keep if k != bib_k])


def build():
    """Returns (parts dict of boolean masks, owner map, the composed sprite)."""
    full = L.load(SRC_FULL)
    tail = L.load(SRC_TAIL)
    notail = L.load(SRC_NOTAIL)
    masks, _ = C.classify(full)
    shape = full.shape[:2]

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
    # The white strokes on the head -- the forehead and cheek fur highlights --
    # are coat-white by colour but they are not a patch of anything: they are
    # the artist's highlights on the BODY's fur. Left in the white pool they
    # went to the nearest chest/leg piece (over a hundred pixels away) and took
    # the LEGS' colour, so a cat with black legs grew black streaks on its
    # forehead. Anything white above the collar that is not the face mask is
    # body, and lands at the light end of the body's own ramp, which is what
    # a highlight is.
    by = (np.arange(shape[0]) - PHASE_Y) // GRID
    above_collar = (by < COLLAR_ROW)[:, None]
    highlights = coat & ~face & ~tail_vis & above_collar
    white = coat & ~face & ~tail_vis & ~highlights
    fur = fur | highlights
    bib, legs = split_white(white)

    xs = np.arange(shape[1])[None, :]
    left, right = xs < CX, xs >= CX

    # Ears: fur ABOVE the slanted base on each side (left definition, mirrored).
    ear_l = ~below_line(shape, EAR_INNER, EAR_OUTER)
    ear_r = ~below_line(shape, EAR_INNER, EAR_OUTER, mirror=True)
    ears = fur & ~tail_vis & ((ear_l & left) | (ear_r & right))

    # Socks: everything BELOW the slanted line (left definition, mirrored) --
    # the front paws, which are legs, AND the hind feet, which are fur tucked
    # in beside them. On a tuxedo the hind feet came out black between white
    # paws, which the user saw as "his bottom part colors are weird": a paw
    # is a paw whichever leg it is on.
    body = fur & ~tail_vis
    sock_l = below_line(shape, SOCK_OUTER, SOCK_INNER)
    sock_r = below_line(shape, SOCK_OUTER, SOCK_INNER, mirror=True)
    socks = (legs | body) & ((sock_l & left) | (sock_r & right))

    # The belly: fur that shows BETWEEN the front legs, below the chest. It
    # is the chest continuing down, so it takes the chest's colour -- on a
    # tuxedo it was a black stripe running down between two white legs.
    # "Between the legs" is measured, not drawn: a leg pixel to its left and
    # to its right on the same row, on a row the chest no longer reaches.
    legs_left, legs_right = legs & left, legs & right
    has_left = np.cumsum(legs_left, axis=1) > 0
    has_right = np.cumsum(legs_right[:, ::-1], axis=1)[:, ::-1] > 0
    belly = body & has_left & has_right & ~bib.any(axis=1)[:, None]

    p = {
        'ink':   masks['ink'],
        'eyes':  masks['eye'],
        'nose':  masks['nose'],
        'body':  body,
        'ears':  ears,
        'tail':  (fur | coat) & tail_vis,
        'face':  face,
        'bib':   bib | belly,
        'legs':  legs & ~socks,
        'socks': socks,
    }
    # `ears` deliberately overlaps `body`, and `tail` may overlap either: both
    # are resolved by paint order, so only each pixel's LAST owner counts. An
    # opaque pixel with no owner is a hole no colour would ever reach.
    op = full[..., 3] > C.ALPHA_FLOOR
    owner = np.full(shape, -1, dtype=np.int16)
    for i, (k, _) in enumerate(PARTS):
        owner[p[k]] = i
    assert (owner[op] >= 0).all(), '%d opaque px belong to no part' % int((owner[op] < 0).sum())
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
