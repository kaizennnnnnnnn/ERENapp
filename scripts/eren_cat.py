"""Build a cat from a spec: a colour per body part, plus a pattern.

    py scripts/eren_cat.py        (writes scripts/anim_preview/eren_cats.png)

This is the thing the onboarding customiser would call. A cat is:

    {'parts': {'body': 'black', 'tail': 'white', 'socks': 'white', ...},
     'pattern': 'tabby', 'eyes': 'gold', 'nose': 'slate'}

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
    'black':     ('#141318', '#6F6C77'),
    'charcoal':  ('#24222B', '#7E7A88'),
    'smoke':     ('#2A2733', '#9B93A8'),
    'grey':      ('#3B4046', '#CBD2D8'),
    'bluegrey':  ('#26344F', '#A9B9D6'),
    'silver':    ('#787D85', '#F2F4F6'),
    'white':     ('#DCDCDB', '#FFFFFF'),
    'cream':     ('#514840', '#D8D8D5'),   # the sprite's own colours
    'ginger':    ('#6E3612', '#F3C289'),
    'marmalade': ('#8A3B08', '#FFB25C'),
    'yellow':    ('#8A6412', '#F7DC8A'),
    'caramel':   ('#7A4A1E', '#EFD0A2'),
    'apricot':   ('#8B4A31', '#F8DABF'),
    'chocolate': ('#3A2317', '#CB9D77'),
    'cinnamon':  ('#5C2E16', '#D69A63'),
    'fawn':      ('#7A5C44', '#E8D0B6'),
    'lilac':     ('#5B3F50', '#E6CFDC'),
    'rose':      ('#7B3F4C', '#F4CBD2'),     # fantasy from here down
    'lavender':  ('#4A3A72', '#D2C6F0'),
    'mint':      ('#255043', '#BCE8D4'),
    'sky':       ('#26496E', '#BBDBF2'),
}

# Which parts take a fur colour at all. eyes/nose/ink are steered separately.
COLOURABLE = ['body', 'ears', 'tail', 'face', 'bib', 'legs', 'socks']

# Sensible starting points, so the picker opens on something that looks like a
# cat rather than on seven dropdowns set to grey.
PRESETS = [
    ('eren',      'EREN (TODAY)',    dict(body='cream', ears='cream', tail='cream',
                                          face='white', bib='white', legs='white',
                                          socks='white'), None, 'blue', 'pink'),
    ('black',     'ALL BLACK',       dict.fromkeys(COLOURABLE, 'black'), None, 'gold', 'slate'),
    ('tuxedo',    'TUXEDO',          dict(body='black', ears='black', tail='black',
                                          face='white', bib='white', legs='white',
                                          socks='white'), None, 'gold', 'slate'),
    ('blacktail', 'BLACK, WHITE TAIL', dict(body='black', ears='black', tail='white',
                                            face='black', bib='black', legs='black',
                                            socks='white'), None, 'gold', 'slate'),
    ('gingertab', 'GINGER TABBY',    dict.fromkeys(COLOURABLE, 'ginger'), 'tabby', 'gold', 'brick'),
    ('orangewh',  'GINGER AND WHITE', dict(body='marmalade', ears='marmalade', tail='marmalade',
                                           face='white', bib='white', legs='white',
                                           socks='white'), 'tabby', 'green', 'brick'),
    ('yellow',    'YELLOW',          dict.fromkeys(COLOURABLE, 'yellow'), None, 'green', 'brick'),
    ('greytab',   'GREY TABBY',      dict.fromkeys(COLOURABLE, 'grey'), 'tabby', 'green', 'slate'),
    ('silvertab', 'SILVER TABBY',    dict(body='silver', ears='silver', tail='silver',
                                          face='white', bib='white', legs='white',
                                          socks='white'), 'tabby', 'green', 'brick'),
    ('siamese',   'SIAMESE',         dict(body='cream', ears='chocolate', tail='chocolate',
                                          face='chocolate', bib='cream', legs='cream',
                                          socks='chocolate'), None, 'blue', 'slate'),
    ('tortie',    'TORTOISESHELL',   dict.fromkeys(COLOURABLE, 'black'), 'tortie', 'copper', 'slate'),
    ('calico',    'CALICO',          dict(body='black', ears='black', tail='ginger',
                                          face='white', bib='white', legs='white',
                                          socks='white'), 'tortie', 'gold', 'pink'),
    ('tuxcinn',   'CINNAMON TUXEDO', dict(body='cinnamon', ears='cinnamon', tail='cinnamon',
                                          face='white', bib='white', legs='white',
                                          socks='white'), None, 'copper', 'brick'),
    ('bluecream', 'BLUE AND CREAM',  dict(body='bluegrey', ears='bluegrey', tail='bluegrey',
                                          face='cream', bib='cream', legs='cream',
                                          socks='bluegrey'), None, 'gold', 'slate'),
    ('smoketab',  'SMOKE TABBY',     dict.fromkeys(COLOURABLE, 'smoke'), 'tabby', 'copper', 'slate'),
    ('mint',      'MINT (NOT A REAL CAT)', dict(body='mint', ears='mint', tail='mint',
                                                face='white', bib='white', legs='white',
                                                socks='white'), None, 'gold', 'pink'),
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


def tabby(shape):
    """Mackerel stripes: bars across the head and down the flanks, rings on the
    tail. Three different axes because that is what the markings actually do --
    one global stripe direction reads as a deckchair, not as a cat.

    Returns a 0/1 float array; the caller decides how far down the ramp it
    pulls.
    """
    by, bx = _blocks(shape)
    by, bx = np.broadcast_to(by, shape), np.broadcast_to(bx, shape)
    head = (by < 44)                      # above the chin
    # Head: bars across, tighter than the body's, with the pair either side of
    # the centre line left clear so the forehead keeps its "M".
    m_head = ((by % 4) < 2) & (np.abs(bx - 29) > 1)
    # Flanks: bars down, offset every other row so they break up rather than
    # running the full height of the cat.
    m_body = (((bx + (by // 6)) % 5) < 2)
    return np.where(head, m_head, m_body).astype(np.float64)


def tail_rings(shape):
    """Bands across the tail. Separate from tabby() because a tail has rings
    even on cats whose body stripes are faint, and because the tail curls -- a
    band that follows the body's stripe axis would run ALONG it."""
    by, _ = _blocks(shape)
    return np.broadcast_to((((by + 1) % 4) < 2), shape).astype(np.float64)


def tortie(shape):
    """Tortoiseshell patches: the second pigment, in irregular blobs.

    Value noise on the block grid, not per-pixel noise -- per-pixel gives a
    speckle that reads as compression damage at this sprite's scale. The seed is
    fixed so a given cat is the same cat every time it renders, which matters
    once this is a saved character and not a preview.
    """
    h, w = shape
    rng = np.random.default_rng(7)
    cell = GRID * 3
    gh, gw = h // cell + 2, w // cell + 2
    noise = rng.random((gh, gw))
    big = np.repeat(np.repeat(noise, cell, axis=0), cell, axis=1)[:h, :w]
    # Smooth at the block scale, then threshold: this turns square cells into
    # rounded patches while keeping their edges snapped to the grid below.
    sm = L.ndimage.uniform_filter(big, size=cell)
    by, bx = _blocks((h, w))
    snapped = sm[np.clip(by * GRID + PHASE_Y, 0, h - 1), np.clip(bx * GRID + PHASE_X, 0, w - 1)]
    return (snapped > 0.5).astype(np.float64)


PATTERNS = {'tabby': tabby, 'tortie': tortie}


# ---------------------------------------------------------------------------

def ramp_t(v, mask):
    """Where each pixel sits on its own region's dark->light ramp, 0..1."""
    t = np.zeros_like(v)
    if not mask.any():
        return t
    vv = v[mask]
    lo, hi = np.percentile(vv, 3), np.percentile(vv, 97)
    t[mask] = np.clip((vv - lo) / max(hi - lo, 1e-6), 0.0, 1.0)
    return t


# How far a stripe pulls a pixel down its ramp. 0.42 was picked by eye at the
# 172px ship size: below about 0.3 the stripes vanish once the sprite is small,
# above about 0.55 a dark coat's stripes turn into holes.
STRIPE_DEPTH = 0.42


def render(parts, pattern=None, eyes='blue', nose='pink', base=None):
    """parts: {part name -> FUR key}. Returns an RGBA array."""
    masks, owner, full = base if base else P.build()
    _, v = C.classify(full)
    out = full.copy()

    pat = PATTERNS[pattern](full.shape[:2]) if pattern in PATTERNS else None
    rings = tail_rings(full.shape[:2]) if pattern == 'tabby' else None

    for i, (name, _) in enumerate(P.PARTS):
        if name not in COLOURABLE:
            continue
        m = owner == i
        if not m.any():
            continue
        coat = parts[name]
        dark, light = C.hx(FUR[coat][0]), C.hx(FUR[coat][1])
        t = ramp_t(v, m)[m]
        # A white patch never carries the pattern. Not a style call: a tabby's
        # stripes are denser pigment, and a white patch is the absence of
        # pigment, so there is nothing there to be denser. Striping it gave the
        # ginger-and-white cat a grey-barred chest, which no cat has.
        if coat == 'white':
            pass
        elif pattern == 'tabby':
            p = (rings if name == 'tail' else pat)[m]
            t = np.clip(t - STRIPE_DEPTH * p, 0.0, 1.0)
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
