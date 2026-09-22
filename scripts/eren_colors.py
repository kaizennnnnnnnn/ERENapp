"""Recolour Eren without redrawing him.

    py scripts/eren_colors.py            (from the repo root; `py`, not `python`)

Writes one PNG per coat to scripts/anim_preview/colors/ plus a contact sheet,
scripts/anim_preview/eren_colors.png -- which is the thing to actually look at.

WHY THIS WORKS AT ALL
---------------------
The art separates cleanly by colour. Measured over erenGood.png's 480k opaque
pixels, with every pixel landing in exactly one bucket and none left over:

    ink    19.1%   V < 0.25              the outline
    eye     1.1%   hue 198..231          the only cool hue on the sprite
    nose    0.3%   hue 317..333
    coat   36.4%   V > 0.86, sat < 0.10  the white bib, belly, muzzle, socks
    fur    43.1%   everything else       the points

THE FUR MASK IS THE REMAINDER, NOT A HUE BAND. The first attempt selected fur by
hue (10..60 deg) and Eren grew someone else's tail: the tail is a desaturated
taupe, too flat to pass a sat > 0.12 test and too dark to pass the coat test, so
it fell through every branch and kept its old colour while the head changed.
Defining fur as "opaque, and none of the other four" cannot leave a hole.

GRADIENT MAP, NOT AN HSV SHIFT
------------------------------
Each region's VALUE is normalised over its own 3rd..97th percentile and used to
look up a colour between two endpoints. That keeps every bit of shading and
every block edge exactly where the artist put them -- only the hue and the
contrast ratio change -- and it gives direct control of the result, which
"rotate the hue 40 degrees and hope" does not. It also handles the case an HSV
shift cannot: the base fur's median saturation is 0.12, so turning it ginger by
multiplying saturation would need a 5x that blows out the few saturated pixels
long before the flat ones arrive anywhere near orange.

Base endpoints, for reference when inventing a new coat:
    ink  #000000 -> #212120      coat #E4E4E3 -> #FCFFFF
    fur  #514840 -> #D8D8D5      eye  #2C4560 -> #5894BE
    nose #B688A3 -> #E697C0

WHAT THIS CANNOT DO
-------------------
Patterns. A tabby's stripes, a tuxedo's bib, a calico's patches are SHAPES, and
there are none in this sprite to recolour -- they would have to be painted on
the 14px block grid, per pattern, respecting the silhouette. Colour is free
because the shading already exists; pattern is not.
"""

import os

import numpy as np
from PIL import Image, ImageDraw

import anim_lib as L

SRC = 'erenGood.png'
OUT_DIR = os.path.join(L.PREVIEW_DIR, 'colors')
os.makedirs(OUT_DIR, exist_ok=True)

# Anything this opaque gets classified. Deliberately far below the 200 the
# animation masks use: an edge pixel at alpha 40 is still a visible edge pixel,
# and leaving a rim of the old colour around a recoloured cat is exactly the
# kind of thing that reads as "cheap filter" rather than "a different cat".
ALPHA_FLOOR = 8


def hx(s):
    """'#RRGGBB' -> float array."""
    s = s.lstrip('#')
    return np.array([int(s[i:i + 2], 16) for i in (0, 2, 4)], dtype=np.float64)


def hsv(rgb01):
    """(hue in degrees, saturation, value) from an (H, W, 3) array in 0..1."""
    mx = rgb01.max(axis=2)
    mn = rgb01.min(axis=2)
    d = mx - mn
    r, g, b = rgb01[..., 0], rgb01[..., 1], rgb01[..., 2]
    safe = np.where(d > 1e-6, d, 1.0)
    h = np.zeros_like(mx)
    sel = d > 1e-6
    i_r = sel & (mx == r)
    i_g = sel & (mx == g) & ~i_r
    i_b = sel & (mx == b) & ~i_r & ~i_g
    h[i_r] = (60.0 * ((g - b) / safe))[i_r] % 360.0
    h[i_g] = (60.0 * (2.0 + (b - r) / safe))[i_g]
    h[i_b] = (60.0 * (4.0 + (r - g) / safe))[i_b]
    return h, np.where(mx > 1e-6, d / np.where(mx > 1e-6, mx, 1.0), 0.0), mx


def classify(img):
    """The five regions, as boolean masks that partition the opaque pixels."""
    a = img[..., 3]
    h, sat, v = hsv(img[..., :3] / 255.0)
    op = a > ALPHA_FLOOR
    ink = op & (v < 0.25)
    eye = op & ~ink & (h >= 180) & (h < 275) & (sat > 0.15)
    nose = op & ~ink & (h >= 290) & (sat > 0.15)
    coat = op & ~ink & ~eye & ~nose & (v > 0.86) & (sat < 0.10)
    fur = op & ~ink & ~eye & ~nose & ~coat        # the remainder. See the header.
    return {'ink': ink, 'eye': eye, 'nose': nose, 'coat': coat, 'fur': fur}, v


def gradient_map(out, mask, v, dark, light):
    """Repaint `mask` along the dark->light ramp, keyed on its own value channel.

    Normalising over the region's 3rd..97th percentile rather than its min/max
    keeps one stray near-black antialiased pixel from spending half the ramp.
    """
    if not mask.any():
        return
    vv = v[mask]
    lo, hi = np.percentile(vv, 3), np.percentile(vv, 97)
    t = np.clip((vv - lo) / max(hi - lo, 1e-6), 0.0, 1.0)[:, None]
    out[mask, 0:3] = hx(dark) * (1.0 - t) + hx(light) * t


# ---------------------------------------------------------------------------
# the coats
#
# Each entry names the endpoints for the regions it changes; anything left out
# keeps the sprite's own colours. Eye and nose are separate levers on purpose --
# a ginger cat with the base blue eyes reads as a costume, and a grey cat wants
# a slate nose rather than a pink one, because that is what real cats have.
# ---------------------------------------------------------------------------

EYE = {
    'blue':   ('#2C4560', '#5894BE'),   # the base
    'green':  ('#1F3D2A', '#74BA7E'),
    'gold':   ('#6A4410', '#E8AE31'),
    'copper': ('#54290F', '#C4702C'),
}
NOSE = {
    'pink':  ('#B688A3', '#E697C0'),    # the base
    'brick': ('#9E5645', '#DE8C72'),
    'slate': ('#484851', '#8E8E99'),
}
COAT = {
    'white': ('#E4E4E3', '#FCFFFF'),    # the base
    'cream': ('#EDE3D6', '#FFFCF5'),
    'cool':  ('#DDE2E6', '#F9FCFF'),
}

PALETTES = [
    # key          label         fur dark    fur light   eye       nose     coat
    ('cream',     'CREAM',      None,       None,       None,     None,    None),
    ('ginger',    'GINGER',     '#6E3612',  '#F3C289',  'gold',   'brick', 'cream'),
    ('grey',      'GREY',       '#3B4046',  '#CBD2D8',  'green',  'slate', 'cool'),
    ('chocolate', 'CHOCOLATE',  '#3A2317',  '#CB9D77',  'copper', 'brick', 'cream'),
    # Black and white are the same ramps as eren_cat.FUR, for the same reason
    # given there: most of the coat lands at the LIGHT end, so the light end
    # is what the cat looks like. A mid-grey light end made a grey cat.
    ('black',     'BLACK',      '#0B0B0D',  '#2E2C2F',  'gold',   'slate', 'white'),
    ('white',     'WHITE',      '#E9EAED',  '#FFFFFF',  'blue',   'pink',  'white'),
    # These three plus GREY came back as four shades of the same cat on the first
    # sheet. Pulled apart deliberately: lilac carries real mauve, blue point goes
    # colder AND darker, silver goes almost to white so it reads by lightness
    # rather than by hue.
    ('lilac',     'LILAC',      '#6B5A5E',  '#DCCFD0',  'blue',   'pink',  'white'),
    ('bluepoint', 'BLUE POINT', '#34404C',  '#9EAAB6',  'blue',   'slate', 'cool'),
    ('silver',    'SILVER',     '#7B7F84',  '#EFF1F2',  'green',  'slate', 'cool'),
    ('apricot',   'APRICOT',    '#8B4A31',  '#F8DABF',  'blue',   'brick', 'cream'),
    ('smoke',     'SMOKE',      '#26242A',  '#8C878B',  'copper', 'slate', 'cool'),
    ('caramel',   'CARAMEL',    '#7A4A1E',  '#EFD0A2',  'green',  'brick', 'cream'),
    ('fawn',      'FAWN',       '#7A5C44',  '#E8D0B6',  'gold',   'pink',  'cream'),
]


def recolor(img, fur_dark, fur_light, eye, nose, coat):
    masks, v = classify(img)
    out = img.copy()
    if fur_dark:
        gradient_map(out, masks['fur'], v, fur_dark, fur_light)
    if coat:
        gradient_map(out, masks['coat'], v, *COAT[coat])
    if eye:
        gradient_map(out, masks['eye'], v, *EYE[eye])
    if nose:
        gradient_map(out, masks['nose'], v, *NOSE[nose])
    return out


# ---------------------------------------------------------------------------

def sheet(items, path, cols=4, thumb=190, bg=(28, 18, 48)):
    """Contact sheet at roughly the size the app renders him, on the app's own
    panel purple -- a cat judged against white reads differently to one in the
    UI, and a pale coat judged against white barely reads at all.
    """
    pad, head = 14, 20
    rows = (len(items) + cols - 1) // cols
    W = cols * thumb + (cols + 1) * pad
    H = rows * (thumb + head) + (rows + 1) * pad
    im = Image.new('RGB', (W, H), bg)
    d = ImageDraw.Draw(im)
    for i, (label, arr) in enumerate(items):
        r, c = divmod(i, cols)
        x = pad + c * (thumb + pad)
        y = pad + r * (thumb + head + pad)
        h0, w0, _ = arr.shape
        s = float(thumb) / max(w0, h0)
        t = L.to_pil(L._resize(arr, s))
        im.paste(t, (x + (thumb - t.width) // 2, y + (thumb - t.height) // 2), t)
        d.text((x + 2, y + thumb + 4), label, fill=(245, 197, 66))
    im.save(path)
    print('sheet -> %s  (%dx%d)' % (path, W, H))


def main():
    img = L.load(SRC)
    masks, _ = classify(img)
    n = int((img[..., 3] > ALPHA_FLOOR).sum())
    print('%s  %dx%d   %d opaque px' % (SRC, img.shape[1], img.shape[0], n))
    for k, m in masks.items():
        print('  %-5s %7d  %5.1f%%' % (k, int(m.sum()), 100.0 * m.sum() / n))
    covered = sum(int(m.sum()) for m in masks.values())
    assert covered == n, 'regions must partition the opaque pixels: %d vs %d' % (covered, n)

    items = []
    for key, label, fd, fl, eye, nose, coat in PALETTES:
        out = recolor(img, fd, fl, eye, nose, coat)
        # Alpha is never touched, so a recolour cannot change the silhouette.
        assert np.array_equal(out[..., 3], img[..., 3]), '%s changed the alpha' % key
        p = os.path.join(OUT_DIR, 'erenGood_%s.png' % key)
        L.save_png(out, p)
        items.append((label, out))
        print('  %-10s -> %s  (%.0fKB)' % (key, p, os.path.getsize(p) / 1024.0))
    sheet(items, os.path.join(L.PREVIEW_DIR, 'eren_colors.png'))


if __name__ == '__main__':
    main()
