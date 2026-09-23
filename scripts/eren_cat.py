"""Build a cat from a spec: a colour per body part, plus a pattern.

    py scripts/eren_cat.py        (writes scripts/anim_preview/eren_cats.png)

This is the thing the onboarding customiser would call. A cat is:

    {'parts': {'body': 'black', 'tail': 'white', 'socks': 'white', ...},
     'pattern': 'tabby', 'eyes': 'gold', 'nose': 'pink'}

so "fully black", "black with a white tail" and "black tabby with socks" are
the same code path with different rows in a table -- which is what the request
"every part should be customisable" actually needs. eren_parts.py supplies the
masks; eren_colors.py supplies the gradient-map engine and the eye/nose ramps.

PATTERNS ARE A DARKENING, NOT A SECOND COLOUR
---------------------------------------------
A tabby's stripes are the same pigment as the rest of the coat, just denser, so
a stripe here pulls the pixel DOWN ITS OWN PART'S RAMP rather than painting a
new colour over it. That has a useful consequence: one stripe mask works for
every coat in the table, automatically and in the right hue. A stripe painted
as "dark brown" would look correct on a ginger cat and filthy on a grey one.

Tortoiseshell is the exception and is handled as what it really is -- patches of
a genuinely different pigment -- so it takes a second colour, not a darkening.

EVERYTHING LANDS ON THE 14px BLOCK GRID
---------------------------------------
Same rule as the mouth: a shape that is not on the art's own grid reads as a
different resolution stuck onto the sprite. Every stripe edge here is a block
boundary.
"""

import os

import numpy as np
from PIL import Image, ImageDraw

import anim_lib as L
import eren_colors as C
import eren_parts as P

GRID, PHASE_X, PHASE_Y = 14, 10, 10

# ---------------------------------------------------------------------------
# the coats. A ramp is (dark, light) -- the two ends of that part's shading.
#
# The naturals are first and are named the way a cat person names them, because
# the picker will show these words. "Red" is what the fancy calls a ginger cat,
# but nobody choosing a cat for their phone is looking for a red one, so the
# label stays GINGER. The last four are deliberately not real cats.
# ---------------------------------------------------------------------------
FUR = {
    # solids and dilutes -- greys are LOW-saturation with only a hint of cool or
    # warm; a saturated blue or a purple is not a cat, it is a cartoon
    #
    # BLACK and WHITE are the two ends and both have to actually get there. The
    # body's shading puts most of the coat at the LIGHT end of its ramp (median
    # t 0.58, three quarters above 0.16), so a "black" whose light end is a
    # mid grey (#66625F, the first cut) rendered a grey cat, and the user said
    # so: "there is not a full black one". The light end now sits at #2E2C2F,
    # which is black with just enough lift for the outline to still read on a
    # dark room; the dark greys people also ask for are charcoal and smoke.
    # White is the same story from the other side, and it has had three
    # failure modes: warm grey shadows (#DCDCDB) looked like dirt; shadows so
    # faint (#E9EAED) that the user saw "no details left, just shining
    # bright"; and a pure #FFFFFF top that GLOWED on a dark room. The top is
    # now an off-white and the shadow a cool grey deep enough that the head's
    # real shading shows -- the chest and legs, which the artist drew nearly
    # flat, stay nearly flat because ramp_t keeps each part's own depth.
    'black':     ('#0B0B0D', '#2E2C2F'),
    'charcoal':  ('#232225', '#78746F'),
    'smoke':     ('#26242A', '#8C878B'),
    'grey':      ('#3D4248', '#C4C9CE'),   # British blue
    'bluegrey':  ('#34404C', '#9EAAB6'),   # Russian blue
    'silver':    ('#7B7F84', '#EFF1F2'),
    'white':     ('#C6CBD5', '#F5F6F8'),
    'lilac':     ('#6B5A5E', '#DCCFD0'),   # the pinkish grey dilute of chocolate
    'fawn':      ('#7A5C44', '#E8D0B6'),
    # the browns -- every one is a real pigment in the eumelanin series
    'cream':     ('#514840', '#D8D8D5'),   # the sprite's own taupe
    'chocolate': ('#3A2317', '#CB9D77'),
    'cinnamon':  ('#5C2E16', '#D69A63'),
    'brown':     ('#4A3220', '#C9A882'),   # brown tabby ground
    'caramel':   ('#7A4A1E', '#EFD0A2'),
    # the reds -- the phaeomelanin series, ginger down to buff
    'marmalade': ('#8A3B08', '#FFB25C'),
    'ginger':    ('#6E3612', '#F3C289'),
    'apricot':   ('#8B4A31', '#F8DABF'),
    'yellow':    ('#8C6420', '#F3D68E'),   # a buff / cream-ginger; "yellow" is the user's word
}

# Which parts take a fur colour at all. eyes/nose/ink are steered separately.
COLOURABLE = ['body', 'ears', 'tail', 'face', 'bib', 'legs', 'socks']

# Sensible starting points, so the picker opens on something that looks like a
# cat rather than on seven dropdowns set to grey.
PRESETS = [
    ('eren',      'EREN (TODAY)',    dict(body='cream', ears='cream', tail='cream',
                                          face='white', bib='white', legs='white',
                                          socks='white'), None, 'blue', 'pink'),
    ('black',     'ALL BLACK',       dict.fromkeys(COLOURABLE, 'black'), None, 'gold', 'pink'),
    # Blue eyes and a pink nose: the common pairing on a white cat, and the
    # one people picture.
    ('white',     'ALL WHITE',       dict.fromkeys(COLOURABLE, 'white'), None, 'blue', 'pink'),
    ('tuxedo',    'TUXEDO',          dict(body='black', ears='black', tail='black',
                                          face='white', bib='white', legs='white',
                                          socks='white'), None, 'gold', 'pink'),
    ('blacktail', 'BLACK, WHITE TAIL', dict(body='black', ears='black', tail='white',
                                            face='black', bib='black', legs='black',
                                            socks='white'), None, 'gold', 'pink'),
    ('gingertab', 'GINGER TABBY',    dict.fromkeys(COLOURABLE, 'ginger'), 'tabby', 'gold', 'pink'),
    ('orangewh',  'GINGER AND WHITE', dict(body='marmalade', ears='marmalade', tail='marmalade',
                                           face='white', bib='white', legs='white',
                                           socks='white'), 'tabby', 'green', 'pink'),
    ('yellow',    'YELLOW',          dict.fromkeys(COLOURABLE, 'yellow'), None, 'green', 'pink'),
    ('greytab',   'GREY TABBY',      dict.fromkeys(COLOURABLE, 'grey'), 'tabby', 'green', 'pink'),
    # All silver: a white part takes no pattern, so the white-chested version
    # of this had stripes only on the head and tail and read as a white cat
    # with a grey tail stuck on.
    ('silvertab', 'SILVER TABBY',    dict.fromkeys(COLOURABLE, 'silver'), 'tabby', 'green', 'pink'),
    ('siamese',   'SIAMESE',         dict(body='cream', ears='chocolate', tail='chocolate',
                                          face='chocolate', bib='cream', legs='cream',
                                          socks='chocolate'), None, 'blue', 'pink'),
    ('tortie',    'TORTOISESHELL',   dict.fromkeys(COLOURABLE, 'black'), 'tortie', 'copper', 'pink'),
    ('calico',    'CALICO',          dict(body='black', ears='black', tail='ginger',
                                          face='white', bib='white', legs='white',
                                          socks='white'), 'tortie', 'gold', 'pink'),
    ('tuxcinn',   'CINNAMON TUXEDO', dict(body='cinnamon', ears='cinnamon', tail='cinnamon',
                                          face='white', bib='white', legs='white',
                                          socks='white'), None, 'copper', 'pink'),
    ('bluecream', 'BLUE AND CREAM',  dict(body='bluegrey', ears='bluegrey', tail='bluegrey',
                                          face='cream', bib='cream', legs='cream',
                                          socks='bluegrey'), None, 'gold', 'pink'),
    ('smoketab',  'SMOKE TABBY',     dict.fromkeys(COLOURABLE, 'smoke'), 'tabby', 'copper', 'pink'),
    ('browntab',  'BROWN TABBY',     dict(body='brown', ears='brown', tail='brown',
                                          face='white', bib='white', legs='brown',
                                          socks='white'), 'tabby', 'green', 'pink'),
]

TORTIE_SECOND = 'marmalade'      # the other pigment in a tortoiseshell


# ---------------------------------------------------------------------------
# patterns
# ---------------------------------------------------------------------------

def _blocks(shape):
    """Per-pixel block coordinates, so every pattern edge is a block boundary."""
    h, w = shape
    bx = (np.arange(w) - PHASE_X) // GRID
    by = (np.arange(h) - PHASE_Y) // GRID
    return by[:, None], bx[None, :]


CENTRE_COL = int(round((P.CX - PHASE_X) / GRID))     # 29: the nose's column


def _mirror(blocks):
    """A set of (row, col) blocks drawn on the LEFT half, plus their mirror
    images. The cat is symmetric about column 29 (the nose), so the markings
    are drawn once."""
    return set(blocks) | {(r, 2 * CENTRE_COL - c) for r, c in blocks}


def _raster(shape, blocks):
    h, w = shape
    m = np.zeros(shape, dtype=bool)
    for r, c in blocks:
        y0, x0 = PHASE_Y + r * GRID, PHASE_X + c * GRID
        m[max(y0, 0):min(y0 + GRID, h), max(x0, 0):min(x0 + GRID, w)] = True
    return m


def _lean(col_top, r0, r1, width=2, step=3):
    """A stripe `width` blocks wide that starts at `col_top` on row r0 and
    steps one column OUTWARD (left, on the left half) every `step` rows: the
    way a mackerel stripe comes off the spine and leans down the flank. Where
    it runs off its part it is simply clipped, which tapers it."""
    return {(r, col_top - (r - r0) // step + k) for r in range(r0, r1 + 1) for k in range(width)}


# The markings of a MACKEREL TABBY, on the block grid, left half. Every one of
# these is a thing a cat actually has, in the place it has it:
#
#   M        the forehead "M": two shallow arches meeting above the nose
#   SHOULDER two leaning stripes on each shoulder, either side of the chest
#   HAUNCH   two leaning stripes on each haunch, outside the front legs
#
# Nothing on the chest, the muzzle, the cheeks, the legs, the belly, the paws
# or the ears. Rings on the tail come from tail_rings(), which curls with it.
#
# What was tried and why it is not here, in order:
#   * a bar code (two-block bars every five columns down the whole cat, bars
#     every four rows across the head) -- "the stripes look so bad and not
#     natural". Nothing on a cat repeats on a period.
#   * chains across the chest -- with the shoulder stripes and leg rings they
#     met at right angles and read as a cage of lines on the light chest.
#   * temple lines, cheek lines and the M's downward legs -- one block apart
#     from each other and from the art's own eye shading, they fused into one
#     dark mask and the M vanished inside it. The M is now the ONLY dark
#     shape on the forehead, with clear coat around it.
#   * one-block vertical stripes, broken -- next to the art's one-block LIGHT
#     fur highlights they read as pinstripe seams, and the one-row breaks
#     vanished at phone size. Now two blocks wide, leaning, unbroken.
#   * leg rings -- a one-block bar across a leg merges with the leg's own
#     outline and reads as a bandage; at phone size, a speck.
TABBY = {
    'M': {(21, 19), (21, 20), (22, 21), (22, 22), (23, 23), (23, 24), (24, 25), (24, 26),
          (25, 27), (25, 28), (26, 29)},
    'SHOULDER': _lean(17, 44, 58) | _lean(14, 46, 58),
    'HAUNCH': _lean(15, 59, 70) | _lean(12, 61, 70),
}

# Which parts each group may land on, so a shoulder stripe stays on the
# shoulder even where the block grid straddles the chest.
TABBY_PARTS = {
    'M': ('body',), 'SHOULDER': ('body', 'legs'), 'HAUNCH': ('body', 'legs'),
}

# Under a tabby the coat's deep shadows are LIFTED before the stripes go on:
# t' = t ** TABBY_GAMMA. The base art is a colourpoint: the fur around the
# eyes and over the forehead is its darkest, and on a solid coat that reads
# as shading. Under a tabby it read as a bandit mask -- two judges
# independently: "the ginger and grey tabbies read as bandit-faced
# colourpoints" -- and the M drawn on top of it was invisible. A gamma below
# one pulls the darks up hard (0.1 -> 0.28, 0.3 -> 0.52) and leaves the
# mid-tones and highlights nearly where they were, so the face loses its
# mask and the body KEEPS its form. The first fix was a linear squeeze into
# 0.45..0.85, which lifted the mask but flattened everything with it; the
# user's verdict on that was "this look so bad".
TABBY_GAMMA = 0.55


def tabby(shape, owner, groups=None):
    """The mackerel markings as a 0/1 float mask; the caller decides how far
    down the ramp a marked pixel is pulled. `owner` is eren_parts's part map,
    so each group is clipped to the parts it belongs on."""
    names = [k for k, _ in P.PARTS]
    out = np.zeros(shape, dtype=bool)
    for key, blocks in TABBY.items():
        if groups is not None and key not in groups:
            continue
        allowed = np.isin(owner, [names.index(p) for p in TABBY_PARTS[key]])
        out |= _raster(shape, _mirror(blocks)) & allowed
    return out.astype(np.float64)


# The tail's rings, walking from the base toward the tip: (dark?, width in
# blocks). Uneven on purpose -- a period is the tell of a machine -- and the
# dark bands widen toward the tip, which is solid dark, as a tabby's is. The
# first four blocks at the base carry no ring, so the tail joins the body in
# plain coat.
TAIL_BANDS = [(0, 4), (1, 2), (0, 3), (1, 2), (0, 2), (1, 3), (0, 2), (1, 3), (0, 2), (1, 3), (0, 2)]
TAIL_TIP = 3


def tail_rings(shape, owner):
    """Rings across the tail, measured ALONG it.

    The tail's centreline is the mean column of its blocks on each block
    row; arc length runs along it from the base (the bottom row) to the tip.
    Each block is projected onto the centreline's tangent at its row, so a
    band is a set of blocks at the same arc length: it sits ACROSS the
    tail's own axis and tilts with it where the tail leans. The first cut
    striped the tail by canvas ROW -- a horizontal band every four rows, two
    on, two off, the whole length -- and where the tail bends the bands cut
    it at an angle and the tip looked sliced like a striped sock. The user:
    "the tail lines look fake". (A geodesic distance walked through the
    blocks was tried in between: right direction, ragged edges.)
    """
    names = [k for k, _ in P.PARTS]
    h, w = shape
    tail = owner == names.index('tail')
    rows, cols = (h - PHASE_Y) // GRID, (w - PHASE_X) // GRID
    by_row = {}
    for r in range(rows):
        for c in range(cols):
            if tail[PHASE_Y + r * GRID + GRID // 2, PHASE_X + c * GRID + GRID // 2]:
                by_row.setdefault(r, []).append(c)
    if not by_row:
        return np.zeros(shape)
    rs = sorted(by_row)                                  # top (tip) .. bottom (base)
    centre = {r: float(np.mean(by_row[r])) for r in rs}
    arc, acc, prev = {}, 0.0, None
    for r in reversed(rs):                               # base -> tip
        if prev is not None:
            acc += float(np.hypot(prev - r, centre[r] - centre[prev]))
        arc[r], prev = acc, r
    s_max = acc
    edges, pos = [], 0.0
    for dark, width in TAIL_BANDS:
        edges.append((pos, pos + width, dark))
        pos += width
    dark_blocks = set()
    for i, r in enumerate(rs):
        r_up = rs[i - 1] if i > 0 else r
        r_dn = rs[i + 1] if i + 1 < len(rs) else r
        dcdr = (centre[r_up] - centre[r_dn]) / max(r_dn - r_up, 1)   # col change per row, going up
        along = dcdr / float(np.hypot(1.0, dcdr))                     # the tangent's column component
        for c in by_row[r]:
            s = arc[r] + (c - centre[r]) * along
            if s >= s_max - TAIL_TIP or any(lo <= s < hi and dark for lo, hi, dark in edges):
                dark_blocks.add((r, c))
    return _raster(shape, dark_blocks).astype(np.float64)


def tortie(shape, owner=None):
    """Tortoiseshell patches: the second pigment, in irregular blobs.

    Value noise on the block grid, not per-pixel noise -- per-pixel gives a
    speckle that reads as compression damage at this sprite's scale. The seed is
    fixed so a given cat is the same cat every time it renders, which matters
    once this is a saved character and not a preview.

    The cells are FIVE blocks: at three, two judges called the result static
    and paint splatter at phone size. Real tortie patches are a few blocks
    across at this sprite's scale. And the face is SPLIT down the middle, one
    pigment each side, which is the tortoiseshell tell people recognise
    before anything else.
    """
    h, w = shape
    rng = np.random.default_rng(7)
    cell = GRID * 5
    gh, gw = h // cell + 2, w // cell + 2
    noise = rng.random((gh, gw))
    big = np.repeat(np.repeat(noise, cell, axis=0), cell, axis=1)[:h, :w]
    # Smooth at the block scale, then threshold: this turns square cells into
    # rounded patches while keeping their edges snapped to the grid below.
    sm = L.ndimage.uniform_filter(big, size=cell)
    by, bx = _blocks((h, w))
    snapped = sm[np.clip(by * GRID + PHASE_Y, 0, h - 1), np.clip(bx * GRID + PHASE_X, 0, w - 1)]
    patch = snapped > 0.5
    head = np.broadcast_to(by < TORTIE_SPLIT_ROW, (h, w))
    left = np.broadcast_to(bx < CENTRE_COL, (h, w))
    return np.where(head, left, patch).astype(np.float64)


# The tortie's face split ends at the collar; below it the patches take over.
TORTIE_SPLIT_ROW = 44


PATTERNS = {'tabby': tabby, 'tortie': tortie}


# ---------------------------------------------------------------------------

def shading_span(v, mask):
    """How much shading the artist gave a region: its 3rd..97th percentile
    value range."""
    vv = v[mask]
    return float(np.percentile(vv, 97) - np.percentile(vv, 3)) if mask.any() else 0.0


def ramp_t(v, mask, ref_span=None, folds=None):
    """Where each pixel sits on its own region's dark->light ramp, 0..1.

    With `ref_span` (the BODY's shading span) the region keeps the artist's
    RELATIVE shading depth: a part whose values span a quarter of the body's
    only ever uses the top quarter of the ramp. Without it every part is
    stretched over the whole ramp, and that was two of the user's complaints
    at once: the faint folds on the white chest and legs (the art's coat is
    #E4 to #FC, a tenth of the body's range) were amplified into grey
    blotches -- "his bottom part colors are weird" -- while the same white on
    the head, which has real shading, looked no different from them.

    `folds` (eren_parts's fold strokes) are measured OUT of the range and kept
    OUT of the compression. They are darker than any white fur, so counted in
    they would drag the 3rd percentile down and re-stretch the chest's faint
    shading into blotches; and compressed like the rest they would sit at
    t ~0.7 and all but vanish. Uncompressed they land near the ramp's dark
    end: a light-grey line on a white chest, as drawn.
    """
    t = np.zeros_like(v)
    if not mask.any():
        return t
    vv = v[mask]
    f = folds[mask] if folds is not None else np.zeros(vv.shape, dtype=bool)
    st = vv[~f] if (~f).any() else vv
    lo, hi = np.percentile(st, 3), np.percentile(st, 97)
    tt = np.clip((vv - lo) / max(hi - lo, 1e-6), 0.0, 1.0)
    if ref_span:
        k = min(1.0, (hi - lo) / ref_span)
        tt = np.where(f, tt, 1.0 - (1.0 - tt) * k)
    t[mask] = tt
    return t


# How far a stripe pulls a pixel down its ramp, as a FRACTION of where it is:
# t' = t * (1 - STRIPE_DEPTH). Multiplicative, not subtractive, and the reason
# is what a stripe is -- the coat's dark pigment, at full density, wherever it
# falls. The first cut subtracted a constant, which put a stripe on the light
# chest at mid-ramp (a beige bar on a ginger cat) while the same stripe on the
# tail, whose fur starts darker, went nearly black: the stripes changed tone
# from part to part. Scaling toward zero sends every stripe to the dark end.
# On the gamma-lifted ground a depth of 0.7 puts a stripe on lit fur (t 0.9)
# at 0.28 and on mid fur (0.6) at 0.18: dark, but still above the outline,
# so a black tabby keeps its lines faintly (a "ghost tabby", which is what a
# black tabby actually is).
STRIPE_DEPTH = 0.7


def render(parts, pattern=None, eyes='blue', nose='pink', base=None):
    """parts: {part name -> FUR key}. Returns an RGBA array."""
    masks, owner, full = base if base else P.build()
    _, v = C.classify(full)
    out = full.copy()

    pat = PATTERNS[pattern](full.shape[:2], owner) if pattern in PATTERNS else None
    rings = tail_rings(full.shape[:2], owner) if pattern == 'tabby' else None
    names = [k for k, _ in P.PARTS]
    ref_span = shading_span(v, owner == names.index('body'))

    for i, (name, _) in enumerate(P.PARTS):
        if name not in COLOURABLE:
            continue
        m = owner == i
        if not m.any():
            continue
        coat = parts[name]
        dark, light = C.hx(FUR[coat][0]), C.hx(FUR[coat][1])
        t = ramp_t(v, m, ref_span, masks['folds'])[m]
        # A white patch never carries the pattern. Not a style call: a tabby's
        # stripes are denser pigment, and a white patch is the absence of
        # pigment, so there is nothing there to be denser. Striping it gave the
        # ginger-and-white cat a grey-barred chest, which no cat has.
        if coat == 'white':
            pass
        elif pattern == 'tabby':
            p = (rings if name == 'tail' else pat)[m]
            t = t ** TABBY_GAMMA
            t = t * (1.0 - STRIPE_DEPTH * p)
        elif pattern == 'tortie':
            # A real tortie's patches are pigment, so they get their own ramp
            # and the blend is per pixel rather than a darkening.
            p = pat[m][:, None]
            d2, l2 = C.hx(FUR[TORTIE_SECOND][0]), C.hx(FUR[TORTIE_SECOND][1])
            tt = t[:, None]
            a = dark * (1 - tt) + light * tt
            b = d2 * (1 - tt) + l2 * tt
            out[m, 0:3] = a * (1 - p) + b * p
            continue
        tt = t[:, None]
        out[m, 0:3] = dark * (1 - tt) + light * tt

    for name, table, key in (('eyes', C.EYE, eyes), ('nose', C.NOSE, nose)):
        i = [k for k, _ in P.PARTS].index(name)
        m = owner == i
        if m.any() and key:
            d, l = C.hx(table[key][0]), C.hx(table[key][1])
            tt = ramp_t(v, m)[m][:, None]
            out[m, 0:3] = d * (1 - tt) + l * tt
    return out


def sheet(items, path, cols=4, thumb=180, bg=(28, 18, 48)):
    pad, head = 14, 20
    rows = (len(items) + cols - 1) // cols
    im = Image.new('RGB', (cols * thumb + (cols + 1) * pad,
                           rows * (thumb + head) + (rows + 1) * pad), bg)
    d = ImageDraw.Draw(im)
    for i, (label, arr) in enumerate(items):
        r, c = divmod(i, cols)
        x, y = pad + c * (thumb + pad), pad + r * (thumb + head + pad)
        s = float(thumb) / max(arr.shape[0], arr.shape[1])
        t = L.to_pil(L._resize(arr, s))
        im.paste(t, (x + (thumb - t.width) // 2, y + (thumb - t.height) // 2), t)
        d.text((x + 2, y + thumb + 4), label, fill=(245, 197, 66))
    im.save(path)
    print('sheet -> %s  %s' % (path, im.size))


def main():
    base = P.build()
    items = []
    for key, label, parts, pattern, eyes, nose in PRESETS:
        img = render(parts, pattern, eyes, nose, base=base)
        assert np.array_equal(img[..., 3], base[2][..., 3]), '%s changed the alpha' % key
        items.append((label, img))
        print('  %-10s %s' % (key, label))
    sheet(items, os.path.join(L.PREVIEW_DIR, 'eren_cats.png'))


if __name__ == '__main__':
    main()
